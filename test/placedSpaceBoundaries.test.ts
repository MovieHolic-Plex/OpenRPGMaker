/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { previewPlacedSpaceEdit } from "../src/editor/spatial/placedSpaceEdits";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { findOccurrenceChildId, own, spatialId } from "../src/project/spatial/domain";
import { isPassableLanding } from "../src/project/collision";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument, spaceRoot } from "./support/spatialSpaceCompilerFixture";
import { placedSpaceFixture, repeatedSlot, selectedMember } from "./support/placedSpaceFixture";
import { placeChild, placeCompilerFixture, placeRoot, withStairConnections } from "./support/spatialPlaceCompilerFixture";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it("uses frozen definitions when quantity grows after source removal", () => {
  // Given deleted live room/object sources but valid frozen actual occurrences.
  const f = placedSpaceFixture();
  const doc = fixtureDocument(f.draft.project);
  f.draft.project.spatialAuthoring = { ...doc, library: { ...doc.library, spaces: {}, objects: {} } };
  // When an explicit additional repetition is placed from its existing frozen recipe.
  const preview = authoringValue(previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
    edit: { kind: "quantity", slotId: repeatedSlot, quantity: 4, positions: [{ x: 5, y: 1 }] } }));
  // Then the source stays absent and exact captured mixed cells are compiled.
  expect(fixtureDocument(preview.project).library.objects).toEqual({});
  const map = own(preview.project.maps, `spatial:${spaceRoot}`);
  expect(map.lowerTiles[5 * map.width + 7]).toBe(402);
  expect(map.upperTiles[6 * map.width + 8]).toBe(433);
});

it("preserves concrete port identity when reordered named ports move", () => {
  // Given reordered concrete ports with opaque IDs.
  const f = placedSpaceFixture();
  const root = own(fixtureDocument(f.draft.project).occurrences, spaceRoot);
  const space = own(root.snapshot.library.spaces, root.source.id);
  const concrete = root.snapshot.ports.find(port => port.localPortId === "west");
  if (!concrete) throw new TypeError("Missing west port");
  // When the named west port moves independently of entry and array order.
  const preview = authoringValue(previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
    edit: { kind: "recipe", space: { ...space, ports: space.ports.map(port => port.id === "west" ? { ...port, x: 6, y: 10 } : port) } } }));
  // Then both snapshot and compiled landing retain that exact concrete identity.
  const next = own(fixtureDocument(preview.project).occurrences, spaceRoot);
  expect(next.snapshot.ports).toContainEqual({ ...concrete, x: 6, y: 10 });
  expect(next.bindings[0]?.ports).toContainEqual({ portId: concrete.id, x: 8, y: 14 });
  expect(isPassableLanding(preview.project, own(preview.project.maps, `spatial:${spaceRoot}`), 8, 14)).toBe(true);
});

it("rejects a blocked port atomically when a named landing enters an object", () => {
  // Given an opaque concrete west port and an occupied upper-layer hearth cell.
  const f = placedSpaceFixture();
  const before = structuredClone(store.getCurrent());
  const root = own(fixtureDocument(f.draft.project).occurrences, spaceRoot);
  const space = own(root.snapshot.library.spaces, root.source.id);
  // When west moves onto the hearth's blocking upper-layer cell.
  const result = previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
    edit: { kind: "recipe", space: { ...space, ports: space.ports.map(port => port.id === "west" ? { ...port, x: 2, y: 5 } : port) } } });
  // Then compilation rejects the landing without any live or history adoption.
  expect(result).toMatchObject({ kind: "error" });
  expect(store.getCurrent()).toEqual(before);
  expect(f.controller.undo()).toBe(false);
});

it("rejects conflicting frozen identity when a novel source reuses a frozen space ID", () => {
  // Given a valid active library reusing a historical space's ID for a different object.
  const f = placedSpaceFixture();
  const doc = fixtureDocument(f.draft.project);
  const root = own(doc.occurrences, spaceRoot);
  const object = own(doc.library.objects, "bed-design");
  f.draft.project.spatialAuthoring = { ...doc, library: { ...doc.library, spaces: {},
    objects: { ...doc.library.objects, [root.source.id]: { ...object, id: root.source.id } } } };
  const before = structuredClone(store.getCurrent());
  // When an explicit add would merge conflicting IDs into the closed snapshot.
  const result = previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
    edit: { kind: "add", slot: { id: spatialId("conflict"), objectDesignId: root.source.id, quantity: 1,
      required: true, placement: { mode: "fixed", x: 5, y: 1 } } } });
  // Then typed conflict feedback replaces last-write-wins merging.
  expect(result).toMatchObject({ kind: "error", error: { detail: "frozen-closure-conflict" } });
  expect(store.getCurrent()).toEqual(before);
});

it("preserves manual raster when an owned target was painted before drafting", () => {
  // Given a manual change predating the new draft, so stale-baseline checks alone cannot protect it.
  const f = placedSpaceFixture();
  store.updateMap(`spatial:${spaceRoot}`, map => { map.lowerTiles[0] = 402; });
  const draft = authoringValue(f.controller.createDraft());
  const before = structuredClone(store.getCurrent());
  // When a fresh placed edit attempts to recompile that altered owned surface.
  const result = previewPlacedSpaceEdit(f.controller, draft, { occurrenceId: spaceRoot, compile: f.compile,
    edit: { kind: "move", member: selectedMember, position: { x: 9, y: 4 } } });
  // Then the existing owned-raster guard rejects, preserving the manual edit exactly.
  expect(result).toMatchObject({ kind: "error", error: { code: "ownership" } });
  expect(store.getCurrent()).toEqual(before);
});

it("preserves connections when a nested room compiles through its known containing root", () => {
  // Given a compiled village with three connected inn floors.
  const project = compileSpatialOccurrence(withStairConnections(placeCompilerFixture()), { occurrenceId: placeRoot });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(project);
  resetMapEditHistory();
  const controller = createSpatialAuthoringController();
  const draft = authoringValue(controller.createDraft());
  const inn = placeChild(project, placeRoot, "inn");
  const room = placeChild(project, inn, "floor-2");
  const sibling = placeChild(project, inn, "floor-1");
  const root = own(fixtureDocument(project).occurrences, room);
  const space = own(root.snapshot.library.spaces, root.source.id);
  // When the selected room grows using an explicit known root until shared scope resolution is integrated.
  const preview = authoringValue(previewPlacedSpaceEdit(controller, draft, { occurrenceId: room, compile: { occurrenceId: placeRoot },
    edit: { kind: "recipe", space: { ...space, width: space.width + 1 } } }));
  // Then containing compilation retains connections and the unrelated floor's entire occurrence.
  const doc = fixtureDocument(preview.project);
  expect(doc.connections).toEqual(fixtureDocument(project).connections);
  expect(preview.project.mapConnections).toEqual(project.mapConnections);
  expect(own(doc.occurrences, sibling)).toEqual(own(fixtureDocument(project).occurrences, sibling));
  const child = findOccurrenceChildId(doc, room, { slotId: spatialId("hearth"), index: 0 });
  if (!child) throw new TypeError("Missing nested hearth");
  expect(own(doc.occurrences, child).bindings[0]?.rect).toEqual({ x: 3, y: 8, width: 3, height: 3 });
});
