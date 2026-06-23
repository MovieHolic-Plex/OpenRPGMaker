import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import battleFixture from "./fixtures/projects/battle-v3.json";
import missingTroopFixture from "./fixtures/projects/battle-missing-troop-v3.json";

function battleProject() {
  return deserialize(JSON.stringify(battleFixture));
}

describe("side-view battle runtime", () => {
  it("fills active-time gauges in actor-before-enemy order", () => {
    // Given: a database-backed battle with one party actor and one troop enemy.
    const runtime = createBattleRuntime({
      project: battleProject(),
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
    });

    // When: enough deterministic time passes for the first battler to act.
    runtime.tick(1_000);

    // Then: the actor command phase opens before the enemy can act.
    expect(runtime.snapshot().phase).toBe("actorCommand");
    expect(runtime.snapshot().activeActorId).toBe("actor_hero");
    expect(runtime.snapshot().actors[0]?.gauge).toBe(100);
    expect(runtime.snapshot().enemies[0]?.gauge).toBeLessThan(100);
  });

  it("applies attack damage from actor commands", () => {
    // Given: the hero has an active command turn against the first enemy.
    const runtime = createBattleRuntime({
      project: battleProject(),
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
    });
    runtime.tick(1_000);
    const before = runtime.snapshot().enemies[0]?.hp;

    // When: the actor uses the Attack command.
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

    // Then: the targeted enemy loses HP. The weak slime(10 HP) falls to one
    // attack from the database-driven hero curve, resolving as victory.
    const after = runtime.snapshot().enemies[0]?.hp;
    expect(after).toBeLessThan(before ?? 0);
    expect(after).toBe(0);
    expect(runtime.snapshot().result).toBe("victory");
  });

  it("records skill animation and defeats an enemy into victory", () => {
    // Given: a weak troop enemy and a hero skill with a battle animation.
    const runtime = createBattleRuntime({
      project: battleProject(),
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
    });
    runtime.tick(1_000);

    // When: the actor uses the database skill.
    runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });

    // Then: the animation is exposed and the battle resolves as victory.
    expect(runtime.snapshot().lastAnimation?.animationId).toBe("anim_fire");
    expect(runtime.snapshot().enemies[0]?.defeated).toBe(true);
    expect(runtime.snapshot().result).toBe("victory");
    expect(runtime.snapshot().rewards.exp).toBeGreaterThanOrEqual(0);
  });

  it("supports item skill use and simple troop event state triggers", () => {
    // Given: the troop has a battle event page that applies a simple state.
    const runtime = createBattleRuntime({
      project: battleProject(),
      troopId: "troop_slime",
      canEscape: true,
      canLose: true,
    });
    runtime.tick(1_000);

    // When: the actor uses an item backed by a skill.
    runtime.performActorCommand({ kind: "item", itemId: "item_bomb", targetEnemyId: "enemy-1" });

    // Then: the item consumes inventory semantics and the troop page applies the state.
    expect(runtime.snapshot().lastAnimation?.animationId).toBe("anim_fire");
    expect(runtime.snapshot().enemies[0]?.stateIds).toContain("state_burn");
  });

  it("returns defeat when all actors fall and losing is allowed", () => {
    // Given: an enemy can act against the only party actor.
    const runtime = createBattleRuntime({
      project: battleProject(),
      troopId: "troop_dragon",
      canEscape: false,
      canLose: true,
    });

    // When: the enemy receives its active turn.
    runtime.tick(1_500);

    // Then: party defeat is surfaced for event branch handoff.
    expect(runtime.snapshot().actors[0]?.defeated).toBe(true);
    expect(runtime.snapshot().result).toBe("defeat");
  });

  it("rejects missing troop references during project validation", () => {
    // Given: a v3 project whose battleProcessing command references a missing troop.
    const raw = JSON.stringify(missingTroopFixture);

    // When / Then: deserialization blocks the invalid battle start path.
    expect(() => deserialize(raw)).toThrow(/battleProcessing: troopId/);
  });
});
