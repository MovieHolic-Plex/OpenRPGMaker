import type { ChoiceCancelBehavior, Command, Condition } from "@/project/types";
import { el } from "@/util/dom";
import { conditionForm } from "./conditionForm";
import { conditionPreviewSentence } from "./conditionEvalPreview";
import type { CommandEditContext } from "./types";

type ChoicesCommand = Extract<Command, { kind: "choices" }>;
type ChoiceOption = ChoicesCommand["options"][number];

const MAX_CHOICE_OPTIONS = 5;
const DEFAULT_OPTIONS: readonly ChoiceOption[] = [
  { text: "예", branch: [] },
  { text: "아니오", branch: [] },
];

function latestChoices(context: CommandEditContext, fallback: ChoicesCommand): ChoicesCommand {
  const current = context.getCurrentCommand?.();
  return current?.kind === "choices" ? current : fallback;
}

/**
 * Prompt + option labels + cancel. Branch bodies stay on the main list.
 * Branch commands live in the main command list under `: 선택지 …` markers.
 */
export function choicesBody(context: CommandEditContext, cmd: ChoicesCommand): HTMLElement {
  const wrap = el("div", {
    class: "event-command-choices-inline cream-command-form",
    dataset: { testid: "event-command-choices-inline-editor" },
  });
  const options = normalizeOptions(cmd.options);
  const cancelGroupName = `event-choice-cancel-${context.path.join("-") || "root"}`;
  const prompt = el("input", {
    attrs: {
      type: "text",
      placeholder: "질문 (선택)",
      spellcheck: "false",
      autocomplete: "off",
    },
    value: cmd.prompt ?? "",
    dataset: { testid: "event-choice-prompt" },
  }) as HTMLInputElement;
  prompt.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      ...latestChoices(context, cmd),
      prompt: prompt.value.trim() || undefined,
    });
  });

  const optionRows = options.map((option, index) => choiceOptionRow(context, cmd, option, index));
  const optionsPanel = el("div", {
    class: "event-command-choices-options",
    children: [
      choiceTextRow("질문", prompt),
      ...optionRows,
      optionActionsRow(context, cmd, options.length),
    ],
  });

  const cancelBehaviors = cancelBehaviorsForCount(options.length);
  const cancelBehavior = normalizeCancelBehavior(cmd.cancelBehavior ?? "disallow", options.length);

  wrap.append(
    el("div", {
      class: "event-command-choices-panel",
      children: [
        optionsPanel,
        el("fieldset", {
          class: "event-oprn-fieldset event-command-cancel-fieldset",
          attrs: { title: "Esc / 우클릭 시 동작" },
          children: [
            el("legend", { text: "취소" }),
            ...cancelBehaviors.map((behavior) =>
              cancelRadioRow(cancelGroupName, behavior, cancelBehavior === behavior, context, cmd)
            ),
          ],
        }),
      ],
    }),
    ...(cmd.options.length > MAX_CHOICE_OPTIONS
      ? [el("p", {
        class: "event-command-choices-warning",
        text: `선택지가 ${cmd.options.length}개입니다. 화면에는 처음 ${MAX_CHOICE_OPTIONS}개만 표시하며 나머지 분기는 유지합니다.`,
        attrs: { role: "status", "aria-live": "polite" },
        dataset: { testid: "event-choice-overflow-warning" },
      })]
      : []),
    el("p", {
      class: "event-command-choices-hint",
      text: "각 선택지 본문은 왼쪽 목록에서 고칩니다.",
      dataset: { testid: "event-choice-branch-list-note" },
    })
  );
  return wrap;
}

