import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { AUTHOR_BEODEUL_DUNGEON_ALIAS } from "@/editor/tools/dungeonTools";
import { projectLint } from "@/project/lint/projectLint";
import { ToolError } from "@/editor/tools/types";
import { AREA_VOID_RATIO, measureMapAreaUse } from "@/editor/tools/mapAreaUse";
import { isolateTimers } from "./mergedTeardown";
import { runTool } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import type { GameEvent, Project } from "@/project/types";

// 2026-11-24 team-mvp-revive: 팀 첫 MVP 의 숲·동굴 담당이 build_world 가 만든 빈 장소 맵(세계 문만 있음)에 author_dungeon 을 불렀더니
// «이미 내용이 있다»(map-not-blank)로 거절돼 22분 동안 손으로 깔았다. 뼈대 맵은 짓고, 세계 문은 목적지 그대로 걸을 수 있는 칸에 다시 놓는다.
describe("dungeonWorldSkeleton", () => {
  isolateTimers();
  it("세계 문만 있는 뼈대 맵에도 던전을 짓고, 그 문은 목적지 그대로 걸을 수 있는 칸에 남는다", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "map_forest", name: "숲", width: 30, height: 24 }).ok).toBe(true);
    const project = ctx.project as Project;
    const start = project.startMapId!;
    const page = { id: "ev_world_gate_1_p0", name: "ev_world_gate_1", conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below",
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "transfer", mapId: start, x: 2, y: 2 }] };
    project.maps.map_forest!.events = [{ id: "ev_world_gate_1", name: "ev_world_gate_1", x: 1, y: 1, trigger: { kind: "playerTouch" }, commands: [], pages: [page] } as unknown as GameEvent];
    AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId: "map_forest", type: "forest", seed: 7, populate: false });
    const map = project.maps.map_forest!;
    const gates = map.events.filter((event) => event.id === "ev_world_gate_1");
    expect(gates).toHaveLength(1);
    expect(gates[0]!.pages?.[0]?.commands).toEqual([{ kind: "transfer", mapId: start, x: 2, y: 2 }]);
    expect(isPassable(project, map, gates[0]!.x, gates[0]!.y)).toBe(true);
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
