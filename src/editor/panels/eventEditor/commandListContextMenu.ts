import { el } from "@/util/dom";
import type { Command } from "@/project/types";
import { openNewEventCommandDialog } from "./commandEditDialog";
import { newM2Command } from "@/editor/eventCommandFactory";
import { copyEventCommandToClipboard, hasEventCommandClipboard, readEventCommandClipboard } from "./commandClipboard";
import { openEventCommandPicker } from "./commandPicker";
import type { M2RuntimeContext } from "@/project/eventCommands/runtimeSupport";
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
  // 삽입 피커 배지용 편집 컨텍스트(맵/공통/배틀). 없으면 보수 배지.
  readonly pickerContext?: M2RuntimeContext;
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
        event.stopPropagation();
        cutCommand(request);
        closeMenu?.();
        return;
      case "c":
        event.preventDefault();
        event.stopPropagation();
        copyEventCommandToClipboard(request.command);
        closeMenu?.();
        return;
      case "v":
        event.preventDefault();
        event.stopPropagation();
        pasteCommand(request);
        closeMenu?.();
        return;
      case "a":
        event.preventDefault();
        event.stopPropagation();
        selectAllCommands(request.item);
        closeMenu?.();
        return;
      case "/":
      case "?":
        event.preventDefault();
        event.stopPropagation();
        insertCommentCommand(request);
        closeMenu?.();
        return;
    }
  }
  if (event.ctrlKey || event.altKey) return;
  if (event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    openInsertPicker(request, closeMenu ?? (() => undefined));
    return;
  }
  if (event.key === " " || event.key === "Spacebar") {
    event.preventDefault();
    event.stopPropagation();
    request.openEditor();
    closeMenu?.();
    return;
  }
  if (event.key === "Delete" || event.key === "Del" || event.key === "Backspace") {
    // 명령 목록 포커스에서 Delete 는 명령만 지운다.
    // stopPropagation 필수 — 모달 backdrop 의 "이벤트 삭제" 핸들러로 버블되면 이벤트 전체가 날아간다.
    event.preventDefault();
    event.stopPropagation();
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
      label: "주석 삽입",
      shortcut: "Ctrl+/",
      icon: "insert",
      testId: "event-command-menu-insert-comment",
      run: () => {
        insertCommentCommand(request);
        close();
      },
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
      copyEventCommandToClipboard(request.command);
      close();
    }),
    contextMenuAction("붙여넣기", "Ctrl+V", "paste", "event-command-menu-paste", () => {
      pasteCommand(request);
      close();
    }, !hasEventCommandClipboard()),
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
  copyEventCommandToClipboard(request.command);
  request.actions.deleteCommand(request.path);
}

function pasteCommand(request: CommandShortcutRequest): void {
  const command = readEventCommandClipboard();
  if (command) request.actions.insertCommand(request.path, command);
}

function insertCommentCommand(request: CommandShortcutRequest): void {
  const command = newM2Command("m2-088-comment");
  openNewEventCommandDialog(command, (edited) => {
    request.actions.insertCommand(request.path, edited);
  });
}

function selectAllCommands(item: HTMLElement): void {
  item.parentElement?.querySelectorAll(".cmd-item").forEach((node) => node.classList.add("selected"));
}

function openInsertPicker(request: CommandShortcutRequest, closeMenu: () => void): void {
  closeMenu();
  openEventCommandPicker({
    title: "이벤트 명령 삽입",
    context: request.pickerContext,
    onSelect: (command, closePicker) => {
      openNewEventCommandDialog(command, (editedCommand) => {
        request.actions.insertCommand(request.path, editedCommand);
        closePicker();
      });
      return { closePicker: false };
    },
  });
}
