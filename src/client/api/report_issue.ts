// @ts-nocheck
// report_issue.js — หน้า "แจ้งปัญหา" ของนิสิต (เมนู อื่นๆ → แจ้งปัญหา)
// API: GET/POST /api/student/issue-reports (เก็บใน super_admin_state.json ฝั่ง server)
// ห่อด้วย IIFE: ไม่ประกาศตัวแปรระดับบนสุด → โหลดสคริปต์ซ้ำได้โดยไม่ error
(function () {
  const MAX_FILES = 3;
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const FILE_EXTS = ['.png', '.jpg', '.jpeg', '.pdf'];
  const URGENCY_LABEL = { LOW: 'ต่ำ', MEDIUM: 'ปานกลาง', HIGH: 'สูง' };
  const STATUS_LABEL = { OPEN: 'รอดำเนินการ', IN_PROGRESS: 'กำลังดำเนินการ', RESOLVED: 'แก้ไขแล้ว' };
  const STATUS_ICON = { OPEN: 'schedule', IN_PROGRESS: 'autorenew', RESOLVED: 'task_alt' };
  // ไอคอน + ตัวอย่างของแต่ละหมวด (ชื่อหมวดมาจาก server)
  const CATEGORY_META = {
    LOGIN: { icon: 'manage_accounts', hint: 'ล็อกอินไม่ได้ / บัญชีมีปัญหา' },
    PROFILE_DATA: { icon: 'badge', hint: 'ชื่อ รหัส สาขา หรือเกรดไม่ตรงกับความจริง' },
    CV_DOCUMENT: { icon: 'description', hint: 'อัปโหลด Resume หรือเอกสารไม่ได้' },
    COMPANY: { icon: 'apartment', hint: 'เลือก/ยื่นสถานประกอบการ แผนที่ หรือแบบฟอร์ม' },
    COOP: { icon: 'work_outline', hint: 'ประกาศรับสมัครหรือการสมัครสหกิจ' },
    SYSTEM_ERROR: { icon: 'bug_report', hint: 'หน้าเว็บค้าง ปุ่มกดไม่ได้ ขึ้นข้อผิดพลาด' },
    OTHER: { icon: 'more_horiz', hint: 'เรื่องอื่นที่ไม่อยู่ในหมวดด้านบน' },
  };

  const state = {
    categories: {},
    category: '',
    urgency: 'MEDIUM',
    files: [],
    touched: new Set(),
    reports: [],
    statusFilter: '',
    busy: false,
  };

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const isSafeUrl = (u) => /^https:\/\//i.test(String(u || ''));

  // ---------- แท็บ ----------
  window.rpiSwitchTab = function (tab) {
    const isNew = tab !== 'history';
    $('rpi-tab-new').setAttribute('aria-selected', String(isNew));
    $('rpi-tab-history').setAttribute('aria-selected', String(!isNew));
    $('rpi-view-new').hidden = !isNew;
    $('rpi-view-history').hidden = isNew;
  };

  // ---------- ฟอร์ม ----------
  function renderCategories() {
    const box = $('rpi-cats');
    if (!box) return;
    box.innerHTML = Object.entries(state.categories).map(([code, label]) => {
      const meta = CATEGORY_META[code] || { icon: 'help_outline', hint: '' };
      return `<button type="button" class="rpi-cat" role="radio" aria-checked="${state.category === code}" data-category="${esc(code)}">
        <span class="material-icons" aria-hidden="true">${meta.icon}</span>
        <b>${esc(label)}</b>
        <small>${esc(meta.hint)}</small>
      </button>`;
    }).join('');
  }

  function renderPages(pages) {
    const sel = $('rpi-page');
    if (!sel) return;
    sel.innerHTML = pages.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  }

  function renderFiles() {
    const wrap = $('rpi-files');
    const btn = $('rpi-file-btn');
    if (!wrap || !btn) return;
    wrap.querySelectorAll('.rpi-chip').forEach((el) => el.remove());
    state.files.forEach((f, i) => {
      const chip = document.createElement('span');
      chip.className = 'rpi-chip';
      chip.innerHTML = `<span class="material-icons" aria-hidden="true">${/\.pdf$/i.test(f.name) ? 'picture_as_pdf' : 'image'}</span>
        <span class="name" title="${esc(f.name)}">${esc(f.name)}</span><span>· ${Math.max(1, Math.round(f.size / 1024))}KB</span>
        <button type="button" aria-label="ลบไฟล์ ${esc(f.name)}" data-remove="${i}"><span class="material-icons" aria-hidden="true">close</span></button>`;
      wrap.insertBefore(chip, btn);
    });
    btn.disabled = state.files.length >= MAX_FILES;
  }

  function values() {
    return {
      title: ($('rpi-title')?.value || '').trim(),
      detail: ($('rpi-detail')?.value || '').trim(),
      page: $('rpi-page')?.value || '',
      contactByEmail: Boolean($('rpi-contact')?.checked),
    };
  }

  // ตรวจฟอร์ม + อัปเดตกล่องสรุป/ปุ่มส่ง (แสดง error เฉพาะช่องที่ผู้ใช้แตะแล้ว)
  function sync() {
    const v = values();
    const errors = {
      category: state.category ? '' : 'กรุณาเลือกประเภทปัญหา',
      title: v.title ? '' : 'กรุณากรอกหัวข้อ',
      detail: v.detail ? '' : 'กรุณากรอกรายละเอียด',
    };
    document.querySelectorAll('.rpi [data-error]').forEach((el) => {
      const key = el.getAttribute('data-error');
      if (key in errors) el.textContent = state.touched.has(key) ? errors[key] : '';
    });

    // ยังไม่เลือกหมวด → ปิดส่วนรายละเอียด (inert กันกด Tab เข้าไปกรอก ไม่ใช่แค่ทำให้จาง)
    const details = $('rpi-details');
    if (details) {
      details.classList.toggle('is-disabled', !state.category);
      details.inert = !state.category;
    }
    $('rpi-title-count').textContent = `${v.title.length}/120`;
    $('rpi-detail-count').textContent = `${v.detail.length}/1000`;

    const setSum = (id, text, empty) => {
      const el = $(id);
      if (!el) return;
      el.textContent = text;
      el.classList.toggle('empty', Boolean(empty));
    };
    setSum('rpi-sum-category', state.categories[state.category] || 'ยังไม่เลือก', !state.category);
    setSum('rpi-sum-title', v.title || '-', !v.title);
    setSum('rpi-sum-page', v.page || '-', !v.page);
    setSum('rpi-sum-urgency', URGENCY_LABEL[state.urgency], false);
    setSum('rpi-sum-files', state.files.length ? `${state.files.length} ไฟล์` : 'ไม่มี', !state.files.length);

    const ok = Object.values(errors).every((m) => !m);
    const submit = $('rpi-submit');
    if (submit && !state.busy) submit.disabled = !ok;
    return ok;
  }

  function addFiles(list) {
    const errEl = document.querySelector('.rpi [data-error="files"]');
    const problems = [];
    Array.from(list || []).forEach((f) => {
      const name = f.name.toLowerCase();
      const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
      if (state.files.length >= MAX_FILES) problems.push(`แนบได้สูงสุด ${MAX_FILES} ไฟล์`);
      else if (!FILE_EXTS.includes(ext)) problems.push(`${f.name}: รองรับเฉพาะ PNG, JPG หรือ PDF`);
      else if (f.size > MAX_FILE_BYTES) problems.push(`${f.name}: ขนาดเกิน 5MB`);
      else state.files.push(f);
    });
    if (errEl) errEl.textContent = [...new Set(problems)].join(' · ');
    renderFiles();
    sync();
  }

  window.rpiReset = function () {
    state.category = '';
    state.urgency = 'MEDIUM';
    state.files = [];
    state.touched.clear();
    ['rpi-title', 'rpi-detail'].forEach((id) => { if ($(id)) $(id).value = ''; });
    if ($('rpi-page')) $('rpi-page').selectedIndex = 0;
    if ($('rpi-contact')) $('rpi-contact').checked = true;
    const fileErr = document.querySelector('.rpi [data-error="files"]');
    if (fileErr) fileErr.textContent = '';
    document.querySelectorAll('#rpi-urgency .rpi-urg').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.urgency === 'MEDIUM')));
    renderCategories();
    renderFiles();
    sync();
  };

  window.rpiSubmit = async function () {
    ['category', 'title', 'detail'].forEach((k) => state.touched.add(k));
    if (!sync() || state.busy) return;
    const v = values();
    const fd = new FormData();
    fd.append('category', state.category);
    fd.append('title', v.title);
    fd.append('page', v.page);
    fd.append('detail', v.detail);
    fd.append('urgency', state.urgency);
    fd.append('contactByEmail', String(v.contactByEmail));
    state.files.forEach((f) => fd.append('attachments', f));

    const submit = $('rpi-submit');
    state.busy = true;
    submit.disabled = true;
    $('rpi-submit-text').textContent = state.files.length ? 'กำลังอัปโหลดและส่ง...' : 'กำลังส่ง...';
    try {
      const res = await fetch('/api/student/issue-reports', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (!data || !data.success) {
        alert((data && data.message) || 'ส่งเรื่องไม่สำเร็จ กรุณาลองใหม่');
        return;
      }
      state.reports = [data.report, ...state.reports];
      renderHistory();
      window.rpiReset();
      const ok = $('rpi-success');
      $('rpi-success-text').textContent = `${data.message} — ติดตามสถานะได้ที่แท็บ "เรื่องที่เคยแจ้ง"`;
      ok.hidden = false;
      ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) {
      console.error('submit issue report error:', err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      state.busy = false;
      $('rpi-submit-text').textContent = 'ส่งเรื่อง';
      sync();
    }
  };

  // ---------- เรื่องที่เคยแจ้ง ----------
  function renderHistory() {
    const counts = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0 };
    state.reports.forEach((r) => { if (r.status in counts) counts[r.status]++; });
    $('rpi-stat-open').textContent = counts.OPEN;
    $('rpi-stat-progress').textContent = counts.IN_PROGRESS;
    $('rpi-stat-resolved').textContent = counts.RESOLVED;
    $('rpi-history-count').textContent = state.reports.length;

    const box = $('rpi-history');
    if (!box) return;
    const list = state.statusFilter ? state.reports.filter((r) => r.status === state.statusFilter) : state.reports;
    if (!list.length) {
      box.innerHTML = `<div class="rpi-empty"><span class="material-icons" aria-hidden="true">inbox</span>${state.reports.length ? 'ไม่มีเรื่องในสถานะนี้' : 'ยังไม่เคยแจ้งปัญหา'}</div>`;
      return;
    }
    const steps = ['OPEN', 'IN_PROGRESS', 'RESOLVED'];
    box.innerHTML = list.map((r) => {
      const reached = steps.indexOf(r.status);
      const attach = (r.attachments || []).filter((a) => isSafeUrl(a.url));
      return `<article class="rpi-ticket">
        <div class="rpi-ticket-head">
          <div style="min-width:0;">
            <div class="rpi-ticket-id">#${esc(r.id)}</div>
            <h3>${esc(r.title)}</h3>
          </div>
          <span class="rpi-badge rpi-badge--${esc(r.status)}"><span class="material-icons" style="font-size:15px;" aria-hidden="true">${STATUS_ICON[r.status] || 'schedule'}</span>${esc(STATUS_LABEL[r.status] || r.status)}</span>
        </div>
        <div class="rpi-ticket-meta">
          <span><span class="material-icons" aria-hidden="true">category</span>${esc(state.categories[r.category] || r.category)}</span>
          <span><span class="material-icons" aria-hidden="true">web</span>${esc(r.page)}</span>
          <span><span class="material-icons" aria-hidden="true">flag</span>เร่งด่วน${esc(URGENCY_LABEL[r.urgency] || '')}</span>
          <span><span class="material-icons" aria-hidden="true">event</span>${fmtDate(r.createdAt)}</span>
        </div>
        <p class="detail">${esc(r.detail)}</p>
        ${attach.length ? `<div class="rpi-attach">${attach.map((a) => `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer" title="${esc(a.name)}"><span class="material-icons" aria-hidden="true">attach_file</span>${esc(a.name)}</a>`).join('')}</div>` : ''}
        ${r.adminNote ? `<div class="rpi-reply"><span class="material-icons" aria-hidden="true">forum</span><span><b>ตอบกลับจากเจ้าหน้าที่:</b> ${esc(r.adminNote)}</span></div>` : ''}
        <div class="rpi-track" aria-label="ความคืบหน้า">
          ${steps.map((s, i) => `<div class="${i <= reached ? 'done' : ''}">${STATUS_LABEL[s]}</div>`).join('')}
        </div>
      </article>`;
    }).join('');
  }

  async function load() {
    try {
      const res = await fetch('/api/student/issue-reports');
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      state.categories = (data.options && data.options.categories) || {};
      renderPages((data.options && data.options.pages) || []);
      state.reports = data.reports || [];
    } catch (err) {
      console.error('load issue reports error:', err);
      const box = $('rpi-history');
      if (box) box.innerHTML = '<div class="rpi-empty" style="color:#DC2626;">โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้า</div>';
    }
    renderCategories();
    renderHistory();
    sync();
  }

  function bind() {
    $('rpi-cats')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-category]');
      if (!btn) return;
      state.category = btn.dataset.category;
      state.touched.add('category');
      renderCategories();
      sync();
      $('rpi-title')?.focus();
    });
    $('rpi-urgency')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-urgency]');
      if (!btn) return;
      state.urgency = btn.dataset.urgency;
      document.querySelectorAll('#rpi-urgency .rpi-urg').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
      sync();
    });
    ['rpi-title', 'rpi-detail'].forEach((id) => {
      const el = $(id);
      const key = id === 'rpi-title' ? 'title' : 'detail';
      el?.addEventListener('input', sync);
      el?.addEventListener('blur', () => { state.touched.add(key); sync(); });
    });
    $('rpi-page')?.addEventListener('change', sync);
    $('rpi-file-input')?.addEventListener('change', (e) => {
      addFiles(e.target.files);
      e.target.value = '';
    });
    $('rpi-files')?.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-remove]');
      if (!rm) return;
      state.files.splice(Number(rm.dataset.remove), 1);
      renderFiles();
      sync();
    });
    $('rpi-filter')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-status]');
      if (!btn) return;
      state.statusFilter = btn.dataset.status;
      document.querySelectorAll('#rpi-filter button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      renderHistory();
    });
    if (new URLSearchParams(window.location.search).get('tab') === 'history') window.rpiSwitchTab('history');
  }

  bind();
  load();
})();
