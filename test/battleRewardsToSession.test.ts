import { describe, expect, it } from "vitest";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { startSession } from "@/project/session";
import { createBlankProject } from "@/project/defaults";

describe("battle rewards to play session", () => {
  it("adds victory rewards to actor experience, gold, and inventory", () => {
    // Given: a play session with one party actor and no earned battle rewards.
    const project = createBlankProject();
    const session = startSession(project);
    const actorId = session.partyActorIds[0];
    expect(actorId).toBe("actor_hero");
    expect(session.actorExperience[actorId]).toBe(0);
    expect(session.gold).toBe(0);
    expect(session.inventory.item_bomb).toBeUndefined();

    // When: a victorious battle pays out EXP, gold, and an item drop.
    applyBattleRewardsToSession(session, {
      result: "victory",
      rewards: { exp: 28, gold: 5, items: ["item_bomb"] },
    });

    // Then: the actual playable session carries the rewards forward.
    expect(session.actorExperience[actorId]).toBe(28);
    expect(session.gold).toBe(5);
    expect(session.inventory.item_bomb).toBe(1);
  });

  it("does not pay rewards for escape or defeat", () => {
    // Given: a fresh play session.
    const session = startSession(createBlankProject());
    const actorId = session.partyActorIds[0];

    // When: a non-victory result reports rewards in the battle snapshot.
    applyBattleRewardsToSession(session, {
      result: "escape",
      rewards: { exp: 28, gold: 5, items: ["item_bomb"] },
    });

    // Then: no victory reward leaks into the session.
    expect(session.actorExperience[actorId]).toBe(0);
    expect(session.gold).toBe(0);
    expect(session.inventory.item_bomb).toBeUndefined();
  });
});
