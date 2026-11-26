import { describe, expect, it } from "vitest";
import type { Command, Project } from "@/project/types";
import { ACTOR, ALLY, ENEMY, ROUTES, battleCase, cancel, choice, m2, mark, pending, resume, variables, TROOP } from "./battleEventRepairFlow.fixture";
import { acknowledge, eventPause } from "./battleEventSequential.fixture";
import { simulateBattle } from "@/battle/simulate";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { runWalkthrough } from "@/testing/walkthroughRunner";
import { isolateTimers } from "./mergedTeardown";
import { attemptGen1Capture, gen1CaptureProbability, type Gen1CaptureInput } from "@/battle/gen1/capture";
import { applyGen1MajorStatus, applyGen1PostActionResidual, gen1EffectChanceSucceeds, gen1EffectChanceThreshold, gen1MajorStatusBlockedByType, gen1StatusMoveBlockedByTargetType, gen1BurnAdjustedAttack, gen1ParalyzedSpeed, readGen1MajorStatus, stepGen1MajorStatus, type Gen1StateRecordRef } from "@/battle/gen1/status";
import { gen1CanonicalTypeForId, gen1ElementIdForCanonical } from "@/battle/typeChart";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { searchResources } from "@/assets/resourceSearch";
import { runTool } from "@/editor/tools/toolRunner";
import { AUDIO_SEARCH_DATA_URL, AUDIO_SEARCH_ID, AUDIO_SEARCH_SENTINEL, audioSearchProject } from "./support/audioSearchFixture";
import { chooseAutoBattleCommand } from "@/battle/battleAuto";
import { createBattleRuntime } from "@/battle/runtime";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { deserialize } from "@/project/io";
import battleFixture from "./fixtures/projects/battle-v3.json";
import { withRetiredEasyRpgTilesets } from "./support/retiredEasyRpgTilesets";

describe("battleEventRepairFlow", () => {
  isolateTimers();
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
});

