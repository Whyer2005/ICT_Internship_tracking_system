// =====================================================================
// API: ประกาศรับนิสิตสหกิจศึกษา
// - adminCoopRouter: mount ใต้ /api/admin (ผ่าน requireAdmin แล้ว) — ดูได้ทุกบทบาทของหน้า admin
//   แต่เพิ่ม/แก้/ปิดรับ/ลบ/นำเข้า เฉพาะเจ้าหน้าที่ฝ่ายฝึกงาน (Staff)
// - studentCoopRouter: mount ใต้ /api/student (ผ่าน requireLogin แล้ว) — ดูประกาศ (ไม่ส่งข้อมูลผู้ติดต่อ HR) + สมัคร
// ประกาศ = บริษัท + ตำแหน่ง · รอบเทอม/ช่วงฝึก/วันปิดยื่น ใช้ตามรอบออกฝึกของสาขานิสิต (ไม่ได้ตั้งในประกาศ)
// =====================================================================
import express, { NextFunction, Request, Response } from "express";
import multer from "multer";
import prisma from "../db";
import { requireStaffOnly as makeStaffOnly } from "../auth/requireStaffOnly";
import { getStudentRoundState, loadSuperAdminState } from "../utils/superAdminStore";
import {
  excludeUsedWindows,
  getStudentWindowEligibility,
  resolveSubmissionWindow,
  windowDisplayLabel,
  WINDOW_STATUS_LABEL,
  ymd,
} from "../utils/internshipWindows";
import { uploadToCloudinary } from "../utils/cloudinary";
import { fetchFileBuffer } from "../utils/acceptanceOcr";
import { mergeCoopDocuments } from "../utils/coopPdf";
import {
  COOP_APPLICATION_STATUS_LABEL,
  COOP_DOC_STEP_FIELDS,
  COOP_DOC_STEP_LABEL,
  COOP_FILE_MAX_BYTES,
  COOP_FINAL_STATUSES,
  COOP_STATUSES_NEED_NOTE,
  canStudentCancelCoop,
  coopDocStepUpdate,
  coopDocStepsView,
  isCoopDocStep,
  COOP_MIN_GPAX,
  COOP_STATUS_LABEL,
  CoopApplicationStatus,
  canChangeCoopStatus,
  coopFileError,
  isActiveCoopApplication,
  normalizePortfolioLink,
  CoopPostingInput,
  buildCoopImportPlan,
  buildCoopImportTemplate,
  coopPostingKey,
  coopPostingStatus,
  normalizePositionTitle,
  parseCoopPostingSheet,
  validateCoopPostingInput,
} from "../utils/coopPostings";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const requireStaffOnly = makeStaffOnly("เฉพาะเจ้าหน้าที่ฝ่ายฝึกงาน (Staff) เท่านั้นที่จัดการประกาศสหกิจศึกษาได้");

const postingInclude = {
  positions: {
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
    include: { _count: { select: { applications: true } } },
  },
  _count: { select: { applications: true } },
};
type PostingWithPositions = NonNullable<Awaited<ReturnType<typeof findPosting>>>;

function findPosting(id: number) {
  return prisma.coopPosting.findUnique({ where: { id }, include: postingInclude });
}

/** ข้อมูลที่นิสิตเห็นได้ (ไม่มี HR / masterCompanyId / ผู้สร้าง) */
function serializePublic(p: PostingWithPositions) {
  const status = coopPostingStatus(p);
  return {
    id: p.id,
    companyName: p.companyName,
    companyNameEn: p.companyNameEn || "",
    description: p.description || "",
    qualifications: p.qualifications || "",
    benefits: p.benefits || "",
    address: p.address || "",
    province: p.province || "",
    website: p.website || "",
    status,
    statusLabel: COOP_STATUS_LABEL[status],
    totalSeats: p.positions.reduce((sum, x) => sum + (x.seats || 0), 0),
    positions: p.positions.map((x) => ({ id: x.id, title: x.title, seats: x.seats, description: x.description || "" })),
  };
}

function serializeStaff(p: PostingWithPositions) {
  return {
    ...serializePublic(p),
    isClosed: p.isClosed,
    masterCompanyId: p.masterCompanyId || "",
    hrContactName: p.hrContactName || "",
    hrPhone: p.hrPhone || "",
    hrEmail: p.hrEmail || "",
    createdBy: p.createdBy || "",
    updatedAt: p.updatedAt,
    applicationCount: p._count.applications,
    positions: p.positions.map((x) => ({
      id: x.id,
      title: x.title,
      seats: x.seats,
      description: x.description || "",
      applicationCount: x._count.applications,
    })),
  };
}

/** เปิดรับก่อน แล้วเรียงตามชื่อบริษัท */
function sortPostings<T extends { status: string; companyName: string }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => Number(b.status === "OPEN") - Number(a.status === "OPEN") || a.companyName.localeCompare(b.companyName, "th")
  );
}

function postingFields(d: CoopPostingInput) {
  const { positions: _positions, ...fields } = d;
  return fields;
}

/** 1 บริษัท = 1 ประกาศ (ถ้าเคยมีแล้วให้แก้/เปิดรับประกาศเดิม) */
async function findDuplicatePosting(companyName: string, exceptId?: number) {
  const all = await prisma.coopPosting.findMany({ select: { id: true, companyName: true } });
  const key = coopPostingKey(companyName);
  return all.find((p) => p.id !== exceptId && coopPostingKey(p.companyName) === key) || null;
}

// =====================================================================
// ฝั่งเจ้าหน้าที่ (/api/admin/super-admin/coop-postings)
// =====================================================================
export const adminCoopRouter = express.Router();

