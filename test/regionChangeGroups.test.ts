// test/regionChangeGroups.test.ts
// 영역 변경 4-연결성 청크 그룹화 + 라벨링 순수 함수 단위 테스트.
// 스펙 docs/superpowers/specs/2026-07-20-region-task-enhancements-design.md §A.

import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import {
  describeChunkPosition,
  groupRegionChanges,
  labelRegionChunk,
  withChunkLabels,
  type RegionChunk,
} from "@/editor/regionTask/regionChangeGroups";
import type { MapId, Project, RegionRect } from "@/project/types";
import type { TilesetDef } from "@/project/types";

function makeProject(): { project: Project; mapId: MapId } {
  const project = createBlankProject();
  return { project, mapId: project.startMapId };
}

/** base 를 깊은 복사한 뒤 영역 안 lower/upper 를 채운 clipped 프로젝트 만들기. */
function makeClippedWithTiles(
  base: Project,
  mapId: MapId,
  region: RegionRect,
  lowerTiles: number[],
  upperTiles: number[] = [],
): Project {
  const clipped: Project = structuredClone(base);
  const map = clipped.maps[mapId];
  for (let r = 0; r < region.height; r += 1) {
    for (let c = 0; c < region.width; c += 1) {
      const idx = (region.y + r) * map.width + (region.x + c);
      const src = r * region.width + c;
      map.lowerTiles[idx] = lowerTiles[src] ?? TILE.EMPTY;
      map.upperTiles[idx] = upperTiles[src] ?? TILE.EMPTY;
    }
  }
  return clipped;
}

describe("groupRegionChanges", () => {
  it("변경 없으면 lower/upper 모두 빈 배열", () => {
    const { project, mapId } = makeProject();
    const region = { x: 0, y: 0, width: 3, height: 3 };
    const clipped = structuredClone(project);
    const groups = groupRegionChanges(project, clipped, mapId, region);
    expect(groups.lower).toHaveLength(0);
    expect(groups.upper).toHaveLength(0);
    expect(groups.unchangedCells).toBe(9);
  });

  it("연속된 lower 변경 셀을 1개 청크로 묶는다 (4-연결성)", () => {
    const { project, mapId } = makeProject();
    const region = { x: 0, y: 0, width: 3, height: 3 };
    // 가운데(1,1)만 변경 안 함 → 8셀이 4-연결성으로 1개 청크(가운데 구멍은 분리 안 시킴)
    const clipped = makeClippedWithTiles(
      project, mapId, region,
      [
        TILE.WATER, TILE.WATER, TILE.WATER,
        TILE.WATER, TILE.GRASS, TILE.WATER, // (1,1)은 base==clipped (잔디 그대로)
        TILE.WATER, TILE.WATER, TILE.WATER,
      ],
    );
    const groups = groupRegionChanges(project, clipped, mapId, region);
    expect(groups.lower).toHaveLength(1);
    expect(groups.lower[0].cells).toHaveLength(8);
    expect(groups.lower[0].layer).toBe("lower");
    expect(groups.lower[0].dominantTile).toBe(TILE.WATER);
  });

  it("분리된 두 영역은 2개 청크로 분리", () => {
    const { project, mapId } = makeProject();
    const region = { x: 0, y: 0, width: 5, height: 1 };
    // (0,0)(1,0) 변경, (2,0) 변경 없음, (3,0)(4,0) 변경 → 2개 청크
    const clipped = makeClippedWithTiles(
      project, mapId, region,
      [TILE.WATER, TILE.WATER, TILE.GRASS, TILE.WATER, TILE.WATER],
    );
    const groups = groupRegionChanges(project, clipped, mapId, region);
    expect(groups.lower).toHaveLength(2);
    expect(groups.lower[0].cells).toHaveLength(2);
    expect(groups.lower[1].cells).toHaveLength(2);
  });

  it("lower 와 upper 는 독립적으로 그룹화", () => {
    const { project, mapId } = makeProject();
    const region = { x: 0, y: 0, width: 2, height: 1 };
    const clipped = makeClippedWithTiles(
      project, mapId, region,
      [TILE.WATER, TILE.GRASS], // lower: 1셀만 변경
      [TILE.TREE, TILE.TREE],   // upper: 2셀 모두 변경
    );
    const groups = groupRegionChanges(project, clipped, mapId, region);
    expect(groups.lower).toHaveLength(1);
    expect(groups.lower[0].cells).toHaveLength(1);
    expect(groups.upper).toHaveLength(1);
    expect(groups.upper[0].cells).toHaveLength(2);
  });

  it("존재하지 않는 맵 id면 빈 결과", () => {
    const { project } = makeProject();
    const region = { x: 0, y: 0, width: 1, height: 1 };
    const clipped = structuredClone(project);
    const groups = groupRegionChanges(project, clipped, "no-such-map" as never, region);
    expect(groups.lower).toHaveLength(0);
    expect(groups.upper).toHaveLength(0);
    expect(groups.unchangedCells).toBe(0);
  });

  it("대각선 인접은 4-연결성에서 분리 (두 청크)", () => {
    const { project, mapId } = makeProject();
    const region = { x: 0, y: 0, width: 2, height: 2 };
    // (0,0)과 (1,1)만 변경, (1,0)(0,1)은 변경 없음 → 대각선이라 4-연결성은 분리
    const clipped = makeClippedWithTiles(
      project, mapId, region,
      [
        TILE.WATER, TILE.GRASS,
        TILE.GRASS, TILE.WATER,
      ],
    );
    const groups = groupRegionChanges(project, clipped, mapId, region);
    expect(groups.lower).toHaveLength(2);
    expect(groups.lower[0].cells).toHaveLength(1);
    expect(groups.lower[1].cells).toHaveLength(1);
  });
});

