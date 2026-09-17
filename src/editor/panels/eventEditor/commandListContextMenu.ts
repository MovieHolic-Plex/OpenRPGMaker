import { el } from "@/util/dom";
import type { Command } from "@/project/types";
import { openNewEventCommandDialog } from "./commandEditDialog";
import { newM2Command } from "@/editor/eventCommandFactory";
import { copyEventCommandsToClipboard, hasEventCommandClipboard, readEventCommandsClipboard } from "./commandClipboard";
import { insertionPathAfter, isCommandSelected, selectAllAuthoredCommands, selectedCommandPaths, selectedCommandRoots } from "./commandInspector";
import { resolveCommandAtPath } from "@/editor/eventCommandPaths";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
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
  readonly commands?: readonly Command[];
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

let disposeContextMenu: (() => void) | undefined;

export function closeCommandContextMenu(): void { disposeContextMenu?.(); }

export function openCommandContextMenu(request: CommandShortcutRequest): void {
  closeCommandContextMenu();
  const menu = el("div", {
    class: "event-command-context-menu",
    attrs: { role: "menu" },
    dataset: { testid: "event-command-context-menu" },
  });
  const opener = request.item.querySelector<HTMLElement>(".cmd-head") ?? request.item;
  const parent = request.item.closest<HTMLElement>('[data-testid="event-editor-modal"]')
    ?? request.item.closest<HTMLElement>('[role="dialog"]');
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener("mousedown", closeOnOutside);
    parent?.removeEventListener("oprn:event-editor-close", close);
    observer?.disconnect();
    unregisterModal(menu);
    menu.remove();
    if (disposeContextMenu === close) disposeContextMenu = undefined;
    const fallback = parent?.isConnected ? parent.querySelector<HTMLElement>(".cmd-head, button") : null;
    (opener.isConnected ? opener : fallback)?.focus();
  };
  const observer = typeof MutationObserver === "undefined" ? undefined : new MutationObserver(() => {
    if (!opener.isConnected || (parent && !parent.isConnected)) close();
  });
  disposeContextMenu = close;
  menu.append(...contextMenuNodes(request, close));
  document.body.append(menu);
  registerModal(menu, close);
  parent?.addEventListener("oprn:event-editor-close", close);
  observer?.observe(document.body, { childList: true, subtree: true });
  const rect = menu.getBoundingClientRect();
  const left = Math.min(request.x, window.innerWidth - rect.width - 8);
  const top = Math.min(request.y, window.innerHeight - rect.height - 8);
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;
  const closeOnOutside = (event: MouseEvent) => {
    if (event.target instanceof Node && menu.contains(event.target)) return;
    close();
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
  if ((event.ctrlKey || event.metaKey) && !event.altKey) {
    switch (event.key.toLowerCase()) {
      case "z":
      case "y":
        if (!request.actions.undo) return;
        event.preventDefault();
        event.stopPropagation();
        closeMenu?.();
        if (event.shiftKey || event.key.toLowerCase() === "y") request.actions.redo?.();
        else request.actions.undo();
        return;
      case "x":
        event.preventDefault();
        event.stopPropagation();
        cutCommand(request);
        closeMenu?.();
        return;
      case "c":
        event.preventDefault();
        event.stopPropagation();
        copyCommands(request);
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
        selectAllAuthoredCommands(request.commands ?? [request.command]);
        closeMenu?.();
        return;
      case "/":
      case "?":
        event.preventDefault();
        event.stopPropagation();
        closeMenu?.();
        insertCommentCommand(request);
        return;
    }
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    openInsertPicker(request, closeMenu ?? (() => undefined));
    return;
  }
  if (event.key === " " || event.key === "Spacebar") {
    event.preventDefault();
    event.stopPropagation();
    closeMenu?.();
    request.openEditor();
    return;
  }
  if (event.key === "Delete" || event.key === "Del" || event.key === "Backspace") {
    // 명령 목록 포커스에서 Delete 는 명령만 지운다.
    // stopPropagation 필수 — 모달 backdrop 의 "이벤트 삭제" 핸들러로 버블되면 이벤트 전체가 날아간다.
    event.preventDefault();
    event.stopPropagation();
    deleteCommands(request);
    closeMenu?.();
  }
}

