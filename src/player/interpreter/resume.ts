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
      if (index === -1 && command.cancelBehavior === "branch") {
        if (!pushFrame(state, command.cancelBranch ?? [])) frame.pc += 1;
        return "continue";
      }
      const option = command.options[index];
      if (!option || !pushFrame(state, option.branch)) {
        frame.pc += 1;
      }
    }
  } else if (pending === "shop") {
    const command = frame.commands[frame.pc];
    if (
      command?.kind === "shop" &&
      command.branchOnTransaction === true &&
      value === true &&
      pushFrame(state, command.transactionBranch ?? [])
    ) {
      return "continue";
    }
    frame.pc += 1;
  } else if (pending === "inputNumber") {
    const command = frame.commands[frame.pc];
    if (command?.kind === "inputNumber") {
      state.session.variables[command.variableId] = typeof value === "number" ? value : 0;
    }
    frame.pc += 1;
  } else {
    frame.pc += 1;
    if (pending === "transfer") return "done";
  }
  return "continue";
}
