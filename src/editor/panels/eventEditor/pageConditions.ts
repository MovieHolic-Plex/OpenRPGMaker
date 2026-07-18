import { updateEventPage } from "@/editor/eventPages";
import { el } from "@/util/dom";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { CONDITION_OP_OPTIONS } from "./options";
import { renderFriendshipAtLeastCondition, SEASON_OPTIONS, TIME_PHASE_OPTIONS } from "./conditionForm";
import { renderAdvancedConditions } from "./pageAdvancedConditions";
import { databaseRecordSelect, switchVariableIdPicker } from "./pageConditionControls";
import {
  type PageConditionContext,
  type SimpleConditionKind,
  type SwitchConditionParams,
  defaultSimpleCondition,
  switchConditionAt,
  timerCondition,
  toggleSimpleCondition,
  toggleSwitchCondition,
  toggleTimerCondition,
  withoutFirstCondition,
  withoutNthCondition,
} from "./pageConditionModel";
import type { EventPage, MapId } from "@/project/types";

type AddableConditionKind =
  | "variable"
  | "item"
  | "actor"
  | "timer1"
  | "timer2"
  | "timePhase"
  | "season"
  | "npcActivity"
  | "friendshipAtLeast";

const CORE_ADD_KINDS: readonly { value: AddableConditionKind; label: string }[] = [
  { value: "variable", label: "변수" },
  { value: "item", label: "아이템" },
  { value: "actor", label: "주인공" },
];

const LONG_TAIL_ADD_KINDS: readonly { value: AddableConditionKind; label: string }[] = [
  { value: "timer1", label: "타이머 1" },
  { value: "timer2", label: "타이머 2" },
  { value: "timePhase", label: "시간대" },
  { value: "season", label: "계절" },
  { value: "npcActivity", label: "활동" },
  { value: "friendshipAtLeast", label: "호감도" },
];

export function renderPageConditions(mapId: MapId, eventId: string, page: EventPage, event?: { characterId?: string }): HTMLElement[] {
  const context = { mapId, eventId, page };
  const hasCharacterId = Boolean(event?.characterId?.trim());
  const rows: HTMLElement[] = [
    // RM quick toggles: always keep switch slots 0/1 visible.
    conditionRow(
      "스위치",
      switchConditionInputs({ ...context, slot: 0, testPrefix: "event-page-switch-condition" }),
      switchConditionAt(page, 0) !== undefined,
      "켜짐",
      (enabled) => toggleSwitchCondition({ ...context, slot: 0 }, enabled)
    ),
    conditionRow(
      "스위치",
      switchConditionInputs({ ...context, slot: 1, testPrefix: "event-page-switch2-condition" }),
      switchConditionAt(page, 1) !== undefined,
      "켜짐",
      (enabled) => toggleSwitchCondition({ ...context, slot: 1 }, enabled)
    ),
  ];

  if (page.conditions.some((item) => item.kind === "variable")) {
    rows.push(
      conditionRow(
        "변수",
        variableConditionInputs(context),
        true,
        "이",
        (enabled) => toggleSimpleCondition(context, "variable", enabled)
      )
    );
  }
  if (page.conditions.some((item) => item.kind === "item")) {
    rows.push(
      conditionRow(
        "아이템",
        itemConditionInputs(context),
        true,
        "보유 중",
        (enabled) => toggleSimpleCondition(context, "item", enabled)
      )
    );
  }
  if (page.conditions.some((item) => item.kind === "actor")) {
    rows.push(
      conditionRow(
        "주인공",
        actorConditionInputs(context),
        true,
        "파티에 있음",
        (enabled) => toggleSimpleCondition(context, "actor", enabled)
      )
    );
  }
  if (timerCondition(context, "timer1") !== undefined) {
    rows.push(
      conditionRow(
        "타이머 1",
        timerConditionInputs(context, "timer1"),
        true,
        "이하",
        (enabled) => toggleTimerCondition(context, "timer1", enabled)
      )
    );
  }
  if (timerCondition(context, "timer2") !== undefined) {
    rows.push(
      conditionRow(
        "타이머 2",
        timerConditionInputs(context, "timer2"),
        true,
        "이하",
        (enabled) => toggleTimerCondition(context, "timer2", enabled)
      )
    );
  }
  if (page.conditions.some((item) => item.kind === "timePhase")) {
    rows.push(
      conditionRow(
        "시간대",
        timePhaseConditionInputs(context),
        true,
        "일 때",
        (enabled) => toggleSimpleCondition(context, "timePhase", enabled)
      )
    );
  }
  if (page.conditions.some((item) => item.kind === "season")) {
    rows.push(
      conditionRow(
        "계절",
        seasonConditionInputs(context),
        true,
        "일 때",
        (enabled) => toggleSimpleCondition(context, "season", enabled)
      )
    );
  }
  if (page.conditions.some((item) => item.kind === "npcActivity")) {
    rows.push(
      conditionRow(
        "활동",
        npcActivityConditionInputs(context),
        true,
        "일 때",
        (enabled) => toggleSimpleCondition(context, "npcActivity", enabled)
      )
    );
  }
  if (hasCharacterId && page.conditions.some((item) => item.kind === "friendshipAtLeast")) {
    rows.push(
      conditionRow(
        "호감도",
        friendshipConditionInputs(context),
        true,
        "이상",
        (enabled) => toggleSimpleCondition(context, "friendshipAtLeast", enabled)
      )
    );
  }

  rows.push(renderConditionAddToolbar(context, hasCharacterId));
  rows.push(renderAdvancedConditions(context));
  return rows;
}

