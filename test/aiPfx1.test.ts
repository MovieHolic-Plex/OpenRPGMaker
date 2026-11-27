import { beforeAll, describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import { applyGenrePreset } from "@/project/genrePresets";
import { preloadCurrentMonsterArt, isCurrentMonsterArt } from "@/assets/currentMonsterArt";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { dungeonArgs } from "@/ai/v2/place/builders/dungeon";
import { planTroops } from "@/ai/v2/place/builders/dungeonFoes";
import { bossArtInUse, distinctBossFoe, hasCurrentArt, namedFoeArt } from "@/ai/v2/story/currentFoes";
import { themedTroops } from "@/editor/tools/dungeonTools";
import type { DungeonType } from "@/editor/dungeonKit/types";
import type { ToolContext } from "@/editor/tools/types";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { withTodoLoop } from "@/ai/v2/loop/todoTools";
import { V2Session } from "@/ai/v2/turn/session";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { buildV2SystemPrompt } from "@/ai/v2/prompt/systemPrompt";
import { doorHouses, thinInsideNote, TIER_MIN_ROOMS } from "@/ai/v2/place/doorHouse";
import { HAND_INTERIOR_TILESET_ID } from "@/editor/handInterior/builder";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import { buildBlueprintPath } from "@/ai/v2/story/blueprintPath";
import { findingEn } from "@/ai/v2/judge/findingEn";
import { playProblems } from "@/ai/v2/judge/playCheck";
import { runTool } from "@/editor/tools/toolRunner";
import { settleStepPages, stepPagesOf } from "@/project/blueprintStepPages";
import { eventSight, thingWord } from "@/project/eventSight";
import { resolveEventPage } from "@/project/io";
import { runAutoPlay } from "@/qa/gameCheck/autoPlay";
import { HONEST_CAUSES, codeShown, honestCauseOf } from "@/qa/gameCheck/honestPlay";
import { STEAMPUNK_CITY_ID } from "@/project/defaults/steampunkCity";
import { isPassable } from "@/project/collision";
import { buildingEntrances } from "@/ai/v2/place/entrances";
import { afterWinLines } from "@/ai/v2/story/playerLines";
import { stepHandover } from "@/ai/v2/story/stepHandover";
import { fitPathBattlesIn, pathBattles } from "@/ai/v2/story/pathBattleBudget";
import { fitTroopCopy } from "@/editor/tools/bossThreatScaling";
import { simulateBattle } from "@/battle/simulate";
import { BOSS_BAND } from "@/ai/v2/story/pathBattleTension";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { requestSkeleton } from "@/ai/v2/loop/requestSkeleton";
import { questPresetIssue } from "@/project/quest/questPresets";
import { validateQuestReferences } from "@/project/quest/questValidation";
import { depthNeed, mapsNeed, smallGame } from "@/ai/v2/judge/blueprintScale";
import { shipBlockers, sizeNotices } from "@/ai/v2/judge/shipChecks";
import { sizeNoticeOnce } from "@/ai/v2/judge/sizeNotice";
import { findBarSpot } from "@/ai/v2/place/barSpot";
import { anchorsOf, blockersOf, bodyReached, eventBlocks, reachFrom } from "@/ai/v2/judge/eventReach";
import { chainFightStepsIn, endAfterFinalFightIn } from "@/ai/v2/story/fightStepChain";
import { walkBlueprint } from "@/ai/v2/story/blueprint";
import { settleFoughtCopy } from "@/ai/v2/story/foughtCopy";
import { buildBossEncounter } from "@/ai/v2/story/sceneVerbs";
import { pickPersonGraphic } from "@/ai/v2/place/people";
import { charsetFamilyOf } from "@/project/charsetFamily";
import { hideLockCodes } from "@/ai/v2/story/codeLeaks";
import { ensureBossRest } from "@/ai/v2/story/healingAccess";
import { parseArtGap } from "@/project/artGap";
import { databaseChangeReport, unaskedChanges } from "@/ai/v2/judge/sideEffectChecks";
import { sceneCraftFindings } from "@/ai/v2/judge/sceneCraft";
import { REST_LINE } from "@/ai/v2/story/restLine";
import { isolateTimers } from "./mergedTeardown";

// 보스 그림은 게임 안에서 하나씩(2026-11-15 버들항 던전).
// 현행 그림이 있는 종이 서른여덟뿐이라 주제 보스가 대역으로 접히면 한 그림에 몰렸다 — 지하묘(리치)·마법탑(리치)·마계(마왕)가 모두 어둠 망령.
// planTroops 의 «쓴 그림» 은 한 번 부를 때만 살아 던전 둘을 지은 게임에서 두 보스가 같은 그림이었다. 이제 게임의 다른 보스가 쓰는 그림은 피한다.
describe("aiV2BossArtPerGame", () => {
  isolateTimers();
  beforeAll(async () => { await preloadCurrentMonsterArt(); });
  const artOfTroop = (project: Project, troopId: string | undefined): string => {
    const troop = project.database.troops.find((t) => t.id === troopId);
    const lead = troop?.members?.[0]?.enemyId ?? troop?.enemyIds?.[0];
    return String(project.database.enemies.find((e) => e.id === lead)?.monsterResourceId ?? "");
  };
  function game(key: string): ToolContext {
    const project = createBlankProject() as Project;
    applyGenrePreset(project, "adventure-jrpg");
    return { project, currentMapId: project.startMapId, assistantRun: true, lookKey: JSON.stringify(["project", key]) } as ToolContext;
  }
  /** 던전 하나의 적 그룹을 정하고(빌더와 같은 길: planTroops → 도구 themedTroops) 그 보스를 그 던전 맵에 세운다. 보스 그림을 돌려준다. */
  function raiseDungeon(ctx: ToolContext, name: string, type: DungeonType, features?: readonly string[]): string {
    const run = createBuildRun(ctx);
    const plan = dungeonArgs({ type: "dungeon", name, theme: type, features });
    const toolArgs = { name, ...plan.args };
    const given = planTroops(run, plan, toolArgs, []);
    const project = ctx.project;
    const troops = themedTroops(project, { ...toolArgs, ...(given ? { troops: given } : {}) });
    const id = `map_${type}_${Object.keys(project.maps).length}`;
    const old = Object.values(project.maps).find((m) => m.name === name);
    const mapId = old?.id ?? id;
    const src = project.maps[project.startMapId]!;
    const ev = { id: `ev_${mapId}_boss`, name: "보스", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [
      { id: "p1", name: "보스", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: true, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "battleProcessing", troopId: troops.boss }] },
    ] } as unknown as GameEvent;
    project.maps[mapId] = { ...src, id: mapId, name, events: [ev] } as GameMap;
    return artOfTroop(project, troops.boss);
  }
  // 한 시험이 던전을 여섯~여덟 채 짓는다(한 채 1.5~2.5초, CI 에서는 더 걸린다) — 기본 15초로는 모자란다.
  describe("보스 그림은 게임 안에서 겹치지 않는다", { timeout: 90_000 }, () => {
    it("대역이 한 그림에 몰리는 주제 여섯(지하묘·마법탑·마계·성·얼음굴·화산)을 한 게임에 지어도 보스 그림이 모두 다르다", () => {
      const ctx = game("boss-art-a");
      const types: DungeonType[] = ["catacomb", "tower", "otherworld", "castle", "ice", "volcano"];
      const arts = types.map((type) => raiseDungeon(ctx, `${type} 던전`, type));
      for (const art of arts) expect(art, "보스 그림이 비었다").not.toBe("");
      expect(new Set(arts).size, arts.join(" · ")).toBe(types.length);
      // 게임이 기억하는 «쓴 그림» = 지은 보스들의 그림
      expect([...bossArtInUse(ctx.project)].sort()).toEqual([...new Set(arts)].sort());
      // 같은 종류를 한 번 더(둘째 동굴)도 다른 그림이다.
      const cave1 = raiseDungeon(ctx, "첫째 동굴", "cave"), cave2 = raiseDungeon(ctx, "둘째 동굴", "cave");
      expect(cave2).not.toBe(cave1);
      expect(arts).not.toContain(cave2);
    });

    it("같은 열쇠의 게임은 같은 그림을 고르고(결정적), 던전을 다시 지어도 그 보스 그림 그대로다", () => {
      const order: DungeonType[] = ["catacomb", "tower", "otherworld"];
      const a = game("boss-art-b"), b = game("boss-art-b");
      const artsA = order.map((type) => raiseDungeon(a, `${type} 던전`, type));
      const artsB = order.map((type) => raiseDungeon(b, `${type} 던전`, type));
      expect(artsB).toEqual(artsA);
      // 둘째·셋째 던전을 다시 짓는다 — 제 옛 보스는 «쓴 그림» 에서 빠지고 같은 그림으로 돌아온다.
      expect(raiseDungeon(a, "tower 던전", "tower")).toBe(artsA[1]);
      expect(raiseDungeon(a, "otherworld 던전", "otherworld")).toBe(artsA[2]);
      expect(raiseDungeon(a, "catacomb 던전", "catacomb")).toBe(artsA[0]);
    });

    it("옛 게임(두 던전의 보스가 이미 같은 그림)은 다시 지어도 그 그림 그대로다", () => {
      const ctx = game("boss-art-old");
      const first = raiseDungeon(ctx, "ice 던전", "ice");
      // 옛 빌더가 지은 둘째 던전(화산): 얼음굴과 같은 그림의 보스가 이미 서 있다 — 화산의 기본 보스(붉은 용)도 같은 대역 그림(푸른 용)이다.
      const project = ctx.project;
      const ice = Object.values(project.maps).find((m) => m.name === "ice 던전")!;
      const old = structuredClone(ice.events[0]!) as GameEvent;
      project.maps.map_old_volcano = { ...ice, id: "map_old_volcano", name: "volcano 던전", events: [{ ...old, id: "ev_map_old_volcano_boss" }] } as GameMap;
      expect(raiseDungeon(ctx, "volcano 던전", "volcano")).toBe(first);
      // 새로 짓는 셋째 던전(둘째 얼음굴 — 같은 기본 보스)은 다른 그림이다.
      expect(raiseDungeon(ctx, "둘째 빙굴", "ice")).not.toBe(first);
    });

    it("마왕성으로 가는 길이라는 이름은 얼음굴의 기본 보스 그림을 바꾸지 않는다", () => {
      const neutral = game("destination-neutral"), titled = game("destination-titled");
      const art = neutral.project.database.enemies.find((e) => e.id === "enemy_dragon_blue")?.monsterResourceId;
      expect(art).toBeTruthy();
      expect(raiseDungeon(neutral, "빙굴", "ice", ["boss"])).toBe(art);
      expect(raiseDungeon(titled, "마왕성 가는 길의 던전", "ice", ["boss"])).toBe(art);
    });

    it("사용자가 짚은 보스는 옛 묶음에 그림이 있고 다른 던전에서 썼어도 그대로다", () => {
      const ctx = game("boss-art-named");
      const boss = "enemy_demon_lord";
      const expectedArt = ctx.project.database.enemies.find((e) => e.id === boss)?.monsterResourceId;
      expect(expectedArt).toBeTruthy();
      expect(hasCurrentArt(ctx.project, boss)).toBe(false);
      expect(raiseDungeon(ctx, "깊은 굴", "cave", ["마계의 군주"])).toBe(expectedArt);
      expect(raiseDungeon(ctx, "화산 굴", "volcano", ["마계의 군주"])).toBe(expectedArt);
    });

    it("모델이 이름 붙인 잡몹은 묶음과 관계없이 있는 그림을 쓴다", () => {
      const ctx = game("field-art-named");
      const enemyId = "enemy_skeleton_bone";
      const plan = dungeonArgs({ type: "dungeon", name: "마왕성 가는 길의 던전", theme: "catacomb", features: ["해골 순찰"] });
      const expectedArt = ctx.project.database.enemies.find((e) => e.id === enemyId)?.monsterResourceId;
      expect(expectedArt).toBeTruthy();
      expect(hasCurrentArt(ctx.project, enemyId)).toBe(false);
      const given = planTroops(createBuildRun(ctx), plan, { type: plan.type }, []);
      const troops = themedTroops(ctx.project, { type: plan.type, troops: given });
      expect(troops.field.map((id) => artOfTroop(ctx.project, id))).toEqual([expectedArt]);
    });

    it("묶음 안에 있는 리치 보스 그림은 부유하는 눈이 잡몹으로 있어도 유지한다", () => {
      const ctx = game("boss-art-named-family");
      const art = ctx.project.database.enemies.find((e) => e.id === "enemy_lich_frost")?.monsterResourceId;
      expect(art).toBeTruthy();
      expect(raiseDungeon(ctx, "깊은 성채", "castle", ["boss", "리치", "부유하는 눈"])).toBe(art);
    });

    it("distinctBossFoe: 안 쓴 그림이면 그대로, 쓴 그림이면 현행 그림의 다른 종, 금지한 종은 건너뛴다", () => {
      const project = game("boss-art-unit").project;
      const artOf = (id: string) => String(project.database.enemies.find((e) => e.id === id)?.monsterResourceId ?? "");
      expect(distinctBossFoe(project, "enemy_wraith_dark", new Set(), () => false, "k")).toBe("enemy_wraith_dark");
      const used = new Set([artOf("enemy_wraith_dark")]);
      const pick = distinctBossFoe(project, "enemy_wraith_dark", used, () => false, "k");
      expect(pick).not.toBe("enemy_wraith_dark");
      expect(hasCurrentArt(project, pick)).toBe(true);
      expect(used.has(artOf(pick))).toBe(false);
      const other = distinctBossFoe(project, "enemy_wraith_dark", used, (id) => id === pick, "k");
      expect(other).not.toBe(pick);
      expect(distinctBossFoe(project, "enemy_wraith_dark", used, () => false, "k")).toBe(pick);
    });
  });
});

