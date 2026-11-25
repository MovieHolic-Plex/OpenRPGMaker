import { describe, expect, it } from "vitest";
import { runTool, type ToolContext } from "@/editor/tools";
import { createBlankProject, TILE } from "@/project/defaults";
import type { Project } from "@/project/types";
import assert from "node:assert/strict";
import { isolateTimers } from "./mergedTeardown";

describe("toolsDbRecordReach", () => {
  isolateTimers();
  const EXTRA_COLLECTIONS = [
    "monsterSpecies",
    "crops",
    "lifeSkills",
    "farmAnimalSpecies",
    "fishSpecies",
    "farmBuildingTypes",
    "homeDecorationTypes",
  ] as const;
  type ExtraCollection = (typeof EXTRA_COLLECTIONS)[number];
  function contextWithRecord(collection: ExtraCollection): ToolContext {
    const project = createBlankProject();
    const itemId = project.database.items[0]?.id;
    if (!itemId) throw new Error("blank project must contain an item fixture");

    switch (collection) {
      case "monsterSpecies": {
        const source = project.database.monsterSpecies?.[0];
        if (!source) throw new Error("blank project must contain a monster species fixture");
        project.database.enemies.forEach((enemy) => delete enemy.speciesId);
        project.database.monsterSpecies = [{ ...structuredClone(source), id: "record_source", name: "원본" }];
        break;
      }
      case "crops":
        project.database.crops = [{
          id: "record_source",
          name: "원본",
          seedItemId: itemId,
          harvestItemId: itemId,
          harvestCount: 1,
          stages: [{ days: 1 }],
          seasons: ["spring"],
        }];
        break;
      case "lifeSkills":
        project.database.lifeSkills = [{
          id: "record_source",
          name: "원본",
          skillType: "farming",
          maxLevel: 10,
          levelUpRewards: [],
        }];
        break;
      case "farmAnimalSpecies":
        project.database.farmAnimalSpecies = [{
          id: "record_source",
          name: "원본",
          feedItemId: itemId,
          productItemId: itemId,
          productCount: 1,
          productEveryDays: 1,
          petFriendship: 0,
        }];
        break;
      case "fishSpecies":
        project.database.fishSpecies = [{ id: "record_source", name: "원본", itemId }];
        break;
      case "farmBuildingTypes":
        project.database.farmBuildingTypes = [{
          id: "record_source",
          name: "원본",
          levels: [{
            level: 1,
            footprint: { width: 1, height: 1 },
            capacity: 1,
            graphicResourceId: "oprn-title-field",
          }],
        }];
        break;
      case "homeDecorationTypes":
        project.database.homeDecorationTypes = [{
          id: "record_source",
          name: "원본",
          placementItemId: itemId,
          footprint: { width: 1, height: 1 },
          blocksMovement: true,
          allowedOrientations: ["down"],
          graphicResourceId: "oprn-title-field",
        }];
        break;
    }
    return { project };
  }
  function records(project: Project, collection: ExtraCollection): readonly { id: string; name: string }[] {
    return project.database[collection] ?? [];
  }
  describe("database record reach", () => {
    it.each(EXTRA_COLLECTIONS)("duplicates %s with a new id", (collection) => {
      const ctx = contextWithRecord(collection);

      const result = runTool(ctx, "duplicate_database_record", {
        collection,
        id: "record_source",
        newId: "record_copy",
        name: "복제본",
      });

      expect(result.ok, result.summary).toBe(true);
      expect(records(ctx.project, collection).find((record) => record.id === "record_copy")).toMatchObject({
        id: "record_copy",
        name: "복제본",
      });
    });

    it.each(EXTRA_COLLECTIONS)("deletes %s", (collection) => {
      const ctx = contextWithRecord(collection);

      const result = runTool(ctx, "delete_database_record", { collection, id: "record_source" });

      expect(result.ok, result.summary).toBe(true);
      expect(records(ctx.project, collection).some((record) => record.id === "record_source")).toBe(false);
    });

    it.each(["duplicate_database_record", "delete_database_record"] as const)(
      "%s rejects an unknown collection and names valid values",
      (tool) => {
        const ctx = contextWithRecord("lifeSkills");
        const result = runTool(ctx, tool, {
          collection: "unknownRecords",
          id: "record_source",
          ...(tool === "duplicate_database_record" ? { newId: "record_copy" } : {}),
        });

        expect(result.ok).toBe(false);
        expect(result.issues?.[0]?.message).toContain("monsterSpecies");
        expect(result.issues?.[0]?.message).toContain("homeDecorationTypes");
      },
    );
  });
  describe("title screen effect reach", () => {
    it("writes background layers, particles, and intro", () => {
      const ctx: ToolContext = { project: createBlankProject() };

      const result = runTool(ctx, "set_title_screen", {
        backgroundLayers: [
          { resourceId: "title_sky", scrollXPerSec: 4, scrollYPerSec: -2, parallax: 0.5, opacity: 0.8 },
        ],
        particles: { preset: "snow", density: 0.4 },
        intro: { logo: "riseIn", menu: "slideUp", delayMs: 300, staggerMs: 80 },
      });

      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.system.titleScreen?.backgroundLayers).toEqual([
        { resourceId: "title_sky", scrollXPerSec: 4, scrollYPerSec: -2, parallax: 0.5, opacity: 0.8 },
      ]);
      expect(ctx.project.system.titleScreen?.particles).toEqual({ preset: "snow", density: 0.4 });
      expect(ctx.project.system.titleScreen?.intro).toEqual({
        logo: "riseIn",
        menu: "slideUp",
        delayMs: 300,
        staggerMs: 80,
      });
    });

    it("omitting an effect section preserves it", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const titleScreen = ctx.project.system.titleScreen;
      if (!titleScreen) throw new Error("blank project must contain title screen settings");
      titleScreen.backgroundLayers = [{ resourceId: "kept_layer", opacity: 0.6 }];
      titleScreen.particles = { preset: "fireflies", density: 12 };
      titleScreen.intro = { logo: "fadeIn", menu: "fadeIn", delayMs: 100, staggerMs: 20 };

      const result = runTool(ctx, "set_title_screen", { particles: { preset: "rain", density: 30 } });

      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.system.titleScreen?.backgroundLayers).toEqual([{ resourceId: "kept_layer", opacity: 0.6 }]);
      expect(ctx.project.system.titleScreen?.particles).toEqual({ preset: "rain", density: 30 });
      expect(ctx.project.system.titleScreen?.intro).toEqual({
        logo: "fadeIn",
        menu: "fadeIn",
        delayMs: 100,
        staggerMs: 20,
      });
    });

    it("rejects more than four background layers", () => {
      const ctx: ToolContext = { project: createBlankProject() };

      const result = runTool(ctx, "set_title_screen", {
        backgroundLayers: Array.from({ length: 5 }, (_, index) => ({ resourceId: `title_layer_${index}` })),
      });

      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.message).toContain("최대 4개");
    });

    it("rejects invalid effects and names valid particle presets", () => {
      const ctx: ToolContext = { project: createBlankProject() };

      const result = runTool(ctx, "set_title_screen", { particles: { preset: "mist" } });

      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.message).toContain("snow");
      expect(result.issues?.[0]?.message).toContain("rain");
      expect(result.issues?.[0]?.message).toContain("fireflies");
    });
  });
});

