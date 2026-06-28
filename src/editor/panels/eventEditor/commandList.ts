import { clearChildren, el } from "@/util/dom";
import {
  FORK_ELSE_BRANCH_INDEX,
  FORK_THEN_BRANCH_INDEX,
  SHOP_TRANSACTION_BRANCH_INDEX,
} from "@/editor/eventCommandPaths";
import { renderCommandBody } from "./commandBody";
import { attachItemDropHandlers, enableItemDrag, ensureListDropHandlers } from "./commandListDragDrop";
import { openEventCommandPicker } from "./commandPicker";
import { commandSummary } from "./commandSummary";
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
  // 드래그는 핸들에서 시작하고 항목 전체를 드래그한다.
  item.draggable = false;
  const head = el("div", {
    class: "cmd-head",
    attrs: { role: "button", tabindex: "0", title: "더블클릭해서 명령 편집" },
  });
  head.style.setProperty("--cmd-depth", String(depth));
  const handle = el("span", {
    class: "cmd-drag-handle",
    attrs: { title: "드래그로 순서 변경", "aria-hidden": "true" },
    text: "::",
  });
  // 핸들에서 누르면 항목을 드래그 가능하게 만든다.
  enableItemDrag(handle, item, path);
  head.append(
    handle,
    el("span", { class: "cmd-prefix", text: "@>" }),
    el("span", { class: "cmd-kind", text: commandSummary(cmd) }),
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
    item.classList.toggle("editing");
  });
  head.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key !== "Enter") return;
    event.preventDefault();
    selectCommandLine(item);
    item.classList.toggle("editing");
  });
  item.append(head);
  const editor = el("div", { class: "cmd-inline-editor" });
  editor.style.setProperty("--cmd-depth", String(depth));
  editor.append(renderCommandBody({ path, actions }, cmd));
  item.append(editor);
  // 항목 자체를 드롭 타겟으로 만들어 위/아래 삽입 위치를 결정한다.
  attachItemDropHandlers(item, path, containerPath, actions);
  return item;
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
    host.append(renderMarkerLine(": If Player bought or sold", depth));
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
    host.append(renderMarkerLine(": Shop branch end", depth));
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
  menu.append(
    menuButton("삽입...", "event-command-menu-insert", () => openInsertPicker(request, close)),
    menuButton("편집", "event-command-menu-edit", () => {
      request.item.classList.add("editing");
      close();
    }),
    menuButton("잘라내기", "event-command-menu-cut", () => {
      commandClipboard = structuredClone(request.command);
      request.actions.deleteCommand(request.path);
      close();
    }),
    menuButton("복사", "event-command-menu-copy", () => {
      commandClipboard = structuredClone(request.command);
      close();
    }),
    menuButton("붙여넣기", "event-command-menu-paste", () => {
      if (commandClipboard) request.actions.insertCommand(request.path, structuredClone(commandClipboard));
      close();
    }, !commandClipboard),
    menuButton("삭제", "event-command-menu-delete", () => {
      request.actions.deleteCommand(request.path);
      close();
    }),
    menuButton("전체 선택", "event-command-menu-select-all", () => {
      request.item.parentElement?.querySelectorAll(".cmd-item").forEach((node) => node.classList.add("selected"));
      close();
    })
  );
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
    if (event.key === "Escape") close();
  });
  menu.querySelector<HTMLElement>("button")?.focus();
}

function menuButton(text: string, testId: string, onClick: () => void, disabled = false): HTMLButtonElement {
  return el("button", {
    text,
    attrs: disabled ? { type: "button", disabled: "" } : { type: "button" },
    dataset: { testid: testId },
    on: { click: onClick },
  }) as HTMLButtonElement;
}

function openInsertPicker(request: ContextMenuRequest, closeMenu: () => void): void {
  closeMenu();
  openEventCommandPicker({
    title: "이벤트 명령 삽입",
    onSelect: (command) => {
      request.actions.insertCommand(request.path, command);
      return undefined;
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
