import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  COOP_IMPORT_COLUMNS,
  COOP_MIN_GPAX,
  buildCoopImportPlan,
  buildCoopImportTemplate,
  coopPostingStatus,
  detectCoopField,
  parseCoopPostingSheet,
  parseSeats,
  validateCoopPostingInput,
} from "../src/utils/coopPostings";
import { THAI_PROVINCES, normalizeProvince } from "../src/utils/thaiProvinces";

describe("ประกาศสหกิจ: สถานะและเกณฑ์", () => {
  test("ปิดรับได้ด้วยปุ่มของเจ้าหน้าที่เท่านั้น (รอบ/วันปิดยื่นตามรอบออกฝึก)", () => {
    assert.equal(coopPostingStatus({ isClosed: true }), "CLOSED");
    assert.equal(coopPostingStatus({ isClosed: false }), "OPEN");
  });

  test("GPAX ขั้นต่ำของสหกิจคงที่ 2.00", () => {
    assert.equal(COOP_MIN_GPAX, 2);
  });
});

describe("จังหวัด", () => {
  test("มีครบ 77 จังหวัด ไม่ซ้ำ", () => {
    assert.equal(THAI_PROVINCES.length, 77);
    assert.equal(new Set(THAI_PROVINCES).size, 77);
  });

  test("normalizeProvince ตัดคำนำหน้า รองรับชื่อย่อ และแยกค่าที่ไม่รู้จัก", () => {
    assert.equal(normalizeProvince("เชียงใหม่"), "เชียงใหม่");
    assert.equal(normalizeProvince("จ.เชียงใหม่"), "เชียงใหม่");
    assert.equal(normalizeProvince("จังหวัด พะเยา"), "พะเยา");
    assert.equal(normalizeProvince("กทม"), "กรุงเทพมหานคร");
    assert.equal(normalizeProvince("Bangkok"), "กรุงเทพมหานคร");
    assert.equal(normalizeProvince("ต่างประเทศ"), "ต่างประเทศ");
    assert.equal(normalizeProvince(""), "");
    assert.equal(normalizeProvince("เชียงใหม"), null);
  });
});

describe("แปลงค่าจากฟอร์ม/Excel", () => {
  test("parseSeats", () => {
    assert.equal(parseSeats("3 คน"), 3);
    assert.equal(parseSeats(""), null);
    assert.equal(parseSeats("0"), "INVALID");
  });

  test("หัวคอลัมน์ทุกช่องของไฟล์ตัวอย่างจับคู่ฟิลด์ได้ถูกต้อง", () => {
    for (const col of COOP_IMPORT_COLUMNS) assert.equal(detectCoopField(col.header), col.field, col.header);
  });

  test("คอลัมน์ที่เลิกใช้ (รอบเทอม / วันปิดรับ / สาขา / GPAX / วันเริ่ม–สิ้นสุด) ไม่ถูกนำเข้า", () => {
    for (const h of ["รอบเทอมที่ออกฝึก", "วันปิดรับสมัคร", "สาขาที่รับ", "GPAX ขั้นต่ำ", "วันเริ่มฝึก", "วันสิ้นสุดการฝึก"]) {
      assert.equal(detectCoopField(h), null, h);
    }
  });
});

describe("validateCoopPostingInput", () => {
  const base = {
    companyName: " บริษัท ก จำกัด ",
    province: "จ.เชียงใหม่",
    website: "example.com",
    positions: [{ title: "Full-Stack Developer", seats: "3", description: "เขียนโปรแกรม" }, { title: "", seats: "", description: "" }],
  };

  test("ข้อมูลถูกต้อง: ตัดช่องว่าง จังหวัดมาตรฐาน ข้ามแถวตำแหน่งว่าง เติม https:// ให้เว็บไซต์", () => {
    const { data, error } = validateCoopPostingInput(base);
    assert.equal(error, undefined);
    assert.equal(data!.companyName, "บริษัท ก จำกัด");
    assert.equal(data!.province, "เชียงใหม่");
    assert.equal(data!.website, "https://example.com");
    assert.deepEqual(data!.positions, [{ title: "Full-Stack Developer", seats: 3, description: "เขียนโปรแกรม" }]);
  });

  test("แจ้งข้อผิดพลาดที่พบบ่อย", () => {
    assert.match(validateCoopPostingInput({ ...base, companyName: "" }).error!, /ชื่อบริษัท/);
    assert.match(validateCoopPostingInput({ ...base, province: "เชียงใหม" }).error!, /ไม่รู้จักจังหวัด/);
    assert.match(validateCoopPostingInput({ ...base, positions: [] }).error!, /อย่างน้อย 1/);
    assert.match(validateCoopPostingInput({ ...base, positions: [{ title: "Dev" }, { title: " dev " }] }).error!, /ซ้ำ/);
    assert.match(validateCoopPostingInput({ ...base, positions: [{ title: "Dev", seats: "0" }] }).error!, /จำนวนที่รับ/);
  });
});

describe("นำเข้า Excel", () => {
  test("ไฟล์ตัวอย่างอ่านกลับได้ครบ: 2 ประกาศ 3 ตำแหน่ง ไม่มีข้อผิดพลาด", () => {
    const rows = parseCoopPostingSheet(buildCoopImportTemplate());
    assert.equal(rows.length, 3);
    const plan = buildCoopImportPlan(rows, []);
    assert.deepEqual(plan.errors, []);
    assert.equal(plan.groups.length, 2);
    const first = plan.groups[0];
    assert.equal(first.action, "CREATE");
    assert.deepEqual(first.positions.map((p) => p.title), ["Full-Stack Developer", "QA / Software Tester"]);
    assert.equal(first.data.province, "กรุงเทพมหานคร");
    assert.equal(first.data.hrPhone, "02-123-4567");
  });

  test("บริษัทเดิม = UPDATE, ตำแหน่งชื่อเดิม = UPDATE, แถวผิดถูกข้าม", () => {
    const rows = [
      { rowNumber: 2, cells: { companyName: "บริษัท  ก จำกัด", positionTitle: "developer", seats: 2 } },
      { rowNumber: 3, cells: { companyName: "บริษัท ก จำกัด", positionTitle: "Designer", province: "กทม" } },
      { rowNumber: 4, cells: { companyName: "บริษัท ค", positionTitle: "" } },
      { rowNumber: 5, cells: { companyName: "บริษัท ก จำกัด", positionTitle: "Designer" } },
      { rowNumber: 6, cells: { companyName: "บริษัท จ", positionTitle: "Dev", province: "ดาวอังคาร" } },
      { rowNumber: 7, cells: { companyName: "บริษัท ฉ", positionTitle: "Dev", seats: "หลายคน" } },
    ];
    const existing = [{ id: 7, companyName: "บริษัท ก จำกัด", positions: [{ id: 70, title: "Developer" }] }];
    const plan = buildCoopImportPlan(rows, existing);
    assert.equal(plan.groups.length, 1);
    assert.equal(plan.groups[0].action, "UPDATE");
    assert.equal(plan.groups[0].existingId, 7);
    assert.equal(plan.groups[0].data.province, "กรุงเทพมหานคร");
    assert.deepEqual(plan.groups[0].positions.map((p) => [p.title, p.action, p.existingPositionId]), [
      ["developer", "UPDATE", 70],
      ["Designer", "CREATE", undefined],
    ]);
    assert.deepEqual(plan.errors.map((e) => e.rowNumber), [4, 5, 6, 7]);
  });
});
