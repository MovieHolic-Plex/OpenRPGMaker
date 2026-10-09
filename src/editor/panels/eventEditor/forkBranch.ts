import { newCommand } from "@/editor/eventActions";
import { clearChildren, el } from "@/util/dom";
import { commandKindSelect, selectedOptionValue } from "./dom";
import { COMMAND_KIND_OPTIONS, commandKindLabel } from "./options";
import type { Command } from "@/project/types";
import type { CommandListActions } from "./types";
import { textBodyOf } from "@/project/io/rewriteLegacyDialogue";

type ForkCommand = Extract<Command, { kind: "fork" }>;

export function renderForkBranch(
  path: number[],
  actions: CommandListActions,
  fork: ForkCommand,
  branch: "then" | "else",
  cmds: Command[]
): HTMLElement {
  const wrap = el("div", {
    class: `fork-branch fork-branch-${branch}`,
    dataset: { testid: `event-fork-branch-${branch}` },
  });
  const branchTitle = branch === "then" ? "참일 때" : "그 외의 경우";
  const branchSub = branch === "then" ? "조건이 맞을 때 실행" : "조건이 틀릴 때 실행";
  wrap.append(
    el("div", {
      class: "fork-branch-header",
      children: [
        el("div", {
          class: "fork-branch-title",
          text: branchTitle,
          dataset: { testid: `event-fork-branch-label-${branch}` },
        }),
        el("div", {
          class: "fork-branch-meta",
          text: `${cmds.length}개 명령 · ${branchSub}`,
          dataset: { testid: `event-fork-branch-meta-${branch}` },
        }),
      ],
    }),
  );
  const working: Command[] = structuredClone(cmds);
  const listEl = el("div", {
    class: "fork-branch-list",
    dataset: { testid: `event-fork-branch-list-${branch}` },
  });
  const commit = () => {
    const nextFork: ForkCommand =
      branch === "then"
        ? { ...fork, then: structuredClone(working) }
        : { ...fork, else: structuredClone(working) };
    actions.replaceCommand(path, nextFork);
  };
  const rerender = () => {
    clearChildren(listEl);
    if (working.length === 0) {
      listEl.append(
        el("div", {
          class: "fork-branch-empty",
          text: "명령이 없습니다. 아래에서 추가하세요.",
          dataset: { testid: `event-fork-branch-empty-${branch}` },
        })
      );
      return;
    }
    working.forEach((_, index) => {
      listEl.append(renderForkBranchItem(working, index, commit, rerender, branch));
    });
  };
  rerender();
  wrap.append(listEl, renderForkBranchAddRow(working, commit, rerender, branch));
  return wrap;
}

function renderForkBranchItem(
  working: Command[],
  index: number,
  commit: () => void,
  rerender: () => void,
  branch: "then" | "else",
): HTMLElement {
  const command = working[index];
  const item = el("div", {
    class: "fork-branch-item",
    dataset: { testid: `event-fork-branch-item-${branch}-${index}` },
  });
  if (!command) return item;
  item.append(
    el("span", {
      class: "fork-branch-item-kind",
      text: commandKindLabel(command.kind),
    })
  );
  if (command.kind === "text") {
    const body = el("textarea", {
      class: "fork-branch-text",
      attrs: { rows: "2", placeholder: "대사 내용" },
      dataset: { testid: `event-fork-branch-text-${branch}-${index}` },
    }) as HTMLTextAreaElement;
    body.value = textBodyOf(command);
    body.addEventListener("change", () => {
      working[index] = { kind: "text", body: body.value };
      commit();
    });
    item.append(body);
  } else {
    item.append(
      el("span", {
        class: "fork-branch-item-note",
        text: "상세 편집은 메인 명령 목록의 분기 안에서 하세요.",
      })
    );
  }
  item.append(
    el("button", {
      class: "btn danger fork-branch-delete",
      dataset: { testid: `event-fork-branch-delete-${branch}-${index}` },
      text: "삭제",
      attrs: { type: "button", title: "이 명령 삭제" },
      on: {
        click: () => {
          working.splice(index, 1);
          commit();
          rerender();
        },
      },
    }),
  );
  return item;
}

function renderForkBranchAddRow(
  working: Command[],
  commit: () => void,
  rerender: () => void,
  branch: "then" | "else",
): HTMLElement {
  const addRow = el("div", {
    class: "fork-branch-add-row",
    dataset: { testid: `event-fork-branch-add-row-${branch}` },
  });
  const sel = commandKindSelect("text");
  sel.dataset.testid = `event-fork-branch-add-kind-${branch}`;
  addRow.append(
    el("span", { class: "fork-branch-add-label", text: "명령 추가" }),
    sel,
    el("button", {
      class: "btn",
      dataset: { testid: `event-fork-branch-add-${branch}` },
      text: "+ 추가",
      attrs: { type: "button" },
      on: {
        click: () => {
          working.push(newCommand(selectedOptionValue(sel, COMMAND_KIND_OPTIONS, "text")));
          commit();
          rerender();
        },
      },
    }),
  );
  return addRow;
}
