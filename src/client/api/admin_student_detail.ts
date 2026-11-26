// @ts-nocheck
// admin_student_detail.js — หน้าดูข้อมูลนิสิตรายบุคคลสำหรับ Admin
// ดึงข้อมูลจาก /api/admin/students/:studentId แล้ว render ทั้ง 7 section

// ชื่อเต็ม "หลักสูตร... สาขาวิชา..." จาก <script id="ict-majors-data"> (ต้นทาง: src/utils/majors.ts)
function ictMajorFullName(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '-';
  let majors = [];
  try {
    const el = document.getElementById('ict-majors-data');
    majors = el ? JSON.parse(el.textContent || '[]') : [];
  } catch (e) {
    majors = [];
  }
  const found = majors.find((m) => m.code.toLowerCase() === v)
    || majors.find((m) => m.keywords.some((k) => v.includes(k.toLowerCase())));
  return found ? found.fullName : raw;
}

const urlParams = new URLSearchParams(window.location.search);
const studentId = urlParams.get('id');

if (!studentId) {
  document.getElementById('student-header-name').textContent = 'ไม่พบ ID นิสิต';
}

let currentUserRole = null;
let currentActiveRole = null;
let isActingAsCourseAdmin = false;
let isActingAsAdvisor = false;
let isActingAsStaff = false;
let currentUserFlags = { isAdvisor: false, isCourseAdmin: false, isStaff: false, isSupervisor: false };

async function initStudentDetail() {
  if (!studentId) return;

  try {
    const meRes = await fetch('/auth/me');
    const meData = await meRes.json();
    if (meData.authenticated) {
      currentUserRole = meData.user.role;
      currentUserFlags = { isAdvisor: Boolean(meData.user.isAdvisor || meData.user.role === 'ADVISOR'), isCourseAdmin: Boolean(meData.user.isCourseAdmin || meData.user.role === 'ADMIN'), isStaff: Boolean(meData.user.isStaff || meData.user.role === 'STAFF'), isSupervisor: Boolean(meData.user.isSupervisor) };
      
      const activeRole = meData.user.activeRole || meData.user.role;
      const activeRoleMode = meData.user.activeRoleMode || activeRole;
      currentActiveRole = activeRole;

      // ตรวจสอบบทบาทที่กำลังใช้งานอยู่จริง (Active Role Mode) เพื่อไม่ให้สิทธิ์ข้ามกัน
      isActingAsCourseAdmin = Boolean(
        activeRole === 'COURSE_ADMIN' ||
        activeRole === 'ADMIN' ||
        activeRoleMode === 'COURSE_INSTRUCTOR'
      );
      isActingAsAdvisor = Boolean(
        activeRole === 'ADVISOR' ||
        activeRoleMode === 'ADVISOR'
      );
      isActingAsStaff = Boolean(
        activeRole === 'STAFF' ||
        activeRoleMode === 'FACULTY_STAFF'
      );

      const backBtn = document.querySelector('a[href*="dashboard"]');
      if (backBtn) {
        if (isActingAsAdvisor) {
          backBtn.href = '/advisor-dashboard';
          backBtn.innerHTML = '<span class="material-icons" style="font-size:18px;">arrow_back</span> กลับหน้า Dashboard ที่ปรึกษา';
        } else {
          backBtn.href = '/admin-dashboard';
          backBtn.innerHTML = '<span class="material-icons" style="font-size:18px;">arrow_back</span> กลับหน้า Dashboard ภาพรวม';
        }
      }
    }

    const res = await fetch(`/api/admin/students/${studentId}`);
    const data = await res.json();
    if (!data.success) {
      document.getElementById('student-header-name').textContent = 'ไม่พบข้อมูลนิสิต';
      return;
    }

    renderProfile(data.student);
    renderTrainings(data.trainings, data.trainingSummary);
    renderCv(data.cv, data.cvComments, data.canCommentCv);
    renderCompanies(data.companies, data.acceptanceWorkflow);
    renderSubmissions(data.companies);
    renderPlacement(data.placement);
    renderAcceptanceFormReview(data.acceptanceWorkflow);
    renderDocumentSummary(data);
    renderCoopSummary(data.coop);
    loadCohortInfo(studentId);

    // Multi-round history (SCRUM-73)
    const roundSection = document.getElementById('admin-round-history-section');
    if (roundSection && data.roundInfo) {
      if (data.roundInfo.currentRound >= 2 || (data.roundInfo.historyRounds && data.roundInfo.historyRounds.length > 0)) {
        roundSection.style.display = 'block';
        const r1 = data.roundInfo.historyRounds && data.roundInfo.historyRounds[0];
        if (r1) {
          const badgeEl = document.getElementById('admin-r1-term-badge');
          const compNameEl = document.getElementById('admin-r1-comp-name');
          const compPosEl = document.getElementById('admin-r1-comp-pos');
          const compAddrEl = document.getElementById('admin-r1-comp-addr');
          const compContactEl = document.getElementById('admin-r1-comp-contact');
          const checklistBadgeEl = document.getElementById('admin-r1-checklist-badge');
          const acceptanceInfoEl = document.getElementById('admin-r1-acceptance-info');
          const docsListEl = document.getElementById('admin-r1-docs-list');

          if (badgeEl) badgeEl.textContent = `รอบ 1 (${r1.term || '-'})`;
          if (compNameEl) compNameEl.textContent = r1.companyName || '-';
          if (compPosEl) compPosEl.textContent = r1.position || '-';
          if (compAddrEl) compAddrEl.textContent = `${r1.companyAddress || '-'} ${r1.province && r1.province !== '-' ? '(' + r1.province + ')' : ''}`;
          if (compContactEl) compContactEl.textContent = `${r1.phone || '-'} / ${r1.email || '-'}`;
          if (checklistBadgeEl) checklistBadgeEl.textContent = r1.checklistStatus === 'APPROVED' ? 'ผ่านครบทุกขั้นตอน' : (r1.checklistStatus || 'ผ่าน');
          if (acceptanceInfoEl) acceptanceInfoEl.textContent = r1.companyResponseStatus === 'ACCEPTED' ? 'ตอบรับเข้าฝึกงานเรียบร้อย' : (r1.companyResponseStatus || 'ตอบรับแล้ว');

          if (docsListEl) {
            const docs = [];
            if (r1.requestLetterIssued) {
              docs.push(`📄 หนังสือขอความอนุเคราะห์ (${r1.requestLetterDocNo ? 'เลขที่: ' + r1.requestLetterDocNo : 'ออกหนังสือแล้ว'})`);
            }
            if (r1.companyResponseFileUrl) {
              docs.push(`📄 แบบตอบรับ: <a href="${r1.companyResponseFileUrl}" target="_blank" class="text-blue-600 underline font-semibold">${r1.companyResponseFileName || 'เปิดดูแบบตอบรับ'}</a>`);
            }
            if (r1.dispatchLetterIssued) {
              docs.push(`📄 หนังสือส่งตัว (${r1.dispatchLetterDocNo ? 'เลขที่: ' + r1.dispatchLetterDocNo : 'ออกหนังสือแล้ว'})`);
            }
            if (docs.length > 0) {
              docsListEl.innerHTML = docs.map(d => `<div class="text-xs text-gray-700 bg-white p-1.5 rounded border border-gray-200">${d}</div>`).join('');
            } else {
              docsListEl.innerHTML = '<span class="text-gray-400 italic">ไม่มีไฟล์แนบประวัติ</span>';
            }
          }
        }
      } else {
        roundSection.style.display = 'none';
      }
    }

    const btnGoToChecklist = document.getElementById('btn-goto-checklist-review') as HTMLAnchorElement | null;
    if (btnGoToChecklist) {
      btnGoToChecklist.href = `/advisor-checklist-review?studentId=${studentId}`;
      btnGoToChecklist.innerHTML = `<span class="material-icons" style="font-size:18px;">${isActingAsAdvisor ? 'fact_check' : 'visibility'}</span> ${isActingAsAdvisor ? 'ตรวจประเมิน Checklist &amp; แบบตอบรับ' : 'ดูแบบประเมิน Checklist (อ่านอย่างเดียว)'}`;
    }

    const trainingApproval = document.getElementById('training-approval-area');
    const trainingSave = document.getElementById('training-save-area');
    if (!isActingAsCourseAdmin) {
      if (trainingApproval) trainingApproval.style.display = 'none';
      if (trainingSave) trainingSave.style.display = 'none';
    }
  } catch (err) {
    console.error('Load student detail error:', err);
  }
}

