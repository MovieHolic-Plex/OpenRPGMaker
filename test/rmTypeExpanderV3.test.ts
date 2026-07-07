// test/rmTypeExpanderV3.test.ts
// RM-TYPE 전개기 계약 테스트 (타일 툴 v3 — V3B).
// 고정하는 계약: (1) 9분할 rect 전개의 role-셀 매핑 (2) 기둥 1×N cap 규약
// (3) 최소 크기 미달 = ToolError + "다시 보낼 형식 예시" (4) 8-이웃 variantMap의
// inner corner 재계산(기존 오토타일 엔진 마스크 규약 재사용) — 전부 순수/결정론.

import { describe, expect, it } from "vitest";
import { RM_TYPE_GRAMMAR_PROFILE } from "@/editor/tools/v3/grammarProfiles";
import { buildEightNeighborVariantMap, expandRoof, expandWall, resolveAutotile } from "@/editor/tools/v3/rmTypeExpander";
import { AUTOTILE_DIR } from "@/project/defaults/autotileEngine";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import type { AutotileGroup, TileGroupMetadata, TilesetDef } from "@/project/types";

const EXAMPLE = { mapId: "map_1", rect: { x: 0, y: 0, w: 4, h: 4 }, wallVocabId: "wall" };

function tileset(): TilesetDef {
  return createBlankProject().tilesets[DEFAULT_TILESET_ID];
}

function nineSliceWall(def: TilesetDef): TileGroupMetadata {
  const group = def.tileGroups?.find((entry) => entry.id === `${COMBINED_TOWN_HARNESS_PREFIX}plaster-wall-9slice`);
  if (!group?.patternGrammar) throw new Error("9분할 벽 하네스 그룹이 없습니다");
  return group;
}

function partTile(group: TileGroupMetadata, role: string): number {
  const tile = group.patternGrammar?.parts.find((part) => part.role === role)?.tileIds[0];
  if (tile === undefined) throw new Error(`파츠 없음: ${role}`);
  return tile;
}

describe("expandWall (RM-TYPE 전개기)", () => {
  it("9분할 4×4 전개: 모서리 4/변/center가 파츠 정의대로 매핑되고 벽은 lower로 간다", () => {
    const def = tileset();
    const group = nineSliceWall(def);
    const rect = { x: 2, y: 3, w: 4, h: 4 };
    const { edits, region } = expandWall(def, group, rect, RM_TYPE_GRAMMAR_PROFILE, EXAMPLE);
    expect(region).toEqual(rect);
    expect(edits).toHaveLength(16);
    const at = (x: number, y: number) => edits.find((edit) => edit.x === x && edit.y === y)!;
    expect(at(2, 3).tile).toBe(partTile(group, "topLeft"));
    expect(at(5, 3).tile).toBe(partTile(group, "topRight"));
    expect(at(2, 6).tile).toBe(partTile(group, "bottomLeft"));
    expect(at(5, 6).tile).toBe(partTile(group, "bottomRight"));
    expect(at(3, 3).tile).toBe(partTile(group, "top"));
    expect(at(2, 4).tile).toBe(partTile(group, "left"));
    expect(at(4, 5).tile).toBe(partTile(group, "center"));
    for (const edit of edits) expect(edit.layer).toBe("lower"); // 벽 어휘 홈 = lower
  });

  it("기둥(vertical) 1×N 전개: 위/아래 cap 보존 + 중간은 반복 몸통, 최소 크기 미달은 예시 동봉 거부", () => {
    const def = tileset();
    const group: TileGroupMetadata = {
      id: "test-pillar", name: "기둥", role: "wall", defaultLayer: "lower",
      tileIds: [50, 51], description: "", placementRules: "",
      patternGrammar: {
        kind: "vertical_expandable", minHeight: 2, preserveCaps: true, repeat: "body",
        parts: [{ role: "top", tileIds: [50] }, { role: "bottom", tileIds: [51] }],
      },
    };
    const { edits } = expandWall(def, group, { x: 7, y: 2, w: 1, h: 4 }, RM_TYPE_GRAMMAR_PROFILE, EXAMPLE);
    expect(edits.map((edit) => edit.tile)).toEqual([50, 51, 51, 51]); // cap 위 + repeat(bottom) + cap 아래
    expect(edits[0]).toMatchObject({ x: 7, y: 2 });
    expect(edits[3]).toMatchObject({ x: 7, y: 5 });

    let thrown: unknown;
    try {
      expandWall(def, group, { x: 7, y: 2, w: 1, h: 1 }, RM_TYPE_GRAMMAR_PROFILE, EXAMPLE);
    } catch (error) {
      thrown = error;
    }
    expect(String((thrown as Error).message)).toContain("다시 보낼 형식 예시");
  });

  it("패턴 파츠 미정의(patternDefined:false) 그룹은 T1b 안내와 함께 거부한다", () => {
    const def = tileset();
    const group: TileGroupMetadata = {
      id: "test-empty", name: "빈 패턴", role: "wall", defaultLayer: "lower",
      tileIds: [50], description: "", placementRules: "",
    };
    expect(() => expandWall(def, group, { x: 0, y: 0, w: 3, h: 3 }, RM_TYPE_GRAMMAR_PROFILE, EXAMPLE)).toThrowError(/패턴 파츠|patternGrammar/u);
  });
});

