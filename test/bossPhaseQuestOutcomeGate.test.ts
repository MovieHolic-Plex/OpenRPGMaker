// test/bossPhaseQuestOutcomeGate.test.ts
//
// 보스 페이즈 / 퀘스트 산출물 게이트.
//
// 배경(2026-08-24 감사): 두 축 모두 엔진은 다 있는데 "썼다"에서 멈췄다.
//  - 전투 이벤트 페이지는 upsert_troop 의 자유 객체로 무검증 저장됐고, 발동 여부는 아무도 안 봤다.
//  - 퀘스트 툴(create_quest/define_quest/verify_quest)은 실제 생성 세션에서 호출 0회였다.
// 여기서는 실제 툴 실행기로 저작한 뒤, 게이트가 "발동 확인 없음 / 완주 불가"를 잡는지 본다.

import { describe, expect, it } from "vitest";
import {
  authoredQuestIdFrom,
  authoredTroopIdFrom,
  battlePhaseSimulationFrom,
  verifyAuthoredBossPhases,
  verifyAuthoredQuestsPlayable,
  type BattlePhaseSimulation,
} from "@/ai/workItemOutcome";
import { simulateBattle } from "@/battle/simulate";
import { runTool } from "@/editor/tools/toolRunner";
import { createEmberQuestProject } from "@/project/defaults/emberQuestGame";
import type { Project } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";

const TROOP = "troop_dragon";

function emberCtx(): ToolContext {
  return { project: createEmberQuestProject() };
}

/** author_boss_phases 로 HP 임계 페이즈를 깐다(실제 툴 — 테스트가 페이지 모양을 흉내내지 않는다). */
function authorPhases(ctx: ToolContext, thresholds: readonly number[]): void {
  const result = runTool(
    ctx,
    "author_boss_phases",
    {
      troopId: TROOP,
      phases: thresholds.map((atHpPercent, index) => ({
        atHpPercent,
        name: `페이즈 ${index + 1}`,
        message: `드래곤이 포효한다! (${atHpPercent}%)`,
      })),
    },
    { dryRun: false },
  );
  expect(result.ok, JSON.stringify(result.issues ?? result.summary)).toBe(true);
}

/** simulate_battle 을 실제로 돌려 게이트가 받을 근거를 만든다. */
function simulationEvidence(project: Project, heroLevel = 3): Map<string, BattlePhaseSimulation> {
  const ctx: ToolContext = { project };
  const result = runTool(ctx, "simulate_battle", { troopId: TROOP, heroLevel, n: 12, seed: 4242 }, { dryRun: false });
  expect(result.ok).toBe(true);
  const evidence = battlePhaseSimulationFrom("simulate_battle", { troopId: TROOP, heroLevel }, result.data);
  expect(evidence).not.toBeNull();
  return new Map([[TROOP, evidence!]]);
}