function choiceOptionRow(
  context: CommandEditContext,
  cmd: ChoicesCommand,
  option: ChoiceOption,
  index: number
): HTMLElement {
  const input = el("input", {
    attrs: {
      type: "text",
      placeholder: `선택지 ${index + 1}`,
      spellcheck: "false",
      autocomplete: "off",
      maxlength: "48",
    },
    value: option.text,
    dataset: { testid: `event-choice-option-${index + 1}` },
  }) as HTMLInputElement;
  input.addEventListener("change", () => commitOptionTexts(context, cmd, input));
  input.addEventListener("input", () => {
    // Keep live preview in sync without full form rebuild.
    const latest = latestChoices(context, cmd);
    const next = { ...latest, options: readOptionsFromDom(input, latest) };
    context.actions.replaceCommand(context.path, next);
  });

  const remove = el("button", {
    class: "btn small danger event-command-choice-remove",
    text: "삭제",
    attrs: {
      type: "button",
      title: `선택지 ${index + 1} 삭제`,
      "aria-label": `선택지 ${index + 1} 삭제`,
      ...(cmd.options.length <= 1 ? { disabled: "true" } : {}),
    },
    dataset: { testid: `event-choice-remove-${index + 1}` },
    on: {
      click: () => {
        const latest = latestChoices(context, cmd);
        if (latest.options.length <= 1) return;
        const nextOptions = latest.options.filter((_, optionIndex) => optionIndex !== index);
        context.actions.replaceCommand(context.path, {
          ...latest,
          options: nextOptions.length ? nextOptions : [...DEFAULT_OPTIONS],
          cancelBehavior: normalizeCancelBehavior(
            latest.cancelBehavior ?? "disallow",
            Math.max(1, nextOptions.length)
          ),
        });
      },
    },
  });

  const hasConditions = option.showWhen !== undefined || option.enableWhen !== undefined;
  const conditionToggle = el("button", {
    class: hasConditions ? "btn small event-command-choice-condition-toggle is-active" : "btn small event-command-choice-condition-toggle",
    text: hasConditions ? "조건 ●" : "조건",
    attrs: {
      type: "button",
      title: `선택지 ${index + 1}이 보이거나 고를 수 있는 조건`,
      "aria-expanded": hasConditions ? "true" : "false",
    },
    dataset: { testid: `event-choice-conditions-toggle-${index + 1}` },
  });
  const conditions = choiceConditionsPanel(context, cmd, index);
  conditions.hidden = !hasConditions;
  conditionToggle.addEventListener("click", () => {
    conditions.hidden = !conditions.hidden;
    conditionToggle.setAttribute("aria-expanded", conditions.hidden ? "false" : "true");
  });

  return el("div", {
    class: "event-command-choice-item",
    children: [
      el("div", {
        class: "event-command-choice-row",
        children: [
          el("span", { class: "event-command-choice-row-index", text: `${index + 1}` }),
          input,
          conditionToggle,
          remove,
        ],
      }),
      conditions,
    ],
  });
}

