// @ts-nocheck
// profile_view.js - หน้าโปรไฟล์นิสิต (อ่านอย่างเดียว) — โครงหน้าอยู่ที่ src/components/pages/ProfilePage.tsx

var PROFILE_EDIT_URL = '/status-all?tab=personal';

// escape ข้อความก่อนใส่ลง innerHTML (helper กลาง: src/client/components/text_utils.ts)
function escapeProfileHtml(v) {
  return window.IctText.escapeHtml(v);
}

function setProfileText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}

function cleanProfileValue(v) {
  const t = String(v ?? '').trim();
  return t && t !== '-' ? t : '';
}

// วันที่แบบ @db.Date (เที่ยงคืน UTC) → แสดงตาม UTC ไม่ให้คลาด 1 วัน
function fmtProfileDate(v, empty) {
  if (!v) return empty;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return empty;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function setProfilePhoto(url) {
  [['p-photo', 'p-icon'], ['p-photo-2', 'p-icon-2']].forEach(([imgId, iconId]) => {
    const img = document.getElementById(imgId);
    const icon = document.getElementById(iconId);
    if (!img) return;
    if (url) {
      img.src = url;
      img.style.display = 'block';
      if (icon) icon.style.display = 'none';
    }
  });
}

// สถานะฝึกงาน: ถูกดรอปก่อน แล้วจึงดูข้อมูลที่ฝึกงาน (placement)
function profileStatus(s) {
  if (s.isDropped) return { text: 'ถูกดรอป / ถอนจากรอบ', tone: 'bad' };
  const plc = s.placement;
  if (!plc || !plc.companyNameTh) return { text: 'ยังไม่ยื่นที่ฝึกงาน', tone: 'todo' };
  if (plc.status === 'APPROVED') return { text: 'อนุมัติแล้ว', tone: 'ok' };
  if (plc.status === 'REJECTED') return { text: 'ไม่อนุมัติ', tone: 'bad' };
  return { text: 'รออนุมัติ', tone: 'wait' };
}

function renderProfileContact(s, email) {
  const list = document.getElementById('p-contact');
  if (!list) return;
  const isUrl = (v) => /^https?:\/\//i.test(v);
  const rows = [
    { icon: 'call', label: 'เบอร์โทรศัพท์', value: cleanProfileValue(s.phone) },
    { icon: 'mail_outline', label: 'Email มหาวิทยาลัย', value: cleanProfileValue(email) },
    // lineId = Internship Email (gmail), facebook = GitHub (ตามป้ายในหน้า status-all)
    { icon: 'alternate_email', label: 'Internship Email', value: cleanProfileValue(s.lineId) },
    { icon: 'code', label: 'GitHub', value: cleanProfileValue(s.facebook), link: isUrl(cleanProfileValue(s.facebook)) },
  ];
  list.innerHTML = rows.map((r) => `
    <li>
      <span class="pf-contact-icon"><span class="material-icons" aria-hidden="true">${r.icon}</span></span>
      <div class="pf-contact-text">
        <small>${r.label}</small>
        ${r.value
          ? (r.link
            ? `<a href="${escapeProfileHtml(r.value)}" target="_blank" rel="noopener noreferrer">${escapeProfileHtml(r.value)} <span class="material-icons" aria-hidden="true">open_in_new</span></a>`
            : `<b>${escapeProfileHtml(r.value)}</b>`)
          : `<a class="pf-contact-empty" href="${PROFILE_EDIT_URL}">ยังไม่ระบุ · เพิ่ม</a>`}
      </div>
      ${r.value ? `<button type="button" class="pf-copy" data-copy="${escapeProfileHtml(r.value)}" aria-label="คัดลอก${r.label}" title="คัดลอก"><span class="material-icons" aria-hidden="true">content_copy</span></button>` : ''}
    </li>`).join('');
}

function renderProfileExtra(s) {
  const box = document.getElementById('p-extra');
  if (!box) return;
  const other = cleanProfileValue(s.otherInfo);
  box.innerHTML = other
    ? `<div class="pf-field"><span>ข้อมูลเพิ่มเติม</span><p class="pf-other-text">${window.IctText.linkify(other)}</p></div>`
    : `<div class="pf-empty">
        <span class="pf-empty-icon"><span class="material-icons" aria-hidden="true">note_add</span></span>
        <p>ยังไม่มีข้อมูลเพิ่มเติม</p>
        <a href="${PROFILE_EDIT_URL}"><span class="material-icons" aria-hidden="true">add</span>เพิ่มข้อมูล</a>
      </div>`;
}

// ความครบถ้วน: 4 หมวด หมวดละ 25%
function renderProfileCompleteness(s) {
  const items = [
    { label: 'ข้อมูลการศึกษา / REG', done: Boolean(cleanProfileValue(s.nameTh) && cleanProfileValue(s.studentCode) && cleanProfileValue(s.major)) },
    { label: 'ข้อมูลการติดต่อและโซเชียล', done: Boolean(cleanProfileValue(s.phone) && (cleanProfileValue(s.lineId) || cleanProfileValue(s.facebook))) },
    { label: 'รูปประจำตัว', done: Boolean(s.profileImageUrl) },
    { label: 'ข้อมูลเพิ่มเติม', done: Boolean(cleanProfileValue(s.otherInfo)) },
  ];
  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);
  const ring = document.getElementById('p-ring');
  if (ring) ring.style.setProperty('--pf-pct', String(pct));
  setProfileText('p-ring-text', `${pct}%`);
  setProfileText('p-complete-tag', `สมบูรณ์ ${pct}%`);
  setProfileText('p-complete-title', pct === 100 ? 'สมบูรณ์' : pct >= 75 ? 'เกือบสมบูรณ์' : 'ยังไม่สมบูรณ์');
  setProfileText('p-complete-sub', pct === 100 ? 'ข้อมูลครบถ้วนทุกหมวด' : 'เพิ่มข้อมูลที่ยังขาดเพื่อให้โปรไฟล์ครบถ้วน');
  const list = document.getElementById('p-checks');
  if (list) {
    list.innerHTML = items.map((i) => `
      <li class="${i.done ? 'is-done' : 'is-todo'}">
        <span class="material-icons" aria-hidden="true">${i.done ? 'check_circle' : 'radio_button_unchecked'}</span>
        <span>${i.label}${i.done ? '' : ' (ยังไม่ระบุ)'}</span>
        ${i.done ? '<small>เรียบร้อย</small>' : `<a href="${PROFILE_EDIT_URL}">+ เพิ่ม</a>`}
      </li>`).join('');
  }
}