// ==========================================
// 1. ข้อมูลส่วนตัว (อ่านอย่างเดียว)
// ==========================================
// =====================================================================
// รุ่น / รอบออกฝึก / ตกค้าง (RETEST) — พี่จอม (Staff) หรือ Admin ตั้ง RETEST รายคนได้
// =====================================================================
/** "2026-11-02" -> "2 พ.ย. 2569" (ว่าง = "-") */
function fmtWindowDate(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '-';
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${parseInt(m[3], 10)} ${months[parseInt(m[2], 10) - 1]} ${parseInt(m[1], 10) + 543}`;
}

async function loadCohortInfo(studentId) {
  const section = document.getElementById('internship-cohort-section');
  const body = document.getElementById('internship-cohort-body');
  if (!section || !body) return;
  try {
    const res = await fetch(`/api/admin/super-admin/students/${studentId}/cohort-info`);
    const info = await res.json();
    if (!info.success) return;
    section.style.display = 'block';

    const canEdit = Boolean(isActingAsStaff || isActingAsCourseAdmin);
    const isRetest = info.internshipType === 'RETEST';
    const item = (label, value) => `
      <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:10px 12px;">
        <div style="font-size:11px; font-weight:700; color:#64748B;">${label}</div>
        <div style="font-size:13.5px; font-weight:700; color:#1E1B4B; margin-top:2px;">${value}</div>
      </div>`;

    const cohortText = info.cohortCode
      ? `รหัส ${info.cohortCode}${info.classYear ? ` · ปี ${info.classYear}` : ''}${info.cohortStatus === 'ARCHIVED' ? ` (ปิดรุ่นแล้ว${info.cohortAcademicYear ? ` · ปีการศึกษา ${info.cohortAcademicYear}` : ''})` :(info.cohortStatus ? '' : ' (ยังไม่มีในระบบ)')}`
      : '-';
    const w = info.window;
    const windowText = w
      ? `${w.term}${w.termType === 'SUMMER' ? ' (Summer)' : ''}${w.cohortCode !== info.cohortCode ? ` · รอบของรุ่น ${w.cohortCode}` : ''}
         <span style="font-size:11.5px; font-weight:600; color:#4338CA;"> — ${w.statusLabel}</span>
         ${w.internStartDate || w.internEndDate ? `<div style="font-size:11.5px; font-weight:600; color:#475569; margin-top:2px;">ฝึก ${fmtWindowDate(w.internStartDate)} – ${fmtWindowDate(w.internEndDate)}</div>` : ''}`
      : '<span style="color:#94A3B8; font-weight:600;">ยังไม่ได้ผูกรอบ (ผูกอัตโนมัติตอนยื่น Checklist)</span>';
    const typeText = isRetest
      ? '<span style="color:#B45309;">⚠ ตกค้าง (RETEST)</span>'
      : (info.isStraggler ? '<span style="color:#B45309;">ตกค้าง (รุ่นถูกปิด/ไม่มีในระบบ)</span>' : 'ปกติ (NEW)');

    body.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">
        ${item('รุ่น', cohortText)}
        ${item('รอบออกฝึก', windowText)}
        ${item('ประเภทการฝึก', typeText)}
      </div>
      ${canEdit ? `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-top:12px; padding:10px 12px; background:${isRetest ? '#FFFBEB' : '#F8FAFC'}; border:1px solid ${isRetest ? '#FCD34D' : '#E2E8F0'}; border-radius:10px;">
          <div style="font-size:12px; color:#475569;">
            ${isRetest
              ? 'นิสิตคนนี้ยื่นรอบออกฝึกที่เปิดอยู่ของรุ่นถัดไปได้ (ยังอยู่ในรุ่นเดิม)'
              : 'ตั้งเป็น "ตกค้าง" เพื่อให้นิสิตเลือกยื่นรอบออกฝึกของรุ่นถัดไปได้ (เช่น ฝึกรอบแรกไม่ผ่าน)'}
          </div>
          <button type="button" onclick="window.setStudentInternshipType(${studentId}, '${isRetest ? 'NEW' : 'RETEST'}')"
            style="border:none; border-radius:8px; padding:7px 14px; font-size:12.5px; font-weight:700; cursor:pointer; color:white; background:${isRetest ? '#475569' : '#D97706'};">
            ${isRetest ? '↩ ยกเลิกสถานะตกค้าง' : '⚠ ตั้งเป็นตกค้าง (RETEST)'}
          </button>
        </div>` : ''}
    `;
  } catch (err) {
    console.error('loadCohortInfo error:', err);
  }
}

window.setStudentInternshipType = async function(studentId, internshipType) {
  const msg = internshipType === 'RETEST'
    ? 'ยืนยันตั้งนิสิตคนนี้เป็น "ตกค้าง (RETEST)" หรือไม่?\n\n* นิสิตจะเลือกยื่นรอบออกฝึกที่เปิดอยู่ของรุ่นถัดไปได้'
    : 'ยืนยันยกเลิกสถานะ "ตกค้าง" ของนิสิตคนนี้หรือไม่?';
  if (!confirm(msg)) return;
  try {
    const res = await fetch(`/api/admin/super-admin/students/${studentId}/internship-type`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ internshipType }),
    });
    const data = await res.json();
    alert((data.success ? '✅ ' : 'เกิดข้อผิดพลาด: ') + (data.message || ''));
    if (data.success) loadCohortInfo(studentId);
  } catch (err) {
    console.error(err);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
  }
};

function renderProfile(s) {
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  setText('student-header-name', `${s.studentCode} ${s.nameTh}`);

  const dropBadge = document.getElementById('student-dropped-badge');
  if (dropBadge) {
    if (s.isDropped) {
      dropBadge.style.display = 'block';
      dropBadge.title = `เหตุผล: ${s.dropReason || 'ดรอปจากระบบ'}`;
    } else {
      dropBadge.style.display = 'none';
    }
  }

  if (s.profileImageUrl) {
    const img = document.getElementById('student-photo');
    img.src = s.profileImageUrl;
    img.style.display = 'block';
  }
  document.getElementById('student-detail-advisor').value = s.advisorName || '';
  document.getElementById('d-nameTh').value = s.nameTh || '';
  document.getElementById('d-nameEn').value = s.nameEn || '';
  document.getElementById('d-studentCode').value = s.studentCode || '';
  document.getElementById('d-year').value = s.year || '';
  document.getElementById('d-gpa').value = s.gpa ? Number(s.gpa).toFixed(2) : '';
  document.getElementById('d-major').value = s.major ? ictMajorFullName(s.major) : '';
  document.getElementById('student-detail-email').value = s.email || '';
  document.getElementById('d-phone').value = s.phone || '';
  const elLine = document.getElementById('d-lineId'); if (elLine) elLine.value = s.lineId || '';
  const elFb = document.getElementById('d-facebook'); if (elFb) elFb.value = s.facebook || '';
}

