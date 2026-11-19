// @ts-nocheck
// status_all.js - หน้าตั้งค่าปรับเปลี่ยน 6 ส่วน (ภาพที่ 6, 7, 8)

// ตัวแปรเก็บข้อมูลจาก API เพื่อใช้คำนวณเงื่อนไขปลดล็อกส่วนที่ 6
let currentCvData = null;
let currentTrainingsData = [];
let currentCompaniesData = [];
let currentSubmissionsData = [];
let currentAcceptanceData = null;
// dropdown การ์ดเอกสารราชการในตาราง "รายการสถานประกอบการที่ยื่นสมัคร" (ค่าเริ่มต้น: ปิด)
let acceptanceCardExpanded = false;
// true เมื่อโหลดข้อมูลรอบแรกครบทุกส่วนแล้ว (ใช้โดย sidebar ใน status_all_tabs.js)
let statusAllDataReady = false;

// ===== รายชื่อหลักสูตร/สาขากลาง: อ่านจาก <script id="ict-majors-data"> (ต้นทาง: src/utils/majors.ts) =====
function findIctMajorInfo(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return null;
  let majors = [];
  try {
    const el = document.getElementById('ict-majors-data');
    majors = el ? JSON.parse(el.textContent || '[]') : [];
  } catch (e) {
    majors = [];
  }
  return majors.find((m) => m.code.toLowerCase() === v)
    || majors.find((m) => m.keywords.some((k) => v.includes(k.toLowerCase())))
    || null;
}

// โหลดข้อมูลทั้งหมดเข้าสู่ทั้ง 6 Section
async function initPage() {
  // โหลด 3 ส่วนแรกพร้อมกัน (ไม่ขึ้นต่อกัน) → การ์ด CV แสดงเร็วขึ้นตอนรีเฟรช ไม่ต้องรอ profile/trainings
  await Promise.all([loadProfile(), loadTrainings(), loadCv()]);
  await loadCompanies();
  await loadSubmissions();
  statusAllDataReady = true;
  checkPlacementUnlock();
}

// ลิงก์ในช่อง "ข้อมูลเพิ่มเติม": textarea กดลิงก์ไม่ได้ → แสดง URL ที่พบเป็นลิงก์กดได้ใต้ช่อง (อัปเดตตามที่พิมพ์)
function renderOtherInfoLinks() {
  const input = document.getElementById('prof-other');
  const box = document.getElementById('prof-other-links');
  if (!input || !box) return;
  const urls = window.IctText.extractUrls(input.value); // ใช้กติกาเดียวกับ linkify (text_utils.ts)
  box.hidden = urls.length === 0;
  box.innerHTML = urls.length
    ? `<span class="student-profile-links-label"><span class="material-icons" aria-hidden="true">link</span>ลิงก์ในข้อความ:</span>`
      + urls.map((u) => window.IctText.linkify(u)).join('')
    : '';
}

// 1. โหลดข้อมูลส่วนตัว
async function loadProfile() {
  try {
    const res = await fetch('/api/student/profile');
    const data = await res.json();
    if (data.success) {
      if (data.user) document.getElementById('prof-email').value = data.user.email || '';
      if (data.student) {
        const s = data.student;
        currentStudentAdvisor = s.advisor || null;
        await loadAdvisorOptions(s.advisorId ?? s.advisor?.id ?? null);

        document.getElementById('prof-nameTh').value = s.nameTh || '';
        document.getElementById('prof-nameEn').value = s.nameEn || '';
        document.getElementById('prof-studentCode').value = s.studentCode || '';
        document.getElementById('prof-year').value = s.year || '3';
        document.getElementById('prof-gpa').value = s.gpa || '';
        // แสดงชื่อ หลักสูตร → สาขาวิชา จากรายชื่อกลาง (ค่าที่บันทึกยังเป็นชื่อสาขาเดิมใน data-value)
        const rawMajor = s.major || 'วิศวกรรมซอฟต์แวร์';
        const majorInfo = findIctMajorInfo(rawMajor);
        const majorEl = document.getElementById('prof-major');
        majorEl.dataset.value = rawMajor;
        majorEl.value = majorInfo ? `สาขาวิชา${majorInfo.name}` : rawMajor;
        document.getElementById('prof-curriculum').value = s.curriculum || (majorInfo ? majorInfo.degreeName : '');
        document.getElementById('prof-faculty').value = s.faculty || 'คณะเทคโนโลยีสารสนเทศและการสื่อสาร';
        document.getElementById('prof-phone').value = s.phone || '';
        document.getElementById('prof-lineId').value = s.lineId || '';
        document.getElementById('prof-facebook').value = s.facebook || '';
        const otherEl = document.getElementById('prof-other');
        if (otherEl) {
          otherEl.value = s.otherInfo || '';
          renderOtherInfoLinks();
          otherEl.oninput = renderOtherInfoLinks;
        }

        // [REQ-04] ล็อคข้อมูลทางวิชาการที่ดึงจากระบบทะเบียน REG ห้ามนิสิตแก้ไข
        ['prof-studentCode', 'prof-nameTh', 'prof-year', 'prof-gpa', 'prof-major', 'prof-curriculum', 'prof-faculty', 'prof-email'].forEach(id => {
          const el = document.getElementById(id);
          if (el && el.value) {
            el.readOnly = true;
            el.style.backgroundColor = '#F8FAFC';
            el.style.cursor = 'not-allowed';
            el.title = '[REQ-04] ข้อมูลจากระบบทะเบียน REG ถูกล็อค ไม่สามารถแก้ไขได้';
          }
        });

        if (s.profileImageUrl) {
          const preview = document.getElementById('profile-photo-preview');
          preview.src = s.profileImageUrl;
          preview.style.display = 'block';
          document.getElementById('photo-prompt').style.display = 'none';
        }
      }
    }
  } catch (err) {
    console.error('Load profile error:', err);
  }
}

// จัดการอัปโหลดรูปโปรไฟล์
const photoDropzone = document.getElementById('photo-dropzone');
const photoInput = document.getElementById('profile-photo-input');
if (photoDropzone && photoInput) {
  photoDropzone.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('profileImage', file);
      formData.append('nameTh', document.getElementById('prof-nameTh').value || 'นิสิต');
      formData.append('nameEn', document.getElementById('prof-nameEn').value || 'Student');
      formData.append('studentCode', document.getElementById('prof-studentCode').value || '670xxxxx');

      try {
        const res = await fetch('/api/student/profile', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.success && data.student.profileImageUrl) {
          const preview = document.getElementById('profile-photo-preview');
          preview.src = data.student.profileImageUrl;
          preview.style.display = 'block';
          document.getElementById('photo-prompt').style.display = 'none';
        }
      } catch (err) {
        console.error(err);
      }
    }
  });
}

// โหลดรายชื่ออาจารย์ทั้งหมดมาใส่ dropdown
async function loadAdvisorOptions(selectedAdvisorId) {
  try {
    const res = await fetch('/api/student/advisors');
    const data = await res.json();
    const select = document.getElementById('prof-advisor');
    if (select && data.success) {
      select.innerHTML = '<option value="">-- เลือกอาจารย์ที่ปรึกษา --</option>';
      data.advisors.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.name;
        if (selectedAdvisorId && Number(a.id) === Number(selectedAdvisorId)) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Load advisors error:', err);
  }
}

// บันทึกข้อมูลส่วนตัว
const saveProfileBtn = document.getElementById('save-profile-btn');
const profilePhoneInput = document.getElementById('prof-phone');
const internshipEmailInput = document.getElementById('prof-lineId');

if (profilePhoneInput) {
  profilePhoneInput.addEventListener('input', () => {
    profilePhoneInput.value = profilePhoneInput.value.replace(/[^0-9]/g, '');
  });
}

if (saveProfileBtn) {
  saveProfileBtn.addEventListener('click', async () => {
    if (profilePhoneInput && !profilePhoneInput.checkValidity()) {
      profilePhoneInput.reportValidity();
      return;
    }
    if (internshipEmailInput && !internshipEmailInput.checkValidity()) {
      internshipEmailInput.reportValidity();
      return;
    }

    const advisorSelect = document.getElementById('prof-advisor');
    const payload = {
      nameTh: document.getElementById('prof-nameTh').value,
      nameEn: document.getElementById('prof-nameEn').value,
      studentCode: document.getElementById('prof-studentCode').value,
      year: document.getElementById('prof-year').value,
      gpa: document.getElementById('prof-gpa').value,
      major: document.getElementById('prof-major').dataset.value || document.getElementById('prof-major').value,
      phone: document.getElementById('prof-phone').value,
      lineId: document.getElementById('prof-lineId').value,
      facebook: document.getElementById('prof-facebook').value,
      otherInfo: document.getElementById('prof-other')?.value || '',
      advisorId: advisorSelect.value ? parseInt(advisorSelect.value) : null,
    };

    try {
      const res = await fetch('/api/student/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ บันทึกข้อมูลส่วนตัวสำเร็จ');
      } else {
        alert('เกิดข้อผิดพลาด: ' + (data.message || 'บันทึกไม่สำเร็จ'));
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  });
}

// ล็อก CV / ชั่วโมงอบรมระหว่างกำลังฝึกงาน (ออกหนังสือส่งตัว -> จบรอบ)
let isInternshipLocked = false;
function applyInternshipLock(lock) {
  isInternshipLocked = Boolean(lock && lock.locked);
  const cvInputEl = document.getElementById('cv-upload-input') as HTMLInputElement | null;
  if (cvInputEl) cvInputEl.disabled = isInternshipLocked;
  const cvChangeBtnEl = document.getElementById('cv-change-btn');
  if (cvChangeBtnEl) cvChangeBtnEl.style.display = isInternshipLocked ? 'none' : '';

  let banner = document.getElementById('internship-lock-banner');
  if (!isInternshipLocked) {
    if (banner) banner.remove();
    return;
  }
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'internship-lock-banner';
    banner.className = 'mb-5 bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r-xl shadow-sm';
    const main = document.querySelector('.main-content') || document.body;
    // layout sidebar: section อยู่ใน .status-all-panels → แทรกแบนเนอร์ก่อนกล่อง panel (แสดงทุกแท็บ)
    const anchor = main.querySelector('.status-all-panels') || main.querySelector('section');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(banner, anchor);
    else main.prepend(banner);
  }
  banner.innerHTML = `
    <div class="flex items-start gap-3">
      <span class="material-icons text-indigo-500 text-2xl">lock_clock</span>
      <div>
        <h4 class="text-sm font-bold text-indigo-800">อยู่ระหว่างฝึกงาน — CV และชั่วโมงอบรมเป็นแบบอ่านอย่างเดียว</h4>
        <p class="text-xs text-indigo-700 mt-0.5">${lock.message || ''}</p>
      </div>
    </div>`;
}

// 2. โหลดชั่วโมงการอบรม
async function loadTrainings() {
  try {
    const res = await fetch('/api/student/trainings');
    const data = await res.json();
    if (data.success && data.trainings) {
      currentTrainingsData = data.trainings;
      applyInternshipLock(data.internshipLock);
      renderTrainingsPage();
    }
  } catch (err) {
    console.error('Load trainings error:', err);
  } finally {
    checkPlacementUnlock();
  }
}

// เกณฑ์ชั่วโมงอบรม (จุดเดียว) — ตรงกับเงื่อนไขฝั่ง server (adminRoutes: soft >= 12 && hard >= 18)
const TRAINING_CRITERIA = { soft: 12, hard: 18 };
const TRAINING_CRITERIA_TOTAL = TRAINING_CRITERIA.soft + TRAINING_CRITERIA.hard;

// แบ่งหน้าตารางชั่วโมงการอบรม (หน้าละ 9 รายการ)
const TRAININGS_PAGE_SIZE = 9;
let trainingsPage = 1;

const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function parseIsoDate(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  const dt = value ? new Date(value) : null;
  if (!dt || isNaN(dt.getTime())) return null;
  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() };
}

// "13 พ.ย. 2569" / ช่วงวัน "7–8 พ.ย. 2569", "30 ต.ค. – 2 พ.ย. 2569"
function formatThaiDateRange(startValue, endValue) {
  const a = parseIsoDate(startValue);
  if (!a) return '';
  const b = parseIsoDate(endValue);
  const fmt = (x, withYear = true) => `${x.d} ${THAI_MONTHS_SHORT[x.m - 1]}${withYear ? ' ' + (x.y + 543) : ''}`;
  if (!b || (a.y === b.y && a.m === b.m && a.d === b.d)) return fmt(a);
  if (a.y === b.y && a.m === b.m) return `${a.d}–${fmt(b)}`;
  if (a.y === b.y) return `${fmt(a, false)} – ${fmt(b)}`;
  return `${fmt(a)} – ${fmt(b)}`;
}

// แยกข้อมูลแสดงผลจาก record เดิม (API ไม่มี field วันที่/ช่วงเวลา → อ่านจาก title/note ที่ระบบ Check-in เขียนไว้)
// title:  "[Check-in กิจกรรมคณะ] <ชื่อกิจกรรม> - <ช่วงที่ 1 (2026-11-13) | ทั้งกิจกรรม>"
// note:   "บันทึก Check-in หน้างาน (...) โดยพี่จอม เมื่อวันที่ 2026-11-07 ถึง 2026-11-08 (09:00-16:00 น.)"
function getTrainingView(t) {
  const rawTitle = String(t.title || '');
  const note = String(t.note || '');
  const isCheckIn = t.source === 'STAFF_IMPORT' && /^\[Check-in[^\]]*\]/.test(rawTitle);
  const isStudentUpload = !t.source || t.source === 'STUDENT_UPLOAD';

  let title = rawTitle;
  let session = '';
  if (isCheckIn) {
    title = rawTitle.replace(/^\[Check-in[^\]]*\]\s*/, '');
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
    dateText = formatThaiDateRange(noteDate[1], noteDate[2]);
    if (noteDate[3]) timeText = `${noteDate[3]}–${noteDate[4]} น.`;
  }
  if (!dateText) dateText = formatThaiDateRange(t.createdAt);

  const subParts = [];
  if (isCheckIn) {
    if (session) subParts.push(session);
    if (timeText) subParts.push(timeText);
  } else if (isStudentUpload) {
    subParts.push(t.status === 'APPROVED' ? 'อัปโหลดโดยนิสิต · อาจารย์อนุมัติแล้ว' : t.status === 'REJECTED' ? 'อัปโหลดโดยนิสิต · ไม่ผ่านการตรวจ' : 'อัปโหลดโดยนิสิต · รออาจารย์ตรวจ');
  } else {
    subParts.push(t.source === 'ADMIN_IMPORT' ? 'อาจารย์ประจำวิชาเพิ่มให้' : 'นำเข้าโดยเจ้าหน้าที่คณะ');
  }

  // หมายเหตุที่ระบบเขียนเอง (Check-in) ถูกแยกเป็นวันที่/เวลาแล้ว → แสดงเฉพาะหมายเหตุที่มีความหมายเพิ่ม
  const extraNote = isCheckIn ? '' : note.trim();
  const sourceKey = isCheckIn ? 'CHECKIN' : isStudentUpload ? 'UPLOAD' : 'IMPORT';
  const statusKey = t.status === 'APPROVED' ? 'APPROVED' : t.status === 'REJECTED' ? 'REJECTED' : 'PENDING';
  return { title: title || '-', sub: subParts.join(' · '), dateText: dateText || '-', extraNote, sourceKey, statusKey, isStudentUpload };
}

function getTrainingFilters() {
  const val = (id) => (document.getElementById(id)?.value || '').trim();
  return {
    q: val('trn-search').toLowerCase(),
    type: val('trn-filter-type'),
    source: val('trn-filter-source'),
    status: val('trn-filter-status'),
  };
}

window.onTrainingFilterChange = function() {
  trainingsPage = 1;
  renderTrainingsPage();
};

