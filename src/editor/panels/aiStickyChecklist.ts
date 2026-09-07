import type { AcceptanceSnapshot, AcceptanceItemSnapshot, RequirementWithdrawalAction } from "@/ai/assistantAcceptance";
import { focusEditorRegion } from "@/editor/editorReferenceNavigation";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { deckIcon } from "./aiDeckIcons";

const STATUS = {
  pending: "대기", working: "작업 중", verifying: "검증 중", verified: "검증 완료", blocked: "진행 막힘",
} as const;

interface ChecklistActions {
  readonly onWithdraw?: (action: RequirementWithdrawalAction) => boolean;
  readonly onHide?: () => void;
  readonly onChange?: () => void;
}

function createItem(onWithdraw: ((requirementId: string) => boolean) | undefined) {
  let item: AcceptanceItemSnapshot | null = null;
  let busy = false;
  const mark = el("span", { class: "ai-sticky-mark", attrs: { "aria-hidden": "true" }, children: [deckIcon("check")] });
  mark.querySelector("path")?.setAttribute("pathLength", "1");
  const title = el("span", { class: "ai-sticky-item-title" });
  const status = el("span", { class: "ai-sticky-item-status" });
  const blockReason = el("p", { class: "ai-sticky-block-reason" });
  const summary = el("summary", { children: [mark, title, status, blockReason] });
  const actionStatus = el("p", { class: "ai-sticky-reason", attrs: { role: "status" }, dataset: { testid: "ai-requirement-action-status" } });
  actionStatus.hidden = true;
  const withdraw = onWithdraw ? el("button", {
    class: "ai-sticky-navigate ai-sticky-withdraw", attrs: { type: "button" },
    dataset: { testid: "ai-requirement-withdraw" }, text: "이 요구 제외",
    on: { click: (event) => {
      event.stopPropagation();
      if (!item || busy || item.withdrawal || item.status === "verified") return;
      actionStatus.hidden = onWithdraw(item.id);
      if (!actionStatus.hidden) {
        actionStatus.textContent = "제외하지 못했습니다. 현재 요구를 확인해 주세요.";
        root.open = true;
      }
    } },
  }) : null;
  const source = el("p", { class: "ai-sticky-reason" });
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
  const detail = el("div", { class: "ai-sticky-item-detail", children: [source, reason, evidence, actionStatus, navigate, ...withdraw ? [withdraw] : []] });
  const root = el("details", { class: "ai-sticky-item", dataset: { testid: "ai-sticky-item" }, children: [summary, detail] });
  function syncAction() {
    if (!withdraw || !item) return;
    withdraw.dataset.requirementId = item.id;
    withdraw.hidden = item.status === "verified" && !item.withdrawal;
    withdraw.disabled = busy || !!item.withdrawal;
    withdraw.textContent = item.withdrawal ? "사용자가 제외함" : "이 요구 제외";
    withdraw.setAttribute("aria-label", `${item.title} · ${withdraw.textContent}`);
    if ((withdraw.disabled || withdraw.hidden) && document.activeElement === withdraw) summary.focus();
  }
  return { root, setBusy(value: boolean) { busy = value; syncAction(); }, update(next: AcceptanceItemSnapshot) {
    item = next;
    root.dataset.itemId = next.id;
    root.dataset.status = next.status;
    root.dataset.required = next.required === false ? "false" : "true";
    title.textContent = next.title;
    status.textContent = `${next.required === false ? "선택 · " : ""}${STATUS[next.status]}`;
    root.dataset.withdrawn = String(!!next.withdrawal);
    const blockText = next.status === "blocked" && !next.withdrawal ? next.reason ?? "" : "";
    blockReason.textContent = blockText;
    blockReason.hidden = !blockText;
    source.textContent = next.source ? `원래 요청: ${next.source.text}` : "";
    source.hidden = !next.source;
    reason.textContent = next.withdrawal ? `사용자 제외: ${next.withdrawal.reason}` : next.status === "blocked" ? "" : next.reason ?? "";
    reason.hidden = !reason.textContent;
    syncAction();
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

function createFoldGroup(className: string, testid: string) {
  const label = el("summary", { class: "ai-sticky-group-summary" });
  const items = el("div", { class: "ai-sticky-group-list" });
  const root = el("details", { class: className, dataset: { testid }, children: [label, items] });
  root.hidden = true;
  return { root, label, items };
}

/** The panel owns user actions and mount/clear; the backend owns every status. */
export function createAiStickyChecklist(actions: ChecklistActions = {}) {
  let snapshot: AcceptanceSnapshot | null = null;
  let busy = false;
  const withdraw = actions.onWithdraw ? (requirementId: string): boolean => {
    if (!snapshot || disposed || busy) return false;
    return actions.onWithdraw?.({ acceptanceId: snapshot.id, requirementId, reason: "사용자가 완료 범위에서 이 요구를 제외함" }) ?? false;
  } : undefined;
  let manualExpanded: boolean | null = null;
  let activityText = "";
  let disposed = false;
  // Match the panel's headless DOM contract: viewport APIs are optional.
  const viewport = typeof window === "undefined" ? null : window;
  let position: { x: number; y: number } | null = null;
  let pointer: { id: number; x: number; y: number; left: number; top: number } | null = null;
  const rows = new Map<string, ReturnType<typeof createItem>>();
  const drag = el("button", {
    class: "ai-sticky-drag",
    attrs: { type: "button", "aria-label": "완료 기준 위치 옮기기" },
    dataset: { testid: "ai-sticky-drag" },
    children: [deckIcon("grid")],
  });
  const hide = el("button", {
    class: "ai-sticky-hide",
    attrs: { type: "button", "aria-label": "완료 기준 숨기기" },
    dataset: { testid: "ai-sticky-hide" },
    children: [deckIcon("x")],
  });
  const goal = el("span", { class: "ai-sticky-goal" });
  const count = el("span", {
    class: "ai-sticky-count",
    dataset: { testid: "ai-sticky-count", requiredVerified: "", activeRequired: "" },
  });
  const activityInline = el("span", { class: "ai-sticky-activity-inline" });
  const chevron = deckIcon("chevron-down");
  const toggle = el("button", {
    class: "ai-sticky-toggle", attrs: { type: "button" }, dataset: { testid: "ai-sticky-toggle" },
    children: [count, activityInline, goal, chevron], on: { click: () => {
      manualExpanded = toggle.getAttribute("aria-expanded") !== "true";
      syncExpanded();
    } },
  });
  const status = el("span", { class: "ai-sticky-status" });
  const header = el("header", { class: "ai-sticky-header", children: [
    drag,
    el("div", { class: "ai-sticky-caption", children: [el("span", { text: "완료 기준" }), status] }),
    toggle,
    hide,
  ] });
  const activity = el("p", { class: "ai-sticky-activity", attrs: { role: "status", "aria-live": "polite" } });
  const list = el("div", { class: "ai-sticky-list" });
  const verifiedGroup = createFoldGroup("ai-sticky-done-group", "ai-sticky-verified-group");
  const optionalGroup = createFoldGroup("ai-sticky-optional-group", "ai-sticky-optional-group");
  const withdrawnGroup = createFoldGroup("ai-sticky-withdrawn-group", "ai-sticky-withdrawn-group");
  const body = el("div", { class: "ai-sticky-body", children: [activity, list, verifiedGroup.root, optionalGroup.root, withdrawnGroup.root] });
  const root = el("aside", {
    class: "ai-sticky-checklist", attrs: { "aria-label": "AI 완료 기준", "data-editor-navigation-owner": "true" },
    dataset: { testid: "ai-sticky-checklist", hiddenByUser: "false" }, children: [header, body],
  });
  function syncExpanded() {
    const expanded = manualExpanded ?? false;
    if (!expanded && body.contains(document.activeElement)) toggle.focus();
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-label", `${snapshot?.goal ?? "완료 기준"} · ${count.textContent} · ${expanded ? "접기" : "펼치기"}`);
    root.dataset.expanded = String(expanded);
    body.hidden = !expanded;
    if (position && root.isConnected && !root.hidden) place(position.x, position.y);
  }
  function syncActivity() {
    const current = snapshot?.items.find((item) => item.required !== false && !item.withdrawal
      && (item.status === "working" || item.status === "verifying"));
    const text = activityText || (current ? `${STATUS[current.status]} · ${current.title}` : snapshot ? STATUS[snapshot.status] : "");
    activity.textContent = text;
    activityInline.textContent = text;
  }
  function measureTop() {
    const toolbar = document.querySelector(".canvas-toolbar");
    const bottom = toolbar?.getBoundingClientRect().bottom;
    if (bottom && bottom > 0) root.style.setProperty("--ai-sticky-toolbar-bottom", `${bottom}px`);
  }
  const toolbarObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measureTop);
  const toolbar = document.querySelector(".canvas-toolbar");
  if (toolbar) toolbarObserver?.observe(toolbar);
  function place(x: number, y: number) {
    if (!viewport) return;
    const style = viewport.getComputedStyle(root);
    const spacing = parseFloat(style.getPropertyValue("--space-3")) || 12;
    const minX = (parseFloat(style.getPropertyValue("--editor-left-safe")) || 288) + spacing;
    const minY = (parseFloat(style.getPropertyValue("--ai-sticky-toolbar-bottom"))
      || parseFloat(style.getPropertyValue("--ai-sticky-top-fallback")) || 112) + spacing;
    const rect = root.getBoundingClientRect();
    position = {
      x: Math.max(minX, Math.min(x, viewport.innerWidth - rect.width - spacing)),
      y: Math.max(minY, Math.min(y, viewport.innerHeight - rect.height - spacing)),
    };
    root.style.left = `${Math.round(position.x)}px`;
    root.style.top = `${Math.round(position.y)}px`;
  }
  function stopDrag() {
    const id = pointer?.id;
    pointer = null;
    if (id !== undefined && drag.hasPointerCapture(id)) drag.releasePointerCapture(id);
  }
  const startDrag = (event: PointerEvent) => {
    if (disposed || !snapshot || root.hidden || pointer || event.button !== 0) return;
    const rect = root.getBoundingClientRect();
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    drag.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };
  const moveDrag = (event: PointerEvent) => {
    if (!pointer || pointer.id !== event.pointerId) return;
    place(pointer.left + event.clientX - pointer.x, pointer.top + event.clientY - pointer.y);
    event.stopPropagation();
  };
  const endDrag = (event: PointerEvent) => { if (pointer?.id === event.pointerId) stopDrag(); };
  drag.addEventListener("pointerdown", startDrag);
  drag.addEventListener("pointermove", moveDrag);
  drag.addEventListener("pointerup", endDrag);
  drag.addEventListener("pointercancel", endDrag);
  drag.addEventListener("lostpointercapture", endDrag);
  function hideChecklist() {
    if (disposed || !snapshot) return;
    stopDrag();
    root.hidden = true;
    root.dataset.hiddenByUser = "true";
    actions.onHide?.();
    actions.onChange?.();
  }
  hide.addEventListener("click", hideChecklist);
  function clearPresentation() {
    stopDrag();
    manualExpanded = null; activityText = ""; position = null;
    root.style.removeProperty("left"); root.style.removeProperty("top");
    root.hidden = false; root.dataset.hiddenByUser = "false";
    rows.clear(); list.replaceChildren();
    for (const group of [verifiedGroup, optionalGroup, withdrawnGroup]) {
      group.items.replaceChildren(); group.root.open = false; group.root.hidden = true;
    }
  }
  const resize = () => {
    measureTop(); syncExpanded();
    if (position && !root.hidden) place(position.x, position.y);
  };
  viewport?.addEventListener("resize", resize);

  return {
    root,
    hasSnapshot: () => !disposed && snapshot !== null,
    hide: hideChecklist,
    show() {
      if (disposed || !snapshot) return;
      root.hidden = false; root.dataset.hiddenByUser = "false";
      syncExpanded();
      if (position) place(position.x, position.y);
      toggle.focus();
      actions.onChange?.();
    },
    update(next: AcceptanceSnapshot | null) {
      if (disposed) return;
      if (!next) {
        if (root.contains(document.activeElement)) actions.onHide?.();
        snapshot = null; clearPresentation(); root.remove();
        actions.onChange?.();
        return;
      }
      if (snapshot?.id !== next.id) {
        if (body.contains(document.activeElement)) toggle.focus();
        clearPresentation();
      }
      snapshot = next;
      goal.textContent = next.goal;
      const required = next.items.filter(item => item.required !== false && !item.withdrawal);
      const verified = required.filter(item => item.status === "verified");
      const optional = next.items.filter(item => item.required === false && !item.withdrawal);
      const withdrawn = next.items.filter(item => item.withdrawal);
      count.dataset.requiredCount = count.dataset.activeRequired = String(required.length);
      count.dataset.verifiedCount = count.dataset.requiredVerified = String(verified.length);
      count.dataset.optionalCount = String(optional.length);
      count.dataset.withdrawnCount = String(withdrawn.length);
      count.hidden = required.length === 0;
      count.textContent = required.length ? `${verified.length}/${required.length}` : "";
      count.title = "검증 완료 / 필수 요구";
      status.textContent = STATUS[next.status];
      root.dataset.status = next.status;
      const ids = new Set(next.items.map((item) => item.id));
      for (const [id, row] of rows) if (!ids.has(id)) {
        if (row.root.contains(document.activeElement)) toggle.focus();
        row.root.remove(); rows.delete(id);
      }
      const priority = { working: 0, blocked: 0, verifying: 1, pending: 2, verified: 3 };
      const active = required.filter(item => item.status !== "verified")
        .sort((a, b) => priority[a.status] - priority[b.status]);
      const groups = [
        { items: active, host: list, group: null, label: "" },
        { items: verified, host: verifiedGroup.items, group: verifiedGroup, label: "검증 완료" },
        { items: optional, host: optionalGroup.items, group: optionalGroup, label: "선택" },
        { items: withdrawn, host: withdrawnGroup.items, group: withdrawnGroup, label: "제외" },
      ];
      for (const { items, host, group, label } of groups) {
        if (group) {
          group.label.textContent = `${label} ${items.length}`;
          // Keep focus in a row until it has moved to its new group below.
          if (items.length) group.root.hidden = false;
        }
        items.forEach((item, index) => {
          const row = rows.get(item.id) ?? createItem(withdraw);
          rows.set(item.id, row); row.setBusy(busy); row.update(item);
          const focused = row.root.contains(document.activeElement) ? document.activeElement : null;
          if (focused && group) group.root.open = true;
          if (host.children[index] !== row.root) host.insertBefore(row.root, host.children[index] ?? null);
          if (focused instanceof HTMLElement && document.activeElement !== focused) focused.focus({ preventScroll: true });
        });
      }
      for (const { items, group } of groups) if (group && !items.length) {
        if (group.root.contains(document.activeElement)) toggle.focus();
        group.root.hidden = true;
      }
      if (!root.isConnected) document.body.append(root);
      syncActivity(); syncExpanded(); measureTop();
      if (position && !root.hidden) place(position.x, position.y);
      actions.onChange?.();
    },
    setBusy(value: boolean) { if (disposed) return; busy = value; for (const row of rows.values()) row.setBusy(value); },
    setActivity(text: string) { if (disposed) return; activityText = text; syncActivity(); },
    dispose() {
      if (disposed) return;
      if (root.contains(document.activeElement)) actions.onHide?.();
      disposed = true; snapshot = null; clearPresentation(); root.remove();
      drag.removeEventListener("pointerdown", startDrag);
      drag.removeEventListener("pointermove", moveDrag);
      drag.removeEventListener("pointerup", endDrag);
      drag.removeEventListener("pointercancel", endDrag);
      drag.removeEventListener("lostpointercapture", endDrag);
      hide.removeEventListener("click", hideChecklist);
      viewport?.removeEventListener("resize", resize);
      toolbarObserver?.disconnect();
      actions.onChange?.();
    },
  };
}
