/**
 * ดึงพิกัด (lat/lng) จากลิงก์ Google Maps หรือพิกัดที่คัดลอกมาจาก Google Maps
 * ใช้ในหน้าต่างปักหมุดสถานประกอบการ (Checklist) — แก้ปัญหาบริษัทหลายสาขาที่ค้นด้วยชื่อแล้วได้ผิดที่
 */

export interface LatLng {
  lat: number;
  lng: number;
}

function validLatLng(lat: number, lng: number): LatLng | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

const NUM = "(-?\\d{1,3}(?:\\.\\d+)?)";
const PAIR = new RegExp(`^\\s*${NUM}\\s*,\\s*${NUM}\\s*$`);

/** พิกัดแบบข้อความ "13.7563, 100.5018" (คลิกขวาที่หมุดใน Google Maps แล้วคัดลอก) */
export function parseCoordinateText(text: string): LatLng | null {
  const m = String(text || "").match(PAIR);
  return m ? validLatLng(Number(m[1]), Number(m[2])) : null;
}

/**
 * พิกัดจาก URL ของ Google Maps แบบเต็ม (ไม่ต้องเรียกเน็ต) เรียงตามความแม่นยำ:
 * 1) !3d<lat>!4d<lng> = ตำแหน่งหมุดของสถานที่จริง
 * 2) ?q= / query= / ll= / destination= ที่เป็นพิกัด
 * 3) /place/<lat>,<lng> หรือ /search/<lat>,<lng>
 * 4) @<lat>,<lng> = จุดกึ่งกลางของจอแผนที่ (ใช้เป็นทางเลือกสุดท้าย)
 */
export function parseGoogleMapsUrl(rawUrl: string): LatLng | null {
  let decoded = String(rawUrl || "");
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // ลิงก์มี % ที่ไม่ถูกต้อง → ใช้ข้อความเดิม
  }

  const pin = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (pin) {
    const p = validLatLng(Number(pin[1]), Number(pin[2]));
    if (p) return p;
  }

  try {
    const url = new URL(rawUrl);
    for (const key of ["q", "query", "ll", "destination", "center"]) {
      const value = url.searchParams.get(key);
      const p = value ? parseCoordinateText(value.replace(/^loc:/, "")) : null;
      if (p) return p;
    }
  } catch {
    // ไม่ใช่ URL ที่ถูกต้อง → ลองแบบอื่นต่อ
  }

  const path = decoded.match(new RegExp(`/(?:place|search|dir)/${NUM},\\s*${NUM}`));
  if (path) {
    const p = validLatLng(Number(path[1]), Number(path[2]));
    if (p) return p;
  }

  const at = decoded.match(new RegExp(`@${NUM},${NUM}`));
  if (at) return validLatLng(Number(at[1]), Number(at[2]));

  return null;
}

const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl"]);

function isGoogleHost(host: string): boolean {
  const h = host.toLowerCase();
  return /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(h);
}

/** เฉพาะลิงก์ของ Google เท่านั้น (กันใช้ endpoint นี้ไปเรียกเว็บอื่นแทนเซิร์ฟเวอร์) */
export function isAllowedMapsHost(host: string): boolean {
  return SHORT_HOSTS.has(host.toLowerCase()) || isGoogleHost(host);
}

/**
 * ลิงก์ย่อ (maps.app.goo.gl/…) ต้องตามการ redirect ไปหา URL เต็มก่อน
 * ตามได้ไม่เกิน 5 ครั้ง และทุกปลายทางต้องเป็นโดเมนของ Google
 */
export async function resolveGoogleMapsLink(
  input: string,
  fetchImpl: typeof fetch = fetch
): Promise<LatLng | null> {
  const text = String(input || "").trim();
  const direct = parseCoordinateText(text);
  if (direct) return direct;

  let current: URL;
  try {
    current = new URL(text);
  } catch {
    return null;
  }

  for (let hop = 0; hop <= 5; hop++) {
    if (current.protocol !== "https:" && current.protocol !== "http:") return null;
    if (!isAllowedMapsHost(current.hostname)) return null;

    // หน้ายินยอมคุกกี้ของ Google → URL จริงอยู่ใน ?continue=
    const cont = current.hostname.startsWith("consent.") ? current.searchParams.get("continue") : null;
    if (cont) {
      try {
        current = new URL(cont);
        continue;
      } catch {
        return null;
      }
    }

    const parsed = parseGoogleMapsUrl(current.toString());
    if (parsed) return parsed;
    // ยิงเน็ตเฉพาะลิงก์ย่อ — ลิงก์ google.com แบบเต็มที่ไม่มีพิกัดในตัว โหลดหน้าไปก็ไม่ได้พิกัด
    if (!SHORT_HOSTS.has(current.hostname.toLowerCase())) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let location: string | null = null;
    try {
      const res = await fetchImpl(current.toString(), { method: "GET", redirect: "manual", signal: controller.signal });
      location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      await res.body?.cancel().catch(() => undefined); // ไม่อ่านเนื้อหา → ปิด stream คืน connection
    } finally {
      clearTimeout(timer);
    }
    if (!location) return null;
    current = new URL(location, current);
  }
  return null;
}
