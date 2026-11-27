// =====================================================================
// รวมเอกสารใบสมัครสหกิจเป็น PDF ไฟล์เดียว (Resume -> Transcript -> Portfolio) ให้เจ้าหน้าที่ส่งต่อบริษัท
// - PDF: คัดลอกทุกหน้า | JPG/PNG: วางบนหน้า A4 ย่อให้พอดี
// - ไฟล์ที่อ่านไม่ได้ (เสีย/ติดรหัส): ใส่หน้าแจ้งแทน ไม่ทำให้ทั้งไฟล์ล้ม
// - หน้าแรกเป็นหน้าสรุปเฉพาะเมื่อมีลิงก์ Portfolio
//   (ฟอนต์มาตรฐานของ PDF ไม่รองรับภาษาไทย -> หน้าสรุป/หน้าแจ้งใช้ข้อความภาษาอังกฤษ + ตัดอักขระที่พิมพ์ไม่ได้)
// =====================================================================
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

export interface CoopPdfPart {
  label: string; // เช่น "Resume"
  buffer: Buffer | Uint8Array | null; // null = ดาวน์โหลดไม่สำเร็จ
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 36;

/** ข้อความที่ฟอนต์มาตรฐาน (WinAnsi) เขียนได้ */
export function pdfSafeText(s: string): string {
  return String(s || "").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim();
}

export function detectFileKind(buf: Uint8Array): "pdf" | "png" | "jpg" | "unknown" {
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "pdf"; // %PDF
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  // PDF บางไฟล์มีขยะนำหน้า %PDF (อนุญาตใน 1024 ไบต์แรกตามสเปก)
  const head = Buffer.from(buf.subarray(0, 1024)).toString("latin1");
  if (head.includes("%PDF-")) return "pdf";
  return "unknown";
}

function drawLines(page: PDFPage, font: PDFFont, lines: { text: string; size: number; bold?: boolean }[], boldFont: PDFFont) {
  let y = A4[1] - MARGIN - 20;
  for (const l of lines) {
    const f = l.bold ? boldFont : font;
    const text = pdfSafeText(l.text);
    // ตัดบรรทัดยาว (เช่น URL)
    const maxWidth = A4[0] - MARGIN * 2;
    let rest = text;
    do {
      let n = rest.length;
      while (n > 1 && f.widthOfTextAtSize(rest.slice(0, n), l.size) > maxWidth) n--;
      page.drawText(rest.slice(0, n), { x: MARGIN, y, size: l.size, font: f, color: rgb(0.1, 0.12, 0.2) });
      rest = rest.slice(n);
      y -= l.size + 8;
    } while (rest);
    y -= 4;
  }
}

/**
 * รวมไฟล์ตามลำดับที่ส่งมา
 * cover = ข้อมูลหน้าสรุป (ใส่เมื่อมีลิงก์ Portfolio) — ข้อความภาษาไทยจะถูกตัดออก จึงส่งรหัสนิสิต/ลิงก์เป็นหลัก
 */
export async function mergeCoopDocuments(
  parts: CoopPdfPart[],
  cover?: { studentCode: string; portfolioLink: string | null }
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);

  if (cover?.portfolioLink) {
    const page = out.addPage(A4);
    drawLines(page, font, [
      { text: "Co-op Application Documents", size: 18, bold: true },
      { text: `Student ID: ${cover.studentCode}`, size: 12 },
      { text: `Included: ${parts.map((p) => p.label).join(", ")}`, size: 11 },
      { text: "Portfolio link:", size: 12, bold: true },
      { text: cover.portfolioLink, size: 11 },
    ], bold);
  }

  for (const part of parts) {
    const notice = (reason: string) => {
      const page = out.addPage(A4);
      drawLines(page, font, [
        { text: `${part.label}: could not be merged`, size: 14, bold: true },
        { text: reason, size: 11 },
        { text: "Please download this file separately from the system.", size: 11 },
      ], bold);
    };
    if (!part.buffer) {
      notice("The file could not be downloaded.");
      continue;
    }
    const buf = part.buffer instanceof Uint8Array ? part.buffer : new Uint8Array(part.buffer);
    const kind = detectFileKind(buf);
    try {
      if (kind === "pdf") {
        const src = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      } else if (kind === "png" || kind === "jpg") {
        const img = kind === "png" ? await out.embedPng(buf) : await out.embedJpg(buf);
        const page = out.addPage(A4);
        const scale = Math.min((A4[0] - MARGIN * 2) / img.width, (A4[1] - MARGIN * 2) / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: (A4[0] - w) / 2, y: A4[1] - MARGIN - h, width: w, height: h });
      } else {
        notice("Unsupported file type (only PDF, JPG, PNG).");
      }
    } catch {
      notice("The file is damaged or password-protected.");
    }
  }

  if (out.getPageCount() === 0) out.addPage(A4);
  return out.save();
}
