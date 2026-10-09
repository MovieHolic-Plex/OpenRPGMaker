import type { GameMap } from "../types";
import { shapeAutotileGroupAround } from "./autotileEngine";
import { DEFAULT_COBBLE_AUTOTILE_GROUP, DEFAULT_FARMLAND_AUTOTILE_GROUP } from "./autotileGroups";

// 포석(129 블록)·경작지(126 블록) 셰이핑 — 내장 오토타일 그룹에 위임 (sandAutotile.ts 동형).

type Point = {
  readonly x: number;
  readonly y: number;
};

const COBBLE_SURFACE_TILE_SET = new Set<number>(DEFAULT_COBBLE_AUTOTILE_GROUP.memberTileIds);
const FARMLAND_SURFACE_TILE_SET = new Set<number>(DEFAULT_FARMLAND_AUTOTILE_GROUP.memberTileIds);

export function isCobbleTile(tile: number): boolean {
  return COBBLE_SURFACE_TILE_SET.has(tile);
}

export function isFarmlandTile(tile: number): boolean {
  return FARMLAND_SURFACE_TILE_SET.has(tile);
}

export function shapeCobbleAround(map: GameMap, points: readonly Point[]): void {
  shapeAutotileGroupAround(map, DEFAULT_COBBLE_AUTOTILE_GROUP, points);
}

export function shapeFarmlandAround(map: GameMap, points: readonly Point[]): void {
  shapeAutotileGroupAround(map, DEFAULT_FARMLAND_AUTOTILE_GROUP, points);
}