adminCoopRouter.get("/super-admin/coop-postings", async (_req: Request, res: Response) => {
  try {
    const postings = await prisma.coopPosting.findMany({ include: postingInclude });
    res.json({ success: true, postings: sortPostings(postings.map((p) => serializeStaff(p))) });
  } catch (err) {
    console.error("GET /api/admin/super-admin/coop-postings error:", err);
    res.status(500).json({ success: false, message: "โหลดประกาศสหกิจศึกษาไม่สำเร็จ" });
  }
});

// รายชื่อบริษัทจากฐานข้อมูลบริษัทกลาง (ไม่รวม Blacklist) สำหรับพิมพ์เลือก + เติมที่อยู่/HR อัตโนมัติในฟอร์มประกาศ
adminCoopRouter.get("/super-admin/coop-postings/company-suggestions", requireStaffOnly, (_req: Request, res: Response) => {
  try {
    const companies = loadSuperAdminState()
      .companyMasterData.filter((c) => c.status !== "BLACKLIST")
      .map((c) => ({
        id: c.id,
        nameTh: c.nameTh,
        nameEn: c.nameEn || "",
        province: c.province || "",
        address: c.address || "",
        hrContactName: c.hrContactName || "",
        hrPhone: c.hrPhone || "",
        hrEmail: c.hrEmail || "",
      }));
    res.json({ success: true, companies });
  } catch (err) {
    console.error("GET /api/admin/super-admin/coop-postings/company-suggestions error:", err);
    res.status(500).json({ success: false, message: "โหลดรายชื่อบริษัทไม่สำเร็จ" });
  }
});

adminCoopRouter.post("/super-admin/coop-postings", requireStaffOnly, async (req: Request, res: Response) => {
  try {
    const { data, error } = validateCoopPostingInput(req.body);
    if (!data) return res.status(400).json({ success: false, message: error });
    const dup = await findDuplicatePosting(data.companyName);
    if (dup) {
      return res.status(400).json({ success: false, message: `มีประกาศของ "${dup.companyName}" อยู่แล้ว — แก้ไขหรือเปิดรับประกาศเดิมแทน` });
    }
    const actor = req.session.user?.username || req.session.user?.email || "Staff";
    const created = await prisma.coopPosting.create({
      data: {
        ...postingFields(data),
        createdBy: String(actor),
        positions: { create: data.positions.map((p, i) => ({ title: p.title, seats: p.seats, description: p.description, sortOrder: i })) },
      },
    });
    res.json({ success: true, id: created.id, message: `เพิ่มประกาศ "${data.companyName}" แล้ว` });
  } catch (err) {
    console.error("POST /api/admin/super-admin/coop-postings error:", err);
    res.status(500).json({ success: false, message: "เพิ่มประกาศไม่สำเร็จ" });
  }
});

adminCoopRouter.put("/super-admin/coop-postings/:id", requireStaffOnly, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const current = await findPosting(id);
    if (!current) return res.status(404).json({ success: false, message: "ไม่พบประกาศนี้" });
    const { data, error } = validateCoopPostingInput(req.body);
    if (!data) return res.status(400).json({ success: false, message: error });
    const dup = await findDuplicatePosting(data.companyName, id);
    if (dup) {
      return res.status(400).json({ success: false, message: `มีประกาศของ "${dup.companyName}" อยู่แล้ว` });
    }

    // ตำแหน่ง: มี id ของประกาศนี้ = แก้ไข | ไม่มี id = เพิ่ม | ตำแหน่งเดิมที่หายไปจากฟอร์ม = ลบ
    const currentIds = new Set(current.positions.map((p) => p.id));
    const keptIds = new Set(data.positions.filter((p) => p.id && currentIds.has(p.id)).map((p) => p.id!));
    // ตำแหน่งที่มีนิสิตสมัครแล้วลบไม่ได้ (ใบสมัครอ้างอิงอยู่)
    const blocked = current.positions.filter((p) => !keptIds.has(p.id) && p._count.applications > 0);
    if (blocked.length) {
      return res.status(400).json({
        success: false,
        message: `ลบตำแหน่ง "${blocked.map((p) => p.title).join('", "')}" ไม่ได้ เพราะมีนิสิตสมัครแล้ว — แก้ชื่อหรือจำนวนที่รับได้ หรือปิดรับประกาศแทน`,
      });
    }
    await prisma.$transaction([
      prisma.coopPosting.update({ where: { id }, data: postingFields(data) }),
      prisma.coopPosition.deleteMany({ where: { postingId: id, id: { notIn: Array.from(keptIds) } } }),
      ...data.positions.map((p, i) =>
        p.id && keptIds.has(p.id)
          ? prisma.coopPosition.update({ where: { id: p.id }, data: { title: p.title, seats: p.seats, description: p.description, sortOrder: i } })
          : prisma.coopPosition.create({ data: { postingId: id, title: p.title, seats: p.seats, description: p.description, sortOrder: i } })
      ),
    ]);
    res.json({ success: true, message: `บันทึกประกาศ "${data.companyName}" แล้ว` });
  } catch (err) {
    console.error("PUT /api/admin/super-admin/coop-postings/:id error:", err);
    res.status(500).json({ success: false, message: "บันทึกประกาศไม่สำเร็จ" });
  }
});

// ปิดรับก่อนกำหนด / เปิดรับอีกครั้ง (body.closed = true | false)
adminCoopRouter.post("/super-admin/coop-postings/:id/close", requireStaffOnly, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const closed = req.body.closed !== false;
    const current = await findPosting(id);
    if (!current) return res.status(404).json({ success: false, message: "ไม่พบประกาศนี้" });
    await prisma.coopPosting.update({ where: { id }, data: { isClosed: closed } });
    res.json({ success: true, message: `${closed ? "ปิดรับ" : "เปิดรับ"}ประกาศ "${current.companyName}" แล้ว` });
  } catch (err) {
    console.error("POST /api/admin/super-admin/coop-postings/:id/close error:", err);
    res.status(500).json({ success: false, message: "เปลี่ยนสถานะประกาศไม่สำเร็จ" });
  }
});

