import { el } from "@/util/dom";
import type { ConfirmOptions } from "@/editor/ui/modal";

/** A decision pauses its owner, without a modal, focus grab or editor input lock. */
export function requestAssistantDecision(surface: {
  appendCard(element: HTMLElement): void;
  appendReviewPrompt?: (element: HTMLElement) => void;
  setStatus(text: string): void;
  readonly signal?: AbortSignal;
}, options: ConfirmOptions): Promise<boolean> {
  surface.signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (accepted: boolean) => {
      if (settled) return;
      settled = true;
      surface.signal?.removeEventListener("abort", abort);
      root.remove();
      resolve(accepted);
    };
    const abort = () => {
      if (settled) return;
      settled = true; root.remove();
      surface.signal?.removeEventListener("abort", abort);
      reject(surface.signal?.reason ?? new DOMException("작업이 중단됐어요", "AbortError"));
    };
    const root = el("section", {
      class: `ai-pending-review${options.danger ? " is-danger" : ""}`, dataset: { testid: "ai-decision-prompt" },
      attrs: { "aria-label": "답변 필요" },
      children: [
        el("p", { children: [el("strong", { text: `답변 필요${options.title ? ` · ${options.title}` : ""}` })] }),
        el("p", { text: options.message }),
        el("div", { class: "ai-pending-review-actions", children: [
          el("button", { text: options.confirmLabel ?? "확인", attrs: { type: "button" },
            dataset: { testid: "ai-decision-confirm" }, on: { click: () => finish(true) } }),
          el("button", { text: options.cancelLabel ?? "취소", attrs: { type: "button" },
            dataset: { testid: "ai-decision-cancel" }, on: { click: () => finish(false) } }),
        ] }),
      ],
    });
    surface.signal?.addEventListener("abort", abort, { once: true });
    surface.setStatus("답변 필요");
    try { (surface.appendReviewPrompt ?? surface.appendCard)(root); }
    catch (error) { root.remove(); surface.signal?.removeEventListener("abort", abort); settled = true; reject(error); }
  });
}
