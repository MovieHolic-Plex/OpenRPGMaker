// 「땅 칸」 붓 — 스타크래프트 편집기처럼 땅 종류 하나를 고르고 끌면 그 칸 높이를 정확히 맞춘다.
// 절벽면·윗면 풀은 기존 높이 렌더러·commitReliefEdit 가 그대로 만든다. 저장 형태는 「지형」 높이 붓과 같다
// (map.relief.levels · terrainDesign.waterDepth). 노이즈·자라기 없음 — 반듯한 고원과 호수를 끌기 한 번으로 깐다.

import { store } from "@/project/store";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { autotileEditTriggersGroup, shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { terrainLocked } from "@/project/terrainDesign";
import type { GameMap, MapId } from "@/project/types";
import { commitReliefEdit, reliefTopGrassTile } from "./reliefActions";
import { terrainMaterialTile } from "./terrainMaterials";

/** 땅 칸 — 숫자는 높이 단(1단 = 절벽 1칸), "water" 는 물. */
export type TerrainLand = 0 | 2 | 4 | "water";
export type TerrainLandSize = 1 | 3 | 5 | "rect";

export const TERRAIN_LANDS: readonly { readonly land: TerrainLand; readonly label: string; readonly key: string; readonly color: string }[] = [
  { land: "water", label: "물", key: "1", color: "#3f86c9" },
  { land: 0, label: "낮은 땅", key: "2", color: "#79ad55" },
  { land: 2, label: "높은 땅", key: "3", color: "#a7864f" },
  { land: 4, label: "더 높은 땅", key: "4", color: "#d9c48c" },
];
export const TERRAIN_LAND_SIZES: readonly TerrainLandSize[] = [1, 3, 5, "rect"];

export const terrainLandLabel = (land: TerrainLand): string => TERRAIN_LANDS.find((entry) => entry.land === land)?.label ?? String(land);

type Point = { readonly x: number; readonly y: number };

export function landBrushCells(map: Pick<GameMap, "width" | "height">, center: Point, size: 1 | 3 | 5): number[] {
  const out: number[] = [], r = (size - 1) / 2;
  for (let y = center.y - r; y <= center.y + r; y++) for (let x = center.x - r; x <= center.x + r; x++) {
    if (x >= 0 && y >= 0 && x < map.width && y < map.height) out.push(y * map.width + x);
  }
  return out;
}

export function landRectCells(map: Pick<GameMap, "width" | "height">, a: Point, b: Point): number[] {
  const out: number[] = [];
  const x0 = Math.max(0, Math.min(a.x, b.x)), x1 = Math.min(map.width - 1, Math.max(a.x, b.x));
  const y0 = Math.max(0, Math.min(a.y, b.y)), y1 = Math.min(map.height - 1, Math.max(a.y, b.y));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(y * map.width + x);
  return out;
}

/** 물 칸을 마른 땅으로 돌린다 — 물 타일은 풀로, 물 깊이는 0 으로. 바뀐 칸이 없으면 쓰지 않는다. */
function dryWaterCells(mapId: MapId, cells: readonly number[]): void {
  const project = store.getCurrent(), map = project.maps[mapId];
  if (!map) return;
  const tileset = project.tilesets[map.tilesetId];
  const water = terrainMaterialTile(tileset, "water"), grass = reliefTopGrassTile(tileset) ?? terrainMaterialTile(tileset, "grass");
  const wet = cells.filter((i) => !terrainLocked(map.terrainDesign, i) && ((map.terrainDesign?.waterDepth?.[i] ?? 0) > 0 || (water !== undefined && water >= 0 && waterGroupHas(map, i, water))));
  if (!wet.length) return;
  const previous = wet.map((i) => layerTileAt(map, 1, i));
  store.updateMapTiles(mapId, (draft) => {
    if (draft.terrainDesign?.waterDepth) {
      draft.terrainDesign = { ...draft.terrainDesign, waterDepth: draft.terrainDesign.waterDepth.slice() };
      for (const i of wet) draft.terrainDesign.waterDepth![i] = 0;
      if (!draft.terrainDesign.waterDepth!.some(Boolean)) delete draft.terrainDesign.waterDepth;
    }
    if (grass === undefined) return;
    for (const i of wet) { clearTileStack(draft, "lower", i); setLayerTileAt(draft, 1, i, grass); setLayerTileAt(draft, 2, i, -1); }
    const points = wet.map((i) => ({ x: i % draft.width, y: Math.floor(i / draft.width) }));
    for (const group of autotileGroupsForTileset(tileset)) if ((group.layer ?? "lower") === "lower" && previous.some((v) => autotileEditTriggersGroup(group, v, grass))) shapeAutotileGroupAround(draft, group, points);
  }, { label: "땅 칸 · 물 걷기", cells: neighbourhood(map, wet) });
}

function waterGroupHas(map: GameMap, index: number, waterTile: number): boolean {
  const tileset = store.getCurrent().tilesets[map.tilesetId];
  const tile = layerTileAt(map, 1, index);
  if (tile === waterTile) return true;
  return autotileGroupsForTileset(tileset).some((g) => g.memberTileIds.includes(waterTile) && g.memberTileIds.includes(tile));
}

function neighbourhood(map: Pick<GameMap, "width" | "height">, cells: readonly number[]): { x: number; y: number; layer: "lower" }[] {
  const dirty = new Map<number, { x: number; y: number; layer: "lower" }>();
  for (const i of cells) {
    const cx = i % map.width, cy = Math.floor(i / map.width);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && y >= 0 && x < map.width && y < map.height) dirty.set(y * map.width + x, { x, y, layer: "lower" });
    }
  }
  return [...dirty.values()];
}

