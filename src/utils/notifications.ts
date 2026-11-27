import { Prisma } from "@prisma/client";
import prisma from "../db";
import { ICT_MAJORS } from "./majors";
import {
  NotificationAudience,
  NotificationCategory,
  NotificationInput,
  NotificationPayload,
  NotificationReadFilter,
  normalizeNotification,
} from "./notificationRules";

// =====================================================================
// ระบบแจ้งเตือน — สร้าง/อ่าน/อ่านแล้ว
// ทุกฟังก์ชันสร้างแจ้งเตือน "ไม่ throw": ถ้าบันทึกไม่สำเร็จแค่ log ไว้ เพื่อไม่ให้ action หลัก (อนุมัติ, ออกหนังสือ ฯลฯ) ล้มตาม
// =====================================================================

type StudentLite = { id: number; studentCode: string; nameTh: string };

/** บันทึกแจ้งเตือนหลายรายการ (ข้ามรายการที่ dedupeKey ซ้ำ) — คืนจำนวนที่บันทึกได้ */
export async function createNotifications(inputs: NotificationInput[]): Promise<number> {
  const rows = inputs.map(normalizeNotification).filter((r): r is NonNullable<typeof r> => r !== null);
  if (rows.length === 0) return 0;
  try {
    const result = await prisma.notification.createMany({ data: rows, skipDuplicates: true });
    return result.count;
  } catch (err) {
    console.error("createNotifications error:", err);
    return 0;
  }
}

export async function notify(input: NotificationInput): Promise<number> {
  return createNotifications([input]);
}

async function studentsLite(studentIds: number[]) {
  const ids = [...new Set(studentIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return [];
  return prisma.student.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      userId: true,
      studentCode: true,
      nameTh: true,
      major: true,
      curriculum: true,
      advisor: { select: { userId: true } },
    },
  });
}

type Builder = NotificationPayload | ((s: StudentLite) => NotificationPayload | null);
// ใส่สาขาของนิสิตให้อัตโนมัติ (payload ระบุ major เองได้)
const build = (b: Builder, s: StudentLite & { major?: string | null; curriculum?: string | null }): NotificationPayload | null => {
  const p = typeof b === "function" ? b(s) : b;
  return p ? { major: s.major || s.curriculum || null, ...p } : null;
};

/** แจ้งนิสิต (ตาม Student.id) */
export async function notifyStudents(studentIds: number[], payload: Builder): Promise<number> {
  try {
    const students = await studentsLite(studentIds);
    const inputs: NotificationInput[] = [];
    for (const s of students) {
      const p = build(payload, s);
      if (p) inputs.push({ ...p, userId: s.userId, audience: "STUDENT" });
    }
    return createNotifications(inputs);
  } catch (err) {
    console.error("notifyStudents error:", err);
    return 0;
  }
}

/** แจ้งอาจารย์ที่ปรึกษาของนิสิตแต่ละคน */
export async function notifyAdvisorsOfStudents(studentIds: number[], payload: Builder): Promise<number> {
  try {
    const students = await studentsLite(studentIds);
    const inputs: NotificationInput[] = [];
    for (const s of students) {
      if (!s.advisor?.userId) continue;
      const p = build(payload, s);
      if (p) inputs.push({ ...p, userId: s.advisor.userId, audience: "ADVISOR" });
    }
    return createNotifications(inputs);
  } catch (err) {
    console.error("notifyAdvisorsOfStudents error:", err);
    return 0;
  }
}

/** แจ้งอาจารย์ที่ปรึกษาโดยตรง (ตาม Staff.id) */
export async function notifyAdvisorStaff(staffId: number, payload: NotificationPayload): Promise<number> {
  try {
    const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: { userId: true } });
    if (!staff) return 0;
    return createNotifications([{ ...payload, userId: staff.userId, audience: "ADVISOR" }]);
  } catch (err) {
    console.error("notifyAdvisorStaff error:", err);
    return 0;
  }
}

/** userId ของทุกคนที่มีโรลนี้ (อาจารย์รายวิชา / เจ้าหน้าที่) พร้อมสาขาที่ดูแล */
async function roleHolders(audience: "COURSE_ADMIN" | "STAFF") {
  const users = await prisma.user.findMany({
    where:
      audience === "COURSE_ADMIN"
        ? { OR: [{ role: "ADMIN" }, { staff: { isCourseAdmin: true } }] }
        : { OR: [{ role: "STAFF" }, { staff: { isStaff: true } }] },
    select: { id: true, staff: { select: { department: true } } },
  });
  return users.map((u) => ({ userId: u.id, department: u.staff?.department?.trim() || null }));
}

