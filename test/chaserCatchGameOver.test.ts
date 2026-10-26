// 2026-10-26 j80: 추격자에게 잡히면 게임 오버다 — 헤드리스 시험(run_scene_test)으로 확인한다.
// 그때 「게임 오버: 기대 true, 실제 false」는 시험이 주인공을 벽 덩이 안에 놓아서였다 — 그런 칸은 이제 경고한다.
import { describe, expect, it } from "vitest";

import { getTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

describe("추격자에게 잡히면 게임 오버", () => {
  it("killOnTouch 추격자 옆 걸을 칸에서 기다리면 게임 오버가 된다", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.startPos = { x: 1, y: 1 };
    const made = getTool("make_chase_scene")!.run(project, { mapId, chaser: { at: { x: 12, y: 10 }, sightRange: 5 }, killOnTouch: true });
    const { x, y } = made.data as { x: number; y: number };
    const result = getTool("run_scene_test")!.run(project, { mapId, start: { x: x - 2, y }, steps: [{ kind: "wait", ticks: 600 }, { kind: "expect", gameOver: true }] });
    expect(result.summary).toContain("성공");
  });

  it("주인공을 맵 밖·걸을 수 없는 칸에 놓는 set 은 경고한다", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId]!;
    const result = getTool("run_scene_test")!.run(project, { mapId, start: { x: 1, y: 1 }, steps: [{ kind: "set", x: map.width + 3, y: 1 }] });
    expect((result.warnings ?? []).join(" ")).toContain("걸을 수 없는 칸");
  });
});
