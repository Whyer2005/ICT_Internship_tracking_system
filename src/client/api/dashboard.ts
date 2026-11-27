// @ts-nocheck
// dashboard.js - ดึงข้อมูลสรุปนิสิตแสดงใน Dashboard

// 3 ขั้นตอนของการ์ดสถานะ (ระดับไฟล์ — ใช้ได้ทั้งกรณีมี/ไม่มีโปรไฟล์; ใช้ var เพราะสคริปต์อาจถูกโหลดซ้ำตอนเปลี่ยนหน้าแบบ SPA)
var stageCards = [
  { cardId: 'stage-prepare',          tagLabel: 'เตรียมเอกสาร',         nextLabel: 'รออนุมัติที่ฝึกงาน' },
  { cardId: 'stage-waiting-approve',  tagLabel: 'รออนุมัติที่ฝึกงาน',   nextLabel: 'อนุมัติแล้ว' },
  { cardId: 'stage-approved',         tagLabel: 'อนุมัติแล้ว',          nextLabel: null },
];

// แถบ "ข้อมูลบริษัทที่สมัครผ่าน" (แนวนอน ใต้ CV / การอบรม)
function renderDashboardCompany(plc) {
  const box = document.getElementById('company-box');
  if (!box) return;
  const clean = (v) => {
    const s = String(v || '').trim();
    return s && s !== '-' ? s : '';
  };
  box.classList.remove('dash-company--empty');

  const name = clean(plc.companyNameTh) || '-';
  setDashText('comp-name', name);

  // ที่อยู่ใต้ชื่อบริษัท: ยังไม่มี/ค่ารอตรวจสอบ → ป้ายสีเหลือง "รอตรวจสอบที่อยู่จากนิสิต" / มีแล้ว → แสดงที่อยู่เต็ม
  const address = clean(plc.companyAddress);
  const hasAddress = window.IctCompanyMap.hasRealAddress(address); // helper กลาง: src/client/components/company_map.ts
  const addrLine = document.getElementById('comp-addr-line');
  if (addrLine) addrLine.className = `dash-company-addr${hasAddress ? '' : ' dash-company-addr--warn'}`;
  setDashText('comp-addr', hasAddress ? address : 'รอตรวจสอบที่อยู่จากนิสิต');
  setDashText('comp-prov', clean(plc.province) && !/^รอระบุ/.test(plc.province) ? plc.province : '-');
  setDashText('comp-phone', clean(plc.companyPhone1) || '-');
  setDashText('comp-email', clean(plc.companyEmail) || '-');
  const details = document.getElementById('company-details');
  if (details) details.style.display = 'flex';

  // ค้นหาสถานประกอบการบน Google Maps: มีหมุด → พิกัด / ไม่มี → ชื่อบริษัท + ที่อยู่
  const btn = document.getElementById('company-search-btn');
  const url = window.IctCompanyMap.mapUrl(address, plc.latitude, plc.longitude, name === '-' ? '' : name);
  if (btn && url) {
    btn.setAttribute('href', url);
    btn.removeAttribute('aria-disabled');
    btn.title = 'เปิดตำแหน่งสถานประกอบการใน Google Maps (แท็บใหม่)';
  }
}

// escape ข้อความก่อนใส่ลง innerHTML (helper กลาง: src/client/components/text_utils.ts — กัน XSS)
function escapeDashHtml(v) {
  return window.IctText.escapeHtml(v);
}

// ตั้ง textContent ตาม id (ไม่มี element ก็ข้าม)
function setDashText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}

// วันที่แบบไทยสั้น เช่น "20 ม.ค. 2569"
// dateOnly: ค่าแบบ @db.Date (เที่ยงคืน UTC) แสดงตาม UTC ไม่ให้คลาด 1 วัน / ค่า DateTime (createdAt, reviewedAt) แสดงตามเวลาเครื่อง
function fmtDashDate(v, { dateOnly = false, empty = '—' } = {}) {
  if (!v) return empty;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return empty;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', ...(dateOnly ? { timeZone: 'UTC' } : {}) });
}

