// test/defaults.test.ts
// 빈 프로젝트 무결성 검증 — v2 스키마(3레이어/Database/Map Tree).

import { describe, it, expect } from "vitest";
import {
  createBlankProject,
  createBlankMap,
  createStarterMap,
  TILE,
  DEFAULT_TILESET_ID,
  DEFAULT_TILESET_NAME,
  DEFAULT_TILESET_TEXTURE_KEY,
  DEFAULT_TILE_SIZE,
  LEGACY_RM_TILESET_ID,
} from "@/project/defaults";
import { TERRAIN_TAG, describeChipsetTile, dirtLikeTiles, tileLabelForIndex } from "@/project/defaults/chipsetMapping";
import { TILE_SIZE as RUNTIME_TILE_SIZE } from "@/assets/bundled";
import { TILE_SIZE as PREVIEW_TILE_SIZE } from "@/assets/tilePreview";
import { serialize } from "@/project/io";
import { SCHEMA_VERSION } from "@/project/types";
import sampleProject from "./fixtures/projects/rm2k3-sample-v3.json";

const STARTER_VILLAGE_SMALL_HOUSE_PATTERN = [
  [374, 375, 374, 375, 374],
  [404, 405, 404, 405, 404],
  [102, 103, 103, 103, 104],
  [132, 133, 329, 133, 134],
  [162, 163, 359, 163, 164],
] as const;

const STARTER_VILLAGE_HOUSE_DOOR_APPROACHES = [
  { x: 7, y: 10 },
  { x: 21, y: 10 },
  { x: 7, y: 22 },
] as const;
const STARTER_VILLAGE_FIRST_DOOR_APPROACH = STARTER_VILLAGE_HOUSE_DOOR_APPROACHES[0];

type PatternSubject = {
  readonly tiles: readonly number[];
  readonly mapWidth: number;
  readonly mapHeight: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tileSizesIn(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => tileSizesIn(entry));
  }
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, entry]) => {
    if (key === "tileSize" && typeof entry === "number") return [entry];
    return tileSizesIn(entry);
  });
}

