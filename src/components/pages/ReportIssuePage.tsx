"use client";

import React from "react";
import PageShell from "./PageShell";

// หน้า "แจ้งปัญหา" ของนิสิต (เมนู อื่นๆ → แจ้งปัญหา) — สคริปต์: src/client/api/report_issue.ts
const PAGE_TITLE = "แจ้งปัญหาการใช้งาน - คณะ ICT ม.พะเยา";
const PAGE_STYLES: string[] = [`
  .rpi { --rpi-ink:#0F172A; --rpi-muted:#64748B; --rpi-line:#E2E8F0; --rpi-brand:#4338CA; --rpi-brand-soft:#EEF2FF; }
  .rpi-hero {
    display:flex; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap;
    padding:22px 26px; margin-bottom:16px; border-radius:20px; color:#fff;
    background: radial-gradient(circle at 85% 20%, rgba(255,255,255,.18), transparent 45%), linear-gradient(120deg, #312E81 0%, #4338CA 55%, #0EA5E9 100%);
  }
  .rpi-hero-main { display:flex; align-items:center; gap:16px; min-width:0; }
  .rpi-hero-icon { width:54px; height:54px; flex:none; display:grid; place-items:center; border-radius:16px; background:rgba(255,255,255,.16); }
  .rpi-hero-icon .material-icons { font-size:30px; }
  .rpi-hero h1 { margin:0; font-size:22px; font-weight:800; }
  .rpi-hero p { margin:4px 0 0; font-size:13px; color:#E0E7FF; }
  .rpi-hero-stats { display:flex; gap:10px; flex-wrap:wrap; }
  .rpi-hero-stat { min-width:92px; padding:10px 14px; border-radius:14px; background:rgba(255,255,255,.14); text-align:center; }
  .rpi-hero-stat b { display:block; font-size:20px; line-height:1.2; }
  .rpi-hero-stat span { font-size:11.5px; color:#E0E7FF; }

  .rpi-tabs { display:inline-flex; gap:4px; padding:4px; margin-bottom:16px; border-radius:14px; background:#F1F5F9; border:1px solid var(--rpi-line); }
  .rpi-tab { display:inline-flex; align-items:center; gap:6px; padding:9px 16px; border:0; border-radius:10px; background:transparent; color:#475569; font:inherit; font-size:13.5px; font-weight:700; cursor:pointer; }
  .rpi-tab .material-icons { font-size:18px; }
  .rpi-tab[aria-selected="true"] { background:#fff; color:var(--rpi-brand); box-shadow:0 2px 8px rgba(15,23,42,.08); }
  .rpi-tab-count { min-width:20px; padding:0 6px; border-radius:999px; background:var(--rpi-brand-soft); color:var(--rpi-brand); font-size:11.5px; }

  .rpi-layout { display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:16px; align-items:start; }
  .rpi-panel { padding:20px 22px; margin-bottom:16px; background:#fff; border:1px solid var(--rpi-line); border-radius:18px; }
  .rpi-step { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
  .rpi-step-no { width:28px; height:28px; flex:none; display:grid; place-items:center; border-radius:999px; background:var(--rpi-brand); color:#fff; font-size:13px; font-weight:800; }
  .rpi-step h2 { margin:0; font-size:16px; font-weight:800; color:var(--rpi-ink); }
  .rpi-step small { display:block; font-size:12px; color:var(--rpi-muted); font-weight:500; }
  .rpi-panel.is-disabled { opacity:.55; pointer-events:none; }
  .rpi-panel.is-disabled .rpi-step-no { background:#94A3B8; }

  .rpi-cats { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:10px; }
  .rpi-cat { position:relative; display:flex; flex-direction:column; gap:6px; padding:14px; text-align:left; border:1.5px solid var(--rpi-line); border-radius:14px; background:#fff; font:inherit; cursor:pointer; transition:border-color .15s, box-shadow .15s, transform .15s; }
  .rpi-cat:hover { border-color:#A5B4FC; transform:translateY(-1px); }
  .rpi-cat:focus-visible { outline:3px solid rgba(67,56,202,.25); outline-offset:2px; }
  .rpi-cat .material-icons { width:36px; height:36px; display:grid; place-items:center; border-radius:10px; background:var(--rpi-brand-soft); color:var(--rpi-brand); font-size:20px; }
  .rpi-cat b { font-size:13.5px; color:var(--rpi-ink); }
  .rpi-cat small { font-size:11.5px; color:var(--rpi-muted); line-height:1.45; }
  .rpi-cat[aria-checked="true"] { border-color:var(--rpi-brand); background:#F8F9FF; box-shadow:0 0 0 3px rgba(67,56,202,.12); }
  .rpi-cat[aria-checked="true"]::after { content:"check_circle"; font-family:"Material Icons"; position:absolute; top:10px; right:10px; font-size:20px; color:var(--rpi-brand); }

  .rpi-field { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
  .rpi-field-row { display:grid; grid-template-columns:minmax(0,1.4fr) minmax(0,1fr); gap:12px; }
  .rpi-label { display:flex; align-items:baseline; justify-content:space-between; gap:8px; font-size:13px; font-weight:700; color:#334155; }
  .rpi-label .req { color:#DC2626; }
  .rpi-count { font-size:11.5px; font-weight:500; color:#94A3B8; }
  .rpi-input, .rpi-select, .rpi-textarea { width:100%; box-sizing:border-box; padding:10px 12px; border:1px solid #CBD5E1; border-radius:10px; background:#fff; font:inherit; font-size:14px; color:var(--rpi-ink); }
  .rpi-textarea { min-height:130px; resize:vertical; line-height:1.6; }
  .rpi-input:focus, .rpi-select:focus, .rpi-textarea:focus { outline:none; border-color:#6366F1; box-shadow:0 0 0 3px rgba(99,102,241,.15); }
  .rpi-hint { font-size:11.5px; color:var(--rpi-muted); }
  .rpi-error { font-size:12px; color:#DC2626; min-height:0; }
  .rpi-error:empty { display:none; }

  .rpi-urgency { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; }
  .rpi-urg { display:flex; align-items:flex-start; gap:8px; padding:10px 12px; border:1.5px solid var(--rpi-line); border-radius:12px; background:#fff; font:inherit; text-align:left; cursor:pointer; }
  .rpi-urg i { width:10px; height:10px; margin-top:5px; flex:none; border-radius:999px; }
  .rpi-urg b { display:block; font-size:13px; color:var(--rpi-ink); }
  .rpi-urg small { font-size:11px; color:var(--rpi-muted); }
  .rpi-urg[aria-checked="true"] { border-color:var(--rpi-brand); background:#F8F9FF; }

  .rpi-files { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .rpi-file-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border:1.5px dashed #A5B4FC; border-radius:10px; background:#F8F9FF; color:var(--rpi-brand); font:inherit; font-size:13px; font-weight:700; cursor:pointer; }
  .rpi-file-btn[disabled] { opacity:.5; cursor:not-allowed; }
  .rpi-chip { display:inline-flex; align-items:center; gap:6px; max-width:100%; padding:6px 8px 6px 10px; border-radius:999px; background:#F1F5F9; font-size:12px; color:#334155; }
  .rpi-chip span.name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px; }
  .rpi-chip button { display:inline-flex; padding:2px; border:0; border-radius:999px; background:transparent; color:#64748B; cursor:pointer; }
  .rpi-chip button:hover { background:#E2E8F0; color:#DC2626; }
  .rpi-chip .material-icons { font-size:15px; }
  .rpi-check { display:flex; align-items:flex-start; gap:8px; font-size:13px; color:#334155; cursor:pointer; }
  .rpi-check input { margin-top:3px; accent-color:var(--rpi-brand); }

  .rpi-summary { position:sticky; top:16px; }
  .rpi-summary h3 { display:flex; align-items:center; gap:6px; margin:0 0 12px; font-size:14.5px; font-weight:800; color:var(--rpi-ink); }
  .rpi-summary dl { margin:0 0 14px; display:grid; grid-template-columns:auto minmax(0,1fr); gap:8px 12px; font-size:12.5px; }
  .rpi-summary dt { color:var(--rpi-muted); }
  .rpi-summary dd { margin:0; color:var(--rpi-ink); font-weight:600; overflow-wrap:anywhere; }
  .rpi-summary dd.empty { color:#CBD5E1; font-weight:500; }
  .rpi-submit { width:100%; display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:12px; border:0; border-radius:12px; background:var(--rpi-brand); color:#fff; font:inherit; font-size:14px; font-weight:800; cursor:pointer; }
  .rpi-submit[disabled] { background:#A5B4FC; cursor:not-allowed; }
  .rpi-reset { width:100%; margin-top:8px; padding:9px; border:0; background:none; color:var(--rpi-muted); font:inherit; font-size:12.5px; font-weight:600; cursor:pointer; }
  .rpi-tips { margin:14px 0 0; padding:12px 14px; list-style:none; border-radius:12px; background:#F0F9FF; font-size:12px; color:#075985; line-height:1.6; }
  .rpi-tips li { display:flex; gap:6px; }
  .rpi-tips .material-icons { font-size:15px; margin-top:2px; }
  .rpi-alert { display:flex; align-items:center; gap:10px; padding:12px 16px; margin-bottom:16px; border-radius:14px; background:#ECFDF5; border:1px solid #A7F3D0; color:#065F46; font-size:13.5px; font-weight:600; }
  .rpi-alert[hidden] { display:none; }

  .rpi-filter { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; }
  .rpi-filter button { padding:6px 12px; border:1px solid var(--rpi-line); border-radius:999px; background:#fff; font:inherit; font-size:12.5px; font-weight:700; color:#475569; cursor:pointer; }
  .rpi-filter button[aria-pressed="true"] { border-color:var(--rpi-brand); background:var(--rpi-brand-soft); color:var(--rpi-brand); }
  .rpi-history { display:grid; gap:12px; }
  .rpi-ticket { padding:16px 18px; border:1px solid var(--rpi-line); border-radius:16px; background:#fff; }
  .rpi-ticket-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; flex-wrap:wrap; }
  .rpi-ticket-id { font-size:12px; font-weight:800; color:var(--rpi-brand); letter-spacing:.3px; }
  .rpi-ticket h3 { margin:2px 0 0; font-size:15px; font-weight:800; color:var(--rpi-ink); overflow-wrap:anywhere; }
  .rpi-ticket-meta { display:flex; gap:6px 14px; flex-wrap:wrap; margin-top:6px; font-size:12px; color:var(--rpi-muted); }
  .rpi-ticket-meta span { display:inline-flex; align-items:center; gap:4px; }
  .rpi-ticket-meta .material-icons { font-size:14px; }
  .rpi-ticket p.detail { margin:10px 0 0; font-size:13px; color:#334155; line-height:1.6; white-space:pre-wrap; overflow-wrap:anywhere; }
  .rpi-badge { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:800; white-space:nowrap; }
  .rpi-badge--OPEN { background:#FEF3C7; color:#92400E; }
  .rpi-badge--IN_PROGRESS { background:#DBEAFE; color:#1E40AF; }
  .rpi-badge--RESOLVED { background:#DCFCE7; color:#166534; }
  .rpi-track { display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-top:14px; }
  .rpi-track div { display:flex; flex-direction:column; gap:5px; font-size:11px; color:#94A3B8; font-weight:600; }
  .rpi-track div::before { content:""; height:5px; border-radius:999px; background:#E2E8F0; }
  .rpi-track div.done { color:#4338CA; }
  .rpi-track div.done::before { background:linear-gradient(90deg, #6366F1, #0EA5E9); }
  .rpi-reply { display:flex; gap:8px; margin-top:12px; padding:10px 12px; border-radius:12px; background:#F8FAFC; border-left:3px solid #6366F1; font-size:12.5px; color:#334155; white-space:pre-wrap; overflow-wrap:anywhere; }
  .rpi-reply .material-icons { font-size:16px; color:#6366F1; }
  .rpi-attach { display:flex; gap:6px; flex-wrap:wrap; margin-top:10px; }
  .rpi-attach a { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:999px; background:#F1F5F9; color:#1D4ED8; font-size:12px; font-weight:600; text-decoration:none; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .rpi-attach .material-icons { font-size:14px; }
  .rpi-empty { padding:40px 16px; text-align:center; color:var(--rpi-muted); font-size:13.5px; border:1.5px dashed var(--rpi-line); border-radius:16px; background:#fff; }
  .rpi-empty .material-icons { display:block; margin:0 auto 6px; font-size:36px; color:#CBD5E1; }

  @media (max-width: 960px) {
    .rpi-layout { grid-template-columns:minmax(0,1fr); }
    .rpi-summary { position:static; }
  }
  @media (max-width: 640px) {
    .rpi-hero { padding:18px; }
    .rpi-field-row, .rpi-urgency { grid-template-columns:minmax(0,1fr); }
    .rpi-tabs { display:flex; }
    .rpi-tab { flex:1; justify-content:center; padding:9px 8px; }
  }
`];
const PAGE_SCRIPTS: string[] = [
  "../components/header.js",
  "../api/report_issue.js"
];
const PAGE_BODY_HTML = `
  <div id="header-placeholder"></div>

  <main class="main-content rpi">
    <section class="rpi-hero">
      <div class="rpi-hero-main">
        <span class="rpi-hero-icon"><span class="material-icons" aria-hidden="true">support_agent</span></span>
        <div>
          <h1>แจ้งปัญหาการใช้งาน</h1>
          <p>เจอปัญหาในระบบ แจ้งเจ้าหน้าที่คณะได้ที่นี่ และติดตามความคืบหน้าของเรื่องที่แจ้งได้ตลอด</p>
        </div>
      </div>
      <div class="rpi-hero-stats" aria-label="สรุปเรื่องที่เคยแจ้ง">
        <div class="rpi-hero-stat"><b id="rpi-stat-open">0</b><span>รอดำเนินการ</span></div>
        <div class="rpi-hero-stat"><b id="rpi-stat-progress">0</b><span>กำลังดำเนินการ</span></div>
        <div class="rpi-hero-stat"><b id="rpi-stat-resolved">0</b><span>แก้ไขแล้ว</span></div>
      </div>
    </section>

    <div class="rpi-tabs" role="tablist" aria-label="แจ้งปัญหา">
      <button type="button" class="rpi-tab" role="tab" id="rpi-tab-new" aria-controls="rpi-view-new" aria-selected="true" onclick="window.rpiSwitchTab('new')">
        <span class="material-icons" aria-hidden="true">edit_note</span>แจ้งเรื่องใหม่
      </button>
      <button type="button" class="rpi-tab" role="tab" id="rpi-tab-history" aria-controls="rpi-view-history" aria-selected="false" onclick="window.rpiSwitchTab('history')">
        <span class="material-icons" aria-hidden="true">history</span>เรื่องที่เคยแจ้ง <span class="rpi-tab-count" id="rpi-history-count">0</span>
      </button>
    </div>

    <div id="rpi-success" class="rpi-alert" role="status" hidden>
      <span class="material-icons" aria-hidden="true">check_circle</span><span id="rpi-success-text"></span>
    </div>

    <!-- ===== แจ้งเรื่องใหม่ ===== -->
    <section id="rpi-view-new" role="tabpanel" aria-labelledby="rpi-tab-new">
      <div class="rpi-layout">
        <div>
          <div class="rpi-panel">
            <div class="rpi-step">
              <span class="rpi-step-no">1</span>
              <div><h2>ปัญหาเกี่ยวกับเรื่องอะไร?</h2><small>เลือก 1 หมวดที่ใกล้เคียงที่สุด เพื่อส่งต่อเจ้าหน้าที่ได้ถูกคน</small></div>
            </div>
            <div class="rpi-cats" id="rpi-cats" role="radiogroup" aria-label="ประเภทปัญหา"></div>
            <div class="rpi-error" data-error="category"></div>
          </div>

          <div class="rpi-panel is-disabled" id="rpi-details">
            <div class="rpi-step">
              <span class="rpi-step-no">2</span>
              <div><h2>เล่ารายละเอียด</h2><small>ยิ่งละเอียด เจ้าหน้าที่ยิ่งแก้ได้เร็ว</small></div>
            </div>

            <div class="rpi-field-row">
              <div class="rpi-field">
                <label class="rpi-label" for="rpi-title"><span>หัวข้อ <span class="req">*</span></span><span class="rpi-count" id="rpi-title-count">0/120</span></label>
                <input id="rpi-title" class="rpi-input" maxlength="120" placeholder="สรุปปัญหาสั้น ๆ เช่น อัปโหลด CV แล้วขึ้นข้อผิดพลาด" />
                <div class="rpi-error" data-error="title"></div>
              </div>
              <div class="rpi-field">
                <label class="rpi-label" for="rpi-page">หน้าที่พบปัญหา</label>
                <select id="rpi-page" class="rpi-select"></select>
              </div>
            </div>

            <div class="rpi-field">
              <label class="rpi-label" for="rpi-detail"><span>รายละเอียด <span class="req">*</span></span><span class="rpi-count" id="rpi-detail-count">0/1000</span></label>
              <textarea id="rpi-detail" class="rpi-textarea" maxlength="1000" placeholder="1) ทำอะไรอยู่ก่อนเกิดปัญหา&#10;2) เกิดอะไรขึ้น / ข้อความผิดพลาดที่เห็น&#10;3) สิ่งที่ควรจะเป็น"></textarea>
              <div class="rpi-error" data-error="detail"></div>
            </div>

            <div class="rpi-field">
              <span class="rpi-label">ความเร่งด่วน</span>
              <div class="rpi-urgency" id="rpi-urgency" role="radiogroup" aria-label="ความเร่งด่วน">
                <button type="button" class="rpi-urg" role="radio" aria-checked="false" data-urgency="LOW"><i style="background:#22C55E"></i><span><b>ต่ำ</b><small>ใช้งานต่อได้ ไม่รีบ</small></span></button>
                <button type="button" class="rpi-urg" role="radio" aria-checked="true" data-urgency="MEDIUM"><i style="background:#F59E0B"></i><span><b>ปานกลาง</b><small>บางส่วนใช้ไม่ได้</small></span></button>
                <button type="button" class="rpi-urg" role="radio" aria-checked="false" data-urgency="HIGH"><i style="background:#EF4444"></i><span><b>สูง</b><small>ทำขั้นตอนต่อไม่ได้ / ใกล้กำหนดส่ง</small></span></button>
              </div>
            </div>

            <div class="rpi-field">
              <span class="rpi-label">แนบภาพหน้าจอ / ไฟล์ประกอบ</span>
              <div class="rpi-files" id="rpi-files">
                <button type="button" class="rpi-file-btn" id="rpi-file-btn" onclick="document.getElementById('rpi-file-input').click()">
                  <span class="material-icons" aria-hidden="true">add_photo_alternate</span>เพิ่มไฟล์
                </button>
              </div>
              <input type="file" id="rpi-file-input" accept=".png,.jpg,.jpeg,.pdf" multiple hidden />
              <span class="rpi-hint">PNG, JPG หรือ PDF ไฟล์ละไม่เกิน 5MB สูงสุด 3 ไฟล์</span>
              <div class="rpi-error" data-error="files"></div>
            </div>

            <label class="rpi-check"><input type="checkbox" id="rpi-contact" checked /> ให้เจ้าหน้าที่ติดต่อกลับทางอีเมลมหาวิทยาลัยได้</label>
          </div>
        </div>

        <aside class="rpi-panel rpi-summary" aria-label="สรุปก่อนส่ง">
          <h3><span class="material-icons" aria-hidden="true">fact_check</span>ตรวจสอบก่อนส่ง</h3>
          <dl>
            <dt>ประเภท</dt><dd id="rpi-sum-category" class="empty">ยังไม่เลือก</dd>
            <dt>หัวข้อ</dt><dd id="rpi-sum-title" class="empty">-</dd>
            <dt>หน้า</dt><dd id="rpi-sum-page">-</dd>
            <dt>เร่งด่วน</dt><dd id="rpi-sum-urgency">ปานกลาง</dd>
            <dt>ไฟล์แนบ</dt><dd id="rpi-sum-files">ไม่มี</dd>
          </dl>
          <button type="button" class="rpi-submit" id="rpi-submit" disabled onclick="window.rpiSubmit()">
            <span class="material-icons" aria-hidden="true">send</span><span id="rpi-submit-text">ส่งเรื่อง</span>
          </button>
          <button type="button" class="rpi-reset" onclick="window.rpiReset()">ล้างฟอร์ม</button>
          <ul class="rpi-tips">
            <li><span class="material-icons" aria-hidden="true">photo_camera</span>แนบภาพหน้าจอช่วยให้แก้ได้เร็วขึ้น</li>
            <li><span class="material-icons" aria-hidden="true">lock</span>ห้ามแนบรหัสผ่านหรือข้อมูลส่วนตัวที่ไม่จำเป็น</li>
          </ul>
        </aside>
      </div>
    </section>

    <!-- ===== เรื่องที่เคยแจ้ง ===== -->
    <section id="rpi-view-history" role="tabpanel" aria-labelledby="rpi-tab-history" hidden>
      <div class="rpi-filter" id="rpi-filter" role="group" aria-label="กรองตามสถานะ">
        <button type="button" aria-pressed="true" data-status="">ทั้งหมด</button>
        <button type="button" aria-pressed="false" data-status="OPEN">รอดำเนินการ</button>
        <button type="button" aria-pressed="false" data-status="IN_PROGRESS">กำลังดำเนินการ</button>
        <button type="button" aria-pressed="false" data-status="RESOLVED">แก้ไขแล้ว</button>
      </div>
      <div class="rpi-history" id="rpi-history">
        <div class="rpi-empty"><span class="material-icons" aria-hidden="true">hourglass_empty</span>กำลังโหลด...</div>
      </div>
    </section>
  </main>
`;

export default function ReportIssuePage() {
  return (
    <PageShell
      pageKey="report_issue"
      title={PAGE_TITLE}
      styles={PAGE_STYLES}
      scripts={PAGE_SCRIPTS}
      bodyHtml={PAGE_BODY_HTML}
    />
  );
}
