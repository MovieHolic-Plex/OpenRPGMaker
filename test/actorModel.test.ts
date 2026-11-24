import { describe, expect, it } from "vitest";
import { ACTOR_STATE_RATE_PERCENTAGES, createActorRecord, normalizeActorRecord, parameterValueAtLevel, stateRatePercentage, totalExpForLevel } from "@/project/actorModel";
import { DEFAULT_ANIMATION_ID, DEFAULT_CLASS_ID, DEFAULT_EQUIPMENT_ID, DEFAULT_SKILL_ID, DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize, serialize } from "@/project/io";
import type { Project, ActorAutoTactic, SkillRecord } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { actorFightsAutomatically, chooseAutoBattleCommand } from "@/battle/battleAuto";
import { isolateTimers } from "./mergedTeardown";

describe("actorModel", () => {
  isolateTimers();
  describe("RM2K3 actor model", () => {
    it("creates full RM2K3 actor defaults when a new actor is added", () => {
      const actor = createActorRecord("actor_test", DEFAULT_CLASS_ID, {
        characterResourceId: DEFAULT_EASYRPG_CHARSET_ID,
        battleCharacterResourceId: DEFAULT_EASYRPG_CHARSET_ID,
        defaultEquipmentId: DEFAULT_EQUIPMENT_ID,
        defaultSkillId: DEFAULT_SKILL_ID,
        unarmedAnimationId: DEFAULT_ANIMATION_ID,
      });

      expect(actor.initialLevel).toBe(1);
      expect(actor.maxLevel).toBe(99);
      expect(actor.critical).toEqual({ enabled: true, chanceDenominator: 30 });
      expect(actor.learnedSkills).toEqual([{ level: 1, skillId: DEFAULT_SKILL_ID }]);
      expect(actor.initialEquipment.weapon).toBe(DEFAULT_EQUIPMENT_ID);
      expect(actor.nickname).toBe("");
      expect(actor.stateRates["state_death"]).toBe("C");
      expect(actor.elementRates.sword).toBe("C");
      expect(actor.parameterCurves.maxHp).toHaveLength(99);
      expect(parameterValueAtLevel(actor.parameterCurves.attack, 1)).toBe(45);
    });

    it("normalizes legacy actor skillIds and clamps RM2K3 numeric bounds", () => {
      const actor = normalizeActorRecord({
        id: "actor_legacy",
        name: "Legacy",
        classId: DEFAULT_CLASS_ID,
        initialLevel: -5,
        maxLevel: 500,
        skillIds: [DEFAULT_SKILL_ID],
      });

      expect(actor.initialLevel).toBe(1);
      expect(actor.maxLevel).toBe(99);
      expect(actor.nickname).toBe("");
      expect(actor.learnedSkills).toEqual([{ level: 1, skillId: DEFAULT_SKILL_ID }]);
      expect(actor.critical.chanceDenominator).toBe(30);
      expect(actor.options.dualWield).toBe(false);
    });

    it("restores the default hero charset for persisted actors missing a character resource", () => {
      const actor = normalizeActorRecord({
        id: "actor_hero",
        name: "주인공",
        classId: DEFAULT_CLASS_ID,
        initialLevel: 1,
        maxLevel: 99,
      });

      expect(actor.characterResourceId).toBe("easyrpg-charset-actor1");
      expect(actor.faceResourceId).toBe("easyrpg-faceset-actor1-00");
    });

    it("does not synthesize non-hero character resources for persisted actors", () => {
      const actor = normalizeActorRecord({
        id: "actor_cleric",
        name: "성직자",
        classId: DEFAULT_CLASS_ID,
        initialLevel: 1,
        maxLevel: 99,
      });

      expect(actor.characterResourceId).toBeUndefined();
      // 걷기 그림이 없으면 짝을 정할 근거가 없다 — 이름(actor_cleric)으로 얼굴을 지어내지 않는다.
      expect(actor.faceResourceId).toBeUndefined();
    });

    it("calculates total EXP from the actor experience curve", () => {
      const actor = createActorRecord("actor_test", DEFAULT_CLASS_ID);

      expect(totalExpForLevel(actor.expCurve, 1)).toBe(0);
      expect(totalExpForLevel(actor.expCurve, 2)).toBeGreaterThan(actor.expCurve.base);
      expect(totalExpForLevel(actor.expCurve, 99)).toBeGreaterThan(totalExpForLevel(actor.expCurve, 50));
    });

    it("maps RM2K3 state rate grades to descending manual probabilities", () => {
      expect(ACTOR_STATE_RATE_PERCENTAGES).toEqual({ A: 100, B: 80, C: 60, D: 30, E: 0 });
      expect(stateRatePercentage("A")).toBeGreaterThan(stateRatePercentage("B"));
      expect(stateRatePercentage("B")).toBeGreaterThan(stateRatePercentage("C"));
      expect(stateRatePercentage("C")).toBeGreaterThan(stateRatePercentage("D"));
      expect(stateRatePercentage("D")).toBeGreaterThan(stateRatePercentage("E"));
    });
  });
});

