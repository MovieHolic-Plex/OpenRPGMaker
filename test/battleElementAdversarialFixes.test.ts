// B1/B2/B4/B4b 적대적 리뷰 회귀 테스트.
// B1: predictSkillDamage 가 플레이어 몬스터(recordId=instanceId, speciesId 유) 공격 시
//     타입 상성 + STAB 을 runtime 과 동일하게 반영해야 한다.
// B2: element.kind 가 "magical" 이면 데미지 감소에 target.mind(마법 방어력) 를 쓴다.
// B4: 요소 축소/삭제 시 actor/enemy/class 의 elementRates 잔재가 정리되어야 하며,
//     같은 ordinal 로 id 재생성 시 stale 등급이 소생하지 않아야 한다.
// B4b: state_death 가 elementRates 에 섞이지 않아야 한다.
import { describe, expect, it } from "vitest";
import { deserialize } from "@/project/io";
import { repairProjectReferences, pruneDanglingElementRates, collectProjectReferenceIssues } from "@/project/io/references";
import { resizeElementRecords } from "@/editor/databaseElementList";
import { battlerTypes, typeChartMultiplierForTypes } from "@/battle/typeChart";
import { predictSkillDamage, isMagicalElement } from "@/battle/battlePredict";
import { computeGen1BaseDamage, GEN1_RANDOM_MAX, GEN1_RANDOM_MEDIAN } from "@/battle/battleDamage";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import { normalizeClassRecord } from "@/project/databaseRecordModel";
import type { BattleBattlerSnapshot } from "@/battle/types";
import type { Project } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

function baseProject(): Project {
  return deserialize(JSON.stringify(battleFixture));
}

function projectWithTypeChart(): Project {
  const project = baseProject();
  project.system.typeChart = {
    types: ["fire", "grass", "water"],
    multipliers: {
      fire: { grass: 2, water: 0.5, fire: 1 },
      grass: { water: 2, fire: 0.5, grass: 1 },
      water: { fire: 2, grass: 0.5, water: 1 },
    },
  };
  project.database.monsterSpecies = [
    { id: "species_leafling", name: "Leafling", types: ["grass"], baseStats: { attack: 20, defense: 15, mind: 10, agility: 12, maxHp: 60, maxMp: 20 }, captureRate: 45, skillsByLevel: [], evolutions: [] },
    { id: "species_aqualing", name: "Aqualing", types: ["water"], baseStats: { attack: 18, defense: 18, mind: 12, agility: 10, maxHp: 65, maxMp: 25 }, captureRate: 45, skillsByLevel: [], evolutions: [] },
  ];
  return project;
}

function playerMonsterSnapshot(speciesId: string): BattleBattlerSnapshot {
  return {
    id: "mon-1",
    recordId: "monster_instance_0001",
    speciesId,
    name: "PlayerMon",
    hp: 60, maxHp: 60, mp: 20, maxMp: 20, gauge: 1000,
    defeated: false, defending: false, pose: "idle",
    stateIds: [], skillIds: [],
  } as unknown as BattleBattlerSnapshot;
}

function typedTargetSnapshot(speciesId: string, recordId: string): BattleBattlerSnapshot {
  return {
    id: "tgt-1",
    recordId,
    speciesId,
    name: "Target",
    hp: 60, maxHp: 60, mp: 20, maxMp: 20, gauge: 0,
    defeated: false, defending: false, pose: "idle",
    stateIds: [], skillIds: [],
  } as unknown as BattleBattlerSnapshot;
}

describe("B1: predict element multiplier for player monsters matches runtime", () => {
  const project = projectWithTypeChart();
  const attacker = playerMonsterSnapshot("species_leafling");
  const waterTarget = typedTargetSnapshot("species_aqualing", "wild_water_mon");
  const grassTarget = typedTargetSnapshot("species_leafling", "wild_grass_mon");

  it("battlerTypes resolves player-monster types via speciesId (not recordId)", () => {
    expect(battlerTypes(project, attacker)).toEqual(["grass"]);
    expect(battlerTypes(project, waterTarget)).toEqual(["water"]);
  });

  it("runtime path applies effectiveness + STAB for player-monster attacker", () => {
    expect(typeChartMultiplierForTypes(project, "grass", battlerTypes(project, attacker), battlerTypes(project, waterTarget))).toBe(3);
    expect(typeChartMultiplierForTypes(project, "grass", battlerTypes(project, attacker), battlerTypes(project, grassTarget))).toBe(1.5);
  });

  it("predictSkillDamage reflects type + STAB for player-monster attacker (was neutral before fix)", () => {
    const power = 100;
    const vsWater = predictSkillDamage(project, attacker, { power, statistic: "attack", effect: "damage", elementId: "grass" }, waterTarget);
    const vsGrass = predictSkillDamage(project, attacker, { power, statistic: "attack", effect: "damage", elementId: "grass" }, grassTarget);
    expect(vsWater.amount).toBe(300);
    expect(vsGrass.amount).toBe(150);
    expect(vsWater.amount / vsGrass.amount).toBe(2);
  });

  it("predict implies the same typechart multiplier the runtime path computes (parity)", () => {
    const power = 100;
    const vsWater = predictSkillDamage(project, attacker, { power, statistic: "attack", effect: "damage", elementId: "grass" }, waterTarget);
    const runtimeMult = typeChartMultiplierForTypes(project, "grass", battlerTypes(project, attacker), battlerTypes(project, waterTarget));
    expect(vsWater.amount / power).toBe(runtimeMult);
  });
});

