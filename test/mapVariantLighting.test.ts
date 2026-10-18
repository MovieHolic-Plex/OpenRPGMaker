import { describe, expect, it } from "vitest";
import { getTool } from "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { buildMapGraph, checkLightingLeak } from "@/qa/gameCheck/mapGraph";
import type { GameEvent, GameMap, Project } from "@/project/types";

function door(id: string, x: number, y: number, mapId: string): GameEvent {
  return {
    id, name: id, x, y, trigger: "playerTouch", commands: [],
    pages: [{ id: `${id}_p`, trigger: "playerTouch", priority: "below", conditions: [], commands: [{ kind: "transfer", mapId, x: 1, y: 1 }] }],
  } as unknown as GameEvent;
}

function addMap(project: Project, id: string, name: string): GameMap {
  const map = createBlankMap(name, 10, 10, project.maps[project.startMapId]!.tilesetId);
  map.id = id;
  project.maps[id] = map;
  return map;
}

/** 시작 마을 → 사원, 시작 마을 → 폐허, 폐허 → 사원. 사원은 조명이 없다. */
function leakyWorld(): Project {
  const project = createBlankProject();
  const start = project.maps[project.startMapId]!;
  addMap(project, "temple", "사원");
  const ruin = addMap(project, "ruin", "마을 (붕괴 후)");
  ruin.defaultLighting = { ambient: 0.52, color: "#3a2016", sources: [] };
  start.events.push(door("to_temple", 2, 2, "temple"), door("to_ruin", 3, 2, "ruin"));
  ruin.events.push(door("ruin_to_temple", 2, 2, "temple"));
  return project;
}

describe("시대 조명 새기(jrpg-loop-4 R6)", () => {
  it("밝은 길과 어두운 길 양쪽에서 들어오는 조명 없는 맵을 map-lighting-leak 로 잡는다", () => {
    // Break: 폐허에서 시작하는 ff2 는 붕괴 전 왕도까지 잿빛으로 덮였는데 검사기는 아무 말도 하지 않았다.
    const project = leakyWorld();
    const findings = checkLightingLeak(project, buildMapGraph(project));
    expect(findings.map((finding) => [finding.code, finding.where?.mapId])).toEqual([["map-lighting-leak", "temple"]]);
    expect(findings[0]!.message).toContain("마을 (붕괴 후)");
  });

  it("어두운 맵에서만 들어오는 맵(폐허 안의 방)은 늘 같은 조명이라 잡지 않는다", () => {
    const project = leakyWorld();
    project.maps[project.startMapId]!.events = project.maps[project.startMapId]!.events.filter((event) => event.id !== "to_temple");
    expect(checkLightingLeak(project, buildMapGraph(project))).toEqual([]);
  });

  it("derive_map_variant 는 시대 조명을 입히면 원본·문 너머 맵에 밝은 조명을 박아 새지 않게 한다", () => {
    const project = createBlankProject();
    const town = project.maps[project.startMapId]!;
    addMap(project, "shrine", "사당");
    town.events.push(door("to_shrine", 2, 2, "shrine"));
    const result = getTool("derive_map_variant")!.run(project, {
      sourceMapId: town.id,
      variants: [{ id: "town_ruin", name: "마을 (붕괴 후)", era: "ruin" }, { id: "town_alt", name: "마을 (다른 세계)", look: "none" }],
    });
    expect(project.maps.town_ruin!.defaultLighting?.ambient).toBeGreaterThan(0.3);
    expect(town.defaultLighting).toEqual({ ambient: 0, sources: [] });
    expect(project.maps.shrine!.defaultLighting).toEqual({ ambient: 0, sources: [] });
    expect(project.maps.town_alt!.defaultLighting).toEqual({ ambient: 0, sources: [] });
    expect((result.data as { pinnedLighting?: string[] }).pinnedLighting).toEqual(expect.arrayContaining([town.id, "shrine", "town_alt"]));
    expect(checkLightingLeak(project, buildMapGraph(project))).toEqual([]);
  });

  it("시대 조명이 없는 변형만 만들면 원본 조명을 건드리지 않는다", () => {
    const project = createBlankProject();
    const town = project.maps[project.startMapId]!;
    getTool("derive_map_variant")!.run(project, { sourceMapId: town.id, variants: [{ id: "town_alt", name: "마을 (다른 세계)", look: "none" }] });
    expect(town.defaultLighting).toBeUndefined();
  });
});
