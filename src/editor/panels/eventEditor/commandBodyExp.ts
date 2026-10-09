import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { el } from "@/util/dom";
import { segmentedSelect, variablePicker } from "./recordPicker";

type ExpCommand = Extract<Command, { kind: "changeExp" }>;

/** EXP operands share the actor amount form but must not be coerced to numbers. */
export function expOperandControls(cmd: ExpCommand, onChange: () => void) {
  const target = segmentedSelect({
    options: [{ value: "party", key: "party", label: "파티 전체" }, { value: "actor", key: "actor", label: "주인공" }],
    value: cmd.actorId ? "actor" : "party",
    testid: "change-exp-target-mode",
    ariaLabel: "경험치 대상",
  });
  const source = segmentedSelect({
    options: [{ value: "number", key: "number", label: "숫자" }, { value: "variable", key: "variable", label: "변수" }],
    value: typeof cmd.amount === "number" ? "number" : "variable",
    testid: "change-exp-amount-source",
    ariaLabel: "경험치 지정 방식",
  });
  const variable = variablePicker({
    selectedId: typeof cmd.amount === "number" ? store.getCurrent().variables[0]?.id ?? "" : cmd.amount.id,
    selectTestId: "change-exp-amount-variable-select",
    onChange,
  });
  const variableField = el("span", { dataset: { testid: "change-exp-amount-variable" }, children: [variable.root] });
  target.select.addEventListener("change", onChange);
  source.select.addEventListener("change", onChange);
  return {
    target: target.root,
    source: source.root,
    variable: variableField,
    actorId: (selectedId: string): string => target.select.value === "party" ? "" : selectedId,
    amount: (number: number): ExpCommand["amount"] => source.select.value === "variable" ? { kind: "var", id: variable.select.value } : number,
    sync: (actor: HTMLElement, number: HTMLElement): void => {
      actor.hidden = target.select.value === "party";
      number.hidden = source.select.value === "variable";
      variableField.hidden = source.select.value !== "variable";
    },
  };
}
