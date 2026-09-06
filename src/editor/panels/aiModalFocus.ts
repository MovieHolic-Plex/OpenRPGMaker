import { hasOpenModalLayer, isTopModal } from "@/editor/ui/modalStack";

/** Settings/history follow the editor's scoped Tab-boundary and attached-opener contract. */
export function installAiModalFocus(backdrop: HTMLElement): () => void {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const trap = (event: KeyboardEvent): void => {
    if (event.key !== "Tab" || event.defaultPrevented || !isTopModal(backdrop)) return;
    const controls = Array.from(backdrop.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, a[href], [tabindex], summary',
    )).filter((control) => {
      if (control.tabIndex < 0 || control.getAttribute("tabindex") === "-1"
        || control.getAttribute("type") === "hidden" || control.matches(":disabled")) return false;
      for (let node: HTMLElement | null = control; node && node !== backdrop; node = node.parentElement) {
        if (node.hidden || node.inert) return false;
        if (node.tagName === "DETAILS" && !node.hasAttribute("open")
          && !node.querySelector("summary")?.contains(control)) return false;
        // The editor's lightweight test DOM does not implement computed styles.
        if (typeof getComputedStyle === "function") {
          const style = getComputedStyle(node);
          if (style.display === "none" || style.visibility === "hidden") return false;
        }
      }
      return true;
    });
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || !last) return;
    if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  };
  backdrop.addEventListener("keydown", trap);
  // Called after unregister/removal: a newer modal must retain its focus.
  return () => {
    backdrop.removeEventListener("keydown", trap);
    if (opener?.isConnected && (!hasOpenModalLayer() || document.activeElement === document.body)) {
      opener.focus({ preventScroll: true });
    }
  };
}
