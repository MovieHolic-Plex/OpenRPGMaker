import type { Project } from "@/project/types";
import { store } from "@/project/store";

const MAX_HISTORY = 50;

let undoStack: Project[] = [];
let redoStack: Project[] = [];

export function recordProjectSnapshot(): void {
  undoStack.push(structuredClone(store.getCurrent()));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
}

export function undoMapEdit(): boolean {
  const previous = undoStack.pop();
  if (!previous) return false;
  redoStack.push(structuredClone(store.getCurrent()));
  store.replace(previous);
  return true;
}

export function redoMapEdit(): boolean {
  const next = redoStack.pop();
  if (!next) return false;
  undoStack.push(structuredClone(store.getCurrent()));
  store.replace(next);
  return true;
}

export function resetMapEditHistory(): void {
  undoStack = [];
  redoStack = [];
}

export function getMapEditHistoryState(): { canUndo: boolean; canRedo: boolean } {
  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
