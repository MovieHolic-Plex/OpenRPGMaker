import type { AcceptanceSnapshot, AcceptanceItemSnapshot, RequirementWithdrawalAction } from "@/ai/assistantAcceptance";
import type { ApproachPreview } from "@/ai/toolVerificationEvidence";
import type { SceneStep } from "@/testing/sceneTestRunner";
import { focusEditorRegion } from "@/editor/editorReferenceNavigation";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { deckIcon } from "./aiDeckIcons";

const STATUS = {
  pending: "대기", working: "작업 중", verifying: "검증 중", verified: "검증 완료", blocked: "진행 막힘",
} as const;

interface ChecklistActions {
  readonly onWithdraw?: (action: RequirementWithdrawalAction) => boolean;
  readonly onReviewApproach?: (checkId: string) => ApproachPreview | null;
  readonly onConfirmApproach?: (preview: ApproachPreview) => boolean;
}

function createItem(onWithdraw: ((requirementId: string) => boolean) | undefined, actions: ChecklistActions) {
  let item: AcceptanceItemSnapshot | null = null;
  let busy = false;
  const mark = el("span", { class: "ai-sticky-mark", attrs: { "aria-hidden": "true" }, children: [deckIcon("check")] });
  mark.querySelector("path")?.setAttribute("pathLength", "1");
  const title = el("span", { class: "ai-sticky-item-title" });
  const status = el("span", { class: "ai-sticky-item-status" });
  const summary = el("summary", { children: [mark, title, status] });
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
  if (withdraw) summary.append(withdraw);
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
  const detail = el("div", { class: "ai-sticky-item-detail", children: [source, reason, evidence, actionStatus, navigate] });
  const root = el("details", { class: "ai-sticky-item", dataset: { testid: "ai-sticky-item" }, children: [summary, detail] });
  function syncAction() {
    for (const button of evidence.querySelectorAll<HTMLButtonElement>("button")) button.disabled = busy || !!item?.withdrawal;
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
    actionStatus.hidden = true;
    root.dataset.itemId = next.id;
    root.dataset.status = next.status;
    title.textContent = next.title;
    status.textContent = `${next.required === false ? "선택 · " : ""}${STATUS[next.status]}`;
    root.dataset.withdrawn = String(!!next.withdrawal);
    source.textContent = next.source ? `원래 요청: ${next.source.text}` : "";
    source.hidden = !next.source;
    reason.textContent = next.withdrawal ? `사용자 제외: ${next.withdrawal.reason}` : next.reason ?? "";
    reason.hidden = !reason.textContent;
    evidence.replaceChildren(...next.evidence.map((entry) => {
      const row = el("dl", { dataset: { passed: String(entry.passed) },
        children: [el("dt", { text: "기대" }), el("dd", { text: entry.expected }),
          el("dt", { text: "확인" }), el("dd", { text: entry.observed }),
          el("dt", { text: "판정" }), el("dd", { text: entry.passed ? "충족" : "미충족" })] });
      if (entry.approachCheckId && actions.onReviewApproach && actions.onConfirmApproach) {
        const checkId = entry.approachCheckId;
        const previewSlot = el("dd");
        const review = el("button", { class: "ai-sticky-navigate", attrs: { type: "button" },
          dataset: { testid: "ai-approach-review", checkId }, text: "접근 보정 검토",
          on: { click: () => {
            if (busy || item?.withdrawal) return;
            const preview = actions.onReviewApproach?.(checkId);
            if (!preview) { previewSlot.textContent = "현재 세션에서 검토할 수 없습니다. 실패 기준을 다시 확인해 주세요."; return; }
            const recipe = (title: string, value: unknown, open = false) => el("details", {
              attrs: open ? { open: "" } : {}, children: [el("summary", { text: title }),
                el("p", { class: "ai-sticky-reason", text: JSON.stringify(value) })] });
            const confirm = el("button", { class: "ai-sticky-navigate", attrs: { type: "button" },
              dataset: { testid: "ai-approach-confirm", previewId: preview.previewId }, text: "이 접근 보정 승인",
              on: { click: () => {
                if (busy || item?.withdrawal) return;
                const accepted = actions.onConfirmApproach?.(preview) === true;
                actionStatus.hidden = false;
                actionStatus.textContent = accepted ? "접근 보정을 승인했습니다. 아직 미검증이며 새 실행이 필요합니다."
                  : "승인하지 못했습니다. 세션이나 내용이 바뀌었으므로 다시 검토해 주세요.";
                if (accepted) previewSlot.replaceChildren();
              } } });
            previewSlot.replaceChildren(el("p", { class: "ai-sticky-reason", attrs: { role: "status" },
              text: "미검증: 승인은 통과 판정이 아닙니다. 원래 단계와 모든 조건을 유지하며, 같은 맵의 실제 보행만 삽입합니다. 인접 보행은 대상을 향해 방향도 맞춥니다." }),
              recipe("원래 실패 실행", preview.originalArgs), recipe("삽입할 보행 · 원래 단계 바로 앞", preview.insertion, true),
              recipe("유지되는 모든 원래 조건", (preview.originalArgs.steps as readonly SceneStep[]).filter(step => step.kind === "expect"), true),
              recipe("원래 초기 상태", preview.initialState), recipe("승인 후 정확한 실행 인자 · 원래 조건 유지", preview.args), confirm);
          } } });
        row.append(el("dt", { text: "접근 보정" }), el("dd", { children: [review] }), previewSlot);
      }
      return row;
    }));
    syncAction();
    const map = next.mapId ? store.getCurrent().maps[next.mapId] : undefined;
    navigate.hidden = !next.mapId;
    navigate.disabled = !map;
    navigate.title = map ? map.name : "현재 프로젝트에 맵이 없습니다";
  } };
}

/** The panel owns user actions and mount/clear; the backend owns every status. */
export function createAiStickyChecklist(actions: ChecklistActions = {}) {
  let snapshot: AcceptanceSnapshot | null = null;
  let busy = false;
  const withdraw = actions.onWithdraw ? (requirementId: string): boolean => {
    if (!snapshot || disposed || busy) return false;
    return actions.onWithdraw?.({ acceptanceId: snapshot.id, requirementId, reason: "사용자가 완료 범위에서 이 요구를 제외함" }) ?? false;
  } : undefined;
  const approachActions: ChecklistActions = actions.onReviewApproach && actions.onConfirmApproach ? {
    onReviewApproach: checkId => !snapshot || disposed || busy ? null : actions.onReviewApproach?.(checkId) ?? null,
    onConfirmApproach: preview => !snapshot || disposed || busy ? false : actions.onConfirmApproach?.(preview) ?? false,
  } : {};
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
        const row = rows.get(item.id) ?? createItem(withdraw, approachActions);
        rows.set(item.id, row); row.setBusy(busy); row.update(item);
        if (list.children[index] !== row.root) list.insertBefore(row.root, list.children[index] ?? null);
      });
      if (!root.isConnected) document.body.append(root);
      syncActivity(); syncExpanded(); measureTop();
    },
    setBusy(value: boolean) { busy = value; for (const row of rows.values()) row.setBusy(value); },
    setActivity(text: string) { activityText = text; syncActivity(); },
    dispose() {
      disposed = true; snapshot = null; rows.clear(); root.remove();
      compact?.removeEventListener("change", syncExpanded);
      viewport?.removeEventListener("resize", resize);
      toolbarObserver?.disconnect();
    },
  };
}
