import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  classYearOfCohort,
  cohortCodeOf,
  computeWindowStatus,
  isValidTerm,
  parseYmd,
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
