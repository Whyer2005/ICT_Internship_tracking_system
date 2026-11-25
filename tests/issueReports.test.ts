import { test } from "node:test";
import assert from "node:assert/strict";
import { ISSUE_PAGES, isIssueStatus, nextIssueId, validateIssueInput } from "../src/utils/issueReports";

const base = { category: "SYSTEM_ERROR", title: "ปุ่มส่งกดไม่ได้", detail: "กดแล้วไม่มีอะไรเกิดขึ้น", page: "Dashboard", urgency: "HIGH", contactByEmail: "true" };

test("validateIssueInput รับข้อมูลที่ถูกต้อง", () => {
  const { value, error } = validateIssueInput(base);
  assert.equal(error, undefined);
  assert.deepEqual(value, {
    category: "SYSTEM_ERROR",
    title: "ปุ่มส่งกดไม่ได้",
    page: "Dashboard",
    detail: "กดแล้วไม่มีอะไรเกิดขึ้น",
    urgency: "HIGH",
    contactByEmail: true,
  });
});

test("validateIssueInput แจ้งช่องที่ขาด และไม่ตัดข้อความยาวทิ้งเงียบ ๆ", () => {
  assert.match(validateIssueInput({ ...base, category: "HACK" }).error || "", /ประเภท/);
  assert.match(validateIssueInput({ ...base, title: "   " }).error || "", /หัวข้อ/);
  assert.match(validateIssueInput({ ...base, detail: "" }).error || "", /รายละเอียด/);
  assert.match(validateIssueInput({ ...base, title: "ก".repeat(121) }).error || "", /ไม่เกิน 120/);
  assert.match(validateIssueInput({ ...base, detail: "ก".repeat(1001) }).error || "", /ไม่เกิน 1000/);
});

test("validateIssueInput ค่าที่ไม่รู้จักใช้ค่าเริ่มต้น", () => {
  const { value } = validateIssueInput({ ...base, page: "<script>", urgency: "PANIC", contactByEmail: "false" });
  assert.equal(value?.page, ISSUE_PAGES[ISSUE_PAGES.length - 1]);
  assert.equal(value?.urgency, "MEDIUM");
  assert.equal(value?.contactByEmail, false);
});

test("nextIssueId นับต่อจากเลขมากสุด", () => {
  assert.equal(nextIssueId([]), "RP-0001");
  assert.equal(nextIssueId([{ id: "RP-0003" }, { id: "RP-0012" }, { id: "RP-0007" }]), "RP-0013");
});

test("isIssueStatus", () => {
  assert.equal(isIssueStatus("RESOLVED"), true);
  assert.equal(isIssueStatus("DONE"), false);
  assert.equal(isIssueStatus(undefined), false);
});
