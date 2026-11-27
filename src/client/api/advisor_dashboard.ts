// @ts-nocheck
// ===== รายชื่อสาขากลาง: อ่านจาก <script id="ict-majors-data"> ที่หน้าเพจฝังมา (ต้นทาง: src/utils/majors.ts) =====
let ictMajorsCache = null;
function getIctMajors() {
  if (ictMajorsCache) return ictMajorsCache;
  try {
    const el = document.getElementById('ict-majors-data');
    ictMajorsCache = el ? JSON.parse(el.textContent || '[]') : [];
  } catch (e) {
    ictMajorsCache = [];
  }
  return ictMajorsCache;
}

function findIctMajor(raw?: string | null) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return null;
  const majors = getIctMajors();
  return majors.find(m => m.code.toLowerCase() === v)
    || majors.find(m => m.keywords.some(k => v.includes(k.toLowerCase())))
    || null;
}

function formatMajorName(major?: string | null): string {
  if (!major) return '-';
  const found = findIctMajor(major);
  if (found) return `${found.name} (${found.code})`;
  return major.replace(/^(สาขาวิชา|สาขา)/, '').trim() || major;
}

function fullMajorName(major?: string | null): string {
  const found = findIctMajor(major);
  return found ? found.fullName : (major || '-');
}

let currentFilter = null;
let currentPage = 1;
const pageLimit = 12;
let selectedStudentIds = new Set();
let openDropdownStudentId = null;
let totalAdvisorStudents = 0;
let currentFilteredCount = 0;
let currentRoleMode = new URLSearchParams(window.location.search).get('roleMode') === 'SUPERVISOR' ? 'SUPERVISOR' : 'ADVISOR';

function updateAdvisorModeButtonsUI() {
  const btnAdv = document.getElementById('btn-mode-advisor');
  const btnSup = document.getElementById('btn-mode-supervisor');
  const mainTitle = document.getElementById('advisor-dashboard-main-title');
  const tableTitle = document.getElementById('advisor-table-title');

  if (currentRoleMode === 'SUPERVISOR') {
    if (btnAdv) {
      btnAdv.style.background = 'transparent';
      btnAdv.style.color = '#FFFFFF';
    }
    if (btnSup) {
      btnSup.style.background = '#FFFFFF';
      btnSup.style.color = '#1E1B4B';
    }
    if (mainTitle) mainTitle.textContent = 'ระบบติดตามดูแลนิสิตฝึกงาน (ในฐานะอาจารย์นิเทศก์)';
    if (tableTitle) tableTitle.textContent = 'รายชื่อนิสิตในการนิเทศ';
  } else {
    if (btnAdv) {
      btnAdv.style.background = '#FFFFFF';
      btnAdv.style.color = '#1E1B4B';
    }
    if (btnSup) {
      btnSup.style.background = 'transparent';
      btnSup.style.color = '#FFFFFF';
    }
    if (mainTitle) mainTitle.textContent = 'ระบบติดตามดูแลนิสิตฝึกงาน (เฉพาะนิสิตในความรับผิดชอบ)';
    if (tableTitle) tableTitle.textContent = 'รายชื่อนิสิตในที่ปรึกษา';
  }
}

window.switchAdvisorViewMode = async function(mode) {
  currentRoleMode = mode === 'SUPERVISOR' ? 'SUPERVISOR' : 'ADVISOR';
  try {
    await fetch('/auth/switch-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleMode: currentRoleMode })
    });
  } catch (_) {}
  const url = new URL(window.location.href);
  url.searchParams.set('roleMode', currentRoleMode);
  window.history.replaceState({}, '', url.toString());
  updateAdvisorModeButtonsUI();
  currentPage = 1;
  await loadDashboardSummary();
  await loadStudents();
};

window.filterByAdvisorNotification = function(filterType) {
  const statusEl = document.getElementById('status-filter');
  if (filterType === 'checklist_pending' && statusEl) {
    statusEl.value = 'checklist_pending';
    currentFilter = null;
    currentPage = 1;
    updateFilterUI();
    loadStudents();
  } else if (filterType === 'placement_pending') {
    currentFilter = null;
    if (statusEl) statusEl.value = '';
    currentPage = 1;
    updateFilterUI();
    loadStudents();
  }
};

// ==========================================
// เริ่มต้นโหลดข้อมูล
// ==========================================
async function initAdvisorDashboard() {
  try {
    const meRes = await fetch('/auth/me');
    const meData = await meRes.json();
    if (meData.authenticated && meData.user) {
      const switcher = document.getElementById('advisor-mode-switcher');
      if (switcher && meData.user.isSupervisor) {
        switcher.style.display = 'inline-flex';
      }
      if (!new URLSearchParams(window.location.search).get('roleMode') && meData.user.activeRoleMode === 'SUPERVISOR') {
        currentRoleMode = 'SUPERVISOR';
      }
      updateAdvisorModeButtonsUI();
    }
  } catch (_) {}
  await loadDashboardSummary();
  // เติม dropdown ชั้นปีก่อน เพื่อให้ค่า default (นิสิตปี 3 ปัจจุบัน) มีผลตั้งแต่โหลดตารางครั้งแรก
  await populateYearFilter('/api/advisor/students');
  updateFilterUI();
  await loadStudents();
}

// ==========================================
// 1. โหลดข้อมูลสรุป (กราฟ 2 วง) — เรียกครั้งแรกตอนโหลดหน้า (ยังไม่มี filter)
// ==========================================
async function loadDashboardSummary() {
  try {
    const res = await fetch(`/api/advisor/dashboard-summary?roleMode=${currentRoleMode}`);
    const data = await res.json();
    if (!data.success) return;
    totalAdvisorStudents = data.totalStudents ?? 0;
    const totalEl = document.getElementById('notif-total-advisees');
    const pendChkEl = document.getElementById('notif-pending-checklist');
    const pendPlcEl = document.getElementById('notif-pending-placement');
    const mismatchEl = document.getElementById('notif-mismatch-placement');
    if (totalEl) totalEl.textContent = data.totalStudents ?? 0;
    if (pendChkEl) pendChkEl.textContent = data.notifications?.pendingChecklistCount ?? (data.checklistStats?.pending ?? 0);
    if (pendPlcEl) pendPlcEl.textContent = data.notifications?.pendingPlacementCount ?? 0;
    if (mismatchEl) mismatchEl.textContent = data.notifications?.mismatchedPlacementCount ?? 0;
    renderDashboardCharts(data.checklistStats, data.readinessStats, data.totalStudents);
  } catch (err) {
    console.error('Load advisor dashboard summary error:', err);
  }
}

