import { newCommand } from "@/editor/eventActions";
import { CHOICE_CANCEL_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import type { ChoiceCancelBehavior, Command } from "@/project/types";
import { el } from "@/util/dom";
import { openEventCommandEditDialog } from "./commandEditDialog";
import { commandKindSelect, selectedOptionValue } from "./dom";
import { renderCommandList } from "./commandList";
import { COMMAND_KIND_OPTIONS } from "./options";
import type { CommandEditContext } from "./types";

type ChoicesCommand = Extract<Command, { kind: "choices" }>;
type ChoiceOption = ChoicesCommand["options"][number];

const CHOICE_INDEXES = [0, 1, 2, 3, 4] as const;
const CANCEL_BEHAVIORS: readonly ChoiceCancelBehavior[] = [
  "disallow",
  "choice1",
  "choice2",
  "choice3",
  "choice4",
  "choice5",
  "branch",
];

export function choicesBody(context: CommandEditContext, cmd: ChoicesCommand): HTMLElement {
  const wrap = el("div", {
    class: "event-command-choices-inline",
    dataset: { testid: "event-command-choices-inline-editor" },
  });
  const cancelGroupName = `event-choice-cancel-${context.path.join("-") || "root"}`;
  const optionInputs = CHOICE_INDEXES.map((index) => choiceInput(context, cmd, index));
  const prompt = el("input", {
    attrs: { type: "text" },
    value: cmd.prompt ?? "",
    dataset: { testid: "event-choice-prompt" },
  });
  prompt.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      ...cmd,
      prompt: prompt.value.trim() || undefined,
    });
  });

  wrap.append(
    el("div", {
      class: "event-command-choices-panel",
      children: [
        el("div", {
          class: "event-command-choices-options",
          children: [
            choiceTextRow("질문", prompt),
            ...optionInputs.map((input, index) => choiceTextRow(`선택지 ${index + 1}`, input)),
          ],
        }),
        el("fieldset", {
          class: "event-rm2k3-fieldset event-command-cancel-fieldset",
          children: [
            el("legend", { text: "취소할 때" }),
            ...CANCEL_BEHAVIORS.map((behavior) =>
              cancelRadioRow(cancelGroupName, behavior, (cmd.cancelBehavior ?? "choice2") === behavior, context, cmd)
            ),
          ],
        }),
      ],
    })
  );

  cmd.options.forEach((opt, optIdx) => {
    wrap.append(choiceOptionBody(context, cmd, opt, optIdx));
  });
  if (cmd.cancelBehavior === "branch") wrap.append(cancelBranchBody(context, cmd));
  return wrap;
}

function choiceInput(context: CommandEditContext, cmd: ChoicesCommand, index: number): HTMLInputElement {
  const input = el("input", {
    attrs: { type: "text" },
    value: cmd.options[index]?.text ?? "",
    dataset: { testid: `event-choice-option-${index + 1}` },
  });
  input.addEventListener("change", () => {
    const siblings = input
      .closest(".event-command-choices-options")
      ?.querySelectorAll<HTMLInputElement>('[data-testid^="event-choice-option-"]');
    const inputs = siblings ? [...siblings] : [input];
    context.actions.replaceCommand(context.path, {
      ...cmd,
      options: optionsFromInputs(inputs, cmd),
    });
  });
  return input;
}

function choiceTextRow(label: string, input: HTMLInputElement): HTMLElement {
  return el("label", {
    class: "event-command-choice-row",
    children: [
      el("span", { text: label }),
      input,
    ],
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
  });
  input.checked = checked;
  input.addEventListener("change", () => {
    if (!input.checked) return;
    context.actions.replaceCommand(context.path, {
      ...cmd,
      cancelBehavior: behavior,
      cancelBranch: behavior === "branch" ? cmd.cancelBranch ?? [] : cmd.cancelBranch,
    });
  });
  return el("label", {
    class: "event-command-cancel-row",
    children: [
      input,
      el("span", { text: cancelBehaviorLabel(behavior) }),
    ],
  });
}

function cancelBehaviorLabel(behavior: ChoiceCancelBehavior): string {
  if (behavior === "disallow") return "취소 금지";
  if (behavior === "branch") return "취소 분기";
  return `선택지 ${behavior.slice("choice".length)}`;
}

