import { el } from "@/util/dom";
import { store } from "@/project/store";
import type { EventPageCondition } from "@/project/types";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { commandSummary } from "./commandSummary";
import {
  renderBattleResultCondition,
  renderFriendshipAtLeastCondition,
  renderGoldCondition,
  renderNpcActivityCondition,
  renderRunCondition,
  renderSeasonCondition,
  renderSelfSwitchCondition,
  renderTimePhaseCondition,
  renderTimerCondition,
  renderVariableCondition,
} from "./conditionForm";
import { databaseRecordSelect, switchVariableIdPicker } from "./pageConditionControls";
import {
  advancedConditionEntries,
  appendCondition,
  appendConditionAtPath,
  type ConditionPath,
  convertGroupKind,
  type GroupCondition,
  groupChildren,
  isGroupCondition,
  type PageConditionContext,
  removeConditionAtPath,
  replaceConditionAtPath,
} from "./pageConditionModel";
import { bindEventSectionOpenState, eventEditorOpenKey, openEventAdvanced } from "./eventEditorOpenState";

type AdvancedConditionKind = EventPageCondition["kind"];

const LEAF_CONDITION_OPTIONS = [
  { value: "switch", label: "스위치" },
  { value: "variable", label: "변수" },
  { value: "selfSwitch", label: "이 이벤트 기억" },
  { value: "item", label: "아이템" },
  { value: "actor", label: "주인공" },
  { value: "gold", label: "소지금" },
  { value: "timer", label: "타이머" },
  { value: "timePhase", label: "시간대" },
  { value: "season", label: "계절" },
  { value: "npcActivity", label: "활동" },
  { value: "friendshipAtLeast", label: "호감도" },
  { value: "battleResult", label: "전투 결과" },
  { value: "run", label: "탐험" },
] as const satisfies readonly { readonly value: AdvancedConditionKind; readonly label: string }[];

// 고급 목록도 방향(꺼짐/보유 안 함/파티에 없음)을 저작할 수 있어야 한다.
// 예전에는 picker 만 그리고 id 를 바꾸면 value/present 를 true 로 되돌려, 3번째 스위치·2번째
// 아이템·2번째 주인공은 «꺼짐»을 쓸 수도 없고 데이터에 있던 false 가 조용히 뒤집혔다.
const ADVANCED_SWITCH_VALUE_OPTIONS = [
  { value: "true", label: "켜짐" },
  { value: "false", label: "꺼짐" },
] as const;

const ADVANCED_ITEM_PRESENT_OPTIONS = [
  { value: "true", label: "보유 중" },
  { value: "false", label: "보유 안 함" },
] as const;

const ADVANCED_ACTOR_PRESENT_OPTIONS = [
  { value: "true", label: "파티에 있음" },
  { value: "false", label: "파티에 없음" },
] as const;

/**
 * 묶음 조건. 페이지 조건은 서로 AND 라, OR·부정은 이 그룹으로만 저작할 수 있다.
 * 런타임(`pageResolution.ts`)은 예전부터 평가했고 데이터에도 들어갈 수 있었지만
 * 편집기가 없어 «읽기 전용 요약 + 삭제» 였다 — 이제 여기서 만든다.
 */
// 라벨 앞에 연산자를 세운다 — 233px 레일에서 select 가 잘려도 AND/OR/NOT 은 남는다.
const GROUP_CONDITION_OPTIONS = [
  { value: "all", label: "묶음: 모두 만족해야" },
  { value: "any", label: "묶음: 하나만 만족해도" },
  { value: "not", label: "묶음: 만족하지 않아야" },
] as const satisfies readonly { readonly value: GroupCondition["kind"]; readonly label: string }[];

const ADVANCED_CONDITION_OPTIONS = [
  ...LEAF_CONDITION_OPTIONS,
  ...GROUP_CONDITION_OPTIONS,
] as const satisfies readonly { readonly value: AdvancedConditionKind; readonly label: string }[];

/**
 * 그룹을 중첩할 수 있는 깊이. 0=페이지 조건 목록, 1=그룹 하위.
 * 여기까지만 그룹을 제시한다 — 더 깊어지면 233px 레일에서 들여쓰기가 읽히지 않는다.
 */
