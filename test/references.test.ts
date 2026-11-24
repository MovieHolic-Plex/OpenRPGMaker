import { describe, expect, it, beforeEach } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { repairProjectReferences, pruneDanglingElementRates, collectProjectReferenceIssues, validateProjectReferences } from "@/project/io/references";
import { resizeElementRecords } from "@/editor/databaseElementList";
import { battlerTypes, typeChartMultiplierForTypes } from "@/battle/typeChart";
import { predictSkillDamage, isMagicalElement } from "@/battle/battlePredict";
import { computeGen1BaseDamage, GEN1_RANDOM_MAX, GEN1_RANDOM_MEDIAN } from "@/battle/battleDamage";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import { normalizeClassRecord } from "@/project/databaseRecordModel";
import type { BattleBattlerSnapshot } from "@/battle/types";
import type { Project } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { databaseReferenceMessage, switchVariableReferenceMessage } from "@/editor/databaseReferences";
import { store } from "@/project/store";
import { isolateTimers } from "./mergedTeardown";

// B1/B2/B4/B4b 적대적 리뷰 회귀 테스트.
// B1: predictSkillDamage 가 플레이어 몬스터(recordId=instanceId, speciesId 유) 공격 시
//     타입 상성 + STAB 을 runtime 과 동일하게 반영해야 한다.
// B2: element.kind 가 "magical" 이면 데미지 감소에 target.mind(마법 방어력) 를 쓴다.
// B4: 요소 축소/삭제 시 actor/enemy/class 의 elementRates 잔재가 정리되어야 하며,
//     같은 ordinal 로 id 재생성 시 stale 등급이 소생하지 않아야 한다.
// B4b: state_death 가 elementRates 에 섞이지 않아야 한다.
describe("battleElementAdversarialFixes", () => {
  isolateTimers();
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
      // Gen1 Special supplies both magical offense and defense, regardless of spec.statistic.
      // magical: base(L1, power 200, A=mind 5, D=mind 5) = 10 → floor(10×236/255) = 9
      // physical: base(L1, power 200, A 10, D=defense 100) = 2 → floor(2×236/255) = 1
      expect(magicalDmg.amount).toBeGreaterThan(physicalDmg.amount);
      const expectedMagical = Math.floor((computeGen1BaseDamage({ level: 1, power, attack: 5, defense: 5 }) * GEN1_RANDOM_MEDIAN) / GEN1_RANDOM_MAX);
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
});

