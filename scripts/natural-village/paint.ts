import { HOUSE_KITS, stampFootprintHouseKit } from "../../src/editor/houseKit";
import { TILE } from "../../src/project/defaults/constants";
import { DIRT_ROAD_TILE, RM2K3_WOOD_FLOOR_PASSABILITY } from "../../src/project/defaults/chipsetMapping";
import { LAKE_AUTOTILE_TILE } from "../../src/project/defaults/lakeAutotile";
import { shapeRoadAround } from "../../src/project/defaults/roadAutotile";
import type { GameMap, MapLayoutRegion } from "../../src/project/types";
import { HOUSES, MAP_HEIGHT, MAP_WIDTH, houseBounds, type HouseBlueprint, type Point } from "./blueprint";
import {
  BROADLEAF_TREES,
  CONIFER_TREES,
  CREEK_BANDS,
  DARK_GRASS_PATCHES,
  DARK_GRASS_TILES,
  FENCE_ROWS,
  GRASS_TILES,
  PROPS,
  ROAD_STROKES,
  type RoadStroke,
} from "./scenery";
import { placeReferenceBroadleaf, placeReferenceConifer } from "./vegetation";

export class NaturalVillageAuthoringError extends Error {
  constructor(readonly code: "house-stamp" | "house-door" | "occupied-prop" | "tree-density", message: string) {
    super(message);
    this.name = "NaturalVillageAuthoringError";
  }
}

export function paintReferenceTerrain(map: GameMap): void {
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) setLower(map, x, y, pick(GRASS_TILES, x, y));
  }
  for (const patch of DARK_GRASS_PATCHES) {
    for (let y = patch.cy - patch.ry; y <= patch.cy + patch.ry; y += 1) {
      for (let x = patch.cx - patch.rx; x <= patch.cx + patch.rx; x += 1) {
        const dx = (x - patch.cx) / patch.rx;
        const dy = (y - patch.cy) / patch.ry;
        if (dx * dx + dy * dy <= 1) setLower(map, x, y, pick(DARK_GRASS_TILES, x, y));
      }
    }
  }
  for (const band of CREEK_BANDS) {
    for (let y = band.y0; y <= band.y1; y += 1) {
      const ripple = y % 5 === 0 ? 1 : 0;
      for (let x = band.x0; x <= band.x1 + ripple; x += 1) setLower(map, x, y, LAKE_AUTOTILE_TILE.BODY);
    }
  }
  map.layoutPlan = {
    version: 1,
    kind: "hand-authored-natural-village",
    regions: [{ id: "region_west_creek", role: "river", label: "서쪽 굽은 개울", x: 2, y: 0, w: 7, h: MAP_HEIGHT }],
    notes: "마을 생성기를 호출하지 않고 타일 아틀라스 실사 뒤 좌표를 직접 저작한 참조 맵",
  };
}

export function paintReferenceHouses(map: GameMap): void {
  for (const house of HOUSES) {
    const result = stampFootprintHouseKit(map, {
      wings: house.wings,
      kitId: house.kitId,
      stories: house.stories,
      windows: false,
      doorEvent: false,
    });
    if (!result.ok || !result.doorAt) {
      throw new NaturalVillageAuthoringError("house-stamp", `${house.label}: ${result.reason ?? "문 위치 없음"}`);
    }
    if (result.doorAt.x !== house.door.x || result.doorAt.y !== house.door.y) {
      throw new NaturalVillageAuthoringError("house-door", `${house.label}: 문 ${result.doorAt.x},${result.doorAt.y}`);
    }
    paintDoor(map, house.door);
    for (const beam of house.facadeBeams) paintFacadeBeam(map, beam.x0, beam.x1, beam.y);
    for (const window of house.windows) setUpper(map, window.x, window.y, HOUSE_KITS[house.kitId].windowTile);
    map.layoutPlan?.regions.push(houseRegion(house));
  }
}

export function paintReferenceRoadsAndMarket(map: GameMap): void {
  const roadCells = new Map<string, Point>();
  for (const stroke of ROAD_STROKES) paintStroke(stroke, roadCells);
  const points = [...roadCells.values()];
  for (const point of points) setLower(map, point.x, point.y, DIRT_ROAD_TILE.BODY);
  shapeRoadAround(map, points);
  paintWoodRect(map, 2, 28, 8, 2);
  paintWoodRect(map, 39, 22, 11, 8);
  const regions = map.layoutPlan?.regions;
  regions?.push(
    { id: "region_commons", role: "plaza", label: "굽은 길이 만나는 마을 공터", x: 26, y: 23, w: 12, h: 10 },
    { id: "region_market_deck", role: "market", label: "동쪽 목재 장터", x: 39, y: 22, w: 11, h: 8 },
    { id: "region_west_bridge", role: "bridge", label: "서쪽 들길 다리", x: 2, y: 28, w: 8, h: 2 },
  );
  if (map.layoutPlan) {
    map.layoutPlan.roadAnchors = [
      { id: "north_exit", x: 32, y: 0 },
      { id: "west_exit", x: 0, y: 28 },
      { id: "east_exit", x: 63, y: 32 },
      { id: "south_exit", x: 35, y: 55 },
    ];
  }
}

