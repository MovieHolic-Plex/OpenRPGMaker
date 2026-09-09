// 나무 밑동 위에 수관(upper)이 반드시 있도록 보정한다.
// 숲 규칙: 수관 = upper @ (x,y-1), 밑동 = lower @ (x,y) [레거시: 밑동 upper 도 허용].
// 쓰기 툴/붓질 후 post-hook 에서 호출.

import { TILE } from "@/project/defaults/constants";
import { isCombinedTownTileset, isTreeTrunkTileId } from "@/project/tilesetHarness";
import type { GameMap, Project, TilesetDef } from "@/project/types";

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

export type TreePairRepairOptions = {
  /** 숲 합성이 통행 경로를 닫으려고 밑동 위에 놓은 상위 타일만 수관 보정에서 보존한다. */
  readonly canopyReplacementExemptTileIds?: ReadonlySet<number>;
};

export function repairTreePairsOnProject(
  project: Project,
  options: TreePairRepairOptions = {},
): TreePairRepairResult {
  let canopiesPlaced = 0;
  let orphanTrunksRemoved = 0;
  for (const map of Object.values(project.maps)) {
    const result = repairTreePairsOnMap(map, project.tilesets[map.tilesetId], options);
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
export function repairTreePairsOnMap(
  map: GameMap,
  tileset: Pick<TilesetDef, "image"> | undefined,
  options: TreePairRepairOptions = {},
): TreePairRepairResult {
  // Numeric trunk/canopy IDs belong to the exact bundled Town image only.
  if (!tileset || !isCombinedTownTileset(tileset)) return { canopiesPlaced: 0, orphanTrunksRemoved: 0 };
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
      // 왜 모든 비수관 오버레이를 예외로 두면 안 되는가(실측): 나무 상자 237도 보정을 막아
      // 맨 밑동 위에 상자가 떠 있는 채 post-write hook 을 통과했다. 숲 합성이 경로를 닫으려고
      // 실제로 쓴 blocking-bush id만 호출자가 명시하며, 일반 가구·상자·장식은 수관으로 보정한다.
      if (options.canopyReplacementExemptTileIds?.has(aboveUpper)) continue;
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
