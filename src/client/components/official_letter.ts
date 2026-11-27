// @ts-nocheck
// ===== แบบหนังสือราชการ (2 แผ่น) ใช้ร่วมกันฝั่งเจ้าหน้าที่ (admin_dashboard) และฝั่งนิสิต (status_all) =====
// แผ่นที่ 1: ตัวหนังสือ (ตรา มพ. / ที่ / ที่อยู่ / วันที่ออก / เรื่อง / เรียน / สิ่งที่ส่งมาด้วย / เนื้อความ / ลงนาม / งานวิชาการ)
// แผ่นที่ 2: รายชื่อนิสิตที่ยื่นสมัคร (ลำดับ / รหัส / ชื่อ-สกุล / ตำแหน่ง / เบอร์โทร / ชั้นปี)
//
// ผังหน้าวัดจากหนังสือต้นแบบ (Word → PDF, TH SarabunIT๙ 16pt) หน่วย mm จากมุมซ้ายบนของกระดาษ A4
// → แต่ละแผ่นเป็นกล่อง A4 เต็มแผ่น (210 x 297mm) หน้าพิมพ์/PDF ต้องตั้งขอบกระดาษเป็น 0
// แผ่นที่ 2 มี class "official-acceptance-page" → หน้าพิมพ์/PDF ขึ้นหน้าใหม่ · ".letter-preview-sep" แสดงเฉพาะบนจอ
(function () {
  const THAI_DIGITS = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

  // ---------- ขนาดตัวอักษร / ระยะ (เทียบกับต้นแบบ) ----------
  // ไฟล์เว็บฟอนต์ TH Sarabun New ใน public/fonts วาดตัวใหญ่กว่า TH Sarabun ใน Word
  // วัดความกว้างคำ/บรรทัดเทียบต้นแบบแล้ว: 16pt ของ Word = 13.95px ของฟอนต์นี้ (ตรงกันทั้งตัวปกติและตัวหนา)
  const PX_PER_WORD_PT = 13.85 / 16; // เทียบความยาวบรรทัดเต็มของ PDF ต้นฉบับ (13.95 ยาวกว่า Word ~0.7%)
  const fs = (wordPt) => `${(wordPt * PX_PER_WORD_PT).toFixed(2)}px`;
  const LINE = 6.37; // mm ระยะบรรทัด (Word "single" ของ 16pt)
  const GAP = 2.13; // mm ระยะเว้นระหว่างย่อหน้า/หัวข้อ (ต้นแบบ: 8.5mm ต่อหัวข้อ = 1 บรรทัด + 2.13mm)
  const LEFT = 30; // ขอบซ้าย 3 ซม.
  const TEXT_W = 161; // ขวาสุดของข้อความต้นแบบ ~191mm
  const SIGN_CENTER = 122; // กึ่งกลางกลุ่มลงนาม (ขอแสดงความนับถือ / ลายเซ็น / ชื่อ / ตำแหน่ง)

  function esc(v) {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toThaiDigits(v) {
    return String(v ?? '').replace(/[0-9]/g, (d) => THAI_DIGITS[Number(d)]);
  }

  /** ข้อความที่ผู้ใช้กรอก → HTML ปลอดภัย + เลขไทย */
  function txt(v) {
    return toThaiDigits(esc(v));
  }

  /** เว้นวรรคแบบต้นแบบ (Word พิมพ์ 2 ช่อง) — ช่องว่างธรรมดาใน HTML จะยุบเหลือช่องเดียว */
  const SP2 = '&nbsp; ';

  /** เลขที่หนังสือรูปแบบต้นแบบ: "อว 7316/ว 815" -> "อว ๗๓๑๖ / ว ๘๑๕" (เว้นวรรครอบ "/") */
  function formatDocNo(v) {
    return txt(String(v || '').replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim());
  }

  // คำ/วลีที่ห้ามตัดกลาง — browser ตัดคำไทยต่างจาก Word (เช่น "ขอ|ความอนุเคราะห์", "ขอ|ขอบพระคุณ")
  const KEEP_TOGETHER = ['ได้รับความอนุเคราะห์', 'ขอความอนุเคราะห์', 'มีความเหมาะสม', 'ข้อสงสัย', 'เข้าฝึกงาน', 'ความร่วมมือ', 'จากสถานประกอบการ', 'ขอขอบพระคุณมา', 'อาจารย์ที่ปรึกษานิสิตฝึกงาน', 'ผู้ประสานงาน', 'จะขอบคุณยิ่ง'];
  function keepPhrases(html) {
    return KEEP_TOGETHER.reduce((h, w) => h.split(w).join(`<span style="white-space:nowrap;">${w}</span>`), html);
  }

  /** "2026-11-02" -> "2 พฤศจิกายน 2569" (แยกส่วนเอง ไม่ผ่าน Date เพื่อไม่ให้วันเลื่อนตามโซนเวลา) */
  function thaiDate(ymd) {
    const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '';
    return `${parseInt(m[3], 10)} ${THAI_MONTHS[parseInt(m[2], 10) - 1]} ${parseInt(m[1], 10) + 543}`;
  }

  function todayYmd() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function periodText(start, end) {
    const a = thaiDate(start);
    const b = thaiDate(end);
    // วัน เดือน ปี ไม่แยกบรรทัดกัน (เว้นวรรคด้วย non-breaking space)
    const nb = (s) => s.replace(/ /g, ' ');
    if (a && b) return `ในระหว่างวันที่ ${nb(a)} ถึงวันที่ ${nb(b)}`;
    if (a) return `ตั้งแต่วันที่ ${nb(a)} เป็นต้นไป`;
    return '';
  }

  // ชื่อสาขาแบบสั้น (เช่น "วิศวกรรมซอฟต์แวร์") จากรายชื่อสาขากลางที่หน้าเพจฝังมา
  let majorsCache = null;
  function majorName(raw) {
    const v = String(raw || '').trim();
    if (!v) return '';
    if (!majorsCache) {
      try {
        const el = document.getElementById('ict-majors-data');
        majorsCache = el ? JSON.parse(el.textContent || '[]') : [];
      } catch (e) {
        majorsCache = [];
      }
    }
    const low = v.toLowerCase();
    const found = majorsCache.find((m) => m.code.toLowerCase() === low)
      || majorsCache.find((m) => (m.keywords || []).some((k) => low.includes(String(k).toLowerCase())));
    return found ? found.name : v.replace(/^\d+\s*/, '').replace(/^(สาขาวิชา|สาขา)\s*/, '').trim();
  }

  /**
   * @param d {
   *   type: 'REQUEST' | 'DISPATCH', academicYear (หนังสือส่งตัว: "ประจำปีการศึกษา ..."), docNo, letterDate (YYYY-MM-DD · ว่าง = วันนี้), companyName,
   *   recipientName, recipientPosition, instructors: [{ major, name, phone }],
   *   signatoryName, signatoryPosition (ขึ้นบรรทัดใหม่ได้), signatureDataUrl, officePhone,
   *   students: [{ studentCode, nameTh, major, position, phone, year, internStartDate, internEndDate }]
   * }
   */
  function buildOfficialLetterHtml(d) {
    const isDispatch = d.type === 'DISPATCH';
    const students = Array.isArray(d.students) ? d.students : [];
    const companyName = d.companyName || 'สถานประกอบการ';
    // วันที่ออกเอกสาร: ฉบับที่ออกแล้ว = วันที่ออก · ร่าง = วันนี้
    const issueDate = thaiDate(d.letterDate) || thaiDate(todayYmd());

    const recipientHtml = d.recipientName
      ? `${txt(d.recipientName)}${d.recipientPosition ? `${SP2}ตำแหน่ง ${txt(d.recipientPosition)}` : ''}`
      : `ผู้จัดการฝ่ายทรัพยากรบุคคล ${txt(companyName)}`;

    // ช่วงฝึก: ทุกคนเหมือนกัน → ใส่ในประโยค (ตัวหนา) · ต่างกัน → ระบุใต้ชื่อในตารางรายชื่อ
    const periods = students.map((s) => periodText(s.internStartDate, s.internEndDate));
    const uniq = Array.from(new Set(periods.filter(Boolean)));
    const samePeriod = uniq.length === 1 && periods.every((p) => p === uniq[0]);
    // ช่วงวันที่ตัวหนา: บีบช่องไฟเล็กน้อย — ต้นฉบับพิมพ์วันที่ด้วยเลขอารบิก (แคบกว่าเลขไทย) จึงอยู่บรรทัดเดียวพอดี
    const PERIOD_STYLE = 'font-weight:700; letter-spacing:-0.2px;';
    // ยังไม่ได้ตั้งวันเริ่ม/สิ้นสุดของรอบออกฝึก → เว้นช่องวันที่ (ตัวหนา) ให้เติม แทนการตัดประโยคช่วงฝึกทิ้ง
    const BLANK_DATE = '..............................';
    const periodSentence = samePeriod
      ? ` <b style="${PERIOD_STYLE}">${toThaiDigits(uniq[0])}</b>`
      : (uniq.length
        ? ' ตามช่วงเวลาที่ระบุในรายชื่อนิสิตที่แนบมาพร้อมนี้'
        : ` <b style="${PERIOD_STYLE}">ในระหว่างวันที่ ${BLANK_DATE} ถึงวันที่ ${BLANK_DATE}</b>`);

    const DOTS = '....................';
    const instructors = Array.isArray(d.instructors) ? d.instructors.filter((c) => c && (c.name || c.phone)) : [];
    const multiMajor = instructors.length > 1;
    const contactHtml = instructors.length
      ? instructors.map((c) =>
          `${c.name ? txt(c.name) : DOTS}${multiMajor && c.major ? ` (สาขาวิชา${txt(c.major)})` : ''} อาจารย์ที่ปรึกษานิสิตฝึกงาน ผู้ประสานงาน หมายเลขโทรศัพท์ <span style="white-space:nowrap;">${c.phone ? txt(c.phone) : DOTS}</span>`
        ).join(' และ ')
      : `${DOTS} อาจารย์ที่ปรึกษานิสิตฝึกงาน ผู้ประสานงาน หมายเลขโทรศัพท์ ${DOTS}`;

    const positionLines = String(d.signatoryPosition || 'คณบดีคณะเทคโนโลยีสารสนเทศและการสื่อสาร')
      .split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    // หนังสือส่งตัว (ต้นแบบ "15. สภาเภสัชกรรม.pdf") ไม่มี "สิ่งที่ส่งมาด้วย" — ย่อหน้าแรกต่อจาก "เรียน"
    const enclosures = isDispatch
      ? []
      : [['๑. รายชื่อนิสิต'], ['๒. แบบตอบรับ/ปฏิเสธ การรับนิสิตเข้าฝึกงาน']];
    const academicYearText = String(d.academicYear || '').trim() ? ` ประจำปีการศึกษา ${txt(d.academicYear)}` : '';

    // ย่อหน้า: บรรทัดแรกเริ่มที่ 55mm (ย่อ 25mm) · เต็มบรรทัดชิดขอบขวาแบบ Word ภาษาไทย บรรทัดสุดท้ายชิดซ้าย
    // text-justify:inter-character → กระจายช่องไฟทีละตัวอักษร (justify ธรรมดาขยายได้เฉพาะช่องว่าง → เกิดรูโหว่กลางบรรทัด)
    // ขอบขวาย่อหน้า 189.7mm ตามต้นฉบับ (ข้อความส่วนอื่นยาวได้ถึง 191mm)
    // letter-spacing ติดลบ: เผื่อที่ให้ตัดบรรทัดตรงต้นฉบับ — justify ยืดกลับให้เต็มบรรทัดอยู่แล้ว
    //   ขอความอนุเคราะห์ -0.1px: หน้าพิมพ์ของ Chrome วาดตัวอักษรกว้างกว่าบนจอเล็กน้อย
    //   ส่งตัว -0.2px: ข้อความหนังสือส่งตัวกว้างกว่าต้นฉบับ (SarabunIT๙) ~1.8% ในบางบรรทัด
    // กำหนดขนาด/สี/ระยะบรรทัดตรงนี้ด้วย — CSS ส่วนกลางของเว็บมี p { font-size:13px; color:#888; line-height:1.4 } ทับอยู่
    const P = `margin:${GAP}mm ${(LEFT + TEXT_W - 189.7).toFixed(1)}mm 0 0; text-indent:25mm; text-align:justify; text-justify:inter-character; text-align-last:left; letter-spacing:${isDispatch ? -0.2 : -0.1}px; font-size:inherit; color:#000; line-height:${LINE}mm;`;
    const body = keepPhrases(isDispatch
      ? `
        <p style="${P}">ตามที่ คณะเทคโนโลยีสารสนเทศและการสื่อสาร มหาวิทยาลัยพะเยา ได้รับความอนุเคราะห์จากสถานประกอบการของท่านในการรับนิสิตฝึกงาน${academicYearText} และได้พิจารณาคัดเลือกนิสิตเข้าฝึกงานกับสถานประกอบการของท่านเรียบร้อยแล้ว นั้น</p>
        <p style="${P}">ในการนี้ คณะเทคโนโลยีสารสนเทศและการสื่อสาร มหาวิทยาลัยพะเยา จึงขอส่งนิสิตเข้าฝึกงาน${periodSentence} โดยหวังเป็นอย่างยิ่งว่าจะได้รับความร่วมมือจากท่านในโอกาสต่อไป และขอขอบพระคุณมา ณ โอกาสนี้ ทั้งนี้ หากมีข้อสงสัยสามารถสอบถามได้ที่ ${contactHtml}</p>
        <p style="${P}">จึงเรียนมาเพื่อโปรดทราบ จะขอบคุณยิ่ง</p>`
      : `
        <p style="${P}">ด้วยคณะเทคโนโลยีสารสนเทศและการสื่อสาร มหาวิทยาลัยพะเยา ได้เปิดการเรียนการสอนรายวิชาการฝึกงาน ซึ่งรายวิชาดังกล่าวมีวัตถุประสงค์เพื่อให้นิสิตได้ฝึกทักษะความชำนาญทางด้านคอมพิวเตอร์ ตลอดจนการนำคอมพิวเตอร์เข้ามาประยุกต์ใช้กับงานด้านต่าง ๆ ในองค์กร</p>
        <p style="${P}">ในการนี้ คณะเทคโนโลยีสารสนเทศและการสื่อสาร ได้พิจารณาแล้วเห็นว่าหน่วยงานของท่านมีความเหมาะสมอย่างยิ่งในการถ่ายทอดความรู้ด้านทฤษฎีและการปฏิบัติให้กับนิสิตได้เป็นอย่างดี จึงใคร่ขอความอนุเคราะห์ท่านรับนิสิตฝึกงาน${periodSentence} โดยหวังเป็นอย่างยิ่งว่าจะได้รับความอนุเคราะห์จากท่าน และขอขอบพระคุณมา ณ โอกาสนี้ ทั้งนี้ หากมีข้อสงสัยสามารถสอบถามเพิ่มเติมได้ที่ ${contactHtml}</p>
        <p style="${P}">จึงเรียนมาเพื่อโปรดพิจารณาให้ความอนุเคราะห์ จะขอบคุณยิ่ง</p>`);

    // ลายเซ็นเป็น data URL รูปภาพที่เซิร์ฟเวอร์ตรวจชนิดไฟล์แล้ว — รับเฉพาะ data:image/ กันค่าแปลกปลอมใน src
    const sig = /^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/.test(String(d.signatureDataUrl || '')) ? d.signatureDataUrl : '';

    // กลุ่มลงนาม: กล่องที่กึ่งกลางอยู่ที่ SIGN_CENTER (นับจากขอบกระดาษ)
    const signLeft = 2 * (SIGN_CENTER - LEFT) - TEXT_W; // ระยะจากขอบซ้ายข้อความ
    // white-space:pre → คงช่องว่างคู่ที่กรอกไว้ (เช่น "ดร.เกวรินทร์  จันทร์ดำ", "...องค์กร  รักษาการแทน") แบบต้นฉบับ
    const signBox = `margin-left:${signLeft}mm; width:${TEXT_W - signLeft}mm; text-align:center; white-space:pre;`;

    // ---------- แผ่นที่ 2: รายชื่อนิสิต ----------
    // ตารางต้นแบบกว้างเกินขอบข้อความ: 16.7–203.3mm · ความกว้างคอลัมน์ตามต้นแบบ
    const majorNames = Array.from(new Set(students.map((s) => majorName(s.major)).filter(Boolean)));
    const COLS = [16.1, 26.55, 49.6, 43.45, 35.05, 15.85];
    const BORDER = 'border:0.5pt solid #000;';
    const TD = `${BORDER} padding:0 1.9mm; height:${LINE}mm; vertical-align:middle;`;
    const TH = `${TD} font-weight:700; text-align:center; white-space:nowrap;`;
    const rowsHtml = students.map((s, idx) => {
      const per = samePeriod ? '' : periods[idx];
      return `
          <tr>
            <td style="${TD} text-align:center;">${toThaiDigits(idx + 1)}</td>
            <td style="${TD} text-align:center; white-space:nowrap;">${txt(s.studentCode || '')}</td>
            <td style="${TD}">${esc(s.nameTh || '')}${per ? `<div style="font-size:${fs(12)}; line-height:1.2;">${txt(per)}</div>` : ''}</td>
            <td style="${TD} text-align:center;">${esc(s.position || 'นิสิตฝึกงาน')}</td>
            <td style="${TD} text-align:center; white-space:nowrap;">${txt(s.phone || '-')}</td>
            <td style="${TD} text-align:center;">${txt(s.year || '-')}</td>
          </tr>`;
    }).join('');

    // แผ่นสูง 296mm (ไม่ใช่ 297) กันเครื่องพิมพ์/html2pdf ปัดเศษแล้วดันขึ้นหน้าว่างเพิ่ม
    const PAGE = `position:relative; width:210mm; height:296mm; overflow:hidden; background:#fff; box-sizing:border-box;`;
    const ABS = (top, left) => `position:absolute; top:${top}mm; left:${left}mm; white-space:nowrap;`;

    return `
      <style>
        /* ฟอนต์ราชการ TH Sarabun New (SIPA — ฟอนต์แห่งชาติ ใช้/แจกจ่ายได้ฟรี) ไฟล์อยู่ที่ public/fonts */
        @font-face { font-family:'TH Sarabun New'; src:url('/fonts/THSarabunNew.woff') format('woff'); font-weight:400; font-style:normal; }
        @font-face { font-family:'TH Sarabun New'; src:url('/fonts/THSarabunNew-Bold.woff') format('woff'); font-weight:700; font-style:normal; }
        .official-letter p { margin:0; font-size:inherit; color:#000; line-height:${LINE}mm; }
        @media screen { .official-letter-sheet { box-shadow:0 2px 12px rgba(15,23,42,.18); } }
        @media print { .official-letter .letter-preview-sep { display:none !important; } }
      </style>
      <div class="official-letter" style="width:210mm; margin:0 auto; font-family:'TH Sarabun New','TH SarabunIT๙','TH SarabunPSK',sans-serif; font-size:${fs(16)}; font-weight:400; line-height:${LINE}mm; color:#000; text-indent:0;">

        <!-- ===== แผ่นที่ 1 ===== -->
        <div class="official-letter-page official-letter-sheet" style="${PAGE}">
          <!-- ตรา มพ. สูง 30mm กึ่งกลางพื้นที่ข้อความ (110mm) ด้านบน 19.6mm -->
          <img src="/img/up_logo.png" alt="ตรามหาวิทยาลัยพะเยา" style="position:absolute; top:19.6mm; left:110mm; transform:translateX(-50%); height:30mm; width:auto;" />
          <div style="${ABS(36.65, LEFT)}">ที่ ${formatDocNo(d.docNo)}</div>
          <!-- ที่อยู่ส่วนราชการ: ขอความอนุเคราะห์เริ่ม 135.1mm · ส่งตัวเริ่ม 131.6mm (ตามต้นแบบแต่ละฉบับ) -->
          <div style="${ABS(36.65, isDispatch ? 131.6 : 135.1)}">
            คณะเทคโนโลยีสารสนเทศและการสื่อสาร<br />
            มหาวิทยาลัยพะเยา<br />
            ตำบลแม่กา${SP2}อำเภอเมือง<br />
            จังหวัดพะเยา${SP2}${toThaiDigits('56000')}
          </div>

          <!-- เนื้อหาไหลต่อจากวันที่ (63.8mm) -->
          <div style="position:absolute; top:64.3mm; left:${LEFT}mm; width:${TEXT_W}mm;">
            <div style="margin-top:-0.8mm; margin-left:80mm; white-space:nowrap;">${toThaiDigits(issueDate).replace(/ /g, SP2)}</div>

            <div style="margin-top:${GAP + 0.9}mm; display:flex;"><span style="width:10mm; flex:none;">เรื่อง</span><span>${isDispatch ? 'ขอส่งนิสิตเข้าฝึกงาน' : 'ขอความอนุเคราะห์รับนิสิตฝึกงาน'}</span></div>
            <div style="margin-top:${GAP}mm; display:flex;"><span style="width:10mm; flex:none;">เรียน</span><span>${recipientHtml}</span></div>
            ${enclosures.length ? `<div style="margin-top:${GAP}mm; display:grid; grid-template-columns:25mm 76.6mm auto;">
              ${enclosures.map(([a], i) => `<div>${i === 0 ? 'สิ่งที่ส่งมาด้วย' : ''}</div><div>${a}</div><div style="white-space:nowrap;">จำนวน${SP2}๑${SP2}ฉบับ</div>`).join('')}
            </div>` : ''}

            ${body}

            <div style="margin-top:4.2mm; ${signBox}">ขอแสดงความนับถือ</div>
            <!-- พื้นที่ลายเซ็น 3 บรรทัด (ต้นแบบ: ภาพสูง 20mm กึ่งกลาง 122mm) -->
            <div style="${signBox} position:relative; height:${(LINE * 3).toFixed(2)}mm;">
              ${sig ? `<img src="${sig}" alt="ลายเซ็นผู้ลงนาม" style="position:absolute; bottom:-1mm; left:50%; transform:translateX(-50%); max-width:47mm; max-height:20mm; object-fit:contain;" />` : ''}
            </div>
            <div style="${signBox}">(${txt(d.signatoryName || DOTS)})</div>
            ${positionLines.map((l) => `<div style="${signBox}">${txt(l)}</div>`).join('')}
          </div>

          <!-- ท้ายหนังสือ: ขอความอนุเคราะห์ 15pt · ส่งตัว 16pt (ตามต้นแบบ) -->
          <div style="${ABS(263.7, LEFT)} font-size:${fs(isDispatch ? 16 : 15)}; line-height:${isDispatch ? LINE : 6}mm;">
            งานวิชาการ คณะเทคโนโลยีสารสนเทศและการสื่อสาร<br />
            โทร ${d.officePhone ? txt(d.officePhone) : DOTS}
          </div>
        </div>

        <div class="letter-preview-sep" style="margin:6mm 0; border-top:2px dashed #94A3B8; text-align:center; font-family:sans-serif; font-size:12px; line-height:1; color:#64748B;">
          <span style="position:relative; top:-0.7em; background:#E2E8F0; padding:0 3mm;">แผ่นที่ ๒</span>
        </div>

        <!-- ===== แผ่นที่ 2: รายชื่อนิสิต ===== -->
        <div class="official-acceptance-page official-letter-sheet" style="${PAGE} break-before:page; page-break-before:always;">
          <!-- หัวเรื่อง 18pt ตัวหนา 3 บรรทัด กึ่งกลางพื้นที่ข้อความ เริ่ม 30.2mm -->
          <div style="position:absolute; top:30.9mm; left:${LEFT}mm; width:160.4mm; text-align:center; font-weight:700; font-size:${fs(18)}; line-height:7.15mm;">
            รายชื่อนิสิตฝึกงาน${majorNames.length ? `สาขาวิชา${esc(majorNames.join(' และ '))}` : ''}<br />
            คณะเทคโนโลยีสารสนเทศและการสื่อสาร มหาวิทยาลัยพะเยา<br />
            สถานที่ฝึกงาน${SP2}${esc(companyName)}
          </div>
          <table style="position:absolute; top:54.7mm; left:16.7mm; width:186.6mm; border-collapse:collapse; table-layout:fixed; line-height:${LINE}mm;">
            <colgroup>${COLS.map((w) => `<col style="width:${w}mm;" />`).join('')}</colgroup>
            <thead>
              <tr>
                <th style="${TH}">ลำดับที่</th>
                <th style="${TH}">รหัสนิสิต</th>
                <th style="${TH}">ชื่อ-สกุล</th>
                <th style="${TH}">ตำแหน่ง</th>
                <th style="${TH}">เบอร์โทรศัพท์</th>
                <th style="${TH}">ชั้นปี</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>`;
  }

  window.buildOfficialLetterHtml = buildOfficialLetterHtml;
})();
