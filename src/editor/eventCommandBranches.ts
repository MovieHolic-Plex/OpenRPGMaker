// 이벤트 명령의 «분기» 를 한 곳에서 세는 정본.
//
// 왜 이 파일이 생겼나 (실측 2026-08-30): 같은 일을 하는 분기 열거 함수가 다섯 벌 있었고
// 그중 셋이 상점 실패 분기(`failedTransactionBranch`)를 빠뜨렸다.
//   - `panels/eventEditor/previewSimulation.ts:branchesOf` — 단일 원소 early return (미리보기·플로우)
//   - `panels/eventEditor/commandList.ts:appendCommandChildren` — 상수 import 자체가 없었다 (목록)
//   - `eventDraftValidator.ts:commandBranches` — 검증이 그 분기 안으로 들어가지 않았다
//   - `panels/eventEditor/storyboardView.ts:branchesOf` — 정상 (스토리)
//   - `tools/commandTraversal.ts:commandBranches` — 정상, 그런데 뷰는 아무도 안 썼다
// 런타임(`player/interpreter/resume.ts`)은 그 분기를 실행하므로, 실행은 되는데 편집기 세
// 곳에서 안 보이는 명령이 있었다. 라벨도 뷰마다 달라 같은 분기가 «참» / «참일 때» /
// «조건이 맞을 때» / «조건을 만족함» 네 가지로 불렸다.
//
// 규칙 두 개만 지킨다:
//  1. 분기를 새로 만들면 여기에만 추가한다. 뷰는 이 함수를 호출할 뿐 자기 목록을 갖지 않는다.
//  2. 라벨은 «언제 실행되나» 를 답하는 «~때» 꼴로 쓴다. 뷰가 라벨을 다시 쓰지 않는다.
import type { Command } from "@/project/types";
import {
  BATTLE_DEFEAT_BRANCH_INDEX,
  BATTLE_ESCAPE_BRANCH_INDEX,
  BATTLE_VICTORY_BRANCH_INDEX,
  CHOICE_CANCEL_BRANCH_INDEX,
  FORK_ELSE_BRANCH_INDEX,
  FORK_THEN_BRANCH_INDEX,
  INN_NOT_ENOUGH_BRANCH_INDEX,
  LOOP_BODY_BRANCH_INDEX,
  PRESENT_OTHERWISE_BRANCH_INDEX,
  PROMOTE_FAILURE_BRANCH_INDEX,
  PROMOTE_SUCCESS_BRANCH_INDEX,
  SHOP_FAILED_TRANSACTION_BRANCH_INDEX,
  SHOP_TRANSACTION_BRANCH_INDEX,
} from "./eventCommandPaths";

export type EventBranchKind =
  | "choiceOption" | "choiceCancel" | "presentOption" | "presentOtherwise" | "presentCancel" | "forkThen" | "forkElse" | "loopBody"
  | "shopTransaction" | "shopFailure" | "innNotEnough"
  | "promotionSuccess" | "promotionFailure" | "evolutionSuccess" | "evolutionFailure"
  | "battleVictory" | "battleDefeat" | "battleEscape";

/** 목록 뷰의 마커 톤. 분기의 «성격» 이지 색 이름이 아니다. */
export type EventBranchTone = "fork" | "choices" | "shop";

export interface EventCommandBranch {
  readonly kind: EventBranchKind;
  /** 모든 뷰가 이 문자열만 쓴다. 뷰에서 다시 쓰지 말 것. */
  readonly label: string;
  readonly commands: readonly Command[];
  /** `eventCommandPaths` 의 분기 인덱스. 명령 경로의 홀수 번째 칸에 들어간다. */
  readonly branchIndex: number;
  readonly tone: EventBranchTone;
}

/**
 * 분기를 보일지 말지.
 *
 * 배열이 **있으면** 보인다 — 비어 있어도 그렇다. 빈 배열은 «아직 명령이 없는 분기» 이고
 * 저작 대상이므로, 드롭 목표와 검증 대상으로 남아야 한다. 플래그(`branchOnTransaction`
 * 등)가 켜져 있으면 배열이 아직 없어도 보인다.
 *
 * 왜 «비어 있지 않음» 이 아닌가: 그렇게 좁히면 `commandBranches` 로 빈 분기를 찾아
 * 명령을 밀어 넣는 호출부(예: `test/advancedDialogueMerge`, AI 병합 경로)가 분기를 못 찾는다.
 */
function include(flag: boolean | undefined, commands: readonly Command[] | undefined): boolean {
  return flag === true || commands !== undefined;
}