// 버들항 마을을 지은 턴의 집 안 — 2026-11-16 r6 실모델(포구 마을 «갈매나루», Sonnet 5.5 high)에서 본 것과 오너 방향 「에셋들을 되게 자유롭게 쓰는 방향」.
//  · 지시문의 실내 카드는 턴을 시작할 때의 맵으로 고른 v5 표였고, 마을을 지은 뒤 집 안은 버들항 표로 검사돼 첫 두 장소가 세 번 거절됐다.
//  · 마을 결과의 문 목록이 킷 id 뿐이라 어느 문이 어떤 건물인지 읽을 수 없었고, 모델이 직접 부른 실내에는 크기 단이 붙지 않았다.
// 이제: 마을 결과가 그 마을의 실내 카드와 건물 이름 · 단을 싣고, v5 낱말로 쓴 방은 v5 표로 그대로 깔리고, 없는 이름은 가까운 것으로 바꿔 깔고 알리고,
// hints.door 로 문을 고르면 그 건물의 크기 단을 따른다.
describe("aiV2HouseDoorCard", () => {
  isolateTimers();
  const SLOW = 300_000;
  const TASK = "바닷가 포구 마을과 그 마을 성당 실내를 만들어 줘.";
  function turn() {
    const project = createBlankProject();
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const env = { ctx, request: { task: TASK, provider: "local-cli:claude", mapIds: [], project, projectKey: "house-door-card" } as never, emit: () => {}, record: () => {}, sideChat: async () => JSON.stringify({ score: 7, majors: [] }), checkpoint: async () => {},
      preferToolNextTurn: () => {}, clearToolPreference: () => {} } as unknown as PiAssistantV2Env;
    const session = new V2Session();
    const tools = withTodoLoop(env, session.todo, session.loop, createV2Tools(env, session), session.hooks);
    const call = async (name: string, args: unknown): Promise<string[]> => (await tools.find((t) => t.name === name)!.execute(`c-${name}`, args)).content.filter((c) => c.type === "text").map((c) => (c as { text?: string }).text ?? "");
    const village = async (): Promise<string[]> => {
      await call("todo", { op: "init", list: [{ phase: "p", items: [{ content: "마을", id: "v", check: { kind: "none" } }] }] });
      const spec = { type: "village", name: "갈매나루", hints: { theme: "coast" } };
      const first = await call("make_place", spec);
      return /"ok":true/u.test(first[0]!) ? first : call("make_place", spec);   // 첫 답은 땅 그림(짓기 전)일 수 있다 — 같은 호출을 다시 보내면 짓는다
    };
    return { ctx, call, village, start: project.startMapId };
  }
  const mill = (wall: string, floor: string, objects: unknown[], wallItems: unknown[] = []) => ({ map: { w: 14, h: 12 }, landmark: { id: "barrel stack", x: 1, y: 8 }, outer_wall: { material: wall, path: [[0, 0], [13, 0], [13, 11], [0, 11]] }, entrance: { x: 6, y: 11 },
    rooms: [{ id: "mill", at: [6, 5], floor, purpose: "mill" }], wall_items: [{ id: "window", wall: "outer", x: 2, y: 1 }, ...wallItems], objects });
  describe("버들항 마을을 지은 턴의 집 안 — 카드 · 문 목록 · 자유롭게 쓰는 낱말 · 문이 고르는 크기 단", () => {
    // 마을 빌더의 씨앗은 Math.random 에서 온다 — 같은 시험이 같은 마을을 짓게 못박는다.
    beforeEach(() => { let s = 20261116; vi.spyOn(Math, "random").mockImplementation(() => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }); });
    afterEach(() => { vi.restoreAllMocks(); });

    it("마을 결과가 그 마을의 실내 카드를 싣고(지시문의 카드는 v5), 문 목록은 건물 이름과 단을 싣는다", async () => {
      const t = turn();
      // 지시문: 빈 프로젝트에서는 턴을 시작할 때 v5 카드가 실린다(마을이 아직 없다)
      expect(buildV2SystemPrompt(t.ctx.project, t.start, TASK, undefined, "house-door-card").join("\n")).toContain(`[Interior catalog — chipset ${HAND_INTERIOR_TILESET_ID}`);
      const built = await t.village();
      expect(built[0]).toContain('"ok":true');
      const card = built.find((p) => p.includes("[Interior catalog — chipset beodeul_city"));
      expect(card, built.map((p) => p.slice(0, 80)).join(" | ")).toBeTruthy();
      expect(card).toContain("checked against chipset beodeul_city, not the [Interior catalog] card in your instructions");
      expect(card).toMatch(/^floors: dplank, plank, flag/mu);
      // 문 목록: 킷 id(좌표) «건물 이름» [단]
      const doors = /건물 크기를 따른다\): ([^"]*)"/u.exec(built[0]!)?.[1] ?? "";
      expect(doors).toMatch(/house-[\w-]+\(\d+,\d+\) «[^»]+»/u);
      expect(built[0]).toContain("hints.door [x,y]");
      // 문 목록의 좌표와 건물은 맵에서 읽은 문과 같다
      const houses = doorHouses(t.ctx.project, t.ctx.project.maps[t.start]);
      for (const m of doors.matchAll(/(house-[\w-]+)\((\d+),(\d+)\)/gu)) expect(houses.some((h) => h.kit === `bd-${m[1]}` && h.front.x === Number(m[2]) && h.front.y === Number(m[3])), m[0]).toBe(true);
      // 같은 턴에 한 번만 싣는다
      const again = await t.call("make_place", { type: "interior", name: "방앗간", layout: mill("log", "plank", [{ id: "crate", x: 9, y: 9 }]) });
      expect(again.some((p) => p.includes("[Interior catalog — chipset"))).toBe(false);
    }, SLOW);

    it("v5 조각 이름으로 쓴 방과 없는 이름을 쓴 방이 거절 없이 지어지고, 바꾼 것은 결과 글에 한 줄씩 적힌다", async () => {
      const t = turn();
      await t.village();
      // v5 카드의 낱말로 쓴 선술집 — 이 게임의 집 안 표(버들항)로 깔고, v5 낱말은 버들항의 가장 가까운 조각으로 바꿔 한 줄씩 알린다(한 게임 한 실내 칩셋, 2026-11-17 r8 D2)
      const v5 = { map: { w: 12, h: 10 }, landmark: { id: "counter 4x1", x: 3, y: 5 }, outer_wall: { material: "logdark", path: [[0, 0], [11, 0], [11, 9], [0, 9]] }, entrance: { x: 5, y: 9 },
        rooms: [{ id: "hall", at: [5, 7], floor: "boards", purpose: "tavern" }], wall_items: [{ id: "keg rack", wall: "outer", x: 1, y: 3 }],
        objects: [{ id: "roundtable", x: 2, y: 7 }, { id: "chair E", x: 1, y: 7 }, { id: "bar stool", x: 6, y: 7 }, { id: "barrel", x: 9, y: 7 }] };
      const a = JSON.parse((await t.call("make_place", { type: "interior", name: "선술집", layout: v5 }))[0]!) as { ok: boolean; mapIds: string[]; summary: string; warnings: string[] };
      expect(a.ok, a.summary).toBe(true);
      expect(t.ctx.project.maps[a.mapIds[0]!]!.tilesetId).toBe("beodeul_city");
      expect(a.warnings.join(" ")).toContain("laid with this game's interior chipset beodeul_city");
      expect(a.warnings).toContain('swapped piece "roundtable" → "round table" (not in this chipset\'s table — its nearest id)');
      expect(a.warnings).toContain('swapped piece "keg rack" → "ale kegs rack" (not in this chipset\'s table — its nearest id)');
      // 버들항 낱말에 없는 이름이 섞인 방 — 버들항 표로 깔고, 없는 이름은 가장 가까운 것으로 바꿔 알린다
      const mixed = mill("logdark", "plank", [{ id: "bar counter", x: 3, y: 6 }, { id: "milking stool", x: 4, y: 8 }, { id: "wooden chair", x: 8, y: 8 }, { id: "crate", x: 9, y: 9 }], [{ id: "ale kegs rack", wall: "outer", x: 8, y: 3 }]);
      const b = JSON.parse((await t.call("make_place", { type: "interior", name: "방앗간", layout: mixed }))[0]!) as { ok: boolean; mapIds: string[]; summary: string; warnings: string[] };
      expect(b.ok, b.summary).toBe(true);
      expect(t.ctx.project.maps[b.mapIds[0]!]!.tilesetId).toBe("beodeul_city");
      expect(b.summary).toContain("swapped");
      expect(b.warnings).toContain('swapped wall "logdark" → "log" (not in this chipset\'s table — its nearest id)');
      expect(b.warnings).toContain('swapped piece "wooden chair" → "chair" (not in this chipset\'s table — its nearest id)');
    }, SLOW);

    it("applies a new layout for a unique blueprint room to its existing map", async () => {
      const t = turn();
      await t.village();
      const spec = { type: "interior", name: "방앗간 안", layout: mill("log", "plank", [{ id: "crate", x: 9, y: 9 }]) };
      t.ctx.project.gameBlueprint = {
        version: 1, title: "Mill", genre: "Adventure", playerGoal: "Find the mill.",
        places: [{ name: spec.name, kind: "interior" }], steps: [],
        ending: { name: "The mill", how: "Find the mill", feeling: "Relief" },
      };
      const first = JSON.parse((await t.call("make_place", spec))[0]!) as { ok: boolean; mapIds: string[]; summary: string };
      expect(first.ok, first.summary).toBe(true);

      const layout = mill("log", "plank", [{ id: "crate", x: 8, y: 9 }]);
      const relaid = JSON.parse((await t.call("make_place", { ...spec, layout }))[0]!) as typeof first;
      expect(relaid.ok, relaid.summary).toBe(true);
      expect(relaid.mapIds).toEqual(first.mapIds);
      expect(Object.values(t.ctx.project.maps).filter((map) => map.name === spec.name)).toHaveLength(1);
    }, SLOW);

    it("asks for the layout before building a zone-only draft behind an inferred village door", async () => {
      const t = turn();
      await t.village();
      const result = JSON.parse((await t.call("make_place", {
        type: "interior", name: "방앗간 안", zones: [{ kind: "workshop", purpose: "방앗간" }],
      }))[0]!) as { notFailure?: boolean; summary: string };

      expect(result.notFailure, result.summary).toBe(true);
      expect(result.summary).toContain("spec.layout");
      expect(Object.values(t.ctx.project.maps).some((map) => map.name === "방앗간 안")).toBe(false);
    }, SLOW);

    it("hints.door 로 큰 건물의 문을 고르면 그 건물의 크기 단으로 짓고, 방이 모자란 실내를 큰 문에 이으면 그 사실과 고칠 호출을 알린다", async () => {
      const t = turn();
      await t.village();
      const big = doorHouses(t.ctx.project, t.ctx.project.maps[t.start]).find((d) => d.tier === "large" || d.tier === "xlarge");
      expect(big, "이 씨앗의 마을에는 큰 건물이 있어야 한다").toBeTruthy();
      const need = TIER_MIN_ROOMS[big!.tier!]!;
      // 모델의 한 방 배치: 거절하지 않고 깔되 그 건물의 단을 알린다
      const one = JSON.parse((await t.call("make_place", { type: "interior", name: "큰 집", layout: mill("log", "plank", [{ id: "crate", x: 9, y: 9 }]), hints: { door: [big!.front.x, big!.front.y] } }))[0]!) as { ok: boolean; mapIds: string[]; summary: string; warnings: string[] };
      expect(one.ok, one.summary).toBe(true);
      expect(one.warnings.join(" ")).toContain(`hints.door (${big!.front.x},${big!.front.y}) = «${big!.label}»`);
      expect(one.warnings.join(" ")).toMatch(new RegExp(`the building outside is ${big!.tier} \\(${big!.kit}\\) — ${big!.tier} buildings have ${need} or more rooms`, "u"));
      // 그 한 방을 큰 문에 이으면: 건물 이름 · 단 · 방 수 · 고칠 호출
      const note = thinInsideNote(t.ctx.project, { a: { mapId: t.start, x: big!.front.x, y: big!.front.y }, b: { mapId: one.mapIds[0]!, x: 6, y: 11 } });
      expect(note).toContain(`«${big!.label}» (${big!.kit}), a ${big!.tier} building`);
      expect(note).toContain(`"hints":{"door":[${big!.front.x},${big!.front.y}]}`);
      // 작은 집의 문에 이은 것은 알리지 않는다
      const small = doorHouses(t.ctx.project, t.ctx.project.maps[t.start]).find((d) => d.tier === "small");
      if (small) expect(thinInsideNote(t.ctx.project, { a: { mapId: t.start, x: small.front.x, y: small.front.y }, b: { mapId: one.mapIds[0]!, x: 6, y: 11 } })).toBeUndefined();
      // 배치 없이 그 문으로 다시 지으면 그 단의 구성(방 여럿)으로 선다
      const plan = JSON.parse((await t.call("make_place", { type: "interior", name: "큰 집", mapId: one.mapIds[0]!, hints: { door: [big!.front.x, big!.front.y] } }))[0]!) as { ok: boolean; mapIds: string[]; summary: string };
      expect(plan.ok, plan.summary).toBe(true);
      const rooms = plan.mapIds.flatMap((id) => (t.ctx.project.maps[id]?.locations ?? []).filter((l) => (l.tags ?? []).includes("hand-layout-room")));
      expect(rooms.length).toBeGreaterThanOrEqual(need);
      // 문이 아닌 칸은 무시하고 알린다
      const off = JSON.parse((await t.call("make_place", { type: "interior", name: "헛간", layout: mill("log", "plank", [{ id: "crate", x: 9, y: 9 }]), hints: { door: [0, 0] } }))[0]!) as { ok: boolean; warnings: string[] };
      expect(off.ok).toBe(true);
      expect(off.warnings.join(" ")).toContain("hints.door (0,0) is not a house door");
    }, SLOW);

    // r6 결함 4: 손으로 찍은 큰 건물(stamp_object — 놓기 기록이 남지 않는다)의 문도 그 킷 · 단으로 읽힌다. 같은 문 그림을 쓰는 킷이 여럿이라
    // (첨탑 성당 12×13 · 성당 블록 14×17 · 20×17 이 같은 문 칸) 입구 타일 이름만으로는 블록을 찍어도 «첨탑 성당» 이었다 — 맵의 칸과 겹쳐 고른다.
    it("손으로 찍은 성당 킷의 문: 그 킷과 초대형 단으로 읽히고, 그 문 뒤 실내는 hints.door 로 초대형 구성을 탄다", async () => {
      const t = turn();
      const map = t.ctx.project.maps[t.start]!;
      const W = 40, H = 30, grass = map.lowerTiles[0]!;
      const m = map as unknown as Record<string, number[]>;
      for (const k of ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"]) if (Array.isArray(m[k])) m[k] = Array<number>(W * H).fill(k === "lowerTiles" ? grass : -1);
      map.width = W; map.height = H;
      for (const [kit, x] of [["bd-house-cathedral", 2], ["bd-block-church-14x17", 20]] as const) {
        const r = await runToolAsync(t.ctx, "stamp_object", { mapId: t.start, objectId: `kit:beodeul_city/${kit}`, x, y: 1, onOverlap: "replace" });
        expect(r.ok, r.summary).toBe(true);
      }
      expect(t.ctx.project.maps[t.start]!.structurePlacements ?? []).toEqual([]);   // 손 찍기는 놓기 기록을 남기지 않는다 — 맵의 칸으로 읽는다
      const doors = doorHouses(t.ctx.project, t.ctx.project.maps[t.start]);
      const spire = doors.find((d) => d.front.x === 9 && d.front.y === 14), block = doors.find((d) => d.front.x === 28 && d.front.y === 14);
      expect(spire, JSON.stringify(doors)).toMatchObject({ kit: "bd-house-cathedral", label: "첨탑 성당", tier: "xlarge" });
      expect(block, JSON.stringify(doors)).toMatchObject({ kit: "bd-block-church-14x17", tier: "xlarge" });
      // 그 문 뒤 실내: 배치 없이 hints.door 로 부르면 초대형 구성(방 8개 이상)
      await t.call("todo", { op: "init", list: [{ phase: "p", items: [{ content: "성당 실내", id: "c", check: { kind: "none" } }] }] });
      const plan = JSON.parse((await t.call("make_place", { type: "interior", name: "대성당", hints: { door: [9, 14] } }))[0]!) as { ok: boolean; mapIds: string[]; summary: string; warnings: string[] };
      expect(plan.ok, plan.summary).toBe(true);
      expect(plan.warnings.join(" ")).toContain("hints.door (9,14) = «첨탑 성당» (bd-house-cathedral, xlarge)");
      const rooms = plan.mapIds.flatMap((id) => (t.ctx.project.maps[id]?.locations ?? []).filter((l) => (l.tags ?? []).includes("hand-layout-room")));
      expect(rooms.length).toBeGreaterThanOrEqual(TIER_MIN_ROOMS.xlarge!);
    }, SLOW);
  });
});

describe("aiV2PathFollowable", () => {
  isolateTimers();
  // 2026-11-12 r1w-fun 「불씨를 되찾아서」(Haiku 가 지은 게임): 눈가림 판정자는 청사진 7단계 중 2단계에서 막혔고(엔딩 없음), 자동 플레이는 «엔딩 도달» 이었다.
  //  (a) «주술사에게 숫자를 전해 듣는다» talk 단계에 code 가 있다고 주술사가 번호 자물쇠가 됐고, 번호는 그림 없는 «번호 쪽지» 에 적혔다.
  //  (b) create_quest 가 단계의 사람에게 얹은 의뢰 페이지가 단계의 연 페이지를 가렸다 — 주술사는 의뢰 대사만 되풀이했다.
  //  (c) 자동 플레이는 계획표의 좌표로 그림 없는 쪽지를 찾아가 «완료» 를 냈다.
  // 재는 법(모델 없음): /tmp 탐침 minimal.mts(이 파일과 같은 호출) · rebuild.mts(r1w-fun 의 사슬·의뢰를 다시 짓는다). 문서 openwiki/assistant-v2.md 「길을 따라갈 수 없는 경로」.

  const TELLS = "3862";
  function built(shamanLines: readonly string[] = [`조상의 숫자는 ${TELLS}다.`], chestCode: string | undefined = TELLS) {
    const project = createBlankProject();
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const place = project.maps[project.startMapId]!.name || project.startMapId;
    ctx.project.gameBlueprint = normalizeGameBlueprint({
      title: "불씨", genre: "모험", playerGoal: "불씨를 되찾자.", ending: { name: "불씨의 귀환", how: "상자를 연다.", feeling: "안도", closing: ["불이 돌아왔다."] },
      steps: [
        { id: "s1", kind: "talk", who: "촌장", place, event: "촌장", action: "촌장에게 임무를 받는다", gives: "임무", feeling: "엄숙", text: { lines: ["주술사에게 가거라."] } },
        { id: "s2", kind: "talk", who: "주술사", place, event: "주술사", action: "주술사에게 숫자를 듣는다", needs: "임무", gives: "숫자를 들었다", feeling: "신비", text: { lines: [...shamanLines], code: TELLS } },
        { id: "s3", kind: "find", place, event: "거대 두개골", action: "두개골에서 뼈 열쇠를 찾는다", needs: "숫자를 들었다", gives: "item:뼈 열쇠", feeling: "압도", text: { lines: ["눈구멍 안쪽에 뼈 열쇠가 있다."] } },
        { id: "s4", kind: "puzzle", place, event: "봉인 상자", action: "봉인 상자를 연다", needs: "item:뼈 열쇠", gives: "상자가 열렸다", feeling: "떨림", text: { lines: ["숫자 네 자리를 맞춰야 한다."], ...(chestCode ? { code: chestCode } : {}) } },
        { id: "s5", kind: "talk", who: "정령", place, event: "정령", action: "정령에게 불씨를 받는다", needs: "상자가 열렸다", gives: "ending", feeling: "안도", text: { lines: ["불씨를 가져가라."] } },
      ],
    });
    const result = buildBlueprintPath(createBuildRun(ctx));
    expect(result.ok).toBe(true);
    const map = () => ctx.project.maps[ctx.project.startMapId]!;
    const named = (name: string): GameEvent => map().events.find((ev) => ev.name === name)!;
    const steps = () => ctx.project.gameBlueprint!.steps;
    return { ctx, map, named, steps };
  }
  const json = (value: unknown): string => JSON.stringify(value);
  const texts = (ev: GameEvent): string[] => [...json(ev.pages).matchAll(/"body":"((?:[^"\\]|\\.)*)"/gu)].map((hit) => hit[1]!);
  const play = (project: Project, honest: boolean) => runAutoPlay(project, { budgetMs: 30_000, honest }).runs[0]!;
  /** 단계가 열려 있을 때(앞 단계들이 넘긴 것을 가졌고 이 단계는 아직) 그 이벤트의 어느 페이지가 도는가 — [연 페이지 자리, 도는 페이지 자리]. */
  function openPages(project: Project): [string, number, number][] {
    const switches: Record<string, boolean> = {}, inventory: Record<string, number> = {};
    const out: [string, number, number][] = [];
    for (const step of project.gameBlueprint!.steps) {
      const b = step.built!;
      const ev = project.maps[b.mapId]!.events.find((entry) => entry.id === b.eventId)!;
      const live = stepPagesOf(project, b.mapId, ev)!.liveIndex;
      const active = resolveEventPage(ev, { switches: { ...switches }, variables: {}, inventory: { ...inventory }, partyActorIds: [], gold: 0 });
      out.push([step.id, live, ev.pages!.indexOf(active!)]);
      for (const hit of json(ev.pages![live]!.commands).matchAll(/"kind":"setSwitch","switchId":"([^"]+)","value":true/gu)) switches[hit[1]!] = true;
      if (b.itemId) inventory[b.itemId] = 1;
    }
    return out;
  }
  describe("(a) 번호를 알려 주는 사람은 번호를 말한다 — 자물쇠는 여는 물건에 달린다", () => {
    it("talk 단계의 code 는 그 사람의 대사가 되고, 번호 쪽지도 사람 자물쇠도 생기지 않는다", () => {
      const { map, named } = built();
      expect(map().events.some((ev) => ev.name === "번호 쪽지")).toBe(false);
      expect(json(named("주술사").pages)).not.toContain('"inputNumber"');
      expect(texts(named("주술사")).some((line) => line.includes(TELLS))).toBe(true);
      expect(json(named("봉인 상자").pages)).toContain('"inputNumber"');
    });

    it("대사에 번호가 없으면 한 줄을 덧붙인다 — 읽은 글에 번호가 있어야 뒤의 자물쇠를 연다", () => {
      const { named } = built(["조상의 숫자를 알려 주마."]);
      expect(texts(named("주술사")).some((line) => line.includes(`「${TELLS}」`))).toBe(true);
    });

    it("자물쇠 단계가 code 를 안 줬으면 앞에서 알려 준 번호가 정답이다", () => {
      const { named } = built(undefined, undefined);
      expect(json(named("봉인 상자").pages)).toContain(`"value":${TELLS}`);
    });

    it("경로가 거쳐야 하는 그림 없는 조사 칸은 늘 빛난다 — 넘긴 뒤의 페이지는 빛나지 않는다", () => {
      const { ctx, map, named } = built();
      const skull = named("거대 두개골");
      expect(skull.pages!.map((page) => Boolean(page.glow))).toEqual([true, true, false]);
      expect(eventSight(ctx.project, map(), skull, skull.pages![1]).seen).toBe("glow");
      expect(eventSight(ctx.project, map(), skull, { ...skull.pages![1]!, glow: undefined }).seen).toBe("none");
      // 사람은 제 그림으로 보인다.
      expect(eventSight(ctx.project, map(), named("주술사"), named("주술사").pages![1]).seen).toBe("graphic");
    });

    it("물건 낱말은 이름의 마지막 어절이다", () => {
      expect(thingWord("낡은 책상")).toBe("책상");
      expect(thingWord("번호 쪽지")).toBe("쪽지");
      expect(thingWord("문")).toBeUndefined();
    });
  });
  describe("(b) 단계의 사람에게 얹은 페이지는 그 단계가 열려 있는 동안 연 페이지를 가리지 못한다", () => {
    function withQuests() {
      const made = built();
      const { ctx, map, named } = made;
      const quest = (key: string, giver: string, targets: readonly string[]) => runTool(ctx, "create_quest", { def: {
        key, title: `${giver}의 부탁`, summary: `${giver}의 부탁을 들어준다.`, order: "sequence", giver: { mapId: map().id, eventId: named(giver).id },
        steps: targets.map((target, i) => ({ kind: "talk", label: `${target}에게 전한다 ${i}`, target: { mapId: map().id, eventId: named(target).id }, lines: [`${target}: 전해 들었네.`] })),
      } }, { dryRun: false });
      const results = [quest("q_a", "촌장", ["주술사", "정령"]), quest("q_b", "주술사", ["촌장", "정령"]), quest("q_c", "정령", ["촌장", "주술사"])];
      return { ...made, results };
    }

    it("의뢰 셋을 얹어도 단계마다 열려 있을 때 도는 페이지는 연 페이지다", () => {
      const { ctx, results } = withQuests();
      expect(results.map((r) => r.ok)).toEqual([true, true, true]);
      for (const [id, live, runs] of openPages(ctx.project)) expect([id, runs]).toEqual([id, live]);
    });

    it("넘긴 뒤가 있는 단계의 의뢰 페이지는 «넘긴 뒤» 를 기다리고, 엔딩을 부르는 단계의 것은 «열리기 전» 에만 돈다 — 페이지 자리는 그대로다", () => {
      const { ctx, map, named, steps } = withQuests();
      const chief = named("촌장"), owner = stepPagesOf(ctx.project, map().id, chief)!;
      expect(owner.doneSwitchId).toBeTruthy();
      for (const page of chief.pages!.slice(owner.liveIndex + 1)) expect(page.conditions.some((c) => c.kind === "switch" && c.switchId === owner.doneSwitchId && c.value === true)).toBe(true);
      const spirit = named("정령"), last = stepPagesOf(ctx.project, map().id, spirit)!;
      expect(last.doneSwitchId).toBeUndefined();
      expect(last.notOpen).toBeTruthy();
      // 자리를 옮기지 않는다 — 모델이 pageIndex 로 부르는 다음 호출이 다른 페이지를 고치지 않게.
      expect(last.liveIndex).toBe(1);
      expect(spirit.pages!.length).toBeGreaterThan(2);
      for (const page of spirit.pages!.slice(last.liveIndex + 1)) expect(page.conditions.some((c) => json(c) === json(last.notOpen))).toBe(true);
      // 의뢰 제안 페이지는 단계의 연 페이지를 한 번 더 돌리지 않는다 — 단계가 넘기는 스위치를 켜는 페이지는 연 페이지 하나뿐이다.
      const gives = steps()[0]!.built!.switchId!;
      expect(chief.pages!.filter((page) => json(page.commands).includes(`"switchId":"${gives}","value":true`)).length).toBe(1);
      // 엔딩 명령도 연 페이지 하나에만.
      expect(spirit.pages!.filter((page) => json(page.commands).includes('"triggerEnding"')).length).toBe(1);
    });

    it("다시 맞춰도 바뀌지 않는다 · 의뢰를 얹은 뒤에도 기계·정직 플레이 모두 엔딩에 닿는다", () => {
      const { ctx } = withQuests();
      const before = json(ctx.project.maps);
      expect(settleStepPages(ctx.project)).toEqual([]);
      expect(json(ctx.project.maps)).toBe(before);
      expect(play(ctx.project, false).ok).toBe(true);
      expect(play(ctx.project, true).ok).toBe(true);
    });

    it("조수가 단계의 사람에게 덧붙인 페이지(add_event_page)도 넘긴 뒤를 기다린다", () => {
      const { ctx, map, named } = built();
      const added = runTool(ctx, "add_event_page", { mapId: map().id, eventId: named("촌장").id, page: { conditions: [], commands: [{ kind: "text", body: "날씨가 좋구나." }] } }, { dryRun: false });
      expect(added.ok).toBe(true);
      const chief = named("촌장"), owner = stepPagesOf(ctx.project, map().id, chief)!;
      expect(chief.pages!.at(-1)!.conditions).toEqual([{ kind: "switch", switchId: owner.doneSwitchId, value: true }]);
      for (const [id, live, runs] of openPages(ctx.project)) expect([id, runs]).toEqual([id, live]);
    });
  });
  describe("(c) 정직한 자동 플레이 — 보이는 것과 읽은 글만 쓴다", () => {
    it("지금 빌더가 지은 경로는 기계·정직 플레이 모두 엔딩에 닿는다", () => {
      const { ctx } = built();
      expect(play(ctx.project, false).endingReached).toBeTruthy();
      expect(play(ctx.project, true).endingReached).toBeTruthy();
    });

    it("그림 없는 조사 칸(반짝임뿐)은 기계 플레이만 찾아간다 — 정직한 플레이는 그 목표에서 멈추고 까닭을 적는다", () => {
      const { ctx } = built();
      const project = structuredClone(ctx.project);
      for (const ev of project.maps[project.startMapId]!.events) for (const page of ev.pages ?? []) delete page.glow;
      expect(play(project, false).ok).toBe(true);
      const honest = play(project, true);
      expect(honest.ok).toBe(false);
      expect(honestCauseOf(honest.failure?.detail)).toBe("unseen");
      expect(honest.failure?.detail).toContain("거대 두개골");
    });

    it("번호를 알려 준 글이 없으면 자물쇠에서 멈춘다", () => {
      const { ctx } = built();
      const project = structuredClone(ctx.project);
      const map = project.maps[project.startMapId]!;
      map.events = JSON.parse(json(map.events).replaceAll(`${TELLS}다`, "비밀이다")) as GameEvent[];
      const honest = play(project, true);
      expect(honest.ok).toBe(false);
      expect(honestCauseOf(honest.failure?.detail)).toBe("code");
    });

    it("끝맺음 관문의 «끝까지 플레이되는가» 는 정직한 플레이다 — 멈춘 까닭이 갈래가 되고 모델이 받는 글이 갈린다", () => {
      const { ctx } = built();
      expect(playProblems(ctx.project)).toEqual([]);
      const project = structuredClone(ctx.project);
      for (const ev of project.maps[project.startMapId]!.events) for (const page of ev.pages ?? []) delete page.glow;
      const problems = playProblems(project);
      expect(problems.map((f) => [f.judge, f.id, f.variant, f.severity])).toEqual([["play", "autoplay", "unseen", "block"]]);
      expect(findingEn(problems[0]!)).toContain("[play autoplay unseen]");
      expect(findingEn({ ...problems[0]!, variant: undefined })).toContain("[play autoplay]");
    });

    it("번호는 통째로 · 조각으로 · 자리별로 읽혀도 읽은 것이다", () => {
      expect(codeShown("3862", ["조상의 숫자는 3862다."])).toBe(true);
      expect(codeShown("3862", ["숫자는 3 8 6 2."])).toBe(true);
      expect(codeShown("3862", ["앞 조각 「38」", "뒤 조각 「62」"])).toBe(true);
      expect(codeShown("7294", ["7 _ 9 _", "_ 2 _ 4"])).toBe(true);
      expect(codeShown("3862", ["번호를 알아야 열 수 있다.", "1층에서 2명이 기다린다."])).toBe(false);
      expect(honestCauseOf(`${HONEST_CAUSES.unnamed}: …`)).toBe("unnamed");
      expect(honestCauseOf("걸어갈 길이 없습니다")).toBeUndefined();
    });
  });
});

