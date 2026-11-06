import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { planSelectionVillage } from "@/editor/selectionVillage";
import { terrainFrameViolations } from "@/project/terrainFrame";

function plateauProject() {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  const levels = new Array<number>(map.width * map.height).fill(0);
  for (let y = 2; y < 13; y++) for (let x = 2; x < 18; x++) levels[y * map.width + x] = 2;
  map.relief = { width: map.width, height: map.height, levels };
  map.terrainDesign = { frameLock: true };
  return { project, map };
}

describe("선택 안 마을", () => {
  it("땅 모양 잠금이 켜져도 선택 안에만 집을 짓고 높이·경사로·물은 그대로다", () => {
    const { project, map } = plateauProject();
    const tileset = project.tilesets[map.tilesetId]!;
    const rect = { x: 4, y: 3, width: 12, height: 10 };
    const plan = planSelectionVillage(map, tileset, rect);
    expect(plan.houses).toBeGreaterThanOrEqual(2);
    const next = structuredClone(project);
    plan.apply!(next.maps[map.id]!);
    const before = project.maps[map.id]!, after = next.maps[map.id]!;
    for (let i = 0; i < before.lowerTiles.length; i++) {
      const x = i % before.width, y = Math.floor(i / before.width);
      const inRect = x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
      if (!inRect) expect([after.lowerTiles[i], after.upperTiles[i]]).toEqual([before.lowerTiles[i], before.upperTiles[i]]);
    }
    expect(terrainFrameViolations(project, next)).toEqual([]);
  });

  it("잠긴 칸뿐이면 짓지 않고 잠금 때문이라고 알린다", () => {
    const { project, map } = plateauProject();
    map.terrainDesign = { lockedCells: Array.from({ length: map.width * map.height }, (_, i) => i) };
    const plan = planSelectionVillage(map, project.tilesets[map.tilesetId]!, { x: 4, y: 3, width: 12, height: 10 });
    expect(plan.apply).toBeUndefined();
    expect(plan.blockedByLocks).toBe(true);
  });
});
