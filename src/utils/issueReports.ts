// ระบบ "แจ้งปัญหา" ของนิสิต — ตรวจข้อมูลที่ส่งมา + สร้างเลขเรื่อง + สรุปสำหรับแสดงผล
// เก็บใน super_admin_state.json (issueReports) ผ่าน superAdminStore

export const ISSUE_CATEGORIES = {
  LOGIN: "เข้าสู่ระบบ/บัญชี",
  PROFILE_DATA: "ข้อมูลส่วนตัวไม่ถูกต้อง",
  CV_DOCUMENT: "CV/เอกสาร",
  COMPANY: "การเลือกสถานประกอบการ",
  COOP: "การสมัครสหกิจ",
  SYSTEM_ERROR: "ระบบทำงานผิดพลาด",
  OTHER: "อื่นๆ",
} as const;
export type IssueCategory = keyof typeof ISSUE_CATEGORIES;

export const ISSUE_PAGES = [
  "Dashboard",
  "Profile",
  "ข้อมูลส่วนตัวนิสิต",
  "ชั่วโมงการอบรม",
  "Resume (CV)",
  "ติดตามสถานะ / สถานประกอบการ",
  "สถานะการยื่น",
  "สหกิจศึกษา",
  "เข้าสู่ระบบ",
  "อื่น ๆ / ไม่แน่ใจ",
] as const;

export const ISSUE_URGENCY = { LOW: "ต่ำ", MEDIUM: "ปานกลาง", HIGH: "สูง" } as const;
export type IssueUrgency = keyof typeof ISSUE_URGENCY;

export const ISSUE_STATUS = { OPEN: "รอดำเนินการ", IN_PROGRESS: "กำลังดำเนินการ", RESOLVED: "แก้ไขแล้ว" } as const;
export type IssueStatus = keyof typeof ISSUE_STATUS;

export const ISSUE_TITLE_MAX = 120;
export const ISSUE_DETAIL_MAX = 1000;
export const ISSUE_ADMIN_NOTE_MAX = 1000;
export const ISSUE_MAX_FILES = 3;
export const ISSUE_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const ISSUE_FILE_EXTS = [".png", ".jpg", ".jpeg", ".pdf"];

export interface IssueAttachment {
  name: string;
  url: string;
}

export interface IssueReport {
  id: string; // เช่น RP-0012
  studentId: number;
  studentCode: string;
  studentName: string;
  email: string;
  category: IssueCategory;
  title: string;
  page: string;
  detail: string;
  urgency: IssueUrgency;
  contactByEmail: boolean;
  attachments: IssueAttachment[];
  status: IssueStatus;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IssueReportInput {
  category: IssueCategory;
  title: string;
  page: string;
  detail: string;
  urgency: IssueUrgency;
  contactByEmail: boolean;
}

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);

/** ตรวจข้อมูลจากฟอร์ม → { value } หรือ { error } (ข้อความภาษาไทยสำหรับแสดงผู้ใช้) */
export function validateIssueInput(body: Record<string, unknown>): { value?: IssueReportInput; error?: string } {
  const category = String(body.category || "") as IssueCategory;
  if (!(category in ISSUE_CATEGORIES)) return { error: "กรุณาเลือกประเภทปัญหา" };

  const rawTitle = String(body.title ?? "").trim();
  if (!rawTitle) return { error: "กรุณากรอกหัวข้อ" };
  if (rawTitle.length > ISSUE_TITLE_MAX) return { error: `หัวข้อยาวได้ไม่เกิน ${ISSUE_TITLE_MAX} ตัวอักษร` };

  const rawDetail = String(body.detail ?? "").trim();
  if (!rawDetail) return { error: "กรุณากรอกรายละเอียด" };
  if (rawDetail.length > ISSUE_DETAIL_MAX) return { error: `รายละเอียดยาวได้ไม่เกิน ${ISSUE_DETAIL_MAX} ตัวอักษร` };

  const page = String(body.page || "");
  const urgency = String(body.urgency || "MEDIUM") as IssueUrgency;
  return {
    value: {
      category,
      title: clean(rawTitle, ISSUE_TITLE_MAX),
      page: (ISSUE_PAGES as readonly string[]).includes(page) ? page : ISSUE_PAGES[ISSUE_PAGES.length - 1],
      detail: clean(rawDetail, ISSUE_DETAIL_MAX),
      urgency: urgency in ISSUE_URGENCY ? urgency : "MEDIUM",
      contactByEmail: String(body.contactByEmail) === "true",
    },
  };
}

/** เลขเรื่องถัดไป RP-0001, RP-0002, ... (นับจากเลขมากสุดที่มี ไม่ใช่จำนวนรายการ กันเลขซ้ำถ้ามีการลบ) */
export function nextIssueId(existing: { id: string }[]): string {
  const max = existing.reduce((m, r) => {
    const n = Number(String(r.id).replace(/^RP-/, ""));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `RP-${String(max + 1).padStart(4, "0")}`;
}

export function isIssueStatus(v: unknown): v is IssueStatus {
  return typeof v === "string" && v in ISSUE_STATUS;
}
