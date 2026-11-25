"use client";

import React from "react";
import PageShell from "./PageShell";
import { ictMajorsDataScript } from "../../utils/majors";

const PAGE_TITLE = "จัดการข้อมูลและติดตามสถานะการฝึกงาน - คณะ ICT ม.พะเยา";
const PAGE_STYLES: string[] = [];
const PAGE_SCRIPTS: string[] = [
  "../components/header.js",
  "../components/text_utils.js",
  "../api/status_all_tabs.js",
  "../api/status_all.js",
  "../api/status_coop.js"
];
const PAGE_BODY_HTML = "<!-- Header -->\r\n  <div id=\"header-placeholder\"></div>\r\n\r\n  <!-- Main Content -->\r\n  <main class=\"main-content\">\r\n\r\n    <!-- แจ้งเตือนกรณีถูกดรอป / ถอนออกจากรอบฝึกงาน -->\r\n    <div id=\"dropped-student-banner\" style=\"display:none;\" class=\"mb-5 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm\">\r\n      <div class=\"flex items-start\">\r\n        <div class=\"flex-shrink-0\">\r\n          <span class=\"material-icons text-red-500 text-3xl\">warning</span>\r\n        </div>\r\n        <div class=\"ml-3 flex-1\">\r\n          <h3 class=\"text-base font-bold text-red-800\">\r\n            สถานะ: คุณถูกดรอป / ถอนออกจากรอบการฝึกงาน\r\n          </h3>\r\n          <div class=\"mt-1 text-sm text-red-700\">\r\n            <p><strong>เหตุผล:</strong> <span id=\"dropped-banner-reason\">-</span></p>\r\n            <p class=\"mt-0.5 text-xs text-gray-500\"><strong>วันที่ทำรายการ:</strong> <span id=\"dropped-banner-date\">-</span></p>\r\n          </div>\r\n          <p class=\"mt-2 text-xs text-red-600\">\r\n            * หากมีข้อสงสัยหรือต้องการยื่นคำร้องเพื่อกลับเข้าสู่กระบวนการฝึกงาน กรุณาติดต่ออาจารย์ประจำรายวิชา (Admin)\r\n          </p>\r\n        </div>\r\n      </div>\r\n    </div>\r\n\r\n    <!-- 1. ข้อมูลส่วนตัวนิสิต -->\r\n    <section class=\"card\">\r\n      <div class=\"card-header\">\r\n        <span class=\"material-icons header-icon\">how_to_reg</span>\r\n        <h2 class=\"card-title\">ข้อมูลส่วนตัวนิสิต (Student Personal Data)</h2>\r\n        <div style=\"margin-left:auto; display:flex; align-items:center; gap:6px; flex-wrap:wrap;\"><span class=\"srs-reg-lock-tag\">🔒 ข้อมูลวิชาการจาก REG ถูกล็อค</span><span class=\"srs-editable-tag\">✏️ แก้ไขข้อมูลติดต่อได้</span></div>\r\n      </div>\r\n      <div class=\"card-body\">\r\n        <div class=\"info-row\">\r\n          <!-- Photo Upload -->\r\n          <div class=\"upload-zone upload-zone--photo\" id=\"photo-dropzone\" style=\"cursor: pointer; position: relative;\">\r\n            <input type=\"file\" id=\"profile-photo-input\" accept=\"image/*\" style=\"display: none;\" />\r\n            <img id=\"profile-photo-preview\" src=\"\" alt=\"Profile Photo\" style=\"display: none; width: 100%; height: 100%; object-fit: cover; border-radius: 12px;\" />\r\n            <div id=\"photo-prompt\" style=\"display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;\">\r\n              <span class=\"material-icons\">cloud_upload</span>\r\n              <p>Drag and drop files here, or click to browse<br>JPG/PNG up to 10MB each</p>\r\n            </div>\r\n          </div>\r\n          <!-- Fields -->\r\n\r\n          <div class=\"flex-1 min-w-[280px] flex flex-col gap-5 max-[900px]:w-full max-[900px]:min-w-0\" style=\"flex: 1 1 320px;\">\r\n\r\n            <div class=\"flex flex-wrap gap-[16px_24px] max-[560px]:flex-col max-[560px]:gap-4\">\r\n                <div class=\"flex flex-col gap-[10px] min-w-[140px] max-[560px]:min-w-0 max-[560px]:w-full\" style=\"flex: 1.33 1 200px;\">\r\n                    <label class=\"text-[20px] font-semibold text-[#323639] leading-[1.35]\">ชื่อ-สกุล (ไทย)</label>\r\n                    <input class=\"input-field text-[18px] font-medium\" id=\"prof-nameTh\"/>\r\n                </div>\r\n                <div class=\"flex flex-col gap-[10px] min-w-[140px] max-[560px]:min-w-0 max-[560px]:w-full\" style=\"flex: 1 1 140px;\">\r\n                    <label class=\"text-[20px] font-semibold text-[#323639] leading-[1.35]\">รหัสนิสิต</label>\r\n                    <input class=\"input-field text-[18px] font-medium\" id=\"prof-studentCode\"/>\r\n                </div>\r\n            </div>\r\n\r\n            <div class=\"flex flex-wrap gap-[16px_24px] max-[560px]:flex-col max-[560px]:gap-4\">\r\n                <div class=\"flex flex-col gap-[10px] min-w-[140px] max-[560px]:min-w-0 max-[560px]:w-full\" style=\"flex: 1.33 1 200px;\">\r\n                    <label class=\"text-[20px] font-semibold text-[#323639] leading-[1.35]\">Name & Surname (English)</label>\r\n                    <input class=\"input-field text-[18px] font-medium\" id=\"prof-nameEn\"/>\r\n                </div>\r\n                <div class=\"flex flex-col gap-[10px] min-w-[140px] max-[560px]:min-w-0 max-[560px]:w-full\" style=\"flex: 1 1 140px;\">\r\n                    <label class=\"text-[20px] font-semibold text-[#323639] leading-[1.35]\">ชั้นปีที่</label>\r\n                    <input class=\"input-field text-[18px] font-medium\" id=\"prof-year\" readonly />\r\n                </div>\r\n            </div>\r\n\r\n            <div class=\"flex flex-wrap gap-[16px_24px] max-[560px]:flex-col max-[560px]:gap-4\">\r\n              <div class=\"flex flex-col gap-[10px] min-w-[140px] max-[560px]:min-w-0 max-[560px]:w-full\" style=\"flex: 1.33 1 200px;\">\r\n                  <label class=\"text-[20px] font-semibold text-[#323639] leading-[1.35]\">อาจารย์ที่ปรึกษา</label>\r\n                  <select class=\"input-field text-[18px] font-medium\" id=\"prof-advisor\">\r\n                    <option value=\"\">-- เลือกอาจารย์ที่ปรึกษา --</option>\r\n                  </select>\r\n              </div>\r\n              <div class=\"flex flex-col gap-[10px] min-w-[140px] max-[360px]:min-w-0 max-[560px]:w-full\" style=\"flex: 1.33 1 200px;\">\r\n                  <label class=\"text-[20px] font-semibold text-[#323639] leading-[1.35]\">สาขาวิชา</label>\r\n                  <input class=\"input-field text-[18px] font-medium\" id=\"prof-major\"/>\r\n              </div>\r\n              <div class=\"flex flex-col gap-[10px] min-w-[140px] max-[360px]:min-w-0 max-[560px]:w-full\" style=\"flex: 1 1 140px;\">\r\n                  <label class=\"text-[20px] font-semibold text-[#323639] leading-[1.35]\">เกรดเฉลี่ย</label>\r\n                  <input class=\"input-field text-[18px] font-medium\" id=\"prof-gpa\"/>                            \r\n              </div>\r\n            </div>\r\n        \r\n\r\n          <div class=\"flex flex-col gap-[10px]\">\r\n              <div class=\"flex flex-wrap gap-[16px_24px] max-[560px]:flex-col max-[560px]:gap-4\">\r\n                  <div class=\"flex flex-col gap-[10px] min-w-[140px] max-[560px]:min-w-0 max-[560px]:w-full\" style=\"flex: 1 1 160px;\">\r\n                      <label class=\"text-[20px] font-semibold text-[#323639] leading-[1.35]\">E-mail</label>\r\n                      <input class=\"input-field text-[18px] font-medium\" id=\"prof-email\"  value=\"\"/>\r\n                  </div>\r\n                  <div class=\"flex flex-col gap-[10px] min-w-[140px] max-[560px]:min-w-0 max-[560px]:w-full\" style=\"flex: 1 1 160px;\">\r\n                      <label class=\"text-[20px] font-semibold  text-[#323639] leading-[1.35]\">เบอร์โทร</label>\r\n                      <input class=\"input-field text-[18px] font-medium\" id=\"prof-phone\"  value=\"\"/>\r\n                  </div>\r\n              </div>\r\n\r\n              <div class=\"flex flex-wrap gap-[16px_24px] max-[560px]:flex-col max-[560px]:gap-4\">\r\n                  <div class=\"flex flex-col gap-[10px] min-w-[140px] max-[560px]:min-w-0 max-[560px]:w-full\" style=\"flex: 1 1 160px;\">\r\n                      <label class=\"text-[20px] font-semibold text-[#323639] leading-[1.35]\">Line ID</label>\r\n                      <input class=\"input-field text-[18px] font-medium\" id=\"prof-lineId\"  value=\"\"/>\r\n                  </div>\r\n                  <div class=\"flex flex-col gap-[10px] min-w-[140px] max-[560px]:min-w-0 max-[560px]:w-full\" style=\"flex: 1 1 160px;\">\r\n                      <label class=\"text-[20px] font-semibold text-[#323639] leading-[1.35]\">Facebook</label>\r\n                      <input class=\"input-field text-[18px] font-medium\" id=\"prof-facebook\"  value=\"\"/>\r\n                  </div>\r\n              </div>\r\n            </div>\r\n          </div>\r\n        </div>\r\n        <div class=\"table-footer\" style=\"margin-top: 24px; display: flex; justify-content: center;\">\r\n          <button type=\"button\" class=\"btn btn-primary btn-md\" id=\"save-profile-btn\">\r\n            <span class=\"material-icons\">save</span>\r\n            บันทึกข้อมูลส่วนตัว\r\n          </button>\r\n        </div>\r\n      </div>\r\n    </section>\r\n\r\n    <!-- 2. ชั่วโมงการอบรม -->\r\n    <section class=\"card\">\r\n      <div class=\"card-header\">\r\n        <span class=\"material-icons header-icon\">assignment</span>\r\n        <h2 class=\"card-title\">ชั่วโมงการอบรม</h2>\r\n        <button type=\"button\" id=\"trn-add-btn\" class=\"btn btn-md trn-add-btn\" onclick=\"openTrainingModal()\" title=\"สำหรับคอร์สออนไลน์/ภายนอก พร้อมแนบ Certificate\">\r\n          <span class=\"material-icons\">add_circle</span>\r\n          เพิ่มข้อมูล\r\n        </button>\r\n      </div>\r\n      <div class=\"card-body trn-body\">\r\n        <!-- การ์ดสรุปชั่วโมง (render โดย status_all.js จากรายการที่ \"ผ่าน\" เท่านั้น) -->\r\n        <div class=\"trn-summary\" id=\"trn-summary\"></div>\r\n\r\n        <!-- Filter bar -->\r\n        <div class=\"trn-filters\" role=\"search\">\r\n          <label class=\"trn-search\">\r\n            <span class=\"material-icons\" aria-hidden=\"true\">search</span>\r\n            <input type=\"search\" id=\"trn-search\" placeholder=\"ค้นหากิจกรรม หรือชื่อ Certificate...\" aria-label=\"ค้นหาชื่อกิจกรรม\" oninput=\"onTrainingFilterChange()\" />\r\n          </label>\r\n          <select id=\"trn-filter-type\" class=\"trn-select\" aria-label=\"ประเภท\" onchange=\"onTrainingFilterChange()\">\r\n            <option value=\"\">ประเภท: ทั้งหมด</option>\r\n            <option value=\"SOFT\">Soft skill</option>\r\n            <option value=\"HARD\">Hard skill</option>\r\n          </select>\r\n          <select id=\"trn-filter-source\" class=\"trn-select\" aria-label=\"แหล่งที่มา\" onchange=\"onTrainingFilterChange()\">\r\n            <option value=\"\">แหล่งที่มา: ทั้งหมด</option>\r\n            <option value=\"CHECKIN\">Check-in หน้างาน</option>\r\n            <option value=\"UPLOAD\">อัปโหลดเอง</option>\r\n            <option value=\"IMPORT\">นำเข้าโดยคณะ/อาจารย์</option>\r\n          </select>\r\n          <select id=\"trn-filter-status\" class=\"trn-select\" aria-label=\"สถานะ\" onchange=\"onTrainingFilterChange()\">\r\n            <option value=\"\">สถานะ: ทั้งหมด</option>\r\n            <option value=\"APPROVED\">ผ่าน</option>\r\n            <option value=\"PENDING\">รอตรวจ</option>\r\n            <option value=\"REJECTED\">ไม่ผ่าน</option>\r\n          </select>\r\n        </div>\r\n\r\n        <div class=\"trn-table-card\">\r\n          <div class=\"trn-table-wrap\">\r\n            <table class=\"trn-table\">\r\n              <thead>\r\n                <tr>\r\n                  <th class=\"trn-col-no\">ลำดับ</th>\r\n                  <th>ชื่อกิจกรรม / Certificate</th>\r\n                  <th class=\"trn-col-type\">ประเภท</th>\r\n                  <th class=\"trn-col-hours\">ชั่วโมง</th>\r\n                  <th class=\"trn-col-source\">แหล่งที่มา</th>\r\n                  <th class=\"trn-col-status\">สถานะ</th>\r\n                  <th class=\"trn-col-actions\">จัดการ</th>\r\n                </tr>\r\n              </thead>\r\n              <tbody id=\"trainings-table-body\">\r\n                <tr><td colspan=\"7\" class=\"trn-loading\">กำลังโหลดข้อมูล...</td></tr>\r\n              </tbody>\r\n            </table>\r\n          </div>\r\n          <div class=\"trn-foot\" id=\"trainings-pagination\"></div>\r\n        </div>\r\n      </div>\r\n    </section>\r\n\r\n    <!-- 3. Resume (CV) -->\r\n    <section class=\"card\">\r\n      <div class=\"card-header\">\r\n        <span class=\"material-icons header-icon\">how_to_reg</span>\r\n        <h2 class=\"card-title\">Resume (CV)</h2>\r\n        </div>\r\n      <div class=\"card-body\">\r\n        <input type=\"file\" id=\"cv-upload-input\" accept=\"image/*,.pdf\" style=\"display: none;\">\r\n\r\n        <!-- Loading State: ระหว่างรอโหลดข้อมูล CV (กันไม่ให้เห็นช่องอัปโหลดแวบก่อน) -->\r\n        <div id=\"cv-loading\" class=\"cv-loading\"><span class=\"material-icons cv-loading-icon\">autorenew</span> กำลังโหลดข้อมูล CV...</div>\r\n\r\n        <!-- Default Upload State (แสดงเมื่อยังไม่มี CV) -->\r\n        <div class=\"upload-zone upload-zone--file\" id=\"cv-upload-zone\" style=\"display: none; position: relative; padding: 20px;\">\r\n          <div id=\"cv-upload-content\" style=\"display: flex; flex-direction: column; align-items: center; justify-content: center;\">\r\n            <span class=\"material-icons\">cloud_upload</span>\r\n            <p>Drag and drop files here, or click to browse<br>PDF หรือ Image ไม่เกิน 10MB each</p>\r\n            <button type=\"button\" class=\"btn btn-tonal btn-sm\" onclick=\"document.getElementById('cv-upload-input').click(); event.stopPropagation();\">Browse Files</button>\r\n          </div>\r\n        </div>\r\n\r\n        <!-- Preview State -->\r\n        <div id=\"cv-preview-container\" style=\"display: none;\">\r\n          <!-- ซ้าย: ตัวอย่างเอกสาร / ขวา: รายละเอียดเอกสาร -->\r\n          <div class=\"cv-doc\">\r\n            <div class=\"cv-doc-preview\">\r\n              <div class=\"cv-doc-thumb\" role=\"button\" tabindex=\"0\" title=\"คลิกเพื่อดูเต็มจอ\" onclick=\"openCvModal()\" onkeydown=\"if(event.key==='Enter'||event.key===' '){event.preventDefault();openCvModal();}\">\r\n                <img id=\"cv-preview-img\" src=\"\" alt=\"ตัวอย่างหน้าเอกสาร CV\" style=\"display: none;\">\r\n                <div id=\"cv-preview-pdf\" class=\"cv-doc-pdf-fallback\" style=\"display: none;\">\r\n                  <span class=\"material-icons\">picture_as_pdf</span>\r\n                  <p>เอกสาร PDF</p>\r\n                </div>\r\n                <div class=\"cv-doc-overlay\">\r\n                  <span class=\"material-icons\">visibility</span>\r\n                  <span>คลิกเพื่อดูเต็มจอ</span>\r\n                </div>\r\n              </div>\r\n              <p class=\"cv-doc-caption\"><span class=\"material-icons\">task</span> แสดงตัวอย่างหน้าเอกสารฉบับทางการ</p>\r\n            </div>\r\n\r\n            <div class=\"cv-doc-info\">\r\n              <div class=\"cv-doc-main\">\r\n                <div class=\"cv-doc-top\">\r\n                  <span id=\"cv-status-badge\" class=\"cv-doc-badge\"></span>\r\n                  <span class=\"cv-doc-code\">รหัสเอกสาร: <span id=\"cv-doc-code\">-</span></span>\r\n                </div>\r\n\r\n                <div>\r\n                  <h3 class=\"cv-doc-title\">รายละเอียดเอกสาร</h3>\r\n                  <div class=\"cv-doc-title-bar\"></div>\r\n                </div>\r\n\r\n                <div class=\"cv-doc-meta\">\r\n                  <div class=\"cv-doc-meta-row\">\r\n                    <span class=\"cv-doc-meta-icon cv-doc-meta-icon--rose\"><span class=\"material-icons\">description</span></span>\r\n                    <div class=\"cv-doc-meta-text\">\r\n                      <span class=\"cv-doc-meta-label\">ชื่อไฟล์</span>\r\n                      <span class=\"cv-doc-meta-value\" id=\"cv-pdf-name\">-</span>\r\n                    </div>\r\n                    <span class=\"cv-doc-ext\" id=\"cv-file-ext\">PDF</span>\r\n                  </div>\r\n                  <div class=\"cv-doc-meta-row\">\r\n                    <span class=\"cv-doc-meta-icon\"><span class=\"material-icons\">storage</span></span>\r\n                    <div class=\"cv-doc-meta-text\">\r\n                      <span class=\"cv-doc-meta-label\">ขนาดไฟล์</span>\r\n                      <span class=\"cv-doc-meta-value\" id=\"cv-file-size\">-</span>\r\n                    </div>\r\n                  </div>\r\n                  <div class=\"cv-doc-meta-row\">\r\n                    <span class=\"cv-doc-meta-icon\"><span class=\"material-icons\">calendar_today</span></span>\r\n                    <div class=\"cv-doc-meta-text\">\r\n                      <span class=\"cv-doc-meta-label\">วันที่อัปโหลด</span>\r\n                      <span class=\"cv-doc-meta-value\" id=\"cv-uploaded-at\">-</span>\r\n                    </div>\r\n                  </div>\r\n                  <div class=\"cv-doc-meta-row\">\r\n                    <span class=\"cv-doc-meta-icon cv-doc-meta-icon--indigo\"><span class=\"material-icons\">contact_page</span></span>\r\n                    <div class=\"cv-doc-meta-text\">\r\n                      <span class=\"cv-doc-meta-label\">คอมเมนต์จากอาจารย์</span>\r\n                      <span class=\"cv-doc-meta-value\" id=\"cv-reviewer\">-</span>\r\n                    </div>\r\n                  </div>\r\n                </div>\r\n\r\n                <div class=\"cv-doc-note\" id=\"cv-note-box\" style=\"display: none;\">\r\n                  <span class=\"material-icons\">format_quote</span>\r\n                  <div>\r\n                    <h4 class=\"cv-doc-note-label\" id=\"cv-note-label\">คอมเมนต์จากอาจารย์ (อ่านอย่างเดียว):</h4>\r\n                    <div class=\"cv-doc-note-text\" id=\"cv-note-text\"></div>\r\n                  </div>\r\n                </div>\r\n              </div>\r\n\r\n              <div class=\"cv-doc-actions\">\r\n                <div class=\"cv-doc-actions-left\">\r\n                  <button type=\"button\" class=\"cv-btn cv-btn-primary\" onclick=\"openCvModal()\"><span class=\"material-icons\">visibility</span> ดูไฟล์ CV</button>\r\n                  <a id=\"cv-download-btn\" class=\"cv-btn cv-btn-outline\" href=\"#\" target=\"_blank\" rel=\"noopener noreferrer\" download><span class=\"material-icons\">download</span> ดาวน์โหลด</a>\r\n                </div>\r\n                <button type=\"button\" id=\"cv-change-btn\" class=\"cv-btn cv-btn-ghost\" onclick=\"document.getElementById('cv-upload-input').click();\"><span class=\"material-icons\">refresh</span> เปลี่ยนไฟล์ CV</button>\r\n              </div>\r\n            </div>\r\n          </div>\r\n        </div>\r\n      </div>\r\n    </section>\r\n\r\n    <!-- Card แสดงเงื่อนไขการปลดล็อก Checklist และสถานะการยื่น (ส่วนที่ 4 และ 5) -->\r\n    <section class=\"card\" id=\"checklist-locked-card\" style=\"display: none; border: 2px dashed #93c5fd; background-color: #f8fafc;\">\r\n      <div class=\"card-header\" style=\"background: #f1f5f9; border-bottom: 1px solid #e2e8f0;\">\r\n        <span class=\"material-icons header-icon\" style=\"color: #2563eb;\">lock</span>\r\n        <h2 class=\"card-title\" style=\"color: #334155;\">เงื่อนไขการปลดล็อก \"Checklist และสถานะการยื่น\"</h2>\r\n      </div>\r\n      <div class=\"card-body\" style=\"padding: 20px;\">\r\n        <p style=\"color: #475569; font-size: 15px; margin-bottom: 16px; font-weight: 500;\">\r\n          กรุณาทำตามขั้นตอนด้านบนให้ครบถ้วนทั้ง 2 ข้อ เพื่อปลดล็อกการทำ Checklist บริษัทและติดตามสถานะการยื่น:\r\n        </p>\r\n        <div style=\"display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px;\">\r\n          <div id=\"step-req-training\" style=\"display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 10px; background: white; border: 1px solid #e2e8f0;\">\r\n            <span class=\"material-icons\" id=\"step-req-training-icon\" style=\"color: #94a3b8; font-size: 24px;\">hourglass_empty</span>\r\n            <div>\r\n              <p style=\"font-weight: 600; font-size: 14px; margin: 0;\" id=\"step-req-training-title\">1. ชั่วโมงการอบรม</p>\r\n              <p style=\"font-size: 12px; color: #64748b; margin: 2px 0 0 0;\" id=\"step-req-training-desc\">Soft 0/12 ชม. | Hard 0/18 ชม.</p>\r\n            </div>\r\n          </div>\r\n          <div id=\"step-req-cv\" style=\"display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 10px; background: white; border: 1px solid #e2e8f0;\">\r\n            <span class=\"material-icons\" id=\"step-req-cv-icon\" style=\"color: #94a3b8; font-size: 24px;\">hourglass_empty</span>\r\n            <div>\r\n              <p style=\"font-weight: 600; font-size: 14px; margin: 0;\" id=\"step-req-cv-title\">2. กรอกใบ CV</p>\r\n              <p style=\"font-size: 12px; color: #64748b; margin: 2px 0 0 0;\" id=\"step-req-cv-desc\">ต้องอัปโหลด CV</p>\r\n            </div>\r\n          </div>\r\n        </div>\r\n      </div>\r\n    </section>\r\n\r\n    <!-- 4. สถานประกอบการ -->\r\n    <section class=\"card\" id=\"checklist-section\">\r\n      <div class=\"card-header\">\r\n        <span class=\"material-icons header-icon\">how_to_reg</span>\r\n        <h2 class=\"card-title\">สถานประกอบการ</h2>\r\n        <a href=\"/pages/checklist.html\" class=\"btn btn-md\" style=\"margin-left: auto; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; background: #16a34a; color: #ffffff; border: none; font-weight: 600;\">\r\n          <span class=\"material-icons\">add_circle</span>\r\n          เพิ่มข้อมูล\r\n        </a>\r\n      </div>\r\n      <div class=\"card-body ckl-body\">\n        <!-- การ์ด 1: คำขอปัจจุบัน -->\n        <div class=\"ckl-card\" id=\"ckl-current-card\">\n          <div class=\"ckl-loading\"><span class=\"material-icons ckl-spin\">autorenew</span> กำลังโหลดข้อมูล Checklist...</div>\n        </div>\n        <!-- การ์ด 2: ประวัติการยื่นบริษัท -->\n        <div class=\"ckl-card ckl-history\" id=\"ckl-history-card\"></div>\n      </div>\n    </section>\r\n\r\n    <!-- 5. สถานะการยื่น -->\r\n    <section class=\"card\" id=\"submission-section\">\r\n      <div class=\"card-header\">\r\n        <span class=\"material-icons header-icon\">how_to_reg</span>\r\n        <h2 class=\"card-title\">สถานะการยื่น</h2>\r\n      </div>\r\n      <div class=\"card-body sub-body\">\r\n        <!-- สรุปจำนวน 4 การ์ด -->\r\n        <div class=\"sub-stats\">\r\n          <div class=\"sub-stat\">\r\n            <div>\r\n              <p class=\"sub-stat-label\">ยื่นทั้งหมด</p>\r\n              <p class=\"sub-stat-value\"><span class=\"sub-stat-num sub-stat-num--blue\" id=\"sub-stat-total\">0</span> <span class=\"sub-stat-unit\">แห่ง</span></p>\r\n            </div>\r\n            <span class=\"sub-stat-icon sub-stat-icon--blue\"><span class=\"material-icons\">inventory_2</span></span>\r\n          </div>\r\n          <div class=\"sub-stat\">\r\n            <div>\r\n              <p class=\"sub-stat-label\">ไม่ผ่าน</p>\r\n              <p class=\"sub-stat-value\"><span class=\"sub-stat-num sub-stat-num--red\" id=\"sub-stat-failed\">0</span> <span class=\"sub-stat-unit\">แห่ง</span></p>\r\n            </div>\r\n            <span class=\"sub-stat-icon sub-stat-icon--red\"><span class=\"material-icons\">cancel</span></span>\r\n          </div>\r\n          <div class=\"sub-stat\">\r\n            <div>\r\n              <p class=\"sub-stat-label\">ผ่านแล้ว</p>\r\n              <p class=\"sub-stat-value\"><span class=\"sub-stat-num sub-stat-num--green\" id=\"sub-stat-passed\">0</span> <span class=\"sub-stat-unit\">แห่ง</span></p>\r\n            </div>\r\n            <span class=\"sub-stat-icon sub-stat-icon--green\"><span class=\"material-icons\">check_circle</span></span>\r\n          </div>\r\n          <div class=\"sub-stat\">\r\n            <div class=\"sub-stat-next\">\r\n              <p class=\"sub-stat-label\">สัมภาษณ์ครั้งถัดไป <span class=\"sub-stat-badge\" id=\"sub-stat-next-badge\" hidden></span></p>\r\n              <p class=\"sub-stat-value sub-stat-value--date\"><span class=\"sub-stat-date\" id=\"sub-stat-next-date\">—</span> <span class=\"sub-stat-time\" id=\"sub-stat-next-time\"></span></p>\r\n            </div>\r\n            <span class=\"sub-stat-icon sub-stat-icon--blue\"><span class=\"material-icons\">event</span></span>\r\n          </div>\r\n        </div>\r\n\r\n        <!-- รายการสถานประกอบการที่ยื่นสมัคร -->\r\n        <div class=\"sub-panel\">\r\n          <div class=\"sub-panel-head\">\r\n            <div>\r\n              <h3 class=\"sub-panel-title\">รายการสถานประกอบการที่ยื่นสมัคร</h3>\r\n              <p class=\"sub-panel-desc\">บริษัทที่อาจารย์อนุมัติ Checklist แล้ว ตรวจสอบและอัปเดตสถานะการสมัครฝึกงาน</p>\r\n            </div>\r\n            <span class=\"sub-panel-count\" id=\"sub-count-text\"></span>\r\n          </div>\r\n          <div class=\"sub-table-wrap\">\r\n            <table class=\"sub-table\">\r\n              <thead>\r\n                <tr>\r\n                  <th class=\"sub-col-no\">ลำดับ</th>\r\n                  <th>บริษัท</th>\r\n                  <th class=\"sub-col-status\">สถานะ</th>\r\n                  <th class=\"sub-col-date\">อัปเดตล่าสุด</th>\r\n                  <th>หมายเหตุ</th>\r\n                  <th class=\"sub-col-toggle\"></th>\r\n                </tr>\r\n              </thead>\r\n              <tbody id=\"submissions-table-body\">\r\n                <tr><td colspan=\"6\" class=\"sub-empty\">กำลังโหลดข้อมูล...</td></tr>\r\n              </tbody>\r\n            </table>\r\n          </div>\r\n          <div class=\"sub-foot\">\r\n            <span class=\"sub-foot-dot\"></span>\r\n            <span>คลิกที่ปุ่มสถานะเพื่อเปลี่ยนสถานะการสมัครของแต่ละบริษัท</span>\r\n          </div>\r\n        </div>\r\n\r\n        <!-- ประวัติที่สัมภาษณ์ไม่ผ่าน -->\r\n        <div class=\"sub-panel\" id=\"sub-failed-panel\" style=\"display: none;\">\r\n          <div class=\"sub-panel-head\">\r\n            <div class=\"sub-panel-head-left\">\r\n              <span class=\"sub-panel-icon\"><span class=\"material-icons\">report</span></span>\r\n              <div>\r\n                <h3 class=\"sub-panel-title\">ประวัติที่สัมภาษณ์ไม่ผ่าน / สิ้นสุดการสมัคร <span class=\"sub-failed-badge\" id=\"sub-failed-count\">0 รายการ</span></h3>\r\n                <p class=\"sub-panel-desc\">บริษัทที่สัมภาษณ์ไม่ผ่าน สามารถยื่นสถานประกอบการแห่งใหม่ได้ที่แท็บ Checklist บริษัท</p>\r\n              </div>\r\n            </div>\r\n            <button type=\"button\" class=\"sub-btn-soft\" onclick=\"goToChecklistTab()\"><span class=\"material-icons\">add</span> ยื่นสถานประกอบการใหม่</button>\r\n          </div>\r\n          <div class=\"sub-table-wrap\">\r\n            <table class=\"sub-table\">\r\n              <thead>\r\n                <tr>\r\n                  <th class=\"sub-col-no\">ลำดับ</th>\r\n                  <th>บริษัท</th>\r\n                  <th class=\"sub-col-status\">สถานะผลการพิจารณา</th>\r\n                  <th class=\"sub-col-date\">อัปเดตล่าสุด</th>\r\n                  <th class=\"sub-col-action\">การดำเนินการ</th>\r\n                </tr>\r\n              </thead>\r\n              <tbody id=\"sub-failed-body\"></tbody>\r\n            </table>\r\n          </div>\r\n        </div>\r\n      </div>\r\n    </section>\r\n\r\n    <!-- Card แสดงความคืบหน้า / เงื่อนไขการปลดล็อกส่วนที่ 6 -->\r\n    <section class=\"card\" id=\"placement-locked-card\" style=\"display: none; border: 2px dashed #93c5fd; background-color: #f8fafc;\">\r\n      <div class=\"card-header\" style=\"background: #f1f5f9; border-bottom: 1px solid #e2e8f0;\">\r\n        <span class=\"material-icons header-icon\" style=\"color: #2563eb;\">lock</span>\r\n        <h2 class=\"card-title\" style=\"color: #334155;\">เงื่อนไขการปลดล็อก \"ข้อมูลบริษัท ที่เข้าฝึกงาน\"</h2>\r\n      </div>\r\n      <div class=\"card-body\" style=\"padding: 20px;\">\r\n        <p style=\"color: #475569; font-size: 15px; margin-bottom: 16px; font-weight: 500;\">\r\n          กรุณาทำตามขั้นตอนด้านบนให้ครบถ้วนทั้ง 4 ข้อ เพื่อปลดล็อกแท็บกรอกข้อมูลบริษัทที่เข้าฝึกงานจริง:\r\n        </p>\r\n        <div style=\"display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px;\">\r\n          <div id=\"req-cv\" style=\"display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 10px; background: white; border: 1px solid #e2e8f0;\">\r\n            <span class=\"material-icons\" id=\"req-cv-icon\" style=\"color: #94a3b8; font-size: 24px;\">hourglass_empty</span>\r\n            <div>\r\n              <p style=\"font-weight: 600; font-size: 14px; margin: 0;\" id=\"req-cv-title\">1. กรอกใบ CV</p>\r\n              <p style=\"font-size: 12px; color: #64748b; margin: 2px 0 0 0;\" id=\"req-cv-desc\">ต้องอัปโหลด CV</p>\r\n            </div>\r\n          </div>\r\n          <div id=\"req-training\" style=\"display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 10px; background: white; border: 1px solid #e2e8f0;\">\r\n            <span class=\"material-icons\" id=\"req-training-icon\" style=\"color: #94a3b8; font-size: 24px;\">hourglass_empty</span>\r\n            <div>\r\n              <p style=\"font-weight: 600; font-size: 14px; margin: 0;\" id=\"req-training-title\">2. ชั่วโมงการอบรม</p>\r\n              <p style=\"font-size: 12px; color: #64748b; margin: 2px 0 0 0;\" id=\"req-training-desc\">Soft 0/12 ชม. | Hard 0/18 ชม.</p>\r\n            </div>\r\n          </div>\r\n          <div id=\"req-checklist\" style=\"display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 10px; background: white; border: 1px solid #e2e8f0;\">\r\n            <span class=\"material-icons\" id=\"req-checklist-icon\" style=\"color: #94a3b8; font-size: 24px;\">hourglass_empty</span>\r\n            <div>\r\n              <p style=\"font-weight: 600; font-size: 14px; margin: 0;\" id=\"req-checklist-title\">3. Checklist บริษัท</p>\r\n              <p style=\"font-size: 12px; color: #64748b; margin: 2px 0 0 0;\" id=\"req-checklist-desc\">ต้องมีบริษัทที่อาจารย์รีวิวผ่านแล้ว</p>\r\n            </div>\r\n          </div>\r\n          <div id=\"req-interview\" style=\"display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 10px; background: white; border: 1px solid #e2e8f0;\">\r\n            <span class=\"material-icons\" id=\"req-interview-icon\" style=\"color: #94a3b8; font-size: 24px;\">hourglass_empty</span>\r\n            <div>\r\n              <p style=\"font-weight: 600; font-size: 14px; margin: 0;\" id=\"req-interview-title\">4. สถานะการยื่น</p>\r\n              <p style=\"font-size: 12px; color: #64748b; margin: 2px 0 0 0;\" id=\"req-interview-desc\">ต้องมีบริษัทที่ \"สัมภาษณ์ผ่านแล้ว\"</p>\r\n            </div>\r\n          </div>\r\n        </div>\r\n      </div>\r\n    </section>\r\n\r\n    <!-- 6. ข้อมูลบริษัท ที่เข้าฝึกงาน -->\r\n    <section class=\"card\" id=\"placement-section\" style=\"display: none;\">\r\n      <div class=\"card-header\">\r\n        <span class=\"material-icons header-icon\">how_to_reg</span>\r\n        <h2 class=\"card-title\">ข้อมูลบริษัท ที่เข้าฝึกงาน</h2>\r\n      </div>\r\n      <div class=\"card-body\">\r\n        <!-- Badge แสดงสถานะการอนุมัติที่ฝึกงานจากอาจารย์ -->\r\n        <div id=\"plc-status-container\" style=\"display: none; margin-bottom: 20px; padding: 12px 18px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; align-items: center; gap: 10px;\">\r\n          <span id=\"plc-status-badge\" class=\"status-wait\" style=\"font-size: 14px; font-weight: 600; padding: 4px 12px; border-radius: 6px;\">สถานะ: ☐ รอผล</span>\r\n          <span id=\"plc-status-note\" style=\"font-size: 14px; color: #475569;\"></span>\r\n        </div>\r\n\r\n        <form id=\"placement-form\">\r\n          <div class=\"form-grid\">\r\n            <div class=\"form-group\">\r\n              <label class=\"form-label\">ตำแหน่งที่ฝึก</label>\r\n              <input type=\"text\" class=\"input-field\" id=\"plc-position\" value=\"Software Developer\" required>\r\n            </div>\r\n            <div class=\"form-group\">\r\n              <label class=\"form-label\">ชื่อแหล่งฝึกงาน</label>\r\n              <div id=\"company-field-wrapper\" style=\"position: relative; width: 100%;\">\r\n                <select class=\"input-field\" id=\"plc-company-select\" style=\"width: 100%;\">\r\n                  <option value=\"\">-- เลือกบริษัทที่สัมภาษณ์ผ่านแล้ว --</option>\r\n                  <option value=\"__other__\">อื่นๆ (กรอกระบุเอง)</option>\r\n                </select>\r\n                <div id=\"plc-custom-company-wrap\" style=\"display: none; position: relative; width: 100%;\">\r\n                  <input type=\"text\" class=\"input-field\" id=\"plc-companyNameTh\" placeholder=\"กรอกชื่อแหล่งฝึกงาน...\" style=\"width: 100%; padding-right: 125px;\">\r\n                  <button type=\"button\" id=\"btn-back-to-select\" style=\"position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 4px 10px; font-size: 12px; font-family: inherit; color: #475569; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); transition: all 0.15s ease;\" onmouseover=\"this.style.background='#f1f5f9';this.style.borderColor='#94a3b8';\" onmouseout=\"this.style.background='#ffffff';this.style.borderColor='#cbd5e1';\" title=\"กลับไปเลือกจากรายการ\">\r\n                    <span class=\"material-icons\" style=\"font-size: 14px; color: #2563eb;\">list</span> เลือกจากรายการ\r\n                  </button>\r\n                </div>\r\n              </div>\r\n            </div>\r\n            <div class=\"form-group\">\r\n              <label class=\"form-label\">ชื่อบุคคลที่ให้ทำหนังสือขอความอนุเคราะห์</label>\r\n              <input type=\"text\" class=\"input-field\" id=\"plc-contactPersonName\" placeholder=\"...\" required>\r\n            </div>\r\n            <div class=\"form-group\">\r\n              <label class=\"form-label\">ตำแหน่งบุคคลที่ให้ทำหนังสือขอความอนุเคราะห์</label>\r\n              <input type=\"text\" class=\"input-field\" id=\"plc-contactPersonPosition\" placeholder=\"...\" required>\r\n            </div>\r\n            <div class=\"form-group\">\r\n              <label class=\"form-label\">ที่อยู่บริษัท</label>\r\n              <input type=\"text\" class=\"input-field\" id=\"plc-companyAddress\" placeholder=\"...\" required>\r\n            </div>\r\n            <div class=\"form-group\">\r\n              <label class=\"form-label\">เบอร์โทรติดต่อสถานประกอบการ / แหล่งฝึก</label>\r\n              <input type=\"text\" class=\"input-field\" id=\"plc-companyPhone1\" value=\"\" required>\r\n            </div>\r\n            <div class=\"form-group\">\r\n              <label class=\"form-label\">เบอร์โทรติดต่อสถานประกอบการ / แหล่งฝึก (สำรอง)</label>\r\n              <input type=\"text\" class=\"input-field\" id=\"plc-companyPhone2\" placeholder=\"\" required>\r\n            </div>\r\n            <div class=\"form-group\">\r\n              <label class=\"form-label\">Email สถานประกอบการ / แหล่งฝึก</label>\r\n              <input type=\"email\" class=\"input-field\" id=\"plc-companyEmail\" value=\"...@gmail.com\" required>\r\n            </div>\r\n            <div class=\"form-group\">\r\n              <label class=\"form-label\">จังหวัด</label>\r\n              <select class=\"input-field\" id=\"plc-province\" required>\r\n                <option value=\"\" disabled selected>-- เลือกจังหวัด --</option>\r\n                <option value=\"กรุงเทพมหานคร\">กรุงเทพมหานคร</option>\r\n                <option value=\"กระบี่\">กระบี่</option>\r\n                <option value=\"กาญจนบุรี\">กาญจนบุรี</option>\r\n                <option value=\"กาฬสินธุ์\">กาฬสินธุ์</option>\r\n                <option value=\"กำแพงเพชร\">กำแพงเพชร</option>\r\n                <option value=\"ขอนแก่น\">ขอนแก่น</option>\r\n                <option value=\"จันทบุรี\">จันทบุรี</option>\r\n                <option value=\"ฉะเชิงเทรา\">ฉะเชิงเทรา</option>\r\n                <option value=\"ชลบุรี\">ชลบุรี</option>\r\n                <option value=\"ชัยนาท\">ชัยนาท</option>\r\n                <option value=\"ชัยภูมิ\">ชัยภูมิ</option>\r\n                <option value=\"ชุมพร\">ชุมพร</option>\r\n                <option value=\"เชียงราย\">เชียงราย</option>\r\n                <option value=\"เชียงใหม่\">เชียงใหม่</option>\r\n                <option value=\"ตรัง\">ตรัง</option>\r\n                <option value=\"ตราด\">ตราด</option>\r\n                <option value=\"ตาก\">ตาก</option>\r\n                <option value=\"นครนายก\">นครนายก</option>\r\n                <option value=\"นครปฐม\">นครปฐม</option>\r\n                <option value=\"นครพนม\">นครพนม</option>\r\n                <option value=\"นครราชสีมา\">นครราชสีมา</option>\r\n                <option value=\"นครศรีธรรมราช\">นครศรีธรรมราช</option>\r\n                <option value=\"นครสวรรค์\">นครสวรรค์</option>\r\n                <option value=\"นนทบุรี\">นนทบุรี</option>\r\n                <option value=\"นราธิวาส\">นราธิวาส</option>\r\n                <option value=\"น่าน\">น่าน</option>\r\n                <option value=\"บึงกาฬ\">บึงกาฬ</option>\r\n                <option value=\"บุรีรัมย์\">บุรีรัมย์</option>\r\n                <option value=\"ปทุมธานี\">ปทุมธานี</option>\r\n                <option value=\"ประจวบคีรีขันธ์\">ประจวบคีรีขันธ์</option>\r\n                <option value=\"ปราจีนบุรี\">ปราจีนบุรี</option>\r\n                <option value=\"ปัตตานี\">ปัตตานี</option>\r\n                <option value=\"พะเยา\">พะเยา</option>\r\n                <option value=\"พระนครศรีอยุธยา\">พระนครศรีอยุธยา</option>\r\n                <option value=\"พังงา\">พังงา</option>\r\n                <option value=\"พัทลุง\">พัทลุง</option>\r\n                <option value=\"พิจิตร\">พิจิตร</option>\r\n                <option value=\"พิษณุโลก\">พิษณุโลก</option>\r\n                <option value=\"เพชรบุรี\">เพชรบุรี</option>\r\n                <option value=\"เพชรบูรณ์\">เพชรบูรณ์</option>\r\n                <option value=\"แพร่\">แพร่</option>\r\n                <option value=\"ภูเก็ต\">ภูเก็ต</option>\r\n                <option value=\"มหาสารคาม\">มหาสารคาม</option>\r\n                <option value=\"มุกดาหาร\">มุกดาหาร</option>\r\n                <option value=\"แม่ฮ่องสอน\">แม่ฮ่องสอน</option>\r\n                <option value=\"ยโสธร\">ยโสธร</option>\r\n                <option value=\"ยะลา\">ยะลา</option>\r\n                <option value=\"ร้อยเอ็ด\">ร้อยเอ็ด</option>\r\n                <option value=\"ระนอง\">ระนอง</option>\r\n                <option value=\"ระยอง\">ระยอง</option>\r\n                <option value=\"ราชบุรี\">ราชบุรี</option>\r\n                <option value=\"ลพบุรี\">ลพบุรี</option>\r\n                <option value=\"ลำปาง\">ลำปาง</option>\r\n                <option value=\"ลำพูน\">ลำพูน</option>\r\n                <option value=\"เลย\">เลย</option>\r\n                <option value=\"ศรีสะเกษ\">ศรีสะเกษ</option>\r\n                <option value=\"สกลนคร\">สกลนคร</option>\r\n                <option value=\"สงขลา\">สงขลา</option>\r\n                <option value=\"สตูล\">สตูล</option>\r\n                <option value=\"สมุทรปราการ\">สมุทรปราการ</option>\r\n                <option value=\"สมุทรสงคราม\">สมุทรสงคราม</option>\r\n                <option value=\"สมุทรสาคร\">สมุทรสาคร</option>\r\n                <option value=\"สระแก้ว\">สระแก้ว</option>\r\n                <option value=\"สระบุรี\">สระบุรี</option>\r\n                <option value=\"สิงห์บุรี\">สิงห์บุรี</option>\r\n                <option value=\"สุโขทัย\">สุโขทัย</option>\r\n                <option value=\"สุพรรณบุรี\">สุพรรณบุรี</option>\r\n                <option value=\"สุราษฎร์ธานี\">สุราษฎร์ธานี</option>\r\n                <option value=\"สุรินทร์\">สุรินทร์</option>\r\n                <option value=\"หนองคาย\">หนองคาย</option>\r\n                <option value=\"หนองบัวลำภู\">หนองบัวลำภู</option>\r\n                <option value=\"อ่างทอง\">อ่างทอง</option>\r\n                <option value=\"อำนาจเจริญ\">อำนาจเจริญ</option>\r\n                <option value=\"อุดรธานี\">อุดรธานี</option>\r\n                <option value=\"อุตรดิตถ์\">อุตรดิตถ์</option>\r\n                <option value=\"อุทัยธานี\">อุทัยธานี</option>\r\n                <option value=\"อุบลราชธานี\">อุบลราชธานี</option>\r\n              </select>\r\n            </div>\r\n          </div>\r\n\r\n          <div class=\"btn-submit-wrap\">\r\n            <button type=\"submit\" class=\"btn btn-primary btn-lg\">ยืนยันและบันทึก</button>\r\n          </div>\r\n        </form>\r\n      </div>\r\n    </section>\r\n\r\n  </main>\r\n\r\n  <!-- CV Modal -->\r\n  <div id=\"cv-modal\" style=\"display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1000; justify-content: center; align-items: center; cursor: zoom-out; backdrop-filter: blur(2px);\" onclick=\"closeCvModal()\">\r\n    <div style=\"position: relative; width: 90%; height: 90%; display: flex; justify-content: center; align-items: center; cursor: default;\" onclick=\"event.stopPropagation();\">\r\n      <img id=\"cv-modal-img\" src=\"\" alt=\"Full CV\" style=\"display: none; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); background-color: white;\">\r\n      <iframe id=\"cv-modal-pdf\" src=\"\" style=\"display: none; width: 100%; height: 100%; border: none; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); background-color: white;\"></iframe>\r\n      <a id=\"cv-modal-open\" href=\"#\" target=\"_blank\" rel=\"noopener noreferrer\" title=\"เปิดไฟล์ต้นฉบับในแท็บใหม่\" style=\"position: absolute; top: -40px; right: 44px; color: white; display: inline-flex; align-items: center;\"><span class=\"material-icons\" style=\"font-size: 28px;\">open_in_new</span></a>\r\n      <button onclick=\"closeCvModal()\" style=\"position: absolute; top: -40px; right: 0; background: none; border: none; color: white; cursor: pointer;\">\r\n        <span class=\"material-icons\" style=\"font-size: 32px;\">close</span>\r\n      </button>\r\n    </div>\r\n  </div>";