function renderTrainingSummary(list) {
  const box = document.getElementById('trn-summary');
  if (!box) return;
  const approved = list.filter((t) => t.status === 'APPROVED');
  const sum = (arr) => arr.reduce((s, t) => s + (Number(t.hours) || 0), 0);
  const soft = sum(approved.filter((t) => t.skillType !== 'HARD'));
  const hard = sum(approved.filter((t) => t.skillType === 'HARD'));
  const total = soft + hard;
  const pendingHours = sum(list.filter((t) => t.status !== 'APPROVED' && t.status !== 'REJECTED'));
  const passed = soft >= TRAINING_CRITERIA.soft && hard >= TRAINING_CRITERIA.hard;
  const pct = (v, max) => (max > 0 ? Math.round((v / max) * 100) : 0);
  const bar = (v, max, tone) => `<div class="trn-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${v}"><span class="trn-bar-fill trn-bar-fill--${tone}" style="width:${Math.min(100, pct(v, max))}%"></span></div>`;
  const skillCard = (label, tone, value, max, hint) => `
    <div class="trn-stat">
      <div class="trn-stat-head">
        <span class="trn-stat-label"><span class="trn-dot trn-dot--${tone}"></span>${label}</span>
        <span class="trn-badge trn-badge--${value >= max ? 'pass' : 'muted'}">${value >= max ? '<span class="material-icons">check</span>ครบเกณฑ์' : `ขาดอีก ${max - value} ชม.`}</span>
      </div>
      <div class="trn-stat-value">${value}<span class="trn-stat-unit">/ เกณฑ์ ${max} ชม.</span></div>
      <div class="trn-stat-row"><span>ความคืบหน้า</span><span class="trn-stat-pct trn-stat-pct--${tone}">${pct(value, max)}%</span></div>
      ${bar(value, max, tone)}
      <div class="trn-stat-hint">${hint}</div>
    </div>`;

  box.innerHTML = `
    <div class="trn-stat trn-stat--total">
      <div class="trn-stat-head">
        <span class="trn-stat-label"><span class="trn-dot trn-dot--green"></span>ชั่วโมงรวมสะสม</span>
        <span class="trn-badge trn-badge--${passed ? 'pass' : 'warn'}">${passed ? '<span class="material-icons">check</span>ผ่านเกณฑ์' : 'ยังไม่ผ่านเกณฑ์'}</span>
      </div>
      <div class="trn-stat-value">${total}<span class="trn-stat-unit">/ เกณฑ์ ${TRAINING_CRITERIA_TOTAL} ชม.</span></div>
      <div class="trn-stat-row"><span>ความคืบหน้าภาพรวม</span><span class="trn-stat-pct trn-stat-pct--green">${pct(total, TRAINING_CRITERIA_TOTAL)}%</span></div>
      ${bar(total, TRAINING_CRITERIA_TOTAL, 'green')}
      <div class="trn-stat-hint">${pendingHours > 0 ? `มีอีก ${pendingHours} ชม. รออาจารย์ตรวจ (ยังไม่นับรวม)` : `ต้องผ่าน Soft ${TRAINING_CRITERIA.soft} และ Hard ${TRAINING_CRITERIA.hard} ชม. ก่อนยื่นฝึกงาน`}</div>
    </div>
    ${skillCard('ทักษะด้านอารมณ์และสังคม (Soft Skill)', 'indigo', soft, TRAINING_CRITERIA.soft, 'การสื่อสาร การทำงานเป็นทีม เทคนิคการสัมภาษณ์')}
    ${skillCard('ทักษะด้านวิชาชีพและเทคนิค (Hard Skill)', 'sky', hard, TRAINING_CRITERIA.hard, 'การวิเคราะห์ข้อมูล เครื่องมือเฉพาะทาง ความปลอดภัยไซเบอร์')}
  `;
}

