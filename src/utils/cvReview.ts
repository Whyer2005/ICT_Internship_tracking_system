// =====================================================================
// Resume (CV): อาจารย์ไม่อนุมัติแล้ว — คอมเมนต์อย่างเดียว (ยืนยัน 24 พ.ย. 2569)
// - เงื่อนไขเตรียมความพร้อม = "อัปโหลด CV แล้ว" (ไม่ต้องรอผ่าน)
// - คอมเมนต์ได้: อาจารย์ที่ปรึกษา (เฉพาะนิสิตของตน) + อาจารย์ประจำวิชา · เจ้าหน้าที่ดูอย่างเดียว · นิสิตอ่านอย่างเดียว
// - อัปโหลดไฟล์ใหม่ คอมเมนต์เดิมยังอยู่ (ติดป้ายว่าเขียนถึงไฟล์เก่า)
// StudentCV.status / note เลิกใช้ (คงคอลัมน์ไว้)
// ไฟล์นี้ไม่แตะฐานข้อมูล (ทดสอบได้ใน tests/cvReview.test.ts)
// =====================================================================

/** NONE = ยังไม่อัปโหลด · WAITING = อัปโหลดแล้ว ยังไม่มีคอมเมนต์หลังไฟล์ล่าสุด · COMMENTED = อาจารย์คอมเมนต์ไฟล์ล่าสุดแล้ว */
export type CvState = "NONE" | "WAITING" | "COMMENTED";

export interface CvLike {
  fileUrl?: string | null;
  uploadedAt?: Date | string | null;
  lastCommentAt?: Date | string | null;
}

export const CV_STATE_LABEL: Record<CvState, string> = {
  NONE: "ยังไม่อัปโหลด CV",
  WAITING: "อัปโหลดแล้ว รอคอมเมนต์",
  COMMENTED: "อาจารย์คอมเมนต์แล้ว",
};

/** หมวดเดิมของ Dashboard (cvCategory) */
export const CV_CATEGORY: Record<CvState, "noCv" | "waiting" | "commented"> = {
  NONE: "noCv",
  WAITING: "waiting",
  COMMENTED: "commented",
};

const time = (v: Date | string | null | undefined): number | null => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};

/** มี CV แล้ว = ผ่านเงื่อนไขเตรียมความพร้อมส่วน CV */
export function hasCv(cv: CvLike | null | undefined): boolean {
  return Boolean(cv && cv.fileUrl);
}

export function cvState(cv: CvLike | null | undefined): CvState {
  if (!hasCv(cv)) return "NONE";
  const commented = time(cv!.lastCommentAt);
  const uploaded = time(cv!.uploadedAt);
  if (commented !== null && (uploaded === null || commented >= uploaded)) return "COMMENTED";
  return "WAITING";
}

/** อัปโหลดไฟล์ใหม่หลังคอมเมนต์ล่าสุด (บอกอาจารย์ว่านิสิตแก้แล้ว) */
export function uploadedAfterLastComment(cv: CvLike | null | undefined): boolean {
  if (!hasCv(cv)) return false;
  const commented = time(cv!.lastCommentAt);
  const uploaded = time(cv!.uploadedAt);
  return commented !== null && uploaded !== null && uploaded > commented;
}

/** คอมเมนต์นี้เขียนถึงไฟล์ก่อนหน้า (นิสิตอัปโหลดไฟล์ใหม่หลังจากนั้น) */
export function isCommentForOlderFile(commentCvUploadedAt: Date | string | null | undefined, currentUploadedAt: Date | string | null | undefined): boolean {
  const a = time(commentCvUploadedAt);
  const b = time(currentUploadedAt);
  return a !== null && b !== null && a < b;
}

/** จำนวนคอมเมนต์ที่นิสิตยังไม่ได้เปิดอ่าน */
export function unseenCommentCount(comments: { createdAt: Date | string }[], seenAt: Date | string | null | undefined): number {
  const seen = time(seenAt);
  return comments.filter((c) => seen === null || (time(c.createdAt) ?? 0) > seen).length;
}

export const CV_COMMENT_MAX = 2000;

/** ข้อความคอมเมนต์: ห้ามว่าง / ไม่เกิน 2,000 ตัวอักษร */
export function cvCommentError(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return "กรุณาพิมพ์คอมเมนต์";
  if (text.length > CV_COMMENT_MAX) return `คอมเมนต์ยาวเกิน ${CV_COMMENT_MAX.toLocaleString()} ตัวอักษร`;
  return null;
}

export type CvCommentRole = "ADVISOR" | "COURSE_ADMIN";

export const CV_COMMENT_ROLE_LABEL: Record<CvCommentRole, string> = {
  ADVISOR: "อาจารย์ที่ปรึกษา",
  COURSE_ADMIN: "อาจารย์ประจำวิชา",
};

/**
 * สิทธิ์คอมเมนต์ CV ของนิสิตคนหนึ่ง -> บทบาทที่ใช้บันทึก หรือ null (ไม่มีสิทธิ์)
 * อาจารย์ที่ปรึกษาของนิสิตคนนี้ก่อน (ถ้าเป็นทั้งสองบทบาท) · เจ้าหน้าที่อย่างเดียว = ดูได้ แต่คอมเมนต์ไม่ได้
 */
export function cvCommentRole(opts: { isAdvisorOfStudent: boolean; isCourseAdmin: boolean }): CvCommentRole | null {
  if (opts.isAdvisorOfStudent) return "ADVISOR";
  if (opts.isCourseAdmin) return "COURSE_ADMIN";
  return null;
}
