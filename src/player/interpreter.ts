import type { Command, Project } from "@/project/types";
import { resolveAppearancePortrait } from "@/project/characterAppearances";
import { runtimeEventViewById } from "@/project/runtimeEventState";
import { executeCommand } from "@/player/interpreter/commandCatalog";
import { advanceResume } from "@/player/interpreter/resume";
import { disposeScriptRuns } from "@/player/interpreter/scriptCommand";
import { advanceCompletedFrame, gotoLabel, hasLabel, topFrame, withLabelIndexPass, invalidateLabelIndexPass } from "@/player/interpreter/stack";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import type {
  Interpreter,
  InterpreterOptions,
  InterpreterState,
  InterpreterTraceFrame,
  PendingStep,
  ResumeValue,
  StepResult,
} from "@/player/interpreter/types";

export type { Interpreter, ResumeValue, StepResult } from "@/player/interpreter/types";

export function createInterpreter(
  commands: Command[],
  session: PlaySessionLike,
  project?: Project,
  options?: InterpreterOptions
): Interpreter {
  const map = project?.maps[session.currentMapId];
  const event = project && map && options?.currentEventId
    ? runtimeEventViewById(project, map, session, options.eventPositions ?? {}, options.currentEventId)
    : undefined;
  const state: InterpreterState = {
    beforeCommand: options?.beforeCommand,
    onUnverified: options?.onUnverified,
    continueAfterTransfer: options?.continueAfterTransfer,
    currentFace: project ? resolveAppearancePortrait(project, event?.page?.graphic.appearanceId, "face") : undefined,
    stack: [{ commands, pc: 0 }],
    session,
    maxStackDepth: 1000,
    maxLoopIterations: options?.maxLoopIterations ?? 100000,
    maxInstructions: Math.max(1, Math.trunc(options?.maxInstructions ?? 100000)),
    instructionsExecuted: 0,
    currentEventId: options?.currentEventId,
    get eventPositions() { return options?.getEventPositions?.() ?? options?.eventPositions; },
    isEventIdle: options?.isEventIdle,
    onFactionStanceChanged: options?.onFactionStanceChanged,
    onFriendshipChanged: options?.onFriendshipChanged,
    project,
  };
  let done = false;
  let pending: PendingStep | "none" = "none";
  // 테스트 플레이 계측(eventRunLog). 내보낸 게임에서는 undefined 라 명령마다 이 검사 하나만 남는다.
  const trace = options?.trace;
  // 「한 단계」로 멈췄다 풀린 명령은 다시 멈추지 않고 한 번 실행한다.
  let stepReleased = false;
  const traceFrame = (): InterpreterTraceFrame => {
    const top = topFrame(state.stack);
    return { depth: state.stack.length - 1, pc: top?.pc ?? 0, top: top?.commands };
  };

  function finish(): StepResult {
    done = true;
    disposeScriptRuns(state);
    return { kind: "done" };
  }

  function run(): StepResult {
    return withLabelIndexPass(runCommands);
  }

  function runCommands(): StepResult {
    while (true) {
      const frame = topFrame(state.stack);
      if (!frame) return finish();
      if (frame.pc >= frame.commands.length) {
        invalidateLabelIndexPass(); // loop-budget callbacks may edit commands before the parent resumes
        if (advanceCompletedFrame(state) === "done") return finish();
        continue;
      }

      const command = frame.commands[frame.pc] ?? null;
      if (!command) return finish();
      if (state.instructionsExecuted >= state.maxInstructions) {
        state.onUnverified?.("Interpreter instruction budget exhausted");
        console.warn(
          `[interpreter:instruction-budget-exhausted] maxInstructions=${state.maxInstructions} executed=${state.instructionsExecuted}`
        );
        return finish();
      }
      state.instructionsExecuted += 1;
      // All other commands and hooks are conservative mutation boundaries. Never trust a
      // cache across user callbacks, yielded steps, or arbitrary authored command execution.
      if (state.beforeCommand || (command.kind !== "label" && command.kind !== "gotoLabel")) invalidateLabelIndexPass();
      let afterTrace: ((after: InterpreterTraceFrame) => void) | void = undefined;
      if (trace) {
        const at = traceFrame();
        // 컷신 빨리 감기 중에는 멈추지 않는다 — 건너뛰기가 명령마다 멈춤을 풀며 상한을 소진하지 않게.
        if (!stepReleased && state.fastForwardLabel === undefined && trace.shouldPause?.(command, at)) {
          state.instructionsExecuted -= 1;
          pending = "debugStep";
          return { kind: "debugStep" };
        }
        stepReleased = false;
        afterTrace = trace.enter(command, at);
      }
      const result = executeCommand(state, frame, command);
      afterTrace?.(traceFrame());
      switch (result.kind) {
        case "continue":
          continue;
        case "done":
          return finish();
        case "pause":
          pending = result.pending;
          return result.step;
      }
    }
  }

  return {
    start(): StepResult {
      if (done) return { kind: "done" };
      pending = "none";
      return run();
    },
    resume(value: ResumeValue): StepResult {
      if (done) return { kind: "done" };
      if (pending === "debugStep") {
        // 멈춘 명령은 아직 실행 전이다 — pc 를 옮기지 않고 그 명령부터 다시 돈다.
        pending = "none";
        stepReleased = true;
        return run();
      }
      const result = advanceResume(state, pending, value);
      if (result === "done") return finish();
      pending = "none";
      return run();
    },
    skip(): StepResult {
      if (done) return { kind: "done" };
      state.waitUntil = undefined;
      // pending(블로킹 단계)을 무시하고 현재 프레임의 pc 만 전진시킨다.
      const frame = topFrame(state.stack);
      if (frame) frame.pc += 1;
      pending = "none";
      return run();
    },
    jumpToLabel(name: string): StepResult {
      if (done) return { kind: "done" };
      state.waitUntil = undefined;
      if (!gotoLabel(state.stack, name)) return { kind: "done" };
      pending = "none";
      return run();
    },
    beginFastForward(name: string): boolean {
      if (done || !hasLabel(state.stack, name)) return false;
      state.waitUntil = undefined;
      state.fastForwardLabel = name;
      return true;
    },
    isFastForwarding(): boolean {
      return !done && state.fastForwardLabel !== undefined;
    },
    endFastForward(): void {
      state.fastForwardLabel = undefined;
    },
    isDone(): boolean {
      return done;
    },
  };
}