describe("toolsReadEmptyAndBlocked", () => {
  isolateTimers();
  // 2026-11-11 B5a: 싼 모델은 스키마 칸을 기본값으로 다 채워 보낸다(빈 members, 서 있는 적의 patrol, 다른 graphic, 문앞과 같은 doorAt).
  // 전에는 도구가 거절하고 game.ts 의 감싸개가 한국어 거절 글을 정규식으로 읽어 다시 불렀다. 이제 도구가 스스로 읽는다.
  function fixture() {
    const ctx = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const enemy = ctx.project.database.enemies[0];
    assert(enemy);
    const troop = runTool(ctx, "upsert_troop", { troop: { id: "troop_b5", name: "시험 무리", enemyIds: [enemy.id], members: [] } });
    // 도구 호출은 프로젝트를 새 객체로 바꾼다 — 맵은 그 뒤에 집는다(앞에서 집은 맵을 고치면 도구가 보는 맵이 아니다).
    const map = ctx.project.maps[mapId];
    assert(map);
    return { ctx, mapId, map, troop };
  }
  const warningsOf = (result: { diff?: { warnings: string[] } }) => (result.diff?.warnings ?? []).join("\n");
  describe("도구가 빈 칸·어긋난 칸을 스스로 읽는다", () => {
    it("upsert_troop: 빈 members 는 안 준 것이다", () => {
      const { ctx, troop } = fixture();
      assert(troop.ok, troop.summary);
      expect(ctx.project.database.troops.find((entry) => entry.id === "troop_b5")?.enemyIds).toHaveLength(1);
    });

    it("place_field_enemy: 서 있는 적의 patrol 은 무시하고 알린다", () => {
      const { ctx, mapId } = fixture();
      const result = runTool(ctx, "place_field_enemy", { mapId, x: 4, y: 4, troopId: "troop_b5", behavior: "stationary", patrol: { length: 1, axis: "horizontal", directions: [] } });
      assert(result.ok, result.summary);
      expect(warningsOf(result)).toContain("patrol was not used");
    });

    it("place_field_enemy: 추격 적의 내용 없는 patrol 은 없는 것으로 본다", () => {
      const { ctx, mapId } = fixture();
      const result = runTool(ctx, "place_field_enemy", { mapId, x: 12, y: 4, troopId: "troop_b5", behavior: "chase", patrol: { length: 1, directions: [] } });
      assert(result.ok, result.summary);
      expect((result.data as { cells?: unknown }).cells).toBeUndefined();
    });

    it("place_field_enemy: 전투 그림과 다른 graphic 은 거절하지 않고 전투 그림을 따른다", () => {
      const { ctx, mapId } = fixture();
      const result = runTool(ctx, "place_field_enemy", { mapId, x: 4, y: 10, troopId: "troop_b5", behavior: "stationary", graphic: { textureKey: "tex_easyrpg_charset_people1", characterIndex: 0 } });
      assert(result.ok, result.summary);
      expect(warningsOf(result)).toContain("uses the battle picture");
    });

    it("create_transfer_pair: doorAt 이 문앞과 같은 칸이면 문앞만 준 것으로 읽는다", () => {
      const { ctx, mapId } = fixture();
      const result = runTool(ctx, "create_transfer_pair", { a: { mapId, x: 5, y: 5, doorAt: { x: 5, y: 5 } }, b: { mapId, x: 15, y: 10 } });
      assert(result.ok, result.summary);
    });

    it("create_transfer_pair: 문앞이 막혔으면 가까운 닿는 칸으로 옮겨 잇고 알린다", () => {
      const { ctx, mapId, map } = fixture();
      const solid = Object.entries(ctx.project.tilesets[map.tilesetId]?.tileMeta ?? {}).find(([, meta]) => meta?.passage === "solid");
      assert(solid, "막힌 타일이 있어야 한다");
      for (const [x, y] of [[8, 4], [7, 4], [9, 4], [8, 5]] as const) map.upperTiles[y * map.width + x] = Number(solid[0]);
      const result = runTool(ctx, "create_transfer_pair", { a: { mapId, x: 8, y: 4, doorAt: { x: 8, y: 3 } }, b: { mapId, x: 15, y: 10 } });
      assert(result.ok, result.summary);
      expect(warningsOf(result)).toContain("linked at the nearest walkable cell");
      expect((result.data as { gateA: { x: number; y: number } }).gateA).not.toEqual({ x: 8, y: 4 });
    });
  });
});

