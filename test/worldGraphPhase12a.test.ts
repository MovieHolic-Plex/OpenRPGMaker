import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { allTools } from "@/editor/tools/toolRegistry";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { TILE } from "@/project/defaults/constants";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { projectLint } from "@/project/lint/projectLint";
import type { Command, GameEvent, GameMap } from "@/project/types";

function ctx(title = "월드 그래프 테스트"): ToolContext {
  return { project: createEmptyToolProject(title) };
}

function createMap(context: ToolContext, id: string, width = 12, height = 10): void {
  const result = runTool(context, "create_map", { id, name: id, width, height });
  expect(result.ok, result.summary).toBe(true);
}

function worldPlan(nodes: readonly Record<string, unknown>[], edges: readonly unknown[] = []) {
  return { nodes, edges };
}

function pageTransferEvent(id: string, x: number, y: number, command: Command): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: id,
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "playerTouch" },
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [command],
      },
    ],
  };
}

function transferCommands(map: GameMap, targetMapId: string): Extract<Command, { kind: "transfer" }>[] {
  return map.events.flatMap((event) =>
    (event.pages ?? []).flatMap((page) => page.commands)
  ).filter((command): command is Extract<Command, { kind: "transfer" }> =>
    command.kind === "transfer" && command.mapId === targetMapId
  );
}