// 2026-11-13 r2s-fun(증기 도시) · r2t-fun(설원) 두 판을 타이틀에서 엔딩까지 해 보고 찾은 일곱 결함의 고친 자리.
// 명세는 harness-data/assistant-capability/spec-bank/r2s-fun.json · r2t-fun.json 에 있고(명세 은행이 통째로 다시 짓는다), 여기서는 고친 규칙만 작은 값으로 본다.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).
describe("aiV2PlayFixes", () => {
  isolateTimers();
  describe("소지품에 드는 것은 단계의 종류와 화면 글이 정한다", () => {
    const at = { last: false, leaves: false } as const;
    it("사람·자물쇠의 단계는 그 글이 물건을 부를 때만 건넨다 — 진행 이름(「얼음문 열림」「촌장의 부탁」)은 소지품이 아니다", () => {
      expect(stepHandover({ kind: "puzzle", gives: "얼음문 열림" }, { id: "s5", item: "얼음문 열림", lines: ["얼음문에 네 자리 숫자를 새길 홈이 있다."], winLines: ["얼음문이 쩌억 소리를 내며 열렸다."] }, at)).toEqual({});
      expect(stepHandover({ kind: "talk", gives: "촌장의 부탁" }, { id: "s1", item: "촌장의 부탁", lines: ["긴집의 화덕이 소리도 없이 꺼졌다네.", "먼저 가서 들어보게."] }, at)).toEqual({});
      expect(stepHandover({ kind: "choice", gives: "얼음 스파이크" }, { id: "s3", item: "얼음 스파이크", lines: ["얼음 스파이크? 있지, 있고말고."] }, at)).toEqual({ item: "얼음 스파이크" });
      expect(stepHandover({ kind: "battle", gives: "되찾은 불씨" }, { id: "s6", item: "되찾은 불씨", lines: ["이 불씨는 이제 내 것이다."], winLines: ["따스하게 빛나는 불씨가 떨어졌다."] }, { ...at, leaves: true })).toEqual({ item: "되찾은 불씨" });
    });

    it("줍는 단계는 적힌 물건 그대로, 마지막 단계는 건네지 않는다", () => {
      expect(stepHandover({ kind: "find", gives: "황동 압력 밸브" }, { id: "s3", item: "황동 압력 밸브", lines: ["기름 먹인 천에 싸인 것이 반짝였다."] }, at)).toEqual({ item: "황동 압력 밸브" });
      expect(stepHandover({ kind: "talk", gives: "마을의 겨울 구원" }, { id: "s7", item: "불씨", lines: ["불씨! 정말 해냈구나!"] }, { ...at, last: true })).toEqual({});
    });

    it("뒤 자물쇠의 번호를 알려 주는 단계: 맵에 남는 것은 스위치, 쓰러져 사라지는 상대는 그 글을 실은 쪽지", () => {
      const journal = { id: "s4", item: "일지의 숫자", lines: ["낡은 일지다.", "'얼음문의 숫자는 7342.'"] };
      expect(stepHandover({ kind: "find", gives: "일지의 숫자" }, journal, { ...at, told: "7342" })).toEqual({});
      const doll = { id: "s5", lines: ["증기 인형이 일어선다."], winLines: ["가슴 속에서 구겨진 쪽지가 떨어졌다.", "'기관실 다이얼 번호: 7302.'"] };
      expect(stepHandover({ kind: "battle", gives: "기관실 암호 쪽지" }, doll, { ...at, told: "7302", leaves: true })).toEqual({ item: "기관실 암호 쪽지", note: "'기관실 다이얼 번호: 7302.'" });
      // 글이 물건을 부르지 않으면 함수의 쪽지.
      const boss = { id: "s5", lines: ["덤벼라."], winLines: ["(숨이 끊어지며) 번호는 7302다…"] };
      expect(stepHandover({ kind: "battle", gives: "기관실 개방" }, boss, { ...at, told: "7302", leaves: true })).toEqual({ item: "번호 쪽지", line: "번호를 쪽지에 적어 두었다.", note: "(숨이 끊어지며) 번호는 7302다…" });
    });

    it("종류를 적지 않은 옛 청사진은 전과 같다 — item, 없으면 gives 의 물건 낱말", () => {
      expect(stepHandover({ gives: "낡은 열쇠" }, undefined, at)).toEqual({ item: "낡은 열쇠" });
      expect(stepHandover({ gives: "비밀번호 단서" }, undefined, at)).toEqual({});
    });
  });
  describe("이긴 뒤의 글은 서술이 기본이다", () => {
    it("따옴표·낫표로 감싼 줄만 그 상대의 말(이름표), 나머지는 서술 — 작은따옴표는 인용한 글", () => {
      expect(afterWinLines(["정령이 흩어지며 불씨가 떨어졌다.", "\"이럴 수가…\"", "「다음에 보자」", "'기관실 다이얼 번호: 7302'", "(연기가 걷힌다.)", " "], "서리 정령")).toEqual([
        { kind: "text", body: "정령이 흩어지며 불씨가 떨어졌다." },
        { kind: "text", speaker: "서리 정령", body: "이럴 수가…" },
        { kind: "text", speaker: "서리 정령", body: "다음에 보자" },
        { kind: "text", body: "'기관실 다이얼 번호: 7302'" },
        { kind: "text", body: "(연기가 걷힌다.)" },
      ]);
      expect(afterWinLines(["\"졌다.\""], undefined)).toEqual([{ kind: "text", body: "\"졌다.\"" }]);
    });
  });
  describe("스팀펑크 건물 줄의 뒤로 걸어 들어가지 못한다", () => {
    it("거리·부두·공장 지대: 시작 칸에서 걸어 닿는 칸 가운데 북쪽 건물 줄의 지붕 뒤 칸이 없다", () => {
      for (const [style, width, height] of [["street", 48, 34], ["dock", 48, 34], ["industrial", 52, 40]] as const) for (const seed of [1, 2, 3]) {
        const ctx = { project: createBlankProject() as Project, currentMapId: "sp", assistantRun: true };
        expect(runTool(ctx, "create_map", { id: "sp", name: "거리", width, height, tilesetId: STEAMPUNK_CITY_ID }).ok).toBe(true);
        const built = runTool(ctx, "compose_steampunk_city_map", { mapId: "sp", style, seed });
        expect(built.ok).toBe(true);
        const map = ctx.project.maps.sp!;
        const pass = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height && isPassable(ctx.project, map, x, y);
        // 맨 아래 줄의 걷는 칸에서 번져 나간다.
        const seen = new Set<number>(), queue: number[] = [];
        for (let x = 0; x < map.width; x += 1) if (pass(x, map.height - 1)) { seen.add((map.height - 1) * map.width + x); queue.push((map.height - 1) * map.width + x); }
        while (queue.length) {
          const k = queue.pop()!, x = k % map.width, y = (k - x) / map.width;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const n = (y + dy) * map.width + x + dx; if (pass(x + dx, y + dy) && !seen.has(n)) { seen.add(n); queue.push(n); } }
        }
        expect(seen.size).toBeGreaterThan(100);
        // 북쪽 건물 줄 = 문이 맵 위쪽 1/3 안에 있는 건물. 문 위에서 이어진 막힌 칸(건물 몸)의 열마다 맨 윗줄 위가 지붕 뒤다.
        const behind: string[] = [];
        for (const door of buildingEntrances(ctx.project, map).filter((e) => e.y < map.height / 3)) {
          const body = new Set<number>([(door.y - 1) * map.width + door.x]), stack = [...body];
          while (stack.length && body.size < 600) {
            const k = stack.pop()!, x = k % map.width, y = (k - x) / map.width;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy, n = ny * map.width + nx; if (nx >= 0 && ny >= 0 && nx < map.width && ny <= door.y && !pass(nx, ny) && !body.has(n)) { body.add(n); stack.push(n); } }
          }
          const top = new Map<number, number>();
          for (const k of body) { const x = k % map.width, y = (k - x) / map.width; top.set(x, Math.min(top.get(x) ?? Infinity, y)); }
          for (const [x, y0] of top) for (let y = y0 - 1; y >= 0 && pass(x, y); y -= 1) if (seen.has(y * map.width + x)) behind.push(`${style}#${seed} ${x},${y}`);
        }
        expect(behind).toEqual([]);
      }
    }, 120_000);
  });
  describe("싸우는 단계의 상대는 모두 보스다", () => {
    it("마지막 단계가 싸움이 아니어도, 싸우는 단계가 둘이어도 — 길목이 아니라 보스로 잰다(만나는 순서로)", () => {
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      const page = (troopId: string) => ({ id: "p0", name: "p0", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "battleProcessing", troopId, canEscape: false, canLose: false }] });
      map.events = [...(map.events ?? []),
        { id: "ev_b", name: "수호자", x: 6, y: 3, trigger: { kind: "action" }, pages: [page("troop_slime")] },
        { id: "ev_a", name: "인형", x: 3, y: 3, trigger: { kind: "action" }, pages: [page("troop_slime")] },
        { id: "ev_gate", name: "문지기", x: 4, y: 5, trigger: { kind: "action" }, pages: [page("troop_slime")] }] as never;
      const place = map.name ?? map.id;
      project.gameBlueprint = { request: "게임", title: "t", genre: "g", premise: "p", playerGoal: "g", ending: { name: "끝", how: "z", feeling: "w" }, steps: [
        { id: "s1", kind: "battle", place, event: "인형", who: "인형", label: "l" },
        { id: "s2", kind: "battle", place, event: "수호자", who: "수호자", label: "l" },
        { id: "s3", kind: "talk", place, event: "촌장", who: "촌장", label: "l" }] } as never;
      const bosses = pathBattles(project).filter((b) => b.role === "boss").sort((a, b) => (a.step ?? 0) - (b.step ?? 0));
      expect(bosses.map((b) => [b.eventId, b.step])).toEqual([["ev_a", 0], ["ev_b", 1]]);
      expect(pathBattles(project).find((b) => b.eventId === "ev_gate")!.role).toBe("gate");
      expect(BOSS_BAND).toEqual({ minWin: 0.95, turns: 12, targetTurns: [6, 10], midPotions: [1, 3], finalPotions: [2, 4], attackOnlyMaxWin: 0.1, attackOnlyMaxLeft: 0.5, midAttackOnlyMinWin: 0.5, potionAt: 0.45 });
    });
  });
  // 2026-11-13 감독 교정: 보스 셋을 15턴·약 4~5개의 싸움으로 만들고(HP 649 → 952) 시작 약을 두 배로 준 것은 위협이 아니라 부풀리기였다.
  describe("보스 밴드는 HP 와 시작 회복약을 늘리지 않는다", () => {
    it("한 대만 올리고, 약이 모자라 밴드에 못 들면 그렇게 적는다 — 다시 돌려도 그대로", () => {
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      const boss = fitTroopCopy(project, "troop_slime", "boss")!;
      const hpOf = (troopId: string) => project.database.troops.find((t) => t.id === troopId)!.enemyIds.reduce((sum, id) => sum + project.database.enemies.find((e) => e.id === id)!.stats.maxHp, 0);
      const hpBefore = hpOf(boss);
      map.events = [...(map.events ?? []),
        { id: "ev_a", name: "인형", x: 3, y: 3, trigger: { kind: "action" }, pages: [{ id: "p0", name: "p0", conditions: [], trigger: { kind: "action" }, commands: [{ kind: "battleProcessing", troopId: boss, canEscape: false, canLose: false }] }] }] as never;
      const place = map.name ?? map.id;
      project.gameBlueprint = { request: "게임", title: "t", genre: "g", premise: "p", playerGoal: "g", ending: { name: "끝", how: "z", feeling: "w" }, steps: [
        { id: "s1", kind: "battle", place, event: "인형", who: "인형", label: "l" },
        { id: "s2", kind: "talk", place, event: "촌장", who: "촌장", label: "l" }] } as never;
      const notes = fitPathBattlesIn(project);
      const fitted = pathBattles(project).find((b) => b.role === "boss")!.troopId;
      // 싸우는 단계 하나(마지막 단계는 대화) — 길 위 전투 하나 몫의 약 하나만 들고 시작한다. 보스를 밴드에 넣으려고 더 주지 않는다.
      expect(Object.values(project.session.inventory ?? {}).reduce((sum, n) => sum + n, 0)).toBe(1);
      expect(hpOf(fitted)).toBeLessThanOrEqual(hpBefore);
      const line = notes.find((note) => note.startsWith("보스 밴드"))!;
      expect(line).toContain("보스 밴드 밖");
      expect(line).toMatch(/약 [0-9.]+개 < 2개/u);
      expect(fitPathBattlesIn(project).filter((note) => note.includes("(보스)"))).toEqual([]);
      expect(hpOf(fitted)).toBeLessThanOrEqual(hpBefore);
    }, 180_000);

    it("모의전은 깎인 HP 로 시작할 수 있다 — 쉬지 않고 온 판을 재 볼 때 쓴다(보스 밴드는 쉬고 온 풀 HP 로 잰다 — aiV2PlayFixes2)", () => {
      const project = createBlankProject() as Project;
      const ids = project.system.startActorIds!;
      const full = simulateBattle({ project, troopId: "troop_slime", heroLevel: 1, partyActorIds: ids, n: 8, seed: 11 });
      const worn = simulateBattle({ project, troopId: "troop_slime", heroLevel: 1, partyActorIds: ids, n: 8, seed: 11, startHpRatio: 0.5 });
      expect(worn.avgHpRemaining).toBeLessThan(full.avgHpRemaining - 100);
    });
  });
});

