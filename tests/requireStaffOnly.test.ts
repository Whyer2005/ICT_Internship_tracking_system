import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isStaffUser, requireStaffOnly } from "../src/auth/requireStaffOnly";

describe("ตัวตรวจ 'เฉพาะเจ้าหน้าที่' (งานเอกสาร / ตั้งค่าหนังสือ / แบบฟอร์ม / รอบออกฝึก)", () => {
  test("ผ่าน: role STAFF หรือ staff.isStaff", () => {
    assert.equal(isStaffUser("STAFF", null), true);
    assert.equal(isStaffUser("ADVISOR", { isStaff: true }), true); // อาจารย์ที่ถูกติ๊กเป็นเจ้าหน้าที่ด้วย
  });

  test("ไม่ผ่าน: อาจารย์ประจำวิชา / อาจารย์ที่ปรึกษา / นิสิต", () => {
    assert.equal(isStaffUser("ADMIN", { isStaff: false }), false);
    assert.equal(isStaffUser("ADVISOR", { isStaff: false }), false);
    assert.equal(isStaffUser("STUDENT", null), false);
    assert.equal(isStaffUser(undefined, undefined), false);
  });

  test("middleware: ไม่ใช่เจ้าหน้าที่ -> 403 + ข้อความของงานนั้น / เจ้าหน้าที่ -> next()", () => {
    const mw = requireStaffOnly("เฉพาะเจ้าหน้าที่");
    let status = 0;
    let body: any = null;
    let nextCalled = false;
    const res: any = { status(c: number) { status = c; return this; }, json(b: any) { body = b; return this; } };
    mw({ session: { user: { role: "ADMIN" } }, staff: { isStaff: false } } as any, res, () => { nextCalled = true; });
    assert.equal(status, 403);
    assert.equal(body.message, "เฉพาะเจ้าหน้าที่");
    assert.equal(nextCalled, false);
    mw({ session: { user: { role: "STAFF" } } } as any, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });
});
