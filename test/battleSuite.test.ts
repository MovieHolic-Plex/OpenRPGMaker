import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { resolveBattleBackdrop } from "@/battle/battleBackdrop";
import type { Project, EnemyRecord, StateRecord, MonsterSpeciesRecord } from "@/project/types";
import { damageTypeMultiplier, battleEffectivenessMultiplier, battleElementMultiplier } from "@/battle/battleElementModifiers";
import { loadBattleFixture } from "./fixtures/battleFixtureLoadable";
import { nextLivingBattler } from "@/battle/battleTargetResolver";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { enemyActionDirectorState } from "@/player/battleDirectorDom";
import { store } from "@/project/store";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";
import { RETRO_CLASS_SKILLS } from "@/assets/retroClassSkills";
import { retroClassSkillTimeline, retroSoundForLayer } from "@/battle/retroSkillTimeline";
import { computeActorLevelUp } from "@/battle/battleLevelUp";
import { normalizeActorRecord, parameterValueAtLevel, totalExpForLevel } from "@/project/actorModel";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { startSession } from "@/project/session";
import { giveMonster } from "@/project/monsterCollection";
import { isBattleItemUserEligible } from "@/battle/battleItemEligibility";
import * as advanceModule from "@/battle/battleRuntimeAdvance";
import { createBattleSequencer, BATTLE_ACTING_MS, BATTLE_HITSTOP_MS, BATTLE_IMPACT_MS, BATTLE_RESULT_HOLD_MS, BATTLE_RESOLVE_MS, tempoActionBeats } from "@/player/battleSequencer";
import { planActionBeats } from "@/player/battleActionBeats";
import { agilityMultiplierForStates, applyStateEffects, attackMultiplierForStates, canBattlerAct, clearBattleEndStates, defenseMultiplierForStates, recoverStatesWhenHit, runStateUpkeep, stateBehavior, stateResistancePercent } from "@/battle/battleStates";
import type { MutableBattler } from "@/battle/battleBattlers";
import { runTool } from "@/editor/tools";
import { simulateBattle } from "@/battle/simulate";
import { isolateTimers } from "./mergedTeardown";

describe("battleBackdropDungeonMap", () => {
  isolateTimers();
  // jrpg-real-1 J08: 지하묘지 박쥐 전투가 숲 배경이었다(적 그룹이 숲 값을 들고 있고, 맵 battleBackground 는 런타임이 읽지 않았다).
  function withMap(patch: Record<string, unknown>, troopBg = "battle-scenery-forest"): Project {
    const project = createBlankProject();
    const mapId = project.startMapId;
    Object.assign(project.maps[mapId]!, patch);
    project.database.troops.push({ id: "troop_t", name: "t", enemyIds: [project.database.enemies[0]!.id], battleEventPages: [], previewBackgroundResourceId: troopBg } as never);
    return project;
  }
  const at = (project: Project) => ({ project, troopId: "troop_t", location: { mapId: project.startMapId, x: 1, y: 1 } });
  describe("resolveBattleBackdrop map-aware fallbacks (J08)", () => {
    it("a dungeon-named map beats the troop's default forest value", () => {
      expect(resolveBattleBackdrop(at(withMap({ name: "고대 지하묘지" })))).toBe("battle-scenery-cave");
    });
    it("an authored map battleBackground is honoured", () => {
      expect(resolveBattleBackdrop(at(withMap({ name: "마을", battleBackground: "battle-scenery-desert" })))).toBe("battle-scenery-desert");
    });
    it("a non-forest troop background still wins", () => {
      expect(resolveBattleBackdrop(at(withMap({ name: "고대 지하묘지" }, "battle-scenery-snow")))).toBe("battle-scenery-snow");
    });
    it("a plain forest map keeps the forest", () => {
      expect(resolveBattleBackdrop(at(withMap({ name: "숲길" })))).toBe("battle-scenery-forest");
    });
    // jrpg-loop-1 ct1: 안개 낀 「멸망한 폐허 크로노폴리스(미래)」 보스전이 울창한 숲에서 벌어졌다 — 맵 이름이 장소의 성격이다.
    it("a ruined-city or town name gets the open plains, not the forest default", () => {
      expect(resolveBattleBackdrop(at(withMap({ name: "멸망한 폐허 크로노폴리스(미래 A.D. 2300)" })))).toBe("battle-scenery-plains");
      expect(resolveBattleBackdrop(at(withMap({ name: "시간의 마을 크로노폴리스(현재)" })))).toBe("battle-scenery-plains");
    });
    it("a desert name gets the desert; a name that also says forest keeps the forest", () => {
      expect(resolveBattleBackdrop(at(withMap({ name: "모래바람 사막 도시" })))).toBe("battle-scenery-desert");
      expect(resolveBattleBackdrop(at(withMap({ name: "고대의 숲 마을" })))).toBe("battle-scenery-forest");
    });
  });
});