describe("battleRuntimeStates", () => {
  isolateTimers();
  function battleProject(): Project {
    return deserialize(JSON.stringify(battleFixture));
  }
  describe("battle runtime — 상태이상 연결", () => {
    it("상태 부여 스킬을 명중시키면 대상 stateIds 에 상태가 실린다", () => {
      const project = battleProject();
      // fixture 의 화염 스킬에 독 부여 효과를 붙인다(확률 100).
      const fire = project.database.skills.find((skill) => skill.id === "skill_fire");
      if (!fire) throw new Error("missing skill_fire");
      fire.stateEffects = [{ stateId: "state_burn", chance: 100, operation: "add" }];
      fire.mpCost = { flat: 0, percentMax: 0 };
      const actor = project.database.actors.find((record) => record.id === "actor_hero");
      if (actor) actor.learnedSkills = [{ level: 1, skillId: "skill_fire" }];
      const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
      if (enemy) enemy.stats = { ...enemy.stats, maxHp: 9999 };

      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true });
      runtime.tick(1_000);
      runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });

      expect(runtime.snapshot().enemies[0]?.stateIds).toContain("state_burn");
    });

    it("승리 시 파티 정보를 주면 레벨업 미리보기를 보상 스냅샷에 담는다", () => {
      const project = battleProject();
      const hero = normalizeActorRecord(project.database.actors[0]);
      const bigExp = totalExpForLevel(hero.expCurve, 5);
      const slime = project.database.enemies.find((record) => record.id === "enemy_slime");
      if (slime) slime.stats = { ...slime.stats, maxHp: 1, defense: 0 };

      const runtime = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        party: { levels: { actor_hero: 1 }, experience: { actor_hero: bigExp } },
      });
      for (let i = 0; i < 500; i += 1) {
        runtime.tick(50);
        if (runtime.snapshot().phase === "actorCommand") break;
      }
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

      const snapshot = runtime.snapshot();
      expect(snapshot.result).toBe("victory");
      expect(snapshot.rewards.levelUps?.length).toBeGreaterThan(0);
      expect(snapshot.rewards.levelUps?.[0]?.toLevel).toBeGreaterThan(1);
    });

    it("파티 정보가 없으면 레벨업 미리보기를 계산하지 않는다", () => {
      const runtime = createBattleRuntime({ project: battleProject(), troopId: "troop_slime", canEscape: true, canLose: true });
      runtime.tick(1_000);
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().rewards.levelUps).toEqual([]);
    });
  });
});

