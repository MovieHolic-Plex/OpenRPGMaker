import { clearChildren, el } from "@/util/dom";
import {
  CHOICE_CANCEL_BRANCH_INDEX,
  FORK_ELSE_BRANCH_INDEX,
  FORK_THEN_BRANCH_INDEX,
  SHOP_TRANSACTION_BRANCH_INDEX,
} from "@/editor/eventCommandPaths";
import { renderCommandBody } from "./commandBody";
import { openEventCommandEditDialog, openNewEventCommandDialog } from "./commandEditDialog";
import { attachItemDropHandlers, enableItemDrag, ensureListDropHandlers } from "./commandListDragDrop";
import { openEventCommandPicker } from "./commandPicker";
import { commandSummaryParts } from "./commandSummary";
import type { Command } from "@/project/types";
import type { CommandListActions } from "./types";

// 이벤트 명령 리스트 렌더링. RM2K3 처럼 트리 들여쓰기 + 드래그 재정렬 + 위/아래/삭제 버튼.
// 드래그는 같은 컨테이너(리스트) 내에서만 동작한다. path 는 컨테이너 공통 접두어를 공유하므로
// 마지막 인덱스만 비교해 순서를 바꾼다.

let commandClipboard: Command | null = null;

export function renderCommandList(
  host: HTMLElement,
  commands: Command[],
  containerPath: number[],
  actions: CommandListActions
): void {
  clearChildren(host);
  host.dataset.containerPath = JSON.stringify(containerPath);
  if (commands.length === 0) {
    host.append(el("div", { class: "empty-hint", text: "(명령 없음)" }));
    return;
  }
  // 빈 리스트 드롭을 host 단위에서 잡기 위해 DnD 리스너를 보장한다.
  ensureListDropHandlers(host, actions);
  commands.forEach((cmd, index) => {
    const path = [...containerPath, index];
    renderCommandTree(host, cmd, path, containerPath, actions, 0);
  });
}

function renderCommandTree(
  host: HTMLElement,
  cmd: Command,
  path: number[],
  containerPath: number[],
  actions: CommandListActions,
  depth: number
): void {
  host.append(renderCommandItem(cmd, path, containerPath, actions, depth));
  appendCommandChildren(host, cmd, path, containerPath, actions, depth);
}

function renderCommandItem(
  cmd: Command,
  path: number[],
  containerPath: number[],
  actions: CommandListActions,
  depth: number
): HTMLElement {
  const item = el("div", {
    class: "cmd-item",
    dataset: { testid: `event-command-${cmd.kind}`, cmdPath: JSON.stringify(path), commandKind: cmd.kind },
  });
  item.dataset.renderKindString = String(cmd.kind);
  // 드래그는 핸들에서 시작하고 항목 전체를 드래그한다.
  item.draggable = false;
  const head = el("div", {
    class: "cmd-head",
    attrs: { role: "button", tabindex: "0", title: "더블클릭해서 명령 편집" },
  });
  head.style.setProperty("--cmd-depth", String(depth));
  const handle = el("span", {
    class: "cmd-drag-handle",
    dataset: { testid: "event-command-drag-handle" },
    attrs: { title: "드래그로 순서 변경", "aria-hidden": "true" },
    text: "::",
  });
  // 핸들에서 누르면 항목을 드래그 가능하게 만든다.
  enableItemDrag(handle, item, path);
  head.append(
    handle,
    el("span", { class: "cmd-prefix", text: "@>" }),
    renderCommandSummary(cmd),
    commandActions(path, actions)
  );
  head.addEventListener("click", () => selectCommandLine(item));
  head.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    selectCommandLine(item);
    openCommandContextMenu({ x: event.clientX, y: event.clientY, item, command: cmd, path, actions });
  });
  head.addEventListener("dblclick", () => {
    selectCommandLine(item);
    toggleInlineEditor(item);
  });
  head.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    selectCommandLine(item);
    handleCommandShortcut(event, { x: 0, y: 0, item, command: cmd, path, actions });
  });
  item.append(head);
  const editor = el("div", { class: "cmd-inline-editor" });
  editor.style.setProperty("--cmd-depth", String(depth));
  editor.append(renderCommandBody({ path, actions }, cmd));
  ensureTerminalEditorHint(editor, cmd);
  item.append(editor);
  ensureTerminalRowHint(item, cmd);
  // 항목 자체를 드롭 타겟으로 만들어 위/아래 삽입 위치를 결정한다.
  attachItemDropHandlers(item, path, containerPath, actions);
  return item;
}

