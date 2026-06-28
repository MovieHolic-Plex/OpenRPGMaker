import type { CommandListActions } from "./types";

const DRAG_MIME = "application/x-rpgzzu-event-command-path";

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

export function attachItemDropHandlers(
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

function moveCommandTo(
  sourcePath: number[],
  targetPath: number[],
  before: boolean,
  containerPath: number[],
  actions: CommandListActions
): void {
  if (sourcePath.length === 0) return;
  if (!sameContainer(sourcePath, containerPath)) return;
  if (!sameContainer(targetPath, containerPath)) return;
  const sourceIdx = sourcePath[sourcePath.length - 1];
  const targetIdx = targetPath[targetPath.length - 1];
  let destination = before ? targetIdx : targetIdx + 1;
  if (destination > sourceIdx) destination -= 1;
  actions.moveCommandTo(sourcePath, destination);
}

function moveCommandToEnd(sourcePath: number[], containerPath: number[], actions: CommandListActions): void {
  if (!sameContainer(sourcePath, containerPath)) return;
  actions.moveCommandTo(sourcePath, Number.MAX_SAFE_INTEGER);
}