describe("battleDamageTypeRates", () => {
  isolateTimers();
  // 받는 피해 계열(물리·마법) — 적 기본값과 상태 덮어쓰기(2026-10-24, 폴른 스타 「달빛의 용」·「관통상」).

  function project(): Project {
    const p = loadBattleFixture();
    const template = p.database.enemies[0]!;
    p.database.enemies.push({ ...template, id: "enemy_scaled", name: "비늘 짐승", damageTypeRates: { magic: 0 } } as EnemyRecord);
    p.database.states.push({ id: "state_pierced", name: "관통상", runtimeEffects: { damageTypeRates: { magic: 300 } } } as StateRecord);
    return p;
  }
  const target = (recordId: string, stateIds: string[] = []) => ({ recordId, stateIds }) as never;
  describe("damageTypeMultiplier", () => {
    it("적 기본값: 마법 0% 는 0배, 적지 않은 계열은 1배", () => {
      const p = project();
      expect(damageTypeMultiplier(p, "magic", target("enemy_scaled"))).toBe(0);
      expect(damageTypeMultiplier(p, "physical", target("enemy_scaled"))).toBe(1);
    });

    it("상태의 계열 비율은 기본값을 갈아 끼운다(관통상 → 마법 3배)", () => {
      const p = project();
      expect(damageTypeMultiplier(p, "magic", target("enemy_scaled", ["state_pierced"]))).toBe(3);
      expect(damageTypeMultiplier(p, "physical", target("enemy_scaled", ["state_pierced"]))).toBe(1);
    });

    it("값이 없는 적·배우는 1배", () => {
      const p = project();
      expect(damageTypeMultiplier(p, "magic", target("actor_unknown"))).toBe(1);
    });
  });
  describe("damageTypeMultiplier — 속성 예외(elements)", () => {
    function machine(): Project {
      const p = project();
      const template = p.database.enemies[0]!;
      p.database.enemies.push({ ...template, id: "enemy_machine", name: "기계", damageTypeRates: { physical: 0, magic: 25, elements: { thunder: 200 } } } as EnemyRecord);
      p.database.states.push({ id: "state_machine", name: "기계 형태", runtimeEffects: { damageTypeRates: { physical: 0, magic: 25, elements: { thunder: 200 } } } } as StateRecord);
      return p;
    }

    it("적 기본값: 속성 예외가 계열 값을 대신한다(번개는 물리든 마법이든 2배)", () => {
      const p = machine();
      expect(damageTypeMultiplier(p, "physical", target("enemy_machine"))).toBe(0);
      expect(damageTypeMultiplier(p, "magic", target("enemy_machine"), "fire")).toBe(0.25);
      expect(damageTypeMultiplier(p, "magic", target("enemy_machine"), "thunder")).toBe(2);
      expect(damageTypeMultiplier(p, "physical", target("enemy_machine"), "thunder")).toBe(2);
    });

    it("상태가 출처째로 갈아 끼운다 — 마법 무효 적도 기계 형태 상태 동안은 번개 2배·물리 0", () => {
      const p = machine();
      expect(damageTypeMultiplier(p, "magic", target("enemy_scaled", ["state_machine"]), "thunder")).toBe(2);
      expect(damageTypeMultiplier(p, "physical", target("enemy_scaled", ["state_machine"]))).toBe(0);
      expect(damageTypeMultiplier(p, "magic", target("enemy_scaled", ["state_machine"]), "ice")).toBe(0.25);
    });

    it("상태가 그 타격을 정하지 않으면 적 기본값(속성 예외 포함)으로 내려간다", () => {
      const p = machine();
      // 관통상은 마법만 정한다 — 물리 번개 타격은 적 기본값의 번개 예외 200 을 쓴다.
      expect(damageTypeMultiplier(p, "physical", target("enemy_machine", ["state_pierced"]), "thunder")).toBe(2);
      // 마법 번개는 상태(마법 300)가 이긴다.
      expect(damageTypeMultiplier(p, "magic", target("enemy_machine", ["state_pierced"]), "thunder")).toBe(3);
    });
  });
});

describe("battleDownedTargetRetarget", () => {
  isolateTimers();
  function battleProject(): Project {
    return deserialize(JSON.stringify(battleFixture));
  }
  function addAlly(project: Project): void {
    const source = project.database.actors[0];
    if (!source) throw new Error("missing fixture actor");
    const ally = JSON.parse(JSON.stringify(source)) as typeof source;
    ally.id = "actor_ally";
    ally.name = "동료";
    project.database.actors.push(ally);
  }
  describe("nextLivingBattler", () => {
    const downed = { id: "enemy-1", recordId: "enemy_slime" };
    const living = { id: "enemy-2", recordId: "enemy_dragon" };
    const later = { id: "enemy-3", recordId: "enemy_dragon" };

    it("walks forward to the next candidate and wraps the roster", () => {
      expect(nextLivingBattler([downed, living], [living], "enemy-1")).toBe(living);
      expect(nextLivingBattler([living, downed], [living], "enemy-1")).toBe(living);
      expect(nextLivingBattler([downed, later, living], [living], "enemy-1")).toBe(living);
    });

    it("does not substitute an id that is not on the roster", () => {
      expect(nextLivingBattler([downed, living], [living], "enemy-99")).toBeUndefined();
      expect(nextLivingBattler([downed, living], [living], "")).toBeUndefined();
    });
  });
  describe("strict battle retargets a downed single target", () => {
    it("lands the later actor attack on the next living enemy", () => {
      const project = battleProject();
      addAlly(project);
      const troop = project.database.troops.find((entry) => entry.id === "troop_slime");
      if (!troop) throw new Error("missing troop");
      troop.enemyIds = ["enemy_slime", "enemy_dragon"];
      troop.members = [
        { enemyId: "enemy_slime", x: 80, y: 90, hidden: false },
        { enemyId: "enemy_dragon", x: 140, y: 90, hidden: false },
      ];
      const slime = project.database.enemies.find((entry) => entry.id === "enemy_slime");
      const dragon = project.database.enemies.find((entry) => entry.id === "enemy_dragon");
      if (!slime || !dragon) throw new Error("missing enemies");
      slime.stats = { ...slime.stats, maxHp: 1, attack: 1, defense: 0, agility: 1 };
      dragon.stats = { ...dragon.stats, maxHp: 999, attack: 1, defense: 0, agility: 1, mind: 0 };
      dragon.skillIds = [];

      const runtime = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: false,
        canLose: true,
        battleFlow: "strict",
        rng: () => 0,
        party: {
          levels: { actor_hero: 1, actor_ally: 1 },
          experience: {},
          partyActorIds: ["actor_hero", "actor_ally"],
        },
      });

      expect(runtime.snapshot().activeActorId).toBe("actor_hero");
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().activeActorId).toBe("actor_ally");
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

      const snapshot = runtime.snapshot();
      const slimeBattler = snapshot.enemies.find((enemy) => enemy.id === "enemy-1");
      const dragonBattler = snapshot.enemies.find((enemy) => enemy.id === "enemy-2");
      expect(slimeBattler?.hp).toBe(0);
      expect(dragonBattler?.hp).toBeLessThan(dragonBattler?.maxHp ?? 0);
      expect(snapshot.timeline.some((entry) => entry.kind === "damage" && entry.targetId === "enemy-2" && entry.userRecordId === "actor_ally")).toBe(true);
    });

    it("lands the later enemy attack on the next living actor", () => {
      const project = battleProject();
      addAlly(project);
      const troop = project.database.troops.find((entry) => entry.id === "troop_slime");
      if (!troop) throw new Error("missing troop");
      troop.enemyIds = ["enemy_slime", "enemy_slime"];
      troop.members = [
        { enemyId: "enemy_slime", x: 80, y: 90, hidden: false },
        { enemyId: "enemy_slime", x: 140, y: 90, hidden: false },
      ];
      const slime = project.database.enemies.find((entry) => entry.id === "enemy_slime");
      if (!slime) throw new Error("missing slime");
      slime.stats = { ...slime.stats, maxHp: 500, attack: 80, defense: 80, agility: 90, mind: 0 };
      slime.skillIds = [];

      const runtime = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: false,
        canLose: true,
        battleFlow: "strict",
        rng: () => 0,
        party: {
          levels: { actor_hero: 1, actor_ally: 1 },
          experience: {},
          vitals: { actor_hero: { hp: 1, mp: 0 }, actor_ally: { hp: 400, mp: 0 } },
          partyActorIds: ["actor_hero", "actor_ally"],
        },
      });

      runtime.performActorCommand({ kind: "defend" });
      runtime.performActorCommand({ kind: "defend" });

      const snapshot = runtime.snapshot();
      const hero = snapshot.actors.find((actor) => actor.recordId === "actor_hero");
      const ally = snapshot.actors.find((actor) => actor.recordId === "actor_ally");
      expect(hero?.hp).toBe(0);
      expect(ally?.hp).toBeLessThan(400);
      const enemyHits = snapshot.timeline.filter((entry) => entry.kind === "damage" && entry.commandKind === "enemyAttack");
      expect(enemyHits.map((entry) => entry.targetId)).toEqual(["actor_hero", "actor_ally"]);
    });

    it("does not spend the turn when the attack names an unknown enemy", () => {
      const project = battleProject();
      const enemy = project.database.enemies.find((entry) => entry.id === "enemy_slime");
      if (!enemy) throw new Error("missing slime");
      enemy.stats = { ...enemy.stats, maxHp: 40, agility: 1 };
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: false,
        canLose: true,
        battleFlow: "strict",
        rng: () => 0,
        party: { levels: { actor_hero: 1 }, experience: {}, partyActorIds: ["actor_hero"] },
      });
      const before = runtime.snapshot();
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-99" });
      const after = runtime.snapshot();
      expect(after.phase).toBe("actorCommand");
      expect(after.activeActorId).toBe("actor_hero");
      expect(after.enemies[0]?.hp).toBe(before.enemies[0]?.hp);
      expect(after.timeline).toHaveLength(before.timeline.length);
    });
  });
});

