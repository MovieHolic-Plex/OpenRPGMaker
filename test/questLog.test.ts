import { describe, expect, it } from "vitest";
import { recommendMapBgm } from "@/assets/bgmThemeRecommendation";
import { BGM_CATALOG, findBgmTrack, type BgmCatalogTrack } from "@/assets/bgmCatalog";
import { findBgmRuntimeEntry, isBgmCatalogResourceId } from "@/assets/bgmCatalogRuntime";
import { STARTER_BATTLE_BGM_ID, STARTER_DEFAULT_BGM_ID } from "@/assets/bgmStarterTracks";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { classifyPlainPiTurn } from "@/ai/piAgent/plainTurn";
import { resolveAutonomy, type AutonomyLevel } from "@/ai/autonomyLevels";
import { fixedDeclarer } from "./intentFixture";
import { createProjectWikiCoordinator } from "@/editor/projectWikiCoordinator";
import type { ProjectWikiPatch } from "@/project/world";
import type { ExtractProjectWikiInput } from "@/ai/projectWikiClient";
import { buildIntentFacts, declareIntentCached, resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { aiActivityFamilySource } from "@/editor/aiActivityNarration";
import { deserialize, serialize } from "@/project/io";
import { projectLint } from "@/project/lint/projectLint";
import type { ReachabilitySpec } from "@/project/lint/reachability";
import { isStepQuestDef, type QuestDef } from "@/project/quest/questDef";
import type { Project } from "@/project/types";
import { buildQuestLog, questLogEntry } from "@/player/questLog";
import { renderPlayerStatusMenu, STATUS_MENU_COMMAND_IDS, statusMenuCommandLabel } from "@/player/playerStatusMenu";
import { startSession, type PlaySession } from "@/project/session";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { readStoreMusicMeta } from "@/assets/storeMusicMeta";
import { isolateTimers } from "./mergedTeardown";

// 테마별 맵 BGM 자동 선택 — generate_map/create_map 이 전부 같은 기본곡을 쓰지 않게 지킨다.
describe("mapBgmVariety", () => {
  isolateTimers();
  // Since the 2026-10-07 copyright purge only the Scarloxy profiles generate maps (mapGenerationProfiles.ts);
  // the default tileset (beodeul_city) answers unsupported-tileset.
  const GENERATE_TILESET_ID = "scarloxy_chipset_grassland";
  function catalogId(resourceId: string): string {
    expect(isBgmCatalogResourceId(resourceId), `${resourceId} 가 카탈로그에 없다`).toBe(true);
    expect(findBgmTrack(resourceId), resourceId).toBeDefined();
    expect(findBgmRuntimeEntry(resourceId), resourceId).toBeDefined();
    return resourceId;
  }
  function sceneText(track: BgmCatalogTrack): string {
    return [track.title, track.category, track.brief, ...track.tags].join("\n");
  }
  describe("recommendMapBgm", () => {
    it("village/forest/cave 가 같은 시드에서도 서로 다른 곡이다", () => {
      const village = catalogId(recommendMapBgm("village", 1));
      const forest = catalogId(recommendMapBgm("forest", 1));
      const cave = catalogId(recommendMapBgm("cave", 1));
      expect(new Set([village, forest, cave]).size).toBe(3);
    });

    it("같은 시드는 결정적이다", () => {
      expect(recommendMapBgm("forest", 42)).toBe(recommendMapBgm("forest", 42));
      expect(recommendMapBgm("마을", 7)).toBe(recommendMapBgm("village", 7));
      expect(recommendMapBgm("깊은 숲", 3)).toBe(recommendMapBgm("forest", 3));
      expect(recommendMapBgm("고블린 동굴", 11)).toBe(recommendMapBgm("cave", 11));
    });

    it("시드가 바뀌면 후보가 여러 곡일 때 다른 곡을 고른다", () => {
      expect(recommendMapBgm("forest", 1)).not.toBe(recommendMapBgm("forest", 99));
    });

    it("한국어 키워드 마을/숲/동굴/던전/밤/전투 도 카탈로그 곡을 고른다", () => {
      for (const name of ["마을", "숲", "동굴", "던전", "밤", "전투"]) {
        catalogId(recommendMapBgm(name, 1));
      }
      expect(recommendMapBgm("마을", 1)).not.toBe(recommendMapBgm("숲", 1));
      expect(recommendMapBgm("동굴", 1)).not.toBe(recommendMapBgm("전투", 1));
    });

    it("모르는 이름은 필드 폴백으로 카탈로그 곡을 돌려 주고 죽지 않는다", () => {
      const unknown = catalogId(recommendMapBgm("zzzz-not-a-theme-xyz", 1));
      expect(findBgmTrack(unknown)?.category).toMatch(/필드|초원|장거리/);
      expect(catalogId(recommendMapBgm("", Number.NaN))).toBe(STARTER_DEFAULT_BGM_ID);
    });

    it("excludeIds 는 같은 시드에서 다른 후보로 밀어낸다", () => {
      const first = catalogId(recommendMapBgm("forest", 1));
      const second = catalogId(recommendMapBgm("forest", 1, [first]));
      expect(second).not.toBe(first);
    });

    it("마을/숲/동굴은 심리스 루프 곡을 고른다", () => {
      for (const theme of ["village", "forest", "cave"] as const) {
        const id = catalogId(recommendMapBgm(theme, 1));
        expect(findBgmRuntimeEntry(id)?.loop, id).toBe(true);
      }
    });

    it("forest-village/숲 마을 은 village, deep-forest/깊은 숲 은 forest", () => {
      const seed = 1;
      expect(recommendMapBgm("forest-village", seed)).toBe(recommendMapBgm("village", seed));
      expect(recommendMapBgm("숲 마을", seed)).toBe(recommendMapBgm("village", seed));
      expect(recommendMapBgm("deep-forest", seed)).toBe(recommendMapBgm("forest", seed));
      expect(recommendMapBgm("깊은 숲", seed)).toBe(recommendMapBgm("forest", seed));
    });

    it("설명에 맞는 곡을 전부 exclude 하면 스타터 id 로 떨어진다", () => {
      const exclude = BGM_CATALOG.map((track) => track.id).filter((id) => id !== STARTER_DEFAULT_BGM_ID);
      expect(catalogId(recommendMapBgm("village", 1, exclude))).toBe(STARTER_DEFAULT_BGM_ID);
    });

    it("테마 낱말에 없는 장소 이름은 곡 설명에서 찾는다", () => {
      const id = catalogId(recommendMapBgm("등불항구", 1));
      expect(id).not.toBe(STARTER_DEFAULT_BGM_ID);
      expect(sceneText(findBgmTrack(id)!)).toMatch(/항구/);
    });

    it("기획 설명에만 있는 장소도 고른다", () => {
      const id = catalogId(recommendMapBgm("여관", 1));
      expect(findBgmTrack(id)?.brief).toMatch(/여관/);
    });

    it("프로젝트에 덮어쓴 설명을 이름과 대조한다", () => {
      const target = BGM_CATALOG[0]!.id;
      const place = "힣퀴뷁촥";
      expect(recommendMapBgm(place, 1, undefined, {
        descriptions: { [target]: `이 곡은 ${place} 장면을 위한 음악이다.` },
      })).toBe(target);
    });
  });
  describe("자동 BGM 다양성 (seed 생략 반복)", () => {
    it("generate_map을 seed 없이 같은 테마로 두 번 만들면 다른 곡이다 (풀이 허용할 때)", () => {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const first = runTool(
        ctx,
        "generate_map",
        { theme: "village", width: 12, height: 12, id: "gen_variety_1", chokepoints: 0, tilesetId: GENERATE_TILESET_ID },
        { dryRun: false },
      );
      const second = runTool(
        ctx,
        "generate_map",
        { theme: "village", width: 12, height: 12, id: "gen_variety_2", chokepoints: 0, tilesetId: GENERATE_TILESET_ID },
        { dryRun: false },
      );
      expect(first.ok, first.summary).toBe(true);
      expect(second.ok, second.summary).toBe(true);
      const firstBgm = (first.data as { bgmResourceId: string }).bgmResourceId;
      const secondBgm = (second.data as { bgmResourceId: string }).bgmResourceId;
      catalogId(firstBgm);
      catalogId(secondBgm);
      expect(secondBgm).not.toBe(firstBgm);
    });

    it("같은 id로 재생하면 같은 BGM이다", () => {
      const runOnce = (): string => {
        const ctx: ToolContext = { project: createEmptyToolProject() };
        const result = runTool(
          ctx,
          "generate_map",
          { theme: "forest", width: 12, height: 12, id: "gen_replay", chokepoints: 0, tilesetId: GENERATE_TILESET_ID },
          { dryRun: false },
        );
        expect(result.ok, result.summary).toBe(true);
        return (result.data as { bgmResourceId: string }).bgmResourceId;
      };
      expect(runOnce()).toBe(runOnce());
    });

    it("create_map도 seed 없이 같은 이름 반복이면 다른 곡이다 (풀이 허용할 때)", () => {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const first = runTool(
        ctx,
        "create_map",
        { name: "숲속 마을", width: 8, height: 8, id: "map_variety_1" },
        { dryRun: false },
      );
      const second = runTool(
        ctx,
        "create_map",
        { name: "숲속 마을", width: 8, height: 8, id: "map_variety_2" },
        { dryRun: false },
      );
      expect(first.ok, first.summary).toBe(true);
      expect(second.ok, second.summary).toBe(true);
      const firstBgm = (first.data as { bgmResourceId: string }).bgmResourceId;
      const secondBgm = (second.data as { bgmResourceId: string }).bgmResourceId;
      catalogId(firstBgm);
      catalogId(secondBgm);
      expect(secondBgm).not.toBe(firstBgm);
    });
  });
  describe("generate_map BGM", () => {
    it("테마마다 custom BGM 을 심고 요약/data 에 담는다", () => {
      const ids = new Set<string>();
      for (const theme of ["village", "forest", "cave"] as const) {
        const ctx: ToolContext = { project: createEmptyToolProject() };
        const result = runTool(
          ctx,
          "generate_map",
          { theme, width: 12, height: 12, seed: 1, id: `gen_${theme}`, chokepoints: 0, tilesetId: GENERATE_TILESET_ID },
          { dryRun: false },
        );
        expect(result.ok, result.summary).toBe(true);
        const data = result.data as { bgmResourceId: string };
        const map = ctx.project.maps[`gen_${theme}`]!;
        expect(map.bgm).toEqual({ mode: "custom", resourceId: data.bgmResourceId });
        expect(result.summary).toContain(data.bgmResourceId);
        catalogId(data.bgmResourceId);
        ids.add(data.bgmResourceId);
      }
      expect(ids.size).toBe(3);
    });

    it("명시적 bgmResourceId 가 있으면 자동 선택을 건너뛴다", () => {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const result = runTool(
        ctx,
        "generate_map",
        {
          theme: "village",
          width: 12,
          height: 12,
          seed: 1,
          id: "gen_bgm_id",
          chokepoints: 0, tilesetId: GENERATE_TILESET_ID,
          bgmResourceId: STARTER_BATTLE_BGM_ID,
        },
        { dryRun: false },
      );
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps.gen_bgm_id?.bgm).toEqual({
        mode: "custom",
        resourceId: STARTER_BATTLE_BGM_ID,
      });
      expect((result.data as { bgmResourceId: string }).bgmResourceId).toBe(STARTER_BATTLE_BGM_ID);
    });

    it("명시적 bgm custom 이 있으면 자동 선택을 건너뛴다", () => {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const result = runTool(
        ctx,
        "generate_map",
        {
          theme: "forest",
          width: 12,
          height: 12,
          seed: 1,
          id: "gen_bgm_custom",
          chokepoints: 0, tilesetId: GENERATE_TILESET_ID,
          bgm: { mode: "custom", resourceId: STARTER_DEFAULT_BGM_ID },
        },
        { dryRun: false },
      );
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps.gen_bgm_custom?.bgm).toEqual({
        mode: "custom",
        resourceId: STARTER_DEFAULT_BGM_ID,
      });
    });

    it("명시적 bgm none 은 무음으로 심는다", () => {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const result = runTool(
        ctx,
        "generate_map",
        {
          theme: "cave",
          width: 12,
          height: 12,
          seed: 1,
          id: "gen_bgm_none",
          chokepoints: 0, tilesetId: GENERATE_TILESET_ID,
          bgm: { mode: "none" },
        },
        { dryRun: false },
      );
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps.gen_bgm_none?.bgm).toEqual({ mode: "none" });
    });
  });
  describe("create_map BGM", () => {
    it("맵 이름 키워드로 테마를 읽어 자동 지정한다", () => {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const result = runTool(
        ctx,
        "create_map",
        { name: "고블린 동굴", width: 8, height: 8, id: "map_cave", seed: 1 },
        { dryRun: false },
      );
      expect(result.ok, result.summary).toBe(true);
      const data = result.data as { bgmResourceId: string };
      expect(ctx.project.maps.map_cave?.bgm).toEqual({ mode: "custom", resourceId: data.bgmResourceId });
      catalogId(data.bgmResourceId);
      expect(sceneText(findBgmTrack(data.bgmResourceId)!)).toMatch(/동굴|광산|광물/);
    });

    it("명시적 bgmResourceId 가 있으면 자동 선택을 건너뛴다", () => {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const result = runTool(
        ctx,
        "create_map",
        { name: "마을", width: 8, height: 8, id: "map_explicit", bgmResourceId: STARTER_DEFAULT_BGM_ID },
        { dryRun: false },
      );
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps.map_explicit?.bgm).toEqual({
        mode: "custom",
        resourceId: STARTER_DEFAULT_BGM_ID,
      });
    });

    it("bgm none 은 무음으로 심는다", () => {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const result = runTool(
        ctx,
        "create_map",
        { name: "마을", width: 8, height: 8, id: "map_bgm_none", bgm: { mode: "none" } },
        { dryRun: false },
      );
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps.map_bgm_none?.bgm).toEqual({ mode: "none" });
    });

    it("bgm parent 는 상속으로 심는다", () => {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const result = runTool(
        ctx,
        "create_map",
        { name: "마을", width: 8, height: 8, id: "map_bgm_parent", bgm: { mode: "parent" } },
        { dryRun: false },
      );
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps.map_bgm_parent?.bgm).toEqual({ mode: "parent" });
    });

    it("bgm custom 객체는 지정 곡을 심는다", () => {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const result = runTool(
        ctx,
        "create_map",
        {
          name: "마을",
          width: 8,
          height: 8,
          id: "map_bgm_custom",
          bgm: { mode: "custom", resourceId: STARTER_BATTLE_BGM_ID },
        },
        { dryRun: false },
      );
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps.map_bgm_custom?.bgm).toEqual({
        mode: "custom",
        resourceId: STARTER_BATTLE_BGM_ID,
      });
    });

    it("bgm 객체에 mode 가 없으면 거절한다", () => {
      const ctx: ToolContext = { project: createEmptyToolProject() };
      const result = runTool(
        ctx,
        "create_map",
        { name: "마을", width: 8, height: 8, id: "map_bgm_empty", bgm: {} },
        { dryRun: false },
      );
      expect(result.ok, result.summary).toBe(false);
      expect(result.issues?.[0]?.code).toBe("invalid-args");
      expect(result.issues?.[0]?.message ?? result.summary).toMatch(/mode/);
      expect(ctx.project.maps.map_bgm_empty).toBeUndefined();
    });

    it("같은 id로 재생하면 같은 BGM이다 (id 유도 결정성)", () => {
      const runOnce = (): string => {
        const ctx: ToolContext = { project: createEmptyToolProject() };
        const result = runTool(
          ctx,
          "create_map",
          { name: "달빛 마을", width: 8, height: 8, id: "map_replay" },
          { dryRun: false },
        );
        expect(result.ok, result.summary).toBe(true);
        const bgm = ctx.project.maps.map_replay?.bgm;
        expect(bgm?.mode).toBe("custom");
        const resourceId = (bgm as { resourceId: string }).resourceId;
        catalogId(resourceId);
        return resourceId;
      };
      expect(runOnce()).toBe(runOnce());
    });
  });
});

