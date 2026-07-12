import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import {
  applyEasyRpgThemeMetadataPacks,
  createInteriorWallFrameAutotileGroup,
  ensureTilesetHarnesses,
  INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID,
  INTERIOR_WALL_FRAME_TILES,
} from "@/project/tilesetHarness";
import type { AutotileGroup, TilesetDef } from "@/project/types";

type MapView = { width: number; height: number; lowerTiles: number[] };

function mapFromRows(rows: readonly (readonly number[])[]): MapView {
  return { width: rows[0]?.length ?? 0, height: rows.length, lowerTiles: rows.flatMap((row) => [...row]) };
}

function at(map: MapView, x: number, y: number): number {
  return map.lowerTiles[y * map.width + x]!;
}

function wallFrameGroup(tileset: TilesetDef | undefined): AutotileGroup | undefined {
  return tileset?.autotileGroups?.find((group) => group.id === INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID);
}

describe("interior wall-frame autotile harness", () => {
  it("seeds the wall-frame autotile group on interior tilesets via blank project / ensure / apply", () => {
    const project = createBlankProject();
    const interior = project.tilesets.easyrpg_chipset_interior;
    const seeded = wallFrameGroup(interior);

    expect(seeded).toBeDefined();
    expect(seeded).toMatchObject({
      id: INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID,
      neighborhood: 4,
      name: "실내 벽 프레임",
    });
    expect(seeded?.memberTileIds).toEqual(expect.arrayContaining([
      INTERIOR_WALL_FRAME_TILES.body,
      INTERIOR_WALL_FRAME_TILES.edgeN,
      INTERIOR_WALL_FRAME_TILES.edgeS,
      INTERIOR_WALL_FRAME_TILES.edgeW,
      INTERIOR_WALL_FRAME_TILES.edgeE,
      INTERIOR_WALL_FRAME_TILES.cornerNW,
      104,
      106,
      396,
      398,
      456,
      458,
    ]));
    expect(seeded?.memberTileIds).not.toContain(72);
    expect(seeded?.variantMap[String(0)]).toBe(INTERIOR_WALL_FRAME_TILES.cornerNW);
    expect(autotileGroupsForTileset(interior).length).toBeGreaterThanOrEqual(1);

    // Re-apply keeps the builtin group and does not clobber user-defined groups.
    const custom: AutotileGroup = {
      id: "user_custom_autotile",
      name: "user",
      memberTileIds: [1],
      variantMap: { "0": 1 },
    };
    interior.autotileGroups = [custom, ...(interior.autotileGroups ?? [])];
    expect(applyEasyRpgThemeMetadataPacks(interior)).toBe(false);
    ensureTilesetHarnesses(project);
    expect(wallFrameGroup(interior)?.id).toBe(INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID);
    expect(interior.autotileGroups?.some((group) => group.id === "user_custom_autotile")).toBe(true);
    expect(interior.autotileGroups?.filter((group) => group.id === INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID)).toHaveLength(1);
  });

  it("does not seed wall-frame autotile on dungeon tilesets", () => {
    const dungeon = createBlankProject().tilesets.easyrpg_chipset_dungeon;
    expect(wallFrameGroup(dungeon)).toBeUndefined();
    expect(autotileGroupsForTileset(dungeon)).toHaveLength(0);
  });

  it("shapeAutotileGroupAround turns a hollow ring of body tiles into outer edges/corners", () => {
    const body = INTERIOR_WALL_FRAME_TILES.body;
    const floor = 72;
    // 1-tile hollow ring: outer corners + N/W/E edges reshape; bottom mid is dual-missing (N+S)
    // so the 4-dir edgeCorner priority yields edgeN (same as prototype engine behavior).
    const map = mapFromRows([
      [body, body, body, body, body],
      [body, floor, floor, floor, body],
      [body, floor, floor, floor, body],
      [body, floor, floor, floor, body],
      [body, body, body, body, body],
    ]);
    const group = createInteriorWallFrameAutotileGroup();
    const points: { x: number; y: number }[] = [];
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (at(map, x, y) === body) points.push({ x, y });
      }
    }

    shapeAutotileGroupAround(map, group, points);

    expect(at(map, 0, 0)).toBe(INTERIOR_WALL_FRAME_TILES.cornerNW);
    expect(at(map, 4, 0)).toBe(INTERIOR_WALL_FRAME_TILES.cornerNE);
    expect(at(map, 0, 4)).toBe(INTERIOR_WALL_FRAME_TILES.cornerSW);
    expect(at(map, 4, 4)).toBe(INTERIOR_WALL_FRAME_TILES.cornerSE);
    expect(at(map, 2, 0)).toBe(INTERIOR_WALL_FRAME_TILES.edgeN);
    expect(at(map, 2, 4)).toBe(INTERIOR_WALL_FRAME_TILES.edgeS);
    expect(at(map, 0, 2)).toBe(INTERIOR_WALL_FRAME_TILES.edgeW);
    expect(at(map, 4, 2)).toBe(INTERIOR_WALL_FRAME_TILES.edgeE);
    // Floor is connect-only: stays painted as floor, not rewritten as wall.
    expect(at(map, 2, 2)).toBe(floor);

    // Filled wall block: true outer S edge when the north neighbor is still wall body.
    const filled = mapFromRows([
      [body, body, body],
      [body, body, body],
      [body, body, body],
    ]);
    const filledPoints = [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
      { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
      { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 },
    ];
    shapeAutotileGroupAround(filled, group, filledPoints);
    expect(at(filled, 0, 0)).toBe(INTERIOR_WALL_FRAME_TILES.cornerNW);
    expect(at(filled, 2, 0)).toBe(INTERIOR_WALL_FRAME_TILES.cornerNE);
    expect(at(filled, 0, 2)).toBe(INTERIOR_WALL_FRAME_TILES.cornerSW);
    expect(at(filled, 2, 2)).toBe(INTERIOR_WALL_FRAME_TILES.cornerSE);
    expect(at(filled, 1, 0)).toBe(INTERIOR_WALL_FRAME_TILES.edgeN);
    expect(at(filled, 1, 2)).toBe(INTERIOR_WALL_FRAME_TILES.edgeS);
    expect(at(filled, 0, 1)).toBe(INTERIOR_WALL_FRAME_TILES.edgeW);
    expect(at(filled, 2, 1)).toBe(INTERIOR_WALL_FRAME_TILES.edgeE);
    expect(at(filled, 1, 1)).toBe(INTERIOR_WALL_FRAME_TILES.body);
  });

  it("re-seeds the wall-frame group when missing after ensureTilesetHarnesses", () => {
    const project = createBlankProject();
    const interior = project.tilesets.easyrpg_chipset_interior;
    interior.autotileGroups = [];
    expect(wallFrameGroup(interior)).toBeUndefined();

    expect(ensureTilesetHarnesses(project)).toBe(true);
    expect(wallFrameGroup(interior)?.id).toBe(INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID);
    expect(autotileGroupsForTileset(interior).length).toBeGreaterThanOrEqual(1);
  });
});
