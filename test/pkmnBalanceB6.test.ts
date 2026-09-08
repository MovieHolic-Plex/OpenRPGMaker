// B6's six July gauge calibrations predate Pokemon stats and the actor-party enemy rebalance.
// Preserve the seven tracked coverage slots and the existing type-effectiveness check,
// using explicit Gen1 fixtures and independent known answers rather than retuning shipped data.
import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { simulateBattle } from "@/battle/simulate";
import { createBlankProject } from "@/project/defaults";
import { normalizeEnemyRecord, normalizeSkillRecord, normalizeTroopRecord } from "@/project/databaseRecordModel";
import { monsterBattleStats, monsterSpeciesById, normalizeMonsterSpeciesRecord } from "@/project/monsterCollection";
import type { MonsterInstance } from "@/project/session";
import type { Project } from "@/project/types";

const STARTERS = ["species_aqualing", "species_leafling", "species_sparkit"] as const;

function mon(project: Project, speciesId: string, level: number, id = "mon_1"): MonsterInstance {
  return {
    instanceId: id, speciesId, level, exp: 0,
    ivs: { hp: 0, atk: 0, def: 0, spd: 0 }, friendship: 70,
    caughtAt: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
  };
}

function gen1Fixture() {
  const project = createBlankProject();
  project.system = {
    ...project.system, battleModel: "gen1", battleFlow: "strict", battleUiStyle: "pokemon",
    battleParty: "monsters", monsterCollection: true, activeSlots: undefined,
    typeChart: { types: ["normal", "water"], multipliers: { normal: { water: 1 } } },
  };
  const species = normalizeMonsterSpeciesRecord({
    id: "species_b6", name: "B6 specimen", types: ["water"],
    baseStats: { maxHp: 100, maxMp: 0, attack: 95, defense: 95, mind: 95, agility: 40 },
    skillsByLevel: [{ level: 1, skillId: "skill_b6" }],
  });
  const skill = normalizeSkillRecord({
    id: "skill_b6", name: "B6 strike", type: "normal", scope: "enemy",
    mpCost: { flat: 0, percentMax: 0 }, power: 40, hitRate: 100, successRate: 100, variance: 0,
    effect: { kind: "damage", statistic: "attack", affects: "hp" },
    elementId: "normal", maxPp: 5, movePriority: 1,
  });
  const enemy = normalizeEnemyRecord({
    id: "enemy_b6", name: "B6 opponent", speciesId: species.id, level: 50,
    stats: { maxHp: 100, maxMp: 0, attack: 1, defense: 100, mind: 100, agility: 1 },
    actions: [{ skillId: "skill_b6_enemy", priority: 5, condition: { kind: "always" } }],
    stateRates: {}, elementRates: {},
  });
  project.database.monsterSpecies = [species];
  project.database.skills = [skill, { ...skill, id: "skill_b6_enemy", name: "B6 reply", movePriority: 0 }];
  project.database.enemies = [enemy];
  project.database.troops = [normalizeTroopRecord({ id: "troop_b6", name: "B6 duel", enemyIds: [enemy.id] })];
  project.database.states = [];
  project.database.elements = [{
    id: "normal", name: "Normal", kind: "physical", rateLabels: ["A", "B", "C", "D", "E"],
    damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 },
  }];
  return { project, species, skill, enemy };
}

function duel(project: Project, party: readonly MonsterInstance[]) {
  // Each move gets noncritical byte 255, maximum damage byte 255, and hit byte 0.
  // One target/action and unequal priority/Speed avoid unrelated RNG draws.
  let byteIndex = 0;
  return createBattleRuntime({
    project, troopId: "troop_b6", partyMonsters: party, canEscape: false, canLose: true,
    rng: () => (byteIndex++ % 3 === 2 ? 0 : 255 / 256),
  });
}

const strike = { kind: "skill", skillId: "skill_b6", targetEnemyId: "enemy-1" } as const;

