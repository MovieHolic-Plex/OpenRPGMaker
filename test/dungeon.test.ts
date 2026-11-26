import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { AUTHOR_BEODEUL_DUNGEON_ALIAS } from "@/editor/tools/dungeonTools";
import { dungeonPlanFromCells, parseCellMap } from "@/ai/imagePlanCells";
import { runToolDefinition } from "@/editor/tools/toolRunner";
import { layoutPositioned } from "@/editor/dungeonKit/layoutPositioned";
import { projectLint } from "@/project/lint/projectLint";
import { ToolError } from "@/editor/tools/types";
import { AREA_VOID_RATIO, measureMapAreaUse } from "@/editor/tools/mapAreaUse";
import { isolateTimers } from "./mergedTeardown";
import { runTool } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import type { GameEvent, Project } from "@/project/types";

// 2026-11-05 imageplan-follow: a ring dungeon read from an image plan lost its ring — the positioned layout pushed rooms that lacked
// wall-face rows and replaced the drawn corridors with its own L-corridors. Plan cells now keep their rows and corridors as drawn.
describe("dungeonPlanCorridors", () => {
  isolateTimers();
  const ring = [
    "________________________",
    "____......____......____",
    "____......====......____",
    "____..A...____......____",
    "_____=__________=_______",
    "_____=___......_=_______",
    "_____=___..BB.._=_______",
    "_____=___......_=_______",
    "_____=__________=_______",
    "____......____......____",
    "____......====......____",
    "____......____......____",
  ];
  describe("author_dungeon keeps an image plan's ring", () => {
    it("places every room where the plan put it and lays the drawn corridors", () => {
      const plan = dungeonPlanFromCells(parseCellMap({ cells: ring, landmarks: [{ id: "A", kind: "altar", x: 6, y: 3 }] }, "dungeon", 24, 12)!);
      const project = createBlankProject();
      const res = AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId: project.startMapId!, type: "castle", seed: 3, populate: false, rooms: plan.rooms, links: plan.links });
      expect((res.warnings ?? []).filter((w) => w.includes("옮겼다"))).toEqual([]);
      const rooms = (res.data as { rooms: { id: string; x: number; y: number }[] }).rooms;
      const at = (id: string) => rooms.find((r) => r.id === id)!;
      expect(at("r2").y).toBe(at("r3").y);
      expect(at("r5").y).toBe(at("r1").y);
      expect(at("r3").x - at("r2").x).toBe(at("r1").x - at("r5").x);
      const corridors = (res.data as { corridors: { from: string; to: string; w: number; h: number }[] }).corridors;
      const side = corridors.filter((c) => [c.from, c.to].sort().join() === "r2,r5");
      expect(side.length).toBe(1);
      expect(side.every((c) => c.w === 2)).toBe(true);
    });

    it("passes argument validation on the assistant's tool path and keeps a vertical corridor as one piece", () => {
      const plan = dungeonPlanFromCells(parseCellMap({ cells: ring, landmarks: [] }, "dungeon", 24, 12)!);
      const vertical = plan.links.find((l) => [l.from, l.to].sort().join() === "r2,r5")!;
      expect(vertical.rects.length).toBe(1);
      const project = createBlankProject();
      const res = runToolDefinition({ project }, AUTHOR_BEODEUL_DUNGEON_ALIAS, { mapId: project.startMapId!, type: "castle", seed: 3, populate: false, rooms: plan.rooms, links: plan.links });
      expect(res.ok, res.summary).toBe(true);
      expect((res.warnings ?? []).filter((w) => w.includes("빌더 통로로 이었다"))).toEqual([]);
    });

    it("stretches drawn legs across the wall-face shift without touching a third room", () => {
      const grid = (h: number) => Array.from({ length: h }, () => "_".repeat(30).split(""));
      const put = (g: string[][], x0: number, y0: number, w: number, h: number, ch: string) => { for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) g[y]![x] = ch; };
      const neck = grid(16); put(neck, 2, 1, 24, 3, "."); put(neck, 10, 4, 2, 1, "="); put(neck, 2, 5, 24, 9, ".");
      const ell = grid(24); put(ell, 1, 1, 10, 5, "."); put(ell, 4, 6, 2, 8, "="); put(ell, 4, 14, 18, 2, "="); put(ell, 20, 16, 2, 2, "="); put(ell, 16, 18, 12, 5, "."); put(ell, 14, 2, 12, 7, ".");
      // room D sits one row under room C, so the wall-face gap pushes D down: the drawn leg into D must stretch to reach it
      const pushed = grid(24); put(pushed, 1, 1, 6, 3, "."); put(pushed, 3, 4, 2, 14, "="); put(pushed, 5, 16, 12, 2, "="); put(pushed, 18, 6, 8, 4, "."); put(pushed, 16, 11, 10, 6, ".");
      for (const g of [neck, ell, pushed]) {
        const plan = dungeonPlanFromCells(parseCellMap({ cells: g.map((r) => r.join("")) }, "dungeon", 30, g.length)!);
        if (g === pushed) {
          const leg = plan.links[0]!.rects[0]!;
          expect(leg.y + leg.h).toBeGreaterThan(Math.round(16 * 2));
        }
        for (const link of plan.links) for (const r of link.rects) {
          const others = plan.rooms.filter((o) => o.id !== link.from && o.id !== link.to);
          expect(others.some((o) => r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.h && o.y < r.y + r.h)).toBe(false);
        }
        if (g === ell) {
          const out = layoutPositioned({ rooms: plan.rooms, links: plan.links } as never, plan.rooms as never, { entrance: [8, 6], hall: [8, 6], boss: [8, 6], vault: [8, 6] } as never);
          const middle = out.corridors.find((c) => c.rect.w > c.rect.h * 4)!;
          expect(["E", "W"]).toContain(middle.dir);
        }
        const project = createBlankProject();
        const res = runToolDefinition({ project }, AUTHOR_BEODEUL_DUNGEON_ALIAS, { mapId: project.startMapId!, type: "castle", seed: 3, populate: false, rooms: plan.rooms, links: plan.links });
        expect(res.ok, res.summary).toBe(true);
        expect((res.warnings ?? []).filter((w) => w.includes("빌더 통로로 이었다"))).toEqual([]);
      }
    });

    it("gives a short door between side-by-side rooms an east-west direction", () => {
      const rooms = [{ id: "a", kind: "entrance", x: 2, y: 2, w: 10, h: 8 }, { id: "b", kind: "hall", x: 14, y: 2, w: 10, h: 8 }];
      const out = layoutPositioned({ rooms, links: [{ from: "a", to: "b", rects: [{ x: 12, y: 4, w: 2, h: 4 }] }] } as never, rooms as never, { entrance: [8, 6], hall: [8, 6] } as never);
      expect(out.corridors.map((c) => c.dir)).toEqual(["E"]);
    });

    // r2 2026-11-05: links items typed ["array","object"] made Gemini answer 400 for every build turn (all tools, not just this one).
    it("keeps the links schema a single type Gemini accepts", () => {
      const links = (AUTHOR_BEODEUL_DUNGEON_ALIAS.parameters.properties as Record<string, { items?: { type?: unknown } }>).links!;
      expect(links.items?.type).toBe("object");
    });
  });
});

