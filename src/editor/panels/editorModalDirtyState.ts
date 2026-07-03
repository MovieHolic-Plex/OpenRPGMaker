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
  readonly addEventListener: (type: string, listener: EventListenerOrEventListenerObject | null) => void;
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
      if ("key" in event && event.key === "Escape") requestClose("escape");
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