// ==========================================
// 2. ชั่วโมงการอบรม (admin ตรวจได้ — แบบ Figma)
// ==========================================
// ตารางชั่วโมงอบรม: คอลัมน์/หน้าตาเดียวกับหน้านิสิต (src/client/components/training_view.ts)
// - อาจารย์ประจำวิชา: ติ๊กเลือกหลายรายการเพื่ออนุมัติพร้อมกัน + ปุ่ม ผ่าน/ไม่ผ่าน ในหน้าต่างรายละเอียด
// - อาจารย์ที่ปรึกษา / เจ้าหน้าที่: ดูอย่างเดียว (ไม่มี checkbox / ปุ่มตัดสิน)
let currentTrainings = [];

function isFacultyTraining(t) {
  return Boolean(t.source === 'STAFF_IMPORT' || t.source === 'ADMIN_IMPORT' || (t.title && /\[Check-in/i.test(t.title)));
}

function renderTrainings(trainings, summary) {
  const tbody = document.getElementById('admin-trainings-tbody');
  const summaryEl = document.getElementById('training-summary-text');
  const approvalArea = document.getElementById('training-approval-area');
  const saveArea = document.getElementById('training-save-area');
  const colHeader = document.getElementById('training-status-col-header');
  currentTrainings = Array.isArray(trainings) ? trainings : [];

  if (summaryEl) {
    summaryEl.textContent = `Soft: ${summary.approvedSoft}/${summary.totalSoft} ชม. | Hard: ${summary.approvedHard}/${summary.totalHard} ชม.`;
  }

  // หัวคอลัมน์สถานะ: อาจารย์ประจำวิชามีช่องเลือกทั้งหมด
  if (colHeader) {
    colHeader.innerHTML = isActingAsCourseAdmin
      ? `<label style="cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
          <input type="checkbox" id="training-select-all" style="width:15px; height:15px; cursor:pointer; accent-color:#4338CA;" title="เลือกทั้งหมด" aria-label="เลือกทั้งหมด" />
          <span>สถานะ</span>
        </label>`
      : 'สถานะ';
  }

  if (!currentTrainings.length) {
    tbody.innerHTML = `<tr class="trn-empty-row"><td colspan="7"><div class="trn-empty">
      <span class="material-icons">school</span>
      <div class="trn-empty-title">ยังไม่มีข้อมูลการอบรม</div>
    </div></td></tr>`;
    if (approvalArea) approvalArea.style.display = 'none';
    if (saveArea) saveArea.style.display = 'none';
    return;
  }

  // แสดงส่วนอนุมัติแบบหลายรายการ เฉพาะอาจารย์ประจำวิชาและมีรายการที่นิสิตอัปโหลดมาให้ตรวจ
  const hasReviewableStudentCerts = currentTrainings.some((t) => !isFacultyTraining(t));
  const showBulk = isActingAsCourseAdmin && hasReviewableStudentCerts;
  if (approvalArea) approvalArea.style.display = showBulk ? 'flex' : 'none';
  if (saveArea) saveArea.style.display = showBulk ? 'block' : 'none';

  tbody.innerHTML = currentTrainings.map((t, idx) => {
    // checkbox เฉพาะรายการที่นิสิตอัปโหลดเอง (กิจกรรมคณะ/นำเข้า เปลี่ยนสถานะไม่ได้)
    const checkbox = (isActingAsCourseAdmin && !isFacultyTraining(t))
      ? `<input type="checkbox" class="training-cert-checkbox" data-id="${t.id}" aria-label="เลือกรายการนี้" style="width:16px; height:16px; cursor:pointer; accent-color:#2563eb;" />`
      : '';
    return window.TrainingView.rowHtml(t, idx + 1, { viewOnclick: `openAdminTrainingDetail(${t.id})`, statusPrefixHtml: checkbox });
  }).join('');

  // ผูกการทำงาน Checkbox เลือกทั้งหมด (Select All) เฉพาะ Course Admin
  if (isActingAsCourseAdmin) {
    const selectAll = document.getElementById('training-select-all');
    if (selectAll) {
      selectAll.checked = false;
      selectAll.onchange = function() {
        document.querySelectorAll('.training-cert-checkbox').forEach(cb => {
          cb.checked = selectAll.checked;
        });
      };
    }
  }
}

// หน้าต่างรายละเอียด (เหมือนฝั่งนิสิต) + อาจารย์ประจำวิชาตัดสิน ผ่าน/ไม่ผ่าน ได้ทันที
window.openAdminTrainingDetail = function(id) {
  const t = currentTrainings.find((x) => x.id === id);
  if (!t) return;
  const canDecide = isActingAsCourseAdmin && !isFacultyTraining(t);
  if (!canDecide) {
    window.TrainingView.openDetail(t);
    return;
  }
  window.TrainingView.openDetail(t, {
    extraBodyHtml: `
      <div class="trn-field" style="margin-top:12px;">
        <label for="trn-review-note">คอมเมนต์ / หมายเหตุถึงนิสิต <span style="font-weight:400; color:#64748B;">(บังคับเมื่อไม่ผ่าน)</span></label>
        <textarea id="trn-review-note" class="trn-input" rows="2" maxlength="500" placeholder="เช่น ลิงก์ไม่ตรงกับใบรับรอง / ชั่วโมงไม่ตรงกับที่ผู้จัดประกาศ">${window.TrainingView.esc(t.note || '')}</textarea>
        <div class="trn-field-error" id="trn-review-error"></div>
      </div>`,
    footHtml: `
      <button type="button" class="trn-btn trn-btn--ghost" onclick="TrainingView.close()">ปิด</button>
      <button type="button" class="trn-btn" onclick="decideTraining(${t.id}, 'REJECTED')" style="background:#ffffff; color:#B91C1C; border:1px solid #FCA5A5;">✗ ไม่ผ่าน</button>
      <button type="button" class="trn-btn trn-btn--primary" onclick="decideTraining(${t.id}, 'APPROVED')">✓ ผ่าน</button>`,
  });
};

window.decideTraining = async function(trainingId, status) {
  const noteEl = document.getElementById('trn-review-note');
  const errEl = document.getElementById('trn-review-error');
  const note = noteEl ? noteEl.value.trim() : '';
  if (status === 'REJECTED' && !note) {
    if (errEl) errEl.textContent = 'กรุณาระบุเหตุผลที่ไม่ผ่าน ให้นิสิตรู้ว่าต้องแก้อะไร';
    if (noteEl) noteEl.focus();
    return;
  }
  try {
    const res = await fetch(`/api/admin/students/${studentId}/training/${trainingId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note }),
    });
    const data = await res.json().catch(() => ({ success: false }));
    if (!data.success) {
      if (errEl) errEl.textContent = data.message || 'บันทึกไม่สำเร็จ';
      return;
    }
    window.TrainingView.close();
    initStudentDetail();
  } catch (err) {
    console.error(err);
    if (errEl) errEl.textContent = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
  }
};

// บันทึกสถานะชั่วโมงอบรม: นำสถานะจาก Dropdown ไปใช้กับรายการที่ติ๊ก Checkbox เลือกไว้
window.saveBatchTrainingStatus = async function() {
  const statusSelect = document.getElementById('training-batch-status');
  const noteEl = document.getElementById('training-batch-note');
  const targetStatus = statusSelect ? statusSelect.value : 'APPROVED';
  const note = noteEl ? noteEl.value.trim() : '';

  // ดึงเฉพาะ Checkbox รายการที่อาจารย์ติ๊กเลือก
  const selectedCheckboxes = document.querySelectorAll('.training-cert-checkbox:checked');
  if (selectedCheckboxes.length === 0) {
    alert('กรุณาติ๊ก Checkbox เลือกรายการที่ต้องการเปลี่ยนสถานะอย่างน้อย 1 รายการ');
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const cb of selectedCheckboxes) {
    const trainingId = cb.dataset.id;
    try {
      const res = await fetch(`/api/admin/students/${studentId}/training/${trainingId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus, note }),
      });
      const data = await res.json();
      if (data.success) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (err) {
      failCount++;
    }
  }

  const statusLabel = targetStatus === 'APPROVED' ? 'ผ่าน (อนุมัติ)' : 'ไม่ผ่าน';
  if (successCount > 0) {
    alert(`✅ บันทึกสถานะ "${statusLabel}" สำหรับ ${successCount} รายการที่เลือกเรียบร้อยแล้ว`);
    initStudentDetail();
  } else {
    alert('เกิดข้อผิดพลาดในการอัปเดต');
  }
};