describe("battleEffectivenessMessage", () => {
  isolateTimers();
  // 포켓몬 3세대 resultmessage(「효과가 굉장했다!」·「효과가 별로인 듯하다…」)를 옮긴 상성 문장.
  // 2026-10-02 조사: 문장은 방어 쪽 타입 배율만 본다 — 자속 보정(STAB)을 넣으면 물 몬스터의 물 기술이 늘 「굉장」이 된다.

  function projectWithChart(): Project {
    const project = deserialize(JSON.stringify(battleFixture));
    project.system.typeChart = {
      types: ["fire", "grass", "water"],
      multipliers: {
        fire: { fire: 0.5, grass: 2, water: 0.5 },
        grass: { fire: 0.5, grass: 0.5, water: 2 },
        water: { fire: 2, grass: 0.5, water: 0.5 },
      },
    };
    project.database.monsterSpecies = [
      { id: "sp_water", types: ["water"] } as unknown as MonsterSpeciesRecord,
      { id: "sp_grass", types: ["grass"] } as unknown as MonsterSpeciesRecord,
    ];
    return project;
  }
  const battler = (recordId: string, speciesId: string) => ({ recordId, speciesId, stateIds: [] }) as never;
  describe("상성 배율 — 문장용은 자속 보정을 뺀다", () => {
    it("물 몬스터의 물 기술: 피해 배율은 STAB 를 포함하고, 문장 배율은 방어 타입만 본다", () => {
      const project = projectWithChart();
      const water = battler("a", "sp_water");
      const grass = battler("b", "sp_grass");
      // 물 → 풀 0.5, 자속 1.5 → 피해 0.75. 문장은 0.5(별로).
      expect(battleElementMultiplier(project, "water", water, grass)).toBeCloseTo(0.75);
      expect(battleEffectivenessMultiplier(project, "water", grass)).toBeCloseTo(0.5);
      // 물 → 물 0.5 는 STAB 가 붙어도 문장은 0.5.
      expect(battleEffectivenessMultiplier(project, "water", water)).toBeCloseTo(0.5);
    });

    it("타입 표에 없는 속성·속성 없는 기술은 1(문장 없음)", () => {
      const project = projectWithChart();
      expect(battleEffectivenessMultiplier(project, "thunder", battler("b", "sp_grass"))).toBe(1);
      expect(battleEffectivenessMultiplier(project, undefined, battler("b", "sp_grass"))).toBe(1);
    });
  });
  describe("상성 문장", () => {
    const snapshot = () => createBattleRuntime({ project: deserialize(JSON.stringify(strictFixture)), troopId: "troop_strict_training", canEscape: false, canLose: true, rng: () => 0.5 }).snapshot();

    it("배율 > 1 은 「효과가 굉장했다!」, < 1 은 「효과가 별로인 듯하다…」, 없으면 붙지 않는다", () => {
      const before = snapshot();
      const entry = { userRecordId: "enemy_training_slime", targetId: before.actors[0].id, hit: true, amount: 10, critical: false };
      expect(enemyActionDirectorState({ ...entry, effectiveness: 2 }, before).lines.join(" ")).toContain("효과가 굉장했다!");
      expect(enemyActionDirectorState({ ...entry, effectiveness: 0.5 }, before).lines.join(" ")).toContain("효과가 별로인 듯하다…");
      expect(enemyActionDirectorState(entry, before).lines.join(" ")).not.toContain("효과가");
    });

    it("상성 문장이 있으면 결과 줄은 그 문장만 — 피해 숫자를 붙이면 메시지 창 한 줄을 넘는다", () => {
      const before = snapshot();
      const entry = { userRecordId: "enemy_training_slime", targetId: before.actors[0].id, hit: true, amount: 10, critical: false };
      // 문장만 남기는 것은 포켓몬 스킨 규칙이다. 그 밖의 스킨은 피해 숫자를 지키고 문장을 덧붙인다(0a85854891 #3315, 폴른 스타).
      const previous = store.getCurrent();
      const pokemon = deserialize(JSON.stringify(strictFixture));
      pokemon.system.battleUiStyle = "pokemon";
      store.replace(pokemon);
      try {
        expect(enemyActionDirectorState({ ...entry, effectiveness: 0.5 }, before).lines[1]).toBe("효과가 별로인 듯하다…");
        expect(enemyActionDirectorState({ ...entry, critical: true, effectiveness: 2 }, before).lines[1]).toBe("급소에 맞았다! 효과가 굉장했다!");
        expect(enemyActionDirectorState(entry, before).lines[1]).toContain("10 피해");
      } finally {
        store.replace(previous);
      }
      const sideView = deserialize(JSON.stringify(strictFixture));
      sideView.system.battleUiStyle = "retro2003";
      store.replace(sideView);
      try {
        const line = enemyActionDirectorState({ ...entry, effectiveness: 0.5 }, before).lines[1];
        expect(line).toContain("10 피해");
        expect(line?.endsWith("효과가 별로인 듯하다…")).toBe(true);
      } finally {
        store.replace(previous);
      }
    });

    it("회복 문장에는 상성 문장을 붙이지 않는다", () => {
      const before = snapshot();
      const entry = { userRecordId: "enemy_training_slime", targetId: before.actors[0].id, hit: true, amount: 10, critical: false, effectiveness: 2 };
      expect(enemyActionDirectorState(entry, before, { resource: "hp", healing: true }).lines.join(" ")).not.toContain("효과가 굉장");
    });
  });
});

