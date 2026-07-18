import { describe, expect, it } from "vitest";
import {
  collapseLegacyDarkWallMap,
  findLegacyInteriorWallContract,
  formatLegacyInteriorWallReport,
  LEGACY_DARK_STORE_TILES,
  stripLegacyInteriorWallFrameGroup,
} from "@/project/defaults/legacyInteriorWallContract";
import { createDarkWallAutotileGroup, DARK_WALL_TILE } from "@/project/defaults/darkWallAutotile";
import { HOUSE_SHELL_TILE } from "@/project/defaults/interiorHouseWallTiles";
import { INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID } from "@/project/tilesetHarness/themePacks";
import { createBlankProject } from "@/project/defaults";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import type { AutotileGroup, GameMap, Project } from "@/project/types";

const VOID = HOUSE_SHELL_TILE.void;
const FLOOR = HOUSE_SHELL_TILE.floor;

function mapFromRows(id: string, rows: readonly (readonly number[])[], tilesetId = INTERIOR_ROOM_TILESET_ID): GameMap {
  const width = rows[0]?.length ?? 0;
  const height = rows.length;
  return {
    id,
    name: id,
    width,
    height,
    tilesetId,
    tileSize: 16,
    lowerTiles: rows.flatMap((r) => [...r]),
    upperTiles: Array.from({ length: width * height }, () => -1),
    events: [],
  };
}

function projectWith(maps: readonly GameMap[]): Project {
  const project = createBlankProject();
  project.maps = {};
  for (const map of maps) project.maps[map.id] = map;
  return project;
}

/** Old dark variantMap output that the house grammar never writes. */
const DARK_LEGACY_ROWS = [
  [368, 367, 369],
  [426, 427, 428],
  [VOID, VOID, VOID],
];

/** Old wall-frame cap joints + door post base. */
const HOUSE_LEGACY_ROWS = [
  [233, 457, 258],
  [74, 75, 76],
  [104, 105, 106],
  [257, 397, 257],
];

describe("findLegacyInteriorWallContract — read-only diagnosis", () => {
  it("reports a clean project when nothing legacy is stored", () => {
    const project = projectWith([
      mapFromRows("map_clean", [
        [HOUSE_SHELL_TILE.capJointNW, HOUSE_SHELL_TILE.capStraight, HOUSE_SHELL_TILE.capJointNE],
        [HOUSE_SHELL_TILE.postWest, HOUSE_SHELL_TILE.creamUpperM, HOUSE_SHELL_TILE.postEast],
        [HOUSE_SHELL_TILE.postWest, HOUSE_SHELL_TILE.creamLowerM, HOUSE_SHELL_TILE.postEast],
        [HOUSE_SHELL_TILE.southWestCorner, FLOOR, HOUSE_SHELL_TILE.southEastCorner],
      ]),
    ]);
    const report = findLegacyInteriorWallContract(project);
    expect(report.clean).toBe(true);
    expect(report.maps).toEqual([]);
    expect(report.groups).toEqual([]);
    expect(formatLegacyInteriorWallReport(report)).toEqual(["legacy interior wall contract: clean"]);
  });

  it("flags a dark-only legacy map with map id and coordinates", () => {
    const project = projectWith([mapFromRows("map_cave", DARK_LEGACY_ROWS)]);
    const report = findLegacyInteriorWallContract(project);

    expect(report.clean).toBe(false);
    expect(report.maps).toHaveLength(1);
    const found = report.maps[0]!;
    expect(found.mapId).toBe("map_cave");
    expect(found.verdict).toBe("dark-legacy");
    expect(found.houseFaceCells).toBe(0);
    // 426/428 are live house posts — never sole evidence, so they are not reported.
    expect(found.cells.map((c) => c.tile).sort((a, b) => a - b)).toEqual([367, 368, 369, 427]);
    expect(found.cells.every((c) => c.kind === "dark-only-variant")).toBe(true);
    expect(found.cells).toContainEqual({ x: 1, y: 1, tile: 427, kind: "dark-only-variant" });
  });

  it("flags a legacy house map by its forbidden placeholders", () => {
    const project = projectWith([mapFromRows("map_house_old", HOUSE_LEGACY_ROWS)]);
    const report = findLegacyInteriorWallContract(project);

    const found = report.maps[0]!;
    expect(found.verdict).toBe("house-legacy");
    expect(found.cells.map((c) => c.tile).sort((a, b) => a - b)).toEqual([233, 257, 257, 258]);
    expect(found.cells.every((c) => c.kind === "forbidden-placeholder")).toBe(true);
    expect(found.houseFaceCells).toBeGreaterThan(0);
  });

  it("marks a map ambiguous when both contracts left evidence", () => {
    const project = projectWith([mapFromRows("map_mixed", [...DARK_LEGACY_ROWS, ...HOUSE_LEGACY_ROWS])]);
    const found = findLegacyInteriorWallContract(project).maps[0]!;
    expect(found.verdict).toBe("ambiguous");
  });

  it("marks dark evidence sitting on a house shell ambiguous — collapsing would eat the house", () => {
    const project = projectWith([
      mapFromRows("map_cave_with_room", [
        [368, 367, 369],
        [74, 75, 76],
        [104, 105, 106],
      ]),
    ]);
    const found = findLegacyInteriorWallContract(project).maps[0]!;
    expect(found.verdict).toBe("ambiguous");
    expect(found.houseFaceCells).toBe(6);
  });

  it("does not mutate the scanned project", () => {
    const map = mapFromRows("map_mixed", [...DARK_LEGACY_ROWS, ...HOUSE_LEGACY_ROWS]);
    const before = [...map.lowerTiles];
    const project = projectWith([map]);
    findLegacyInteriorWallContract(project);
    expect(project.maps.map_mixed!.lowerTiles).toEqual(before);
  });

  it("ignores maps on non-interior tilesets", () => {
    const project = projectWith([mapFromRows("map_cave_dungeon", DARK_LEGACY_ROWS, "easyrpg_chipset_dungeon")]);
    expect(project.tilesets.easyrpg_chipset_dungeon).toBeTruthy();
    expect(findLegacyInteriorWallContract(project).maps).toEqual([]);
  });

  it("reports the legacy wall-frame store group but not the current 366 dark group", () => {
    const project = projectWith([]);
    const tileset = project.tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const legacyGroup: AutotileGroup = {
      id: INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID,
      name: "실내 벽 프레임",
      neighborhood: 4,
      memberTileIds: [105, 457, 397, 428, 426, 233, 258, 456, 458],
      variantMap: { "0": 233, "15": 105 },
    };
    tileset.autotileGroups = [...(tileset.autotileGroups ?? []), legacyGroup];

    const report = findLegacyInteriorWallContract(project);
    expect(report.clean).toBe(false);
    expect(report.groups).toEqual([
      {
        tilesetId: INTERIOR_ROOM_TILESET_ID,
        groupId: INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID,
        reason: "wall-frame-store-group",
      },
    ]);
  });

  it("reports a dark group that can still store multi-variant ids", () => {
    const project = projectWith([]);
    const tileset = project.tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const current = createDarkWallAutotileGroup();
    tileset.autotileGroups = [
      { ...current, memberTileIds: [366, 367, 427, 396, 398], variantMap: { ...current.variantMap, "5": 427 } },
    ];

    const report = findLegacyInteriorWallContract(project);
    expect(report.groups).toEqual([
      { tilesetId: INTERIOR_ROOM_TILESET_ID, groupId: current.id, reason: "dark-multi-variant-store" },
    ]);
  });

  it("treats a blank project's seeded interior tileset as clean", () => {
    const report = findLegacyInteriorWallContract(createBlankProject());
    expect(report.groups).toEqual([]);
  });
});

