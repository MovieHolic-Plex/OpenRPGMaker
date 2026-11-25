import { describe, expect, it } from "vitest";
import { simulateActionCombat } from "@/battle/action/simulate";
import { computeContactDamage, computeSwingDamage } from "@/battle/action/combatMath";
import { isolateTimers } from "./mergedTeardown";

describe("actionSimulate", () => {
  isolateTimers();
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
      // 스윙 간격(3000ms)이 선딜(2000ms)보다 길어야 예고된 타격이 틈을 뚫는다 —
      // 그보다 촘촘하면 매 스윙이 선딜을 경직으로 끊어 버린다(stagger 규칙).
      const durablePlayer = { maxHp: 100000, attack: 10, swingCooldownMs: 3000 };
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
});

describe("actionSimulateSharedRules", () => {
  isolateTimers();
  // simulate.ts 가 씬과 같은 순수 규칙 모듈(combatMath, stagger, dodge, guard)을
  // 실제로 소비하는지 증명한다. 규칙 모듈이 소유한 입력을 바꾸면 시뮬레이터
  // 결과가 반드시 따라 움직여야 한다 — 그렇지 않으면 시뮬레이터가 규칙을
  // 자기 자신만의 복제로 다시 구현하고 있다는 뜻이다.

  function lcg(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0xffffffff;
    };
  }
  describe("simulateActionCombat shares runtime rule modules", () => {
    it("per-swing damage equals computeSwingDamage for the same inputs and seed", () => {
      const player = { maxHp: 100, attack: 40, swingCooldownMs: 350 };
      const enemy = { maxHp: 20, defense: 7, contactDamage: 0 };
      const result = simulateActionCombat(player, enemy, 123);
      // 첫 스윙(첫 rand 소비)이 즉시 마무리한다 — 남은 체력 = maxHp - computeSwingDamage.
      const expected = computeSwingDamage({
        attackerAttack: player.attack,
        defenderDefense: enemy.defense,
        bonus: 0,
        rand: lcg(123),
      });
      expect(result.winner).toBe("player");
      expect(result.enemyHpLeft).toBe(Math.max(0, enemy.maxHp - expected));
    });

    it("enemy defense is owned by combatMath — changing it changes the result", () => {
      const player = { maxHp: 100, attack: 30, swingCooldownMs: 350 };
      const base = { maxHp: 400, contactDamage: 0 };
      const low = simulateActionCombat(player, { ...base, defense: 2 }, 11);
      const high = simulateActionCombat(player, { ...base, defense: 20 }, 11);
      expect(low.winner).toBe("player");
      expect(high.winner).toBe("player");
      // 같은 시드·같은 스윙 횟수 흐름에서 방어만 오르면 마무리가 늦어진다.
      expect(high.durationMs).toBeGreaterThan(low.durationMs);
    });

    it("windup duration is owned by the attack profile — changing it changes the result", () => {
      const player = { maxHp: 100000, attack: 10, swingCooldownMs: 1000 };
      const base = { maxHp: 200, defense: 2, contactDamage: 10 };
      const fast = simulateActionCombat(
        player,
        { ...base, attack: { kind: "melee", windupMs: 200, recoverMs: 2000, damage: 10, range: 1, cooldownMs: 3000 } },
        5
      );
      const slow = simulateActionCombat(
        player,
        { ...base, attack: { kind: "melee", windupMs: 2000, recoverMs: 2000, damage: 10, range: 1, cooldownMs: 3000 } },
        5
      );
      // 느린 선딜은 플레이어 타격에 자주 끊기므로(스태거) 타격 횟수가 줄어든다.
      expect(fast.enemyStrikes).toBeGreaterThan(slow.enemyStrikes);
    });

    it("contact damage is owned by computeContactDamage — the pulse amount matches the module", () => {
      // 접촉 펄스 하나로 쓰러지게 만들어 펄스 양을 정확히 관측한다.
      const maxHp = 999;
      const player = { maxHp, attack: 1, swingCooldownMs: 99999, stamina: 0 };
      const enemy = { maxHp: 999999, defense: 9999, contactDamage: 999 };
      const result = simulateActionCombat(player, enemy, 3);
      const expectedPulse = computeContactDamage({ contactDamage: 999, enemyAttack: 0, defenderDefense: 0 });
      expect(result.enemyStrikes).toBe(1);
      expect(result.winner).toBe("enemy");
      expect(result.playerHpLeft).toBe(Math.max(0, maxHp - expectedPulse));
    });

    it("dodge/guard stamina economy is shared — reduction and stamina change the outcome", () => {
      const player = { maxHp: 3000, attack: 5, swingCooldownMs: 99999, guardReductionPercent: 0, guardDrainPerSec: 1 };
      const enemy = { maxHp: 999999, defense: 9999, contactDamage: 10 };
      const noGuard = simulateActionCombat(player, enemy, 3);
      const withGuard = simulateActionCombat({ ...player, guardReductionPercent: 90 }, enemy, 3);
      expect(noGuard.playerHpLeft).toBeLessThan(withGuard.playerHpLeft);
    });
  });
});
