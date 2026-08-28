// test/troopBattlePageTools.test.ts
//
// 보스 페이즈 저작 툴 검증.
//
// 왜 필요했나: battleEventPages 는 upsert_troop 의 `additionalProperties:true` 자유 객체였다.
// 조건 kind 오타·빈 commands·무한 반복 조합이 아무 검증 없이 저장되고, 런타임은 페이지를 조용히
// 무시하거나(unsupported) 매 평가마다 같은 대사를 도배한다. 저작자는 "성공" 요약만 보고 넘어간다.
// 이제 페이지는 전용 툴로만 들어가고, 아래 계약이 저작 시점에 강제된다.

import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { createEmberQuestProject } from "@/project/defaults/emberQuestGame";
import { simulateBattle } from "@/battle/simulate";
import type { ToolContext } from "@/editor/tools/types";

const TROOP = "troop_dragon";
const ENEMY = "enemy_dragon";

function ctx(): ToolContext {
  return { project: createEmberQuestProject() };
}

function pages(context: ToolContext) {
  return context.project.database.troops.find((troop) => troop.id === TROOP)!.battleEventPages ?? [];
}

const upsert = (context: ToolContext, page: unknown) =>
  runTool(context, "upsert_troop_battle_page", { troopId: TROOP, page }, { dryRun: false });

describe("upsert_troop_battle_page — 조건/커맨드 검증", () => {
  it("정상 페이지는 저장되고 트룹에 붙는다", () => {
    const context = ctx();
    const result = upsert(context, {
      id: "dragon_enrage",
      name: "광폭화",
      conditions: [{ kind: "enemyHpBelow", enemyId: ENEMY, percent: 50 }],
      span: "battle",
      commands: [{ kind: "text", body: "크아악!" }],
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    expect(pages(context).map((page) => page.id)).toContain("dragon_enrage");
  });

  it("빈 commands 는 거부한다(런타임이 레거시 폴백으로 빠진다)", () => {
    const result = upsert(ctx(), { id: "empty", conditions: [], commands: [] });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.issues)).toContain("commands가 비었습니다");
  });

  it("알 수 없는 조건 kind 는 거부하고 허용 목록을 알려준다", () => {
    const result = upsert(ctx(), {
      id: "typo",
      conditions: [{ kind: "enemyHpUnder", enemyId: ENEMY, percent: 50 }],
      commands: [{ kind: "text", body: "x" }],
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.issues)).toContain("enemyHpBelow");
  });

  it("트룹에 없는 적을 보는 조건은 거부한다(절대 발동하지 않는 페이지)", () => {
    const result = upsert(ctx(), {
      id: "wrong_enemy",
      conditions: [{ kind: "enemyHpBelow", enemyId: "enemy_slime", percent: 50 }],
      commands: [{ kind: "text", body: "x" }],
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.issues)).toContain("트룹");
  });

  it("HP 조건만 달고 1회성이 아니면 무한 반복으로 거부한다", () => {
    const result = upsert(ctx(), {
      id: "spam",
      conditions: [{ kind: "enemyHpBelow", enemyId: ENEMY, percent: 50 }],
      span: "turn",
      runOnce: false,
      commands: [{ kind: "text", body: "도배" }],
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.issues)).toContain("무한 반복");
  });

  it("라운드 조건을 함께 달면 반복 페이지도 허용한다(라운드당 1회)", () => {
    const context = ctx();
    const result = upsert(context, {
      id: "each_round",
      conditions: [{ kind: "everyRound", start: 2, interval: 2 }],
      span: "turn",
      runOnce: false,
      commands: [{ kind: "text", body: "숨을 고른다" }],
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  });

  it("같은 id 로 다시 부르면 교체한다(중복 누적 없음)", () => {
    const context = ctx();
    upsert(context, { id: "dup", conditions: [], commands: [{ kind: "text", body: "1" }] });
    const second = upsert(context, { id: "dup", conditions: [], commands: [{ kind: "text", body: "2" }] });
    expect(second.ok).toBe(true);
    expect(pages(context).filter((page) => page.id === "dup").length).toBe(1);
  });

  it("delete_troop_battle_page 로 지운다", () => {
    const context = ctx();
    upsert(context, { id: "gone", conditions: [], commands: [{ kind: "text", body: "1" }] });
    const removed = runTool(context, "delete_troop_battle_page", { troopId: TROOP, pageId: "gone" }, { dryRun: false });
    expect(removed.ok).toBe(true);
    expect(pages(context).map((page) => page.id)).not.toContain("gone");
  });
});

describe("upsert_troop 은 더 이상 battleEventPages 를 받지 않는다", () => {
  it("무검증 저장 경로를 막고 전용 툴로 보낸다", () => {
    const result = runTool(
      ctx(),
      "upsert_troop",
      { troop: { id: TROOP, battleEventPages: [{ id: "raw", conditions: [{ kind: "nonsense" }], commands: [] }] } },
      { dryRun: false },
    );
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.issues)).toContain("author_boss_phases");
  });
});

