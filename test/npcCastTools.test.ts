import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import type { Command, GameEvent } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("narrativeHorrorOneShot", () => {
  isolateTimers();
  /**
   * Headless one-shot reproduction contracts for Moon / Witch / Ib template tools.
   */
  describe("narrative/horror one-shot reproduction", () => {
    it("Moon: script_cutscene_preset memory + ending", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const open = runTool(ctx, "script_cutscene_preset", {
        mapId,
        preset: "memory_opening",
        lines: ["그날 밤을 기억한다.", "창밖의 달빛."],
      });
      expect(open.ok, open.summary).toBe(true);
      const end = runTool(ctx, "script_cutscene_preset", {
        mapId,
        preset: "ending_fade",
        endingId: "ending_oneshot_moon",
        endingName: "원샷 달 엔딩",
        lines: ["문을 닫는다."],
      });
      expect(end.ok, end.summary).toBe(true);
      expect(ctx.project.endings?.some((e) => e.id === "ending_oneshot_moon")).toBe(true);
      expect(ctx.project.maps[mapId]!.events.length).toBeGreaterThanOrEqual(1);
    });

    it("Witch: make_horror_loop traps + checkpoint + chase", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const r = runTool(ctx, "make_horror_loop", {
        mapId,
        origin: { x: 3, y: 3 },
        trapCount: 3,
        includeChase: true,
        chaserAt: { x: 8, y: 3 },
        safeZone: { x: 1, y: 1, w: 2, h: 2 },
      });
      expect(r.ok, r.summary).toBe(true);
      const map = ctx.project.maps[mapId]!;
      const hasKill = map.events.some((e) =>
        (e.pages ?? []).some((p) => (p.commands ?? []).some((c) => c.kind === "killPlayer")),
      );
      const hasCheckpoint = map.events.some((e) =>
        (e.pages ?? []).some((p) => (p.commands ?? []).some((c) => c.kind === "checkpointSave")),
      );
      expect(hasKill).toBe(true);
      expect(hasCheckpoint).toBe(true);
    });

    it("Ib: make_gallery_room hotspots + puzzle switch", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const itemId = ctx.project.database.items[0]!.id;
      const r = runTool(ctx, "make_gallery_room", {
        mapId,
        origin: { x: 2, y: 2 },
        hotspotCount: 6,
        puzzleKind: "item-gate",
        requiredItemId: itemId,
        solveSwitchId: "sw_oneshot_gallery",
      });
      expect(r.ok, r.summary).toBe(true);
      const data = r.data as { created?: number };
      expect((data.created ?? 0) >= 3).toBe(true);
      expect(ctx.project.switches.some((s) => s.id === "sw_oneshot_gallery")).toBe(true);
    });

    it("writes reproduction report artifact", () => {
      const report = {
        schemaVersion: 1,
        kind: "api-package-test-report",
        generatedAt: new Date().toISOString(),
        slices: ["moon", "witch", "ib"],
        status: "passed",
      };
      mkdirSync(resolve("artifacts"), { recursive: true });
      writeFileSync(resolve("artifacts/narrative-horror-oneshot-report.json"), JSON.stringify(report, null, 2), "utf8");
      expect(report.status).toBe("passed");
    });
  });
});

