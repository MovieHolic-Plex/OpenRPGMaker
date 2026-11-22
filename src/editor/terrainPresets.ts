// 「한 번에」 프리셋 붓 — 처음 쓰는 사람이 맵을 한 번 눌러 언덕 하나·강 하나·오솔길을 얻는다.
// 그리는 길은 사람 붓과 같다(paintLandCells·planReliefDoodad·paintTerrainBrush). 새 저장 형태는 없다.
// 칸 계산은 순수 함수로 두어 커서 미리보기(editSceneHoverPreview)와 실제 적용이 같은 칸을 쓴다.

import { store } from "@/project/store";
import type { GameMap, MapId } from "@/project/types";
import { planReliefDoodad, reliefDoodadCatalog } from "./reliefDoodads";
import { paintLandCells } from "./terrainLandBrush";
import { paintTerrainBrush } from "./terrainBrush";
import { terrainMaterialTile } from "./terrainMaterials";

export type TerrainPreset = "hill" | "river" | "path";

export const TERRAIN_PRESETS: readonly { readonly id: TerrainPreset; readonly label: string; readonly help: string }[] = [
  { id: "hill", label: "언덕 하나", help: "누른 곳에 7×5 언덕과 남쪽 경사로" },
  { id: "river", label: "강 하나", help: "누른 칸을 지나 위에서 아래까지 굽이치는 강" },
  { id: "path", label: "오솔길", help: "누른 줄을 따라 왼쪽 끝에서 오른쪽 끝까지 흙길" },
];

type Point = { readonly x: number; readonly y: number };
type Size = Pick<GameMap, "width" | "height">;

const inside = (map: Size, x: number, y: number): boolean => x >= 0 && y >= 0 && x < map.width && y < map.height;

/** 언덕: 누른 칸을 가운데로 7×5, 네 귀퉁이 한 칸을 깎아 둥글게. 맵 밖은 자른다. */
export function hillPresetCells(map: Size, at: Point): number[] {
  const out: number[] = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) {
    if (Math.abs(dx) === 3 && Math.abs(dy) === 2) continue;
    const x = at.x + dx, y = at.y + dy;
    if (inside(map, x, y)) out.push(y * map.width + x);
  }
  return out;
}

/** 강: 맵 위 끝에서 아래 끝까지 폭 2칸(다리 한 칸 길이와 같아 그대로 다리를 놓을 수 있다), 누른 칸을 지나며 완만하게 굽는다. */
export function riverPresetCells(map: Size, at: Point): number[] {
  const out: number[] = [];
  for (let y = 0; y < map.height; y++) {
    const cx = at.x + Math.round(Math.sin((y - at.y) / 3));
    for (let x = cx; x <= cx + 1; x++) if (inside(map, x, y)) out.push(y * map.width + x);
  }
  return out;
}

/** 오솔길: 맵 왼쪽 끝에서 오른쪽 끝까지 폭 1칸, 누른 줄을 지나며 살짝 흔들린다. */
export function pathPresetPoints(map: Size, at: Point): Point[] {
  const out: Point[] = [];
  let previous: number | null = null;
  for (let x = 0; x < map.width; x++) {
    const y = at.y + Math.round(Math.sin((x - at.x) / 4) * 0.8);
    if (previous !== null && previous !== y && inside(map, x, previous)) out.push({ x, y: previous });
    if (inside(map, x, y)) out.push({ x, y });
    previous = y;
  }
  return out;
}

export function presetCells(map: Size, preset: TerrainPreset, at: Point): number[] {
  if (preset === "hill") return hillPresetCells(map, at);
  if (preset === "river") return riverPresetCells(map, at);
  return pathPresetPoints(map, at).map((p) => p.y * map.width + p.x);
}

/**
 * 프리셋 하나를 맵에 깐다. 바뀐 것이 있으면 true.
 * 언덕은 남쪽 발치(맵 끝이면 북쪽)에 폭 2 경사로를 붙여 처음부터 걸어 오를 수 있게 한다.
 */
export function applyTerrainPreset(mapId: MapId, preset: TerrainPreset, at: Point, topGrass: boolean): boolean {
  const map = store.getCurrent().maps[mapId];
  if (!map || !inside(map, at.x, at.y)) return false;
  if (preset === "river") return paintLandCells(mapId, riverPresetCells(map, at), "water", topGrass, false);
  if (preset === "path") {
    const tileset = store.getCurrent().tilesets[map.tilesetId];
    const material = (terrainMaterialTile(tileset, "dirt") ?? -1) >= 0 ? "dirt" : "stone";
    if ((terrainMaterialTile(tileset, material) ?? -1) < 0) return false;
    const wet = map.terrainDesign?.waterDepth;
    for (const p of pathPresetPoints(map, at)) if (!((wet?.[p.y * map.width + p.x] ?? 0) > 0)) paintTerrainBrush(mapId, p.x, p.y, material, 1, map.relief?.levels[p.y * map.width + p.x] ?? 0);
    return true;
  }
  const changed = paintLandCells(mapId, hillPresetCells(map, at), 2, topGrass);
  const after = store.getCurrent().maps[mapId];
  const tileset = after ? store.getCurrent().tilesets[after.tilesetId] : undefined;
  const catalog = reliefDoodadCatalog(tileset);
  const ramp = catalog.find((d) => d.kind === "ramp" && !d.stairs) ?? catalog.find((d) => d.kind === "ramp");
  if (!after || !ramp) return changed;
  for (const foot of [{ x: at.x, y: at.y + 3 }, { x: at.x, y: at.y - 3 }]) {
    if (!inside(after, foot.x, foot.y)) continue;
    const plan = planReliefDoodad(after, ramp, { ...foot, face: "top" }, { width: 2 });
    if (!plan.ok || !plan.apply) continue;
    store.updateMapTiles(mapId, plan.apply, { label: "한 번에 · 언덕 경사로", relief: true, cells: plan.cells });
    break;
  }
  return changed;
}
