import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  activeFormMajorsChangeError,
  checklistCoverage,
  normalizeFormMajorCodes,
  planChecklistActivation,
  resolveChecklistForm,
  studentMajorCode,
} from "../src/utils/checklistForms";

const form = (id: number, status: string, majorCodes: string[], versionName = `F${id}`) => ({ id, status, majorCodes, versionName });

describe("เลือกแบบฟอร์มตามสาขาของนิสิต", () => {
  const forms = [
    form(1, "ACTIVE", [], "กลาง"),
    form(2, "ACTIVE", ["SE", "CPE"], "สายซอฟต์แวร์"),
    form(3, "DRAFT", ["IT"], "ร่าง IT"),
    form(4, "ARCHIVED", ["DB"], "เก่า DB"),
  ];

  test("สาขาที่มีแบบฟอร์มเฉพาะ -> ใช้แบบฟอร์มนั้น", () => {
    assert.equal(resolveChecklistForm(forms, "SE")?.id, 2);
    assert.equal(resolveChecklistForm(forms, "CPE")?.id, 2);
  });

  test("ไม่มีแบบฟอร์มเฉพาะที่เปิดใช้ (ร่าง/เลิกใช้ไม่นับ) -> แบบฟอร์มกลาง", () => {
    assert.equal(resolveChecklistForm(forms, "IT")?.id, 1);
    assert.equal(resolveChecklistForm(forms, "DB")?.id, 1);
    assert.equal(resolveChecklistForm(forms, null)?.id, 1);
  });

  test("ไม่มีแบบฟอร์มที่เปิดใช้เลย -> null", () => {
    assert.equal(resolveChecklistForm([form(1, "DRAFT", [])], "SE"), null);
  });

  test("รหัสสาขาจากข้อมูลนิสิต (ชื่อไทย / มีเลขนำหน้า / รหัส)", () => {
    assert.equal(studentMajorCode("วิศวกรรมซอฟต์แวร์"), "SE");
    assert.equal(studentMajorCode("221 สาขาวิชาเทคโนโลยีสารสนเทศ"), "IT");
    assert.equal(studentMajorCode("cs"), "CS");
    assert.equal(studentMajorCode(""), null);
    assert.equal(studentMajorCode("สาขาที่ไม่มีจริง"), null);
  });

  test("ตาราง 8 สาขา: บอกแบบฟอร์มและว่าเป็นแบบฟอร์มกลางหรือไม่", () => {
    const rows = checklistCoverage(forms);
    assert.equal(rows.length, 8);
    const se = rows.find((r) => r.code === "SE")!;
    assert.deepEqual([se.formId, se.isDefault, se.formName], [2, false, "สายซอฟต์แวร์"]);
    const it = rows.find((r) => r.code === "IT")!;
    assert.deepEqual([it.formId, it.isDefault], [1, true]);
  });
});

describe("ตรวจรายการสาขาของแบบฟอร์ม", () => {
  test("ตัดซ้ำ + ตัวพิมพ์ใหญ่ + เรียงตามลำดับสาขาของระบบ", () => {
    assert.deepEqual(normalizeFormMajorCodes(["se", "DB", "SE"]).codes, ["DB", "SE"]);
  });
  test("ว่าง = แบบฟอร์มกลาง", () => {
    assert.deepEqual(normalizeFormMajorCodes([]).codes, []);
    assert.deepEqual(normalizeFormMajorCodes(undefined).codes, []);
  });
  test("รหัสที่ไม่รู้จัก / รูปแบบผิด = error", () => {
    assert.ok(normalizeFormMajorCodes(["SE", "XYZ"]).error?.includes("XYZ"));
    assert.ok(normalizeFormMajorCodes("SE").error);
  });
});

describe("เปิดใช้งานแบบฟอร์ม", () => {
  test("แบบฟอร์มเฉพาะสาขา: ย้ายสาขาที่ซ้ำออกจากแบบฟอร์มอื่น / ไม่เหลือสาขา = เลิกใช้ / แบบฟอร์มกลางไม่ถูกแตะ", () => {
    const forms = [form(1, "ACTIVE", []), form(2, "ACTIVE", ["SE", "CPE"]), form(3, "ACTIVE", ["IT"]), form(9, "DRAFT", ["SE", "IT"])];
    const plan = planChecklistActivation(forms, 9, ["SE", "IT"]);
    assert.deepEqual(plan.updateMajors, [{ id: 2, majorCodes: ["CPE"] }]);
    assert.deepEqual(plan.archive, [3]);
    assert.deepEqual(plan.moved, [{ fromId: 2, codes: ["SE"] }, { fromId: 3, codes: ["IT"] }]);
  });

  test("แบบฟอร์มกลางชุดใหม่: แบบฟอร์มกลางชุดเดิม = เลิกใช้ / แบบฟอร์มเฉพาะสาขาไม่ถูกแตะ", () => {
    const forms = [form(1, "ACTIVE", []), form(2, "ACTIVE", ["SE"]), form(5, "DRAFT", [])];
    const plan = planChecklistActivation(forms, 5, []);
    assert.deepEqual(plan.archive, [1]);
    assert.deepEqual(plan.updateMajors, []);
  });

  test("แบบฟอร์มที่ไม่ได้เปิดใช้ ไม่ถูกแตะ", () => {
    const plan = planChecklistActivation([form(2, "ARCHIVED", ["SE"]), form(3, "DRAFT", ["SE"])], 9, ["SE"]);
    assert.deepEqual([plan.archive, plan.updateMajors], [[], []]);
  });

  test("เปลี่ยนสาขาของแบบฟอร์มที่เปิดใช้อยู่: ประเภท กลาง/เฉพาะสาขา ต้องคงเดิม", () => {
    assert.ok(activeFormMajorsChangeError(form(1, "ACTIVE", []), ["SE"]));
    assert.ok(activeFormMajorsChangeError(form(2, "ACTIVE", ["SE"]), []));
    assert.equal(activeFormMajorsChangeError(form(2, "ACTIVE", ["SE"]), ["SE", "CS"]), null);
    assert.equal(activeFormMajorsChangeError(form(3, "DRAFT", []), ["SE"]), null);
  });
});
