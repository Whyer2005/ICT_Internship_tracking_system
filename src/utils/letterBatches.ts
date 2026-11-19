// "ฉบับหนังสือ" ราชการ (หนังสือขอความอนุเคราะห์ / หนังสือส่งตัว) — ฟังก์ชันคำนวณล้วน ไม่แตะฐานข้อมูล
// กติกา (ยืนยันกับผู้ใช้ 2026-11-16):
//  - 1 ฉบับ = 1 เลขที่ ต่อ 1 บริษัท แนบรายชื่อนิสิต ณ วันที่ออก (snapshot) รายชื่อไม่เปลี่ยนภายหลัง
//  - หนังสือขอความอนุเคราะห์: ออกให้เฉพาะนิสิตที่ยังไม่มีหนังสือ (คนที่ออกไปแล้วอยู่ในฉบับเดิม)
//  - หนังสือส่งตัว: ออกให้เฉพาะนิสิตที่บริษัทตอบรับแล้ว และยังไม่ได้ส่งตัว
//  - แบบตอบรับเป็นรายคน (นิสิตแต่ละคนอัปโหลดเอง)
import type {
  LetterBatch,
  LetterBatchStudent,
  LetterType,
  StudentDocWorkflowRecord,
} from "./superAdminStore";

type BatchState = {
  docWorkflowMap: Record<string, StudentDocWorkflowRecord>;
  letterBatches?: Record<string, LetterBatch>;
};