// ==========================================
// 3. CV (admin ตรวจได้)
// ==========================================
function renderCv(cv, comments, canComment) {
  const section = document.getElementById('admin-cv-section');
  if (!cv) {
    section.innerHTML = '<p class="text-gray-400 text-center py-4">นิสิตยังไม่ได้อัปโหลด CV</p>';
    return;
  }
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmt = (v) => (v ? new Date(v).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
  const list = Array.isArray(comments) ? comments : [];

  // CV ไม่มีการอนุมัติแล้ว — อาจารย์คอมเมนต์อย่างเดียว (นิสิตอ่านอย่างเดียว)
  const statusBadge = cv.state === 'COMMENTED'
    ? '<span style="background:#EEF2FF; color:#3730A3; border:1px solid #C7D2FE; border-radius:999px; padding:2px 10px; font-size:13px; font-weight:700;">💬 อาจารย์คอมเมนต์แล้ว</span>'
    : '<span style="background:#FEF3C7; color:#92400E; border:1px solid #FCD34D; border-radius:999px; padding:2px 10px; font-size:13px; font-weight:700;">📄 อัปโหลดแล้ว • รอคอมเมนต์</span>';
  const reuploadNote = cv.uploadedAfterComment
    ? '<div style="margin-top:6px; font-size:13px; color:#B45309; font-weight:600;">นิสิตอัปโหลดไฟล์ใหม่หลังคอมเมนต์ล่าสุด</div>'
    : '';

  const displayUrl = getCvDisplayUrl(cv);
  const previewHtml = `<img src="${displayUrl}" alt="CV" style="max-width:450px; max-height:550px; border-radius:8px; border:1px solid #e2e8f0; cursor:pointer;" onclick="window.open('${cv.fileUrl}', '_blank')" />`;

  const commentsHtml = list.length
    ? list.map((c) => `
        <div style="padding:10px 12px; border:1px solid #E2E8F0; border-radius:10px; background:${c.forOlderFile ? '#F8FAFC' : '#FFFFFF'};">
          <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; font-size:12.5px; color:#64748B;">
            <span><strong style="color:#334155;">${esc(c.authorName)}</strong> (${esc(c.authorRoleLabel)}) · ${esc(fmt(c.createdAt))}
              ${c.forOlderFile ? `<span style="margin-left:4px; background:#F1F5F9; border:1px solid #CBD5E1; border-radius:999px; padding:0 7px; font-size:11px;" title="${esc(c.cvFileName || '')}">เขียนถึงไฟล์ก่อนหน้า</span>` : ''}
            </span>
            ${c.mine ? `<button type="button" onclick="deleteCvComment(${c.id})" style="background:none; border:none; color:#DC2626; font-size:12px; cursor:pointer;">ลบ</button>` : ''}
          </div>
          <div style="margin-top:4px; white-space:pre-wrap; font-size:14px; color:#1E293B;">${esc(c.message)}</div>
        </div>`).join('')
    : '<div style="font-size:13px; color:#94A3B8;">ยังไม่มีคอมเมนต์</div>';

  const formHtml = canComment
    ? `<div style="margin-top:10px;">
        <label for="cv-comment-input" style="font-size:14px; font-weight:600; color:#334155;">เพิ่มคอมเมนต์ (นิสิตอ่านได้ ตอบกลับไม่ได้)</label>
        <textarea id="cv-comment-input" class="input-field" rows="3" maxlength="2000" placeholder="เช่น ควรเพิ่มผลงาน/โปรเจกต์ที่เกี่ยวกับตำแหน่งที่สมัคร..." style="margin-top:4px; width:100%; resize:vertical; font-size:14px;"></textarea>
        <button type="button" class="btn btn-primary btn-sm" id="cv-comment-submit" onclick="submitCvComment()" style="margin-top:6px;">💬 ส่งคอมเมนต์</button>
      </div>`
    : `<div style="margin-top:10px; padding:8px 12px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; font-size:13px; color:#64748B;">
        ℹ️ คอมเมนต์ CV ได้เฉพาะอาจารย์ที่ปรึกษาของนิสิตคนนี้ หรืออาจารย์ประจำวิชา (ไม่มีการอนุมัติ CV)
      </div>`;

  section.innerHTML = `
    <div style="display:flex; justify-content:center; align-items:flex-start; gap:20px; flex-wrap:wrap; max-width:900px; margin:0 auto; padding:20px;">
      <div>${previewHtml}</div>
      <div style="flex:1; min-width:260px; max-width:440px;">
        <p style="font-size:16px; margin-bottom:8px;"><strong>ไฟล์:</strong> ${esc(cv.fileName || 'CV')}</p>
        <p style="font-size:14px; margin-bottom:8px; color:#64748B;">อัปโหลดเมื่อ ${esc(fmt(cv.uploadedAt))}</p>
        <div style="margin-bottom:12px;">${statusBadge}${reuploadNote}</div>
        <div style="font-size:15px; font-weight:700; color:#1E293B; margin-bottom:6px;">คอมเมนต์ (${list.length})</div>
        <div style="display:flex; flex-direction:column; gap:8px; max-height:360px; overflow:auto;">${commentsHtml}</div>
        ${formHtml}
      </div>
    </div>
  `;
}

window.submitCvComment = async function() {
  const input = document.getElementById('cv-comment-input');
  const btn = document.getElementById('cv-comment-submit');
  const message = input ? input.value.trim() : '';
  if (!message) {
    alert('กรุณาพิมพ์คอมเมนต์');
    return;
  }
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`/api/admin/students/${studentId}/cv-comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const data = await res.json().catch(() => ({ success: false, message: `HTTP ${res.status}` }));
    if (!data.success) {
      alert(data.message || 'บันทึกคอมเมนต์ไม่สำเร็จ');
      if (btn) btn.disabled = false;
      return;
    }
    initStudentDetail();
  } catch (err) {
    console.error(err);
    alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    if (btn) btn.disabled = false;
  }
};

window.deleteCvComment = async function(commentId) {
  if (!confirm('ลบคอมเมนต์นี้?')) return;
  try {
    const res = await fetch(`/api/admin/students/${studentId}/cv-comments/${commentId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({ success: false }));
    if (!data.success) alert(data.message || 'ลบไม่สำเร็จ');
    initStudentDetail();
  } catch (err) {
    console.error(err);
  }
};

// ==========================================
// 4. Checklist บริษัท (อ่านอย่างเดียว — แบบ Figma + ดูตัวอย่าง modal)
// ==========================================

// เก็บข้อมูล companies ไว้ใช้ใน modal
let cachedCompanies = [];