const MAX_GROUP_DEPTH = 2;

export function renderAdvancedConditions(context: PageConditionContext): HTMLElement {
  const entries = advancedConditionEntries(context.page);
  const list = el("div", {
    class: "event-advanced-condition-list",
    dataset: { testid: "event-page-advanced-condition-list" },
    children: entries.length > 0
      ? entries.map((entry, listIndex) =>
          conditionRow(context, [entry.index], entry.condition, String(listIndex), 0, true)
        )
      : [el("div", { class: "event-advanced-condition-empty", text: "추가 조건 없음" })],
  });
  const kind = selectWithOptions(ADVANCED_CONDITION_OPTIONS, "switch", "event-page-advanced-condition-kind");
  const details = el("details", {
    class: "event-advanced-conditions",
    dataset: { testid: "event-page-advanced-conditions" },
    children: [
      el("summary", { text: `고급 조건 (${entries.length})` }),
      list,
      el("div", {
        class: "event-advanced-condition-add",
        children: [
          kind,
          el("button", {
            class: "btn small",
            text: "조건 추가",
            attrs: { type: "button" },
            dataset: { testid: "event-page-advanced-condition-add" },
            on: {
              click: () => appendCondition(context, defaultAdvancedCondition(selectedOptionValue(kind, ADVANCED_CONDITION_OPTIONS, "switch"))),
            },
          }),
        ],
      }),
    ],
  }) as HTMLDetailsElement;
  bindEventSectionOpenState(
    details,
    openEventAdvanced,
    eventEditorOpenKey(context.mapId, context.eventId, context.page.id)
  );
  return details;
}

function conditionRow(
  context: PageConditionContext,
  path: ConditionPath,
  condition: EventPageCondition,
  suffix: string,
  depth: number,
  removable: boolean
): HTMLElement {
  return isGroupCondition(condition)
    ? groupConditionRow(context, path, condition, suffix, depth, removable)
    : leafConditionRow(context, path, condition, suffix, depth, removable);
}

/** 이 깊이에서 제시할 종류 목록. 마지막 깊이에서는 그룹을 빼서 무한 중첩을 막는다. */
function kindOptionsForDepth(depth: number) {
  return depth < MAX_GROUP_DEPTH ? ADVANCED_CONDITION_OPTIONS : LEAF_CONDITION_OPTIONS;
}

function leafConditionRow(
  context: PageConditionContext,
  path: ConditionPath,
  condition: EventPageCondition,
  suffix: string,
  depth: number,
  removable: boolean
): HTMLElement {
  const options = kindOptionsForDepth(depth);
  const kind = selectWithOptions(options, condition.kind, `event-page-advanced-condition-kind-${suffix}`);
  const content = renderAdvancedConditionContent(context, path, condition, suffix);
  kind.addEventListener("change", () => {
    replaceConditionAtPath(context, path, defaultAdvancedCondition(selectedOptionValue(kind, options, condition.kind)));
  });
  return el("div", {
    class: "event-advanced-condition-row",
    dataset: { testid: `event-page-advanced-condition-row-${suffix}`, conditionKind: condition.kind },
    children: [
      kind,
      content,
      ...(removable ? [removeButton(context, path, suffix)] : []),
    ],
  });
}

function removeButton(context: PageConditionContext, path: ConditionPath, suffix: string): HTMLElement {
  return el("button", {
    class: "btn small",
    text: "삭제",
    attrs: { type: "button" },
    dataset: { testid: `event-page-advanced-condition-remove-${suffix}` },
    on: { click: () => removeConditionAtPath(context, path) },
  });
}

/**
 * 묶음 조건 한 칸: 종류 select + 요약 + 하위 조건 편집기.
 *
 * not 은 하위가 정확히 하나라 «하위 추가»도 «하위 삭제»도 없다 — 종류를 바꿔서 갈아탄다.
 */