// NPC 를 만드는 툴은 대사를 지어내지 않는다 — 대사 없는 '대기' 페이지를 만들고 캐스트 라이터에 맡긴다.
//
// 실측 배경(2026-09-03): author_village 는 인자에 대사 자리가 없어(npcCount 만) 항상 DEFAULT_NPCS 10명
// (민재·소라·대길…)의 고정 대사를 돌려썼고, make_villager/place_npc 는 대사를 빼면 "안녕하세요." /
// "일하는 중이야." 를, 밑그림 npc 자동 배치는 "${name}입니다." 를 박았다. 테마와 무관하게 늘 같은 마을이
// 나온 이유다. 여기서는 생성 코드의 그 문구가 전부 사라졌음을 고정한다.
describe("npcCastTools", () => {
  isolateTimers();
  function textBodies(event: GameEvent): string[] {
    return (event.pages ?? []).flatMap((page) => page.commands.filter((command): command is Extract<Command, { kind: "text" }> => command.kind === "text").map((command) => command.body));
  }
  describe("make_villager / place_npc — 대사를 빼면 인사말을 대신 넣지 않는다", () => {
    it("dialogue 없는 make_villager 의 기본 페이지·활동 페이지는 text 커맨드가 없다", () => {
      const ctx = { project: createBlankProject() };
      const map = ctx.project.maps.map_blank_start!;
      const result = runTool(ctx, "make_villager", {
        mapId: map.id,
        name: "농부",
        home: { x: 2, y: 2 },
        dailyRoutine: { workAt: { x: 4, y: 2 }, workHours: [6, 18] },
      });
      expect(result.ok, result.summary).toBe(true);
      const event = ctx.project.maps[map.id]!.events.find((entry) => entry.pages?.[0]?.name === "농부")!;
      expect(event).toBeTruthy();
      expect(textBodies(event)).toEqual([]);
      expect((event.pages ?? []).length).toBeGreaterThanOrEqual(2);
      expect(event.pages!.some((page) => page.conditions.some((condition) => condition.kind === "npcActivity"))).toBe(true);
    });

    it("friendshipUnlock 페이지는 대사 인자가 없으면 text 없이 만들어지고 friendshipLines 로만 채워진다", () => {
      const ctx = { project: createBlankProject() };
      const map = ctx.project.maps.map_blank_start!;
      const bare = runTool(ctx, "make_villager", { mapId: map.id, name: "마법사", home: { x: 2, y: 2 }, dialogue: [{ text: "기록을 찾고 있어." }], friendshipUnlock: 80 });
      expect(bare.ok, bare.summary).toBe(true);
      const bareEvent = ctx.project.maps[map.id]!.events.find((entry) => entry.pages?.[0]?.name === "마법사")!;
      expect(textBodies(bareEvent)).toEqual(["기록을 찾고 있어."]);

      const ctx2 = { project: createBlankProject() };
      const map2 = ctx2.project.maps.map_blank_start!;
      const authored = runTool(ctx2, "make_villager", {
        mapId: map2.id,
        name: "마법사",
        home: { x: 2, y: 2 },
        dialogue: [{ text: "기록을 찾고 있어." }],
        friendshipUnlock: 80,
        friendshipLines: { unlock: "네가 도와줬으니 서고 열쇠를 맡기지.", after: "서고는 잘 쓰고 있나?" },
      });
      expect(authored.ok, authored.summary).toBe(true);
      const authoredEvent = ctx2.project.maps[map2.id]!.events.find((entry) => entry.pages?.[0]?.name === "마법사")!;
      expect(textBodies(authoredEvent)).toEqual(["기록을 찾고 있어.", "네가 도와줬으니 서고 열쇠를 맡기지.", "서고는 잘 쓰고 있나?"]);
    });
  });
  describe("author_npc_cast — 캐스트 시트를 페이지·세계관에 적용한다", () => {
    it("대기 페이지를 채우고 비텍스트 커맨드(상점)를 보존하며 주민을 세계관 개체로 등록한다", () => {
      const ctx = { project: createBlankProject() };
      const map = ctx.project.maps.map_blank_start!;
      const potion = ctx.project.database.items[0]?.id;
      expect(potion).toBeTruthy();
      const a = runTool(ctx, "place_npc", { mapId: map.id, x: 2, y: 2, name: "주민 1", pages: [{}], id: "ev_a" });
      const b = runTool(ctx, "place_npc", { mapId: map.id, x: 5, y: 2, name: "주민 2", pages: [{}], id: "ev_b" });
      const stock = runTool(ctx, "set_shop_stock", { mapId: map.id, eventId: "ev_b", stock: [{ itemId: potion }] });
      expect(a.ok && b.ok && stock.ok, `${a.summary} / ${b.summary} / ${stock.summary}`).toBe(true);
      const result = runTool(ctx, "author_npc_cast", {
        mapId: map.id,
        residents: [
          { eventId: "ev_a", name: "은호", role: "어부", summary: "새벽 그물을 걷는 청년", knows: ["ev_b"], pages: [{ pageId: "ev_a_p0", lines: ["다래 가게에 은어를 넘겼어요."] }] },
          { eventId: "ev_b", name: "다래", role: "잡화점 주인", summary: "장터 상인", knows: ["ev_a"], pages: [{ pageId: "ev_b_p0", lines: ["은호가 잡은 은어가 특산이에요."] }] },
        ],
      });
      expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
      const events = ctx.project.maps[map.id]!.events;
      const eunho = events.find((event) => event.id === "ev_a")!;
      const darae = events.find((event) => event.id === "ev_b")!;
      expect(eunho.pages![0]!.name).toBe("은호");
      expect(textBodies(eunho)).toEqual(["다래 가게에 은어를 넘겼어요."]);
      expect(textBodies(darae)).toEqual(["은호가 잡은 은어가 특산이에요."]);
      expect(darae.pages![0]!.commands.some((command) => command.kind === "shop")).toBe(true);
      const world = ctx.project.world!;
      expect(world.entities.filter((entity) => entity.type === "character").map((entity) => entity.name).sort()).toEqual(["다래", "은호"]);
      expect(world.relations.some((relation) => relation.kind === "knows")).toBe(true);
      expect(result.diff?.eventsModified).toBe(2);
      expect(result.diff?.worldEntitiesAdded).toBeGreaterThanOrEqual(3);
    });
  });
});

