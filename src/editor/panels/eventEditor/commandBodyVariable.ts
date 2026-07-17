import { store } from "@/project/store";
import { el } from "@/util/dom";
import { selectedOptionValue } from "./dom";
import { recordUsageHint } from "./recordUsageHint";
import { databasePicker } from "./conditionForm";
import { segmentedSelect, type SegmentOption } from "./recordPicker";
import { VARIABLE_OP_OPTIONS } from "./options";
import type { Command, VariableOperand } from "@/project/types";
import type { CommandEditContext } from "./types";

type SetVariableCommand = Extract<Command, { kind: "setVariable" }>;
type VariableOp = SetVariableCommand["op"];
type ValueSource = "number" | "variable";

const VARIABLE_OP_SEGMENTS = [
  { value: "=", key: "set", label: "=" },
  { value: "+=", key: "add", label: "+=" },
  { value: "-=", key: "sub", label: "-=" },
  { value: "*=", key: "mul", label: "×=" },
  { value: "/=", key: "div", label: "÷=" },
] as const satisfies readonly SegmentOption<VariableOp>[];

const VALUE_SOURCE_SEGMENTS = [
  { value: "number", key: "number", label: "숫자" },
  { value: "variable", key: "variable", label: "변수" },
] as const satisfies readonly SegmentOption<ValueSource>[];

/**
 * 변수 조작 폼.
 * 라벨 없는 bare select 스택을 버리고, 스위치 조작과 같은 세로 필드 스택 + 세그먼트 연산/소스로 정리한다.
 */
export function setVariableBody(context: CommandEditContext, cmd: SetVariableCommand): HTMLElement {
  const wrap = el("div", {
    class: "event-command-record-form event-command-variable-form",
    dataset: { testid: "event-command-variable-form" },
  });

  // Factory default may leave variableId empty; seed first project variable so the command is runnable.
  let currentVariableId = cmd.variableId;
  if (!currentVariableId.trim()) {
    const first = store.getCurrent().variables[0]?.id ?? "";
    if (first) {
      currentVariableId = first;
      context.actions.replaceCommand(context.path, {
        kind: "setVariable",
        variableId: first,
        op: cmd.op,
        value: cmd.value,
      });
    }
  }

  let currentOperandVariableId = typeof cmd.value === "number" ? "" : cmd.value.id;
  const initialSource: ValueSource = typeof cmd.value === "number" ? "number" : "variable";
  const initialNumber = typeof cmd.value === "number" ? cmd.value : 0;

  const varSel = databasePicker("variable", currentVariableId, (variableId) => {
    currentVariableId = variableId;
    apply();
  }, "event-command-variable-target");

  const op = segmentedSelect({
    options: VARIABLE_OP_SEGMENTS,
    value: cmd.op,
    testid: "event-command-variable-op",
    ariaLabel: "변수 연산",
  });

  const source = segmentedSelect({
    options: VALUE_SOURCE_SEGMENTS,
    value: initialSource,
    testid: "event-command-variable-value-source",
    ariaLabel: "값 소스",
  });

  const value = el("input", {
    attrs: { type: "number", step: "1" },
    value: String(initialNumber),
    dataset: { testid: "event-command-variable-number-value" },
  }) as HTMLInputElement;

  const operandVariable = databasePicker("variable", currentOperandVariableId, (variableId) => {
    currentOperandVariableId = variableId;
    apply();
  }, "event-command-variable-operand");

  const numberField = fieldControl("값", value);
  const variableField = fieldControl("소스 변수", operandVariable);

  const formula = el("div", {
    class: "event-command-variable-formula",
    dataset: { testid: "event-command-variable-formula" },
  });

  const syncVisibility = (): void => {
    const useVariable = source.select.value === "variable";
    numberField.hidden = useVariable;
    variableField.hidden = !useVariable;
  };

  const apply = (): void => {
    const operand: VariableOperand = source.select.value === "variable"
      ? { kind: "var", id: currentOperandVariableId }
      : parseNumberOperand(value.value);
    const next: SetVariableCommand = {
      kind: "setVariable",
      variableId: currentVariableId,
      op: selectedOptionValue(op.select, VARIABLE_OP_OPTIONS, cmd.op),
      value: operand,
    };
    formula.textContent = formatVariableFormula(next);
    context.actions.replaceCommand(context.path, next);
  };

  op.select.addEventListener("change", apply);
  source.select.addEventListener("change", () => {
    syncVisibility();
    apply();
  });
  value.addEventListener("change", apply);
  value.addEventListener("blur", apply);

  syncVisibility();
  formula.textContent = formatVariableFormula({
    kind: "setVariable",
    variableId: currentVariableId,
    op: cmd.op,
    value: typeof cmd.value === "number"
      ? cmd.value
      : { kind: "var", id: currentOperandVariableId },
  });

  wrap.append(
    fieldControl("대상 변수", varSel),
    fieldControl("연산", op.root),
    fieldControl("값 소스", source.root),
    numberField,
    variableField,
    formula,
    el("p", {
      class: "event-command-variable-hint",
      text: "÷= 는 정수 나눗셈(버림)입니다. 0으로 나누면 값을 유지합니다.",
      dataset: { testid: "event-command-variable-hint" },
    }),
    recordUsageHint("variable", currentVariableId),
  );
  return wrap;
}

function fieldControl(label: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "inline-field event-command-variable-field",
    children: [el("span", { class: "event-command-variable-field-label", text: label }), control],
  });
}

function parseNumberOperand(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatVariableFormula(cmd: SetVariableCommand): string {
  const left = variableLabel(cmd.variableId) || "[변수 선택]";
  const right = typeof cmd.value === "number"
    ? String(cmd.value)
    : (variableLabel(cmd.value.id) || "[소스 변수]");
  const op = displayOp(cmd.op);
  return `${left} ${op} ${right}`;
}

function displayOp(op: VariableOp): string {
  switch (op) {
    case "*=": return "×=";
    case "/=": return "÷=";
    default: return op;
  }
}

function variableLabel(variableId: string): string {
  if (!variableId.trim()) return "";
  const project = store.getCurrent();
  const index = project.variables.findIndex((entry) => entry.id === variableId);
  if (index < 0) return variableId;
  const name = project.variables[index]?.name?.trim();
  const num = String(index + 1).padStart(4, "0");
  return name ? `${num}: ${name}` : num;
}
