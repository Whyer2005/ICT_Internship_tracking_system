# 08 · Context Diagram และ DFD (แผนภาพการไหลของข้อมูล)

> ไฟล์ที่แก้ไขได้: [context_diagram.drawio](context_diagram.drawio) · [dfd_level1.drawio](dfd_level1.drawio)
> (\*) = ยังต้องเคาะในที่ประชุม · ปรับปรุงล่าสุด 26 พ.ย. 2569 (CV คอมเมนต์อย่างเดียว · ชั่วโมงอบรมอนุมัติโดยอาจารย์ประจำวิชา · เพิ่ม 7.0 / D7 สหกิจศึกษา · แบบฟอร์มแยกสาขา)

## 1. Context Diagram (DFD Level 0)

มองระบบทั้งระบบเป็นกล่องเดียว แสดงว่า **ใครส่งข้อมูลอะไรเข้า และได้อะไรออกไป**

```mermaid
flowchart LR
    STU["นิสิต<br/>(Student)"]
    ADV["อาจารย์ที่ปรึกษา<br/>(Advisor)"]
    ADM["อาจารย์ประจำวิชา<br/>(Course Admin)"]
    SYS(("0<br/>ระบบติดตามการฝึกงาน<br/>คณะ ICT"))
    STF["เจ้าหน้าที่ฝ่ายฝึกงาน<br/>(Staff)"]
    PM["ผู้บริหาร (PM) (*)"]
    MS["Microsoft Entra ID"]
    COOP["ระบบ Co-op กลาง (*)"]

    STU -- "ข้อมูลส่วนตัว, CV, ชั่วโมงอบรม (+หน่วยงานผู้จัด/ลิงก์),<br/>Checklist, ใบสมัครสหกิจ, แบบตอบรับ" --> SYS
    SYS -- "สถานะ, คอมเมนต์ CV, ผลการตรวจ,<br/>ผลสหกิจ, เอกสารที่ดาวน์โหลดได้" --> STU
    ADV -- "คอมเมนต์ CV,<br/>ผลอนุมัติ Checklist, ผลตรวจแบบตอบรับ" --> SYS
    SYS -- "นิสิตในความดูแล, รายการรอตรวจ,<br/>สถานะสหกิจ" --> ADV
    ADM -- "รายชื่อนิสิต (Excel), ที่ปรึกษา,<br/>ผลอนุมัติชั่วโมงอบรม, คอมเมนต์ CV,<br/>เปิดให้แก้ชื่อ-สกุล, สถานะตกค้าง" --> SYS
    SYS -- "Dashboard, รายงาน" --> ADM
    STF -- "ตั้งค่ารุ่น/รอบ, ข้อมูลบริษัท, แบบฟอร์มรายสาขา,<br/>ประกาศ/ผลสหกิจ, ยืนยันแบบตอบรับ" --> SYS
    SYS -- "คิวออกหนังสือ, ใบสมัครสหกิจ (PDF รวม),<br/>หนังสือราชการ (PDF), ไฟล์ Co-op 01" --> STF
    SYS -- "Dashboard ภาพรวมทุกสาขา" --> PM
    MS -- "ข้อมูลผู้ใช้ (ชื่อ, อีเมล)" --> SYS
    SYS -- "คำขอยืนยันตัวตน" --> MS
    SYS -- "ข้อมูล Co-op 01 (ไฟล์ Export)" --> COOP

    classDef ext fill:#dae8fc,stroke:#6c8ebf
    classDef sys fill:#f5f5f5,stroke:#666666
    classDef core fill:#fff2cc,stroke:#d6b656,stroke-width:2px
    class STU,ADV,ADM,STF,PM ext
    class MS,COOP sys
    class SYS core
```

> **สถานประกอบการ** ไม่ได้ใช้ระบบโดยตรง — รับหนังสือและส่งแบบตอบรับผ่านนิสิต/เจ้าหน้าที่ จึงไม่อยู่ในแผนภาพ

## 2. DFD Level 1

แตกระบบออกเป็น **7 กระบวนการหลัก** และ **7 แหล่งเก็บข้อมูล**

