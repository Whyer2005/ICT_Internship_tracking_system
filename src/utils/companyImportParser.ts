import * as xlsx from "xlsx";

/** ข้อมูลสถานประกอบการ 1 แถวที่อ่านได้จากไฟล์ Excel / CSV */
export interface ImportedCompanyRow {
  rowNumber: number;
  nameTh: string;
  nameEn: string;
  province: string;
  address: string;
  hrContactName: string;
  hrPhone: string;
  hrEmail: string;
  recommendedPositions: string;
}

export type CompanyImportStatus = "READY" | "EXISTING" | "DUPLICATE_IN_FILE";

export interface CompanyImportItem extends ImportedCompanyRow {
  status: CompanyImportStatus;
  /** ชื่อบริษัทใน Master Data ที่ตรงกัน (กรณี EXISTING) */
  existingName?: string;
}

type CompanyField = Exclude<keyof ImportedCompanyRow, "rowNumber">;

export const COMPANY_FIELDS: CompanyField[] = [
  "nameTh",
  "nameEn",
  "province",
  "address",
  "hrContactName",
  "hrPhone",
  "hrEmail",
  "recommendedPositions",
];

/** ชื่อบริษัทสำหรับเทียบซ้ำ: ตัดช่องว่างทั้งหมด + ตัวพิมพ์เล็ก (ตรงกับ normalizeName ใน adminRoutes) */
export function normalizeCompanyName(name: string): string {
  return String(name || "").replace(/\s+/g, "").toLowerCase();
}

/**
 * จับคู่หัวคอลัมน์ → ฟิลด์ (เช็กเป็นลำดับ: ฟิลด์ที่เฉพาะเจาะจงก่อน ชื่อบริษัททั่วไปเป็นลำดับสุดท้าย)
 * เช่น "เบอร์โทร HR" ต้องเป็น hrPhone ไม่ใช่ hrContactName, "ชื่อผู้ติดต่อ" ต้องไม่ถูกนับเป็นชื่อบริษัท
 */
export function detectCompanyField(header: string): CompanyField | null {
  const h = String(header || "").replace(/\s+/g, "").toLowerCase();
  if (!h) return null;
  if (/อีเมล|อีเมล์|email|e-mail|mail/.test(h)) return "hrEmail";
  // "tel" ต้องอยู่ต้นคำ (กัน "Hotel" ถูกนับเป็นเบอร์โทร)
  if (/โทร|เบอร์|phone|mobile|มือถือ|^tel/.test(h)) return "hrPhone";
  // "ตำแหน่งผู้ติดต่อ" เป็นตำแหน่งของบุคคล ไม่ใช่ตำแหน่งงานที่รับ → ไม่นำเข้า
  if (/ตำแหน่ง|position/.test(h) && /ผู้ติดต่อ|ผู้ประสานงาน|contact/.test(h)) return null;
  if (/ผู้ติดต่อ|ผู้ประสานงาน|contact|^hr/.test(h)) return "hrContactName";
  if (/ตำแหน่ง|position|job/.test(h)) return "recommendedPositions";
  if (/จังหวัด|province/.test(h)) return "province";
  if (/ที่อยู่|ที่ตั้ง|address/.test(h)) return "address";
  if (/อังกฤษ|english|nameen|^en$|\(en\)|eng/.test(h)) return "nameEn";
  if (/ชื่อ|บริษัท|สถานประกอบการ|หน่วยงาน|องค์กร|company|name/.test(h)) return "nameTh";
  return null;
}

function cleanCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).replace(/\s+/g, " ").trim();
}

/**
 * .xlsx (zip "PK") / .xls (OLE D0 CF 11 E0) → อ่านแบบ buffer ตามปกติ
 * ไฟล์ข้อความ (CSV) → ถอดรหัสเป็น UTF-8 เอง เพราะ xlsx อ่าน CSV ที่ไม่มี BOM เป็น latin1 ทำให้ภาษาไทยเพี้ยน
 */
function readWorkbook(buffer: Buffer): xlsx.WorkBook {
  const isZip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isOle = buffer.length >= 4 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
  if (isZip || isOle) return xlsx.read(buffer, { type: "buffer" });
  const text = buffer.toString("utf8").replace(/^﻿/, "");
  return xlsx.read(text, { type: "string" });
}

