import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  canChangeCoopStatus,
  canStudentCancelCoop,
  coopDocStepUpdate,
  coopDocStepsView,
  coopFileError,
  isActiveCoopApplication,
  isCoopDocStep,
  normalizePortfolioLink,
} from "../src/utils/coopPostings";
import { detectFileKind, mergeCoopDocuments, pdfSafeText } from "../src/utils/coopPdf";

// PNG 1x1 พิกเซล
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

async function pdfWithPages(n: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) doc.addPage([300, 400]);
  return Buffer.from(await doc.save());
}

describe("สถานะใบสมัครสหกิจ", () => {
  test("ไม่ผ่าน = จบแล้ว (เข้าประวัติ) / สถานะอื่นยังนับเป็นใบที่ยังไม่จบ", () => {
    assert.equal(isActiveCoopApplication("REJECTED"), false);
    for (const s of ["SUBMITTED", "SENT_TO_COMPANY", "ACCEPTED"]) assert.equal(isActiveCoopApplication(s), true);
  });

  test("เปลี่ยนสถานะได้ตามลำดับ (ย้อนได้ 1 ขั้น) และใบที่ไม่ผ่านเปลี่ยนต่อไม่ได้", () => {
    assert.equal(canChangeCoopStatus("SUBMITTED", "SENT_TO_COMPANY"), true);
    assert.equal(canChangeCoopStatus("SENT_TO_COMPANY", "ACCEPTED"), true);
    assert.equal(canChangeCoopStatus("SENT_TO_COMPANY", "SUBMITTED"), true);
    assert.equal(canChangeCoopStatus("ACCEPTED", "SUBMITTED"), false);
    assert.equal(canChangeCoopStatus("REJECTED", "SUBMITTED"), false);
    assert.equal(canChangeCoopStatus("SUBMITTED", "SUBMITTED"), false);
  });

  test("ยกเลิก = จบแล้ว (เข้าประวัติ) เปลี่ยนต่อไม่ได้", () => {
    assert.equal(isActiveCoopApplication("CANCELLED"), false);
    assert.equal(canChangeCoopStatus("CANCELLED", "SUBMITTED"), false);
    assert.equal(canChangeCoopStatus("REJECTED", "CANCELLED"), false);
  });

  test("นิสิตยกเลิกเองได้เฉพาะตอนส่งใบสมัคร (เจ้าหน้าที่ยังไม่ส่งเอกสารให้บริษัท)", () => {
    assert.equal(canStudentCancelCoop("SUBMITTED"), true);
    for (const s of ["SENT_TO_COMPANY", "ACCEPTED", "REJECTED", "CANCELLED"]) assert.equal(canStudentCancelCoop(s), false);
  });

  test("เจ้าหน้าที่ยกเลิกให้ได้ทุกสถานะที่ยังไม่จบ รวมหลังผ่านและเริ่มขั้นเอกสารแล้ว", () => {
    for (const s of ["SUBMITTED", "SENT_TO_COMPANY", "ACCEPTED"] as const) assert.equal(canChangeCoopStatus(s, "CANCELLED"), true);
    assert.equal(canChangeCoopStatus("ACCEPTED", "CANCELLED", "DISPATCH_LETTER"), true);
  });

  test("ผ่านแล้วและเริ่มขั้นเอกสาร -> ย้อนสถานะ/ไม่ผ่านไม่ได้ (ต้องย้อนขั้นเอกสารก่อน)", () => {
    assert.equal(canChangeCoopStatus("ACCEPTED", "SENT_TO_COMPANY", "NONE"), true);
    assert.equal(canChangeCoopStatus("ACCEPTED", "SENT_TO_COMPANY", "REQUEST_LETTER"), false);
    assert.equal(canChangeCoopStatus("ACCEPTED", "REJECTED", "ACCEPTANCE_FORM"), false);
  });
});