describe("createBlankProject", () => {
  it("스키마 버전 3을 가진다", () => {
    const p = createBlankProject();
    expect(p.version).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(3);
  });

  it("startMapId가 maps에 존재한다", () => {
    const p = createBlankProject();
    expect(p.maps[p.startMapId]).toBeDefined();
  });

  it("startPos가 시작 맵 경계 안에 있다", () => {
    const p = createBlankProject();
    const m = p.maps[p.startMapId];
    expect(p.startPos.x).toBeGreaterThanOrEqual(0);
    expect(p.startPos.x).toBeLessThan(m.width);
    expect(p.startPos.y).toBeGreaterThanOrEqual(0);
    expect(p.startPos.y).toBeLessThan(m.height);
  });

  it("Database 구조가 있다(switches/variables/commonEvents/tilesets)", () => {
    const p = createBlankProject();
    expect(Array.isArray(p.switches)).toBe(true);
    expect(Array.isArray(p.variables)).toBe(true);
    expect(Array.isArray(p.commonEvents)).toBe(true);
    expect(p.tilesets[DEFAULT_TILESET_ID]).toBeDefined();
  });

  it("uses EasyRPG RTP Combined Town as the project-wide default chipset", () => {
    const p = createBlankProject();
    const defaultTileset = p.tilesets[DEFAULT_TILESET_ID];
    const chipsetProfiles = p.resourceProfiles.filter((profile) => profile.kind === "chipset");

    expect(DEFAULT_TILESET_ID).toBe("easyrpg_chipset_combined_town");
    expect(defaultTileset?.name).toBe(DEFAULT_TILESET_NAME);
    expect(defaultTileset?.image).toEqual({ type: "bundled", id: DEFAULT_TILESET_TEXTURE_KEY });
    expect(p.maps[p.startMapId].tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(chipsetProfiles[0]?.assetId).toBe(DEFAULT_TILESET_TEXTURE_KEY);
    expect(chipsetProfiles.filter((profile) => profile.assetId === DEFAULT_TILESET_TEXTURE_KEY)).toHaveLength(1);
    expect(p.tilesets[LEGACY_RM_TILESET_ID]).toBeDefined();
  });

  it("Map Tree가 있고 루트가 startMapId", () => {
    const p = createBlankProject();
    expect(p.mapTree.mapId).toBe(p.startMapId);
    expect(Array.isArray(p.mapTree.children)).toBe(true);
  });

  it("assets.sprites에 hero/npc가 있다", () => {
    const p = createBlankProject();
    expect(Object.keys(p.assets.sprites).length).toBeGreaterThan(0);
    expect(p.assets.uploaded).toBeDefined();
  });

  it("meta.terms가 있다", () => {
    const p = createBlankProject();
    expect(typeof p.meta.terms.gold).toBe("string");
  });

  it("uses RM2K3 16x16 tiles for runtime, defaults, export, and sample fixtures", () => {
    const p = createBlankProject();
    const exported = JSON.parse(serialize(p));

    expect(DEFAULT_TILE_SIZE).toBe(16);
    expect(RUNTIME_TILE_SIZE).toBe(16);
    expect(PREVIEW_TILE_SIZE).toBe(16);
    expect(p.tilesets[DEFAULT_TILESET_ID].tileSize).toBe(16);
    expect(p.maps[p.startMapId].tileSize).toBe(16);
    expect(tileSizesIn(exported).every((tileSize) => tileSize === 16)).toBe(true);
    expect(tileSizesIn(sampleProject).every((tileSize) => tileSize === 16)).toBe(true);
  });

  it("maps bundled chipset terrain, priority, and passability by atlas index", () => {
    const p = createBlankProject();
    const tileset = p.tilesets[DEFAULT_TILESET_ID];
    const passable = { up: true, down: true, left: true, right: true };
    const solid = { up: false, down: false, left: false, right: false };

    expect(tileset.terrain[TILE.WATER]).toBe(TERRAIN_TAG.WATER);
    expect(tileset.terrain[TILE.PATH]).toBe(TERRAIN_TAG.NORMAL);
    expect(tileset.passability[TILE.WATER]).toEqual(solid);
    expect(tileset.passability[TILE.PATH]).toEqual(passable);
    expect(tileset.priority[TILE.TREE]).toBe("lower");
    expect(tileset.passability[TILE.TREE]).toEqual(solid);
    expect(tileset.priority[TILE.FLOWERS]).toBe("upper");
    expect(tileset.passability[TILE.FLOWERS]).toEqual(passable);
    expect(tileset.priority[85]).toBe("lower");
    expect(tileset.priority[378]).toBe("lower");
    expect(tileset.priority[374]).toBe("upper");
    expect(tileLabelForIndex(TILE.PATH)).toBe("Dirt road");
  });

  it("describes one chipset cell as the smallest mapping unit", () => {
    expect(describeChipsetTile(TILE.PATH)).toMatchObject({
      index: TILE.PATH,
      column: 0,
      row: 12,
      label: "Dirt road",
      layer: "lower",
      passage: "passable",
      terrainTag: TERRAIN_TAG.NORMAL,
      repeatRole: "body",
      confirmed: true,
    });
    expect(describeChipsetTile(TILE.TREE)).toMatchObject({
      label: "Tree",
      layer: "upper",
      passage: "solid",
      repeatRole: "object",
      confirmed: true,
    });
    expect(describeChipsetTile(390)).toMatchObject({
      label: "Dirt corner",
      repeatRole: "edge",
      confirmed: true,
    });
  });

});

describe("createBlankMap", () => {
  it("lowerTiles/upperTiles 길이 = width*height", () => {
    const m = createBlankMap("테스트", 5, 4);
    expect(m.lowerTiles.length).toBe(20);
    expect(m.upperTiles.length).toBe(20);
  });

  it("기본 lower는 전부 잔디, upper는 전부 빈 칸", () => {
    const m = createBlankMap("테스트", 3, 3);
    expect(m.lowerTiles.every((t: number) => t === TILE.GRASS)).toBe(true);
    expect(m.upperTiles.every((t: number) => t === TILE.EMPTY)).toBe(true);
  });

  it("tilesetId가 기본 타일셋", () => {
    const m = createBlankMap("테스트", 3, 3);
    expect(m.tilesetId).toBe(DEFAULT_TILESET_ID);
  });
});

describe("createStarterMap", () => {
  it("builds the default 마을 as a 30x30 village with exactly three small houses and connected roads", () => {
    // Given: the starter map factory creates the first user-visible map.
    // When: the default starter map is generated.
    const m = createStarterMap();

    // Then: the map has the requested compact village shape.
    expect(m.name).toBe("마을");
    expect(m.width).toBe(30);
    expect(m.height).toBe(30);
    expect(m.lowerTiles.length).toBe(30 * 30);
    expect(m.upperTiles.length).toBe(30 * 30);
    expect(countPatternOccurrences({ tiles: m.lowerTiles, mapWidth: m.width, mapHeight: m.height }, STARTER_VILLAGE_SMALL_HOUSE_PATTERN)).toBe(3);
    expect(roadComponentSize(m, STARTER_VILLAGE_FIRST_DOOR_APPROACH)).toBe(roadTileCount(m));
    for (const approach of STARTER_VILLAGE_HOUSE_DOOR_APPROACHES) {
      expect(isDirtRoadTile(m.lowerTiles[approach.y * m.width + approach.x] ?? TILE.EMPTY)).toBe(true);
      expect(roadComponentContains(m, STARTER_VILLAGE_FIRST_DOOR_APPROACH, approach)).toBe(true);
      expect(m.upperTiles[approach.y * m.width + approach.x]).toBe(TILE.EMPTY);
    }
  });

  it("keeps the compact village boundary walled", () => {
    const m = createStarterMap();
    for (let x = 0; x < m.width; x++) {
      expect(m.lowerTiles[0 * m.width + x]).toBe(TILE.WALL);
      expect(m.lowerTiles[(m.height - 1) * m.width + x]).toBe(TILE.WALL);
    }
    for (let y = 0; y < m.height; y++) {
      expect(m.lowerTiles[y * m.width + 0]).toBe(TILE.WALL);
      expect(m.lowerTiles[y * m.width + (m.width - 1)]).toBe(TILE.WALL);
    }
  });

  it("uses chipset-aligned dirt tiles for the connected village road", () => {
    const m = createStarterMap();
    const roadTiles = new Set<number>(dirtLikeTiles());
    const roadSamples = [
      { x: 4, y: 10 },
      { x: 14, y: 11 },
      { x: 23, y: 12 },
      { x: 7, y: 22 },
      { x: 15, y: 24 },
    ];
    expect(roadTiles.has(TILE.PATH)).toBe(true);
    for (const point of roadSamples) {
      const tile = m.lowerTiles[point.y * m.width + point.x];
      expect(tile).toBeDefined();
      expect(roadTiles.has(tile ?? TILE.EMPTY)).toBe(true);
      expect(m.upperTiles[point.y * m.width + point.x]).toBe(TILE.EMPTY);
    }
  });
});

function countPatternOccurrences(
  subject: PatternSubject,
  pattern: readonly (readonly number[])[]
): number {
  let count = 0;
  const patternHeight = pattern.length;
  const patternWidth = pattern[0]?.length ?? 0;
  for (let y = 0; y <= subject.mapHeight - patternHeight; y += 1) {
    for (let x = 0; x <= subject.mapWidth - patternWidth; x += 1) {
      if (matchesPatternAt(subject, pattern, { x, y })) count += 1;
    }
  }
  return count;
}

function matchesPatternAt(
  subject: PatternSubject,
  pattern: readonly (readonly number[])[],
  origin: { readonly x: number; readonly y: number }
): boolean {
  for (let y = 0; y < pattern.length; y += 1) {
    const row = pattern[y];
    if (!row) return false;
    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (tile !== undefined && tile >= 0 && subject.tiles[(origin.y + y) * subject.mapWidth + origin.x + x] !== tile) return false;
    }
  }
  return true;
}