function renderCommandSummary(cmd: Command): HTMLElement {
  const summary = el("span", { class: "cmd-kind" });
  for (const part of commandSummaryParts(cmd)) {
    summary.append(el("span", { class: `cmd-summary-token ${part.tone}`, text: part.text }));
  }
  return summary;
}

function ensureTerminalRowHint(item: HTMLElement, cmd: Command): void {
  const hint = terminalEditorHint(cmd);
  if (!hint) return;
  if (item.querySelector(`[data-testid="${hint.testId}"]`)) return;
  item.append(el("span", {
    class: "terminal-command-editor empty-hint",
    text: hint.text,
    dataset: { testid: hint.testId },
  }));
}

function ensureTerminalEditorHint(editor: HTMLElement, cmd: Command): void {
  const hint = terminalEditorHint(cmd);
  if (!hint) return;
  if (editor.querySelector(`[data-testid="${hint.testId}"]`)) return;
  editor.firstElementChild?.append(el("span", {
    class: "terminal-command-editor empty-hint",
    text: hint.text,
    dataset: { testid: hint.testId },
  }));
}

function terminalEditorHint(cmd: Command): { readonly testId: string; readonly text: string } | undefined {
  const kind = String(cmd.kind);
  if (kind.includes("stopAudio")) return { testId: "stop-audio-editor", text: "설정 없음. 현재 재생 중인 오디오를 정지합니다." };
  if (kind.includes("gameOver")) return { testId: "game-over-editor", text: "설정 없음. 게임 오버 화면을 엽니다." };
  if (kind.includes("returnToTitle")) return { testId: "return-to-title-editor", text: "설정 없음. 타이틀 화면으로 돌아갑니다." };
  return undefined;
}

function appendCommandChildren(
  host: HTMLElement,
  cmd: Command,
  path: number[],
  containerPath: number[],
  actions: CommandListActions,
  depth: number
): void {
  if (cmd.kind === "choices") {
    cmd.options.forEach((option, optionIndex) => {
      host.append(renderMarkerLine(`: ${option.text || `선택지 ${optionIndex + 1}`}`, depth));
      option.branch.forEach((child, childIndex) => {
        renderCommandTree(host, child, [...path, optionIndex, childIndex], containerPath, actions, depth + 1);
      });
    });
    if (cmd.cancelBehavior === "branch") {
      host.append(renderMarkerLine(": 취소할 때", depth));
      (cmd.cancelBranch ?? []).forEach((child, childIndex) => {
        renderCommandTree(
          host,
          child,
          [...path, CHOICE_CANCEL_BRANCH_INDEX, childIndex],
          containerPath,
          actions,
          depth + 1
        );
      });
    }
    host.append(renderMarkerLine(": 선택지 종료", depth));
    return;
  }
  if (cmd.kind === "fork") {
    host.append(renderMarkerLine(": 조건이 참일 때", depth));
    cmd.then.forEach((child, childIndex) => {
      renderCommandTree(
        host,
        child,
        [...path, FORK_THEN_BRANCH_INDEX, childIndex],
        containerPath,
        actions,
        depth + 1
      );
    });
    if (cmd.else) {
      host.append(renderMarkerLine(": 그 외의 경우", depth));
      cmd.else.forEach((child, childIndex) => {
        renderCommandTree(
          host,
          child,
          [...path, FORK_ELSE_BRANCH_INDEX, childIndex],
          containerPath,
          actions,
          depth + 1
        );
      });
    }
    host.append(renderMarkerLine(": 분기 종료", depth));
    return;
  }
  if (cmd.kind === "shop" && cmd.branchOnTransaction) {
    host.append(renderMarkerLine(": 플레이어가 구매/판매했을 때", depth));
    (cmd.transactionBranch ?? []).forEach((child, childIndex) => {
      renderCommandTree(
        host,
        child,
        [...path, SHOP_TRANSACTION_BRANCH_INDEX, childIndex],
        containerPath,
        actions,
        depth + 1
      );
    });
    host.append(renderMarkerLine(": 상점 분기 종료", depth));
  }
}

