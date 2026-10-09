// test/partialApplyCompose.test.ts
// 부분 적용 병합 프로젝트 순수 함수 단위 테스트.
// 스펙 docs/superpowers/specs/2026-07-20-region-task-enhancements-design.md §A.

import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { composePartialProject } from "@/editor/regionTask/partialApplyCompose";
import { groupRegionChanges } from "@/editor/regionTask/regionChangeGroups";
import type { MapId, Project, RegionRect } from "@/project/types";

function makeProject(): { project: Project; mapId: MapId } {
  const project = createBlankProject();
  return { project, mapId: project.startMapId };
}

function paintRegion(
  project: Project,
  mapId: MapId,
  region: RegionRect,
  lowerTiles: number[],
  upperTiles: number[] = [],
): void {
  const map = project.maps[mapId];
  for (let r = 0; r < region.height; r += 1) {
    for (let c = 0; c < region.width; c += 1) {
      const idx = (region.y + r) * map.width + (region.x + c);
      const src = r * region.width + c;
      map.lowerTiles[idx] = lowerTiles[src] ?? TILE.EMPTY;
      map.upperTiles[idx] = upperTiles[src] ?? TILE.EMPTY;
    }
  }
}

describe("composePartialProject", () => {
  it("선택된 청크 셀만 base 위에 clipped 값 적용", () => {
    const { project: base, mapId } = makeProject();
    const region = { x: 0, y: 0, width: 5, height: 1 };
    // base: 잔디 5칸. clipped: WATER 2 + GRASS 1 + WATER 2 (가운데 한 칸은 base와 같음)
    const clipped: Project = structuredClone(base);
    paintRegion(clipped, mapId, region,
      [TILE.WATER, TILE.WATER, TILE.GRASS, TILE.WATER, TILE.WATER]);
    const groups = groupRegionChanges(base, clipped, mapId, region);
    expect(groups.lower).toHaveLength(2); // 2개 청크로 분리

    // 첫 번째 청크만 선택
    const selectedId = groups.lower[0].id;
    const merged = composePartialProject({
      base, clipped, mapId, region,
      selectedChunkIds: [selectedId],
      groups,
    });
    const mergedMap = merged.maps[mapId];
    // 첫 청크(2칸)는 clipped 값(WATER), 나머지는 base 값(GRASS)
    expect(mergedMap.lowerTiles[0]).toBe(TILE.WATER);
    expect(mergedMap.lowerTiles[1]).toBe(TILE.WATER);
    expect(mergedMap.lowerTiles[2]).toBe(TILE.GRASS);
    expect(mergedMap.lowerTiles[3]).toBe(TILE.GRASS);
    expect(mergedMap.lowerTiles[4]).toBe(TILE.GRASS);
  });

  it("선택된 청크 없으면 base 의 복사본 반환", () => {
    const { project: base, mapId } = makeProject();
    const region = { x: 0, y: 0, width: 2, height: 1 };
    const clipped: Project = structuredClone(base);
    paintRegion(clipped, mapId, region, [TILE.WATER, TILE.WATER]);
    const merged = composePartialProject({
      base, clipped, mapId, region,
      selectedChunkIds: [],
    });
    // base 와 동일 (변경 없음)
    const mergedMap = merged.maps[mapId];
    expect(mergedMap.lowerTiles[0]).toBe(base.maps[mapId].lowerTiles[0]);
    expect(mergedMap.lowerTiles[1]).toBe(base.maps[mapId].lowerTiles[1]);
  });

  it("영역 밖 셀은 건드리지 않음", () => {
    const { project: base, mapId } = makeProject();
    const region = { x: 5, y: 5, width: 2, height: 1 };
    const clipped: Project = structuredClone(base);
    paintRegion(clipped, mapId, region, [TILE.WATER, TILE.WATER]);
    const groups = groupRegionChanges(base, clipped, mapId, region);
    const merged = composePartialProject({
      base, clipped, mapId, region,
      selectedChunkIds: groups.lower.map((c) => c.id),
      groups,
    });
    // 영역 밖 (0,0) 셀은 base 값 그대로
    expect(merged.maps[mapId].lowerTiles[0]).toBe(base.maps[mapId].lowerTiles[0]);
  });

  it("lower/upper 혼합 선택 — 각 레이어별 청크만 적용", () => {
    const { project: base, mapId } = makeProject();
    const region = { x: 0, y: 0, width: 2, height: 1 };
    const clipped: Project = structuredClone(base);
    paintRegion(
      clipped, mapId, region,
      [TILE.WATER, TILE.WATER], // lower 모두 변경
      [TILE.TREE, TILE.TREE],   // upper 모두 변경
    );
    const groups = groupRegionChanges(base, clipped, mapId, region);
    // lower 청크만 선택, upper 는 선택 안 함
    const lowerIds = groups.lower.map((c) => c.id);
    const merged = composePartialProject({
      base, clipped, mapId, region,
      selectedChunkIds: lowerIds,
      groups,
    });
    const mergedMap = merged.maps[mapId];
    expect(mergedMap.lowerTiles[0]).toBe(TILE.WATER); // lower 적용
    expect(mergedMap.upperTiles[0]).toBe(base.maps[mapId].upperTiles[0]); // upper 미적용
  });

  it("원본 base/clipped 는 불변", () => {
    const { project: base, mapId } = makeProject();
    const region = { x: 0, y: 0, width: 1, height: 1 };
    const clipped: Project = structuredClone(base);
    paintRegion(clipped, mapId, region, [TILE.WATER]);
    const baseBefore = base.maps[mapId].lowerTiles[0];
    const clippedBefore = clipped.maps[mapId].lowerTiles[0];
    composePartialProject({
      base, clipped, mapId, region,
      selectedChunkIds: ["chunk-lower-0"],
    });
    expect(base.maps[mapId].lowerTiles[0]).toBe(baseBefore);
    expect(clipped.maps[mapId].lowerTiles[0]).toBe(clippedBefore);
  });
});