adminCoopRouter.delete("/super-admin/coop-postings/:id", requireStaffOnly, async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const current = await findPosting(id);
    if (!current) return res.status(404).json({ success: false, message: "ไม่พบประกาศนี้" });
    if (current._count.applications > 0) {
      return res.status(400).json({
        success: false,
        message: `ลบประกาศ "${current.companyName}" ไม่ได้ เพราะมีใบสมัครแล้ว ${current._count.applications} ใบ — ใช้ "ปิดรับสมัคร" แทน`,
      });
    }
    await prisma.coopPosting.delete({ where: { id } });
    res.json({ success: true, message: `ลบประกาศ "${current.companyName}" แล้ว` });
  } catch (err) {
    console.error("DELETE /api/admin/super-admin/coop-postings/:id error:", err);
    res.status(500).json({ success: false, message: "ลบประกาศไม่สำเร็จ" });
  }
});

adminCoopRouter.get("/super-admin/coop-postings/import-template", (_req: Request, res: Response) => {
  try {
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="coop_postings_template.xlsx"');
    res.send(buildCoopImportTemplate());
  } catch (err) {
    console.error("GET /api/admin/super-admin/coop-postings/import-template error:", err);
    res.status(500).json({ success: false, message: "สร้างไฟล์ตัวอย่างไม่สำเร็จ" });
  }
});

async function planFromUpload(req: Request) {
  if (!req.file?.buffer) throw new Error("กรุณาเลือกไฟล์ Excel (.xlsx, .xls) หรือ .csv");
  const rows = parseCoopPostingSheet(req.file.buffer);
  const existing = await prisma.coopPosting.findMany({
    select: { id: true, companyName: true, positions: { select: { id: true, title: true } } },
  });
  return buildCoopImportPlan(rows, existing);
}

function previewOf(plan: Awaited<ReturnType<typeof planFromUpload>>) {
  return {
    groups: plan.groups.map((g) => ({
      action: g.action,
      companyName: g.data.companyName,
      province: g.data.province || "",
      rowNumbers: g.rowNumbers,
      positions: g.positions.map((p) => ({ title: p.title, seats: p.seats, action: p.action })),
    })),
    errors: plan.errors,
    summary: {
      createPostings: plan.groups.filter((g) => g.action === "CREATE").length,
      updatePostings: plan.groups.filter((g) => g.action === "UPDATE").length,
      positions: plan.groups.reduce((n, g) => n + g.positions.length, 0),
      errorRows: plan.errors.length,
    },
  };
}

// พรีวิว (ยังไม่บันทึก)
adminCoopRouter.post("/super-admin/coop-postings/import-preview", requireStaffOnly, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const plan = await planFromUpload(req);
    res.json({ success: true, ...previewOf(plan) });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err?.message || "อ่านไฟล์ไม่สำเร็จ" });
  }
});

// บันทึกจริง: ประกาศใหม่ = สร้าง | ประกาศเดิม = เติมเฉพาะช่องที่ไฟล์มีค่า + เพิ่ม/อัปเดตตำแหน่งตามชื่อ (ไม่ลบตำแหน่งเดิม)
adminCoopRouter.post("/super-admin/coop-postings/import-confirm", requireStaffOnly, upload.single("file"), async (req: Request, res: Response) => {
  let plan: Awaited<ReturnType<typeof planFromUpload>>;
  try {
    plan = await planFromUpload(req);
  } catch (err: any) {
    return res.status(400).json({ success: false, message: err?.message || "อ่านไฟล์ไม่สำเร็จ" });
  }
  if (plan.groups.length === 0) {
    return res.status(400).json({ success: false, message: "ไม่มีแถวที่นำเข้าได้ (ตรวจข้อผิดพลาดในพรีวิว)" });
  }
  try {
    const actor = String(req.session.user?.username || req.session.user?.email || "Staff");
    for (const g of plan.groups) {
      const fields = postingFields(g.data);
      if (g.action === "CREATE") {
        await prisma.coopPosting.create({
          data: {
            ...fields,
            createdBy: actor,
            positions: { create: g.positions.map((p, i) => ({ title: p.title, seats: p.seats, description: p.description, sortOrder: i })) },
          },
        });
        continue;
      }
      const id = g.existingId!;
      const current = await findPosting(id);
      if (!current) continue;
      // ช่องที่ไฟล์เว้นว่างไม่ทับข้อมูลเดิม
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (k === "companyName") continue;
        if (Array.isArray(v) ? v.length : v !== null && v !== undefined) patch[k] = v;
      }
      let nextOrder = current.positions.length;
      await prisma.$transaction([
        prisma.coopPosting.update({ where: { id }, data: patch }),
        ...g.positions.map((p) => {
          const existingPos = current.positions.find((x) => normalizePositionTitle(x.title) === normalizePositionTitle(p.title));
          if (existingPos) {
            return prisma.coopPosition.update({
              where: { id: existingPos.id },
              data: { ...(p.seats !== null ? { seats: p.seats } : {}), ...(p.description ? { description: p.description } : {}) },
            });
          }
          return prisma.coopPosition.create({ data: { postingId: id, title: p.title, seats: p.seats, description: p.description, sortOrder: nextOrder++ } });
        }),
      ]);
    }
    const s = previewOf(plan).summary;
    res.json({
      success: true,
      message:
        `นำเข้าแล้ว: ประกาศใหม่ ${s.createPostings} · อัปเดตประกาศเดิม ${s.updatePostings} · ตำแหน่งรวม ${s.positions}` +
        (s.errorRows ? ` (ข้าม ${s.errorRows} แถวที่ข้อมูลไม่ถูกต้อง)` : ""),
    });
  } catch (err) {
    console.error("POST /api/admin/super-admin/coop-postings/import-confirm error:", err);
    res.status(500).json({ success: false, message: "นำเข้าไม่สำเร็จ (บางประกาศอาจบันทึกไปแล้ว กรุณาตรวจรายการ)" });
  }
});

