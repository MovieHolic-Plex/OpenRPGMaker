import { newCommand } from "@/editor/eventActions";
import { el } from "@/util/dom";
import { commandKindSelect, selectedOptionValue } from "./dom";
import { renderCommandList } from "./commandList";
import { COMMAND_KIND_OPTIONS } from "./options";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "./types";

type ChoicesCommand = Extract<Command, { kind: "choices" }>;
type ChoiceOption = ChoicesCommand["options"][number];

export function choicesBody(context: CommandEditContext, cmd: ChoicesCommand): HTMLElement {
  const wrap = el("div", {});
  const prompt = el("input", {
    attrs: { type: "text", placeholder: "프롬프트(선택)" },
    value: cmd.prompt ?? "",
  });
  prompt.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      ...cmd,
      prompt: prompt.value.trim() || undefined,
    });
  });
  wrap.append(prompt);
  cmd.options.forEach((opt, optIdx) => {
    wrap.append(choiceOptionBody(context, cmd, opt, optIdx));
  });
  wrap.append(
    el("button", {
      class: "btn",
      text: "+ 선택지 추가",
      on: {
        click: () => {
          context.actions.replaceCommand(context.path, {
            ...cmd,
            options: [...cmd.options, { text: "새 선택지", branch: [{ kind: "text", body: "" }] }],
          });
        },
      },
    })
  );
  return wrap;
}

function choiceOptionBody(
  context: CommandEditContext,
  cmd: ChoicesCommand,
  opt: ChoiceOption,
  optIdx: number
): HTMLElement {
  const optWrap = el("div", {
    attrs: { style: "border:1px solid var(--border);padding:4px;margin-top:4px;border-radius:3px;" },
  });
  const optText = el("input", {
    attrs: { type: "text", placeholder: `선택지 ${optIdx + 1}` },
    value: opt.text,
  });
  optText.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      ...cmd,
      options: cmd.options.map((option, index) => (index === optIdx ? { ...option, text: optText.value } : option)),
    });
  });
  const branchPath = [...context.path, optIdx];
  const branchList = el("div", { class: "cmd-list" });
  renderCommandList(branchList, opt.branch, branchPath, context.actions);
  optWrap.append(optText, branchList, choiceBranchAddRow(context, cmd, branchPath, optIdx));
  return optWrap;
}

function choiceBranchAddRow(
  context: CommandEditContext,
  cmd: ChoicesCommand,
  branchPath: number[],
  optIdx: number
): HTMLElement {
  const branchAddRow = el("div", {});
  const branchSel = commandKindSelect("text");
  branchAddRow.append(
    branchSel,
    el("button", {
      class: "btn",
      text: "+",
      on: {
        click: () => context.actions.addCommand(
          branchPath,
          newCommand(selectedOptionValue(branchSel, COMMAND_KIND_OPTIONS, "text"))
        ),
      },
    }),
    el("button", {
      class: "btn danger",
      text: "옵션 삭제",
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
  return branchAddRow;
}
