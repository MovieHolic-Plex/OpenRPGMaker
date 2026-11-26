// @vitest-environment happy-dom

import { afterEach, beforeEach, expect, it, vi, describe } from "vitest";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import * as placed from "../src/editor/spatial/placedPlaceEdits";
import { own, requireOccurrenceAssociations, spatialId, assertNever, findOccurrenceChildId } from "../src/project/spatial/domain";
import { instantiateSpatialDesign } from "../src/project/spatial/instances";
import { deleteSpatialOccurrence, occurrenceSubtree } from "../src/project/spatial/ownership";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { placeChild, placeCompilerFixture, placeRoot } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument, spaceRoot } from "./support/spatialSpaceCompilerFixture";
import { previewPlacedPlaceEdit } from "../src/editor/spatial/placedPlaceEdits";
import * as edits from "../src/editor/spatial/placedSpaceEdits";
import { opaqueMemberId, placedSpaceFixture, repeatedSlot, selectedMember } from "./support/placedSpaceFixture";
import { isolateTimers } from "./mergedTeardown";

describe("placedPlaceLifecycle", () => {
  isolateTimers();
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
});

describe("placedPlaceRejections", () => {
  isolateTimers();
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
  afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });
  function fixture() {
    const project = placeCompilerFixture();
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(compileSpatialOccurrence(project, { occurrenceId: placeRoot }));
    resetMapEditHistory();
    const controller = createSpatialAuthoringController();
    return { controller, innId: placeChild(project, placeRoot, "inn") };
  }
  it.each(["missing", "ancestor", "conflict"] as const)("rejects %s source additions without partial subtree or history writes", scenario => {
    // Given a frozen compiled village, optionally with a later live-source revision.
    const f = fixture();
    const draft = authoringValue(f.controller.createDraft());
    const doc = fixtureDocument(draft.project);
    const inn = own(doc.occurrences, f.innId);
    let sourceId = inn.source.id;
    switch (scenario) {
      case "missing": sourceId = spatialId("missing-reusable-design"); break;
      case "ancestor": sourceId = own(doc.occurrences, placeRoot).source.id; break;
      case "conflict": {
        const source = own(doc.library.places, sourceId);
        draft.project.spatialAuthoring = { ...doc, library: { ...doc.library, places: { ...doc.library.places,
          [sourceId]: { ...source, revision: source.revision + 1, name: "Later source revision" },
        } } };
        break;
      }
      default: return assertNever(scenario);
    }
    const before = structuredClone(store.getCurrent());
    const draftBefore = structuredClone(draft.project);
    // When explicitly adding this selected source through the controller adapter.
    const result = previewPlacedPlaceEdit(f.controller, draft, { compile: { occurrenceId: placeRoot }, edit: {
      kind: "add", parentId: f.innId, rootId: spatialId("rejected-new-subtree"), seed: 31, generatorVersion: "test-v1",
      slot: { id: spatialId("candidate-slot"), source: { kind: "place", id: sourceId }, x: 20, y: 20, level: 1 },
    } });
    // Then the rejected detached proposal cannot leak any graph/library/history writes.
    expect(result).toMatchObject({ kind: "error" });
    expect(draft.project).toEqual(draftBefore);
    expect(store.getCurrent()).toEqual(before);
    expect(f.controller.undo()).toBe(false);
  });
  it("requires persisted associations when a historical child has incomplete identity", () => {
    // Given valid historical data that intentionally lacks a direct child's associations.
    const f = fixture();
    const beforeProject = structuredClone(store.getCurrent());
    const doc = fixtureDocument(beforeProject);
    const { parentSlot: _association, ...legacy } = own(doc.occurrences, f.innId);
    beforeProject.spatialAuthoring = { ...doc, occurrences: { ...doc.occurrences,
      [f.innId]: { ...legacy, snapshot: { ...legacy.snapshot, ports: [] } },
    } };
    store.replace(beforeProject);
    const before = structuredClone(store.getCurrent());
    const draft = authoringValue(f.controller.createDraft());
    // When an identity-dependent move is requested.
    const result = previewPlacedPlaceEdit(f.controller, draft, { compile: { occurrenceId: placeRoot },
      edit: { kind: "move", parentId: placeRoot, slot: { slotId: spatialId("inn"), index: 0 }, position: { x: 30, y: 9, level: 0 } } });
    // Then no generated-ID or source-ID fallback guesses a target.
    expect(result).toMatchObject({ kind: "error", error: { detail: "association-required" } });
    expect(draft.project).toEqual(before);
    expect(store.getCurrent()).toEqual(before);
    expect(f.controller.undo()).toBe(false);
  });
  it("rejects fresh recompilation when owned output was manually painted", () => {
    // Given a manual raster edit made before creating the new draft (not just a stale handle).
    const f = fixture();
    const square = own(fixtureDocument(store.getCurrent()).occurrences, placeChild(store.getCurrent(), placeRoot, "square"));
    const binding = square.bindings[0];
    if (!binding) throw new TypeError("Expected compiled square ownership");
    store.updateMap(binding.mapId, map => { map.lowerTiles[binding.rect.y * map.width + binding.rect.x] = -1; });
    const before = structuredClone(store.getCurrent());
    const draft = authoringValue(f.controller.createDraft());
    // When moving the actual square would require replacing that owned output.
    const result = previewPlacedPlaceEdit(f.controller, draft, { compile: { occurrenceId: placeRoot },
      edit: { kind: "move", parentId: placeRoot, slot: { slotId: spatialId("square"), index: 0 }, position: { x: 7, y: 8, level: 0 } } });
    // Then ownership guards preserve the manual pixels, source, occurrences and history.
    expect(result).toMatchObject({ kind: "error", error: { code: "ownership" } });
    expect(draft.project).toEqual(before);
    expect(store.getCurrent()).toEqual(before);
    expect(f.controller.undo()).toBe(false);
  });
  it("rejects a deleted child slot instead of resurrecting its template", () => {
    // Given a controller-issued deletion preview.
    const f = fixture();
    const initial = authoringValue(f.controller.createDraft());
    const deletion = authoringValue(previewPlacedPlaceEdit(f.controller, initial, { compile: { occurrenceId: placeRoot },
      edit: { kind: "delete", parentId: placeRoot, slot: { slotId: spatialId("inn"), index: 0 }, externalConnections: "reject" } }));
    const draft = authoringValue(f.controller.continueDraft(deletion));
    const before = structuredClone(store.getCurrent());
    const draftBefore = structuredClone(draft.project);
    // When a stale token attempts to move the missing actual child.
    const result = previewPlacedPlaceEdit(f.controller, draft, { compile: { occurrenceId: placeRoot },
      edit: { kind: "move", parentId: placeRoot, slot: { slotId: spatialId("inn"), index: 0 }, position: { x: 30, y: 9, level: 0 } } });
    // Then the gap remains and no proposal can be applied accidentally.
    expect(result).toMatchObject({ kind: "error", error: { detail: "missing" } });
    expect(draft.project).toEqual(draftBefore);
    expect(store.getCurrent()).toEqual(before);
    expect(f.controller.undo()).toBe(false);
  });
});

