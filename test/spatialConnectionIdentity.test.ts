/** @vitest-environment happy-dom */
import assert from "node:assert/strict";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import type { SpatialConnectionEdit } from "../src/editor/spatial/authoringTypes";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { deserialize, serialize } from "../src/project/io";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { assertNever, own, resolveOccurrencePortId, spatialId } from "../src/project/spatial/domain";
import { spatialPortLanding } from "../src/project/spatial/overview";
import type { SpatialConnection } from "../src/project/spatial/types";
import type { Project } from "../src/project/types";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { placeChild, placeRoot } from "./support/spatialPlaceCompilerFixture";
import { inspectNestedTraversal } from "./support/spatialPlaceTraversal";
import { parallelFixture, renameEvents, sharedFixture } from "./support/spatialConnectionIdentityFixture";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory();
});
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

function begin(project: Project) {
  store.replace(deserialize(serialize(project)));
  resetMapEditHistory();
  const controller = createSpatialAuthoringController();
  return { controller, draft: authoringValue(controller.createDraft()), before: structuredClone(store.getCurrent()) };
}
function pairsFor(project: Project, link: SpatialConnection) {
  const document = fixtureDocument(project);
  const from = spatialPortLanding(document, link.from);
  const to = spatialPortLanding(document, link.to);
  assert.ok(from && to);
  return (project.mapConnections ?? []).filter(pair =>
    JSON.stringify([pair.from, pair.to]) === JSON.stringify([from, to]) ||
    JSON.stringify([pair.from, pair.to]) === JSON.stringify([to, from]));
}

