// @ts-nocheck
// company_map.js - helper กลางเรื่องที่อยู่/แผนที่สถานประกอบการ
// ใช้ร่วมกันระหว่างหน้า Checklist (checklist.js) และ Student Dashboard (dashboard.js)
// ต้องโหลดก่อนสคริปต์ของหน้า (ดู PAGE_SCRIPTS ใน ChecklistPage.tsx / StudentDashboardPage.tsx)
// ไม่ประกาศ const/let ระดับบนสุด เพื่อให้โหลดซ้ำได้โดยไม่ error
// กำหนดใหม่ทุกครั้งที่โหลด (ไม่ใช้ ||) → เปลี่ยนหน้าแบบ SPA แล้วได้เวอร์ชันล่าสุดเสมอ (helper ไม่มี state)

window.IctCompanyMap = {
  /** ที่อยู่จริงหรือไม่ — ค่าว่าง, "-", "รอตรวจสอบที่อยู่...", "รอระบุที่อยู่" ถือว่ายังไม่มีที่อยู่ */
  hasRealAddress(address) {
    const v = String(address || '').trim();
    return v !== '' && v !== '-' && !/^รอ(ตรวจสอบ|ระบุ)ที่อยู่/.test(v);
  },

  /** พิกัดที่ใช้ได้ หรือ null — รับเฉพาะตัวเลข/สตริงตัวเลขทั้งก้อน และอยู่ในช่วง lat ±90, lng ±180 */
  coords(lat, lng) {
    const num = (v) => {
      if (typeof v === 'number') return v;
      if (typeof v !== 'string' || v.trim() === '') return NaN;
      return Number(v); // "13.7abc" → NaN (ต่างจาก parseFloat)
    };
    const la = num(lat);
    const ln = num(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
    if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
    return { lat: la, lng: ln };
  },

  /**
   * ลิงก์ Google Maps: มีพิกัด → lat,lng / ไม่มีพิกัด → ค้นหาด้วย (ชื่อบริษัท +) ที่อยู่ / ไม่มีอะไรเลย → ''
   * name ใส่เมื่ออยากให้ค้นหาชื่อบริษัทร่วมด้วย (เช่น Dashboard)
   */
  mapUrl(address, lat, lng, name) {
    const base = 'https://www.google.com/maps/search/?api=1&query=';
    const c = window.IctCompanyMap.coords(lat, lng);
    if (c) return `${base}${c.lat},${c.lng}`;
    const parts = [String(name || '').trim()];
    if (window.IctCompanyMap.hasRealAddress(address)) parts.push(String(address).trim());
    const query = parts.filter(Boolean).join(' ');
    return query ? base + encodeURIComponent(query) : '';
  },
};