// =====================================================================
// ฝั่งเจ้าหน้าที่: ใบสมัครสหกิจ (/api/admin/super-admin/coop-applications)
// =====================================================================
adminCoopRouter.get("/super-admin/coop-applications", async (_req: Request, res: Response) => {
  try {
    const apps = await prisma.coopApplication.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        student: { select: { id: true, studentCode: true, nameTh: true, major: true, gpa: true } },
        window: { select: { term: true, termType: true } },
      },
    });
    res.json({
      success: true,
      minGpax: COOP_MIN_GPAX,
      applications: apps.map((a) => ({
        id: a.id,
        studentId: a.student.id,
        studentCode: a.student.studentCode,
        nameTh: a.student.nameTh,
        major: a.student.major || "",
        gpa: a.student.gpa,
        postingId: a.postingId,
        companyName: a.companyName,
        positionTitle: a.positionTitle,
        term: a.window ? windowDisplayLabel(a.window) : "",
        resumeUrl: a.resumeUrl,
        transcriptUrl: a.transcriptUrl,
        portfolioUrl: a.portfolioUrl || "",
        portfolioLink: a.portfolioLink || "",
        status: a.status,
        statusLabel: COOP_APPLICATION_STATUS_LABEL[a.status],
        statusNote: a.statusNote || "",
        statusUpdatedAt: a.statusUpdatedAt,
        statusUpdatedBy: a.statusUpdatedBy || "",
        docStep: a.docStep,
        docStepLabel: COOP_DOC_STEP_LABEL[a.docStep],
        docSteps: coopDocStepsView(a),
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/super-admin/coop-applications error:", err);
    res.status(500).json({ success: false, message: "โหลดใบสมัครสหกิจไม่สำเร็จ" });
  }
});

// เปลี่ยนสถานะทีละหลายใบ: body = { ids: number[], status, note? } (ไม่ผ่าน / ยกเลิก ต้องมีเหตุผล)
adminCoopRouter.post("/super-admin/coop-applications/status", requireStaffOnly, async (req: Request, res: Response) => {
  try {
    const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0);
    const status = String(req.body.status || "") as CoopApplicationStatus;
    const note = String(req.body.note || "").trim().slice(0, 1000);
    if (!ids.length) return res.status(400).json({ success: false, message: "กรุณาเลือกใบสมัคร" });
    if (!(status in COOP_APPLICATION_STATUS_LABEL)) return res.status(400).json({ success: false, message: "สถานะไม่ถูกต้อง" });
    if (COOP_STATUSES_NEED_NOTE.includes(status) && !note) {
      return res.status(400).json({ success: false, message: status === "CANCELLED" ? "กรุณาระบุเหตุผลที่ยกเลิก" : "กรุณาระบุเหตุผลที่ไม่ผ่าน" });
    }

    const apps = await prisma.coopApplication.findMany({ where: { id: { in: ids } }, select: { id: true, status: true, docStep: true } });
    const allowed = apps.filter((a) => canChangeCoopStatus(a.status, status, a.docStep)).map((a) => a.id);
    const actor = String(req.session.user?.username || req.session.user?.email || "Staff");
    if (allowed.length) {
      await prisma.coopApplication.updateMany({
        where: { id: { in: allowed } },
        data: { status, statusNote: note || null, statusUpdatedAt: new Date(), statusUpdatedBy: actor },
      });
    }
    const skipped = ids.length - allowed.length;
    res.status(allowed.length ? 200 : 400).json({
      success: allowed.length > 0,
      updated: allowed.length,
      skipped,
      message: allowed.length
        ? `เปลี่ยนเป็น "${COOP_APPLICATION_STATUS_LABEL[status]}" แล้ว ${allowed.length} ใบ` + (skipped ? ` (ข้าม ${skipped} ใบที่เปลี่ยนเป็นสถานะนี้ไม่ได้)` : "")
        : `ไม่มีใบสมัครที่เปลี่ยนเป็น "${COOP_APPLICATION_STATUS_LABEL[status]}" ได้ (ใบที่ไม่ผ่าน/ยกเลิกแล้วเปลี่ยนต่อไม่ได้ · ใบที่เริ่มขั้นเอกสารแล้วต้องย้อนขั้นเอกสารก่อน)`,
    });
  } catch (err) {
    console.error("POST /api/admin/super-admin/coop-applications/status error:", err);
    res.status(500).json({ success: false, message: "เปลี่ยนสถานะไม่สำเร็จ" });
  }
});

// ขั้นเอกสารหลังผ่านการคัดเลือก: multipart { step } + file? (PDF/JPG/PNG ≤ 10 MB แนบกับขั้นที่ตั้ง)
const docStepUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: COOP_FILE_MAX_BYTES } });
adminCoopRouter.post(
  "/super-admin/coop-applications/:id/doc-step",
  requireStaffOnly,
  (req: Request, res: Response, next: NextFunction) => {
    docStepUpload.single("file")(req, res, (err: any) => {
      if (err) {
        const msg = err?.code === "LIMIT_FILE_SIZE" ? "ไฟล์ใหญ่เกิน 10 MB" : "อัปโหลดไฟล์ไม่สำเร็จ";
        return res.status(400).json({ success: false, message: msg });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const step = String(req.body.step || "");
      if (!isCoopDocStep(step)) return res.status(400).json({ success: false, message: "ขั้นเอกสารไม่ถูกต้อง" });
      const app = await prisma.coopApplication.findUnique({ where: { id } });
      if (!app) return res.status(404).json({ success: false, message: "ไม่พบใบสมัคร" });
      if (app.status !== "ACCEPTED") {
        return res.status(400).json({ success: false, message: "ตั้งขั้นเอกสารได้เฉพาะใบสมัครที่ผ่านการคัดเลือกแล้ว" });
      }
      const file = req.file;
      if (file && step === "NONE") return res.status(400).json({ success: false, message: "เลือกขั้นเอกสารก่อนแนบไฟล์" });
      const fileErr = coopFileError(file, "ไฟล์แนบ");
      if (fileErr) return res.status(400).json({ success: false, message: fileErr });

      let uploaded: { url: string; name: string } | null = null;
      if (file) {
        const name = utf8Name(file.originalname);
        uploaded = { url: await uploadToCloudinary(file.buffer, name, "coop_documents"), name };
      }
      const actor = String(req.session.user?.username || req.session.user?.email || "Staff");
      const data = coopDocStepUpdate(app as unknown as Record<string, unknown>, step, new Date(), uploaded);
      const updated = await prisma.coopApplication.update({
        where: { id },
        data: { ...data, docStepUpdatedBy: actor } as any,
      });
      res.json({
        success: true,
        message: `ตั้งขั้นเอกสารเป็น "${COOP_DOC_STEP_LABEL[step]}" แล้ว` + (uploaded ? ` (แนบ ${COOP_DOC_STEP_FIELDS[step as Exclude<typeof step, "NONE">].fileLabel})` : ""),
        docStep: updated.docStep,
        docSteps: coopDocStepsView(updated),
      });
    } catch (err) {
      console.error("POST /api/admin/super-admin/coop-applications/:id/doc-step error:", err);
      res.status(500).json({ success: false, message: "บันทึกขั้นเอกสารไม่สำเร็จ" });
    }
  }
);

// PDF รวม (Resume -> Transcript -> Portfolio) สำหรับส่งต่อบริษัท
adminCoopRouter.get("/super-admin/coop-applications/:id/pdf", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const app = await prisma.coopApplication.findUnique({
      where: { id },
      include: { student: { select: { studentCode: true, nameTh: true } } },
    });
    if (!app) return res.status(404).json({ success: false, message: "ไม่พบใบสมัคร" });
    const download = async (url: string | null) => {
      if (!url) return null;
      try {
        return (await fetchFileBuffer(url)).buffer;
      } catch {
        return null;
      }
    };
    const parts = [
      { label: "Resume", buffer: await download(app.resumeUrl) },
      { label: "Transcript", buffer: await download(app.transcriptUrl) },
      ...(app.portfolioUrl ? [{ label: "Portfolio", buffer: await download(app.portfolioUrl) }] : []),
    ];
    const pdf = await mergeCoopDocuments(parts, { studentCode: app.student.studentCode, portfolioLink: app.portfolioLink });
    const fileName = `สหกิจ_${app.student.studentCode}_${app.student.nameTh}_${app.companyName}.pdf`.replace(/[\\/:*?"<>|]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="coop_${app.student.studentCode}.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(Buffer.from(pdf));
  } catch (err) {
    console.error("GET /api/admin/super-admin/coop-applications/:id/pdf error:", err);
    res.status(500).json({ success: false, message: "สร้าง PDF รวมไม่สำเร็จ" });
  }
});

// =====================================================================
// ฝั่งนิสิต (/api/student/coop-postings) — ดูประกาศได้ทุกคน · สมัคร · ยกเลิก (เฉพาะก่อนส่งเอกสารให้บริษัท)
// =====================================================================
export const studentCoopRouter = express.Router();

const coopUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: COOP_FILE_MAX_BYTES } });