function roadTileCount(map: ReturnType<typeof createStarterMap>): number {
  return map.lowerTiles.filter(isDirtRoadTile).length;
}

function roadComponentSize(map: ReturnType<typeof createStarterMap>, start: { readonly x: number; readonly y: number }): number {
  return collectRoadComponent(map, start).size;
}

function roadComponentContains(
  map: ReturnType<typeof createStarterMap>,
  start: { readonly x: number; readonly y: number },
  target: { readonly x: number; readonly y: number }
): boolean {
  return collectRoadComponent(map, start).has(pointKey(target));
}

function collectRoadComponent(map: ReturnType<typeof createStarterMap>, start: { readonly x: number; readonly y: number }): Set<string> {
  const visited = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const point = queue.shift();
    if (!point) continue;
    const key = pointKey(point);
    if (visited.has(key)) continue;
    const tile = map.lowerTiles[point.y * map.width + point.x] ?? TILE.EMPTY;
    if (!isDirtRoadTile(tile)) continue;
    visited.add(key);
    queue.push(
      { x: point.x + 1, y: point.y },
      { x: point.x - 1, y: point.y },
      { x: point.x, y: point.y + 1 },
      { x: point.x, y: point.y - 1 }
    );
  }
  return visited;
}

function pointKey(point: { readonly x: number; readonly y: number }): string {
  return `${point.x},${point.y}`;
}

function isDirtRoadTile(tile: number): boolean {
  return dirtLikeTiles().includes(tile);
}