describe("battleSessionLevel", () => {
  isolateTimers();
  function battleProject(): Project {
    return deserialize(JSON.stringify(battleFixture));
  }
  function heroMaxHpAtLevel(project: Project, level: number): number {
    return parameterValueAtLevel(normalizeActorRecord(project.database.actors[0]).parameterCurves.maxHp, level);
  }
  describe("battle runtime — 세션 레벨/바이탈 반영", () => {
    it("세션 액터 레벨이 있으면 그 레벨의 파라미터 곡선으로 능력치를 산출한다", () => {
      const project = battleProject();
      const leveled = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        party: { levels: { actor_hero: 40 }, experience: {} },
      });
      const actor = leveled.snapshot().actors[0];
      expect(actor?.maxHp).toBe(heroMaxHpAtLevel(project, 40));
      // 레벨업 전(레벨1) 능력치보다 확실히 높다.
      expect(actor?.maxHp).toBeGreaterThan(heroMaxHpAtLevel(project, 1));
    });

    it("세션 레벨이 없으면 DB initialLevel(레벨1)로 폴백한다", () => {
      const project = battleProject();
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true });
      // 회귀: fixture 주인공 레벨1 maxHp = 514.
      expect(runtime.snapshot().actors[0]?.maxHp).toBe(514);
      expect(runtime.snapshot().actors[0]?.maxHp).toBe(heroMaxHpAtLevel(project, 1));
    });

    it("세션 현재 바이탈(부상 상태)을 전투 진입 시 이어받되 현재 레벨 최대치로 클램프한다", () => {
      const project = battleProject();
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        party: { levels: { actor_hero: 40 }, experience: {}, vitals: { actor_hero: { hp: 12, mp: 3 } } },
      });
      const actor = runtime.snapshot().actors[0];
      // 필드에서 이어지는 부상 HP/MP 를 그대로 유지.
      expect(actor?.hp).toBe(12);
      expect(actor?.mp).toBe(3);
      expect(actor?.maxHp).toBe(heroMaxHpAtLevel(project, 40));
    });

    it("세션 바이탈이 현재 레벨 최대치를 넘으면 최대치로 잘린다", () => {
      const project = battleProject();
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        party: { levels: { actor_hero: 1 }, experience: {}, vitals: { actor_hero: { hp: 999_999, mp: 999_999 } } },
      });
      const actor = runtime.snapshot().actors[0];
      expect(actor?.hp).toBe(actor?.maxHp);
      expect(actor?.maxHp).toBe(514);
    });

    it("세션 파라미터 보정과 상태 이상을 전투 액터에 반영한다", () => {
      const project = battleProject();
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        party: {
          levels: { actor_hero: 1 },
          experience: {},
          paramBonuses: { actor_hero: { maxHp: 25, attack: 7 } },
          stateIds: { actor_hero: ["state_poison"] },
        },
      });
      const actor = runtime.snapshot().actors[0];
      expect(actor?.maxHp).toBe(heroMaxHpAtLevel(project, 1) + 25);
      expect(actor?.hp).toBe(actor?.maxHp);
      expect(actor?.stateIds).toEqual(["state_poison"]);
    });
  });
});