// 여관 출구 재현: 벽에 붙은 문 자리에 이벤트가 있으면 gate가 1칸 안쪽으로 밀리는 결함.
describe("transferGateOccupied", () => {
  isolateTimers();
  function ctxWithMaps(): ToolContext {
    const context: ToolContext = { project: createBlankProject() };
    const created = runTool(context, "create_map", { id: "map_b", name: "실내", width: 20, height: 15 }, { dryRun: false });
    expect(created.ok, created.summary).toBe(true);
    return context;
  }
  describe("create_transfer_pair 점유된 문 자리", () => {
    it("벽에 붙은 flush 칸에 이벤트가 있어도 1칸 안쪽 gate를 내놓지 않는다", () => {
      const context = ctxWithMaps();
      const map = context.project.maps[context.project.startMapId]!;
      // 북벽 + 문 자리(8,1) 점유 — 여관에서 이미 문 이벤트가 깔린 상태 재현.
      for (let x = 0; x < map.width; x += 1) map.lowerTiles[x] = TILE.WALL;
      map.events.push({
        id: "ev_door",
        x: 8,
        y: 1,
        trigger: { kind: "action" },
        commands: [],
        pages: [],
      });
      const result = runTool(
        context,
        "create_transfer_pair",
        { a: { mapId: map.id, x: 8, y: 2 }, b: { mapId: "map_b", x: 4, y: 4 } },
        { dryRun: false },
      );
      // 1칸 안쪽(8,2)에 gate를 깔면 버그 재현 — flush 칸이 막혔으면 실패하거나
      // 옆 flush 칸(7,1)/(9,1)이어야지 (8,2)는 안 된다.
      if (result.ok) {
        const gateA = (result.data as { gateA: { x: number; y: number } }).gateA;
        expect(gateA).not.toEqual({ x: 8, y: 2 });
        expect(gateA.y).toBe(1);
      }
    });
  });
});

