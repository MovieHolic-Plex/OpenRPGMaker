import { updateEventPage } from "@/editor/eventPages";
import { el } from "@/util/dom";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { BOOLEAN_OPTIONS, CONDITION_OP_OPTIONS } from "./options";
import { openSwitchVariablePicker } from "./recordPickerDialog";
import type { EventPage, EventPageCondition, MapId } from "@/project/types";

export function renderPageConditions(mapId: MapId, eventId: string, page: EventPage): HTMLElement[] {
  return [
    conditionRow("스위치", switchConditionInputs(mapId, eventId, page), page.conditions.some((item) => item.kind === "switch"), "is ON"),
    disabledConditionRow("스위치", "is ON"),
    conditionRow("변수", variableConditionInputs(mapId, eventId, page), page.conditions.some((item) => item.kind === "variable"), "이상"),
    conditionRow("아이템", itemConditionInputs(mapId, eventId, page), page.conditions.some((item) => item.kind === "item"), "보유"),
    conditionRow("주인공", actorConditionInputs(mapId, eventId, page), page.conditions.some((item) => item.kind === "actor"), "파티에 있음"),
    disabledConditionRow("타이머 1", "초 이하"),
    disabledConditionRow("타이머 2", "초 이하"),
  ];
}

function conditionRow(label: string, control: HTMLElement, checked: boolean, suffix: string): HTMLElement {
  const enabled = el("input", {
    attrs: { type: "checkbox", "aria-label": `${label} 조건 사용` },
  }) as HTMLInputElement;
  enabled.checked = checked;
  enabled.disabled = true;
  return el("div", {
    class: "event-condition-row",
    children: [
      enabled,
      el("span", { class: "event-condition-label", text: label }),
      control,
      el("span", { class: "event-condition-suffix", text: suffix }),
    ],
  });
}

function disabledConditionRow(label: string, suffix: string): HTMLElement {
  const checkbox = el("input", { attrs: { type: "checkbox", disabled: "" } }) as HTMLInputElement;
  const input = el("input", { attrs: { type: "text", disabled: "" } });
  return el("div", {
    class: "event-condition-row disabled",
    children: [
      checkbox,
      el("span", { class: "event-condition-label", text: label }),
      input,
      el("span", { class: "event-condition-suffix", text: suffix }),
    ],
  });
}

function switchConditionInputs(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const condition = page.conditions.find((item) => item.kind === "switch");
  const switchInput = el("input", {
    attrs: { type: "text", placeholder: "스위치 ID" },
    value: condition?.kind === "switch" ? condition.switchId : "",
    dataset: { testid: "event-page-switch-condition-input" },
  }) as HTMLInputElement;
  const switchValue = selectWithOptions(
    BOOLEAN_OPTIONS,
    condition?.kind === "switch" ? String(condition.value) : "true",
    "event-page-switch-condition-value"
  );
  const apply = () => {
    const next = withoutCondition(page.conditions, "switch");
    const switchId = switchInput.value.trim();
    if (switchId) next.push({ kind: "switch", switchId, value: switchValue.value === "true" });
    updateEventPage(mapId, eventId, page.id, { conditions: next });
  };
  switchInput.addEventListener("change", apply);
  switchValue.addEventListener("change", apply);
  const picker = el("button", {
    class: "btn small",
    text: "...",
    attrs: { type: "button", title: "스위치 선택" },
    dataset: { testid: "event-page-switch-picker-open" },
    on: {
      click: () => openSwitchVariablePicker({
        kind: "switch",
        currentId: switchInput.value.trim(),
        onSelect: (switchId) => {
          switchInput.value = switchId;
          apply();
        },
      }),
    },
  });
  return el("div", { class: "event-condition-control", children: [switchInput, picker, switchValue] });
}

function variableConditionInputs(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const condition = page.conditions.find((item) => item.kind === "variable");
  const variableInput = el("input", {
    attrs: { type: "text", placeholder: "변수 ID" },
    value: condition?.kind === "variable" ? condition.variableId : "",
    dataset: { testid: "event-page-variable-condition-input" },
  }) as HTMLInputElement;
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
    const next = withoutCondition(page.conditions, "variable");
    const variableId = variableInput.value.trim();
    if (variableId) next.push({
      kind: "variable",
      variableId,
      op: selectedOptionValue(op, CONDITION_OP_OPTIONS, ">="),
      value: parseInt(value.value, 10) || 0,
    });
    updateEventPage(mapId, eventId, page.id, { conditions: next });
  };
  variableInput.addEventListener("change", apply);
  op.addEventListener("change", apply);
  value.addEventListener("change", apply);
  const picker = el("button", {
    class: "btn small",
    text: "...",
    attrs: { type: "button", title: "변수 선택" },
    dataset: { testid: "event-page-variable-picker-open" },
    on: {
      click: () => openSwitchVariablePicker({
        kind: "variable",
        currentId: variableInput.value.trim(),
        onSelect: (variableId) => {
          variableInput.value = variableId;
          apply();
        },
      }),
    },
  });
  return el("div", { class: "event-condition-control variable", children: [variableInput, picker, op, value] });
}

function actorConditionInputs(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const condition = page.conditions.find((item) => item.kind === "actor");
  const actorInput = el("input", {
    attrs: { type: "text", placeholder: "주인공 ID" },
    value: condition?.kind === "actor" ? condition.actorId : "",
    dataset: { testid: "event-page-actor-condition-input" },
  }) as HTMLInputElement;
  const present = selectWithOptions(
    [{ value: "true", label: "파티에 있음" }, { value: "false", label: "파티에 없음" }],
    condition?.kind === "actor" ? String(condition.present) : "true",
    "event-page-actor-condition-present"
  );
  const apply = () => {
    const next = withoutCondition(page.conditions, "actor");
    const actorId = actorInput.value.trim();
    if (actorId) next.push({ kind: "actor", actorId, present: present.value === "true" });
    updateEventPage(mapId, eventId, page.id, { conditions: next });
  };
  actorInput.addEventListener("change", apply);
  present.addEventListener("change", apply);
  return el("div", { class: "event-condition-control", children: [actorInput, present] });
}

function itemConditionInputs(mapId: MapId, eventId: string, page: EventPage): HTMLElement {
  const condition = page.conditions.find((item) => item.kind === "item");
  const itemInput = el("input", {
    attrs: { type: "text", placeholder: "아이템 ID" },
    value: condition?.kind === "item" ? condition.itemId : "",
    dataset: { testid: "event-page-item-condition-input" },
  }) as HTMLInputElement;
  const present = selectWithOptions(
    [{ value: "true", label: "소지 중" }, { value: "false", label: "소지하지 않음" }],
    condition?.kind === "item" ? String(condition.present) : "true",
    "event-page-item-condition-present"
  );
  const apply = () => {
    const next = withoutCondition(page.conditions, "item");
    const itemId = itemInput.value.trim();
    if (itemId) next.push({ kind: "item", itemId, present: present.value === "true" });
    updateEventPage(mapId, eventId, page.id, { conditions: next });
  };
  itemInput.addEventListener("change", apply);
  present.addEventListener("change", apply);
  return el("div", { class: "event-condition-control", children: [itemInput, present] });
}

function withoutCondition(conditions: readonly EventPageCondition[], kind: EventPageCondition["kind"]): EventPageCondition[] {
  return conditions.filter((condition) => condition.kind !== kind);
}
