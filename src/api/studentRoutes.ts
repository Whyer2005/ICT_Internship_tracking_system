import express, { Request, Response } from "express";
import multer from "multer";
import path from "path";
import prisma from "../db";
import requireLogin from "../auth/requireLogin";
import { uploadToCloudinary } from "../utils/cloudinary";
import { findMajor, ICT_DEGREES } from "../utils/majors";
import {
  excludeUsedWindows,
  getInternshipLock,
  getStudentWindowEligibility,
  usedWindowKeys,
  resolveSubmissionWindow,
  termSortKey,
  windowDisplayLabel,
} from "../utils/internshipWindows";
import { batchesForStudent, getLetterBatch, letterHeaderSnapshot, toBatchStudent } from "../utils/letterBatches";
import { analyzeAcceptanceForm } from "../utils/acceptanceOcr";
import {
  loadSuperAdminState,
  saveSuperAdminState,
  saveSuperAdminStateOrThrow,
  getStudentRoundState,
  saveStudentRoundState,
  StudentRoundState,
} from "../utils/superAdminStore";
import { resolveGoogleMapsLink } from "../utils/googleMapsLink";
import {
  IssueReport,
  ISSUE_CATEGORIES,
  ISSUE_PAGES,
  ISSUE_FILE_EXTS,
  ISSUE_FILE_MAX_BYTES,
  ISSUE_MAX_FILES,
  nextIssueId,
  validateIssueInput,
} from "../utils/issueReports";
import { studentCoopRouter } from "./coopRoutes";
import { COOP_FINAL_STATUSES } from "../utils/coopPostings";
import { getChecklistFormIdForMajor } from "../utils/checklistFormsDb";
import { CV_COMMENT_ROLE_LABEL, CV_STATE_LABEL, CvCommentRole, cvState, hasCv, isCommentForOlderFile, unseenCommentCount } from "../utils/cvReview";

const router = express.Router();

// ต้อง login ทุก route ภายใต้ /api/student
router.use(requireLogin);

// ประกาศรับนิสิตสหกิจศึกษา (อ่านอย่างเดียว)
router.use(studentCoopRouter);

// แปลงลิงก์ Google Maps / พิกัดที่คัดลอกมา → lat,lng สำหรับปักหมุดสถานประกอบการ
// (ลิงก์ย่อ maps.app.goo.gl ต้องให้ server ตาม redirect เพราะ browser อ่าน redirect ข้ามโดเมนไม่ได้)
router.post("/map-link", async (req: Request, res: Response) => {
  const link = String(req.body?.link || "").trim().slice(0, 2000);
  if (!link) {
    return res.status(400).json({ success: false, message: "กรุณาวางลิงก์ Google Maps หรือพิกัด" });
  }
  try {
    const coords = await resolveGoogleMapsLink(link);
    if (!coords) {
      return res.status(400).json({
        success: false,
        message: "ไม่พบพิกัดในลิงก์นี้ — ใน Google Maps ให้คลิกขวาที่ตำแหน่งบริษัท แล้วกดตัวเลขพิกัดเพื่อคัดลอกมาวางแทน",
      });
    }
    res.json({ success: true, ...coords });
  } catch (err) {
    console.error("POST /api/student/map-link error:", err);
    res.status(502).json({ success: false, message: "เปิดลิงก์ Google Maps ไม่สำเร็จ กรุณาลองใหม่ หรือวางพิกัดแทน" });
  }
});

// ==========================================
// 1. ตั้งค่าการอัปโหลดไฟล์ด้วย Multer (Memory Storage)
// ==========================================
const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedExts = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("รองรับเฉพาะไฟล์ PDF หรือรูปภาพ (JPG, PNG, WebP) เท่านั้น"));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
});

// ==========================================
// แจ้งปัญหาการใช้งานระบบ (เมนู "อื่นๆ" → แจ้งปัญหา) — เก็บใน super_admin_state.json
// ==========================================
const issueUpload = multer({
  storage,
  limits: { fileSize: ISSUE_FILE_MAX_BYTES, files: ISSUE_MAX_FILES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ISSUE_FILE_EXTS.includes(ext)) cb(null, true);
    else cb(new Error("แนบได้เฉพาะไฟล์ PNG, JPG หรือ PDF"));
  },
}).array("attachments", ISSUE_MAX_FILES);

// เรื่องที่นิสิตคนนี้เคยแจ้ง (ไม่ส่งข้อมูลภายในอื่นของเจ้าหน้าที่ นอกจากสถานะและหมายเหตุตอบกลับ)
router.get("/issue-reports", async (req: Request, res: Response) => {
  try {
    // ตัวเลือกในฟอร์มส่งจาก server ที่เดียว (หน้าเว็บไม่ต้องเก็บรายการซ้ำ)
    const options = { categories: ISSUE_CATEGORIES, pages: ISSUE_PAGES };
    const student = await prisma.student.findUnique({ where: { userId: req.session.user!.id }, select: { id: true } });
    if (!student) return res.json({ success: true, reports: [], options });
    const reports = (loadSuperAdminState().issueReports || [])
      .filter((r) => r.studentId === student.id)
      .map(({ studentId, email, ...rest }) => rest);
    res.json({ success: true, reports, options });
  } catch (err) {
    console.error("GET /api/student/issue-reports error:", err);
    res.status(500).json({ success: false, message: "โหลดเรื่องที่เคยแจ้งไม่สำเร็จ" });
  }
});

router.post("/issue-reports", (req: Request, res: Response) => {
  issueUpload(req, res, async (uploadErr: any) => {
    if (uploadErr) {
      const message = uploadErr.code === "LIMIT_FILE_SIZE"
        ? "ไฟล์แนบต้องมีขนาดไม่เกิน 5MB ต่อไฟล์"
        : uploadErr.code === "LIMIT_FILE_COUNT" || uploadErr.code === "LIMIT_UNEXPECTED_FILE"
          ? `แนบไฟล์ได้สูงสุด ${ISSUE_MAX_FILES} ไฟล์`
          : uploadErr.message || "อัปโหลดไฟล์แนบไม่สำเร็จ";
      return res.status(400).json({ success: false, message });
    }
    try {
      const { value, error } = validateIssueInput(req.body || {});
      if (!value) return res.status(400).json({ success: false, message: error });

      const user = await prisma.user.findUnique({
        where: { id: req.session.user!.id },
        select: { email: true, student: { select: { id: true, studentCode: true, nameTh: true } } },
      });
      if (!user?.student) {
        return res.status(400).json({ success: false, message: "กรุณากรอกข้อมูลส่วนตัวนิสิตก่อนแจ้งปัญหา" });
      }

      const files = (req.files as Express.Multer.File[]) || [];
      const attachments: IssueReport["attachments"] = [];
      for (const f of files) {
        // multer อ่านชื่อไฟล์เป็น latin1 → ชื่อภาษาไทยเพี้ยน แปลงกลับเป็น UTF-8 (วิธีเดียวกับอัปโหลดใบตอบรับ)
        const utf8Name = Buffer.from(f.originalname, "latin1").toString("utf8");
        const name = (utf8Name.includes("�") ? f.originalname : utf8Name).slice(0, 200);
        attachments.push({ name, url: await uploadToCloudinary(f.buffer, name, "issue-reports") });
      }

      // อัปโหลดเสร็จแล้วค่อยโหลด state ล่าสุด → ลดโอกาสทับการบันทึกของคนอื่นระหว่างรออัปโหลด
      const state = loadSuperAdminState();
      const list = state.issueReports || [];
      const now = new Date().toISOString();
      const report: IssueReport = {
        id: nextIssueId(list),
        studentId: user.student.id,
        studentCode: user.student.studentCode,
        studentName: user.student.nameTh,
        email: user.email,
        ...value,
        attachments,
        status: "OPEN",
        createdAt: now,
        updatedAt: now,
      };
      state.issueReports = [report, ...list];
      saveSuperAdminStateOrThrow(state);

      const { studentId, email, ...publicReport } = report;
      res.json({ success: true, message: `ส่งเรื่อง ${report.id} เรียบร้อยแล้ว`, report: publicReport });
    } catch (err) {
      console.error("POST /api/student/issue-reports error:", err);
      res.status(500).json({ success: false, message: "ส่งเรื่องไม่สำเร็จ กรุณาลองใหม่" });
    }
  });
});

// Helper: ดึงหรือสร้าง student id ของ user ปัจจุบัน
async function getStudentByUserId(userId: number) {
  return await prisma.student.findUnique({
    where: { userId },
    include: {
      advisor: true,
      cv: true,
      trainingRecords: true,
      companies: {
        include: {
          answers: true,
          submission: true,
        },
      },
      placement: true,
      internshipWindow: { select: { internStartDate: true, internEndDate: true } }, // ช่วงฝึกงานบน Dashboard + การ์ด Checklist
    },
  });
}

type StudentWithRelations = NonNullable<Awaited<ReturnType<typeof getStudentByUserId>>>;

function getRoundStateFor(student: StudentWithRelations) {
  const defaultTerm = `${student.semester || "2"}/${student.academicYear || "2568"}`;
  return getStudentRoundState(student.id, defaultTerm);
}

/** ล็อก CV / ชั่วโมงอบรมระหว่างกำลังฝึกงาน (ออกหนังสือส่งตัวแล้ว -> จบรอบ) */
async function getStudentInternshipLock(student: StudentWithRelations) {
  const state = loadSuperAdminState();
  // ใช้เงื่อนไขเดียวกับคิวออกหนังสือ: ไม่มี workflow -> ถือว่าส่งตัวแล้วเมื่อสถานที่ฝึกได้รับอนุมัติ
  const wf = state.docWorkflowMap?.[String(student.id)];
  const dispatched = wf ? Boolean(wf.dispatchLetterIssued) : student.placement?.status === "APPROVED";
  return getInternshipLock(student, dispatched, getRoundStateFor(student).currentTerm);
}

/** รอบออกฝึกที่เลือกได้สำหรับ "รอบที่ 2" = รอบที่เปิดอยู่และอยู่หลังรอบปัจจุบัน */
async function getRound2Options(student: StudentWithRelations) {
  const roundState = getRoundStateFor(student);
  const eligibility = await getStudentWindowEligibility(student);
  const used = usedWindowKeys(roundState, true);
  const current = student.internshipWindowId
    ? eligibility.windows.find((w) => w.id === student.internshipWindowId)
    : null;
  const currentTerm = current?.term || String(roundState.currentTerm || "").match(/[123]\/\d{4}/)?.[0] || "";
  const minKey = currentTerm ? termSortKey(currentTerm) : 0;
  return eligibility.openWindows.filter(
    (w) =>
      w.id !== student.internshipWindowId &&
      !used.ids.has(w.id) &&
      !used.terms.has(w.term) &&
      termSortKey(w.term) > minKey
  );
}

function lockedResponse(res: Response, message: string) {
  return res.status(403).json({ success: false, lockedDuringInternship: true, message });
}

/**
 * พิกัดที่นิสิตปักหมุดจากแผนที่
 * - ไม่ได้ส่งทั้ง latitude/longitude มาเลย → {} (ไม่แตะค่าเดิมใน DB)
 * - ส่ง null / ค่าไม่ถูกต้อง → null ทั้งคู่ (ล้างหมุด)
 */
function parseCoords(
  latitude: unknown,
  longitude: unknown
): { latitude?: number | null; longitude?: number | null } {
  if (latitude === undefined && longitude === undefined) return {};
  const lat = latitude === null || latitude === undefined || latitude === "" ? NaN : Number(latitude);
  const lng = longitude === null || longitude === undefined || longitude === "" ? NaN : Number(longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    return { latitude: lat, longitude: lng };
  }
  return { latitude: null, longitude: null };
}

