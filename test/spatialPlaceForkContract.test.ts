// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { getMapEditHistoryEntries, getMapEditHistoryState } from "@/editor/mapEditHistory";
import { visibleAuthoringProject } from "@/editor/panels/spatialAuthoringAccess";
import { spatialSession } from "@/editor/panels/spatialAuthoringSession";
import {
  renderSpatialPlacesInspector,
  resetSpatialPlacesTabChrome,
  spatialPlacesChrome,
  visiblePlaceSelection,
} from "@/editor/panels/spatialPlacesTab";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { setupCombinedAuthoring } from "./support/combinedAuthoringFixture";
import { installManualProject } from "./support/spatialManualBuildFixture";
import { placeCompilerFixture } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

setupCombinedAuthoring();
afterEach(resetSpatialPlacesTabChrome);

it("accepts the first named place in one undoable transaction when inspector edits fork a real controller draft", () => {
  // Given: a canonical empty live place library, retaining independent frozen occurrences.
  const fixture = placeCompilerFixture(7);
  const spatial = fixtureDocument(fixture);
  const canonical = deserialize(serialize({
    ...fixture,
    spatialAuthoring: { ...spatial, library: { ...spatial.library, places: {} } },
  }));
  installManualProject(canonical);
  resetSpatialPlacesTabChrome();
  const live = store.getCurrent();
  const frozenOccurrences = structuredClone(fixtureDocument(live).occurrences);
  expect(Object.keys(frozenOccurrences).length).toBeGreaterThan(0);
  const host = document.createElement("div");
  const paint = (): void => {
    host.replaceChildren(renderSpatialPlacesInspector(visiblePlaceSelection(undefined), true, paint));
  };
  const chrome = () => spatialPlacesChrome(visiblePlaceSelection(undefined), paint);
  const nameValue = "\uD638\uC22B\uAC00";

  // When: the public place actions add, rename, preview and accept through the real controller.
  chrome().add?.();
  const created = Object.values(fixtureDocument(visibleAuthoringProject()).library.places);
  expect(created).toHaveLength(1);
  const place = created[0];
  if (!place) throw new TypeError("Expected the created place");
  expect(place).toMatchObject({ children: [], ports: [], connections: [], tags: [] });
  expect(visiblePlaceSelection(undefined)?.localId).toBe(place.id);
  expect(spatialSession().designId).toBe(visiblePlaceSelection(undefined)?.id);
  const name = host.querySelector<HTMLInputElement>("[data-testid='spatial-place-name']");
  if (!name) throw new TypeError("Expected the place name input");
  name.value = nameValue;
  name.dispatchEvent(new Event("change"));
  expect(store.getCurrent()).toBe(live);
  expect(fixtureDocument(live).library.places).toEqual({});
  expect(fixtureDocument(visibleAuthoringProject()).library.places[place.id]?.name).toBe(nameValue);
  chrome().preview?.();
  expect(chrome().previewError).toBeNull();
  expect(chrome().apply).toBeTypeOf("function");
  expect(store.getCurrent()).toBe(live);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
  chrome().apply?.();

  // Then: acceptance preserves the named design and frozen output, with exactly one undo/redo.
  expect(chrome().previewError).toBeNull();
  const accepted = structuredClone(store.getCurrent());
  expect(Object.keys(fixtureDocument(accepted).library.places)).toEqual([place.id]);
  expect(fixtureDocument(accepted).library.places[place.id]?.name).toBe(nameValue);
  expect(fixtureDocument(accepted).occurrences).toEqual(frozenOccurrences);
  expect(deserialize(serialize(accepted))).toEqual(accepted);
  expect(getMapEditHistoryEntries()).toHaveLength(1);
  chrome().undo?.();
  expect(store.getCurrent()).toEqual(live);
  expect(getMapEditHistoryState()).toEqual({ canUndo: false, canRedo: true });
  chrome().redo?.();
  expect(store.getCurrent()).toEqual(accepted);
  expect(getMapEditHistoryState()).toEqual({ canUndo: true, canRedo: false });
});