const STUDENT_PROFILE_CONTENT_HTML = `
<div class="student-profile-layout">
  <div class="student-profile-top-grid">
    <section class="student-profile-card student-profile-photo-card">
      <h3 class="student-profile-card-title"><span class="material-icons">person</span> รูปประจำตัว <span class="student-profile-photo-size">ขนาด 1.5 - 2 นิ้ว</span></h3>
      <div class="student-profile-photo-area">
        <div class="upload-zone upload-zone--photo" id="photo-dropzone">
          <input type="file" id="profile-photo-input" accept="image/jpeg,image/png" hidden />
          <img id="profile-photo-preview" src="" alt="รูปประจำตัวนิสิต" />
          <div id="photo-prompt">
            <span class="material-icons">cloud_upload</span>
            <p>ลากและวางไฟล์ภาพที่นี่<br />JPG/PNG ไม่เกิน 10MB</p>
            <button type="button" class="btn btn-tonal btn-sm">เลือกไฟล์ภาพ</button>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm student-profile-upload-button" onclick="document.getElementById('profile-photo-input').click()">
          <span class="material-icons">upload</span> อัปโหลดรูปประจำตัว
        </button>
        <p class="student-profile-hint">แต่งกายด้วยชุดนิสิตถูกระเบียบ<br />เข้าโหลดรูปได้ที่ <a href="https://reg.up.ac.th/" target="_blank" rel="noopener noreferrer">reg.up.ac.th</a></p>
      </div>
    </section>

    <section class="student-profile-card">
      <h3 class="student-profile-card-title"><span class="material-icons">school</span> ข้อมูลการศึกษา / ทะเบียนประวัติ</h3>
      <div class="student-profile-fields student-profile-education-fields">
        <div class="student-profile-field">
          <label for="prof-nameTh">ชื่อ-สกุล (ไทย) <span class="student-profile-reg-badge">🔒 REG</span></label>
          <input class="input-field" id="prof-nameTh" readonly />
        </div>
        <div class="student-profile-field">
          <label for="prof-nameEn">Name &amp; Surname (English) <span class="student-profile-reg-badge">🔒 REG</span></label>
          <input class="input-field" id="prof-nameEn" readonly />
        </div>
        <div class="student-profile-field">
          <label for="prof-studentCode">รหัสนิสิต <span class="student-profile-reg-badge">🔒 REG</span></label>
          <input class="input-field" id="prof-studentCode" readonly />
        </div>
        <div class="student-profile-field">
          <label for="prof-major">สาขา <span class="student-profile-reg-badge">🔒 REG</span></label>
          <input class="input-field" id="prof-major" readonly />
        </div>
        <div class="student-profile-field">
          <label for="prof-curriculum">หลักสูตร <span class="student-profile-reg-badge">🔒 REG</span></label>
          <input class="input-field" id="prof-curriculum" readonly />
        </div>
        <div class="student-profile-field">
          <label for="prof-faculty">คณะ <span class="student-profile-reg-badge">🔒 REG</span></label>
          <input class="input-field" id="prof-faculty" readonly />
        </div>
        <div class="student-profile-field student-profile-field-full">
          <label for="prof-email">Email (@up.ac.th) <span class="student-profile-reg-badge">🔒 REG</span></label>
          <input class="input-field" id="prof-email" value="" readonly />
        </div>
        <div class="student-profile-field">
          <label for="prof-year">ชั้นปี <span class="student-profile-reg-badge">🔒 REG</span></label>
          <input class="input-field" id="prof-year" inputmode="numeric" placeholder="ยังไม่มีข้อมูลจาก REG" readonly />
        </div>
        <div class="student-profile-field">
          <label for="prof-gpa">เกรดเฉลี่ยสะสม (GPAX) <span class="student-profile-reg-badge">🔒 REG</span></label>
          <input class="input-field" id="prof-gpa" inputmode="decimal" placeholder="ยังไม่มีข้อมูลจาก REG" readonly />
        </div>
      </div>
    </section>
  </div>

  <div class="student-profile-middle-grid">
    <section class="student-profile-card">
      <h3 class="student-profile-card-title"><span class="material-icons">person_outline</span> ข้อมูลส่วนบุคคลและการศึกษา</h3>
      <div class="student-profile-fields">
        <div class="student-profile-field">
          <label for="prof-advisor">อาจารย์ที่ปรึกษา</label>
          <select class="input-field" id="prof-advisor">
            <option value="">-- เลือกอาจารย์ที่ปรึกษา --</option>
          </select>
        </div>
        <div class="student-profile-field">
          <label for="prof-phone">เบอร์โทรศัพท์ติดต่อ <span class="student-profile-required">*</span></label>
          <input class="input-field" id="prof-phone" type="tel" inputmode="numeric" pattern="[0-9]{9,10}" maxlength="10" title="กรุณากรอกเบอร์โทรศัพท์เป็นตัวเลข 9-10 หลัก" required value="" />
        </div>
        <div class="student-profile-field">
          <label for="prof-internship-start">วันที่เริ่มฝึกงาน <span class="student-profile-reg-badge" title="เจ้าหน้าที่กำหนดตามรอบออกฝึก">🔒 ตามรอบ</span></label>
          <input class="input-field" id="prof-internship-start" value="" placeholder="เจ้าหน้าที่ยังไม่กำหนด" readonly />
        </div>
        <div class="student-profile-field">
          <label for="prof-internship-end">วันที่สิ้นสุดฝึกงาน <span class="student-profile-reg-badge" title="เจ้าหน้าที่กำหนดตามรอบออกฝึก">🔒 ตามรอบ</span></label>
          <input class="input-field" id="prof-internship-end" value="" placeholder="เจ้าหน้าที่ยังไม่กำหนด" readonly />
        </div>
      </div>
    </section>

    <section class="student-profile-card">
      <h3 class="student-profile-card-title"><span class="material-icons">link</span> ข้อมูลการติดต่อและโซเชียลมีเดีย</h3>
      <div class="student-profile-fields student-profile-contact-fields">
        <div class="student-profile-field">
          <label for="prof-lineId">Internship Email (gmail.com) <span class="student-profile-required">*</span></label>
          <input class="input-field" id="prof-lineId" type="email" pattern="[^@\\s]+@gmail\\.com" title="กรุณากรอกอีเมลที่ลงท้ายด้วย @gmail.com" required value="" placeholder="name@gmail.com" />
        </div>
        <div class="student-profile-field">
          <label for="prof-facebook">Github</label>
          <input class="input-field" id="prof-facebook" type="text" value="" placeholder="Github" />
        </div>
      </div>
    </section>
  </div>

  <section class="student-profile-card student-profile-other-card">
    <h3 class="student-profile-card-title"><span class="material-icons">description</span> ข้อมูลผลงาน</h3>
    <div class="student-profile-field">
      <label for="prof-other">ข้อมูลเพิ่มเติม</label>
      <textarea class="input-field student-profile-textarea" id="prof-other" maxlength="2000" placeholder="ข้อมูลเพิ่มเติม เช่น ความสามารถพิเศษ โรคประจำตัว หรือข้อจำกัด"></textarea>
      <p class="student-profile-hint">ระบุข้อมูลเพิ่มเติมที่เป็นประโยชน์ต่อการฝึกงาน เช่น ความสามารถพิเศษ ความสนใจ หรือข้อมูลที่ควรแจ้งอาจารย์</p>
      <!-- ลิงก์ที่อยู่ในข้อความ (textarea กดลิงก์ไม่ได้ → แสดงเป็นลิงก์ใต้ช่อง) เติมโดย status_all.js -->
      <div class="student-profile-links" id="prof-other-links" hidden></div>
    </div>
  </section>

  <div class="student-profile-actions">
    <button type="button" class="btn btn-primary btn-md" id="save-profile-btn">
      <span class="material-icons">save</span> บันทึกข้อมูลส่วนตัว
    </button>
  </div>
</div>`;

