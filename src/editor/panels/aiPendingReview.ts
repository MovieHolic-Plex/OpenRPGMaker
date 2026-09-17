import { el } from "@/util/dom";

/** A pending decision belongs in the conversation, outside collapsed execution details. */
export function createPendingReviewPrompt(actions: { apply: () => void; discard: () => void; report?: () => void }) {
  const message = el("p", { text: "변경안이 준비됐어요. 확인하고 적용해 주세요." });
  const buttons = el("div", { class: "ai-pending-review-actions" });
  const add = (text: string, testid: string, click: () => void) => buttons.append(el("button", {
    text, attrs: { type: "button" }, dataset: { testid }, on: { click },
  }));
  add("적용", "ai-pending-review-apply", actions.apply);
  if (actions.report) add("변경 내용 보기", "ai-pending-review-report", actions.report);
  add("버리기", "ai-pending-review-discard", actions.discard);
  const root = el("section", {
    class: "ai-pending-review", dataset: { testid: "ai-pending-review" },
    attrs: { "aria-label": "변경안 적용 대기" }, children: [message, buttons],
  });
  return {
    root,
    setBusy(busy: boolean) {
      root.setAttribute("aria-busy", String(busy));
      buttons.querySelectorAll("button").forEach(button => { button.disabled = busy; });
      message.textContent = busy ? "변경 내용을 적용하고 있어요." : "아직 적용되지 않았어요. 다시 적용하거나 버릴 수 있어요.";
    },
  };
}
