import { handleHistoryHotkey } from "@/editor/hotkeys";
import { refreshDatabasePanel, renderDatabasePanel, setDatabaseActiveTab, type DatabaseTab } from "@/editor/panels/database";
import { createDatabaseModalDirtySession } from "@/editor/panels/databaseModalDirtySession";
import { applyDatabaseChanges } from "@/editor/panels/databaseModalPersistence";
import { startModalDrag, stopModalDrag } from "@/editor/panels/databaseModalWindowDrag";
import { resetDatabaseRecordViewSession } from "@/editor/panels/databaseRecordViews";
import { DATABASE_FOOTER_ACTION_TEST_IDS, databaseFooterStatusText } from "@/editor/panels/databaseWorkbench";
import {
  createEditorModalDirtyCloseController,
  EDITOR_MODAL_DIRTY_DECISION,
  type EditorModalCloseAttempt,
  type EditorModalDirtyDecision,
} from "@/editor/panels/editorModalDirtyState";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

type ActiveDatabaseModalHandle = {
  readonly close: () => void;
  readonly requestClose: (attempt: EditorModalCloseAttempt) => void;
};

let activeModal: ActiveDatabaseModalHandle | null = null;

// 모달 내부의 다른 뷰(예: 트룹의 "전투 테스트" 버튼)가 모달을 닫아야 할 때 쓰는 훅.
// document.querySelector(...)?.remove()로 DOM만 뜯어내면 openDatabaseModal이 등록한
// document keydown 리스너 2개가 정리되지 않고 남는다(M11) — 반드시 이 훅을 통해서만 닫는다.
//
// "battleTest"는 읽기 행위이므로 dirty 세션 확인 없이 즉시 close()만 수행한다(리스너 정리가
// 목적) — discard는 하지 않는다. 자동 저장 모델이라 데이터는 이미 안전하다(C2와 정합).
// 그 외 reason은 기존처럼 controller.requestClose를 거쳐 dirty 프롬프트를 존중한다.
export function requestDatabaseModalClose(reason: EditorModalCloseAttempt | "battleTest"): void {
  if (!activeModal) return;
  if (reason === "battleTest") {
    activeModal.close();
    return;
  }
  activeModal.requestClose(reason);
}

export function openDatabaseModal(initialTab?: DatabaseTab): void {
  document.querySelector("[data-testid='database-modal']")?.remove();
  if (initialTab) setDatabaseActiveTab(initialTab);
  resetDatabaseRecordViewSession();
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

  // 데이터베이스 모달이 열려 있어도 Ctrl+Z/Y 로 undo/redo 하고, 복원된 프로젝트 상태를
  // 패널에 다시 반영한다(입력 필드 포커스 중에는 브라우저 텍스트 undo 우선 — 가드 유지).
  const handleHistoryKeyDown = (event: KeyboardEvent): void => {
    // undo/redo 후에도 부분 갱신 경로를 타서 스크롤/선택/검색 상태를 보존한다.
    if (handleHistoryHotkey(event)) refreshDatabasePanel(body);
  };
  const close = (): void => {
    backdrop.remove();
    document.removeEventListener("keydown", controller.handleKeyDown);
    document.removeEventListener("keydown", handleHistoryKeyDown);
    stopModalDrag();
    activeModal = null;
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

  activeModal = { close, requestClose: controller.requestClose };
  controller.bindCloseButton(closeButton);
  maximizeButton.addEventListener("click", () => toggleMaximizedDatabaseModal(maximizeButton));
  header.addEventListener("dblclick", () => toggleMaximizedDatabaseModal(maximizeButton));
  backdrop.addEventListener("mousedown", (event) => controller.handleBackdropMouseDown(event, backdrop));
  document.addEventListener("keydown", controller.handleKeyDown);
  document.addEventListener("keydown", handleHistoryKeyDown);
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
        text: "닫기",
        attrs: { type: "button" },
        dataset: { testid: DATABASE_FOOTER_ACTION_TEST_IDS.ok },
        on: { click: () => controller.requestClose("cancel") },
      }),
      el("button", {
        class: "database-footer-button",
        text: "지금 저장",
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
    attrs: { "aria-label": "이 세션에서 바뀐 데이터베이스 내용" },
    dataset: { closeAttempt: attempt, testid: "database-dirty-prompt" },
    children: [
      el("strong", { text: "이 세션에서 바뀐 내용이 있습니다. 어떻게 할까요?" }),
      el("span", { text: closeAttemptMessage(attempt) }),
      dirtyPromptButton("저장하고 닫기", "database-dirty-save", EDITOR_MODAL_DIRTY_DECISION.Save, onDecision, "primary"),
      dirtyPromptButton("열 때 상태로 되돌리고 닫기", "database-dirty-discard", EDITOR_MODAL_DIRTY_DECISION.Discard, onDecision),
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
  const restoreNote = "되돌리기는 이 모달을 연 시점의 DB 상태로 복구합니다.";
  switch (attempt) {
    case "cancel":
      return `닫기 전에 저장하거나 되돌릴지 선택하세요. ${restoreNote}`;
    case "escape":
      return `Escape로 닫기 전에 저장하거나 되돌릴지 선택하세요. ${restoreNote}`;
    case "backdrop":
      return `바깥 영역을 눌러 닫기 전에 저장하거나 되돌릴지 선택하세요. ${restoreNote}`;
    case "x":
      return `닫기 버튼을 누르기 전에 저장하거나 되돌릴지 선택하세요. ${restoreNote}`;
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
