import { NextFunction, Request, Response } from "express";

// =====================================================================
// ตัวตรวจ "เฉพาะเจ้าหน้าที่ฝ่ายฝึกงาน (Staff / พี่จอม)" — ใช้ร่วมกันทุก route ที่ Role Matrix ให้เป็นงานของเจ้าหน้าที่คนเดียว
// ผ่านเมื่อ: role ของบัญชี = STAFF หรือ ข้อมูลบุคลากรถูกติ๊กเป็นเจ้าหน้าที่ (staff.isStaff)
// อาจารย์ประจำวิชา (ADMIN / isCourseAdmin) · อาจารย์ที่ปรึกษา · นิสิต -> 403
// ใช้หลัง requireAdmin (ซึ่งเติม req.staff ให้แล้ว)
// =====================================================================

type StaffLike = { isStaff?: boolean | null } | null | undefined;

/** บัญชีนี้เป็นเจ้าหน้าที่ฝ่ายฝึกงานหรือไม่ (แยกเป็นฟังก์ชันเพื่อทดสอบได้) */
export function isStaffUser(role: string | null | undefined, staff: StaffLike): boolean {
  return Boolean(staff?.isStaff || role === "STAFF");
}

export function isStaffRequest(req: Request): boolean {
  return isStaffUser(req.session?.user?.role as string | undefined, (req as any).staff);
}

/** middleware: เฉพาะเจ้าหน้าที่ · message = ข้อความ 403 ของงานนั้น ๆ */
export function requireStaffOnly(message = "เฉพาะเจ้าหน้าที่ฝ่ายฝึกงาน (Staff) เท่านั้นที่ทำรายการนี้ได้") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isStaffRequest(req)) {
      return res.status(403).json({ success: false, message });
    }
    next();
  };
}