// แถวบนของการ์ด "ข้อมูลและสถานะของนิสิต": ชื่ออังกฤษ / อาจารย์ที่ปรึกษา / ข้อมูลการศึกษา / ติดต่อ
function renderDashboardStudentInfo(s, user) {
  const clean = (v) => {
    const t = String(v || '').trim();
    return t && t !== '-' ? t : '';
  };
  const showRow = (rowId, textId, value) => {
    const row = document.getElementById(rowId);
    if (row) row.hidden = !value;
    if (value) setDashText(textId, value);
  };

  setDashText('display-name-en', clean(s.nameEn).toUpperCase());
  setDashText('display-advisor', clean(s.advisor) || '-');

  // สาขา/หลักสูตรมาจาก server (findMajor ใน src/utils/majors.ts)
  setDashText('display-faculty', clean(s.faculty).replace(/^คณะ\s*/, '') || '-');
  setDashText('display-major', clean(s.majorName) || clean(s.major).replace(/^(สาขาวิชา|สาขา)\s*/, '') || '-');
  // หลักสูตร: ค่าใน DB ก่อน ถ้าว่างใช้หลักสูตรของสาขา (เช่น "วิศวกรรมศาสตรบัณฑิต")
  const curriculum = clean(s.curriculum) || clean(s.degreeName);
  // ตัด "หลักสูตร" หน้า และ "สาขาวิชา..." ท้าย (สาขาแสดงอยู่บรรทัดบนแล้ว)
  setDashText('display-curriculum', curriculum.replace(/^หลักสูตร\s*/, '').replace(/\s*สาขาวิชา.*$/, '') || '-');

  setDashText('display-phone', clean(s.phone) || '-');
  setDashText('display-email', clean(user && user.email) || '-');
  showRow('display-line-row', 'display-line', clean(s.lineId));
  showRow('display-facebook-row', 'display-facebook', clean(s.facebook));
}

// ช่วงฝึกงาน: มีวันที่ → แสดงแบบไทย / ยังไม่มี → "ข้อมูลจาก REG" (วันเริ่มยังไม่มีแหล่งข้อมูล)
function renderDashboardInternPeriod(period) {
  const fmt = (v) => fmtDashDate(v, { dateOnly: true, empty: 'เจ้าหน้าที่ยังไม่กำหนด' }); // ตามรอบออกฝึก
  setDashText('display-intern-start', fmt(period && period.startDate));
  setDashText('display-intern-end', fmt(period && period.endDate));
}

// การ์ด Checklist (ซ้ายสุดของแถบบริษัท): ไอคอน/ป้ายสถานะ + จำนวนบริษัท
function renderDashboardChecklist(companies, approvedCount) {
  const card = document.getElementById('dash-checklist-card');
  if (!card) return;
  const total = companies.length;
  const pending = companies.filter(c => !c.checklistStatus || c.checklistStatus === 'PENDING').length;
  const rejected = companies.filter(c => c.checklistStatus === 'REJECTED').length;

  let tone = 'none', icon = 'playlist_add', label = 'ยังไม่ยื่น';
  if (approvedCount > 0) { tone = 'ok'; icon = 'task_alt'; label = 'ผ่าน'; }
  else if (pending > 0) { tone = 'wait'; icon = 'schedule'; label = 'รอผล'; }
  else if (rejected > 0) { tone = 'bad'; icon = 'cancel'; label = 'ไม่ผ่าน'; }

  card.className = `dash-ckl dash-ckl--${tone}`;
  document.getElementById('dash-ckl-icon').textContent = icon;
  document.getElementById('display-checklist-status').textContent = label;
  document.getElementById('display-checklist-header').textContent = `${total} บริษัท`;
  card.setAttribute('aria-label', `ดูสถานะ Checklist: ${label} ${total} บริษัท`);
}

