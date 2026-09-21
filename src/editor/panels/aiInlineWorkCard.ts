import { activityNote, activityPhase, createActivityTrace, recordActivityEvent } from "@/ai/activityTrace";
import { createActivityView } from "./aiActivityView";
import { bindActivityLevel } from "./aiActivityPreference";
// A request owns its receipt in the conversation. No document-level work strip.
import { el } from "@/util/dom";
import { focusEditorRegion } from "@/editor/editorReferenceNavigation";
import { changePreviewRegion, openWideChangeViewer } from "./aiChangePreview";
import { deckIcon } from "./aiDeckIcons";
import type { AiWorkCard } from "./aiWorkStrip";

/**
 * `ownerless`: 이 카드를 끝내 줄 턴이 없다. 턴이 끝난 뒤 늦게 도착한 진행 알림이 그렇다 —
 * `finishWorkCard` 는 다시 오지 않으므로 그 카드는 영영 「작업 중」으로 남고, 누르면 아무 일도
 * 없는 중지 버튼을 단 채 유휴 화면에 떠 있는다. 주인 없는 카드는 처음부터 결과 카드로 만든다 —
 * 내용은 그대로 받되 진행 중이라고 거짓말하지 않는다.
 */
export function createInlineWorkCard(input: { title: string; onStop: () => void; ownerless?: boolean; projectId?: string }): AiWorkCard {
  let trace = createActivityTrace(input.title, input.projectId);
  const activity = createActivityView();
  let hasBoard = false;
  let hasExtraProcess = false;
  let writes = 0;
  let hasContent = false;
  const spinner = deckIcon("clock", { size: 15 });
  const title = el("strong", { text: input.title, attrs: { title: input.title } });
  const status = el("span", { class: "ai-work-inline-status", text: "진행 중" });
  const live = el("div", { class: "ai-work-inline-live" });
  const steps = el("div", { class: "ai-work-inline-steps" });
  const summary = el("summary", { text: "작업 과정" });
  const details = el("details", { dataset: { testid: "ai-work-process" }, children: [summary, live, steps] });
  const actions = el("div", { class: "ai-work-inline-actions" });
  const stop = el("button", { text: "중지", attrs: { type: "button" }, on: { click: input.onStop } });
  actions.append(stop);
  const head = el("button", {
    class: "ai-work-inline-head", attrs: { type: "button", "aria-expanded": "false", title: "작업 과정 펼치기" },
    dataset: { testid: "ai-work-card-toggle" },
    on: { click: () => {
      const next = !details.open;
      details.open = next;
      head.setAttribute("aria-expanded", String(next));
      head.setAttribute("title", next ? "작업 과정 접기" : "작업 과정 펼치기");
    } },
    children: [el("span", { class: "ai-work-inline-spinner", attrs: { "aria-hidden": "true" }, children: [spinner] }), title, status],
  });
  const root = el("article", {
    class: "ai-work-inline has-activity", dataset: { testid: "ai-work-card", state: "running" },
    children: [head, activity.root, actions, details],
  });
  bindActivityLevel(root, level => {
    details.hidden = (hasBoard && !hasExtraProcess) || level === "none" || level === "brief";
    details.open = level === "detail" || level === "trace";
  });
  activity.update(trace);
  const finish = (result: { readonly ok: boolean; readonly message?: string }): void => {
    trace = activityPhase(trace, result.ok ? "완료" : /중단|중지/.test(result.message ?? "") ? "중단" : "실패", Date.now());
    if (!hasBoard) activity.update(trace);
    root.dataset.state = result.ok ? "done" : "failed";
    title.textContent = "작업 결과";
    head.querySelector(".ai-work-inline-spinner")?.remove();
    status.textContent = result.message || (result.ok ? "완료" : "중단 / 오류");
    stop.remove(); live.replaceChildren();
    if (result.message) steps.append(el("p", { text: result.message }));
    if (!result.ok) hasContent = true;
  };
  if (input.ownerless) finish({ ok: true, message: "" });
  return {
    root, live, steps,
    recordActivity: (event) => {
      if (trace.phase === "준비") trace = activityPhase(trace, "실행 중");
      trace = recordActivityEvent(trace, event); activity.update(trace);
    },
    setTitle: (text) => { title.setAttribute("title", text); },
    setProgress: (done, total) => { status.textContent = total ? `진행 중 · ${done}/${total}` : "진행 중"; },
    noteReadOnly: () => {},
    appendStep: (entry) => { writes += 1; hasExtraProcess = true; steps.append(entry); root.dispatchEvent(new Event("ai-activity-level")); },
    attachElement: (element) => {
      hasContent = true;
      if (element.dataset.activityBoard) { hasBoard = true; summary.textContent = "추가 안내"; root.dispatchEvent(new Event("ai-activity-level")); activity.root.remove(); root.insertBefore(element, actions); }
      else {
        hasExtraProcess = true;
        details.append(element);
        root.dispatchEvent(new Event("ai-activity-level"));
        if (!hasBoard && element.textContent) { trace = activityNote(trace, "process.note", element.textContent); activity.update(trace); }
      }
    },
    attachChange: (preview) => {
      hasContent = true;
      actions.replaceChildren(el("button", {
        text: "변경 보기", attrs: { type: "button" }, dataset: { testid: "ai-inline-change-view" },
        on: { click: () => openWideChangeViewer(preview) },
      }));
      const region = changePreviewRegion(preview.before, preview.after, preview.mapId);
      if (region) actions.append(el("button", {
        text: "맵에서 보기", attrs: { type: "button" },
        on: { click: () => { focusEditorRegion({ mapId: preview.mapId, x: region.x, y: region.y, w: region.width, h: region.height }, { highlight: true }); } },
      }));
      if (preview.onUndo) {
        const undo = el("button", { text: "이 작업 되돌리기", attrs: { type: "button" } }) as HTMLButtonElement;
        undo.addEventListener("click", () => { preview.onUndo?.(); undo.disabled = true; });
        actions.append(undo);
      }
    },
    finish,
    discardIfEmpty: () => {
      if (hasContent || writes || trace.entries.some(e => e.kind === "tool")) return false;
      root.remove(); return true;
    },
  };
}
