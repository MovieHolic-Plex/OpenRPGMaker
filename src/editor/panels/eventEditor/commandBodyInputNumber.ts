import { el } from "@/util/dom";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "./types";
import { databasePicker } from "./conditionForm";

type InputNumberCommand = Extract<Command, { kind: "inputNumber" }>;

export function inputNumberBody(context: CommandEditContext, cmd: InputNumberCommand): HTMLElement {
  const wrap = el("span", {});
  const variable = databasePicker("variable", cmd.variableId, (variableId) => {
    context.actions.replaceCommand(context.path, { ...cmd, variableId });
  });
  variable.dataset.testid = "input-number-variable";
  const digits = el("input", {
    attrs: { type: "number", min: "1", max: "6" },
    value: String(cmd.digits),
    dataset: { testid: "input-number-digits" },
  }) as HTMLInputElement;
  digits.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      ...cmd,
      digits: clampInputNumberDigits(digits.value),
    });
  });
  wrap.append(fieldControl("변수", variable), fieldControl("자릿수", digits));
  return wrap;
}

function fieldControl(label: string, control: HTMLElement): HTMLElement {
  return el("label", { class: "inline-field", children: [el("span", { text: label }), control] });
}

function clampInputNumberDigits(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(6, parsed));
}
