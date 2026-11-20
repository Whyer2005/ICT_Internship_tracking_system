// ดึงรายชื่ออาจารย์/เจ้าหน้าที่คณะ ICT จาก Microsoft Graph (Entra ID ของมหาวิทยาลัย) มาเก็บเป็นไฟล์ JSON
//
// ต้องให้ IT กลางเพิ่มสิทธิ์ "Application" ให้แอป (MS_CLIENT_ID) + กด Grant admin consent ก่อน:
//   - User.Read.All           (กรองตาม department)  หรือ
//   - GroupMember.Read.All    (ดึงจากกลุ่มบุคลากร ICT) + Group.Read.All ถ้าจะใช้ --find-groups
//
// ใช้งาน:
//   npx tsx scripts/fetch-ict-staff.ts --check                          ดูว่าแอปได้สิทธิ์อะไรแล้ว (ไม่ดึงข้อมูลคน)
//   npx tsx scripts/fetch-ict-staff.ts --find-groups=ICT                ค้นหากลุ่มที่ชื่อมีคำว่า ICT (เอา id ไปใช้ต่อ)
//   npx tsx scripts/fetch-ict-staff.ts --group=<groupId>                ดึงสมาชิกของกลุ่ม
//   npx tsx scripts/fetch-ict-staff.ts --department="คณะเทคโนโลยีสารสนเทศและการสื่อสาร"
//
// ผลลัพธ์: data/ict_staff_directory.json (อยู่ใน .gitignore — ข้อมูลบุคคล ห้าม commit)
// ตั้งใจไม่รองรับการดึงผู้ใช้ "ทั้งมหาวิทยาลัย" แบบไม่กรอง (PDPA: เก็บเท่าที่จำเป็น)
import fs from "fs";
import path from "path";
import { msalClient } from "../src/auth/msalConfig";

const GRAPH = "https://graph.microsoft.com/v1.0";
const OUT_FILE = path.join(process.cwd(), "data", "ict_staff_directory.json");
// เก็บเฉพาะฟิลด์ที่ระบบต้องใช้
const SELECT = "id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,officeLocation";

function arg(name: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : undefined;
}

async function getToken(): Promise<string> {
  const res = await msalClient.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });
  if (!res?.accessToken) throw new Error("ขอ token ไม่สำเร็จ (ตรวจ MS_CLIENT_ID / MS_TENANT_ID / MS_CLIENT_SECRET ใน .env)");
  return res.accessToken;
}

function tokenRoles(token: string): string[] {
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
  return payload.roles || [];
}

async function graphGetAll(token: string, url: string, eventual = false): Promise<any[]> {
  const items: any[] = [];
  let next: string | undefined = url;
  while (next) {
    const res = await fetch(next, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(eventual ? { ConsistencyLevel: "eventual" } : {}),
      },
    });
    const body: any = await res.json();
    if (!res.ok) {
      throw new Error(`Graph ${res.status}: ${body?.error?.code} — ${body?.error?.message}`);
    }
    items.push(...(body.value || []));
    next = body["@odata.nextLink"];
  }
  return items;
}

// บัญชีนิสิตใช้รหัสนิสิต 8 หลักเป็นอีเมล (เช่น 67xxxxxx@up.ac.th) — ตัดออก เก็บเฉพาะบุคลากร
function isStudentAccount(u: any): boolean {
  return /^\d{8}@/.test(String(u.userPrincipalName || u.mail || ""));
}

async function main() {
  const token = await getToken();
  const roles = tokenRoles(token);

  if (process.argv.includes("--check")) {
    console.log("สิทธิ์ (Application permissions) ที่แอปได้รับตอนนี้:");
    console.log(roles.length ? roles.map((r) => "  - " + r).join("\n") : "  (ไม่มี — ต้องให้ IT เพิ่มสิทธิ์และกด Grant admin consent)");
    return;
  }

  const findGroups = arg("find-groups");
  const groupId = arg("group");
  const department = arg("department");

  if (findGroups) {
    const q = encodeURIComponent(`"displayName:${findGroups}"`);
    const groups = await graphGetAll(token, `${GRAPH}/groups?$search=${q}&$select=id,displayName,description&$top=50`, true);
    console.log(`พบ ${groups.length} กลุ่ม:`);
    groups.forEach((g) => console.log(`  ${g.id}  ${g.displayName}${g.description ? "  — " + g.description : ""}`));
    return;
  }

  let users: any[];
  let source: string;
  if (groupId) {
    users = await graphGetAll(token, `${GRAPH}/groups/${groupId}/transitiveMembers/microsoft.graph.user?$select=${SELECT}&$top=999`);
    source = `group:${groupId}`;
  } else if (department) {
    const filter = encodeURIComponent(`department eq '${department.replace(/'/g, "''")}'`);
    users = await graphGetAll(token, `${GRAPH}/users?$filter=${filter}&$count=true&$select=${SELECT}&$top=999`, true);
    source = `department:${department}`;
  } else {
    console.log("ต้องระบุ --group=<id> หรือ --department=\"...\" (หรือ --check / --find-groups=...)");
    process.exitCode = 1;
    return;
  }

  const staff = users
    .filter((u) => !isStudentAccount(u))
    .map((u) => ({
      msId: u.id,
      name: u.displayName || [u.givenName, u.surname].filter(Boolean).join(" "),
      email: String(u.mail || u.userPrincipalName || "").toLowerCase(),
      jobTitle: u.jobTitle || null,
      department: u.department || null,
      office: u.officeLocation || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify({ fetchedAt: new Date().toISOString(), source, count: staff.length, staff }, null, 2),
    "utf8"
  );
  console.log(`ได้รายชื่อ ${staff.length} คน (ตัดบัญชีนิสิตออก ${users.length - staff.length} บัญชี) → ${OUT_FILE}`);
}

main().catch((err) => {
  console.error("ผิดพลาด:", err.message || err);
  process.exitCode = 1;
});
