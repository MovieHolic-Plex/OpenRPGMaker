import { describe, expect, it } from "vitest";
import { deserialize } from "@/project/io";
import { createBattleRuntime } from "@/battle/runtime";
import { startSession } from "@/project/session";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import type { Command } from "@/project/types";
import fixture from "./fixtures/projects/battle-v3.json";

function run(commands: Command[], canLose = true) {
  const project = deserialize(JSON.stringify(fixture));
  project.database.actors = project.database.actors.map(actor => actor.id === "actor_hero" ? {
    ...actor,
    initialEquipment: {},
    parameterCurves: {
      maxHp: Array.from({ length: 99 }, (_, i) => (i + 1) * 100),
      maxMp: Array(99).fill(40),
      attack: Array.from({ length: 99 }, (_, i) => (i + 1) * 10),
      defense: Array(99).fill(10),
      mind: Array(99).fill(20),
      agility: Array(99).fill(99),
    },
  } : actor);
  const enemy = project.database.enemies.find(entry => entry.id === "enemy_slime");
  const troop = project.database.troops.find(entry => entry.id === "troop_slime");
  if (!enemy || !troop) throw new Error("Missing battle repair fixture records");
  enemy.stats = { ...enemy.stats, maxHp: 5000, maxMp: 40, attack: 1, agility: 1 };
  troop.battleEventPages = [{
    id: "repair", name: "State repair", span: "battle",
    conditions: [{ kind: "actorCommand", actorId: "actor_hero", commandId: "defend" }],
    commands,
  }];
  const session = startSession(project);
  session.friendship = { audit_npc: 37, untouched_npc: 10 };
  session.actorLevels.actor_hero = 7;
  session.actorEquipment.actor_hero = {};
  session.actorVitals.actor_hero = { hp: 300, maxHp: 700, mp: 20, maxMp: 40 };
  const runtime = createBattleRuntime({
    project, troopId: troop.id, canEscape: false, canLose, battleFlow: "gauge",
    rng: () => 0.5, sessionState: session,
    party: {
      partyActorIds: ["actor_hero"], levels: { actor_hero: 7 }, experience: {},
      equipment: session.actorEquipment, vitals: session.actorVitals,
    },
  });
  runtime.tick(1000);
  const before = runtime.snapshot();
  expect(before.phase).toBe("actorCommand");
  runtime.performActorCommand({ kind: "defend" });
  return { project, session, runtime, before, after: runtime.snapshot() };
}

describe("battle event state reaches battlers and the returning session", () => {
  it.each([
    ["escape", true], ["victory", true], ["defeat", true], ["defeat", false],
  ] as const)("preserves friendship for %s with canLose=%s", (outcome, canLose) => {
    // Given: actual result production, not a mocked reward outcome.
    const terminal: Command = outcome === "escape"
      ? { kind: "m2Command", commandId: "m2-107-force-escape", fields: {} }
      : outcome === "defeat"
        ? { kind: "killPlayer" }
        : { kind: "m2Command", commandId: "m2-098-change-enemy-hp",
          fields: { target: "enemy-1", operation: "remove", value: 9999 } };
    const result = run([
      { kind: "changeFriendship", npcKey: "audit_npc", delta: 19 },
      { kind: "getFriendship", npcKey: "audit_npc", variableId: "friendship_read" },
      terminal,
    ], canLose);
    // When: the real battle snapshot is written back through the real bridge.
    expect(result.after.eventState.variables.friendship_read).toBe(56);
    expect(result.session.friendship?.audit_npc).toBe(37);
    expect(result.after.result).toBe(outcome);
    if (!result.after.result) throw new Error("Battle did not resolve");
    applyBattleRewardsToSession(result.session, {
      result: result.after.result, canLose, rewards: result.after.rewards,
      actors: result.after.actors, eventState: result.after.eventState,
    }, result.project);
    // Then: a nonreturning defeat alone does not commit play state.
    expect(result.session.friendship?.audit_npc).toBe(outcome === "defeat" && !canLose ? 37 : 56);
  });

  it("updates current battler level and derived stats without healing or changing equipment", () => {
    const result = run([{ kind: "changeLevel", actorId: "actor_hero", op: "+=", amount: 4 }]);
    const before = result.before.actors[0];
    const after = result.after.actors[0];
    if (!before || !after) throw new Error("Missing hero battler");
    expect(before.level).toBe(7);
    expect(before.maxHp).toBe(700);
    expect(before.effectiveStats?.attack).toBe(70);
    expect(after.level).toBe(11);
    expect(after.maxHp).toBe(1100);
    expect(after.effectiveStats?.attack).toBe(110);
    expect(after.hp).toBe(300);
    expect(after.mp).toBe(20);
    expect(result.after.eventState.actorEquipment).toEqual(result.before.eventState.actorEquipment);
  });

  it("clamps current HP to the lowered maximum without changing MP", () => {
    const result = run([{ kind: "changeLevel", actorId: "actor_hero", op: "-=", amount: 5 }]);
    const after = result.after.actors[0];
    if (!after) throw new Error("Missing hero battler");
    expect(after.level).toBe(2);
    expect(after.maxHp).toBe(200);
    expect(after.hp).toBe(200);
    expect(after.mp).toBe(20);
  });

  it("writes only battle-mutated friendship keys back to a live session", () => {
    const result = run([
      { kind: "changeFriendship", npcKey: "audit_npc", delta: 19 },
      { kind: "m2Command", commandId: "m2-107-force-escape", fields: {} },
    ]);
    result.session.friendship = { ...result.session.friendship, untouched_npc: 777 };
    expect(result.after.eventState).toMatchObject({ friendship: { audit_npc: 56 } });
    if (!result.after.result) throw new Error("Battle did not resolve");
    applyBattleRewardsToSession(result.session, {
      result: result.after.result, canLose: true, rewards: result.after.rewards,
      actors: result.after.actors, eventState: result.after.eventState,
    }, result.project);
    expect(result.session.friendship).toMatchObject({ audit_npc: 56, untouched_npc: 777 });
  });

  it("returns changed maximum vitals after escape without healing", () => {
    const result = run([
      { kind: "changeLevel", actorId: "actor_hero", op: "+=", amount: 4 },
      { kind: "m2Command", commandId: "m2-107-force-escape", fields: {} },
    ]);
    if (!result.after.result) throw new Error("Battle did not resolve");
    applyBattleRewardsToSession(result.session, {
      result: result.after.result, canLose: true, rewards: result.after.rewards,
      actors: result.after.actors, eventState: result.after.eventState,
    }, result.project);
    expect(result.session.actorLevels.actor_hero).toBe(11);
    expect(result.session.actorVitals.actor_hero).toEqual({ hp: 300, maxHp: 1100, mp: 20, maxMp: 40 });
  });
});
