import { describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { chooseAutoBattleCommand } from "@/battle/battleAuto";
import { resolveGen1DamagingMove } from "@/battle/gen1/damage";
import { gen1CaptureProbability } from "@/battle/gen1/capture";
import { gen1TypeModifiersForTypes } from "@/battle/typeChart";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import { giveMonster, monsterMaxHp } from "@/project/monsterCollection";
import { startSession, evalCondition } from "@/project/session";
import type { MonsterInstance, ActorParameterKey, Condition, GameEvent, Project } from "@/project/types";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { badgeContext, currentObedienceCap, defaultObedienceCaps, earnedBadgeCount, linearObedienceCaps, obedienceLevelCapFor, obedienceRefusalLine } from "@/project/badgeProgress";
import { partySkillContext } from "@/project/partySkills";
import { deserialize, serialize } from "@/project/io";
import { validateMonsterCampaign } from "@/project/io/shapeMonsterCampaign";
import { resolveEventPage } from "@/project/io/pageResolution";
import type { MonsterCampaignConfig } from "@/project/types/database";
import { normalizeSkillRecord, normalizeStateRecord } from "@/project/databaseRecordModel";
import { applyStatStage, compactStatStages, shiftStatStage, statStageMessage, statStageMultiplier } from "@/battle/statStages";
import { applyGen1MajorStatus, applyGen1PostActionResidual, gen1ConfusionSelfDamage, gen1ConfusionTurns, gen1MajorStatusBlockedByType, gen1NextToxicCounter, readGen1MajorStatus, stepGen1Confusion } from "@/battle/gen1/status";
import { isolateTimers } from "./mergedTeardown";

describe("gen1RuntimeExactIntegration", () => {
  isolateTimers();
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

    it("still applies poison residual after defend, a failed escape, or a potion", () => {
      const poisoned = monster({ currentHp: 1, stateIds: ["state_poison"] });
      const defend = exactBattle({ partyMonster: poisoned, rng: sequence([BYTE_255]) });
      defend.runtime.performActorCommand({ kind: "defend" });
      const defended = defend.runtime.snapshot();
      expect(defended.timeline.some((entry) => entry.kind === "stateUpkeep" && entry.side === "actor" && entry.amount === 4)).toBe(true);
      expect(defended.actors[0]?.hp).toBe(0);
      expect(defended.result).toBe("defeat");

      const escaped = exactBattle({ partyMonster: poisoned, rng: sequence([BYTE_255]) });
      escaped.runtime.performActorCommand({ kind: "escape" });
      const failedEscape = escaped.runtime.snapshot();
      expect(failedEscape.timeline.some((entry) => entry.kind === "action" && entry.commandKind === "escape" && entry.success === false)).toBe(true);
      expect(failedEscape.timeline.some((entry) => entry.kind === "stateUpkeep" && entry.side === "actor" && entry.amount === 4)).toBe(true);
      expect(failedEscape.result).toBe("defeat");

      const fled = exactBattle({ partyMonster: poisoned, rng: sequence([0]) });
      fled.runtime.performActorCommand({ kind: "escape" });
      const fledSnapshot = fled.runtime.snapshot();
      expect(fledSnapshot.result).toBe("escape");
      expect(fledSnapshot.actors[0]?.hp).toBe(1);
      expect(fledSnapshot.timeline.some((entry) => entry.kind === "stateUpkeep")).toBe(false);

      const healed = exactBattle({
        partyMonster: poisoned,
        inventory: { item_potion: 1 },
        rng: sequence([BYTE_255]),
      });
      const before = healed.runtime.snapshot().actors[0]!;
      healed.runtime.performActorCommand({
        kind: "item",
        itemId: "item_potion",
        targetEnemyId: "enemy-1",
        targetActorId: before.id,
      });
      const after = healed.runtime.snapshot();
      const healing = after.timeline.find((entry) => entry.kind === "healing" && entry.side === "actor");
      const healedHp = Math.min(before.maxHp, before.hp + (healing?.amount ?? 0));
      expect(healing?.amount).toBeGreaterThan(0);
      expect(after.timeline.some((entry) => entry.kind === "stateUpkeep" && entry.side === "actor" && entry.amount === 4)).toBe(true);
      expect(after.actors[0]?.hp).toBeGreaterThan(0);
      expect(after.actors[0]?.hp).toBeLessThan(healedHp);
      expect(after.eventState.inventory.item_potion ?? 0).toBe(0);
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
});

describe("gen1RuntimeRegressions", () => {
  isolateTimers();
  function setActorParam(project: ReturnType<typeof createScarloxyPokemonDemoProject>, key: ActorParameterKey, value: number): void {
    const actor = project.database.actors.find((record) => record.id === project.system.startActorIds[0]);
    if (!actor) throw new Error("missing start actor");
    actor.parameterCurves[key] = Array.from({ length: 99 }, () => value);
  }
  function makeWildEnemiesFragile(project: ReturnType<typeof createScarloxyPokemonDemoProject>): void {
    for (const enemy of project.database.enemies.filter((record) => record.id.startsWith("enemy_pkmn_"))) {
      enemy.stats = { ...enemy.stats, maxHp: 1, defense: 1, agility: 1, attack: 1 };
    }
  }
  describe("Gen1 runtime regressions", () => {
    it("blocks trainer-battle capture before consuming the ball or capture RNG", () => {
      const project = createScarloxyPokemonDemoProject();
      const troop = project.database.troops.find((record) => record.id === "troop_pkmn_grass_a");
      if (!troop) throw new Error("missing grass troop");
      troop.trainerBattle = true;
      troop.uncapturable = false;
      const rng = vi.fn(() => 0);
      const runtime = createBattleRuntime({
        project,
        troopId: troop.id,
        canEscape: true,
        canLose: true,
        battleFlow: "gauge",
        sessionState: { switches: {}, variables: {}, inventory: { item_capture_orb: 2 } },
        rng,
      });

      runtime.tick(10_000);
      rng.mockClear();
      runtime.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });

      const snapshot = runtime.snapshot();
      expect(snapshot.lastCaptureResult).toMatchObject({ success: false, blockedReason: "trainerBattle" });
      expect(snapshot.eventState.inventory.item_capture_orb).toBe(2);
      expect(rng).not.toHaveBeenCalled();
    });

    it("fields multi-member wild troops one enemy at a time", () => {
      const project = createScarloxyPokemonDemoProject();
      const troop = project.database.troops.find((record) => record.id === "troop_pkmn_grass_b");
      if (!troop?.members[0]) throw new Error("missing grass troop member");
      troop.members.push({ ...troop.members[0], x: troop.members[0].x + 32 });
      makeWildEnemiesFragile(project);
      // Staying at or below 255 avoids Gen1's paired quarter-scaling producing
      // a zero defense divisor against this intentionally 1-DEF fixture.
      setActorParam(project, "attack", 200);
      setActorParam(project, "agility", 999);
      const actorId = project.system.startActorIds[0]!;
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_pkmn_grass_b",
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        party: { levels: { [actorId]: 50 }, experience: {}, partyActorIds: [actorId] },
        rng: () => 0,
      });

      expect(runtime.snapshot().enemies.map((enemy) => enemy.id)).toEqual(["enemy-1"]);
      runtime.performActorCommand({ kind: "skill", skillId: "skill_attack", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().result).toBeUndefined();
      expect(runtime.snapshot().enemies.map((enemy) => enemy.id)).toEqual(["enemy-2"]);

      runtime.performActorCommand({ kind: "skill", skillId: "skill_attack", targetEnemyId: "enemy-2" });
      expect(runtime.snapshot().result).toBe("victory");
    });

    it("does not emit actor level-up previews for a monster-party victory", () => {
      const project = createScarloxyPokemonDemoProject();
      makeWildEnemiesFragile(project);
      const defeatedEnemy = project.database.enemies.find((record) => record.id === "enemy_pkmn_larvea");
      if (!defeatedEnemy) throw new Error("missing reward enemy");
      defeatedEnemy.rewards = { ...defeatedEnemy.rewards, exp: 999_999 };
      const actorId = project.system.startActorIds[0]!;
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_pkmn_grass_a",
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        party: { levels: { [actorId]: 1 }, experience: {}, partyActorIds: [actorId] },
        partyMonsters: [{
          instanceId: "monster-starter",
          speciesId: scarloxySpeciesId("sparchu"),
          level: 50,
          exp: 0,
          skillIds: ["skill_scarloxy_quick"],
          friendship: 70,
          caughtAt: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
        }],
        rng: () => 0,
      });

      runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
      const snapshot = runtime.snapshot();
      expect(snapshot.result).toBe("victory");
      expect(snapshot.rewards.levelUps).toEqual([]);
      expect(snapshot.rewards.monsterLevelUps).not.toEqual([]);
    });

    it("does not preview level-ups for reserve monsters that never participated", () => {
      const project = createScarloxyPokemonDemoProject();
      makeWildEnemiesFragile(project);
      const defeatedEnemy = project.database.enemies.find((record) => record.id === "enemy_pkmn_larvea");
      if (!defeatedEnemy) throw new Error("missing reward enemy");
      defeatedEnemy.rewards = { ...defeatedEnemy.rewards, exp: 999_999 };
      const caughtAt = { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y };
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_pkmn_grass_a",
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        activeSlots: 1,
        partyMonsters: [
          {
            instanceId: "monster-active",
            speciesId: scarloxySpeciesId("sparchu"),
            level: 1,
            exp: 0,
            skillIds: ["skill_scarloxy_quick"],
            friendship: 70,
            caughtAt,
          },
          {
            instanceId: "monster-reserve",
            speciesId: scarloxySpeciesId("larvea"),
            level: 1,
            exp: 0,
            skillIds: ["skill_scarloxy_quick"],
            friendship: 70,
            caughtAt,
          },
        ],
        rng: () => 0,
      });

      runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });

      expect(runtime.snapshot().rewards.monsterLevelUps.map((preview) => preview.instanceId)).toEqual(["monster-active"]);
    });

    it("keeps full live-monster-party previews when regular actors fought", () => {
      const project = createScarloxyPokemonDemoProject();
      project.system.battleParty = undefined;
      project.system.monsterBattleParty = false;
      project.system.battleModel = "rm2k3";
      makeWildEnemiesFragile(project);
      const defeatedEnemy = project.database.enemies.find((record) => record.id === "enemy_pkmn_larvea");
      if (!defeatedEnemy) throw new Error("missing reward enemy");
      defeatedEnemy.rewards = { ...defeatedEnemy.rewards, exp: 999_999 };
      setActorParam(project, "attack", 999);
      const actorId = project.system.startActorIds[0]!;
      const caughtAt = { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y };
      const partyMonsters = ["monster-companion-a", "monster-companion-b"].map((instanceId) => ({
        instanceId,
        speciesId: scarloxySpeciesId("sparchu"),
        level: 1,
        exp: 0,
        skillIds: ["skill_scarloxy_quick"],
        friendship: 70,
        caughtAt,
      }));
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_pkmn_grass_a",
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        party: { levels: { [actorId]: 50 }, experience: {}, partyActorIds: [actorId] },
        partyMonsters,
        rng: () => 0,
      });

      expect(runtime.snapshot().actors.map((actor) => actor.recordId)).toEqual([actorId]);
      expect(runtime.snapshot().phase).toBe("actorCommand");
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

      const snapshot = runtime.snapshot();
      expect(snapshot.result).toBe("victory");
      expect(snapshot.rewards.exp).toBeGreaterThan(0);
      expect(snapshot.rewards.monsterLevelUps.map((preview) => preview.instanceId)).toEqual([
        "monster-companion-a",
        "monster-companion-b",
      ]);
    });
  });
});