function renderCompanies(companies, acceptanceWf) {
  const tbody = document.getElementById('admin-companies-tbody');
  const reviewStatusDiv = document.getElementById('checklist-review-status');
  const reviewBadge = document.getElementById('checklist-review-badge');
  tbody.innerHTML = '';
  cachedCompanies = companies || [];

  if (!companies || companies.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-400">ยังไม่มีข้อมูล checklist</td></tr>';
    if (reviewStatusDiv) reviewStatusDiv.style.display = 'none';
    return;
  }

  companies.forEach((c, idx) => {
    let statusText = '☐ รอผล';
    let statusStyle = 'color:#94a3b8;';
    if (c.checklistStatus === 'APPROVED') {
      statusText = '✓ ผ่าน';
      statusStyle = 'color:#22c55e; font-weight:600;';
    } else if (c.checklistStatus === 'REJECTED') {
      statusText = '✗ ไม่ผ่าน';
      statusStyle = 'color:#ef4444; font-weight:600;';
    }

    // สถานะแบบตอบรับของบริษัทนี้
    let acceptanceBadge = '<span style="color:#94a3b8; font-size:14px;">-</span>';
    if (acceptanceWf && acceptanceWf.companyResponseFileUrl) {
      const isTargetComp = (acceptanceWf.companyName && c.name && acceptanceWf.companyName.trim().toLowerCase() === c.name.trim().toLowerCase()) || companies.length === 1;
      if (isTargetComp) {
        const accStatus = acceptanceWf.companyResponseStatus;
        if (accStatus === 'WAITING_ADVISOR_APPROVAL') {
          acceptanceBadge = '<span style="color:#b45309; background:#fef3c7; border:1px solid #fde68a; font-size:12px; font-weight:700; padding:2px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;"><span class="material-icons" style="font-size:14px;">hourglass_top</span> รอที่ปรึกษาตรวจ</span>';
        } else if (accStatus === 'ADVISOR_APPROVED') {
          acceptanceBadge = '<span style="color:#047857; background:#dcfce7; border:1px solid #86efac; font-size:12px; font-weight:700; padding:2px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;"><span class="material-icons" style="font-size:14px;">check_circle</span> ที่ปรึกษาอนุมัติแล้ว</span>';
        } else if (accStatus === 'ACCEPTED') {
          acceptanceBadge = '<span style="color:#047857; background:#dcfce7; border:1px solid #86efac; font-size:12px; font-weight:700; padding:2px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;"><span class="material-icons" style="font-size:14px;">task_alt</span> ตอบรับเข้าฝึกงาน</span>';
        } else if (accStatus === 'REJECTED') {
          acceptanceBadge = '<span style="color:#b91c1c; background:#fee2e2; border:1px solid #fca5a5; font-size:12px; font-weight:700; padding:2px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px;"><span class="material-icons" style="font-size:14px;">cancel</span> ไม่ผ่าน/ปฏิเสธ</span>';
        }
      }
    }

    // คอลัมน์การดำเนินการ:
    // ถ้าเป็นอาจารย์ที่ปรึกษา ให้กดเข้าไปหน้า checklist เพื่อตรวจประเมินได้ทันที
    // ถ้าเป็นอาจารย์ประจำวิชา / เจ้าหน้าที่ ให้เปิด modal ดูตัวอย่างแบบอ่านอย่างเดียว
    const actionHtml = isActingAsAdvisor
      ? `<a href="/advisor-checklist-review?studentId=${studentId}&companyId=${c.id}" style="background:#4338CA; color:white; padding:6px 14px; border-radius:8px; font-size:12.5px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px; box-shadow:0 2px 4px rgba(67,56,202,0.2);"><span class="material-icons" style="font-size:15px;">fact_check</span> ตรวจ Checklist</a>`
      : `<a href="#" onclick="openChecklistModal(${idx}); return false;" style="color:#2563eb; font-size:14px; font-weight:600; text-decoration:none; display:inline-flex; align-items:center; gap:4px;"><span class="material-icons" style="font-size:16px;">visibility</span> ดูตัวอย่าง</a>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-size:16px;">${idx + 1}</td>
      <td style="font-size:16px;">${c.name}</td>
      <td style="font-size:16px; ${statusStyle}">${statusText}</td>
      <td style="font-size:14px; text-align:center;">${acceptanceBadge}</td>
      <td style="text-align:center;">${actionHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  // สถานะผลรีวิว
  if (reviewStatusDiv && reviewBadge) {
    const hasApproved = companies.some(c => c.checklistStatus === 'APPROVED');
    const hasRejected = companies.some(c => c.checklistStatus === 'REJECTED');
    const allPending = companies.every(c => !c.checklistStatus || c.checklistStatus === 'PENDING');

    reviewStatusDiv.style.display = 'block';

    if (hasApproved) {
      reviewBadge.innerHTML = '<span style="display:inline-block; padding:10px 32px; border-radius:8px; background:#22c55e; color:white; font-size:16px; font-weight:600;">อาจารย์รีวิวแล้ว</span>';
    } else if (hasRejected) {
      reviewBadge.innerHTML = '<span style="display:inline-block; padding:10px 32px; border-radius:8px; background:#ef4444; color:white; font-size:16px; font-weight:600;">ไม่ผ่าน / ทำ checklist เพิ่ม</span>';
    } else if (allPending) {
      reviewBadge.innerHTML = '<span style="display:inline-block; padding:10px 32px; border-radius:8px; background:#f59e0b; color:white; font-size:16px ; font-weight:600;">รอผล</span>';
    }
  }
}

// เปิด Modal ดูตัวอย่าง Checklist ของบริษัท (styling เหมือน checklist.html)
window.openChecklistModal = function(companyIdx) {
  const company = cachedCompanies[companyIdx];
  if (!company) return;

  const modal = document.getElementById('checklist-modal');
  const title = document.getElementById('checklist-modal-title');
  const body = document.getElementById('checklist-modal-body');

  // ซ่อน title ด้านบนเดิม เพราะจะใช้ header สีน้ำเงินแทน
  title.style.display = 'none';

  // จัดกลุ่มคำตอบตาม section
  const answers = company.answers || [];
  if (answers.length === 0) {
    body.innerHTML = `
      <div style="border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08); border:1px solid #d1d5db; background:white;">
        <div style="background:linear-gradient(90deg,#1e3a8a,#2563eb); color:white; padding:12px 20px; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-icons" style="font-size:24px;">business</span>
            <span style="font-weight:600; font-size:1.1rem;">${company.name}</span>
          </div>
          <button onclick="closeChecklistModal()" style="background:none; border:none; cursor:pointer; color:white; font-size:16px;">ปิด</button>
        </div>
        <p style="color:#94a3b8; text-align:center; padding:40px 20px;">นิสิตยังไม่ได้กรอก Checklist สำหรับบริษัทนี้</p>
      </div>`;
  } else {
    // จัดกลุ่มตาม section
    const sectionMap = {};
    const sectionOrder = [];
    answers.forEach(a => {
      const sectionName = a.checklistItem?.section?.title || 'อื่นๆ';
      if (!sectionMap[sectionName]) {
        sectionMap[sectionName] = [];
        sectionOrder.push(sectionName);
      }
      sectionMap[sectionName].push(a);
    });

    let sectionsHtml = '';
    sectionOrder.forEach(sectionName => {
      const items = sectionMap[sectionName];
      let rowsHtml = '';
      items.forEach(a => {
        const itemLabel = a.checklistItem?.description || a.checklistItem?.label || '-';
        const isChecked = a.checked === true || a.checked === 'true' || a.value === true || a.value === 'true' || a.value === 'PASS';
        const detail = a.detail || a.note || '';

        rowsHtml += `
          <tr>
            <td style="text-align:left; color:#1f2937; width:60%; border:1px solid #e5e7eb; padding:10px 14px;">${itemLabel}</td>
            <td style="text-align:center; width:10%; border:1px solid #e5e7eb; padding:10px 14px;">
              <input type="checkbox" ${isChecked ? 'checked' : ''} disabled style="width:20px; height:20px; accent-color:#2563eb; cursor:default;" />
            </td>
            <td style="width:30%; border:1px solid #e5e7eb; padding:10px 14px; color:#64748b; font-size:13px;">${detail || '-'}</td>
          </tr>`;
      });

      sectionsHtml += `
        <div style="padding:0 24px 8px 24px;">
          <h3 style="font-size:1.25rem; font-weight:600; color:#1d4ed8; margin:24px 0 12px 0; display:flex; align-items:center; gap:8px;">
            <span class="material-icons" style="color:#2563eb;">bookmark</span>
            ${sectionName}
          </h3>
          <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:0.95rem;">
            <thead>
              <tr>
                <th style="background-color:#f9fafb; font-weight:600; text-align:center; color:#374151; border:1px solid #e5e7eb; padding:10px 14px;">รายละเอียดที่ต้องพิจารณา</th>
                <th style="background-color:#f9fafb; font-weight:600; text-align:center; color:#374151; border:1px solid #e5e7eb; padding:10px 14px;">Checklist</th>
                <th style="background-color:#f9fafb; font-weight:600; text-align:center; color:#374151; border:1px solid #e5e7eb; padding:10px 14px;">รายละเอียดเพิ่ม</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>`;
    });

    body.innerHTML = `
      <div style="border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.08); border:1px solid #d1d5db; background:white;">
        <div style="background:linear-gradient(90deg,#1e3a8a,#2563eb); color:white; padding:12px 20px; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-icons" style="font-size:24px;">business</span>
            <span style="font-weight:600; font-size:1.1rem;">${company.name}</span>
          </div>
          <button onclick="closeChecklistModal()" style="background:none; border:none; cursor:pointer; color:white; font-size:16px; font-weight:500;">ปิด</button>
        </div>
        ${sectionsHtml}
      </div>`;
  }

  modal.style.display = 'flex';
};

window.closeChecklistModal = function() {
  const modal = document.getElementById('checklist-modal');
  if (modal) modal.style.display = 'none';
};

// ==========================================
// 5. สถานะการยื่น (อ่านอย่างเดียว)
// ==========================================
function renderSubmissions(companies) {
  const tbody = document.getElementById('admin-submissions-tbody');
  tbody.innerHTML = '';

  const approvedCompanies = companies.filter(c => c.checklistStatus === 'APPROVED');

  if (approvedCompanies.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="font-size-16 text-center py-4 text-gray-400">ยังไม่มีบริษัทที่ผ่าน checklist</td></tr>';
    return;
  }

  const statusLabels = {
    NOT_SUBMITTED: 'ยังไม่ได้ยื่น',
    SUBMITTED_WAITING: 'ยื่นแล้ว รอสัมภาษณ์',
    INTERVIEWED_PENDING: 'สัมภาษณ์แล้ว รอผล',
    INTERVIEW_PASSED: 'สัมภาษณ์ผ่านแล้ว',
    INTERVIEW_FAILED_REAPPLIED: 'สัมภาษณ์ไม่ผ่าน ยื่นเพิ่มแล้ว',
  };

  approvedCompanies.forEach((c, idx) => {
    const subStatus = c.submission ? c.submission.status : 'NOT_SUBMITTED';
    const label = statusLabels[subStatus] || subStatus;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-size:16px;">${idx + 1}</td>
      <td style="font-size:16px;">${c.name}</td>
      <td style="font-size:16px;">${label}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================
// 6. ข้อมูลสถานประกอบการจาก Checklist (อ่านอย่างเดียว)
// ==========================================
function renderPlacement(placement) {
  const section = document.getElementById('admin-placement-section');
  const body = document.getElementById('admin-placement-body');
  if (!section || !body) return;

  if (!placement || !placement.companyNameTh) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  body.innerHTML = `
    <div style="margin-bottom:14px; padding:10px 16px; border-radius:10px; background:#F8FAFC; border:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div style="font-size:12.5px; color:#475569;">
        📌 ข้อมูลนี้ถูกดึงมาจากแบบประเมิน Checklist ที่นิสิตได้กรอกและยื่นผ่านระบบ
      </div>
      <a href="/advisor-checklist-review?studentId=${studentId}" style="background:#EEF2FF; color:#312E81; border:1px solid #C7D2FE; padding:6px 14px; border-radius:8px; font-size:12px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:5px;">
        <span class="material-icons" style="font-size:16px;">${isActingAsAdvisor ? 'fact_check' : 'visibility'}</span>
        ${isActingAsAdvisor ? 'ไปหน้าตรวจประเมิน Checklist' : 'ดูแบบประเมิน Checklist (อ่านอย่างเดียว)'}
      </a>
    </div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label" style="font-size:14px; font-weight:600;">ตำแหน่งที่ฝึก</label><input class="input-field" value="${placement.position || '-'}" readonly /></div>
      <div class="form-group"><label class="form-label" style="font-size:14px; font-weight:600;">ชื่อแหล่งฝึกงาน</label><input class="input-field" value="${placement.companyNameTh || '-'}" readonly /></div>
      <div class="form-group"><label class="form-label" style="font-size:14px; font-weight:600;">บุคคลที่ให้ทำหนังสือ</label><input class="input-field" value="${placement.contactPersonName || '-'}" readonly /></div>
      <div class="form-group"><label class="form-label" style="font-size:14px; font-weight:600;">ตำแหน่งบุคคล</label><input class="input-field" value="${placement.contactPersonPosition || '-'}" readonly /></div>
      <div class="form-group"><label class="form-label" style="font-size:14px; font-weight:600;">ที่อยู่บริษัท</label><input class="input-field" value="${placement.companyAddress || '-'}" readonly /></div>
      <div class="form-group"><label class="form-label" style="font-size:14px; font-weight:600;">เบอร์โทร 1</label><input class="input-field" value="${placement.companyPhone1 || '-'}" readonly /></div>
      <div class="form-group"><label class="form-label" style="font-size:14px; font-weight:600;">เบอร์โทร 2</label><input class="input-field" value="${placement.companyPhone2 || '-'}" readonly /></div>
      <div class="form-group"><label class="form-label" style="font-size:14px; font-weight:600;">Email</label><input class="input-field" value="${placement.companyEmail || '-'}" readonly /></div>
      <div class="form-group"><label class="form-label" style="font-size:14px; font-weight:600;">จังหวัด</label><input class="input-field" value="${placement.province || '-'}" readonly /></div>
    </div>
  `;
}

// ==========================================
// 7. ตรวจสอบเอกสารแบบตอบรับจากสถานประกอบการ (Acceptance Form Review)
// ==========================================
function renderAcceptanceFormReview(wf) {
  const section = document.getElementById('admin-acceptance-section');
  const body = document.getElementById('admin-acceptance-body');
  if (!section || !body) return;

  section.style.display = 'block';

  if (!wf || !wf.companyResponseFileUrl) {
    body.innerHTML = `
      <div style="text-align:center; padding:28px 16px; color:#94A3B8;">
        <span class="material-icons" style="font-size:42px; opacity:0.6; color:#CBD5E1;">hourglass_empty</span>
        <p style="margin:8px 0 0 0; font-size:13.5px; font-weight:700; color:#64748B;">
          นิสิตยังไม่ได้อัปโหลดเอกสารแบบตอบรับกลับมา
        </p>
        <p style="margin:4px 0 0 0; font-size:12px; color:#94A3B8;">
          (จะปรากฏเมื่อนิสิตนำหนังสือขอความอนุเคราะห์ไปสัมภาษณ์และอัปโหลดแบบตอบรับกลับเข้าระบบ)
        </p>
      </div>
    `;
    return;
  }

  const ocr = wf.companyResponseOcr;
  let ocrBoxHtml = '';
  if (ocr && ocr.status === 'DONE') {
    const isAccepted = ocr.result === 'ACCEPTED';
    const confPct = Math.round((Number(ocr.confidence) || 0.85) * 100);
    ocrBoxHtml = `
      <div style="background:${isAccepted ? '#ECFDF5' : '#FEF2F2'}; border:1px solid ${isAccepted ? '#6EE7B7' : '#FCA5A5'}; border-radius:10px; padding:10px 14px; margin:12px 0;">
        <div style="font-size:13px; font-weight:800; color:${isAccepted ? '#065F46' : '#991B1B'}; display:flex; align-items:center; gap:6px;">
          <span>🤖 ผลการวิเคราะห์ AI OCR:</span>
          <span>คาดว่า "${isAccepted ? 'บริษัทตอบรับเข้าฝึกงาน' : 'บริษัทปฏิเสธ'}" (${confPct}%)</span>
        </div>
        ${(ocr.reasons && ocr.reasons[0]) ? `<div style="font-size:12px; color:${isAccepted ? '#047857' : '#B91C1C'}; margin-top:3px;">${ocr.reasons[0]}</div>` : ''}
      </div>
    `;
  }

  const status = wf.companyResponseStatus;
  const isPendingAdvisor = status === 'WAITING_ADVISOR_APPROVAL';
  const isAdvisorApproved = status === 'ADVISOR_APPROVED';
  const isAccepted = status === 'ACCEPTED';
  const isRejected = status === 'REJECTED';

  body.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px; padding-bottom:14px; border-bottom:1px solid #E2E8F0;">
      <div>
        <div style="font-size:15px; font-weight:800; color:#1E1B4B;">
          🏢 สถานประกอบการ: ${wf.companyName || 'ไม่ระบุ'}
        </div>
        <div style="font-size:12px; color:#64748B; margin-top:2px;">
          อัปโหลดเมื่อ: ${wf.companyResponseUploadedAt ? new Date(wf.companyResponseUploadedAt).toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '-'}
        </div>
      </div>
      <div>
        <a href="${wf.companyResponseFileUrl}" target="_blank" rel="noopener" style="background:#EEF2FF; color:#312E81; border:1px solid #C7D2FE; padding:8px 16px; border-radius:10px; font-size:13px; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(49,46,129,0.1);">
          <span class="material-icons" style="font-size:18px;">visibility</span> 👁️ เปิดดูใบตอบรับที่นิสิตแนบ (${wf.companyResponseFileName || 'ไฟล์เอกสาร'})
        </a>
      </div>
    </div>

    ${ocrBoxHtml}

    <div style="margin-top:14px;">
      ${isPendingAdvisor ? (
        isActingAsAdvisor ? `
        <div style="padding:16px 20px; background:#FFFBEB; border:1.5px solid #FCD34D; border-radius:14px;">
          <div style="font-size:13.5px; font-weight:800; color:#B45309; display:flex; align-items:center; gap:8px;">
            <span class="material-icons" style="font-size:22px; color:#D97706;">hourglass_top</span>
            <span>สถานะ: นิสิตอัปโหลดแบบตอบรับแล้ว — รออาจารย์ที่ปรึกษาตรวจประเมิน</span>
          </div>
          <p style="font-size:12px; color:#92400E; margin:4px 0 14px 30px;">
            กรุณาเปิดตรวจสอบเอกสารใบตอบรับด้านบน หากถูกต้องให้อนุมัติเพื่อส่งต่อให้ Super Admin ดำเนินการออกหนังสือส่งตัว
          </p>

          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; padding-left:30px;">
            <input type="text" id="admin-detail-acceptance-note" placeholder="หมายเหตุ / คำแนะนำ (ถ้ามี)..." class="input-field" style="flex:1; min-width:240px; font-size:12.5px; padding:8px 12px; background:white;" />
            <button type="button" onclick="window.submitAdvisorAcceptanceReview('APPROVED')" style="background:#10B981; color:white; border:none; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(16,185,129,0.3);">
              <span class="material-icons" style="font-size:18px;">check_circle</span> ✓ อนุมัติแบบตอบรับ
            </button>
            <button type="button" onclick="window.submitAdvisorAcceptanceReview('REJECTED')" style="background:#EF4444; color:white; border:none; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(239,68,68,0.3);">
              <span class="material-icons" style="font-size:18px;">cancel</span> ✗ ไม่อนุมัติ / บริษัทปฏิเสธ
            </button>
          </div>
        </div>
        ` : `
        <div style="padding:14px 18px; background:#FFFBEB; border:1px solid #FCD34D; border-radius:12px; display:flex; align-items:center; gap:10px;">
          <span class="material-icons" style="color:#D97706; font-size:24px;">hourglass_top</span>
          <div>
            <div style="font-size:13.5px; font-weight:800; color:#B45309;">
              ⏳ อยู่ระหว่างรออาจารย์ที่ปรึกษาตรวจประเมินแบบตอบรับ
            </div>
            <div style="font-size:12px; color:#92400E; margin-top:2px;">
              นิสิตได้อัปโหลดเอกสารแบบตอบรับแล้ว การตรวจและอนุมัติแบบตอบรับในขั้นตอนนี้เป็นหน้าที่ของอาจารย์ที่ปรึกษา (สิทธิ์อ่านอย่างเดียว)
            </div>
          </div>
        </div>
        `
      ) : isAdvisorApproved ? `
        <div style="padding:14px 18px; background:#ECFDF5; border:1px solid #6EE7B7; border-radius:12px; display:flex; align-items:center; gap:10px;">
          <span class="material-icons" style="color:#059669; font-size:24px;">verified</span>
          <div>
            <div style="font-size:13.5px; font-weight:800; color:#065F46;">
              ✓ อาจารย์ที่ปรึกษาอนุมัติแบบตอบรับเรียบร้อยแล้ว
            </div>
            <div style="font-size:12px; color:#047857; margin-top:2px;">
              ส่งต่อไปยังคิวของ Super Admin (พี่จอม) เพื่อออกหนังสือส่งตัวเรียบร้อยแล้ว
              ${wf.advisorAcceptanceNote ? ` • หมายเหตุ: "${wf.advisorAcceptanceNote}"` : ''}
            </div>
          </div>
        </div>
      ` : isAccepted ? `
        <div style="padding:14px 18px; background:#ECFDF5; border:1px solid #6EE7B7; border-radius:12px; display:flex; align-items:center; gap:10px;">
          <span class="material-icons" style="color:#059669; font-size:24px;">task_alt</span>
          <div style="font-size:13.5px; font-weight:800; color:#065F46;">
            ✓ บริษัทตอบรับเข้าฝึกงานอย่างเป็นทางการและเจ้าหน้าที่ได้ยืนยันเรียบร้อยแล้ว
          </div>
        </div>
      ` : isRejected ? `
        <div style="padding:14px 18px; background:#FEF2F2; border:1px solid #FCA5A5; border-radius:12px; display:flex; align-items:center; gap:10px;">
          <span class="material-icons" style="color:#DC2626; font-size:24px;">highlight_off</span>
          <div>
            <div style="font-size:13.5px; font-weight:800; color:#991B1B;">
              ✗ แบบตอบรับไม่ผ่าน / บริษัทปฏิเสธ (บันทึกประวัติเข้า Archive แล้ว)
            </div>
            <div style="font-size:12px; color:#B91C1C; margin-top:2px;">
              ระบบได้ปลดล็อกให้นิสิตยื่นขอฝึกงานกับสถานประกอบการแห่งใหม่แล้ว
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

window.submitAdvisorAcceptanceReview = async function(status) {
  const noteEl = document.getElementById('admin-detail-acceptance-note') as HTMLInputElement | null;
  const note = noteEl?.value?.trim() || '';
  if (status === 'REJECTED' && !confirm('ยืนยันไม่อนุมัติแบบตอบรับนี้ใช่หรือไม่? ระบบจะบันทึกประวัติเข้า Archive และปลดล็อกให้นิสิตยื่นบริษัทใหม่')) {
    return;
  }
  try {
    const res = await fetch('/api/advisor/documents/review-acceptance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, status, note }),
    });
    const data = await res.json();
    if (data.success) {
      alert('✅ ' + data.message);
      initStudentDetail();
    } else {
      alert('เกิดข้อผิดพลาด: ' + (data.message || 'บันทึกไม่สำเร็จ'));
    }
  } catch (err) {
    console.error(err);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
  }
};

// ==========================================
// 7. สรุปข้อมูลเอกสาร
// ==========================================
function renderDocumentSummary(data) {
  const body = document.getElementById('admin-summary-body');
  const s = data.student;
  const cv = data.cv;
  const ts = data.trainingSummary;
  const companies = data.companies;
  const placement = data.placement;

  const cvStatus = cv ? (cv.state === 'COMMENTED' ? '✅ อัปโหลดแล้ว · 💬 อาจารย์คอมเมนต์แล้ว' : '✅ อัปโหลดแล้ว · รอคอมเมนต์') : '❌ ยังไม่ได้อัปโหลด';
  const trainingStatus = (ts.approvedSoft >= 12 && ts.approvedHard >= 18) ? '✅ ครบ 30 ชม.' : `⏳ Soft ${ts.approvedSoft}/12 | Hard ${ts.approvedHard}/18`;
  const checklistApproved = companies.filter(c => c.checklistStatus === 'APPROVED').length;
  const interviewPassed = companies.filter(c => c.submission && c.submission.status === 'INTERVIEW_PASSED').length;
  const placementStatus = placement ? (placement.status === 'APPROVED' ? '✅ อนุมัติแล้ว' : placement.status === 'REJECTED' ? '❌ ไม่อนุมัติ' : '⏳ รอผล') : '❌ ยังไม่ได้กรอก';

  body.innerHTML = `
    <table class="data-table" style="font-size:16px;">
      <tbody>
        <tr><td style="font-weight:600; width:220px;">ชื่อ-สกุล</td><td>${s.nameTh} (${s.nameEn || '-'})</td></tr>
        <tr><td style="font-weight:600;">รหัสนิสิต</td><td>${s.studentCode}</td></tr>
        <tr><td style="font-weight:600;">สาขา / ชั้นปี</td><td>${s.major || '-'} / ปี ${s.year || '-'}</td></tr>
        <tr><td style="font-weight:600;">GPA</td><td>${s.gpa ? Number(s.gpa).toFixed(2) : '-'}</td></tr>
        <tr><td style="font-weight:600;">อาจารย์ที่ปรึกษา</td><td>${s.advisorName || '-'}</td></tr>
        <tr><td colspan="2" style="padding-top:14px; border-top:2px solid #e2e8f0;"></td></tr>
        <tr><td style="font-weight:600;">สถานะ CV</td><td>${cvStatus}</td></tr>
        <tr><td style="font-weight:600;">ชั่วโมงอบรม (ที่ผ่านแล้ว)</td><td>${trainingStatus}</td></tr>
        <tr><td style="font-weight:600;">Checklist ผ่าน</td><td>${checklistApproved > 0 ? `✅ ${checklistApproved} บริษัท` : '❌ ยังไม่มี'}</td></tr>
        <tr><td style="font-weight:600;">สัมภาษณ์ผ่าน</td><td>${interviewPassed > 0 ? `✅ ${interviewPassed} บริษัท` : '❌ ยังไม่มี'}</td></tr>
        <tr><td style="font-weight:600;">สถานะอนุมัติที่ฝึกงาน</td><td>${placementStatus}</td></tr>
      </tbody>
    </table>
  `;
}

// เริ่มโหลด
initStudentDetail();

// ⚡ เมื่อมีสัญญาณ Real-time จาก Socket.io ให้อัปเดตรายละเอียดนิสิตทันที
window.addEventListener('app:data-updated', () => {
  initStudentDetail();
});

// สหกิจศึกษา: บริษัทที่นิสิตสมัคร + สถานะ + ขั้นเอกสาร (อ่านอย่างเดียว ทุกบทบาท)
function renderCoopSummary(coop) {
  const section = document.getElementById('student-coop-section');
  const body = document.getElementById('student-coop-body');
  if (!section || !body || !coop || (!coop.active && !(coop.history || []).length)) return;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const thDate = (v) => (v ? new Date(v).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const color = { SUBMITTED: '#92400E', SENT_TO_COMPANY: '#075985', ACCEPTED: '#166534', REJECTED: '#991B1B', CANCELLED: '#475569' };
  let html = '';
  const a = coop.active;
  if (a) {
    html += `<div style="padding:12px 14px; border:1px solid #DDD6FE; background:#F5F3FF; border-radius:12px; font-size:13px; color:#1E293B; line-height:1.7;">
      <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;">
        <div><strong>${esc(a.companyName)}</strong> · ${esc(a.positionTitle)}</div>
        <span style="font-weight:800; color:${color[a.status] || '#334155'};">${esc(a.statusLabel)}</span>
      </div>
      <div style="font-size:12px; color:#64748B;">สมัครเมื่อ ${esc(thDate(a.createdAt))}${a.statusNote ? ` · หมายเหตุ: ${esc(a.statusNote)}` : ''}</div>
      ${a.status === 'ACCEPTED' ? `<div style="display:flex; flex-direction:column; gap:3px; margin-top:8px;">
        ${(a.docSteps || []).map((d) => `<div style="font-size:12.5px; color:${d.done ? '#166534' : '#94A3B8'};">
          ${d.done ? '✓' : '○'} ${esc(d.label)}${d.done && d.at ? ` (${esc(thDate(d.at))})` : ''}
          ${d.url ? ` · <a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer" style="color:#4338CA; font-weight:600;">เปิดไฟล์</a>` : ''}
        </div>`).join('')}
      </div>` : ''}
      <div style="font-size:11.5px; color:#64748B; margin-top:6px;">เจ้าหน้าที่ฝ่ายฝึกงานดำเนินการเอกสารสหกิจ — อาจารย์ที่ปรึกษาไม่ต้องอนุมัติ</div>
    </div>`;
  }
  const history = coop.history || [];
  if (history.length) {
    html += `<details style="margin-top:${a ? 10 : 0}px;" ${a ? '' : 'open'}>
      <summary style="cursor:pointer; font-size:12.5px; font-weight:700; color:#475569;">ประวัติใบสมัครสหกิจ (ไม่ผ่าน / ยกเลิก) (${history.length})</summary>
      ${history.map((h) => `<div style="margin-top:6px; padding:8px 12px; border:1px solid #E2E8F0; border-radius:10px; background:#F8FAFC; font-size:12.5px;">
        <strong>${esc(h.companyName)}</strong> · ${esc(h.positionTitle)} · <span style="font-weight:700; color:${color[h.status] || '#334155'};">${esc(h.statusLabel)}</span>
        <span style="color:#94A3B8;">(สมัคร ${esc(thDate(h.createdAt))})</span>
        ${h.statusNote ? `<div style="color:#475569;">เหตุผล: ${esc(h.statusNote)}</div>` : ''}
      </div>`).join('')}
    </details>`;
  }
  body.innerHTML = html;
  section.style.display = 'block';
}

