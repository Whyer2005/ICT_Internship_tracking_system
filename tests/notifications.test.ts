import { test } from "node:test";
import assert from "node:assert/strict";
import {
  approvalPriority,
  approvalText,
  audienceFromActiveRole,
  categoriesFor,
  hasMajorFilter,
  parseCategory,
  parseReadFilter,
  parseSearch,
  daysUntil,
  deadlineReminderBucket,
  isDecision,
  MESSAGE_MAX,
  normalizeNotification,
  placementResultPayload,
  priorityFromUrgency,
  safeInternalLink,
  studentEventPayload,
  TITLE_MAX,
  trainingResultPayload,
  withNote,
} from "../src/utils/notificationRules";

test("ตัวกรองหน้าการแจ้งเตือน: หมวดตามโรล / สถานะการอ่าน / คำค้น", () => {
  assert.deepEqual(Object.keys(categoriesFor("COURSE_ADMIN")), ["approval", "document"]);
  assert.equal(categoriesFor("STAFF").issue, "แจ้งปัญหา");
  assert.equal(parseCategory("ADVISOR", "cv"), "cv");
  assert.equal(parseCategory("ADVISOR", "deadline"), null); // หมวดของนิสิต อาจารย์เลือกไม่ได้
  assert.equal(parseCategory("STUDENT", "nope"), null);
  assert.equal(parseReadFilter("read"), "read");
  assert.equal(parseReadFilter("x"), "all");
  assert.equal(parseSearch("  สมชาย   ใจดี "), "สมชาย ใจดี");
  assert.equal(parseSearch("   "), null);
  assert.equal(parseSearch("ก".repeat(150))!.length, 100);
});

test("สาขาในแจ้งเตือน: normalize เป็นชื่อมาตรฐาน + ตัวกรองสาขาเฉพาะ admin", () => {
  assert.equal(normalizeNotification({ ...base, major: "สาขาวิชาวิศวกรรมซอฟต์แวร์" })!.major, "วิศวกรรมซอฟต์แวร์");
  assert.equal(normalizeNotification({ ...base, major: "" })!.major, null);
  assert.equal(normalizeNotification(base)!.major, null);
  assert.equal(hasMajorFilter("STAFF"), true);
  assert.equal(hasMajorFilter("COURSE_ADMIN"), true);
  assert.equal(hasMajorFilter("ADVISOR"), false);
  assert.equal(hasMajorFilter("STUDENT"), false);
});

test("payload สำเร็จรูป: ผลอนุมัติ / ชั่วโมงอบรม / เหตุการณ์ของนิสิต", () => {
  assert.equal(isDecision("APPROVED"), true);
  assert.equal(isDecision("PENDING"), false);

  const placement = placementResultPayload("REJECTED", "เอกสารไม่ครบ", 5);
  assert.equal(placement.priority, "HIGH");
  assert.equal(placement.entityId, 5);
  assert.match(placement.message, /แก้ไข.*หมายเหตุ: เอกสารไม่ครบ/);

  const one = trainingResultPayload("APPROVED", null, { id: 9, title: "Excel", skillType: "HARD", hours: 3 });
  assert.equal(one.title, 'ชั่วโมงอบรม "Excel" ผ่านการอนุมัติ');
  assert.equal(one.message, "Hard skill 3 ชม.");
  const many = trainingResultPayload("REJECTED", null, 4);
  assert.equal(many.title, "ชั่วโมงอบรม 4 รายการไม่ผ่าน");
  assert.equal(many.entityId, undefined);

  const st = { id: 12, nameTh: "สมชาย", studentCode: "67000001" };
  const ev = studentEventPayload(st, { type: "X", category: "cv", title: "t", message: "m" });
  assert.equal(ev.message, "รหัส 67000001 · m");
  assert.equal(ev.link, "/admin-student-detail?id=12");
  assert.equal(studentEventPayload(st, { type: "X", category: "cv", title: "t", message: "m", link: "/advisor-dashboard" }).link, "/advisor-dashboard");
});

const base = {
  userId: 7,
  audience: "STUDENT" as const,
  type: "PLACEMENT_APPROVED",
  category: "approval" as const,
  title: "สถานที่ฝึกงานของคุณอนุมัติแล้ว",
  message: "ดูรายละเอียดได้ที่หน้าจัดการข้อมูลฝึกงาน",
  link: "/status-all",
};