// ==========================================
// 2. ข้อมูลส่วนตัวนิสิต (Student Profile)
// ==========================================
router.get("/profile", async (req: Request, res: Response) => {
  try {
    // include เหมือน getStudentByUserId + อีเมลอาจารย์ที่ปรึกษา (ปุ่ม "ติดต่ออาจารย์" หน้า Profile) ใน query เดียว
    // แยกจาก helper กลาง เพื่อไม่ให้ endpoint อื่นต้องดึงอีเมลอาจารย์ไปด้วย
    const student = await prisma.student.findUnique({
      where: { userId: req.session.user!.id },
      include: {
        advisor: { include: { user: { select: { email: true } } } },
        cv: true,
        trainingRecords: true,
        companies: { include: { answers: true, submission: true } },
        placement: true,
        internshipWindow: { select: { internStartDate: true, internEndDate: true } },
      },
    });
    // ชื่อสาขา/หลักสูตรจาก findMajor (ไม่ต้องจับคู่ฝั่ง client)
    const majorInfo = student ? findMajor(student.major) : null;
    res.json({
      success: true,
      user: req.session.user,
      student: student || null,
      advisorEmail: student?.advisor?.user?.email || null,
      // admin เปิดให้แก้ ชื่อ-สกุล / GPAX (ล็อกกลับหลังนิสิตบันทึกยืนยัน 1 ครั้ง)
      profileEditUnlocked: Boolean(student && loadSuperAdminState().profileEditUnlocks?.[String(student.id)]),
      majorName: majorInfo ? majorInfo.name : null,
      degreeName: majorInfo ? ICT_DEGREES.find((d) => d.code === majorInfo.degreeCode)?.name || null : null,
    });
  } catch (err) {
    console.error("GET /api/student/profile error:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการดึงข้อมูล" });
  }
});

router.get("/advisors", async (_req: Request, res: Response) => {
  try {
    const advisors = await prisma.staff.findMany({
      where: {
        OR: [
          { isAdvisor: true },
          { user: { role: "ADVISOR" } },
        ],
      },
      select: {
        id: true,
        name: true,
        department: true,
      },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, advisors });
  } catch (err) {
    console.error("GET /api/student/advisors error:", err);
    res.status(500).json({ success: false, message: "ดึงรายชื่ออาจารย์ที่ปรึกษาไม่สำเร็จ" });
  }
});

router.post("/profile", upload.single("profileImage"), async (req: Request, res: Response) => {
  try {
    const userId = req.session.user!.id;
    const {
      studentCode,
      nameTh,
      nameEn,
      nickname,
      year,
      major,
      gpa,
      phone,
      lineId,
      facebook,
      otherInfo,
      advisorId,
    } = req.body;

    // ข้อมูลเพิ่มเติม (การ์ด "อื่นๆ") — ไม่เกิน 2000 ตัวอักษร (เกินแจ้งกลับ ไม่ตัดทิ้งเงียบ ๆ)
    const OTHER_INFO_MAX = 2000;
    if (otherInfo && String(otherInfo).trim().length > OTHER_INFO_MAX) {
      return res.status(400).json({ success: false, message: `ข้อมูลเพิ่มเติมยาวเกิน ${OTHER_INFO_MAX} ตัวอักษร` });
    }
    const cleanOtherInfo = (v: unknown) => (v ? String(v).trim() || null : null);

    const existingStudent = await prisma.student.findUnique({
      where: { userId },
    });

    if (!existingStudent && (!studentCode || !nameTh || !nameEn)) {
      return res.status(400).json({
        success: false,
        message: "กรุณากรอกรหัสนิสิต, ชื่อภาษาไทย และชื่อภาษาอังกฤษให้ครบถ้วน",
      });
    }

    let profileImageUrl: string | undefined = undefined;
    if (req.file) {
      profileImageUrl = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        "profiles"
      );
    }

    // [REQ-04] Locked REG Fields:
    // หากมีข้อมูลนิสิตในระบบแล้ว (เช่น นำเข้าจาก REG) ห้ามนิสิตแก้ไขรหัสนิสิต, ชื่อ-สกุลไทย, ชั้นปี, สาขาวิชา, GPAX
    // อนุญาตให้แก้ไขเฉพาะข้อมูลติดต่อ (ชื่อเล่น, ชื่ออังกฤษ, เบอร์โทร, Line ID, Facebook, รูปโปรไฟล์, อาจารย์ที่ปรึกษาถ้ายังไม่ถูกล็อค)
    let student;
    if (existingStudent) {
      const updateData: any = {
        phone: phone !== undefined ? (phone ? String(phone).trim() : null) : existingStudent.phone,
        lineId: lineId !== undefined ? (lineId ? String(lineId).trim() : null) : existingStudent.lineId,
        facebook: facebook !== undefined ? (facebook ? String(facebook).trim() : null) : existingStudent.facebook,
        otherInfo: otherInfo !== undefined ? cleanOtherInfo(otherInfo) : existingStudent.otherInfo,
      };
      if (nickname !== undefined) {
        updateData.nickname = nickname ? String(nickname).trim() : null;
      }
      // ชื่อภาษาอังกฤษล็อกเหมือนชื่อไทย: แก้ได้เมื่อ admin เปิดให้ (ด้านล่าง) หรือยังไม่เคยมีค่า (เติมครั้งแรก)
      const currentNameEn = String(existingStudent.nameEn || "").trim();
      if ((!currentNameEn || currentNameEn === "-") && nameEn && String(nameEn).trim() && String(nameEn).trim() !== "-") {
        updateData.nameEn = String(nameEn).replace(/\s+/g, " ").trim().slice(0, 200);
      }
      if (advisorId !== undefined && !existingStudent.advisorId) {
        updateData.advisorId = advisorId ? parseInt(advisorId, 10) : null;
      }
      if (profileImageUrl) {
        updateData.profileImageUrl = profileImageUrl;
      }

      // admin เปิดให้แก้ข้อมูลที่ล็อกตาม REG (ชื่อ-สกุลไทย/อังกฤษ / GPAX) ได้ 1 ครั้ง → บันทึกครั้งนี้ใช้สิทธิ์และล็อกกลับ
      const unlockKey = String(existingStudent.id);
      const editUnlocked = Boolean(loadSuperAdminState().profileEditUnlocks?.[unlockKey]);
      if (editUnlocked) {
        const cleanNameTh = String(nameTh ?? "").replace(/\s+/g, " ").trim();
        if (!cleanNameTh || cleanNameTh.length > 200) {
          return res.status(400).json({ success: false, message: "กรุณากรอกชื่อ-สกุล (ภาษาไทย) ให้ถูกต้อง (ไม่เกิน 200 ตัวอักษร)" });
        }
        updateData.nameTh = cleanNameTh;
        const cleanNameEn = String(nameEn ?? "").replace(/\s+/g, " ").trim();
        if (!cleanNameEn || cleanNameEn.length > 200) {
          return res.status(400).json({ success: false, message: "กรุณากรอก Name & Surname (English) ให้ถูกต้อง (ไม่เกิน 200 ตัวอักษร)" });
        }
        updateData.nameEn = cleanNameEn;
        const gpaRaw = String(gpa ?? "").trim();
        if (gpaRaw) {
          const gpaNum = Number(gpaRaw);
          if (!/^\d(\.\d{1,2})?$/.test(gpaRaw) || !Number.isFinite(gpaNum) || gpaNum < 0 || gpaNum > 4) {
            return res.status(400).json({ success: false, message: "GPAX ต้องเป็นตัวเลข 0.00 - 4.00 (ทศนิยมไม่เกิน 2 ตำแหน่ง)" });
          }
          updateData.gpa = gpaNum;
        }
      }

      student = await prisma.student.update({
        where: { userId },
        data: updateData,
      });

      if (editUnlocked) {
        const state = loadSuperAdminState();
        if (state.profileEditUnlocks) delete state.profileEditUnlocks[unlockKey];
        saveSuperAdminState(state);
      }
    } else {
      const createData: any = {
        userId,
        studentCode: String(studentCode).trim(),
        nameTh: String(nameTh).trim(),
        nameEn: String(nameEn).trim(),
        nickname: nickname ? String(nickname).trim() : null,
        year: year ? parseInt(year, 10) : 3,
        major: major ? String(major).trim() : "วิศวกรรมซอฟต์แวร์",
        gpa: gpa ? parseFloat(gpa) : null,
        phone: phone ? String(phone).trim() : null,
        lineId: lineId ? String(lineId).trim() : null,
        facebook: facebook ? String(facebook).trim() : null,
        otherInfo: cleanOtherInfo(otherInfo),
        advisorId: advisorId ? parseInt(advisorId, 10) : null,
        stage: "PENDING_DOCUMENTS",
      };
      if (profileImageUrl) {
        createData.profileImageUrl = profileImageUrl;
      }
      student = await prisma.student.create({
        data: createData,
      });
    }

    res.json({
      success: true,
      message: "บันทึกข้อมูลส่วนตัวสำเร็จ",
      student,
    });
  } catch (err: any) {
    console.error("POST /api/student/profile error:", err);
    res.status(500).json({ success: false, message: "บันทึกข้อมูลไม่สำเร็จ: " + err.message });
  }
});

// ==========================================
// 3. ชั่วโมงการอบรม Soft/Hard Skill
// ==========================================
router.get("/trainings", async (req: Request, res: Response) => {
  try {
    const student = await getStudentByUserId(req.session.user!.id);
    if (!student) {
      return res.json({ success: true, trainings: [], totalSoft: 0, totalHard: 0 });
    }

    const trainings = await prisma.trainingRecord.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "asc" },
    });

    const totalSoft = trainings
      .filter((t) => t.skillType === "SOFT")
      .reduce((sum, t) => sum + t.hours, 0);

    const totalHard = trainings
      .filter((t) => t.skillType === "HARD")
      .reduce((sum, t) => sum + t.hours, 0);

    const internshipLock = await getStudentInternshipLock(student);
    res.json({
      success: true,
      trainings,
      totalSoft,
      totalHard,
      internshipLock: { locked: internshipLock.locked, message: internshipLock.message },
    });
  } catch (err) {
    console.error("GET /api/student/trainings error:", err);
    res.status(500).json({ success: false, message: "ดึงข้อมูลชั่วโมงอบรมไม่สำเร็จ" });
  }
});

router.post("/trainings", upload.single("certificate"), async (req: Request, res: Response) => {
  try {
    const student = await getStudentByUserId(req.session.user!.id);
    if (!student) {
      return res.status(400).json({
        success: false,
        message: "กรุณากรอกข้อมูลส่วนตัวนิสิตในขั้นตอนแรกก่อน",
      });
    }

    const internshipLock = await getStudentInternshipLock(student);
    if (internshipLock.locked) return lockedResponse(res, internshipLock.message);

    const { title, skillType, hours } = req.body;
    if (!hours || isNaN(hours)) {
      return res.status(400).json({ success: false, message: "กรุณาระบุจำนวนชั่วโมงให้ถูกต้อง" });
    }

    // ลิงก์ Certificate: รับเฉพาะ http/https (กัน javascript: ฯลฯ เพราะหน้าเว็บนำไปทำเป็นลิงก์ให้กด)
    const certificateLinkRaw = String(req.body.certificateLink || "").trim();
    let certificateLink: string | null = null;
    if (certificateLinkRaw) {
      let parsedLink: URL | null = null;
      try {
        parsedLink = new URL(certificateLinkRaw);
      } catch {
        parsedLink = null;
      }
      if (!parsedLink || !["http:", "https:"].includes(parsedLink.protocol) || certificateLinkRaw.length > 1000) {
        return res.status(400).json({ success: false, message: "ลิงก์ Certificate ไม่ถูกต้อง (ต้องขึ้นต้นด้วย http:// หรือ https://)" });
      }
      certificateLink = parsedLink.toString();
    }

    let certificateFileUrl: string | null = null;
    if (req.file) {
      certificateFileUrl = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname,
        "certificates"
      );
    }

    const normalizedSkillType =
      String(skillType).toLowerCase().includes("hard") ? "HARD" : "SOFT";

    const training = await prisma.trainingRecord.create({
      data: {
        studentId: student.id,
        title: title ? String(title).trim() : `อบรม ${normalizedSkillType === "HARD" ? "Hard" : "Soft"} skill`,
        skillType: normalizedSkillType,
        hours: parseInt(hours, 10),
        certificateFileUrl,
        certificateLink,
        source: "STUDENT_UPLOAD",
        status: "PENDING",
      },
    });

    res.json({
      success: true,
      message: "เพิ่มข้อมูลการอบรมสำเร็จ",
      training,
    });
  } catch (err: any) {
    console.error("POST /api/student/trainings error:", err);
    res.status(500).json({ success: false, message: "เพิ่มข้อมูลไม่สำเร็จ: " + err.message });
  }
});

