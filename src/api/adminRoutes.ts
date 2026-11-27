import express, { NextFunction, Request, Response } from "express";
import multer from "multer";
import prisma from "../db";
import requireAdmin from "../auth/requireAdmin";
import { isStaffRequest, requireStaffOnly } from "../auth/requireStaffOnly";
import { parseStudentSpreadsheet, parseCheckInSpreadsheet } from "../utils/studentImportParser";
import {
  loadSuperAdminState,
  saveSuperAdminState,
  saveSuperAdminStateOrThrow,
  calculateEventHours,
  EventSessionItem,
  EventCheckInItem,
  getStudentRoundState,
  MasterCompanyRecord,
} from "../utils/superAdminStore";
import { ISSUE_ADMIN_NOTE_MAX, ISSUE_STATUS, isIssueStatus } from "../utils/issueReports";
import {
  ImportedCompanyRow,
  buildCompanyImportTemplate,
  classifyCompanyImport,
  normalizeCompanyName,
  parseCompanySpreadsheet,
} from "../utils/companyImportParser";
import { analyzeAcceptanceForm, fetchFileBuffer } from "../utils/acceptanceOcr";
import cohortRouter, { getOpenMajorsSummary } from "./cohortRoutes";
import { adminCoopRouter, buildCoopExportRows, coopSummaryForProfile } from "./coopRoutes";
import { CV_CATEGORY, CV_COMMENT_ROLE_LABEL, CV_STATE_LABEL, CvCommentRole, cvCommentError, cvCommentRole, cvState, hasCv, isCommentForOlderFile, uploadedAfterLastComment } from "../utils/cvReview";
import {
  activeFormMajorsChangeError,
  checklistCoverage,
  formMajorsLabel,
  normalizeFormMajorCodes,
  planChecklistActivation,
} from "../utils/checklistForms";
import {
  backfillLegacyBatches,
  findIneligibleForLetter,
  letterHeaderSnapshot,
  newBatchId,
  saveLetterBatch,
  toBatchStudent,
} from "../utils/letterBatches";
import { findMajor } from "../utils/majors";
import { notifyAdvisorStaff, notifyAdvisorsOfStudents, notifyCourseAdminsForStudents, notifyStudents } from "../utils/notifications";
import {
  docWorkflowPayload,
  isDecision,
  placementResultPayload,
  staffAssignedPayload,
  StudentRef,
  studentEventPayload,
  trainingResultPayload,
  withNote,
} from "../utils/notificationRules";
import { cohortAcademicYear, cohortCodeOf, ymd } from "../utils/internshipWindowRules";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

/** จำนวนสถานประกอบการสูงสุดที่นำเข้าจากไฟล์ได้ต่อครั้ง */
const COMPANY_IMPORT_MAX_ROWS = 2000;

const signatureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const fileName = file.originalname.toLowerCase();
    const isPng = fileName.endsWith(".png") && file.mimetype === "image/png";
    const isJpeg = /\.(jpe?g)$/.test(fileName) && file.mimetype === "image/jpeg";
    if (!isPng && !isJpeg) {
      callback(new Error("รองรับเฉพาะไฟล์ PNG, JPG หรือ JPEG"));
      return;
    }
    callback(null, true);
  },
});

const parseAcademicSignatureUpload = (req: Request, res: Response, next: NextFunction) => {
  signatureUpload.single("signature")(req, res, error => {
    if (error) {
      const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "ไฟล์ลายเซ็นต้องมีขนาดไม่เกิน 2 MB"
        : error.message || "ไฟล์ลายเซ็นไม่ถูกต้อง";
      res.status(400).json({ success: false, message });
      return;
    }
    next();
  });
};

const router = express.Router();

// ต้อง login + เป็น admin หรือ staff ทุก route ภายใต้ /api/admin
router.use(requireAdmin);

// งานเอกสารราชการ / ตั้งค่าหนังสือ = งานของเจ้าหน้าที่ฝ่ายฝึกงานคนเดียว (Role Matrix ง.) — อาจารย์ประจำวิชาดูสถานะได้ แต่สั่งทำไม่ได้
const requireDocumentStaff = requireStaffOnly("เฉพาะเจ้าหน้าที่ฝ่ายฝึกงาน (Staff) เท่านั้นที่ออกหนังสือ / บันทึกผลแบบตอบรับ / ล็อกเอกสารได้");
const requireLetterSettingsStaff = requireStaffOnly("เฉพาะเจ้าหน้าที่ฝ่ายฝึกงาน (Staff) เท่านั้นที่ตั้งค่าหนังสือราชการ (เลขที่หนังสือ / ผู้ลงนาม / ลายเซ็น) ได้");

// รุ่น & รอบออกฝึก (หน้า "รอบฝึกงาน & ปลดล็อก")
router.use(cohortRouter);
// ประกาศรับนิสิตสหกิจศึกษา (หน้า "ประกาศสหกิจศึกษา")
router.use(adminCoopRouter);

const STATUS_LABELS: Record<string, Record<string, string>> = {
  readiness: {
    approvedPlacement: "อนุมัติที่ฝึกงานแล้ว",
    cvUploaded: "มี CV แล้ว",
    trainingComplete: "ผ่านการตรวจชม.ครบ",
    noDataOrHoursLack: "ไม่มีข้อมูล/ชม.ไม่ครบ",
  },
  training: {
    passedComplete: "ผ่านการตรวจชม.ครบ",
    completeNotChecked: "ชม.ครบ ยังไม่ตรวจ",
    checkedNotPass: "ตรวจแล้ว ยังไม่ผ่าน",
    hoursNotComplete: "ชั่วโมงยังไม่ครบ",
  },
  // CV: อาจารย์คอมเมนต์อย่างเดียว ไม่อนุมัติ (src/utils/cvReview.ts)
  cv: {
    commented: CV_STATE_LABEL.COMMENTED,
    waiting: CV_STATE_LABEL.WAITING,
    noCv: CV_STATE_LABEL.NONE,
  },
  placement: {
    approved: "อนุมัติที่ฝึกงานแล้ว",
    rejected: "ไม่อนุมัติที่ฝึกงาน",
    pending: "รอผล",
  },
};

function categorizeStudent(s: any) {
  const approvedTrainings = (s.trainingRecords || []).filter((t: any) => t.status === "APPROVED");
  const softHours = approvedTrainings
    .filter((t: any) => t.skillType === "SOFT")
    .reduce((sum: number, t: any) => sum + t.hours, 0);
  const hardHours = approvedTrainings
    .filter((t: any) => t.skillType === "HARD")
    .reduce((sum: number, t: any) => sum + t.hours, 0);
  const isTrainingComplete = softHours >= 12 && hardHours >= 18;
  const hasRejectedTraining = (s.trainingRecords || []).some((t: any) => t.status === "REJECTED");
  const hasPendingTraining = (s.trainingRecords || []).some((t: any) => t.status === "PENDING");

  // 1. สถานะการอบรม (Training)
  let trainingCategory = "hoursNotComplete";
  if (isTrainingComplete) {
    if (hasPendingTraining) {
      trainingCategory = "completeNotChecked";
    } else {
      trainingCategory = "passedComplete";
    }
  } else if (hasRejectedTraining) {
    trainingCategory = "checkedNotPass";
  } else {
    trainingCategory = "hoursNotComplete";
  }

  // 2. สถานะ CV (ไม่มีการอนุมัติ: ยังไม่อัปโหลด / รอคอมเมนต์ / คอมเมนต์แล้ว)
  const studentHasCv = hasCv(s.cv);
  const cvCategory: string = CV_CATEGORY[cvState(s.cv)];

  // 3. สถานะอนุมัติฝึกงาน (Placement)
  let placementCategory: string | null = null;
  if (s.placement) {
    if (s.placement.status === "APPROVED") {
      placementCategory = "approved";
    } else if (s.placement.status === "REJECTED") {
      placementCategory = "rejected";
    } else {
      placementCategory = "pending";
    }
  }

  // 4. สถานะความพร้อม (Readiness)
  let readinessCategory = "noDataOrHoursLack";
  if (s.placement && s.placement.status === "APPROVED") {
    readinessCategory = "approvedPlacement";
  } else if (studentHasCv) {
    readinessCategory = "cvUploaded";
  } else if (isTrainingComplete) {
    readinessCategory = "trainingComplete";
  } else {
    readinessCategory = "noDataOrHoursLack";
  }

  // Overall status (สถานะรวมที่แสดงเป็น Badge เริ่มต้นในตาราง)
  let overallStatus = "ยังไม่มีข้อมูล";
  let statusCategory = "none";

  if (s.placement && s.placement.status === "APPROVED") {
    overallStatus = "อนุมัติที่ฝึกงานแล้ว";
    statusCategory = "placement_approved";
  } else if (s.placement && s.placement.status === "REJECTED") {
    overallStatus = "ไม่อนุมัติที่ฝึกงาน";
    statusCategory = "placement_rejected";
  } else if (s.placement && s.placement.status === "PENDING") {
    overallStatus = "รออนุมัติที่ฝึกงาน";
    statusCategory = "placement_pending";
  } else if (s.companies && s.companies.some((c: any) => c.submission && c.submission.status === "INTERVIEW_PASSED")) {
    overallStatus = "สัมภาษณ์ผ่านแล้ว";
    statusCategory = "interview_passed";
  } else if (studentHasCv && isTrainingComplete) {
    overallStatus = "มี CV + ชม.ครบ";
    statusCategory = "ready";
  } else if (studentHasCv) {
    overallStatus = "มี CV แล้ว (ชม.อบรมยังไม่ครบ)";
    statusCategory = "cv_uploaded";
  } else if (isTrainingComplete && !hasRejectedTraining) {
    overallStatus = "ผ่านการตรวจชม.ครบ";
    statusCategory = "training_complete";
  } else if (hasRejectedTraining) {
    overallStatus = "ชั่วโมงอบรมไม่ผ่าน";
    statusCategory = "training_rejected";
  } else if (s.trainingRecords && s.trainingRecords.length > 0) {
    overallStatus = "ชั่วโมงอบรมยังไม่ครบ";
    statusCategory = "training_incomplete";
  } else {
    overallStatus = "ยังไม่มีข้อมูล";
    statusCategory = "none";
  }

  return {
    softHours,
    hardHours,
    isTrainingComplete,
    hasRejectedTraining,
    hasPendingTraining,
    trainingCategory,
    cvCategory,
    placementCategory,
    readinessCategory,
    overallStatus,
    statusCategory,
    readinessLabel: STATUS_LABELS.readiness[readinessCategory],
    trainingLabel: STATUS_LABELS.training[trainingCategory],
    cvLabel: STATUS_LABELS.cv[cvCategory],
    placementLabel: placementCategory ? STATUS_LABELS.placement[placementCategory] : "-",
  };
}

// [REQ-06] ตรวจสอบว่าสถานประกอบการที่ยื่นฝึกงานจริง ตรงกับ 1 ในบริษัทที่ผ่านการอนุมัติใน Checklist หรือไม่
function checkPlacementMatchesChecklist(placement: any, companies: any[]): boolean {
  if (!placement || !placement.companyNameTh || !placement.companyNameTh.trim()) return true;
  const approvedList = (companies || []).filter((c: any) => c.checklistStatus === "APPROVED");
  if (approvedList.length === 0) return true;

  if (placement.companyId && approvedList.some((c: any) => c.id === placement.companyId)) {
    return true;
  }

  const targetName = (placement.companyNameTh || "").trim().toLowerCase();
  return approvedList.some((c: any) => {
    const cName = (c.name || "").trim().toLowerCase();
    return cName && (cName === targetName || cName.includes(targetName) || targetName.includes(cName));
  });
}

// Helper: กรองขอบเขตสาขาวิชา (Department Scoping สำหรับอาจารย์ประจำวิชาแต่ละสาขา vs เจ้าหน้าที่คณะ/Admin กลาง)

// Helper: คำนวณระดับความวิกฤตของนิสิต (Risk Priority: 1 วิกฤตสุด -> 5 เบาสุด)
function getStudentRiskPriority(s: any): number {
  // Rank 1: วิกฤตสูงสุด - ยังไม่มีข้อมูลใดๆ หรือยังไม่เริ่มทำอะไรเลย (เช่น ยังไม่ส่ง CV, ชม.อบรมเป็น 0, ไม่มี Checklist, ไม่มีที่ฝึกงาน)
  const isNoData = s.statusCategory === "none" ||
    s.overallStatus === "ยังไม่มีข้อมูล" ||
    (!s.cvStatus &&
      (s.trainingApprovedSoft || 0) === 0 &&
      (s.trainingApprovedHard || 0) === 0 &&
      !s.hasChecklistApproved &&
      !s.placementStatus);
  if (isNoData) return 1;

  // Rank 2: มีปัญหา / ติดขัด / ถูกปฏิเสธ / บริษัทไม่ตรง Checklist [REQ-06]
  const hasIssue = s.placementStatus === "REJECTED" ||
    s.placementCategory === "rejected" ||
    s.statusCategory === "placement_rejected" ||
    s.isMatchedWithChecklist === false ||
    s.trainingCategory === "checkedNotPass" ||
    s.statusCategory === "training_rejected";
  if (hasIssue) return 2;

  // Rank 3: ตกเกณฑ์ / ชั่วโมงไม่ครบ / ยังไม่ทำ CV
  const isLacking = !s.isTrainingComplete ||
    (s.trainingApprovedSoft || 0) < 12 ||
    (s.trainingApprovedHard || 0) < 18 ||
    s.trainingCategory === "hoursNotComplete" ||
    s.cvCategory === "noCv" ||
    !s.cvStatus;
  if (isLacking) return 3;

  // Rank 4: อยู่ระหว่างรอดำเนินการ / รอตรวจ
  const isPending = s.placementStatus === "PENDING" ||
    s.placementCategory === "pending" ||
    s.statusCategory === "placement_pending" ||
    s.statusCategory === "interview_passed" ||
    s.cvCategory === "waiting" ||
    s.trainingCategory === "completeNotChecked";
  if (isPending) return 4;

  // Rank 5: เบาสุด / ปลอดภัย
  return 5;
}

function filterStudentsByScope(students: any[], req: Request): any[] {
  const isCentralOrStaff = Boolean(
    req.staff?.isStaff ||
      req.session.user?.role === "STAFF" ||
      (req.session.user?.role === "ADMIN" && !req.staff?.department)
  );
  const dept = req.staff?.department;
  const majorQuery = (req.query.major as string | undefined)?.trim();

  let filtered = students;
  if (!isCentralOrStaff && dept) {
    const deptLower = dept.toLowerCase();
    filtered = filtered.filter((s) => {
      const m = `${s.major || ""} ${s.curriculum || ""}`.toLowerCase();
      return m.includes(deptLower);
    });
  }
  if (majorQuery) {
    const qLower = majorQuery.toLowerCase();
    filtered = filtered.filter((s) => {
      const m = `${s.major || ""} ${s.curriculum || ""}`.toLowerCase();
      return m.includes(qLower);
    });
  }
  return filtered;
}

/**
 * กรองนิสิตตาม "รอบออกฝึก" (เทอมของ InternshipWindow ที่นิสิตผูกไว้ เช่น "2/2568")
 * term = "NONE" -> นิสิตที่ยังไม่ได้ผูกรอบ
 */
async function applyWindowTermFilter<T extends { internshipWindowId: number | null }>(list: T[], term?: unknown): Promise<T[]> {
  const t = String(term || "").trim();
  if (!t) return list;
  if (t === "NONE") return list.filter((s) => !s.internshipWindowId);
  const ids = new Set(
    (await prisma.internshipWindow.findMany({ where: { term: t }, select: { id: true } })).map((w) => w.id)
  );
  return list.filter((s) => s.internshipWindowId !== null && ids.has(s.internshipWindowId));
}

/**
 * ตัวกรองรุ่นจาก query: yearPrefix = รหัสรุ่น 2 หลัก (เช่น 67)
 * academicYear = ปีการศึกษาที่จบกระบวนการ (เช่น 2569) -> นิสิตทุกรุ่นที่ปิดรุ่นในปีนั้น (ใช้ออกรายงาน)
 * คืน null เมื่อไม่ได้กรอง
 */
async function cohortFilterFromQuery(query: Request["query"]): Promise<((studentCode?: string | null) => boolean) | null> {
  const prefix = String(query.yearPrefix || "").trim();
  const academicYear = String(query.academicYear || "").trim();
  if (!prefix && !academicYear) return null;
  let codes: Set<string> | null = null;
  if (academicYear) {
    const archived = await prisma.internshipCohort.findMany({
      where: { status: "ARCHIVED" },
      select: { code: true, status: true, archivedAt: true, archivedAcademicYear: true },
    });
    codes = new Set(archived.filter((c) => cohortAcademicYear(c) === academicYear).map((c) => c.code));
  }
  return (studentCode) =>
    Boolean(studentCode) &&
    (!prefix || studentCode!.startsWith(prefix)) &&
    (!codes || codes.has(cohortCodeOf(studentCode!)));
}