// วาดกราฟ 2 วงจากสถิติที่ได้รับมา (ใช้ทั้งตอนโหลดครั้งแรก และทุกครั้งที่ loadStudents คืนค่า chartStats ที่ผ่าน filter แล้ว)
function renderDashboardCharts(checklistStats, readinessStats, totalStudents) {
  const c = checklistStats;
  const checklistTotal = c.reviewed + c.pending + c.failed;
  renderPieChart('chart-checklist', 'checklist', [
    { key: 'reviewed', label: 'อาจารย์รีวิวแล้ว', value: c.reviewed, color: '#FF3EA5' },
    { key: 'pending', label: 'รอผล', value: c.pending, color: '#FFD233' },
    { key: 'failed', label: 'ไม่ผ่าน /ทำchecklist เพิ่ม', value: c.failed, color: '#EF4444' },
  ], 'สถานะ Checklist', 'checklist-legend-table', checklistTotal || totalStudents);

  const r = readinessStats;
  renderPieChart('chart-readiness', 'readiness', [
    { key: 'registered', label: 'ยื่นสมัครสำเร็จ', value: r.registered, color: '#00C3D0' },
    { key: 'cvUploaded', label: 'มี CV แล้ว', value: r.cvUploaded || 0, color: '#8B5CF6' },
    { key: 'noData', label: 'ยังไม่มีข้อมูล', value: r.noData, color: '#FF3EA5' },
    { key: 'hoursIncomplete', label: 'ชั่วโมงอบรมยังไม่ครบ', value: r.hoursIncomplete, color: '#FFD233' },
    { key: 'trainingComplete', label: 'ตรวจชม.อบรมครบ', value: r.trainingComplete, color: '#10B981' },
  ], 'สถานะความพร้อม', 'readiness-legend-table', totalStudents);
}

// ==========================================
// สร้างกราฟวงกลม SVG + ตารางสถานะ
// ==========================================
function renderPieChart(containerId, chartType, segments, headerLabel, tableId, total) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let cumulativeOffset = 0;
  const circumference = 2 * Math.PI * 14; // r=14

  let svgCircles = '';
  segments.forEach((seg) => {
    const pct = total > 0 ? (seg.value / total) * 100 : 0;
    const dashLen = (pct / 100) * circumference;
    const dashGap = circumference - dashLen;
    const offset = -(cumulativeOffset / 100) * circumference;

    if (pct > 0) {
      svgCircles += `<circle cx="18" cy="18" r="14" fill="none" stroke="${seg.color}" stroke-width="4"
        stroke-dasharray="${dashLen} ${dashGap}" stroke-dashoffset="${offset}" />`;
    }
    cumulativeOffset += pct;
  });

  if (total === 0 || cumulativeOffset === 0) {
    svgCircles = `<circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" stroke-width="4" />`;
  }

  container.innerHTML = `
    <h4 class="text-xs font-bold text-blue-700 mb-2 text-center">${headerLabel}</h4>
    <div class="flex flex-col sm:flex-row items-center gap-6 flex-1">
      <div class="relative w-[120px] h-[120px] flex-shrink-0">
        <svg viewBox="0 0 36 36" class="w-full h-full -rotate-90">
          ${svgCircles}
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-[10px] text-gray-400">Total Value</span>
          <span class="text-xl font-bold text-gray-800">${total}</span>
        </div>
      </div>
      <table class="text-[11px] border-collapse flex-1" id="${tableId}">
        <thead>
          <tr>
            <th class="text-left pr-4 pb-1 font-medium text-gray-600">${headerLabel}</th>
            <th class="text-right pr-4 pb-1 font-medium text-gray-600">จำนวน</th>
            <th class="text-right pb-1 font-medium text-gray-600">%</th>
          </tr>
        </thead>
        <tbody>
          ${segments.map((seg) => {
            const pct = total > 0 ? ((seg.value / total) * 100).toFixed(1) : '0.0';
            return `<tr class="chart-status-row cursor-pointer hover:bg-purple-50 transition-colors" data-chart="${chartType}" data-key="${seg.key}" data-label="${seg.label}">
              <td class="pr-4 py-1">
                <span class="inline-block w-2 h-2 rounded-full mr-1.5" style="background:${seg.color}"></span>${seg.label}
              </td>
              <td class="text-right pr-4">${seg.value}</td>
              <td class="text-right">${pct}%</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // คงไฮไลต์แถวที่กำลังกรองอยู่ (ถ้ามี) แม้กราฟจะถูก re-render ใหม่ทุกครั้งที่ filter เปลี่ยน
  if (currentFilter && currentFilter.chartType === chartType) {
    const activeRow = container.querySelector(`.chart-status-row[data-key="${currentFilter.chartKey}"]`);
    if (activeRow) activeRow.classList.add('bg-purple-100', 'font-bold');
  }

  // Event: คลิกแถวในตารางเพื่อกรองนิสิต
  container.querySelectorAll('.chart-status-row').forEach(row => {
    row.addEventListener('click', () => {
      const isAlreadyActive = row.classList.contains('bg-purple-100');
      document.querySelectorAll('.chart-status-row').forEach(r => r.classList.remove('bg-purple-100', 'font-bold'));

      if (isAlreadyActive) {
        currentFilter = null;
      } else {
        row.classList.add('bg-purple-100', 'font-bold');
        currentFilter = {
          chartType: row.dataset.chart,
          chartKey: row.dataset.key,
          label: row.dataset.label,
        };
        clearSearchBox();
      }
      currentPage = 1;
      updateFilterUI();
      loadStudents();
    });
  });
}

