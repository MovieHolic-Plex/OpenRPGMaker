import { RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

let dialogId = 0;
export const FACESET_FACE_COUNT = RESOURCE_SLICING.faceset.count;

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
    class: "event-oprn-fieldset event-command-modal-fieldset",
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
        text: "반영하고 닫기",
        attrs: { type: "submit" },
        dataset: { testid: okTestId },
      }),
      el("button", {
        class: "event-command-text-action",
        text: "닫기",
        attrs: { type: "button" },
        on: { click: close },
      }),
      el("button", {
        class: "event-command-text-action",
        text: "도움말",
        attrs: { type: "button" },
        on: {
          click: () =>
            toast(
              "메시지 명령: \\C[n] 색상, \\N[n] 배우 이름, \\V[n] 변수, \\G 골드, \\S[n] 속도, \\\\는 백슬래시. 줄바꿈으로 여러 줄 입력.",
              "info"
            ),
        },
      }),
    ],
  });
}

export function clampFaceIndex(value: string): number {
  return Math.max(0, Math.min(FACESET_FACE_COUNT - 1, (parseInt(value, 10) || 1) - 1));
}