describe("plainTurnViewNavigation", () => {
  isolateTimers();
  describe("Pi navigation authority from user intent", () => {
    const classify = (navigation: boolean, level: AutonomyLevel) => classifyPlainPiTurn({
      project: createEmptyToolProject(), text: `location request ${navigation} ${level}`,
      currentMapId: null, selection: null, hasActivePlan: false, piTeam: false,
      autonomy: resolveAutonomy(level),
      declarer: () => fixedDeclarer({ mode: "question", viewNavigation: navigation }),
    });

    it("passes explicit location guidance through the ordinary and read-only request paths", async () => {
      expect((await classify(true, "balanced")).plan).toMatchObject({ readOnly: true, viewNavigation: true });
      expect((await classify(true, "readonly")).plan).toMatchObject({ readOnly: true, viewNavigation: true });
      expect((await classify(false, "balanced")).plan.viewNavigation).toBe(false);
    });

    it("does not turn plan-only execution into a navigation request", async () => {
      expect((await classify(true, "confirm")).plan.viewNavigation).not.toBe(true);
    });
  });
});

describe("projectWiki", () => {
  isolateTimers();
  function patch(input: ExtractProjectWikiInput): ProjectWikiPatch {
    return { upserts: [{
      id: "w_combat", type: "guideline", name: "Combat", summary: "Contact battles",
      wiki: { kind: "declaration", basis: "explicit", combatMode: "contact", sourceIds: input.sources.map((source) => source.id) },
    }] };
  }
  describe("editor-owned wiki checkpoints", () => {
    it("backfills all available history in bounded batches without dropping early decisions", async () => {
      const project = createEmptyToolProject("History");
      const sources = Array.from({ length: 40 }, (_, index) => ({
        id: `history-${index}`, kind: "user" as const, text: `Fact ${index}`, at: index + 1,
      }));
      const coordinator = createProjectWikiCoordinator({
        getProject: () => project, getIdentity: () => "history-project", history: async () => sources,
        extract: async (input) => {
          if (input.sources.length > 16) throw new Error("history extraction payload exceeds its batch budget");
          return { upserts: input.sources.map((source) => ({
            id: `w_${source.id}`, type: "concept" as const, name: source.text, summary: source.text,
            wiki: { kind: "knowledge" as const, basis: "explicit" as const, topic: source.id, sourceIds: [source.id] },
          })) };
        },
        updateWorld: (world) => { project.world = world; },
        flush: async () => ({ kind: "saved" }),
      });

      const added = await coordinator.backfill();

      expect(added).toBe(40);
      expect(project.world?.entities.map((entity) => entity.wiki?.sources[0]?.id)).toEqual(sources.map((source) => source.id));
      expect(await coordinator.backfill()).toBe(0);
    });
    it("persists extracted user decisions before resolving the authoring barrier", async () => {
      const project = createEmptyToolProject("Wiki");
      const order: string[] = [];
      const coordinator = createProjectWikiCoordinator({
        getProject: () => project, getIdentity: () => "project-one", history: async () => [],
        extract: async (input) => { order.push("extract"); return patch(input); },
        updateWorld: (world) => { project.world = world; order.push("apply"); },
        flush: async () => { order.push("saved"); return { kind: "saved" }; },
      });

      const world = await coordinator.prepare({ text: "Use contact battles", mapId: null, composerMode: "do" });

      expect(order).toEqual(["extract", "apply", "saved"]);
      expect(world?.entities[0]?.wiki?.sources[0]?.text).toBe("Use contact battles");
      expect(world?.entities[0]?.wiki?.combatMode).toBe("contact");
    });

    it("rejects a project switch while the model is running without mutating the new project", async () => {
      const project = createEmptyToolProject("Original");
      let identity = "original";
      let release: (() => void) | undefined;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      let started: (() => void) | undefined;
      const entered = new Promise<void>((resolve) => { started = resolve; });
      const coordinator = createProjectWikiCoordinator({
        getProject: () => project, getIdentity: () => identity, history: async () => [],
        extract: async (input) => { started?.(); await gate; return patch(input); },
        updateWorld: (world) => { project.world = world; },
        flush: async () => ({ kind: "saved" }),
      });
      const pending = coordinator.prepare({ text: "Use contact battles", mapId: null, composerMode: "do" });
      await entered;

      identity = "different-project";
      release?.();

      await expect(pending).rejects.toMatchObject({ reason: "project-changed" });
      expect(project.world).toBeUndefined();
    });

    it("does not claim a disabled or failed remote save is a completed checkpoint", async () => {
      const project = createEmptyToolProject("Wiki");
      const coordinator = createProjectWikiCoordinator({
        getProject: () => project, getIdentity: () => "project", history: async () => [],
        extract: async (input) => patch(input),
        updateWorld: (world) => { project.world = world; },
        flush: async () => ({ kind: "disabled" }),
      });

      const pending = coordinator.prepare({ text: "Use contact battles", mapId: null, composerMode: "do" });

      await expect(pending).rejects.toMatchObject({ reason: "save" });
      expect(project.world?.entities[0]?.wiki?.basis).toBe("explicit");
    });

    it("keeps question mode read-only while exposing existing wiki", async () => {
      const project = createEmptyToolProject("Wiki");
      project.world = { entities: [], relations: [] };
      const coordinator = createProjectWikiCoordinator({
        getProject: () => project, getIdentity: () => "project",
        extract: async () => { throw new Error("question must not extract or write"); },
      });

      const result = await coordinator.prepare({ text: "What is this game?", mapId: null, composerMode: "ask" });

      expect(result).toBe(project.world);
    });
  });
});