function renderTrainingsPage() {
  const tbody = document.getElementById('trainings-table-body');
  if (!tbody) return;

  const all = currentTrainingsData || [];
  renderTrainingSummary(all);
  const addBtn = document.getElementById('trn-add-btn');
  if (addBtn) {
    addBtn.disabled = isInternshipLocked;
    addBtn.title = isInternshipLocked ? 'ล็อกระหว่างฝึกงาน เพิ่มข้อมูลไม่ได้' : 'สำหรับคอร์สออนไลน์/ภายนอก พร้อมแนบ Certificate';
  }

  const f = getTrainingFilters();
  const rows = all
    .map((t, i) => ({ t, v: getTrainingView(t), order: i + 1 }))
    .filter(({ t, v }) =>
      (!f.q || `${v.title} ${v.sub} ${t.title || ''}`.toLowerCase().includes(f.q)) &&
      (!f.type || (f.type === 'HARD' ? t.skillType === 'HARD' : t.skillType !== 'HARD')) &&
      (!f.source || v.sourceKey === f.source) &&
      (!f.status || v.statusKey === f.status));

  const totalPages = Math.max(1, Math.ceil(rows.length / TRAININGS_PAGE_SIZE));
  if (trainingsPage > totalPages) trainingsPage = totalPages;
  if (trainingsPage < 1) trainingsPage = 1;
  const start = (trainingsPage - 1) * TRAININGS_PAGE_SIZE;
  const pageItems = rows.slice(start, start + TRAININGS_PAGE_SIZE);

  if (all.length === 0) {
    tbody.innerHTML = `<tr class="trn-empty-row"><td colspan="7"><div class="trn-empty">
      <span class="material-icons">school</span>
      <div class="trn-empty-title">ยังไม่มีชั่วโมงอบรม</div>
      <div class="trn-empty-sub">ชั่วโมงจาก Check-in หน้างานจะแสดงอัตโนมัติ</div>
    </div></td></tr>`;
  } else if (rows.length === 0) {
    tbody.innerHTML = `<tr class="trn-empty-row"><td colspan="7"><div class="trn-empty">
      <span class="material-icons">filter_alt_off</span>
      <div class="trn-empty-title">ไม่พบรายการที่ตรงกับตัวกรอง</div>
    </div></td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map(({ t, v, order }) => {
      const typeBadge = t.skillType === 'HARD'
        ? '<span class="trn-pill trn-pill--hard">Hard skill</span>'
        : '<span class="trn-pill trn-pill--soft">Soft skill</span>';
      // ไฟล์ Certificate ดูได้ในหน้าต่าง "ดูรายละเอียด" (แสดงตัวอย่างไฟล์ใต้หัวข้อ Certificate)
      const sourceChip = v.sourceKey === 'CHECKIN'
        ? '<span class="trn-chip trn-chip--blue"><span class="material-icons">verified_user</span>Check-in</span>'
        : v.sourceKey === 'UPLOAD'
        ? '<span class="trn-chip trn-chip--amber"><span class="material-icons">upload_file</span>อัปโหลด Cert</span>'
        : `<span class="trn-chip trn-chip--slate"><span class="material-icons">domain</span>${t.source === 'ADMIN_IMPORT' ? 'อาจารย์เพิ่มให้' : 'นำเข้าโดยคณะ'}</span>`;
      const statusBadge = v.statusKey === 'APPROVED'
        ? '<span class="trn-status trn-status--pass"><span class="material-icons">check</span>ผ่าน</span>'
        : v.statusKey === 'REJECTED'
        ? '<span class="trn-status trn-status--fail"><span class="material-icons">close</span>ไม่ผ่าน</span>'
        : '<span class="trn-status trn-status--wait"><span class="material-icons">schedule</span>รอตรวจ</span>';

      // ลบได้เฉพาะรายการที่นิสิตอัปโหลดเองและยังรอตรวจ
      const lockReason = isInternshipLocked
        ? 'ล็อกระหว่างฝึกงาน แก้ไขไม่ได้'
        : !v.isStudentUpload
        ? 'บันทึกโดยเจ้าหน้าที่ แก้ไขไม่ได้'
        : v.statusKey !== 'PENDING'
        ? 'ตรวจแล้ว แก้ไขไม่ได้'
        : '';
      const actionBtn = lockReason
        ? `<span class="trn-icon-btn trn-icon-btn--lock" tabindex="0" title="${lockReason}" aria-label="${lockReason}"><span class="material-icons">lock</span></span>`
        : `<button type="button" class="trn-icon-btn trn-icon-btn--danger" title="ลบรายการ" aria-label="ลบรายการ" onclick="deleteTraining(${t.id})"><span class="material-icons">delete_outline</span></button>`;

      const noteTip = v.extraNote ? ` title="หมายเหตุ: ${escapeStudentHtml(v.extraNote)}"` : '';
      return `
        <tr class="trn-row trn-row--${v.statusKey.toLowerCase()}">
          <td class="trn-col-no" data-label="ลำดับ">${order}</td>
          <td class="trn-col-title" data-label="ชื่อกิจกรรม">
            <div class="trn-title"${noteTip}>${escapeStudentHtml(v.title)}</div>
            <div class="trn-sub">${escapeStudentHtml(v.sub)}${v.extraNote ? `<span class="trn-note-flag"${noteTip}><span class="material-icons">sticky_note_2</span>มีหมายเหตุ</span>` : ''}</div>
          </td>
          <td class="trn-col-type" data-label="ประเภท">${typeBadge}</td>
          <td class="trn-col-hours" data-label="ชั่วโมง"><b>${Number(t.hours) || 0}</b> ชม.</td>
          <td class="trn-col-source" data-label="แหล่งที่มา"><div class="trn-source">${sourceChip}</div></td>
          <td class="trn-col-status" data-label="สถานะ">${statusBadge}</td>
          <td class="trn-col-actions" data-label="จัดการ">
            <div class="trn-actions">
              <button type="button" class="trn-icon-btn" title="ดูรายละเอียด" aria-label="ดูรายละเอียด" onclick="viewTraining(${t.id})"><span class="material-icons">visibility</span></button>
              ${actionBtn}
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  renderTrainingsPagination(rows.length, totalPages, start, pageItems.length);
}

function renderTrainingsPagination(total, totalPages, start, shown) {
  const bar = document.getElementById('trainings-pagination');
  if (!bar) return;
  if (total === 0) {
    bar.innerHTML = '';
    bar.style.display = 'none';
    return;
  }
  bar.style.display = '';

  const navBtn = (label, target, disabled, iconFirst) => {
    const icon = `<span class="material-icons">${iconFirst ? 'chevron_left' : 'chevron_right'}</span>`;
    return `<button type="button" class="trn-page-btn trn-page-nav" ${disabled ? 'disabled' : `onclick="goTrainingsPage(${target})"`}>${iconFirst ? icon + label : label + icon}</button>`;
  };
  let pages = '';
  for (let p = 1; p <= totalPages; p++) {
    const active = p === trainingsPage;
    pages += `<button type="button" class="trn-page-btn${active ? ' is-active' : ''}" ${active ? 'aria-current="page"' : `onclick="goTrainingsPage(${p})"`}>${p}</button>`;
  }

  bar.innerHTML = `
    <div class="trn-foot-count">
      <span class="trn-dot trn-dot--green"></span>
      แสดงผล <b>${start + 1}–${start + shown}</b> จากทั้งหมด <b>${total}</b> รายการ
    </div>
    ${totalPages > 1 ? `<div class="trn-pages">
      ${navBtn('ก่อนหน้า', trainingsPage - 1, trainingsPage <= 1, true)}
      ${pages}
      ${navBtn('ถัดไป', trainingsPage + 1, trainingsPage >= totalPages, false)}
    </div>` : ''}
  `;
}

window.goTrainingsPage = function(page) {
  trainingsPage = page;
  renderTrainingsPage();
};

window.deleteTraining = async function(id) {
  if (confirm('คุณต้องการลบรายการอบรมนี้หรือไม่?')) {
    try {
      const res = await fetch(`/api/student/trainings/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        loadTrainings();
      } else {
        alert('ไม่สามารถลบได้: ' + (data.message || 'เกิดข้อผิดพลาด'));
      }
    } catch (err) {
      console.error(err);
    }
  }
};

// ---- Modal กลาง (สร้างครั้งเดียว ต่อท้าย body เพื่อไม่ให้ถูก overflow/transform ของ panel ตัด) ----
function getTrainingModalRoot() {
  let root = document.getElementById('trn-modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'trn-modal-root';
    root.className = 'trn-modal-backdrop';
    root.hidden = true;
    root.addEventListener('click', (e) => { if (e.target === root) closeTrainingModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const lightbox = document.getElementById('trn-lightbox');
      if (lightbox && !lightbox.hidden) { closeCertificateLightbox(); return; }
      if (!root.hidden) closeTrainingModal();
    });
    document.body.appendChild(root);
  }
  return root;
}

function closeTrainingModal() {
  closeCertificateLightbox();
  const root = document.getElementById('trn-modal-root');
  if (root) {
    root.hidden = true;
    root.innerHTML = '';
  }
  document.body.classList.remove('trn-modal-open');
}
window.closeTrainingModal = closeTrainingModal;

function showTrainingModal(title, bodyHtml, footHtml) {
  const root = getTrainingModalRoot();
  root.innerHTML = `
    <div class="trn-modal" role="dialog" aria-modal="true" aria-labelledby="trn-modal-title">
      <div class="trn-modal-head">
        <h3 id="trn-modal-title">${title}</h3>
        <button type="button" class="trn-icon-btn" aria-label="ปิด" onclick="closeTrainingModal()"><span class="material-icons">close</span></button>
      </div>
      <div class="trn-modal-body">${bodyHtml}</div>
      <div class="trn-modal-foot">${footHtml}</div>
    </div>`;
  root.hidden = false;
  document.body.classList.add('trn-modal-open');
}

// URL รูปของ Certificate: รูปภาพใช้ตรง ๆ, PDF บน Cloudinary → .jpg (หน้าแรก), อื่น ๆ → '' (ใช้ PDF viewer)
function getCertificateImageUrl(url) {
  const u = String(url || '');
  if (!u) return '';
  if (/.pdf($|[?#])/i.test(u)) return u.includes('cloudinary.com') ? u.replace(/.pdf($|[?#])/i, '.jpg$1') : '';
  return u;
}

// รูปโหลดไม่ขึ้น → เปลี่ยนเป็น PDF viewer (ถ้าเป็น PDF) หรือซ่อนกรอบ
window.certificatePreviewFallback = function(imgEl) {
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
};

// Lightbox: รูปใหญ่บนพื้นหลังสีเทาเข้ม กดพื้นหลัง / ปุ่มปิด / Esc เพื่อปิด
window.openCertificateLightbox = function(src) {
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
      if (e.target === box || (e.target as HTMLElement).closest('.trn-lightbox-close')) closeCertificateLightbox();
    });
    document.body.appendChild(box);
  }
  box.querySelector('img').src = src;
  box.hidden = false;
};

function closeCertificateLightbox() {
  const box = document.getElementById('trn-lightbox');
  if (box) box.hidden = true;
}
window.closeCertificateLightbox = closeCertificateLightbox;

// ดูรายละเอียดรายการ (รวมหมายเหตุยาว ๆ ที่ย้ายออกจากตาราง)
window.viewTraining = function(id) {
  const t = (currentTrainingsData || []).find((x) => x.id === id);
  if (!t) return;
  const v = getTrainingView(t);
  const row = (label, value) => `<div class="trn-detail-row"><div class="trn-detail-label">${label}</div><div class="trn-detail-value">${value}</div></div>`;
  const statusText = v.statusKey === 'APPROVED' ? 'ผ่าน' : v.statusKey === 'REJECTED' ? 'ไม่ผ่าน' : 'รอตรวจ';
  const sourceText = v.sourceKey === 'CHECKIN' ? 'Check-in หน้างาน' : v.sourceKey === 'UPLOAD' ? 'นิสิตอัปโหลด Certificate' : (t.source === 'ADMIN_IMPORT' ? 'อาจารย์ประจำวิชาเพิ่มให้' : 'นำเข้าโดยเจ้าหน้าที่คณะ');
  const certUrl = t.certificateFileUrl || '';
  const safeUrl = escapeStudentHtml(certUrl);
  // แสดงเป็นรูป: PDF บน Cloudinary แปลงหน้าแรกเป็น .jpg (วิธีเดียวกับตัวอย่าง CV) → กดรูปเพื่อดูภาพใหญ่
  // ถ้าแปลงเป็นรูปไม่ได้ (ไม่ใช่ Cloudinary / โหลดรูปไม่ขึ้น) → แสดง PDF viewer แทน
  const certImg = getCertificateImageUrl(certUrl);
  const certPreview = !certUrl ? '' : `
    <div class="trn-cert">
      <div class="trn-cert-head">
        <span class="trn-detail-label">Certificate</span>
        <a class="trn-file-link" href="${safeUrl}" target="_blank" rel="noopener">เปิดไฟล์ Certificate<span class="material-icons">open_in_new</span></a>
      </div>
      <div class="trn-cert-preview" data-src="${safeUrl}">
        ${certImg
          ? `<button type="button" class="trn-cert-thumb" onclick="openCertificateLightbox(this.querySelector('img').src)" aria-label="ดูรูป Certificate ขนาดใหญ่">
              <img src="${escapeStudentHtml(certImg)}" alt="ตัวอย่างไฟล์ Certificate" onerror="certificatePreviewFallback(this)" />
              <span class="trn-cert-zoom"><span class="material-icons">zoom_in</span>คลิกเพื่อดูภาพใหญ่</span>
            </button>`
          : `<iframe src="${safeUrl}" title="ตัวอย่างไฟล์ Certificate" loading="lazy"></iframe>`}
      </div>
    </div>`;
  showTrainingModal('รายละเอียดการอบรม', `
    ${row('ชื่อกิจกรรม', escapeStudentHtml(v.title))}
    ${v.sub ? row('ช่วง / เวลา', escapeStudentHtml(v.sub)) : ''}
    ${row('ประเภท', t.skillType === 'HARD' ? 'Hard skill' : 'Soft skill')}
    ${row('ชั่วโมง', `${Number(t.hours) || 0} ชม.`)}
    ${row('วันที่', escapeStudentHtml(v.dateText))}
    ${row('แหล่งที่มา', sourceText)}
    ${row('สถานะ', statusText)}
    ${t.note ? row('หมายเหตุ', escapeStudentHtml(t.note)) : ''}
    ${certPreview}
  `, '<button type="button" class="trn-btn trn-btn--ghost" onclick="closeTrainingModal()">ปิด</button>');
};

// ---- Modal "เพิ่มข้อมูลการอบรม" (ใช้ POST /api/student/trainings เดิม: title, skillType, hours, certificate) ----
const TRAINING_CERT_EXTS = ['.pdf', '.jpg', '.jpeg', '.png'];
const TRAINING_CERT_MAX = 10 * 1024 * 1024;
let trainingModalFile = null;
const trainingModalTouched = new Set();

window.openTrainingModal = function() {
  if (isInternshipLocked) return;
  trainingModalFile = null;
  trainingModalTouched.clear();
  showTrainingModal('เพิ่มข้อมูลการอบรม', `
    <p class="trn-modal-intro">สำหรับคอร์สออนไลน์/ภายนอก ชั่วโมงจาก Check-in หน้างานไม่ต้องเพิ่มเอง รายการใหม่จะมีสถานะ "รอตรวจ" จนกว่าอาจารย์จะอนุมัติ</p>
    <div class="trn-field">
      <label for="trn-f-title">ชื่อคอร์ส / กิจกรรม <span class="trn-req">*</span></label>
      <input id="trn-f-title" class="trn-input" type="text" maxlength="200" placeholder="เช่น Google Cybersecurity Professional Certificate" data-field="title" />
      <div class="trn-field-error" data-error="title"></div>
    </div>
    <div class="trn-field-grid">
      <div class="trn-field">
        <label for="trn-f-type">ประเภท <span class="trn-req">*</span></label>
        <select id="trn-f-type" class="trn-input" data-field="type">
          <option value="">เลือกประเภท</option>
          <option value="soft">Soft skill</option>
          <option value="hard">Hard skill</option>
        </select>
        <div class="trn-field-error" data-error="type"></div>
      </div>
      <div class="trn-field">
        <label for="trn-f-hours">จำนวนชั่วโมง <span class="trn-req">*</span></label>
        <input id="trn-f-hours" class="trn-input" type="number" min="1" step="1" inputmode="numeric" placeholder="เช่น 6" data-field="hours" />
        <div class="trn-field-error" data-error="hours"></div>
      </div>
    </div>
    <div class="trn-field">
      <label>แนบ Certificate <span class="trn-req">*</span></label>
      <input id="trn-f-file" type="file" accept=".pdf,.jpg,.jpeg,.png" hidden />
      <div class="trn-drop" id="trn-f-drop" tabindex="0" role="button" aria-label="เลือกไฟล์ Certificate">
        <span class="material-icons">cloud_upload</span>
        <span class="trn-drop-text" id="trn-f-file-name">ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์</span>
        <span class="trn-drop-help">PDF, JPG, PNG • ไม่เกิน 10MB</span>
      </div>
      <div class="trn-field-error" data-error="file"></div>
    </div>
  `, `
    <button type="button" class="trn-btn trn-btn--ghost" onclick="closeTrainingModal()">ยกเลิก</button>
    <button type="button" class="trn-btn trn-btn--primary" id="trn-f-submit" disabled onclick="submitTrainingModal()">บันทึก</button>
  `);

  const root = document.getElementById('trn-modal-root');
  root.querySelectorAll('[data-field]').forEach((el) => {
    const mark = () => { trainingModalTouched.add(el.getAttribute('data-field')); validateTrainingModal(); };
    el.addEventListener('input', mark);
    el.addEventListener('change', mark);
    el.addEventListener('blur', mark);
  });
  const fileInput = document.getElementById('trn-f-file') as HTMLInputElement;
  const drop = document.getElementById('trn-f-drop');
  const pick = (file) => {
    trainingModalFile = file || null;
    trainingModalTouched.add('file');
    const nameEl = document.getElementById('trn-f-file-name');
    if (nameEl) nameEl.textContent = file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)` : 'ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์';
    drop.classList.toggle('has-file', Boolean(file));
    validateTrainingModal();
  };
  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener('change', () => pick(fileInput.files?.[0]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('is-over'); pick(e.dataTransfer?.files?.[0]); });
  (document.getElementById('trn-f-title') as HTMLInputElement)?.focus();
};

function validateTrainingModal() {
  const title = (document.getElementById('trn-f-title') as HTMLInputElement)?.value.trim() || '';
  const type = (document.getElementById('trn-f-type') as HTMLSelectElement)?.value || '';
  const hoursRaw = (document.getElementById('trn-f-hours') as HTMLInputElement)?.value.trim() || '';
  const hours = Number(hoursRaw);
  const errors = { title: '', type: '', hours: '', file: '' };
  if (!title) errors.title = 'กรุณากรอกชื่อคอร์ส';
  if (!type) errors.type = 'กรุณาเลือกประเภท';
  if (!hoursRaw) errors.hours = 'กรุณากรอกจำนวนชั่วโมง';
  else if (!Number.isInteger(hours) || hours <= 0) errors.hours = 'จำนวนชั่วโมงต้องเป็นจำนวนเต็มมากกว่า 0';
  if (!trainingModalFile) errors.file = 'กรุณาแนบไฟล์ Certificate';
  else {
    const name = trainingModalFile.name.toLowerCase();
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
    if (!TRAINING_CERT_EXTS.includes(ext)) errors.file = 'รองรับเฉพาะไฟล์ PDF, JPG หรือ PNG';
    else if (trainingModalFile.size > TRAINING_CERT_MAX) errors.file = 'ไฟล์มีขนาดเกิน 10MB';
  }
  const root = document.getElementById('trn-modal-root');
  Object.entries(errors).forEach(([key, msg]) => {
    const show = trainingModalTouched.has(key) ? msg : '';
    const el = root?.querySelector(`[data-error="${key}"]`);
    if (el) el.textContent = show;
    const input = key === 'file' ? document.getElementById('trn-f-drop') : root?.querySelector(`[data-field="${key}"]`);
    if (input) input.classList.toggle('is-invalid', Boolean(show));
  });
  const ok = Object.values(errors).every((m) => !m);
  const submit = document.getElementById('trn-f-submit') as HTMLButtonElement;
  if (submit && !submit.dataset.busy) submit.disabled = !ok;
  return ok;
}

window.submitTrainingModal = async function() {
  ['title', 'type', 'hours', 'file'].forEach((k) => trainingModalTouched.add(k));
  if (!validateTrainingModal()) return;
  const submit = document.getElementById('trn-f-submit') as HTMLButtonElement;
  submit.dataset.busy = '1';
  submit.disabled = true;
  submit.textContent = 'กำลังบันทึก...';
  try {
    const formData = new FormData();
    formData.append('hours', (document.getElementById('trn-f-hours') as HTMLInputElement).value.trim());
    formData.append('skillType', (document.getElementById('trn-f-type') as HTMLSelectElement).value);
    formData.append('title', (document.getElementById('trn-f-title') as HTMLInputElement).value.trim());
    formData.append('certificate', trainingModalFile);
    const res = await fetch('/api/student/trainings', { method: 'POST', body: formData });
    const data = await res.json().catch(() => null);
    if (data && data.success) {
      closeTrainingModal();
      await loadTrainings();
    } else {
      alert('บันทึกไม่สำเร็จ: ' + ((data && data.message) || 'เกิดข้อผิดพลาด'));
    }
  } catch (err) {
    console.error(err);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
  } finally {
    if (document.body.contains(submit)) {
      delete submit.dataset.busy;
      submit.textContent = 'บันทึก';
      validateTrainingModal();
    }
  }
};

// 3. จัดการ CV
async function loadCv() {
  try {
    const res = await fetch('/api/student/cv');
    const data = await res.json();
    if (data.success) applyInternshipLock(data.internshipLock);
    if (data.success && data.cv) {
      currentCvData = data.cv;
      if (data.cv.fileUrl) {
        renderCvPreview(data.cv.fileUrl, data.cv.fileName, data.cv.status, data.cv.note);
      } else {
        showCvUploadZone();
      }
    } else {
      currentCvData = null;
      showCvUploadZone();
    }
  } catch (err) {
    console.error('Load CV error:', err);
    // โหลดไม่ได้และยังไม่เคยแสดง CV → ให้กลับไปที่ช่องอัปโหลด
    if (!currentCvUrl) showCvUploadZone();
  } finally {
    const loadingEl = document.getElementById('cv-loading');
    if (loadingEl) loadingEl.style.display = 'none';
    checkPlacementUnlock();
  }
}

// แสดงช่องอัปโหลด (ยังไม่มี CV)
function showCvUploadZone() {
  const zone = document.getElementById('cv-upload-zone');
  const content = document.getElementById('cv-upload-content');
  const preview = document.getElementById('cv-preview-container');
  if (zone) zone.style.display = 'flex';
  if (content) content.style.display = 'flex';
  if (preview) preview.style.display = 'none';
}

const cvInput = document.getElementById('cv-upload-input');
const cvUploadContent = document.getElementById('cv-upload-content');
const cvPreviewContainer = document.getElementById('cv-preview-container');
const cvPreviewImg = document.getElementById('cv-preview-img');
const cvPreviewPdf = document.getElementById('cv-preview-pdf');
const cvPdfName = document.getElementById('cv-pdf-name');
const cvStatusBadge = document.getElementById('cv-status-badge');
let currentCvUrl = null;

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatThaiDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  const date = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time} น.`;
}

// ลิงก์ดาวน์โหลด: Cloudinary ใส่ fl_attachment ให้เบราว์เซอร์ดาวน์โหลดแทนการเปิดดู
function getCvDownloadUrl(fileUrl) {
  if (fileUrl.includes('cloudinary.com') && fileUrl.includes('/upload/')) {
    return fileUrl.replace('/upload/', '/upload/fl_attachment/');
  }
  return fileUrl;
}

// ขนาดไฟล์ไม่ได้เก็บใน DB → ถาม Content-Length จาก URL ไฟล์ (ถ้าไม่ได้ก็แสดง "-")
async function loadCvFileSize(fileUrl) {
  const sizeEl = document.getElementById('cv-file-size');
  if (!sizeEl) return;
  sizeEl.textContent = '-';
  try {
    const res = await fetch(fileUrl, { method: 'HEAD' });
    if (!res.ok || fileUrl !== currentCvUrl) return;
    const len = Number(res.headers.get('content-length'));
    if (len > 0) sizeEl.textContent = formatFileSize(len);
  } catch {
    // ignore (CORS / network)
  }
}

// ชื่อไฟล์ภาษาไทยที่ถูกบันทึกแบบ latin1 (เช่น "à¹\u0081à¸...") → แปลงกลับเป็น UTF-8
function fixMojibakeName(name) {
  if (!name || !/[À-ÿ]/.test(name)) return name;
  try {
    const bytes = Uint8Array.from(name, (c) => c.charCodeAt(0) & 0xff);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return name;
  }
}

function renderCvDetails(cv, fileUrl, rawFileName, status, note) {
  const fileName = fixMojibakeName(rawFileName);
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  const ext = ((fileName || fileUrl).split('?')[0].split('.').pop() || '').toUpperCase();
  setText('cv-file-ext', ext && ext.length <= 5 ? ext : 'FILE');
  setText('cv-pdf-name', fileName || 'CV');

  const uploadedAt = cv && cv.uploadedAt ? new Date(cv.uploadedAt) : null;
  if (cv && cv.id) {
    const year = uploadedAt && !isNaN(uploadedAt.getTime()) ? uploadedAt.getFullYear() + 543 : '';
    setText('cv-doc-code', `CV-${year ? year + '-' : ''}${String(cv.id).padStart(4, '0')}`);
  } else {
    setText('cv-doc-code', '-');
  }
  setText('cv-uploaded-at', formatThaiDateTime(cv && cv.uploadedAt));

  if (status === 'PENDING' || !status) {
    setText('cv-reviewer', 'รออาจารย์ตรวจ');
  } else if (cv && cv.reviewerName) {
    setText('cv-reviewer', cv.reviewerRole ? `${cv.reviewerName} (${cv.reviewerRole})` : cv.reviewerName);
  } else {
    setText('cv-reviewer', '-');
  }

  const noteBox = document.getElementById('cv-note-box');
  if (noteBox) {
    const noteText = status === 'REJECTED' ? (note || 'กรุณาอัปโหลดใหม่') : note;
    if (noteText) {
      noteBox.style.display = 'flex';
      noteBox.classList.toggle('cv-doc-note--fail', status === 'REJECTED');
      setText('cv-note-label', status === 'REJECTED' ? 'เหตุผลที่ไม่ผ่าน / สิ่งที่ต้องแก้ไข:' : 'ข้อเสนอแนะจากผู้ตรวจ:');
      setText('cv-note-text', `"${noteText}"`);
    } else {
      noteBox.style.display = 'none';
    }
  }

  const downloadBtn = document.getElementById('cv-download-btn') as HTMLAnchorElement | null;
  if (downloadBtn) {
    downloadBtn.href = getCvDownloadUrl(fileUrl);
    downloadBtn.setAttribute('download', fileName || 'CV');
  }

  loadCvFileSize(fileUrl);
}

function renderCvPreview(fileUrl, fileName, status, note) {
  currentCvUrl = fileUrl;
  cvUploadContent.style.display = 'none';
  const cvUploadZone = document.getElementById('cv-upload-zone');
  if (cvUploadZone) cvUploadZone.style.display = 'none';
  cvPreviewContainer.style.display = 'block';

  // สถานะ CV: CVตรวจแล้ว / ผ่าน & รอผล & CVไม่ผ่าน / ทำใหม่
  if (status === 'APPROVED') {
    cvStatusBadge.innerHTML = '<span class="cv-doc-badge-dot"></span><span class="material-icons">verified</span> ตรวจแล้ว • ผ่าน';
    cvStatusBadge.className = 'cv-doc-badge cv-doc-badge--pass';
  } else if (status === 'REJECTED') {
    cvStatusBadge.innerHTML = '<span class="cv-doc-badge-dot"></span><span class="material-icons">cancel</span> ไม่ผ่าน • ทำใหม่';
    cvStatusBadge.className = 'cv-doc-badge cv-doc-badge--fail';
  } else {
    cvStatusBadge.innerHTML = '<span class="cv-doc-badge-dot"></span><span class="material-icons">schedule</span> รอผล • รออาจารย์ตรวจ';
    cvStatusBadge.className = 'cv-doc-badge cv-doc-badge--wait';
  }

  renderCvDetails(currentCvData, fileUrl, fileName, status, note);

  const isPdf = fileUrl.toLowerCase().endsWith('.pdf') || (fileName && fileName.toLowerCase().endsWith('.pdf'));

  if (isPdf) {
    const showPdfIcon = () => {
      cvPreviewImg.style.display = 'none';
      cvPreviewPdf.style.display = 'flex';
    };
    if (fileUrl.includes('cloudinary.com')) {
      // Cloudinary แปลงหน้าแรกของ PDF เป็นรูป .jpg ให้ → แสดงเป็นรูป ถ้าโหลดไม่ได้ค่อยกลับไปใช้ไอคอน PDF
      cvPreviewImg.onerror = showPdfIcon;
      cvPreviewImg.src = fileUrl.replace(/\.pdf$/i, '.jpg');
      cvPreviewImg.style.display = 'block';
      cvPreviewPdf.style.display = 'none';
    } else {
      showPdfIcon();
    }
  } else {
    cvPreviewImg.onerror = null;
    cvPreviewImg.src = fileUrl;
    cvPreviewImg.style.display = 'block';
    cvPreviewPdf.style.display = 'none';
  }
}

if (cvInput) {
  cvInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('cv', file);

      try {
        const res = await fetch('/api/student/cv', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.success && data.cv) {
          currentCvData = data.cv;
          renderCvPreview(data.cv.fileUrl, data.cv.fileName, data.cv.status, data.cv.note);
          alert('✅ อัปโหลดไฟล์ CV สำเร็จ');
          checkPlacementUnlock();
        } else {
          alert('เกิดข้อผิดพลาด: ' + (data.message || 'อัปโหลดไม่สำเร็จ'));
        }
      } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
      }
    }
  });
}

window.openCvModal = function() {
  if (!currentCvUrl) return;
  const modal = document.getElementById('cv-modal');
  const modalImg = document.getElementById('cv-modal-img');
  const modalPdf = document.getElementById('cv-modal-pdf');

  modal.style.display = 'flex';
  const openLink = document.getElementById('cv-modal-open') as HTMLAnchorElement | null;
  if (openLink) openLink.href = currentCvUrl;
  const isPdf = currentCvUrl.toLowerCase().endsWith('.pdf') || currentCvUrl.includes('.pdf');

  if (isPdf) {
    // ถ้าเป็น Cloudinary URL แปลงเป็น .jpg เพื่อแสดงผลได้ทันทีไม่ติด 401
    if (currentCvUrl.includes('cloudinary.com')) {
      modalImg.src = currentCvUrl.replace(/\.pdf$/i, '.jpg');
      modalImg.style.display = 'block';
      modalPdf.style.display = 'none';
    } else {
      modalPdf.src = currentCvUrl;
      modalPdf.style.display = 'block';
      modalImg.style.display = 'none';
    }
  } else {
    modalImg.src = currentCvUrl;
    modalImg.style.display = 'block';
    modalPdf.style.display = 'none';
  }
};

window.closeCvModal = function() {
  document.getElementById('cv-modal').style.display = 'none';
};

// กด Esc เพื่อปิด Lightbox
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const modal = document.getElementById('cv-modal');
  if (modal && modal.style.display !== 'none') window.closeCvModal();
});

// 4. โหลด Checklist บริษัท
// ข้อมูลเสริมสำหรับการ์ด Checklist (มาจาก API เดิม: /api/student/companies และ /api/student/profile)
let currentArchivedCompanies = [];
let currentChecklistPlacement = null;
let currentStudentAdvisor = null;

async function loadCompanies() {
  try {
    const res = await fetch('/api/student/companies');
    const data = await res.json();

    if (data.success && data.companies) {
      currentCompaniesData = data.companies;
      currentArchivedCompanies = Array.isArray(data.archivedCompanies) ? data.archivedCompanies : [];
      currentChecklistPlacement = data.placement || null;
    }
    renderChecklistCards();
  } catch (err) {
    console.error('Load companies error:', err);
    renderChecklistCards();
  } finally {
    checkPlacementUnlock();
  }
}

// ---------- helpers การ์ด Checklist ----------
const CKL_STATUS = {
  PENDING: { tone: 'amber', text: 'รอผลการพิจารณา', spinner: true },
  APPROVED: { tone: 'green', text: 'อนุมัติ', icon: 'check_circle' },
  REJECTED: { tone: 'red', text: 'ไม่อนุมัติ', icon: 'cancel' },
  COMPANY_REJECTED: { tone: 'slate', text: 'บริษัทปฏิเสธ', icon: 'block' },
  CANCELLED: { tone: 'gray', text: 'ยกเลิกโดยนิสิต', icon: 'do_not_disturb_on' },
};

function cklStatusPill(key) {
  const s = CKL_STATUS[key] || CKL_STATUS.PENDING;
  const icon = s.spinner
    ? '<span class="ckl-pill-spinner" aria-hidden="true"></span>'
    : `<span class="material-icons" aria-hidden="true">${s.icon}</span>`;
  return `<span class="ckl-pill ckl-pill--${s.tone}">${icon}${s.text}</span>`;
}

function cklText(v) {
  const s = String(v ?? '').trim();
  return s && s !== '-' ? escapeStudentHtml(s) : '-';
}

// "15 พ.ย. 2569"
function cklDate(value) {
  return formatThaiDateRange(value) || '-';
}

// "16 พ.ย. 2569 14:30 น."
function cklDateTime(value) {
  const dt = value ? new Date(value) : null;
  if (!dt || isNaN(dt.getTime())) return '-';
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${cklDate(value)} ${hh}:${mm} น.`;
}

// เลขที่คำขอ (API ไม่มี field นี้ → สร้างจาก id + ปีที่ยื่น)
function cklRequestNo(id, createdAt) {
  if (!id) return '-';
  const d = parseIsoDate(createdAt);
  return `#CKL-${d ? d.y + 543 : '----'}-${String(id).padStart(4, '0')}`;
}

// ตัวย่อบริษัทสำหรับโลโก้ (ใช้ตัวย่อภาษาอังกฤษถ้ามี ไม่งั้นใช้ 2 ตัวอักษรแรก)
function cklInitials(name) {
  const latin = String(name || '').match(/\b[A-Z][A-Z0-9]{1,5}\b/g);
  if (latin && latin.length) return latin[latin.length - 1].slice(0, 6);
  const clean = String(name || '')
    .replace(/บริษัท|จำกัด|\(มหาชน\)|มหาชน|ห้างหุ้นส่วน|สำนักงาน|Co\.,?|Ltd\.?|Company|Limited/gi, ' ')
    .trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (!words.length) return '-';
  if (/^[A-Za-z]/.test(words[0])) return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return Array.from(words[0]).slice(0, 2).join('');
}

function cklLogo(name, muted = false) {
  const text = cklInitials(name);
  const size = text.length > 4 ? ' ckl-logo--long' : '';
  return `<div class="ckl-logo${muted ? ' ckl-logo--muted' : ''}${size}" aria-hidden="true">${escapeStudentHtml(text)}</div>`;
}

function cklField(label, valueHtml) {
  return `<div class="ckl-field"><span class="ckl-field-label">${label}</span><span class="ckl-field-value">${valueHtml}</span></div>`;
}

function cklWebsite(url) {
  const s = String(url || '').trim();
  if (!s) return '-';
  const href = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  return `<a class="ckl-link" href="${escapeStudentHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeStudentHtml(s)}<span class="material-icons">open_in_new</span></a>`;
}

// ช่วงฝึกงาน + จำนวนเดือน (API ยังไม่มี field วันเริ่ม/สิ้นสุด → รองรับไว้ถ้ามีในอนาคต)
function cklPeriod(start, end) {
  const range = formatThaiDateRange(start, end);
  if (!range || !end) return '-';
  const a = new Date(start);
  const b = new Date(end);
  const months = Math.round((b.getTime() - a.getTime()) / 86400000 / 30.44);
  return months > 0 ? `${range} (${months} เดือน)` : range;
}

// timeline (ใหม่สุดอยู่บน) — tone: green/red/amber/gray/blue
function cklTimeline(events) {
  if (!events.length) return '<p class="ckl-empty-inline">ยังไม่มีประวัติสถานะ</p>';
  return `<ol class="ckl-timeline">${events.map((e) => `
      <li class="ckl-tl-item">
        <span class="ckl-tl-dot ckl-tl-dot--${e.tone}" aria-hidden="true"></span>
        <div class="ckl-tl-body">
          <div class="ckl-tl-head">
            <span class="ckl-tl-action">${escapeStudentHtml(e.action)}</span>
            ${e.by ? `<span class="ckl-tl-by">โดย ${escapeStudentHtml(e.by)}</span>` : ''}
            <span class="ckl-tl-time">${cklDateTime(e.time)}</span>
          </div>
          ${e.change ? `<p class="ckl-tl-change"><span>${escapeStudentHtml(e.change.from)}</span><span class="material-icons">arrow_forward</span><span>${escapeStudentHtml(e.change.to)}</span></p>` : ''}
          ${e.note ? `<p class="ckl-tl-note">${escapeStudentHtml(e.note)}</p>` : ''}
        </div>
      </li>`).join('')}
    </ol>`;
}

function cklSortEvents(events) {
  return events
    .filter((e) => e && e.time)
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

// API ไม่มี log ประวัติ → สร้าง timeline จาก createdAt / updatedAt / reviewedAt / checklistNote
function cklCurrentEvents(c, advisorName) {
  const events = [{ tone: 'amber', action: 'ยื่นคำขอ Checklist', by: 'นิสิต', time: c.createdAt }];
  const created = new Date(c.createdAt).getTime();
  const updated = new Date(c.updatedAt).getTime();
  const reviewed = c.reviewedAt ? new Date(c.reviewedAt).getTime() : 0;
  // แก้ไขหลังยื่น (ยังไม่ตรวจ) — API ไม่เก็บค่าเก่า จึงแสดงเฉพาะเวลา
  if (c.checklistStatus === 'PENDING' && updated - created > 60000 && (!reviewed || updated - reviewed > 60000)) {
    events.push({ tone: 'gray', action: 'แก้ไขข้อมูลคำขอ', by: 'นิสิต', time: c.updatedAt });
  }
  if (c.reviewedAt && c.checklistStatus === 'APPROVED') {
    events.push({ tone: 'green', action: 'อาจารย์ที่ปรึกษาอนุมัติ Checklist', by: advisorName, time: c.reviewedAt, note: c.checklistNote });
  } else if (c.reviewedAt && c.checklistStatus === 'REJECTED') {
    events.push({ tone: 'red', action: 'อาจารย์ที่ปรึกษาไม่อนุมัติ Checklist', by: advisorName, time: c.reviewedAt, note: c.checklistNote });
  }
  // ความเห็นที่ยังไม่ได้ผูกกับผลการตรวจ (ยังรอผล)
  if (c.checklistNote && c.checklistStatus === 'PENDING') {
    events.push({ tone: 'blue', action: 'อาจารย์ที่ปรึกษาให้ความเห็น', by: advisorName, time: c.reviewedAt || c.updatedAt, note: c.checklistNote });
  }
  return cklSortEvents(events);
}

// อักษรย่อใน avatar อาจารย์ (ตัดคำนำหน้าทางวิชาการ)
function cklAvatarText(name) {
  const clean = String(name || '').replace(/^((ผศ|รศ|ศ|อ|ดร|ผศ\.ดร|รศ\.ดร)\.?\s*)+/g, '').trim();
  return clean ? Array.from(clean).slice(0, 2).join('') : 'อ.';
}

let cklHistoryExpanded = false;
const cklHistoryOpenRows = new Set();
let cklTimelineExpanded = false;

// ---------- การ์ด 1: คำขอปัจจุบัน ----------
function renderChecklistCurrentCard() {
  const box = document.getElementById('ckl-current-card');
  if (!box) return;
  const list = currentCompaniesData || [];
  const c = list.length ? list[list.length - 1] : null;

  if (!c) {
    box.innerHTML = `
      <div class="ckl-empty">
        <span class="ckl-empty-icon"><span class="material-icons">fact_check</span></span>
        <p class="ckl-empty-title">ยังไม่ได้ยื่น Checklist</p>
        <p class="ckl-empty-desc">กดปุ่ม "เพิ่มข้อมูล" ด้านบนเพื่อกรอก Checklist สถานประกอบการ</p>
      </div>`;
    return;
  }

  // ข้อมูลบริษัท/ผู้ติดต่อเก็บใน placement (ใช้เมื่อชื่อบริษัทตรงกันหรือยังไม่ได้ตั้งชื่อ)
  const p = currentChecklistPlacement;
  const info = p && (!p.companyNameTh || p.companyNameTh === c.name) ? p : {};
  const advisorName = currentStudentAdvisor?.name || '';
  const statusKey = CKL_STATUS[c.checklistStatus] ? c.checklistStatus : 'PENDING';
  const isPending = statusKey === 'PENDING';
  const events = cklCurrentEvents(c, advisorName || 'อาจารย์ที่ปรึกษา');

  const meta = [
    `<span>ตำแหน่ง: <strong>${cklText(info.position)}</strong></span>`,
    `<span>จังหวัด: ${cklText(info.province)}</span>`,
    `<span>วันที่ยื่น: ${cklDate(c.createdAt)}</span>`,
  ].join('<span class="ckl-dot-sep" aria-hidden="true">·</span>');

  const hr = [info.contactPersonName, info.contactPersonPosition ? `(${info.contactPersonPosition})` : ''].filter(Boolean).join(' ');
  const phones = [info.companyPhone1, info.companyPhone2].filter(Boolean).join(', ');

  const comment = c.checklistNote
    ? `
        <div class="ckl-advisor">
          <span class="ckl-avatar" aria-hidden="true">${escapeStudentHtml(cklAvatarText(advisorName))}</span>
          <div class="ckl-advisor-main">
            <p class="ckl-advisor-name">${cklText(advisorName)} <span class="ckl-advisor-role">(อาจารย์ที่ปรึกษา)</span></p>
            <div class="ckl-quote">"${escapeStudentHtml(c.checklistNote)}"</div>
          </div>
        </div>`
    : '<p class="ckl-empty-inline">ยังไม่มีความเห็นจากอาจารย์ที่ปรึกษา</p>';

  box.innerHTML = `
    <div class="ckl-head">
      ${cklLogo(c.name)}
      <div class="ckl-head-main">
        <div class="ckl-head-tags">
          <span class="ckl-tag">บริษัทปัจจุบันที่กำลังยื่น</span>
        </div>
        <h3 class="ckl-company">${cklText(c.name)}</h3>
        <p class="ckl-meta">${meta}</p>
      </div>
      <div class="ckl-head-status">
        <span class="ckl-head-status-label">สถานะคำขอ</span>
        ${cklStatusPill(statusKey)}
      </div>
    </div>

    <div class="ckl-section">
      <p class="ckl-section-title">ข้อมูลสถานประกอบการและผู้ประสานงาน</p>
      <div class="ckl-info-grid">
        <div class="ckl-info-box">
          ${cklField('ที่อยู่บริษัท:', cklText(info.companyAddress))}
          ${cklField('เว็บไซต์บริษัท:', cklWebsite(info.website))}
          ${cklField('ช่วงเวลาฝึกงาน:', cklPeriod(info.startDate, info.endDate))}
        </div>
        <div class="ckl-info-box">
          ${cklField('ผู้ประสานงาน/HR:', cklText(hr))}
          ${cklField('เบอร์โทรศัพท์:', cklText(phones))}
          ${cklField('อีเมลติดต่อ:', info.companyEmail ? `<a class="ckl-link" href="mailto:${escapeStudentHtml(info.companyEmail)}">${escapeStudentHtml(info.companyEmail)}</a>` : '-')}
        </div>
      </div>
    </div>

    <div class="ckl-panel">
      <div class="ckl-panel-head">
        <p class="ckl-panel-title"><span class="ckl-bullet" aria-hidden="true"></span>ความเห็นอาจารย์ที่ปรึกษา</p>
        ${c.reviewedAt ? `<span class="ckl-panel-sub">ตรวจล่าสุด: ${cklDateTime(c.reviewedAt)}</span>` : ''}
      </div>
      ${comment}
    </div>

    <div class="ckl-panel ckl-collapse${cklTimelineExpanded ? ' is-open' : ''}">
      <button type="button" class="ckl-collapse-btn" aria-expanded="${cklTimelineExpanded}" onclick="toggleChecklistTimeline()">
        <span class="ckl-panel-title"><span class="material-icons ckl-panel-icon">schedule</span>ประวัติสถานะคำขอนี้</span>
        <span class="ckl-collapse-meta">แสดงประวัติ (${events.length})<span class="material-icons ckl-chevron">expand_more</span></span>
      </button>
      <div class="ckl-collapse-body"${cklTimelineExpanded ? '' : ' hidden'}>${cklTimeline(events)}</div>
    </div>

    <div class="ckl-foot">
      <p class="ckl-foot-info"><span class="material-icons">info</span>หากต้องการแก้ไขข้อมูล กรุณาดำเนินการก่อนอาจารย์ที่ปรึกษาลงความอนุมัติ</p>
      <div class="ckl-foot-actions">
        <a class="ckl-btn ckl-btn-text" href="/checklist">ดูรายละเอียดคำขอ</a>
        ${isPending ? '<a class="ckl-btn ckl-btn-outline" href="/checklist"><span class="material-icons">edit_square</span>แก้ไขข้อมูล</a>' : ''}
      </div>
    </div>`;
}

window.toggleChecklistTimeline = function () {
  cklTimelineExpanded = !cklTimelineExpanded;
  renderChecklistCurrentCard();
};

// ---------- การ์ด 2: ประวัติการยื่นบริษัท ----------
function getChecklistHistoryItems() {
  const advisorName = currentStudentAdvisor?.name || 'อาจารย์ที่ปรึกษา';
  const items = (currentArchivedCompanies || []).map((a) => {
    // id รูปแบบ ARCH-xxxxxx-<companyId>
    const companyId = String(a.id || '').split('-').pop();
    const statusKey = a.reason === 'COMPANY_REJECTED' ? 'COMPANY_REJECTED' : a.reason === 'CANCELLED' ? 'CANCELLED' : 'REJECTED';
    const reviewer = statusKey === 'REJECTED' ? advisorName : statusKey === 'COMPANY_REJECTED' ? 'สถานประกอบการ' : 'นิสิต';
    const submittedAt = a.createdAt || a.submittedAt || '';
    return {
      key: `a-${a.id}`,
      name: a.companyName,
      position: a.position,
      requestNo: /^\d+$/.test(companyId) ? cklRequestNo(companyId, submittedAt || a.archivedAt) : '-',
      submittedAt,
      statusKey,
      reason: a.note,
      reviewer,
      closedAt: a.archivedAt,
      events: cklSortEvents([
        { tone: 'amber', action: 'ยื่นคำขอ Checklist', by: 'นิสิต', time: submittedAt },
        { tone: statusKey === 'REJECTED' ? 'red' : 'gray', action: `${CKL_STATUS[statusKey].text} · ปิดคำขอ`, by: reviewer, time: a.archivedAt, note: a.note },
      ]),
    };
  });
  // บริษัทเก่าที่ยังอยู่ในรายการ (ไม่ใช่คำขอปัจจุบัน) และไม่อนุมัติแล้ว
  const list = currentCompaniesData || [];
  list.slice(0, -1).filter((c) => c.checklistStatus === 'REJECTED').forEach((c) => {
    items.push({
      key: `c-${c.id}`,
      name: c.name,
      position: '',
      requestNo: cklRequestNo(c.id, c.createdAt),
      submittedAt: c.createdAt,
      statusKey: 'REJECTED',
      reason: c.checklistNote,
      reviewer: advisorName,
      closedAt: c.reviewedAt,
      events: cklCurrentEvents(c, advisorName),
    });
  });
  return items.sort((x, y) => new Date(y.closedAt || 0).getTime() - new Date(x.closedAt || 0).getTime());
}

function renderChecklistHistoryCard() {
  const box = document.getElementById('ckl-history-card');
  if (!box) return;
  const items = getChecklistHistoryItems();

  const rows = items.length
    ? items.map((it) => {
        const open = cklHistoryOpenRows.has(it.key);
        return `
        <div class="ckl-hrow${open ? ' is-open' : ''}">
          <button type="button" class="ckl-hrow-btn" aria-expanded="${open}" data-key="${escapeStudentHtml(it.key)}" onclick="toggleChecklistHistoryRow(this.dataset.key)">
            ${cklLogo(it.name, true)}
            <span class="ckl-hrow-company">
              <span class="ckl-hrow-name">${cklText(it.name)}</span>
              <span class="ckl-hrow-pos">ตำแหน่ง: ${cklText(it.position)}</span>
            </span>
            <span class="ckl-hrow-cell"><span class="ckl-hrow-label">เลขที่คำขอ</span>${it.requestNo}</span>
            <span class="ckl-hrow-cell"><span class="ckl-hrow-label">วันที่ยื่น</span>${cklDate(it.submittedAt)}</span>
            <span class="ckl-hrow-status">${cklStatusPill(it.statusKey)}</span>
            <span class="material-icons ckl-chevron" aria-hidden="true">expand_more</span>
          </button>
          <div class="ckl-hrow-detail"${open ? '' : ' hidden'}>
            <div class="ckl-hrow-grid">
              ${cklField('เหตุผล:', cklText(it.reason))}
              ${cklField('ผู้พิจารณา:', cklText(it.reviewer))}
              ${cklField('วันที่ปิดคำขอ:', cklDate(it.closedAt))}
            </div>
            ${cklTimeline(it.events)}
          </div>
        </div>`;
      }).join('')
    : '<p class="ckl-empty-inline ckl-empty-inline--center">ยังไม่มีประวัติการยื่นก่อนหน้า</p>';

  box.innerHTML = `
    <button type="button" class="ckl-acc-btn" aria-expanded="${cklHistoryExpanded}" onclick="toggleChecklistHistory()">
      <span class="ckl-acc-icon" aria-hidden="true"><span class="material-icons">schedule</span></span>
      <span class="ckl-acc-text">
        <span class="ckl-acc-title">ประวัติการยื่นบริษัท</span>
        <span class="ckl-acc-sub">รายการสถานประกอบการที่เคยยื่นและสรุปผลแล้วในภาคการศึกษานี้</span>
      </span>
      <span class="ckl-count">${items.length} รายการ</span>
      <span class="material-icons ckl-chevron" aria-hidden="true">expand_more</span>
    </button>
    <div class="ckl-acc-body"${cklHistoryExpanded ? '' : ' hidden'}>${rows}</div>`;
}

window.toggleChecklistHistory = function () {
  cklHistoryExpanded = !cklHistoryExpanded;
  renderChecklistHistoryCard();
};

window.toggleChecklistHistoryRow = function (key) {
  if (cklHistoryOpenRows.has(key)) cklHistoryOpenRows.delete(key);
  else cklHistoryOpenRows.add(key);
  renderChecklistHistoryCard();
};

function renderChecklistCards() {
  renderChecklistCurrentCard();
  renderChecklistHistoryCard();
}

// 5. โหลดสถานะการยื่น (เฉพาะบริษัทที่ผ่านการอนุมัติ Checklist) + อัปโหลดแบบตอบรับจากบริษัท
async function loadSubmissions() {
  try {
    const [res, accRes] = await Promise.all([
      fetch('/api/student/submissions'),
      fetch('/api/student/acceptance-form').catch(() => null),
    ]);
    const data = await res.json();
    const accData = accRes ? await accRes.json().catch(() => null) : null;
    currentAcceptanceData = accData?.success ? accData.acceptance : null;

    if (data.success && data.approvedCompanies) {
      currentSubmissionsData = data.approvedCompanies;
    }
    renderSubmissionTables();
    renderStudentAcceptanceCard();
  } catch (err) {
    console.error('Load submissions error:', err);
  } finally {
    checkPlacementUnlock();
  }
}

// ตัวเลือกสถานะการยื่น + สี (tone) ของ pill
const SUBMISSION_STATUS_OPTIONS = [
  { value: 'NOT_SUBMITTED', label: 'ยังไม่ได้ยื่น', tone: 'gray' },
  { value: 'SUBMITTED_WAITING', label: 'ยื่นแล้ว รอสัมภาษณ์', tone: 'blue' },
  { value: 'INTERVIEWED_PENDING', label: 'สัมภาษณ์แล้ว รอผล', tone: 'amber' },
  { value: 'INTERVIEW_PASSED', label: 'สัมภาษณ์ผ่านแล้ว', tone: 'green' },
  { value: 'INTERVIEW_FAILED_REAPPLIED', label: 'สัมภาษณ์ไม่ผ่าน ยื่นเพิ่มแล้ว', tone: 'red' },
];

function getRawSubmissionStatus(comp) {
  return (comp.submission && comp.submission.status) ? comp.submission.status : 'NOT_SUBMITTED';
}

// เจ้าหน้าที่ยืนยันใบตอบรับแล้ว (ACCEPTED) → บริษัทที่ออกหนังสือถือว่า "สัมภาษณ์ผ่านแล้ว" และล็อกสถานะ/วันเวลา
// ผูกกับบริษัทตามชื่อใน acceptance-form (ไม่พบให้ใช้แถวแรกที่ยังดำเนินการ เหมือน dropdown เอกสารราชการ)
function getAcceptanceLockedCompanyId() {
  if (currentAcceptanceData?.status !== 'ACCEPTED') return null;
  const active = (currentSubmissionsData || []).filter((c) => getRawSubmissionStatus(c) !== 'INTERVIEW_FAILED_REAPPLIED');
  if (!active.length) return null;
  const accCompany = String(currentAcceptanceData?.companyName || '').trim();
  const match = accCompany ? active.find((c) => String(c.name || '').trim() === accCompany) : null;
  return (match || active[0]).id;
}

function isSubmissionLocked(comp) {
  const id = getAcceptanceLockedCompanyId();
  return id !== null && comp.id === id;
}

function getSubmissionStatus(comp) {
  return isSubmissionLocked(comp) ? 'INTERVIEW_PASSED' : getRawSubmissionStatus(comp);
}

function getSubmissionTone(status) {
  const opt = SUBMISSION_STATUS_OPTIONS.find((o) => o.value === status);
  return opt ? opt.tone : 'gray';
}

function formatSubmissionDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

// แปลงวันที่เป็น YYYY-MM-DD ตามเวลาเครื่อง (ใช้กับ <input type="date">)
function toDateInputValue(value) {
  const d = value ? new Date(value) : new Date();
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// pill สถานะ: ปุ่มเปิดเมนูเลือกสถานะแบบกำหนดเอง (แทน <select> ของเบราว์เซอร์)
function renderSubmissionStatusPill(comp) {
  const status = getSubmissionStatus(comp);
  const opt = SUBMISSION_STATUS_OPTIONS.find((o) => o.value === status) || SUBMISSION_STATUS_OPTIONS[0];
  if (isSubmissionLocked(comp)) {
    return `
    <span class="sub-status-wrap">
      <button type="button" class="sub-status sub-status--locked" disabled title="เจ้าหน้าที่ยืนยันผลแล้ว ไม่สามารถเปลี่ยนสถานะได้"
        aria-label="สถานะการยื่น ${escapeStudentHtml(comp.name)}: ${opt.label} (ล็อก)">
        <span class="sub-status-dot"></span>
        <span class="sub-status-label">${opt.label}</span>
        <span class="material-icons sub-status-caret">lock</span>
      </button>
    </span>`;
  }
  return `
    <span class="sub-status-wrap">
      <button type="button" class="sub-status sub-status--${opt.tone}" title="คลิกเพื่อเปลี่ยนสถานะ"
        aria-haspopup="listbox" aria-expanded="false"
        aria-label="สถานะการยื่น ${escapeStudentHtml(comp.name)}: ${opt.label}"
        onclick="openSubmissionStatusMenu(${comp.id}, this)">
        <span class="sub-status-dot"></span>
        <span class="sub-status-label">${opt.label}</span>
        <span class="material-icons sub-status-caret">expand_more</span>
      </button>
    </span>`;
}

// ---- เมนูเลือกสถานะ: ลอย (position: fixed) ใต้ pill — ไม่ถูกกรอบการ์ด/ตารางตัด และแถวไม่ขยาย
// หน้านิสิตใช้ CSS zoom (.student-scale) ทำให้หน่วยของ top/left กับ getBoundingClientRect
// อาจไม่ตรงกัน (ต่างกันตามเวอร์ชันเบราว์เซอร์) จึงวัดค่าจริงก่อน แล้วค่อยวางตำแหน่ง ----
// allowFlip = false → วางใต้ปุ่มเสมอ; คืนค่าจำนวน px ที่ล้นขอบล่างจอ (0 = ไม่ล้น)
function positionSubmissionStatusMenu(menu: HTMLElement, btn: HTMLElement, allowFlip = true): number {
  const s = menu.style;
  s.maxHeight = '';
  s.bottom = 'auto';
  s.top = '0px';
  s.left = '0px';
  const r0 = menu.getBoundingClientRect();
  s.top = '100px';
  s.left = '100px';
  const r1 = menu.getBoundingClientRect();
  const sy = (r1.top - r0.top) / 100 || 1;
  const sx = (r1.left - r0.left) / 100 || 1;
  // ขอบล่างของจอในหน่วยเดียวกับ getBoundingClientRect
  s.top = 'auto';
  s.bottom = '0px';
  const viewportBottom = menu.getBoundingClientRect().bottom;
  s.bottom = 'auto';

  const b = btn.getBoundingClientRect();
  const h = r0.height;
  let targetTop = b.bottom + 6;
  // ที่ว่างด้านล่างไม่พอ → เปิดขึ้นด้านบน pill
  if (allowFlip && targetTop + h > viewportBottom - 8 && b.top - 6 - h >= r0.top) {
    targetTop = b.top - 6 - h;
  }
  s.top = `${(targetTop - r0.top) / sy}px`;
  s.left = `${(b.left - r0.left) / sx}px`;
  // วางใต้ปุ่มเสมอแต่ล้นขอบล่างจอ → จำกัดความสูงให้พอดีจอ แล้วเลื่อนดูด้านใน
  const available = viewportBottom - 8 - targetTop;
  if (!allowFlip && h > available) {
    s.maxHeight = `${Math.max(160, available) / sy}px`;
  }
  return Math.max(0, targetTop + h - (viewportBottom - 8));
}
let submissionStatusMenuEl: HTMLElement | null = null;
let submissionStatusMenuAnchor: HTMLElement | null = null;

function closeSubmissionStatusMenu() {
  if (submissionStatusMenuEl) submissionStatusMenuEl.remove();
  if (submissionStatusMenuAnchor) submissionStatusMenuAnchor.setAttribute('aria-expanded', 'false');
  submissionStatusMenuEl = null;
  submissionStatusMenuAnchor = null;
}

window.openSubmissionStatusMenu = function(companyId, btn) {
  const wasOpenHere = submissionStatusMenuAnchor === btn;
  closeSubmissionStatusMenu();
  closeSubmissionDatePicker();
  if (wasOpenHere) return;

  const comp = (currentSubmissionsData || []).find((c) => c.id === companyId);
  const current = comp ? getSubmissionStatus(comp) : 'NOT_SUBMITTED';

  const menu = document.createElement('div');
  menu.className = 'sub-status-menu';
  menu.setAttribute('role', 'listbox');
  menu.innerHTML = `
    <div class="sub-status-menu-title">เลือกสถานะใหม่</div>
    ${SUBMISSION_STATUS_OPTIONS.map((o) => `
      <button type="button" role="option" class="sub-status-option sub-status-option--${o.tone}${o.value === current ? ' is-current' : ''}"
        aria-selected="${o.value === current}" data-value="${o.value}">
        <span class="sub-status-dot"></span>
        <span>${o.label}</span>
      </button>`).join('')}`;
  menu.addEventListener('click', (e) => {
    const optBtn = (e.target as HTMLElement).closest('.sub-status-option') as HTMLElement | null;
    if (!optBtn) return;
    const value = optBtn.dataset.value;
    closeSubmissionStatusMenu();
    if (value && value !== current) window.onSubmissionStatusChange(companyId, value, btn);
  });
  menu.addEventListener('keydown', (e) => {
    const items = Array.from(menu.querySelectorAll('.sub-status-option')) as HTMLElement[];
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeSubmissionStatusMenu(); btn.focus(); }
  });

  btn.parentElement.appendChild(menu);
  submissionStatusMenuEl = menu;
  submissionStatusMenuAnchor = btn;
  btn.setAttribute('aria-expanded', 'true');
  positionSubmissionStatusMenu(menu, btn);
  const currentItem = menu.querySelector('.is-current') as HTMLElement | null;
  (currentItem || (menu.querySelector('.sub-status-option') as HTMLElement | null))?.focus({ preventScroll: true });
};

document.addEventListener('mousedown', (e) => {
  if (!submissionStatusMenuEl) return;
  const t = e.target as Node;
  if (submissionStatusMenuEl.contains(t) || (submissionStatusMenuAnchor && submissionStatusMenuAnchor.contains(t))) return;
  closeSubmissionStatusMenu();
});
// เมนูเป็น position: fixed → เลื่อนหน้า/ย่อขยายจอแล้วปิด เพื่อไม่ให้ค้างผิดที่
window.addEventListener('resize', closeSubmissionStatusMenu);
window.addEventListener('scroll', (e) => {
  if (submissionStatusMenuEl && !submissionStatusMenuEl.contains(e.target as Node)) closeSubmissionStatusMenu();
}, true);

// วันที่ใต้ชื่อบริษัท: ใช้วันที่ตั้งจากปฏิทิน (submission.updatedAt) ถ้ามี, ไม่งั้นใช้วันที่อนุมัติ Checklist
function getCompanySubDate(comp) {
  const setDate = getSubmissionStatus(comp) !== 'NOT_SUBMITTED' && comp.submission && comp.submission.updatedAt;
  return setDate || comp.reviewedAt || null;
}

function renderSubmissionCompanyCell(comp) {
  return `
    <div class="sub-company">
      <div class="sub-company-text">
        <span class="sub-company-name">${escapeStudentHtml(comp.name)}</span>
        <span class="sub-company-sub">Checklist ผ่านการอนุมัติ${getCompanySubDate(comp) ? ` · ${formatSubmissionDate(getCompanySubDate(comp))}` : ''}</span>
      </div>
    </div>`;
}

// วันสุดท้ายที่ตั้งล่วงหน้าได้: อีก 1 เดือนจากวันนี้ (31 ม.ค. → สิ้นเดือน ก.พ.)
function getMaxScheduleDate() {
  const now = new Date();
  const daysInNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
  return toDateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, Math.min(now.getDate(), daysInNextMonth)));
}

