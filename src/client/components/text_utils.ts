// @ts-nocheck
// text_utils.js - helper ข้อความกลางฝั่ง client (escape HTML / หา+แปลงลิงก์ / คัดลอกข้อความ)
// โหลดก่อนสคริปต์ของหน้า (ดู PAGE_SCRIPTS ใน ProfilePage.tsx / StudentDashboardPage.tsx / StatusAllPage.tsx)
// กำหนดใหม่ทุกครั้งที่โหลด (ไม่ใช้ ||) → เปลี่ยนหน้าแบบ SPA แล้วได้เวอร์ชันล่าสุดเสมอ (helper ไม่มี state)

window.IctText = {
  /** escape ข้อความก่อนใส่ลง innerHTML / attribute (กัน XSS) */
  escapeHtml(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /**
   * หา URL (http/https) จากข้อความดิบ → [{ url, index, length }]
   * - ตัดที่ช่องว่าง / < > " ' ` (URL ใน "..." หรือ <...> ไม่พาเครื่องหมายติดไป)
   * - ไม่เอาเครื่องหมายวรรคตอนท้าย เช่น "(https://a.com/x)." → https://a.com/x
   */
  findUrls(text) {
    const out = [];
    const re = /\bhttps?:\/\/[^\s<>"'`]+/gi;
    let m;
    while ((m = re.exec(String(text ?? ''))) !== null) {
      const url = m[0].replace(/[).,;:!?\]]+$/, '');
      if (url.length > 'https://'.length) out.push({ url, index: m.index, length: url.length });
    }
    return out;
  },

  /** URL ที่ไม่ซ้ำในข้อความ */
  extractUrls(text) {
    return Array.from(new Set(window.IctText.findUrls(text).map((u) => u.url)));
  },

  /**
   * ข้อความ → HTML: URL เป็นลิงก์กดได้ (แท็บใหม่) ส่วนอื่น escape เป็น text ล้วน
   * หา URL จากข้อความดิบก่อน แล้ว escape ทีละส่วน → href ไม่มีเศษ entity ติด
   */
  linkify(text) {
    const raw = String(text ?? '');
    const esc = window.IctText.escapeHtml;
    let html = '';
    let pos = 0;
    window.IctText.findUrls(raw).forEach(({ url, index, length }) => {
      html += esc(raw.slice(pos, index));
      html += `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(url)}</a>`;
      pos = index + length;
    });
    return html + esc(raw.slice(pos));
  },

  /**
   * คัดลอกข้อความ: ใช้ Clipboard API ถ้ามี (ต้องเป็น https/localhost)
   * ไม่มี/ล้มเหลว → fallback เป็น textarea + execCommand('copy') → คืน Promise<boolean>
   */
  copyText(text) {
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch (e) {
        return false;
      }
    };
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => fallback());
    }
    return Promise.resolve(fallback());
  },
};
