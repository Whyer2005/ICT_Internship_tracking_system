// admin_issue_reports.ts — หน้า "เรื่องที่นิสิตแจ้งปัญหา" ของเจ้าหน้าที่ (workspace-issues ใน AdminDashboardPage)
// API: GET /api/admin/super-admin/issue-reports, POST /api/admin/super-admin/issue-reports/:id/status
// ห่อด้วย IIFE เพราะสคริปต์ฝั่ง client ใช้ global scope ร่วมกับ admin_dashboard.js
(function () {
  const w = window as any;
  const API = '/api/admin/super-admin/issue-reports';
  const STATUS_LABEL: Record<string, string> = { OPEN: 'รอดำเนินการ', IN_PROGRESS: 'กำลังดำเนินการ', RESOLVED: 'แก้ไขแล้ว' };
  const URGENCY: Record<string, { label: string; color: string }> = {
    LOW: { label: 'ต่ำ', color: '#22C55E' },
    MEDIUM: { label: 'ปานกลาง', color: '#F59E0B' },
    HIGH: { label: 'สูง', color: '#EF4444' },
  };
  // ชื่อหมวดเหมือน src/utils/issueReports.ts (ISSUE_CATEGORIES)
  const CATEGORY_LABEL: Record<string, string> = {
    LOGIN: 'เข้าสู่ระบบ/บัญชี',
    PROFILE_DATA: 'ข้อมูลส่วนตัวไม่ถูกต้อง',
    CV_DOCUMENT: 'CV/เอกสาร',
    COMPANY: 'การเลือกสถานประกอบการ',
    COOP: 'การสมัครสหกิจ',
    SYSTEM_ERROR: 'ระบบทำงานผิดพลาด',
    OTHER: 'อื่นๆ',
  };

  let reports: any[] = [];
  let statusFilter = 'OPEN';
  let openId: string | null = null;

  const $ = (id: string) => document.getElementById(id) as any;
  const esc = (v: unknown) =>
    String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };
  const isSafeUrl = (u: unknown) => /^https:\/\//i.test(String(u || ''));

  function updateBadge() {
    const badge = $('badge-issue-open');
    if (!badge) return;
    const n = reports.filter((r) => r.status === 'OPEN').length;
    badge.textContent = `${n} ใหม่`;
    // .admin-nav-badge ตั้ง display เอง → ใช้ style.display แทน attribute hidden
    badge.hidden = false;
    badge.style.display = n === 0 ? 'none' : '';
  }

  function renderChips() {
    const box = $('air-status-chips');
    if (!box) return;
    const count = (s: string) => (s ? reports.filter((r) => r.status === s).length : reports.length);
    const chips = [['', 'ทั้งหมด'], ['OPEN', STATUS_LABEL.OPEN], ['IN_PROGRESS', STATUS_LABEL.IN_PROGRESS], ['RESOLVED', STATUS_LABEL.RESOLVED]];
    box.innerHTML = chips
      .map(([s, label]) => `<button type="button" data-status="${s}" aria-pressed="${statusFilter === s}">${label}<b>${count(s)}</b></button>`)
      .join('');
  }

  function renderTable() {
    const tbody = $('air-tbody');
    if (!tbody) return;
    const cat = $('air-category')?.value || '';
    const q = String($('air-search')?.value || '').trim().toLowerCase();
    const list = reports.filter((r) =>
      (!statusFilter || r.status === statusFilter) &&
      (!cat || r.category === cat) &&
      (!q || `${r.id} ${r.title} ${r.studentCode} ${r.studentName}`.toLowerCase().includes(q))
    );
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-400">${reports.length ? 'ไม่พบเรื่องตามตัวกรอง' : 'ยังไม่มีนิสิตแจ้งปัญหา'}</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map((r) => {
      const u = URGENCY[r.urgency] || URGENCY.MEDIUM;
      return `<tr data-id="${esc(r.id)}" tabindex="0">
        <td><b style="color:#4338CA;">#${esc(r.id)}</b></td>
        <td><div class="air-title">${esc(r.title)}</div><div class="air-sub">${esc(r.studentCode)} · ${esc(r.studentName)}${(r.attachments || []).length ? ` · 📎 ${(r.attachments || []).length}` : ''}</div></td>
        <td>${esc(CATEGORY_LABEL[r.category] || r.category)}</td>
        <td><span class="air-urg"><i style="background:${u.color}"></i>${u.label}</span></td>
        <td class="air-sub">${fmtDate(r.createdAt)}</td>
        <td><span class="air-badge air-badge--${esc(r.status)}">${esc(STATUS_LABEL[r.status] || r.status)}</span></td>
      </tr>`;
    }).join('');
  }

  function render() {
    updateBadge();
    renderChips();
    renderTable();
  }

  w.loadIssueReports = async function () {
    try {
      const res = await fetch(API);
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      reports = data.reports || [];
    } catch (err) {
      console.error('load issue reports error:', err);
      const tbody = $('air-tbody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6" style="color:#DC2626;">โหลดข้อมูลไม่สำเร็จ</td></tr>';
      return;
    }
    render();
  };

  function openReport(id: string) {
    const r = reports.find((x) => x.id === id);
    if (!r) return;
    openId = id;
    const u = URGENCY[r.urgency] || URGENCY.MEDIUM;
    const files = (r.attachments || []).filter((a: any) => isSafeUrl(a.url));
    $('air-modal-id').textContent = `#${r.id} · ${STATUS_LABEL[r.status] || r.status}`;
    $('air-modal-title').textContent = r.title;
    $('air-modal-body').innerHTML = `
      <dl>
        <dt>นิสิต</dt><dd>${esc(r.studentCode)} · ${esc(r.studentName)}</dd>
        <dt>ติดต่อกลับ</dt><dd>${r.contactByEmail && r.email ? `<a href="mailto:${esc(r.email)}">${esc(r.email)}</a>` : '<span style="color:#94A3B8;">ไม่ต้องการให้ติดต่อทางอีเมล</span>'}</dd>
        <dt>ประเภท</dt><dd>${esc(CATEGORY_LABEL[r.category] || r.category)}</dd>
        <dt>หน้าที่พบปัญหา</dt><dd>${esc(r.page)}</dd>
        <dt>ความเร่งด่วน</dt><dd><span class="air-urg"><i style="background:${u.color}"></i>${u.label}</span></dd>
        <dt>แจ้งเมื่อ</dt><dd>${fmtDate(r.createdAt)}${r.updatedAt !== r.createdAt ? ` · อัปเดต ${fmtDate(r.updatedAt)}` : ''}</dd>
      </dl>
      <div class="air-detail">${esc(r.detail)}</div>
      ${files.length ? `<div class="air-files">${files.map((a: any) => `<a href="${esc(a.url)}" target="_blank" rel="noopener noreferrer"><span class="material-icons" style="font-size:14px;">attach_file</span>${esc(a.name)}</a>`).join('')}</div>` : ''}`;
    $('air-modal-status').innerHTML = Object.entries(STATUS_LABEL)
      .map(([k, label]) => `<option value="${k}"${k === r.status ? ' selected' : ''}>${label}</option>`)
      .join('');
    $('air-modal-note').value = r.adminNote || '';
    $('air-modal').hidden = false;
    $('air-modal-status').focus();
  }

  w.closeIssueReport = function () {
    openId = null;
    const modal = $('air-modal');
    if (modal) modal.hidden = true;
  };

  w.saveIssueReport = async function () {
    if (!openId) return;
    const btn = $('air-modal-save');
    btn.disabled = true;
    try {
      const res = await fetch(`${API}/${encodeURIComponent(openId)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: $('air-modal-status').value, adminNote: $('air-modal-note').value }),
      });
      const data = await res.json();
      if (!data.success) {
        alert('เกิดข้อผิดพลาด: ' + (data.message || 'บันทึกไม่สำเร็จ'));
        return;
      }
      reports = reports.map((r) => (r.id === data.report.id ? data.report : r));
      w.closeIssueReport();
      render();
    } catch (err) {
      console.error('save issue report error:', err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      btn.disabled = false;
    }
  };

  function bind() {
    const catSel = $('air-category');
    if (catSel && catSel.options.length <= 1) {
      catSel.insertAdjacentHTML('beforeend', Object.entries(CATEGORY_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join(''));
    }
    catSel?.addEventListener('change', renderTable);
    $('air-search')?.addEventListener('input', renderTable);
    $('air-status-chips')?.addEventListener('click', (e: Event) => {
      const btn = (e.target as HTMLElement).closest('[data-status]') as HTMLElement | null;
      if (!btn) return;
      statusFilter = btn.dataset.status || '';
      render();
    });
    const tbody = $('air-tbody');
    tbody?.addEventListener('click', (e: Event) => {
      const row = (e.target as HTMLElement).closest('tr[data-id]') as HTMLElement | null;
      if (row) openReport(row.dataset.id || '');
    });
    tbody?.addEventListener('keydown', (e: KeyboardEvent) => {
      const row = (e.target as HTMLElement).closest('tr[data-id]') as HTMLElement | null;
      if (row && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        openReport(row.dataset.id || '');
      }
    });
    $('air-modal')?.addEventListener('click', (e: Event) => {
      if (e.target === $('air-modal')) w.closeIssueReport();
    });
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openId) w.closeIssueReport();
    });
  }

  bind();
  // โหลดตั้งแต่เปิดหน้า เพื่อแสดงจำนวนเรื่องใหม่บนเมนูด้านซ้าย
  w.loadIssueReports();
})();
