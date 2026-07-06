import { describe, expect, it } from "vitest";
import {
  applyStateEffects,
  attackMultiplierForStates,
  canBattlerAct,
  clearBattleEndStates,
  defenseMultiplierForStates,
  recoverStatesWhenHit,
  runStateUpkeep,
  stateBehavior,
  stateResistancePercent,
} from "@/battle/battleStates";
import type { MutableBattler } from "@/battle/battleBattlers";
import { createBlankProject } from "@/project/defaults";
import type { Project, StateRecord } from "@/project/types";

// 결정적 rng: 0 → 확률>0 은 항상 성공, 1 → 항상 실패.
const always: () => number = () => 0;
const never: () => number = () => 0.999999;

function stateRecord(project: Project, id: string): StateRecord {
  const record = project.database.states.find((entry) => entry.id === id);
  if (!record) throw new Error(`missing state ${id}`);
  return record;
}

function makeBattler(overrides: Partial<MutableBattler> = {}): MutableBattler {
  return {
    id: "enemy-1",
    recordId: "enemy_slime",
    name: "슬라임",
    maxHp: 100,
    maxMp: 20,
    attackPower: 30,
    defense: 20,
    mind: 10,
    agility: 10,
    chargeRate: 1,
    skillIds: [],
    hidden: false,
    hp: 100,
    mp: 20,
    gauge: 0,
    stateIds: [],
    stateTurns: {},
    defending: false,
    ...overrides,
  };
}

describe("battleStates — DB 상태 레코드 기반 행동", () => {
  it("독은 매 턴 지속 피해, 전투 종료 후 유지, 행동 제약 없음으로 해석된다", () => {
    const behavior = stateBehavior(stateRecord(createBlankProject(), "state_poison"));
    expect(behavior.hpDamagePercentPerTurn).toBe(6);
    expect(behavior.removeOnBattleEnd).toBe(false);
    expect(behavior.restrictsAction).toBe(false);
  });

  it("수면은 행동 불가 + 피격 시 해제 + 전투 종료 시 해제로 해석된다", () => {
    const behavior = stateBehavior(stateRecord(createBlankProject(), "state_sleep"));
    expect(behavior.restrictsAction).toBe(true);
    expect(behavior.recoverWhenHitChance).toBe(50);
    expect(behavior.removeOnBattleEnd).toBe(true);
  });

  it("공격 상승/방어 하락은 능력치 배율로 해석된다", () => {
    const project = createBlankProject();
    expect(stateBehavior(stateRecord(project, "state_attack_up")).attackMultiplier).toBe(2);
    expect(stateBehavior(stateRecord(project, "state_defense_down")).defenseMultiplier).toBe(0.5);
  });

  it("사용자가 편집한 레코드 필드(피격 회복 확률)를 실제로 읽어 반영한다", () => {
    const record: StateRecord = { id: "state_sleep", name: "수면", restriction: "행동 불가", recoverWhenHitChance: 10 };
    expect(stateBehavior(record).recoverWhenHitChance).toBe(10);
  });
});

describe("battleStates — 부여/해제", () => {
  it("add 효과는 확률 성공 시 상태를 부여한다", () => {
    const project = createBlankProject();
    const target = makeBattler();
    const result = applyStateEffects(project, target, [{ stateId: "state_poison", chance: 100, operation: "add" }], always);
    expect(result.added).toEqual(["state_poison"]);
    expect(target.stateIds).toContain("state_poison");
    expect(target.stateTurns.state_poison).toBe(0);
  });

  it("확률 실패 시 상태를 부여하지 않는다", () => {
    const project = createBlankProject();
    const target = makeBattler();
    applyStateEffects(project, target, [{ stateId: "state_poison", chance: 50, operation: "add" }], never);
    expect(target.stateIds).not.toContain("state_poison");
  });

  it("remove 효과는 대상의 상태를 즉시 해제한다", () => {
    const project = createBlankProject();
    const target = makeBattler({ stateIds: ["state_poison"], stateTurns: { state_poison: 2 } });
    const result = applyStateEffects(project, target, [{ stateId: "state_poison", chance: 100, operation: "remove" }], always);
    expect(result.removed).toEqual(["state_poison"]);
    expect(target.stateIds).not.toContain("state_poison");
  });

  it("대상 stateRates 등급으로 부여 저항을 계산한다", () => {
    const project = createBlankProject();
    // 주인공 기본 stateRates: state_poison = C(60%).
    const hero = makeBattler({ recordId: "actor_hero" });
    expect(stateResistancePercent(project, hero, "state_poison")).toBe(60);
  });
});

describe("battleStates — 턴 처리/제약/회복", () => {
  it("독 지속 피해는 최대 HP 비율만큼 깎되 HP를 1 미만으로 낮추지 않는다", () => {
    const project = createBlankProject();
    const target = makeBattler({ maxHp: 100, hp: 100, stateIds: ["state_poison"] });
    const upkeep = runStateUpkeep(project, target, never); // 자연 회복은 실패시켜 피해만 검증
    expect(upkeep.hpDamage).toBe(6);
    expect(target.hp).toBe(94);
    // HP가 1일 때는 더 깎이지 않는다.
    target.hp = 1;
    const upkeep2 = runStateUpkeep(project, target, never);
    expect(upkeep2.hpDamage).toBe(0);
    expect(target.hp).toBe(1);
  });

  it("자연 회복 시작 턴에 도달하면 확률에 따라 상태를 해제한다", () => {
    const project = createBlankProject();
    // state_poison: recoverNaturallyFromTurn=3. 두 번 upkeep(턴 1,2)엔 유지, 세 번째(턴 3)에 해제(확률 성공).
    const target = makeBattler({ stateIds: ["state_poison"], hp: 50 });
    runStateUpkeep(project, target, never);
    runStateUpkeep(project, target, never);
    expect(target.stateIds).toContain("state_poison");
    const upkeep = runStateUpkeep(project, target, always);
    expect(upkeep.removedStateIds).toContain("state_poison");
    expect(target.stateIds).not.toContain("state_poison");
  });

  it("행동 불가 상태(수면)면 canBattlerAct 가 false", () => {
    const project = createBlankProject();
    expect(canBattlerAct(project, makeBattler({ stateIds: ["state_sleep"] }))).toBe(false);
    expect(canBattlerAct(project, makeBattler({ stateIds: ["state_poison"] }))).toBe(true);
  });

  it("피격 시 수면은 확률에 따라 해제된다", () => {
    const project = createBlankProject();
    const target = makeBattler({ stateIds: ["state_sleep"] });
    const removed = recoverStatesWhenHit(project, target, always);
    expect(removed).toContain("state_sleep");
    expect(target.stateIds).not.toContain("state_sleep");
  });

  it("전투 종료 시 '해제' 상태는 제거하고 '유지'(독)는 남긴다", () => {
    const project = createBlankProject();
    const target = makeBattler({ stateIds: ["state_sleep", "state_poison"], stateTurns: { state_sleep: 1, state_poison: 1 } });
    clearBattleEndStates(project, target);
    expect(target.stateIds).toEqual(["state_poison"]);
  });

  it("공격 상승/방어 하락 상태 배율을 곱으로 산출한다", () => {
    const project = createBlankProject();
    expect(attackMultiplierForStates(project, makeBattler({ stateIds: ["state_attack_up"] }))).toBe(2);
    expect(defenseMultiplierForStates(project, makeBattler({ stateIds: ["state_defense_down"] }))).toBe(0.5);
    expect(attackMultiplierForStates(project, makeBattler({ stateIds: [] }))).toBe(1);
  });
});