// ==========================================
// 1. Dashboard Summary — สรุปสถิตินิสิตทั้งหมด (กราฟวงกลม 4 อัน + สรุปจำนวน)
// ==========================================
router.get("/dashboard-summary", async (req: Request, res: Response) => {
  try {
    // ดึงนิสิตทั้งหมดพร้อมข้อมูลที่เกี่ยวข้อง
    const allStudentsRaw = await prisma.student.findMany({
      include: {
        user: true,
        cv: true,
        trainingRecords: true,
        companies: { include: { submission: true } },
        placement: true,
        advisor: { include: { user: true } },
      },
    });

    let students = filterStudentsByScope(allStudentsRaw, req);
    const matchCohort = await cohortFilterFromQuery(req.query);
    if (matchCohort) {
      students = students.filter((s) => matchCohort(s.studentCode));
    }
    if (req.query.semester) {
      students = students.filter((s) => (s.semester || "2") === String(req.query.semester));
    }
    students = await applyWindowTermFilter(students, req.query.windowTerm);

    // ตรวจสอบและสร้างข้อมูล Staff ให้อัตโนมัติสำหรับ User ที่มี role ADVISOR / STAFF / ADMIN (ถ้ายังไม่มีในตาราง Staff)
    const staffUsers = await prisma.user.findMany({
      where: { role: { in: ["ADVISOR", "STAFF", "ADMIN"] } },
      include: { staff: true },
    });

    for (const u of staffUsers) {
      if (!u.staff) {
        await prisma.staff.create({
          data: {
            userId: u.id,
            name: u.username || u.email,
            isCourseAdmin: u.role === "ADMIN",
            isAdvisor: u.role === "ADVISOR",
            isStaff: u.role === "STAFF",
            isSupervisor: false,
          },
        });
      }
    }

    // ดึงอาจารย์ที่ปรึกษาทั้งหมด
    const advisors = await prisma.staff.findMany({
      where: {
        OR: [{ isAdvisor: true }, { user: { role: "ADVISOR" } }],
      },
      include: {
        user: true,
        studentsAdvised: {
          include: {
            companies: true,
          },
        },
      },
    });

    const activeStudents = students.filter((s) => !s.isDropped);
    const droppedStudents = students.filter((s) => s.isDropped);
    const totalStudents = activeStudents.length;
    const totalDropped = droppedStudents.length;

    // --- กราฟ 1: สถานะความพร้อม ---
    const readinessStats: Record<string, number> = {
      approvedPlacement: 0,
      cvUploaded: 0,
      noDataOrHoursLack: 0,
      trainingComplete: 0,
    };

    // --- กราฟ 2: สถานะการอบรม ---
    const trainingStats: Record<string, number> = {
      passedComplete: 0,
      completeNotChecked: 0,
      checkedNotPass: 0,
      hoursNotComplete: 0,
    };

    // --- กราฟ 3: สถานะ CV (คอมเมนต์อย่างเดียว) ---
    const cvStats: Record<string, number> = {
      commented: 0,
      waiting: 0,
      noCv: 0,
    };

    // --- กราฟ 4: สถานะอนุมัติฝึกงาน ---
    const placementStats: Record<string, number> = {
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    activeStudents.forEach((s) => {
      const cats = categorizeStudent(s);
      readinessStats[cats.readinessCategory]++;
      trainingStats[cats.trainingCategory]++;
      cvStats[cats.cvCategory]++;
      if (cats.placementCategory) {
        placementStats[cats.placementCategory]++;
      }
    });

    // ตรวจสอบขอบเขตสาขาวิชา (targetMajor) สำหรับอาจารย์ที่ปรึกษา:
    // 1. ถ้าเป็นอาจารย์ประจำวิชา (Course Instructor) จะถูกจำกัดเฉพาะสาขาของตนเองเสมอ
    // 2. ถ้าเป็น Staff / Super Admin แล้วเลือกสาขาจาก Filter (req.query.major) จะกรองตามสาขานั้น
    // 3. ถ้าเลือก ALL หรือไม่ได้ระบุ จะแสดงทุกสาขา
    const isCentralOrStaff = Boolean(
      req.staff?.isStaff ||
        req.session.user?.role === "STAFF" ||
        (req.session.user?.role === "ADMIN" && !req.staff?.department)
    );
    const dept = req.staff?.department;
    const majorQuery = (req.query.major as string | undefined)?.trim();

    let targetMajor: string | null = null;
    if (majorQuery && majorQuery !== "ALL") {
      targetMajor = majorQuery;
    } else if (!isCentralOrStaff && dept) {
      targetMajor = dept;
    }

    const targetLower = targetMajor ? targetMajor.toLowerCase() : "";
    const matchesTarget = (str?: string | null) => {
      if (!str || !targetLower) return false;
      const s = str.toLowerCase();
      return s.includes(targetLower) || targetLower.includes(s);
    };

    const getAdvisorDepartment = (adv: any): string | null => {
      if (adv.department && adv.department.trim()) return adv.department.trim();
      const sWithMajor = adv.studentsAdvised.find((s: any) => s.major || s.curriculum);
      if (sWithMajor) return sWithMajor.major || sWithMajor.curriculum || null;
      return null;
    };

    // --- สรุปอาจารย์ที่ปรึกษา (แยกตามสาขาวิชา และสัมพันธ์กับตัวกรอง) ---
    const advisorSummary = advisors
      .map((adv) => {
        const advisorDept = getAdvisorDepartment(adv);
        const belongsToDept = targetMajor ? matchesTarget(advisorDept) : true;

        let relevantAdvised = adv.studentsAdvised.filter((stu: any) => !stu.isDropped);
        if (targetMajor) {
          relevantAdvised = relevantAdvised.filter(
            (s: any) => matchesTarget(s.major) || matchesTarget(s.curriculum)
          );
        }
        if (matchCohort) {
          relevantAdvised = relevantAdvised.filter((s: any) => matchCohort(s.studentCode));
        }
        if (req.query.semester) {
          relevantAdvised = relevantAdvised.filter(
            (s: any) => (s.semester || "2") === String(req.query.semester)
          );
        }

        const hasStudentsInTarget = targetMajor ? relevantAdvised.length > 0 : true;

        // ถ้ามีการเลือกกรองสาขาเจาะจง แล้วอาจารย์ไม่ได้สังกัดสาขานี้ และไม่มีนิสิตในสาขานี้ ให้ข้าม
        if (targetMajor && !belongsToDept && !hasStudentsInTarget) {
          return null;
        }

        const totalAdvised = relevantAdvised.length;
        let checklistReviewed = 0;
        let checklistNotReviewed = 0;

        relevantAdvised.forEach((stu: any) => {
          stu.companies.forEach((c: any) => {
            if (c.checklistStatus === "APPROVED" || c.checklistStatus === "REJECTED") {
              checklistReviewed++;
            } else {
              checklistNotReviewed++;
            }
          });
        });

        const displayDept = targetMajor && hasStudentsInTarget && !belongsToDept ? targetMajor : advisorDept;

        return {
          id: adv.id,
          name: adv.name,
          department: displayDept,
          totalAdvised,
          checklistReviewed,
          checklistNotReviewed,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    // จำนวนนิสิตที่มี/ไม่มีอาจารย์ที่ปรึกษา (คำนวณจากนิสิตปกติที่ยังไม่ดรอป)
    const studentsWithAdvisor = activeStudents.filter((s) => s.advisorId !== null).length;
    const studentsWithoutAdvisor = totalStudents - studentsWithAdvisor;

    res.json({
      success: true,
      totalStudents,
      totalDropped,
      studentsWithAdvisor,
      studentsWithoutAdvisor,
      readinessStats,
      trainingStats,
      cvStats,
      placementStats,
      advisorSummary,
    });
  } catch (err) {
    console.error("GET /api/admin/dashboard-summary error:", err);
    res.status(500).json({ success: false, message: "ดึงข้อมูลสรุปไม่สำเร็จ" });
  }
});

// ==========================================
// 2. รายชื่อนิสิตทั้งหมด (พร้อม pagination, search, filter)
// ==========================================
router.get("/students", async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "12", search, status: filterStatus, chartType, chartKey } = req.query as Record<string, string | undefined>;
    const pageNum = parseInt(page || "1", 10);
    const limitNum = parseInt(limit || "12", 10);
    const skip = (pageNum - 1) * limitNum;

    // ดึงนิสิตทั้งหมดพร้อมข้อมูลที่เกี่ยวข้อง
    const allStudentsRaw = await prisma.student.findMany({
      include: {
        user: true,
        cv: true,
        trainingRecords: true,
        companies: { include: { submission: true } },
        placement: true,
        advisor: { include: { user: true } },
        supervisor: { include: { user: true } },
      },
      orderBy: { studentCode: "desc" },
    });

    const allStudents = await applyWindowTermFilter(filterStudentsByScope(allStudentsRaw, req), req.query.windowTerm);

    // นิสิตที่เปิดให้แก้ข้อมูลส่วนตัว (ชื่อ-สกุล / GPAX) อยู่ — แสดงป้ายในตาราง
    const profileEditUnlocks = loadSuperAdminState().profileEditUnlocks || {};

    // Map สถานะแต่ละคนด้วยฟังก์ชัน categorizeStudent เดียวกัน
    let mapped = allStudents.map((s) => {
      const cats = categorizeStudent(s);

      let activeStatus = cats.overallStatus;
      if (chartType === "readiness") activeStatus = cats.readinessLabel;
      else if (chartType === "training") activeStatus = cats.trainingLabel;
      else if (chartType === "cv") activeStatus = cats.cvLabel;
      else if (chartType === "placement") activeStatus = cats.placementLabel;

      const isMatchedWithChecklist = s.placement
        ? checkPlacementMatchesChecklist(s.placement, s.companies || [])
        : null;

      const studentRoundState = getStudentRoundState(s.id, `${s.semester || "2"}/${s.academicYear || "2568"}`);
      return {
        id: s.id,
        userId: s.userId,
        studentCode: s.studentCode,
        nameTh: s.nameTh,
        nameEn: s.nameEn,
        nickname: s.nickname,
        major: s.major,
        year: s.year,
        semester: s.semester || "2",
        academicYear: s.academicYear,
        advisorName: s.advisor ? s.advisor.name : null,
        advisorId: s.advisorId,
        supervisorName: s.supervisor ? s.supervisor.name : null,
        supervisorId: s.supervisorId,
        overallStatus: cats.overallStatus,
        statusCategory: cats.statusCategory,
        activeStatus,
        trainingCategory: cats.trainingCategory,
        cvCategory: cats.cvCategory,
        placementCategory: cats.placementCategory,
        readinessCategory: cats.readinessCategory,
        cvStatus: hasCv(s.cv) ? cvState(s.cv) : null, // WAITING | COMMENTED | null (ยังไม่อัปโหลด)
        hasCv: hasCv(s.cv),
        cvUploadedAfterComment: uploadedAfterLastComment(s.cv),
        isDropped: s.isDropped,
        dropReason: s.dropReason,
        droppedAt: s.droppedAt,
        trainingApprovedSoft: cats.softHours,
        trainingApprovedHard: cats.hardHours,
        isTrainingComplete: cats.isTrainingComplete,
        placementStatus: s.placement ? s.placement.status : null,
        isMatchedWithChecklist,
        hasChecklistApproved: (s.companies || []).some((c: any) => c.checklistStatus === "APPROVED"),
        profileEditUnlocked: Boolean(profileEditUnlocks[String(s.id)]),
        roundInfo: {
          currentRound: studentRoundState.currentRound,
          currentTerm: studentRoundState.currentTerm,
          isRound1Completed: studentRoundState.isRound1Completed,
          isSameCompanyAsRound1: studentRoundState.isSameCompanyAsRound1,
          historyRounds: studentRoundState.historyRounds || [],
        },
      };
    });

    const sortBy = (req.query.sortBy as string) || "critical";
    mapped.sort((a: any, b: any) => {
      if (sortBy === "critical") {
        const pA = getStudentRiskPriority(a);
        const pB = getStudentRiskPriority(b);
        if (pA !== pB) {
          return pA - pB;
        }
        try {
          const codeA = BigInt(a.studentCode);
          const codeB = BigInt(b.studentCode);
          return codeA === codeB ? 0 : codeA > codeB ? -1 : 1;
        } catch {
          return (a.studentCode || "").localeCompare(b.studentCode || "");
        }
      } else if (sortBy === "studentCode_desc") {
        try {
          const codeA = BigInt(a.studentCode);
          const codeB = BigInt(b.studentCode);
          return codeA === codeB ? 0 : codeA > codeB ? -1 : 1;
        } catch {
          return (b.studentCode || "").localeCompare(a.studentCode || "");
        }
      } else if (sortBy === "studentCode_asc") {
        try {
          const codeA = BigInt(a.studentCode);
          const codeB = BigInt(b.studentCode);
          return codeA === codeB ? 0 : codeA < codeB ? -1 : 1;
        } catch {
          return (a.studentCode || "").localeCompare(b.studentCode || "");
        }
      } else if (sortBy === "name_asc") {
        return (a.nameTh || "").localeCompare(b.nameTh || "", "th");
      }
      return 0;
    });

    // กรองตาม viewDropped (นิสิตปกติ vs นิสิตที่ดรอป)
    const isViewDropped = req.query.viewDropped === "true";
    if (isViewDropped) {
      mapped = mapped.filter((s) => s.isDropped);
    } else {
      mapped = mapped.filter((s) => !s.isDropped);
    }

    // Filter ตาม legacy status
    if (filterStatus) {
      mapped = mapped.filter((s) => s.statusCategory === filterStatus);
    }

    // Filter ตาม search
    if (search) {
      const q = search.toLowerCase();
      // ชื่อบริษัทของนิสิต (ที่ฝึกงาน + บริษัทใน Checklist) สำหรับค้นหาด้วยชื่อบริษัท
      const companyTextById = new Map<number, string>(
        allStudents.map((s: any) => [
          s.id,
          [s.placement?.companyNameTh, ...(s.companies || []).map((c: any) => c.name)]
            .filter(Boolean)
            .join(" ")
            .toLowerCase(),
        ])
      );
      mapped = mapped.filter(
        (s) =>
          s.studentCode.toLowerCase().includes(q) ||
          s.nameTh.toLowerCase().includes(q) ||
          (s.nameEn && s.nameEn.toLowerCase().includes(q)) ||
          (companyTextById.get(s.id) || "").includes(q)
      );
    }

    // Filter ตามรุ่น (รหัสนิสิต 2 หลักแรก เช่น 67) หรือปีการศึกษาที่ปิดรุ่น (เช่น 2569)
    const matchCohort = await cohortFilterFromQuery(req.query);
    if (matchCohort) {
      mapped = mapped.filter((s) => matchCohort(s.studentCode));
    }
    const semester = req.query.semester as string | undefined;
    if (semester) {
      mapped = mapped.filter((s) => (s.semester || "2") === semester);
    }

    // Filter ตาม dropdown "สถานะ" (ผ่าน/ไม่ผ่าน แต่ละหมวด)
    const statusFilter = req.query.statusFilter as string | undefined;
    if (statusFilter) {
      switch (statusFilter) {
        case "training_passed":
          mapped = mapped.filter((s) => s.isTrainingComplete);
          break;
        case "training_not_checked":
          mapped = mapped.filter((s) => s.trainingCategory === "completeNotChecked");
          break;
        case "training_failed":
          mapped = mapped.filter((s) => s.trainingCategory === "checkedNotPass" || !s.isTrainingComplete);
          break;
        case "training_incomplete":
          mapped = mapped.filter((s) => s.trainingCategory === "hoursNotComplete");
          break;
        // CV: ไม่มีการอนุมัติ (cv_approved / cv_pending คงไว้รองรับลิงก์เดิม)
        case "cv_uploaded":
        case "cv_approved":
        case "cv_passed":
          mapped = mapped.filter((s) => s.hasCv);
          break;
        case "cv_waiting":
        case "cv_pending":
          mapped = mapped.filter((s) => s.cvCategory === "waiting");
          break;
        case "cv_commented":
          mapped = mapped.filter((s) => s.cvCategory === "commented");
          break;
        case "cv_none":
        case "cv_failed":
          mapped = mapped.filter((s) => !s.hasCv);
          break;
        case "checklist_approved":
        case "checklist_passed":
          mapped = mapped.filter((s) => s.hasChecklistApproved);
          break;
        case "checklist_pending":
        case "checklist_failed":
          mapped = mapped.filter((s) => !s.hasChecklistApproved);
          break;
        case "interview_passed":
          mapped = mapped.filter((s) => s.placementStatus === "APPROVED" || s.hasChecklistApproved);
          break;
        case "placement_approved":
          mapped = mapped.filter((s) => s.placementStatus === "APPROVED");
          break;
        case "placement_pending":
          mapped = mapped.filter((s) => s.placementStatus !== "APPROVED");
          break;
        case "placement_rejected":
          mapped = mapped.filter((s) => s.placementStatus === "REJECTED");
          break;
      }
    }

    // Filter ตาม dropdown "อาจารย์ที่ปรึกษา"
    const advisorFilterName = req.query.advisorFilter as string | undefined;
    if (advisorFilterName) {
      mapped = mapped.filter((s) => s.advisorName === advisorFilterName);
    }

    // Filter ตาม dropdown "Soft/Hard Skill"
    const skillFilter = req.query.skillFilter as string | undefined;
    if (skillFilter) {
      switch (skillFilter) {
        case "lack_soft":
          mapped = mapped.filter((s) => (s.trainingApprovedSoft || 0) < 12);
          break;
        case "lack_hard":
          mapped = mapped.filter((s) => (s.trainingApprovedHard || 0) < 18);
          break;
        case "lack_both":
          mapped = mapped.filter((s) => (s.trainingApprovedSoft || 0) < 12 && (s.trainingApprovedHard || 0) < 18);
          break;
      }
    }

    // สถิติสำหรับกราฟวงกลมทั้ง 4 อัน
    const chartStats: {
      totalStudents: number;
      readinessStats: Record<string, number>;
      trainingStats: Record<string, number>;
      cvStats: Record<string, number>;
      placementStats: Record<string, number>;
    } = {
      totalStudents: mapped.length,
      readinessStats: { approvedPlacement: 0, cvUploaded: 0, noDataOrHoursLack: 0, trainingComplete: 0 },
      trainingStats: { passedComplete: 0, completeNotChecked: 0, checkedNotPass: 0, hoursNotComplete: 0 },
      cvStats: { commented: 0, waiting: 0, noCv: 0 },
      placementStats: { pending: 0, approved: 0, rejected: 0 },
    };
    mapped.forEach((s) => {
      chartStats.readinessStats[s.readinessCategory] = (chartStats.readinessStats[s.readinessCategory] || 0) + 1;
      chartStats.trainingStats[s.trainingCategory] = (chartStats.trainingStats[s.trainingCategory] || 0) + 1;
      chartStats.cvStats[s.cvCategory] = (chartStats.cvStats[s.cvCategory] || 0) + 1;
      if (s.placementCategory) {
        chartStats.placementStats[s.placementCategory] = (chartStats.placementStats[s.placementCategory] || 0) + 1;
      }
    });

    // กรองตาม chartType และ chartKey
    if (chartType && chartKey) {
      if (chartType === "readiness") {
        mapped = mapped.filter((s) => s.readinessCategory === chartKey);
      } else if (chartType === "training") {
        mapped = mapped.filter((s) => s.trainingCategory === chartKey);
      } else if (chartType === "cv") {
        mapped = mapped.filter((s) => s.cvCategory === chartKey);
      } else if (chartType === "placement") {
        mapped = mapped.filter((s) => s.placementCategory === chartKey);
      }
    }

    const total = mapped.length;
    const paginated = mapped.slice(skip, skip + limitNum);

    res.json({
      success: true,
      students: paginated,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      chartStats,
    });
  } catch (err) {
    console.error("GET /api/admin/students error:", err);
    res.status(500).json({ success: false, message: "ดึงรายชื่อนิสิตไม่สำเร็จ" });
  }
});

// ==========================================
// 3. ดูข้อมูลนิสิตรายบุคคล
// ==========================================
router.get("/students/:studentId", async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId as string, 10);
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        cv: true,
        trainingRecords: { orderBy: { createdAt: "asc" } },
        companies: {
          include: {
            answers: { include: { checklistItem: { include: { section: true } } } },
            submission: true,
          },
        },
        placement: true,
        advisor: { include: { user: true } },
        supervisor: { include: { user: true } },
        coopApplications: true,
        cvComments: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลนิสิต" });
    }

    // คำนวณสรุปชั่วโมง
    const approvedTrainings = student.trainingRecords.filter(t => t.status === "APPROVED");
    const totalSoft = student.trainingRecords.filter(t => t.skillType === "SOFT").reduce((sum, t) => sum + t.hours, 0);
    const totalHard = student.trainingRecords.filter(t => t.skillType === "HARD").reduce((sum, t) => sum + t.hours, 0);
    const approvedSoft = approvedTrainings.filter(t => t.skillType === "SOFT").reduce((sum, t) => sum + t.hours, 0);
    const approvedHard = approvedTrainings.filter(t => t.skillType === "HARD").reduce((sum, t) => sum + t.hours, 0);

    const isMatchedWithChecklist = student.placement
      ? checkPlacementMatchesChecklist(student.placement, student.companies || [])
      : false;

    const state = loadSuperAdminState();

    res.json({
      success: true,
      student: {
        id: student.id,
        studentCode: student.studentCode,
        nameTh: student.nameTh,
        nameEn: student.nameEn,
        nickname: student.nickname,
        faculty: student.faculty,
        curriculum: student.curriculum,
        academicYear: student.academicYear,
        studentStatus: student.studentStatus,
        internshipType: student.internshipType,
        year: student.year,
        major: student.major,
        gpa: student.gpa,
        phone: student.phone,
        lineId: student.lineId,
        facebook: student.facebook,
        profileImageUrl: student.profileImageUrl,
        stage: student.stage,
        email: student.user.email,
        advisorName: student.advisor ? student.advisor.name : null,
        advisorId: student.advisorId,
        supervisorName: student.supervisor ? student.supervisor.name : null,
        supervisorId: student.supervisorId,
        isDropped: student.isDropped,
        dropReason: student.dropReason,
        droppedAt: student.droppedAt,
      },
      cv: student.cv
        ? {
            ...student.cv,
            state: cvState(student.cv),
            stateLabel: CV_STATE_LABEL[cvState(student.cv)],
            uploadedAfterComment: uploadedAfterLastComment(student.cv),
          }
        : null,
      cvComments: student.cvComments.map((c) => ({
        id: c.id,
        authorName: c.authorName,
        authorRoleLabel: CV_COMMENT_ROLE_LABEL[c.authorRole as CvCommentRole] || c.authorRole,
        message: c.message,
        createdAt: c.createdAt,
        cvFileName: c.cvFileName,
        forOlderFile: isCommentForOlderFile(c.cvUploadedAt, student.cv?.uploadedAt),
        mine: c.authorUserId === req.session.user!.id,
      })),
      // คอมเมนต์ได้: อาจารย์ที่ปรึกษาของนิสิตคนนี้ / อาจารย์ประจำวิชา (เจ้าหน้าที่ดูอย่างเดียว)
      canCommentCv: Boolean(cvCommentRoleFor(req, student)),
      trainings: student.trainingRecords,
      trainingSummary: { totalSoft, totalHard, approvedSoft, approvedHard },
      companies: student.companies,
      placement: student.placement
        ? {
            ...student.placement,
            isMatchedWithChecklist,
          }
        : null,
      acceptanceWorkflow: state.docWorkflowMap[String(student.id)] || null,
      roundInfo: getStudentRoundState(student.id, `${student.semester || "2"}/${student.academicYear || "2568"}`),
      // สหกิจศึกษา (อ่านอย่างเดียว — เจ้าหน้าที่จัดการในแท็บประกาศสหกิจ)
      coop: coopSummaryForProfile(student.coopApplications),
    });
  } catch (err) {
    console.error("GET /api/admin/students/:id error:", err);
    res.status(500).json({ success: false, message: "ดึงข้อมูลนิสิตไม่สำเร็จ" });
  }
});

// ==========================================
// 4. CV: อาจารย์ไม่อนุมัติแล้ว — คอมเมนต์อย่างเดียว (ยืนยัน 24 พ.ย. 2569 · src/utils/cvReview.ts)
//    คอมเมนต์ได้: อาจารย์ที่ปรึกษา (เฉพาะนิสิตของตน) + อาจารย์ประจำวิชา · เจ้าหน้าที่ดูอย่างเดียว
// ==========================================
router.put("/students/:studentId/cv-status", (_req: Request, res: Response) => {
  res.status(410).json({ success: false, message: "เลิกใช้การอนุมัติ CV แล้ว — ใช้คอมเมนต์แทน" });
});

/** บทบาทที่ใช้คอมเมนต์ CV ของนิสิตคนนี้ (null = ไม่มีสิทธิ์) */
function cvCommentRoleFor(req: Request, student: { advisorId: number | null }) {
  return cvCommentRole({
    isAdvisorOfStudent: Boolean(req.staff && student.advisorId === req.staff.id),
    isCourseAdmin: Boolean(req.staff?.isCourseAdmin || req.session.user?.role === "ADMIN"),
  });
}

// เพิ่มคอมเมนต์ CV: body = { message }
router.post("/students/:studentId/cv-comments", async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(String(req.params.studentId), 10);
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, advisorId: true, cv: { select: { fileUrl: true, fileName: true, uploadedAt: true } } },
    });
    if (!student) return res.status(404).json({ success: false, message: "ไม่พบข้อมูลนิสิต" });
    const role = cvCommentRoleFor(req, student);
    if (!role) {
      return res.status(403).json({ success: false, message: "คอมเมนต์ CV ได้เฉพาะอาจารย์ที่ปรึกษาของนิสิตคนนี้ หรืออาจารย์ประจำวิชา" });
    }
    if (!hasCv(student.cv)) return res.status(400).json({ success: false, message: "นิสิตยังไม่ได้อัปโหลด CV" });
    const err = cvCommentError(req.body?.message);
    if (err) return res.status(400).json({ success: false, message: err });

    const now = new Date();
    const [comment] = await prisma.$transaction([
      prisma.cvComment.create({
        data: {
          studentId,
          authorUserId: req.session.user!.id,
          authorName: req.staff?.name || req.session.user?.username || "อาจารย์",
          authorRole: role,
          message: String(req.body.message).trim(),
          cvFileName: student.cv!.fileName,
          cvUploadedAt: student.cv!.uploadedAt,
          createdAt: now,
        },
      }),
      prisma.studentCV.update({ where: { studentId }, data: { lastCommentAt: now } }),
    ]);
    const authorRoleLabel = CV_COMMENT_ROLE_LABEL[role as CvCommentRole] || "อาจารย์";
    await notifyStudents([studentId], {
      type: "CV_COMMENT",
      category: "cv",
      title: `${comment.authorName} (${authorRoleLabel}) คอมเมนต์ CV ของคุณ`,
      message: `"${comment.message}"`,
      link: "/cv",
      entityType: "CvComment",
      entityId: comment.id,
    });
    res.json({ success: true, message: "บันทึกคอมเมนต์แล้ว — นิสิตจะเห็นในหน้า Resume (CV)", comment });
  } catch (err) {
    console.error("POST /api/admin/students/:id/cv-comments error:", err);
    res.status(500).json({ success: false, message: "บันทึกคอมเมนต์ไม่สำเร็จ" });
  }
});

// ลบคอมเมนต์ของตัวเอง (เผื่อพิมพ์ผิด)
router.delete("/students/:studentId/cv-comments/:commentId", async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(String(req.params.studentId), 10);
    const commentId = parseInt(String(req.params.commentId), 10);
    const comment = await prisma.cvComment.findFirst({ where: { id: commentId, studentId } });
    if (!comment) return res.status(404).json({ success: false, message: "ไม่พบคอมเมนต์" });
    if (comment.authorUserId !== req.session.user!.id) {
      return res.status(403).json({ success: false, message: "ลบได้เฉพาะคอมเมนต์ของตัวเอง" });
    }
    await prisma.cvComment.delete({ where: { id: commentId } });
    // เวลาคอมเมนต์ล่าสุด = คอมเมนต์ที่เหลือล่าสุด
    const latest = await prisma.cvComment.findFirst({ where: { studentId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    await prisma.studentCV.updateMany({ where: { studentId }, data: { lastCommentAt: latest?.createdAt ?? null } });
    res.json({ success: true, message: "ลบคอมเมนต์แล้ว" });
  } catch (err) {
    console.error("DELETE /api/admin/students/:id/cv-comments/:id error:", err);
    res.status(500).json({ success: false, message: "ลบคอมเมนต์ไม่สำเร็จ" });
  }
});

// ==========================================
// 5. ตั้งสถานะ Training Record ของนิสิต (อาจารย์ประจำวิชา / Course Admin)
// ==========================================
router.put("/students/:studentId/training/:trainingId/status", async (req: Request, res: Response) => {
  const isPureStaff = Boolean(
    (req.staff?.isStaff || req.session.user!.role === "STAFF") &&
      !req.staff?.isCourseAdmin &&
      req.session.user!.role !== "ADMIN"
  );
  if (isPureStaff) {
    return res.status(403).json({ success: false, message: "เจ้าหน้าที่ไม่มีสิทธิ์ตรวจอนุมัติชั่วโมงอบรม" });
  }
  try {
    const trainingId = parseInt(req.params.trainingId as string, 10);
    const { status, note } = req.body;

    const updated = await prisma.trainingRecord.update({
      where: { id: trainingId },
      data: {
        status,
        note: note || null,
        reviewedById: req.session.user!.id,
        reviewedAt: new Date(),
      },
    });

    if (isDecision(status)) await notifyStudents([updated.studentId], trainingResultPayload(status, note, updated));

    res.json({ success: true, training: updated });
  } catch (err) {
    console.error("PUT /api/admin/students/:id/training/:id/status error:", err);
    res.status(500).json({ success: false, message: "อัพเดตสถานะการอบรมไม่สำเร็จ" });
  }
});

// ==========================================
// 5.1 เพิ่มชั่วโมงเตรียมความพร้อม / กิจกรรมคณะ (Hackathon, Project Day, Co-op UP)
// ==========================================
router.post("/students/:studentId/trainings", async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId as string, 10);
    const { title, skillType, hours, academicYear } = req.body;

    if (!hours || isNaN(hours) || parseInt(hours, 10) <= 0) {
      return res.status(400).json({ success: false, message: "กรุณาระบุจำนวนชั่วโมงให้ถูกต้อง" });
    }

    const normalizedSkillType = String(skillType || "HARD").toLowerCase().includes("soft") ? "SOFT" : "HARD";
    const isStaffIssuer = Boolean(req.staff?.isStaff && !req.staff?.isCourseAdmin);
    const source = isStaffIssuer ? "STAFF_IMPORT" : "ADMIN_IMPORT";

    const training = await prisma.trainingRecord.create({
      data: {
        studentId,
        title: title ? String(title).trim() : `กิจกรรมเตรียมความพร้อม (${normalizedSkillType})`,
        skillType: normalizedSkillType,
        hours: parseInt(hours, 10),
        academicYear: academicYear ? String(academicYear).trim() : null,
        source,
        status: "APPROVED",
        reviewedById: req.session.user!.id,
        reviewedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: "เพิ่มชั่วโมงเตรียมความพร้อมสำเร็จ (อนุมัติอัตโนมัติ)",
      training,
    });
  } catch (err) {
    console.error("POST /api/admin/students/:id/trainings error:", err);
    res.status(500).json({ success: false, message: "เพิ่มชั่วโมงอบรมไม่สำเร็จ" });
  }
});

// ==========================================
// 6. ตั้งสถานะอนุมัติที่ฝึกงาน (อาจารย์ที่ปรึกษาเป็นหลัก)
// ==========================================
router.put("/students/:studentId/placement-status", async (req: Request, res: Response) => {
  const canReviewPlacement = Boolean(
    req.staff?.isAdvisor ||
      req.session.user!.role === "ADVISOR" ||
      req.session.user!.role === "ADMIN"
  );
  if (!canReviewPlacement) {
    return res.status(403).json({
      success: false,
      message: "อาจารย์ที่ปรึกษาเท่านั้นที่เป็นผู้ตรวจและให้สถานะข้อมูลบริษัทที่เข้าฝึกงาน",
    });
  }
  try {
    const studentId = parseInt(req.params.studentId as string, 10);
    const { status, note } = req.body;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { companies: true },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลนิสิต" });
    }

    if (
      req.session.user!.role !== "ADMIN" &&
      req.staff &&
      student.advisorId !== req.staff.id
    ) {
      return res.status(403).json({
        success: false,
        message: "ไม่มีสิทธิ์อนุมัติที่ฝึกงานของนิสิตที่ไม่ได้อยู่ในความดูแล",
      });
    }

    const updated = await prisma.internshipPlacement.upsert({
      where: { studentId },
      create: {
        studentId,
        status,
        note: note || null,
        reviewedById: req.session.user!.id,
        reviewedAt: new Date(),
      },
      update: {
        status,
        note: note || null,
        reviewedById: req.session.user!.id,
        reviewedAt: new Date(),
      },
    });

    const isMatchedWithChecklist = checkPlacementMatchesChecklist(
      updated,
      student.companies || []
    );

    if (isDecision(status)) await notifyStudents([studentId], placementResultPayload(status, note, updated.id));

    res.json({
      success: true,
      placement: {
        ...updated,
        isMatchedWithChecklist,
      },
    });
  } catch (err) {
    console.error("PUT /api/admin/students/:id/placement-status error:", err);
    res.status(500).json({ success: false, message: "อัพเดตสถานะอนุมัติฝึกงานไม่สำเร็จ" });
  }
});

// ==========================================
// 7. Batch ตั้งสถานะนิสิตหลายคนพร้อมกัน
// ==========================================
// เปิด/ปิดให้นิสิตแก้ข้อมูลส่วนตัวที่ล็อกตาม REG (ชื่อ-สกุล / GPAX) — นิสิตบันทึกยืนยัน 1 ครั้งแล้วล็อกกลับอัตโนมัติ
router.post("/students/profile-edit-unlock", async (req: Request, res: Response) => {
  try {
    const { studentIds, unlock } = req.body || {};
    const ids: number[] = Array.isArray(studentIds)
      ? studentIds.map((v: unknown) => Number(v)).filter((n: number) => Number.isInteger(n) && n > 0)
      : [];
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: "กรุณาเลือกนิสิตอย่างน้อย 1 คน" });
    }

    // ทำได้เฉพาะนิสิตในขอบเขตของผู้ใช้ (อาจารย์ประจำวิชาสาขา → เฉพาะสาขาตัวเอง)
    const students = await prisma.student.findMany({
      where: { id: { in: ids } },
      select: { id: true, major: true, curriculum: true },
    });
    const allowed = filterStudentsByScope(students, req);
    if (allowed.length === 0) {
      return res.status(403).json({ success: false, message: "ไม่มีสิทธิ์จัดการนิสิตที่เลือก" });
    }

    const state = loadSuperAdminState();
    if (!state.profileEditUnlocks) state.profileEditUnlocks = {};
    const by = req.session.user?.email || req.session.user?.username || "admin";
    const now = new Date().toISOString();
    for (const s of allowed) {
      if (unlock === false) delete state.profileEditUnlocks[String(s.id)];
      else state.profileEditUnlocks[String(s.id)] = { unlockedAt: now, unlockedBy: String(by) };
    }
    saveSuperAdminStateOrThrow(state);

    if (unlock !== false) {
      await notifyStudents(allowed.map((s) => s.id), {
        type: "PROFILE_EDIT_UNLOCKED",
        category: "account",
        priority: "HIGH",
        title: "เปิดให้แก้ไขชื่อ-สกุล / GPAX แล้ว",
        message: "แก้ไขข้อมูลส่วนตัวที่ล็อกตาม REG ได้ 1 ครั้ง — บันทึกแล้วระบบจะล็อกกลับอัตโนมัติ",
        link: "/personal-info",
        entityType: "Student",
      });
    }

    const skipped = ids.length - allowed.length;
    res.json({
      success: true,
      updatedCount: allowed.length,
      message: `${unlock === false ? "ล็อกการแก้ไขข้อมูลส่วนตัว" : "เปิดให้แก้ไขข้อมูลส่วนตัว (ชื่อ-สกุล ไทย/อังกฤษ / GPAX)"} ${allowed.length} คนแล้ว`
        + (skipped > 0 ? ` — ข้าม ${skipped} คนที่อยู่นอกสาขาที่ดูแล` : ""),
    });
  } catch (err) {
    console.error("POST /api/admin/students/profile-edit-unlock error:", err);
    res.status(500).json({ success: false, message: "บันทึกไม่สำเร็จ" });
  }
});