router.put("/trainings/:id", async (req: Request, res: Response) => {
  try {
    const student = await getStudentByUserId(req.session.user!.id);
    if (!student) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลนิสิต" });
    }

    const internshipLock = await getStudentInternshipLock(student);
    if (internshipLock.locked) return lockedResponse(res, internshipLock.message);
    const trainingId = parseInt(req.params.id as string, 10);
    const { title, skillType, hours } = req.body;

    const training = await prisma.trainingRecord.findFirst({
      where: { id: trainingId, studentId: student.id },
    });

    if (!training) {
      return res.status(404).json({ success: false, message: "ไม่พบรายการอบรมนี้" });
    }

    if (training.source === "STAFF_IMPORT" || training.source === "ADMIN_IMPORT") {
      return res.status(403).json({
        success: false,
        message: "ไม่สามารถแก้ไขรายการอบรมที่นำเข้าจากระบบคณะหรืออาจารย์ประจำวิชาได้",
      });
    }

    const updated = await prisma.trainingRecord.update({
      where: { id: trainingId },
      data: {
        title: title ? String(title).trim() : training.title,
        skillType: skillType ? (String(skillType).toLowerCase().includes("hard") ? "HARD" : "SOFT") : training.skillType,
        hours: hours ? parseInt(hours, 10) : training.hours,
      },
    });

    res.json({ success: true, message: "แก้ไขข้อมูลสำเร็จ", training: updated });
  } catch (err) {
    console.error("PUT /api/student/trainings/:id error:", err);
    res.status(500).json({ success: false, message: "แก้ไขข้อมูลไม่สำเร็จ" });
  }
});

router.delete("/trainings/:id", async (req: Request, res: Response) => {
  try {
    const student = await getStudentByUserId(req.session.user!.id);
    if (!student) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลนิสิต" });
    }

    const internshipLock = await getStudentInternshipLock(student);
    if (internshipLock.locked) return lockedResponse(res, internshipLock.message);
    const trainingId = parseInt(req.params.id as string, 10);

    const training = await prisma.trainingRecord.findFirst({
      where: { id: trainingId, studentId: student.id },
    });

    if (!training) {
      return res.status(404).json({ success: false, message: "ไม่พบรายการอบรมนี้" });
    }

    if (training.source === "STAFF_IMPORT" || training.source === "ADMIN_IMPORT") {
      return res.status(403).json({
        success: false,
        message: "ไม่สามารถลบรายการอบรมที่นำเข้าจากระบบคณะหรืออาจารย์ประจำวิชาได้",
      });
    }

    await prisma.trainingRecord.delete({ where: { id: trainingId } });
    res.json({ success: true, message: "ลบรายการอบรมสำเร็จ" });
  } catch (err) {
    console.error("DELETE /api/student/trainings/:id error:", err);
    res.status(500).json({ success: false, message: "ลบรายการไม่สำเร็จ" });
  }
});

// ==========================================
// 4. กรอกใบ CV
// ==========================================
router.get("/cv", async (req: Request, res: Response) => {
  try {
    const student = await getStudentByUserId(req.session.user!.id);
    if (!student) {
      return res.json({ success: true, cv: null });
    }
    const internshipLock = await getStudentInternshipLock(student);

    // อาจารย์ไม่อนุมัติ CV แล้ว — คอมเมนต์อย่างเดียว (นิสิตอ่านอย่างเดียว) · src/utils/cvReview.ts
    const comments = await prisma.cvComment.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
    });
    const state = cvState(student.cv);

    res.json({
      success: true,
      cv: student.cv
        ? {
            ...student.cv,
            state,
            stateLabel: CV_STATE_LABEL[state],
            unseenComments: unseenCommentCount(comments, student.cv.commentsSeenAt),
          }
        : null,
      comments: comments.map((c) => ({
        id: c.id,
        authorName: c.authorName,
        authorRoleLabel: CV_COMMENT_ROLE_LABEL[c.authorRole as CvCommentRole] || c.authorRole,
        message: c.message,
        createdAt: c.createdAt,
        cvFileName: c.cvFileName,
        forOlderFile: isCommentForOlderFile(c.cvUploadedAt, student.cv?.uploadedAt),
      })),
      internshipLock: { locked: internshipLock.locked, message: internshipLock.message },
    });
  } catch (err) {
    console.error("GET /api/student/cv error:", err);
    res.status(500).json({ success: false, message: "ดึงข้อมูล CV ไม่สำเร็จ" });
  }
});

router.post("/cv", upload.single("cv"), async (req: Request, res: Response) => {
  try {
    const student = await getStudentByUserId(req.session.user!.id);
    if (!student) {
      return res.status(400).json({
        success: false,
        message: "กรุณากรอกข้อมูลส่วนตัวนิสิตก่อนอัปโหลด CV",
      });
    }

    const internshipLock = await getStudentInternshipLock(student);
    if (internshipLock.locked) return lockedResponse(res, internshipLock.message);

    if (!req.file) {
      return res.status(400).json({ success: false, message: "กรุณาเลือกไฟล์ CV" });
    }

    // multer อ่านชื่อไฟล์เป็น latin1 → แปลงกลับเป็น UTF-8 เพื่อให้ชื่อภาษาไทยไม่เพี้ยน
    let fileName = req.file.originalname;
    const utf8Name = Buffer.from(fileName, "latin1").toString("utf8");
    if (!utf8Name.includes("�")) fileName = utf8Name;

    const fileUrl = await uploadToCloudinary(
      req.file.buffer,
      fileName,
      "cv"
    );

    const cv = await prisma.studentCV.upsert({
      where: { studentId: student.id },
      update: {
        fileUrl,
        fileName,
        status: "PENDING",
        note: null,
        uploadedAt: new Date(),
      },
      create: {
        studentId: student.id,
        fileUrl,
        fileName,
        status: "PENDING",
      },
    });

    res.json({ success: true, message: "อัปโหลด CV สำเร็จ", cv });
  } catch (err: any) {
    console.error("POST /api/student/cv error:", err);
    res.status(500).json({ success: false, message: "อัปโหลด CV ไม่สำเร็จ: " + err.message });
  }
});

// นิสิตเปิดอ่านคอมเมนต์ CV แล้ว -> ลบป้าย "มีคอมเมนต์ใหม่"
router.post("/cv/comments/seen", async (req: Request, res: Response) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.session.user!.id }, select: { id: true } });
    if (!student) return res.json({ success: true });
    await prisma.studentCV.updateMany({ where: { studentId: student.id }, data: { commentsSeenAt: new Date() } });
    res.json({ success: true });
  } catch (err) {
    console.error("POST /api/student/cv/comments/seen error:", err);
    res.status(500).json({ success: false, message: "บันทึกไม่สำเร็จ" });
  }
});

// ==========================================
// 4.1 แบบตอบรับ/ปฏิเสธ การรับนิสิตฝึกงาน (นิสิตอัปโหลดไฟล์ที่บริษัทกรอกแล้ว -> OCR ตรวจ -> พี่จอมยืนยัน)
// ==========================================
function toStudentAcceptanceView(wf: any, state?: any, student?: any, letterStudents?: any[]) {
  if (!wf) {
    return { requestLetterIssued: false, dispatchLetterIssued: false, status: "NOT_SENT" };
  }
  const cfg = state?.academicConfig || {};
  const fallbackStudent = student
    ? [
        {
          studentCode: student.studentCode || "",
          nameTh: student.nameTh || "",
          major: student.major || "วิศวกรรมซอฟต์แวร์",
          position: student.placement?.position || "นิสิตฝึกงาน",
          phone: student.phone || "-",
          companyAddress: student.placement?.companyAddress || "",
        },
      ]
    : [];
  return {
    requestLetterIssued: Boolean(wf.requestLetterIssued),
    requestLetterDocNo: wf.requestLetterDocNo || "",
    requestLetterDate: wf.requestLetterDate || "",
    // ลายเซ็น: ใช้ลายเซ็นปัจจุบันในตั้งค่าก่อนเสมอ · ไม่มี → ลายเซ็นที่เก็บไว้ตอนออกหนังสือ
    requestLetterSignatureSnapshot: cfg.signatureDataUrl || wf.requestLetterSignatureSnapshot || "",
    dispatchLetterIssued: Boolean(wf.dispatchLetterIssued),
    dispatchLetterDocNo: wf.dispatchLetterDocNo || "",
    dispatchLetterDate: wf.dispatchLetterDate || "",
    dispatchLetterSignatureSnapshot: cfg.signatureDataUrl || wf.dispatchLetterSignatureSnapshot || "",
    companyName: wf.companyName || student?.placement?.companyNameTh || student?.companies?.[0]?.name || "",
    companyAddress: student?.placement?.companyAddress || "",
    status: wf.companyResponseStatus || "NOT_SENT",
    advisorAcceptanceStatus: wf.advisorAcceptanceStatus || "NONE",
    advisorAcceptanceNote: wf.advisorAcceptanceNote || "",
    advisorName: student?.advisor?.name || "อาจารย์ที่ปรึกษา",
    fileName: wf.companyResponseFileName || "",
    fileUrl: wf.companyResponseFileUrl || "",
    uploadedAt: wf.companyResponseUploadedAt || "",
    submittedByStudent: Boolean(wf.companyResponseSubmittedByStudent),
    note: wf.companyResponseStatus === "REJECTED" ? wf.companyResponseNote || "" : "",
    academicConfig: {
      currentAcademicYear: cfg.currentAcademicYear || "2568",
      deanSignatory: cfg.deanSignatory || "ผู้ช่วยศาสตราจารย์ ดร.พรเทพ โรจนวสุ",
      deanPosition: cfg.deanPosition || "คณบดีคณะเทคโนโลยีสารสนเทศและการสื่อสาร",
      officePhone: cfg.officePhone || "",
    },
    letterStudents: letterStudents && letterStudents.length > 0 ? letterStudents : fallbackStudent,
  };
}

router.get("/acceptance-form", async (req: Request, res: Response) => {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.session.user!.id },
      include: { placement: true, companies: true },
    });
    if (!student) return res.json({ success: true, acceptance: toStudentAcceptanceView(null) });
    const state = loadSuperAdminState();
    const wf = state.docWorkflowMap[String(student.id)];

    // รายชื่อในหนังสือมาจาก "ฉบับหนังสือ" (snapshot ณ วันที่ออก) — ถ้าเป็นข้อมูลเก่าที่ยังไม่มีฉบับ ใช้วิธีเดิม
    const reqBatch = getLetterBatch(state, wf?.requestLetterBatchId);
    const dspBatch = getLetterBatch(state, wf?.dispatchLetterBatchId);
    let letterStudents: any[] = reqBatch ? reqBatch.students : [];
    if (wf && !reqBatch) {
      const batchIds = wf.requestLetterBatchId
        ? Object.values(state.docWorkflowMap)
            .filter((item: any) => item && item.requestLetterBatchId === wf.requestLetterBatchId)
            .map((item: any) => Number(item.studentId))
            .filter((n) => !isNaN(n))
        : [student.id];
      const targetIds = batchIds.length > 0 ? batchIds : [student.id];
      const dbStudents = await prisma.student.findMany({
        where: { id: { in: targetIds } },
        include: { placement: true },
      });
      letterStudents = dbStudents.map((s) => toBatchStudent(s));
    }

    const view: any = toStudentAcceptanceView(wf, state, student, letterStudents);

    // ส่วนหัว/ท้ายหนังสือ (เรียน / ผู้ประสานงาน / ผู้ลงนาม): ฉบับที่ออกแล้วใช้ค่า ณ วันที่ออก
    // ฉบับเก่าที่ไม่มีค่า → ใช้ข้อมูลปัจจุบัน (ผู้รับจากข้อมูลบริษัทของนิสิตเอง · อาจารย์รายวิชาตามสาขาในรายชื่อ)
    // useOwnPlacement=false: หนังสือบริษัทเดิม (ฉบับก่อนหน้า) — ข้อมูลบริษัทปัจจุบันของนิสิตไม่ใช่ผู้รับของฉบับนั้น
    const headerOf = (batch: any, listStudents: any[], useOwnPlacement = true) => {
      const fallback = letterHeaderSnapshot(state.academicConfig, [
        { major: student.major, placement: useOwnPlacement ? student.placement : null },
        ...(listStudents || []).map((s: any) => ({ major: s?.major })),
      ]);
      return {
        recipientName: batch?.recipientName || fallback.recipientName,
        recipientPosition: batch?.recipientName ? batch.recipientPosition || "" : fallback.recipientPosition,
        instructors: batch?.instructors?.length ? batch.instructors : fallback.instructors,
        // ผู้ลงนาม: ใช้ค่าตั้งค่าปัจจุบันเสมอ (แก้ในตั้งค่าแล้วหนังสือทุกฉบับเปลี่ยนตาม) · ไม่มีค่า → ค่าที่เก็บไว้ในฉบับ
        signatoryName: fallback.signatoryName || batch?.signatoryName || "",
        signatoryPosition: fallback.signatoryPosition || batch?.signatoryPosition || "",
      };
    };
    view.requestLetterHeader = headerOf(reqBatch, view.letterStudents);

    if (wf) {
      if (reqBatch) {
        view.requestLetterDocNo = reqBatch.docNo;
        view.requestLetterDate = reqBatch.letterDate;
        view.requestLetterSignatureSnapshot = state.academicConfig?.signatureDataUrl || reqBatch.signatureSnapshot || "";
        view.companyName = reqBatch.companyName || view.companyName;
      }
      // หนังสือส่งตัวแนบรายชื่อเฉพาะนิสิตที่บริษัทตอบรับ (ไม่ใช่รายชื่อของหนังสือขอความอนุเคราะห์)
      view.dispatchLetterStudents = dspBatch ? dspBatch.students : view.letterStudents;
      view.dispatchLetterHeader = headerOf(dspBatch, view.dispatchLetterStudents);
      if (dspBatch) {
        view.dispatchLetterDocNo = dspBatch.docNo;
        view.dispatchLetterDate = dspBatch.letterDate;
        view.dispatchLetterSignatureSnapshot = state.academicConfig?.signatureDataUrl || dspBatch.signatureSnapshot || "";
      }
    }
    // หนังสือฉบับก่อนหน้าที่มีชื่อนิสิต (เช่น บริษัทเดิมที่ปฏิเสธ) — ยังดาวน์โหลดย้อนหลังได้
    const currentIds = new Set([wf?.requestLetterBatchId, wf?.dispatchLetterBatchId].filter(Boolean));
    view.pastLetters = batchesForStudent(state, student.id)
      .filter((b) => !currentIds.has(b.batchId))
      .map((b) => ({
        batchId: b.batchId,
        type: b.type,
        companyName: b.companyName,
        docNo: b.docNo,
        letterDate: b.letterDate,
        signatureSnapshot: state.academicConfig?.signatureDataUrl || b.signatureSnapshot || "",
        students: b.students,
        header: headerOf(b, b.students, false),
      }));

    res.json({ success: true, acceptance: view });
  } catch (err) {
    console.error("GET /api/student/acceptance-form error:", err);
    res.status(500).json({ success: false, message: "ดึงข้อมูลแบบตอบรับไม่สำเร็จ" });
  }
});

