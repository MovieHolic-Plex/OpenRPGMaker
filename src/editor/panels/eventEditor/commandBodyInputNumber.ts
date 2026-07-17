import { store } from "@/project/store";
import { el } from "@/util/dom";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "./types";
import { databasePicker } from "./conditionForm";

type InputNumberCommand = Extract<Command, { kind: "inputNumber" }>;

const DIGIT_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

export function inputNumberBody(context: CommandEditContext, cmd: InputNumberCommand): HTMLElement {
  const wrap = el("div", {
    class: "input-number-command-body",
    dataset: { testid: "input-number-command-body" },
  });

  // Factory default may leave variableId empty; seed the first project variable once
  // so the form is valid without forcing the author to open the picker.
  let currentVariableId = cmd.variableId;
  if (!currentVariableId.trim()) {
    const first = store.getCurrent().variables[0]?.id ?? "";
    if (first) {
      currentVariableId = first;
      context.actions.replaceCommand(context.path, { ...cmd, variableId: first });
    }
  }

  const variable = databasePicker("variable", currentVariableId, (nextId) => {
    currentVariableId = nextId;
    context.actions.replaceCommand(context.path, { ...latestCmd(), variableId: nextId });
  });
  variable.dataset.testid = "input-number-variable";

  const digits = clampInputNumberDigits(cmd.digits);
  const digitGroup = el("div", {
    class: "input-number-digit-stepper",
    dataset: { testid: "input-number-digit-stepper" },
    attrs: {
      role: "radiogroup",
      "aria-label": "입력 자릿수",
    },
  });
  // Hidden mirror keeps older e2e helpers that target a numeric field working.
  const digitsMirror = el("input", {
    class: "input-number-digits-mirror",
    attrs: {
      type: "hidden",
      value: String(digits),
    },
    dataset: { testid: "input-number-digits" },
  }) as HTMLInputElement;

  for (const n of DIGIT_OPTIONS) {
    const btn = el("button", {
      class: `input-number-digit-chip${n === digits ? " active" : ""}`,
      text: String(n),
      attrs: {
        type: "button",
        title: `${n}자리`,
        role: "radio",
        "aria-checked": n === digits ? "true" : "false",
      },
      dataset: { testid: `input-number-digit-chip-${n}` },
    });
    btn.addEventListener("click", () => {
      if (n === latestCmd().digits) return;
      digitsMirror.value = String(n);
      context.actions.replaceCommand(context.path, { ...latestCmd(), digits: n });
    });
    digitGroup.append(btn);
  }

  const prompt = el("input", {
    attrs: {
      type: "text",
      maxlength: "40",
      placeholder: "비우면 「숫자 입력」",
    },
    value: cmd.prompt ?? "",
    dataset: { testid: "input-number-prompt" },
  }) as HTMLInputElement;
  const commitPrompt = (): void => {
    const next = prompt.value.trim();
    const prev = latestCmd().prompt?.trim() ?? "";
    if (next === prev) return;
    const nextCmd: InputNumberCommand = { ...latestCmd() };
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
    const nextCmd: InputNumberCommand = { ...latestCmd(), showPad: showPad.checked };
    if (!showPad.checked) delete (nextCmd as { showPad?: boolean }).showPad;
    context.actions.replaceCommand(context.path, nextCmd);
  });

  wrap.append(
    fieldControl("변수", variable),
    fieldControl(
      "자릿수",
      el("div", {
        class: "input-number-digits-field",
        children: [
          digitGroup,
          digitsMirror,
          el("span", {
            class: "input-number-digits-caption",
            text: "플레이어가 입력할 자리 수 (1~6)",
            dataset: { testid: "input-number-digits-caption" },
          }),
        ],
      })
    ),
    fieldControl("창 제목", prompt),
    el("div", {
      class: "input-number-options",
      children: [
        el("label", {
          class: "input-number-pad-toggle",
          children: [showPad, el("span", { text: "터치용 숫자 키패드 표시" })],
        }),
        el("p", {
          class: "empty-hint input-number-hint",
          text: "우측은 플레이 시 처음 보이는 빈 입력 창입니다. 키보드는 항상 동작하고, 키패드는 터치/마우스용입니다.",
        }),
      ],
    })
  );
  return wrap;

  function latestCmd(): InputNumberCommand {
    // Prefer live control values so chip clicks do not clobber prompt/pad/variable.
    const next: InputNumberCommand = {
      kind: "inputNumber",
      variableId: currentVariableId,
      digits: clampInputNumberDigits(digitsMirror.value || String(cmd.digits)),
    };
    const promptText = prompt.value.trim();
    if (promptText) next.prompt = promptText;
    if (showPad.checked) next.showPad = true;
    return next;
  }
}

function fieldControl(label: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "inline-field input-number-field",
    children: [el("span", { class: "input-number-field-label", text: label }), control],
  });
}

function clampInputNumberDigits(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(6, Math.trunc(parsed)));
}
