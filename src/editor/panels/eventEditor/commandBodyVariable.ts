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

  // Factory default may leave variableId empty; show inline error instead of auto-mutating.
  let currentVariableId = cmd.variableId;
  const hasTargetVariable = Boolean(currentVariableId.trim());

  let currentOperandVariableId = typeof cmd.value === "number" ? "" : cmd.value.id;
  let cachedNumber: number = typeof cmd.value === "number" ? cmd.value : 0;
  let cachedOperandVariableId: string = currentOperandVariableId;
  const initialSource: ValueSource = typeof cmd.value === "number" ? "number" : "variable";
  const initialNumber = cachedNumber;

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
    attrs: { type: "number", step: "any" },
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

  const targetError = el("p", {
    class: "event-command-variable-error",
    text: "대상 변수를 선택하세요.",
    dataset: { testid: "event-command-variable-target-error" },
  });
  targetError.hidden = hasTargetVariable || Boolean(store.getCurrent().variables[0]?.id);

  const operandError = el("p", {
    class: "event-command-variable-error",
    text: "소스 변수를 선택하세요.",
    dataset: { testid: "event-command-variable-operand-error" },
  });

  const divideWarning = el("p", {
    class: "event-command-variable-warning",
    dataset: { testid: "event-command-variable-divide-warning" },
  });

  const overflowHint = el("p", {
    class: "event-command-variable-hint",
    dataset: { testid: "event-command-variable-overflow-hint" },
  });

  const syncOperandErrors = (): void => {
    const useVariable = source.select.value === "variable";
    operandError.hidden = !useVariable || Boolean(currentOperandVariableId.trim());
  };

  const syncDivideWarning = (nextOp: VariableOp, nextOperand: VariableOperand): void => {
    if (nextOp !== "/=") { divideWarning.hidden = true; divideWarning.textContent = ""; return; }
    const raw = typeof nextOperand === "number" ? nextOperand : null;
    if (raw === 0) {
      divideWarning.textContent = "0으로 나누기는 무시됩니다.";
      divideWarning.hidden = false;
    } else if (raw !== null && !Number.isFinite(raw)) {
      divideWarning.textContent = "값이 올바르지 않습니다.";
      divideWarning.hidden = false;
    } else {
      divideWarning.hidden = true;
      divideWarning.textContent = "";
    }
  };

  const syncOverflowHint = (nextOp: VariableOp, nextOperand: VariableOperand): void => {
    const cur = store.getCurrent().variables.find((entry) => entry.id === currentVariableId);
    void cur;
    const operandVal = typeof nextOperand === "number" ? nextOperand : 0;
    let preview: number | null = null;
    if (nextOp === "*=" && Math.abs(operandVal) > 1) preview = operandVal * 1_000_000;
    if (preview !== null && Math.abs(preview) > 9_999_999) {
      overflowHint.textContent = "값은 -9,999,999 ~ 9,999,999로 클램프됩니다.";
      overflowHint.hidden = false;
    } else {
      overflowHint.hidden = true;
      overflowHint.textContent = "";
    }
  };

  const syncVisibility = (): void => {
    const useVariable = source.select.value === "variable";
    numberField.hidden = useVariable;
    variableField.hidden = !useVariable;
    syncOperandErrors();
  };

  const apply = (): void => {
    const useVariable = source.select.value === "variable";
    if (useVariable) {
      cachedNumber = parseNumberOperand(value.value);
    } else {
      cachedOperandVariableId = currentOperandVariableId;
    }
    const operand: VariableOperand = useVariable
      ? { kind: "var", id: currentOperandVariableId }
      : parseNumberOperand(value.value);
    if (!useVariable) currentOperandVariableId = cachedOperandVariableId;
    const resolvedOp = selectedOptionValue(op.select, VARIABLE_OP_OPTIONS, cmd.op);
    const next: SetVariableCommand = {
      kind: "setVariable",
      variableId: currentVariableId,
      op: resolvedOp,
      value: operand,
    };
    formula.textContent = formatVariableFormula(next);
    targetError.hidden = Boolean(currentVariableId.trim());
    syncDivideWarning(resolvedOp, operand);
    syncOverflowHint(resolvedOp, operand);
    syncOperandErrors();
    context.actions.replaceCommand(context.path, next);
  };

  op.select.addEventListener("change", apply);
  source.select.addEventListener("change", () => {
    syncVisibility();
    apply();
  });
  value.addEventListener("change", apply);
  value.addEventListener("blur", apply);

  const initialOperand: VariableOperand = typeof cmd.value === "number" ? cmd.value : { kind: "var", id: currentOperandVariableId };
  syncVisibility();
  formula.textContent = formatVariableFormula({
    kind: "setVariable",
    variableId: currentVariableId,
    op: cmd.op,
    value: initialOperand,
  });
  syncDivideWarning(cmd.op, initialOperand);
  syncOverflowHint(cmd.op, initialOperand);
  syncOperandErrors();

  wrap.append(
    fieldControl("대상 변수", varSel),
    targetError,
    fieldControl("연산", op.root),
    fieldControl("값 소스", source.root),
    numberField,
    variableField,
    operandError,
    divideWarning,
    overflowHint,
    formula,
    el("p", {
      class: "event-command-variable-hint",
      text: "÷= 는 정수 나눗셈(0 방향 버림)입니다. 0으로 나누면 값을 유지합니다. 값은 -9,999,999 ~ 9,999,999로 클램프됩니다.",
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
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return 0;
  return Math.trunc(parsed);
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