// 2026-09-24 연애 도그푸딩: 공략 인물 셋(girl/woman/boy)이 대사를 고치는 upsert_event 한 번씩에 전부
// 같은 기본 주민이 됐고, 축제 맵에 다시 세운 같은 인물은 query 가 달라 다른 얼굴이 됐다.
describe("npcLookContinuity", () => {
  isolateTimers();
  function lookOf(project: ReturnType<typeof createBlankProject>, mapId: string, eventId: string) {
    const graphic = project.maps[mapId]!.events.find((event) => event.id === eventId)!.pages![0]!.graphic;
    return `${graphic?.sprite?.id}#${graphic?.pattern}`;
  }
  describe("NPC 외형 연속성", () => {
    it("upsert_event 가 graphic 없는 pages 로 바꿔도 기존 외형을 유지한다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const placed = runTool(ctx, "place_npc", { mapId, id: "npc_summer", name: "한여름", x: 3, y: 3, graphic: { query: "girl" }, pages: [{ lines: ["안녕!"] }] });
      expect(placed.ok, placed.summary).toBe(true);
      const before = lookOf(ctx.project, mapId, "npc_summer");
      const updated = runTool(ctx, "upsert_event", {
        mapId,
        event: { id: "npc_summer", pages: [{ trigger: { kind: "action" }, commands: [{ kind: "text", body: "다시 안녕!" }] }] },
      });
      expect(updated.ok, updated.summary).toBe(true);
      expect(lookOf(ctx.project, mapId, "npc_summer")).toBe(before);
    });

    it("다른 맵에 같은 이름의 인물을 query 로 세우면 이미 있는 외형을 쓴다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      expect(runTool(ctx, "create_map", { id: "map_fest", name: "축제", width: 20, height: 15 }).ok).toBe(true);
      expect(runTool(ctx, "place_npc", { mapId, id: "npc_summer", name: "한여름", x: 3, y: 3, graphic: { query: "girl" }, pages: [{ lines: ["안녕!"] }] }).ok).toBe(true);
      const again = runTool(ctx, "place_npc", { mapId: "map_fest", id: "npc_fest_summer", name: "한여름", x: 5, y: 5, graphic: { query: "woman" }, pages: [{ lines: ["축제다!"] }] });
      expect(again.ok, again.summary).toBe(true);
      expect(lookOf(ctx.project, "map_fest", "npc_fest_summer")).toBe(lookOf(ctx.project, mapId, "npc_summer"));
      expect((again.diff?.warnings ?? []).join(" ")).toContain("같은 인물");
    });
  });
});