describe("itemQaFixture", () => {
  isolateTimers();
  const FIXTURE_PATH = join(process.cwd(), "test/fixtures/projects/item-runtime-qa-v3.json");
  const DEMO_PATH = join(process.cwd(), "test/fixtures/projects/editor-authored-demo-v3.json");
  /**
   * 런타임 QA 시나리오가 실제 기본 아이템을 만지려면 인벤토리에 이 일곱 갈래가 들어 있어야 한다.
   * scripts/build-item-qa-fixture.mjs 의 SEEDED_ITEMS 와 같은 목록이다 — 생성기가 성격까지
   * 실데이터로 확인하고, 여기서는 커밋된 결과물이 그 계약을 지키는지 본다.
   */
  const SEEDED_ITEM_IDS = [
    "item_potion",
    "item_ether",
    "item_antidote_plus",
    "item_gen2_party_potion",
    "item_gen2_war_draught",
    "item_gen2_frost_vial",
    "item_gen2_twin_dose_kit",
  ] as const;
  function loadFixture() {
    return deserialize(readFileSync(FIXTURE_PATH, "utf8"));
  }
  describe("아이템 런타임 QA 픽스처", () => {
    it("실제 로드 경로로 열리고 참조 검증도 통과한다", () => {
      const project = loadFixture();

      expect(() => validateProjectReferences(project)).not.toThrow();
    });

    it("출하 기본 아이템 카탈로그를 통째로 싣는다", () => {
      const project = loadFixture();
      const itemIds = new Set(project.database.items.map((item) => item.id));
      const shipped = createBlankProject().database;

      const missing = shipped.items.map((item) => item.id).filter((id) => !itemIds.has(id));
      expect(missing, `기본 카탈로그 누락: ${missing.join(", ")}`).toEqual([]);
      // 아이템이 가리키는 스킬·상태·애니메이션도 같은 규칙으로 실려야 참조가 산다.
      for (const [label, records] of [
        ["skills", shipped.skills],
        ["states", shipped.states],
        ["battleAnimations", shipped.battleAnimations],
        ["equipment", shipped.equipment],
      ] as const) {
        const present = new Set(project.database[label].map((record) => record.id));
        const gaps = records.map((record) => record.id).filter((id) => !present.has(id));
        expect(gaps, `${label} 누락: ${gaps.join(", ")}`).toEqual([]);
      }
    });

    it("데모 픽스처의 레코드와 시작 상태를 병합 뒤에도 그대로 지킨다", () => {
      const project = loadFixture();
      const demo = deserialize(readFileSync(DEMO_PATH, "utf8"));

      // 알려진 전투 경로(map_lantern_village → map_moonwell_forest)의 전제.
      expect(project.startMapId).toBe(demo.startMapId);
      expect(project.startPos).toEqual(demo.startPos);
      expect(project.session.partyActorIds).toEqual(demo.session.partyActorIds);

      for (const demoItem of demo.database.items) {
        expect(project.database.items.find((item) => item.id === demoItem.id), demoItem.id).toEqual(demoItem);
      }
      expect(Object.keys(project.maps).sort()).toEqual(Object.keys(demo.maps).sort());
      expect(project.database.troops.map((troop) => troop.id)).toEqual(demo.database.troops.map((troop) => troop.id));
    });

    it("시드된 일곱 갈래를 인벤토리에 3개 이상씩 들고 있다", () => {
      const project = loadFixture();
      const itemById = new Map(project.database.items.map((item) => [item.id, item]));

      for (const id of SEEDED_ITEM_IDS) {
        expect(itemById.get(id), id).toBeTruthy();
        expect(project.session.inventory[id] ?? 0, id).toBeGreaterThanOrEqual(3);
      }

      // 성격이 서로 다른 실행 경로여야 QA 가 의미를 갖는다.
      expect(itemById.get("item_potion")?.hpRecovery.flat).toBeGreaterThan(0);
      expect(itemById.get("item_ether")?.mpRecovery.flat).toBeGreaterThan(0);
      expect(itemById.get("item_antidote_plus")?.healStateIds.length).toBeGreaterThan(0);
      expect(itemById.get("item_gen2_party_potion")?.scope).toBe("allAllies");
      expect(itemById.get("item_gen2_war_draught")?.stateEffects).toEqual(
        expect.arrayContaining([expect.objectContaining({ operation: "add" })])
      );
      expect(itemById.get("item_gen2_frost_vial")).toMatchObject({ scope: "enemy", skillId: "skill_item_frost_vial" });
      expect(itemById.get("item_gen2_twin_dose_kit")?.consumptionLimit).toBeGreaterThan(1);
    });
  });
});

