import { newCommand } from "@/editor/eventActions";
import { clearChildren, el } from "@/util/dom";
import { commandKindSelect, selectedOptionValue } from "./dom";
import { COMMAND_KIND_OPTIONS, commandKindLabel } from "./options";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "./types";

type LoopCommand = Extract<Command, { kind: "loop" }>;

// fork 의 then/else 분기 편집(forkBranch.ts)과 동일한 패턴: working 사본을 두고
// 변경 시마다 replaceCommand 로 커밋한다. loop 는 body 하나만 가진다.
export function loopBody(context: CommandEditContext, cmd: LoopCommand): HTMLElement {
  const wrap = el("div", {
    class: "loop-body-editor",
    attrs: { style: "border:1px solid var(--border);padding:4px;margin-top:4px;border-radius:3px;" },
    dataset: { testid: "event-loop-body" },
  });
  wrap.append(el("label", { text: `반복 내용 (${cmd.body.length} 명령)` }));
  const working: Command[] = structuredClone(cmd.body);
  const listEl = el("div", { class: "cmd-list", dataset: { testid: "event-loop-body-list" } });
  const commit = () => {
    context.actions.replaceCommand(context.path, { ...cmd, body: structuredClone(working) });
  };
  const rerender = () => {
    clearChildren(listEl);
    working.forEach((_, index) => {
      listEl.append(renderLoopItem(working, index, commit, rerender));
    });
  };
  rerender();
  wrap.append(listEl, renderLoopAddRow(working, commit, rerender));
  return wrap;
}

function renderLoopItem(working: Command[], index: number, commit: () => void, rerender: () => void): HTMLElement {
  const command = working[index];
  const item = el("div", { class: "cmd-item", dataset: { testid: `event-loop-body-item-${index}` } });
  if (!command) return item;
  item.append(el("span", { class: "cmd-kind", text: commandKindLabel(command.kind) }));
  if (command.kind === "text") {
    const body = el("textarea", { dataset: { testid: `event-loop-body-text-${index}` } }) as HTMLTextAreaElement;
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
      dataset: { testid: `event-loop-body-delete-${index}` },
      text: "×",
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

function renderLoopAddRow(working: Command[], commit: () => void, rerender: () => void): HTMLElement {
  const addRow = el("div", { dataset: { testid: "event-loop-body-add-row" } });
  const sel = commandKindSelect("text");
  sel.dataset.testid = "event-loop-body-add-kind";
  addRow.append(
    sel,
    el("button", {
      class: "btn",
      dataset: { testid: "event-loop-body-add" },
      text: "+ 명령",
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
