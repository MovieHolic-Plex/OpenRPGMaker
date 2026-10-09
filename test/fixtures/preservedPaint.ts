import type { BuildSpec } from "@/ai/buildSpec";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import type { ToolContext } from "@/editor/tools/types";

// P7's exact native paint geometry; no live content or saved evidence is loaded.
export const PRESERVED_PAINT_SPEC: BuildSpec = {
  mapId: "map_basement",
  assets: [
    { id: "basement_floor_342", kind: "terrain", x: 1, y: 1, w: 10, h: 8, layer: "lower", overExisting: "clear" },
    { id: "basement_wall_top_306", kind: "terrain", x: 0, y: 0, w: 12, h: 1, layer: "lower", overExisting: "clear" },
    { id: "basement_wall_bottom_306", kind: "terrain", x: 0, y: 9, w: 12, h: 1, layer: "lower", overExisting: "clear" },
  ],
};
export const PRESERVED_WALL_CELLS = [0, 9].flatMap(y => Array.from({ length: 12 }, (_, x) => ({ x, y })));
export const FLOOR_PAINT_ARGS = {
  mapId: "map_basement", mode: "cells", layer: "lower", tile: 342,
  from: { x: 1, y: 1 }, to: { x: 10, y: 8 },
  cells: Array.from({ length: 8 }, (_, row) => Array.from({ length: 10 }, (_, col) => ({ x: col + 1, y: row + 1 }))).flat(),
};
export const WALL_PAINT_ARGS = {
  mapId: "map_basement", mode: "cells", layer: "lower", tile: 306,
  from: { x: 0, y: 0 }, to: { x: 11, y: 9 }, cells: PRESERVED_WALL_CELLS,
};

export function nativePaintCall(ctx: ToolContext, args: Record<string, unknown>) {
  const result = runTool(ctx, "paint_tiles", args);
  return { name: "paint_tiles", args, result, summary: result.summary };
}

export function preservedPaintContext(): ToolContext {
  const ctx = { project: createBlankProject() };
  const created = runTool(ctx, "create_map", { id: "map_basement", name: "P7 accounting", width: 12, height: 10 });
  if (!created.ok) throw new Error(created.summary);
  const map = ctx.project.maps.map_basement;
  map.lowerTiles.fill(112);
  map.upperTiles.fill(-1);
  for (const { x, y } of PRESERVED_WALL_CELLS) map.lowerTiles[y * map.width + x] = 306;
  // P7 temporarily disables wall reshaping through this native override.
  const group = runTool(ctx, "upsert_autotile_group", { tilesetId: map.tilesetId, group: {
    id: "builtin_stone_court", name: "P7 wall maintenance", neighborhood: 8,
    memberTileIds: [306], connectTileIds: [306], variantMap: { "0": 306 },
  } });
  if (!group.ok) throw new Error(group.summary);
  return ctx;
}