describe("itemSwitchReferences", () => {
  isolateTimers();
  function firstSwitchItem(project: Project) {
    const item = project.database.items.find((entry) => entry.type === "switch" && entry.switchId);
    if (!item) throw new Error("default catalog must ship a switch item");
    return item;
  }
  describe("item switchId reference integrity", () => {
    it("스위치 아이템이 선언되지 않은 스위치를 가리키면 참조 오류로 보고한다", () => {
      const project = createBlankProject();
      const item = firstSwitchItem(project);
      item.switchId = "sw_never_declared";

      const issues = collectProjectReferenceIssues(project);

      expect(issues.some((issue) => issue.includes(item.id) && issue.includes("switchId"))).toBe(true);
    });

    it("repairProjectReferences는 아이템이 켜는 스위치 정의를 자동 선언한다", () => {
      const project = createBlankProject();
      const item = firstSwitchItem(project);
      const switchId = item.switchId!;
      project.switches = project.switches.filter((entry) => entry.id !== switchId);
      delete project.session.switches[switchId];

      repairProjectReferences(project);

      expect(project.switches.some((entry) => entry.id === switchId)).toBe(true);
      expect(project.session.switches[switchId]).toBe(false);
      expect(collectProjectReferenceIssues(project).filter((issue) => issue.includes("switchId"))).toEqual([]);
    });

    it("deserialize는 아이템 스위치 정의가 빠진 저장본을 복구해 로드한다", () => {
      const project = createBlankProject();
      const item = firstSwitchItem(project);
      const switchId = item.switchId!;
      const obj = JSON.parse(serialize(project)) as {
        switches: { id: string }[];
        session: { switches: Record<string, boolean> };
      };
      obj.switches = obj.switches.filter((entry) => entry.id !== switchId);
      delete obj.session.switches[switchId];

      const restored = deserialize(JSON.stringify(obj));

      expect(restored.switches.some((entry) => entry.id === switchId)).toBe(true);
    });
  });
  // 2026-09-24 감성 스토리 r3: rename_switch 가 to 로 id 를 바꾸면 item.switchId 등 DB 참조를
  // 함께 치환하지 않아 무결성 검증이 커밋을 거부했다(같은 인자로 11회 반복 실패 — item_gen2_*_relay).
  describe("rename_switch DB 스위치 참조 치환", () => {
    it("id 치환은 item.switchId 까지 옮겨 커밋을 통과한다", () => {
      const project = createBlankProject();
      const item = firstSwitchItem(project);
      const oldId = item.switchId!;
      const ctx = { project };

      const result = runTool(ctx, "rename_switch", { fromId: oldId, to: "sw_story_memento_done" }, { dryRun: false });

      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      const moved = ctx.project.database.items.find((entry) => entry.id === item.id);
      expect(moved?.switchId).toBe("sw_story_memento_done");
      expect(collectProjectReferenceIssues(ctx.project).filter((issue) => issue.includes("switchId"))).toEqual([]);
    });

    it("모델이 자주 보내는 {id, name} 을 대상 별칭으로 받는다", () => {
      const project = createBlankProject();
      const item = firstSwitchItem(project);
      const oldId = item.switchId!;
      const ctx = { project };

      const result = runTool(ctx, "rename_switch", { id: oldId, name: "자장가 열쇠" }, { dryRun: false });

      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(ctx.project.switches.find((entry) => entry.id === oldId)?.name).toBe("자장가 열쇠");
    });
  });
});

