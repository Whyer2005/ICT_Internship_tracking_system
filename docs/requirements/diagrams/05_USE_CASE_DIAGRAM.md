# 05 · Use Case Diagram (แผนภาพยูสเคส)

> แผนภาพรวมของ Use Case 16 ข้อใน [03_USE_CASES.md](../03_USE_CASES.md) · ผู้ใช้ 5 บทบาท + ระบบภายนอก 2 ระบบ
> ไฟล์ที่แก้ไขและ Export เป็นรูปได้: [use_case_diagram.drawio](use_case_diagram.drawio)
> อาจารย์นิเทศก์ยังไม่ใส่ในแผนภาพ — รอเคาะในที่ประชุม ([OI-04](../04_OPEN_ISSUES.md#oi-04))

## แผนภาพ

```mermaid
flowchart LR
    STU["👤 นิสิต<br/>(Student)"]
    ADV["👤 อาจารย์ที่ปรึกษา<br/>(Advisor)"]

    subgraph SYS["ระบบติดตามการฝึกงาน คณะ ICT (ICT Internship Tracking System)"]
        direction TB
        UC00(["เข้าสู่ระบบ<br/>(Login)"])
        subgraph G1["1. เตรียมความพร้อม (Preparation)"]
            UC01(["UC-01 อัปโหลด/แก้ไข CV<br/>(Upload CV)"])
            UC03(["UC-03 บันทึกชั่วโมงอบรม<br/>(Record Training Hours)"])
            UC02(["UC-02 ตรวจและอนุมัติ CV<br/>(Review CV)"])
            UC04(["UC-04 อนุมัติชั่วโมงอบรม<br/>(Approve Training Hours)"])
            UC16(["UC-16 ลงทะเบียนอบรม/สแกน QR (*) ⏸<br/>(Training Check-in)"])
        end
        subgraph G2["2. ตั้งค่ารุ่น/รอบ และผู้ใช้ (Setup)"]
            UC15(["UC-15 นำเข้ารายชื่อนิสิต/กำหนดที่ปรึกษา<br/>(Import Students)"])
            UC05(["UC-05 สร้างรุ่นและเปิด/ปิดรอบออกฝึก<br/>(Manage Cohorts & Windows)"])
            UC05X(["เปิดต่อพิเศษ<br/>(Extend Window)"])
        end
        subgraph G3["3. Checklist สถานประกอบการ (Checklist)"]
            UC06(["UC-06 ยื่น Checklist<br/>(Submit Checklist)"])
            UC06I(["ผูกรอบออกฝึกอัตโนมัติ<br/>(Auto-assign Window)"])
            UC07(["UC-07 อนุมัติ/ตีกลับ Checklist<br/>(Review Checklist)"])
        end
        subgraph G4["4. เอกสารราชการ (Official Documents)"]
            UC08(["UC-08 ออกหนังสือขอความอนุเคราะห์<br/>(Issue Request Letter)"])
            UC09(["UC-09 อัปโหลดแบบตอบรับ<br/>(Upload Acceptance Form)"])
            UC10(["UC-10 ตรวจ/ยืนยันแบบตอบรับ<br/>(Verify Acceptance Form)"])
            UC10I(["อ่านแบบตอบรับด้วย OCR<br/>(OCR Reading)"])
            UC11(["UC-11 ออกหนังสือส่งตัว<br/>(Issue Dispatch Letter)"])
        end
        subgraph G5["5. รอบที่ 2 / ติดตาม / ส่งต่อ (Round 2, Monitoring, Export)"]
            UC12(["UC-12 ฝึกงานรอบที่ 2 / ตกค้าง<br/>(Round 2 / Retest)"])
            UC13(["UC-13 ติดตามผ่าน Dashboard (*)<br/>(Monitor Dashboard)"])
            UC14(["UC-14 Export Co-op 01 (*)<br/>(Export to Co-op System)"])
        end
    end

    ADM["👤 อาจารย์ประจำวิชา<br/>(Course Admin)"]
    STF["👤 เจ้าหน้าที่ฝ่ายฝึกงาน<br/>(Staff)"]
    PM["👤 ผู้บริหาร (PM) (*)<br/>(Executive)"]
    MS["«system»<br/>Microsoft Entra ID"]
    COOP["«system»<br/>ระบบ Co-op กลาง"]

    STU --- UC01 & UC03 & UC16 & UC06 & UC09 & UC12
    ADV --- UC02 & UC04 & UC07 & UC10 & UC13
    UC02 & UC04 & UC15 & UC05 & UC12 & UC13 --- ADM
    UC16 & UC15 & UC05 & UC08 & UC10 & UC11 & UC12 & UC13 & UC14 --- STF
    UC13 -.- PM
    UC00 --- MS
    UC14 --- COOP

    UC06 -. "«include»" .-> UC06I
    UC10 -. "«include»" .-> UC10I
    UC05X -. "«extend»" .-> UC05

    classDef actor fill:#dae8fc,stroke:#6c8ebf,font-weight:bold
    classDef ext fill:#f5f5f5,stroke:#666666
    classDef red fill:#f8cecc,stroke:#b85450,stroke-width:2px
    classDef sub fill:#f5f5f5,stroke:#999999
    class STU,ADV,ADM,STF,PM actor
    class MS,COOP ext
    class UC13,UC14,UC16 red
    class UC05X,UC06I,UC10I sub
```

> **หมายเหตุ:** บน GitHub แผนภาพนี้จัดวางอัตโนมัติ เส้นอาจตัดกันบ้าง — ฉบับจัดวางสวยสำหรับสไลด์/เล่ม ให้ใช้ไฟล์ `.drawio` (สีเส้นแยกตามผู้ใช้)

## วิธีอ่าน

| สัญลักษณ์ | ความหมาย |
|---|---|
| 👤 รูปคน | ผู้ใช้ (Actor) |
| «system» | ระบบภายนอกที่เชื่อมต่อ |
| วงรี | Use Case (สิ่งที่ผู้ใช้ทำในระบบ) |
| เส้นทึบ | ผู้ใช้ทำ Use Case นั้นได้ |
| เส้นประ «include» | Use Case หลักเรียก Use Case ย่อยทุกครั้ง |
| เส้นประ «extend» | Use Case เสริมที่เกิดขึ้นเฉพาะบางกรณี |
| กรอบแดง (*) | ยังต้องเคาะในที่ประชุม — ดู [04_OPEN_ISSUES.md](../04_OPEN_ISSUES.md) |
| ⏸ | พักไว้ (ระยะถัดไป) |

## ผู้ใช้กับ Use Case (สรุป)

| ผู้ใช้ | Use Case |
|---|---|
| นิสิต | UC-01, 03, 06, 09, 12, 16 |
| อาจารย์ที่ปรึกษา | UC-02, 04, 07, 10, 13 |
| อาจารย์ประจำวิชา | UC-02, 04, 05, 12, 13, 15 |
| เจ้าหน้าที่ฝ่ายฝึกงาน | UC-05, 08, 10, 11, 12, 13, 14, 15, 16 |
| ผู้บริหาร (\*) | UC-13 |
| Microsoft Entra ID | เข้าสู่ระบบ |
| ระบบ Co-op กลาง | UC-14 |
