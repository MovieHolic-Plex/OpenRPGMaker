import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { deserialize } from "@/project/io";
import type { Project } from "@/project/types";
import strictFixture from "./fixtures/projects/battle-strict-v3.json";

function strictProject(): Project {
  return deserialize(JSON.stringify(strictFixture));
}

// SC1 (C1): strict flow must not stack-overflow when every party actor is
// incapacitated (asleep, no auto-recovery) yet alive, while the enemy cannot
// end the battle. The strict resolver must terminate with a valid phase.
describe("SC1 — strict flow termination when all actors incapacitated (C1)", () => {
  it("does not throw RangeError and yields a valid phase when all actors are asleep", () => {
    const project = strictProject();
    project.database.states = [
      {
        id: "state_sleep",
        name: "수면",
        restriction: "행동 불가",
        removalCondition: "피격 또는 전투 종료",
        recoverWhenHitChance: 0,
        recoverNaturallyFromTurn: 9999,
        recoverNaturallyChance: 0,
      },
    ];
    const enemy = project.database.enemies.find((record) => record.id === "enemy_training_slime");
    if (!enemy) throw new Error("missing enemy");
    enemy.stats = { ...enemy.stats, maxHp: 99999, attack: 0, defense: 99999, agility: 1 };
    for (const actor of project.database.actors) {
      actor.parameterCurves.maxHp = Array.from({ length: 99 }, () => 99999);
    }

    let runtime: ReturnType<typeof createBattleRuntime> | undefined;
    let threw: unknown;
    try {
      runtime = createBattleRuntime({
        project,
        troopId: "troop_strict_training",
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        party: {
          levels: { actor_warrior: 1, actor_mage: 1 },
          experience: {},
          stateIds: { actor_warrior: ["state_sleep"], actor_mage: ["state_sleep"] },
          partyActorIds: ["actor_warrior", "actor_mage"],
        },
        rng: () => 0,
      });
    } catch (error) {
      threw = error;
    }
    expect(threw).toBeUndefined();
    expect(runtime).toBeDefined();
    const snapshot = runtime!.snapshot();
    expect(["charging", "actorCommand", "roundResolve", "resolved"]).toContain(snapshot.phase);
    // Battle must not be stuck silently in roundResolve forever; with no actors able
    // to act and enemy attack 0, the round cap forces a terminal state (resolved) or
    // a stable non-roundResolve phase. The key invariant: it terminates.
    expect(snapshot.phase).not.toBe("roundResolve");
  });
});
