import type { Project } from "@/project/types";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { store } from "@/project/store";

const MAX_HISTORY = 50;
export const MAP_EDIT_HISTORY_EVENT = "rpgzzu:map-edit-history-change";

let undoStack: Project[] = [];
let redoStack: Project[] = [];
let historyEventQueued = false;

export function recordProjectSnapshot(): void {
  undoStack.push(projectWithoutEventDrafts(store.getCurrent()));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  emitHistoryChange();
}

export function undoMapEdit(): boolean {
  const previous = undoStack.pop();
  if (!previous) return false;
  redoStack.push(structuredClone(store.getCurrent()));
  store.replace(previous);
  emitHistoryChange();
  return true;
}

export function redoMapEdit(): boolean {
  const next = redoStack.pop();
  if (!next) return false;
  undoStack.push(structuredClone(store.getCurrent()));
  store.replace(next);
  emitHistoryChange();
  return true;
}

export function resetMapEditHistory(): void {
  undoStack = [];
  redoStack = [];
  emitHistoryChange();
}

export function getMapEditHistoryState(): { canUndo: boolean; canRedo: boolean } {
  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}

function emitHistoryChange(): void {
  if (typeof window === "undefined" || historyEventQueued) return;
  historyEventQueued = true;
  window.queueMicrotask(() => {
    historyEventQueued = false;
    window.dispatchEvent(new CustomEvent(MAP_EDIT_HISTORY_EVENT));
  });
}
