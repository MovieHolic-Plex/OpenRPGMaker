import { beforeEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { landBrushCells, landRectCells, paintLandCells } from "@/editor/terrainLandBrush";

function current() {
  const project = store.getCurrent();
  return project.maps[project.startMapId]!;
}

describe("땅 칸 붓", () => {
  beforeEach(() => { store.replaceProject(createBlankProject()); });

  it("사각형 한 번이 그 칸만 정확히 그 단으로 맞춘다", () => {
    const map = current();
    const cells = landRectCells(map, { x: 2, y: 3 }, { x: 11, y: 10 });
    expect(cells).toHaveLength(80);
    expect(paintLandCells(map.id, cells, 2, true)).toBe(true);
    const levels = current().relief!.levels;
    const inside = new Set(cells);
    expect(levels.filter((v, i) => inside.has(i) && v === 2)).toHaveLength(80);
    expect(levels.filter((v, i) => !inside.has(i) && v !== 0)).toHaveLength(0);
  });

  it("물 칸은 깊이를 늘 기록하고(가장자리 얕은 물), 낮은 땅으로 덮으면 물이 걷힌다", () => {
    const map = current();
    const lake = landRectCells(map, { x: 1, y: 1 }, { x: 5, y: 4 });
    paintLandCells(map.id, lake, "water", true);
    const depth = current().terrainDesign!.waterDepth!;
    expect(lake.every((i) => depth[i]! > 0)).toBe(true);
    expect(depth[1 * map.width + 1]).toBe(1);
    expect(depth[2 * map.width + 2]).toBeGreaterThan(1);
    paintLandCells(map.id, landBrushCells(map, { x: 3, y: 2 }, 3), 0, true);
    expect(current().terrainDesign?.waterDepth?.[2 * map.width + 3] ?? 0).toBe(0);
  });

  it("잠긴 칸은 높이를 바꾸지 않는다", () => {
    const map = current();
    store.updateMap(map.id, (draft) => { draft.terrainDesign = { lockedCells: [map.width + 1] }; });
    paintLandCells(map.id, landBrushCells(map, { x: 1, y: 1 }, 3), 4, true);
    expect(current().relief!.levels[map.width + 1]).toBe(0);
    expect(current().relief!.levels[map.width + 2]).toBe(4);
  });
});
