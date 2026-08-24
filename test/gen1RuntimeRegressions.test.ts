import { describe, expect, it, vi } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { createScarloxyPokemonDemoProject } from "@/project/defaults";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import type { ActorParameterKey } from "@/project/types";

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
    makeWildEnemiesFragile(project);
    setActorParam(project, "attack", 999);
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
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    expect(runtime.snapshot().result).toBeUndefined();
    expect(runtime.snapshot().enemies.map((enemy) => enemy.id)).toEqual(["enemy-2"]);

    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-2" });
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

    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    const snapshot = runtime.snapshot();
    expect(snapshot.result).toBe("victory");
    expect(snapshot.rewards.levelUps).toEqual([]);
    expect(snapshot.rewards.monsterLevelUps).not.toEqual([]);
  });
});
