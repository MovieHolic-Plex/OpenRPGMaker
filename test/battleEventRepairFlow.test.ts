import { describe, expect, it } from "vitest";
import type { Command } from "@/project/types";
import { ACTOR, ALLY, ENEMY, ROUTES, battleCase, cancel, choice, m2, mark, pending, resume, variables, TROOP } from "./battleEventRepairFlow.fixture";
import { acknowledge, eventPause } from "./battleEventSequential.fixture";
import { simulateBattle } from "@/battle/simulate";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { runWalkthrough } from "@/testing/walkthroughRunner";
import { isolateTimers } from "./mergedTeardown";

describe("battleEventRepairFlow", () => {
  isolateTimers();
  const TERMINALS = [
    { name: "gameOver", command: { kind: "gameOver" }, result: "defeat" },
    { name: "killPlayer", command: { kind: "killPlayer" }, result: "defeat" },
    { name: "abort", command: m2("m2-105-abort-battle"), result: "escape" },
    { name: "forceEscape", command: m2("m2-107-force-escape"), result: "escape" },
  ] as const satisfies readonly { readonly name: string; readonly command: Command; readonly result: string }[];
  for (const flow of ["gauge", "strict"] as const) {
    describe(`battle event repair / ${flow}`, () => {
      it.each(ROUTES)("%s choice waits for explicit input and resumes only the second branch", route => {
        const { runtime, tails, entries } = battleCase({ flow, route, commands: [choice()] });
        runtime.performActorCommand({ kind: "defend" });
        // RED must be the automatic-first bug, not a nonexistent continuation API.
        expect(variables(runtime).first, "no branch may execute without input").toBe(0);
        const request = pending(runtime);
        expect(request.options).toHaveLength(2);
        for (const id of entries) expect(variables(runtime)[id]).toBe(1);
        for (const id of tails) expect(variables(runtime)[id]).toBe(0);
        const held = structuredClone(runtime.snapshot());
        runtime.tick(1_000_000);
        runtime.performActorCommand({ kind: "defend" });
        runtime.beginActorCommand({ kind: "attack" });
        runtime.selectTarget("enemy-1");
        expect(runtime.chooseAutoCommand()).toBeUndefined();
        expect(runtime.snapshot()).toEqual(held);
        expect(resume(runtime, request, 1)).toBe(true);
        expect(variables(runtime)).toMatchObject({ first: 0, second: 1 });
        for (const id of [...entries, ...tails]) expect(variables(runtime)[id]).toBe(1);
        expect(runtime.snapshot().eventLogs.filter(log => log.pageId === "main" && log.kind === "fired" && !log.detail)).toHaveLength(1);
        const finished = structuredClone(runtime.snapshot());
        expect(resume(runtime, request, 1)).toBe(false);
        expect(runtime.snapshot()).toEqual(finished);
      });

      for (const terminal of TERMINALS) {
        it.each(ROUTES)(`${terminal.name} in %s stops command, caller, page, and audio tails`, route => {
          const { runtime, tails, entries, played } = battleCase({ flow, route, commands: [
            { kind: "playAudio", resourceId: "before-terminal", loop: false },
            terminal.command,
            mark("terminalTail"),
            { kind: "playAudio", resourceId: "after-terminal", loop: false },
          ] });
          runtime.performActorCommand({ kind: "defend" });
          const snapshot = runtime.snapshot();
          expect(snapshot.result).toBe(terminal.result);
          expect(snapshot.phase).toBe("resolved");
          expect(variables(runtime).terminalTail ?? 0, "terminal must stop its own command list").toBe(0);
          for (const id of tails) expect(variables(runtime)[id], `terminal leaked into ${id}`).toBe(0);
          for (const id of entries) expect(variables(runtime)[id]).toBe(1);
          expect(played).toEqual(["before-terminal"]);
          expect(snapshot.eventLogs.filter(log => log.pageId === "later")).toEqual([]);
          if (terminal.name === "killPlayer") expect(snapshot.actors.every(actor => actor.hp === 0)).toBe(true);
          if (flow === "strict") {
            expect(snapshot.roundLogs).toHaveLength(1);
            expect(snapshot.roundLogs[0]?.actions.map(action => action.userRecordId)).toEqual([ACTOR]);
            expect(snapshot.roundLogs[0]?.timeline).toEqual(snapshot.timeline);
          }
          const ended = structuredClone(snapshot);
          runtime.tick(1_000_000);
          runtime.performActorCommand({ kind: "defend" });
          expect(runtime.snapshot()).toEqual(ended);
        });
      }

      it("preserves a selected game-over definition and its message across the battle handoff", () => {
        const { runtime } = battleCase({ flow, commands: [{ kind: "killPlayer", gameOverId: "caught", message: "Caught in battle" }, mark("after")] });
        runtime.performActorCommand({ kind: "defend" });
        expect(runtime.snapshot().eventState.gameOverRequest).toEqual({ gameOverId: "caught", message: "Caught in battle" });
        expect(variables(runtime).after).toBe(0);
      });

      it("a gameOver command requests only its selected definition (no message field)", () => {
        const { runtime } = battleCase({ flow, commands: [{ kind: "gameOver", gameOverId: "caught" }, mark("after")] });
        runtime.performActorCommand({ kind: "defend" });
        expect(runtime.snapshot().eventState.gameOverRequest).toEqual({ gameOverId: "caught" });
        expect(variables(runtime).after ?? 0).toBe(0);
      });

      it("the first terminal wins over a conflicting terminal later in the page", () => {
        const { runtime } = battleCase({ flow, commands: [{ kind: "gameOver" }, m2("m2-107-force-escape")] });
        runtime.performActorCommand({ kind: "defend" });
        expect(runtime.snapshot().result).toBe("defeat");
        expect(variables(runtime)).toMatchObject({ after: 0, later: 0 });
      });

      it("rejects invalid and stale responses without consuming a later choice", () => {
        const { runtime } = battleCase({ flow, commands: [choice(), mark("between"), choice()] });
        runtime.performActorCommand({ kind: "defend" });
        const first = pending(runtime);
        const held = structuredClone(runtime.snapshot());
        for (const index of [-1, 2, 0.5, Number.NaN]) expect(resume(runtime, first, index)).toBe(false);
        expect(resume(runtime, { ...first, id: first.id + 100 }, 1)).toBe(false);
        expect(runtime.snapshot()).toEqual(held);
        expect(resume(runtime, first, 1)).toBe(true);
        const second = pending(runtime);
        expect(second.id).not.toBe(first.id);
        expect(variables(runtime)).toMatchObject({ first: 0, second: 1, between: 1, after: 0 });
        const heldAgain = structuredClone(runtime.snapshot());
        expect(resume(runtime, first, 0)).toBe(false);
        expect(runtime.snapshot()).toEqual(heldAgain);
        expect(resume(runtime, second, 0)).toBe(true);
        expect(variables(runtime)).toMatchObject({ first: 1, second: 1, between: 1, after: 1, later: 1 });
      });

      it.each(["branch", "disallow", "choice2"] as const)("preserves authored %s cancellation semantics", cancelBehavior => {
        const { runtime } = battleCase({ flow, route: "mixed", commands: [choice({ cancelBehavior, cancelBranch: [mark("cancelled")] })] });
        runtime.performActorCommand({ kind: "defend" });
        const request = pending(runtime);
        expect(request.cancelBehavior).toBe(cancelBehavior);
        if (cancelBehavior === "disallow") {
          const held = structuredClone(runtime.snapshot());
          expect(resume(runtime, request, -1)).toBe(false);
          expect(runtime.snapshot()).toEqual(held);
        }
        // The real dialogue maps choice2 cancellation to option index 1. This
        // runtime contract does not pretend to exercise keyboard cancellation.
        expect(resume(runtime, request, cancelBehavior === "branch" ? -1 : 1)).toBe(true);
        expect(variables(runtime)).toMatchObject({ first: 0, second: cancelBehavior === "branch" ? 0 : 1,
          cancelled: cancelBehavior === "branch" ? 1 : 0, after: 1, later: 1, tail_0: 1, tail_1: 1, tail_2: 1 });
      });

      it("disposal abandons nested input without selecting a cancel branch or producing an outcome", () => {
        const { runtime } = battleCase({ flow, route: "mixed", commands: [choice({ cancelBehavior: "branch", cancelBranch: [mark("cancelled")] })] });
        runtime.performActorCommand({ kind: "defend" });
        const request = pending(runtime);
        const heldVariables = variables(runtime);
        const heldTimeline = structuredClone(runtime.snapshot().timeline);
        cancel(runtime);
        cancel(runtime);
        expect(resume(runtime, request, 1)).toBe(false);
        runtime.tick(1_000_000);
        runtime.performActorCommand({ kind: "defend" });
        expect(variables(runtime)).toEqual(heldVariables);
        expect(runtime.snapshot().timeline).toEqual(heldTimeline);
        expect(runtime.snapshot().result).toBeUndefined();
      });

      it("retains loop frames so a selected branch can break without repeating its prefix", () => {
        const { runtime } = battleCase({ flow, route: "mixed", commands: [
          { kind: "loop", body: [mark("iteration"), choice({ options: [
            { text: "First", branch: [mark("first"), { kind: "breakLoop" }] },
            { text: "Second", branch: [mark("second"), { kind: "breakLoop" }] },
          ] }), mark("loopTail")] }, mark("afterLoop"),
        ] });
        runtime.performActorCommand({ kind: "defend" });
        const request = pending(runtime);
        expect(variables(runtime).iteration).toBe(1);
        expect(resume(runtime, request, 1)).toBe(true);
        expect(variables(runtime)).toMatchObject({ iteration: 1, first: 0, second: 1, afterLoop: 1, after: 1 });
        expect(variables(runtime).loopTail ?? 0).toBe(0);
      });

      it("noninteractive nested calls still run synchronously and exactly once", () => {
        const { runtime, entries, tails } = battleCase({ flow, route: "mixed", commands: [mark("effect")] });
        runtime.performActorCommand({ kind: "defend" });
        expect(variables(runtime).effect).toBe(1);
        for (const id of [...entries, ...tails]) expect(variables(runtime)[id]).toBe(1);
        expect(runtime.snapshot().phase).toBe(flow === "gauge" ? "charging" : "actorCommand");
      });
    });
  }
  describe("battle event repair / strict queue", () => {
    for (const extra of [false, true]) {
      it(`resumes the retained action queue with extra action=${extra} without repeating MP, RNG, or upkeep`, () => {
        const prefix = extra ? [m2("m2-108-action-times", { target: ACTOR, value: 1 })] : [];
        const input = { flow: "strict", party: [ACTOR, ALLY], commandKind: "skill" } as const;
        const paused = battleCase({ ...input, commands: [...prefix, choice()] });
        const control = battleCase({ ...input, commands: [...prefix, mark("second")] });
        const mpBefore = paused.runtime.snapshot().actors.find(actor => actor.recordId === ACTOR)?.mp ?? 0;
        for (const { runtime } of [paused, control]) {
          runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });
          expect(runtime.snapshot().timeline).toEqual([]);
          expect(runtime.snapshot().activeActorId).toBe(ALLY);
          runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
        }
        // Existing code runs the entire round here; assert that bug before API use.
        expect(paused.runtime.snapshot().roundLogs, "a choice must not finish its strict round").toHaveLength(0);
        const request = pending(paused.runtime);
        expect(paused.runtime.snapshot().timeline.filter(entry => entry.kind === "damage").map(entry => entry.userRecordId)).toEqual([ACTOR]);
        expect(paused.runtime.snapshot().actors.find(actor => actor.recordId === ACTOR)?.mp).toBe(mpBefore - 5);
        expect(resume(paused.runtime, request, 1)).toBe(true);
        const resumed = paused.runtime.snapshot();
        expect(resumed.roundLogs).toHaveLength(1);
        expect(resumed.roundLogs[0]?.actions.map(action => action.userRecordId)).toEqual(extra ? [ACTOR, ACTOR, ENEMY, ALLY] : [ACTOR, ENEMY, ALLY]);
        expect(resumed.actors.find(actor => actor.recordId === ACTOR)?.mp).toBe(mpBefore - (extra ? 10 : 5));
        expect(resumed.roundLogs).toEqual(control.runtime.snapshot().roundLogs);
        expect(resumed.timeline).toEqual(control.runtime.snapshot().timeline);
        expect(resumed.actors).toEqual(control.runtime.snapshot().actors);
        expect(paused.rngCalls()).toBe(control.rngCalls());
        expect(resumed.timeline.map(entry => entry.sequence)).toEqual(resumed.timeline.map((_, index) => index));
        expect(resumed.strictRound).toBe(2);
        expect(resumed.activeActorId).toBe(ACTOR);
      });
    }

    it("without a choice, collection defers all effects and ordered actions spend resources once", () => {
      const { runtime } = battleCase({ flow: "strict", party: [ACTOR, ALLY], commandKind: "skill", commands: [] });
      const mpBefore = runtime.snapshot().actors.find(actor => actor.recordId === ACTOR)?.mp ?? 0;
      runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().timeline).toEqual([]);
      expect(runtime.snapshot().actors.find(actor => actor.recordId === ACTOR)?.mp).toBe(mpBefore);
      runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
      expect(runtime.snapshot().roundLogs[0]?.actions.map(action => action.userRecordId)).toEqual([ACTOR, ENEMY, ALLY]);
      expect(runtime.snapshot().actors.find(actor => actor.recordId === ACTOR)?.mp).toBe(mpBefore - 5);
      expect(runtime.snapshot().roundLogs).toHaveLength(1);
    });
  });
});

