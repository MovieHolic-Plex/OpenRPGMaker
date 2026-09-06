import type { ChoiceCancelBehavior, Command } from "@/project/types";
import { el } from "@/util/dom";
import { showAlert, showConfirm } from "@/editor/ui/modal";
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
  const cancelBehavior = normalizeCancelBehavior(cmd.cancelBehavior ?? "choice2", options.length);

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
        const behavior = normalizeCancelBehavior(latest.cancelBehavior ?? "choice2", latest.options.length);
        if (behavior === `choice${index + 1}`) {
          void showAlert({ title: "취소 동작 변경", message: "이 선택지는 취소할 때 실행됩니다. 다른 취소 동작을 먼저 고른 뒤 삭제하세요." });
          return;
        }
        const host = input.closest(".event-command-edit-body") ?? input.parentElement!.parentElement!;
        const removeOption = (): void => {
          const current = latestChoices(context, cmd);
          const nextOptions = current.options.filter((_, optionIndex) => optionIndex !== index);
          const destination = Number(behavior.slice("choice".length)) - 1;
          context.actions.replaceCommand(context.path, {
            ...current,
            options: nextOptions,
            cancelBehavior: destination > index ? `choice${destination}` as ChoiceCancelBehavior : behavior,
          });
          host.querySelector<HTMLElement>(`[data-testid="event-choice-option-${Math.min(index + 1, nextOptions.length)}"]`)?.focus();
        };
        if (latest.options[index]!.branch.length === 0) {
          removeOption();
          return;
        }
        void showConfirm({ title: "선택지 삭제", message: "선택지에 들어있는 명령도 삭제됩니다. 진행할까요?", danger: true }).then((confirmed) => {
          if (confirmed) removeOption();
        });
      },
    },
  });

  return el("div", {
    class: "event-command-choice-row",
    children: [
      el("span", { class: "event-command-choice-row-index", text: `${index + 1}` }),
      input,
      remove,
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
          click: (event) => {
            const source = event.currentTarget as HTMLElement;
            const host = source.closest(".event-command-edit-body") ?? source.parentElement!.parentElement!;
            const latest = latestChoices(context, cmd);
            if (latest.options.length >= MAX_CHOICE_OPTIONS) return;
            context.actions.replaceCommand(context.path, {
              ...latest,
              options: [
                ...latest.options,
                { text: `선택지 ${latest.options.length + 1}`, branch: [] },
              ],
            });
            host.querySelector<HTMLElement>(`[data-testid="event-choice-option-${latest.options.length + 1}"]`)?.focus();
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
    text: input.value,
    branch: cmd.options[index]?.branch ?? [],
  }));
  return next.length ? next : [...DEFAULT_OPTIONS];
}
