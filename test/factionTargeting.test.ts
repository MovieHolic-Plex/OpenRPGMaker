import { describe, expect, it } from "vitest";
import { resolveHostileTarget, resolveNpcDamage, type FactionCombatantRef } from "@/battle/action/factionTargeting";
import { PLAYER_FACTION_ID, resolveFactionTable } from "@/project/factions";
import type { ProjectFactions } from "@/project/types";

const WAR: ProjectFactions = {
  defs: [
    { id: "bandit", name: "산적" },
    { id: "guard", name: "경비병" },
    { id: "monk", name: "수도승", aggression: 0 },
    { id: "berserk", name: "광전사", aggression: 3 },
  ],
  relations: [
    { a: "bandit", b: "guard", stance: -1 },
    { a: "bandit", b: PLAYER_FACTION_ID, stance: -1 },
  ],
};

const table = resolveFactionTable(WAR);

function ref(id: string, factionId: string, x: number, y: number): FactionCombatantRef {
  return { id, factionId, x, y };
}

describe("resolveHostileTarget", () => {
  it("picks the nearest hostile and ignores neutral bystanders", () => {
    const self = ref("bandit_1", "bandit", 5, 5);
    const target = resolveHostileTarget({
      self,
      candidates: [self, ref("monk_1", "monk", 5, 6), ref("guard_1", "guard", 5, 8), ref("guard_2", "guard", 5, 7)],
      table,
      aggroRange: 8,
    });
    expect(target?.id).toBe("guard_2");
  });

  it("is independent of candidate order and breaks distance ties by lowest id", () => {
    const self = ref("bandit_1", "bandit", 5, 5);
    const a = ref("guard_b", "guard", 5, 7);
    const b = ref("guard_a", "guard", 5, 3);
    const forward = resolveHostileTarget({ self, candidates: [self, a, b], table, aggroRange: 8 });
    const reversed = resolveHostileTarget({ self, candidates: [b, a, self], table, aggroRange: 8 });
    expect(forward?.id).toBe("guard_a");
    expect(reversed?.id).toBe("guard_a");
  });

  it("returns null outside aggro range", () => {
    const self = ref("bandit_1", "bandit", 0, 0);
    const candidates = [self, ref("guard_1", "guard", 0, 9)];
    expect(resolveHostileTarget({ self, candidates, table, aggroRange: 8 })).toBeNull();
    expect(resolveHostileTarget({ self, candidates, table, aggroRange: 9 })?.id).toBe("guard_1");
  });

  it("never targets its own faction and never targets itself", () => {
    const self = ref("bandit_1", "bandit", 5, 5);
    const target = resolveHostileTarget({
      self,
      candidates: [self, ref("bandit_2", "bandit", 5, 4), ref("bandit_3", "bandit", 5, 6)],
      table,
      aggroRange: 8,
    });
    expect(target).toBeNull();
  });

  it("honours aggression: unaggressive never picks a target, frenzied picks allies too", () => {
    const monk = ref("monk_1", "monk", 5, 5);
    const berserk = ref("berserk_1", "berserk", 5, 5);
    const nearby = [ref("bandit_1", "bandit", 5, 6), ref("berserk_2", "berserk", 5, 7)];
    expect(resolveHostileTarget({ self: monk, candidates: [monk, ...nearby], table, aggroRange: 8 })).toBeNull();
    expect(resolveHostileTarget({ self: berserk, candidates: [berserk, ...nearby], table, aggroRange: 8 })?.id).toBe("bandit_1");
    expect(resolveHostileTarget({
      self: berserk,
      candidates: [berserk, ref("berserk_2", "berserk", 5, 6)],
      table,
      aggroRange: 8,
    })?.id).toBe("berserk_2");
  });

  it("keeps the retaliation latch target even when stance and range say otherwise", () => {
    const monk = ref("monk_1", "monk", 0, 0);
    const attacker = ref("guard_1", "guard", 0, 20);
    const target = resolveHostileTarget({
      self: monk,
      candidates: [monk, attacker],
      table,
      aggroRange: 3,
      forcedTargetId: "guard_1",
    });
    expect(target?.id).toBe("guard_1");
  });

  it("falls back to a normal scan when the latched target is gone", () => {
    const self = ref("bandit_1", "bandit", 5, 5);
    const target = resolveHostileTarget({
      self,
      candidates: [self, ref("guard_1", "guard", 5, 6)],
      table,
      aggroRange: 8,
      forcedTargetId: "guard_dead",
    });
    expect(target?.id).toBe("guard_1");
  });

  it("ignores a latch that points at itself", () => {
    const self = ref("bandit_1", "bandit", 5, 5);
    const target = resolveHostileTarget({
      self,
      candidates: [self, ref("guard_1", "guard", 5, 6)],
      table,
      aggroRange: 8,
      forcedTargetId: "bandit_1",
    });
    expect(target?.id).toBe("guard_1");
  });
});

