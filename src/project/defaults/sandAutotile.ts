import type { GameMap } from "../types";
import { autotileNeighborMask, autotileVariantForMask, shapeAutotileGroupAround } from "./autotileEngine";
import { DEFAULT_SAND_AUTOTILE_GROUP } from "./autotileGroups";
import { CHIPSET_TILE_GROUPS } from "./chipsetMapping";

// 모래 지형 셰이핑 — 내장 오토타일 그룹(builtin_sand)에 위임한다.
// 8방향 판정: 볼록 9-슬라이스 + 외딴 점(363) + 오목 코너(365)까지 자동 성형.

type Point = {
  readonly x: number;
  readonly y: number;
};

const SAND_SURFACE_TILE_SET = new Set<number>(CHIPSET_TILE_GROUPS.sandGround);
const SAND_CONNECT_TILE_SET = new Set<number>(
  DEFAULT_SAND_AUTOTILE_GROUP.connectTileIds ?? DEFAULT_SAND_AUTOTILE_GROUP.memberTileIds
);

export function isSandTile(tile: number): boolean {
  return SAND_SURFACE_TILE_SET.has(tile);
}

export function shapeSandEdges(map: GameMap): void {
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = map.lowerTiles[y * map.width + x];
      if (!SAND_SURFACE_TILE_SET.has(tile)) continue;
      const mask = autotileNeighborMask(map, x, y, (t) => SAND_CONNECT_TILE_SET.has(t), DEFAULT_SAND_AUTOTILE_GROUP.neighborhood ?? 4);
      const variant = autotileVariantForMask(DEFAULT_SAND_AUTOTILE_GROUP, mask);
      if (typeof variant === "number") map.lowerTiles[y * map.width + x] = variant;
    }
  }
}

export function shapeSandAround(map: GameMap, points: readonly Point[]): void {
  shapeAutotileGroupAround(map, DEFAULT_SAND_AUTOTILE_GROUP, points);
}
