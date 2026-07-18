import { beforeEach, describe, expect, it } from "vitest";
import {
  createDarkWallAutotileGroup,
  DARK_WALL_AUTOTILE_GROUP_ID,
  DARK_WALL_TILE,
  isDarkWallTile,
  paintDarkWallAndShape,
} from "@/project/defaults/darkWallAutotile";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { createBlankProject } from "@/project/defaults";
import { ensureInteriorRoomHarness, INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { paintTile, paintTilesBulk } from "@/editor/tileActions";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";

type MapView = { width: number; height: number; lowerTiles: number[] };

const VOID = 430;
const F = 72;
const B = DARK_WALL_TILE.BODY;

function mapFromRows(rows: readonly (readonly number[])[]): MapView {
  return { width: rows[0]?.length ?? 0, height: rows.length, lowerTiles: rows.flatMap((r) => [...r]) };
}

function at(map: MapView, x: number, y: number): number {
  return map.lowerTiles[y * map.width + x]!;
}

function membersOf(map: MapView): { x: number; y: number }[] {
  const group = createDarkWallAutotileGroup();
  const set = new Set(group.memberTileIds);
  const pts: { x: number; y: number }[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (set.has(at(map, x, y)) || at(map, x, y) === B) pts.push({ x, y });
    }
  }
  return pts;
}

/**
 * Option B: paint brush 366; store stays 366 (render quarters only).
 */
