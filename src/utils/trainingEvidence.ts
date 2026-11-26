// =====================================================================
// หลักฐานใบรับรองของชั่วโมงอบรมที่นิสิตอัปโหลดเอง (T-03)
// - source = STUDENT_UPLOAD: บังคับ "หน่วยงานผู้จัด" + "ลิงก์ประชาสัมพันธ์/ลงทะเบียน" (http/https)
// - รายการที่เจ้าหน้าที่/อาจารย์นำเข้า หรือ Check-in ไม่บังคับ · รายการเก่าแสดง "-" ได้ (ไม่บังคับย้อนหลัง)
// - นิสิตแก้รายการของตัวเองได้เมื่อยังไม่ผ่านการตรวจ (รอตรวจ / ไม่ผ่าน) และต้องกรอกให้ครบก่อนบันทึก
// ไฟล์นี้ไม่แตะฐานข้อมูล (ทดสอบได้ใน tests/trainingEvidence.test.ts)
// =====================================================================

export const ORGANIZER_MAX = 200;
export const EVIDENCE_LINK_MAX = 1000;

/** รายการที่นิสิตอัปโหลดเอง (ข้อมูลเก่าที่ไม่มี source ถือเป็นของนิสิต) */
export function isStudentUploadSource(source: string | null | undefined): boolean {
  return !source || source === "STUDENT_UPLOAD";
}

/** ลิงก์ http/https เท่านั้น -> คืน URL ที่ normalize แล้ว หรือ null */
export function normalizeHttpLink(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s || s.length > EVIDENCE_LINK_MAX) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * ตรวจหลักฐานของรายการที่นิสิตอัปโหลดเอง -> ข้อความผิดพลาด หรือ null
 * (ใช้ทั้งตอนเพิ่มและตอนแก้ไข — แก้รายการเก่าต้องกรอกให้ครบ)
 */
export function trainingEvidenceError(organizerRaw: unknown, linkRaw: unknown): string | null {
  const organizer = String(organizerRaw ?? "").replace(/\s+/g, " ").trim();
  if (!organizer) return "กรุณากรอกหน่วยงานผู้จัด";
  if (organizer.length > ORGANIZER_MAX) return `หน่วยงานผู้จัดยาวเกิน ${ORGANIZER_MAX} ตัวอักษร`;
  const link = String(linkRaw ?? "").trim();
  if (!link) return "กรุณากรอกลิงก์ประชาสัมพันธ์ / ลงทะเบียน";
  if (!normalizeHttpLink(link)) return "ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://";
  return null;
}

export function cleanOrganizer(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

/** นิสิตแก้รายการนี้ได้ไหม: เป็นรายการที่อัปโหลดเอง และยังไม่ผ่านการตรวจ */
export function studentCanEditTraining(t: { source?: string | null; status: string }): boolean {
  return isStudentUploadSource(t.source) && t.status !== "APPROVED";
}