/** แจ้งเจ้าหน้าที่คณะทุกคน */
export async function notifyStaffUsers(payload: NotificationPayload, aboutStudentId?: number): Promise<number> {
  try {
    // เรื่องของนิสิตคนเดียว → เก็บสาขาไว้กรองในหน้าการแจ้งเตือน
    const [holders, about] = await Promise.all([
      roleHolders("STAFF"),
      aboutStudentId ? prisma.student.findUnique({ where: { id: aboutStudentId }, select: { major: true, curriculum: true } }) : null,
    ]);
    const p: NotificationPayload = { major: about?.major || about?.curriculum || null, ...payload };
    return createNotifications(holders.map((h) => ({ ...p, userId: h.userId, audience: "STAFF" })));
  } catch (err) {
    console.error("notifyStaffUsers error:", err);
    return 0;
  }
}

/**
 * แจ้งอาจารย์รายวิชาที่ดูแลนิสิตคนนี้
 * - อาจารย์ที่ไม่ได้ระบุสาขา = ดูแลทั้งคณะ → ได้รับทุกเรื่อง
 * - อาจารย์ที่ระบุสาขา → ได้รับเฉพาะนิสิตที่ major/curriculum มีชื่อสาขานั้น (กติกาเดียวกับ filterStudentsByScope)
 */
export async function notifyCourseAdminsForStudents(studentIds: number[], payload: Builder): Promise<number> {
  try {
    const [students, holders] = await Promise.all([studentsLite(studentIds), roleHolders("COURSE_ADMIN")]);
    const inputs: NotificationInput[] = [];
    for (const s of students) {
      const p = build(payload, s);
      if (!p) continue;
      const majorText = `${s.major || ""} ${s.curriculum || ""}`.toLowerCase();
      for (const h of holders) {
        if (h.department && !majorText.includes(h.department.toLowerCase())) continue;
        inputs.push({ ...p, userId: h.userId, audience: "COURSE_ADMIN" });
      }
    }
    return createNotifications(inputs);
  } catch (err) {
    console.error("notifyCourseAdminsForStudents error:", err);
    return 0;
  }
}

// ---------------------------------------------------------------------
// อ่านแจ้งเตือนของผู้ใช้ (กรองด้วย userId + audience จาก session เท่านั้น)
// ---------------------------------------------------------------------

export interface ListOptions {
  status?: NotificationReadFilter;
  category?: NotificationCategory | null;
  search?: string | null;
  major?: string | null;
  page?: number;
  pageSize?: number;
}

