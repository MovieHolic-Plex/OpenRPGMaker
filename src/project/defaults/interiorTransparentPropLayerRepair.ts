import { appendTileToStack, tileStackAt } from "@/project/mapOverlayTiles";
import { INTERIOR_HARNESS_PREFIX } from "@/project/tilesetHarness";
import type { GameMap, TilesetDef } from "../types";

export function repairInteriorTransparentPropLayers(project: { readonly maps: Record<string, GameMap>; readonly tilesets: Record<string, TilesetDef> }): boolean {
  let changed = false;
  for (const map of Object.values(project.maps)) {
    const tileset = project.tilesets[map.tilesetId];
    const transparentProps = interiorTransparentPropTiles(tileset);
    if (transparentProps.size === 0) continue;
    for (let index = 0; index < map.lowerTiles.length; index++) {
      const tile = map.lowerTiles[index];
      if (!transparentProps.has(tile)) continue;
      placeUpperTransparentProp(map, index, tile);
      map.lowerTiles[index] = replacementInteriorFloor(map, index, transparentProps);
      changed = true;
    }
  }
  return changed;
}

function interiorTransparentPropTiles(tileset: TilesetDef | undefined): ReadonlySet<number> {
  const group = tileset?.tileGroups?.find((candidate) => candidate.id === `${INTERIOR_HARNESS_PREFIX}transparent-props`);
  return new Set(group?.tileIds ?? []);
}

function placeUpperTransparentProp(map: GameMap, index: number, tile: number): void {
  if (map.upperTiles[index] === tile || tileStackAt(map, "upper", index).includes(tile)) return;
  if (map.upperTiles[index] === undefined || map.upperTiles[index] < 0) {
    map.upperTiles[index] = tile;
    return;
  }
  appendTileToStack(map, "upper", index, tile);
}

function replacementInteriorFloor(map: GameMap, index: number, transparentProps: ReadonlySet<number>): number {
  for (const neighbor of neighboringTileIndexes(map, index)) {
    const tile = map.lowerTiles[neighbor];
    if (tile >= 0 && !transparentProps.has(tile)) return tile;
  }
  // 이웃이 전부 소품이면 실내 기본 나무 바닥(72)으로 복구한다 — 270은 현재 칩셋에서 잔디.
  return 72;
}

function neighboringTileIndexes(map: GameMap, index: number): readonly number[] {
  const x = index % map.width;
  const y = Math.floor(index / map.width);
  const neighbors: number[] = [];
  if (x > 0) neighbors.push(index - 1);
  if (x < map.width - 1) neighbors.push(index + 1);
  if (y > 0) neighbors.push(index - map.width);
  if (y < map.height - 1) neighbors.push(index + map.width);
  return neighbors;
}
