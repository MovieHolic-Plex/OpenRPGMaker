// 몬스터 자산 역방향 잠금(2026-10-17) — 누수 표(L01~L17)의 한 줄마다 「막힌 프로젝트에서 숨기고·거부 / 몬스터 프로젝트·몬스터 요청 턴에서는 통과」를 한 번씩 증명한다.
// 계기: jrpg-loop-1 D1 — 실제 Argon 이 FF6풍 JRPG 를 지으며 몬스터 센터·에메랄드 프로필·스타터 몬스터를 불렀다(정방향 장르 잠금은 monster-collect·romance 만 묶고 반대 방향이 없었다).
// 판정의 유일한 입구는 project/genreLockMonsterAssets.ts(monsterAssetsAllowed). 이 파일은 신규 시험이며 에이전트 세션 규칙상 이 파일만 vitest 로 실행한다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { createPiToolset } from "@/ai/piAgent/toolAdapter";
import { buildSessionRegistryTools } from "@/ai/sessionToolExposure";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { buildTaskRecipes } from "@/ai/toolCapabilityIndex";
import { buildIntentFacts, type IntentDeclarer } from "@/ai/intentDeclarationClient";
import { INTENT_SYSTEM_PROMPT, intentSystemPrompt, stripMonsterKitMentions } from "@/ai/intentDeclaration";
import { classifyPlainPiTurn } from "@/ai/piAgent/plainTurn";
import { resolveAutonomy } from "@/ai/autonomyLevels";
import { composePiTask } from "@/ai/piAgent/executionRoute";
import { classifyMonsterGameRequest, hasMonsterCollectIntent, isMonsterRequestTurn } from "@/ai/piAgent/monsterGameRequest";
import {
  isDeclaredMonsterGame, isMonsterOnlyTool, MONSTER_ONLY_TOOLS, monsterAssetsAllowed, monsterAssetStatus, monsterSystemFieldChanges,
  monsterToolArgViolation, projectHasMonsterGameEvidence,
} from "@/project/genreLockMonsterAssets";
import { monsterOnlyVisual } from "@/project/genreLockMonsterAssetsDiff";
import { checkMonster } from "@/qa/gameCheck/monster";
import type { Project } from "@/project/types";
import { fixedDeclarer } from "./intentFixture";

beforeEach(() => resetMapEditHistory());

/** 막힌 프로젝트(= FF6풍·CT풍 JRPG 가 시작하는 빈 프로젝트) */
const jrpg = (): Project => createBlankProject();
const ctxOf = (project: Project, extra: Partial<ToolContext> = {}): ToolContext => ({ project, currentMapId: project.startMapId, assistantRun: true, ...extra });
const run = (ctx: ToolContext, name: string, args: Record<string, unknown>): ToolResult => runTool(ctx, name, args, { dryRun: false });
const message = (result: ToolResult): string => `${result.summary} ${(result.issues ?? []).map((issue) => issue.message).join(" ")}`;
const names = (tools: readonly { name: string }[]): string[] => tools.map((tool) => tool.name);
const monsterProject = (): Project => { const p = createBlankProject(); p.system.genre = "monster-collect"; return p; };

const starterArgs = (p: Project) => ({ speciesIds: p.database.monsterSpecies!.slice(0, 3).map((species) => species.id), actorEvent: { mapId: p.startMapId, x: 5, y: 5, name: "박사" } });
const NEXT_ACTION = /되묻|몬스터 수집 게임 만들어 줘|upsert_enemy/u;

// ── L01 실행기 이름 호출 거부(전용 도구 17개 — #3543: place_field_obstacle 은 ARG_RULES 로 이동, kind:gap 은 비몬스터에도 열림) ─────────────────────────────────────────────────────
describe("L01 전용 도구는 이름으로 불러도 실행기가 거부한다(거부 문장에 다음 행동)", () => {
  it("표는 17행이고 모두 몬스터 전용으로 판정된다", () => {
    expect(MONSTER_ONLY_TOOLS).toHaveLength(17);
    for (const row of MONSTER_ONLY_TOOLS) expect(isMonsterOnlyTool(row.name)).toBe(true);
  });
  it.each(MONSTER_ONLY_TOOLS.map((row) => row.name))("%s: JRPG 에서 거부, 이름과 다음 행동을 알린다", (name) => {
    const ctx = ctxOf(jrpg());
    const before = ctx.project;
    const result = run(ctx, name, {});
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("genre-lock");
    expect(message(result)).toContain(name);
    expect(message(result)).toMatch(NEXT_ACTION);
    expect(ctx.project).toBe(before);
  });
  it.each(MONSTER_ONLY_TOOLS.map((row) => row.name))("%s: 몬스터 요청 턴이면 잠금 거부가 아니다(다른 이유로 실패할 수는 있다)", (name) => {
    const ctx = ctxOf(jrpg(), { monsterTurn: true });
    const result = run(ctx, name, {});
    expect(result.issues?.[0]?.code === "genre-lock" && /몬스터 수집 잠금/u.test(message(result))).toBe(false);
  });
});