// 4.1 อัปโหลดแบบตอบรับจากสถานประกอบการ (ส่งต่อให้อาจารย์ที่ปรึกษาตรวจก่อน)
router.post("/acceptance-form", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.session.user!.id } });
    if (!student) {
      return res.status(400).json({ success: false, message: "ไม่พบข้อมูลนิสิต" });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "กรุณาเลือกไฟล์แบบตอบรับ (PDF หรือรูปภาพ)" });
    }

    const state = loadSuperAdminState();
    const wfKey = String(student.id);
    const wf = state.docWorkflowMap[wfKey];
    if (!wf || !wf.requestLetterIssued) {
      return res.status(400).json({
        success: false,
        message: "ยังไม่มีการออกหนังสือขอความอนุเคราะห์ จึงยังอัปโหลดแบบตอบรับไม่ได้",
      });
    }
    if (wf.companyResponseStatus === "ACCEPTED") {
      return res.status(400).json({
        success: false,
        message: "เจ้าหน้าที่ยืนยันผลการตอบรับเรียบร้อยแล้ว หากต้องการแก้ไขกรุณาติดต่อเจ้าหน้าที่คณะ",
      });
    }

    const { buffer, originalname, mimetype } = req.file;
    let cleanFileName = originalname;
    try {
      const utf8Name = Buffer.from(originalname, "latin1").toString("utf8");
      if (!utf8Name.includes("\ufffd")) cleanFileName = utf8Name;
    } catch {
      // ignore
    }

    const fileUrl = await uploadToCloudinary(buffer, cleanFileName, "acceptance_forms");
    const ocr = await analyzeAcceptanceForm(buffer, cleanFileName, mimetype, fileUrl);

    // โหลด state ใหม่อีกครั้งหลังรอ OCR เพื่อไม่ทับการเปลี่ยนแปลงที่เกิดระหว่างนั้น
    const latest = loadSuperAdminState();
    const current = latest.docWorkflowMap[wfKey] || wf;
    latest.docWorkflowMap[wfKey] = {
      ...current,
      companyResponseStatus: "WAITING_ADVISOR_APPROVAL",
      companyResponseFileName: cleanFileName,
      companyResponseFileUrl: fileUrl,
      companyResponseUploadedAt: new Date().toISOString(),
      companyResponseSubmittedByStudent: true,
      companyResponseOcr: ocr,
      advisorAcceptanceStatus: "PENDING",
      advisorAcceptanceNote: "",
      advisorAcceptanceReviewedAt: "",
    };
    saveSuperAdminState(latest);

    res.json({
      success: true,
      message: "อัปโหลดแบบตอบรับเรียบร้อยแล้ว ระบบได้ส่งเรื่องให้อาจารย์ที่ปรึกษาตรวจสอบก่อน",
      acceptance: toStudentAcceptanceView(latest.docWorkflowMap[wfKey], latest, student),
    });
  } catch (err: any) {
    console.error("POST /api/student/acceptance-form error:", err);
    res.status(500).json({ success: false, message: "อัปโหลดแบบตอบรับไม่สำเร็จ: " + (err?.message || err) });
  }
});

// ==========================================
// 5. Checklist แม่แบบและประเมินบริษัท
// ==========================================
router.get("/checklist-template", async (req: Request, res: Response) => {
  try {
    // แบบฟอร์มตามสาขาของนิสิต (ไม่มีแบบฟอร์มเฉพาะสาขา -> แบบฟอร์มกลาง) — src/utils/checklistForms.ts
    const me = await prisma.student.findUnique({ where: { userId: req.session.user!.id }, select: { major: true } });
    const formId = await getChecklistFormIdForMajor(me?.major);
    const activeVersion = formId
      ? await prisma.checklistVersion.findUnique({
          where: { id: formId },
          include: {
            sections: {
              orderBy: { order: "asc" },
              include: {
                items: {
                  where: { isActive: true },
                  orderBy: { order: "asc" },
                },
              },
            },
          },
        })
      : null;

    const sections = activeVersion ? activeVersion.sections : [];
    res.json({ success: true, version: activeVersion, sections });
  } catch (err) {
    console.error("GET /api/student/checklist-template error:", err);
    res.status(500).json({ success: false, message: "ดึงแบบฟอร์ม Checklist ไม่สำเร็จ" });
  }
});

router.get("/companies", async (req: Request, res: Response) => {
  try {
    const state = loadSuperAdminState();
    const masterCompanies = state.companyMasterData.filter((c) => c.status !== "BLACKLIST");

    const student = await getStudentByUserId(req.session.user!.id);
    if (!student) {
      return res.json({
        success: true,
        companies: [],
        masterCompanies,
        archivedCompanies: [],
        majorRule: null,
      });
    }

    const companies = await prisma.company.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "asc" },
      include: {
        answers: true,
        submission: true,
      },
    });

    const archivedCompanies = state.archivedApplications.filter(
      (a) => a.studentId === student.id || a.studentCode === student.studentCode
    );
    const eligibilityRaw = await getStudentWindowEligibility(student);
    const eligibility = {
      ...eligibilityRaw,
      openWindows: excludeUsedWindows(eligibilityRaw.openWindows, getRoundStateFor(student)),
    };

    res.json({
      success: true,
      companies,
      masterCompanies,
      archivedCompanies,
      // บริษัทที่อาจารย์ที่ปรึกษาอนุญาตให้แก้ไขข้อมูลบริษัท/ผู้ติดต่อ หลัง Checklist อนุมัติแล้ว
      infoEditUnlockedCompanyIds: companies
        .filter((c) => state.companyInfoEditUnlocks?.[String(c.id)])
        .map((c) => c.id),
      // รอบที่เปิดรับยื่นอยู่ตอนนี้ (1 รอบ = ผูกอัตโนมัติ / หลายรอบ = แสดง dropdown ให้เลือก)
      openInternshipWindows: eligibility.openWindows.map((w) => ({
        id: w.id,
        term: w.term,
        label: windowDisplayLabel(w),
        cohortCode: w.cohort.code,
        closeDate: w.closeDate ? w.closeDate.toISOString().slice(0, 10) : "",
      })),
      assignedWindowId: student.internshipWindowId || null,
      isStraggler: eligibility.isStraggler,
      canSubmitChecklist: eligibility.openWindows.length > 0,
      placement: student.placement || null,
      // ช่วงฝึกตามรอบออกฝึกที่ผูกไว้ (เจ้าหน้าที่กำหนด) — ใช้แสดง "ช่วงเวลาฝึกงาน" ในการ์ด Checklist
      windowPeriod: {
        internStartDate: student.internshipWindow?.internStartDate?.toISOString().slice(0, 10) || "",
        internEndDate: student.internshipWindow?.internEndDate?.toISOString().slice(0, 10) || "",
      },
    });
  } catch (err) {
    console.error("GET /api/student/companies error:", err);
    res.status(500).json({ success: false, message: "ดึงข้อมูลบริษัทไม่สำเร็จ" });
  }
});

// ย้าย Checklist บริษัทที่อาจารย์ที่ปรึกษาไม่อนุมัติ (REJECTED) เข้า Archive แบบเก็บข้อมูลครบ
// (ตำแหน่ง/ที่อยู่/ผู้ติดต่อ/คำตอบ Checklist) แล้วลบออกจากรายการปัจจุบัน เพื่อเริ่ม Checklist บริษัทใหม่
// หมายเหตุ: เรียก saveSuperAdminState(state) เองหลังเรียกฟังก์ชันนี้
async function archiveRejectedChecklistCompany(
  state: ReturnType<typeof loadSuperAdminState>,
  student: StudentWithRelations,
  companyId: number
) {
  const company = await prisma.company.findFirst({
    where: { id: companyId, studentId: student.id },
    include: { answers: { include: { checklistItem: true } } },
  });
  if (!company || company.checklistStatus !== "REJECTED") return false;

  // ข้อมูลบริษัท/ผู้ติดต่อถูกเก็บไว้ใน InternshipPlacement ตอนบันทึก Checklist
  const p = student.placement;
  const placementMatches = Boolean(p && (!p.companyNameTh || p.companyNameTh === company.name));
  const info = placementMatches ? p : null;

  state.archivedApplications.unshift({
    id: `ARCH-${Date.now().toString().slice(-6)}-${company.id}`,
    studentId: student.id,
    studentCode: student.studentCode,
    studentName: student.nameTh,
    major: student.major || "วิศวกรรมซอฟต์แวร์",
    companyName: company.name,
    position: info?.position || "-",
    companyAddress: info?.companyAddress || "-",
    province: info?.province || "-",
    contactPersonName: info?.contactPersonName || "-",
    phone: info?.companyPhone1 || "-",
    email: info?.companyEmail || "-",
    reason: "ADVISOR_REJECTED",
    note: company.checklistNote || "อาจารย์ที่ปรึกษาไม่อนุมัติ Checklist (ปลดล็อกให้ยื่นบริษัทใหม่)",
    answers: company.answers.map((a) => ({
      itemId: a.checklistItemId,
      description: a.checklistItem?.description || "",
      checked: a.checked,
      detail: a.detail || "",
    })),
    archivedAt: new Date().toISOString(),
  });

  await prisma.companyChecklistAnswer.deleteMany({ where: { companyId: company.id } });
  await prisma.companySubmission.deleteMany({ where: { companyId: company.id } });
  await prisma.company.delete({ where: { id: company.id } });

  if (p && placementMatches) {
    await prisma.internshipPlacement.update({
      where: { id: p.id },
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
      },
    });
  }
  return true;
}

