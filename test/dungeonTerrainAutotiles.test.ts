import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import {
  createDungeonTerrainAutotileGroups,
  DUNGEON_TERRAIN_AUTOTILE_PREFIX,
} from "@/project/defaults/dungeonTerrainAutotiles";
import { applyEasyRpgThemeMetadataPacks } from "@/project/tilesetHarness";

describe("dungeon terrain autotiles (RM2k3 blocks ×12 + 카펫)", () => {
  it("블랭크 프로젝트의 던전 타일셋에 지형 그룹 13종이 시드된다 (재적용은 idempotent)", () => {
    const dungeon = createBlankProject().tilesets.easyrpg_chipset_dungeon;
    const ids = (dungeon.autotileGroups ?? []).map((group) => group.id);
    for (const key of [
      "stone", "chasm", "redrock", "lava", "pit-pale", "pit-gold",
      "snow", "ice", "dirt", "moss", "abyss-blue", "abyss-gray", "red-carpet",
    ]) {
      expect(ids).toContain(`${DUNGEON_TERRAIN_AUTOTILE_PREFIX}${key}`);
    }
    expect(applyEasyRpgThemeMetadataPacks(dungeon)).toBe(false);
  });

  it("용암: 몸통 304 blob이 변/모서리로 성형되고 1칸은 고립 243, 구멍 주변은 오목 245", () => {
    const group = createDungeonTerrainAutotileGroups().find((g) => g.id.endsWith("lava"))!;
    const W = 9;
    const H = 9;
    const BODY = 304;
    const map = { width: W, height: H, lowerTiles: new Array(W * H).fill(271) };
    const points: { x: number; y: number }[] = [];
    // 4×4 blob + 외딴 1칸
    for (let y = 2; y <= 5; y += 1) {
      for (let x = 2; x <= 5; x += 1) {
        map.lowerTiles[y * W + x] = BODY;
        points.push({ x, y });
      }
    }
    map.lowerTiles[1 * W + 7] = BODY;
    points.push({ x: 7, y: 1 });
    // 구멍(오목 코너 유발)
    map.lowerTiles[3 * W + 3] = 271;
    shapeAutotileGroupAround(map, group, points);

    const at = (x: number, y: number) => map.lowerTiles[y * W + x];
    expect(at(2, 2)).toBe(273); //   NW 코너
    expect(at(5, 2)).toBe(275); //   NE 코너
    expect(at(2, 5)).toBe(333); //   SW 코너
    expect(at(5, 5)).toBe(335); //   SE 코너
    expect(at(4, 2)).toBe(274); //   북 변
    expect(at(2, 4)).toBe(303); //   서 변
    expect(at(4, 4)).toBe(245); //   구멍 대각 → 오목 코너 소스
    expect(at(7, 1)).toBe(243); //   고립 1칸
    // 바탕 칸(적암 244)은 멤버가 아니다
    expect(group.memberTileIds).not.toContain(244);
  });

  it("붉은 카펫(9-슬라이스): 고립/오목은 몸통 169로 폴백, 3×3 성형은 정상", () => {
    const group = createDungeonTerrainAutotileGroups().find((g) => g.id.endsWith("red-carpet"))!;
    const W = 7;
    const H = 7;
    const BODY = 169;
    const map = { width: W, height: H, lowerTiles: new Array(W * H).fill(157) };
    const points: { x: number; y: number }[] = [];
    for (let y = 2; y <= 4; y += 1) {
      for (let x = 2; x <= 4; x += 1) {
        map.lowerTiles[y * W + x] = BODY;
        points.push({ x, y });
      }
    }
    map.lowerTiles[1 * W + 6] = BODY; // 외딴 1칸 → 몸통 169 유지
    points.push({ x: 6, y: 1 });
    shapeAutotileGroupAround(map, group, points);
    const at = (x: number, y: number) => map.lowerTiles[y * W + x];
    expect(at(2, 2)).toBe(138); // NW
    expect(at(3, 2)).toBe(139); // N
    expect(at(4, 4)).toBe(200); // SE
    expect(at(3, 3)).toBe(169); // 몸통
    expect(at(6, 1)).toBe(169); // 고립 = 몸통 폴백
    // 계단(228~230)은 카펫 그룹 멤버가 아니다
    expect(group.memberTileIds).not.toContain(228);
    expect(group.memberTileIds).not.toContain(229);
    expect(group.memberTileIds).not.toContain(230);
  });

  it("호스트 지형은 오버레이 블록을 연결로 본다 (흙→이끼: 이끼 옆 흙은 몸통 유지)", () => {
    const groups = createDungeonTerrainAutotileGroups();
    const dirt = groups.find((g) => g.id.endsWith("-dirt"))!;
    const moss = groups.find((g) => g.id.endsWith("-moss"))!;
    // 이끼 바탕 아트 = 흙이므로 전환 테두리는 이끼 쪽이 그린다 — 흙은 이끼를 연결로 취급.
    for (const tile of moss.memberTileIds) expect(dirt.connectTileIds).toContain(tile);
    expect(moss.connectTileIds).not.toContain(421); // 역방향은 아니다(이끼는 흙 옆에서 테두리를 그린다)

    // 흙밭 한가운데 이끼를 얹고 흙을 재성형해도 이끼 인접 흙은 몸통(421)을 유지한다.
    const W = 7;
    const H = 7;
    const map = { width: W, height: H, lowerTiles: new Array(W * H).fill(421) };
    map.lowerTiles[3 * W + 3] = 424; // 중앙 이끼 몸통
    const points: { x: number; y: number }[] = [];
    for (let y = 1; y <= 5; y += 1) for (let x = 1; x <= 5; x += 1) points.push({ x, y });
    shapeAutotileGroupAround(map, dirt, points);
    expect(map.lowerTiles[3 * W + 2]).toBe(421);
    expect(map.lowerTiles[2 * W + 3]).toBe(421);
    expect(map.lowerTiles[2 * W + 2]).toBe(421);
  });

  it("심연(푸른 테두리): 몸통 427 blob의 변/모서리 성형", () => {
    const group = createDungeonTerrainAutotileGroups().find((g) => g.id.endsWith("abyss-blue"))!;
    const W = 7;
    const H = 7;
    const BODY = 427;
    const map = { width: W, height: H, lowerTiles: new Array(W * H).fill(157) };
    const points: { x: number; y: number }[] = [];
    for (let y = 2; y <= 4; y += 1) {
      for (let x = 2; x <= 4; x += 1) {
        map.lowerTiles[y * W + x] = BODY;
        points.push({ x, y });
      }
    }
    shapeAutotileGroupAround(map, group, points);
    const at = (x: number, y: number) => map.lowerTiles[y * W + x];
    expect(at(2, 2)).toBe(396); // NW
    expect(at(3, 2)).toBe(397); // N
    expect(at(4, 2)).toBe(398); // NE
    expect(at(3, 3)).toBe(427); // 몸통
    expect(at(3, 4)).toBe(457); // 남 변
  });

  it("던전 하네스 그룹은 타일 중복 없이 시드된다 (재적용 idempotency 전제)", () => {
    const dungeon = createBlankProject().tilesets.easyrpg_chipset_dungeon;
    const seen = new Map<number, string>();
    for (const group of dungeon.tileGroups ?? []) {
      for (const tile of group.tileIds) {
        expect(seen.has(tile), `tile ${tile} in ${seen.get(tile)} and ${group.id}`).toBe(false);
        seen.set(tile, group.id);
      }
    }
    // 물(1)은 통행 불가, 적암 바닥(270)은 통행 가능 계약
    expect(dungeon.passability[1]).toEqual({ up: false, down: false, left: false, right: false });
    expect(dungeon.passability[270]).toEqual({ up: true, down: true, left: true, right: true });
    // 투명 배경 소품은 상위 레이어
    expect(dungeon.priority[262]).toBe("upper");
    expect(dungeon.priority[327]).toBe("upper");
  });
});
