// =====================================================================
// รุ่น (Cohort) & รอบออกฝึก (Internship Window): ตัวช่วยคำนวณสถานะและสิทธิ์ยื่นของนิสิต
// - สถานะคำนวณจากวันที่ทุกครั้ง (Auto-lock เมื่อพ้นวันปิด) ไม่ต้องมี cron
// - พี่จอม Override ได้ด้วย extendedOpen (เปิดต่อพิเศษ) และ isCompleted (จบรอบ)
// =====================================================================
import { calculateCurrentAcademicYear } from "./studentImportParser";

export type WindowStatus =
  | "LOCKED"       // พี่จอมยังไม่ปลดล็อก
  | "NOT_YET_OPEN" // ปลดล็อกแล้วแต่ยังไม่ถึงวันเปิด
  | "OPEN"         // เปิดให้ยื่น
  | "EXTENDED"     // พ้นวันปิดแล้วแต่พี่จอมเปิดต่อพิเศษ
  | "EXPIRED"      // พ้นวันปิด (ล็อกอัตโนมัติ)
  | "COMPLETED";   // จบรอบ (กดเอง หรือพ้นวันสิ้นสุดการฝึก)

export const WINDOW_STATUS_LABEL: Record<WindowStatus, string> = {
  LOCKED: "ล็อกอยู่",
  NOT_YET_OPEN: "ยังไม่ถึงวันเปิด",
  OPEN: "เปิดยื่น",
  EXTENDED: "เปิดต่อพิเศษ",
  EXPIRED: "หมดเวลา (ล็อกอัตโนมัติ)",
  COMPLETED: "จบรอบแล้ว",
};

interface WindowLike {
  openDate: Date | null;
  closeDate: Date | null;
  internEndDate: Date | null;
  isUnlocked: boolean;
  extendedOpen: boolean;
  isCompleted: boolean;
}