// ── L02 인자로 갈리는 일반 도구 ───────────────────────────────────────────────────────────────────
describe("L02 일반 도구의 몬스터 전용 인자 값", () => {
  const rows: readonly (readonly [string, Record<string, unknown>])[] = [
    ["set_project_genre", { genre: "monster-collect" }],
    ["reset_project", { genrePreset: "monster-collect" }],
    ["author_dungeon", { type: "cave", genre: "pokemon" }],
    ["configure_game_systems", { battleModel: "gen1" }],
  ];
  it.each(rows)("%s %j 는 JRPG 에서 거부", (tool, args) => {
    expect(monsterToolArgViolation(tool, args)).toBeTruthy();
    const result = run(ctxOf(jrpg()), tool, args);
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("genre-lock");
  });
  it.each(rows)("%s 는 몬스터 요청 턴에는 인자 규칙이 막지 않는다", (tool, args) => {
    expect(run(ctxOf(jrpg(), { monsterTurn: true }), tool, args).issues?.[0]?.message ?? "").not.toMatch(/몬스터 수집 잠금/u);
  });
  it("같은 도구의 일반 값은 막지 않는다", () => {
    expect(monsterToolArgViolation("set_project_genre", { genre: "adventure-jrpg" })).toBeUndefined();
    expect(monsterToolArgViolation("author_dungeon", { type: "cave" })).toBeUndefined();
    expect(monsterToolArgViolation("configure_game_systems", { battleModel: "rm2k3" })).toBeUndefined();
  });
});

// ── L03 find_tools ────────────────────────────────────────────────────────────────────────────────
describe("L03 find_tools", () => {
  const found = (ctx: ToolContext, query: string): string[] => {
    const result = run(ctx, "find_tools", { query });
    return ((result.data as { matches?: { name: string }[] } | undefined)?.matches ?? []).map((match) => match.name);
  };
  it("JRPG: 이름으로 찾아도 전용 도구가 나오지 않고 이유·다음 행동을 알린다", () => {
    const ctx = ctxOf(jrpg());
    for (const name of ["place_monster_center", "place_trainer", "define_monster_species", "build_monster_game", "set_type_chart"]) {
      expect(found(ctx, name), name).not.toContain(name);
    }
    expect(found(ctx, "몬스터 센터 트레이너 도감 포획 체육관").filter(isMonsterOnlyTool)).toEqual([]);
    expect(message(run(ctx, "find_tools", { query: "place_monster_center" }))).toContain("몬스터 수집(포켓몬식) 전용");
  });
  it("몬스터 요청 턴 · 몬스터 프로젝트 · 손 편집(assistantRun 아님)에서는 나온다", () => {
    expect(found(ctxOf(jrpg(), { monsterTurn: true }), "place_monster_center")).toContain("place_monster_center");
    expect(found(ctxOf(monsterProject()), "place_monster_center")).toContain("place_monster_center");
    expect(found(ctxOf(jrpg(), { assistantRun: false }), "place_monster_center")).toContain("place_monster_center");
  });
});

// ── L04 Pi 도구 선언(createPiToolset) ──────────────────────────────────────────────────────────────
describe("L04 Pi 도구 선언 목록", () => {
  it("JRPG: 전용 도구 0개", () => {
    expect(names(createPiToolset(ctxOf(jrpg()))).filter(isMonsterOnlyTool)).toEqual([]);
  });
  it("몬스터 요청 턴: 전용 도구 전부 선언된다", () => {
    expect(names(createPiToolset(ctxOf(jrpg(), { monsterTurn: true }))).filter(isMonsterOnlyTool)).toHaveLength(MONSTER_ONLY_TOOLS.length);
  });
  it("몬스터 프로젝트: 전용 도구 전부 선언된다", () => {
    expect(names(createPiToolset(ctxOf(monsterProject()))).filter(isMonsterOnlyTool)).toHaveLength(MONSTER_ONLY_TOOLS.length);
  });
  it("조수 실행이 아니면 가리지 않는다", () => {
    expect(names(createPiToolset(ctxOf(jrpg(), { assistantRun: false }))).filter(isMonsterOnlyTool)).toHaveLength(MONSTER_ONLY_TOOLS.length);
  });
});

// ── L05 세션 노출(buildSessionRegistryTools) ───────────────────────────────────────────────────────
describe("L05 세션 도구 노출", () => {
  const exposed = (hide: boolean): string[] => buildSessionRegistryTools({
    requestText: "FF6 같은 게임 만들어 줘", intent: null, fullCatalogFallback: true,
    ...(hide ? { hideTool: (name: string) => isMonsterOnlyTool(name) } : {}),
  }).map((tool) => tool.function.name);
  it("전체 카탈로그 폴백에도 hideTool 이 마지막에 거른다", () => {
    expect(exposed(false).filter(isMonsterOnlyTool).length).toBeGreaterThan(0);
    expect(exposed(true).filter(isMonsterOnlyTool)).toEqual([]);
  });
});

