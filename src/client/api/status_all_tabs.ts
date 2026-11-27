// status_all_tabs.ts - Sidebar หมวดหมู่ของหน้า status-all (ฝั่งนิสิต)
// รับสถานะเงื่อนไขจาก status_all.ts ผ่าน event "status-all:unlock-state"
// แล้วอัปเดตเมนู/badge/สถานะล็อก + สลับ panel และซิงก์ ?tab= ใน URL

type StatusAllTab =
  | "personal"
  | "training"
  | "cv"
  | "checklist-locked"
  | "checklist"
  | "submission"
  | "coop";

type BadgeTone = "done" | "todo" | "pending" | "fail" | "locked" | "muted";

interface UnlockState {
  ready: boolean;
  cvHasFile: boolean;
  cvStatus: string | null; // NONE | WAITING (รอคอมเมนต์) | COMMENTED
  isCvApproved: boolean; // = อัปโหลด CV แล้ว (อาจารย์คอมเมนต์อย่างเดียว ไม่อนุมัติ)
  cvUnseenComments?: number;
  approvedSoftHours: number;
  approvedHardHours: number;
  requiredSoftHours: number;
  requiredHardHours: number;
  pendingTrainingCount: number;
  isTrainingComplete: boolean;
  isChecklistUnlocked: boolean;
  companyCount: number;
  isChecklistApproved: boolean;
  hasPendingChecklist: boolean;
  submissionCount: number;
  isInterviewPassed: boolean;
  isAcceptanceFinalized?: boolean;
}

interface TabInfo {
  done: boolean;
  locked: boolean;
  badge: string;
  tone: BadgeTone;
  reasons: string[];
}

type UrlMode = "push" | "replace" | null;

