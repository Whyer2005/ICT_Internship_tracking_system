// @ts-nocheck
// notification_bell.js — ปุ่มกระดิ่งแจ้งเตือนวงกลมลอยมุมขวาล่าง (ทุกโรล) + helper ที่หน้า /notifications ใช้ร่วม
// โหลดโดย header.js / header_prof.js หลังใส่ header ลงหน้า · ข้อมูลจาก /api/notifications (กรองตามโรลที่กำลังใช้งาน)
(function () {
  if (window.__ictNotifBell) {
    window.__ictNotifBell.mount();
    return;
  }

  // เช็กยอดยังไม่อ่านทุก 5 นาที (ถี่กว่านี้ทำให้ Neon ไม่ได้ autosuspend → กิน compute hours)
  const POLL_MS = 5 * 60 * 1000;
  const DROPDOWN_LIMIT = 8;

  // หมวด → ไอคอน + โทนสี (ตรงกับ mockup docs/design/notifications)
  const CATEGORY_META = {
    approval: { icon: 'fact_check', tone: 'blue', label: 'ผลการอนุมัติ' },
    document: { icon: 'description', tone: 'indigo', label: 'เอกสาร' },
    cv: { icon: 'chat', tone: 'purple', label: 'CV' },
    training: { icon: 'school', tone: 'teal', label: 'ชั่วโมงอบรม' },
    issue: { icon: 'support_agent', tone: 'orange', label: 'แจ้งปัญหา' },
    account: { icon: 'manage_accounts', tone: 'slate', label: 'บัญชี/ข้อมูลส่วนตัว' },
    assignment: { icon: 'group_add', tone: 'green', label: 'การมอบหมาย' },
    coop: { icon: 'handshake', tone: 'amber', label: 'สหกิจศึกษา' },
    deadline: { icon: 'event', tone: 'red', label: 'กำหนดการ' },
  };
  // ไอคอนเฉพาะเหตุการณ์ (ไม่มี = ใช้ของหมวด)
  function iconFor(n) {
    const t = String(n.type || '');
    if (t.endsWith('_APPROVED') || t === 'COMPANY_ACCEPTED' || t === 'ISSUE_RESOLVED') return { icon: 'check_circle', tone: 'green' };
    if (t.endsWith('_REJECTED') || t === 'STUDENT_DROPPED') return { icon: 'cancel', tone: 'red' };
    if (t === 'WINDOW_CLOSING') return { icon: 'alarm', tone: 'red' };
    if (t === 'WINDOW_OPEN') return { icon: 'event_available', tone: 'indigo' };
    const m = CATEGORY_META[n.category] || { icon: 'notifications', tone: 'slate' };
    return { icon: m.icon, tone: m.tone };
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function relativeTime(iso) {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'เมื่อสักครู่';
    if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
    if (diff < 86400 * 2) return `เมื่อวาน ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} วันที่แล้ว`;
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  }

  function dayGroup(iso) {
    const d = new Date(iso);
    const today = new Date();
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((startOf(today) - startOf(d)) / 86400000);
    if (days <= 0) return 'วันนี้';
    if (days === 1) return 'เมื่อวาน';
    if (days < 7) return 'สัปดาห์นี้';
    return 'ก่อนหน้านี้';
  }

  // แถวแจ้งเตือน 1 รายการ (ใช้ทั้ง dropdown และหน้าเต็ม)
  function renderItem(n, opts) {
    const compact = opts && opts.compact;
    const ic = iconFor(n);
    const unread = !n.readAt;
    const meta = CATEGORY_META[n.category];
    const chips = [];
    if (n.priority === 'HIGH') chips.push('<span class="ict-ntf-chip tone-red"><span class="material-icons" aria-hidden="true">priority_high</span>สำคัญ</span>');
    if (!compact && meta) chips.push(`<span class="ict-ntf-chip tone-${meta.tone}">${esc(meta.label)}</span>`);
    return `
      <li>
        <button type="button" class="ict-ntf-item ${unread ? 'is-unread' : ''}" data-id="${n.id}" data-link="${esc(n.link || '')}">
          <span class="ict-ntf-ic tone-${ic.tone}"><span class="material-icons" aria-hidden="true">${ic.icon}</span></span>
          <span class="ict-ntf-body">
            <span class="ict-ntf-title">${esc(n.title)}</span>
            ${n.message ? `<span class="ict-ntf-msg">${esc(n.message)}</span>` : ''}
            <span class="ict-ntf-meta">${chips.join('')}<time datetime="${esc(n.createdAt)}">${esc(relativeTime(n.createdAt))}</time></span>
          </span>
          ${unread ? '<span class="ict-ntf-dot" aria-label="ยังไม่อ่าน"></span>' : ''}
        </button>
      </li>`;
  }

  async function api(path, method) {
    const res = await fetch(path, { method: method || 'GET', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  async function openNotification(id, link) {
    try {
      await api(`/api/notifications/${id}/read`, 'POST');
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('ict:notifications-changed'));
    if (link) window.location.href = link;
  }

  const STYLE = `
    .ict-ntf-wrap { position:fixed; right:24px; bottom:24px; z-index:1000; display:inline-flex; }
    .ict-ntf-bell { position:relative; width:56px; height:56px; border-radius:50%; border:0; background:#1541D2; color:#fff; display:grid; place-items:center; cursor:pointer; box-shadow:0 8px 24px rgba(21,65,210,.35); transition:background .15s, transform .15s; }
    .ict-ntf-bell:hover, .ict-ntf-bell[aria-expanded="true"] { background:#1034A8; transform:translateY(-2px); }
    .ict-ntf-bell:focus-visible { outline:3px solid #A5B4FC; outline-offset:3px; }
    .ict-ntf-bell .material-icons { font-size:26px; }
    .ict-ntf-badge { position:absolute; top:-2px; right:-2px; min-width:20px; height:20px; padding:0 5px; border-radius:10px; background:#EF4444; color:#fff; font-size:11px; font-weight:800; display:grid; place-items:center; border:2px solid #fff; line-height:1; }
    .ict-ntf-badge[hidden] { display:none; }
    .ict-ntf-panel { position:absolute; bottom:calc(100% + 12px); right:0; width:380px; max-width:calc(100vw - 24px); background:#fff; border:1px solid #E2E8F0; border-radius:16px; box-shadow:0 18px 50px rgba(15,23,42,.18); overflow:hidden; text-align:left; }
    .ict-ntf-panel[hidden] { display:none; }
    .ict-ntf-head { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:14px 16px 10px; border-bottom:1px solid #F1F5F9; }
    .ict-ntf-head h2 { margin:0; font-size:15px; font-weight:800; color:#0F172A; }
    .ict-ntf-link-btn { border:0; background:none; color:#1541D2; font:inherit; font-size:12.5px; font-weight:700; cursor:pointer; padding:4px 6px; border-radius:8px; display:inline-flex; align-items:center; gap:4px; }
    .ict-ntf-link-btn:hover { background:#E8F0FE; }
    .ict-ntf-link-btn .material-icons { font-size:16px; }
    .ict-ntf-list { list-style:none; margin:0; padding:4px 0; max-height:min(60vh, 440px); overflow:auto; }
    .ict-ntf-item { width:100%; display:flex; gap:12px; align-items:flex-start; padding:11px 16px; border:0; background:transparent; text-align:left; font:inherit; cursor:pointer; position:relative; color:inherit; }
    .ict-ntf-item:hover { background:#F8FAFC; }
    .ict-ntf-item:focus-visible { outline:2px solid #A5B4FC; outline-offset:-2px; }
    .ict-ntf-item.is-unread { background:#F5F8FF; }
    .ict-ntf-item.is-unread:hover { background:#EEF3FF; }
    .ict-ntf-ic { width:36px; height:36px; border-radius:50%; flex:none; display:grid; place-items:center; }
    .ict-ntf-ic .material-icons { font-size:19px; }
    .ict-ntf-body { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
    .ict-ntf-title { font-size:13.5px; font-weight:700; color:#0F172A; line-height:1.4; }
    .ict-ntf-item:not(.is-unread) .ict-ntf-title { font-weight:600; color:#334155; }
    .ict-ntf-msg { font-size:12.5px; color:#64748B; line-height:1.45; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .ict-ntf-meta { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-top:3px; font-size:11.5px; color:#94A3B8; }
    .ict-ntf-chip { display:inline-flex; align-items:center; gap:2px; padding:1px 7px; border-radius:999px; font-size:11px; font-weight:700; }
    .ict-ntf-chip .material-icons { font-size:13px; }
    .ict-ntf-dot { width:8px; height:8px; border-radius:50%; background:#1541D2; flex:none; margin-top:6px; }
    .ict-ntf-foot { display:block; padding:11px 16px; text-align:center; border-top:1px solid #F1F5F9; color:#1541D2; font-size:13px; font-weight:700; text-decoration:none; }
    .ict-ntf-foot:hover { background:#F8FAFC; }
    .ict-ntf-empty { padding:34px 20px; text-align:center; color:#64748B; font-size:13px; }
    .ict-ntf-empty .material-icons { display:block; margin:0 auto 8px; width:56px; height:56px; line-height:56px; border-radius:50%; background:#E8F0FE; color:#1541D2; font-size:28px; }
    .ict-ntf-skel { height:56px; margin:6px 16px; border-radius:12px; background:linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%); background-size:200% 100%; animation:ictNtfShimmer 1.2s infinite; }
    @keyframes ictNtfShimmer { from { background-position:200% 0; } to { background-position:-200% 0; } }
    .tone-red { color:#DC2626; background:#FEF2F2; }
    .tone-amber { color:#D97706; background:#FFFBEB; }
    .tone-green { color:#16A34A; background:#F0FDF4; }
    .tone-blue { color:#1541D2; background:#E8F0FE; }
    .tone-purple { color:#7C3AED; background:#F5F3FF; }
    .tone-teal { color:#0D9488; background:#F0FDFA; }
    .tone-indigo { color:#4338CA; background:#EEF2FF; }
    .tone-orange { color:#EA580C; background:#FFF7ED; }
    .tone-slate { color:#475569; background:#F1F5F9; }
    @media (max-width: 640px) {
      .ict-ntf-wrap { right:16px; bottom:16px; }
      .ict-ntf-panel { position:fixed; bottom:84px; left:12px; right:12px; width:auto; max-width:none; }
    }
    @media (prefers-reduced-motion: reduce) { .ict-ntf-skel { animation:none; } .ict-ntf-bell { transition:none; } .ict-ntf-bell:hover { transform:none; } }
    @media print { .ict-ntf-wrap { display:none; } }
  `;

  function injectStyle() {
    if (document.getElementById('ict-ntf-style')) return;
    const st = document.createElement('style');
    st.id = 'ict-ntf-style';
    st.textContent = STYLE;
    document.head.appendChild(st);
  }

  const state = { unread: 0, open: false, timer: null, mounted: false };

  function setBadge(count) {
    state.unread = count;
    const badge = document.getElementById('ict-ntf-badge');
    const bell = document.getElementById('ict-ntf-bell');
    if (badge) {
      badge.hidden = count <= 0;
      badge.textContent = count > 99 ? '99+' : String(count);
    }
    if (bell) bell.setAttribute('aria-label', count > 0 ? `การแจ้งเตือน ยังไม่อ่าน ${count} รายการ` : 'การแจ้งเตือน');
    const live = document.getElementById('ict-ntf-live');
    if (live) live.textContent = count > 0 ? `มีการแจ้งเตือนใหม่ ${count} รายการ` : '';
  }

  async function refreshCount() {
    try {
      const data = await api('/api/notifications/unread-count');
      if (data && data.success) setBadge(data.unread || 0);
    } catch (err) {
      if (String(err.message) === '401') stopPolling();
    }
  }

  async function loadDropdown() {
    const list = document.getElementById('ict-ntf-list');
    if (!list) return;
    list.innerHTML = '<li class="ict-ntf-skel"></li><li class="ict-ntf-skel"></li><li class="ict-ntf-skel"></li>';
    try {
      const data = await api(`/api/notifications?pageSize=${DROPDOWN_LIMIT}`);
      setBadge(data.unread || 0);
      list.innerHTML = data.items.length
        ? data.items.map((n) => renderItem(n, { compact: true })).join('')
        : '<li class="ict-ntf-empty"><span class="material-icons" aria-hidden="true">notifications_paused</span>ยังไม่มีการแจ้งเตือน</li>';
    } catch (_) {
      list.innerHTML = '<li class="ict-ntf-empty"><span class="material-icons" aria-hidden="true">cloud_off</span>โหลดการแจ้งเตือนไม่สำเร็จ</li>';
    }
  }

  function setOpen(open) {
    state.open = open;
    const panel = document.getElementById('ict-ntf-panel');
    const bell = document.getElementById('ict-ntf-bell');
    if (!panel || !bell) return;
    panel.hidden = !open;
    bell.setAttribute('aria-expanded', String(open));
    if (open) loadDropdown();
  }

  function startPolling() {
    stopPolling();
    state.timer = setInterval(() => {
      if (!document.hidden) refreshCount();
    }, POLL_MS);
  }
  function stopPolling() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  function mount() {
    // ใช้ header เป็นตัวบอกว่าล็อกอินแล้ว แต่ตัวปุ่มลอยอยู่มุมขวาล่างของจอ (ผูกกับ body)
    const host = document.querySelector('.ict-role-switcher-wrap');
    if (!host || document.getElementById('ict-ntf-bell')) return;
    injectStyle();
    const onNotifPage = window.location.pathname.replace(/\/$/, '') === '/notifications';
    const wrap = document.createElement('div');
    wrap.className = 'ict-ntf-wrap';
    wrap.innerHTML = `
      <button type="button" class="ict-ntf-bell" id="ict-ntf-bell" aria-haspopup="true" aria-expanded="false" aria-controls="ict-ntf-panel" aria-label="การแจ้งเตือน">
        <span class="material-icons" aria-hidden="true">notifications</span>
        <span class="ict-ntf-badge" id="ict-ntf-badge" hidden>0</span>
      </button>
      <span id="ict-ntf-live" class="sr-only" aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);"></span>
      <div class="ict-ntf-panel" id="ict-ntf-panel" role="dialog" aria-label="การแจ้งเตือน" hidden>
        <div class="ict-ntf-head">
          <h2>การแจ้งเตือน</h2>
          <button type="button" class="ict-ntf-link-btn" id="ict-ntf-readall"><span class="material-icons" aria-hidden="true">done_all</span>อ่านทั้งหมด</button>
        </div>
        <ul class="ict-ntf-list" id="ict-ntf-list"></ul>
        <a class="ict-ntf-foot" href="/notifications">ดูการแจ้งเตือนทั้งหมด</a>
      </div>`;
    document.body.appendChild(wrap);
    state.mounted = true;

    const bell = document.getElementById('ict-ntf-bell');
    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      // อยู่หน้าการแจ้งเตือนแล้ว → ไม่ต้องเปิด dropdown ซ้อน
      if (onNotifPage) return;
      setOpen(!state.open);
    });
    document.getElementById('ict-ntf-readall').addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await api('/api/notifications/read-all', 'POST');
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('ict:notifications-changed'));
      loadDropdown();
    });
    document.getElementById('ict-ntf-list').addEventListener('click', (e) => {
      const btn = e.target.closest('.ict-ntf-item');
      if (!btn) return;
      openNotification(btn.dataset.id, btn.dataset.link);
    });
    document.addEventListener('click', (e) => {
      if (state.open && !wrap.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.open) {
        setOpen(false);
        bell.focus();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshCount();
    });
    window.addEventListener('ict:notifications-changed', refreshCount);

    refreshCount();
    startPolling();
  }

  window.__ictNotifBell = { mount, refreshCount, renderItem, esc, relativeTime, dayGroup, iconFor, CATEGORY_META, openNotification, api };
  mount();
})();
