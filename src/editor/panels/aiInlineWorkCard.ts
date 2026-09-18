// A request owns its receipt in the conversation. No document-level work strip.
import { el } from "@/util/dom";
import { focusEditorRegion } from "@/editor/editorReferenceNavigation";
import { changePreviewRegion, openWideChangeViewer } from "./aiChangePreview";
import type { AiWorkCard } from "./aiWorkStrip";

/**
 * `ownerless`: 이 카드를 끝내 줄 턴이 없다. 턴이 끝난 뒤 늦게 도착한 진행 알림이 그렇다 —
 * `finishWorkCard` 는 다시 오지 않으므로 그 카드는 영영 「작업 중」으로 남고, 누르면 아무 일도
 * 없는 중지 버튼을 단 채 유휴 화면에 떠 있는다. 주인 없는 카드는 처음부터 결과 카드로 만든다 —
 * 내용은 그대로 받되 진행 중이라고 거짓말하지 않는다.
 */
export function createInlineWorkCard(input: { title: string; onStop: () => void; ownerless?: boolean }): AiWorkCard {
  let writes = 0;
  let hasContent = false;
  const title = el("strong", { text: "작업 중", attrs: { title: input.title } });
  const status = el("span", { class: "ai-work-inline-status", text: "작업 중" });
  const live = el("div", { class: "ai-work-inline-live" });
  const steps = el("div", { class: "ai-work-inline-steps" });
  const summary = el("summary", { text: "작업 과정" });
  const details = el("details", { dataset: { testid: "ai-work-process" }, children: [summary, live, steps] });
  const actions = el("div", { class: "ai-work-inline-actions" });
  const stop = el("button", { text: "중지", attrs: { type: "button" }, on: { click: input.onStop } });
  actions.append(stop);
  const root = el("article", {
    class: "ai-work-inline", dataset: { testid: "ai-work-card", state: "running" },
    children: [el("header", { children: [title, status] }), actions, details],
  });
  const finish = (result: { readonly ok: boolean; readonly message?: string }): void => {
    root.dataset.state = result.ok ? "done" : "failed";
    title.textContent = "작업 결과";
    status.textContent = result.message || (result.ok ? "완료" : "중단 / 오류");
    stop.remove(); live.replaceChildren();
    if (result.message) steps.append(el("p", { text: result.message }));
    if (!result.ok) hasContent = true;
  };
  if (input.ownerless) finish({ ok: true, message: "" });
  return {
    root, live, steps,
    setTitle: (text) => { title.setAttribute("title", text); },
    setProgress: (done, total) => { status.textContent = total ? `작업 중 · ${done}/${total}` : "작업 중"; },
    noteReadOnly: () => {},
    appendStep: (entry) => { writes += 1; steps.append(entry); },
    attachElement: (element) => { hasContent = true; details.append(element); },
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
        details.append(undo);
      }
    },
    finish,
    discardIfEmpty: () => {
      if (hasContent || writes) return false;
      root.remove(); return true;
    },
  };
}