function loadDashboardData() {
  fetch('/api/student/dashboard-summary')
    .then(res => res.json())
    .then(data => {
    if (!data.success) return;

    const actionBtn = document.getElementById('dashboard-action-btn');
    const actionBtnText = document.getElementById('action-btn-text');

    if (!data.hasProfile) {
      // ภาพ 1: ยังไม่มีข้อมูล
      actionBtn.href = '/personal-info';
      actionBtnText.textContent = 'เพิ่มข้อมูล';
      document.getElementById('display-name').textContent = data.user.username || data.user.email;
      document.getElementById('display-email').textContent = data.user.email || '-';
      updateStageWithDetails(0, data); // ยังไม่มีโปรไฟล์ → แสดง 3 ขั้นตอน (อยู่ขั้นที่ 1)
      return;
    }

    // ภาพ 5: มีข้อมูลแล้ว -> เปลี่ยนปุ่มเป็น "ดู/แก้ไขข้อมูล"
    actionBtn.href = '/status-all';
    actionBtnText.textContent = 'ดู/แก้ไขข้อมูล';

    const s = data.student;

    // ตรวจสอบสถานะการดรอป
    const dropBanner = document.getElementById('dropped-student-banner');
    if (dropBanner) {
      if (s.isDropped) {
        dropBanner.style.display = 'block';
        const reasonEl = document.getElementById('dropped-banner-reason');
        const dateEl = document.getElementById('dropped-banner-date');
        if (reasonEl) reasonEl.textContent = s.dropReason || 'ดรอปจากระบบ';
        if (dateEl) {
          dateEl.textContent = s.droppedAt
            ? new Date(s.droppedAt).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '-';
        }
      } else {
        dropBanner.style.display = 'none';
      }
    }

    document.getElementById('display-name').textContent = `${s.studentCode || ''} ${s.nameTh || data.user.username}`.trim();
    renderDashboardStudentInfo(s, data.user);
    renderDashboardInternPeriod(data.internshipPeriod);

    if (s.profileImageUrl) {
      const img = document.getElementById('profile-img');
      img.src = s.profileImageUrl;
      img.style.display = 'block';
      document.getElementById('profile-icon').style.display = 'none';
    }

// Stage Indicators — 3 ขั้นตอนใหม่: เตรียมเอกสาร → รออนุมัติที่ฝึกงาน → อนุมัติแล้ว

function computeCurrentStep(cvData, trainingsData, placementData, companiesData) {
  // ขั้น 3 สำเร็จ: placement ถูกอนุมัติแล้ว → ทุกการ์ดเขียวหมด
  if (placementData && placementData.status === 'APPROVED') {
    return 3; // เลย index สุดท้าย → ทุกขั้นเสร็จสมบูรณ์
  }

  // ขั้น 2: มี placement แล้ว (PENDING/REJECTED) หรือมีบริษัทที่มีสถานะการยื่น
  if (placementData && placementData.companyNameTh) {
    return 1; // มีข้อมูลบริษัทที่เข้าฝึกงานแล้ว แต่ยังไม่ได้อนุมัติ
  }
  // เช็คว่ามีบริษัทที่มี submission (สถานะการยื่น) หรือไม่
  const hasSubmission = companiesData && companiesData.some(c => c.submission && c.submission.status);
  if (hasSubmission) {
    return 1; // มีสถานะการยื่นแล้ว
  }

  // ขั้น 1: ยังอยู่ในขั้นเตรียมเอกสาร
  return 0;
}

// คำนวณ sub-task ย่อยที่ต้องทำ/เสร็จแล้ว ในขั้นที่ 1 (เตรียมเอกสาร)
function computeSubTasks(cvData, trainingsData, companiesData) {
  const tasks = [
    { name: 'ชม.อบรม', done: trainingsData && trainingsData.status === 'APPROVED' },
    { name: 'CV', done: cvData && cvData.status === 'APPROVED' },
    { name: 'Checklist', done: companiesData && companiesData.some(c => c.checklistStatus === 'APPROVED') },
  ];
  return tasks;
}

function getSubTaskLabels(subTasks, currentIdx, allDone, placementData) {
  if (allDone) {
    return { current: 'อนุมัติแล้ว ✓', next: '✓ ครบทุกขั้นตอน' };
  }

  if (currentIdx === 0) {
    // ขั้น 1: หา sub-task ที่ยังไม่เสร็จ
    const pending = subTasks.filter(t => !t.done);
    const done = subTasks.filter(t => t.done);
    if (pending.length > 0) {
      const currentTask = pending[0].name;
      const nextTask = pending.length > 1 ? pending[1].name : 'รออนุมัติที่ฝึกงาน';
      return { current: currentTask, next: nextTask };
    }
    return { current: 'เตรียมเอกสาร', next: 'รออนุมัติที่ฝึกงาน' };
  }

  if (currentIdx === 1) {
    return { current: 'รออนุมัติที่ฝึกงาน', next: 'อนุมัติแล้ว' };
  }

  return { current: 'อนุมัติแล้ว', next: '✓ ครบทุกขั้นตอน' };
}

function updateStageWithDetails(currentIdx, data) {
  const allDone = currentIdx >= stageCards.length;
  const subTasks = computeSubTasks(data.cv, data.trainings, data.companies);
  const labels = getSubTaskLabels(subTasks, currentIdx, allDone, data.placement);

  const currentLabel = document.getElementById('current-step-label');
  if (currentLabel) {
    currentLabel.textContent = `ขั้นตอนปัจจุบัน: ${labels.current}`;
    // ครบทุกขั้นแล้วเหลือป้าย "ครบทุกขั้นตอน" ป้ายเดียว (ไม่รก)
    const currentTag = currentLabel.closest('.current-step-tag');
    if (currentTag) currentTag.style.display = allDone ? 'none' : '';
  }

  const nextTag = document.getElementById('next-step-tag');
  const nextLabelEl = document.getElementById('next-step-label');
  const nextIcon = document.getElementById('next-step-icon');
  if (nextTag && nextLabelEl) {
    const finished = labels.next.startsWith('✓');
    nextLabelEl.textContent = finished ? labels.next.replace(/^✓\s*/, '') : `ถัดไป: ${labels.next}`;
    if (nextIcon) nextIcon.textContent = finished ? 'check' : 'arrow_forward';
    nextTag.classList.toggle('next-step-tag--done', finished);
    nextTag.style.display = '';
  }

  renderDashboardStepper(currentIdx, subTasks, data);
}

// การ์ด 3 ขั้นตอน (แบบเรียบ): เลขวงกลม | ขั้นที่ + สถานะ/วันที่ | ชื่อขั้น | รายละเอียดสั้น 1 บรรทัด
function renderDashboardStepper(currentIdx, subTasks, data) {
  const wrap = document.getElementById('stage-indicators');
  if (!wrap) return;
  const total = stageCards.length;
  const allDone = currentIdx >= total;
  const doneCount = allDone ? total : currentIdx;
  const focusIdx = Math.min(currentIdx, total - 1); // การ์ดที่ติดป้าย "ขั้นตอนปัจจุบัน"
  const esc = escapeDashHtml;
  const fmtDate = (v) => fmtDashDate(v);
  const plc = data.placement || null;
  // ผู้ตรวจ: คนที่ตรวจที่ฝึกงานจริง (placement.reviewerName) ยังไม่มีคนตรวจ → แสดงอาจารย์ที่ปรึกษา
  const reviewer = (plc && plc.reviewerName) || '';
  const advisor = (data.student && data.student.advisor) || '';
  const reviewerLabel = reviewer ? 'ผู้ตรวจ' : 'อาจารย์ที่ปรึกษา';
  const reviewerName = reviewer || advisor;

  // วันที่เสร็จของแต่ละขั้น: ขั้น 1 = วันส่งข้อมูลที่ฝึกงาน, ขั้น 2–3 = วันที่อาจารย์อนุมัติ
  const approvedAt = plc && plc.status === 'APPROVED' ? plc.reviewedAt : null;
  const doneAt = [plc && plc.createdAt, approvedAt, approvedAt];

  // รายละเอียดสั้น 1 บรรทัดต่อขั้น (ไม่ซ้ำกับชื่อขั้น)
  const detail = (i, state) => {
    if (i === 0) {
      return `<div class="dsp-chips">${subTasks.map((t) => `
        <span class="dsp-mini ${t.done ? 'dsp-mini--ok' : ''}">${t.done ? '<span class="material-icons" aria-hidden="true">check</span>' : ''}${esc(t.name)}</span>`).join('')}</div>`;
    }
    if (i === 1) {
      // อักษรย่อชื่อผู้ตรวจ (คำแรก + คำที่สอง) ใช้เป็นวงกลม avatar เล็ก
      const initials = reviewerName.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0)).join('').toUpperCase();
      return reviewerName
        ? `<div class="dsp-reviewer"><span class="dsp-avatar" aria-hidden="true">${esc(initials)}</span><span class="dsp-reviewer-text">${reviewerLabel}: ${esc(reviewerName)}</span></div>`
        : '<div class="dsp-reviewer"><span class="dsp-reviewer-text">อาจารย์ตรวจข้อมูลบริษัท</span></div>';
    }
    return `<div class="dsp-step-sub">${state === 'done' ? 'พร้อมออกฝึกงาน' : 'รออาจารย์อนุมัติที่ฝึกงาน'}</div>`;
  };

  const titles = stageCards.map((c) => c.tagLabel); // ชื่อขั้นจากที่เดียว (ตรงกับป้ายที่หัว)

  wrap.innerHTML = titles.map((title, i) => {
    const state = i < doneCount ? 'done' : i === currentIdx ? 'active' : 'todo';
    // บรรทัดเล็กบนชื่อขั้น: เสร็จ → วันที่ (ถ้ามี) / กำลังทำ / ยังไม่ถึง
    const when = state === 'done'
      ? (doneAt[i] ? `เสร็จ ${fmtDate(doneAt[i])}` : 'เสร็จแล้ว')
      : state === 'active' ? 'กำลังดำเนินการ' : 'ยังไม่ถึง';
    // ป้าย "ขั้นตอนปัจจุบัน" เฉพาะตอนยังไม่ครบ (ครบแล้วหัวการ์ดบอกอยู่แล้ว)
    const isFocus = !allDone && i === focusIdx;
    // การ์ดเด่น (พื้นม่วง): ขั้นปัจจุบัน หรือขั้นสุดท้ายเมื่อครบทุกขั้นแล้ว
    const isHighlight = i === focusIdx;
    const card = `
      <div class="dsp-step dsp-step--${state}${isFocus ? ' dsp-step--focus' : ''}${isHighlight ? ' dsp-step--hl' : ''}" id="${stageCards[i].cardId}">
        ${isFocus ? '<span class="dsp-step-tab">ขั้นตอนปัจจุบัน</span>' : ''}
        <span class="dsp-step-bignum" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
        <span class="dsp-step-num">${state === 'done' ? '<span class="material-icons" aria-hidden="true">check</span>' : i + 1}</span>
        <div class="dsp-step-text">
          <span class="dsp-step-no">ขั้นที่ ${i + 1} · <span class="dsp-step-when">${when}</span></span>
          <span class="dsp-step-title">${title}</span>
          ${detail(i, state)}
        </div>
      </div>`;
    return i < titles.length - 1 ? card + '<span class="material-icons dsp-arrow" aria-hidden="true">chevron_right</span>' : card;
  }).join('');

  // หัว: ความคืบหน้า + แถบเขียว
  const progressText = document.getElementById('dsp-progress-text');
  if (progressText) progressText.textContent = `ความคืบหน้า ${doneCount}/${total}`;
  const fill = document.getElementById('dsp-progress-fill');
  if (fill) fill.style.width = `${Math.round((doneCount / total) * 100)}%`;

  // แถบล่าง: บริษัท
  const companyEl = document.getElementById('dsp-company');
  if (companyEl) companyEl.textContent = (plc && plc.companyNameTh) || '—';
}

const currentStepIdx = computeCurrentStep(data.cv, data.trainings, data.placement, data.companies);
updateStageWithDetails(currentStepIdx, data);

    // CV
    if (data.cv && data.cv.fileUrl) {
      window.currentCvUrl = data.cv.fileUrl;
      document.getElementById('cv-placeholder-text').style.display = 'none';

      // เรียกฟังก์ชันกลาง (ใช้ตัวเดียวกับหน้า admin)
      const displayUrl = getCvDisplayUrl(data.cv);

      const cvImg = document.getElementById('cv-preview-image');
      cvImg.src = displayUrl;
      cvImg.style.display = 'block';
      cvImg.style.cursor = 'pointer';
      cvImg.onclick = () => window.open(data.cv.fileUrl, '_blank');

      const pdfPreview = document.getElementById('cv-pdf-preview');
      if (pdfPreview) pdfPreview.style.display = 'none';

      // ⬇️ ย้าย cvStatusEl เข้ามาไว้ข้างในนี้ด้วย ปิด { ตรงนี้แทน
      // CV ไม่มีการอนุมัติแล้ว — อาจารย์คอมเมนต์อย่างเดียว (คอมเมนต์ไฟล์ล่าสุดแล้ว = lastCommentAt >= uploadedAt)
      const cvStatusEl = document.getElementById('display-cv-status');
      const commentedAt = data.cv.lastCommentAt ? new Date(data.cv.lastCommentAt).getTime() : 0;
      const uploadedAt = data.cv.uploadedAt ? new Date(data.cv.uploadedAt).getTime() : 0;
      if (commentedAt && commentedAt >= uploadedAt) {
        cvStatusEl.innerHTML = '<a href="/status-all?tab=cv" class="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-300 px-2 py-0.5 rounded-md inline-block" style="text-decoration:none;">อาจารย์คอมเมนต์แล้ว — ดูคอมเมนต์</a>';
      } else {
        cvStatusEl.innerHTML = '<span class="text-xs font-semibold text-green-700 bg-green-100 border border-green-300 px-2 py-0.5 rounded-md inline-block">อัปโหลดแล้ว • รอคอมเมนต์</span>';
      }
    } // ← ปิด if ตรงนี้เท่านั้น ไม่ปิดก่อนหน้านี้

    // Training Table
    if (data.trainings && data.trainings.records && data.trainings.records.length > 0) {
      const tbody = document.getElementById('training-tbody');
      tbody.innerHTML = '';
      // สถานะรายการ (แบบเดียวกับตารางในหน้า status-all: .trn-status)
      const statusPill = (rec) => rec.status === 'APPROVED'
        ? '<span class="trn-status trn-status--pass"><span class="material-icons">check</span>ผ่าน</span>'
        : rec.status === 'REJECTED'
        ? `<span class="trn-status trn-status--fail"${rec.note ? ` title="หมายเหตุ: ${escapeDashHtml(rec.note)}"` : ''}><span class="material-icons">close</span>ไม่ผ่าน</span>`
        : '<span class="trn-status trn-status--wait"><span class="material-icons">schedule</span>รอตรวจ</span>';
      data.trainings.records.forEach((rec, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="bg-white py-2 px-3 border border-[#777] text-center font-medium">${idx + 1}</td>
          <td class="bg-white py-2 px-3 border border-[#777]" title="${escapeDashHtml(rec.title)}">${escapeDashHtml(rec.title)}</td>
          <td class="bg-white py-2 px-3 border border-[#777] text-center">${rec.skillType === 'SOFT' ? rec.hours : '-'}</td>
          <td class="bg-white py-2 px-3 border border-[#777] text-center">${rec.skillType === 'HARD' ? rec.hours : '-'}</td>
          <td class="bg-white py-2 px-2 border border-[#777] text-center">${statusPill(rec)}</td>
        `;
        tbody.appendChild(tr);
      });

      // รายการที่ไม่ผ่าน + หมายเหตุอาจารย์ (มือถือ/แท็บเล็ตชี้เมาส์ดู title ไม่ได้ → แสดงใต้ตาราง)
      const notesEl = document.getElementById('training-reject-notes');
      if (notesEl) {
        const rejected = data.trainings.records.filter((r) => r.status === 'REJECTED');
        notesEl.hidden = rejected.length === 0;
        notesEl.innerHTML = rejected.length
          ? `<div class="trn-reject-head"><span class="material-icons" aria-hidden="true">error_outline</span>รายการที่ไม่ผ่าน (${rejected.length})</div>`
            + rejected.map((r) => `<div class="trn-reject-item"><b>${escapeDashHtml(r.title)}</b><span>${r.note ? 'หมายเหตุ: ' + escapeDashHtml(r.note) : 'ไม่มีหมายเหตุจากอาจารย์'}</span></div>`).join('')
          : '';
      }

      document.getElementById('total-soft').textContent = data.trainings.totalSoft || 0;
      document.getElementById('total-hard').textContent = data.trainings.totalHard || 0;
    }

    // สรุปผลชั่วโมงอบรมรวม (จาก server: trainings.status) ข้างเกณฑ์ผ่าน
    const overallEl = document.getElementById('training-overall');
    if (overallEl) {
      const st = data.trainings && data.trainings.status;
      overallEl.className = `trn-status ${st === 'APPROVED' ? 'trn-status--pass' : st === 'REJECTED' ? 'trn-status--fail' : 'trn-status--wait'}`;
      overallEl.innerHTML = st === 'APPROVED'
        ? '<span class="material-icons">check</span>ผ่าน / ชั่วโมงครบ'
        : st === 'REJECTED'
        ? '<span class="material-icons">close</span>ไม่ผ่าน / ชั่วโมงยังไม่ครบ'
        : '<span class="material-icons">schedule</span>รอผล';
    }

    // คำนวณและแสดงชั่วโมงที่ผ่านการอนุมัติแล้ว (APPROVED)
    const records = (data.trainings && data.trainings.records) ? data.trainings.records : [];
    const approvedSoft = data.trainings?.approvedSoft !== undefined
      ? data.trainings.approvedSoft
      : records.filter(r => r.status === 'APPROVED' && r.skillType === 'SOFT').reduce((sum, r) => sum + (Number(r.hours) || 0), 0);

    const approvedHard = data.trainings?.approvedHard !== undefined
      ? data.trainings.approvedHard
      : records.filter(r => r.status === 'APPROVED' && r.skillType === 'HARD').reduce((sum, r) => sum + (Number(r.hours) || 0), 0);

    // อัปเดต Soft skill progress bar (เกณฑ์ 12 ชม.)
    const softTextEl = document.getElementById('training-progress-text-soft');
    const softBarEl = document.getElementById('training-progress-bar-soft');
    if (softTextEl) softTextEl.textContent = `${approvedSoft} / 12 ชม.`;
    if (softBarEl) softBarEl.style.width = `${Math.min(100, Math.round((approvedSoft / 12) * 100))}%`;

    // อัปเดต Hard skill progress bar (เกณฑ์ 18 ชม.)
    const hardTextEl = document.getElementById('training-progress-text-hard');
    const hardBarEl = document.getElementById('training-progress-bar-hard');
    if (hardTextEl) hardTextEl.textContent = `${approvedHard} / 18 ชม.`;
    if (hardBarEl) hardBarEl.style.width = `${Math.min(100, Math.round((approvedHard / 18) * 100))}%`;



    // Checklist Status
    renderDashboardChecklist(data.companies || [], data.approvedCompaniesCount || 0);

    // Placement / Passed Company
    if (data.placement && data.placement.companyNameTh) {
      document.getElementById('display-position').textContent = `${data.placement.position || '-'}`;
      renderDashboardCompany(data.placement);
    }

    // ==========================================
    // Multi-Round Internship Tracking (SCRUM-73)
    // ==========================================
    const roundInfo = data.roundInfo;
    if (roundInfo) {
      // 1. อัปเดตข้อมูลบน Dev Test Toolbar
      const devStatusBadge = document.getElementById('dev-round-status-badge');
      if (devStatusBadge) {
        devStatusBadge.textContent = `รอบที่ ${roundInfo.currentRound} (${roundInfo.currentTerm || '-'}) ${roundInfo.isRound1Completed ? '• จบรอบ 1 แล้ว' : '• กำลังฝึกรอบ 1'}`;
        if (roundInfo.currentRound >= 2) {
          devStatusBadge.className = 'font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300';
        } else {
          devStatusBadge.className = 'font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-300';
        }
      }

      // 2. แสดง/ซ่อนการ์ดตัวเลือกรอบที่ 2 (Transition Card)
      // เงื่อนไข: อยู่ในรอบ 1 และผ่านเกณฑ์จบรอบ 1 แล้ว (canCompleteRound1 หรือ isRound1Completed)
      const transitionCard = document.getElementById('round-transition-card');
      if (transitionCard) {
        if (roundInfo.currentRound === 1 && (roundInfo.canCompleteRound1 || roundInfo.isRound1Completed)) {
          transitionCard.style.display = 'block';
          renderRound2WindowOptions(roundInfo.round2Windows || []);
        } else {
          transitionCard.style.display = 'none';
        }
      }

      // 3. แสดง/ซ่อนการ์ด Accordion พับเก็บประวัติรอบที่ 1
      // เงื่อนไข: อยู่ในรอบที่ 2 ขึ้นไป หรือมีข้อมูลประวัติใน historyRounds
      const accordionCard = document.getElementById('round1-accordion-card');
      if (accordionCard) {
        if (roundInfo.currentRound >= 2 || (roundInfo.historyRounds && roundInfo.historyRounds.length > 0)) {
          accordionCard.style.display = 'block';

          const r1 = roundInfo.historyRounds && roundInfo.historyRounds[0];
          if (r1) {
            const termBadge = document.getElementById('accordion-term-badge');
            const r1Name = document.getElementById('r1-comp-name');
            const r1Pos = document.getElementById('r1-comp-pos');
            const r1Addr = document.getElementById('r1-comp-addr');
            const r1Contact = document.getElementById('r1-comp-contact');
            const r1Checklist = document.getElementById('r1-checklist-badge');
            const r1Acceptance = document.getElementById('r1-acceptance-info');
            const r1DocsList = document.getElementById('r1-docs-list');

            if (termBadge) termBadge.textContent = r1.term || 'รอบ 1';
            if (r1Name) r1Name.textContent = r1.companyName || '-';
            if (r1Pos) r1Pos.textContent = r1.position || '-';
            if (r1Addr) r1Addr.textContent = `${r1.companyAddress || '-'} ${r1.province && r1.province !== '-' ? '(' + r1.province + ')' : ''}`;
            if (r1Contact) r1Contact.textContent = `${r1.phone || '-'} / ${r1.email || '-'}`;
            if (r1Checklist) {
              r1Checklist.textContent = r1.checklistStatus === 'APPROVED' ? 'ผ่านครบทุกขั้นตอน' : (r1.checklistStatus || 'ผ่าน');
            }
            if (r1Acceptance) {
              r1Acceptance.textContent = r1.companyResponseStatus === 'ACCEPTED' ? 'ตอบรับเข้าฝึกงานเรียบร้อย' : (r1.companyResponseStatus || 'ตอบรับแล้ว');
            }

            if (r1DocsList) {
              const docs = [];
              if (r1.requestLetterIssued) {
                docs.push(`📄 หนังสือขอความอนุเคราะห์ (${r1.requestLetterDocNo ? 'เลขที่: ' + escapeDashHtml(r1.requestLetterDocNo) : 'ออกหนังสือแล้ว'})`);
              }
              if (r1.companyResponseFileUrl && /^https?:\/\//i.test(String(r1.companyResponseFileUrl))) {
                docs.push(`📄 แบบตอบรับ: <a href="${escapeDashHtml(r1.companyResponseFileUrl)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline font-semibold">${escapeDashHtml(r1.companyResponseFileName || 'เปิดดูแบบตอบรับ')}</a>`);
              }
              if (r1.dispatchLetterIssued) {
                docs.push(`📄 หนังสือส่งตัว (${r1.dispatchLetterDocNo ? 'เลขที่: ' + escapeDashHtml(r1.dispatchLetterDocNo) : 'ออกหนังสือแล้ว'})`);
              }

              if (docs.length > 0) {
                r1DocsList.innerHTML = docs.map(d => `<div class="text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-200">${d}</div>`).join('');
              } else {
                r1DocsList.innerHTML = '<span class="text-gray-400 italic">ไม่มีไฟล์แนบประวัติ</span>';
              }
            }
          }
        } else {
          accordionCard.style.display = 'none';
        }
      }
    }
  })
  .catch(err => console.error('Error fetching dashboard summary:', err));
}

// โหลดข้อมูลครั้งแรก
loadDashboardData();

// ⚡ เมื่อมีสัญญาณ Real-time จาก Socket.io ให้อัปเดต Dashboard ทันที
window.addEventListener('app:data-updated', () => {
  loadDashboardData();
});


// ==========================================
// Handlers สำหรับ Multi-Round (SCRUM-73)
// ==========================================
window.toggleRound1Accordion = function() {
  const body = document.getElementById('round1-accordion-body');
  const arrow = document.getElementById('accordion-arrow');
  const toggleText = document.getElementById('accordion-toggle-text');
  if (!body) return;
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
  if (arrow) arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  if (toggleText) toggleText.textContent = isHidden ? 'พับเก็บ' : 'คลี่ดูรายละเอียด';
};

// รอบออกฝึกของรอบที่ 2 มาจากการตั้งค่ารุ่น/รอบของพี่จอม
// เปิดรอบเดียว = แสดงข้อความ (เลือกให้อัตโนมัติ) / หลายรอบ = dropdown / ไม่มีรอบเปิด = แจ้งรอ
let round2WindowsCache = [];
function renderRound2WindowOptions(windows) {
  round2WindowsCache = windows;
  const select = document.getElementById('round2-term-select');
  const hint = document.getElementById('round2-term-hint');
  if (!select) return;
  const closeText = (w) => w.closeDate
    ? ` • ยื่นได้ถึง ${new Date(w.closeDate + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '';

  if (windows.length === 0) {
    select.innerHTML = '<option value="">ยังไม่มีรอบออกฝึกถัดไปที่เปิดรับ</option>';
    select.disabled = true;
    if (hint) hint.textContent = '* รอเจ้าหน้าที่คณะเปิดรอบออกฝึกถัดไปของสาขาคุณ';
    return;
  }
  select.disabled = windows.length === 1;
  select.innerHTML = (windows.length > 1 ? '<option value="">-- เลือกรอบออกฝึก --</option>' : '') +
    windows.map(w => `<option value="${escapeDashHtml(w.id)}">${escapeDashHtml(w.label)}${closeText(w)}</option>`).join('');
  if (hint) {
    hint.textContent = windows.length === 1
      ? '* ระบบเลือกรอบที่เปิดรับอยู่ให้อัตโนมัติ'
      : '* เปิดรับหลายรอบพร้อมกัน เลือกรอบที่คุณจะออกฝึก (เช่น Summer หรือภาคปกติ)';
  }
}

window.submitRoundChoice = async function(action) {
  const termSelect = document.getElementById('round2-term-select');
  const windowId = termSelect ? termSelect.value : '';
  if (round2WindowsCache.length === 0) {
    alert('ยังไม่มีรอบออกฝึกถัดไปที่เปิดรับสำหรับสาขาของคุณ กรุณารอเจ้าหน้าที่คณะเปิดรอบ');
    return;
  }
  if (!windowId) {
    alert('กรุณาเลือกรอบออกฝึกสำหรับรอบที่ 2');
    if (termSelect) termSelect.focus();
    return;
  }
  const chosen = round2WindowsCache.find(w => String(w.id) === String(windowId));
  const term = chosen ? chosen.label : windowId;
  
  const actionLabel = action === 'SAME_COMPANY' 
    ? 'ยืนยันฝึกงานที่เดิมต่อสำหรับรอบที่ 2' 
    : 'ยืนยันเปลี่ยนสถานที่ฝึกงานใหม่สำหรับรอบที่ 2';
    
  if (!confirm(`${actionLabel}\nรอบเทอม: ${term}\n\nคุณแน่ใจหรือไม่ที่จะดำเนินการต่อ?`)) {
    return;
  }

  try {
    const res = await fetch('/api/student/round/complete-round-1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, internshipWindowId: windowId }),
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      loadDashboardData();
    } else {
      alert(data.message || 'เกิดข้อผิดพลาดในการบันทึกรอบที่ 2');
    }
  } catch (err) {
    console.error('Error submitting round choice:', err);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
  }
};

window.devToggleRound = async function(mode) {
  try {
    const res = await fetch('/api/student/round/dev-toggle-round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      loadDashboardData();
    } else {
      alert(data.message || 'เกิดข้อผิดพลาด');
    }
  } catch (err) {
    console.error('Error in devToggleRound:', err);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
  }
};