describe("batch 6 · explicit Gen1 combat contracts", () => {
  it("uses Pokemon stat known answers at L5 and L50 with explicit IVs", () => {
    const { project, species } = gen1Fixture();
    const starter = mon(project, species.id, 5);
    const trained = { ...starter, level: 50, ivs: { hp: 15, atk: 15, def: 15, spd: 15 } };

    // HP=floor((200+IV)*L/100)+L+10; other stats=floor((190+IV)*L/100)+5.
    expect(monsterBattleStats(project, starter)).toEqual({ maxHp: 25, maxMp: 0, attack: 14, defense: 14, mind: 14, agility: 9 });
    expect(monsterBattleStats(project, trained)).toEqual({ maxHp: 167, maxMp: 0, attack: 107, defense: 107, mind: 100, agility: 52 });
  });

  it("deals the cartridge L50 P40 A100 D100 known answer and spends one PP", () => {
    const { project, species } = gen1Fixture();
    const runtime = duel(project, [mon(project, species.id, 50)]);
    const before = runtime.snapshot();
    expect(before.actors[0]?.skillPp?.skill_b6).toBe(5);

    runtime.performActorCommand(strike);

    // floor(floor((floor(2*50/5)+2)*40*100/100)/50)+2 = 19; no STAB.
    const after = runtime.snapshot();
    expect(after.timeline.find((entry) => entry.side === "actor" && entry.kind === "damage"))
      .toMatchObject({ hit: true, critical: false, amount: 19 });
    expect(after.enemies[0]?.hp).toBe(81);
    expect(after.actors[0]?.skillPp?.skill_b6).toBe(4);
  });

  it("orders a slow priority move before a fast opponent and Speed breaks equal priority", () => {
    for (const priority of [1, 0]) {
      const { project, species, skill, enemy } = gen1Fixture();
      skill.movePriority = priority;
      enemy.stats.agility = 100;
      const runtime = duel(project, [mon(project, species.id, 50)]);

      runtime.performActorCommand(strike);

      const sides = runtime.snapshot().roundLogs.flatMap((round) => round.actions.map((action) => action.side));
      expect(sides).toEqual(priority === 1 ? ["actor", "enemy"] : ["enemy", "actor"]);
    }
  });

  it("matches both combatants at L26 and uses that level in the damage formula", () => {
    const { project, species, enemy } = gen1Fixture();
    enemy.level = 26;
    enemy.stats = { maxHp: 88, maxMp: 0, attack: 54, defense: 54, mind: 54, agility: 25 };
    const runtime = duel(project, [mon(project, species.id, 26)]);
    const before = runtime.snapshot();
    expect(before.actors[0]).toMatchObject({ level: 26, maxHp: 88, effectiveStats: { attack: 54, defense: 54 } });
    expect(before.enemies[0]).toMatchObject({ level: 26, maxHp: 88, effectiveStats: { attack: 54, defense: 54 } });

    runtime.performActorCommand(strike);

    // L26's level term is 12: floor(12*40/50)+2 = 11, not the L50 answer 19.
    expect(runtime.snapshot().timeline.find((entry) => entry.side === "actor" && entry.kind === "damage"))
      .toMatchObject({ hit: true, critical: false, amount: 11 });
  });

  it("counts two usable-move decisions and two resolved attacks in a seeded Gen1 simulation", () => {
    const { project, species, enemy } = gen1Fixture();
    species.baseStats.agility = 1; // Critical threshold floor(base Speed / 2) = 0.
    enemy.stats.maxHp = 20; // Two neutral hits of 16..19, never a one-hit victory.
    const actor = { ...mon(project, species.id, 50), skillPp: { skill_b6: 2 } };

    const result = simulateBattle({ project, troopId: "troop_b6", heroLevel: 1, monsterParty: [actor], n: 1, seed: 42, maxSteps: 4 });

    expect(result.battleFlow).toBe("strict");
    expect(result.samples).toBe(1);
    expect(result.winRate).toBe(1);
    expect(result.avgTurns).toBe(2);
    const actions = result.roundLogs.flatMap((round) => round.actions).filter((action) => action.side === "actor");
    expect(actions.map((action) => ({ kind: action.commandKind, hit: action.hit })))
      .toEqual([{ kind: "skill", hit: true }, { kind: "skill", hit: true }]);
    expect(result.participatingActorIds).toEqual(["mon_1"]);
    expect(actor.skillPp).toEqual({ skill_b6: 2 }); // Simulation consumes battle state, not its input.
  });

  it("defaults a Gen1 trio to one active monster and admits reserves only by switching", () => {
    const { project, species } = gen1Fixture();
    const party = ["mon_1", "mon_2", "mon_3"].map((id) => mon(project, species.id, 50, id));
    const runtime = duel(project, party);
    expect(runtime.snapshot().actors.map((actor) => actor.recordId)).toEqual(["mon_1"]);
    expect(runtime.snapshot().reserveActors.map((actor) => actor.recordId)).toEqual(["mon_2", "mon_3"]);
    expect(runtime.snapshot().participatingActorIds).toEqual(["mon_1"]);

    runtime.performActorCommand({ kind: "switch", targetActorId: "mon_2" });

    expect(runtime.snapshot().actors.map((actor) => actor.recordId)).toEqual(["mon_2"]);
    expect(runtime.snapshot().reserveActors.map((actor) => actor.recordId)).toEqual(["mon_1", "mon_3"]);
    expect(runtime.snapshot().participatingActorIds).toEqual(["mon_1", "mon_2"]);
    expect(runtime.snapshot().reserveActors.find((actor) => actor.recordId === "mon_3")?.hp).toBe(160);
  });
});

