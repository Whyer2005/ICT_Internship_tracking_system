-- พิกัดที่นิสิตปักหมุดจากแผนที่ (หน้า Checklist: ค้นหา/ปักหมุดสถานประกอบการ)
-- ใช้ IF NOT EXISTS เพราะฐานที่ sync ด้วย `prisma db push` มีคอลัมน์นี้อยู่แล้ว
ALTER TABLE "InternshipPlacement" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "InternshipPlacement" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