// ── L06 능력 색인·레시피(프롬프트) ─────────────────────────────────────────────────────────────────
describe("L06 시스템 프롬프트의 능력 색인·레시피", () => {
  const prompt = (project: Project, turnText: string): string => buildSystemPrompt(project, { wikiQuery: turnText });
  it("JRPG: 색인에 전용 도구 이름이 없고 monster-* 레시피가 없다", () => {
    const text = prompt(jrpg(), "FF6 같은 게임 만들어 줘");
    for (const row of MONSTER_ONLY_TOOLS) expect(text.includes(row.name), row.name).toBe(false);
    expect(text).not.toMatch(/- monster-[a-z-]+: READ/u);
  });
  it("몬스터 요청 턴·몬스터 프로젝트: 색인과 레시피가 그대로 실린다", () => {
    for (const text of [prompt(jrpg(), "포켓몬 같은 몬스터 수집 게임 만들어 줘"), prompt(monsterProject(), "마을 하나 추가")]) {
      expect(text).toContain("place_monster_center");
      expect(text).toMatch(/- monster-field-rules: READ/u);
    }
  });
  it("레시피 생성기는 monster:false 면 monster-* 줄만 뺀다", () => {
    expect(buildTaskRecipes({ monster: false })).not.toMatch(/- monster-/u);
    expect(buildTaskRecipes()).toMatch(/- monster-badges: READ/u);
    expect(buildTaskRecipes({ monster: false })).toContain("- ");
  });
});

// ── L07 의도 선언(프롬프트·후보 도구 목록) ──────────────────────────────────────────────────────────
describe("L07 의도 선언", () => {
  it("선언 프롬프트의 몬스터 문장은 잠금 상태에서만 지워진다", () => {
    expect(INTENT_SYSTEM_PROMPT).toContain("place_trainer");
    expect(intentSystemPrompt({})).toBe(INTENT_SYSTEM_PROMPT);
    const locked = intentSystemPrompt({ monsterLocked: true });
    for (const word of ["place_trainer", "set_type_chart", "place_field_obstacle", "build_monster_game", "define_monster_species"]) expect(locked.includes(word), word).toBe(false);
    expect(locked).toContain("read_relief");
  });
  it("후보 도구 목록(facts.toolNames): JRPG 는 전용 도구 0개, 몬스터 프로젝트·요청 턴은 전부", () => {
    const facts = (project: Project, userText: string) => buildIntentFacts({ project, userText, currentMapId: project.startMapId, hasActivePlan: false });
    expect(facts(jrpg(), "FF6풍 JRPG 만들어 줘").toolNames.filter(isMonsterOnlyTool)).toEqual([]);
    expect(facts(jrpg(), "FF6풍 JRPG 만들어 줘").monsterLocked).toBe(true);
    expect(facts(jrpg(), "포켓몬 같은 몬스터 수집 게임 만들어 줘").toolNames.filter(isMonsterOnlyTool)).toHaveLength(MONSTER_ONLY_TOOLS.length);
    expect(facts(monsterProject(), "맵 하나 더").toolNames.filter(isMonsterOnlyTool)).toHaveLength(MONSTER_ONLY_TOOLS.length);
    expect(facts(monsterProject(), "맵 하나 더").monsterLocked).toBeUndefined();
  });
  it("던전 메모의 몬스터 키트 문구는 지워지고 일반 문구는 남는다", () => {
    const note = "칩셋 어댑터(몬스터 키트 / 버들항)와 장르(포켓몬풍 짧은 던전 / 일반 RPG 긴 던전)는 author_dungeon 이 정한다 (버들항 기본, 몬스터 키트 기본은 cave) 장르별 채우기 계획 data.population(야생 조우 구역·시선 트레이너·지름길 / 필드 적·상자·잠긴 문)을 놓는다";
    const stripped = stripMonsterKitMentions(note);
    expect(stripped).not.toMatch(/몬스터 키트|포켓몬풍|시선 트레이너/u);
    expect(stripped).toContain("필드 적·상자·잠긴 문");
  });
});

