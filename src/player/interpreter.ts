import type { Command, Project } from "@/project/types";
import { executeCommand } from "@/player/interpreter/commandCatalog";
import { advanceResume } from "@/player/interpreter/resume";
import { advanceCompletedFrame, topFrame } from "@/player/interpreter/stack";
import type { PlaySessionLike } from "@/player/types";
import type {
  Interpreter,
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
  options?: { maxLoopIterations?: number; currentEventId?: string }
): Interpreter {
  const state: InterpreterState = {
    stack: [{ commands, pc: 0 }],
    session,
    maxStackDepth: 1000,
    maxLoopIterations: options?.maxLoopIterations ?? 100000,
    currentEventId: options?.currentEventId,
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
    isDone(): boolean {
      return done;
    },
  };
}