describe("보스 페이즈 게이트 — 페이지를 썼다 ≠ 연출이 떴다", () => {
  it("페이지를 안 쓴 항목은 아무것도 검사하지 않는다", () => {
    expect(verifyAuthoredBossPhases(createEmberQuestProject(), [], new Map()).ok).toBe(true);
  });

  it("simulate_battle 근거가 없으면 완료를 막고 돌릴 명령을 알려준다", () => {
    const ctx = emberCtx();
    authorPhases(ctx, [70, 40]);
    const verdict = verifyAuthoredBossPhases(ctx.project, [TROOP], new Map());
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain("simulate_battle");
    expect(verdict.reason).toContain(TROOP);
  });

  it("도달 가능한 임계는 시뮬 근거와 함께 통과한다", () => {
    const ctx = emberCtx();
    authorPhases(ctx, [80, 50]);
    const evidence = simulationEvidence(ctx.project);
    expect(evidence.get(TROOP)!.silentPageIds).toEqual([]);
    expect(verifyAuthoredBossPhases(ctx.project, [TROOP], evidence).ok).toBe(true);
  });

  it("한 판도 발동하지 않은 페이즈는 완료를 막는다", () => {
    const ctx = emberCtx();
    // 99라운드 조건 — 전투는 그 전에 끝나므로 이 연출은 영원히 안 뜬다(정적 검증으로는 못 잡는 결함).
    const written = runTool(
      ctx,
      "upsert_troop_battle_page",
      {
        troopId: TROOP,
        page: {
          id: "page_never",
          name: "절대 안 뜨는 연출",
          conditions: [{ kind: "onRound", round: 99 }],
          span: "battle",
          commands: [{ kind: "text", body: "99라운드!" }],
        },
      },
      { dryRun: false },
    );
    expect(written.ok, JSON.stringify(written.issues ?? written.summary)).toBe(true);
    const evidence = simulationEvidence(ctx.project, 20);
    expect(evidence.get(TROOP)!.silentPageIds.length).toBeGreaterThan(0);
    const verdict = verifyAuthoredBossPhases(ctx.project, [TROOP], evidence);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain("한 번도 발동하지 않은");
  });

  it("나중에 편성에서 빠진 적을 보는 페이지는 완료를 막는다", () => {
    const ctx = emberCtx();
    authorPhases(ctx, [60]);
    const evidence = simulationEvidence(ctx.project);
    const troop = ctx.project.database.troops.find((entry) => entry.id === TROOP)!;
    troop.enemyIds = [];
    troop.members = [];
    const verdict = verifyAuthoredBossPhases(ctx.project, [TROOP], evidence);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain("편성에 없는 적");
  });

  it("페이지가 사라진 트룹도 완료를 막는다", () => {
    const ctx = emberCtx();
    authorPhases(ctx, [60]);
    const evidence = simulationEvidence(ctx.project);
    const troop = ctx.project.database.troops.find((entry) => entry.id === TROOP)!;
    troop.battleEventPages = [];
    const verdict = verifyAuthoredBossPhases(ctx.project, [TROOP], evidence);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain("author_boss_phases");
  });

  it("simulate_battle 은 페이즈 발동을 판 단위로 집계한다", () => {
    const ctx = emberCtx();
    authorPhases(ctx, [80, 50]);
    const result = simulateBattle({ project: ctx.project, troopId: TROOP, heroLevel: 3, n: 10, seed: 99 });
    expect(result.phaseCoverage.length).toBe(2);
    for (const phase of result.phaseCoverage) {
      expect(phase.firedRuns).toBeGreaterThan(0);
      expect(phase.firedRuns).toBeLessThanOrEqual(result.samples);
      expect(phase.unsupported).toBe(0);
    }
  });
});