// ── L08 평문 턴 분류(첫 노출 목록·의도 메모) — D1 재현 ───────────────────────────────────────────────
describe("L08 평문 턴 분류(classifyPlainPiTurn)", () => {
  const D1 = "파이널판타지6 같은 게임 만들어 줘. 세계가 한 번 무너지고, 흩어진 동료들을 다시 모으는 이야기로";
  const classify = (project: Project, text: string, declare = fixedDeclarer({ mode: "create", tools: ["place_monster_center", "place_trainer", "upsert_enemy", "get_project_summary"] })) => classifyPlainPiTurn({
    project, text, currentMapId: project.startMapId, selection: null, hasActivePlan: false, piTeam: false,
    autonomy: resolveAutonomy("balanced"), declarer: () => declare,
  });
  it("D1(FF6풍 요청): monsterKit 없음, 선언이 몬스터 도구를 골라도 첫 노출 목록에서 빠진다", async () => {
    const result = await classify(createEmptyToolProject(), D1);
    expect(result.monsterKit).toBeUndefined();
    expect((result.initialToolNames ?? []).filter(isMonsterOnlyTool)).toEqual([]);
    expect(result.initialToolNames).toContain("upsert_enemy");
  });
  it("진짜 몬스터 요청은 첫 턴부터 monsterKit·몬스터 도구 노출이다", async () => {
    for (const text of ["포켓몬 같은 몬스터 수집 게임 만들어 줘. 체육관을 돌며 도감을 채우는 이야기", "화산 섬 몬스터 수집 게임 만들어 줘", "대회형 몬스터 배틀 게임 만들어 줘, 포획은 없고 트레이너 대전 중심"]) {
      const result = await classify(createEmptyToolProject(), text);
      expect(result.monsterKit, text).toBe(true);
      expect((result.initialToolNames ?? []).filter(isMonsterOnlyTool).length, text).toBeGreaterThan(0);
    }
  });
  it("의도 메모가 몬스터 낱말을 싣고 있어도 사용자 글이 JRPG 면 막힌 채다", async () => {
    const task = composePiTask(D1, "[의도] 던전 층 시공이다. 장르(포켓몬풍 짧은 던전 / 일반 RPG 긴 던전)는 몬스터 키트 기준, 시선 트레이너·도감.");
    expect(isMonsterRequestTurn(task)).toBe(false);
  });
  it("선언자는 몬스터 도구가 빠진 후보 목록을 받는다", async () => {
    let seen: readonly string[] = [];
    const spy: IntentDeclarer = async (facts) => { seen = facts.toolNames; return fixedDeclarer({ mode: "create" })(facts); };
    await classifyPlainPiTurn({ project: createEmptyToolProject(), text: `${D1} (후보 목록 확인용)`, currentMapId: null, selection: null, hasActivePlan: false, piTeam: false, autonomy: resolveAutonomy("balanced"), declarer: () => spy });
    expect(seen.length).toBeGreaterThan(50);
    expect(seen.filter(isMonsterOnlyTool)).toEqual([]);
  });
});

// ── L09 표지·잠금 부작용(set_encounter_table) ────────────────────────────────────────────────────────
describe("L09 일반 도구가 프로젝트를 몬스터 게임으로 바꾸지 못한다", () => {
  it("JRPG 의 set_encounter_table 은 genre 표지·키트·잠금을 남기지 않는다", () => {
    const ctx = ctxOf(jrpg());
    const result = run(ctx, "set_encounter_table", { mapId: ctx.project.startMapId, entries: [] });
    expect(result.ok, message(result)).toBe(true);
    expect(ctx.project.system.genre).toBeUndefined();
    expect(ctx.project.system.genreLock).toBeUndefined();
    expect(ctx.project.maps[ctx.project.startMapId]!.tilesetId).not.toBe("monster_overworld");
  });
  it("몬스터 요청 턴의 첫 몬스터 도구는 기존대로 표지+키트+잠금을 건다", () => {
    const ctx = ctxOf(jrpg(), { monsterTurn: true });
    expect(run(ctx, "give_starter_monsters", starterArgs(ctx.project)).ok).toBe(true);
    expect(ctx.project.system.genre).toBe("monster-collect");
    expect(ctx.project.system.genreLock?.preset).toBe("monster-collect");
    expect(ctx.project.maps[ctx.project.startMapId]!.tilesetId).toBe("monster_overworld");
  });
});

// ── L10 칩셋 ─────────────────────────────────────────────────────────────────────────────────────────
describe("L10 몬스터 칩셋", () => {
  const createMonsterMap = (ctx: ToolContext) => run(ctx, "create_map", { name: "몬스터 마을", tilesetId: "monster_overworld", width: 20, height: 15 });
  it("JRPG: 몬스터 칩셋 새 맵 거부, 기본·다른 칩셋 맵은 통과", () => {
    const ctx = ctxOf(jrpg());
    const denied = createMonsterMap(ctx);
    expect(denied.ok).toBe(false);
    expect(message(denied)).toContain("monster_overworld");
    expect(Object.values(ctx.project.maps).some((map) => map.tilesetId === "monster_overworld")).toBe(false);
    expect(run(ctx, "create_map", { name: "마을", width: 20, height: 15 }).ok).toBe(true);
  });
  it("몬스터 요청 턴·몬스터 프로젝트: 통과", () => {
    expect(createMonsterMap(ctxOf(jrpg(), { monsterTurn: true })).ok).toBe(true);
    expect(createMonsterMap(ctxOf(monsterProject())).ok).toBe(true);
  });
  it("list_tileset_references 전체 목록에서 몬스터 칩셋이 빠진다", () => {
    const listed = (ctx: ToolContext): string[] => ((run(ctx, "list_tileset_references", {}).data as { tilesets?: { tilesetId: string }[] } | undefined)?.tilesets ?? []).map((entry) => entry.tilesetId);
    const blocked = listed(ctxOf(jrpg()));
    const open = listed(ctxOf(jrpg(), { monsterTurn: true }));
    expect(open.some((id) => /^monster_|^emerald_monster_/u.test(id))).toBe(true);
    expect(blocked.some((id) => /^monster_|^emerald_monster_/u.test(id))).toBe(false);
    expect(blocked.length).toBeLessThan(open.length);
  });
});