describe("batch 6 · type weakness is clearly felt (>=3x vs resist)", () => {
  function skillDamageVs(targetSpecies: string, level: number): number {
    const project = createBlankProject();
    const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
    if (!enemy) throw new Error("missing enemy_slime");
    enemy.speciesId = targetSpecies;
    enemy.stats = { ...enemy.stats, maxHp: 100000, defense: 1, attack: 1 };
    const result = simulateBattle({
      project,
      troopId: "troop_slime",
      heroLevel: 1,
      battleFlow: "strict",
      n: 1,
      seed: 3,
      monsterParty: [mon(project, "species_aqualing", level, "mon_w")],
      strictScript: [[{ actorId: "mon_w", command: "skill", skillId: "skill_water", target: "enemy-1" }]],
      maxSteps: 6,
    });
    return result.roundLogs[0]?.actions.find((action) => action.side === "actor")?.amount ?? 0;
  }

  it("water skill on fire target deals >=3x the damage of water target, at L5 and L35", () => {
    for (const level of [5, 35]) {
      const weak = skillDamageVs("species_cave_bat", level); // fire → 2× (+STAB)
      const resist = skillDamageVs("species_aqualing", level); // water → 0.5× (+STAB)
      expect(weak).toBeGreaterThan(0);
      expect(resist).toBeGreaterThan(0);
      expect(weak / resist).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("batch 6 · progression ladder sanity", () => {
  it("L1 stats use the Pokemon formula through the instance API", () => {
    const project = createBlankProject();
    for (const speciesId of STARTERS) {
      const species = monsterSpeciesById(project, speciesId);
      if (!species) throw new Error(`missing ${speciesId}`);
      const stats = monsterBattleStats(project, mon(project, speciesId, 1));
      expect(stats.maxHp).toBe(Math.floor(2 * species.baseStats.maxHp / 100) + 11);
      expect(stats.attack).toBe(Math.floor(2 * species.baseStats.attack / 100) + 5);
      expect(stats.defense).toBe(Math.floor(2 * species.baseStats.defense / 100) + 5);
      expect(stats.mind).toBe(Math.floor(2 * species.baseStats.mind / 100) + 5);
      expect(stats.agility).toBe(Math.floor(2 * species.baseStats.agility / 100) + 5);
    }
  });
});
