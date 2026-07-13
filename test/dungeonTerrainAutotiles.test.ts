import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import {
  createDungeonTerrainAutotileGroups,
  DUNGEON_TERRAIN_AUTOTILE_PREFIX,
} from "@/project/defaults/dungeonTerrainAutotiles";
import { applyEasyRpgThemeMetadataPacks } from "@/project/tilesetHarness";

describe("dungeon terrain autotiles (RM2k3 blocks ×13)", () => {
  it("블랭크 프로젝트의 던전 타일셋에 지형 그룹 13종이 시드된다 (재적용은 idempotent)", () => {
    const dungeon = createBlankProject().tilesets.easyrpg_chipset_dungeon;
    const ids = (dungeon.autotileGroups ?? []).map((group) => group.id);
    for (const key of [
      "cave-floor", "lava-rock", "dirt", "moss", "ice", "ice-crystal",
      "lava-pool", "pit-cave", "pit-brown", "pit-dark", "pit-grey", "snow", "abyss-glow",
    ]) {
      expect(ids).toContain(`${DUNGEON_TERRAIN_AUTOTILE_PREFIX}${key}`);
    }
    expect(applyEasyRpgThemeMetadataPacks(dungeon)).toBe(false);
  });

  it("동굴 구덩이(c9r4): 몸통 190 blob이 테두리/코너로 성형되고 1칸은 고립", () => {
    const group = createDungeonTerrainAutotileGroups().find((g) => g.id.endsWith("pit-cave"))!;
    const W = 7, H = 7, BODY = 190;
    const map = { width: W, height: H, lowerTiles: new Array(W * H).fill(126) };
    const points: { x: number; y: number }[] = [];
    for (let y = 2; y <= 4; y += 1) {
      for (let x = 2; x <= 4; x += 1) {
        map.lowerTiles[y * W + x] = BODY;
        points.push({ x, y });
      }
    }
    map.lowerTiles[1 * W + 6] = BODY; // 외딴 1칸 → 고립
    points.push({ x: 6, y: 1 });
    shapeAutotileGroupAround(map, group, points);
    const at = (x: number, y: number) => map.lowerTiles[y * W + x];
    expect(at(2, 2)).toBe(159); // NW
    expect(at(3, 2)).toBe(160); // N
    expect(at(4, 2)).toBe(161); // NE
    expect(at(2, 3)).toBe(189); // W
    expect(at(3, 3)).toBe(190); // 몸통
    expect(at(4, 4)).toBe(221); // SE
    expect(at(6, 1)).toBe(129); // 고립 (블록 윗줄 좌)
  });

  it("푸른 발광 심연(366 브러시, 4방): blob이 글로우 테두리/코너로 성형", () => {
    const group = createDungeonTerrainAutotileGroups().find((g) => g.id.endsWith("abyss-glow"))!;
    expect(group.neighborhood).toBe(4);
    const W = 6, H = 6, BODY = 366;
    const map = { width: W, height: H, lowerTiles: new Array(W * H).fill(187) };
    const points: { x: number; y: number }[] = [];
    for (let y = 1; y <= 3; y += 1) {
      for (let x = 1; x <= 3; x += 1) {
        map.lowerTiles[y * W + x] = BODY;
        points.push({ x, y });
      }
    }
    shapeAutotileGroupAround(map, group, points);
    const at = (x: number, y: number) => map.lowerTiles[y * W + x];
    expect(at(1, 1)).toBe(368); // NW
    expect(at(2, 1)).toBe(367); // N
    expect(at(3, 1)).toBe(369); // NE
    expect(at(1, 2)).toBe(396); // W
    expect(at(2, 2)).toBe(366); // 몸통
    expect(at(3, 2)).toBe(398); // E
    expect(at(1, 3)).toBe(426); // SW
    expect(at(2, 3)).toBe(427); // S
    expect(at(3, 3)).toBe(428); // SE
  });
});