// ── L11 캐릭터 칩 ────────────────────────────────────────────────────────────────────────────────────
describe("L11 캐릭터 칩(Scarloxy 트레이너·하네스 몬스터 칩)", () => {
  const scarloxy = { textureKey: "tex_scarloxy_charset_people1", characterIndex: 0 };
  const npc = (ctx: ToolContext, name: string, graphic: Record<string, unknown>) => run(ctx, "place_npc", { mapId: ctx.project.startMapId, name, x: 4, y: 4, graphic });
  it("JRPG: id 로 골라도 거부하고 맵은 그대로", () => {
    const ctx = ctxOf(jrpg());
    const events = ctx.project.maps[ctx.project.startMapId]!.events.length;
    const result = npc(ctx, "트레이너", scarloxy);
    expect(result.ok).toBe(false);
    expect(message(result)).toContain("tex_scarloxy_charset_people1");
    expect(ctx.project.maps[ctx.project.startMapId]!.events.length).toBe(events);
  });
  it("JRPG: 일반 질의는 몬스터 칩이 아닌 칩을 고른다, list_npc_graphics 에도 안 나온다", () => {
    const ctx = ctxOf(jrpg());
    expect(npc(ctx, "주민", { query: "villager" }).ok).toBe(true);
    const sprite = ctx.project.maps[ctx.project.startMapId]!.events.at(-1)!.pages[0]!.graphic.sprite!;
    expect(sprite.id).not.toMatch(/scarloxy/u);
    const list = (extra: Partial<ToolContext>) => JSON.stringify(run(ctxOf(jrpg(), extra), "list_npc_graphics", { query: "trainer" }).data ?? {});
    expect(list({})).not.toMatch(/scarloxy/iu);
    expect(list({ monsterTurn: true })).toMatch(/scarloxy/iu);
  });
  it("몬스터 요청 턴·몬스터 프로젝트·손 편집은 통과", () => {
    expect(npc(ctxOf(jrpg(), { monsterTurn: true }), "트레이너", scarloxy).ok).toBe(true);
    expect(npc(ctxOf(monsterProject()), "트레이너", scarloxy).ok).toBe(true);
    expect(npc(ctxOf(jrpg(), { assistantRun: false }), "트레이너", scarloxy).ok).toBe(true);
  });
});

// ── L12 얼굴·전투 그림·트레이너 그림·전투 배경 ─────────────────────────────────────────────────────────
describe("L12 얼굴·전투 그림·배경", () => {
  const cases: readonly (readonly [string, string, Record<string, unknown>, RegExp])[] = [
    ["Scarloxy 얼굴", "upsert_actor", { actor: { id: "actor_r", name: "라이벌", classId: "class_hero", faceResourceId: "generated-faceset-missing-scarloxy-03" } }, /Scarloxy 트레이너 얼굴/u],
    ["Scarloxy 몬스터 그림", "upsert_enemy", { enemy: { id: "enemy_s", name: "핀", monsterResourceId: "scarloxy-monster-finiette" } }, /몬스터 수집 전투 그림/u],
    ["하네스 몬스터 그림", "upsert_enemy", { enemy: { id: "enemy_h", name: "스파킷", monsterResourceId: "harness-monster-sparkit-front" } }, /몬스터 수집 전투 그림/u],
    ["트레이너 전투 그림", "upsert_troop", { troop: { id: "troop_t", name: "소녀", enemyIds: ["enemy_g"], trainerBattle: true, trainerSprite: { front: "girl" } } }, /트레이너 전투 그림/u],
    ["에메랄드 전투 배경", "upsert_database_utility", { collection: "terrains", record: { id: "terrain_e", name: "숲", damage: 0, encounterRatePercent: 5, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: false }, battleBackgroundResourceId: "emerald:forest" } }, /몬스터 수집 전투 배경/u],
  ];
  const jrpgWithEnemy = (extra: Partial<ToolContext> = {}): ToolContext => {
    const ctx = ctxOf(jrpg(), extra);
    run(ctx, "upsert_enemy", { enemy: { id: "enemy_g", name: "슬라임", monsterResourceId: "generated-enemy-slime-01" } });
    return ctx;
  };
  it.each(cases)("JRPG: %s 거부", (_label, tool, args, pattern) => {
    const result = run(jrpgWithEnemy(), tool, args);
    expect(result.ok, message(result)).toBe(false);
    expect(message(result)).toMatch(pattern);
  });
  it.each(cases.filter((row) => row[1] !== "upsert_troop"))("몬스터 요청 턴: %s 통과", (_label, tool, args) => {
    expect(run(ctxOf(jrpg(), { monsterTurn: true }), tool, args).issues?.[0]?.message ?? "").not.toMatch(/몬스터 수집 잠금/u);
  });
  it("JRPG 의 일반 적 그림·그림 없는 적은 막지 않는다", () => {
    const ctx = ctxOf(jrpg());
    expect(run(ctx, "upsert_enemy", { enemy: { id: "enemy_g", name: "슬라임", monsterResourceId: "generated-enemy-slime-01" } }).ok).toBe(true);
    expect(run(ctx, "upsert_enemy", { enemy: { id: "enemy_b", name: "해골" } }).ok).toBe(true);
  });
  it("명시표: 몬스터 전용 그림 판정", () => {
    const p = jrpg();
    expect(monsterOnlyVisual(p, "face", "generated-faceset-missing-scarloxy-03")).toBe(true);
    expect(monsterOnlyVisual(p, "battler", "scarloxy-monster-finiette")).toBe(true);
    expect(monsterOnlyVisual(p, "backdrop", "emerald:forest")).toBe(true);
    expect(monsterOnlyVisual(p, "battler", "generated-enemy-slime-01")).toBe(false);
    expect(monsterOnlyVisual(p, "backdrop", "battle-scenery-forest")).toBe(false);
    expect(monsterOnlyVisual(p, "backdrop", "easyrpg-backdrop-forest1")).toBe(false);
  });
  it("그림 이름으로 자동 배정할 때도 몬스터 수집 그림은 후보가 아니다(list_resources monster)", () => {
    const list = (extra: Partial<ToolContext>) => ((run(ctxOf(jrpg(), extra), "list_resources", { kind: "monster", query: "*" }).data as { matches?: { id: string }[] } | undefined)?.matches ?? []).map((match) => match.id);
    const blocked = list({});
    expect(blocked.some((id) => /^(?:scarloxy-monster-|harness-monster-)/u.test(id))).toBe(false);
  });
});

