import { el } from "@/util/dom";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { recordUsageHint } from "./recordUsageHint";
import { databasePicker } from "./conditionForm";
import { VARIABLE_OP_OPTIONS } from "./options";
import type { Command, VariableOperand } from "@/project/types";
import type { CommandEditContext } from "./types";

export function setVariableBody(context: CommandEditContext, cmd: Extract<Command, { kind: "setVariable" }>): HTMLElement {
  // [치명-2] 스위치 조작과 동일한 레코드 폼 레이아웃 — 셀렉트 폭 붕괴/겹침 방지.
  const wrap = el("div", { class: "event-command-record-form" });
  let currentVariableId = cmd.variableId;
  const varSel = databasePicker("variable", cmd.variableId, (variableId) => {
    currentVariableId = variableId;
    context.actions.replaceCommand(context.path, { ...cmd, variableId });
  }, "event-command-variable-target");
  const op = selectWithOptions(VARIABLE_OP_OPTIONS, cmd.op, "event-command-variable-op");
  const source = selectWithOptions([
    { value: "number", label: "숫자" },
    { value: "variable", label: "변수" },
  ] as const, typeof cmd.value === "number" ? "number" : "variable", "event-command-variable-value-source");
  const value = el("input", {
    attrs: { type: "number" },
    value: String(typeof cmd.value === "number" ? cmd.value : 0),
    dataset: { testid: "event-command-variable-number-value" },
  }) as HTMLInputElement;
  let currentOperandVariableId = typeof cmd.value === "number" ? "" : cmd.value.id;
  const operandVariable = databasePicker("variable", currentOperandVariableId, (variableId) => {
    currentOperandVariableId = variableId;
    apply();
  }, "event-command-variable-operand");
  const apply = () => {
    const operand: VariableOperand = source.value === "variable"
      ? { kind: "var", id: currentOperandVariableId }
      : parseInt(value.value, 10) || 0;
    context.actions.replaceCommand(context.path, {
      kind: "setVariable",
      variableId: currentVariableId,
      op: selectedOptionValue(op, VARIABLE_OP_OPTIONS, cmd.op),
      value: operand,
    });
  };
  op.addEventListener("change", apply);
  source.addEventListener("change", () => {
    value.hidden = source.value === "variable";
    operandVariable.hidden = source.value !== "variable";
    apply();
  });
  value.addEventListener("change", apply);
  value.hidden = source.value === "variable";
  operandVariable.hidden = source.value !== "variable";
  wrap.append(varSel, op, source, value, operandVariable, recordUsageHint("variable", cmd.variableId));
  return wrap;
}