function renderSubmissionDateCell(comp) {
  const status = getSubmissionStatus(comp);
  const updatedAt = comp.submission && comp.submission.updatedAt;
  if (status === 'NOT_SUBMITTED' || !updatedAt) {
    return '<span class="sub-date-empty">— <span class="sub-chip sub-chip--muted">ยังไม่ได้อัปเดต</span></span>';
  }
  const d = new Date(updatedAt);
  const timeText = isNaN(d.getTime()) ? '' : ` · ${pad2(d.getHours())}:${pad2(d.getMinutes())} น.`;
  if (isSubmissionLocked(comp)) {
    return `
    <span class="sub-date-picker">
      <button type="button" class="sub-date sub-date--locked" disabled title="เจ้าหน้าที่ยืนยันผลแล้ว ไม่สามารถเปลี่ยนวันเวลาได้">
        <span class="material-icons">event</span>${formatSubmissionDate(updatedAt)}${timeText}
        <span class="material-icons sub-date-edit">lock</span>
      </button>
    </span>`;
  }
  // คลิกเพื่อเปิดปฏิทินนัดหมายวันสัมภาษณ์
  return `
    <span class="sub-date-picker">
      <button type="button" class="sub-date" title="คลิกเพื่อนัดหมายวันสัมภาษณ์" aria-haspopup="dialog"
        onclick="openSubmissionDatePicker(${comp.id}, this)">
        <span class="material-icons">event</span>${formatSubmissionDate(updatedAt)}${timeText}
        <span class="material-icons sub-date-edit">edit_calendar</span>
      </button>
    </span>`;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// ---- ปฏิทินนัดหมายวันสัมภาษณ์ (popover) ----
// หมายเหตุ: รูปแบบ Onsite/Online และลิงก์/สถานที่ ยังเป็นแค่หน้าตา (ยังไม่มีคอลัมน์ในฐานข้อมูล)
// บันทึกจริงเฉพาะวันที่ + เวลา (เก็บใน submission.updatedAt)
const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const THAI_WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

let datePickerEl: HTMLElement | null = null;
let datePickerAnchor: HTMLElement | null = null;
let datePickerState: any = null;

function closeSubmissionDatePicker() {
  if (datePickerEl) datePickerEl.remove();
  if (datePickerAnchor) datePickerAnchor.setAttribute('aria-expanded', 'false');
  datePickerEl = null;
  datePickerAnchor = null;
  datePickerState = null;
}

function renderSubmissionDatePicker() {
  const el = datePickerEl;
  const st = datePickerState;
  if (!el || !st) return;
  const minYmd = toDateInputValue(null);
  const maxYmd = getMaxScheduleDate();
  const minMonth = minYmd.slice(0, 7);
  const maxMonth = maxYmd.slice(0, 7);
  const viewKey = `${st.viewYear}-${pad2(st.viewMonth + 1)}`;

  const first = new Date(st.viewYear, st.viewMonth, 1);
  const daysInMonth = new Date(st.viewYear, st.viewMonth + 1, 0).getDate();
  const rows = Math.ceil((first.getDay() + daysInMonth) / 7);
  let cells = '';
  for (let i = 0; i < rows * 7; i++) {
    const day = new Date(st.viewYear, st.viewMonth, 1 - first.getDay() + i);
    const ymd = toDateInputValue(day);
    const outside = day.getMonth() !== st.viewMonth;
    const disabled = ymd < minYmd || ymd > maxYmd;
    const cls = ['sub-cal-day'];
    if (outside) cls.push('is-outside');
    if (ymd === minYmd) cls.push('is-today');
    if (ymd === st.selected) cls.push('is-selected');
    cells += `<button type="button" class="${cls.join(' ')}" data-date="${ymd}"${disabled ? ' disabled' : ''}
      aria-label="${day.getDate()} ${THAI_MONTHS[day.getMonth()]} ${day.getFullYear() + 543}"
      aria-pressed="${ymd === st.selected}">${day.getDate()}</button>`;
  }

  el.innerHTML = `
    <div class="sub-cal-head">
      <span class="material-icons">event</span>
      <h4>นัดหมายวันสัมภาษณ์</h4>
    </div>
    <div class="sub-cal-nav">
      <button type="button" class="sub-cal-nav-btn" data-action="prev" aria-label="เดือนก่อนหน้า"${viewKey <= minMonth ? ' disabled' : ''}><span class="material-icons">chevron_left</span></button>
      <span class="sub-cal-month">${THAI_MONTHS[st.viewMonth]} ${st.viewYear + 543}</span>
      <button type="button" class="sub-cal-nav-btn" data-action="next" aria-label="เดือนถัดไป"${viewKey >= maxMonth ? ' disabled' : ''}><span class="material-icons">chevron_right</span></button>
    </div>
    <div class="sub-cal-grid">
      ${THAI_WEEKDAYS.map((w) => `<span class="sub-cal-weekday">${w}</span>`).join('')}
      ${cells}
    </div>
    <div class="sub-cal-divider"></div>
    <div class="sub-cal-row">
      <span class="sub-cal-label"><span class="material-icons">schedule</span> เวลาสัมภาษณ์:</span>
      <span class="sub-cal-time">
        <input type="text" inputmode="numeric" maxlength="2" class="sub-cal-time-input" data-field="hh" value="${st.hh}" aria-label="ชั่วโมง">
        <span>:</span>
        <input type="text" inputmode="numeric" maxlength="2" class="sub-cal-time-input" data-field="mm" value="${st.mm}" aria-label="นาที">
        <span class="sub-cal-time-unit">น.</span>
      </span>
    </div>
    <div class="sub-cal-row">
      <span class="sub-cal-label">รูปแบบการสัมภาษณ์:</span>
      <span class="sub-cal-toggle" role="group" aria-label="รูปแบบการสัมภาษณ์">
        <button type="button" data-mode="ONSITE" class="${st.mode === 'ONSITE' ? 'is-active' : ''}" aria-pressed="${st.mode === 'ONSITE'}">Onsite</button>
        <button type="button" data-mode="ONLINE" class="${st.mode === 'ONLINE' ? 'is-active' : ''}" aria-pressed="${st.mode === 'ONLINE'}">Online</button>
      </span>
    </div>
    <label class="sub-cal-field">
      <span class="sub-cal-field-label">${st.mode === 'ONLINE' ? 'ลิงก์การประชุม / สถานที่:' : 'สถานที่สัมภาษณ์:'}</span>
      <input type="text" class="sub-cal-location" data-field="location" value="${escapeStudentHtml(st.location)}"
        placeholder="${st.mode === 'ONLINE' ? 'Google Meet: meet.google.com/abc-defg-hij' : 'เช่น ชั้น 5 อาคาร A'}">
    </label>
    <p class="sub-cal-error" role="alert"></p>
    <div class="sub-cal-actions">
      <button type="button" class="sub-cal-cancel" data-action="cancel">ยกเลิก</button>
      <button type="button" class="sub-cal-save" data-action="save"${st.selected ? '' : ' disabled'}>บันทึก</button>
    </div>`;
  // ปฏิทินเปิดใต้ช่องวันที่เสมอ (สูงเกินจอ → จำกัดความสูงพอดีจอ + เลื่อนด้านใน)
  if (datePickerAnchor) positionSubmissionStatusMenu(el, datePickerAnchor, false);
}

window.openSubmissionDatePicker = function(companyId, btn) {
  const wasOpenHere = datePickerAnchor === btn;
  closeSubmissionDatePicker();
  closeSubmissionStatusMenu();
  if (wasOpenHere) return;

  const comp = (currentSubmissionsData || []).find((c) => c.id === companyId);
  const current = comp && comp.submission && comp.submission.updatedAt ? new Date(comp.submission.updatedAt) : null;
  const currentYmd = current && !isNaN(current.getTime()) ? toDateInputValue(current) : '';
  const inRange = currentYmd && currentYmd >= toDateInputValue(null) && currentYmd <= getMaxScheduleDate();
  const view = inRange ? current : new Date();

  datePickerState = {
    companyId,
    viewYear: view.getFullYear(),
    viewMonth: view.getMonth(),
    selected: inRange ? currentYmd : '',
    hh: inRange ? pad2(current.getHours()) : '10',
    mm: inRange ? pad2(current.getMinutes()) : '00',
    mode: 'ONLINE',
    location: '',
  };

  const el = document.createElement('div');
  el.className = 'sub-cal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'นัดหมายวันสัมภาษณ์');

  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const st = datePickerState;
    if (!st) return;
    const dayBtn = t.closest('.sub-cal-day') as HTMLButtonElement | null;
    const modeBtn = t.closest('[data-mode]') as HTMLElement | null;
    const actionBtn = t.closest('[data-action]') as HTMLButtonElement | null;
    if (dayBtn && !dayBtn.disabled) {
      st.selected = dayBtn.dataset.date;
      const picked = new Date(`${st.selected}T00:00:00`);
      st.viewYear = picked.getFullYear();
      st.viewMonth = picked.getMonth();
      renderSubmissionDatePicker();
    } else if (modeBtn) {
      st.mode = modeBtn.dataset.mode;
      renderSubmissionDatePicker();
    } else if (actionBtn && !actionBtn.disabled) {
      const action = actionBtn.dataset.action;
      if (action === 'prev' || action === 'next') {
        const m = new Date(st.viewYear, st.viewMonth + (action === 'prev' ? -1 : 1), 1);
        st.viewYear = m.getFullYear();
        st.viewMonth = m.getMonth();
        renderSubmissionDatePicker();
      } else if (action === 'cancel') {
        const anchor = datePickerAnchor;
        closeSubmissionDatePicker();
        anchor?.focus();
      } else if (action === 'save') {
        const hh = Number(st.hh);
        const mm = Number(st.mm);
        const errEl = el.querySelector('.sub-cal-error');
        if (!/^\d{1,2}$/.test(st.hh) || !/^\d{1,2}$/.test(st.mm) || hh > 23 || mm > 59) {
          if (errEl) errEl.textContent = 'กรุณากรอกเวลาให้ถูกต้อง (00:00 - 23:59)';
          return;
        }
        const anchor = datePickerAnchor;
        const wrap = anchor && anchor.closest('.sub-date-picker');
        if (wrap) wrap.classList.add('is-saving');
        const { companyId: id, selected } = st;
        closeSubmissionDatePicker();
        window.updateSubmissionStatus(id, undefined, selected, `${pad2(hh)}:${pad2(mm)}`);
      }
    }
  });

  el.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    const st = datePickerState;
    if (!st || !t.dataset.field) return;
    if (t.dataset.field === 'hh' || t.dataset.field === 'mm') {
      t.value = t.value.replace(/\D/g, '').slice(0, 2);
    }
    st[t.dataset.field] = t.value;
  });

  el.addEventListener('focusout', (e) => {
    const t = e.target as HTMLInputElement;
    const st = datePickerState;
    if (st && (t.dataset.field === 'hh' || t.dataset.field === 'mm') && t.value) {
      t.value = pad2(t.value);
      st[t.dataset.field] = t.value;
    }
  });

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      const anchor = datePickerAnchor;
      closeSubmissionDatePicker();
      anchor?.focus();
    }
  });

  btn.parentElement.appendChild(el);
  datePickerEl = el;
  datePickerAnchor = btn;
  btn.setAttribute('aria-expanded', 'true');
  renderSubmissionDatePicker();
  (el.querySelector('.is-selected, .sub-cal-day:not([disabled])') as HTMLElement | null)?.focus({ preventScroll: true });
};

