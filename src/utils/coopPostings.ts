// =====================================================================
// สหกิจศึกษา: ประกาศรับนิสิต (CoopPosting + CoopPosition)
// ประกาศ = บริษัท + ตำแหน่งที่เปิดรับ เท่านั้น
// - รอบเทอม / ช่วงฝึก / วันปิดยื่น ใช้ตามรอบออกฝึกของสาขานิสิต (แท็บ "รอบฝึกงาน & ปลดล็อก") เหมือนฝึกงานปกติ
//   -> เจ้าหน้าที่ไม่ต้องตั้งในประกาศ (ตัดสินตอนนิสิตสมัคร)
// - เปิดรับทุกสาขา · GPAX ขั้นต่ำคงที่ 2.00 (แค่เตือน) · ปิดรับรายบริษัทได้ด้วยปุ่ม "ปิดรับ"
// - นำเข้า Excel: 1 แถว = 1 ตำแหน่ง, แถวที่ชื่อบริษัทเดียวกันรวมเป็น 1 ประกาศ
// ไฟล์นี้ไม่แตะฐานข้อมูล (ทดสอบได้ใน tests/coopPostings.test.ts)
// =====================================================================
import * as xlsx from "xlsx";
import { normalizeCompanyName } from "./companyImportParser";
import { normalizeProvince } from "./thaiProvinces";

/** GPAX ขั้นต่ำของสหกิจศึกษา (ใช้ทุกประกาศ) — ต่ำกว่านี้ระบบแค่เตือน ไม่ห้ามสมัคร */
export const COOP_MIN_GPAX = 2.0;

export type CoopPostingStatus = "OPEN" | "CLOSED";

export const COOP_STATUS_LABEL: Record<CoopPostingStatus, string> = {
  OPEN: "เปิดรับสมัคร",
  CLOSED: "ปิดรับแล้ว",
};

/** OPEN = เปิดรับ | CLOSED = เจ้าหน้าที่กดปิดรับ */
export function coopPostingStatus(p: { isClosed: boolean }): CoopPostingStatus {
  return p.isClosed ? "CLOSED" : "OPEN";
}

// ---------------------------------------------------------------------
// ใบสมัครสหกิจ (CoopApplication)
// ---------------------------------------------------------------------
export type CoopApplicationStatus = "SUBMITTED" | "SENT_TO_COMPANY" | "ACCEPTED" | "REJECTED" | "CANCELLED";

export const COOP_APPLICATION_STATUS_LABEL: Record<CoopApplicationStatus, string> = {
  SUBMITTED: "ส่งใบสมัครแล้ว (รอพิจารณา)",
  SENT_TO_COMPANY: "คณะส่งเอกสารให้บริษัทแล้ว",
  ACCEPTED: "ผ่านการคัดเลือก",
  REJECTED: "ไม่ผ่านการคัดเลือก",
  CANCELLED: "ยกเลิกใบสมัคร",
};

/** สถานะที่จบแล้ว (เก็บเข้าประวัติ เปลี่ยนต่อไม่ได้) — นิสิตสมัครที่อื่นหรือไปยื่นฝึกงานได้ */
export const COOP_FINAL_STATUSES: CoopApplicationStatus[] = ["REJECTED", "CANCELLED"];

/** สถานะที่เจ้าหน้าที่ต้องใส่เหตุผล */
export const COOP_STATUSES_NEED_NOTE: CoopApplicationStatus[] = ["REJECTED", "CANCELLED"];

/**
 * สถานะที่เจ้าหน้าที่เปลี่ยนไปได้ (ย้อนกลับได้ 1 ขั้นเผื่อกดผิด)
 * ไม่ผ่าน / ยกเลิก = เก็บเข้าประวัติแล้ว เปลี่ยนต่อไม่ได้ (นิสิตอาจไปสมัครที่อื่น/ฝึกงานแล้ว)
 * เจ้าหน้าที่ยกเลิกให้ได้ทุกสถานะที่ยังไม่จบ (รวมหลังผ่านการคัดเลือก เช่น นิสิตขอถอนตัว)
 */
