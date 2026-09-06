import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { el } from "@/util/dom";

export type AudioDraftDecision = "save" | "discard" | "cancel";

/** Same stack, action chrome, focus cycle and opener contract as shared modals. */
export function openAudioDescriptionDirtyDialog(
  onDecision: (decision: AudioDraftDecision) => void,
): () => void {
  const opener = document.activeElement;
  const overlay = el("div", {
    class: "app-modal-overlay",
    dataset: { testid: "audio-description-dirty-dialog" },
  });
  let settled = false;
  const dispose = (): void => {
    settled = true;
    unregisterModal(overlay);
    overlay.remove();
  };
  const finish = (decision: AudioDraftDecision): void => {
    if (settled) return;
    dispose();
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    onDecision(decision);
  };
  const choices = [
    { value: "cancel", label: "취소" },
    { value: "discard", label: "버리기" },
    { value: "save", label: "저장" },
  ] as const;
  const buttons = choices.map(choice => el("button", {
    class: `app-modal-button${choice.value === "save" ? " is-confirm" : ""}`,
    text: choice.label,
    attrs: { type: "button" },
    dataset: { testid: `audio-description-dirty-${choice.value}` },
    on: { click: () => finish(choice.value) },
  }));
  const card = el("section", {
    class: "app-modal-card",
    attrs: {
      role: "alertdialog", "aria-modal": "true",
      "aria-labelledby": "audio-description-dirty-title",
      "aria-describedby": "audio-description-dirty-message",
    },
    children: [
      el("div", {
        class: "app-modal-title", text: "설명 변경 내용",
        attrs: { id: "audio-description-dirty-title" },
      }),
      el("div", {
        class: "app-modal-message", text: "작성 중인 설명을 저장할까요?",
        attrs: { id: "audio-description-dirty-message" },
      }),
      el("div", { class: "app-modal-actions", children: buttons }),
    ],
  });
  card.addEventListener("click", event => event.stopPropagation());
  card.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  overlay.append(card);
  overlay.addEventListener("click", () => finish("cancel"));
  document.body.append(overlay);
  registerModal(overlay, () => finish("cancel"));
  buttons[0]?.focus();
  return dispose;
}
