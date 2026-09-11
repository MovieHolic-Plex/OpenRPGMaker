import { drawMapTileLayers, loadTilesetImage, MapTileDrawError } from "@/editor/mapTileDraw";
import { SpatialCompileError } from "@/editor/spatial/compilerTypes";
import { geographyTerrain, paintGeographyRoute, settlementTerrain } from "@/editor/spatial/geographyTerrain";
import { settlementVillageBuild } from "@/editor/spatial/settlementVillageBuild";
import { ToolError } from "@/editor/tools/types";
import type { GeographyDesign } from "@/editor/panels/spatialGeographyDraft";
import { worldCrossingPoints } from "@/editor/panels/spatialGeographyGeometry";
import type { SpatialId, SpatialPoint } from "@/project/spatial/types";
import type { GameMap, Project } from "@/project/types";
import { el } from "@/util/dom";

export const GEOGRAPHY_TILE_PX = 8;

export function geographyPreviewMapId(design: GeographyDesign, occurrenceId?: SpatialId): string {
  return occurrenceId
    ? `spatial-geography:${occurrenceId.length}:${occurrenceId}`
    : `spatial-geography-ui:${design.id}`;
}

function previewRoutes(design: GeographyDesign): readonly { readonly id: SpatialId; readonly points: readonly SpatialPoint[] }[] {
  if ("places" in design) return design.routes;
  const children = new Map(design.regions.map((region) => [region.id, region]));
  return design.connections.flatMap((link) => {
    const from = link.from.childId ? children.get(link.from.childId) : undefined;
    const to = link.to.childId ? children.get(link.to.childId) : undefined;
    if (!from || !to) return [];
    return [{ id: link.id, points: worldCrossingPoints(from, to) }];
  });
}

export type GeographyPreviewError = { readonly code: string; readonly path: string };
export type GeographyPreviewMap = {
  readonly project: Project;
  readonly map?: GameMap;
  readonly error?: GeographyPreviewError;
};

function typedPreviewError(error: unknown): GeographyPreviewError | undefined {
  if (error instanceof SpatialCompileError) return { code: error.code, path: error.path };
  if (error instanceof ToolError) return { code: error.code, path: error.mapId ?? error.message };
  return undefined;
}

/** Clone-only preview: original project and any retained private atlas stay intact. */
export function geographyPreviewMap(
  project: Project,
  design: GeographyDesign,
  occurrenceId?: SpatialId,
): GeographyPreviewMap {
  const id = geographyPreviewMapId(design, occurrenceId);
  const identity = { id, name: design.name };
  const next = structuredClone(project);
  const settlement = "settlement" in design ? design.settlement : undefined;
  let terrain: GameMap;
  try {
    terrain = settlement
      ? settlementTerrain(next, design.terrain, identity)
      : geographyTerrain(next, design.terrain, identity);
    if (settlement) {
      next.maps[id] = terrain;
      settlementVillageBuild(next, { mapId: id, presetId: settlement.presetId, seed: settlement.seed, interior: false });
    }
  } catch (error) {
    const typed = typedPreviewError(error);
    if (!typed) throw error;
    return { project: next, error: typed };
  }
  const painted = structuredClone(next);
  const routed = structuredClone(terrain);
  try {
    for (const route of previewRoutes(design)) paintGeographyRoute(painted, routed, route);
  } catch (error) {
    const typed = typedPreviewError(error);
    if (!typed) throw error;
    next.maps[id] = terrain;
    return { project: next, map: terrain, error: typed };
  }
  painted.maps[id] = routed;
  return { project: painted, map: routed };
}

export function geographyRasterTile(map: GameMap, x: number, y: number): number {
  return map.lowerTiles[y * map.width + x] ?? -1;
}

export function paintGeographyAtlas(canvas: HTMLCanvasElement, project: Project, map: GameMap): Promise<void> {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) {
    canvas.dataset.painted = "missing-atlas";
    return Promise.resolve();
  }
  const tile = map.tileSize || tileset.tileSize || 16;
  canvas.width = Math.max(1, map.width * tile);
  canvas.height = Math.max(1, map.height * tile);
  canvas.dataset.tile = String(tile);
  return loadTilesetImage(tileset).then((image) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    drawMapTileLayers(ctx, image, map, tileset, 1);
    canvas.dataset.painted = "atlas";
  }).catch((error: unknown) => {
    if (error instanceof MapTileDrawError) {
      canvas.dataset.painted = "missing-atlas";
      return;
    }
    throw error;
  });
}

export function renderGeographyRaster(
  project: Project,
  design: GeographyDesign,
  occurrenceId?: SpatialId,
): { readonly node: HTMLElement; readonly map?: GameMap; readonly error?: GeographyPreviewError } {
  const preview = geographyPreviewMap(project, design, occurrenceId);
  const canvas = document.createElement("canvas");
  canvas.className = "spatial-geography-raster";
  canvas.dataset.testid = "spatial-geography-raster";
  canvas.dataset.painted = preview.map ? "pending" : "error";
  if (preview.error) canvas.dataset.error = `${preview.error.code}:${preview.error.path}`;
  if (preview.map) {
    canvas.dataset.width = String(preview.map.width);
    canvas.dataset.height = String(preview.map.height);
    canvas.dataset.tileset = preview.map.tilesetId;
    canvas.style.width = `${preview.map.width * GEOGRAPHY_TILE_PX}px`;
    canvas.style.height = `${preview.map.height * GEOGRAPHY_TILE_PX}px`;
    void paintGeographyAtlas(canvas, preview.project, preview.map);
  }
  const node = el("div", { class: "spatial-geography-raster-wrap", children: [canvas] });
  return { node, ...(preview.map ? { map: preview.map } : {}), ...(preview.error ? { error: preview.error } : {}) };
}
