import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  academicYearOf,
  classYearOfCohort,
  cohortAcademicYear,
  cohortAcademicYearError,
  cohortCodeOf,
  computeWindowStatus,
  isValidTerm,
  parseYmd,
  partitionRetestRevert,
  resolveSubmissionWindow,
  windowDisplayLabel,
  shiftDate,
  shiftTerm,
  termSortKey,
  todayYmdBangkok,
  windowDateOrderError,
} from "../src/utils/internshipWindowRules";

const base = {
  openDate: parseYmd("2026-06-01"),
  closeDate: parseYmd("2026-08-31"),
  internEndDate: parseYmd("2027-02-28"),
  isUnlocked: true,
  extendedOpen: false,
  isCompleted: false,
};

describe("computeWindowStatus", () => {
  test("locked when staff has not unlocked", () => {
    assert.equal(computeWindowStatus({ ...base, isUnlocked: false }, "2026-07-01"), "LOCKED");
  });

  test("not yet open before openDate, open inside the window (inclusive)", () => {
    assert.equal(computeWindowStatus(base, "2026-05-31"), "NOT_YET_OPEN");
    assert.equal(computeWindowStatus(base, "2026-06-01"), "OPEN");
    assert.equal(computeWindowStatus(base, "2026-08-31"), "OPEN");
  });

  test("auto-locks after closeDate unless extended by staff", () => {
    assert.equal(computeWindowStatus(base, "2026-09-01"), "EXPIRED");
    assert.equal(computeWindowStatus({ ...base, extendedOpen: true }, "2026-09-01"), "EXTENDED");
  });

  test("completed when staff marks it, or after the internship end date", () => {
    assert.equal(computeWindowStatus({ ...base, isCompleted: true }, "2026-07-01"), "COMPLETED");
    assert.equal(computeWindowStatus(base, "2027-03-01"), "COMPLETED");
  });

  test("windows without dates stay open once unlocked", () => {
    const noDates = { ...base, openDate: null, closeDate: null, internEndDate: null };
    assert.equal(computeWindowStatus(noDates, "2030-01-01"), "OPEN");
  });
});

describe("cohort & term helpers", () => {
  test("cohort code and class year", () => {
    assert.equal(cohortCodeOf("67023110"), "67");
    assert.equal(cohortCodeOf(""), "");
    assert.equal(classYearOfCohort("67", 2569), 3);
    assert.equal(classYearOfCohort("68", 2569), 2);
  });

  test("term validation, ordering and year shift", () => {
    assert.ok(isValidTerm("3/2569"));
    assert.ok(!isValidTerm("4/2569"));
    assert.ok(!isValidTerm("2569"));
    assert.ok(termSortKey("2/2568") < termSortKey("3/2568"));
    assert.ok(termSortKey("3/2568") < termSortKey("1/2569"));
    assert.equal(shiftTerm("2/2568", 1), "2/2569");
    assert.equal(shiftDate(parseYmd("2026-06-01"), 1)?.toISOString().slice(0, 10), "2027-06-01");
  });

  test("parseYmd rejects invalid input and Bangkok date is YYYY-MM-DD", () => {
    assert.equal(parseYmd(""), null);
    assert.equal(parseYmd("01/06/2026"), null);
    // 2026-11-13 20:00 UTC = 2026-11-14 03:00 เวลาไทย
    assert.equal(todayYmdBangkok(new Date("2026-11-13T20:00:00Z")), "2026-11-14");
  });
});

describe("resolveSubmissionWindow", () => {
  const a = { id: 1 };
  const b = { id: 2 };

  test("auto-assigns when exactly one window is open", () => {
    assert.equal(resolveSubmissionWindow([a]).window, a);
  });

  test("requires a choice when several windows are open", () => {
    const r = resolveSubmissionWindow([a, b]);
    assert.equal(r.window, null);
    assert.ok(r.error);
    assert.equal(resolveSubmissionWindow([a, b], "2").window, b);
    // keeps the student's current window if it is still open
    assert.equal(resolveSubmissionWindow([a, b], undefined, 1).window, a);
  });

  test("rejects a choice that is not open and errors when nothing is open", () => {
    assert.equal(resolveSubmissionWindow([a], 99).window, null);
    assert.equal(resolveSubmissionWindow([]).window, null);
  });

  test("display label marks Summer only (optional tag removed for now)", () => {
    assert.equal(windowDisplayLabel({ term: "1/2570", termType: "REGULAR" }), "1/2570");
    assert.equal(windowDisplayLabel({ term: "3/2569", termType: "SUMMER" }), "3/2569 (Summer)");
  });
});

