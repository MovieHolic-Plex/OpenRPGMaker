// benchmarkGroundTruth.test.ts
// 벤치마크 ground-truth(todo 1) 계약 테스트 — TDD: 구현 전에 먼저 작성.
// .omo/plans/tileset-vision-benchmark.md todo 1의 수용 기준을 그대로 옮긴다.
//
// 핵심 방어선: 각 세트는 "파생 함수"(소스 테이블을 읽는 것이 근본 진실)와
// "리터럴 스냅샷"(현재 출력을 손으로 고정) 쌍으로 존재하고, 이 테스트가 매 실행
// 리터럴 === 파생 을 검증한다. 소스 테이블이 바뀌면 파생 출력이 바뀌고
// 리터럴이 뒤처져 실패하므로, 스냅샷 갱신이 같은 변경 안에서 강제된다.
import { describe, expect, it } from "vitest";

import {
  AUTOTILE_ANCHORS,
  AUTOTILE_GROUP_ANSWER,
  deriveAutotileAnchors,
  deriveAutotileGroupAnswer,
  deriveFenceTiles,
  deriveFloorTiles,
  deriveRoofTiles,
  deriveTrapTiles,
  deriveTreeCanopyTiles,
  deriveTreePairs,
  deriveTreeTrunkTiles,
  deriveWallTiles,
  deriveWindowTiles,
  FENCE_TILES,
  FLOOR_TILES,
  ROOF_TILES,
  TRAP_TILES,
  TREE_CANOPY_TILES,
  TREE_PAIRS,
  TREE_TRUNK_TILES,
  WALL_TILES,
  WINDOW_TILES,
} from "@/benchmark/groundTruth";
import { TERRAIN_TEMPLATE_ANCHORS } from "@/project/defaults/autotileGroups";
import { COMBINED_TOWN_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsCombinedTown";
import { COMBINED_TOWN_ROOF_BODY_TILES, COMBINED_TOWN_ROOF_OVERLAY_TILES } from "@/project/tilesetHarness/combinedTownGroups";

// 계획이 명시한 문/창문 id(todo 1: "subtract doors {329,359,116,146} and windows {87,28,58,88}").
const DOOR_TILES = [329, 359, 116, 146] as const;
const MAX_TILE_ID = 479;

function sortedIds(set: ReadonlySet<number>): number[] {
  return [...set].sort((a, b) => a - b);
}

const DIMENSION_SETS: readonly ReadonlySet<number>[] = [
  WALL_TILES,
  FLOOR_TILES,
  ROOF_TILES,
  WINDOW_TILES,
  TREE_TRUNK_TILES,
  TREE_CANOPY_TILES,
  FENCE_TILES,
  TRAP_TILES,
];

describe("benchmark ground truth", () => {
  describe("모든 세트는 비어 있지 않고 0..479 범위", () => {
    it("모든 타일 id 세트가 비어 있지 않다", () => {
      for (const set of DIMENSION_SETS) {
        expect(set.size).toBeGreaterThan(0);
      }
    });

    it("모든 타일 id가 0..479 정수다", () => {
      for (const set of DIMENSION_SETS) {
        for (const id of set) {
          expect(Number.isInteger(id)).toBe(true);
          expect(id).toBeGreaterThanOrEqual(0);
          expect(id).toBeLessThanOrEqual(MAX_TILE_ID);
        }
      }
      for (const pair of TREE_PAIRS) {
        for (const id of pair) {
          expect(Number.isInteger(id)).toBe(true);
          expect(id).toBeGreaterThanOrEqual(0);
          expect(id).toBeLessThanOrEqual(MAX_TILE_ID);
        }
      }
    });
  });

  describe("계획 수용 기준: 분리/포함 관계", () => {
    it("WALL ∩ WINDOW = ∅", () => {
      const wall = new Set(WALL_TILES);
      for (const id of WINDOW_TILES) {
        expect(wall.has(id)).toBe(false);
      }
    });

    it("WALL ∩ doors = ∅", () => {
      const wall = new Set(WALL_TILES);
      for (const id of DOOR_TILES) {
        expect(wall.has(id)).toBe(false);
      }
    });

    it("342(및 함정 246)은 FLOOR_TILES에 없다", () => {
      expect(FLOOR_TILES.has(342)).toBe(false);
      expect(FLOOR_TILES.has(246)).toBe(false);
    });

    it("ROOF ⊇ 지붕 어휘 전체(몸체 374–377 + 캡 384–387)", () => {
      for (const id of [...COMBINED_TOWN_ROOF_BODY_TILES, ...COMBINED_TOWN_ROOF_OVERLAY_TILES]) {
        expect(ROOF_TILES.has(id)).toBe(true);
      }
    });

    it("FENCE_TILES ⊆ 시맨틱 울타리 id", () => {
      const fenceSemanticIds = new Set(
        COMBINED_TOWN_TILE_SEMANTICS.filter((entry) => /울타리|fence/i.test(entry.label)).map((entry) => entry.index),
      );
      expect(fenceSemanticIds.size).toBeGreaterThan(0);
      for (const id of FENCE_TILES) {
        expect(fenceSemanticIds.has(id)).toBe(true);
      }
    });
  });

  describe("계획이 고정한 세트 내용", () => {
    it("WINDOW_TILES = {87,28,58,88}", () => {
      expect(sortedIds(WINDOW_TILES)).toEqual([28, 58, 87, 88]);
    });

    it("TRAP_TILES = {342,246,273,333,411,412,413,443}", () => {
      expect(sortedIds(TRAP_TILES)).toEqual([246, 273, 333, 342, 411, 412, 413, 443]);
    });

    it("나무 세트/페어가 계획 상수와 일치(combinedTownGroups.ts:16-23)", () => {
      expect(sortedIds(TREE_TRUNK_TILES)).toEqual([290, 291, 292, 293]);
      expect(sortedIds(TREE_CANOPY_TILES)).toEqual([260, 261, 262, 263]);
      expect(TREE_PAIRS).toEqual([
        [260, 290],
        [261, 291],
        [262, 292],
        [263, 293],
      ]);
    });

    it("FENCE_TILES = {378,379,380,408,409,410,438,439}", () => {
      expect(sortedIds(FENCE_TILES)).toEqual([378, 379, 380, 408, 409, 410, 438, 439]);
    });
  });

  describe("오토타일 정답", () => {
    it("AUTOTILE_GROUP_ANSWER는 정확히 11개 내장 그룹", () => {
      expect(AUTOTILE_GROUP_ANSWER).toHaveLength(11);
      expect(AUTOTILE_GROUP_ANSWER.map((entry) => entry.id)).toEqual([
        "builtin_dirt_road",
        "builtin_sand",
        "builtin_cobble",
        "builtin_farmland",
        "builtin_snow",
        "builtin_undergrowth",
        "builtin_tall_grass",
        "builtin_stone_court",
        "builtin_gravel_court",
        "builtin_darkness",
        "builtin_darkness_deep",
      ]);
    });

    it("AUTOTILE_GROUP_ANSWER 앵커 == TERRAIN_TEMPLATE_ANCHORS의 kind:\"group\" 항목", () => {
      const groupAnchors = TERRAIN_TEMPLATE_ANCHORS.filter((anchor) => anchor.kind === "group")
        .map((anchor) => anchor.anchor)
        .sort((a, b) => a - b);
      expect(groupAnchors).toHaveLength(11);
      expect(
        AUTOTILE_GROUP_ANSWER.map((entry) => entry.anchor).sort((a, b) => a - b),
      ).toEqual(groupAnchors);
    });

    it("잔디 240은 어떤 오토타일 그룹에도 승격되지 않는다(앵커 포함)", () => {
      for (const entry of AUTOTILE_GROUP_ANSWER) {
        expect(entry.anchor).not.toBe(240);
      }
    });

    it("AUTOTILE_ANCHORS는 16개 항목, kind는 group/water/strip/base", () => {
      expect(AUTOTILE_ANCHORS).toHaveLength(16);
      for (const anchor of AUTOTILE_ANCHORS) {
        expect(["group", "water", "strip", "base"]).toContain(anchor.kind);
      }
      expect(new Set(AUTOTILE_ANCHORS.map((anchor) => anchor.anchor)).size).toBe(16);
    });
  });

  describe("리터럴 스냅샷 === 파생 함수 (stale-state 방어선)", () => {
    const cases: ReadonlyArray<[string, unknown, unknown]> = [
      ["WALL_TILES", WALL_TILES, deriveWallTiles()],
      ["FLOOR_TILES", FLOOR_TILES, deriveFloorTiles()],
      ["ROOF_TILES", ROOF_TILES, deriveRoofTiles()],
      ["WINDOW_TILES", WINDOW_TILES, deriveWindowTiles()],
      ["TREE_TRUNK_TILES", TREE_TRUNK_TILES, deriveTreeTrunkTiles()],
      ["TREE_CANOPY_TILES", TREE_CANOPY_TILES, deriveTreeCanopyTiles()],
      ["FENCE_TILES", FENCE_TILES, deriveFenceTiles()],
      ["TRAP_TILES", TRAP_TILES, deriveTrapTiles()],
      ["AUTOTILE_GROUP_ANSWER", AUTOTILE_GROUP_ANSWER, deriveAutotileGroupAnswer()],
      ["AUTOTILE_ANCHORS", AUTOTILE_ANCHORS, deriveAutotileAnchors()],
    ];

    it.each(cases)("%s 리터럴 === 파생", (_name, literal, derived) => {
      if (literal instanceof Set || derived instanceof Set) {
        const literalIds = sortedIds(literal as ReadonlySet<number>);
        const derivedIds = sortedIds(derived as ReadonlySet<number>);
        expect(derivedIds).toEqual(literalIds);
      } else {
        expect(derived).toEqual(literal);
      }
    });

    it("TREE_PAIRS 리터럴 === 파생", () => {
      expect(deriveTreePairs()).toEqual(TREE_PAIRS);
    });
  });
});
