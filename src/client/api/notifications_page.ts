// @ts-nocheck
// notifications_page.js — หน้า /notifications (ทุกโรล) ใช้ helper จาก notification_bell.js (window.__ictNotifBell)
(function () {
  const ROLE_TEXT = {
    STUDENT: 'ติดตามผลอนุมัติ เอกสาร และกำหนดการฝึกงานของคุณ',
    ADVISOR: 'งานที่รอคุณตรวจ และความเคลื่อนไหวของนิสิตในความดูแล',
    COURSE_ADMIN: 'ความเคลื่อนไหวของนิสิตในรายวิชา/สาขาที่คุณดูแล',
    STAFF: 'เรื่องที่ต้องดำเนินการของเจ้าหน้าที่คณะ (เอกสาร แจ้งปัญหา สหกิจ)',
  };
  const ROLE_LABEL = {
    STUDENT: 'นิสิต',
    ADVISOR: 'อาจารย์ที่ปรึกษา',
    COURSE_ADMIN: 'อาจารย์ประจำวิชา',
    STAFF: 'เจ้าหน้าที่คณะ',
  };
  // คำแนะนำในช่องค้นหา: นิสิตค้นเรื่องของตัวเอง · โรลอื่นค้นชื่อ/รหัสนิสิต
  const SEARCH_HINT = {
    STUDENT: 'ค้นหาบริษัท / เรื่อง / เลขที่หนังสือ',
    ADVISOR: 'ค้นหาชื่อนิสิต / รหัส / บริษัท',
    COURSE_ADMIN: 'ค้นหาชื่อนิสิต / รหัส / บริษัท',
    STAFF: 'ค้นหาชื่อนิสิต / รหัส / เรื่อง',
  };
  const PAGE_SIZE = 20;
  const SEARCH_DELAY_MS = 350;
  const view = { status: 'all', category: '', major: '', search: '', page: 1, items: [], hasMore: false, loading: false, reqId: 0 };

  function helpers() {
    return window.__ictNotifBell;
  }

  // ตัวเลือก "ประเภท" = หมวดของโรลที่กำลังใช้งาน (จาก API) พร้อมจำนวน
  function renderCategories(categories, counts) {
    const H = helpers();
    const select = document.getElementById('ntfp-category');
    if (!select) return;
    const keys = Object.keys(categories);
    const total = keys.reduce((s, k) => s + (counts[k] || 0), 0);
    const option = (key, label, n) => `<option value="${key}"${view.category === key ? ' selected' : ''}>${H.esc(label)} (${n})</option>`;
    select.innerHTML = option('', 'ทุกประเภท', total) + keys.map((k) => option(k, categories[k], counts[k] || 0)).join('');
  }

  // ตัวเลือก "สาขา" เฉพาะ admin (อาจารย์ประจำวิชา / เจ้าหน้าที่) — majors มาเฉพาะตอนโหลดหน้าแรก
  function renderMajors(majorFilter, majors) {
    const H = helpers();
    const select = document.getElementById('ntfp-major');
    if (!select) return;
    select.hidden = !majorFilter;
    if (!majorFilter || !majors) return;
    // สาขาที่เลือกไว้ต้องอยู่ในรายการเสมอ (แม้ยอดเป็น 0)
    if (view.major && !majors.some((m) => m.name === view.major)) majors = majors.concat({ name: view.major, count: 0 });
    select.innerHTML =
      '<option value="">ทุกสาขา</option>' +
      majors.map((m) => `<option value="${H.esc(m.name)}"${view.major === m.name ? ' selected' : ''}>${H.esc(m.name)} (${m.count})</option>`).join('');
  }

  function renderTabCounts(tabCounts) {
    document.querySelectorAll('[data-count]').forEach((el) => {
      const n = tabCounts ? tabCounts[el.dataset.count] : null;
      el.textContent = n == null ? '' : `(${n})`;
    });
  }

  function isFiltered() {
    return Boolean(view.category || view.major || view.search);
  }

  function renderList() {
    const H = helpers();
    const list = document.getElementById('ntfp-list');
    const more = document.getElementById('ntfp-more');
    if (!list) return;
    if (view.items.length === 0) {
      const empty = isFiltered()
        ? { icon: 'search_off', title: 'ไม่พบการแจ้งเตือนที่ตรงกับตัวกรอง', text: 'ลองเปลี่ยนประเภทหรือคำค้นหา' }
        : view.status === 'unread'
          ? { icon: 'mark_email_read', title: 'อ่านครบทุกรายการแล้ว', text: 'ไม่มีการแจ้งเตือนที่ยังไม่อ่าน' }
          : view.status === 'read'
            ? { icon: 'drafts', title: 'ยังไม่มีรายการที่อ่านแล้ว', text: 'การแจ้งเตือนที่เปิดอ่านแล้วจะแสดงที่นี่' }
            : { icon: 'notifications_paused', title: 'ยังไม่มีการแจ้งเตือน', text: 'เมื่อมีความเคลื่อนไหวที่เกี่ยวกับคุณ ระบบจะแจ้งที่นี่' };
      list.innerHTML = `
        <div class="ntfp-empty">
          <div class="big"><span class="material-icons" aria-hidden="true">${empty.icon}</span></div>
          <h3>${empty.title}</h3>
          <p>${empty.text}</p>
        </div>`;
    } else {
      let html = '';
      let lastGroup = '';
      let open = false;
      for (const n of view.items) {
        const g = H.dayGroup(n.createdAt);
        if (g !== lastGroup) {
          if (open) html += '</ul>';
          html += `<h2 class="ntfp-group">${g}</h2><ul class="ntfp-list ict-ntf-list">`;
          open = true;
          lastGroup = g;
        }
        html += H.renderItem(n);
      }
      if (open) html += '</ul>';
      list.innerHTML = html;
    }
    if (more) more.hidden = !view.hasMore;
  }

  function renderSkeleton() {
    const list = document.getElementById('ntfp-list');
    if (list) list.innerHTML = '<ul class="ntfp-list">' + '<li class="ict-ntf-skel" style="height:64px"></li>'.repeat(5) + '</ul>';
  }

  async function load(append) {
    const H = helpers();
    if (!H || (append && view.loading)) return;
    // เปลี่ยนตัวกรองระหว่างโหลด → ใช้ผลของคำขอล่าสุดเท่านั้น
    const reqId = ++view.reqId;
    view.loading = true;
    const card = document.getElementById('ntfp-card');
    if (card) card.setAttribute('aria-busy', 'true');
    if (!append) renderSkeleton();
    try {
      const qs = new URLSearchParams({ page: String(view.page), pageSize: String(PAGE_SIZE) });
      if (view.status !== 'all') qs.set('status', view.status);
      if (view.category) qs.set('category', view.category);
      if (view.search) qs.set('q', view.search);
      if (view.major) qs.set('major', view.major);
      if (!append) qs.set('withMajors', '1');
      const data = await H.api(`/api/notifications?${qs}`);
      if (reqId !== view.reqId) return;
      view.items = append ? view.items.concat(data.items) : data.items;
      view.hasMore = data.hasMore;

      const sub = document.getElementById('ntfp-subtitle');
      if (sub) sub.textContent = `${ROLE_LABEL[data.audience] || ''} · ${ROLE_TEXT[data.audience] || ''}`;
      const totalAll = Object.values(data.categoryCounts || {}).reduce((s, n) => s + n, 0);
      const setText = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(v);
      };
      setText('ntfp-stat-unread', data.unread);
      setText('ntfp-stat-total', totalAll);
      const readAll = document.getElementById('ntfp-readall');
      if (readAll) readAll.disabled = data.unread === 0;
      const searchInput = document.getElementById('ntfp-search');
      if (searchInput && SEARCH_HINT[data.audience]) searchInput.placeholder = SEARCH_HINT[data.audience];
      renderTabCounts(data.tabCounts);
      renderCategories(data.categories || {}, data.categoryCounts || {});
      renderMajors(data.majorFilter, data.majors);
      renderList();
    } catch (err) {
      if (reqId !== view.reqId) return;
      const list = document.getElementById('ntfp-list');
      if (list) {
        list.innerHTML = `<div class="ntfp-empty"><div class="big"><span class="material-icons" aria-hidden="true">cloud_off</span></div><h3>โหลดการแจ้งเตือนไม่สำเร็จ</h3><p>กรุณาลองใหม่อีกครั้ง</p></div>`;
      }
    } finally {
      if (reqId === view.reqId) {
        view.loading = false;
        if (card) card.setAttribute('aria-busy', 'false');
      }
    }
  }

  function reload() {
    view.page = 1;
    load(false);
  }

  function init() {
    if (!helpers()) {
      // notification_bell.js ยังไม่พร้อม (โหลดตามลำดับ ปกติไม่ควรเกิด)
      setTimeout(init, 100);
      return;
    }
    document.querySelectorAll('.ntfp-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        view.status = tab.dataset.status;
        document.querySelectorAll('.ntfp-tab').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
        reload();
      });
    });
    document.getElementById('ntfp-category').addEventListener('change', (e) => {
      view.category = e.target.value || '';
      reload();
    });
    document.getElementById('ntfp-major').addEventListener('change', (e) => {
      view.major = e.target.value || '';
      reload();
    });
    let searchTimer = null;
    document.getElementById('ntfp-search').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const q = e.target.value.trim();
        if (q === view.search) return;
        view.search = q;
        reload();
      }, SEARCH_DELAY_MS);
    });
    document.getElementById('ntfp-more-btn').addEventListener('click', () => {
      // กำลังโหลดอยู่ → ไม่เลื่อนหน้า (กันข้ามหน้าเมื่อกดซ้ำ)
      if (view.loading) return;
      view.page += 1;
      load(true);
    });
    document.getElementById('ntfp-readall').addEventListener('click', async () => {
      try {
        await helpers().api('/api/notifications/read-all', 'POST');
      } catch (_) {}
      window.dispatchEvent(new CustomEvent('ict:notifications-changed'));
      reload();
    });
    document.getElementById('ntfp-list').addEventListener('click', (e) => {
      const btn = e.target.closest('.ict-ntf-item');
      if (!btn) return;
      const item = view.items.find((n) => String(n.id) === btn.dataset.id);
      if (item && !item.readAt) item.readAt = new Date().toISOString();
      helpers().openNotification(btn.dataset.id, btn.dataset.link);
      if (!btn.dataset.link) {
        btn.classList.remove('is-unread');
        btn.querySelector('.ict-ntf-dot')?.remove();
        reload();
      }
    });
    // มีการแจ้งเตือนใหม่ระหว่างเปิดหน้า (polling ของ header) → รีเฟรชรายการ
    window.addEventListener('app:data-updated', () => {
      if (!document.hidden) reload();
    });
    reload();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
