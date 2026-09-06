import type { AcceptanceSnapshot, AcceptanceItemSnapshot } from "@/ai/assistantAcceptance";
import { focusEditorRegion } from "@/editor/editorReferenceNavigation";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { deckIcon } from "./aiDeckIcons";

const STATUS = {
  pending: "대기", working: "작업 중", verifying: "검증 중", verified: "검증 완료", blocked: "진행 막힘",
} as const;

function createItem() {
  let item: AcceptanceItemSnapshot | null = null;
  const mark = el("span", { class: "ai-sticky-mark", attrs: { "aria-hidden": "true" }, children: [deckIcon("check")] });
  mark.querySelector("path")?.setAttribute("pathLength", "1");
  const title = el("span", { class: "ai-sticky-item-title" });
  const status = el("span", { class: "ai-sticky-item-status" });
  const summary = el("summary", { children: [mark, title, status] });
  const reason = el("p", { class: "ai-sticky-reason" });
  const evidence = el("div", { class: "ai-sticky-evidence", dataset: { testid: "ai-sticky-evidence" } });
  const navigate = el("button", {
    class: "ai-sticky-navigate", attrs: { type: "button" }, dataset: { testid: "ai-sticky-navigate" },
    children: [deckIcon("pin"), el("span", { text: "맵에서 보기" })],
    on: { click: () => {
      const map = item?.mapId ? store.getCurrent().maps[item.mapId] : undefined;
      if (!map || !item) return;
      focusEditorRegion({ mapId: map.id, ...(item.region ?? { x: 0, y: 0, w: map.width, h: map.height }) }, { highlight: true });
    } },
  });
  const detail = el("div", { class: "ai-sticky-item-detail", children: [reason, evidence, navigate] });
  const root = el("details", { class: "ai-sticky-item", dataset: { testid: "ai-sticky-item" }, children: [summary, detail] });
  return { root, update(next: AcceptanceItemSnapshot) {
    item = next;
    root.dataset.itemId = next.id;
    root.dataset.status = next.status;
    title.textContent = next.title;
    status.textContent = STATUS[next.status];
    reason.textContent = next.reason ?? "";
    reason.hidden = !next.reason;
    evidence.replaceChildren(...next.evidence.map((entry) => el("dl", {
      dataset: { passed: String(entry.passed) },
      children: [el("dt", { text: "기대" }), el("dd", { text: entry.expected }),
        el("dt", { text: "확인" }), el("dd", { text: entry.observed }),
        el("dt", { text: "판정" }), el("dd", { text: entry.passed ? "충족" : "미충족" })],
    })));
    const map = next.mapId ? store.getCurrent().maps[next.mapId] : undefined;
    navigate.hidden = !next.mapId;
    navigate.disabled = !map;
    navigate.title = map ? map.name : "현재 프로젝트에 맵이 없습니다";
  } };
}

/** Read-only projection. The panel owns mount/clear; the backend owns every status. */
export function createAiStickyChecklist() {
  let snapshot: AcceptanceSnapshot | null = null;
  let manualExpanded: boolean | null = null;
  let activityText = "";
  let disposed = false;
  // Match the panel's headless DOM contract: viewport APIs are optional.
  const viewport = typeof window === "undefined" ? null : window;
  const compact = viewport?.matchMedia?.("(max-width: 1100px), (max-height: 700px)");
  const rows = new Map<string, ReturnType<typeof createItem>>();
  const goal = el("span", { class: "ai-sticky-goal" });
  const count = el("span", { class: "ai-sticky-count", dataset: { testid: "ai-sticky-count" } });
  const chevron = deckIcon("chevron-down");
  const toggle = el("button", {
    class: "ai-sticky-toggle", attrs: { type: "button" }, dataset: { testid: "ai-sticky-toggle" },
    children: [goal, count, chevron], on: { click: () => {
      manualExpanded = toggle.getAttribute("aria-expanded") !== "true";
      syncExpanded();
    } },
  });
  const status = el("span", { class: "ai-sticky-status" });
  const header = el("header", { class: "ai-sticky-header", children: [
    el("div", { class: "ai-sticky-caption", children: [el("span", { text: "완료 기준" }), status] }), toggle,
  ] });
  const activity = el("p", { class: "ai-sticky-activity", attrs: { role: "status", "aria-live": "polite" } });
  const list = el("div", { class: "ai-sticky-list" });
  const body = el("div", { class: "ai-sticky-body", children: [activity, list] });
  const root = el("aside", {
    class: "ai-sticky-checklist", attrs: { "aria-label": "AI 완료 기준", "data-editor-navigation-owner": "true" },
    dataset: { testid: "ai-sticky-checklist" }, children: [header, body],
  });
  function syncExpanded() {
    const expanded = manualExpanded ?? !compact?.matches;
    if (!expanded && body.contains(document.activeElement)) toggle.focus();
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-label", `${snapshot?.goal ?? "완료 기준"} · ${count.textContent} · ${expanded ? "접기" : "펼치기"}`);
    root.dataset.expanded = String(expanded);
    body.hidden = !expanded;
  }
  function syncActivity() {
    const current = snapshot?.items.find((item) => item.status === "working" || item.status === "verifying");
    activity.textContent = activityText || (current ? `${STATUS[current.status]} · ${current.title}` : snapshot ? STATUS[snapshot.status] : "");
  }
  function measureTop() {
    const toolbar = document.querySelector(".canvas-toolbar");
    const bottom = toolbar?.getBoundingClientRect().bottom;
    if (bottom && bottom > 0) root.style.setProperty("--ai-sticky-toolbar-bottom", `${bottom}px`);
  }
  const toolbarObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measureTop);
  const toolbar = document.querySelector(".canvas-toolbar");
  if (toolbar) toolbarObserver?.observe(toolbar);
  const resize = () => { measureTop(); syncExpanded(); };
  compact?.addEventListener("change", syncExpanded);
  viewport?.addEventListener("resize", resize);

  return {
    root,
    update(next: AcceptanceSnapshot | null) {
      if (disposed) return;
      if (!next) {
        snapshot = null; activityText = ""; manualExpanded = null;
        rows.clear(); list.replaceChildren(); root.remove();
        return;
      }
      if (snapshot?.id !== next.id) {
        if (list.contains(document.activeElement)) toggle.focus();
        rows.clear(); list.replaceChildren(); activityText = "";
      }
      snapshot = next;
      goal.textContent = next.goal;
      count.textContent = `${next.items.filter((item) => item.status === "verified").length}/${next.items.length}`;
      count.title = "검증 완료 / 전체";
      status.textContent = STATUS[next.status];
      root.dataset.status = next.status;
      const ids = new Set(next.items.map((item) => item.id));
      for (const [id, row] of rows) if (!ids.has(id)) {
        if (row.root.contains(document.activeElement)) toggle.focus();
        row.root.remove(); rows.delete(id);
      }
      next.items.forEach((item, index) => {
        const row = rows.get(item.id) ?? createItem();
        rows.set(item.id, row); row.update(item);
        if (list.children[index] !== row.root) list.insertBefore(row.root, list.children[index] ?? null);
      });
      if (!root.isConnected) document.body.append(root);
      syncActivity(); syncExpanded(); measureTop();
    },
    setActivity(text: string) { activityText = text; syncActivity(); },
    dispose() {
      disposed = true; snapshot = null; rows.clear(); root.remove();
      compact?.removeEventListener("change", syncExpanded);
      viewport?.removeEventListener("resize", resize);
      toolbarObserver?.disconnect();
    },
  };
}
