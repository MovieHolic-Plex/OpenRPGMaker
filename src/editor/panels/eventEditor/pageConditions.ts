import { updateEventPage } from "@/editor/eventPages";
import { el } from "@/util/dom";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { CONDITION_OP_OPTIONS } from "./options";
import { renderFriendshipAtLeastCondition, selfSwitchControl, SEASON_OPTIONS, TIME_PHASE_OPTIONS } from "./conditionForm";
import { hasCharacterId } from "@/project/socialKey";
import { renderAdvancedConditions } from "./pageAdvancedConditions";
import { databaseRecordSelect, switchVariableIdPicker } from "./pageConditionControls";
import {
  type PageConditionContext,
  type SwitchConditionParams,
  selfSwitchConditionAt,
  switchConditionAt,
  timerCondition,
  toggleSimpleCondition,
  toggleSwitchCondition,
  toggleSelfSwitchCondition,
  toggleTimerCondition,
  withoutFirstCondition,
  withoutNthCondition,
} from "./pageConditionModel";
import type { EventPage, MapId } from "@/project/types";

const SWITCH_VALUE_OPTIONS = [
  { value: "on", label: "켜짐" },
  { value: "off", label: "꺼짐" },
] as const;

const ITEM_PRESENT_OPTIONS = [
  { value: "present", label: "보유 중" },
  { value: "absent", label: "보유 안 함" },
] as const;

const ACTOR_PRESENT_OPTIONS = [
  { value: "present", label: "파티에 있음" },
  { value: "absent", label: "파티에 없음" },
] as const;

export function renderPageConditions(
  mapId: MapId,
  eventId: string,
  page: EventPage,
  event?: { characterId?: string },
): HTMLElement[] {
  // 호감도 조건은 이 이벤트의 NPC 관계 연결 여부에 따라 살아있는지가 갈린다 — 컨트롤에 그 사실을 준다.
  const context = { mapId, eventId, page, hostHasCharacterId: hasCharacterId(event) };
  // RM 계약: 핵심 조건 행은 항상 표시. 체크 OFF여도 라벨·컨트롤 자리 유지.
  return [
    conditionRow(
      "스위치",
      switchConditionInputs({ ...context, slot: 0, testPrefix: "event-page-switch-condition" }),
      switchConditionAt(page, 0) !== undefined,
      "",
      (enabled) => toggleSwitchCondition({ ...context, slot: 0 }, enabled),
    ),
    conditionRow(
      "스위치",
      switchConditionInputs({ ...context, slot: 1, testPrefix: "event-page-switch2-condition" }),
      switchConditionAt(page, 1) !== undefined,
      "",
      (enabled) => toggleSwitchCondition({ ...context, slot: 1 }, enabled),
    ),
    conditionRow(
      "변수",
      variableConditionInputs(context),
      page.conditions.some((item) => item.kind === "variable"),
      "이",
      (enabled) => toggleSimpleCondition(context, "variable", enabled),
    ),
    conditionRow(
      "아이템",
      itemConditionInputs(context),
      page.conditions.some((item) => item.kind === "item"),
      "",
      (enabled) => toggleSimpleCondition(context, "item", enabled),
    ),
    conditionRow(
      "주인공",
      actorConditionInputs(context),
      page.conditions.some((item) => item.kind === "actor"),
      "",
      (enabled) => toggleSimpleCondition(context, "actor", enabled),
    ),
    conditionRow(
      "타이머 1",
      timerConditionInputs(context, "timer1"),
      timerCondition(context, "timer1") !== undefined,
      "이하",
      (enabled) => toggleTimerCondition(context, "timer1", enabled),
    ),
    conditionRow(
      "타이머 2",
      timerConditionInputs(context, "timer2"),
      timerCondition(context, "timer2") !== undefined,
      "이하",
      (enabled) => toggleTimerCondition(context, "timer2", enabled),
    ),
    conditionRow(
      "시간대",
      timePhaseConditionInputs(context),
      page.conditions.some((item) => item.kind === "timePhase"),
      "일 때",
      (enabled) => toggleSimpleCondition(context, "timePhase", enabled),
    ),
    conditionRow(
      "계절",
      seasonConditionInputs(context),
      page.conditions.some((item) => item.kind === "season"),
      "일 때",
      (enabled) => toggleSimpleCondition(context, "season", enabled),
    ),
    conditionRow(
      "활동",
      npcActivityConditionInputs(context),
      page.conditions.some((item) => item.kind === "npcActivity"),
      "일 때",
      (enabled) => toggleSimpleCondition(context, "npcActivity", enabled),
    ),
    conditionRow(
      "호감도",
      friendshipConditionInputs(context),
      page.conditions.some((item) => item.kind === "friendshipAtLeast"),
     "이상",
     (enabled) => toggleSimpleCondition(context, "friendshipAtLeast", enabled),
   ),
    conditionRow(
      "이 이벤트 기억",
      selfSwitchConditionInputs(context),
      selfSwitchConditionAt(page) !== undefined,
      "",
      (enabled) => toggleSelfSwitchCondition(context, enabled),
    ),
    renderAdvancedConditions(context),
  ];
}