document.addEventListener('mousedown', (e) => {
  if (!datePickerEl) return;
  const t = e.target as Node;
  if (datePickerEl.contains(t) || (datePickerAnchor && datePickerAnchor.contains(t))) return;
  closeSubmissionDatePicker();
});
window.addEventListener('resize', closeSubmissionDatePicker);
window.addEventListener('scroll', (e) => {
  if (datePickerEl && !datePickerEl.contains(e.target as Node)) closeSubmissionDatePicker();
}, true);

// การ์ด "สัมภาษณ์ครั้งถัดไป": วันที่ตั้งจากปฏิทินที่ใกล้ที่สุดตั้งแต่วันนี้ (ทุกสถานะยกเว้น "ยังไม่ได้ยื่น")
// (วัน/เวลานัดเก็บใน submission.updatedAt) + นับวันถอยหลัง
function renderNextInterviewStat(companies) {
  const dateEl = document.getElementById('sub-stat-next-date');
  const timeEl = document.getElementById('sub-stat-next-time');
  const badgeEl = document.getElementById('sub-stat-next-badge');
  if (!dateEl || !timeEl || !badgeEl) return;

  const todayYmd = toDateInputValue(null);
  const next = companies
    .filter((c) => getSubmissionStatus(c) !== 'NOT_SUBMITTED' && c.submission && c.submission.updatedAt)
    .map((c) => new Date(c.submission.updatedAt))
    .filter((d) => !isNaN(d.getTime()) && toDateInputValue(d) >= todayYmd)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  if (!next) {
    dateEl.textContent = '—';
    timeEl.textContent = 'ยังไม่มีนัด';
    badgeEl.hidden = true;
    return;
  }
  dateEl.textContent = formatSubmissionDate(next);
  timeEl.textContent = `${pad2(next.getHours())}:${pad2(next.getMinutes())} น.`;
  const today = new Date();
  const days = Math.round(
    (new Date(next.getFullYear(), next.getMonth(), next.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000
  );
  badgeEl.textContent = days === 0 ? 'วันนี้' : days === 1 ? 'พรุ่งนี้' : `อีก ${days} วัน`;
  badgeEl.hidden = false;
}

// แสดงตาราง "รายการที่ยื่นสมัคร" + "ประวัติที่สัมภาษณ์ไม่ผ่าน" + การ์ดสรุป จากข้อมูลในแคช
function renderSubmissionTables() {
  const tbody = document.getElementById('submissions-table-body');
  if (!tbody) return;
  const companies = currentSubmissionsData || [];
  const active = companies.filter((c) => getSubmissionStatus(c) !== 'INTERVIEW_FAILED_REAPPLIED');
  const failed = companies.filter((c) => getSubmissionStatus(c) === 'INTERVIEW_FAILED_REAPPLIED');

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  const count = (status) => companies.filter((c) => getSubmissionStatus(c) === status).length;
  setText('sub-stat-total', String(companies.filter((c) => getSubmissionStatus(c) !== 'NOT_SUBMITTED').length));
  setText('sub-stat-failed', String(count('INTERVIEW_FAILED_REAPPLIED')));
  setText('sub-stat-passed', String(count('INTERVIEW_PASSED')));
  renderNextInterviewStat(companies);
  setText('sub-count-text', `แสดงผล ${active.length} จากทั้งหมด ${companies.length} รายการ`);

  if (active.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="sub-empty">${companies.length === 0
      ? 'ยังไม่มีบริษัทที่ผ่านการอนุมัติ Checklist (จะแสดงรายชื่อเมื่ออาจารย์ตรวจให้ผ่าน)'
      : 'ไม่มีบริษัทที่กำลังดำเนินการ'}</td></tr>`;
  } else {
    const note = renderStudentAcceptanceCell();
    // การ์ดเอกสารราชการเป็นข้อมูลระดับนิสิต (ไม่ใช่ต่อบริษัท) → ผูก dropdown ไว้กับแถวบริษัทที่ออกหนังสือ (ไม่พบให้ใช้แถวแรก)
    const accCompany = String(currentAcceptanceData?.companyName || '').trim();
    const matchIdx = accCompany ? active.findIndex((c) => String(c.name || '').trim() === accCompany) : -1;
    const toggleIdx = matchIdx >= 0 ? matchIdx : 0;
    tbody.innerHTML = active.map((comp, idx) => {
      const hasToggle = idx === toggleIdx;
      const rowClass = [
        getSubmissionStatus(comp) === 'SUBMITTED_WAITING' ? 'sub-row--highlight' : '',
        hasToggle && acceptanceCardExpanded ? 'sub-row--expanded' : '',
      ].filter(Boolean).join(' ');
      return `
      <tr class="${rowClass}">
        <td class="sub-col-no">${idx + 1}</td>
        <td>${renderSubmissionCompanyCell(comp)}</td>
        <td>${renderSubmissionStatusPill(comp)}</td>
        <td>${renderSubmissionDateCell(comp)}</td>
        <td>${note}</td>
        <td class="sub-col-toggle">${hasToggle ? `
          <button type="button" class="sub-expand-btn" id="student-acceptance-toggle" onclick="toggleStudentAcceptanceCard()"
            aria-expanded="${acceptanceCardExpanded}" aria-controls="student-acceptance-expand-row"
            title="${acceptanceCardExpanded ? 'ซ่อนเอกสารราชการ' : 'ดูเอกสารราชการและอัปโหลดใบตอบรับ'}">
            <span class="material-icons">expand_more</span>
          </button>` : ''}</td>
      </tr>${hasToggle ? `
      <tr class="sub-expand-row" id="student-acceptance-expand-row"${acceptanceCardExpanded ? '' : ' hidden'}>
        <td colspan="6"><div id="student-acceptance-upload-box"></div></td>
      </tr>` : ''}`;
    }).join('');
  }
  // tbody ถูก render ใหม่ → วาดการ์ดเอกสารราชการลงในแถวที่กางออกอีกครั้ง
  renderStudentAcceptanceCard();

  const failedPanel = document.getElementById('sub-failed-panel');
  const failedBody = document.getElementById('sub-failed-body');
  if (failedPanel && failedBody) {
    failedPanel.style.display = failed.length > 0 ? '' : 'none';
    setText('sub-failed-count', `${failed.length} รายการ`);
    failedBody.innerHTML = failed.map((comp, idx) => `
      <tr>
        <td class="sub-col-no">${idx + 1}</td>
        <td>${renderSubmissionCompanyCell(comp)}</td>
        <td>${renderSubmissionStatusPill(comp)}</td>
        <td>${renderSubmissionDateCell(comp)}</td>
        <td class="sub-col-action"><button type="button" class="sub-link-btn" onclick="goToChecklistTab()">ยื่นเพิ่ม <span class="material-icons">chevron_right</span></button></td>
      </tr>`).join('');
  }
}

window.onSubmissionStatusChange = function(companyId, value, pill) {
  if (pill) {
    pill.className = `sub-status sub-status--${getSubmissionTone(value)} is-saving`;
    const opt = SUBMISSION_STATUS_OPTIONS.find((o) => o.value === value);
    const label = pill.querySelector('.sub-status-label');
    if (label && opt) label.textContent = opt.label;
  }
  window.updateSubmissionStatus(companyId, value);
};

// ไปแท็บ Checklist บริษัท เพื่อเพิ่มบริษัทใหม่
window.goToChecklistTab = function() {
  const btn = document.querySelector('.status-nav-item[data-tab="checklist"]') as HTMLElement | null;
  if (btn) btn.click();
};

// helper กลาง: src/client/components/text_utils.ts (โหลดก่อนใน StatusAllPage)
function escapeStudentHtml(str) {
  return window.IctText.escapeHtml(str);
}

// หมายเหตุ (สถานะหนังสือขอความอนุเคราะห์ / ใบตอบรับ) แสดงเป็น callout สี
function renderStudentAcceptanceCell() {
  const acc = currentAcceptanceData;
  const callout = (tone, icon, text, extra = '') =>
    `<div class="sub-note sub-note--${tone}"><span class="material-icons">${icon}</span><span>${text}${extra}</span></div>`;

  if (!acc || !acc.requestLetterIssued) {
    return callout('amber', 'warning_amber', 'รอเจ้าหน้าที่ออกหนังสือขอความอนุเคราะห์');
  }
  if (acc.status === 'ACCEPTED') {
    return callout('green', 'check_circle', 'เจ้าหน้าที่ยืนยัน: บริษัทตอบรับแล้ว');
  }
  if (acc.status === 'REJECTED') {
    return callout('red', 'cancel', 'บริษัทปฏิเสธ (ปลดล็อกให้ยื่นใหม่แล้ว)');
  }
  if (acc.fileUrl || acc.submittedByStudent) {
    const link = acc.fileUrl
      ? ` <a href="${escapeStudentHtml(acc.fileUrl)}" target="_blank" rel="noopener" class="sub-note-link">ดูไฟล์</a>`
      : '';
    return callout('sky', 'info', 'อัปโหลดใบตอบรับแล้ว (รอเจ้าหน้าที่ยืนยัน)', link);
  }
  return callout('sky', 'description', `ออกหนังสือแล้ว (${escapeStudentHtml(acc.requestLetterDocNo || '-')})`);
}

function renderStudentAcceptanceCard() {
  const section = document.getElementById('submission-section');
  if (!section) return;
  const body = section.querySelector('.card-body');
  if (!body) return;

  // ปกติการ์ดอยู่ในแถว dropdown ใต้แถวบริษัท (สร้างโดย renderSubmissionTables)
  // ถ้าตารางไม่มีแถวบริษัท → แสดงการ์ดต่อท้าย card-body แบบเดิม
  const fallbackId = 'student-acceptance-upload-box-fallback';
  const inRow = document.querySelector('#student-acceptance-expand-row #student-acceptance-upload-box');
  let container = inRow as HTMLElement | null;
  if (container) {
    document.getElementById(fallbackId)?.remove();
  } else {
    container = document.getElementById(fallbackId);
    if (!container) {
      container = document.createElement('div');
      container.id = fallbackId;
      container.style.marginTop = '16px';
      body.appendChild(container);
    }
  }

  const acc = currentAcceptanceData;
  // หนังสือฉบับก่อนหน้า (เช่น บริษัทเดิมที่ปฏิเสธ / รอบที่ 1) — รายชื่อตามที่ออกจริง ดาวน์โหลดย้อนหลังได้
  const pastLetters = Array.isArray(acc?.pastLetters) ? acc.pastLetters : [];
  const pastLettersHtml = pastLetters.length === 0 ? '' : `
    <div class="acc-past">
      <div class="acc-past-title"><span class="material-icons">history</span>หนังสือฉบับก่อนหน้า</div>
      ${pastLetters.map(b => `
        <div class="acc-past-row">
          <span>${b.type === 'DISPATCH' ? 'หนังสือส่งตัว' : 'หนังสือขอความอนุเคราะห์'} · ${escapeStudentHtml(b.companyName || '-')} · เลขที่ ${escapeStudentHtml(b.docNo || '-')}</span>
          <button type="button" class="acc-btn-outline acc-btn-outline--sm" onclick="downloadStudentOfficialLetter('${b.type}', '${escapeStudentHtml(b.batchId)}')">
            <span class="material-icons">download</span>ดาวน์โหลด
          </button>
        </div>
      `).join('')}
    </div>
  `;

  // ---- สถานะแต่ละขั้น (derive จากข้อมูลจริง) ----
  // ไม่มีข้อมูลการกดดาวน์โหลด → ถือว่าขั้น 1–2 เสร็จเมื่อคณะออกหนังสือแล้ว
  const issued = Boolean(acc && acc.requestLetterIssued);
  const status = acc?.status || 'NOT_SENT';
  const isFinalized = status === 'ACCEPTED';
  const hasFile = Boolean(acc?.fileUrl);
  const step3Done = hasFile && status !== 'REJECTED';
  const stepStates = [
    issued ? 'done' : 'current',
    issued ? 'done' : 'pending',
    !issued ? 'pending' : step3Done ? 'done' : 'current',
  ];
  const currentStep = issued ? 3 : 1;

  const circle = (n, state) => state === 'done'
    ? `<span class="acc-step-circle acc-step-circle--done"><span class="material-icons">check</span></span>`
    : `<span class="acc-step-circle acc-step-circle--${state}">${n}</span>`;
  const stepLabel = (n, state) =>
    `<span class="acc-step-label acc-step-label--${state}">ขั้นตอนที่ ${n}${state === 'current' ? ' · ปัจจุบัน' : ''}</span>`;
  const link = (prevState) =>
    `<span class="acc-step-link${prevState === 'done' ? ' acc-step-link--done' : ''}" aria-hidden="true"></span>`;

  // ---- Info strip ----
  const infoStrip = issued
    ? `<div class="acc-info acc-info--ready">
        <span class="material-icons acc-info-icon">description</span>
        <span class="acc-info-text">คณะออกหนังสือขอความอนุเคราะห์แล้ว</span>
        <span class="acc-docno">${escapeStudentHtml(acc.requestLetterDocNo || '-')}</span>
        <span class="acc-info-right">
          <span class="acc-chip acc-chip--green"><span class="material-icons">check_circle</span>พร้อมดาวน์โหลด</span>
        </span>
      </div>`
    : `<div class="acc-info acc-info--waiting">
        <span class="material-icons acc-info-icon">hourglass_empty</span>
        <span class="acc-info-text">รอเจ้าหน้าที่คณะออกหนังสือขอความอนุเคราะห์</span>
        <span class="acc-info-right">
          <span class="acc-chip acc-chip--amber"><span class="material-icons">schedule</span>รอดำเนินการ</span>
        </span>
      </div>`;

  // ---- การ์ด 3 ขั้น ----
  // ปุ่มดาวน์โหลดหนังสือส่งตัว (แสดงในขั้นตอนที่ 3 เมื่อคณะออกหนังสือแล้ว)
  const dispatchBtn = acc?.dispatchLetterIssued // acc อาจเป็น null (โหลดข้อมูลใบตอบรับไม่สำเร็จ)
    ? `<button type="button" class="acc-btn-outline acc-dispatch-btn" onclick="downloadStudentOfficialLetter('DISPATCH')">
        <span class="material-icons">download</span><span>หนังสือส่งตัว <span class="acc-dispatch-docno">(${escapeStudentHtml(acc.dispatchLetterDocNo || '-')})</span></span>
      </button>`
    : '';
  const uploadArea = isFinalized
    ? `<div class="acc-finalized"><span class="material-icons">verified</span>เจ้าหน้าที่ยืนยันผลแล้ว ไม่สามารถเปลี่ยนไฟล์ได้</div>`
    : `
      <input type="file" id="student-acceptance-file-input" accept=".pdf,image/jpeg,image/png,image/webp" style="display:none;" onchange="studentAcceptancePickFile(this)" />
      <div class="acc-dropzone${issued ? '' : ' acc-dropzone--disabled'}" id="student-acceptance-dropzone"
        ${issued ? `onclick="if (event.target.tagName !== 'BUTTON') document.getElementById('student-acceptance-file-input').click()"
        ondragover="studentAcceptanceDragOver(event)" ondragleave="studentAcceptanceDragLeave(event)" ondrop="studentAcceptanceDrop(event)"` : ''}>
        <span class="acc-dropzone-icon"><span class="material-icons">cloud_upload</span></span>
        <span class="acc-dropzone-text">${!issued
          ? 'อัปโหลดได้หลังคณะออกหนังสือ'
          : step3Done
          ? 'อัปโหลดใบตอบรับแล้ว' /* มีไฟล์แล้ว ยังไม่ยืนยัน (ยืนยันแล้วจะเป็น acc-finalized แทน) */
          : 'ลากไฟล์มาวางที่นี่ หรือ'}</span>
        <button type="button" id="student-acceptance-upload-btn" class="acc-btn-primary" ${issued ? '' : 'disabled'}
          onclick="document.getElementById('student-acceptance-file-input').click()">เลือกไฟล์</button>
      </div>
      <div class="acc-dropzone-error" id="student-acceptance-error" role="alert" style="display:none;"></div>
      <div class="acc-dropzone-help">PDF, JPG, PNG • ไม่เกิน 10MB</div>
    `;

  const stepsHtml = `
    <div class="acc-steps">
      <div class="acc-step acc-step--${stepStates[0]}">
        <div class="acc-step-head">${circle(1, stepStates[0])}${stepLabel(1, stepStates[0])}</div>
        <div class="acc-step-main">
          <span class="acc-step-icon acc-step-icon--indigo"><span class="material-icons">article</span></span>
          <div>
            <div class="acc-step-title">หนังสือขอความอนุเคราะห์</div>
            <div class="acc-step-caption">PDF • ${issued ? 'ลงนามโดยคณะเรียบร้อยแล้ว' : 'รอคณะออกหนังสือ'}</div>
          </div>
        </div>
        <button type="button" class="acc-btn-outline" ${issued ? '' : 'disabled'} onclick="downloadStudentOfficialLetter('REQUEST')">
          <span class="material-icons">download</span>ดาวน์โหลด PDF
        </button>
      </div>
      <div class="acc-step acc-step--${stepStates[1]}">
        ${link(stepStates[0])}
        <div class="acc-step-head">${circle(2, stepStates[1])}${stepLabel(2, stepStates[1])}</div>
        <div class="acc-step-main">
          <span class="acc-step-icon acc-step-icon--emerald"><span class="material-icons">edit_note</span></span>
          <div>
            <div class="acc-step-title">แบบตอบรับเปล่า</div>
            <div class="acc-step-caption">ให้บริษัทกรอกรายละเอียดและลงนาม</div>
          </div>
        </div>
        <a class="acc-btn-outline" href="/documents/acceptance_form_se.pdf" download="แบบตอบรับนิสิตฝึกงาน_SE.pdf" target="_blank" rel="noopener">
          <span class="material-icons">download</span>ดาวน์โหลด PDF
        </a>
      </div>
      <div class="acc-step acc-step--${stepStates[2]}">
        ${link(stepStates[1])}
        <div class="acc-step-head">${circle(3, stepStates[2])}${stepLabel(3, stepStates[2])}</div>
        <div class="acc-step-title acc-step-title--solo">อัปโหลดใบตอบรับจากบริษัท</div>
        ${uploadArea}
        ${dispatchBtn}
      </div>
    </div>
  `;

  // ---- เอกสารที่อัปโหลดแล้ว ----
  const reviewStatus = status === 'ACCEPTED'
    ? { tone: 'green', text: `เจ้าหน้าที่ยืนยัน: บริษัทตอบรับแล้ว ${acc.dispatchLetterIssued ? `(ออกหนังสือส่งตัวเลขที่ ${escapeStudentHtml(acc.dispatchLetterDocNo || '-')} แล้ว)` : '(รอออกหนังสือส่งตัว)'}` }
    : status === 'ADVISOR_APPROVED'
    ? { tone: 'blue', text: 'อาจารย์ที่ปรึกษาอนุมัติแล้ว • รอเจ้าหน้าที่คณะยืนยันผล' }
    : status === 'REJECTED'
    ? { tone: 'red', text: `บริษัทปฏิเสธ (${escapeStudentHtml(acc.note || '-')}) • อัปโหลดใบตอบรับใหม่ได้เมื่อได้รับหนังสือฉบับใหม่` }
    : status === 'WAITING_ADVISOR_APPROVAL'
    ? { tone: 'amber', text: `รออาจารย์ตรวจสอบ (${escapeStudentHtml(acc.advisorName || 'ที่ปรึกษา')})` }
    : { tone: 'amber', text: 'กำลังส่งให้อาจารย์ที่ปรึกษาตรวจสอบ' };
  const fileName = acc?.fileName || 'ใบตอบรับ';
  const isPdf = /\.pdf$/i.test(fileName);
  // หมายเหตุ: API ยังไม่ส่งขนาดไฟล์ และยังไม่มี endpoint ลบไฟล์ → ไม่แสดงขนาด/ปุ่มลบ
  const uploadedHtml = !hasFile ? '' : `
    <div class="acc-uploaded">
      <div class="acc-uploaded-head">
        <span class="acc-uploaded-title"><span class="material-icons">task_alt</span>เอกสารที่อัปโหลดแล้ว</span>
        ${acc.uploadedAt ? `<span class="acc-uploaded-time">อัปเดตล่าสุด: ${formatThaiDateTime(acc.uploadedAt)}</span>` : ''}
      </div>
      <div class="acc-file">
        <span class="acc-file-icon acc-file-icon--${isPdf ? 'pdf' : 'img'}"><span class="material-icons">${isPdf ? 'picture_as_pdf' : 'image'}</span></span>
        <div class="acc-file-info">
          <div class="acc-file-name-row">
            <span class="acc-file-name" title="${escapeStudentHtml(fileName)}">${escapeStudentHtml(fileName)}</span>
            <span class="acc-chip acc-chip--green"><span class="material-icons">check</span>อัปโหลดแล้ว</span>
          </div>
          <div class="acc-file-meta"><span class="acc-dot acc-dot--${reviewStatus.tone}"></span>${reviewStatus.text}</div>
        </div>
        <div class="acc-file-actions">
          <a class="acc-icon-btn" href="${escapeStudentHtml(acc.fileUrl)}" target="_blank" rel="noopener" title="ดูไฟล์" aria-label="ดูไฟล์"><span class="material-icons">visibility</span></a>
          ${!isFinalized ? `<button type="button" class="acc-icon-btn" title="เปลี่ยนไฟล์" aria-label="เปลี่ยนไฟล์" onclick="document.getElementById('student-acceptance-file-input').click()"><span class="material-icons">sync</span></button>` : ''}
        </div>
      </div>
    </div>
  `;

  container.innerHTML = `
    <div class="acc-card">
      <div class="acc-header">
        <div class="acc-header-text">
          <div class="acc-title">เอกสารราชการ &amp; อัปโหลดแบบตอบรับ/ปฏิเสธ การรับนิสิตฝึกงาน</div>
          <div class="acc-subtitle">ดาวน์โหลดหนังสือขอความอนุเคราะห์และแบบตอบรับเปล่าไปยื่นสถานประกอบการ และอัปโหลดใบตอบรับที่บริษัทกรอกกลับมา (PDF, JPG, PNG ไม่เกิน 10MB)</div>
        </div>
        <span class="acc-step-pill"><span class="acc-step-pill-dot"></span>ขั้นตอนที่ ${currentStep} จาก 3</span>
      </div>
      ${infoStrip}
      ${stepsHtml}
      ${uploadedHtml}
      ${pastLettersHtml}
    </div>
  `;
}

// เปิด/ปิด dropdown การ์ดเอกสารราชการใต้แถวบริษัท (ไม่ render ตารางใหม่)
window.toggleStudentAcceptanceCard = function() {
  acceptanceCardExpanded = !acceptanceCardExpanded;
  const row = document.getElementById('student-acceptance-expand-row');
  const btn = document.getElementById('student-acceptance-toggle');
  if (row) row.hidden = !acceptanceCardExpanded;
  if (btn) {
    btn.setAttribute('aria-expanded', String(acceptanceCardExpanded));
    btn.title = acceptanceCardExpanded ? 'ซ่อนเอกสารราชการ' : 'ดูเอกสารราชการและอัปโหลดใบตอบรับ';
    btn.closest('tr')?.classList.toggle('sub-row--expanded', acceptanceCardExpanded);
  }
};

// ตรวจไฟล์ฝั่ง client ให้ตรงกับกติกาเดิมของ server (multer: .pdf/.jpg/.jpeg/.png/.webp, ไม่เกิน 10MB)
function validateStudentAcceptanceFile(file) {
  const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
  const name = String(file?.name || '').toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  if (!allowedExts.includes(ext)) return 'รองรับเฉพาะไฟล์ PDF หรือรูปภาพ (JPG, PNG, WebP) เท่านั้น';
  if (file.size > 10 * 1024 * 1024) return 'ไฟล์มีขนาดเกิน 10MB กรุณาเลือกไฟล์ที่เล็กลง';
  return '';
}

function showStudentAcceptanceError(message) {
  const el = document.getElementById('student-acceptance-error');
  const zone = document.getElementById('student-acceptance-dropzone');
  if (zone) zone.classList.toggle('acc-dropzone--error', Boolean(message));
  if (!el) return;
  el.innerHTML = message ? `<span class="material-icons">error_outline</span>${escapeStudentHtml(message)}` : '';
  el.style.display = message ? 'flex' : 'none';
}

window.studentAcceptancePickFile = function(inputEl) {
  const file = inputEl?.files?.[0];
  if (!file) return;
  const error = validateStudentAcceptanceFile(file);
  if (error) {
    showStudentAcceptanceError(error);
    inputEl.value = '';
    return;
  }
  showStudentAcceptanceError('');
  return window.uploadStudentAcceptanceForm(inputEl);
};

window.studentAcceptanceDragOver = function(e) {
  e.preventDefault();
  e.currentTarget.classList.add('acc-dropzone--over');
};

window.studentAcceptanceDragLeave = function(e) {
  if (e.currentTarget.contains(e.relatedTarget)) return;
  e.currentTarget.classList.remove('acc-dropzone--over');
};

window.studentAcceptanceDrop = function(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('acc-dropzone--over');
  const files = e.dataTransfer?.files;
  const input = document.getElementById('student-acceptance-file-input');
  if (!files || files.length === 0 || !input) return;
  const dt = new DataTransfer();
  dt.items.add(files[0]);
  input.files = dt.files;
  window.studentAcceptancePickFile(input);
};

// batchId: ดาวน์โหลด "ฉบับก่อนหน้า" (เช่น หนังสือของบริษัทเดิมที่ปฏิเสธ) จากรายชื่อ ณ วันที่ออก
window.downloadStudentOfficialLetter = function(type, batchId) {
  const acc = currentAcceptanceData;
  const past = batchId ? (acc?.pastLetters || []).find(b => b.batchId === batchId) : null;
  if (batchId && past) {
    type = past.type;
  } else if (!acc || !acc.requestLetterIssued) {
    alert('ยังไม่มีการออกหนังสือขอความอนุเคราะห์จากเจ้าหน้าที่คณะ');
    return;
  }

  // หนังสือส่งตัวใช้รายชื่อของฉบับส่งตัว (นิสิตที่บริษัทตอบรับ) ไม่ใช่รายชื่อของหนังสือขอความอนุเคราะห์
  const listFromServer = past
    ? past.students
    : type === 'DISPATCH' && Array.isArray(acc.dispatchLetterStudents) && acc.dispatchLetterStudents.length > 0
    ? acc.dispatchLetterStudents
    : acc.letterStudents;
  const students = Array.isArray(listFromServer) && listFromServer.length > 0
    ? listFromServer
    : [{
        studentCode: document.getElementById('prof-studentCode')?.value || '-',
        nameTh: document.getElementById('prof-nameTh')?.value || '-',
        major: document.getElementById('prof-major')?.dataset.value || document.getElementById('prof-major')?.value || 'วิศวกรรมซอฟต์แวร์',
        position: document.getElementById('plc-position')?.value || 'นิสิตฝึกงาน',
        phone: document.getElementById('prof-phone')?.value || '-',
      }];

  const first = students[0];
  const cfg = acc.academicConfig || {};
  const docNo = past
    ? past.docNo
    : type === 'DISPATCH'
    ? (acc.dispatchLetterDocNo || 'อว 7316/ว 0512')
    : (acc.requestLetterDocNo || 'อว 7316/ว 0142');
  const rawDate = past ? past.letterDate : type === 'DISPATCH' ? acc.dispatchLetterDate : acc.requestLetterDate;
  const dateObj = rawDate ? new Date(rawDate) : new Date();
  const thaiDate = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const signatureDataUrl = past
    ? (past.signatureSnapshot || '')
    : type === 'DISPATCH'
    ? (acc.dispatchLetterSignatureSnapshot || '')
    : (acc.requestLetterSignatureSnapshot || '');
  const targetCompName = past?.companyName || acc.companyName || (currentSubmissionsData[0]?.name) || 'สถานประกอบการ';
  const rawCompAddress = past
    ? ((past.students || []).find(s => s.companyAddress && s.companyAddress !== '-')?.companyAddress || '')
    : acc.companyAddress;
  const targetCompAddress = rawCompAddress && rawCompAddress !== '-' ? rawCompAddress : '';
  const targetMajor = first.major || 'วิศวกรรมซอฟต์แวร์';
  const subjectText = type === 'DISPATCH'
    ? 'ขอส่งตัวนิสิตเข้าฝึกงานวิชาชีพ / สหกิจศึกษา'
    : 'ขอความอนุเคราะห์รับนิสิตเข้าฝึกงานวิชาชีพ / สหกิจศึกษา และนัดหมายสัมภาษณ์';

  const studentRowsHtml = students.map((s, idx) => `
    <tr>
      <td style="border:1px solid #334155; padding:6px 10px; text-align:center;">${idx + 1}</td>
      <td style="border:1px solid #334155; padding:6px 10px; text-align:center;">${escapeStudentHtml(s.studentCode)}</td>
      <td style="border:1px solid #334155; padding:6px 10px;">${escapeStudentHtml(s.nameTh)}</td>
      <td style="border:1px solid #334155; padding:6px 10px;">วท.บ. (${escapeStudentHtml(s.major || targetMajor)})</td>
      <td style="border:1px solid #334155; padding:6px 10px;">${escapeStudentHtml(s.position || 'นิสิตฝึกงาน')}</td>
      <td style="border:1px solid #334155; padding:6px 10px; text-align:center;">${escapeStudentHtml(s.phone || '-')}</td>
    </tr>
  `).join('');

  const win = window.open('', '_blank', 'width=920,height=800');
  if (!win) {
    alert('กรุณาอนุญาตให้เปิดหน้าต่างป๊อปอัป (Pop-up) เพื่อดาวน์โหลด/พิมพ์เอกสาร PDF');
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html lang="th">
      <head>
        <meta charset="utf-8" />
        <title>${type === 'DISPATCH' ? 'หนังสือส่งตัวนิสิตเข้าฝึกงาน' : 'หนังสือขอความอนุเคราะห์ฝึกงาน'} (${escapeStudentHtml(docNo)})</title>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap" rel="stylesheet" />
        <style>
          body { font-family: 'Sarabun', sans-serif; padding: 24px 36px; color: #0F172A; line-height: 1.65; background: #F1F5F9; margin: 0; }
          .print-toolbar {
            max-width: 760px; margin: 0 auto 16px auto; background: #1E293B; color: white;
            padding: 10px 18px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center;
          }
          .print-sheet {
            max-width: 720px; margin: 0 auto; background: white; padding: 32px 40px;
            border-radius: 10px; box-shadow: 0 4px 20px rgba(15,23,42,0.08);
          }
          @media print {
            body { padding: 0; background: white; }
            .print-toolbar { display: none !important; }
            .print-sheet { box-shadow: none; padding: 0; max-width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="print-toolbar">
          <div style="font-size:13.5px; font-weight:700;">
            📄 ${type === 'DISPATCH' ? 'หนังสือส่งตัวนิสิตเข้าฝึกงาน' : 'หนังสือขอความอนุเคราะห์ฝึกงาน'} — เลขที่ ${escapeStudentHtml(docNo)}
          </div>
          <button onclick="window.print()" style="background:#2563EB; color:white; border:none; padding:7px 16px; border-radius:8px; font-family:inherit; font-size:13px; font-weight:700; cursor:pointer;">
            🖨️ พิมพ์ / บันทึกเป็น PDF (Save as PDF)
          </button>
        </div>
        <div class="print-sheet" style="font-size:14px; color:#0F172A;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
            <div><div style="font-weight:700;">ที่ ${escapeStudentHtml(docNo)}</div></div>
            <div style="text-align:center;">
              <div style="font-size:17px; font-weight:800; color:#1E1B4B;">คณะเทคโนโลยีสารสนเทศและการสื่อสาร</div>
              <div style="font-size:14px; font-weight:700;">มหาวิทยาลัยพะเยา จ.พะเยา 56000</div>
            </div>
            <div style="text-align:right;"><div>วันที่ ${escapeStudentHtml(thaiDate)}</div></div>
          </div>

          <div style="margin-bottom:10px;"><strong>เรื่อง</strong> &nbsp;&nbsp;${subjectText}</div>
          <div style="margin-bottom:10px;"><strong>เรียน</strong> &nbsp;&nbsp;ผู้จัดการฝ่ายทรัพยากรบุคคล / ผู้บริหาร <strong>${escapeStudentHtml(targetCompName)}</strong></div>
          ${type === 'REQUEST' ? `<div style="margin-bottom:14px;"><strong>สิ่งที่ส่งมาด้วย</strong> &nbsp;&nbsp;1. แบบตอบรับ/ปฏิเสธ การรับนิสิตฝึกงาน และประวัติย่อ (CV) จำนวน ${students.length} ชุด</div>` : ''}

          <p style="text-indent:40px; margin-bottom:12px; text-align:justify;">
            ด้วย คณะเทคโนโลยีสารสนเทศและการสื่อสาร มหาวิทยาลัยพะเยา ได้กำหนดให้นิสิตระดับปริญญาตรี ชั้นปีที่ 3-4 เข้ารับการฝึกงานวิชาชีพและสหกิจศึกษาในสถานประกอบการ เพื่อให้นิสิตได้เพิ่มพูนทักษะและประสบการณ์การทำงานจริงในสายวิชาชีพเทคโนโลยีสารสนเทศ พิจารณาแล้วเห็นว่าหน่วยงานของท่านมีความเหมาะสมและมีมาตรฐานทางวิชาชีพเป็นอย่างดียิ่ง
          </p>

          <p style="text-indent:40px; margin-bottom:14px;">
            ในการนี้ คณะเทคโนโลยีสารสนเทศและการสื่อสาร จึงใคร่<strong>${type === 'DISPATCH' ? 'ขอส่งตัวนิสิตเข้าปฏิบัติงานสหกิจศึกษา/ฝึกงาน' : 'ขอความอนุเคราะห์รับนิสิตเข้าฝึกงานวิชาชีพ/สหกิจศึกษา'}</strong> ประจำปีการศึกษา ${escapeStudentHtml(cfg.currentAcademicYear || '2568')} จำนวน ${students.length} คน ดังรายชื่อต่อไปนี้:
          </p>

          <table style="width:100%; border-collapse:collapse; margin-bottom:18px; font-size:13px;">
            <thead>
              <tr style="background:#F1F5F9;">
                <th style="border:1px solid #334155; padding:6px 10px;">ลำดับ</th>
                <th style="border:1px solid #334155; padding:6px 10px;">รหัสนิสิต</th>
                <th style="border:1px solid #334155; padding:6px 10px;">ชื่อ - นามสกุล</th>
                <th style="border:1px solid #334155; padding:6px 10px;">หลักสูตร/สาขาวิชา</th>
                <th style="border:1px solid #334155; padding:6px 10px;">ตำแหน่งที่ยื่นฝึกงาน</th>
                <th style="border:1px solid #334155; padding:6px 10px;">เบอร์โทรศัพท์</th>
              </tr>
            </thead>
            <tbody>
              ${studentRowsHtml}
            </tbody>
          </table>

          <p style="text-indent:40px; margin-bottom:24px;">
            จึงเรียนมาเพื่อโปรดพิจารณาให้ความอนุเคราะห์ และขอขอบพระคุณในความร่วมมือด้วยดีเสมอมา ณ โอกาสนี้
          </p>

          <div style="text-align:center; margin-left:240px; margin-bottom:20px;">
            <div>ขอแสดงความนับถือ</div>
            <div style="height:68px; display:flex; align-items:flex-end; justify-content:center;">
              ${signatureDataUrl ? `<img src="${signatureDataUrl}" alt="ลายเซ็นผู้ลงนาม" style="max-width:150px; max-height:64px; object-fit:contain;" />` : ''}
            </div>
            <div style="font-weight:700;">(${escapeStudentHtml(cfg.deanSignatory || 'ผู้ช่วยศาสตราจารย์ ดร.พรเทพ โรจนวสุ')})</div>
            <div>${escapeStudentHtml(cfg.deanPosition || 'คณบดีคณะเทคโนโลยีสารสนเทศและการสื่อสาร')}</div>
            <div>มหาวิทยาลัยพะเยา</div>
          </div>
        </div>
      </body>
    </html>
  `);
  win.document.close();
};

window.uploadStudentAcceptanceForm = async function(inputEl) {
  const file = inputEl?.files?.[0];
  if (!file) return;
  const btn = document.getElementById('student-acceptance-upload-btn');
  const prevText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'กำลังอัปโหลดและตรวจสอบ...';
  }
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/student/acceptance-form', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (data.success) {
      alert('✅ ' + (data.message || 'อัปโหลดแบบตอบรับสำเร็จ'));
      await loadSubmissions();
    } else {
      alert('เกิดข้อผิดพลาด: ' + (data.message || 'อัปโหลดไม่สำเร็จ'));
    }
  } catch (err) {
    console.error(err);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevText;
    }
    if (inputEl) inputEl.value = '';
  }
};

