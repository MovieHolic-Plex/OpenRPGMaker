import { renderDatabasePanel } from "@/editor/panels/database";
import { hideRightPanel, showRightPanel } from "@/editor/panels/editor";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

type ModalDragState = {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly windowEl: HTMLElement;
};

let modalDragState: ModalDragState | null = null;

export function openDatabaseModal(): void {
  document.querySelector("[data-testid='database-modal']")?.remove();
  // 우측 패널이 같은 testId 컨트롤을 렌더하므로 충돌 방지를 위해 숨긴다.
  hideRightPanel();

  const body = el("div", { class: "database-modal-body" });
  const maximizeButton = el("button", {
    class: "database-modal-maximize",
    text: "□",
    attrs: { type: "button", title: "전체 화면", "aria-label": "데이터베이스 전체 화면" },
    dataset: { testid: "database-modal-maximize" },
  }) as HTMLButtonElement;
  const closeButton = el("button", {
    class: "database-modal-close",
    text: "x",
    attrs: { type: "button", title: "닫기", "aria-label": "데이터베이스 닫기" },
    dataset: { testid: "database-modal-close" },
  }) as HTMLButtonElement;
  const windowControls = el("div", {
    class: "database-modal-controls",
    children: [maximizeButton, closeButton],
  });
  const header = el("header", {
    class: "database-modal-header",
    children: [el("h2", { text: "데이터베이스" }), windowControls],
  });
  const backdrop = el("div", {
    class: "database-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "database-modal" },
    children: [
      el("section", {
        class: "database-modal-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "데이터베이스" },
        children: [header, body],
      }),
    ],
  });

  const close = (): void => {
    backdrop.remove();
    document.removeEventListener("keydown", onKeyDown);
    stopModalDrag();
    showRightPanel();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };

  closeButton.addEventListener("click", close);
  maximizeButton.addEventListener("click", () => toggleMaximizedDatabaseModal(maximizeButton));
  header.addEventListener("dblclick", () => toggleMaximizedDatabaseModal(maximizeButton));
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", onKeyDown);
  const footer = el("footer", {
    class: "database-modal-footer",
    children: [
      el("button", { class: "database-footer-button primary", text: "OK", on: { click: close } }),
      el("button", { class: "database-footer-button", text: "취소", on: { click: close } }),
      el("button", { class: "database-footer-button", text: "적용", on: { click: () => void applyDatabaseChanges() } }),
      el("button", {
        class: "database-footer-button",
        text: "도움말",
        on: { click: () => toast("데이터베이스에서 레코드와 시스템 설정을 조정합니다.", "ok") },
      }),
    ],
  });
  const windowEl = backdrop.querySelector(".database-modal-window");
  if (windowEl instanceof HTMLElement) {
    header.addEventListener("mousedown", (event) => startModalDrag(windowEl, event));
  }
  windowEl?.append(footer);
  document.body.append(backdrop);
  renderDatabasePanel(body);
  closeButton.focus();
}

async function applyDatabaseChanges(): Promise<void> {
  try {
    await store.flush();
    toast("적용했습니다.", "ok");
  } catch (error) {
    if (error instanceof Error) {
      toast(`적용 실패: ${error.message}`, "error");
      return;
    }
    throw error;
  }
}

function toggleMaximizedDatabaseModal(button: HTMLButtonElement): void {
  const windowEl = button.closest(".database-modal-window");
  if (!(windowEl instanceof HTMLElement)) return;
  const isMaximized = windowEl.classList.toggle("maximized");
  if (isMaximized) {
    stopModalDrag();
    windowEl.classList.remove("floating");
    windowEl.style.left = "";
    windowEl.style.top = "";
    windowEl.style.width = "";
    windowEl.style.height = "";
  }
  button.textContent = isMaximized ? "▣" : "□";
  button.title = isMaximized ? "창 크기로 복원" : "전체 화면";
  button.setAttribute("aria-label", isMaximized ? "데이터베이스 창 크기로 복원" : "데이터베이스 전체 화면");
}

function startModalDrag(windowEl: HTMLElement, event: MouseEvent): void {
  if (event.button !== 0 || windowEl.classList.contains("maximized")) return;
  const target = event.target;
  if (target instanceof HTMLButtonElement) return;
  event.preventDefault();
  const rect = windowEl.getBoundingClientRect();
  windowEl.classList.add("floating");
  windowEl.style.left = `${rect.left}px`;
  windowEl.style.top = `${rect.top}px`;
  windowEl.style.width = `${rect.width}px`;
  windowEl.style.height = `${rect.height}px`;
  modalDragState = {
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    windowEl,
  };
  document.body.classList.add("database-modal-dragging");
  window.addEventListener("mousemove", handleModalDragMove);
  window.addEventListener("mouseup", stopModalDrag);
}

function handleModalDragMove(event: MouseEvent): void {
  if (!modalDragState) return;
  const rect = modalDragState.windowEl.getBoundingClientRect();
  const maxLeft = Math.max(window.innerWidth - rect.width - 4, 4);
  const maxTop = Math.max(window.innerHeight - rect.height - 4, 4);
  modalDragState.windowEl.style.left = `${clamp(event.clientX - modalDragState.offsetX, 4, maxLeft)}px`;
  modalDragState.windowEl.style.top = `${clamp(event.clientY - modalDragState.offsetY, 4, maxTop)}px`;
}

function stopModalDrag(): void {
  modalDragState = null;
  document.body.classList.remove("database-modal-dragging");
  window.removeEventListener("mousemove", handleModalDragMove);
  window.removeEventListener("mouseup", stopModalDrag);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
