// 조건 붙은 선택지(showWhen·enableWhen)를 화면에 보일 목록으로 바꾼다.
//
// 정지(player/interpreter/commandCatalog)와 재개(resume)·전투 이벤트(battle/battleEvents)가 같은 목록을 봐야 한다. 화면은 숨긴 줄을 빼고 번호를 다시 매기므로,
// 플레이어가 고른 「화면 번호」를 저작된 options 의 「원래 번호」로 되돌리는 표(shownIndex → authoredIndex)를 함께 만든다.
// 표는 정지 순간에 굳힌다 — 선택지가 떠 있는 사이 병렬 이벤트가 스위치를 바꿔도 플레이어가 본 줄이 실행된다.
import type { ChoiceCancelBehavior, Command, Condition } from "@/project/types";
import { cancelChoiceIndex } from "@/project/choiceCancellation";
import { playerChoiceText } from "@/project/choiceText";

type ChoicesCommand = Extract<Command, { kind: "choices" }>;

/** 엔진 상한. 저작된 options 가 더 길어도 처음 5개만 화면에 오른다(예전부터 같은 규칙). */
export const MAX_SHOWN_CHOICES = 5;

export interface ShownChoice {
  readonly text: string;
  /** 흐리게(고를 수 없음). */
  readonly disabled?: true;
  /** 흐린 줄의 이유 한 줄. 비면 이유 없이 흐리게만. */
  readonly disabledText?: string;
}

export interface ChoiceView {
  readonly options: ShownChoice[];
  /** 화면 번호 → 저작된 options 번호. */
  readonly authoredIndex: number[];
  /** 화면 기준으로 다시 쓴 취소 동작(choiceN 이 숨은 줄을 가리키면 그 줄의 화면 번호로, 숨었으면 disallow). */
  readonly cancelBehavior?: ChoiceCancelBehavior;
}

export type ConditionEvaluator = (condition: Condition) => boolean;

export function choiceView(command: ChoicesCommand, evaluate: ConditionEvaluator): ChoiceView {
  const options: ShownChoice[] = [];
  const authoredIndex: number[] = [];
  command.options.slice(0, MAX_SHOWN_CHOICES).forEach((option, index) => {
    if (option.showWhen && !evaluate(option.showWhen)) return;
    const enabled = !option.enableWhen || evaluate(option.enableWhen);
    const reason = option.disabledText?.trim();
    options.push({
      text: playerChoiceText(option.text),
      ...(enabled ? {} : { disabled: true as const, ...(reason ? { disabledText: reason } : {}) }),
    });
    authoredIndex.push(index);
  });
  const cancelBehavior = shownCancelBehavior(command.cancelBehavior, authoredIndex, options);
  // 보이는 줄이 전부 흐리면 고를 것이 없다 — 취소를 막아 두면 플레이어가 갇힌다. 취소로 닫게 한다
  // (저작 cancelBehavior 가 branch 면 그 취소 분기, 아니면 아무 일 없이 다음 명령).
  const allDisabled = options.length > 0 && options.every((option) => option.disabled);
  return { options, authoredIndex, cancelBehavior: allDisabled && cancelBehavior !== "branch" ? "branch" : cancelBehavior };
}

/** 조건이 하나도 없는 선택지인가 — 그러면 화면 목록은 저작 목록과 같다(옛 경로와 바이트 단위로 같게). */
export function choicesHaveConditions(command: ChoicesCommand): boolean {
  return command.options.some((option) => option.showWhen !== undefined || option.enableWhen !== undefined);
}

function shownCancelBehavior(
  behavior: ChoiceCancelBehavior | undefined,
  authoredIndex: readonly number[],
  options: readonly ShownChoice[],
): ChoiceCancelBehavior | undefined {
  if (!behavior || behavior === "disallow" || behavior === "branch") return behavior;
  const target = cancelChoiceIndex(behavior, MAX_SHOWN_CHOICES);
  if (target === null || target < 0) return behavior;
  const shown = authoredIndex.indexOf(target);
  // 취소가 가리키던 줄이 숨었거나 흐리면 취소로 그 줄을 고를 수 없다 — 아무 일도 하지 않는다.
  if (shown < 0 || options[shown]?.disabled) return "disallow";
  return `choice${shown + 1}` as ChoiceCancelBehavior;
}

/**
 * 재개 값(화면 번호, 취소는 -1)을 저작된 options 번호로 바꾼다.
 * 범위 밖이거나 흐린 줄이면 undefined(아무 분기도 타지 않는다). -1 은 그대로 돌려준다.
 */
export function authoredChoiceIndex(view: ChoiceView | undefined, shownIndex: number): number | undefined {
  if (shownIndex === -1) return -1;
  if (!view) return shownIndex;
  if (!Number.isInteger(shownIndex) || shownIndex < 0 || shownIndex >= view.authoredIndex.length) return undefined;
  if (view.options[shownIndex]?.disabled) return undefined;
  return view.authoredIndex[shownIndex];
}