// ── L13 전투 스킨·전투 규칙 ──────────────────────────────────────────────────────────────────────────
describe("L13 전투 스킨(pokemon)·전투 규칙(gen1)·시스템 필드", () => {
  it("JRPG: set_project_settings 로 포켓몬 전투 화면을 켜는 것은 diff 판정이 거부", () => {
    const ctx = ctxOf(jrpg());
    const result = run(ctx, "set_project_settings", { battle: { uiStyle: "pokemon" } });
    expect(result.ok).toBe(false);
    expect(message(result)).toContain("시스템 설정");
    expect(ctx.project.system.battleUiStyle).not.toBe("pokemon");
  });
  it("몬스터 요청 턴이면 통과", () => {
    const ctx = ctxOf(jrpg(), { monsterTurn: true });
    expect(run(ctx, "set_project_settings", { battle: { uiStyle: "pokemon" } }).ok).toBe(true);
    expect(ctx.project.system.battleUiStyle).toBe("pokemon");
  });
  it("monsterSystemFieldChanges 는 새로 켜진 필드만 센다", () => {
    const a = jrpg(); const b = structuredClone(a);
    b.system.genre = "monster-collect"; b.system.battleModel = "gen1"; b.system.battleUiStyle = "pokemon"; b.system.monsterCollection = true;
    expect(monsterSystemFieldChanges(a, b)).toEqual(expect.arrayContaining(["system.genre=monster-collect", "system.battleModel=gen1", "system.battleUiStyle=pokemon", "system.monsterCollection"]));
    expect(monsterSystemFieldChanges(b, b)).toEqual([]);
  });
});

// ── L14 공용 장소·기물 목록 ─────────────────────────────────────────────────────────────────────────
describe("L14 공용 장소·기물 검색", () => {
  const rows = (ctx: ToolContext) => ((run(ctx, "list_spatial_designs", { kind: "object", query: "monster_climate", limit: 50 }).data as { shared?: { total: number; rows: { tilesetId: string }[] } } | undefined)?.shared);
  it("JRPG 에서는 몬스터 칩셋 기물이 검색에 나오지 않고, 몬스터 요청 턴에는 나온다", () => {
    const blocked = rows(ctxOf(jrpg()));
    const open = rows(ctxOf(jrpg(), { monsterTurn: true }));
    expect(open!.total).toBeGreaterThan(0);
    expect(blocked!.rows.some((row) => /^monster_|^emerald_monster_/u.test(row.tilesetId))).toBe(false);
    expect(blocked!.total).toBeLessThan(open!.total);
  });
});

// ── L15 gameCheck ───────────────────────────────────────────────────────────────────────────────────
describe("L15 완료 검사(gameCheck isMonsterGame)", () => {
  it("JRPG 에는 센터·도감·배지 요구가 없다", () => {
    expect(checkMonster(jrpg())).toEqual([]);
  });
  it("장르 잠금만 monster-collect 인 프로젝트도 몬스터 게임으로 검사한다(역방향 잠금과 같은 판정)", () => {
    const p = jrpg(); p.system.genreLock = { preset: "monster-collect", mode: "enforce" } as never;
    expect(isDeclaredMonsterGame(p)).toBe(true);
    expect(checkMonster(p).length).toBeGreaterThan(0);
  });
});

// ── L16 check_genre_lock 보고 ───────────────────────────────────────────────────────────────────────
describe("L16 check_genre_lock", () => {
  it("JRPG: 몬스터 도구 이름을 광고하지 않고 몬스터 자산 막힘 상태를 보고한다", () => {
    const result = run(ctxOf(jrpg()), "check_genre_lock", {});
    expect(result.summary).not.toContain("configure_monster_system");
    expect(result.summary).toContain("몬스터 자산: 막힘");
    expect((result.data as { monsterAssets: { allowed: boolean } }).monsterAssets.allowed).toBe(false);
  });
  it("몬스터 프로젝트·요청 턴은 허용으로 보고한다", () => {
    expect(monsterAssetStatus(monsterProject()).allowed).toBe(true);
    expect(monsterAssetStatus(jrpg(), { monsterTurn: true }).allowed).toBe(true);
    expect(monsterAssetStatus(jrpg()).reason).toContain("손 편집은 막지 않는다");
  });
});

