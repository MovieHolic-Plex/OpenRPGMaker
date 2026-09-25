// 팩 프리셋 타일셋 위에 재료 이름·물체 id 로 칠하고 찍는 도우미 — 예시 블록과 마을 짜임(townLayout)이 같이 쓴다.
// 결과는 fill_region·stamp_tileset_object 와 같게 맞춘다(둘레 오토타일 모양, 차양 그늘 아래 문, 창 없는 벽 짝).

import type { TilesetDef } from "../types";
import { shapeAllAutotileGroupsAround } from "../defaults/autotileEngine";

export interface PackPaintMap {
  readonly width: number;
  readonly height: number;
  readonly lowerTiles: number[];
  readonly upperTiles: number[];
}

/** 이름으로 오토타일 그룹을 찾아 사각형을 칠하고 모양을 맞춘다(fill_region 과 같은 결과). */
export function paintAuto(tileset: TilesetDef, map: PackPaintMap, name: string, x: number, y: number, w: number, h: number): void {
  const group = tileset.autotileGroups?.find((entry) => entry.name === name);
  if (!group) throw new Error(`예시 재료 없음: ${name}`);
  const layer = group.layer === "upper" ? map.upperTiles : map.lowerTiles;
  const body = group.memberTileIds[0]!;
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) layer[yy * map.width + xx] = body;
  // fill_region 과 같게 둘레의 다른 재료도 맞춘다(보도 끝 연석·흙 가장자리가 여기서 생긴다).
  const points: { x: number; y: number }[] = [];
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) points.push({ x: xx, y: yy });
  shapeAllAutotileGroupsAround(map, tileset.autotileGroups ?? [], points);
}

export function stampKit(tileset: TilesetDef, map: PackPaintMap, id: string, x: number, y: number, options: { keepDoors?: boolean } = {}): void {
  const kit = tileset.structureKits?.find((entry) => entry.id === id);
  if (!kit) return;
  const lastRow = kit.rows.length - 1;
  const onWall = kit.ai?.tags?.some((tag) => tag === "door" || tag === "wallmount" || tag === "overhead") === true;
  kit.rows.forEach((row, dy) => row.upperTiles?.forEach((tile, dx) => {
    if (tile < 0 || x + dx >= map.width || y + dy >= map.height) return;
    const index = (y + dy) * map.width + x + dx;
    // stamp_tileset_object 와 같게: 차양 그늘 줄은 이미 있는 문을 덮지 않는다.
    if (options.keepDoors && dy === lastRow && map.upperTiles[index]! >= 0) return;
    // stamp_tileset_object 와 같게: 벽 물체 밑의 창 난 벽돌은 창 없는 짝으로.
    const plain = onWall ? tileset.mvPack?.plainWalls?.[String(map.lowerTiles[index])] : undefined;
    if (plain !== undefined) map.lowerTiles[index] = plain;
    map.upperTiles[index] = tile;
  }));
}

/** 평타일(A5) 이름으로 사각형을 칠한다 — 오토타일이 아니라 모양 맞춤이 없다. */
export function paintFlat(tileset: TilesetDef, map: PackPaintMap, name: string, x: number, y: number, w: number, h: number): void {
  const group = tileset.tileGroups?.find((entry) => entry.name === name && entry.tileIds.length === 1);
  if (!group) throw new Error(`평타일 없음: ${name}`);
  for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) map.lowerTiles[yy * map.width + xx] = group.tileIds[0]!;
}

/** 재료 이름이 오토타일이면 오토타일로, 아니면 평타일로 칠한다. 맵 밖으로 나간 부분은 잘라 낸다. */
export function paintMaterial(tileset: TilesetDef, map: PackPaintMap, name: string, x: number, y: number, w: number, h: number): void {
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  const x1 = Math.min(map.width, x + w), y1 = Math.min(map.height, y + h);
  if (x1 <= x0 || y1 <= y0) return;
  if (tileset.autotileGroups?.some((entry) => entry.name === name)) paintAuto(tileset, map, name, x0, y0, x1 - x0, y1 - y0);
  else paintFlat(tileset, map, name, x0, y0, x1 - x0, y1 - y0);
}
