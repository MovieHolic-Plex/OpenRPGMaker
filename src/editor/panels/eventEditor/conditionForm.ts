import { el } from "@/util/dom";
import { numberedName } from "@/editor/panels/databaseDisplay";
import { store } from "@/project/store";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { BOOLEAN_OPTIONS, CONDITION_OP_OPTIONS, SELF_SWITCH_KEY_OPTIONS } from "./options";
import { openSwitchVariablePicker } from "./recordPickerDialog";
import type { ActorId, Condition, ItemId } from "@/project/types";

const CONDITION_MODE_OPTIONS = [
  { value: "switch", label: "스위치" },
  { value: "variable", label: "변수" },
  { value: "selfSwitch", label: "셀프 스위치" },
  { value: "actor", label: "주인공" },
  { value: "item", label: "아이템" },
  { value: "gold", label: "소지금" },
  { value: "timer", label: "타이머" },
] as const;

export function databasePicker(
  kind: "switch" | "variable",
  currentId: string,
  onChange: (id: string) => void,
  testId?: string
): HTMLElement {
  const project = store.getCurrent();
  const sel = el("select") as HTMLSelectElement;
  sel.append(el("option", { text: "(선택)", attrs: { value: "" } }));
  const list = kind === "switch" ? project.switches : project.variables;
  for (const [index, item] of list.entries()) {
    sel.append(el("option", { text: numberedName(index, item.name), attrs: { value: item.id } }));
  }
  sel.value = currentId;
  sel.addEventListener("change", () => onChange(sel.value));
  const pickerButton = el("button", {
    class: "btn small",
    text: "...",
    attrs: { type: "button", title: kind === "switch" ? "스위치 선택" : "변수 선택" },
    dataset: { testid: `event-${kind}-picker-open` },
    on: { click: () => openSwitchVariablePicker({ kind, currentId: sel.value, onSelect: onChange }) },
  });
  return el("span", {
    class: "event-record-select",
    dataset: testId ? { testid: testId } : undefined,
    children: [sel, pickerButton],
  });
}

export function conditionForm(cond: Condition, onChange: (condition: Condition) => void): HTMLElement {
  const wrap = el("div", {});
  const mode = selectWithOptions(CONDITION_MODE_OPTIONS, cond.kind);
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
    }
  });
  wrap.append(mode);
  switch (cond.kind) {
    case "switch":
      wrap.append(renderSwitchCondition(cond, onChange));
      break;
    case "variable":
      wrap.append(renderVariableCondition(cond, onChange));
      break;
    case "selfSwitch":
      wrap.append(renderSelfSwitchCondition(cond, onChange));
      break;
    case "actor":
      wrap.append(renderActorCondition(cond, onChange));
      break;
    case "item":
      wrap.append(renderItemCondition(cond, onChange));
      break;
    case "gold":
      wrap.append(renderGoldCondition(cond, onChange));
      break;
    case "timer":
      wrap.append(renderTimerCondition(cond, onChange));
      break;
  }
  return wrap;
}

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
