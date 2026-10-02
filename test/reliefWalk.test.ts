// test/reliefWalk.test.ts
// 높이 지형(map.relief) 걷기 규칙 — canMove 가 단 차를 막고 경사로 축으로만 오르내리게 한다.
import { describe, it, expect } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { canMove } from "@/project/collision";
import { rampCode, reliefSlopes } from "@/project/relief/walk";
import { normalizeRelief } from "@/project/relief/edit";
import { computeReachableCells } from "@/project/lint/reachability";
import type { GameMap, Project } from "@/project/types";

// 평지 맵 위에 x ≥ 6 이 2단 대지, (5, 3) 은 동쪽으로 오르는 경사로(낮은 끝 0단).
function hill(): { project: Project; map: GameMap } {
  const project = createBlankProject();
  const map = project.maps[project.startMapId]!;
  const levels = new Array(map.width * map.height).fill(0).map((_, i) => ((i % map.width) >= 6 ? 2 : 0));
  const ramps = new Array(map.width * map.height).fill(0);
  ramps[3 * map.width + 5] = rampCode("e");
  map.relief = { width: map.width, height: map.height, levels, ramps };
  return { project, map };
}

describe("relief walk rule", () => {
  it("단이 다른 이웃으로는 못 간다", () => {
    const { project, map } = hill();
    expect(canMove(project, map, 5, 1, 6, 1)).toBe(false);
    expect(canMove(project, map, 6, 1, 5, 1)).toBe(false);
  });
  it("같은 단 안에서는 그대로 걷는다", () => {
    const { project, map } = hill();
    expect(canMove(project, map, 2, 1, 3, 1)).toBe(true);
    expect(canMove(project, map, 7, 1, 8, 1)).toBe(true);
  });
  it("경사로 칸에서 오르막 방향으로 윗단에 오르고, 윗단에서 경사로로 내려선다", () => {
    const { project, map } = hill();
    expect(canMove(project, map, 4, 3, 5, 3)).toBe(true);
    expect(canMove(project, map, 5, 3, 6, 3)).toBe(true);
    expect(canMove(project, map, 6, 3, 5, 3)).toBe(true);
  });
  it("경사로 옆구리로는 드나들지 않는다", () => {
    const { project, map } = hill();
    expect(canMove(project, map, 5, 2, 5, 3)).toBe(false);
    expect(canMove(project, map, 5, 3, 5, 4)).toBe(false);
  });
  it("경사로 표기는 불러오기 정규화를 지나도 남고 렌더 사각형이 된다", () => {
    const { map } = hill();
    const back = normalizeRelief(JSON.parse(JSON.stringify(map.relief)), map.width, map.height)!;
    expect(back.ramps?.[3 * map.width + 5]).toBe(rampCode("e"));
    expect(reliefSlopes(back)).toEqual([{ x: 5, y: 3, w: 1, h: 1, dir: "e", lo: 0, hi: 2 }]);
  });
  it("도달성 BFS 도 경사로로만 윗단에 닿는다 — 경사로를 막으면 윗단은 닿지 않는다", () => {
    const { project, map } = hill();
    expect(computeReachableCells(project, map, 1, 1).has("8,1")).toBe(true);
    map.relief!.ramps = new Array(map.width * map.height).fill(0);
    const cut = computeReachableCells(project, map, 1, 1);
    expect(cut.has("8,1")).toBe(false);
    expect(cut.has("5,1")).toBe(true);
  });
  it("relief 가 없는 맵은 예전과 같다", () => {
    const { project, map } = hill();
    delete map.relief;
    expect(canMove(project, map, 5, 1, 6, 1)).toBe(true);
  });
});
