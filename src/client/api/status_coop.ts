// status_coop.ts — แท็บ "สหกิจศึกษา" ฝั่งนิสิต (หน้า status-all)
// - ตารางประกาศรับนิสิตสหกิจ (ดูได้ทุกคน) + หน้าต่างรายละเอียด — ไม่มีข้อมูลผู้ติดต่อ HR (API ไม่ส่งมา)
// - การสมัคร: เลือกบริษัท/ตำแหน่ง + แนบ Resume / Transcript / Portfolio (ทีละ 1 ที่ · เลือกได้ทางเดียว ฝึกงาน หรือ สหกิจ)
// - สถานะใบสมัคร (เจ้าหน้าที่เปลี่ยน) + ขั้นเอกสารหลังผ่าน (ไฟล์ที่เจ้าหน้าที่แนบ) + ประวัติใบที่ไม่ผ่าน/ยกเลิก
// - ยกเลิกใบสมัครเองได้เฉพาะตอน "ส่งใบสมัครแล้ว" (หลังจากนั้นต้องให้เจ้าหน้าที่ยกเลิกให้)
// รอบเทอม / วันปิดยื่น / ช่วงฝึก = รอบออกฝึกของสาขานิสิต (รอบเดียวกับฝึกงานปกติ)
// API: GET /api/student/coop-postings, POST /api/student/coop-applications, POST /api/student/coop-applications/:id/cancel (src/api/coopRoutes.ts)
// ห่อด้วย IIFE เพราะสคริปต์ฝั่ง client ใช้ global scope ร่วมกับ status_all.js
(function () {
  const $ = (id: string) => document.getElementById(id) as any;
  if (!$('coop-student-tbody')) return;

  type Round = { term: string; status: string; statusLabel: string; isOpen: boolean; closeDate: string; internStartDate: string; internEndDate: string };
  type Apply = { canApply: boolean; reasons: string[]; chosenInternship: boolean; cv: { url: string; name: string } | null; windows: { id: number; label: string }[] };

  let postings: any[] = [];
  let student: { gpa: number | null; minGpax: number; gpaxBelowMin: boolean } = { gpa: null, minGpax: 2, gpaxBelowMin: false };
  let round: Round | null = null;
  let apply: Apply = { canApply: false, reasons: [], chosenInternship: false, cv: null, windows: [] };
  let application: any = null;
  let history: any[] = [];
  let submitting = false;

  const MAX_FILE = 10 * 1024 * 1024;

  function esc(v: unknown): string {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
  }

  const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function thaiDate(ymd: string): string {
    const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${Number(m[1]) + 543}` : '';
  }
  const thaiDateTime = (v: string) => (v ? new Date(v).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

  const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
    OPEN: { bg: '#DCFCE7', color: '#166534' },
    CLOSED: { bg: '#F1F5F9', color: '#475569' },
  };
  function statusChip(p: any): string {
    const st = STATUS_STYLE[p.status] || STATUS_STYLE.CLOSED;
    return `<span style="display:inline-block; background:${st.bg}; color:${st.color}; border-radius:999px; padding:1px 8px; font-size:11px; font-weight:700; white-space:nowrap;">${esc(p.statusLabel)}</span>`;
  }

  const APP_STYLE: Record<string, { bg: string; color: string; border: string; icon: string }> = {
    SUBMITTED: { bg: '#FEF3C7', color: '#92400E', border: '#FCD34D', icon: 'hourglass_top' },
    SENT_TO_COMPANY: { bg: '#E0F2FE', color: '#075985', border: '#7DD3FC', icon: 'forward_to_inbox' },
    ACCEPTED: { bg: '#DCFCE7', color: '#166534', border: '#86EFAC', icon: 'verified' },
    REJECTED: { bg: '#FEE2E2', color: '#991B1B', border: '#FCA5A5', icon: 'cancel' },
    CANCELLED: { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1', icon: 'block' },
  };

  function periodText(r: Round): string {
    if (!r.internStartDate && !r.internEndDate) return 'เจ้าหน้าที่ยังไม่กำหนดวัน';
    return `${thaiDate(r.internStartDate) || '-'} – ${thaiDate(r.internEndDate) || '-'}`;
  }

  // แถบรอบของนิสิตด้านบน (ใช้ร่วมกับฝึกงานปกติ)
  function renderRound() {
    const el = $('coop-student-round');
    if (!el) return;
    if (!round) {
      el.innerHTML = '<span class="material-icons" style="font-size:18px; color:#64748B;">event</span><span>สาขาของคุณยังไม่มีรอบออกฝึก — เจ้าหน้าที่จะเปิดรอบในแท็บรอบฝึกงาน</span>';
      return;
    }
    el.innerHTML = `<span class="material-icons" style="font-size:18px; color:#4338CA;">event</span>
      <span>รอบออกฝึกของคุณ <strong>${esc(round.term)}</strong> · ${esc(round.statusLabel)}
      ${round.closeDate ? ` · ปิดยื่น <strong>${esc(thaiDate(round.closeDate))}</strong>` : ''}
      · ช่วงฝึก ${esc(periodText(round))}</span>`;
  }

  // ---------------------------------------------------------------------
  // ส่วนสมัคร / สถานะใบสมัคร
  // ---------------------------------------------------------------------
  function fileLink(url: string, label: string) {
    return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="color:#4338CA; font-weight:600;">${esc(label)}</a>` : '';
  }

  function applicationCardHtml(a: any): string {
    const st = APP_STYLE[a.status] || APP_STYLE.SUBMITTED;
    const steps = [
      { key: 'SUBMITTED', label: 'ส่งใบสมัคร' },
      { key: 'SENT_TO_COMPANY', label: 'คณะส่งเอกสารให้บริษัท' },
      { key: 'ACCEPTED', label: 'ผ่านการคัดเลือก' },
    ];
    const reached = { SUBMITTED: 0, SENT_TO_COMPANY: 1, ACCEPTED: 2 }[a.status as string] ?? 0;
    const message: Record<string, string> = {
      SUBMITTED: 'เจ้าหน้าที่กำลังตรวจใบสมัคร แล้วจะส่งเอกสารให้บริษัท',
      SENT_TO_COMPANY: 'คณะส่งเอกสารของคุณให้บริษัทแล้ว — รอบริษัทพิจารณา (อาจมีการติดต่อนัดสัมภาษณ์)',
      ACCEPTED: 'ยินดีด้วย! คุณผ่านการคัดเลือก — คณะจะดำเนินการหนังสือขอความอนุเคราะห์ แบบตอบรับ และหนังสือส่งตัวให้',
    };
    // ขั้นเอกสารหลังผ่าน (เจ้าหน้าที่เลื่อนขั้น + แนบไฟล์ได้)
    const docStepsHtml = a.status === 'ACCEPTED' && Array.isArray(a.docSteps)
      ? `<div style="margin-top:10px; padding:10px 12px; border:1px solid #E2E8F0; border-radius:12px; background:#F8FAFC;">
          <div style="font-size:12.5px; font-weight:800; color:#1E293B; margin-bottom:6px;">เอกสารจากคณะ</div>
          <div style="display:flex; flex-direction:column; gap:5px;">
            ${a.docSteps.map((d: any) => `<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:12.5px; color:${d.done ? '#166534' : '#94A3B8'};">
              <span class="material-icons" style="font-size:16px;">${d.done ? 'check_circle' : 'radio_button_unchecked'}</span>
              <span style="font-weight:${d.done ? 700 : 500};">${esc(d.done ? d.label : d.label.replace(/แล้ว$/, ''))}</span>
              ${d.done && d.at ? `<span style="color:#64748B;">(${esc(thaiDateTime(d.at))})</span>` : ''}
              ${d.done && d.url ? fileLink(d.url, `เปิด${d.fileLabel}`) : ''}
            </div>`).join('')}
          </div>
        </div>`
      : '';
    const cancelHtml = a.canCancel
      ? `<div style="margin-top:10px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary btn-sm" data-coop-cancel="${a.id}" style="color:#B91C1C; border-color:#FCA5A5;"><span class="material-icons">block</span> ยกเลิกใบสมัคร</button>
          <span style="font-size:12px; color:#64748B;">ยกเลิกเองได้จนกว่าเจ้าหน้าที่จะส่งเอกสารให้บริษัท</span>
        </div>`
      : `<div style="margin-top:8px; font-size:12px; color:#64748B;">ต้องการยกเลิกใบสมัคร? ติดต่อเจ้าหน้าที่ฝ่ายฝึกงาน (คณะส่งเอกสารให้บริษัทแล้ว ยกเลิกเองไม่ได้)</div>`;
    const docs = [
      fileLink(a.resumeUrl, 'Resume'),
      fileLink(a.transcriptUrl, 'Transcript'),
      fileLink(a.portfolioUrl, 'Portfolio'),
      fileLink(a.portfolioLink, 'ลิงก์ Portfolio'),
    ].filter(Boolean).join(' · ');
    return `<div style="border:1px solid ${st.border}; background:#FFFFFF; border-radius:14px; overflow:hidden;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; padding:10px 14px; background:${st.bg};">
        <div style="font-weight:800; color:#1E293B;">ใบสมัครสหกิจของคุณ</div>
        <span style="display:inline-flex; align-items:center; gap:4px; color:${st.color}; font-weight:800; font-size:12.5px;"><span class="material-icons" style="font-size:16px;">${st.icon}</span>${esc(a.statusLabel)}</span>
      </div>
      <div style="padding:12px 14px; font-size:13px; color:#1E293B; line-height:1.7;">
        <div><strong>${esc(a.companyName)}</strong> · ${esc(a.positionTitle)}</div>
        <div style="color:#475569; font-size:12.5px;">รอบ ${esc(a.term || '-')} · สมัครเมื่อ ${esc(thaiDateTime(a.createdAt))}</div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin:10px 0 8px;">
          ${steps.map((s, i) => `<span style="display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:700;
              background:${i <= reached ? '#4338CA' : '#F1F5F9'}; color:${i <= reached ? '#FFFFFF' : '#94A3B8'};">${i + 1}. ${esc(s.label)}</span>${i < steps.length - 1 ? '<span style="color:#CBD5E1;">→</span>' : ''}`).join('')}
        </div>
        <div style="color:#334155;">${esc(message[a.status] || '')}</div>
        ${a.statusNote ? `<div style="margin-top:6px; font-size:12.5px; color:#475569;">หมายเหตุจากเจ้าหน้าที่: ${esc(a.statusNote)}</div>` : ''}
        <div style="margin-top:6px; font-size:12.5px;">เอกสารที่ส่ง: ${docs}</div>
        ${docStepsHtml}
        ${cancelHtml}
      </div>
    </div>`;
  }

  function lockedHtml(): string {
    const intro = apply.chosenInternship
      ? 'คุณเลือกเส้นทาง <strong>ฝึกงาน</strong> แล้ว (นิสิตเลือกได้ทางเดียว) — ยังดูประกาศสหกิจได้ แต่สมัครไม่ได้'
      : 'ยังสมัครสหกิจไม่ได้ เพราะ:';
    const reasons = apply.chosenInternship ? [] : apply.reasons;
    return `<div style="display:flex; gap:10px; align-items:flex-start; padding:12px 14px; background:#F8FAFC; border:1px dashed #CBD5E1; border-radius:14px; font-size:13px; color:#334155;">
      <span class="material-icons" style="color:#94A3B8;">lock</span>
      <div>
        <div style="font-weight:700;">${intro}</div>
        ${reasons.length ? `<ul style="margin:6px 0 0; padding-left:18px; line-height:1.7;">${reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      </div>
    </div>`;
  }

  function openPostings() {
    return postings.filter((p) => p.status === 'OPEN' && p.positions.length);
  }

  function formHtml(): string {
    const label = (t: string, req = false) => `<div style="font-size:12.5px; font-weight:700; color:#334155; margin-bottom:4px;">${t}${req ? ' <span style="color:#DC2626;">*</span>' : ''}</div>`;
    const input = 'class="input-field" style="margin:0; width:100%; font-size:13px;"';
    return `<form id="coop-apply-form" novalidate style="border:1px solid #C7D2FE; background:#F8FAFF; border-radius:14px; padding:14px 16px;">
      <div style="font-size:14px; font-weight:800; color:#1E1B4B; margin-bottom:10px;">สมัครสหกิจศึกษา</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px 14px;">
        <label>${label('บริษัท', true)}
          <select id="coop-apply-posting" ${input}>
            <option value="">— เลือกบริษัท —</option>
            ${openPostings().map((p) => `<option value="${p.id}">${esc(p.companyName)}${p.province ? ` (${esc(p.province)})` : ''}</option>`).join('')}
          </select>
        </label>
        <label>${label('ตำแหน่งที่เปิดรับ', true)}
          <select id="coop-apply-position" ${input} disabled><option value="">— เลือกบริษัทก่อน —</option></select>
        </label>
        ${apply.windows.length > 1 ? `<label>${label('รอบออกฝึก', true)}
          <select id="coop-apply-window" ${input}>
            <option value="">— เลือกรอบ —</option>
            ${apply.windows.map((w) => `<option value="${w.id}">${esc(w.label)}</option>`).join('')}
          </select></label>` : ''}
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px 14px; margin-top:14px;">
        <div>${label('Resume', true)}
          ${apply.cv ? `<label style="display:flex; gap:6px; align-items:center; font-size:12.5px; cursor:pointer;">
              <input type="radio" name="coop-resume-source" value="cv" checked /> ใช้ Resume (CV) ที่อัปโหลดไว้ · ${fileLink(apply.cv.url, apply.cv.name)}</label>
            <label style="display:flex; gap:6px; align-items:center; font-size:12.5px; cursor:pointer; margin-top:4px;">
              <input type="radio" name="coop-resume-source" value="upload" /> อัปโหลดไฟล์ใหม่</label>` : '<input type="hidden" name="coop-resume-source" value="upload" />'}
          <input type="file" id="coop-apply-resume" accept=".pdf,.jpg,.jpeg,.png" style="margin-top:6px; font-size:12.5px; ${apply.cv ? 'display:none;' : ''}" />
        </div>
        <div>${label('Transcript (ใบแสดงผลการเรียน)', true)}
          <input type="file" id="coop-apply-transcript" accept=".pdf,.jpg,.jpeg,.png" style="font-size:12.5px;" />
        </div>
        <div>${label('Portfolio (ไม่บังคับ)')}
          <input type="file" id="coop-apply-portfolio" accept=".pdf,.jpg,.jpeg,.png" style="font-size:12.5px;" />
          <input type="url" id="coop-apply-portfolio-link" ${input.replace('style="', 'style="margin-top:6px !important; ')} placeholder="หรือวางลิงก์ เช่น GitHub / Behance / Google Drive" />
        </div>
      </div>
      <div style="font-size:11.5px; color:#64748B; margin-top:8px;">ไฟล์ PDF / JPG / PNG ไม่เกิน 10 MB ต่อไฟล์ · ระบบจะรวม Resume → Transcript → Portfolio เป็น PDF ไฟล์เดียวให้เจ้าหน้าที่ส่งบริษัท</div>
      ${student.gpaxBelowMin && student.gpa !== null ? `<div style="margin-top:10px; padding:9px 12px; background:#FFFBEB; border:1px solid #FCD34D; border-radius:10px; font-size:12.5px; color:#92400E;">⚠️ GPAX ของคุณ (${student.gpa.toFixed(2)}) ต่ำกว่าเกณฑ์สหกิจศึกษา (${student.minGpax.toFixed(2)}) — ยังสมัครได้ แต่โอกาสผ่านการคัดเลือกอาจลดลง</div>` : ''}
      <div id="coop-apply-error" role="alert" style="display:none; margin-top:10px; padding:9px 12px; background:#FEF2F2; border:1px solid #FECACA; border-radius:10px; color:#991B1B; font-size:12.5px;"></div>
      <div style="display:flex; justify-content:flex-end; margin-top:12px;">
        <button type="submit" id="coop-apply-submit" class="btn btn-primary btn-md"><span class="material-icons">send</span> ส่งใบสมัคร</button>
      </div>
    </form>`;
  }

  function historyHtml(): string {
    if (!history.length) return '';
    return `<details style="margin-top:12px;">
      <summary style="cursor:pointer; font-size:12.5px; font-weight:700; color:#475569;">ประวัติใบสมัคร (ไม่ผ่าน / ยกเลิก) (${history.length})</summary>
      <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
        ${history.map((h) => `<div style="padding:8px 12px; border:1px solid #E2E8F0; border-radius:10px; background:#F8FAFC; font-size:12.5px; color:#334155;">
          <strong>${esc(h.companyName)}</strong> · ${esc(h.positionTitle)} <span style="color:#94A3B8;">(สมัคร ${esc(thaiDateTime(h.createdAt))})</span>
          <span style="font-weight:700; color:${(APP_STYLE[h.status] || APP_STYLE.REJECTED).color};">· ${esc(h.statusLabel)}</span>
          ${h.statusNote ? `<div style="color:${h.status === 'CANCELLED' ? '#475569' : '#991B1B'};">เหตุผล: ${esc(h.statusNote)}</div>` : ''}
        </div>`).join('')}
      </div>
    </details>`;
  }

  function renderApply() {
    const box = $('coop-student-apply');
    if (!box) return;
    let main: string;
    if (application) main = applicationCardHtml(application);
    else if (!apply.canApply) main = lockedHtml();
    else if (!openPostings().length) main = '<div style="padding:12px 14px; background:#F8FAFC; border:1px dashed #CBD5E1; border-radius:14px; font-size:13px; color:#475569;">ตอนนี้ยังไม่มีบริษัทที่เปิดรับสมัคร</div>';
    else main = formHtml();
    box.innerHTML = main + historyHtml();
    if (!application && apply.canApply) bindForm();
  }

  function fillPositions(postingId: string, selectPositionId?: number) {
    const sel = $('coop-apply-position');
    if (!sel) return;
    const p = postings.find((x) => String(x.id) === String(postingId));
    if (!p) {
      sel.innerHTML = '<option value="">— เลือกบริษัทก่อน —</option>';
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    sel.innerHTML = '<option value="">— เลือกตำแหน่ง —</option>' +
      p.positions.map((x: any) => `<option value="${x.id}">${esc(x.title)}${x.seats ? ` (รับ ${x.seats} คน)` : ''}</option>`).join('');
    if (selectPositionId) sel.value = String(selectPositionId);
    else if (p.positions.length === 1) sel.value = String(p.positions[0].id);
  }

  function showApplyError(msg: string) {
    const el = $('coop-apply-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
    if (msg) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function bindForm() {
    const form = $('coop-apply-form');
    if (!form) return;
    $('coop-apply-posting')?.addEventListener('change', (e: Event) => fillPositions((e.target as HTMLSelectElement).value));
    form.querySelectorAll('input[name="coop-resume-source"]').forEach((r: Element) =>
      r.addEventListener('change', () => {
        const upload = (form.querySelector('input[name="coop-resume-source"]:checked') as HTMLInputElement | null)?.value === 'upload';
        $('coop-apply-resume').style.display = upload ? '' : 'none';
      })
    );
    form.addEventListener('submit', submitApplication);
  }

  async function submitApplication(e: Event) {
    e.preventDefault();
    if (submitting) return;
    showApplyError('');
    const postingId = $('coop-apply-posting')?.value || '';
    const positionId = $('coop-apply-position')?.value || '';
    const windowSel = $('coop-apply-window');
    const source = (document.querySelector('input[name="coop-resume-source"]:checked') as HTMLInputElement | null)?.value
      || (document.querySelector('input[name="coop-resume-source"]') as HTMLInputElement | null)?.value || 'upload';
    const resume = $('coop-apply-resume')?.files?.[0];
    const transcript = $('coop-apply-transcript')?.files?.[0];
    const portfolio = $('coop-apply-portfolio')?.files?.[0];
    const link = String($('coop-apply-portfolio-link')?.value || '').trim();

    if (!postingId || !positionId) return showApplyError('กรุณาเลือกบริษัทและตำแหน่ง');
    if (windowSel && !windowSel.value) return showApplyError('กรุณาเลือกรอบออกฝึก');
    if (source === 'upload' && !resume) return showApplyError('กรุณาแนบไฟล์ Resume');
    if (!transcript) return showApplyError('กรุณาแนบไฟล์ Transcript');
    for (const [f, name] of [[resume, 'Resume'], [transcript, 'Transcript'], [portfolio, 'Portfolio']] as const) {
      if (!f) continue;
      if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) return showApplyError(`${name}: รองรับเฉพาะไฟล์ PDF, JPG หรือ PNG`);
      if (f.size > MAX_FILE) return showApplyError(`${name}: ไฟล์ใหญ่เกิน 10 MB`);
    }

    const p = postings.find((x) => String(x.id) === String(postingId));
    const pos = p?.positions.find((x: any) => String(x.id) === String(positionId));
    if (!confirm(`ยืนยันส่งใบสมัครสหกิจ\n\n${p?.companyName} · ${pos?.title}\n\nเมื่อส่งแล้ว จะยื่นสถานประกอบการแบบฝึกงานไม่ได้ จนกว่าจะได้ผลว่า "ไม่ผ่าน" (เลือกได้ทางเดียว และสมัครสหกิจได้ทีละ 1 ที่)`)) return;

    const fd = new FormData();
    fd.append('positionId', positionId);
    if (windowSel) fd.append('windowId', windowSel.value);
    fd.append('resumeSource', source === 'upload' ? 'upload' : 'cv');
    if (source === 'upload' && resume) fd.append('resume', resume);
    fd.append('transcript', transcript);
    if (portfolio) fd.append('portfolio', portfolio);
    if (link) fd.append('portfolioLink', link);

    const btn = $('coop-apply-submit');
    submitting = true;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="material-icons">hourglass_top</span> กำลังอัปโหลด...';
    }
    try {
      const res = await fetch('/api/student/coop-applications', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({ success: false, message: `เซิร์ฟเวอร์ตอบกลับ HTTP ${res.status}` }));
      if (!data.success) {
        showApplyError(data.message || 'ส่งใบสมัครไม่สำเร็จ');
        return;
      }
      alert('✅ ' + data.message);
      await load();
      $('coop-student-apply')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch {
      showApplyError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่');
    } finally {
      submitting = false;
      if (btn && document.body.contains(btn)) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons">send</span> ส่งใบสมัคร';
      }
    }
  }

  // ปุ่ม "สมัคร" ในตาราง -> เลือกบริษัท/ตำแหน่งในฟอร์มให้ แล้วเลื่อนขึ้นไปที่ฟอร์ม
  function pickFromTable(postingId: number, positionId: number) {
    const sel = $('coop-apply-posting');
    if (!sel) return;
    sel.value = String(postingId);
    fillPositions(String(postingId), positionId);
    $('coop-apply-form')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // ---------------------------------------------------------------------
  // ตารางประกาศ (1 แถว = 1 ตำแหน่ง)
  // ---------------------------------------------------------------------
  function rows() {
    const q = String($('coop-student-search')?.value || '').trim().toLowerCase();
    const onlyOpen = Boolean($('coop-student-only-open')?.checked);
    const out: { p: any; pos: any }[] = [];
    for (const p of postings) {
      if (onlyOpen && p.status !== 'OPEN') continue;
      for (const pos of p.positions) {
        if (q) {
          const hay = [p.companyName, p.companyNameEn, p.province, pos.title].join(' ').toLowerCase();
          if (!hay.includes(q)) continue;
        }
        out.push({ p, pos });
      }
    }
    return out;
  }

  function render() {
    const tbody = $('coop-student-tbody');
    const summary = $('coop-student-summary');
    const list = rows();
    if (summary) {
      const companies = new Set(list.map((r) => r.p.id)).size;
      summary.textContent = postings.length ? `พบ ${list.length} ตำแหน่ง จาก ${companies} บริษัท` : '';
    }
    if (postings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:18px; color:#94A3B8;">ยังไม่มีประกาศรับนิสิตสหกิจศึกษา</td></tr>';
      return;
    }
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:18px; color:#94A3B8;">ไม่พบประกาศตามเงื่อนไข — ลองเอาติ๊ก "เฉพาะที่เปิดรับ" ออก หรือเปลี่ยนคำค้นหา</td></tr>';
      return;
    }
    const canPick = !application && apply.canApply;
    tbody.innerHTML = list
      .map(({ p, pos }) => `<tr style="${p.status !== 'OPEN' ? 'opacity:.65;' : ''}">
          <td>
            <div style="font-weight:700; color:#1E293B;">${esc(p.companyName)}</div>
            ${p.companyNameEn ? `<div style="font-size:11.5px; color:#64748B;">${esc(p.companyNameEn)}</div>` : ''}
            ${p.status !== 'OPEN' ? `<div style="margin-top:2px;">${statusChip(p)}</div>` : ''}
          </td>
          <td>${esc(pos.title)}</td>
          <td class="text-center" style="font-weight:700;">${pos.seats ?? '-'}</td>
          <td>${esc(p.province || '-')}</td>
          <td class="text-center" style="white-space:nowrap;">
            <button type="button" class="btn btn-tonal btn-sm" data-coop-detail="${p.id}:${pos.id}">ดูรายละเอียด</button>
            ${canPick && p.status === 'OPEN' ? `<button type="button" class="btn btn-primary btn-sm" data-coop-pick="${p.id}:${pos.id}" style="margin-left:4px;">สมัคร</button>` : ''}
          </td>
        </tr>`)
      .join('');
  }

  function section(title: string, body: string): string {
    if (!body) return '';
    return `<div style="margin-top:12px;">
      <div style="font-size:12.5px; font-weight:800; color:#334155; margin-bottom:4px;">${title}</div>
      <div style="font-size:13px; color:#1E293B; line-height:1.6;">${body}</div>
    </div>`;
  }
  const multiline = (s: string) => (s ? `<div style="white-space:pre-line;">${esc(s)}</div>` : '');

  function openDetail(postingId: number, positionId: number) {
    const p = postings.find((x) => x.id === postingId);
    if (!p) return;
    const pos = p.positions.find((x: any) => x.id === positionId) || p.positions[0];
    const others = p.positions.filter((x: any) => x.id !== pos?.id);

    $('coop-detail-title').textContent = p.companyName;
    $('coop-detail-subtitle').textContent = p.companyNameEn || '';

    const warnings: string[] = [];
    if (student.gpaxBelowMin && student.gpa !== null) {
      warnings.push(`GPAX ของคุณ (${student.gpa.toFixed(2)}) ต่ำกว่าเกณฑ์สหกิจศึกษา (${student.minGpax.toFixed(2)}) — ยังสมัครได้ แต่โอกาสผ่านการคัดเลือกอาจลดลง`);
    }
    const roundInfo = round
      ? `<div>รอบ ${esc(round.term)}${round.closeDate ? ` · ปิดยื่น ${esc(thaiDate(round.closeDate))}` : ''}</div><div>ช่วงฝึก ${esc(periodText(round))}</div>
         <div style="font-size:12px; color:#64748B;">ตามรอบออกฝึกของสาขาคุณ (เหมือนฝึกงานปกติ)</div>`
      : 'สาขาของคุณยังไม่มีรอบออกฝึก';
    const qualifications = `<div>เปิดรับทุกสาขา · GPAX ขั้นต่ำ ${student.minGpax.toFixed(2)}</div>` + multiline(p.qualifications);
    const place = [
      p.address ? multiline(p.address) : '',
      p.province ? `<div>${p.province === 'ต่างประเทศ' ? 'ต่างประเทศ' : `จังหวัด${esc(p.province)}`}</div>` : '',
      p.website ? `<div><a href="${esc(p.website)}" target="_blank" rel="noopener noreferrer">${esc(p.website)}</a></div>` : '',
    ].join('');
    const canPick = !application && apply.canApply && p.status === 'OPEN';

    $('coop-detail-body').innerHTML = `
      <div>${statusChip(p)}</div>
      ${warnings.map((w) => `<div style="margin-top:10px; padding:9px 12px; background:#FFFBEB; border:1px solid #FCD34D; border-radius:10px; font-size:12.5px; color:#92400E;">⚠️ ${esc(w)}</div>`).join('')}
      ${pos ? `<div style="margin-top:12px; padding:12px 14px; background:#F5F7FF; border:1px solid #C7D2FE; border-radius:12px;">
        <div style="font-size:15px; font-weight:800; color:#1E1B4B;">${esc(pos.title)}</div>
        <div style="font-size:12.5px; color:#475569; margin-top:2px;">รับ ${pos.seats ? `${pos.seats} คน` : '(ไม่ระบุจำนวน)'}</div>
        ${pos.description ? `<div style="font-size:13px; color:#1E293B; margin-top:6px; white-space:pre-line;">${esc(pos.description)}</div>` : ''}
      </div>` : ''}
      ${others.length ? section('ตำแหน่งอื่นของบริษัทนี้', others.map((x: any) => `<div>• ${esc(x.title)} <span style="color:#64748B;">· ${x.seats ? `${x.seats} คน` : 'ไม่ระบุ'}</span></div>`).join('')) : ''}
      ${section('คุณสมบัติ', qualifications)}
      ${section('สวัสดิการ', multiline(p.benefits))}
      ${section('รอบและช่วงเวลาฝึก', roundInfo)}
      ${section('สถานที่', place)}
      ${section('เกี่ยวกับบริษัท', multiline(p.description))}
      ${canPick && pos ? `<div style="display:flex; justify-content:flex-end; margin-top:16px;"><button type="button" class="btn btn-primary btn-md" data-coop-pick="${p.id}:${pos.id}"><span class="material-icons">send</span> สมัครตำแหน่งนี้</button></div>` : ''}`;

    $('coop-detail-modal').style.display = 'flex';
    $('coop-detail-close')?.focus();
  }

  function closeDetail() {
    const modal = $('coop-detail-modal');
    if (modal) modal.style.display = 'none';
  }

  async function cancelApplication(id: number, btn: HTMLButtonElement) {
    if (!application || application.id !== id) return;
    if (!confirm(`ยืนยันยกเลิกใบสมัคร "${application.companyName} · ${application.positionTitle}"?

ใบสมัครจะย้ายไปอยู่ในประวัติ แล้วคุณสมัครที่อื่นหรือไปยื่นสถานประกอบการได้`)) return;
    const reason = prompt('เหตุผลที่ยกเลิก (ไม่บังคับ)', '');
    if (reason === null) return;
    btn.disabled = true;
    try {
      const res = await fetch(`/api/student/coop-applications/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({ success: false, message: 'ยกเลิกไม่สำเร็จ' }));
      alert(data.message || (data.success ? 'ยกเลิกแล้ว' : 'ยกเลิกไม่สำเร็จ'));
      await load();
    } catch {
      alert('ยกเลิกไม่สำเร็จ กรุณาลองใหม่');
      btn.disabled = false;
    }
  }

  async function load() {
    try {
      const res = await fetch('/api/student/coop-postings');
      const data = await res.json().catch(() => ({ success: false }));
      if (!data.success) throw new Error(data.message || 'โหลดไม่สำเร็จ');
      postings = data.postings || [];
      student = data.student || student;
      round = data.round || null;
      apply = data.apply || apply;
      application = data.application || null;
      history = data.history || [];
      renderRound();
      renderApply();
      render();
      // แจ้ง sidebar: จำนวนประกาศที่เปิดรับ + เส้นทางที่เลือก (ล็อกเมนูสถานประกอบการเมื่อสมัครสหกิจอยู่)
      window.dispatchEvent(new CustomEvent('status-all:coop-count', {
        detail: {
          openCount: postings.filter((p) => p.status === 'OPEN').length,
          applicationStatus: application ? application.status : null,
          chosenInternship: Boolean(apply.chosenInternship),
        },
      }));
    } catch (err: any) {
      $('coop-student-tbody').innerHTML = `<tr><td colspan="5" class="text-center" style="padding:18px; color:#991B1B;">โหลดประกาศไม่สำเร็จ (${esc(err?.message)}) — ลองรีเฟรชหน้า</td></tr>`;
    }
  }

  $('coop-student-search')?.addEventListener('input', render);
  $('coop-student-only-open')?.addEventListener('change', render);
  const panel = $('coop-student-tbody').closest('.status-all-panel') || document;
  panel.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    const detail = target.closest<HTMLElement>('[data-coop-detail]');
    if (detail) {
      const [postingId, positionId] = String(detail.dataset.coopDetail).split(':').map(Number);
      openDetail(postingId, positionId);
      return;
    }
    const cancelBtn = target.closest<HTMLButtonElement>('[data-coop-cancel]');
    if (cancelBtn) {
      void cancelApplication(Number(cancelBtn.dataset.coopCancel), cancelBtn);
      return;
    }
    const pick = target.closest<HTMLElement>('[data-coop-pick]');
    if (pick) {
      const [postingId, positionId] = String(pick.dataset.coopPick).split(':').map(Number);
      closeDetail();
      pickFromTable(postingId, positionId);
    }
  });
  $('coop-detail-close')?.addEventListener('click', closeDetail);
  $('coop-detail-modal')?.addEventListener('click', (e: Event) => {
    if (e.target === e.currentTarget) closeDetail();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('coop-detail-modal')?.style.display === 'flex') closeDetail();
  });

  document.addEventListener('DOMContentLoaded', load);
})();
