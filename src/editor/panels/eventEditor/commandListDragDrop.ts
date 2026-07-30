import { isContainerInsideCommand } from "@/editor/eventCommandPaths";
import type { CommandListActions } from "./types";

const DRAG_MIME = "application/x-rpgzzu-event-command-path";

// [P2] 크로스 컨테이너 드래그 유효성 판정용 현재 드래그 소스 경로.
// dragover 시점에는 dataTransfer.getData 를 읽을 수 없으므로 모듈 상태로 유지한다.
let activeDragPath: number[] | null = null;

export function enableItemDrag(handle: HTMLElement, item: HTMLElement, path: number[]): void {
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
    activeDragPath = [...path];
    item.classList.add("dragging");
  });
  item.addEventListener("dragend", () => {
    item.draggable = false;
    activeDragPath = null;
    item.classList.remove("dragging");
    document.querySelectorAll<HTMLElement>(".cmd-drop-before,.cmd-drop-after,.cmd-drop-invalid").forEach((node) => {
      node.classList.remove("cmd-drop-before", "cmd-drop-after", "cmd-drop-invalid");
    });
  });
}

export function attachItemDropHandlers(
  item: HTMLElement,
  path: number[],
  containerPath: number[],
  actions: CommandListActions
): void {
  item.addEventListener("dragover", (event) => {
    const data = event as DragEvent;
    if (!hasDragData(data)) return;
    // [P2] 자기 자신의 분기 안으로는 드롭 금지 — 유효하지 않은 대상은 invalid 표시만.
    if (activeDragPath && !isDropAllowed(activeDragPath, containerPath, actions)) {
      item.classList.remove("cmd-drop-before", "cmd-drop-after");
      item.classList.add("cmd-drop-invalid");
      return;
    }
    data.preventDefault();
    if (data.dataTransfer) data.dataTransfer.dropEffect = "move";
    const rect = item.getBoundingClientRect();
    const before = data.clientY < rect.top + rect.height / 2;
    item.classList.remove("cmd-drop-before", "cmd-drop-after", "cmd-drop-invalid");
    item.classList.add(before ? "cmd-drop-before" : "cmd-drop-after");
  });
  item.addEventListener("dragleave", () => {
    item.classList.remove("cmd-drop-before", "cmd-drop-after", "cmd-drop-invalid");
  });
  item.addEventListener("drop", (event) => {
    const data = event as DragEvent;
    const sourcePath = readDragPath(data);
    if (!sourcePath) return;
    data.preventDefault();
    data.stopPropagation();
    item.classList.remove("cmd-drop-before", "cmd-drop-after", "cmd-drop-invalid");
    const rect = item.getBoundingClientRect();
    const before = data.clientY < rect.top + rect.height / 2;
    moveCommandTo(sourcePath, path, before, containerPath, actions);
  });
}

export function ensureListDropHandlers(host: HTMLElement, actions: CommandListActions): void {
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
    data.stopPropagation();
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

// [P2] 이 컨테이너에 드롭해도 되는가: 같은 컨테이너는 항상 허용,
// 크로스는 호스트가 moveCommandAcross 를 지원하고 자기 분기 안이 아닐 때만.
function isDropAllowed(sourcePath: number[], containerPath: number[], actions: CommandListActions): boolean {
  if (sameContainer(sourcePath, containerPath)) return true;
  if (!actions.moveCommandAcross) return false;
  return !isContainerInsideCommand(sourcePath, containerPath);
}

function moveCommandTo(
  sourcePath: number[],
  targetPath: number[],
  before: boolean,
  containerPath: number[],
  actions: CommandListActions
): void {
  if (sourcePath.length === 0) return;
  if (!sameContainer(targetPath, containerPath)) return;
  const targetIdx = targetPath[targetPath.length - 1];
  if (targetIdx === undefined) return;
  if (sameContainer(sourcePath, containerPath)) {
    const sourceIdx = sourcePath[sourcePath.length - 1];
    if (sourceIdx === undefined) return;
    let destination = before ? targetIdx : targetIdx + 1;
    if (destination > sourceIdx) destination -= 1;
    actions.moveCommandTo(sourcePath, destination);
    return;
  }
  // [P2] 크로스 컨테이너 이동.
  if (!actions.moveCommandAcross) return;
  if (isContainerInsideCommand(sourcePath, containerPath)) return;
  actions.moveCommandAcross(sourcePath, containerPath, before ? targetIdx : targetIdx + 1);
}

function moveCommandToEnd(sourcePath: number[], containerPath: number[], actions: CommandListActions): void {
  if (sameContainer(sourcePath, containerPath)) {
    actions.moveCommandTo(sourcePath, Number.MAX_SAFE_INTEGER);
    return;
  }
  // [P2] 빈 리스트/리스트 말미로의 크로스 컨테이너 드롭.
  if (!actions.moveCommandAcross) return;
  if (isContainerInsideCommand(sourcePath, containerPath)) return;
  actions.moveCommandAcross(sourcePath, containerPath, Number.MAX_SAFE_INTEGER);
}
