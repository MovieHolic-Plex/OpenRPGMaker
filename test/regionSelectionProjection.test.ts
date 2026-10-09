// test/regionSelectionProjection.test.ts
// 미리보기와 적용이 **같은 합성 결과**를 쓰는지 고정하는 회귀 테스트.
// 스펙 docs/superpowers/specs/2026-09-10-region-task-uiux-redesign-design.md §4.2.
//
// 지금까지는 검토 화면이 "전체 결과 썸네일 + 제외 표시"를 보여주고, 사용자가 머릿속에서
// 둘을 합성해야 했다. 그 어긋날 여지를 구조로 없애는 것이 이 바인딩의 목적이다.

import { describe, expect, it } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { composePartialProject } from "@/editor/regionTask/partialApplyCompose";
import { groupRegionChanges } from "@/editor/regionTask/regionChangeGroups";
import { createRegionSelectionProjection } from "@/editor/regionTask/regionSelectionProjection";
import type { MapId, Project, RegionRect } from "@/project/types";

const REGION: RegionRect = { x: 0, y: 0, width: 4, height: 3 };

function makeProject(): { project: Project; mapId: MapId } {
  const project = createBlankProject();
  return { project, mapId: project.startMapId };
}

/** 왼쪽 2열은 물, 오른쪽 끝 1칸은 위층 나무 — 서로 떨어진 청크 3개가 나오게. */
function makeClipped(base: Project, mapId: MapId): Project {
  const clipped: Project = structuredClone(base);
  const map = clipped.maps[mapId]!;
  const put = (x: number, y: number, lower?: number, upper?: number): void => {
    const idx = (REGION.y + y) * map.width + (REGION.x + x);
    if (lower !== undefined) map.lowerTiles[idx] = lower;
    if (upper !== undefined) map.upperTiles[idx] = upper;
  };
  // 청크 1 (lower): (0,0) (1,0) (0,1) (1,1) 연결
  put(0, 0, TILE.WATER);
  put(1, 0, TILE.WATER);
  put(0, 1, TILE.WATER);
  put(1, 1, TILE.WATER);
  // 청크 2 (lower): (3,2) 떨어진 한 칸
  put(3, 2, TILE.WATER);
  // 청크 3 (upper): (3,0)
  put(3, 0, undefined, TILE.TREE);
  return clipped;
}

function setup() {
  const { project, mapId } = makeProject();
  const clipped = makeClipped(project, mapId);
  const groups = groupRegionChanges(project, clipped, mapId, REGION);
  const allIds = [...groups.lower, ...groups.upper].map((c) => c.id);
  const projection = createRegionSelectionProjection({
    base: project,
    clipped,
    mapId,
    region: REGION,
    groups,
  });
  return { project, clipped, mapId, groups, allIds, projection };
}

describe("createRegionSelectionProjection", () => {
  it("기본 선택은 모든 청크 — 전체 적용과 같다", () => {
    const { projection, allIds, clipped, mapId } = setup();

    expect([...projection.selected()].sort()).toEqual([...allIds].sort());
    expect(projection.isPartial()).toBe(false);
    // 전부 선택이면 clipped 의 영역 타일이 그대로 들어와야 한다.
    const map = projection.project().maps[mapId]!;
    expect(map.lowerTiles).toEqual(clipped.maps[mapId]!.lowerTiles);
  });

  it("같은 선택에 대해 project() 는 같은 객체를 돌려준다 — 미리보기와 적용이 한 결과를 공유한다", () => {
    const { projection } = setup();

    const first = projection.project();
    const second = projection.project();
    expect(second).toBe(first);
  });

  it("토글하면 새 결과를 내고, 되돌리면 다시 새 결과지만 내용은 처음과 같다", () => {
    const { projection, allIds } = setup();

    const before = projection.project();
    projection.toggle(allIds[0]!);
    const afterToggle = projection.project();
    expect(afterToggle).not.toBe(before);

    projection.toggle(allIds[0]!);
    expect(projection.project()).toEqual(before);
  });

  it("project() 는 언제나 composePartialProject 와 같은 결과다 (미리보기 == 적용)", () => {
    const { projection, allIds, project, clipped, mapId, groups } = setup();

    // 임의의 토글 시퀀스를 밟아도 불변식이 유지돼야 한다.
    projection.toggle(allIds[0]!);
    projection.toggle(allIds[2]!);
    projection.toggle(allIds[0]!);

    const expected = composePartialProject({
      base: project,
      clipped,
      mapId,
      region: REGION,
      selectedChunkIds: [...projection.selected()],
      groups,
    });
    expect(projection.project()).toEqual(expected);
  });

  it("전부 해제하면 base 와 같아지고 적용할 칸이 0이 된다", () => {
    const { projection, allIds, project, mapId } = setup();

    for (const id of allIds) projection.toggle(id);

    expect(projection.selected().size).toBe(0);
    expect(projection.selectedCellCount()).toBe(0);
    expect(projection.project().maps[mapId]!.lowerTiles)
      .toEqual(project.maps[mapId]!.lowerTiles);
  });

  it("selectedCellCount 는 선택된 청크의 셀 합이다", () => {
    const { projection, groups } = setup();

    const total = [...groups.lower, ...groups.upper]
      .reduce((sum, chunk) => sum + chunk.cells.length, 0);
    expect(projection.selectedCellCount()).toBe(total);

    const first = groups.lower[0]!;
    projection.toggle(first.id);
    expect(projection.selectedCellCount()).toBe(total - first.cells.length);
  });

  it("일부만 선택하면 isPartial 이 참이다", () => {
    const { projection, allIds } = setup();

    expect(projection.isPartial()).toBe(false);
    projection.toggle(allIds[0]!);
    expect(projection.isPartial()).toBe(true);
  });
});
