// Gen1 코어 데미지 공식 — battleModel 게이트 계약.
//  (1) rm2k3(기본/생략)는 뺄셈식 `power + floor(stat/2) - floor(def/2)` 를 바이트 단위로 유지한다.
//  (2) gen1 은 레벨 기반 코어 공식 + 217~255/255 랜덤. variance/criticalMultiplier 는 무시되고
//      크리티컬은 **공식 안의 레벨 2배**로 들어간다.
//  (3) 미러 4곳(runtime applySkillLike · battlePredict 기댓값 · 적 AI 유틸리티 · tune_enemy 역산)이
//      같은 코어 함수를 쓴다 — 산식이 갈라지면 이 파일이 깨진다.
import { describe, expect, it } from "vitest";
import { applySkillLike, computeGen1BaseDamage, GEN1_RANDOM_MAX, GEN1_RANDOM_MIN, usesGen1Damage } from "@/battle/battleDamage";
import type { MutableBattler } from "@/battle/battleBattlers";
import { predictSkillDamage } from "@/battle/battlePredict";
import { computeEnemyTuning, simulateBattle } from "@/battle/simulate";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import type { BattleBattlerSnapshot } from "@/battle/types";
import type { Project } from "@/project/types";

// Lv50 / power 40 / A 100 / D 100 의 원작 기준값. 아래 모든 기대치가 이 19 에서 파생된다.
//   levelTerm = floor(2·50/5) + 2 = 22 → floor(22·40·100/100) = 880 → floor(880/50) = 17 → +2 = 19
const BASE_L50_P40 = 19;

function battler(overrides: Partial<MutableBattler> = {}): MutableBattler {
  return {
    id: "b1",
    recordId: "actor_hero",
    name: "테스트",
    level: 50,
    maxHp: 500,
    hp: 500,
    maxMp: 20,
    mp: 20,
    attackPower: 100,
    defense: 100,
    mind: 100,
    agility: 50,
    chargeRate: 0.1,
    skillIds: [],
    hidden: false,
    gauge: 0,
    stateIds: [],
    stateTurns: {},
    defending: false,
    ...overrides,
  };
}

function snapshot(overrides: Partial<BattleBattlerSnapshot> = {}): BattleBattlerSnapshot {
  return {
    id: "s1",
    recordId: "actor_hero",
    effectiveStats: { attack: 100, defense: 100, mind: 100, agility: 50 },
    level: 50,
    name: "테스트",
    hp: 500,
    maxHp: 500,
    mp: 20,
    maxMp: 20,
    gauge: 0,
    defeated: false,
    defending: false,
    pose: "idle",
    stateIds: [],
    skillIds: [],
    ...overrides,
  };
}

const rngOf = (value: number) => (): number => value;
// 랜덤 계수 최대(255/255) — 217 + floor(0.999·39) = 255.
const RNG_MAX_ROLL = 0.999;

function rm2k3Project(): Project {
  const project = createScarloxyPokemonDemoProject();
  return { ...project, system: { ...project.system, battleModel: "rm2k3" } };
}

describe("computeGen1BaseDamage — 원작 코어 공식", () => {
  it("Lv50 power40 A100 D100 → 19 (층층 floor 순서 포함)", () => {
    expect(computeGen1BaseDamage({ level: 50, power: 40, attack: 100, defense: 100 })).toBe(BASE_L50_P40);
  });

  it("크리티컬은 배율이 아니라 공식 안의 레벨 2배다", () => {
    // levelTerm = floor(2·100/5) + 2 = 42 → floor(42·40·100/100)/50 = 33 → +2 = 35 (19×2 가 아니다)
    expect(computeGen1BaseDamage({ level: 50, power: 40, attack: 100, defense: 100, critical: true })).toBe(35);
  });

  it("직접 입력된 방어 0 은 1 로 정규화하되 중립 피해 상한 999를 지킨다", () => {
    expect(computeGen1BaseDamage({ level: 50, power: 40, attack: 100, defense: 0 })).toBe(999);
  });

  it("레벨이 오르면 단조 증가한다", () => {
    const low = computeGen1BaseDamage({ level: 5, power: 40, attack: 100, defense: 100 });
    const high = computeGen1BaseDamage({ level: 80, power: 40, attack: 100, defense: 100 });
    expect(low).toBeLessThan(high);
  });
});

describe("usesGen1Damage 게이트", () => {
  it("포켓몬 데모는 gen1, rm2k3 클론은 아니다", () => {
    expect(usesGen1Damage(createScarloxyPokemonDemoProject())).toBe(true);
    expect(usesGen1Damage(rm2k3Project())).toBe(false);
  });
});

describe("applySkillLike — rm2k3 경로 불변", () => {
  it("gen1AttackerLevel 없으면 뺄셈식 그대로다 (40 + 50 - 50 = 40)", () => {
    const result = applySkillLike(battler(), battler({ id: "t1" }), {
      power: 40,
      statistic: "attack",
      effect: "damage",
      variance: 0,
      criticalRate: 0,
      rng: rngOf(0.5),
    });
    expect(result).toEqual({ hit: true, amount: 40, critical: false });
  });
});

