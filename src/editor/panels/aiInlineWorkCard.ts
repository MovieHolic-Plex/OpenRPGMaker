// A request owns its receipt in the conversation. No document-level work strip.
import { el } from "@/util/dom";
import { focusEditorRegion } from "@/editor/editorReferenceNavigation";
import { changePreviewRegion, openWideChangeViewer } from "./aiChangePreview";
import type { AiWorkCard } from "./aiWorkStrip";

export function createInlineWorkCard(input: { title: string; onStop: () => void }): AiWorkCard {
  let writes = 0;
  let reads = 0;
  let hasContent = false;
  const title = el("strong", { text: "작업 내역", attrs: { title: input.title } });
  const status = el("span", { class: "ai-work-inline-status", text: "작업 중" });
  const live = el("div", { class: "ai-work-inline-live" });
  const steps = el("div", { class: "ai-work-inline-steps" });
  const summary = el("summary", { text: "세부 작업 보기" });
  const details = el("details", { children: [summary, steps] });
  const actions = el("div", { class: "ai-work-inline-actions" });
  const stop = el("button", { text: "중지", attrs: { type: "button" }, on: { click: input.onStop } });
  actions.append(stop);
  const root = el("article", {
    class: "ai-work-inline", dataset: { testid: "ai-work-card", state: "running" },
    children: [el("header", { children: [title, status] }), live, actions, details],
  });
  const count = (): void => { summary.textContent = `세부 작업 보기${writes ? ` · 변경 ${writes}` : reads ? ` · 조회 ${reads}` : ""}`; };
  return {
    root, live, steps,
    setTitle: (text) => { title.setAttribute("title", text); },
    setProgress: (done, total) => { status.textContent = total ? `작업 중 · ${done}/${total}` : "작업 중"; },
    noteReadOnly: () => { reads += 1; count(); },
    appendStep: (entry) => { writes += 1; steps.append(entry); count(); },
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
    finish: (result) => {
      root.dataset.state = result.ok ? "done" : "failed";
      status.textContent = result.message || (result.ok ? "완료" : "중단 / 오류");
      stop.remove(); live.replaceChildren();
      if (result.message) steps.append(el("p", { text: result.message }));
      if (!result.ok) { hasContent = true; details.open = true; }
    },
    discardIfEmpty: () => {
      if (hasContent || writes) return false;
      root.remove(); return true;
    },
  };
}
