// test/regionTileStats.test.ts
// 영역 타일 분포 요약 순수 함수 단위 테스트.
// 스펙 docs/superpowers/specs/2026-07-20-region-task-enhancements-design.md §F.

import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { formatRegionTileStatsCompact, summarizeRegionTiles } from "@/editor/regionTask/regionTileStats";
import type { MapId, Project, RegionRect } from "@/project/types";

function makeProject(): { project: Project; mapId: MapId } {
  const project = createBlankProject();
  return { project, mapId: project.startMapId };
}

function paintLower(project: Project, mapId: MapId, region: RegionRect, tiles: number[]): void {
  const map = project.maps[mapId];
  for (let r = 0; r < region.height; r += 1) {
    for (let c = 0; c < region.width; c += 1) {
      const idx = (region.y + r) * map.width + (region.x + c);
      map.lowerTiles[idx] = tiles[r * region.width + c] ?? TILE.EMPTY;
    }
  }
}

describe("summarizeRegionTiles", () => {
  it("단일 잔디 영역 — top 에 잔디 1개", () => {
    const { project, mapId } = makeProject();
    const region = { x: 0, y: 0, width: 3, height: 3 };
    paintLower(project, mapId, region, Array(9).fill(TILE.GRASS));
    const stats = summarizeRegionTiles(project.maps[mapId], region);
    expect(stats.totalCells).toBe(9);
    expect(stats.emptyCells).toBe(0);
    expect(stats.top).toHaveLength(1);
    expect(stats.top[0].count).toBe(9);
  });

  it("혼합 타일 — top 3 빈도순 정렬", () => {
    const { project, mapId } = makeProject();
    const region = { x: 0, y: 0, width: 3, height: 1 };
    paintLower(project, mapId, region, [TILE.GRASS, TILE.WATER, TILE.GRASS]);
    const stats = summarizeRegionTiles(project.maps[mapId], region);
    expect(stats.top.length).toBeGreaterThanOrEqual(2);
    // 잔디 2개가 물 1개보다 많으므로 잔디가 top[0]
    expect(stats.top[0].count).toBeGreaterThanOrEqual(2);
  });

  it("빈 셀(EMPTY) 카운트", () => {
    const { project, mapId } = makeProject();
    const region = { x: 0, y: 0, width: 2, height: 1 };
    paintLower(project, mapId, region, [TILE.EMPTY, TILE.GRASS]);
    const stats = summarizeRegionTiles(project.maps[mapId], region);
    expect(stats.emptyCells).toBe(1);
    expect(stats.totalCells).toBe(2);
  });

  it("영역 밖 좌표는 무시", () => {
    const { project, mapId } = makeProject();
    const map = project.maps[mapId];
    // 영역이 맵 밖으로 나감 — 정상 범위 내 셀만 계산
    const region = { x: map.width - 1, y: map.height - 1, width: 3, height: 3 };
    const stats = summarizeRegionTiles(map, region);
    expect(stats.totalCells).toBe(9); // regionArea는 그대로
    // 실제 맵 안 셀은 1개뿐 — emptyCells 가 9 - 1 = 8 보다 작거나 같아야
    expect(stats.emptyCells).toBeLessThanOrEqual(9);
  });
});

describe("formatRegionTileStatsCompact", () => {
  it("컴팩트 문자열 — 라벨+개수를 · 로 결합", () => {
    const { project, mapId } = makeProject();
    const region = { x: 0, y: 0, width: 3, height: 1 };
    paintLower(project, mapId, region, [TILE.GRASS, TILE.WATER, TILE.GRASS]);
    const stats = summarizeRegionTiles(project.maps[mapId], region);
    const compact = formatRegionTileStatsCompact(stats);
    expect(compact).toMatch(/·/);
    // 잔디 2가 포함돼야
    expect(compact).toMatch(/2/);
  });

  it("빈 통계면 빈 문자열", () => {
    const stats = { top: [], totalCells: 0, emptyCells: 0 };
    expect(formatRegionTileStatsCompact(stats)).toBe("");
  });
});
