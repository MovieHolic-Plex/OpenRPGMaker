import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { resolveBattleBackdrop } from "@/battle/battleBackdrop";
import type { Project, EnemyRecord, StateRecord, MonsterSpeciesRecord, SkillRecord } from "@/project/types";
import { damageTypeMultiplier, battleEffectivenessMultiplier, battleElementMultiplier } from "@/battle/battleElementModifiers";
import { loadBattleFixture } from "./fixtures/battleFixtureLoadable";
import { enemyActionDirectorState } from "@/player/battleDirectorDom";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import battleFixture from "./fixtures/projects/battle-v3.json";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";
import { isolateTimers } from "./mergedTeardown";
import { RETRO_CLASS_SKILLS } from "@/assets/retroClassSkills";
import { retroClassSkillTimeline, retroSoundForLayer } from "@/battle/retroSkillTimeline";
import { battleSkillMpCost, battleSkillUseFailure, consumeBattleSkillResource, battleActorSkillFailure } from "@/battle/battleSkillUse";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";

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

describe("battleElementModifiers", () => {
  isolateTimers();
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

describe("battleSkillUse", () => {
  isolateTimers();
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
});
