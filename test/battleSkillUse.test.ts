import { describe, expect, it } from "vitest";
import { battleSkillMpCost, battleSkillUseFailure, consumeBattleSkillResource, battleActorSkillFailure } from "@/battle/battleSkillUse";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize, serialize } from "@/project/io";
import type { Project, SkillRecord } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { isolateTimers } from "./mergedTeardown";

describe("actionCombatMpCost", () => {
  isolateTimers();
  describe("battleSkillMpCost (field action cast uses this single source of truth)", () => {
    it("floors the percentMax share, not rounds (old field formula rounded 1.5 -> 2)", () => {
      // maxMp = 30, percentMax = 5 -> 30*5/100 = 1.5; floor -> 1 (round would give 2)
      expect(battleSkillMpCost({ mpCost: { flat: 0, percentMax: 5 } }, 30)).toBe(1);
    });

    it("matches the round path exactly when there is no fractional share", () => {
      // maxMp = 100, percentMax = 5 -> 5.0; floor and round agree
      expect(battleSkillMpCost({ mpCost: { flat: 0, percentMax: 5 } }, 100)).toBe(5);
    });

    it("clamps negative flat cost to 0 (old field formula increased MP on negative flat)", () => {
      expect(battleSkillMpCost({ mpCost: { flat: -10, percentMax: 0 } }, 100)).toBe(0);
    });

    it("truncates fractional flat cost (old field formula passed fractional flat through)", () => {
      expect(battleSkillMpCost({ mpCost: { flat: 3.7, percentMax: 0 } }, 100)).toBe(3);
    });

    it("combines truncated flat with floored percentMax share", () => {
      // flat 2.9 -> trunc 2; maxMp 30 * 7 / 100 = 2.1 -> floor 2; total 4
      expect(battleSkillMpCost({ mpCost: { flat: 2.9, percentMax: 7 } }, 30)).toBe(4);
    });

    it("defends against missing flat/percentMax via ?? 0", () => {
      expect(battleSkillMpCost({ mpCost: { percentMax: 10 } as never }, 50)).toBe(5);
      expect(battleSkillMpCost({ mpCost: { flat: 7 } as never }, 50)).toBe(7);
    });
  });
});

describe("gen1DemoContent", () => {
  isolateTimers();
  const GEN1_TYPES = [
    "normal", "fighting", "flying", "poison", "ground", "rock", "bug", "ghost",
    "fire", "water", "grass", "electric", "psychic", "ice", "dragon",
  ] as const;
  describe("Scarloxy Gen1 authored content", () => {
    it("authors all 15 R/B types with their physical/special damage classes", () => {
      const project = createScarloxyPokemonDemoProject();
      expect(project.system.typeChart?.types).toEqual(GEN1_TYPES);
      const kinds = Object.fromEntries(project.database.elements
        .filter((element) => GEN1_TYPES.includes(element.id as typeof GEN1_TYPES[number]))
        .map((element) => [element.id, element.kind]));
      expect(kinds).toEqual({
        normal: "physical", fighting: "physical", flying: "physical", poison: "physical",
        ground: "physical", rock: "physical", bug: "physical", ghost: "physical",
        fire: "magical", water: "magical", grass: "magical", electric: "magical",
        psychic: "magical", ice: "magical", dragon: "magical",
      });
      expect(new Set((project.database.monsterSpecies ?? []).flatMap((species) => species.types)))
        .toEqual(new Set(GEN1_TYPES));
    });

    it("authors the R/B matchup table including immunities and the Ghost/Psychic bug", () => {
      const chart = createScarloxyPokemonDemoProject().system.typeChart;
      expect(chart?.multipliers.normal?.ghost).toBe(0);
      expect(chart?.multipliers.fighting?.ghost).toBe(0);
      expect(chart?.multipliers.electric?.ground).toBe(0);
      expect(chart?.multipliers.ground?.flying).toBe(0);
      expect(chart?.multipliers.ghost?.normal).toBe(0);
      expect(chart?.multipliers.ghost?.psychic).toBe(0);
      expect(chart?.multipliers.bug?.poison).toBe(2);
      expect(chart?.multipliers.poison?.bug).toBe(2);
      expect(chart?.multipliers.ice?.dragon).toBe(2);
      for (const attackType of GEN1_TYPES) {
        expect(Object.keys(chart?.multipliers[attackType] ?? {})).toEqual(GEN1_TYPES);
      }
    });

    it("authors persistent major statuses, finite PP, a Poke Ball, and trainer semantics", () => {
      const project = createScarloxyPokemonDemoProject();
      const majorStatuses = Object.fromEntries(project.database.states
        .filter((state) => state.gen1MajorStatus)
        .map((state) => [state.gen1MajorStatus, state]));
      // 맹독(toxic)은 #2657 에서 gen1 주 상태로 더해졌다.
      expect(Object.keys(majorStatuses).sort()).toEqual(["burn", "freeze", "paralysis", "poison", "sleep", "toxic"]);
      for (const state of Object.values(majorStatuses)) {
        expect(state.runtimeEffects?.removeOnBattleEnd).toBe(false);
      }

      // The factory retains the RPG catalog for editing; the authored Gen1 roster is additive.
      const demoSpecies = (project.database.monsterSpecies ?? []).filter((species) => species.id.startsWith("species_scarloxy_"));
      expect(demoSpecies).toHaveLength(19);
      const speciesSkillIds = new Set(demoSpecies.flatMap((species) => species.skillsByLevel.map((entry) => entry.skillId)));
      for (const skillId of speciesSkillIds) {
        const skill = project.database.skills.find((skill) => skill.id === skillId);
        if (!skill?.maxPp) throw new Error(`Missing authored PP for ${skillId}`);
        expect(skill.maxPp).toBeGreaterThan(0);
        const user = { mp: 0, maxMp: 0, skillIds: [skillId], monsterInstanceId: "demo", skillPp: { [skillId]: 1 }, stateIds: [] };
        expect(battleSkillUseFailure(project, user, skillId)).toBeUndefined();
        expect(consumeBattleSkillResource(project, user, skillId)).toEqual({ kind: "pp", remaining: 0 });
        expect(battleSkillUseFailure(project, user, skillId)).toBe("noPp");
      }
      expect(project.database.items.find((item) => item.id === "item_capture_orb")?.captureProfile?.ballClass).toBe("poke");
      expect(project.database.troops.find((troop) => troop.id === "troop_pkmn_rival")?.trainerBattle).toBe(true);
      expect(project.database.troops
        .filter((troop) => troop.id.startsWith("troop_pkmn_grass") || troop.id === "troop_pkmn_shore")
        .every((troop) => troop.members?.length === 1)).toBe(true);
    });
  });
});