// ── L17 분류기 정밀도(JRPG 문장이 몬스터 요청으로 새면 도구가 풀린다) ───────────────────────────────────────
describe("L17 몬스터 요청 분류기", () => {
  const jrpgSentences = [
    "크로노 트리거처럼 과거·현재·미래를 시간의 문으로 오가는 시간여행 JRPG 만들어 줘. 시대마다 풍경이 달랐으면 좋겠어",
    "파이널판타지6 같은 게임 만들어 줘. 세계가 한 번 무너지고, 흩어진 동료들을 다시 모으는 이야기로",
    "고대, 중세, 먼 미래 세 시대를 오가며 세상의 멸망을 막는 RPG를 만들고 싶어요. 동료도 시대마다 만나고요",
    "마법으로 평화롭던 세계가 무너져서 폐허가 된 뒤에 동료 모아서 반격하는 대작 JRPG 부탁해요. 비공정 같은 탈것도 있으면 좋겠어요",
    "동료를 모아 마을과 마을 사이를 오가며 마왕을 쓰러뜨리는 JRPG 만들어줘",
    "용사 파티가 배틀을 거쳐 동료를 모으는 FF풍 RPG 게임 만들어줘",
  ];
  it.each(jrpgSentences)("JRPG 문장은 몬스터 요청 턴이 아니다: %s", (text) => {
    expect(hasMonsterCollectIntent(text)).toBe(false);
    expect(classifyMonsterGameRequest(text, true)).toBeNull();
    expect(isMonsterRequestTurn(text)).toBe(false);
  });
  const monsterSentences = [
    "포켓몬 같은 몬스터 수집 게임 만들어 줘", "체육관 도는 게임", "몬스터를 잡아서 키우는 게임", "monster taming adventure with gyms", "용사가 몬스터를 포획해 동료로 삼는 JRPG 만들어 줘",
    "마을 사이를 오가며 동료를 모으는 게임", "포획 없는 대회형 몬스터 배틀 게임 만들어 줘",
  ];
  it.each(monsterSentences)("몬스터 요청은 첫 턴부터 도구가 풀린다: %s", (text) => {
    expect(isMonsterRequestTurn(text)).toBe(true);
  });
  it("그냥 「몬스터」(적·사냥터·몬스터 헌터)는 요청이 아니다 — 막지 않는다", () => {
    for (const text of ["던전에 몬스터 배치해 줘", "몬스터를 쓰러뜨리는 던전 RPG", "몬스터 헌터 같은 RPG 만들어 줘", "필드에 몬스터 적을 세 마리 놓아 줘", "몬스터 체력을 두 배로 올려 줘"]) {
      expect(hasMonsterCollectIntent(text), text).toBe(false);
    }
  });
});

// ── R1 기존 몬스터 프로젝트 불변 ─────────────────────────────────────────────────────────────────────
describe("R1 기존 프로젝트 불변(몬스터 게임을 하고 있는 프로젝트는 아무것도 막히지 않는다)", () => {
  const variants: readonly (readonly [string, (p: Project) => void])[] = [
    ["genre 표지", (p) => { p.system.genre = "monster-collect"; }],
    ["장르 잠금 프리셋", (p) => { p.system.genreLock = { preset: "monster-collect", mode: "enforce" } as never; }],
    ["monsterCollection", (p) => { p.system.monsterCollection = true; }],
    ["포획 없는 몬스터 파티 전투", (p) => { p.system.monsterCollection = false; p.system.monsterBattleParty = true; }],
    ["몬스터 파티 전투", (p) => { p.system.monsterBattleParty = true; }],
    ["몬스터 원정 정의", (p) => { p.system.monsterCampaign = { badges: [] } as never; }],
    ["몬스터 칩셋 맵", (p) => { p.maps[p.startMapId]!.tilesetId = "monster_overworld"; }],
    ["기획 프리셋", (p) => { p.gameDesignBrief = { presetId: "monster-collect" } as never; }],
  ];
  it.each(variants)("증거: %s → 몬스터 자산 허용", (_label, apply) => {
    const p = jrpg(); apply(p);
    expect(projectHasMonsterGameEvidence(p)).toBe(true);
    expect(monsterAssetsAllowed(p)).toBe(true);
  });
  it.each(variants)("증거: %s → 전용 도구·칩셋·칩이 막히지 않는다(요청 턴 신호 없이)", (_label, apply) => {
    const p = jrpg(); apply(p);
    const ctx = ctxOf(p);
    expect(run(ctx, "place_monster_center", { mapId: p.startMapId, x: 3, y: 3 }).issues?.[0]?.message ?? "").not.toMatch(/몬스터 수집 잠금/u);
    expect(names(createPiToolset(ctxOf(p))).filter(isMonsterOnlyTool)).toHaveLength(MONSTER_ONLY_TOOLS.length);
    expect(run(ctxOf(p), "create_map", { name: "몬스터 마을 2", tilesetId: "monster_overworld", width: 20, height: 15 }).issues?.[0]?.message ?? "").not.toMatch(/몬스터 수집 잠금/u);
  });
  it("기본 프로젝트가 싣고 있는 종 10개·몬스터 칩셋 정의는 증거가 아니다", () => {
    const p = jrpg();
    expect(p.database.monsterSpecies!.length).toBeGreaterThan(0);
    expect(Object.keys(p.tilesets).some((id) => /monster/u.test(id))).toBe(true);
    expect(projectHasMonsterGameEvidence(p)).toBe(false);
  });
  it("이미 들어 있는 몬스터 그림은 막힌 프로젝트에서도 다른 도구가 건드리지 않는다(새로 고르는 것만 거부)", () => {
    const p = jrpg();
    p.database.enemies.push({ id: "enemy_old_mon", name: "옛 핀", monsterResourceId: "scarloxy-monster-finiette" } as never);
    const ctx = ctxOf(p);
    expect(run(ctx, "upsert_enemy", { enemy: { id: "enemy_old_mon", name: "옛 핀 개명", monsterResourceId: "scarloxy-monster-finiette" } }).ok).toBe(true);
    expect(run(ctx, "upsert_enemy", { enemy: { id: "enemy_new_mon", name: "새 핀", monsterResourceId: "scarloxy-monster-finiette" } }).ok).toBe(false);
  });
  it("기존 몬스터 프로젝트의 몬스터 요청은 그대로 첫 턴부터 풀려 있다", async () => {
    const result = await classifyPlainPiTurn({
      project: monsterProject(), text: "체육관 하나 더 추가해 줘", currentMapId: null, selection: null, hasActivePlan: false, piTeam: false,
      autonomy: resolveAutonomy("balanced"), declarer: () => fixedDeclarer({ mode: "modify", tools: ["place_trainer", "place_badge_gate"] }),
    });
    expect(result.initialToolNames).toEqual(expect.arrayContaining(["place_trainer", "place_badge_gate"]));
  });
});