function renderConditionAddToolbar(context: PageConditionContext, hasCharacterId: boolean): HTMLElement {
  const available = availableAddKinds(context, hasCharacterId);
  const kindSelect = el("select", {
    dataset: { testid: "event-page-condition-add-kind" },
  }) as HTMLSelectElement;
  for (const option of available) {
    kindSelect.append(el("option", { attrs: { value: option.value }, text: option.label }));
  }
  if (available.length === 0) {
    kindSelect.append(el("option", { attrs: { value: "" }, text: "추가 가능 조건 없음" }));
    kindSelect.disabled = true;
  }

  const addButton = el("button", {
    class: "btn small",
    text: "조건 추가",
    attrs: available.length === 0 ? { type: "button", disabled: "true" } : { type: "button" },
    dataset: { testid: "event-page-condition-add" },
    on: {
      click: () => {
        const kind = kindSelect.value as AddableConditionKind;
        if (!kind) return;
        enableConditionKind(context, kind);
      },
    },
  });

  return el("div", {
    class: "event-condition-add-toolbar",
    dataset: { testid: "event-page-condition-add-toolbar" },
    children: [
      el("span", { class: "event-condition-label", text: "조건 추가" }),
      kindSelect,
      addButton,
    ],
  });
}

function availableAddKinds(
  context: PageConditionContext,
  hasCharacterId: boolean
): readonly { value: AddableConditionKind; label: string }[] {
  const page = context.page;
  const options: { value: AddableConditionKind; label: string }[] = [];
  for (const option of CORE_ADD_KINDS) {
    if (!isConditionKindActive(page, option.value)) options.push(option);
  }
  for (const option of LONG_TAIL_ADD_KINDS) {
    if (option.value === "friendshipAtLeast" && !hasCharacterId) continue;
    if (!isConditionKindActive(page, option.value)) options.push(option);
  }
  return options;
}

function isConditionKindActive(page: EventPage, kind: AddableConditionKind): boolean {
  if (kind === "timer1") {
    return page.conditions.some((item) => item.kind === "timer" && item.timerId === "timer1");
  }
  if (kind === "timer2") {
    return page.conditions.some((item) => item.kind === "timer" && item.timerId === "timer2");
  }
  return page.conditions.some((item) => item.kind === kind);
}

function enableConditionKind(context: PageConditionContext, kind: AddableConditionKind): void {
  if (kind === "timer1") {
    toggleTimerCondition(context, "timer1", true);
    return;
  }
  if (kind === "timer2") {
    toggleTimerCondition(context, "timer2", true);
    return;
  }
  // Ensure default seed lands even if toggleSimpleCondition finds no first record.
  const seeded = defaultSimpleCondition(kind as SimpleConditionKind);
  if (!seeded) return;
  toggleSimpleCondition(context, kind as SimpleConditionKind, true);
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
  // 이전 RM 스타일: 비활성 행도 라벨·컨트롤 자리를 유지한다(접어 숨기지 않음).
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
  const apply = (switchId: string) => {
    const next = withoutNthCondition(params.page.conditions, "switch", params.slot);
    if (switchId) next.push({ kind: "switch", switchId, value: true });
    updateEventPage(params.mapId, params.eventId, params.page.id, { conditions: next });
  };
  const picker = switchVariableIdPicker({
    kind: "switch",
    currentId: condition?.switchId ?? "",
    inputTestId: `${params.testPrefix}-input`,
    pickerTestId: `${params.testPrefix}-picker-open`,
    onChange: apply,
  });
  return el("div", { class: "event-condition-control switch", children: [picker] });
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
  const apply = (actorId: string) => {
    const next = withoutFirstCondition(context.page.conditions, "actor");
    if (actorId) next.push({ kind: "actor", actorId, present: true });
    updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
  };
  const actor = databaseRecordSelect({
    kind: "actor",
    currentId: condition?.kind === "actor" ? condition.actorId : "",
    testId: "event-page-actor-condition-input",
    onChange: apply,
  });
  return el("div", { class: "event-condition-control record", children: [actor] });
}

function itemConditionInputs(context: PageConditionContext): HTMLElement {
  const condition = context.page.conditions.find((item) => item.kind === "item");
  const apply = (itemId: string) => {
    const next = withoutFirstCondition(context.page.conditions, "item");
    if (itemId) next.push({ kind: "item", itemId, present: true });
    updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
  };
  const item = databaseRecordSelect({
    kind: "item",
    currentId: condition?.kind === "item" ? condition.itemId : "",
    testId: "event-page-item-condition-input",
    onChange: apply,
  });
  return el("div", { class: "event-condition-control record", children: [item] });
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
    attrs: { type: "text", placeholder: "work" },
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
    }
  );
}