describe("ขั้นเอกสารหลังผ่านการคัดเลือก", () => {
  const now = new Date("2026-12-01T03:00:00Z");
  const earlier = new Date("2026-11-20T03:00:00Z");

  test("ตรวจค่าขั้นเอกสาร", () => {
    assert.equal(isCoopDocStep("DISPATCH_LETTER"), true);
    assert.equal(isCoopDocStep("SENT"), false);
    assert.equal(isCoopDocStep(undefined), false);
  });

  test("ข้ามขั้นได้: ขั้นที่ถึงแล้วได้วันที่ตอนนี้ / ขั้นที่มีวันที่อยู่แล้วคงเดิม", () => {
    const d = coopDocStepUpdate({ requestLetterAt: earlier }, "ACCEPTANCE_FORM", now);
    assert.equal(d.docStep, "ACCEPTANCE_FORM");
    assert.equal("requestLetterAt" in d, false); // ไม่ทับวันที่เดิม
    assert.equal(d.acceptanceFormAt, now);
    assert.equal(d.dispatchLetterAt, null);
  });

  test("แนบไฟล์ไปที่ขั้นที่ตั้ง", () => {
    const d = coopDocStepUpdate({}, "REQUEST_LETTER", now, { url: "https://x/req.pdf", name: "req.pdf" });
    assert.equal(d.requestLetterUrl, "https://x/req.pdf");
    assert.equal(d.requestLetterName, "req.pdf");
    assert.equal(d.requestLetterAt, now);
  });

  test("ย้อนขั้น: ล้างวันที่และไฟล์ของขั้นที่เลยมา", () => {
    const cur = {
      requestLetterAt: earlier, requestLetterUrl: "u1", requestLetterName: "n1",
      acceptanceFormAt: earlier, acceptanceFormUrl: "u2", acceptanceFormName: "n2",
      dispatchLetterAt: earlier, dispatchLetterUrl: "u3", dispatchLetterName: "n3",
    };
    const d = coopDocStepUpdate(cur, "REQUEST_LETTER", now);
    assert.equal("requestLetterUrl" in d, false); // ขั้นที่ยังอยู่ไม่ถูกแตะ
    assert.equal(d.acceptanceFormAt, null);
    assert.equal(d.acceptanceFormUrl, null);
    assert.equal(d.dispatchLetterName, null);
    const none = coopDocStepUpdate(cur, "NONE", now);
    assert.equal(none.requestLetterAt, null);
    assert.equal(none.requestLetterUrl, null);
  });

  test("มุมมองขั้นเอกสาร: done ตามขั้นปัจจุบัน + ไฟล์", () => {
    const v = coopDocStepsView({ docStep: "ACCEPTANCE_FORM", requestLetterAt: earlier, acceptanceFormUrl: "u2" });
    assert.deepEqual(v.map((x) => x.done), [true, true, false]);
    assert.equal(v[1].url, "u2");
    assert.equal(v[2].url, "");
  });
});

describe("ไฟล์และลิงก์ที่แนบ", () => {
  test("coopFileError รับ PDF/JPG/PNG ไม่เกิน 10 MB", () => {
    assert.equal(coopFileError(undefined, "Portfolio"), null);
    assert.equal(coopFileError({ originalname: "cv.pdf", mimetype: "application/pdf", size: 1000 }, "Resume"), null);
    assert.equal(coopFileError({ originalname: "grade.JPG", mimetype: "image/jpeg", size: 1000 }, "Transcript"), null);
    assert.match(coopFileError({ originalname: "cv.docx", mimetype: "application/msword", size: 10 }, "Resume")!, /PDF, JPG หรือ PNG/);
    assert.match(coopFileError({ originalname: "big.pdf", mimetype: "application/pdf", size: 11 * 1024 * 1024 }, "Resume")!, /10 MB/);
  });

  test("normalizePortfolioLink เติม https:// และกันข้อความที่ไม่ใช่ลิงก์", () => {
    assert.deepEqual(normalizePortfolioLink(""), { value: null });
    assert.equal(normalizePortfolioLink("github.com/student").value, "https://github.com/student");
    assert.equal(normalizePortfolioLink("http://behance.net/x").value, "http://behance.net/x");
    assert.ok(normalizePortfolioLink("มีผลงานในไดรฟ์").error);
  });
});

describe("รวม PDF (Resume -> Transcript -> Portfolio)", () => {
  test("detectFileKind / pdfSafeText", async () => {
    assert.equal(detectFileKind(await pdfWithPages(1)), "pdf");
    assert.equal(detectFileKind(PNG_1PX), "png");
    assert.equal(detectFileKind(Buffer.from("hello")), "unknown");
    assert.equal(pdfSafeText("ID 67024965 นายทดสอบ"), "ID 67024965");
  });

  test("คัดลอกทุกหน้าของ PDF + รูปเป็น 1 หน้า + หน้าสรุปเมื่อมีลิงก์ + หน้าแจ้งเมื่อไฟล์เสีย", async () => {
    const merged = await mergeCoopDocuments(
      [
        { label: "Resume", buffer: await pdfWithPages(2) },
        { label: "Transcript", buffer: PNG_1PX },
        { label: "Portfolio", buffer: Buffer.from("not a file") },
        { label: "Extra", buffer: null },
      ],
      { studentCode: "67024965", portfolioLink: "https://github.com/student" }
    );
    const doc = await PDFDocument.load(merged);
    // หน้าสรุป 1 + Resume 2 + Transcript 1 + หน้าแจ้ง Portfolio 1 + หน้าแจ้ง Extra 1
    assert.equal(doc.getPageCount(), 6);
  });

  test("ไม่มีลิงก์ Portfolio = ไม่มีหน้าสรุป", async () => {
    const merged = await mergeCoopDocuments([{ label: "Resume", buffer: await pdfWithPages(1) }], { studentCode: "1", portfolioLink: null });
    assert.equal((await PDFDocument.load(merged)).getPageCount(), 1);
  });
});