/** multer อ่านชื่อไฟล์เป็น latin1 -> แปลงกลับเป็น UTF-8 (ชื่อภาษาไทยไม่เพี้ยน) */
function utf8Name(name: string): string {
  const converted = Buffer.from(name, "latin1").toString("utf8");
  return converted.includes("\uFFFD") ? name : converted;
}

/**
 * สถานะการสมัครสหกิจของนิสิต (ใช้ทั้งตอนแสดงหน้าจอ และตรวจซ้ำตอนกดสมัคร)
 * เงื่อนไขเดียวกับการเลือกสถานประกอบการ: อัปโหลด CV แล้ว + ชั่วโมงอบรมครบ + สาขาเปิดรอบอยู่ · เลือกได้ทางเดียว · ทีละ 1 ใบ
 */
async function getStudentCoopContext(userId: number) {
  const student = await prisma.student.findUnique({
    where: { userId },
    include: {
      cv: true,
      trainingRecords: { where: { status: "APPROVED" }, select: { skillType: true, hours: true } },
      companies: { select: { id: true, name: true, checklistStatus: true } },
      coopApplications: { orderBy: { createdAt: "desc" }, include: { window: { select: { term: true, termType: true } } } },
    },
  });
  if (!student) return null;

  const soft = student.trainingRecords.filter((t) => t.skillType === "SOFT").reduce((n, t) => n + t.hours, 0);
  const hard = student.trainingRecords.filter((t) => t.skillType === "HARD").reduce((n, t) => n + t.hours, 0);
  const elig = await getStudentWindowEligibility(student);
  const roundState = getStudentRoundState(student.id, `${student.semester || "2"}/${student.academicYear || "2568"}`);
  const openWindows = excludeUsedWindows(elig.openWindows, roundState);

  const active = student.coopApplications.find((a) => isActiveCoopApplication(a.status)) || null;
  const history = student.coopApplications.filter((a) => !isActiveCoopApplication(a.status));
  const internshipCompany = student.companies.find((c) => c.checklistStatus === "PENDING" || c.checklistStatus === "APPROVED") || null;

  const reasons: string[] = [];
  if (student.isDropped) reasons.push("คุณถูกดรอปจากรายวิชา — ติดต่อเจ้าหน้าที่");
  if (active) reasons.push("คุณมีใบสมัครสหกิจอยู่แล้ว (สมัครได้ทีละ 1 ที่)");
  if (internshipCompany) reasons.push(`คุณเลือกฝึกงานแล้ว (ยื่นสถานประกอบการ "${internshipCompany.name}") — เลือกได้ทางเดียว`);
  // CV: อัปโหลดแล้วพอ (อาจารย์คอมเมนต์อย่างเดียว ไม่อนุมัติ)
  if (!student.cv?.fileUrl) reasons.push("ยังไม่ได้อัปโหลด Resume (CV)");
  if (soft < 12 || hard < 18) reasons.push(`ชั่วโมงอบรมยังไม่ครบ (Soft ${soft}/12 · Hard ${hard}/18)`);
  if (!openWindows.length) {
    const next = elig.windows.find((w) => w.status === "NOT_YET_OPEN");
    reasons.push(next ? `รอบ ${windowDisplayLabel(next)} ของสาขาคุณยังไม่ถึงวันเปิดยื่น` : "สาขาของคุณยังไม่เปิดรอบออกฝึก (รอเจ้าหน้าที่ปลดล็อก)");
  }

  return { student, active, history, internshipCompany, openWindows, elig, reasons, canApply: reasons.length === 0 };
}

