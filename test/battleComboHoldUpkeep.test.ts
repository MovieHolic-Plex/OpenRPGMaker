// 2026-11-10 fs-combo-cancel 실측: 독 걸린 이리스가 기다리기 → 카엘이 셋 연계기 → 이리스의 다음 차례에 독 피해가 빠졌다(2/2).
import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import type { Project } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

const A = "actor_hero";
const B = "actor_partner";
const COMBO = "skill_combo_test";

function project(): Project {
  const p = deserialize(JSON.stringify(battleFixture));
  const hero = p.database.actors.find((record) => record.id === A)!;
  p.database.actors.push({ ...JSON.parse(JSON.stringify(hero)), id: B, name: "동료" });
  p.session.partyActorIds = [A, B];
  p.system.startActorIds = [A, B];
  const burn = p.database.states.find((record) => record.id === "state_burn")!;
  burn.runtimeEffects = { ...burn.runtimeEffects, hpDamagePercentPerTurn: 10 };
  const fire = p.database.skills.find((record) => record.id === "skill_fire")!;
  p.database.skills.push({ ...JSON.parse(JSON.stringify(fire)), id: COMBO, name: "합동기", power: 1, mpCost: { flat: 0, percentMax: 0 }, comboActorIds: [A, B] });
  // 적은 아주 느리게 — 아군 차례만 오가게 한다.
  const slime = p.database.enemies.find((record) => record.id === "enemy_slime")!;
  slime.stats = { ...slime.stats, maxHp: 99999, agility: 1 };
  return p;
}

function advanceToTurn(runtime: ReturnType<typeof createBattleRuntime>, actorId?: string): void {
  for (let i = 0; i < 400; i += 1) {
    const s = runtime.snapshot();
    if (s.phase === "actorCommand" && (!actorId || s.activeActorId === actorId)) return;
    if (s.phase === "actorCommand") runtime.performActorCommand({ kind: "defend" });
    else runtime.tick(50);
  }
  throw new Error(`turn for ${actorId ?? "any actor"} never came`);
}

describe("연계 대기 뒤 차례 시작 처리", () => {
  it("기다리던 배우가 동료 연계기로 차례를 쓴 뒤 다음 차례에는 지속 피해를 받는다", () => {
    const runtime = createBattleRuntime({
      project: project(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge",
      party: { levels: { [A]: 1, [B]: 1 }, experience: {}, partyActorIds: [A, B], stateIds: { [B]: ["state_burn"] } },
    });
    // B 가 먼저 차례를 받도록 A 차례는 방어로 넘긴다.
    advanceToTurn(runtime, B);
    // A 의 게이지가 아직 차지 않았으면 B 는 기다린다.
    const aGauge = runtime.snapshot().actors.find((actor) => actor.recordId === A)!.gauge;
    expect(aGauge).toBeLessThan(100);
    expect(runtime.holdForCombo?.()).toBe(true);
    // A 의 차례 — B 는 대기에서 풀려 준비 상태다. A 가 연계기를 쓴다(B 의 차례도 쓴다).
    advanceToTurn(runtime, A);
    const enemyId = runtime.snapshot().enemies[0]!.id;
    runtime.performActorCommand({ kind: "skill", skillId: COMBO, targetEnemyId: enemyId });
    expect(runtime.snapshot().actors.find((actor) => actor.recordId === B)!.gauge).toBe(0);
    const before = runtime.snapshot().timeline.length;
    // B 의 다음(새) 차례에는 차례 시작 처리로 화상 피해가 나야 한다.
    advanceToTurn(runtime, B);
    const bId = runtime.snapshot().actors.find((actor) => actor.recordId === B)!.id;
    const upkeep = runtime.snapshot().timeline.slice(before).filter((entry) => entry.kind === "stateUpkeep" && entry.targetId === bId);
    expect(upkeep.length).toBeGreaterThan(0);
  });

  it("기다리던 배우가 이어 받는 차례에는 지속 피해를 두 번 받지 않는다", () => {
    const runtime = createBattleRuntime({
      project: project(), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge",
      party: { levels: { [A]: 1, [B]: 1 }, experience: {}, partyActorIds: [A, B], stateIds: { [B]: ["state_burn"] } },
    });
    advanceToTurn(runtime, B);
    expect(runtime.holdForCombo?.()).toBe(true);
    advanceToTurn(runtime, A);
    const before = runtime.snapshot().timeline.length;
    runtime.performActorCommand({ kind: "defend" });
    advanceToTurn(runtime, B);
    const bId = runtime.snapshot().actors.find((actor) => actor.recordId === B)!.id;
    const upkeep = runtime.snapshot().timeline.slice(before).filter((entry) => entry.kind === "stateUpkeep" && entry.targetId === bId);
    expect(upkeep).toHaveLength(0);
  });
});