function conditionRow(
  label: string,
  control: HTMLElement,
  checked: boolean,
  suffix: string,
  onToggle: (enabled: boolean) => void,
): HTMLElement {
  const enabled = el("input", {
    attrs: { type: "checkbox", "aria-label": `${label} 조건 사용` },
  }) as HTMLInputElement;
  enabled.checked = checked;
  enabled.addEventListener("change", () => onToggle(enabled.checked));
  // 비활성도 컨트롤 자리를 남긴다. 숨기면 체크+라벨만 붙어 레이아웃이 무너진다.
  return el("div", {
    class: `event-condition-row${checked ? "" : " disabled"}`,
    dataset: {
      conditionActive: checked ? "true" : "false",
      testid: `event-condition-row-${label}`,
    },
    children: [
      enabled,
      el("span", { class: "event-condition-label", text: label }),
      control,
      el("span", {
        class: "event-condition-suffix",
        text: suffix,
      }),
    ],
  });
}

function switchConditionInputs(params: SwitchConditionParams): HTMLElement {
  const condition = switchConditionAt(params.page, params.slot);
  let currentSwitchId = condition?.switchId ?? "";
  const value = selectWithOptions(
    SWITCH_VALUE_OPTIONS,
    condition?.value === false ? "off" : "on",
    `${params.testPrefix}-value`
  );
  const apply = () => {
    const next = withoutNthCondition(params.page.conditions, "switch", params.slot);
    if (currentSwitchId) {
      next.push({
        kind: "switch",
        switchId: currentSwitchId,
        value: selectedOptionValue(value, SWITCH_VALUE_OPTIONS, "on") === "on",
      });
    }
    updateEventPage(params.mapId, params.eventId, params.page.id, { conditions: next });
  };
  value.addEventListener("change", apply);
  const picker = switchVariableIdPicker({
    kind: "switch",
    currentId: currentSwitchId,
    inputTestId: `${params.testPrefix}-input`,
    pickerTestId: `${params.testPrefix}-picker-open`,
    onChange: (switchId) => {
      currentSwitchId = switchId;
      apply();
    },
  });
  return el("div", { class: "event-condition-control switch", children: [picker, value] });
}