describe("projectWikiRouting", () => {
  isolateTimers();
  describe("project wiki intent grounding", () => {
    it("classifies wiki retrieval as a read-only activity", () => {
      expect(aiActivityFamilySource("read_project_wiki")).toBe("read-only");
    });
    it("passes sourced project decisions into intent facts before tool selection", () => {
      const project = createEmptyToolProject("Wiki routing");
      project.world = {
        entities: [{
          id: "w_rule", type: "guideline", name: "Combat", summary: "Direct action", origin: "ai",
          wiki: {
            kind: "declaration", basis: "explicit", combatMode: "action",
            sources: [{ id: "u1", kind: "user", text: "Fight directly on the map", at: 1 }],
          },
        }],
        relations: [],
      };

      const facts = buildIntentFacts({ project, userText: "Add a monster", currentMapId: null, selection: null, hasActivePlan: false });
      const context = Reflect.get(facts, "wikiContext");

      expect(typeof context).toBe("string");
      if (typeof context !== "string") throw new Error("Wiki context was not provided to intent routing");
      expect(JSON.parse(context).combatMode).toBe("action");
    });

    it("does not reuse old routing after a wiki correction with the same request", async () => {
      resetIntentDeclarationCache();
      const project = createEmptyToolProject("Wiki cache");
      const facts = buildIntentFacts({ project, userText: "Add a monster", currentMapId: null, selection: null, hasActivePlan: false });
      await declareIntentCached(fixedDeclarer({ tools: ["make_hunting_ground"] }), { ...facts, wikiContext: '{"combatMode":"contact"}' });

      const corrected = await declareIntentCached(fixedDeclarer({ tools: ["make_action_enemy"] }), { ...facts, wikiContext: '{"combatMode":"action"}' });

      expect(corrected.intent.tools).toEqual(["make_action_enemy"]);
      resetIntentDeclarationCache();
    });
  });
});

