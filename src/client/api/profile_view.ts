// @ts-nocheck
// profile_view.js - แสดงข้อมูลโปรไฟล์นิสิต (Proflie.html)

// ชื่อเต็ม "หลักสูตร... สาขาวิชา..." จาก <script id="ict-majors-data"> (ต้นทาง: src/utils/majors.ts)
function ictMajorFullName(raw) {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '-';
  let majors = [];
  try {
    const el = document.getElementById('ict-majors-data');
    majors = el ? JSON.parse(el.textContent || '[]') : [];
  } catch (e) {
    majors = [];
  }
  const found = majors.find((m) => m.code.toLowerCase() === v)
    || majors.find((m) => m.keywords.some((k) => v.includes(k.toLowerCase())));
  return found ? found.fullName : raw;
}

fetch('/api/student/profile')
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            if (data.user) document.getElementById('p-email').value = data.user.email || '-';
            if (data.student) {
                const s = data.student;
                document.getElementById('p-advisor').value = s.advisor?.name || '-';
                document.getElementById('p-nameTh').value = s.nameTh || '-';
                document.getElementById('p-nameEn').value = s.nameEn || '-';
                document.getElementById('p-studentCode').value = s.studentCode || '-';
                document.getElementById('p-year').value = s.year || '-';
                document.getElementById('p-gpa').value = s.gpa ? Number(s.gpa).toFixed(2) : '-';
                document.getElementById('p-major').value = ictMajorFullName(s.major || 'วิศวกรรมซอฟต์แวร์');
                document.getElementById('p-phone').value = s.phone || '-';
                const elLine = document.getElementById('p-lineId'); if (elLine) elLine.value = s.lineId || '-';
                const elFb = document.getElementById('p-facebook'); if (elFb) elFb.value = s.facebook || '-';

                if (s.profileImageUrl) {
                    const photo = document.getElementById('p-photo');
                    photo.src = s.profileImageUrl;
                    photo.style.display = 'block';
                    document.getElementById('p-icon').style.display = 'none';
                }
            }
        }
    })
    .catch(err => console.error('Error fetching profile:', err));