function variableConditionInputs(context: PageConditionContext): HTMLElement {
  const condition = context.page.conditions.find((item) => item.kind === "variable");
  let currentVariableId = condition?.kind === "variable" ? condition.variableId : "";
  const op = selectWithOptions(
    CONDITION_OP_OPTIONS,
    condition?.kind === "variable" ? condition.op : ">=",
    "event-page-variable-condition-op"
  );
  const value = el("input", {
    attrs: { type: "number" },
    value: condition?.kind === "variable" ? String(condition.value) : "0",
    dataset: { testid: "event-page-variable-condition-value" },
  }) as HTMLInputElement;
  const apply = () => {
    const next = withoutFirstCondition(context.page.conditions, "variable");
    if (currentVariableId) next.push({
      kind: "variable",
      variableId: currentVariableId,
      op: selectedOptionValue(op, CONDITION_OP_OPTIONS, ">="),
      value: parseInt(value.value, 10) || 0,
    });
    updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
  };
  op.addEventListener("change", apply);
  value.addEventListener("change", apply);
  const picker = switchVariableIdPicker({
    kind: "variable",
    currentId: currentVariableId,
    inputTestId: "event-page-variable-condition-input",
    pickerTestId: "event-page-variable-picker-open",
    onChange: (variableId) => {
      currentVariableId = variableId;
      apply();
    },
  });
  return el("div", {
    class: "event-condition-control variable",
    children: [
      el("div", { class: "event-condition-main", children: [picker] }),
      el("div", { class: "event-condition-threshold", children: [op, value] }),
    ],
  });
}

function actorConditionInputs(context: PageConditionContext): HTMLElement {
  const condition = context.page.conditions.find((item) => item.kind === "actor");
  let currentActorId = condition?.kind === "actor" ? condition.actorId : "";
  const present = selectWithOptions(
    ACTOR_PRESENT_OPTIONS,
    condition?.kind === "actor" && condition.present === false ? "absent" : "present",
    "event-page-actor-condition-present"
  );
  const apply = () => {
    const next = withoutFirstCondition(context.page.conditions, "actor");
    if (currentActorId) {
      next.push({
        kind: "actor",
        actorId: currentActorId,
        present: selectedOptionValue(present, ACTOR_PRESENT_OPTIONS, "present") === "present",
      });
    }
    updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
  };
  present.addEventListener("change", apply);
  const actor = databaseRecordSelect({
    kind: "actor",
    currentId: currentActorId,
    testId: "event-page-actor-condition-input",
    onChange: (actorId) => {
      currentActorId = actorId;
      apply();
    },
  });
  return el("div", { class: "event-condition-control record", children: [actor, present] });
}

function itemConditionInputs(context: PageConditionContext): HTMLElement {
  const condition = context.page.conditions.find((item) => item.kind === "item");
  let currentItemId = condition?.kind === "item" ? condition.itemId : "";
  const present = selectWithOptions(
    ITEM_PRESENT_OPTIONS,
    condition?.kind === "item" && condition.present === false ? "absent" : "present",
    "event-page-item-condition-present"
  );
  const apply = () => {
    const next = withoutFirstCondition(context.page.conditions, "item");
    if (currentItemId) {
      next.push({
        kind: "item",
        itemId: currentItemId,
        present: selectedOptionValue(present, ITEM_PRESENT_OPTIONS, "present") === "present",
      });
    }
    updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
  };
  present.addEventListener("change", apply);
  const item = databaseRecordSelect({
    kind: "item",
    currentId: currentItemId,
    testId: "event-page-item-condition-input",
    onChange: (itemId) => {
      currentItemId = itemId;
      apply();
    },
  });
  return el("div", { class: "event-condition-control record", children: [item, present] });
}

function timerConditionInputs(context: PageConditionContext, timerId: "timer1" | "timer2"): HTMLElement {
  const condition = timerCondition(context, timerId);
  const minutes = el("input", {
    attrs: { type: "number", min: "0", placeholder: "0" },
    value: condition ? String(Math.floor(condition.seconds / 60)) : "0",
    dataset: { testid: `event-page-${timerId}-condition-minutes` },
  }) as HTMLInputElement;
  const seconds = el("input", {
    attrs: { type: "number", min: "0", max: "59", placeholder: "0" },
    value: condition ? String(condition.seconds % 60) : "",
    dataset: { testid: `event-page-${timerId}-condition-seconds` },
  }) as HTMLInputElement;
  const apply = () => {
    const next = context.page.conditions.filter((item) => item.kind !== "timer" || item.timerId !== timerId);
    const minutesValue = parseInt(minutes.value, 10) || 0;
    const secondsValue = parseInt(seconds.value, 10) || 0;
    if (minutes.value.trim() || seconds.value.trim()) {
      next.push({ kind: "timer", timerId, seconds: minutesValue * 60 + secondsValue });
    }
    updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
  };
  minutes.addEventListener("change", apply);
  seconds.addEventListener("change", apply);
  return el("div", {
    class: "event-condition-control timer",
    children: [
      minutes,
      el("span", { class: "event-condition-time-unit", text: "분" }),
      seconds,
      el("span", { class: "event-condition-time-unit", text: "초" }),
    ],
  });
}

