/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import * as placed from "../src/editor/spatial/placedPlaceEdits";
import { own, requireOccurrenceAssociations, spatialId } from "../src/project/spatial/domain";
import { instantiateSpatialDesign } from "../src/project/spatial/instances";
import { deleteSpatialOccurrence, occurrenceSubtree } from "../src/project/spatial/ownership";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { placeChild, placeCompilerFixture, placeRoot } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

function fixture() {
  const project = placeCompilerFixture();
  const innId = placeChild(project, placeRoot, "inn");
  const roomId = placeChild(project, innId, "floor-2");
  const gapId = placeChild(project, roomId, "stairs-up");
  const objectId = placeChild(project, roomId, "stairs");
  const original = fixtureDocument(project);
  const object = requireOccurrenceAssociations(own(original.occurrences, objectId));
  project.spatialAuthoring = { ...original, occurrences: { ...original.occurrences,
    [objectId]: { ...object, snapshot: { ...object.snapshot, library: { ...object.snapshot.library,
      objects: { ...object.snapshot.library.objects, [object.source.id]: { ...own(object.snapshot.library.objects, object.source.id), chips: [] } },
    } } },
  } };
  project.spatialAuthoring = deleteSpatialOccurrence(project.spatialAuthoring, project, { occurrenceId: gapId, externalConnections: "reject" });
  const siblingId = spatialId("other-independent-village");
  project.spatialAuthoring = instantiateSpatialDesign(project.spatialAuthoring, project, {
    source: own(original.occurrences, placeRoot).source, rootId: siblingId, x: 0, y: 0, level: 0, seed: 19, generatorVersion: "fixture-v1",
  });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(compileSpatialOccurrence(compileSpatialOccurrence(project, { occurrenceId: placeRoot }), { occurrenceId: siblingId }));
  resetMapEditHistory();
  const controller = createSpatialAuthoringController();
  return { controller, draft: authoringValue(controller.createDraft()), innId, roomId, gapId, objectId, siblingId };
}