describe("placedSpaceMembers", () => {
  isolateTimers();
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
  afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });
  it("moves only the associated repetition when a member move is previewed", () => {
    // Given reordered opaque identities, repeated sources, a deletion gap, and a compiled sibling room.
    const f = placedSpaceFixture();
    const before = structuredClone(store.getCurrent());
    // When the selected actual repetition moves one tile.
    const preview = authoringValue(edits.previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
      edit: { kind: "move", member: selectedMember, position: { x: 9, y: 4 } } }));
    // Then exact mixed cells move, without changing the slot recipe or sibling source/instance.
    const doc = fixtureDocument(preview.project);
    const selected = own(doc.occurrences, opaqueMemberId);
    expect(selected.bindings[0]?.rect).toEqual({ x: 11, y: 8, width: 3, height: 3 });
    const map = own(preview.project.maps, `spatial:${spaceRoot}`);
    expect(map.lowerTiles[8 * map.width + 11]).toBe(402);
    expect(map.upperTiles[9 * map.width + 12]).toBe(433);
    expect(findOccurrenceChildId(doc, spaceRoot, { slotId: repeatedSlot, index: 1 })).toBeUndefined();
    expect(own(doc.occurrences, "opaque first member")).toEqual(own(fixtureDocument(before).occurrences, "opaque first member"));
    expect(own(doc.occurrences, "sibling room")).toEqual(own(fixtureDocument(before).occurrences, "sibling room"));
    expect(doc.library).toEqual(fixtureDocument(before).library);
    expect(store.getCurrent()).toEqual(before);
  });
  it("emits selected action chips when a repeated member changes", () => {
    // Given a chip-free repetition next to a same-source event-bearing member.
    const f = placedSpaceFixture();
    const before = structuredClone(store.getCurrent());
    // When the actual selected member gains event behavior.
    const preview = authoringValue(edits.previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
      edit: { kind: "chips", member: selectedMember, chips: ["event"] } }));
    // Then only its own frozen chips and event change, with the event at its actual translated position.
    const map = own(preview.project.maps, `spatial:${spaceRoot}`);
    const original = own(before.maps, map.id);
    const added = map.events.filter(event => !original.events.some(old => old.id === event.id));
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ x: 11, y: 10 });
    expect(own(fixtureDocument(preview.project).occurrences, "opaque first member")).toEqual(own(fixtureDocument(before).occurrences, "opaque first member"));
  });
  it("removes only the selected member when lifecycle deletion is previewed", () => {
    // Given actual repetitions zero and two; one was previously deleted.
    const f = placedSpaceFixture();
    const before = structuredClone(store.getCurrent());
    // When repetition two is removed through the controller lifecycle.
    const preview = authoringValue(edits.previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
      edit: { kind: "remove", member: selectedMember } }));
    // Then neither deleted repetition exists and the survivor keeps its frozen overrides.
    const doc = fixtureDocument(preview.project);
    expect(doc.occurrences[opaqueMemberId]).toBeUndefined();
    expect(findOccurrenceChildId(doc, spaceRoot, { slotId: repeatedSlot, index: 1 })).toBeUndefined();
    expect(own(doc.occurrences, "opaque first member")).toEqual(own(fixtureDocument(before).occurrences, "opaque first member"));
    expect(store.getCurrent()).toEqual(before);
  });
  it("adds exactly an explicit fixed object when its source is outside the frozen closure", () => {
    // Given a room whose closure contains only the hearth; the canonical bed exists separately.
    const f = placedSpaceFixture();
    const before = structuredClone(store.getCurrent());
    // When an explicit fixed bed is added, without re-expanding existing recipes.
    const preview = authoringValue(edits.previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
      edit: { kind: "add", slot: { id: spatialId("new-bed"), objectDesignId: spatialId("bed-design"), quantity: 1,
        required: true, placement: { mode: "fixed", x: 5, y: 1 } } } }));
    // Then a single associated member owns the requested frozen graphic, while old gaps stay absent.
    const doc = fixtureDocument(preview.project);
    const addedId = findOccurrenceChildId(doc, spaceRoot, { slotId: spatialId("new-bed"), index: 0 });
    if (!addedId) throw new TypeError("Missing explicit bed");
    expect(own(doc.occurrences, addedId).bindings[0]?.rect).toMatchObject({ x: 7, y: 5 });
    expect(Object.keys(doc.occurrences).length).toBe(Object.keys(fixtureDocument(before).occurrences).length + 1);
    expect(findOccurrenceChildId(doc, spaceRoot, { slotId: repeatedSlot, index: 1 })).toBeUndefined();
    expect(doc.library).toEqual(fixtureDocument(before).library);
  });
  it("extends quantity beyond the old capacity when deleted repetitions exist", () => {
    // Given a three-capacity slot with repetition one absent.
    const f = placedSpaceFixture();
    // When capacity explicitly grows by one with a fixed location for the new member.
    const preview = authoringValue(edits.previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
      edit: { kind: "quantity", slotId: repeatedSlot, quantity: 4, positions: [{ x: 5, y: 1 }] } }));
    // Then index three is added at the input location, without resurrecting index one.
    const doc = fixtureDocument(preview.project);
    const id = findOccurrenceChildId(doc, spaceRoot, { slotId: repeatedSlot, index: 3 });
    if (!id) throw new TypeError("Missing new repetition");
    expect(own(doc.occurrences, id).bindings[0]?.rect).toEqual({ x: 7, y: 5, width: 3, height: 3 });
    expect(findOccurrenceChildId(doc, spaceRoot, { slotId: repeatedSlot, index: 1 })).toBeUndefined();
  });
  it("leaves an empty compiled composition when the last recipe is removed", () => {
    // Given surviving members with owned compiled events.
    const f = placedSpaceFixture();
    const root = own(fixtureDocument(f.draft.project).occurrences, spaceRoot);
    const space = own(root.snapshot.library.spaces, root.source.id);
    // When the recipe is explicitly cleared through lifecycle continuation.
    const preview = authoringValue(edits.previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
      edit: { kind: "recipe", space: { ...space, objectSlots: [] } } }));
    // Then no actual children or object events remain, and the closed snapshot has no object dependencies.
    const doc = fixtureDocument(preview.project);
    expect(Object.values(doc.occurrences).filter(child => child.parentId === spaceRoot)).toEqual([]);
    expect(own(preview.project.maps, `spatial:${spaceRoot}`).events).toEqual([]);
    expect(own(doc.occurrences, spaceRoot).snapshot.library.objects).toEqual({});
  });
  it("rejects a blocked required placement atomically when an actual member moves", () => {
    // Given compiled output with clean history.
    const f = placedSpaceFixture();
    const before = structuredClone(store.getCurrent());
    // When the selected required object is moved onto its surviving sibling.
    const result = edits.previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
      edit: { kind: "move", member: selectedMember, position: { x: 1, y: 4 } } });
    // Then the real compiler refuses and no project/history subset is accepted.
    expect(result).toMatchObject({ kind: "error", error: { detail: "blocked" } });
    expect(store.getCurrent()).toEqual(before);
    expect(f.controller.undo()).toBe(false);
  });
  it("restores exact projects in one history step when a member edit is accepted", () => {
    // Given one detached actual-chip proposal, with the original complete project captured.
    const f = placedSpaceFixture();
    const before = structuredClone(store.getCurrent());
    const preview = authoringValue(edits.previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
      edit: { kind: "chips", member: selectedMember, chips: ["event"] } }));
    // When the real controller accepts the single final proposal and history traverses it.
    authoringValue(f.controller.apply(preview));
    const accepted = structuredClone(store.getCurrent());
    const undone = f.controller.undo();
    const restored = structuredClone(store.getCurrent());
    const secondUndo = f.controller.undo();
    const redone = f.controller.redo();
    // Then one undo suffices, and redo restores exactly the accepted output and identities.
    expect(accepted).toEqual(preview.project);
    expect([undone, secondUndo, redone]).toEqual([true, false, true]);
    expect(restored).toEqual(before);
    expect(store.getCurrent()).toEqual(accepted);
  });
  it("rejects a missing repetition when a deleted member is selected", () => {
    // Given an intentional deleted gap.
    const f = placedSpaceFixture();
    const before = structuredClone(store.getCurrent());
    // When an identity-dependent edit addresses that absent index.
    const result = edits.previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
      edit: { kind: "move", member: { slotId: repeatedSlot, index: 1 }, position: { x: 5, y: 1 } } });
    // Then a typed missing error replaces identity guessing or implicit resurrection.
    expect(result).toMatchObject({ kind: "error", error: { detail: "missing" } });
    expect(store.getCurrent()).toEqual(before);
  });
  it("rejects association-incomplete history when a member edit needs identity", () => {
    // Given an otherwise valid historical root without local-port associations.
    const f = placedSpaceFixture();
    const doc = fixtureDocument(f.draft.project);
    const { parentSlot: _slot, ...root } = own(doc.occurrences, spaceRoot);
    f.draft.project.spatialAuthoring = { ...doc, occurrences: { ...doc.occurrences, [spaceRoot]: {
      ...root, snapshot: { ...root.snapshot, ports: root.snapshot.ports.map(({ localPortId: _local, ...port }) => port) },
    } } };
    const before = structuredClone(store.getCurrent());
    // When a real controller proposal requests an associated member move.
    const result = edits.previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
      edit: { kind: "move", member: selectedMember, position: { x: 9, y: 4 } } });
    // Then no association is reconstructed from a source, order or generated ID spelling.
    expect(result).toMatchObject({ kind: "error", error: { detail: "association-required" } });
    expect(store.getCurrent()).toEqual(before);
  });
});
