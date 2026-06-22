import type { Command } from "@/project/types";
import type { Frame, InterpreterState, ResumeAdvance } from "@/player/interpreter/types";

export function topFrame(stack: Frame[]): Frame | null {
  return stack.length > 0 ? stack[stack.length - 1] ?? null : null;
}

export function pushFrame(state: InterpreterState, commands: Command[]): boolean {
  if (commands.length === 0 || state.stack.length >= state.maxStackDepth) return false;
  state.stack.push({ commands, pc: 0 });
  return true;
}

export function advanceCompletedFrame(state: InterpreterState): ResumeAdvance {
  state.stack.pop();
  const parent = topFrame(state.stack);
  if (!parent) return "done";
  parent.pc += 1;
  return "continue";
}

export function gotoLabel(stack: Frame[], name: string): boolean {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const frame = stack[i];
    if (!frame) continue;
    for (let j = 0; j < frame.commands.length; j += 1) {
      const command = frame.commands[j];
      if (command?.kind === "label" && command.name === name) {
        stack.length = i + 1;
        frame.pc = j;
        return true;
      }
    }
  }
  return false;
}