/** 선택지 한 줄의 「보일 조건」「고를 수 있는 조건」과 흐릴 때 이유. 체크를 끄면 조건을 지운다(늘 보임·늘 고를 수 있음). */
function choiceConditionsPanel(context: CommandEditContext, cmd: ChoicesCommand, index: number): HTMLElement {
  const option = cmd.options[index];
  const patchOption = (patch: (option: ChoiceOption) => ChoiceOption): void => {
    const latest = latestChoices(context, cmd);
    const current = latest.options[index];
    if (!current) return;
    context.actions.replaceCommand(context.path, {
      ...latest,
      options: latest.options.map((entry, entryIndex) => (entryIndex === index ? patch(entry) : entry)),
    });
  };
  const slot = (
    key: "showWhen" | "enableWhen",
    label: string,
    hint: string,
    defaultCondition: Condition,
  ): HTMLElement => {
    const current = option?.[key];
    const check = el("input", {
      attrs: { type: "checkbox" },
      dataset: { testid: `event-choice-${key}-enabled-${index + 1}` },
    }) as HTMLInputElement;
    check.checked = current !== undefined;
    const sentence = el("p", {
      class: "event-command-choices-hint",
      text: current ? conditionPreviewSentence(current) : hint,
      dataset: { testid: `event-choice-${key}-sentence-${index + 1}` },
    });
    check.addEventListener("change", () => {
      patchOption((entry) => {
        const { [key]: _drop, ...rest } = entry;
        return check.checked ? { ...rest, [key]: entry[key] ?? defaultCondition } : rest;
      });
    });
    const children: HTMLElement[] = [
      el("label", { class: "event-command-choice-condition-head", children: [check, el("span", { text: label })] }),
      sentence,
    ];
    if (current) {
      children.push(conditionForm(current, (condition) => {
        patchOption((entry) => ({ ...entry, [key]: condition }));
        sentence.textContent = conditionPreviewSentence(condition);
      }, [...context.path, index, key === "showWhen" ? 0 : 1]));
    }
    return el("fieldset", {
      class: "event-oprn-fieldset event-command-choice-condition-slot",
      dataset: { testid: `event-choice-${key}-${index + 1}` },
      children,
    });
  };

  const reason = el("input", {
    attrs: { type: "text", placeholder: "흐릴 때 보일 이유 (예: 은화 50 필요)", spellcheck: "false", autocomplete: "off", maxlength: "40" },
    value: option?.disabledText ?? "",
    dataset: { testid: `event-choice-disabled-text-${index + 1}` },
  }) as HTMLInputElement;
  reason.addEventListener("change", () => {
    patchOption((entry) => {
      const { disabledText: _drop, ...rest } = entry;
      const text = reason.value.trim();
      return text ? { ...rest, disabledText: text } : rest;
    });
  });

  return el("div", {
    class: "event-command-choice-conditions",
    dataset: { testid: `event-choice-conditions-${index + 1}` },
    children: [
      slot("showWhen", "이 조건일 때만 보인다", "끄면 늘 보입니다. 숨은 줄은 목록에서 빠지고 번호가 당겨집니다.", { kind: "switch", switchId: "", value: false }),
      slot("enableWhen", "이 조건일 때만 고를 수 있다", "끄면 늘 고를 수 있습니다. 거짓이면 흐리게 보이고 고를 수 없습니다.", { kind: "gold", op: ">=", amount: 50 }),
      ...(option?.enableWhen ? [el("label", {
        class: "event-command-choice-row event-command-choice-row-prompt",
        children: [el("span", { class: "event-command-choice-row-label", text: "이유" }), reason],
      })] : []),
    ],
  });
}

function optionActionsRow(context: CommandEditContext, cmd: ChoicesCommand, count: number): HTMLElement {
  const canAdd = count < MAX_CHOICE_OPTIONS;
  return el("div", {
    class: "event-command-choices-option-actions",
    children: [
      el("button", {
        class: "btn small event-command-choice-add",
        text: canAdd ? `추가 (${count}/${MAX_CHOICE_OPTIONS})` : `최대 ${MAX_CHOICE_OPTIONS}개`,
        attrs: {
          type: "button",
          title: canAdd ? "선택지 추가" : `선택지는 최대 ${MAX_CHOICE_OPTIONS}개`,
          ...(canAdd ? {} : { disabled: "true" }),
        },
        dataset: { testid: "event-choice-add" },
        on: {
          click: () => {
            const latest = latestChoices(context, cmd);
            if (latest.options.length >= MAX_CHOICE_OPTIONS) return;
            context.actions.replaceCommand(context.path, {
              ...latest,
              options: [
                ...latest.options,
                { text: `선택지 ${latest.options.length + 1}`, branch: [] },
              ],
            });
          },
        },
      }),
    ],
  });
}

function choiceTextRow(label: string, input: HTMLInputElement): HTMLElement {
  return el("label", {
    class: "event-command-choice-row event-command-choice-row-prompt",
    children: [el("span", { class: "event-command-choice-row-label", text: label }), input],
  });
}

