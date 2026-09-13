/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import * as query from "../src/editor/panels/spatialPlaceQuery";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { previewPlacedPlaceEdit, placedPlaceChildren } from "../src/editor/spatial/placedPlaceEdits";
import { own, spatialId } from "../src/project/spatial/domain";
import { inspectSpatialOccurrenceDeletion } from "../src/project/spatial/ownership";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { placeChild, placeCompilerFixture, placeRoot, withStairConnections } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

function fixture() {
  const project = withStairConnections(placeCompilerFixture());
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(compileSpatialOccurrence(project, { occurrenceId: placeRoot }));
  resetMapEditHistory();
  const controller = createSpatialAuthoringController();
  return { controller, draft: authoringValue(controller.createDraft()), innId: placeChild(project, placeRoot, "inn") };
}

it.each([0, 4])("rejects unsupported facility level %s without draft or history writes", level => {
  // Given an issued draft with existing compiled room connections.
  const f = fixture();
  const before = structuredClone(store.getCurrent());
  // When a facility child is assigned a level outside the explicit 1..3 contract.
  const result = previewPlacedPlaceEdit(f.controller, f.draft, { compile: { occurrenceId: placeRoot },
    edit: { kind: "move", parentId: f.innId, slot: { slotId: spatialId("floor-2"), index: 0 }, position: { x: 3, y: 5, level } } });
  // Then neither source nor occurrence nor draft nor history is changed.
  expect(result).toMatchObject({ kind: "error", error: { code: "invalid" } });
  expect(f.draft.project).toEqual(before);
  expect(store.getCurrent()).toEqual(before);
  expect(f.controller.undo()).toBe(false);
});

it("reports exact lifecycle impact when inspecting a placed deletion", () => {
  // Given a compiled nested inn with actual cross-floor transfers.
  const f = fixture();
  const project = store.getCurrent();
  const expected = inspectSpatialOccurrenceDeletion(fixtureDocument(project), project, f.innId);
  // When the placed-target deletion query is inspected.
  const impact = query.previewPlaceDelete(project, { cardId: f.innId, localId: "not-an-occurrence", name: "Inn", source: "placed", occurrenceId: f.innId });
  // Then exact occurrence, edge, artifact and projection data reaches the UI read model.
  expect(impact?.occurrence).toEqual(expected);
  expect(expected.connections.length).toBeGreaterThan(0);
});

it("offers the exact uncompiled clone identity when cloning a frozen placed tree", () => {
  // Given a compiled inn, and a requested clone identity unrelated to source/slot spelling.
  const f = fixture();
  const before = structuredClone(store.getCurrent());
  const rootId = spatialId("opaque-selected-clone");
  // When the UI clone proposal is executed through the real controller.
  const plan = query.placedPlaceCloneProposal({ occurrenceId: f.innId, rootId });
  const preview = authoringValue(f.controller.preview(f.draft, plan.request));
  // Then the UI can select this exact independent, not-yet-compiled root and offer explicit compile.
  expect(plan.destination).toEqual({ tab: "places", mode: "instances", occurrenceId: rootId });
  expect(plan.compile).toEqual({ occurrenceId: rootId });
  const clone = own(fixtureDocument(preview.project).occurrences, rootId);
  expect(clone.bindings).toEqual([]);
  expect(clone.snapshot).toEqual(own(fixtureDocument(before).occurrences, f.innId).snapshot);
  expect(placedPlaceChildren(preview.project, rootId).map(child => child.destination.occurrenceId))
    .not.toEqual(placedPlaceChildren(before, f.innId).map(child => child.destination.occurrenceId));
  expect(store.getCurrent()).toEqual(before);
});

it("removes exact compiled transfers when deleting their containing actual inn", () => {
  // Given real cross-floor transfers owned inside the selected inn.
  const f = fixture();
  const before = structuredClone(store.getCurrent());
  const doc = fixtureDocument(before);
  const impact = inspectSpatialOccurrenceDeletion(doc, before, f.innId);
  const removedEvents = impact.artifacts.flatMap(artifact => artifact.binding.eventIds);
  expect(doc.connections).toHaveLength(2);
  // When the adapter deletes the containing subtree through the existing lifecycle.
  const preview = authoringValue(previewPlacedPlaceEdit(f.controller, f.draft, { compile: { occurrenceId: placeRoot },
    edit: { kind: "delete", parentId: placeRoot, slot: { slotId: spatialId("inn"), index: 0 }, externalConnections: "reject" } }));
  // Then graph rows, automatic links and owned transfer events are removed together.
  expect(fixtureDocument(preview.project).connections).toEqual([]);
  expect(preview.project.mapConnections ?? []).toEqual([]);
  expect(Object.values(preview.project.maps).flatMap(map => map.events).filter(event => removedEvents.includes(event.id))).toEqual([]);
  expect(fixtureDocument(preview.project).library).toEqual(doc.library);
  expect(store.getCurrent()).toEqual(before);
  authoringValue(f.controller.apply(preview));
  expect(f.controller.undo()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
  expect(f.controller.undo()).toBe(false);
});

it("extends only the selected frozen closure when adding a novel shared-descendant source", () => {
  // Given a new reusable wing whose three child slots share the existing room source.
  const f = fixture();
  const doc = fixtureDocument(f.draft.project);
  const originalInn = own(doc.library.places, own(doc.occurrences, f.innId).source.id);
  const sourceId = spatialId("novel-reusable-wing");
  f.draft.project.spatialAuthoring = { ...doc, library: { ...doc.library,
    places: { ...doc.library.places, [sourceId]: { ...originalInn, id: sourceId, name: "Wing" } },
  } };
  const rootId = spatialId("opaque-wing-occurrence");
  const before = structuredClone(store.getCurrent());
  // When that source is explicitly instantiated and attached, not all existing siblings.
  const preview = authoringValue(previewPlacedPlaceEdit(f.controller, f.draft, { compile: { occurrenceId: placeRoot }, edit: {
    kind: "add", parentId: placeRoot, rootId, seed: 23, generatorVersion: "test-v1",
    slot: { id: spatialId("wing-slot"), source: { kind: "place", id: sourceId }, x: 60, y: 10, level: 0 },
  } }));
  // Then the new closed definition is present only where selected; shared old definitions stay exact.
  const after = fixtureDocument(preview.project);
  expect(own(after.occurrences, placeRoot).snapshot.library.places[sourceId]?.id).toBe(sourceId);
  expect(own(after.occurrences, rootId).snapshot.library.places[sourceId]?.id).toBe(sourceId);
  expect(own(after.occurrences, f.innId).snapshot).toEqual(own(doc.occurrences, f.innId).snapshot);
  expect(placedPlaceChildren(preview.project, rootId)).toHaveLength(3);
  expect(own(after.occurrences, placeChild(preview.project, rootId, "floor-3")).bindings.length).toBeGreaterThan(0);
  expect(store.getCurrent()).toEqual(before);
});