describe("expandRoof / resolveAutotile", () => {
  it("지붕은 벽 영역 바로 위에 전개되고 perCell/upper 홈 규약을 따른다", () => {
    const def = tileset();
    const roof: TileGroupMetadata = {
      id: "test-roof", name: "지붕", role: "roof", defaultLayer: "upper", layerHome: "upper",
      tileIds: [60, 61, 62], description: "", placementRules: "",
      patternGrammar: {
        kind: "horizontal_expandable", minWidth: 2, preserveCaps: true, repeat: "body",
        parts: [{ role: "leftCap", tileIds: [60] }, { role: "repeatBody", tileIds: [61] }, { role: "rightCap", tileIds: [62] }],
      },
    };
    const wallRegion = { x: 4, y: 6, w: 5, h: 3 };
    const { edits, region } = expandRoof(def, roof, wallRegion, RM_TYPE_GRAMMAR_PROFILE, EXAMPLE);
    expect(region).toEqual({ x: 4, y: 5, w: 5, h: 1 }); // 벽 위 1행(처마)
    expect(edits.map((edit) => edit.tile)).toEqual([60, 61, 61, 61, 62]);
    for (const edit of edits) expect(edit.layer).toBe("upper");
    // 벽이 y=0이면 지붕 공간이 없어 거부.
    expect(() => expandRoof(def, roof, { x: 0, y: 0, w: 4, h: 3 }, RM_TYPE_GRAMMAR_PROFILE, EXAMPLE)).toThrowError(/공간이 없습니다/u);
  });

  it("resolveAutotile: 8-이웃 variantMap으로 inner corner(대각만 빈 셀)를 재계산한다", () => {
    const tiles = { body: 1, edgeN: 2, edgeS: 3, edgeW: 4, edgeE: 5, cornerNW: 6, cornerNE: 7, cornerSW: 8, cornerSE: 9 };
    const variantMap = buildEightNeighborVariantMap(tiles, { innerNW: 10, innerNE: 11, innerSW: 12, innerSE: 13 });
    expect(variantMap[String(255)]).toBe(1); // 완전 연결 = body
    expect(variantMap[String(255 - AUTOTILE_DIR.NE)]).toBe(11); // NE 대각만 빔 = inner corner
    expect(variantMap[String(AUTOTILE_DIR.E | AUTOTILE_DIR.S)]).toBe(6); // N/W 빔 = 외곽 NW 모서리

    const group: AutotileGroup = {
      id: "path8", name: "길", neighborhood: 8,
      memberTileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      variantMap,
    };
    // 5×5 맵: (2,2) 중심의 상하좌우+대각(NE 제외) 전부 멤버 → 중심은 innerNE로 바뀌어야 한다.
    const width = 5;
    const lowerTiles = Array.from({ length: 25 }, () => 0);
    const put = (x: number, y: number) => { lowerTiles[y * width + x] = 1; };
    for (const [x, y] of [[2, 2], [2, 1], [3, 2], [2, 3], [1, 2], [1, 1], [1, 3], [3, 3]] as const) put(x, y);
    const map = { width, height: 5, lowerTiles };
    const changed = resolveAutotile(group, [{ x: 2, y: 2 }], map);
    expect(changed).toBeGreaterThan(0);
    expect(map.lowerTiles[2 * width + 2]).toBe(11); // inner corner NE
  });
});
