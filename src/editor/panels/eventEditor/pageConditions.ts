import { updateEventPage } from "@/editor/eventPages";
import { el } from "@/util/dom";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { CONDITION_OP_OPTIONS } from "./options";
import { npcActivitySuggestionList, renderFriendshipAtLeastCondition, renderInsideLocationCondition, renderRelationshipAtLeastCondition, selfSwitchControl, SEASON_OPTIONS, TIME_PHASE_OPTIONS } from "./conditionForm";
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
  // 조건 12종을 늘 펼쳐 두면 첫 화면이 «체크 안 된 행» 으로 덮인다. 칩으로 골라 켠 것만 목록에 남긴다 —
  // 발견 가능성은 칩이 지고(종류가 늘 다 보인다), 화면 부피는 켠 개수만큼만 든다.
  const specs: readonly ConditionRowSpec[] = [
    {
      key: "switch1",
      chipLabel: "스위치",
      label: "스위치",
      build: (markActive) => switchConditionInputs({ ...context, slot: 0, testPrefix: "event-page-switch-condition" }, markActive),
      enabled: switchConditionAt(page, 0) !== undefined,
      suffix: "",
      toggle: (enabled) => toggleSwitchCondition({ ...context, slot: 0 }, enabled),
    },
    {
      key: "switch2",
      chipLabel: "스위치 2",
      label: "스위치",
      build: (markActive) => switchConditionInputs({ ...context, slot: 1, testPrefix: "event-page-switch2-condition" }, markActive),
      enabled: switchConditionAt(page, 1) !== undefined,
      suffix: "",
      toggle: (enabled) => toggleSwitchCondition({ ...context, slot: 1 }, enabled),
    },
    {
      key: "variable",
      chipLabel: "변수",
      label: "변수",
      build: (markActive) => variableConditionInputs(context, markActive),
      enabled: page.conditions.some((item) => item.kind === "variable"),
      suffix: "이",
      toggle: (enabled) => toggleSimpleCondition(context, "variable", enabled),
    },
    {
      key: "item",
      chipLabel: "아이템",
      label: "아이템",
      build: (markActive) => itemConditionInputs(context, markActive),
      enabled: page.conditions.some((item) => item.kind === "item"),
      suffix: "",
      toggle: (enabled) => toggleSimpleCondition(context, "item", enabled),
    },
    {
      key: "actor",
      chipLabel: "주인공",
      label: "주인공",
      build: (markActive) => actorConditionInputs(context, markActive),
      enabled: page.conditions.some((item) => item.kind === "actor"),
      suffix: "",
      toggle: (enabled) => toggleSimpleCondition(context, "actor", enabled),
    },
    {
      key: "timer1",
      chipLabel: "타이머 1",
      label: "타이머 1",
      build: (markActive) => timerConditionInputs(context, "timer1", markActive),
      enabled: timerCondition(context, "timer1") !== undefined,
      suffix: "이하",
      toggle: (enabled) => toggleTimerCondition(context, "timer1", enabled),
    },
    {
      key: "timer2",
      chipLabel: "타이머 2",
      label: "타이머 2",
      build: (markActive) => timerConditionInputs(context, "timer2", markActive),
      enabled: timerCondition(context, "timer2") !== undefined,
      suffix: "이하",
      toggle: (enabled) => toggleTimerCondition(context, "timer2", enabled),
    },
    {
      key: "timePhase",
      chipLabel: "시간대",
      label: "시간대",
      build: (markActive) => timePhaseConditionInputs(context, markActive),
      enabled: page.conditions.some((item) => item.kind === "timePhase"),
      suffix: "일 때",
      toggle: (enabled) => toggleSimpleCondition(context, "timePhase", enabled),
    },
    {
      key: "season",
      chipLabel: "계절",
      label: "계절",
      build: (markActive) => seasonConditionInputs(context, markActive),
      enabled: page.conditions.some((item) => item.kind === "season"),
      suffix: "일 때",
      toggle: (enabled) => toggleSimpleCondition(context, "season", enabled),
    },
    {
      key: "npcActivity",
      chipLabel: "활동",
      label: "활동",
      build: (markActive) => npcActivityConditionInputs(context, markActive),
      enabled: page.conditions.some((item) => item.kind === "npcActivity"),
      suffix: "일 때",
      toggle: (enabled) => toggleSimpleCondition(context, "npcActivity", enabled),
    },
    {
      key: "insideLocation",
      chipLabel: "구역",
      label: "구역",
      build: (markActive) => insideLocationConditionInputs(context, markActive),
      enabled: page.conditions.some((item) => item.kind === "insideLocation"),
      suffix: "",
      toggle: (enabled) => toggleSimpleCondition(context, "insideLocation", enabled),
    },
    {
      key: "friendship",
      chipLabel: "호감도",
      label: "호감도",
      build: (markActive) => friendshipConditionInputs(context, markActive),
      enabled: page.conditions.some((item) => item.kind === "friendshipAtLeast"),
      suffix: "이상",
      toggle: (enabled) => toggleSimpleCondition(context, "friendshipAtLeast", enabled),
    },
    {
      key: "relationship",
      chipLabel: "관계",
      label: "관계",
      build: (markActive) => relationshipConditionInputs(context, markActive),
      enabled: page.conditions.some((item) => item.kind === "relationshipAtLeast"),
      suffix: "이상",
      toggle: (enabled) => toggleSimpleCondition(context, "relationshipAtLeast", enabled),
    },
    {
      key: "selfSwitch",
      chipLabel: "이 이벤트 기억",
      label: "이 이벤트 기억",
      build: (markActive) => selfSwitchConditionInputs(context, markActive),
      enabled: selfSwitchConditionAt(page) !== undefined,
      suffix: "",
      toggle: (enabled) => toggleSelfSwitchCondition(context, enabled),
    },
  ];

  const palette = el("div", {
    class: "event-condition-palette",
    dataset: { testid: "event-condition-palette" },
    children: specs.map((spec) => conditionChip(spec)),
  });

  const picked = specs.filter((spec) => spec.enabled);
  const list = el("div", {
    class: "event-condition-list",
    dataset: { testid: "event-condition-list" },
    children: picked.length
      ? picked.map((spec) => conditionRow(spec.label, spec.build, spec.enabled, spec.suffix, spec.toggle))
      : [
          el("p", {
            class: "event-condition-empty",
            dataset: { testid: "event-condition-empty" },
            text: "조건을 안 걸면 이 페이지가 늘 쓰입니다. 위에서 골라 담으세요.",
          }),
        ],
  });

  return [
    palette,
    list,
    renderAdvancedConditions(context),
  ];
}

