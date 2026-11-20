-- ข้อมูลเพิ่มเติมของนิสิต (หน้า status-all การ์ด "อื่นๆ")
-- ใช้ IF NOT EXISTS เพราะฐานที่ sync ด้วย `prisma db push` มีคอลัมน์นี้อยู่แล้ว
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "otherInfo" TEXT;