```mermaid
flowchart LR
    MS["Microsoft Entra ID"]
    STU["นิสิต"]
    ADV["อาจารย์ที่ปรึกษา"]
    ADM["อาจารย์ประจำวิชา"]
    STF["เจ้าหน้าที่ฝ่ายฝึกงาน"]
    PM["ผู้บริหาร (*)"]
    COOP["ระบบ Co-op กลาง (*)"]

    P1("1.0 จัดการผู้ใช้และยืนยันตัวตน")
    P2("2.0 จัดการการเตรียมความพร้อม")
    P3("3.0 จัดการรุ่นและรอบออกฝึก")
    P4("4.0 จัดการ Checklist")
    P5("5.0 จัดการเอกสารราชการ")
    P6("6.0 ติดตามและรายงาน")
    P7("7.0 จัดการสหกิจศึกษา")

    D1[("D1 ผู้ใช้ / นิสิต / บุคลากร")]
    D2[("D2 CV / คอมเมนต์ CV / ชั่วโมงอบรม")]
    D3[("D3 รุ่น / รอบออกฝึก")]
    D4[("D4 Checklist / แบบฟอร์มรายสาขา / บริษัท")]
    D5[("D5 สถานะเอกสารราชการ")]
    D6[("D6 ประวัติรอบ / ใบสมัครที่ถูกปฏิเสธ")]
    D7[("D7 ประกาศ / ใบสมัครสหกิจ")]

    MS -- ข้อมูลผู้ใช้ --> P1
    ADM -- "รายชื่อนิสิต (Excel), เปิดให้แก้ชื่อ-สกุล" --> P1
    P1 --> D1
    STU -- "CV, ชั่วโมงอบรม" --> P2
    ADV -- "คอมเมนต์ CV" --> P2
    ADM -- "อนุมัติชั่วโมงอบรม, คอมเมนต์ CV" --> P2
    P2 --> D2
    STF -- "ตั้งค่ารุ่น/รอบ" --> P3
    P3 --> D3
    STU -- "Checklist + บริษัท" --> P4
    D3 -- รอบที่เปิดอยู่ --> P4
    ADV -- ผลอนุมัติ --> P4
    STF -- แบบฟอร์มรายสาขา --> P4
    P4 --> D4
    D4 -- Checklist ที่อนุมัติ --> P5
    STU -- แบบตอบรับ --> P5
    STF -- "คำสั่งออกหนังสือ / ยืนยันผล" --> P5
    P5 -- "หนังสือราชการ (PDF)" --> STF
    P5 --> D5
    P5 -- บริษัทปฏิเสธ --> D6
    STU -- "ใบสมัคร + Resume / Transcript / Portfolio" --> P7
    P7 -- "สถานะ / เอกสารหลังผ่าน" --> STU
    STF -- "ประกาศ (Excel), ผลพิจารณา, ยกเลิก, เอกสารหลังผ่าน" --> P7
    D3 -- รอบที่เปิดอยู่ --> P7
    P7 --> D7
    D1 & D2 & D4 & D5 & D7 --> P6
    P6 -- Dashboard --> ADM
    P6 -- Dashboard --> PM
    P6 -- นิสิตในความดูแล --> ADV
    P6 -- "ไฟล์ Co-op 01" --> COOP

    classDef proc fill:#fff2cc,stroke:#d6b656
    classDef store fill:#f5f5f5,stroke:#666666
    classDef ext fill:#dae8fc,stroke:#6c8ebf
    class P1,P2,P3,P4,P5,P6,P7 proc
    class D1,D2,D3,D4,D5,D6,D7 store
    class MS,STU,ADV,ADM,STF,PM,COOP ext
```

### กระบวนการ (Processes)

| รหัส | กระบวนการ | Use Case ที่เกี่ยวข้อง |
|---|---|---|
| 1.0 | จัดการผู้ใช้และยืนยันตัวตน (Users & Authentication) | เข้าสู่ระบบ, UC-15, UC-23 |
| 2.0 | จัดการการเตรียมความพร้อม (Manage Preparation) | UC-01 – UC-04 |
| 3.0 | จัดการรุ่นและรอบออกฝึก (Manage Cohorts & Windows) | UC-05, UC-12 |
| 4.0 | จัดการ Checklist (Manage Checklist) | UC-06, UC-07, UC-22 |
| 5.0 | จัดการเอกสารราชการ (Manage Official Documents) | UC-08 – UC-11 |
| 6.0 | ติดตามและรายงาน (Monitor & Report) | UC-13, UC-14 (Export รวมฝึกงาน + สหกิจ) |
| 7.0 | จัดการสหกิจศึกษา (Manage Co-op Education) | UC-19 – UC-21 |

### แหล่งเก็บข้อมูล (Data Stores)

| รหัส | ข้อมูล | ตารางในฐานข้อมูล |
|---|---|---|
| D1 | ผู้ใช้ / นิสิต / บุคลากร | `User`, `Student`, `Staff` |
| D2 | CV / คอมเมนต์ CV / ชั่วโมงอบรม | `StudentCV`, `CvComment`, `TrainingRecord` |
| D3 | รุ่น / รอบออกฝึก | `InternshipCohort`, `InternshipWindow` |
| D4 | Checklist / แบบฟอร์มรายสาขา / บริษัท | `ChecklistVersion`, `ChecklistSection`, `ChecklistItem`, `Company`, `CompanyChecklistAnswer`, `CompanySubmission`, `InternshipPlacement` |
| D5 | สถานะเอกสารราชการ | ปัจจุบันเก็บในไฟล์ JSON (มีแผนย้ายเข้า PostgreSQL) |
| D6 | ประวัติรอบ / ใบสมัครที่ถูกปฏิเสธ | ปัจจุบันเก็บในไฟล์ JSON (มีแผนย้ายเข้า PostgreSQL) |
| D7 | ประกาศ / ใบสมัครสหกิจ | `CoopPosting`, `CoopPosition`, `CoopApplication` |

> ไฟล์ .drawio: กระบวนการ 7.0 อยู่มุมซ้ายล่าง และแสดง "เจ้าหน้าที่ฝ่ายฝึกงาน \*" ซ้ำอีกกล่องเพื่อลดเส้นตัดกัน
