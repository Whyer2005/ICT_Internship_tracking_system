import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanOrganizer,
  isStudentUploadSource,
  normalizeHttpLink,
  studentCanEditTraining,
  trainingEvidenceError,
} from "../src/utils/trainingEvidence";

describe("หลักฐานใบรับรองที่นิสิตอัปโหลดเอง (T-03)", () => {
  test("ต้องมีหน่วยงานผู้จัด + ลิงก์ http/https", () => {
    assert.equal(trainingEvidenceError("Google Developer Group", "https://gdg.community.dev/events/1"), null);
    assert.equal(trainingEvidenceError("คณะ ICT", "http://ict.up.ac.th/news"), null);
    assert.ok(trainingEvidenceError("", "https://x.com")?.includes("หน่วยงานผู้จัด"));
    assert.ok(trainingEvidenceError("   ", "https://x.com")?.includes("หน่วยงานผู้จัด"));
    assert.ok(trainingEvidenceError("GDG", "")?.includes("ลิงก์"));
    assert.ok(trainingEvidenceError("GDG", "www.gdg.dev")?.includes("http"));
    assert.ok(trainingEvidenceError("GDG", "javascript:alert(1)")?.includes("http"));
    assert.ok(trainingEvidenceError("GDG", "ftp://files.example.com")?.includes("http"));
    assert.ok(trainingEvidenceError("ก".repeat(201), "https://x.com")?.includes("ยาวเกิน"));
  });

  test("normalize ลิงก์ (http/https เท่านั้น)", () => {
    assert.equal(normalizeHttpLink(" https://example.com/a "), "https://example.com/a");
    assert.equal(normalizeHttpLink("mailto:a@b.c"), null);
    assert.equal(normalizeHttpLink(""), null);
  });

  test("บังคับเฉพาะรายการที่นิสิตอัปโหลดเอง (นำเข้า/Check-in ไม่บังคับ)", () => {
    assert.equal(isStudentUploadSource("STUDENT_UPLOAD"), true);
    assert.equal(isStudentUploadSource(null), true); // ข้อมูลเก่าไม่มี source
    assert.equal(isStudentUploadSource("STAFF_IMPORT"), false);
    assert.equal(isStudentUploadSource("ADMIN_IMPORT"), false);
  });

  test("นิสิตแก้ได้เฉพาะรายการของตัวเองที่ยังไม่ผ่านการตรวจ", () => {
    assert.equal(studentCanEditTraining({ source: "STUDENT_UPLOAD", status: "PENDING" }), true);
    assert.equal(studentCanEditTraining({ source: "STUDENT_UPLOAD", status: "REJECTED" }), true);
    assert.equal(studentCanEditTraining({ source: "STUDENT_UPLOAD", status: "APPROVED" }), false);
    assert.equal(studentCanEditTraining({ source: "STAFF_IMPORT", status: "PENDING" }), false);
  });

  test("ตัดช่องว่างซ้ำในชื่อผู้จัด", () => {
    assert.equal(cleanOrganizer("  Google   Developer  Group "), "Google Developer Group");
  });
});
