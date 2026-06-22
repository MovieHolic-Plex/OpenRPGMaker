import type { InterpreterState, PendingStep, ResumeAdvance, ResumeValue } from "@/player/interpreter/types";
import { pushFrame, topFrame } from "@/player/interpreter/stack";

export function advanceResume(
  state: InterpreterState,
  pending: PendingStep | "none",
  value: ResumeValue
): ResumeAdvance {
  const frame = topFrame(state.stack);
  if (!frame) return "done";

  if (pending === "choices") {
    const command = frame.commands[frame.pc];
    if (command?.kind === "choices") {
      const index = typeof value === "number" ? value : 0;
      const option = command.options[index];
      if (option) {
        pushFrame(state, option.branch);
      } else {
        frame.pc += 1;
      }
    }
  } else {
    frame.pc += 1;
    if (pending === "transfer") return "done";
  }
  return "continue";
}
