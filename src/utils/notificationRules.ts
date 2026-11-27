// กติกาของระบบแจ้งเตือน (ไม่แตะฐานข้อมูล → เขียน unit test ได้) ใช้ร่วมกับ src/utils/notifications.ts
import { normalizeMajor } from "./majors";

// โรลที่ "เห็น" การแจ้งเตือน — ตรงกับ session.user.activeRole ที่ผู้ใช้กำลังใช้งาน
export const NOTIFICATION_AUDIENCES = ["STUDENT", "ADVISOR", "COURSE_ADMIN", "STAFF"] as const;
export type NotificationAudience = (typeof NOTIFICATION_AUDIENCES)[number];

// หมวดสำหรับกรองในหน้า "การแจ้งเตือน"
export const NOTIFICATION_CATEGORIES = {
  approval: "ผลการอนุมัติ",
  document: "เอกสาร",
  cv: "CV",
  training: "ชั่วโมงอบรม",
  issue: "แจ้งปัญหา",
  account: "บัญชี/ข้อมูลส่วนตัว",
  assignment: "การมอบหมาย",
  coop: "สหกิจศึกษา",
  deadline: "กำหนดการ",
} as const;
export type NotificationCategory = keyof typeof NOTIFICATION_CATEGORIES;

// หมวดที่แต่ละโรลได้รับจริง → ใช้เป็นตัวเลือก "ประเภท" ในหน้าการแจ้งเตือน (เพิ่มการแจ้งเตือนหมวดใหม่ให้โรลไหน ต้องเพิ่มที่นี่ด้วย)
export const AUDIENCE_CATEGORIES: Record<NotificationAudience, readonly NotificationCategory[]> = {
  STUDENT: ["approval", "document", "training", "cv", "coop", "deadline", "account", "assignment", "issue"],
  ADVISOR: ["approval", "document", "cv", "assignment"],
  COURSE_ADMIN: ["approval", "document"],
  STAFF: ["document", "coop", "issue", "account"],
};

/** หมวดของโรล → { key: ชื่อหมวด } เรียงตาม AUDIENCE_CATEGORIES */
export function categoriesFor(audience: NotificationAudience): Partial<Record<NotificationCategory, string>> {
  return Object.fromEntries(AUDIENCE_CATEGORIES[audience].map((k) => [k, NOTIFICATION_CATEGORIES[k]]));
}

/** รับหมวดจาก query เฉพาะที่อยู่ในรายการของโรลนั้น (อื่น ๆ = ไม่กรอง) */
export function parseCategory(audience: NotificationAudience, raw: unknown): NotificationCategory | null {
  const s = String(raw ?? "");
  return (AUDIENCE_CATEGORIES[audience] as readonly string[]).includes(s) ? (s as NotificationCategory) : null;
}

export type NotificationReadFilter = "all" | "unread" | "read";
export function parseReadFilter(raw: unknown): NotificationReadFilter {
  return raw === "unread" || raw === "read" ? raw : "all";
}

/** คำค้น: ตัดช่องว่าง จำกัด 100 ตัวอักษร ว่าง = null */
export function parseSearch(raw: unknown): string | null {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
  return s || null;
}

export type NotificationPriorityValue = "LOW" | "NORMAL" | "HIGH";

export interface NotificationPayload {
  type: string;
  category: NotificationCategory;
  title: string;
  message: string;
  link?: string | null;
  priority?: NotificationPriorityValue;
  entityType?: string | null;
  entityId?: string | number | null;
  dedupeKey?: string | null;
  /** สาขาของนิสิตที่เกี่ยวข้อง (ค่าดิบจาก Student.major ก็ได้ — normalize ให้ตอนบันทึก) */
  major?: string | null;
}

export interface NotificationInput extends NotificationPayload {
  userId: number;
  audience: NotificationAudience;
}

export interface NormalizedNotification {
  recipientUserId: number;
  audience: NotificationAudience;
  type: string;
  category: NotificationCategory;
  priority: NotificationPriorityValue;
  title: string;
  message: string;
  link: string | null;
  entityType: string | null;
  entityId: string | null;
  dedupeKey: string | null;
  major: string | null;
}

export const TITLE_MAX = 160;
export const MESSAGE_MAX = 600;

/** activeRole (หรือ role เดิม) ใน session → audience ของการแจ้งเตือน */
export function audienceFromActiveRole(activeRole?: string | null, role?: string | null): NotificationAudience {
  const r = String(activeRole || role || "").toUpperCase();
  if (r === "STUDENT") return "STUDENT";
  if (r === "ADVISOR" || r === "SUPERVISOR") return "ADVISOR";
  if (r === "STAFF" || r === "FACULTY_STAFF") return "STAFF";
  if (r === "COURSE_ADMIN" || r === "COURSE_INSTRUCTOR" || r === "ADMIN") return "COURSE_ADMIN";
  return "STUDENT";
}

