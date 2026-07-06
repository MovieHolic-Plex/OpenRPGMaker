// test/battleSimulate.test.ts
// 헤드리스 전투 시뮬레이터 + tune_enemy 검증. 시드 고정으로 재현성 확보.

import { describe, expect, it } from "vitest";
import { computeEnemyTuning, simulateBattle } from "@/battle/simulate";
import { createEmberQuestProject } from "@/project/defaults/emberQuestGame";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";

describe("battleSimulate", () => {
  const project = createEmberQuestProject();

  it("슬라임 트룹은 Lv1 영웅에게 승률 ≥ 0.9", () => {
    const result = simulateBattle({ project, troopId: "troop_slime_pair", heroLevel: 1, n: 30, seed: 12345 });
    expect(result.samples).toBe(30);
    expect(result.winRate).toBeGreaterThanOrEqual(0.9);
    expect(result.avgTurns).toBeGreaterThan(0);
  });

  it("드래곤 트룹은 슬라임보다 체감 난이도가 높다(잔여 HP가 더 낮다)", () => {
    // Lv1 단일 영웅은 두 전투 모두 이기지만, 드래곤전이 훨씬 큰 피해를 남긴다.
    const slime = simulateBattle({ project, troopId: "troop_slime_pair", heroLevel: 1, n: 30, seed: 777 });
    const dragon = simulateBattle({ project, troopId: "troop_dragon", heroLevel: 1, n: 30, seed: 777 });
    expect(dragon.avgHpRemaining).toBeLessThan(slime.avgHpRemaining);
    expect(dragon.winRate).toBeLessThanOrEqual(slime.winRate);
  });

  it("tune_enemy로 드래곤을 치명적으로 만들면 Lv1 무포션 승률이 슬라임보다 낮아진다", () => {
    const ctx: ToolContext = { project: createEmberQuestProject() };
    // 12타에 죽고 매 턴 300 피해 → Lv1 영웅(HP514)에게 사실상 필패 밸런스.
    const tuned = runTool(ctx, "tune_enemy", { enemyId: "enemy_dragon", targetHitsToKill: 12, targetDamageToHeroPerHit: 300, heroLevel: 1 }, { dryRun: false });
    expect(tuned.ok).toBe(true);
    const slime = simulateBattle({ project: ctx.project, troopId: "troop_slime_pair", heroLevel: 1, n: 30, seed: 777 });
    const dragon = simulateBattle({ project: ctx.project, troopId: "troop_dragon", heroLevel: 1, n: 30, seed: 777 });
    expect(dragon.winRate).toBeLessThan(slime.winRate);
    expect(dragon.winRate).toBeLessThan(0.5);
  });

  it("동일 시드는 동일 결과(재현성) + Math.random 원복", () => {
    const before = Math.random;
    const a = simulateBattle({ project, troopId: "troop_slime_pair", heroLevel: 1, n: 20, seed: 42 });
    const b = simulateBattle({ project, troopId: "troop_slime_pair", heroLevel: 1, n: 20, seed: 42 });
    expect(a).toEqual(b);
    expect(Math.random).toBe(before); // finally에서 원복됨
  });

  it("tune_enemy가 데미지 공식 역산으로 maxHp/attack을 조정하고 근거를 반환한다", () => {
    const ctx: ToolContext = { project: createEmberQuestProject() };
    const result = runTool(ctx, "tune_enemy", { enemyId: "enemy_slime", targetHitsToKill: 3, targetDamageToHeroPerHit: 40, heroLevel: 1 }, { dryRun: false });
    expect(result.ok).toBe(true);
    const data = result.data as { after: { maxHp: number; attack: number }; rationale: { heroAttack: number; heroHitDamage: number; formula: string } };
    expect(data.after.maxHp).toBeGreaterThan(0);
    expect(data.after.attack).toBeGreaterThan(0);
    expect(data.rationale.heroHitDamage).toBeGreaterThan(0);
    expect(data.rationale.formula).toContain("maxHp");
    // 목표 타수(3)에 맞으면 maxHp ≈ 3 × heroHitDamage.
    expect(data.after.maxHp).toBe(Math.round(3 * data.rationale.heroHitDamage));
  });

  it("computeEnemyTuning은 순수 함수로 근거를 산출한다", () => {
    const tuning = computeEnemyTuning({ project, heroLevel: 1, enemyDefense: 20, targetHitsToKill: 4, targetDamageToHeroPerHit: 50 });
    expect(tuning.maxHp).toBe(Math.round(4 * tuning.rationale.heroHitDamage));
    expect(tuning.attack).toBeGreaterThan(0);
  });
});