// 알 수 없는 명령 kind 에 「이걸 뜻했나」를 붙이고, 같은 id 로 make_chase_scene 을 다시 부르면 그 추격자를 다시 만든다
// (2026-11-04 조수 대조: Argon 의 {kind:"conditionalBranch"} 가 「알 수 없는 kind」뿐인 글로 두 번 거절, Opus 의 추격자 속도 고치기가
// 「이미 있습니다」로 두 번 거절).
describe("unknownKindAndChaserRedo", () => {
  isolateTimers();
  const page = (commands: unknown[]) => ({ id: "p", conditions: [], trigger: { kind: "action" }, commands });
  describe("알 수 없는 명령 kind 안내", () => {
    it("다른 엔진 이름은 이 엔진의 모양을, 오타는 가까운 kind 를 알려 준다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const foreign = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_a", name: "a", x: 3, y: 3, pages: [page([{ kind: "conditionalBranch", condition: { kind: "gold", op: ">=", amount: 20 }, then: [] }])] } });
      expect(foreign.ok).toBe(false);
      expect(foreign.summary).toContain("this engine's equivalent is fork");
      const typo = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_b", name: "b", x: 4, y: 3, pages: [page([{ kind: "showPicturez", pictureId: "x" }])] } });
      expect(typo.ok).toBe(false);
      expect(typo.summary).toMatch(/did you mean: showPicture\b/u);
    });
  });
  describe("make_chase_scene 같은 id 다시 부르기", () => {
    it("추격자는 새 인자로 다시 만들고, 추격자가 아닌 이벤트는 덮지 않는다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      expect(runTool(ctx, "make_chase_scene", { mapId, id: "ev_knight", chaser: { at: { x: 5, y: 5 }, speed: 3 } }).ok).toBe(true);
      const again = runTool(ctx, "make_chase_scene", { mapId, id: "ev_knight", chaser: { at: { x: 5, y: 5 }, speed: 5 } });
      expect(again.ok, again.summary).toBe(true);
      const knights = ctx.project.maps[mapId]!.events.filter((e) => e.id === "ev_knight");
      expect(knights).toHaveLength(1);
      expect(knights[0]!.pages![0]!.movement.speed).toBe(5);
      expect(runTool(ctx, "upsert_event", { mapId, event: { id: "ev_sign", name: "표지판", x: 2, y: 2, pages: [page([{ kind: "text", body: "x" }])] } }).ok).toBe(true);
      const clash = runTool(ctx, "make_chase_scene", { mapId, id: "ev_sign", chaser: { at: { x: 6, y: 5 } } });
      expect(clash.ok).toBe(false);
      expect(clash.summary).toContain("not a chaser");
    });
  });
});

