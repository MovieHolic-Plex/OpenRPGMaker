import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";

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
});
