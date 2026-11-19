import { el } from "@/util/dom";
import { afterOpeningPaint } from "./afterOpeningPaint";
import { registerModal, unregisterModal } from "./modalStack";

/** Keep lazy editor dialogs visible and dismissible while their code or data loads. */
export function loadWithOpeningDialog<T>(title: string, load: () => Promise<T>): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const opener = document.activeElement;
    const overlay = el("div", { class: "app-modal-overlay" });
    let closed = false;
    const close = (): void => {
      closed = true;
      unregisterModal(overlay);
      overlay.remove();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
    const cancel = (): void => {
      close();
      resolve(null);
    };
    const button = el("button", {
      class: "app-modal-button",
      text: "취소",
      attrs: { type: "button" },
      on: { click: cancel },
    });
    overlay.append(el("section", {
      class: "app-modal-card",
      attrs: { role: "dialog", "aria-modal": "true", "aria-label": title },
      children: [
        el("div", { class: "app-modal-title", text: title }),
        el("p", { class: "app-modal-message", text: "불러오는 중…", attrs: { role: "status" } }),
        el("div", { class: "app-modal-actions", children: [button] }),
      ],
    }));
    overlay.addEventListener("click", (event) => { if (event.target === overlay) cancel(); });
    overlay.addEventListener("keydown", (event) => { if (event.key === "Tab") event.preventDefault(); });
    document.body.append(overlay);
    registerModal(overlay, cancel);
    button.focus();
    afterOpeningPaint(overlay, () => {
      if (closed) return;
      if (!overlay.isConnected) { cancel(); return; }
      void Promise.resolve().then(load).then((value) => {
        if (closed) return;
        const attached = overlay.isConnected;
        close();
        resolve(attached ? value : null);
      }, (error: unknown) => {
        if (closed) return;
        close();
        reject(error);
      });
    });
  });
}
