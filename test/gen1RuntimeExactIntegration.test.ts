import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { chooseAutoBattleCommand } from "@/battle/battleAuto";
import { resolveGen1DamagingMove } from "@/battle/gen1/damage";
import { gen1CaptureProbability } from "@/battle/gen1/capture";
import { gen1TypeModifiersForTypes } from "@/battle/typeChart";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import { giveMonster, monsterMaxHp } from "@/project/monsterCollection";
import { startSession } from "@/project/session";
import type { MonsterInstance } from "@/project/types";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";

const BYTE_255 = 255 / 256;

function sequence(values: readonly number[], fallback = BYTE_255): () => number {
  let index = 0;
  return () => values[index++] ?? fallback;
}

function monster(overrides: Partial<MonsterInstance> = {}): MonsterInstance {
  return {
    instanceId: "monster-runtime-exact",
    speciesId: scarloxySpeciesId("sparchu"),
    level: 50,
    exp: 0,
    skillIds: ["skill_scarloxy_quick"],
    skillPp: { skill_scarloxy_quick: 1 },
    friendship: 70,
    caughtAt: { mapId: "map_pkmn_town", x: 1, y: 1 },
    ...overrides,
  };
}

function exactBattle(options: {
  readonly partyMonster?: MonsterInstance;
  readonly partyMonsters?: readonly MonsterInstance[];
  readonly rng?: () => number;
  readonly inventory?: Readonly<Record<string, number>>;
  readonly configure?: (project: ReturnType<typeof createScarloxyPokemonDemoProject>) => void;
} = {}) {
  const project = createScarloxyPokemonDemoProject();
  const enemy = project.database.enemies.find((record) => record.id === "enemy_pkmn_larvea");
  if (!enemy) throw new Error("missing exact-runtime enemy");
  enemy.stats = { ...enemy.stats, maxHp: 999, attack: 1, defense: 100, mind: 100, agility: 1 };
  enemy.actions = [{
    skillId: "skill_scarloxy_scratch",
    priority: 5,
    condition: { kind: "always" },
    switchOnAfterAction: { enabled: false },
    switchOffAfterAction: { enabled: false },
  }];
  options.configure?.(project);
  const partyMonster = options.partyMonster ?? monster();
  const runtime = createBattleRuntime({
    project,
    troopId: "troop_pkmn_grass_a",
    canEscape: true,
    canLose: true,
    battleFlow: "strict",
    partyMonsters: options.partyMonsters ?? [partyMonster],
    sessionState: { switches: {}, variables: {}, inventory: options.inventory ?? {} },
    rng: options.rng ?? sequence([BYTE_255, BYTE_255, 0]),
  });
  return { project, runtime, partyMonster };
}

