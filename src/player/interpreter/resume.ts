import { teleportMenuEntries } from "@/project/teleportPoints";
import type { InterpreterState, PendingStep, ResumeAdvance, ResumeValue } from "@/player/interpreter/types";
import { pushFrame, topFrame } from "@/player/interpreter/stack";
import { presentItemBranch } from "@/player/interpreter/presentItem";
import { clampName } from "@/player/nameEntry/hangulTable";
import { changeActorName } from "@/project/sessionActorCommands";

export function advanceResume(
  state: InterpreterState,
  pending: PendingStep | "none",
  value: ResumeValue
): ResumeAdvance {
  // A terminal result ends the whole event, including callers of a common event.
  if (pending === "gameOver" || pending === "returnToTitle") return "done";
  const frame = topFrame(state.stack);
  if (!frame) return "done";

  if (pending === "waitUntil" && state.waitUntil) {
    state.waitUntil.elapsedMs += state.waitUntil.intervalMs;
    // Polling a suspended instruction must not consume the script instruction budget.
    state.instructionsExecuted -= 1;
    return "continue";
  }

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
  } else if (pending === "presentItem") {
    const command = frame.commands[frame.pc];
    if (command?.kind === "presentItem") {
      if (!pushFrame(state, presentItemBranch(state.session, command, value))) frame.pc += 1;
    } else {
      frame.pc += 1;
    }
  } else if (pending === "shop") {
    const command = frame.commands[frame.pc];
    if (command?.kind === "shop") {
      if (
        command.branchOnTransaction === true &&
        value === true &&
        pushFrame(state, command.transactionBranch ?? [])
      ) {
        return "continue";
      }
      if (
        command.branchOnFailedTransaction === true &&
        value === "failed" &&
        pushFrame(state, command.failedTransactionBranch ?? [])
      ) {
        return "continue";
      }
    }
    frame.pc += 1;
  } else if (pending === "inn") {
    const command = frame.commands[frame.pc];
    if (
      command?.kind === "inn" &&
      command.branchOnNotEnoughGold === true &&
      value === "notEnough" &&
      pushFrame(state, command.notEnoughBranch ?? [])
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
    if (command?.kind === "enterHeroName" && command.stringVariableId) {
      // 자유 텍스트 입력: 빈 문자열도 그대로 기록한다(작가가 '아무것도 안 씀' 을 분기할 수 있게).
      state.session.stringVariables ??= {};
      state.session.stringVariables[command.stringVariableId] = typeof value === "string" ? clampName(value, command.maxLength) : "";
    } else if (command?.kind === "enterHeroName" && typeof value === "string" && value.trim().length > 0) {
      changeActorName(state.session, command.actorId, clampName(value, command.maxLength));
    }
    frame.pc += 1;
  } else if (pending === "timedChoice" || pending === "quickTimeEvent" || pending === "teleportMenu") {
    // 명작 공백 #1·#24: 결과(숫자)를 m2 명령의 resultVariableId/resultSwitchId 에 쓴다.
    const command = frame.commands[frame.pc];
    if (command?.kind === "m2Command") {
      const result = typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0;
      const resultVariableId = typeof command.fields.resultVariableId === "string" ? command.fields.resultVariableId : "";
      if (resultVariableId) state.session.variables[resultVariableId] = result;
      const resultSwitchId = typeof command.fields.resultSwitchId === "string" ? command.fields.resultSwitchId : "";
      if (resultSwitchId && pending === "quickTimeEvent") state.session.switches[resultSwitchId] = result > 0;
      // 순간이동 메뉴: 고른 지점으로 옮기는 것은 일반 transfer 명령으로 한다 — 이동 뒤 이벤트 이어짐
      // (continueAfterTransfer)·페이드·맵 로드가 기존 경로를 그대로 탄다. 결과 변수는 이동 전에 이미 적혔다.
      if (pending === "teleportMenu" && result > 0 && command.fields.transfer !== false && command.fields.transfer !== "false") {
        const point = teleportMenuEntries(state.session, state.project?.maps ?? {})[result - 1]?.point;
        frame.pc += 1;
        if (point) pushFrame(state, [{ kind: "transfer", mapId: point.mapId, x: point.x, y: point.y, fade: "black" }]);
        return "continue";
      }
    }
    frame.pc += 1;
  } else if (pending === "inputWait") {
    // Key Input Processing: variableId 가 있으면 눌린 키 코드를 변수에 저장.
    const command = frame.commands[frame.pc];
    if (command?.kind === "inputWait" && command.variableId) {
      state.session.variables[command.variableId] = typeof value === "number" ? value : 0;
    }
    frame.pc += 1;
  } else if (pending === "tacticsBattle") {
    const command = frame.commands[frame.pc];
    if (command?.kind === "tacticsBattle") {
      const result = typeof value === "string" ? value : state.session.battleResult;
      const branch = result === "victory" ? command.victoryBranch : result === "defeat" ? command.defeatBranch : undefined;
      if (branch?.length && pushFrame(state, branch)) {
        // A can-lose defeat branch commonly transfers the party to a clinic
        // and then runs recoverAll. Transfer is terminal for ordinary authored
        // events, but this branch owns the post-battle continuation explicitly.
        if (result === "defeat") state.continueAfterTransfer = true;
        return "continue";
      }
    }
    frame.pc += 1;
  } else if (pending === "battleProcessing") {
    const command = frame.commands[frame.pc];
    if (command?.kind === "battleProcessing" && command.branchOnResult === true) {
      const result = typeof value === "string" ? value : state.session.battleResult;
      const branch =
        result === "victory" ? command.victoryBranch
          : result === "defeat" ? command.defeatBranch
            : result === "escape" ? command.escapeBranch
              : undefined;
      if (branch?.length && pushFrame(state, branch)) {
        if (result === "defeat") state.continueAfterTransfer = true;
        return "continue";
      }
    }
    frame.pc += 1;
  } else {
    frame.pc += 1;
    if (pending === "transfer" && !state.continueAfterTransfer) return "done";
  }
  return "continue";
}
