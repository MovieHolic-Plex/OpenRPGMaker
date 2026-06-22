import { renderResourceManager } from "@/editor/panels/resourceManager";
import { el } from "@/util/dom";

export function openResourceModal(): void {
  document.querySelector("[data-testid='resource-modal']")?.remove();

  const body = el("div", { class: "database-modal-body" });
  const closeButton = el("button", {
    class: "database-modal-close",
    text: "x",
    attrs: { type: "button", title: "닫기", "aria-label": "리소스 관리자 닫기" },
    dataset: { testid: "resource-modal-close" },
  });
  const backdrop = el("div", {
    class: "database-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "resource-modal" },
    children: [
      el("section", {
        class: "database-modal-window resource-modal-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "리소스 관리자" },
        children: [
          el("header", {
            class: "database-modal-header",
            children: [el("h2", { text: "리소스 관리자" }), closeButton],
          }),
          body,
        ],
      }),
    ],
  });

  const close = (): void => {
    backdrop.remove();
    document.removeEventListener("keydown", onKeyDown);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", onKeyDown);
  document.body.append(backdrop);
  renderResourceManager(body);
  closeButton.focus();
}
