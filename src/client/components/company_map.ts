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

  /** โหลด Leaflet จาก cdnjs พร้อม SRI (ค่าเดียวกับหน้าต่างปักหมุดใน checklist.ts) */
  loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (window.__ictLeafletLoading) return window.__ictLeafletLoading;
    window.__ictLeafletLoading = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      css.integrity = 'sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw==';
      css.crossOrigin = 'anonymous';
      css.referrerPolicy = 'no-referrer';
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      js.integrity = 'sha512-puJW3E/qXDqYp9IfhAI54BJEaWIfloJ7JWs7OeD5i6ruC9JZL1gERT1wjtwXFlh7CjE7ZJ+/vcRZRkIYIb6p4g==';
      js.crossOrigin = 'anonymous';
      js.referrerPolicy = 'no-referrer';
      js.onload = () => resolve(window.L);
      js.onerror = () => { window.__ictLeafletLoading = null; reject(new Error('โหลดแผนที่ไม่สำเร็จ')); };
      document.head.appendChild(js);
    });
    return window.__ictLeafletLoading;
  },

  /**
   * หน้าต่างดูตำแหน่งสถานประกอบการแบบอ่านอย่างเดียว (อาจารย์ดูหมุดที่นิสิตปักไว้ แก้ไม่ได้)
   * btn = ปุ่มที่มี data-lat, data-lng, data-name, data-address, data-province
   */
  openViewerFromBtn(btn) {
    const d = (btn && btn.dataset) || {};
    window.IctCompanyMap.openViewer({ lat: d.lat, lng: d.lng, name: d.name, address: d.address, province: d.province });
  },

  openViewer(opts) {
    const helper = window.IctCompanyMap;
    const c = helper.coords(opts.lat, opts.lng);
    if (!c) return;
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const gmaps = helper.mapUrl('', c.lat, c.lng);

    let modal = document.getElementById('company-map-viewer');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'company-map-viewer';
      modal.className = 'map-picker-overlay';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'map-viewer-title');
      modal.addEventListener('click', (e) => { if (e.target === modal) helper.closeViewer(); });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('is-open')) helper.closeViewer();
      });
      document.body.appendChild(modal);
    }
    modal.innerHTML = `
      <div class="map-picker">
        <div class="map-picker-head">
          <span class="material-icons" aria-hidden="true">location_on</span>
          <h3 id="map-viewer-title">ตำแหน่งสถานประกอบการ</h3>
          <span class="map-viewer-badge"><span class="material-icons" aria-hidden="true">visibility</span>ดูอย่างเดียว</span>
          <button type="button" class="map-picker-close" aria-label="ปิด" onclick="window.IctCompanyMap.closeViewer()">
            <span class="material-icons" aria-hidden="true">close</span>
          </button>
        </div>
        ${opts.name ? `<div class="map-viewer-name"><span class="material-icons" aria-hidden="true">apartment</span>${esc(opts.name)}</div>` : ''}
        <div id="map-viewer-map" class="map-picker-map"><div class="map-viewer-loading">กำลังโหลดแผนที่...</div></div>
        <div class="map-picker-hint">ตำแหน่งที่นิสิตปักหมุดไว้ (อาจารย์ดูได้อย่างเดียว ไม่สามารถแก้ไขหมุดได้)</div>
        <div class="map-picker-selected">
          <b>ที่อยู่:</b> ${opts.address ? esc(opts.address) : '-'}<br />
          <b>จังหวัด:</b> ${opts.province ? esc(opts.province) : '-'} · <b>พิกัด:</b> ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}
        </div>
        <div class="map-picker-foot">
          <a class="map-picker-gmaps-open map-viewer-gmaps" href="${esc(gmaps)}" target="_blank" rel="noopener noreferrer">
            <span class="material-icons" aria-hidden="true">open_in_new</span>เปิดใน Google Maps
          </a>
          <button type="button" class="map-picker-cancel" onclick="window.IctCompanyMap.closeViewer()">ปิด</button>
        </div>
      </div>`;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    const seq = (window.__ictMapViewerSeq = (window.__ictMapViewerSeq || 0) + 1);
    helper.loadLeaflet().then((L) => {
      // ปิดหรือเปิดหน้าต่างใหม่ไปแล้วระหว่างรอโหลด → ไม่ต้องวาด
      if (seq !== window.__ictMapViewerSeq || !modal.classList.contains('is-open')) return;
      const el = document.getElementById('map-viewer-map');
      if (!el) return;
      el.innerHTML = '';
      const map = L.map(el).setView([c.lat, c.lng], 17);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      }).addTo(map);
      L.marker([c.lat, c.lng], { draggable: false, keyboard: false }).addTo(map);
      window.__ictMapViewer = map;
      setTimeout(() => map.invalidateSize(), 50);
    }).catch(() => {
      const el = document.getElementById('map-viewer-map');
      if (el) el.innerHTML = '<div class="map-viewer-loading">โหลดแผนที่ไม่สำเร็จ ลองกด "เปิดใน Google Maps" แทน</div>';
    });
  },

  closeViewer() {
    const modal = document.getElementById('company-map-viewer');
    if (modal) modal.classList.remove('is-open');
    document.body.style.overflow = '';
    if (window.__ictMapViewer) {
      window.__ictMapViewer.remove();
      window.__ictMapViewer = null;
    }
  },
};