function contextMenuNodes(request: CommandShortcutRequest, close: () => void): HTMLElement[] {
  const items: ContextMenuItem[] = [
    {
      label: "아래에 삽입...",
      shortcut: "Enter",
      icon: "insert",
      testId: "event-command-menu-insert",
      run: () => openInsertPicker(request, close),
    },
    {
      label: "아래에 주석 삽입",
      shortcut: "Ctrl+/",
      icon: "insert",
      testId: "event-command-menu-insert-comment",
      run: () => {
        close();
        insertCommentCommand(request);
      },
    },
    {
      label: "편집...",
      shortcut: "Space",
      icon: "edit",
      testId: "event-command-menu-edit",
      run: () => {
        close();
        request.openEditor();
      },
    },
    { separator: true },
    contextMenuAction("잘라내기", "Ctrl+X", "cut", "event-command-menu-cut", () => {
      cutCommand(request);
      close();
    }),
    contextMenuAction("복사", "Ctrl+C", "copy", "event-command-menu-copy", () => {
      copyCommands(request);
      close();
    }),
    contextMenuAction("붙여넣기", "Ctrl+V", "paste", "event-command-menu-paste", () => {
      pasteCommand(request);
      close();
    }, !hasEventCommandClipboard()),
    contextMenuAction("삭제", "Del", "delete", "event-command-menu-delete", () => {
      deleteCommands(request);
      close();
    }),
    contextMenuAction("전체 선택", "Ctrl+A", "select-all", "event-command-menu-select-all", () => {
      selectAllAuthoredCommands(request.commands ?? [request.command]);
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
  copyCommands(request);
  deleteCommands(request);
}

/**
 * 붙여넣기·「명령 넣기」의 자리 = 이 행 **바로 아래, 같은 깊이**. 여러 행을 골랐으면 마지막 뿌리 선택 아래.
 * 「+ 명령」(content.openCommandPickerForActions)과 같은 규칙이다 — 예전엔 여기만 행 앞에 넣어서
 * 두 삽입 규칙이 서로 달랐다(2026-09-17 적대적 리뷰 P0-3).
 */
function insertionPath(request: CommandShortcutRequest): number[] {
  const roots = isCommandSelected(request.path) ? selectedCommandRoots(selectedCommandPaths()) : [];
  const anchor = roots.length > 0 ? roots[roots.length - 1]! : request.path;
  return insertionPathAfter(anchor);
}

function pasteCommand(request: CommandShortcutRequest): void {
  const commands = readEventCommandsClipboard();
  if (commands.length === 0) return;
  const at = insertionPath(request);
  if (request.actions.insertCommands) request.actions.insertCommands(at, commands);
  else [...commands].reverse().forEach(command => request.actions.insertCommand(at, command));
}

function requestPaths(request: CommandShortcutRequest): number[][] {
  return selectedCommandRoots(isCommandSelected(request.path) ? selectedCommandPaths() : [request.path]);
}

function copyCommands(request: CommandShortcutRequest): void {
  const root = request.commands;
  copyEventCommandsToClipboard(root ? requestPaths(request).flatMap(path => {
    const command = resolveCommandAtPath([...root], path);
    return command ? [command] : [];
  }) : [request.command]);
}

function deleteCommands(request: CommandShortcutRequest): void {
  const paths = requestPaths(request);
  if (request.actions.deleteCommands) request.actions.deleteCommands(paths);
  else paths.reverse().forEach(path => request.actions.deleteCommand(path));
}

function insertCommentCommand(request: CommandShortcutRequest): void {
  const command = newM2Command("m2-088-comment");
  const at = insertionPath(request);
  openNewEventCommandDialog(command, (edited) => {
    request.actions.insertCommand(at, edited);
  });
}

function openInsertPicker(request: CommandShortcutRequest, closeMenu: () => void): void {
  closeMenu();
  const at = insertionPath(request);
  openEventCommandPicker({
    title: "명령 넣기 — 이 행 바로 아래에",
    context: request.pickerContext,
    onSelect: (command) => {
      openNewEventCommandDialog(command, (editedCommand) => {
        request.actions.insertCommand(at, editedCommand);
      });
    },
  });
}
