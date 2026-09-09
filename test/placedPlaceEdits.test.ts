/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { patchOccurrencePlace } from "../src/editor/panels/spatialPlaceDraft";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { own, requireOccurrenceAssociations, spatialId } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { placeChild, placeCompilerFixture, placeRoot } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

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