function serializeApplication(a: any) {
  return {
    id: a.id,
    postingId: a.postingId,
    companyName: a.companyName,
    positionTitle: a.positionTitle,
    term: a.window ? windowDisplayLabel(a.window) : "",
    resumeUrl: a.resumeUrl,
    resumeName: a.resumeName || "",
    transcriptUrl: a.transcriptUrl,
    transcriptName: a.transcriptName || "",
    portfolioUrl: a.portfolioUrl || "",
    portfolioName: a.portfolioName || "",
    portfolioLink: a.portfolioLink || "",
    status: a.status,
    statusLabel: COOP_APPLICATION_STATUS_LABEL[a.status as CoopApplicationStatus],
    statusNote: a.statusNote || "",
    statusUpdatedAt: a.statusUpdatedAt,
    canCancel: canStudentCancelCoop(a.status),
    docStep: a.docStep || "NONE",
    docStepLabel: COOP_DOC_STEP_LABEL[(a.docStep || "NONE") as keyof typeof COOP_DOC_STEP_LABEL],
    docSteps: coopDocStepsView(a),
    createdAt: a.createdAt,
  };
}

studentCoopRouter.get("/coop-postings", async (req: Request, res: Response) => {
  try {
    const ctx = await getStudentCoopContext(req.session.user!.id);
    const gpa = typeof ctx?.student.gpa === "number" ? ctx.student.gpa : null;

    // รอบของนิสิต (รอบเดียวกับที่ใช้ยื่นฝึกงานปกติ): รอบที่เปิดอยู่ก่อน ไม่มีก็รอบถัดไปที่ยังไม่จบ
    let round: Record<string, unknown> | null = null;
    if (ctx) {
      const w = ctx.openWindows[0] || ctx.elig.windows.find((x) => x.status !== "COMPLETED") || null;
      if (w) {
        round = {
          term: windowDisplayLabel(w),
          status: w.status,
          statusLabel: WINDOW_STATUS_LABEL[w.status],
          isOpen: ctx.openWindows.length > 0,
          closeDate: ymd(w.closeDate),
          internStartDate: ymd(w.internStartDate),
          internEndDate: ymd(w.internEndDate),
        };
      }
    }

    const postings = await prisma.coopPosting.findMany({ include: postingInclude });
    res.json({
      success: true,
      // GPAX ต่ำกว่าเกณฑ์สหกิจ (2.00) -> แค่เตือน
      student: { gpa, minGpax: COOP_MIN_GPAX, gpaxBelowMin: gpa !== null && gpa < COOP_MIN_GPAX },
      round, // null = สาขาของนิสิตยังไม่มีรอบออกฝึก
      apply: ctx
        ? {
            canApply: ctx.canApply,
            reasons: ctx.reasons,
            chosenInternship: Boolean(ctx.internshipCompany),
            cv: ctx.student.cv?.fileUrl ? { url: ctx.student.cv.fileUrl, name: ctx.student.cv.fileName || "Resume (CV)" } : null,
            windows: ctx.openWindows.map((w) => ({ id: w.id, label: windowDisplayLabel(w) })),
          }
        : { canApply: false, reasons: ["กรุณากรอกข้อมูลส่วนตัวนิสิตก่อน"], chosenInternship: false, cv: null, windows: [] },
      application: ctx?.active ? serializeApplication(ctx.active) : null,
      history: (ctx?.history || []).map(serializeApplication),
      postings: sortPostings(postings.map((p) => serializePublic(p))),
    });
  } catch (err) {
    console.error("GET /api/student/coop-postings error:", err);
    res.status(500).json({ success: false, message: "โหลดประกาศสหกิจศึกษาไม่สำเร็จ" });
  }
});

