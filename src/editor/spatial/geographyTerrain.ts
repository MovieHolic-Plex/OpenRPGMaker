import { canMove, isPassableLanding } from "@/project/collision";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { isWorldTileset, WORLD_SEA_TILE } from "@/project/defaults/worldCoastMapping";
import { WORLD_TERRAIN_BLOCKS } from "@/project/defaults/worldTerrainAutotiles";
import { own } from "@/project/spatial/domain";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import type { SpatialPoint, SpatialRoute, SpatialTerrain } from "@/project/spatial/types";
import type { GameMap, Project } from "@/project/types";
import { MAP_GENERATION_PROFILES } from "../tools/mapGenerationProfiles";
import { resolveAutotile } from "../tools/v3/rmTypeExpander";
import { inArea } from "./compileTerrain";
import { SpatialCompileError } from "./compilerTypes";
import { geographyBridges, geographyMountains, mountainSurface } from "./geographyStructures";

/**
 * 지형에 적힌 픽셀 크기가 지금 아틀라스와 다르면 컴파일을 멈춘다.
 *
 * 왜 조용히 넘기면 안 되는가: 장소가 32px 아틀라스로 저작된 뒤 타일셋이 16px 판으로
 * 바뀌면, 칸 좌표는 그대로인데 픽셀 의미가 반으로 줄어 배치가 전부 어긋난다. 기록이
 * 없으면(구 데이터) 검사하지 않는다 — 없는 것을 어긋남으로 몰면 옛 장소가 전부 죽는다.
 */
function assertTerrainTileSize(terrain: SpatialTerrain, atlasTileSize: number): void {
  if (terrain.tileSize === undefined || terrain.tileSize === atlasTileSize) return;
  throw new SpatialCompileError("atlas", `${terrain.tilesetId}: tileSize ${terrain.tileSize} vs atlas ${atlasTileSize}`);
}

/** Authored World terrain only: no random layout, repair carving, or shared passage writes. */
export function geographyTerrain(project: Project, terrain: SpatialTerrain, identity: { readonly id: string; readonly name: string }): GameMap {
  const tileset = own(project.tilesets, terrain.tilesetId);
  assertTerrainTileSize(terrain, tileset.tileSize);
  const profile = MAP_GENERATION_PROFILES.get(terrain.tilesetId);
  if (profile?.layout !== "world" || !isWorldTileset(tileset)) throw new SpatialCompileError("atlas", terrain.tilesetId);
  const materials = new Map<string, number>([["ground", profile.palettes.village.base], ["water", WORLD_SEA_TILE],
    ...WORLD_TERRAIN_BLOCKS.map(block => [block.key, block.anchor + 61] as const)]);
  const map: GameMap = { ...identity, tilesetId: terrain.tilesetId, tileSize: tileset.tileSize,
    width: terrain.width, height: terrain.height, lowerTiles: Array<number>(terrain.width * terrain.height).fill(-1),
    upperTiles: Array<number>(terrain.width * terrain.height).fill(-1), events: [] };
  const privateAtlas = `world_structures_${map.id}`;
  if (project.maps[map.id]?.tilesetId === privateAtlas) map.tilesetId = privateAtlas;
  const cells = Array.from({ length: map.width * map.height }, (_, i) => ({ x: i % map.width, y: Math.floor(i / map.width) }));
  for (const area of [{ kind: "rect", x: 0, y: 0, width: map.width, height: map.height, material: terrain.floor } as const, ...terrain.areas]) {
    if (mountainSurface(area.material)) continue;
    const tile = materials.get(area.material);
    if (tile === undefined || tile >= tileset.count || tileset.tileGrafts?.some(graft => graft.targetTile === tile)) {
      throw new SpatialCompileError("material", `${identity.id}:${area.material}`);
    }
    for (const point of cells) if (inArea(area, point)) map.lowerTiles[point.y * map.width + point.x] = tile;
  }
  for (const group of autotileGroupsForTileset(tileset)) resolveAutotile(group, cells, map);
  geographyMountains(project, map, terrain.areas);
  return map;
}

/** 정주지 지역의 바탕 — 지형을 칠하는 월드 래스터 대신 마을 시공기가 채울 combined_town 잔디 맵. */
export function settlementTerrain(project: Project, terrain: SpatialTerrain, identity: { readonly id: string; readonly name: string }): GameMap {
  const tileset = own(project.tilesets, terrain.tilesetId);
  assertTerrainTileSize(terrain, tileset.tileSize);
  if (terrain.tilesetId !== COMBINED_TOWN_TILESET_ID) throw new SpatialCompileError("atlas", `${identity.id}:${terrain.tilesetId}`);
  return { ...identity, tilesetId: terrain.tilesetId, tileSize: tileset.tileSize,
    width: terrain.width, height: terrain.height,
    lowerTiles: Array<number>(terrain.width * terrain.height).fill(TILE.GRASS),
    upperTiles: Array<number>(terrain.width * terrain.height).fill(TILE.EMPTY), events: [] };
}

export function routeCells(route: Pick<SpatialRoute, "id" | "points">): readonly SpatialPoint[] {
  const cells: SpatialPoint[] = [];
  for (const [index, to] of route.points.entries()) {
    const from = route.points[index - 1];
    if (!from) { cells.push(to); continue; }
    if (from.x !== to.x && from.y !== to.y) throw new SpatialCompileError("connection", `${route.id}: orthogonal polyline required`);
    const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
    for (let step = 1; step <= length; step++) cells.push({ x: from.x + Math.sign(to.x - from.x) * step, y: from.y + Math.sign(to.y - from.y) * step });
  }
  return cells;
}

/** A path may paint existing walkable ground, but must never erase an authored obstacle. */
export function paintGeographyRoute(project: Project, map: GameMap, route: Pick<SpatialRoute, "id" | "points">): void {
  const cells = routeCells(route);
  for (const cell of cells) if (cell.x < 0 || cell.y < 0 || cell.x >= map.width || cell.y >= map.height) throw new SpatialCompileError("clipped", route.id);
  geographyBridges(project, map, cells);
  const dirt = WORLD_TERRAIN_BLOCKS.find(block => block.key === "dirt");
  if (!dirt) throw new TypeError("Missing World dirt mapping");
  for (const [index, cell] of cells.entries()) {
    if (cell.x < 0 || cell.y < 0 || cell.x >= map.width || cell.y >= map.height) throw new SpatialCompileError("clipped", route.id);
    if (!isPassableLanding(project, map, cell.x, cell.y)) throw new SpatialCompileError("blocked", `${route.id}@${cell.x},${cell.y}`);
    const previous = cells[index - 1];
    if (previous && (!canMove(project, map, previous.x, previous.y, cell.x, cell.y) || !canMove(project, map, cell.x, cell.y, previous.x, previous.y))) {
      throw new SpatialCompileError("connection", route.id);
    }
  }
  const tileset = own(project.tilesets, map.tilesetId);
  for (const cell of cells) {
    const index = cell.y * map.width + cell.x;
    if (map.upperTiles[index] === -1 && !tileset.tileMeta?.[map.lowerTiles[index] ?? -1]?.userLocked) map.lowerTiles[index] = dirt.anchor + 61;
  }
  for (const [index, cell] of cells.entries()) {
    const previous = cells[index - 1];
    if (!isPassableLanding(project, map, cell.x, cell.y) || previous &&
      (!canMove(project, map, previous.x, previous.y, cell.x, cell.y) || !canMove(project, map, cell.x, cell.y, previous.x, previous.y))) {
      throw new SpatialCompileError("connection", route.id);
    }
  }
}