function timePhaseConditionInputs(context: PageConditionContext): HTMLElement {
  const condition = context.page.conditions.find((item) => item.kind === "timePhase");
  const phase = selectWithOptions(
    TIME_PHASE_OPTIONS,
    condition?.kind === "timePhase" ? condition.phase : "day",
    "event-page-time-phase-condition-input"
  );
  phase.addEventListener("change", () => {
    const next = withoutFirstCondition(context.page.conditions, "timePhase");
    next.push({ kind: "timePhase", phase: selectedOptionValue(phase, TIME_PHASE_OPTIONS, "day") });
    updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
  });
  return el("div", { class: "event-condition-control time-phase", children: [phase] });
}

function seasonConditionInputs(context: PageConditionContext): HTMLElement {
  const condition = context.page.conditions.find((item) => item.kind === "season");
  const season = selectWithOptions(
    SEASON_OPTIONS,
    condition?.kind === "season" ? condition.season : "spring",
    "event-page-season-condition-input"
  );
  season.addEventListener("change", () => {
    const next = withoutFirstCondition(context.page.conditions, "season");
    next.push({ kind: "season", season: selectedOptionValue(season, SEASON_OPTIONS, "spring") });
    updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
  });
  return el("div", { class: "event-condition-control season", children: [season] });
}

function npcActivityConditionInputs(context: PageConditionContext): HTMLElement {
  const condition = context.page.conditions.find((item) => item.kind === "npcActivity");
  const activity = el("input", {
    attrs: { type: "text", placeholder: "일" },
    value: condition?.kind === "npcActivity" ? condition.activity : "work",
    dataset: { testid: "event-page-npc-activity-condition-input" },
  }) as HTMLInputElement;
  activity.addEventListener("change", () => {
    const next = withoutFirstCondition(context.page.conditions, "npcActivity");
    const label = activity.value.trim();
    if (label) next.push({ kind: "npcActivity", activity: label });
    updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
  });
  return el("div", { class: "event-condition-control npc-activity", children: [activity] });
}

function friendshipConditionInputs(context: PageConditionContext): HTMLElement {
  const condition = context.page.conditions.find((item) => item.kind === "friendshipAtLeast");
  return renderFriendshipAtLeastCondition(
    condition?.kind === "friendshipAtLeast" ? condition : { kind: "friendshipAtLeast", value: 100 },
    (next) => {
      const existing = withoutFirstCondition(context.page.conditions, "friendshipAtLeast");
      existing.push(next);
      updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: existing });
    },
    {
      className: "event-condition-control friendship",
      npcKeyTestId: "event-page-friendship-condition-npc-key",
     valueTestId: "event-page-friendship-condition-value",
      hostHasCharacterId: context.hostHasCharacterId === true,
   }
 );
}
function selfSwitchConditionInputs(context: PageConditionContext): HTMLElement {
  const condition = selfSwitchConditionAt(context.page);
  return selfSwitchControl(
    condition?.key ?? "A",
    condition?.value ?? true,
    (key, value) => {
      const next = withoutFirstCondition(context.page.conditions, "selfSwitch");
      next.push({ kind: "selfSwitch", key, value });
      updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
    },
    {
      keyTestId: "event-page-self-switch-condition-key",
      valueTestId: "event-page-self-switch-condition-value",
    }
  );
}
