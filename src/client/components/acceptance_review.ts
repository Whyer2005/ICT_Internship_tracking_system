// @ts-nocheck
// acceptance_review.js - ตรวจ/อนุมัติ "แบบตอบรับจากสถานประกอบการ" ของอาจารย์ที่ปรึกษา
// - submit(): ส่งผลไป POST /api/advisor/documents/review-acceptance (ใช้ร่วมกับหน้า Advisor Checklist Review)
// - open(): Lightbox ตรวจเอกสาร + ผล AI OCR + อนุมัติ/ไม่อนุมัติ (หน้า Advisor Dashboard)
// ไม่ประกาศ const/let ระดับบนสุด เพื่อให้โหลดซ้ำแบบ SPA ได้โดยไม่ error (แบบเดียวกับ company_map.js)

window.IctAcceptanceReview = {
  /** ส่งผลตรวจแบบตอบรับ → { ok, message } (ไม่ throw) */
  async submit(studentId, status, note) {
    try {
      const res = await fetch('/api/advisor/documents/review-acceptance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, status, note: note || '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) return { ok: true, message: data.message || 'บันทึกผลเรียบร้อยแล้ว' };
      return { ok: false, message: data.message || 'บันทึกไม่สำเร็จ' };
    } catch (err) {
      console.error('review-acceptance error:', err);
      return { ok: false, message: 'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่' };
    }
  },

  esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  },

  /** toast มุมขวาล่าง */
  toast(message, type) {
    let host = document.getElementById('acr-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'acr-toast-host';
      host.className = 'acr-toast-host';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = `acr-toast acr-toast--${type || 'ok'}`;
    el.innerHTML = `<span class="material-icons" aria-hidden="true">${type === 'error' ? 'error' : 'check_circle'}</span><span>${window.IctAcceptanceReview.esc(message)}</span>`;
    host.appendChild(el);
    setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 300); }, 4200);
  },

  /** ชนิดไฟล์จากชื่อไฟล์/URL: pdf | image | other */
  fileKind(name, url) {
    const s = `${name || ''} ${String(url || '').split('?')[0]}`.toLowerCase();
    if (/\.pdf\b/.test(s)) return 'pdf';
    if (/\.(png|jpe?g|gif|webp|bmp)\b/.test(s)) return 'image';
    return 'other';
  },

  fmtDateTime(v) {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' น.';
  },

  STATUS_LABEL: {
    WAITING_ADVISOR_APPROVAL: ['รออาจารย์ที่ปรึกษาตรวจประเมิน', 'wait'],
    ADVISOR_APPROVED: ['อาจารย์ที่ปรึกษาอนุมัติแล้ว · รอเจ้าหน้าที่ยืนยัน', 'ok'],
    ACCEPTED: ['ยืนยันรับเข้าฝึกงานแล้ว', 'ok'],
    REJECTED: ['ไม่อนุมัติ / บริษัทปฏิเสธ', 'bad'],
  },

  /** การ์ดผล AI OCR — ใช้ field wf.companyResponseOcr ({ status, result, confidence 0–1, reasons[], warnings[] }) */
  ocrCardHtml(ocr) {
    const esc = window.IctAcceptanceReview.esc;
    if (!ocr || ocr.status !== 'DONE') {
      const why = ocr && ocr.status === 'ERROR' ? 'วิเคราะห์ไม่สำเร็จ' : ocr && ocr.status === 'UNAVAILABLE' ? 'ระบบ OCR ไม่พร้อมใช้งานตอนอัปโหลด' : '';
      return `
        <div class="acr-ocr acr-ocr--none">
          <div class="acr-ocr-head"><span class="material-icons" aria-hidden="true">smart_toy</span>ผลวิเคราะห์ AI OCR</div>
          <div class="acr-ocr-empty">ยังไม่มีผลวิเคราะห์${why ? ` <small>(${esc(why)})</small>` : ''}</div>
          <div class="acr-ocr-note">กรุณาตรวจจากเอกสารด้านซ้ายโดยตรง</div>
        </div>`;
    }
    const conf = Number(ocr.confidence);
    const hasConf = Number.isFinite(conf);
    const pct = hasConf ? Math.max(0, Math.min(100, Math.round(conf * 100))) : null;
    let tone = ocr.result === 'ACCEPTED' ? 'ok' : ocr.result === 'REJECTED' ? 'bad' : 'warn';
    if (hasConf && pct < 60) tone = 'warn';
    const label = ocr.result === 'ACCEPTED' ? 'บริษัทตอบรับ' : ocr.result === 'REJECTED' ? 'บริษัทปฏิเสธ' : 'ไม่แน่ใจ';
    const reasons = (Array.isArray(ocr.reasons) ? ocr.reasons : []).filter(Boolean);
    const warnings = (Array.isArray(ocr.warnings) ? ocr.warnings : []).filter(Boolean);
    // progress ring: r=26 → เส้นรอบวง ≈ 163.4
    const circ = 2 * Math.PI * 26;
    const dash = hasConf ? (circ * pct) / 100 : 0;
    return `
      <div class="acr-ocr acr-ocr--${tone}">
        <div class="acr-ocr-head"><span class="material-icons" aria-hidden="true">smart_toy</span>ผลวิเคราะห์ AI OCR</div>
        <div class="acr-ocr-main">
          <svg class="acr-ring" viewBox="0 0 64 64" role="img" aria-label="ความมั่นใจ ${hasConf ? pct + '%' : 'ไม่ทราบ'}">
            <circle cx="32" cy="32" r="26" class="acr-ring-bg"></circle>
            ${dash > 0 ? `<circle cx="32" cy="32" r="26" class="acr-ring-fg" stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 32 32)"></circle>` : ''}
            <text x="32" y="37" text-anchor="middle" class="acr-ring-text">${hasConf ? pct + '%' : '-'}</text>
          </svg>
          <div class="acr-ocr-verdict">
            <small>ผลคาดการณ์</small>
            <b>${label}</b>
            <span>ความมั่นใจ ${hasConf ? pct + '%' : '-'}${hasConf && pct < 60 ? ' · ต่ำ ควรตรวจเอง' : ''}</span>
          </div>
        </div>
        ${reasons.length ? `<ul class="acr-ocr-reasons">${reasons.slice(0, 3).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
        ${warnings.length ? `<div class="acr-ocr-warn"><span class="material-icons" aria-hidden="true">warning</span>${esc(warnings[0])}</div>` : ''}
        <div class="acr-ocr-note">ผล AI เป็นข้อเสนอแนะเบื้องต้น โปรดตรวจเอกสารก่อนยืนยันทุกครั้ง</div>
      </div>`;
  },

  docPaneHtml(wf) {
    const A = window.IctAcceptanceReview;
    const esc = A.esc;
    const url = wf.companyResponseFileUrl;
    const kind = A.fileKind(wf.companyResponseFileName, url);
    const fallback = `
      <div class="acr-doc-fallback">
        <span class="material-icons" aria-hidden="true">description</span>
        <p>ไม่สามารถแสดงตัวอย่างไฟล์นี้ในหน้าต่างได้</p>
        <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">เปิดไฟล์ในแท็บใหม่</a>
      </div>`;
    // PDF บน Cloudinary: ขอเป็นรูปหน้าแรก (.pdf → .jpg แบบเดียวกับพรีวิว CV ใน cv_previews.ts)
    // แสดงเป็นหน้ากระดาษพอดีกรอบ ถ้ารูปโหลดไม่ได้ → กลับไปใช้ตัวแสดง PDF ของ browser
    const pdfFrame = `<iframe class="acr-doc-frame" src="${esc(url)}#navpanes=0&pagemode=none&view=Fit" title="แบบตอบรับจากสถานประกอบการ"></iframe>`;
    const pdfAsImage = kind === 'pdf' && /cloudinary\.com/i.test(url) && /\.pdf(\?|$)/i.test(url);
    const imgUrl = kind === 'image' ? url : pdfAsImage ? url.replace(/\.pdf(\?|$)/i, '.jpg$1') : '';
    let body = fallback;
    if (imgUrl) {
      body = `<div class="acr-doc-imgwrap" id="acr-imgwrap"><img id="acr-img" class="acr-doc-img" src="${esc(imgUrl)}" alt="แบบตอบรับจากสถานประกอบการ" /></div>`;
    } else if (kind === 'pdf') {
      body = pdfFrame;
    }
    const showZoom = Boolean(imgUrl);
    return `
      <div class="acr-doc-bar">
        <span class="acr-doc-name" title="${esc(wf.companyResponseFileName || '')}">
          <span class="material-icons" aria-hidden="true">${kind === 'pdf' ? 'picture_as_pdf' : kind === 'image' ? 'image' : 'insert_drive_file'}</span>
          ${esc(wf.companyResponseFileName || 'ไฟล์แบบตอบรับ')}
        </span>
        <div class="acr-doc-tools">
          ${showZoom ? `
            <button type="button" class="acr-tool" data-zoom="-1" aria-label="ย่อ"><span class="material-icons" aria-hidden="true">zoom_out</span></button>
            <button type="button" class="acr-tool" data-zoom="0" aria-label="พอดีกรอบ"><span class="material-icons" aria-hidden="true">fit_screen</span></button>
            <button type="button" class="acr-tool" data-zoom="1" aria-label="ขยาย"><span class="material-icons" aria-hidden="true">zoom_in</span></button>` : ''}
          <a class="acr-tool" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="เปิดในแท็บใหม่" aria-label="เปิดในแท็บใหม่"><span class="material-icons" aria-hidden="true">open_in_new</span></a>
          <a class="acr-tool" href="${esc(url)}" download="${esc(wf.companyResponseFileName || '')}" title="ดาวน์โหลด" aria-label="ดาวน์โหลด"><span class="material-icons" aria-hidden="true">download</span></a>
        </div>
      </div>
      <div class="acr-doc-body" data-fallback="${esc(pdfAsImage ? pdfFrame : fallback)}">${body}</div>`;
  },

  /**
   * เปิด Lightbox ตรวจแบบตอบรับ
   * opts: { studentId, onDone(status, message) }
   */
  async open(opts) {
    const A = window.IctAcceptanceReview;
    const esc = A.esc;
    A.close(true);

    const overlay = document.createElement('div');
    overlay.id = 'acr-overlay';
    overlay.className = 'acr-overlay';
    overlay.innerHTML = `
      <div class="acr-modal" role="dialog" aria-modal="true" aria-labelledby="acr-title" tabindex="-1">
        <div class="acr-head">
          <div class="acr-head-text">
            <h2 id="acr-title">ตรวจแบบตอบรับ</h2>
            <p id="acr-sub">กำลังโหลดข้อมูล...</p>
          </div>
          <button type="button" class="acr-close" data-act="close" aria-label="ปิด"><span class="material-icons" aria-hidden="true">close</span></button>
        </div>
        <div class="acr-body" id="acr-body"><div class="acr-loading"><span class="material-icons acr-spin" aria-hidden="true">autorenew</span> กำลังโหลด...</div></div>
      </div>`;
    document.body.appendChild(overlay);

    const st = {
      overlay,
      studentId: opts.studentId,
      onDone: opts.onDone,
      prevFocus: document.activeElement,
      prevOverflow: document.body.style.overflow,
      choice: null,
      busy: false,
      zoom: 1,
    };
    window.__acrState = st;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => overlay.classList.add('is-open'));

    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) A.requestClose(); });
    st.keyHandler = (e) => A.onKey(e);
    document.addEventListener('keydown', st.keyHandler, true);
    overlay.querySelector('[data-act="close"]').addEventListener('click', () => A.requestClose());
    overlay.querySelector('.acr-modal').focus();

    // โหลดข้อมูลแบบตอบรับจาก API เดิมของหน้า Checklist Review
    let data;
    try {
      const res = await fetch(`/api/advisor/students/${encodeURIComponent(opts.studentId)}/checklist`);
      data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'โหลดข้อมูลไม่สำเร็จ');
    } catch (err) {
      if (window.__acrState !== st) return;
      overlay.querySelector('#acr-sub').textContent = '';
      overlay.querySelector('#acr-body').innerHTML = `<div class="acr-loading acr-loading--err"><span class="material-icons" aria-hidden="true">error</span> ${esc(err.message || 'โหลดข้อมูลไม่สำเร็จ')}</div>`;
      return;
    }
    if (window.__acrState !== st) return;

    const wf = data.acceptanceWorkflow;
    const stu = data.student || {};
    st.wf = wf;
    overlay.querySelector('#acr-title').textContent = `ตรวจแบบตอบรับ — ${stu.nameTh || ''} (${stu.studentCode || ''})`;
    const uploaded = wf ? A.fmtDateTime(wf.companyResponseUploadedAt) : '';
    overlay.querySelector('#acr-sub').innerHTML = wf
      ? `<span class="material-icons" aria-hidden="true">apartment</span>${esc(wf.companyName || 'สถานประกอบการ')}${uploaded ? ` <span class="acr-dot">·</span> อัปโหลดเมื่อ ${esc(uploaded)}` : ''}`
      : '';

    if (!wf || !wf.companyResponseFileUrl) {
      overlay.querySelector('#acr-body').innerHTML = '<div class="acr-loading">ไม่พบไฟล์แบบตอบรับของนิสิตคนนี้</div>';
      return;
    }

    const statusInfo = A.STATUS_LABEL[wf.companyResponseStatus] || [wf.companyResponseStatus || 'ไม่ทราบสถานะ', 'wait'];
    const reviewable = Boolean(data.canReview) && wf.companyResponseStatus === 'WAITING_ADVISOR_APPROVAL';

    overlay.querySelector('#acr-body').innerHTML = `
      <section class="acr-doc" aria-label="เอกสารที่บริษัทเซ็น">${A.docPaneHtml(wf)}</section>
      <aside class="acr-side" aria-label="แผงตัดสินใจ">
        ${A.ocrCardHtml(wf.companyResponseOcr)}
        <div class="acr-status acr-status--${statusInfo[1]}"><span class="material-icons" aria-hidden="true">${statusInfo[1] === 'ok' ? 'task_alt' : statusInfo[1] === 'bad' ? 'block' : 'hourglass_top'}</span>${esc(statusInfo[0])}</div>
        ${reviewable ? `
          <fieldset class="acr-choices">
            <legend>ผลการตรวจ</legend>
            <label class="acr-choice acr-choice--ok">
              <input type="radio" name="acr-choice" value="APPROVED" />
              <span class="material-icons" aria-hidden="true">check_circle</span>
              <span class="acr-choice-text"><b>อนุมัติแบบตอบรับ</b><small>ส่งต่อเจ้าหน้าที่คณะเพื่อออกหนังสือส่งตัว</small></span>
            </label>
            <label class="acr-choice acr-choice--bad">
              <input type="radio" name="acr-choice" value="REJECTED" />
              <span class="material-icons" aria-hidden="true">cancel</span>
              <span class="acr-choice-text"><b>ไม่อนุมัติ / บริษัทปฏิเสธ</b><small>จะย้ายเข้า Archive และปลดล็อกให้นิสิตยื่นบริษัทใหม่</small></span>
            </label>
          </fieldset>
          <label class="acr-note-label" for="acr-note">หมายเหตุ / คอมเมนต์ถึงนิสิต <span id="acr-note-req" class="acr-req" hidden>* จำเป็นเมื่อไม่อนุมัติ</span></label>
          <textarea id="acr-note" class="acr-note" rows="3" maxlength="1000" placeholder="เช่น เอกสารครบถ้วน / บริษัทแจ้งปฏิเสธเพราะ..."></textarea>
          <div id="acr-error" class="acr-error" role="alert" hidden></div>
          <div id="acr-confirm" class="acr-confirm" hidden></div>
          <div class="acr-actions" id="acr-actions">
            <button type="button" class="acr-btn acr-btn--ghost" data-act="cancel">ยกเลิก</button>
            <button type="button" class="acr-btn acr-btn--primary" id="acr-submit" disabled>ยืนยัน</button>
          </div>` : `
          <div class="acr-readonly">${data.canReview ? 'แบบตอบรับนี้ไม่ได้อยู่ในสถานะรอตรวจแล้ว' : 'คุณดูได้อย่างเดียว (สิทธิ์ตรวจเป็นของอาจารย์ที่ปรึกษาของนิสิต)'}</div>
          <div id="acr-confirm" class="acr-confirm" hidden></div>
          <div class="acr-actions" id="acr-actions"><button type="button" class="acr-btn acr-btn--ghost" data-act="cancel">ปิด</button></div>`}
      </aside>`;

    A.bindBody(st);
  },

  bindBody(st) {
    const A = window.IctAcceptanceReview;
    const root = st.overlay;
    root.querySelectorAll('[data-act="cancel"]').forEach((b) => b.addEventListener('click', () => A.requestClose()));

    // เอกสาร: โหลดไม่ได้ → fallback
    const img = root.querySelector('#acr-img');
    const body = root.querySelector('.acr-doc-body');
    if (img) {
      img.addEventListener('error', () => {
        body.innerHTML = body.dataset.fallback;
        root.querySelectorAll('[data-zoom]').forEach((b) => b.remove()); // ปุ่มซูมใช้กับรูปเท่านั้น
      });
      root.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
        const step = Number(b.dataset.zoom);
        st.zoom = step === 0 ? 1 : Math.max(0.5, Math.min(3, st.zoom + step * 0.25));
        img.style.width = `${st.zoom * 100}%`;
        root.querySelector('#acr-imgwrap').classList.toggle('is-zoomed', st.zoom > 1);
      }));
      img.addEventListener('click', () => {
        st.zoom = st.zoom > 1 ? 1 : 2;
        img.style.width = `${st.zoom * 100}%`;
        root.querySelector('#acr-imgwrap').classList.toggle('is-zoomed', st.zoom > 1);
      });
    }

    const submitBtn = root.querySelector('#acr-submit');
    if (!submitBtn) return;
    const note = root.querySelector('#acr-note');
    const refresh = () => {
      const isReject = st.choice === 'REJECTED';
      root.querySelector('#acr-note-req').hidden = !isReject;
      note.classList.toggle('is-required', isReject && !note.value.trim());
      submitBtn.disabled = st.busy || !st.choice || (isReject && !note.value.trim());
      submitBtn.className = `acr-btn ${isReject ? 'acr-btn--bad' : st.choice === 'APPROVED' ? 'acr-btn--ok' : 'acr-btn--primary'}`;
      submitBtn.textContent = isReject ? 'ยืนยันไม่อนุมัติ' : st.choice === 'APPROVED' ? 'ยืนยันอนุมัติ' : 'ยืนยัน';
    };
    root.querySelectorAll('input[name="acr-choice"]').forEach((r) => r.addEventListener('change', () => {
      st.choice = r.value;
      root.querySelectorAll('.acr-choice').forEach((c) => c.classList.toggle('is-on', c.querySelector('input').checked));
      A.hideConfirm();
      refresh();
    }));
    note.addEventListener('input', refresh);
    submitBtn.addEventListener('click', () => {
      if (submitBtn.disabled) return;
      if (st.choice === 'REJECTED') {
        A.showConfirm(
          'ยืนยันไม่อนุมัติแบบตอบรับนี้?',
          'ระบบจะย้ายข้อมูลเข้า Archive และปลดล็อกให้นิสิตยื่นบริษัทใหม่ ย้อนกลับไม่ได้',
          'ยืนยันไม่อนุมัติ',
          () => A.doSubmit(),
        );
        return;
      }
      A.doSubmit();
    });
    st.refresh = refresh;
  },

  /** แถบยืนยันภายใน modal (แทน window.confirm) */
  showConfirm(title, text, okLabel, onOk) {
    const st = window.__acrState;
    if (!st) return;
    const box = st.overlay.querySelector('#acr-confirm');
    const actions = st.overlay.querySelector('#acr-actions');
    if (!box) return;
    const esc = window.IctAcceptanceReview.esc;
    box.innerHTML = `
      <div class="acr-confirm-text"><span class="material-icons" aria-hidden="true">warning</span><div><b>${esc(title)}</b><small>${esc(text)}</small></div></div>
      <div class="acr-confirm-btns">
        <button type="button" class="acr-btn acr-btn--ghost" data-c="back">ย้อนกลับ</button>
        <button type="button" class="acr-btn acr-btn--bad" data-c="ok">${esc(okLabel)}</button>
      </div>`;
    box.hidden = false;
    if (actions) actions.hidden = true;
    box.querySelector('[data-c="back"]').addEventListener('click', () => window.IctAcceptanceReview.hideConfirm());
    box.querySelector('[data-c="ok"]').addEventListener('click', () => { window.IctAcceptanceReview.hideConfirm(); onOk(); });
    box.querySelector('[data-c="back"]').focus();
  },

  hideConfirm() {
    const st = window.__acrState;
    if (!st) return;
    const box = st.overlay.querySelector('#acr-confirm');
    const actions = st.overlay.querySelector('#acr-actions');
    if (box) { box.hidden = true; box.innerHTML = ''; }
    if (actions) actions.hidden = false;
  },

  async doSubmit() {
    const A = window.IctAcceptanceReview;
    const st = window.__acrState;
    if (!st || st.busy || !st.choice) return;
    const root = st.overlay;
    const btn = root.querySelector('#acr-submit');
    const errBox = root.querySelector('#acr-error');
    const note = root.querySelector('#acr-note').value.trim();
    if (st.choice === 'REJECTED' && !note) return;

    st.busy = true;
    errBox.hidden = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons acr-spin" aria-hidden="true">autorenew</span> กำลังบันทึก...';
    root.querySelectorAll('input[name="acr-choice"], #acr-note, [data-act]').forEach((el) => { el.disabled = true; });

    const status = st.choice;
    const result = await A.submit(st.studentId, status, note);
    if (window.__acrState !== st) return;
    st.busy = false;
    root.querySelectorAll('input[name="acr-choice"], #acr-note, [data-act]').forEach((el) => { el.disabled = false; });

    if (!result.ok) {
      errBox.textContent = result.message;
      errBox.hidden = false;
      if (st.refresh) st.refresh();
      return;
    }
    A.toast(result.message, 'ok');
    const onDone = st.onDone;
    A.close(true);
    if (typeof onDone === 'function') onDone(status, result.message);
  },

  /** ปิดแบบผู้ใช้สั่ง: มีคอมเมนต์ค้าง → ถามก่อน */
  requestClose() {
    const A = window.IctAcceptanceReview;
    const st = window.__acrState;
    if (!st || st.busy) return;
    const note = st.overlay.querySelector('#acr-note');
    const confirmOpen = st.overlay.querySelector('#acr-confirm:not([hidden])');
    if (confirmOpen) { A.hideConfirm(); return; }
    if (note && note.value.trim()) {
      A.showConfirm('ปิดหน้าต่างนี้?', 'คอมเมนต์ที่พิมพ์ไว้จะหายไป', 'ปิดโดยไม่บันทึก', () => A.close(true));
      return;
    }
    A.close(true);
  },

  close() {
    const st = window.__acrState;
    if (!st) return;
    window.__acrState = null;
    document.removeEventListener('keydown', st.keyHandler, true);
    document.body.style.overflow = st.prevOverflow || '';
    st.overlay.remove();
    if (st.prevFocus && typeof st.prevFocus.focus === 'function' && document.contains(st.prevFocus)) st.prevFocus.focus();
  },

  /** Esc ปิด + focus trap (Tab วนอยู่ใน modal) */
  onKey(e) {
    const st = window.__acrState;
    if (!st) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      window.IctAcceptanceReview.requestClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const modal = st.overlay.querySelector('.acr-modal');
    const items = [...modal.querySelectorAll('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])')]
      .filter((el) => el.offsetParent !== null);
    if (items.length === 0) { e.preventDefault(); modal.focus(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === modal)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    } else if (!modal.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  },
};