describe("Gen1 exact engines are wired into the battle runtime", () => {
  it("uses cartridge damage order and consumes exactly one PP", () => {
    const { project, runtime } = exactBattle();
    const before = runtime.snapshot();
    const actor = before.actors[0]!;
    const enemy = before.enemies[0]!;
    const species = project.database.monsterSpecies?.find((record) => record.id === actor.speciesId)!;
    const modifiers = project.system.typeChart!;
    const normalRow = modifiers.multipliers.normal ?? {};
    const targetTypes = project.database.monsterSpecies?.find((record) => record.id === enemy.speciesId)?.types ?? [];
    const expected = resolveGen1DamagingMove({
      level: actor.level ?? 1,
      power: project.database.skills.find((record) => record.id === "skill_scarloxy_quick")!.power,
      damageClass: "physical",
      baseSpeed: species.baseStats.agility,
      criticalRate: "normal",
      offense: { unmodified: actor.effectiveStats!.attack, modified: actor.effectiveStats!.attack },
      defense: { unmodified: enemy.effectiveStats!.defense, modified: enemy.effectiveStats!.defense },
      burned: false,
      stab: species.types?.includes("normal") ?? false,
      typeFactors: targetTypes.map((type) => Math.round((normalRow[type] ?? 1) * 10)),
      baseAccuracyByte: 255,
    }, sequence([255, 255, 0]));

    runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
    const after = runtime.snapshot();
    const actorHit = after.timeline.find((entry) => entry.side === "actor" && entry.kind === "damage");

    expect(actorHit).toMatchObject({ hit: true, amount: expected.damage, critical: expected.critical });
    expect(after.actors[0]?.skillPp?.skill_scarloxy_quick).toBe(0);
  });

  it("keeps the cartridge 1/256 miss on an authored 100% move", () => {
    const { runtime } = exactBattle({ rng: sequence([BYTE_255, BYTE_255, BYTE_255]) });

    runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
    const miss = runtime.snapshot().timeline.find((entry) => entry.side === "actor" && entry.kind === "miss");

    expect(miss).toMatchObject({ hit: false, amount: 0 });
    expect(runtime.snapshot().actors[0]?.skillPp?.skill_scarloxy_quick).toBe(0);
  });

  it("uses the element damage class even when the authored statistic says attack", () => {
    const { project, runtime } = exactBattle({
      rng: sequence([BYTE_255, BYTE_255, 0]),
      configure: (configured) => {
        const skill = configured.database.skills.find((record) => record.id === "skill_scarloxy_quick")!;
        skill.elementId = "psychic";
        skill.effect = { kind: "damage", statistic: "attack", affects: "hp" };
        const enemy = configured.database.enemies.find((record) => record.id === "enemy_pkmn_larvea")!;
        enemy.stats = { ...enemy.stats, defense: 1, mind: 100 };
      },
    });
    const before = runtime.snapshot();
    const actor = before.actors[0]!;
    const enemy = before.enemies[0]!;
    const modifiers = gen1TypeModifiersForTypes(
      project,
      "psychic",
      project.database.monsterSpecies?.find((record) => record.id === actor.speciesId)?.types ?? [],
      project.database.monsterSpecies?.find((record) => record.id === enemy.speciesId)?.types ?? [],
    );
    const expected = resolveGen1DamagingMove({
      level: actor.level ?? 1,
      power: project.database.skills.find((record) => record.id === "skill_scarloxy_quick")!.power,
      damageClass: "special",
      baseSpeed: project.database.monsterSpecies?.find((record) => record.id === actor.speciesId)!.baseStats.agility ?? actor.effectiveStats!.agility,
      criticalRate: "normal",
      offense: { unmodified: actor.effectiveStats!.mind, modified: actor.effectiveStats!.mind },
      defense: { unmodified: enemy.effectiveStats!.mind, modified: enemy.effectiveStats!.mind },
      burned: false,
      stab: modifiers.stab,
      typeFactors: modifiers.typeFactors,
      baseAccuracyByte: 255,
    }, sequence([255, 255, 0]));

    runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
    const hit = runtime.snapshot().timeline.find((entry) => entry.side === "actor" && entry.kind === "damage");

    expect(hit?.amount).toBe(expected.damage);
  });

  it("lets a sleeping battler choose a move, loses the wake-up turn, and keeps its PP", () => {
    const { runtime } = exactBattle({
      partyMonster: monster({ stateIds: ["state_sleep"], stateTurns: { state_sleep: 1 } }),
      rng: sequence([]),
    });

    runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
    const snapshot = runtime.snapshot();

    expect(snapshot.actors[0]?.stateIds).not.toContain("state_sleep");
    expect(snapshot.actors[0]?.skillPp?.skill_scarloxy_quick).toBe(1);
    expect(snapshot.timeline.some((entry) => entry.kind === "incapacitated" && entry.side === "actor")).toBe(true);
  });

  it("applies poison residual after the attempted move and allows it to faint the user", () => {
    const { runtime } = exactBattle({
      partyMonster: monster({ currentHp: 1, stateIds: ["state_poison"] }),
      rng: sequence([BYTE_255, BYTE_255, 0]),
    });

    runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
    const snapshot = runtime.snapshot();

    expect(snapshot.timeline.some((entry) => entry.kind === "stateUpkeep" && entry.side === "actor" && entry.amount === 4)).toBe(true);
    expect(snapshot.actors[0]?.hp).toBe(0);
    expect(snapshot.result).toBe("defeat");
  });

  it("uses the exact two-stage capture rate and preserves the captured battle state", () => {
    const { project, runtime } = exactBattle({
      inventory: { item_capture_orb: 1 },
      rng: sequence([45 / 256, 85 / 256, 0, 0, 0, 0]),
    });
    const before = runtime.snapshot().enemies[0]!;
    const species = project.database.monsterSpecies?.find((record) => record.id === before.speciesId)!;
    const expected = gen1CaptureProbability({
      ballClass: "poke",
      maxHp: before.maxHp,
      currentHp: before.hp,
      catchRate: Math.round(species.captureRate * 255),
    });

    runtime.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });
    const snapshot = runtime.snapshot();

    expect(snapshot.lastCaptureResult).toMatchObject({ success: true, rate: expected.value, shakes: 3 });
    expect(snapshot.capturedMonsters[0]).toMatchObject({
      currentHp: before.hp,
      stateIds: before.stateIds,
      stateTurns: before.stateTurns,
    });
  });

  it("keeps persistent status but drops battle-only buffs from a captured monster", () => {
    const { runtime } = exactBattle({
      inventory: { item_capture_orb: 1 },
      rng: sequence([0, BYTE_255, BYTE_255, 123 / 256, 0, 0, 0, 0]),
      configure: (project) => {
        const quick = project.database.skills.find((record) => record.id === "skill_scarloxy_quick")!;
        quick.power = 0;
        quick.effect = { kind: "support" };
        quick.stateEffects = [
          { stateId: "state_attack_up", chance: 100, operation: "add" },
          { stateId: "state_paralysis", chance: 100, operation: "add" },
        ];
        const orb = project.database.items.find((record) => record.id === "item_capture_orb")!;
        orb.captureProfile = { ...orb.captureProfile!, ballClass: "master" };
      },
    });

    runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
    expect(runtime.snapshot().enemies[0]?.stateIds).toEqual(["state_attack_up", "state_paralysis"]);
    runtime.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });
    const capture = runtime.snapshot().capturedMonsters[0]!;

    expect(capture.stateIds).toEqual(["state_paralysis"]);
    expect(capture.stateTurns).not.toHaveProperty("state_attack_up");
  });

  it("falls back to Struggle with half-damage recoil when every move is exhausted", () => {
    const { runtime } = exactBattle({
      partyMonster: monster({ skillPp: { skill_scarloxy_quick: 0 } }),
      rng: sequence([BYTE_255, BYTE_255, 0]),
    });
    const beforeHp = runtime.snapshot().actors[0]!.hp;

    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    const snapshot = runtime.snapshot();
    const hit = snapshot.timeline.find((entry) => entry.side === "actor" && entry.skillName === "Struggle" && entry.targetId === "enemy-1")!;
    const recoil = snapshot.timeline.find((entry) => entry.side === "actor" && entry.skillName === "Struggle recoil")!;

    expect(hit.amount).toBeGreaterThan(0);
    expect(recoil.amount).toBe(Math.max(1, Math.floor(hit.amount! / 2)));
    expect(snapshot.actors[0]!.hp).toBeLessThanOrEqual(beforeHp - recoil.amount!);
  });

  it("resolves a final Struggle recoil double knockout as defeat without rewards", () => {
    const { runtime } = exactBattle({
      partyMonster: monster({ currentHp: 1, skillPp: { skill_scarloxy_quick: 0 } }),
      rng: sequence([BYTE_255, BYTE_255, 0]),
      configure(project) {
        project.database.enemies.find((enemy) => enemy.id === "enemy_pkmn_larvea")!.stats.maxHp = 1;
      },
    });
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    const snapshot = runtime.snapshot();
    expect(snapshot.actors.every((actor) => actor.hp === 0)).toBe(true);
    expect(snapshot.enemies.every((enemy) => enemy.hp === 0)).toBe(true);
    expect(snapshot.result).toBe("defeat");
    expect(snapshot.rewards).toMatchObject({ exp: 0, gold: 0, items: [] });
  });

  it("rejects a direct Struggle command while the actor still has a usable move", () => {
    const { runtime } = exactBattle();
    const before = runtime.snapshot();

    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    const after = runtime.snapshot();

    expect(after.actors[0]?.skillPp?.skill_scarloxy_quick).toBe(1);
    expect(after.timeline).toEqual(before.timeline);
    expect(after.strictPendingActorIds).toEqual(before.strictPendingActorIds);
    expect(after.timeline.some((entry) => entry.skillName === "Struggle")).toBe(false);
  });

  it("uses a learned move when no enemy action condition matches instead of Struggle", () => {
    const { runtime } = exactBattle({
      configure: (project) => {
        const enemy = project.database.enemies.find((record) => record.id === "enemy_pkmn_larvea")!;
        enemy.actions = [{
          skillId: "skill_scarloxy_scratch",
          priority: 5,
          condition: { kind: "turn", start: 99, interval: 1 },
          switchOnAfterAction: { enabled: false },
          switchOffAfterAction: { enabled: false },
        }];
      },
      rng: sequence([BYTE_255, BYTE_255, 0, BYTE_255, BYTE_255, 0]),
    });

    runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
    const snapshot = runtime.snapshot();

    expect(snapshot.timeline.some((entry) => entry.side === "enemy" && entry.skillName === "할퀴기")).toBe(true);
    expect(snapshot.timeline.some((entry) => entry.side === "enemy" && entry.skillName === "Struggle")).toBe(false);
  });

  it("auto-battle spends a usable support move instead of submitting a rejected Struggle", () => {
    const { project, runtime } = exactBattle({
      configure: (configured) => {
        const quick = configured.database.skills.find((record) => record.id === "skill_scarloxy_quick")!;
        quick.power = 0;
        quick.effect = { kind: "support" };
      },
    });

    expect(chooseAutoBattleCommand(project, runtime.snapshot(), () => 0)).toMatchObject({
      kind: "skill",
      skillId: "skill_scarloxy_quick",
    });
  });

  it("defaults a Gen1 monster party to one active battler when activeSlots is omitted", () => {
    const first = monster({ instanceId: "monster-active-1" });
    const second = monster({ instanceId: "monster-reserve-2" });
    const { runtime } = exactBattle({
      partyMonsters: [first, second],
      configure: (project) => {
        project.system.activeSlots = undefined;
        const troop = project.database.troops.find((record) => record.id === "troop_pkmn_grass_a")!;
        troop.activeSlots = undefined;
      },
    });

    expect(runtime.snapshot().actors).toHaveLength(1);
    expect(runtime.snapshot().reserveActors).toHaveLength(1);
  });

  it("keeps non-link Gen1 enemy PP unlimited instead of forcing Struggle", () => {
    const { runtime } = exactBattle({
      partyMonster: monster({ skillPp: { skill_scarloxy_quick: 2 } }),
      configure: (project) => {
        project.database.skills.find((record) => record.id === "skill_scarloxy_quick")!.power = 1;
        project.database.skills.find((record) => record.id === "skill_scarloxy_scratch")!.maxPp = 1;
      },
      rng: sequence([
        BYTE_255, BYTE_255, 0,
        BYTE_255, BYTE_255, 0,
        BYTE_255, BYTE_255, 0,
        BYTE_255, BYTE_255, 0,
      ]),
    });

    runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
    runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
    const snapshot = runtime.snapshot();

    expect(snapshot.enemies[0]?.skillPp).toBeUndefined();
    expect(snapshot.timeline.filter((entry) => entry.side === "enemy" && entry.skillName === "할퀴기")).toHaveLength(2);
    expect(snapshot.timeline.some((entry) => entry.side === "enemy" && entry.skillName === "Struggle")).toBe(false);
  });

  it("blocks an Electric status move against a Ground target before its effect roll", () => {
    const { runtime } = exactBattle({
      rng: sequence([0]),
      configure: (project) => {
        const quick = project.database.skills.find((record) => record.id === "skill_scarloxy_quick")!;
        quick.power = 0;
        quick.elementId = "electric";
        quick.effect = { kind: "support" };
        quick.stateEffects = [{ stateId: "state_paralysis", chance: 100, operation: "add" }];
        const targetSpecies = project.database.monsterSpecies?.find((record) => record.id === scarloxySpeciesId("larvea"))!;
        targetSpecies.types = ["ground"];
      },
    });

    runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });

    expect(runtime.snapshot().enemies[0]?.stateIds).not.toContain("state_paralysis");
  });

  it("lets a burn-capable Fire move defrost a frozen target without burning it", () => {
    const { runtime } = exactBattle({
      partyMonster: monster({ stateIds: ["state_freeze"] }),
      rng: sequence([BYTE_255, BYTE_255, 0]),
      configure: (project) => {
        const scratch = project.database.skills.find((record) => record.id === "skill_scarloxy_scratch")!;
        scratch.power = 1;
        scratch.elementId = "fire";
        scratch.stateEffects = [{ stateId: "state_burn", chance: 10, operation: "add" }];
      },
    });

    runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
    const actor = runtime.snapshot().actors[0]!;

    expect(actor.stateIds).not.toContain("state_freeze");
    expect(actor.stateIds).not.toContain("state_burn");
  });

  it("rejects a second major status through the live skill-effect path", () => {
    const { runtime } = exactBattle({
      partyMonster: monster({ stateIds: ["state_poison"] }),
      rng: sequence([
        BYTE_255, BYTE_255, 0,
        BYTE_255, BYTE_255, 0, 0,
      ]),
      configure: (project) => {
        const scratch = project.database.skills.find((record) => record.id === "skill_scarloxy_scratch")!;
        scratch.stateEffects = [{ stateId: "state_burn", chance: 100, operation: "add" }];
      },
    });

    runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });

    expect(runtime.snapshot().actors[0]?.stateIds).toEqual(["state_poison"]);
  });

  it("clamps a captured monster's persisted HP to its species maximum", () => {
    const project = createScarloxyPokemonDemoProject();
    const session = startSession(project, 123);
    const given = giveMonster(project, session, {
      speciesId: scarloxySpeciesId("larvea"),
      level: 3,
      currentHp: 40,
    });

    expect(given.ok).toBe(true);
    if (!given.ok) return;
    expect(given.instance.currentHp).toBe(monsterMaxHp(project, given.instance));
  });

  it("writes non-monster Gen1 actor PP back to the session and restores it in the next battle", () => {
    const project = createScarloxyPokemonDemoProject();
    const session = startSession(project, 44);
    const actorId = project.system.startActorIds[0]!;
    const party = {
      levels: session.actorLevels,
      experience: session.actorExperience,
      partyActorIds: [actorId],
      skillPp: session.actorSkillPp,
    };
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_pkmn_grass_a",
      canEscape: true,
      canLose: true,
      battleFlow: "strict",
      party,
      rng: sequence([BYTE_255, BYTE_255, 0, BYTE_255, BYTE_255, 0]),
    });

    runtime.performActorCommand({ kind: "skill", skillId: "skill_attack", targetEnemyId: "enemy-1" });
    const snapshot = runtime.snapshot();
    const remaining = snapshot.actors[0]?.skillPp?.skill_attack;
    applyBattleRewardsToSession(session, {
      result: "escape",
      rewards: snapshot.rewards,
      actors: [...snapshot.actors, ...snapshot.reserveActors],
    }, project);

    expect(remaining).toBe(34);
    expect(session.actorSkillPp?.[actorId]?.skill_attack).toBe(34);
    const restored = createBattleRuntime({
      project,
      troopId: "troop_pkmn_grass_a",
      canEscape: true,
      canLose: true,
      battleFlow: "strict",
      party: { ...party, skillPp: session.actorSkillPp },
    });
    expect(restored.snapshot().actors[0]?.skillPp?.skill_attack).toBe(34);
  });
});