function groupConditionRow(
  context: PageConditionContext,
  path: ConditionPath,
  condition: GroupCondition,
  suffix: string,
  depth: number,
  removable: boolean
): HTMLElement {
  const kind = selectWithOptions(
    GROUP_CONDITION_OPTIONS,
    condition.kind,
    `event-page-advanced-condition-group-kind-${suffix}`
  );
  kind.addEventListener("change", () => {
    replaceConditionAtPath(
      context,
      path,
      convertGroupKind(condition, selectedOptionValue(kind, GROUP_CONDITION_OPTIONS, condition.kind))
    );
  });
  const children = groupChildren(condition);
  const childDepth = depth + 1;
  const childRows = children.map((child, childIndex) =>
    conditionRow(context, [...path, childIndex], child, `${suffix}-${childIndex}`, childDepth, condition.kind !== "not")
  );
  const body = el("div", {
    class: "event-advanced-condition-children",
    dataset: { testid: `event-page-advanced-condition-children-${suffix}` },
    children: childRows.length > 0
      ? childRows
      : [el("div", {
          class: "event-advanced-condition-empty",
          text: condition.kind === "any" ? "하위 조건 없음 — 이 묶음은 항상 거짓" : "하위 조건 없음 — 이 묶음은 항상 참",
          dataset: { testid: `event-page-advanced-condition-group-empty-${suffix}` },
        })],
  });
  return el("div", {
    class: "event-advanced-condition-group",
    dataset: { testid: `event-page-advanced-condition-row-${suffix}`, conditionKind: condition.kind },
    children: [
      el("div", {
        class: "event-advanced-condition-group-head",
        children: [
          kind,
          el("span", {
            class: "event-advanced-condition-summary",
            text: groupConditionSummary(condition),
            dataset: { testid: `event-page-advanced-condition-summary-${suffix}` },
          }),
          ...(removable ? [removeButton(context, path, suffix)] : []),
        ],
      }),
      body,
      ...(condition.kind === "not" ? [] : [groupChildAdd(context, path, suffix, childDepth)]),
    ],
  });
}

function groupChildAdd(
  context: PageConditionContext,
  path: ConditionPath,
  suffix: string,
  childDepth: number
): HTMLElement {
  const options = kindOptionsForDepth(childDepth);
  const kind = selectWithOptions(options, "switch", `event-page-advanced-condition-child-kind-${suffix}`);
  return el("div", {
    class: "event-advanced-condition-add",
    children: [
      kind,
      el("button", {
        class: "btn small",
        text: "하위 추가",
        attrs: { type: "button" },
        dataset: { testid: `event-page-advanced-condition-child-add-${suffix}` },
        on: {
          click: () =>
            appendConditionAtPath(context, path, defaultAdvancedCondition(selectedOptionValue(kind, options, "switch"))),
        },
      }),
    ],
  });
}

function groupConditionSummary(condition: GroupCondition): string {
  if (condition.kind === "not") return `아닐 때: ${describeCondition(condition.condition)}`;
  const label = condition.kind === "all" ? "모두 맞을 때" : "하나라도 맞을 때";
  const children = condition.conditions;
  const head = children[0];
  if (!head) return `${label}: 하위 조건 없음`;
  const rest = children.length - 1;
  return rest > 0
    ? `${label}: ${describeCondition(head)} 외 ${rest}개`
    : `${label}: ${describeCondition(head)}`;
}

function describeCondition(condition: EventPageCondition): string {
  const full = commandSummary({ kind: "fork", condition, then: [] });
  const separator = full.indexOf(": ");
  return separator >= 0 ? full.slice(separator + 2) : full;
}