// 배지 수 조건(badgeCount)·배지 게이트 도구·원작식 복종 레벨 상한(2026-10-16). 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
describe("monsterBadgeGating", () => {
  isolateTimers();
  const CAMPAIGN: MonsterCampaignConfig = {
    id: "c", name: "원정", speciesIds: [], speciesNotes: {}, locations: [], objectives: [],
    badges: [1, 2, 3].map((n) => ({ id: `badge_${n}`, name: `배지${n}`, switchId: `mx_badge_${n}`, cityMapId: "map" })),
  };
  /**
   * CAMPAIGN's badges point at a placeholder city map ("map"); load validation (io/references.ts) and
   * configure_monster_campaign require each badge's city map and switch to exist in the project.
   */
  function campaignIn(project: Project): MonsterCampaignConfig {
    const campaign = structuredClone(CAMPAIGN);
    for (const badge of campaign.badges) {
      badge.cityMapId = project.startMapId;
      if (!project.switches.some((entry) => entry.id === badge.switchId)) project.switches.push({ id: badge.switchId, name: badge.name });
    }
    return campaign;
  }
  const session = (switches: Record<string, boolean>) => ({ switches, variables: {}, partyActorIds: [], flags: {}, actorVitals: {}, x: 0, y: 0, currentMapId: "m" });
  describe("badgeCount 조건", () => {
    const atLeast = (value: number): Condition => ({ kind: "badgeCount", op: ">=", value });

    it("캠페인 정의가 있으면 그 배지 스위치가 켜진 개수를 센다(다른 스위치는 세지 않는다)", () => {
      const ctx = { partySkillIds: undefined, badgeSwitchIds: () => CAMPAIGN.badges.map((b) => b.switchId) };
      expect(evalCondition(session({ mx_badge_1: true, mx_badge_2: true, sw_other: true }), atLeast(2), undefined, ctx)).toBe(true);
      expect(evalCondition(session({ mx_badge_1: true, sw_other: true }), atLeast(2), undefined, ctx)).toBe(false);
    });

    it("정의가 없으면 mx_badge_N 규약 스위치를 센다", () => {
      expect(evalCondition(session({ mx_badge_1: true, mx_badge_2: true }), atLeast(2))).toBe(true);
      expect(evalCondition(session({ mx_badge_1: true, mx_story: true }), atLeast(2))).toBe(false);
      expect(evalCondition(session({}), { kind: "badgeCount", op: "==", value: 0 })).toBe(true);
    });

    it("페이지 해석기가 같은 결과를 낸다(partySkillContext 가 캠페인 배지 목록을 싣는다)", () => {
      const project = createScarloxyPokemonDemoProject();
      project.system.monsterCampaign = structuredClone(CAMPAIGN);
      const event = { id: "ev", x: 0, y: 0, trigger: { kind: "action" }, commands: [], pages: [
        { id: "closed", name: "닫힘", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] },
        { id: "open", name: "열림", conditions: [atLeast(3)], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] },
      ] } as unknown as GameEvent;
      const at = (n: number) => {
        const switches = Object.fromEntries(CAMPAIGN.badges.slice(0, n).map((b) => [b.switchId, true]));
        const s = session(switches) as never;
        return resolveEventPage(event, s, partySkillContext(project, s))?.id;
      };
      expect(at(2)).toBe("closed");
      expect(at(3)).toBe("open");
      expect(badgeContext(project).badgeSwitchIds?.()).toEqual(["mx_badge_1", "mx_badge_2", "mx_badge_3"]);
    });

    it("earnedBadgeCount 는 스위치가 없거나 목록이 비어도 0", () => {
      expect(earnedBadgeCount(undefined)).toBe(0);
      expect(earnedBadgeCount({ mx_badge_1: true }, [])).toBe(0);
      expect(earnedBadgeCount({ a: true, b: false, c: true }, ["a", "b", "c", "a"])).toBe(2);
    });
  });
  describe("복종 레벨 상한 — 규칙", () => {
    const rule = { enabled: true, caps: [{ badges: 0, maxLevel: 20 }, { badges: 2, maxLevel: 30 }, { badges: 5, maxLevel: 50 }] };

    it("배지 수 이하인 마지막 항목이 상한이고, 모자라면 첫 항목", () => {
      expect([0, 1, 2, 4, 5, 8].map((n) => obedienceLevelCapFor(rule, n))).toEqual([20, 20, 30, 30, 50, 50]);
      expect(obedienceLevelCapFor({ enabled: true, caps: [{ badges: 3, maxLevel: 40 }] }, 0)).toBe(40);
    });

    it("꺼짐·없음·빈 caps 는 제한 없음(undefined)", () => {
      expect(obedienceLevelCapFor(undefined, 3)).toBeUndefined();
      expect(obedienceLevelCapFor({ ...rule, enabled: false }, 3)).toBeUndefined();
      expect(obedienceLevelCapFor({ enabled: true, caps: [] }, 3)).toBeUndefined();
    });

    it("프로젝트·세션 스위치로 현재 상한을 읽는다", () => {
      const project = { system: { monsterCampaign: { ...structuredClone(CAMPAIGN), obedienceLevelCaps: rule } } } as unknown as Project;
      expect(currentObedienceCap(project, { mx_badge_1: true, mx_badge_2: true })).toBe(30);
      expect(currentObedienceCap({ system: { monsterCampaign: structuredClone(CAMPAIGN) } } as unknown as Project, { mx_badge_1: true })).toBeUndefined();
    });

    it("기본 사다리와 거부 문장", () => {
      expect(defaultObedienceCaps(3)).toEqual([{ badges: 0, maxLevel: 20 }, { badges: 1, maxLevel: 25 }, { badges: 2, maxLevel: 30 }, { badges: 3, maxLevel: 35 }]);
      expect(linearObedienceCaps(1, 10, 3)).toEqual([{ badges: 0, maxLevel: 10 }, { badges: 1, maxLevel: 13 }]);
      expect(obedienceRefusalLine(undefined, "새싹이", 0)).toBe("새싹이는 말을 듣지 않는다!");
      expect(obedienceRefusalLine({ enabled: true, caps: [], refuseLine: "{name}이(가) 고개를 돌렸다." }, "불꽃", 3)).toBe("불꽃이(가) 고개를 돌렸다.");
      const lines = new Set([0, 1, 2, 3].map((turn) => obedienceRefusalLine(undefined, "물결", turn)));
      expect(lines.size).toBe(4);
    });

    it("검증 — 잘못된 caps 는 거부하고 필드 없음은 통과(기본 꺼짐)", () => {
      const base = structuredClone(CAMPAIGN);
      expect(() => validateMonsterCampaign(base)).not.toThrow();
      expect(() => validateMonsterCampaign({ ...base, obedienceLevelCaps: { enabled: true, caps: [{ badges: 0, maxLevel: 20 }] } })).not.toThrow();
      expect(() => validateMonsterCampaign({ ...base, obedienceLevelCaps: { enabled: true, caps: [] } })).toThrow(/caps/);
      expect(() => validateMonsterCampaign({ ...base, obedienceLevelCaps: { enabled: true, caps: [{ badges: 2, maxLevel: 20 }, { badges: 1, maxLevel: 30 }] } })).toThrow(/오름차순/);
      expect(() => validateMonsterCampaign({ ...base, obedienceLevelCaps: { enabled: true, caps: [{ badges: 0, maxLevel: 0 }] } })).toThrow(/maxLevel/);
      expect(() => validateMonsterCampaign({ ...base, obedienceLevelCaps: { enabled: "yes", caps: [] } })).toThrow(/enabled/);
    });

    it("기본값에서는 직렬화에 나타나지 않는다", () => {
      const project = createScarloxyPokemonDemoProject();
      project.system.monsterCampaign = campaignIn(project);
      expect(serialize(project)).not.toContain("obedienceLevelCaps");
      project.system.monsterCampaign.obedienceLevelCaps = { enabled: true, caps: [{ badges: 0, maxLevel: 20 }] };
      expect(deserialize(serialize(project)).system.monsterCampaign?.obedienceLevelCaps).toEqual({ enabled: true, caps: [{ badges: 0, maxLevel: 20 }] });
    });
  });
  describe("복종 레벨 상한 — 전투 런타임", () => {
    const caughtAt = (project: Project) => ({ mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y });
    function start(level: number, rule: MonsterCampaignConfig["obedienceLevelCaps"], switches: Record<string, boolean> = {}) {
      const project = createScarloxyPokemonDemoProject();
      project.system.battleModel = "gen1";
      project.system.monsterCampaign = { ...structuredClone(CAMPAIGN), ...(rule ? { obedienceLevelCaps: rule } : {}) };
      return createBattleRuntime({
        project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, battleFlow: "strict",
        sessionState: { switches, variables: {}, inventory: {} },
        partyMonsters: [{ instanceId: "monster-obey", speciesId: scarloxySpeciesId("sparchu"), level, exp: 0, skillIds: ["skill_scarloxy_quick"], friendship: 70, caughtAt: caughtAt(project) }],
        rng: () => 0,
      });
    }
    const rule = { enabled: true, caps: [{ badges: 0, maxLevel: 20 }, { badges: 1, maxLevel: 40 }] };
    const refusals = (runtime: ReturnType<typeof start>) => runtime.snapshot().timeline.filter((entry) => entry.kind === "special" && /말을 듣지|제멋대로|딴청|지시를 따르지/.test(entry.message ?? ""));

    it("상한을 넘은 몬스터는 기술 명령을 거부하고 상대는 맞지 않는다", () => {
      const runtime = start(30, rule);
      const enemyHpBefore = runtime.snapshot().enemies[0]!.hp;
      runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
      expect(refusals(runtime)).toHaveLength(1);
      expect(runtime.snapshot().enemies[0]!.hp).toBe(enemyHpBefore);
    });

    it("상한 이하이거나 배지가 늘어 상한이 오르면 말을 듣는다", () => {
      for (const runtime of [start(20, rule), start(30, rule, { mx_badge_1: true })]) {
        runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
        expect(refusals(runtime)).toHaveLength(0);
      }
    });

    it("규칙이 없거나 꺼져 있으면 아무것도 바뀌지 않는다", () => {
      for (const runtime of [start(60, undefined), start(60, { ...rule, enabled: false })]) {
        runtime.performActorCommand({ kind: "skill", skillId: "skill_scarloxy_quick", targetEnemyId: "enemy-1" });
        expect(refusals(runtime)).toHaveLength(0);
      }
    });

    it("거부 중에도 아이템·도망은 명령할 수 있다(거부는 기술 명령만)", () => {
      const runtime = start(30, rule);
      runtime.performActorCommand({ kind: "escape" });
      expect(refusals(runtime)).toHaveLength(0);
    });
  });
  describe("도구 — place_badge_gate / configure_monster_campaign {obedienceLevelCaps}", () => {
    const ctxOf = (project: Project): ToolContext => ({ project, currentMapId: project.startMapId, assistantRun: true, monsterTurn: true });
    const prepared = (): Project => {
      const project = createScarloxyPokemonDemoProject();
      project.system.battleModel = "gen1";
      return project;
    };

    it("place_badge_gate: 세 페이지(막힘 → 확인 → 열림)와 badgeCount 조건을 만든다", () => {
      const project = prepared();
      const map = project.maps[project.startMapId]!;
      const spot = { x: Math.min(map.width - 2, project.startPos.x + 2), y: project.startPos.y };
      const ctx = ctxOf(project);
      const result = runTool(ctx, "place_badge_gate", { mapId: map.id, x: spot.x, y: spot.y, badges: 3, name: "문지기" }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      const event = ctx.project.maps[map.id]!.events.find((e) => e.id === (result.data as { eventIds: string[] }).eventIds[0])!;
      expect(event.pages!.map((page) => page.id.replace(/^.*_/, ""))).toEqual(["locked", "check", "open"]);
      expect(event.pages![1]!.conditions).toContainEqual({ kind: "badgeCount", op: ">=", value: 3 });
      expect(event.pages![0]!.priority).toBe("same");
      expect(event.pages![2]!.priority).toBe("below");
    });

    it("place_badge_gate: 캠페인 배지 수보다 큰 N·모르는 칸은 거부한다", () => {
      const project = prepared();
      project.system.monsterCampaign = structuredClone(CAMPAIGN);
      const ctx = ctxOf(project);
      const map = project.maps[project.startMapId]!;
      const tooMany = runTool(ctx, "place_badge_gate", { mapId: map.id, x: 3, y: 3, badges: 4 }, { dryRun: false });
      expect(tooMany.ok).toBe(false);
      const unknown = runTool(ctx, "place_badge_gate", { mapId: map.id, x: 3, y: 3, badges: 2, count: 2 }, { dryRun: false });
      expect(unknown.ok).toBe(false);
    });

    it("configure_monster_campaign: 켜기(caps 생략=기본 사다리)·끄기(필드 제거)", () => {
      const project = prepared();
      project.system.monsterCampaign = campaignIn(project);
      const ctx = ctxOf(project);
      const on = runTool(ctx, "configure_monster_campaign", { obedienceLevelCaps: { enabled: true } }, { dryRun: false });
      expect(on.ok, on.summary).toBe(true);
      expect(ctx.project.system.monsterCampaign!.obedienceLevelCaps).toEqual({ enabled: true, caps: defaultObedienceCaps(3) });
      const custom = runTool(ctx, "configure_monster_campaign", { obedienceLevelCaps: { enabled: true, caps: [{ badges: 0, maxLevel: 12 }, { badges: 3, maxLevel: 50 }], refuseLine: "{name}은 코를 판다." } }, { dryRun: false });
      expect(custom.ok, custom.summary).toBe(true);
      expect(ctx.project.system.monsterCampaign!.obedienceLevelCaps).toMatchObject({ caps: [{ badges: 0, maxLevel: 12 }, { badges: 3, maxLevel: 50 }], refuseLine: "{name}은 코를 판다." });
      const off = runTool(ctx, "configure_monster_campaign", { obedienceLevelCaps: { enabled: false } }, { dryRun: false });
      expect(off.ok, off.summary).toBe(true);
      expect(ctx.project.system.monsterCampaign!.obedienceLevelCaps).toBeUndefined();
    });
  });
});