describe("collapseLegacyDarkWallMap — pure, explicit dark-only transform", () => {
  it("rewrites every legacy dark store id to 366 and leaves floor/void alone", () => {
    const map = mapFromRows("map_cave", [
      [368, 367, 369],
      [426, 427, 428],
      [396, FLOOR, 398],
      [VOID, VOID, VOID],
    ]);
    const { map: next, changed } = collapseLegacyDarkWallMap(map);

    const wallCells = next.lowerTiles.filter((t) => t !== FLOOR && t !== VOID);
    expect(wallCells).toEqual(Array.from({ length: 8 }, () => DARK_WALL_TILE.BODY));
    expect(next.lowerTiles[2 * 3 + 1]).toBe(FLOOR);
    expect(next.lowerTiles[3 * 3 + 0]).toBe(VOID);
    expect(changed).toHaveLength(8);
    expect(changed).toContainEqual({ x: 1, y: 1, from: 427 });
  });

  it("covers the full legacy dark variantMap output set", () => {
    const map = mapFromRows("map_row", [LEGACY_DARK_STORE_TILES]);
    const { map: next, changed } = collapseLegacyDarkWallMap(map);
    expect(new Set(next.lowerTiles)).toEqual(new Set([DARK_WALL_TILE.BODY]));
    // 366 was already the body — it is not a change.
    expect(changed).toHaveLength(LEGACY_DARK_STORE_TILES.length - 1);
  });

  it("does not mutate the input map", () => {
    const map = mapFromRows("map_cave", DARK_LEGACY_ROWS);
    const before = [...map.lowerTiles];
    const { map: next } = collapseLegacyDarkWallMap(map);
    expect(map.lowerTiles).toEqual(before);
    expect(next.lowerTiles).not.toEqual(before);
  });

  it("reports no change for a map already storing 366 only", () => {
    const B = DARK_WALL_TILE.BODY;
    const { changed } = collapseLegacyDarkWallMap(mapFromRows("map_new", [[B, B], [B, FLOOR]]));
    expect(changed).toEqual([]);
  });
});

describe("stripLegacyInteriorWallFrameGroup — pure group removal", () => {
  it("removes the built-in legacy group and keeps user-authored groups", () => {
    const project = createBlankProject();
    const tileset = project.tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const userGroup: AutotileGroup = {
      id: "user-custom-wall",
      name: "내 벽",
      memberTileIds: [200],
      variantMap: { "0": 200 },
    };
    const legacyGroup: AutotileGroup = {
      id: INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID,
      name: "실내 벽 프레임",
      memberTileIds: [105],
      variantMap: { "0": 105 },
    };
    const before = { ...tileset, autotileGroups: [userGroup, legacyGroup, createDarkWallAutotileGroup()] };

    const { tileset: next, removed } = stripLegacyInteriorWallFrameGroup(before);

    expect(removed).toEqual([INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID]);
    expect(next.autotileGroups?.map((g) => g.id)).toEqual(["user-custom-wall", createDarkWallAutotileGroup().id]);
    // pure — original untouched
    expect(before.autotileGroups).toHaveLength(3);
  });

  it("is a no-op when the legacy group is absent", () => {
    const tileset = createBlankProject().tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const { tileset: next, removed } = stripLegacyInteriorWallFrameGroup(tileset);
    expect(removed).toEqual([]);
    expect(next).toBe(tileset);
  });
});