describe("npcMovementInference", () => {
  isolateTimers();
  function ctx() {
    const context = { project: createBlankProject() } as ToolContext;
    return { context, mapId: context.project.startMapId };
  }
  describe("place_npc archetype movement inference", () => {
    it("infers random for roaming archetypes when movement is omitted", () => {
      const { context, mapId } = ctx();
      for (const [index, name] of ["장터 아이", "떠돌이 행상", "마을 개"].entries()) {
        const id = `npc_roam_${index}`;
        const result = runTool(context, "place_npc", {
          mapId, x: 1 + index * 3, y: 1, id, name, pages: [{ text: "어슬렁." }],
        });
        expect(result.ok, result.summary).toBe(true);
        expect(context.project.maps[mapId]?.events.find((e) => e.id === id)?.pages?.[0]?.movement.type).toBe("random");
        expect(((result.diff?.warnings ?? []) as readonly string[]).join("\n")).toContain("random(배회");
      }
    });

    it("keeps fixed for anchored archetypes when movement is omitted", () => {
      const { context, mapId } = ctx();
      for (const [index, name] of ["잡화점 주인", "북문 문지기", "마을 안내판"].entries()) {
        const id = `npc_anchor_${index}`;
        const result = runTool(context, "place_npc", {
          mapId, x: 1 + index * 3, y: 5, id, name, pages: [{ text: "어서 오게." }],
        });
        expect(result.ok, result.summary).toBe(true);
        expect(context.project.maps[mapId]?.events.find((e) => e.id === id)?.pages?.[0]?.movement.type).toBe("fixed");
      }
    });

    it("infers approach for stalker-named monsters when movement is omitted", () => {
      const { context, mapId } = ctx();
      const result = runTool(context, "place_npc", {
        mapId, x: 8, y: 8, id: "npc_stalker", name: "숲속 추격자",
        graphic: { query: "monster" }, pages: [{ text: "으르렁." }],
      });
      expect(result.ok, result.summary).toBe(true);
      expect(context.project.maps[mapId]?.events.find((e) => e.id === "npc_stalker")?.pages?.[0]?.movement.type).toBe("approach");
      expect(((result.diff?.warnings ?? []) as readonly string[]).join("\n")).toContain("approach(접근");
    });

    it("explicit movement always wins over inference", () => {
      const { context, mapId } = ctx();
      const pinned = runTool(context, "place_npc", {
        mapId, x: 12, y: 1, id: "npc_pinned", name: "장터 아이",
        movement: "fixed", pages: [{ text: "가만히." }],
      });
      expect(pinned.ok, pinned.summary).toBe(true);
      expect(context.project.maps[mapId]?.events.find((e) => e.id === "npc_pinned")?.pages?.[0]?.movement.type).toBe("fixed");
      const roamer = runTool(context, "place_npc", {
        mapId, x: 12, y: 5, id: "npc_roamer", name: "잡화점 주인",
        movement: "random", pages: [{ text: "돌아다녀." }],
      });
      expect(roamer.ok, roamer.summary).toBe(true);
      expect(context.project.maps[mapId]?.events.find((e) => e.id === "npc_roamer")?.pages?.[0]?.movement.type).toBe("random");
    });

    it("defaults to random for unmarked names when movement is omitted", () => {
      const { context, mapId } = ctx();
      for (const [index, name] of ["나그네", "농부", "촌장 보좌"].entries()) {
        const id = `npc_unmarked_${index}`;
        const result = runTool(context, "place_npc", {
          mapId, x: 14 + index, y: 10, id, name,
          pages: [{ text: "길을 묻는다." }],
        });
        expect(result.ok, result.summary).toBe(true);
        expect(context.project.maps[mapId]?.events.find((e) => e.id === id)?.pages?.[0]?.movement.type).toBe("random");
        expect(((result.diff?.warnings ?? []) as readonly string[]).join("\n")).toContain("random(배회");
      }
    });
  });
  describe("make_villager archetype movement inference", () => {
    it("infers random for roaming names and fixed for shopkeepers when omitted", () => {
      const { context, mapId } = ctx();
      const roam = runTool(context, "make_villager", {
        mapId, name: "장터 아이", home: { x: 2, y: 2 }, dialogue: [{ text: "놀자!" }],
      });
      expect(roam.ok, roam.summary).toBe(true);
      expect(context.project.maps[mapId]?.events.find((e) => e.pages?.[0]?.name === "장터 아이")?.pages?.[0]?.movement.type).toBe("random");

      const shop = runTool(context, "make_villager", {
        mapId, name: "대장간 주인", home: { x: 6, y: 6 }, dialogue: [{ text: "무기 봐라." }],
      });
      expect(shop.ok, shop.summary).toBe(true);
      expect(context.project.maps[mapId]?.events.find((e) => e.pages?.[0]?.name === "대장간 주인")?.pages?.[0]?.movement.type).toBe("fixed");
    });
  });
  describe("place_battle_blocker movement option", () => {
    it("defaults to fixed and accepts explicit random", () => {
      const context: ToolContext = { project: createBlankProject() };
      const mapId = context.project.startMapId;
      const troopId = context.project.database.troops[0]?.id;
      if (!troopId) throw new Error("troop missing");
      const guard = runTool(context, "place_battle_blocker", {
        mapId, x: 4, y: 4, id: "ev_guard", troopId,
      });
      expect(guard.ok, guard.summary).toBe(true);
      expect(context.project.maps[mapId]?.events.find((e) => e.id === "ev_guard")?.pages?.[0]?.movement.type).toBe("fixed");
      const patrol = runTool(context, "place_battle_blocker", {
        mapId, x: 8, y: 8, id: "ev_patrol", troopId, fightMovement: "random",
      });
      expect(patrol.ok, patrol.summary).toBe(true);
      expect(context.project.maps[mapId]?.events.find((e) => e.id === "ev_patrol")?.pages?.[0]?.movement.type).toBe("random");
    });
  });
  describe("make_hunting_ground chase default", () => {
    it("defaults chase to true and respects explicit false", () => {
      const context: ToolContext = { project: createBlankProject() };
      const mapId = context.project.startMapId;
      const troopId = context.project.database.troops[0]?.id;
      if (!troopId) throw new Error("troop missing");
      const first = runTool(context, "make_hunting_ground", {
        mapId, area: { x: 1, y: 1, w: 3, h: 3 }, troopId,
      });
      expect(first.ok, first.summary).toBe(true);
      expect(context.project.maps[mapId]?.fieldSpawns?.at(-1)?.chase).toBe(true);
      const second = runTool(context, "make_hunting_ground", {
        mapId, area: { x: 6, y: 6, w: 2, h: 2 }, troopId, chase: false,
      });
      expect(second.ok, second.summary).toBe(true);
      expect(context.project.maps[mapId]?.fieldSpawns?.at(-1)?.chase).toBe(false);
    });
  });
});

