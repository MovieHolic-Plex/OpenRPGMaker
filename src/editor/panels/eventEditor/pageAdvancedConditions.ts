import { el } from "@/util/dom";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { BOOLEAN_OPTIONS, CONDITION_OP_OPTIONS, SELF_SWITCH_KEY_OPTIONS } from "./options";
import { databaseRecordSelect, switchVariableIdPicker } from "./pageConditionControls";
import {
  advancedConditionEntries,
  appendCondition,
  type PageConditionContext,
  removeConditionAt,
  replaceConditionAt,
} from "./pageConditionModel";
import type { EventPageCondition } from "@/project/types";

type AdvancedConditionKind = EventPageCondition["kind"];

const ADVANCED_CONDITION_OPTIONS = [
  { value: "switch", label: "스위치" },
  { value: "variable", label: "변수" },
  { value: "selfSwitch", label: "셀프 스위치" },
  { value: "item", label: "아이템" },
  { value: "actor", label: "주인공" },
  { value: "gold", label: "소지금" },
  { value: "timer", label: "타이머" },
] as const satisfies readonly { readonly value: AdvancedConditionKind; readonly label: string }[];

export function renderAdvancedConditions(context: PageConditionContext): HTMLElement {
  const entries = advancedConditionEntries(context.page);
  const list = el("div", {
    class: "event-advanced-condition-list",
    dataset: { testid: "event-page-advanced-condition-list" },
    children: entries.length > 0
      ? entries.map((entry, listIndex) => advancedConditionRow(context, entry.index, entry.condition, listIndex))
      : [el("div", { class: "event-advanced-condition-empty", text: "추가 조건 없음" })],
  });
  const kind = selectWithOptions(ADVANCED_CONDITION_OPTIONS, "switch", "event-page-advanced-condition-kind");
  return el("details", {
    class: "event-advanced-conditions",
    attrs: { open: "" },
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
  });
}

function advancedConditionRow(
  context: PageConditionContext,
  index: number,
  condition: EventPageCondition,
  listIndex: number
): HTMLElement {
  const kind = selectWithOptions(ADVANCED_CONDITION_OPTIONS, condition.kind, `event-page-advanced-condition-kind-${listIndex}`);
  const content = renderAdvancedConditionContent(context, index, condition, listIndex);
  kind.addEventListener("change", () => {
    replaceConditionAt(context, index, defaultAdvancedCondition(selectedOptionValue(kind, ADVANCED_CONDITION_OPTIONS, condition.kind)));
  });
  return el("div", {
    class: "event-advanced-condition-row",
    dataset: { testid: `event-page-advanced-condition-row-${listIndex}` },
    children: [
      kind,
      content,
      el("button", {
        class: "btn small",
        text: "삭제",
        attrs: { type: "button" },
        dataset: { testid: `event-page-advanced-condition-remove-${listIndex}` },
        on: { click: () => removeConditionAt(context, index) },
      }),
    ],
  });
}

function renderAdvancedConditionContent(
  context: PageConditionContext,
  index: number,
  condition: EventPageCondition,
  listIndex: number
): HTMLElement {
  switch (condition.kind) {
    case "switch":
      return switchConditionControl(context, index, condition, listIndex);
    case "variable":
      return variableConditionControl(context, index, condition, listIndex);
    case "selfSwitch":
      return selfSwitchConditionControl(context, index, condition, listIndex);
    case "item":
      return recordConditionControl(context, index, condition, listIndex);
    case "actor":
      return recordConditionControl(context, index, condition, listIndex);
    case "gold":
      return goldConditionControl(context, index, condition, listIndex);
    case "timer":
      return timerConditionControl(context, index, condition, listIndex);
  }
}

function switchConditionControl(
  context: PageConditionContext,
  index: number,
  condition: Extract<EventPageCondition, { kind: "switch" }>,
  listIndex: number
): HTMLElement {
  const picker = switchVariableIdPicker({
    kind: "switch",
    currentId: condition.switchId,
    inputTestId: `event-page-advanced-condition-switch-${listIndex}`,
    pickerTestId: `event-page-advanced-condition-switch-picker-${listIndex}`,
    onChange: (switchId) => replaceConditionAt(context, index, { ...condition, switchId, value: true }),
  });
  return el("div", { class: "event-advanced-condition-control", children: [picker] });
}

function variableConditionControl(
  context: PageConditionContext,
  index: number,
  condition: Extract<EventPageCondition, { kind: "variable" }>,
  listIndex: number
): HTMLElement {
  let currentVariableId = condition.variableId;
  const op = selectWithOptions(CONDITION_OP_OPTIONS, condition.op, `event-page-advanced-condition-variable-op-${listIndex}`);
  const value = el("input", {
    attrs: { type: "number" },
    value: String(condition.value),
    dataset: { testid: `event-page-advanced-condition-variable-value-${listIndex}` },
  }) as HTMLInputElement;
  const apply = () => replaceConditionAt(context, index, {
    kind: "variable",
    variableId: currentVariableId,
    op: selectedOptionValue(op, CONDITION_OP_OPTIONS, condition.op),
    value: parseInt(value.value, 10) || 0,
  });
  op.addEventListener("change", apply);
  value.addEventListener("change", apply);
  const picker = switchVariableIdPicker({
    kind: "variable",
    currentId: currentVariableId,
    inputTestId: `event-page-advanced-condition-variable-${listIndex}`,
    pickerTestId: `event-page-advanced-condition-variable-picker-${listIndex}`,
    onChange: (variableId) => {
      currentVariableId = variableId;
      apply();
    },
  });
  return el("div", { class: "event-advanced-condition-control variable", children: [picker, op, value] });
}