function advancedSwitchControl(
  context: PageConditionContext,
  path: ConditionPath,
  condition: Extract<EventPageCondition, { kind: "switch" }>,
  suffix: string
): HTMLElement {
  let current = condition;
  const commit = (next: Extract<EventPageCondition, { kind: "switch" }>): void => {
    current = next;
    replaceConditionAtPath(context, path, next);
  };
  const picker = switchVariableIdPicker({
    kind: "switch",
    currentId: current.switchId,
    inputTestId: `event-page-advanced-condition-switch-${suffix}`,
    pickerTestId: `event-page-advanced-condition-switch-picker-${suffix}`,
    // 대상만 바꾸고 상태는 살린다.
    onChange: (switchId) => commit({ ...current, switchId }),
  });
  const value = selectWithOptions(
    ADVANCED_SWITCH_VALUE_OPTIONS,
    current.value === false ? "false" : "true",
    `event-page-advanced-condition-switch-value-${suffix}`
  );
  value.addEventListener("change", () => {
    commit({ ...current, value: selectedOptionValue(value, ADVANCED_SWITCH_VALUE_OPTIONS, "true") === "true" });
  });
  return el("div", { class: "event-advanced-condition-control", children: [picker, value] });
}

function advancedItemControl(
  context: PageConditionContext,
  path: ConditionPath,
  condition: Extract<EventPageCondition, { kind: "item" }>,
  suffix: string
): HTMLElement {
  let current = condition;
  const commit = (next: Extract<EventPageCondition, { kind: "item" }>): void => {
    current = next;
    replaceConditionAtPath(context, path, next);
  };
  const picker = databaseRecordSelect({
    kind: "item",
    currentId: current.itemId,
    testId: `event-page-advanced-condition-item-${suffix}`,
    onChange: (itemId) => commit({ ...current, itemId }),
  });
  const present = selectWithOptions(
    ADVANCED_ITEM_PRESENT_OPTIONS,
    current.present === false ? "false" : "true",
    `event-page-advanced-condition-item-present-${suffix}`
  );
  present.addEventListener("change", () => {
    commit({ ...current, present: selectedOptionValue(present, ADVANCED_ITEM_PRESENT_OPTIONS, "true") === "true" });
  });
  return el("div", { class: "event-advanced-condition-control record", children: [picker, present] });
}

function advancedActorControl(
  context: PageConditionContext,
  path: ConditionPath,
  condition: Extract<EventPageCondition, { kind: "actor" }>,
  suffix: string
): HTMLElement {
  let current = condition;
  const commit = (next: Extract<EventPageCondition, { kind: "actor" }>): void => {
    current = next;
    replaceConditionAtPath(context, path, next);
  };
  const picker = databaseRecordSelect({
    kind: "actor",
    currentId: current.actorId,
    testId: `event-page-advanced-condition-actor-${suffix}`,
    onChange: (actorId) => commit({ ...current, actorId }),
  });
  const present = selectWithOptions(
    ADVANCED_ACTOR_PRESENT_OPTIONS,
    current.present === false ? "false" : "true",
    `event-page-advanced-condition-actor-present-${suffix}`
  );
  present.addEventListener("change", () => {
    commit({ ...current, present: selectedOptionValue(present, ADVANCED_ACTOR_PRESENT_OPTIONS, "true") === "true" });
  });
  return el("div", { class: "event-advanced-condition-control record", children: [picker, present] });
}

