import { describe, expect, it } from "vitest";
import { searchProject } from "@/editor/panels/mapEventSearchModel";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import type { GameEvent, Project } from "@/project/types";

function event(id: string, name: string, commands: GameEvent["commands"] = []): GameEvent {
  return {
    id,
    x: 2,
    y: 3,
    trigger: { kind: "action" },
    commands,
    pages: [
      {
        id: `${id}_page_1`,
        name,
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands,
      },
    ],
  };
}

function fixture(): Project {
  const project = createBlankProject();
  const start = project.maps[project.startMapId]!;
  start.name = "햇살 마을";
  start.events = [event("ev_gate", "북문 수문장")];

  const forest = createBlankMap("Moonlit Forest", 12, 12);
  forest.id = "map_moonlit_forest";
  forest.events = [
    event("ev_owl", "Night Owl", [{ kind: "setSwitch", switchId: "sw_moon_gate", value: true }]),
  ];
  project.maps[forest.id] = forest;
  project.switches = [{ id: "sw_moon_gate", name: "Moon Gate Open" }];
  project.variables = [{ id: "var_moon_count", name: "Moon Count" }];
  project.commonEvents = [{ id: "common_moon", name: "Moon Cycle", trigger: "none", commands: [] }];
  return project;
}

describe("mapEventSearchModel", () => {
  it("맵 이름 부분 일치 결과에 이동할 mapId를 담는다", () => {
    const project = fixture();
    const results = searchProject({ project, selectedMapId: project.startMapId, query: "Forest", scope: "all" });

    expect(results).toContainEqual(expect.objectContaining({
      kind: "map",
      name: "Moonlit Forest",
      target: { kind: "map", mapId: "map_moonlit_forest" },
    }));
  });

  it("모든 페이지의 이벤트 이름을 찾고 mapId와 eventId를 담는다", () => {
    const project = fixture();
    const results = searchProject({ project, selectedMapId: project.startMapId, query: "owl", scope: "all" });

    expect(results).toContainEqual(expect.objectContaining({
      kind: "mapEvent",
      name: "Night Owl",
      target: { kind: "event", mapId: "map_moonlit_forest", eventId: "ev_owl" },
    }));
  });

  it("스위치 이름과 id를 찾고 참조하는 맵 이벤트를 함께 돌려준다", () => {
    const project = fixture();
    const [result] = searchProject({ project, selectedMapId: project.startMapId, query: "sw_moon", scope: "all" })
      .filter((entry) => entry.kind === "switch");

    expect(result).toEqual(expect.objectContaining({
      kind: "switch",
      name: "Moon Gate Open",
      references: [expect.objectContaining({ mapId: "map_moonlit_forest", eventId: "ev_owl" })],
    }));
  });

  it("빈 질의는 결과를 돌려주지 않는다", () => {
    const project = fixture();
    expect(searchProject({ project, selectedMapId: project.startMapId, query: "   ", scope: "all" })).toEqual([]);
  });

  it("대소문자를 무시해 맵·이벤트·공통 이벤트·변수 이름을 찾는다", () => {
    const project = fixture();
    project.maps.map_moonlit_forest!.events[0]!.pages![0]!.commands = [
      { kind: "setVariable", variableId: "var_moon_count", op: "=", value: 1 },
    ];
    const results = searchProject({ project, selectedMapId: project.startMapId, query: "MOON", scope: "all" });
    const eventResults = searchProject({ project, selectedMapId: project.startMapId, query: "NIGHT OWL", scope: "all" });

    expect(results.map((result) => result.kind)).toEqual(expect.arrayContaining([
      "map",
      "commonEvent",
      "variable",
    ]));
    expect(eventResults).toContainEqual(expect.objectContaining({ kind: "mapEvent", name: "Night Owl" }));
  });
});
