// @vitest-environment happy-dom

import { afterEach, beforeEach, expect, it, vi, describe } from "vitest";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { previewPlacedPlaceEdit } from "../src/editor/spatial/placedPlaceEdits";
import { own, spatialId, requireOccurrenceAssociations, findOccurrenceChildId } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { placeChild, placeCompilerFixture, placeRoot, withStairConnections } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument, spaceRoot } from "./support/spatialSpaceCompilerFixture";
import { bindSpatialAuthoringControllerFactory, visibleAuthoringProject } from "../src/editor/panels/spatialAuthoringAccess";
import { patchSpatialSession, resetSpatialAuthoringSessions, spatialSession } from "../src/editor/panels/spatialAuthoringSession";
import { placeChromeState, resetSpatialPlacesTabChrome } from "../src/editor/panels/spatialPlaceChromeState";
import { spatialPlacesChrome, visiblePlaceSelection } from "../src/editor/panels/spatialPlaceCommands";
import { libraryPlaceCardId } from "../src/editor/panels/spatialPlaceQuery";
import { patchOccurrencePlace } from "../src/editor/panels/spatialPlaceDraft";
import { previewPlacedSpaceEdit } from "../src/editor/spatial/placedSpaceEdits";
import { isPassableLanding } from "../src/project/collision";
import { placedSpaceFixture, repeatedSlot, selectedMember } from "./support/placedSpaceFixture";
import { isolateTimers } from "./mergedTeardown";

describe("placedPlaceAssociationEdges", () => {
  isolateTimers();
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
  afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });
  function fixture() {
    const project = placeCompilerFixture();
    const squareId = placeChild(project, placeRoot, "square");
    const doc = fixtureDocument(project);
    project.spatialAuthoring = { ...doc, occurrences: { ...doc.occurrences, [squareId]: { ...own(doc.occurrences, squareId), x: 8, y: 10 } } };
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(compileSpatialOccurrence(project, { occurrenceId: placeRoot }));
    resetMapEditHistory();
    const controller = createSpatialAuthoringController();
    return { controller, draft: authoringValue(controller.createDraft()), squareId, innId: placeChild(project, placeRoot, "inn") };
  }
  it("moves the actual override when the requested position equals its unchanged template", () => {
    // Given an actual square at 8,10 whose frozen slot still says 2,3.
    const f = fixture();
    // When the user explicitly moves the actual square back to 2,3.
    const preview = authoringValue(previewPlacedPlaceEdit(f.controller, f.draft, { compile: { occurrenceId: placeRoot },
      edit: { kind: "move", parentId: placeRoot, slot: { slotId: spatialId("square"), index: 0 }, position: { x: 2, y: 3, level: 0 } } }));
    // Then actual placement and the compiled surface move despite the unchanged recipe.
    expect(own(fixtureDocument(preview.project).occurrences, f.squareId)).toMatchObject({ x: 2, y: 3 });
    expect(own(fixtureDocument(preview.project).occurrences, f.squareId).bindings[0]?.rect).toMatchObject({ x: 2, y: 3 });
  });
  it("rejects an unrelated compile scope when a parent composition changes", () => {
    // Given an issued parent draft whose square is outside the inn's compile subtree.
    const f = fixture();
    const before = structuredClone(store.getCurrent());
    // When an incorrectly scoped caller asks to compile only the inn after moving the square.
    const result = previewPlacedPlaceEdit(f.controller, f.draft, { compile: { occurrenceId: f.innId },
      edit: { kind: "move", parentId: placeRoot, slot: { slotId: spatialId("square"), index: 0 }, position: { x: 4, y: 5, level: 0 } } });
    // Then no uncompiled geometry can be offered for adoption.
    expect(result).toMatchObject({ kind: "error" });
    expect(f.draft.project).toEqual(before);
    expect(store.getCurrent()).toEqual(before);
    expect(f.controller.undo()).toBe(false);
  });
});

