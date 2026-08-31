// 나무 밑동 위에 수관(upper)이 반드시 있도록 보정한다.
// 숲 규칙: 수관 = upper @ (x,y-1), 밑동 = lower @ (x,y) [레거시: 밑동 upper 도 허용].
// 쓰기 툴/붓질 후 post-hook 에서 호출.

import { TILE } from "@/project/defaults/constants";
import { isTreeTrunkTileId, TREE_CANOPY_TILE_IDS } from "@/project/tilesetHarness";
import type { GameMap, Project } from "@/project/types";

/** 밑동 타일 → 바로 위 칸에 와야 할 수관(upper) 타일. */
const TRUNK_TO_CANOPY: Readonly<Record<number, number>> = {
  290: 260, // 침엽
  291: 261, // 마른
  292: 262, // 활엽 좌
  293: 263, // 활엽 우
};

export type TreePairRepairResult = {
  readonly canopiesPlaced: number;
  readonly orphanTrunksRemoved: number;
};

export function repairTreePairsOnProject(project: Project): TreePairRepairResult {
  let canopiesPlaced = 0;
  let orphanTrunksRemoved = 0;
  for (const map of Object.values(project.maps)) {
    const result = repairTreePairsOnMap(map);
    canopiesPlaced += result.canopiesPlaced;
    orphanTrunksRemoved += result.orphanTrunksRemoved;
  }
  return { canopiesPlaced, orphanTrunksRemoved };
}

/**
 * 맵 전역: 모든 나무 밑동에 대해 위 칸 upper 수관을 보장.
 * - y=0 밑동(위 칸 없음) → 밑동 제거
 * - 위 칸 upper 가 짝 수관이 아니면 짝 수관으로 기록
 */
export function repairTreePairsOnMap(map: GameMap): TreePairRepairResult {
  let canopiesPlaced = 0;
  let orphanTrunksRemoved = 0;

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const index = y * map.width + x;
      const lower = map.lowerTiles[index];
      const upper = map.upperTiles[index];

      const trunkTile = isTreeTrunkTileId(lower)
        ? lower
        : isTreeTrunkTileId(upper)
          ? upper
          : null;
      if (trunkTile === null) continue;

      const canopy = TRUNK_TO_CANOPY[trunkTile];
      if (canopy === undefined) continue;

      if (y === 0) {
        // 맵 맨 위 줄 밑동은 수관을 둘 칸이 없음 → 제거
        if (isTreeTrunkTileId(lower)) map.lowerTiles[index] = TILE.GRASS;
        if (isTreeTrunkTileId(upper)) map.upperTiles[index] = TILE.EMPTY;
        orphanTrunksRemoved += 1;
        continue;
      }

      const aboveIndex = (y - 1) * map.width + x;
      const aboveUpper = map.upperTiles[aboveIndex] ?? TILE.EMPTY;
      // 위 칸에 이미 다른 저작 오버레이(덤불·소품)가 있으면 건드리지 않는다. 수관을 덮어쓰면
      // impassable 숲이 다시 뚫린다 — 수관 타일은 4방향 통행 가능이라(주인공이 나무 뒤로 지나가는
      // 관례) 그 칸을 막는 유일한 방법이 상위 레이어의 막는 칩이고, 상위는 칸당 하나뿐이다.
      // 나무는 밑동만 보이고 머리에 덤불이 서 있는 모습이 되지만, 그게 저작 의도다.
      if (aboveUpper !== TILE.EMPTY && aboveUpper !== canopy && !TREE_CANOPY_TILE_IDS.has(aboveUpper)) continue;
      if (aboveUpper !== canopy) {
        map.upperTiles[aboveIndex] = canopy;
        // 수관 아래가 완전 비면 잔디 받침(투명 수관 검정 방지). 밑동이면 유지.
        const aboveLower = map.lowerTiles[aboveIndex];
        if (aboveLower === TILE.EMPTY || aboveLower < 0) {
          map.lowerTiles[aboveIndex] = TILE.GRASS;
        }
        canopiesPlaced += 1;
      }
    }
  }

  return { canopiesPlaced, orphanTrunksRemoved };
}

export function formatTreePairRepairSummary(result: TreePairRepairResult): string | null {
  if (result.canopiesPlaced === 0 && result.orphanTrunksRemoved === 0) return null;
  const parts: string[] = [];
  if (result.canopiesPlaced > 0) parts.push(`수관 보완 ${result.canopiesPlaced}칸`);
  if (result.orphanTrunksRemoved > 0) parts.push(`고아 밑동 제거 ${result.orphanTrunksRemoved}칸`);
  return `나무 상·하 보정: ${parts.join(", ")}`;
}