describe("battleEventSequentialWait", () => {
  isolateTimers();
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
});

describe("battleEventSimulationInput", () => {
  isolateTimers();
  for (const flow of ["gauge", "strict"] as const) describe(`battle simulation input / ${flow}`, () => {
    function projectWithBattle(commands: readonly Command[] = [choice()]) {
      const { project } = battleCase({ flow, commands, commandKind: "attack" });
      project.system.battleFlow = flow;
      project.system.startActorIds = [ACTOR]; project.session.partyActorIds = [ACTOR];
      for (const troop of project.database.troops) if (troop.id === TROOP) troop.battleFlow = flow;
      project.maps[project.startMapId].events.push({ id: "battle", name: "Battle", x: 1, y: 0, trigger: { kind: "action" }, commands: [], pages: [{
        id: "battle-page", name: "Battle", conditions: [], graphic: {}, priority: "same", trigger: { kind: "action" },
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "battleProcessing", troopId: TROOP, battleFlow: flow, canEscape: false, canLose: true },
          { kind: "setVariable", variableId: "mapTail", op: "=", value: 1 }],
      }] });
      return project;
    }
    it("balance simulation reports required input rather than an invented nonvictory", () => {
      const project = projectWithBattle(); let failure: unknown;
      try { simulateBattle({ project, troopId: TROOP, battleFlow: flow, heroLevel: 1, partyActorIds: [ACTOR], seed: 1, n: 1 }); }
      catch (error) { failure = error; }
      expect(failure).toMatchObject({ code: "BATTLE_EVENT_INPUT_REQUIRED" });
    });
    it("scene simulation stops without executing map tails or writing a defeat", () => {
      const project = projectWithBattle();
      const result = runSceneTest(project, { mapId: project.startMapId, start: { x: 0, y: 0 }, steps: [
        { kind: "face", dir: "right" }, { kind: "interact" },
      ] });
      expect(result.ok).toBe(false);
      // run_scene_test 는 예외 대신 답 없는 전투 선택지를 이름 붙여 실패시킨다(1089e93649, battleChoice 스텝).
      expect(result.failureReason).toContain("선택지에 낼 답이 없습니다");
      expect(result.session.battleResult).toBeUndefined();
      expect(result.session.variables.mapTail).toBeUndefined();
    });
    it("walkthrough simulation stops without executing map tails or writing a defeat", () => {
      const result = runWalkthrough(projectWithBattle(), [{ do: "interact", eventId: "battle" }]);
      expect(result.ok).toBe(false);
      expect(result.failureReason).toContain("BATTLE_EVENT_INPUT_REQUIRED");
      expect(result.session.battleResult).toBeUndefined();
      expect(result.session.variables.mapTail).toBeUndefined();
    });

    for (const variableId of [undefined, "key"]) {
      const commands: readonly Command[] = [
        { kind: "inputWait", variableId },
        { kind: "setVariable", variableId: "inputTail", op: "=", value: 1 },
        { kind: "gameOver" },
      ];
      it(`balance inputWait variable=${variableId} requires input instead of inventing a defeat`, () => {
        const project = projectWithBattle(commands);
        expect(() => simulateBattle({
          project, troopId: TROOP, battleFlow: flow, heroLevel: 1,
          partyActorIds: [ACTOR], seed: 1, n: 1,
        })).toThrowError(expect.objectContaining({ code: "BATTLE_EVENT_INPUT_REQUIRED" }));
      });
      it(`scene inputWait variable=${variableId} cannot write battle/map tails`, () => {
        const project = projectWithBattle(commands);
        const result = runSceneTest(project, {
          mapId: project.startMapId, start: { x: 0, y: 0 },
          steps: [{ kind: "face", dir: "right" }, { kind: "interact" }],
        });
        expect(result.ok, "inputWait cannot silently complete a scene simulation").toBe(false);
        expect(result.failureReason).toContain("BATTLE_EVENT_INPUT_REQUIRED");
        expect(result.session.battleResult).toBeUndefined();
        expect(result.session.variables.inputTail).toBeUndefined();
        expect(result.session.variables.mapTail).toBeUndefined();
      });
      it(`walkthrough inputWait variable=${variableId} cannot write battle/map tails`, () => {
        const result = runWalkthrough(projectWithBattle(commands), [{ do: "interact", eventId: "battle" }]);
        expect(result.ok, "inputWait cannot silently complete a walkthrough").toBe(false);
        expect(result.failureReason).toContain("BATTLE_EVENT_INPUT_REQUIRED");
        expect(result.session.battleResult).toBeUndefined();
        expect(result.session.variables.inputTail).toBeUndefined();
        expect(result.session.variables.mapTail).toBeUndefined();
      });
    }

    it.each(["balance", "scene", "walkthrough"] as const)("%s explicitly bypasses wait/text presentation but never the following choice", runner => {
      const project = projectWithBattle([
        { kind: "wait", ms: 500 }, { kind: "text", body: "Presentation only" }, choice(),
      ]);
      if (runner === "balance") {
        expect(() => simulateBattle({
          project, troopId: TROOP, battleFlow: flow, heroLevel: 1,
          partyActorIds: [ACTOR], seed: 1, n: 1,
        })).toThrowError(expect.objectContaining({ code: "BATTLE_EVENT_INPUT_REQUIRED" }));
        return;
      }
      const result = runner === "scene"
        ? runSceneTest(project, { mapId: project.startMapId, start: { x: 0, y: 0 },
          steps: [{ kind: "face", dir: "right" }, { kind: "interact" }] })
        : runWalkthrough(project, [{ do: "interact", eventId: "battle" }]);
      expect(result.failureReason).toContain(runner === "scene" ? "선택지에 낼 답이 없습니다" : "BATTLE_EVENT_INPUT_REQUIRED");
      expect(result.session.battleResult).toBeUndefined();
      expect(result.session.variables.mapTail).toBeUndefined();
    });

    it.each(["balance", "scene", "walkthrough"] as const)("%s completes presentation-only events without requiring invented user input", runner => {
      const project = projectWithBattle([
        { kind: "wait", ms: 500 }, { kind: "text", body: "Presentation only" },
        { kind: "setVariable", variableId: "presentedTail", op: "=", value: 37 },
        { kind: "gameOver" },
      ]);
      if (runner === "balance") {
        const result = simulateBattle({
          project, troopId: TROOP, battleFlow: flow, heroLevel: 1,
          partyActorIds: [ACTOR], seed: 1, n: 1,
        });
        expect(result.samples).toBe(1);
        expect(result.winRate).toBe(0);
        expect(result.roundLogs.length).toBe(flow === "strict" ? 1 : 0);
        return;
      }
      const result = runner === "scene"
        ? runSceneTest(project, { mapId: project.startMapId, start: { x: 0, y: 0 },
          steps: [{ kind: "face", dir: "right" }, { kind: "interact" }] })
        : runWalkthrough(project, [{ do: "interact", eventId: "battle" }]);
      expect(result.ok).toBe(true);
      expect(result.session.battleResult).toBe("defeat");
      expect(result.session.variables.presentedTail).toBe(37);
      expect(result.session.variables.mapTail).toBe(1);
    });
  });
});
