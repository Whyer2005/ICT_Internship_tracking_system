"use client";

import React from "react";
import PageShell from "./PageShell";
import FloatingNotification from "../FloatingNotification";
import { ICT_MAJORS, majorLabel, majorOptionsHtml, ictMajorsDataScript } from "../../utils/majors";
import { jobPositionsDataScript } from "../../utils/jobPositions";
import { thaiProvincesDataScript } from "../../utils/thaiProvinces";

const PAGE_TITLE = "Super Admin (พี่จอม) & อาจารย์ประจำวิชา - คณะ ICT ม.พะเยา";
const PAGE_STYLES: string[] = [`
  #admin-dashboard {
    --admin-ink: #0F172A;
    --admin-muted: #64748B;
    --admin-border: #E2E8F0;
    --admin-primary: #3730A3;
    width: 100%;
    min-height: calc(100vh - 70px);
    background: #F4F6FB;
    color: var(--admin-ink);
    font-size: 16px;
    line-height: 1.6;
  }

  #admin-dashboard .admin-layout {
    display: grid;
    width: 100%;
    grid-template-columns: 280px minmax(0, 1fr);
    min-height: calc(100vh - 70px);
    margin: 0;
  }

  #admin-dashboard .admin-layout.no-sidebar {
    grid-template-columns: 1fr !important;
  }

  #admin-dashboard .admin-layout.no-sidebar .admin-sidebar {
    display: none !important;
  }

  #admin-dashboard .admin-sidebar {
    position: sticky;
    top: 70px;
    display: flex;
    width: 280px;
    height: calc(125vh - 70px);
    min-height: 540px;
    flex-direction: column;
    overflow-y: auto;
    border-right: 1px solid var(--admin-border);
    background: #FFFFFF;
    box-sizing: border-box;
  }

  #admin-dashboard .admin-brand {
    display: flex;
    min-height: 76px;
    align-items: center;
    gap: 12px;
    padding: 14px 22px;
    border-bottom: 1px solid var(--admin-border);
  }

  #admin-dashboard .admin-brand-mark {
    display: grid;
    width: 40px;
    height: 40px;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 10px;
    background: var(--admin-primary);
    color: #FFFFFF;
    font-size: 13px;
    font-weight: 800;
  }

  #admin-dashboard .admin-brand-title {
    overflow: hidden;
    color: var(--admin-ink);
    font-size: 18px;
    font-weight: 700;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  #admin-dashboard .admin-brand-subtitle {
    margin-top: 2px;
    color: var(--admin-muted);
    font-size: 15px;
  }

  #admin-dashboard .admin-nav-label {
    padding: 22px 26px 10px;
    color: #94A3B8;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  #admin-dashboard .admin-workspace-nav {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 0 14px 18px;
  }

  #admin-dashboard .admin-workspace-nav button {
    display: flex !important;
    width: 100%;
    min-height: 50px;
    align-items: center;
    justify-content: flex-start;
    gap: 12px !important;
    padding: 11px 13px !important;
    border: 1px solid transparent !important;
    border-radius: 8px !important;
    background: transparent !important;
    color: #64748B !important;
    cursor: pointer;
    font-family: inherit;
    font-size: 16px !important;
    font-weight: 500 !important;
    text-align: left;
    transition: background 0.15s ease, color 0.15s ease;
  }

  #admin-dashboard .admin-workspace-nav button:hover {
    background: #F8FAFC !important;
    color: var(--admin-ink) !important;
  }

  #admin-dashboard .admin-workspace-nav button[aria-current="page"] {
    border-left: 3px solid var(--admin-primary) !important;
    background: #EEF2FF !important;
    color: var(--admin-primary) !important;
    font-weight: 700 !important;
  }

  #admin-dashboard .admin-workspace-nav button > .material-icons {
    flex: 0 0 auto;
    font-size: 21px !important;
  }

  #admin-dashboard .admin-workspace-nav button > span:nth-child(2) {
    flex: 1;
  }

  #admin-dashboard .admin-nav-badge {
    flex: 0 0 auto;
    margin-left: auto;
    padding: 3px 8px;
    border: 1px solid var(--admin-border);
    border-radius: 6px;
    background: #F1F5F9;
    color: #475569;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }

  #admin-dashboard #badge-pending-companies,
  #admin-dashboard #badge-doc-queue {
    border-color: #FDE68A;
    background: #FEF3C7;
    color: #B45309;
  }

  #admin-dashboard .admin-sidebar-note {
    margin: auto 16px 16px;
    padding: 15px;
    border: 1px solid var(--admin-border);
    border-radius: 10px;
    background: #F8FAFC;
    color: var(--admin-muted);
    font-size: 15px;
    line-height: 1.6;
  }

  #admin-dashboard .admin-sidebar-note strong {
    display: block;
    margin-bottom: 3px;
    color: var(--admin-primary);
    font-size: 15px;
  }

  #admin-dashboard .admin-main {
    display: block;
    width: 100%;
    max-width: none !important;
    min-width: 0;
    margin: 0 !important;
    /* !important: กันไม่ให้ .main-content { padding: 0 20px !important } ใน modern-ict.css ทับ
       ระยะด้านข้างเท่าหน้านิสิต (status-all) · ด้านบน 24px เท่ากันทุกแท็บ */
    padding: 24px clamp(22px, 3vw, 44px) 52px !important;
    box-sizing: border-box;
  }

  #admin-dashboard .admin-role-button {
    display: inline-flex;
    min-height: 44px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 9px 15px;
    border: 1px solid var(--admin-border);
    border-radius: 9px;
    background: #FFFFFF;
    color: #334155;
    cursor: pointer;
    font-family: inherit;
    font-size: 16px;
    font-weight: 600;
    transition: background 0.15s ease;
  }

  #admin-dashboard .admin-role-button:hover {
    background: #F8FAFC;
  }

  #admin-dashboard .admin-student-tabs {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #E2E8F0;
  }

  #admin-dashboard .admin-student-tabs #btn-manage-staff-roles {
    margin-left: auto;
  }

  #admin-dashboard .admin-student-tabs .tab-pill {
    min-height: 44px;
    padding: 9px 14px !important;
    font-size: 15px !important;
  }

  #admin-dashboard .admin-student-tabs .tab-pill .material-icons {
    font-size: 20px !important;
  }

  #admin-dashboard .admin-student-tabs .tab-pill span[class*="text-["] {
    font-size: 13px !important;
  }

  #admin-dashboard .admin-main .card {
    margin-top: 0 !important;
    margin-bottom: 18px !important;
    border: 1px solid var(--admin-border) !important;
    border-radius: 12px !important;
    background: #FFFFFF !important;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.035) !important;
  }

  #admin-dashboard .admin-main .card-header {
    min-height: 68px;
    padding: 18px 24px !important;
    border-bottom-color: rgba(255, 255, 255, 0.1) !important;
    background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #2563eb 100%) !important;
  }

  #admin-dashboard .admin-main .card-header .card-title,
  #admin-dashboard .admin-main .card-header p {
    color: #FFFFFF !important;
  }

  #admin-dashboard .admin-main .card-header .header-icon {
    background: rgba(255, 255, 255, 0.14);
    color: #FFFFFF !important;
  }

  #admin-dashboard .admin-main .card-header .card-title {
    font-size: 20px !important;
  }

  #admin-dashboard .admin-main .card-header .header-icon {
    padding: 6px;
    border-radius: 8px;
  }

  #admin-dashboard .admin-main .card-body {
    padding: 24px !important;
  }

  #admin-dashboard .admin-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 18px;
    margin-bottom: 24px;
    margin-top: 0; /* ระยะด้านบนมาจาก padding ของ .admin-main แล้ว */
  }

  #admin-dashboard .admin-summary-card {
    min-width: 0;
    padding: 19px 21px 16px;
    border: 1px solid var(--admin-border);
    border-radius: 10px;
    background: #FFFFFF;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.025);
  }

  #admin-dashboard .admin-summary-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: var(--admin-muted);
    font-size: 15px;
    font-weight: 500;
  }

  #admin-dashboard .admin-summary-icon {
    font-size: 18px;
  }

  #admin-dashboard .admin-summary-value {
    margin-top: 8px;
    color: var(--admin-ink);
    font-size: 36px;
    font-weight: 700;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
  }

  #admin-dashboard .admin-summary-footnote {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid #F1F5F9;
    color: #94A3B8;
    font-size: 14px;
    line-height: 1.5;
  }

  #admin-dashboard .admin-summary-error {
    margin: -8px 0 18px;
    padding: 10px 13px;
    border: 1px solid #FECACA;
    border-radius: 8px;
    background: #FEF2F2;
    color: #B91C1C;
    font-size: 15px;
    line-height: 1.5;
  }

  #admin-dashboard .admin-summary-card--primary .admin-summary-icon {
    color: #4F46E5;
  }

  #admin-dashboard .admin-summary-card--success .admin-summary-icon {
    color: #059669;
  }

  #admin-dashboard .admin-summary-card--warning .admin-summary-icon {
    color: #D97706;
  }

  #admin-dashboard .admin-summary-card--danger .admin-summary-icon {
    color: #E11D48;
  }

  #admin-dashboard .admin-student-table-scroll {
    overflow-x: auto;
    border: 1px solid #F1F5F9;
    border-radius: 8px;
  }

  #admin-dashboard .admin-student-table {
    min-width: 980px;
    font-size: 16px;
  }

  #admin-dashboard .admin-student-table thead th {
    background: #F8FAFC !important;
    color: #64748B !important;
    font-size: 15px;
    font-weight: 600 !important;
    white-space: nowrap;
    border-bottom: 1px solid var(--admin-border) !important;
  }

  #admin-dashboard .admin-student-table tbody td {
    font-size: 16px;
    padding: 16px 14px !important;
    border-bottom-color: #F1F5F9 !important;
  }

  #admin-dashboard .admin-student-table tbody td .text-xs {
    font-size: 14px !important;
  }

  #admin-dashboard .admin-student-table tbody td [class*="text-[11px]"] {
    font-size: 14px !important;
    line-height: 1.45;
  }

  #admin-dashboard .admin-student-table tbody tr:hover {
    background: #F8FAFC !important;
  }

  #admin-dashboard .admin-main .input-field {
    min-height: 46px;
    border-radius: 8px !important;
    border-color: #CBD5E1 !important;
    background-color: #FFFFFF;
    font-size: 16px !important;
  }

  #admin-dashboard .admin-main .filter-bar {
    gap: 10px !important;
  }

  #admin-dashboard #pending-companies-bulk-actions {
    flex-wrap: nowrap !important;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  #admin-dashboard #pending-companies-selected-count {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  #admin-dashboard #pending-companies-bulk-actions > div {
    flex: 1 0 auto;
    flex-wrap: nowrap !important;
    justify-content: flex-end;
    gap: 8px !important;
  }

  #admin-dashboard #pending-companies-bulk-actions button,
  #admin-dashboard #pending-companies-bulk-merge-target {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  #admin-dashboard #pending-companies-bulk-merge-target {
    width: 356px;
    max-width: 356px;
  }

  #admin-dashboard .admin-main #active-action-buttons,
  #admin-dashboard .admin-main #dropped-action-buttons {
    gap: 9px !important;
  }

  #admin-dashboard .admin-main #active-action-buttons > button,
  #admin-dashboard .admin-main #dropped-action-buttons > button {
    min-height: 44px;
    padding: 9px 15px !important;
    border-radius: 8px !important;
    font-size: 14px !important;
  }

  #admin-dashboard .admin-main .data-table th {
    font-size: 15px;
  }

  #admin-dashboard .admin-main .data-table td {
    font-size: 16px;
    padding-top: 15px;
    padding-bottom: 15px;
  }

  #admin-dashboard :is(#workspace-unlock, #workspace-events, #workspace-companies, #workspace-documents, #workspace-coop) {
    font-size: 16px;
    line-height: 1.6;
  }

  #admin-dashboard :is(#workspace-unlock, #workspace-events, #workspace-companies, #workspace-documents, #workspace-coop) .card-title {
    font-size: 20px !important;
  }

  #admin-dashboard :is(#workspace-unlock, #workspace-events, #workspace-companies, #workspace-documents, #workspace-coop) .data-table th {
    font-size: 15px !important;
  }

  #admin-dashboard :is(#workspace-unlock, #workspace-events, #workspace-companies, #workspace-documents, #workspace-coop) .data-table td {
    font-size: 16px !important;
    line-height: 1.55;
  }

  #admin-dashboard :is(#workspace-unlock, #workspace-events, #workspace-companies, #workspace-documents, #workspace-coop) .input-field {
    font-size: 16px !important;
  }

  #admin-dashboard :is(#workspace-unlock, #workspace-events, #workspace-companies, #workspace-documents, #workspace-coop) button {
    font-size: 15px !important;
  }

  #admin-dashboard :is(#workspace-unlock, #workspace-events, #workspace-companies, #workspace-documents, #workspace-coop)
    :is(.text-xs, .text-sm, [class*="text-[10px]"], [class*="text-[11px]"], [class*="text-[12px]"]) {
    font-size: 14px !important;
    line-height: 1.5;
  }

  #admin-dashboard :is(#workspace-unlock, #workspace-events, #workspace-companies, #workspace-documents, #workspace-coop)
    :is(
      [style*="font-size:10px"]:not(.material-icons),
      [style*="font-size:11px"]:not(.material-icons),
      [style*="font-size:11.5px"]:not(.material-icons),
      [style*="font-size:12px"]:not(.material-icons),
      [style*="font-size:12.5px"]:not(.material-icons),
      [style*="font-size:13px"]:not(.material-icons),
      [style*="font-size:13.5px"]:not(.material-icons),
      [style*="font-size:14px"]:not(.material-icons)
    ) {
    font-size: 15px !important;
    line-height: 1.5;
  }

  @media (max-width: 1000px) {
    #admin-dashboard .admin-layout {
      grid-template-columns: 250px minmax(0, 1fr);
    }

    #admin-dashboard .admin-summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    #admin-dashboard .admin-sidebar {
      width: 250px;
    }

    #admin-dashboard .admin-sidebar-note {
      margin-right: 12px;
      margin-left: 12px;
      padding: 10px;
    }
  }

  @media (max-width: 760px) {
    #admin-dashboard .admin-layout {
      display: block;
      min-height: 0;
    }

    #admin-dashboard .admin-sidebar {
      position: static;
      width: 100%;
      height: auto;
      min-height: 0;
      overflow: visible;
      border-right: 0;
      border-bottom: 1px solid var(--admin-border);
    }

    #admin-dashboard .admin-brand {
      min-height: 62px;
      padding: 8px 16px;
    }

    #admin-dashboard .admin-brand-mark {
      width: 36px;
      height: 36px;
    }

    #admin-dashboard .admin-nav-label,
    #admin-dashboard .admin-sidebar-note {
      display: none;
    }

    #admin-dashboard .admin-workspace-nav {
      flex-direction: row;
      overflow-x: auto;
      padding: 8px 12px;
      scrollbar-width: thin;
    }

    #admin-dashboard .admin-workspace-nav button {
      width: auto;
      min-width: max-content;
      min-height: 46px;
    }

    #admin-dashboard .admin-main {
      padding: 20px 14px 32px !important;
    }
  }

  @media (max-width: 520px) {
    #admin-dashboard .admin-summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    #admin-dashboard .admin-summary-card {
      padding: 14px;
    }

    #admin-dashboard .admin-summary-value {
      font-size: 26px;
    }

    #admin-dashboard .admin-role-button {
      width: 100%;
    }

    #admin-dashboard .admin-student-tabs #btn-manage-staff-roles {
      width: auto;
      margin-left: auto;
    }

    #admin-dashboard .admin-main .card-header {
      padding: 15px 16px !important;
    }

    #admin-dashboard .admin-main .card-body {
      padding: 18px !important;
    }

    #admin-dashboard .admin-main .card-body {
      padding: 15px !important;
    }
  }
  .status-group-header {
    pointer-events: none;
    user-select: none;
    font-size: 11px;
    font-weight: 700;
    color: #475569;
    background: #F8FAFC;
    padding: 6px 12px;
    border-top: 1px solid #E2E8F0;
    border-bottom: 1px solid #E2E8F0;
    margin-top: 4px;
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    gap: 6px;
    letter-spacing: 0.2px;
  }
  .status-option {
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 400;
    color: #1E1B4B;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.1s ease, color 0.1s ease;
    white-space: nowrap;
    line-height: 1.4;
  }
  .status-option:hover {
    background-color: #F1F5F9;
  }
  .status-option.selected {
    background-color: #2563EB !important;
    color: #FFFFFF !important;
    font-weight: 400 !important;
  }

  /* ===== แถบค้นหา/ตัวกรองรายชื่อนิสิต (แถวบน: ค้นหา + เรียง / แถวล่าง: ตัวกรองแบบการ์ด) ===== */
  #admin-dashboard .adm-filter { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
  #admin-dashboard .adm-filter-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  #admin-dashboard .adm-search {
    flex: 1 1 320px; min-width: 0; height: 44px; display: flex; align-items: center; gap: 8px;
    padding: 0 10px 0 14px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; cursor: text;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  #admin-dashboard .adm-search:focus-within { border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); }
  #admin-dashboard .adm-search > .material-icons { font-size: 20px; color: #94A3B8; }
  #admin-dashboard .adm-search input {
    flex: 1; min-width: 0; height: 100%; border: 0; outline: none; background: transparent;
    font-size: 14px; color: #0F172A; font-family: inherit;
  }
  #admin-dashboard .adm-search input::placeholder { color: #94A3B8; }
  #admin-dashboard .adm-search kbd {
    min-width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center;
    font-size: 12px; font-family: inherit; color: #64748B; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px;
  }
  #admin-dashboard .adm-sort {
    position: relative; flex: 0 0 auto; height: 44px; display: flex; align-items: center; gap: 6px;
    padding: 0 12px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; cursor: pointer;
  }
  #admin-dashboard .adm-sort > .material-icons:first-child { font-size: 18px; color: #E11D48; transform: rotate(-20deg); }
  #admin-dashboard .adm-sort select {
    appearance: none; -webkit-appearance: none; border: 0; outline: none; background: transparent;
    padding-right: 22px; font-size: 13.5px; font-weight: 700; color: #0F172A; font-family: inherit; cursor: pointer;
  }
  #admin-dashboard .adm-sort .adm-chevron { position: absolute; right: 10px; font-size: 18px; color: #64748B; pointer-events: none; }
  #admin-dashboard .adm-clear-link {
    flex: 0 0 auto; padding: 6px 4px; background: none; border: 0; color: #2563EB;
    font-size: 13.5px; font-weight: 700; cursor: pointer; white-space: nowrap;
  }
  #admin-dashboard .adm-clear-link:hover { text-decoration: underline; }

  #admin-dashboard .adm-filter-grid { display: flex; flex-wrap: wrap; gap: 10px; }
  #admin-dashboard .adm-filter-field {
    position: relative; flex: 1 1 140px; min-width: 0; display: flex; flex-direction: column; gap: 2px;
    padding: 8px 12px 6px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px;
    transition: background-color 0.15s, border-color 0.15s;
  }
  #admin-dashboard .adm-filter-field[data-filter="major-filter"] { flex: 1.8 1 220px; }
  #admin-dashboard .adm-filter-field:focus-within { border-color: #93C5FD; }
  #admin-dashboard .adm-filter-label { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #64748B; }
  #admin-dashboard .adm-filter-label .material-icons { font-size: 15px; }
  #admin-dashboard .adm-filter-select {
    width: 100%; min-height: 26px; padding: 0 22px 0 0; border: 0; outline: none; appearance: none; -webkit-appearance: none;
    background: transparent url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23475569' stroke-width='1.6' fill='none'/%3E%3C/svg%3E") no-repeat right 2px center;
    font-size: 14px; font-weight: 700; color: #0F172A; font-family: inherit; cursor: pointer;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  #admin-dashboard .adm-status { position: relative; }
  #admin-dashboard .adm-status-btn { display: flex; align-items: center; justify-content: space-between; gap: 4px; text-align: left; background-image: none; }
  #admin-dashboard .adm-status-btn #status-filter-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #admin-dashboard .adm-status-btn .material-icons { font-size: 18px; color: #475569; }
  #admin-dashboard .adm-status-menu {
    position: absolute; top: calc(100% + 8px); left: -12px; width: max-content; min-width: calc(100% + 24px); z-index: 1050;
    padding: 4px 0; max-height: 340px; overflow-y: auto; background: #FFFFFF; border: 1px solid #CBD5E1; border-radius: 8px;
    box-shadow: 0 8px 24px -4px rgba(15,23,42,0.12), 0 2px 6px -1px rgba(15,23,42,0.06);
  }
  /* ปุ่ม × แสดงเฉพาะตัวกรองที่ใช้งานอยู่ */
  #admin-dashboard .adm-filter-x {
    position: absolute; top: 6px; right: 8px; width: 20px; height: 20px; display: none; align-items: center; justify-content: center;
    padding: 0; background: none; border: 0; border-radius: 999px; color: #2563EB; cursor: pointer;
  }
  #admin-dashboard .adm-filter-x .material-icons { font-size: 16px; }
  #admin-dashboard .adm-filter-x:hover { background: #DBEAFE; }
  #admin-dashboard .adm-filter-field.is-active { background: #EFF6FF; border-color: #93C5FD; }
  #admin-dashboard .adm-filter-field.is-active .adm-filter-label,
  #admin-dashboard .adm-filter-field.is-active .adm-filter-select { color: #1D4ED8; }
  #admin-dashboard .adm-filter-field.is-active .adm-filter-x { display: inline-flex; }
  @media (max-width: 640px) {
    #admin-dashboard .adm-sort { flex: 1 1 auto; }
    #admin-dashboard .adm-filter-field { flex-basis: calc(50% - 5px); }
    #admin-dashboard .adm-filter-field[data-filter="major-filter"] { flex-basis: 100%; }
  }
`];
const PAGE_SCRIPTS: string[] = [
  "../components/header.js",
  "../api/admin_dashboard.js",
  "../api/admin_coop_postings.js"
];
const PAGE_BODY_HTML = `
${ictMajorsDataScript()}
${jobPositionsDataScript()}
${thaiProvincesDataScript()}
  <div id="header-placeholder"></div>
  <div id="admin-dashboard">
    <div class="admin-layout" id="admin-layout">
      <aside class="admin-sidebar" id="admin-sidebar" aria-label="เมนูผู้ดูแลระบบ">
        <div class="admin-brand">
          <div class="admin-brand-mark" aria-hidden="true">ICT</div>
          <div>
            <div class="admin-brand-title">ระบบเตรียมฝึกงาน</div>
            <div class="admin-brand-subtitle">Super Admin · ICT UP</div>
          </div>
        </div>
        <div class="admin-nav-label">เมนูจัดการ</div>
        <nav class="admin-workspace-nav" aria-label="ส่วนงานผู้ดูแล">
          <button type="button" id="ws-tab-overview" aria-current="page" onclick="switchAdminWorkspace('overview')">
            <span class="material-icons" aria-hidden="true">grid_view</span>
            <span>ภาพรวม &amp; รายชื่อนิสิต</span>
          </button>
          <button type="button" id="ws-tab-events" aria-current="false" onclick="switchAdminWorkspace('events')">
            <span class="material-icons" aria-hidden="true">event_available</span>
            <span>กิจกรรมอบรม &amp; Check-in</span>
            <span id="badge-events-count" class="admin-nav-badge">2 กิจกรรม</span>
          </button>
          <button type="button" id="ws-tab-checklist" aria-current="false" onclick="switchAdminWorkspace('checklist')">
            <span class="material-icons" aria-hidden="true">fact_check</span>
            <span>ตั้งค่า Checklist บริษัท</span>
            <span id="badge-checklist-version" class="admin-nav-badge">v1.0</span>
          </button>
          <button type="button" id="ws-tab-companies" aria-current="false" onclick="switchAdminWorkspace('companies')">
            <span class="material-icons" aria-hidden="true">business</span>
            <span>ฐานข้อมูลบริษัท</span>
            <span id="badge-pending-companies" class="admin-nav-badge">0 รอยืนยัน</span>
          </button>
          <button type="button" id="ws-tab-coopjobs" aria-current="false" onclick="switchAdminWorkspace('coopjobs')">
            <span class="material-icons" aria-hidden="true">campaign</span>
            <span>ประกาศสหกิจศึกษา</span>
            <span id="badge-coop-postings" class="admin-nav-badge">…</span>
          </button>
          <button type="button" id="ws-tab-documents" aria-current="false" onclick="switchAdminWorkspace('documents')">
            <span class="material-icons" aria-hidden="true">description</span>
            <span>ออกหนังสือ &amp; ใบตอบรับ</span>
            <span id="badge-doc-queue" class="admin-nav-badge">0 รายการ</span>
          </button>
          <button type="button" id="ws-tab-unlock" aria-current="false" onclick="switchAdminWorkspace('unlock')">
            <span class="material-icons" aria-hidden="true">lock_open</span>
            <span>รอบฝึกงาน &amp; ปลดล็อก</span>
            <span id="badge-unlocked-majors" class="admin-nav-badge">4/8 เปิด</span>
          </button>
          <button type="button" id="ws-tab-coop" aria-current="false" onclick="switchAdminWorkspace('coop')">
            <span class="material-icons" aria-hidden="true">cloud_upload</span>
            <span>ส่งต่อระบบ Co-op</span>
          </button>
          
        </nav>
        <div class="admin-sidebar-note">
          <strong>ศูนย์กลางคณะ ICT</strong>
          จัดการข้อมูลการฝึกงานและสหกิจศึกษาครบทั้ง 8 สาขาวิชา
        </div>
      </aside>
      <main class="main-content admin-main">
    <!-- =====================================================================
         WORKSPACE 1: ภาพรวม & รายชื่อนิสิต (Overview, REG Import & Student Management)
         ===================================================================== -->
    <div id="workspace-overview">
      <section class="admin-summary-grid" aria-label="สรุปภาพรวมนิสิต">
        <article class="admin-summary-card admin-summary-card--primary">
          <div class="admin-summary-label">
            <span>นิสิตทั้งหมด</span>
            <span class="material-icons admin-summary-icon" aria-hidden="true">school</span>
          </div>
          <div class="admin-summary-value" id="kpi-total-students">—</div>
          <div class="admin-summary-footnote">นิสิตที่กำลังศึกษาและฝึกงาน</div>
        </article>
        <article class="admin-summary-card admin-summary-card--success">
          <div class="admin-summary-label">
            <span>อนุมัติที่ฝึกงานแล้ว</span>
            <span class="material-icons admin-summary-icon" aria-hidden="true">task_alt</span>
          </div>
          <div class="admin-summary-value" id="kpi-placement-approved">—</div>
          <div class="admin-summary-footnote">นิสิตที่ผ่านการอนุมัติสถานที่ฝึกงาน</div>
        </article>
        <article class="admin-summary-card admin-summary-card--warning">
          <div class="admin-summary-label">
            <span>รอพิจารณาสถานที่</span>
            <span class="material-icons admin-summary-icon" aria-hidden="true">schedule</span>
          </div>
          <div class="admin-summary-value" id="kpi-placement-pending">—</div>
          <div class="admin-summary-footnote">รายการที่รออาจารย์ตรวจสอบ</div>
        </article>
        <article class="admin-summary-card admin-summary-card--danger">
          <div class="admin-summary-label">
            <span>ยังไม่มีอาจารย์ที่ปรึกษา</span>
            <span class="material-icons admin-summary-icon" aria-hidden="true">person_off</span>
          </div>
          <div class="admin-summary-value" id="kpi-students-without-advisor">—</div>
          <div class="admin-summary-footnote">นิสิตที่ยังไม่ได้รับมอบหมายอาจารย์</div>
        </article>
      </section>
      <p id="admin-summary-error" class="admin-summary-error" role="status" hidden></p>

      <!-- Student registry -->
      <section class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-icons header-icon">people</span>
            <h2 class="card-title">รายชื่อนิสิตและสถานะการฝึกงาน</h2>
            <span id="active-filter-badge" style="display:none; background:#FEF3C7; color:#B45309; font-size:12px; padding:2px 10px; border-radius:999px; font-weight:600;"></span>
          </div>
          <div id="active-action-buttons" style="display:flex; gap:6px; flex-wrap:wrap;">
            <button id="btn-import-student" class="btn btn-sm" onclick="openImportModal()" style="background:#10B981; color:white; border:1px solid #10B981; font-size:12px; padding:7px 13px; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-weight:600;">
              <span class="material-icons" style="font-size:15px;">upload_file</span> นำเข้ารายชื่อ (Excel)
            </button>
            <button id="btn-set-advisor" class="btn btn-sm" onclick="openSetAdvisorModal()" style="background:#FFFFFF; color:#1E40AF; border:1px solid #BFDBFE; font-size:12px; padding:7px 12px; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-weight:600;">
              <span class="material-icons" style="font-size:15px;">person_add</span> ตั้งอาจารย์ที่ปรึกษา
            </button>
            <button id="btn-set-status" class="btn btn-sm" onclick="openSetStatusModal()" style="background:#FFFFFF; color:#334155; border:1px solid #CBD5E1; font-size:12px; padding:7px 12px; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
              <span class="material-icons" style="font-size:15px;">edit_note</span> ตั้งสถานะนิสิต
            </button>
            <button id="btn-set-supervisor" class="btn btn-sm" onclick="openSetSupervisorModal()" style="background:#FFFFFF; color:#334155; border:1px solid #CBD5E1; font-size:12px; padding:7px 12px; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
              <span class="material-icons" style="font-size:14px;">explore</span> ตั้งอาจารย์นิเทศก์
            </button>
            <button id="btn-drop-student" class="btn btn-sm" onclick="openDropStudentModal()" style="background:#FFFFFF; color:#BE123C; border:1px solid #FDA4AF; font-size:12px; padding:7px 12px; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
              <span class="material-icons" style="font-size:14px;">person_remove</span> ดรอปนิสิต
            </button>
            <button id="btn-export-student" class="btn btn-sm" onclick="exportStudents()" style="background:#FFFFFF; color:#334155; border:1px solid #CBD5E1; font-size:12px; padding:7px 12px; border-radius:8px; cursor:pointer;">
              ส่งออกข้อมูล
            </button>
          </div>
          <div id="dropped-action-buttons" style="display:none; gap:8px; flex-wrap:wrap;">
            <button id="btn-restore-student" class="btn btn-sm" onclick="openRestoreStudentModal()" style="background:#047857; color:white; border:1px solid #047857; font-size:12px; padding:7px 14px; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
              <span class="material-icons" style="font-size:14px;">restore</span> กู้คืนสถานะนิสิต
            </button>
            <button class="btn btn-sm" onclick="exportStudents()" style="background:#FFFFFF; color:#334155; border:1px solid #CBD5E1; font-size:12px; padding:7px 14px; border-radius:8px; cursor:pointer;">
              ส่งออกรายชื่อ
            </button>
          </div>
        </div>
        <div class="card-body">

          <!-- Tab สลับมุมมอง: นิสิตปกติ vs นิสิตที่ดรอป -->
          <div class="admin-student-tabs">
            <button id="tab-active" onclick="switchStudentTab('active')" class="tab-pill px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 bg-white text-blue-700 shadow-sm cursor-pointer border border-blue-200">
              <span class="material-icons" style="font-size:16px;">check_circle</span>
              นิสิตกำลังศึกษา / ฝึกงาน
              <span id="tab-badge-active" class="px-2 py-0.5 text-[11px] rounded-full bg-blue-100 text-blue-800 font-bold">0</span>
            </button>
            <button id="tab-dropped" onclick="switchStudentTab('dropped')" class="tab-pill px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 text-gray-500 hover:text-gray-800 cursor-pointer border border-transparent bg-transparent">
              <span class="material-icons" style="font-size:16px;">remove_circle_outline</span>
              นิสิตที่ดรอป / ถอนรายวิชา
              <span id="tab-badge-dropped" class="px-2 py-0.5 text-[11px] rounded-full bg-red-100 text-red-700 font-bold">0</span>
            </button>
            <button id="btn-manage-staff-roles" class="admin-role-button" type="button" onclick="openStaffRolesModal()">
              <span class="material-icons" aria-hidden="true">manage_accounts</span>
              <span>จัดการสิทธิ์บุคลากร</span>
            </button>
          </div>

          <!-- Filter & Search Bar (รองรับ 8 สาขาวิชาของคณะ ICT) -->
          <!-- แถวบน: ค้นหา (กด / เพื่อโฟกัส) + การเรียง + ล้างตัวกรอง / แถวล่าง: ตัวกรองแบบการ์ด (ตัวที่ใช้งานอยู่เป็นสีฟ้า + ปุ่ม × ล้างเฉพาะตัว) -->
          <div class="adm-filter">
            <div class="adm-filter-top">
              <label class="adm-search">
                <span class="material-icons" aria-hidden="true">search</span>
                <input type="text" id="student-search" placeholder="ค้นหารหัสนิสิต, ชื่อ หรือบริษัท..." autocomplete="off" />
                <kbd title="กด / เพื่อค้นหา">/</kbd>
              </label>
              <label class="adm-sort">
                <span class="material-icons" aria-hidden="true">push_pin</span>
                <select id="sort-by" aria-label="การเรียงลำดับ">
                  <option value="critical" selected>เรียง: ต้องติดตาม ➔ พร้อมฝึกงาน</option>
                  <option value="studentCode_desc">เรียง: รหัสนิสิต (มาก ➔ น้อย)</option>
                  <option value="studentCode_asc">เรียง: รหัสนิสิต (น้อย ➔ มาก)</option>
                  <option value="name_asc">เรียง: ชื่อ-นามสกุล (ก-ฮ)</option>
                </select>
                <span class="material-icons adm-chevron" aria-hidden="true">expand_more</span>
              </label>
              <button id="btn-clear-filter" type="button" class="adm-clear-link" onclick="clearAllFilters()">ล้างตัวกรอง</button>
            </div>

            <div class="adm-filter-grid">
              <div class="adm-filter-field" data-filter="major-filter" data-default="ALL">
                <span class="adm-filter-label"><span class="material-icons" aria-hidden="true">school</span>สาขา</span>
                <select id="major-filter" class="adm-filter-select" aria-label="สาขา">
                  <option value="ALL">ทุกสาขา (คณะ ICT)</option>
                  ${majorOptionsHtml("              ")}
                </select>
                <button type="button" class="adm-filter-x" onclick="window.clearOneFilter('major-filter')" aria-label="ล้างตัวกรองสาขา" title="ล้างตัวกรองนี้"><span class="material-icons" aria-hidden="true">close</span></button>
              </div>
              <div class="adm-filter-field" data-filter="year-filter">
                <span class="adm-filter-label"><span class="material-icons" aria-hidden="true">check_box</span>ชั้นปี</span>
                <select id="year-filter" class="adm-filter-select" aria-label="ชั้นปี">
                  <option value="">ทั้งหมด</option>
                </select>
                <button type="button" class="adm-filter-x" onclick="window.clearOneFilter('year-filter')" aria-label="ล้างตัวกรองชั้นปี" title="ล้างตัวกรองนี้"><span class="material-icons" aria-hidden="true">close</span></button>
              </div>
              <div class="adm-filter-field" data-filter="semester-filter">
                <span class="adm-filter-label"><span class="material-icons" aria-hidden="true">calendar_month</span>ภาคเรียน</span>
                <select id="semester-filter" class="adm-filter-select" aria-label="ภาคเรียน">
                  <option value="">ทั้งหมด</option>
                  <option value="1">ภาคเรียนที่ 1</option>
                  <option value="2" selected>ภาคเรียนที่ 2</option>
                  <option value="SUMMER">ภาคฤดูร้อน</option>
                </select>
                <button type="button" class="adm-filter-x" onclick="window.clearOneFilter('semester-filter')" aria-label="ล้างตัวกรองภาคเรียน" title="ล้างตัวกรองนี้"><span class="material-icons" aria-hidden="true">close</span></button>
              </div>
              <div class="adm-filter-field" data-filter="window-term-filter">
                <span class="adm-filter-label"><span class="material-icons" aria-hidden="true">event</span>รอบออกฝึก</span>
                <select id="window-term-filter" class="adm-filter-select" title="รอบออกฝึกที่นิสิตผูกไว้" aria-label="รอบออกฝึก">
                  <option value="">ทั้งหมด</option>
                </select>
                <button type="button" class="adm-filter-x" onclick="window.clearOneFilter('window-term-filter')" aria-label="ล้างตัวกรองรอบออกฝึก" title="ล้างตัวกรองนี้"><span class="material-icons" aria-hidden="true">close</span></button>
              </div>
              <div class="adm-filter-field" data-filter="status-filter">
                <span class="adm-filter-label"><span class="material-icons" aria-hidden="true">flag</span>สถานะ</span>
                <div id="status-dropdown-container" class="adm-status">
                  <input type="hidden" id="status-filter" value="" data-label="ทั้งหมด" />
                  <button type="button" id="status-filter-btn" class="adm-filter-select adm-status-btn" onclick="window.toggleStatusDropdown && window.toggleStatusDropdown()">
                    <span id="status-filter-label">ทั้งหมด</span>
                    <span id="status-arrow-icon" class="material-icons" aria-hidden="true">keyboard_arrow_down</span>
                  </button>
                  <div id="status-dropdown-menu" class="adm-status-menu" style="display:none;">
                    <div class="status-option selected" data-val="" onclick="window.selectStatusFilter('', 'ทั้งหมด')">ทั้งหมด</div>
                  
                    <!-- ขั้นตอนที่ 1: ตรวจเรซูเม่ (CV) -->
                    <div class="status-group-header">📄 1. ตรวจเรซูเม่ (CV)</div>
                    <div class="status-option" data-val="cv_pending" onclick="window.selectStatusFilter('cv_pending', '⏳ ยังไม่ได้รีวิว CV')">⏳ ยังไม่ได้รีวิว CV</div>
                    <div class="status-option" data-val="cv_approved" onclick="window.selectStatusFilter('cv_approved', '🟢 ตรวจ CV ผ่าน')">🟢 ตรวจ CV ผ่าน</div>
                    <div class="status-option" data-val="cv_rejected" onclick="window.selectStatusFilter('cv_rejected', '🔴 ไม่ผ่าน CV')">🔴 ไม่ผ่าน CV</div>
                    <div class="status-option" data-val="cv_none" onclick="window.selectStatusFilter('cv_none', '🔴 ยังไม่ทำ CV')">🔴 ยังไม่ทำ CV</div>
                  
                    <!-- ขั้นตอนที่ 2: Checklist สถานประกอบการ -->
                    <div class="status-group-header">🏢 2. Checklist สถานประกอบการ</div>
                    <div class="status-option" data-val="checklist_pending" onclick="window.selectStatusFilter('checklist_pending', '⏳ รอตรวจ Checklist')">⏳ รอตรวจ Checklist</div>
                    <div class="status-option" data-val="checklist_approved" onclick="window.selectStatusFilter('checklist_approved', '🟢 Checklist ผ่าน')">🟢 Checklist ผ่าน</div>
                  
                    <!-- ขั้นตอนที่ 3: ชั่วโมงอบรมเตรียมความพร้อม -->
                    <div class="status-group-header">🎓 3. ชั่วโมงอบรมเตรียมความพร้อม</div>
                    <div class="status-option" data-val="training_not_checked" onclick="window.selectStatusFilter('training_not_checked', '⏳ ชม.ครบ ยังไม่ตรวจ')">⏳ ชม.ครบ ยังไม่ตรวจ</div>
                    <div class="status-option" data-val="training_incomplete" onclick="window.selectStatusFilter('training_incomplete', '⏳ ชั่วโมงยังไม่ครบ')">⏳ ชั่วโมงยังไม่ครบ</div>
                    <div class="status-option" data-val="training_passed" onclick="window.selectStatusFilter('training_passed', '🟢 ผ่านการตรวจชม.ครบ')">🟢 ผ่านการตรวจชม.ครบ</div>
                    <div class="status-option" data-val="training_failed" onclick="window.selectStatusFilter('training_failed', '🔴 ตรวจแล้ว ยังไม่ผ่าน')">🔴 ตรวจแล้ว ยังไม่ผ่าน</div>
                  
                    <!-- ขั้นตอนที่ 4: การสัมภาษณ์ & ที่ฝึกงาน -->
                    <div class="status-group-header">💼 4. การสัมภาษณ์ &amp; ที่ฝึกงาน</div>
                    <div class="status-option" data-val="placement_pending" onclick="window.selectStatusFilter('placement_pending', '⏳ รออนุมัติที่ฝึกงาน')">⏳ รออนุมัติที่ฝึกงาน</div>
                    <div class="status-option" data-val="interview_passed" onclick="window.selectStatusFilter('interview_passed', '🟢 สัมภาษณ์ผ่านแล้ว')">🟢 สัมภาษณ์ผ่านแล้ว</div>
                    <div class="status-option" data-val="placement_approved" onclick="window.selectStatusFilter('placement_approved', '🟢 อนุมัติที่ฝึกงานแล้ว')">🟢 อนุมัติที่ฝึกงานแล้ว</div>
                    <div class="status-option" data-val="placement_rejected" onclick="window.selectStatusFilter('placement_rejected', '🔴 ไม่อนุมัติที่ฝึกงาน')">🔴 ไม่อนุมัติที่ฝึกงาน</div>
                  </div>
                </div>
                <button type="button" class="adm-filter-x" onclick="window.clearOneFilter('status-filter')" aria-label="ล้างตัวกรองสถานะ" title="ล้างตัวกรองนี้"><span class="material-icons" aria-hidden="true">close</span></button>
              </div>
              <div class="adm-filter-field" data-filter="advisor-filter">
                <span class="adm-filter-label"><span class="material-icons" aria-hidden="true">person</span>อาจารย์</span>
                <select id="advisor-filter" class="adm-filter-select" aria-label="อาจารย์ที่ปรึกษา">
                  <option value="">ทั้งหมด</option>
                </select>
                <button type="button" class="adm-filter-x" onclick="window.clearOneFilter('advisor-filter')" aria-label="ล้างตัวกรองอาจารย์" title="ล้างตัวกรองนี้"><span class="material-icons" aria-hidden="true">close</span></button>
              </div>
              <div class="adm-filter-field" data-filter="skill-filter">
                <span class="adm-filter-label"><span class="material-icons" aria-hidden="true">schedule</span>ชั่วโมง</span>
                <select id="skill-filter" class="adm-filter-select" aria-label="สถานะชั่วโมง">
                  <option value="">ทั้งหมด</option>
                  <option value="pass_all">🟢 ผ่านเกณฑ์ครบ (Soft+Hard)</option>
                  <option value="lack_soft">⚠️ ขาด Soft Skill (&lt; 12 ชม.)</option>
                  <option value="lack_hard">⚠️ ขาด Hard Skill (&lt; 18 ชม.)</option>
                  <option value="lack_both">⚠️ ขาดทั้ง Soft &amp; Hard</option>
                </select>
                <button type="button" class="adm-filter-x" onclick="window.clearOneFilter('skill-filter')" aria-label="ล้างตัวกรองชั่วโมง" title="ล้างตัวกรองนี้"><span class="material-icons" aria-hidden="true">close</span></button>
              </div>
            </div>
          </div>

          <div class="admin-student-table-scroll">
            <table class="data-table admin-student-table">
              <thead id="students-thead">
                <tr>
                  <th style="width: 14%;">รหัสนิสิต</th>
                  <th style="width: 20%;">ชื่อ-นามสกุล</th>
                  <th style="width: 17%;">สาขาวิชา</th>
                  <th style="width: 17%;">อาจารย์ที่ปรึกษา</th>
                  <th style="width: 24%;">สถานะความพร้อม &amp; การตรวจสอบ</th>
                  <th style="width: 8%; min-width: 90px;" class="text-center">
                    <label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap;" title="เลือกนักศึกษาทั้งหมดในหน้านี้">
                      <span style="font-size:12px;">เลือกทั้งหมด</span>
                      <input type="checkbox" id="select-all-students" style="width:16px;height:16px;cursor:pointer;" />
                    </label>
                  </th>
                </tr>
              </thead>
              <tbody id="students-tbody">
                <tr><td colspan="5" class="text-center py-8 text-gray-400">กำลังโหลดข้อมูล...</td></tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="flex justify-between items-center mt-4 text-xs text-gray-500">
            <span id="pagination-info">แสดง 0-0 จาก 0 รายการ</span>
            <div class="flex gap-1" id="pagination-controls"></div>
          </div>

        </div>
      </section>

      <!-- 3. รายชื่ออาจารย์ที่ปรึกษา + จำนวนนิสิต -->
      <div style="display:grid; grid-template-columns:1fr 320px; gap:24px;" class="max-md:!grid-cols-1">
        <section class="card" style="margin-bottom:0;">
          <div class="card-header" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="material-icons header-icon">supervisor_account</span>
              <h2 class="card-title">รายชื่ออาจารย์ที่ปรึกษาและภาระงานตรวจ Checklist</h2>
            </div>
            <span style="font-size:12px; color:#475569; font-weight:500; background:#F1F5F9; padding:3px 10px; border-radius:9999px; border:1px solid #CBD5E1;">
              แยกกลุ่มตามสาขาวิชา
            </span>
          </div>
          <div class="card-body">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ชื่ออาจารย์ที่ปรึกษา</th>
                  <th>จำนวนที่ปรึกษา</th>
                  <th>ตรวจ Checklist แล้ว</th>
                  <th>ยังไม่ได้ตรวจ</th>
                </tr>
              </thead>
              <tbody id="advisor-tbody">
                <tr><td colspan="4" class="text-center py-4 text-gray-400">กำลังโหลด...</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card" style="margin-bottom:0;">
          <div class="card-header">
            <span class="material-icons header-icon">groups</span>
            <h2 class="card-title">สรุปจำนวนนิสิต</h2>
          </div>
          <div class="card-body">
            <table class="data-table">
              <thead>
                <tr><th>รายการ</th><th class="text-right">จำนวน</th></tr>
              </thead>
              <tbody>
                <tr><td>นิสิตทั้งหมด</td><td class="text-right font-bold" id="summary-total">0</td></tr>
                <tr><td>มีอาจารย์ที่ปรึกษาแล้ว</td><td class="text-right text-green-600 font-semibold" id="summary-with-advisor">0</td></tr>
                <tr><td>ยังไม่มีอาจารย์ที่ปรึกษา</td><td class="text-right text-red-500 font-semibold" id="summary-without-advisor">0</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>

    <!-- =====================================================================
         WORKSPACE 2: จัดการรอบปีการศึกษา & ปลดล็อก (Unlock) ระบบยื่นฝึกงานตาม 8 สาขาวิชา
         ===================================================================== -->
    <div id="workspace-unlock" style="display:none;">
      <section class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-icons header-icon">lock_open</span>
            <div>
              <h2 class="card-title" style="margin:0;">รอบออกฝึก &amp; ปลดล็อก แยกตามรุ่นและสาขา</h2>
              <p style="margin:2px 0 0 0; font-size:12px; color:#E0E7FF;">เลือกรุ่น → กดที่สาขาเพื่อดู/แก้รอบออกฝึก (ปกติ / Summer) และปลดล็อกการยื่นบริษัท</p>
            </div>
          </div>
          <div id="cohort-header-actions" style="display:flex; gap:8px; flex-wrap:wrap;"></div>
        </div>
        <div class="card-body">
          <!-- แท็บรุ่น -->
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
            <div id="cohort-tabs" style="display:flex; gap:6px; flex-wrap:wrap;"></div>
            <button type="button" onclick="window.createCohort()" style="background:#EEF2FF; border:1px dashed #818CF8; color:#4338CA; border-radius:10px; padding:7px 12px; font-size:12.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
              <span class="material-icons" style="font-size:16px;">add</span> เพิ่มรุ่น
            </button>
            <select id="cohort-archived-select" onchange="window.selectCohort(this.value)" class="input-field" style="width:auto; margin:0 0 0 auto; font-size:12px; padding:6px 10px;">
              <option value="">ประวัติรุ่นที่ปิดแล้ว...</option>
            </select>
          </div>

          <div style="margin-bottom:12px; padding:10px 14px; background:#EEF2FF; border:1px solid #C7D2FE; border-radius:12px; font-size:12px; color:#1E1B4B; display:flex; gap:8px; align-items:flex-start;">
            <span class="material-icons" style="color:#4338CA; font-size:18px;">info</span>
            <div>
              ระหว่างที่ล็อก นิสิตยังสะสมชั่วโมงอบรมและอัปโหลด CV ได้ แต่ยื่น Checklist ไม่ได้
              • <strong>พ้นวันปิดยื่น ระบบล็อกให้อัตโนมัติ</strong> (กด "เปิดต่อพิเศษ" เพื่อขยายเวลาได้)
              • พ้นวันสิ้นสุดการฝึก หรือกด "จบรอบ" = รอบนั้นจบแล้ว
              • วันเริ่ม–สิ้นสุดการฝึกจะไปแสดงในหนังสือขอความอนุเคราะห์/หนังสือส่งตัว ("ในระหว่างวันที่ … ถึงวันที่ …")
            </div>
          </div>

          <!-- เพิ่ม/อัปเดตรอบให้สาขาที่เลือก -->
          <div id="cohort-batch-bar" style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:12px 14px; margin-bottom:12px;">
            <div style="font-size:12.5px; font-weight:800; color:#1E1B4B; margin-bottom:8px; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span class="material-icons" style="font-size:18px; color:#4F46E5;">playlist_add</span>
              เพิ่ม/อัปเดตรอบออกฝึกให้สาขาที่ติ๊กเลือก (<span id="cohort-selected-count">0</span> สาขา)
              <label style="margin-left:8px; display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:700; color:#4338CA; background:#EEF2FF; border:1px solid #C7D2FE; border-radius:8px; padding:3px 9px; cursor:pointer;">
                <input type="checkbox" id="cohort-select-all" onchange="window.toggleAllBatchMajors(this.checked)" style="width:15px; height:15px; margin:0; cursor:pointer; accent-color:#4338CA;" /> เลือกทั้งหมด
              </label>
            </div>
            <div style="display:flex; align-items:flex-end; gap:10px; flex-wrap:wrap;">
              <label style="font-size:11.5px; font-weight:700; color:#475569;">รอบเทอม
                <input type="text" id="cb-term" class="input-field" placeholder="เช่น 1/2570" style="display:block; width:95px; margin:3px 0 0; padding:6px 8px !important; font-size:12px; font-weight:700;" />
              </label>
              <label style="font-size:11.5px; font-weight:700; color:#475569;">ประเภท
                <select id="cb-type" class="input-field" style="display:block; width:auto; margin:3px 0 0; padding:6px 8px; font-size:12px;">
                  <option value="REGULAR">ภาคปกติ</option>
                  <option value="SUMMER">Summer</option>
                </select>
              </label>
              <label style="font-size:11.5px; font-weight:700; color:#475569;">เปิดยื่น
                <input type="date" id="cb-open" class="input-field" style="display:block; width:auto; margin:3px 0 0; padding:5px 8px !important; font-size:12px;" />
              </label>
              <label style="font-size:11.5px; font-weight:700; color:#475569;">ปิดยื่น
                <input type="date" id="cb-close" class="input-field" style="display:block; width:auto; margin:3px 0 0; padding:5px 8px !important; font-size:12px;" />
              </label>
              <label style="font-size:11.5px; font-weight:700; color:#475569;" title="ใช้ระบุช่วงฝึกในหนังสือขอความอนุเคราะห์/หนังสือส่งตัว และแสดงในโปรไฟล์นิสิต">เริ่มฝึก
                <input type="date" id="cb-start" class="input-field" style="display:block; width:auto; margin:3px 0 0; padding:5px 8px !important; font-size:12px;" />
              </label>
              <label style="font-size:11.5px; font-weight:700; color:#475569;">สิ้นสุดการฝึก
                <input type="date" id="cb-end" class="input-field" style="display:block; width:auto; margin:3px 0 0; padding:5px 8px !important; font-size:12px;" />
              </label>
              <button type="button" onclick="window.saveBatchWindows()" style="background:#059669; color:white; border:none; padding:9px 16px; border-radius:8px; font-size:12.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; margin-left:auto;">
                <span class="material-icons" style="font-size:17px;">save</span> บันทึกให้สาขาที่เลือก
              </button>
            </div>
          </div>

          <div id="cohort-majors" style="display:flex; flex-direction:column; gap:8px;">
            <div style="padding:18px; text-align:center; color:#94A3B8;">กำลังโหลดข้อมูลรุ่น...</div>
          </div>
        </div>
      </section>
    </div>

    <!-- =====================================================================
         WORKSPACE 3: จัดกิจกรรมอบรมภายในคณะ & ระบบ Check-in หน้างานด้วยรหัสนิสิต
         ===================================================================== -->
    <div id="workspace-events" style="display:none;">
      <div style="display:grid; grid-template-columns:460px 1fr; gap:20px;" class="max-lg:!grid-cols-1">
        <!-- ซ้าย: ฟอร์มสร้างกิจกรรมอบรมโดย พี่จอม (Super Admin) -->
        <section class="card" style="margin-bottom:0; overflow:visible !important;">
          <div class="card-header" style="border-top-left-radius:15px; border-top-right-radius:15px;">
            <span class="material-icons header-icon">add_task</span>
            <div>
              <h2 class="card-title" style="margin:0;">สร้างกิจกรรมใหม่</h2>
              <p style="margin:2px 0 0 0; font-size:11.5px; color:#E0E7FF;">เพิ่มได้หลายวัน / หลายช่วงเวลา</p>
            </div>
          </div>
          <div class="card-body" style="overflow:visible !important;">
            <div style="display:flex; flex-direction:column; gap:12px;">
              <div>
                <label style="font-size:12.5px; font-weight:700; color:#334155;">ชื่อกิจกรรม <span style="color:#EF4444;">*</span></label>
                <input type="text" id="evt-title" class="input-field" placeholder="เช่น อบรมการเขียน Resume" style="margin-top:4px;" />
              </div>

              <div>
                <label style="font-size:12.5px; font-weight:700; color:#334155;">ประเภทชั่วโมง</label>
                <select id="evt-skill-type" class="input-field" style="margin-top:4px;">
                  <option value="SOFT">Soft Skill (เกณฑ์ 12 ชม.)</option>
                  <option value="HARD">Hard Skill (เกณฑ์ 18 ชม.)</option>
                </select>
              </div>

              <!-- รายการช่วงเวลา / วันที่จัด และจำนวนชั่วโมง (Dynamic List) -->
              <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <label style="font-size:12.5px; font-weight:700; color:#1E293B; display:flex; align-items:center; gap:5px;">
                    <span class="material-icons" style="font-size:16px; color:#4338CA;">date_range</span>
                    <span>วันและเวลาอบรม</span>
                  </label>
                  <button type="button" onclick="window.addEventSession()" style="background:#EEF2FF; border:1px solid #C7D2FE; color:#4338CA; border-radius:8px; padding:4px 10px; font-size:11.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;" class="hover:bg-indigo-100">
                    <span class="material-icons" style="font-size:14px;">add</span>
                    <span>เพิ่มวัน</span>
                  </button>
                </div>

                <div id="evt-sessions-list" style="display:flex; flex-direction:column; gap:8px;">
                  <!-- Dynamic sessions injected by JS -->
                </div>

                <!-- กล่องสรุปชั่วโมงรวมทั้งกิจกรรม -->
                <div style="margin-top:10px; padding:10px 14px; background:#ECFDF5; border:1px solid #A7F3D0; border-radius:10px; display:flex; align-items:center; justify-content:space-between;">
                  <div>
                    <div style="font-size:12px; font-weight:700; color:#065F46;">ชั่วโมงรวม</div>
                    <div id="evt-hours-summary-note" style="font-size:11px; color:#047857;">ยังไม่มีช่วงเวลา</div>
                  </div>
                  <div style="text-align:right;">
                    <span id="evt-total-hours-badge" style="font-size:22px; font-weight:800; color:#059669;">0</span>
                    <span style="font-size:12px; font-weight:700; color:#065F46;"> ชม.</span>
                  </div>
                </div>
              </div>

              <div>
                <label style="font-size:12.5px; font-weight:700; color:#334155; display:flex; justify-content:space-between; align-items:center;">
                  <span>สาขาที่เข้าร่วมได้</span>
                  <span id="evt-target-major-count" style="font-size:11px; font-weight:600; color:#4338CA;">(เลือก 8 สาขา)</span>
                </label>
                <input type="hidden" id="evt-target-major" value="ALL" />
                <div id="evt-major-dropdown-container" style="position:relative; margin-top:4px;">
                  <button type="button" id="evt-major-dropdown-btn" onclick="window.toggleMajorDropdown()" class="input-field" style="width:100%; display:flex; align-items:center; justify-content:space-between; cursor:pointer; background:#FFFFFF; text-align:left; font-weight:600; color:#1E1B4B; padding:8px 12px; border:1px solid #CBD5E1; border-radius:10px;">
                    <span id="evt-major-selected-label" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px;">ทุกสาขาวิชา (ทั้งคณะ ICT)</span>
                    <span id="evt-major-arrow-icon" class="material-icons" style="font-size:18px; color:#64748B;">arrow_drop_down</span>
                  </button>
                  <div id="evt-major-dropdown-menu" style="display:none; position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:1000; background:#FFFFFF; border:1px solid #CBD5E1; border-radius:12px; box-shadow:0 12px 28px -4px rgba(15,23,42,0.18), 0 4px 10px -2px rgba(15,23,42,0.08); padding:10px; max-height:290px; overflow-y:auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 6px 8px 6px; border-bottom:1px solid #E2E8F0; margin-bottom:6px;">
                      <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:700; font-size:12.5px; color:#1E1B4B;">
                        <input type="checkbox" id="evt-major-all" onchange="window.toggleSelectAllMajors(this.checked)" checked style="width:16px; height:16px; accent-color:#4338CA; cursor:pointer;" />
                        <span>ทุกสาขาวิชา (ทั้งคณะ ICT)</span>
                      </label>
                      <button type="button" onclick="window.toggleMajorDropdown()" style="background:none; border:none; color:#64748B; font-size:11.5px; cursor:pointer; padding:2px 8px; border-radius:6px; font-weight:600; display:flex; align-items:center; gap:2px;" class="hover:bg-slate-200">
                        <span>ปิด</span>
                        <span class="material-icons" style="font-size:14px;">close</span>
                      </button>
                    </div>
                    <div id="evt-major-checkbox-list" style="display:flex; flex-direction:column; gap:2px;">
${ICT_MAJORS.map((m) => `
                      <label style="display:flex; align-items:center; gap:8px; padding:5px 8px; border-radius:8px; cursor:pointer; font-size:12.5px;" class="hover:bg-slate-100">
                        <input type="checkbox" class="evt-major-item" value="${m.name}" data-code="${m.code}" onchange="window.updateSelectedMajors()" checked style="width:15px; height:15px; accent-color:#4338CA; cursor:pointer;" />
                        <span>${majorLabel(m)}</span>
                      </label>`).join("")}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label style="font-size:12.5px; font-weight:700; color:#334155; display:flex; justify-content:space-between; align-items:center;">
                  <span>ชั้นปีที่เข้าร่วมได้</span>
                  <span id="evt-target-year-count" style="font-size:11px; font-weight:600; color:#4338CA;">(เลือกทุกชั้นปี)</span>
                </label>
                <input type="hidden" id="evt-target-year" value="ALL" />
                <div id="evt-year-dropdown-container" style="position:relative; margin-top:4px;">
                  <button type="button" id="evt-year-dropdown-btn" onclick="window.toggleYearDropdown()" class="input-field" style="width:100%; display:flex; align-items:center; justify-content:space-between; cursor:pointer; background:#FFFFFF; text-align:left; font-weight:600; color:#1E1B4B; padding:8px 12px; border:1px solid #CBD5E1; border-radius:10px;">
                    <span id="evt-year-selected-label" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px;">ทุกชั้นปี (ทุกรหัสนิสิต)</span>
                    <span id="evt-year-arrow-icon" class="material-icons" style="font-size:18px; color:#64748B;">arrow_drop_down</span>
                  </button>
                  <div id="evt-year-dropdown-menu" style="display:none; position:absolute; top:calc(100% + 4px); left:0; right:0; z-index:1000; background:#FFFFFF; border:1px solid #CBD5E1; border-radius:12px; box-shadow:0 12px 28px -4px rgba(15,23,42,0.18), 0 4px 10px -2px rgba(15,23,42,0.08); padding:10px; max-height:260px; overflow-y:auto;">
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 6px 8px 6px; border-bottom:1px solid #E2E8F0; margin-bottom:6px;">
                      <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:700; font-size:12.5px; color:#1E1B4B;">
                        <input type="checkbox" id="evt-year-all" onchange="window.toggleSelectAllYears(this.checked)" checked style="width:16px; height:16px; accent-color:#4338CA; cursor:pointer;" />
                        <span>ทุกชั้นปี (ทุกรหัสนิสิต)</span>
                      </label>
                      <button type="button" onclick="window.toggleYearDropdown()" style="background:none; border:none; color:#64748B; font-size:11.5px; cursor:pointer; padding:2px 8px; border-radius:6px; font-weight:600; display:flex; align-items:center; gap:2px;" class="hover:bg-slate-200">
                        <span>ปิด</span>
                        <span class="material-icons" style="font-size:14px;">close</span>
                      </button>
                    </div>
                    <div id="evt-year-checkbox-list" style="display:flex; flex-direction:column; gap:2px;">
                      <label style="display:flex; align-items:center; gap:8px; padding:5px 8px; border-radius:8px; cursor:pointer; font-size:12.5px;" class="hover:bg-slate-100">
                        <input type="checkbox" class="evt-year-item" value="67" onchange="window.updateSelectedYears()" checked style="width:15px; height:15px; accent-color:#4338CA; cursor:pointer;" />
                        <span>ชั้นปี 67 (ปี 3)</span>
                      </label>
                      <label style="display:flex; align-items:center; gap:8px; padding:5px 8px; border-radius:8px; cursor:pointer; font-size:12.5px;" class="hover:bg-slate-100">
                        <input type="checkbox" class="evt-year-item" value="68" onchange="window.updateSelectedYears()" checked style="width:15px; height:15px; accent-color:#4338CA; cursor:pointer;" />
                        <span>ชั้นปี 68 (ปี 2)</span>
                      </label>
                      <label style="display:flex; align-items:center; gap:8px; padding:5px 8px; border-radius:8px; cursor:pointer; font-size:12.5px;" class="hover:bg-slate-100">
                        <input type="checkbox" class="evt-year-item" value="66" onchange="window.updateSelectedYears()" checked style="width:15px; height:15px; accent-color:#4338CA; cursor:pointer;" />
                        <span>ชั้นปี 66 (ปี 4)</span>
                      </label>
                      <label style="display:flex; align-items:center; gap:8px; padding:5px 8px; border-radius:8px; cursor:pointer; font-size:12.5px;" class="hover:bg-slate-100">
                        <input type="checkbox" class="evt-year-item" value="65" onchange="window.updateSelectedYears()" checked style="width:15px; height:15px; accent-color:#4338CA; cursor:pointer;" />
                        <span>ชั้นปี 65 (ปี 5 / ตกค้าง)</span>
                      </label>
                      <label style="display:flex; align-items:center; gap:8px; padding:5px 8px; border-radius:8px; cursor:pointer; font-size:12.5px;" class="hover:bg-slate-100">
                        <input type="checkbox" class="evt-year-item" value="64" onchange="window.updateSelectedYears()" checked style="width:15px; height:15px; accent-color:#4338CA; cursor:pointer;" />
                        <span>ชั้นปี 64 (ตกค้าง)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label style="font-size:12.5px; font-weight:700; color:#334155;">สถานที่</label>
                <input type="text" id="evt-location" class="input-field" value="ห้องประชุมคณะ ICT มหาวิทยาลัยพะเยา" style="margin-top:4px;" />
              </div>

              <button type="button" onclick="createTrainingEvent()" style="background:linear-gradient(135deg, #1E1B4B 0%, #4338CA 100%); color:white; border:none; padding:11px 16px; border-radius:12px; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; margin-top:4px;">
                <span class="material-icons" style="font-size:18px;">add_circle</span>
                <span>สร้างกิจกรรม</span>
              </button>
            </div>
          </div>
        </section>

        <!-- ขวา: ระบบบันทึก Check-in ด้วยรหัสนิสิต (จากใบลงทะเบียนหน้างาน -> เข้าระบบ) -->
        <section class="card" style="margin-bottom:0;">
          <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <span class="material-icons header-icon">fact_check</span>
              <div>
                <h2 class="card-title" style="margin:0;">บันทึกผู้เข้าอบรม (Check-in)</h2>
                <p style="margin:2px 0 0 0; font-size:11.5px; color:#E0E7FF;">เลือกกิจกรรม → ใส่รหัสนิสิต → ระบบบวกชั่วโมงให้อัตโนมัติ</p>
              </div>
            </div>
          </div>
          <div class="card-body">
            <!-- เลือกกิจกรรมที่จะ Check-in -->
            <div style="margin-bottom:16px; padding:14px 16px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
                <label style="font-size:13px; font-weight:800; color:#1E293B; display:inline-flex; align-items:center; gap:8px;">
                  <span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:999px; background:#4338CA; color:white; font-size:12px; font-weight:800; flex-shrink:0;">1</span> เลือกกิจกรรม
                </label>
                <span id="filter-event-count-badge" style="font-size:11.5px; font-weight:600; color:#64748B;"></span>
              </div>

              <!-- แถบค้นหาและกรองกิจกรรม (Compact Filter Toolbar) -->
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
                <!-- 1. ค้นหาชื่อกิจกรรม -->
                <div style="flex:1; min-width:180px; position:relative;">
                  <span class="material-icons" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:18px; color:#94A3B8; pointer-events:none; z-index:1;">search</span>
                  <input type="text" id="filter-event-keyword" placeholder="ค้นหากิจกรรม..." oninput="window.applyEventFilters()" class="input-field" style="padding-left:36px !important; height:34px !important; min-height:34px !important; font-size:12px; border-radius:8px; margin:0;" />
                </div>

                <!-- 2. กรองสาขาวิชาเป้าหมาย -->
                <div style="width:160px;">
                  <select id="filter-event-major" onchange="window.applyEventFilters()" class="input-field" style="height:34px; font-size:12px; padding:4px 8px; border-radius:8px; margin:0; font-weight:600; cursor:pointer;">
                    <option value="ALL">ทุกสาขา</option>
${majorOptionsHtml("                    ")}
                  </select>
                </div>

                <!-- 2.1 กรองชั้นปีเป้าหมาย -->
                <div style="width:130px;">
                  <select id="filter-event-year" onchange="window.applyEventFilters()" class="input-field" style="height:34px; font-size:12px; padding:4px 8px; border-radius:8px; margin:0; font-weight:600; cursor:pointer;">
                    <option value="ALL">ทุกชั้นปี</option>
                    <option value="67">ปี 67 (ปี 3)</option>
                    <option value="68">ปี 68 (ปี 2)</option>
                    <option value="66">ปี 66 (ปี 4)</option>
                    <option value="65">ปี 65 (ปี 5+)</option>
                  </select>
                </div>

                <!-- 3. กรองวันที่ -->
                <div style="width:130px;">
                  <select id="filter-event-date-preset" onchange="window.handleEventDatePresetChange()" class="input-field" style="height:34px; font-size:12px; padding:4px 8px; border-radius:8px; margin:0; font-weight:600; cursor:pointer;">
                    <option value="ALL">ทุกวันที่</option>
                    <option value="TODAY">วันนี้</option>
                    <option value="THIS_MONTH">เดือนนี้</option>
                    <option value="CUSTOM">ระบุวันที่...</option>
                  </select>
                </div>

                <!-- ช่องระบุวันที่แบบกำหนดเอง (แสดงเมื่อเลือก CUSTOM) -->
                <input type="date" id="filter-event-custom-date" onchange="window.applyEventFilters()" class="input-field" style="display:none; width:130px; height:34px; font-size:12px; padding:4px 8px; border-radius:8px; margin:0;" />

                <!-- 4. ปุ่มล้างค่าตัวกรอง -->
                <button type="button" onclick="window.resetEventFilters()" title="ล้างตัวกรองทั้งหมด" style="height:34px; padding:0 10px; background:#F1F5F9; border:1px solid #CBD5E1; border-radius:8px; font-size:12px; font-weight:600; color:#475569; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:all 0.15s;" class="hover:bg-slate-200">
                  <span class="material-icons" style="font-size:15px;">refresh</span>
                  <span>ล้างค่า</span>
                </button>
              </div>

              <select id="checkin-event-select" class="input-field" onchange="renderSelectedEventCheckins()" style="font-weight:700; color:#1E1B4B;"></select>
              <div id="checkin-selected-event-meta" style="margin-top:10px; padding:10px 12px; background:#FFFFFF; border:1px solid #E2E8F0; border-radius:10px; font-size:12px; color:#475569;"></div>

              <!-- เลือกช่วงเวลา/วันที่ ที่ต้องการ Check-in (รองรับ Option 1 แยกวัน/แยกช่วง) -->
              <div id="checkin-session-select-container" style="margin-top:10px; padding-top:10px; border-top:1px dashed #CBD5E1;">
                <label style="font-size:12px; font-weight:700; color:#1E293B; display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                  <span>บันทึกให้ช่วงไหน</span>
                  <span id="checkin-session-hours-badge" style="font-size:11px; font-weight:700; background:#E0E7FF; color:#3730A3; padding:2px 8px; border-radius:999px;"></span>
                </label>
                <select id="checkin-session-select" class="input-field" onchange="window.handleCheckInSessionChange()" style="font-size:12.5px; font-weight:600; color:#1E1B4B;">
                  <option value="ALL">ทุกช่วง</option>
                </select>
                <div id="checkin-session-hint" style="font-size:11px; color:#64748B; margin-top:3px;"></div>
              </div>
            </div>

            <!-- กล่องกรอก/วางรหัสนิสิตจากใบเซ็นชื่อหน้างาน -->
            <div style="margin-bottom:18px; padding:16px; background:#EEF2FF; border:1px solid #C7D2FE; border-radius:14px;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; margin-bottom:8px;">
                <div>
                  <label style="font-size:13px; font-weight:800; color:#1E1B4B; display:inline-flex; align-items:center; gap:8px; margin-bottom:4px;">
                    <span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:999px; background:#4338CA; color:white; font-size:12px; font-weight:800; flex-shrink:0;">2</span> ใส่รหัสนิสิต
                  </label>
                  <p style="font-size:11.5px; color:#4338CA; margin:0;">
                    พิมพ์หรือวางรหัส คั่นด้วย , หรือเว้นวรรค — หรือนำเข้าจากไฟล์
                  </p>
                </div>
                <button type="button" onclick="openCheckInImportModal()" style="background:linear-gradient(135deg, #065F46 0%, #10B981 100%); color:white; border:none; padding:8px 14px; border-radius:10px; font-size:12.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; white-space:nowrap; box-shadow:0 4px 12px rgba(16,185,129,0.25);">
                  <span class="material-icons" style="font-size:17px;">upload_file</span>
                  <span>นำเข้า Excel / CSV</span>
                </button>
              </div>
              <div style="display:flex; gap:10px; align-items:stretch;" class="max-md:flex-col">
                <textarea id="checkin-student-codes" class="input-field" rows="3" placeholder="เช่น 67023110, 67023111" style="flex:1; font-family:monospace; font-size:13px;"></textarea>
                <div style="display:flex; flex-direction:column; gap:6px; justify-content:center;">
                  <button type="button" onclick="submitEventCheckIn()" style="background:#10B981; color:white; border:none; padding:12px 18px; border-radius:12px; font-size:13px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; white-space:nowrap; height:100%;">
                    <span class="material-icons" style="font-size:18px;">how_to_reg</span>
                    <span>บันทึก Check-in</span>
                  </button>
                </div>
              </div>
              <div id="checkin-result-banner" style="display:none; margin-top:10px; padding:10px 14px; border-radius:10px; font-size:12.5px; font-weight:600;"></div>
            </div>

            <!-- ตารางรายชื่อนิสิตที่ Check-in ในกิจกรรมนี้แล้ว -->
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
                <h4 style="font-size:13px; font-weight:800; color:#1E293B; margin:0; display:inline-flex; align-items:center; gap:8px;">
                  <span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:999px; background:#4338CA; color:white; font-size:12px; font-weight:800; flex-shrink:0;">3</span> ผู้เข้าร่วมแล้ว <span style="background:#EEF2FF; color:#4338CA; padding:1px 8px; border-radius:999px; font-size:12px;"><span id="checkin-list-count">0</span> คน</span>
                </h4>
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <label for="checkin-filter-major" style="font-size:12px; font-weight:700; color:#475569;">สาขา</label>
                    <select id="checkin-filter-major" class="input-field" onchange="window.filterCheckInList()" style="padding:4px 10px; font-size:12px; width:auto; min-width:145px; height:32px; font-weight:600; cursor:pointer;">
                      <option value="ALL">ทุกสาขา</option>
                    </select>
                  </div>
                  <div style="display:flex; align-items:center; gap:6px;">
                    <label for="checkin-filter-year" style="font-size:12px; font-weight:700; color:#475569;">ชั้นปี</label>
                    <select id="checkin-filter-year" class="input-field" onchange="window.filterCheckInList()" style="padding:4px 10px; font-size:12px; width:auto; min-width:130px; height:32px; font-weight:600; cursor:pointer;">
                      <option value="ALL">ทุกชั้นปี</option>
                    </select>
                  </div>
                </div>
              </div>
              <div style="max-height:280px; overflow-y:auto; border:1px solid #E2E8F0; border-radius:12px;">
                <table class="data-table" style="margin:0;">
                  <thead>
                    <tr>
                      <th>รหัสนิสิต</th>
                      <th>ชื่อ - นามสกุล</th>
                      <th>สาขาวิชา</th>
                      <th>ช่วง</th>
                      <th class="text-center">ชั่วโมง</th>
                      <th>บันทึกเมื่อ</th>
                      <th class="text-center" style="width:140px; white-space:nowrap;">
                        <div style="display:inline-flex; align-items:center; gap:6px; justify-content:center;">
                          <span>จัดการ</span>
                          <button type="button" id="btn-delete-all-checkin" onclick="window.deleteAllEventCheckIns()" title="ลบทั้งหมดตามที่กำลังแสดง" style="background:#FEE2E2; border:1px solid #FECACA; color:#DC2626; border-radius:6px; padding:3px 8px; font-size:11px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:all 0.15s ease;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                            <span id="btn-delete-all-text">ลบทั้งหมด</span>
                          </button>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody id="checkin-history-tbody">
                    <tr><td colspan="7" class="text-center py-6 text-gray-400">ยังไม่มีรายการ Check-in ในกิจกรรมนี้</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- =====================================================================
         WORKSPACE 4: ระบบฐานข้อมูลสถานประกอบการกลาง (Company Master Data)
         ===================================================================== -->
    <div id="workspace-companies" style="display:none;">
      <!-- ส่วนที่ 1: ตารางฐานข้อมูลสถานประกอบการกลาง (Verified Master Data) -->
      <section class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px; min-width:0;">
            <span class="material-icons header-icon">domain_verification</span>
            <div style="min-width:0;">
              <h2 class="card-title" style="margin:0;">ฐานข้อมูลสถานประกอบการกลาง (Company Master Data)</h2>
              <p style="margin:2px 0 0 0; font-size:12px; color:#E0E7FF;">รายชื่อสถานประกอบการมาตรฐานสำหรับให้นิสิตค้นหาและเลือกอัตโนมัติในขั้นตอนทำ Checklist</p>
            </div>
          </div>
          <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px; flex-shrink:0;">
            <button type="button" onclick="openCompanyImportModal()" style="background:#10B981; color:white; border:none; padding:8px 16px; border-radius:10px; font-size:12.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">
              <span class="material-icons" style="font-size:16px;">upload_file</span> นำเข้าบริษัท (Excel)
            </button>
            <button type="button" onclick="openAddMasterCompanyModal()" style="background:#10B981; color:white; border:none; padding:8px 16px; border-radius:10px; font-size:12.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">
              <span class="material-icons" style="font-size:16px;">add_business</span> เพิ่มสถานประกอบการเข้า Master Data
            </button>
            <button type="button" id="master-companies-toggle"
              onclick="window.toggleMasterCompanies(event)"
              aria-expanded="true" aria-controls="master-companies-tbody"
              aria-label="ย่อรายการบริษัท"
              title="ย่อรายการบริษัท"
              style="width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.55); border-radius:8px; color:#1E3A8A; background:#FFFFFF; cursor:pointer; padding:0; flex-shrink:0;">
              <span id="master-companies-toggle-icon" class="material-icons" style="transition:transform 180ms ease; transform:rotate(180deg);">expand_more</span>
            </button>
          </div>
        </div>
        <div class="card-body">
          <div style="display:flex; justify-content:center; align-items:center; margin-bottom:14px;">
            <div style="position:relative; width:min(800px, 65vw);">
              <input type="search" id="master-company-search" class="input-field"
                placeholder="ค้นหาชื่อบริษัท (ไทย/อังกฤษ), จังหวัด หรือตำแหน่งงาน..."
                aria-label="ค้นหาสถานประกอบการใน Master Data"
                oninput="window.searchMasterCompanies()"
                style="width:100%; padding:8px 34px 8px 14px !important; color:#0F172A; background:#FFFFFF; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
              <button type="button" id="master-company-search-clear"
                onclick="window.clearMasterCompanySearch(event)"
                aria-label="ล้างคำค้นหา"
                style="display:none; position:absolute; right:6px; top:50%; transform:translateY(-50%); border:0; background:transparent; color:#64748B; font-size:18px; line-height:1; cursor:pointer; padding:4px;">×</button>
            </div>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:24%;">ชื่อสถานประกอบการ (มาตรฐาน)</th>
                <th style="width:11%;">จังหวัด</th>
                <th style="width:22%;">ผู้ติดต่อ (HR) / เบอร์โทร</th>
                <th style="width:19%;">ตำแหน่งงานที่เปิดรับ</th>
                <th style="width:12%;" class="text-center">สถานะ</th>
                <th style="width:12%;" class="text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody id="master-companies-tbody">
              <tr><td colspan="6" class="text-center py-6 text-gray-400">กำลังโหลดฐานข้อมูลบริษัท...</td></tr>
            </tbody>
          </table>
          <div id="master-companies-pagination" style="display:flex; align-items:center; justify-content:flex-end; gap:12px; margin-top:12px; color:#475569; font-size:12px;"></div>
        </div>
      </section>

      <!-- ส่วนที่ 2: รายการสถานประกอบการใหม่รออนุมัติ (Pending Master Data) -->
      <section class="card" id="pending-companies-section">
        <div class="card-header" style="background:linear-gradient(135deg, #92400E 0%, #D97706 100%); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
            <span class="material-icons header-icon">notification_important</span>
            <div style="min-width:0;">
              <h2 class="card-title" style="margin:0;">รายการสถานประกอบการใหม่รออนุมัติ (Pending Master Data)</h2>
              <p style="margin:2px 0 0 0; font-size:12px; color:#FEF3C7;">
                ตรวจสอบข้อมูลที่นิสิตกรอกใหม่ ปรับชื่อให้เป็นมาตรฐาน หรือยุบรวมกับสถานประกอบการเดิมเพื่อลดข้อมูลซ้ำซ้อน
              </p>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;" onclick="event.stopPropagation()">
            <button type="button" id="pending-companies-toggle"
              onclick="window.togglePendingCompanies(event)"
              aria-expanded="true" aria-controls="pending-companies-content"
              aria-label="ย่อหรือขยายรายการบริษัท"
              style="width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.55); border-radius:8px; color:#92400E; background:#FFFFFF; cursor:pointer; padding:0; flex-shrink:0;">
              <span id="pending-companies-toggle-icon" class="material-icons" style="transition:transform 180ms ease; transform:rotate(180deg);">expand_more</span>
            </button>
          </div>
        </div>
        <div id="pending-companies-content" style="overflow:hidden; opacity:1; max-height:5000px; transition:max-height 220ms ease, opacity 180ms ease;">
          <div class="card-body">
            <div style="display:flex; justify-content:center; align-items:center; margin-bottom:14px;">
              <div style="position:relative; width:min(800px, 65vw);">
                <input type="search" id="pending-companies-search" class="input-field"
                  placeholder="ค้นหาชื่อบริษัท / ที่อยู่ / รหัสอ้างอิง / นิสิต..."
                  aria-label="ค้นหาบริษัท"
                  oninput="window.setPendingCompanySearch(event)"
                  style="width:100%; padding:8px 34px 8px 14px !important; color:#0F172A; background:#FFFFFF; border:1px solid #CBD5E1; border-radius:8px; font-size:13px; box-sizing:border-box;" />
                <button type="button" id="pending-companies-search-clear"
                  onclick="window.clearPendingCompanySearch(event)"
                  aria-label="ล้างคำค้นหา"
                  style="display:none; position:absolute; right:6px; top:50%; transform:translateY(-50%); border:0; background:transparent; color:#64748B; font-size:18px; line-height:1; cursor:pointer; padding:4px;">×</button>
              </div>
            </div>
            <div id="pending-companies-bulk-actions" style="display:none; align-items:center; gap:12px; flex-wrap:nowrap; margin-bottom:12px; padding:10px 12px; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:8px;">
              <span id="pending-companies-selected-count" style="font-size:13px; font-weight:600; color:#1E40AF;"></span>
              <div style="display:flex; align-items:center; gap:12px;">
                <button type="button" id="pending-companies-bulk-confirm" onclick="window.confirmSelectedPendingCompanies(event)"
                  style="background:#10B981; color:white; border:none; padding:7px 12px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                  <span class="material-icons" style="font-size:15px;">check_circle</span>
                  <span id="pending-companies-bulk-confirm-label"></span>
                </button>
                <button type="button" id="pending-companies-bulk-merge" onclick="window.mergeSelectedPendingCompanies(event)"
                  style="background:#4338CA; color:white; border:none; padding:7px 12px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                  <span class="material-icons" style="font-size:15px;">merge_type</span>
                  <span id="pending-companies-bulk-merge-label"></span>
                </button>
                <select id="pending-companies-bulk-merge-target" class="input-field" aria-label="เลือกบริษัทปลายทางสำหรับยุบรวมรายการที่เลือก"
                  style="font-size:12px; width:356px; min-width:356px; max-width:356px; padding:7px 10px !important;">
                  <option value="">-- หรือเลือกยุบรวมเข้ากับบริษัทเดิมที่มีอยู่แล้ว --</option>
                </select>
                <button type="button" id="pending-companies-clear-selection" onclick="window.clearPendingCompanySelection(event)"
                  style="border:0; background:transparent; color:#2563EB; font-size:12px; font-weight:600; cursor:pointer; padding:6px;">ล้างการเลือก</button>
              </div>
            </div>
            <div id="pending-companies-bulk-toast" role="status" aria-live="polite" style="display:none; margin-bottom:12px; padding:9px 12px; border-radius:8px; font-size:13px;"></div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:20%;">ชื่อบริษัทที่นิสิตกรอกเข้ามา</th>
                  <th style="width:20%;">ที่อยู่สถานประกอบการ / จังหวัด</th>
                  <th style="width:14%;">นิสิตที่ยื่นเพิ่ม</th>
                  <th style="width:22%;">ปรับชื่อมาตรฐาน / ยุบรวมกับบริษัทเดิม</th>
                  <th style="width:18%;" class="text-center">การอนุมัติเข้า Master Data</th>
                  <th style="width:85px; min-width:85px;" class="text-center">
                    <label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap;" title="เลือกบริษัททั้งหมดในหน้านี้">
                      <span style="font-size:12px;">เลือกทั้งหมด</span>
                      <input type="checkbox" id="select-all-pending-companies" aria-label="เลือกทั้งหมด" style="width:16px;height:16px;cursor:pointer;" />
                    </label>
                  </th>
                </tr>
              </thead>
              <tbody id="pending-companies-tbody">
                <tr><td colspan="6" class="text-center py-6 text-gray-400">ไม่มีรายการบริษัทใหม่รออนุมัติ</td></tr>
              </tbody>
            </table>
            <div id="pending-companies-pagination" style="display:flex; align-items:center; justify-content:flex-end; gap:12px; margin-top:12px; color:#475569; font-size:12px;"></div>
          </div>
        </div>
      </section>
    </div>

    <!-- =====================================================================
         WORKSPACE 4.1: ประกาศรับนิสิตสหกิจศึกษา (เจ้าหน้าที่เพิ่ม / แก้ / ปิดรับ / นำเข้า Excel) — logic: admin_coop_postings.js
         ===================================================================== -->
    <div id="workspace-coopjobs" style="display:none;">
      <section class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px; min-width:0;">
            <span class="material-icons header-icon">campaign</span>
            <div style="min-width:0;">
              <h2 class="card-title" style="margin:0;">ประกาศรับนิสิตสหกิจศึกษา</h2>
              <p style="margin:2px 0 0 0; font-size:12px; color:#E0E7FF;">นิสิตทุกคนเห็นตารางนี้ในแท็บ "สหกิจศึกษา" (ไม่แสดงข้อมูลผู้ติดต่อ HR) · 1 ประกาศ = 1 บริษัท · รอบ/ช่วงฝึก/วันปิดยื่น ตามรอบออกฝึกของแต่ละสาขา · GPAX ขั้นต่ำ 2.00</p>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <button type="button" onclick="window.openCoopImportModal()" style="background:#10B981; color:white; border:none; padding:8px 16px; border-radius:10px; font-size:12.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">
              <span class="material-icons" style="font-size:16px;">upload_file</span> นำเข้าประกาศ (Excel)
            </button>
            <button type="button" onclick="window.openCoopPostingModal()" style="background:#FFFFFF; color:#1E1B4B; border:none; padding:8px 16px; border-radius:10px; font-size:12.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">
              <span class="material-icons" style="font-size:16px;">add</span> เพิ่มประกาศ
            </button>
          </div>
        </div>
        <div class="card-body">
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:12px;">
            <input type="search" id="coop-posting-search" class="input-field" oninput="window.renderCoopPostings()" placeholder="ค้นหาบริษัท ตำแหน่ง หรือจังหวัด..." aria-label="ค้นหาประกาศสหกิจ" style="flex:1 1 240px; margin:0; font-size:13px;" />
            <select id="coop-posting-status" class="input-field" onchange="window.renderCoopPostings()" aria-label="กรองสถานะ" style="width:auto; margin:0; font-size:13px;">
              <option value="">ทุกสถานะ</option>
              <option value="OPEN">เปิดรับสมัคร</option>
              <option value="CLOSED">ปิดรับแล้ว</option>
            </select>
          </div>
          <div style="overflow-x:auto;">
            <table class="data-table" style="min-width:680px;">
              <thead>
                <tr>
                  <th style="width:34%;">บริษัท</th>
                  <th style="width:38%;">ตำแหน่ง (จำนวนที่รับ)</th>
                  <th style="width:14%;" class="text-center">สถานะ</th>
                  <th style="width:14%;" class="text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody id="coop-postings-tbody">
                <tr><td colspan="4" class="text-center py-6 text-gray-400">กำลังโหลดประกาศ...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- ใบสมัครสหกิจของนิสิต: ดาวน์โหลด PDF รวม + เปลี่ยนสถานะ (ทีละใบ หรือเลือกหลายใบ) -->
      <section class="card" id="coop-applications-card">
        <div class="card-header" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span class="material-icons header-icon">assignment_ind</span>
          <div style="min-width:0;">
            <h2 class="card-title" style="margin:0;">ใบสมัครสหกิจศึกษา</h2>
            <p style="margin:2px 0 0 0; font-size:12px; color:#E0E7FF;">ดาวน์โหลด PDF รวม (Resume → Transcript → Portfolio) ส่งให้บริษัท แล้วเปลี่ยนสถานะเพื่อแจ้งนิสิต · ผ่านแล้วกด "เอกสารหลังผ่าน" เพื่อเลื่อนขั้นหนังสือ/แนบไฟล์ · ไม่ผ่าน/ยกเลิก = เก็บเข้าประวัติ นิสิตสมัครที่อื่นหรือไปฝึกงานได้</p>
          </div>
        </div>
        <div class="card-body">
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:10px;">
            <input type="search" id="coop-app-search" class="input-field" oninput="window.renderCoopApplications()" placeholder="ค้นหารหัส / ชื่อนิสิต / บริษัท..." aria-label="ค้นหาใบสมัคร" style="flex:1 1 220px; margin:0; font-size:13px;" />
            <select id="coop-app-status" class="input-field" onchange="window.renderCoopApplications()" aria-label="กรองสถานะใบสมัคร" style="width:auto; margin:0; font-size:13px;">
              <option value="ACTIVE">ยังไม่จบ (ทั้งหมดที่ต้องดำเนินการ)</option>
              <option value="SUBMITTED">ส่งใบสมัครแล้ว (รอพิจารณา)</option>
              <option value="SENT_TO_COMPANY">ส่งเอกสารให้บริษัทแล้ว</option>
              <option value="ACCEPTED">ผ่านการคัดเลือก</option>
              <option value="REJECTED">ไม่ผ่าน (ประวัติ)</option>
              <option value="CANCELLED">ยกเลิก (ประวัติ)</option>
              <option value="">ทุกสถานะ</option>
            </select>
            <select id="coop-app-posting" class="input-field" onchange="window.renderCoopApplications()" aria-label="กรองบริษัท" style="width:auto; max-width:260px; margin:0; font-size:13px;">
              <option value="">ทุกบริษัท</option>
            </select>
          </div>
          <div id="coop-app-bulk" style="display:none; align-items:center; gap:8px; flex-wrap:wrap; padding:8px 12px; margin-bottom:10px; background:#EEF2FF; border:1px solid #C7D2FE; border-radius:10px; font-size:12.5px; color:#1E1B4B;">
            <strong id="coop-app-bulk-count">0</strong> ใบที่เลือก:
            <button type="button" onclick="window.bulkCoopAppStatus('SENT_TO_COMPANY')" style="background:#0EA5E9; color:#fff; border:none; border-radius:8px; padding:5px 10px; font-size:12px; font-weight:700; cursor:pointer;">ส่งเอกสารให้บริษัทแล้ว</button>
            <button type="button" onclick="window.bulkCoopAppStatus('ACCEPTED')" style="background:#16A34A; color:#fff; border:none; border-radius:8px; padding:5px 10px; font-size:12px; font-weight:700; cursor:pointer;">ผ่านการคัดเลือก</button>
            <button type="button" onclick="window.bulkCoopAppStatus('REJECTED')" style="background:#DC2626; color:#fff; border:none; border-radius:8px; padding:5px 10px; font-size:12px; font-weight:700; cursor:pointer;">ไม่ผ่าน</button>
            <button type="button" onclick="window.bulkCoopAppStatus('CANCELLED')" style="background:#475569; color:#fff; border:none; border-radius:8px; padding:5px 10px; font-size:12px; font-weight:700; cursor:pointer;">ยกเลิกให้นิสิต</button>
            <button type="button" onclick="window.clearCoopAppSelection()" style="background:none; border:none; color:#4338CA; font-size:12px; font-weight:700; cursor:pointer; text-decoration:underline;">ยกเลิกการเลือก</button>
          </div>
          <div style="overflow-x:auto;">
            <table class="data-table" style="min-width:980px;">
              <thead>
                <tr>
                  <th style="width:4%;" class="text-center"><input type="checkbox" id="coop-app-select-all" onchange="window.toggleAllCoopApps(this.checked)" aria-label="เลือกทั้งหมด" style="width:16px; height:16px; cursor:pointer;" /></th>
                  <th style="width:20%;">นิสิต</th>
                  <th style="width:7%;" class="text-center">GPAX</th>
                  <th style="width:21%;">บริษัท / ตำแหน่ง</th>
                  <th style="width:8%;">รอบ</th>
                  <th style="width:9%;">วันที่สมัคร</th>
                  <th style="width:14%;" class="text-center">สถานะ</th>
                  <th style="width:17%;">เอกสาร / จัดการ</th>
                </tr>
              </thead>
              <tbody id="coop-apps-tbody">
                <tr><td colspan="8" class="text-center py-6 text-gray-400">กำลังโหลดใบสมัคร...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>

    <!-- =====================================================================
         WORKSPACE 5: ระบบออกเอกสารราชการอัตโนมัติ (หนังสือขอความอนุเคราะห์ + แบบฟอร์มใบตอบรับ & หนังสือส่งตัว)
         ===================================================================== -->
    <div id="workspace-documents" style="display:none;">
      <section class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-icons header-icon">calendar_month</span>
            <div>
              <h2 class="card-title" style="margin:0;">ตั้งค่าภาคการศึกษา/ปีการศึกษา และค่าเริ่มต้นเอกสารราชการ</h2>
              <p style="margin:2px 0 0 0; font-size:12px; color:#E0E7FF;">กำหนดปีการศึกษาปัจจุบันและเลขที่หนังสือ อว สำหรับใช้ในการออกหนังสือขอความอนุเคราะห์และหนังสือส่งตัว</p>
            </div>
          </div>
          <div id="cfg-signature-panel" style="display:flex; align-items:center; gap:8px; width:300px; min-height:48px; margin-left:auto; padding:4px 8px; box-sizing:border-box; flex:0 0 300px; background:#FFFFFF; border-radius:8px; color:#1E3A8A;">
            <img id="cfg-signature-preview" alt="ตัวอย่างลายเซ็น" style="display:none; max-width:110px; max-height:40px; object-fit:contain; flex:0 1 auto;" />
            <span id="cfg-signature-empty" style="display:inline; font-size:12px; font-weight:600; white-space:nowrap;">ยังไม่ได้อัปโหลดลายเซ็น</span>
            <div style="display:flex; align-items:center; gap:4px; margin-left:auto; flex:0 0 auto;">
              <button type="button" id="cfg-signature-upload-button" onclick="document.getElementById('cfg-signature-file').click()"
                style="border:0; border-radius:6px; background:#EEF2FF; color:#3730A3; padding:6px 8px; font-size:11px; font-weight:700; cursor:pointer; white-space:nowrap;">อัปโหลดลายเซ็น</button>
              <button type="button" id="cfg-signature-change-button" onclick="document.getElementById('cfg-signature-file').click()"
                style="display:none; border:0; border-radius:6px; background:#EEF2FF; color:#3730A3; padding:6px 8px; font-size:11px; font-weight:700; cursor:pointer; white-space:nowrap;">เปลี่ยนรูป</button>
              <button type="button" id="cfg-signature-delete-button" onclick="window.deleteAcademicSignature(event)"
                style="display:none; border:0; border-radius:6px; background:#FEF2F2; color:#B91C1C; padding:6px 8px; font-size:11px; font-weight:700; cursor:pointer;">ลบ</button>
            </div>
            <input type="file" id="cfg-signature-file" accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              onchange="window.uploadAcademicSignature(event)" style="display:none;" />
          </div>
          <button type="button" onclick="saveAcademicConfig()" style="background:#10B981; color:white; border:none; padding:8px 16px; border-radius:10px; font-size:12.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
            <span class="material-icons" style="font-size:16px;">save</span> บันทึกการตั้งค่าระบบ
          </button>
        </div>
        <div class="card-body">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px;">
            <div>
              <label style="font-size:12.5px; font-weight:700; color:#334155;">ปีการศึกษาปัจจุบัน (พ.ศ.)</label>
              <input type="text" id="cfg-academic-year" class="input-field" value="2568" style="margin-top:4px; font-weight:700;" />
            </div>
            <div>
              <label style="font-size:12.5px; font-weight:700; color:#334155;">ภาคการศึกษาปัจจุบัน</label>
              <select id="cfg-semester" class="input-field" style="margin-top:4px;">
                <option value="1">ภาคการศึกษาต้น (เทอม 1)</option>
                <option value="2">ภาคการศึกษาปลาย (เทอม 2)</option>
                <option value="3">ภาคฤดูร้อน (Summer)</option>
              </select>
            </div>
            <div>
              <label style="font-size:12.5px; font-weight:700; color:#334155;">เลขที่หนังสือราชการเริ่มต้น (อว)</label>
              <input type="text" id="cfg-doc-prefix" class="input-field" value="อว 7316/" style="margin-top:4px;" />
            </div>
            <div>
              <label style="font-size:12.5px; font-weight:700; color:#334155;">ชื่อผู้ลงนามหนังสือราชการ</label>
              <input type="text" id="cfg-dean-name" class="input-field" value="ผู้ช่วยศาสตราจารย์ ดร.พรเทพ โรจนวสุ" style="margin-top:4px;" />
            </div>
          </div>
        </div>
      </section>

      <!-- คิวเอกสารราชการ แบบจัดกลุ่มตามสถานประกอบการ (กดที่บริษัทเพื่อดูรายชื่อนิสิต) -->
      <section class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-icons header-icon">assignment_turned_in</span>
            <div>
              <h2 class="card-title" style="margin:0;">คิวออกหนังสือ แยกตามบริษัท</h2>
              <p style="margin:2px 0 0 0; font-size:12px; color:#E0E7FF;">กดที่ชื่อบริษัทเพื่อดูรายชื่อนิสิตและจัดการเอกสาร</p>
            </div>
          </div>
        </div>
        <div class="card-body">
          <!-- แถบตัวกรอง -->
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
            <div style="flex:1; min-width:200px; position:relative;">
              <span class="material-icons" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:18px; color:#94A3B8; pointer-events:none;">search</span>
              <input type="text" id="doc-queue-keyword" class="input-field" oninput="renderDocumentQueueTable()" placeholder="ค้นหาบริษัท / รหัส / ชื่อนิสิต" style="padding-left:36px !important; margin:0; font-size:12.5px;" />
            </div>
            <select id="doc-queue-major" class="input-field" onchange="renderDocumentQueueTable()" style="width:auto; min-width:150px; margin:0; font-size:12.5px;">
              <option value="ALL">ทุกสาขา</option>
            </select>
            <select id="doc-queue-year" class="input-field" onchange="renderDocumentQueueTable()" style="width:auto; min-width:110px; margin:0; font-size:12.5px;">
              <option value="ALL">ทุกรุ่น</option>
            </select>
            <select id="doc-queue-window" class="input-field" onchange="renderDocumentQueueTable()" style="width:auto; min-width:130px; margin:0; font-size:12.5px;">
              <option value="ALL">ทุกรอบออกฝึก</option>
            </select>
            <select id="doc-queue-filter" class="input-field" onchange="renderDocumentQueueTable()" style="width:auto; min-width:190px; margin:0; font-size:12.5px;">
              <option value="ALL">ทุกสถานะ</option>
              <option value="READY_FOR_REQ">รอออกหนังสือขอความอนุเคราะห์</option>
              <option value="WAITING_RESPONSE">รอผลใบตอบรับจากบริษัท</option>
              <option value="ACCEPTED">ตอบรับแล้ว / รอออกหนังสือส่งตัว</option>
              <option value="DISPATCHED">ออกหนังสือส่งตัวแล้ว</option>
            </select>
            <label style="display:inline-flex; align-items:center; gap:6px; font-size:12.5px; color:#475569; cursor:pointer; white-space:nowrap;">
              <input type="checkbox" id="doc-queue-hide-none" onchange="renderDocumentQueueTable()" checked style="width:15px; height:15px; accent-color:#4338CA;" />
              ซ่อนนิสิตที่ยังไม่ยื่นบริษัท
            </label>
            <button type="button" onclick="window.toggleAllDocGroups()" id="doc-queue-expand-btn" style="background:#F1F5F9; border:1px solid #CBD5E1; color:#475569; border-radius:8px; padding:6px 10px; font-size:12px; font-weight:600; cursor:pointer;">ขยายทั้งหมด</button>
          </div>
          <div id="doc-queue-summary" style="font-size:12px; color:#64748B; margin-bottom:8px;"></div>
          <div id="doc-workflow-groups" style="display:flex; flex-direction:column; gap:10px;">
            <div style="padding:18px; text-align:center; color:#94A3B8;">กำลังโหลดคิวงานเอกสารราชการ...</div>
          </div>
        </div>
      </section>

      <!-- ส่วนที่ 3: ประวัติบริษัทเดิมที่ถูกปฏิเสธ / ไม่ผ่าน (Archive แบบย่อ) -->
      <section class="card">
        <div class="card-header">
          <span class="material-icons header-icon">inventory_2</span>
          <div>
            <h2 class="card-title" style="margin:0;">ประวัติการยื่นบริษัทเดิมที่ไม่ผ่าน / บริษัทปฏิเสธ (Archive แบบย่อ)</h2>
            <p style="margin:2px 0 0 0; font-size:12px; color:#E0E7FF;">เก็บประวัติการยื่นเดิมไว้เป็นหลักฐานเมื่อระบบปลดล็อกให้นิสิตยื่นบริษัทแห่งใหม่</p>
          </div>
        </div>
        <div class="card-body">
          <table class="data-table">
            <thead>
              <tr>
                <th>รหัสนิสิต</th>
                <th>ชื่อ-นามสกุล</th>
                <th>สาขาวิชา</th>
                <th>บริษัทเดิมที่ยื่น</th>
                <th>สาเหตุที่เข้า Archive</th>
                <th>หมายเหตุ</th>
                <th>วันที่บันทึก</th>
              </tr>
            </thead>
            <tbody id="archive-history-tbody">
              <tr><td colspan="7" class="text-center py-6 text-gray-400">ยังไม่มีประวัติใน Archive</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <!-- =====================================================================
         WORKSPACE 6: การเชื่อมโยงกับระบบ Co-op ICT ของพี่แดง (Export สำหรับ Co-op 01)
         ===================================================================== -->
    <div id="workspace-coop" style="display:none;">
      <section class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-icons header-icon">sync_alt</span>
            <div>
              <h2 class="card-title" style="margin:0;">ส่งออกข้อมูลเชื่อมโยงระบบ Co-op ICT ของพี่แดง (ข้อมูลตั้งต้นแบบฟอร์ม Co-op 01)</h2>
              <p style="margin:2px 0 0 0; font-size:12px; color:#E0E7FF;">
                Export ข้อมูลนิสิตและสถานประกอบการที่ได้รับการตอบรับออกเป็นไฟล์ CSV มาตรฐาน เพื่อนำไป Import เข้าสู่ระบบ Co-op ICT โดยที่นิสิตไม่ต้องกรอกข้อมูลซ้ำ
              </p>
            </div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="button" onclick="window.openCoopExportModal ? window.openCoopExportModal() : null" style="background:#10B981; color:white; border:none; padding:9px 18px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(16,185,129,0.3);">
              <span class="material-icons" style="font-size:18px;">download</span> ส่งออกข้อมูล Co-op (Export)
            </button>
          </div>
        </div>
        <div class="card-body">
          <div style="margin-bottom:14px; padding:12px 16px; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px; font-size:12.5px; color:#166534;">
              <span class="material-icons" style="color:#16A34A;">check_circle</span>
              <span><strong>โครงสร้างคอลัมน์มาตรฐาน Co-op 01:</strong> รหัสนิสิต, ชื่อ-สกุล, สาขาวิชา, ชั้นปี, GPAX, เบอร์โทร, อีเมล, ชื่อสถานประกอบการ, ตำแหน่งงาน, ที่อยู่บริษัท, จังหวัด, ชื่อผู้ประสานงาน HR, เบอร์โทรบริษัท, อาจารย์ที่ปรึกษา, อาจารย์นิเทศก์, เลขที่หนังสือส่งตัว</span>
            </div>
          </div>

          <!-- แถบตัวกรอง & ค้นหาข้อมูล Co-op -->
          <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-bottom:14px; background:#F8FAFC; padding:12px 16px; border-radius:12px; border:1px solid #E2E8F0;">
            <div style="position:relative; flex:1; min-width:240px; max-width:340px;">
              <span class="material-icons" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:#94A3B8; font-size:18px; pointer-events:none;">search</span>
              <input type="search" id="coop-search-input" class="input-field" placeholder="ค้นหารหัสนิสิต, ชื่อ หรือบริษัท..." oninput="window.filterCoopTable ? window.filterCoopTable() : null" style="padding-left:34px !important; width:100%; font-size:12.5px; height:36px; border-radius:8px;" />
            </div>

            <select id="coop-major-filter" class="input-field" onchange="window.filterCoopTable ? window.filterCoopTable() : null" style="width:auto; min-width:170px; font-size:12.5px; height:36px; padding:4px 10px; border-radius:8px; cursor:pointer; background:#FFFFFF;">
              <option value="ALL">ทุกสาขาวิชา (คณะ ICT)</option>
${majorOptionsHtml("              ")}
            </select>

            <select id="coop-cohort-filter" class="input-field" onchange="window.filterCoopTable ? window.filterCoopTable() : null" style="width:auto; min-width:110px; font-size:12.5px; height:36px; padding:4px 10px; border-radius:8px; cursor:pointer; background:#FFFFFF;">
              <option value="ALL">ทุกรุ่น</option>
            </select>

            <select id="coop-window-filter" class="input-field" onchange="window.filterCoopTable ? window.filterCoopTable() : null" style="width:auto; min-width:130px; font-size:12.5px; height:36px; padding:4px 10px; border-radius:8px; cursor:pointer; background:#FFFFFF;">
              <option value="ALL">ทุกรอบออกฝึก</option>
            </select>

            <select id="coop-type-filter" class="input-field" onchange="window.filterCoopTable ? window.filterCoopTable() : null" aria-label="ประเภท ฝึกงาน หรือ สหกิจศึกษา" style="width:auto; min-width:140px; font-size:12.5px; height:36px; padding:4px 10px; border-radius:8px; cursor:pointer; background:#FFFFFF;">
              <option value="ALL">ฝึกงาน + สหกิจ</option>
              <option value="INTERNSHIP">เฉพาะฝึกงาน</option>
              <option value="COOP">เฉพาะสหกิจศึกษา</option>
            </select>

            <select id="coop-status-filter" class="input-field" onchange="window.filterCoopTable ? window.filterCoopTable() : null" style="width:auto; min-width:220px; font-size:12.5px; height:36px; padding:4px 10px; border-radius:8px; cursor:pointer; background:#FFFFFF; font-weight:600; color:#1E40AF;">
              <option value="DISPATCHED" selected>✓ เฉพาะนิสิตที่ออกหนังสือส่งตัวแล้ว (พร้อมส่ง Co-op)</option>
              <option value="ACCEPTED">✓ เฉพาะนิสิตที่บริษัทตอบรับแล้ว (รอหนังสือส่งตัว)</option>
              <option value="IN_PROGRESS">⏳ อยู่ระหว่างดำเนินการ (ยังไม่ตอบรับ)</option>
              <option value="ALL">📋 นิสิตทั้งหมดทุกขั้นตอน</option>
            </select>

            <button type="button" class="btn btn-outline btn-sm" onclick="window.clearCoopFilters ? window.clearCoopFilters() : null" title="ล้างตัวกรอง" style="height:36px; padding:0 12px; border-radius:8px; font-size:12px; display:inline-flex; align-items:center; gap:4px; color:#64748B; background:#FFFFFF;">
              <span class="material-icons" style="font-size:16px;">filter_alt_off</span> ล้างตัวกรอง
            </button>

            <span id="coop-filtered-count-badge" style="margin-left:auto; font-size:12px; color:#475569; font-weight:600;">
              กำลังโหลดข้อมูล...
            </span>
          </div>

          <!-- แถบแสดงจำนวนที่ติ๊กเลือก (Bulk Selection Bar) -->
          <div id="coop-selected-bar" style="display:none; align-items:center; justify-content:space-between; margin-bottom:12px; padding:10px 16px; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="material-icons" style="color:#2563EB; font-size:20px;">check_box</span>
              <span style="font-size:13px; font-weight:700; color:#1E40AF;">
                ติ๊กเลือกนิสิตแล้ว <span id="coop-selected-count">0</span> คน
              </span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <button type="button" onclick="window.openCoopExportModal ? window.openCoopExportModal('selected') : null" style="background:#2563EB; color:white; border:none; padding:6px 14px; border-radius:8px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
                <span class="material-icons" style="font-size:15px;">download</span> ส่งออกเฉพาะ <span id="coop-selected-btn-count">0</span> คนนี้
              </button>
              <button type="button" onclick="window.clearCoopSelection ? window.clearCoopSelection() : null" style="background:transparent; border:none; color:#64748B; font-size:12px; font-weight:600; cursor:pointer; padding:6px 10px;">
                ล้างการเลือก
              </button>
            </div>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:11%;">รหัสนิสิต</th>
                  <th style="width:16%;">ชื่อ - นามสกุล</th>
                  <th style="width:14%;">สาขาวิชา</th>
                  <th style="width:7%;">GPAX</th>
                  <th style="width:17%;">สถานประกอบการ (Co-op 01)</th>
                  <th style="width:12%;">ตำแหน่งงาน</th>
                  <th style="width:11%;">อาจารย์ที่ปรึกษา / นิเทศก์</th>
                  <th style="width:12%;">สถานะส่งตัว</th>
                  <th style="width:75px; min-width:75px;" class="text-center">
                    <label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap;" title="เลือกนิสิตทั้งหมดในหน้านี้">
                      <span style="font-size:11.5px;">เลือกทั้งหมด</span>
                      <input type="checkbox" id="select-all-coop" onchange="window.toggleSelectAllCoop ? window.toggleSelectAllCoop(event) : null" aria-label="เลือกนิสิตทั้งหมด" style="width:16px;height:16px;cursor:pointer;" />
                    </label>
                  </th>
                </tr>
              </thead>
              <tbody id="coop-preview-tbody">
                <tr><td colspan="9" class="text-center py-6 text-gray-400">กำลังโหลดข้อมูลสำหรับส่งออก Co-op 01...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>

    <!-- =====================================================================
         WORKSPACE 7: ตั้งค่า Checklist บริษัท (สำหรับ Super Admin / Staff)
         ===================================================================== -->
    <div id="workspace-checklist" style="display:none;">
      <section class="card" style="margin-bottom:20px;">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-icons header-icon">fact_check</span>
            <div>
              <h2 class="card-title" style="margin:0;">ตั้งค่า Checklist บริษัท (สำหรับนิสิตประเมินก่อนยื่นฝึกงาน)</h2>
              <p style="margin:2px 0 0 0; font-size:12px; color:#E0E7FF;">
                จัดการเวอร์ชัน หัวข้อหลัก และเกณฑ์คำถามที่นิสิตต้องตรวจสอบความน่าเชื่อถือของบริษัทก่อนยื่นสมัครฝึกงาน
              </p>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <button type="button" onclick="window.openCreateVersionModal ? window.openCreateVersionModal(true) : null" style="background:#0D6EFD; color:white; border:none; padding:8px 14px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
              <span class="material-icons" style="font-size:17px;">content_copy</span> คัดลอกสร้างเวอร์ชันใหม่
            </button>
            <button type="button" onclick="window.openCreateVersionModal ? window.openCreateVersionModal(false) : null" style="background:#475569; color:white; border:none; padding:8px 14px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
              <span class="material-icons" style="font-size:17px;">add</span> สร้างเวอร์ชันเปล่า
            </button>
          </div>
        </div>

        <div class="card-body">
          <!-- แถบเลือกเวอร์ชัน & สถานะ -->
          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:14px 18px; margin-bottom:18px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
              <label style="font-size:13px; font-weight:700; color:#334155;">เลือกเวอร์ชัน:</label>
              <select id="checklist-version-select" onchange="window.switchChecklistVersion ? window.switchChecklistVersion(this.value) : null" class="input-field" style="width:auto; min-width:260px; height:44px; min-height:44px; line-height:1.6; font-size:13.5px; padding:6px 36px 6px 14px; background:#FFFFFF; border:1px solid #CBD5E1; border-radius:8px; cursor:pointer; box-sizing:border-box; overflow:visible;">
                <!-- dynamic options -->
              </select>
              <div id="checklist-version-badge-wrap">
                <!-- dynamic status badge -->
              </div>
            </div>

            <div id="checklist-version-actions" style="display:flex; align-items:center; gap:8px;">
              <!-- dynamic action buttons: Activate, Edit Info, Delete -->
            </div>
          </div>

          <!-- กล่องคำอธิบายเวอร์ชัน -->
          <div id="checklist-version-desc-box" style="margin-bottom:16px; font-size:12.5px; color:#475569; padding:10px 14px; background:#F1F5F9; border-radius:8px; border-left:4px solid #3B82F6; display:none;"></div>

          <!-- แถบหัวข้อรายการคำถาม -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
            <div style="font-size:14px; font-weight:700; color:#1E293B; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span>📋 หัวข้อและเกณฑ์การประเมิน <span id="checklist-sections-summary" style="font-size:12.5px; font-weight:500; color:#64748B;"></span></span>
              <span style="font-size:11.5px; color:#2563EB; background:#EFF6FF; border:1px solid #BFDBFE; padding:2px 9px; border-radius:999px; font-weight:600;">
                ✋ คลิกค้างที่แถบหัวข้อหรือข้อย่อยเพื่อลากสลับตำแหน่ง
              </span>
            </div>
            <button type="button" onclick="window.openAddSectionModal ? window.openAddSectionModal() : null" style="background:#2563EB; color:white; border:none; padding:7px 14px; border-radius:8px; font-size:12.5px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
              <span class="material-icons" style="font-size:17px;">add_circle_outline</span> เพิ่มหมวดหลักใหม่
            </button>
          </div>

          <!-- รายการหมวดหมู่และคำถาม (Dynamic Accordion / Cards) -->
          <div id="checklist-sections-container">
            <div style="text-align:center; padding:30px; color:#94A3B8;">กำลังโหลดข้อมูล Checklist...</div>
          </div>
        </div>
      </section>
    </div>

    <!-- Modal: สร้าง/แก้ไขเวอร์ชัน Checklist -->
    <div id="checklist-version-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; padding:24px 28px; width:500px; max-width:94%; box-shadow:0 20px 50px rgba(15,23,42,0.25);">
        <h3 style="font-size:17px; font-weight:700; margin-bottom:14px; color:#1E293B;" id="cv-modal-title">สร้างเวอร์ชันใหม่</h3>
        <input type="hidden" id="cv-mode" value="create" />
        <input type="hidden" id="cv-version-id" value="" />
        <div style="margin-bottom:12px;">
          <label style="font-size:12.5px; font-weight:700; color:#475569;">ชื่อเวอร์ชัน *</label>
          <input type="text" id="cv-version-name" class="input-field" placeholder="เช่น v2.0 (ปีการศึกษา 2568)" style="margin-top:4px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12.5px; font-weight:700; color:#475569;">คำอธิบายเวอร์ชัน</label>
          <input type="text" id="cv-description" class="input-field" placeholder="เช่น ปรับเกณฑ์ความน่าเชื่อถือและ Tech Stack สำหรับปี 68" style="margin-top:4px;" />
        </div>
        <div id="cv-clone-wrap" style="margin-bottom:16px;">
          <label style="font-size:12.5px; font-weight:700; color:#475569;">คัดลอกหมวดและคำถามจาก</label>
          <select id="cv-clone-select" class="input-field" style="margin-top:4px; cursor:pointer;">
            <!-- dynamic clone options -->
          </select>
          <span style="font-size:11.5px; color:#64748B;">* ระบบจะคัดลอกทุกหมวดและคำถามมาให้แก้ไขต่อทันที สะดวกโดยไม่ต้องพิมพ์ใหม่</span>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" onclick="document.getElementById('checklist-version-modal').style.display='none'" style="background:#F1F5F9; color:#475569; border:none; padding:8px 16px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">ยกเลิก</button>
          <button type="button" onclick="window.saveChecklistVersion ? window.saveChecklistVersion() : null" style="background:#2563EB; color:white; border:none; padding:8px 18px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">บันทึก</button>
        </div>
      </div>
    </div>

    <!-- Modal: เพิ่ม/แก้ไขหมวดหลัก (Section) -->
    <div id="checklist-section-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; padding:24px 28px; width:480px; max-width:94%; box-shadow:0 20px 50px rgba(15,23,42,0.25);">
        <h3 style="font-size:17px; font-weight:700; margin-bottom:14px; color:#1E293B;" id="cs-modal-title">เพิ่มหมวดหลัก</h3>
        <input type="hidden" id="cs-section-id" value="" />
        <div style="margin-bottom:16px;">
          <label style="font-size:12.5px; font-weight:700; color:#475569;">ชื่อหมวดหลัก *</label>
          <input type="text" id="cs-title" class="input-field" placeholder="เช่น ส่วนที่ 6 สวัสดิการและค่าตอบแทน" style="margin-top:4px;" />
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" onclick="document.getElementById('checklist-section-modal').style.display='none'" style="background:#F1F5F9; color:#475569; border:none; padding:8px 16px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">ยกเลิก</button>
          <button type="button" onclick="window.saveChecklistSection ? window.saveChecklistSection() : null" style="background:#2563EB; color:white; border:none; padding:8px 18px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">บันทึก</button>
        </div>
      </div>
    </div>

    <!-- Modal: เพิ่ม/แก้ไขข้อย่อย (Item) -->
    <div id="checklist-item-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; padding:24px 28px; width:520px; max-width:94%; box-shadow:0 20px 50px rgba(15,23,42,0.25);">
        <h3 style="font-size:17px; font-weight:700; margin-bottom:14px; color:#1E293B;" id="ci-modal-title">เพิ่มเกณฑ์คำถาม</h3>
        <input type="hidden" id="ci-item-id" value="" />
        <input type="hidden" id="ci-section-id" value="" />
        <div style="margin-bottom:12px;">
          <label style="font-size:12.5px; font-weight:700; color:#475569;">รายละเอียดเกณฑ์ที่ต้องพิจารณา *</label>
          <textarea id="ci-description" class="input-field" rows="3" placeholder="เช่น ตรวจสอบกับกรมพัฒนาธุรกิจการค้า (DBD) นำชื่อบริษัทไปค้นในเว็บ DBD..." style="margin-top:4px; height:auto; padding:8px 12px; resize:vertical;"></textarea>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12.5px; font-weight:700; color:#475569;">คำใบ้ / ตัวอย่างคำตอบ (Placeholder สำหรับช่องรายละเอียดเพิ่ม)</label>
          <input type="text" id="ci-placeholder" class="input-field" placeholder="เช่น ระบุทุนจดทะเบียน หรือสถานะ Active ในระบบ" style="margin-top:4px;" />
          <span style="font-size:11.5px; color:#64748B;">* แสดงเป็นตัวอย่างจางๆ ในช่องกรอกของนิสิต ช่วยให้นิสิตรู้ว่าควรพิมพ์อะไร</span>
        </div>
        <div style="margin-bottom:16px; display:flex; gap:16px; align-items:center;">
          <label style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:#334155; cursor:pointer;">
            <input type="checkbox" id="ci-required" style="width:16px; height:16px; cursor:pointer;" />
            <span>เป็นข้อบังคับ (Required)</span>
          </label>
          <label style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:#334155; cursor:pointer;">
            <input type="checkbox" id="ci-active" checked style="width:16px; height:16px; cursor:pointer;" />
            <span>เปิดใช้งานในแบบฟอร์ม (Active)</span>
          </label>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" onclick="document.getElementById('checklist-item-modal').style.display='none'" style="background:#F1F5F9; color:#475569; border:none; padding:8px 16px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">ยกเลิก</button>
          <button type="button" onclick="window.saveChecklistItem ? window.saveChecklistItem() : null" style="background:#2563EB; color:white; border:none; padding:8px 18px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer;">บันทึก</button>
        </div>
      </div>
    </div>

    <!-- Modal: เพิ่ม / แก้ไขสถานประกอบการใน Master Data -->
    <div id="add-master-company-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; padding:24px 28px; width:560px; max-width:94%; box-shadow:0 20px 50px rgba(15,23,42,0.25);">
        <h3 id="mc-modal-title" style="font-size:17px; font-weight:700; margin-bottom:14px; color:#1E293B;">เพิ่มสถานประกอบการเข้าฐานข้อมูลกลาง (Master Data)</h3>
        <input type="hidden" id="mc-company-id" value="" />
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
          <div style="grid-column:span 2;">
            <label style="font-size:12.5px; font-weight:700; color:#475569;">ชื่อสถานประกอบการ (ภาษาไทย / ชื่อทางการ) *</label>
            <input type="text" id="mc-name-th" class="input-field" placeholder="เช่น บริษัท เมกัส ซอฟต์แวร์ จำกัด" style="margin-top:4px;" />
          </div>
          <div>
            <label style="font-size:12.5px; font-weight:700; color:#475569;">ชื่อภาษาอังกฤษ</label>
            <input type="text" id="mc-name-en" class="input-field" placeholder="Magus Software Co., Ltd." style="margin-top:4px;" />
          </div>
          <div>
            <label style="font-size:12.5px; font-weight:700; color:#475569;">จังหวัด</label>
            <input type="text" id="mc-province" class="input-field" placeholder="เช่น เชียงใหม่, กรุงเทพมหานคร" style="margin-top:4px;" />
          </div>
          <div style="grid-column:span 2;">
            <label style="font-size:12.5px; font-weight:700; color:#475569;">ที่อยู่บริษัท</label>
            <input type="text" id="mc-address" class="input-field" placeholder="เลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์" style="margin-top:4px;" />
          </div>
          <div>
            <label style="font-size:12.5px; font-weight:700; color:#475569;">ชื่อผู้ติดต่อ / ฝ่าย HR</label>
            <input type="text" id="mc-hr-name" class="input-field" placeholder="ฝ่ายทรัพยากรบุคคล" style="margin-top:4px;" />
          </div>
          <div>
            <label style="font-size:12.5px; font-weight:700; color:#475569;">เบอร์โทรศัพท์ HR</label>
            <input type="text" id="mc-hr-phone" class="input-field" placeholder="02-xxx-xxxx" style="margin-top:4px;" />
          </div>
          <div>
            <label style="font-size:12.5px; font-weight:700; color:#475569;">อีเมลติดต่อ HR</label>
            <input type="text" id="mc-hr-email" class="input-field" placeholder="hr@company.com" style="margin-top:4px;" />
          </div>
          <div>
            <label style="font-size:12.5px; font-weight:700; color:#475569;">สถานะสถานประกอบการ</label>
            <select id="mc-status" class="input-field" style="margin-top:4px; cursor:pointer;">
              <option value="VERIFIED">✅ ยืนยันแล้ว (Master Data)</option>
              <option value="PARTNER">🏛️ สถานประกอบการที่คณะ ICT เป็นผู้เพิ่มข้อมูล</option>
              <option value="BLACKLIST">⛔ งดส่งนิสิต (Blacklist / เฝ้าระวัง)</option>
              <option id="mc-status-opt-pending" value="PENDING_REVIEW" style="display:none;">⏳ ส่งกลับไปตารางรออนุมัติ / ยุบรวม (เฉพาะที่นิสิตเพิ่ม)</option>
            </select>
          </div>
          <div style="grid-column:span 2;">
            <label style="font-size:12.5px; font-weight:700; color:#475569;">ตำแหน่งงานที่แนะนำ</label>
            <input type="text" id="mc-positions" class="input-field" placeholder="เช่น Software Developer, QA, Data Analyst" style="margin-top:4px;" />
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
          <button class="btn btn-outline btn-sm" onclick="closeAddMasterCompanyModal()">ยกเลิก</button>
          <button id="mc-submit-btn" class="btn btn-primary btn-sm" onclick="submitNewMasterCompany()">บันทึกเข้า Master Data</button>
        </div>
      </div>
    </div>

    <!-- Modal: พรีวิวและพิมพ์หนังสือราชการ PDF (หนังสือขอความอนุเคราะห์ + แบบฟอร์มใบตอบรับ / หนังสือส่งตัว) -->
    <div id="official-letter-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.65); z-index:1100; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; width:820px; max-width:95%; max-height:92vh; display:flex; flex-direction:column; box-shadow:0 25px 60px rgba(15,23,42,0.35); overflow:hidden;">
        <div style="background:linear-gradient(135deg, #1E1B4B 0%, #4338CA 100%); padding:16px 24px; color:white; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-icons" style="font-size:22px;">picture_as_pdf</span>
            <div>
              <h3 id="official-letter-modal-title" style="font-size:16px; font-weight:700; margin:0;">พรีวิวหนังสือราชการ คณะ ICT มหาวิทยาลัยพะเยา</h3>
              <p style="font-size:11.5px; color:#E0E7FF; margin:2px 0 0 0;">พร้อมพิมพ์หรือบันทึกเป็นไฟล์ PDF เพื่อส่งให้สถานประกอบการ</p>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" onclick="printOfficialLetter()" style="background:#10B981; color:white; border:none; padding:7px 14px; border-radius:10px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
              <span class="material-icons" style="font-size:16px;">print</span> พิมพ์ / ดาวน์โหลด PDF
            </button>
            <button onclick="closeOfficialLetterModal()" style="background:none; border:none; color:white; cursor:pointer;">
              <span class="material-icons">close</span>
            </button>
          </div>
        </div>
        <div id="official-letter-print-area" style="padding:32px 40px; overflow-y:auto; flex:1; background:#FFFFFF; color:#0F172A; font-family:'Sarabun', sans-serif; line-height:1.7;"></div>
      </div>
    </div>

    <!-- Modal: ตั้งสถานะนิสิต -->
    <div id="status-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; padding:24px 28px; width:440px; max-width:92%; box-shadow:0 20px 50px rgba(15,23,42,0.25);">
        <h3 style="font-size:17px; font-weight:700; margin-bottom:16px; color:#1E293B;">ตั้งสถานะนิสิต (Batch Update)</h3>
        <div style="margin-bottom:12px;">
          <label style="font-size:13px; font-weight:600; color:#475569;">ประเภทสถานะ</label>
          <select id="batch-status-type" class="input-field" style="margin-top:4px;">
            <option value="cv">สถานะ CV</option>
            <option value="training">สถานะชั่วโมงอบรม</option>
            <option value="placement">สถานะอนุมัติที่ฝึกงาน</option>
          </select>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:13px; font-weight:600; color:#475569;">ค่าสถานะ</label>
          <select id="batch-status-value" class="input-field" style="margin-top:4px;">
            <option value="APPROVED">ผ่าน / อนุมัติ (APPROVED)</option>
            <option value="PENDING">รอผล (PENDING)</option>
            <option value="REJECTED">ไม่ผ่าน / แก้ไข (REJECTED)</option>
          </select>
        </div>
        <div style="margin-bottom:16px;">
          <label style="font-size:13px; font-weight:600; color:#475569;">หมายเหตุ (ถ้ามี)</label>
          <input type="text" id="batch-status-note" class="input-field" placeholder="หมายเหตุ..." style="margin-top:4px;" />
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="closeSetStatusModal()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" onclick="submitBatchStatus()">ยืนยัน</button>
        </div>
      </div>
    </div>

    <!-- Modal: ตั้งอาจารย์ที่ปรึกษา -->
    <div id="advisor-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; padding:24px 28px; width:440px; max-width:92%; box-shadow:0 20px 50px rgba(15,23,42,0.25);">
        <h3 style="font-size:17px; font-weight:700; margin-bottom:16px; color:#1E293B;">กำหนดอาจารย์ที่ปรึกษา (Advisor)</h3>
        <div style="margin-bottom:16px;">
          <label style="font-size:13px; font-weight:600; color:#475569;">เลือกอาจารย์ที่ปรึกษา</label>
          <select id="advisor-select" class="input-field" style="margin-top:4px;">
            <option value="">กำลังโหลด...</option>
          </select>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="closeSetAdvisorModal()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" onclick="submitBatchAdvisor()">ยืนยัน</button>
        </div>
      </div>
    </div>

    <!-- Modal: ตั้งอาจารย์นิเทศก์ (Supervisor) -->
    <div id="supervisor-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; padding:24px 28px; width:440px; max-width:92%; box-shadow:0 20px 50px rgba(15,23,42,0.25);">
        <h3 style="font-size:17px; font-weight:700; margin-bottom:6px; color:#1E293B;">กำหนดอาจารย์นิเทศก์ (Supervisor)</h3>
        <p style="font-size:12px; color:#64748B; margin:0 0 14px 0;">มอบหมายอาจารย์นิเทศก์ให้นิสิตที่ติ๊กเลือกในตาราง</p>
        <div style="margin-bottom:16px;">
          <label style="font-size:13px; font-weight:600; color:#475569;">เลือกอาจารย์นิเทศก์</label>
          <select id="supervisor-select" class="input-field" style="margin-top:4px;">
            <option value="">กำลังโหลด...</option>
          </select>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="closeSetSupervisorModal()">ยกเลิก</button>
          <button class="btn btn-primary btn-sm" onclick="submitBatchSupervisor()">ยืนยัน</button>
        </div>
      </div>
    </div>

    <!-- Modal: จัดการสิทธิ์อาจารย์ / บุคลากร (Multi-Role Staff Management) -->
    <div id="staff-roles-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; width:1000px; max-width:96%; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 25px 60px rgba(15,23,42,0.3); overflow:hidden;">
        <!-- Modal Header -->
        <div style="background:linear-gradient(135deg, #1E1B4B 0%, #4338CA 100%); padding:18px 24px; color:white; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-icons" style="font-size:22px;">admin_panel_settings</span>
            <div>
              <h3 style="font-size:16px; font-weight:700; margin:0;">จัดการสิทธิ์อาจารย์และเจ้าหน้าที่คณะ (Multi-Role Permission Matrix)</h3>
              <p style="font-size:11.5px; color:#E0E7FF; margin:2px 0 0 0;">อาจารย์ 1 ท่านสามารถถือครองได้หลายบทบาทพร้อมกัน (อาจารย์ประจำวิชา / ที่ปรึกษา / นิเทศก์ / เจ้าหน้าที่คณะ)</p>
            </div>
          </div>
          <button onclick="closeStaffRolesModal()" style="background:none; border:none; color:white; cursor:pointer;" title="ปิดหน้าต่าง">
            <span class="material-icons">close</span>
          </button>
        </div>

        <!-- Filter & Search Toolbar -->
        <div style="padding:12px 24px; background:#F8FAFC; border-bottom:1px solid #E2E8F0; display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;">
          <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; flex:1; min-width:320px;">
            <!-- กล่องค้นหา (ชื่อ-นามสกุล หรือ อีเมล / Gmail) -->
            <div style="position:relative; flex:1; min-width:210px; max-width:280px;">
              <span class="material-icons" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:#94A3B8; font-size:18px; pointer-events:none;">search</span>
              <input
                type="text"
                id="staff-search-input"
                class="input-field"
                placeholder="ค้นหาชื่อ หรือ อีเมล/Gmail..."
                oninput="filterStaffRolesTable()"
                style="padding-left:34px !important; padding-right:28px !important; width:100%; font-size:12.5px; height:36px; border-radius:8px; border:1px solid #CBD5E1; background:#FFFFFF;"
              />
              <button
                id="staff-search-clear-btn"
                type="button"
                onclick="clearStaffSearchInput()"
                title="ล้างคำค้นหา"
                style="display:none; position:absolute; right:6px; top:50%; transform:translateY(-50%); background:none; border:none; color:#94A3B8; cursor:pointer; padding:2px;"
              >
                <span class="material-icons" style="font-size:16px;">cancel</span>
              </button>
            </div>

            <!-- ตัวกรองสาขา / สังกัด -->
            <select
              id="staff-dept-filter"
              class="input-field"
              onchange="filterStaffRolesTable()"
              style="width:auto; min-width:180px; font-size:12px; height:36px; padding:4px 10px; border-radius:8px; border:1px solid #CBD5E1; cursor:pointer; background:#FFFFFF;"
            >
              <option value="ALL">ทุกสาขาวิชา / สังกัด</option>
              <option value="__FACULTY__">ส่วนกลางทั้งคณะ ICT (8 สาขา)</option>
${majorOptionsHtml("              ")}
            </select>

            <!-- ตัวกรองบทบาท (Role) -->
            <select
              id="staff-role-filter"
              class="input-field"
              onchange="filterStaffRolesTable()"
              style="width:auto; min-width:145px; font-size:12px; height:36px; padding:4px 10px; border-radius:8px; border:1px solid #CBD5E1; cursor:pointer; background:#FFFFFF;"
            >
              <option value="ALL">ทุกบทบาทหน้าที่</option>
              <option value="ADVISOR">อาจารย์ที่ปรึกษา</option>
              <option value="SUPERVISOR">อาจารย์นิเทศก์</option>
              <option value="COURSE_ADMIN">อาจารย์ประจำวิชา</option>
              <option value="STAFF">เจ้าหน้าที่คณะ</option>
              <option value="NONE">ยังไม่มีบทบาทใดๆ</option>
            </select>

            <!-- ปุ่มล้างตัวกรอง -->
            <button
              type="button"
              class="btn btn-outline btn-sm"
              onclick="clearStaffRolesFilters()"
              title="ล้างตัวกรองทั้งหมด"
              style="height:36px; padding:0 10px; border-radius:8px; font-size:12px; display:inline-flex; align-items:center; gap:4px; color:#64748B; border-color:#CBD5E1; background:#FFFFFF;"
            >
              <span class="material-icons" style="font-size:15px;">filter_alt_off</span>
              <span>ล้างตัวกรอง</span>
            </button>
          </div>

          <!-- Counter & บันทึกทั้งหมด -->
          <div style="display:flex; align-items:center; gap:12px;">
            <span id="staff-filtered-count" style="font-size:12px; color:#475569; font-weight:600; white-space:nowrap;">
              กำลังโหลด...
            </span>
            <button
              type="button"
              id="btn-save-all-staff"
              class="btn btn-primary btn-sm"
              onclick="saveAllStaffRoles()"
              style="height:36px; padding:0 14px; border-radius:8px; font-size:12.5px; font-weight:600; display:inline-flex; align-items:center; gap:6px; background:#4338CA; border:none; box-shadow:0 2px 6px rgba(67,56,202,0.25); cursor:pointer;"
            >
              <span class="material-icons" style="font-size:16px;">save</span>
              <span>บันทึกทั้งหมด</span>
            </button>
          </div>
        </div>

        <!-- Table Container -->
        <div style="padding:16px 24px; overflow-y:auto; flex:1;">
          <table class="data-table">
            <thead>
              <tr>
                <th>ชื่อ - นามสกุล / อีเมล</th>
                <th>สาขาวิชา / สังกัด</th>
                <th class="text-center" style="width:110px;">อาจารย์ที่ปรึกษา</th>
                <th class="text-center" style="width:110px;">อาจารย์นิเทศก์</th>
                <th class="text-center" style="width:110px;">อาจารย์ประจำวิชา</th>
                <th class="text-center" style="width:110px;">เจ้าหน้าที่คณะ</th>
                <th class="text-center" style="width:85px;">บันทึก</th>
              </tr>
            </thead>
            <tbody id="staff-roles-tbody">
              <tr><td colspan="7" class="text-center py-6 text-gray-400">กำลังโหลดรายชื่อบุคลากร...</td></tr>
            </tbody>
          </table>
        </div>

        <!-- Modal Footer -->
        <div style="padding:12px 24px; background:#F8FAFC; border-top:1px solid #E2E8F0; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:12px; color:#64748B; display:flex; align-items:center; gap:6px;">
            <span class="material-icons" style="font-size:16px; color:#4F46E5;">info</span>
            <span>สามารถเลือกปรับสิทธิ์พร้อมกันหลายคน แล้วกด <b>"บันทึกทั้งหมด"</b> ได้ในคลิกเดียว</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <button class="btn btn-outline btn-sm" onclick="closeStaffRolesModal()" style="height:36px; padding:0 14px; border-radius:8px;">ปิดหน้าต่าง</button>
            <button
              type="button"
              id="btn-save-all-staff-footer"
              class="btn btn-primary btn-sm"
              onclick="saveAllStaffRoles()"
              style="height:36px; padding:0 16px; border-radius:8px; font-size:12.5px; font-weight:600; display:inline-flex; align-items:center; gap:6px; background:#4338CA; border:none; box-shadow:0 2px 6px rgba(67,56,202,0.25); cursor:pointer;"
            >
              <span class="material-icons" style="font-size:16px;">save</span>
              <span>บันทึกทั้งหมด</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: ดรอปนิสิต -->
    <!-- หน้าต่าง ปลดล็อก/ล็อก รอบออกฝึกตามเทอม (ปุ่มบนหัวการ์ด "รอบออกฝึก & ปลดล็อก") — เนื้อหาเติมโดย admin_dashboard.js -->
    <div id="cohort-bulk-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; padding:22px 26px; width:500px; max-width:92%; max-height:86vh; overflow-y:auto; box-shadow:0 20px 50px rgba(15,23,42,0.25);">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-icons" id="cohort-bulk-icon" style="font-size:24px;">lock_open</span>
            <h3 id="cohort-bulk-title" style="font-size:17px; font-weight:700; margin:0;">ปลดล็อกรอบออกฝึก</h3>
          </div>
          <button type="button" onclick="window.closeCohortBulkModal()" aria-label="ปิดหน้าต่าง" style="background:none; border:none; color:#64748B; cursor:pointer; display:flex; align-items:center;">
            <span class="material-icons" style="font-size:20px;">close</span>
          </button>
        </div>
        <p id="cohort-bulk-subtitle" style="font-size:12.5px; color:#64748B; margin:4px 0 14px;"></p>
        <div style="font-size:12.5px; font-weight:700; color:#475569; margin-bottom:6px;">เลือกเทอม</div>
        <div id="cohort-bulk-terms" style="display:flex; flex-direction:column; gap:6px; margin-bottom:14px;"></div>
        <div id="cohort-bulk-preview"></div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="window.closeCohortBulkModal()">ยกเลิก</button>
          <button type="button" id="cohort-bulk-confirm" onclick="window.submitCohortBulk()" style="color:white; border:none; padding:8px 16px; border-radius:10px; cursor:pointer; font-weight:700; font-size:13px;">ยืนยัน</button>
        </div>
      </div>
    </div>

    <!-- หน้าต่าง เพิ่ม / แก้ไข ประกาศสหกิจศึกษา — logic: admin_coop_postings.js -->
    <div id="coop-posting-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; padding:22px 26px; width:780px; max-width:94%; max-height:90vh; overflow-y:auto; box-shadow:0 20px 50px rgba(15,23,42,0.25);">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-icons" style="font-size:24px; color:#4338CA;">campaign</span>
            <h3 id="cp-title" style="font-size:17px; font-weight:700; margin:0; color:#1E1B4B;">เพิ่มประกาศสหกิจศึกษา</h3>
          </div>
          <button type="button" onclick="window.closeCoopPostingModal()" aria-label="ปิดหน้าต่าง" style="background:none; border:none; color:#64748B; cursor:pointer; display:flex; align-items:center;">
            <span class="material-icons" style="font-size:20px;">close</span>
          </button>
        </div>
        <input type="hidden" id="cp-master-id" />
        <datalist id="cp-master-list"></datalist>
        <style>
          #coop-posting-modal .cp-combo-list { display:none; position:absolute; left:0; right:0; top:calc(100% + 2px); z-index:30; max-height:240px; overflow-y:auto; background:#FFFFFF; border:1px solid #CBD5E1; border-radius:10px; box-shadow:0 10px 24px rgba(15,23,42,0.15); }
          #coop-posting-modal .cp-combo-group { padding:6px 12px 3px; font-size:11px; font-weight:800; color:#64748B; background:#F8FAFC; position:sticky; top:0; }
          #coop-posting-modal .cp-combo-option { padding:7px 14px; font-size:12.5px; cursor:pointer; color:#1E293B; }
          #coop-posting-modal .cp-combo-option.is-active, #coop-posting-modal .cp-combo-option:hover { background:#EEF2FF; }
          #coop-posting-modal .cp-combo-option.is-selected { font-weight:700; color:#4338CA; }
          #coop-posting-modal .cp-combo-option.is-custom { color:#4338CA; border-top:1px solid #E2E8F0; font-weight:600; }
          #coop-posting-modal .cp-combo-empty { padding:10px 14px; font-size:12px; color:#94A3B8; }
          #coop-posting-modal .cp-combo input.is-invalid { border-color:#F87171 !important; background:#FEF2F2; }
        </style>

        <div class="cp-section-title" style="font-size:13px; font-weight:800; color:#334155; margin:4px 0 8px;">1. บริษัท</div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px 12px;">
          <label style="font-size:12.5px; font-weight:600; color:#475569;">ชื่อบริษัท (ไทย) <span style="color:#DC2626;">*</span>
            <input id="cp-company" class="input-field" list="cp-master-list" onchange="window.onCoopCompanyPicked()" placeholder="พิมพ์ค้นหาจากฐานข้อมูลบริษัท หรือพิมพ์ชื่อใหม่" style="margin:4px 0 0; width:100%;" />
          </label>
          <label style="font-size:12.5px; font-weight:600; color:#475569;">ชื่อบริษัท (อังกฤษ)
            <input id="cp-company-en" class="input-field" style="margin:4px 0 0; width:100%;" />
          </label>
          <label style="font-size:12.5px; font-weight:600; color:#475569;">จังหวัด
            <div class="cp-combo" style="position:relative; margin-top:4px;">
              <input id="cp-province" class="input-field" autocomplete="off" placeholder="พิมพ์ค้นหา หรือเลือกจากรายการ" role="combobox" aria-autocomplete="list" aria-controls="cp-province-list" style="margin:0; width:100%; padding-right:30px;" />
              <span class="material-icons" aria-hidden="true" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); font-size:18px; color:#94A3B8; pointer-events:none;">expand_more</span>
              <div id="cp-province-list" class="cp-combo-list" role="listbox"></div>
            </div>
          </label>
          <label style="font-size:12.5px; font-weight:600; color:#475569;">เว็บไซต์
            <input id="cp-website" class="input-field" placeholder="https://" style="margin:4px 0 0; width:100%;" />
          </label>
        </div>
        <label style="display:block; font-size:12.5px; font-weight:600; color:#475569; margin-top:10px;">ที่อยู่ (ไม่ต้องใส่พิกัด)
          <textarea id="cp-address" class="input-field" rows="2" style="margin:4px 0 0; width:100%;"></textarea>
        </label>
        <label style="display:block; font-size:12.5px; font-weight:600; color:#475569; margin-top:10px;">รายละเอียดบริษัท
          <textarea id="cp-description" class="input-field" rows="2" placeholder="เช่น ประเภทธุรกิจ จำนวนพนักงาน" style="margin:4px 0 0; width:100%;"></textarea>
        </label>

        <div style="font-size:13px; font-weight:800; color:#334155; margin:16px 0 8px;">2. สวัสดิการและคุณสมบัติ</div>
        <div style="padding:9px 12px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; font-size:12px; color:#475569; line-height:1.6;">
          เปิดรับทุกสาขา · GPAX ขั้นต่ำ 2.00 (ต่ำกว่าเกณฑ์ระบบแค่เตือนนิสิต) · <strong>รอบเทอม ช่วงฝึก และวันปิดยื่น ใช้ตามรอบออกฝึกของแต่ละสาขา</strong> (แท็บ "รอบฝึกงาน &amp; ปลดล็อก") — ไม่ต้องตั้งในประกาศ
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:10px 12px; margin-top:10px;">
          <label style="font-size:12.5px; font-weight:600; color:#475569;">สวัสดิการ / เบี้ยเลี้ยง / ที่พัก
            <textarea id="cp-benefits" class="input-field" rows="3" style="margin:4px 0 0; width:100%;"></textarea>
          </label>
          <label style="font-size:12.5px; font-weight:600; color:#475569;">คุณสมบัติเพิ่มเติม
            <textarea id="cp-qualifications" class="input-field" rows="3" style="margin:4px 0 0; width:100%;"></textarea>
          </label>
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; margin:16px 0 8px;">
          <div style="font-size:13px; font-weight:800; color:#334155;">3. ตำแหน่งที่เปิดรับ <span style="color:#DC2626;">*</span></div>
          <button type="button" onclick="window.addCoopPositionRow()" style="background:#EEF2FF; border:1px dashed #818CF8; color:#4338CA; border-radius:8px; padding:5px 10px; font-size:12px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
            <span class="material-icons" style="font-size:15px;">add</span> เพิ่มตำแหน่ง
          </button>
        </div>
        <div id="cp-positions" style="display:flex; flex-direction:column; gap:8px;"></div>

        <div style="font-size:13px; font-weight:800; color:#334155; margin:16px 0 8px;">4. ผู้ติดต่อ HR <span style="font-weight:600; color:#B45309; font-size:12px;">🔒 เห็นเฉพาะเจ้าหน้าที่</span></div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px 12px;">
          <label style="font-size:12.5px; font-weight:600; color:#475569;">ชื่อผู้ติดต่อ
            <input id="cp-hr-name" class="input-field" style="margin:4px 0 0; width:100%;" />
          </label>
          <label style="font-size:12.5px; font-weight:600; color:#475569;">เบอร์โทร
            <input id="cp-hr-phone" class="input-field" style="margin:4px 0 0; width:100%;" />
          </label>
          <label style="font-size:12.5px; font-weight:600; color:#475569;">อีเมล
            <input id="cp-hr-email" type="email" class="input-field" style="margin:4px 0 0; width:100%;" />
          </label>
        </div>

        <div id="cp-error" role="alert" style="display:none; margin-top:14px; padding:9px 12px; background:#FEF2F2; border:1px solid #FECACA; border-radius:10px; color:#991B1B; font-size:12.5px;"></div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="window.closeCoopPostingModal()">ยกเลิก</button>
          <button type="button" id="cp-save" onclick="window.saveCoopPosting()" style="background:#4338CA; color:white; border:none; padding:8px 18px; border-radius:10px; cursor:pointer; font-weight:700; font-size:13px;">บันทึกประกาศ</button>
        </div>
      </div>
    </div>

    <!-- หน้าต่าง นำเข้าประกาศสหกิจจาก Excel (พรีวิวก่อนบันทึก) — logic: admin_coop_postings.js -->
    <div id="coop-import-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; padding:22px 26px; width:760px; max-width:94%; max-height:90vh; overflow-y:auto; box-shadow:0 20px 50px rgba(15,23,42,0.25);">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-icons" style="font-size:24px; color:#059669;">upload_file</span>
            <h3 style="font-size:17px; font-weight:700; margin:0; color:#1E1B4B;">นำเข้าประกาศสหกิจศึกษา (Excel / CSV)</h3>
          </div>
          <button type="button" onclick="window.closeCoopImportModal()" aria-label="ปิดหน้าต่าง" style="background:none; border:none; color:#64748B; cursor:pointer; display:flex; align-items:center;">
            <span class="material-icons" style="font-size:20px;">close</span>
          </button>
        </div>
        <ul style="font-size:12.5px; color:#475569; margin:8px 0 12px; padding-left:18px; line-height:1.7;">
          <li><strong>1 แถว = 1 ตำแหน่ง</strong> · แถวที่ชื่อบริษัทเหมือนกันจะรวมเป็นประกาศเดียว</li>
          <li>ถ้ามีประกาศของบริษัทนั้นอยู่แล้ว ระบบจะ<strong>เติมข้อมูล/เพิ่มตำแหน่ง</strong>ให้ (ตำแหน่งชื่อเดิมจะอัปเดตจำนวนที่รับ) ไม่ลบของเดิม</li>
          <li>จังหวัดต้องตรงกับชื่อจังหวัด หรือ "ต่างประเทศ" · ไม่ต้องใส่รอบเทอม/วันที่ (ใช้ตามรอบออกฝึกของแต่ละสาขา)</li>
        </ul>
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <a href="/api/admin/super-admin/coop-postings/import-template" download style="display:inline-flex; align-items:center; gap:4px; font-size:12.5px; font-weight:700; color:#4338CA; text-decoration:none; border:1px solid #C7D2FE; background:#EEF2FF; padding:6px 12px; border-radius:8px;">
            <span class="material-icons" style="font-size:16px;">download</span> ดาวน์โหลดไฟล์ตัวอย่าง
          </a>
          <input type="file" id="coop-import-file" accept=".xlsx,.xls,.csv" onchange="window.previewCoopImport()" style="font-size:12.5px;" />
        </div>
        <div id="coop-import-preview" style="margin-top:14px;"></div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="window.closeCoopImportModal()">ยกเลิก</button>
          <button type="button" id="coop-import-confirm" onclick="window.confirmCoopImport()" disabled style="background:#059669; color:white; border:none; padding:8px 18px; border-radius:10px; cursor:pointer; font-weight:700; font-size:13px; opacity:.5;">บันทึกการนำเข้า</button>
        </div>
      </div>
    </div>

    <!-- หน้าต่าง ปิดรุ่น / เก็บเข้าประวัติ + เลือกปีการศึกษาที่จบกระบวนการ (ใช้ทั้งตอนปิดรุ่น และแก้ปีการศึกษาของรุ่นที่ปิดแล้ว) — เนื้อหาเติมโดย admin_dashboard.js -->
    <div id="cohort-archive-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; padding:22px 26px; width:500px; max-width:92%; max-height:86vh; overflow-y:auto; box-shadow:0 20px 50px rgba(15,23,42,0.25);">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="material-icons" style="font-size:24px; color:#4338CA;">inventory_2</span>
            <h3 id="cohort-archive-title" style="font-size:17px; font-weight:700; margin:0; color:#1E1B4B;">ปิดรุ่น / เก็บเข้าประวัติ</h3>
          </div>
          <button type="button" onclick="window.closeCohortArchiveModal()" aria-label="ปิดหน้าต่าง" style="background:none; border:none; color:#64748B; cursor:pointer; display:flex; align-items:center;">
            <span class="material-icons" style="font-size:20px;">close</span>
          </button>
        </div>
        <p id="cohort-archive-subtitle" style="font-size:12.5px; color:#64748B; margin:4px 0 14px;"></p>
        <label for="cohort-archive-year" style="display:block; font-size:12.5px; font-weight:700; color:#475569; margin-bottom:6px;">ปีการศึกษาที่จบกระบวนการ</label>
        <select id="cohort-archive-year" class="input-field" onchange="window.updateCohortArchivePreview()" style="width:100%; margin:0; font-size:13px;"></select>
        <div id="cohort-archive-year-hint" style="font-size:11.5px; color:#64748B; margin-top:6px;"></div>
        <div id="cohort-archive-students" style="margin-top:14px;"></div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
          <button type="button" class="btn btn-outline btn-sm" onclick="window.closeCohortArchiveModal()">ยกเลิก</button>
          <button type="button" id="cohort-archive-confirm" onclick="window.submitCohortArchive()" style="background:#4338CA; color:white; border:none; padding:8px 16px; border-radius:10px; cursor:pointer; font-weight:700; font-size:13px;">ยืนยันปิดรุ่น</button>
        </div>
      </div>
    </div>

    <div id="drop-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; padding:24px 28px; width:440px; max-width:92%; box-shadow:0 20px 50px rgba(15,23,42,0.25);">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
          <span class="material-icons" style="color:#DC2626; font-size:24px;">warning_amber</span>
          <h3 style="font-size:17px; font-weight:700; color:#991B1B; margin:0;">ยืนยันการดรอปนิสิต</h3>
        </div>
        <p style="font-size:13px; color:#475569; margin-bottom:14px; line-height:1.5;">
          คุณกำลังจะดรอปนิสิตที่เลือกจำนวน <strong id="drop-selected-count" style="color:#DC2626;">0</strong> คน ออกจากรอบการฝึกงานปัจจุบัน (ข้อมูลไม่ถูกลบและกู้คืนได้ภายหลัง)
        </p>
        <div style="margin-bottom:12px;">
          <label style="font-size:13px; font-weight:600; color:#475569;">สาเหตุการดรอป</label>
          <select id="drop-reason-preset" class="input-field" style="margin-top:4px;" onchange="toggleDropReasonNote()">
            <option value="ดรอปเรียน / พักการศึกษา">ดรอปเรียน / พักการศึกษา</option>
            <option value="ถอนรายวิชาเตรียมฝึกงาน (W)">ถอนรายวิชาเตรียมฝึกงาน (W)</option>
            <option value="ชั่วโมงอบรมไม่ครบตามเกณฑ์">ชั่วโมงอบรมไม่ครบตามเกณฑ์</option>
            <option value="เลื่อนการฝึกงานไปปีถัดไป">เลื่อนการฝึกงานไปปีถัดไป</option>
            <option value="custom">อื่นๆ (ระบุในหมายเหตุ)</option>
          </select>
        </div>
        <div style="margin-bottom:18px;">
          <label style="font-size:13px; font-weight:600; color:#475569;">หมายเหตุเพิ่มเติม (ถ้ามี)</label>
          <input type="text" id="drop-reason-note" class="input-field" placeholder="เปิดให้กรอกเมื่อเลือก 'อื่นๆ (ระบุในหมายเหตุ)'" style="margin-top:4px; background-color:#F1F5F9; cursor:not-allowed;" disabled />
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="closeDropStudentModal()">ยกเลิก</button>
          <button class="btn btn-sm" onclick="submitDropStudents()" style="background:#DC2626; color:white; border:none; padding:8px 16px; border-radius:10px; cursor:pointer; font-weight:600;">ยืนยันดรอปนิสิต</button>
        </div>
      </div>
    </div>

    <!-- Modal: กู้คืนสถานะนิสิต -->
    <div id="restore-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; padding:24px 28px; width:420px; max-width:92%; box-shadow:0 20px 50px rgba(15,23,42,0.25);">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
          <span class="material-icons" style="color:#059669; font-size:24px;">restore</span>
          <h3 style="font-size:17px; font-weight:700; color:#065F46; margin:0;">กู้คืนสถานะนิสิต</h3>
        </div>
        <p style="font-size:13px; color:#475569; margin-bottom:18px; line-height:1.5;">
          ต้องการนำนิสิตที่เลือกจำนวน <strong id="restore-selected-count" style="color:#059669;">0</strong> คน กลับเข้าสู่รายชื่อนิสิตกำลังศึกษา/ฝึกงานปกติใช่หรือไม่?
        </p>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="closeRestoreStudentModal()">ยกเลิก</button>
          <button class="btn btn-sm" onclick="submitRestoreStudents()" style="background:#059669; color:white; border:none; padding:8px 16px; border-radius:10px; cursor:pointer; font-weight:600;">ยืนยันกู้คืนสถานะ</button>
        </div>
      </div>
    </div>

    <!-- Modal: [REQ-02 & REQ-03] นำเข้ารายชื่อนิสิตจากระบบ REG & UP Academy พร้อม Update Detection Popup -->
    <div id="import-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; width:760px; max-width:95%; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 25px 60px rgba(15,23,42,0.3); overflow:hidden;">
        <div style="background:linear-gradient(135deg, #065F46 0%, #10B981 100%); padding:18px 24px; color:white; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-icons" style="font-size:24px;">upload_file</span>
            <div>
              <h3 style="font-size:16px; font-weight:700; margin:0;">นำเข้าข้อมูลนิสิตจากระบบ REG &amp; UP Academy (Excel / CSV)</h3>
              <p style="font-size:11.5px; color:#D1FAE5; margin:2px 0 0 0;">แมปตามรหัสนิสิตอัตโนมัติ ตรวจจับแถวที่มีการอัปเดตโดยไม่ลบข้อมูลเดิม</p>
            </div>
          </div>
          <button onclick="closeImportModal()" style="background:none; border:none; color:white; cursor:pointer; display:flex; align-items:center; opacity:0.85;">
            <span class="material-icons" style="font-size:20px;">close</span>
          </button>
        </div>

        <div style="padding:20px 24px; overflow-y:auto; flex:1;">
          <!-- Step 1: Upload File Zone -->
          <div id="import-upload-zone" style="border:2px dashed #CBD5E1; border-radius:16px; padding:28px 20px; text-align:center; background:#F8FAFC; cursor:pointer; transition:all 0.2s;"
               onclick="document.getElementById('import-file-input').click()"
               ondragover="event.preventDefault(); this.style.borderColor='#10B981'; this.style.background='#ECFDF5';"
               ondragleave="this.style.borderColor='#CBD5E1'; this.style.background='#F8FAFC';"
               ondrop="handleImportDrop(event)">
            <input type="file" id="import-file-input" accept=".xlsx,.xls,.csv" style="display:none;" onchange="handleImportFileSelect(event)" />
            <span class="material-icons" style="font-size:44px; color:#10B981; margin-bottom:8px;">cloud_upload</span>
            <p style="font-size:14.5px; font-weight:700; color:#1E293B; margin:0 0 4px 0;">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์จากระบบ REG / UP Academy มาวางที่นี่</p>
            <p style="font-size:12px; color:#64748B; margin:0;">รองรับไฟล์ <strong>.xlsx, .xls, .csv</strong> (รองรับทั้ง 8 สาขาวิชาของคณะ ICT และตรวจจับการอัปเดต GPAX / ชั่วโมงเตรียมความพร้อมอัตโนมัติ)</p>
          </div>

          <!-- Selected File Info -->
          <div id="import-selected-file-wrap" style="display:none; margin-top:12px; padding:10px 14px; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:12px; align-items:center; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="material-icons" style="color:#16A34A; font-size:20px;">description</span>
              <span id="import-selected-file-name" style="font-size:13px; font-weight:600; color:#166534;">filename.xlsx</span>
            </div>
            <button onclick="resetImportFile()" style="background:none; border:none; color:#DC2626; font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:2px;">
              <span class="material-icons" style="font-size:15px;">delete</span> เปลี่ยนไฟล์
            </button>
          </div>

          <!-- Step 2: Preview & Update Detection Summary -->
          <div id="import-preview-wrap" style="display:none; margin-top:16px;">
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:12px;">
              <div style="padding:10px 12px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; text-align:center;">
                <div style="font-size:11px; color:#64748B;">อ่านพบในไฟล์</div>
                <div id="import-stat-total" style="font-size:18px; font-weight:800; color:#334155;">0</div>
              </div>
              <div style="padding:10px 12px; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:12px; text-align:center;">
                <div style="font-size:11px; color:#166534;">✨ นิสิตใหม่</div>
                <div id="import-stat-new" style="font-size:18px; font-weight:800; color:#15803D;">0</div>
              </div>
              <div style="padding:10px 12px; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:12px; text-align:center;">
                <div style="font-size:11px; color:#1E40AF;">🔄 อัปเดตข้อมูลเดิม</div>
                <div id="import-stat-updated" style="font-size:18px; font-weight:800; color:#1D4ED8;">0</div>
              </div>
              <div style="padding:10px 12px; background:#EEF2FF; border:1px solid #C7D2FE; border-radius:12px; text-align:center;">
                <div style="font-size:11px; color:#3730A3;">คงเดิม / ปีการศึกษา</div>
                <div style="font-size:14px; font-weight:700; color:#4338CA;">
                  <span id="import-stat-unchanged">0</span> คน (<span id="import-stat-acad-year">-</span>)
                </div>
              </div>
            </div>

            <span id="import-stat-matched" style="display:none;">0</span>
            <span id="import-stat-skipped" style="display:none;">0</span>

            <div id="import-update-detection-box" style="display:none; margin-bottom:14px; padding:12px 16px; background:#FFFBEB; border:1px solid #FDE68A; border-radius:12px;">
              <div style="display:flex; align-items:center; gap:6px; font-size:12.5px; font-weight:700; color:#92400E; margin-bottom:6px;">
                <span class="material-icons" style="font-size:17px; color:#D97706;">sync_problem</span>
                <span>ระบบตรวจพบการเปลี่ยนแปลงข้อมูลนิสิตเดิม (Update Detection):</span>
              </div>
              <div id="import-update-detection-list" style="max-height:110px; overflow-y:auto; font-size:12px; color:#78350F; display:flex; flex-direction:column; gap:4px;"></div>
            </div>

            <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:6px; display:flex; justify-content:space-between;">
              <span>ตัวอย่างรายชื่อนิสิตที่จะนำเข้า / อัปเดต (<span id="import-preview-count">0</span> คน):</span>
              <span style="color:#64748B; font-weight:400;">* ไม่ลบข้อมูลติดต่อและเอกสารเดิมของนิสิต</span>
            </div>

            <div style="max-height:220px; overflow-y:auto; border:1px solid #E2E8F0; border-radius:12px;">
              <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead style="background:#F1F5F9; position:sticky; top:0;">
                  <tr>
                    <th style="padding:8px 10px; text-align:left; color:#475569;">รหัสนิสิต</th>
                    <th style="padding:8px 10px; text-align:left; color:#475569;">ชื่อ - นามสกุล</th>
                    <th style="padding:8px 10px; text-align:left; color:#475569;">สาขาวิชา</th>
                    <th style="padding:8px 10px; text-align:center; color:#475569;">ชั้นปี / GPAX</th>
                    <th style="padding:8px 10px; text-align:left; color:#475569;">สถานะการนำเข้า</th>
                  </tr>
                </thead>
                <tbody id="import-preview-tbody"></tbody>
              </table>
            </div>
          </div>

          <div id="import-loading" style="display:none; text-align:center; padding:24px;">
            <span class="inline-block animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent"></span>
            <p style="font-size:13px; color:#475569; margin-top:8px;">กำลังตรวจสอบไฟล์และเปรียบเทียบข้อมูลเดิม...</p>
          </div>
        </div>

        <div style="padding:14px 24px; background:#F8FAFC; border-top:1px solid #E2E8F0; display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="closeImportModal()" style="border-radius:10px;">ยกเลิก</button>
          <button id="btn-confirm-import" class="btn btn-sm" onclick="confirmImport()" style="display:none; background:#10B981; color:white; border:none; border-radius:10px; align-items:center; gap:6px; padding:8px 18px; font-weight:600; cursor:pointer;">
            <span class="material-icons" style="font-size:16px;">check_circle</span>
            <span id="btn-confirm-import-text">ยืนยันนำเข้าข้อมูล</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: [SCRUM-63] นำเข้ารายชื่อนิสิตเข้าร่วมกิจกรรมอบรม (Excel / CSV) พร้อม Preview สรุปจำนวนคน -->
    <div id="checkin-import-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; width:760px; max-width:95%; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 25px 60px rgba(15,23,42,0.3); overflow:hidden;">
        <div style="background:linear-gradient(135deg, #065F46 0%, #10B981 100%); padding:18px 24px; color:white; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-icons" style="font-size:24px;">upload_file</span>
            <div>
              <h3 style="font-size:16px; font-weight:700; margin:0;">นำเข้ารายชื่อนิสิตเข้าร่วมกิจกรรมอบรม (Excel / CSV)</h3>
              <p style="font-size:11.5px; color:#D1FAE5; margin:2px 0 0 0;">สแกนรหัสนิสิตจากใบลงชื่อหน้างานอัตโนมัติ พร้อมตรวจสอบรายชื่อก่อนบันทึกชั่วโมง</p>
            </div>
          </div>
          <button onclick="closeCheckInImportModal()" style="background:none; border:none; color:white; cursor:pointer; display:flex; align-items:center; opacity:0.85;">
            <span class="material-icons" style="font-size:20px;">close</span>
          </button>
        </div>

        <div style="padding:20px 24px; overflow-y:auto; flex:1;">
          <!-- แถบแสดงกิจกรรมและช่วงเวลาที่เลือก -->
          <div style="margin-bottom:14px; padding:10px 14px; background:#EEF2FF; border:1px solid #C7D2FE; border-radius:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <div style="font-size:12.5px; color:#1E1B4B;">
              <strong>🎯 กิจกรรม:</strong> <span id="checkin-import-event-title" style="font-weight:700; color:#312E81;">-</span>
            </div>
            <div style="font-size:12px; background:#E0E7FF; color:#3730A3; padding:3px 10px; border-radius:999px; font-weight:700;">
              🕒 รอบ: <span id="checkin-import-session-title">-</span>
            </div>
          </div>

          <!-- Step 1: Upload File Zone -->
          <div id="checkin-import-upload-zone" style="border:2px dashed #CBD5E1; border-radius:16px; padding:28px 20px; text-align:center; background:#F8FAFC; cursor:pointer; transition:all 0.2s;"
               onclick="document.getElementById('checkin-import-file-input').click()"
               ondragover="event.preventDefault(); this.style.borderColor='#10B981'; this.style.background='#ECFDF5';"
               ondragleave="this.style.borderColor='#CBD5E1'; this.style.background='#F8FAFC';"
               ondrop="handleCheckInImportDrop(event)">
            <input type="file" id="checkin-import-file-input" accept=".xlsx,.xls,.csv" style="display:none;" onchange="handleCheckInImportFileSelect(event)" />
            <span class="material-icons" style="font-size:44px; color:#10B981; margin-bottom:8px;">cloud_upload</span>
            <p style="font-size:14.5px; font-weight:700; color:#1E293B; margin:0 0 4px 0;">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์ใบลงชื่อหน้างานมาวางที่นี่</p>
            <p style="font-size:12px; color:#64748B; margin:0;">รองรับไฟล์ <strong>.xlsx, .xls, .csv</strong> จาก Excel หรือ Google Sheets (ระบบตรวจจับรหัสนิสิต 8 หลักให้อัตโนมัติ)</p>
          </div>

          <!-- Selected File Info -->
          <div id="checkin-import-selected-file-wrap" style="display:none; margin-top:12px; padding:10px 14px; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:12px; align-items:center; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="material-icons" style="color:#16A34A; font-size:20px;">description</span>
              <span id="checkin-import-selected-file-name" style="font-size:13px; font-weight:600; color:#166534;">filename.xlsx</span>
            </div>
            <button onclick="resetCheckInImportFile()" style="background:none; border:none; color:#DC2626; font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:2px;">
              <span class="material-icons" style="font-size:15px;">delete</span> เปลี่ยนไฟล์
            </button>
          </div>

          <!-- Step 2: Preview & Validation Summary -->
          <div id="checkin-import-preview-wrap" style="display:none; margin-top:16px;">
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:12px;">
              <div style="padding:10px 12px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; text-align:center;">
                <div style="font-size:11px; color:#64748B;">อ่านพบในไฟล์</div>
                <div id="checkin-import-stat-total" style="font-size:18px; font-weight:800; color:#334155;">0</div>
              </div>
              <div style="padding:10px 12px; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:12px; text-align:center;">
                <div style="font-size:11px; color:#166534;">🟢 พร้อมบันทึก</div>
                <div id="checkin-import-stat-ready" style="font-size:18px; font-weight:800; color:#15803D;">0</div>
              </div>
              <div style="padding:10px 12px; background:#FFFBEB; border:1px solid #FDE68A; border-radius:12px; text-align:center;">
                <div style="font-size:11px; color:#92400E;">🟡 ซ้ำในรอบนี้</div>
                <div id="checkin-import-stat-duplicate" style="font-size:18px; font-weight:800; color:#D97706;">0</div>
              </div>
              <div style="padding:10px 12px; background:#FFF1F2; border:1px solid #FECDD3; border-radius:12px; text-align:center;">
                <div style="font-size:11px; color:#9F1239;">🔴 ไม่พบในระบบ</div>
                <div id="checkin-import-stat-notfound" style="font-size:18px; font-weight:800; color:#E11D48;">0</div>
              </div>
            </div>

            <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:6px; display:flex; justify-content:space-between;">
              <span>ตารางตรวจสอบรายชื่อนิสิตจากไฟล์ (<span id="checkin-import-preview-count">0</span> รายการ):</span>
              <span style="color:#64748B; font-weight:400;">* ระบบจะบันทึกเฉพาะสถานะ "พร้อมบันทึก" เท่านั้น</span>
            </div>

            <div style="max-height:240px; overflow-y:auto; border:1px solid #E2E8F0; border-radius:12px;">
              <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead style="background:#F1F5F9; position:sticky; top:0;">
                  <tr>
                    <th style="padding:8px 10px; text-align:left; color:#475569;">รหัสนิสิต</th>
                    <th style="padding:8px 10px; text-align:left; color:#475569;">ชื่อ - นามสกุล</th>
                    <th style="padding:8px 10px; text-align:left; color:#475569;">สาขาวิชา</th>
                    <th style="padding:8px 10px; text-align:center; color:#475569;">ชั้นปี</th>
                    <th style="padding:8px 10px; text-align:left; color:#475569;">สถานะการตรวจสอบ</th>
                  </tr>
                </thead>
                <tbody id="checkin-import-preview-tbody"></tbody>
              </table>
            </div>
          </div>

          <div id="checkin-import-loading" style="display:none; text-align:center; padding:24px;">
            <span class="inline-block animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent"></span>
            <p style="font-size:13px; color:#475569; margin-top:8px;">กำลังสแกนรหัสนิสิตและตรวจสอบข้อมูลกับระบบ...</p>
          </div>
        </div>

        <div style="padding:14px 24px; background:#F8FAFC; border-top:1px solid #E2E8F0; display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="closeCheckInImportModal()" style="border-radius:10px;">ยกเลิก</button>
          <button id="btn-confirm-checkin-import" class="btn btn-sm" onclick="confirmCheckInImport()" style="display:none; background:#10B981; color:white; border:none; border-radius:10px; align-items:center; gap:6px; padding:8px 18px; font-weight:600; cursor:pointer;">
            <span class="material-icons" style="font-size:16px;">check_circle</span>
            <span id="btn-confirm-checkin-import-text">ยืนยันบันทึก Check-in</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: นำเข้าสถานประกอบการเข้า Master Data จากไฟล์ Excel / CSV (เพิ่มด้วยสถานะ "คณะ ICT เป็นผู้เพิ่ม") -->
    <div id="company-import-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; width:860px; max-width:95%; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 25px 60px rgba(15,23,42,0.3); overflow:hidden;">
        <div style="background:linear-gradient(135deg, #065F46 0%, #10B981 100%); padding:18px 24px; color:white; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-icons" style="font-size:24px;">upload_file</span>
            <div>
              <h3 style="font-size:16px; font-weight:700; margin:0;">นำเข้าสถานประกอบการ (Excel / CSV)</h3>
              <p style="font-size:11.5px; color:#D1FAE5; margin:2px 0 0 0;">รายการใหม่จะถูกเพิ่มเข้า Master Data ด้วยสถานะ "คณะ ICT เป็นผู้เพิ่ม"</p>
            </div>
          </div>
          <button onclick="closeCompanyImportModal()" style="background:none; border:none; color:white; cursor:pointer; display:flex; align-items:center; opacity:0.85;">
            <span class="material-icons" style="font-size:20px;">close</span>
          </button>
        </div>

        <div style="padding:20px 24px; overflow-y:auto; flex:1;">
          <div style="margin-bottom:14px; padding:10px 14px; background:#EEF2FF; border:1px solid #C7D2FE; border-radius:12px; font-size:12px; color:#1E1B4B; line-height:1.7;">
            <strong>หัวคอลัมน์ที่รองรับ (แถวแรกของไฟล์):</strong>
            ชื่อบริษัท / ชื่อสถานประกอบการ <span style="color:#B91C1C;">(จำเป็น)</span>, ชื่อภาษาอังกฤษ, จังหวัด, ที่อยู่, ผู้ติดต่อ, เบอร์โทร, อีเมล, ตำแหน่งที่รับ
            <div style="color:#64748B;">ชื่อที่มีอยู่ใน Master Data แล้ว หรือซ้ำกันในไฟล์ ระบบจะข้ามให้อัตโนมัติ</div>
            <a href="/api/admin/super-admin/companies/import-template" download="company_import_template.xlsx" style="display:inline-flex; align-items:center; gap:4px; margin-top:4px; color:#4338CA; font-weight:700; text-decoration:underline;">
              <span class="material-icons" style="font-size:15px;">download</span> ดาวน์โหลดไฟล์ตัวอย่าง (.xlsx)
            </a>
          </div>

          <div id="company-import-upload-zone" style="border:2px dashed #CBD5E1; border-radius:16px; padding:28px 20px; text-align:center; background:#F8FAFC; cursor:pointer; transition:all 0.2s;"
               onclick="document.getElementById('company-import-file-input').click()"
               ondragover="event.preventDefault(); this.style.borderColor='#10B981'; this.style.background='#ECFDF5';"
               ondragleave="this.style.borderColor='#CBD5E1'; this.style.background='#F8FAFC';"
               ondrop="handleCompanyImportDrop(event)">
            <input type="file" id="company-import-file-input" accept=".xlsx,.xls,.csv" style="display:none;" onchange="handleCompanyImportFileSelect(event)" />
            <span class="material-icons" style="font-size:44px; color:#10B981; margin-bottom:8px;">cloud_upload</span>
            <p style="font-size:14.5px; font-weight:700; color:#1E293B; margin:0 0 4px 0;">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์รายชื่อบริษัทมาวางที่นี่</p>
            <p style="font-size:12px; color:#64748B; margin:0;">รองรับไฟล์ <strong>.xlsx, .xls, .csv</strong> (อ่านจากแผ่นงานแรก)</p>
          </div>

          <div id="company-import-selected-file-wrap" style="display:none; margin-top:12px; padding:10px 14px; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:12px; align-items:center; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="material-icons" style="color:#16A34A; font-size:20px;">description</span>
              <span id="company-import-selected-file-name" style="font-size:13px; font-weight:600; color:#166534;">filename.xlsx</span>
            </div>
            <button onclick="resetCompanyImportFile()" style="background:none; border:none; color:#DC2626; font-size:12px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:2px;">
              <span class="material-icons" style="font-size:15px;">delete</span> เปลี่ยนไฟล์
            </button>
          </div>

          <div id="company-import-preview-wrap" style="display:none; margin-top:16px;">
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:12px;">
              <div style="padding:10px 12px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; text-align:center;">
                <div style="font-size:11px; color:#64748B;">อ่านพบในไฟล์</div>
                <div id="company-import-stat-total" style="font-size:18px; font-weight:800; color:#334155;">0</div>
              </div>
              <div style="padding:10px 12px; background:#F0FDF4; border:1px solid #BBF7D0; border-radius:12px; text-align:center;">
                <div style="font-size:11px; color:#166534;">🟢 พร้อมนำเข้า</div>
                <div id="company-import-stat-ready" style="font-size:18px; font-weight:800; color:#15803D;">0</div>
              </div>
              <div style="padding:10px 12px; background:#FFFBEB; border:1px solid #FDE68A; border-radius:12px; text-align:center;">
                <div style="font-size:11px; color:#92400E;">🟡 มีใน Master Data แล้ว</div>
                <div id="company-import-stat-existing" style="font-size:18px; font-weight:800; color:#D97706;">0</div>
              </div>
              <div style="padding:10px 12px; background:#FFF1F2; border:1px solid #FECDD3; border-radius:12px; text-align:center;">
                <div style="font-size:11px; color:#9F1239;">🔴 ซ้ำกันในไฟล์</div>
                <div id="company-import-stat-duplicate" style="font-size:18px; font-weight:800; color:#E11D48;">0</div>
              </div>
            </div>

            <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:6px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:4px;">
              <span>ตารางตรวจสอบรายชื่อบริษัทจากไฟล์ (<span id="company-import-preview-count">0</span> รายการ):</span>
              <span style="color:#64748B; font-weight:400;">* ระบบจะเพิ่มเฉพาะสถานะ "พร้อมนำเข้า" เท่านั้น</span>
            </div>

            <div style="max-height:280px; overflow:auto; border:1px solid #E2E8F0; border-radius:12px;">
              <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead style="background:#F1F5F9; position:sticky; top:0;">
                  <tr>
                    <th style="padding:8px 10px; text-align:center; color:#475569;">แถว</th>
                    <th style="padding:8px 10px; text-align:left; color:#475569;">ชื่อสถานประกอบการ</th>
                    <th style="padding:8px 10px; text-align:left; color:#475569;">จังหวัด</th>
                    <th style="padding:8px 10px; text-align:left; color:#475569;">ผู้ติดต่อ / เบอร์โทร</th>
                    <th style="padding:8px 10px; text-align:left; color:#475569;">สถานะการตรวจสอบ</th>
                  </tr>
                </thead>
                <tbody id="company-import-preview-tbody"></tbody>
              </table>
            </div>
          </div>

          <div id="company-import-loading" style="display:none; text-align:center; padding:24px;">
            <span class="inline-block animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent"></span>
            <p style="font-size:13px; color:#475569; margin-top:8px;">กำลังอ่านไฟล์และตรวจสอบกับ Master Data...</p>
          </div>
        </div>

        <div style="padding:14px 24px; background:#F8FAFC; border-top:1px solid #E2E8F0; display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="closeCompanyImportModal()" style="border-radius:10px;">ยกเลิก</button>
          <button id="btn-confirm-company-import" class="btn btn-sm" onclick="confirmCompanyImport()" style="display:none; background:#10B981; color:white; border:none; border-radius:10px; align-items:center; gap:6px; padding:8px 18px; font-weight:600; cursor:pointer;">
            <span class="material-icons" style="font-size:16px;">check_circle</span>
            <span id="btn-confirm-company-import-text">ยืนยันนำเข้า</span>
          </button>
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
                <p style="font-size:12px; color:#64748B; margin:3px 0 0 0;">ส่งออกเฉพาะรายชื่อที่ตรงกับตัวกรอง สาขา ชั้นปี สถานะ หรือคำค้นหาปัจจุบัน</p>
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
                  <span id="export-all-title" style="font-size:13.5px; font-weight:700; color:#1E293B;">นิสิตทั้งหมดในระบบ (All Students)</span>
                  <span id="export-count-all" style="font-size:11px; font-weight:700; background:#F1F5F9; color:#475569; padding:2px 8px; border-radius:999px;">0 รายการ</span>
                </div>
                <p style="font-size:12px; color:#64748B; margin:3px 0 0 0;">ส่งออกข้อมูลนิสิตทุกชั้นปีและทุกสถานะในแท็บปัจจุบัน</p>
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

    <!-- Modal: เลือกรูปแบบการ Export ข้อมูลเชื่อมโยง Co-op 01 -->
    <div id="coop-export-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; width:520px; max-width:92%; box-shadow:0 20px 50px rgba(15,23,42,0.25); overflow:hidden;">
        <div style="background:linear-gradient(135deg, #065F46 0%, #10B981 100%); padding:18px 24px; color:white; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-icons" style="font-size:24px;">sync_alt</span>
            <div>
              <h3 style="font-size:16px; font-weight:700; margin:0;">ส่งออกข้อมูล Co-op ICT (Co-op 01 Export)</h3>
              <p style="font-size:11.5px; color:#D1FAE5; margin:2px 0 0 0;">ไฟล์ CSV มาตรฐานพร้อมนำเข้าสู่ระบบ Co-op ICT ของพี่แดง</p>
            </div>
          </div>
          <button onclick="window.closeCoopExportModal ? window.closeCoopExportModal() : null" style="background:none; border:none; color:white; cursor:pointer; display:flex; align-items:center; opacity:0.85;">
            <span class="material-icons" style="font-size:20px;">close</span>
          </button>
        </div>

        <div style="padding:20px 24px;">
          <p style="font-size:13px; color:#475569; margin-bottom:14px; font-weight:500;">กรุณาเลือกขอบเขตข้อมูลนิสิตที่ต้องการส่งออก:</p>

          <div style="display:flex; flex-direction:column; gap:10px;">
            <label id="coop-export-opt-selected-label" style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px; border:2px solid #E2E8F0; background:#FFFFFF; border-radius:12px; cursor:pointer; transition:all 0.15s;">
              <input type="radio" name="coop-export-scope" value="selected" id="coop-export-scope-selected" onchange="window.updateCoopExportSummary ? window.updateCoopExportSummary() : null" style="margin-top:3px; width:16px; height:16px; accent-color:#10B981; cursor:pointer;" />
              <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:13.5px; font-weight:700; color:#1E293B;">เฉพาะนิสิตที่ติ๊กเลือก (Selected)</span>
                  <span id="coop-export-count-selected" style="font-size:11px; font-weight:700; background:#F1F5F9; color:#475569; padding:2px 8px; border-radius:999px;">0 รายการ</span>
                </div>
                <p style="font-size:12px; color:#64748B; margin:3px 0 0 0;">ส่งออกเฉพาะรายชื่อที่คุณติ๊กถูกในช่อง Checkbox ด้านขวาของตาราง</p>
              </div>
            </label>

            <label id="coop-export-opt-filtered-label" style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px; border:2px solid #10B981; background:#ECFDF5; border-radius:12px; cursor:pointer; transition:all 0.15s;">
              <input type="radio" name="coop-export-scope" value="filtered" id="coop-export-scope-filtered" checked onchange="window.updateCoopExportSummary ? window.updateCoopExportSummary() : null" style="margin-top:3px; width:16px; height:16px; accent-color:#10B981; cursor:pointer;" />
              <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:13.5px; font-weight:700; color:#1E293B;">ตามตัวกรองปัจจุบัน (Filtered)</span>
                  <span id="coop-export-count-filtered" style="font-size:11px; font-weight:700; background:#D1FAE5; color:#065F46; padding:2px 8px; border-radius:999px;">0 รายการ</span>
                </div>
                <p style="font-size:12px; color:#64748B; margin:3px 0 0 0;">ส่งออกตามเงื่อนไขตัวกรอง สาขาวิชา หรือสถานะที่เลือกไว้</p>
              </div>
            </label>

            <label id="coop-export-opt-all-label" style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px; border:2px solid #E2E8F0; background:#FFFFFF; border-radius:12px; cursor:pointer; transition:all 0.15s;">
              <input type="radio" name="coop-export-scope" value="all_dispatched" id="coop-export-scope-all" onchange="window.updateCoopExportSummary ? window.updateCoopExportSummary() : null" style="margin-top:3px; width:16px; height:16px; accent-color:#10B981; cursor:pointer;" />
              <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:13.5px; font-weight:700; color:#1E293B;">นิสิตที่ออกหนังสือส่งตัวแล้วทั้งหมด (All Dispatched)</span>
                  <span id="coop-export-count-all" style="font-size:11px; font-weight:700; background:#F1F5F9; color:#475569; padding:2px 8px; border-radius:999px;">0 รายการ</span>
                </div>
                <p style="font-size:12px; color:#64748B; margin:3px 0 0 0;">ส่งออกนิสิตที่เสร็จสิ้นขั้นตอนออกหนังสือส่งตัวแล้วครบทุกคนในระบบ</p>
              </div>
            </label>
          </div>

          <div style="margin-top:14px; padding:10px 14px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; display:flex; align-items:center; gap:8px;">
            <span class="material-icons" style="font-size:18px; color:#10B981;">info</span>
            <span id="coop-export-summary-text" style="font-size:12px; color:#334155; font-weight:500;">เตรียมส่งออกข้อมูล 0 รายการ</span>
          </div>
        </div>

        <div style="padding:14px 24px; background:#F8FAFC; border-top:1px solid #E2E8F0; display:flex; justify-content:flex-end; gap:8px;">
          <button class="btn btn-outline btn-sm" onclick="window.closeCoopExportModal ? window.closeCoopExportModal() : null" style="border-radius:10px;">ยกเลิก</button>
          <button id="btn-confirm-coop-export" class="btn btn-sm" onclick="window.confirmCoopExport ? window.confirmCoopExport() : null" style="background:#10B981; color:white; border:none; border-radius:10px; display:inline-flex; align-items:center; gap:6px; padding:8px 18px; font-weight:600; cursor:pointer;">
            <span class="material-icons" style="font-size:16px;">download</span> ดาวน์โหลดไฟล์ CSV
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: ดูประวัติการยื่นบริษัทเดิมที่ไม่ผ่าน (Student Archive Details) -->
    <div id="student-archive-modal" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
      <div style="background:white; border-radius:20px; width:740px; max-width:94%; max-height:85vh; display:flex; flex-direction:column; box-shadow:0 20px 50px rgba(15,23,42,0.25); overflow:hidden;">
        <div style="background:linear-gradient(135deg, #1E1B4B 0%, #312E81 100%); padding:18px 24px; color:white; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="material-icons" style="font-size:24px; color:#FCD34D;">history_edu</span>
            <div>
              <h3 style="font-size:16px; font-weight:700; margin:0;" id="student-archive-modal-title">ประวัติการยื่นบริษัทเดิม (Archive)</h3>
              <p style="font-size:11.5px; color:#C7D2FE; margin:2px 0 0 0;" id="student-archive-modal-subtitle">รายการบริษัทที่เคยถูกปฏิเสธหรือยกเลิกในรอบก่อนหน้า</p>
            </div>
          </div>
          <button onclick="window.closeStudentArchiveModal ? window.closeStudentArchiveModal() : null" style="background:none; border:none; color:white; cursor:pointer; display:flex; align-items:center; opacity:0.85;">
            <span class="material-icons" style="font-size:20px;">close</span>
          </button>
        </div>

        <div id="student-archive-modal-body" style="padding:20px 24px; overflow-y:auto; flex:1;">
          <!-- รายการประวัติจะถูกเรนเดอร์ผ่าน JS -->
        </div>

        <div style="padding:14px 24px; background:#F8FAFC; border-top:1px solid #E2E8F0; display:flex; justify-content:flex-end;">
          <button class="btn btn-outline btn-sm" onclick="window.closeStudentArchiveModal ? window.closeStudentArchiveModal() : null" style="border-radius:10px; padding:7px 18px; font-weight:600;">ปิดหน้าต่าง</button>
        </div>
      </div>
    </div>

      </main>
    </div>
  </div>
`;

export default function AdminDashboardPage() {
  return (
    <PageShell
      pageKey="dashboard_รายวิชา"
      title={PAGE_TITLE}
      styles={PAGE_STYLES}
      scripts={PAGE_SCRIPTS}
      bodyHtml={PAGE_BODY_HTML}
    >
      <FloatingNotification />
    </PageShell>
  );
}
