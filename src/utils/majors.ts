// =====================================================================
// รายชื่อหลักสูตร/สาขาวิชาของคณะ ICT ม.พะเยา (แหล่งข้อมูลกลางที่เดียว)
// - ฝั่ง Server / หน้า TSX import ไฟล์นี้ได้โดยตรง
// - ฝั่ง client script (src/client/*) ถูก compile แยกไฟล์ import ไม่ได้
//   จึงอ่านจาก <script type="application/json" id="ict-majors-data"> ที่หน้าเพจฝังไว้ (ดู ictMajorsDataScript)
// - ค่าที่เก็บใน DB (Student.major, Staff.department, majorName ใน state) = name (ชื่อสาขาแบบสั้น)
//   ส่วนการแสดงผลใช้ fullName เช่น "หลักสูตรวิศวกรรมศาสตรบัณฑิต สาขาวิชาวิศวกรรมซอฟต์แวร์"
// =====================================================================

export interface IctDegree {
  code: string; // บธ.บ. / วศ.บ. / วท.บ. / ศป.บ.
  name: string; // เช่น "หลักสูตรวิศวกรรมศาสตรบัณฑิต"
}

export interface IctMajor {
  code: string;
  name: string;       // ชื่อมาตรฐานที่ใช้เก็บใน DB เช่น "วิศวกรรมซอฟต์แวร์"
  fullName: string;   // ชื่อเต็มสำหรับแสดงผล "หลักสูตร... สาขาวิชา..."
  degreeCode: string; // หลักสูตรที่สังกัด (ดู ICT_DEGREES)
  keywords: string[]; // คำที่ใช้จับคู่ค่าดิบ เช่น "221 วิศวกรรมซอฟต์แวร์", "สาขาวิชาภูมิสารสนเทศ"
  prepSchedule: string;   // ช่วงเรียนเตรียมความพร้อม (ตามหลักสูตร)
  internSchedule: string; // ช่วงออกฝึกงาน (ตามหลักสูตร)
}

// หลักสูตร (ระดับปริญญา) → ใช้กับหน้าที่แสดง หลักสูตร → สาขา แยกกัน
export const ICT_DEGREES: IctDegree[] = [
  { code: "บธ.บ.", name: "หลักสูตรบริหารธุรกิจบัณฑิต" },
  { code: "วศ.บ.", name: "หลักสูตรวิศวกรรมศาสตรบัณฑิต" },
  { code: "วท.บ.", name: "หลักสูตรวิทยาศาสตรบัณฑิต" },
  { code: "ศป.บ.", name: "หลักสูตรศิลปกรรมศาสตรบัณฑิต" },
];

function major(
  code: string,
  degreeCode: string,
  name: string,
  keywords: string[],
  prepSchedule: string,
  internSchedule: string
): IctMajor {
  const degree = ICT_DEGREES.find((d) => d.code === degreeCode)!;
  return { code, name, fullName: `${degree.name} สาขาวิชา${name}`, degreeCode, keywords, prepSchedule, internSchedule };
}

// ลำดับตามที่แสดงใน dropdown ของระบบ (8 หลักสูตร) / โครงสร้างรอบเป็นข้อมูลจริงตามหลักสูตรคณะ ICT
export const ICT_MAJORS: IctMajor[] = [
  major("DB", "บธ.บ.", "ธุรกิจดิจิทัล", ["ธุรกิจดิจิทัล", "digital business"],
    "ปี 3 เทอม 2", "ปี 4 เทอม 1"),
  major("CPE", "วศ.บ.", "วิศวกรรมคอมพิวเตอร์", ["วิศวกรรมคอมพิวเตอร์", "computer engineering"],
    "ปี 3 เทอม 1-2", "ปี 4 เทอม 1 หรือ เทอม 2"),
  major("SE", "วศ.บ.", "วิศวกรรมซอฟต์แวร์", ["วิศวกรรมซอฟต์แวร์", "software engineering"],
    "ปี 3 เทอม 1", "ปี 3 เทอม 2 (ออกฝึกเทอมถัดไปทันที)"),
  major("CS", "วท.บ.", "วิทยาการคอมพิวเตอร์", ["วิทยาการคอมพิวเตอร์", "computer science"],
    "ปี 3 เทอม 1-2", "ปี 4 เทอม 1 หรือ เทอม 2"),
  major("DSA", "วท.บ.", "วิทยาการข้อมูลและการประยุกต์", ["วิทยาการข้อมูล", "data science"],
    "ปี 3 เทอม 1-2", "ปี 4 เทอม 1"),
  major("IT", "วท.บ.", "เทคโนโลยีสารสนเทศ", ["เทคโนโลยีสารสนเทศ", "information technology"],
    "ปี 3 เทอม 2", "ปี 4 เทอม 1"),
  major("GIS", "วท.บ.", "ภูมิสารสนเทศศาสตร์", ["ภูมิสารสนเทศ", "geographic information"],
    "ปี 3 เทอม 2", "ปี 4 เทอม 1"),
  major("CGM", "ศป.บ.", "คอมพิวเตอร์กราฟิกและมัลติมีเดีย", ["คอมพิวเตอร์กราฟิก", "computer graphic"],
    "ปี 3 เทอม 2", "ปี 4 เทอม 1"),
];

/** หาสาขาจากค่าดิบ (รองรับเลขนำหน้า เช่น "221 วิศวกรรมซอฟต์แวร์", คำนำหน้า "สาขาวิชา", ชื่อเต็ม, ชื่ออังกฤษ, หรือรหัสย่อ) */
export function findMajor(raw?: string | null): IctMajor | null {
  const v = String(raw || "").trim().toLowerCase();
  if (!v) return null;
  const byCode = ICT_MAJORS.find((m) => m.code.toLowerCase() === v);
  if (byCode) return byCode;
  return ICT_MAJORS.find((m) => m.keywords.some((k) => v.includes(k.toLowerCase()))) || null;
}

/** คืนชื่อสาขามาตรฐาน ถ้าจับคู่ไม่ได้จะคืนค่าเดิมที่ตัดเลขนำหน้า/คำว่า "สาขา" ออกแล้ว */
export function normalizeMajor(raw?: string | null): string {
  const found = findMajor(raw);
  if (found) return found.name;
  return String(raw || "")
    .trim()
    .replace(/^\d+\s*/, "")
    .replace(/^(สาขาวิชา|สาขา)\s*/, "")
    .trim();
}

/** หลักสูตรของสาขา เช่น "หลักสูตรวิศวกรรมศาสตรบัณฑิต" */
export function degreeOfMajor(m: IctMajor): IctDegree {
  return ICT_DEGREES.find((d) => d.code === m.degreeCode)!;
}

/** ป้ายแสดงผล = ชื่อเต็ม เช่น "หลักสูตรวิศวกรรมศาสตรบัณฑิต สาขาวิชาวิศวกรรมซอฟต์แวร์" */
export function majorLabel(m: IctMajor): string {
  return m.fullName;
}

/** <option> ของทุกสาขา (value = ชื่อมาตรฐาน) สำหรับฝังใน HTML string */
export function majorOptionsHtml(indent = ""): string {
  return ICT_MAJORS.map((m) => `${indent}<option value="${m.name}">${majorLabel(m)}</option>`).join("\n");
}

/** ข้อมูลสาขาแบบ JSON ให้ client script อ่าน (type="application/json" ไม่ถูก execute) */
export function ictMajorsDataScript(): string {
  const data = ICT_MAJORS.map((m) => ({ ...m, degreeName: degreeOfMajor(m).name }));
  return `<script type="application/json" id="ict-majors-data">${JSON.stringify(data)}</script>`;
}
