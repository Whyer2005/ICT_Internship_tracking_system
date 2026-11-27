import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ฐานข้อมูล: Supabase PostgreSQL (ย้ายจาก Neon 27 พ.ย. 2569 — Neon โควตา Network Transfer เต็ม)
// DATABASE_URL = Transaction pooler (พอร์ต 6543, ?pgbouncer=true) — เหมาะกับ serverless (Vercel)
//   เพราะ pooler ของ Supabase เป็นตัวรวม connection ให้ ไม่กิน connection limit ของ DB
// ส่วนคำสั่ง Prisma CLI (db push / migrate diff) ใช้ DIRECT_URL (พอร์ต 5432) — ดู prisma.config.ts
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});

const prisma = new PrismaClient({
  adapter,
});

export default prisma;
