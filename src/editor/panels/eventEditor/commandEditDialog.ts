import { newCommand } from "@/editor/eventActions";
import { m2CommandById } from "@/editor/eventCommands/m2Catalog";
import { resolveRootCommandBranchList } from "@/editor/eventCommandPaths";
import type { Command } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { renderCommandBody } from "./commandBody";
import { commandLabel } from "./commandPicker";
import { openEventSubdialog } from "./subdialog";
import type { CommandListActions } from "./types";

type EventCommandEditDialogRequest = {
  readonly title?: string;
  readonly initial: Command;
  readonly onApply: (command: Command) => void;
};

export function openEventCommandEditDialog(request: EventCommandEditDialogRequest): void {
  let stagedCommand = structuredClone(request.initial);
  openEventSubdialog({
    title: request.title ?? commandEditTitle(stagedCommand),
    testId: "event-command-edit-dialog",
    width: "wide",
    render: (body, close) => {
      const editor = el("div", {
        class: "event-command-edit-dialog",
        dataset: { testid: "event-command-edit-form" },
      });
      const formHost = el("div", { class: "event-command-edit-body" });
      const renderEditor = () => {
        clearChildren(formHost);
        formHost.append(renderCommandBody({ path: [], actions }, stagedCommand));
      };
      const actions: CommandListActions = {
        addCommand: (containerPath, command) => {
          const list = commandContainer(stagedCommand, containerPath);
          if (!list) return;
          list.push(structuredClone(command));
          renderEditor();
        },
        insertCommand: (path, command) => {
          const containerPath = path.slice(0, -1);
          const insertIndex = path[path.length - 1] ?? 0;
          const list = commandContainer(stagedCommand, containerPath);
          if (!list) return;
          list.splice(insertIndex, 0, structuredClone(command));
          renderEditor();
        },
        replaceCommand: (path, command) => {
          if (path.length === 0) {
            stagedCommand = structuredClone(command);
            renderEditor();
            return;
          }
          const containerPath = path.slice(0, -1);
          const replaceIndex = path[path.length - 1];
          if (replaceIndex === undefined) return;
          const list = commandContainer(stagedCommand, containerPath);
          if (!list) return;
          list[replaceIndex] = structuredClone(command);
          renderEditor();
        },
        deleteCommand: (path) => {
          const containerPath = path.slice(0, -1);
          const deleteIndex = path[path.length - 1];
          if (deleteIndex === undefined) return;
          const list = commandContainer(stagedCommand, containerPath);
          if (!list) return;
          list.splice(deleteIndex, 1);
          renderEditor();
        },
        moveCommand: (path, dir) => {
          const containerPath = path.slice(0, -1);
          const fromIndex = path[path.length - 1];
          if (fromIndex === undefined) return;
          const list = commandContainer(stagedCommand, containerPath);
          if (!list) return;
          const toIndex = fromIndex + dir;
          if (toIndex < 0 || toIndex >= list.length) return;
          const moving = list[fromIndex];
          if (!moving) return;
          list.splice(fromIndex, 1);
          list.splice(toIndex, 0, moving);
          renderEditor();
        },
        moveCommandTo: (sourcePath, toIndex) => {
          const containerPath = sourcePath.slice(0, -1);
          const fromIndex = sourcePath[sourcePath.length - 1];
          if (fromIndex === undefined) return;
          const list = commandContainer(stagedCommand, containerPath);
          const moving = list?.[fromIndex];
          if (!list || !moving || toIndex < 0 || toIndex >= list.length) return;
          list.splice(fromIndex, 1);
          list.splice(toIndex, 0, moving);
          renderEditor();
        },
      };
      const ok = el("button", {
        class: "event-command-edit-action primary",
        text: "확인",
        attrs: { type: "button" },
        dataset: { testid: "event-command-edit-ok" },
        on: {
          click: () => {
            commitPendingControls(editor);
            request.onApply(structuredClone(stagedCommand));
            close();
          },
        },
      });
      const cancel = el("button", {
        class: "event-command-edit-action",
        text: "취소",
        attrs: { type: "button" },
        dataset: { testid: "event-command-edit-cancel" },
        on: { click: close },
      });

      editor.append(
        formHost,
        el("div", {
          class: "event-command-edit-actions",
          children: [ok, cancel],
        })
      );
      body.append(editor);
      renderEditor();
    },
  });
}

function commitPendingControls(root: HTMLElement): void {
  const controls = root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    "input, select, textarea"
  );
  for (const control of [...controls]) {
    if (control.dataset.commandKindSelect === "true") continue;
    control.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function commandContainer(rootCommand: Command, containerPath: readonly number[]): Command[] | null {
  return resolveRootCommandBranchList(rootCommand, containerPath, { missingBranches: "create" });
}

export function openNewEventCommandDialog(command: Command, onApply: (command: Command) => void): void {
  openEventCommandEditDialog({
    initial: command,
    title: commandEditTitle(command),
    onApply,
  });
}

export function openNewEventCommandKindDialog(kind: Command["kind"], onApply: (command: Command) => void): void {
  openNewEventCommandDialog(newCommand(kind), onApply);
}

function commandEditTitle(command: Command): string {
  if (command.kind === "m2Command") return m2CommandById(command.commandId)?.label ?? command.commandId;
  return commandLabel(command.kind);
}