function renderMarkerLine(text: string, depth: number): HTMLElement {
  const line = el("div", { class: "cmd-line-marker", text });
  line.style.setProperty("--cmd-depth", String(depth));
  return line;
}

function selectCommandLine(item: HTMLElement): void {
  item.parentElement?.querySelectorAll(".cmd-item.selected").forEach((node) => node.classList.remove("selected"));
  item.classList.add("selected");
}

function toggleInlineEditor(item: HTMLElement): void {
  item.parentElement?.querySelectorAll(".cmd-item.editing").forEach((node) => {
    if (node !== item) node.classList.remove("editing");
  });
  item.classList.toggle("editing");
}

type ContextMenuRequest = {
  readonly x: number;
  readonly y: number;
  readonly item: HTMLElement;
  readonly command: Command;
  readonly path: number[];
  readonly actions: CommandListActions;
};

function openCommandContextMenu(request: ContextMenuRequest): void {
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

function contextMenuNodes(request: ContextMenuRequest, close: () => void): HTMLElement[] {
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
        openEditCommandDialog(request);
        close();
      },
    },
    { separator: true },
    {
      label: "잘라내기",
      shortcut: "Ctrl+X",
      icon: "cut",
      testId: "event-command-menu-cut",
      run: () => {
        cutCommand(request);
        close();
      },
    },
    {
      label: "복사",
      shortcut: "Ctrl+C",
      icon: "copy",
      testId: "event-command-menu-copy",
      run: () => {
        copyCommand(request.command);
        close();
      },
    },
    {
      label: "붙여넣기",
      shortcut: "Ctrl+V",
      icon: "paste",
      testId: "event-command-menu-paste",
      disabled: !commandClipboard,
      run: () => {
        pasteCommand(request);
        close();
      },
    },
    {
      label: "삭제",
      shortcut: "Del",
      icon: "delete",
      testId: "event-command-menu-delete",
      run: () => {
        request.actions.deleteCommand(request.path);
        close();
      },
    },
    {
      label: "전체 선택",
      shortcut: "Ctrl+A",
      icon: "select-all",
      testId: "event-command-menu-select-all",
      run: () => {
        selectAllCommands(request.item);
        close();
      },
    },
  ];
  return items.map((item) =>
    item.separator
      ? el("div", { class: "event-command-menu-separator", attrs: { role: "separator" } })
      : contextMenuButton(item)
  );
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

function handleCommandShortcut(event: KeyboardEvent, request: ContextMenuRequest, closeMenu?: () => void): void {
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
    toggleInlineEditor(request.item);
    closeMenu?.();
    return;
  }
  if (event.key === "Delete" || event.key === "Del") {
    event.preventDefault();
    request.actions.deleteCommand(request.path);
    closeMenu?.();
  }
}

function openEditCommandDialog(request: ContextMenuRequest): void {
  openEventCommandEditDialog({
    initial: request.command,
    onApply: (command) => request.actions.replaceCommand(request.path, command),
  });
}

function cutCommand(request: ContextMenuRequest): void {
  commandClipboard = structuredClone(request.command);
  request.actions.deleteCommand(request.path);
}

function copyCommand(command: Command): void {
  commandClipboard = structuredClone(command);
}

function pasteCommand(request: ContextMenuRequest): void {
  if (commandClipboard) request.actions.insertCommand(request.path, structuredClone(commandClipboard));
}

function selectAllCommands(item: HTMLElement): void {
  item.parentElement?.querySelectorAll(".cmd-item").forEach((node) => node.classList.add("selected"));
}

function openInsertPicker(request: ContextMenuRequest, closeMenu: () => void): void {
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

function commandActions(path: number[], actions: CommandListActions): HTMLElement {
  const wrap = el("div", { class: "cmd-actions" });
  wrap.append(
    el("button", {
      text: "↑",
      attrs: { title: "위로", type: "button" },
      on: { click: () => actions.moveCommand(path, -1) },
    }),
    el("button", {
      text: "↓",
      attrs: { title: "아래로", type: "button" },
      on: { click: () => actions.moveCommand(path, 1) },
    }),
    el("button", {
      text: "x",
      attrs: { title: "삭제", type: "button" },
      on: { click: () => actions.deleteCommand(path) },
    })
  );
  return wrap;
}