interface ConditionRowSpec {
  readonly key: string;
  /** 칩에 적는 이름. 같은 라벨을 쓰는 스위치 두 슬롯을 칩에서는 갈라 적는다. */
  readonly chipLabel: string;
  readonly label: string;
  readonly build: (markActive: () => void) => HTMLElement;
  readonly enabled: boolean;
  readonly suffix: string;
  readonly toggle: (enabled: boolean) => void;
}

/** 조건 종류를 담고/빼는 칩. 켠 칩은 aria-pressed 로 상태를 말한다. */
function conditionChip(spec: ConditionRowSpec): HTMLElement {
  const chip = el("button", {
    class: `event-condition-chip${spec.enabled ? " active" : ""}`,
    attrs: { type: "button", "aria-pressed": spec.enabled ? "true" : "false" },
    dataset: { testid: `event-condition-chip-${spec.key}` },
    text: spec.chipLabel,
  });
  chip.addEventListener("click", () => spec.toggle(!spec.enabled));
  return chip;
}

function conditionRow(
  label: string,
  buildControl: (markActive: () => void) => HTMLElement,
  checked: boolean,
  suffix: string,
  onToggle: (enabled: boolean) => void,
): HTMLElement {
  const enabled = el("input", {
    attrs: { type: "checkbox", "aria-label": `${label} 조건 사용` },
  }) as HTMLInputElement;
  enabled.checked = checked;
  enabled.addEventListener("change", () => onToggle(enabled.checked));
  // 비활성 행의 컨트롤을 만지면 그 행이 켜진다. 컨트롤을 죽여 두면 저작자가 값을 바꿨는데
  // 아무 일도 안 나고, 예전처럼 조용히 심으면 체크가 꺼진 채 조건이 늘어난다 — 둘 다 거짓말이다.
  const markActive = (): void => {
    enabled.checked = true;
    row.dataset.conditionActive = "true";
    row.classList.remove("disabled");
  };
  // 비활성도 컨트롤 자리를 남긴다. 숨기면 체크+라벨만 붙어 레이아웃이 무너진다.
  const row = el("div", {
    class: `event-condition-row${checked ? "" : " disabled"}`,
    dataset: {
      conditionActive: checked ? "true" : "false",
      testid: `event-condition-row-${label}`,
    },
    children: [
      enabled,
      el("span", { class: "event-condition-label", text: label }),
      buildControl(() => markActive()),
      el("span", {
        class: "event-condition-suffix",
        text: suffix,
      }),
    ],
  });
  return row;
}