describe("upsertEventInvisibleWall", () => {
  isolateTimers();
  // 회상 스토리 도그푸딩(2026-09-24): priority 를 생략한 투명 논리 이벤트(진입 컷신·문 열림 검사)가
  // 기본 「same」 으로 서서 방 가운데를 막았다. 그림 없는 페이지는 발밑으로 둔다.
  describe("upsert_event 그림 없는 페이지는 보이지 않는 벽이 되지 않는다", () => {
    it("priority 생략한 투명 auto·빈 action 페이지 위를 걸어 지나간다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const sw = ctx.project.switches[0]!.id;
      const put = runTool(ctx, "upsert_event", {
        mapId,
        event: { id: "ev_gate", name: "문 열림 검사", x: 4, y: 2, pages: [
          { trigger: { kind: "action" }, graphic: { transparent: true } },
          { trigger: { kind: "auto" }, conditions: [{ kind: "switch", switchId: sw, value: true }], graphic: { transparent: true }, commands: [{ kind: "wait", ms: 100 }] },
        ] },
      });
      expect(put.ok, put.summary).toBe(true);
      const pages = ctx.project.maps[mapId]!.events.find((event) => event.id === "ev_gate")!.pages!;
      expect(pages.map((page) => [page.priority, page.overlapForbidden])).toEqual([["below", false], ["below", false]]);
      const walk = runTool(ctx, "run_scene_test", {
        mapId, start: { x: 3, y: 2 },
        steps: [{ kind: "move", dir: "right" }, { kind: "move", dir: "right" }, { kind: "expect", playerAt: { x: 5, y: 2 } }],
      });
      expect(walk.ok, walk.summary).toBe(true);
    });

    it("그림이 있는 인물 페이지와 명시한 priority 는 그대로 둔다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const put = runTool(ctx, "upsert_event", {
        mapId,
        event: { id: "ev_wall", x: 6, y: 2, pages: [{ trigger: { kind: "action" }, priority: "same", graphic: { transparent: true } }] },
      });
      expect(put.ok, put.summary).toBe(true);
      expect(ctx.project.maps[mapId]!.events.find((event) => event.id === "ev_wall")!.pages![0]!.priority).toBe("same");
    });
  });
  describe("upsert_event 조건 모양 오류", () => {
    it("conditions 없는 all 조건을 JS 예외가 아니라 고칠 칸을 짚어 거부한다", () => {
      const ctx = { project: createBlankProject() };
      const res = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: { id: "ev_x", x: 3, y: 3, pages: [{ trigger: { kind: "action" }, graphic: { transparent: true }, conditions: [{ kind: "all" }] }] } });
      expect(res.ok).toBe(false);
      expect(res.summary).toContain("conditions[0].conditions");
      expect(res.summary).not.toContain("not iterable");
    });
  });
});

