import { el } from "@/util/dom";
import type { Command } from "@/project/types";
import { openNewEventCommandDialog } from "./commandEditDialog";
import { openEventCommandPicker } from "./commandPicker";
import type { CommandListActions } from "./types";

type CommandShortcutRequest = {
  readonly x: number;
  readonly y: number;
  readonly item: HTMLElement;
  readonly command: Command;
  readonly path: number[];
  readonly actions: CommandListActions;
  // 편집 진입점(모달). commandList 가 lockKind:true 로 구성해 넘긴다.
  readonly openEditor: () => void;
};

type ContextMenuItem =
  | {
      readonly label: string;
      readonly shortcut: string;
      readonly icon: string;
      readonly testId: string;
      readonly run: () => void;
      readonly disabled?: boolean;
      readonly separator?: false;
    }
  | { readonly separator: true };

let commandClipboard: Command | null = null;

export function openCommandContextMenu(request: CommandShortcutRequest): void {
  document.querySelector('[data-testid="event-command-context-menu"]')?.remove();
  const menu = el("div", {
    class: "event-command-context-menu",
    attrs: { role: "menu" },
    dataset: { testid: "event-command-context-menu" },
  });
  const close = () => menu.remove();
  menu.append(...contextMenuNodes(request, close));
  document.body.append(menu);
  const rect = menu.getBoundingClientRect();
  const left = Math.min(request.x, window.innerWidth - rect.width - 8);
  const top = Math.min(request.y, window.innerHeight - rect.height - 8);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;
  const closeOnOutside = (event: MouseEvent) => {
    if (event.target instanceof Node && menu.contains(event.target)) return;
    close();
    document.removeEventListener("mousedown", closeOnOutside);
  };
  document.addEventListener("mousedown", closeOnOutside);
  menu.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      close();
      return;
    }
    handleCommandShortcut(event, request, close);
  });
  menu.querySelector<HTMLElement>('[data-testid="event-command-menu-edit"]')?.focus();
}

export function handleCommandShortcut(
  event: KeyboardEvent,
  request: CommandShortcutRequest,
  closeMenu?: () => void
): void {
  if (event.ctrlKey && !event.altKey) {
    switch (event.key.toLowerCase()) {
      case "x":
        event.preventDefault();
        cutCommand(request);
        closeMenu?.();
        return;
      case "c":
        event.preventDefault();
        copyCommand(request.command);
        closeMenu?.();
        return;
      case "v":
        event.preventDefault();
        pasteCommand(request);
        closeMenu?.();
        return;
      case "a":
        event.preventDefault();
        selectAllCommands(request.item);
        closeMenu?.();
        return;
    }
  }
  if (event.ctrlKey || event.altKey) return;
  if (event.key === "Enter") {
    event.preventDefault();
    openInsertPicker(request, closeMenu ?? (() => undefined));
    return;
  }
  if (event.key === " " || event.key === "Spacebar") {
    event.preventDefault();
    request.openEditor();
    closeMenu?.();
    return;
  }
  if (event.key === "Delete" || event.key === "Del") {
    event.preventDefault();
    request.actions.deleteCommand(request.path);
    closeMenu?.();
  }
}

function contextMenuNodes(request: CommandShortcutRequest, close: () => void): HTMLElement[] {
  const items: ContextMenuItem[] = [
    {
      label: "삽입...",
      shortcut: "Enter",
      icon: "insert",
      testId: "event-command-menu-insert",
      run: () => openInsertPicker(request, close),
    },
    {
      label: "편집...",
      shortcut: "Space",
      icon: "edit",
      testId: "event-command-menu-edit",
      run: () => {
        request.openEditor();
        close();
      },
    },
    { separator: true },
    contextMenuAction("잘라내기", "Ctrl+X", "cut", "event-command-menu-cut", () => {
      cutCommand(request);
      close();
    }),
    contextMenuAction("복사", "Ctrl+C", "copy", "event-command-menu-copy", () => {
      copyCommand(request.command);
      close();
    }),
    contextMenuAction("붙여넣기", "Ctrl+V", "paste", "event-command-menu-paste", () => {
      pasteCommand(request);
      close();
    }, !commandClipboard),
    contextMenuAction("삭제", "Del", "delete", "event-command-menu-delete", () => {
      request.actions.deleteCommand(request.path);
      close();
    }),
    contextMenuAction("전체 선택", "Ctrl+A", "select-all", "event-command-menu-select-all", () => {
      selectAllCommands(request.item);
      close();
    }),
  ];
  return items.map((item) =>
    item.separator
      ? el("div", { class: "event-command-menu-separator", attrs: { role: "separator" } })
      : contextMenuButton(item)
  );
}

function contextMenuAction(
  label: string,
  shortcut: string,
  icon: string,
  testId: string,
  run: () => void,
  disabled = false
): ContextMenuItem {
  return { label, shortcut, icon, testId, run, disabled };
}

function contextMenuButton(item: Extract<ContextMenuItem, { readonly separator?: false }>): HTMLButtonElement {
  return el("button", {
    class: "event-command-menu-item",
    attrs: item.disabled ? { type: "button", disabled: "", role: "menuitem" } : { type: "button", role: "menuitem" },
    children: [
      el("span", {
        class: `event-command-menu-icon ${item.icon}`,
        attrs: { "aria-hidden": "true" },
      }),
      el("span", { class: "event-command-menu-label", text: item.label }),
      el("span", { class: "event-command-menu-shortcut", text: item.shortcut }),
    ],
    dataset: { testid: item.testId },
    on: { click: item.run },
  }) as HTMLButtonElement;
}

function cutCommand(request: CommandShortcutRequest): void {
  commandClipboard = structuredClone(request.command);
  request.actions.deleteCommand(request.path);
}

function copyCommand(command: Command): void {
  commandClipboard = structuredClone(command);
}

function pasteCommand(request: CommandShortcutRequest): void {
  if (commandClipboard) request.actions.insertCommand(request.path, structuredClone(commandClipboard));
}

function selectAllCommands(item: HTMLElement): void {
  item.parentElement?.querySelectorAll(".cmd-item").forEach((node) => node.classList.add("selected"));
}

function openInsertPicker(request: CommandShortcutRequest, closeMenu: () => void): void {
  closeMenu();
  openEventCommandPicker({
    title: "이벤트 명령 삽입",
    onSelect: (command, closePicker) => {
      openNewEventCommandDialog(command, (editedCommand) => {
        request.actions.insertCommand(request.path, editedCommand);
        closePicker();
      });
      return { closePicker: false };
    },
  });
}