router.put("/students/batch-status", async (req: Request, res: Response) => {
  const isPureStaff = Boolean(
    (req.staff?.isStaff || req.session.user!.role === "STAFF") &&
      !req.staff?.isCourseAdmin &&
      req.session.user!.role !== "ADMIN"
  );
  if (isPureStaff) {
    return res.status(403).json({ success: false, message: "เจ้าหน้าที่ไม่มีสิทธิ์ตั้งสถานะนิสิต" });
  }
  try {
    const { studentIds, statusType, statusValue, note } = req.body;

    if (!studentIds || !studentIds.length) {
      return res.status(400).json({ success: false, message: "กรุณาเลือกนิสิตอย่างน้อย 1 คน" });
    }

    const reviewData = {
      status: statusValue,
      note: note || null,
      reviewedById: req.session.user!.id,
      reviewedAt: new Date(),
    };

    let updatedCount = 0;

    if (statusType === "cv") {
      // CV ไม่มีการอนุมัติแล้ว (คอมเมนต์รายคนในหน้า Profile นิสิต)
      return res.status(400).json({ success: false, message: "เลิกใช้การตั้งสถานะ CV แล้ว — อาจารย์คอมเมนต์ CV ได้ในหน้า Profile นิสิต" });
    } else if (statusType === "training") {
      const pendingWhere = { studentId: { in: studentIds.map(Number) }, status: "PENDING" as const };
      const pending = await prisma.trainingRecord.groupBy({ by: ["studentId"], where: pendingWhere, _count: { _all: true } });
      const result = await prisma.trainingRecord.updateMany({
        where: pendingWhere,
        data: reviewData,
      });
      updatedCount = result.count;
      if (isDecision(statusValue)) {
        const countByStudent = new Map(pending.map((p) => [p.studentId, p._count._all]));
        await notifyStudents([...countByStudent.keys()], (st) => trainingResultPayload(statusValue, note, countByStudent.get(st.id) ?? 0));
      }
    } else if (statusType === "placement") {
      const canReviewPlacement = Boolean(
        req.staff?.isAdvisor ||
          req.session.user!.role === "ADVISOR" ||
          req.session.user!.role === "ADMIN"
      );
      if (!canReviewPlacement) {
        return res.status(403).json({ success: false, message: "อาจารย์ที่ปรึกษาเท่านั้นที่เป็นผู้ตรวจและให้สถานะข้อมูลบริษัทที่เข้าฝึกงาน" });
      }
      const placementWhere = { studentId: { in: studentIds.map(Number) } };
      const withPlacement = await prisma.internshipPlacement.findMany({ where: placementWhere, select: { studentId: true } });
      const result = await prisma.internshipPlacement.updateMany({
        where: placementWhere,
        data: reviewData,
      });
      updatedCount = result.count;
      // แจ้งเฉพาะนิสิตที่มีสถานที่ฝึกงานจริง (คนที่ยังไม่ยื่นไม่ถูกอัปเดต)
      if (isDecision(statusValue)) await notifyStudents(withPlacement.map((p) => p.studentId), placementResultPayload(statusValue, note));
    } else {
      return res.status(400).json({ success: false, message: "statusType ไม่ถูกต้อง" });
    }

    res.json({ success: true, updatedCount });
  } catch (err) {
    console.error("PUT /api/admin/students/batch-status error:", err);
    res.status(500).json({ success: false, message: "ตั้งสถานะไม่สำเร็จ" });
  }
});

// ==========================================
// 8. Batch ตั้งอาจารย์ที่ปรึกษาให้นิสิตหลายคน
// ==========================================
router.put("/students/batch-advisor", async (req: Request, res: Response) => {
  const isPureStaff = Boolean(
    (req.staff?.isStaff || req.session.user!.role === "STAFF") &&
      !req.staff?.isCourseAdmin &&
      req.session.user!.role !== "ADMIN"
  );
  if (isPureStaff) {
    return res.status(403).json({ success: false, message: "เจ้าหน้าที่ไม่มีสิทธิ์ตั้งอาจารย์ที่ปรึกษา" });
  }
  try {
    const { studentIds, advisorId } = req.body;

    if (!studentIds || !studentIds.length || !advisorId) {
      return res.status(400).json({ success: false, message: "กรุณาเลือกนิสิตและอาจารย์ที่ปรึกษา" });
    }

    // ตรวจว่า advisor มีอยู่จริง
    const advisor = await prisma.staff.findUnique({ where: { id: parseInt(advisorId, 10) } });
    if (!advisor) {
      return res.status(404).json({ success: false, message: "ไม่พบอาจารย์ที่ปรึกษา" });
    }

    const result = await prisma.student.updateMany({
      where: { id: { in: studentIds.map(Number) } },
      data: { advisorId: parseInt(advisorId, 10) },
    });

    if (result.count > 0) {
      await notifyAdvisorStaff(advisor.id, staffAssignedPayload("ADVISOR", advisor.id, result.count));
      await notifyStudents(studentIds.map(Number), {
        type: "ADVISOR_ASSIGNED",
        category: "assignment",
        title: `อาจารย์ที่ปรึกษาของคุณ: ${advisor.name}`,
        message: "อาจารย์ที่ปรึกษาจะเป็นผู้ตรวจ Checklist และแบบตอบรับจากบริษัท",
        link: "/profile",
        entityType: "Staff",
        entityId: advisor.id,
      });
    }

    res.json({ success: true, updatedCount: result.count });
  } catch (err) {
    console.error("PUT /api/admin/students/batch-advisor error:", err);
    res.status(500).json({ success: false, message: "ตั้งอาจารย์ที่ปรึกษาไม่สำเร็จ" });
  }
});

// ==========================================
// 8.05 Batch ตั้งอาจารย์นิเทศก์ให้นิสิตหลายคน (Supervisor Assignment)
// ==========================================
router.put("/students/batch-supervisor", async (req: Request, res: Response) => {
  const isPureStaff = Boolean(
    (req.staff?.isStaff || req.session.user!.role === "STAFF") &&
      !req.staff?.isCourseAdmin &&
      req.session.user!.role !== "ADMIN"
  );
  if (isPureStaff) {
    return res.status(403).json({ success: false, message: "เจ้าหน้าที่ไม่มีสิทธิ์ตั้งอาจารย์นิเทศก์" });
  }
  try {
    const { studentIds, supervisorId } = req.body;

    if (!studentIds || !studentIds.length || !supervisorId) {
      return res.status(400).json({ success: false, message: "กรุณาเลือกนิสิตและอาจารย์นิเทศก์" });
    }

    const supervisor = await prisma.staff.findUnique({ where: { id: parseInt(supervisorId, 10) } });
    if (!supervisor) {
      return res.status(404).json({ success: false, message: "ไม่พบอาจารย์นิเทศก์" });
    }

    const result = await prisma.student.updateMany({
      where: { id: { in: studentIds.map(Number) } },
      data: { supervisorId: parseInt(supervisorId, 10) },
    });

    if (result.count > 0) await notifyAdvisorStaff(supervisor.id, staffAssignedPayload("SUPERVISOR", supervisor.id, result.count));

    res.json({ success: true, updatedCount: result.count });
  } catch (err) {
    console.error("PUT /api/admin/students/batch-supervisor error:", err);
    res.status(500).json({ success: false, message: "ตั้งอาจารย์นิเทศก์ไม่สำเร็จ" });
  }
});

// ==========================================
// 8.1 ดรอปนิสิต (Drop Student)
// ==========================================
router.put("/students/drop", async (req: Request, res: Response) => {
  const isPureStaff = Boolean(
    (req.staff?.isStaff || req.session.user!.role === "STAFF") &&
      !req.staff?.isCourseAdmin &&
      req.session.user!.role !== "ADMIN"
  );
  if (isPureStaff) {
    return res.status(403).json({ success: false, message: "เจ้าหน้าที่ไม่มีสิทธิ์ดรอปนิสิต" });
  }
  try {
    const { studentIds, reason } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, message: "กรุณาเลือกนิสิตอย่างน้อย 1 คน" });
    }

    const dropReason = (reason && reason.trim()) ? reason.trim() : "ถอนรายวิชาฝึกงาน";

    // แจ้งเฉพาะคนที่เปลี่ยนจากปกติ → ดรอปจริง (คนที่ดรอปอยู่แล้วไม่ต้องแจ้งซ้ำ)
    const toDrop = await prisma.student.findMany({
      where: { id: { in: studentIds.map(Number) }, isDropped: false },
      select: { id: true },
    });

    const result = await prisma.student.updateMany({
      where: { id: { in: studentIds.map(Number) } },
      data: {
        isDropped: true,
        dropReason,
        droppedAt: new Date(),
      },
    });

    const droppedIds = toDrop.map((s) => s.id);
    await notifyStudents(droppedIds, {
      type: "STUDENT_DROPPED",
      category: "account",
      priority: "HIGH",
      title: "บัญชีของคุณถูกเปลี่ยนเป็นสถานะดรอปรายวิชาฝึกงาน",
      message: `เหตุผล: ${dropReason} — หากไม่ถูกต้องกรุณาติดต่ออาจารย์ประจำวิชา`,
      link: "/student-dashboard",
      entityType: "Student",
    });
    await notifyAdvisorsOfStudents(droppedIds, (st) =>
      studentEventPayload(st, { type: "ADVISEE_DROPPED", category: "assignment", entityType: "Student", title: `${st.nameTh} ดรอปรายวิชาฝึกงาน`, message: `เหตุผล: ${dropReason}` })
    );

    res.json({
      success: true,
      message: `ดรอปนิสิตสำเร็จ (${result.count} คน)`,
      updatedCount: result.count,
    });
  } catch (err) {
    console.error("PUT /api/admin/students/drop error:", err);
    res.status(500).json({ success: false, message: "ดรอปนิสิตไม่สำเร็จ" });
  }
});

// ==========================================
// 8.2 กู้คืนสถานะนิสิตที่ถูกดรอป (Restore Student)
// ==========================================
router.put("/students/restore", async (req: Request, res: Response) => {
  const isPureStaff = Boolean(
    (req.staff?.isStaff || req.session.user!.role === "STAFF") &&
      !req.staff?.isCourseAdmin &&
      req.session.user!.role !== "ADMIN"
  );
  if (isPureStaff) {
    return res.status(403).json({ success: false, message: "เจ้าหน้าที่ไม่มีสิทธิ์กู้คืนสถานะนิสิต" });
  }
  try {
    const { studentIds } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, message: "กรุณาเลือกนิสิตอย่างน้อย 1 คน" });
    }

    // แจ้งเฉพาะคนที่ถูกดรอปอยู่จริงก่อนกู้คืน
    const toRestore = await prisma.student.findMany({
      where: { id: { in: studentIds.map(Number) }, isDropped: true },
      select: { id: true },
    });

    const result = await prisma.student.updateMany({
      where: { id: { in: studentIds.map(Number) } },
      data: {
        isDropped: false,
        dropReason: null,
        droppedAt: null,
      },
    });

    await notifyStudents(toRestore.map((s) => s.id), {
      type: "STUDENT_RESTORED",
      category: "account",
      title: "กู้คืนสถานะนิสิตฝึกงานของคุณแล้ว",
      message: "ใช้งานระบบได้ตามปกติ",
      link: "/student-dashboard",
      entityType: "Student",
    });

    res.json({
      success: true,
      message: `กู้คืนสถานะนิสิตสำเร็จ (${result.count} คน)`,
      updatedCount: result.count,
    });
  } catch (err) {
    console.error("PUT /api/admin/students/restore error:", err);
    res.status(500).json({ success: false, message: "กู้คืนสถานะนิสิตไม่สำเร็จ" });
  }
});

// ==========================================
// 9. ดึงรายชื่ออาจารย์ที่ปรึกษาทั้งหมด (สำหรับ Filter & Modal ตามสาขาวิชา)
// ==========================================
router.get("/advisors", async (req: Request, res: Response) => {
  try {
    const isCentralOrStaff = Boolean(
      req.staff?.isStaff ||
        req.session.user?.role === "STAFF" ||
        (req.session.user?.role === "ADMIN" && !req.staff?.department)
    );
    const dept = req.staff?.department;
    const majorQuery = (req.query.major as string | undefined)?.trim();

    // หากระบุ query major มา ให้ใช้ค่านั้น (ถ้าไม่ใช่ ALL)
    // หากไม่ระบุ หรือเป็น ALL แต่ user ไม่ใช่ส่วนกลางและมี dept (เช่น อาจารย์ประจำวิชา) ให้ใช้ dept ของ user
    let targetMajor: string | null = null;
    if (majorQuery && majorQuery !== "ALL") {
      targetMajor = majorQuery;
    } else if (!isCentralOrStaff && dept) {
      targetMajor = dept;
    }

    const advisorUsers = await prisma.user.findMany({
      where: { role: { in: ["ADVISOR", "STAFF", "ADMIN"] } },
      include: { staff: true },
    });

    for (const u of advisorUsers) {
      if (!u.staff) {
        await prisma.staff.create({
          data: {
            userId: u.id,
            name: u.username || u.email,
            isCourseAdmin: u.role === "ADMIN",
            isAdvisor: u.role === "ADVISOR",
            isStaff: u.role === "STAFF",
            isSupervisor: false,
          },
        });
      }
    }

    const advisors = await prisma.staff.findMany({
      where: {
        OR: [{ isAdvisor: true }, { user: { role: "ADVISOR" } }],
      },
      include: {
        user: true,
        studentsAdvised: {
          select: {
            id: true,
            major: true,
            curriculum: true,
            isDropped: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    let resultAdvisors: Array<{
      id: number;
      name: string;
      email: string;
      department: string | null;
      studentCount: number;
    }> = [];

    if (targetMajor) {
      const targetLower = targetMajor.toLowerCase();
      const matchesTarget = (str?: string | null) => {
        if (!str) return false;
        const s = str.toLowerCase();
        return s.includes(targetLower) || targetLower.includes(s);
      };

      resultAdvisors = advisors
        .map((a) => {
          const advisedInMajor = a.studentsAdvised.filter(
            (s) => !s.isDropped && (matchesTarget(s.major) || matchesTarget(s.curriculum))
          );
          const belongsToDept = matchesTarget(a.department);
          const hasStudentsInMajor = advisedInMajor.length > 0;

          // ถ้าอาจารย์ไม่ได้สังกัดสาขานี้ และไม่ได้มีนิสิตในสาขานี้ ไม่ต้องแสดงในตัวกรอง
          if (!belongsToDept && !hasStudentsInMajor) {
            return null;
          }

          return {
            id: a.id,
            name: a.name,
            email: a.user.email,
            department: a.department,
            studentCount: advisedInMajor.length,
          };
        })
        .filter((a): a is NonNullable<typeof a> => a !== null);
    } else {
      resultAdvisors = advisors.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.user.email,
        department: a.department,
        studentCount: a.studentsAdvised.filter((s) => !s.isDropped).length,
      }));
    }

    res.json({
      success: true,
      advisors: resultAdvisors,
    });
  } catch (err) {
    console.error("GET /api/admin/advisors error:", err);
    res.status(500).json({ success: false, message: "ดึงรายชื่ออาจารย์ไม่สำเร็จ" });
  }
});

// ==========================================
// 9.1 ดึงรายชื่ออาจารย์นิเทศก์ & จัดการ Multi-Role ของบุคลากร (Staff)
// ==========================================
router.get("/supervisors", async (_req: Request, res: Response) => {
  try {
    const supervisors = await prisma.staff.findMany({
      where: {
        OR: [{ isSupervisor: true }, { isAdvisor: true }, { isCourseAdmin: true }],
      },
      include: { user: true, studentsSupervised: true },
      orderBy: { name: "asc" },
    });

    res.json({
      success: true,
      supervisors: supervisors.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.user.email,
        department: s.department,
        isSupervisor: s.isSupervisor,
        studentCount: s.studentsSupervised.length,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/supervisors error:", err);
    res.status(500).json({ success: false, message: "ดึงรายชื่ออาจารย์นิเทศก์ไม่สำเร็จ" });
  }
});

router.get("/staff", async (_req: Request, res: Response) => {
  try {
    const allStaff = await prisma.staff.findMany({
      include: {
        user: true,
        studentsAdvised: true,
        studentsSupervised: true,
      },
      orderBy: { id: "asc" },
    });

    res.json({
      success: true,
      staff: allStaff.map((s) => ({
        id: s.id,
        userId: s.userId,
        name: s.name,
        email: s.user.email,
        userRole: s.user.role,
        department: s.department,
        isCourseAdmin: s.isCourseAdmin,
        isAdvisor: s.isAdvisor,
        isSupervisor: s.isSupervisor,
        isStaff: s.isStaff,
        advisedCount: s.studentsAdvised.length,
        supervisedCount: s.studentsSupervised.length,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/staff error:", err);
    res.status(500).json({ success: false, message: "ดึงข้อมูลบุคลากรไม่สำเร็จ" });
  }
});

// อัปเดตสิทธิ์บุคลากรพร้อมกันหลายคน (Batch Save Roles)
router.put("/staff/batch-roles", async (req: Request, res: Response) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, message: "ไม่มีข้อมูลที่ต้องการอัปเดต" });
    }

    await prisma.$transaction(
      updates.map((u: any) =>
        prisma.staff.update({
          where: { id: parseInt(String(u.id), 10) },
          data: {
            isCourseAdmin: u.isCourseAdmin !== undefined ? Boolean(u.isCourseAdmin) : undefined,
            isAdvisor: u.isAdvisor !== undefined ? Boolean(u.isAdvisor) : undefined,
            isSupervisor: u.isSupervisor !== undefined ? Boolean(u.isSupervisor) : undefined,
            isStaff: u.isStaff !== undefined ? Boolean(u.isStaff) : undefined,
            department: u.department !== undefined ? (u.department ? String(u.department).trim() : null) : undefined,
          },
        })
      )
    );

    res.json({
      success: true,
      message: `บันทึกสิทธิ์บุคลากรทั้งหมด ${updates.length} ท่านเรียบร้อยแล้ว`,
    });
  } catch (err) {
    console.error("PUT /api/admin/staff/batch-roles error:", err);
    res.status(500).json({ success: false, message: "บันทึกสิทธิ์บุคลากรไม่สำเร็จ" });
  }
});

router.put("/staff/:staffId/roles", async (req: Request, res: Response) => {
  try {
    const staffId = parseInt(req.params.staffId as string, 10);
    const { isCourseAdmin, isAdvisor, isSupervisor, isStaff, department } = req.body;

    const updated = await prisma.staff.update({
      where: { id: staffId },
      data: {
        isCourseAdmin: isCourseAdmin !== undefined ? Boolean(isCourseAdmin) : undefined,
        isAdvisor: isAdvisor !== undefined ? Boolean(isAdvisor) : undefined,
        isSupervisor: isSupervisor !== undefined ? Boolean(isSupervisor) : undefined,
        isStaff: isStaff !== undefined ? Boolean(isStaff) : undefined,
        department: department !== undefined ? (department ? String(department).trim() : null) : undefined,
      },
    });

    res.json({
      success: true,
      message: "อัปเดตบทบาทบุคลากรสำเร็จ",
      staff: updated,
    });
  } catch (err) {
    console.error("PUT /api/admin/staff/:staffId/roles error:", err);
    res.status(500).json({ success: false, message: "อัปเดตบทบาทบุคลากรไม่สำเร็จ" });
  }
});

// ==========================================
// Export ข้อมูลนิสิตแบบละเอียด (สำหรับ CSV)
// ==========================================
router.get("/export", async (req: Request, res: Response) => {
  try {
    const students = await prisma.student.findMany({
      include: {
        user: true,
        cv: true,
        trainingRecords: true,
        companies: {
          include: {
            submission: true,
          },
        },
        placement: true,
        advisor: true,
      },
      orderBy: { studentCode: "asc" },
    });

    let exportData = (await applyWindowTermFilter(students, req.query.windowTerm)).map((s) => {
      // 5. ชั่วโมงอบรม Soft Skill & Hard Skill ที่ Approved
      const approvedTrainings = (s.trainingRecords || []).filter((t: any) => t.status === "APPROVED");
      const softHours = approvedTrainings
        .filter((t: any) => t.skillType === "SOFT")
        .reduce((sum: number, t: any) => sum + t.hours, 0);
      const hardHours = approvedTrainings
        .filter((t: any) => t.skillType === "HARD")
        .reduce((sum: number, t: any) => sum + t.hours, 0);
      const totalHours = softHours + hardHours;
      const isTrainingComplete = softHours >= 12 && hardHours >= 18;
      const trainingProgress = isTrainingComplete
        ? `ผ่านครบ ${totalHours} ชม. (Soft ${softHours}/12, Hard ${hardHours}/18)`
        : `ยังไม่ครบ (Soft ${softHours}/12, Hard ${hardHours}/18)`;

      // 6. สถานะ CV (คอมเมนต์อย่างเดียว ไม่มีผ่าน/ไม่ผ่าน)
      const cvStatus = CV_STATE_LABEL[cvState(s.cv)];

      // 7. สถานะ Checklist
      const companies = s.companies || [];
      let checklistStatus = "ยังไม่มีข้อมูล";
      if (companies.length > 0) {
        const hasApproved = companies.some((c: any) => c.checklistStatus === "APPROVED");
        const allRejected = companies.every((c: any) => c.checklistStatus === "REJECTED");
        if (hasApproved) checklistStatus = "ผ่าน";
        else if (allRejected) checklistStatus = "ไม่ผ่าน";
        else checklistStatus = "รอผล";
      }

      // 8. ผลการสมัคร/สัมภาษณ์
      const submissions = companies.map((c: any) => c.submission).filter(Boolean);
      let interviewStatus = "ยังไม่ได้ยื่น";
      if (submissions.some((sub: any) => sub.status === "INTERVIEW_PASSED")) {
        interviewStatus = "สัมภาษณ์ผ่านแล้ว";
      } else if (submissions.some((sub: any) => sub.status === "INTERVIEWED_PENDING")) {
        interviewStatus = "สัมภาษณ์แล้ว รอผล";
      } else if (submissions.some((sub: any) => sub.status === "SUBMITTED_WAITING")) {
        interviewStatus = "ยื่นแล้ว รอสัมภาษณ์";
      } else if (submissions.some((sub: any) => sub.status === "INTERVIEW_FAILED_REAPPLIED")) {
        interviewStatus = "สัมภาษณ์ไม่ผ่าน ยื่นเพิ่มแล้ว";
      } else {
        interviewStatus = "ยังไม่ได้ยื่น";
      }

      // ข้อมูล Placement และบริษัท
      const p = s.placement;
      const passedCompany = companies.find((c: any) => c.submission && c.submission.status === "INTERVIEW_PASSED");
      const companyNameTh = (p && p.companyNameTh) || (passedCompany ? passedCompany.name : "");

      // 17. สถานะอนุมัติที่ฝึกงาน
      let placementStatus = "ยังไม่ระบุที่ฝึกงาน";
      if (p) {
        if (p.status === "APPROVED") placementStatus = "อนุมัติแล้ว";
        else if (p.status === "REJECTED") placementStatus = "ไม่อนุมัติ";
        else placementStatus = "รออนุมัติ";
      }

      // 18. สถานะในระบบ
      const dropStatus = s.isDropped
        ? `ดรอป${s.dropReason ? ` (${s.dropReason})` : ""}`
        : "ปกติ";

      const cats = categorizeStudent(s);
      return {
        id: s.id,
        studentCode: s.studentCode,
        nameTh: s.nameTh,
        phone: s.phone || "",
        advisorName: s.advisor ? s.advisor.name : "",
        trainingProgress,
        cvStatus,
        checklistStatus,
        interviewStatus,
        companyNameTh,
        position: p ? (p.position || "") : "",
        contactPersonName: p ? (p.contactPersonName || "") : "",
        contactPersonPosition: p ? (p.contactPersonPosition || "") : "",
        companyAddress: p ? (p.companyAddress || "") : "",
        province: p ? (p.province || "") : "",
        companyPhone: p ? ([p.companyPhone1, p.companyPhone2].filter(Boolean).join(", ")) : "",
        companyEmail: p ? (p.companyEmail || "") : "",
        placementStatus,
        dropStatus,
        // ฟิลด์เพิ่มเติมเผื่อใช้งาน
        year: s.year,
        email: s.user ? s.user.email : "",
        lineId: s.lineId || "",
        facebook: s.facebook || "",
        cvLink: s.cv ? s.cv.fileUrl : "",
        softHours,
        hardHours,
        totalHours,
        isDropped: s.isDropped,
        dropReason: s.dropReason || "",
        isTrainingComplete,
        readinessCategory: cats.readinessCategory,
        trainingCategory: cats.trainingCategory,
        cvCategory: cats.cvCategory,
        placementCategory: cats.placementCategory,
      };
    });

    // 1. กรองตาม IDs (เฉพาะรายการที่เลือกผ่าน checkbox)
    if (req.query.ids) {
      const idList = String(req.query.ids).split(",").map((id) => parseInt(id.trim(), 10)).filter(Boolean);
      if (idList.length > 0) {
        const idSet = new Set(idList);
        exportData = exportData.filter((s) => idSet.has(s.id));
      }
    } else if (req.query.all !== "true") {
      // 2. กรองตามเงื่อนไข (Filtered)
      if (req.query.viewDropped === "true") {
        exportData = exportData.filter((s) => s.isDropped);
      } else if (req.query.viewDropped === "false") {
        exportData = exportData.filter((s) => !s.isDropped);
      }

      // กรองตาม search
      if (req.query.search) {
        const q = String(req.query.search).toLowerCase();
        exportData = exportData.filter(
          (s) =>
            (s.studentCode && s.studentCode.toLowerCase().includes(q)) ||
            (s.nameTh && s.nameTh.toLowerCase().includes(q))
        );
      }

      // กรองตามรุ่น (yearPrefix) หรือปีการศึกษาที่ปิดรุ่น (academicYear)
      const matchCohort = await cohortFilterFromQuery(req.query);
      if (matchCohort) {
        exportData = exportData.filter((s) => matchCohort(s.studentCode));
      }

      // กรองตาม statusFilter
      if (req.query.statusFilter) {
        switch (req.query.statusFilter) {
          case "training_passed":
            exportData = exportData.filter((s) => s.isTrainingComplete);
            break;
          case "training_failed":
            exportData = exportData.filter((s) => !s.isTrainingComplete);
            break;
          case "cv_passed":
          case "cv_uploaded":
            exportData = exportData.filter((s) => s.cvStatus !== CV_STATE_LABEL.NONE);
            break;
          case "cv_failed":
          case "cv_none":
            exportData = exportData.filter((s) => s.cvStatus === CV_STATE_LABEL.NONE);
            break;
          case "checklist_passed":
            exportData = exportData.filter((s) => s.checklistStatus === "ผ่าน");
            break;
          case "checklist_failed":
            exportData = exportData.filter((s) => s.checklistStatus !== "ผ่าน");
            break;
          case "placement_approved":
            exportData = exportData.filter((s) => s.placementStatus === "อนุมัติแล้ว");
            break;
          case "placement_pending":
            exportData = exportData.filter((s) => s.placementStatus !== "อนุมัติแล้ว");
            break;
        }
      }

      // กรองตาม advisorFilter
      if (req.query.advisorFilter) {
        exportData = exportData.filter((s) => s.advisorName === req.query.advisorFilter);
      }

      // กรองตาม skillFilter
      if (req.query.skillFilter) {
        switch (req.query.skillFilter) {
          case "lack_soft":
            exportData = exportData.filter((s) => (s.softHours || 0) < 12);
            break;
          case "lack_hard":
            exportData = exportData.filter((s) => (s.hardHours || 0) < 18);
            break;
          case "lack_both":
            exportData = exportData.filter((s) => (s.softHours || 0) < 12 && (s.hardHours || 0) < 18);
            break;
        }
      }

      // กรองตาม chartType และ chartKey
      if (req.query.chartType && req.query.chartKey) {
        const ct = req.query.chartType;
        const ck = req.query.chartKey;
        if (ct === "readiness") exportData = exportData.filter((s) => s.readinessCategory === ck);
        else if (ct === "training") exportData = exportData.filter((s) => s.trainingCategory === ck);
        else if (ct === "cv") exportData = exportData.filter((s) => s.cvCategory === ck);
        else if (ct === "placement") exportData = exportData.filter((s) => s.placementCategory === ck);
      }
    }

    res.json({ success: true, data: exportData });
  } catch (err) {
    console.error("GET /api/admin/export error:", err);
    res.status(500).json({ success: false, message: "ดึงข้อมูล Export ไม่สำเร็จ" });
  }
});

// =========================================================================
// 8. นำเข้ารายชื่อนิสิตจากไฟล์ REG Excel / CSV (Preview & Confirm)
// =========================================================================

// POST /api/admin/students/import-preview: วิเคราะห์ไฟล์และแสดงผลสรุปก่อนบันทึก (พร้อมตรวจจับข้อมูลอัปเดต [REQ-03])
router.post("/students/import-preview", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: "กรุณาเลือกไฟล์ Excel (.xlsx) หรือ .csv" });
    }

    const customAcademicYear = req.body.academicYear ? parseInt(req.body.academicYear, 10) : null;
    const isCentralOrStaff = Boolean(
      req.staff?.isStaff ||
        req.session.user?.role === "STAFF" ||
        (req.session.user?.role === "ADMIN" && !req.staff?.department)
    );
    const result = parseStudentSpreadsheet(req.file.buffer, customAcademicYear, {
      targetDepartment: req.staff?.department || "วิศวกรรมซอฟต์แวร์",
      allowAllMajors: isCentralOrStaff,
    });

    // [REQ-03] ตรวจสอบว่ามีนิสิตคนใดอยู่ในฐานข้อมูลแล้วบ้าง และมีฟิลด์ใดที่จะถูกอัปเดต
    const codes = result.matchedStudents.map((s) => s.studentCode);
    const existingStudents = await prisma.student.findMany({
      where: { studentCode: { in: codes } },
      include: { trainingRecords: true },
    });
    const existingMap = new Map(existingStudents.map((st) => [st.studentCode, st]));

    let newCount = 0;
    let updateCount = 0;
    let unchangedCount = 0;
    const updatePreview: Array<{ studentCode: string; nameTh: string; changes: string[] }> = [];

    for (const s of result.matchedStudents) {
      const existing = existingMap.get(s.studentCode);
      if (!existing) {
        newCount++;
        continue;
      }

      const changes: string[] = [];
      if (s.nameTh && s.nameTh !== existing.nameTh) {
        changes.push(`ชื่อ-สกุล: ${existing.nameTh} -> ${s.nameTh}`);
      }
      if (typeof s.gpa === "number" && s.gpa !== existing.gpa) {
        changes.push(`GPAX: ${existing.gpa ?? "-"} -> ${s.gpa}`);
      }
      if (s.year && s.year !== existing.year) {
        changes.push(`ชั้นปี: ${existing.year} -> ${s.year}`);
      }
      if (s.major && s.major !== existing.major) {
        changes.push(`สาขา: ${existing.major ?? "-"} -> ${s.major}`);
      }
      if (s.studentStatus && s.studentStatus !== existing.studentStatus) {
        changes.push(`สถานะ: ${existing.studentStatus ?? "-"} -> ${s.studentStatus}`);
      }
      if (typeof s.softSkillHours === "number") {
        const currentSoft = existing.trainingRecords
          .filter((t) => t.skillType === "SOFT" && t.source === "STAFF_IMPORT")
          .reduce((sum, t) => sum + t.hours, 0);
        if (currentSoft !== s.softSkillHours) {
          changes.push(`ชั่วโมง Soft Skill (Co-op): ${currentSoft} -> ${s.softSkillHours} ชม.`);
        }
      }
      if (typeof s.hardSkillHours === "number") {
        const currentHard = existing.trainingRecords
          .filter((t) => t.skillType === "HARD" && t.source === "STAFF_IMPORT")
          .reduce((sum, t) => sum + t.hours, 0);
        if (currentHard !== s.hardSkillHours) {
          changes.push(`ชั่วโมง Hard Skill (Co-op): ${currentHard} -> ${s.hardSkillHours} ชม.`);
        }
      }

      if (changes.length > 0) {
        updateCount++;
        updatePreview.push({
          studentCode: s.studentCode,
          nameTh: s.nameTh || existing.nameTh,
          changes,
        });
      } else {
        unchangedCount++;
      }
    }

    res.json({
      success: true,
      summary: {
        ...result.summary,
        newCount,
        updateCount,
        unchangedCount,
      },
      updatePreview,
      matchedStudents: result.matchedStudents,
      skippedStudents: result.skippedStudents,
    });
  } catch (err: any) {
    console.error("POST /api/admin/students/import-preview error:", err);
    res.status(400).json({
      success: false,
      message: err.message || "เกิดข้อผิดพลาดในการอ่านไฟล์",
    });
  }
});

