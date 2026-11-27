-- ลิงก์อ้างอิงของ Certificate ที่นิสิตแนบตอนเพิ่มข้อมูลการอบรม (หน้าผู้จัด/ประชาสัมพันธ์/ตรวจสอบใบรับรอง)
-- ใช้ IF NOT EXISTS เพราะฐานที่ sync ด้วย `prisma db push` อาจมีคอลัมน์นี้อยู่แล้ว
ALTER TABLE "TrainingRecord" ADD COLUMN IF NOT EXISTS "certificateLink" TEXT;