test("audienceFromActiveRole แปลงโรลใน session เป็นกลุ่มผู้รับ", () => {
  assert.equal(audienceFromActiveRole("STUDENT"), "STUDENT");
  assert.equal(audienceFromActiveRole("ADVISOR"), "ADVISOR");
  assert.equal(audienceFromActiveRole("SUPERVISOR"), "ADVISOR");
  assert.equal(audienceFromActiveRole("COURSE_ADMIN"), "COURSE_ADMIN");
  assert.equal(audienceFromActiveRole("COURSE_INSTRUCTOR"), "COURSE_ADMIN");
  assert.equal(audienceFromActiveRole("STAFF"), "STAFF");
  assert.equal(audienceFromActiveRole("FACULTY_STAFF"), "STAFF");
  // ยังไม่มี activeRole → ใช้ role เดิม
  assert.equal(audienceFromActiveRole(undefined, "ADMIN"), "COURSE_ADMIN");
  assert.equal(audienceFromActiveRole("", "ADVISOR"), "ADVISOR");
});

test("normalizeNotification เติมค่าเริ่มต้นและตัดข้อความยาว", () => {
  const n = normalizeNotification({ ...base, title: "ก".repeat(500), message: "ข".repeat(2000), entityId: 12 });
  assert.ok(n);
  assert.equal(n!.recipientUserId, 7);
  assert.equal(n!.priority, "NORMAL");
  assert.equal(n!.title.length, TITLE_MAX);
  assert.equal(n!.message.length, MESSAGE_MAX);
  assert.equal(n!.entityId, "12");
  assert.equal(n!.dedupeKey, null);
});

test("normalizeNotification ปฏิเสธข้อมูลไม่ครบ (ไม่ throw)", () => {
  assert.equal(normalizeNotification({ ...base, userId: 0 }), null);
  assert.equal(normalizeNotification({ ...base, audience: "HACKER" as any }), null);
  assert.equal(normalizeNotification({ ...base, category: "spam" as any }), null);
  assert.equal(normalizeNotification({ ...base, title: "   " }), null);
});

test("safeInternalLink รับเฉพาะ path ภายในระบบ", () => {
  assert.equal(safeInternalLink("/status-all"), "/status-all");
  assert.equal(safeInternalLink("/admin-student-detail?id=3"), "/admin-student-detail?id=3");
  assert.equal(safeInternalLink("https://evil.example"), null);
  assert.equal(safeInternalLink("//evil.example"), null);
  assert.equal(safeInternalLink("javascript:alert(1)"), null);
  assert.equal(safeInternalLink(""), null);
  assert.equal(normalizeNotification({ ...base, link: "https://evil.example" })!.link, null);
});

test("priority และข้อความผลอนุมัติ", () => {
  assert.equal(priorityFromUrgency("HIGH"), "HIGH");
  assert.equal(priorityFromUrgency("LOW"), "LOW");
  assert.equal(priorityFromUrgency("MEDIUM"), "NORMAL");
  assert.equal(approvalPriority("REJECTED"), "HIGH");
  assert.equal(approvalPriority("APPROVED"), "NORMAL");
  assert.equal(approvalText("APPROVED"), "อนุมัติแล้ว");
  assert.equal(withNote("ข้อความ", "  "), "ข้อความ");
  assert.equal(withNote("ข้อความ", "แก้ที่อยู่"), "ข้อความ · หมายเหตุ: แก้ที่อยู่");
});

test("daysUntil นับตามวันที่ และ deadlineReminderBucket แบ่งช่วงเตือน", () => {
  const now = new Date(Date.UTC(2026, 10, 26, 16, 30)); // 26 พ.ย. 2026 23:30 เวลาไทย
  // 00:30 เวลาไทยของวันที่ 27 (ยังเป็นวันที่ 26 ตาม UTC) → นับเป็นวันที่ 27 แล้ว
  assert.equal(daysUntil(new Date(Date.UTC(2026, 10, 27)), new Date(Date.UTC(2026, 10, 26, 17, 30))), 0);
  assert.equal(daysUntil(new Date(Date.UTC(2026, 10, 26)), now), 0);
  assert.equal(daysUntil(new Date(Date.UTC(2026, 10, 29)), now), 3);
  assert.equal(daysUntil(new Date(Date.UTC(2026, 10, 25)), now), -1);

  assert.equal(deadlineReminderBucket(-1), null);
  assert.equal(deadlineReminderBucket(0), "1d");
  assert.equal(deadlineReminderBucket(1), "1d");
  assert.equal(deadlineReminderBucket(3), "3d");
  assert.equal(deadlineReminderBucket(7), "7d");
  assert.equal(deadlineReminderBucket(8), null);
});
