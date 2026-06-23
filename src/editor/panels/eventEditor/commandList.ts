import { clearChildren, el } from "@/util/dom";
import { renderCommandBody } from "./commandBody";
import { COMMAND_KIND_OPTIONS } from "./options";
import type { Command } from "@/project/types";
import type { CommandListActions } from "./types";

// 이벤트 명령 리스트 렌더링. RM2K3 처럼 트리 들여쓰기 + 드래그 재정렬 + 위/아래/삭제 버튼.
// 드래그는 같은 컨테이너(리스트) 내에서만 동작한다. path 는 컨테이너 공통 접두어를 공유하므로
// 마지막 인덱스만 비교해 순서를 바꾼다.

const DRAG_MIME = "application/x-rpgzzu-event-command-path";

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
    host.append(renderCommandItem(cmd, path, containerPath, actions));
  });
}

function renderCommandItem(
  cmd: Command,
  path: number[],
  containerPath: number[],
  actions: CommandListActions
): HTMLElement {
  const item = el("div", {
    class: "cmd-item",
    dataset: { testid: `event-command-${cmd.kind}`, cmdPath: JSON.stringify(path) },
  });
  // 드래그는 핸들에서 시작하고 항목 전체를 드래그한다.
  item.draggable = false;
  const head = el("div", { class: "cmd-head" });
  const handle = el("span", {
    class: "cmd-drag-handle",
    attrs: { title: "드래그로 순서 변경", "aria-hidden": "true" },
    text: "⠿",
  });
  // 핸들에서 누르면 항목을 드래그 가능하게 만든다.
  enableItemDrag(handle, item, path);
  head.append(handle, el("span", { class: "cmd-kind", text: commandLabel(cmd.kind) }), commandActions(path, actions));
  item.append(head);
  item.append(renderCommandBody({ path, actions }, cmd));
  // 항목 자체를 드롭 타겟으로 만들어 위/아래 삽입 위치를 결정한다.
  attachItemDropHandlers(item, path, containerPath, actions);
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

// ── 드래그 앤 드롭 ──

function enableItemDrag(handle: HTMLElement, item: HTMLElement, path: number[]): void {
  handle.style.cursor = "grab";
  handle.addEventListener("pointerdown", () => {
    item.draggable = true;
  });
  item.addEventListener("dragstart", (event) => {
    if (!item.draggable) return;
    const data = event as DragEvent;
    data.dataTransfer?.setData(DRAG_MIME, JSON.stringify(path));
    data.dataTransfer?.setData("text/plain", JSON.stringify(path));
    if (data.dataTransfer) data.dataTransfer.effectAllowed = "move";
    item.classList.add("dragging");
  });
  item.addEventListener("dragend", () => {
    item.draggable = false;
    item.classList.remove("dragging");
    document.querySelectorAll<HTMLElement>(".cmd-drop-before,.cmd-drop-after").forEach((node) => {
      node.classList.remove("cmd-drop-before", "cmd-drop-after");
    });
  });
}

function attachItemDropHandlers(
  item: HTMLElement,
  path: number[],
  containerPath: number[],
  actions: CommandListActions
): void {
  item.addEventListener("dragover", (event) => {
    const data = event as DragEvent;
    if (!hasDragData(data)) return;
    data.preventDefault();
    if (data.dataTransfer) data.dataTransfer.dropEffect = "move";
    const rect = item.getBoundingClientRect();
    const before = data.clientY < rect.top + rect.height / 2;
    item.classList.remove("cmd-drop-before", "cmd-drop-after");
    item.classList.add(before ? "cmd-drop-before" : "cmd-drop-after");
  });
  item.addEventListener("dragleave", () => {
    item.classList.remove("cmd-drop-before", "cmd-drop-after");
  });
  item.addEventListener("drop", (event) => {
    const data = event as DragEvent;
    const sourcePath = readDragPath(data);
    if (!sourcePath) return;
    data.preventDefault();
    item.classList.remove("cmd-drop-before", "cmd-drop-after");
    const rect = item.getBoundingClientRect();
    const before = data.clientY < rect.top + rect.height / 2;
    moveCommandTo(sourcePath, path, before, containerPath, actions);
  });
}

function ensureListDropHandlers(host: HTMLElement, actions: CommandListActions): void {
  // 호스트에 한 번만 리스너를 건다(빈 영역에 드롭해도 마지막으로 보낸다).
  if (host.dataset.dndBound === "1") return;
  host.dataset.dndBound = "1";
  host.addEventListener("dragover", (event) => {
    const data = event as DragEvent;
    if (!hasDragData(data)) return;
    data.preventDefault();
    if (data.dataTransfer) data.dataTransfer.dropEffect = "move";
  });
  host.addEventListener("drop", (event) => {
    const data = event as DragEvent;
    const sourcePath = readDragPath(data);
    if (!sourcePath) return;
    data.preventDefault();
    // 항목 위가 아니면 컨테이너 끝으로 보낸다.
    const containerPath = parseContainerPath(host.dataset.containerPath);
    moveCommandToEnd(sourcePath, containerPath, actions);
  });
}

function hasDragData(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return !!types && (Array.from(types).includes(DRAG_MIME) || Array.from(types).includes("text/plain"));
}

function readDragPath(event: DragEvent): number[] | null {
  const raw = event.dataTransfer?.getData(DRAG_MIME) || event.dataTransfer?.getData("text/plain");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((n) => typeof n === "number") ? parsed : null;
  } catch {
    return null;
  }
}

function parseContainerPath(raw: string | undefined): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((n) => typeof n === "number") ? parsed : [];
  } catch {
    return [];
  }
}

function sameContainer(path: number[], container: number[]): boolean {
  if (path.length !== container.length + 1) return false;
  return container.every((value, index) => path[index] === value);
}

/**
 * sourcePath 를 targetPath 기준 before 위치로 옮긴다.
 * 같은 컨테이너 안에서만 동작. 단일 moveCommandTo 호출로 처리해 중간 재렌더 문제를 피한다.
 * toIndex 는 "소스 제거 후" 기준의 목표 인덱스로 환산해 넘긴다.
 */
function moveCommandTo(
  sourcePath: number[],
  targetPath: number[],
  before: boolean,
  containerPath: number[],
  actions: CommandListActions
): void {
  if (sourcePath.length === 0) return;
  if (!sameContainer(sourcePath, containerPath)) return; // 다른 컨테이너(트리 간) 이동은 미지원.
  if (!sameContainer(targetPath, containerPath)) return;
  const sourceIdx = sourcePath[sourcePath.length - 1];
  const targetIdx = targetPath[targetPath.length - 1];
  let destination = before ? targetIdx : targetIdx + 1;
  // 같은 컨테이너 안이므로 소스가 destination 보다 앞이면 제거로 한 칸 당겨진다.
  if (destination > sourceIdx) destination -= 1;
  actions.moveCommandTo(sourcePath, destination);
}

function moveCommandToEnd(sourcePath: number[], containerPath: number[], actions: CommandListActions): void {
  if (!sameContainer(sourcePath, containerPath)) return;
  // 컨테이너의 마지막 인덱스로 보낸다. 매우 큰 값을 주면 백엔드가 list.length-1 로 클램프한다.
  actions.moveCommandTo(sourcePath, Number.MAX_SAFE_INTEGER);
}
