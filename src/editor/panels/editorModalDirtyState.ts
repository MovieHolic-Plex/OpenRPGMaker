import { hasOpenModalLayer } from "@/editor/ui/modalStack";

export const EDITOR_MODAL_DIRTY_DECISION = {
  Save: "save",
  Discard: "discard",
  KeepEditing: "keep-editing",
} as const;

export type EditorModalDirtyDecision =
  (typeof EDITOR_MODAL_DIRTY_DECISION)[keyof typeof EDITOR_MODAL_DIRTY_DECISION];

export type EditorModalCloseAttempt = "cancel" | "escape" | "backdrop" | "x";

type EditorModalDirtyCloseOptions = {
  readonly isDirty: () => boolean;
  readonly promptUnsavedChanges: (attempt: EditorModalCloseAttempt) => EditorModalDirtyDecision;
  readonly save: () => void;
  readonly discard: () => void;
  readonly close: () => void;
};

type EditorModalBindableElement = {
  readonly addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
};

export type EditorModalDirtyCloseController = {
  readonly requestClose: (attempt: EditorModalCloseAttempt) => void;
  readonly handleKeyDown: (event: Event) => void;
  readonly handleBackdropMouseDown: (event: Event, backdrop: object) => void;
  readonly bindCancelButton: (button: EditorModalBindableElement) => void;
  readonly bindCloseButton: (button: EditorModalBindableElement) => void;
};

export function createEditorModalDirtyCloseController(
  options: EditorModalDirtyCloseOptions
): EditorModalDirtyCloseController {
  const requestClose = (attempt: EditorModalCloseAttempt): void => {
    if (!options.isDirty()) {
      options.close();
      return;
    }
    const decision = options.promptUnsavedChanges(attempt);
    switch (decision) {
      case EDITOR_MODAL_DIRTY_DECISION.Save:
        options.save();
        options.close();
        return;
      case EDITOR_MODAL_DIRTY_DECISION.Discard:
        options.discard();
        options.close();
        return;
      case EDITOR_MODAL_DIRTY_DECISION.KeepEditing:
        return;
      default:
        assertNever(decision);
    }
  };

  return {
    requestClose,
    handleKeyDown: (event) => {
      if (!("key" in event) || event.key !== "Escape") return;
      // 타일셋 우클릭 메뉴·의미 편집 등 중첩 UI가 Escape 를 이미 처리한 경우
      if (typeof event.defaultPrevented === "boolean" && event.defaultPrevented) return;
      // 모달 스택에 등록된 중첩 창이 살아 있으면 Escape 는 그쪽 몫이다. defaultPrevented
      // 에만 기대면 리스너 등록 순서에 따라 이 핸들러가 먼저 돌아 바깥 모달이 닫힌다.
      if (hasOpenModalLayer()) return;
      // stopImmediatePropagation 으로 여기까지 안 오는 게 정석이지만, 방어적으로 한 번 더 검사.
      const nested =
        typeof document !== "undefined"
        && (document.querySelector('[data-testid="tileset-tile-context-menu"]')
          || document.querySelector('[data-testid="tileset-meaning-dialog"]'));
      if (nested) return;
      requestClose("escape");
    },
    handleBackdropMouseDown: (event, backdrop) => {
      if (event.target === backdrop) requestClose("backdrop");
    },
    bindCancelButton: (button) => {
      button.addEventListener("click", () => requestClose("cancel"));
    },
    bindCloseButton: (button) => {
      button.addEventListener("click", () => requestClose("x"));
    },
  };
}

function assertNever(value: never): never {
  throw new Error(`Unexpected editor modal dirty decision: ${String(value)}`);
}