// 리미트(#9)·파티 공용 게이지(#16)·제2 자원 기력(#21) — 실제 전투 런타임을 통과해 확인한다.
describe("mgL3BattleGauges", () => {
  isolateTimers();
  function project(): Project {
    return deserialize(JSON.stringify(battleFixture));
  }
  function skill(base: Project, patch: Partial<SkillRecord> & Pick<SkillRecord, "id">): SkillRecord {
    return {
      ...base.database.skills[0]!,
      name: patch.id,
      scope: "enemy",
      power: 5,
      mpCost: { flat: 0, percentMax: 0 },
      successRate: 100,
      hitRate: 100,
      variance: 0,
      effect: { kind: "damage", statistic: "attack", affects: "hp" },
      stateEffects: [],
      ...patch,
    };
  }
  function learn(p: Project, ...skillIds: string[]): void {
    p.database.actors[0]!.learnedSkills = skillIds.map((skillId) => ({ level: 1, skillId }));
  }
  /** 드래곤을 「때리는 적」으로 순하게: 공격 60(주인공 방어 59 로 30 안팎), 기술 없음. */
  function hittingEnemy(p: Project): void {
    const dragon = p.database.enemies.find((enemy) => enemy.id === "enemy_dragon")!;
    dragon.stats.attack = 60;
    dragon.stats.maxHp = 5000;
    dragon.skillIds = [];
    dragon.actions = [];
  }
  function gaugeBattle(p: Project, troopId = "troop_slime") {
    return createBattleRuntime({ project: p, troopId, canEscape: true, canLose: true, battleFlow: "gauge", rng: () => 0.5 });
  }
  function tickUntilEnemyHit(runtime: ReturnType<typeof createBattleRuntime>) {
    for (let guard = 0; guard < 400; guard += 1) {
      const hit = runtime.snapshot().timeline.find((entry) => entry.commandKind === "enemyAttack" && entry.hit && (entry.amount ?? 0) > 0);
      if (hit) return hit;
      if (runtime.snapshot().phase === "actorCommand") runtime.performActorCommand({ kind: "defend" });
      runtime.tick(100);
    }
    throw new Error("enemy never hit");
  }
  function actorTurn(runtime: ReturnType<typeof createBattleRuntime>): void {
    for (let guard = 0; guard < 200 && runtime.snapshot().phase !== "actorCommand" && !runtime.snapshot().result; guard += 1) runtime.tick(100);
    expect(runtime.snapshot().phase).toBe("actorCommand");
  }
  describe("battle gauges are absent unless the system enables them", () => {
    it("legacy projects expose no gauge fields and deal the same damage as before", () => {
      const legacy = gaugeBattle(project());
      actorTurn(legacy);
      legacy.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      const snapshot = legacy.snapshot();
      expect(snapshot.partyGauge).toBeUndefined();
      expect(snapshot.actors[0]!.limitGauge).toBeUndefined();
      expect(snapshot.actors[0]!.resource2).toBeUndefined();

      const enabled = project();
      enabled.system.limitGauge = { enabled: true };
      enabled.system.resource2 = { enabled: true };
      enabled.system.partyGauge = { enabled: true };
      const withGauges = gaugeBattle(enabled);
      actorTurn(withGauges);
      withGauges.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      const gauged = withGauges.snapshot();
      // 게이지는 피해 숫자와 rng 흐름을 바꾸지 않는다.
      expect(gauged.enemies[0]!.hp).toBe(snapshot.enemies[0]!.hp);
      expect(gauged.actors[0]!.limitGauge).toBeGreaterThan(0);
      expect(gauged.actors[0]!.resource2).toBeGreaterThan(0);
      expect(gauged.partyGauge).toBeGreaterThan(0);
    });
  });
  describe("resource2 (기력) second skill resource", () => {
    it("is earned by dealing damage, gates resource2Cost skills, and is spent on use", () => {
      const p = project();
      p.system.resource2 = { enabled: true, max: 100, start: 0, dealtGain: 20, takenGain: 0 };
      p.database.skills.push(skill(p, { id: "skill_burst", resource2Cost: 20 }));
      learn(p, "skill_fire", "skill_burst");
      const runtime = gaugeBattle(p);
      actorTurn(runtime);
      const hero = runtime.snapshot().actors[0]!;
      expect(hero.resource2).toBe(0);
      expect(battleSkillUseFailure(p, hero, "skill_burst")).toBe("insufficientResource2");

      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().actors[0]!.resource2).toBe(20);

      actorTurn(runtime);
      expect(battleSkillUseFailure(p, runtime.snapshot().actors[0]!, "skill_burst")).toBeUndefined();
      runtime.performActorCommand({ kind: "skill", skillId: "skill_burst", targetEnemyId: "enemy-1" });
      // 20 을 쓰고, 그 기술의 명중으로 다시 20 을 얻는다.
      expect(runtime.snapshot().actors[0]!.resource2).toBe(20);
      expect(runtime.snapshot().timeline.some((entry) => entry.skillName === "skill_burst" && entry.hit)).toBe(true);
    });

    it("fills when the actor takes damage and never exceeds max", () => {
      const p = project();
      p.system.resource2 = { enabled: true, max: 15, start: 10, dealtGain: 0, takenGain: 10 };
      hittingEnemy(p);
      const runtime = gaugeBattle(p, "troop_dragon");
      expect(runtime.snapshot().actors[0]!.resource2).toBe(10);
      tickUntilEnemyHit(runtime);
      expect(runtime.snapshot().actors[0]!.resource2).toBe(15);
    });

    it("survives save/load and costs nothing when the system is off", () => {
      const p = project();
      p.system.resource2 = { enabled: false, label: "기력" };
      p.database.skills.push(skill(p, { id: "skill_burst", resource2Cost: 30 }));
      const reloaded = deserialize(serialize(p));
      expect(reloaded.system.resource2).toEqual({ enabled: false, label: "기력" });
      // 켠 전투에서도 게이지가 없는 적은 같은 기술을 막히지 않고 쓴다.
      const enabledForEnemy = deserialize(serialize(p));
      enabledForEnemy.system.resource2 = { enabled: true };
      const enemy = gaugeBattle(enabledForEnemy).snapshot().enemies[0]!;
      expect(enemy.resource2).toBeUndefined();
      expect(battleSkillUseFailure(enabledForEnemy, enemy, "skill_burst", { requireLearned: false })).toBeUndefined();
      expect(reloaded.database.skills.find((entry) => entry.id === "skill_burst")?.resource2Cost).toBe(30);
      learn(reloaded, "skill_burst");
      const runtime = gaugeBattle(reloaded);
      actorTurn(runtime);
      expect(battleSkillUseFailure(reloaded, runtime.snapshot().actors[0]!, "skill_burst")).toBeUndefined();
      // 같은 스킬도 켜면 막힌다 — 끈 상태가 「비용 무시」라는 증거.
      reloaded.system.resource2 = { enabled: true };
      const enabled = gaugeBattle(reloaded);
      actorTurn(enabled);
      expect(battleSkillUseFailure(reloaded, enabled.snapshot().actors[0]!, "skill_burst")).toBe("insufficientResource2");
    });
  });
  describe("limit gauge", () => {
    it("fills from damage taken and dealt, unlocks limitSkill at 100, and empties on use", () => {
      const p = project();
      p.system.limitGauge = { enabled: true, takenRate: 100, dealtGain: 60 };
      p.database.skills.push(skill(p, { id: "skill_limit", limitSkill: true, power: 50 }));
      learn(p, "skill_fire", "skill_limit");
      const runtime = gaugeBattle(p);
      actorTurn(runtime);
      expect(runtime.snapshot().actors[0]!.limitGauge).toBe(0);
      expect(battleSkillUseFailure(p, runtime.snapshot().actors[0]!, "skill_limit")).toBe("limitNotReady");
      runtime.performActorCommand({ kind: "skill", skillId: "skill_limit", targetEnemyId: "enemy-1" });
      // 거부된 명령은 턴을 쓰지 않는다.
      expect(runtime.snapshot().phase).toBe("actorCommand");

      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      const afterFirst = runtime.snapshot().actors[0]!.limitGauge!;
      expect(afterFirst).toBeGreaterThanOrEqual(60);
      actorTurn(runtime);
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().actors[0]!.limitGauge).toBe(100);

      actorTurn(runtime);
      expect(battleSkillUseFailure(p, runtime.snapshot().actors[0]!, "skill_limit")).toBeUndefined();
      runtime.performActorCommand({ kind: "skill", skillId: "skill_limit", targetEnemyId: "enemy-1" });
      // 쓰는 순간 0 이 되고, 그 기술 명중으로 dealtGain 만큼 다시 찬다.
      expect(runtime.snapshot().actors[0]!.limitGauge).toBe(60);
    });

    it("charges proportionally to the share of max HP lost when hit", () => {
      const p = project();
      p.system.limitGauge = { enabled: true, takenRate: 100, dealtGain: 0 };
      hittingEnemy(p);
      const runtime = gaugeBattle(p, "troop_dragon");
      const maxHp = runtime.snapshot().actors[0]!.maxHp;
      const hit = tickUntilEnemyHit(runtime);
      expect(runtime.snapshot().actors[0]!.limitGauge).toBeCloseTo((hit.amount! / maxHp) * 100, 5);
    });
  });
  describe("shared party gauge", () => {
    it("is filled by ally hits, shown on the snapshot, and spent by partyGaugeCost follow-ups", () => {
      const p = project();
      p.system.partyGauge = { enabled: true, max: 50, gainPerHit: 30 };
      p.database.skills.push(skill(p, { id: "skill_follow", partyGaugeCost: 50, power: 40 }));
      learn(p, "skill_fire", "skill_follow");
      const runtime = gaugeBattle(p);
      actorTurn(runtime);
      expect(runtime.snapshot().partyGauge).toBe(0);
      const participants = () => runtime.snapshot().actors.map((actor) => ({ recordId: actor.recordId, hp: actor.hp, mp: actor.mp, maxMp: actor.maxMp, stateIds: actor.stateIds, ready: true }));
      expect(battleActorSkillFailure(p, runtime.snapshot().actors[0]!, "skill_follow", participants(), runtime.snapshot().partyGauge)).toBe("insufficientPartyGauge");

      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().partyGauge).toBe(30);
      actorTurn(runtime);
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().partyGauge).toBe(50);

      actorTurn(runtime);
      expect(battleActorSkillFailure(p, runtime.snapshot().actors[0]!, "skill_follow", participants(), runtime.snapshot().partyGauge)).toBeUndefined();
      runtime.performActorCommand({ kind: "skill", skillId: "skill_follow", targetEnemyId: "enemy-1" });
      // 50 을 쓰고, 연계기 명중으로 30 을 다시 얻는다.
      expect(runtime.snapshot().partyGauge).toBe(30);
    });

    it("does not grow from enemy hits on allies", () => {
      const p = project();
      p.system.partyGauge = { enabled: true, gainPerHit: 30 };
      hittingEnemy(p);
      const runtime = gaugeBattle(p, "troop_dragon");
      tickUntilEnemyHit(runtime);
      expect(runtime.snapshot().partyGauge).toBe(0);
      actorTurn(runtime);
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().partyGauge).toBe(30);
    });
  });
});