// test/questCompiler.test.ts
// 퀘스트 DSL → 컴파일 검증. 잿불의 유산 Q(약초 수집 + 전투 + 대화)를 QuestDef로 역표현해
// 빈 마을에 컴파일 → projectLint 0 error + 도달성 통과 + 직렬화 왕복 보존.
describe("questCompiler", () => {
  isolateTimers();
  const VILLAGE = "m_village";
  // 잿불의 유산 Q2(달빛 약초) + 전투를 역표현한 선언적 퀘스트.
  function furnaceQuest(): QuestDef {
    return {
      key: "q_furnace",
      title: "꺼진 화로",
      summary: "마을 화로가 꺼졌다. 약초를 모으고 길을 막은 슬라임을 처치해 불씨를 되살려라.",
      giver: { create: { mapId: VILLAGE, x: 10, y: 8, name: "촌장 로안", textureKey: "tex_easyrpg_charset_people1", characterIndex: 6 } },
      steps: [
        { kind: "talk", target: { create: { mapId: VILLAGE, x: 5, y: 5, name: "약초꾼 세라", graphicQuery: "여관 주인" } }, lines: ["반짝이는 풀을 찾아 주세요."] },
        { kind: "collect", itemId: "it_herb", count: 2, sources: [
          { kind: "pickup", mapId: VILLAGE, x: 3, y: 11, lookText: "은은히 빛나는 풀이다." },
          { kind: "pickup", mapId: VILLAGE, x: 16, y: 3 },
        ] },
        { kind: "kill", troopId: "tr_slime", at: { mapId: VILLAGE, x: 14, y: 12, graphicQuery: "슬라임", intro: ["슬라임이 길을 막았다!"], victory: ["길이 열렸다."] } },
      ],
      rewards: { gold: 100, items: [{ itemId: "it_reward", count: 1 }] },
    };
  }
  function buildProjectWithQuest(): { project: Project; questResultOk: boolean } {
    const ctx: ToolContext = { project: createEmptyToolProject("퀘스트 컴파일 테스트") };
    const steps: Array<{ name: string; args: Record<string, unknown> }> = [
      { name: "create_map", args: { name: "잿불 마을", width: 20, height: 16, id: VILLAGE } },
      { name: "set_start_position", args: { mapId: VILLAGE, x: 10, y: 10 } },
      { name: "upsert_item", args: { item: { id: "it_herb", name: "달빛 약초", price: 0 } } },
      { name: "upsert_item", args: { item: { id: "it_reward", name: "수호 부적", price: 0 } } },
      { name: "upsert_enemy", args: { enemy: { id: "en_slime", name: "슬라임", stats: { maxHp: 40 } } } },
      { name: "upsert_troop", args: { troop: { id: "tr_slime", name: "슬라임 무리", enemyIds: ["en_slime"] } } },
    ];
    for (const step of steps) {
      const result = runTool(ctx, step.name, step.args, { dryRun: false });
      if (!result.ok) throw new Error(`셋업 실패 ${step.name}: ${JSON.stringify(result.issues)}`);
    }
    const questResult = runTool(ctx, "create_quest", { def: furnaceQuest() }, { dryRun: false });
    return { project: ctx.project, questResultOk: questResult.ok };
  }
  describe("questCompiler", () => {
    const { project, questResultOk } = buildProjectWithQuest();

    it("create_quest가 커밋 게이트를 통과한다", () => {
      expect(questResultOk).toBe(true);
    });

    it("projectLint error가 0이다", () => {
      const errors = projectLint(project).filter((issue) => issue.severity === "error");
      expect(errors).toEqual([]);
    });

    it("퀘스트 플래그와 이벤트가 생성된다", () => {
      const switchIds = new Set(project.switches.map((entry) => entry.id));
      expect(switchIds.has("sw_q_furnace_started")).toBe(true);
      expect(switchIds.has("sw_q_furnace_done")).toBe(true);
      expect(switchIds.has("sw_q_furnace_step0")).toBe(true);
      const eventIds = project.maps[VILLAGE].events.map((event) => event.id);
      expect(eventIds).toContain("ev_q_furnace_giver");
      expect(eventIds).toContain("ev_q_furnace_talk0");
      expect(eventIds).toContain("ev_q_furnace_kill2");
    });

    it("project.quests 메타가 직렬화 왕복에서 보존된다", () => {
      expect(project.quests?.length).toBe(1);
      const round = deserialize(serialize(project));
      expect(round.quests?.length).toBe(1);
      const quest = round.quests?.[0];
      expect(isStepQuestDef(quest)).toBe(true);
      if (!isStepQuestDef(quest)) throw new Error("step quest expected");
      expect(quest.key).toBe("q_furnace");
      expect(quest.steps.length).toBe(3);
    });

    it("퀘스트 이벤트가 시작 지점에서 도달 가능하다", () => {
      const targets = project.maps[VILLAGE].events.map((event) => ({ x: event.x, y: event.y }));
      const spec: ReachabilitySpec = { mapId: VILLAGE, from: project.startPos, targets };
      const reachErrors = projectLint(project, { reachability: [spec] }).filter((issue) => issue.code === "reachability");
      expect(reachErrors).toEqual([]);
    });
  });
});

