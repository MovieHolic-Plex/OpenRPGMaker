import { el } from "@/util/dom";
import { numberedName } from "@/editor/panels/databaseDisplay";
import { store } from "@/project/store";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { BOOLEAN_OPTIONS, CONDITION_OP_OPTIONS, SELF_SWITCH_KEY_OPTIONS } from "./options";
import { databasePicker } from "./switchVariablePicker";
import type { ActorId, Condition, ItemId, Season, TimePhase } from "@/project/types";

export { databasePicker, switchPicker, switchVariablePicker, variablePicker } from "./switchVariablePicker";

const CONDITION_MODE_OPTIONS = [
  { value: "switch", label: "스위치" },
  { value: "variable", label: "변수" },
  { value: "selfSwitch", label: "셀프 스위치" },
  { value: "actor", label: "주인공" },
  { value: "item", label: "아이템" },
  { value: "gold", label: "소지금" },
  { value: "timer", label: "타이머" },
  { value: "timePhase", label: "시간대" },
  { value: "season", label: "계절" },
  { value: "npcActivity", label: "활동" },
  { value: "friendshipAtLeast", label: "호감도" },
  { value: "battleResult", label: "전투 결과" },
  { value: "all", label: "모두(AND)" },
  { value: "any", label: "하나(OR)" },
  { value: "not", label: "아님(NOT)" },
] as const;

const SWITCH_STATE_OPTIONS = [
  { value: "true", label: "ON" },
  { value: "false", label: "OFF" },
] as const;

export const TIME_PHASE_OPTIONS = [
  { value: "morning", label: "아침" },
  { value: "day", label: "낮" },
  { value: "evening", label: "저녁" },
  { value: "night", label: "밤" },
] as const satisfies readonly { readonly value: TimePhase; readonly label: string }[];

export const SEASON_OPTIONS = [
  { value: "spring", label: "봄" },
  { value: "summer", label: "여름" },
  { value: "fall", label: "가을" },
  { value: "winter", label: "겨울" },
] as const satisfies readonly { readonly value: Season; readonly label: string }[];

/**
 * 조건 분기 / 조건 편집용 폼.
 * bare select 스택이 아니라 라벨 붙은 세로 필드로 구성한다.
 */
export function conditionForm(cond: Condition, onChange: (condition: Condition) => void): HTMLElement {
  const wrap = el("div", {
    class: "event-condition-form",
    dataset: { testid: "event-condition-form" },
  });

  const mode = selectWithOptions(CONDITION_MODE_OPTIONS, cond.kind, "event-condition-mode");
  mode.addEventListener("change", () => {
    switch (mode.value) {
      case "switch":
        onChange({ kind: "switch", switchId: "", value: true });
        return;
      case "variable":
        onChange({ kind: "variable", variableId: "", op: ">=", value: 0 });
        return;
      case "selfSwitch":
        onChange({ kind: "selfSwitch", key: "A", value: true });
        return;
      case "actor":
        onChange({ kind: "actor", actorId: firstActorId(), present: true });
        return;
      case "item":
        onChange({ kind: "item", itemId: firstItemId(), present: true });
        return;
      case "gold":
        onChange({ kind: "gold", op: ">=", amount: 100 });
        return;
      case "timer":
        onChange({ kind: "timer", timerId: "timer1", seconds: 60 });
        return;
      case "timePhase":
        onChange({ kind: "timePhase", phase: "day" });
        return;
      case "season":
        onChange({ kind: "season", season: "spring" });
        return;
      case "npcActivity":
        onChange({ kind: "npcActivity", activity: "work" });
        return;
      case "friendshipAtLeast":
        onChange({ kind: "friendshipAtLeast", value: 100 });
        return;
      case "battleResult":
        onChange({ kind: "battleResult", result: "victory" });
        return;
      case "all":
        onChange({ kind: "all", conditions: [{ kind: "switch", switchId: "", value: true }] });
        return;
      case "any":
        onChange({ kind: "any", conditions: [{ kind: "switch", switchId: "", value: true }] });
        return;
      case "not":
        onChange({ kind: "not", condition: { kind: "switch", switchId: "", value: true } });
        return;
    }
  });

  wrap.append(field("조건 종류", mode));

  switch (cond.kind) {
    case "switch":
      wrap.append(labeledSwitch(cond, onChange));
      break;
    case "variable":
      wrap.append(labeledVariable(cond, onChange));
      break;
    case "selfSwitch":
      wrap.append(labeledSelfSwitch(cond, onChange));
      break;
    case "actor":
      wrap.append(labeledActor(cond, onChange));
      break;
    case "item":
      wrap.append(labeledItem(cond, onChange));
      break;
    case "gold":
      wrap.append(labeledGold(cond, onChange));
      break;
    case "timer":
      wrap.append(labeledTimer(cond, onChange));
      break;
    case "timePhase":
      wrap.append(field("시간대", renderTimePhaseCondition(cond, onChange)));
      break;
    case "season":
      wrap.append(field("계절", renderSeasonCondition(cond, onChange)));
      break;
    case "npcActivity":
      wrap.append(field("활동 ID", renderNpcActivityCondition(cond, onChange)));
      break;
    case "friendshipAtLeast":
      wrap.append(labeledFriendship(cond, onChange));
      break;
    case "battleResult":
      wrap.append(labeledBattleResult(cond, onChange));
      break;
    case "all":
    case "any":
      wrap.append(labeledGroup(cond, onChange));
      break;
    case "not":
      wrap.append(labeledNot(cond, onChange));
      break;
  }

  wrap.append(
    el("p", {
      class: "event-condition-hint",
      text: conditionHint(cond.kind),
      dataset: { testid: "event-condition-hint" },
    })
  );
  return wrap;
}