describe("statStages", () => {
  isolateTimers();
  const skillBase = {
    animationId: "anim_magic",
    description: "x",
    type: "normal" as const,
    mpCost: { flat: 0, percentMax: 0 },
    successRate: 100,
    variance: 0,
    hitRate: 100,
    effect: { kind: "support" as const },
    maxPp: 30,
    power: 0,
  };
  function battle(skills: readonly Record<string, unknown>[], moveIds: readonly string[], model: "gen1" | "rm2k3" = "gen1") {
    const project: any = createScarloxyPokemonDemoProject();
    if (model === "rm2k3") delete project.system.battleModel;
    for (const skill of skills) project.database.skills.push(normalizeSkillRecord({ ...skillBase, ...skill } as any));
    const monster = {
      instanceId: "m1", speciesId: scarloxySpeciesId("sparchu"), level: 50, exp: 0, skillIds: [...moveIds],
      skillPp: Object.fromEntries(moveIds.map((id) => [id, 30])), friendship: 70, caughtAt: { mapId: "map_pkmn_town", x: 1, y: 1 },
    };
    let seed = 7;
    const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return ((seed >>> 8) & 0xffff) / 65536; };
    return createBattleRuntime({
      project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, battleFlow: "strict",
      partyMonsters: [monster], sessionState: { switches: {}, variables: {}, inventory: {} }, rng,
    } as any) as any;
  }
  describe("능력치 단계 배율", () => {
    it("카트리지 표: −6 은 25%, 0 은 그대로, +6 은 400%", () => {
      expect(applyStatStage(100, { attack: -6 }, "attack")).toBe(25);
      expect(applyStatStage(100, { attack: 0 }, "attack")).toBe(100);
      expect(applyStatStage(100, { attack: 6 }, "attack")).toBe(400);
      expect(statStageMultiplier(undefined, "speed")).toBe(1);
    });

    it("한계(±6)에서 멈추고 실제로 바뀐 폭을 돌려준다", () => {
      const up = shiftStatStage({ attack: 5 }, "attack", 3);
      expect(up.stages).toEqual({ attack: 6 });
      expect(up.change).toMatchObject({ before: 5, after: 6, applied: 1, requested: 3 });
      const capped = shiftStatStage({ attack: 6 }, "attack", 1);
      expect(capped.change.applied).toBe(0);
      expect(statStageMessage("스파르츄", capped.change)).toBe("스파르츄의 공격은 더 이상 오르지 않는다!");
      expect(compactStatStages({ attack: 0, speed: 0 })).toBeUndefined();
    });

    it("문장은 변화 폭으로 올랐다/크게 올랐다/대폭 올랐다", () => {
      const line = (delta: number) => statStageMessage("가", shiftStatStage(undefined, "defense", delta).change);
      expect(line(1)).toBe("가의 방어가 올랐다!");
      expect(line(2)).toBe("가의 방어가 크게 올랐다!");
      expect(line(3)).toBe("가의 방어가 대폭 올랐다!");
      expect(line(-1)).toBe("가의 방어가 내려갔다!");
    });
  });
  describe("skill.statStageEffects 정규화", () => {
    it("모르는 stat·0 단계는 버리고 범위를 자른다, 없으면 필드 자체가 없다", () => {
      const plain = normalizeSkillRecord({ ...skillBase, id: "a", name: "a", scope: "enemy" } as any);
      expect("statStageEffects" in plain).toBe(false);
      const record = normalizeSkillRecord({
        ...skillBase, id: "b", name: "b", scope: "enemy",
        statStageEffects: [{ stat: "attack", stages: 9 }, { stat: "bogus", stages: 1 }, { stat: "speed", stages: 0 }, { stat: "evasion", stages: -2, chance: 30, target: "self" }],
      } as any);
      expect(record.statStageEffects).toEqual([{ stat: "attack", stages: 6 }, { stat: "evasion", stages: -2, chance: 30, target: "self" }]);
    });
  });
  describe("전투 런타임의 능력치 단계", () => {
    const growl = { id: "t_growl", name: "울음", scope: "enemy", statStageEffects: [{ stat: "attack", stages: -1 }] };
    const swords = { id: "t_swords", name: "칼춤", scope: "self", statStageEffects: [{ stat: "attack", stages: 2 }] };
    const cast = (rt: any, skillId: string, self = false) => {
      const before = rt.snapshot().timeline.length;
      rt.performActorCommand({ kind: "skill", skillId, targetEnemyId: "enemy-1", ...(self ? { targetActorId: "m1" } : {}) });
      return rt.snapshot().timeline.slice(before);
    };

    for (const model of ["gen1", "rm2k3"] as const) {
      it(`${model}: 칼춤은 시전자에게 +2, 울음은 대상에게 −1 이 걸리고 스냅샷에 실린다`, () => {
        const rt = battle([growl, swords], ["t_growl", "t_swords"], model);
        const own = cast(rt, "t_swords", true);
        expect(own.find((entry: any) => entry.statStage)?.statStage).toMatchObject({ stat: "attack", before: 0, after: 2 });
        expect(rt.snapshot().actors[0].statStages).toEqual({ attack: 2 });
        cast(rt, "t_growl");
        expect(rt.snapshot().enemies[0].statStages).toEqual({ attack: -1 });
      });
    }

    it("gen1: 공격 +2 가 물리 피해를 키운다(단계 없는 같은 전투 대비)", () => {
      const quick = "skill_scarloxy_quick";
      const base = battle([swords], [quick, "t_swords"]);
      const first = cast(base, quick).find((entry: any) => entry.kind === "damage" && entry.side === "actor")?.amount ?? 0;
      const boosted = battle([swords], [quick, "t_swords"]);
      cast(boosted, "t_swords", true);
      const second = cast(boosted, quick).find((entry: any) => entry.kind === "damage" && entry.side === "actor")?.amount ?? 0;
      expect(second).toBeGreaterThan(first);
    });

    it("+6 한계 뒤에는 한 줄 문장만 남기고 단계는 그대로", () => {
      const rt = battle([{ id: "t_harden", name: "단단", scope: "self", statStageEffects: [{ stat: "defense", stages: 6 }] }], ["t_harden"]);
      cast(rt, "t_harden", true);
      const again = cast(rt, "t_harden", true);
      expect(again.find((entry: any) => entry.statStage)?.message).toBe("스파르츄의 방어는 더 이상 오르지 않는다!");
      expect(rt.snapshot().actors[0].statStages).toEqual({ defense: 6 });
    });

    it("단계가 없는 전투의 스냅샷에는 statStages 필드가 없다(저장·표시 바이트 불변)", () => {
      const rt = battle([], ["skill_scarloxy_quick"]);
      expect("statStages" in rt.snapshot().actors[0]).toBe(false);
    });
  });
});

