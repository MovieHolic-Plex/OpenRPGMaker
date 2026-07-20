// test/regionContextSuggestions.test.ts
// 인접 타일 기반 동적 추천 순수 함수 단위 테스트.
// 스펙 docs/superpowers/specs/2026-07-20-region-task-enhancements-design.md §E.

import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import {
  categorizeTileForContext,
  countAdjacentTileCategories,
  suggestRegionCommandsByContext,
} from "@/editor/regionTask/regionContextSuggestions";
import type { MapId, Project, RegionRect } from "@/project/types";

function makeProject(): { project: Project; mapId: MapId } {
  const project = createBlankProject();
  return { project, mapId: project.startMapId };
}

function paintLower(project: Project, mapId: MapId, x: number, y: number, tile: number): void {
  const map = project.maps[mapId];
  map.lowerTiles[y * map.width + x] = tile;
}

describe("categorizeTileForContext", () => {
  it("물 카테고리 — TILE.WATER", () => {
    expect(categorizeTileForContext(TILE.WATER, undefined)).toBe("water");
  });
  it("길 카테고리 — TILE.PATH (흙길 계열)", () => {
    expect(categorizeTileForContext(TILE.PATH, undefined)).toBe("road");
  });
  it("숲 카테고리 — TILE.TREE", () => {
    expect(categorizeTileForContext(TILE.TREE, undefined)).toBe("forest");
  });
  it("건물 카테고리 — TILE.WALL", () => {
    expect(categorizeTileForContext(TILE.WALL, undefined)).toBe("building");
  });
  it("잔디는 other (명시적 카테고리 아님)", () => {
    expect(categorizeTileForContext(TILE.GRASS, undefined)).toBe("other");
  });
});

describe("countAdjacentTileCategories", () => {
  it("영역 바깥 1타일 두르레이트 수집 — 영역 내부는 제외", () => {
    const { project, mapId } = makeProject();
    // 영역 (5,5) 1×1. 주변 8셀 중 물 4셀 배치.
    paintLower(project, mapId, 4, 4, TILE.WATER);
    paintLower(project, mapId, 5, 4, TILE.WATER);
    paintLower(project, mapId, 6, 4, TILE.WATER);
    paintLower(project, mapId, 4, 5, TILE.WATER);
    const region: RegionRect = { x: 5, y: 5, width: 1, height: 1 };
    const map = project.maps[mapId];
    const counts = countAdjacentTileCategories(map, region, undefined);
    expect(counts.water).toBeGreaterThanOrEqual(4);
  });
});

describe("suggestRegionCommandsByContext", () => {
  it("물 인접 3+ → 부두/다리 추천 포함", () => {
    const { project, mapId } = makeProject();
    // 영역 (5,5) 3×3. 주변에 물 4셀.
    paintLower(project, mapId, 4, 4, TILE.WATER);
    paintLower(project, mapId, 5, 4, TILE.WATER);
    paintLower(project, mapId, 6, 4, TILE.WATER);
    paintLower(project, mapId, 4, 5, TILE.WATER);
    const region: RegionRect = { x: 5, y: 5, width: 3, height: 3 };
    const suggestions = suggestRegionCommandsByContext(project, mapId, region, 4);
    const ids = suggestions.map((s) => s.id);
    expect(ids).toContain("dock");
    expect(ids).toContain("bridge");
    expect(suggestions).toHaveLength(4);
  });

  it("길 인접 2+ → 가로수 추천 포함", () => {
    const { project, mapId } = makeProject();
    paintLower(project, mapId, 4, 5, TILE.PATH);
    paintLower(project, mapId, 4, 6, TILE.PATH);
    const region: RegionRect = { x: 5, y: 5, width: 3, height: 3 };
    const suggestions = suggestRegionCommandsByContext(project, mapId, region, 4);
    const ids = suggestions.map((s) => s.id);
    expect(ids).toContain("street-trees");
  });

  it("주변이 전부 잔디(other) → 정적 코퍼스 폴백", () => {
    const { project, mapId } = makeProject();
    const region: RegionRect = { x: 5, y: 5, width: 3, height: 3 };
    const suggestions = suggestRegionCommandsByContext(project, mapId, region, 4);
    // 정적 코퍼스의 처음 4개가 와야 함 (컨텍스트 신호 없음)
    expect(suggestions).toHaveLength(4);
    // 모두 SUGGESTED_REGION_COMMANDS의 id 여야 함 (dock/bridge 같은 동적 id 없음)
    const ids = suggestions.map((s) => s.id);
    expect(ids).not.toContain("dock");
    expect(ids).not.toContain("bridge");
  });

  it("작은 영역(2×2)은 거시 제안(여관/축제) 제외", () => {
    const { project, mapId } = makeProject();
    // 건물 인접 2셀
    paintLower(project, mapId, 4, 5, TILE.WALL);
    paintLower(project, mapId, 4, 6, TILE.WALL);
    const region: RegionRect = { x: 5, y: 5, width: 2, height: 2 };
    const suggestions = suggestRegionCommandsByContext(project, mapId, region, 4);
    const ids = suggestions.map((s) => s.id);
    expect(ids).not.toContain("inn-guests");
    expect(ids).not.toContain("festival");
  });

  it("큰 영역(15×15)은 거시 제안(여관/축제) 포함 가능", () => {
    const { project, mapId } = makeProject();
    // 큰 영역에 건물 인접 2셀
    paintLower(project, mapId, 0, 16, TILE.WALL);
    paintLower(project, mapId, 1, 16, TILE.WALL);
    const region: RegionRect = { x: 0, y: 0, width: 15, height: 15 };
    const suggestions = suggestRegionCommandsByContext(project, mapId, region, 4);
    const ids = suggestions.map((s) => s.id);
    expect(ids).toContain("inn-guests");
  });

  it("존재하지 않는 맵 → 정적 폴백", () => {
    const { project } = makeProject();
    const region: RegionRect = { x: 0, y: 0, width: 3, height: 3 };
    const suggestions = suggestRegionCommandsByContext(project, "no-such-map" as never, region, 4);
    expect(suggestions).toHaveLength(4);
  });

  it("항상 count 개 반환", () => {
    const { project, mapId } = makeProject();
    const region: RegionRect = { x: 0, y: 0, width: 3, height: 3 };
    expect(suggestRegionCommandsByContext(project, mapId, region, 4)).toHaveLength(4);
    expect(suggestRegionCommandsByContext(project, mapId, region, 3)).toHaveLength(3);
  });
});
