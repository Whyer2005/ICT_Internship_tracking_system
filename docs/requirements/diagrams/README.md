# แผนภาพประกอบระบบ (Diagrams)

> ปรับปรุงล่าสุด: 18 พ.ย. 2569 · ER/Schema สร้างตามฐานข้อมูลจริง (`prisma/schema.prisma`)
> ⚠️ แผนภาพอาจปรับหลังประชุมคณะ (ดู [04_OPEN_ISSUES.md](../04_OPEN_ISSUES.md))

## รายการแผนภาพ

| ลำดับ | แผนภาพ | ดูบน GitHub (.md) | ไฟล์แก้ไข / Export (.drawio) | ใช้ที่ไหน |
|:---:|---|---|---|---|
| 05 | Use Case Diagram | [05_USE_CASE_DIAGRAM.md](05_USE_CASE_DIAGRAM.md) | [use_case_diagram.drawio](use_case_diagram.drawio) | สไลด์ประชุม, Proposal |
| 06 | ER Diagram (Crow's Foot) | [06_ER_DIAGRAM.md](06_ER_DIAGRAM.md) | [er_diagram.drawio](er_diagram.drawio) | Proposal |
| 06 | ER Diagram (Chen) | — | [er_diagram_chen.drawio](er_diagram_chen.drawio) | Proposal |
| 07 | Schema Diagram | [07_SCHEMA_DIAGRAM.md](07_SCHEMA_DIAGRAM.md) | [schema_diagram.drawio](schema_diagram.drawio) | Proposal, ทีม Test |
| 08 | Context Diagram (DFD Level 0) | [08_CONTEXT_DFD.md](08_CONTEXT_DFD.md) | [context_diagram.drawio](context_diagram.drawio) | Proposal |
| 08 | DFD Level 1 | [08_CONTEXT_DFD.md](08_CONTEXT_DFD.md) | [dfd_level1.drawio](dfd_level1.drawio) | Proposal |
| 09 | Activity Diagram | [09_ACTIVITY_DIAGRAM.md](09_ACTIVITY_DIAGRAM.md) | [activity_main_flow.drawio](activity_main_flow.drawio) | สไลด์ประชุม, Proposal |
| 10 | Use Case แยกตามบทบาท (5 ภาพ) | [10_USE_CASE_BY_ROLE.md](10_USE_CASE_BY_ROLE.md) | `use_case_role_*.drawio` (5 ไฟล์) | สไลด์ประชุม (บทบาทละ 1 หน้า) |
| — | สถาปัตยกรรมระบบ (System Architecture) | — | [architecture_diagram.drawio](architecture_diagram.drawio) | Proposal |

---

## วิธีเปิดดู

### ก. ไฟล์ `.md` (ไม่ต้องลงโปรแกรม)
- **บน GitHub:** คลิกไฟล์ .md → แผนภาพแสดงเป็นรูปให้อัตโนมัติ (เหมาะสำหรับอาจารย์)
- **ใน VS Code:** ติดตั้ง Extension **Markdown Preview Mermaid Support** (`bierner.markdown-mermaid`) → เปิดไฟล์ → กด `Ctrl + Shift + V`

### ข. ไฟล์ `.drawio` (แก้ไข / จัดวาง / Export เป็นรูป)
- **ใน VS Code:** ติดตั้ง Extension **Draw.io Integration** (`hediet.vscode-drawio`) → คลิกไฟล์ .drawio จะเปิดเป็นภาพ ลากแก้ได้ทันที
- **บนเว็บ:** เปิด <https://app.diagrams.net> → *Open Existing Diagram* → เลือกไฟล์ .drawio
- **โปรแกรม:** draw.io Desktop (ฟรี) จาก <https://www.drawio.com>

### ค. Export เป็นรูปสำหรับสไลด์ / เล่ม Proposal
1. เปิดไฟล์ .drawio ที่ app.diagrams.net หรือ draw.io Desktop
2. เมนู **File → Export as → PNG** (สไลด์) หรือ **PDF / SVG** (เล่ม — คมชัดเมื่อซูม)
3. แนะนำ: Zoom 200%, Border 10, ติ๊ก *Transparent Background* ถ้าพื้นสไลด์ไม่ใช่สีขาว

> ใน VS Code (Extension Draw.io) ใช้ไฟล์ชื่อลงท้าย `.drawio.png` / `.drawio.svg` ได้ด้วย — เป็นทั้งรูปและไฟล์แก้ไขในไฟล์เดียว

---

## หมายเหตุสำหรับทีม

- ไฟล์ทั้งหมดสร้างจากข้อมูลชุดเดียวกัน ตำแหน่งกล่องจัดวางไว้เบื้องต้น **ควรลากจัดเส้นให้สวยอีกรอบก่อนใช้ในเล่ม** (โดยเฉพาะ Use Case และ DFD ที่มีเส้นเยอะ)
- เมื่อแก้ `prisma/schema.prisma` ต้องอัปเดต ER/Schema ให้ตรงกันด้วย
- แผนภาพชุดเก่า (ฉบับสาขา SE, ต.ค. 2569) ยังอยู่ใน `docs/` เดิม ไม่ได้ลบ
