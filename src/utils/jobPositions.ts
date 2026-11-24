// =====================================================================
// ตำแหน่งงานมาตรฐาน จัดกลุ่มตามสายงานของ 8 สาขา (ที่เดียวในระบบ — ห้าม hardcode ซ้ำ)
// keywords = คำค้นภาษาไทย/คำพ้อง เพื่อให้พิมพ์ค้นหาได้ง่าย
// ใช้ใน: ช่องตำแหน่งของการเลือกสถานประกอบการ (checklist.js) และฟอร์มประกาศสหกิจ (admin_coop_postings.js)
// client script อ่านผ่าน <script id="job-positions-data"> (ดู jobPositionsDataScript)
// =====================================================================
export interface JobPositionGroup {
  label: string;
  items: { name: string; keywords?: string }[];
}

export const JOB_POSITION_GROUPS: JobPositionGroup[] = [
  {
    label: "พัฒนาซอฟต์แวร์ (SE / CS / IT)",
    items: [
      { name: "Full-Stack Developer", keywords: "ฟูลสแต็ก โปรแกรมเมอร์ เว็บ web" },
      { name: "Frontend Developer", keywords: "ฟรอนต์เอนด์ หน้าบ้าน เว็บ web react vue" },
      { name: "Backend Developer", keywords: "แบ็กเอนด์ หลังบ้าน api server" },
      { name: "Mobile App Developer (iOS / Android / Flutter)", keywords: "โมบาย แอป มือถือ app" },
      { name: "Software Engineer / Developer", keywords: "วิศวกรซอฟต์แวร์ นักพัฒนา โปรแกรมเมอร์ programmer software developer" },
      { name: "DevOps / Cloud Engineer", keywords: "คลาวด์ aws azure gcp" },
      { name: "QA / Software Tester", keywords: "ทดสอบ เทสเตอร์ test" },
      { name: "System Analyst / Business Analyst", keywords: "นักวิเคราะห์ระบบ วิเคราะห์ระบบ sa ba" },
    ],
  },
  {
    label: "AI / ข้อมูล / ฐานข้อมูล (CS / DSA / IT)",
    items: [
      { name: "AI / Machine Learning Engineer", keywords: "ปัญญาประดิษฐ์ เอไอ ml" },
      { name: "Data Scientist", keywords: "นักวิทยาศาสตร์ข้อมูล ข้อมูล" },
      { name: "Data Analyst", keywords: "นักวิเคราะห์ข้อมูล ข้อมูล" },
      { name: "Data Engineer", keywords: "วิศวกรข้อมูล ข้อมูล" },
      { name: "Business Intelligence (BI) Analyst", keywords: "บีไอ ข้อมูล dashboard" },
      { name: "Database Administrator (DBA)", keywords: "ฐานข้อมูล ดาต้าเบส sql" },
    ],
  },
  {
    label: "เครือข่าย / ความปลอดภัย / ฮาร์ดแวร์ (IT / CPE)",
    items: [
      { name: "Network & Security Engineer", keywords: "เครือข่าย เน็ตเวิร์ก ความปลอดภัย" },
      { name: "Cybersecurity Specialist", keywords: "ไซเบอร์ ความปลอดภัย security" },
      { name: "System Administrator / IT Support", keywords: "ไอทีซัพพอร์ต ดูแลระบบ แอดมิน helpdesk" },
      { name: "Embedded Systems / IoT Developer", keywords: "ไอโอที สมองกลฝังตัว iot" },
      { name: "Hardware & Computer Engineer", keywords: "ฮาร์ดแวร์ วิศวกรคอมพิวเตอร์" },
    ],
  },
  {
    label: "กราฟิก / มัลติมีเดีย / เกม (CGM)",
    items: [
      { name: "UI/UX Designer / Product Designer", keywords: "ออกแบบ ดีไซน์ ux ui ดีไซเนอร์" },
      { name: "Graphic Designer / 2D Artist", keywords: "กราฟิก ออกแบบ ดีไซน์" },
      { name: "3D Modeler / 3D Animator", keywords: "สามมิติ แอนิเมชัน 3d" },
      { name: "Game Developer / Game Programmer", keywords: "เกม game unity unreal" },
      { name: "Video Editor / Motion Graphics", keywords: "ตัดต่อ วิดีโอ โมชัน" },
    ],
  },
  {
    label: "ภูมิสารสนเทศ (GIS)",
    items: [
      { name: "GIS Specialist / GIS Developer", keywords: "ภูมิสารสนเทศ แผนที่ gis" },
      { name: "Spatial Data Analyst", keywords: "ข้อมูลเชิงพื้นที่ ภูมิสารสนเทศ" },
      { name: "Remote Sensing Specialist", keywords: "รีโมทเซนซิง ภาพถ่ายดาวเทียม" },
      { name: "เจ้าหน้าที่สารสนเทศภูมิศาสตร์", keywords: "gis ภูมิศาสตร์" },
    ],
  },
  {
    label: "ธุรกิจดิจิทัล (DB)",
    items: [
      { name: "Digital Marketing Specialist", keywords: "การตลาดดิจิทัล การตลาด marketing" },
      { name: "E-Commerce Specialist", keywords: "อีคอมเมิร์ซ ขายออนไลน์" },
      { name: "ERP / CRM Consultant (SAP, Odoo)", keywords: "อีอาร์พี ที่ปรึกษา sap odoo" },
      { name: "Digital Business Coordinator", keywords: "ธุรกิจดิจิทัล ประสานงาน" },
    ],
  },
];

/** ข้อมูลตำแหน่งแบบ JSON ให้ client script อ่าน (type="application/json" ไม่ถูก execute) */
export function jobPositionsDataScript(): string {
  return `<script type="application/json" id="job-positions-data">${JSON.stringify(JOB_POSITION_GROUPS)}</script>`;
}