const STUDENT_PROFILE_PAGE_BODY_HTML = (() => {
  const photoInputIndex = PAGE_BODY_HTML.indexOf('id="profile-photo-input"');
  const contentStart = PAGE_BODY_HTML.lastIndexOf('<div class="info-row">', photoInputIndex);
  const contentEnd = PAGE_BODY_HTML.indexOf('\r\n      </div>\r\n    </section>', contentStart);

  if (photoInputIndex < 0 || contentStart < 0 || contentEnd < 0) {
    throw new Error("Unable to locate the student profile content in StatusAllPage.");
  }

  return `${PAGE_BODY_HTML.slice(0, contentStart)}${STUDENT_PROFILE_CONTENT_HTML}${PAGE_BODY_HTML.slice(contentEnd)}`;
})();

// ---------------------------------------------------------------------------
// Sidebar หมวดหมู่ (ฝั่งนิสิต) — สถานะเมนู/badge ถูกอัปเดตโดย status_all_tabs.js
// ---------------------------------------------------------------------------
function navButton(tab: string, icon: string, label: string, extraAttrs = ""): string {
  return `
          <button type="button" class="status-nav-item" data-tab="${tab}" aria-current="false"${extraAttrs}>
            <span class="material-icons status-nav-icon" aria-hidden="true">${icon}</span>
            <span class="status-nav-text">
              <span class="status-nav-label">${label}</span>
              <span class="status-nav-reason" data-nav-reason="${tab}"></span>
            </span>
            <span class="status-nav-badge" data-nav-badge="${tab}">…</span>
          </button>`;
}