describe("battleGen1Suite", () => {
  isolateTimers();
  describe("gen1CaptureGolden", () => {
    isolateTimers();
    function bytes(values: readonly number[]): { readonly next: () => number; readonly consumed: () => number } {
      let index = 0;
      return {
        next: () => {
          const value = values[index];
          if (value === undefined) throw new Error(`unexpected RNG read at ${index}`);
          index += 1;
          return value;
        },
        consumed: () => index,
      };
    }
    const fullHp: Omit<Gen1CaptureInput, "ballClass"> = {
      maxHp: 100,
      currentHp: 100,
      catchRate: 45,
    };
    describe("Red/Blue exact capture probability", () => {
      it.each([
        ["poke", undefined, 989, 16_384, 85],
        ["great", undefined, 23, 201, 127],
        ["ultra", undefined, 989, 9_664, 85],
        ["poke", "sleep", 2_589, 16_384, 85],
        ["poke", "burn", 1_757, 16_384, 85],
      ] as const)("break: %s/%s keeps the exact rational", (ballClass, majorStatus, numerator, denominator, x) => {
        expect(gen1CaptureProbability({ ...fullHp, ballClass, majorStatus })).toMatchObject({
          numerator,
          denominator,
          x,
        });
      });

      it("break: W above 255 skips Rand2 but still requires the Rand1 catch-rate gate", () => {
        expect(gen1CaptureProbability({ ...fullHp, ballClass: "poke", currentHp: 1 }))
          .toMatchObject({ numerator: 23, denominator: 128, w: 2_125, x: 255 });
      });

      it("break: trainer battles are impossible even with a Master Ball", () => {
        expect(gen1CaptureProbability({ ...fullHp, ballClass: "master", trainerBattle: true }))
          .toMatchObject({ numerator: 0, denominator: 1 });
      });
    });
    describe("Red/Blue two-stage capture attempt and byte consumption", () => {
      it("uses inclusive Rand1 and Rand2 boundaries", () => {
        const successBytes = bytes([45, 85]);
        expect(attemptGen1Capture({ ...fullHp, ballClass: "poke" }, successBytes.next))
          .toMatchObject({ caught: true, shakes: 3, trace: { rand1: 45, rand2: 85 } });
        expect(successBytes.consumed()).toBe(2);

        const rand2Failure = bytes([45, 86]);
        expect(attemptGen1Capture({ ...fullHp, ballClass: "poke" }, rand2Failure.next))
          .toMatchObject({ caught: false, failureReason: "rand2", shakes: 0 });

        const rand1Failure = bytes([46]);
        expect(attemptGen1Capture({ ...fullHp, ballClass: "poke" }, rand1Failure.next))
          .toMatchObject({ caught: false, failureReason: "rand1", trace: { rand1: 46 } });
        expect(rand1Failure.consumed()).toBe(1);
      });

      it.each([
        ["great", [201, 200, 127], [201], 200, 127],
        ["ultra", [151, 150, 85], [151], 150, 85],
      ] as const)("break: %s rerolls out-of-range Rand1 bytes", (ballClass, sequence, rejected, rand1, rand2) => {
        const rng = bytes(sequence);
        const result = attemptGen1Capture(
          { ...fullHp, ballClass, catchRate: 255 },
          rng.next,
        );
        expect(result).toMatchObject({
          caught: true,
          trace: { rand1, rand2, rejectedRand1Bytes: rejected },
        });
        expect(rng.consumed()).toBe(3);
      });

      it.each(["great", "ultra"] as const)("terminates pathological constant-255 rejection for a %s ball", (ballClass) => {
        let consumed = 0;
        const result = attemptGen1Capture(
          { ...fullHp, ballClass },
          () => {
            consumed += 1;
            if (consumed > 64) throw new Error("capture rejection sampling did not terminate");
            return 255;
          },
        );

        expect(consumed).toBeLessThanOrEqual(64);
        expect(result.trace.rand1).toBeLessThanOrEqual(ballClass === "great" ? 200 : 150);
        expect(result.trace.rejectedRand1Bytes).toHaveLength(consumed);
      });

      it("break: Master Ball consumes Rand1, while status-underflow succeeds without Rand2", () => {
        const masterRng = bytes([211]);
        expect(attemptGen1Capture({ ...fullHp, ballClass: "master" }, masterRng.next))
          .toMatchObject({ caught: true, trace: { rand1: 211 } });
        expect(masterRng.consumed()).toBe(1);

        const sleepRng = bytes([24]);
        expect(attemptGen1Capture({ ...fullHp, ballClass: "poke", majorStatus: "sleep" }, sleepRng.next))
          .toMatchObject({ caught: true, trace: { rand1: 24, adjustedRand1: undefined } });
        expect(sleepRng.consumed()).toBe(1);
      });

      it.each([
        ["poke", 0],
        ["great", 1],
        ["ultra", 1],
      ] as const)("break: failed %s attempts derive the original shake count", (ballClass, shakes) => {
        const rng = bytes([45, 255]);
        expect(attemptGen1Capture({ ...fullHp, ballClass }, rng.next)).toMatchObject({
          caught: false,
          failureReason: "rand2",
          shakes,
        });
      });

      it("does not consume RNG when the trainer-battle gate rejects the throw", () => {
        const rng = bytes([]);
        expect(attemptGen1Capture(
          { ...fullHp, ballClass: "master", trainerBattle: true },
          rng.next,
        )).toMatchObject({ caught: false, failureReason: "trainerBattle", shakes: 0 });
        expect(rng.consumed()).toBe(0);
      });
    });
  });
  describe("gen1StatusGolden", () => {
    isolateTimers();
    function bytes(values: readonly number[]): { readonly next: () => number; readonly consumed: () => number } {
      let index = 0;
      return {
        next: () => {
          const value = values[index];
          if (value === undefined) throw new Error(`unexpected RNG read at ${index}`);
          index += 1;
          return value;
        },
        consumed: () => index,
      };
    }
    const states: readonly Gen1StateRecordRef[] = [
      { id: "state_poison", gen1MajorStatus: "poison" },
      { id: "state_burn", gen1MajorStatus: "burn" },
      { id: "state_sleep", gen1MajorStatus: "sleep" },
      { id: "state_freeze", gen1MajorStatus: "freeze" },
      { id: "state_paralysis", gen1MajorStatus: "paralysis" },
      { id: "state_buff" },
    ];
    describe("Gen1 post-hit effect chance", () => {
      it("uses the cartridge percent-byte boundary and makes 100% unconditional", () => {
        expect(gen1EffectChanceThreshold(0)).toBe(0);
        expect(gen1EffectChanceThreshold(10)).toBe(26);
        expect(gen1EffectChanceThreshold(20)).toBe(52);
        expect(gen1EffectChanceThreshold(30)).toBe(77);
        expect(gen1EffectChanceThreshold(100)).toBe(256);

        expect(gen1EffectChanceSucceeds(10, bytes([25]).next)).toBe(true);
        expect(gen1EffectChanceSucceeds(10, bytes([26]).next)).toBe(false);
        const guaranteed = bytes([]);
        expect(gen1EffectChanceSucceeds(100, guaranteed.next)).toBe(true);
        expect(guaranteed.consumed()).toBe(0);
      });
    });
    describe("Gen1 major-status type immunity", () => {
      it("preserves Red/Blue poison, damaging-side-effect, and electric status rules", () => {
        expect(gen1MajorStatusBlockedByType("poison", "poison", ["poison"], "damage")).toBe(true);
        expect(gen1MajorStatusBlockedByType("burn", "fire", ["fire"], "damage")).toBe(true);
        expect(gen1MajorStatusBlockedByType("freeze", "ice", ["ice"], "damage")).toBe(true);
        expect(gen1MajorStatusBlockedByType("paralysis", "normal", ["normal"], "damage")).toBe(true);
        expect(gen1MajorStatusBlockedByType("paralysis", "electric", ["ground"], "status")).toBe(true);

        expect(gen1MajorStatusBlockedByType("paralysis", "normal", ["electric"], "damage")).toBe(false);
        expect(gen1MajorStatusBlockedByType("paralysis", "electric", ["electric"], "status")).toBe(false);
        expect(gen1MajorStatusBlockedByType("sleep", "grass", ["grass"], "status")).toBe(false);
      });

      it("blocks burn and freeze from any source, including a different move type or no move type", () => {
        expect(gen1StatusMoveBlockedByTargetType("burn", "normal", ["fire"])).toBe("fire");
        expect(gen1StatusMoveBlockedByTargetType("burn", undefined, ["fire"])).toBe("fire");
        expect(gen1StatusMoveBlockedByTargetType("freeze", "normal", ["ice"])).toBe("ice");
        expect(gen1StatusMoveBlockedByTargetType("freeze", undefined, ["ice", "water"])).toBe("ice");
        expect(gen1MajorStatusBlockedByType("burn", "normal", ["fire"], "status")).toBe(true);
        expect(gen1MajorStatusBlockedByType("burn", "normal", ["fire"], "damage")).toBe(true);
        expect(gen1MajorStatusBlockedByType("burn", undefined, ["fire"], "status")).toBe(true);
        expect(gen1MajorStatusBlockedByType("freeze", "water", ["ice"], "status")).toBe(true);
        expect(gen1MajorStatusBlockedByType("burn", "fire", ["water"], "status")).toBe(false);
        expect(gen1MajorStatusBlockedByType("freeze", "ice", ["water"], "damage")).toBe(false);
        // 전기 피해 기술의 부가 마비는 땅 타입을 여기서 막지 않는다(상성 0 배가 맡는다). 상태 기술만 막는다.
        expect(gen1MajorStatusBlockedByType("paralysis", "electric", ["ground"], "damage")).toBe(false);
        expect(gen1StatusMoveBlockedByTargetType("paralysis", "electric", ["ground"])).toBe("ground");
      });

      it("resolves prefixed and localized authored type ids to cartridge semantics", () => {
        const project = createScarloxyPokemonDemoProject();
        project.system.typeChart!.types = project.system.typeChart!.types.map((typeId) =>
          typeId === "normal" ? "type_normal" : typeId,
        );

        expect(gen1CanonicalTypeForId(project, "type_fire")).toBe("fire");
        expect(gen1CanonicalTypeForId(project, "불꽃")).toBe("fire");
        expect(gen1CanonicalTypeForId(project, "type_ground")).toBe("ground");
        expect(gen1ElementIdForCanonical(project, "normal")).toBe("type_normal");
      });
    });
    describe("Gen1 single-major-status application", () => {
      it("break: rejects a second major status while preserving non-major states", () => {
        const rng = bytes([]);
        const result = applyGen1MajorStatus({
          stateIds: ["state_buff", "state_burn"],
          stateTurns: {},
          stateRecords: states,
          incomingStateId: "state_paralysis",
        }, rng.next);
        expect(result).toMatchObject({
          applied: false,
          reason: "majorStatusPresent",
          stateIds: ["state_buff", "state_burn"],
        });
        expect(readGen1MajorStatus(result.stateIds, result.stateTurns, states))
          .toEqual({ stateId: "state_burn", kind: "burn", turns: undefined });
        expect(rng.consumed()).toBe(0);
      });

      it("break: sleep rolls 1..7 with zero values rejected after masking", () => {
        const rng = bytes([0, 8, 7]);
        const result = applyGen1MajorStatus({
          stateIds: ["state_buff"],
          stateTurns: {},
          stateRecords: states,
          incomingStateId: "state_sleep",
        }, rng.next);
        expect(result).toMatchObject({
          applied: true,
          stateIds: ["state_buff", "state_sleep"],
          stateTurns: { state_sleep: 7 },
          trace: { rejectedSleepBytes: [0, 8], sleepByte: 7 },
        });
        expect(rng.consumed()).toBe(3);
      });
    });
    describe("Gen1 pre-action status", () => {
      it("break: the wake-up turn still loses its action and clears sleep", () => {
        const rng = bytes([]);
        const result = stepGen1MajorStatus({
          stateIds: ["state_buff", "state_sleep"],
          stateTurns: { state_sleep: 1 },
          stateRecords: states,
        }, rng.next);
        expect(result).toMatchObject({
          canAct: false,
          reason: "wokeUp",
          stateIds: ["state_buff"],
          stateTurns: {},
        });
        expect(rng.consumed()).toBe(0);
      });

      it("break: sleep decrements before blocking the action", () => {
        const rng = bytes([]);
        expect(stepGen1MajorStatus({
          stateIds: ["state_sleep"],
          stateTurns: { state_sleep: 2 },
          stateRecords: states,
        }, rng.next)).toMatchObject({
          canAct: false,
          reason: "asleep",
          stateIds: ["state_sleep"],
          stateTurns: { state_sleep: 1 },
        });
      });

      it("break: paralysis blocks bytes 0..62, exactly 63/256 outcomes", () => {
        const blockedRng = bytes([62]);
        const actsRng = bytes([63]);
        const input = {
          stateIds: ["state_paralysis"],
          stateTurns: {},
          stateRecords: states,
        };
        expect(stepGen1MajorStatus(input, blockedRng.next))
          .toMatchObject({ canAct: false, reason: "fullyParalyzed", trace: { paralysisByte: 62 } });
        expect(stepGen1MajorStatus(input, actsRng.next))
          .toMatchObject({ canAct: true, trace: { paralysisByte: 63 } });
      });

      it("break: freeze has no natural thaw roll and consumes no RNG", () => {
        const rng = bytes([]);
        expect(stepGen1MajorStatus({
          stateIds: ["state_freeze"],
          stateTurns: {},
          stateRecords: states,
        }, rng.next)).toMatchObject({
          canAct: false,
          reason: "frozen",
          stateIds: ["state_freeze"],
        });
        expect(rng.consumed()).toBe(0);
      });
    });
    describe("Gen1 burn, paralysis, and post-action residuals", () => {
      it("halves only noncritical physical Attack and quarters paralyzed Speed", () => {
        expect(gen1BurnAdjustedAttack(101, "physical", true, false)).toBe(50);
        expect(gen1BurnAdjustedAttack(101, "special", true, false)).toBe(101);
        expect(gen1BurnAdjustedAttack(101, "physical", true, true)).toBe(101);
        expect(gen1ParalyzedSpeed(101, true)).toBe(25);
      });

      it.each(["burn", "poison"] as const)("break: %s deals floor(MaxHP/16), minimum one, after the action", (kind) => {
        expect(applyGen1PostActionResidual({ kind, maxHp: 100, currentHp: 100 }))
          .toEqual({ damage: 6, currentHp: 94, fainted: false });
        expect(applyGen1PostActionResidual({ kind, maxHp: 15, currentHp: 1 }))
          .toEqual({ damage: 1, currentHp: 0, fainted: true });
      });

      it("does not apply residual damage for other major statuses", () => {
        expect(applyGen1PostActionResidual({ kind: "paralysis", maxHp: 100, currentHp: 50 }))
          .toEqual({ damage: 0, currentHp: 50, fainted: false });
      });
    });
  });
});

