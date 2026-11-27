// =====================================================================
// แบบฟอร์มการเลือกสถานประกอบการแยกตามสาขา (ChecklistVersion + majorCodes)
// - แบบฟอร์มเลือกได้ว่าใช้กับสาขาไหน (หลายสาขาใช้ชุดเดียวกันได้)
// - majorCodes ว่าง = "แบบฟอร์มกลาง" ใช้กับสาขาที่ยังไม่มีแบบฟอร์มเฉพาะ (เปิดใช้ได้ทีละ 1 ชุด)
// - 1 สาขาใช้แบบฟอร์มที่เปิดใช้งานได้ทีละ 1 ชุด: เปิดใช้แบบฟอร์มใหม่ให้สาขาไหน ระบบย้ายสาขานั้นออกจากแบบฟอร์มเดิม
//   (แบบฟอร์มเดิมที่ไม่เหลือสาขา -> เลิกใช้ ARCHIVED)
// ไฟล์นี้ไม่แตะฐานข้อมูล (ทดสอบได้ใน tests/checklistForms.test.ts)
// =====================================================================
import { ICT_MAJORS, findMajor } from "./majors";

export interface ChecklistFormLike {
  id: number;
  status: string; // DRAFT | ACTIVE | ARCHIVED
  majorCodes: string[];
  versionName?: string;
}

const MAJOR_ORDER = ICT_MAJORS.map((m) => m.code);

/** รหัสสาขาจากค่าในข้อมูลนิสิต (ชื่อไทย/อังกฤษ/รหัส) — จับคู่ไม่ได้ = null (ใช้แบบฟอร์มกลาง) */
export function studentMajorCode(raw?: string | null): string | null {
  return findMajor(raw)?.code ?? null;
}

/** ตรวจรายการสาขาที่ส่งมา: ต้องเป็นรหัสใน src/utils/majors.ts · ตัดซ้ำ · เรียงตามลำดับสาขาของระบบ */
export function normalizeFormMajorCodes(raw: unknown): { codes: string[]; error?: string } {
  if (raw === undefined || raw === null || raw === "") return { codes: [] };
  if (!Array.isArray(raw)) return { codes: [], error: "รูปแบบสาขาไม่ถูกต้อง" };
  const codes = Array.from(new Set(raw.map((v) => String(v || "").trim().toUpperCase()).filter(Boolean)));
  const bad = codes.filter((c) => !MAJOR_ORDER.includes(c));
  if (bad.length) return { codes: [], error: `ไม่รู้จักสาขา: ${bad.join(", ")}` };
  return { codes: codes.sort((a, b) => MAJOR_ORDER.indexOf(a) - MAJOR_ORDER.indexOf(b)) };
}

export const isDefaultForm = (f: { majorCodes: string[] }) => !f.majorCodes || f.majorCodes.length === 0;

/** แบบฟอร์มที่นิสิตสาขานี้ใช้: แบบฟอร์มเฉพาะสาขาที่เปิดใช้ -> ไม่มีก็แบบฟอร์มกลางที่เปิดใช้ -> ไม่มีเลย = null */
export function resolveChecklistForm<T extends ChecklistFormLike>(forms: T[], majorCode: string | null): T | null {
  const active = forms.filter((f) => f.status === "ACTIVE");
  const specific = majorCode ? active.find((f) => f.majorCodes.includes(majorCode)) : undefined;
  return specific || active.find(isDefaultForm) || null;
}

export interface ActivationPlan {
  /** แบบฟอร์มที่ต้องเปลี่ยนเป็นเลิกใช้ (ไม่เหลือสาขา / แบบฟอร์มกลางชุดเก่า) */
  archive: number[];
  /** แบบฟอร์มที่ยังใช้ต่อแต่ต้องเอาบางสาขาออก */
  updateMajors: { id: number; majorCodes: string[] }[];
  /** สรุปสาขาที่ถูกย้ายมาจากแบบฟอร์มอื่น (ใช้ทำข้อความแจ้ง) */
  moved: { fromId: number; codes: string[] }[];
}