describe("resolveNpcDamage", () => {
  it("subtracts and reports death", () => {
    expect(resolveNpcDamage({ hp: 30, damage: 12, protectedFromNpcs: false })).toEqual({ hp: 18, died: false, savedByProtection: false });
    expect(resolveNpcDamage({ hp: 10, damage: 10, protectedFromNpcs: false })).toEqual({ hp: 0, died: true, savedByProtection: false });
    expect(resolveNpcDamage({ hp: 10, damage: 999, protectedFromNpcs: false })).toEqual({ hp: 0, died: true, savedByProtection: false });
  });

  it("floors a protected faction at 1 hp instead of killing it", () => {
    expect(resolveNpcDamage({ hp: 4, damage: 999, protectedFromNpcs: true })).toEqual({ hp: 1, died: false, savedByProtection: true });
    expect(resolveNpcDamage({ hp: 1, damage: 1, protectedFromNpcs: true })).toEqual({ hp: 1, died: false, savedByProtection: true });
  });

  it("does not resurrect an already dead combatant", () => {
    expect(resolveNpcDamage({ hp: 0, damage: 5, protectedFromNpcs: true })).toEqual({ hp: 0, died: false, savedByProtection: false });
  });

  it("treats zero and fractional damage without drift", () => {
    expect(resolveNpcDamage({ hp: 20, damage: 0, protectedFromNpcs: false }).hp).toBe(20);
    expect(resolveNpcDamage({ hp: 20, damage: 2.6, protectedFromNpcs: false }).hp).toBe(17);
  });
});

describe("skirmish determinism", () => {
  it("produces an identical target sequence regardless of roster iteration order", () => {
    const roster = [
      ref("bandit_1", "bandit", 2, 2),
      ref("bandit_2", "bandit", 9, 9),
      ref("guard_1", "guard", 3, 3),
      ref("guard_2", "guard", 8, 8),
      ref("__player__", PLAYER_FACTION_ID, 5, 5),
    ];

    function run(order: readonly FactionCombatantRef[]): string[] {
      const positions = order.map((entry) => ({ ...entry }));
      const log: string[] = [];
      for (let tick = 0; tick < 40; tick += 1) {
        for (const self of positions) {
          const target = resolveHostileTarget({ self, candidates: positions, table, aggroRange: 8 });
          log.push(`${self.id}>${target?.id ?? "-"}`);
          if (!target) continue;
          // 결정론 검증용 최소 이동: 목표 쪽으로 한 칸. 실제 경로 탐색은 chaseAi 가 담당한다.
          const stepX = Math.sign(target.x - self.x);
          const stepY = Math.sign(target.y - self.y);
          if (Math.max(Math.abs(target.x - self.x), Math.abs(target.y - self.y)) > 1) {
            self.x += stepX;
            self.y += stepY;
          }
        }
      }
      return log;
    }

    const forward = run(roster);
    const shuffled = run([roster[4]!, roster[2]!, roster[0]!, roster[3]!, roster[1]!]);
    expect(shuffled.length).toBe(forward.length);
    expect(new Set(shuffled)).toEqual(new Set(forward));
    expect(run(roster)).toEqual(forward);
  });
});
