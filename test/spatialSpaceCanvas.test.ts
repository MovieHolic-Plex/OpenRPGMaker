// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import * as kitRender from "@/editor/harnessSuggestion/kitRender";
import { renderSpatialSpacesCanvas } from "@/editor/panels/spatialSpaceCanvas";
import { librarySpaceCardId } from "@/editor/panels/spatialSpaceDraft";
import { resetSpatialSpacesTabChrome } from "@/editor/panels/spatialSpacesTab";
import { spaceLayout } from "@/editor/spatial/spaceLayout";
import { own } from "@/project/spatial/domain";
import { store } from "@/project/store";
import { fixtureDocument, spaceCompilerFixture, spaceDesign } from "./support/spatialSpaceCompilerFixture";

const previous = store.getCurrent();

afterEach(() => {
  vi.restoreAllMocks();
  resetSpatialSpacesTabChrome();
  store.replace(previous);
});

it("renders map-relative cells when a space board opens", () => {
  // Given: a real room layout and the renderer's canonical map-cell conversion.
  const project = spaceCompilerFixture();
  store.replace(project);
  resetSpatialSpacesTabChrome();
  const space = own(fixtureDocument(project).library.spaces, spaceDesign);
  const { map } = spaceLayout(project, space, { mapId: `spatial-canvas:${space.id}`, seed: 7 });
  const expected = kitRender.cellsFromMapRect(map, { x: 0, y: 0, width: map.width, height: map.height });
  const render = vi.spyOn(kitRender, "renderTileCellsToCanvas");
  const card = {
    id: librarySpaceCardId(spaceDesign), localId: spaceDesign, name: space.name,
    source: "own", kind: "spaces", usage: 0,
  } as const;

  // When: the real space canvas builds its board and gallery.
  renderSpatialSpacesCanvas({
    tab: "spaces", mode: "design", source: "own", designId: card.id, occurrenceId: null,
    camera: { x: 0, y: 0, zoom: 1 }, breadcrumb: [], legacyOrigin: null,
    placeKindFilter: null, inspectorOpen: true,
  }, card, () => undefined);

  // Then: the board renderer receives every occupied cell at its actual map-relative coordinate.
  expect(expected.length).toBeGreaterThan(0);
  expect(render).toHaveBeenCalledWith(expect.objectContaining({
    widthTiles: map.width, heightTiles: map.height, cells: expected,
  }));
});
