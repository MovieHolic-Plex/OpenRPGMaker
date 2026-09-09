import { afterEach, beforeEach, expect, vi } from "vitest";
import { editorState } from "../../src/editor/editorState";
import { getMapEditHistoryEntries, redoMapEdit, resetMapEditHistory, undoMapEdit } from "../../src/editor/mapEditHistory";
import { applyAuthoringPreview, bindSpatialAuthoringControllerFactory, spatialAuthoringController } from "../../src/editor/panels/spatialAuthoringAccess";
import { resetSpatialAuthoringSessions } from "../../src/editor/panels/spatialAuthoringSession";
import type { SpatialAuthoringPreview } from "../../src/editor/spatial/authoringTypes";
import { deserialize, serialize, serializePretty } from "../../src/project/io";
import { store } from "../../src/project/store";
import type { Project } from "../../src/project/types";
import { authoringValue } from "./spatialAuthoringFixture";

export function setupCombinedAuthoring(): void {
  const previous = store.getCurrent();
  const previousEditor = editorState.get();
  beforeEach(() => {
    // Freeze only background scheduling; controller/compiler/history remain real and synchronous.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  });
  afterEach(() => {
    bindSpatialAuthoringControllerFactory(null);
    resetSpatialAuthoringSessions();
    store.replace(previous, { preserveEventDrafts: false });
    editorState.set(previousEditor);
    resetMapEditHistory();
    vi.clearAllTimers();
    vi.useRealTimers();
  });
}

export function sharedController() {
  const controller = spatialAuthoringController();
  if (!controller) throw new TypeError("Missing shared fixture controller");
  return controller;
}

/** Assert the public shared acceptance transaction, including both canonical wire formats. */
export function expectAcceptedTransaction(before: Project, preview: SpatialAuthoringPreview): void {
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
  expect(authoringValue(applyAuthoringPreview()).changed).toBe(true);
  const accepted = structuredClone(store.getCurrent());
  expect(accepted).toEqual(preview.project);
  expect(deserialize(serialize(accepted))).toEqual(accepted);
  expect(deserialize(serializePretty(accepted))).toEqual(accepted);
  expect(getMapEditHistoryEntries()).toHaveLength(1);
  expect(undoMapEdit()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
  expect(undoMapEdit()).toBe(false);
  expect(redoMapEdit()).toBe(true);
  expect(store.getCurrent()).toEqual(accepted);
  expect(redoMapEdit()).toBe(false);
}