function renderProfile(data) {
  const s = data.student;
  const email = data.user && data.user.email;
  // สาขา/หลักสูตรจาก server (findMajor ใน src/utils/majors.ts)
  const majorName = cleanProfileValue(data.majorName) || cleanProfileValue(s.major).replace(/^(สาขาวิชา|สาขา)\s*/, '');
  const curriculum = cleanProfileValue(s.curriculum) || cleanProfileValue(data.degreeName);

  // hero
  setProfileText('p-nameTh', cleanProfileValue(s.nameTh) || '-');
  const nameEn = cleanProfileValue(s.nameEn).toUpperCase();
  setProfileText('p-nameEnShort', nameEn);
  setProfileText('p-studentCode-chip', cleanProfileValue(s.studentCode) || '-');
  setProfileText('p-major-chip', majorName ? `สาขาวิชา${majorName}` : '-');
  const position = cleanProfileValue(s.placement && s.placement.position);
  const posWrap = document.getElementById('p-position-chip-wrap');
  if (posWrap) posWrap.hidden = !position || position === 'OTHER';
  setProfileText('p-position-chip', position);

  // สรุป + ช่วงฝึกงาน (มีเฉพาะวันสิ้นสุด — วันเริ่มยังไม่มีแหล่งข้อมูล)
  const advisorName = cleanProfileValue(s.advisor && s.advisor.name);
  setProfileText('p-advisor', advisorName || '-');
  const end = fmtProfileDate(s.internshipWindow && s.internshipWindow.internEndDate, 'ยังไม่กำหนด');
  ['p-end', 'p-end-2'].forEach((id) => setProfileText(id, end));
  const st = profileStatus(s);
  ['p-status', 'p-status-2'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = st.text;
    el.className = `pf-status pf-status--${st.tone}`;
  });

  // ข้อมูลการศึกษา
  setProfileText('p-nameTh-field', cleanProfileValue(s.nameTh) || '-');
  setProfileText('p-nameEn', nameEn || '-');
  setProfileText('p-studentCode', cleanProfileValue(s.studentCode) || '-');
  setProfileText('p-major', majorName ? `สาขาวิชา${majorName}` : '-');
  setProfileText('p-curriculum', curriculum || '-');
  setProfileText('p-faculty', cleanProfileValue(s.faculty) || '-');
  setProfileText('p-year', cleanProfileValue(s.year) || '-');
  setProfileText('p-gpa', s.gpa ? Number(s.gpa).toFixed(2) : '-');
  setProfileText('p-email', cleanProfileValue(email) || '-');

  // อาจารย์ที่ปรึกษา
  setProfileText('p-advisor-name', advisorName || 'ยังไม่มีอาจารย์ที่ปรึกษา');
  setProfileText('p-advisor-dept', s.advisor && s.advisor.department ? `สาขาวิชา${s.advisor.department}` : '-');
  // mailto: ใส่อีเมลตรง ๆ (ไม่ encode '@') เฉพาะรูปแบบอีเมลที่ถูกต้อง
  const advisorEmail = cleanProfileValue(data.advisorEmail);
  const validEmail = /^[^\s@<>"'?#&]+@[^\s@<>"'?#&]+\.[^\s@<>"'?#&]+$/.test(advisorEmail);
  const mailBtn = document.getElementById('p-advisor-mail');
  if (mailBtn) {
    mailBtn.hidden = !validEmail;
    if (validEmail) mailBtn.href = `mailto:${advisorEmail}`;
  }

  setProfilePhoto(s.profileImageUrl);
  renderProfileContact(s, email);
  renderProfileExtra(s);
  renderProfileCompleteness(s);
}

