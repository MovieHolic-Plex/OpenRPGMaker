import { describe, expect, it } from "vitest";
import { getTool, runTool, toOpenAiTools, type ToolContext } from "@/editor/tools";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import type { GameEvent, Project } from "@/project/types";

function merchant(): GameEvent {
  return {
    id: "ev_hana",
    x: 6,
    y: 9,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "ev_hana_page_1",
        name: "상인 하나",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      },
    ],
  };
}

function fixture(): Project {
  const project = createBlankProject();
  const start = project.maps[project.startMapId];
  if (!start) throw new Error("blank project has no start map");
  start.name = "햇살 마을";
  start.events = [merchant()];
  const house = createBlankMap("상인 하나의 집", 20, 16);
  house.id = "map_house_interior_1";
  project.maps[house.id] = house;
  return project;
}

function context(project: Project): ToolContext {
  return { project };
}

function focus(project: Project, args: Record<string, unknown>) {
  return runTool(context(project), "focus_editor_view", args);
}

describe("focus_editor_view", () => {
  it("is registered as a read tool", () => {
    const tool = getTool("focus_editor_view");

    expect(tool?.mode).toBe("read");
  });

  // 노출되지 않으면 기능이 없는 것과 같다 — "어디야?" 는 도메인 상황을 가리지 않고 들어오므로
  // 타일·이벤트처럼 상한(40) 트림이 세게 걸리는 모드에서도 남아야 한다.
  it("stays exposed to the model in every tool mode", () => {
    for (const mode of ["map", "tile", "event", "quest", "system"] as const) {
      const exposed = new Set(toOpenAiTools(undefined, { mode }).map((entry) => entry.function.name));
      expect(exposed.has("focus_editor_view"), `mode=${mode}`).toBe(true);
    }
  });

  it("resolves a map name to that map's full area", () => {
    const project = fixture();

    const result = focus(project, { query: "상인 하나의 집" });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      mapId: "map_house_interior_1",
      x: 0,
      y: 0,
      w: 20,
      h: 16,
      label: "상인 하나의 집",
      kind: "map",
    });
  });

  it("resolves an event name to its own tile", () => {
    const project = fixture();

    const result = focus(project, { query: "상인 하나" });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      mapId: project.startMapId,
      x: 6,
      y: 9,
      w: 1,
      h: 1,
      kind: "event",
      eventId: "ev_hana",
    });
  });

  it("clamps an explicit rectangle into the map", () => {
    const project = fixture();

    const result = focus(project, { mapId: "map_house_interior_1", x: 18, y: 14, w: 40, h: 40 });

    expect(result.data).toMatchObject({ mapId: "map_house_interior_1", x: 18, y: 14, w: 2, h: 2 });
  });

  it("fails with a name the project does not have", () => {
    const result = focus(fixture(), { query: "용의 성" });

    expect(result.ok).toBe(false);
    expect(result.summary).toContain("찾지 못했습니다");
  });

  it("refuses to guess when several places share the name", () => {
    const project = createBlankProject();
    const first = createBlankMap("여관", 20, 16);
    first.id = "map_inn_a";
    const second = createBlankMap("여관", 20, 16);
    second.id = "map_inn_b";
    project.maps = { [first.id]: first, [second.id]: second };
    project.startMapId = first.id;

    const result = focus(project, { query: "여관" });

    expect(result.ok).toBe(false);
    expect(result.summary).toContain("2곳");
  });

  it("needs either a name or a map id", () => {
    const result = focus(fixture(), {});

    expect(result.ok).toBe(false);
  });

  it("changes nothing in the project", () => {
    const project = fixture();
    const before = JSON.stringify(project);

    focus(project, { query: "상인 하나" });

    expect(JSON.stringify(project)).toBe(before);
  });
});