/**
 * เปิดใช้งานแบบฟอร์ม (หรือเปลี่ยนสาขาของแบบฟอร์มที่เปิดใช้อยู่) ด้วยรายการสาขา targetMajors
 * - เป้าหมายเป็นแบบฟอร์มกลาง -> แบบฟอร์มกลางชุดอื่นที่เปิดใช้อยู่ = เลิกใช้
 * - เป้าหมายเป็นแบบฟอร์มเฉพาะสาขา -> เอาสาขาที่ซ้ำออกจากแบบฟอร์มอื่นที่เปิดใช้อยู่ (ไม่เหลือสาขา = เลิกใช้)
 */
export function planChecklistActivation(forms: ChecklistFormLike[], targetId: number, targetMajors: string[]): ActivationPlan {
  const plan: ActivationPlan = { archive: [], updateMajors: [], moved: [] };
  for (const f of forms) {
    if (f.id === targetId || f.status !== "ACTIVE") continue;
    if (targetMajors.length === 0) {
      if (isDefaultForm(f)) plan.archive.push(f.id);
      continue;
    }
    if (isDefaultForm(f)) continue;
    const overlap = f.majorCodes.filter((c) => targetMajors.includes(c));
    if (!overlap.length) continue;
    const remaining = f.majorCodes.filter((c) => !targetMajors.includes(c));
    plan.moved.push({ fromId: f.id, codes: overlap });
    if (remaining.length) plan.updateMajors.push({ id: f.id, majorCodes: remaining });
    else plan.archive.push(f.id);
  }
  return plan;
}

/**
 * เปลี่ยนสาขาของแบบฟอร์มที่เปิดใช้อยู่: ประเภท (กลาง / เฉพาะสาขา) ต้องคงเดิม
 * กันกรณีแบบฟอร์มกลางหายไป (สาขาที่ไม่มีแบบฟอร์มเฉพาะจะยื่นไม่ได้) หรือแบบฟอร์มเฉพาะกลายเป็นแบบฟอร์มกลางโดยไม่ตั้งใจ
 */
export function activeFormMajorsChangeError(current: ChecklistFormLike, nextMajors: string[]): string | null {
  if (current.status !== "ACTIVE") return null;
  if (isDefaultForm(current) && nextMajors.length) {
    return "แบบฟอร์มกลางที่เปิดใช้อยู่เลือกสาขาไม่ได้ — ให้คัดลอกเป็นแบบฟอร์มใหม่แล้วเลือกสาขา (ต้องมีแบบฟอร์มกลางไว้สำหรับสาขาที่ยังไม่มีแบบฟอร์มเฉพาะ)";
  }
  if (!isDefaultForm(current) && !nextMajors.length) {
    return "แบบฟอร์มเฉพาะสาขาที่เปิดใช้อยู่ต้องเลือกอย่างน้อย 1 สาขา (ถ้าจะใช้เป็นแบบฟอร์มกลาง ให้คัดลอกเป็นแบบฟอร์มใหม่)";
  }
  return null;
}

export interface MajorCoverageRow {
  code: string;
  name: string;
  formId: number | null;
  formName: string;
  isDefault: boolean; // ใช้แบบฟอร์มกลาง (สาขานี้ยังไม่มีแบบฟอร์มเฉพาะ)
}

/** ตาราง 8 สาขา -> แบบฟอร์มที่ใช้อยู่ (สำหรับหน้าเจ้าหน้าที่) */
export function checklistCoverage(forms: ChecklistFormLike[]): MajorCoverageRow[] {
  return ICT_MAJORS.map((m) => {
    const f = resolveChecklistForm(forms, m.code);
    return {
      code: m.code,
      name: m.name,
      formId: f ? f.id : null,
      formName: f ? f.versionName || `แบบฟอร์ม #${f.id}` : "",
      isDefault: Boolean(f && isDefaultForm(f)),
    };
  });
}

/** ข้อความแสดงสาขาของแบบฟอร์ม */
export function formMajorsLabel(f: { majorCodes: string[] }): string {
  return isDefaultForm(f) ? "แบบฟอร์มกลาง (สาขาที่ไม่มีแบบฟอร์มเฉพาะ)" : f.majorCodes.join(", ");
}