describe("battleImpactTimeline", () => {
  isolateTimers();
  describe("side-view contact timing", () => {
    it("lands the hero's blade pose and impact sound on the same contact cue", () => {
      const skill = RETRO_CLASS_SKILLS.find(row => row.id === "skill_hero_cross_slash")!;
      const timeline = retroClassSkillTimeline(skill);
      const contact = timeline.events.find(event => event.kind === "hit")!.at;
      expect(timeline.events).toContainEqual({ kind: "pose", at: contact, pose: "attack" });
      expect(timeline.events).toContainEqual({ kind: "sound", at: contact, id: retroSoundForLayer("hero_cross") });
      const strike = timeline.events.find(event => event.kind === "pose" && event.pose === "attack_strike")!;
      expect(contact - strike.at).toBeLessThanOrEqual(60);
    });

    it("plays projectile arrival before contact and delays the burst sound until that contact", () => {
      const skill = RETRO_CLASS_SKILLS.find(row => row.id === "skill_mage_fireball")!;
      const timeline = retroClassSkillTimeline(skill);
      const contact = timeline.events.find(event => event.kind === "hit")!.at;
      const projectile = timeline.events.find(event => event.kind === "projectile")!;
      expect(projectile.kind).toBe("projectile");
      if (projectile.kind === "projectile") expect(projectile.at + projectile.durationMs).toBeLessThan(contact);
      expect(timeline.events).toContainEqual({ kind: "sound", at: contact, id: retroSoundForLayer("mage_fire_burst") });
    });

    it("keeps healing audio at the start of its blessing layer", () => {
      const skill = RETRO_CLASS_SKILLS.find(row => row.id === "skill_cleric_heal_light")!;
      const timeline = retroClassSkillTimeline(skill, { side: "allies" });
      const layer = timeline.events.find(event => event.kind === "fx" && event.key === "cleric_heal")!;
      expect(timeline.events).toContainEqual({ kind: "sound", at: layer.at, id: retroSoundForLayer("cleric_heal") });
    });
  });
});

describe("battleLevelUp", () => {
  isolateTimers();
  function heroCurveExpForLevel(project: Project, level: number): number {
    const hero = project.database.actors.find((entry) => entry.id === "actor_hero");
    if (!hero) throw new Error("missing actor_hero");
    return totalExpForLevel(normalizeActorRecord(hero).expCurve, level);
  }
  describe("battleLevelUp — 자동 레벨업 판정", () => {
    it("누적 경험치가 다음 레벨 임계치에 도달하면 레벨업한다", () => {
      const project = createBlankProject();
      const exp = heroCurveExpForLevel(project, 2);
      const result = computeActorLevelUp(project, "actor_hero", 1, exp);
      expect(result).not.toBeNull();
      expect(result?.fromLevel).toBe(1);
      expect(result?.toLevel).toBe(2);
      // 파라미터 곡선은 저레벨에서 거의 평탄하므로 증가분은 0 이상(레벨 자체는 오름).
      expect(result?.maxHpGain).toBeGreaterThanOrEqual(0);
    });

    it("경험치가 부족하면 레벨업하지 않는다(null)", () => {
      const project = createBlankProject();
      const exp = heroCurveExpForLevel(project, 2) - 1;
      expect(computeActorLevelUp(project, "actor_hero", 1, exp)).toBeNull();
    });

    it("한 번에 여러 레벨을 올릴 수 있다(다중 레벨업)", () => {
      const project = createBlankProject();
      const exp = heroCurveExpForLevel(project, 4);
      const result = computeActorLevelUp(project, "actor_hero", 1, exp);
      expect(result?.toLevel).toBe(4);
    });

    it("능력치 성장분은 파라미터 곡선의 레벨 간 차이와 일치한다", () => {
      const project = createBlankProject();
      const hero = normalizeActorRecord(project.database.actors[0]);
      // 고레벨 점프라 실제 증가분이 양수가 되어 의미 있게 검증된다.
      const exp = heroCurveExpForLevel(project, 40);
      const result = computeActorLevelUp(project, "actor_hero", 1, exp);
      const expectedHp = parameterValueAtLevel(hero.parameterCurves.maxHp, 40) - parameterValueAtLevel(hero.parameterCurves.maxHp, 1);
      expect(result?.toLevel).toBe(40);
      expect(expectedHp).toBeGreaterThan(0);
      expect(result?.maxHpGain).toBe(expectedHp);
    });

    it("레벨 구간에서 새로 배우는 스킬을 수집한다", () => {
      const project = createBlankProject();
      const hero = project.database.actors.find((entry) => entry.id === "actor_hero");
      if (!hero) throw new Error("missing actor_hero");
      hero.learnedSkills = [
        { level: 1, skillId: "default_skill" },
        { level: 2, skillId: "skill_heal" },
      ];
      const exp = heroCurveExpForLevel(project, 2);
      const result = computeActorLevelUp(project, "actor_hero", 1, exp);
      expect(result?.learnedSkillIds).toEqual(["skill_heal"]);
    });

    it("최대 레벨을 넘지 않는다", () => {
      const project = createBlankProject();
      const hero = project.database.actors.find((entry) => entry.id === "actor_hero");
      if (!hero) throw new Error("missing actor_hero");
      hero.maxLevel = 3;
      const result = computeActorLevelUp(project, "actor_hero", 1, 99_999_999);
      expect(result?.toLevel).toBe(3);
    });
  });
});

describe("battleMonsterMedicine", () => {
  isolateTimers();
  function fixture() {
    const project = createBlankProject();
    project.system.battleParty = "monsters";
    // 기본 슬라임이 HP 1 몬스터보다 먼저 움직여 명령 전에 전투가 끝난다 — 이 시험은 약 사용만 본다.
    for (const enemy of project.database.enemies) enemy.stats.agility = 1;
    const session = startSession(project);
    const speciesId = project.database.monsterSpecies![0]!.id;
    const gift = giveMonster(project, session, { speciesId, level: 10 });
    if (!gift.ok) throw new Error("Monster fixture admission failed");
    gift.instance.currentHp = 1;
    const item = normalizeItemRecord({ id: "monster_medicine", name: "Medicine", type: "medicine", scope: "ally", occasion: "battle", consumable: true, hpRecovery: { flat: 20, percentMax: 0 } });
    project.database.items.push(item);
    session.inventory[item.id] = 2;
    const user = { recordId: gift.instance.instanceId, monsterInstanceId: gift.instance.instanceId, speciesId };
    return { project, session, instance: gift.instance, item, user };
  }
  describe("monster battle medicine", () => {
    it("accepts and executes medicine once for a wounded monster", () => {
      const { project, session, instance, item } = fixture();
      const runtime = createBattleRuntime({ project, troopId: project.database.troops[0]!.id, partyMonsters: [instance], sessionState: session, canEscape: true, canLose: true, rng: () => 0.5 });
      try {
        for (let i = 0; i < 200 && runtime.snapshot().phase !== "actorCommand"; i++) runtime.tick(100);
        expect(runtime.snapshot().phase).toBe("actorCommand");
        runtime.beginActorCommand({ kind: "item", itemId: item.id });
        const selection = runtime.snapshot().targetSelection;
        if (selection) runtime.selectTarget(selection.targetIds[0]!);
        const result = runtime.snapshot();
        expect(result.eventState.inventory[item.id]).toBe(1);
        expect(result.actionLog.some(action => action.targetId === `mon:${instance.instanceId}` && action.amount > 0)).toBe(true);
        expect(result.actors[0]!.hp).toBeGreaterThan(1);
      } finally { runtime.cancel(); }
    });

    it("preserves actor/class restrictions and does not turn actor books or seeds into monster items", () => {
      const { project, item, user } = fixture();
      expect(isBattleItemUserEligible(project, item, user)).toBe(true);
      expect(isBattleItemUserEligible(project, item, { ...user, speciesId: "missing" })).toBe(false);
      for (const restricted of [{ ...item, usableActorIds: [project.database.actors[0]!.id] }, { ...item, usableClassIds: [project.database.classes[0]!.id] }]) {
        expect(isBattleItemUserEligible(project, restricted, user)).toBe(false);
      }
      for (const type of ["book", "seed"] as const) expect(isBattleItemUserEligible(project, { ...item, type }, user)).toBe(false);
      const actor = project.database.actors[0]!;
      expect(isBattleItemUserEligible(project, { ...item, usableActorIds: [actor.id] }, { recordId: actor.id, classId: actor.classId })).toBe(true);
      expect(isBattleItemUserEligible(project, { ...item, usableActorIds: ["someone_else"] }, { recordId: actor.id })).toBe(false);
    });
  });
});

