import { describe, expect, it } from "vitest";
import { createBattleRuntime, escapeChance } from "@/battle/runtime";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { deserialize } from "@/project/io";
import type { Project } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

function battleProject(): Project {
  const project = deserialize(JSON.stringify(battleFixture));
  const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
  // 민첩이 같으면 기본 도주 확률은 정확히 50%.
  slime.stats = { ...slime.stats, maxHp: 9999, attack: 1 };
  return project;
}

function heroAgility(project: Project): number {
  const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.99 });
  return runtime.snapshot().actors[0]!.effectiveStats!.agility;
}

describe("mg-l2-bflow #34 도주 실패 가산", () => {
  it("실패 0회는 예전 식 그대로, 실패마다 기본 +10%p 가 붙고 100% 에서 멈춘다", () => {
    expect(escapeChance(10, 10, 0, undefined)).toBe(0.5);
    expect(escapeChance(10, 10, 1, undefined)).toBeCloseTo(0.6);
    expect(escapeChance(10, 10, 3, 20)).toBe(1);
    expect(escapeChance(10, 10, 4, 0)).toBe(0.5);
  });

  it("같은 rng 값이 첫 시도는 실패, 한 번 실패한 뒤에는 성공한다(strict)", () => {
    const project = battleProject();
    const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    slime.stats = { ...slime.stats, agility: heroAgility(project) };
    // 0.55: 기본 50% 에서는 실패, +10%p(60%) 에서는 성공.
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.55 });
    runtime.performActorCommand({ kind: "escape" });
    expect(runtime.snapshot().result).toBeUndefined();
    expect(runtime.snapshot().failedEscapeAttempts).toBe(1);
    runtime.performActorCommand({ kind: "escape" });
    expect(runtime.snapshot().result).toBe("escape");
  });

  it("escapeBonusPercent 0 이면 가산이 없어 같은 값으로 계속 실패한다", () => {
    const project = battleProject();
    project.system.escapeBonusPercent = 0;
    const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    slime.stats = { ...slime.stats, agility: heroAgility(project) };
    const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.55 });
    runtime.performActorCommand({ kind: "escape" });
    runtime.performActorCommand({ kind: "escape" });
    runtime.performActorCommand({ kind: "escape" });
    expect(runtime.snapshot().result).toBeUndefined();
    expect(runtime.snapshot().failedEscapeAttempts).toBe(3);
  });

  it("시스템 정규화는 기본값 10 을 저장하지 않고 다른 값은 0~100 으로 자른다", () => {
    expect(normalizeSystemRecords({ startActorIds: [], escapeBonusPercent: 10 }).escapeBonusPercent).toBeUndefined();
    expect(normalizeSystemRecords({ startActorIds: [], escapeBonusPercent: 25 }).escapeBonusPercent).toBe(25);
    expect(normalizeSystemRecords({ startActorIds: [], escapeBonusPercent: 250 }).escapeBonusPercent).toBe(100);
    expect(normalizeSystemRecords({ startActorIds: [], battleFormationRoll: true }).battleFormationRoll).toBe(true);
  });
});