// สมัครสหกิจ: multipart { positionId, windowId?, resumeSource: "cv" | "upload", portfolioLink? } + ไฟล์ resume? / transcript / portfolio?
studentCoopRouter.post(
  "/coop-applications",
  (req: Request, res: Response, next: NextFunction) => {
    coopUpload.fields([
      { name: "resume", maxCount: 1 },
      { name: "transcript", maxCount: 1 },
      { name: "portfolio", maxCount: 1 },
    ])(req, res, (err: any) => {
      if (err) {
        const msg = err?.code === "LIMIT_FILE_SIZE" ? "ไฟล์ใหญ่เกิน 10 MB" : "อัปโหลดไฟล์ไม่สำเร็จ";
        return res.status(400).json({ success: false, message: msg });
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      const ctx = await getStudentCoopContext(req.session.user!.id);
      if (!ctx) return res.status(400).json({ success: false, message: "กรุณากรอกข้อมูลส่วนตัวนิสิตก่อน" });
      if (!ctx.canApply) return res.status(400).json({ success: false, message: ctx.reasons[0] });

      const positionId = parseInt(String(req.body.positionId || ""), 10);
      const position = positionId
        ? await prisma.coopPosition.findUnique({ where: { id: positionId }, include: { posting: true } })
        : null;
      if (!position) return res.status(400).json({ success: false, message: "กรุณาเลือกบริษัทและตำแหน่ง" });
      if (position.posting.isClosed) return res.status(400).json({ success: false, message: `"${position.posting.companyName}" ปิดรับสมัครแล้ว` });

      const resolved = resolveSubmissionWindow(ctx.openWindows, req.body.windowId, ctx.student.internshipWindowId);
      if (!resolved.window) return res.status(400).json({ success: false, message: resolved.error, needWindowSelection: true });

      const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
      const resumeFile = files.resume?.[0];
      const transcriptFile = files.transcript?.[0];
      const portfolioFile = files.portfolio?.[0];
      const useCv = String(req.body.resumeSource || "cv") === "cv";
      if (useCv && !ctx.student.cv?.fileUrl) return res.status(400).json({ success: false, message: "ไม่พบ Resume (CV) ในระบบ กรุณาอัปโหลดไฟล์" });
      if (!useCv && !resumeFile) return res.status(400).json({ success: false, message: "กรุณาแนบไฟล์ Resume" });
      if (!transcriptFile) return res.status(400).json({ success: false, message: "กรุณาแนบไฟล์ Transcript" });
      for (const [f, label] of [[resumeFile, "Resume"], [transcriptFile, "Transcript"], [portfolioFile, "Portfolio"]] as const) {
        const e = coopFileError(f, label);
        if (e) return res.status(400).json({ success: false, message: e });
      }
      const link = normalizePortfolioLink(req.body.portfolioLink);
      if (link.error) return res.status(400).json({ success: false, message: link.error });

      const put = async (f: Express.Multer.File | undefined) => {
        if (!f) return null;
        const name = utf8Name(f.originalname);
        return { url: await uploadToCloudinary(f.buffer, name, "coop_applications"), name };
      };
      const resume = useCv ? { url: ctx.student.cv!.fileUrl, name: ctx.student.cv!.fileName || "Resume (CV)" } : await put(resumeFile);
      const transcript = await put(transcriptFile);
      const portfolio = await put(portfolioFile);

      const created = await prisma.$transaction(async (tx) => {
        // กันกดซ้ำพร้อมกัน: ตรวจใบที่ยังไม่จบอีกครั้งในธุรกรรม
        const dup = await tx.coopApplication.count({ where: { studentId: ctx.student.id, status: { notIn: COOP_FINAL_STATUSES } } });
        if (dup > 0) throw new Error("DUPLICATE");
        const app = await tx.coopApplication.create({
          data: {
            studentId: ctx.student.id,
            postingId: position.postingId,
            positionId: position.id,
            windowId: resolved.window!.id,
            companyName: position.posting.companyName,
            positionTitle: position.title,
            resumeUrl: resume!.url,
            resumeName: resume!.name,
            transcriptUrl: transcript!.url,
            transcriptName: transcript!.name,
            portfolioUrl: portfolio?.url || null,
            portfolioName: portfolio?.name || null,
            portfolioLink: link.value,
          },
        });
        // ผูกรอบออกฝึกให้นิสิต (เหมือนตอนยื่นสถานประกอบการ) เพื่อให้ตัวกรองรุ่น/รอบ และการปิดรุ่นนับนิสิตสหกิจด้วย
        await tx.student.update({ where: { id: ctx.student.id }, data: { internshipWindowId: resolved.window!.id } });
        return app;
      });

      const gpa = ctx.student.gpa;
      res.json({
        success: true,
        id: created.id,
        message: `ส่งใบสมัครสหกิจ "${position.posting.companyName} · ${position.title}" แล้ว — รอเจ้าหน้าที่ดำเนินการ`,
        gpaxWarning: typeof gpa === "number" && gpa < COOP_MIN_GPAX,
      });
    } catch (err: any) {
      if (err?.message === "DUPLICATE") {
        return res.status(400).json({ success: false, message: "คุณมีใบสมัครสหกิจอยู่แล้ว (สมัครได้ทีละ 1 ที่)" });
      }
      console.error("POST /api/student/coop-applications error:", err);
      res.status(500).json({ success: false, message: "ส่งใบสมัครไม่สำเร็จ กรุณาลองใหม่" });
    }
  }
);

// ยกเลิกใบสมัครเอง: ได้เฉพาะตอน "ส่งใบสมัครแล้ว" (เจ้าหน้าที่ยังไม่ส่งเอกสารให้บริษัท) · body = { reason? }
studentCoopRouter.post("/coop-applications/:id/cancel", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const student = await prisma.student.findUnique({ where: { userId: req.session.user!.id }, select: { id: true, studentCode: true } });
    if (!student) return res.status(404).json({ success: false, message: "ไม่พบข้อมูลนิสิต" });
    const app = await prisma.coopApplication.findFirst({ where: { id, studentId: student.id } });
    if (!app) return res.status(404).json({ success: false, message: "ไม่พบใบสมัคร" });
    if (!canStudentCancelCoop(app.status)) {
      return res.status(400).json({
        success: false,
        message: isActiveCoopApplication(app.status)
          ? "เจ้าหน้าที่ส่งเอกสารให้บริษัทแล้ว ยกเลิกเองไม่ได้ — ติดต่อเจ้าหน้าที่ฝ่ายฝึกงานเพื่อขอยกเลิก"
          : "ใบสมัครนี้จบไปแล้ว",
      });
    }
    const reason = String(req.body?.reason || "").trim().slice(0, 500);
    // where มี status กันกรณีเจ้าหน้าที่เปลี่ยนสถานะพร้อมกัน
    const r = await prisma.coopApplication.updateMany({
      where: { id, studentId: student.id, status: "SUBMITTED" },
      data: {
        status: "CANCELLED",
        statusNote: reason ? `นิสิตยกเลิกเอง: ${reason}` : "นิสิตยกเลิกเอง",
        statusUpdatedAt: new Date(),
        statusUpdatedBy: `นิสิต ${student.studentCode}`,
      },
    });
    if (!r.count) return res.status(409).json({ success: false, message: "สถานะใบสมัครเปลี่ยนไปแล้ว กรุณารีเฟรชหน้า" });
    res.json({ success: true, message: `ยกเลิกใบสมัคร "${app.companyName}" แล้ว — สมัครที่อื่นหรือไปยื่นสถานประกอบการได้` });
  } catch (err) {
    console.error("POST /api/student/coop-applications/:id/cancel error:", err);
    res.status(500).json({ success: false, message: "ยกเลิกใบสมัครไม่สำเร็จ" });
  }
});