(function () {
  const nav = document.getElementById("status-all-nav");
  if (!nav) return;

  // แท็บที่เขียนลง ?tab= ได้ (checklist-locked เป็นหน้าข้อมูลล็อก ไม่ใส่ใน URL)
  const URL_TABS: string[] = ["personal", "training", "cv", "checklist", "submission", "coop"];
  // แท็บเก่าที่เลิกใช้แล้ว → ส่งไปแท็บใหม่ (ข้อมูลบริษัทย้ายไปอยู่ใน Checklist)
  const LEGACY_TABS: Record<string, string> = { placement: "checklist" };
  // แท็บที่เปิดได้โดยไม่ต้องรอข้อมูล (สหกิจศึกษา = ดูประกาศได้ทุกคน ทุกช่วง)
  const STAGE_1_TABS: string[] = ["personal", "training", "cv", "checklist-locked", "coop"];
  const DEFAULT_TAB = "personal";

  let state: UnlockState | null = null;
  // badge ของแท็บสหกิจ (จำนวนประกาศที่เปิดรับสมัคร) — ส่งมาจาก status_coop.js
  let coopBadge = "…";
  let coopTone: BadgeTone = "muted";
  // นิสิตมีใบสมัครสหกิจที่ยังไม่จบ -> ล็อกเมนูสถานประกอบการ (เลือกได้ทางเดียว)
  let coopActive = false;
  let activeTab: string | null = null;
  let pendingUrlTab: string | null = null;
  let viewingLockInfo = false;

  const getButton = (tab: string) =>
    nav.querySelector<HTMLElement>(`.status-nav-item[data-tab="${tab}"]`);
  const getPanel = (tab: string) =>
    document.querySelector<HTMLElement>(`.status-all-panel[data-panel="${tab}"]`);

  function isPersonalComplete(): boolean {
    const phone = document.getElementById("prof-phone") as HTMLInputElement | null;
    const email = document.getElementById("prof-lineId") as HTMLInputElement | null;
    if (!phone || !email) return false;
    return Boolean(phone.value.trim() && email.value.trim() && phone.checkValidity() && email.checkValidity());
  }

  function trainingReason(s: UnlockState): string {
    return `ชั่วโมงอบรมยังไม่ครบ (Soft ${s.approvedSoftHours}/${s.requiredSoftHours} · Hard ${s.approvedHardHours}/${s.requiredHardHours})`;
  }

  function cvReason(s: UnlockState): string {
    return s.cvHasFile ? "" : "ยังไม่ได้อัปโหลด Resume (CV)";
  }

  function describe(tab: string): TabInfo {
    // แท็บดูประกาศ: ไม่ล็อก และไม่นับเป็นขั้นที่ต้องทำให้เสร็จ (done = ข้ามตอนหาแท็บถัดไป)
    if (tab === "coop") return { done: true, locked: false, badge: coopBadge, tone: coopTone, reasons: [] };
    if (tab === "checklist" && coopActive) {
      return { done: false, locked: true, badge: "เลือกสหกิจแล้ว", tone: "locked", reasons: ["คุณสมัครสหกิจศึกษาอยู่ (เลือกได้ทางเดียว)"] };
    }
    const s = state;
    if (!s) return { done: false, locked: tab === "checklist-locked" || !STAGE_1_TABS.includes(tab), badge: "…", tone: "muted", reasons: [] };

    switch (tab as StatusAllTab) {
      case "personal": {
        const done = isPersonalComplete();
        return { done, locked: false, badge: done ? "ครบแล้ว" : "ยังไม่ครบ", tone: done ? "done" : "todo", reasons: [] };
      }
      case "training": {
        if (s.isTrainingComplete) return { done: true, locked: false, badge: "ผ่านครบ", tone: "done", reasons: [] };
        if (s.pendingTrainingCount > 0) return { done: false, locked: false, badge: "กำลังรอตรวจ", tone: "pending", reasons: [] };
        return { done: false, locked: false, badge: `${s.approvedSoftHours + s.approvedHardHours}/${s.requiredSoftHours + s.requiredHardHours} ชม.`, tone: "todo", reasons: [] };
      }
      case "cv": {
        // อาจารย์ไม่อนุมัติ CV แล้ว — อัปโหลดแล้ว = ผ่านขั้นนี้ · มีคอมเมนต์ที่ยังไม่อ่าน = ป้ายเตือน
        if (!s.cvHasFile) return { done: false, locked: false, badge: "ยังไม่ส่ง", tone: "todo", reasons: [] };
        if ((s.cvUnseenComments || 0) > 0) return { done: true, locked: false, badge: "มีคอมเมนต์ใหม่", tone: "pending", reasons: [] };
        if (s.cvStatus === "COMMENTED") return { done: true, locked: false, badge: "มีคอมเมนต์", tone: "done", reasons: [] };
        return { done: true, locked: false, badge: "ส่งแล้ว", tone: "done", reasons: [] };
      }
      case "checklist-locked": {
        const reasons: string[] = [];
        if (!s.isTrainingComplete) reasons.push(trainingReason(s));
        if (!s.cvHasFile) reasons.push(cvReason(s));
        return { done: false, locked: !s.isChecklistUnlocked, badge: "ล็อก", tone: "locked", reasons };
      }
      case "checklist": {
        if (!s.isChecklistUnlocked) return { done: false, locked: true, badge: "ล็อก", tone: "locked", reasons: [] };
        if (s.isChecklistApproved) return { done: true, locked: false, badge: "ผ่านแล้ว", tone: "done", reasons: [] };
        if (s.hasPendingChecklist) return { done: false, locked: false, badge: "กำลังรอตรวจ", tone: "pending", reasons: [] };
        return { done: false, locked: false, badge: "ยังไม่ครบ", tone: "todo", reasons: [] };
      }
      case "submission": {
        if (!s.isChecklistUnlocked) return { done: false, locked: true, badge: "ล็อก", tone: "locked", reasons: [] };
        // เจ้าหน้าที่ยืนยันใบตอบรับแล้ว → ผ่านแล้ว
        if (s.isAcceptanceFinalized) return { done: true, locked: false, badge: "ผ่านแล้ว", tone: "done", reasons: [] };
        if (s.isInterviewPassed) return { done: true, locked: false, badge: "ผ่านสัมภาษณ์", tone: "done", reasons: [] };
        return { done: false, locked: false, badge: "ยังไม่ครบ", tone: "todo", reasons: [] };
      }
      default:
        return { done: false, locked: false, badge: "", tone: "muted", reasons: [] };
    }
  }

  function isTabVisible(tab: string): boolean {
    const btn = getButton(tab);
    return Boolean(btn && !btn.hidden);
  }

  // แท็บแรกที่ยังไม่เสร็จและไม่ล็อก (ใช้ตอน redirect จากแท็บที่เข้าไม่ได้)
  function firstIncompleteTab(): string {
    for (const tab of URL_TABS) {
      if (!isTabVisible(tab)) continue;
      const info = describe(tab);
      if (!info.locked && !info.done) return tab;
    }
    return DEFAULT_TAB;
  }

  function render(): void {
    const unlocked = Boolean(state && state.isChecklistUnlocked);
    nav!.querySelectorAll<HTMLElement>(".status-nav-item").forEach((btn) => {
      const tab = btn.dataset.tab || "";
      const stage = btn.dataset.stage;
      // stage 1 = ก่อนปลดล็อก checklist, stage 2 = หลังปลดล็อก
      if (stage === "1") btn.hidden = unlocked;
      if (stage === "2") btn.hidden = !unlocked;

      const info = describe(tab);
      btn.dataset.locked = info.locked ? "true" : "false";

      const icon = btn.querySelector<HTMLElement>(".status-nav-icon");
      if (icon) {
        if (!icon.dataset.defaultIcon) icon.dataset.defaultIcon = icon.textContent || "";
        icon.textContent = info.locked ? "lock" : icon.dataset.defaultIcon;
      }

      const badge = btn.querySelector<HTMLElement>(".status-nav-badge");
      if (badge) {
        badge.textContent = info.badge;
        badge.dataset.tone = info.tone;
      }

      const reason = btn.querySelector<HTMLElement>(".status-nav-reason");
      if (reason) {
        reason.textContent = info.locked ? info.reasons.join(" · ") : "";
        reason.hidden = !reason.textContent;
      }

      const label = btn.querySelector(".status-nav-label")?.textContent || "";
      btn.title = info.locked && info.reasons.length ? `${label} — ล็อกอยู่: ${info.reasons.join(", ")}` : label;
    });
  }

  function writeUrl(tab: string, mode: UrlMode): void {
    if (!URL_TABS.includes(tab)) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") === tab) return;
    url.searchParams.set("tab", tab);
    if (mode === "push") window.history.pushState({ statusAllTab: tab }, "", url);
    else window.history.replaceState({ statusAllTab: tab }, "", url);
  }

  function showTab(tab: string, { urlMode = null, scroll = false }: { urlMode?: UrlMode; scroll?: boolean } = {}): void {
    if (!getPanel(tab)) tab = DEFAULT_TAB;
    activeTab = tab;

    document.querySelectorAll<HTMLElement>(".status-all-panel").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.panel === tab);
    });
    nav!.querySelectorAll<HTMLElement>(".status-nav-item").forEach((btn) => {
      btn.setAttribute("aria-current", btn.dataset.tab === tab ? "page" : "false");
    });

    if (urlMode) writeUrl(tab, urlMode);
    // แจ้ง status_all.js ว่าเปิดแท็บไหน (เช่น เปิดแท็บ CV = อ่านคอมเมนต์แล้ว)
    window.dispatchEvent(new CustomEvent("status-all:tab-shown", { detail: { tab } }));
    if (scroll && window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function readUrlTab(): string | null {
    const raw = new URL(window.location.href).searchParams.get("tab");
    const tab = raw && LEGACY_TABS[raw] ? LEGACY_TABS[raw] : raw;
    return tab && URL_TABS.includes(tab) ? tab : null;
  }

  function resolveUrlTab(tab: string | null): void {
    if (tab && isTabVisible(tab) && !describe(tab).locked) {
      showTab(tab, { urlMode: "replace" });
    } else if (tab) {
      showTab(firstIncompleteTab(), { urlMode: "replace" });
    } else {
      showTab(DEFAULT_TAB);
    }
  }

  // ให้ sidebar sticky อยู่ใต้ header ตามความสูงจริง
  const shell = document.querySelector<HTMLElement>(".status-all-shell");
  const headerEl = document.getElementById("header-placeholder");
  if (shell && headerEl) {
    const syncHeaderHeight = () => {
      shell.style.setProperty("--status-header-height", `${headerEl.offsetHeight || 70}px`);
    };
    syncHeaderHeight();
    if (window.ResizeObserver) new ResizeObserver(syncHeaderHeight).observe(headerEl);
  }

  // มือถือ/แท็บเล็ต (≤900px): sidebar เป็นลิ้นชักเลื่อนจากซ้าย — ปิดอยู่จะเห็นแถบจับ (เส้น ๆ) ที่ขอบซ้าย
  // คืน { close } ให้ตัวจัดการคลิกของ nav ปิดลิ้นชักก่อนสลับแท็บ
  function createStatusDrawer(shellEl: HTMLElement, sidebar: HTMLElement): { close: () => void } {
    const drawerMq = window.matchMedia("(max-width: 900px)");
    const root = document.documentElement;
    sidebar.id = sidebar.id || "status-all-sidebar";

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "status-drawer-handle";
    handle.setAttribute("aria-label", "เปิดเมนูหมวดหมู่");
    handle.setAttribute("aria-controls", sidebar.id);
    handle.setAttribute("aria-expanded", "false");
    handle.innerHTML = "<span></span><span></span>";

    const backdrop = document.createElement("div");
    backdrop.className = "status-drawer-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    shellEl.append(handle, backdrop);

    const isOpen = () => shellEl.classList.contains("is-drawer-open");

    // ล็อกการเลื่อนหน้าด้วย class บน <html> (แยกจาก body.style.overflow ที่ modal อื่นใช้ → ไม่ทับ/ปลดล็อกกันเอง)
    const setDrawer = (open: boolean) => {
      if (open === isOpen()) return;
      if (open && !drawerMq.matches) return;
      shellEl.classList.toggle("is-drawer-open", open);
      root.classList.toggle("status-drawer-scroll-lock", open);
      handle.setAttribute("aria-expanded", String(open));
      if (open) {
        nav!.querySelector<HTMLElement>('.status-nav-item[aria-current="page"]')?.focus({ preventScroll: true });
      } else if (sidebar.contains(document.activeElement)) {
        // โฟกัสค้างอยู่ในลิ้นชักที่ซ่อนแล้ว → ย้ายกลับไปที่แถบจับ
        handle.focus({ preventScroll: true });
      }
    };

    handle.addEventListener("click", () => setDrawer(true));
    backdrop.addEventListener("click", () => setDrawer(false));

    document.addEventListener("keydown", (e) => {
      if (!isOpen()) return;
      // มี overlay อื่น (lightbox/modal) อยู่บนลิ้นชักและถือโฟกัสอยู่ → ไม่ยุ่ง
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body && !sidebar.contains(active)) return;
      if (e.key === "Escape") {
        setDrawer(false);
        return;
      }
      // กัก Tab ไว้ในลิ้นชักระหว่างเปิด
      if (e.key === "Tab") {
        const items = Array.from(
          sidebar.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
        ).filter((el) => !el.hidden && el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (active === first || !sidebar.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !sidebar.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // ขยายจอเกิน 900px ขณะลิ้นชักเปิด → ปิด แล้วกลับเป็น sidebar ปกติ (Safari < 14 มีแค่ addListener)
    const onMqChange = () => {
      if (!drawerMq.matches && isOpen()) setDrawer(false);
    };
    if (drawerMq.addEventListener) drawerMq.addEventListener("change", onMqChange);
    else drawerMq.addListener(onMqChange);

    // ปัดซ้ายบนลิ้นชักเพื่อปิด (ไม่มีปัดจากขอบจอเพื่อเปิด เพราะชนกับท่าทาง "ย้อนกลับ" ของ iOS/Android — เปิดด้วยแถบจับ)
    let touchX: number | null = null;
    let touchY = 0;
    sidebar.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      touchX = isOpen() ? t.clientX : null;
      touchY = t.clientY;
    }, { passive: true });
    sidebar.addEventListener("touchend", (e) => {
      if (touchX === null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchX;
      const dy = Math.abs(t.clientY - touchY);
      touchX = null;
      if (dy < Math.abs(dx) && dx < -50) setDrawer(false);
    }, { passive: true });

    return { close: () => setDrawer(false) };
  }

  const sidebarEl = document.querySelector<HTMLElement>(".status-all-sidebar");
  const drawer = shell && sidebarEl ? createStatusDrawer(shell, sidebarEl) : null;

  nav.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement | null)?.closest<HTMLElement>(".status-nav-item");
    if (!btn || btn.hidden) return;
    const tab = btn.dataset.tab || "";
    const info = describe(tab);
    // แท็บที่ล็อกยังเปิดดูเหตุผลได้ แต่ไม่เขียนลง URL
    viewingLockInfo = info.locked;
    pendingUrlTab = null;
    // มือถือ: ปิดลิ้นชัก (ปลดล็อกการเลื่อน) ก่อน แล้วค่อยเลื่อนขึ้นบนสุด
    drawer?.close();
    showTab(tab, { urlMode: info.locked ? null : "push", scroll: true });
  });

  window.addEventListener("popstate", () => {
    viewingLockInfo = false;
    const tab = readUrlTab();
    if (!state || !state.ready) {
      pendingUrlTab = tab;
      if (!tab || STAGE_1_TABS.includes(tab)) showTab(tab || DEFAULT_TAB);
      return;
    }
    resolveUrlTab(tab);
  });

  window.addEventListener("status-all:unlock-state", (event) => {
    const wasReady = Boolean(state && state.ready);
    state = (event as CustomEvent<UnlockState>).detail || null;
    render();
    if (!state || !state.ready) return;

    // โหลดข้อมูลครบรอบแรก: ตัดสินแท็บจาก URL ที่รอไว้
    if (!wasReady) {
      const tab = pendingUrlTab;
      pendingUrlTab = null;
      if (tab) resolveUrlTab(tab);
      return;
    }

    if (activeTab === "checklist-locked" && state.isChecklistUnlocked) {
      viewingLockInfo = false;
      showTab("checklist", { urlMode: "replace" });
    } else if (activeTab && (!isTabVisible(activeTab) || (describe(activeTab).locked && !viewingLockInfo))) {
      showTab(firstIncompleteTab(), { urlMode: "replace" });
    }
  });

  window.addEventListener("status-all:coop-count", (event) => {
    const d = (event as CustomEvent<{ openCount: number; applicationStatus: string | null; chosenInternship: boolean }>).detail || ({} as any);
    const n = Number(d.openCount) || 0;
    const appStatus = d.applicationStatus || null;
    coopActive = Boolean(appStatus);
    if (appStatus === "ACCEPTED") [coopBadge, coopTone] = ["ผ่านแล้ว", "done"];
    else if (appStatus === "SENT_TO_COMPANY") [coopBadge, coopTone] = ["ส่งบริษัทแล้ว", "pending"];
    else if (appStatus) [coopBadge, coopTone] = ["รอพิจารณา", "pending"];
    else if (d.chosenInternship) [coopBadge, coopTone] = ["เลือกฝึกงานแล้ว", "muted"];
    else [coopBadge, coopTone] = [n > 0 ? `${n} เปิดรับ` : "ดูประกาศ", "muted"];
    render();
  });

  ["prof-phone", "prof-lineId"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.addEventListener("input", render);
  });

  // แท็บ stage 2 จาก URL ต้องรอข้อมูลก่อนจึงจะรู้ว่าเข้าได้หรือไม่
  const initialTab = readUrlTab();
  if (initialTab && !STAGE_1_TABS.includes(initialTab)) {
    pendingUrlTab = initialTab;
    showTab(initialTab);
    document.querySelector(".status-all-shell")?.classList.add("is-resolving");
  } else {
    showTab(initialTab || DEFAULT_TAB);
  }

  window.addEventListener("status-all:unlock-state", function clearResolving(event) {
    if ((event as CustomEvent<UnlockState>).detail?.ready) {
      document.querySelector(".status-all-shell")?.classList.remove("is-resolving");
      window.removeEventListener("status-all:unlock-state", clearResolving);
    }
  });

  render();
})();