/** 참조가 비었을 때 조건을 지우는 대신 띄우는 인라인 오류 (조건 분기 폼과 같은 계약). */
function referenceError(testId: string, text: string, hasId: () => boolean): { readonly node: HTMLElement; readonly sync: () => void } {
  const node = el("p", {
    class: "event-condition-error",
    text,
    dataset: { testid: testId },
  });
  const sync = (): void => { node.hidden = hasId(); };
  sync();
  return { node, sync };
}

function switchConditionInputs(params: SwitchConditionParams, markActive: () => void): HTMLElement {
  const condition = switchConditionAt(params.page, params.slot);
  let currentSwitchId = condition?.switchId ?? "";
  const value = selectWithOptions(
    SWITCH_VALUE_OPTIONS,
    condition?.value === false ? "off" : "on",
    `${params.testPrefix}-value`
  );
  const error = referenceError(`${params.testPrefix}-error`, "대상 스위치를 선택하세요.", () => Boolean(currentSwitchId.trim()));
  const apply = () => {
    // 참조가 비어도 조건을 지우지 않는다. 지우면 저작한 방향(꺼짐)까지 조용히 사라진다.
    const next = withoutNthCondition(params.page.conditions, "switch", params.slot);
    next.push({
      kind: "switch",
      switchId: currentSwitchId,
      value: selectedOptionValue(value, SWITCH_VALUE_OPTIONS, "on") === "on",
    });
    error.sync();
    markActive();
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
  return el("div", { class: "event-condition-control switch", children: [picker, value, error.node] });
}

function variableConditionInputs(context: PageConditionContext, markActive: () => void): HTMLElement {
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
  const error = referenceError("event-page-variable-condition-error", "대상 변수를 선택하세요.", () => Boolean(currentVariableId.trim()));
  const apply = () => {
    const next = withoutFirstCondition(context.page.conditions, "variable");
    next.push({
      kind: "variable",
      variableId: currentVariableId,
      op: selectedOptionValue(op, CONDITION_OP_OPTIONS, ">="),
      value: parseInt(value.value, 10) || 0,
    });
    error.sync();
    markActive();
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
      error.node,
    ],
  });
}

