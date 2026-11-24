import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  cvCommentError,
  cvCommentRole,
  cvState,
  hasCv,
  isCommentForOlderFile,
  unseenCommentCount,
  uploadedAfterLastComment,
} from "../src/utils/cvReview";

const t = (iso: string) => new Date(iso);

describe("สถานะ CV (ไม่มีการอนุมัติ — คอมเมนต์อย่างเดียว)", () => {
  test("ยังไม่อัปโหลด = NONE / มีไฟล์ = ผ่านเงื่อนไขเตรียมความพร้อม", () => {
    assert.equal(cvState(null), "NONE");
    assert.equal(cvState({ fileUrl: "" }), "NONE");
    assert.equal(hasCv(null), false);
    assert.equal(hasCv({ fileUrl: "https://x/cv.pdf" }), true);
  });

  test("อัปโหลดแล้วยังไม่มีคอมเมนต์ = WAITING", () => {
    assert.equal(cvState({ fileUrl: "u", uploadedAt: t("2026-11-01") }), "WAITING");
  });

  test("คอมเมนต์หลังอัปโหลด = COMMENTED / อัปโหลดใหม่หลังคอมเมนต์ = WAITING อีกครั้ง", () => {
    const commented = { fileUrl: "u", uploadedAt: t("2026-11-01"), lastCommentAt: t("2026-11-02") };
    assert.equal(cvState(commented), "COMMENTED");
    assert.equal(uploadedAfterLastComment(commented), false);
    const reuploaded = { fileUrl: "u2", uploadedAt: t("2026-11-03"), lastCommentAt: t("2026-11-02") };
    assert.equal(cvState(reuploaded), "WAITING");
    assert.equal(uploadedAfterLastComment(reuploaded), true);
  });

  test("คอมเมนต์ที่เขียนถึงไฟล์ก่อนหน้า", () => {
    assert.equal(isCommentForOlderFile(t("2026-11-01"), t("2026-11-03")), true);
    assert.equal(isCommentForOlderFile(t("2026-11-03"), t("2026-11-03")), false);
    assert.equal(isCommentForOlderFile(null, t("2026-11-03")), false);
  });

  test("นับคอมเมนต์ที่นิสิตยังไม่อ่าน", () => {
    const cs = [{ createdAt: t("2026-11-05") }, { createdAt: t("2026-11-02") }];
    assert.equal(unseenCommentCount(cs, null), 2);
    assert.equal(unseenCommentCount(cs, t("2026-11-03")), 1);
    assert.equal(unseenCommentCount(cs, t("2026-11-06")), 0);
  });
});

describe("สิทธิ์และข้อความคอมเมนต์", () => {
  test("อาจารย์ที่ปรึกษาของนิสิต / อาจารย์ประจำวิชา คอมเมนต์ได้ · เจ้าหน้าที่อย่างเดียวไม่ได้", () => {
    assert.equal(cvCommentRole({ isAdvisorOfStudent: true, isCourseAdmin: false }), "ADVISOR");
    assert.equal(cvCommentRole({ isAdvisorOfStudent: false, isCourseAdmin: true }), "COURSE_ADMIN");
    assert.equal(cvCommentRole({ isAdvisorOfStudent: true, isCourseAdmin: true }), "ADVISOR");
    assert.equal(cvCommentRole({ isAdvisorOfStudent: false, isCourseAdmin: false }), null);
  });

  test("ข้อความ: ห้ามว่าง / ไม่เกิน 2,000 ตัวอักษร", () => {
    assert.ok(cvCommentError("   "));
    assert.ok(cvCommentError(undefined));
    assert.ok(cvCommentError("ก".repeat(2001)));
    assert.equal(cvCommentError("ควรเพิ่มโปรเจกต์"), null);
  });
});