// ปุ่มคัดลอกในการ์ดติดต่อ (ผูกครั้งเดียว — สคริปต์อาจถูกโหลดซ้ำตอนเปลี่ยนหน้าแบบ SPA)
if (!window.__profileCopyBound) {
  window.__profileCopyBound = true;
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.pf-copy');
    if (!btn) return;
    const text = btn.dataset.copy || '';
    window.IctText.copyText(text).then((ok) => {
      btn.classList.add(ok ? 'is-copied' : 'is-failed');
      btn.title = ok ? 'คัดลอกแล้ว' : 'คัดลอกไม่สำเร็จ — กรุณาเลือกข้อความแล้วคัดลอกเอง';
      setTimeout(() => { btn.classList.remove('is-copied', 'is-failed'); btn.title = 'คัดลอก'; }, ok ? 1500 : 3000);
    });
  });
}

// โหลดไม่สำเร็จ (เช่น หมดเวลาเข้าสู่ระบบ) → บอกผู้ใช้แทนการค้าง "กำลังโหลด..."
function showProfileLoadError() {
  setProfileText('p-nameTh', 'โหลดข้อมูลไม่สำเร็จ');
  setProfileText('p-nameEnShort', 'กรุณารีเฟรชหน้า หรือเข้าสู่ระบบใหม่');
}

fetch('/api/student/profile')
  .then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then((data) => {
    if (data.success && data.student) renderProfile(data);
    else if (data.success && data.user) setProfileText('p-nameTh', data.user.username || data.user.email || '-');
    else showProfileLoadError();
  })
  .catch((err) => {
    console.error('Error fetching profile:', err);
    showProfileLoadError();
  });
