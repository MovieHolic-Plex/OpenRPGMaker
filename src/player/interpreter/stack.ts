import type { Command } from "@/project/types";
import type { Frame, InterpreterState, ResumeAdvance } from "@/player/interpreter/types";

export function topFrame(stack: Frame[]): Frame | null {
  return stack.length > 0 ? stack[stack.length - 1] ?? null : null;
}

export function pushFrame(state: InterpreterState, commands: Command[]): boolean {
  if (commands.length && state.stack.length >= state.maxStackDepth) state.onUnverified?.("Interpreter stack budget exhausted");
  if (commands.length === 0 || state.stack.length >= state.maxStackDepth) return false;
  state.stack.push({ commands, pc: 0 });
  return true;
}

// 루프 본문 프레임을 push 한다. ownerCommands/ownerPc 는 이 프레임이 끝났을 때
// 다시 실행을 재개할 부모 루프 명령의 위치이다(breakLoop 처리와 재진입에 사용).
// iterations 는 지금까지 완료된 이 루프의 반복 수 — 재진입 시 이어서 센다.
export function pushLoopFrame(
  state: InterpreterState,
  body: Command[],
  ownerCommands: Command[],
  ownerPc: number,
  iterations = 0
): boolean {
  if (body.length && state.stack.length >= state.maxStackDepth) state.onUnverified?.("Interpreter stack budget exhausted");
  if (body.length === 0 || state.stack.length >= state.maxStackDepth) return false;
  state.stack.push({ commands: body, pc: 0, loopOwner: { commands: ownerCommands, pc: ownerPc, iterations } });
  return true;
}

export function advanceCompletedFrame(state: InterpreterState): ResumeAdvance {
  const completed = state.stack.pop();
  // 루프 본문 프레임이 정상적으로 끝났다면(breakLoop 없이) 다시 body 를 push.
  if (completed?.loopOwner) {
    const iterations = completed.loopOwner.iterations + 1;
    if (iterations >= state.maxLoopIterations) {
      state.onUnverified?.("Interpreter loop budget exhausted");
      // 가드 도달: 루프를 종료한다. 부모 프레임의 pc 는 loop 명령 실행 시
      // 이미 loop 다음 명령으로 옮겨져 있으므로(see commandCatalog case "loop"),
      // 여기서 pc 를 더 건드리지 않고 그대로 진행한다.
      console.warn("[interpreter] 루프 최대 반복 횟수 도달, 루프를 종료합니다");
      const parent = topFrame(state.stack);
      if (!parent) return "done";
      return "continue";
    }
    pushLoopFrame(state, completed.commands, completed.loopOwner.commands, completed.loopOwner.pc, iterations);
    return "continue";
  }
  const parent = topFrame(state.stack);
  if (!parent) return "done";
  parent.pc += 1;
  return "continue";
}

export function hasLoopFrame(state: InterpreterState): boolean {
  return state.stack.some((frame) => Boolean(frame.loopOwner));
}

// breakLoop: 가장 가까운 루프 본문 프레임(과 그 아래 자식 프레임)을 모두 제거하고
// 루프 명령 다음으로 진행한다. 루프 프레임이 없으면 경고를 남기고 아무 일도 하지 않는다.
export function breakLoop(state: InterpreterState): boolean {
  let loopIndex = -1;
  for (let i = state.stack.length - 1; i >= 0; i -= 1) {
    if (state.stack[i]?.loopOwner) { loopIndex = i; break; }
  }
  if (loopIndex < 0) {
    console.warn("[interpreter] breakLoop 호출: 루프 밖에서 무시됨");
    return false;
  }
  while (state.stack.length > loopIndex + 1) {
    state.stack.pop();
  }
  const frame = state.stack.pop();
  if (!frame?.loopOwner) return false;
  const owner = topFrame(state.stack);
  if (owner && owner.commands === frame.loopOwner.commands) {
    owner.pc = frame.loopOwner.pc + 1;
  }
  return true;
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
