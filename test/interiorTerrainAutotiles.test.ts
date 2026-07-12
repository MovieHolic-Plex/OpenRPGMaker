import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import {
  createInteriorTerrainAutotileGroups,
  INTERIOR_TERRAIN_AUTOTILE_PREFIX,
} from "@/project/defaults/interiorTerrainAutotiles";
import { applyEasyRpgThemeMetadataPacks } from "@/project/tilesetHarness";

describe("interior terrain autotiles (RM2k3 blocks ×6)", () => {
  it("블랭크 프로젝트의 실내 타일셋에 지형/카펫 그룹 9종이 시드된다 (재적용은 idempotent)", () => {
    const interior = createBlankProject().tilesets.easyrpg_chipset_interior;
    const ids = (interior.autotileGroups ?? []).map((group) => group.id);
    for (const key of ["hedge", "mound", "dirt", "deck", "cobble", "teal-carpet", "sand", "dark-grass", "red-carpet"]) {
      expect(ids).toContain(`${INTERIOR_TERRAIN_AUTOTILE_PREFIX}${key}`);
    }
    expect(applyEasyRpgThemeMetadataPacks(interior)).toBe(false);
  });

  it("붉은 카펫(9-슬라이스): 고립/오목은 몸통 406으로 폴백, 3×3 성형은 정상", () => {
    const group = createInteriorTerrainAutotileGroups().find((g) => g.id.endsWith("red-carpet"))!;
    const W = 7;
    const H = 7;
    const BODY = 406;
    const map = { width: W, height: H, lowerTiles: new Array(W * H).fill(72) };
    const points: { x: number; y: number }[] = [];
    for (let y = 2; y <= 4; y += 1) {
      for (let x = 2; x <= 4; x += 1) {
        map.lowerTiles[y * W + x] = BODY;
        points.push({ x, y });
      }
    }
    map.lowerTiles[1 * W + 6] = BODY; // 외딴 1칸 → 몸통 406 유지
    points.push({ x: 6, y: 1 });
    shapeAutotileGroupAround(map, group, points);
    const at = (x: number, y: number) => map.lowerTiles[y * W + x];
    expect(at(2, 2)).toBe(375); // NW
    expect(at(3, 2)).toBe(376); // N
    expect(at(4, 4)).toBe(437); // SE
    expect(at(3, 3)).toBe(406); // 몸통
    expect(at(6, 1)).toBe(406); // 고립 = 몸통 폴백 (사용자 결정)
    // 계단(465~467)은 카펫 그룹 멤버가 아니다
    expect(group.memberTileIds).not.toContain(465);
    expect(group.memberTileIds).not.toContain(466);
    expect(group.memberTileIds).not.toContain(467);
  });

  it("청록 카펫: 몸통 브러시 blob이 테두리/코너로 성형되고 1칸은 고립, 구멍 주변은 오목", () => {
    const group = createInteriorTerrainAutotileGroups().find((g) => g.id.endsWith("teal-carpet"))!;
    const W = 9;
    const H = 9;
    const BODY = 310;
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
    expect(at(2, 2)).toBe(279); //   NW 코너
    expect(at(5, 2)).toBe(281); //   NE 코너
    expect(at(2, 5)).toBe(339); //   SW 코너
    expect(at(5, 5)).toBe(341); //   SE 코너
    expect(at(4, 2)).toBe(280); //   북 변
    expect(at(2, 4)).toBe(309); //   서 변
    expect(at(4, 4)).toBe(251); //   구멍 대각 → 오목 코너 소스
    expect(at(7, 1)).toBe(249); //   고립 1칸
  });

  it("산울타리: 몸통 421 blob의 변/모서리 성형", () => {
    const group = createInteriorTerrainAutotileGroups().find((g) => g.id.endsWith("hedge"))!;
    const W = 7;
    const H = 7;
    const BODY = 421;
    const map = { width: W, height: H, lowerTiles: new Array(W * H).fill(271) };
    const points: { x: number; y: number }[] = [];
    for (let y = 2; y <= 4; y += 1) {
      for (let x = 2; x <= 4; x += 1) {
        map.lowerTiles[y * W + x] = BODY;
        points.push({ x, y });
      }
    }
    shapeAutotileGroupAround(map, group, points);
    const at = (x: number, y: number) => map.lowerTiles[y * W + x];
    expect(at(2, 2)).toBe(390);
    expect(at(3, 2)).toBe(391);
    expect(at(4, 2)).toBe(392);
    expect(at(3, 3)).toBe(421);
    expect(at(3, 4)).toBe(451);
  });
});
