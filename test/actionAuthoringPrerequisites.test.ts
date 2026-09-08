import { describe, expect, it } from "vitest";
import { ACTION_TOOLS } from "@/editor/tools/actionTools";
import { runTool } from "@/editor/tools/toolRunner";
import { toOpenAiTools } from "@/editor/tools/toolRegistry";
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

function seededFixture() {
  const state = fixture();
  const result = runTool(state.ctx, "make_action_enemy", state.args);
  expect(result.ok, result.summary).toBe(true);
  return state;
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

  it.each([
    { mode: "update", id: "missing_spawn", code: "spawn-not-found" },
    { mode: "update", id: undefined, code: "invalid-args" },
    { mode: "update", id: " ", code: "invalid-args" },
    { mode: "add", id: "arena_spawn", code: "spawn-already-exists" },
    { mode: "udpate", id: "arena_spawn", code: "invalid-args" },
  ])("rejects explicit $mode with target $id before any mutation", ({ mode, id, code }) => {
    const { ctx, args } = seededFixture();
    const before = structuredClone(ctx.project);
    const input = {
      ...args,
      actionProfile: { contactDamage: 11 },
      spawnMode: mode,
      spawn: { ...args.spawn, id },
    };

    const result = runTool(ctx, "make_action_enemy", input);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
    expect(ctx.project).toEqual(before);
    const tool = ACTION_TOOLS.find((entry) => entry.name === "make_action_enemy");
    if (!tool) throw new Error("Missing action tool");
    expect(() => tool.run(ctx.project, input)).toThrowError(expect.objectContaining({ code }));
    expect(ctx.project).toEqual(before);
  });

  it("rejects a spawn mode without a spawn before changing the enemy", () => {
    const { ctx, args } = seededFixture();
    const before = structuredClone(ctx.project);
    const input = { enemyId: args.enemyId, actionProfile: { contactDamage: 11 }, spawnMode: "update" };

    const result = runTool(ctx, "make_action_enemy", input);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "invalid-args" })]));
    expect(ctx.project).toEqual(before);
    const tool = ACTION_TOOLS.find((entry) => entry.name === "make_action_enemy");
    if (!tool) throw new Error("Missing action tool");
    expect(() => tool.run(ctx.project, input)).toThrowError(expect.objectContaining({ code: "invalid-args" }));
    expect(ctx.project).toEqual(before);
  });

  it("does not update a spawn identity that only exists on another map", () => {
    const { ctx, args } = seededFixture();
    const map = ctx.project.maps[args.spawn.mapId];
    if (!map) throw new Error("Missing map");
    ctx.project.maps.other_map = { ...structuredClone(map), id: "other_map" };
    ctx.project.mapTree.children.push({ mapId: "other_map", children: [] });
    map.fieldSpawns = [];
    const before = structuredClone(ctx.project);

    const result = runTool(ctx, "make_action_enemy", { ...args, spawnMode: "update" });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "spawn-not-found" })]));
    expect(ctx.project).toEqual(before);
  });

  it("updates exact spawns and explicitly adds another without losing authored settings", () => {
    const { ctx, args } = seededFixture();
    const map = ctx.project.maps[args.spawn.mapId];
    const spawn = map?.fieldSpawns?.[0];
    if (!map || !spawn) throw new Error("Missing spawn");
    spawn.maxAlive = 3;
    spawn.respawnSec = 600;
    spawn.persistKill = true;
    spawn.chase = false;

    const updated = runTool(ctx, "make_action_enemy", {
      ...args,
      spawnMode: "update",
      spawn: { ...args.spawn, area: { x: "6", y: "5", width: "2", height: "2" } },
    });

    expect(updated.ok, updated.summary).toBe(true);
    expect(updated.data).toMatchObject({ mapId: map.id, spawnId: "arena_spawn", spawnOutcome: "modified" });
    expect(ctx.project.maps[map.id]?.fieldSpawns).toEqual([
      { ...spawn, area: { x: 6, y: 5, w: 2, h: 2 } },
    ]);

    const added = runTool(ctx, "make_action_enemy", {
      ...args,
      spawnMode: "add",
      spawn: { ...args.spawn, id: "intentional_second_spawn" },
    });
    expect(added.ok, added.summary).toBe(true);
    expect(added.data).toMatchObject({ mapId: map.id, spawnId: "intentional_second_spawn", spawnOutcome: "added" });
    expect(ctx.project.maps[map.id]?.fieldSpawns?.map((entry) => entry.id)).toEqual(["arena_spawn", "intentional_second_spawn"]);
  });

  it("removes only the exact authored spawn and preserves enemies and other entries", () => {
    const { ctx, args } = seededFixture();
    expect(runTool(ctx, "make_action_enemy", { ...args, spawn: { ...args.spawn, id: "keep_spawn" } }).ok).toBe(true);
    const before = structuredClone(ctx.project);
    const map = before.maps[args.spawn.mapId];
    if (!map) throw new Error("Missing map");

    const result = runTool(ctx, "remove_field_spawn", { mapId: map.id, spawnId: "arena_spawn" });

    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toEqual({ mapId: map.id, spawnId: "arena_spawn" });
    expect(ctx.project).toEqual({
      ...before,
      maps: { ...before.maps, [map.id]: { ...map, fieldSpawns: map.fieldSpawns?.filter((entry) => entry.id !== "arena_spawn") } },
    });
  });

  it.each([
    { referenced: false, spawnId: "missing_spawn", code: "spawn-not-found" },
    { referenced: true, spawnId: "arena_spawn", code: "spawn-in-use" },
  ])("rejects removal of $spawnId with referenced=$referenced without mutation", ({ referenced, spawnId, code }) => {
    const { ctx, args } = seededFixture();
    const map = ctx.project.maps[args.spawn.mapId];
    if (!map) throw new Error("Missing map");
    if (referenced) map.roguelikeRoom = { encounterSlots: [{ id: "slot", choices: [{ fieldSpawnId: "arena_spawn" }] }] };
    const before = structuredClone(ctx.project);
    const input = { mapId: map.id, spawnId };

    const result = runTool(ctx, "remove_field_spawn", input);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
    expect(ctx.project).toEqual(before);
    const tool = ACTION_TOOLS.find((entry) => entry.name === "remove_field_spawn");
    if (!tool) throw new Error("Missing removal tool");
    expect(() => tool.run(ctx.project, input)).toThrowError(expect.objectContaining({ code }));
    expect(ctx.project).toEqual(before);
  });

  it("exposes explicit spawn intent and targeted removal in model-facing schemas", () => {
    const schemas = toOpenAiTools();

    const make = schemas.find((entry) => entry.function.name === "make_action_enemy");
    const remove = schemas.find((entry) => entry.function.name === "remove_field_spawn");

    expect(make?.function.parameters.properties?.spawnMode?.enum).toEqual(["add", "update"]);
    expect(remove?.function.parameters.required).toEqual(["mapId", "spawnId", "reason"]);
  });
});
