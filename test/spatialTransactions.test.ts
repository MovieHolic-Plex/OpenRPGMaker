/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { store } from "../src/project/store";
import { objectStampFixture, spaceCompilerFixture, spaceRoot } from "./support/spatialSpaceCompilerFixture";
import { placeCompilerFixture, placeRoot } from "./support/spatialPlaceCompilerFixture";
import type { SpatialAuthoringResult } from "../src/editor/spatial/authoringTypes";

function ok<T>(result: SpatialAuthoringResult<T>): T {
  switch (result.kind) {
    case "ok": return result.value;
    case "error": throw new TypeError(JSON.stringify(result.error));
  }
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory();
});
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it.each(["object", "space", "place"] as const)("applies one exact undoable transaction when %s compilation is accepted", kind => {
  // Given a real project/store with frozen occurrences, not a mock persistence service.
  const object = objectStampFixture();
  const project = kind === "object" ? object.project : kind === "space" ? spaceCompilerFixture() : placeCompilerFixture();
  const compile = kind === "object" ? { occurrenceId: object.occurrenceId, target: object.target }
    : { occurrenceId: kind === "space" ? spaceRoot : placeRoot };
  store.replace(project);
  const before = structuredClone(store.getCurrent());
  const controller = createSpatialAuthoringController();
  const draft = ok(controller.createDraft());
  // When a detached proposal is compiled and accepted.
  const preview = ok(controller.preview(draft, { operation: { kind: "edit" }, compile }));
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
  const applied = ok(controller.apply(preview));
  // Then one history entry contains all maps, events and spatial metadata.
  expect(applied.changed).toBe(true);
  expect(getMapEditHistoryEntries()).toHaveLength(1);
  const after = structuredClone(store.getCurrent());
  expect(after).toEqual(preview.project);
  expect(controller.undo()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
  expect(controller.redo()).toBe(true);
  expect(store.getCurrent()).toEqual(after);
});
