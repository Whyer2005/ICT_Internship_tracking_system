# 10 · Use Case Diagram แยกตามบทบาท (Use Case by Role)

> แยกจากแผนภาพรวม [05_USE_CASE_DIAGRAM.md](05_USE_CASE_DIAGRAM.md) ให้เหลือ **1 ภาพต่อ 1 บทบาท** เพื่อให้อาจารย์แต่ละท่านตรวจเฉพาะส่วนของตัวเองได้ง่าย
> คำถามสำหรับวันประชุม: **"บทบาทของอาจารย์ทำสิ่งเหล่านี้ครบหรือไม่ ขาดหรือเกินอะไร"**
> ไฟล์แก้ไข / Export: `use_case_role_student.drawio`, `use_case_role_advisor.drawio`, `use_case_role_course_admin.drawio`, `use_case_role_staff.drawio`, `use_case_role_executive.drawio`

| บทบาท | จำนวน Use Case | รอเคาะ (\*) | ไฟล์ .drawio |
|---|:---:|:---:|---|
| [นิสิต](#student) | 7 | 2 | [use_case_role_student.drawio](use_case_role_student.drawio) |
| [อาจารย์ที่ปรึกษา](#advisor) | 5 | 1 | [use_case_role_advisor.drawio](use_case_role_advisor.drawio) |
| [อาจารย์ประจำวิชา](#course-admin) | 6 | 1 | [use_case_role_course_admin.drawio](use_case_role_course_admin.drawio) |
| [เจ้าหน้าที่ฝ่ายฝึกงาน](#staff) | 11 | 5 | [use_case_role_staff.drawio](use_case_role_staff.drawio) |
| [ผู้บริหาร (PM) (\*)](#executive) | 1 (+3 ข้อเสนอ) | 1 | [use_case_role_executive.drawio](use_case_role_executive.drawio) |

**วิธีอ่าน:** วงรีขาว = ทำได้แล้ว · สีแดง (\*) = รอเคาะในที่ประชุม · เส้นประ = Use Case ย่อย («include» ทุกครั้ง / «extend» บางกรณี)

---

<a id="student"></a>
## 1. นิสิต (Student)

```mermaid
flowchart LR
    A["👤 นิสิต<br/>(Student)"]
    subgraph SYS["ระบบติดตามการฝึกงาน คณะ ICT"]
        direction TB
        UC01(["UC-01 อัปโหลด / แก้ไข CV"])
        UC03(["UC-03 บันทึกชั่วโมงอบรม"])
        UC16(["UC-16 ลงทะเบียนอบรม / สแกน QR (*) ⏸"])
        UC06(["UC-06 ยื่น Checklist สถานประกอบการ"])
        UC06I(["ผูกรอบออกฝึกอัตโนมัติ"])
        UC09(["UC-09 อัปโหลดแบบตอบรับ"])
        UC12(["UC-12 ฝึกงานรอบที่ 2 / ตกค้าง"])
        UC18(["UC-18 เรียกตัวกลับ / ยุติการฝึก (*)"])
    end
    A --- UC01 & UC03 & UC16 & UC06 & UC09 & UC12 & UC18
    UC06 -. "«include»" .-> UC06I
    classDef red fill:#f8cecc,stroke:#b85450,stroke-width:2px
    classDef sub fill:#f5f5f5,stroke:#999999
    class UC16,UC18 red
    class UC06I sub
```

**ประเด็นที่ต้องเคาะ:** [OI-02](../04_OPEN_ISSUES.md#oi-02) ลงทะเบียนอบรม / QR · [OI-09](../04_OPEN_ISSUES.md#oi-09) นิสิตนำส่งหนังสือเองได้หรือไม่ · [OI-11](../04_OPEN_ISSUES.md#oi-11) ถูกเรียกตัวกลับ · [OI-13](../04_OPEN_ISSUES.md#oi-13) รุ่นใหม่เริ่มยื่น Checklist เมื่อไร

<a id="advisor"></a>
## 2. อาจารย์ที่ปรึกษา (Advisor)

```mermaid
flowchart LR
    A["👤 อาจารย์ที่ปรึกษา<br/>(Advisor)"]
    subgraph SYS["ระบบติดตามการฝึกงาน คณะ ICT"]
        direction TB
        UC02(["UC-02 ตรวจและอนุมัติ CV"])
        UC04(["UC-04 อนุมัติชั่วโมงอบรม"])
        UC07(["UC-07 อนุมัติ / ตีกลับ Checklist"])
        UC10(["UC-10 ตรวจ / ยืนยันแบบตอบรับ"])
        UC13(["UC-13 ติดตามผ่าน Dashboard (*)"])
    end
    A --- UC02 & UC04 & UC07 & UC10 & UC13
    classDef red fill:#f8cecc,stroke:#b85450,stroke-width:2px
    class UC13 red
```

**ประเด็นที่ต้องเคาะ:** [OI-06](../04_OPEN_ISSUES.md#oi-06) ช่องทางแจ้งเตือน · [OI-14](../04_OPEN_ISSUES.md#oi-14) นิสิตตกค้างเปลี่ยนอาจารย์ที่ปรึกษาหรือไม่ · [OI-04](../04_OPEN_ISSUES.md#oi-04) อาจารย์นิเทศก์ยังต้องมีหรือไม่

<a id="course-admin"></a>
## 3. อาจารย์ประจำวิชา (Course Admin)

```mermaid
flowchart LR
    A["👤 อาจารย์ประจำวิชา<br/>(Course Admin)"]
    subgraph SYS["ระบบติดตามการฝึกงาน คณะ ICT"]
        direction TB
        UC02(["UC-02 ตรวจและอนุมัติ CV"])
        UC04(["UC-04 อนุมัติชั่วโมงอบรม"])
        UC15(["UC-15 นำเข้ารายชื่อนิสิต / กำหนดที่ปรึกษา"])
        UC05(["UC-05 สร้างรุ่นและเปิด/ปิดรอบออกฝึก"])
        UC05X(["เปิดต่อพิเศษ"])
        UC12(["UC-12 ฝึกงานรอบที่ 2 / ตกค้าง"])
        UC13(["UC-13 ติดตามผ่าน Dashboard (*)"])
    end
    A --- UC02 & UC04 & UC15 & UC05 & UC12 & UC13
    UC05X -. "«extend»" .-> UC05
    classDef red fill:#f8cecc,stroke:#b85450,stroke-width:2px
    classDef sub fill:#f5f5f5,stroke:#999999
    class UC13 red
    class UC05X sub
```

**ประเด็นที่ต้องเคาะ:** [OI-01](../04_OPEN_ISSUES.md#oi-01) เกณฑ์หรือข้อยกเว้นรายสาขา · [OI-03](../04_OPEN_ISSUES.md#oi-03) เห็นเฉพาะสาขาตัวเองหรือทั้งคณะ · [OI-14](../04_OPEN_ISSUES.md#oi-14) ใครเป็นผู้เปลี่ยนอาจารย์ที่ปรึกษา

<a id="staff"></a>
## 4. เจ้าหน้าที่ฝ่ายฝึกงาน (Staff)

```mermaid
flowchart LR
    A["👤 เจ้าหน้าที่ฝ่ายฝึกงาน<br/>(Staff)"]
    subgraph SYS["ระบบติดตามการฝึกงาน คณะ ICT"]
        direction TB
        UC16(["UC-16 ลงทะเบียนอบรม / สแกน QR (*) ⏸"])
        UC15(["UC-15 นำเข้ารายชื่อนิสิต / กำหนดที่ปรึกษา"])
        UC05(["UC-05 สร้างรุ่นและเปิด/ปิดรอบออกฝึก"])
        UC05X(["เปิดต่อพิเศษ"])
        UC17(["UC-17 นำเข้าข้อมูลบริษัท (*)"])
        UC08(["UC-08 ออกหนังสือขอความอนุเคราะห์"])
        UC10(["UC-10 ตรวจ / ยืนยันแบบตอบรับ"])
        UC10I(["วิเคราะห์แบบตอบรับอัตโนมัติ (OMR)"])
        UC11(["UC-11 ออกหนังสือส่งตัว"])
        UC12(["UC-12 ฝึกงานรอบที่ 2 / ตกค้าง"])
        UC18(["UC-18 เรียกตัวกลับ / ยุติการฝึก (*)"])
        UC13(["UC-13 ติดตามผ่าน Dashboard (*)"])
        UC14(["UC-14 Export Co-op 01 (*)"])
    end
    COOP["«system»<br/>ระบบ Co-op กลาง"]
    A --- UC16 & UC15 & UC05 & UC17 & UC08 & UC10 & UC11 & UC12 & UC18 & UC13 & UC14
    UC05X -. "«extend»" .-> UC05
    UC10 -. "«include»" .-> UC10I
    UC14 --- COOP
    classDef red fill:#f8cecc,stroke:#b85450,stroke-width:2px
    classDef sub fill:#f5f5f5,stroke:#999999
    classDef ext fill:#f5f5f5,stroke:#666666
    class UC13,UC14,UC16,UC17,UC18 red
    class UC05X,UC10I sub
    class COOP ext
```

**ประเด็นที่ต้องเคาะ:** [OI-09](../04_OPEN_ISSUES.md#oi-09) เลขที่หนังสือ / กำหนดเวลา / ช่องทางส่ง · [OI-10](../04_OPEN_ISSUES.md#oi-10) แบบฟอร์มแบบตอบรับ · [OI-12](../04_OPEN_ISSUES.md#oi-12) ลายเซ็นรองคณบดีแบบสแกน · [OI-15](../04_OPEN_ISSUES.md#oi-15) นำเข้าข้อมูลบริษัท · [OI-02](../04_OPEN_ISSUES.md#oi-02) ลงทะเบียนอบรม / QR · [OI-07](../04_OPEN_ISSUES.md#oi-07) รูปแบบไฟล์ส่งระบบกลาง

<a id="executive"></a>
## 5. ผู้บริหาร (PM) (\*)

```mermaid
flowchart LR
    A["👤 ผู้บริหาร (PM) (*)<br/>(Executive)"]
    subgraph SYS["ระบบติดตามการฝึกงาน คณะ ICT"]
        direction TB
        UC13(["UC-13 ติดตามผ่าน Dashboard (*)"])
        PM1(["จำนวนนิสิตแต่ละขั้น แยกสาขา (*)"])
        PM2(["นิสิตตกค้าง / ต้องติดตาม (*)"])
        PM3(["บริษัทที่นิสิตไปฝึกมากที่สุด (*)"])
    end
    A --- UC13
    UC13 -. "«include»" .-> PM1 & PM2 & PM3
    classDef red fill:#f8cecc,stroke:#b85450,stroke-width:2px
    class UC13,PM1,PM2,PM3 red
```

**ประเด็นที่ต้องเคาะ:** [OI-04](../04_OPEN_ISSUES.md#oi-04) ต้องการเห็นตัวเลขอะไร และต้องมีหน้าแยกหรือไม่ (3 ข้อในภาพเป็นข้อเสนอของทีม) · [OI-05](../04_OPEN_ISSUES.md#oi-05) สาขาที่เข้าร่วมระบบ
