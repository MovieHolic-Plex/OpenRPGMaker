import { el } from "@/util/dom";

let dialogId = 0;

export function dialogForm(testId: string): HTMLFormElement {
  const form = document.createElement("form");
  form.className = "event-command-modal-form";
  form.dataset.testid = testId;
  return form;
}

export function nextGroupName(prefix: string): string {
  dialogId += 1;
  return `${prefix}-${dialogId}`;
}

export function fieldset(legend: string, controls: HTMLElement[]): HTMLElement {
  return el("fieldset", {
    class: "event-rm2k3-fieldset event-command-modal-fieldset",
    children: [el("legend", { text: legend }), ...controls],
  });
}

export function labelledControl(label: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "event-command-modal-control",
    children: [control, el("span", { text: label })],
  });
}

export function radioControl<T extends string>(
  name: string,
  value: T,
  checked: boolean,
  testId: string
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "radio";
  input.name = name;
  input.value = value;
  input.checked = checked;
  input.dataset.testid = testId;
  return input;
}

export function checkboxControl(checked: boolean, testId: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.dataset.testid = testId;
  return input;
}

export function radioValue<T extends string>(controls: HTMLInputElement[], fallback: T): T {
  const selected = controls.find((control) => control.checked);
  return (selected?.value as T | undefined) ?? fallback;
}

export function actionRow(okTestId: string, close: () => void): HTMLElement {
  return el("div", {
    class: "event-command-text-actions",
    children: [
      el("button", {
        class: "event-command-text-action primary",
        text: "OK",
        attrs: { type: "submit" },
        dataset: { testid: okTestId },
      }),
      el("button", {
        class: "event-command-text-action",
        text: "Cancel",
        attrs: { type: "button" },
        on: { click: close },
      }),
      el("button", {
        class: "event-command-text-action",
        text: "Help",
        attrs: { type: "button" },
      }),
    ],
  });
}

export function clampFaceIndex(value: string): number {
  return Math.max(0, Math.min(15, (parseInt(value, 10) || 1) - 1));
}
