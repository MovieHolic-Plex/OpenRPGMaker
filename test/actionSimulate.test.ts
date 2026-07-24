import { describe, expect, it } from "vitest";
import { simulateActionCombat } from "@/action/simulate";

describe("simulateActionCombat", () => {
  const strongPlayer = { maxHp: 200, attack: 40, swingCooldownMs: 350 };

  it("strong player kills a weak slime quickly with few strikes taken", () => {
    const result = simulateActionCombat(strongPlayer, { maxHp: 18, defense: 2, contactDamage: 2 }, 42);
    expect(result.winner).toBe("player");
    expect(result.playerSwings).toBeLessThanOrEqual(2);
    expect(result.playerHpLeft).toBeGreaterThan(0);
  });

  it("overwhelming enemy wins", () => {
    const result = simulateActionCombat(
      { maxHp: 30, attack: 3, swingCooldownMs: 800 },
      { maxHp: 500, defense: 50, contactDamage: 20 },
      7
    );
    expect(result.winner).toBe("enemy");
  });

  it("windup/recover windows let the player trade favorably", () => {
    const durablePlayer = { maxHp: 100000, attack: 10, swingCooldownMs: 350 };
    const withPattern = simulateActionCombat(
      durablePlayer,
      { maxHp: 200, defense: 2, contactDamage: 10, attack: { kind: "melee", windupMs: 2000, recoverMs: 2000, damage: 10, range: 1, cooldownMs: 3000 } },
      5
    );
    const noPattern = simulateActionCombat(durablePlayer, { maxHp: 200, defense: 2, contactDamage: 10 }, 5);
    expect(withPattern.winner).toBe("player");
    expect(withPattern.enemyStrikes).toBeGreaterThan(0);
    expect(withPattern.enemyStrikes).toBeLessThan(noPattern.enemyStrikes);
  });

  it("is deterministic for the same seed", () => {
    const a = simulateActionCombat(strongPlayer, { maxHp: 60, defense: 5, contactDamage: 5 }, 99);
    const b = simulateActionCombat(strongPlayer, { maxHp: 60, defense: 5, contactDamage: 5 }, 99);
    expect(a).toEqual(b);
  });

  it("never exceeds the time cap", () => {
    const result = simulateActionCombat(
      { maxHp: 999999, attack: 1, swingCooldownMs: 1000 },
      { maxHp: 999999, defense: 9999, contactDamage: 0 },
      1
    );
    expect(result.winner).toBe("timeout");
    expect(result.durationMs).toBeLessThanOrEqual(120_000);
  });
});