// นิสิตกด "ยื่นบริษัทใหม่" หลังอาจารย์ที่ปรึกษาไม่อนุมัติ Checklist → เก็บบริษัทเดิมเข้า Archive ทันที
router.post("/companies/:id/archive", async (req: Request, res: Response) => {
  try {
    const student = await getStudentByUserId(req.session.user!.id);
    if (!student) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลนิสิต" });
    }
    if (student.isDropped) {
      return res.status(403).json({ success: false, message: "บัญชีอยู่ในสถานะดรอป ไม่สามารถยื่นบริษัทใหม่ได้" });
    }
    const companyId = parseInt(req.params.id as string, 10);
    const state = loadSuperAdminState();
    const archived = await archiveRejectedChecklistCompany(state, student, companyId);
    if (!archived) {
      return res.status(400).json({
        success: false,
        message: "เก็บเข้าประวัติได้เฉพาะ Checklist ที่อาจารย์ที่ปรึกษาไม่อนุมัติเท่านั้น",
      });
    }
    saveSuperAdminState(state);
    res.json({ success: true, message: "เก็บบริษัทเดิมเข้าประวัติแล้ว กรุณากรอก Checklist บริษัทแห่งใหม่" });
  } catch (err: any) {
    console.error("POST /api/student/companies/:id/archive error:", err);
    res.status(500).json({ success: false, message: "เก็บเข้าประวัติไม่สำเร็จ: " + err.message });
  }
});

// บันทึกบริษัทและคำตอบ Checklist (สร้างใหม่ หรือ บันทึกชุดข้อมูล — นโยบายยื่นได้ทีละ 1 บริษัท + Archive + Master Data Auto-suggest)
router.post("/companies", async (req: Request, res: Response) => {
  try {
    const student = await getStudentByUserId(req.session.user!.id);
    if (!student) {
      return res.status(400).json({
        success: false,
        message: "กรุณากรอกข้อมูลส่วนตัวนิสิตก่อน",
      });
    }

    // เลือกได้ทางเดียว: มีใบสมัครสหกิจที่ยังไม่จบ (ยังไม่ "ไม่ผ่าน" / "ยกเลิก") -> ยื่นสถานประกอบการแบบฝึกงานไม่ได้
    const activeCoop = await prisma.coopApplication.findFirst({
      where: { studentId: student.id, status: { notIn: COOP_FINAL_STATUSES } },
      select: { companyName: true },
    });
    if (activeCoop) {
      return res.status(400).json({
        success: false,
        message: `คุณสมัครสหกิจศึกษา "${activeCoop.companyName}" อยู่ (เลือกได้ทางเดียว: ฝึกงาน หรือ สหกิจ) — ถ้าไม่ผ่านการคัดเลือกหรือยกเลิกใบสมัครแล้ว จึงจะยื่นสถานประกอบการได้`,
      });
    }

    const state = loadSuperAdminState();
    // ตรวจรอบออกฝึก (รุ่น + สาขา): ต้องมีรอบที่ปลดล็อกและอยู่ในช่วงเปิดยื่น (หรือเปิดต่อพิเศษ)
    const eligibilityRaw = await getStudentWindowEligibility(student);
    const eligibility = {
      ...eligibilityRaw,
      openWindows: excludeUsedWindows(eligibilityRaw.openWindows, getRoundStateFor(student)),
    };
    if (eligibility.openWindows.length === 0) {
      const next = eligibility.windows.find((w) => w.status === "NOT_YET_OPEN");
      return res.status(400).json({
        success: false,
        message: next
          ? `รอบออกฝึก ${next.term} ของสาขาคุณยังไม่ถึงวันเปิดยื่น (เปิด ${next.openDate?.toISOString().slice(0, 10)})`
          : "สาขาของคุณยังไม่เปิดรอบยื่นขอฝึกงาน (รอปลดล็อกจากเจ้าหน้าที่คณะ)",
      });
    }
    // ผูกรอบออกฝึก: เปิดรอบเดียว = อัตโนมัติ / หลายรอบ = นิสิตต้องเลือก
    const resolvedWindow = resolveSubmissionWindow(
      eligibility.openWindows,
      req.body.internshipWindowId,
      student.internshipWindowId
    );
    if (!resolvedWindow.window) {
      return res.status(400).json({ success: false, message: resolvedWindow.error, needWindowSelection: true });
    }

    // 🔒 ตรวจสอบว่าชั่วโมงการอบรมครบ และอัปโหลด CV แล้ว (อาจารย์คอมเมนต์อย่างเดียว ไม่ต้องรออนุมัติ)
    const approvedTrainings = (student.trainingRecords || []).filter((t) => t.status === "APPROVED");
    const approvedSoft = approvedTrainings
      .filter((t) => t.skillType === "SOFT")
      .reduce((sum, t) => sum + t.hours, 0);
    const approvedHard = approvedTrainings
      .filter((t) => t.skillType === "HARD")
      .reduce((sum, t) => sum + t.hours, 0);
    const isTrainingComplete = approvedSoft >= 12 && approvedHard >= 18;
    if (!isTrainingComplete || !hasCv(student.cv)) {
      return res.status(400).json({
        success: false,
        message: "ยังยื่นสถานประกอบการไม่ได้ เนื่องจากชั่วโมงการอบรมยังไม่ครบ หรือยังไม่ได้อัปโหลด Resume (CV)",
      });
    }

    // [นโยบายใหม่ ข้อ 4] บังคับให้นิสิตยื่นขอฝึกงานได้ทีละ 1 แห่ง
    // หากบริษัทเดิมไม่ผ่าน (REJECTED) จะถูกย้ายเข้า Archive อัตโนมัติแล้วปลดล็อกให้ยื่นแห่งใหม่ได้
    const existingCompanies = await prisma.company.findMany({
      where: { studentId: student.id },
    });

    const activePendingOrApproved = existingCompanies.filter(
      (c) => c.checklistStatus === "PENDING" || c.checklistStatus === "APPROVED"
    );

    if (activePendingOrApproved.length >= 1) {
      return res.status(400).json({
        success: false,
        message:
          "นโยบายคณะ ICT: บังคับให้นิสิตยื่นขอฝึกงานได้ทีละ 1 แห่งเท่านั้น (หากอาจารย์ที่ปรึกษาไม่อนุมัติ หรือบริษัทปฏิเสธ ระบบจึงจะปลดล็อกให้ยื่นบริษัทแห่งใหม่ได้)",
      });
    }

    // หากมีบริษัทที่ถูก REJECTED ค้างอยู่ ให้ย้ายเข้า Archive แบบย่อและเคลียร์เพื่อให้ยื่นบริษัทใหม่ได้
    const rejectedCompanies = existingCompanies.filter((c) => c.checklistStatus === "REJECTED");
    for (const rej of rejectedCompanies) {
      await archiveRejectedChecklistCompany(state, student, rej.id);
    }

    const {
      name,
      answers,
      position,
      contactPersonName,
      contactPersonPosition,
      companyAddress,
      province,
      companyPhone1,
      companyPhone2,
      companyEmail,
      latitude,
      longitude,
    } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "กรุณาระบุชื่อบริษัท" });
    }

    const cleanName = name.trim();
    const norm = cleanName.replace(/\s+/g, "").toLowerCase();
    const matchedMaster = state.companyMasterData.find(
      (c) => c.nameTh.replace(/\s+/g, "").toLowerCase() === norm
    );

    if (!matchedMaster) {
      state.companyMasterData.unshift({
        id: `COMP-NEW-${Date.now().toString().slice(-5)}`,
        nameTh: cleanName,
        nameEn: "-",
        province: province || "รอระบุจังหวัด",
        address: companyAddress || "รอตรวจสอบที่อยู่",
        hrContactName: contactPersonName || "-",
        hrPhone: companyPhone1 || "-",
        hrEmail: companyEmail || "-",
        recommendedPositions: position || "นิสิตฝึกงาน / สหกิจศึกษา",
        status: "PENDING_REVIEW",
        submittedByStudentCode: student.studentCode,
        submittedByStudentName: student.nameTh,
        createdAt: new Date().toISOString(),
      });
    }

    // สร้างหรืออัปเดตข้อมูลสถานที่ฝึกงาน (InternshipPlacement) ให้ตรงกับที่นิสิตกรอกใน Checklist
    const finalCompName = matchedMaster ? matchedMaster.nameTh : cleanName;
    const finalAddress = companyAddress || matchedMaster?.address || "รอระบุที่อยู่";
    const finalProvince = province || matchedMaster?.province || "รอระบุจังหวัด";
    const finalContact = contactPersonName || matchedMaster?.hrContactName || "ฝ่ายทรัพยากรบุคคล (HR)";
    const finalContactPos = contactPersonPosition || "ผู้จัดการฝ่ายบุคคล";
    const finalPhone = companyPhone1 || matchedMaster?.hrPhone || "-";
    const finalPhone2 = companyPhone2 || "-";
    const finalEmail = companyEmail || matchedMaster?.hrEmail || "-";
    const finalPosition = position || "Software Developer";

    if (student.placement) {
      await prisma.internshipPlacement.update({
        where: { id: student.placement.id },
        data: {
          companyNameTh: finalCompName,
          position: finalPosition,
          contactPersonName: finalContact,
          contactPersonPosition: finalContactPos,
          companyAddress: finalAddress,
          province: finalProvince,
          companyPhone1: finalPhone,
          companyPhone2: finalPhone2,
          companyEmail: finalEmail,
          ...parseCoords(latitude, longitude),
          status: "PENDING",
        },
      });
    } else {
      await prisma.internshipPlacement.create({
        data: {
          studentId: student.id,
          companyNameTh: finalCompName,
          position: finalPosition,
          contactPersonName: finalContact,
          contactPersonPosition: finalContactPos,
          companyAddress: finalAddress,
          province: finalProvince,
          companyPhone1: finalPhone,
          companyPhone2: finalPhone2,
          companyEmail: finalEmail,
          ...parseCoords(latitude, longitude),
          status: "PENDING",
        },
      });
    }

    // รีเซ็ตคิวงานเอกสารให้พร้อมสำหรับบริษัทใหม่
    const wfKey = String(student.id);
    state.docWorkflowMap[wfKey] = {
      studentId: student.id,
      studentCode: student.studentCode,
      companyName: finalCompName,
      interviewDate: "2026-02-15",
      requestLetterIssued: false,
      requestLetterDocNo: "",
      requestLetterDate: "",
      companyResponseStatus: "NOT_SENT",
      companyResponseFileName: "",
      companyResponseFileUrl: "",
      companyResponseUploadedAt: "",
      companyResponseSubmittedByStudent: false,
      companyResponseOcr: undefined,
      advisorAcceptanceStatus: "NONE",
      dispatchLetterIssued: false,
      isLocked: false,
    };
    saveSuperAdminState(state);

    // สร้างบริษัทใหม่
    // ผูกแบบฟอร์มตามสาขาของนิสิต ณ วันที่ยื่น (แก้แบบฟอร์มภายหลังไม่กระทบ Checklist ที่ยื่นแล้ว)
    const formId = await getChecklistFormIdForMajor(student.major);
    const company = await prisma.company.create({
      data: {
        studentId: student.id,
        name: matchedMaster ? matchedMaster.nameTh : cleanName,
        checklistVersionId: formId ?? 1,
        checklistStatus: "PENDING",
        submission: {
          create: {
            status: "NOT_SUBMITTED",
          },
        },
      },
    });

    // ถ้ามีคำตอบ checklist ส่งมาด้วย ให้บันทึกคำตอบ
    if (Array.isArray(answers) && answers.length > 0) {
      for (const ans of answers) {
        if (ans.checklistItemId) {
          await prisma.companyChecklistAnswer.create({
            data: {
              companyId: company.id,
              checklistItemId: parseInt(ans.checklistItemId, 10),
              checked: Boolean(ans.checked),
              detail: ans.detail ? String(ans.detail).trim() : null,
            },
          });
        }
      }
    }

    const createdCompany = await prisma.company.findUnique({
      where: { id: company.id },
      include: { answers: true, submission: true },
    });

    await prisma.student.update({
      where: { id: student.id },
      data: { internshipWindowId: resolvedWindow.window.id },
    });

    res.json({
      success: true,
      message: `บันทึกข้อมูลบริษัทและ Checklist เรียบร้อยแล้ว (รอบออกฝึก ${windowDisplayLabel(resolvedWindow.window)})`,
      company: createdCompany,
      internshipWindowId: resolvedWindow.window.id,
    });
  } catch (err: any) {
    console.error("POST /api/student/companies error:", err);
    res.status(500).json({ success: false, message: "บันทึกไม่สำเร็จ: " + err.message });
  }
});

