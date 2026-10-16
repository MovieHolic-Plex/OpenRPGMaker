// jrpg-loop-1 ct1: 그림 없는 시간의 문은 화면에 아무 표시도 없어 플레이어가 문을 찾을 수 없었다 — 문 칸에 빛(파티클) 병렬 이벤트를 단다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, Project } from "@/project/types";

function twoMaps(): { project: Project; a: string } {
  const project = createBlankProject();
  const a = project.startMapId;
  const copy = structuredClone(project.maps[a]!);
  copy.id = "map_b";
  copy.name = "B";
  copy.events = [];
  project.maps.map_b = copy;
  return { project, a };
}

const beaconsOf = (project: Project, mapId: string): GameEvent[] => project.maps[mapId]!.events.filter((event) => event.id.startsWith("ev_beacon"));

describe("create_time_gate beacon", () => {
  it("adds a magic-particle parallel event on each gate tile of a transparent gate", () => {
    const { project, a } = twoMaps();
    const ctx = { project };
    const result = runTool(ctx as never, "create_time_gate", { a: { mapId: a, x: 5, y: 5 }, b: { mapId: "map_b", x: 6, y: 6 }, name: "시간의 문" });
    expect(result.ok).toBe(true);
    for (const [mapId, x, y] of [[a, 5, 5], ["map_b", 6, 6]] as const) {
      const beacons = beaconsOf(ctx.project, mapId);
      expect(beacons).toHaveLength(1);
      expect(beacons[0]).toMatchObject({ x, y, trigger: { kind: "parallel" } });
      const commands = beacons[0]!.pages![0]!.commands;
      expect(commands[0]).toMatchObject({ kind: "m2Command", commandId: "m2-224-particle-effect", fields: { preset: "magic", target: "tile", x, y, wait: false } });
      expect(commands[1]).toMatchObject({ kind: "wait" });
    }
  });
});