// poke-depth PR2: 맹독(차례마다 커지는 독)·혼란(휘발 상태). 작성만 했고 실행하지 않았다(워크트리 규칙).
describe("statusConditions", () => {
  isolateTimers();
  const records = [
    { id: "state_toxic", gen1MajorStatus: "toxic" as const },
    { id: "state_poison", gen1MajorStatus: "poison" as const },
    { id: "state_confusion", volatileStatus: "confusion" as const },
  ];
  describe("toxic", () => {
    it("counter climbs by one each turn and stops at 15", () => {
      expect(gen1NextToxicCounter(undefined)).toBe(1);
      expect(gen1NextToxicCounter(0)).toBe(1);
      expect(gen1NextToxicCounter(7)).toBe(8);
      expect(gen1NextToxicCounter(15)).toBe(15);
    });
    it("residual damage is 1/16 times the counter, plain poison stays fixed", () => {
      expect(applyGen1PostActionResidual({ kind: "toxic", maxHp: 160, currentHp: 160, toxicCounter: 3 }).damage).toBe(30);
      expect(applyGen1PostActionResidual({ kind: "toxic", maxHp: 160, currentHp: 160 }).damage).toBe(10);
      expect(applyGen1PostActionResidual({ kind: "poison", maxHp: 160, currentHp: 160, toxicCounter: 9 }).damage).toBe(10);
    });
    it("is a major status: blocked by an existing one and by poison/steel types", () => {
      const applied = applyGen1MajorStatus({ stateIds: ["state_poison"], stateTurns: {}, stateRecords: records, incomingStateId: "state_toxic" }, () => 255);
      expect(applied.applied).toBe(false);
      expect(gen1MajorStatusBlockedByType("toxic", "normal", ["poison"], "status")).toBe(true);
      expect(gen1MajorStatusBlockedByType("toxic", "normal", ["steel"], "status")).toBe(true);
      expect(gen1MajorStatusBlockedByType("toxic", "normal", ["normal"], "status")).toBe(false);
    });
  });
  describe("confusion", () => {
    it("lasts 2-5 actions", () => {
      for (let byte = 0; byte < 256; byte++) {
        const turns = gen1ConfusionTurns(() => byte);
        expect(turns).toBeGreaterThanOrEqual(2);
        expect(turns).toBeLessThanOrEqual(5);
      }
    });
    it("snaps out when the counter reaches zero, otherwise half hit themselves", () => {
      expect(stepGen1Confusion(1, () => 0).outcome).toBe("snappedOut");
      expect(stepGen1Confusion(3, () => 10)).toMatchObject({ outcome: "selfHit", turnsLeft: 2 });
      expect(stepGen1Confusion(3, () => 200)).toMatchObject({ outcome: "acts", turnsLeft: 2 });
    });
    it("does not count as a major status", () => {
      expect(readGen1MajorStatus(["state_confusion"], {}, records)).toBeUndefined();
    });
    it("self damage is a typeless power-40 hit and at least 1", () => {
      expect(gen1ConfusionSelfDamage(50, 100, 100)).toBe(Math.floor(Math.floor(22 * 40 * 100 / 100) / 50) + 2);
      expect(gen1ConfusionSelfDamage(1, 1, 999)).toBeGreaterThanOrEqual(1);
    });
  });
  describe("state record normalization", () => {
    it("keeps the new enum fields and leaves records without them byte-identical", () => {
      expect(normalizeStateRecord({ id: "a", name: "a", volatileStatus: "confusion" }).volatileStatus).toBe("confusion");
      expect(normalizeStateRecord({ id: "a", name: "a", gen1MajorStatus: "toxic" }).gen1MajorStatus).toBe("toxic");
      expect("volatileStatus" in normalizeStateRecord({ id: "a", name: "a" })).toBe(false);
      expect("volatileStatus" in normalizeStateRecord({ id: "a", name: "a", volatileStatus: "bogus" as never })).toBe(false);
    });
  });
  describe("gen1 runtime", () => {
    const prng = (seed: number) => { let sd = seed >>> 0; return () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return ((sd >>> 8) & 0xffff) / 65536; }; };
    const SP = scarloxySpeciesId("sparchu");
    function build(seed: number) {
      const project: any = structuredClone(createScarloxyPokemonDemoProject());
      const enemy = project.database.enemies.find((r: any) => r.id === "enemy_pkmn_larvea");
      project.database.monsterSpecies.find((r: any) => r.id === enemy.speciesId).types = ["normal"];
      enemy.stats = { ...enemy.stats, maxHp: 400, attack: 40, defense: 40, mind: 40, agility: 1 };
      enemy.actions = [{ skillId: "skill_scarloxy_scratch", priority: 5, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
      const skill = (id: string, stateId: string, scope: "enemy" | "self" = "enemy") => normalizeSkillRecord({ id, name: id, scope, power: 0, animationId: "anim_magic", description: "x", type: "normal", mpCost: { flat: 0, percentMax: 0 }, successRate: 100, variance: 0, hitRate: 100, effect: { kind: "support" }, maxPp: 30, stateEffects: stateId ? [{ stateId, chance: 100, operation: "add" }] : [] } as any);
      project.database.skills.push(skill("pd_toxic", "state_toxic"), skill("pd_wait", "", "self"));
      const mon = { instanceId: "m1", speciesId: SP, level: 50, exp: 0, skillIds: ["pd_toxic", "pd_wait"], skillPp: { pd_toxic: 30, pd_wait: 30 }, friendship: 70, caughtAt: { mapId: "map_pkmn_town", x: 1, y: 1 } };
      return createBattleRuntime({ project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, battleFlow: "strict", partyMonsters: [mon], sessionState: { switches: {}, variables: {}, inventory: {} }, rng: prng(seed) } as any) as any;
    }
    it("toxic damage grows by 1/16 each turn", () => {
      const rt = build(7);
      const ticks: number[] = [];
      const take = (entries: any[]) => entries.filter((e) => e.kind === "stateUpkeep" && e.side === "enemy").forEach((e) => ticks.push(e.amount));
      const cast = (id: string) => { const n = rt.snapshot().timeline.length; rt.performActorCommand({ kind: "skill", skillId: id, targetEnemyId: "enemy-1", ...(id === "pd_wait" ? { targetActorId: "m1" } : {}) }); return rt.snapshot().timeline.slice(n); };
      take(cast("pd_toxic"));
      for (let i = 0; i < 3; i++) take(cast("pd_wait"));
      const unit = Math.floor(rt.snapshot().enemies[0].maxHp / 16);
      expect(ticks.slice(0, 4)).toEqual([unit, unit * 2, unit * 3, unit * 4]);
    });
  });
});
