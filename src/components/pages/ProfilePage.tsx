"use client";

import React from "react";
import PageShell from "./PageShell";

const PAGE_TITLE = "Profile ข้อมูลส่วนตัวนิสิต - คณะ ICT ม.พะเยา";
const PAGE_STYLES: string[] = [];
const PAGE_SCRIPTS: string[] = [
  "../components/header.js",
  "../components/text_utils.js",
  "../api/profile_view.js"
];

// หน้าโปรไฟล์นิสิต (อ่านอย่างเดียว) — ข้อมูลเติมโดย src/client/api/profile_view.ts
// แก้ไขข้อมูลติดต่อ/รูป/ข้อมูลเพิ่มเติม → ไปหน้า /status-all?tab=personal
const EDIT_URL = "/status-all?tab=personal";

const PAGE_BODY_HTML = `
  <!-- Header Bar -->
  <div id="header-placeholder"></div>

  <main class="main-content pf-page">
    <!-- ===== Hero ===== -->
    <section class="pf-hero">
      <div class="pf-hero-top">
        <div class="pf-hero-actions">
          <span class="pf-tag pf-tag--reg"><span class="material-icons" aria-hidden="true">lock</span>ข้อมูลวิชาการจาก REG ถูกล็อค</span>
          <span class="pf-tag pf-tag--edit"><span class="material-icons" aria-hidden="true">edit</span>แก้ไขข้อมูลติดต่อได้</span>
          <a class="pf-hero-btn" href="${EDIT_URL}"><span class="material-icons" aria-hidden="true">edit</span>แก้ไขข้อมูลส่วนตัว</a>
        </div>
      </div>
      <div class="pf-hero-id">
        <div class="pf-avatar">
          <img id="p-photo" src="" alt="รูปประจำตัวนิสิต" style="display: none;" />
          <span id="p-icon" class="material-icons" aria-hidden="true">person</span>
          <span class="pf-avatar-check" aria-hidden="true"><span class="material-icons">check</span></span>
        </div>
        <div class="pf-hero-text">
          <h1 class="pf-name"><span id="p-nameTh">กำลังโหลด...</span> <span class="pf-name-en" id="p-nameEnShort"></span></h1>
          <div class="pf-hero-chips">
            <span class="pf-hero-chip"><span class="material-icons" aria-hidden="true">badge</span>รหัสนิสิต <b id="p-studentCode-chip">-</b></span>
            <span class="pf-hero-chip"><span class="material-icons" aria-hidden="true">school</span><span id="p-major-chip">-</span></span>
            <span class="pf-hero-chip" id="p-position-chip-wrap" hidden><span class="material-icons" aria-hidden="true">work_outline</span><span id="p-position-chip">-</span></span>
          </div>
        </div>
      </div>
    </section>

    <div class="pf-body">
      <!-- สรุป 3 ช่อง (วันเริ่มฝึกยังไม่มีแหล่งข้อมูล) -->
      <div class="pf-stats">
        <div class="pf-stat">
          <span class="pf-stat-icon"><span class="material-icons" aria-hidden="true">co_present</span></span>
          <div><span class="pf-stat-label">อาจารย์ที่ปรึกษา</span><b id="p-advisor">-</b></div>
        </div>
        <div class="pf-stat">
          <span class="pf-stat-icon"><span class="material-icons" aria-hidden="true">event_available</span></span>
          <div><span class="pf-stat-label">วันที่สิ้นสุดฝึกงาน</span><b><span class="pf-reg-mini"><span class="material-icons" aria-hidden="true">lock</span>REG</span> <span id="p-end">ข้อมูลจาก REG</span></b></div>
        </div>
        <div class="pf-stat">
          <span class="pf-stat-icon pf-stat-icon--green"><span class="material-icons" aria-hidden="true">verified_user</span></span>
          <div><span class="pf-stat-label">สถานะ</span><b id="p-status" class="pf-status">-</b></div>
        </div>
      </div>

      <div class="pf-grid">
        <!-- ===== ซ้าย ===== -->
        <div class="pf-col">
          <!-- ข้อมูลการศึกษา -->
          <section class="pf-card">
            <header class="pf-card-head">
              <span class="pf-card-icon"><span class="material-icons" aria-hidden="true">school</span></span>
              <div><h2>ข้อมูลการศึกษา / ทะเบียนประวัติ</h2><p>ข้อมูลทางการศึกษาจากฐานข้อมูลสำนักทะเบียนและประมวลผล (REG)</p></div>
              <span class="pf-tag pf-tag--reg"><span class="material-icons" aria-hidden="true">lock</span>REG</span>
            </header>
            <div class="pf-fields">
              <div class="pf-field"><span>ชื่อ-สกุล (ไทย) <i class="material-icons" aria-hidden="true">lock</i></span><b id="p-nameTh-field">-</b></div>
              <div class="pf-field"><span>Name &amp; Surname (English) <i class="material-icons" aria-hidden="true">lock</i></span><b id="p-nameEn">-</b></div>
              <div class="pf-field"><span>รหัสนิสิต <i class="material-icons" aria-hidden="true">lock</i></span><b id="p-studentCode">-</b></div>
              <div class="pf-field"><span>สาขาวิชา <i class="material-icons" aria-hidden="true">lock</i></span><b id="p-major">-</b></div>
              <div class="pf-field"><span>หลักสูตร <i class="material-icons" aria-hidden="true">lock</i></span><b id="p-curriculum">-</b></div>
              <div class="pf-field"><span>คณะ <i class="material-icons" aria-hidden="true">lock</i></span><b id="p-faculty">-</b></div>
              <div class="pf-field"><span>ชั้นปีที่ <i class="material-icons" aria-hidden="true">lock</i></span><b id="p-year">-</b></div>
              <div class="pf-field"><span>เกรดเฉลี่ยสะสม (GPAX) <i class="material-icons" aria-hidden="true">lock</i></span><b id="p-gpa">-</b></div>
            </div>
            <div class="pf-field pf-field--full">
              <span>Email (@up.ac.th) <i class="material-icons" aria-hidden="true">lock</i></span>
              <div class="pf-email-box"><span class="material-icons" aria-hidden="true">mail_outline</span><b id="p-email">-</b><small>อีเมลทางการจากมหาวิทยาลัย</small></div>
            </div>
          </section>

          <!-- ข้อมูลส่วนบุคคลและการศึกษา -->
          <section class="pf-card">
            <header class="pf-card-head">
              <span class="pf-card-icon"><span class="material-icons" aria-hidden="true">person_outline</span></span>
              <div><h2>ข้อมูลส่วนบุคคลและการศึกษา</h2><p>รายละเอียดอาจารย์ที่ปรึกษาและช่วงเวลาฝึกงาน</p></div>
            </header>
            <span class="pf-sub-label">อาจารย์ที่ปรึกษา</span>
            <div class="pf-advisor">
              <span class="pf-advisor-avatar"><span class="material-icons" aria-hidden="true">person</span></span>
              <div class="pf-advisor-text">
                <b id="p-advisor-name">-</b>
                <small id="p-advisor-dept">-</small>
              </div>
              <a class="pf-advisor-btn" id="p-advisor-mail" href="#" hidden><span class="material-icons" aria-hidden="true">mail_outline</span>ติดต่ออาจารย์</a>
            </div>
            <div class="pf-period-head">
              <span class="pf-sub-label">ช่วงฝึกงาน</span>
              <span class="pf-tag pf-tag--reg"><span class="material-icons" aria-hidden="true">lock</span>ข้อมูลจาก REG</span>
            </div>
            <div class="pf-period">
              <div class="pf-period-row">
                <small>ระยะเวลาฝึกงานตามหลักสูตร</small>
                <span><i class="pf-dot pf-dot--green"></i>วันที่สิ้นสุด: <b id="p-end-2">ข้อมูลจาก REG</b></span>
              </div>
              <div class="pf-period-bar" aria-hidden="true"></div>
              <div class="pf-period-row pf-period-row--foot">
                <span>สถานะ: <b id="p-status-2" class="pf-status">-</b></span>
                <small>กำหนดการจากระบบ REG</small>
              </div>
            </div>
          </section>

          <!-- อื่นๆ -->
          <section class="pf-card">
            <header class="pf-card-head">
              <span class="pf-card-icon"><span class="material-icons" aria-hidden="true">description</span></span>
              <div><h2>อื่นๆ</h2><p>ข้อมูลบันทึกเพิ่มเติม</p></div>
              <a class="pf-tag pf-tag--edit" href="${EDIT_URL}"><span class="material-icons" aria-hidden="true">edit</span>แก้ไขได้</a>
            </header>
            <div id="p-extra"></div>
          </section>
        </div>

        <!-- ===== ขวา ===== -->
        <div class="pf-col">
          <!-- ติดต่อ -->
          <section class="pf-card">
            <header class="pf-card-head">
              <span class="pf-card-icon"><span class="material-icons" aria-hidden="true">link</span></span>
              <div><h2>ข้อมูลการติดต่อและโซเชียลมีเดีย</h2><p>ช่องทางสำหรับติดต่อฝึกงาน</p></div>
              <a class="pf-tag pf-tag--edit" href="${EDIT_URL}"><span class="material-icons" aria-hidden="true">edit</span>แก้ไขได้</a>
            </header>
            <ul class="pf-contact" id="p-contact"></ul>
          </section>

          <!-- รูปประจำตัว -->
          <section class="pf-card">
            <header class="pf-card-head">
              <span class="pf-card-icon"><span class="material-icons" aria-hidden="true">portrait</span></span>
              <div><h2>รูปประจำตัว</h2></div>
            </header>
            <div class="pf-photo">
              <div class="pf-photo-thumb">
                <img id="p-photo-2" src="" alt="" style="display: none;" />
                <span id="p-icon-2" class="material-icons" aria-hidden="true">person</span>
              </div>
              <div class="pf-photo-text">
                <span class="pf-tag pf-tag--edit"><span class="material-icons" aria-hidden="true">edit</span>แก้ไขได้</span>
                <small>ขนาด 1.5 - 2 นิ้ว · แต่งกายด้วยชุดนิสิตถูกระเบียบ</small>
                <a href="${EDIT_URL}">อัปโหลด / เปลี่ยนรูปที่หน้าจัดการข้อมูล <span class="material-icons" aria-hidden="true">arrow_forward</span></a>
              </div>
            </div>
          </section>

          <!-- ความครบถ้วนของโปรไฟล์ -->
          <section class="pf-card">
            <header class="pf-card-head pf-card-head--plain">
              <h2>ความครบถ้วนของโปรไฟล์</h2>
              <span class="pf-tag pf-tag--ok" id="p-complete-tag">-</span>
            </header>
            <div class="pf-complete">
              <div class="pf-ring" id="p-ring" style="--pf-pct: 0;"><span id="p-ring-text">0%</span></div>
              <div><b id="p-complete-title">-</b><small id="p-complete-sub">-</small></div>
            </div>
            <span class="pf-sub-label">สถานะรายการ:</span>
            <ul class="pf-checks" id="p-checks"></ul>
          </section>
        </div>
      </div>
    </div>
  </main>
`;

export default function ProfilePage() {
  return (
    <PageShell
      pageKey="Profile"
      title={PAGE_TITLE}
      styles={PAGE_STYLES}
      scripts={PAGE_SCRIPTS}
      bodyHtml={PAGE_BODY_HTML}
    />
  );
}