// POST /api/admin/students/import-confirm: ยืนยันบันทึกข้อมูลนิสิตลงฐานข้อมูล (Upsert โดยไม่ลบข้อมูลเดิม [REQ-02, REQ-03])
router.post("/students/import-confirm", async (req: Request, res: Response) => {
  try {
    const { students } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, message: "ไม่มีรายชื่อนิสิตที่ต้องนำเข้า" });
    }

    let successCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    const updatedDetails: Array<{ studentCode: string; nameTh: string; changes: string[] }> = [];
    const errors: any[] = [];

    for (const s of students) {
      if (!s.studentCode || !s.email) continue;

      try {
        const studentCodeStr = String(s.studentCode).trim();
        const existing = await prisma.student.findUnique({
          where: { studentCode: studentCodeStr },
          include: { trainingRecords: true },
        });

        // 1. Upsert User (อีเมลมหาวิทยาลัยสำหรับ Login ผ่าน MSAL / Microsoft OAuth)
        const user = await prisma.user.upsert({
          where: { email: s.email.toLowerCase().trim() },
          update: {
            username: s.nameTh || s.studentCode,
          },
          create: {
            email: s.email.toLowerCase().trim(),
            username: s.nameTh || s.studentCode,
            role: "STUDENT",
            password: null,
          },
        });

        // 2. Upsert Student Profile (เปรียบเทียบและอัปเดตเฉพาะเรคอร์ดที่มีการเปลี่ยนแปลง ไม่ลบข้อมูลเดิม)
        const changes: string[] = [];
        if (existing) {
          if (s.nameTh && s.nameTh !== existing.nameTh) {
            changes.push(`ชื่อ-สกุล: ${existing.nameTh} -> ${s.nameTh}`);
          }
          if (typeof s.gpa === "number" && s.gpa !== existing.gpa) {
            changes.push(`GPAX: ${existing.gpa ?? "-"} -> ${s.gpa}`);
          }
          if (s.year && s.year !== existing.year) {
            changes.push(`ชั้นปี: ${existing.year} -> ${s.year}`);
          }
          if (s.major && s.major !== existing.major) {
            changes.push(`สาขา: ${existing.major ?? "-"} -> ${s.major}`);
          }
          if (s.studentStatus && s.studentStatus !== existing.studentStatus) {
            changes.push(`สถานะ: ${existing.studentStatus ?? "-"} -> ${s.studentStatus}`);
          }
        }

        const studentRecord = await prisma.student.upsert({
          where: { studentCode: studentCodeStr },
          update: {
            nameTh: s.nameTh || undefined,
            year: s.year || undefined,
            major: s.major || undefined,
            curriculum: s.curriculum || undefined,
            studentStatus: s.studentStatus || undefined,
            gpa: typeof s.gpa === "number" ? s.gpa : undefined,
          },
          create: {
            userId: user.id,
            studentCode: studentCodeStr,
            nameTh: s.nameTh || `นิสิต ${studentCodeStr}`,
            nameEn: s.nameEn || "-",
            year: s.year || 1,
            major: s.major || "วิศวกรรมซอฟต์แวร์",
            curriculum: s.curriculum || null,
            studentStatus: s.studentStatus || "กำลังศึกษา",
            gpa: typeof s.gpa === "number" ? s.gpa : null,
          },
        });

        // 3. หากในไฟล์มีชั่วโมงเตรียมความพร้อมจากระบบ Co-op (softSkillHours / hardSkillHours) ให้อัปเดตใน TrainingRecord (source: STAFF_IMPORT)
        if (typeof s.softSkillHours === "number" && s.softSkillHours >= 0) {
          const existingSoft = existing?.trainingRecords.find(
            (t) => t.skillType === "SOFT" && t.source === "STAFF_IMPORT"
          );
          if (!existingSoft && s.softSkillHours > 0) {
            await prisma.trainingRecord.create({
              data: {
                studentId: studentRecord.id,
                title: "ชั่วโมงเตรียมความพร้อม Soft Skill (นำเข้าจากระบบ Co-op)",
                skillType: "SOFT",
                hours: s.softSkillHours,
                source: "STAFF_IMPORT",
                status: "APPROVED",
                reviewedById: req.session.user!.id,
                reviewedAt: new Date(),
              },
            });
            if (existing) changes.push(`Soft Skill (Co-op): 0 -> ${s.softSkillHours} ชม.`);
          } else if (existingSoft && existingSoft.hours !== s.softSkillHours) {
            await prisma.trainingRecord.update({
              where: { id: existingSoft.id },
              data: {
                hours: s.softSkillHours,
                status: "APPROVED",
                reviewedById: req.session.user!.id,
                reviewedAt: new Date(),
              },
            });
            changes.push(`Soft Skill (Co-op): ${existingSoft.hours} -> ${s.softSkillHours} ชม.`);
          }
        }

        if (typeof s.hardSkillHours === "number" && s.hardSkillHours >= 0) {
          const existingHard = existing?.trainingRecords.find(
            (t) => t.skillType === "HARD" && t.source === "STAFF_IMPORT"
          );
          if (!existingHard && s.hardSkillHours > 0) {
            await prisma.trainingRecord.create({
              data: {
                studentId: studentRecord.id,
                title: "ชั่วโมงเตรียมความพร้อม Hard Skill (นำเข้าจากระบบ Co-op)",
                skillType: "HARD",
                hours: s.hardSkillHours,
                source: "STAFF_IMPORT",
                status: "APPROVED",
                reviewedById: req.session.user!.id,
                reviewedAt: new Date(),
              },
            });
            if (existing) changes.push(`Hard Skill (Co-op): 0 -> ${s.hardSkillHours} ชม.`);
          } else if (existingHard && existingHard.hours !== s.hardSkillHours) {
            await prisma.trainingRecord.update({
              where: { id: existingHard.id },
              data: {
                hours: s.hardSkillHours,
                status: "APPROVED",
                reviewedById: req.session.user!.id,
                reviewedAt: new Date(),
              },
            });
            changes.push(`Hard Skill (Co-op): ${existingHard.hours} -> ${s.hardSkillHours} ชม.`);
          }
        }

        if (!existing) {
          createdCount++;
        } else if (changes.length > 0) {
          updatedCount++;
          updatedDetails.push({
            studentCode: studentCodeStr,
            nameTh: s.nameTh || existing.nameTh,
            changes,
          });
        } else {
          unchangedCount++;
        }

        successCount++;
      } catch (rowErr: any) {
        console.error(`Import student error for ${s.studentCode}:`, rowErr);
        errors.push({ studentCode: s.studentCode, error: rowErr.message });
      }
    }

    res.json({
      success: true,
      importedCount: successCount,
      createdCount,
      updatedCount,
      unchangedCount,
      updatedDetails,
      failedCount: errors.length,
      errors: errors.slice(0, 10),
    });
  } catch (err) {
    console.error("POST /api/admin/students/import-confirm error:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการบันทึกข้อมูลเข้าสู่ระบบ" });
  }
});

// =========================================================================
// 9. SUPER ADMIN (พี่จอม - เจ้าหน้าที่คณะ) COMMAND CENTER ENDPOINTS
//    - จัดการรอบปีการศึกษา & Unlock สาขาวิชา (8 สาขา)
//    - สร้างกิจกรรมอบรมภายใน (สูงสุด 6 ชม./วัน) & ระบบ Check-in ด้วยรหัสนิสิต
//    - จัดการฐานข้อมูลสถานประกอบการกลาง (Company Master Data & Confirm บริษัทใหม่)
//    - ระบบออกหนังสือขอความอนุเคราะห์ (+แบบตอบรับ), ตรวจใบตอบรับ, ออกหนังสือส่งตัว & Archive
//    - ส่งออกข้อมูลเชื่อมโยงระบบ Co-op ICT ของพี่แดง (Co-op 01)
// =========================================================================

router.get("/super-admin/overview", async (req: Request, res: Response) => {
  try {
    const state = loadSuperAdminState();

    // ดึงนิสิตทั้งหมดพร้อมข้อมูลที่เกี่ยวข้องจากฐานข้อมูลจริง
    const allStudents = await prisma.student.findMany({
      where: { isDropped: false },
      include: {
        user: true,
        cv: true,
        trainingRecords: true,
        companies: {
          include: { submission: true },
          orderBy: { updatedAt: "desc" },
        },
        placement: true,
        advisor: true,
        supervisor: true,
      },
      orderBy: { studentCode: "asc" },
    });

    // ซิงค์บริษัทที่นิสิตกรอกในระบบ (Company / InternshipPlacement) หากยังไม่มีใน Master Data ให้ขึ้นเป็น PENDING_REVIEW อัตโนมัติ
    const normalizeName = (n: string) => n.replace(/\s+/g, "").toLowerCase();
    const existingMasterNames = new Set(
      state.companyMasterData.map((c) => normalizeName(c.nameTh))
    );
    const dismissedNames = new Set(
      (state.dismissedCompanyNames || []).map((n) => normalizeName(n))
    );
    let stateModified = false;

    for (const st of allStudents) {
      // แหล่งชื่อบริษัท: Checklist (Company) + ข้อมูลสถานที่ฝึกงาน (Placement ที่ไม่ถูกปฏิเสธ)
      // เดิมซิงก์เฉพาะ Company ทำให้ชื่อที่มาจาก Placement (ฟอร์มเก่า) ไม่ขึ้นใน Master Data
      const nameSources: Array<{ id: string; name: string; createdAt?: Date | null }> = (st.companies || []).map(
        (c) => ({ id: String(c.id), name: c.name, createdAt: c.createdAt })
      );
      if (st.placement?.companyNameTh && st.placement.status !== "REJECTED") {
        nameSources.push({ id: `PLC-${st.placement.id}`, name: st.placement.companyNameTh, createdAt: null });
      }
      for (const comp of nameSources) {
        const cleanName = (comp.name || "").trim();
        if (!cleanName) continue;
        const norm = normalizeName(cleanName);
        if (!existingMasterNames.has(norm) && !dismissedNames.has(norm)) {
          existingMasterNames.add(norm);
          state.companyMasterData.unshift({
            id: `COMP-NEW-${comp.id}`,
            nameTh: cleanName,
            nameEn: "-",
            province: st.placement?.province || "รอระบุจังหวัด",
            address: st.placement?.companyAddress || "รอตรวจสอบที่อยู่จากนิสิต",
            hrContactName: st.placement?.contactPersonName || "-",
            hrPhone: st.placement?.companyPhone1 || "-",
            hrEmail: st.placement?.companyEmail || "-",
            recommendedPositions: st.placement?.position || "นักศึกษาฝึกงาน / สหกิจศึกษา",
            status: "PENDING_REVIEW",
            submittedByStudentCode: st.studentCode,
            submittedByStudentName: st.nameTh,
            createdAt: comp.createdAt ? comp.createdAt.toISOString() : new Date().toISOString(),
          });
          stateModified = true;
        } else {
          const existingRec = state.companyMasterData.find(
            (c) => normalizeName(c.nameTh) === norm && c.status === "PENDING_REVIEW"
          );
          if (existingRec && st.placement) {
            if (
              st.placement.companyAddress &&
              (!existingRec.address ||
                existingRec.address === "-" ||
                existingRec.address === "รอตรวจสอบที่อยู่จากนิสิต")
            ) {
              existingRec.address = st.placement.companyAddress;
              stateModified = true;
            }
            if (
              st.placement.province &&
              (!existingRec.province ||
                existingRec.province === "-" ||
                existingRec.province === "รอระบุจังหวัด")
            ) {
              existingRec.province = st.placement.province;
              stateModified = true;
            }
          }
        }
      }
    }

    // หนังสือที่ออกก่อนมีระบบ "ฉบับหนังสือ" -> สร้างฉบับย้อนหลังครั้งเดียว เพื่อให้รายชื่อคงที่นับจากนี้
    if (backfillLegacyBatches(state, new Map(allStudents.map((s) => [s.id, toBatchStudent(s)])))) {
      stateModified = true;
    }

    if (stateModified) {
      saveSuperAdminState(state);
    }

    // สร้างรายการคิวงานเอกสารราชการ (Document Workflow Queue)
    // นโยบายใหม่: นิสิตยื่นได้ทีละ 1 บริษัท -> ที่ปรึกษาอนุมัติ Checklist -> ออกหนังสือขอความอนุเคราะห์ (+แบบตอบรับ) -> บริษัทส่งใบตอบรับ (รับ/ปฏิเสธ) -> ถ้ารับ พี่จอมอนุมัติและออกหนังสือส่งตัว
    const windowsById = new Map(
      (await prisma.internshipWindow.findMany({ select: { id: true, term: true, termType: true, internStartDate: true, internEndDate: true } })).map((w) => [w.id, w])
    );
    const documentQueue = allStudents.map((s) => {
      const cat = categorizeStudent(s);
      const activeCompany =
        (s.companies || []).find((c) => c.checklistStatus === "APPROVED") ||
        (s.companies || [])[0] ||
        null;

      // ใช้ชื่อจาก Checklist ที่ที่ปรึกษาอนุมัติเป็นหลัก (ชุดเดียวกับที่ซิงก์เข้า Master Data)
      // ไม่ใช้ชื่อจาก Placement ที่ถูกปฏิเสธไปแล้ว
      const approvedCompany = (s.companies || []).find((c) => c.checklistStatus === "APPROVED");
      const usablePlacementName =
        s.placement && s.placement.status !== "REJECTED" ? s.placement.companyNameTh : "";
      const companyName =
        approvedCompany?.name ||
        usablePlacementName ||
        activeCompany?.name ||
        "";
      const masterRec = companyName
        ? state.companyMasterData.find((c) => normalizeName(c.nameTh) === normalizeName(companyName))
        : null;
      const inMasterData = Boolean(masterRec && masterRec.status !== "PENDING_REVIEW");
      const position = s.placement?.position || "นิสิตฝึกงาน / สหกิจศึกษา";
      const checklistStatus = activeCompany?.checklistStatus || "NONE";
      const wfKey = String(s.id);
      const wf = state.docWorkflowMap[wfKey] || {
        studentId: s.id,
        studentCode: s.studentCode,
        companyName,
        interviewDate: "",
        requestLetterIssued: false,
        companyResponseStatus: s.placement?.status === "APPROVED" ? "ACCEPTED" : "NOT_SENT",
        dispatchLetterIssued: s.placement?.status === "APPROVED",
        isLocked: s.placement?.status === "APPROVED",
      };

      const studentArchives = state.archivedApplications.filter(
        (a) => a.studentCode === s.studentCode || a.studentId === s.id
      );

      return {
        studentId: s.id,
        studentCode: s.studentCode,
        nameTh: s.nameTh,
        major: s.major || "วิศวกรรมซอฟต์แวร์",
        year: s.year,
        gpa: s.gpa,
        phone: s.phone || "-",
        email: s.user?.email || "-",
        advisorName: s.advisor?.name || "ยังไม่ระบุ",
        supervisorName: s.supervisor?.name || "ยังไม่ระบุ",
        softHours: cat.softHours,
        hardHours: cat.hardHours,
        cvStatus: cvState(s.cv),
        cvFileUrl: s.cv?.fileUrl || null,
        companyId: activeCompany?.id || null,
        companyName: companyName || "ยังไม่ยื่นบริษัท",
        inMasterData,
        cohortCode: (s.studentCode || "").slice(0, 2),
        windowTerm: s.internshipWindowId ? windowsById.get(s.internshipWindowId)?.term || "" : "",
        windowIsSummer: s.internshipWindowId ? windowsById.get(s.internshipWindowId)?.termType === "SUMMER" : false,
        // ช่วงฝึกตามรอบ (ใช้พรีวิวร่างหนังสือ — ฉบับที่ออกแล้วใช้ค่าที่เก็บไว้ในฉบับ)
        internStartDate: ymd(s.internshipWindowId ? windowsById.get(s.internshipWindowId)?.internStartDate : null),
        internEndDate: ymd(s.internshipWindowId ? windowsById.get(s.internshipWindowId)?.internEndDate : null),
        position,
        companyAddress: s.placement?.companyAddress || "-",
        companyProvince: s.placement?.province || "-",
        contactPersonName: s.placement?.contactPersonName || "ฝ่ายทรัพยากรบุคคล (HR)",
        // ผู้รับหนังสือ ("เรียน ... ตำแหน่ง ...") ในพรีวิวร่าง — ค่าว่างถ้านิสิตยังไม่กรอก
        letterRecipientName: s.placement?.contactPersonName || "",
        letterRecipientPosition: s.placement?.contactPersonPosition || "",
        contactPersonPhone: s.placement?.companyPhone1 || "-",
        checklistStatus,
        interviewDate: wf.interviewDate || "2026-02-15",
        requestLetterIssued: Boolean(wf.requestLetterIssued),
        requestLetterDocNo: wf.requestLetterDocNo || "",
        requestLetterDate: wf.requestLetterDate || "",
        requestLetterSignatureSnapshot: wf.requestLetterSignatureSnapshot || "",
        requestLetterBatchId: state.docWorkflowMap[wfKey]?.requestLetterBatchId || "",
        companyResponseStatus: wf.companyResponseStatus || "NOT_SENT",
        companyResponseFileName: wf.companyResponseFileName || "",
        companyResponseFileUrl: wf.companyResponseFileUrl || "",
        companyResponseNote: wf.companyResponseNote || "",
        companyResponseUploadedAt: wf.companyResponseUploadedAt || "",
        companyResponseSubmittedByStudent: Boolean(wf.companyResponseSubmittedByStudent),
        companyResponseOcr: wf.companyResponseOcr || null,
        advisorAcceptanceStatus: wf.advisorAcceptanceStatus || "NONE",
        advisorAcceptanceNote: wf.advisorAcceptanceNote || "",
        advisorAcceptanceReviewedAt: wf.advisorAcceptanceReviewedAt || "",
        companyResponseConfirmedAt: wf.companyResponseConfirmedAt || "",
        dispatchLetterIssued: Boolean(wf.dispatchLetterIssued),
        dispatchLetterDocNo: wf.dispatchLetterDocNo || "",
        dispatchLetterDate: wf.dispatchLetterDate || "",
        dispatchLetterSignatureSnapshot: wf.dispatchLetterSignatureSnapshot || "",
        dispatchLetterBatchId: state.docWorkflowMap[wfKey]?.dispatchLetterBatchId || "",
        isLocked: Boolean(wf.isLocked),
        unlockedByAdmin: Boolean(wf.unlockedByAdmin),
        archiveCount: studentArchives.length,
        archives: studentArchives,
      };
    });

    // จัดกลุ่มนิสิตที่ไปบริษัทเดียวกัน (สำหรับออกหนังสือขอความอนุเคราะห์แบบรวมรายชื่อแนบท้าย Group Letter)
    const companyGroupsMap: Record<
      string,
      {
        companyName: string;
        students: Array<{
          studentId: number;
          studentCode: string;
          nameTh: string;
          major: string;
          position: string;
          checklistStatus: string;
          requestLetterIssued: boolean;
        }>;
      }
    > = {};

    for (const item of documentQueue) {
      if (!item.companyName || item.companyName === "ยังไม่ยื่นบริษัท") continue;
      const key = item.companyName.trim();
      if (!companyGroupsMap[key]) {
        companyGroupsMap[key] = { companyName: key, students: [] };
      }
      companyGroupsMap[key].students.push({
        studentId: item.studentId,
        studentCode: item.studentCode,
        nameTh: item.nameTh,
        major: item.major,
        position: item.position,
        checklistStatus: item.checklistStatus,
        requestLetterIssued: item.requestLetterIssued,
      });
    }

    res.json({
      success: true,
      academicConfig: state.academicConfig,
      internshipOverview: await getOpenMajorsSummary(),
      trainingEvents: state.trainingEvents,
      companyMasterData: state.companyMasterData,
      pendingMasterCompaniesCount: state.companyMasterData.filter(
        (c) => c.status === "PENDING_REVIEW"
      ).length,
      documentQueue,
      // นิสิตสหกิจ (ใบสมัครที่ยังไม่จบ) สำหรับ Export Co-op 01 — ตัวกรองประเภท ฝึกงาน / สหกิจ
      coopExportRows: await buildCoopExportRows(),
      companyGroups: Object.values(companyGroupsMap),
      archivedApplications: state.archivedApplications,
      // ฉบับหนังสือราชการที่ออกแล้ว (รายชื่อ snapshot ณ วันที่ออก) — ใช้แสดงรายฉบับและพรีวิวในคิวออกหนังสือ
      letterBatches: Object.values(state.letterBatches || {}),
    });
  } catch (err) {
    console.error("GET /api/admin/super-admin/overview error:", err);
    res.status(500).json({ success: false, message: "โหลดข้อมูล Super Admin ไม่สำเร็จ" });
  }
});