describe("Phase 12a worldGraph tools", () => {
  it("툴 레지스트리에 월드 그래프 툴 4종이 노출된다", () => {
    const byName = new Map(allTools().map((tool) => [tool.name, tool]));
    expect(byName.get("plan_world")?.mode).toBe("write");
    expect(byName.get("link_maps")?.mode).toBe("write");
    expect(byName.get("build_world")?.mode).toBe("write");
    expect(byName.get("lint_world")?.mode).toBe("read");
  });

  it("worldGraph 스키마는 edge의 미선언 mapId와 중복 edge를 거부한다", () => {
    const context = ctx();
    const missing = runTool(context, "plan_world", {
      nodes: [{ mapId: "map_town", role: "town" }],
      edges: [{ from: { mapId: "map_town" }, to: { mapId: "map_missing" } }],
    });
    expect(missing.ok).toBe(false);
    expect(missing.issues?.[0]?.code).toBe("world-graph-invalid");

    const duplicate = runTool(context, "plan_world", {
      nodes: [
        { mapId: "map_town", role: "town" },
        { mapId: "map_field", role: "field" },
      ],
      edges: [
        { from: { mapId: "map_town", exit: { side: "east" } }, to: { mapId: "map_field", entry: { side: "west" } }, kind: "adjacent" },
        { from: { mapId: "map_town", exit: { side: "east" } }, to: { mapId: "map_field", entry: { side: "west" } }, kind: "adjacent" },
      ],
    });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.issues?.[0]?.code).toBe("world-graph-invalid");
  });

  it("plan_world는 future mapId 계획을 등록하고 serialize/deserialize 왕복 보존한다", () => {
    const context: ToolContext = { project: createBlankProject() };
    const result = runTool(context, "plan_world", {
      nodes: [
        { mapId: "map_town", role: "town", label: "북쪽 마을" },
        { mapId: "map_field", role: "field" },
      ],
      edges: [{ from: { mapId: "map_town", exit: { side: "east" } }, to: { mapId: "map_field", entry: { side: "west" } } }],
    });

    expect(result.ok, result.summary).toBe(true);
    expect(context.project.worldGraph?.nodes.map((node) => node.mapId)).toEqual(["map_town", "map_field"]);
    const reloaded = deserialize(serialize(context.project));
    expect(reloaded.worldGraph).toEqual(context.project.worldGraph);
    expect(projectLint(context.project).some((issue) => issue.code === "world-graph-map-missing")).toBe(true);
  });

  it("link_maps는 양방향 출입구를 만들고 재실행해도 같은 이벤트를 갱신한다", () => {
    const context = ctx();
    createMap(context, "map_a");
    createMap(context, "map_b");

    const first = runTool(context, "link_maps", {
      from: { mapId: "map_a", x: 10, y: 5 },
      to: { mapId: "map_b", x: 1, y: 5 },
    });
    expect(first.ok, first.summary).toBe(true);
    const eventIdsA = context.project.maps.map_a.events.map((event) => event.id);
    const eventIdsB = context.project.maps.map_b.events.map((event) => event.id);
    expect(eventIdsA).toHaveLength(1);
    expect(eventIdsB).toHaveLength(1);
    expect(transferCommands(context.project.maps.map_a, "map_b")).toHaveLength(1);
    expect(transferCommands(context.project.maps.map_b, "map_a")).toHaveLength(1);

    const second = runTool(context, "link_maps", {
      from: { mapId: "map_a", x: 10, y: 5 },
      to: { mapId: "map_b", x: 1, y: 5 },
    });
    expect(second.ok, second.summary).toBe(true);
    expect(context.project.maps.map_a.events.map((event) => event.id)).toEqual(eventIdsA);
    expect(context.project.maps.map_b.events.map((event) => event.id)).toEqual(eventIdsB);
    expect(context.project.worldGraph?.edges).toHaveLength(1);
  });

  it("build_world는 역할별 기본 지형과 던전 기본 조명을 만든다", () => {
    const context = ctx();
    const result = runTool(context, "build_world", {
      plan: worldPlan([
        { mapId: "map_town", role: "town", width: 8, height: 8 },
        { mapId: "map_field", role: "field", width: 8, height: 8 },
        { mapId: "map_dungeon", role: "dungeon", width: 8, height: 8 },
        { mapId: "map_interior", role: "interior", width: 8, height: 8 },
      ]),
    });

    expect(result.ok, result.summary).toBe(true);
    expect(new Set(context.project.maps.map_town.lowerTiles)).toEqual(new Set([TILE.GRASS]));
    expect(new Set(context.project.maps.map_field.lowerTiles)).toEqual(new Set([TILE.GRASS]));
    expect(new Set(context.project.maps.map_dungeon.lowerTiles)).toEqual(new Set([TILE.DARK_GRASS]));
    expect(context.project.maps.map_dungeon.defaultLighting).toMatchObject({ ambient: 0.75, color: "#05070a" });
    expect(new Set(context.project.maps.map_interior.lowerTiles)).toEqual(new Set([TILE.PATH]));
  });

  it("lint_world는 adjacent 경계가 이어지는 케이스와 끊기는 케이스를 구분한다", () => {
    const context = ctx();
    const result = runTool(context, "build_world", {
      plan: worldPlan(
        [
          { mapId: "map_left", role: "field", width: 8, height: 8 },
          { mapId: "map_right", role: "field", width: 8, height: 8 },
        ],
        [{ from: { mapId: "map_left", exit: { side: "east" } }, to: { mapId: "map_right", entry: { side: "west" } }, kind: "adjacent" }]
      ),
    });
    expect(result.ok, result.summary).toBe(true);
    const clean = runTool(context, "lint_world", {});
    expect(clean.ok, clean.summary).toBe(true);
    expect((clean.data as { issues: { code: string }[] }).issues).toEqual([]);

    context.project.maps.map_right.lowerTiles[4 * context.project.maps.map_right.width] = TILE.WALL;
    const broken = runTool(context, "lint_world", {});
    const codes = (broken.data as { issues: { code: string }[] }).issues.map((issue) => issue.code);
    expect(codes).toContain("world-adjacent-passability-break");
  });

  it("lint_world는 transfer 목적지 통행 불가와 이벤트 겹침을 error로 보고한다", () => {
    const project = createBlankProject();
    const mapA = project.maps[project.startMapId];
    mapA.id = "map_a";
    project.maps = { map_a: mapA };
    project.startMapId = "map_a";
    project.mapTree = { mapId: "map_a", children: [{ mapId: "map_b", children: [] }] };
    const mapB: GameMap = {
      ...structuredClone(mapA),
      id: "map_b",
      name: "map_b",
      events: [],
      lowerTiles: new Array(mapA.width * mapA.height).fill(TILE.GRASS),
      upperTiles: new Array(mapA.width * mapA.height).fill(TILE.EMPTY),
    };
    project.maps.map_b = mapB;
    project.worldGraph = {
      nodes: [
        { mapId: "map_a", role: "town" },
        { mapId: "map_b", role: "field" },
      ],
      edges: [{ from: { mapId: "map_a" }, to: { mapId: "map_b", entry: { x: 3, y: 3 } }, kind: "transfer" }],
    };
    mapA.events.push(pageTransferEvent("ev_to_b", 2, 2, { kind: "transfer", mapId: "map_b", x: 3, y: 3 }));
    mapB.lowerTiles[3 * mapB.width + 3] = TILE.WALL;
    mapB.events.push(pageTransferEvent("ev_overlap", 3, 3, { kind: "text", body: "blocked" }));

    const result = runTool({ project }, "lint_world", {});
    const issues = (result.data as { issues: { code: string; severity: string }[] }).issues;
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "world-transfer-command-impassable", severity: "error" }),
      expect.objectContaining({ code: "world-transfer-event-overlap", severity: "error" }),
    ]));
  });

  it("6맵 build_world 데모는 lint_world 클린 후 마을→필드→던전 transfer 워크스루를 통과한다", () => {
    const context = ctx("Phase 12a 6맵 월드 데모");
    const result = runTool(context, "build_world", {
      plan: worldPlan(
        [
          { mapId: "town_1", role: "town", label: "마을 1", width: 12, height: 10 },
          { mapId: "town_2", role: "town", label: "마을 2", width: 12, height: 10 },
          { mapId: "town_3", role: "town", label: "마을 3", width: 12, height: 10 },
          { mapId: "field_1", role: "field", label: "필드 1", width: 12, height: 10 },
          { mapId: "field_2", role: "field", label: "필드 2", width: 12, height: 10 },
          { mapId: "dungeon_1", role: "dungeon", label: "던전 1", width: 12, height: 10 },
        ],
        [
          { from: { mapId: "town_1", exit: { side: "east" } }, to: { mapId: "field_1", entry: { side: "west" } } },
          { from: { mapId: "field_1", exit: { side: "east" } }, to: { mapId: "dungeon_1", entry: { side: "west" } } },
          { from: { mapId: "town_2", exit: { side: "south" } }, to: { mapId: "field_1", entry: { side: "north" } } },
          { from: { mapId: "town_3", exit: { side: "south" } }, to: { mapId: "field_2", entry: { side: "north" } } },
          { from: { mapId: "field_1", exit: { side: "south" } }, to: { mapId: "field_2", entry: { side: "north" } }, kind: "adjacent" },
        ]
      ),
    });
    expect(result.ok, result.summary).toBe(true);
    expect(Object.keys(context.project.maps).sort()).toEqual(["dungeon_1", "field_1", "field_2", "town_1", "town_2", "town_3"]);

    const lint = runTool(context, "lint_world", {});
    expect(lint.ok, lint.summary).toBe(true);
    expect((lint.data as { issues: unknown[] }).issues).toEqual([]);

    const scene = runTool(context, "run_scene_test", {
      mapId: "town_1",
      start: { x: 10, y: 5 },
      steps: [
        { kind: "move", dir: "right" },
        { kind: "expect", mapId: "field_1" },
        { kind: "move", to: { x: 11, y: 5 } },
        { kind: "expect", mapId: "dungeon_1" },
      ],
    });
    expect(scene.ok, scene.summary).toBe(true);
    expect(scene.summary).toContain("scene test 성공");
  });
});