describe("battleSequencer", () => {
  isolateTimers();
  function battleRuntime() {
    return createBattleRuntime({
      project: deserialize(JSON.stringify(battleFixture)),
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
      rng: () => 0.5,
    });
  }
  function untilActorCommand(runtime: ReturnType<typeof createBattleRuntime>, maxTicks = 40): void {
    for (let i = 0; i < maxTicks; i += 1) {
      runtime.tick(1_000);
      if (runtime.snapshot().phase === "actorCommand" || runtime.snapshot().result) return;
    }
  }
  describe("battle sequencer", () => {
    let advanceSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      advanceSpy = vi.spyOn(advanceModule, "advanceBattleRuntime").mockImplementation((runtime) => {
        runtime.tick(1_000);
      });
    });

    afterEach(() => {
      advanceSpy.mockRestore();
    });

    it("delays advanceBattleRuntime until after acting and impact steps", () => {
      const runtime = battleRuntime();
      untilActorCommand(runtime);
      const queue: Array<{ callback: () => void; delayMs: number }> = [];
      const schedule = vi.fn((callback: () => void, delayMs: number) => {
        queue.push({ callback, delayMs });
        return queue.length;
      });
      const steps: string[] = [];
      const motions: Array<string | undefined> = [];

      const sequencer = createBattleSequencer(
        runtime,
        {
          onDirectorState: (state) => steps.push(state.step),
          onSyncView: () => steps.push("sync"),
          onDamageFeedback: () => steps.push("damage"),
          onActionMotion: (beat) => motions.push(beat ? `${beat.kind}:${beat.userMotion}/${beat.targetMotion}` : "clear"),
          onResultStage: () => undefined,
          onSequenceBusy: () => undefined,
        },
        schedule,
        () => undefined
      );

      const before = runtime.snapshot();
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      const after = runtime.snapshot();
      sequencer.runAfterActorCommand({ kind: "attack", targetEnemyId: "enemy-1" }, before, after);

      expect(advanceSpy).not.toHaveBeenCalled();
      expect(steps[0]).toBe("acting");
      expect(schedule).toHaveBeenCalledWith(expect.any(Function), BATTLE_ACTING_MS);
      // Approach beat: actor lunges, target idle.
      expect(motions[0]).toBe("approach:lunge/idle");

      // After acting hold → damage + hit-stop schedule
      queue.shift()?.callback();
      expect(steps).toContain("impact");
      expect(steps).toContain("damage");
      expect(schedule).toHaveBeenCalledWith(expect.any(Function), BATTLE_HITSTOP_MS);
      // Impact beat: still lunged, knockback on connect (or idle if miss/zero damage).
      expect(motions.some((m) => m?.startsWith("impact:"))).toBe(true);

      // Hit-stop ends → impact dwell (recover), then enemy resolve chain
      queue.shift()?.callback();
      expect(schedule).toHaveBeenCalledWith(expect.any(Function), BATTLE_IMPACT_MS);
      expect(motions.some((m) => m === "recover:return/idle")).toBe(true);

      let guard = 0;
      while (queue.length > 0 && guard < 10) {
        queue.shift()?.callback();
        guard += 1;
      }
      expect(advanceSpy).toHaveBeenCalled();
      const delays = schedule.mock.calls.map((call) => call[1] as number);
      expect(delays).toContain(BATTLE_ACTING_MS);
      expect(delays).toContain(BATTLE_HITSTOP_MS);
      expect(delays).toContain(BATTLE_IMPACT_MS);
      expect(delays).toContain(BATTLE_RESOLVE_MS);
      // Motion cleared after the action chain.
      expect(motions.at(-1)).toBe("clear");
    });

    it("disambiguates the second same-named enemy in damage messages", () => {
      const project = deserialize(JSON.stringify(battleFixture));
      const troop = project.database.troops.find((entry) => entry.id === "troop_slime");
      if (!troop) throw new Error("missing fixture troop");
      troop.enemyIds = ["enemy_slime", "enemy_slime"];
      troop.members = [
        { enemyId: "enemy_slime", x: 80, y: 90, hidden: false },
        { enemyId: "enemy_slime", x: 120, y: 120, hidden: false },
      ];
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        rng: () => 0.5,
      });
      untilActorCommand(runtime);
      const queue: Array<() => void> = [];
      const lines: string[] = [];
      const sequencer = createBattleSequencer(
        runtime,
        {
          onDirectorState: (state) => lines.push(...state.lines),
          onSyncView: () => undefined,
          onDamageFeedback: () => undefined,
          onResultStage: () => undefined,
          onSequenceBusy: () => undefined,
        },
        (callback) => {
          queue.push(callback);
          return queue.length;
        },
        () => undefined,
      );

      const before = runtime.snapshot();
      expect(before.enemies[1]?.id).toBe("enemy-2");
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-2" });
      const after = runtime.snapshot();
      sequencer.runAfterActorCommand({ kind: "attack", targetEnemyId: "enemy-2" }, before, after);
      queue.shift()?.();

      expect(lines).toContainEqual(expect.stringMatching(/^슬라임 2에게 \d+ 피해!$/));
    });

    it("finishes a player turn in charging director state until actorCommand returns", () => {
      advanceSpy.mockRestore();
      advanceSpy = vi.spyOn(advanceModule, "advanceBattleRuntime").mockImplementation(() => undefined);
      const runtime = battleRuntime();
      untilActorCommand(runtime);
      const queue: Array<{ callback: () => void; delayMs: number }> = [];
      let lastStep = "";
      const sequencer = createBattleSequencer(
        runtime,
        {
          onDirectorState: (state) => {
            lastStep = state.step;
          },
          onSyncView: () => undefined,
          onDamageFeedback: () => undefined,
          onResultStage: () => undefined,
          onSequenceBusy: () => undefined,
        },
        (callback, delayMs) => {
          queue.push({ callback, delayMs });
          return queue.length;
        },
        () => undefined
      );

      const before = runtime.snapshot();
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      const after = runtime.snapshot();
      sequencer.runAfterActorCommand({ kind: "attack", targetEnemyId: "enemy-1" }, before, after);

      while (queue.length > 0) {
        queue.shift()?.callback();
      }

      expect(runtime.snapshot().phase).toBe("charging");
      expect(lastStep).toBe("acting");
    });

    it("consumes strict setup and command timeline entries once without replay", () => {
      const project = deserialize(JSON.stringify(battleFixture));
      const burn = project.database.states.find((state) => state.id === "state_burn");
      if (!burn) throw new Error("missing fixture state");
      burn.runtimeEffects = { ...burn.runtimeEffects, hpDamagePercentPerTurn: 1 };
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        party: {
          levels: { actor_hero: 1 },
          experience: {},
          stateIds: { actor_hero: ["state_burn"] },
          partyActorIds: ["actor_hero"],
        },
        rng: () => 0.5,
      });
      const consumed: number[] = [];
      const lines: string[] = [];
      const sequencer = createBattleSequencer(
        runtime,
        {
          onDirectorState: (state) => lines.push(...state.lines),
          onSyncView: () => undefined,
          onDamageFeedback: () => undefined,
          onResultStage: () => undefined,
          onSequenceBusy: () => undefined,
          onTimelineEntry: (entry) => consumed.push(entry.sequence),
        },
        (callback) => {
          callback();
          return consumed.length + 1;
        },
        () => undefined,
      );
      const before = runtime.snapshot();
      expect(before.timeline.map((entry) => entry.kind)).toContain("stateUpkeep");
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      const after = runtime.snapshot();
      const expected = after.timeline.map((entry) => entry.sequence);

      sequencer.runAfterActorCommand({ kind: "attack", targetEnemyId: "enemy-1" }, before, after);
      sequencer.runAfterActorCommand({ kind: "attack", targetEnemyId: "enemy-1" }, before, after);

      expect(consumed).toEqual(expected);
      expect(lines.some((line) => line.startsWith(`${before.actors[0].name}: `) && line.includes("피해"))).toBe(true);
    });

    it("acknowledges a strict event wait only after its scheduled presentation pause", () => {
      const project = deserialize(JSON.stringify(battleFixture));
      const troop = project.database.troops.find((record) => record.id === "troop_slime");
      if (!troop) throw new Error("missing troop_slime");
      troop.battleEventPages = [{
        id: "page_wait",
        name: "대기",
        span: "battle",
        runOnce: true,
        conditions: [{ kind: "turn", start: 1, interval: 0 }],
        commands: [{ kind: "wait", ms: 500 }],
      }];
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        party: { levels: { actor_hero: 1 }, experience: {}, partyActorIds: ["actor_hero"] },
        rng: () => 0.5,
      });
      const delays: number[] = [];
      const pending: Array<() => void> = [];
      const sequencer = createBattleSequencer(
        runtime,
        {
          onDirectorState: () => undefined,
          onSyncView: () => undefined,
          onDamageFeedback: () => undefined,
          onResultStage: () => undefined,
          onSequenceBusy: () => undefined,
        },
        (callback, delayMs) => {
          delays.push(delayMs);
          pending.push(callback);
          return pending.length;
        },
        () => undefined,
      );
      const before = runtime.snapshot();
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      const after = runtime.snapshot();
      expect(after.eventPause).toMatchObject({ kind: "wait", ms: 500 });
      expect(after.roundLogs).toHaveLength(0);

      sequencer.runAfterActorCommand({ kind: "attack", targetEnemyId: "enemy-1" }, before, after);
      // Drain the queued beats; the authored 500ms pause must appear as one scheduled delay.
      for (let guard = 0; guard < 100 && pending.length > 0; guard += 1) pending.shift()?.();

      expect(delays.filter(ms => ms === 500)).toHaveLength(1);
      expect(runtime.snapshot().eventPause).toBeUndefined();
      expect(runtime.snapshot().roundLogs).toHaveLength(1);
    });

    it("holds intro lines before releasing command prompt", () => {
      const runtime = battleRuntime();
      const introLines: string[] = [];
      const sequencer = createBattleSequencer(
        runtime,
        {
          onDirectorState: (state) => {
            introLines.push(state.lines[0] ?? "");
          },
          onSyncView: () => undefined,
          onDamageFeedback: () => undefined,
          onResultStage: () => undefined,
          onSequenceBusy: () => undefined,
        },
        (callback) => {
          callback();
          return 1;
        },
        () => undefined
      );

      // 게이지 충전 안내는 포켓몬 스킨에서만 말한다 — 측면 도트 전투는 게이지 동안 윗창이 빈다(#3063).
      const previous = store.getCurrent();
      const pokemon = deserialize(JSON.stringify(battleFixture));
      pokemon.system.battleUiStyle = "pokemon";
      store.replace(pokemon);
      try {
        sequencer.startIntro(runtime.snapshot());
      } finally {
        store.replace(previous);
      }
      // 인트로는 "○○이(가) 나타났다!" 배너 → 커맨드 프롬프트("무엇을 할까?") 순으로 흐른다.
      expect(introLines[0]).toContain("나타났다");
      expect(introLines.at(-1)).toMatch(/무엇을 할까|게이지/);
    });

    it("holds a terminal action outcome before replacing it with the result panel", () => {
      const runtime = createBattleRuntime({
        project: deserialize(JSON.stringify(battleFixture)),
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        rng: () => 0,
      });
      untilActorCommand(runtime);
      const queue: Array<{ callback: () => void; delayMs: number }> = [];
      const delays: number[] = [];
      const lines: string[] = [];
      const sequencer = createBattleSequencer(
        runtime,
        {
          onDirectorState: (state) => lines.push(state.lines.join(" ")),
          onSyncView: () => undefined,
          onDamageFeedback: () => undefined,
          onResultStage: () => undefined,
          onSequenceBusy: () => undefined,
        },
        (callback, delayMs) => {
          delays.push(delayMs);
          queue.push({ callback, delayMs });
          return queue.length;
        },
        () => undefined,
      );

      const before = runtime.snapshot();
      runtime.performActorCommand({ kind: "escape" });
      const after = runtime.snapshot();
      sequencer.runAfterActorCommand({ kind: "escape" }, before, after);

      let guard = 0;
      while (queue.length > 0 && guard < 20) {
        queue.shift()?.callback();
        guard += 1;
      }

      expect(lines.some((line) => line.includes("후퇴"))).toBe(true);
      expect(delays).toContain(BATTLE_RESULT_HOLD_MS);
      expect(lines.at(-1)).toContain("후퇴");
      expect(queue).toHaveLength(0);
    });

    it("announces a sandstorm knockout after the residual line, not on the earlier hit", () => {
      const runtime = createBattleRuntime({
        project: deserialize(JSON.stringify(battleFixture)),
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        rng: () => 0.5,
      });
      const before = runtime.snapshot();
      const enemy = before.enemies[0];
      expect(before.activeActorId).toBeTruthy();
      expect(enemy).toBeTruthy();
      const sequence = (before.timeline.at(-1)?.sequence ?? 0) + 1;
      const after = {
        ...before,
        enemies: before.enemies.map((entry) => entry.id === enemy!.id ? { ...entry, hp: 0, defeated: true } : entry),
        timeline: [
          ...before.timeline,
          {
            sequence,
            kind: "damage" as const,
            side: "actor" as const,
            userRecordId: before.activeActorId,
            targetId: enemy!.id,
            hit: true,
            amount: 4,
            actionId: 1,
          },
          {
            sequence: sequence + 1,
            kind: "stateUpkeep" as const,
            side: "enemy" as const,
            targetId: enemy!.id,
            amount: 2,
            message: "모래바람",
            weatherKind: "sandstorm" as const,
            actionId: 2,
          },
        ],
      };
      const lines = playDirectorLines(runtime, { kind: "attack", targetEnemyId: enemy!.id }, before, after);
      const weatherAt = lines.findIndex((line) => line.includes("모래바람"));
      const faintAt = lines.findIndex((line) => line.includes("쓰러뜨렸"));
      expect(weatherAt).toBeGreaterThanOrEqual(0);
      expect(faintAt).toBeGreaterThan(weatherAt);
    });

    it("does not stack a second faint line on a doom sentence that already says the battler fell", () => {
      const runtime = createBattleRuntime({
        project: deserialize(JSON.stringify(battleFixture)),
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        rng: () => 0.5,
      });
      const before = runtime.snapshot();
      const actor = before.actors[0];
      expect(before.activeActorId).toBe(actor?.recordId);
      const sequence = (before.timeline.at(-1)?.sequence ?? 0) + 1;
      const doom = `선고의 시간이 다했다 — ${actor!.name}이 쓰러졌다!`;
      const after = {
        ...before,
        actors: before.actors.map((entry) => entry.id === actor!.id ? { ...entry, hp: 0, defeated: true } : entry),
        timeline: [
          ...before.timeline,
          {
            sequence,
            kind: "stateUpkeep" as const,
            side: "actor" as const,
            userRecordId: actor!.recordId,
            targetId: actor!.id,
            amount: actor!.hp,
            stateId: "state_doom",
            message: doom,
            actionId: 1,
          },
        ],
      };
      const lines = playDirectorLines(runtime, { kind: "attack", targetEnemyId: "enemy-1" }, before, after);
      const faintLines = lines.filter((line) => line.includes("쓰러"));
      expect(faintLines.length).toBeGreaterThan(0);
      expect(faintLines.every((line) => line.includes("시간이 다했다"))).toBe(true);
    });
  });
  function playDirectorLines(
    runtime: ReturnType<typeof createBattleRuntime>,
    command: Parameters<ReturnType<typeof createBattleSequencer>["runAfterActorCommand"]>[0],
    before: ReturnType<typeof runtime.snapshot>,
    after: ReturnType<typeof runtime.snapshot>,
  ): string[] {
    const lines: string[] = [];
    const sequencer = createBattleSequencer(
      runtime,
      {
        onDirectorState: (state) => lines.push(...state.lines),
        onSyncView: () => undefined,
        onDamageFeedback: () => undefined,
        onResultStage: () => undefined,
        onSequenceBusy: () => undefined,
      },
      (callback) => {
        callback();
        return lines.length + 1;
      },
      () => undefined,
    );
    sequencer.runAfterActorCommand(command, before, after);
    return lines;
  }
  describe("tempoActionBeats (스킨 동작 템포)", () => {
    it("히트스톱 비트는 두고 나머지 비트만 템포로 줄인다", () => {
      const beats = planActionBeats({
        userId: "a", targetId: "e",
        feedback: { targetId: "e", amount: 5, critical: false, healing: false },
        actingMs: 400, hitStopMs: 110, impactMs: 400, weight: "normal",
      });
      const fast = tempoActionBeats(beats, 1.5);
      expect(fast.map((beat) => beat.durationMs)).toEqual([267, 110, 267]);
      expect(tempoActionBeats(beats, 1)).toBe(beats);
    });
  });
});