describe("mgL2BflowTactics", () => {
  isolateTimers();
  function skill(id: string, name: string, patch: Partial<SkillRecord>): SkillRecord {
    return {
      id, name, scope: "enemy", power: 30, description: "", type: "normal",
      mpCost: { flat: 0, percentMax: 0 }, successRate: 100, variance: 0, hitRate: 100,
      effect: { kind: "damage", statistic: "attack", affects: "hp" },
      ...patch,
    } as SkillRecord;
  }
  /** 배우: 비싼 광역기(MP 10), 공짜 단일기(MP 0), 회복기(MP 5). HP 는 60% 로 시작. */
  function tacticsProject(tactic?: ActorAutoTactic, autoBattle = true): Project {
    const project = deserialize(JSON.stringify(battleFixture));
    project.database.skills.push(
      skill("skill_blast", "폭발", { power: 200, mpCost: { flat: 10, percentMax: 0 } }),
      skill("skill_jab", "잽", { power: 5 }),
      skill("skill_heal", "치유", { scope: "ally", power: 50, mpCost: { flat: 5, percentMax: 0 }, effect: { kind: "healing", statistic: "mind", affects: "hp" } }),
    );
    // 직업이 주는 화염도 MP 를 쓰게 해 "MP 0 기술" 은 잽 하나만 남긴다.
    project.database.skills.find((record) => record.id === "skill_fire")!.mpCost = { flat: 4, percentMax: 0 };
    const hero = project.database.actors.find((record) => record.id === "actor_hero")!;
    hero.learnedSkills = [{ level: 1, skillId: "skill_blast" }, { level: 1, skillId: "skill_jab" }, { level: 1, skillId: "skill_heal" }];
    hero.options = { ...hero.options, autoBattle, ...(tactic ? { autoTactic: tactic } : {}) };
    const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
    slime.stats = { ...slime.stats, maxHp: 9999, attack: 1 };
    return project;
  }
  function heroMaxHp(project: Project): number {
    return createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 }).snapshot().actors[0]!.maxHp;
  }
  function firstStrictCommand(tactic: ActorAutoTactic | undefined, hpRatio: number) {
    const project = tacticsProject(tactic);
    const maxHp = heroMaxHp(project);
    const runtime = createBattleRuntime({
      project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5,
      party: { vitals: { actor_hero: { hp: Math.floor(maxHp * hpRatio), mp: 999 } } },
    });
    // 자동 배우는 명령 메뉴 없이 첫 라운드가 해결된다.
    return runtime.snapshot().roundLogs[0]?.actions.find((action) => action.side === "actor");
  }
  describe("mg-l2-bflow #11 배우별 자동 전투 작전", () => {
    it("autoBattle 배우는 strict 에서 명령 메뉴를 열지 않고 첫 라운드를 스스로 해결한다", () => {
      const action = firstStrictCommand(undefined, 1);
      expect(action).toBeDefined();
    });

    it("수동 배우(autoBattle 꺼짐)와 followOrders 는 명령 메뉴를 연다", () => {
      for (const project of [tacticsProject(undefined, false), tacticsProject("followOrders")]) {
        const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
        expect(runtime.snapshot().phase).toBe("actorCommand");
        expect(runtime.snapshot().roundLogs).toHaveLength(0);
      }
      expect(actorFightsAutomatically(tacticsProject("followOrders"), "actor_hero", undefined)).toBe(false);
      expect(actorFightsAutomatically(tacticsProject("attackAll"), "actor_hero", undefined)).toBe(true);
    });

    it("HP 60% 에서 회복 우선은 치유, 전원 공격·균형은 공격한다", () => {
      expect(firstStrictCommand("healFirst", 0.6)?.skillName).toBe("치유");
      expect(firstStrictCommand("attackAll", 0.6)?.skillName).toBe("폭발");
      expect(firstStrictCommand(undefined, 0.6)?.skillName).toBe("폭발");
    });

    it("MP 아끼기는 MP 를 쓰는 폭발 대신 공짜 잽을 쓰고, 위급(HP 20%)할 때만 회복한다", () => {
      expect(firstStrictCommand("conserveMp", 1)?.skillName).toBe("잽");
      expect(firstStrictCommand("conserveMp", 0.2)?.skillName).toBe("치유");
      expect(firstStrictCommand("conserveMp", 0.3)?.skillName).toBe("잽");
    });

    it("gauge 에서도 자동 배우는 차례가 오자마자 행동하고 게이지를 비운다", () => {
      const runtime = createBattleRuntime({ project: tacticsProject("attackAll"), troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "gauge", rng: () => 0.5 });
      for (let index = 0; index < 40 && !runtime.snapshot().timeline.some((entry) => entry.side === "actor" && entry.kind === "damage"); index += 1) {
        runtime.tick(250);
        expect(runtime.snapshot().phase).not.toBe("actorCommand");
      }
      const hit = runtime.snapshot().timeline.find((entry) => entry.side === "actor" && entry.kind === "damage");
      expect(hit?.skillName).toBe("폭발");
    });

    it("chooseAutoBattleCommand 에 작전을 직접 넘길 수 있다(자동 버튼 경로)", () => {
      const project = tacticsProject(undefined, false);
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, battleFlow: "strict", rng: () => 0.5 });
      expect(chooseAutoBattleCommand(project, runtime.snapshot(), () => 0.5, "conserveMp")).toMatchObject({ kind: "skill", skillId: "skill_jab" });
    });

    it("autoTactic 은 정규화·저장을 지나고 알 수 없는 값은 버린다", () => {
      const project = tacticsProject("healFirst");
      expect(deserialize(serialize(project)).database.actors.find((record) => record.id === "actor_hero")?.options.autoTactic).toBe("healFirst");
      const hero = project.database.actors.find((record) => record.id === "actor_hero")!;
      const junk = normalizeActorRecord({ ...hero, options: { ...hero.options, autoTactic: "panic" as ActorAutoTactic } });
      expect(junk.options.autoTactic).toBeUndefined();
    });
  });
});