it.each(["create", "replace", "remove"] as const)("preserves parallel same-map artifacts when explicit edit is %s", kind => {
  // Given: two distinct non-overlapping owned rectangles on one map, with two parallel opaque logical IDs.
  const { project, selected, parallel } = sharedFixture(kind !== "create");
  const original = fixtureDocument(project);
  const from = spatialPortLanding(original, selected.from);
  const to = spatialPortLanding(original, selected.to);
  assert.ok(from && to);
  expect(from.mapId).toBe(to.mapId);
  expect(own(original.occurrences, selected.from.occurrenceId).bindings.filter(isOwnedSpatialBinding)).toHaveLength(1);
  let request: SpatialConnectionEdit;
  switch (kind) {
    case "create": request = { kind: "create", connection: selected }; break;
    case "replace": request = { kind: "replace", connection: { ...selected, from: selected.to, to: selected.from, bidirectional: false } }; break;
    case "remove": request = { kind: "remove", connectionId: selected.id }; break;
    default: return assertNever(kind);
  }
  const manual = { id: "manual-unowned", name: "Manual", x: 0, y: 0, trigger: { kind: "action" as const }, commands: [] };
  own(project.maps, from.mapId).events.push(manual);
  const { controller, draft, before } = begin(project);
  const retained = pairsFor(before, parallel);
  expect(retained).toHaveLength(2);
  // When: accept exactly one explicit connection edit through the real controller.
  const preview = authoringValue(controller.preview(draft, { operation: { kind: "edit-connection", request }, compile: { occurrenceId: placeRoot } }));
  expect(store.getCurrent()).toEqual(before);
  authoringValue(controller.apply(preview));
  // Then: precise traversal, unaffected pair/events/raster and one complete history transaction survive real IO.
  const accepted = structuredClone(store.getCurrent());
  const loaded = deserialize(serialize(accepted));
  const traversal = inspectNestedTraversal(loaded);
  switch (kind) {
    case "create": expect(traversal.routes).toHaveLength(4); break;
    case "replace": {
      expect(traversal.routes).toHaveLength(3);
      const selectedPairs = pairsFor(loaded, selected);
      expect(selectedPairs).toHaveLength(1);
      expect(selectedPairs[0]).toMatchObject({ from: to, to: from });
      break;
    }
    case "remove": expect(traversal.routes).toHaveLength(2); break;
    default: return assertNever(kind);
  }
  expect(pairsFor(loaded, parallel)).toEqual(retained);
  for (const pair of retained) expect(own(loaded.maps, pair.from.mapId).events.find(event => event.id === pair.id))
    .toEqual(own(before.maps, pair.from.mapId).events.find(event => event.id === pair.id));
  expect(own(loaded.maps, from.mapId).events).toContainEqual(manual);
  expect(loaded.mapTree).toEqual(before.mapTree);
  for (const [id, map] of Object.entries(before.maps)) {
    expect(own(loaded.maps, id).lowerTiles).toEqual(map.lowerTiles);
    expect(own(loaded.maps, id).upperTiles).toEqual(map.upperTiles);
  }
  expect(controller.undo()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
  expect(controller.undo()).toBe(false);
  expect(controller.redo()).toBe(true);
  expect(store.getCurrent()).toEqual(accepted);
});

it.each([false, true])("preserves unaffected parallel floor event identities when persisted IDs are opaque=%s", opaque => {
  // Given: both raster owners claim both edges; endpoints are non-owning object projections.
  const scene = parallelFixture();
  const keptIds = pairsFor(scene.project, scene.parallel).map(pair => pair.id);
  const project = opaque ? renameEvents(scene.project, keptIds) : scene.project;
  const retained = pairsFor(project, scene.parallel);
  for (const endpoint of [scene.selected.from, scene.selected.to])
    expect(own(fixtureDocument(project).occurrences, endpoint.occurrenceId).bindings.every(binding => !isOwnedSpatialBinding(binding))).toBe(true);
  // Execute persisted pages before the action too: the opaque fixture is valid, not corrupt output.
  expect(inspectNestedTraversal(project).routes).toHaveLength(4);
  const { controller, draft, before } = begin(project);
  // When: remove the other actual connection, compiling the explicit containing root.
  const preview = authoringValue(controller.preview(draft, { operation: { kind: "edit-connection", request: { kind: "remove", connectionId: scene.selected.id } }, compile: { occurrenceId: placeRoot } }));
  authoringValue(controller.apply(preview));
  // Then: remaining generated pages still execute, with exact unaffected identities and event payloads.
  const loaded = deserialize(serialize(store.getCurrent()));
  expect(inspectNestedTraversal(loaded).routes).toHaveLength(2);
  expect(pairsFor(loaded, scene.parallel)).toEqual(retained);
  for (const pair of retained) expect(own(loaded.maps, pair.from.mapId).events.find(event => event.id === pair.id))
    .toEqual(own(before.maps, pair.from.mapId).events.find(event => event.id === pair.id));
});

it.each(["old-outside", "new-outside", "unknown-replace"] as const)("rejects replacement atomically when write-set delta is %s", scenario => {
  // Given: the inn compile contains floors, but not the root village square.
  const { project, selected } = parallelFixture();
  const document = fixtureDocument(project);
  const square = own(document.occurrences, placeChild(project, placeRoot, "square"));
  const outside = { occurrenceId: square.id, portId: resolveOccurrencePortId(square, spatialId("entry")) };
  let connection: SpatialConnection;
  switch (scenario) {
    case "old-outside": {
      const setup = begin(project);
      const edit = authoringValue(setup.controller.preview(setup.draft, { operation: { kind: "edit-connection", request: { kind: "replace", connection: { ...selected, to: outside } } }, compile: { occurrenceId: placeRoot } }));
      Object.assign(project, structuredClone(edit.project));
      connection = selected;
      break;
    }
    case "new-outside": connection = { ...selected, to: outside }; break;
    case "unknown-replace": connection = { ...selected, id: spatialId("unknown/replace") }; break;
    default: return assertNever(scenario);
  }
  const { controller, draft, before } = begin(project);
  // When: replacement's old or new endpoint escapes the requested compile, or ID is absent.
  const result = controller.preview(draft, { operation: { kind: "edit-connection", request: { kind: "replace", connection } },
    compile: { occurrenceId: placeChild(project, placeRoot, "inn") } });
  // Then: no proposal or partial cleanup/history adoption escapes.
  expect(result).toMatchObject({ kind: "error", error: { code: scenario === "unknown-replace" ? "invalid" : "ownership" } });
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});