function clip(text: unknown, max: number): string {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** รับเฉพาะลิงก์ภายในระบบ (ขึ้นต้นด้วย / แต่ไม่ใช่ //) กันลิงก์ออกนอกระบบ */
export function safeInternalLink(link?: string | null): string | null {
  if (!link) return null;
  const s = String(link).trim();
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\")) return null;
  return s.slice(0, 300);
}

/** ตรวจ/ตัดข้อความก่อนบันทึก — คืน null ถ้าข้อมูลไม่ครบ (ไม่ throw เพื่อไม่ให้ action หลักล้ม) */
export function normalizeNotification(input: NotificationInput): NormalizedNotification | null {
  const userId = Number(input.userId);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  if (!NOTIFICATION_AUDIENCES.includes(input.audience)) return null;
  if (!(input.category in NOTIFICATION_CATEGORIES)) return null;
  const title = clip(input.title, TITLE_MAX);
  if (!title || !input.type) return null;
  const priority: NotificationPriorityValue =
    input.priority === "HIGH" || input.priority === "LOW" ? input.priority : "NORMAL";
  return {
    recipientUserId: userId,
    audience: input.audience,
    type: clip(input.type, 60),
    category: input.category,
    priority,
    title,
    message: clip(input.message, MESSAGE_MAX),
    link: safeInternalLink(input.link),
    entityType: input.entityType ? clip(input.entityType, 60) : null,
    entityId: input.entityId === undefined || input.entityId === null || input.entityId === "" ? null : clip(input.entityId, 60),
    dedupeKey: input.dedupeKey ? clip(input.dedupeKey, 200) : null,
    major: input.major ? clip(normalizeMajor(input.major), 100) || null : null,
  };
}

/** โรลที่มีตัวกรอง "สาขา" ในหน้าการแจ้งเตือน (admin ดูนิสิตหลายสาขา) */
export function hasMajorFilter(audience: NotificationAudience): boolean {
  return audience === "COURSE_ADMIN" || audience === "STAFF";
}

/** ความเร่งด่วนของเรื่องแจ้งปัญหา → priority ของการแจ้งเตือน */
export function priorityFromUrgency(urgency?: string | null): NotificationPriorityValue {
  if (urgency === "HIGH") return "HIGH";
  if (urgency === "LOW") return "LOW";
  return "NORMAL";
}

const APPROVAL_TEXT: Record<string, string> = { APPROVED: "อนุมัติแล้ว", REJECTED: "ไม่อนุมัติ", PENDING: "กลับเป็นรอตรวจ" };

/** ข้อความผลอนุมัติ เช่น "อนุมัติแล้ว" / "ไม่อนุมัติ" */
export function approvalText(status: string): string {
  return APPROVAL_TEXT[status] || status;
}

/** priority ของผลอนุมัติ: ไม่อนุมัติ = HIGH (นิสิตต้องแก้ไข) */
export function approvalPriority(status: string): NotificationPriorityValue {
  return status === "REJECTED" ? "HIGH" : "NORMAL";
}

/** ต่อท้ายหมายเหตุ ถ้ามี */
export function withNote(message: string, note?: string | null): string {
  const n = String(note ?? "").trim();
  return n ? `${message} · หมายเหตุ: ${n}` : message;
}

// ===== payload สำเร็จรูป (ใช้ร่วมหลาย route) =====

/** สถานะที่ต้องแจ้งผลนิสิต (อนุมัติ/ไม่อนุมัติ) */
export function isDecision(status: unknown): status is "APPROVED" | "REJECTED" {
  return status === "APPROVED" || status === "REJECTED";
}

/** แจ้งนิสิต: ผลอนุมัติสถานที่ฝึกงาน */
export function placementResultPayload(status: string, note?: string | null, entityId?: number | null): NotificationPayload {
  return {
    type: `PLACEMENT_${status}`,
    category: "approval",
    priority: approvalPriority(status),
    title: `สถานที่ฝึกงานของคุณ${approvalText(status)}`,
    message: withNote(status === "REJECTED" ? "กรุณาตรวจสอบและแก้ไขข้อมูลสถานที่ฝึกงาน" : "ดูรายละเอียดได้ที่หน้าจัดการข้อมูลฝึกงาน", note),
    link: "/status-all",
    entityType: "InternshipPlacement",
    entityId: entityId ?? null,
  };
}

/** แจ้งนิสิต: ผลตรวจ Checklist บริษัทโดยอาจารย์ที่ปรึกษา */
export function checklistResultPayload(status: string, note?: string | null, companyName?: string | null, companyId?: number): NotificationPayload {
  return {
    type: `CHECKLIST_${status}`,
    category: "approval",
    priority: approvalPriority(status),
    title: `อาจารย์ที่ปรึกษา${approvalText(status)} Checklist บริษัท${companyName ? ` ${companyName}` : "ของคุณ"}`,
    message: withNote(status === "REJECTED" ? "กรุณาแก้ไขหรือยื่นบริษัทใหม่ที่หน้าจัดการข้อมูลฝึกงาน" : "ดูรายละเอียดได้ที่หน้าจัดการข้อมูลฝึกงาน", note),
    link: "/status-all",
    entityType: "Company",
    entityId: companyId ?? null,
  };
}

/** แจ้งนิสิต: ผลตรวจชั่วโมงอบรม — ส่ง record เดียว หรือจำนวนรายการ (กรณีตรวจหลายรายการพร้อมกัน) */
export function trainingResultPayload(
  status: string,
  note: string | null | undefined,
  target: { id: number; title: string; skillType: string; hours: number } | number
): NotificationPayload {
  const result = status === "APPROVED" ? "ผ่านการอนุมัติ" : "ไม่ผ่าน";
  const base = { type: `TRAINING_${status}`, category: "training" as const, priority: approvalPriority(status), link: "/certificate", entityType: "TrainingRecord" };
  if (typeof target === "number") {
    return { ...base, title: `ชั่วโมงอบรม ${target} รายการ${result}`, message: withNote("ดูรายละเอียดได้ที่หน้าใบประกาศอบรม", note) };
  }
  const skill = target.skillType === "SOFT" ? "Soft skill" : "Hard skill";
  const fix = status === "REJECTED" ? " — กรุณาตรวจสอบและแนบหลักฐานใหม่" : "";
  return { ...base, title: `ชั่วโมงอบรม "${target.title}" ${result}`, message: withNote(`${skill} ${target.hours} ชม.${fix}`, note), entityId: target.id };
}

/** แจ้งนิสิต: ความคืบหน้าเอกสารฝึกงาน (ลิงก์ไปหน้าจัดการข้อมูลฝึกงาน) */
export function docWorkflowPayload(
  studentId: number,
  type: string,
  title: string,
  message: string,
  priority?: NotificationPriorityValue
): NotificationPayload {
  return { type, category: "document", priority, title, message, link: "/status-all", entityType: "DocWorkflow", entityId: studentId };
}

/** แจ้งนิสิต: ความคืบหน้าใบสมัครสหกิจศึกษา (ลิงก์ไปหน้าจัดการข้อมูลฝึกงาน) */
export function coopPayload(
  applicationId: number,
  type: string,
  title: string,
  message: string,
  priority?: NotificationPriorityValue
): NotificationPayload {
  return { type, category: "coop", priority, title, message, link: "/status-all", entityType: "CoopApplication", entityId: applicationId };
}

export interface StudentRef {
  id: number;
  nameTh: string;
  studentCode: string;
}

/** แจ้งอาจารย์/เจ้าหน้าที่: เหตุการณ์ของนิสิตรายคน — ข้อความขึ้นต้นด้วยรหัสนิสิต + ลิงก์ไปหน้ารายละเอียดนิสิต (ส่ง link เองเพื่อเปลี่ยนปลายทางได้) */
export function studentEventPayload(st: StudentRef, p: Omit<NotificationPayload, "entityId">): NotificationPayload {
  return { ...p, message: `รหัส ${st.studentCode} · ${p.message}`, link: p.link ?? `/admin-student-detail?id=${st.id}`, entityId: st.id };
}

/** แจ้งอาจารย์: ได้รับมอบหมายนิสิตในความดูแล */
export function staffAssignedPayload(mode: "ADVISOR" | "SUPERVISOR", staffId: number, count: number): NotificationPayload {
  const advisor = mode === "ADVISOR";
  return {
    type: advisor ? "ADVISEES_ASSIGNED" : "SUPERVISEES_ASSIGNED",
    category: "assignment",
    title: `คุณได้รับมอบหมายเป็น${advisor ? "อาจารย์ที่ปรึกษา" : "อาจารย์นิเทศก์"}ของนิสิต ${count} คน`,
    message: advisor ? "ดูรายชื่อนิสิตในความดูแลได้ที่ Dashboard อาจารย์ที่ปรึกษา" : "ดูรายชื่อได้ที่ Dashboard (โหมดอาจารย์นิเทศก์)",
    link: advisor ? "/advisor-dashboard" : "/advisor-dashboard?roleMode=SUPERVISOR",
    entityType: "Staff",
    entityId: staffId,
  };
}

/** จำนวนวันเต็มก่อนถึงวันปิด (ตามวันที่ไทย ไม่สนเวลา) — ติดลบ = เลยแล้ว */
export function daysUntil(date: Date, now: Date = new Date()): number {
  // "วันนี้" ตามเวลาไทย (UTC+7) ไม่ขึ้นกับ timezone ของเซิร์ฟเวอร์ (Vercel = UTC)
  const bkk = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const a = Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate());
  const b = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((b - a) / 86400000);
}

/** ช่วงวันที่ควรเตือนก่อนปิดรอบ: คืน key ของช่วง (กันเตือนซ้ำในช่วงเดียวกัน) หรือ null ถ้ายังไม่ถึง/เลยแล้ว */
export function deadlineReminderBucket(daysLeft: number): "7d" | "3d" | "1d" | null {
  if (daysLeft < 0) return null;
  if (daysLeft <= 1) return "1d";
  if (daysLeft <= 3) return "3d";
  if (daysLeft <= 7) return "7d";
  return null;
}