describe("applySkillLike — gen1 경로", () => {
  const gen1Spec = { power: 40, statistic: "attack" as const, effect: "damage" as const, gen1AttackerLevel: 50, criticalRate: 0 };

  it("랜덤 계수 최대면 코어 공식 값 그대로, variance 는 무시된다", () => {
    const result = applySkillLike(battler(), battler({ id: "t1" }), { ...gen1Spec, variance: 20, rng: rngOf(RNG_MAX_ROLL) });
    expect(result.amount).toBe(BASE_L50_P40);
  });

  it("랜덤 계수 최소는 217/255 — 19 → 16", () => {
    const result = applySkillLike(battler(), battler({ id: "t1" }), { ...gen1Spec, rng: rngOf(0) });
    expect(result.amount).toBe(Math.floor((BASE_L50_P40 * GEN1_RANDOM_MIN) / GEN1_RANDOM_MAX));
    expect(result.amount).toBe(16);
  });

  it("크리티컬은 레벨 2배 경로로 35 를 만들고 플래그를 세운다", () => {
    const result = applySkillLike(battler(), battler({ id: "t1" }), {
      ...gen1Spec,
      criticalRate: 100,
      criticalMultiplier: 9, // gen1 경로에서 무시되어야 한다
      rng: rngOf(RNG_MAX_ROLL),
    });
    expect(result).toEqual({ hit: true, amount: 35, critical: true });
  });

  it("상성 배율은 랜덤 **전에** 곱한다 (19×2 → 38, 최소 롤이면 32)", () => {
    const max = applySkillLike(battler(), battler({ id: "t1" }), { ...gen1Spec, elementMultiplier: 2, rng: rngOf(RNG_MAX_ROLL) });
    const min = applySkillLike(battler(), battler({ id: "t2" }), { ...gen1Spec, elementMultiplier: 2, rng: rngOf(0) });
    expect(max.amount).toBe(38);
    expect(min.amount).toBe(32);
  });

  it("무효(배율 0)는 0, 흡수(음수 배율)는 회복으로 돌아온다", () => {
    const immune = applySkillLike(battler(), battler({ id: "t1" }), { ...gen1Spec, elementMultiplier: 0, rng: rngOf(RNG_MAX_ROLL) });
    expect(immune.amount).toBe(0);
    const target = battler({ id: "t2", hp: 100 });
    const absorbed = applySkillLike(battler(), target, { ...gen1Spec, elementMultiplier: -1, rng: rngOf(RNG_MAX_ROLL) });
    expect(absorbed.amount).toBe(-BASE_L50_P40);
    expect(target.hp).toBe(100 + BASE_L50_P40);
  });

  it("방어 자세는 절반, 방어력이 압도적이어도 최소 1 은 들어간다", () => {
    const defending = applySkillLike(battler(), battler({ id: "t1", defending: true }), { ...gen1Spec, rng: rngOf(RNG_MAX_ROLL) });
    expect(defending.amount).toBe(Math.floor(BASE_L50_P40 / 2));
    const wall = applySkillLike(battler(), battler({ id: "t2", defense: 10_000 }), { ...gen1Spec, rng: rngOf(0) });
    // Authored stats cap at 999, then Gen1's >255 paired quarter-scaling applies.
    expect(wall.amount).toBe(2);
  });

  it("마법 속성은 mind 로, 물리는 defense 로 나눈다", () => {
    const target = battler({ id: "t1", defense: 100, mind: 25 });
    const physical = applySkillLike(battler(), target, { ...gen1Spec, rng: rngOf(RNG_MAX_ROLL) });
    const magical = applySkillLike(battler(), target, { ...gen1Spec, useMagicalDefense: true, rng: rngOf(RNG_MAX_ROLL) });
    expect(physical.amount).toBe(BASE_L50_P40);
    expect(magical.amount).toBe(computeGen1BaseDamage({ level: 50, power: 40, attack: 100, defense: 25 }));
    expect(magical.amount).toBeGreaterThan(physical.amount);
  });

  it("방어 배율(방어 하락 상태)이 분모에 반영된다", () => {
    const halved = applySkillLike(battler(), battler({ id: "t1" }), { ...gen1Spec, targetDefenseMultiplier: 0.5, rng: rngOf(RNG_MAX_ROLL) });
    expect(halved.amount).toBe(computeGen1BaseDamage({ level: 50, power: 40, attack: 100, defense: 50 }));
  });
});

