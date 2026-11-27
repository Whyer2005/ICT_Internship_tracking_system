"use client";

import React from "react";
import PageShell from "./PageShell";

// หน้า "การแจ้งเตือน" ใช้ร่วมทุกโรล (นิสิต / อาจารย์ที่ปรึกษา / อาจารย์รายวิชา / เจ้าหน้าที่)
// เนื้อหาตามโรลที่กำลังใช้งาน (activeRole) — สคริปต์: src/client/api/notifications_page.ts
// กระดิ่ง + helper แสดงผล: src/client/components/notification_bell.ts
const PAGE_TITLE = "การแจ้งเตือน - คณะ ICT ม.พะเยา";
const PAGE_STYLES: string[] = [`
  .ntfp { --ntf-ink:#0F172A; --ntf-muted:#64748B; --ntf-line:#E2E8F0; --ntf-brand:#1541D2; --ntf-tonal:#E8F0FE; }
  .ntfp-hero {
    display:flex; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap;
    padding:22px 26px; margin-bottom:16px; border-radius:20px; color:#fff;
    background: radial-gradient(circle at 85% 20%, rgba(255,255,255,.18), transparent 45%), linear-gradient(120deg, #1E1B4B 0%, #4338CA 55%, #1541D2 100%);
  }
  .ntfp-hero-main { display:flex; align-items:center; gap:16px; min-width:0; }
  .ntfp-hero-icon { width:54px; height:54px; flex:none; display:grid; place-items:center; border-radius:16px; background:rgba(255,255,255,.16); }
  .ntfp-hero-icon .material-icons { font-size:30px; }
  .ntfp-hero h1 { margin:0; font-size:22px; font-weight:800; }
  .ntfp-hero p { margin:4px 0 0; font-size:13px; color:#E0E7FF; }
  .ntfp-hero-stats { display:flex; gap:10px; flex-wrap:wrap; }
  .ntfp-hero-stat { min-width:96px; padding:10px 14px; border-radius:14px; background:rgba(255,255,255,.14); text-align:center; }
  .ntfp-hero-stat b { display:block; font-size:20px; line-height:1.2; }
  .ntfp-hero-stat span { font-size:11.5px; color:#E0E7FF; }

  /* แถบตัวกรอง: แท็บสถานะการอ่าน (ซ้าย) · ประเภทตามโรล + ค้นหา + อ่านทั้งหมด (ขวา) */
  .ntfp-filters { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:12px 14px; margin-bottom:14px; background:#fff; border:1px solid var(--ntf-line); border-radius:18px; box-shadow:0 2px 10px rgba(15,23,42,.04); }
  .ntfp-filters-right { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .ntfp-tabs { display:inline-flex; gap:4px; padding:4px; border-radius:14px; background:#F1F5F9; border:1px solid var(--ntf-line); }
  .ntfp-tab { display:inline-flex; align-items:center; gap:4px; padding:7px 14px; border:0; border-radius:10px; background:transparent; color:#475569; font:inherit; font-size:13.5px; font-weight:600; cursor:pointer; white-space:nowrap; }
  .ntfp-tab[aria-selected="true"] { background:#fff; color:var(--ntf-brand); font-weight:700; box-shadow:0 2px 8px rgba(15,23,42,.08); }
  .ntfp-select, .ntfp-search input { height:40px; border:1px solid var(--ntf-line); border-radius:12px; background:#fff; color:var(--ntf-ink); font:inherit; font-size:13.5px; }
  .ntfp-select { min-width:170px; padding:0 34px 0 14px; appearance:none; cursor:pointer;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='%2364748B'%3E%3Cpath d='M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z'/%3E%3C/svg%3E");
    background-repeat:no-repeat; background-position:right 10px center; }
  .ntfp-select[hidden] { display:none; }
  .ntfp-search { position:relative; display:flex; align-items:center; }
  .ntfp-search .material-icons { position:absolute; left:11px; font-size:19px; color:#64748B; pointer-events:none; }
  .ntfp-search input { width:240px; padding:0 12px 0 36px; }
  .ntfp-search input::placeholder { color:#94A3B8; }
  .ntfp-tab:focus-visible, .ntfp-btn:focus-visible, .ntfp-select:focus-visible, .ntfp-search input:focus-visible { outline:3px solid #A5B4FC; outline-offset:2px; }
  .ntfp-btn { display:inline-flex; align-items:center; gap:6px; height:40px; padding:0 14px; border:0; border-radius:12px; background:var(--ntf-tonal); color:var(--ntf-brand); font:inherit; font-size:13.5px; font-weight:700; cursor:pointer; white-space:nowrap; }
  .ntfp-btn:hover { filter:brightness(.97); }
  .ntfp-btn:disabled { opacity:.55; cursor:default; }
  .ntfp-btn .material-icons { font-size:18px; }

  .ntfp-card { background:#fff; border:1px solid var(--ntf-line); border-radius:18px; box-shadow:0 2px 10px rgba(15,23,42,.05); overflow:hidden; }
  .ntfp-group { padding:12px 20px 6px; font-size:12.5px; font-weight:800; color:var(--ntf-muted); background:#FAFBFD; border-top:1px solid #F1F5F9; }
  .ntfp-group:first-child { border-top:0; }
  .ntfp-list { list-style:none; margin:0; padding:0; }
  .ntfp .ict-ntf-item { padding:14px 20px; border-top:1px solid #F1F5F9; }
  .ntfp .ict-ntf-list li:first-child .ict-ntf-item { border-top:0; }
  .ntfp .ict-ntf-title { font-size:14.5px; }
  .ntfp .ict-ntf-msg { font-size:13.5px; -webkit-line-clamp:3; }
  .ntfp .ict-ntf-ic { width:42px; height:42px; }
  .ntfp .ict-ntf-ic .material-icons { font-size:21px; }
  .ntfp-more { display:flex; justify-content:center; padding:14px; border-top:1px solid #F1F5F9; }
  .ntfp-more[hidden] { display:none; }
  .ntfp-empty { padding:56px 20px; text-align:center; color:var(--ntf-muted); }
  .ntfp-empty .big { width:84px; height:84px; margin:0 auto 14px; border-radius:50%; background:var(--ntf-tonal); color:var(--ntf-brand); display:grid; place-items:center; }
  .ntfp-empty .big .material-icons { font-size:40px; }
  .ntfp-empty h3 { margin:0 0 4px; color:var(--ntf-ink); font-size:17px; }
  .ntfp-empty p { margin:0; font-size:13.5px; }

  @media (max-width: 640px) {
    .ntfp-hero { padding:18px; }
    .ntfp-hero h1 { font-size:19px; }
    .ntfp-hero-stats { width:100%; }
    .ntfp-hero-stat { flex:1; min-width:0; }
    .ntfp-filters { flex-direction:column; align-items:stretch; }
    .ntfp-filters-right { flex-direction:column; align-items:stretch; }
    .ntfp-tabs { width:100%; }
    .ntfp-tab { flex:1; justify-content:center; padding:7px 8px; }
    .ntfp-select, .ntfp-search, .ntfp-search input { width:100%; }
    .ntfp-btn { justify-content:center; }
    .ntfp .ict-ntf-item { padding:12px 14px; }
    .ntfp-group { padding:10px 14px 6px; }
  }
`];
const PAGE_SCRIPTS: string[] = [
  "../components/header.js",
  "../components/notification_bell.js",
  "../api/notifications_page.js"
];
const PAGE_BODY_HTML = `
  <div id="header-placeholder"></div>

  <main class="main-content ntfp">
    <section class="ntfp-hero" aria-labelledby="ntfp-title">
      <div class="ntfp-hero-main">
        <div class="ntfp-hero-icon"><span class="material-icons" aria-hidden="true">notifications_active</span></div>
        <div>
          <h1 id="ntfp-title">การแจ้งเตือน</h1>
          <p id="ntfp-subtitle">กำลังโหลด...</p>
        </div>
      </div>
      <div class="ntfp-hero-stats">
        <div class="ntfp-hero-stat"><b id="ntfp-stat-unread">-</b><span>ยังไม่อ่าน</span></div>
        <div class="ntfp-hero-stat"><b id="ntfp-stat-total">-</b><span>ทั้งหมด</span></div>
      </div>
    </section>

    <div class="ntfp-filters" role="search" aria-label="กรองการแจ้งเตือน">
      <div class="ntfp-tabs" role="tablist" aria-label="กรองตามสถานะการอ่าน">
        <button type="button" class="ntfp-tab" role="tab" aria-selected="true" data-status="all">ทั้งหมด <span data-count="all"></span></button>
        <button type="button" class="ntfp-tab" role="tab" aria-selected="false" data-status="unread">ยังไม่อ่าน <span data-count="unread"></span></button>
        <button type="button" class="ntfp-tab" role="tab" aria-selected="false" data-status="read">อ่านแล้ว</button>
      </div>
      <div class="ntfp-filters-right">
        <select class="ntfp-select" id="ntfp-category" aria-label="ประเภทการแจ้งเตือน">
          <option value="">ทุกประเภท</option>
        </select>
        <select class="ntfp-select" id="ntfp-major" aria-label="สาขาของนิสิต" hidden>
          <option value="">ทุกสาขา</option>
        </select>
        <label class="ntfp-search">
          <span class="material-icons" aria-hidden="true">search</span>
          <input type="search" id="ntfp-search" placeholder="ค้นหาชื่อนิสิต / รหัส / บริษัท" aria-label="ค้นหาการแจ้งเตือน" maxlength="100" autocomplete="off">
        </label>
        <button type="button" class="ntfp-btn" id="ntfp-readall"><span class="material-icons" aria-hidden="true">done_all</span>อ่านทั้งหมดแล้ว</button>
      </div>
    </div>

    <section class="ntfp-card" aria-live="polite" aria-busy="true" id="ntfp-card">
      <div id="ntfp-list"></div>
      <div class="ntfp-more" id="ntfp-more" hidden>
        <button type="button" class="ntfp-btn" id="ntfp-more-btn"><span class="material-icons" aria-hidden="true">expand_more</span>โหลดเพิ่ม</button>
      </div>
    </section>
  </main>
`;

export default function NotificationsPage() {
  return (
    <PageShell
      pageKey="notifications"
      title={PAGE_TITLE}
      styles={PAGE_STYLES}
      scripts={PAGE_SCRIPTS}
      bodyHtml={PAGE_BODY_HTML}
    />
  );
}
