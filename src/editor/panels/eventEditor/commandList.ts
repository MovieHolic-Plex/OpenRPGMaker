import { clearChildren, el } from "@/util/dom";
import { renderCommandBody } from "./commandBody";
import { COMMAND_KIND_OPTIONS } from "./options";
import type { Command } from "@/project/types";
import type { CommandListActions } from "./types";

export function renderCommandList(
  host: HTMLElement,
  commands: Command[],
  containerPath: number[],
  actions: CommandListActions
): void {
  clearChildren(host);
  if (commands.length === 0) {
    host.append(el("div", { class: "empty-hint", text: "(명령 없음)" }));
    return;
  }
  commands.forEach((cmd, index) => {
    const path = [...containerPath, index];
    host.append(renderCommandItem(cmd, path, actions));
  });
}

function renderCommandItem(cmd: Command, path: number[], actions: CommandListActions): HTMLElement {
  const item = el("div", { class: "cmd-item", dataset: { testid: `event-command-${cmd.kind}` } });
  const head = el("div", { class: "cmd-head" });
  head.append(el("span", { class: "cmd-kind", text: commandLabel(cmd.kind) }), commandActions(path, actions));
  item.append(head);
  item.append(renderCommandBody({ path, actions }, cmd));
  return item;
}

function commandLabel(kind: Command["kind"]): string {
  return COMMAND_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

function commandActions(path: number[], actions: CommandListActions): HTMLElement {
  const wrap = el("div", { class: "cmd-actions" });
  wrap.append(
    el("button", {
      text: "↑",
      attrs: { title: "위로" },
      on: { click: () => actions.moveCommand(path, -1) },
    }),
    el("button", {
      text: "↓",
      attrs: { title: "아래로" },
      on: { click: () => actions.moveCommand(path, 1) },
    }),
    el("button", {
      text: "×",
      attrs: { title: "삭제" },
      on: { click: () => actions.deleteCommand(path) },
    })
  );
  return wrap;
}
