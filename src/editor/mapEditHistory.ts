import type { GameMap, MapId, Project } from "@/project/types";
import { mapWithCommittedEvents, projectWithoutEventDrafts } from "@/project/eventDrafts";
import { store } from "@/project/store";

const MAX_HISTORY = 50;
export const MAP_EDIT_HISTORY_EVENT = "rpgzzu:map-edit-history-change";

type ProjectSnapshot = {
  readonly kind: "project";
  readonly before: Project;
};

type MapSnapshot = {
  readonly kind: "map";
  readonly mapId: MapId;
  readonly before: GameMap;
  readonly beforeTilesets?: Project["tilesets"];
};

type HistorySnapshot = ProjectSnapshot | MapSnapshot;

type HistoryEntry = {
  readonly snapshot: HistorySnapshot;
  readonly label: string;
  readonly mapId: string | null;
  readonly at: number;
};

export type MapEditHistoryRecordOptions =
  | { readonly kind?: "project" }
  | { readonly kind: "map"; readonly mapId?: MapId; readonly includeTilesets?: boolean };

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

function snapshotSignature(snapshot: HistorySnapshot): string {
  // JSON 직렬화 가능한 Project 이므로 값 동등성 비교로 충분하다.
  // (연속 스냅샷의 top 하나와만 비교 → false negative 는 dedup 미적용일 뿐 무해)
  return JSON.stringify(snapshot);
}

function historyTopSignature(): string | null {
  const top = undoStack[undoStack.length - 1];
  return top ? snapshotSignature(top.snapshot) : null;
}

function normalizedLabel(label: string | undefined): string {
  const trimmed = label?.trim();
  return trimmed ? trimmed : "편집";
}

function makeEntry(snapshot: HistorySnapshot, label: string | undefined, mapId: string | null | undefined): HistoryEntry {
  return {
    snapshot,
    label: normalizedLabel(label),
    mapId: mapId ?? null,
    at: seq++,
  };
}

function makeSnapshotFromCurrent(mapId: string | null | undefined, options?: MapEditHistoryRecordOptions): HistorySnapshot {
  const current = store.getCurrent();
  if (options?.kind === "map") {
    const snapshotMapId = options.mapId ?? mapId;
    const map = snapshotMapId ? current.maps[snapshotMapId] : undefined;
    if (map && snapshotMapId) {
      return {
        kind: "map",
        mapId: snapshotMapId,
        before: mapWithCommittedEvents(map),
        ...(options.includeTilesets ? { beforeTilesets: structuredClone(current.tilesets) } : {}),
      };
    }
  }
  return { kind: "project", before: projectWithoutEventDrafts(current) };
}

function historyMapId(mapId: string | null | undefined, options?: MapEditHistoryRecordOptions): string | null | undefined {
  return options?.kind === "map" ? (options.mapId ?? mapId) : mapId;
}

function makeCurrentSnapshotForEntry(entry: HistoryEntry): HistorySnapshot | null {
  const current = store.getCurrent();
  if (entry.snapshot.kind === "map") {
    const map = current.maps[entry.snapshot.mapId];
    return map
      ? {
        kind: "map",
        mapId: entry.snapshot.mapId,
        before: mapWithCommittedEvents(map),
        ...(entry.snapshot.beforeTilesets ? { beforeTilesets: structuredClone(current.tilesets) } : {}),
      }
      : null;
  }
  return { kind: "project", before: projectWithoutEventDrafts(current) };
}

function applySnapshotToProject(base: Project, snapshot: HistorySnapshot): Project {
  if (snapshot.kind === "project") return structuredClone(snapshot.before);
  const next = structuredClone(base);
  next.maps[snapshot.mapId] = structuredClone(snapshot.before);
  if (snapshot.beforeTilesets) next.tilesets = structuredClone(snapshot.beforeTilesets);
  return next;
}

function replaceWithSnapshot(snapshot: HistorySnapshot): void {
  store.replace(applySnapshotToProject(store.getCurrent(), snapshot));
}

/**
 * 스냅샷을 undo 스택에 밀어넣는다. 직전 스냅샷과 상태가 동일하면(직렬화 일치)
 * 불필요한 메모리 증가를 막기 위해 push 하지 않는다.
 */
