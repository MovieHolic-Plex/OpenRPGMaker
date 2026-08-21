import {
  clearAiApplyCompletion,
  completionUndoIsCurrent,
  type AiApplyCompletionContext,
} from "@/editor/aiApplyCompletion";
import { MAP_EDIT_HISTORY_EVENT, undoMapEdit } from "@/editor/mapEditHistory";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

export interface AiCompletionStripHandle {
  readonly element: HTMLElement;
  readonly dispose: () => void;
}

export function buildAiCompletionStrip(options: {
  readonly context: AiApplyCompletionContext;
  readonly onPrefill: (prompt: string, context: AiApplyCompletionContext) => void;
}): AiCompletionStripHandle {
  const { context } = options;
  const undo = el("button", {
    class: "ai-completion-action",
    text: "되돌리기",
    attrs: { type: "button", title: "방금 적용한 변경만 되돌립니다" },
    dataset: { testid: "ai-completion-undo" },
  }) as HTMLButtonElement;
  const refreshUndo = (): void => {
    const enabled = completionUndoIsCurrent(context);
    undo.disabled = !enabled;
    undo.setAttribute("aria-disabled", String(!enabled));
  };
  undo.addEventListener("click", () => {
    if (!completionUndoIsCurrent(context) || !undoMapEdit()) {
      refreshUndo();
      return;
    }
    clearAiApplyCompletion(context);
    toast("방금 AI 변경을 되돌렸습니다.", "ok");
  });

  const action = (label: string, testid: string, onClick: () => void): HTMLButtonElement =>
    el("button", {
      class: "ai-completion-action",
      text: label,
      attrs: { type: "button" },
      dataset: { testid },
      on: { click: onClick },
    }) as HTMLButtonElement;

  const element = el("div", {
    class: "ai-completion-strip",
    attrs: { role: "toolbar", "aria-label": "AI 적용 후 다음 작업" },
    dataset: { testid: "ai-completion-strip" },
    children: [
      el("span", {
        class: "ai-completion-summary",
        text: context.summary || "변경을 적용했습니다",
        attrs: { title: context.instruction || context.summary },
      }),
      action("테스트 플레이", "ai-completion-test", () => {
        if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
        const detail = { kind: "map", mapId: context.mapId };
        if (typeof CustomEvent === "function") {
          window.dispatchEvent(new CustomEvent("oprn:test-play-window", { detail }));
        } else {
          const event = new Event("oprn:test-play-window");
          Object.defineProperty(event, "detail", { configurable: true, value: detail });
          window.dispatchEvent(event);
        }
      }),
      action("AI로 다듬기", "ai-completion-refine", () => {
        options.onPrefill(
          `방금 적용한 결과를 확인하고, 선택한 영역을 주변과 더 자연스럽게 어울리도록 다듬어줘.\n참고: ${context.instruction || context.summary}`,
          context,
        );
      }),
      action("문제 검사", "ai-completion-audit", () => {
        options.onPrefill("방금 적용한 부분의 통행, 겹침, 누락 문제를 검사하고 고칠 방법을 알려줘.", context);
      }),
      undo,
    ],
  });

  refreshUndo();
  if (typeof window !== "undefined") window.addEventListener(MAP_EDIT_HISTORY_EVENT, refreshUndo);
  return {
    element,
    dispose: () => {
      if (typeof window !== "undefined") window.removeEventListener(MAP_EDIT_HISTORY_EVENT, refreshUndo);
    },
  };
}