const STATUS_ALL_SIDEBAR_HTML = `
      <aside class="status-all-sidebar" aria-label="เมนูหมวดหมู่ข้อมูลนิสิต">
        <div class="status-brand">
          <div class="status-brand-mark" aria-hidden="true"><span class="material-icons">school</span></div>
          <div class="status-brand-text">
            <div class="status-brand-title">ระบบเตรียมฝึกงาน</div>
            <div class="status-brand-subtitle">Student · ICT UP</div>
          </div>
        </div>
        <div class="status-nav-heading">หมวดหมู่</div>
        <nav class="status-nav" id="status-all-nav" aria-label="หมวดข้อมูลการฝึกงาน">
          ${navButton("personal", "how_to_reg", "ข้อมูลส่วนตัวนิสิต")}
          ${navButton("training", "school", "ชั่วโมงการอบรม")}
          ${navButton("cv", "description", "Resume (CV)")}
          ${navButton("checklist-locked", "lock", "สถานประกอบการ และสถานะการยื่น", ' data-stage="1" data-locked="true"')}
          ${navButton("checklist", "fact_check", "สถานประกอบการ", ' data-stage="2" hidden')}
          ${navButton("submission", "send", "สถานะการยื่น", ' data-stage="2" hidden')}
          ${navButton("coop", "handshake", "สหกิจศึกษา")}
        </nav>
        <div class="status-sidebar-note">
          <strong>ข้อมูลการฝึกงานของนิสิต</strong>
          กรอกข้อมูลให้ครบทีละหมวด เมนูถัดไปจะปลดล็อกอัตโนมัติเมื่อผ่านเงื่อนไข
        </div>
      </aside>`;

