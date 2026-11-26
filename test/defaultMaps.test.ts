import { describe, expect, it } from "vitest";
import { collectMapIdsInTree, repairMapTreeOrphans } from "@/project/mapTree";
import { createBlankMap, blankFillTileFor } from "@/project/defaults/defaultMaps";
import type { Project, GameEvent, GameMap, CharacterFootprint, EventPage } from "@/project/types";
import { getTool } from "@/editor/tools/toolRegistry";
import { createBlankProject, createStarterMap, TILE } from "@/project/defaults";
import { buildMapGraph, checkLightingLeak } from "@/qa/gameCheck/mapGraph";
import { isPassable } from "@/project/collision";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { isolateTimers } from "./mergedTeardown";
import { runTool } from "@/editor/tools/toolRunner";
import { createJpCityTileset, JP_CITY_ID } from "@/project/defaults/jpCity";
import { deserialize, serialize } from "@/project/io";
import { projectLint, type LintIssue } from "@/project/lint/projectLint";
import { canTravelBetweenMaps } from "@/testing/mapTravelReachability";
import "@/editor/tools/toolRegistry";

describe("defaultMaps", () => {
  isolateTimers();
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
});

describe("lintFootprintReach", () => {
  isolateTimers();
  // 거리 건물 문 앞이 큰길에서 걸어서 닿지 않으면 compose 가 경고하고 link_jp_city_interior 가 거부한다.
  // 2026-10-25 시타마치(shotengai seed 11, 40×28): 남쪽 줄 건물 문 넷이 맵 끝 뒷골목에 갇혀 실내에 들어갈 수 없었다.
  describe("jpCityDoorReachability", () => {
    isolateTimers();
    function street() {
      const project = createBlankProject();
      project.tilesets[JP_CITY_ID] = createJpCityTileset();
      const hub = createStarterMap();
      Object.assign(hub, { id: "hub", name: "상점가", tilesetId: JP_CITY_ID, width: 40, height: 28 });
      hub.lowerTiles = new Array(40 * 28).fill(blankFillTileFor(JP_CITY_ID));
      hub.upperTiles = new Array(40 * 28).fill(-1);
      project.maps.hub = hub;
      const ctx = { project, assistantRun: false };
      const composed = runTool(ctx, "compose_jp_city_street", { mapId: "hub", style: "shotengai", seed: 11, replace: true }, { dryRun: false });
      expect(composed.ok, composed.summary).toBe(true);
      const room = runTool(ctx, "build_hand_interior_room", { mapId: "room", name: "빵집", tileset: "modern_city", replace: true, layout: { program: "mc_bakery_cafe", seed: 7, furnish: true } }, { dryRun: false });
      expect(room.ok, room.summary).toBe(true);
      return { ctx, composed };
    }
    describe("jp_city 거리 문 닿음", () => {
      it("compose 가 큰길에서 닿지 않는 문을 경고하고 이름표에 적는다", () => {
        const { ctx, composed } = street();
        expect(JSON.stringify(composed)).toMatch(/걸어서 닿지 않는 건물 문/u);
        const dead = (ctx.project.maps.hub!.locations ?? []).filter((l) => (l.note ?? "").includes("닿지 않음"));
        expect(dead.length).toBeGreaterThan(0);
      });

      it("link_jp_city_interior 는 닿지 않는 문을 거부하고 닿는 문은 잇는다", () => {
        const { ctx } = street();
        const notes = (ctx.project.maps.hub!.locations ?? []).filter((l) => (l.tags ?? []).includes("jp-building")).map((l) => l.note ?? "");
        const doorOf = (note: string) => { const m = /문 \((\d+),(\d+)\)/u.exec(note)!; return { x: Number(m[1]), y: Number(m[2]) }; };
        const dead = notes.find((n) => n.includes("닿지 않음"))!;
        const live = notes.find((n) => !n.includes("닿지 않음"))!;
        const refused = runTool(ctx, "link_jp_city_interior", { mapId: "hub", door: doorOf(dead), interiorMapId: "room" }, { dryRun: false });
        expect(refused.ok).toBe(false);
        expect(JSON.stringify(refused.issues)).toMatch(/door-unreachable|닿지 않는다/u);
        const linked = runTool(ctx, "link_jp_city_interior", { mapId: "hub", door: doorOf(live), interiorMapId: "room" }, { dryRun: false });
        expect(linked.ok, linked.summary).toBe(true);
      });
    });
  });
  // 저작 시점 검사와 테스트 하네스가 앵커 한 칸을 넘어 **사각**까지 보는지 검증한다.
  // 2차 스펙 docs/superpowers/specs/2026-08-30-character-body-vs-passage-rect-design.md §10.
  //
  // 판별력 규칙(1차·2차 내내 같다): 프로브는 **앵커 칸을 겨냥하지 않는다.** 앵커를 찌르는 검사는
  // 1x1 이어도 같은 결과가 나오므로 아무것도 증명하지 않는다. 그리고 모든 describe 는 같은
  // 상황을 1x1 로도 돌려 **경고가 새로 생기지 않는다**(항등)는 것을 같이 굳힌다.
  describe("lintFootprintReach", () => {
    isolateTimers();
    const TILE_FLOOR_IMPASSABLE = 342;   // TILE.FLOOR — 통행 불가.

    function cloneProject(project: Project): Project {
      return deserialize(serialize(project));
    }
    function startMap(project: Project): GameMap {
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("start map missing");
      return map;
    }
    function wall(map: GameMap, x: number, y: number): void {
      map.lowerTiles[y * map.width + x] = TILE_FLOOR_IMPASSABLE;
      map.upperTiles[y * map.width + x] = -1;
    }
    /** 발자국을 실은 action 이벤트. footprint 를 생략하면 페이지가 아예 없어 1x1 이 된다. */
    function pushEvent(
      map: GameMap,
      id: string,
      x: number,
      y: number,
      page?: { footprint?: CharacterFootprint; passRows?: number; trigger?: EventPage["trigger"]; priority?: EventPage["priority"] }
    ): GameEvent {
      const event: GameEvent = {
        id,
        x,
        y,
        trigger: page?.trigger ?? { kind: "action" },
        commands: [],
        ...(page
          ? {
              pages: [
                {
                  id: `${id}_p0`,
                  name: "기본",
                  conditions: [],
                  graphic: { transparent: true },
                  trigger: page.trigger ?? { kind: "action" },
                  priority: page.priority ?? "below",
                  overlapForbidden: page.priority === "same",
                  movement: { type: "fixed", speed: 3, frequency: 3 },
                  commands: [{ kind: "text", body: "hi" }],
                  ...(page.footprint ? { footprint: page.footprint } : {}),
                  ...(page.passRows === undefined ? {} : { passRows: page.passRows }),
                } satisfies EventPage,
              ],
            }
          : {}),
      };
      map.events.push(event);
      return event;
    }
    function issuesWithCode(project: Project, code: string): readonly LintIssue[] {
      return projectLint(project).filter((issue) => issue.code === code);
    }
    describe("event-footprint-impassable — 다중 타일 이벤트가 벽을 걸친다", () => {
      // 앵커는 풀밭이고 **비앵커 칸**만 벽이다. 이 자리는 canMoveFootprint 가 절대 허용하지 않는
      // 좌표라, 저작으로만 놓일 수 있고 거기 놓인 이동형 NPC 는 나올 수 없다.
      it("2x2 이벤트의 비앵커 칸이 벽이면 warning 을 낸다", () => {
        const project = cloneProject(createBlankProject());
        const map = startMap(project);
        // 짝수 폭은 앵커가 **왼쪽** 열이다: 2x2 앵커 (10,7) 의 몸은 x 10..11, y 6..7.
        wall(map, 11, 6); // 오른쪽 위 칸 — 앵커가 아니다.
        pushEvent(map, "ev_big", 10, 7, { footprint: { width: 2, height: 2 } });

        const issues = issuesWithCode(project, "event-footprint-impassable");
        expect(issues, JSON.stringify(issues)).toHaveLength(1);
        expect(issues[0]).toMatchObject({ severity: "warning", x: 10, y: 7 });
        expect(issues[0]?.message).toContain("(11, 6)");
        expect(issues[0]?.message).toContain("ev_big");
      });

      it("같은 자리의 1x1 이벤트는 경고가 없다 — 항등", () => {
        const project = cloneProject(createBlankProject());
        const map = startMap(project);
        wall(map, 11, 6);
        pushEvent(map, "ev_small", 10, 7);

        expect(issuesWithCode(project, "event-footprint-impassable")).toHaveLength(0);
      });

      // 통행 사각으로 보는 것의 요점: passRows 로 열어 둔 상체가 벽과 겹치는 것은 **정상**이다.
      // 벽을 스치고 지나가는 것이 사각을 둘로 쪼갠 목적이므로 여기에 경고를 내면 안 된다.
      it("passRows 로 열어 둔 상체가 벽을 덮어도 경고가 없다", () => {
        const project = cloneProject(createBlankProject());
        const map = startMap(project);
        wall(map, 9, 5); // 3x3 몸(x 9..11, y 5..7)의 상단 행 — 통행 사각(y 7)에는 없다.
        pushEvent(map, "ev_golem", 10, 7, { footprint: { width: 3, height: 3 }, passRows: 1 });

        expect(issuesWithCode(project, "event-footprint-impassable")).toHaveLength(0);
      });

      it("통행 사각(발밑 행)이 벽을 덮으면 경고한다", () => {
        const project = cloneProject(createBlankProject());
        const map = startMap(project);
        wall(map, 9, 7); // 발밑 행의 **비앵커** 칸.
        pushEvent(map, "ev_golem", 10, 7, { footprint: { width: 3, height: 3 }, passRows: 1 });

        const issues = issuesWithCode(project, "event-footprint-impassable");
        expect(issues, JSON.stringify(issues)).toHaveLength(1);
        expect(issues[0]?.message).toContain("(9, 7)");
      });
    });
    describe("duplicate-event — 앵커 문자열 키가 아니라 몸 사각 겹침", () => {
      // 예전 키는 `${x},${y}` 였다. 앵커가 한 칸이라도 다르면 다른 좌표로 세어, 완전히 포개진
      // 2x2 두 개가 무경고 통과했다.
      it("앵커가 한 칸 다른 2x2 두 개의 겹침을 잡는다", () => {
        const project = cloneProject(createBlankProject());
        const map = startMap(project);
        pushEvent(map, "ev_a", 10, 8, { footprint: { width: 2, height: 2 } });
        pushEvent(map, "ev_b", 11, 8, { footprint: { width: 2, height: 2 } });

        const issues = issuesWithCode(project, "duplicate-event");
        expect(issues, JSON.stringify(issues)).toHaveLength(1);
        expect(issues[0]?.message).toContain("ev_a & ev_b");
      });

      it("몸 사각이 안 닿는 2x2 두 개는 잡지 않는다", () => {
        const project = cloneProject(createBlankProject());
        const map = startMap(project);
        pushEvent(map, "ev_a", 10, 8, { footprint: { width: 2, height: 2 } });
        pushEvent(map, "ev_b", 13, 8, { footprint: { width: 2, height: 2 } });

        expect(issuesWithCode(project, "duplicate-event")).toHaveLength(0);
      });

      // 1x1 두 개가 같은 칸일 때의 좌표·메시지는 예전 구현과 같아야 한다 — 뒤쪽 이벤트의 앵커.
      it("같은 칸의 1x1 두 개는 예전과 같은 좌표·메시지로 보고한다", () => {
        const project = cloneProject(createBlankProject());
        const map = startMap(project);
        pushEvent(map, "ev_a", 7, 7);
        pushEvent(map, "ev_b", 7, 7);

        const issues = issuesWithCode(project, "duplicate-event");
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({ severity: "warning", x: 7, y: 7 });
        expect(issues[0]?.message).toBe(`이벤트 좌표가 겹칩니다: ${map.id} (7, 7) — ev_a & ev_b`);
      });

      it("이웃한 1x1 두 개는 겹치지 않는다", () => {
        const project = cloneProject(createBlankProject());
        const map = startMap(project);
        pushEvent(map, "ev_a", 7, 7);
        pushEvent(map, "ev_b", 8, 7);

        expect(issuesWithCode(project, "duplicate-event")).toHaveLength(0);
      });
    });
    describe("event-unreachable / playerTouch-impassable — 몸 칸 하나라도 열려 있으면 산다", () => {
      // 앵커만 보던 검사는 2x2 의 앵커가 벽이면 "영구 미발동" 이라고 울렸다. 발동 판정은 몸 사각
      // 겹침이므로, 다른 몸 칸을 밟을 수 있으면 발동한다 — 오탐이었다.
      it("2x2 밟기형 이벤트의 앵커가 벽이어도 다른 몸 칸이 열려 있으면 경고하지 않는다", () => {
        const project = cloneProject(createBlankProject());
        const map = startMap(project);
        wall(map, 10, 8); // 앵커만 벽. 나머지 세 칸 (11,8) (10,7) (11,7) 은 풀밭.
        pushEvent(map, "ev_touch", 10, 8, {
          footprint: { width: 2, height: 2 },
          trigger: { kind: "playerTouch" },
          priority: "below",
        });

        expect(issuesWithCode(project, "playerTouch-impassable")).toHaveLength(0);
        expect(issuesWithCode(project, "event-unreachable")).toHaveLength(0);
      });

      it("몸 사각 전 칸이 벽이면 여전히 경고한다", () => {
        const project = cloneProject(createBlankProject());
        const map = startMap(project);
        for (const [x, y] of [[10, 7], [11, 7], [10, 8], [11, 8]] as const) wall(map, x, y);
        pushEvent(map, "ev_touch", 10, 8, {
          footprint: { width: 2, height: 2 },
          trigger: { kind: "playerTouch" },
          priority: "below",
        });

        expect(issuesWithCode(project, "playerTouch-impassable")).toHaveLength(1);
      });

      // event-unreachable 의 이웃 판정도 몸 칸 기준이다: 몸이 전부 벽이어도 **몸의** 이웃 하나가
      // 열려 있으면 부딪힘으로 닿는다. 앵커의 4방 이웃만 보면 2x2 의 반대편 이웃을 놓친다.
      it("몸이 전부 벽이어도 비앵커 칸의 이웃이 열려 있으면 도달 가능으로 본다", () => {
        const project = cloneProject(createBlankProject());
        const map = startMap(project);
        // 몸(x 10..11, y 7..8) 전부 벽 + 앵커(10,8)의 4방 이웃 (9,8)·(10,9) 도 벽.
        // 남는 열린 이웃은 (12,7) 뿐이다 — **비앵커 칸** (11,7) 의 오른쪽이라 앵커만 보는 검사는 못 본다.
        for (const [x, y] of [[10, 7], [11, 7], [10, 8], [11, 8], [9, 8], [10, 9], [11, 9], [10, 6], [11, 6], [9, 7], [12, 8]] as const) {
          wall(map, x, y);
        }
        pushEvent(map, "ev_walled", 10, 8, { footprint: { width: 2, height: 2 } });

        expect(issuesWithCode(project, "event-unreachable")).toHaveLength(0);
      });
    });
    describe("start-position — 주인공 몸이 시작 칸에 들어가는가", () => {
      it("3x3 주인공의 통행 사각이 벽을 걸치면 error 를 낸다", () => {
        const project = cloneProject(createBlankProject());
        const map = startMap(project);
        project.system.playerFootprint = { width: 3, height: 3 };
        // 발밑 행의 비앵커 칸을 막는다 — 앵커 자체는 통행 가능해서 예전 검사는 통과했다.
        wall(map, project.startPos.x - 1, project.startPos.y);

        const issues = issuesWithCode(project, "start-position");
        expect(issues, JSON.stringify(issues)).toHaveLength(1);
        expect(issues[0]?.severity).toBe("error");
        expect(issues[0]?.message).toContain("3x3");
      });

      it("passRows 로 상체를 열어 두면 상체 쪽 벽은 error 가 아니다", () => {
        const project = cloneProject(createBlankProject());
        const map = startMap(project);
        project.system.playerFootprint = { width: 3, height: 3 };
        project.system.playerPassRows = 1;
        wall(map, project.startPos.x - 1, project.startPos.y - 2); // 상체 행.

        expect(issuesWithCode(project, "start-position")).toHaveLength(0);
      });

      it("발자국 저작이 없으면 같은 벽에도 error 가 없다 — 항등", () => {
        const project = cloneProject(createBlankProject());
        const map = startMap(project);
        wall(map, project.startPos.x - 1, project.startPos.y);

        expect(issuesWithCode(project, "start-position")).toHaveLength(0);
      });
    });
    describe("mapTravelReachability — 관문을 몸 사각으로 색인한다", () => {
      /**
       * 두 맵과 문 이벤트를 만든다. 앵커 칸은 벽이므로 1x1 문은 영원히 못 밟고, 2x2 문은
       * 비앵커 칸으로 밟을 수 있다. 두 경우 모두 **페이지가 있어야** 한다 — `activeTransfers` 는
       * 페이지 없는 이벤트의 legacy commands 를 보지 않으므로, 페이지를 빼면 발자국과 무관하게
       * 관문이 죽어 실험이 무의미해진다.
       */
      function twoMapProject(footprint?: CharacterFootprint): Project {
        const project = cloneProject(createBlankProject());
        const from = startMap(project);
        const to = createBlankMap("도착", 20, 20);
        project.maps[to.id] = to;
        project.mapTree.children.push({ mapId: to.id, children: [] });
        // 관문은 시작 좌표에서 **떨어져** 있어야 한다. startPos 위에 놓으면 BFS 의 출발 노드가 곧
        // 관문 칸이라 통행성과 무관하게 워프가 걸리고, 대조군이 헛통과한다(실측).
        const gate = pushEvent(from, "ev_gate", 13, 10, footprint ? { footprint } : {});
        const page = gate.pages?.[0];
        if (!page) throw new Error("gate page missing");
        (page.commands as unknown[]).length = 0;
        (page.commands as unknown[]).push({ kind: "transfer", mapId: to.id, x: 5, y: 5, direction: "retain" });
        // 앵커 칸을 벽으로 막는다 — 2x2 라면 비앵커 칸으로 밟을 수 있어야 한다.
        wall(from, 13, 10);
        return project;
      }

      /** 도착 맵 id 는 createBlankMap 이 만들어 주는 값이다 — 하드코딩하면 실험이 무의미해진다. */
      function destinationId(project: Project): string {
        const id = Object.keys(project.maps).find((mapId) => mapId !== project.startMapId);
        if (!id) throw new Error("destination map missing");
        return id;
      }

      it("2x2 관문은 비앵커 칸을 밟아도 이어진다", () => {
        const project = twoMapProject({ width: 2, height: 2 });
        const result = canTravelBetweenMaps(project, { ...project.startPos, mapId: project.startMapId }, destinationId(project));

        expect(result.reachable, JSON.stringify(result.unreachableGates)).toBe(true);
      });

      it("1x1 관문의 앵커가 벽이면 여전히 닿지 않는다 — 항등", () => {
        const project = twoMapProject();
        const result = canTravelBetweenMaps(project, { ...project.startPos, mapId: project.startMapId }, destinationId(project));

        expect(result.reachable).toBe(false);
        expect(result.unreachableGates.map((gate) => gate.eventId)).toContain("ev_gate");
      });
    });
  });
});
