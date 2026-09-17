import { describe, expect, it } from "vitest";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults";
import { createDbExtractedHouseTemplateMap } from "@/editor/content/townShowcaseMaps";

describe("DB-extracted user house template", () => {
  it("keeps fence and windows on upper while door and walls stay lower", () => {
    const map = createDbExtractedHouseTemplateMap();
    const at = (x: number, y: number): number => y * map.width + x;
    const upperCount = map.upperTiles.filter((tile) => tile >= 0).length;

    expect(map.name).toBe("DB 추출 사용자 집 템플릿");
    expect(map.width).toBe(16);
    expect(map.height).toBe(15);
    expect(map.tilesetId).toBe(DEFAULT_TILESET_ID);
    expect(upperCount).toBe(58);

    expect(map.lowerTiles[at(0, 0)]).toBe(TILE.GRASS);
    expect(map.lowerTiles[at(1, 1)]).toBe(TILE.GRASS);
    expect(map.upperTiles[at(1, 1)]).toBe(378);
    expect(map.upperTiles[at(15, 1)]).toBe(380);
    expect(map.upperTiles[at(1, 13)]).toBe(438);
    expect(map.upperTiles[at(7, 13)]).toBe(439);

    expect(map.upperTiles[at(4, 3)]).toBe(354);
    expect(map.upperTiles[at(13, 3)]).toBe(355);
    expect(map.upperTiles[at(4, 7)]).toBe(384);
    expect(map.upperTiles[at(13, 5)]).toBe(385);
    expect(map.upperTiles[at(8, 6)]).toBe(377);

    expect(map.lowerTiles[at(5, 3)]).toBe(404);
    expect(map.lowerTiles[at(8, 5)]).toBe(375);
    expect(map.lowerTiles[at(9, 6)]).toBe(15);
    expect(map.lowerTiles[at(13, 8)]).toBe(77);
    expect(map.lowerTiles[at(5, 9)]).toBe(46);
    expect(map.lowerTiles[at(7, 9)]).toBe(46);
    expect(map.lowerTiles[at(10, 7)]).toBe(46);
    expect(map.upperTiles[at(5, 9)]).toBe(87);
    expect(map.upperTiles[at(7, 9)]).toBe(87);
    expect(map.upperTiles[at(10, 7)]).toBe(87);
    expect(map.lowerTiles[at(12, 7)]).toBe(329);
    expect(map.lowerTiles[at(12, 8)]).toBe(359);
    expect(map.upperTiles[at(12, 7)]).toBe(TILE.EMPTY);
    expect(map.upperTiles[at(12, 8)]).toBe(TILE.EMPTY);
  });
});
