// 첫 MVP 팀의 세계 뼈대 미리 짓기(src/ai/piAgent/teamMvpPrebuild.ts)와 맵 담당 반납 전 자체 검사(teamMvp.ts mvpBuilderProblems).
// 계획은 2026-11-25 team-mvp-revive r8 의 팀장 build_world 인자 그대로다(시작 마을 → 숲 → 동굴).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { projectLint } from "@/project/lint/projectLint";
import { isPassableLanding } from "@/project/collision";
import { prebuildMvpWorld, dungeonTypeFor } from "@/ai/piAgent/teamMvpPrebuild";
import { checkTeamMvp, mvpBuilderProblems } from "@/ai/piAgent/teamMvp";
import { MVP_REACHED_SWITCH } from "@/project/gameBlueprint";
import type { Project } from "@/project/types";

const NODES = [
  { mapId: "map_blank_start", role: "town", label: "강변 마을", width: 40, height: 30, concept: "늦여름 강변 출발 마을" },
  { mapId: "map_forest", role: "dungeon", label: "깊은 숲", width: 36, height: 30, concept: "마을 북쪽 깊은 숲" },
  { mapId: "map_cave", role: "dungeon", label: "마물의 동굴", width: 36, height: 30, concept: "숲 너머 마물이 사는 동굴" },
];
const EDGES = [
  { kind: "transfer", from: { mapId: "map_blank_start", exit: { side: "north" } }, to: { mapId: "map_forest", entry: { side: "south" } } },
  { kind: "transfer", from: { mapId: "map_forest", exit: { side: "north" } }, to: { mapId: "map_cave", entry: { side: "south" } } },
];

function skeleton(): Project {
  const ctx = { project: createBlankProject() };
  const result = runTool(ctx, "build_world", { plan: { nodes: NODES, edges: EDGES } });
  expect(result.ok, result.summary).toBe(true);
  return ctx.project;
}

describe("prebuildMvpWorld", () => {
  it("builds every place map in place with no new maps, keeps the world gates walkable and passes the commit lint", () => {
    const pre = prebuildMvpWorld(skeleton(), NODES);
    expect(pre.built).toEqual(["map_blank_start", "map_forest", "map_cave"]);
    expect(Object.keys(pre.project.maps).sort()).toEqual(["map_blank_start", "map_cave", "map_forest"]);
    const town = pre.project.maps.map_blank_start!;
    expect(town.width).toBeGreaterThanOrEqual(36);
    for (const map of Object.values(pre.project.maps)) {
      const gates = map.events.filter((event) => event.id.startsWith("ev_world_gate"));
      expect(gates.length).toBeGreaterThan(0);
      for (const gate of gates) expect(isPassableLanding(pre.project, map, gate.x, gate.y), `${map.id} ${gate.id}`).toBe(true);
    }
    expect(projectLint(pre.project, { skipRoundtrip: true }).filter((issue) => issue.severity === "error")).toEqual([]);
    const verdict = checkTeamMvp(structuredClone(pre.project));
    expect(verdict.problems.filter((problem) => !problem.startsWith("끝 지점이 없다"))).toEqual([]);
    expect(verdict.fixes.map((fix) => fix.mapId)).toEqual(["map_cave"]);
  });

  it("builds an interior node as a hand-dot room in place and puts its world gate on a walkable floor", () => {
    const pre = prebuildMvpWorld(skeleton(), [{ mapId: "map_forest", role: "interior", label: "할머니 집 부엌" }]);
    expect(pre.built).toEqual(["map_forest"]);
    const room = pre.project.maps.map_forest!;
    expect(room.tilesetId).toBe("atlas_biome_interior");
    for (const gate of room.events.filter((event) => event.id.startsWith("ev_world_gate"))) expect(isPassableLanding(pre.project, room, gate.x, gate.y)).toBe(true);
    expect(projectLint(pre.project, { skipRoundtrip: true }).filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("reads the dungeon kind from the place name", () => {
    expect(dungeonTypeFor("dungeon", "깊은 숲")).toBe("forest");
    expect(dungeonTypeFor("dungeon", "마물의 동굴")).toBe("cave");
    expect(dungeonTypeFor("field", "들판")).toBe("forest");
  });
});

describe("checkTeamMvp endpoint reach", () => {
  it("moves an endpoint event that stands out of reach to the nearest walkable cell instead of rejecting finish", () => {
    const project = prebuildMvpWorld(skeleton(), NODES).project;
    const cave = project.maps.map_cave!;
    let wall: { x: number; y: number } | undefined;
    for (let y = 1; y < cave.height - 1 && !wall; y += 1) for (let x = 1; x < cave.width - 1 && !wall; x += 1) {
      const around = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => !isPassableLanding(project, cave, x + dx!, y + dy!));
      if (around) wall = { x, y };
    }
    expect(wall).toBeDefined();
    const gate = cave.events.find((event) => event.id.startsWith("ev_world_gate"))!;
    const page = gate.pages![0]!;
    cave.events.push({ ...gate, id: "ev_goal", name: "끝", x: wall!.x, y: wall!.y, trigger: { kind: "action" },
      pages: [{ ...page, trigger: { kind: "action" }, commands: [{ kind: "setSwitch", switchId: MVP_REACHED_SWITCH, value: true }] }] } as never);
    const verdict = checkTeamMvp(project);
    expect(verdict.problems).toEqual([]);
    expect(verdict.applied.some((line) => line.includes("ev_goal"))).toBe(true);
  });
});

describe("mvpBuilderProblems", () => {
  it("sends the goal-map builder back when its map has no endpoint, and passes once the switch is set", () => {
    const project = prebuildMvpWorld(skeleton(), NODES).project;
    const task = `마지막 장소. 보스를 이기면 ${MVP_REACHED_SWITCH} 를 켠다.`;
    const never = () => false;
    expect(mvpBuilderProblems(project, "map_cave", task, never)).toContain(MVP_REACHED_SWITCH);
    expect(mvpBuilderProblems(project, "map_forest", "숲에 사람을 둔다", never)).toBeNull();
    project.maps.map_cave!.events.push({ id: "ev_goal", name: "끝", x: 1, y: 1, pages: [{ conditions: [], commands: [{ kind: "setSwitch", switchId: MVP_REACHED_SWITCH, value: true }] }] } as never);
    expect(mvpBuilderProblems(project, "map_cave", task, never)).toBeNull();
  });
});
