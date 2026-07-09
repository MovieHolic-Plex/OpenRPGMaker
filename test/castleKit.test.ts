import { describe, expect, it } from "vitest";
import {
  CASTLE_ROUND_TOWER,
  CASTLE_ROOF,
  CASTLE_WALL,
  paintRoundTower,
  paintRoofDeck,
  paintWallFaceColumn,
  stampCastle,
} from "@/editor/castleKit";
import { TILE } from "@/project/defaults/constants";
import { createBlankProject } from "@/project/defaults";
import { getTool } from "@/editor/tools/toolRegistry";
import type { GameMap } from "@/project/types";

function blankMap(w = 48, h = 40): GameMap {
  const size = w * h;
  return {
    id: "map_test_castle",
    name: "test",
    width: w,
    height: h,
    tilesetId: "easyrpg_chipset_combined_town",
    tileSize: 16,
    lowerTiles: new Array(size).fill(TILE.GRASS),
    upperTiles: new Array(size).fill(TILE.EMPTY),
    events: [],
  };
}

describe("castleKit modules", () => {
  it("paints roof deck corners and stretch edges", () => {
    const map = blankMap();
    paintRoofDeck(map, 2, 2, 6, 4);
    expect(map.lowerTiles[2 * map.width + 2]).toBe(CASTLE_ROOF.TL);
    expect(map.lowerTiles[2 * map.width + 7]).toBe(CASTLE_ROOF.TR);
    expect(map.lowerTiles[5 * map.width + 2]).toBe(CASTLE_ROOF.BL);
    expect(map.lowerTiles[5 * map.width + 7]).toBe(CASTLE_ROOF.BR);
    expect(map.lowerTiles[2 * map.width + 4]).toBe(CASTLE_ROOF.T);
    expect(map.lowerTiles[5 * map.width + 4]).toBe(CASTLE_ROOF.B);
  });

  it("paints wall face 21/51/81 column", () => {
    const map = blankMap();
    paintWallFaceColumn(map, 5, 10, 3);
    expect(map.lowerTiles[10 * map.width + 5]).toBe(CASTLE_WALL.TOP);
    expect(map.lowerTiles[11 * map.width + 5]).toBe(CASTLE_WALL.MID);
    expect(map.lowerTiles[12 * map.width + 5]).toBe(CASTLE_WALL.BOT);
  });

  it("paints 2-wide round tower with window row and upper caps", () => {
    const map = blankMap();
    paintRoundTower(map, 10, 8, 7);
    expect(map.upperTiles[8 * map.width + 10]).toBe(CASTLE_ROUND_TOWER.CAP_L);
    expect(map.upperTiles[8 * map.width + 11]).toBe(CASTLE_ROUND_TOWER.CAP_R);
    expect(map.lowerTiles[9 * map.width + 10]).toBe(CASTLE_ROUND_TOWER.NECK_L);
    // body/window somewhere in middle
    const mids = [10, 11, 12, 13].map((y) => map.lowerTiles[y * map.width + 10]);
    expect(mids).toContain(CASTLE_ROUND_TOWER.WIN_L);
    expect(mids).toContain(CASTLE_ROUND_TOWER.BODY_L);
    expect(map.upperTiles[14 * map.width + 10]).toBe(CASTLE_ROUND_TOWER.BASE_L);
    expect(map.upperTiles[14 * map.width + 11]).toBe(CASTLE_ROUND_TOWER.BASE_R);
  });

  it("stamps full castle with grass courtyard and south gate gap", () => {
    const map = blankMap(48, 40);
    const result = stampCastle(map, { area: { x: 0, y: 0, w: 48, h: 40 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stats.roofCells).toBeGreaterThan(50);
    expect(result.stats.wallCells).toBeGreaterThan(20);
    expect(result.roundTowerAt).not.toBeNull();
    // courtyard center grass
    const cx = result.courtyard.x + Math.floor(result.courtyard.w / 2);
    const cy = result.courtyard.y + Math.floor(result.courtyard.h / 2);
    expect(map.lowerTiles[cy * map.width + cx]).toBe(TILE.GRASS);
    // gate gap open
    const gx = result.gate.x + 1;
    const gy = result.gate.y + 1;
    const gateTile = map.lowerTiles[gy * map.width + gx]!;
    expect([TILE.GRASS, 423, 424, 425, 393, 394, 453, 454, 455]).toContain(gateTile);
  });
});

describe("build_castle tool", () => {
  it("is registered and creates a castle map", () => {
    const tool = getTool("build_castle");
    expect(tool).toBeDefined();
    const project = createBlankProject();
    const result = tool!.run(project, {
      id: "map_castle_unit",
      name: "유닛성채",
      width: 48,
      height: 40,
      seed: 99,
      npcs: false,
      path: false,
    });
    expect(result.summary).toMatch(/성채 시공/);
    const map = project.maps.map_castle_unit;
    expect(map).toBeDefined();
    expect(map!.width).toBe(48);
    // roof tile present
    expect(map!.lowerTiles.some((t) => t === CASTLE_ROOF.T || t === CASTLE_ROOF.FILL_DARK)).toBe(true);
    // wall face present
    expect(map!.lowerTiles.some((t) => t === CASTLE_WALL.MID)).toBe(true);
    // round tower window
    expect(map!.lowerTiles.some((t) => t === CASTLE_ROUND_TOWER.WIN_L)).toBe(true);
  });
});
