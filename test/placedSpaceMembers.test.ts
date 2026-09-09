/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as edits from "../src/editor/spatial/placedSpaceEdits";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { findOccurrenceChildId, own, spatialId } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument, spaceRoot } from "./support/spatialSpaceCompilerFixture";
import { opaqueMemberId, placedSpaceFixture, repeatedSlot, selectedMember } from "./support/placedSpaceFixture";

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
