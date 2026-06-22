import type { Command } from "@/project/types";
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
  session: PlaySessionLike
): Interpreter {
  const state: InterpreterState = {
    stack: [{ commands, pc: 0 }],
    session,
    maxStackDepth: 32,
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
    isDone(): boolean {
      return done;
    },
  };
}
