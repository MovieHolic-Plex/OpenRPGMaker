import type { InterpreterState, PendingStep, ResumeAdvance, ResumeValue } from "@/player/interpreter/types";
import { pushFrame, topFrame } from "@/player/interpreter/stack";
import { clampName } from "@/player/nameEntry/hangulTable";
import { changeActorName } from "@/project/sessionActorCommands";

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
  } else if (pending === "enterHeroName") {
    // 이름 입력 결과(문자열)를 세션 오버라이드에 반영한다(프로젝트 DB 는 원복 유지).
    // 빈 이름이면 오버라이드를 설정하지 않아 기존(DB 또는 이전 오버라이드) 이름을 유지한다.
    const command = frame.commands[frame.pc];
    if (command?.kind === "enterHeroName" && typeof value === "string" && value.trim().length > 0) {
      changeActorName(state.session, command.actorId, clampName(value, command.maxLength));
    }
    frame.pc += 1;
  } else if (pending === "inputWait") {
    // Key Input Processing: variableId 가 있으면 눌린 키 코드를 변수에 저장.
    const command = frame.commands[frame.pc];
    if (command?.kind === "inputWait" && command.variableId) {
      state.session.variables[command.variableId] = typeof value === "number" ? value : 0;
    }
    frame.pc += 1;
  } else {
    frame.pc += 1;
    if (pending === "transfer") return "done";
  }
  return "continue";
}