function pushSnapshot(snapshot: HistorySnapshot, label?: string, mapId?: string | null): void {
  const signature = snapshotSignature(snapshot);
  if (undoStack.length > 0 && signature === topSignature) return;
  undoStack.push(makeEntry(snapshot, label, mapId));
  topSignature = signature;
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  emitHistoryChange();
}

/** 이산적(단발) 편집 직전에 호출: 현재 상태를 즉시 스냅샷한다. */
export function recordProjectSnapshot(label?: string, mapId?: string | null, options?: MapEditHistoryRecordOptions): void {
  lastCoalesceKey = null;
  pushSnapshot(makeSnapshotFromCurrent(mapId, options), label, historyMapId(mapId, options));
}

/**
 * 텍스트/숫자 입력 스트림처럼 keystroke 마다 호출되는 편집 직전에 사용.
 * 같은 key 가 연속으로 들어오는 동안에는 최초 1회(편집 시작 직전 상태)만 스냅샷하고
 * 이후는 무시한다. 다른 필드/이산 편집이 끼어들면 key 가 바뀌어 다시 스냅샷된다.
 */
export function recordCoalescedSnapshot(
  key: string,
  label?: string,
  mapId?: string | null,
  options?: MapEditHistoryRecordOptions
): void {
  if (lastCoalesceKey === key) return;
  lastCoalesceKey = key;
  pushSnapshot(makeSnapshotFromCurrent(mapId, options), label, historyMapId(mapId, options));
}

export function undoMapEdit(): boolean {
  const previous = undoStack.pop();
  if (!previous) return false;
  const currentSnapshot = makeCurrentSnapshotForEntry(previous);
  if (!currentSnapshot) {
    undoStack.push(previous);
    return false;
  }
  redoStack.push(makeEntry(currentSnapshot, previous.label, previous.mapId));
  topSignature = historyTopSignature();
  lastCoalesceKey = null;
  replaceWithSnapshot(previous.snapshot);
  emitHistoryChange();
  return true;
}

export function redoMapEdit(): boolean {
  const next = redoStack.pop();
  if (!next) return false;
  const currentSnapshot = makeCurrentSnapshotForEntry(next);
  if (!currentSnapshot) {
    redoStack.push(next);
    return false;
  }
  pushSnapshotForRedo(makeEntry(currentSnapshot, next.label, next.mapId));
  lastCoalesceKey = null;
  replaceWithSnapshot(next.snapshot);
  emitHistoryChange();
  return true;
}

// redo 시에는 현재 상태를 undo 스택으로 되돌려야 하며, dedup 으로 삼켜지면
// 다시 undo 할 대상이 사라지므로 무조건 push 한다.
function pushSnapshotForRedo(entry: HistoryEntry): void {
  undoStack.push(entry);
  topSignature = snapshotSignature(entry.snapshot);
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
  if (normalizedSteps > undoStack.length) return null;
  let project = structuredClone(store.getCurrent());
  for (let offset = 1; offset <= normalizedSteps; offset += 1) {
    const entry = undoStack[undoStack.length - offset];
    if (!entry) return null;
    project = applySnapshotToProject(project, entry.snapshot);
  }
  return project;
}

export function revertToHistoryIndex(index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= undoStack.length) return false;
  const target = undoStack[index];
  let project = structuredClone(store.getCurrent());
  for (let cursor = undoStack.length - 1; cursor >= index; cursor -= 1) {
    project = applySnapshotToProject(project, undoStack[cursor].snapshot);
  }
  redoStack.push(makeEntry({ kind: "project", before: projectWithoutEventDrafts(store.getCurrent()) }, target.label, target.mapId));
  undoStack = undoStack.slice(0, index);
  topSignature = historyTopSignature();
  lastCoalesceKey = null;
  store.replace(project);
  emitHistoryChange();
  return true;
}

export function getMapEditHistoryDebugEntries(): readonly {
  readonly kind: HistorySnapshot["kind"];
  readonly mapId: string | null;
  readonly serializedLength: number;
}[] {
  return undoStack.map((entry) => ({
    kind: entry.snapshot.kind,
    mapId: entry.mapId,
    serializedLength: JSON.stringify(entry.snapshot.before).length,
  }));
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
