import { makeSvgIcon } from "@/editor/panels/tileToolbarIcons";
import { claimTransientLayer, releaseTransientLayer } from "@/editor/ui/transientLayer";
import { el } from "@/util/dom";

export function saveErrorIcon(): SVGSVGElement {
  const icon = makeSvgIcon("warning");
  icon.classList.add("save-error-icon");
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

export function createSaveErrorPopover(trigger: HTMLButtonElement, actions: HTMLElement[] = []) {
  const id = `${trigger.dataset.testid}-error-details`;
  const message = el("div", { class: "save-error-message" });
  const panel = el("div", {
    class: "save-error-popover",
    attrs: { id, popover: "auto", role: "group", "aria-label": "저장 실패 상세" },
    children: [message, ...actions],
  });
  const dismiss = (): void => {
    if (typeof panel.hidePopover === "function" && panel.matches(":popover-open")) panel.hidePopover();
  };
  // Escape closes this layer before the enclosing database window handles it.
  const onEscape = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || !panel.matches(":popover-open")) return;
    event.preventDefault();
    event.stopPropagation();
    dismiss();
    trigger.focus();
  };
  const dispose = (): void => {
    dismiss();
    releaseTransientLayer(panel);
  };
  panel.addEventListener("beforetoggle", (event) => {
    if ((event as ToggleEvent).newState === "open") {
      claimTransientLayer(panel, dismiss);
      window.addEventListener("keydown", onEscape, true);
    } else {
      releaseTransientLayer(panel);
      window.removeEventListener("keydown", onEscape, true);
    }
  });
  return {
    panel,
    dismiss,
    dispose,
    setMessage(detail: string | null): void {
      if (detail === null) {
        dismiss();
        trigger.removeAttribute("popovertarget");
      } else {
        trigger.setAttribute("popovertarget", id);
      }
      if (message.textContent !== (detail ?? "")) message.textContent = detail;
    },
  };
}
