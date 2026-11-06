import { describe, expect, it } from "vitest";
import { formatSelectionTerrain, selectionTerrain } from "@/editor/selectionTerrainSummary";
import { resolveRegionRoute } from "@/editor/regionTask/regionRouteIntent";
import { SELECTION_PLACE_PRESETS } from "@/editor/selectionActionChips";
import type { GameMap } from "@/project/types";

function plateau(): GameMap {
  const width = 10, height = 8, n = width * height;
  const levels = new Array<number>(n).fill(0), ramps = new Array<number>(n).fill(0), waterDepth = new Array<number>(n).fill(0);
  for (let y = 2; y < 6; y++) for (let x = 2; x < 7; x++) levels[y * width + x] = 2;
  ramps[6 * width + 4] = 1;
  waterDepth[7 * width + 0] = 1;
  return { id: "m", name: "m", width, height, tileSize: 16, tilesetId: "t", lowerTiles: new Array(n).fill(0), upperTiles: new Array(n).fill(-1), events: [],
    relief: { width, height, levels, ramps }, terrainDesign: { waterDepth, lockedCells: [2 * width + 2] } };
}

describe("선택 지형 꼬리말", () => {
  it("사각형 안의 높이 분포·경사로·물·잠금을 센다", () => {
    const t = selectionTerrain(plateau(), { x: 0, y: 2, width: 6, height: 6 });
    expect(Object.fromEntries(t.levels)).toEqual({ 0: 20, 2: 16 });
    expect([t.ramps, t.water, t.locked]).toEqual([1, 1, 1]);
    expect(formatSelectionTerrain(plateau(), { x: 0, y: 2, width: 6, height: 6 })).toContain("높이·경사로·물은 바꾸지 말 것");
  });

  it("「마을」「숲」 칩 문장은 기존 생성기 경로로 간다", () => {
    const byId = Object.fromEntries(SELECTION_PLACE_PRESETS.map((p) => [p.id, p.instruction!]));
    expect(resolveRegionRoute(byId.village!).kind).toBe("operator");
    expect(resolveRegionRoute(byId.forest!).kind).toBe("operator");
  });
});