function cancelRadioRow(
  groupName: string,
  behavior: ChoiceCancelBehavior,
  checked: boolean,
  context: CommandEditContext,
  cmd: ChoicesCommand
): HTMLElement {
  const input = el("input", {
    attrs: { type: "radio", name: groupName, value: behavior },
    dataset: { testid: `event-choice-cancel-${behavior}` },
  }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener("change", () => {
    if (!input.checked) return;
    const latest = latestChoices(context, cmd);
    context.actions.replaceCommand(context.path, {
      ...latest,
      cancelBehavior: behavior,
      cancelBranch: behavior === "branch" ? latest.cancelBranch ?? [] : latest.cancelBranch,
    });
  });
  return el("label", {
    class: "event-command-cancel-row",
    attrs: { title: cancelBehaviorTitle(behavior) },
    children: [input, el("span", { text: cancelBehaviorLabel(behavior) })],
  });
}

function cancelBehaviorLabel(behavior: ChoiceCancelBehavior): string {
  if (behavior === "disallow") return "취소 없음";
  if (behavior === "branch") return "따로 처리";
  return `선택지 ${behavior.slice("choice".length)}`;
}

function cancelBehaviorTitle(behavior: ChoiceCancelBehavior): string {
  if (behavior === "disallow") return "취소를 누르면 아무 일도 하지 않습니다";
  if (behavior === "branch") return "취소하면 왼쪽 목록의 전용 칸에서 처리합니다";
  return `취소하면 선택지 ${behavior.slice("choice".length)}와 같이 진행합니다`;
}

function cancelBehaviorsForCount(count: number): ChoiceCancelBehavior[] {
  const behaviors: ChoiceCancelBehavior[] = ["disallow"];
  for (let index = 1; index <= Math.min(MAX_CHOICE_OPTIONS, Math.max(1, count)); index += 1) {
    behaviors.push(`choice${index}` as ChoiceCancelBehavior);
  }
  behaviors.push("branch");
  return behaviors;
}

function normalizeCancelBehavior(behavior: ChoiceCancelBehavior, count: number): ChoiceCancelBehavior {
  if (behavior === "disallow" || behavior === "branch") return behavior;
  const index = Number(behavior.slice("choice".length));
  if (Number.isFinite(index) && index >= 1 && index <= count) return behavior;
  return count >= 2 ? "choice2" : "choice1";
}

function normalizeOptions(options: readonly ChoiceOption[]): ChoiceOption[] {
  const cleaned = options
    .slice(0, MAX_CHOICE_OPTIONS)
    .map((option) => ({
      ...option,
      text: option.text ?? "",
      branch: option.branch ?? [],
    }));
  return cleaned.length ? cleaned : [...DEFAULT_OPTIONS];
}

function commitOptionTexts(
  context: CommandEditContext,
  cmd: ChoicesCommand,
  source: HTMLInputElement
): void {
  const latest = latestChoices(context, cmd);
  context.actions.replaceCommand(context.path, {
    ...latest,
    options: readOptionsFromDom(source, latest),
  });
}

function readOptionsFromDom(source: HTMLInputElement, cmd: ChoicesCommand): ChoiceOption[] {
  const root = source.closest(".event-command-choices-options");
  const inputs = root
    ? [...root.querySelectorAll<HTMLInputElement>("input")].filter((input) =>
        input.dataset.testid?.startsWith("event-choice-option-")
      )
    : [source];
  // Row count is owned by add/remove buttons. Preserve typed text including temporary empties.
  const next = inputs.slice(0, MAX_CHOICE_OPTIONS).map((input, index) => ({
    ...(cmd.options[index] ?? {}),
    text: input.value,
    branch: cmd.options[index]?.branch ?? [],
  }));
  const hidden = cmd.options.slice(MAX_CHOICE_OPTIONS);
  return next.length ? [...next, ...hidden] : [...DEFAULT_OPTIONS, ...hidden];
}