// B2 는 battleModel="gen1" 에서만 활성이다. 게이트 없이 적용하면 normalizeElementKind 의 폴백이
// "magical" 이고 기본 속성 17개 중 13개가 magical 이라, 저장된 모든 RM2k3 프로젝트의 마법 데미지가
// 마이그레이션 없이 바뀐다. 계획서(task 1 "Must NOT change RM2k3 behavior", task 2 "fix in gen1
// path") 와도 어긋난다. → 게이트 계약을 테스트가 고정한다.
describe("B2: element kind magical routes defense through mind (gen1 전용)", () => {
  it("isMagicalElement returns true for kind=magical, false for physical/undefined", () => {
    const project = baseProject();
    project.system.battleModel = "gen1";
    project.database.elements = [
      { id: "fire", name: "Fire", kind: "magical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
      { id: "slash", name: "Slash", kind: "physical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
    ];
    expect(isMagicalElement(project, "fire")).toBe(true);
    expect(isMagicalElement(project, "slash")).toBe(false);
    expect(isMagicalElement(project, undefined)).toBe(false);
    expect(isMagicalElement(project, "nonexistent")).toBe(false);
  });

  it("rm2k3(기본)에서는 magical 속성도 물리 방어를 쓴다 — 기존 프로젝트 밸런스 보존", () => {
    const project = baseProject();
    delete project.system.battleModel;
    project.database.elements = [
      { id: "fire", name: "Fire", kind: "magical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
    ];
    expect(isMagicalElement(project, "fire")).toBe(false);
  });

  it("predictSkillDamage uses mind defense for magical element, defense for physical", () => {
    const project = baseProject();
    project.system.battleModel = "gen1";
    project.database.elements = [
      { id: "fire", name: "Fire", kind: "magical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
      { id: "slash", name: "Slash", kind: "physical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
    ];
    // Target with high defense but low mind — magical should do MORE damage than physical.
    const target: BattleBattlerSnapshot = {
      id: "tgt-1",
      recordId: project.database.enemies[0]?.id ?? "enemy-1",
      name: "Tank",
      hp: 9999, maxHp: 9999, mp: 20, maxMp: 20, gauge: 0,
      defeated: false, defending: false, pose: "idle",
      stateIds: [], skillIds: [],
    } as unknown as BattleBattlerSnapshot;
    // Patch enemy stats: high defense, low mind.
    const enemy = project.database.enemies[0];
    enemy.stats = { ...enemy.stats, maxHp: 9999, attack: 10, defense: 100, mind: 5, agility: 10 };

    const power = 200;
    const magicalDmg = predictSkillDamage(project, target, { power, statistic: "attack", effect: "damage", elementId: "fire" }, target);
    const physicalDmg = predictSkillDamage(project, target, { power, statistic: "attack", effect: "damage", elementId: "slash" }, target);

    // Magical divides by mind, physical by defense — gen1 코어 공식(레벨 기반)이라 뺄셈 차이가 아니다.
    // 이 스냅샷은 level 미설정이라 gen1 시전자 레벨은 1 로 폴백한다(실전 배틀러는 항상 level 을 싣는다).
    // magical: base(L1, power 200, A 10, D=mind 5) = 18 → 랜덤 중앙값 floor(18×236/255) = 16
    // physical: base(L1, power 200, A 10, D=defense 100) = 2 → floor(2×236/255) = 1
    expect(magicalDmg.amount).toBeGreaterThan(physicalDmg.amount);
    const expectedMagical = Math.floor((computeGen1BaseDamage({ level: 1, power, attack: 10, defense: 5 }) * GEN1_RANDOM_MEDIAN) / GEN1_RANDOM_MAX);
    const expectedPhysical = Math.floor((computeGen1BaseDamage({ level: 1, power, attack: 10, defense: 100 }) * GEN1_RANDOM_MEDIAN) / GEN1_RANDOM_MAX);
    expect(magicalDmg.amount).toBe(expectedMagical);
    expect(physicalDmg.amount).toBe(expectedPhysical);
  });

  it("no-element (undefined elementId) uses physical defense (default)", () => {
    const project = baseProject();
    const target: BattleBattlerSnapshot = {
      id: "tgt-1",
      recordId: project.database.enemies[0]?.id ?? "enemy-1",
      name: "Tank",
      hp: 9999, maxHp: 9999, mp: 20, maxMp: 20, gauge: 0,
      defeated: false, defending: false, pose: "idle",
      stateIds: [], skillIds: [],
    } as unknown as BattleBattlerSnapshot;
    const enemy = project.database.enemies[0];
    enemy.stats = { ...enemy.stats, maxHp: 9999, attack: 10, defense: 100, mind: 5, agility: 10 };
    // No elementId → physical defense → reduction = 100/2 = 50.
    const dmg = predictSkillDamage(project, target, { power: 200, statistic: "attack", effect: "damage" }, target);
    // Compare with a physical element (same defense path).
    project.database.elements = [
      { id: "slash", name: "Slash", kind: "physical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
    ];
    const physicalDmg = predictSkillDamage(project, target, { power: 200, statistic: "attack", effect: "damage", elementId: "slash" }, target);
    expect(dmg.amount).toBe(physicalDmg.amount);
  });
});

describe("B4: elementRates orphan scrub + re-creation revival hazard", () => {
  function projectWithTwoElements(): Project {
    const project = baseProject();
    project.database.elements = [
      { id: "element_0001", name: "Fire", kind: "physical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
      { id: "element_0002", name: "Ice", kind: "physical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
    ];
    const enemy = project.database.enemies[0];
    enemy.elementRates = { element_0001: "C", element_0002: "A" };
    const actor = project.database.actors[0];
    actor.elementRates = { element_0001: "D", element_0002: "A" };
    return project;
  }

  it("pruneDanglingElementRates removes elementRates keys for deleted elements", () => {
    const project = projectWithTwoElements();
    project.database.elements = resizeElementRecords(project.database.elements!, 1);
    expect(project.database.enemies[0].elementRates?.element_0002).toBe("A");
    pruneDanglingElementRates(project);
    expect(project.database.enemies[0].elementRates?.element_0002).toBeUndefined();
    expect(project.database.actors[0].elementRates?.element_0002).toBeUndefined();
    expect(project.database.enemies[0].elementRates?.element_0001).toBe("C");
    expect(project.database.actors[0].elementRates?.element_0001).toBe("D");
  });

  it("re-growing reuses the same element id but stale grade does NOT revive (scrubbed)", () => {
    const project = projectWithTwoElements();
    project.database.elements = resizeElementRecords(project.database.elements!, 1);
    pruneDanglingElementRates(project);
    project.database.elements = resizeElementRecords(project.database.elements!, 2);
    expect(project.database.elements[1].id).toBe("element_0002");
    expect(project.database.enemies[0].elementRates?.element_0002).toBeUndefined();
    expect(project.database.actors[0].elementRates?.element_0002).toBeUndefined();
  });

  it("repairProjectReferences scrubs dangling elementRates on load", () => {
    const project = projectWithTwoElements();
    project.database.elements = resizeElementRecords(project.database.elements!, 1);
    repairProjectReferences(project);
    expect(project.database.enemies[0].elementRates?.element_0002).toBeUndefined();
    expect(project.database.actors[0].elementRates?.element_0002).toBeUndefined();
    expect(project.database.enemies[0].elementRates?.element_0001).toBe("C");
  });
});

describe("B4b: state_death must not pollute elementRates", () => {
  it("fresh enemy elementRates has no state_death key", () => {
    const enemy = normalizeEnemyRecord({ id: "e1", name: "슬라임" } as Partial<import("@/project/types/database").EnemyRecord> & Pick<import("@/project/types/database").EnemyRecord, "id" | "name">);
    expect(enemy.elementRates?.state_death).toBeUndefined();
    expect(enemy.stateRates?.state_death).toBe("C");
  });

  it("fresh class elementRates has no state_death key", () => {
    const klass = normalizeClassRecord({ id: "c1", name: "전사" } as Partial<import("@/project/types/database").ClassRecord> & Pick<import("@/project/types/database").ClassRecord, "id" | "name">);
    expect(klass.elementRates?.state_death).toBeUndefined();
    expect(klass.stateRates?.state_death).toBe("C");
  });

  it("a blank project passes reference validation with no elementRates issues", () => {
    const project = baseProject();
    const issues = collectProjectReferenceIssues(project);
    const elementRatesIssues = issues.filter((issue) => issue.includes("elementRates key does not exist"));
    expect(elementRatesIssues).toEqual([]);
  });
});
