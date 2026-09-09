/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { spatialRasterDigest } from "../src/editor/spatial/compilerValidation";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { store } from "../src/project/store";
import { own } from "../src/project/spatial/domain";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { placeCompilerFixture, placeRoot, stairFloors, withStairConnections } from "./support/spatialPlaceCompilerFixture";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory();
});
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it("removes exact outside stair events when explicit deletion removes the middle floor", () => {
  // Given three compiled floors connected through real owned stair transfer events.
  const input = withStairConnections(placeCompilerFixture());
  const middle = stairFloors(input)[1];
  if (!middle) throw new TypeError("Missing middle floor");
  store.replace(compileSpatialOccurrence(input, { occurrenceId: placeRoot }));
  const before = structuredClone(store.getCurrent());
  const middleBinding = own(fixtureDocument(before).occurrences, middle.roomId).bindings.find(isOwnedSpatialBinding);
  if (!middleBinding) throw new TypeError("Missing floor owner");
  const incoming = before.mapConnections?.filter(link => link.to.mapId === middleBinding.mapId) ?? [];
  expect(incoming).toHaveLength(2);
  const controller = createSpatialAuthoringController();
  // When external connection removal is explicitly requested for that floor.
  const preview = authoringValue(controller.preview(authoringValue(controller.createDraft()), { operation: { kind: "delete-occurrence",
    request: { occurrenceId: middle.roomId, externalConnections: "remove" } } }));
  // Then only the removed stair pair events disappear from surviving floors; their terrain stays intact.
  for (const link of incoming) {
    const map = own(preview.project.maps, link.from.mapId);
    expect(map.events.some(event => event.id === link.id)).toBe(false);
    expect(map.lowerTiles).toEqual(own(before.maps, link.from.mapId).lowerTiles);
    expect(preview.project.mapConnections?.some(value => value.id === link.id)).toBe(false);
    const binding = Object.values(fixtureDocument(preview.project).occurrences).flatMap(value => value.bindings)
      .find(value => isOwnedSpatialBinding(value) && value.mapId === map.id);
    if (!binding || !isOwnedSpatialBinding(binding)) throw new TypeError("Missing surviving owner");
    expect(binding.contentDigest).toBe(spatialRasterDigest(map, binding));
  }
});
