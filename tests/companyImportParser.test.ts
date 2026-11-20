import { test } from "node:test";
import assert from "node:assert/strict";
import * as xlsx from "xlsx";
import {
  buildCompanyImportTemplate,
  classifyCompanyImport,
  detectCompanyField,
  parseCompanySpreadsheet,
} from "../src/utils/companyImportParser";

function sheetBuffer(rows: unknown[][]): Buffer {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rows), "Sheet1");
  return xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
}

test("detectCompanyField แยกหัวคอลัมน์ที่คล้ายกันได้ถูกต้อง", () => {
  assert.equal(detectCompanyField("ชื่อบริษัท"), "nameTh");
  assert.equal(detectCompanyField("ชื่อภาษาอังกฤษ"), "nameEn");
  assert.equal(detectCompanyField("ชื่อผู้ติดต่อ"), "hrContactName");
  assert.equal(detectCompanyField("เบอร์โทร HR"), "hrPhone");
  assert.equal(detectCompanyField("อีเมลผู้ติดต่อ"), "hrEmail");
  assert.equal(detectCompanyField("ตำแหน่งที่รับ"), "recommendedPositions");
  assert.equal(detectCompanyField("ตำแหน่งผู้ติดต่อ"), null);
  assert.equal(detectCompanyField("ลำดับ"), null);
  assert.equal(detectCompanyField("Tel."), "hrPhone");
  assert.equal(detectCompanyField("ชื่อโรงแรม (Hotel)"), "nameTh");
});

test("parseCompanySpreadsheet อ่าน CSV UTF-8 ภาษาไทยได้ทั้งมีและไม่มี BOM", () => {
  const csv = Buffer.from("ชื่อบริษัท,จังหวัด\nบริษัท ก จำกัด,พะเยา\n", "utf8");
  const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), csv]);
  for (const buf of [csv, withBom]) {
    const rows = parseCompanySpreadsheet(buf);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].nameTh, "บริษัท ก จำกัด");
    assert.equal(rows[0].province, "พะเยา");
  }
});

test("parseCompanySpreadsheet อ่านแถวและข้ามแถวที่ไม่มีชื่อบริษัท", () => {
  const rows = parseCompanySpreadsheet(
    sheetBuffer([
      ["ลำดับ", "ชื่อบริษัท", "จังหวัด", "เบอร์โทร"],
      [1, "  บริษัท เอ  จำกัด ", "พะเยา", "054-000000"],
      [2, "", "เชียงราย", ""],
      [3, "บริษัท บี จำกัด", "", ""],
    ])
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(
    { rowNumber: rows[0].rowNumber, nameTh: rows[0].nameTh, province: rows[0].province, hrPhone: rows[0].hrPhone },
    { rowNumber: 2, nameTh: "บริษัท เอ จำกัด", province: "พะเยา", hrPhone: "054-000000" }
  );
  assert.equal(rows[1].rowNumber, 4);
});

test("parseCompanySpreadsheet เติมเลข 0 คืนให้เบอร์ที่ Excel เก็บเป็นตัวเลข", () => {
  const rows = parseCompanySpreadsheet(
    sheetBuffer([
      ["ชื่อบริษัท", "เบอร์โทร"],
      ["บริษัท เอ", 812345678],
      ["บริษัท บี", 54466666],
      ["บริษัท ซี", 1234],
      ["บริษัท ดี", "02-123-4567"],
    ])
  );
  assert.deepEqual(rows.map((r) => r.hrPhone), ["0812345678", "054466666", "1234", "02-123-4567"]);
});

test("ไฟล์ตัวอย่างอ่านกลับด้วย parser ได้ครบทุกคอลัมน์", () => {
  const rows = parseCompanySpreadsheet(buildCompanyImportTemplate());
  assert.equal(rows.length, 3);
  assert.equal(rows[0].nameEn, "Example Software Co., Ltd.");
  assert.equal(rows[0].hrContactName, "คุณสมชาย ใจดี");
  assert.equal(rows[0].hrPhone, "02-123-4567");
  assert.equal(rows[0].hrEmail, "hr@example-software.co.th");
  assert.equal(rows[0].recommendedPositions, "Software Developer / Tester");
  assert.ok(rows[0].address.startsWith("99 ถนนพหลโยธิน"));
});

test("parseCompanySpreadsheet แจ้งเมื่อไม่มีคอลัมน์ชื่อบริษัท", () => {
  assert.throws(() => parseCompanySpreadsheet(sheetBuffer([["จังหวัด"], ["พะเยา"]])), /ไม่พบคอลัมน์ชื่อสถานประกอบการ/);
});

test("classifyCompanyImport แยกรายการใหม่ / มีแล้ว / ซ้ำในไฟล์", () => {
  const base = { nameEn: "", province: "", address: "", hrContactName: "", hrPhone: "", hrEmail: "", recommendedPositions: "" };
  const items = classifyCompanyImport(
    [
      { ...base, rowNumber: 2, nameTh: "บริษัท เอ จำกัด" },
      { ...base, rowNumber: 3, nameTh: "บริษัทเอจำกัด" },
      { ...base, rowNumber: 4, nameTh: "บริษัท บี จำกัด" },
      { ...base, rowNumber: 5, nameTh: "ABC Co., Ltd." },
    ],
    [{ nameTh: "บริษัท บี จำกัด" }, { nameTh: "บริษัท เอบีซี", nameEn: "abc co., ltd." }]
  );
  assert.deepEqual(items.map((it) => it.status), ["READY", "DUPLICATE_IN_FILE", "EXISTING", "EXISTING"]);
  assert.equal(items[3].existingName, "บริษัท เอบีซี");
});
