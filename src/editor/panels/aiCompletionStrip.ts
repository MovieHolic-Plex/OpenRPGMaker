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

/**
 * 적용 완료 스트립 — 컴포저 바로 위 고정 밴드(`ai-completion-host`)에 사는 한 줄.
 *
 * 왜 한 줄인가 (감독 지시 2026-08-25 + 실측): 예전 스트립은 요약 옆에 `시연 실행`,
 * `AI로 다듬기`, `문제 검사`, `되돌리기` 네 버튼을 세웠고, 이 밴드는 도크와 무관하게
 * 항상 마운트되므로 적용할 때마다 화면 하단에 버튼 무리가 새로 떴다. 사용자에게는
 * "하단에 이상한 버튼들이 계속 뜬다"로 읽혔다. 앞의 세 개는 결국 컴포저에 문장을
 * 넣어주는 일이라 상시 버튼일 이유가 없고(같은 요청을 직접 타이핑하면 된다),
 * `되돌리기`만이 이 밴드에서만 할 수 있는 일 — 방금 만든 undo 체크포인트가 아직
 * top 일 때만 유효한, 시간에 묶인 동작 — 이다. 그래서 요약 + 되돌리기로 좁혔다.
 */
export function buildAiCompletionStrip(options: {
  readonly context: AiApplyCompletionContext;
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

  const element = el("div", {
    class: "ai-completion-strip",
    attrs: { role: "status", "aria-label": "AI 적용 결과" },
    dataset: { testid: "ai-completion-strip" },
    children: [
      el("span", {
        class: "ai-completion-summary",
        text: context.summary || "변경을 적용했습니다",
        attrs: { title: context.instruction || context.summary },
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
