import { describe, expect, it } from "vitest";
import { buildTemplateGroup } from "@/editor/panels/tilesetAutotileTemplates";
import {
  animationFrameForTile,
  animationStripForTile,
  CHIPSET_ANIMATION_FRAME_TILES,
} from "@/project/defaults/chipsetAnimation";
import { CHIPSET_TILE_GROUPS, isSolidChipsetTile, isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import {
  DEFAULT_AUTOTILE_GROUPS,
  templateBlockFromAnchor,
  TERRAIN_TEMPLATE_ANCHORS,
} from "@/project/defaults/autotileGroups";
import { DEFAULT_TILES_PER_ROW, TILE } from "@/project/defaults/constants";

// 2026-07-17 지형 템플릿 앵커 격자 정본화(4행 밴드 × 열 0/3/6/9) 회귀 테스트.
// openwiki/autotiles.md 의 앵커 카탈로그 표는 TERRAIN_TEMPLATE_ANCHORS 상수와 이 테스트가 보증한다.

describe("지형 템플릿 앵커 카탈로그", () => {
  it("kind=group 앵커는 전부 내장 그룹으로 등록되어 있고, variantMap 고립(0) 출력이 앵커와 일치한다", () => {
    for (const entry of TERRAIN_TEMPLATE_ANCHORS) {
      if (entry.kind !== "group") continue;
      const group = DEFAULT_AUTOTILE_GROUPS.find((candidate) => candidate.id === entry.groupId);
      expect(group, `${entry.label}(앵커 ${entry.anchor}) 그룹 미등록`).toBeDefined();
      expect(group?.variantMap["0"], `${entry.label} 고립 출력`).toBe(entry.anchor);
    }
  });

  it("잔디 앵커 240은 기본 바닥(TILE.GRASS)이라 성형 그룹으로 승격하지 않는다", () => {
    expect(TILE.GRASS).toBe(240);
    const grassEntry = TERRAIN_TEMPLATE_ANCHORS.find((entry) => entry.anchor === 240);
    expect(grassEntry?.kind).toBe("base");
    for (const group of DEFAULT_AUTOTILE_GROUPS) {
      expect(group.memberTileIds, `${group.id} 가 기본 잔디 240 을 멤버로 가짐`).not.toContain(240);
    }
  });

  it("내장 그룹들의 memberTileIds 는 서로 겹치지 않는다", () => {
    const seen = new Map<number, string>();
    for (const group of DEFAULT_AUTOTILE_GROUPS) {
      for (const tileId of new Set(group.memberTileIds)) {
        const owner = seen.get(tileId);
        expect(owner, `타일 ${tileId} 이 ${owner} 와 ${group.id} 양쪽 멤버`).toBeUndefined();
        seen.set(tileId, group.id);
      }
    }
  });

  it("신규 7종 블록은 위저드 rm2k-3x4 템플릿과 완전히 같은 그룹을 만든다 (공식 상호 대조)", () => {
    const anchors = [6, 9, 243, 246, 249, 366, 369];
    for (const anchor of anchors) {
      const entry = TERRAIN_TEMPLATE_ANCHORS.find((candidate) => candidate.anchor === anchor);
      const builtin = DEFAULT_AUTOTILE_GROUPS.find((group) => group.id === entry?.groupId);
      const template = buildTemplateGroup("rm2k-3x4", anchor, DEFAULT_TILES_PER_ROW, 480);
      expect(builtin).toBeDefined();
      if (!builtin || "error" in template) throw new Error(`앵커 ${anchor} 템플릿 생성 실패`);
      expect(new Set(builtin.memberTileIds)).toEqual(new Set(template.memberTileIds));
      expect(builtin.variantMap).toEqual(template.variantMap);
    }
  });

  it("templateBlockFromAnchor 공식은 포석 정본(129 블록)과 일치한다", () => {
    const block = templateBlockFromAnchor(129);
    expect(block).toEqual({
      isolated: 129, inner: 131,
      cornerNW: 159, edgeN: 160, cornerNE: 161,
      edgeW: 189, body: 190, edgeE: 191,
      cornerSW: 219, edgeS: 220, cornerSE: 221,
    });
  });

  it("키큰 풀 NW/SW 모서리(273/333)는 잔디가 아니라 키큰 풀 소속이다", () => {
    expect(CHIPSET_TILE_GROUPS.tallGrass).toContain(273);
    expect(CHIPSET_TILE_GROUPS.tallGrass).toContain(333);
    const tallGrassGroup = DEFAULT_AUTOTILE_GROUPS.find((group) => group.id === "builtin_tall_grass");
    expect(tallGrassGroup?.memberTileIds).toContain(273);
    expect(tallGrassGroup?.memberTileIds).toContain(333);
  });
});

describe("석축 수로(관개수로) 애니메이션 배선", () => {
  it("3·33·63 기준 3프레임 스트립이 등록되어 있다", () => {
    for (const base of [3, 33, 63]) {
      const strip = animationStripForTile(base);
      expect(strip?.frames).toEqual([base, base + 1, base + 2]);
      expect(animationFrameForTile(base, 0)).toBe(base);
      expect(animationFrameForTile(base, 400)).toBe(base + 1);
      expect(animationFrameForTile(base, 700)).toBe(base + 2);
    }
  });

  it("수로 프레임 9칸은 물로 분류되어 통행 불가다", () => {
    for (const tile of [3, 4, 5, 33, 34, 35, 63, 64, 65]) {
      expect(CHIPSET_ANIMATION_FRAME_TILES, `타일 ${tile} 애니 프레임 누락`).toContain(tile);
      expect(isWaterChipsetTile(tile), `타일 ${tile} 물 분류 누락`).toBe(true);
      expect(isSolidChipsetTile(tile), `타일 ${tile} 통행 차단 누락`).toBe(true);
    }
  });

  it("호수 쿼터 합성 대상은 수로를 포함하지 않는다 (통타일 렌더 유지)", async () => {
    const { isLakeAutotileTile } = await import("@/project/defaults/lakeAutotile");
    for (const tile of [3, 4, 5, 33, 34, 35, 63, 64, 65]) {
      expect(isLakeAutotileTile(tile)).toBe(false);
    }
  });
});