describe("placedPlaceCommandSelection", () => {
  isolateTimers();
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    resetSpatialAuthoringSessions();
    resetSpatialPlacesTabChrome();
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
  });
  afterEach(() => {
    bindSpatialAuthoringControllerFactory(null);
    resetSpatialAuthoringSessions();
    resetSpatialPlacesTabChrome();
    resetMapEditHistory();
    vi.clearAllTimers(); vi.useRealTimers();
  });
  function fixture() {
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(compileSpatialOccurrence(placeCompilerFixture(), { occurrenceId: placeRoot }));
    resetMapEditHistory();
    const sourceId = own(fixtureDocument(store.getCurrent()).occurrences, placeRoot).source.id;
    const card = { id: placeRoot, localId: sourceId, name: "Placed village", source: "placed", kind: "places", usage: 0 } as const;
    patchSpatialSession({ tab: "places", mode: "instances", occurrenceId: placeRoot, designId: libraryPlaceCardId(sourceId) });
    return { card, sourceId };
  }
  it("selects the actual proposed clone when the placed duplicate command succeeds", () => {
    // Given a compiled selection bound to the real controller factory.
    const f = fixture();
    const before = structuredClone(store.getCurrent());
    const duplicate = spatialPlacesChrome(f.card, () => undefined).duplicate;
    if (!duplicate) throw new TypeError("Expected placed duplicate command");
    // When invoking the actual panel command, not a permissive controller.
    duplicate();
    // Then the new uncompiled root is selected in the proposal without adoption.
    const doc = fixtureDocument(visibleAuthoringProject());
    const cloneIds = doc.rootOccurrenceIds.filter(id => id !== placeRoot);
    expect(cloneIds).toHaveLength(1);
    expect(spatialSession()).toMatchObject({ mode: "instances", occurrenceId: cloneIds[0] });
    expect(own(doc.occurrences, spatialSession().occurrenceId ?? "missing-selection").bindings).toEqual([]);
    expect(store.getCurrent()).toEqual(before);
  });
  it("preserves explicit instance selection when a previously created design is still remembered", () => {
    // Given an explicit instance selection and the old created-design chrome marker.
    const f = fixture();
    placeChromeState.createdDesignId = f.sourceId;
    // When resolving the visible place card.
    const selected = visiblePlaceSelection(f.card);
    // Then the remembered source card cannot replace the selected occurrence.
    expect(selected).toEqual(f.card);
  });
});

describe("placedPlaceEdits", () => {
  isolateTimers();
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
  afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });
  it("moves the associated actual child and compiled surface when a placed slot moves", () => {
    // Given a compiled village and an opaque persisted child identity.
    const project = placeCompilerFixture();
    const oldId = placeChild(project, placeRoot, "square");
    const doc = fixtureDocument(project);
    const squareId = spatialId("opaque-square-42");
    project.spatialAuthoring = { ...doc, occurrences: Object.fromEntries(Object.values(doc.occurrences).reverse().map(raw => {
      const child = requireOccurrenceAssociations(raw);
      const id = child.id === oldId ? squareId : child.id;
      if (child.parentId === null) return [id, { ...child, id }];
      return [id, { ...child, id, parentId: child.parentId === oldId ? squareId : child.parentId }];
    })) };
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(compileSpatialOccurrence(project, { occurrenceId: placeRoot }));
    resetMapEditHistory();
    const before = structuredClone(store.getCurrent());
    const controller = createSpatialAuthoringController();
    const draft = authoringValue(controller.createDraft());
    // When the existing UI draft seam moves the square to an input-derived position.
    Object.assign(draft.project, patchOccurrencePlace(draft.project, placeRoot, place => ({ ...place,
      children: place.children.map(slot => slot.id === "square" ? { ...slot, x: 6, y: 9 } : slot),
    })));
    const preview = authoringValue(controller.preview(draft, { operation: { kind: "edit" }, compile: { occurrenceId: placeRoot } }));
    // Then compiler geometry follows the actual association, with one atomic undo.
    const square = own(fixtureDocument(preview.project).occurrences, squareId);
    expect({ x: square.x, y: square.y }).toEqual({ x: 6, y: 9 });
    expect(square.bindings[0]?.rect).toMatchObject({ x: 6, y: 9 });
    expect(preview.project.spatialAuthoring?.library).toEqual(before.spatialAuthoring?.library);
    expect(store.getCurrent()).toEqual(before);
    authoringValue(controller.apply(preview));
    expect(controller.undo()).toBe(true);
    expect(store.getCurrent()).toEqual(before);
    expect(controller.undo()).toBe(false);
  });
});

describe("placedSpaceBoundaries", () => {
  isolateTimers();
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
});
