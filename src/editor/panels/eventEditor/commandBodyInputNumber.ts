import { el } from "@/util/dom";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "./types";
import { databasePicker } from "./conditionForm";

type InputNumberCommand = Extract<Command, { kind: "inputNumber" }>;

export function inputNumberBody(context: CommandEditContext, cmd: InputNumberCommand): HTMLElement {
  const wrap = el("div", {
    class: "input-number-command-body",
    dataset: { testid: "input-number-command-body" },
  });

  const variable = databasePicker("variable", cmd.variableId, (variableId) => {
    context.actions.replaceCommand(context.path, { ...cmd, variableId });
  });
  variable.dataset.testid = "input-number-variable";

  const digits = el("input", {
    attrs: { type: "number", min: "1", max: "6", step: "1" },
    value: String(cmd.digits),
    dataset: { testid: "input-number-digits" },
  }) as HTMLInputElement;
  const commitDigits = (): void => {
    const next = clampInputNumberDigits(digits.value);
    digits.value = String(next);
    if (next === cmd.digits) return;
    context.actions.replaceCommand(context.path, { ...cmd, digits: next });
  };
  digits.addEventListener("change", commitDigits);
  digits.addEventListener("blur", commitDigits);

  const digitStepper = el("div", {
    class: "input-number-digit-stepper",
    dataset: { testid: "input-number-digit-stepper" },
  });
  for (let n = 1; n <= 6; n += 1) {
    const btn = el("button", {
      class: `input-number-digit-chip${n === cmd.digits ? " active" : ""}`,
      text: String(n),
      attrs: { type: "button", title: `${n}자리` },
      dataset: { testid: `input-number-digit-chip-${n}` },
    });
    btn.addEventListener("click", () => {
      digits.value = String(n);
      context.actions.replaceCommand(context.path, { ...cmd, digits: n });
    });
    digitStepper.append(btn);
  }

  const prompt = el("input", {
    attrs: {
      type: "text",
      maxlength: "40",
      placeholder: "숫자 입력 (기본 제목)",
    },
    value: cmd.prompt ?? "",
    dataset: { testid: "input-number-prompt" },
  }) as HTMLInputElement;
  const commitPrompt = (): void => {
    const next = prompt.value.trim();
    const prev = cmd.prompt?.trim() ?? "";
    if (next === prev) return;
    const nextCmd: InputNumberCommand = { ...cmd };
    if (next) nextCmd.prompt = next;
    else delete (nextCmd as { prompt?: string }).prompt;
    context.actions.replaceCommand(context.path, nextCmd);
  };
  prompt.addEventListener("change", commitPrompt);
  prompt.addEventListener("blur", commitPrompt);

  const showPad = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "input-number-show-pad" },
  }) as HTMLInputElement;
  showPad.checked = cmd.showPad === true;
  showPad.addEventListener("change", () => {
    const nextCmd: InputNumberCommand = { ...cmd, showPad: showPad.checked };
    if (!showPad.checked) delete (nextCmd as { showPad?: boolean }).showPad;
    context.actions.replaceCommand(context.path, nextCmd);
  });

  wrap.append(
    fieldControl("변수", variable),
    fieldControl(
      "자릿수",
      el("div", {
        class: "input-number-digits-field",
        children: [digitStepper, digits],
      })
    ),
    fieldControl("안내 문구", prompt),
    el("label", {
      class: "inline-field input-number-pad-toggle",
      children: [showPad, el("span", { text: "0~9 키패드 표시" })],
    }),
    el("p", {
      class: "empty-hint input-number-hint",
      text: "우측 미리보기에서 입력 창 모양을 확인하세요. 키패드는 터치/마우스 입력용입니다.",
    })
  );
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