// 9.1 บันทึกตั้งค่าปีการศึกษา / ภาคการศึกษา / เลขที่หนังสือราชการเริ่มต้น
router.post("/super-admin/academic-config", requireLetterSettingsStaff, async (req: Request, res: Response) => {
  try {
    const state = loadSuperAdminState();
    const {
      currentAcademicYear,
      currentSemester,
      defaultDocPrefix,
      deanSignatory,
      deanPosition,
      officePhone,
      courseInstructors,
    } = req.body;

    if (currentAcademicYear) state.academicConfig.currentAcademicYear = String(currentAcademicYear).trim();
    if (currentSemester) state.academicConfig.currentSemester = String(currentSemester).trim();
    if (defaultDocPrefix !== undefined) state.academicConfig.defaultDocPrefix = String(defaultDocPrefix).trim();
    if (deanSignatory !== undefined) state.academicConfig.deanSignatory = String(deanSignatory).trim().slice(0, 200);
    // ตำแหน่งผู้ลงนามขึ้นบรรทัดใหม่ได้ (เช่น "รองคณบดี... รักษาการแทน\nคณบดี...")
    if (deanPosition !== undefined) state.academicConfig.deanPosition = String(deanPosition).trim().slice(0, 400);
    if (officePhone !== undefined) state.academicConfig.officePhone = String(officePhone).trim().slice(0, 100);
    if (courseInstructors !== undefined) {
      if (!courseInstructors || typeof courseInstructors !== "object" || Array.isArray(courseInstructors)) {
        return res.status(400).json({ success: false, message: "รูปแบบข้อมูลอาจารย์รายวิชาไม่ถูกต้อง" });
      }
      const cleaned: Record<string, { name: string; phone: string }> = {};
      for (const [major, v] of Object.entries(courseInstructors as Record<string, any>).slice(0, 30)) {
        // key = รหัสสาขา (เช่น "SE") — รับเฉพาะสาขาที่มีในระบบ
        const key = findMajor(String(major).trim())?.code || "";
        const name = String(v?.name ?? "").trim().slice(0, 200);
        const phone = String(v?.phone ?? "").trim().slice(0, 50);
        if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
        if (key && (name || phone)) cleaned[key] = { name, phone };
      }
      state.academicConfig.courseInstructors = cleaned;
    }
    state.academicConfig.updatedAt = new Date().toISOString();

    saveSuperAdminState(state);
    res.json({
      success: true,
      message: "บันทึกการตั้งค่าปีการศึกษาและค่าเริ่มต้นหนังสือราชการเรียบร้อยแล้ว",
      academicConfig: state.academicConfig,
    });
  } catch (err) {
    console.error("POST /api/admin/super-admin/academic-config error:", err);
    res.status(500).json({ success: false, message: "บันทึกการตั้งค่าไม่สำเร็จ" });
  }
});

router.post("/super-admin/academic-config/signature", requireLetterSettingsStaff, parseAcademicSignatureUpload, (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: "กรุณาเลือกไฟล์ลายเซ็น" });
      return;
    }

    const buffer = req.file.buffer;
    const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const detectedMimeType = isPng ? "image/png" : isJpeg ? "image/jpeg" : "";
    if (!detectedMimeType || detectedMimeType !== req.file.mimetype) {
      res.status(400).json({ success: false, message: "เนื้อหาไฟล์ไม่ใช่ภาพ PNG หรือ JPEG ที่รองรับ" });
      return;
    }

    const state = loadSuperAdminState();
    state.academicConfig.signatureDataUrl = `data:${detectedMimeType};base64,${buffer.toString("base64")}`;
    state.academicConfig.updatedAt = new Date().toISOString();
    saveSuperAdminStateOrThrow(state);
    res.json({ success: true, message: "อัปโหลดลายเซ็นเรียบร้อยแล้ว", signatureDataUrl: state.academicConfig.signatureDataUrl });
  } catch (err) {
    console.error("POST /api/admin/super-admin/academic-config/signature error:", err);
    res.status(500).json({ success: false, message: "บันทึกลายเซ็นไม่สำเร็จ" });
  }
});

router.delete("/super-admin/academic-config/signature", requireLetterSettingsStaff, (_req: Request, res: Response) => {
  try {
    const state = loadSuperAdminState();
    state.academicConfig.signatureDataUrl = "";
    state.academicConfig.updatedAt = new Date().toISOString();
    saveSuperAdminStateOrThrow(state);
    res.json({ success: true, message: "ลบลายเซ็นเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("DELETE /api/admin/super-admin/academic-config/signature error:", err);
    res.status(500).json({ success: false, message: "ลบลายเซ็นไม่สำเร็จ" });
  }
});

// 9.2 ปลดล็อก / ล็อก รอบการยื่นขอฝึกงานตามสาขาวิชา (Major Unlocking)
// 9.3 สร้างกิจกรรมอบรมภายในคณะ (รองรับหลายช่วงเวลา / หลายวัน และกำหนดชั่วโมงแต่ละช่วงเองได้)
router.post("/super-admin/events", async (req: Request, res: Response) => {
  try {
    const state = loadSuperAdminState();
    const {
      title,
      skillType,
      sessions,
      eventDate,
      startTime,
      endTime,
      creditedHours: manualCreditedHours,
      targetMajor,
      targetYear,
      location,
      academicYear,
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: "กรุณาระบุชื่อกิจกรรมอบรม" });
    }

    let parsedSessions: EventSessionItem[] = [];
    let finalCreditedHours = 0;
    let finalRawHours = 0;
    let finalEventDate = eventDate || new Date().toISOString().slice(0, 10);
    let finalStartTime = startTime || "09:00";
    let finalEndTime = endTime || "16:00";

    if (Array.isArray(sessions) && sessions.length > 0) {
      parsedSessions = sessions.map((s: any, idx: number) => {
        const h = Math.max(1, Math.round(Number(s.hours) || 1));
        const sDate = s.date ? String(s.date).trim() : new Date().toISOString().slice(0, 10);
        const sStart = s.startTime ? String(s.startTime).trim() : "09:00";
        const sEnd = s.endTime ? String(s.endTime).trim() : "16:00";
        const sTitle = s.title && String(s.title).trim() ? String(s.title).trim() : `ช่วงที่ ${idx + 1}`;
        return {
          id: s.id || `SES-${idx + 1}`,
          title: sTitle,
          date: sDate,
          startTime: sStart,
          endTime: sEnd,
          hours: h,
        };
      });

      finalCreditedHours = parsedSessions.reduce((sum, s) => sum + s.hours, 0);
      finalRawHours = finalCreditedHours;

      if (parsedSessions.length === 1) {
        finalEventDate = parsedSessions[0].date;
        finalStartTime = parsedSessions[0].startTime;
        finalEndTime = parsedSessions[0].endTime;
      } else {
        finalEventDate = `${parsedSessions[0].date} ถึง ${parsedSessions[parsedSessions.length - 1].date}`;
        finalStartTime = parsedSessions[0].startTime;
        finalEndTime = parsedSessions[parsedSessions.length - 1].endTime;
      }
    } else {
      if (manualCreditedHours !== undefined && Number(manualCreditedHours) > 0) {
        finalCreditedHours = Math.max(1, Math.round(Number(manualCreditedHours)));
        finalRawHours = finalCreditedHours;
      } else {
        const { rawHours, creditedHours } = calculateEventHours(
          startTime || "09:00",
          endTime || "16:00"
        );
        finalCreditedHours = creditedHours;
        finalRawHours = rawHours;
      }
      parsedSessions = [
        {
          id: "SES-1",
          title: "ช่วงที่ 1",
          date: finalEventDate,
          startTime: finalStartTime,
          endTime: finalEndTime,
          hours: finalCreditedHours,
        },
      ];
    }

    const newEvent = {
      id: `EVT-${Date.now().toString().slice(-6)}`,
      title: String(title).trim(),
      skillType: (skillType === "HARD" ? "HARD" : "SOFT") as "SOFT" | "HARD",
      eventDate: finalEventDate,
      startTime: finalStartTime,
      endTime: finalEndTime,
      rawHours: finalRawHours,
      creditedHours: finalCreditedHours,
      targetMajor: targetMajor || "ALL",
      targetYear: targetYear || "ALL",
      location: location || "คณะเทคโนโลยีสารสนเทศและการสื่อสาร ม.พะเยา",
      academicYear: academicYear || state.academicConfig.currentAcademicYear,
      createdBy: req.session?.user?.username || "พี่จอม (Super Admin)",
      createdAt: new Date().toISOString(),
      sessions: parsedSessions,
      checkIns: [],
    };

    state.trainingEvents.unshift(newEvent);
    saveSuperAdminState(state);

    const sessionSummary = parsedSessions.length > 1
      ? `จำนวน ${parsedSessions.length} ช่วงเวลา รวม ${finalCreditedHours} ชม.`
      : `${finalCreditedHours} ชม.`;

    res.json({
      success: true,
      message: `สร้างกิจกรรม "${newEvent.title}" สำเร็จ (${sessionSummary})`,
      event: newEvent,
    });
  } catch (err) {
    console.error("POST /api/admin/super-admin/events error:", err);
    res.status(500).json({ success: false, message: "สร้างกิจกรรมอบรมไม่สำเร็จ" });
  }
});

// 9.4 ลบกิจกรรมอบรม
router.delete("/super-admin/events/:eventId", async (req: Request, res: Response) => {
  try {
    const state = loadSuperAdminState();
    const { eventId } = req.params;
    state.trainingEvents = state.trainingEvents.filter((e) => e.id !== eventId);
    saveSuperAdminState(state);
    res.json({ success: true, message: "ลบกิจกรรมอบรมเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("DELETE /api/admin/super-admin/events error:", err);
    res.status(500).json({ success: false, message: "ลบกิจกรรมไม่สำเร็จ" });
  }
});

// 9.45 พรีวิวการนำเข้าไฟล์ Excel / CSV สำหรับบันทึก Check-in กิจกรรมอบรม (SCRUM-63)
router.post(
  "/super-admin/events/:eventId/checkin-import-preview",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({
          success: false,
          message: "กรุณาเลือกไฟล์ Excel (.xlsx, .xls) หรือ .csv",
        });
      }

      const state = loadSuperAdminState();
      const { eventId } = req.params;
      const sessionId = req.body.sessionId || "ALL";

      const event = state.trainingEvents.find((e) => e.id === eventId);
      if (!event) {
        return res.status(404).json({ success: false, message: "ไม่พบกิจกรรมอบรมนี้" });
      }

      if (!event.sessions || event.sessions.length === 0) {
        event.sessions = [
          {
            id: "SES-1",
            title: "ทั้งกิจกรรม",
            date: event.eventDate,
            startTime: event.startTime,
            endTime: event.endTime,
            hours: event.creditedHours,
          },
        ];
      }

      const targetSessionId =
        sessionId || (event.sessions.length === 1 ? event.sessions[0].id : "ALL");
      const targetSession = event.sessions.find((s) => s.id === targetSessionId);
      let creditedHoursForCheckIn = event.creditedHours;
      let sessionTitleForCheckIn = "ทั้งกิจกรรม";

      if (targetSessionId !== "ALL" && targetSession) {
        creditedHoursForCheckIn = targetSession.hours;
        sessionTitleForCheckIn = `${targetSession.title} (${targetSession.date})`;
      }

      const extractedRows = parseCheckInSpreadsheet(req.file.buffer);
      if (extractedRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "ไม่พบรหัสนิสิตในไฟล์ที่อัปโหลด กรุณาตรวจสอบว่าในไฟล์มีคอลัมน์รหัสนิสิต (ตัวเลข 8 หลัก)",
        });
      }

      const codes = extractedRows.map((r) => r.studentCode);
      const matchedStudents = await prisma.student.findMany({
        where: { studentCode: { in: codes } },
      });
      const studentMap = new Map(matchedStudents.map((s) => [s.studentCode, s]));

      let readyCount = 0;
      let duplicateCount = 0;
      let notFoundCount = 0;
      const readyCodes: string[] = [];

      const items = extractedRows.map((row) => {
        const code = row.studentCode;
        const dbStudent = studentMap.get(code);

        const alreadyCheckedIn = (event.checkIns || []).some((c) => {
          if (c.studentCode !== code) return false;
          if (targetSessionId === "ALL") return true;
          return c.sessionId === targetSessionId || c.sessionId === "ALL";
        });

        if (alreadyCheckedIn) {
          duplicateCount++;
          return {
            studentCode: code,
            nameTh: dbStudent?.nameTh || row.hintName || "-",
            major: dbStudent?.major || row.hintMajor || "-",
            year: dbStudent?.year || null,
            status: "DUPLICATE" as const,
            rowNumber: row.rowNumber,
          };
        }

        if (!dbStudent) {
          notFoundCount++;
          return {
            studentCode: code,
            nameTh: row.hintName ? `(จากไฟล์: ${row.hintName})` : "(ไม่พบชื่อในระบบ)",
            major: row.hintMajor || "-",
            year: null,
            status: "NOT_FOUND" as const,
            rowNumber: row.rowNumber,
          };
        }

        readyCount++;
        readyCodes.push(code);
        return {
          studentCode: code,
          nameTh: dbStudent.nameTh || row.hintName || "-",
          major: dbStudent.major || "วิศวกรรมซอฟต์แวร์",
          year: dbStudent.year || null,
          status: "READY" as const,
          rowNumber: row.rowNumber,
        };
      });

      res.json({
        success: true,
        eventInfo: {
          id: event.id,
          title: event.title,
          skillType: event.skillType,
          sessionId: targetSessionId,
          sessionTitle: sessionTitleForCheckIn,
          creditedHours: creditedHoursForCheckIn,
        },
        summary: {
          totalCount: items.length,
          readyCount,
          duplicateCount,
          notFoundCount,
        },
        items,
        readyCodes,
      });
    } catch (err: any) {
      console.error("POST /api/admin/super-admin/events/:eventId/checkin-import-preview error:", err);
      res.status(400).json({
        success: false,
        message: err.message || "เกิดข้อผิดพลาดในการอ่านไฟล์",
      });
    }
  }
);

// 9.5 บันทึก Check-in นิสิตเข้ากิจกรรมด้วยรหัสนิสิต (รองรับการเลือกช่วงเวลา/วันที่ หรือทั้งกิจกรรม ตามแบบที่ 1)
router.post("/super-admin/events/:eventId/checkin", async (req: Request, res: Response) => {
  try {
    const state = loadSuperAdminState();
    const { eventId } = req.params;
    const { studentCodesInput, sessionId } = req.body;

    const event = state.trainingEvents.find((e) => e.id === eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "ไม่พบกิจกรรมอบรมนี้" });
    }

    // กำหนด sessions ถ้ายังไม่มีสำหรับกิจกรรมเก่า
    if (!event.sessions || event.sessions.length === 0) {
      event.sessions = [
        {
          id: "SES-1",
          title: "ทั้งกิจกรรม",
          date: event.eventDate,
          startTime: event.startTime,
          endTime: event.endTime,
          hours: event.creditedHours,
        },
      ];
    }

    const rawText = Array.isArray(studentCodesInput)
      ? studentCodesInput.join("\n")
      : String(studentCodesInput || "");
    const codes = Array.from(
      new Set(
        rawText
          .split(/[\s,;,\n\r\t]+/)
          .map((c) => c.trim())
          .filter((c) => c.length >= 4)
      )
    );

    if (codes.length === 0) {
      return res.status(400).json({
        success: false,
        message: "กรุณากรอกหรือวางรหัสนิสิตอย่างน้อย 1 รหัส",
      });
    }

    // ตรวจสอบ target session ที่เลือก Check-in
    const targetSessionId = sessionId || (event.sessions.length === 1 ? event.sessions[0].id : "ALL");
    let targetSession = event.sessions.find((s) => s.id === targetSessionId);
    let creditedHoursForCheckIn = event.creditedHours;
    let sessionTitleForCheckIn = "ทั้งกิจกรรม";
    let sessionNoteDate = `${event.eventDate} (${event.startTime}-${event.endTime} น.)`;

    if (targetSessionId !== "ALL" && targetSession) {
      creditedHoursForCheckIn = targetSession.hours;
      sessionTitleForCheckIn = `${targetSession.title} (${targetSession.date})`;
      sessionNoteDate = `${targetSession.date} (${targetSession.startTime}-${targetSession.endTime} น.)`;
    }

    const matchedStudents = await prisma.student.findMany({
      where: { studentCode: { in: codes } },
    });
    const studentMap = new Map(matchedStudents.map((s) => [s.studentCode, s]));

    let addedCount = 0;
    let duplicateCount = 0;
    const notFoundCodes: string[] = [];
    const checkedInDetails: Array<{
      studentCode: string;
      nameTh: string;
      major: string;
      hours: number;
      sessionTitle: string;
    }> = [];

    for (const code of codes) {
      // ตรวจสอบการ Check-in ซ้ำ:
      // - ถ้าเช็คอินช่วงเฉพาะ: ป้องกันไม่ให้ซ้ำในรอบช่วงเดิม หรือเคยเช็คอิน "ALL" แล้ว
      // - ถ้าเช็คอิน "ALL": ป้องกันถ้าเคยเช็คอินแล้ว
      const alreadyCheckedIn = event.checkIns.some((c) => {
        if (c.studentCode !== code) return false;
        if (targetSessionId === "ALL") return true;
        return c.sessionId === targetSessionId || c.sessionId === "ALL";
      });

      if (alreadyCheckedIn) {
        duplicateCount++;
        continue;
      }

      const dbStudent = studentMap.get(code);
      if (!dbStudent) {
        notFoundCodes.push(code);
        continue;
      }

      // บันทึกชั่วโมงอบรมเข้าตาราง TrainingRecord จริงในฐานข้อมูลพร้อมสถานะ APPROVED ทันที
      const record = await prisma.trainingRecord.create({
        data: {
          studentId: dbStudent.id,
          title: `[Check-in กิจกรรมคณะ] ${event.title} - ${sessionTitleForCheckIn}`,
          skillType: event.skillType,
          hours: creditedHoursForCheckIn,
          academicYear: event.academicYear,
          source: "STAFF_IMPORT",
          status: "APPROVED",
          note: `บันทึก Check-in หน้างาน (${sessionTitleForCheckIn}) โดยพี่จอม เมื่อวันที่ ${sessionNoteDate}`,
          reviewedById: req.session?.user?.id || null,
          reviewedAt: new Date(),
        },
      });

      const checkInItem: EventCheckInItem = {
        studentCode: dbStudent.studentCode,
        nameTh: dbStudent.nameTh,
        major: dbStudent.major || "วิศวกรรมซอฟต์แวร์",
        checkedInAt: new Date().toISOString(),
        trainingRecordId: record.id,
        sessionId: targetSessionId,
        sessionTitle: sessionTitleForCheckIn,
        creditedHours: creditedHoursForCheckIn,
      };

      event.checkIns.unshift(checkInItem);
      checkedInDetails.push({
        studentCode: dbStudent.studentCode,
        nameTh: dbStudent.nameTh,
        major: checkInItem.major,
        hours: creditedHoursForCheckIn,
        sessionTitle: sessionTitleForCheckIn,
      });
      addedCount++;
    }

    saveSuperAdminState(state);

    res.json({
      success: true,
      message: `บันทึก Check-in สำเร็จ ${addedCount} คน [${sessionTitleForCheckIn}] (+${creditedHoursForCheckIn} ชม. ${event.skillType} Skill เข้าแดชบอร์ดนิสิตทันที)`,
      addedCount,
      duplicateCount,
      notFoundCodes,
      checkedInDetails,
      event,
    });
  } catch (err) {
    console.error("POST /api/admin/super-admin/events/:eventId/checkin error:", err);
    res.status(500).json({ success: false, message: "บันทึก Check-in ไม่สำเร็จ" });
  }
});

// [DELETE ALL / FILTERED Check-in] ลบนิสิตทั้งหมดในกิจกรรม หรือเฉพาะช่วง/สาขา/ชั้นปีที่กำหนด พร้อมหักชั่วโมงคืน
router.delete("/super-admin/events/:eventId/checkin-all", async (req: Request, res: Response) => {
  try {
    const state = loadSuperAdminState();
    const eventId = String(req.params.eventId);
    const major = req.query.major ? String(req.query.major) : "ALL";
    const year = req.query.year ? String(req.query.year) : "ALL";
    const sessionId = req.query.sessionId ? String(req.query.sessionId) : "ALL";

    const event = state.trainingEvents.find((e) => e.id === eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "ไม่พบกิจกรรมอบรมนี้" });
    }

    // หานิสิตที่จะลบ (ทั้งหมด หรือ เฉพาะช่วง/สาขา/ชั้นปีที่กรอง)
    const targetsToDelete = event.checkIns.filter((c) => {
      if (sessionId && sessionId !== "ALL" && c.sessionId !== sessionId) {
        return false;
      }
      if (major && major !== "ALL" && c.major !== major) {
        return false;
      }
      if (year && year !== "ALL") {
        const y = c.studentCode ? c.studentCode.substring(0, 2) : "";
        if (y !== year) return false;
      }
      return true;
    });

    if (targetsToDelete.length === 0) {
      return res.status(400).json({ success: false, message: "ไม่พบนิสิตที่ตรงกับเงื่อนไขที่จะลบ" });
    }

    // 1. ดึง recordId ทั้งหมดที่จะลบออกจาก Neon DB
    const recordIdsToDelete = targetsToDelete
      .map((c) => c.trainingRecordId)
      .filter((id): id is number => typeof id === "number");

    if (recordIdsToDelete.length > 0) {
      await prisma.trainingRecord.deleteMany({
        where: { id: { in: recordIdsToDelete } },
      });
    }

    // สำหรับรายการที่ fallback: ลบตาม studentCode + event.title
    const targetStudentCodes = targetsToDelete.map((c) => c.studentCode);
    const matchedStudents = await prisma.student.findMany({
      where: { studentCode: { in: targetStudentCodes } },
      select: { id: true },
    });
    const studentIds = matchedStudents.map((s) => s.id);
    if (studentIds.length > 0) {
      await prisma.trainingRecord.deleteMany({
        where: {
          studentId: { in: studentIds },
          title: { contains: event.title },
        },
      });
    }

    // 2. ลบออกจากอาเรย์ event.checkIns
    const targetItemSet = new Set(targetsToDelete);
    event.checkIns = event.checkIns.filter((c) => !targetItemSet.has(c));

    saveSuperAdminState(state);

    const descParts: string[] = [];
    if (sessionId && sessionId !== "ALL") descParts.push(`ช่วง ${sessionId}`);
    if (major && major !== "ALL") descParts.push(`สาขา ${major}`);
    if (year && year !== "ALL") descParts.push(`ปี ${year}`);
    const scopeDesc = descParts.length > 0 ? ` (${descParts.join(", ")})` : "";

    res.json({
      success: true,
      message: `ยกเลิก Check-in นิสิต${scopeDesc} สำเร็จ ${targetsToDelete.length} รายการ (หักชั่วโมงคืนเรียบร้อย)`,
      deletedCount: targetsToDelete.length,
      event,
    });
  } catch (err) {
    console.error("DELETE /api/admin/super-admin/events/:eventId/checkin-all error:", err);
    res.status(500).json({ success: false, message: "ยกเลิก Check-in ทั้งหมดไม่สำเร็จ" });
  }
});

