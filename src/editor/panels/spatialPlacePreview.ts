import { reviewedPlaceMaps } from "@/project/defaults/spatial/reviewedPlaceCatalog";
import { TILE_SIZE } from "@/assets/bundled";
import { cellsFromMapRect, renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { conceptHouseFloorPlan } from "@/editor/interiorConceptPlan";
import { applyInteriorRoomLayer, createEmptyRoomMap, interiorVocabFromTileset, INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { visibleAuthoringProject } from "@/editor/panels/spatialAuthoringAccess";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { placeDraftTarget, placeFromProject } from "@/editor/panels/spatialPlaceDraft";
import { compileSpatialOccurrence, SpatialCompileError } from "@/editor/spatial/compileSpatialOccurrence";
import { ToolError } from "@/editor/tools/types";
import { conceptFacilityTemplateById } from "@/project/defaults/conceptFacilityTemplates";
import { ProjectFormatError } from "@/project/io/errors";
import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import { assertNever, own, spatialId, SpatialOperationError } from "@/project/spatial/domain";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import type { PlaceDesign, SpatialId } from "@/project/spatial/types";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const FACILITY_LAYERS = ["plan", "floor", "walls", "furniture"] as const;
type PlacePreviewInput = {
  readonly project: Project;
  readonly place: PlaceDesign;
  readonly occurrenceId?: SpatialId;
  readonly floor: number | null;
};
type PlacePreviewMap = { readonly map: GameMap; readonly x: number; readonly y: number; readonly level: number };
export type PlaceRasterStamp = { readonly x: number; readonly y: number; readonly canvas: HTMLCanvasElement };
export type PlaceRasterPreview = {
  readonly stamps: readonly PlaceRasterStamp[];
  readonly width: number;
  readonly height: number;
  readonly error: string | null;
};

/** Design expansion is a detached proposal; placed data never expands the live library. */
export function previewPlaceMaps(input: PlacePreviewInput): { readonly project: Project; readonly maps: readonly PlacePreviewMap[] } {
  let project = input.project;
  const document = project.spatialAuthoring;
  if (!document) throw new SpatialOperationError("missing", "spatialAuthoring");
  // The composer seeds automatic placement with occurrence IDs as well as the seed.
  const rootId = input.occurrenceId ?? spatialId(`place-preview:${input.place.id}`);
  if (input.occurrenceId === undefined) {
    const source = { ...document, library: { ...document.library, places: { ...document.library.places, [input.place.id]: input.place } } };
    project = { ...project, spatialAuthoring: instantiateSpatialDesign(source, project, {
      source: { kind: "place", id: input.place.id }, rootId, x: 0, y: 0, level: 0, seed: 7, generatorVersion: "place-preview",
    }) };
  }
  const root = own(project.spatialAuthoring?.occurrences ?? {}, rootId);
  switch (root.kind) {
    case "place": break;
    case "object": case "space": case "region": case "world": throw new SpatialCompileError("kind", rootId);
    default: assertNever(root);
  }
  // An owned map is the actual placed artifact, even after manual tile edits. Recompiling
  // it here would both discard that context and incorrectly invoke the write/digest guard.
  if (root.bindings.length === 0) project = compileSpatialOccurrence(project, { occurrenceId: rootId });
  const occurrences = project.spatialAuthoring?.occurrences ?? {};
  const pending = [{ occurrence: own(occurrences, rootId), x: 0, y: 0, level: 0 }];
  const maps = new Map<string, PlacePreviewMap>();
  for (const position of pending) {
    const { occurrence, x, y, level } = position;
    for (const child of Object.values(occurrences)) {
      if (child.parentId !== occurrence.id) continue;
      switch (child.kind) {
        case "place": case "space":
          pending.push({ occurrence: child, x: x + child.x, y: y + child.y, level: level + child.level });
          break;
        case "object": break;
        case "region": case "world": throw new SpatialCompileError("kind", child.id);
        default: assertNever(child);
      }
    }
    if (input.floor !== null && level !== input.floor) continue;
    for (const binding of occurrence.bindings.filter(isOwnedSpatialBinding)) {
      if (maps.has(binding.mapId)) continue;
      const map = own(project.maps, binding.mapId);
      maps.set(map.id, { map, x: x - binding.rect.x, y: y - binding.rect.y, level });
    }
  }
  return { project, maps: [...maps.values()] };
}

function mapCanvas(tileset: TilesetDef, map: GameMap, scale: number): HTMLCanvasElement {
  return renderTileCellsToCanvas({
    tileset, widthTiles: map.width, heightTiles: map.height,
    cells: cellsFromMapRect(map, { x: 0, y: 0, width: map.width, height: map.height }),
    scale, backgroundTile: null,
  });
}

function previewError(error: unknown): { readonly code: string; readonly text: string } {
  if (error instanceof ProjectFormatError) return { code: "format", text: `format: ${error.message}` };
  if (error instanceof SpatialCompileError || error instanceof SpatialOperationError || error instanceof ToolError) {
    return { code: error.code, text: error.message };
  }
  throw error;
}

export function previewPlaceRasters(input: PlacePreviewInput & { readonly scale: number }): PlaceRasterPreview {
  try {
    const preview = previewPlaceMaps(input);
    const stamps = preview.maps.map(({ map, x, y }) => {
      const canvas = mapCanvas(own(preview.project.tilesets, map.tilesetId), map, input.scale);
      canvas.classList.add("spatial-place-raster");
      canvas.style.left = `${x * TILE_SIZE * input.scale}px`;
      canvas.style.top = `${y * TILE_SIZE * input.scale}px`;
      return { x, y, canvas };
    });
    return { stamps, width: Math.max(0, ...preview.maps.map(({ map, x }) => x + map.width)),
      height: Math.max(0, ...preview.maps.map(({ map, y }) => y + map.height)), error: null };
  } catch (error) {
    return { stamps: [], width: 0, height: 0, error: previewError(error).text };
  }
}

/** Compatibility facilities still use their real authored concept plan and tileset vocabulary. */
function facilityMaps(project: Project, card: SpatialGalleryCard): readonly PlacePreviewMap[] {
  const tilesetId = card.tilesetId ?? INTERIOR_ROOM_TILESET_ID;
  const tileset = own(project.tilesets, tilesetId);
  let bundle: ReturnType<typeof conceptFacilityTemplateById>;
  switch (card.source) {
    case "default": bundle = conceptFacilityTemplateById(card.localId ?? card.id); break;
    case "own": bundle = tileset.scratchConceptBundles?.find(bundle => bundle.id === card.localId); break;
    case "placed": throw new SpatialOperationError("missing", card.id);
    default: return assertNever(card.source);
  }
  if (!bundle) throw new SpatialOperationError("missing", card.id);
  const vocab = interiorVocabFromTileset(tileset);
  return bundle.facilities.flatMap(facility => {
    const levels = [...new Set(bundle.places.filter(place => facility.placeIds.includes(place.id)).map(place => place.level ?? 1))];
    return levels.map(level => {
      const plan = conceptHouseFloorPlan({ bundle, facility, tilesetId },
        { mapId: `spatial-place-thumb:${bundle.id}:${facility.id}:${level}`, name: facility.label, seed: 7, level });
      let map = createEmptyRoomMap(plan);
      for (const layer of FACILITY_LAYERS) {
        const result = applyInteriorRoomLayer(map, plan, layer, vocab);
        if (!result.ok) throw new SpatialCompileError("raster", `${map.id}:${layer}:${result.warnings.join(";")}`);
        map = result.map;
      }
      return { map, x: 0, y: 0, level };
    });
  });
}

/**
 * 스테이지용 — 설계 레코드가 없는 카드(꾸러미 시설 등)도 읽기 전용 래스터를 그린다.
 * 편집용 previewPlaceRasters 와 달리 프로젝트를 바꾸지 않고, 실패를 error 문자열로 돌려준다.
 */
export function placeCatalogRasters(project: Project, card: SpatialGalleryCard, scale: number): PlaceRasterPreview {
  if (card.reviewedPlaceId) return reviewedRasters(card.reviewedPlaceId, scale);
  try {
    const maps = facilityMaps(project, card);
    const stamps = maps.map(({ map, x, y }) => {
      const canvas = mapCanvas(own(project.tilesets, map.tilesetId), map, scale);
      canvas.classList.add("spatial-place-raster");
      canvas.style.left = `${x * TILE_SIZE * scale}px`;
      canvas.style.top = `${y * TILE_SIZE * scale}px`;
      return { x, y, canvas };
    });
    return {
      stamps,
      width: Math.max(0, ...maps.map(({ map, x }) => x + map.width)),
      height: Math.max(0, ...maps.map(({ map, y }) => y + map.height)),
      error: null,
    };
  } catch (error) {
    try {
      return { stamps: [], width: 0, height: 0, error: previewError(error).text };
    } catch {
      return { stamps: [], width: 0, height: 0, error: "미리보기를 만들 수 없습니다" };
    }
  }
}

export function renderPlaceCardThumb(card: SpatialGalleryCard): HTMLElement {
  if (card.reviewedPlaceId) return el("div", { class: "spatial-card-map", children: reviewedRasters(card.reviewedPlaceId, 0.35).stamps.map(s => s.canvas) });
  const project = visibleAuthoringProject();
  try {
    const target = placeDraftTarget(card);
    const place = placeFromProject(project, target);
    const preview = place
      ? previewPlaceMaps({ project, place, floor: null, ...(target.occurrenceId ? { occurrenceId: target.occurrenceId } : {}) })
      : { project, maps: facilityMaps(project, card) };
    // Separate maps/floors stay separate; a thumbnail must not drop all but the first stamp.
    return el("div", { class: "spatial-card-map", children: preview.maps.map(({ map }) => {
      const canvas = mapCanvas(own(preview.project.tilesets, map.tilesetId), map, 2);
      canvas.classList.add("spatial-card-map");
      return canvas;
    }) });
  } catch (error) {
    const failure = previewError(error);
    return el("span", { class: "spatial-place-preview-error", text: failure.text, dataset: { previewError: failure.code } });
  }
}

export function childSourceLabel(project: Project, kind: "space" | "place", id: string): string {
  const library = project.spatialAuthoring?.library;
  switch (kind) {
    case "place": return library?.places[id]?.name ?? "장소";
    case "space": return library?.spaces[id]?.name ?? "장소";
    default: return assertNever(kind);
  }
}

function reviewedRasters(id: string, scale: number): PlaceRasterPreview {
  let offset = 0;
  const maps = reviewedPlaceMaps(id);
  const stamps = maps.map(({ map }) => {
    const canvas = document.createElement("canvas");
    const drawScale = Math.min(scale, 1024 / (Math.max(map.width, map.height) * 16));
    canvas.width = Math.ceil(map.width * 16 * drawScale);
    canvas.height = Math.ceil(map.height * 16 * drawScale);
    canvas.style.width = `${map.width * 16 * scale}px`;
    canvas.style.height = `${map.height * 16 * scale}px`;
    canvas.style.left = `${offset * 16 * scale}px`;
    canvas.className = "spatial-place-raster";
    const img = new Image();
    img.onload = () => { const ctx = canvas.getContext("2d"); if(ctx) { ctx.imageSmoothingEnabled = false; ctx.drawImage(img,0,0,canvas.width,canvas.height); canvas.dataset.loaded="true"; } };
    img.src = `/assets/reviewed-places/${map.id}.png`;
    const stamp = { x: offset, y: 0, canvas }; offset += map.width + 2; return stamp;
  });
  return { stamps, width: offset, height: Math.max(...maps.map(m=>m.map.height)), error: null };
}
