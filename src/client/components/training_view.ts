// @ts-nocheck
// ===== การแสดงชั่วโมงอบรม ใช้ร่วมกันฝั่งนิสิต (status_all) และฝั่งอาจารย์ (admin_student_detail) =====
// - view(t): แยกข้อมูลแสดงผลจาก TrainingRecord (ชื่อ Check-in / วันที่ / แหล่งที่มา / สถานะ)
// - rowHtml(t, order, opts): แถวตาราง (คอลัมน์เดียวกันทั้ง 2 ฝั่ง: ลำดับ / ชื่อ / ประเภท / ชั่วโมง / แหล่งที่มา / สถานะ / จัดการ)
// - openDetail(t, opts): หน้าต่าง "รายละเอียดการอบรม" (ผู้จัด / ลิงก์ / ตัวอย่าง Certificate กดขยายได้)
// - show / close: หน้าต่างกลาง (ต่อท้าย body) · lightbox รูป Certificate
// CSS: src/css/main.css (.trn-*)
(function () {
  const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const closeHooks = [];

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function parseIsoDate(value) {
    const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
    const dt = value ? new Date(value) : null;
    if (!dt || isNaN(dt.getTime())) return null;
    return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
  }

  function formatRange(startValue, endValue) {
    const a = parseIsoDate(startValue);
    if (!a) return '';
    const b = parseIsoDate(endValue);
    const fmt = (x, withYear = true) => `${x.d} ${MONTHS_SHORT[x.m - 1]}${withYear ? ' ' + (x.y + 543) : ''}`;
    if (!b || (a.y === b.y && a.m === b.m && a.d === b.d)) return fmt(a);
    if (a.y === b.y && a.m === b.m) return `${a.d}–${fmt(b)}`;
    if (a.y === b.y) return `${fmt(a, false)} – ${fmt(b)}`;
    return `${fmt(a)} – ${fmt(b)}`;
  }

  /** ลิงก์ที่กดได้อย่างปลอดภัย (http/https เท่านั้น) */
  function isHttpLink(value) {
    try {
      const u = new URL(String(value || '').trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  // แยกข้อมูลแสดงผลจาก record เดิม (API ไม่มี field วันที่/ช่วงเวลา → อ่านจาก title/note ที่ระบบ Check-in เขียนไว้)
  // title:  "[Check-in กิจกรรมคณะ] <ชื่อกิจกรรม> - <ช่วงที่ 1 (2026-11-13) | ทั้งกิจกรรม>"
  // note:   "บันทึก Check-in หน้างาน (...) โดยพี่จอม เมื่อวันที่ 2026-11-07 ถึง 2026-11-08 (09:00-16:00 น.)"
  function view(t) {
    const rawTitle = String(t.title || '');
    const note = String(t.note || '');
    const isCheckIn = t.source === 'STAFF_IMPORT' && /^\[Check-in[^\]]*\]/i.test(rawTitle);
    const isStudentUpload = !t.source || t.source === 'STUDENT_UPLOAD';

    let title = rawTitle;
    let session = '';
    if (isCheckIn) {
      title = rawTitle.replace(/^\[Check-in[^\]]*\]\s*/i, '');
      const sep = title.lastIndexOf(' - ');
      if (sep > 0) {
        session = title.slice(sep + 3).replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, '').trim();
        title = title.slice(0, sep).trim();
      }
    }

    let dateText = '';
    let timeText = '';
    const noteDate = note.match(/เมื่อวันที่\s+(\d{4}-\d{2}-\d{2})(?:\s*ถึง\s*(\d{4}-\d{2}-\d{2}))?(?:\s*\((\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*น\.\))?/);
    if (noteDate) {
      dateText = formatRange(noteDate[1], noteDate[2]);
      if (noteDate[3]) timeText = `${noteDate[3]}–${noteDate[4]} น.`;
    }
    if (!dateText) dateText = formatRange(t.createdAt);

    const subParts = [];
    if (isCheckIn) {
      if (session) subParts.push(session);
      if (timeText) subParts.push(timeText);
    } else if (isStudentUpload) {
      subParts.push(t.status === 'APPROVED' ? 'อัปโหลดโดยนิสิต · อาจารย์อนุมัติแล้ว' : t.status === 'REJECTED' ? 'อัปโหลดโดยนิสิต · ไม่ผ่านการตรวจ' : 'อัปโหลดโดยนิสิต · รออาจารย์ตรวจ');
      if (String(t.organizer || '').trim()) subParts.push(`ผู้จัด: ${String(t.organizer).trim()}`);
    } else {
      subParts.push(t.source === 'ADMIN_IMPORT' ? 'อาจารย์ประจำวิชาเพิ่มให้' : 'นำเข้าโดยเจ้าหน้าที่คณะ');
    }

    // หมายเหตุที่ระบบเขียนเอง (Check-in) ถูกแยกเป็นวันที่/เวลาแล้ว → แสดงเฉพาะหมายเหตุที่มีความหมายเพิ่ม
    const extraNote = isCheckIn ? '' : note.trim();
    const sourceKey = isCheckIn ? 'CHECKIN' : isStudentUpload ? 'UPLOAD' : 'IMPORT';
    const statusKey = t.status === 'APPROVED' ? 'APPROVED' : t.status === 'REJECTED' ? 'REJECTED' : 'PENDING';
    // รายการเก่าที่ยังไม่มีหน่วยงานผู้จัด/ลิงก์ (T-03)
    const missingEvidence = isStudentUpload && (!String(t.organizer || '').trim() || !isHttpLink(t.certificateLink));
    return { title: title || '-', sub: subParts.join(' · '), dateText: dateText || '-', extraNote, sourceKey, statusKey, isStudentUpload, missingEvidence };
  }

  /** URL รูปของ Certificate: รูปภาพใช้ตรง ๆ, PDF บน Cloudinary → .jpg (หน้าแรก), อื่น ๆ → '' (ใช้ PDF viewer) */
  function certImageUrl(url) {
    const u = String(url || '');
    if (!u) return '';
    if (/.pdf($|[?#])/i.test(u)) return u.includes('cloudinary.com') ? u.replace(/.pdf($|[?#])/i, '.jpg$1') : '';
    return u;
  }

  function typeBadge(t) {
    return t.skillType === 'HARD'
      ? '<span class="trn-pill trn-pill--hard">Hard skill</span>'
      : '<span class="trn-pill trn-pill--soft">Soft skill</span>';
  }

  function sourceChip(t, v) {
    return v.sourceKey === 'CHECKIN'
      ? '<span class="trn-chip trn-chip--blue"><span class="material-icons">verified_user</span>Check-in</span>'
      : v.sourceKey === 'UPLOAD'
      ? '<span class="trn-chip trn-chip--amber"><span class="material-icons">upload_file</span>อัปโหลด Cert</span>'
      : `<span class="trn-chip trn-chip--slate"><span class="material-icons">domain</span>${t.source === 'ADMIN_IMPORT' ? 'อาจารย์เพิ่มให้' : 'นำเข้าโดยคณะ'}</span>`;
  }

  function statusBadge(v) {
    return v.statusKey === 'APPROVED'
      ? '<span class="trn-status trn-status--pass"><span class="material-icons">check</span>ผ่าน</span>'
      : v.statusKey === 'REJECTED'
      ? '<span class="trn-status trn-status--fail"><span class="material-icons">close</span>ไม่ผ่าน</span>'
      : '<span class="trn-status trn-status--wait"><span class="material-icons">schedule</span>รอตรวจ</span>';
  }

  /**
   * แถวตาราง (คอลัมน์เดียวกันทั้งฝั่งนิสิตและอาจารย์)
   * opts.actionsHtml: ปุ่มในคอลัมน์ "จัดการ" (ปุ่มดูรายละเอียดใส่ให้อยู่แล้ว ผ่าน opts.viewOnclick)
   * opts.statusPrefixHtml: ของที่วางหน้าป้ายสถานะ (เช่น checkbox ของอาจารย์ประจำวิชา)
   */
  function rowHtml(t, order, opts = {}) {
    const v = view(t);
    const noteTip = v.extraNote ? ` title="หมายเหตุ: ${esc(v.extraNote)}"` : '';
    const flags = [
      v.extraNote ? `<span class="trn-note-flag"${noteTip}><span class="material-icons">sticky_note_2</span>มีหมายเหตุ</span>` : '',
      v.missingEvidence ? '<span class="trn-note-flag" title="รายการเก่า: ยังไม่มีหน่วยงานผู้จัด/ลิงก์ — ต้องกรอกให้ครบเมื่อแก้ไข"><span class="material-icons">info</span>ยังไม่มีผู้จัด/ลิงก์</span>' : '',
    ].join('');
    const viewBtn = opts.viewOnclick
      ? `<button type="button" class="trn-icon-btn" title="ดูรายละเอียด" aria-label="ดูรายละเอียด" onclick="${opts.viewOnclick}"><span class="material-icons">visibility</span></button>`
      : '';
    return `
      <tr class="trn-row trn-row--${v.statusKey.toLowerCase()}">
        <td class="trn-col-no" data-label="ลำดับ">${order}</td>
        <td class="trn-col-title" data-label="ชื่อกิจกรรม">
          <div class="trn-title"${noteTip}>${esc(v.title)}</div>
          <div class="trn-sub">${esc(v.sub)}${flags}</div>
        </td>
        <td class="trn-col-type" data-label="ประเภท">${typeBadge(t)}</td>
        <td class="trn-col-hours" data-label="ชั่วโมง"><b>${Number(t.hours) || 0}</b> ชม.</td>
        <td class="trn-col-source" data-label="แหล่งที่มา"><div class="trn-source">${sourceChip(t, v)}</div></td>
        <td class="trn-col-status" data-label="สถานะ"><div style="display:inline-flex; align-items:center; gap:8px;">${opts.statusPrefixHtml || ''}${statusBadge(v)}</div></td>
        <td class="trn-col-actions" data-label="จัดการ">
          <div class="trn-actions">${viewBtn}${opts.actionsHtml || ''}</div>
        </td>
      </tr>`;
  }

  // ---------- หน้าต่างกลาง (สร้างครั้งเดียว ต่อท้าย body เพื่อไม่ให้ถูก overflow/transform ของ panel ตัด) ----------
  function getRoot() {
    let root = document.getElementById('trn-modal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'trn-modal-root';
      root.className = 'trn-modal-backdrop';
      root.hidden = true;
      root.addEventListener('click', (e) => { if (e.target === root) close(); });
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const lightbox = document.getElementById('trn-lightbox');
        if (lightbox && !lightbox.hidden) { closeLightbox(); return; }
        if (!root.hidden) close();
      });
      document.body.appendChild(root);
    }
    return root;
  }

  function show(title, bodyHtml, footHtml) {
    const root = getRoot();
    root.innerHTML = `
      <div class="trn-modal" role="dialog" aria-modal="true" aria-labelledby="trn-modal-title">
        <div class="trn-modal-head">
          <h3 id="trn-modal-title">${title}</h3>
          <button type="button" class="trn-icon-btn" aria-label="ปิด" onclick="TrainingView.close()"><span class="material-icons">close</span></button>
        </div>
        <div class="trn-modal-body">${bodyHtml}</div>
        <div class="trn-modal-foot">${footHtml}</div>
      </div>`;
    root.hidden = false;
    document.body.classList.add('trn-modal-open');
  }

  function close() {
    closeLightbox();
    closeHooks.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
    const root = document.getElementById('trn-modal-root');
    if (root) {
      root.hidden = true;
      root.innerHTML = '';
    }
    document.body.classList.remove('trn-modal-open');
  }

  /** ฟังก์ชันที่ต้องทำทุกครั้งที่ปิดหน้าต่าง (เช่น คืนหน่วยความจำของตัวอย่างไฟล์) */
  function onClose(fn) {
    if (typeof fn === 'function') closeHooks.push(fn);
  }

  // ---------- Lightbox: รูปใหญ่บนพื้นหลังสีเทาเข้ม กดพื้นหลัง / ปุ่มปิด / Esc เพื่อปิด ----------
  function openLightbox(src) {
    if (!src) return;
    let box = document.getElementById('trn-lightbox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'trn-lightbox';
      box.className = 'trn-lightbox';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', 'รูป Certificate ขนาดใหญ่');
      box.innerHTML = '<button type="button" class="trn-lightbox-close" aria-label="ปิด"><span class="material-icons">close</span></button><img alt="Certificate" />';
      box.addEventListener('click', (e) => {
        if (e.target === box || e.target.closest('.trn-lightbox-close')) closeLightbox();
      });
      document.body.appendChild(box);
    }
    box.querySelector('img').src = src;
    box.hidden = false;
  }

  function closeLightbox() {
    const box = document.getElementById('trn-lightbox');
    if (box) box.hidden = true;
  }

  // รูปโหลดไม่ขึ้น → เปลี่ยนเป็น PDF viewer (ถ้าเป็น PDF) หรือซ่อนกรอบ
  function previewFallback(imgEl) {
    const box = imgEl.closest('.trn-cert-preview');
    if (!box) return;
    const src = box.getAttribute('data-src') || '';
    if (/.pdf($|[?#])/i.test(src)) {
      box.innerHTML = '';
      const frame = document.createElement('iframe');
      frame.src = src;
      frame.title = 'ตัวอย่างไฟล์ Certificate';
      box.appendChild(frame);
    } else {
      box.style.display = 'none';
    }
  }

  // ---------- รายละเอียดการอบรม (รวมหมายเหตุยาว ๆ ที่ย้ายออกจากตาราง) ----------
  function detailBodyHtml(t) {
    const v = view(t);
    const row = (label, value) => `<div class="trn-detail-row"><div class="trn-detail-label">${label}</div><div class="trn-detail-value">${value}</div></div>`;
    const statusText = v.statusKey === 'APPROVED' ? 'ผ่าน' : v.statusKey === 'REJECTED' ? 'ไม่ผ่าน' : 'รอตรวจ';
    const sourceText = v.sourceKey === 'CHECKIN' ? 'Check-in หน้างาน' : v.sourceKey === 'UPLOAD' ? 'นิสิตอัปโหลด Certificate' : (t.source === 'ADMIN_IMPORT' ? 'อาจารย์ประจำวิชาเพิ่มให้' : 'นำเข้าโดยเจ้าหน้าที่คณะ');
    const certUrl = t.certificateFileUrl || '';
    const safeUrl = esc(certUrl);
    // แสดงเป็นรูป: PDF บน Cloudinary แปลงหน้าแรกเป็น .jpg (วิธีเดียวกับตัวอย่าง CV) → กดรูปเพื่อดูภาพใหญ่
    // ถ้าแปลงเป็นรูปไม่ได้ (ไม่ใช่ Cloudinary / โหลดรูปไม่ขึ้น) → แสดง PDF viewer แทน
    const certImg = certImageUrl(certUrl);
    const certPreview = !certUrl ? '' : `
      <div class="trn-cert">
        <div class="trn-cert-head">
          <span class="trn-detail-label">Certificate</span>
          <a class="trn-file-link" href="${safeUrl}" target="_blank" rel="noopener">เปิดไฟล์ Certificate<span class="material-icons">open_in_new</span></a>
        </div>
        <div class="trn-cert-preview" data-src="${safeUrl}">
          ${certImg
            ? `<button type="button" class="trn-cert-thumb" onclick="TrainingView.openLightbox(this.querySelector('img').src)" aria-label="ดูรูป Certificate ขนาดใหญ่">
                <img src="${esc(certImg)}" alt="ตัวอย่างไฟล์ Certificate" onerror="TrainingView.previewFallback(this)" />
                <span class="trn-cert-zoom"><span class="material-icons">zoom_in</span>คลิกเพื่อดูภาพใหญ่</span>
              </button>`
            : `<iframe src="${safeUrl}" title="ตัวอย่างไฟล์ Certificate" loading="lazy"></iframe>`}
        </div>
      </div>`;
    return `
      ${row('ชื่อกิจกรรม', esc(v.title))}
      ${v.sub ? row('ช่วง / เวลา', esc(v.sub)) : ''}
      ${row('ประเภท', t.skillType === 'HARD' ? 'Hard skill' : 'Soft skill')}
      ${row('ชั่วโมง', `${Number(t.hours) || 0} ชม.`)}
      ${row('วันที่', esc(v.dateText))}
      ${row('แหล่งที่มา', sourceText)}
      ${row('สถานะ', statusText)}
      ${t.note ? row('หมายเหตุ', esc(t.note)) : ''}
      ${v.isStudentUpload || t.organizer ? row('หน่วยงานผู้จัด', esc(t.organizer || '-')) : ''}
      ${isHttpLink(t.certificateLink)
        ? row('ลิงก์ประชาสัมพันธ์ / ลงทะเบียน', `<a class="trn-file-link trn-cert-link" href="${esc(t.certificateLink)}" target="_blank" rel="noopener noreferrer">${esc(t.certificateLink)}<span class="material-icons">open_in_new</span></a>`)
        : (v.isStudentUpload ? row('ลิงก์ประชาสัมพันธ์ / ลงทะเบียน', '-') : '')}
      ${certPreview}`;
  }

  /**
   * เปิดหน้าต่างรายละเอียด
   * opts.extraBodyHtml: ต่อท้ายเนื้อหา (เช่น ช่องหมายเหตุของอาจารย์ประจำวิชา)
   * opts.footHtml: ปุ่มด้านล่าง (ค่าเริ่มต้น = ปุ่มปิด)
   */
  function openDetail(t, opts = {}) {
    show('รายละเอียดการอบรม',
      detailBodyHtml(t) + (opts.extraBodyHtml || ''),
      opts.footHtml || '<button type="button" class="trn-btn trn-btn--ghost" onclick="TrainingView.close()">ปิด</button>');
  }

  window.TrainingView = {
    esc, view, isHttpLink, certImageUrl, rowHtml, detailBodyHtml, openDetail,
    show, close, onClose, openLightbox, closeLightbox, previewFallback,
  };
  // ชื่อเดิมที่หน้าเว็บเรียกผ่าน onclick
  window.openCertificateLightbox = openLightbox;
  window.closeCertificateLightbox = closeLightbox;
  window.certificatePreviewFallback = previewFallback;
})();
