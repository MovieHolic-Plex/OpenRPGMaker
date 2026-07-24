import { el } from "@/util/dom";
import { store } from "@/project/store";
import type { EventPageCondition } from "@/project/types";
import { selectedOptionValue, selectWithOptions } from "./dom";
import {
  renderActorCondition,
  renderFriendshipAtLeastCondition,
  renderGoldCondition,
  renderItemCondition,
  renderNpcActivityCondition,
  renderSeasonCondition,
  renderSelfSwitchCondition,
  renderSwitchCondition,
  renderTimePhaseCondition,
  renderTimerCondition,
  renderVariableCondition,
} from "./conditionForm";
import { databaseRecordSelect, switchVariableIdPicker } from "./pageConditionControls";
import {
  advancedConditionEntries,
  appendCondition,
  type PageConditionContext,
  removeConditionAt,
  replaceConditionAt,
} from "./pageConditionModel";
import { bindEventSectionOpenState, eventEditorOpenKey, openEventAdvanced } from "./eventEditorOpenState";

type AdvancedConditionKind = EventPageCondition["kind"];

const ADVANCED_CONDITION_OPTIONS = [
  { value: "switch", label: "스위치" },
  { value: "variable", label: "변수" },
  { value: "selfSwitch", label: "셀프 스위치" },
  { value: "item", label: "아이템" },
  { value: "actor", label: "주인공" },
  { value: "gold", label: "소지금" },
  { value: "timer", label: "타이머" },
  { value: "timePhase", label: "시간대" },
  { value: "season", label: "계절" },
  { value: "npcActivity", label: "활동" },
  { value: "friendshipAtLeast", label: "호감도" },
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
      return renderSwitchCondition(condition, (next) => replaceConditionAt(context, index, next), {
        className: "event-advanced-condition-control",
        showValue: false,
        forceTrueOnSwitchChange: true,
        picker: (currentId, onChange) => switchVariableIdPicker({
          kind: "switch",
          currentId,
          inputTestId: `event-page-advanced-condition-switch-${listIndex}`,
          pickerTestId: `event-page-advanced-condition-switch-picker-${listIndex}`,
          onChange,
        }),
      });
    case "variable":
      return renderVariableCondition(condition, (next) => replaceConditionAt(context, index, next), {
        className: "event-advanced-condition-control variable",
        opTestId: `event-page-advanced-condition-variable-op-${listIndex}`,
        valueTestId: `event-page-advanced-condition-variable-value-${listIndex}`,
        picker: (currentId, onChange) => switchVariableIdPicker({
          kind: "variable",
          currentId,
          inputTestId: `event-page-advanced-condition-variable-${listIndex}`,
          pickerTestId: `event-page-advanced-condition-variable-picker-${listIndex}`,
          onChange,
        }),
      });
    case "selfSwitch":
      return renderSelfSwitchCondition(condition, (next) => replaceConditionAt(context, index, next), {
        className: "event-advanced-condition-control self-switch",
        keyTestId: `event-page-advanced-condition-self-switch-key-${listIndex}`,
        valueTestId: `event-page-advanced-condition-self-switch-value-${listIndex}`,
      });
    case "item":
      return renderItemCondition(condition, (next) => replaceConditionAt(context, index, next), {
        className: "event-advanced-condition-control record",
        showPresent: false,
        forcePresentOnItemChange: true,
        picker: (currentId, onChange) => databaseRecordSelect({
          kind: "item",
          currentId,
          testId: `event-page-advanced-condition-item-${listIndex}`,
          onChange,
        }),
      });
    case "actor":
      return renderActorCondition(condition, (next) => replaceConditionAt(context, index, next), {
        className: "event-advanced-condition-control record",
        showPresent: false,
        forcePresentOnActorChange: true,
        picker: (currentId, onChange) => databaseRecordSelect({
          kind: "actor",
          currentId,
          testId: `event-page-advanced-condition-actor-${listIndex}`,
          onChange,
        }),
      });
    case "gold":
      return renderGoldCondition(condition, (next) => replaceConditionAt(context, index, next), {
        className: "event-advanced-condition-control gold",
        opTestId: `event-page-advanced-condition-gold-op-${listIndex}`,
        amountTestId: `event-page-advanced-condition-gold-amount-${listIndex}`,
      });
    case "timer":
      return renderTimerCondition(condition, (next) => replaceConditionAt(context, index, next), {
        className: "event-advanced-condition-control timer",
        minutesSeconds: true,
        timerIdTestId: `event-page-advanced-condition-timer-id-${listIndex}`,
        minutesTestId: `event-page-advanced-condition-timer-minutes-${listIndex}`,
        secondsTestId: `event-page-advanced-condition-timer-seconds-${listIndex}`,
      });
    case "timePhase":
      return renderTimePhaseCondition(condition, (next) => replaceConditionAt(context, index, next), {
        className: "event-advanced-condition-control time-phase",
        phaseTestId: `event-page-advanced-condition-time-phase-${listIndex}`,
      });
    case "season":
      return renderSeasonCondition(condition, (next) => replaceConditionAt(context, index, next), {
        className: "event-advanced-condition-control season",
        seasonTestId: `event-page-advanced-condition-season-${listIndex}`,
      });
    case "npcActivity":
      return renderNpcActivityCondition(condition, (next) => replaceConditionAt(context, index, next), {
        className: "event-advanced-condition-control npc-activity",
        activityTestId: `event-page-advanced-condition-npc-activity-${listIndex}`,
      });
    case "friendshipAtLeast":
      return renderFriendshipAtLeastCondition(condition, (next) => replaceConditionAt(context, index, next), {
        className: "event-advanced-condition-control friendship",
        npcKeyTestId: `event-page-advanced-condition-friendship-npc-key-${listIndex}`,
        valueTestId: `event-page-advanced-condition-friendship-value-${listIndex}`,
      });
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
  }
  return { kind: "switch", switchId: "", value: true };
}