// [DELETE Check-in] ลบนิสิตออกจาก Check-in กิจกรรมอบรม และหักชั่วโมงคืนทันที
router.delete("/super-admin/events/:eventId/checkin/:studentCode", async (req: Request, res: Response) => {
  try {
    const state = loadSuperAdminState();
    const eventId = String(req.params.eventId);
    const studentCode = String(req.params.studentCode);
    const trainingRecordId = req.query.trainingRecordId ? Number(req.query.trainingRecordId) : undefined;
    const sessionId = req.query.sessionId ? String(req.query.sessionId) : undefined;

    const event = state.trainingEvents.find((e) => e.id === eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: "ไม่พบกิจกรรมอบรมนี้" });
    }

    let checkInIdx = -1;
    if (trainingRecordId) {
      checkInIdx = event.checkIns.findIndex(
        (c) => c.studentCode === studentCode && c.trainingRecordId === trainingRecordId
      );
    }
    if (checkInIdx === -1 && sessionId) {
      checkInIdx = event.checkIns.findIndex(
        (c) => c.studentCode === studentCode && c.sessionId === sessionId
      );
    }
    if (checkInIdx === -1) {
      checkInIdx = event.checkIns.findIndex((c) => c.studentCode === studentCode);
    }

    if (checkInIdx === -1) {
      return res.status(404).json({ success: false, message: "ไม่พบนิสิตคนนี้ในรายการ Check-in ของกิจกรรมนี้" });
    }

    const checkInItem = event.checkIns[checkInIdx];

    // 1. ลบชั่วโมงอบรมออกจากฐานข้อมูลจริง (PostgreSQL / Neon DB)
    if (checkInItem.trainingRecordId) {
      try {
        await prisma.trainingRecord.delete({
          where: { id: checkInItem.trainingRecordId },
        });
      } catch (dbErr) {
        console.warn("Could not delete training record by id, searching by student and title fallback:", dbErr);
        const student = await prisma.student.findUnique({ where: { studentCode } });
        if (student) {
          await prisma.trainingRecord.deleteMany({
            where: {
              studentId: student.id,
              title: { contains: event.title },
            },
          });
        }
      }
    } else {
      const student = await prisma.student.findUnique({ where: { studentCode } });
      if (student) {
        await prisma.trainingRecord.deleteMany({
          where: {
            studentId: student.id,
            title: { contains: event.title },
          },
        });
      }
    }

    // 2. ลบออกจากอาเรย์ checkIns ใน state
    event.checkIns.splice(checkInIdx, 1);
    saveSuperAdminState(state);

    res.json({
      success: true,
      message: `ยกเลิก Check-in และหักชั่วโมงคืนให้นิสิต ${studentCode} สำเร็จ`,
      event,
    });
  } catch (err) {
    console.error("DELETE /api/admin/super-admin/events/:eventId/checkin error:", err);
    res.status(500).json({ success: false, message: "ยกเลิก Check-in ไม่สำเร็จ" });
  }
});

// 9.6 เพิ่ม / แก้ไขข้อมูลบริษัทในฐานข้อมูลกลาง (Company Master Data)
router.post("/super-admin/companies", async (req: Request, res: Response) => {
  try {
    const state = loadSuperAdminState();
    const {
      id,
      nameTh,
      nameEn,
      province,
      address,
      hrContactName,
      hrPhone,
      hrEmail,
      recommendedPositions,
      status,
    } = req.body;

    if (!nameTh || !String(nameTh).trim()) {
      return res.status(400).json({ success: false, message: "กรุณาระบุชื่อสถานประกอบการ (ภาษาไทย/ชื่อทางการ)" });
    }

    const cleanNameTh = String(nameTh).trim();

    if (id) {
      const existing = state.companyMasterData.find((c) => c.id === id);
      if (!existing) {
        return res.status(404).json({ success: false, message: "ไม่พบข้อมูลบริษัทในระบบ" });
      }
      const oldName = existing.nameTh;
      existing.nameTh = cleanNameTh;
      if (nameEn !== undefined) existing.nameEn = String(nameEn).trim();
      if (province !== undefined) existing.province = String(province).trim();
      if (address !== undefined) existing.address = String(address).trim();
      if (hrContactName !== undefined) existing.hrContactName = String(hrContactName).trim();
      if (hrPhone !== undefined) existing.hrPhone = String(hrPhone).trim();
      if (hrEmail !== undefined) existing.hrEmail = String(hrEmail).trim();
      if (recommendedPositions !== undefined)
        existing.recommendedPositions = String(recommendedPositions).trim();
      if (status) {
        if (status === "PENDING_REVIEW") {
          const isStudentSubmitted = Boolean(
            existing.submittedByStudentCode ||
              existing.submittedByStudentName ||
              String(existing.id || "").startsWith("COMP-NEW-")
          );
          if (!isStudentSubmitted) {
            return res.status(400).json({
              success: false,
              message: "เฉพาะสถานประกอบการที่นิสิตกรอกเพิ่มเข้ามาเท่านั้นที่สามารถส่งกลับไปตารางรออนุมัติได้",
            });
          }
          existing.status = "PENDING_REVIEW";
          delete existing.verifiedAt;
        } else {
          existing.status = status;
        }
      }
      if (status === "VERIFIED" || status === "PARTNER") {
        existing.verifiedAt = new Date().toISOString();
      }

      // หากมีการแก้ชื่อมาตรฐาน ให้อัปเดตชื่อในตาราง Company และ InternshipPlacement ของนิสิตให้ตรงกันอัตโนมัติ
      const normalizeName = (n: string) => n.replace(/\s+/g, "").toLowerCase();
      if (oldName && oldName !== cleanNameTh) {
        await prisma.company.updateMany({
          where: { name: oldName },
          data: { name: cleanNameTh },
        });
        await prisma.internshipPlacement.updateMany({
          where: { companyNameTh: oldName },
          data: { companyNameTh: cleanNameTh },
        });
        if (!Array.isArray(state.dismissedCompanyNames)) {
          state.dismissedCompanyNames = [];
        }
        const oldNorm = normalizeName(oldName);
        if (oldNorm && !state.dismissedCompanyNames.includes(oldNorm)) {
          state.dismissedCompanyNames.push(oldNorm);
        }
      }
      if (Array.isArray(state.dismissedCompanyNames)) {
        const newNorm = normalizeName(cleanNameTh);
        state.dismissedCompanyNames = state.dismissedCompanyNames.filter((n) => n !== newNorm);
      }

      saveSuperAdminState(state);
      return res.json({
        success: true,
        message: `อัปเดตข้อมูลสถานประกอบการ "${cleanNameTh}" ใน Master Data เรียบร้อยแล้ว`,
        company: existing,
      });
    }

    const normalizeName = (n: string) => n.replace(/\s+/g, "").toLowerCase();
    if (Array.isArray(state.dismissedCompanyNames)) {
      const newNorm = normalizeName(cleanNameTh);
      state.dismissedCompanyNames = state.dismissedCompanyNames.filter((n) => n !== newNorm);
    }

    const newCompany = {
      id: `COMP-M${Date.now().toString().slice(-5)}`,
      nameTh: cleanNameTh,
      nameEn: String(nameEn || "-").trim(),
      province: String(province || "กรุงเทพมหานคร").trim(),
      address: String(address || "-").trim(),
      hrContactName: String(hrContactName || "ฝ่ายทรัพยากรบุคคล (HR)").trim(),
      hrPhone: String(hrPhone || "-").trim(),
      hrEmail: String(hrEmail || "-").trim(),
      recommendedPositions: String(recommendedPositions || "Software Developer / IT Support").trim(),
      status: (status || "VERIFIED") as "VERIFIED" | "PARTNER" | "PENDING_REVIEW" | "BLACKLIST",
      createdAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
    };

    state.companyMasterData.unshift(newCompany);
    saveSuperAdminState(state);

    res.json({
      success: true,
      message: `เพิ่ม "${newCompany.nameTh}" เข้าสู่ฐานข้อมูลกลาง (Master Data) เรียบร้อยแล้ว`,
      company: newCompany,
    });
  } catch (err) {
    console.error("POST /api/admin/super-admin/companies error:", err);
    res.status(500).json({ success: false, message: "บันทึกข้อมูลสถานประกอบการไม่สำเร็จ" });
  }
});

// 9.6.0 ดาวน์โหลดไฟล์ตัวอย่างสำหรับนำเข้าสถานประกอบการ
// 9.5.x เรื่องที่นิสิตแจ้งปัญหาการใช้งานระบบ (เมนู "อื่นๆ" → แจ้งปัญหา ของนิสิต)
router.get("/super-admin/issue-reports", (_req: Request, res: Response) => {
  try {
    res.json({ success: true, reports: loadSuperAdminState().issueReports || [] });
  } catch (err) {
    console.error("GET /api/admin/super-admin/issue-reports error:", err);
    res.status(500).json({ success: false, message: "โหลดเรื่องที่แจ้งปัญหาไม่สำเร็จ" });
  }
});

// เปลี่ยนสถานะ + หมายเหตุตอบกลับนิสิต (นิสิตเห็นหมายเหตุนี้ในรายการ "เรื่องที่เคยแจ้ง")
router.post("/super-admin/issue-reports/:id/status", async (req: Request, res: Response) => {
  try {
    const { status, adminNote } = req.body || {};
    if (!isIssueStatus(status)) {
      return res.status(400).json({ success: false, message: "สถานะไม่ถูกต้อง" });
    }
    const state = loadSuperAdminState();
    const report = (state.issueReports || []).find((r) => r.id === req.params.id);
    if (!report) return res.status(404).json({ success: false, message: "ไม่พบเรื่องที่แจ้ง" });
    const prevStatus = report.status;
    const prevNote = report.adminNote;
    report.status = status;
    if (adminNote !== undefined) {
      const note = String(adminNote || "").trim().slice(0, ISSUE_ADMIN_NOTE_MAX);
      report.adminNote = note || undefined;
    }
    report.updatedAt = new Date().toISOString();
    saveSuperAdminStateOrThrow(state);
    // แจ้งเฉพาะเมื่อสถานะหรือหมายเหตุเปลี่ยนจริง (กดบันทึกซ้ำไม่แจ้งซ้ำ)
    if (status !== "OPEN" && (status !== prevStatus || report.adminNote !== prevNote)) {
      await notifyStudents([report.studentId], {
        type: `ISSUE_${status}`,
        category: "issue",
        title: `เรื่อง ${report.id} "${report.title}" — ${ISSUE_STATUS[status]}`,
        message: report.adminNote ? `ข้อความจากเจ้าหน้าที่: ${report.adminNote}` : "ดูรายละเอียดได้ที่หน้าแจ้งปัญหา",
        link: "/report-issue",
        entityType: "IssueReport",
        entityId: report.id,
      });
    }
    res.json({ success: true, message: `อัปเดต ${report.id} เป็น "${ISSUE_STATUS[status]}" แล้ว`, report });
  } catch (err) {
    console.error("POST /api/admin/super-admin/issue-reports/:id/status error:", err);
    res.status(500).json({ success: false, message: "อัปเดตสถานะไม่สำเร็จ" });
  }
});

router.get("/super-admin/companies/import-template", (_req: Request, res: Response) => {
  try {
    const buffer = buildCompanyImportTemplate();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="company_import_template.xlsx"');
    res.send(buffer);
  } catch (err) {
    console.error("GET /api/admin/super-admin/companies/import-template error:", err);
    res.status(500).json({ success: false, message: "สร้างไฟล์ตัวอย่างไม่สำเร็จ" });
  }
});

// 9.6.1 พรีวิวการนำเข้าสถานประกอบการจากไฟล์ Excel / CSV (ยังไม่บันทึก)
router.post("/super-admin/companies/import-preview", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: "กรุณาเลือกไฟล์ Excel (.xlsx, .xls) หรือ .csv" });
    }
    let rows: ImportedCompanyRow[];
    try {
      rows = parseCompanySpreadsheet(req.file.buffer);
    } catch (parseErr: any) {
      return res.status(400).json({ success: false, message: parseErr?.message || "อ่านไฟล์ไม่สำเร็จ" });
    }
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: "ไม่พบรายชื่อสถานประกอบการในไฟล์" });
    }
    if (rows.length > COMPANY_IMPORT_MAX_ROWS) {
      return res.status(400).json({
        success: false,
        message: `นำเข้าได้ครั้งละไม่เกิน ${COMPANY_IMPORT_MAX_ROWS} รายการ (ไฟล์นี้มี ${rows.length} รายการ)`,
      });
    }

    const state = loadSuperAdminState();
    const items = classifyCompanyImport(rows, state.companyMasterData);
    const countOf = (s: string) => items.filter((it) => it.status === s).length;
    res.json({
      success: true,
      items,
      summary: {
        totalCount: items.length,
        readyCount: countOf("READY"),
        existingCount: countOf("EXISTING"),
        duplicateCount: countOf("DUPLICATE_IN_FILE"),
      },
    });
  } catch (err) {
    console.error("POST /api/admin/super-admin/companies/import-preview error:", err);
    res.status(500).json({ success: false, message: "อ่านไฟล์สถานประกอบการไม่สำเร็จ" });
  }
});

// 9.6.1b ยืนยันนำเข้าสถานประกอบการ → เพิ่มเฉพาะรายการใหม่ ด้วยสถานะ "คณะ ICT เป็นผู้เพิ่ม" (PARTNER)
// client ส่งไฟล์เดิมมาอีกครั้ง (multipart) แทนการส่ง JSON รายการ เพราะ express.json() ทั้งระบบจำกัดไว้ 100kb
router.post("/super-admin/companies/import-confirm", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: "กรุณาเลือกไฟล์ Excel (.xlsx, .xls) หรือ .csv" });
    }
    let rows: ImportedCompanyRow[];
    try {
      rows = parseCompanySpreadsheet(req.file.buffer);
    } catch (parseErr: any) {
      return res.status(400).json({ success: false, message: parseErr?.message || "อ่านไฟล์ไม่สำเร็จ" });
    }
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: "ไม่พบรายชื่อสถานประกอบการในไฟล์" });
    }
    if (rows.length > COMPANY_IMPORT_MAX_ROWS) {
      return res.status(400).json({ success: false, message: `นำเข้าได้ครั้งละไม่เกิน ${COMPANY_IMPORT_MAX_ROWS} รายการ` });
    }

    // ตรวจซ้ำกับ Master Data ล่าสุดอีกครั้ง (กันกดซ้ำ / มีคนเพิ่มระหว่างพรีวิว)
    const state = loadSuperAdminState();
    const ready = classifyCompanyImport(rows, state.companyMasterData).filter((it) => it.status === "READY");
    if (ready.length === 0) {
      return res.status(400).json({ success: false, message: "ทุกรายการมีอยู่ใน Master Data แล้ว ไม่มีรายการใหม่ให้นำเข้า" });
    }

    const now = new Date().toISOString();
    const stamp = Date.now();
    const newCompanies: MasterCompanyRecord[] = ready.map((row, i) => ({
      id: `COMP-M${stamp}-${i + 1}`,
      nameTh: row.nameTh,
      nameEn: row.nameEn || "-",
      province: row.province || "-",
      address: row.address || "-",
      hrContactName: row.hrContactName || "-",
      hrPhone: row.hrPhone || "-",
      hrEmail: row.hrEmail || "-",
      recommendedPositions: row.recommendedPositions || "-",
      status: "PARTNER",
      createdAt: now,
      verifiedAt: now,
    }));

    // ชื่อที่นำเข้าใหม่ไม่ควรค้างอยู่ในรายการชื่อที่ถูกซ่อน
    if (Array.isArray(state.dismissedCompanyNames)) {
      const added = new Set(newCompanies.map((c) => normalizeCompanyName(c.nameTh)));
      state.dismissedCompanyNames = state.dismissedCompanyNames.filter((n) => !added.has(n));
    }
    state.companyMasterData.unshift(...newCompanies);
    // นำเข้าทีละมาก → ต้องรู้ถ้าบันทึกไม่สำเร็จ (saveSuperAdminState กลืน error แล้วจะตอบว่าสำเร็จทั้งที่ไม่ได้บันทึก)
    saveSuperAdminStateOrThrow(state);

    const skipped = rows.length - ready.length;
    res.json({
      success: true,
      addedCount: newCompanies.length,
      skippedCount: skipped,
      message: `นำเข้าสถานประกอบการ ${newCompanies.length} รายการ (สถานะ: คณะ ICT เป็นผู้เพิ่ม) เรียบร้อยแล้ว`
        + (skipped > 0 ? ` — ข้าม ${skipped} รายการที่ซ้ำ` : ""),
    });
  } catch (err) {
    console.error("POST /api/admin/super-admin/companies/import-confirm error:", err);
    res.status(500).json({ success: false, message: "นำเข้าสถานประกอบการไม่สำเร็จ" });
  }
});

// 9.6.2 ลบสถานประกอบการออกจาก Master Data หรือรายการรออนุมัติ
router.delete("/super-admin/companies/:id", async (req: Request, res: Response) => {
  try {
    const state = loadSuperAdminState();
    const { id } = req.params;

    const target = state.companyMasterData.find((c) => c.id === id);
    if (!target) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลสถานประกอบการที่ต้องการลบ" });
    }

    const normalizeName = (n: string) => n.replace(/\s+/g, "").toLowerCase();
    const norm = normalizeName(target.nameTh);
    if (!Array.isArray(state.dismissedCompanyNames)) {
      state.dismissedCompanyNames = [];
    }
    if (norm && !state.dismissedCompanyNames.includes(norm)) {
      state.dismissedCompanyNames.push(norm);
    }

    state.companyMasterData = state.companyMasterData.filter((c) => c.id !== id);
    saveSuperAdminState(state);

    return res.json({
      success: true,
      message: `ลบสถานประกอบการ "${target.nameTh}" ออกจากฐานข้อมูลเรียบร้อยแล้ว`,
    });
  } catch (err) {
    console.error("DELETE /api/admin/super-admin/companies/:id error:", err);
    return res.status(500).json({ success: false, message: "ลบข้อมูลสถานประกอบการไม่สำเร็จ" });
  }
});

// 9.7 พี่จอมกดยืนยัน (Confirm) บริษัทใหม่ที่นิสิตกรอกเข้าสู่ Master Data หรือยุบรวมชื่อซ้ำ (Merge Duplicate)
router.post("/super-admin/companies/:id/confirm", async (req: Request, res: Response) => {
  try {
    const state = loadSuperAdminState();
    const { id } = req.params;
    const { standardizedNameTh, province, address, status, mergeIntoCompanyId } = req.body;

    const target = state.companyMasterData.find((c) => c.id === id);
    if (!target) {
      return res.status(404).json({ success: false, message: "ไม่พบรายการบริษัทนี้" });
    }

    const originalName = target.nameTh;

    // กรณียุบรวมกับบริษัทที่มีอยู่แล้วใน Master Data (แก้ปัญหานิสิตพิมพ์สะกดไม่ตรงกัน)
    if (mergeIntoCompanyId) {
      const masterComp = state.companyMasterData.find((c) => c.id === mergeIntoCompanyId);
      if (!masterComp) {
        return res.status(404).json({ success: false, message: "ไม่พบบริษัทหลักที่ต้องการยุบรวม" });
      }
      await prisma.company.updateMany({
        where: { name: originalName },
        data: { name: masterComp.nameTh },
      });
      await prisma.internshipPlacement.updateMany({
        where: { companyNameTh: originalName },
        data: { companyNameTh: masterComp.nameTh },
      });
      state.companyMasterData = state.companyMasterData.filter((c) => c.id !== id);
      saveSuperAdminState(state);

      return res.json({
        success: true,
        message: `ยุบรวมชื่อ "${originalName}" เข้ากับ "${masterComp.nameTh}" ใน Master Data เรียบร้อยแล้ว`,
      });
    }

    // กรณียืนยันเพิ่มเข้าเป็นบริษัทมาตรฐานใน Master Data
    const finalName = standardizedNameTh ? String(standardizedNameTh).trim() : originalName;
    target.nameTh = finalName;
    if (province) target.province = String(province).trim();
    if (address) target.address = String(address).trim();
    target.status = status === "PARTNER" ? "PARTNER" : "VERIFIED";
    target.verifiedAt = new Date().toISOString();

    if (finalName !== originalName) {
      await prisma.company.updateMany({
        where: { name: originalName },
        data: { name: finalName },
      });
      await prisma.internshipPlacement.updateMany({
        where: { companyNameTh: originalName },
        data: { companyNameTh: finalName },
      });
    }

    saveSuperAdminState(state);
    res.json({
      success: true,
      message: `ยืนยัน (Confirm) "${finalName}" เข้าสู่ฐานข้อมูลสถานประกอบการกลาง (Master Data) เรียบร้อยแล้ว`,
      company: target,
    });
  } catch (err) {
    console.error("POST /api/admin/super-admin/companies/:id/confirm error:", err);
    res.status(500).json({ success: false, message: "ยืนยันข้อมูลบริษัทไม่สำเร็จ" });
  }
});

// 9.8 ออกหนังสือขอความอนุเคราะห์ฝึกงาน (+ แนบแบบฟอร์มใบตอบรับ) รองรับทั้งเดี่ยวและกลุ่มบริษัทเดียวกัน
router.post("/super-admin/documents/issue-request-letter", requireDocumentStaff, async (req: Request, res: Response) => {
  try {
    const state = loadSuperAdminState();
    const { studentIds, docNo, letterDate, interviewDate, companyName } = req.body;

    const ids: number[] = Array.isArray(studentIds)
      ? studentIds.map((n) => Number(n)).filter((n) => !isNaN(n))
      : [Number(studentIds)].filter((n) => !isNaN(n));

    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: "กรุณาเลือกนิสิตอย่างน้อย 1 คน" });
    }

    const students = (
      await prisma.student.findMany({
        where: { id: { in: ids } },
        include: { companies: true, placement: true, internshipWindow: true },
      })
    ).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

    // ฉบับใหม่ออกได้เฉพาะนิสิตที่ยังไม่มีหนังสือ (คนที่ออกแล้วอยู่ในฉบับเดิม — กันการล้างสถานะแบบตอบรับโดยไม่ตั้งใจ)
    const ineligible = findIneligibleForLetter(state, ids, "REQUEST");
    if (ineligible.length > 0) {
      const names = ineligible
        .map((x) => {
          const s = students.find((st) => st.id === x.studentId);
          return `${s?.nameTh || x.studentId} — ${x.reason}`;
        })
        .join("\n");
      return res.status(400).json({ success: false, message: `ออกหนังสือฉบับใหม่ให้นิสิตต่อไปนี้ไม่ได้:\n${names}` });
    }

    const finalDocNo =
      docNo ||
      `${state.academicConfig.defaultDocPrefix}ว ${String(Math.floor(100 + Math.random() * 899))}`;
    const finalDate = letterDate || new Date().toISOString().slice(0, 10);
    const batchId = newBatchId("REQUEST");
    const signatureSnapshot = state.academicConfig.signatureDataUrl || "";

    // ตรวจสอบว่านิสิตทุกคนต้องผ่านการอนุมัติ Checklist จากอาจารย์ที่ปรึกษาก่อน (SCRUM-71)
    for (const s of students) {
      const activeComp = s.companies?.find((c) => c.checklistStatus === "APPROVED");
      if (!activeComp && !s.placement?.companyNameTh) {
        return res.status(400).json({
          success: false,
          message: `นิสิต ${s.nameTh} (${s.studentCode}) ยังไม่ได้รับการอนุมัติ Checklist และข้อมูลสถานประกอบการจากอาจารย์ที่ปรึกษา`,
        });
      }
    }

    for (const s of students) {
      const wfKey = String(s.id);
      const compName =
        companyName ||
        s.placement?.companyNameTh ||
        s.companies?.[0]?.name ||
        "สถานประกอบการ";
      const existingWf = state.docWorkflowMap[wfKey];

      state.docWorkflowMap[wfKey] = {
        studentId: s.id,
        studentCode: s.studentCode,
        companyName: compName,
        interviewDate: interviewDate || existingWf?.interviewDate || "2026-02-15",
        requestLetterIssued: true,
        requestLetterDocNo: finalDocNo,
        requestLetterDate: finalDate,
        requestLetterBatchId: batchId,
        requestLetterSignatureSnapshot: signatureSnapshot,
        companyResponseStatus: "WAITING_RESPONSE",
        companyResponseFileName: "",
        companyResponseFileUrl: "",
        companyResponseUploadedAt: "",
        companyResponseSubmittedByStudent: false,
        companyResponseOcr: undefined,
        advisorAcceptanceStatus: "NONE",
        advisorAcceptanceNote: "",
        advisorAcceptanceReviewedAt: "",
        dispatchLetterIssued: false,
        dispatchLetterDocNo: "",
        dispatchLetterDate: "",
        dispatchLetterSignatureSnapshot: "",
        dispatchLetterBatchId: "",
        isLocked: true,
      };
    }

    // บันทึกฉบับหนังสือ: รายชื่อ ณ วันที่ออก (หน้าหลังของหนังสือ) — ไม่เปลี่ยนแม้มีนิสิตถูกปฏิเสธภายหลัง
    saveLetterBatch(state, {
      batchId,
      type: "REQUEST",
      companyName:
        companyName || students[0]?.placement?.companyNameTh || students[0]?.companies?.[0]?.name || "สถานประกอบการ",
      docNo: finalDocNo,
      letterDate: finalDate,
      interviewDate: interviewDate || "",
      signatureSnapshot,
      ...letterHeaderSnapshot(state.academicConfig, students),
      students: students.map(toBatchStudent),
      issuedAt: new Date().toISOString(),
      issuedBy: req.session.user?.email || "",
    });

    saveSuperAdminStateOrThrow(state);

    await notifyStudents(students.map((s) => s.id), (st) =>
      docWorkflowPayload(st.id, "REQUEST_LETTER_ISSUED", "ออกหนังสือขอความอนุเคราะห์แล้ว",
        `เลขที่ ${finalDocNo} · ${state.docWorkflowMap[String(st.id)]?.companyName || "สถานประกอบการ"} — ดาวน์โหลดหนังสือ แล้วอัปโหลดแบบตอบรับเมื่อบริษัทกรอกแล้ว`, "HIGH")
    );

    res.json({
      success: true,
      message:
        students.length > 1
          ? `ออกหนังสือขอความอนุเคราะห์แบบรวมกลุ่ม (${students.length} คน) เลขที่ ${finalDocNo} พร้อมแบบฟอร์มใบตอบรับเรียบร้อยแล้ว`
          : `ออกหนังสือขอความอนุเคราะห์ เลขที่ ${finalDocNo} พร้อมแบบฟอร์มใบตอบรับเรียบร้อยแล้ว`,
      docNo: finalDocNo,
      letterDate: finalDate,
      batchId,
      studentCount: students.length,
    });
  } catch (err) {
    console.error("POST /api/admin/super-admin/documents/issue-request-letter error:", err);
    res.status(500).json({ success: false, message: "ออกหนังสือขอความอนุเคราะห์ไม่สำเร็จ" });
  }
});

