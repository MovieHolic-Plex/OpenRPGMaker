import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { parseM2BattleCommand } from "@/battle/battleM2Commands";
import { deserialize } from "@/project/io";
import { battleTroopError } from "@/project/battleAdmission";
import { validateLowLevelCommandArray } from "@/editor/tools/commandArgs";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { applyBattleTimerWrites, updateRuntimeTimers } from "@/player/playSceneTimers";
import { startSession } from "@/project/session";
import type { Command } from "@/project/types";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import fixture from "./fixtures/projects/battle-v3.json";

type M2 = Extract<Command, { kind: "m2Command" }>;
const hpCommand = (target: string): M2 => ({
  kind: "m2Command", commandId: "m2-098-change-enemy-hp",
  fields: { target, operation: "set", value: 0 },
});

function eventBattle(commands: Command[]) {
  const project = deserialize(JSON.stringify(fixture));
  const troop = project.database.troops.find((record) => record.id === "troop_slime")!;
  troop.battleEventPages = [{
    id: "review", name: "Review", span: "battle", conditions: [], commands,
  }];
  const runtime = createBattleRuntime({
    project, troopId: troop.id, canEscape: true, canLose: true, battleFlow: "gauge", rng: () => 0.5,
  });
  runtime.tick(1_000);
  runtime.performActorCommand({ kind: "defend" });
  return { project, runtime };
}

describe("battle review integrity boundaries", () => {
  it("resolves simultaneous troop-event knockouts as defeat without rewards", () => {
    const { runtime } = eventBattle([
      hpCommand("all"),
      { kind: "changeActorHp", actorId: "party", op: "=", amount: 0 },
    ]);
    const snapshot = runtime.snapshot();
    expect(snapshot.actors.every((actor) => actor.hp === 0)).toBe(true);
    expect(snapshot.enemies.every((enemy) => enemy.hp === 0)).toBe(true);
    expect(snapshot.result).toBe("defeat");
    expect(snapshot.rewards).toMatchObject({ exp: 0, gold: 0, items: [] });
    runtime.cancel();
  });

  it.each(["enemy-99", "deleted_enemy", ""])("does not redirect unknown enemy target %s", (target) => {
    const { runtime } = eventBattle([hpCommand(target)]);
    const snapshot = runtime.snapshot();
    expect(snapshot.enemies[0].hp).toBe(snapshot.enemies[0].maxHp);
    expect(snapshot.result).toBeUndefined();
    expect(snapshot.eventLogs.some((entry) => entry.kind === "unsupported")).toBe(true);
    runtime.cancel();
  });

  it.each(["enemy-1", "enemy_slime", "all"])("still applies explicit enemy target %s", (target) => {
    const { runtime } = eventBattle([hpCommand(target)]);
    expect(runtime.snapshot().enemies[0].hp).toBe(0);
    expect(runtime.snapshot().result).toBe("victory");
    runtime.cancel();
  });

  it.each([undefined, null, [], "invalid"])("rejects malformed M2 fields %s at authoring and runtime boundaries", (fields) => {
    const command = { ...hpCommand("all"), fields } as unknown as M2;
    expect(() => validateCommandArray("commands", [command])).toThrow(/fields/);
    expect(() => validateLowLevelCommandArray("commands", [command])).toThrow(/fields/);
    expect(parseM2BattleCommand(command)).toBeUndefined();
    // Nested tool branches must not bypass the same shape contract.
    expect(() => validateLowLevelCommandArray("commands", [{ kind: "loop", body: [command] }])).toThrow(/fields/);
  });

  it("uses catalog validation instead of a shadowing shallow M2 case", () => {
    expect(() => validateCommandArray("commands", [{ ...hpCommand("all"), commandId: "missing-command" }]))
      .toThrow(/commandId/);
    const command = { ...hpCommand("all"), fields: { target: { nested: true } } } as unknown as M2;
    expect(() => validateCommandArray("commands", [command])).toThrow(/fields.target/);
  });

  it("reports dangling hidden members through admission before constructing battlers", () => {
    const project = deserialize(JSON.stringify(fixture));
    const troop = project.database.troops.find((record) => record.id === "troop_slime")!;
    troop.members = [{ enemyId: "deleted_enemy", x: 100, y: 100, hidden: true }];
    // Members take precedence over a still-valid legacy projection.
    expect(battleTroopError(project, troop.id)).toMatchObject({ code: "BATTLE_ENEMY_MISSING" });
    expect(() => createBattleRuntime({ project, troopId: troop.id, canEscape: true, canLose: true }))
      .toThrow(/deleted_enemy/);
    delete troop.members;
    expect(battleTroopError(project, troop.id)).toBeUndefined();
    troop.enemyIds = ["deleted_enemy"];
    expect(battleTroopError(project, troop.id)?.code).toBe("BATTLE_ENEMY_MISSING");
  });

  it.each(["rich", "legacy", "party"])("addresses actual actors for %s m2-092 targets", (mode) => {
    const project = deserialize(JSON.stringify(fixture));
    const session = startSession(project);
    const actorId = session.partyActorIds[0];
    const commandId = "m2-092-change-battle-commands";
    const entry = m2CommandById(commandId)!;
    const fields = mode === "rich" ? { target: "actor", actorId }
      : { target: mode === "party" ? "party" : actorId };
    executeM2RuntimeCommand(session, entry, {
      commandId, fields: { ...fields, operation: "set", value: "defend" },
    }, { project });
    expect(session.actorBattleCommands?.[actorId]).toEqual(["defend"]);
    expect(session.actorBattleCommands?.actor).toBeUndefined();
  });

  it.each(["set", "start", "stop"] as const)("commits timer %s to the live timer owner and preserves untouched countdowns", (action) => {
    const { project, runtime } = eventBattle([
      { kind: "timer", action: "set", timerId: "timer1", seconds: 8 },
      { kind: "timer", action, timerId: "timer1", ...(action === "set" ? { seconds: 6 } : {}) },
    ]);
    const state = runtime.snapshot().eventState;
    const session = startSession(project);
    const runtimeTimers = new Map([
      ["timer1", { remaining: 100, active: true }],
      ["timer2", { remaining: 3.5, active: true }],
    ]);
    const scene = { session, runtimeTimers } as PlaySceneContext;
    applyBattleTimerWrites(scene, state);
    expect(runtimeTimers.get("timer1")).toEqual({ remaining: action === "set" ? 6 : 8, active: action === "start" });
    expect(runtimeTimers.get("timer2")).toEqual({ remaining: 3.5, active: true });
    updateRuntimeTimers(scene, 1_000);
    expect(session.timers.timer1).toBe(action === "start" ? 7 : action === "set" ? 6 : 8);
    expect(runtimeTimers.get("timer2")?.remaining).toBe(2.5);
    runtime.cancel();
  });
});