describe("windowDateOrderError (เปิดยื่น ≤ ปิดยื่น ≤ เริ่มฝึก < สิ้นสุดการฝึก)", () => {
  const d = (s: string) => parseYmd(s);
  test("valid order, and empty fields are skipped", () => {
    assert.equal(windowDateOrderError({ openDate: d("2026-06-01"), closeDate: d("2026-08-31"), internStartDate: d("2026-11-02"), internEndDate: d("2027-02-19") }), null);
    assert.equal(windowDateOrderError({ closeDate: d("2026-11-02"), internStartDate: d("2026-11-02") }), null);
    assert.equal(windowDateOrderError({ internStartDate: null, internEndDate: d("2027-02-19") }), null);
    assert.equal(windowDateOrderError({}), null);
  });

  test("rejects dates out of order", () => {
    assert.match(windowDateOrderError({ openDate: d("2026-09-01"), closeDate: d("2026-08-31") })!, /เปิดยื่น/);
    assert.match(windowDateOrderError({ closeDate: d("2026-11-03"), internStartDate: d("2026-11-02") })!, /ปิดยื่น/);
    assert.match(windowDateOrderError({ openDate: d("2026-11-03"), internStartDate: d("2026-11-02") })!, /เปิดยื่น/);
    assert.match(windowDateOrderError({ internStartDate: d("2027-02-19"), internEndDate: d("2027-02-19") })!, /เริ่มฝึก/);
  });
});

describe("ปีการศึกษาที่จบกระบวนการของรุ่น (ปิดรุ่น / เก็บเข้าประวัติ)", () => {
  test("academicYearOf ตัดรอบเดือน มิ.ย. ตามเวลาไทย", () => {
    assert.equal(academicYearOf(new Date("2026-11-17T08:29:00Z")), 2569);
    assert.equal(academicYearOf(new Date("2027-01-20T03:00:00Z")), 2569);
    assert.equal(academicYearOf(new Date("2027-06-01T03:00:00Z")), 2570);
    // 31 พ.ค. 2027 เวลา 18:00 UTC = 1 มิ.ย. 01:00 เวลาไทย -> ขึ้นปีการศึกษาใหม่แล้ว
    assert.equal(academicYearOf(new Date("2027-05-31T18:00:00Z")), 2570);
  });

  test("cohortAcademicYear ใช้ค่าที่เลือกไว้ก่อน ถ้าไม่มีคิดจากวันที่ปิด และรุ่นที่ยังเปิดไม่มีค่า", () => {
    const closedAt = new Date("2026-11-17T08:29:00Z");
    assert.equal(cohortAcademicYear({ status: "ARCHIVED", archivedAt: closedAt, archivedAcademicYear: "2570" }), "2570");
    assert.equal(cohortAcademicYear({ status: "ARCHIVED", archivedAt: closedAt, archivedAcademicYear: null }), "2569");
    assert.equal(cohortAcademicYear({ status: "ACTIVE", archivedAt: null, archivedAcademicYear: null }), "");
  });

  test("cohortAcademicYearError ตรวจรูปแบบ และช่วงปีที่เป็นไปได้", () => {
    assert.equal(cohortAcademicYearError("2569", "67", 2569), null);
    assert.equal(cohortAcademicYearError("2570", "67", 2569), null);
    assert.match(cohortAcademicYearError("69", "67", 2569)!, /4 หลัก/);
    assert.match(cohortAcademicYearError("2566", "67", 2569)!, /เข้าศึกษา \(2567\)/);
    assert.match(cohortAcademicYearError("2571", "67", 2569)!, /ไม่เกิน 2570/);
  });
});

describe("partitionRetestRevert (เปิดรุ่นกลับ -> คืนสถานะตกค้างที่ระบบตั้งตอนปิดรุ่น)", () => {
  test("คืนเฉพาะคนที่ยังเป็น RETEST และไม่ได้ผูกรอบของรุ่นอื่น", () => {
    const students = [
      { id: 1, internshipType: "RETEST", internshipWindow: null },          // ยังไม่ผูกรอบ -> คืน
      { id: 2, internshipType: "RETEST", internshipWindow: { cohortId: 7 } }, // รอบของรุ่นตัวเอง -> คืน
      { id: 3, internshipType: "RETEST", internshipWindow: { cohortId: 8 } }, // ยื่นรอบรุ่นอื่นแล้ว -> คงตกค้าง
      { id: 4, internshipType: "NEW", internshipWindow: null },             // เจ้าหน้าที่แก้เองแล้ว -> ไม่แตะ
    ];
    const { revert, movedOn } = partitionRetestRevert(students, 7);
    assert.deepEqual(revert.map((s) => s.id), [1, 2]);
    assert.deepEqual(movedOn.map((s) => s.id), [3]);
  });
});