describe("battleStates", () => {
  isolateTimers();
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
      expect(stateBehavior(stateRecord(project, "state_attack_down")).attackMultiplier).toBe(0.5);
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
      expect(upkeep.hpHealing).toBe(0);
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
      expect(attackMultiplierForStates(project, makeBattler({ stateIds: ["state_attack_down"] }))).toBe(0.5);
      expect(defenseMultiplierForStates(project, makeBattler({ stateIds: ["state_defense_down"] }))).toBe(0.5);
      expect(agilityMultiplierForStates(project, makeBattler({ stateIds: ["state_agility_up"] }))).toBe(2);
      expect(agilityMultiplierForStates(project, makeBattler({ stateIds: ["state_agility_down"] }))).toBe(0.5);
      expect(attackMultiplierForStates(project, makeBattler({ stateIds: [] }))).toBe(1);
    });
  });
});

// 도그푸딩 「등대지기의 겨울」: 생성된 보스(HP 280·공 22·민 16)가 Lv1 파티(HP 514)에게 4타 만에 쓰러지고
// 4~7 피해만 줬다(한 판은 한 번도 공격하지 않았다). 보스로 선언된 적은 시작 파티 기준 하한까지 올린다.
describe("bossThreatScaling", () => {
  isolateTimers();
  const WEAK_BOSS = {
    id: "enemy_blizzard_spirit", name: "눈보라 정령", monsterResourceId: "generated-enemy-sylph-air",
    stats: { maxHp: 280, maxMp: 50, attack: 22, defense: 18, mind: 25, agility: 16 },
    rewards: { exp: 80, gold: 120 },
  };
  /** 체력·공격·마력·민첩을 주지 않은 보스 — 하한(기본값)이 채운다. */
  const UNSPECIFIED_BOSS = { ...WEAK_BOSS, stats: { maxMp: 50, defense: 18 } };
  function write(role?: "boss" | "normal", enemy: Record<string, unknown> = WEAK_BOSS): { project: Project; result: ReturnType<typeof runTool> } {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "upsert_enemy", { enemy, ...(role ? { role } : {}) });
    return { project: ctx.project, result };
  }
  function bossFight(project: Project) {
    project.database.troops.push({ id: "troop_boss", name: "보스", enemyIds: ["enemy_blizzard_spirit"], battleEventPages: [] } as never);
    const partyHp = 514 * project.session.partyActorIds.length;
    const sim = simulateBattle({ project, troopId: "troop_boss", heroLevel: 1, n: 20, seed: 7 });
    return { sim, partyHp };
  }
  describe("upsert_enemy role:boss fills unspecified boss stats from the start party", () => {
    it("raises unspecified HP/attack/agility so the boss takes real HP but stays beatable", () => {
      const { project, result } = write("boss", UNSPECIFIED_BOSS);
      expect(result.ok, result.summary).toBe(true);
      const enemy = project.database.enemies.find(entry => entry.id === "enemy_blizzard_spirit")!;
      expect(enemy.stats.maxHp).toBeGreaterThan(280);
      expect(enemy.stats.attack).toBeGreaterThan(22);
      expect(enemy.stats.agility).toBeGreaterThan(16);
      expect(result.summary).toContain("보스 위협 하한을 기본값으로 적용");
      expect(JSON.stringify(result)).toContain("attack ");
      const { sim } = bossFight(project);
      expect(sim.winRate).toBeGreaterThanOrEqual(0.85);
      const party = project.database.actors.filter(actor => project.session.partyActorIds.includes(actor.id));
      expect(party.length).toBeGreaterThan(0);
      // 파티가 실제로 HP 를 잃는다(예전 보스는 514 중 4~7).
      expect(sim.avgHpRemaining).toBeLessThan(514 * party.length * 0.85);
    });

    it("a boss id/name implies the role", () => {
      const { project } = write(undefined, { ...UNSPECIFIED_BOSS, id: "enemy_boss_blizzard" });
      expect(project.database.enemies.find(entry => entry.id === "enemy_boss_blizzard")!.stats.attack).toBeGreaterThan(22);
    });

    it("explicit author stats win over the floor and the result says the floor was not applied", () => {
      // 이세계 고딩(2026-10-30): 저자가 짧은 보스전으로 maxHp 400 을 줬는데 하한이 590 으로 덮었다.
      const { project, result } = write("boss");
      expect(result.ok, result.summary).toBe(true);
      expect(project.database.enemies.find(entry => entry.id === "enemy_blizzard_spirit")!.stats).toMatchObject(WEAK_BOSS.stats);
      expect(result.summary).toContain("저자 값 유지");
      expect(JSON.stringify(result)).toContain("maxHp 280(권장");
    });

    it("only the stats left out get the floor", () => {
      const { project, result } = write("boss", { ...WEAK_BOSS, stats: { maxHp: 360, maxMp: 50, defense: 18 } });
      const enemy = project.database.enemies.find(entry => entry.id === "enemy_blizzard_spirit")!;
      expect(enemy.stats.maxHp).toBe(360);
      expect(enemy.stats.attack).toBeGreaterThan(22);
      expect(result.summary).toContain("기본값으로 적용");
      expect(result.summary).not.toContain("maxHp·");
    });

    it("editing an existing boss without role keeps its stats", () => {
      const ctx = { project: createBlankProject() };
      runTool(ctx, "upsert_enemy", { enemy: WEAK_BOSS, role: "boss" });
      const result = runTool(ctx, "upsert_enemy", { enemy: { id: WEAK_BOSS.id, name: "눈보라 정령 2" } });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.database.enemies.find(entry => entry.id === WEAK_BOSS.id)!.stats).toMatchObject(WEAK_BOSS.stats);
    });

    it("never lowers authored stats and leaves normal enemies alone", () => {
      const strong = { ...WEAK_BOSS, stats: { maxHp: 99999, maxMp: 50, attack: 999, defense: 18, mind: 999, agility: 999 } };
      const { project: strongProject } = write("boss", strong);
      // 전부 명시한 값이라 그대로다(하한보다 높든 낮든).
      expect(strongProject.database.enemies.find(entry => entry.id === "enemy_blizzard_spirit")!.stats).toMatchObject(strong.stats);
      const { project, result } = write("normal");
      expect(project.database.enemies.find(entry => entry.id === "enemy_blizzard_spirit")!.stats).toMatchObject(WEAK_BOSS.stats);
      expect(result.summary).not.toContain("보스 위협 하한");
    });

    it("leaves no probe troop behind", () => {
      const { project } = write("boss", UNSPECIFIED_BOSS);
      expect(project.database.troops.some(troop => troop.id.startsWith("__"))).toBe(false);
    });
  });
  describe("troop balance warning also flags a near-harmless troop", () => {
    it("warns when the troop only scratches the party", () => {
      const ctx = { project: createBlankProject() };
      runTool(ctx, "upsert_enemy", { enemy: WEAK_BOSS, role: "normal" });
      const result = runTool(ctx, "upsert_troop", { troop: { id: "troop_weak", name: "약한 무리", enemyIds: ["enemy_blizzard_spirit"] } });
      expect(result.ok, result.summary).toBe(true);
      expect(JSON.stringify(result)).toContain("밸런스");
    });
  });
  describe("troop balance warning flags the other side — a troop the party cannot beat", () => {
    const BRUTE = {
      id: "enemy_brute", name: "광산 거인", monsterResourceId: "generated-enemy-golem-01",
      stats: { maxHp: 9000, maxMp: 10, attack: 400, defense: 300, mind: 50, agility: 90 },
      rewards: { exp: 10, gold: 10 },
    };

    it("warns with the joined party and a raised level when every run is a wipe", () => {
      const ctx = { project: createBlankProject() };
      runTool(ctx, "upsert_enemy", { enemy: BRUTE, role: "normal" });
      const result = runTool(ctx, "upsert_troop", { troop: { id: "troop_brute", name: "거인 무리", enemyIds: ["enemy_brute"] } });
      expect(result.ok, result.summary).toBe(true);
      expect(result.summary).toContain("전멸");
      const text = JSON.stringify(result.diff?.warnings ?? []);
      expect(text).toContain("Lv5");
      expect(text).toContain("partyActorIds");
    });

    it("does not warn for an ordinary troop the party beats with some damage", () => {
      const ctx = { project: createBlankProject() };
      const fair = { ...BRUTE, id: "enemy_fair", name: "코볼트", stats: { maxHp: 300, maxMp: 10, attack: 90, defense: 40, mind: 20, agility: 45 } };
      runTool(ctx, "upsert_enemy", { enemy: fair, role: "normal" });
      const result = runTool(ctx, "upsert_troop", { troop: { id: "troop_fair", name: "코볼트", enemyIds: ["enemy_fair"] } });
      expect(JSON.stringify(result.diff?.warnings ?? [])).not.toContain("전멸");
    });
  });
});
