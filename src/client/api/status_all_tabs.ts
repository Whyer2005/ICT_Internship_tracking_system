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
  | "placement";

type BadgeTone = "done" | "todo" | "pending" | "fail" | "locked" | "muted";

interface UnlockState {
  ready: boolean;
  cvHasFile: boolean;
  cvStatus: string | null;
  isCvApproved: boolean;
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
  isPlacementUnlocked: boolean;
  placementStatus: string | null;
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
  const URL_TABS: string[] = ["personal", "training", "cv", "checklist", "submission", "placement"];
  const STAGE_1_TABS: string[] = ["personal", "training", "cv", "checklist-locked"];
  const DEFAULT_TAB = "personal";

  let state: UnlockState | null = null;
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
    if (!s.cvHasFile) return "ยังไม่ได้ส่ง CV";
    if (s.cvStatus === "REJECTED") return "CV ไม่ผ่าน ต้องแก้ไขและส่งใหม่";
    return "CV ยังไม่ผ่านการตรวจ";
  }

  function describe(tab: string): TabInfo {
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
        if (s.isCvApproved) return { done: true, locked: false, badge: "ผ่านแล้ว", tone: "done", reasons: [] };
        if (!s.cvHasFile) return { done: false, locked: false, badge: "ยังไม่ส่ง", tone: "todo", reasons: [] };
        if (s.cvStatus === "REJECTED") return { done: false, locked: false, badge: "ต้องแก้ไข", tone: "fail", reasons: [] };
        return { done: false, locked: false, badge: "กำลังรอตรวจ", tone: "pending", reasons: [] };
      }
      case "checklist-locked": {
        const reasons: string[] = [];
        if (!s.isTrainingComplete) reasons.push(trainingReason(s));
        if (!s.isCvApproved) reasons.push(cvReason(s));
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
        if (s.isInterviewPassed) return { done: true, locked: false, badge: "ผ่านสัมภาษณ์", tone: "done", reasons: [] };
        return { done: false, locked: false, badge: "ยังไม่ครบ", tone: "todo", reasons: [] };
      }
      case "placement": {
        if (!s.isPlacementUnlocked) {
          const reasons: string[] = [];
          if (!s.isChecklistApproved) reasons.push("ต้องมี Checklist บริษัทที่ผ่านการอนุมัติ");
          if (!s.isInterviewPassed) reasons.push("ต้องมีบริษัทที่สัมภาษณ์ผ่านแล้ว");
          return { done: false, locked: true, badge: "ล็อก", tone: "locked", reasons };
        }
        if (s.placementStatus === "APPROVED") return { done: true, locked: false, badge: "อนุมัติแล้ว", tone: "done", reasons: [] };
        if (s.placementStatus === "REJECTED") return { done: false, locked: false, badge: "ต้องแก้ไข", tone: "fail", reasons: [] };
        if (s.placementStatus) return { done: false, locked: false, badge: "กำลังรอตรวจ", tone: "pending", reasons: [] };
        return { done: false, locked: false, badge: "ยังไม่กรอก", tone: "todo", reasons: [] };
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
    if (scroll && window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function readUrlTab(): string | null {
    const tab = new URL(window.location.href).searchParams.get("tab");
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

  nav.addEventListener("click", (event) => {
    const btn = (event.target as HTMLElement | null)?.closest<HTMLElement>(".status-nav-item");
    if (!btn || btn.hidden) return;
    const tab = btn.dataset.tab || "";
    const info = describe(tab);
    // แท็บที่ล็อกยังเปิดดูเหตุผลได้ แต่ไม่เขียนลง URL
    viewingLockInfo = info.locked;
    pendingUrlTab = null;
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
