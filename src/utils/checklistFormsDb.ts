// แบบฟอร์มการเลือกสถานประกอบการของนิสิต (อ่านจากฐานข้อมูล) — กติกาอยู่ใน checklistForms.ts
import prisma from "../db";
import { resolveChecklistForm, studentMajorCode } from "./checklistForms";

/** id แบบฟอร์มที่นิสิตสาขานี้ต้องใช้ตอนยื่นใหม่ (ไม่มีแบบฟอร์มที่เปิดใช้เลย -> แบบฟอร์มแรกของระบบ เหมือนพฤติกรรมเดิม) */
export async function getChecklistFormIdForMajor(majorRaw?: string | null): Promise<number | null> {
  const forms = await prisma.checklistVersion.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, status: true, majorCodes: true },
    orderBy: { id: "asc" },
  });
  const form = resolveChecklistForm(forms, studentMajorCode(majorRaw));
  if (form) return form.id;
  const first = await prisma.checklistVersion.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
  return first?.id ?? null;
}
