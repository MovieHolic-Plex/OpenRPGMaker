import assert from "node:assert/strict";
import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { startSession } from "@/project/session";
import type { Command, MessageWindowSettings } from "@/project/types";
import { ACTOR, ROUTES, TROOP, battleCase, choice, m2, mark, pending, resume, variables } from "./battleEventRepairFlow.fixture";
import { acknowledge, eventPause } from "./battleEventSequential.fixture";

const settings = {
  format: "transparent", position: "top", preventObscuringPlayer: false,
  allowEventMovementDuringWait: true,
} as const satisfies MessageWindowSettings;
const changeSettings = { kind: "displayTextSettings", ...settings } as const;
const face = { resourceId: "face-test", position: "right", flipHorizontally: true } as const;

for (const flow of ["gauge", "strict"] as const) describe(`battle dialogue / ${flow}`, () => {
  it.each(ROUTES)("%s text suspends with authored face/settings and clears the next face", route => {
    const { runtime, tails } = battleCase({ flow, route, commands: [
      { kind: "changeFace", ...face }, changeSettings,
      { kind: "text", speaker: "Guard", body: "First\nSecond", emotion: "angry", autoAdvance: false },
      mark("afterText"), { kind: "changeFace", resourceId: "", position: "left", flipHorizontally: false },
      { kind: "text", body: "Face cleared", autoAdvance: true }, mark("finished"),
    ] });
    runtime.performActorCommand({ kind: "defend" });
    expect(variables(runtime).afterText ?? 0, "text must block later commands until presentation completes").toBe(0);
    const first = eventPause(runtime);
    expect(first).toMatchObject({
      kind: "text", speaker: "Guard", body: "First\nSecond", face, settings,
      emotion: "angry", autoAdvance: false,
    });
    for (const id of tails) expect(variables(runtime)[id]).toBe(0);
    acknowledge(runtime, first.id, { kind: "text" });
    const second = eventPause(runtime);
    assert.equal(second.kind, "text");
    expect(second.face).toBeUndefined();
    expect(second.settings).toEqual(settings);
    expect(second.autoAdvance).toBe(true);
    expect(variables(runtime).afterText).toBe(1);
    expect(variables(runtime).finished ?? 0).toBe(0);
    expect(acknowledge(runtime, first.id, { kind: "text" })).toBe(false);
    acknowledge(runtime, second.id, { kind: "text" });
    for (const id of tails) expect(variables(runtime)[id]).toBe(1);
    expect(variables(runtime).finished).toBe(1);
  });

  it("choices inherit settings changed inside a nested call", () => {
    const { runtime } = battleCase({ flow, route: "mixed", commands: [changeSettings, choice()] });
    runtime.performActorCommand({ kind: "defend" });
    expect(runtime.snapshot().eventChoice, "choices must use battle-local settings rather than stale session settings")
      .toMatchObject({ settings });
    resume(runtime, pending(runtime), 1);
    expect(variables(runtime)).toMatchObject({ second: 1, after: 1, later: 1 });
  });

  it("inherits the captured session settings before any local settings command", () => {
    const { project } = battleCase({ flow, commands: [{ kind: "text", body: "Inherited" }] });
    const options = {
      project, troopId: TROOP, battleFlow: flow, canEscape: false, canLose: true,
      party: { partyActorIds: [ACTOR], levels: { [ACTOR]: 1 }, experience: {} },
      sessionState: { switches: {}, variables: {}, inventory: {}, messageWindowSettings: settings },
      rng: () => 0.5,
    };
    const runtime = createBattleRuntime(options);
    if (flow === "gauge") runtime.tick(1_000_000);
    runtime.performActorCommand({ kind: "defend" });
    expect(variables(runtime).after ?? 0).toBe(0);
    expect(eventPause(runtime)).toMatchObject({ kind: "text", settings });
    runtime.cancel();
  });

  it("cancels text without executing parent tails or returning an outcome", () => {
    const { runtime } = battleCase({ flow, route: "mixed", commands: [
      { kind: "text", body: "Pending" }, mark("afterText"),
    ] });
    runtime.performActorCommand({ kind: "defend" });
    expect(variables(runtime).afterText ?? 0).toBe(0);
    const request = eventPause(runtime);
    runtime.cancel();
    expect(acknowledge(runtime, request.id, { kind: "text" })).toBe(false);
    expect(variables(runtime)).toMatchObject({ after: 0, later: 0, tail_0: 0, tail_1: 0, tail_2: 0 });
    expect(runtime.snapshot().result).toBeUndefined();
  });
});

describe("battle message settings return policy", () => {
  it.each([
    { result: "victory", canLose: false, returns: true },
    { result: "escape", canLose: false, returns: true },
    { result: "defeat", canLose: true, returns: true },
    { result: "defeat", canLose: false, returns: false },
  ] as const)("$result / canLose=$canLose writes settings only when returning", ({ result, canLose, returns }) => {
    const terminal: Command = result === "defeat" ? { kind: "gameOver" }
      : result === "escape" ? m2("m2-105-abort-battle")
      : m2("m2-098-change-enemy-hp", { target: "all", operation: "set", value: 0 });
    const { runtime, project } = battleCase({ flow: "strict", commands: [changeSettings, terminal] });
    const session = startSession(project, 9);
    const before = { ...session.messageWindowSettings };
    runtime.performActorCommand({ kind: "defend" });
    const snapshot = runtime.snapshot();
    expect(snapshot.result).toBe(result);
    applyBattleRewardsToSession(session, {
      result, canLose, rewards: snapshot.rewards, actors: snapshot.actors, eventState: snapshot.eventState,
    }, project);
    expect(session.messageWindowSettings).toEqual(returns ? settings : before);
  });

  it("a battle that did not change settings preserves a newer session value", () => {
    const { runtime, project } = battleCase({ flow: "strict", commands: [m2("m2-105-abort-battle")] });
    const session = startSession(project, 9);
    runtime.performActorCommand({ kind: "defend" });
    session.messageWindowSettings = { ...settings };
    const snapshot = runtime.snapshot();
    applyBattleRewardsToSession(session, {
      result: "escape", rewards: snapshot.rewards, eventState: snapshot.eventState,
    }, project);
    expect(session.messageWindowSettings).toEqual(settings);
  });
});