function actorConditionInputs(context: PageConditionContext, markActive: () => void): HTMLElement {
  const condition = context.page.conditions.find((item) => item.kind === "actor");
  let currentActorId = condition?.kind === "actor" ? condition.actorId : "";
  const present = selectWithOptions(
    ACTOR_PRESENT_OPTIONS,
    condition?.kind === "actor" && condition.present === false ? "absent" : "present",
    "event-page-actor-condition-present"
  );
  const error = referenceError("event-page-actor-condition-error", "주인공을 선택하세요.", () => Boolean(currentActorId.trim()));
  const apply = () => {
    const next = withoutFirstCondition(context.page.conditions, "actor");
    next.push({
      kind: "actor",
      actorId: currentActorId,
      present: selectedOptionValue(present, ACTOR_PRESENT_OPTIONS, "present") === "present",
    });
    error.sync();
    markActive();
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
  return el("div", { class: "event-condition-control record", children: [actor, present, error.node] });
}

function itemConditionInputs(context: PageConditionContext, markActive: () => void): HTMLElement {
  const condition = context.page.conditions.find((item) => item.kind === "item");
  let currentItemId = condition?.kind === "item" ? condition.itemId : "";
  const present = selectWithOptions(
    ITEM_PRESENT_OPTIONS,
    condition?.kind === "item" && condition.present === false ? "absent" : "present",
    "event-page-item-condition-present"
  );
  const error = referenceError("event-page-item-condition-error", "아이템을 선택하세요.", () => Boolean(currentItemId.trim()));
  const apply = () => {
    const next = withoutFirstCondition(context.page.conditions, "item");
    next.push({
      kind: "item",
      itemId: currentItemId,
      present: selectedOptionValue(present, ITEM_PRESENT_OPTIONS, "present") === "present",
    });
    error.sync();
    markActive();
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
  return el("div", { class: "event-condition-control record", children: [item, present, error.node] });
}

function timerConditionInputs(context: PageConditionContext, timerId: "timer1" | "timer2", markActive: () => void): HTMLElement {
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
      markActive();
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

function timePhaseConditionInputs(context: PageConditionContext, markActive: () => void): HTMLElement {
  const condition = context.page.conditions.find((item) => item.kind === "timePhase");
  const phase = selectWithOptions(
    TIME_PHASE_OPTIONS,
    condition?.kind === "timePhase" ? condition.phase : "day",
    "event-page-time-phase-condition-input"
  );
  phase.addEventListener("change", () => {
    const next = withoutFirstCondition(context.page.conditions, "timePhase");
    next.push({ kind: "timePhase", phase: selectedOptionValue(phase, TIME_PHASE_OPTIONS, "day") });
    markActive();
    updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
  });
  return el("div", { class: "event-condition-control time-phase", children: [phase] });
}

function seasonConditionInputs(context: PageConditionContext, markActive: () => void): HTMLElement {
  const condition = context.page.conditions.find((item) => item.kind === "season");
  const season = selectWithOptions(
    SEASON_OPTIONS,
    condition?.kind === "season" ? condition.season : "spring",
    "event-page-season-condition-input"
  );
  season.addEventListener("change", () => {
    const next = withoutFirstCondition(context.page.conditions, "season");
    next.push({ kind: "season", season: selectedOptionValue(season, SEASON_OPTIONS, "spring") });
    markActive();
    updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
  });
  return el("div", { class: "event-condition-control season", children: [season] });
}

function insideLocationConditionInputs(context: PageConditionContext, markActive: () => void): HTMLElement {
  const condition = context.page.conditions.find((item) => item.kind === "insideLocation");
  return renderInsideLocationCondition(
    condition?.kind === "insideLocation" ? condition : { kind: "insideLocation", locationId: "", inside: true },
    (next) => {
      if (next.kind !== "insideLocation") return;
      const existing = withoutFirstCondition(context.page.conditions, "insideLocation");
      existing.push(next);
      markActive();
      updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: existing });
    },
    {
      className: "event-condition-control inside-location",
      locationTestId: "event-page-inside-location-condition-input",
    },
  );
}

function npcActivityConditionInputs(context: PageConditionContext, markActive: () => void): HTMLElement {
  const condition = context.page.conditions.find((item) => item.kind === "npcActivity");
  const listId = "event-page-npc-activity-condition-options";
  const activity = el("input", {
    attrs: { type: "text", placeholder: "일", list: listId },
    value: condition?.kind === "npcActivity" ? condition.activity : "work",
    dataset: { testid: "event-page-npc-activity-condition-input" },
  }) as HTMLInputElement;
  activity.addEventListener("change", () => {
    const next = withoutFirstCondition(context.page.conditions, "npcActivity");
    const label = activity.value.trim();
    if (label) {
      next.push({ kind: "npcActivity", activity: label });
      markActive();
    }
    updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
  });
  return el("div", {
    class: "event-condition-control npc-activity",
    children: [activity, npcActivitySuggestionList(listId)],
  });
}

function friendshipConditionInputs(context: PageConditionContext, markActive: () => void): HTMLElement {
  const condition = context.page.conditions.find((item) => item.kind === "friendshipAtLeast");
  return renderFriendshipAtLeastCondition(
    condition?.kind === "friendshipAtLeast" ? condition : { kind: "friendshipAtLeast", value: 100 },
    (next) => {
      const existing = withoutFirstCondition(context.page.conditions, "friendshipAtLeast");
      existing.push(next);
      markActive();
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
function relationshipConditionInputs(context: PageConditionContext, markActive: () => void): HTMLElement {
  const condition = context.page.conditions.find((item) => item.kind === "relationshipAtLeast");
  return renderRelationshipAtLeastCondition(
    condition?.kind === "relationshipAtLeast" ? condition : { kind: "relationshipAtLeast", state: "dating" },
    (next) => {
      const existing = withoutFirstCondition(context.page.conditions, "relationshipAtLeast");
      existing.push(next);
      markActive();
      updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: existing });
    },
    {
      className: "event-condition-control relationship",
      npcKeyTestId: "event-page-relationship-condition-npc-key",
      stateTestId: "event-page-relationship-condition-state",
      hostHasCharacterId: context.hostHasCharacterId === true,
    }
  );
}

function selfSwitchConditionInputs(context: PageConditionContext, markActive: () => void): HTMLElement {
  const condition = selfSwitchConditionAt(context.page);
  return selfSwitchControl(
    condition?.key ?? "A",
    condition?.value ?? true,
    (key, value) => {
      const next = withoutFirstCondition(context.page.conditions, "selfSwitch");
      next.push({ kind: "selfSwitch", key, value });
      markActive();
      updateEventPage(context.mapId, context.eventId, context.page.id, { conditions: next });
    },
    {
      keyTestId: "event-page-self-switch-condition-key",
      valueTestId: "event-page-self-switch-condition-value",
    }
  );
}
