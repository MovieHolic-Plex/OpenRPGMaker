/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { bindSpatialAuthoringControllerFactory, visibleAuthoringProject } from "../src/editor/panels/spatialAuthoringAccess";
import { patchSpatialSession, resetSpatialAuthoringSessions, spatialSession } from "../src/editor/panels/spatialAuthoringSession";
import { placeChromeState, resetSpatialPlacesTabChrome } from "../src/editor/panels/spatialPlaceChromeState";
import { spatialPlacesChrome, visiblePlaceSelection } from "../src/editor/panels/spatialPlaceCommands";
import { libraryPlaceCardId } from "../src/editor/panels/spatialPlaceQuery";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { own } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { placeCompilerFixture, placeRoot } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

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
