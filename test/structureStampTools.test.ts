import { describe, expect, it } from "vitest";
import {
  applyStructureStampToMap,
  canPlaceStructureStampOnMap,
  previewStructureStampCells,
} from "@/editor/structureStampTools";
import { INTERIOR_HOUSE_TILE, INTERIOR_HOUSE_TILESET_ID } from "@/editor/interiorStructureStamp";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults";
import { INTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsInterior";
import type { GameMap } from "@/project/types";
import { genId } from "@/util/id";

const FRAMED_DOOR_TOP = 116;
const FRAMED_DOOR_BOTTOM = 146;
const ROOF_LEFT = 354;
const ROOF_RIGHT = 355;
const WINDOW = 85;
// 실내 기대값은 tileSemanticsInterior 정본 라벨 기준(아래 시맨틱 대조 테스트가 role을 단언한다).
const INTERIOR_WALL_TOP_LEFT = 74; // 크림 회벽 상단 좌
const INTERIOR_FLOOR = 72; // 나무 바닥
const INTERIOR_BOOKSHELF_LEFT = 48; // 책장 중단(좌·책 2단)
const INTERIOR_BED_LEFT = 355; // 가로 침대 좌
const INTERIOR_TABLE_MID = 326; // 긴 탁자 몸통(가로 반복)
const INTERIOR_DOOR_WEST = 398; // 남벽 문 서쪽 플랭크(하우스 셸 트림)
const INTERIOR_DOOR_EAST = 396; // 남벽 문 동쪽 플랭크

describe("structure stamp tools", () => {
  it("stamps a complete template house onto both tile layers", () => {
    const map = createMap();

    applyStructureStampToMap(map, { id: "house-template", origin: { x: 1, y: 1 } });

    expect(map.upperTiles[at(map, 8, 5)]).toBe(ROOF_LEFT);
    expect(map.upperTiles[at(map, 18, 5)]).toBe(ROOF_RIGHT);
    expect(map.upperTiles[at(map, 9, 10)]).toBe(WINDOW);
    expect(map.upperTiles[at(map, 15, 10)]).toBe(WINDOW);
    expect(map.lowerTiles[at(map, 14, 10)]).toBe(FRAMED_DOOR_TOP);
    expect(map.lowerTiles[at(map, 14, 11)]).toBe(FRAMED_DOOR_BOTTOM);
  });

  it("reports preview cells for the structure before committing it", () => {
    const map = createMap();

    const cells = previewStructureStampCells(map, { id: "house-template", origin: { x: 1, y: 1 } });

    expect(cells).toEqual(expect.arrayContaining([
      { layer: "upper", tile: ROOF_LEFT, x: 8, y: 5 },
      { layer: "upper", tile: WINDOW, x: 9, y: 10 },
      { layer: "lower", tile: FRAMED_DOOR_BOTTOM, x: 14, y: 11 },
    ]));
    expect(map.upperTiles[at(map, 8, 5)]).toBe(TILE.EMPTY);
  });

  it("stamps a furnished 10x10 small-house interior", () => {
    const map = createInteriorMap();

    applyStructureStampToMap(map, { id: "house-interior-10x10", origin: { x: 2, y: 3 } });

    expect(map.lowerTiles[at(map, 2, 3)]).toBe(INTERIOR_WALL_TOP_LEFT);
    expect(map.lowerTiles[at(map, 5, 6)]).toBe(INTERIOR_FLOOR);
    // 남벽 문: 서 플랭크 398 | 개구부 바닥 72 | 동 플랭크 396 (하우스 셸 문법).
    expect(map.lowerTiles[at(map, 5, 12)]).toBe(INTERIOR_DOOR_WEST);
    expect(map.lowerTiles[at(map, 6, 12)]).toBe(INTERIOR_FLOOR);
    expect(map.lowerTiles[at(map, 7, 12)]).toBe(INTERIOR_DOOR_EAST);
    expect(map.upperTiles[at(map, 3, 5)]).toBe(INTERIOR_BOOKSHELF_LEFT);
    expect(map.upperTiles[at(map, 8, 5)]).toBe(INTERIOR_BED_LEFT);
    expect(map.upperTiles[at(map, 6, 8)]).toBe(INTERIOR_TABLE_MID);
  });

  it("previews the 10x10 interior without mutating the map", () => {
    const map = createInteriorMap();

    const cells = previewStructureStampCells(map, { id: "house-interior-10x10", origin: { x: 2, y: 3 } });

    expect(cells).toEqual(expect.arrayContaining([
      { layer: "lower", tile: INTERIOR_WALL_TOP_LEFT, x: 2, y: 3 },
      { layer: "upper", tile: INTERIOR_BED_LEFT, x: 8, y: 5 },
      { layer: "upper", tile: INTERIOR_TABLE_MID, x: 6, y: 8 },
    ]));
    expect(map.lowerTiles[at(map, 2, 3)]).toBe(TILE.GRASS);
    expect(map.upperTiles[at(map, 8, 5)]).toBe(TILE.EMPTY);
  });

  it("does not stamp interior tiles into an exterior tileset map", () => {
    const map = createMap();
    const lowerTiles = [...map.lowerTiles];
    const upperTiles = [...map.upperTiles];

    applyStructureStampToMap(map, { id: "house-interior-10x10", origin: { x: 2, y: 3 } });

    expect(map.tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(map.lowerTiles).toEqual(lowerTiles);
    expect(map.upperTiles).toEqual(upperTiles);
  });

  it("keeps exterior and interior structure stamps on their own tilesets", () => {
    const exteriorMap = createMap();
    const interiorMap = createInteriorMap();

    expect(canPlaceStructureStampOnMap(exteriorMap, "house-compact")).toBe(true);
    expect(canPlaceStructureStampOnMap(exteriorMap, "house-interior-10x10")).toBe(false);
    expect(canPlaceStructureStampOnMap(interiorMap, "house-interior-10x10")).toBe(true);
    expect(canPlaceStructureStampOnMap(interiorMap, "house-compact")).toBe(false);
  });
});

// ── 정본(tileSemanticsInterior) 시맨틱 대조 — ID 하드코딩 드리프트 방지 가드 ─────
const SEMANTIC_BY_INDEX = new Map(INTERIOR_TILE_SEMANTICS.map((entry) => [entry.index, entry]));

describe("interior stamp tiles match the canonical interior semantics", () => {
  it("registers every stamp tile in the canonical semantics table", () => {
    for (const [name, tile] of Object.entries(INTERIOR_HOUSE_TILE)) {
      expect(SEMANTIC_BY_INDEX.has(tile), `${name}=${tile} missing from INTERIOR_TILE_SEMANTICS`).toBe(true);
    }
  });

  it("uses wall-role tiles for walls and door planks, and a passable floor-role floor", () => {
    const wallKeys = [
      "WALL_TOP_LEFT", "WALL_TOP_MID", "WALL_TOP_RIGHT",
      "WALL_BODY_LEFT", "WALL_BODY_MID", "WALL_BODY_RIGHT",
      "DOOR_WEST", "DOOR_EAST",
    ] as const;
    for (const name of wallKeys) {
      const entry = SEMANTIC_BY_INDEX.get(INTERIOR_HOUSE_TILE[name]);
      expect(entry?.role, `${name}=${INTERIOR_HOUSE_TILE[name]}`).toBe("wall");
      expect(entry?.passage, `${name}=${INTERIOR_HOUSE_TILE[name]}`).toBe("solid");
    }
    const floor = SEMANTIC_BY_INDEX.get(INTERIOR_HOUSE_TILE.FLOOR);
    expect(floor?.role).toBe("floor");
    expect(floor?.passage).toBe("passable");
  });

  it("uses furniture-role tiles for bed, table, counter, cabinet, chairs, and bookshelf", () => {
    const furnitureKeys = [
      "BED_LEFT", "BED_RIGHT",
      "TABLE_LEFT", "TABLE_MID", "TABLE_RIGHT",
      "KITCHEN_LEFT", "KITCHEN_MID", "KITCHEN_RIGHT",
      "CABINET_TOP", "CABINET_BOTTOM",
      "CHAIR_WEST", "CHAIR_EAST",
      "BOOKSHELF_LEFT", "BOOKSHELF_MID", "BOOKSHELF_RIGHT",
    ] as const;
    for (const name of furnitureKeys) {
      const entry = SEMANTIC_BY_INDEX.get(INTERIOR_HOUSE_TILE[name]);
      expect(entry?.role, `${name}=${INTERIOR_HOUSE_TILE[name]}`).toBe("furniture");
    }
  });

  it("uses passable floor-role carpet tiles for the rug", () => {
    const rugKeys = [
      "RUG_TOP_LEFT", "RUG_TOP_MID", "RUG_TOP_RIGHT",
      "RUG_BOTTOM_LEFT", "RUG_BOTTOM_MID", "RUG_BOTTOM_RIGHT",
    ] as const;
    for (const name of rugKeys) {
      const entry = SEMANTIC_BY_INDEX.get(INTERIOR_HOUSE_TILE[name]);
      expect(entry?.role, `${name}=${INTERIOR_HOUSE_TILE[name]}`).toBe("floor");
      expect(entry?.passage, `${name}=${INTERIOR_HOUSE_TILE[name]}`).toBe("passable");
    }
  });
});

function createMap(tilesetId = DEFAULT_TILESET_ID): GameMap {
  const width = 24;
  const height = 24;
  return {
    events: [],
    height,
    id: genId("map"),
    lowerTiles: new Array<number>(width * height).fill(TILE.GRASS),
    name: "structure stamp test",
    tileSize: 16,
    tilesetId,
    upperTiles: new Array<number>(width * height).fill(TILE.EMPTY),
    width,
  };
}

function createInteriorMap(): GameMap {
  return createMap(INTERIOR_HOUSE_TILESET_ID);
}

function at(map: GameMap, x: number, y: number): number {
  return y * map.width + x;
}