// ==========================================
// 2. โหลดรายชื่อนิสิต
// ==========================================
async function loadStudents() {
  try {
    const searchInput = document.getElementById('student-search');
    const searchVal = searchInput ? searchInput.value.trim() : '';

    let url = `/api/advisor/students?page=${currentPage}&limit=${pageLimit}&roleMode=${currentRoleMode}`;
    if (searchVal) url += `&search=${encodeURIComponent(searchVal)}`;
    if (currentFilter) {
      url += `&chartType=${encodeURIComponent(currentFilter.chartType)}&chartKey=${encodeURIComponent(currentFilter.chartKey)}`;
    }
    const yearFilter = document.getElementById('year-filter') as HTMLSelectElement | null;
    const selectedYear = yearFilter ? yearFilter.value : '';
    if (selectedYear) url += `&yearPrefix=${encodeURIComponent(selectedYear)}`;

    const semesterFilter = document.getElementById('semester-filter') as HTMLSelectElement | null;
    const selectedSemester = semesterFilter ? semesterFilter.value : '';
    if (selectedSemester) url += `&semester=${encodeURIComponent(selectedSemester)}`;

    // Dropdown filters ใหม่
    const statusFilter = document.getElementById('status-filter');
    const skillFilter = document.getElementById('skill-filter');
    if (statusFilter && statusFilter.value) url += `&statusFilter=${encodeURIComponent(statusFilter.value)}`;
    if (skillFilter && skillFilter.value) url += `&skillFilter=${encodeURIComponent(skillFilter.value)}`;
    const sortBy = (document.getElementById('sort-by') as HTMLSelectElement | null)?.value || 'critical';
    url += `&sortBy=${encodeURIComponent(sortBy)}`;

    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) return;

    if (data.chartStats) {
      renderDashboardCharts(data.chartStats.checklistStats, data.chartStats.readinessStats, data.chartStats.totalStudents);
    }

    let studentsToRender = data.students || [];
    let totalToRender = data.total;
    // Fallback: กรองฝั่ง client-side
    if (selectedYear) {
      studentsToRender = studentsToRender.filter(s => s.studentCode && s.studentCode.startsWith(selectedYear));
      totalToRender = studentsToRender.length;
    }
    if (selectedSemester) {
      studentsToRender = studentsToRender.filter(s => (s.semester || '2') === selectedSemester);
      totalToRender = studentsToRender.length;
    }
    currentFilteredCount = totalToRender;
    if (!totalAdvisorStudents && data.chartStats) {
      totalAdvisorStudents = data.chartStats.totalStudents;
    }

    renderStudentTable(studentsToRender, totalToRender, data.page, Math.max(1, Math.ceil(totalToRender / pageLimit)));
  } catch (err) {
    console.error('Load students error:', err);
  }
}

// ==========================================
// 3. แสดงตารางรายชื่อนิสิต
// ==========================================
// ข้อมูลตารางชุดล่าสุด (ใช้วาดแถวใหม่หลังตรวจแบบตอบรับใน Lightbox โดยไม่ต้องโหลดทั้งหน้า)
let lastStudentTableArgs = null;

// เปิด Lightbox ตรวจแบบตอบรับ (components/acceptance_review.js) ถ้าโหลดคอมโพเนนต์ไม่ได้ → ไปหน้า Checklist Review ตามลิงก์เดิม
window.openAcceptanceLightbox = function(event, studentId) {
  const reviewer = window.IctAcceptanceReview;
  if (!reviewer || typeof reviewer.open !== 'function') return true;
  if (event) { event.preventDefault(); event.stopPropagation(); }
  closeActionMenus();
  reviewer.open({
    studentId,
    onDone: (status) => {
      applyAcceptanceResultToRow(studentId, status);
      loadDashboardSummary();
    },
  });
  return false;
};

// อัปเดตแถวของนิสิตตามผลที่บันทึก (ตรงกับที่ server เปลี่ยนใน /documents/review-acceptance)
function applyAcceptanceResultToRow(studentId, status) {
  if (!lastStudentTableArgs) return;
  const s = lastStudentTableArgs[0].find((x) => x.id === studentId);
  if (!s) return;
  s.hasPendingAcceptance = false;
  if (status === 'APPROVED') {
    s.acceptanceStatus = 'ADVISOR_APPROVED';
  } else {
    // ไม่อนุมัติ → server ย้ายเข้า Archive, ล้างข้อมูลบริษัท และตั้งที่ฝึกงานเป็น REJECTED
    s.acceptanceStatus = 'REJECTED';
    if (s.placementStatus !== 'NONE') s.placementStatus = 'REJECTED';
  }
  renderStudentTable(...lastStudentTableArgs);
}