// ---------------------------------------------------------------------------
// แท็บ "สหกิจศึกษา": ตารางประกาศรับนิสิต (ดูได้ทุกคน) — เติมข้อมูลโดย status_coop.js
// การสมัคร (เลือกบริษัท/ตำแหน่ง + อัปโหลดเอกสาร) อยู่ Phase 2
// ---------------------------------------------------------------------------
const COOP_PANEL_HTML = `
        <section class="card" id="coop-section">
          <div class="card-header">
            <span class="material-icons header-icon">handshake</span>
            <h2 class="card-title">สหกิจศึกษา — ประกาศรับนิสิต</h2>
          </div>
          <div class="card-body">
            <div style="display:flex; gap:10px; align-items:flex-start; padding:12px 14px; background:#EEF2FF; border:1px solid #C7D2FE; border-radius:12px; font-size:13px; color:#1E1B4B; line-height:1.6; margin-bottom:14px;">
              <span class="material-icons" style="color:#4338CA; font-size:20px;">info</span>
              <div>
                <strong>ดูประกาศได้ทุกคน</strong> · การสมัคร (เลือกบริษัท ตำแหน่ง และแนบ Resume / Transcript / Portfolio)
                ทำได้เมื่อผ่านการเตรียมความพร้อม (Resume + ชั่วโมงอบรมครบ) และสาขาของคุณเปิดรอบออกฝึกแล้ว<br />
                นิสิตเลือกได้ทางเดียว คือ <strong>ฝึกงาน</strong> (เลือกสถานประกอบการเอง) หรือ <strong>สหกิจศึกษา</strong> (สมัครตามประกาศนี้ · คณะดำเนินการเอกสารให้) · สมัครได้ทีละ 1 ที่
              </div>
            </div>
            <div id="coop-student-round" style="display:flex; gap:8px; align-items:flex-start; padding:10px 14px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; font-size:12.5px; color:#334155; line-height:1.6; margin-bottom:12px;"></div>
            <!-- ใบสมัครของนิสิต: ฟอร์มสมัคร / เหตุผลที่ยังสมัครไม่ได้ / สถานะใบสมัคร + ประวัติ (เติมโดย status_coop.js) -->
            <div id="coop-student-apply" style="margin-bottom:16px;"></div>
            <div style="font-size:14px; font-weight:800; color:#1E293B; margin:4px 0 8px;">ประกาศรับนิสิตสหกิจ</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:10px;">
              <input type="search" id="coop-student-search" class="input-field" placeholder="ค้นหาบริษัท ตำแหน่ง หรือจังหวัด..." aria-label="ค้นหาประกาศสหกิจ" style="flex:1 1 220px; margin:0; font-size:13px;" />
              <label style="display:inline-flex; align-items:center; gap:6px; font-size:12.5px; color:#334155; cursor:pointer;">
                <input type="checkbox" id="coop-student-only-open" checked style="width:16px; height:16px; accent-color:#4338CA;" />
                เฉพาะที่เปิดรับสมัคร
              </label>
            </div>
            <div id="coop-student-summary" style="font-size:12px; color:#64748B; margin-bottom:8px;"></div>
            <div style="overflow-x:auto;">
              <table class="data-table" style="min-width:600px;">
                <thead>
                  <tr>
                    <th style="width:34%;">บริษัท</th>
                    <th style="width:28%;">ตำแหน่ง</th>
                    <th style="width:10%;" class="text-center">รับ (คน)</th>
                    <th style="width:14%;">จังหวัด</th>
                    <th style="width:14%;" class="text-center">รายละเอียด / สมัคร</th>
                  </tr>
                </thead>
                <tbody id="coop-student-tbody">
                  <tr><td colspan="5" class="text-center" style="padding:18px; color:#94A3B8;">กำลังโหลดประกาศ...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
        <div id="coop-detail-modal" role="dialog" aria-modal="true" aria-labelledby="coop-detail-title" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:1000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
          <div style="background:#FFFFFF; border-radius:20px; padding:22px 24px; width:620px; max-width:94%; max-height:88vh; overflow-y:auto; box-shadow:0 20px 50px rgba(15,23,42,0.25);">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px;">
              <div style="min-width:0;">
                <h3 id="coop-detail-title" style="font-size:17px; font-weight:800; margin:0; color:#1E1B4B;"></h3>
                <div id="coop-detail-subtitle" style="font-size:12.5px; color:#64748B; margin-top:2px;"></div>
              </div>
              <button type="button" id="coop-detail-close" aria-label="ปิดหน้าต่าง" style="background:none; border:none; color:#64748B; cursor:pointer; display:flex; align-items:center;">
                <span class="material-icons" style="font-size:22px;">close</span>
              </button>
            </div>
            <div id="coop-detail-body" style="margin-top:12px;"></div>
          </div>
        </div>`;