describe("dark wall 366 autotile", () => {
  const group = createDarkWallAutotileGroup();

  it("exposes 366 as the body/brush tile", () => {
    expect(DARK_WALL_TILE.BODY).toBe(366);
    expect(group.memberTileIds).toContain(366);
    expect(group.connectTileIds).toContain(72); // floor connect-only
    expect(group.id).toBe(DARK_WALL_AUTOTILE_GROUP_ID);
  });

  it("2×2 of body 366 stays 366 after reshape", () => {
    const map = mapFromRows([
      [B, B],
      [B, B],
    ]);
    shapeAutotileGroupAround(map, group, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
    expect(at(map, 0, 0)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 1, 0)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 0, 1)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 1, 1)).toBe(DARK_WALL_TILE.BODY);
  });

  it("ring of 366 around floor 72 stays all 366 after reshape", () => {
    const map = mapFromRows([
      [VOID, VOID, VOID, VOID, VOID],
      [VOID, B, B, B, VOID],
      [VOID, B, F, B, VOID],
      [VOID, B, B, B, VOID],
      [VOID, VOID, VOID, VOID, VOID],
    ]);
    const pts: { x: number; y: number }[] = [];
    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        if (at(map, x, y) === B) pts.push({ x, y });
      }
    }
    shapeAutotileGroupAround(map, group, pts);

    expect(at(map, 2, 1)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 1, 2)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 3, 2)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 2, 3)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 1, 1)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 3, 1)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 1, 3)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 3, 3)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 2, 2)).toBe(F);
  });

  it("horizontal strip of 366: ends are outer corners, mid is body or N/S edge", () => {
    // 1-row strip on void: missing N+S → prefers corner rules on ends
    const map = mapFromRows([[VOID, B, B, B, VOID]]);
    shapeAutotileGroupAround(map, group, [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
    // ends missing W or E plus N/S → SW/SE or NW/NE depending priority (N+W first)
    expect(at(map, 1, 0)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 3, 0)).toBe(DARK_WALL_TILE.BODY);
    // mid: missing N+S, has W+E → edgeN wins (missingNorth checked first among edges)
    expect(at(map, 2, 0)).toBe(DARK_WALL_TILE.BODY);
  });

  it("vertical strip of 366: ends corners, mid W/E edge", () => {
    const map = mapFromRows([
      [VOID],
      [B],
      [B],
      [B],
      [VOID],
    ]);
    shapeAutotileGroupAround(map, group, [
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 0, y: 3 },
    ]);
    expect(at(map, 0, 1)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 0, 3)).toBe(DARK_WALL_TILE.BODY);
    // mid: missing E+W, has N+S → edgeW first among remaining
    expect(at(map, 0, 2)).toBe(DARK_WALL_TILE.BODY);
  });

  it("L-shape of 366 gets outer corner at the bend and free ends", () => {
    //   B B B
    //   B
    //   B
    const map = mapFromRows([
      [VOID, VOID, VOID, VOID],
      [VOID, B, B, B],
      [VOID, B, VOID, VOID],
      [VOID, B, VOID, VOID],
      [VOID, VOID, VOID, VOID],
    ]);
    const pts = membersOf(map);
    shapeAutotileGroupAround(map, group, pts);
    // bend at (1,1): has E+S, missing N+W → NW corner
    expect(at(map, 1, 1)).toBe(DARK_WALL_TILE.BODY);
    // east tip (3,1): has W, missing N+E+S → NW? missing N+E → NE
    expect(at(map, 3, 1)).toBe(DARK_WALL_TILE.BODY);
    // south tip (1,3): has N, missing S+W+E → SW (missing S+W)
    expect(at(map, 1, 3)).toBe(DARK_WALL_TILE.BODY);
  });

  it("U-room open south: north wall edges, SW/SE corners at open mouth", () => {
    //   B B B
    //   B   B
    //   B   B
    const map = mapFromRows([
      [VOID, VOID, VOID, VOID, VOID],
      [VOID, B, B, B, VOID],
      [VOID, B, F, B, VOID],
      [VOID, B, F, B, VOID],
      [VOID, VOID, VOID, VOID, VOID],
    ]);
    const pts: { x: number; y: number }[] = [];
    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        if (at(map, x, y) === B) pts.push({ x, y });
      }
    }
    shapeAutotileGroupAround(map, group, pts);
    expect(at(map, 1, 1)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 3, 1)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 2, 1)).toBe(DARK_WALL_TILE.BODY);
    // open-mouth bottom of U sides
    expect(at(map, 1, 3)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 3, 3)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 2, 2)).toBe(F);
    expect(at(map, 2, 3)).toBe(F);
  });

  it("doorway gap in south wall: door floor stays, jambs get edges/corners", () => {
    // full ring except south mid is floor (door)
    const map = mapFromRows([
      [VOID, VOID, VOID, VOID, VOID],
      [VOID, B, B, B, VOID],
      [VOID, B, F, B, VOID],
      [VOID, B, F, B, VOID], // door at (2,3)
      [VOID, VOID, VOID, VOID, VOID],
    ]);
    const pts: { x: number; y: number }[] = [];
    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        if (at(map, x, y) === B) pts.push({ x, y });
      }
    }
    shapeAutotileGroupAround(map, group, pts);
    expect(at(map, 2, 3)).toBe(F);
    // jambs at (1,3) and (3,3)
    expect(isDarkWallTile(at(map, 1, 3))).toBe(true);
    expect(isDarkWallTile(at(map, 3, 3))).toBe(true);
    expect(at(map, 1, 3)).toBe(B); // should not stay raw body if mask incomplete
  });

  it("paintDarkWallAndShape paints 366 then reshapes", () => {
    const map: MapView = {
      width: 3,
      height: 3,
      lowerTiles: [VOID, VOID, VOID, VOID, VOID, VOID, VOID, VOID, VOID],
    };
    paintDarkWallAndShape(map as never, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
    expect(at(map, 0, 0)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 1, 0)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 0, 1)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 1, 1)).toBe(DARK_WALL_TILE.BODY);
  });

  it("isolated 366 becomes outer corner (missing all dirs → cornerNW mapping)", () => {
    const map = mapFromRows([
      [VOID, VOID, VOID],
      [VOID, B, VOID],
      [VOID, VOID, VOID],
    ]);
    shapeAutotileGroupAround(map, group, [{ x: 1, y: 1 }]);
    expect(at(map, 1, 1)).toBe(DARK_WALL_TILE.BODY);
  });

  it("thick 3×3 block: center stays body, outer ring edges/corners", () => {
    const map = mapFromRows([
      [B, B, B],
      [B, B, B],
      [B, B, B],
    ]);
    const pts = [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
      { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
      { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 },
    ];
    shapeAutotileGroupAround(map, group, pts);
    expect(at(map, 1, 1)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 0, 0)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 2, 0)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 0, 2)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 2, 2)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 1, 0)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 1, 2)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 0, 1)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 2, 1)).toBe(DARK_WALL_TILE.BODY);
  });

  it("incremental paint: second cell next to first reshapes both", () => {
    const map = mapFromRows([
      [VOID, VOID, VOID],
      [VOID, VOID, VOID],
      [VOID, VOID, VOID],
    ]);
    paintDarkWallAndShape(map as never, [{ x: 1, y: 1 }]);
    expect(at(map, 1, 1)).toBe(DARK_WALL_TILE.BODY);
    paintDarkWallAndShape(map as never, [{ x: 2, y: 1 }]);
    // after neighbor added, left cell has E, right has W
    expect(at(map, 1, 1)).toBe(DARK_WALL_TILE.BODY);
    expect(at(map, 2, 1)).toBe(DARK_WALL_TILE.BODY);
    expect(isDarkWallTile(at(map, 1, 1))).toBe(true);
    expect(isDarkWallTile(at(map, 2, 1))).toBe(true);
  });
});