describe("lifeAuthoringReferences", () => {
  isolateTimers();
  describe("life authoring reference integrity", () => {
    beforeEach(() => store.replace(createBlankProject()));

    // Break caught: records created by the life UI can point at missing switches, recipes, or items without lint errors.
    it("reports every switch, recipe, and item reference exposed by the structured forms", () => {
      const project = createBlankProject();
      project.database.lifeSkills = [{
        id: "life_farming",
        name: "농사",
        skillType: "farming",
        maxLevel: 10,
        levelUpRewards: [{ level: 2, switchId: "missing_switch", recipeId: "missing_recipe" }],
      }];
      project.system.craftRecipes = [{
        id: "recipe_broken",
        ingredients: [{ itemId: "missing_ingredient", count: 1 }],
        outputItemId: "missing_output",
      }];
      project.system.itemUpgrades = [{
        id: "upgrade_broken",
        fromItemId: "missing_from",
        toItemId: "missing_to",
        ingredients: [{ itemId: "missing_upgrade_material", count: 1 }],
      }];
      project.system.sellPrices = [{ itemId: "missing_sell", price: 10 }];
      project.system.toolActions = [{ id: "tool_broken", itemId: "missing_tool", action: "till" }];

      const issues = collectProjectReferenceIssues(project).join("\n");

      for (const id of [
        "missing_switch", "missing_recipe", "missing_ingredient", "missing_output", "missing_from",
        "missing_to", "missing_upgrade_material", "missing_sell", "missing_tool",
      ]) expect(issues).toContain(id);
    });

    // Break caught: the separately developed P0 and editor validators both report
    // the same life-skill reward reference after integration.
    it("reports each missing life-skill reward reference once", () => {
      const project = createBlankProject();
      project.database.lifeSkills = [{
        id: "life_farming",
        name: "농사",
        skillType: "farming",
        maxLevel: 10,
        levelUpRewards: [{ level: 2, switchId: "missing_switch", recipeId: "missing_recipe" }],
      }];
      project.system.skillSystem = { enabled: true };

      const issues = collectProjectReferenceIssues(project);

      expect(issues.filter((issue) => issue.includes("missing_switch"))).toHaveLength(1);
      expect(issues.filter((issue) => issue.includes("missing_recipe"))).toHaveLength(1);
    });

    // Break caught: deleting an item or switch used by life authoring is allowed by the editor guard.
    it("blocks item and switch deletion when life records still reference them", () => {
      const project = store.getCurrent();
      const itemId = project.database.items[0]?.id;
      const switchId = project.switches[0]?.id;
      if (!itemId || !switchId) throw new Error("missing default ids");
      project.system.craftRecipes = [{ id: "recipe", ingredients: [], outputItemId: itemId }];
      project.database.lifeSkills = [{
        id: "life_farming",
        name: "농사",
        skillType: "farming",
        maxLevel: 10,
        levelUpRewards: [{ level: 2, switchId }],
      }];
      store.replace(project);

      expect(databaseReferenceMessage("items", itemId)).toContain("제작");
      expect(switchVariableReferenceMessage("switch", switchId)).toContain("생활 기술");
    });

    // Break caught: ambiguous sell-price keys and duplicate tool rule ids are accepted silently.
    it("reports duplicate sell-price item keys and tool-action ids", () => {
      const project = createBlankProject();
      const itemId = project.database.items[0]?.id;
      if (!itemId) throw new Error("missing default item");
      project.system.sellPrices = [{ itemId, price: 10 }, { itemId, price: 20 }];
      project.system.toolActions = [
        { id: "same-tool-rule", itemId, action: "till" },
        { id: "same-tool-rule", itemId, action: "water" },
      ];

      const issues = collectProjectReferenceIssues(project).join("\n");

      expect(issues).toContain(`sellPrices: duplicate itemId: ${itemId}`);
      expect(issues).toContain("toolAction same-tool-rule: duplicate id");
    });

    // Break caught: P0 package FKs are linted by ProjectIO but item/switch delete
    // actions do not consult those package references before removing the target.
    it("blocks item and switch deletion for shipping, bundle, maker, and unlock references", () => {
      const project = store.getCurrent();
      const itemId = project.database.items[0]?.id;
      const switchId = project.switches[0]?.id;
      if (!itemId || !switchId) throw new Error("missing defaults");
      project.system.shipping = { enabled: true, allowedItemIds: [itemId] };
      project.system.worldUnlocks = [{ id: "unlock", switchId }];
      project.system.bundles = [{
        id: "bundle",
        requirements: [{ itemId, count: 1 }],
        reward: { itemRewards: [{ itemId, count: 2 }], switchId },
      }];
      project.system.makers = [{ id: "maker", inputs: [{ itemId, count: 1 }], outputs: [{ itemId, count: 1 }], durationMinutes: 60 }];
      store.replace(project);

      expect(databaseReferenceMessage("items", itemId)).toMatch(/출하|꾸러미|가공/);
      expect(switchVariableReferenceMessage("switch", switchId)).toMatch(/지역 해금|꾸러미/);
    });

    // Break caught: a UI-authored nested P0 package can look correct in memory
    // while being dropped or reshaped by normalize/serialize.
    it("preserves the complete structured P0 package shape through serialization", () => {
      const project = createBlankProject();
      const itemId = project.database.items[0]?.id;
      const switchId = project.switches[0]?.id;
      if (!itemId || !switchId) throw new Error("missing defaults");
      project.system.energy = { max: 180, initial: 120, restorePerDay: 90 };
      project.system.shipping = { enabled: false, historyLimit: 14, allowedItemIds: [itemId] };
      project.system.craftRecipes = [{ id: "recipe", ingredients: [{ itemId, count: 2 }], outputItemId: itemId, requiresUnlock: true }];
      project.system.itemUpgrades = [{
        id: "upgrade",
        fromItemId: itemId,
        toItemId: itemId,
        capability: { areaWidth: 3, areaHeight: 2, energyMultiplier: 0.75 },
      }];
      project.system.worldUnlocks = [{ id: "unlock", name: "다리", switchId }];
      project.system.bundles = [{
        id: "bundle",
        name: "봄 꾸러미",
        requirements: [{ itemId, count: 3 }],
        reward: { gold: 500, itemRewards: [{ itemId, count: 1 }], switchId, worldUnlockIds: ["unlock"], recipeIds: ["recipe"] },
      }];
      project.system.makers = [{ id: "maker", name: "프레스", inputs: [{ itemId, count: 1 }], outputs: [{ itemId, count: 1 }], durationMinutes: 120 }];

      const restored = deserialize(serialize(project));

      expect(restored.system).toMatchObject({
        energy: project.system.energy,
        shipping: project.system.shipping,
        craftRecipes: project.system.craftRecipes,
        itemUpgrades: project.system.itemUpgrades,
        worldUnlocks: project.system.worldUnlocks,
        bundles: project.system.bundles,
        makers: project.system.makers,
      });
    });
  });
});
