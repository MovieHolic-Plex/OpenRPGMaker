import { el } from "@/util/dom";
import { randomUuid } from "@/util/id";
import { COMMAND_KIND_OPTIONS, optionValue, type SelectOption } from "./options";
import type { Command } from "@/project/types";

export function field(label: string, control: HTMLElement): HTMLElement {
  const row = el("div", { class: "field" });
  const labelElement = el("label", { text: label });
  row.append(labelElement, control);
  const selector = 'input:not([type="hidden"]):not([aria-hidden="true"]), textarea, select:not([aria-hidden="true"]), button';
  const target = row.querySelector<HTMLElement>(selector);
  if (target) {
    if (!target.id) target.id = `event-field-${randomUuid()}`;
    labelElement.htmlFor = target.id;
  }
  return row;
}

export function selectWithOptions<T extends string>(
  options: readonly SelectOption<T>[],
  value: T,
  testId?: string
): HTMLSelectElement {
  const select = el("select", {
    dataset: testId ? { testid: testId } : undefined,
  }) as HTMLSelectElement;
  for (const option of options) {
    select.append(el("option", { text: option.label, attrs: { value: option.value } }));
  }
  select.value = value;
  return select;
}

export function selectedOptionValue<T extends string>(
  select: HTMLSelectElement,
  options: readonly SelectOption<T>[],
  fallback: T
): T {
  return optionValue(select.value, options, fallback);
}

export function commandKindSelect(value: Command["kind"], testId?: string): HTMLSelectElement {
  return selectWithOptions(COMMAND_KIND_OPTIONS, value, testId);
}
