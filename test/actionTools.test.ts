import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";

function authoredEnemyFixture() {
  const context: ToolContext = { project: createBlankProject() };
  const enemy = context.project.database.enemies[0];
  if (!enemy) throw new Error("enemy fixture missing");
  enemy.actionProfile = {
    contactDamage: 9,
    moveIntervalMs: 730,
    aggroRange: 4,
    knockbackResist: 0.3,
    attack: {
      kind: "projectile",
      windupMs: 620,
      recoverMs: 430,
      damage: 17,
      range: 9,
      cooldownMs: 1700,
      projectileSpeedTilesPerSec: 8,
    },
  };
  enemy.rewards = { ...enemy.rewards, exp: 23, gold: 19 };
  return { context, enemy };
}

describe("action combat AI tools", () => {
  it("set_action_combat writes system config and map opt-in", () => {
    const context: ToolContext = { project: createBlankProject() };
    const mapId = context.project.startMapId;

    const result = runTool(context, "set_action_combat", { enabled: true, mapId, stamina: true, enemyHpBars: "always" });
    expect(result.ok, result.summary).toBe(true);
    expect(context.project.system.actionCombat?.enabled).toBe(true);
    expect(context.project.system.actionCombat?.hud?.stamina).toBe(true);
    expect(context.project.system.actionCombat?.hud?.enemyHpBars).toBe("always");
    expect(context.project.maps[mapId]?.actionCombat).toBe(true);

    const off = runTool(context, "set_action_combat", { enabled: false, mapId });
    expect(off.ok).toBe(true);
    expect(context.project.system.actionCombat?.enabled).toBe(false);
    expect(context.project.maps[mapId]?.actionCombat).toBe(false);
  });

  it("set_action_combat rejects unknown maps", () => {
    const context: ToolContext = { project: createBlankProject() };
    expect(runTool(context, "set_action_combat", { enabled: true, mapId: "map_nope" }).ok).toBe(false);
  });

  it("make_action_enemy creates an enemy with a melee profile and spawn", () => {
    const context: ToolContext = { project: createBlankProject() };
    const mapId = context.project.startMapId;
    const troopId = context.project.database.troops[0]?.id;
    if (!troopId) throw new Error("troop missing");

    const created = runTool(context, "make_action_enemy", {
      enemyId: "enemy_test_charger",
      name: "돌진 슬라임",
      monsterResourceId: "generated-enemy-slime-01",
      stats: { maxHp: 40, attack: 12 },
      actionProfile: { contactDamage: 3, attack: { kind: "dash", windupMs: 400, recoverMs: 600, damage: 6, range: 4 } },
    });
    expect(created.ok, created.summary).toBe(true);
    const enemy = context.project.database.enemies.find((entry) => entry.id === "enemy_test_charger");
    expect(enemy?.actionProfile?.attack?.kind).toBe("dash");

    const troopEnemyId = context.project.database.troops[0]?.members?.[0]?.enemyId ?? context.project.database.troops[0]?.enemyIds[0];
    const spawned = runTool(context, "make_action_enemy", {
      enemyId: troopEnemyId,
      actionProfile: { contactDamage: 2 },
      spawn: { mapId, troopId, area: { x: 1, y: 1, w: 4, h: 4 }, maxAlive: 2 },
    });
    expect(spawned.ok, spawned.summary).toBe(true);
    const spawns = context.project.maps[mapId]?.fieldSpawns ?? [];
    expect(spawns.some((spawn) => spawn.troopId === troopId && spawn.chase === true)).toBe(true);
  });

  it("make_action_enemy modifies existing enemy and warns about non-opted map", () => {
    const context: ToolContext = { project: createBlankProject() };
    const existing = context.project.database.enemies[0];
    if (!existing) throw new Error("enemy fixture missing");
    const mapId = context.project.startMapId;
    const troopId = context.project.database.troops[0]?.id;

    const result = runTool(context, "make_action_enemy", {
      enemyId: existing.id,
      actionProfile: { attack: { kind: "projectile", windupMs: 600, recoverMs: 400, damage: 5, range: 8, projectileSpeedTilesPerSec: 7 } },
      spawn: { mapId, troopId, area: { x: 0, y: 0, w: 3, h: 3 } },
    });
    expect(result.ok).toBe(true);
    const updated = context.project.database.enemies.find((entry) => entry.id === existing.id);
    expect(updated?.actionProfile?.attack?.kind).toBe("projectile");
    expect(result.summary).toContain("옵트인이 아닙니다");
  });

  it("make_action_enemy rejects invalid profiles and unknown troops", () => {
    const context: ToolContext = { project: createBlankProject() };
    const mapId = context.project.startMapId;
    expect(runTool(context, "make_action_enemy", { enemyId: "enemy_x", name: "X", actionProfile: {} }).ok).toBe(false);
    expect(
      runTool(context, "make_action_enemy", {
        enemyId: "enemy_x",
        name: "X",
        actionProfile: { contactDamage: 2 },
        spawn: { mapId, troopId: "troop_ghost", area: { x: 0, y: 0, w: 2, h: 2 } },
      }).ok
    ).toBe(false);
  });

  it("preserves authored attacks during partial action profile edits", () => {
    const { context, enemy } = authoredEnemyFixture();
    const before = structuredClone(enemy);

    const result = runTool(context, "make_action_enemy", {
      enemyId: enemy.id,
      actionProfile: { aggroRange: 7 },
    });

    expect(result.ok, result.summary).toBe(true);
    const expected = { ...before, actionProfile: { ...before.actionProfile, aggroRange: 7 } };
    expect(context.project.database.enemies.find((entry) => entry.id === enemy.id)).toEqual(expected);
    const loaded = deserialize(serialize(context.project));
    expect(loaded.database.enemies.find((entry) => entry.id === enemy.id)).toEqual(expected);
  });

  it("replaces a supplied attack without discarding other authored profile fields", () => {
    const { context, enemy } = authoredEnemyFixture();
    const before = structuredClone(enemy);
    const attack = { kind: "dash", windupMs: 400, recoverMs: 300, damage: 21, range: 5 } as const;

    const result = runTool(context, "make_action_enemy", {
      enemyId: enemy.id,
      actionProfile: { attack },
    });

    expect(result.ok, result.summary).toBe(true);
    expect(context.project.database.enemies.find((entry) => entry.id === enemy.id)).toEqual({
      ...before,
      actionProfile: { ...before.actionProfile, attack },
    });
  });

  it.each([
    { name: "quoted attack key", profile: { contactDamage: 8, '"attack"': { kind: "melee" } } },
    { name: "unknown profile key", profile: { contactDamage: 8, aggroRnage: 7 } },
    { name: "unknown attack kind", profile: { contactDamage: 8, attack: { kind: "beam", windupMs: 500, recoverMs: 300, damage: 8, range: 4 } } },
    { name: "missing attack fields", profile: { contactDamage: 8, attack: { kind: "projectile", damage: 8 } } },
    { name: "unknown attack key", profile: { attack: { kind: "projectile", windupMs: 500, recoverMs: 300, damage: 8, range: 4, projectileSpeed: 9 } } },
    { name: "invalid movement value", profile: { contactDamage: 8, moveIntervalMs: "fast" } },
    { name: "non-finite damage", profile: { contactDamage: Number.NaN } },
    { name: "non-object attack", profile: { contactDamage: 8, attack: [] } },
  ])("rejects malformed action profiles without mutation: $name", ({ profile }) => {
    const { context, enemy } = authoredEnemyFixture();
    const before = serialize(context.project);

    const result = runTool(context, "make_action_enemy", {
      enemyId: enemy.id,
      actionProfile: profile,
    });

    expect(result.ok).toBe(false);
    expect(result.issues?.some((issue) => issue.code === "invalid-args")).toBe(true);
    expect(serialize(context.project)).toBe(before);
  });

  it.each(["melee", "projectile", "dash"] as const)("accepts a complete %s attack", (kind) => {
    const { context, enemy } = authoredEnemyFixture();

    const result = runTool(context, "make_action_enemy", {
      enemyId: enemy.id,
      actionProfile: { attack: { kind, windupMs: 500, recoverMs: 300, damage: 8, range: 4 } },
    });

    expect(result.ok, result.summary).toBe(true);
    expect(context.project.database.enemies.find((entry) => entry.id === enemy.id)?.actionProfile?.attack?.kind).toBe(kind);
  });

  it("retains contact-only enemy creation", () => {
    const context: ToolContext = { project: createBlankProject() };

    const result = runTool(context, "make_action_enemy", {
      enemyId: "contact_only_enemy",
      name: "Contact-only enemy",
      monsterResourceId: "generated-enemy-slime-01",
      actionProfile: { contactDamage: 6 },
    });

    expect(result.ok, result.summary).toBe(true);
    expect(context.project.database.enemies.find((entry) => entry.id === "contact_only_enemy")?.actionProfile).toEqual({ contactDamage: 6 });
  });
});
