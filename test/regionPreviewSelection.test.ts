// test/regionPreviewSelection.test.ts
// 캔버스 고스트가 청크 선택을 따라가는지 고정하는 회귀 테스트.
// 스펙 docs/superpowers/specs/2026-09-10-region-task-uiux-redesign-design.md §4.2.
//
// 회귀 배경: aiChatPanelHelpers/aiTurnRunner 는 검토 중 고스트를 언제나
// `pendingRegion.clippedProject`(=전체 결과)로 그렸다. 그동안 팝오버 체크박스는 일부를
// 빼고 있었으므로, 캔버스와 체크리스트가 서로 다른 것을 보여줬다.

import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlankProject, TILE } from "@/project/defaults";
import { groupRegionChanges } from "@/editor/regionTask/regionChangeGroups";
import { createRegionSelectionProjection } from "@/editor/regionTask/regionSelectionProjection";
import {
  clearActiveRegionSelection,
  notifyRegionSelectionChanged,
  regionPreviewProject,
  setActiveRegionSelection,
  subscribeRegionPreviewSelection,
} from "@/editor/regionTask/regionPreviewSelection";
import type { MapId, Project, RegionRect } from "@/project/types";

const REGION: RegionRect = { x: 0, y: 0, width: 4, height: 3 };

function setup() {
  const base = createBlankProject();
  const mapId: MapId = base.startMapId;
  const clipped: Project = structuredClone(base);
  const map = clipped.maps[mapId]!;
  const put = (x: number, y: number, tile: number): void => {
    map.lowerTiles[(REGION.y + y) * map.width + (REGION.x + x)] = tile;
  };
  put(0, 0, TILE.WATER);
  put(1, 0, TILE.WATER);
  put(3, 2, TILE.WATER); // 떨어진 두 번째 청크

  const groups = groupRegionChanges(base, clipped, mapId, REGION);
  const projection = createRegionSelectionProjection({ base, clipped, mapId, region: REGION, groups });
  return { base, clipped, mapId, groups, projection };
}

afterEach(() => {
  clearActiveRegionSelection();
});

describe("regionPreviewProject", () => {
  it("활성 투영이 없으면 pending 의 전체 결과를 그대로 쓴다", () => {
    const { base, clipped } = setup();

    expect(regionPreviewProject({ baseProject: base, clippedProject: clipped })).toBe(clipped);
  });

  it("활성 투영이 있으면 그 투영의 합성 결과를 쓴다", () => {
    const { base, clipped, projection } = setup();
    setActiveRegionSelection(projection);

    expect(regionPreviewProject({ baseProject: base, clippedProject: clipped }))
      .toBe(projection.project());
  });

  it("청크를 빼면 미리보기 결과에서 그 칸이 원본으로 돌아온다", () => {
    const { base, clipped, mapId, groups, projection } = setup();
    setActiveRegionSelection(projection);

    const dropped = groups.lower[0]!;
    projection.toggle(dropped.id);

    const preview = regionPreviewProject({ baseProject: base, clippedProject: clipped });
    const previewTiles = preview.maps[mapId]!.lowerTiles;
    const baseTiles = base.maps[mapId]!.lowerTiles;
    for (const cell of dropped.cells) {
      const index = (REGION.y + cell.y) * preview.maps[mapId]!.width + (REGION.x + cell.x);
      expect(previewTiles[index]).toBe(baseTiles[index]);
    }
    // 전체 결과와는 달라야 한다 — 그래야 캔버스가 체크리스트와 같은 말을 한다.
    expect(previewTiles).not.toEqual(clipped.maps[mapId]!.lowerTiles);
  });

  it("치우면 다시 전체 결과로 돌아간다", () => {
    const { base, clipped, projection } = setup();
    setActiveRegionSelection(projection);
    clearActiveRegionSelection();

    expect(regionPreviewProject({ baseProject: base, clippedProject: clipped })).toBe(clipped);
  });
});

describe("subscribeRegionPreviewSelection", () => {
  it("선택 변경 알림이 구독자에게 간다", () => {
    const { projection } = setup();
    const listener = vi.fn();
    const unsubscribe = subscribeRegionPreviewSelection(listener);

    setActiveRegionSelection(projection);
    expect(listener).toHaveBeenCalledTimes(1);

    notifyRegionSelectionChanged();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    notifyRegionSelectionChanged();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("치울 때도 알림이 간다 — 고스트를 전체 결과로 되돌려 그려야 하므로", () => {
    const { projection } = setup();
    setActiveRegionSelection(projection);
    const listener = vi.fn();
    subscribeRegionPreviewSelection(listener);

    clearActiveRegionSelection();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
