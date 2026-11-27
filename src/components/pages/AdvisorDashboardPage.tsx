"use client";

import React from "react";
import PageShell from "./PageShell";
import { ictMajorsDataScript } from "../../utils/majors";

const PAGE_TITLE = "Dashboard อาจารย์ที่ปรึกษา / อาจารย์นิเทศก์ - คณะ ICT ม.พะเยา";
const PAGE_STYLES: string[] = [];
const PAGE_SCRIPTS: string[] = [
  "../components/header.js",
  "../components/acceptance_review.js",
  "../api/advisor_dashboard.js"
];
const PAGE_BODY_HTML = `
${ictMajorsDataScript()}
  <!-- Header Bar -->
  <div id="header-placeholder"></div>

  <!-- Main Content -->
  <main class="main-content dashboard-content">

    <!-- [REQ-10 & REQ-06] Top Role Header + Notification Alert Banner -->
    <section class="card" style="margin-bottom: 20px;">
      <div class="card-header" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="material-icons header-icon">notifications_active</span>
          <div>
            <h2 class="card-title" id="advisor-dashboard-main-title" style="margin:0;">ระบบติดตามดูแลนิสิตฝึกงาน (เฉพาะนิสิตในความรับผิดชอบ)</h2>
            <p id="advisor-dashboard-subtitle" style="margin:2px 0 0 0; font-size:12px; color:#E0E7FF;">
              แจ้งเตือนสถานะ Checklist และการตรวจสอบความตรงกันของสถานที่ฝึกงานจริง
            </p>
          </div>
        </div>

        <!-- Mode Switcher: อาจารย์ที่ปรึกษา vs อาจารย์นิเทศก์ -->
        <div id="advisor-mode-switcher" style="display:none; background:rgba(255,255,255,0.14); padding:4px; border-radius:12px; border:1px solid rgba(255,255,255,0.22); gap:4px;">
          <button type="button" id="btn-mode-advisor" onclick="switchAdvisorViewMode('ADVISOR')"
            style="padding:6px 14px; border-radius:9px; font-size:12px; font-weight:700; border:none; cursor:pointer; background:#FFFFFF; color:#1E1B4B; display:inline-flex; align-items:center; gap:5px;">
            <span class="material-icons" style="font-size:15px;">supervisor_account</span>
            <span>นิสิตในที่ปรึกษา (Advisees)</span>
          </button>
          <button type="button" id="btn-mode-supervisor" onclick="switchAdvisorViewMode('SUPERVISOR')"
            style="padding:6px 14px; border-radius:9px; font-size:12px; font-weight:600; border:none; cursor:pointer; background:transparent; color:#FFFFFF; display:inline-flex; align-items:center; gap:5px;">
            <span class="material-icons" style="font-size:15px;">explore</span>
            <span>นิสิตในการนิเทศ (Supervised)</span>
          </button>
        </div>
      </div>

      <div class="card-body" style="padding:18px 24px !important;">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:14px;" id="advisor-notification-cards">
          <!-- Card 1: Total Advisees -->
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:16px; padding:14px 18px; display:flex; align-items:center; justify-content:space-between;">
            <div>
              <div style="font-size:12px; font-weight:600; color:#64748B;">นิสิตในความดูแลทั้งหมด</div>
              <div style="font-size:26px; font-weight:800; color:#0F172A; margin-top:2px;" id="notif-total-advisees">0</div>
              <div style="font-size:11px; color:#64748B;">คน (เฉพาะที่รับผิดชอบ)</div>
            </div>
            <div style="width:44px; height:44px; border-radius:12px; background:#EEF2FF; color:#4338CA; display:flex; align-items:center; justify-content:center;">
              <span class="material-icons">groups</span>
            </div>
          </div>

          <!-- Card 2: Pending Checklist Review -->
          <div onclick="filterByAdvisorNotification('checklist_pending')" style="cursor:pointer; background:#FFFBEB; border:1px solid #FDE68A; border-radius:16px; padding:14px 18px; display:flex; align-items:center; justify-content:space-between; transition:transform 0.15s ease;" title="คลิกเพื่อกรองนิสิตที่รอตรวจ Checklist">
            <div>
              <div style="font-size:12px; font-weight:700; color:#92400E;">รอตรวจ Checklist (3 บริษัท)</div>
              <div style="font-size:26px; font-weight:800; color:#D97706; margin-top:2px;" id="notif-pending-checklist">0</div>
              <div style="font-size:11px; color:#B45309;">คลิกเพื่อกรองรายการที่รอตรวจ</div>
            </div>
            <div style="width:44px; height:44px; border-radius:12px; background:#FEF3C7; color:#D97706; display:flex; align-items:center; justify-content:center;">
              <span class="material-icons">fact_check</span>
            </div>
          </div>

          <!-- Card 3: Pending Placement Approval -->
          <div onclick="filterByAdvisorNotification('placement_pending')" style="cursor:pointer; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:16px; padding:14px 18px; display:flex; align-items:center; justify-content:space-between; transition:transform 0.15s ease;" title="คลิกเพื่อกรองนิสิตที่รออนุมัติที่ฝึกงาน">
            <div>
              <div style="font-size:12px; font-weight:700; color:#1E40AF;">รออนุมัติสถานที่ฝึกงานจริง</div>
              <div style="font-size:26px; font-weight:800; color:#2563EB; margin-top:2px;" id="notif-pending-placement">0</div>
              <div style="font-size:11px; color:#1D4ED8;">นิสิตผ่านสัมภาษณ์และยื่นบริษัทแล้ว</div>
            </div>
            <div style="width:44px; height:44px; border-radius:12px; background:#DBEAFE; color:#2563EB; display:flex; align-items:center; justify-content:center;">
              <span class="material-icons">business</span>
            </div>
          </div>

          <!-- Card 4: Hidden (Obsolete REQ-06) -->
          <div style="display:none;" id="notif-mismatch-placement">0</div>
        </div>
      </div>
    </section>

    <!-- 2. รายชื่อนิสิต -->
    <section class="card adv-students" id="adv-students">
      <div class="card-header adv-head">
        <div class="adv-head-left">
          <span class="material-icons header-icon">people</span>
          <h2 class="card-title" id="advisor-table-title">รายชื่อนิสิตในที่ปรึกษา</h2>
          <span class="adv-count" id="adv-student-count" style="display:none;"></span>
          <span id="active-filter-badge" class="adv-filter-badge" style="display:none;"></span>
        </div>
        <div class="adv-head-actions">
          <button type="button" class="adv-hbtn" onclick="openBatchStatusModal()">
            <span class="material-icons">edit_note</span> ตั้งสถานะนิสิต
          </button>
          <button type="button" class="adv-hbtn adv-hbtn--solid" onclick="exportStudents()">
            <span class="material-icons">download</span> Export Excel/CSV
          </button>
        </div>
      </div>
      <div class="card-body">

        <!-- Filter & Search Bar: แถวบน = ค้นหา + เรียง, แถวล่าง = ตัวกรอง -->
        <div class="filter-bar adv-filter">
          <div class="adv-filter-top">
            <div class="adv-search">
              <span class="material-icons">search</span>
              <input type="text" class="input-field" id="student-search" placeholder="ค้นหารหัสนิสิต หรือ ชื่อ..." />
            </div>
            <div class="adv-sort">
              <span class="material-icons" aria-hidden="true">sort</span>
              <select id="sort-by" class="input-field" aria-label="เรียงลำดับ">
                <option value="critical" selected>เรียง: ต้องติดตาม ➔ พร้อมฝึกงาน</option>
                <option value="studentCode_desc">เรียง: รหัสนิสิต (มาก ➔ น้อย)</option>
                <option value="studentCode_asc">เรียง: รหัสนิสิต (น้อย ➔ มาก)</option>
                <option value="name_asc">เรียง: ชื่อ-นามสกุล (ก-ฮ)</option>
              </select>
            </div>
          </div>
          <div class="adv-filter-row">
            <span class="adv-filter-label"><span class="material-icons" aria-hidden="true">tune</span> ตัวกรอง</span>
          <select id="year-filter" class="input-field" aria-label="ชั้นปี">
            <option value="">ทุกชั้นปี</option>
          </select>

          <select id="semester-filter" class="input-field" aria-label="ภาคเรียน">
            <option value="">ทุกภาคเรียน</option>
            <option value="1">ภาคเรียนที่ 1</option>
            <option value="2" selected>ภาคเรียนที่ 2</option>
            <option value="SUMMER">ภาคฤดูร้อน</option>
          </select>

          <select id="status-filter" class="input-field" aria-label="สถานะ">
            <option value="">ทุกสถานะ</option>
            <optgroup label="📄 1. เรซูเม่ (CV) — คอมเมนต์อย่างเดียว">
              <option value="cv_waiting">⏳ อัปโหลดแล้ว รอคอมเมนต์</option>
              <option value="cv_commented">💬 คอมเมนต์แล้ว</option>
              <option value="cv_none">🔴 ยังไม่อัปโหลด CV</option>
            </optgroup>
            <optgroup label="🏢 2. Checklist สถานประกอบการ">
              <option value="checklist_pending">⏳ รอตรวจ Checklist</option>
              <option value="checklist_approved">🟢 Checklist ผ่าน (รีวิวแล้ว)</option>
              <option value="checklist_rejected">🔴 ไม่ผ่าน / ทำเพิ่ม</option>
            </optgroup>
            <optgroup label="🎓 3. ชั่วโมงอบรมเตรียมความพร้อม">
              <option value="training_incomplete">⏳ อบรมยังไม่ครบ</option>
              <option value="training_passed">🟢 อบรมครบ 30 ชม.</option>
            </optgroup>
            <optgroup label="💼 4. ที่ฝึกงาน">
              <option value="placement_approved">🟢 อนุมัติที่ฝึกงานแล้ว</option>
            </optgroup>
          </select>

          <select id="skill-filter" class="input-field" aria-label="สถานะชั่วโมงอบรม">
            <option value="">ทุกสถานะชั่วโมงอบรม</option>
            <option value="pass_all">🟢 ผ่านเกณฑ์ครบ (Soft+Hard)</option>
            <option value="lack_soft">⚠️ ขาด Soft Skill (&lt; 12 ชม.)</option>
            <option value="lack_hard">⚠️ ขาด Hard Skill (&lt; 18 ชม.)</option>
            <option value="lack_both">⚠️ ขาดทั้ง Soft &amp; Hard</option>
          </select>

          <button type="button" id="btn-clear-filter" class="adv-clear" onclick="clearAllFilters()" style="display:none;">
            <span class="material-icons">close</span> ล้างตัวกรอง
          </button>
          </div>
        </div>

        <div class="adv-table-wrap">
          <table class="data-table adv-table">
            <thead>
              <tr>
                <th class="adv-col-check">
                  <input type="checkbox" id="select-all-students" title="เลือกนิสิตทั้งหมดในหน้านี้" aria-label="เลือกนิสิตทั้งหมดในหน้านี้" />
                </th>
                <th>รหัสนิสิต</th>
                <th>ชื่อ-นามสกุล</th>
                <th>สาขาวิชา</th>
                <th>สถานะ Checklist</th>
                <th>สถานที่ฝึกงาน</th>
                <th class="adv-col-act"><span class="sr-only">จัดการ</span></th>
              </tr>
            </thead>
            <tbody id="students-tbody">
              <tr><td colspan="7" class="text-center py-8 text-gray-400">กำลังโหลดข้อมูล...</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="adv-pager">
          <span id="pagination-info">กำลังโหลด...</span>
          <div class="adv-pager-btns" id="pagination-controls"></div>
        </div>

      </div>
    </section>

    <!-- Modal: ตั้งสถานะนิสิต (อาจารย์ที่ปรึกษา) -->
    <div id="batch-status-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; padding:24px 28px; width:440px; max-width:92%; box-shadow:0 20px 50px rgba(15,23,42,0.25);">
        <h3 style="font-size:17px; font-weight:700; margin-bottom:16px; color:#1E293B;">ตั้งสถานะนิสิต (อาจารย์ที่ปรึกษา)</h3>
        <div style="margin-bottom:12px;">
          <label style="font-size:13px; font-weight:600; color:#475569;">ประเภทสถานะ</label>
          <select id="batch-status-type" class="input-field" style="margin-top:4px;" onchange="onBatchTypeChange()">
            <option value="checklist">สถานะ Checklist</option>
            <option value="placement">สถานะอนุมัติที่ฝึกงาน</option>
          </select>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:13px; font-weight:600; color:#475569;">ค่าสถานะ</label>
          <select id="batch-status-select" class="input-field" style="margin-top:4px;">
            <option value="APPROVED">✓ อาจารย์รีวิวแล้ว (ผ่าน)</option>
            <option value="PENDING">☐ รอผล</option>
            <option value="REJECTED">✗ ไม่ผ่าน / ทำ checklist เพิ่ม</option>
          </select>
        </div>
        <div style="margin-bottom:16px;">
          <label style="font-size:13px; font-weight:600; color:#475569;">หมายเหตุ (ถ้ามี)</label>
          <input type="text" id="batch-status-note" class="input-field" placeholder="หมายเหตุ..." style="margin-top:4px;" />
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="closeBatchStatusModal()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" onclick="submitAdvisorBatchStatus()">ยืนยัน</button>
        </div>
      </div>
    </div>

    <!-- Modal: เลือกรูปแบบการ Export Excel/CSV -->
    <div id="export-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; width:480px; max-width:92%; box-shadow:0 20px 50px rgba(15,23,42,0.25); overflow:hidden;">
        <div style="background:linear-gradient(135deg, #1E1B4B 0%, #4338CA 100%); padding:18px 24px; color:white; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-icons" style="font-size:22px;">file_download</span>
            <h3 style="font-size:16px; font-weight:700; margin:0;">ส่งออกข้อมูลนิสิต (Export CSV / Excel)</h3>
          </div>
          <button onclick="closeExportModal()" style="background:none; border:none; color:white; cursor:pointer; display:flex; align-items:center; opacity:0.85;">
            <span class="material-icons" style="font-size:20px;">close</span>
          </button>
        </div>

        <div style="padding:20px 24px;">
          <p style="font-size:13px; color:#475569; margin-bottom:14px; font-weight:500;">กรุณาเลือกขอบเขตข้อมูลนิสิตที่ต้องการส่งออก:</p>

          <div style="display:flex; flex-direction:column; gap:10px;">
            <label id="export-opt-filtered-label" style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px; border:2px solid #4338CA; background:#EEF2FF; border-radius:12px; cursor:pointer; transition:all 0.15s;">
              <input type="radio" name="export-scope" value="filtered" id="export-scope-filtered" checked onchange="updateExportSummary()" style="margin-top:3px; width:16px; height:16px; accent-color:#4338CA; cursor:pointer;" />
              <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:13.5px; font-weight:700; color:#1E293B;">ตามตัวกรองปัจจุบัน (Filtered)</span>
                  <span id="export-count-filtered" style="font-size:11px; font-weight:700; background:#DBEAFE; color:#1D4ED8; padding:2px 8px; border-radius:999px;">0 รายการ</span>
                </div>
                <p style="font-size:12px; color:#64748B; margin:3px 0 0 0;">ส่งออกเฉพาะรายชื่อที่ตรงกับตัวกรอง ชั้นปี สถานะ หรือคำค้นหาปัจจุบัน</p>
              </div>
            </label>

            <label id="export-opt-selected-label" style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px; border:2px solid #E2E8F0; background:#FFFFFF; border-radius:12px; cursor:pointer; transition:all 0.15s;">
              <input type="radio" name="export-scope" value="selected" id="export-scope-selected" onchange="updateExportSummary()" style="margin-top:3px; width:16px; height:16px; accent-color:#4338CA; cursor:pointer;" />
              <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:13.5px; font-weight:700; color:#1E293B;">เฉพาะนิสิตที่ติ๊กเลือก (Selected)</span>
                  <span id="export-count-selected" style="font-size:11px; font-weight:700; background:#F1F5F9; color:#475569; padding:2px 8px; border-radius:999px;">0 รายการ</span>
                </div>
                <p id="export-selected-desc" style="font-size:12px; color:#64748B; margin:3px 0 0 0;">ส่งออกเฉพาะรายชื่อที่คุณติ๊กถูกในช่อง Checkbox ของตาราง</p>
              </div>
            </label>

            <label id="export-opt-all-label" style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px; border:2px solid #E2E8F0; background:#FFFFFF; border-radius:12px; cursor:pointer; transition:all 0.15s;">
              <input type="radio" name="export-scope" value="all" id="export-scope-all" onchange="updateExportSummary()" style="margin-top:3px; width:16px; height:16px; accent-color:#4338CA; cursor:pointer;" />
              <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:13.5px; font-weight:700; color:#1E293B;">นิสิตในความดูแลทั้งหมด (All Advisees)</span>
                  <span id="export-count-all" style="font-size:11px; font-weight:700; background:#F1F5F9; color:#475569; padding:2px 8px; border-radius:999px;">0 รายการ</span>
                </div>
                <p style="font-size:12px; color:#64748B; margin:3px 0 0 0;">ส่งออกข้อมูลนิสิตในที่ปรึกษาทั้งหมดโดยไม่สนใจตัวกรอง</p>
              </div>
            </label>
          </div>

          <div style="margin-top:14px; padding:10px 14px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; display:flex; align-items:center; gap:8px;">
            <span class="material-icons" style="font-size:18px; color:#4338CA;">info</span>
            <span id="export-summary-text" style="font-size:12px; color:#334155; font-weight:500;">เตรียมส่งออกข้อมูลนิสิต 0 รายการ</span>
          </div>
        </div>

        <div style="padding:14px 24px; background:#F8FAFC; border-top:1px solid #E2E8F0; display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="closeExportModal()" style="border-radius:10px;">ยกเลิก</button>
          <button id="btn-confirm-export" class="btn btn-primary btn-sm" onclick="confirmExport()" style="border-radius:10px; display:inline-flex; align-items:center; gap:6px; padding:8px 16px;">
            <span class="material-icons" style="font-size:16px;">download</span> ดาวน์โหลดไฟล์ CSV
          </button>
        </div>
      </div>
    </div>

  </main>
`;

export default function AdvisorDashboardPage() {
  return (
    <PageShell
      pageKey="dashboard_ที่ปรึกษา"
      title={PAGE_TITLE}
      styles={PAGE_STYLES}
      scripts={PAGE_SCRIPTS}
      bodyHtml={PAGE_BODY_HTML}
    />
  );
}