// 9.9 บันทึกผลใบตอบรับจากสถานประกอบการ (รับเข้าฝึกงาน vs ปฏิเสธ -> เก็บเข้า Archive และปลดล็อกให้ยื่นบริษัทใหม่)
router.post("/super-admin/documents/record-company-response", requireDocumentStaff, async (req: Request, res: Response) => {
  try {
    const state = loadSuperAdminState();
    const { studentId, responseStatus, note, fileName } = req.body;
    // ไม่ส่ง/ส่ง studentId ผิดรูปแบบ -> 400 (เดิม Number(undefined) = NaN ทำให้ Prisma error เป็น 500)
    if (!Number.isInteger(Number(studentId)) || Number(studentId) <= 0) {
      return res.status(400).json({ success: false, message: "กรุณาระบุนิสิต" });
    }

    const student = await prisma.student.findUnique({
      where: { id: Number(studentId) },
      include: { companies: true, placement: true },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลนิสิต" });
    }

    const wfKey = String(student.id);
    const activeComp =
      student.companies.find((c) => c.checklistStatus === "APPROVED") || student.companies[0];
    const companyName =
      student.placement?.companyNameTh || activeComp?.name || "สถานประกอบการ";
    const position = student.placement?.position || "นิสิตฝึกงาน / สหกิจศึกษา";
    const prevWf = state.docWorkflowMap[wfKey];

    // BR-41: นิสิตอัปโหลด → อาจารย์ที่ปรึกษาตรวจ → เจ้าหน้าที่ยืนยัน — ยืนยันผลได้หลังอาจารย์อนุมัติแบบตอบรับแล้วเท่านั้น
    const advisorApproved =
      prevWf?.advisorAcceptanceStatus === "APPROVED" || prevWf?.companyResponseStatus === "ADVISOR_APPROVED";
    if (!advisorApproved) {
      const why = !prevWf?.companyResponseFileUrl && !prevWf?.companyResponseSubmittedByStudent
        ? "นิสิตยังไม่ได้อัปโหลดแบบตอบรับ"
        : "อาจารย์ที่ปรึกษายังไม่ได้ตรวจแบบตอบรับ";
      return res.status(400).json({
        success: false,
        message: `ยังยืนยันผลไม่ได้: ${why} (ขั้นตอน: นิสิตอัปโหลด → อาจารย์ที่ปรึกษาตรวจ → เจ้าหน้าที่ยืนยัน)`,
      });
    }

    // กรณีบริษัทส่งแบบตอบรับว่า "ปฏิเสธ" (REJECTED):
    // ย้ายข้อมูลบริษัทเดิมเข้า Archive แบบย่อ และปลดล็อกให้นิสิตยื่น Checklist บริษัทแห่งใหม่ได้ทันที!
    if (responseStatus === "REJECTED") {
      // บันทึก Snapshot ข้อมูล Checklist และเอกสารทั้งหมดเข้าสู่ Archive เพื่อเก็บประวัติไว้ไม่ให้สูญหาย
      const existingAnswers = activeComp
        ? await prisma.companyChecklistAnswer.findMany({
            where: { companyId: activeComp.id },
            include: { checklistItem: true },
          })
        : [];

      state.archivedApplications.unshift({
        id: `ARCH-${Date.now().toString().slice(-6)}`,
        studentId: student.id,
        studentCode: student.studentCode,
        studentName: student.nameTh,
        major: student.major || "วิศวกรรมซอฟต์แวร์",
        companyName,
        position,
        companyAddress: student.placement?.companyAddress || "-",
        province: student.placement?.province || "-",
        contactPersonName: student.placement?.contactPersonName || "-",
        phone: student.placement?.companyPhone1 || "-",
        email: student.placement?.companyEmail || "-",
        reason: "COMPANY_REJECTED",
        note: note || "สถานประกอบการแจ้งปฏิเสธในใบตอบรับ (ปลดล็อกให้ยื่นบริษัทแห่งใหม่แล้ว)",
        // หนังสือขอความอนุเคราะห์ฉบับเดิมยังอยู่ใน letterBatches (รายชื่อเดิมครบ) และนิสิตดาวน์โหลดย้อนหลังได้
        requestLetterBatchId: prevWf?.requestLetterBatchId || "",
        requestLetterDocNo: prevWf?.requestLetterDocNo || "",
        fileName: prevWf?.companyResponseFileName || "",
        fileUrl: prevWf?.companyResponseFileUrl || "",
        ocr: prevWf?.companyResponseOcr || undefined,
        answers: existingAnswers.map((a) => ({
          itemId: a.checklistItemId,
          description: a.checklistItem?.description || "",
          checked: a.checked,
          detail: a.detail || "",
        })),
        archivedAt: new Date().toISOString(),
      });

      // ลบ Company เดิมในตาราง Company เพื่อปลดล็อกให้นิสิตยื่น Checklist บริษัทแห่งใหม่ได้ทีละ 1 แห่ง
      if (activeComp) {
        await prisma.companyChecklistAnswer.deleteMany({
          where: { companyId: activeComp.id },
        });
        await prisma.companySubmission.deleteMany({
          where: { companyId: activeComp.id },
        });
        await prisma.company.delete({
          where: { id: activeComp.id },
        });
      }

      // รีเซ็ตข้อมูลใน InternshipPlacement ของนิสิต เพื่อไม่ให้ค้างชื่อบริษัทเดิม
      if (student.placement) {
        await prisma.internshipPlacement.update({
          where: { id: student.placement.id },
          data: {
            companyNameTh: null,
            position: null,
            companyAddress: null,
            province: null,
            contactPersonName: null,
            contactPersonPosition: null,
            companyPhone1: null,
            companyPhone2: null,
            companyEmail: null,
            status: "REJECTED",
            note: note || "สถานประกอบการปฏิเสธการรับเข้าฝึกงาน (ปลดล็อกให้ยื่นบริษัทใหม่)",
          },
        });
      }

      state.docWorkflowMap[wfKey] = {
        studentId: student.id,
        studentCode: student.studentCode,
        companyName: "รอเลือกบริษัทใหม่ (ปลดล็อกแล้ว)",
        requestLetterIssued: false,
        requestLetterDocNo: "",
        requestLetterDate: "",
        companyResponseStatus: "REJECTED",
        companyResponseNote: note || "บริษัทปฏิเสธ — เก็บประวัติเข้า Archive แล้ว",
        companyResponseFileName: "",
        companyResponseFileUrl: "",
        companyResponseUploadedAt: "",
        companyResponseSubmittedByStudent: false,
        companyResponseOcr: undefined,
        advisorAcceptanceStatus: "NONE",
        companyResponseConfirmedAt: new Date().toISOString(),
        companyResponseConfirmedBy: req.session?.user?.email || req.session?.user?.username || "",
        dispatchLetterIssued: false,
        isLocked: false,
      };

      saveSuperAdminState(state);
      await notifyStudents([student.id], docWorkflowPayload(student.id, "COMPANY_REJECTED", `${companyName} ปฏิเสธการรับเข้าฝึกงาน`,
        withNote("ระบบเก็บเข้าประวัติแล้ว กรุณายื่น Checklist บริษัทแห่งใหม่", note), "HIGH"));
      await notifyAdvisorsOfStudents([student.id], (st) =>
        studentEventPayload(st, { type: "COMPANY_REJECTED", category: "document", priority: "HIGH", entityType: "DocWorkflow", title: `${companyName} ปฏิเสธ ${st.nameTh}`, message: "นิสิตต้องยื่นบริษัทใหม่" })
      );
      return res.json({
        success: true,
        message: `บันทึกผล "บริษัทปฏิเสธ" เรียบร้อยแล้ว ระบบได้ย้าย "${companyName}" เข้าสู่ Archive และปลดล็อกให้ ${student.nameTh} ยื่น Checklist บริษัทแห่งใหม่ได้ทันที`,
      });
    }

    // กรณีบริษัทตอบรับ "รับเข้าฝึกงาน" (ACCEPTED)
    const existingWf = state.docWorkflowMap[wfKey];
    state.docWorkflowMap[wfKey] = {
      ...(existingWf || {}),
      studentId: student.id,
      studentCode: student.studentCode,
      companyName,
      interviewDate: existingWf?.interviewDate || "2026-02-15",
      requestLetterIssued: true,
      requestLetterDocNo:
        existingWf?.requestLetterDocNo || `${state.academicConfig.defaultDocPrefix}ว 0142`,
      requestLetterDate: existingWf?.requestLetterDate || new Date().toISOString().slice(0, 10),
      companyResponseStatus: "ACCEPTED",
      companyResponseFileName:
        fileName || existingWf?.companyResponseFileName || `ใบตอบรับ_${student.studentCode}.pdf`,
      companyResponseUploadedAt: existingWf?.companyResponseUploadedAt || new Date().toISOString(),
      companyResponseNote: note || "สถานประกอบการตอบรับเข้าฝึกงานเรียบร้อยแล้ว",
      companyResponseConfirmedAt: new Date().toISOString(),
      companyResponseConfirmedBy: req.session?.user?.email || req.session?.user?.username || "",
      dispatchLetterIssued: existingWf?.dispatchLetterIssued || false,
      dispatchLetterDocNo: existingWf?.dispatchLetterDocNo,
      dispatchLetterDate: existingWf?.dispatchLetterDate,
      isLocked: true,
    };

    saveSuperAdminState(state);
    await notifyStudents([student.id], docWorkflowPayload(student.id, "COMPANY_ACCEPTED", `${companyName} ตอบรับเข้าฝึกงานแล้ว`, "เจ้าหน้าที่ยืนยันผลแล้ว รอออกหนังสือส่งตัว"));
    res.json({
      success: true,
      message: `ยืนยันผลใบตอบรับ "รับเข้าฝึกงาน" ของ ${student.nameTh} (${companyName}) เรียบร้อยแล้ว พร้อมสำหรับการอนุมัติออกหนังสือส่งตัว`,
    });
  } catch (err) {
    console.error("POST /api/admin/super-admin/documents/record-company-response error:", err);
    res.status(500).json({ success: false, message: "บันทึกผลใบตอบรับไม่สำเร็จ" });
  }
});

// 9.9.1 สแกนแบบตอบรับซ้ำด้วย OCR (กรณี OCR ล่ม/เริ่มทำงานช้าตอนนิสิตอัปโหลด)
router.post("/super-admin/documents/rescan-company-response", requireDocumentStaff, async (req: Request, res: Response) => {
  try {
    const wfKey = String(Number(req.body?.studentId));
    const wf = loadSuperAdminState().docWorkflowMap[wfKey];
    if (!wf?.companyResponseFileUrl) {
      return res.status(400).json({ success: false, message: "นิสิตยังไม่ได้อัปโหลดไฟล์แบบตอบรับ" });
    }
    const { buffer, mimeType } = await fetchFileBuffer(wf.companyResponseFileUrl);
    const ocr = await analyzeAcceptanceForm(
      buffer,
      wf.companyResponseFileName || "acceptance.pdf",
      mimeType,
      wf.companyResponseFileUrl
    );

    const latest = loadSuperAdminState();
    if (latest.docWorkflowMap[wfKey]) {
      latest.docWorkflowMap[wfKey].companyResponseOcr = ocr;
      saveSuperAdminState(latest);
    }
    res.json({ success: true, ocr, message: ocr.status === "DONE" ? "สแกนแบบตอบรับซ้ำเรียบร้อยแล้ว" : ocr.reasons[0] });
  } catch (err: any) {
    console.error("POST /api/admin/super-admin/documents/rescan-company-response error:", err);
    res.status(500).json({ success: false, message: "สแกนซ้ำไม่สำเร็จ: " + (err?.message || err) });
  }
});

// 9.10 พี่จอมอนุมัติและออก "หนังสือส่งตัวนิสิตเข้าฝึกงาน" (Dispatch Letter)
router.post("/super-admin/documents/issue-dispatch-letter", requireDocumentStaff, async (req: Request, res: Response) => {
  try {
    const state = loadSuperAdminState();
    const { studentIds, docNo, letterDate, companyName } = req.body;

    const ids: number[] = Array.isArray(studentIds)
      ? studentIds.map((n) => Number(n)).filter((n) => !isNaN(n))
      : [Number(studentIds)].filter((n) => !isNaN(n));

    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: "กรุณาเลือกนิสิตอย่างน้อย 1 คน" });
    }

    const students = (
      await prisma.student.findMany({
        where: { id: { in: ids } },
        include: { companies: true, placement: true, internshipWindow: true },
      })
    ).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

    // หนังสือส่งตัว: เฉพาะนิสิตที่บริษัทตอบรับแล้ว (ยืนยันผลแบบตอบรับว่า "รับ") และยังไม่ได้ส่งตัว
    const ineligible = findIneligibleForLetter(state, ids, "DISPATCH");
    if (ineligible.length > 0) {
      const names = ineligible
        .map((x) => {
          const s = students.find((st) => st.id === x.studentId);
          return `${s?.nameTh || x.studentId} — ${x.reason}`;
        })
        .join("\n");
      return res.status(400).json({ success: false, message: `ออกหนังสือส่งตัวให้นิสิตต่อไปนี้ไม่ได้:\n${names}` });
    }

    const finalDocNo =
      docNo ||
      `${state.academicConfig.defaultDocPrefix}ว ${String(Math.floor(500 + Math.random() * 499))}`;
    const finalDate = letterDate || new Date().toISOString().slice(0, 10);
    const batchId = newBatchId("DISPATCH");
    const signatureSnapshot = state.academicConfig.signatureDataUrl || "";

    for (const s of students) {
      const wfKey = String(s.id);
      const compName =
        s.placement?.companyNameTh || s.companies?.[0]?.name || "สถานประกอบการ";
      const existingWf = state.docWorkflowMap[wfKey];

      state.docWorkflowMap[wfKey] = {
        ...(existingWf || {}),
        studentId: s.id,
        studentCode: s.studentCode,
        companyName: compName,
        interviewDate: existingWf?.interviewDate || "2026-02-15",
        requestLetterIssued: true,
        requestLetterDocNo:
          existingWf?.requestLetterDocNo || `${state.academicConfig.defaultDocPrefix}ว 0142`,
        requestLetterDate: existingWf?.requestLetterDate || finalDate,
        companyResponseStatus: "ACCEPTED",
        companyResponseFileName:
          existingWf?.companyResponseFileName || `ใบตอบรับ_${s.studentCode}.pdf`,
        dispatchLetterIssued: true,
        dispatchLetterDocNo: finalDocNo,
        dispatchLetterDate: finalDate,
        dispatchLetterSignatureSnapshot: signatureSnapshot,
        dispatchLetterBatchId: batchId,
        isLocked: true,
      };

      // อัปเดตสถานะในตาราง InternshipPlacement & Student ให้เป็น APPROVED / READY
      if (s.placement) {
        await prisma.internshipPlacement.update({
          where: { id: s.placement.id },
          data: {
            status: "APPROVED",
            reviewedById: req.session?.user?.id || null,
            reviewedAt: new Date(),
          },
        });
      } else {
        await prisma.internshipPlacement.create({
          data: {
            studentId: s.id,
            companyId: s.companies?.[0]?.id || null,
            companyNameTh: compName,
            position: "นิสิตฝึกงาน / สหกิจศึกษา",
            status: "APPROVED",
            reviewedById: req.session?.user?.id || null,
            reviewedAt: new Date(),
          },
        });
      }

      await prisma.student.update({
        where: { id: s.id },
        data: { stage: "READY" },
      });
    }

    // บันทึกฉบับหนังสือส่งตัว: รายชื่อนิสิตที่บริษัทตอบรับ ณ วันที่ออก
    saveLetterBatch(state, {
      batchId,
      type: "DISPATCH",
      companyName:
        companyName || students[0]?.placement?.companyNameTh || students[0]?.companies?.[0]?.name || "สถานประกอบการ",
      docNo: finalDocNo,
      letterDate: finalDate,
      signatureSnapshot,
      ...letterHeaderSnapshot(state.academicConfig, students),
      students: students.map(toBatchStudent),
      issuedAt: new Date().toISOString(),
      issuedBy: req.session.user?.email || "",
    });

    saveSuperAdminStateOrThrow(state);

    const dispatchIds = students.map((s) => s.id);
    const dispatchInfo = (id: number) => `เลขที่ ${finalDocNo} · ${state.docWorkflowMap[String(id)]?.companyName || "สถานประกอบการ"}`;
    await notifyStudents(dispatchIds, (st) =>
      docWorkflowPayload(st.id, "DISPATCH_LETTER_ISSUED", "ออกหนังสือส่งตัวเข้าฝึกงานแล้ว", `${dispatchInfo(st.id)} — ดาวน์โหลดได้ที่หน้าจัดการข้อมูลฝึกงาน`, "HIGH")
    );
    const dispatchPayload = (st: StudentRef, priority?: "LOW") =>
      studentEventPayload(st, { type: "DISPATCH_LETTER_ISSUED", category: "document", priority, entityType: "DocWorkflow", title: `${st.nameTh} ได้รับหนังสือส่งตัวแล้ว`, message: dispatchInfo(st.id) });
    await notifyAdvisorsOfStudents(dispatchIds, (st) => dispatchPayload(st));
    await notifyCourseAdminsForStudents(dispatchIds, (st) => dispatchPayload(st, "LOW"));

    res.json({
      success: true,
      message: `อนุมัติและออกหนังสือส่งตัวนิสิตเข้าฝึกงาน เลขที่ ${finalDocNo} จำนวน ${students.length} คน เรียบร้อยแล้ว`,
      docNo: finalDocNo,
      letterDate: finalDate,
      batchId,
    });
  } catch (err) {
    console.error("POST /api/admin/super-admin/documents/issue-dispatch-letter error:", err);
    res.status(500).json({ success: false, message: "ออกหนังสือส่งตัวไม่สำเร็จ" });
  }
});

// 9.11 ปลดล็อกการออกหนังสือซ้ำกรณีฉุกเฉิน (Executive / Super Admin Override)
router.post("/super-admin/documents/toggle-lock", requireDocumentStaff, async (req: Request, res: Response) => {
  try {
    const state = loadSuperAdminState();
    const { studentId } = req.body;
    const wfKey = String(studentId);
    const wf = state.docWorkflowMap[wfKey];
    if (!wf) {
      return res.status(404).json({ success: false, message: "ไม่พบประวัติการออกหนังสือของนิสิตคนนี้" });
    }
    wf.isLocked = !wf.isLocked;
    wf.unlockedByAdmin = !wf.isLocked;
    saveSuperAdminState(state);
    if (!wf.isLocked) {
      await notifyStudents([Number(studentId)], docWorkflowPayload(Number(studentId), "DOC_WORKFLOW_UNLOCKED",
        "เจ้าหน้าที่ปลดล็อกเอกสารฝึกงานของคุณ", "แก้ไขข้อมูลบริษัทหรือขอออกหนังสือใหม่ได้ (กรณีพิเศษ)"));
    }
    res.json({
      success: true,
      message: wf.isLocked
        ? "ล็อกสถานะการออกหนังสือแล้ว"
        : "ปลดล็อกให้นิสิตสามารถแก้ไขบริษัท/ออกหนังสือใหม่กรณีฉุกเฉินเรียบร้อยแล้ว",
      workflow: wf,
    });
  } catch (err) {
    console.error("POST /api/admin/super-admin/documents/toggle-lock error:", err);
    res.status(500).json({ success: false, message: "สลับสถานะล็อกไม่สำเร็จ" });
  }
});


// =====================================================================
// 10. แบบฟอร์มการเลือกสถานประกอบการแยกตามสาขา (เดิม "ตั้งค่า Checklist บริษัท")
// ตาราง ChecklistVersion = 1 แบบฟอร์ม · majorCodes = สาขาที่ใช้ (ว่าง = แบบฟอร์มกลาง) — กติกาใน src/utils/checklistForms.ts
// =====================================================================

// แก้แบบฟอร์มได้เฉพาะเจ้าหน้าที่ฝ่ายฝึกงาน (Staff) — อาจารย์ประจำวิชาดูได้อย่างเดียว (ยืนยัน 24 พ.ย. 2569)
const requireSuperAdminStaff = requireStaffOnly("เฉพาะเจ้าหน้าที่ฝ่ายฝึกงาน (Staff) เท่านั้นที่แก้แบบฟอร์มการเลือกสถานประกอบการได้");

// ดูแบบฟอร์มได้: เจ้าหน้าที่ + อาจารย์ประจำวิชา
function requireChecklistViewer(req: Request, res: Response, next: Function) {
  const ok = Boolean(
    req.staff?.isStaff || req.staff?.isCourseAdmin || req.session.user?.role === "STAFF" || req.session.user?.role === "ADMIN"
  );
  if (!ok) {
    return res.status(403).json({ success: false, message: "ไม่มีสิทธิ์ดูแบบฟอร์มการเลือกสถานประกอบการ" });
  }
  next();
}

/** ใช้แผนเปิดใช้งาน/ย้ายสาขา (เลิกใช้แบบฟอร์มที่ไม่เหลือสาขา + เอาสาขาที่ซ้ำออกจากแบบฟอร์มอื่น) */
function checklistPlanOps(plan: ReturnType<typeof planChecklistActivation>) {
  return [
    ...(plan.archive.length
      ? [prisma.checklistVersion.updateMany({ where: { id: { in: plan.archive } }, data: { status: "ARCHIVED" } })]
      : []),
    ...plan.updateMajors.map((u) => prisma.checklistVersion.update({ where: { id: u.id }, data: { majorCodes: u.majorCodes } })),
  ];
}

function checklistPlanMessage(plan: ReturnType<typeof planChecklistActivation>, names: Map<number, string>): string {
  const moved = plan.moved.map((m) => `ย้าย ${m.codes.join(", ")} ออกจาก "${names.get(m.fromId) || m.fromId}"`);
  const archived = plan.archive.map((id) => `"${names.get(id) || id}" เลิกใช้`);
  return [...moved, ...archived].join(" · ");
}

// 10.1 ดึงรายการแบบฟอร์มทั้งหมด + ตารางสาขา -> แบบฟอร์มที่ใช้อยู่
router.get("/checklist-versions", requireChecklistViewer, async (req: Request, res: Response) => {
  try {
    const versions = await prisma.checklistVersion.findMany({
      orderBy: [{ status: "asc" }, { id: "desc" }],
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            items: {
              orderBy: { order: "asc" },
              include: {
                _count: { select: { answers: true } },
              },
            },
          },
        },
        _count: {
          select: { companies: true },
        },
      },
    });

    res.json({
      success: true,
      versions,
      coverage: checklistCoverage(versions),
      canEdit: isStaffRequest(req),
    });
  } catch (err) {
    console.error("GET /api/admin/checklist-versions error:", err);
    res.status(500).json({ success: false, message: "ดึงรายการเวอร์ชัน Checklist ไม่สำเร็จ" });
  }
});

// 10.2 สร้างเวอร์ชันใหม่ (หรือคัดลอกจากเวอร์ชันเดิม)
router.post("/checklist-versions", requireSuperAdminStaff, async (req: Request, res: Response) => {
  try {
    const { versionName, description, cloneFromVersionId } = req.body;
    if (!versionName || !String(versionName).trim()) {
      return res.status(400).json({ success: false, message: "กรุณาระบุชื่อแบบฟอร์ม เช่น แบบฟอร์ม SE ปีการศึกษา 2569" });
    }
    const majors = normalizeFormMajorCodes(req.body.majorCodes);
    if (majors.error) return res.status(400).json({ success: false, message: majors.error });

    const cleanName = String(versionName).trim();
    const cleanDesc = description ? String(description).trim() : null;

    // สร้างแบบฟอร์มใหม่ (ฉบับร่าง — กด "เปิดใช้งาน" แล้วจึงมีผลกับสาขาที่เลือก)
    const newVersion = await prisma.checklistVersion.create({
      data: {
        versionName: cleanName,
        description: cleanDesc,
        status: "DRAFT",
        majorCodes: majors.codes,
      },
    });

    // หากเลือกคัดลอกจากเวอร์ชันเดิม
    if (cloneFromVersionId) {
      const sourceVersion = await prisma.checklistVersion.findUnique({
        where: { id: parseInt(String(cloneFromVersionId), 10) },
        include: {
          sections: {
            include: { items: true },
            orderBy: { order: "asc" },
          },
        },
      });

      if (sourceVersion && sourceVersion.sections.length > 0) {
        for (const sec of sourceVersion.sections) {
          await prisma.checklistSection.create({
            data: {
              versionId: newVersion.id,
              title: sec.title,
              order: sec.order,
              items: {
                create: sec.items.map((it) => ({
                  order: it.order,
                  description: it.description,
                  placeholder: it.placeholder,
                  isRequired: it.isRequired,
                  isActive: it.isActive,
                })),
              },
            },
          });
        }
      }
    }

    res.json({
      success: true,
      message: `สร้างแบบฟอร์ม ${newVersion.versionName} (ฉบับร่าง) สำเร็จ — กด "เปิดใช้งาน" เพื่อให้มีผลกับ ${formMajorsLabel(newVersion)}`,
      version: newVersion,
    });
  } catch (err) {
    console.error("POST /api/admin/checklist-versions error:", err);
    res.status(500).json({ success: false, message: "สร้างเวอร์ชันใหม่ไม่สำเร็จ" });
  }
});