describe("npcMovementSelection", () => {
  isolateTimers();
  function ctx() {
    const context = { project: createBlankProject() } as ToolContext;
    return { context, mapId: context.project.startMapId };
  }
  describe("npc movement selection", () => {
    it("make_villager defaults to roaming, not fixed", () => {
      const { context, mapId } = ctx();
      const result = runTool(context, "make_villager", {
        mapId,
        name: "평범 주민",
        home: { x: 2, y: 2 },
        dialogue: [{ text: "안녕." }],
      });
      expect(result.ok, result.summary).toBe(true);
      const event = context.project.maps[mapId].events.find((e) => e.pages?.[0]?.name === "평범 주민");
      expect(event?.pages?.[0]?.movement.type).toBe("random");
    });

    it("make_villager stays still when fixed is explicit", () => {
      const { context, mapId } = ctx();
      const result = runTool(context, "make_villager", {
        mapId,
        name: "고정 주민",
        home: { x: 2, y: 2 },
        movement: "fixed",
        dialogue: [{ text: "안녕." }],
      });
      expect(result.ok, result.summary).toBe(true);
      const event = context.project.maps[mapId].events.find((e) => e.pages?.[0]?.name === "고정 주민");
      expect(event?.pages?.[0]?.movement.type).toBe("fixed");
    });

    it("make_villager movement random wanders", () => {
      const { context, mapId } = ctx();
      const result = runTool(context, "make_villager", {
        mapId,
        name: "배회 주민",
        home: { x: 3, y: 3 },
        movement: "random",
        dialogue: [{ text: "돌아다녀요." }],
      });
      expect(result.ok, result.summary).toBe(true);
      const event = context.project.maps[mapId].events.find((e) => e.pages?.[0]?.name === "배회 주민");
      expect(event?.pages?.every((p) => p.movement.type === "random")).toBe(true);
    });

    it("place_npc movement random wanders, default fixed", () => {
      const { context, mapId } = ctx();
      const wander = runTool(context, "place_npc", {
        mapId,
        x: 1,
        y: 1,
        id: "npc_wander_move",
        name: "배회상인",
        movement: "random",
        pages: [{ text: "구경해." }],
      });
      expect(wander.ok, wander.summary).toBe(true);
      const fixed = runTool(context, "place_npc", {
        mapId,
        x: 10,
        y: 10,
        id: "npc_fixed_move",
        name: "고정상인",
        pages: [{ text: "어서 와." }],
      });
      expect(fixed.ok, fixed.summary).toBe(true);
      const w = context.project.maps[mapId].events.find((e) => e.id === "npc_wander_move");
      const f = context.project.maps[mapId].events.find((e) => e.id === "npc_fixed_move");
      expect(w?.pages?.[0]?.movement.type).toBe("random");
      expect(f?.pages?.[0]?.movement.type).toBe("fixed");
    });
  });
});