export const COOP_STATUS_TRANSITIONS: Record<CoopApplicationStatus, CoopApplicationStatus[]> = {
  SUBMITTED: ["SENT_TO_COMPANY", "ACCEPTED", "REJECTED", "CANCELLED"],
  SENT_TO_COMPANY: ["SUBMITTED", "ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["SENT_TO_COMPANY", "REJECTED", "CANCELLED"],
  REJECTED: [],
  CANCELLED: [],
};

/**
 * เจ้าหน้าที่เปลี่ยนสถานะได้ไหม
 * ผ่านแล้วและเริ่มขั้นเอกสารแล้ว -> ย้อนสถานะไม่ได้ (ต้องย้อนขั้นเอกสารกลับเป็น "ยังไม่เริ่ม" ก่อน) แต่ยกเลิกได้
 */
export function canChangeCoopStatus(from: CoopApplicationStatus, to: CoopApplicationStatus, docStep: CoopDocStep = "NONE"): boolean {
  if (!(COOP_STATUS_TRANSITIONS[from]?.includes(to) ?? false)) return false;
  if (from === "ACCEPTED" && docStep !== "NONE" && to !== "CANCELLED") return false;
  return true;
}

/** นิสิตยกเลิกเองได้เฉพาะตอนที่เจ้าหน้าที่ยังไม่ส่งเอกสารให้บริษัท */
export function canStudentCancelCoop(status: string): boolean {
  return status === "SUBMITTED";
}

/** ใบสมัครที่ยังไม่จบ (ไม่ผ่าน / ยกเลิก = จบแล้ว เข้าประวัติ) — นิสิตมีได้ทีละ 1 ใบ */
export function isActiveCoopApplication(status: string): boolean {
  return !COOP_FINAL_STATUSES.includes(status as CoopApplicationStatus);
}

// ---------------------------------------------------------------------
// ขั้นเอกสารหลังผ่านการคัดเลือก (เจ้าหน้าที่ออกเอกสารเอง — ระบบแสดงขั้น + ไฟล์แนบให้นิสิตดู)
// ---------------------------------------------------------------------
export type CoopDocStep = "NONE" | "REQUEST_LETTER" | "ACCEPTANCE_FORM" | "DISPATCH_LETTER";

export const COOP_DOC_STEPS: CoopDocStep[] = ["NONE", "REQUEST_LETTER", "ACCEPTANCE_FORM", "DISPATCH_LETTER"];

export const COOP_DOC_STEP_LABEL: Record<CoopDocStep, string> = {
  NONE: "ยังไม่เริ่มออกเอกสาร",
  REQUEST_LETTER: "ออกหนังสือขอความอนุเคราะห์แล้ว",
  ACCEPTANCE_FORM: "ได้รับแบบตอบรับจากบริษัทแล้ว",
  DISPATCH_LETTER: "ออกหนังสือส่งตัวแล้ว",
};

/** ชื่อคอลัมน์ไฟล์/วันที่ของแต่ละขั้น (NONE ไม่มีไฟล์) */
export const COOP_DOC_STEP_FIELDS: Record<Exclude<CoopDocStep, "NONE">, { at: string; url: string; name: string; fileLabel: string }> = {
  REQUEST_LETTER: { at: "requestLetterAt", url: "requestLetterUrl", name: "requestLetterName", fileLabel: "หนังสือขอความอนุเคราะห์" },
  ACCEPTANCE_FORM: { at: "acceptanceFormAt", url: "acceptanceFormUrl", name: "acceptanceFormName", fileLabel: "แบบตอบรับจากบริษัท" },
  DISPATCH_LETTER: { at: "dispatchLetterAt", url: "dispatchLetterUrl", name: "dispatchLetterName", fileLabel: "หนังสือส่งตัว" },
};

export function isCoopDocStep(v: unknown): v is CoopDocStep {
  return typeof v === "string" && (COOP_DOC_STEPS as string[]).includes(v);
}

/**
 * ข้อมูลที่ต้องบันทึกเมื่อเจ้าหน้าที่ตั้งขั้นเอกสาร
 * - ขั้นที่ถึงแล้วแต่ยังไม่มีวันที่ -> ใส่วันที่ตอนนี้ (กดข้ามขั้นได้)
 * - ย้อนขั้น -> ล้างวันที่และไฟล์ของขั้นที่เลยมา (กันนิสิตเห็นเอกสารที่ยังไม่ออกจริง)
 * - file = ไฟล์แนบของขั้นที่ตั้ง (ไม่ส่ง = คงไฟล์เดิม)
 */
export function coopDocStepUpdate(
  current: Record<string, unknown>,
  target: CoopDocStep,
  now: Date,
  file?: { url: string; name: string } | null
): Record<string, unknown> {
  const data: Record<string, unknown> = { docStep: target };
  const targetIdx = COOP_DOC_STEPS.indexOf(target);
  (Object.keys(COOP_DOC_STEP_FIELDS) as Array<Exclude<CoopDocStep, "NONE">>).forEach((step) => {
    const f = COOP_DOC_STEP_FIELDS[step];
    if (COOP_DOC_STEPS.indexOf(step) <= targetIdx) {
      if (!current[f.at]) data[f.at] = now;
    } else {
      data[f.at] = null;
      data[f.url] = null;
      data[f.name] = null;
    }
  });
  if (file && target !== "NONE") {
    const f = COOP_DOC_STEP_FIELDS[target];
    data[f.url] = file.url;
    data[f.name] = file.name;
  }
  return data;
}

/** รายการขั้นเอกสารสำหรับแสดงผล (นิสิต / อาจารย์ / เจ้าหน้าที่) */
export function coopDocStepsView(a: Record<string, any>) {
  const idx = COOP_DOC_STEPS.indexOf((a.docStep || "NONE") as CoopDocStep);
  return (Object.keys(COOP_DOC_STEP_FIELDS) as Array<Exclude<CoopDocStep, "NONE">>).map((step) => {
    const f = COOP_DOC_STEP_FIELDS[step];
    return {
      step,
      label: COOP_DOC_STEP_LABEL[step],
      fileLabel: f.fileLabel,
      done: COOP_DOC_STEPS.indexOf(step) <= idx,
      at: a[f.at] || null,
      url: a[f.url] || "",
      name: a[f.name] || "",
    };
  });
}

export const COOP_FILE_MAX_BYTES = 10 * 1024 * 1024;

/** ไฟล์แนบ: PDF / JPG / PNG ไม่เกิน 10 MB */
export function coopFileError(file: { originalname: string; mimetype: string; size: number } | undefined, label: string): string | null {
  if (!file) return null;
  const ext = (file.originalname.match(/\.[^.]+$/)?.[0] || "").toLowerCase();
  const okExt = [".pdf", ".jpg", ".jpeg", ".png"].includes(ext);
  const okMime = ["application/pdf", "image/jpeg", "image/png"].includes(file.mimetype);
  if (!okExt || !okMime) return `${label}: รองรับเฉพาะไฟล์ PDF, JPG หรือ PNG`;
  if (file.size > COOP_FILE_MAX_BYTES) return `${label}: ไฟล์ใหญ่เกิน 10 MB`;
  return null;
}

/** ลิงก์ Portfolio: ว่างได้ / ต้องขึ้นต้น http(s):// (ไม่มีจะเติม https:// ให้) */
export function normalizePortfolioLink(raw: unknown): { value: string | null; error?: string } {
  const s = String(raw ?? "").trim();
  if (!s) return { value: null };
  const url = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  const bad = { value: null, error: "ลิงก์ Portfolio ไม่ถูกต้อง (เช่น https://github.com/ชื่อผู้ใช้)" };
  if (/\s/.test(url) || url.length > 500) return bad;
  try {
    // ต้องมีโดเมนจริง (มีจุด) — กันข้อความธรรมดาที่ถูกเติม https:// ให้
    const host = new URL(url).hostname;
    if (!host.includes(".") || host.startsWith(".") || host.endsWith(".")) return bad;
  } catch {
    return bad;
  }
  return { value: url };
}

export interface CoopPositionInput {
  id?: number;
  title: string;
  seats: number | null;
  description: string | null;
}

export interface CoopPostingInput {
  companyName: string;
  companyNameEn: string | null;
  masterCompanyId: string | null;
  description: string | null;
  qualifications: string | null;
  benefits: string | null;
  address: string | null;
  province: string | null;
  website: string | null;
  hrContactName: string | null;
  hrPhone: string | null;
  hrEmail: string | null;
  positions: CoopPositionInput[];
}

// ---------------------------------------------------------------------
// แปลงค่าทีละช่อง (ใช้ร่วมกันระหว่างฟอร์มและ Excel)
// ---------------------------------------------------------------------
function text(v: unknown, max = 4000): string | null {
  const s = String(v ?? "").replace(/\r\n/g, "\n").trim();
  return s ? s.slice(0, max) : null;
}

/** จำนวนที่รับ: "3", 3, "3 คน" -> 3 | ว่าง -> null */
export function parseSeats(raw: unknown): number | null | "INVALID" {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;
  const m = String(raw).match(/\d+/);
  if (!m) return "INVALID";
  const n = parseInt(m[0], 10);
  return n >= 1 && n <= 999 ? n : "INVALID";
}

function normalizeWebsite(v: unknown): string | null {
  const s = text(v, 500);
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export function normalizePositionTitle(title: string): string {
  return String(title || "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** จังหวัด: ว่างได้ แต่ถ้ากรอกต้องเป็นชื่อในรายการ 77 จังหวัด หรือ "ต่างประเทศ" */
function provinceOf(raw: unknown): { value: string | null; error?: string } {
  const p = normalizeProvince(raw);
  if (p === null) return { value: null, error: `ไม่รู้จักจังหวัด "${String(raw ?? "").trim()}" (เลือกจากรายการ หรือ "ต่างประเทศ")` };
  return { value: p || null };
}

/**
 * ตรวจข้อมูลประกาศจากฟอร์มของเจ้าหน้าที่ (JSON body)
 * positions = [{ id?, title, seats, description }]
 */
export function validateCoopPostingInput(body: any): { data?: CoopPostingInput; error?: string } {
  const companyName = text(body?.companyName, 200);
  if (!companyName) return { error: "กรุณากรอกชื่อบริษัท" };

  const province = provinceOf(body?.province);
  if (province.error) return { error: province.error };

  const rawPositions: any[] = Array.isArray(body?.positions) ? body.positions : [];
  const positions: CoopPositionInput[] = [];
  const seen = new Set<string>();
  for (const [i, p] of rawPositions.entries()) {
    const title = text(p?.title, 150);
    const description = text(p?.description);
    if (!title && !description && (p?.seats === undefined || String(p?.seats).trim() === "")) continue; // แถวว่าง
    if (!title) return { error: `ตำแหน่งที่ ${i + 1}: กรุณากรอกชื่อตำแหน่ง` };
    const key = normalizePositionTitle(title);
    if (seen.has(key)) return { error: `ตำแหน่ง "${title}" ซ้ำกัน` };
    seen.add(key);
    const seats = parseSeats(p?.seats);
    if (seats === "INVALID") return { error: `ตำแหน่ง "${title}": จำนวนที่รับต้องเป็นตัวเลข 1 – 999` };
    const id = p?.id ? Number(p.id) : undefined;
    positions.push({ ...(id ? { id } : {}), title, seats, description });
  }
  if (positions.length === 0) return { error: "ต้องมีตำแหน่งที่เปิดรับอย่างน้อย 1 ตำแหน่ง" };

  const hrEmail = text(body?.hrEmail, 200);
  if (hrEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(hrEmail)) return { error: "อีเมล HR ไม่ถูกต้อง" };

  return {
    data: {
      companyName,
      companyNameEn: text(body?.companyNameEn, 200),
      masterCompanyId: text(body?.masterCompanyId, 100),
      description: text(body?.description),
      qualifications: text(body?.qualifications),
      benefits: text(body?.benefits),
      address: text(body?.address, 1000),
      province: province.value,
      website: normalizeWebsite(body?.website),
      hrContactName: text(body?.hrContactName, 200),
      hrPhone: text(body?.hrPhone, 100),
      hrEmail,
      positions,
    },
  };
}

// ---------------------------------------------------------------------
// นำเข้าจาก Excel / CSV
// ---------------------------------------------------------------------
type CoopImportField =
  | "companyName" | "companyNameEn" | "positionTitle" | "seats" | "positionDescription"
  | "benefits" | "qualifications" | "description" | "address" | "province"
  | "website" | "hrContactName" | "hrPhone" | "hrEmail";

/** หัวคอลัมน์ของไฟล์ตัวอย่าง (ลำดับตามที่แสดงใน Excel) */
export const COOP_IMPORT_COLUMNS: { field: CoopImportField; header: string; width: number }[] = [
  { field: "companyName", header: "ชื่อบริษัท *", width: 34 },
  { field: "companyNameEn", header: "ชื่อบริษัท (อังกฤษ)", width: 28 },
  { field: "positionTitle", header: "ตำแหน่ง *", width: 26 },
  { field: "seats", header: "จำนวนที่รับ (คน)", width: 12 },
  { field: "positionDescription", header: "ลักษณะงาน", width: 40 },
  { field: "benefits", header: "สวัสดิการ / เบี้ยเลี้ยง", width: 34 },
  { field: "qualifications", header: "คุณสมบัติเพิ่มเติม", width: 30 },
  { field: "description", header: "รายละเอียดบริษัท", width: 40 },
  { field: "address", header: "ที่อยู่", width: 50 },
  { field: "province", header: "จังหวัด (หรือ ต่างประเทศ)", width: 16 },
  { field: "website", header: "เว็บไซต์", width: 26 },
  { field: "hrContactName", header: "ผู้ติดต่อ HR (เห็นเฉพาะเจ้าหน้าที่)", width: 22 },
  { field: "hrPhone", header: "เบอร์โทร HR", width: 14 },
  { field: "hrEmail", header: "อีเมล HR", width: 26 },
];

/** จับคู่หัวคอลัมน์ -> ฟิลด์ (เช็กคำเฉพาะก่อน เช่น "ตำแหน่งผู้ติดต่อ" ต้องไม่ถูกนับเป็นตำแหน่งงาน) */
export function detectCoopField(header: string): CoopImportField | null {
  const h = String(header || "").replace(/\s+/g, "").toLowerCase();
  if (!h) return null;
  // คอลัมน์ที่เลิกใช้ (รอบ/วันที่ตามรอบออกฝึก · เปิดรับทุกสาขา · GPAX คงที่ 2.00) -> ไม่นำเข้า
  if (/รอบ|เทอม|ภาคเรียน|term|semester|ปิดรับ|วันปิด|deadline|วันเริ่ม|เริ่มฝึก|สิ้นสุด|gpax|gpa|เกรด|สาขา|major/.test(h)) return null;
  if (/อีเมล|อีเมล์|email|e-mail/.test(h)) return "hrEmail";
  if (/โทร|เบอร์|phone|^tel/.test(h)) return "hrPhone";
  if (/ผู้ติดต่อ|ผู้ประสานงาน|contact|^hr/.test(h)) return "hrContactName";
  if (/จำนวน|seats|รับกี่/.test(h)) return "seats";
  if (/ลักษณะงาน|รายละเอียดงาน|jobdesc/.test(h)) return "positionDescription";
  if (/ตำแหน่ง|position|jobtitle/.test(h)) return "positionTitle";
  if (/คุณสมบัติ|qualification/.test(h)) return "qualifications";
  if (/สวัสดิการ|เบี้ยเลี้ยง|benefit/.test(h)) return "benefits";
  if (/เว็บ|website|url/.test(h)) return "website";
  if (/จังหวัด|province/.test(h)) return "province";
  if (/ที่อยู่|ที่ตั้ง|address/.test(h)) return "address";
  if (/รายละเอียด|เกี่ยวกับ|description|about/.test(h)) return "description";
  if (/อังกฤษ|english|nameen|\(en\)/.test(h)) return "companyNameEn";
  if (/ชื่อ|บริษัท|สถานประกอบการ|หน่วยงาน|องค์กร|company|name/.test(h)) return "companyName";
  return null;
}

export interface CoopImportRow {
  rowNumber: number;
  cells: Partial<Record<CoopImportField, unknown>>;
}

function readWorkbook(buffer: Buffer): xlsx.WorkBook {
  const isZip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isOle = buffer.length >= 4 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
  if (isZip || isOle) return xlsx.read(buffer, { type: "buffer" });
  // CSV: ถอดรหัสเป็น UTF-8 เอง (xlsx อ่าน CSV ที่ไม่มี BOM เป็น latin1 ภาษาไทยจะเพี้ยน)
  return xlsx.read(buffer.toString("utf8").replace(/^﻿/, ""), { type: "string" });
}

/** อ่านแผ่นงานแรก -> แถวดิบ (ข้ามแถวว่างทั้งแถว) */
export function parseCoopPostingSheet(buffer: Buffer): CoopImportRow[] {
  const workbook = readWorkbook(buffer);
  if (!workbook.SheetNames?.length) throw new Error("ไม่พบแผ่นงาน (Sheet) ในไฟล์ที่อัปโหลด");
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  if (rawRows.length === 0) throw new Error("ไม่พบข้อมูลในไฟล์ หรือไฟล์ว่างเปล่า");

  const fieldToHeader = new Map<CoopImportField, string>();
  for (const header of Object.keys(rawRows[0])) {
    const field = detectCoopField(header);
    if (field && !fieldToHeader.has(field)) fieldToHeader.set(field, header);
  }
  const missing = (["companyName", "positionTitle"] as CoopImportField[]).filter((f) => !fieldToHeader.has(f));
  if (missing.length) {
    const names: Record<string, string> = { companyName: "ชื่อบริษัท", positionTitle: "ตำแหน่ง" };
    throw new Error(`ไม่พบคอลัมน์: ${missing.map((f) => names[f]).join(", ")} (ดาวน์โหลดไฟล์ตัวอย่างเพื่อดูหัวคอลัมน์)`);
  }

  const rows: CoopImportRow[] = [];
  rawRows.forEach((raw, i) => {
    const cells: CoopImportRow["cells"] = {};
    let hasValue = false;
    for (const [field, header] of fieldToHeader) {
      const v = raw[header];
      cells[field] = v;
      if (String(v ?? "").trim() !== "") hasValue = true;
    }
    // เบอร์ที่ Excel เก็บเป็นตัวเลขจะเสียเลข 0 นำหน้า -> เติมคืน (เบอร์ไทย 8–9 หลัก)
    if (typeof cells.hrPhone === "number" && /^[1-9]\d{7,8}$/.test(String(cells.hrPhone))) cells.hrPhone = `0${cells.hrPhone}`;
    if (hasValue) rows.push({ rowNumber: i + 2, cells }); // แถว 1 = หัวตาราง
  });
  return rows;
}

export interface CoopImportGroup {
  key: string;
  action: "CREATE" | "UPDATE";
  existingId?: number;
  rowNumbers: number[];
  data: CoopPostingInput;
  positions: (CoopPositionInput & { action: "CREATE" | "UPDATE"; existingPositionId?: number })[];
}

export interface CoopImportPlan {
  groups: CoopImportGroup[];
  errors: { rowNumber: number; message: string }[];
}

/** 1 บริษัท = 1 ประกาศ (เทียบชื่อแบบตัดช่องว่าง/ตัวพิมพ์) */
export function coopPostingKey(companyName: string): string {
  return normalizeCompanyName(companyName);
}

/**
 * จัดกลุ่มแถว -> ประกาศ (ตามชื่อบริษัท) และเทียบกับประกาศที่มีอยู่
 * - ข้อมูลระดับประกาศ (ที่อยู่ สวัสดิการ ฯลฯ) ใช้ค่าแรกที่ไม่ว่างในกลุ่ม
 * - ประกาศเดิม: ตำแหน่งชื่อเดียวกันจะอัปเดต ตำแหน่งใหม่จะเพิ่ม (ตำแหน่งเดิมที่ไม่อยู่ในไฟล์ไม่ถูกลบ)
 * - แถวที่ข้อมูลผิดจะถูกข้ามและแจ้งใน errors
 */
export function buildCoopImportPlan(
  rows: CoopImportRow[],
  existing: { id: number; companyName: string; positions: { id: number; title: string }[] }[]
): CoopImportPlan {
  const errors: CoopImportPlan["errors"] = [];
  const groups = new Map<string, CoopImportGroup>();
  const existingByKey = new Map(existing.map((p) => [coopPostingKey(p.companyName), p]));

  for (const row of rows) {
    const c = row.cells;
    const fail = (message: string) => errors.push({ rowNumber: row.rowNumber, message });
    const companyName = text(c.companyName, 200);
    if (!companyName) { fail("ไม่มีชื่อบริษัท"); continue; }
    const title = text(c.positionTitle, 150);
    if (!title) { fail("ไม่มีชื่อตำแหน่ง"); continue; }
    const seats = parseSeats(c.seats);
    if (seats === "INVALID") { fail("จำนวนที่รับต้องเป็นตัวเลข 1 – 999"); continue; }
    const province = provinceOf(c.province);
    if (province.error) { fail(province.error); continue; }
    const hrEmail = text(c.hrEmail, 200);

    const key = coopPostingKey(companyName);
    let group = groups.get(key);
    if (!group) {
      const found = existingByKey.get(key);
      group = {
        key,
        action: found ? "UPDATE" : "CREATE",
        ...(found ? { existingId: found.id } : {}),
        rowNumbers: [],
        data: {
          companyName, companyNameEn: null, masterCompanyId: null,
          description: null, qualifications: null, benefits: null,
          address: null, province: null, website: null,
          hrContactName: null, hrPhone: null, hrEmail: null, positions: [],
        },
        positions: [],
      };
      groups.set(key, group);
    }
    const d = group.data;
    // ค่าแรกที่ไม่ว่างของกลุ่ม
    d.companyNameEn ??= text(c.companyNameEn, 200);
    d.description ??= text(c.description);
    d.qualifications ??= text(c.qualifications);
    d.benefits ??= text(c.benefits);
    d.address ??= text(c.address, 1000);
    d.province ??= province.value;
    d.website ??= normalizeWebsite(c.website);
    d.hrContactName ??= text(c.hrContactName, 200);
    d.hrPhone ??= text(c.hrPhone, 100);
    d.hrEmail ??= hrEmail;

    const titleKey = normalizePositionTitle(title);
    if (group.positions.some((p) => normalizePositionTitle(p.title) === titleKey)) {
      fail(`ตำแหน่ง "${title}" ซ้ำกับแถวก่อนหน้าของบริษัทเดียวกัน (ใช้แถวแรก)`);
      continue;
    }
    const existingPosting = existingByKey.get(key);
    const existingPosition = existingPosting?.positions.find((p) => normalizePositionTitle(p.title) === titleKey);
    group.positions.push({
      title,
      seats,
      description: text(c.positionDescription),
      action: existingPosition ? "UPDATE" : "CREATE",
      ...(existingPosition ? { existingPositionId: existingPosition.id } : {}),
    });
    group.rowNumbers.push(row.rowNumber);
  }

  for (const g of groups.values()) g.data.positions = g.positions.map(({ title, seats, description }) => ({ title, seats, description }));
  return { groups: Array.from(groups.values()), errors };
}

/** ไฟล์ตัวอย่าง .xlsx สำหรับนำเข้าประกาศสหกิจ */
export function buildCoopImportTemplate(): Buffer {
  const header = COOP_IMPORT_COLUMNS.map((c) => c.header);
  const row = (values: Partial<Record<CoopImportField, string | number>>) => COOP_IMPORT_COLUMNS.map((c) => values[c.field] ?? "");
  const company1 = {
    companyName: "บริษัท ตัวอย่างซอฟต์แวร์ จำกัด", companyNameEn: "Example Software Co., Ltd.",
    benefits: "เบี้ยเลี้ยง 300 บาท/วัน, มีที่พักให้", description: "บริษัทพัฒนาซอฟต์แวร์องค์กร ก่อตั้ง 2550",
    address: "99 ถนนพหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพมหานคร 10900", province: "กรุงเทพมหานคร",
    website: "https://example-software.co.th",
    hrContactName: "คุณสมชาย ใจดี", hrPhone: "02-123-4567", hrEmail: "hr@example-software.co.th",
  };
  const rows = [
    header,
    row({ ...company1, positionTitle: "Full-Stack Developer", seats: 3, positionDescription: "พัฒนาเว็บแอปพลิเคชันด้วย React / Node.js", qualifications: "มีพื้นฐาน JavaScript" }),
    row({ companyName: company1.companyName, positionTitle: "QA / Software Tester", seats: 2, positionDescription: "เขียน Test case และทดสอบระบบ" }),
    row({
      companyName: "บริษัท แผนที่ตัวอย่าง จำกัด", positionTitle: "GIS Specialist / GIS Developer", seats: 1,
      positionDescription: "จัดทำแผนที่และวิเคราะห์ข้อมูลเชิงพื้นที่", province: "เชียงใหม่",
      address: "123 ถนนห้วยแก้ว ตำบลสุเทพ อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50200",
      hrContactName: "ฝ่ายทรัพยากรบุคคล", hrPhone: "053-222-333",
    }),
  ];
  const sheet = xlsx.utils.aoa_to_sheet(rows);
  sheet["!cols"] = COOP_IMPORT_COLUMNS.map((c) => ({ wch: c.width }));
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, sheet, "ประกาศสหกิจ");
  return xlsx.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