describe("author_boss_phases — 선언적 페이즈 컴파일", () => {
  const phases = (context: ToolContext, args: Record<string, unknown>) =>
    runTool(context, "author_boss_phases", { troopId: TROOP, ...args }, { dryRun: false });

  it("HP 임계마다 1회성 페이지를 만든다", () => {
    const context = ctx();
    const result = phases(context, {
      phases: [
        { atHpPercent: 70, name: "1차 각성", message: "제법이군…" },
        { atHpPercent: 30, name: "광폭화", message: "끝이다!" },
      ],
    });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    const authored = pages(context);
    expect(authored.map((page) => page.id)).toEqual([`${TROOP}_phase1`, `${TROOP}_phase2`]);
    expect(authored.every((page) => page.runOnce === true)).toBe(true);
    expect(authored[0]!.conditions[0]).toMatchObject({ kind: "enemyHpBelow", enemyId: ENEMY, percent: 70 });
    // 저작만으로는 발동을 알 수 없다 — 툴이 직접 시뮬 확인을 요구한다.
    expect(JSON.stringify(result.diff?.warnings ?? [])).toContain("simulate_battle");
  });

  it("임계가 내림차순이 아니면 거부한다", () => {
    const result = phases(ctx(), { phases: [{ atHpPercent: 30, message: "a" }, { atHpPercent: 70, message: "b" }] });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.issues)).toContain("내림차순");
  });

  it("효과가 하나도 없는 페이즈는 거부한다", () => {
    const result = phases(ctx(), { phases: [{ atHpPercent: 50 }] });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.issues)).toContain("실제 효과가 없습니다");
  });

  it("없는 상태 id 를 광폭화로 걸면 거부하고 만들 툴을 알려준다", () => {
    const result = phases(ctx(), { phases: [{ atHpPercent: 50, enrageStateId: "state_nope" }] });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.issues)).toContain("upsert_state");
  });

  it("숨은 멤버가 아닌 적을 등장시키려 하면 거부한다", () => {
    const result = phases(ctx(), { phases: [{ atHpPercent: 50, summonEnemyId: "enemy_slime" }] });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.issues)).toContain("hidden:true");
  });

  it("회복 %는 maxHp 기준 절대값 m2 커맨드로 환산된다", () => {
    const context = ctx();
    expect(phases(context, { phases: [{ atHpPercent: 40, healPercent: 20 }] }).ok).toBe(true);
    const enemy = context.project.database.enemies.find((entry) => entry.id === ENEMY)!;
    const command = pages(context)[0]!.commands[0] as { kind: string; commandId?: string; fields?: Record<string, unknown> };
    expect(command.kind).toBe("m2Command");
    expect(command.commandId).toBe("m2-098-change-enemy-hp");
    expect(command.fields?.value).toBe(Math.round((enemy.stats.maxHp * 20) / 100));
  });

  it("재호출은 멱등이고 수동 페이지는 보존한다", () => {
    const context = ctx();
    upsert(context, { id: "manual_intro", conditions: [], commands: [{ kind: "text", body: "전투 시작" }] });
    phases(context, { phases: [{ atHpPercent: 70, message: "a" }, { atHpPercent: 30, message: "b" }] });
    phases(context, { phases: [{ atHpPercent: 50, message: "하나로 줄였다" }] });
    const ids = pages(context).map((page) => page.id);
    expect(ids).toContain("manual_intro");
    expect(ids).toContain(`${TROOP}_phase1`);
    expect(ids).not.toContain(`${TROOP}_phase2`);
  });

  it("저작한 페이즈는 시뮬레이션에서 실제로 발동한다", () => {
    const context = ctx();
    phases(context, { phases: [{ atHpPercent: 80, message: "1" }, { atHpPercent: 40, message: "2" }] });
    const result = simulateBattle({ project: context.project, troopId: TROOP, heroLevel: 3, n: 10, seed: 31337 });
    expect(result.phaseCoverage.map((phase) => phase.pageId)).toEqual([`${TROOP}_phase1`, `${TROOP}_phase2`]);
    expect(result.phaseCoverage.every((phase) => phase.firedRuns > 0)).toBe(true);
  });
});
