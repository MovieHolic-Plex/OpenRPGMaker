import { el } from "@/util/dom";
import { store } from "@/project/store";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { BOOLEAN_OPTIONS, CONDITION_OP_OPTIONS } from "./options";
import type { Condition } from "@/project/types";

export function databasePicker(
  kind: "switch" | "variable",
  currentId: string,
  onChange: (id: string) => void
): HTMLElement {
  const project = store.getCurrent();
  const sel = el("select") as HTMLSelectElement;
  sel.append(el("option", { text: "(선택)", attrs: { value: "" } }));
  const list = kind === "switch" ? project.switches : project.variables;
  for (const item of list) {
    sel.append(el("option", { text: item.name, attrs: { value: item.id } }));
  }
  sel.value = currentId;
  sel.addEventListener("change", () => onChange(sel.value));
  return sel;
}

export function conditionForm(cond: Condition, onChange: (condition: Condition) => void): HTMLElement {
  const wrap = el("div", {});
  const mode = selectWithOptions(
    [
      { value: "switch", label: "스위치" },
      { value: "variable", label: "변수" },
    ],
    cond.kind
  );
  mode.addEventListener("change", () => {
    if (mode.value === "switch") {
      onChange({ kind: "switch", switchId: "", value: true });
    } else {
      onChange({ kind: "variable", variableId: "", op: ">=", value: 0 });
    }
  });
  wrap.append(mode);
  if (cond.kind === "switch") {
    wrap.append(renderSwitchCondition(cond, onChange));
  } else {
    wrap.append(renderVariableCondition(cond, onChange));
  }
  return wrap;
}

function renderSwitchCondition(
  cond: Extract<Condition, { kind: "switch" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const row = el("span", {});
  const sw = databasePicker("switch", cond.switchId, (switchId) => {
    onChange({ kind: "switch", switchId, value: cond.value });
  });
  const val = selectWithOptions(BOOLEAN_OPTIONS, String(cond.value));
  val.addEventListener("change", () => {
    onChange({ kind: "switch", switchId: cond.switchId, value: val.value === "true" });
  });
  row.append(sw, val);
  return row;
}

function renderVariableCondition(
  cond: Extract<Condition, { kind: "variable" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const row = el("span", {});
  const variable = databasePicker("variable", cond.variableId, (variableId) => {
    onChange({ kind: "variable", variableId, op: cond.op, value: cond.value });
  });
  const op = selectWithOptions(CONDITION_OP_OPTIONS, cond.op);
  const value = el("input", {
    attrs: { type: "number" },
    value: String(cond.value),
  }) as HTMLInputElement;
  const apply = () => {
    onChange({
      kind: "variable",
      variableId: cond.variableId,
      op: selectedOptionValue(op, CONDITION_OP_OPTIONS, cond.op),
      value: parseInt(value.value, 10) || 0,
    });
  };
  op.addEventListener("change", apply);
  value.addEventListener("change", apply);
  row.append(variable, op, value);
  return row;
}