/**
 * 물 칸: 물 타일을 깔고 바닥을 0단으로 내리고 물 깊이를 늘 기록한다(가장자리 1 = 얕은 물, 안쪽 2 이상 = 깊은 물).
 * 경사로·잠긴 칸은 건너뛴다.
 */
function paintWaterCells(mapId: MapId, cells: readonly number[], soften: boolean): boolean {
  const project = store.getCurrent(), map = project.maps[mapId];
  if (!map) return false;
  const tileset = project.tilesets[map.tilesetId];
  // 자연 호숫가 오토타일(풀·모래로 스며드는 물가, bake_lakeshore.py)이 있는 칩셋은 그것을 기본으로 — 운하 물은 돌 둑 가장자리다.
  const lakeshore = tileset ? autotileGroupsForTileset(tileset).find((g) => g.id === "beodeul_lakeshore_grass") : undefined;
  const tile = lakeshore ? lakeshore.variantMap["255"] : terrainMaterialTile(tileset, "water");
  if (tile === undefined || tile < 0) return false;
  const points = (soften ? softenShore(map, cells) : [...cells]).filter((i) => !terrainLocked(map.terrainDesign, i) && (map.relief?.ramps?.[i] ?? 0) === 0);
  if (!points.length) return false;
  const depthBefore = map.terrainDesign?.waterDepth;
  const wet = new Set<number>(points);
  for (let i = 0; i < map.width * map.height; i++) if ((depthBefore?.[i] ?? 0) > 0) wet.add(i);
  // 물 깊이: 마른 땅까지의 거리 — 물가 한 줄은 얕은 물(1), 그 안은 깊은 물(2..).
  const depth = new Array<number>(map.width * map.height).fill(0);
  const queue: number[] = [];
  for (const i of wet) {
    const x = i % map.width, y = Math.floor(i / map.width);
    const shore = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = x + dx!, Y = y + dy!; return X < 0 || Y < 0 || X >= map.width || Y >= map.height || !wet.has(Y * map.width + X); });
    if (shore) { depth[i] = 1; queue.push(i); }
  }
  for (let n = 0; n < queue.length; n++) {
    const i = queue[n]!, x = i % map.width, y = Math.floor(i / map.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const X = x + dx, Y = y + dy, j = Y * map.width + X;
      if (X < 0 || Y < 0 || X >= map.width || Y >= map.height || !wet.has(j) || depth[j]) continue;
      depth[j] = Math.min(14, depth[i]! + 1); queue.push(j);
    }
  }
  const unchanged = points.every((i) => layerTileAt(map, 1, i) === tile && layerTileAt(map, 2, i) < 0 && (map.relief?.levels[i] ?? 0) === 0)
    && depth.every((d, i) => (depthBefore?.[i] ?? 0) === d || terrainLocked(map.terrainDesign, i));
  if (unchanged) return false;
  const groups = autotileGroupsForTileset(tileset).filter((g) => (g.layer ?? "lower") === "lower");
  const waterGroup = lakeshore ?? groups.find((g) => g.memberTileIds.includes(tile));
  const previous = points.map((i) => layerTileAt(map, 1, i));
  const xy = points.map((i) => ({ x: i % map.width, y: Math.floor(i / map.width) }));
  store.updateMapTiles(mapId, (draft) => {
    for (const i of points) { clearTileStack(draft, "lower", i); setLayerTileAt(draft, 1, i, tile); setLayerTileAt(draft, 2, i, -1); }
    const nextDepth = depth.map((d, i) => (terrainLocked(map.terrainDesign, i) ? depthBefore?.[i] ?? 0 : d));
    draft.terrainDesign = { ...draft.terrainDesign, waterDepth: nextDepth };
    for (const group of groups) if (group !== waterGroup && previous.some((v) => autotileEditTriggersGroup(group, v, tile))) shapeAutotileGroupAround(draft, group, xy);
    // 물 자체도 가장자리 조각으로 — 강·운하 물 오토타일이 풀과 섞이는 물가 칸을 고른다(가운데는 꽉 찬 물 그대로).
    if (waterGroup) shapeAutotileGroupAround(draft, waterGroup, xy);
    if (draft.relief) {
      const levels = draft.relief.levels.slice(), ramps = draft.relief.ramps?.slice();
      for (const i of points) { levels[i] = 0; if (ramps) ramps[i] = 0; }
      draft.relief = { ...draft.relief, levels, ...(ramps ? { ramps } : {}) };
    }
  }, { label: "땅 칸 · 물", cells: neighbourhood(map, points), relief: true });
  return true;
}

