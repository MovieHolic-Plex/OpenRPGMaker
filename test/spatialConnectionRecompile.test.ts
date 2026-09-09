/** @vitest-environment happy-dom */
import assert from "node:assert/strict";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { own } from "../src/project/spatial/domain";
import { spatialPortLanding } from "../src/project/spatial/overview";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { renameEvents, sharedFixture } from "./support/spatialConnectionIdentityFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { placeRoot } from "./support/spatialPlaceCompilerFixture";
import { inspectNestedTraversal } from "./support/spatialPlaceTraversal";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory();
});
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it("retains proven transfer IDs but updates commands when the same concrete port moves", () => {
  // Given: valid opaque persisted pairs and the exact endpoint occurrence moved on its shared map.
  const scene = sharedFixture();
  const input = renameEvents(scene.project, scene.project.mapConnections?.map(pair => pair.id) ?? []);
  expect(inspectNestedTraversal(input).routes).toHaveLength(4);
  store.replace(input);
  resetMapEditHistory();
  const before = structuredClone(store.getCurrent());
  const controller = createSpatialAuthoringController();
  const draft = authoringValue(controller.createDraft());
  const document = fixtureDocument(draft.project);
  const occurrence = own(document.occurrences, scene.parallel.to.occurrenceId);
  const oldLanding = spatialPortLanding(document, scene.parallel.to);
  assert.ok(oldLanding);
  draft.project.spatialAuthoring = { ...document, occurrences: { ...document.occurrences,
    [occurrence.id]: { ...occurrence, x: occurrence.x + 3 },
  } };
  // When: normal containing recompile accepts the moved occurrence, not a raw map/transfer edit.
  const preview = authoringValue(controller.preview(draft, { operation: { kind: "edit" }, compile: { occurrenceId: placeRoot } }));
  authoringValue(controller.apply(preview));
  // Then: exact old IDs remain, while real interpreter destinations use the new bound port.
  const accepted = structuredClone(store.getCurrent());
  const landing = spatialPortLanding(fixtureDocument(accepted), scene.parallel.to);
  expect(landing).toEqual({ ...oldLanding, x: oldLanding.x + 3 });
  expect(accepted.mapConnections?.map(pair => pair.id)).toEqual(before.mapConnections?.map(pair => pair.id));
  const traversal = inspectNestedTraversal(accepted);
  expect(traversal.routes.some(route => JSON.stringify(route.to) === JSON.stringify(landing))).toBe(true);
  expect(traversal.routes.some(route => JSON.stringify(route.to) === JSON.stringify(oldLanding))).toBe(false);
  expect(controller.undo()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
  expect(controller.undo()).toBe(false);
  expect(controller.redo()).toBe(true);
  expect(store.getCurrent()).toEqual(accepted);
});

it("rejects old transfer proof when the logical endpoint no longer matches its persisted pair", () => {
  // Given: valid owned opaque transfers, but a raw graph edit points at a different concrete target.
  const scene = sharedFixture();
  store.replace(renameEvents(scene.project, scene.project.mapConnections?.map(pair => pair.id) ?? []));
  resetMapEditHistory();
  const controller = createSpatialAuthoringController();
  const before = structuredClone(store.getCurrent());
  const draft = authoringValue(controller.createDraft());
  const document = fixtureDocument(draft.project);
  draft.project.spatialAuthoring = { ...document, connections: document.connections.map(link => link.id === scene.parallel.id
    ? { ...link, to: scene.selected.to } : link) };
  // When: normal compilation is asked to re-use mismatched old graph/output as though it were unchanged.
  const result = controller.preview(draft, { operation: { kind: "edit" }, compile: { occurrenceId: placeRoot } });
  // Then: recompile rejects before adoption rather than patching old commands onto the new endpoint.
  expect(result).toMatchObject({ kind: "error", error: { code: "ownership" } });
  expect(store.getCurrent()).toEqual(before);
  expect(controller.undo()).toBe(false);
});
