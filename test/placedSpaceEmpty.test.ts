/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { previewPlacedSpaceEdit } from "../src/editor/spatial/placedSpaceEdits";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { own } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument, spaceRoot } from "./support/spatialSpaceCompilerFixture";
import { placedSpaceFixture, repeatedSlot, selectedMember } from "./support/placedSpaceFixture";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it("keeps frozen repetition templates empty when the last actual member is removed", () => {
  // Given one surviving member in an issued continuation, with capacity three still captured.
  const f = placedSpaceFixture();
  const before = structuredClone(store.getCurrent());
  const first = authoringValue(previewPlacedSpaceEdit(f.controller, f.draft, { occurrenceId: spaceRoot, compile: f.compile,
    edit: { kind: "remove", member: selectedMember } }));
  const draft = authoringValue(f.controller.continueDraft(first));
  // When the final actual member is removed, without deleting the frozen slot recipe.
  const preview = authoringValue(previewPlacedSpaceEdit(f.controller, draft, { occurrenceId: spaceRoot, compile: f.compile,
    edit: { kind: "remove", member: { slotId: repeatedSlot, index: 0 } } }));
  // Then no template repetition is resurrected or emitted as a compiled object/event.
  const doc = fixtureDocument(preview.project);
  const root = own(doc.occurrences, spaceRoot);
  expect(own(root.snapshot.library.spaces, root.source.id).objectSlots).toMatchObject([{ id: repeatedSlot, quantity: 3 }]);
  expect(Object.values(doc.occurrences).filter(child => child.parentId === spaceRoot)).toEqual([]);
  expect(own(preview.project.maps, `spatial:${spaceRoot}`).events).toEqual([]);
  expect(own(preview.project.maps, "spatial:sibling room")).toEqual(own(before.maps, "spatial:sibling room"));
  expect(store.getCurrent()).toEqual(before);
});
