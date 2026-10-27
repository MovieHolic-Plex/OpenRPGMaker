import { describe, expect, it } from "vitest";
import { nextLivingBattler } from "@/battle/battleTargetResolver";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import type { Project } from "@/project/types";
import battleFixture from "./fixtures/projects/battle-v3.json";

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
