/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { previewPlacedSpaceEdit } from "../src/editor/spatial/placedSpaceEdits";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { own, requireOccurrenceAssociations } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument, spaceRoot } from "./support/spatialSpaceCompilerFixture";
import { opaqueMemberId, placedSpaceFixture, repeatedSlot } from "./support/placedSpaceFixture";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it("deletes out-of-capacity actual indices when quantity shrinks", () => {
  // Given indices zero and two, with index one absent.
  const f = placedSpaceFixture();
  const before = structuredClone(store.getCurrent());
  // When capacity shrinks to two, only index two is outside the retained template.
  const preview = authoringValue(previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
    edit: { kind: "quantity", slotId: repeatedSlot, quantity: 2, positions: [] } }));
  // Then the selected out-of-range member is removed without touching the surviving member.
  const doc = fixtureDocument(preview.project);
  expect(doc.occurrences[opaqueMemberId]).toBeUndefined();
  expect(own(doc.occurrences, "opaque first member")).toEqual(own(fixtureDocument(before).occurrences, "opaque first member"));
  expect(Object.values(doc.occurrences).filter(child => child.parentId === spaceRoot)).toHaveLength(1);
});

it("removes the slot closure when explicit quantity reaches zero", () => {
  // Given the last recipe contains two surviving actual members.
  const f = placedSpaceFixture();
  // When quantity is explicitly reduced to zero through lifecycle continuation.
  const preview = authoringValue(previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
    edit: { kind: "quantity", slotId: repeatedSlot, quantity: 0, positions: [] } }));
  // Then actual composition, effective events and now-unreferenced frozen rasters are empty.
  const doc = fixtureDocument(preview.project);
  expect(Object.values(doc.occurrences).filter(child => child.parentId === spaceRoot)).toEqual([]);
  expect(own(doc.occurrences, spaceRoot).snapshot.kitCells).toEqual({});
  expect(own(preview.project.maps, `spatial:${spaceRoot}`).events).toEqual([]);
});

it("rejects omitted fixed positions when quantity grows", () => {
  // Given a frozen fixed recipe whose missing repetition must not become an automatic layout request.
  const f = placedSpaceFixture();
  const before = structuredClone(store.getCurrent());
  // When growth supplies no position for its explicit new member.
  const result = previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
    edit: { kind: "quantity", slotId: repeatedSlot, quantity: 4, positions: [] } });
  // Then a typed input error preserves both the source and actual project.
  expect(result).toMatchObject({ kind: "error", error: { detail: "positions-required" } });
  expect(store.getCurrent()).toEqual(before);
});

it("rejects an occupied optional member when its slot becomes required", () => {
  // Given a compiled optional repetition omitted because it overlaps the first member.
  const f = placedSpaceFixture();
  const document = fixtureDocument(f.draft.project);
  const root = requireOccurrenceAssociations(own(document.occurrences, spaceRoot));
  const space = own(root.snapshot.library.spaces, root.source.id);
  const child = own(document.occurrences, opaqueMemberId);
  const optional = { ...space, objectSlots: space.objectSlots.map(slot => ({ ...slot, required: false })) };
  const project = { ...f.draft.project, spatialAuthoring: { ...document, occurrences: { ...document.occurrences,
    [child.id]: { ...child, x: 1, y: 4 }, [root.id]: { ...root, snapshot: { ...root.snapshot,
      library: { ...root.snapshot.library, spaces: { [space.id]: optional } } } },
  } } };
  store.replace(compileSpatialOccurrence(project, f.compile));
  resetMapEditHistory();
  const controller = createSpatialAuthoringController();
  const draft = authoringValue(controller.createDraft());
  const before = structuredClone(store.getCurrent());
  // When the existing slot contract changes from optional to required.
  const result = previewPlacedSpaceEdit(controller, draft, { occurrenceId: spaceRoot, compile: f.compile,
    edit: { kind: "recipe", space: { ...optional, objectSlots: optional.objectSlots.map(slot => ({ ...slot, required: true })) } } });
  // Then compiler requiredness refuses the occupied placement atomically.
  expect(result).toMatchObject({ kind: "error", error: { detail: "blocked" } });
  expect(store.getCurrent()).toEqual(before);
  expect(controller.undo()).toBe(false);
});