describe("dungeonTools", () => {
  isolateTimers();
  // 2026-11-24 team-mvp-revive: 팀 첫 MVP 의 숲·동굴 담당이 build_world 가 만든 빈 장소 맵(세계 문만 있음)에 author_dungeon 을 불렀더니
  // «이미 내용이 있다»(map-not-blank)로 거절돼 22분 동안 손으로 깔았다. 뼈대 맵은 짓고, 세계 문은 목적지 그대로 걸을 수 있는 칸에 다시 놓는다.
  describe("dungeonWorldSkeleton", () => {
    isolateTimers();
    const gate = (id: string, x: number, y: number, mapId: string, tx: number, ty: number) => ({ id, name: id, x, y, trigger: { kind: "playerTouch" }, commands: [],
      pages: [{ id: `${id}_p0`, name: id, conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below",
        movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "transfer", mapId, x: tx, y: ty }] }] }) as unknown as GameEvent;
    it("세계 문만 있는 뼈대 맵에도 던전을 짓고, 문은 목적지 그대로 걸을 수 있는 칸에, 들어오는 문은 고치지 않고 알린다", () => {
      const ctx = { project: createBlankProject() };
      expect(runTool(ctx, "create_map", { id: "map_forest", name: "숲", width: 30, height: 24 }).ok).toBe(true);
      expect(runTool(ctx, "create_map", { id: "map_cave", name: "동굴", width: 30, height: 24 }).ok).toBe(true);
      const project = ctx.project as Project;
      const start = project.startMapId!;
      project.worldGraph = { nodes: [{ mapId: start, role: "town" }, { mapId: "map_forest", role: "dungeon" }, { mapId: "map_cave", role: "dungeon" }], edges: [] } as unknown as Project["worldGraph"];
      project.maps[start]!.events = [gate("ev_world_gate_s", 3, 3, "map_forest", 29, 23)];
      project.maps.map_forest!.events = [gate("ev_world_gate_1", 1, 1, start, 3, 4), gate("ev_world_gate_2", 28, 22, "map_cave", 2, 2)];
      const res = AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId: "map_forest", type: "forest", seed: 7, floors: 2, populate: false });
      const map = project.maps.map_forest!;
      const exit = (res.data as { floorData: { exitStair: { x: number; y: number; front: { x: number; y: number } } | null }[] }).floorData[0]!.exitStair;
      for (const [id, to] of [["ev_world_gate_1", start], ["ev_world_gate_2", "map_cave"]] as const) {
        const placed = map.events.filter((event) => event.id === id);
        expect(placed).toHaveLength(1);
        expect((placed[0]!.pages?.[0]?.commands[0] as { mapId: string }).mapId).toBe(to);
        expect(isPassable(project, map, placed[0]!.x, placed[0]!.y)).toBe(true);
        if (exit) for (const cell of [exit, exit.front]) expect(Math.abs(cell.x - placed[0]!.x) + Math.abs(cell.y - placed[0]!.y)).toBeGreaterThan(1);
      }
      // 들어오는 문은 다른 맵(팀에서는 다른 담당 몫)이라 고치지 않고 경고만 한다 — 범위 가드가 호출 전체를 되돌리지 않게.
      expect(project.maps[start]!.events[0]!.pages![0]!.commands[0]).toEqual({ kind: "transfer", mapId: "map_forest", x: 29, y: 23 });
      expect((res.warnings ?? []).some((line) => line.includes("들어오는 문"))).toBe(true);
    });
  });
  // 여러 층 던전 층 잇기(2026-10-30): 깊은 방(보스방)이 장식으로 차 내려가는 계단 자리가 없으면 계단을 말없이 빠뜨려
  // 성 2층 시드 4·9·11 이 `links: []`·1층 `exitStair: null` 로 끊겼다. 이제 다른 칸·다른 방으로 물러나 늘 잇는다.
  // 시드 1~40 전수는 `bun scripts/content/dungeon-floor-link-probe.mts castle,cave,tower 40`.
  describe("dungeonFloorLinks", () => {
    isolateTimers();
    type FloorData = { exitStair: unknown; entryStair: unknown };
    describe("여러 층 던전은 층마다 계단으로 이어진다", () => {
      for (const [floors, seed] of [[2, 4], [2, 9], [2, 11], [3, 9]] as const) {
        it(`성 ${floors}층 시드 ${seed}`, () => {
          const project = createBlankProject();
          const res = AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { type: "castle", floors, seed, populate: false });
          const d = res.data as { links: string[]; floorData: FloorData[] };
          expect(d.links).toHaveLength(floors - 1);
          for (let k = 0; k + 1 < floors; k += 1) {
            expect(d.floorData[k]!.exitStair).toBeTruthy();
            expect(d.floorData[k + 1]!.entryStair).toBeTruthy();
          }
        });
      }
    });
  });
  // 2026-11-15 여러 씨앗 훑기(Mirage VM)에서 main 도 멈추던 판: 조수의 던전 도구가 «시공기 내부 오류: 입구에서 걸어 닿지 않는 방 …» 을 던졌다.
  // 뿌리 둘: ① 굴 문법에서 두께 고르기가 좁은 목을 메워 방 하나가 통째로 끊기면 «못 잇는 조각 제거» 가 그 방의 바닥을 모두 지웠다
  //          → 통째로 끊긴 방은 굴을 뚫어 잇는다(dungeonKit/grid.ts tunnelLostRooms).
  //        ② 바닥 구멍 계단의 도착 칸이 뒤에 놓인 물건(해골·밸브) 사이에 갇혔다 → 물건을 놓을 때 도착 칸 곁 한 칸은 길에 이어져 있어야 한다(compose.ts arrivals).
  // 씨앗을 피하지 않는다 — 그때 멈춘 종류·씨앗을 그대로 짓고, 지은 층에 린트 오류가 없어야 한다.
  describe("dungeonLostRooms", () => {
    isolateTimers();
    const CASES: readonly (readonly [string, Record<string, unknown>])[] = [
      ["소굴 7", { type: "cave", lair: true, seed: 7 }], ["소굴 19", { type: "cave", lair: true, seed: 19 }],
      ["화산 7", { type: "volcano", seed: 7 }], ["화산 10", { type: "volcano", seed: 10 }], ["화산 20", { type: "volcano", seed: 20 }],
      ["숲 7", { type: "forest", seed: 7 }], ["숲 20", { type: "forest", seed: 20 }],
      ["큰 2층 하수도 3", { type: "sewer", seed: 3, size: "large", floors: 2 }],
    ];
    describe("던전 도구는 닿지 않는 방으로 멈추지 않는다", () => {
      it.each(CASES)("%s: 지어지고, 모든 방이 입구에서 닿으며, 린트 오류가 없다", (name, args) => {
        const project = createBlankProject();
        const res = AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId: project.startMapId!, name, ...args });
        const ids = (res.data as { floors: string[] }).floors;
        expect(ids.length).toBeGreaterThan(0);
        const issues = projectLint(project).filter((i) => i.severity === "error" && (!i.mapId || ids.includes(i.mapId)));
        expect(issues.map((i) => `${i.code}: ${String(i.message).slice(0, 80)}`)).toEqual([]);
      }, 60_000);
    });
  });
  // 2026-11-05 gpt-only-game (ChatGPT subscription, Terra alone, 「좀비 생존 게임」 round 4): after the story was built and a scene
  // test passed 11/11, a feature-review repair called author_dungeon{rebuild:true} on the same map. Rebuild clears every event, so the
  // exit that triggers the ending and the key chest vanished and the game could no longer end.
  describe("dungeonRebuildKeepsEnding", () => {
    isolateTimers();
    function builtDungeon() {
      const project = createBlankProject();
      const mapId = project.startMapId!;
      AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId, type: "catacomb", seed: 3, populate: false });
      return { project, mapId };
    }
    describe("author_dungeon rebuild keeps a game that can end", () => {
      it("refuses to rebuild a dungeon whose events trigger an ending", () => {
        const { project, mapId } = builtDungeon();
        const map = project.maps[mapId]!;
        map.events.push({ id: "ev_exit", name: "구조 지점으로 가는 계단", x: 2, y: 2, pages: [{ id: "p", name: "p", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "triggerEnding", endingId: "ending_rescue" }] }] } as never);
        let error: unknown;
        try { AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId, type: "catacomb", seed: 5, rebuild: true, populate: false }); } catch (e) { error = e; }
        expect(error).toBeInstanceOf(ToolError);
        expect((error as ToolError).code).toBe("rebuild-would-erase-ending");
        expect(map.events.some((e) => e.id === "ev_exit")).toBe(true);
      });

      it("refuses when an event calls a common event that ends the game", () => {
        const { project, mapId } = builtDungeon();
        project.commonEvents = [...(project.commonEvents ?? []), { id: "ce_finale", name: "피날레", trigger: "none", commands: [{ kind: "ending" }] } as never];
        project.maps[mapId]!.events.push({ id: "ev_gate", name: "문", x: 2, y: 2, pages: [{ id: "p", name: "p", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "callCommonEvent", commonEventId: "ce_finale" }] }] } as never);
        expect(() => AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId, type: "catacomb", seed: 5, rebuild: true, populate: false })).toThrow(ToolError);
      });

      it("still rebuilds a dungeon without an ending event", () => {
        const { project, mapId } = builtDungeon();
        const res = AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId, type: "catacomb", seed: 5, rebuild: true, populate: false });
        expect(res.summary).toContain("rebuild");
      });
    });
  });
  // 2026-11-05 imageplan-honest p4/p10: a two-floor castle built from an image plan (vagueWiden recipe author_dungeon{type:"castle",
  // floors:2, direction:"up"}) floated on a cloud-sea background the plan never showed. The cloud sky belongs to towers or an explicit ask.
  describe("dungeonTowerSky", () => {
    isolateTimers();
    function build(args: Record<string, unknown>) {
      const project = createBlankProject();
      const res = AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId: project.startMapId!, seed: 11, populate: false, ...args });
      const ids = (res.data as { floors: string[] }).floors;
      return ids.map((id) => project.maps[id]!);
    }
    describe("author_dungeon cloud sky around stacked floors", () => {
      it("keeps a named stacked castle's dark ceiling, with or without a type", () => {
        for (const args of [{ type: "castle", name: "성채" }, { name: "성채" }]) {
          const maps = build({ ...args, floors: 2, direction: "up" });
          expect(maps).toHaveLength(2);
          for (const m of maps) expect(m.background).toBeUndefined();
        }
      });

      it("opens the sky for a castle or temple named as a tower", () => {
        expect(build({ type: "castle", name: "마법사의 탑", floors: 3, direction: "up" }).some((m) => m.background !== undefined)).toBe(true);
      });

      it("builds the two-floor castle recipe without sky and without a black void", () => {
        const project = createBlankProject();
        const floorRooms = [[{ kind: "entrance" }, { kind: "hall" }, { kind: "library" }, { kind: "storage" }], [{ kind: "shrine" }, { kind: "boss" }]];
        const res = AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId: project.startMapId!, seed: 11, populate: false, type: "castle", name: "성채", floors: 2, direction: "up", floorRooms });
        const maps = (res.data as { floors: string[] }).floors.map((id) => project.maps[id]!);
        for (const m of maps) expect(m.background).toBeUndefined();
        expect(measureMapAreaUse(project, maps[0]!)!.voidRatio).toBeLessThan(AREA_VOID_RATIO);
      });

      it("still opens the sky around a tower", () => {
        const maps = build({ type: "tower", floors: 3, direction: "up" });
        expect(maps.some((m) => m.background !== undefined)).toBe(true);
      });

      it("opens the sky around a castle when asked", () => {
        const maps = build({ type: "castle", floors: 2, direction: "up", sky: true });
        expect(maps.some((m) => m.background !== undefined)).toBe(true);
      });
    });
  });
});