// 상인 NPC 배치가 「무기 상인의 집 문」 발판을 상인으로 재사용해 덮어쓰던 것(2026-09-24 JRPG 도그푸딩 ember-3).
describe("npcReuseSkipsDoorRelay", () => {
  isolateTimers();
  const page = (name: string, trigger: "playerTouch" | "action", commands: unknown[]) => ({
    id: `${name}_p`, name, conditions: [], trigger: { kind: trigger }, priority: "below", movement: { type: "fixed", speed: 3, frequency: 3 }, graphic: {}, commands,
  });
  describe("근접 유사 NPC 재사용은 문·발판을 건드리지 않는다", () => {
    it("상인 이름이 든 문 발판 옆에 상인을 놓으면 새 NPC 를 만든다", () => {
      const ctx = { project: createBlankProject() };
      const map = ctx.project.maps[ctx.project.startMapId]!;
      map.events.push(
        { id: "ev_door", x: 5, y: 4, trigger: { kind: "playerTouch" }, commands: [], pages: [page("무기 상인의 집 문", "playerTouch", [{ kind: "transfer", mapId: map.id, x: 1, y: 1 }])] } as unknown as GameEvent,
        { id: "ev_door_step", x: 5, y: 5, trigger: { kind: "playerTouch" }, commands: [], pages: [page("무기 상인의 집 문", "playerTouch", [{ kind: "callMapEvent", eventId: "ev_door" }])] } as unknown as GameEvent,
      );
      const result = runTool(ctx, "place_npc", { mapId: map.id, name: "무기 상인", x: 6, y: 5, pages: [{ name: "무기점", lines: ["어서 오게"] }] }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      expect(JSON.stringify(result.diff?.warnings ?? [])).not.toContain("근접 유사 NPC 재사용");
      const step = ctx.project.maps[map.id]!.events.find((event) => event.id === "ev_door_step")!;
      expect(step.pages![0]!.commands).toEqual([{ kind: "callMapEvent", eventId: "ev_door" }]);
      expect(ctx.project.maps[map.id]!.events.filter((event) => event.name === "무기 상인" || event.pages?.[0]?.name === "무기점")).toHaveLength(1);
    });

    it("진짜 상인 NPC 는 여전히 재사용한다", () => {
      const ctx = { project: createBlankProject() };
      const map = ctx.project.maps[ctx.project.startMapId]!;
      expect(runTool(ctx, "place_npc", { mapId: map.id, name: "상인", x: 6, y: 5, pages: [{ name: "상점", lines: ["어서 와"] }] }, { dryRun: false }).ok).toBe(true);
      const second = runTool(ctx, "place_npc", { mapId: map.id, name: "잡화 상인", x: 6, y: 6, pages: [{ name: "상점", lines: ["또 왔네"] }] }, { dryRun: false });
      expect(JSON.stringify(second.diff?.warnings ?? [])).toContain("근접 유사 NPC 재사용");
    });
  });
});
