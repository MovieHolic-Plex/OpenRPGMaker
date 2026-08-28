import type { Command, Project } from "@/project/types";
import { executeCommand } from "@/player/interpreter/commandCatalog";
import { advanceResume } from "@/player/interpreter/resume";
import { advanceCompletedFrame, gotoLabel, topFrame } from "@/player/interpreter/stack";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import type {
  Interpreter,
  InterpreterOptions,
  InterpreterState,
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
  const state: InterpreterState = {
    stack: [{ commands, pc: 0 }],
    session,
    maxStackDepth: 1000,
    maxLoopIterations: options?.maxLoopIterations ?? 100000,
    maxInstructions: Math.max(1, Math.trunc(options?.maxInstructions ?? 100000)),
    instructionsExecuted: 0,
    currentEventId: options?.currentEventId,
    onFactionStanceChanged: options?.onFactionStanceChanged,
    project,
  };
  let done = false;
  let pending: PendingStep | "none" = "none";

  function finish(): StepResult {
    done = true;
    return { kind: "done" };
  }

  function run(): StepResult {
    while (true) {
      const frame = topFrame(state.stack);
      if (!frame) return finish();
      if (frame.pc >= frame.commands.length) {
        if (advanceCompletedFrame(state) === "done") return finish();
        continue;
      }

      const command = frame.commands[frame.pc] ?? null;
      if (!command) return finish();
      if (state.instructionsExecuted >= state.maxInstructions) {
        console.warn(
          `[interpreter:instruction-budget-exhausted] maxInstructions=${state.maxInstructions} executed=${state.instructionsExecuted}`
        );
        return finish();
      }
      state.instructionsExecuted += 1;
      const result = executeCommand(state, frame, command);
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
      const result = advanceResume(state, pending, value);
      if (result === "done") return finish();
      pending = "none";
      return run();
    },
    skip(): StepResult {
      if (done) return { kind: "done" };
      // pending(블로킹 단계)을 무시하고 현재 프레임의 pc 만 전진시킨다.
      const frame = topFrame(state.stack);
      if (frame) frame.pc += 1;
      pending = "none";
      return run();
    },
    jumpToLabel(name: string): StepResult {
      if (done) return { kind: "done" };
      if (!gotoLabel(state.stack, name)) return { kind: "done" };
      pending = "none";
      return run();
    },
    isDone(): boolean {
      return done;
    },
  };
}
