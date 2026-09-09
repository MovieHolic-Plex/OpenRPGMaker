// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as kitRender from "@/editor/harnessSuggestion/kitRender";
import * as roomPipeline from "@/editor/interiorRoomPipeline";
import { conceptHouseFloorPlan } from "@/editor/interiorConceptPlan";
import { previewPlaceMaps, previewPlaceRasters } from "@/editor/panels/spatialPlacePreview";
import { compileSpatialOccurrence } from "@/editor/spatial/compileSpatialOccurrence";
import { own, spatialId } from "@/project/spatial/domain";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { conceptFacilityTemplateById } from "@/project/defaults/conceptFacilityTemplates";
import type { GameMap, Project } from "@/project/types";
import { fixtureDocument, replaceOccurrence, spaceDesign } from "./support/spatialSpaceCompilerFixture";
import { exteriorPlaceFixture } from "./support/spatialPlaceGeometryFixture";
import { renderSpatialCardThumb } from "@/editor/panels/spatialGallery";
import { renderSpatialPlacesCanvas } from "@/editor/panels/spatialPlacesTab";
import {
  resetSpatialAuthoringSessions,
  type SpatialAuthoringSession,
} from "@/editor/panels/spatialAuthoringSession";
import { libraryPlaceCardId } from "@/editor/panels/spatialPlaceQuery";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { PlaceDesign } from "@/project/spatial/types";
import { placeCompilerFixture, placeRoot, stairFloors } from "./support/spatialPlaceCompilerFixture";

function tileData(map: GameMap) {
  return { width: map.width, height: map.height, tilesetId: map.tilesetId, lower: map.lowerTiles, upper: map.upperTiles };
}

function compiledMaps(project = store.getCurrent()) {
  const compiled = compileSpatialOccurrence(project, { occurrenceId: placeRoot });
  return own(fixtureDocument(compiled).occurrences, placeRoot).bindings.map(binding => own(compiled.maps, binding.mapId));
}

function compiledDesignMaps(project: Project, place: PlaceDesign) {
  const rootId = spatialId(`place-preview:${place.id}`);
  const document = fixtureDocument(project);
  const detached = { ...project, spatialAuthoring: instantiateSpatialDesign({ ...document,
    library: { ...document.library, places: { ...document.library.places, [place.id]: place } },
  }, project, { source: { kind: "place", id: place.id }, rootId, x: 0, y: 0, level: 0, seed: 7, generatorVersion: "place-preview" }) };
  const compiled = compileSpatialOccurrence(detached, { occurrenceId: rootId });
  return own(fixtureDocument(compiled).occurrences, rootId).bindings.map(binding => own(compiled.maps, binding.mapId));
}

const previous = store.getCurrent();

function villageOf(): PlaceDesign {
  const village = Object.values(store.getCurrent().spatialAuthoring?.library.places ?? {}).find((place) => place.kind === "settlement");
  if (!village) throw new Error("missing village");
  return village;
}

function sessionFor(place: PlaceDesign): SpatialAuthoringSession {
  return {
    tab: "places",
    mode: "design",
    source: "own",
    designId: libraryPlaceCardId(place.id),
    occurrenceId: null,
    camera: { x: 0, y: 0, zoom: 1 },
    breadcrumb: [],
    legacyOrigin: null,
    placeKindFilter: null,
    inspectorOpen: true,
  };
}

function placeCard(place: PlaceDesign) {
  return {
    id: libraryPlaceCardId(place.id),
    localId: place.id,
    name: place.name,
    source: "own" as const,
    kind: "places" as const,
    usage: 0,
    placeKind: place.kind,
  };
}

beforeEach(() => {
  resetSpatialAuthoringSessions();
  store.replace(placeCompilerFixture(7), { preserveEventDrafts: false });
});

afterEach(() => {
  vi.restoreAllMocks();
  resetSpatialAuthoringSessions();
  store.replace(previous, { preserveEventDrafts: false });
});