// แก้ไขชื่อบริษัทและคำตอบ Checklist
router.put("/companies/:id", async (req: Request, res: Response) => {
  try {
    const student = await getStudentByUserId(req.session.user!.id);
    if (!student) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลนิสิต" });
    }
    const companyId = parseInt(req.params.id as string, 10);
    const {
      name,
      answers,
      position,
      contactPersonName,
      contactPersonPosition,
      companyAddress,
      province,
      companyPhone1,
      companyPhone2,
      companyEmail,
      latitude,
      longitude,
    } = req.body;

    const company = await prisma.company.findFirst({
      where: { id: companyId, studentId: student.id },
    });

    if (!company) {
      return res.status(404).json({ success: false, message: "ไม่พบบริษัทนี้" });
    }

    if (company.checklistStatus === "APPROVED") {
      // อาจารย์ที่ปรึกษากดอนุญาตให้แก้ไข → แก้ได้เฉพาะข้อมูลบริษัท/ผู้ติดต่อ (ไม่แก้ชื่อบริษัท/คำตอบ Checklist)
      const editState = loadSuperAdminState();
      const unlockKey = String(company.id);
      if (!editState.companyInfoEditUnlocks?.[unlockKey]) {
        return res.status(400).json({
          success: false,
          message: "อาจารย์ที่ปรึกษาอนุมัติ Checklist แล้ว ไม่สามารถแก้ไขข้อมูลได้ (ติดต่ออาจารย์ที่ปรึกษาเพื่อขอแก้ไข)",
        });
      }
      const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");
      const infoData = {
        position: clean(position),
        contactPersonName: clean(contactPersonName),
        contactPersonPosition: clean(contactPersonPosition),
        companyAddress: clean(companyAddress),
        province: clean(province),
        companyPhone1: clean(companyPhone1),
        companyPhone2: clean(companyPhone2),
        companyEmail: clean(companyEmail),
        ...parseCoords(latitude, longitude),
      };
      if (!infoData.position || !infoData.companyAddress || !infoData.province) {
        return res.status(400).json({ success: false, message: "กรุณากรอกตำแหน่ง ที่อยู่ และจังหวัดให้ครบ" });
      }
      if (student.placement) {
        await prisma.internshipPlacement.update({
          where: { id: student.placement.id },
          data: { ...infoData, companyNameTh: company.name },
        });
      } else {
        await prisma.internshipPlacement.create({
          data: { studentId: student.id, ...infoData, companyNameTh: company.name, status: "PENDING" },
        });
      }
      delete editState.companyInfoEditUnlocks![unlockKey];
      saveSuperAdminState(editState);

      const unchanged = await prisma.company.findUnique({
        where: { id: companyId },
        include: { answers: true, submission: true },
      });
      return res.json({
        success: true,
        message: "บันทึกการแก้ไขข้อมูลบริษัท/ผู้ติดต่อเรียบร้อยแล้ว (Checklist ยังคงสถานะอนุมัติ)",
        company: unchanged,
      });
    }

    // อัปเดตชื่อบริษัท
    if (name && name.trim()) {
      await prisma.company.update({
        where: { id: companyId },
        data: { name: name.trim() },
      });
    }

    // อัปเดตข้อมูลสถานที่ฝึกงาน (InternshipPlacement) ถ้ามีส่งมา
    if (position || companyAddress || contactPersonName || province || companyPhone1) {
      const placementData: any = {};
      if (name && name.trim()) placementData.companyNameTh = name.trim();
      if (position) placementData.position = position;
      if (contactPersonName) placementData.contactPersonName = contactPersonName;
      if (contactPersonPosition) placementData.contactPersonPosition = contactPersonPosition;
      if (companyAddress) placementData.companyAddress = companyAddress;
      if (province) placementData.province = province;
      if (companyPhone1) placementData.companyPhone1 = companyPhone1;
      if (companyPhone2) placementData.companyPhone2 = companyPhone2;
      if (companyEmail) placementData.companyEmail = companyEmail;
      Object.assign(placementData, parseCoords(latitude, longitude));

      if (student.placement) {
        await prisma.internshipPlacement.update({
          where: { id: student.placement.id },
          data: placementData,
        });
      } else {
        await prisma.internshipPlacement.create({
          data: {
            studentId: student.id,
            companyNameTh: name?.trim() || "สถานประกอบการ",
            position: position || "Software Developer",
            contactPersonName: contactPersonName || "ฝ่ายทรัพยากรบุคคล (HR)",
            contactPersonPosition: contactPersonPosition || "-",
            companyAddress: companyAddress || "-",
            province: province || "-",
            companyPhone1: companyPhone1 || "-",
            companyPhone2: companyPhone2 || "-",
            companyEmail: companyEmail || "-",
            ...parseCoords(latitude, longitude),
            status: "PENDING",
          },
        });
      }
    }

    // อัปเดตคำตอบ checklist
    if (Array.isArray(answers)) {
      for (const ans of answers) {
        if (ans.checklistItemId) {
          await prisma.companyChecklistAnswer.upsert({
            where: {
              companyId_checklistItemId: {
                companyId,
                checklistItemId: parseInt(ans.checklistItemId, 10),
              },
            },
            update: {
              checked: Boolean(ans.checked),
              detail: ans.detail ? String(ans.detail).trim() : null,
            },
            create: {
              companyId,
              checklistItemId: parseInt(ans.checklistItemId, 10),
              checked: Boolean(ans.checked),
              detail: ans.detail ? String(ans.detail).trim() : null,
            },
          });
        }
      }
    }

    // อัปเดตรอบออกฝึก (ถ้ามีรอบเปิดอยู่) — ไม่บังคับตอนแก้ไข เพื่อไม่ให้แก้ Checklist เดิมไม่ได้เมื่อรอบปิดไปแล้ว
    const editEligibility = await getStudentWindowEligibility(student);
    const editWindow = resolveSubmissionWindow(
      editEligibility.openWindows,
      req.body.internshipWindowId,
      student.internshipWindowId
    ).window;
    if (editWindow && editWindow.id !== student.internshipWindowId) {
      await prisma.student.update({ where: { id: student.id }, data: { internshipWindowId: editWindow.id } });
    }

    const updatedCompany = await prisma.company.findUnique({
      where: { id: companyId },
      include: { answers: true, submission: true },
    });

    res.json({
      success: true,
      message: "อัปเดตข้อมูล Checklist สำเร็จ",
      company: updatedCompany,
    });
  } catch (err) {
    console.error("PUT /api/student/companies/:id error:", err);
    res.status(500).json({ success: false, message: "อัปเดตไม่สำเร็จ" });
  }
});

// ==========================================
// 6. สถานะการยื่น (Submission Status)
//    (แสดงเฉพาะบริษัทที่ checklistStatus === 'APPROVED')
// ==========================================
router.get("/submissions", async (req: Request, res: Response) => {
  try {
    const student = await getStudentByUserId(req.session.user!.id);
    if (!student) {
      return res.json({ success: true, approvedCompanies: [] });
    }

    // ดึงเฉพาะบริษัทที่อาจารย์อนุมัติ Checklist ผ่านแล้ว
    const approvedCompanies = await prisma.company.findMany({
      where: {
        studentId: student.id,
        checklistStatus: "APPROVED",
      },
      include: {
        submission: true,
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({ success: true, approvedCompanies });
  } catch (err) {
    console.error("GET /api/student/submissions error:", err);
    res.status(500).json({ success: false, message: "ดึงสถานะการยื่นไม่สำเร็จ" });
  }
});

router.put("/submissions/:companyId", async (req: Request, res: Response) => {
  try {
    const student = await getStudentByUserId(req.session.user!.id);
    if (!student) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลนิสิต" });
    }
    const companyId = parseInt(req.params.companyId as string, 10);
    const { date, time } = req.body;

    const company = await prisma.company.findFirst({
      where: { id: companyId, studentId: student.id },
      include: { submission: true },
    });

    if (!company) {
      return res.status(404).json({ success: false, message: "ไม่พบบริษัทนี้" });
    }

    // สถานะการยื่นอัปเดตได้เฉพาะบริษัทที่อาจารย์อนุมัติ Checklist แล้ว (ตรงกับรายการที่ GET /submissions ส่งให้)
    if (company.checklistStatus !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "บริษัทนี้ยังไม่ผ่านการอนุมัติ Checklist จึงยังอัปเดตสถานะการยื่นไม่ได้",
      });
    }

    const validStatuses = [
      "NOT_SUBMITTED",
      "SUBMITTED_WAITING",
      "INTERVIEWED_PENDING",
      "INTERVIEW_PASSED",
      "INTERVIEW_FAILED_REAPPLIED",
    ];

    // ไม่ส่ง status มา (เช่น เปลี่ยนแค่วันที่) = ใช้สถานะเดิม
    const status = req.body.status ?? company.submission?.status ?? "NOT_SUBMITTED";
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "สถานะการยื่นไม่ถูกต้อง" });
    }

    // วันที่ที่นิสิตเลือกจากปฏิทิน (YYYY-MM-DD) — ไม่ส่งมา = ใช้เวลาปัจจุบัน (@updatedAt)
    let updatedAt: Date | undefined;
    if (date !== undefined && date !== null && date !== "") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
        return res.status(400).json({ success: false, message: "รูปแบบวันที่ไม่ถูกต้อง" });
      }
      // เวลานัด (HH:MM ตามเวลาไทย) — ไม่ส่งมา = เที่ยงวัน
      let hhmm = "12:00";
      if (time !== undefined && time !== null && time !== "") {
        const tm = /^(\d{2}):(\d{2})$/.exec(String(time));
        if (!tm || Number(tm[1]) > 23 || Number(tm[2]) > 59) {
          return res.status(400).json({ success: false, message: "รูปแบบเวลาไม่ถูกต้อง" });
        }
        hhmm = String(time);
      }
      updatedAt = new Date(`${date}T${hhmm}:00+07:00`);
      if (isNaN(updatedAt.getTime())) {
        return res.status(400).json({ success: false, message: "รูปแบบวันที่ไม่ถูกต้อง" });
      }
      // ตั้งล่วงหน้าได้ตั้งแต่วันนี้ ถึงไม่เกิน 1 เดือน (นับตามเวลาไทย)
      const toYmd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
      const today = toYmd(new Date());
      const [y, m, d] = today.split("-").map(Number);
      // เดือนถัดไป วันเดียวกัน (ถ้าเดือนถัดไปสั้นกว่า เช่น 31 ม.ค. → สิ้นเดือน ก.พ.)
      const daysInNextMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const maxDate = new Date(Date.UTC(y, m, Math.min(d, daysInNextMonth))).toISOString().slice(0, 10);
      if (String(date) < today || String(date) > maxDate) {
        return res.status(400).json({ success: false, message: "เลือกวันที่ได้ตั้งแต่วันนี้ ถึงไม่เกิน 1 เดือนล่วงหน้า" });
      }
    }

    const submission = await prisma.companySubmission.upsert({
      where: { companyId },
      update: { status, ...(updatedAt ? { updatedAt } : {}) },
      create: { companyId, status, ...(updatedAt ? { updatedAt } : {}) },
    });

    res.json({ success: true, message: "อัปเดตสถานะการยื่นสำเร็จ", submission });
  } catch (err) {
    console.error("PUT /api/student/submissions/:companyId error:", err);
    res.status(500).json({ success: false, message: "อัปเดตสถานะการยื่นไม่สำเร็จ" });
  }
});

// [REQ-06] ตรวจสอบว่าสถานประกอบการที่ยื่นฝึกงานจริง ตรงกับ 1 ในบริษัทที่ผ่านการอนุมัติใน Checklist หรือไม่
function checkPlacementMatchesChecklist(placement: any, companies: any[]): boolean {
  if (!placement) return false;
  const approvedList = (companies || []).filter((c) => c.checklistStatus === "APPROVED");
  if (approvedList.length === 0) return false;

  if (placement.companyId && approvedList.some((c) => c.id === placement.companyId)) {
    return true;
  }

  const targetName = (placement.companyNameTh || "").trim().toLowerCase();
  if (!targetName) return false;

  return approvedList.some((c) => {
    const cName = (c.name || "").trim().toLowerCase();
    return cName && (cName === targetName || cName.includes(targetName) || targetName.includes(cName));
  });
}

// ==========================================
// 7. ข้อมูลบริษัทที่เข้าฝึกงานจริง (Internship Placement)
// ==========================================
router.get("/placement", async (req: Request, res: Response) => {
  try {
    const student = await getStudentByUserId(req.session.user!.id);
    if (!student || !student.placement) {
      return res.json({ success: true, placement: null });
    }
    const isMatchedWithChecklist = checkPlacementMatchesChecklist(
      student.placement,
      student.companies || []
    );
    res.json({
      success: true,
      placement: {
        ...student.placement,
        isMatchedWithChecklist,
      },
    });
  } catch (err) {
    console.error("GET /api/student/placement error:", err);
    res.status(500).json({ success: false, message: "ดึงข้อมูลสถานที่ฝึกงานไม่สำเร็จ" });
  }
});