// test/questLog.test.ts
// 퀘스트 로그 모델(순수) + "임무" 메뉴 항목/화면 렌더 검증.
describe("questLog", () => {
  isolateTimers();
  const VILLAGE = "m_village";
  function questDef(): QuestDef {
    return {
      key: "q_demo",
      title: "데모 임무",
      summary: "약초를 모으고 슬라임을 처치하라.",
      giver: { create: { mapId: VILLAGE, x: 10, y: 8, name: "촌장", textureKey: "tex_easyrpg_charset_people1", characterIndex: 6 } },
      steps: [
        { kind: "talk", target: { create: { mapId: VILLAGE, x: 5, y: 5, name: "세라", graphicQuery: "여관 주인" } } },
        { kind: "kill", troopId: "tr_slime", at: { mapId: VILLAGE, x: 14, y: 12, graphicQuery: "슬라임" } },
      ],
      rewards: { gold: 50 },
    };
  }
  function projectWithQuest(): Project {
    const ctx: ToolContext = { project: createEmptyToolProject("퀘스트 로그 테스트") };
    const setup = [
      { name: "create_map", args: { name: "마을", width: 20, height: 16, id: VILLAGE } },
      { name: "set_start_position", args: { mapId: VILLAGE, x: 10, y: 10 } },
      { name: "upsert_enemy", args: { enemy: { id: "en_slime", name: "슬라임" } } },
      { name: "upsert_troop", args: { troop: { id: "tr_slime", name: "슬라임 무리", enemyIds: ["en_slime"] } } },
      { name: "create_quest", args: { def: questDef() } },
    ];
    for (const step of setup) {
      const result = runTool(ctx, step.name, step.args, { dryRun: false });
      if (!result.ok) throw new Error(`셋업 실패 ${step.name}: ${JSON.stringify(result.issues)}`);
    }
    return ctx.project;
  }
  describe("questLog", () => {
    const project = projectWithQuest();

    it('메뉴에 "임무" 명령이 등록된다', () => {
      expect(STATUS_MENU_COMMAND_IDS).toContain("quests");
      expect(statusMenuCommandLabel("quests", true)).toBe("임무");
    });

    it("미시작 퀘스트는 not-started로 표시된다", () => {
      const session = startSession(project);
      const log = buildQuestLog(project, session);
      expect(log.length).toBe(1);
      expect(log[0].state).toBe("not-started");
      expect(log[0].completedSteps).toBe(0);
      expect(log[0].totalSteps).toBe(2);
    });

    it("스위치 상태에 따라 진행 중/단계 완료가 반영된다", () => {
      const session: PlaySession = startSession(project);
      session.switches.sw_q_demo_started = true;
      session.switches.sw_q_demo_step0 = true;
      const quest = project.quests![0];
      if (!isStepQuestDef(quest)) throw new Error("step quest expected");
      const entry = questLogEntry(quest, session);
      expect(entry.state).toBe("active");
      expect(entry.steps[0].done).toBe(true);
      expect(entry.steps[1].done).toBe(false);
      expect(entry.completedSteps).toBe(1);
    });

    it("완료 퀘스트는 모든 단계를 완료로 본다", () => {
      const session = startSession(project);
      session.switches.sw_q_demo_done = true;
      const quest = project.quests![0];
      if (!isStepQuestDef(quest)) throw new Error("step quest expected");
      const entry = questLogEntry(quest, session);
      expect(entry.state).toBe("done");
      expect(entry.steps.every((step) => step.done)).toBe(true);
    });

    it('메인 메뉴 레일의 "기록 ▸" 를 열면 "임무" 가 나온다', () => {
      installFakeDom();
      const session = startSession(project);
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({ project, session, slots: [], selectedCommand: "items", mode: "main", actions: emptyActions() })
      );
      // 사이드바 높이 때문에 기록/시스템/파티 그룹은 접혔다 — 레일에는 그룹 열기 항목만 있다.
      expect(findByTestId(menu, "status-menu-command-quests")).toBeNull();
      expect(findByTestId(menu, "status-menu-command-record-menu")?.textContent).toContain("기록");

      const record = renderWithFakeDom(() =>
        renderPlayerStatusMenu({ project, session, slots: [], selectedCommand: "record-menu", mode: "function", actions: emptyActions() })
      );
      const entry = findByTestId(record, "status-menu-group-command-quests");
      expect(entry).not.toBeNull();
      expect(entry?.textContent).toContain("임무");
    });

    it("임무 함수 화면이 퀘스트/단계 testid를 렌더한다", () => {
      installFakeDom();
      const session = startSession(project);
      session.switches.sw_q_demo_started = true;
      const menu = renderWithFakeDom(() =>
        renderPlayerStatusMenu({ project, session, slots: [], selectedCommand: "quests", mode: "function", actions: emptyActions() })
      );
      expect(findByTestId(menu, "status-menu-quest-q_demo")).not.toBeNull();
      expect(findByTestId(menu, "status-menu-quest-step-q_demo-0")).not.toBeNull();
      expect(findByTestId(menu, "status-menu-quest-state-q_demo")).not.toBeNull();
    });
  });
  function emptyActions() {
    const noop = () => undefined;
    return {
      onCommand: noop,
      onSaveSlot: noop,
      onLoadSlot: noop,
      onSelectItemTarget: noop,
      onUseItem: noop,
      onSelectSkillActor: noop,
      onSelectSkill: noop,
      onSelectEquipmentActor: noop,
      onSelectEquipmentSlot: noop,
      onEquipItem: noop,
      onUnequipItem: noop,
      onToggleRow: noop,
      onSelectFormationActor: noop,
      onMoveFormationActor: noop,
      onToggleMonsterView: noop,
      onMoveMonster: noop,
      onToggleWait: noop,
      onToTitle: noop,
    };
  }
});

