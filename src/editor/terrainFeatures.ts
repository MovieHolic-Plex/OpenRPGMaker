import type { GameMap, TilesetDef } from "@/project/types";
import type { TerrainFeature, TerrainStampCell } from "@/project/terrainDesign";
import { terrainLocked } from "@/project/terrainDesign";
import { cloneExtraLayers, layerTileAt, setLayerTileAt, shadowAt, setShadowAt, compactMapLayers } from "@/project/mapLayers";
import { emptyRelief } from "@/project/relief/edit";
import { genId } from "@/util/id";
import { planTerrainDesign, type TerrainDesignOptions, type TerrainDesignPlan } from "./terrainDesignPlans";
import type { TerrainPoint } from "./terrainDesignGeometry";

export function terrainFeatureCell(map: GameMap, index: number): TerrainStampCell {
  return { layers: [1, 2, 3, 4].map(l => layerTileAt(map, l as 1 | 2 | 3 | 4, index)) as TerrainStampCell["layers"], shadow: shadowAt(map, index), level: map.relief?.levels[index] ?? 0, ramp: map.relief?.ramps?.[index] ?? 0, depth: map.terrainDesign?.waterDepth?.[index] ?? 0 };
}
const same = (a: TerrainStampCell, b: TerrainStampCell) => a.layers.every((t, n) => t === b.layers[n]) && a.shadow === b.shadow && a.level === b.level && a.ramp === b.ramp && a.depth === b.depth;
function put(map: GameMap, i: number, c: TerrainStampCell): void {
  c.layers.forEach((t, n) => setLayerTileAt(map, (n + 1) as 1 | 2 | 3 | 4, i, t)); setShadowAt(map, i, c.shadow);
  map.relief ??= emptyRelief(map.width, map.height); map.relief.levels[i] = c.level;
  map.relief.ramps ??= new Array<number>(map.width * map.height).fill(0); map.relief.ramps[i] = c.ramp;
  map.terrainDesign ??= {}; map.terrainDesign.waterDepth ??= new Array<number>(map.width * map.height).fill(0); map.terrainDesign.waterDepth[i] = c.depth;
}
export function planTerrainFeature(map: GameMap, tileset: TilesetDef, tool: TerrainFeature["tool"], points: TerrainPoint[], options: TerrainDesignOptions, editId: string | null): TerrainDesignPlan {
  const old = editId ? map.terrainDesign?.features?.find(f => f.id === editId) : undefined;
  if (editId && !old) return { ok: false, reason: "편집할 지형이 없어졌습니다. 목록에서 다시 고르세요", indices: [] };
  const base: GameMap = { ...map, lowerTiles: map.lowerTiles.slice(), upperTiles: map.upperTiles.slice(), ...cloneExtraLayers(map) };
  if (old) {
    if (old.patches.some(p => terrainLocked(map.terrainDesign, p.index) || !same(terrainFeatureCell(map, p.index), p.after))) return { ok: false, reason: "이 지형 위에 다른 편집이나 잠금이 있습니다. 해당 편집을 되돌리거나 잠금을 해제한 뒤 재편집하세요", indices: [] };
    for (const patch of old.patches) put(base, patch.index, patch.before);
  }
  const outline = options.areaShape === "rect" && (tool === "contour" || tool === "lake") && points.length === 2 ? [points[0]!, { x: points[1]!.x, y: points[0]!.y }, points[1]!, { x: points[0]!.x, y: points[1]!.y }] : points;
  const plan = planTerrainDesign(base, tileset, tool, outline, options);
  if (!plan.ok || !plan.apply) return plan;
  const next: GameMap = { ...base, lowerTiles: base.lowerTiles.slice(), upperTiles: base.upperTiles.slice(), ...cloneExtraLayers(base) }; plan.apply(next);
  const patches: TerrainFeature["patches"] = [];
  for (let index = 0; index < map.width * map.height; index++) {
    const before = terrainFeatureCell(base, index), after = terrainFeatureCell(next, index);
    if (!same(before, after)) patches.push({ index, before, after });
  }
  const feature: TerrainFeature = { id: old?.id ?? genId("terrain"), tool, points: structuredClone(points), options: structuredClone(options), patches };
  next.terrainDesign ??= {};
  next.terrainDesign.features = [...(map.terrainDesign?.features ?? []).filter(f => f.id !== old?.id), feature];
  const indices = [...new Set([...plan.indices, ...(old?.patches.map(p => p.index) ?? [])])];
  return { ...plan, indices, apply: draft => {
    for (const i of indices) put(draft, i, terrainFeatureCell(next, i));
    draft.terrainDesign = next.terrainDesign;
    compactMapLayers(draft);
  } };
}