// panel ที่แต่ละ <section class="card"> ระดับบนสุดอยู่ (เรียงตามลำดับในหน้า)
const STATUS_ALL_SECTION_TABS = [
  "personal",
  "training",
  "cv",
  "checklist-locked", // #checklist-locked-card
  "checklist", // #checklist-section
  "submission", // #submission-section
  "placement", // #placement-locked-card (เลิกใช้: ข้อมูลบริษัทอยู่ใน Checklist แล้ว — ตัดออกจากหน้า)
  "placement", // #placement-section (เลิกใช้)
];
// panel ที่ไม่แสดงในหน้าแล้ว (ตัด HTML ออกตอนประกอบหน้า)
const REMOVED_PANEL_TABS = new Set(["placement"]);

const STATUS_ALL_PAGE_BODY_HTML = (() => {
  const html = STUDENT_PROFILE_PAGE_BODY_HTML;
  const starts = [...html.matchAll(/<section class="card"/g)].map((m) => m.index as number);
  const mainEnd = html.lastIndexOf("</main>");
  const mainStart = html.indexOf("<main ");

  if (starts.length !== STATUS_ALL_SECTION_TABS.length || mainEnd < 0 || mainStart < 0 || mainStart > starts[0]) {
    throw new Error("Unable to locate the status-all sections for the sidebar layout.");
  }

  let panels = "";
  let i = 0;
  while (i < starts.length) {
    const tab = STATUS_ALL_SECTION_TABS[i];
    let j = i;
    while (j + 1 < starts.length && STATUS_ALL_SECTION_TABS[j + 1] === tab) j++;
    const end = j + 1 < starts.length ? starts[j + 1] : mainEnd;
    if (REMOVED_PANEL_TABS.has(tab)) {
      i = j + 1;
      continue;
    }
    const active = tab === "personal" ? " is-active" : "";
    panels += `
        <div class="status-all-panel${active}" data-panel="${tab}">
        ${html.slice(starts[i], end).trimEnd()}
        </div>`;
    i = j + 1;
  }
  panels += `
        <div class="status-all-panel" data-panel="coop">${COOP_PANEL_HTML}
        </div>`;

  // โครงแบบเดียวกับ admin-dashboard: sidebar เต็มความสูงชิดซ้าย + <main> อยู่ด้านขวา
  const mainOpenEnd = html.indexOf(">", mainStart) + 1;
  const mainOpenTag = html.slice(mainStart, mainOpenEnd).replace('class="', 'class="status-all-main ');
  return `${ictMajorsDataScript()}${html.slice(0, mainStart)}<div class="status-all-shell">${STATUS_ALL_SIDEBAR_HTML}
    ${mainOpenTag}${html.slice(mainOpenEnd, starts[0])}
      <div class="status-all-panels">${panels}
      </div>
  ${html.slice(mainEnd, mainEnd + "</main>".length)}
  </div>${html.slice(mainEnd + "</main>".length)}`;
})();

export default function StatusAllPage() {
  return (
    <PageShell
      pageKey="status_all"
      title={PAGE_TITLE}
      styles={PAGE_STYLES}
      scripts={PAGE_SCRIPTS}
      bodyHtml={STATUS_ALL_PAGE_BODY_HTML}
    />
  );
}