// =====================================================================
// ใช้ร่วมกับหน้าอื่น (Export Co-op 01 / หน้าอาจารย์ / Profile นิสิต)
// =====================================================================

/** สรุปสหกิจของนิสิต 1 คน (อ่านอย่างเดียว) — ใบที่ยังไม่จบ + ประวัติ (ไม่ส่งไฟล์ใบสมัคร) */
export function coopSummaryForProfile(apps: any[]) {
  const view = (a: any) => ({
    id: a.id,
    companyName: a.companyName,
    positionTitle: a.positionTitle,
    status: a.status,
    statusLabel: COOP_APPLICATION_STATUS_LABEL[a.status as CoopApplicationStatus] || a.status,
    statusNote: a.statusNote || "",
    statusUpdatedAt: a.statusUpdatedAt,
    docStep: a.docStep || "NONE",
    docStepLabel: COOP_DOC_STEP_LABEL[(a.docStep || "NONE") as keyof typeof COOP_DOC_STEP_LABEL],
    docSteps: coopDocStepsView(a),
    createdAt: a.createdAt,
  });
  const sorted = [...apps].sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
  const active = sorted.find((a) => isActiveCoopApplication(a.status));
  return {
    active: active ? view(active) : null,
    history: sorted.filter((a) => !isActiveCoopApplication(a.status)).map(view),
  };
}

/**
 * แถว Export Co-op 01 ของนิสิตสหกิจ (ใบที่ยังไม่จบ) — รูปแบบเดียวกับ documentQueue
 * สถานะส่งตัว: ออกหนังสือส่งตัวแล้ว (ขั้นเอกสาร) = dispatchLetterIssued · ผ่านการคัดเลือก = companyResponseStatus ACCEPTED
 */
export async function buildCoopExportRows() {
  const apps = await prisma.coopApplication.findMany({
    where: { status: { notIn: COOP_FINAL_STATUSES } },
    orderBy: { createdAt: "desc" },
    include: {
      posting: { select: { address: true, province: true, hrContactName: true, hrPhone: true } },
      window: { select: { term: true, termType: true } },
      student: {
        select: {
          id: true, studentCode: true, nameTh: true, major: true, year: true, gpa: true, phone: true, isDropped: true,
          user: { select: { email: true } },
          advisor: { select: { name: true } },
          supervisor: { select: { name: true } },
        },
      },
    },
  });
  return apps
    .filter((a) => !a.student.isDropped)
    .map((a) => ({
      programType: "COOP" as const,
      coopApplicationId: a.id,
      coopStatus: a.status,
      coopStatusLabel: COOP_APPLICATION_STATUS_LABEL[a.status as CoopApplicationStatus],
      coopDocStep: a.docStep,
      coopDocStepLabel: COOP_DOC_STEP_LABEL[a.docStep],
      studentId: a.student.id,
      studentCode: a.student.studentCode,
      nameTh: a.student.nameTh,
      major: a.student.major || "",
      year: a.student.year,
      gpa: a.student.gpa,
      phone: a.student.phone || "-",
      email: a.student.user?.email || "-",
      advisorName: a.student.advisor?.name || "ยังไม่ระบุ",
      supervisorName: a.student.supervisor?.name || "ยังไม่ระบุ",
      companyName: a.companyName,
      position: a.positionTitle,
      companyAddress: a.posting.address || "-",
      companyProvince: a.posting.province || "-",
      contactPersonName: a.posting.hrContactName || "ฝ่ายทรัพยากรบุคคล (HR)",
      contactPersonPhone: a.posting.hrPhone || "-",
      cohortCode: (a.student.studentCode || "").slice(0, 2),
      windowTerm: a.window?.term || "",
      windowIsSummer: a.window?.termType === "SUMMER",
      requestLetterDocNo: "",
      dispatchLetterDocNo: "",
      companyResponseStatus: a.status === "ACCEPTED" ? "ACCEPTED" : "NOT_SENT",
      dispatchLetterIssued: a.docStep === "DISPATCH_LETTER",
    }));
}