/**
 * 호수 물가 다듬기: 사각형으로 끌어 깔 물의 네 모서리를 반지름 1~2칸(짧은 변 길이의 1/4)로 둥글게 깎는다.
 * 4×4 미만(붓 한 칸·가는 줄)은 그대로.
 */
export function softenShore(map: Pick<GameMap, "width" | "height">, cells: readonly number[]): number[] {
  const xs = cells.map((i) => i % map.width), ys = cells.map((i) => Math.floor(i / map.width));
  if (Math.max(...xs) - Math.min(...xs) < 3 || Math.max(...ys) - Math.min(...ys) < 3) return [...cells];
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const radius = Math.min(2, Math.floor((Math.min(x1 - x0, y1 - y0) + 1) / 4));
  return cells.filter((i) => {
    const x = i % map.width, y = Math.floor(i / map.width);
    const cx = x < x0 + radius ? x0 + radius : x > x1 - radius ? x1 - radius : x;
    const cy = y < y0 + radius ? y0 + radius : y > y1 - radius ? y1 - radius : y;
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius + 0.5;
  });
}

/** 땅 칸 한 번 — 고른 칸을 그 땅으로 정확히 맞춘다. 바뀐 것이 있으면 true. */
export function paintLandCells(mapId: MapId, cells: readonly number[], land: TerrainLand, topGrass: boolean, softenWater = false): boolean {
  if (!cells.length) return false;
  if (land === "water") return paintWaterCells(mapId, cells, softenWater);
  dryWaterCells(mapId, cells);
  const map = store.getCurrent().maps[mapId];
  if (!map) return false;
  return commitReliefEdit(mapId, (relief) => {
    let changed = false;
    for (const i of cells) {
      if ((relief.levels[i] ?? 0) === land) continue;
      relief.levels[i] = land;
      if (relief.ramps && relief.ramps[i]) relief.ramps[i] = 0;
      changed = true;
    }
    if (changed && relief.wallDecor) {
      const set = new Set(cells);
      relief.wallDecor = relief.wallDecor.filter((d) => !set.has(d.y * relief.width + d.x));
    }
    return changed;
  }, { topGrass, label: `땅 칸 · ${terrainLandLabel(land)}` });
}
