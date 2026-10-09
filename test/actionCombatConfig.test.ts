import { describe, expect, it } from "vitest";
import {
  isActionCombatMap,
  normalizeActionCombatConfig,
  normalizeActionSkillProfile,
  normalizeActionWeaponProfile,
  normalizeEnemyActionAttack,
  normalizeEnemyActionProfile,
  resolveActionCombatConfig,
} from "@/project/actionCombat";
import { createBlankProject } from "@/project/defaults";
import type { GameMap } from "@/project/types";

function mapWith(flags: Partial<GameMap>): GameMap {
  return { actionCombat: undefined, ...flags } as unknown as GameMap;
}

describe("normalizeActionCombatConfig", () => {
  it("returns undefined for absent config", () => {
    expect(normalizeActionCombatConfig(undefined)).toBeUndefined();
  });

  it("preserves explicit fields and clamps numbers", () => {
    const normalized = normalizeActionCombatConfig({
      enabled: true,
      playerIframesMs: 999999,
      swingCooldownMs: 1,
      hud: { stamina: true, enemyHpBars: "always" },
    });
    expect(normalized?.enabled).toBe(true);
    expect(normalized?.playerIframesMs).toBe(10000);
    expect(normalized?.swingCooldownMs).toBe(50);
    expect(normalized?.hud?.stamina).toBe(true);
    expect(normalized?.hud?.enemyHpBars).toBe("always");
  });

  it("drops invalid hud enum values", () => {
    const normalized = normalizeActionCombatConfig({ enabled: true, hud: { enemyHpBars: "bogus" as never } });
    expect(normalized?.hud).toBeUndefined();
  });
});

describe("normalizeActionWeaponProfile / normalizeActionSkillProfile", () => {
  it("normalizes weapon swing overrides", () => {
    expect(normalizeActionWeaponProfile({ swingRange: 2, swingCooldownMs: 200, swingDamageBonus: 3 })).toEqual({ swingRange: 2, swingCooldownMs: 200, swingDamageBonus: 3 });
    expect(normalizeActionWeaponProfile({ swingRange: 99 })).toEqual({ swingRange: 5 });
    expect(normalizeActionWeaponProfile({})).toBeUndefined();
  });

  it("normalizes action skills (projectile only)", () => {
    const skill = normalizeActionSkillProfile({ kind: "projectile", damage: 8, range: 8, speedTilesPerSec: 7 });
    expect(skill).toEqual({ kind: "projectile", damage: 8, range: 8, speedTilesPerSec: 7 });
    expect(normalizeActionSkillProfile({ kind: "beam" as never, damage: 1, range: 1 })).toBeUndefined();
  });
});

describe("normalizeEnemyActionAttack", () => {
  it("preserves a valid melee attack and clamps fields", () => {
    const attack = normalizeEnemyActionAttack({ kind: "melee", windupMs: 10, recoverMs: 600, damage: 6, range: 1, cooldownMs: 1500 });
    expect(attack?.kind).toBe("melee");
    expect(attack?.windupMs).toBe(100);
    expect(attack?.cooldownMs).toBe(1500);
  });

  it("rejects unknown kinds", () => {
    expect(normalizeEnemyActionAttack({ kind: "laser" as never, windupMs: 300, recoverMs: 300, damage: 1, range: 1 })).toBeUndefined();
  });

  it("nests inside action profiles", () => {
    const profile = normalizeEnemyActionProfile({
      contactDamage: 3,
      attack: { kind: "projectile", windupMs: 600, recoverMs: 500, damage: 4, range: 8, projectileSpeedTilesPerSec: 99 },
    });
    expect(profile?.attack?.kind).toBe("projectile");
    expect(profile?.attack?.projectileSpeedTilesPerSec).toBe(30);
  });
});

describe("normalizeEnemyActionProfile", () => {
  it("returns undefined when empty", () => {
    expect(normalizeEnemyActionProfile({})).toBeUndefined();
    expect(normalizeEnemyActionProfile(undefined)).toBeUndefined();
  });

  it("clamps knockbackResist into 0..1", () => {
    expect(normalizeEnemyActionProfile({ knockbackResist: 7 })?.knockbackResist).toBe(1);
  });
});

describe("isActionCombatMap / resolveActionCombatConfig", () => {
  it("requires both system enabled and map opt-in", () => {
    const project = createBlankProject();
    const map = mapWith({ actionCombat: true });
    expect(isActionCombatMap(project, map)).toBe(false);
    project.system.actionCombat = { enabled: true };
    expect(isActionCombatMap(project, map)).toBe(true);
    expect(isActionCombatMap(project, mapWith({}))).toBe(false);
  });

  it("resolves defaults when fields are omitted", () => {
    const project = createBlankProject();
    project.system.actionCombat = { enabled: true };
    const config = resolveActionCombatConfig(project);
    expect(config.playerIframesMs).toBe(800);
    expect(config.swingCooldownMs).toBe(350);
    expect(config.hearts).toBe(true);
    expect(config.stamina).toBe(false);
    expect(config.enemyHpBars).toBe("damaged");
  });
});