/** วันที่ปัจจุบันตามเวลาไทย รูปแบบ YYYY-MM-DD */
export function todayYmdBangkok(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** แปลงค่า @db.Date (UTC เที่ยงคืน) เป็น YYYY-MM-DD */
export function ymd(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

/** แปลง "YYYY-MM-DD" จากฟอร์มเป็น Date สำหรับคอลัมน์ @db.Date (ค่าว่าง = null) */
export function parseYmd(v: unknown): Date | null {
  const s = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

export function computeWindowStatus(w: WindowLike, today: string = todayYmdBangkok()): WindowStatus {
  const end = ymd(w.internEndDate);
  if (w.isCompleted || (end && today > end)) return "COMPLETED";
  if (!w.isUnlocked) return "LOCKED";
  const open = ymd(w.openDate);
  const close = ymd(w.closeDate);
  if (open && today < open) return "NOT_YET_OPEN";
  if (close && today > close) return w.extendedOpen ? "EXTENDED" : "EXPIRED";
  return "OPEN";
}

export function canSubmitInWindow(status: WindowStatus): boolean {
  return status === "OPEN" || status === "EXTENDED";
}

/** รหัสรุ่นจากรหัสนิสิต เช่น "67023110" -> "67" */
export function cohortCodeOf(studentCode: string): string {
  const m = String(studentCode || "").match(/^(\d{2})/);
  return m ? m[1] : "";
}

/** ชั้นปีปัจจุบันของรุ่น เช่น รุ่น 67 ในปีการศึกษา 2569 = ปี 3 */
export function classYearOfCohort(cohortCode: string, academicYear: number = calculateCurrentAcademicYear()): number | null {
  const n = parseInt(cohortCode, 10);
  if (isNaN(n)) return null;
  return academicYear - (2500 + n) + 1;
}

/**
 * ปีการศึกษา (พ.ศ.) ของวันที่ ตามเวลาไทย ตัดรอบเดือน มิ.ย. (เหมือน calculateCurrentAcademicYear)
 * เช่น 17 พ.ย. 2026 -> 2569 | 20 ม.ค. 2027 -> 2569 | 1 มิ.ย. 2027 -> 2570
 */
export function academicYearOf(date: Date): number {
  const [y, m] = todayYmdBangkok(date).split("-").map(Number);
  const beYear = y + 543;
  return m < 6 ? beYear - 1 : beYear;
}

/** ปีการศึกษาที่รุ่นจบกระบวนการ: ค่าที่เลือกตอนปิดรุ่น หรือคิดจากวันที่ปิด (รุ่นที่ปิดก่อนมีช่องนี้) */
export function cohortAcademicYear(c: {
  status: string;
  archivedAt: Date | null;
  archivedAcademicYear?: string | null;
}): string {
  if (c.status !== "ARCHIVED") return "";
  if (c.archivedAcademicYear) return c.archivedAcademicYear;
  return c.archivedAt ? String(academicYearOf(c.archivedAt)) : "";
}

/**
 * ตรวจปีการศึกษาที่จบกระบวนการของรุ่น: ต้องเป็น พ.ศ. 4 หลัก ไม่ก่อนปีที่รุ่นเข้าศึกษา และไม่เกินปีการศึกษาถัดไป
 * คืนข้อความผิดพลาด หรือ null ถ้าถูกต้อง
 */
export function cohortAcademicYearError(
  value: string,
  cohortCode: string,
  currentAcademicYear: number = academicYearOf(new Date())
): string | null {
  if (!/^25\d{2}$/.test(value)) return "ปีการศึกษาต้องเป็น พ.ศ. 4 หลัก เช่น 2569";
  const year = parseInt(value, 10);
  const entryYear = 2500 + parseInt(cohortCode, 10);
  if (!isNaN(entryYear) && year < entryYear) return `ปีการศึกษาต้องไม่ก่อนปีที่รุ่น ${cohortCode} เข้าศึกษา (${entryYear})`;
  if (year > currentAcademicYear + 1) return `ปีการศึกษาต้องไม่เกิน ${currentAcademicYear + 1}`;
  return null;
}

/**
 * ตอนเปิดรุ่นกลับมาใช้งาน: แยกนิสิตที่ระบบเคยเปลี่ยนเป็นตกค้าง (RETEST) ตอนปิดรุ่น
 * - revert  = ยังเป็น RETEST และยังไม่ได้ผูกรอบของรุ่นอื่น -> คืนเป็น NEW
 * - movedOn = ยังเป็น RETEST แต่ยื่นรอบของรุ่นอื่นไปแล้ว -> คงเป็นตกค้าง
 * คนที่ไม่ใช่ RETEST แล้ว (เจ้าหน้าที่แก้เองระหว่างที่ปิดรุ่น) ไม่แตะ
 */
export function partitionRetestRevert<
  T extends { internshipType: string | null; internshipWindow: { cohortId: number } | null }
>(students: T[], cohortId: number): { revert: T[]; movedOn: T[] } {
  const stillRetest = students.filter((s) => s.internshipType === "RETEST");
  return {
    revert: stillRetest.filter((s) => !s.internshipWindow || s.internshipWindow.cohortId === cohortId),
    movedOn: stillRetest.filter((s) => s.internshipWindow && s.internshipWindow.cohortId !== cohortId),
  };
}

/** เลื่อนปีของรอบเทอม เช่น ("2/2568", 1) -> "2/2569" */
export function shiftTerm(term: string, years: number): string {
  return String(term).replace(/(\d{4})\s*$/, (y) => String(parseInt(y, 10) + years));
}

/** คีย์เรียงรอบเทอมตามเวลา เช่น "2/2568" -> 25682, "3/2569" -> 25693 */
export function termSortKey(term: string): number {
  const m = String(term).match(/^\s*(\d)\s*\/\s*(\d{4})/);
  return m ? parseInt(m[2], 10) * 10 + parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
}

export function isValidTerm(term: string): boolean {
  return /^[123]\/\d{4}$/.test(String(term).trim());
}

/**
 * ตรวจลำดับวันของรอบออกฝึก: เปิดยื่น ≤ ปิดยื่น ≤ เริ่มฝึก < สิ้นสุดการฝึก (ช่องที่เว้นว่างไม่ตรวจ)
 * คืนข้อความผิดพลาด หรือ null ถ้าถูกต้อง
 */
export function windowDateOrderError(d: {
  openDate?: Date | null;
  closeDate?: Date | null;
  internStartDate?: Date | null;
  internEndDate?: Date | null;
}): string | null {
  const open = ymd(d.openDate);
  const close = ymd(d.closeDate);
  const start = ymd(d.internStartDate);
  const end = ymd(d.internEndDate);
  if (open && close && open > close) return "วันเปิดยื่นต้องไม่เกินวันปิดยื่น";
  if (close && start && close > start) return "วันปิดยื่นต้องไม่เกินวันเริ่มฝึก";
  if (!close && open && start && open > start) return "วันเปิดยื่นต้องไม่เกินวันเริ่มฝึก";
  if (start && end && start >= end) return "วันเริ่มฝึกต้องอยู่ก่อนวันสิ้นสุดการฝึก";
  return null;
}

export function shiftDate(d: Date | null, years: number): Date | null {
  if (!d) return null;
  const nd = new Date(d.getTime());
  nd.setUTCFullYear(nd.getUTCFullYear() + years);
  return nd;
}

/**
 * เลือกรอบออกฝึกที่จะผูกกับนิสิตตอนยื่น Checklist
 * - มีรอบเปิดรอบเดียว -> ผูกอัตโนมัติ (ไม่ต้องให้เลือก)
 * - มีหลายรอบ (เช่น Summer + เทอม 1 เปิดพร้อมกัน / นิสิตตกค้างเลือกข้ามรุ่น) -> ต้องระบุ requestedId
 */
export function resolveSubmissionWindow<T extends { id: number }>(
  openWindows: T[],
  requestedId?: unknown,
  currentAssignedId?: number | null
): { window: T | null; error?: string } {
  if (openWindows.length === 0) {
    return { window: null, error: "สาขาของคุณยังไม่เปิดรอบยื่นขอฝึกงาน (รอปลดล็อกจากเจ้าหน้าที่คณะ)" };
  }
  const reqId = requestedId !== undefined && requestedId !== null && requestedId !== "" ? Number(requestedId) : null;
  if (reqId) {
    const found = openWindows.find((w) => w.id === reqId);
    if (!found) return { window: null, error: "รอบออกฝึกที่เลือกไม่ได้เปิดรับยื่นแล้ว กรุณาเลือกใหม่" };
    return { window: found };
  }
  if (openWindows.length === 1) return { window: openWindows[0] };
  const current = currentAssignedId ? openWindows.find((w) => w.id === currentAssignedId) : null;
  if (current) return { window: current };
  return { window: null, error: "มีรอบออกฝึกเปิดรับมากกว่า 1 รอบ กรุณาเลือกรอบที่ต้องการฝึก" };
}

/**
 * ข้อความแสดงรอบ เช่น "3/2569 (Summer)"
 * (ป้าย "ไม่บังคับ" เอาออกไปก่อน เพราะยังไม่มีกติกาผูกกับ isOptional — คอลัมน์ใน DB ยังเก็บไว้)
 */
export function windowDisplayLabel(w: { term: string; termType: string }): string {
  return w.termType === "SUMMER" ? `${w.term} (Summer)` : w.term;
}
