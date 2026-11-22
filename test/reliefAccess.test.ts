// 지형 리뷰 F3·F7: 경사로 없는 고원은 걸어 오를 수 없는데 도구가 말하지 않았다.
import { describe, expect, it } from "vitest";
import { planReliefRamp } from "@/editor/reliefRampPlan";
import { reliefAccess } from "@/editor/tools/reliefAccess";
import { createBlankProject } from "@/project/defaults";
import { reliefFromGrid } from "@/project/relief/types";

describe("높은 땅 통행 검사", () => {
  it("경사로 없는 고원을 도달 못 함으로 세고, 제안한 자리에 경사로를 놓으면 0이 된다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const start = project.startPos;
    const x0 = start.x >= map.width / 2 ? 1 : map.width - 9, x1 = x0 + 7;
    const grid = Array.from({ length: map.height }, (_, y) =>
      Array.from({ length: map.width }, (_, x) => (x >= x0 && x <= x1 && y >= 2 && y <= 8 ? 2 : 0)));
    map.relief = reliefFromGrid(grid);

    const before = reliefAccess(project, map);
    expect(before).not.toBeNull();
    expect(before!.unreachableHigh).toBe(before!.highCells);
    expect(before!.unreachableHigh).toBeGreaterThan(0);
    const ramp = before!.regions[0]!.ramp;
    expect(ramp).not.toBeNull();
    expect(before!.text).toContain("place_terrain_ramp");

    const plan = planReliefRamp(map, { ...ramp!, face: "top" }, 2, false);
    expect(plan.ok).toBe(true);
    plan.apply!(map);
    expect(reliefAccess(project, map)!.unreachableHigh).toBe(0);
  });
});
