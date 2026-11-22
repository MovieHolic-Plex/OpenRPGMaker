import { beforeEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { applyTerrainPreset, hillPresetCells, pathPresetPoints, riverPresetCells } from "@/editor/terrainPresets";

function current() {
  const project = store.getCurrent();
  return project.maps[project.startMapId]!;
}

describe("한 번에 프리셋 붓", () => {
  beforeEach(() => { store.replaceProject(createBlankProject()); });

  it("칸 계산: 언덕 7×5에서 귀퉁이 넷을 뺀 31칸, 강은 모든 줄, 오솔길은 맵 너비만큼", () => {
    const map = current();
    expect(hillPresetCells(map, { x: 10, y: 7 })).toHaveLength(31);
    const river = riverPresetCells(map, { x: 10, y: 7 });
    expect(new Set(river.map((i) => Math.floor(i / map.width))).size).toBe(map.height);
    const path = pathPresetPoints(map, { x: 10, y: 7 });
    expect(new Set(path.map((p) => p.x)).size).toBe(map.width);
    // 줄이 바뀌는 곳도 상하좌우로 이어져 걸을 수 있다.
    const key = new Set(path.map((p) => `${p.x},${p.y}`));
    expect(path.every((p) => p.x === 0 || key.has(`${p.x - 1},${p.y}`) || key.has(`${p.x},${p.y - 1}`) || key.has(`${p.x},${p.y + 1}`))).toBe(true);
  });

  it("언덕 하나는 높은 땅 31칸과 걸어 오를 경사로를 함께 깐다", () => {
    const map = current();
    expect(applyTerrainPreset(map.id, "hill", { x: 10, y: 6 }, true)).toBe(true);
    const after = current();
    expect(after.relief!.levels.filter((v) => v === 2).length).toBeGreaterThanOrEqual(25);
    expect((after.relief!.ramps ?? []).some(Boolean)).toBe(true);
  });

  it("강 하나는 위에서 아래까지 물 깊이를 기록한다", () => {
    const map = current();
    expect(applyTerrainPreset(map.id, "river", { x: 10, y: 7 }, true)).toBe(true);
    const depth = current().terrainDesign?.waterDepth ?? [];
    const wetRows = new Set(depth.flatMap((d, i) => (d > 0 ? [Math.floor(i / map.width)] : [])));
    expect(wetRows.size).toBe(map.height);
  });
});