function labeledSwitch(
  cond: Extract<Condition, { kind: "switch" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  let currentSwitchId = cond.switchId;
  const sw = databasePicker("switch", cond.switchId, (switchId) => {
    currentSwitchId = switchId;
    onChange({ kind: "switch", switchId, value: cond.value });
  }, "event-condition-switch-target");
  const val = selectWithOptions(SWITCH_STATE_OPTIONS, String(cond.value), "event-condition-switch-value");
  val.addEventListener("change", () => {
    onChange({ kind: "switch", switchId: currentSwitchId, value: val.value === "true" });
  });
  box.append(field("대상 스위치", sw), field("상태", val));
  return box;
}

function labeledVariable(
  cond: Extract<Condition, { kind: "variable" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  let currentVariableId = cond.variableId;
  const variable = databasePicker("variable", cond.variableId, (variableId) => {
    currentVariableId = variableId;
    onChange({ kind: "variable", variableId, op: cond.op, value: cond.value });
  }, "event-condition-variable-target");
  const op = selectWithOptions(CONDITION_OP_OPTIONS, cond.op, "event-condition-variable-op");
  const value = el("input", {
    attrs: { type: "number", step: "1" },
    value: String(cond.value),
    dataset: { testid: "event-condition-variable-value" },
  }) as HTMLInputElement;
  const apply = (): void => {
    onChange({
      kind: "variable",
      variableId: currentVariableId,
      op: selectedOptionValue(op, CONDITION_OP_OPTIONS, cond.op),
      value: parseInt(value.value, 10) || 0,
    });
  };
  op.addEventListener("change", apply);
  value.addEventListener("change", apply);
  value.addEventListener("blur", apply);
  box.append(field("대상 변수", variable), field("비교", op), field("비교 값", value));
  return box;
}

function labeledSelfSwitch(
  cond: Extract<Condition, { kind: "selfSwitch" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  const key = selectWithOptions(SELF_SWITCH_KEY_OPTIONS, cond.key, "event-condition-self-switch-key");
  const val = selectWithOptions(SWITCH_STATE_OPTIONS, String(cond.value), "event-condition-self-switch-value");
  const apply = (): void => {
    onChange({
      kind: "selfSwitch",
      key: key.value as "A" | "B" | "C" | "D",
      value: val.value === "true",
    });
  };
  key.addEventListener("change", apply);
  val.addEventListener("change", apply);
  box.append(field("키", key), field("상태", val));
  return box;
}

function labeledActor(
  cond: Extract<Condition, { kind: "actor" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  let currentActorId = cond.actorId;
  const sel = actorPicker(cond.actorId, (actorId) => {
    currentActorId = actorId;
    onChange({ kind: "actor", actorId, present: cond.present });
  });
  const present = el("select", { dataset: { testid: "event-condition-actor-present" } }) as HTMLSelectElement;
  present.append(
    el("option", { text: "파티에 있음", attrs: { value: "true" } }),
    el("option", { text: "파티에 없음", attrs: { value: "false" } })
  );
  present.value = String(cond.present);
  present.addEventListener("change", () => {
    onChange({ kind: "actor", actorId: currentActorId, present: present.value === "true" });
  });
  box.append(field("주인공", sel), field("파티 상태", present));
  return box;
}

function labeledItem(
  cond: Extract<Condition, { kind: "item" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  let currentItemId = cond.itemId;
  const sel = itemPicker(cond.itemId, (itemId) => {
    currentItemId = itemId;
    onChange({ kind: "item", itemId, present: cond.present });
  });
  const present = el("select", { dataset: { testid: "event-condition-item-present" } }) as HTMLSelectElement;
  present.append(
    el("option", { text: "소지함", attrs: { value: "true" } }),
    el("option", { text: "소지 안 함", attrs: { value: "false" } })
  );
  present.value = String(cond.present);
  present.addEventListener("change", () => {
    onChange({ kind: "item", itemId: currentItemId, present: present.value === "true" });
  });
  box.append(field("아이템", sel), field("소지 여부", present));
  return box;
}

function labeledGold(
  cond: Extract<Condition, { kind: "gold" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  const op = selectWithOptions(CONDITION_OP_OPTIONS, cond.op, "event-condition-gold-op");
  const amount = el("input", {
    attrs: { type: "number", min: "0" },
    value: String(cond.amount),
    dataset: { testid: "event-condition-gold-amount" },
  }) as HTMLInputElement;
  const apply = (): void => {
    onChange({
      kind: "gold",
      op: selectedOptionValue(op, CONDITION_OP_OPTIONS, cond.op),
      amount: parseInt(amount.value, 10) || 0,
    });
  };
  op.addEventListener("change", apply);
  amount.addEventListener("change", apply);
  box.append(field("비교", op), field("금액", amount));
  return box;
}

function labeledTimer(
  cond: Extract<Condition, { kind: "timer" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  const timerId = el("select", { dataset: { testid: "event-condition-timer-id" } }) as HTMLSelectElement;
  timerId.append(
    el("option", { text: "타이머 1", attrs: { value: "timer1" } }),
    el("option", { text: "타이머 2", attrs: { value: "timer2" } })
  );
  timerId.value = cond.timerId;
  const seconds = el("input", {
    attrs: { type: "number", min: "0" },
    value: String(cond.seconds),
    dataset: { testid: "event-condition-timer-seconds" },
  }) as HTMLInputElement;
  const apply = (): void => {
    onChange({
      kind: "timer",
      timerId: timerId.value === "timer2" ? "timer2" : "timer1",
      seconds: parseInt(seconds.value, 10) || 0,
    });
  };
  timerId.addEventListener("change", apply);
  seconds.addEventListener("change", apply);
  box.append(field("타이머", timerId), field("남은 초 ≤", seconds));
  return box;
}

function labeledFriendship(
  cond: Extract<Condition, { kind: "friendshipAtLeast" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  const npcKey = el("input", {
    attrs: { type: "text", placeholder: "비우면 이 이벤트" },
    value: cond.npcKey ?? "",
    dataset: { testid: "event-condition-friendship-npc-key" },
  }) as HTMLInputElement;
  const value = el("input", {
    attrs: { type: "number", min: "0", max: "1000" },
    value: String(cond.value),
    dataset: { testid: "event-condition-friendship-value" },
  }) as HTMLInputElement;
  const apply = (): void => {
    onChange({
      kind: "friendshipAtLeast",
      npcKey: npcKey.value.trim() || undefined,
      value: parseInt(value.value, 10) || 0,
    });
  };
  npcKey.addEventListener("change", apply);
  value.addEventListener("change", apply);
  box.append(field("NPC 키", npcKey), field("최소 호감도", value));
  return box;
}

function labeledBattleResult(
  cond: Extract<Condition, { kind: "battleResult" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  const select = selectWithOptions(
    [
      { value: "victory", label: "승리" },
      { value: "defeat", label: "패배" },
      { value: "escape", label: "도망" },
    ] as const,
    cond.result,
    "event-condition-battle-result",
  );
  select.addEventListener("change", () => {
    const result = selectedOptionValue(select, [
      { value: "victory", label: "승리" },
      { value: "defeat", label: "패배" },
      { value: "escape", label: "도망" },
    ] as const, cond.result);
    onChange({ kind: "battleResult", result });
  });
  box.append(field("결과", select));
  return box;
}

function labeledGroup(
  cond: Extract<Condition, { kind: "all" | "any" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", {
    class: "event-condition-group",
    dataset: { testid: `event-condition-group-${cond.kind}` },
  });
  const list = el("div", { class: "event-condition-group-list" });
  const children = cond.conditions.length > 0 ? cond.conditions : [{ kind: "switch" as const, switchId: "", value: true }];
  children.forEach((child, index) => {
    const card = el("div", {
      class: "event-condition-group-item",
      dataset: { testid: `event-condition-group-item-${index}` },
    });
    card.append(
      el("div", { class: "event-condition-group-item-title", text: `조건 ${index + 1}` }),
      conditionForm(child, (nextChild) => {
        const next = children.map((entry, i) => (i === index ? nextChild : entry));
        onChange({ kind: cond.kind, conditions: next });
      }),
      el("button", {
        class: "btn danger",
        text: "제거",
        attrs: { type: "button" },
        dataset: { testid: `event-condition-group-remove-${index}` },
        on: {
          click: () => {
            const next = children.filter((_, i) => i !== index);
            onChange({ kind: cond.kind, conditions: next.length ? next : [{ kind: "switch", switchId: "", value: true }] });
          },
        },
      })
    );
    list.append(card);
  });
  box.append(
    list,
    el("button", {
      class: "btn",
      text: "+ 하위 조건",
      attrs: { type: "button" },
      dataset: { testid: "event-condition-group-add" },
      on: {
        click: () => {
          onChange({
            kind: cond.kind,
            conditions: [...children, { kind: "switch", switchId: "", value: true }],
          });
        },
      },
    })
  );
  return box;
}

function labeledNot(
  cond: Extract<Condition, { kind: "not" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", {
    class: "event-condition-group event-condition-not",
    dataset: { testid: "event-condition-not" },
  });
  box.append(
    el("div", { class: "event-condition-group-item-title", text: "반대 조건" }),
    conditionForm(cond.condition, (nextChild) => onChange({ kind: "not", condition: nextChild }))
  );
  return box;
}

function field(label: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "inline-field event-condition-field",
    children: [el("span", { class: "event-condition-field-label", text: label }), control],
  });
}

function conditionHint(kind: Condition["kind"]): string {
  switch (kind) {
    case "switch":
      return "선택한 스위치가 ON/OFF 인 경우 참 분기로 들어갑니다.";
    case "variable":
      return "변수 값과 비교 값의 관계가 맞으면 참 분기로 들어갑니다.";
    case "selfSwitch":
      return "이 이벤트 전용 셀프 스위치(A~D) 상태를 검사합니다.";
    case "actor":
      return "파티에 해당 주인공이 있는지 검사합니다.";
    case "item":
      return "인벤토리 소지 여부를 검사합니다.";
    case "gold":
      return "현재 소지금을 비교합니다.";
    case "timer":
      return "타이머 남은 시간이 지정 초 이하인지 검사합니다.";
    case "timePhase":
      return "현재 시간대(아침/낮/저녁/밤)를 검사합니다.";
    case "season":
      return "현재 계절을 검사합니다.";
    case "npcActivity":
      return "NPC 스케줄 활동 ID가 일치하는지 검사합니다.";
    case "friendshipAtLeast":
      return "호감도가 지정 값 이상인지 검사합니다. NPC 키를 비우면 이 이벤트 기준입니다.";
    case "battleResult":
      return "직전 전투 처리(battleProcessing) 결과에 따라 분기합니다. 필드 몬스터 처치 후 이벤트 소거에 씁니다.";
    case "all":
      return "하위 조건을 모두 만족해야 참입니다 (AND).";
    case "any":
      return "하위 조건 중 하나라도 만족하면 참입니다 (OR).";
    case "not":
      return "하위 조건의 반대입니다 (NOT).";
    default:
      return "조건을 설정하면 우측 미리보기에 요약이 표시됩니다.";
  }
}

// --- Page condition / shared renderers (bare controls for existing page UI) ---

export function renderSwitchCondition(
  cond: Extract<Condition, { kind: "switch" }>,
  onChange: (condition: Condition) => void,
  options: {
    readonly picker?: (currentId: string, onChange: (id: string) => void) => HTMLElement;
    readonly showValue?: boolean;
    readonly forceTrueOnSwitchChange?: boolean;
    readonly className?: string;
  } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  let currentSwitchId = cond.switchId;
  const sw = (options.picker ?? ((switchId, onPick) => databasePicker("switch", switchId, onPick)))(cond.switchId, (switchId) => {
    currentSwitchId = switchId;
    onChange({ kind: "switch", switchId, value: options.forceTrueOnSwitchChange ? true : cond.value });
  });
  if (options.showValue === false) {
    row.append(sw);
    return row;
  }
  const val = selectWithOptions(BOOLEAN_OPTIONS, String(cond.value));
  val.addEventListener("change", () => {
    onChange({ kind: "switch", switchId: currentSwitchId, value: val.value === "true" });
  });
  row.append(sw, val);
  return row;
}

export function renderVariableCondition(
  cond: Extract<Condition, { kind: "variable" }>,
  onChange: (condition: Condition) => void,
  options: {
    readonly picker?: (currentId: string, onChange: (id: string) => void) => HTMLElement;
    readonly className?: string;
    readonly opTestId?: string;
    readonly valueTestId?: string;
  } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  let currentVariableId = cond.variableId;
  const variable = (options.picker ?? ((variableId, onPick) => databasePicker("variable", variableId, onPick)))(cond.variableId, (variableId) => {
    currentVariableId = variableId;
    onChange({ kind: "variable", variableId, op: cond.op, value: cond.value });
  });
  const op = selectWithOptions(CONDITION_OP_OPTIONS, cond.op, options.opTestId);
  const value = el("input", {
    attrs: { type: "number" },
    value: String(cond.value),
    dataset: options.valueTestId ? { testid: options.valueTestId } : undefined,
  }) as HTMLInputElement;
  const apply = () => {
    onChange({
      kind: "variable",
      variableId: currentVariableId,
      op: selectedOptionValue(op, CONDITION_OP_OPTIONS, cond.op),
      value: parseInt(value.value, 10) || 0,
    });
  };
  op.addEventListener("change", apply);
  value.addEventListener("change", apply);
  row.append(variable, op, value);
  return row;
}

export function renderSelfSwitchCondition(
  cond: Extract<Condition, { kind: "selfSwitch" }>,
  onChange: (condition: Condition) => void,
  options: {
    readonly className?: string;
    readonly keyTestId?: string;
    readonly valueTestId?: string;
  } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  const key = selectWithOptions(SELF_SWITCH_KEY_OPTIONS, cond.key, options.keyTestId ?? "event-condition-self-switch-key");
  const val = selectWithOptions(BOOLEAN_OPTIONS, String(cond.value), options.valueTestId ?? "event-condition-self-switch-value");
  const apply = () => {
    onChange({ kind: "selfSwitch", key: key.value as "A" | "B" | "C" | "D", value: val.value === "true" });
  };
  key.addEventListener("change", apply);
  val.addEventListener("change", apply);
  row.append(key, val);
  return row;
}

function actorPicker(currentId: ActorId, onChange: (id: ActorId) => void): HTMLElement {
  return recordSelect(store.getCurrent().database.actors, currentId, onChange, "event-condition-actor");
}

function itemPicker(currentId: ItemId, onChange: (id: ItemId) => void): HTMLElement {
  return recordSelect(store.getCurrent().database.items, currentId, onChange, "event-condition-item");
}

export function renderActorCondition(
  cond: Extract<Condition, { kind: "actor" }>,
  onChange: (condition: Condition) => void,
  options: {
    readonly picker?: (currentId: ActorId, onChange: (id: ActorId) => void) => HTMLElement;
    readonly showPresent?: boolean;
    readonly forcePresentOnActorChange?: boolean;
    readonly className?: string;
  } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  let currentActorId = cond.actorId;
  const sel = (options.picker ?? actorPicker)(cond.actorId, (actorId) => {
    currentActorId = actorId;
    onChange({ kind: "actor", actorId, present: options.forcePresentOnActorChange ? true : cond.present });
  });
  if (options.showPresent === false) {
    row.append(sel);
    return row;
  }
  const present = el("select", { dataset: { testid: "event-condition-actor-present" } }) as HTMLSelectElement;
  present.append(
    el("option", { text: "파티에 있음", attrs: { value: "true" } }),
    el("option", { text: "파티에 없음", attrs: { value: "false" } })
  );
  present.value = String(cond.present);
  present.addEventListener("change", () => {
    onChange({ kind: "actor", actorId: currentActorId, present: present.value === "true" });
  });
  row.append(sel, present);
  return row;
}

export function renderItemCondition(
  cond: Extract<Condition, { kind: "item" }>,
  onChange: (condition: Condition) => void,
  options: {
    readonly picker?: (currentId: ItemId, onChange: (id: ItemId) => void) => HTMLElement;
    readonly showPresent?: boolean;
    readonly forcePresentOnItemChange?: boolean;
    readonly className?: string;
  } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  let currentItemId = cond.itemId;
  const sel = (options.picker ?? itemPicker)(cond.itemId, (itemId) => {
    currentItemId = itemId;
    onChange({ kind: "item", itemId, present: options.forcePresentOnItemChange ? true : cond.present });
  });
  if (options.showPresent === false) {
    row.append(sel);
    return row;
  }
  const present = el("select", { dataset: { testid: "event-condition-item-present" } }) as HTMLSelectElement;
  present.append(
    el("option", { text: "소지함", attrs: { value: "true" } }),
    el("option", { text: "소지 안 함", attrs: { value: "false" } })
  );
  present.value = String(cond.present);
  present.addEventListener("change", () => {
    onChange({ kind: "item", itemId: currentItemId, present: present.value === "true" });
  });
  row.append(sel, present);
  return row;
}

export function renderGoldCondition(
  cond: Extract<Condition, { kind: "gold" }>,
  onChange: (condition: Condition) => void,
  options: {
    readonly className?: string;
    readonly opTestId?: string;
    readonly amountTestId?: string;
  } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  const op = selectWithOptions(CONDITION_OP_OPTIONS, cond.op, options.opTestId ?? "event-condition-gold-op");
  const amount = el("input", {
    attrs: { type: "number", min: "0" },
    value: String(cond.amount),
    dataset: { testid: options.amountTestId ?? "event-condition-gold-amount" },
  }) as HTMLInputElement;
  const apply = () => {
    onChange({
      kind: "gold",
      op: selectedOptionValue(op, CONDITION_OP_OPTIONS, cond.op),
      amount: parseInt(amount.value, 10) || 0,
    });
  };
  op.addEventListener("change", apply);
  amount.addEventListener("change", apply);
  row.append(op, amount);
  return row;
}

export function renderTimerCondition(
  cond: Extract<Condition, { kind: "timer" }>,
  onChange: (condition: Condition) => void,
  options: {
    readonly className?: string;
    readonly timerIdTestId?: string;
    readonly secondsTestId?: string;
    readonly minutesSeconds?: boolean;
    readonly minutesTestId?: string;
  } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  const timerId = el("select", { dataset: { testid: options.timerIdTestId ?? "event-condition-timer-id" } }) as HTMLSelectElement;
  timerId.append(
    el("option", { text: "타이머 1", attrs: { value: "timer1" } }),
    el("option", { text: "타이머 2", attrs: { value: "timer2" } })
  );
  timerId.value = cond.timerId;
  if (options.minutesSeconds) {
    const minutes = el("input", {
      attrs: { type: "number", min: "0" },
      value: String(Math.floor(cond.seconds / 60)),
      dataset: { testid: options.minutesTestId ?? "event-condition-timer-minutes" },
    }) as HTMLInputElement;
    const seconds = el("input", {
      attrs: { type: "number", min: "0", max: "59" },
      value: String(cond.seconds % 60),
      dataset: { testid: options.secondsTestId ?? "event-condition-timer-seconds" },
    }) as HTMLInputElement;
    const apply = () => {
      onChange({
        kind: "timer",
        timerId: timerId.value === "timer2" ? "timer2" : "timer1",
        seconds: (parseInt(minutes.value, 10) || 0) * 60 + (parseInt(seconds.value, 10) || 0),
      });
    };
    timerId.addEventListener("change", apply);
    minutes.addEventListener("change", apply);
    seconds.addEventListener("change", apply);
    row.append(timerId, minutes, el("span", { text: "분" }), seconds, el("span", { text: "초 이하" }));
    return row;
  }
  const seconds = el("input", {
    attrs: { type: "number", min: "0" },
    value: String(cond.seconds),
    dataset: { testid: options.secondsTestId ?? "event-condition-timer-seconds" },
  }) as HTMLInputElement;
  const apply = () => {
    onChange({
      kind: "timer",
      timerId: timerId.value === "timer2" ? "timer2" : "timer1",
      seconds: parseInt(seconds.value, 10) || 0,
    });
  };
  timerId.addEventListener("change", apply);
  seconds.addEventListener("change", apply);
  row.append(timerId, seconds);
  return row;
}

export function renderTimePhaseCondition(
  cond: Extract<Condition, { kind: "timePhase" }>,
  onChange: (condition: Condition) => void,
  options: { readonly className?: string; readonly phaseTestId?: string } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  const phase = selectWithOptions(TIME_PHASE_OPTIONS, cond.phase, options.phaseTestId ?? "event-condition-time-phase");
  phase.addEventListener("change", () => {
    onChange({ kind: "timePhase", phase: selectedOptionValue(phase, TIME_PHASE_OPTIONS, cond.phase) });
  });
  row.append(phase);
  return row;
}

export function renderSeasonCondition(
  cond: Extract<Condition, { kind: "season" }>,
  onChange: (condition: Condition) => void,
  options: { readonly className?: string; readonly seasonTestId?: string } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  const season = selectWithOptions(SEASON_OPTIONS, cond.season, options.seasonTestId ?? "event-condition-season");
  season.addEventListener("change", () => {
    onChange({ kind: "season", season: selectedOptionValue(season, SEASON_OPTIONS, cond.season) });
  });
  row.append(season);
  return row;
}

export function renderNpcActivityCondition(
  cond: Extract<Condition, { kind: "npcActivity" }>,
  onChange: (condition: Condition) => void,
  options: { readonly className?: string; readonly activityTestId?: string } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  const activity = el("input", {
    attrs: { type: "text", placeholder: "work" },
    value: cond.activity,
    dataset: { testid: options.activityTestId ?? "event-condition-npc-activity" },
  }) as HTMLInputElement;
  activity.addEventListener("change", () => {
    onChange({ kind: "npcActivity", activity: activity.value.trim() || cond.activity });
  });
  row.append(activity);
  return row;
}

export function renderFriendshipAtLeastCondition(
  cond: Extract<Condition, { kind: "friendshipAtLeast" }>,
  onChange: (condition: Condition) => void,
  options: { readonly className?: string; readonly npcKeyTestId?: string; readonly valueTestId?: string } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  const npcKey = el("input", {
    attrs: { type: "text", placeholder: "비우면 이 이벤트" },
    value: cond.npcKey ?? "",
    dataset: { testid: options.npcKeyTestId ?? "event-condition-friendship-npc-key" },
  }) as HTMLInputElement;
  const value = el("input", {
    attrs: { type: "number", min: "0", max: "1000" },
    value: String(cond.value),
    dataset: { testid: options.valueTestId ?? "event-condition-friendship-value" },
  }) as HTMLInputElement;
  const apply = () => {
    onChange({
      kind: "friendshipAtLeast",
      npcKey: npcKey.value.trim() || undefined,
      value: parseInt(value.value, 10) || 0,
    });
  };
  npcKey.addEventListener("change", apply);
  value.addEventListener("change", apply);
  row.append(npcKey, value);
  return row;
}

function recordSelect(
  list: readonly { readonly id: string; readonly name: string }[],
  currentId: string,
  onChange: (id: string) => void,
  testId: string
): HTMLElement {
  const sel = el("select", { dataset: { testid: testId } }) as HTMLSelectElement;
  sel.append(el("option", { text: "(선택)", attrs: { value: "" } }));
  for (const [index, item] of list.entries()) {
    sel.append(el("option", { text: numberedName(index, item.name), attrs: { value: item.id } }));
  }
  // 삭제된 레코드 id도 선택 표시 — 없으면 값이 조용히 비어 보여 조건이 깨진 것처럼 보인다.
  if (currentId && !list.some((item) => item.id === currentId)) {
    sel.append(el("option", { text: `${currentId} (없음)`, attrs: { value: currentId } }));
  }
  sel.value = currentId;
  sel.addEventListener("change", () => onChange(sel.value));
  return sel;
}

function firstActorId(): ActorId {
  return store.getCurrent().database.actors[0]?.id ?? "";
}

function firstItemId(): ItemId {
  return store.getCurrent().database.items[0]?.id ?? "";
}
