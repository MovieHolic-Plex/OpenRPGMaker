import { describe, expect, it } from "vitest";
import { ACTION_TOOLS } from "@/editor/tools/actionTools";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { resolveActionCombatConfig } from "@/project/actionCombat";

function fixture() {
  const ctx: ToolContext = { project: createBlankProject() };
  const enemy = ctx.project.database.enemies[0];
  const troop = ctx.project.database.troops[0];
  if (!enemy || !troop) throw new Error("Missing battle fixture");
  troop.enemyIds = [enemy.id];
  troop.members = [{ enemyId: enemy.id, x: 0, y: 0 }];
  const args = {
    enemyId: enemy.id,
    actionProfile: { contactDamage: 3 },
    spawn: { id: "arena_spawn", mapId: ctx.project.startMapId, troopId: troop.id, area: { x: 1, y: 1, w: 3, h: 3 } },
  };
  return { ctx, args };
}

describe("action authoring prerequisites", () => {
  it("updates an explicitly identified spawn on retry but appends when no id is supplied", () => {
    const { ctx, args } = fixture();
    expect(runTool(ctx, "make_action_enemy", args).ok).toBe(true);

    const retry = runTool(ctx, "make_action_enemy", { ...args, spawn: { ...args.spawn, maxAlive: 3 } });

    expect(retry.ok, retry.summary).toBe(true);
    const spawns = ctx.project.maps[args.spawn.mapId]?.fieldSpawns ?? [];
    expect(spawns).toHaveLength(1);
    expect(spawns[0]).toMatchObject({ id: "arena_spawn", maxAlive: 3 });
    const { id, ...appendSpawn } = args.spawn;
    for (let index = 0; index < 2; index += 1) {
      expect(runTool(ctx, "make_action_enemy", { ...args, spawn: appendSpawn }).ok).toBe(true);
    }
    expect(ctx.project.maps[args.spawn.mapId]?.fieldSpawns).toHaveLength(3);
    expect(new Set(ctx.project.maps[args.spawn.mapId]?.fieldSpawns?.map((spawn) => spawn.id)).size).toBe(3);
  });

  it("persists existing dodge and guard knobs through the runtime resolver", () => {
    const { ctx } = fixture();
    const knobs = { dodgeStaminaCost: 12, dodgeIframesMs: 240, guardDamageReductionPercent: 60, guardStaminaDrainPerSec: 8 };

    const result = runTool(ctx, "set_action_combat", { enabled: true, mapId: ctx.project.startMapId, ...knobs });

    expect(result.ok, result.summary).toBe(true);
    expect(resolveActionCombatConfig(ctx.project)).toMatchObject(knobs);
  });

  it.each(["troop", "resource", "map", "membership", "area"] as const)(
    "leaves the supplied draft untouched when the %s prerequisite fails",
    (failure) => {
      const { ctx, args } = fixture();
      const before = structuredClone(ctx.project);
      const tool = ACTION_TOOLS.find((entry) => entry.name === "make_action_enemy");
      if (!tool) throw new Error("Missing action tool");
      const input = {
        ...args,
        ...(failure === "resource" ? { monsterResourceId: "missing-monster-resource" } : {}),
        spawn: {
          ...args.spawn,
          ...(failure === "troop" ? { troopId: "missing-troop" } : {}),
          ...(failure === "map" ? { mapId: "missing-map" } : {}),
          ...(failure === "area" ? { area: { x: -1, y: 0, w: 1, h: 1 } } : {}),
        },
      };
      if (failure === "membership") {
        const troop = ctx.project.database.troops[0];
        if (!troop) throw new Error("Missing troop");
        troop.enemyIds = [];
        troop.members = [];
        before.database.troops = structuredClone(ctx.project.database.troops);
      }

      expect(() => tool.run(ctx.project, input)).toThrow();

      expect(ctx.project).toEqual(before);
    },
  );

  it("does not enable the system when the selected map does not exist", () => {
    const { ctx } = fixture();
    const before = structuredClone(ctx.project);
    const tool = ACTION_TOOLS.find((entry) => entry.name === "set_action_combat");
    if (!tool) throw new Error("Missing action tool");
    expect(() => tool.run(ctx.project, { enabled: true, mapId: "missing" })).toThrow();
    expect(ctx.project).toEqual(before);
  });

  it("authors enemy then troop then spawn through the real tool runner", () => {
    const { ctx } = fixture();
    const enemyArgs = {
      enemyId: "arena_enemy", name: "Arena enemy", monsterResourceId: "generated-enemy-slime-01",
      actionProfile: { contactDamage: 2 },
    };
    for (const [name, args] of [
      ["make_action_enemy", enemyArgs],
      ["upsert_troop", { troop: { id: "arena_troop", name: "Arena troop", enemyIds: ["arena_enemy"] } }],
      ["make_action_enemy", { ...enemyArgs, spawn: { id: "arena_spawn", mapId: ctx.project.startMapId, troopId: "arena_troop", area: { x: 1, y: 1, w: 2, h: 2 } } }],
    ] as const) {
      const result = runTool(ctx, name, args);
      expect(result.ok, result.summary).toBe(true);
    }
    expect(ctx.project.maps[ctx.project.startMapId]?.fieldSpawns?.[0]?.troopId).toBe("arena_troop");
  });
});