// ── R2 몬스터 요청 첫 턴(빈 프로젝트에서도) ───────────────────────────────────────────────────────────
describe("R2 몬스터 요청은 첫 턴부터 동작한다(분류 → monsterKit 경로)", () => {
  it("빈 프로젝트 + 몬스터 요청 턴: 스타터·센터·트레이너가 한 턴 안에 모두 선다", () => {
    const ctx = ctxOf(jrpg(), { monsterTurn: true });
    expect(run(ctx, "give_starter_monsters", starterArgs(ctx.project)).ok).toBe(true);
    const species = ctx.project.database.monsterSpecies![0]!.id;
    const center = run(ctx, "place_monster_center", { mapId: ctx.project.startMapId, x: 3, y: 3 });
    expect(center.issues?.[0]?.message ?? "").not.toMatch(/몬스터 수집 잠금/u);
    const trainer = run(ctx, "place_trainer", { mapId: ctx.project.startMapId, x: 9, y: 6, name: "트레이너", team: [{ speciesId: species, level: 5 }] });
    expect(trainer.issues?.[0]?.message ?? "").not.toMatch(/몬스터 수집 잠금/u);
  });
  it("한 줄 요청이 같은 판정으로 monsterKit 과 요청 턴 둘 다 켠다", () => {
    for (const text of ["포켓몬 라이크 만들어 줘", "몬스터 도감 채우는 게임 만들어줘", "장르 프리셋: 몬스터 수집", "/goal 장르 프리셋: 몬스터 수집 — 첫 게임을 만들어줘"]) {
      expect(isMonsterRequestTurn(text), text).toBe(true);
    }
  });
});

// ── R3 일반 RPG 의 몬스터(적·사냥터)는 막지 않는다 ──────────────────────────────────────────────────────
describe("R3 일반 RPG 의 적·사냥터·조우 도구는 열려 있다", () => {
  const open = ["author_wild_route", "upsert_enemy", "upsert_troop", "place_npc", "set_encounter_table", "make_hunting_ground", "place_field_enemy", "author_dungeon"];
  it.each(open)("%s 는 전용 표에 없다", (name) => {
    expect(isMonsterOnlyTool(name)).toBe(false);
  });
  it("JRPG 에서 적·조우 도구가 노출된다", () => {
    const exposed = names(createPiToolset(ctxOf(jrpg())));
    for (const name of open) expect(exposed, name).toContain(name);
  });
});

// ── R4 손 편집은 막지 않는다 ─────────────────────────────────────────────────────────────────────────
describe("R4 편집기 손 편집·스크립트(assistantRun 아님)는 막지 않는다", () => {
  it("전용 도구·칩셋·칩·그림이 그대로 된다", () => {
    const ctx = ctxOf(jrpg(), { assistantRun: false });
    expect(run(ctx, "create_map", { name: "몬스터 마을", tilesetId: "monster_overworld", width: 20, height: 15 }).ok).toBe(true);
    expect(run(ctx, "place_monster_center", { mapId: ctx.project.startMapId, x: 3, y: 3 }).issues?.[0]?.message ?? "").not.toMatch(/몬스터 수집 잠금/u);
    expect(run(ctx, "upsert_enemy", { enemy: { id: "enemy_s", name: "핀", monsterResourceId: "scarloxy-monster-finiette" } }).ok).toBe(true);
  });
});

afterEach(() => resetMapEditHistory());