describe("dark wall 366 via editor paintTile path", () => {
  const mapId = "map_dark_wall_paint";

  beforeEach(() => {
    const project = createBlankProject();
    ensureInteriorRoomHarness(project);
    const tileset = project.tilesets[INTERIOR_ROOM_TILESET_ID];
    expect(tileset).toBeTruthy();
    // blank 16×16 void map on interior tileset
    const w = 8;
    const h = 8;
    const map: GameMap = {
      id: mapId,
      name: "dark wall paint test",
      width: w,
      height: h,
      tilesetId: INTERIOR_ROOM_TILESET_ID,
      tileSize: 16,
      lowerTiles: Array.from({ length: w * h }, () => VOID),
      upperTiles: Array.from({ length: w * h }, () => 0),
      events: [],
    };
    project.maps[mapId] = map;
    project.startMapId = mapId;
    store.replace(project);
  });

  it("seeds dark-wall autotile group on interior tileset", () => {
    const ts = store.getCurrent().tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const groups = autotileGroupsForTileset(ts);
    expect(groups.some((g) => g.id === DARK_WALL_AUTOTILE_GROUP_ID)).toBe(true);
    const dark = groups.find((g) => g.id === DARK_WALL_AUTOTILE_GROUP_ID)!;
    expect(dark.memberTileIds).toContain(366);
  });

  it("paintTilesBulk of 366 ring auto-connects to edges/corners", () => {
    // ring around (3,3) floor
    const floorX = 3;
    const floorY = 3;
    store.updateMap(mapId, (m) => {
      m.lowerTiles[floorY * m.width + floorX] = F;
    });
    const strokes = [
      { layer: "lower" as const, x: 2, y: 2, tile: B },
      { layer: "lower" as const, x: 3, y: 2, tile: B },
      { layer: "lower" as const, x: 4, y: 2, tile: B },
      { layer: "lower" as const, x: 2, y: 3, tile: B },
      { layer: "lower" as const, x: 4, y: 3, tile: B },
      { layer: "lower" as const, x: 2, y: 4, tile: B },
      { layer: "lower" as const, x: 3, y: 4, tile: B },
      { layer: "lower" as const, x: 4, y: 4, tile: B },
    ];
    paintTilesBulk(mapId, strokes, { autoConnect: true });
    const m = store.getCurrent().maps[mapId]!;
    const t = (x: number, y: number) => m.lowerTiles[y * m.width + x]!;
    expect(t(3, 3)).toBe(F);
    expect(t(3, 2)).toBe(DARK_WALL_TILE.BODY);
    expect(t(2, 3)).toBe(DARK_WALL_TILE.BODY);
    expect(t(4, 3)).toBe(DARK_WALL_TILE.BODY);
    expect(t(3, 4)).toBe(DARK_WALL_TILE.BODY);
    expect(t(2, 2)).toBe(DARK_WALL_TILE.BODY);
    expect(t(4, 2)).toBe(DARK_WALL_TILE.BODY);
    expect(t(2, 4)).toBe(DARK_WALL_TILE.BODY);
    expect(t(4, 4)).toBe(DARK_WALL_TILE.BODY);
  });

  it("single paintTile of 366 with autoConnect becomes corner when isolated", () => {
    paintTile(mapId, "lower", 4, 4, B, { autoConnect: true });
    const m = store.getCurrent().maps[mapId]!;
    expect(m.lowerTiles[4 * m.width + 4]).toBe(DARK_WALL_TILE.BODY);
  });

  it("RM-style: autoConnect false still reshapes 366 brush (Manual cannot suppress autotile body)", () => {
    // Root cause of "366 깔아도 오토타일 안 됨": UI default is Manual (autoConnect=false).
    // Autotile brush paint must still shape edges/corners like RM / paint_tiles tool.
    paintTile(mapId, "lower", 1, 1, B, { autoConnect: false });
    const m = store.getCurrent().maps[mapId]!;
    expect(m.lowerTiles[1 * m.width + 1]).toBe(DARK_WALL_TILE.BODY);
    expect(m.lowerTiles[1 * m.width + 1]).toBe(366);
  });

  it("blank project interior tileset seeds dark-wall group without ensureInteriorRoomHarness", () => {
    const project = createBlankProject();
    const ts = project.tilesets[INTERIOR_ROOM_TILESET_ID]!;
    const groups = autotileGroupsForTileset(ts);
    expect(groups.some((g) => g.id === DARK_WALL_AUTOTILE_GROUP_ID)).toBe(true);
  });
});