describe("battleRuntimeDefects", () => {
  isolateTimers();
  describe("audioResourceToolPagination", () => {
    isolateTimers();
    describe("list_resources pagination", () => {
      it.each([
        { offset: undefined, limit: undefined, start: 0, count: 20, next: 20 },
        { offset: 0, limit: 1, start: 0, count: 1, next: 1 },
        { offset: 0, limit: 50, start: 0, count: 50, next: 50 },
        { offset: 20, limit: 20, start: 20, count: 20, next: 40 },
        { offset: 50, limit: 50, start: 50, count: 3, next: null },
        { offset: 53, limit: 20, start: 53, count: 0, next: null },
        { offset: 70, limit: 20, start: 70, count: 0, next: null },
      ])("returns the requested slice when offset=$offset and limit=$limit", spec => {
        // Given
        const project = audioSearchProject();
        const ids = Array.from({ length: 53 }, (_, index) => `qa-page-${index}`);
        project.resourceProfiles = [];
        project.assets.uploaded = Object.fromEntries(ids.map(id => [
          id,
          { id, kind: "music" as const, name: id, dataUrl: AUDIO_SEARCH_DATA_URL, meta: {} },
        ]));
        project.audioDescriptions = {
          music: Object.fromEntries(ids.map(id => [id, AUDIO_SEARCH_SENTINEL])),
        };
        // When
        const result = runTool({ project }, "list_resources", {
          kind: "bgm",
          query: AUDIO_SEARCH_SENTINEL,
          ...(spec.offset === undefined ? {} : { offset: spec.offset }),
          ...(spec.limit === undefined ? {} : { limit: spec.limit }),
        });
        // Then
        expect(result).toMatchObject({
          ok: true,
          data: {
            matches: ids.slice(spec.start, spec.start + spec.count).map(id =>
              expect.objectContaining({ id: `bgm:${id}`, resourceId: id }),
            ),
            total: 53,
            nextOffset: spec.next,
          },
        });
      });

      it.each([
        { offset: -1 }, { offset: 0.5 }, { offset: NaN },
        { offset: Infinity }, { offset: null }, { offset: "bad" },
        { limit: 0 }, { limit: -1 }, { limit: 51 },
        { limit: 1.5 }, { limit: Infinity }, { limit: null },
      ])("rejects invalid pagination when arguments are %j", pagination => {
        // Given
        const project = audioSearchProject();
        // When
        const result = runTool({ project }, "list_resources", {
          kind: "bgm",
          query: "*",
          ...pagination,
        });
        // Then
        expect(result).toMatchObject({
          ok: false,
          issues: expect.arrayContaining([expect.objectContaining({ code: "invalid-args" })]),
        });
      });

      it.each([239, 240, 241])("clips only tool-list descriptions when their length is %i UTF-16 units", length => {
        // Given: the supplementary character exercises UTF-16 rather than code-point counting.
        const description = `🙂${"x".repeat(length - 2)}`;
        const project = audioSearchProject("music", description);
        const options = { charsetLabels: [], audioProject: project };
        const full = searchResources("bgm", description, options);
        // When
        const result = runTool({ project }, "list_resources", { kind: "bgm", query: description });
        // Then
        expect(full).toEqual([expect.objectContaining({ description })]);
        expect(result).toMatchObject({
          ok: true,
          data: {
            matches: [{
              resourceId: AUDIO_SEARCH_ID,
              description: description.slice(0, 240),
              descriptionTruncated: length > 240,
            }],
            total: 1,
            nextOffset: null,
          },
        });
      });

      it("returns an exhausted page when the query has no matches", () => {
        // Given
        const project = audioSearchProject();
        // When
        const result = runTool({ project }, "list_resources", {
          kind: "bgm", query: "NO_MATCH_617AFF",
        });
        // Then
        expect(result).toMatchObject({
          ok: true, data: { matches: [], total: 0, nextOffset: null },
        });
      });

      it("retains the non-audio default cap and result shape when browsing charsets", () => {
        // Given
        const project = audioSearchProject();
        const all = searchResources("charset", "*", { charsetLabels: project.charsetLabels });
        // When
        const result = runTool({ project }, "list_resources", { kind: "charset", query: "*" });
        // Then
        expect(result).toMatchObject({
          ok: true,
          data: { matches: all.slice(0, 20), total: all.length, nextOffset: 20 },
        });
      });
    });
  });
  describe("battleRuntimeDefects", () => {
    isolateTimers();
    function battleProject(): Project {
      return deserialize(JSON.stringify(battleFixture));
    }
    function addSkill(project: Project, id: string, name: string, effect: "damage" | "healing" = "damage"): void {
      project.database.skills = project.database.skills.filter((skill) => skill.id !== id);
      project.database.skills.push({
        id,
        name,
        scope: effect === "healing" ? "ally" : "enemy",
        power: effect === "healing" ? 50 : 1,
        description: "",
        type: "normal",
        mpCost: { flat: 0, percentMax: 0 },
        successRate: 100,
        variance: 0,
        hitRate: 100,
        effect: effect === "healing"
          ? { kind: "healing", statistic: "mind", affects: "hp" }
          : { kind: "damage", statistic: "attack", affects: "hp" },
      });
    }
    function untilActorCommand(runtime: ReturnType<typeof createBattleRuntime>, maxTicks = 40): void {
      for (let i = 0; i < maxTicks; i += 1) {
        runtime.tick(1_000);
        if (runtime.snapshot().phase === "actorCommand" || runtime.snapshot().result) return;
      }
    }
    function untilEnemyAction(runtime: ReturnType<typeof createBattleRuntime>, maxTicks = 40): string | undefined {
      let seen = runtime.snapshot().lastActionResult?.skillName;
      for (let i = 0; i < maxTicks; i += 1) {
        if (runtime.snapshot().phase === "actorCommand") runtime.performActorCommand({ kind: "defend" });
        runtime.tick(1_000);
        const next = runtime.snapshot().lastActionResult?.skillName;
        if (next && next !== seen) return next;
        seen = next;
      }
      return runtime.snapshot().lastActionResult?.skillName;
    }
    describe("battle runtime defect regressions", () => {
      it("uses enemy action conditions, priority, and switch effects instead of repeating skillIds[0]", () => {
        const project = battleProject();
        addSkill(project, "skill_attack", "공격");
        addSkill(project, "skill_poison_sting", "독침");
        const enemy = project.database.enemies.find((record) => record.id === "enemy_slime")!;
        enemy.stats = { ...enemy.stats, maxHp: 9999, attack: 1, agility: 999 };
        enemy.actions = [
          { skillId: "skill_attack", priority: 1, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } },
          { skillId: "skill_poison_sting", priority: 100, condition: { kind: "turn", start: 2, interval: 1 }, switchOnAfterAction: { enabled: true, switchId: "sw_poison_used" }, switchOffAfterAction: { enabled: false } },
        ];
        const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: false, canLose: true, rng: () => 0.99 });

        const first = untilEnemyAction(runtime);
        const second = untilEnemyAction(runtime);

        expect(first).toBe("공격");
        expect(second).toBe("독침");
        expect(runtime.snapshot().eventState.switches.sw_poison_used).toBe(true);
      });

      it("rejects insufficient-MP and unlearned skills without consuming the turn", () => {
        const project = battleProject();
        const fire = project.database.skills.find((skill) => skill.id === "skill_fire")!;
        fire.mpCost = { flat: 4, percentMax: 0 };
        const enemy = project.database.enemies.find((record) => record.id === "enemy_slime")!;
        enemy.stats = { ...enemy.stats, maxHp: 9999 };
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: true,
          canLose: true,
          party: {
            levels: { actor_hero: 1 },
            experience: {},
            vitals: { actor_hero: { hp: 500, mp: 0 } },
            skillIds: { actor_hero: [] },
            partyActorIds: ["actor_hero"],
          },
        });
        untilActorCommand(runtime);
        const before = runtime.snapshot();
        const hpBefore = before.enemies[0]?.hp ?? 0;

        runtime.performActorCommand({ kind: "skill", skillId: "skill_fire", targetEnemyId: "enemy-1" });

        const snap = runtime.snapshot();
        expect(snap.phase).toBe("actorCommand");
        expect(snap.actors[0]?.mp).toBe(0);
        expect(snap.lastActionResult).toBe(before.lastActionResult);
        expect(snap.actionLog).toHaveLength(before.actionLog.length);
        expect(snap.timeline).toHaveLength(before.timeline.length);
        expect(snap.enemies[0]?.hp).toBe(hpBefore);
      });

      it("includes session-learned skills by level and session, and excludes future skills", () => {
        const project = battleProject();
        const actor = project.database.actors.find((record) => record.id === "actor_hero")!;
        actor.learnedSkills = [
          { level: 1, skillId: "skill_attack" },
          { level: 5, skillId: "skill_fire" },
        ];
        for (const klass of project.database.classes) klass.learnedSkills = [];
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: true,
          canLose: true,
          party: { levels: { actor_hero: 1 }, experience: {}, skillIds: { actor_hero: ["skill_heal"] }, partyActorIds: ["actor_hero"] },
        });

        expect(runtime.snapshot().actors[0]?.skillIds).toEqual(expect.arrayContaining(["skill_attack", "skill_heal"]));
        expect(runtime.snapshot().actors[0]?.skillIds).not.toContain("skill_fire");
      });

      it("adds equipped stat bonuses to battle actor stats", () => {
        const project = battleProject();
        project.database.actors.find((record) => record.id === "actor_hero")!.initialEquipment = {};
        project.database.enemies.find((record) => record.id === "enemy_slime")!.stats.maxHp = 999;
        const session = startSession(project);
        session.actorEquipment.actor_hero = { weapon: "equip_sword" };
        const sword = project.database.equipment.find((record) => record.id === "equip_sword")!;
        sword.statBonuses.attack = 30;

        const plain = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true });
        const equipped = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: true,
          canLose: true,
          party: { levels: session.actorLevels, experience: session.actorExperience, equipment: session.actorEquipment, partyActorIds: ["actor_hero"] },
        });

        expect(equipped.snapshot().actors[0]!.maxHp).toBe(plain.snapshot().actors[0]!.maxHp);
        expect(equipped.snapshot().actors[0]!.skillIds).toEqual(plain.snapshot().actors[0]!.skillIds);
        untilActorCommand(plain);
        untilActorCommand(equipped);
        const plainHp = plain.snapshot().enemies[0]!.hp;
        const equippedHp = equipped.snapshot().enemies[0]!.hp;
        plain.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
        equipped.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
        expect(equippedHp - equipped.snapshot().enemies[0]!.hp).toBeGreaterThan(plainHp - plain.snapshot().enemies[0]!.hp);
      });

      it("uses structured state runtime effects instead of Korean description strings", () => {
        const project = battleProject();
        project.database.states.push({
          id: "state_stun_en",
          name: "Stun",
          restriction: "free-form author text",
          runtimeEffects: { restrictsAction: true, attackMultiplier: 3, removeOnBattleEnd: true },
        });
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: true,
          canLose: true,
          party: { levels: { actor_hero: 1 }, experience: {}, stateIds: { actor_hero: ["state_stun_en"] }, partyActorIds: ["actor_hero"] },
        });

        runtime.tick(1_000);

        expect(runtime.snapshot().phase).toBe("charging");
        expect(runtime.snapshot().activeActorId).toBeUndefined();
      });

      it("excludes unrevealed hidden enemies from victory rewards", () => {
        const project = battleProject();
        const troop = project.database.troops.find((record) => record.id === "troop_slime")!;
        // 이 테스트의 핵심은 "숨겨진 드래곤이 보상에서 제외되는가"이다.
        // 슬라임 HP를 1로 낮춰 한 번의 공격으로 승리하게 만든다(fixture 기본 HP 220 회귀와 무관).
        const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
        slime.stats = { ...slime.stats, maxHp: 1 };
        troop.members = [
          { enemyId: "enemy_slime", x: 120, y: 120, hidden: false },
          { enemyId: "enemy_dragon", x: 180, y: 120, hidden: true },
        ];
        const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true });
        untilActorCommand(runtime);
        runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });

        const slimeReward = project.database.enemies.find((record) => record.id === "enemy_slime")!.rewards;
        expect(runtime.snapshot().result).toBe("victory");
        expect(runtime.snapshot().rewards.exp).toBe(slimeReward.exp);
        expect(runtime.snapshot().rewards.gold).toBe(slimeReward.gold);
      });

      it("does not damage when an element rate is nullified", () => {
        const project = battleProject();
        project.database.elements = [{ id: "void", name: "Void", kind: "magical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } }];
        project.database.enemies[0]!.elementRates = { void: "E" };
        project.database.enemies[0]!.stats = { ...project.database.enemies[0]!.stats, maxHp: 999 };
        project.database.skills.push({
          id: "skill_void",
          name: "Void",
          scope: "enemy",
          power: 999,
          description: "",
          type: "normal",
          mpCost: { flat: 0, percentMax: 0 },
          successRate: 100,
          variance: 0,
          hitRate: 100,
          effect: { kind: "damage", statistic: "mind", affects: "hp" },
          elementId: "void",
        });
        project.database.actors[0]!.learnedSkills.push({ level: 1, skillId: "skill_void" });
        const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true });
        untilActorCommand(runtime);
        const hpBefore = runtime.snapshot().enemies[0]!.hp;

        runtime.performActorCommand({ kind: "skill", skillId: "skill_void", targetEnemyId: "enemy-1" });

        expect(runtime.snapshot().lastActionResult?.amount).toBe(0);
        expect(runtime.snapshot().enemies[0]!.hp).toBe(hpBefore);
      });

      it("targets enemy-side allies when an enemy uses a healing skill", () => {
        const project = battleProject();
        addSkill(project, "skill_heal", "Heal", "healing");
        const healer = project.database.enemies.find((record) => record.id === "enemy_slime")!;
        healer.stats = { ...healer.stats, maxHp: 999, maxMp: 999, agility: 999 };
        healer.actions = [{ skillId: "skill_heal", priority: 100, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
        const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: false, canLose: true });
        const actorHp = runtime.snapshot().actors[0]!.hp;

        untilEnemyAction(runtime);

        expect(runtime.snapshot().lastActionResult?.targetId).toBe("enemy-1");
        expect(runtime.snapshot().actors[0]!.hp).toBe(actorHp);
      });

      it("revives a downed enemy ally on the next round instead of attacking", () => {
        const project = battleProject();
        project.database.skills.push({
          id: "skill_revive",
          name: "부활",
          scope: "ally",
          power: 40,
          description: "",
          type: "normal",
          mpCost: { flat: 0, percentMax: 0 },
          successRate: 100,
          variance: 0,
          hitRate: 100,
          effect: { kind: "healing", statistic: "mind", affects: "hp" },
          stateEffects: [{ stateId: "state_death", chance: 100, operation: "remove" }],
        });
        const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
        slime.stats = { ...slime.stats, maxHp: 999, maxMp: 20, attack: 1, defense: 1, mind: 30, agility: 1 };
        // 1라운드는 통상 공격만. 부활은 2라운드부터 — strict 는 라운드 시작에 행동을 고르므로
        // 같은 라운드에 쓰러진 동료는 다음 라운드에 일으킨다.
        slime.actions = [
          { skillId: "", priority: 1, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } },
          { skillId: "skill_revive", priority: 50, condition: { kind: "turn", start: 2, interval: 1 }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } },
        ];
        const dragon = project.database.enemies.find((record) => record.id === "enemy_dragon")!;
        dragon.stats = { ...dragon.stats, maxHp: 1, maxMp: 1, attack: 1, defense: 0, mind: 1, agility: 1 };
        dragon.skillIds = [];
        dragon.actions = [];
        const troop = project.database.troops.find((record) => record.id === "troop_slime")!;
        troop.members = [
          { enemyId: "enemy_slime", x: 80, y: 100, hidden: false },
          { enemyId: "enemy_dragon", x: 120, y: 100, hidden: false },
        ];
        const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0 });
        const dragonId = runtime.snapshot().enemies.find((enemy) => enemy.recordId === "enemy_dragon")!.id;
        const slimeId = runtime.snapshot().enemies.find((enemy) => enemy.recordId === "enemy_slime")!.id;

        runtime.performActorCommand({ kind: "attack", targetEnemyId: dragonId });

        expect(runtime.snapshot().result).toBeUndefined();
        expect(runtime.snapshot().enemies.find((enemy) => enemy.id === dragonId)?.hp).toBe(0);
        expect(runtime.snapshot().phase).toBe("actorCommand");

        runtime.performActorCommand({ kind: "attack", targetEnemyId: slimeId });

        const revived = runtime.snapshot().enemies.find((enemy) => enemy.id === dragonId);
        expect(revived?.hp).toBeGreaterThan(0);
        expect(runtime.snapshot().timeline.some((entry) => entry.kind === "healing" && entry.targetId === dragonId && entry.side === "enemy")).toBe(true);
      });

      it("auto battle revives a downed ally and a plain heal does not", () => {
        const project = battleProject();
        project.database.skills.push(
          {
            id: "skill_revive",
            name: "부활",
            scope: "ally",
            power: 40,
            description: "",
            type: "normal",
            mpCost: { flat: 0, percentMax: 0 },
            successRate: 100,
            variance: 0,
            hitRate: 100,
            effect: { kind: "healing", statistic: "mind", affects: "hp" },
            stateEffects: [{ stateId: "state_death", chance: 100, operation: "remove" }],
          },
          {
            id: "skill_heal",
            name: "치유",
            scope: "ally",
            power: 40,
            description: "",
            type: "normal",
            mpCost: { flat: 0, percentMax: 0 },
            successRate: 100,
            variance: 0,
            hitRate: 100,
            effect: { kind: "healing", statistic: "mind", affects: "hp" },
          },
        );
        const hero = project.database.actors[0]!;
        project.database.actors.push({ ...hero, id: "actor_ally", name: "동료" });
        const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
        slime.stats = { ...slime.stats, maxHp: 999, attack: 1, agility: 1 };
        const party = {
          levels: { actor_hero: 1, actor_ally: 1 },
          experience: {},
          partyActorIds: ["actor_hero", "actor_ally"],
          vitals: { actor_hero: { hp: 9999, mp: 30 }, actor_ally: { hp: 0, mp: 0 } },
        };
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: false,
          canLose: true,
          battleFlow: "strict",
          rng: () => 0,
          party: { ...party, skillIds: { actor_hero: ["skill_revive"] } },
        });
        const before = runtime.snapshot();
        expect(before.actors.find((actor) => actor.recordId === "actor_ally")?.hp).toBe(0);
        const command = chooseAutoBattleCommand(project, before, () => 0);
        expect(command).toMatchObject({ kind: "skill", skillId: "skill_revive", targetActorId: "actor_ally" });
        expect(chooseAutoBattleCommand(project, before, () => 0, "attackAll")).not.toMatchObject({ skillId: "skill_revive" });

        runtime.performActorCommand(command!);
        expect(runtime.snapshot().actors.find((actor) => actor.recordId === "actor_ally")?.hp).toBeGreaterThan(0);

        const healRuntime = createBattleRuntime({
          project,
          troopId: "troop_slime",
          canEscape: false,
          canLose: true,
          battleFlow: "strict",
          rng: () => 0,
          party: { ...party, skillIds: { actor_hero: ["skill_heal"] } },
        });
        const healCommand = chooseAutoBattleCommand(project, healRuntime.snapshot(), () => 0);
        expect(healCommand).not.toMatchObject({ targetActorId: "actor_ally" });
      });

      it("does not auto-win when all troop members start hidden", () => {
        const project = battleProject();
        const troop = project.database.troops.find((record) => record.id === "troop_slime")!;
        troop.members = [
          { enemyId: "enemy_slime", x: 120, y: 120, hidden: true },
          { enemyId: "enemy_dragon", x: 180, y: 120, hidden: true },
        ];
        const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: true, canLose: true, rng: () => 0.5 });
        // 전원 hidden 이면 가시 적이 0명. 빈 배열에 every() 가 true 를 반환해 즉시 승리 처리되는
        // 함정을 막았는지 확인한다 — reveal 이벤트를 기다리며 전투는 미종료 상태여야 한다.
        expect(runtime.snapshot().enemies.length).toBe(0);
        expect(runtime.snapshot().result).toBeUndefined();
        expect(runtime.snapshot().phase).not.toBe("resolved");
      });
    });
    describe("battle authoring tool reference guards", () => {
      it("rejects upsert_troop members that reference missing enemies with known id hints", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const result = runTool(ctx, "upsert_troop", { troop: { id: "troop_ghost", name: "유령", enemyIds: ["enemy_missing"] } }, { dryRun: false });

        expect(result.ok).toBe(false);
        expect(result.issues?.[0]?.code).toBe("enemy-not-found");
        expect(result.issues?.[0]?.message).toContain("허용 예시");
        expect(ctx.project.database.troops.some((troop) => troop.id === "troop_ghost")).toBe(false);
      });

      it("rejects place_battle_blocker troop ids that do not exist", () => {
        const ctx: ToolContext = { project: createBlankProject() };
        const mapId = ctx.project.startMapId;
        const result = runTool(ctx, "place_battle_blocker", { mapId, x: 1, y: 1, troopId: "troop_missing" }, { dryRun: false });

        expect(result.ok).toBe(false);
        expect(result.issues?.[0]?.code).toBe("troop-not-found");
        expect(result.issues?.[0]?.message).toContain("허용 예시");
      });
    });
  });
  // 2026-09-24 추격 호러 도그푸딩: 실내 칩셋의 패턴 없는 벽으로 build_wall 을 8번 반복했다.
  describe("buildWallPatternHint", () => {
    isolateTimers();
    describe("build_wall 패턴 없는 벽 재료", () => {
      it("쓸 수 있는 경로(build_hand_interior_room)를 짚고 같은 재료 재시도를 막는다", () => {
        const ctx = { project: withRetiredEasyRpgTilesets(createBlankProject()) };
        const mapId = ctx.project.startMapId;
        // 새 프로젝트의 시작 맵은 버들항 칸 번호로 칠해져 있다 — 실내 칩셋으로 바꾸면 시작 칸이 막혀 커밋이 거부된다.
        // 실내 칩셋의 통행 가능한 칸으로 비워 두고 바꾼다.
        const map = ctx.project.maps[mapId]!;
        const passable = ctx.project.tilesets.easyrpg_chipset_interior!.passability.findIndex((p) => p.up && p.down && p.left && p.right);
        map.lowerTiles = map.lowerTiles.map(() => passable);
        map.upperTiles = map.upperTiles.map(() => -1);
        const set = runTool(ctx, "set_map_properties", { mapId, tilesetId: "easyrpg_chipset_interior" });
        expect(set.ok, set.summary).toBe(true);
        const result = runTool(ctx, "build_wall", { mapId, rect: { x: 0, y: 0, w: 20, h: 2 }, material: "크림 회벽" });
        expect(result.ok).toBe(false);
        const text = [result.summary, ...(result.issues ?? []).map((issue) => issue.message)].join(" ");
        // place_concept 은 제거됐고, 실내 방 안내는 손 도트 실내 도구로 바뀌었다.
        expect(text).toContain("build_hand_interior_room");
        expect(text).toContain("같은 재료로 다시 부르지 마세요");
        expect(text).not.toContain("T1b 위저드");
      });
    });
  });
});