// status = undefined → เปลี่ยนแค่วันที่ (date = YYYY-MM-DD จากปฏิทิน)
window.updateSubmissionStatus = async function(companyId, status, date, time) {
  try {
    const res = await fetch(`/api/student/submissions/${companyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, date, time })
    });
    const data = await res.json();
    if (data.success) {
      // อัปเดตข้อมูลในแคชแล้วเช็คเงื่อนไขปลดล็อกทันที
      const target = currentSubmissionsData.find(c => c.id === companyId);
      if (target) {
        if (!target.submission) target.submission = {};
        if (data.submission && data.submission.status) target.submission.status = data.submission.status;
        else if (status) target.submission.status = status;
        target.submission.updatedAt = (data.submission && data.submission.updatedAt) || new Date().toISOString();
      }
      checkPlacementUnlock();
    } else {
      alert('อัปเดตสถานะไม่สำเร็จ: ' + (data.message || 'เกิดข้อผิดพลาด'));
    }
  } catch (err) {
    console.error(err);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
  } finally {
    // วาดตารางใหม่ (สำเร็จ = ย้ายแถว/อัปเดตสรุป, ไม่สำเร็จ = คืนค่าเดิม)
    renderSubmissionTables();
  }
};

// =========================================================================
// 🎯 ฟังก์ชันตรวจสอบเงื่อนไขเพื่อซ่อน/ปลดล็อก
// 1. ปลดล็อกส่วนที่ 4 & 5 (Checklist และ สถานะการยื่น) เมื่อ ชั่วโมงอบรมครบ & CV ผ่าน
// =========================================================================
function checkPlacementUnlock() {
  const checklistSection = document.getElementById('checklist-section');
  const submissionSection = document.getElementById('submission-section');
  const checklistLockedCard = document.getElementById('checklist-locked-card');

  // 1. เงื่อนไข CV: ได้รับการตรวจผ่านแล้ว (APPROVED)
  const isCvApproved = currentCvData && currentCvData.status === 'APPROVED';

  // 2. เงื่อนไข ชั่วโมงอบรม: ที่ผ่านแล้ว Soft Skill >= 12 และ Hard Skill >= 18 (รวม >= 30 ชม.)
  const approvedSoftHours = currentTrainingsData
    .filter(t => t.status === 'APPROVED' && t.skillType === 'SOFT')
    .reduce((sum, t) => sum + (Number(t.hours) || 0), 0);

  const approvedHardHours = currentTrainingsData
    .filter(t => t.status === 'APPROVED' && t.skillType === 'HARD')
    .reduce((sum, t) => sum + (Number(t.hours) || 0), 0);

  const isTrainingComplete = approvedSoftHours >= TRAINING_CRITERIA.soft && approvedHardHours >= TRAINING_CRITERIA.hard;

  // -----------------------------------------------------------------------
  // 🔒 1. ตรวจสอบการปลดล็อก ส่วนที่ 4 (Checklist) และ ส่วนที่ 5 (สถานะการยื่น)
  // -----------------------------------------------------------------------
  const isChecklistUnlocked = isCvApproved && isTrainingComplete;

  // สถานะ Checklist / การยื่น (ส่งต่อให้ sidebar)
  const isChecklistApproved = currentCompaniesData.some(c => c.checklistStatus === 'APPROVED');
  const isInterviewPassed = currentSubmissionsData.some(
    comp => getSubmissionStatus(comp) === 'INTERVIEW_PASSED'
  );
  const isAcceptanceFinalized = currentAcceptanceData?.status === 'ACCEPTED';

  // อัปเดต UI ใน Card ปลดล็อกส่วนที่ 4 & 5 (checklist-locked-card)
  updateRequirementCard(
    'step-req-training',
    isTrainingComplete,
    '1. ชั่วโมงการอบรม',
    `Soft ${approvedSoftHours}/${TRAINING_CRITERIA.soft} ชม. | Hard ${approvedHardHours}/${TRAINING_CRITERIA.hard} ชม.` + (isTrainingComplete ? ' (ผ่านครบ)' : '')
  );

  let cvStatusDesc = 'รออาจารย์ตรวจผ่าน';
  if (!currentCvData || !currentCvData.fileUrl) {
    cvStatusDesc = 'ยังไม่ได้อัปโหลด CV';
  } else if (currentCvData.status === 'APPROVED') {
    cvStatusDesc = '✓ CVตรวจแล้ว / ผ่าน';
  } else if (currentCvData.status === 'REJECTED') {
    cvStatusDesc = '✗ CVไม่ผ่าน / ทำใหม่';
  } else {
    cvStatusDesc = '☐ รอผล (รออาจารย์ตรวจ)';
  }
  updateRequirementCard('step-req-cv', isCvApproved, '2. กรอกใบ CV', cvStatusDesc);

  if (isChecklistUnlocked) {
    // ปลดล็อกให้แสดงส่วนที่ 4 & 5
    if (checklistLockedCard) checklistLockedCard.style.display = 'none';
    if (checklistSection) checklistSection.style.display = 'block';
    if (submissionSection) submissionSection.style.display = 'block';

  } else {
    // ถ้ายังไม่ผ่านชั่วโมงการอบรม หรือ CV ยังไม่ผ่าน -> ซ่อนส่วนที่ 4, 5
    if (checklistLockedCard) checklistLockedCard.style.display = 'block';
    if (checklistSection) checklistSection.style.display = 'none';
    if (submissionSection) submissionSection.style.display = 'none';

  }

  // ส่งสถานะเงื่อนไขชุดเดียวกันนี้ให้ sidebar (status_all_tabs.js) ใช้แสดงเมนู/badge
  // ไม่มีการคำนวณเงื่อนไขปลดล็อกซ้ำในฝั่ง sidebar
  window.dispatchEvent(new CustomEvent('status-all:unlock-state', {
    detail: {
      ready: statusAllDataReady,
      cvHasFile: Boolean(currentCvData && currentCvData.fileUrl),
      cvStatus: currentCvData ? currentCvData.status : null,
      isCvApproved: Boolean(isCvApproved),
      approvedSoftHours,
      approvedHardHours,
      requiredSoftHours: 12,
      requiredHardHours: 18,
      pendingTrainingCount: currentTrainingsData.filter(t => t.status !== 'APPROVED' && t.status !== 'REJECTED').length,
      isTrainingComplete,
      isChecklistUnlocked: Boolean(isChecklistUnlocked),
      companyCount: currentCompaniesData.length,
      isChecklistApproved,
      hasPendingChecklist: currentCompaniesData.some(c => c.checklistStatus !== 'APPROVED' && c.checklistStatus !== 'REJECTED'),
      submissionCount: currentSubmissionsData.length,
      isInterviewPassed,
      isAcceptanceFinalized,
    },
  }));
}

// Helper อัปเดตสถานะและไอคอนในกล่อง Requirements Card
function updateRequirementCard(containerId, isDone, title, desc) {
  const container = document.getElementById(containerId);
  const icon = document.getElementById(`${containerId}-icon`);
  const descEl = document.getElementById(`${containerId}-desc`);

  if (!container) return;

  if (isDone) {
    container.style.borderColor = '#86efac';
    container.style.backgroundColor = '#f0fdf4';
    if (icon) {
      icon.textContent = 'check_circle';
      icon.style.color = '#16a34a';
    }
    if (descEl) {
      descEl.textContent = desc;
      descEl.style.color = '#15803d';
      descEl.style.fontWeight = '500';
    }
  } else {
    container.style.borderColor = '#e2e8f0';
    container.style.backgroundColor = '#ffffff';
    if (icon) {
      icon.textContent = 'hourglass_empty';
      icon.style.color = '#94a3b8';
    }
    if (descEl) {
      descEl.textContent = desc;
      descEl.style.color = '#64748b';
      descEl.style.fontWeight = 'normal';
    }
  }
}

// ฟังก์ชันดึงข้อมูลอาจารย์ที่ปรึกษาล่าสุดมาอัปเดตใน Dropdown
async function reloadAdvisorOnly() {
  try {
    const res = await fetch('/api/student/profile');
    const data = await res.json();
    if (data.success && data.student) {
      const s = data.student;
      await loadAdvisorOptions(s.advisorId ?? s.advisor?.id ?? null);
    }
  } catch (err) {
    console.error('Reload advisor error:', err);
  }
}

// เริ่มโหลดข้อมูลเมื่อเข้าหน้าเว็บ
initPage();

// ⚡ เมื่อมีสัญญาณ Real-time จาก Socket.io ให้อัปเดตตาราง, สถานะ และอาจารย์ที่ปรึกษาทันที
window.addEventListener('app:data-updated', () => {
  reloadAdvisorOnly();
  loadTrainings();
  loadCv();
  loadCompanies();
  loadSubmissions();
});
