import express, { Request, Response } from "express";
import {
  countUnread,
  countUnreadByAudience,
  ensureStudentDeadlineReminders,
  listNotificationMajors,
  listNotifications,
  markAllRead,
  markRead,
} from "../utils/notifications";
import {
  audienceFromActiveRole,
  categoriesFor,
  hasMajorFilter,
  parseCategory,
  parseReadFilter,
  parseSearch,
} from "../utils/notificationRules";

// =====================================================================
// /api/notifications — ใช้ร่วมทุกโรล
// ผู้รับ = user ใน session + โรลที่กำลังใช้งาน (activeRole) เท่านั้น ห้ามรับ userId/role จาก client
// =====================================================================

const router = express.Router();

// API ตอบเป็น JSON (requireLogin เดิม redirect ไป /login ซึ่ง fetch อ่านไม่ได้)
router.use((req: Request, res: Response, next) => {
  if (!req.session?.user) return res.status(401).json({ success: false, message: "กรุณาเข้าสู่ระบบ" });
  next();
});

function currentAudience(req: Request) {
  const u = req.session.user!;
  return audienceFromActiveRole(u.activeRole, u.role);
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.session.user!.id;
    const audience = currentAudience(req);
    if (audience === "STUDENT") await ensureStudentDeadlineReminders(userId);
    const majorFilter = hasMajorFilter(audience);
    const data = await listNotifications(userId, audience, {
      status: parseReadFilter(req.query.status),
      category: parseCategory(audience, req.query.category),
      search: parseSearch(req.query.q),
      major: majorFilter ? parseSearch(req.query.major) : null,
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 20,
    });
    // ตัวเลือกสาขา: เฉพาะ admin (อาจารย์ประจำวิชา / เจ้าหน้าที่) และโหลดเฉพาะหน้าแรก
    const majors = majorFilter && req.query.withMajors === "1" ? await listNotificationMajors(userId, audience) : undefined;
    // categories = เฉพาะหมวดของโรลที่กำลังใช้งาน
    res.json({ success: true, audience, categories: categoriesFor(audience), majorFilter, majors, ...data });
  } catch (err) {
    console.error("GET /api/notifications error:", err);
    res.status(500).json({ success: false, message: "โหลดการแจ้งเตือนไม่สำเร็จ" });
  }
});

router.get("/unread-count", async (req: Request, res: Response) => {
  try {
    const userId = req.session.user!.id;
    const audience = currentAudience(req);
    if (audience === "STUDENT") await ensureStudentDeadlineReminders(userId);
    const [unread, byAudience] = await Promise.all([countUnread(userId, audience), countUnreadByAudience(userId)]);
    res.json({ success: true, audience, unread, byAudience });
  } catch (err) {
    console.error("GET /api/notifications/unread-count error:", err);
    res.status(500).json({ success: false, message: "โหลดจำนวนแจ้งเตือนไม่สำเร็จ" });
  }
});

router.post("/read-all", async (req: Request, res: Response) => {
  try {
    const count = await markAllRead(req.session.user!.id, currentAudience(req));
    res.json({ success: true, count });
  } catch (err) {
    console.error("POST /api/notifications/read-all error:", err);
    res.status(500).json({ success: false, message: "บันทึกไม่สำเร็จ" });
  }
});

router.post("/:id/read", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: "รหัสแจ้งเตือนไม่ถูกต้อง" });
  try {
    const updated = await markRead(req.session.user!.id, currentAudience(req), id);
    res.json({ success: true, updated });
  } catch (err) {
    console.error("POST /api/notifications/:id/read error:", err);
    res.status(500).json({ success: false, message: "บันทึกไม่สำเร็จ" });
  }
});

export default router;