describe("battlePredict — gen1 기댓값 미러", () => {
  const spec = { power: 40, statistic: "attack" as const, effect: "damage" as const };

  it("gen1 예측은 랜덤 중앙값(236/255)이고 실제 롤 구간 안에 있다", () => {
    const predicted = predictSkillDamage(createScarloxyPokemonDemoProject(), snapshot(), spec, snapshot({ id: "s2" }));
    expect(predicted.amount).toBe(17); // floor(19 × 236/255)
    const min = applySkillLike(battler(), battler({ id: "t1" }), {
      ...spec,
      gen1AttackerLevel: 50,
      criticalRate: 0,
      rng: rngOf(0),
    }).amount;
    const max = applySkillLike(battler(), battler({ id: "t2" }), {
      ...spec,
      gen1AttackerLevel: 50,
      criticalRate: 0,
      rng: rngOf(RNG_MAX_ROLL),
    }).amount;
    expect(predicted.amount).toBeGreaterThanOrEqual(min);
    expect(predicted.amount).toBeLessThanOrEqual(max);
  });

  it("rm2k3 예측은 뺄셈식 40 을 유지한다", () => {
    const predicted = predictSkillDamage(rm2k3Project(), snapshot(), spec, snapshot({ id: "s2" }));
    expect(predicted.amount).toBe(40);
  });

  it("방어 자세는 두 모델 모두 절반이다", () => {
    // Gen1 has no defend command; a stale legacy flag must not alter cartridge damage.
    expect(predictSkillDamage(createScarloxyPokemonDemoProject(), snapshot(), spec, snapshot({ id: "s2", defending: true })).amount).toBe(17);
    expect(predictSkillDamage(rm2k3Project(), snapshot(), spec, snapshot({ id: "s2", defending: true })).amount).toBe(20);
  });

  it("gen1 은 저작된 statistic 대신 타입의 물리/특수 분류를 쓴다", () => {
    const project = createScarloxyPokemonDemoProject();
    const user = snapshot({
      speciesId: "species_scarloxy_draem",
      effectiveStats: { attack: 5, defense: 100, mind: 200, agility: 50 },
    });
    const target = snapshot({
      id: "s2",
      speciesId: "species_scarloxy_pouch",
      effectiveStats: { attack: 100, defense: 999, mind: 20, agility: 50 },
    });

    const predicted = predictSkillDamage(project, user, {
      power: 40,
      statistic: "attack",
      effect: "damage",
      elementId: "psychic",
    }, target);

    expect(predicted.amount).toBeGreaterThan(100);
  });

  it("mirrors authored physical attack and defense state multipliers", () => {
    const project = createScarloxyPokemonDemoProject();
    const base = predictSkillDamage(project, snapshot(), spec, snapshot({ id: "s2" }));
    const boosted = predictSkillDamage(
      project,
      snapshot({ stateIds: ["state_attack_up"] }),
      spec,
      snapshot({ id: "s2", stateIds: ["state_defense_down"] }),
    );

    expect(boosted.amount).toBeGreaterThan(base.amount);
  });
});

describe("헤들리스 통합 — gen1 공식이 전투를 교착시키지 않는다", () => {
  // 날것: 상호 데미지가 0 으로 뭉개지면 유니트는 전부 녹상이지만 실제 전투가 끝나지 않는다
  // (예전에 산식 미설정으로 기본 트룹 3종이 피해 0 · 승를 1.0 이 된 전례가 runtime.ts:1426 에 적혀 있다).
  it("gen1 데모 전투가 시드 고정에서 유한 톴에 결정된다", () => {
    const result = simulateBattle({
      project: createScarloxyPokemonDemoProject(),
      troopId: "troop_pkmn_grass_a",
      heroLevel: 8,
      n: 12,
      seed: 20_260_823,
    });
    expect(result.samples).toBe(12);
    expect(result.avgTurns).toBeGreaterThan(0);
    // maxSteps(4000) 상한에 부딪혀 가면 avgTurns 가 수백으로 틴다 — 교착 감지선.
    expect(result.avgTurns).toBeLessThan(60);
  });
});

describe("computeEnemyTuning — gen1 역산", () => {
  it("gen1 은 코어 공식으로 근거를 내고 역산 attack 이 목표 데미지를 만든다", () => {
    const target = 20;
    const tuning = computeEnemyTuning({
      project: createScarloxyPokemonDemoProject(),
      heroLevel: 25,
      enemyDefense: 30,
      targetHitsToKill: 4,
      targetDamageToHeroPerHit: target,
    });
    expect(tuning.rationale.formula.startsWith("gen1:")).toBe(true);
    const damageAt = (attack: number): number =>
      computeGen1BaseDamage({ level: 25, power: attack, attack, defense: tuning.rationale.heroDefense });
    // 목표를 넘기는 **최소** attack 이어야 한다(과대 산출 방지).
    expect(damageAt(tuning.attack)).toBeGreaterThanOrEqual(target);
    expect(damageAt(tuning.attack - 1)).toBeLessThan(target);
    expect(tuning.maxHp).toBe(4 * tuning.rationale.heroHitDamage);
  });

  it("rm2k3 은 기존 닫힌 해와 근거 문자열을 유지한다", () => {
    const tuning = computeEnemyTuning({
      project: rm2k3Project(),
      heroLevel: 25,
      enemyDefense: 30,
      targetHitsToKill: 4,
      targetDamageToHeroPerHit: 20,
    });
    expect(tuning.attack).toBe(Math.round((20 + Math.floor(tuning.rationale.heroDefense / 2)) / 1.5));
    expect(tuning.rationale.formula.startsWith("maxHp =")).toBe(true);
  });
});
