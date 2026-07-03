import { renderDatabasePanel, setDatabaseActiveTab, type DatabaseTab } from "@/editor/panels/database";
import { createDatabaseModalDirtySession } from "@/editor/panels/databaseModalDirtySession";
import { applyDatabaseChanges } from "@/editor/panels/databaseModalPersistence";
import { startModalDrag, stopModalDrag } from "@/editor/panels/databaseModalWindowDrag";
import { DATABASE_FOOTER_ACTION_TEST_IDS, databaseFooterStatusText } from "@/editor/panels/databaseWorkbench";
import {
  createEditorModalDirtyCloseController,
  EDITOR_MODAL_DIRTY_DECISION,
  type EditorModalCloseAttempt,
  type EditorModalDirtyDecision,
} from "@/editor/panels/editorModalDirtyState";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

export function openDatabaseModal(initialTab?: DatabaseTab): void {
  document.querySelector("[data-testid='database-modal']")?.remove();
  if (initialTab) setDatabaseActiveTab(initialTab);
  const dirtySession = createDatabaseModalDirtySession();

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
    document.removeEventListener("keydown", controller.handleKeyDown);
    stopModalDrag();
  };
  const hideDirtyPrompt = (): void => dirtyPrompt.replaceChildren();
  const saveAndMarkClean = async (): Promise<boolean> => {
    footerStatus.textContent = "변경 내용을 저장하는 중입니다.";
    const saved = await applyDatabaseChanges(footerStatus);
    if (saved) dirtySession.markClean();
    return saved;
  };
  const handleDirtyDecision = (decision: EditorModalDirtyDecision): void => {
    switch (decision) {
      case EDITOR_MODAL_DIRTY_DECISION.Save:
        void saveAndMarkClean().then((saved) => {
          if (saved) close();
        });
        return;
      case EDITOR_MODAL_DIRTY_DECISION.Discard:
        dirtySession.discard();
        close();
        return;
      case EDITOR_MODAL_DIRTY_DECISION.KeepEditing:
        hideDirtyPrompt();
        closeButton.focus();
        return;
    }
  };
  const showDirtyPrompt = (attempt: EditorModalCloseAttempt): EditorModalDirtyDecision => {
    dirtyPrompt.replaceChildren(renderDirtyPrompt(attempt, handleDirtyDecision));
    return EDITOR_MODAL_DIRTY_DECISION.KeepEditing;
  };
  const controller = createEditorModalDirtyCloseController({
    isDirty: dirtySession.isDirty,
    promptUnsavedChanges: showDirtyPrompt,
    save: () => {
      void saveAndMarkClean();
    },
    discard: dirtySession.discard,
    close,
  });

  controller.bindCloseButton(closeButton);
  maximizeButton.addEventListener("click", () => toggleMaximizedDatabaseModal(maximizeButton));
  header.addEventListener("dblclick", () => toggleMaximizedDatabaseModal(maximizeButton));
  backdrop.addEventListener("mousedown", (event) => controller.handleBackdropMouseDown(event, backdrop));
  document.addEventListener("keydown", controller.handleKeyDown);
  const footerStatus = el("div", {
    class: "database-footer-status",
    attrs: { "aria-live": "polite" },
    dataset: { testid: "db-footer-status" },
    text: databaseFooterStatusText(),
  });
  const dirtyPrompt = el("div", {
    class: "database-modal-dirty-prompt-region",
    dataset: { testid: "database-dirty-prompt-region" },
  });
  const footer = el("footer", {
    class: "database-modal-footer",
    children: [
      footerStatus,
      dirtyPrompt,
      el("button", {
        class: "database-footer-button primary",
        text: "OK",
        attrs: { type: "button" },
        dataset: { testid: DATABASE_FOOTER_ACTION_TEST_IDS.ok },
        on: { click: () => controller.requestClose("cancel") },
      }),
      el("button", {
        class: "database-footer-button",
        text: "취소",
        attrs: { type: "button" },
        dataset: { testid: DATABASE_FOOTER_ACTION_TEST_IDS.cancel },
      }),
      el("button", {
        class: "database-footer-button",
        text: "적용",
        attrs: { type: "button" },
        dataset: { testid: DATABASE_FOOTER_ACTION_TEST_IDS.apply },
        on: {
          click: () => {
            hideDirtyPrompt();
            void saveAndMarkClean();
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
  controller.bindCancelButton(footer.querySelector(`[data-testid='${DATABASE_FOOTER_ACTION_TEST_IDS.cancel}']`) ?? closeButton);
  const windowEl = backdrop.querySelector(".database-modal-window");
  if (windowEl instanceof HTMLElement) {
    header.addEventListener("mousedown", (event) => startModalDrag(windowEl, event));
  }
  windowEl?.append(footer);
  document.body.append(backdrop);
  renderDatabasePanel(body);
  closeButton.focus();
}

function renderDirtyPrompt(
  attempt: EditorModalCloseAttempt,
  onDecision: (decision: EditorModalDirtyDecision) => void
): HTMLElement {
  return el("section", {
    class: "database-modal-dirty-prompt",
    attrs: { "aria-label": "저장하지 않은 데이터베이스 변경" },
    dataset: { closeAttempt: attempt, testid: "database-dirty-prompt" },
    children: [
      el("strong", { text: "저장하지 않은 DB 변경이 있습니다." }),
      el("span", { text: closeAttemptMessage(attempt) }),
      dirtyPromptButton("저장", "database-dirty-save", EDITOR_MODAL_DIRTY_DECISION.Save, onDecision, "primary"),
      dirtyPromptButton("버리기", "database-dirty-discard", EDITOR_MODAL_DIRTY_DECISION.Discard, onDecision),
      dirtyPromptButton("계속 편집", "database-dirty-keep-editing", EDITOR_MODAL_DIRTY_DECISION.KeepEditing, onDecision),
    ],
  });
}

function dirtyPromptButton(
  text: string,
  testid: string,
  decision: EditorModalDirtyDecision,
  onDecision: (decision: EditorModalDirtyDecision) => void,
  variant = ""
): HTMLElement {
  return el("button", {
    class: `database-footer-button ${variant}`.trim(),
    text,
    attrs: { type: "button" },
    dataset: { testid },
    on: { click: () => onDecision(decision) },
  });
}

function closeAttemptMessage(attempt: EditorModalCloseAttempt): string {
  switch (attempt) {
    case "cancel":
      return "닫기 전에 저장하거나, 모달을 열 때의 DB 상태로 되돌릴 수 있습니다.";
    case "escape":
      return "Escape로 닫기 전에 변경 내용을 어떻게 처리할지 선택하세요.";
    case "backdrop":
      return "바깥 영역을 눌러 닫기 전에 변경 내용을 어떻게 처리할지 선택하세요.";
    case "x":
      return "닫기 버튼을 누르기 전에 변경 내용을 어떻게 처리할지 선택하세요.";
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