router.post("/placement", async (req: Request, res: Response) => {
  try {
    const student = await getStudentByUserId(req.session.user!.id);
    if (!student) {
      return res.status(400).json({
        success: false,
        message: "กรุณากรอกข้อมูลส่วนตัวนิสิตก่อน",
      });
    }

    const {
      position,
      contactPersonName,
      contactPersonPosition,
      companyAddress,
      companyPhone1,
      companyPhone2,
      companyEmail,
      province,
      companyId,
    } = req.body;

    // ชื่อบริษัทต้องมาจากบริษัทใน Checklist ของนิสิตที่ "สัมภาษณ์ผ่านแล้ว" เท่านั้น (ห้ามพิมพ์เอง)
    // เพื่อให้ชื่อตรงกับฐานข้อมูลสถานประกอบการ และคิวออกหนังสือราชการ
    const selectedCompany = (student.companies || []).find(
      (c) => String(c.id) === String(companyId) && c.submission?.status === "INTERVIEW_PASSED"
    );
    if (!selectedCompany) {
      return res.status(400).json({
        success: false,
        message: "กรุณาเลือกบริษัทที่สัมภาษณ์ผ่านแล้วจากรายการ (ไม่สามารถพิมพ์ชื่อบริษัทเองได้)",
      });
    }
    const companyNameTh = selectedCompany.name;

    // บังคับกรอกครบทุกช่อง (กันการข้าม validation ฝั่งหน้าเว็บ)
    const requiredMap: Record<string, any> = {
      position,
      contactPersonName,
      contactPersonPosition,
      companyAddress,
      companyPhone1,
      companyPhone2,
      companyEmail,
      province,
    };
    const missing = Object.keys(requiredMap).filter(
      (k) => !requiredMap[k] || !String(requiredMap[k]).trim()
    );
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "กรุณากรอกข้อมูลให้ครบทุกช่อง",
        missing,
      });
    }

    const placementData: any = {
      position: position ? String(position).trim() : null,
      companyNameTh: companyNameTh.trim(),
      contactPersonName: contactPersonName ? String(contactPersonName).trim() : null,
      contactPersonPosition: contactPersonPosition ? String(contactPersonPosition).trim() : null,
      companyAddress: companyAddress ? String(companyAddress).trim() : null,
      companyPhone1: companyPhone1 ? String(companyPhone1).trim() : null,
      companyPhone2: companyPhone2 ? String(companyPhone2).trim() : null,
      companyEmail: companyEmail ? String(companyEmail).trim() : null,
      province: province ? String(province).trim() : null,
      companyId: selectedCompany.id,
    };

    const placement = await prisma.internshipPlacement.upsert({
      where: { studentId: student.id },
      update: placementData,
      create: {
        studentId: student.id,
        ...placementData,
      },
    });

    const isMatchedWithChecklist = checkPlacementMatchesChecklist(
      placement,
      student.companies || []
    );

    res.json({
      success: true,
      message: "บันทึกข้อมูลแหล่งฝึกงานสำเร็จ",
      placement: {
        ...placement,
        isMatchedWithChecklist,
      },
    });
  } catch (err: any) {
    console.error("POST /api/student/placement error:", err);
    res.status(500).json({ success: false, message: "บันทึกไม่สำเร็จ: " + err.message });
  }
});

// ==========================================
// 8. สรุปข้อมูลทั้งหมดสำหรับหน้า Dashboard (ภาพ 1 / ภาพ 5)
// ==========================================
router.get("/dashboard-summary", async (req: Request, res: Response) => {
  try {
    const student = await getStudentByUserId(req.session.user!.id);
    if (!student) {
      return res.json({
        success: true,
        hasProfile: false,
        user: req.session.user,
      });
    }

    // รวมชั่วโมงทั้งหมด
    const totalSoft = student.trainingRecords
      .filter((t) => t.skillType === "SOFT")
      .reduce((sum, t) => sum + t.hours, 0);

    const totalHard = student.trainingRecords
      .filter((t) => t.skillType === "HARD")
      .reduce((sum, t) => sum + t.hours, 0);

    // รวมชั่วโมงเฉพาะที่อาจารย์อนุมัติแล้ว (APPROVED)
    const approvedTrainings = student.trainingRecords.filter((t) => t.status === "APPROVED");
    const approvedSoft = approvedTrainings
      .filter((t) => t.skillType === "SOFT")
      .reduce((sum, t) => sum + t.hours, 0);
    const approvedHard = approvedTrainings
      .filter((t) => t.skillType === "HARD")
      .reduce((sum, t) => sum + t.hours, 0);

    // คำนวณสถานะการอบรมโดยรวม (หมายเหตุของอาจารย์อยู่ในแต่ละ record — Dashboard แสดงรายแถว)
    let trainingStatus = "PENDING";

    const hasRejected = student.trainingRecords.some((t) => t.status === "REJECTED");

    if (approvedSoft >= 12 && approvedHard >= 18 && !hasRejected) {
      trainingStatus = "APPROVED";
    } else if (hasRejected || (student.trainingRecords.length > 0 && student.trainingRecords.every(t => t.status === "REJECTED"))) {
      trainingStatus = "REJECTED";
    } else if (student.trainingRecords.length > 0) {
      trainingStatus = "PENDING";
    }

    // บริษัทที่ผ่าน
    const approvedCompanies = student.companies.filter((c) => c.checklistStatus === "APPROVED");

    // บริษัทที่สัมภาษณ์ผ่านแล้ว
    const passedInterview = student.companies.find(
      (c) => c.submission && c.submission.status === "INTERVIEW_PASSED"
    );

    const isMatchedWithChecklist = student.placement
      ? checkPlacementMatchesChecklist(student.placement, student.companies || [])
      : false;

    const state = loadSuperAdminState();
    const defaultTerm = `${student.semester || "2"}/${student.academicYear || "2568"}`;
    const roundState = getStudentRoundState(student.id, defaultTerm);

    const isPlacementApproved = Boolean(student.placement && student.placement.status === "APPROVED");
    const docWf = state.docWorkflowMap?.[String(student.id)];
    const hasDispatchLetter = Boolean(docWf?.dispatchLetterIssued);
    const canCompleteRound1 = isPlacementApproved || hasDispatchLetter || roundState.isRound1Completed;

    // Dashboard: ชื่อผู้ตรวจที่ฝึกงาน — reviewedById = User.id (ไม่ใช่ Staff.id)
    // แสดงเฉพาะเมื่อผู้ตรวจเป็นอาจารย์ (เจ้าหน้าที่ที่อนุมัติผ่านการออกหนังสือส่งตัวไม่นับเป็นผู้ตรวจ → หน้าเว็บใช้อาจารย์ที่ปรึกษาแทน)
    const reviewerStaff = student.placement?.reviewedById
      ? await prisma.staff.findUnique({
          where: { userId: student.placement.reviewedById },
          select: { name: true, isAdvisor: true, isCourseAdmin: true, isSupervisor: true },
        })
      : null;
    const placementReviewerName =
      reviewerStaff && (reviewerStaff.isAdvisor || reviewerStaff.isCourseAdmin || reviewerStaff.isSupervisor)
        ? reviewerStaff.name
        : null;
    // หาสาขา/หลักสูตรที่ server (ใช้ findMajor ตัวเดียวกับทั้งระบบ) → Dashboard ไม่ต้องจับคู่เอง
    const majorInfo = findMajor(student.major);

    res.json({
      success: true,
      hasProfile: true,
      user: req.session.user,
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
        advisor: student.advisor ? student.advisor.name : null,
        majorName: majorInfo ? majorInfo.name : null,
        degreeName: majorInfo ? ICT_DEGREES.find((d) => d.code === majorInfo.degreeCode)?.name || null : null,
      },
      cv: student.cv,
      trainings: {
        records: student.trainingRecords,
        totalSoft,
        totalHard,
        approvedSoft,
        approvedHard,
        status: trainingStatus,
      },
      companies: student.companies,
      approvedCompaniesCount: approvedCompanies.length,
      passedInterviewCompany: passedInterview || null,
      placement: student.placement
        ? {
            ...student.placement,
            isMatchedWithChecklist,
            reviewerName: placementReviewerName,
          }
        : null,
      // ช่วงฝึกงาน: วันเริ่ม/สิ้นสุดจากรอบออกฝึกที่ผูกไว้ (เจ้าหน้าที่กำหนดในหน้า "รอบฝึกงาน & ปลดล็อก")
      internshipPeriod: {
        startDate: student.internshipWindow?.internStartDate || null,
        endDate: student.internshipWindow?.internEndDate || null,
      },
      roundInfo: {
        currentRound: roundState.currentRound,
        currentTerm: roundState.currentTerm || defaultTerm,
        isRound1Completed: roundState.isRound1Completed,
        canCompleteRound1,
        isSameCompanyAsRound1: Boolean(roundState.isSameCompanyAsRound1),
        round1CompletedAt: roundState.round1CompletedAt || null,
        historyRounds: roundState.historyRounds || [],
        // รอบออกฝึกที่เลือกได้สำหรับรอบที่ 2 (จากการตั้งค่ารุ่น/รอบของพี่จอม)
        round2Windows: canCompleteRound1 && roundState.currentRound === 1
          ? (await getRound2Options(student)).map((w) => ({
              id: w.id,
              label: windowDisplayLabel(w),
              cohortCode: w.cohort.code,
              closeDate: w.closeDate ? w.closeDate.toISOString().slice(0, 10) : "",
            }))
          : [],
      },
      internshipLock: await getStudentInternshipLock(student).then((l) => ({ locked: l.locked, message: l.message })),
    });
  } catch (err) {
    console.error("GET /api/student/dashboard-summary error:", err);
    res.status(500).json({ success: false, message: "ดึงข้อมูลสรุป Dashboard ไม่สำเร็จ" });
  }
});

