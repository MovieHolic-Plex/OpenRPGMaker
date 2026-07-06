import type { Project } from "@/project/types";
import { projectWithoutEventDrafts } from "@/project/eventDrafts";
import { store } from "@/project/store";

const MAX_HISTORY = 50;
export const MAP_EDIT_HISTORY_EVENT = "rpgzzu:map-edit-history-change";

type HistoryEntry = {
  readonly project: Project;
  readonly label: string;
  readonly mapId: string | null;
  readonly at: number;
};

export type MapEditHistoryEntry = {
  readonly index: number;
  readonly label: string;
  readonly mapId: string | null;
  readonly at: number;
  readonly current: boolean;
};

let undoStack: HistoryEntry[] = [];
let redoStack: HistoryEntry[] = [];
let historyEventQueued = false;
let seq = 0;
// 마지막으로 스냅샷을 밀어넣은 undo 스택 top 의 직렬화 서명(연속 중복 스냅샷 dedup 용).
let topSignature: string | null = null;
// 텍스트 입력처럼 커밋 단위로 1 스냅샷만 남기기 위한 병합 키.
// 같은 키가 연속으로 들어오면(같은 필드를 계속 타이핑) 스냅샷을 추가하지 않는다.
let lastCoalesceKey: string | null = null;

function snapshotSignature(project: Project): string {
  // JSON 직렬화 가능한 Project 이므로 값 동등성 비교로 충분하다.
  // (연속 스냅샷의 top 하나와만 비교 → false negative 는 dedup 미적용일 뿐 무해)
  return JSON.stringify(project);
}

function historyTopSignature(): string | null {
  const top = undoStack[undoStack.length - 1];
  return top ? snapshotSignature(top.project) : null;
}

function normalizedLabel(label: string | undefined): string {
  const trimmed = label?.trim();
  return trimmed ? trimmed : "편집";
}

function makeEntry(project: Project, label: string | undefined, mapId: string | null | undefined): HistoryEntry {
  return {
    project,
    label: normalizedLabel(label),
    mapId: mapId ?? null,
    at: seq++,
  };
}

/**
 * 스냅샷을 undo 스택에 밀어넣는다. 직전 스냅샷과 상태가 동일하면(직렬화 일치)
 * 불필요한 메모리 증가를 막기 위해 push 하지 않는다.
 */
function pushSnapshot(snapshot: Project, label?: string, mapId?: string | null): void {
  const signature = snapshotSignature(snapshot);
  if (undoStack.length > 0 && signature === topSignature) return;
  undoStack.push(makeEntry(snapshot, label, mapId));
  topSignature = signature;
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  emitHistoryChange();
}

/** 이산적(단발) 편집 직전에 호출: 현재 상태를 즉시 스냅샷한다. */
export function recordProjectSnapshot(label?: string, mapId?: string | null): void {
  lastCoalesceKey = null;
  pushSnapshot(projectWithoutEventDrafts(store.getCurrent()), label, mapId);
}

/**
 * 텍스트/숫자 입력 스트림처럼 keystroke 마다 호출되는 편집 직전에 사용.
 * 같은 key 가 연속으로 들어오는 동안에는 최초 1회(편집 시작 직전 상태)만 스냅샷하고
 * 이후는 무시한다. 다른 필드/이산 편집이 끼어들면 key 가 바뀌어 다시 스냅샷된다.
 */
export function recordCoalescedSnapshot(key: string, label?: string, mapId?: string | null): void {
  if (lastCoalesceKey === key) return;
  lastCoalesceKey = key;
  pushSnapshot(projectWithoutEventDrafts(store.getCurrent()), label, mapId);
}

export function undoMapEdit(): boolean {
  const previous = undoStack.pop();
  if (!previous) return false;
  redoStack.push(makeEntry(projectWithoutEventDrafts(store.getCurrent()), previous.label, previous.mapId));
  topSignature = historyTopSignature();
  lastCoalesceKey = null;
  store.replace(structuredClone(previous.project));
  emitHistoryChange();
  return true;
}

export function redoMapEdit(): boolean {
  const next = redoStack.pop();
  if (!next) return false;
  pushSnapshotForRedo(makeEntry(projectWithoutEventDrafts(store.getCurrent()), next.label, next.mapId));
  lastCoalesceKey = null;
  store.replace(structuredClone(next.project));
  emitHistoryChange();
  return true;
}

// redo 시에는 현재 상태를 undo 스택으로 되돌려야 하며, dedup 으로 삼켜지면
// 다시 undo 할 대상이 사라지므로 무조건 push 한다.
function pushSnapshotForRedo(entry: HistoryEntry): void {
  undoStack.push(entry);
  topSignature = snapshotSignature(entry.project);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
}

export function resetMapEditHistory(): void {
  undoStack = [];
  redoStack = [];
  topSignature = null;
  lastCoalesceKey = null;
  seq = 0;
  emitHistoryChange();
}

export function getMapEditHistoryState(): { canUndo: boolean; canRedo: boolean } {
  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}

export function getMapEditHistoryEntries(): readonly MapEditHistoryEntry[] {
  return undoStack
    .map((entry, index) => ({
      index,
      label: entry.label,
      mapId: entry.mapId,
      at: entry.at,
      current: redoStack.length === 0 && index === undoStack.length - 1,
    }))
    .reverse();
}

export function peekPreviousProject(steps = 1): Project | null {
  const normalizedSteps = Number.isFinite(steps) ? Math.max(1, Math.trunc(steps)) : 1;
  const entry = undoStack[undoStack.length - normalizedSteps];
  return entry ? structuredClone(entry.project) : null;
}

export function revertToHistoryIndex(index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= undoStack.length) return false;
  const target = undoStack[index];
  redoStack.push(makeEntry(projectWithoutEventDrafts(store.getCurrent()), target.label, target.mapId));
  undoStack = undoStack.slice(0, index);
  topSignature = historyTopSignature();
  lastCoalesceKey = null;
  store.replace(structuredClone(target.project));
  emitHistoryChange();
  return true;
}

function emitHistoryChange(): void {
  if (typeof window === "undefined" || historyEventQueued) return;
  // 히스토리 변경 이벤트는 UI 툴바 갱신용 알림일 뿐이다. 테스트/비브라우저 스텁처럼
  // 스케줄링/디스패치 API 가 없으면 조용히 건너뛴다(실제 브라우저에는 항상 존재).
  if (
    typeof window.queueMicrotask !== "function" ||
    typeof window.dispatchEvent !== "function" ||
    typeof CustomEvent === "undefined"
  ) {
    return;
  }
  historyEventQueued = true;
  window.queueMicrotask(() => {
    historyEventQueued = false;
    window.dispatchEvent(new CustomEvent(MAP_EDIT_HISTORY_EVENT));
  });
}