export function newBatchId(type: LetterType, now: number = Date.now()): string {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${type === "REQUEST" ? "REQ" : "DSP"}-${now}-${rand}`;
}

/** ข้อมูลนิสิตที่ใช้พิมพ์ในหนังสือ (จาก Student + InternshipPlacement) */
export function toBatchStudent(s: {
  id: number;
  studentCode: string;
  nameTh: string;
  major?: string | null;
  phone?: string | null;
  placement?: { position?: string | null; companyAddress?: string | null } | null;
  internshipWindow?: { internStartDate?: Date | null; internEndDate?: Date | null } | null;
}): LetterBatchStudent {
  const out: LetterBatchStudent = {
    studentId: s.id,
    studentCode: s.studentCode,
    nameTh: s.nameTh,
    major: s.major || "-",
    position: s.placement?.position || "นิสิตฝึกงาน",
    phone: s.phone || "-",
    companyAddress: s.placement?.companyAddress || "",
  };
  // ช่วงฝึกตามรอบออกฝึกของนิสิต (เก็บลงฉบับหนังสือ ณ วันที่ออก — แก้วันของรอบภายหลังไม่กระทบฉบับที่ออกไปแล้ว)
  const start = s.internshipWindow?.internStartDate;
  const end = s.internshipWindow?.internEndDate;
  if (start) out.internStartDate = start.toISOString().slice(0, 10);
  if (end) out.internEndDate = end.toISOString().slice(0, 10);
  return out;
}

/**
 * นิสิตที่ "ออกหนังสือฉบับใหม่ให้ไม่ได้" พร้อมเหตุผล
 * - REQUEST: มีหนังสือขอความอนุเคราะห์อยู่แล้ว
 * - DISPATCH: บริษัทยังไม่ตอบรับ หรือออกหนังสือส่งตัวไปแล้ว
 */
export function findIneligibleForLetter(
  state: BatchState,
  studentIds: number[],
  type: LetterType
): Array<{ studentId: number; reason: string }> {
  const out: Array<{ studentId: number; reason: string }> = [];
  for (const id of studentIds) {
    const wf = state.docWorkflowMap[String(id)];
    if (type === "REQUEST") {
      if (wf?.requestLetterIssued) {
        out.push({ studentId: id, reason: `มีหนังสือขอความอนุเคราะห์แล้ว (${wf.requestLetterDocNo || "-"})` });
      }
    } else if (wf?.dispatchLetterIssued) {
      out.push({ studentId: id, reason: `ออกหนังสือส่งตัวแล้ว (${wf.dispatchLetterDocNo || "-"})` });
    } else if (wf?.companyResponseStatus !== "ACCEPTED") {
      out.push({ studentId: id, reason: "บริษัทยังไม่ตอบรับ (ต้องยืนยันผลแบบตอบรับว่า \"รับ\" ก่อน)" });
    }
  }
  return out;
}

export function saveLetterBatch(state: BatchState, batch: LetterBatch): LetterBatch {
  if (!state.letterBatches) state.letterBatches = {};
  state.letterBatches[batch.batchId] = batch;
  return batch;
}

export function getLetterBatch(state: BatchState, batchId?: string | null): LetterBatch | null {
  if (!batchId) return null;
  return state.letterBatches?.[batchId] || null;
}

/** ทุกฉบับที่มีชื่อนิสิตคนนี้ (ใหม่ → เก่า) — ใช้ให้นิสิตดาวน์โหลดย้อนหลัง */
export function batchesForStudent(state: BatchState, studentId: number): LetterBatch[] {
  return Object.values(state.letterBatches || {})
    .filter((b) => b.students.some((s) => s.studentId === studentId))
    .sort((a, b) => (b.issuedAt || "").localeCompare(a.issuedAt || ""));
}

/**
 * สร้างฉบับหนังสือย้อนหลังให้ข้อมูลที่ออกก่อนมีระบบฉบับ (ครั้งเดียว แล้วรายชื่อจะคงที่)
 * จัดกลุ่มตาม batchId เดิม หรือ (เลขที่ + ชื่อบริษัท) ถ้าไม่มี batchId
 */
export function backfillLegacyBatches(
  state: BatchState,
  studentInfo: Map<number, LetterBatchStudent>,
  nowIso: string = new Date().toISOString()
): boolean {
  let modified = false;
  const types: Array<{
    type: LetterType;
    issued: (wf: StudentDocWorkflowRecord) => boolean;
    getId: (wf: StudentDocWorkflowRecord) => string | undefined;
    setId: (wf: StudentDocWorkflowRecord, id: string) => void;
    docNo: (wf: StudentDocWorkflowRecord) => string;
    date: (wf: StudentDocWorkflowRecord) => string;
    sig: (wf: StudentDocWorkflowRecord) => string;
    prefix: string;
  }> = [
    {
      type: "REQUEST",
      issued: (wf) => Boolean(wf.requestLetterIssued),
      getId: (wf) => wf.requestLetterBatchId,
      setId: (wf, id) => { wf.requestLetterBatchId = id; },
      docNo: (wf) => wf.requestLetterDocNo || "",
      date: (wf) => wf.requestLetterDate || "",
      sig: (wf) => wf.requestLetterSignatureSnapshot || "",
      prefix: "LEGACY-REQ",
    },
    {
      type: "DISPATCH",
      issued: (wf) => Boolean(wf.dispatchLetterIssued),
      getId: (wf) => wf.dispatchLetterBatchId,
      setId: (wf, id) => { wf.dispatchLetterBatchId = id; },
      docNo: (wf) => wf.dispatchLetterDocNo || "",
      date: (wf) => wf.dispatchLetterDate || "",
      sig: (wf) => wf.dispatchLetterSignatureSnapshot || "",
      prefix: "LEGACY-DSP",
    },
  ];

  for (const t of types) {
    const groups = new Map<string, StudentDocWorkflowRecord[]>();
    for (const wf of Object.values(state.docWorkflowMap)) {
      if (!wf || !t.issued(wf)) continue;
      const existing = t.getId(wf);
      if (existing && state.letterBatches?.[existing]) continue;
      const key = existing || `${t.prefix}-${t.docNo(wf)}|${(wf.companyName || "").trim()}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(wf);
    }
    for (const [key, wfs] of groups) {
      const first = wfs[0];
      const students = wfs
        .map((wf) => studentInfo.get(Number(wf.studentId)))
        .filter((s): s is LetterBatchStudent => Boolean(s));
      if (students.length === 0) continue;
      saveLetterBatch(state, {
        batchId: key,
        type: t.type,
        companyName: first.companyName || "สถานประกอบการ",
        docNo: t.docNo(first),
        letterDate: t.date(first),
        interviewDate: first.interviewDate || "",
        signatureSnapshot: t.sig(first),
        students,
        issuedAt: t.date(first) ? `${t.date(first)}T00:00:00.000Z` : nowIso,
        legacy: true,
      });
      wfs.forEach((wf) => t.setId(wf, key));
      modified = true;
    }
  }
  return modified;
}