/** อ่านแผ่นงานแรกของไฟล์ → รายการบริษัท (ข้ามแถวที่ไม่มีชื่อบริษัท) */
export function parseCompanySpreadsheet(buffer: Buffer): ImportedCompanyRow[] {
  const workbook = readWorkbook(buffer);
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error("ไม่พบแผ่นงาน (Sheet) ในไฟล์ที่อัปโหลด");
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (rawRows.length === 0) {
    throw new Error("ไม่พบข้อมูลในไฟล์ หรือไฟล์ว่างเปล่า");
  }

  // หัวคอลัมน์แรกที่ตรงกับฟิลด์ได้สิทธิ์ (คอลัมน์ซ้ำทีหลังไม่ทับ)
  const fieldToHeader = new Map<CompanyField, string>();
  for (const header of Object.keys(rawRows[0])) {
    const field = detectCompanyField(header);
    if (field && !fieldToHeader.has(field)) fieldToHeader.set(field, header);
  }
  if (!fieldToHeader.has("nameTh")) {
    throw new Error('ไม่พบคอลัมน์ชื่อสถานประกอบการ (เช่น "ชื่อบริษัท" หรือ "ชื่อสถานประกอบการ")');
  }

  const rows: ImportedCompanyRow[] = [];
  rawRows.forEach((raw, i) => {
    const row = { rowNumber: i + 2 } as ImportedCompanyRow; // แถว 1 = หัวตาราง
    for (const field of COMPANY_FIELDS) {
      const header = fieldToHeader.get(field);
      row[field] = header ? cleanCell(raw[header]) : "";
    }
    // เบอร์ที่ Excel เก็บเป็นตัวเลขจะเสียเลข 0 นำหน้า (0812345678 → 812345678) → เติมคืนเฉพาะเลข 8–9 หลัก (เบอร์ไทย)
    const phoneHeader = fieldToHeader.get("hrPhone");
    if (phoneHeader && typeof raw[phoneHeader] === "number" && /^[1-9]\d{7,8}$/.test(row.hrPhone)) {
      row.hrPhone = `0${row.hrPhone}`;
    }
    if (row.nameTh) rows.push(row);
  });
  return rows;
}

/** ไฟล์ตัวอย่าง .xlsx สำหรับนำเข้าบริษัท (สร้างสดทุกครั้ง ไม่ต้องเก็บไฟล์ไว้ใน public/) */
export function buildCompanyImportTemplate(): Buffer {
  const rows = [
    ["ชื่อบริษัท", "ชื่อภาษาอังกฤษ", "จังหวัด", "ที่อยู่", "ผู้ติดต่อ", "เบอร์โทร", "อีเมล", "ตำแหน่งที่รับ"],
    ["บริษัท ตัวอย่างซอฟต์แวร์ จำกัด", "Example Software Co., Ltd.", "กรุงเทพมหานคร", "99 ถนนพหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพมหานคร 10900", "คุณสมชาย ใจดี", "02-123-4567", "hr@example-software.co.th", "Software Developer / Tester"],
    ["บริษัท เน็ตเวิร์คตัวอย่าง จำกัด", "Example Network Co., Ltd.", "เชียงใหม่", "123 ถนนห้วยแก้ว ตำบลสุเทพ อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50200", "คุณสมหญิง รักงาน", "053-222-333", "contact@example-network.co.th", "Network Engineer / IT Support"],
    ["สำนักงานตัวอย่างเทคโนโลยีดิจิทัล", "", "พะเยา", "19 หมู่ 2 ตำบลแม่กา อำเภอเมืองพะเยา จังหวัดพะเยา 56000", "ฝ่ายทรัพยากรบุคคล", "054-466-666", "", "GIS Specialist"],
  ];
  const sheet = xlsx.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [34, 28, 16, 60, 20, 14, 30, 30].map((wch) => ({ wch }));
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, sheet, "บริษัท");
  return xlsx.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** จัดสถานะแต่ละแถว: ใหม่ / มีใน Master Data แล้ว / ซ้ำกันเองในไฟล์ */
export function classifyCompanyImport(
  rows: ImportedCompanyRow[],
  existing: { nameTh: string; nameEn?: string }[]
): CompanyImportItem[] {
  const existingByName = new Map<string, string>();
  for (const c of existing) {
    const th = normalizeCompanyName(c.nameTh);
    if (th) existingByName.set(th, c.nameTh);
    const en = normalizeCompanyName(c.nameEn || "");
    if (en && en !== "-") existingByName.set(en, c.nameTh);
  }

  const seen = new Set<string>();
  return rows.map((row) => {
    const key = normalizeCompanyName(row.nameTh);
    const existingName = existingByName.get(key);
    if (existingName) return { ...row, status: "EXISTING" as const, existingName };
    if (seen.has(key)) return { ...row, status: "DUPLICATE_IN_FILE" as const };
    seen.add(key);
    return { ...row, status: "READY" as const };
  });
}
