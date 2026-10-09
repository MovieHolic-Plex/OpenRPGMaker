import { describe, expect, it } from "vitest";
import { createBattleRuntime, damageToMpRateForStates } from "@/battle/runtime";
import { normalizeStateRecord } from "@/project/databaseRecordModel";
import { deserialize, serialize } from "@/project/io";
import type { Project } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

function battleProject(rate?: number): Project {
  const project = deserialize(JSON.stringify(battleFixture));
  const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
  slime.stats = { ...slime.stats, maxHp: 9999, maxMp: 999, defense: 0 };
  if (rate !== undefined) {
    project.database.states.push(normalizeStateRecord({ id: "state_mana_shield", name: "마나 실드", runtimeEffects: { damageToMpRate: rate, removeOnBattleEnd: true } }));
  }
  return project;
}

/** 아군 통상 공격 한 번으로 적 HP/MP 가 얼마나 줄었는지. rng 0.5 = 분산 1.0·크리티컬 없음. */
function hitSlime(project: Project): { hpLoss: number; mpLoss: number; reported: number } {
  const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
  const enemy = runtime.snapshot().enemies[0]!;
  runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
  const after = runtime.snapshot().enemies[0]!;
  const entry = runtime.snapshot().timeline.find((item) => item.kind === "damage" && item.side === "actor")!;
  return { hpLoss: enemy.hp - after.hp, mpLoss: enemy.mp - after.mp, reported: entry.amount ?? 0 };
}

describe("mg-l2-bflow #33 피해 MP 전환 상태", () => {
  it("비율을 합산해 1 로 자른다", () => {
    const project = battleProject(0.6);
    project.database.states.push(normalizeStateRecord({ id: "state_extra", name: "추가", runtimeEffects: { damageToMpRate: 0.7 } }));
    expect(damageToMpRateForStates(project, { stateIds: ["state_mana_shield"] })).toBe(0.6);
    expect(damageToMpRateForStates(project, { stateIds: ["state_mana_shield", "state_extra"] })).toBe(1);
    expect(damageToMpRateForStates(project, { stateIds: [] })).toBe(0);
  });

  it("damageToMpRate 0.5 상태의 배우는 적 통상 공격 피해의 절반을 MP 로 받는다", () => {
    const project = battleProject(0.5);
    const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    slime.stats = { ...slime.stats, attack: 200, agility: 999 };
    const plain = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
    const shielded = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5, party: { stateIds: { actor_hero: ["state_mana_shield"] } } });
    const plainBefore = plain.snapshot().actors[0]!;
    const shieldBefore = shielded.snapshot().actors[0]!;
    plain.performActorCommand({ kind: "defend" });
    shielded.performActorCommand({ kind: "defend" });
    const plainAfter = plain.snapshot().actors[0]!;
    const shieldAfter = shielded.snapshot().actors[0]!;
    const total = plainBefore.hp - plainAfter.hp;
    expect(total).toBeGreaterThan(1);
    const hpLoss = shieldBefore.hp - shieldAfter.hp;
    const mpLoss = shieldBefore.mp - shieldAfter.mp;
    const expectedMp = Math.min(shieldBefore.mp, Math.floor(total * 0.5));
    expect(mpLoss).toBe(expectedMp);
    expect(hpLoss).toBe(total - expectedMp);
    // 타임라인 피해량은 실제 HP 감소와 같다.
    const entry = shielded.snapshot().timeline.find((item) => item.kind === "damage" && item.side === "enemy")!;
    expect(entry.amount).toBe(hpLoss);
  });

  it("MP 가 모자라면 남은 MP 만큼만 돌리고 나머지는 HP 로 받는다", () => {
    const project = battleProject(1);
    const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    slime.stats = { ...slime.stats, attack: 200, agility: 999 };
    const plain = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5, party: { vitals: { actor_hero: { hp: 9999, mp: 0 } } } });
    const shielded = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5, party: { vitals: { actor_hero: { hp: 9999, mp: 3 } }, stateIds: { actor_hero: ["state_mana_shield"] } } });
    const plainHp = plain.snapshot().actors[0]!.hp;
    const shieldHp = shielded.snapshot().actors[0]!.hp;
    expect(shieldHp).toBe(plainHp);
    expect(shielded.snapshot().actors[0]!.mp).toBe(3);
    plain.performActorCommand({ kind: "defend" });
    shielded.performActorCommand({ kind: "defend" });
    const total = plainHp - plain.snapshot().actors[0]!.hp;
    expect(shielded.snapshot().actors[0]!.mp).toBe(0);
    expect(shieldHp - shielded.snapshot().actors[0]!.hp).toBe(total - 3);
  });

  it("상태가 없으면 피해는 예전처럼 전부 HP 로 간다", () => {
    const project = battleProject();
    const result = hitSlime(project);
    expect(result.mpLoss).toBe(0);
    expect(result.hpLoss).toBe(result.reported);
  });

  it("damageToMpRate 는 저장·불러오기를 지난다", () => {
    const reloaded = deserialize(serialize(battleProject(0.25)));
    expect(reloaded.database.states.find((state) => state.id === "state_mana_shield")?.runtimeEffects?.damageToMpRate).toBe(0.25);
  });
});