describe("labelRegionChunk", () => {
  it("대표 타일 라벨 + 셀 수", () => {
    const chunk: RegionChunk = {
      id: "test", layer: "lower", cells: [
        { x: 0, y: 0, index: 0 },
        { x: 1, y: 0, index: 1 },
        { x: 2, y: 0, index: 2 },
      ],
      dominantTile: TILE.GRASS, label: "",
    };
    const label = labelRegionChunk(chunk, undefined);
    // describeChipsetTile 가 잔디를 "잔디"로 라벨링하든 폴백 "타일 240" 이든 셀 수는 붙음
    expect(label).toMatch(/\(3칸\)$/);
  });

  it("빈 라벨이면 타일 N 폴백", () => {
    const chunk: RegionChunk = {
      id: "test", layer: "lower",
      cells: [{ x: 0, y: 0, index: 0 }],
      dominantTile: 99999, // 존재하지 않는 타일
      label: "",
    };
    const label = labelRegionChunk(chunk, undefined);
    expect(label).toContain("99999");
    expect(label).toMatch(/\(1칸\)$/);
  });
});

describe("withChunkLabels", () => {
  it("모든 청크의 label 을 채운다", () => {
    const { project, mapId } = makeProject();
    const region = { x: 0, y: 0, width: 2, height: 1 };
    const clipped = makeClippedWithTiles(
      project, mapId, region,
      [TILE.WATER, TILE.WATER],
    );
    const groups = groupRegionChanges(project, clipped, mapId, region);
    const labeled = withChunkLabels(groups, undefined as unknown as TilesetDef);
    expect(labeled.lower[0].label).toMatch(/\(2칸\)$/);
    expect(labeled.lower[0].label.length).toBeGreaterThan(0);
  });
});

describe("describeChunkPosition", () => {
  // 같은 타일로 된 덩어리가 여럿이면 라벨이 완전히 겹친다("Stone floor(3칸)" 두 줄) —
  // 목록만 보고 구분할 수 있도록 영역 안 위치를 사람 말로 돌려준다.
  const chunkAt = (cells: readonly [number, number][]): RegionChunk => ({
    id: "c",
    layer: "lower",
    cells: cells.map(([x, y]) => ({ x, y, index: 0 })),
    dominantTile: TILE.WATER,
    label: "",
  });
  const REGION = { x: 2, y: 2, width: 9, height: 9 };

  it("영역을 3×3 구획으로 나눠 무게중심이 놓인 칸의 이름을 준다", () => {
    expect(describeChunkPosition(chunkAt([[0, 0]]), REGION)).toBe("좌상단");
    expect(describeChunkPosition(chunkAt([[8, 8]]), REGION)).toBe("우하단");
    expect(describeChunkPosition(chunkAt([[4, 4]]), REGION)).toBe("가운데");
    expect(describeChunkPosition(chunkAt([[8, 0]]), REGION)).toBe("우상단");
    expect(describeChunkPosition(chunkAt([[0, 8]]), REGION)).toBe("좌하단");
  });

  it("여러 칸이면 무게중심으로 판정한다", () => {
    // (0,0),(1,0),(0,1) → 무게중심 (0.33,0.33) → 좌상단
    expect(describeChunkPosition(chunkAt([[0, 0], [1, 0], [0, 1]]), REGION)).toBe("좌상단");
  });

  it("빈 청크나 폭 0 영역에서도 던지지 않는다", () => {
    expect(describeChunkPosition(chunkAt([]), REGION)).toBe("");
    expect(describeChunkPosition(chunkAt([[0, 0]]), { x: 0, y: 0, width: 0, height: 0 })).toBe("가운데");
  });
});
