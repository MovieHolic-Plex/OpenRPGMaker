import { renderDatabasePanel, setDatabaseActiveTab, type DatabaseTab } from "@/editor/panels/database";
import { DATABASE_FOOTER_ACTION_TEST_IDS, databaseFooterStatusText } from "@/editor/panels/databaseWorkbench";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

type ModalDragState = {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly windowEl: HTMLElement;
};

let modalDragState: ModalDragState | null = null;

export function openDatabaseModal(initialTab?: DatabaseTab): void {
  document.querySelector("[data-testid='database-modal']")?.remove();
  if (initialTab) setDatabaseActiveTab(initialTab);

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
  const footerStatus = el("div", {
    class: "database-footer-status",
    attrs: { "aria-live": "polite" },
    dataset: { testid: "db-footer-status" },
    text: databaseFooterStatusText(),
  });
  const footer = el("footer", {
    class: "database-modal-footer",
    children: [
      footerStatus,
      el("button", {
        class: "database-footer-button primary",
        text: "OK",
        attrs: { type: "button" },
        dataset: { testid: DATABASE_FOOTER_ACTION_TEST_IDS.ok },
        on: { click: close },
      }),
      el("button", {
        class: "database-footer-button",
        text: "취소",
        attrs: { type: "button" },
        dataset: { testid: DATABASE_FOOTER_ACTION_TEST_IDS.cancel },
        on: { click: close },
      }),
      el("button", {
        class: "database-footer-button",
        text: "적용",
        attrs: { type: "button" },
        dataset: { testid: DATABASE_FOOTER_ACTION_TEST_IDS.apply },
        on: {
          click: () => {
            footerStatus.textContent = "변경 내용을 저장하는 중입니다.";
            void applyDatabaseChanges(footerStatus);
          },
        },
      }),
      el("button", {
        class: "database-footer-button",
        text: "도움말",
        attrs: { type: "button" },
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

async function applyDatabaseChanges(status: HTMLElement): Promise<void> {
  try {
    const result = await store.flush();
    switch (result.kind) {
      case "saved":
        status.textContent = "적용했습니다. DB에 저장했습니다. 닫아도 안전합니다.";
        toast("DB에 저장했습니다.", "ok");
        return;
      case "saved-local":
        status.textContent = "적용했습니다. 브라우저에 저장했습니다. 닫아도 안전합니다.";
        toast("브라우저에 저장했습니다.", "ok");
        return;
      case "not-loaded":
        status.textContent = "프로젝트를 아직 불러오는 중이라 저장하지 않았습니다.";
        toast("아직 프로젝트를 불러오는 중입니다.", "error");
        return;
      case "conflict":
        status.textContent = `${conflictMapNames(result.conflicts)} 맵이 다른 세션에서 먼저 바뀌어 저장하지 않았습니다.`;
        toast("저장 충돌이 있습니다.", "error");
        return;
      case "not-configured":
        status.textContent = "DB 저장 설정이 없습니다. Supabase 환경 설정을 확인하세요.";
        toast("DB 저장 설정이 없습니다.", "error");
        return;
      case "disabled":
        status.textContent = "DB 저장이 비활성화되어 저장하지 못했습니다.";
        toast("DB 저장이 비활성화되어 있습니다.", "error");
        return;
    }
  } catch (error) {
    if (error instanceof Error) {
      status.textContent = "적용 실패. 메시지를 확인하세요.";
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

function conflictMapNames(conflicts: readonly { readonly name: string }[]): string {
  return conflicts.map((conflict) => conflict.name).join(", ") || "현재";
}