function optionsFromInputs(inputs: readonly HTMLInputElement[], cmd: ChoicesCommand): ChoiceOption[] {
  const options = inputs
    .map((input, index) => ({
      text: input.value.trim(),
      branch: cmd.options[index]?.branch ?? [],
    }))
    .filter((option) => option.text.length > 0);
  return options.length ? options : [{ text: "예", branch: [] }, { text: "아니오", branch: [] }];
}

function choiceOptionBody(
  context: CommandEditContext,
  cmd: ChoicesCommand,
  opt: ChoiceOption,
  optIdx: number
): HTMLElement {
  const optWrap = el("div", {
    class: "event-command-choice-branch",
    dataset: { testid: `event-choice-branch-${optIdx + 1}` },
    attrs: { "aria-label": `선택지 ${optIdx + 1} 가지 편집 영역` },
  });
  const branchPath = [...context.path, optIdx];
  const branchList = el("div", {
    class: "cmd-list event-command-choice-branch-list",
    dataset: { testid: `event-choice-branch-command-list-${optIdx + 1}` },
  });
  renderCommandList(branchList, opt.branch, branchPath, context.actions);
  optWrap.append(
    el("div", { class: "event-command-choice-branch-title", text: `선택지 ${optIdx + 1} 가지 편집: ${opt.text}` }),
    branchList,
    choiceBranchAddRow(context, cmd, branchPath, optIdx)
  );
  return optWrap;
}

function choiceBranchAddRow(
  context: CommandEditContext,
  cmd: ChoicesCommand,
  branchPath: number[],
  optIdx?: number
): HTMLElement {
  const branchAddRow = el("div", {
    class: "event-command-choice-branch-actions",
    dataset: { testid: optIdx === undefined ? "event-choice-cancel-branch-add-row" : `event-choice-branch-add-row-${optIdx + 1}` },
  });
  const branchSel = commandKindSelect("text");
  branchSel.dataset.testid =
    optIdx === undefined ? "event-choice-cancel-branch-add-kind" : `event-choice-branch-add-kind-${optIdx + 1}`;
  branchAddRow.append(
    branchSel,
    el("button", {
      class: "btn",
      dataset: { testid: optIdx === undefined ? "event-choice-cancel-branch-add" : `event-choice-branch-add-${optIdx + 1}` },
      text: "+",
      on: {
        click: () => {
          const branchLabel = optIdx === undefined ? "취소 가지" : `선택지 ${optIdx + 1} 가지`;
          openEventCommandEditDialog({
            initial: newCommand(selectedOptionValue(branchSel, COMMAND_KIND_OPTIONS, "text")),
            title: `${branchLabel}에 명령 추가`,
            onApply: (command) => context.actions.addCommand(branchPath, command),
          });
        },
      },
    })
  );
  if (optIdx !== undefined) {
    branchAddRow.append(
      el("button", {
        class: "btn danger",
        dataset: { testid: `event-choice-delete-${optIdx + 1}` },
        text: "선택지 삭제",
        on: {
          click: () => {
            context.actions.replaceCommand(context.path, {
              ...cmd,
              options: cmd.options.filter((_, index) => index !== optIdx),
            });
          },
        },
      })
    );
  }
  return branchAddRow;
}

function cancelBranchBody(context: CommandEditContext, cmd: ChoicesCommand): HTMLElement {
  const branchPath = [...context.path, CHOICE_CANCEL_BRANCH_INDEX];
  const branchList = el("div", {
    class: "cmd-list event-command-choice-branch-list",
    dataset: { testid: "event-choice-cancel-branch-command-list" },
  });
  renderCommandList(branchList, cmd.cancelBranch ?? [], branchPath, context.actions);
  return el("div", {
    class: "event-command-choice-branch",
    dataset: { testid: "event-choice-cancel-branch-body" },
    attrs: { "aria-label": "취소 가지 편집 영역" },
    children: [
      el("div", { class: "event-command-choice-branch-title", text: "취소 가지 편집" }),
      branchList,
      choiceBranchAddRow(context, cmd, branchPath),
    ],
  });
}