function renderStudentTable(students, total, page, totalPages) {
  lastStudentTableArgs = [students, total, page, totalPages];
  const tbody = document.getElementById('students-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  // เมนู ⋮ ที่เคยย้ายไปไว้ใต้ body (positionActionMenu) ลบทิ้งก่อน กัน id ซ้ำกับแถวชุดใหม่
  document.querySelectorAll('.action-dropdown[data-portal]').forEach((d) => d.remove());

  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-gray-400">ไม่พบข้อมูลนิสิต</td></tr>';
    renderPagination(1, 1, 0);
    return;
  }

  students.forEach((s) => {
    const isChecked = selectedStudentIds.has(s.id);
    let badgeColor = 'bg-yellow-100 text-yellow-700';
    let badgeText = s.checklistStatusLabel;

    if (s.checklistStatusCode === 'APPROVED') {
      badgeColor = 'bg-green-100 text-green-700';
    } else if (s.checklistStatusCode === 'REJECTED') {
      badgeColor = 'bg-red-100 text-red-600';
    }

    // สร้างป้ายเตือนเฉพาะจุด (Alert / Context tag) เมื่อมีประเด็นเรื่องชั่วโมงหรือเมื่อใช้ฟิลเตอร์
    const alertTags = [];
    const softHours = s.trainingApprovedSoft || 0;
    const hardHours = s.trainingApprovedHard || 0;
    const softLack = softHours < 12;
    const hardLack = hardHours < 18;

    const currentSkillFilter = document.getElementById('skill-filter')?.value;
    if (currentSkillFilter === 'lack_soft' && softLack) {
      alertTags.push(`<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-amber-50 text-amber-800 border border-amber-200">
        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> ขาด Soft (${softHours}/12 ชม.)
      </span>`);
    } else if (currentSkillFilter === 'lack_hard' && hardLack) {
      alertTags.push(`<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-amber-50 text-amber-800 border border-amber-200">
        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> ขาด Hard (${hardHours}/18 ชม.)
      </span>`);
    } else if (currentSkillFilter === 'lack_both' && (softLack || hardLack)) {
      alertTags.push(`<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-amber-50 text-amber-800 border border-amber-200">
        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> ขาด Soft (${softHours}/12) + Hard (${hardHours}/18)
      </span>`);
    } else if (!s.isTrainingComplete && (s.checklistStatusCode === 'APPROVED' || s.hasCv || s.placementStatus === 'APPROVED')) {
      if (softLack && hardLack) {
        alertTags.push(`<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-rose-50 text-rose-700 border border-rose-200" title="Soft: ${softHours}/12, Hard: ${hardHours}/18 ชม.">
          ⚠️ ตกเกณฑ์อบรม (Soft ${softHours}/12, Hard ${hardHours}/18)
        </span>`);
      } else if (softLack) {
        alertTags.push(`<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-amber-50 text-amber-800 border border-amber-200" title="Soft: ${softHours}/12 ชม.">
          ⚠️ ขาด Soft (${softHours}/12 ชม.)
        </span>`);
      } else if (hardLack) {
        alertTags.push(`<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-amber-50 text-amber-800 border border-amber-200" title="Hard: ${hardHours}/18 ชม.">
          ⚠️ ขาด Hard (${hardHours}/18 ชม.)
        </span>`);
      }
    }

    const tr = document.createElement('tr');
    if (isChecked) tr.classList.add('adv-row--selected');
    tr.innerHTML = `
      <td class="adv-col-check">
        <input type="checkbox" class="student-checkbox" data-id="${s.id}" ${isChecked ? 'checked' : ''} aria-label="เลือก ${s.nameTh || s.studentCode}" />
      </td>
      <td>
        <div class="adv-stu-meta">
          <span class="adv-stu-code">${s.studentCode}</span>
          <span class="adv-tag adv-tag--term" title="รอบฝึกงาน: ${s.semester === 'SUMMER' ? 'Summer' : 'เทอม ' + (s.semester || '2')}">${(s.studentCode ? s.studentCode.substring(0, 2) : '67') + '/' + (s.semester || '2')}</span>
          ${s.roundInfo && s.roundInfo.currentRound >= 2 ? `<span class="adv-tag adv-tag--round" title="รอบที่ 2 (${s.roundInfo.currentTerm || ''})">รอบ 2</span>` : ''}
        </div>
      </td>
      <td><a class="adv-stu-name" href="/admin-student-detail?id=${s.id}">${s.nameTh || '-'}</a></td>
      <td><span class="adv-major" title="${fullMajorName(s.major)}">${formatMajorName(s.major)}</span></td>
      <td>
        <div class="flex flex-col items-start gap-1 py-0.5">
          <span class="inline-block px-3 py-1 text-[13px] font-semibold rounded-full ${badgeColor}">
            ${badgeText}
          </span>
          ${alertTags.join('')}
        </div>
      </td>
      <td>
        <div class="adv-plc">
          ${advisorPlacementCell(s)}
          ${s.coop ? `
            <span class="adv-plc-chip adv-plc-chip--coop"
              title="สหกิจศึกษา (เจ้าหน้าที่ดำเนินการ — อาจารย์ไม่ต้องอนุมัติ): ${advisorCoopEsc(s.coop.companyName)} · ${advisorCoopEsc(s.coop.positionTitle)}">
              <span class="material-icons" aria-hidden="true">school</span>
              สหกิจ: ${advisorCoopEsc(s.coop.companyName)} · ${advisorCoopEsc(s.coop.status === 'ACCEPTED' ? s.coop.docStepLabel : s.coop.statusLabel)}
            </span>
          ` : ''}
        </div>
      </td>
      <td class="adv-col-act">
        <div style="display: flex; align-items: center; justify-content: flex-end; position: relative;">
          <button type="button" class="btn-detail-dots adv-dots" title="เมนูจัดการ" aria-label="เมนูจัดการ" onclick="toggleActionMenu(event, ${s.id})">
            <span class="material-icons">more_vert</span>
          </button>

          <!-- Dropdown เมนู (Profile / Check list / ตรวจแบบตอบรับ) -->
          <div id="dropdown-${s.id}" class="action-dropdown hidden absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1 w-44 text-left">
            <a href="/admin-student-detail?id=${s.id}" class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 no-underline transition-colors">
              <span class="material-icons text-base">person</span> Profile นิสิต
            </a>
            <div class="border-t border-gray-100 my-1"></div>
            <a href="/advisor-checklist-review?studentId=${s.id}" class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 no-underline transition-colors font-medium">
              <span class="material-icons text-base">fact_check</span> ตรวจ Checklist
            </a>
            ${s.hasPendingAcceptance ? `
              <div class="border-t border-gray-100 my-1"></div>
              <a href="/advisor-checklist-review?studentId=${s.id}" onclick="return window.openAcceptanceLightbox(event, ${s.id})" class="flex items-center gap-2 px-3 py-2 text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100 no-underline transition-colors font-bold">
                <span class="material-icons text-base text-indigo-600">assignment_turned_in</span> ตรวจแบบตอบรับ
              </a>
            ` : ''}
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Checkbox change events
  tbody.querySelectorAll('.student-checkbox').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const id = parseInt(e.target.dataset.id);
      if (e.target.checked) {
        selectedStudentIds.add(id);
      } else {
        selectedStudentIds.delete(id);
      }
      e.target.closest('tr')?.classList.toggle('adv-row--selected', e.target.checked);
      updateSelectAllCheckbox();
    });
  });

  const selectAllCheckbox = document.getElementById('select-all-students');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      tbody.querySelectorAll('.student-checkbox').forEach(cb => {
        cb.checked = e.target.checked;
        cb.closest('tr')?.classList.toggle('adv-row--selected', e.target.checked);
        const id = parseInt(cb.dataset.id);
        if (e.target.checked) {
          selectedStudentIds.add(id);
        } else {
          selectedStudentIds.delete(id);
        }
      });
      updateSelectAllCheckbox();
    });
    updateSelectAllCheckbox();
  }

  renderPagination(page, totalPages, total);
}

function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('select-all-students');
  const visibleCheckboxes = document.querySelectorAll('#students-tbody .student-checkbox');
  if (!selectAllCheckbox || visibleCheckboxes.length === 0) {
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
    return;
  }

  const selectedCount = [...visibleCheckboxes].filter(cb => cb.checked).length;
  selectAllCheckbox.checked = selectedCount === visibleCheckboxes.length;
  selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < visibleCheckboxes.length;
}

// ==========================================
// ควบคุม Dropdown Menu (3 จุด)
// ==========================================
window.toggleActionMenu = function(event, studentId) {
  event.stopPropagation();
  const dropdown = document.getElementById(`dropdown-${studentId}`);
  if (!dropdown) return;

  const isAlreadyOpen = !dropdown.classList.contains('hidden');

  // ปิดทุก dropdown ก่อน
  document.querySelectorAll('.action-dropdown').forEach(d => d.classList.add('hidden'));

  if (!isAlreadyOpen) {
    dropdown.classList.remove('hidden');
    positionActionMenu(dropdown, event.currentTarget);
    openDropdownStudentId = studentId;
  } else {
    openDropdownStudentId = null;
  }
};

// วางเมนูแบบ fixed อิงตำแหน่งปุ่ม ⋮ (การ์ดมี overflow:hidden เมนูแบบ absolute จะโดนตัด)
// ที่ด้านล่างไม่พอ → พลิกขึ้นไปเปิดด้านบนปุ่ม
function positionActionMenu(dropdown, anchor) {
  if (!anchor || !anchor.getBoundingClientRect) return;
  // ย้ายไปไว้ใต้ body: ถ้ามีกล่องแม่ใช้ transform/filter อยู่ fixed จะอิงกล่องนั้นแทนหน้าจอ (เมนูไปโผล่ผิดที่)
  if (dropdown.parentElement !== document.body) {
    dropdown.dataset.portal = '1';
    document.body.appendChild(dropdown);
  }
  const r = anchor.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.zIndex = '960';
  dropdown.style.right = 'auto';
  dropdown.style.top = '0px';
  dropdown.style.left = '0px';
  // หน้าเว็บถูก CSS zoom (html { zoom: 0.8 } ใน modern-ict.css): ค่า top/left ที่ตั้งจะถูกคูณ zoom
  // แต่ getBoundingClientRect ให้พิกัดหลังซูม → วัดอัตราซูมจริงด้วยการขยับเมนู 100px แล้วดูว่าไปจริงกี่ px
  const origin = dropdown.getBoundingClientRect();
  dropdown.style.left = '100px';
  const scale = (dropdown.getBoundingClientRect().left - origin.left) / 100 || 1;
  const menuW = origin.width;
  const menuH = origin.height;
  const gap = 6;
  // คำนวณในพิกัดหน้าจอ (หลังซูม) แล้วหารด้วย scale ตอนตั้งค่า
  const left = Math.max(8, Math.min(r.right - menuW, window.innerWidth - menuW - 8));
  const fitsBelow = r.bottom + gap + menuH <= window.innerHeight - 8;
  const top = fitsBelow ? r.bottom + gap : Math.max(8, r.top - gap - menuH);
  dropdown.style.left = `${(left - origin.left) / scale}px`;
  dropdown.style.top = `${(top - origin.top) / scale}px`;
}

function closeActionMenus() {
  document.querySelectorAll('.action-dropdown').forEach(d => d.classList.add('hidden'));
  openDropdownStudentId = null;
}

// ปิด dropdown เมื่อคลิกที่อื่น / เลื่อนหน้า / ย่อขยายจอ (เมนูเป็น fixed จะไม่เลื่อนตามแถว)
document.addEventListener('click', closeActionMenus);
window.addEventListener('scroll', closeActionMenus, true);
window.addEventListener('resize', closeActionMenus);

// ==========================================
// Pagination
// ==========================================
function renderPagination(page, totalPages, total) {
  const paginationEl = document.getElementById('pagination-controls');
  const infoEl = document.getElementById('pagination-info');
  if (!paginationEl) return;

  const start = total === 0 ? 0 : (page - 1) * pageLimit + 1;
  const end = Math.min(page * pageLimit, total);
  if (infoEl) infoEl.innerHTML = total === 0 ? 'ไม่มีข้อมูล' : `แสดง <b>${start}–${end}</b> จาก <b>${total}</b> คน`;

  // จำนวนนิสิตบนหัวการ์ด
  const countEl = document.getElementById('adv-student-count');
  if (countEl) {
    countEl.textContent = `${total} คน`;
    countEl.style.display = '';
  }

  paginationEl.innerHTML = '';
  const goTo = (p) => { currentPage = p; loadStudents(); };
  const navBtn = (icon, label, target, disabled) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'adv-page adv-page--nav';
    btn.innerHTML = `<span class="material-icons" aria-hidden="true">${icon}</span>`;
    btn.setAttribute('aria-label', label);
    btn.disabled = disabled;
    if (!disabled) btn.onclick = () => goTo(target);
    return btn;
  };

  paginationEl.appendChild(navBtn('chevron_left', 'หน้าก่อนหน้า', page - 1, page <= 1));
  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = i;
    btn.className = i === page ? 'adv-page adv-page--on' : 'adv-page';
    if (i === page) btn.setAttribute('aria-current', 'page');
    btn.onclick = () => goTo(i);
    paginationEl.appendChild(btn);
  }
  paginationEl.appendChild(navBtn('chevron_right', 'หน้าถัดไป', page + 1, page >= totalPages));
}

// คอลัมน์ "สถานที่ฝึกงาน": สถานะแบบตอบรับ (ช่องเดียว ไม่แสดงชื่อบริษัท)
//   อาจารย์ยังไม่ตรวจ (WAITING_ADVISOR_APPROVAL) → ปุ่ม "รอตรวจแบบตอบรับ!" เปิด Lightbox
//   อาจารย์อนุมัติแล้ว (ADVISOR_APPROVED)       → "รอตรวจสอบจากแอดมิน"
//   แอดมินยืนยันแล้ว (ACCEPTED)                 → "อนุมัติแล้ว"
//   ไม่อนุมัติ (REJECTED)                       → "แบบตอบรับไม่อนุมัติ"
function advisorPlacementCell(s) {
  let chip = '';
  if (s.hasPendingAcceptance || s.acceptanceStatus === 'WAITING_ADVISOR_APPROVAL') {
    chip = `
      <a href="/advisor-checklist-review?studentId=${s.id}" onclick="return window.openAcceptanceLightbox(event, ${s.id})"
         class="adv-plc-chip adv-plc-chip--action" title="นิสิตอัปโหลดแบบตอบรับแล้ว คลิกเพื่อตรวจและอนุมัติ">
        <span class="material-icons" aria-hidden="true">assignment_turned_in</span>รอตรวจแบบตอบรับ!
      </a>`;
  } else if (s.acceptanceStatus === 'ADVISOR_APPROVED') {
    chip = '<span class="adv-plc-chip adv-plc-chip--wait"><span class="material-icons" aria-hidden="true">hourglass_top</span>รอตรวจสอบจากแอดมิน</span>';
  } else if (s.acceptanceStatus === 'ACCEPTED') {
    chip = '<span class="adv-plc-chip adv-plc-chip--ok"><span class="material-icons" aria-hidden="true">check_circle</span>อนุมัติแล้ว</span>';
  } else if (s.acceptanceStatus === 'REJECTED') {
    chip = '<span class="adv-plc-chip adv-plc-chip--bad"><span class="material-icons" aria-hidden="true">cancel</span>แบบตอบรับไม่อนุมัติ</span>';
  }
  // ไม่มีสถานะแบบตอบรับและไม่มีสหกิจ → ขีด
  return chip || (s.coop ? '' : '<span class="adv-plc-empty">-</span>');
}

// ==========================================
// Export Excel / CSV ด้วย Export Modal Dialog
// ==========================================
window.openExportModal = function() {
  const modal = document.getElementById('export-modal');
  if (!modal) return;

  const totalSelected = selectedStudentIds.size;
  const totalFiltered = currentFilteredCount;
  const totalAll = totalAdvisorStudents || totalFiltered;

  // ตั้งค่าตัวเลขจำนวน
  const countFilteredEl = document.getElementById('export-count-filtered');
  const countSelectedEl = document.getElementById('export-count-selected');
  const countAllEl = document.getElementById('export-count-all');
  if (countFilteredEl) countFilteredEl.textContent = `${totalFiltered} รายการ`;
  if (countSelectedEl) countSelectedEl.textContent = `${totalSelected} รายการ`;
  if (countAllEl) countAllEl.textContent = `${totalAll} รายการ`;

  const radioSelected = document.getElementById('export-scope-selected');
  const radioFiltered = document.getElementById('export-scope-filtered');
  const optSelectedLabel = document.getElementById('export-opt-selected-label');
  const selectedDesc = document.getElementById('export-selected-desc');

  if (totalSelected > 0) {
    if (radioSelected) {
      radioSelected.disabled = false;
      radioSelected.checked = true;
    }
    if (optSelectedLabel) {
      optSelectedLabel.style.opacity = '1';
      optSelectedLabel.style.cursor = 'pointer';
    }
    if (selectedDesc) selectedDesc.textContent = `ส่งออกเฉพาะนิสิต ${totalSelected} คนที่ติ๊กเลือกไว้`;
  } else {
    if (radioSelected) {
      radioSelected.disabled = true;
      radioSelected.checked = false;
    }
    if (optSelectedLabel) {
      optSelectedLabel.style.opacity = '0.5';
      optSelectedLabel.style.cursor = 'not-allowed';
    }
    if (selectedDesc) selectedDesc.textContent = 'ยังไม่ได้ติ๊กเลือกนิสิตในตาราง';
    if (radioFiltered) radioFiltered.checked = true;
  }

  updateExportSummary();
  modal.style.display = 'flex';
};

window.closeExportModal = function() {
  const modal = document.getElementById('export-modal');
  if (modal) modal.style.display = 'none';
};

window.updateExportSummary = function() {
  const selectedRadio = document.querySelector('input[name="export-scope"]:checked');
  const scope = selectedRadio ? selectedRadio.value : 'filtered';
  const totalSelected = selectedStudentIds.size;
  const totalFiltered = currentFilteredCount;
  const totalAll = totalAdvisorStudents || totalFiltered;

  ['filtered', 'selected', 'all'].forEach(s => {
    const label = document.getElementById(`export-opt-${s}-label`);
    if (label) {
      if (s === scope) {
        label.style.borderColor = '#1541D2';
        label.style.backgroundColor = '#F0F5FF';
      } else {
        label.style.borderColor = '#E2E8F0';
        label.style.backgroundColor = '#FFFFFF';
      }
    }
  });

  const summaryText = document.getElementById('export-summary-text');
  if (!summaryText) return;

  if (scope === 'selected') {
    summaryText.textContent = `เตรียมส่งออกข้อมูลนิสิต ${totalSelected} รายการ (เฉพาะที่ติ๊กเลือก)`;
  } else if (scope === 'filtered') {
    summaryText.textContent = `เตรียมส่งออกข้อมูลนิสิต ${totalFiltered} รายการ (ตามตัวกรอง / การค้นหา)`;
  } else {
    summaryText.textContent = `เตรียมส่งออกข้อมูลนิสิต ${totalAll} รายการ (ทั้งหมดในความดูแล)`;
  }
};

window.confirmExport = async function() {
  const btn = document.getElementById('btn-confirm-export');
  const originalBtnHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="material-icons text-sm" style="animation: spin 1s linear infinite;">autorenew</span> กำลังสร้างไฟล์...`;
  }

  try {
    const selectedRadio = document.querySelector('input[name="export-scope"]:checked');
    const scope = selectedRadio ? selectedRadio.value : 'filtered';

    let url = '/api/advisor/export?';
    if (scope === 'selected') {
      if (selectedStudentIds.size === 0) {
        alert('กรุณาเลือกนิสิตในตารางก่อนทำการส่งออก');
        return;
      }
      url += `ids=${Array.from(selectedStudentIds).join(',')}`;
    } else if (scope === 'filtered') {
      const searchInput = document.getElementById('student-search');
      const searchVal = searchInput ? searchInput.value.trim() : '';
      const yearFilter = document.getElementById('year-filter');
      const selectedYear = yearFilter ? yearFilter.value : '';
      const statusFilter = document.getElementById('status-filter');
      const skillFilter = document.getElementById('skill-filter');

      const params = new URLSearchParams();
      if (searchVal) params.set('search', searchVal);
      if (selectedYear) params.set('yearPrefix', selectedYear);
      if (selectedSemester) params.set('semester', selectedSemester);
      if (statusFilter && statusFilter.value) params.set('statusFilter', statusFilter.value);
      if (skillFilter && skillFilter.value) params.set('skillFilter', skillFilter.value);
      if (currentFilter) {
        params.set('chartType', currentFilter.chartType);
        params.set('chartKey', currentFilter.chartKey);
      }
      url += params.toString();
    } else {
      url += `all=true`;
    }

    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) {
      alert('Export ไม่สำเร็จ: ' + (data.message || ''));
      return;
    }

    let exportList = data.data || [];

    // Fallback กรองฝั่ง client-side หากต้องการ
    if (scope === 'selected' && selectedStudentIds.size > 0 && exportList.length > selectedStudentIds.size) {
      exportList = exportList.filter(s => selectedStudentIds.has(s.id));
    }

    if (exportList.length === 0) {
      alert('ไม่พบข้อมูลนิสิตสำหรับ export ตามเงื่อนไขที่เลือก');
      return;
    }

    const headers = [
      'รหัสนิสิต',
      'ชื่อ - นามสกุล',
      'เบอร์โทรนิสิต',
      'อาจารย์ที่ปรึกษา',
      'ชั่วโมงอบรม (Soft/Hard/รวม)',
      'สถานะ CV',
      'สถานะ Checklist',
      'ผลการสมัคร/สัมภาษณ์',
      'ชื่อสถานประกอบการ / บริษัท',
      'ตำแหน่งที่ฝึก',
      'ชื่อบุคคลที่ให้ทำหนังสือ (เรียน...)',
      'ตำแหน่งบุคคลที่ให้ทำหนังสือ',
      'ที่อยู่บริษัท',
      'จังหวัด',
      'เบอร์โทรศัพท์บริษัท',
      'อีเมลติดต่อบริษัท',
      'สถานะอนุมัติที่ฝึกงาน',
      'สถานะในระบบ',
    ];

    const rows = exportList.map(s => [
      s.studentCode,
      s.nameTh,
      s.phone,
      s.advisorName,
      s.trainingProgress,
      s.cvStatus,
      s.checklistStatus,
      s.interviewStatus,
      s.companyNameTh,
      s.position,
      s.contactPersonName,
      s.contactPersonPosition,
      s.companyAddress,
      s.province,
      s.companyPhone,
      s.companyEmail,
      s.placementStatus,
      s.dropStatus,
    ].map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(','));

    const csvContent = '\uFEFF' + [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `รายชื่อและข้อมูลนิสิตฝึกงาน_${scope}_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(blobUrl);

    closeExportModal();
  } catch (err) {
    console.error('Export error:', err);
    alert('เกิดข้อผิดพลาดในการ Export');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnHtml;
    }
  }
};

window.exportStudents = function() {
  window.openExportModal();
};

// ปิด Export Modal เมื่อคลิกพื้นหลัง หรือกดปุ่ม Escape
window.addEventListener('click', (e) => {
  const exportModal = document.getElementById('export-modal');
  if (e.target === exportModal) {
    closeExportModal();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeExportModal();
  }
});

// ==========================================
// Filter UI & Clear Filter
// ==========================================
// ล้างช่องค้นหาทุกครั้งที่มีการใช้ filter อื่น (dropdown/กราฟ) เพื่อไม่ให้เงื่อนไขค้นหา+filter ขัดแย้งกัน
function clearSearchBox() {
  const searchEl = document.getElementById('student-search');
  if (searchEl) searchEl.value = '';
}

function updateFilterUI() {
  const badge = document.getElementById('active-filter-badge');
  const btn = document.getElementById('btn-clear-filter');

  const statusVal = document.getElementById('status-filter')?.value;
  const skillVal = document.getElementById('skill-filter')?.value;
  const yearVal = document.getElementById('year-filter')?.value;
  const searchVal = document.getElementById('student-search')?.value?.trim();

  const hasAnyFilter = currentFilter || statusVal || skillVal || yearVal || searchVal;

  if (currentFilter || statusVal || skillVal || yearVal) {
    const parts = [];
    if (currentFilter) parts.push(`กราฟ: ${currentFilter.label}`);
    if (yearVal) parts.push(`ปี ${yearVal}`);
    if (statusVal) parts.push(document.getElementById('status-filter').selectedOptions[0]?.text);
    if (skillVal) parts.push(document.getElementById('skill-filter').selectedOptions[0]?.text);
    if (badge) {
      badge.textContent = `กรอง: ${parts.join(', ')}`;
      badge.style.display = 'inline-block';
    }
  } else {
    if (badge) badge.style.display = 'none';
  }

  if (btn) {
    btn.style.display = hasAnyFilter ? 'inline-flex' : 'none';
  }
}

// Clear filter (จากกราฟ)
window.clearFilter = function() {
  currentFilter = null;
  currentPage = 1;
  document.querySelectorAll('.chart-status-row').forEach(r => r.classList.remove('bg-purple-100', 'font-bold'));
  updateFilterUI();
  loadStudents();
};

// Clear ALL filters (ทุก dropdown + กราฟ + ค้นหา)
window.clearAllFilters = function() {
  currentFilter = null;
  currentPage = 1;
  document.querySelectorAll('.chart-status-row').forEach(r => r.classList.remove('bg-purple-100', 'font-bold'));
  ['status-filter', 'skill-filter', 'year-filter', 'semester-filter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const sortEl = document.getElementById('sort-by') as HTMLSelectElement | null;
  if (sortEl) sortEl.value = 'critical';
  const searchEl = document.getElementById('student-search');
  if (searchEl) searchEl.value = '';
  updateFilterUI();
  loadStudents();
};

// Dropdown filter events (สถานะ, Skill)
['status-filter', 'skill-filter', 'sort-by'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('change', () => {
      // เมื่อผู้ใช้เลือก dropdown สถานะ ให้ปลดไฮไลต์กราฟออก เพื่อไม่ให้เงื่อนไขขัดแย้งกัน
      if (currentFilter) {
        currentFilter = null;
        document.querySelectorAll('.chart-status-row').forEach(r => r.classList.remove('bg-purple-100', 'font-bold'));
      }
      clearSearchBox();
      currentPage = 1;
      updateFilterUI();
      loadStudents();
    });
  }
});

// Search event
const searchInput = document.getElementById('student-search');
if (searchInput) {
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      updateFilterUI();
      loadStudents();
    }, 300);
  });
}

// Year filter event
window.onYearFilterChange = function() {
  clearSearchBox();
  currentPage = 1;
  updateFilterUI();
  loadStudents();
};

const yearFilterEl = document.getElementById('year-filter');
if (yearFilterEl) {
  yearFilterEl.addEventListener('change', window.onYearFilterChange);
}

// รหัสปีของนิสิตชั้นปี 3 ในปีการศึกษาปัจจุบัน (ตัดรอบปีการศึกษาที่เดือน มิ.ย. เหมือน studentImportParser)
// เช่น ต.ค. 2569 → ปีการศึกษา 2569 → ปี 3 = รหัส 67 | ม.ค. 2570 → ยังเป็นปีการศึกษา 2569 → รหัส 67
function getDefaultYearPrefix(date = new Date()) {
  const beYear = date.getFullYear() + 543;
  const academicYear = date.getMonth() + 1 < 6 ? beYear - 1 : beYear;
  return String((academicYear - 2) % 100).padStart(2, '0');
}

let yearFilterInitialized = false;

// ดึงรายปีจากรหัสนิสิตทั้งหมดมาใส่ Dropdown
async function populateYearFilter(apiUrl) {
  try {
    const select = document.getElementById('year-filter');
    if (!select) return;
    let currentVal = select.value;
    const res = await fetch(`${apiUrl}?page=1&limit=9999`);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.students)) return;
    const years = [...new Set(
      data.students
        .filter(s => s.studentCode && s.studentCode.length >= 2)
        .map(s => s.studentCode.substring(0, 2))
    )].sort((a, b) => Number(b) - Number(a));
    // โหลดหน้าครั้งแรก: default เป็นนิสิตปี 3 ปัจจุบัน (ถ้ามีนิสิตรุ่นนั้นในความดูแล ไม่งั้นแสดงทุกชั้นปี)
    // ครั้งถัดไป (เช่น realtime refresh) คงค่าที่ผู้ใช้เลือกไว้
    if (!yearFilterInitialized) {
      yearFilterInitialized = true;
      const defaultPrefix = getDefaultYearPrefix();
      if (years.includes(defaultPrefix)) currentVal = defaultPrefix;
    }
    select.innerHTML = '';
    const allYearsOption = document.createElement('option');
    allYearsOption.value = '';
    allYearsOption.textContent = 'ทุกชั้นปี';
    allYearsOption.selected = !years.includes(currentVal);
    select.appendChild(allYearsOption);
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `ปี ${y} (25${y})`;
      if (y === currentVal) opt.selected = true;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Populate year filter error:', err);
  }
}

// ==========================================
// 4. Modal: ตั้งสถานะนิสิต (Batch Update)
// ==========================================
window.onBatchTypeChange = function() {
  const type = document.getElementById('batch-status-type')?.value;
  const select = document.getElementById('batch-status-select');
  if (!select) return;

  if (type === 'checklist') {
    select.innerHTML = `
      <option value="APPROVED">✓ อาจารย์รีวิวแล้ว (ผ่าน)</option>
      <option value="PENDING">☐ รอผล</option>
      <option value="REJECTED">✗ ไม่ผ่าน / ทำ checklist เพิ่ม</option>
    `;
  } else if (type === 'placement') {
    select.innerHTML = `
      <option value="APPROVED">✓ อนุมัติที่ฝึกงาน</option>
      <option value="PENDING">☐ รอผล</option>
      <option value="REJECTED">✗ ไม่อนุมัติที่ฝึกงาน / เปลี่ยนที่ฝึกงาน</option>
    `;
  } else {
    select.innerHTML = `<option value="">-- กรุณาเลือกประเภทสถานะก่อน --</option>`;
  }
};

window.openSetStatusModal = function() {
  if (selectedStudentIds.size === 0) {
    alert('กรุณาเลือกนิสิตอย่างน้อย 1 คนโดยการติ๊กถูกที่ช่องสี่เหลี่ยมด้านหน้า');
    return;
  }
  document.getElementById('modal-selected-count').textContent = selectedStudentIds.size;

  const typeSelect = document.getElementById('batch-status-type');
  if (typeSelect) {
    typeSelect.value = 'checklist';
    onBatchTypeChange();
  }
  const noteInput = document.getElementById('batch-status-note');
  if (noteInput) noteInput.value = '';

  document.getElementById('modal-set-status').classList.remove('hidden');
};

window.closeSetStatusModal = function() {
  document.getElementById('modal-set-status')?.classList.add('hidden');
  const batchModal = document.getElementById('batch-status-modal');
  if (batchModal) batchModal.style.display = 'none';
};

// ปุ่ม "ตั้งสถานะนิสิต" ในหน้า Advisor Dashboard ใช้ modal #batch-status-modal
window.openBatchStatusModal = function() {
  if (selectedStudentIds.size === 0) {
    alert('กรุณาเลือกนิสิตอย่างน้อย 1 คนโดยการติ๊กถูกที่ช่องสี่เหลี่ยมด้านหน้า');
    return;
  }
  const typeSelect = document.getElementById('batch-status-type');
  if (typeSelect) {
    typeSelect.value = 'checklist';
    onBatchTypeChange();
  }
  const noteInput = document.getElementById('batch-status-note');
  if (noteInput) noteInput.value = '';

  const modal = document.getElementById('batch-status-modal');
  if (modal) modal.style.display = 'flex';
};

window.closeBatchStatusModal = function() {
  window.closeSetStatusModal();
};

window.submitAdvisorBatchStatus = function() {
  return window.submitBatchStatus();
};

window.submitBatchStatus = async function() {
  const statusType = document.getElementById('batch-status-type')?.value;
  const status = document.getElementById('batch-status-select')?.value;
  const note = document.getElementById('batch-status-note')?.value || '';

  if (!statusType) {
    alert('กรุณาเลือกประเภทสถานะ (Checklist หรือ ข้อมูลบริษัทที่เข้าฝึกงาน)');
    return;
  }
  if (!status) {
    alert('กรุณาเลือกสถานะ');
    return;
  }

  try {
    const res = await fetch('/api/advisor/batch-status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentIds: Array.from(selectedStudentIds),
        statusType,
        status,
        note,
      }),
    });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      closeSetStatusModal();
      selectedStudentIds.clear();
      await loadStudents();
    } else {
      alert('เกิดข้อผิดพลาด: ' + data.message);
    }
  } catch (err) {
    console.error('Batch status update error:', err);
    alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
  }
};

// เริ่มโหลด
initAdvisorDashboard();

// ⚡ เมื่อมีสัญญาณ Real-time / Polling ให้อัปเดตเฉพาะข้อมูลสรุปและตารางนิสิต (ไม่ต้องโหลด /auth/me และ dropdown limit=9999 ซ้ำ)
window.addEventListener('app:data-updated', () => {
  loadDashboardSummary();
  loadStudents();
});
/** escape ข้อความในป้ายสหกิจ (ชื่อบริษัทมาจากประกาศ/นิสิต) */
function advisorCoopEsc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
