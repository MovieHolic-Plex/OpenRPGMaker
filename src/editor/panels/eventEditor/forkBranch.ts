import { newCommand } from "@/editor/eventActions";
import { clearChildren, el } from "@/util/dom";
import { commandKindSelect, selectedOptionValue } from "./dom";
import { COMMAND_KIND_OPTIONS, commandKindLabel } from "./options";
import type { Command } from "@/project/types";
import type { CommandListActions } from "./types";

type ForkCommand = Extract<Command, { kind: "fork" }>;

export function renderForkBranch(
  path: number[],
  actions: CommandListActions,
  fork: ForkCommand,
  branch: "then" | "else",
  cmds: Command[]
): HTMLElement {
  const wrap = el("div", {
    class: "fork-branch",
    attrs: { style: "border:1px solid var(--border);padding:4px;margin-top:4px;border-radius:3px;" },
    dataset: { testid: `event-fork-branch-${branch}` },
  });
  wrap.append(el("label", { text: `${branch} (${cmds.length} 명령)` }));
  const working: Command[] = structuredClone(cmds);
  const commit = () => {
    const nextFork: ForkCommand =
      branch === "then"
        ? { ...fork, then: structuredClone(working) }
        : { ...fork, else: structuredClone(working) };
    actions.replaceCommand(path, nextFork);
  };
  const listEl = el("div", { class: "cmd-list", dataset: { testid: `event-fork-branch-list-${branch}` } });
  const rerender = () => {
    clearChildren(listEl);
    working.forEach((_, index) => {
      listEl.append(renderForkBranchItem(working, index, commit, branch));
    });
  };
  rerender();
  wrap.append(listEl, renderForkBranchAddRow(working, commit, branch));
  return wrap;
}

function renderForkBranchItem(working: Command[], index: number, commit: () => void, branch: "then" | "else"): HTMLElement {
  const command = working[index];
  const item = el("div", { class: "cmd-item", dataset: { testid: `event-fork-branch-item-${branch}-${index}` } });
  if (!command) return item;
  item.append(el("span", { class: "cmd-kind", text: commandKindLabel(command.kind) }));
  if (command.kind === "text") {
    const body = el("textarea", {
      dataset: { testid: `event-fork-branch-text-${branch}-${index}` },
    }) as HTMLTextAreaElement;
    body.value = command.body;
    body.addEventListener("change", () => {
      working[index] = { kind: "text", body: body.value };
      commit();
    });
    item.append(body);
  }
  item.append(
    el("button", {
      class: "btn danger",
      dataset: { testid: `event-fork-branch-delete-${branch}-${index}` },
      text: "×",
      on: {
        click: () => {
          working.splice(index, 1);
          commit();
        },
      },
    })
  );
  return item;
}

function renderForkBranchAddRow(working: Command[], commit: () => void, branch: "then" | "else"): HTMLElement {
  const addRow = el("div", { dataset: { testid: `event-fork-branch-add-row-${branch}` } });
  const sel = commandKindSelect("text");
  sel.dataset.testid = `event-fork-branch-add-kind-${branch}`;
  addRow.append(
    sel,
    el("button", {
      class: "btn",
      dataset: { testid: `event-fork-branch-add-${branch}` },
      text: "+ 명령",
      on: {
        click: () => {
          working.push(newCommand(selectedOptionValue(sel, COMMAND_KIND_OPTIONS, "text")));
          commit();
        },
      },
    })
  );
  return addRow;
}