export async function listNotifications(userId: number, audience: NotificationAudience, opts: ListOptions = {}) {
  const pageSize = Math.min(Math.max(Number(opts.pageSize) || 20, 1), 50);
  const page = Math.max(Number(opts.page) || 1, 1);
  // ตัวกรองหมวด + คำค้น (ใช้นับยอดในแท็บด้วย) → แล้วค่อยกรองสถานะการอ่าน
  const filtered: Prisma.NotificationWhereInput = {
    recipientUserId: userId,
    audience,
    ...(opts.category ? { category: opts.category } : {}),
    ...(opts.major ? { major: opts.major } : {}),
    ...(opts.search
      ? {
          OR: [
            { title: { contains: opts.search, mode: "insensitive" } },
            { message: { contains: opts.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const readWhere = { all: {}, unread: { readAt: null }, read: { readAt: { not: null } } }[opts.status || "all"];
  const where = { ...filtered, ...readWhere };
  const [items, total, filteredAll, filteredUnread, unread, byCategory] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        category: true,
        priority: true,
        title: true,
        message: true,
        link: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: filtered }),
    prisma.notification.count({ where: { ...filtered, readAt: null } }),
    prisma.notification.count({ where: { recipientUserId: userId, audience, readAt: null } }),
    prisma.notification.groupBy({
      by: ["category"],
      where: { recipientUserId: userId, audience },
      _count: { _all: true },
    }),
  ]);
  const categoryCounts: Record<string, number> = {};
  for (const row of byCategory) categoryCounts[row.category] = row._count._all;
  // tabCounts = ยอดตามตัวกรองหมวด/คำค้นปัจจุบัน (โชว์บนแท็บ) · unread = ยอดยังไม่อ่านทั้งหมดของโรล (โชว์บนกระดิ่ง)
  const tabCounts = { all: filteredAll, unread: filteredUnread, read: filteredAll - filteredUnread };
  return { items, total, unread, tabCounts, page, pageSize, hasMore: page * pageSize < total, categoryCounts };
}

/** สาขาที่มีในแจ้งเตือนของผู้ใช้ (ตัวเลือก "ทุกสาขา") เรียงตามลำดับสาขาของคณะ */
export async function listNotificationMajors(userId: number, audience: NotificationAudience) {
  const rows = await prisma.notification.groupBy({
    by: ["major"],
    where: { recipientUserId: userId, audience, major: { not: null } },
    _count: { _all: true },
  });
  const order = (name: string) => {
    const i = ICT_MAJORS.findIndex((m) => m.name === name);
    return i < 0 ? ICT_MAJORS.length : i;
  };
  return rows
    .map((r) => ({ name: r.major as string, count: r._count._all }))
    .sort((a, b) => order(a.name) - order(b.name) || a.name.localeCompare(b.name, "th"));
}

export async function countUnread(userId: number, audience: NotificationAudience): Promise<number> {
  return prisma.notification.count({ where: { recipientUserId: userId, audience, readAt: null } });
}

/** ยอดยังไม่อ่านของทุกโรล (โชว์จุดแดงบนปุ่มสลับโรล) */
export async function countUnreadByAudience(userId: number): Promise<Record<string, number>> {
  const rows = await prisma.notification.groupBy({
    by: ["audience"],
    where: { recipientUserId: userId, readAt: null },
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const r of rows) out[r.audience] = r._count._all;
  return out;
}

export async function markRead(userId: number, audience: NotificationAudience, id: number): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id, recipientUserId: userId, audience, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count > 0;
}

export async function markAllRead(userId: number, audience: NotificationAudience): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { recipientUserId: userId, audience, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

// ---------------------------------------------------------------------
// เตือนกำหนดการของนิสิต (สร้างตอนนิสิตเปิดดูแจ้งเตือน เพราะระบบไม่มี cron)
// - รอบยื่นบริษัทเปิดแล้ว (ครั้งเดียวต่อรอบ)
// - ใกล้ปิดรอบ: เหลือ ≤7 / ≤3 / ≤1 วัน (ครั้งเดียวต่อช่วง)
// ตรวจไม่เกินทุก 10 นาทีต่อคน (เก็บในหน่วยความจำของ instance)
// ---------------------------------------------------------------------

const DEADLINE_CHECK_INTERVAL_MS = 10 * 60 * 1000;
const lastDeadlineCheck = new Map<number, number>();

export async function ensureStudentDeadlineReminders(userId: number): Promise<void> {
  const now = Date.now();
  if (now - (lastDeadlineCheck.get(userId) || 0) < DEADLINE_CHECK_INTERVAL_MS) return;
  // ล้างรายการที่หมดอายุแล้ว กัน Map โตไม่จำกัดบน instance ที่รันนาน
  if (lastDeadlineCheck.size > 5000) {
    for (const [k, t] of lastDeadlineCheck) if (now - t >= DEADLINE_CHECK_INTERVAL_MS) lastDeadlineCheck.delete(k);
  }
  lastDeadlineCheck.set(userId, now);
  try {
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { studentCode: true, major: true, internshipType: true, stage: true, isDropped: true, placement: { select: { id: true } } },
    });
    // พร้อมฝึกงานแล้ว / ถอนตัว / ยื่นสถานที่ฝึกงานแล้ว → ไม่ต้องเตือนเรื่องรอบยื่น
    if (!student || student.isDropped || student.stage === "READY" || student.placement) return;

    const { getStudentWindowEligibility, windowDisplayLabel } = await import("./internshipWindows");
    const { daysUntil, deadlineReminderBucket } = await import("./notificationRules");
    const { openWindows } = await getStudentWindowEligibility(student);

    const inputs: NotificationInput[] = [];
    for (const w of openWindows) {
      const label = windowDisplayLabel(w);
      const closeText = w.closeDate
        ? w.closeDate.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
        : null;
      inputs.push({
        userId,
        audience: "STUDENT",
        type: "WINDOW_OPEN",
        category: "deadline",
        title: `เปิดรอบยื่นสถานประกอบการ ${label} แล้ว`,
        message: closeText ? `ยื่นข้อมูลบริษัทและ Checklist ได้ถึง ${closeText}` : "ยื่นข้อมูลบริษัทและ Checklist ได้แล้ว",
        link: "/status-all",
        entityType: "InternshipWindow",
        entityId: w.id,
        dedupeKey: `window-open:${w.id}`,
      });
      if (!w.closeDate) continue;
      const left = daysUntil(w.closeDate, new Date());
      const bucket = deadlineReminderBucket(left);
      if (!bucket) continue;
      inputs.push({
        userId,
        audience: "STUDENT",
        type: "WINDOW_CLOSING",
        category: "deadline",
        priority: left <= 3 ? "HIGH" : "NORMAL",
        title: left === 0 ? `วันนี้วันสุดท้ายของรอบ ${label}` : `อีก ${left} วันจะปิดรอบยื่น ${label}`,
        message: `ปิดรับ ${closeText} — ยื่นข้อมูลบริษัทและ Checklist ให้เรียบร้อยก่อนปิดรอบ`,
        link: "/status-all",
        entityType: "InternshipWindow",
        entityId: w.id,
        dedupeKey: `window-closing:${w.id}:${bucket}`,
      });
    }
    await createNotifications(inputs);
  } catch (err) {
    console.error("ensureStudentDeadlineReminders error:", err);
    // ล้มเหลว → ให้ลองใหม่ได้ในคำขอถัดไป (ไม่ต้องรอ 10 นาที)
    lastDeadlineCheck.delete(userId);
  }
}