it("instantiates only the selected subtree when adding another shared-descendant inn", () => {
  // Given two compiled roots, a deleted gap, and an actual transitive override.
  const f = fixture();
  const before = structuredClone(store.getCurrent());
  const doc = fixtureDocument(before);
  const rootId = spatialId("new-opaque-inn");
  const slotId = spatialId("new-inn-slot");
  // When a repeated source is explicitly added through the real controller adapter.
  const preview = authoringValue(placed.previewPlacedPlaceEdit(f.controller, f.draft, {
    compile: { occurrenceId: placeRoot }, edit: { kind: "add", parentId: placeRoot, rootId, seed: 29, generatorVersion: "manual-test-v1",
      slot: { id: slotId, source: { kind: "place", id: own(doc.occurrences, f.innId).source.id }, x: 60, y: 8, level: 0 } },
  }));
  // Then only fresh members are added; persisted peers and source data stay frozen.
  const after = fixtureDocument(preview.project);
  expect(own(after.occurrences, rootId)).toMatchObject({ parentId: placeRoot, parentSlot: { slotId, index: 0 }, x: 60, y: 8, seed: 29 });
  expect(after.rootOccurrenceIds).toEqual(doc.rootOccurrenceIds);
  expect(after.occurrences[f.gapId]).toBeUndefined();
  expect(own(after.occurrences, f.objectId).snapshot).toEqual(own(doc.occurrences, f.objectId).snapshot);
  for (const id of occurrenceSubtree(doc, f.siblingId)) expect(after.occurrences[id]).toEqual(doc.occurrences[id]);
  expect(after.library).toEqual(doc.library);
  expect(placeChild(preview.project, rootId, "floor-2")).not.toBe(f.roomId);
  expect(own(after.occurrences, placeChild(preview.project, rootId, "floor-2")).bindings.length).toBeGreaterThan(0);
  expect(f.draft.project).toEqual(before);
  expect(store.getCurrent()).toEqual(before);
  authoringValue(f.controller.apply(preview));
  expect(f.controller.undo()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
  expect(f.controller.undo()).toBe(false);
});

it("deletes exact actual descendants when removing one nested inn", () => {
  // Given two compiled roots with independently owned artifacts.
  const f = fixture();
  const before = structuredClone(store.getCurrent());
  const doc = fixtureDocument(before);
  const removed = occurrenceSubtree(doc, f.innId);
  // When the selected slot is deleted using the canonical lifecycle.
  const preview = authoringValue(placed.previewPlacedPlaceEdit(f.controller, f.draft, {
    compile: { occurrenceId: placeRoot }, edit: { kind: "delete", parentId: placeRoot,
      slot: { slotId: spatialId("inn"), index: 0 }, externalConnections: "reject" },
  }));
  // Then the selected tree and its owned events are gone, not its frozen recipe or sibling.
  const after = fixtureDocument(preview.project);
  for (const id of removed) expect(after.occurrences[id]).toBeUndefined();
  for (const id of occurrenceSubtree(doc, f.siblingId)) expect(after.occurrences[id]).toEqual(doc.occurrences[id]);
  expect(own(after.occurrences, placeRoot).snapshot).toEqual(own(doc.occurrences, placeRoot).snapshot);
  const eventIds = removed.flatMap(id => own(doc.occurrences, id).bindings.flatMap(binding => binding.eventIds ?? []));
  expect(Object.values(preview.project.maps).flatMap(map => map.events).filter(event => eventIds.includes(event.id))).toEqual([]);
  expect(store.getCurrent()).toEqual(before);
  authoringValue(f.controller.apply(preview));
  expect(f.controller.undo()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
  expect(f.controller.undo()).toBe(false);
});

it("uses actual level and frozen child identity when moving a facility room", () => {
  // Given same-source rooms whose actual snapshots can diverge.
  const f = fixture();
  const before = structuredClone(store.getCurrent());
  // When floor 2 is deliberately moved to supported level 3.
  const preview = authoringValue(placed.previewPlacedPlaceEdit(f.controller, f.draft, {
    compile: { occurrenceId: placeRoot }, edit: { kind: "move", parentId: f.innId,
      slot: { slotId: spatialId("floor-2"), index: 0 }, position: { x: 7, y: 9, level: 3 } },
  }));
  // Then the read model exposes the actual occurrence destination, not its source or slot ID.
  const children = placed.placedPlaceChildren(preview.project, f.innId);
  expect(children.find(child => child.occurrenceId === f.roomId)).toMatchObject({ x: 7, y: 9, level: 3,
    destination: { tab: "spaces", mode: "instances", occurrenceId: f.roomId } });
  const moved = own(fixtureDocument(preview.project).occurrences, f.roomId);
  expect(moved).toMatchObject({ x: 7, y: 9, level: 3 });
  expect(moved.bindings.length).toBeGreaterThan(0);
  expect(store.getCurrent()).toEqual(before);
});

it("compiles an empty actual composition when the last surviving child is deleted", () => {
  // Given a controller-issued proposal with only the square surviving.
  const f = fixture();
  const first = authoringValue(placed.previewPlacedPlaceEdit(f.controller, f.draft, { compile: { occurrenceId: placeRoot },
    edit: { kind: "delete", parentId: placeRoot, slot: { slotId: spatialId("inn"), index: 0 }, externalConnections: "reject" } }));
  const draft = authoringValue(f.controller.continueDraft(first));
  const before = structuredClone(store.getCurrent());
  // When deleting the final actual child while retaining the frozen template gaps.
  const preview = authoringValue(placed.previewPlacedPlaceEdit(f.controller, draft, { compile: { occurrenceId: placeRoot },
    edit: { kind: "delete", parentId: placeRoot, slot: { slotId: spatialId("square"), index: 0 }, externalConnections: "reject" } }));
  // Then neither compilation nor the actual read model resurrects any frozen recipe child.
  const parent = own(fixtureDocument(preview.project).occurrences, placeRoot);
  expect(placed.placedPlaceChildren(preview.project, placeRoot)).toEqual([]);
  expect(parent.bindings).toEqual([]);
  expect(parent.snapshot).toEqual(own(fixtureDocument(before).occurrences, placeRoot).snapshot);
  expect(store.getCurrent()).toEqual(before);
  authoringValue(f.controller.apply(preview));
  expect(f.controller.undo()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
  expect(f.controller.undo()).toBe(false);
});