export function eventCommandBranches(command: Command): readonly EventCommandBranch[] {
  switch (command.kind) {
    case "choices": {
      const options = command.options.map((option, index): EventCommandBranch => ({
        kind: "choiceOption",
        label: option.text || `선택지 ${index + 1}`,
        commands: option.branch,
        branchIndex: index,
        tone: "choices",
      }));
      if (!include(command.cancelBehavior === "branch", command.cancelBranch)) return options;
      return [...options, {
        kind: "choiceCancel",
        label: "취소했을 때",
        commands: command.cancelBranch ?? [],
        branchIndex: CHOICE_CANCEL_BRANCH_INDEX,
        tone: "choices",
      }];
    }
    case "presentItem": {
      // 새 명령(eventCommandFactory)은 틀림·닫음 배열을 빈 채로 만들어 두 분기가 늘 보인다.
      const branches = command.options.map((option, index): EventCommandBranch => ({
        kind: "presentOption",
        label: `${option.itemId || `아이템 ${index + 1}`}을(를) 냈을 때`,
        commands: option.branch,
        branchIndex: index,
        tone: "choices",
      }));
      if (include(undefined, command.otherwiseBranch)) {
        branches.push({
          kind: "presentOtherwise",
          label: "다른 것을 냈을 때",
          commands: command.otherwiseBranch ?? [],
          branchIndex: PRESENT_OTHERWISE_BRANCH_INDEX,
          tone: "choices",
        });
      }
      if (include(undefined, command.cancelBranch)) {
        branches.push({
          kind: "presentCancel",
          label: "아무것도 내지 않았을 때",
          commands: command.cancelBranch ?? [],
          branchIndex: CHOICE_CANCEL_BRANCH_INDEX,
          tone: "choices",
        });
      }
      return branches;
    }
    case "fork": {
      const branches: EventCommandBranch[] = [{
        kind: "forkThen",
        label: "조건이 맞을 때",
        commands: command.then,
        branchIndex: FORK_THEN_BRANCH_INDEX,
        tone: "fork",
      }];
      if (command.else) {
        branches.push({
          kind: "forkElse",
          label: "조건이 맞지 않을 때",
          commands: command.else,
          branchIndex: FORK_ELSE_BRANCH_INDEX,
          tone: "fork",
        });
      }
      return branches;
    }
    case "loop":
      return [{
        kind: "loopBody",
        label: "반복할 내용",
        commands: command.body,
        branchIndex: LOOP_BODY_BRANCH_INDEX,
        tone: "fork",
      }];
    case "shop": {
      const branches: EventCommandBranch[] = [];
      if (include(command.branchOnTransaction, command.transactionBranch)) {
        branches.push({
          kind: "shopTransaction",
          label: "거래했을 때",
          commands: command.transactionBranch ?? [],
          branchIndex: SHOP_TRANSACTION_BRANCH_INDEX,
          tone: "shop",
        });
      }
      if (include(command.branchOnFailedTransaction, command.failedTransactionBranch)) {
        branches.push({
          kind: "shopFailure",
          label: "거래하지 못했을 때",
          commands: command.failedTransactionBranch ?? [],
          branchIndex: SHOP_FAILED_TRANSACTION_BRANCH_INDEX,
          tone: "shop",
        });
      }
      return branches;
    }
    case "inn": {
      if (!include(command.branchOnNotEnoughGold, command.notEnoughBranch)) return [];
      return [{
        kind: "innNotEnough",
        label: "골드가 부족할 때",
        commands: command.notEnoughBranch ?? [],
        branchIndex: INN_NOT_ENOUGH_BRANCH_INDEX,
        tone: "shop",
      }];
    }
    case "promoteActor":
      return successFailureBranches(command.successBranch, command.failureBranch, "promotion");
    case "evolveMonster":
      return successFailureBranches(command.successBranch, command.failureBranch, "evolution");
    case "tacticsBattle":
      return [
        { kind: "battleVictory", label: "이겼을 때", commands: command.victoryBranch ?? [], branchIndex: BATTLE_VICTORY_BRANCH_INDEX, tone: "fork" },
        { kind: "battleDefeat", label: "졌을 때", commands: command.defeatBranch ?? [], branchIndex: BATTLE_DEFEAT_BRANCH_INDEX, tone: "fork" },
      ];
    case "battleProcessing": {
      const on = command.branchOnResult;
      const branches: EventCommandBranch[] = [];
      if (include(on, command.victoryBranch)) {
        branches.push({ kind: "battleVictory", label: "이겼을 때", commands: command.victoryBranch ?? [], branchIndex: BATTLE_VICTORY_BRANCH_INDEX, tone: "fork" });
      }
      if (include(on, command.defeatBranch)) {
        branches.push({ kind: "battleDefeat", label: "졌을 때", commands: command.defeatBranch ?? [], branchIndex: BATTLE_DEFEAT_BRANCH_INDEX, tone: "fork" });
      }
      if (include(on, command.escapeBranch)) {
        branches.push({ kind: "battleEscape", label: "도망쳤을 때", commands: command.escapeBranch ?? [], branchIndex: BATTLE_ESCAPE_BRANCH_INDEX, tone: "fork" });
      }
      return branches;
    }
    default:
      return [];
  }
}

/** 승급·진화는 분기 인덱스를 공유하고 라벨만 다르다. */
function successFailureBranches(
  successBranch: Command[] | undefined,
  failureBranch: Command[] | undefined,
  family: "promotion" | "evolution"
): readonly EventCommandBranch[] {
  const branches: EventCommandBranch[] = [];
  if (successBranch) {
    branches.push({
      kind: family === "promotion" ? "promotionSuccess" : "evolutionSuccess",
      label: "성공했을 때",
      commands: successBranch,
      branchIndex: PROMOTE_SUCCESS_BRANCH_INDEX,
      tone: "fork",
    });
  }
  if (failureBranch) {
    branches.push({
      kind: family === "promotion" ? "promotionFailure" : "evolutionFailure",
      label: "실패했을 때",
      commands: failureBranch,
      branchIndex: PROMOTE_FAILURE_BRANCH_INDEX,
      tone: "fork",
    });
  }
  return branches;
}

/**
 * 빈 분기의 **상태**만 적는다. 행동을 권하는 어구는 여기에 넣지 않는다.
 * 읽기 전용 면(AI 초안 미리보기)은 이것을 쓰고, 누를 수 있는 버튼은
 * `branchEmptyActionLabel` 을 쓴다. 하나로 합치면 클릭해도 아무 일도 없는 자리에
 * 「여기에 명령 추가」가 적힌다 — 이 변경이 없애려는 바로 그 결함이다.
 */
export const branchEmptyLabel = "비어 있음";

/** 명령 피커를 여는 실제 버튼의 라벨. 빈 상태 + 지금 할 수 있는 행동을 한 줄로 말한다. */
export const branchEmptyActionLabel = `${branchEmptyLabel} — 여기에 명령 추가`;