function renderAdvancedConditionContent(
  context: PageConditionContext,
  path: ConditionPath,
  condition: EventPageCondition,
  suffix: string
): HTMLElement {
  const onChange = (next: EventPageCondition) => replaceConditionAtPath(context, path, next);
  switch (condition.kind) {
    case "switch":
      return advancedSwitchControl(context, path, condition, suffix);
    case "variable":
      return renderVariableCondition(condition, onChange, {
        className: "event-advanced-condition-control variable",
        opTestId: `event-page-advanced-condition-variable-op-${suffix}`,
        valueTestId: `event-page-advanced-condition-variable-value-${suffix}`,
        picker: (currentId, onPick) => switchVariableIdPicker({
          kind: "variable",
          currentId,
          inputTestId: `event-page-advanced-condition-variable-${suffix}`,
          pickerTestId: `event-page-advanced-condition-variable-picker-${suffix}`,
          onChange: onPick,
        }),
      });
    case "selfSwitch":
      return renderSelfSwitchCondition(condition, onChange, {
        className: "event-advanced-condition-control self-switch",
        keyTestId: `event-page-advanced-condition-self-switch-key-${suffix}`,
        valueTestId: `event-page-advanced-condition-self-switch-value-${suffix}`,
      });
    case "item":
      return advancedItemControl(context, path, condition, suffix);
    case "actor":
      return advancedActorControl(context, path, condition, suffix);
    case "gold":
      return renderGoldCondition(condition, onChange, {
        className: "event-advanced-condition-control gold",
        opTestId: `event-page-advanced-condition-gold-op-${suffix}`,
        amountTestId: `event-page-advanced-condition-gold-amount-${suffix}`,
      });
    case "timer":
      return renderTimerCondition(condition, onChange, {
        className: "event-advanced-condition-control timer",
        minutesSeconds: true,
        timerIdTestId: `event-page-advanced-condition-timer-id-${suffix}`,
        minutesTestId: `event-page-advanced-condition-timer-minutes-${suffix}`,
        secondsTestId: `event-page-advanced-condition-timer-seconds-${suffix}`,
      });
    case "timePhase":
      return renderTimePhaseCondition(condition, onChange, {
        className: "event-advanced-condition-control time-phase",
        phaseTestId: `event-page-advanced-condition-time-phase-${suffix}`,
      });
    case "season":
      return renderSeasonCondition(condition, onChange, {
        className: "event-advanced-condition-control season",
        seasonTestId: `event-page-advanced-condition-season-${suffix}`,
      });
    case "npcActivity":
      return renderNpcActivityCondition(condition, onChange, {
        className: "event-advanced-condition-control npc-activity",
        activityTestId: `event-page-advanced-condition-npc-activity-${suffix}`,
      });
    case "friendshipAtLeast":
      return renderFriendshipAtLeastCondition(condition, onChange, {
        className: "event-advanced-condition-control friendship",
        npcKeyTestId: `event-page-advanced-condition-friendship-npc-key-${suffix}`,
        valueTestId: `event-page-advanced-condition-friendship-value-${suffix}`,
        hostHasCharacterId: context.hostHasCharacterId === true,
        hintTestId: `event-page-advanced-condition-friendship-requires-character-id-${suffix}`,
      });
    case "battleResult":
      return renderBattleResultCondition(condition, onChange, {
        className: "event-advanced-condition-control battle-result",
        resultTestId: `event-page-advanced-condition-battle-result-${suffix}`,
      });
    case "run":
      return renderRunCondition(condition, onChange);
  }
  return document.createElement("div");
}

function defaultAdvancedCondition(kind: AdvancedConditionKind): EventPageCondition {
  const project = store.getCurrent();
  switch (kind) {
    case "switch":
      return { kind: "switch", switchId: project.switches[0]?.id ?? "", value: true };
    case "variable":
      return { kind: "variable", variableId: project.variables[0]?.id ?? "", op: ">=", value: 0 };
    case "selfSwitch":
      return { kind: "selfSwitch", key: "A", value: true };
    case "item":
      // 빈 itemId는 참조 검증(page condition: itemId가 존재하지 않습니다)에 바로 걸린다.
      return { kind: "item", itemId: project.database.items[0]?.id ?? "", present: true };
    case "actor":
      return { kind: "actor", actorId: project.database.actors[0]?.id ?? "", present: true };
    case "gold":
      return { kind: "gold", op: ">=", amount: 0 };
    case "timer":
      return { kind: "timer", timerId: "timer1", seconds: 0 };
    case "timePhase":
      return { kind: "timePhase", phase: "day" };
    case "season":
      return { kind: "season", season: "spring" };
    case "npcActivity":
      return { kind: "npcActivity", activity: "work" };
    case "friendshipAtLeast":
      return { kind: "friendshipAtLeast", value: 100 };
    case "battleResult":
      return { kind: "battleResult", result: "victory" };
    case "run":
      return { kind: "run", query: "active", value: true };
    // 빈 묶음은 조용히 참(all)·거짓(any) 이 되어 저작자를 속인다 — 하위 하나를 심어서 낸다.
    case "all":
      return { kind: "all", conditions: [defaultAdvancedCondition("switch")] };
    case "any":
      return { kind: "any", conditions: [defaultAdvancedCondition("switch")] };
    case "not":
      return { kind: "not", condition: defaultAdvancedCondition("switch") };
  }
}
