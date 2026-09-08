/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { movePort, moveSlot, patchOccurrenceSpace, setSlotChips } from "../src/editor/panels/spatialSpaceDraft";
import { findOccurrenceChildId, own, spatialId } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument, spaceCompilerFixture, spaceRoot } from "./support/spatialSpaceCompilerFixture";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

function setup() {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(compileSpatialOccurrence(spaceCompilerFixture(), { occurrenceId: spaceRoot }));
  resetMapEditHistory();
  const controller = createSpatialAuthoringController();
  return { controller, draft: authoringValue(controller.createDraft()) };
}

it("moves compiled mixed cells when a placed fixed slot moves", () => {
  // Given a compiled room with an asymmetric three-by-three hearth.
  const f = setup();
  const before = structuredClone(store.getCurrent());
  const childId = findOccurrenceChildId(fixtureDocument(before), spaceRoot, { slotId: spatialId("hearth"), index: 0 });
  if (!childId) throw new TypeError("Missing hearth");
  // When the existing panel mutation seam changes the slot and compiles.
  Object.assign(f.draft.project, patchOccurrenceSpace(f.draft.project, spaceRoot, space => moveSlot(space, spatialId("hearth"), 2, 4)));
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: { occurrenceId: spaceRoot } }));
  // Then projections and both layers move to the input offset; live output is untouched.
  const child = own(fixtureDocument(preview.project).occurrences, childId);
  expect(child.x).toBe(2);
  const binding = child.bindings[0];
  if (!binding) throw new TypeError("Missing projection");
  expect(binding.rect).toEqual({ x: 4, y: 8, width: 3, height: 3 });
  const map = own(preview.project.maps, binding.mapId);
  expect(map.lowerTiles[8 * map.width + 4]).toBe(402);
  expect(map.upperTiles[9 * map.width + 5]).toBe(433);
  expect(store.getCurrent()).toEqual(before);
});

it("changes effective event chips when a placed slot recipe changes", () => {
  // Given a compiled event-bearing hearth.
  const f = setup();
  const childId = findOccurrenceChildId(fixtureDocument(f.draft.project), spaceRoot, { slotId: spatialId("hearth"), index: 0 });
  if (!childId) throw new TypeError("Missing hearth");
  // When the inspector seam removes that slot's action chips.
  Object.assign(f.draft.project, patchOccurrenceSpace(f.draft.project, spaceRoot, space => setSlotChips(space, spatialId("hearth"), [])));
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: { occurrenceId: spaceRoot } }));
  // Then effective chips and their generated events disappear together.
  const child = own(fixtureDocument(preview.project).occurrences, childId);
  expect(own(child.snapshot.library.objects, child.source.id).chips).toEqual([]);
  const beforeMap = own(store.getCurrent().maps, `spatial:${spaceRoot}`);
  expect(own(preview.project.maps, beforeMap.id).events.length).toBe(beforeMap.events.length - 1);
});

it("moves the concrete landing when the named entry moves", () => {
  // Given a compiled entry whose concrete identity differs from its local name.
  const f = setup();
  const root = own(fixtureDocument(f.draft.project).occurrences, spaceRoot);
  const port = root.snapshot.ports[0];
  if (!port) throw new TypeError("Missing entry");
  // When the existing panel seam moves the named entry to an interior floor cell.
  Object.assign(f.draft.project, patchOccurrenceSpace(f.draft.project, spaceRoot, space => movePort(space, spatialId("entry"), 7, 10)));
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: { occurrenceId: spaceRoot } }));
  // Then the same concrete identity lands at the translated input position.
  const next = own(fixtureDocument(preview.project).occurrences, spaceRoot);
  expect(next.snapshot.ports).toContainEqual({ ...port, x: 7, y: 10 });
  expect(next.bindings[0]?.ports).toContainEqual({ portId: port.id, x: 9, y: 14 });
});
