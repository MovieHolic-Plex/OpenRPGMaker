/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { deserialize, serialize } from "../src/project/io";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { geographyRoot } from "./support/spatialGeographyFixture";
import { geographyControllerFault } from "./support/spatialGeographyControllerFixture";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory();
});
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it.each([
  { fault: "narrow-mountain", detail: "invalid-args" },
  { fault: "mountain-overflow", detail: "out-of-bounds" },
  { fault: "shared-atlas", detail: "shared-structure-tileset" },
  { fault: "blocked-route", detail: "blocked" },
] as const)("returns a structured error without mutation when $fault reaches the real geography primitives", ({ fault, detail }) => {
  // Given schema-valid authoring data that violates a primitive precondition, not a mocked compiler.
  store.replace(deserialize(serialize(geographyControllerFault(fault))));
  const before = serialize(store.getCurrent());
  const controller = createSpatialAuthoringController();
  const draft = authoringValue(controller.createDraft());
  // When actual region compilation reaches its bounded validation or ownership rejection.
  const result = controller.preview(draft, { operation: { kind: "edit" }, compile: { occurrenceId: geographyRoot } });
  // Then the UI receives a typed result, with no partial maps, shared atlas edits or history.
  expect(result).toMatchObject({ kind: "error", error: { code: "invalid", detail } });
  expect(serialize(store.getCurrent())).toBe(before);
  expect(getMapEditHistoryEntries()).toEqual([]);
});