describe("spatial place rasters", () => {
  it("retains frozen map data when live source geometry and furniture change", () => {
    // Given: stored occurrences predate deliberately different live source edits.
    const project = store.getCurrent();
    const expected = compiledMaps(project);
    const document = fixtureDocument(project);
    const room = own(document.library.spaces, spaceDesign);
    const edited = { ...project, spatialAuthoring: { ...document, library: { ...document.library,
      spaces: { ...document.library.spaces, [room.id]: { ...room, width: room.width + 8, objectSlots: [] } },
    } } };
    // When: an uncompiled placed occurrence is previewed, without refreshing it.
    const preview = previewPlaceMaps({ project: edited, place: villageOf(), occurrenceId: placeRoot, floor: null });
    // Then: complete compiled maps, including frozen events and furniture, match the original snapshot.
    expect(preview.maps.map(entry => entry.map)).toEqual(expected);
  });

  it("uses selected source composition when design differs from existing occurrences", () => {
    // Given: a design removes the inn while its old occurrence still contains it.
    const project = store.getCurrent();
    const village = villageOf();
    const place = { ...village, children: village.children.filter(child => child.id === "square") };
    const expected = compiledDesignMaps(project, place).map(tileData);
    const before = JSON.stringify(project);
    // When: preview the selected design value, not the occurrence's frozen source.
    const preview = previewPlaceMaps({ project, place, floor: null });
    // Then: only the canonical square remains and compilation made no project writes.
    expect({ maps: preview.maps.map(entry => tileData(entry.map)), project: JSON.stringify(project) }).toEqual({ maps: expected, project: before });
  });

  it("preserves actual owned map edits when a compiled placed card opens", () => {
    // Given: the placed map has authored empty pixels and unrelated map context.
    const project = compileSpatialOccurrence(store.getCurrent(), { occurrenceId: placeRoot });
    const binding = own(fixtureDocument(project).occurrences, placeRoot).bindings[0];
    if (!binding) throw new TypeError("Missing square binding");
    const map = own(project.maps, binding.mapId);
    map.lowerTiles.fill(-1);
    map.upperTiles.fill(-1);
    const expected = own(fixtureDocument(project).occurrences, placeRoot).bindings.map(value => own(project.maps, value.mapId));
    store.replace(project, { preserveEventDrafts: false });
    const render = vi.spyOn(kitRender, "renderTileCellsToCanvas");
    const before = JSON.stringify(store.getCurrent());
    // When: gallery routing receives a placed card with an existing map ID.
    renderSpatialCardThumb({ ...placeCard(villageOf()), id: placeRoot, source: "placed", mapId: map.id });
    // Then: actual owned maps are rendered without recompilation, filler or live project mutation.
    expect(render.mock.calls.map(([input]) => input.cells)).toEqual(expected.map(value => kitRender.cellsFromMapRect(value, { x: 0, y: 0, width: value.width, height: value.height })));
    expect(JSON.stringify(store.getCurrent())).toBe(before);
  });

  it("uses frozen maps when the placed canvas receives a divergent live source", () => {
    // Given: live rooms no longer contain the placed furniture.
    const project = store.getCurrent();
    const expected = compiledMaps(project).map(map => kitRender.cellsFromMapRect(map, { x: 0, y: 0, width: map.width, height: map.height }));
    const document = fixtureDocument(project);
    const room = own(document.library.spaces, spaceDesign);
    store.replace({ ...project, spatialAuthoring: { ...document, library: { ...document.library,
      spaces: { ...document.library.spaces, [room.id]: { ...room, objectSlots: [] } },
    } } }, { preserveEventDrafts: false });
    const place = villageOf();
    const render = vi.spyOn(kitRender, "renderTileCellsToCanvas");
    // When: the actual canvas receives a placed card, not a design card.
    renderSpatialPlacesCanvas({ ...sessionFor(place), mode: "instances", occurrenceId: placeRoot }, { ...placeCard(place), id: placeRoot, source: "placed" }, () => undefined);
    // Then: caller plumbing selects the frozen composition.
    expect(render.mock.calls.map(([input]) => input.cells)).toEqual(expected);
  });

  it("reports a missing occurrence when a same-named live facility exists", () => {
    // Given: a live bundle cannot substitute for a missing frozen occurrence.
    const project = createBlankProject();
    const bundle = conceptFacilityTemplateById("inn");
    if (!bundle) throw new TypeError("Missing inn bundle");
    own(project.tilesets, roomPipeline.INTERIOR_ROOM_TILESET_ID).scratchConceptBundles = [bundle];
    store.replace(project, { preserveEventDrafts: false });
    // When: a stale placed card reaches the gallery.
    const thumb = renderSpatialCardThumb({ id: "missing-occurrence", localId: "inn", name: "Inn", source: "placed", kind: "places", usage: 0 });
    // Then: absence is surfaced instead of silently refreshing from a live bundle.
    expect(thumb.dataset.previewError).toBe("missing");
  });

  it("honors actual nested coordinates and floor when occurrence slots diverge", () => {
    // Given: floor two's actual placement differs from its frozen slot.
    const project = store.getCurrent();
    const floor = stairFloors(project)[1];
    if (!floor) throw new TypeError("Missing floor two");
    const moved = replaceOccurrence(project, { ...own(fixtureDocument(project).occurrences, floor.roomId), x: 7, y: 9 });
    const expected = compiledMaps(moved)[2];
    // When: only the selected second floor is previewed.
    const preview = previewPlaceMaps({ project: moved, place: villageOf(), occurrenceId: placeRoot, floor: 2 });
    // Then: the full interior map uses accumulated inn + floor coordinates, not map-local zero.
    expect(preview.maps).toEqual([{ map: expected, x: 31, y: 17, level: 2 }]);
  });

  it("includes mixed-layer exterior geometry when previewing the ground plane", () => {
    // Given: nested inn exterior shares the square's canonical outdoor map.
    const project = exteriorPlaceFixture();
    const place = own(fixtureDocument(project).library.places, "nested-village-design");
    const expected = compiledMaps(project)[0];
    // When: preview the placed ground plane.
    const preview = previewPlaceMaps({ project, place, occurrenceId: placeRoot, floor: 0 });
    // Then: the entire shared map retains both exterior layers and square offsets.
    expect(preview.maps).toEqual([{ map: expected, x: 0, y: 0, level: 0 }]);
  });

  it("scales offsets using the requested pixel scale when maps have local origins", () => {
    // Given: three nested floors begin at village tile (27,13).
    const project = store.getCurrent();
    // When: render floor one at twice the tile pixel size.
    const preview = previewPlaceRasters({ project, place: villageOf(), floor: 1, scale: 2 });
    // Then: offsets and bounds are in consistent tile units, not hardcoded 24px offsets.
    expect(preview.stamps.map(stamp => [stamp.x, stamp.y, stamp.canvas.style.left, stamp.canvas.style.top])).toEqual([[27, 13, "864px", "416px"]]);
    expect([preview.width, preview.height]).toEqual([47, 31]);
  });

  it.each([{ code: "clipped", x: 19, y: 15 }, { code: "format", x: 100, y: 100 }])("surfaces $code when a design cannot compile", ({ code, x, y }) => {
    // Given: the required object is clipped, or its declared origin fails the boundary parser.
    const project = store.getCurrent();
    const document = fixtureDocument(project);
    const square = own(document.library.spaces, "nested-square-design");
    const edited = { ...project, spatialAuthoring: { ...document, library: { ...document.library,
      spaces: { ...document.library.spaces, [square.id]: { ...square, objectSlots: square.objectSlots.map(slot => ({ ...slot, placement: { mode: "fixed" as const, x, y } })) } },
    } } };
    // When: render the selected design.
    const preview = previewPlaceRasters({ project: edited, place: villageOf(), floor: null, scale: 2 });
    // Then: failure is visible and no partial blank-success composition is returned.
    expect({ stamps: preview.stamps, code: preview.error?.split(":")[0] }).toEqual({ stamps: [], code });
  });

  it("propagates non-plan facility failures instead of rendering partial success", () => {
    // Given: the existing layer contract explicitly rejects the floor pass.
    store.replace(createBlankProject(), { preserveEventDrafts: false });
    const apply = roomPipeline.applyInteriorRoomLayer;
    vi.spyOn(roomPipeline, "applyInteriorRoomLayer").mockImplementation((map, plan, layer, vocab) =>
      layer === "floor" ? { map, layer, ok: false, summary: "", warnings: ["declared-floor-failure"] } : apply(map, plan, layer, vocab));
    // When: request a real default facility thumbnail.
    const thumb = renderSpatialCardThumb({ id: "inn", localId: "inn", name: "Inn", source: "default", kind: "places", usage: 0 });
    // Then: a declared error is surfaced, not replaced with a map canvas or blank fallback.
    expect(thumb.dataset.previewError).toBe("raster");
  });

  it("renders canonical square and all nested inn floors when the design board opens", () => {
    // Given: canonical compiler output includes objects, outdoor offsets and three inn floors.
    const village = villageOf();
    const expected = compiledDesignMaps(store.getCurrent(), village).map(map => ({
      widthTiles: map.width, heightTiles: map.height,
      cells: kitRender.cellsFromMapRect(map, { x: 0, y: 0, width: map.width, height: map.height }),
    }));
    const render = vi.spyOn(kitRender, "renderTileCellsToCanvas");
    // When: the real place canvas renders the selected design.
    renderSpatialPlacesCanvas(sessionFor(village), placeCard(village), () => undefined);
    // Then: every canonical composition, not just a room shell, reaches the pixel primitive.
    expect(render.mock.calls.map(([input]) => ({ widthTiles: input.widthTiles, heightTiles: input.heightTiles, cells: input.cells }))).toEqual(expected);
  });

  it("labels picker candidates with design names instead of duplicate kind chips", () => {
    const village = villageOf();
    const host = document.createElement("div");
    host.append(renderSpatialPlacesCanvas(sessionFor(village), placeCard(village), () => undefined));
    const labels = [...host.querySelectorAll(".spatial-place-pick")].map((node) => node.textContent ?? "");
    expect(labels.length).toBeGreaterThan(1);
    expect(labels.every((label) => label === "공간" || label === "장소")).toBe(false);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it.each(["default", "own"] as const)("renders project-aware facility composition when the %s card opens", source => {
    // Given: a project-authored bed raster differs from the shipped vocabulary.
    const project = createBlankProject();
    const tileset = own(project.tilesets, roomPipeline.INTERIOR_ROOM_TILESET_ID);
    const bundle = conceptFacilityTemplateById("inn");
    if (!bundle) throw new TypeError("Missing inn bundle");
    tileset.structureKits = tileset.structureKits?.map(kit => kit.id === "bed_v" && kit.kind === "section"
      ? { ...kit, rows: kit.rows.map(row => ({ ...row, tiles: row.tiles.map(tile => tile < 0 ? tile : 72) })) } : kit);
    tileset.scratchConceptBundles = [bundle];
    const expected = bundle.facilities.flatMap(facility => [...new Set(bundle.places.filter(place => facility.placeIds.includes(place.id)).map(place => place.level ?? 1))].map(level => {
      const plan = conceptHouseFloorPlan({ bundle, facility, tilesetId: tileset.id }, { mapId: "expected", name: facility.label, seed: 7, level });
      let map = roomPipeline.createEmptyRoomMap(plan);
      for (const layer of ["plan", "floor", "walls", "furniture"] as const) {
        const result = roomPipeline.applyInteriorRoomLayer(map, plan, layer, roomPipeline.interiorVocabFromTileset(tileset));
        if (!result.ok) throw new TypeError(result.warnings.join(";"));
        map = result.map;
      }
      return kitRender.cellsFromMapRect(map, { x: 0, y: 0, width: map.width, height: map.height });
    }));
    store.replace(project, { preserveEventDrafts: false });
    const render = vi.spyOn(kitRender, "renderTileCellsToCanvas");
    // When: the actual gallery previews the facility, not a furniture sprite.
    renderSpatialCardThumb({ id: "inn", localId: "inn", tilesetId: tileset.id, name: "Inn", source, kind: "places", usage: 0 });
    // Then: every floor's actual project-aware layer data reaches the existing pixel renderer.
    expect(render.mock.calls.map(([input]) => input.cells)).toEqual(expected);
  });
});