// 2026-09-24 갤러리 호러 도그푸딩: upsert_event 8건이 두 가지 이유로 통째로 반려됐다 —
// 대사 본문을 `text` 로 보냄(「대사는 string body가 필요합니다」), 새 스위치·변수 id 를 선언 없이 씀(커밋 게이트
// 「switchId가 존재하지 않습니다」). 둘 다 뜻이 하나로 정해지므로 고쳐 받고 경고로 알린다.
describe("upsertEventTextAliasAndNewFlags", () => {
  isolateTimers();
  function introEvent(): Record<string, unknown> {
    return {
      id: "ev_intro", x: 3, y: 3,
      pages: [
        {
          trigger: { kind: "auto" }, conditions: [],
          commands: [
            { kind: "text", text: "하린: ……엄마?" },
            { kind: "setSwitch", switchId: "sw_intro_done", value: true },
            { kind: "setVariable", variableId: "var_petals", op: "=", value: 5 },
          ],
        },
        { trigger: { kind: "action" }, conditions: [{ kind: "switch", switchId: "sw_intro_done", value: true }], commands: [] },
      ],
    };
  }
  describe("upsert_event text alias and new flags", () => {
    it("moves text→body and registers new switch/variable ids", () => {
      const ctx: { project: Project } = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const result = runTool(ctx, "upsert_event", { mapId, event: introEvent() });
      expect(result.ok, `${result.summary} ${JSON.stringify(result.issues)}`).toBe(true);
      const event = ctx.project.maps[mapId]!.events.find(e => e.id === "ev_intro")!;
      const text = event.pages![0]!.commands[0] as Record<string, unknown>;
      expect(text.body).toBe("하린: ……엄마?");
      expect(text).not.toHaveProperty("text");
      expect(ctx.project.switches.some(s => s.id === "sw_intro_done")).toBe(true);
      expect(ctx.project.variables.some(v => v.id === "var_petals")).toBe(true);
      const warnings = JSON.stringify(result);
      expect(warnings).toContain("body");
      expect(warnings).toContain("sw_intro_done");
    });

    it("keeps rejecting a text command with two competing body aliases", () => {
      const ctx: { project: Project } = { project: createBlankProject() };
      const event = introEvent();
      (event.pages as { commands: unknown[] }[])[0]!.commands[0] = { kind: "text", text: "a", message: "b" };
      const result = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("body");
    });
  });
  describe("setVariable amount alias", () => {
    it("moves a numeric amount into value for common events", () => {
      const ctx: { project: Project } = { project: createBlankProject() };
      const result = runTool(ctx, "upsert_common_event", { id: "ce_restore", name: "회복", trigger: "none", commands: [
        { kind: "setVariable", variableId: "var_0001", op: "=", amount: 5 },
      ] });
      expect(result.ok, `${result.summary} ${JSON.stringify(result.issues)}`).toBe(true);
      const command = ctx.project.commonEvents.find(entry => entry.id === "ce_restore")!.commands[0] as Record<string, unknown>;
      expect(command.value).toBe(5);
      expect(command).not.toHaveProperty("amount");
    });
  });
  describe("inputNumber digits alias", () => {
    it("moves amount into digits so a code lock is not rejected", () => {
      const ctx: { project: Project } = { project: createBlankProject() };
      const result = runTool(ctx, "upsert_event", { mapId: ctx.project.startMapId, event: { id: "ev_safe", x: 3, y: 3, pages: [{
        conditions: [], trigger: { kind: "action" }, graphic: { transparent: true }, commands: [
          { kind: "inputNumber", variableId: "var_safe_input", amount: 4 },
          { kind: "fork", condition: { kind: "variable", variableId: "var_safe_input", op: "==", value: 4815 }, then: [{ kind: "text", body: "열렸다" }], else: [] },
        ] }] } });
      expect(result.ok, `${result.summary} ${JSON.stringify(result.issues)}`).toBe(true);
      const command = ctx.project.maps[ctx.project.startMapId]!.events.find(e => e.id === "ev_safe")!.pages![0]!.commands[0] as Record<string, unknown>;
      expect(command.digits).toBe(4);
      expect(command).not.toHaveProperty("amount");
    });
  });
});
