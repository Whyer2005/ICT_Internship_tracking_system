import { test } from "node:test";
import assert from "node:assert/strict";
import {
  backfillLegacyBatches,
  batchesForStudent,
  findIneligibleForLetter,
  getLetterBatch,
  newBatchId,
  saveLetterBatch,
  toBatchStudent,
} from "../src/utils/letterBatches";
import type { LetterBatchStudent, StudentDocWorkflowRecord } from "../src/utils/superAdminStore";

function wf(id: number, extra: Partial<StudentDocWorkflowRecord> = {}): StudentDocWorkflowRecord {
  return {
    studentId: id,
    studentCode: String(67000000 + id),
    companyName: "tesla",
    requestLetterIssued: false,
    companyResponseStatus: "NOT_SENT",
    dispatchLetterIssued: false,
    isLocked: false,
    ...extra,
  };
}

const info = (id: number): LetterBatchStudent => ({
  studentId: id, studentCode: String(67000000 + id), nameTh: `นิสิต ${id}`, major: "SE", position: "Dev", phone: "-",
});

test("newBatchId แยกประเภทและไม่ซ้ำ", () => {
  assert.match(newBatchId("REQUEST"), /^REQ-\d+-[A-Z0-9]+$/);
  assert.match(newBatchId("DISPATCH"), /^DSP-\d+-[A-Z0-9]+$/);
  assert.notEqual(newBatchId("REQUEST", 1), newBatchId("REQUEST", 1));
});

test("toBatchStudent ใช้ค่าเริ่มต้นเมื่อไม่มีข้อมูลตำแหน่ง/เบอร์", () => {
  const s = toBatchStudent({ id: 5, studentCode: "67000005", nameTh: "ก", major: null, phone: null, placement: null });
  assert.equal(s.position, "นิสิตฝึกงาน");
  assert.equal(s.phone, "-");
  assert.equal(s.major, "-");
  assert.equal(s.internStartDate, undefined);
  assert.equal(s.internEndDate, undefined);
});

test("toBatchStudent เก็บช่วงฝึกของรอบออกฝึก ณ วันที่ออกหนังสือ", () => {
  const s = toBatchStudent({
    id: 6, studentCode: "67000006", nameTh: "ข", major: "SE", phone: "0800000000", placement: null,
    internshipWindow: { internStartDate: new Date("2026-11-02T00:00:00.000Z"), internEndDate: new Date("2027-02-19T00:00:00.000Z") },
  });
  assert.equal(s.internStartDate, "2026-11-02");
  assert.equal(s.internEndDate, "2027-02-19");
});

test("REQUEST: นิสิตที่มีหนังสือแล้วออกซ้ำไม่ได้", () => {
  const state = { docWorkflowMap: { "1": wf(1, { requestLetterIssued: true, requestLetterDocNo: "อว 1" }), "2": wf(2) } };
  const bad = findIneligibleForLetter(state, [1, 2, 3], "REQUEST");
  assert.deepEqual(bad.map((b) => b.studentId), [1]);
});

test("DISPATCH: ต้องบริษัทตอบรับแล้ว และยังไม่ส่งตัว", () => {
  const state = {
    docWorkflowMap: {
      "1": wf(1, { companyResponseStatus: "ACCEPTED" }),
      "2": wf(2, { companyResponseStatus: "WAITING_RESPONSE" }),
      "3": wf(3, { companyResponseStatus: "ACCEPTED", dispatchLetterIssued: true }),
    },
  };
  const bad = findIneligibleForLetter(state, [1, 2, 3, 4], "DISPATCH");
  assert.deepEqual(bad.map((b) => b.studentId).sort(), [2, 3, 4]);
});

test("รายชื่อในฉบับเป็น snapshot และค้นฉบับของนิสิตได้ (ใหม่ → เก่า)", () => {
  const state: any = { docWorkflowMap: {} };
  saveLetterBatch(state, { batchId: "A", type: "REQUEST", companyName: "tesla", docNo: "1", letterDate: "2026-11-01",
    signatureSnapshot: "", students: [info(1), info(2), info(3)], issuedAt: "2026-11-01T00:00:00Z" });
  saveLetterBatch(state, { batchId: "B", type: "REQUEST", companyName: "google", docNo: "2", letterDate: "2026-11-10",
    signatureSnapshot: "", students: [info(1)], issuedAt: "2026-11-10T00:00:00Z" });
  assert.deepEqual(batchesForStudent(state, 1).map((b) => b.batchId), ["B", "A"]);
  assert.deepEqual(batchesForStudent(state, 3).map((b) => b.batchId), ["A"]);
  assert.equal(getLetterBatch(state, "A")?.students.length, 3);
  assert.equal(getLetterBatch(state, "ZZZ"), null);
  assert.equal(getLetterBatch(state, undefined), null);
});

test("backfill: รวมข้อมูลเดิมเป็นฉบับตาม batchId / เลขที่+บริษัท และไม่ทำซ้ำ", () => {
  const state: any = {
    docWorkflowMap: {
      "1": wf(1, { requestLetterIssued: true, requestLetterDocNo: "ว 10", requestLetterBatchId: "OLD-1", requestLetterDate: "2026-11-02" }),
      "2": wf(2, { requestLetterIssued: true, requestLetterDocNo: "ว 10", requestLetterBatchId: "OLD-1", requestLetterDate: "2026-11-02" }),
      "3": wf(3, { requestLetterIssued: true, requestLetterDocNo: "ว 11", companyName: "google",
        companyResponseStatus: "ACCEPTED", dispatchLetterIssued: true, dispatchLetterDocNo: "ว 50" }),
      "4": wf(4),
    },
  };
  const map = new Map([1, 2, 3, 4].map((i) => [i, info(i)]));
  assert.equal(backfillLegacyBatches(state, map), true);
  assert.equal(state.letterBatches["OLD-1"].students.length, 2);
  assert.equal(state.letterBatches["OLD-1"].legacy, true);
  const req3 = state.docWorkflowMap["3"].requestLetterBatchId;
  assert.equal(req3, "LEGACY-REQ-ว 11|google");
  assert.equal(state.letterBatches[req3].students[0].studentId, 3);
  const dsp3 = state.docWorkflowMap["3"].dispatchLetterBatchId;
  assert.equal(state.letterBatches[dsp3].type, "DISPATCH");
  assert.equal(state.docWorkflowMap["4"].requestLetterBatchId, undefined);
  // เรียกซ้ำต้องไม่สร้างใหม่
  assert.equal(backfillLegacyBatches(state, map), false);
});