// ==========================================
// 9. การจัดการรอบการฝึกงาน (SCRUM-73: Multi-Round Internship)
// ==========================================
router.post("/round/complete-round-1", async (req: Request, res: Response) => {
  try {
    const student = await getStudentByUserId(req.session.user!.id);
    if (!student) return res.status(404).json({ success: false, message: "ไม่พบข้อมูลนิสิต" });

    const { action } = req.body;
    if (action !== "SAME_COMPANY" && action !== "NEW_COMPANY") {
      return res.status(400).json({ success: false, message: "กรุณาเลือกว่าจะฝึกที่เดิมหรือเปลี่ยนสถานที่ใหม่" });
    }

    const state = loadSuperAdminState();
    const defaultTerm = `${student.semester || "2"}/${student.academicYear || "2568"}`;
    const roundState = getStudentRoundState(student.id, defaultTerm);

    const docWf = state.docWorkflowMap?.[String(student.id)];
    const approvedComp = student.companies.find((c) => c.checklistStatus === "APPROVED");

    // ต้องจบขั้นตอนรอบที่ 1 ก่อน (ได้หนังสือส่งตัว / สถานที่ฝึกได้รับอนุมัติ)
    const canCompleteRound1 =
      Boolean(student.placement && student.placement.status === "APPROVED") ||
      Boolean(docWf?.dispatchLetterIssued) ||
      roundState.isRound1Completed;
    if (!canCompleteRound1) {
      return res.status(400).json({ success: false, message: "ยังไม่สามารถเริ่มรอบที่ 2 ได้ (ต้องได้หนังสือส่งตัวรอบที่ 1 ก่อน)" });
    }
    if (roundState.currentRound >= 2) {
      return res.status(400).json({ success: false, message: "คุณเริ่มรอบที่ 2 ไปแล้ว" });
    }

    // รอบออกฝึกของรอบที่ 2 มาจากการตั้งค่ารุ่น/รอบของพี่จอม (เปิดรอบเดียว = เลือกให้อัตโนมัติ)
    const round2Options = await getRound2Options(student);
    const chosenWindow = resolveSubmissionWindow(round2Options, req.body.internshipWindowId).window;
    if (!chosenWindow) {
      return res.status(400).json({
        success: false,
        message: round2Options.length
          ? "กรุณาเลือกรอบออกฝึกสำหรับรอบที่ 2"
          : "ยังไม่มีรอบออกฝึกถัดไปที่เปิดรับสำหรับสาขาของคุณ (รอเจ้าหน้าที่คณะเปิดรอบ)",
      });
    }
    const term = chosenWindow.termType === "SUMMER" ? `${chosenWindow.term} (Summer)` : chosenWindow.term;

    // เก็บคำตอบ Checklist ของรอบที่ 1 ไว้ในประวัติ (กรณีเปลี่ยนที่ใหม่ Checklist เดิมจะถูกล้าง)
    const round1Answers = approvedComp
      ? await prisma.companyChecklistAnswer.findMany({
          where: { companyId: approvedComp.id },
          include: { checklistItem: true },
        })
      : [];

    // 1. บันทึกข้อมูลของรอบที่ 1 เข้า historyRounds (ถ้ายังไม่เคยบันทึก)
    if (roundState.historyRounds.length === 0) {
      roundState.historyRounds.push({
        round: 1,
        term: roundState.currentTerm || defaultTerm,
        internshipWindowId: student.internshipWindowId || null,
        academicYear: student.academicYear || "2568",
        semester: student.semester || "2",
        companyName: student.placement?.companyNameTh || approvedComp?.name || docWf?.companyName || "สถานประกอบการรอบที่ 1",
        position: student.placement?.position || "ไม่ระบุตำแหน่ง",
        companyAddress: student.placement?.companyAddress || "-",
        province: student.placement?.province || "-",
        contactPersonName: student.placement?.contactPersonName || "-",
        phone: student.placement?.companyPhone1 || "-",
        email: student.placement?.companyEmail || "-",
        checklistStatus: approvedComp?.checklistStatus || "APPROVED",
        checklistAnswers: round1Answers.map((a) => ({
          itemId: a.checklistItemId,
          description: a.checklistItem?.description || "",
          checked: a.checked,
          detail: a.detail || "",
        })),
        requestLetterDocNo: docWf?.requestLetterDocNo,
        requestLetterDate: docWf?.requestLetterDate,
        requestLetterIssued: docWf?.requestLetterIssued,
        companyResponseStatus: docWf?.companyResponseStatus,
        companyResponseFileUrl: docWf?.companyResponseFileUrl,
        companyResponseFileName: docWf?.companyResponseFileName,
        dispatchLetterDocNo: docWf?.dispatchLetterDocNo,
        dispatchLetterDate: docWf?.dispatchLetterDate,
        dispatchLetterIssued: docWf?.dispatchLetterIssued,
        completedAt: new Date().toISOString(),
      });
    }

    roundState.currentRound = 2;
    roundState.currentTerm = term;
    roundState.isRound1Completed = true;
    roundState.round1CompletedAt = new Date().toISOString();

    const isSummer = chosenWindow.termType === "SUMMER" || chosenWindow.term.startsWith("3/");
    const termSemester = chosenWindow.term.split("/")[0];
    const newSemester = isSummer ? "SUMMER" : termSemester || "1";
    const newYear = chosenWindow.term.split("/")[1] || student.academicYear || "2569";

    if (action === "SAME_COMPANY") {
      // ฝึกที่เดิม: Checklist / ข้อมูลบริษัทเดิมใช้ต่อได้ -> เริ่มที่ "รอพี่จอมออกหนังสือขอความอนุเคราะห์" ของรอบใหม่
      roundState.isSameCompanyAsRound1 = true;
      await prisma.student.update({
        where: { id: student.id },
        data: {
          semester: newSemester,
          academicYear: newYear,
          internshipWindowId: chosenWindow.id,
        },
      });

      if (!state.docWorkflowMap) state.docWorkflowMap = {};
      state.docWorkflowMap[String(student.id)] = {
        studentId: student.id,
        studentCode: student.studentCode,
        companyName: docWf?.companyName || approvedComp?.name || student.placement?.companyNameTh || "ยังไม่ยื่นบริษัท",
        interviewDate: "",
        requestLetterIssued: false,
        companyResponseStatus: "NOT_SENT",
        dispatchLetterIssued: false,
        isLocked: false,
      };
      saveSuperAdminState(state);
    } else {
      // NEW_COMPANY (เปลี่ยนสถานที่ฝึกใหม่)
      roundState.isSameCompanyAsRound1 = false;

      // 1. ดึง ID ของบริษัททั้งหมดของนิสิตคนนี้
      const existingCompanies = await prisma.company.findMany({
        where: { studentId: student.id },
        select: { id: true },
      });
      const companyIds = existingCompanies.map((c) => c.id);

      if (companyIds.length > 0) {
        // ลบ answers และ submission ก่อนเพื่อไม่ให้ติด Foreign Key Constraint
        await prisma.companyChecklistAnswer.deleteMany({
          where: { companyId: { in: companyIds } },
        });
        await prisma.companySubmission.deleteMany({
          where: { companyId: { in: companyIds } },
        });
        await prisma.company.deleteMany({
          where: { id: { in: companyIds } },
        });
      }

      // 2. ลบ placement เดิม เพื่อเปิดให้นิสิตยื่นที่ใหม่
      await prisma.internshipPlacement.deleteMany({
        where: { studentId: student.id },
      });

      // 3. ปรับปรุงสถานะนิสิต: รีเซ็ต stage กลับเป็น PENDING_DOCUMENTS
      // ถ้าไม่ใช่ Summer (เช่น 1/2570 ปี 4) ให้อาจารย์ประจำวิชาใหม่เป็นผู้จัดสรรอาจารย์ที่ปรึกษา (advisorId = null)
      const updateData: any = {
        semester: newSemester,
        academicYear: newYear,
        stage: "PENDING_DOCUMENTS",
        internshipWindowId: chosenWindow.id,
      };
      if (!isSummer) {
        updateData.advisorId = null;
      }

      await prisma.student.update({
        where: { id: student.id },
        data: updateData,
      });

      // 4. รีเซ็ต docWorkflow สำหรับรอบใหม่
      if (!state.docWorkflowMap) state.docWorkflowMap = {};
      state.docWorkflowMap[String(student.id)] = {
        studentId: student.id,
        studentCode: student.studentCode,
        companyName: "ยังไม่ยื่นบริษัท",
        requestLetterIssued: false,
        companyResponseStatus: "NOT_SENT",
        dispatchLetterIssued: false,
        isLocked: false,
      };
      saveSuperAdminState(state);
    }

    saveStudentRoundState(student.id, roundState);

    res.json({
      success: true,
      message:
        action === "SAME_COMPANY"
          ? `ยืนยันฝึกงานที่เดิมต่อสำหรับรอบที่ 2 (${term}) เรียบร้อยแล้ว — รอเจ้าหน้าที่คณะออกหนังสือขอความอนุเคราะห์`
          : `เริ่มต้นรอบที่ 2 สำหรับสถานที่ฝึกงานใหม่ (${term}) เรียบร้อยแล้ว กรุณากรอก Checklist บริษัทใหม่`,
      roundState,
    });
  } catch (err) {
    console.error("POST /api/student/round/complete-round-1 error:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการเปลี่ยนรอบฝึกงาน" });
  }
});

// เครื่องมือสำหรับ Developer / Tester ในการจำลองจบรอบหรือรีเซ็ตกลับรอบ 1
router.post("/round/dev-toggle-round", async (req: Request, res: Response) => {
  try {
    const student = await getStudentByUserId(req.session.user!.id);
    if (!student) return res.status(404).json({ success: false, message: "ไม่พบข้อมูลนิสิต" });

    const { mode } = req.body;
    const defaultTerm = `${student.semester || "2"}/${student.academicYear || "2568"}`;
    const roundState = getStudentRoundState(student.id, defaultTerm);

    if (mode === "RESET_ROUND_1") {
      const hist = roundState.historyRounds && roundState.historyRounds[0];

      roundState.currentRound = 1;
      roundState.currentTerm = "2/2568";
      roundState.isRound1Completed = false;
      roundState.isSameCompanyAsRound1 = false;
      roundState.round1CompletedAt = undefined;
      roundState.historyRounds = [];
      saveStudentRoundState(student.id, roundState);

      // ถ้าในตารางไม่มีบริษัท (เนื่องจากก่อนหน้านี้กดเปลี่ยนที่ใหม่แล้วลบไป) -> กู้คืนบริษัทและ placement ของรอบ 1 ให้
      if (!student.companies || student.companies.length === 0) {
        const comp = await prisma.company.create({
          data: {
            studentId: student.id,
            name: hist?.companyName || "บริษัท กสิกร บิซิเนส-เทคโนโลยี กรุ๊ป (KBTG)",
            checklistVersionId: 1,
            checklistStatus: "APPROVED",
            reviewedById: 15,
            reviewedAt: new Date(),
          },
        });

        const items = await prisma.checklistItem.findMany({
          where: { section: { versionId: 1 } },
        });

        if (items.length > 0) {
          await prisma.companyChecklistAnswer.createMany({
            data: items.map((it, idx) => ({
              companyId: comp.id,
              checklistItemId: it.id,
              checked: idx < 8,
            })),
          });
        }

        await prisma.companySubmission.create({
          data: {
            companyId: comp.id,
            status: "INTERVIEW_PASSED",
          },
        });

        await prisma.internshipPlacement.upsert({
          where: { studentId: student.id },
          create: {
            studentId: student.id,
            companyId: comp.id,
            companyNameTh: hist?.companyName || "บริษัท กสิกร บิซิเนส-เทคโนโลยี กรุ๊ป (KBTG)",
            position: hist?.position || "Frontend Developer",
            companyAddress: hist?.companyAddress || "46/1 อาคาร KBTG ถ.สาทรเหนือ แขวงสีลม เขตบางรัก",
            province: hist?.province || "กรุงเทพมหานคร",
            companyPhone1: hist?.phone || "02-008-0000",
            companyEmail: hist?.email || "recruitment@kbtg.tech",
            status: "APPROVED",
          },
          update: {
            companyId: comp.id,
            companyNameTh: hist?.companyName || "บริษัท กสิกร บิซิเนส-เทคโนโลยี กรุ๊ป (KBTG)",
            position: hist?.position || "Frontend Developer",
            status: "APPROVED",
          },
        });
      }

      // คืนรอบออกฝึกของรอบที่ 1 ด้วย (ตอนเข้ารอบ 2 ระบบย้ายนิสิตไปรอบใหม่) — ประวัติเก่าที่ไม่มีค่านี้ = ไม่แตะ
      const round1WindowId = hist && hist.internshipWindowId !== undefined ? hist.internshipWindowId : undefined;
      await prisma.student.update({
        where: { id: student.id },
        data: {
          semester: "2",
          academicYear: "2568",
          stage: "READY",
          ...(round1WindowId !== undefined ? { internshipWindowId: round1WindowId } : {}),
        },
      });

      const state = loadSuperAdminState();
      if (!state.docWorkflowMap) state.docWorkflowMap = {};
      state.docWorkflowMap[String(student.id)] = {
        studentId: student.id,
        studentCode: student.studentCode,
        companyName: hist?.companyName || "บริษัท กสิกร บิซิเนส-เทคโนโลยี กรุ๊ป (KBTG)",
        interviewDate: "2026-02-15",
        requestLetterIssued: true,
        requestLetterDocNo: hist?.requestLetterDocNo || "อว 7316/ว 253",
        requestLetterDate: hist?.requestLetterDate || "2026-11-11",
        companyResponseStatus: "ADVISOR_APPROVED",
        companyResponseFileName: hist?.companyResponseFileName || "แบบตอบรับนิสิตฝึกงานtest.pdf",
        companyResponseFileUrl: hist?.companyResponseFileUrl || "https://res.cloudinary.com/j5ccelrs/image/upload/v1794388940/se_internship/acceptance_forms/1794388937255-____________________test.pdf",
        advisorAcceptanceStatus: "APPROVED",
        dispatchLetterIssued: false,
        isLocked: false,
        unlockedByAdmin: true,
      };
      saveSuperAdminState(state);

      return res.json({ success: true, message: "รีเซ็ตสถานะและกู้คืนข้อมูลบริษัทกลับสู่รอบที่ 1 เรียบร้อยแล้ว", roundState });
    }

    if (mode === "SIMULATE_COMPLETE") {
      roundState.isRound1Completed = true;
      saveStudentRoundState(student.id, roundState);
      return res.json({ success: true, message: "จำลองการจบรอบที่ 1 เรียบร้อยแล้ว (พร้อมเลือกขึ้นรอบ 2)", roundState });
    }

    res.status(400).json({ success: false, message: "โหมดไม่ถูกต้อง" });
  } catch (err) {
    console.error("POST /api/student/round/dev-toggle-round error:", err);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด" });
  }
});

export default router;
