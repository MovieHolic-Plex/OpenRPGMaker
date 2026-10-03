// 「높이」 붓의 쓰기 경로 — 높이(map.relief)와 「윗면 풀」(1·2층 칸)을 한 번의 updateMapTiles 로 고친다.
// 붓 수식은 @/project/relief(edit.ts 정밀 붓 · roughBrush.ts 러프 붓)에 있고, 여기는 store 에 쓰는 일만 한다.

import { store, type ProjectChangeCell } from "@/project/store";
import { TILE } from "@/project/defaults";
import { plainGrassTileFor } from "@/project/defaults/defaultMaps";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { emptyRelief, reliefIsFlat, type ReliefBrushMode } from "@/project/relief/edit";
import { roughReliefStroke, tidyReliefRegion, type ReliefRoughOptions } from "@/project/relief/roughBrush";
import { RELIEF_STYLES } from "@/project/relief/styles";
import type { ReliefData } from "@/project/relief/types";
import { isCombinedTownCompatibleTileset } from "@/project/tilesetHarness";
import type { MapId, TilesetDef } from "@/project/types";
import { terrainLocked } from "@/project/terrainDesign";

/**
 * 「윗면 풀」로 덮기 전의 1·2층 칸. 0단으로 되돌아오면 이것으로 돌린다 — 길 위에 실수로 올린 언덕을 내리면 길이 돌아온다.
 * 세션 메모리다(저장하지 않는다). 되돌리기(Ctrl+Z)는 맵 스냅숏이 따로 맡는다.
 */
const coveredGround = new Map<MapId, Map<number, readonly [number, number]>>();
store.subscribe((_project, change) => {
  if (change.projectSwitch) coveredGround.clear();
});

/** 칩셋의 기본 풀 — 새 빈 맵을 채우는 타일과 같다(mapTools.ts 새 맵과 같은 규칙). 모르면 undefined(풀로 덮지 않는다). */
export function reliefTopGrassTile(tileset: TilesetDef | undefined): number | undefined {
  if (!tileset) return undefined;
  return plainGrassTileFor(tileset.id) ?? (isCombinedTownCompatibleTileset(tileset) ? TILE.GRASS : undefined);
}

/**
 * relief 를 고치는 편집 하나를 store 에 쓴다. edit 가 false 면 아무것도 쓰지 않는다.
 * topGrass 면 0단에서 올라온 칸의 1층을 기본 풀로 덮고(2층 덧그림은 걷는다), 0단으로 내려온 칸은 덮기 전 타일로 돌린다.
 * 높이만 바뀌면 `relief: true` 만, 칸이 바뀌면 그 칸도 같이 알린다 — 편집기가 그 칸 타일과 절벽을 함께 다시 그린다.
 */
export function commitReliefEdit(
  mapId: MapId,
  edit: (relief: ReliefData) => boolean,
  options: { readonly topGrass: boolean; readonly label: string },
): boolean {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map) return false;
  const next: ReliefData = map.relief ? { ...map.relief, levels: map.relief.levels.slice() } : emptyRelief(map.width, map.height);
  const before = map.relief?.levels;
  if (!edit(next)) return false;
  for (const index of map.terrainDesign?.lockedCells ?? []) next.levels[index] = before?.[index] ?? 0;
  const grass = options.topGrass ? reliefTopGrassTile(project.tilesets[map.tilesetId]) : undefined;
  let memory = coveredGround.get(mapId);
  const tileEdits: { readonly index: number; readonly ground: number; readonly overlay: number }[] = [];
  for (let index = 0; index < next.levels.length; index++) {
    if (terrainLocked(map.terrainDesign, index)) continue;
    const was = before?.[index] ?? 0, now = next.levels[index] ?? 0;
    if (was === 0 && now > 0 && grass !== undefined) {
      const ground = layerTileAt(map, 1, index), overlay = layerTileAt(map, 2, index);
      if (ground === grass && overlay < 0) {
        memory?.delete(index);
        continue;
      }
      if (!memory) coveredGround.set(mapId, memory = new Map());
      // undo 후 바닥을 다시 칠했으면 이번 스트로크 직전 타일이 복원 대상이다.
      memory.set(index, [ground, overlay]);
      tileEdits.push({ index, ground: grass, overlay: -1 });
    } else if (was > 0 && now === 0 && memory?.has(index)
      && layerTileAt(map,1,index)===reliefTopGrassTile(project.tilesets[map.tilesetId]) && layerTileAt(map,2,index)<0) {
      const [ground, overlay] = memory.get(index)!;
      // 내리기를 undo하면 풀 윗면이 돌아온다. 다시 내려도 원래 바닥을 복원하도록
      // 기록은 다음 0→양수 덮기나 프로젝트 전환까지 보관한다.
      tileEdits.push({ index, ground, overlay });
    }
  }
  const cells: ProjectChangeCell[] = tileEdits.map(({ index }) => ({ x: index % map.width, y: Math.floor(index / map.width), layer: "lower" as const }));
  store.updateMapTiles(mapId, (draft) => {
    if (reliefIsFlat(next)) delete draft.relief;
    else draft.relief = next;
    for (const { index, ground, overlay } of tileEdits) {
      setLayerTileAt(draft, 1, index, ground);
      if (layerTileAt(draft, 2, index) !== overlay) setLayerTileAt(draft, 2, index, overlay);
    }
  }, { label: options.label, relief: true, ...(cells.length > 0 ? { cells } : {}) });
  return true;
}

/** 러프 붓 한 번(1차 스케치용 큰 덩이·계단 비탈) — 수식은 roughBrush.ts. */
export function paintRoughRelief(
  mapId: MapId,
  x: number,
  y: number,
  mode: ReliefBrushMode,
  options: ReliefRoughOptions & { readonly topGrass: boolean },
): boolean {
  const map = store.getCurrent().maps[mapId];
  if (!map || x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return commitReliefEdit(mapId, (relief) => roughReliefStroke(relief, x, y, mode, options), { topGrass: options.topGrass, label: "높이 붓" });
}

/** 러프 붓을 뗄 때 — 스트로크가 지나간 사각형 안의 작은 섬·구멍과 1칸 폭 돌기를 정리한다. */
export function tidyReliefStroke(mapId: MapId, box: { x0: number; y0: number; x1: number; y1: number }, topGrass: boolean): boolean {
  return commitReliefEdit(mapId, (relief) => tidyReliefRegion(relief, box), { topGrass, label: "높이 붓 정리" });
}

/** 절벽 양식(relief.style). null 이면 기본 흙벽. 높이가 하나도 없으면 쓸 곳이 없으므로 false. */
export function setReliefStyle(mapId: MapId, style: string | null): boolean {
  const map = store.getCurrent().maps[mapId];
  if (!map?.relief || reliefIsFlat(map.relief)) return false;
  if (style !== null && !RELIEF_STYLES[style]) return false;
  if ((map.relief.style ?? null) === style) return false;
  const relief = map.relief;
  store.updateMapTiles(mapId, (draft) => {
    const next: ReliefData = { ...relief };
    if (style === null) delete next.style;
    else next.style = style;
    draft.relief = next;
  }, { label: "절벽 양식", relief: true });
  return true;
}
