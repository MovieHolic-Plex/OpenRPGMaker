import { describe, expect, it } from "vitest";
import { collectMapIdsInTree, repairMapTreeOrphans } from "@/project/mapTree";
import { createBlankMap, blankFillTileFor } from "@/project/defaults/defaultMaps";
import type { Project, GameEvent, GameMap } from "@/project/types";
import { getTool } from "@/editor/tools/toolRegistry";
import { createBlankProject, createStarterMap, TILE } from "@/project/defaults";
import { buildMapGraph, checkLightingLeak } from "@/qa/gameCheck/mapGraph";
import { isPassable } from "@/project/collision";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { isolateTimers } from "./mergedTeardown";

describe("mapTreeOrphans", () => {
  isolateTimers();
  function miniProject(maps: string[], tree: Project["mapTree"], startMapId?: string): Pick<Project, "maps" | "mapTree" | "startMapId"> {
    const projectMaps: Project["maps"] = {};
    for (const id of maps) {
      const m = createBlankMap(id, 4, 4);
      m.id = id;
      m.name = id;
      projectMaps[id] = m;
    }
    return { maps: projectMaps, mapTree: tree, startMapId: startMapId ?? maps[0]! };
  }
  describe("repairMapTreeOrphans", () => {
    it("attaches maps that exist in project.maps but not in mapTree", () => {
      const project = miniProject(
        ["map_a", "map_b", "map_c"],
        { mapId: "map_a", children: [] },
      );
      expect(collectMapIdsInTree(project.mapTree).size).toBe(1);
      expect(repairMapTreeOrphans(project)).toBe(true);
      expect([...collectMapIdsInTree(project.mapTree)].sort()).toEqual(["map_a", "map_b", "map_c"]);
      expect(project.mapTree.mapId).toBe("map_a");
      expect(project.mapTree.children.map((c) => c.mapId).sort()).toEqual(["map_b", "map_c"]);
    });

    it("repairs invalid root using startMapId", () => {
      const project = miniProject(
        ["map_a", "map_b"],
        { mapId: "map_missing", children: [{ mapId: "map_b", children: [] }] },
        "map_a",
      );
      expect(repairMapTreeOrphans(project)).toBe(true);
      expect(project.mapTree.mapId).toBe("map_a");
      expect(collectMapIdsInTree(project.mapTree).has("map_b")).toBe(true);
    });

    it("is a no-op when tree already covers all maps", () => {
      const project = miniProject(
        ["map_a", "map_b"],
        { mapId: "map_a", children: [{ mapId: "map_b", children: [] }] },
      );
      expect(repairMapTreeOrphans(project)).toBe(false);
    });
  });
});

describe("mapVariantLighting", () => {
  isolateTimers();
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
});

describe("starterVillage", () => {
  isolateTimers();
  // createStarterMap() 은 2026-09-30 기본 칩셋이 버들항(beodeul_city)으로 바뀐 뒤로 «집 세 채와 흙길이 있는 합본 마을» 이 아니라
  // 빈 30×30 맵이다 — 시작 마을은 editor/content/beodeulStarterMap.ts 가 조수와 같은 도구로 짓고(시험: beodeulStarterMap.test.ts),
  // 이 함수는 그 마을을 못 지을 때 물러나는 빈 맵과 새 프로젝트의 시작 맵으로만 쓰인다(blankProject · projectStartSeed · firstRunGuide).
  // 전에 이 파일은 합본 마을 칸 번호(집 무늬 374… · 흙길 360)로 옛 마을을 찾았고, 공개 기준선(0d4f13e7c)부터 두 경우가 떨어졌다.
  // 지금 지키는 것: 이름·크기·기본 칩셋, 바닥은 그 칩셋의 맨 풀 한 가지, 위층과 이벤트는 비어 있고, 가장자리까지 걸을 수 있다(벽 테두리 없음).
  describe("starter map", () => {
    it("is the blank 30x30 마을 on the default tileset: plain ground only, nothing on top, no events", () => {
      const m = createStarterMap();
      expect(m.name).toBe("마을");
      expect([m.width, m.height]).toEqual([30, 30]);
      expect(m.tilesetId).toBe(DEFAULT_TILESET_ID);
      expect(m.lowerTiles.length).toBe(30 * 30);
      expect(m.upperTiles.length).toBe(30 * 30);
      expect(new Set(m.lowerTiles)).toEqual(new Set([blankFillTileFor(DEFAULT_TILESET_ID)]));
      expect(new Set(m.upperTiles)).toEqual(new Set([TILE.EMPTY]));
      expect(m.events).toEqual([]);
    });

    it("keeps the boundary open walkable ground (no wall frame)", () => {
      const project = createBlankProject();
      const m = createStarterMap();
      project.maps[m.id] = m;
      const fill = blankFillTileFor(DEFAULT_TILESET_ID);
      const boundary: { x: number; y: number }[] = [];
      for (let x = 0; x < m.width; x += 1) boundary.push({ x, y: 0 }, { x, y: m.height - 1 });
      for (let y = 0; y < m.height; y += 1) boundary.push({ x: 0, y }, { x: m.width - 1, y });
      for (const { x, y } of boundary) {
        expect(m.lowerTiles[y * m.width + x]).toBe(fill);
        expect(isPassable(project, m, x, y), `(${x},${y})`).toBe(true);
      }
    });
  });
});