export function paintReferenceLife(map: GameMap): void {
  for (const row of FENCE_ROWS) paintFenceRow(map, row.x0, row.x1, row.y);
  for (const point of BROADLEAF_TREES) placeReferenceBroadleaf(map, point);
  for (const point of CONIFER_TREES) placeReferenceConifer(map, point);
  for (const prop of PROPS) {
    const index = prop.y * map.width + prop.x;
    if (map.upperTiles[index] !== TILE.EMPTY) {
      throw new NaturalVillageAuthoringError("occupied-prop", `소품 ${prop.tile} @ ${prop.x},${prop.y}`);
    }
    setUpper(map, prop.x, prop.y, prop.tile);
  }
  const treeTops = map.upperTiles.filter((tile) => tile === 260 || tile === 262 || tile === 263).length;
  if (treeTops < 34) throw new NaturalVillageAuthoringError("tree-density", `나무 윗칸 ${treeTops}`);
  map.layoutPlan?.regions.push(
    { id: "region_north_forest", role: "forest", label: "북쪽 혼합림", x: 0, y: 0, w: MAP_WIDTH, h: 20 },
    { id: "region_south_forest", role: "forest", label: "남쪽 혼합림", x: 0, y: 34, w: MAP_WIDTH, h: 22 },
  );
}

function houseRegion(house: HouseBlueprint): MapLayoutRegion {
  const bounds = houseBounds(house);
  return {
    id: `region_${house.id}`,
    role: "house",
    label: house.label,
    ...bounds,
    kitId: house.kitId,
    shape: house.shape,
    yardTheme: house.yardTheme,
    tags: [`stories:${house.stories}`, "hand-authored"],
    doorAt: { ...house.door },
    front: { x: house.door.x, y: house.door.y + 1 },
    hasFence: house.hasFence,
  };
}

function paintStroke(stroke: RoadStroke, output: Map<string, Point>): void {
  for (let index = 1; index < stroke.points.length; index += 1) {
    const from = stroke.points[index - 1];
    const to = stroke.points[index];
    if (!from || !to) continue;
    for (const point of rasterLine(from, to)) {
      const offsets = stroke.width === 2
        ? Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
          ? [{ x: 0, y: 0 }, { x: 0, y: 1 }]
          : [{ x: 0, y: 0 }, { x: 1, y: 0 }]
        : [{ x: 0, y: 0 }];
      for (const offset of offsets) {
        const cell = { x: point.x + offset.x, y: point.y + offset.y };
        if (inside(cell.x, cell.y)) output.set(`${cell.x},${cell.y}`, cell);
      }
    }
  }
}

function rasterLine(from: Point, to: Point): Point[] {
  const points: Point[] = [];
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = -Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let error = dx + dy;
  while (true) {
    points.push({ x, y });
    if (x === to.x && y === to.y) return points;
    const twice = 2 * error;
    const nextX = twice >= dy ? x + sx : x;
    const nextY = twice <= dx ? y + sy : y;
    if (nextX !== x && nextY !== y) points.push({ x: nextX, y });
    if (nextX !== x) error += dy;
    if (nextY !== y) error += dx;
    x = nextX;
    y = nextY;
  }
}

function paintWoodRect(map: GameMap, x0: number, y0: number, width: number, height: number): void {
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) {
      let tile: number = RM2K3_WOOD_FLOOR_PASSABILITY.body;
      if (x === x0) tile = RM2K3_WOOD_FLOOR_PASSABILITY.edgeWest;
      else if (x === x0 + width - 1) tile = RM2K3_WOOD_FLOOR_PASSABILITY.edgeEast;
      else if (y === y0) tile = RM2K3_WOOD_FLOOR_PASSABILITY.edgeNorth;
      else if (y === y0 + height - 1) tile = RM2K3_WOOD_FLOOR_PASSABILITY.edgeSouth;
      setLower(map, x, y, tile);
      setUpper(map, x, y, TILE.EMPTY);
    }
  }
}

function paintDoor(map: GameMap, door: Point): void {
  setLower(map, door.x, door.y - 1, 116);
  setLower(map, door.x, door.y, 146);
  setUpper(map, door.x, door.y - 1, TILE.EMPTY);
  setUpper(map, door.x, door.y, TILE.EMPTY);
}

function paintFacadeBeam(map: GameMap, x0: number, x1: number, y: number): void {
  for (let x = x0; x <= x1; x += 1) setUpper(map, x, y, x === x0 ? 378 : x === x1 ? 439 : 379);
}

function paintFenceRow(map: GameMap, x0: number, x1: number, y: number): void {
  for (let x = x0; x <= x1; x += 1) {
    const index = y * map.width + x;
    if (!isGrass(map.lowerTiles[index]) || map.upperTiles[index] !== TILE.EMPTY) continue;
    setUpper(map, x, y, x === x0 ? 378 : x === x1 ? 380 : 379);
  }
}

function isGrass(tile: number | undefined): boolean {
  return tile !== undefined
    && ((GRASS_TILES as readonly number[]).includes(tile) || (DARK_GRASS_TILES as readonly number[]).includes(tile));
}

function pick(tiles: readonly number[], x: number, y: number): number {
  const seed = Math.abs(Math.imul(x + 11, 73856093) ^ Math.imul(y + 17, 19349663));
  return tiles[seed % tiles.length] ?? TILE.GRASS;
}

function setLower(map: GameMap, x: number, y: number, tile: number): void {
  if (inside(x, y)) map.lowerTiles[y * map.width + x] = tile;
}

function setUpper(map: GameMap, x: number, y: number, tile: number): void {
  if (inside(x, y)) map.upperTiles[y * map.width + x] = tile;
}

function inside(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT;
}