// 확인 빌드 r6(실모델 두 편 — 포구 마을 «갈매나루» · 역 앞 상점가)과 그 브라우저 플레이에서 나온 조수 결함 — 조수가 다음 게임을 지을 때 다시 만들지 않게.
// 증거: ~/z-project/assistant-fable-runs/r6/DEFECTS.md(#6 · #7 · #8 · #11 · #14, 플레이 P2 · P4 · P5 · P6). 앞 판의 결함은 test/aiV2PlayFixes3R5.test.ts.
// 방향(오너 2026-11-16): 벽을 기본값으로 — 모델이 고른 것이 실제로 있으면 쓰고, 없으면 가장 가까운 것으로 넣고 알리고, 거절은 게임이 깨질 때만.
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 가 돌린다). 같은 값은 모델 없는 탐침으로 미리 보았다.
describe("aiV2PlayFixes4", () => {
  isolateTimers();
  type Obj = Record<string, unknown>;
  const HARBOUR = "포구 마을 «갈매나루»에서 시작하는 짧은 JRPG 를 만들어 줘. 대성당 지하에서 옛 지하 묘지로 내려가는데, 내려가는 길목을 해골 병사가 막고 서 있어서 싸워 이겨야 지나갈 수 있어. 묘지 맨 안쪽에서 마지막 보스와 싸우면 끝나.";
  const STREET = "현대 일본의 작은 역 앞 상점가에서 벌어지는 짧은 이야기 게임을 만들어 줘. 전학 온 주인공이 잃어버린 고양이를 찾아 거리 사람들에게 물어보다가 라멘집에서 고양이를 찾으면 끝나. 전투는 없어도 돼.";
  const page = (conditions: unknown[], commands: unknown[], more: Obj = {}) =>
    ({ id: "p", name: "p", conditions, trigger: { kind: "action" }, priority: "same", graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 }, commands, ...more });
  const event = (id: string, name: string, x: number, y: number, pages: unknown[]) => ({ id, name, x, y, trigger: { kind: "action" }, commands: [], pages }) as unknown as GameEvent;
  const fightPage = (sw: string, troopId: string) => page([], [{ kind: "text", body: "덤벼라" }, { kind: "battleProcessing", troopSource: "fixed", troopId, canEscape: false, canLose: false, branchOnResult: true, victoryBranch: [{ kind: "setSwitch", switchId: sw, value: true }], defeatBranch: [], escapeBranch: [] }]);
  const gonePage = (sw: string) => ({ ...page([{ kind: "switch", switchId: sw, value: true }], [], { priority: "below", graphic: { transparent: true } }), id: "gone" });
  // #14: 「마지막 보스와 싸우면 끝나」 의 «마지막 보스» 를 사람 이름으로 읽어, 보스가 서고 엔딩이 돼도 「마지막 보스 두기」 가 끝까지 ✗ 였다.
  describe("요청 뼈대의 보스 — 확인 빌드 r6", () => {
    it("역할만 말한 보스는 이름을 찾지 않는 보스 전투 하나다", () => {
      const els = requestSkeleton(HARBOUR).filter((e) => e.check?.kind === "battle" || e.check?.kind === "person");
      expect(els.map((e) => e.check)).toEqual([{ kind: "battle", boss: true, fresh: true }]);
    });
    it("«전투는 없어도 돼» 는 전투를 청한 것이 아니다", () => {
      expect(requestSkeleton(STREET).filter((e) => e.check?.kind === "battle")).toEqual([]);
    });
  });
  // #11: 「심부름: 목표 구조가 프리셋과 다릅니다 (talk).」 만 돌아와 같은 꼴로 여섯 번 거절됐다.
  describe("create_quest 거절 글 — 확인 빌드 r6", () => {
    const project = createBlankProject() as Project;
    const mapId = project.startMapId;
    project.maps[mapId]!.events = [event("ev_giver", "해순", 3, 3, [page([], [{ kind: "text", body: "…" }])]), event("ev_other", "신부", 6, 3, [page([], [{ kind: "text", body: "…" }])])];
    const base = { key: "q_a", title: "소식 전하기", summary: "소식을 전한다", order: "sequence", giver: { mapId, eventId: "ev_giver" } };
    const talk = (label: string, eventId: string) => ({ kind: "talk", label, target: { mapId, eventId }, lines: ["…"] });
    const two = [talk("신부에게", "ev_other"), talk("다시 신부에게", "ev_other")];

    it("프리셋과 단계 수가 다르면 둘을 나란히 적고 고치는 호출을 적는다", () => {
      const issue = questPresetIssue(project, { ...base, presetId: "errand", steps: two } as never)!;
      expect(issue).toContain("is 1 step(s) (talk) but steps is 2 step(s) (talk → talk)");
      expect(issue).toContain('presetId:"custom" with blueprint:["talk","talk"]');
      expect(questPresetIssue(project, { ...base, presetId: "errand", steps: two.slice(0, 1) } as never)).toBeNull();
    });
    it("직접 조합에 blueprint 가 빠졌으면 그 값을 적어 준다", () => {
      expect(questPresetIssue(project, { ...base, presetId: "custom", steps: two } as never)).toContain('needs def.blueprint — list the kinds of steps in order: blueprint:["talk","talk"]');
    });
    it("의뢰인에게 돌아가는 단계는 어느 단계인지와 까닭을 적는다", () => {
      expect(() => validateQuestReferences(project, { ...base, steps: [two[0], talk("해순에게 돌아가기", "ev_giver")] } as never))
        .toThrow(/steps\[1\] \(talk «해순에게 돌아가기»\) targets the giver's own event \(ev_giver\) — reporting back to the giver is added by itself/u);
    });
  });
  // #8: «짧은 이야기 게임, 전투는 없어도 돼» 에 출하 관문이 맵 6장 · 퀘스트 3개를 요구했다.
  describe("관문의 크기 — 청사진에 모델이 적은 값을 읽고, 모자라면 알린다(확인 빌드 r6)", () => {
    const steps = [["s1", "역 앞 상점가", "전단지 아주머니"], ["s2", "역 앞 상점가", "편의점 점원"], ["s3", "역 앞 상점가", "서점 주인"], ["s4", "라멘집", "라멘집 주인"]]
      .map(([id, place, who]) => ({ id, kind: "talk", who, place, event: who, action: "묻는다", gives: `${id} 단서`, feeling: "궁금" }));
    const withBlueprint = (more: Obj): Project => {
      const project = createBlankProject() as Project;
      project.gameBlueprint = normalizeGameBlueprint({ title: "미케", genre: "이야기", playerGoal: "고양이를 찾자", request: STREET, steps, ending: { name: "집으로", how: "찾았다", feeling: "안도" }, ...more });
      return project;
    };

    it("scale:small 청사진은 제 장소 수 · 제 단계 수를 센다", () => {
      const small = withBlueprint({ scale: "small", battles: false });
      expect(small.gameBlueprint?.scale).toBe("small");
      expect(small.gameBlueprint?.battles).toBe(false);
      expect(smallGame(small)).toBe(true);
      expect(mapsNeed(small, 6)).toBe(2);
      expect(depthNeed(small, 5)).toBe(3);
      const full = withBlueprint({});
      expect(mapsNeed(full, 6)).toBe(6);
      expect(depthNeed(full, 5)).toBe(5);
    });
    it("맵 · 퀘스트 · 진행 깊이의 모자람은 출하 차단이 아니라 알림이다", () => {
      const full = withBlueprint({});
      expect(shipBlockers(full, STREET).some((b) => /-min$/u.test(b.id))).toBe(false);
      expect(sizeNotices(full, STREET).map((b) => b.id)).toEqual(["maps-min", "quests-min", "act-depth-min"]);
      // 작은 게임에는 곁 퀘스트를 알리지도 않는다.
      expect(sizeNotices(withBlueprint({ scale: "small" }), STREET).map((b) => [b.id, b.evidence])).toEqual([["maps-min", "counted=0 need=2 uncounted=1"], ["act-depth-min", "small depth=0 need=3"]]);
      // 게임을 만드는 요청이 아니면 알릴 것도 없다.
      expect(sizeNotices(createBlankProject() as Project, "촌장을 광장으로 옮겨 줘")).toEqual([]);
    });
    it("알림은 실행 하나에 한 번, 영어로, 거절이 아니라고 적어 준다", () => {
      const full = withBlueprint({});
      const store = {};
      const first = sizeNoticeOnce(store, full, STREET);
      expect(first).toContain("[Size notice — not a requirement, nothing is blocked.");
      expect(first).toContain("[ship maps-min]");
      expect(sizeNoticeOnce(store, full, STREET)).toBe("");
      expect(sizeNoticeOnce({}, createBlankProject() as Project, "촌장을 광장으로 옮겨 줘")).toBe("");
    });
  });
  // #6 · 플레이 a3 · a5: «길목을 막고 선 해골 병사» 가 폭 8칸 홀에 서서 옆으로 지나 보스에게 갔다.
  describe("길을 막는 적의 자리 — 확인 빌드 r6", () => {
    const cave = (): { project: Project; map: GameMap } => {
      const ctx: ToolContext = { project: createEmptyToolProject("굴") };
      const blank = createBlankProject() as Project;
      ctx.project.database = blank.database;
      ctx.project.system = { ...ctx.project.system, startActorIds: blank.system.startActorIds };
      expect(runTool(ctx, "author_dungeon", { type: "cave", size: "small", name: "굴", seed: 2 }, { dryRun: false }).ok).toBe(true);
      const map = Object.values(ctx.project.maps)[0]!;
      // 레버 관문은 걷고, 안쪽 방에 다음 맵으로 가는 계단(갈 곳)을 둔다.
      map.events = [...map.events.filter((e) => !/_lever/u.test(e.id)), event("ev_far_stairs", "내려가는 계단", 24, 9, [page([], [{ kind: "transfer", mapId: map.id, x: 14, y: 28 }])])];
      return { project: ctx.project, map };
    };
    const stairsReached = (project: Project, map: GameMap, extra: readonly { x: number; y: number }[] = []): boolean => {
      const blocked = blockersOf(map);
      for (const c of extra) blocked.add(c.y * map.width + c.x);
      return bodyReached(map, reachFrom(project, map, anchorsOf(project, map), blocked), map.events.find((e) => e.id === "ev_far_stairs")!);
    };

    it("가장 가까운, 막으면 갈 곳이 끊기는 3칸 이하의 길목을 찾는다 — 트인 곳에는 없다", () => {
      const { project, map } = cave();
      for (const from of [{ x: 20, y: 20 }, { x: 12, y: 30 }]) {
        const spot = findBarSpot(project, map, from)!;
        expect(spot, JSON.stringify(from)).toBeDefined();
        expect(spot.guards).toBe(true);
        expect(spot.cells.length).toBeLessThanOrEqual(3);
        expect(spot.footprint.width * spot.footprint.height).toBe(spot.cells.length);
        expect(stairsReached(project, map, spot.cells), JSON.stringify(from)).toBe(false);
      }
      expect(stairsReached(project, map)).toBe(true);
      const open = createBlankProject() as Project;
      expect(findBarSpot(open, open.maps[open.startMapId]!, { x: 8, y: 8 })).toBeUndefined();
    }, 60_000);

    it("boss.blocks 를 주면 그 길목으로 옮겨 세우고 몸으로 폭을 덮는다 — 거절하지 않고 어디에 세웠는지 알린다", () => {
      const { project, map } = cave();
      const run = createBuildRun({ project, currentMapId: map.id, assistantRun: true } as never);
      const res = buildBossEncounter(run, { mapId: map.id, boss: { name: "문지기 해골", at: { x: 20, y: 20 }, enemy: "해골", blocks: true }, lines: ["멈춰라."] } as never);
      expect(res.ok).toBe(true);
      expect(res.summary).toContain("It bars the way at (19,17) — moved from (20,20)");
      const now = run.ctx.project.maps[map.id]!;
      const foe = now.events.find((e) => e.name === "문지기 해골")!;
      expect([foe.x, foe.y]).toEqual([19, 17]);
      expect((foe.pages![0] as unknown as { footprint?: unknown }).footprint).toEqual({ width: 2, height: 1 });
      // 이긴 뒤에는 비켜선다 — 걸어 닿는 칸을 셀 때 그 너머는 «못 가는 곳» 이 아니라 이긴 뒤에 가는 곳이다.
      expect(eventBlocks(foe)).toBe(false);
      expect(stairsReached(run.ctx.project, now)).toBe(true);
      expect(stairsReached(run.ctx.project, now, [{ x: 19, y: 17 }, { x: 20, y: 17 }])).toBe(false);
    }, 60_000);

    it("blocks 를 주지 않은 적이 길목 곁에 비켜 서 있으면 옮기지 않고 그것만 알린다", () => {
      const { project, map } = cave();
      const run = createBuildRun({ project, currentMapId: map.id, assistantRun: true } as never);
      const res = buildBossEncounter(run, { mapId: map.id, boss: { name: "문지기 해골", at: { x: 20, y: 20 }, enemy: "해골" }, lines: ["멈춰라."] } as never);
      expect(res.summary).toContain("It does not bar the way (the player can walk around it); boss.blocks:true stands it on the passage at (19,17).");
      const foe = run.ctx.project.maps[map.id]!.events.find((e) => e.name === "문지기 해골")!;
      expect([foe.x, foe.y]).toEqual([20, 20]);
    }, 60_000);

    it("앞 단계의 사람이 막아 선 적 너머에 있으면 싸움을 앞 단계 뒤로 잠그지 않는다 — 서로 기다리지 않게", () => {
      const chained = (priestAt: { x: number; y: number }): { notes: string[]; conds: string[] } => {
        const { project, map } = cave();
        map.events = [...map.events, event("ev_priest", "신부", priestAt.x, priestAt.y, [page([], [{ kind: "text", body: "열쇠를 받게." }])])];
        const run = createBuildRun({ project, currentMapId: map.id, assistantRun: true } as never);
        expect(buildBossEncounter(run, { mapId: map.id, boss: { name: "문지기 해골", at: { x: 20, y: 20 }, enemy: "해골", blocks: true }, lines: ["멈춰라."] } as never).ok).toBe(true);
        const now = run.ctx.project;
        const st = (id: string, kind: string, who: string) => ({ id, kind, who, place: "굴", event: who, action: kind === "battle" ? "싸운다" : "듣는다", gives: `${id} 끝`, feeling: "긴장" });
        now.gameBlueprint = normalizeGameBlueprint({ title: "굴", genre: "JRPG", playerGoal: "지나가자", request: "x", steps: [st("s1", "talk", "신부"), st("s2", "battle", "문지기 해골")], ending: { name: "끝", how: "이긴다", feeling: "안도" } });
        const notes = chainFightStepsIn(now);
        const foe = now.maps[map.id]!.events.find((e) => e.name === "문지기 해골")!;
        return { notes, conds: foe.pages!.map((p) => ((p.conditions ?? []) as unknown as { switchId?: string }[]).map((c) => c.switchId).join("&") || "-") };
      };
      // 신부가 병사 너머(안쪽 방)에 있다 — 잠그면 영영 못 싸운다.
      const beyond = chained({ x: 24, y: 10 });
      expect(beyond.notes.join(" ")).toContain("Not chained: fight step s2 «문지기 해골» stands between the way in and s1 «신부»");
      expect(beyond.conds[0]).toBe("-");
      expect(beyond.conds).toHaveLength(2);
      // 신부가 병사 앞(들어오는 쪽)에 있으면 잠근다.
      const before = chained({ x: 22, y: 21 });
      expect(before.notes.join(" ")).toContain("Chained fight step s2 «문지기 해골»: it fights only after s1 «신부»");
      expect(before.conds.slice(0, 2)).toEqual(["-", "sw_bp_s1_done"]);
    }, 60_000);

    // P6: 병사가 필드에서는 붉은 머리 기사, 전투에서는 유령이었다.
    it("맵에 선 모습은 싸울 때의 그 모습이고, 글이 짚은 그림이 옛 묶음에만 있어도 그 그림으로 선다", () => {
      const { project, map } = cave();
      const run = createBuildRun({ project, currentMapId: map.id, assistantRun: true } as never);
      const res = buildBossEncounter(run, { mapId: map.id, boss: { name: "문지기 해골", at: { x: 20, y: 20 }, enemy: "해골" }, lines: ["멈춰라."] } as never);
      const foe = run.ctx.project.maps[map.id]!.events.find((e) => e.name === "문지기 해골")!;
      const troopId = /"troopId":"([^"]+)"/u.exec(JSON.stringify(foe.pages))![1]!;
      const troop = run.ctx.project.database.troops.find((t) => t.id === troopId)!;
      const lead = run.ctx.project.database.enemies.find((e) => e.id === (troop.members?.[0]?.enemyId ?? troop.enemyIds?.[0]))! as unknown as { monsterResourceId?: string };
      expect((foe.pages![0]!.graphic as unknown as { sprite: { id: string } }).sprite.id).toBe(lead.monsterResourceId);
      expect(JSON.stringify(foe.pages)).not.toContain("changeFace");
      // 새 프로젝트는 옛 묶음 그림을 싣지 않는다(2026-11-24 qa1124) — 해골 보스도 현행 그림으로 선다.
      expect(isCurrentMonsterArt(lead.monsterResourceId)).toBe(true);
      expect(res.missingArt.join("\n")).not.toContain("want=person");
      // 해골 그림은 현행 세트에 없다 — 대역(창백한 유령)으로 서고, 없는 그림은 그릴 목록에 «바란 그림 skeleton-bone» 으로 남는다(#4984: 바란 그림은 원래 그림).
      const bossGaps = res.missingArt.map((line) => parseArtGap(line)).filter((gap) => gap?.want === "boss");
      expect(bossGaps.map((gap) => [gap?.wanted, gap?.where, gap?.standIn])).toEqual([["skeleton-bone", "문지기 해골", "창백한 유령"]]);
    }, 60_000);
  });
  // 플레이 P2 · P4: 싸움 단계 둘 때문에 경로 호출이 통째로 거절돼 사슬이 대화 단계 셋에서 끊겼다 — 신부도 병사도 건너뛰고 보스만 이기면 엔딩.
  describe("싸우는 단계를 이야기 사슬에 잇는다 — 확인 빌드 r6", () => {
    const build = (): { project: Project; map: GameMap } => {
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      map.name = "묘지";
      const troopId = project.database.troops[0]!.id;
      map.events = [event("ev_priest", "신부", 2, 4, [page([], [{ kind: "text", body: "열쇠를 받게." }])]), event("ev_guard", "해골 병사", 6, 4, [fightPage("sw_guard", troopId), gonePage("sw_guard")]), event("ev_lord", "종지기", 10, 4, [fightPage("sw_lord", troopId), gonePage("sw_lord")])];
      (project as unknown as { switches: Obj[] }).switches = [...((project.switches ?? []) as unknown as Obj[]), { id: "sw_guard", name: "병사 격파" }, { id: "sw_lord", name: "종지기 격파" }];
      (project as unknown as { endings: Obj[] }).endings = [{ id: "ending_dawn", name: "새벽", conditions: [], epilogue: [{ kind: "say", text: "끝." }], presentation: {} }];
      const st = (id: string, kind: string, who: string) => ({ id, kind, who, place: "묘지", event: who, action: kind === "battle" ? "싸운다" : "듣는다", gives: `${id} 끝`, feeling: "긴장" });
      project.gameBlueprint = normalizeGameBlueprint({ title: "종", genre: "JRPG", playerGoal: "종지기를 쓰러뜨리자", request: "x", steps: [st("s1", "talk", "신부"), st("s2", "battle", "해골 병사"), st("s3", "battle", "종지기")], ending: { name: "새벽", how: "이긴다", feeling: "안도" } });
      return { project, map };
    };
    const conds = (ev: GameEvent): string[] => ev.pages!.map((p) => ((p.conditions ?? []) as unknown as { switchId?: string }[]).map((c) => c.switchId).join("&") || "-");
    const byName = (map: GameMap, name: string) => map.events.find((e) => e.name === name)!;

    it("이기면 비켜서는 적은 걸어 닿는 칸을 셀 때 막지 않는다 — 이긴 뒤 페이지가 없으면 막는다", () => {
      const { map } = build();
      expect(eventBlocks(byName(map, "신부"))).toBe(true);
      expect(eventBlocks(byName(map, "해골 병사"))).toBe(false);
      expect(eventBlocks({ ...byName(map, "해골 병사"), pages: [byName(map, "해골 병사").pages![0]!] } as GameEvent)).toBe(true);
    });

    it("싸움은 앞 단계 뒤에만 열리고, 마지막 싸움을 이기면 엔딩을 부른다", () => {
      const { project, map } = build();
      expect(walkBlueprint(project).blockers.map((b) => b.id)).toEqual(["blueprint-no-ending"]);
      const notes = [...chainFightStepsIn(project), ...endAfterFinalFightIn(project)];
      expect(notes).toHaveLength(3);
      expect(notes[0]).toContain("Chained fight step s2 «해골 병사»: it fights only after s1 «신부»");
      expect(notes[2]).toBe("Winning the last fight s3 «종지기» now calls the ending «새벽»");
      // 신부의 말이 「마침」 스위치를 켜고, 병사는 그 뒤에만 싸운다. 그 전에는 «아직» 페이지가 선다(몸은 그대로 길을 막는다).
      expect(JSON.stringify(byName(map, "신부").pages)).toContain('"switchId":"sw_bp_s1_done"');
      expect(conds(byName(map, "해골 병사"))).toEqual(["-", "sw_bp_s1_done", "sw_guard"]);
      expect(byName(map, "해골 병사").pages![0]!.name).toBe("아직");
      // 보스는 병사를 이긴 뒤에만 싸우고, 이기면 그 승리 갈래에서 엔딩을 부른다.
      expect(conds(byName(map, "종지기"))).toEqual(["-", "sw_guard", "sw_lord"]);
      const win = ((byName(map, "종지기").pages![1]!.commands as unknown as Obj[]).find((c) => c.kind === "battleProcessing")!.victoryBranch as Obj[]).map((c) => c.kind);
      expect(win).toEqual(["setSwitch", "triggerEnding"]);
      expect(walkBlueprint(project).blockers).toEqual([]);
      // 되풀이 안전.
      expect([...chainFightStepsIn(project), ...endAfterFinalFightIn(project)]).toEqual([]);
    });
  });
  // 플레이 P5: 모델이 HP 700 으로 올리고 모의전한 보스 기록은 쓰이지 않고, 싸움은 길 사본(HP 406)으로 했다.
  describe("모델이 손본 적이 실제 싸움에 쓰인다 — 확인 빌드 r6", () => {
    const build = (): Project => {
      const project = createBlankProject() as Project;
      const e0 = project.database.enemies[0]!, t0 = project.database.troops[0]!;
      project.database.enemies.push({ ...structuredClone(e0), id: "enemy_x_boss", name: "종지기" }, { ...structuredClone(e0), id: "enemy_path_x_boss_x_boss", name: "종지기", stats: { ...e0.stats, maxHp: 406 } } as never);
      project.database.troops.push({ ...structuredClone(t0), id: "troop_x_boss", name: "종지기", enemyIds: ["enemy_x_boss"], members: [{ enemyId: "enemy_x_boss", x: 0, y: 0 }] } as never,
        { ...structuredClone(t0), id: "troop_path_x_boss", name: "종지기", enemyIds: ["enemy_path_x_boss_x_boss"], members: [{ enemyId: "enemy_path_x_boss_x_boss", x: 0, y: 0 }] } as never);
      project.maps[project.startMapId]!.events = [event("ev_boss", "종지기", 5, 5, [page([], [{ kind: "battleProcessing", troopSource: "fixed", troopId: "troop_path_x_boss", canEscape: false }])])];
      return project;
    };

    it("원본을 모의전하면 맵이 싸우는 사본을 알려 준다", () => {
      const project = build();
      expect(settleFoughtCopy(project, "simulate_battle", { troopId: "troop_x_boss" })?.note).toContain("Map events fight troop_path_x_boss, the copy fitted to the starting party (enemy enemy_path_x_boss_x_boss, HP 406), not troop_x_boss.");
      expect(settleFoughtCopy(project, "simulate_battle", { troopId: "troop_path_x_boss" })).toBeUndefined();
    });
    it("원본을 고치면 사본을 걷고 싸움이 고친 원본으로 돌아간다 — 사본을 고친 호출 · 상관없는 적은 그대로", () => {
      const project = build();
      for (const params of [{ enemy: { id: "enemy_x_boss", stats: { maxHp: 700 } } }, { id: "enemy_x_boss", maxHp: 700 }]) {
        const settled = settleFoughtCopy(project, "upsert_enemy", params)!;
        expect(settled.note).toContain("troop_path_x_boss was the fitted copy the map fought; it is dropped and the fight uses troop_x_boss again");
        expect(JSON.stringify(settled.project.maps)).toContain('"troopId":"troop_x_boss"');
        expect(settled.project.database.troops.some((t) => t.id === "troop_path_x_boss")).toBe(false);
        expect(settled.project.database.enemies.some((e) => e.id.startsWith("enemy_path_"))).toBe(false);
      }
      expect(settleFoughtCopy(project, "upsert_enemy", { enemy: { id: "enemy_path_x_boss_x_boss" } })).toBeUndefined();
      expect(settleFoughtCopy(project, "upsert_enemy", { enemy: { id: project.database.enemies[0]!.id } })).toBeUndefined();
    });
    it("길 맞춤 사본에는 보스 위협 하한을 걸지 않는다 — 사본의 기술만 고쳤는데 HP 가 오르지 않는다", () => {
      const project = build();
      const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
      const res = runTool(ctx, "upsert_enemy", { role: "boss", enemy: { id: "enemy_path_x_boss_x_boss", skillIds: ["skill_attack"] } }, { dryRun: false });
      expect(res.ok).toBe(true);
      expect(res.summary).not.toContain("보스 위협 하한");
      expect(ctx.project.database.enemies.find((e) => e.id === "enemy_path_x_boss_x_boss")!.stats.maxHp).toBe(406);
    });
  });
  // #7: 순경이 «여학생 · 양갈래», 젊은 어부가 «젊은 여성», 중년 여인 상인이 남자 «여관 주인» 으로 섰다.
  describe("사람 그림이 역할을 따른다 — 확인 빌드 r6", () => {
    const pick = (tileset: string | undefined, role: string, looks: string) => {
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      if (tileset) (map as unknown as { tilesetId: string }).tilesetId = tileset;
      const g = pickPersonGraphic(project, map, role, looks, true)!;
      return { label: g.label, family: charsetFamilyOf(project, g.textureKey), wanted: g.wanted };
    };

    it("현대 거리의 순경은 현대 칩의 남자로 서고, 못 쓰는 경찰관 칩의 이름을 «없는 그림» 으로 남긴다", () => {
      const cop = pick("jp_city_modern", "순경", "경찰관 제복");
      expect(cop.family).toBe("modern");
      expect(cop.label).not.toContain("여학생");
      expect(cop.label).toContain("남");
      expect(cop.wanted).toBe("경찰관 · 남색 제복");
      expect(pick("jp_city_modern", "학생", "학생 소년")).toEqual({ label: "남학생 · 남색 블레이저", family: "modern", wanted: undefined });
    });
    it("글이 이름으로 부른 칩이 다른 화풍에 있으면 그 칩이 선다 — 계열은 기본값이지 벽이 아니다", () => {
      expect(pick(undefined, "어부", "젊은 어부")).toEqual({ label: "어부 · 파란 줄무늬", family: "refmap-doll", wanted: undefined });
      // 이름으로 부르지 않은 다른 화풍 칩으로는 바꾸지 않는다 — 한 게임 한 화풍은 구성기가 스스로 고를 때의 기본값이다(명세 은행 2026-11-16).
      // 이 맵 계열의 여자 칩이 서고, 바란 칩(«마을 여인 · 흰 보닛»)은 없는 그림 줄로 남는다.
      const monger = pick(undefined, "어물전 주인", "중년 여인 상인");
      expect(monger.family).toBe("rtp-people");
      expect(monger.label).toContain("여성");
      expect(monger.wanted).toBe("마을 여인 · 흰 보닛");
      expect(pick(undefined, "농부", "farmer").family).toBe("rtp-people");
      // 제 화풍에 그 역할의 칩이 있으면 그대로다.
      expect(pick(undefined, "신부", "신부 사제")).toEqual({ label: "승려", family: "rtp-people", wanted: undefined });
    });
  });
  // r7a N2: 강지기(s2)가 번호를 알려 주며 건 «수녀에게 축복을 받자 (석문 숫자: 3817)» 를 번호 숨기기가 자물쇠 단계(s5)의 줄로 바꿔 수녀 단계를 건너뛰었다.
  describe("번호를 뺀 목표 줄은 그 줄이 가리키는 단계를 말한다 — 확인 빌드 r7a", () => {
    it("대상 이벤트의 단계 · 없으면 줄을 건 이벤트의 다음 단계 — 자물쇠 단계의 줄이 아니다", () => {
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      map.name = "포구";
      const chip = (message: string, target?: string) => ({ kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface: "objectiveChip", message, durationMs: 0, ...(target ? { targetMapId: map.id, targetEventId: target } : {}) } });
      map.events = [
        event("ev_keeper", "강지기", 2, 2, [page([], [{ kind: "text", speaker: "강지기", body: "사리 물때, 3817." }, chip("수녀에게 축복을 받자 (석문 숫자: 3817)", "ev_nun")])]),
        event("ev_nun", "마르타 수녀", 4, 2, [page([], [{ kind: "text", body: "축복을." }, chip("석문에 3817 을 넣자")])]),
        event("ev_door", "봉인된 석문", 8, 2, [page([], [{ kind: "inputNumber", variableId: "var_door", digits: 4 }, { kind: "fork", condition: { kind: "variable", variableId: "var_door", op: "==", value: 3817 }, then: [{ kind: "text", body: "열렸다." }] }])]),
      ];
      const st = (id: string, kind: string, who: string | undefined, ev: string, more: Obj = {}) => ({ id, kind, ...(who ? { who } : {}), place: "포구", event: who ?? "봉인된 석문", action: "a", gives: `${id} 끝`, feeling: "f", built: { mapId: map.id, eventId: ev }, ...more });
      project.gameBlueprint = normalizeGameBlueprint({ title: "종", genre: "JRPG", playerGoal: "x", request: "x", steps: [st("s1", "talk", "강지기", "ev_keeper"), st("s2", "talk", "마르타 수녀", "ev_nun"), st("s3", "puzzle", undefined, "ev_door", { text: { code: "3817" } })], ending: { name: "끝", how: "연다", feeling: "f" } });
      const fixed = hideLockCodes(project);
      const said = (id: string) => /"message":"([^"]+)"/u.exec(JSON.stringify(fixed.project.maps[map.id]!.events.find((e) => e.id === id)!.pages))![1];
      expect(said("ev_keeper")).toBe("마르타 수녀에게 말을 걸자");
      expect(said("ev_nun")).toBe("봉인된 석문의 번호를 맞히자");
      expect(fixed.notes.join(" ")).toContain("«마르타 수녀에게 말을 걸자» · «봉인된 석문의 번호를 맞히자»");
      expect(JSON.stringify(fixed.project.maps)).toContain("사리 물때, 3817.");
      expect(hideLockCodes(fixed.project).notes).toEqual([]);
    });
  });
  // r7a N3: 길 전투는 쉬고 온 파티로 맞췄는데, 플레이어는 병사를 이긴 뒤 HP 302/514 로 곧장 보스에게 가서 졌다(쉼터 결정은 같은 맵에 있었다).
  describe("보스는 쉬고 온 파티와 싸운다 — 확인 빌드 r7a", () => {
    const build = (crystal: boolean): Project => {
      const project = createBlankProject() as Project;
      const troopId = project.database.troops[0]!.id;
      const fight = { kind: "fork", condition: { kind: "switch", switchId: "sw_x", value: true }, then: [{ kind: "battleProcessing", troopSource: "fixed", troopId, canEscape: false, canLose: false, branchOnResult: true, victoryBranch: [], defeatBranch: [], escapeBranch: [] }] };
      project.maps[project.startMapId]!.events = [event("ev_lord_boss", "종지기", 10, 4, [page([], [{ kind: "text", body: "덤벼라" }, fight])]),
        ...(crystal ? [event("ev_crystal", "쉼터 결정", 3, 3, [page([], [{ kind: "recoverAll" }])])] : [])];
      return project;
    };
    const kinds = (project: Project) => (project.maps[project.startMapId]!.events.find((e) => e.id === "ev_lord_boss")!.pages![0]!.commands as unknown as Obj[]).map((c) => c.kind);

    it("같은 맵에 쉼터가 있으면 싸움 앞에서 회복하고 그렇다고 적는다 — 싸움 명령의 자리는 그대로, 되풀이 안전", () => {
      const project = build(true);
      const run = createBuildRun({ project, currentMapId: project.startMapId, assistantRun: true } as never);
      expect(ensureBossRest(run)).toEqual(["「종지기」 heals the party before its fight (this map has a rest crystal; the path battles are fitted to a rested party)"]);
      expect(kinds(run.ctx.project)).toEqual(["text", "recoverAll", "text", "fork"]);
      expect(ensureBossRest(run)).toEqual([]);
    });
    it("다시 돌아도 보스 앞의 회복을 쉼터로 치지 않는다 — 놓은 쉼터 결정을 걷지 않는다", () => {
      const ctx: ToolContext = { project: createEmptyToolProject("굴") };
      const blank = createBlankProject() as Project;
      ctx.project.database = blank.database;
      ctx.project.system = { ...ctx.project.system, startActorIds: blank.system.startActorIds };
      expect(runTool(ctx, "author_dungeon", { type: "cave", size: "small", name: "굴", seed: 2 }, { dryRun: false }).ok).toBe(true);
      const cave = Object.values(ctx.project.maps)[0]!;
      ctx.project.maps.m_start = { ...structuredClone(cave), id: "m_start", name: "시작", events: [] };
      ctx.project.startMapId = "m_start";
      const run = createBuildRun({ project: ctx.project, currentMapId: cave.id, assistantRun: true } as never);
      const rests = () => run.ctx.project.maps[cave.id]!.events.filter((e) => /_rest$/u.test(e.id)).length;
      expect(ensureBossRest(run).join(" ")).toContain("heals the party before its fight");
      expect(rests()).toBe(1);
      expect(ensureBossRest(run)).toEqual([]);
      expect(rests()).toBe(1);
    }, 60_000);
    it("쉼터가 없는 맵(시작 맵)의 보스는 공짜로 회복시키지 않는다", () => {
      const project = build(false);
      const run = createBuildRun({ project, currentMapId: project.startMapId, assistantRun: true } as never);
      expect(ensureBossRest(run)).toEqual([]);
      expect(kinds(run.ctx.project)).toEqual(["text", "fork"]);
    });
  });
  // P6: «녹슨 갑옷과 방패를 든 해골 병사» 가 창백한 유령으로, «거대한 해골 종지기» 가 던전의 푸른 용으로 섰다 — 해골 그림은 옛 묶음에 있었다.
  describe("글이 짚은 적 그림은 어느 묶음에 있든 그대로 — 확인 빌드 r6 · r7a", () => {
    it("이름과 그림 설계 글이 둘 이상 겹치는 적 하나 — 한 낱말만 겹치거나 여럿이 겨루면 고르지 않는다", () => {
      const project = createBlankProject() as Project;
      expect(namedFoeArt(project, "해골 병사 녹슨 갑옷과 방패를 든 해골 병사")).toBe("enemy_skeleton_knight");
      expect(namedFoeArt(project, "해골 병사")).toBeUndefined();
      expect(namedFoeArt(project, "강의 주인 두꺼비")).toBeUndefined();
    });
  });
  // 명세 은행(2026-11-16, #4751 ce3c94330)이 짚은 것: 이 PR 의 새 글·새 사본이 끝맺음 관문 항목으로 세어졌다.
  describe("함수가 지은 것은 관문 항목이 아니다 — 명세 은행", () => {
    it("길 맞춤 사본 적의 능력치가 바뀐 것은 요청에 없는 변경이 아니다 — 원본은 그대로 짚는다", () => {
      const before = createBlankProject() as Project;
      const e0 = before.database.enemies[0]!;
      before.database.enemies.push({ ...structuredClone(e0), id: "enemy_path_x_ghost", name: "창백한 유령" } as never);
      const after = structuredClone(before);
      after.database.enemies.find((e) => e.id === "enemy_path_x_ghost")!.stats.attack += 7;
      expect(unaskedChanges(before, after, "재밌는 게임 만들어 줘").filter((f) => f.ko.includes("창백한 유령"))).toEqual([]);
      expect(databaseChangeReport(before, after).join("\n")).not.toContain("창백한 유령");
      // Database record edits are reported, not blocked (#4762 databaseChangeReport) — an edited original shows in the report.
      after.database.enemies[0]!.stats.attack += 7;
      expect(databaseChangeReport(before, after).join("\n")).toContain(String(e0.name));
    });
    it("보스마다 같은 글인 보스 앞 회복 줄은 반복으로 세지 않는다", () => {
      const before = createBlankProject() as Project;
      const after = structuredClone(before);
      const troopId = after.database.troops[0]!.id;
      const fight = (id: string, x: number) => event(id, id, x, 4, [page([], [{ kind: "text", body: REST_LINE }, { kind: "recoverAll" }, { kind: "text", body: "물러서라, 이 문은 아무도 지나갈 수 없다!" }, { kind: "battleProcessing", troopSource: "fixed", troopId, canEscape: false }])]);
      after.maps[after.startMapId]!.events = [fight("ev_a_boss", 3), fight("ev_b_boss", 9)];
      const lines = sceneCraftFindings(before, after, "게임 만들어 줘").map((f) => f.ko).filter((m) => m.includes("written twice"));
      expect(lines.some((m) => m.includes("결전을 앞두고"))).toBe(false);
      expect(lines.some((m) => m.includes("물러서라, 이 문은 아무도 지나갈 수 없다!"))).toBe(true);
    });
  });
});
