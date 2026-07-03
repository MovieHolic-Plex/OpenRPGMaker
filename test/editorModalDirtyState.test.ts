import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEditorModalDirtyCloseController,
  EDITOR_MODAL_DIRTY_DECISION,
  type EditorModalCloseAttempt,
  type EditorModalDirtyDecision,
} from "@/editor/panels/editorModalDirtyState";
import { FakeElement, installFakeDom } from "./fakeDom";

type DirtyCloseHarness = {
  readonly backdrop: FakeElement;
  readonly cancelButton: FakeElement;
  readonly closeButton: FakeElement;
  readonly calls: readonly string[];
  readonly decisions: readonly EditorModalCloseAttempt[];
  readonly setDirty: (dirty: boolean) => void;
  readonly setDecision: (decision: EditorModalDirtyDecision) => void;
};

function createHarness(): DirtyCloseHarness {
  let dirty = false;
  let decision: EditorModalDirtyDecision = EDITOR_MODAL_DIRTY_DECISION.KeepEditing;
  const calls: string[] = [];
  const decisions: EditorModalCloseAttempt[] = [];
  const backdrop = new FakeElement("div");
  const cancelButton = new FakeElement("button");
  const closeButton = new FakeElement("button");
  const controller = createEditorModalDirtyCloseController({
    isDirty: () => dirty,
    promptUnsavedChanges: (attempt) => {
      decisions.push(attempt);
      return decision;
    },
    save: () => calls.push("save"),
    discard: () => calls.push("discard"),
    close: () => calls.push("close"),
  });
  controller.bindCancelButton(cancelButton);
  controller.bindCloseButton(closeButton);
  backdrop.addEventListener("mousedown", (event) => controller.handleBackdropMouseDown(event, backdrop));
  backdrop.addEventListener("keydown", controller.handleKeyDown);
  return {
    backdrop,
    cancelButton,
    closeButton,
    calls,
    decisions,
    setDirty: (nextDirty) => {
      dirty = nextDirty;
    },
    setDecision: (nextDecision) => {
      decision = nextDecision;
    },
  };
}

function eventWithTarget(type: string, target: object): Event {
  const event = new Event(type);
  Object.defineProperty(event, "target", { configurable: true, value: target });
  return event;
}

function escapeKeyDown(): Event {
  const event = new Event("keydown");
  Object.defineProperty(event, "key", { configurable: true, value: "Escape" });
  return event;
}

describe("editor modal dirty close controller", () => {
  let restoreDom: () => void;

  beforeEach(() => {
    restoreDom = installFakeDom();
  });

  afterEach(() => {
    restoreDom();
    vi.restoreAllMocks();
  });

  it("closes immediately without prompting when the modal is clean", () => {
    const harness = createHarness();

    harness.cancelButton.dispatchEvent(new Event("click"));

    expect(harness.calls).toEqual(["close"]);
    expect(harness.decisions).toEqual([]);
  });

  it("saves and closes when a dirty cancel attempt chooses Save", () => {
    const harness = createHarness();
    harness.setDirty(true);
    harness.setDecision(EDITOR_MODAL_DIRTY_DECISION.Save);

    harness.cancelButton.dispatchEvent(new Event("click"));

    expect(harness.decisions).toEqual(["cancel"]);
    expect(harness.calls).toEqual(["save", "close"]);
  });

  it("discards and closes when a dirty Escape attempt chooses Discard", () => {
    const harness = createHarness();
    harness.setDirty(true);
    harness.setDecision(EDITOR_MODAL_DIRTY_DECISION.Discard);

    harness.backdrop.dispatchEvent(escapeKeyDown());

    expect(harness.decisions).toEqual(["escape"]);
    expect(harness.calls).toEqual(["discard", "close"]);
  });

  it("keeps editing when a dirty backdrop attempt chooses Keep Editing", () => {
    const harness = createHarness();
    harness.setDirty(true);
    harness.setDecision(EDITOR_MODAL_DIRTY_DECISION.KeepEditing);

    harness.backdrop.dispatchEvent(eventWithTarget("mousedown", harness.backdrop));

    expect(harness.decisions).toEqual(["backdrop"]);
    expect(harness.calls).toEqual([]);
  });

  it("does not prompt when backdrop mousedown starts inside the dialog window", () => {
    const harness = createHarness();
    const windowEl = new FakeElement("section");
    harness.setDirty(true);
    harness.backdrop.append(windowEl);

    harness.backdrop.dispatchEvent(eventWithTarget("mousedown", windowEl));

    expect(harness.decisions).toEqual([]);
    expect(harness.calls).toEqual([]);
  });

  it("uses the same dirty prompt path for the X close button", () => {
    const harness = createHarness();
    harness.setDirty(true);
    harness.setDecision(EDITOR_MODAL_DIRTY_DECISION.Discard);

    harness.closeButton.dispatchEvent(new Event("click"));

    expect(harness.decisions).toEqual(["x"]);
    expect(harness.calls).toEqual(["discard", "close"]);
  });
});