// 스토어 음악 팩 곡의 고르기 설명(meta.oprnMusic) → 오디오 목록 태그·설명 → recommend_bgm 장면·분위기 고르기.
describe("storeMusicPick", () => {
  isolateTimers();
  const OGG = "data:audio/ogg;base64,T2dnUwACAAAAAAAAAAA=";
  function storeTrack(id: string, name: string, oprnMusic: Record<string, unknown>) {
    return { id, name, kind: "music" as const, dataUrl: OGG, meta: { oprnMusic } as Project["assets"]["uploaded"][string]["meta"] };
  }
  function projectWithPack(): Project {
    const project = createEmptyToolProject();
    const joseon = { genreLine: "joseon", genreLabel: "Joseon Korean Traditional", genreKo: "조선 전통", tempo: "fast", loopable: true, lengthSec: 72, bpm: 150, energy: 5 };
    project.assets.uploaded.jb = storeTrack("jb", "Tiger Pass Duel", { ...joseon, sceneRoles: ["boss"], mood: ["비장한", "격렬한"], summaryKo: "장구와 해금이 몰아치는 조선풍 보스전." });
    project.assets.uploaded.jt = storeTrack("jt", "Hanok Morning", { ...joseon, sceneRoles: ["town"], mood: ["평화로운", "그리운"], tempo: "medium", energy: 2, summaryKo: "대금이 이끄는 한가로운 조선 마을." });
    project.assets.uploaded.jv = storeTrack("jv", "Drum Roll Cheer", { ...joseon, sceneRoles: ["victory"], mood: ["승리의"], loopable: false, lengthSec: 6, summaryKo: "짧은 태평소 승리 팡파르." });
    project.assets.uploaded.fb = storeTrack("fb", "Crystal Tyrant", { genreLine: "fantasy", genreLabel: "판타지 JRPG", sceneRoles: ["boss"], mood: ["위협적인"], loopable: true, summaryKo: "16비트 오르간과 금관의 판타지 보스전." });
    return project;
  }
  type Candidate = { resourceId: string; descriptionSource: string; music?: { scenes: string[]; loopable: boolean; genre: string } };
  const pick = (project: Project, args: Record<string, unknown>) => {
    const result = runTool({ project }, "recommend_bgm", args, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    return result.data as { candidates: Candidate[]; sceneFallback?: true; guidance: string };
  };
  describe("store music pick", () => {
    it("reads only well-formed scene roles and ignores tracks without them", () => {
      expect(readStoreMusicMeta({ oprnMusic: { sceneRoles: ["boss", "nope"], mood: ["비장한", 3], loopable: true } })).toMatchObject({ scenes: ["boss"], mood: ["비장한"], loopable: true });
      expect(readStoreMusicMeta({ oprnMusic: { sceneRoles: ["nope"] } })).toBeNull();
      expect(readStoreMusicMeta({})).toBeNull();
    });

    it("lists store tracks with searchable genre, scene and mood tags and a listening description", () => {
      const boss = listAudioResources("music", projectWithPack()).find((entry) => entry.id === "jb")!;
      expect(boss.tags).toEqual(expect.arrayContaining(["조선 전통", "boss", "보스", "비장한", "루프"]));
      expect(boss.description).toContain("장구와 해금");
      expect(boss.description).toContain("150 BPM");
      expect(boss.descriptionSource).toBe("ai-listening");
    });

    it("scene + query ranks inside the scene: a Joseon boss request gets the Joseon boss track first", () => {
      const data = pick(projectWithPack(), { scene: "boss", query: "조선", limit: 5 });
      expect(data.candidates[0]?.resourceId).toBe("jb");
      expect(data.candidates.map((c) => c.resourceId)).not.toContain("jt");
      expect(data.candidates[0]?.music).toMatchObject({ scenes: ["boss"], loopable: true, genre: "조선 전통" });
    });

    it("scene alone matches store tracks by their scene roles, not their names", () => {
      const ids = pick(projectWithPack(), { scene: "village", limit: 20 }).candidates.map((c) => c.resourceId);
      expect(ids).toContain("jt");
      expect(ids).not.toContain("jb");
      expect(pick(projectWithPack(), { scene: "victory", limit: 20 }).candidates.map((c) => c.resourceId)).toContain("jv");
    });

    it("falls back to the query when nothing in the scene matches and says so", () => {
      const data = pick(projectWithPack(), { scene: "ending", query: "조선", limit: 5 });
      expect(data.sceneFallback).toBe(true);
      expect(data.candidates.length).toBeGreaterThan(0);
      expect(data.guidance).toContain("store_find_music");
    });
  });
});
