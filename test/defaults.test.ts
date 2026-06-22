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
import { CHIPSET_TILE_GROUPS, TERRAIN_TAG, describeChipsetTile, tileLabelForIndex } from "@/project/defaults/chipsetMapping";
import { TILE_SIZE as RUNTIME_TILE_SIZE } from "@/assets/bundled";
import { TILE_SIZE as PREVIEW_TILE_SIZE } from "@/assets/tilePreview";
import { serialize } from "@/project/io";
import { SCHEMA_VERSION } from "@/project/types";
import sampleProject from "./fixtures/projects/rm2k3-sample-v3.json";

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
    expect(tileset.priority[TILE.FLOWERS]).toBe("lower");
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
  it("기본 샘플 맵은 64x64 크기다", () => {
    const m = createStarterMap();
    expect(m.width).toBe(64);
    expect(m.height).toBe(64);
    expect(m.lowerTiles.length).toBe(64 * 64);
    expect(m.upperTiles.length).toBe(64 * 64);
  });

  it("경계가 전부 벽이다(lower)", () => {
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

  it("uses chipset-aligned dirt body tiles for the main road", () => {
    const m = createStarterMap();
    const roadBodyTiles = new Set<number>(CHIPSET_TILE_GROUPS.dirtRoadBody);
    const roadSamples = [
      { x: 32, y: 10 },
      { x: 32, y: 50 },
      { x: 20, y: 36 },
      { x: 52, y: 36 },
      { x: 44, y: 46 },
    ];
    expect(roadBodyTiles.has(TILE.PATH)).toBe(true);
    for (const point of roadSamples) {
      const tile = m.lowerTiles[point.y * m.width + point.x];
      expect(tile).toBeDefined();
      expect(roadBodyTiles.has(tile)).toBe(true);
    }
  });

  it("uses chipset-aligned dirt edge tiles around road borders", () => {
    const m = createStarterMap();
    const roadEdgeSamples = [
      { x: 32, y: 4, expectedTile: 391 },
      { x: 32, y: 59, expectedTile: 451 },
      { x: 31, y: 10, expectedTile: 420 },
      { x: 34, y: 10, expectedTile: 422 },
      { x: 31, y: 4, expectedTile: 390 },
      { x: 34, y: 4, expectedTile: 392 },
      { x: 31, y: 59, expectedTile: 450 },
      { x: 34, y: 59, expectedTile: 452 },
    ];

    for (const sample of roadEdgeSamples) {
      expect(m.lowerTiles[sample.y * m.width + sample.x]).toBe(sample.expectedTile);
    }
  });

  it("uses chipset-aligned sand edge tiles around sand plazas", () => {
    const m = createStarterMap();
    const sandSamples = [
      { x: 50, y: 49, expectedTile: 424 },
      { x: 50, y: 45, expectedTile: 394 },
      { x: 50, y: 53, expectedTile: 454 },
      { x: 46, y: 49, expectedTile: 423 },
      { x: 55, y: 49, expectedTile: 425 },
      { x: 46, y: 45, expectedTile: 393 },
      { x: 55, y: 45, expectedTile: 395 },
      { x: 46, y: 53, expectedTile: 453 },
      { x: 55, y: 53, expectedTile: 455 },
    ];

    for (const sample of sandSamples) {
      expect(m.lowerTiles[sample.y * m.width + sample.x]).toBe(sample.expectedTile);
    }
  });

  it("uses coherent body tiles for generated lakes, sand, and stone floors", () => {
    const m = createStarterMap();
    const waterBodyTiles = new Set<number>(CHIPSET_TILE_GROUPS.waterBody);
    const sandBodyTiles = new Set<number>(CHIPSET_TILE_GROUPS.sandBody);
    const stoneBodyTiles = new Set<number>(CHIPSET_TILE_GROUPS.stoneFloorBody);

    expect(waterBodyTiles.has(m.lowerTiles[26 * m.width + 12] ?? TILE.EMPTY)).toBe(true);
    expect(sandBodyTiles.has(m.lowerTiles[49 * m.width + 50] ?? TILE.EMPTY)).toBe(true);
    expect(stoneBodyTiles.has(m.lowerTiles[14 * m.width + 43] ?? TILE.EMPTY)).toBe(true);
  });

  it("stores generated lakes as semantic animated water for renderer autotiling", () => {
    const m = createStarterMap();
    const bodyTiles = new Set<number>(CHIPSET_TILE_GROUPS.waterBody);
    const sandBodyTiles = new Set<number>(CHIPSET_TILE_GROUPS.sandBody);

    expect(m.lowerTiles[21 * m.width + 12]).not.toBe(TILE.WATER);
    expect(sandBodyTiles.has(m.lowerTiles[21 * m.width + 12] ?? TILE.EMPTY)).toBe(false);
    expect(bodyTiles.has(m.lowerTiles[22 * m.width + 12] ?? TILE.EMPTY)).toBe(true);
    expect(bodyTiles.has(m.lowerTiles[26 * m.width + 12] ?? TILE.EMPTY)).toBe(true);
    expect(m.upperTiles[22 * m.width + 12]).toBe(TILE.EMPTY);
  });

  it("uses expanded decoration groups in the generated showcase map", () => {
    const m = createStarterMap();
    const woodFloorTiles = new Set<number>(CHIPSET_TILE_GROUPS.woodFloorBody);
    const groundDetailTiles = new Set<number>(CHIPSET_TILE_GROUPS.groundDetail);
    const fenceTiles = new Set<number>(CHIPSET_TILE_GROUPS.fenceObjects);

    expect(woodFloorTiles.has(m.lowerTiles[15 * m.width + 12] ?? TILE.EMPTY)).toBe(true);
    expect(groundDetailTiles.has(m.lowerTiles[25 * m.width + 36] ?? TILE.EMPTY)).toBe(true);
    expect(fenceTiles.has(m.upperTiles[24 * m.width + 42] ?? TILE.EMPTY)).toBe(true);
    expect(CHIPSET_TILE_GROUPS.darkWallBody).toContain(m.lowerTiles[55 * m.width + 24] ?? TILE.EMPTY);
      expect(CHIPSET_TILE_GROUPS.houseRoofObjects).toContain(m.lowerTiles[31 * m.width + 39] ?? TILE.EMPTY);
      expect(CHIPSET_TILE_GROUPS.houseWhiteWallUpperObjects).toContain(m.lowerTiles[33 * m.width + 39] ?? TILE.EMPTY);
      expect(CHIPSET_TILE_GROUPS.houseWhiteWallUpperObjects).toContain(m.lowerTiles[33 * m.width + 42] ?? TILE.EMPTY);
      expect(CHIPSET_TILE_GROUPS.houseEntranceUpperObjects).toContain(m.lowerTiles[34 * m.width + 43] ?? TILE.EMPTY);
      expect(CHIPSET_TILE_GROUPS.houseEntranceLowerObjects).toContain(m.lowerTiles[35 * m.width + 43] ?? TILE.EMPTY);
      expect(CHIPSET_TILE_GROUPS.houseWhiteWallRepeatColumnObjects).toContain(m.lowerTiles[35 * m.width + 44] ?? TILE.EMPTY);
    expect(CHIPSET_TILE_GROUPS.tentObjects).toContain(m.upperTiles[47 * m.width + 57] ?? TILE.EMPTY);
    expect(CHIPSET_TILE_GROUPS.signObjects).toContain(m.upperTiles[38 * m.width + 38] ?? TILE.EMPTY);
    expect(CHIPSET_TILE_GROUPS.fireObjects).toContain(m.upperTiles[44 * m.width + 55] ?? TILE.EMPTY);
  });
});
