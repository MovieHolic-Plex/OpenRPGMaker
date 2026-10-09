import { store } from "@/project/store";
import { el } from "@/util/dom";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "./types";
import { databasePicker } from "./conditionForm";

type InputNumberCommand = Extract<Command, { kind: "inputNumber" }>;

const DIGIT_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

export function inputNumberBody(context: CommandEditContext, cmd: InputNumberCommand): HTMLElement {
  const wrap = el("div", {
    class: "input-number-command-body cream-command-form",
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

  /**
   * 마지막으로 **커밋한** 안내 문구.
   *
   * `latestCmd()` 는 라이브 DOM 값을 읽는다(칩 클릭이 입력 중인 문구를 덮지 않게 하려는
   * 의도적 설계). 그래서 그것을 "이전 값"으로 쓰면 자기 자신과 비교하게 된다 — 실측 결함:
   * `commitPrompt` 의 `if (next === prev) return;` 이 **항상** 참이라 안내 문구가 저장된 적이
   * 없었다. 비교 기준은 라이브 DOM 이 아니라 커밋 이력이어야 한다.
   *
   * 중복 커밋을 그냥 허용하지 않는 이유: `replaceCommand` 는 되돌리기 이력을 한 칸 쌓는다
   * (`eventPages.ts:275` `pageChange`). blur 마다 무의미한 «커맨드 교체» 가 쌓이면 안 된다.
   */
  let committedPrompt = cmd.prompt?.trim() ?? "";

  /** 커밋 단일 창구. 어느 경로로 저장해도 `committedPrompt` 가 같이 갱신된다. */
  const commit = (nextCmd: InputNumberCommand): void => {
    committedPrompt = nextCmd.prompt?.trim() ?? "";
    context.actions.replaceCommand(context.path, nextCmd);
  };

  const variable = databasePicker("variable", currentVariableId, (nextId) => {
    currentVariableId = nextId;
    commit({ ...latestCmd(), variableId: nextId });
  });
  variable.dataset.testid = "input-number-variable";

  const digits = clampInputNumberDigits(cmd.digits);
  const digitGroup = el("div", {
    class: "input-number-digit-stepper",
    dataset: { testid: "input-number-digit-stepper" },
    attrs: {
      role: "radiogroup",
      "aria-label": "몇 자리",
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
      commit({ ...latestCmd(), digits: n });
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
    if (next === committedPrompt) return;
    const nextCmd: InputNumberCommand = { ...latestCmd() };
    if (next) nextCmd.prompt = next;
    else delete (nextCmd as { prompt?: string }).prompt;
    commit(nextCmd);
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
    commit(nextCmd);
  });

  wrap.append(
    fieldControl("변수", variable),
    fieldControl(
      "몇 자리",
      el("div", {
        class: "input-number-digits-field",
        children: [
          digitGroup,
          digitsMirror,
          el("span", {
            class: "input-number-digits-caption",
            text: "입력할 숫자의 자리 수",
            dataset: { testid: "input-number-digits-caption" },
          }),
        ],
      })
    ),
    fieldControl("안내 문구", prompt),
    el("div", {
      class: "input-number-options",
      children: [
        el("label", {
          class: "input-number-pad-toggle",
          children: [showPad, el("span", { text: "화면에 숫자 버튼 보이기" })],
        }),
        el("p", {
          class: "empty-hint input-number-hint",
          text: "숫자 버튼을 켜면 터치로도 입력할 수 있습니다.",
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