// 10.3 เปิดใช้งานเวอร์ชัน (Activate Version)
router.put("/checklist-versions/:id/activate", requireSuperAdminStaff, async (req: Request, res: Response) => {
  try {
    const versionId = parseInt(String(req.params.id), 10);
    const target = await prisma.checklistVersion.findUnique({
      where: { id: versionId },
      include: { sections: { include: { items: true } } },
    });

    if (!target) {
      return res.status(404).json({ success: false, message: "ไม่พบเวอร์ชันที่ต้องการเปิดใช้งาน" });
    }

    if (target.sections.length === 0) {
      return res.status(400).json({ success: false, message: "ไม่สามารถเปิดใช้งานเวอร์ชันที่ไม่มีหมวดคำถามได้" });
    }

    // แยกตามสาขา: เอาสาขาที่ซ้ำออกจากแบบฟอร์มอื่นที่เปิดใช้อยู่ (ไม่เหลือสาขา = เลิกใช้) / แบบฟอร์มกลางชุดเก่า = เลิกใช้
    const all = await prisma.checklistVersion.findMany({ select: { id: true, status: true, majorCodes: true, versionName: true } });
    const plan = planChecklistActivation(all, versionId, target.majorCodes);
    const [updated] = await prisma.$transaction([
      prisma.checklistVersion.update({ where: { id: versionId }, data: { status: "ACTIVE" } }),
      ...checklistPlanOps(plan),
    ]);
    const changes = checklistPlanMessage(plan, new Map(all.map((v) => [v.id, v.versionName])));

    res.json({
      success: true,
      message:
        `เปิดใช้งาน "${updated.versionName}" สำหรับ ${formMajorsLabel(updated)} แล้ว — นิสิตที่ยื่นใหม่จะใช้แบบฟอร์มนี้ (Checklist ที่ยื่นไปแล้วไม่เปลี่ยน)` +
        (changes ? ` · ${changes}` : ""),
      version: updated,
    });
  } catch (err) {
    console.error("PUT /api/admin/checklist-versions/:id/activate error:", err);
    res.status(500).json({ success: false, message: "เปิดใช้งานเวอร์ชันไม่สำเร็จ" });
  }
});

// 10.4 แก้ไขข้อมูลเวอร์ชัน (ชื่อ/คำอธิบาย)
router.put("/checklist-versions/:id", requireSuperAdminStaff, async (req: Request, res: Response) => {
  try {
    const versionId = parseInt(String(req.params.id), 10);
    const { versionName, description } = req.body;
    const current = await prisma.checklistVersion.findUnique({ where: { id: versionId } });
    if (!current) return res.status(404).json({ success: false, message: "ไม่พบแบบฟอร์ม" });

    // เปลี่ยนสาขา (ส่ง majorCodes มาเท่านั้น) — แบบฟอร์มที่เปิดใช้อยู่ต้องคงประเภท กลาง/เฉพาะสาขา และย้ายสาขาที่ซ้ำจากแบบฟอร์มอื่น
    let majorCodes: string[] | undefined;
    let plan: ReturnType<typeof planChecklistActivation> | null = null;
    let names = new Map<number, string>();
    if (req.body.majorCodes !== undefined) {
      const majors = normalizeFormMajorCodes(req.body.majorCodes);
      if (majors.error) return res.status(400).json({ success: false, message: majors.error });
      const err = activeFormMajorsChangeError(current, majors.codes);
      if (err) return res.status(400).json({ success: false, message: err });
      majorCodes = majors.codes;
      if (current.status === "ACTIVE") {
        const all = await prisma.checklistVersion.findMany({ select: { id: true, status: true, majorCodes: true, versionName: true } });
        plan = planChecklistActivation(all, versionId, majors.codes);
        names = new Map(all.map((v) => [v.id, v.versionName]));
      }
    }

    const [updated] = await prisma.$transaction([
      prisma.checklistVersion.update({
        where: { id: versionId },
        data: {
          versionName: versionName ? String(versionName).trim() : undefined,
          description: description !== undefined ? (description ? String(description).trim() : null) : undefined,
          majorCodes,
        },
      }),
      ...(plan ? checklistPlanOps(plan) : []),
    ]);
    const changes = plan ? checklistPlanMessage(plan, names) : "";

    res.json({ success: true, message: "แก้ไขข้อมูลแบบฟอร์มเรียบร้อยแล้ว" + (changes ? ` · ${changes}` : ""), version: updated });
  } catch (err) {
    console.error("PUT /api/admin/checklist-versions/:id error:", err);
    res.status(500).json({ success: false, message: "แก้ไขข้อมูลเวอร์ชันไม่สำเร็จ" });
  }
});

// 10.5 ลบเวอร์ชัน (เฉพาะ DRAFT และไม่มีบริษัทใช้อยู่)
router.delete("/checklist-versions/:id", requireSuperAdminStaff, async (req: Request, res: Response) => {
  try {
    const versionId = parseInt(String(req.params.id), 10);
    const target = await prisma.checklistVersion.findUnique({
      where: { id: versionId },
      include: {
        _count: { select: { companies: true } },
      },
    });

    if (!target) {
      return res.status(404).json({ success: false, message: "ไม่พบเวอร์ชันที่ต้องการลบ" });
    }

    if (target.status === "ACTIVE") {
      return res.status(400).json({ success: false, message: "ไม่สามารถลบเวอร์ชันที่กำลังเปิดใช้งานอยู่ได้" });
    }

    if (target._count.companies > 0) {
      return res.status(400).json({
        success: false,
        message: `ไม่สามารถลบเวอร์ชันนี้ได้เนื่องจากมีประวัตินิสิต ${target._count.companies} บริษัท ผูกอยู่กับเวอร์ชันนี้`,
      });
    }

    // ลบ Sections และ Items ที่ผูกอยู่ (Cascade)
    await prisma.checklistItem.deleteMany({
      where: { section: { versionId } },
    });
    await prisma.checklistSection.deleteMany({
      where: { versionId },
    });
    await prisma.checklistVersion.delete({
      where: { id: versionId },
    });

    res.json({ success: true, message: `ลบเวอร์ชัน ${target.versionName} เรียบร้อยแล้ว` });
  } catch (err) {
    console.error("DELETE /api/admin/checklist-versions/:id error:", err);
    res.status(500).json({ success: false, message: "ลบเวอร์ชันไม่สำเร็จ" });
  }
});

// 10.6 เพิ่มหมวดหลักใหม่ (Checklist Section)
router.post("/checklist-sections", requireSuperAdminStaff, async (req: Request, res: Response) => {
  try {
    const { versionId, title } = req.body;
    if (!versionId || !title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: "กรุณาระบุชื่อหมวดหลัก" });
    }

    const vId = parseInt(versionId, 10);
    const maxOrderSec = await prisma.checklistSection.findFirst({
      where: { versionId: vId },
      orderBy: { order: "desc" },
    });
    const newOrder = maxOrderSec ? maxOrderSec.order + 1 : 1;

    const section = await prisma.checklistSection.create({
      data: {
        versionId: vId,
        title: String(title).trim(),
        order: newOrder,
      },
    });

    res.json({ success: true, message: "เพิ่มหมวดหลักเรียบร้อยแล้ว", section });
  } catch (err) {
    console.error("POST /api/admin/checklist-sections error:", err);
    res.status(500).json({ success: false, message: "เพิ่มหมวดหลักไม่สำเร็จ" });
  }
});

// 10.7 แก้ไขหมวดหลัก (Checklist Section)
router.put("/checklist-sections/:id", requireSuperAdminStaff, async (req: Request, res: Response) => {
  try {
    const sectionId = parseInt(String(req.params.id), 10);
    const { title } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: "กรุณาระบุชื่อหมวดหลัก" });
    }

    const section = await prisma.checklistSection.update({
      where: { id: sectionId },
      data: { title: String(title).trim() },
    });

    res.json({ success: true, message: "แก้ไขชื่อหมวดหลักเรียบร้อยแล้ว", section });
  } catch (err) {
    console.error("PUT /api/admin/checklist-sections/:id error:", err);
    res.status(500).json({ success: false, message: "แก้ไขหมวดหลักไม่สำเร็จ" });
  }
});

// 10.8 ลบหมวดหลัก (Checklist Section)
router.delete("/checklist-sections/:id", requireSuperAdminStaff, async (req: Request, res: Response) => {
  try {
    const sectionId = parseInt(String(req.params.id), 10);
    const targetSec = await prisma.checklistSection.findUnique({ where: { id: sectionId } });

    // ตรวจสอบว่ามีคำตอบของนิสิตในข้อใดข้อหนึ่งของหมวดนี้หรือไม่
    const answersCount = await prisma.companyChecklistAnswer.count({
      where: { checklistItem: { sectionId } },
    });

    if (answersCount > 0) {
      return res.status(400).json({
        success: false,
        message: `ไม่สามารถลบหมวดนี้ได้เนื่องจากมีคำตอบของนิสิต ${answersCount} รายการผูกอยู่ แนะนำให้ปิดใช้งานข้อในหมวดแทน`,
      });
    }

    await prisma.checklistItem.deleteMany({ where: { sectionId } });
    await prisma.checklistSection.delete({ where: { id: sectionId } });

    // รันเลขลำดับหมวดที่เหลือในเวอร์ชันเดียวกันใหม่ให้อัตโนมัติ
    if (targetSec && targetSec.versionId) {
      const remaining = await prisma.checklistSection.findMany({
        where: { versionId: targetSec.versionId },
        orderBy: { order: "asc" },
      });
      if (remaining.length > 0) {
        const tempOps = remaining.map((s, idx) =>
          prisma.checklistSection.update({ where: { id: s.id }, data: { order: -(idx + 10000) } })
        );
        const finalOps = remaining.map((s, idx) => {
          const newOrder = idx + 1;
          let newTitle = s.title || "";
          if (/^ส่วนที่\s*\d+/.test(newTitle.trim())) {
            newTitle = newTitle.trim().replace(/^ส่วนที่\s*\d+/, `ส่วนที่ ${newOrder}`);
          }
          return prisma.checklistSection.update({
            where: { id: s.id },
            data: { order: newOrder, title: newTitle },
          });
        });
        await prisma.$transaction([...tempOps, ...finalOps]);
      }
    }

    res.json({ success: true, message: "ลบหมวดหลักเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("DELETE /api/admin/checklist-sections/:id error:", err);
    res.status(500).json({ success: false, message: "ลบหมวดหลักไม่สำเร็จ" });
  }
});

// 10.9 เพิ่มข้อย่อย (Checklist Item)
router.post("/checklist-items", requireSuperAdminStaff, async (req: Request, res: Response) => {
  try {
    const { sectionId, description, placeholder, isRequired } = req.body;
    if (!sectionId || !description || !String(description).trim()) {
      return res.status(400).json({ success: false, message: "กรุณาระบุข้อความคำถาม/เกณฑ์การพิจารณา" });
    }

    const sId = parseInt(sectionId, 10);
    const maxOrderItem = await prisma.checklistItem.findFirst({
      where: { sectionId: sId },
      orderBy: { order: "desc" },
    });
    const newOrder = maxOrderItem ? maxOrderItem.order + 1 : 1;
    const cleanDesc = String(description).trim().replace(/^(?:\d+[\.\)]\s*)+/, "");
    const formattedDesc = `${newOrder}. ${cleanDesc}`;

    const item = await prisma.checklistItem.create({
      data: {
        sectionId: sId,
        order: newOrder,
        description: formattedDesc,
        placeholder: placeholder ? String(placeholder).trim() : null,
        isRequired: Boolean(isRequired),
        isActive: true,
      },
    });

    res.json({ success: true, message: "เพิ่มข้อย่อยเรียบร้อยแล้ว", item });
  } catch (err) {
    console.error("POST /api/admin/checklist-items error:", err);
    res.status(500).json({ success: false, message: "เพิ่มข้อย่อยไม่สำเร็จ" });
  }
});

// 10.10 แก้ไขข้อย่อย (Checklist Item)
router.put("/checklist-items/:id", requireSuperAdminStaff, async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(String(req.params.id), 10);
    const { description, placeholder, isRequired, isActive } = req.body;

    let formattedDesc: string | undefined = undefined;
    if (description) {
      const existing = await prisma.checklistItem.findUnique({ where: { id: itemId } });
      const cleanDesc = String(description).trim().replace(/^(?:\d+[\.\)]\s*)+/, "");
      formattedDesc = `${existing ? existing.order : 1}. ${cleanDesc}`;
    }

    const item = await prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        description: formattedDesc,
        placeholder: placeholder !== undefined ? (placeholder ? String(placeholder).trim() : null) : undefined,
        isRequired: isRequired !== undefined ? Boolean(isRequired) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    res.json({ success: true, message: "แก้ไขข้อย่อยเรียบร้อยแล้ว", item });
  } catch (err) {
    console.error("PUT /api/admin/checklist-items/:id error:", err);
    res.status(500).json({ success: false, message: "แก้ไขข้อย่อยไม่สำเร็จ" });
  }
});

// 10.11 ลบข้อย่อย (Checklist Item)
router.delete("/checklist-items/:id", requireSuperAdminStaff, async (req: Request, res: Response) => {
  try {
    const itemId = parseInt(String(req.params.id), 10);
    const targetItem = await prisma.checklistItem.findUnique({ where: { id: itemId } });

    const answersCount = await prisma.companyChecklistAnswer.count({
      where: { checklistItemId: itemId },
    });

    if (answersCount > 0) {
      return res.status(400).json({
        success: false,
        message: `ไม่สามารถลบข้อนี้ได้เนื่องจากมีนิสิตเคยตอบแล้ว ${answersCount} รายการ กรุณากดปุ่ม "ปิดใช้งาน (ซ่อน)" แทน`,
      });
    }

    await prisma.checklistItem.delete({ where: { id: itemId } });

    // รันเลขข้อที่เหลือในหมวดเดียวกันใหม่อัตโนมัติ
    if (targetItem) {
      const remaining = await prisma.checklistItem.findMany({
        where: { sectionId: targetItem.sectionId },
        orderBy: { order: "asc" },
      });
      if (remaining.length > 0) {
        const tempOps = remaining.map((it, idx) =>
          prisma.checklistItem.update({ where: { id: it.id }, data: { order: -(idx + 10000) } })
        );
        const finalOps = remaining.map((it, idx) => {
          const newOrder = idx + 1;
          const cleanDesc = String(it.description || "").trim().replace(/^(?:\d+[\.\)]\s*)+/, "");
          return prisma.checklistItem.update({
            where: { id: it.id },
            data: { order: newOrder, description: `${newOrder}. ${cleanDesc}` },
          });
        });
        await prisma.$transaction([...tempOps, ...finalOps]);
      }
    }

    res.json({ success: true, message: "ลบข้อย่อยเรียบร้อยแล้ว" });
  } catch (err) {
    console.error("DELETE /api/admin/checklist-items/:id error:", err);
    res.status(500).json({ success: false, message: "ลบข้อย่อยไม่สำเร็จ" });
  }
});

// 10.12 จัดลำดับหมวดหลัก หรือ ข้อย่อย (รองรับทั้ง Drag & Drop orderedIds และ Move Up / Down)
router.post("/checklist-reorder", requireSuperAdminStaff, async (req: Request, res: Response) => {
  try {
    const { type, id, direction, orderedIds } = req.body;

    // กรณี Drag & Drop ส่งลำดับทั้งหมดมาใน orderedIds
    if (type && Array.isArray(orderedIds) && orderedIds.length > 0) {
      const ids = orderedIds.map((x: any) => parseInt(String(x), 10)).filter((n: number) => !isNaN(n));

      if (type === "section") {
        const existingSections = await prisma.checklistSection.findMany({
          where: { id: { in: ids } },
        });
        const secMap = new Map(existingSections.map((s) => [s.id, s]));

        const tempOps = ids.map((secId: number, idx: number) =>
          prisma.checklistSection.update({
            where: { id: secId },
            data: { order: -(idx + 10000) },
          })
        );

        const finalOps = ids.map((secId: number, idx: number) => {
          const newOrder = idx + 1;
          const sec = secMap.get(secId);
          let newTitle = sec?.title || "";
          if (/^ส่วนที่\s*\d+/.test(newTitle.trim())) {
            newTitle = newTitle.trim().replace(/^ส่วนที่\s*\d+/, `ส่วนที่ ${newOrder}`);
          }
          return prisma.checklistSection.update({
            where: { id: secId },
            data: { order: newOrder, title: newTitle },
          });
        });

        await prisma.$transaction([...tempOps, ...finalOps]);
        return res.json({ success: true, message: "จัดลำดับหมวดใหม่เรียบร้อยแล้ว" });
      }

      if (type === "item") {
        const existingItems = await prisma.checklistItem.findMany({
          where: { id: { in: ids } },
        });
        const itemMap = new Map(existingItems.map((it) => [it.id, it]));

        const tempOps = ids.map((itId: number, idx: number) =>
          prisma.checklistItem.update({
            where: { id: itId },
            data: { order: -(idx + 10000) },
          })
        );

        const finalOps = ids.map((itId: number, idx: number) => {
          const newOrder = idx + 1;
          const it = itemMap.get(itId);
          const cleanDesc = String(it?.description || "")
            .trim()
            .replace(/^(?:\d+[\.\)]\s*)+/, "");
          return prisma.checklistItem.update({
            where: { id: itId },
            data: { order: newOrder, description: `${newOrder}. ${cleanDesc}` },
          });
        });

        await prisma.$transaction([...tempOps, ...finalOps]);
        return res.json({ success: true, message: "จัดลำดับข้อใหม่เรียบร้อยแล้ว" });
      }
    }

    if (!type || !id || !direction) {
      return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
    }

    const targetId = parseInt(id, 10);

    if (type === "section") {
      const current = await prisma.checklistSection.findUnique({ where: { id: targetId } });
      if (!current) return res.status(404).json({ success: false, message: "ไม่พบหมวดนี้" });

      const sibling = await prisma.checklistSection.findFirst({
        where: {
          versionId: current.versionId,
          order: direction === "up" ? { lt: current.order } : { gt: current.order },
        },
        orderBy: { order: direction === "up" ? "desc" : "asc" },
      });

      if (!sibling) {
        return res.json({ success: true, message: "อยู่ลำดับแรกหรือลำดับสุดท้ายแล้ว" });
      }

      const currentOrder = current.order;
      const siblingOrder = sibling.order;

      await prisma.$transaction([
        prisma.checklistSection.update({ where: { id: current.id }, data: { order: -9999 } }),
        prisma.checklistSection.update({ where: { id: sibling.id }, data: { order: currentOrder } }),
        prisma.checklistSection.update({ where: { id: current.id }, data: { order: siblingOrder } }),
      ]);

      return res.json({ success: true, message: "จัดลำดับหมวดใหม่เรียบร้อยแล้ว" });
    }

    if (type === "item") {
      const current = await prisma.checklistItem.findUnique({ where: { id: targetId } });
      if (!current) return res.status(404).json({ success: false, message: "ไม่พบข้อนี้" });

      const sibling = await prisma.checklistItem.findFirst({
        where: {
          sectionId: current.sectionId,
          order: direction === "up" ? { lt: current.order } : { gt: current.order },
        },
        orderBy: { order: direction === "up" ? "desc" : "asc" },
      });

      if (!sibling) {
        return res.json({ success: true, message: "อยู่ลำดับแรกหรือลำดับสุดท้ายแล้ว" });
      }

      const currentOrder = current.order;
      const siblingOrder = sibling.order;

      await prisma.$transaction([
        prisma.checklistItem.update({ where: { id: current.id }, data: { order: -9999 } }),
        prisma.checklistItem.update({ where: { id: sibling.id }, data: { order: currentOrder } }),
        prisma.checklistItem.update({ where: { id: current.id }, data: { order: siblingOrder } }),
      ]);

      return res.json({ success: true, message: "จัดลำดับข้อใหม่เรียบร้อยแล้ว" });
    }

    res.status(400).json({ success: false, message: "ประเภทไม่ถูกต้อง" });
  } catch (err) {
    console.error("POST /api/admin/checklist-reorder error:", err);
    res.status(500).json({ success: false, message: "จัดลำดับไม่สำเร็จ" });
  }
});

// 10.13 บันทึกการเปลี่ยนแปลงโครงสร้าง Checklist ทั้งหมดในครั้งเดียว (Draft Mode Batch Sync)
router.put("/checklist-versions/:id/sync-structure", requireSuperAdminStaff, async (req: Request, res: Response) => {
  try {
    const versionId = parseInt(String(req.params.id), 10);
    const { sections } = req.body;

    if (isNaN(versionId) || !Array.isArray(sections)) {
      return res.status(400).json({ success: false, message: "ข้อมูลโครงสร้าง Checklist ไม่ถูกต้อง" });
    }

    const existingSections = await prisma.checklistSection.findMany({
      where: { versionId },
      include: {
        items: {
          include: {
            _count: { select: { answers: true } },
          },
        },
      },
    });

    const existingSectionIdSet = new Set(existingSections.map((s) => s.id));
    const allExistingItems = existingSections.flatMap((s) => s.items);
    const existingItemIdSet = new Set(allExistingItems.map((it) => it.id));

    const keptSectionIds = new Set<number>();
    const keptItemIds = new Set<number>();

    for (const sec of sections) {
      const sId = Number(sec.id);
      if (sId > 0 && existingSectionIdSet.has(sId)) {
        keptSectionIds.add(sId);
      }
      if (Array.isArray(sec.items)) {
        for (const it of sec.items) {
          const itId = Number(it.id);
          if (itId > 0 && existingItemIdSet.has(itId)) {
            keptItemIds.add(itId);
          }
        }
      }
    }

    const removedItems = allExistingItems.filter((it) => !keptItemIds.has(it.id));
    const itemsWithAnswers = removedItems.filter((it) => (it._count?.answers || 0) > 0);
    if (itemsWithAnswers.length > 0) {
      return res.status(400).json({
        success: false,
        message: `ไม่สามารถลบข้อที่มีนิสิตเคยตอบแล้วได้ (${itemsWithAnswers.length} ข้อ) กรุณากดยกเลิกแล้วใช้ปุ่ม "เปิดอยู่/ปิดอยู่" เพื่อซ่อนข้อแทน`,
      });
    }

    const removedItemIds = removedItems.map((it) => it.id);
    const removedSectionIds = existingSections
      .filter((s) => !keptSectionIds.has(s.id))
      .map((s) => s.id);

    await prisma.$transaction(async (tx) => {
      // 1. ลบข้อย่อยและหมวดหลักที่ถูกลบออกใน Draft
      if (removedItemIds.length > 0) {
        await tx.checklistItem.deleteMany({
          where: { id: { in: removedItemIds } },
        });
      }
      if (removedSectionIds.length > 0) {
        await tx.checklistSection.deleteMany({
          where: { id: { in: removedSectionIds } },
        });
      }

      // 2. ย้าย order ของหมวดและข้อย่อยที่เหลืออยู่ไปเป็นค่าติดลบชั่วคราว เพื่อป้องกัน Unique Constraint ชนกัน
      for (const sId of keptSectionIds) {
        await tx.checklistSection.update({
          where: { id: sId },
          data: { order: -(sId + 100000) },
        });
      }
      for (const itId of keptItemIds) {
        await tx.checklistItem.update({
          where: { id: itId },
          data: { order: -(itId + 100000) },
        });
      }

      // 3. อัปเดตหรือสร้างหมวดหลักและข้อย่อยตามลำดับใหม่ พร้อมรันเลขข้ออัตโนมัติ
      for (let secIdx = 0; secIdx < sections.length; secIdx++) {
        const sec = sections[secIdx];
        const newSecOrder = secIdx + 1;
        let newSecTitle = String(sec.title || "").trim();
        if (/^ส่วนที่\s*\d+/.test(newSecTitle)) {
          newSecTitle = newSecTitle.replace(/^ส่วนที่\s*\d+/, `ส่วนที่ ${newSecOrder}`);
        }

        const rawSecId = Number(sec.id);
        let realSectionId: number;

        if (rawSecId > 0 && keptSectionIds.has(rawSecId)) {
          await tx.checklistSection.update({
            where: { id: rawSecId },
            data: {
              title: newSecTitle,
              order: newSecOrder,
            },
          });
          realSectionId = rawSecId;
        } else {
          const createdSec = await tx.checklistSection.create({
            data: {
              versionId,
              title: newSecTitle,
              order: newSecOrder,
            },
          });
          realSectionId = createdSec.id;
        }

        const items = Array.isArray(sec.items) ? sec.items : [];
        for (let itIdx = 0; itIdx < items.length; itIdx++) {
          const item = items[itIdx];
          const newItemOrder = itIdx + 1;
          const cleanDesc = String(item.description || "")
            .trim()
            .replace(/^(?:\d+[\.\)]\s*)+/, "");
          const formattedDesc = `${newItemOrder}. ${cleanDesc}`;
          const placeholderVal = item.placeholder ? String(item.placeholder).trim() : null;
          const isRequiredVal = Boolean(item.isRequired);
          const isActiveVal = item.isActive !== undefined ? Boolean(item.isActive) : true;

          const rawItemId = Number(item.id);
          if (rawItemId > 0 && keptItemIds.has(rawItemId)) {
            await tx.checklistItem.update({
              where: { id: rawItemId },
              data: {
                sectionId: realSectionId,
                order: newItemOrder,
                description: formattedDesc,
                placeholder: placeholderVal,
                isRequired: isRequiredVal,
                isActive: isActiveVal,
              },
            });
          } else {
            await tx.checklistItem.create({
              data: {
                sectionId: realSectionId,
                order: newItemOrder,
                description: formattedDesc,
                placeholder: placeholderVal,
                isRequired: isRequiredVal,
                isActive: isActiveVal,
              },
            });
          }
        }
      }
    });

    res.json({
      success: true,
      message: "บันทึกการเปลี่ยนแปลงเกณฑ์ Checklist ทั้งหมดเรียบร้อยแล้ว",
    });
  } catch (err) {
    console.error("PUT /api/admin/checklist-versions/:id/sync-structure error:", err);
    res.status(500).json({ success: false, message: "บันทึกการเปลี่ยนแปลงไม่สำเร็จ" });
  }
});

export default router;
