import { describe, expect, it } from "vitest";
import { ACTOR, ALLY, ROUTES, battleCase, choice, m2, mark, pending, variables } from "./battleEventRepairFlow.fixture";
import { acknowledge, eventPause } from "./battleEventSequential.fixture";

for (const flow of ["gauge", "strict"] as const) describe(`sequential event wait / ${flow}`, () => {
  it.each(ROUTES)("%s wait suspends nested tails and audio until acknowledged", route => {
    const { runtime, tails, played } = battleCase({ flow, route, commands: [
      { kind: "wait", ms: 500 }, mark("afterWait"),
      { kind: "playAudio", resourceId: "after-wait", loop: false },
    ] });
    runtime.performActorCommand({ kind: "defend" });
    expect(variables(runtime).afterWait ?? 0, "wait must stop command execution, not merely log a visual delay").toBe(0);
    const request = eventPause(runtime);
    expect(request).toMatchObject({ kind: "wait", ms: 500 });
    for (const id of tails) expect(variables(runtime)[id]).toBe(0);
    expect(played).toEqual([]);
    const held = structuredClone(runtime.snapshot());
    runtime.tick(1_000_000);
    runtime.performActorCommand({ kind: "defend" });
    runtime.beginActorCommand({ kind: "attack" });
    runtime.selectTarget("enemy-1");
    expect(runtime.chooseAutoCommand()).toBeUndefined();
    expect(runtime.snapshot()).toEqual(held);
    expect(acknowledge(runtime, request.id, { kind: "wait" })).toBe(true);
    expect(variables(runtime).afterWait).toBe(1);
    expect(played).toEqual(["after-wait"]);
    for (const id of tails) expect(variables(runtime)[id]).toBe(1);
    const completed = structuredClone(runtime.snapshot());
    expect(acknowledge(runtime, request.id, { kind: "wait" })).toBe(false);
    expect(runtime.snapshot()).toEqual(completed);
  });

  it("preserves two separate waits and rejects stale or mismatched acknowledgements", () => {
    const { runtime } = battleCase({ flow, commands: [
      { kind: "wait", ms: 200 }, mark("between"), { kind: "wait", ms: 700 }, mark("finished"),
    ] });
    runtime.performActorCommand({ kind: "defend" });
    expect(variables(runtime).between ?? 0).toBe(0);
    const first = eventPause(runtime);
    const held = structuredClone(runtime.snapshot());
    expect(acknowledge(runtime, first.id + 1, { kind: "wait" })).toBe(false);
    expect(acknowledge(runtime, first.id, { kind: "inputWait", keyCode: 3 })).toBe(false);
    expect(runtime.snapshot()).toEqual(held);
    expect(acknowledge(runtime, first.id, { kind: "wait" })).toBe(true);
    const second = eventPause(runtime);
    expect(second).toMatchObject({ kind: "wait", ms: 700 });
    expect(second.id).not.toBe(first.id);
    expect(variables(runtime).between).toBe(1);
    expect(variables(runtime).finished ?? 0).toBe(0);
    expect(acknowledge(runtime, first.id, { kind: "wait" })).toBe(false);
    expect(acknowledge(runtime, second.id, { kind: "wait" })).toBe(true);
    expect(variables(runtime)).toMatchObject({ between: 1, finished: 1, after: 1, later: 1 });
  });

  it.each([0, -1])("normalizes %s ms to an immediate continuation", ms => {
    const { runtime } = battleCase({ flow, commands: [{ kind: "wait", ms }, mark("zero"), choice()] });
    runtime.performActorCommand({ kind: "defend" });
    expect(variables(runtime).zero).toBe(1);
    expect(pending(runtime).options).toHaveLength(2);
    runtime.cancel();
  });

  it.each(ROUTES)("%s input wait stores the accepted code before its branch", route => {
    const { runtime } = battleCase({ flow, route, commands: [
      { kind: "setVariable", variableId: "key", op: "=", value: 99 },
      { kind: "inputWait", variableId: "key" },
      { kind: "fork", condition: { kind: "variable", variableId: "key", op: "==", value: 3 },
        then: [mark("right")], else: [mark("wrong")] },
    ] });
    runtime.performActorCommand({ kind: "defend" });
    expect(variables(runtime).wrong ?? 0, "input wait must not execute the branch with the old variable").toBe(0);
    const request = eventPause(runtime);
    expect(request).toMatchObject({ kind: "inputWait", variableId: "key" });
    expect(variables(runtime).key).toBe(99);
    for (const keyCode of [Number.NaN, 3.5, -1, 20]) {
      expect(acknowledge(runtime, request.id, { kind: "inputWait", keyCode })).toBe(false);
    }
    expect(acknowledge(runtime, request.id, { kind: "inputWait", keyCode: 3 })).toBe(true);
    expect(variables(runtime)).toMatchObject({ key: 3, right: 1, after: 1, later: 1 });
    expect(variables(runtime).wrong ?? 0).toBe(0);
    expect(acknowledge(runtime, request.id, { kind: "inputWait", keyCode: 6 })).toBe(false);
    expect(variables(runtime).key).toBe(3);
  });

  it("input wait without a variable still requires a fresh response", () => {
    const { runtime } = battleCase({ flow, commands: [{ kind: "inputWait" }, mark("tail")] });
    runtime.performActorCommand({ kind: "defend" });
    expect(variables(runtime).tail ?? 0).toBe(0);
    const request = eventPause(runtime);
    expect(acknowledge(runtime, request.id, { kind: "inputWait", keyCode: 0 })).toBe(true);
    expect(variables(runtime).tail).toBe(1);
  });

  it.each(["wait", "inputWait"] as const)("cancellation abandons a nested %s without tail or outcome", kind => {
    const command = kind === "wait" ? { kind, ms: 500 } : { kind, variableId: "key" };
    const { runtime, played } = battleCase({ flow, route: "mixed", commands: [
      command, mark("tail"), { kind: "playAudio", resourceId: "late", loop: false },
    ] });
    runtime.performActorCommand({ kind: "defend" });
    expect(variables(runtime).tail ?? 0).toBe(0);
    const request = eventPause(runtime);
    const held = variables(runtime);
    runtime.cancel();
    runtime.cancel();
    const response = kind === "wait" ? { kind } : { kind, keyCode: 5 };
    expect(acknowledge(runtime, request.id, response)).toBe(false);
    runtime.tick(1_000_000);
    expect(variables(runtime)).toEqual(held);
    expect(played).toEqual([]);
    expect(runtime.snapshot().result).toBeUndefined();
  });
});