function recordConditionControl(
  context: PageConditionContext,
  index: number,
  condition: Extract<EventPageCondition, { kind: "item" | "actor" }>,
  listIndex: number
): HTMLElement {
  const select = databaseRecordSelect({
    kind: condition.kind,
    currentId: condition.kind === "item" ? condition.itemId : condition.actorId,
    testId: `event-page-advanced-condition-${condition.kind}-${listIndex}`,
    onChange: (id) => replaceConditionAt(context, index, condition.kind === "item"
      ? { ...condition, itemId: id, present: true }
      : { ...condition, actorId: id, present: true }),
  });
  return el("div", { class: "event-advanced-condition-control record", children: [select] });
}

function timerConditionControl(
  context: PageConditionContext,
  index: number,
  condition: Extract<EventPageCondition, { kind: "timer" }>,
  listIndex: number
): HTMLElement {
  const timerId = selectWithOptions(
    [{ value: "timer1", label: "타이머 1" }, { value: "timer2", label: "타이머 2" }],
    condition.timerId,
    `event-page-advanced-condition-timer-id-${listIndex}`
  );
  const minutes = el("input", {
    attrs: { type: "number", min: "0" },
    value: String(Math.floor(condition.seconds / 60)),
    dataset: { testid: `event-page-advanced-condition-timer-minutes-${listIndex}` },
  }) as HTMLInputElement;
  const seconds = el("input", {
    attrs: { type: "number", min: "0", max: "59" },
    value: String(condition.seconds % 60),
    dataset: { testid: `event-page-advanced-condition-timer-seconds-${listIndex}` },
  }) as HTMLInputElement;
  const apply = () => replaceConditionAt(context, index, {
    kind: "timer",
    timerId: selectedOptionValue(timerId, [{ value: "timer1", label: "타이머 1" }, { value: "timer2", label: "타이머 2" }], condition.timerId),
    seconds: (parseInt(minutes.value, 10) || 0) * 60 + (parseInt(seconds.value, 10) || 0),
  });
  timerId.addEventListener("change", apply);
  minutes.addEventListener("change", apply);
  seconds.addEventListener("change", apply);
  return el("div", {
    class: "event-advanced-condition-control timer",
    children: [timerId, minutes, el("span", { text: "분" }), seconds, el("span", { text: "초 이하" })],
  });
}

function selfSwitchConditionControl(
  context: PageConditionContext,
  index: number,
  condition: Extract<EventPageCondition, { kind: "selfSwitch" }>,
  listIndex: number
): HTMLElement {
  const key = selectWithOptions(
    SELF_SWITCH_KEY_OPTIONS,
    condition.key,
    `event-page-advanced-condition-self-switch-key-${listIndex}`
  );
  const val = selectWithOptions(
    BOOLEAN_OPTIONS,
    String(condition.value),
    `event-page-advanced-condition-self-switch-value-${listIndex}`
  );
  const apply = () => replaceConditionAt(context, index, {
    kind: "selfSwitch",
    key: selectedOptionValue(key, SELF_SWITCH_KEY_OPTIONS, condition.key),
    value: val.value === "true",
  });
  key.addEventListener("change", apply);
  val.addEventListener("change", apply);
  return el("div", { class: "event-advanced-condition-control self-switch", children: [key, val] });
}

function goldConditionControl(
  context: PageConditionContext,
  index: number,
  condition: Extract<EventPageCondition, { kind: "gold" }>,
  listIndex: number
): HTMLElement {
  const op = selectWithOptions(
    CONDITION_OP_OPTIONS,
    condition.op,
    `event-page-advanced-condition-gold-op-${listIndex}`
  );
  const amount = el("input", {
    attrs: { type: "number", min: "0" },
    value: String(condition.amount),
    dataset: { testid: `event-page-advanced-condition-gold-amount-${listIndex}` },
  }) as HTMLInputElement;
  const apply = () => replaceConditionAt(context, index, {
    kind: "gold",
    op: selectedOptionValue(op, CONDITION_OP_OPTIONS, condition.op),
    amount: parseInt(amount.value, 10) || 0,
  });
  op.addEventListener("change", apply);
  amount.addEventListener("change", apply);
  return el("div", { class: "event-advanced-condition-control gold", children: [op, amount] });
}

function defaultAdvancedCondition(kind: AdvancedConditionKind): EventPageCondition {
  switch (kind) {
    case "switch":
      return { kind: "switch", switchId: "", value: true };
    case "variable":
      return { kind: "variable", variableId: "", op: ">=", value: 0 };
    case "selfSwitch":
      return { kind: "selfSwitch", key: "A", value: true };
    case "item":
      return { kind: "item", itemId: "", present: true };
    case "actor":
      return { kind: "actor", actorId: "", present: true };
    case "gold":
      return { kind: "gold", op: ">=", amount: 0 };
    case "timer":
      return { kind: "timer", timerId: "timer1", seconds: 0 };
  }
}
