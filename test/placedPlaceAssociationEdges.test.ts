/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { previewPlacedPlaceEdit } from "../src/editor/spatial/placedPlaceEdits";
import { own, spatialId } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { placeChild, placeCompilerFixture, placeRoot } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

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
