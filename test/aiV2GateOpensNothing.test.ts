import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { gatesThatOpenNothing } from "@/ai/v2/puzzleChecks";
import type { Project } from "@/project/types";

// 판정 J1(약초 동굴): 다리 레버가 칸을 열지만 다리 없이도 보스 방까지 걸어갔다.
// 7×3 방, x=3 은 벽 기둥. 레버가 (3,1) 을 바닥으로 바꾼다. 벽에 다른 틈이 있으면 레버는 아무것도 안 연다.
function corridor(extraGap: boolean): Project {
  const project = createBlankProject() as Project;
  const map = project.maps[project.startMapId]!;
  const open = { up: true, down: true, left: true, right: true };
  const shut = { up: false, down: false, left: false, right: false };
  const tilesetId = "ts_gate_probe";
  project.tilesets[tilesetId] = { ...structuredClone(Object.values(project.tilesets)[0]!), id: tilesetId, passability: [open, shut], passageMarks: undefined } as never;
  const W = 7, H = 3;
  Object.assign(map, { width: W, height: H, tilesetId, lowerTiles: Array(W * H).fill(0), upperTiles: Array(W * H).fill(-1), events: [] });
  for (let y = 0; y < H; y += 1) map.lowerTiles[y * W + 3] = 1;
  if (extraGap) map.lowerTiles[2 * W + 3] = 0;
  delete (map as { layers?: unknown }).layers;
  project.startPos = { x: 0, y: 1 };
  map.events.push({
    id: "ev_lever", name: "다리 레버", x: 1, y: 0,
    pages: [{ conditions: [], trigger: { kind: "action" }, commands: [{ kind: "changeTile", mapId: map.id, layer: "lower", x: 3, y: 1, tile: 0 }, { kind: "setSwitch", switchId: "sw_bridge", value: true }] }],
  } as never);
  return project;
}

describe("gatesThatOpenNothing (J1 lever that gates nothing)", () => {
  it("passes a lever whose tile change is the only way across", () => {
    expect(gatesThatOpenNothing(corridor(false))).toEqual([]);
  });
  it("flags a lever when the far side is already reachable through another gap", () => {
    const problems = gatesThatOpenNothing(corridor(true));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("다리 레버");
  });
});