describe("추적 헬퍼", () => {
  it("페이즈 저작 툴에서 troopId 를 뽑는다", () => {
    expect(authoredTroopIdFrom("author_boss_phases", { troopId: "t1" }, undefined)).toBe("t1");
    expect(authoredTroopIdFrom("upsert_troop_battle_page", {}, { troopId: "t2" })).toBe("t2");
    expect(authoredTroopIdFrom("upsert_troop", { troopId: "t3" }, undefined)).toBeNull();
  });

  it("퀘스트 등록 툴에서 questId 를 뽑는다", () => {
    expect(authoredQuestIdFrom("create_quest", { def: { key: "errand" } })).toBe("errand");
    expect(authoredQuestIdFrom("define_quest", { id: "q_graph" })).toBe("q_graph");
    expect(authoredQuestIdFrom("lint_quest", { questId: "q_graph" })).toBeNull();
  });

  it("simulate_battle 이 아닌 결과는 근거로 쓰지 않는다", () => {
    expect(battlePhaseSimulationFrom("tune_enemy", { troopId: TROOP }, { phaseCoverage: [] })).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────

const QUEST_KEY = "mayor_errand";
const QUEST_GRAPH_ID = `${QUEST_KEY}_graph`;

const STARTED = `sw_${QUEST_KEY}_started`;
const STEP0 = `sw_${QUEST_KEY}_step0`;

/** create_quest 로 퀘스트를 컴파일한다(기버 NPC + reach 단계 이벤트를 실제로 깐다). */
function compileErrand(ctx: ToolContext): void {
  const mapId = ctx.project.startMapId;
  const result = runTool(
    ctx,
    "create_quest",
    {
      def: {
        key: QUEST_KEY,
        title: "촌장의 부탁",
        summary: "촌장이 마을 밖 상황을 확인해 달라고 한다.",
        giver: { create: { mapId, x: 17, y: 14, name: "촌장" } },
        steps: [{ kind: "reach", mapId, x: 18, y: 15 }],
      },
    },
    { dryRun: false },
  );
  expect(result.ok, JSON.stringify(result.issues ?? result.summary)).toBe(true);
}

interface GraphNode {
  readonly id: string;
  readonly description: string;
  readonly completesWhen: unknown;
}

function defineErrandGraph(ctx: ToolContext, nodes: readonly GraphNode[], edges: readonly { from: string; to: string }[]): void {
  const result = runTool(
    ctx,
    "define_quest",
    { id: QUEST_GRAPH_ID, title: "촌장의 부탁", nodes, edges },
    { dryRun: false },
  );
  expect(result.ok, JSON.stringify(result.issues ?? result.summary)).toBe(true);
}

const switchOn = (switchId: string) => ({ kind: "switch", switchId, value: true });

/** 기버 대화 → 목표 도달. 컴파일된 스위치를 그대로 노드로 옮긴 정상 그래프. */
function defineFullErrandGraph(ctx: ToolContext): void {
  defineErrandGraph(
    ctx,
    [
      { id: "talk-chief", description: "촌장과 대화한다", completesWhen: switchOn(STARTED) },
      { id: "reach-outskirts", description: "마을 밖으로 나간다", completesWhen: switchOn(STEP0) },
    ],
    [{ from: "talk-chief", to: "reach-outskirts" }],
  );
}

describe("퀘스트 게이트 — 컴파일됐다 ≠ 완주 가능하다", () => {
  it("퀘스트를 안 만든 항목은 아무것도 검사하지 않는다", () => {
    expect(verifyAuthoredQuestsPlayable(createEmberQuestProject(), []).ok).toBe(true);
  });

  it("메타가 없는 id 는 완료를 막는다", () => {
    const verdict = verifyAuthoredQuestsPlayable(createEmberQuestProject(), ["q_ghost"]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain("project.quests");
  });

  it("create_quest 만 부르면 그래프가 없어 검증 불가로 막는다", () => {
    const ctx = emberCtx();
    compileErrand(ctx);
    const verdict = verifyAuthoredQuestsPlayable(ctx.project, [QUEST_KEY]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain("자동 완주 미검증");
    expect(verdict.reason).toContain("동일 ID로 define_quest");
    expect(verdict.reason).toContain("허용되지 않습니다");
    expect(verdict.reason).not.toContain("define_quest{");
  });

  it("나중에 write site 이벤트가 지워지면 lint 오류로 막는다", () => {
    const ctx = emberCtx();
    compileErrand(ctx);
    defineFullErrandGraph(ctx);
    // 다른 항목이 목표 지점 이벤트를 지우면 그래프는 그대로 남고 퀘스트만 조용히 죽는다.
    const map = ctx.project.maps[ctx.project.startMapId]!;
    map.events = map.events.filter((event) => event.id !== `ev_${QUEST_KEY}_reach0`);
    const verdict = verifyAuthoredQuestsPlayable(ctx.project, [QUEST_GRAPH_ID]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain("lint error");
  });

  it("선행 단계를 빼먹은 그래프는 씬 완주 실패로 막는다", () => {
    const ctx = emberCtx();
    compileErrand(ctx);
    // reach 이벤트는 '퀘스트 시작' 스위치가 켜져야 단계를 올린다 — 기버 노드를 빼면 완주가 안 된다.
    defineErrandGraph(ctx, [{ id: "reach-outskirts", description: "마을 밖으로 나간다", completesWhen: switchOn(STEP0) }], []);
    const verdict = verifyAuthoredQuestsPlayable(ctx.project, [QUEST_GRAPH_ID]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toContain("완주 실패");
    expect(verdict.reason).toContain("verify_quest");
  });

  it("기버 대화 → 목표 도달을 모두 담은 그래프는 완주 검증을 통과한다", () => {
    const ctx = emberCtx();
    compileErrand(ctx);
    defineFullErrandGraph(ctx);
    const verdict = verifyAuthoredQuestsPlayable(ctx.project, [QUEST_GRAPH_ID]);
    expect(verdict.ok, verdict.ok ? "" : verdict.reason).toBe(true);
  });
});
