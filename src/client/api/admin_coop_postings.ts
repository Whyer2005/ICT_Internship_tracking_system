// admin_coop_postings.ts — หน้า "ประกาศสหกิจศึกษา" ของเจ้าหน้าที่ (workspace-coopjobs ใน AdminDashboardPage)
// เพิ่ม / แก้ไข / ปิดรับ / ลบ ประกาศ + นำเข้าจาก Excel (พรีวิวก่อนบันทึก)
// API: /api/admin/super-admin/coop-postings (src/api/coopRoutes.ts)
// ห่อด้วย IIFE เพราะสคริปต์ฝั่ง client ใช้ global scope ร่วมกับ admin_dashboard.js
(function () {
  const w = window as any;
  const API = '/api/admin/super-admin/coop-postings';

  let postings: any[] = [];
  let applications: any[] = [];
  let coopMinGpax = 2;
  const selectedApps = new Set<number>();
  let editingId: number | null = null;
  let masterCompanies: any[] | null = null;

  const $ = (id: string) => document.getElementById(id) as any;

  function esc(v: unknown): string {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
  }

  const normName = (s: string) => String(s || '').replace(/\s+/g, '').toLowerCase();

  function readJson<T>(id: string, fallback: T): T {
    try {
      return JSON.parse(document.getElementById(id)?.textContent || '') as T;
    } catch {
      return fallback;
    }
  }
  // ต้นทาง: src/utils/thaiProvinces.ts และ src/utils/jobPositions.ts (หน้าเพจฝังเป็น JSON)
  const PROVINCES: string[] = readJson('thai-provinces-data', [] as string[]);
  const POSITION_GROUPS: ComboGroup[] = readJson('job-positions-data', [] as ComboGroup[]);

  const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; icon: string }> = {
    OPEN: { bg: '#DCFCE7', color: '#166534', border: '#86EFAC', icon: 'campaign' },
    CLOSED: { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1', icon: 'lock' },
  };

  function statusBadge(p: any): string {
    const st = STATUS_STYLE[p.status] || STATUS_STYLE.CLOSED;
    return `<span style="display:inline-flex; align-items:center; gap:4px; background:${st.bg}; color:${st.color}; border:1px solid ${st.border}; padding:3px 9px; border-radius:999px; font-size:11.5px; font-weight:700; white-space:nowrap;">
      <span class="material-icons" style="font-size:14px;">${st.icon}</span>${esc(p.statusLabel)}</span>`;
  }

  // ---------------------------------------------------------------------
  // ช่องเลือกแบบพิมพ์ค้นหาได้ (ใช้กับจังหวัด และตำแหน่งงาน) — แบบเดียวกับช่องตำแหน่งในหน้าเลือกสถานประกอบการ
  // คลิก/โฟกัส = เห็นทั้งหมด · พิมพ์ = กรอง (ชื่อ + คำค้น + ชื่อกลุ่ม) · ↑↓ + Enter เลือก · Esc ปิด
  // allowCustom = ใช้ข้อความที่พิมพ์เองได้ (ตำแหน่ง) / ไม่ได้ (จังหวัด ต้องเลือกจากรายการ)
  // ---------------------------------------------------------------------
  type ComboGroup = { label?: string; items: { name: string; keywords?: string }[] };

  function setupCombo(input: HTMLInputElement, list: HTMLElement, groups: ComboGroup[], allowCustom: boolean) {
    if (!input || !list || input.dataset.comboReady) return;
    input.dataset.comboReady = '1';
    const allNames = groups.flatMap((g) => g.items.map((i) => i.name));
    let active = -1;

    const options = () => Array.from(list.querySelectorAll<HTMLElement>('.cp-combo-option'));
    const close = () => {
      list.style.display = 'none';
      active = -1;
    };
    const pick = (value: string) => {
      input.value = value;
      input.classList.remove('is-invalid');
      close();
      input.dispatchEvent(new Event('change'));
    };
    const highlight = (text: string, q: string) => {
      const idx = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
      if (idx < 0) return esc(text);
      return `${esc(text.slice(0, idx))}<mark style="background:#E0E7FF; color:inherit; padding:0 1px; border-radius:3px;">${esc(text.slice(idx, idx + q.length))}</mark>${esc(text.slice(idx + q.length))}`;
    };
    const render = (showAll: boolean) => {
      const typed = input.value.trim();
      const tokens = showAll ? [] : typed.toLowerCase().split(/\s+/).filter(Boolean);
      let html = '';
      for (const g of groups) {
        const items = g.items.filter((i) => {
          if (!tokens.length) return true;
          const hay = `${i.name} ${i.keywords || ''} ${g.label || ''}`.toLowerCase();
          return tokens.every((t) => hay.includes(t));
        });
        if (!items.length) continue;
        if (g.label) html += `<div class="cp-combo-group">${esc(g.label)}</div>`;
        html += items
          .map((i) => `<div class="cp-combo-option${i.name === typed ? ' is-selected' : ''}" role="option" data-value="${esc(i.name)}">${highlight(i.name, showAll ? '' : typed)}</div>`)
          .join('');
      }
      const exact = allNames.some((n) => n.toLowerCase() === typed.toLowerCase());
      if (allowCustom && typed && !exact) {
        html += `<div class="cp-combo-option is-custom" role="option" data-value="${esc(typed)}">✏️ ใช้ "${esc(typed)}" ที่พิมพ์เอง</div>`;
      }
      list.innerHTML = html || '<div class="cp-combo-empty">ไม่พบรายการที่ตรงกัน</div>';
      list.style.display = 'block';
      active = -1;
      if (showAll) list.querySelector<HTMLElement>('.is-selected')?.scrollIntoView({ block: 'nearest' });
    };
    const move = (next: number) => {
      const opts = options();
      if (!opts.length) return;
      active = Math.max(0, Math.min(opts.length - 1, next));
      opts.forEach((o, i) => o.classList.toggle('is-active', i === active));
      opts[active].scrollIntoView({ block: 'nearest' });
    };

    input.addEventListener('focus', () => render(true));
    input.addEventListener('click', () => {
      if (list.style.display !== 'block') render(true);
    });
    input.addEventListener('input', () => {
      input.classList.remove('is-invalid');
      render(false);
    });
    input.addEventListener('keydown', (e) => {
      const open = list.style.display === 'block';
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!open) render(true);
        move(e.key === 'ArrowDown' ? active + 1 : active - 1);
      } else if (e.key === 'Enter' && open) {
        e.preventDefault();
        const opt = options()[active];
        if (opt) pick(opt.dataset.value || '');
        else close();
      } else if (e.key === 'Escape' && open) {
        e.stopPropagation();
        close();
      }
    });
    list.addEventListener('mousedown', (e) => {
      const opt = (e.target as HTMLElement).closest<HTMLElement>('.cp-combo-option');
      if (!opt) return;
      e.preventDefault(); // ไม่ให้ input เสียโฟกัสก่อนเลือก
      pick(opt.dataset.value || '');
    });
    input.addEventListener('blur', () => {
      close();
      if (allowCustom) return;
      // ต้องเลือกจากรายการ: ตัด "จังหวัด"/"จ." ที่พิมพ์มาแล้วลองจับคู่ ไม่ตรงก็ทำเครื่องหมายไว้ (เซิร์ฟเวอร์ตรวจซ้ำตอนบันทึก)
      const v = input.value.trim().replace(/^(จังหวัด|จ\.)\s*/, '');
      if (!v) return input.classList.remove('is-invalid');
      const found = allNames.find((n) => n === v);
      if (found) {
        input.value = found;
        input.classList.remove('is-invalid');
      } else {
        input.classList.add('is-invalid');
      }
    });
  }

  // ---------------------------------------------------------------------
  // รายการประกาศ
  // ---------------------------------------------------------------------
  w.loadCoopPostings = async function () {
    const tbody = $('coop-postings-tbody');
    try {
      const res = await fetch(API);
      const data = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
      if (!data.success) throw new Error(data.message || 'โหลดไม่สำเร็จ');
      postings = data.postings || [];
      updateBadge();
      w.renderCoopPostings();
      w.loadCoopApplications();
    } catch (err: any) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6" style="color:#991B1B;">
          โหลดประกาศไม่สำเร็จ: ${esc(err?.message)}
          <button type="button" onclick="window.loadCoopPostings()" style="margin-left:8px; border:1px solid #FCA5A5; background:#FFFFFF; color:#991B1B; border-radius:8px; padding:3px 10px; cursor:pointer;">ลองใหม่</button>
        </td></tr>`;
      }
    }
  };

  // เมนูซ้าย: มีใบสมัครรอพิจารณา -> แสดงจำนวนนั้นก่อน ไม่งั้นแสดงจำนวนประกาศที่เปิดรับ
  function updateBadge() {
    const badge = $('badge-coop-postings');
    if (!badge) return;
    const pending = applications.filter((a) => a.status === 'SUBMITTED').length;
    badge.textContent = pending > 0 ? `${pending} ใบสมัครใหม่` : `${postings.filter((p) => p.status === 'OPEN').length} เปิดรับ`;
  }

  w.renderCoopPostings = function () {
    const tbody = $('coop-postings-tbody');
    if (!tbody) return;
    const q = String($('coop-posting-search')?.value || '').trim().toLowerCase();
    const status = $('coop-posting-status')?.value || '';

    const list = postings.filter((p) => {
      if (status === 'OPEN' && p.status !== 'OPEN') return false;
      if (status === 'CLOSED' && p.status !== 'CLOSED') return false;
      if (!q) return true;
      const hay = [p.companyName, p.companyNameEn, p.province, ...p.positions.map((x: any) => x.title)].join(' ').toLowerCase();
      return hay.includes(q);
    });

    if (postings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-400">ยังไม่มีประกาศ — กด "เพิ่มประกาศ" หรือ "นำเข้าประกาศ (Excel)"</td></tr>`;
      return;
    }
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-400">ไม่พบประกาศตามเงื่อนไขที่เลือก</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map(rowHtml).join('');
  };

  function rowHtml(p: any): string {
    const positions = p.positions
      .map((x: any) => `<div style="font-size:12.5px; line-height:1.5;">• ${esc(x.title)} <span style="color:#64748B;">· ${x.seats ? `${x.seats} คน` : 'ไม่ระบุจำนวน'}</span></div>`)
      .join('');
    const closeBtn = p.isClosed
      ? `<button type="button" onclick="window.toggleCoopPostingClosed(${p.id}, false)" title="เปิดรับสมัครอีกครั้ง" style="${iconBtn('#059669')}"><span class="material-icons" style="font-size:18px;">lock_open</span></button>`
      : `<button type="button" onclick="window.toggleCoopPostingClosed(${p.id}, true)" title="ปิดรับสมัครก่อนกำหนด" style="${iconBtn('#B45309')}"><span class="material-icons" style="font-size:18px;">lock</span></button>`;
    return `<tr style="${p.status === 'OPEN' ? '' : 'background:#F8FAFC;'}">
      <td>
        <div style="font-weight:700; color:#1E293B;">${esc(p.companyName)}</div>
        ${p.companyNameEn ? `<div style="font-size:11.5px; color:#64748B;">${esc(p.companyNameEn)}</div>` : ''}
        ${p.province ? `<div style="font-size:11.5px; color:#475569; margin-top:2px;"><span class="material-icons" style="font-size:13px; vertical-align:-2px;">place</span> ${esc(p.province)}</div>` : ''}
      </td>
      <td>${positions}<div style="font-size:11.5px; color:#475569; margin-top:2px;">รวม ${p.totalSeats || '-'} คน${p.applicationCount ? ` · <strong style="color:#4338CA;">สมัครแล้ว ${p.applicationCount} ใบ</strong>` : ''}</div></td>
      <td class="text-center">${statusBadge(p)}</td>
      <td class="text-center" style="white-space:nowrap;">
        <button type="button" onclick="window.openCoopPostingModal(${p.id})" title="แก้ไขประกาศ" style="${iconBtn('#4338CA')}"><span class="material-icons" style="font-size:18px;">edit</span></button>
        ${closeBtn}
        <button type="button" onclick="window.deleteCoopPosting(${p.id})" title="ลบประกาศ" style="${iconBtn('#DC2626')}"><span class="material-icons" style="font-size:18px;">delete</span></button>
      </td>
    </tr>`;
  }

  function iconBtn(color: string): string {
    return `background:#FFFFFF; border:1px solid #E2E8F0; color:${color}; border-radius:8px; width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; padding:0;`;
  }

  w.toggleCoopPostingClosed = async function (id: number, closed: boolean) {
    const p = postings.find((x) => x.id === id);
    if (!p) return;
    const msg = closed
      ? `ปิดรับสมัครประกาศ "${p.companyName}" หรือไม่?\n\nนิสิตยังเห็นประกาศในตาราง แต่จะขึ้นว่า "ปิดรับแล้ว"`
      : `เปิดรับสมัครประกาศ "${p.companyName}" อีกครั้งหรือไม่?`;
    if (!confirm(msg)) return;
    const data = await sendJson(`${API}/${id}/close`, 'POST', { closed });
    if (data.success) {
      alert('✅ ' + data.message);
      await w.loadCoopPostings();
    }
  };

  w.deleteCoopPosting = async function (id: number) {
    const p = postings.find((x) => x.id === id);
    if (!p) return;
    if (!confirm(`ลบประกาศ "${p.companyName}" และตำแหน่งทั้งหมด ${p.positions.length} ตำแหน่งหรือไม่?\n\nลบแล้วกู้คืนไม่ได้ — ถ้าแค่ไม่รับสมัครแล้ว ให้ใช้ "ปิดรับสมัคร" แทน`)) return;
    const data = await sendJson(`${API}/${id}`, 'DELETE');
    if (data.success) {
      alert('✅ ' + data.message);
      await w.loadCoopPostings();
    }
  };

  async function sendJson(url: string, method: string, body?: any, quiet = false) {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({ success: false, message: `เซิร์ฟเวอร์ตอบกลับ HTTP ${res.status}` }));
    if (!data.success && !quiet) alert('เกิดข้อผิดพลาด: ' + (data.message || 'ทำรายการไม่สำเร็จ'));
    return data;
  }

  // ---------------------------------------------------------------------
  // ฟอร์มเพิ่ม / แก้ไขประกาศ
  // ---------------------------------------------------------------------
  function setVal(id: string, v: unknown) {
    const el = $(id);
    if (el) el.value = v === null || v === undefined ? '' : String(v);
  }
  const val = (id: string) => String($(id)?.value ?? '').trim();

  function positionRowHtml(p: any = {}): string {
    return `<div class="cp-position-row" data-id="${p.id || ''}" style="display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start; padding:8px; border:1px solid #E2E8F0; border-radius:10px; background:#F8FAFC;">
      <div class="cp-combo" style="position:relative; flex:2 1 200px;">
        <input class="input-field cp-pos-title" autocomplete="off" placeholder="ชื่อตำแหน่ง * (พิมพ์ค้นหาหรือเลือก)" value="${esc(p.title)}" aria-label="ชื่อตำแหน่ง" role="combobox" aria-autocomplete="list" style="margin:0; width:100%; padding-right:30px;" />
        <span class="material-icons" aria-hidden="true" style="position:absolute; right:8px; top:19px; transform:translateY(-50%); font-size:18px; color:#94A3B8; pointer-events:none;">expand_more</span>
        <div class="cp-combo-list cp-pos-list" role="listbox"></div>
      </div>
      <input class="input-field cp-pos-seats" type="number" min="1" max="999" placeholder="รับ (คน)" value="${p.seats ?? ''}" aria-label="จำนวนที่รับ" style="margin:0; flex:0 0 96px; width:96px;" />
      <textarea class="input-field cp-pos-desc" rows="1" placeholder="ลักษณะงาน" aria-label="ลักษณะงาน" style="margin:0; flex:3 1 220px; min-height:38px;">${esc(p.description)}</textarea>
      <button type="button" onclick="window.removeCoopPositionRow(this)" title="ลบตำแหน่งนี้" aria-label="ลบตำแหน่งนี้" style="${iconBtn('#DC2626')} flex:0 0 32px; margin-top:3px;">
        <span class="material-icons" style="font-size:18px;">delete</span>
      </button>
    </div>`;
  }

  w.addCoopPositionRow = function (p?: any) {
    const box = $('cp-positions');
    if (!box) return;
    box.insertAdjacentHTML('beforeend', positionRowHtml(p));
    const row = box.lastElementChild as HTMLElement | null;
    const input = row?.querySelector('.cp-pos-title') as HTMLInputElement | null;
    const list = row?.querySelector('.cp-pos-list') as HTMLElement | null;
    if (input && list) setupCombo(input, list, POSITION_GROUPS, true);
    if (!p) input?.focus();
  };

  w.removeCoopPositionRow = function (btn: HTMLElement) {
    const rows = document.querySelectorAll('#cp-positions .cp-position-row');
    const row = btn.closest('.cp-position-row') as HTMLElement | null;
    if (!row) return;
    if (rows.length <= 1) {
      // เหลือแถวเดียว -> ล้างค่าแทนการลบ (ต้องมีอย่างน้อย 1 ตำแหน่ง)
      row.dataset.id = '';
      row.querySelectorAll('input, textarea').forEach((el) => ((el as HTMLInputElement).value = ''));
      return;
    }
    row.remove();
  };

  async function loadMasterCompanies() {
    if (masterCompanies) return;
    try {
      const res = await fetch(`${API}/company-suggestions`);
      const data = await res.json();
      masterCompanies = data.success ? data.companies || [] : [];
    } catch {
      masterCompanies = [];
    }
    const list = $('cp-master-list');
    if (list) list.innerHTML = (masterCompanies || []).map((c) => `<option value="${esc(c.nameTh)}">${esc(c.province || '')}</option>`).join('');
  }

  function showFormError(message: string) {
    const el = $('cp-error');
    if (!el) return;
    el.textContent = message;
    el.style.display = message ? 'block' : 'none';
    if (message) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  w.openCoopPostingModal = function (id?: number) {
    const modal = $('coop-posting-modal');
    if (!modal) return;
    setupCombo($('cp-province'), $('cp-province-list'), [{ items: PROVINCES.map((name) => ({ name })) }], false);
    const p = id ? postings.find((x) => x.id === id) : null;
    editingId = p ? p.id : null;
    $('cp-title').textContent = p ? `แก้ไขประกาศ: ${p.companyName}` : 'เพิ่มประกาศสหกิจศึกษา';
    setVal('cp-master-id', p?.masterCompanyId);
    setVal('cp-company', p?.companyName);
    setVal('cp-company-en', p?.companyNameEn);
    setVal('cp-province', p?.province);
    $('cp-province')?.classList.remove('is-invalid');
    setVal('cp-website', p?.website);
    setVal('cp-address', p?.address);
    setVal('cp-description', p?.description);
    setVal('cp-benefits', p?.benefits);
    setVal('cp-qualifications', p?.qualifications);
    setVal('cp-hr-name', p?.hrContactName);
    setVal('cp-hr-phone', p?.hrPhone);
    setVal('cp-hr-email', p?.hrEmail);
    const box = $('cp-positions');
    if (box) box.innerHTML = '';
    (p?.positions?.length ? p.positions : [{}]).forEach((x: any) => w.addCoopPositionRow(x));
    showFormError('');
    const btn = $('cp-save');
    if (btn) btn.disabled = false;
    modal.style.display = 'flex';
    loadMasterCompanies();
    setTimeout(() => $('cp-company')?.focus(), 50);
  };

  w.closeCoopPostingModal = function () {
    const modal = $('coop-posting-modal');
    if (modal) modal.style.display = 'none';
    editingId = null;
  };

  // เลือกบริษัทจากฐานข้อมูลกลาง -> เติมข้อมูลที่ยังว่าง (ไม่ทับที่พิมพ์ไว้)
  w.onCoopCompanyPicked = function () {
    const name = val('cp-company');
    const m = (masterCompanies || []).find((c) => normName(c.nameTh) === normName(name));
    setVal('cp-master-id', m ? m.id : '');
    if (!m) return;
    const fill = (id: string, v: string) => {
      if (!val(id) && v) setVal(id, v);
    };
    fill('cp-company-en', m.nameEn);
    // จังหวัดจากฐานข้อมูลบริษัทอาจพิมพ์ไม่ตรงรายการ (เช่น "จ.เชียงใหม่") -> เติมเฉพาะที่จับคู่ได้
    const prov = String(m.province || '').replace(/^(จังหวัด|จ\.)\s*/, '').trim();
    if (PROVINCES.includes(prov)) fill('cp-province', prov);
    fill('cp-address', m.address);
    fill('cp-hr-name', m.hrContactName);
    fill('cp-hr-phone', m.hrPhone);
    fill('cp-hr-email', m.hrEmail);
  };

  function readForm() {
    const positions = Array.from(document.querySelectorAll<HTMLElement>('#cp-positions .cp-position-row')).map((row) => ({
      ...(row.dataset.id ? { id: Number(row.dataset.id) } : {}),
      title: (row.querySelector('.cp-pos-title') as HTMLInputElement).value,
      seats: (row.querySelector('.cp-pos-seats') as HTMLInputElement).value,
      description: (row.querySelector('.cp-pos-desc') as HTMLTextAreaElement).value,
    }));
    return {
      companyName: val('cp-company'),
      companyNameEn: val('cp-company-en'),
      masterCompanyId: val('cp-master-id'),
      province: val('cp-province'),
      website: val('cp-website'),
      address: val('cp-address'),
      description: val('cp-description'),
      benefits: val('cp-benefits'),
      qualifications: val('cp-qualifications'),
      hrContactName: val('cp-hr-name'),
      hrPhone: val('cp-hr-phone'),
      hrEmail: val('cp-hr-email'),
      positions,
    };
  }

  w.saveCoopPosting = async function () {
    const btn = $('cp-save');
    if (btn) btn.disabled = true;
    showFormError('');
    try {
      const data = await sendJson(editingId ? `${API}/${editingId}` : API, editingId ? 'PUT' : 'POST', readForm(), true);
      if (!data.success) {
        showFormError(data.message || 'บันทึกไม่สำเร็จ');
        return;
      }
      w.closeCoopPostingModal();
      alert('✅ ' + data.message);
      await w.loadCoopPostings();
    } catch {
      showFormError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่');
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  // ---------------------------------------------------------------------
  // นำเข้า Excel
  // ---------------------------------------------------------------------
  function setImportConfirm(enabled: boolean) {
    const btn = $('coop-import-confirm');
    if (!btn) return;
    btn.disabled = !enabled;
    btn.style.opacity = enabled ? '1' : '.5';
    btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
  }

  w.openCoopImportModal = function () {
    const modal = $('coop-import-modal');
    if (!modal) return;
    const input = $('coop-import-file');
    if (input) input.value = '';
    const preview = $('coop-import-preview');
    if (preview) preview.innerHTML = '';
    setImportConfirm(false);
    modal.style.display = 'flex';
  };

  w.closeCoopImportModal = function () {
    const modal = $('coop-import-modal');
    if (modal) modal.style.display = 'none';
  };

  function importFormData(): FormData | null {
    const file = $('coop-import-file')?.files?.[0];
    if (!file) return null;
    const fd = new FormData();
    fd.append('file', file);
    return fd;
  }

  const ACTION_BADGE: Record<string, string> = {
    CREATE: '<span style="background:#DCFCE7; color:#166534; border-radius:999px; padding:1px 8px; font-size:11px; font-weight:700;">ใหม่</span>',
    UPDATE: '<span style="background:#E0F2FE; color:#075985; border-radius:999px; padding:1px 8px; font-size:11px; font-weight:700;">อัปเดต</span>',
  };

  w.previewCoopImport = async function () {
    const preview = $('coop-import-preview');
    const fd = importFormData();
    setImportConfirm(false);
    if (!preview || !fd) return;
    preview.innerHTML = '<div style="font-size:12.5px; color:#64748B;">กำลังอ่านไฟล์...</div>';
    try {
      const res = await fetch(`${API}/import-preview`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
      if (!data.success) {
        preview.innerHTML = `<div style="padding:10px 12px; background:#FEF2F2; border:1px solid #FECACA; border-radius:10px; color:#991B1B; font-size:12.5px;">${esc(data.message)}</div>`;
        return;
      }
      const s = data.summary;
      const groups = (data.groups || [])
        .map((g: any) => `<tr>
          <td>${ACTION_BADGE[g.action] || ''}</td>
          <td><div style="font-weight:700;">${esc(g.companyName)}</div><div style="font-size:11px; color:#94A3B8;">แถว ${g.rowNumbers.join(', ')}</div></td>
          <td>${g.positions.map((p: any) => `<div style="font-size:12px;">${ACTION_BADGE[p.action] || ''} ${esc(p.title)} <span style="color:#64748B;">· ${p.seats ? `${p.seats} คน` : 'ไม่ระบุ'}</span></div>`).join('')}</td>
        </tr>`)
        .join('');
      const errors = (data.errors || [])
        .map((e: any) => `<li>แถว ${e.rowNumber}: ${esc(e.message)}</li>`)
        .join('');
      preview.innerHTML = `
        <div style="display:flex; flex-wrap:wrap; gap:8px; font-size:12.5px; margin-bottom:10px;">
          <span style="background:#DCFCE7; color:#166534; border-radius:8px; padding:4px 10px; font-weight:700;">ประกาศใหม่ ${s.createPostings}</span>
          <span style="background:#E0F2FE; color:#075985; border-radius:8px; padding:4px 10px; font-weight:700;">อัปเดตประกาศเดิม ${s.updatePostings}</span>
          <span style="background:#EEF2FF; color:#3730A3; border-radius:8px; padding:4px 10px; font-weight:700;">ตำแหน่งรวม ${s.positions}</span>
          ${s.errorRows ? `<span style="background:#FEF2F2; color:#991B1B; border-radius:8px; padding:4px 10px; font-weight:700;">แถวที่ข้าม ${s.errorRows}</span>` : ''}
        </div>
        ${groups ? `<div style="overflow-x:auto;"><table class="data-table" style="min-width:520px;">
          <thead><tr><th style="width:10%;"></th><th>บริษัท</th><th>ตำแหน่ง</th></tr></thead>
          <tbody>${groups}</tbody></table></div>` : ''}
        ${errors ? `<div style="margin-top:10px; padding:10px 12px; background:#FFFBEB; border:1px solid #FCD34D; border-radius:10px; font-size:12px; color:#92400E;">
          <strong>แถวที่ไม่นำเข้า (แก้ในไฟล์แล้วเลือกไฟล์ใหม่ได้)</strong><ul style="margin:6px 0 0; padding-left:18px; line-height:1.6;">${errors}</ul></div>` : ''}`;
      setImportConfirm((data.groups || []).length > 0);
    } catch {
      preview.innerHTML = '<div style="color:#991B1B; font-size:12.5px;">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่</div>';
    }
  };

  w.confirmCoopImport = async function () {
    const fd = importFormData();
    if (!fd) return;
    setImportConfirm(false);
    try {
      const res = await fetch(`${API}/import-confirm`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
      if (!data.success) {
        alert('เกิดข้อผิดพลาด: ' + (data.message || 'นำเข้าไม่สำเร็จ'));
        setImportConfirm(true);
        return;
      }
      w.closeCoopImportModal();
      alert('✅ ' + data.message);
      await w.loadCoopPostings();
    } catch {
      alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่');
      setImportConfirm(true);
    }
  };

  // ---------------------------------------------------------------------
  // ใบสมัครสหกิจของนิสิต
  // ---------------------------------------------------------------------
  const APP_STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
    SUBMITTED: { bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' },
    SENT_TO_COMPANY: { bg: '#E0F2FE', color: '#075985', border: '#7DD3FC' },
    ACCEPTED: { bg: '#DCFCE7', color: '#166534', border: '#86EFAC' },
    REJECTED: { bg: '#FEE2E2', color: '#991B1B', border: '#FCA5A5' },
    CANCELLED: { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
  };
  const APP_STATUS_SHORT: Record<string, string> = {
    SUBMITTED: 'รอพิจารณา',
    SENT_TO_COMPANY: 'ส่งเอกสารให้บริษัทแล้ว',
    ACCEPTED: 'ผ่านการคัดเลือก',
    REJECTED: 'ไม่ผ่าน',
    CANCELLED: 'ยกเลิก',
  };
  // ต้องตรงกับ COOP_STATUS_TRANSITIONS / canChangeCoopStatus ใน src/utils/coopPostings.ts (เซิร์ฟเวอร์ตรวจซ้ำ)
  const APP_TRANSITIONS: Record<string, string[]> = {
    SUBMITTED: ['SENT_TO_COMPANY', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
    SENT_TO_COMPANY: ['SUBMITTED', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
    ACCEPTED: ['SENT_TO_COMPANY', 'REJECTED', 'CANCELLED'],
    REJECTED: [],
    CANCELLED: [],
  };
  const isFinalApp = (status: string) => status === 'REJECTED' || status === 'CANCELLED';
  /** ผ่านแล้วและเริ่มขั้นเอกสารแล้ว -> เหลือแค่ยกเลิก (ต้องย้อนขั้นเอกสารเป็น "ยังไม่เริ่ม" ก่อนจึงย้อนสถานะได้) */
  function nextStatuses(a: any): string[] {
    const next = APP_TRANSITIONS[a.status] || [];
    return a.status === 'ACCEPTED' && a.docStep && a.docStep !== 'NONE' ? next.filter((x) => x === 'CANCELLED') : next;
  }
  const DOC_STEP_SHORT: Record<string, string> = {
    NONE: 'ยังไม่เริ่มออกเอกสาร',
    REQUEST_LETTER: 'ออกหนังสือขอความอนุเคราะห์แล้ว',
    ACCEPTANCE_FORM: 'ได้รับแบบตอบรับแล้ว',
    DISPATCH_LETTER: 'ออกหนังสือส่งตัวแล้ว',
  };

  const thDate = (v: string) => (v ? new Date(v).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-');

  w.loadCoopApplications = async function () {
    const tbody = $('coop-apps-tbody');
    if (!tbody) return;
    try {
      const res = await fetch('/api/admin/super-admin/coop-applications');
      const data = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
      if (!data.success) throw new Error(data.message || 'โหลดไม่สำเร็จ');
      applications = data.applications || [];
      coopMinGpax = Number(data.minGpax) || 2;
      // ตัดรายการที่เลือกไว้แต่ไม่มีแล้ว/เปลี่ยนต่อไม่ได้
      Array.from(selectedApps).forEach((id) => {
        const a = applications.find((x) => x.id === id);
        if (!a || isFinalApp(a.status)) selectedApps.delete(id);
      });
      fillPostingFilter();
      updateBadge();
      w.renderCoopApplications();
    } catch (err: any) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6" style="color:#991B1B;">โหลดใบสมัครไม่สำเร็จ: ${esc(err?.message)}</td></tr>`;
    }
  };

  function fillPostingFilter() {
    const sel = $('coop-app-posting');
    if (!sel) return;
    const current = sel.value;
    const companies = new Map<string, string>();
    applications.forEach((a) => companies.set(String(a.postingId), a.companyName));
    sel.innerHTML = '<option value="">ทุกบริษัท</option>' + Array.from(companies.entries())
      .sort((a, b) => a[1].localeCompare(b[1], 'th'))
      .map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join('');
    sel.value = companies.has(current) ? current : '';
  }

  function filteredApps() {
    const q = String($('coop-app-search')?.value || '').trim().toLowerCase();
    const status = $('coop-app-status')?.value ?? 'ACTIVE';
    const posting = $('coop-app-posting')?.value || '';
    return applications.filter((a) => {
      if (status === 'ACTIVE' && isFinalApp(a.status)) return false;
      if (status && status !== 'ACTIVE' && a.status !== status) return false;
      if (posting && String(a.postingId) !== posting) return false;
      if (!q) return true;
      return [a.studentCode, a.nameTh, a.companyName, a.positionTitle].join(' ').toLowerCase().includes(q);
    });
  }

  w.renderCoopApplications = function () {
    const tbody = $('coop-apps-tbody');
    if (!tbody) return;
    const list = filteredApps();
    if (!applications.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-gray-400">ยังไม่มีนิสิตสมัครสหกิจ</td></tr>';
    } else if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-gray-400">ไม่พบใบสมัครตามเงื่อนไขที่เลือก</td></tr>';
    } else {
      tbody.innerHTML = list.map(appRowHtml).join('');
    }
    updateAppSelectionUi();
  };

  function appRowHtml(a: any): string {
    const st = APP_STATUS_STYLE[a.status] || APP_STATUS_STYLE.SUBMITTED;
    const lowGpa = a.gpa !== null && a.gpa !== undefined && Number(a.gpa) < coopMinGpax;
    const gpa = a.gpa === null || a.gpa === undefined ? '<span style="color:#94A3B8;">-</span>'
      : `<span style="font-weight:700; color:${lowGpa ? '#DC2626' : '#1E293B'};" title="${lowGpa ? `ต่ำกว่าเกณฑ์สหกิจ ${coopMinGpax.toFixed(2)}` : ''}">${Number(a.gpa).toFixed(2)}${lowGpa ? ' ⚠️' : ''}</span>`;
    const link = (href: string, label: string) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" style="color:#4338CA; font-weight:600;">${label}</a>`;
    const docs = [
      link(a.resumeUrl, 'Resume'),
      link(a.transcriptUrl, 'Transcript'),
      a.portfolioUrl ? link(a.portfolioUrl, 'Portfolio') : '',
      a.portfolioLink ? link(a.portfolioLink, 'ลิงก์ Portfolio') : '',
    ].filter(Boolean).join(' · ');
    const next = nextStatuses(a);
    const statusSelect = next.length
      ? `<select onchange="window.changeCoopAppStatus(${a.id}, this.value); this.value='';" aria-label="เปลี่ยนสถานะ" style="margin-top:6px; width:100%; font-size:12px; padding:4px 6px; border:1px solid #CBD5E1; border-radius:8px; background:#fff;">
          <option value="">เปลี่ยนสถานะ...</option>
          ${next.map((s) => `<option value="${s}">→ ${esc(APP_STATUS_SHORT[s])}</option>`).join('')}
        </select>`
      : '';
    const docStep = a.status === 'ACCEPTED' || (a.docStep && a.docStep !== 'NONE')
      ? `<div style="font-size:11px; margin-top:4px; color:${a.docStep === 'DISPATCH_LETTER' ? '#166534' : '#475569'}; font-weight:700;">📄 ${esc(DOC_STEP_SHORT[a.docStep] || '')}</div>`
      : '';
    const docBtn = a.status === 'ACCEPTED'
      ? `<button type="button" onclick="window.openCoopDocStep(${a.id})" style="margin-top:6px; width:100%; display:inline-flex; align-items:center; justify-content:center; gap:4px; background:#fff; color:#166534; border:1px solid #86EFAC; border-radius:8px; padding:4px 8px; font-size:12px; font-weight:700; cursor:pointer;"><span class="material-icons" style="font-size:15px;">description</span> เอกสารหลังผ่าน</button>`
      : '';
    return `<tr style="${isFinalApp(a.status) ? 'background:#F8FAFC; opacity:.8;' : ''}">
      <td class="text-center">${isFinalApp(a.status) ? '' : `<input type="checkbox" ${selectedApps.has(a.id) ? 'checked' : ''} onchange="window.toggleCoopApp(${a.id}, this.checked)" aria-label="เลือกใบสมัคร" style="width:16px; height:16px; cursor:pointer;" />`}</td>
      <td>
        <div style="font-weight:700; color:#1E293B;">${esc(a.studentCode)} ${esc(a.nameTh)}</div>
        <div style="font-size:11.5px; color:#64748B;">${esc(a.major)}</div>
      </td>
      <td class="text-center">${gpa}</td>
      <td>
        <div style="font-weight:700; color:#1E293B;">${esc(a.companyName)}</div>
        <div style="font-size:12px; color:#475569;">${esc(a.positionTitle)}</div>
      </td>
      <td style="font-size:12.5px;">${esc(a.term || '-')}</td>
      <td style="font-size:12.5px;">${esc(thDate(a.createdAt))}</td>
      <td class="text-center">
        <span style="display:inline-block; background:${st.bg}; color:${st.color}; border:1px solid ${st.border}; padding:3px 9px; border-radius:999px; font-size:11.5px; font-weight:700;">${esc(APP_STATUS_SHORT[a.status] || a.status)}</span>
        ${a.statusNote ? `<div style="font-size:11px; color:#64748B; margin-top:3px;" title="${esc(a.statusNote)}">${esc(a.statusNote.length > 40 ? a.statusNote.slice(0, 40) + '…' : a.statusNote)}</div>` : ''}
        ${docStep}
      </td>
      <td style="font-size:12px;">
        <a href="/api/admin/super-admin/coop-applications/${a.id}/pdf" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; gap:4px; background:#4338CA; color:#fff; border-radius:8px; padding:4px 10px; font-weight:700; text-decoration:none;">
          <span class="material-icons" style="font-size:15px;">picture_as_pdf</span> PDF รวม
        </a>
        <div style="margin-top:4px;">${docs}</div>
        ${docBtn}
        ${statusSelect}
      </td>
    </tr>`;
  }

  function updateAppSelectionUi() {
    const bar = $('coop-app-bulk');
    if (bar) bar.style.display = selectedApps.size ? 'flex' : 'none';
    const count = $('coop-app-bulk-count');
    if (count) count.textContent = String(selectedApps.size);
    const all = $('coop-app-select-all');
    if (all) {
      const selectable = filteredApps().filter((a) => !isFinalApp(a.status));
      const n = selectable.filter((a) => selectedApps.has(a.id)).length;
      all.checked = selectable.length > 0 && n === selectable.length;
      all.indeterminate = n > 0 && n < selectable.length;
    }
  }

  w.toggleCoopApp = function (id: number, checked: boolean) {
    if (checked) selectedApps.add(id);
    else selectedApps.delete(id);
    updateAppSelectionUi();
  };

  w.toggleAllCoopApps = function (checked: boolean) {
    filteredApps().filter((a) => !isFinalApp(a.status)).forEach((a) => (checked ? selectedApps.add(a.id) : selectedApps.delete(a.id)));
    w.renderCoopApplications();
  };

  w.clearCoopAppSelection = function () {
    selectedApps.clear();
    w.renderCoopApplications();
  };

  async function submitAppStatus(ids: number[], status: string) {
    if (!ids.length) return;
    const label = APP_STATUS_SHORT[status] || status;
    let note = '';
    if (isFinalApp(status)) {
      const input = prompt(status === 'CANCELLED'
        ? `ระบุเหตุผลที่ "ยกเลิกใบสมัคร" (${ids.length} ใบ) เช่น นิสิตขอถอนตัว — นิสิตจะเห็นข้อความนี้ และใบสมัครจะเข้าประวัติ:`
        : `ระบุเหตุผลที่ "ไม่ผ่าน" (${ids.length} ใบ) — นิสิตจะเห็นข้อความนี้ และใบสมัครจะเข้าประวัติ:`);
      if (input === null) return;
      note = input.trim();
      if (!note) {
        alert('กรุณาระบุเหตุผล');
        return;
      }
    } else if (!confirm(`เปลี่ยน ${ids.length} ใบสมัครเป็น "${label}" หรือไม่?\n\nนิสิตจะเห็นสถานะนี้ในแท็บสหกิจศึกษา`)) {
      return;
    }
    const data = await sendJson('/api/admin/super-admin/coop-applications/status', 'POST', { ids, status, note }, true);
    alert((data.success ? '✅ ' : '') + (data.message || 'ทำรายการไม่สำเร็จ'));
    if (data.success) {
      ids.forEach((id) => selectedApps.delete(id));
      await w.loadCoopApplications();
      await w.loadCoopPostings();
    }
  }

  w.changeCoopAppStatus = function (id: number, status: string) {
    if (status) submitAppStatus([id], status);
  };

  w.bulkCoopAppStatus = function (status: string) {
    submitAppStatus(Array.from(selectedApps), status);
  };

  // ---------------------------------------------------------------------
  // ขั้นเอกสารหลังผ่านการคัดเลือก (หนังสือขอความอนุเคราะห์ -> แบบตอบรับ -> หนังสือส่งตัว)
  // ---------------------------------------------------------------------
  const DOC_STEP_ORDER = ['NONE', 'REQUEST_LETTER', 'ACCEPTANCE_FORM', 'DISPATCH_LETTER'];

  w.openCoopDocStep = function (id: number) {
    const a = applications.find((x) => x.id === id);
    if (!a) return;
    $('coop-docstep-modal')?.remove();
    const cur = DOC_STEP_ORDER.indexOf(a.docStep || 'NONE');
    const suggested = DOC_STEP_ORDER[Math.min(cur + 1, DOC_STEP_ORDER.length - 1)];
    const steps = (a.docSteps || []) as any[];
    const modal = document.createElement('div');
    modal.id = 'coop-docstep-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'coop-docstep-title');
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,.45); display:flex; align-items:center; justify-content:center; z-index:1000; padding:16px;';
    modal.innerHTML = `<div style="background:#fff; border-radius:16px; width:100%; max-width:520px; max-height:90vh; overflow:auto; box-shadow:0 20px 50px rgba(15,23,42,.3);">
      <div style="padding:14px 18px; border-bottom:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <div>
          <div id="coop-docstep-title" style="font-weight:800; color:#1E1B4B;">เอกสารหลังผ่านการคัดเลือก</div>
          <div style="font-size:12.5px; color:#475569;">${esc(a.studentCode)} ${esc(a.nameTh)} · ${esc(a.companyName)}</div>
        </div>
        <button type="button" data-close aria-label="ปิด" style="background:none; border:none; cursor:pointer; color:#64748B;"><span class="material-icons">close</span></button>
      </div>
      <div style="padding:14px 18px; font-size:13px; color:#1E293B;">
        <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">
          ${steps.map((d) => `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; color:${d.done ? '#166534' : '#94A3B8'};">
            <span class="material-icons" style="font-size:17px;">${d.done ? 'check_circle' : 'radio_button_unchecked'}</span>
            <span style="font-weight:${d.done ? 700 : 500};">${esc(d.label)}</span>
            ${d.done && d.at ? `<span style="color:#64748B; font-size:12px;">${esc(thDate(d.at))}</span>` : ''}
            ${d.url ? `<a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer" style="color:#4338CA; font-size:12px; font-weight:600;">เปิดไฟล์</a>` : ''}
          </div>`).join('')}
        </div>
        <label style="display:block; font-weight:700; font-size:12.5px; margin-bottom:4px;" for="coop-docstep-select">ตั้งขั้นเอกสารเป็น</label>
        <select id="coop-docstep-select" class="input-field" style="margin:0 0 10px; width:100%; font-size:13px;">
          ${DOC_STEP_ORDER.map((k) => `<option value="${k}" ${k === suggested ? 'selected' : ''}>${esc(DOC_STEP_SHORT[k])}${k === (a.docStep || 'NONE') ? ' (ขั้นปัจจุบัน)' : ''}</option>`).join('')}
        </select>
        <label style="display:block; font-weight:700; font-size:12.5px; margin-bottom:4px;" for="coop-docstep-file">แนบไฟล์ของขั้นนี้ (ไม่บังคับ)</label>
        <input type="file" id="coop-docstep-file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style="font-size:12.5px; width:100%;" />
        <div style="font-size:11.5px; color:#64748B; margin-top:4px; line-height:1.6;">PDF / JPG / PNG ไม่เกิน 10 MB · นิสิตเปิดดูไฟล์ได้ในแท็บสหกิจ · ย้อนขั้น = ล้างวันที่และไฟล์ของขั้นที่เลยมา</div>
        <div id="coop-docstep-error" role="alert" style="display:none; margin-top:10px; padding:8px 10px; background:#FEF2F2; border:1px solid #FCA5A5; border-radius:8px; color:#991B1B; font-size:12.5px;"></div>
      </div>
      <div style="padding:12px 18px; border-top:1px solid #E2E8F0; display:flex; justify-content:flex-end; gap:8px;">
        <button type="button" data-close class="btn btn-secondary btn-sm">ยกเลิก</button>
        <button type="button" id="coop-docstep-save" class="btn btn-primary btn-sm"><span class="material-icons">save</span> บันทึก</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.addEventListener('click', (e) => {
      if (e.target === modal || (e.target as HTMLElement).closest('[data-close]')) close();
    });
    const showErr = (msg: string) => {
      const el = $('coop-docstep-error');
      el.textContent = msg;
      el.style.display = msg ? 'block' : 'none';
    };
    $('coop-docstep-save').addEventListener('click', async () => {
      const step = $('coop-docstep-select').value;
      const file = ($('coop-docstep-file') as HTMLInputElement).files?.[0];
      if (file && step === 'NONE') return showErr('เลือกขั้นเอกสารก่อนแนบไฟล์');
      if (file && file.size > 10 * 1024 * 1024) return showErr('ไฟล์ใหญ่เกิน 10 MB');
      if (DOC_STEP_ORDER.indexOf(step) < cur && !confirm('ย้อนขั้นเอกสาร — วันที่และไฟล์ของขั้นที่เลยมาจะถูกล้าง ยืนยันหรือไม่?')) return;
      const btn = $('coop-docstep-save') as HTMLButtonElement;
      btn.disabled = true;
      showErr('');
      try {
        const fd = new FormData();
        fd.append('step', step);
        if (file) fd.append('file', file);
        const res = await fetch(`/api/admin/super-admin/coop-applications/${id}/doc-step`, { method: 'POST', body: fd });
        const data = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
        if (!data.success) {
          showErr(data.message || 'บันทึกไม่สำเร็จ');
          btn.disabled = false;
          return;
        }
        close();
        alert('✅ ' + data.message);
        await w.loadCoopApplications();
      } catch {
        showErr('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่');
        btn.disabled = false;
      }
    });
    ($('coop-docstep-select') as HTMLSelectElement).focus();
  };

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('coop-docstep-modal')) $('coop-docstep-modal').remove();
    else if ($('coop-import-modal')?.style.display === 'flex') w.closeCoopImportModal();
    else if ($('coop-posting-modal')?.style.display === 'flex') w.closeCoopPostingModal();
  });

  // ตัวเลขบนเมนูซ้าย ("N ใบสมัครใหม่" / "N เปิดรับ") โหลดตั้งแต่เปิดหน้า
  document.addEventListener('DOMContentLoaded', () => {
    if ($('badge-coop-postings')) w.loadCoopPostings();
  });
})();
