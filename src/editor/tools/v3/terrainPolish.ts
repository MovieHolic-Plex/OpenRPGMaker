// 지형 경계 다듬기 — 이미 깔려 있는 지형의 오토타일 변형을 다시 계산한다.
//
// 왜 필요한가(2026-07-26 브라우저 실측): 모래·흙길 같은 지형은 **저장 시점** 오토타일이다
// (물/호수만 렌더 시점 쿼터 합성). 그래서 각진 상태로 저장된 맵은 렌더가 고쳐주지 못하고,
// 실제 샘플 게임의 모래-잔디 경계가 계단식 직각으로 보인다. 새로 칠할 때는 fill_region 이
// resolveAutotile 을 부르지만, **이미 있는 맵을 다듬는 경로가 없었다.**
//
// 동작: 타일셋의 오토타일 그룹마다 "그 그룹의 멤버인 셀" 을 모아 resolveAutotile 로 마스크를
// 다시 계산한다. 멤버가 아닌 칸은 손대지 않으므로 잔디 바닥·소품·상층은 그대로다.

import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import type { AutotileGroup, GameMap, TilesetDef } from "@/project/types";
import { resolveAutotile, type AutotilePoint } from "./rmTypeExpander";

export interface TerrainPolishRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface TerrainPolishGroupResult {
  readonly groupId: string;
  readonly groupName: string;
  /** 이 그룹 멤버로 발견된 칸 수. */
  readonly memberCells: number;
  /** 변형이 실제로 바뀐 칸 수. */
  readonly changed: number;
}

export interface TerrainPolishResult {
  readonly changed: number;
  readonly scannedCells: number;
  /** 바뀐 그룹만, 변경량 내림차순. */
  readonly groups: readonly TerrainPolishGroupResult[];
}

/** rect 를 맵 안으로 자른다. 생략 시 맵 전체. */
function clampRect(map: GameMap, rect: TerrainPolishRect | undefined): TerrainPolishRect {
  if (!rect) return { x: 0, y: 0, w: map.width, h: map.height };
  const x = Math.max(0, Math.min(map.width - 1, Math.floor(rect.x)));
  const y = Math.max(0, Math.min(map.height - 1, Math.floor(rect.y)));
  return {
    x,
    y,
    w: Math.max(0, Math.min(map.width - x, Math.floor(rect.w))),
    h: Math.max(0, Math.min(map.height - y, Math.floor(rect.h))),
  };
}

/** rect 안에서 group 멤버 타일이 놓인 칸을 모은다. */
function memberCellsInRect(map: GameMap, group: AutotileGroup, rect: TerrainPolishRect): AutotilePoint[] {
  const members = new Set<number>(group.memberTileIds);
  const cells: AutotilePoint[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      if (members.has(map.lowerTiles[y * map.width + x]!)) cells.push({ x, y });
    }
  }
  return cells;
}

/**
 * 맵(또는 rect)의 지형 오토타일을 다시 계산한다. map.lowerTiles 를 제자리에서 수정한다.
 *
 * 주의: resolveAutotile 은 넘긴 칸의 **8-이웃 링까지** 재검사하므로 rect 경계 바로 밖의
 * 같은 지형 칸도 한 겹 다듬어진다. 경계에서 변형이 어긋나 보이는 것을 막으려면 이게 옳다.
 */
export function polishMapTerrain(
  map: GameMap,
  tileset: TilesetDef | undefined,
  rect?: TerrainPolishRect,
): TerrainPolishResult {
  const area = clampRect(map, rect);
  const results: TerrainPolishGroupResult[] = [];
  let changed = 0;
  if (area.w === 0 || area.h === 0) return { changed: 0, scannedCells: 0, groups: [] };
  for (const group of autotileGroupsForTileset(tileset)) {
    const cells = memberCellsInRect(map, group, area);
    if (cells.length === 0) continue;
    const groupChanged = resolveAutotile(group, cells, map);
    changed += groupChanged;
    if (groupChanged > 0) {
      results.push({
        groupId: group.id,
        groupName: group.name,
        memberCells: cells.length,
        changed: groupChanged,
      });
    }
  }
  results.sort((a, b) => b.changed - a.changed);
  return { changed, scannedCells: area.w * area.h, groups: results };
}

/** 사람이 읽는 한 줄 요약. 도구 summary 와 에디터 토스트가 공유한다. */
export function describeTerrainPolish(mapName: string, result: TerrainPolishResult): string {
  if (result.changed === 0) {
    return `${mapName} 지형 경계는 이미 정돈돼 있습니다 — 바꿀 칸이 없습니다(${result.scannedCells}칸 검사).`;
  }
  const detail = result.groups.map((g) => `${g.groupName} ${g.changed}칸`).join(", ");
  return `${mapName} 지형 경계 ${result.changed}칸 다듬음 (${detail}).`;
}