describe("sequential strict continuation", () => {
  it.each([false, true])("retains queue/RNG/MP with extra action=%s", extra => {
    const prefix = extra ? [m2("m2-108-action-times", { target: ACTOR, value: 1 })] : [];
    const input = { flow: "strict", party: [ACTOR, ALLY], commandKind: "skill" } as const;
    const paused = battleCase({ ...input, commands: [...prefix, { kind: "wait", ms: 500 }] });
    const control = battleCase({ ...input, commands: prefix });
    const beforeMp = paused.runtime.snapshot().actors.find(actor => actor.recordId === ACTOR)?.mp ?? 0;
    for (const { runtime } of [paused, control]) {
      runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().timeline).toEqual([]);
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    }
    expect(paused.runtime.snapshot().roundLogs, "wait must retain the unfinished strict round").toHaveLength(0);
    expect(paused.runtime.snapshot().actors.find(actor => actor.recordId === ACTOR)?.mp).toBe(beforeMp - 5);
    const request = eventPause(paused.runtime);
    const rngAtPause = paused.rngCalls();
    paused.runtime.tick(1_000_000);
    expect(paused.rngCalls()).toBe(rngAtPause);
    acknowledge(paused.runtime, request.id, { kind: "wait" });
    expect(paused.runtime.snapshot().roundLogs).toEqual(control.runtime.snapshot().roundLogs);
    expect(paused.runtime.snapshot().actors).toEqual(control.runtime.snapshot().actors);
    expect(paused.rngCalls()).toBe(control.rngCalls());
    expect(paused.runtime.snapshot().actors.find(actor => actor.recordId === ACTOR)?.mp).toBe(beforeMp - (extra ? 10 : 5));
  });
});
