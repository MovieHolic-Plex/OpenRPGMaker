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
function isLargeHistorySnapshot(snapshot: HistorySnapshot): boolean {
  if (snapshot.kind === "map") {
    return (snapshot.before.width * snapshot.before.height) >= 10000;
  }
  const project = snapshot.before;
  const mapCount = Object.keys(project.maps ?? {}).length;
  if (mapCount === 0) return false;
  const sample = Object.values(project.maps)[0] as GameMap | undefined;
  if (!sample) return false;
  return (sample.width * sample.height) >= 10000 || mapCount > 12;
}

function pushSnapshot(snapshot: HistorySnapshot, label?: string, mapId?: string | null): void {
  const signature = snapshotSignature(snapshot);
  if (undoStack.length > 0 && signature === topSignature) return;
  undoStack.push(makeEntry(snapshot, label, mapId));
  topSignature = signature;
  const effectiveMax = isLargeHistorySnapshot(snapshot) ? Math.min(MAX_HISTORY, 25) : MAX_HISTORY;
  while (undoStack.length > effectiveMax) undoStack.shift();
  redoStack = [];
  emitHistoryChange();
}

function pushSnapshotForRedo(entry: HistoryEntry): void {
  undoStack.push(entry);
  topSignature = snapshotSignature(entry.snapshot);
  const effectiveMax = isLargeHistorySnapshot(entry.snapshot) ? Math.min(MAX_HISTORY, 25) : MAX_HISTORY;
  while (undoStack.length > effectiveMax) undoStack.shift();
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
/**
 * 현재 시점의 히스토리 마커 — 세션 시작 시점 기록용(databaseModalDirtySession).
 * 이후 makeEntry 로 생성되는 모든 엔트리는 이 값 이상의 `at` 시퀀스를 받는다.
 * 깊이(길이) 대신 단조 증가 시퀀스를 기준으로 삼는 이유: undoStack.length 는
 * MAX_HISTORY 포화 상태에서 세션 중 push 가 shift 로 상쇄돼 그대로 유지될 수 있어
 * 깊이 기준 절단이 무동작이 되는 경우가 있다(폐기 편집의 Ctrl+Z 부활 재현).
 */
export function getMapEditHistoryMarker(): number {
  return seq;
}

/**
 * marker 시점 이후(= at >= marker)에 생성된 undo 엔트리를 전부 제거하고 redo 스택을
 * 비운다. 모달류 편집 세션의 discard(열 때 상태로 복원)가 세션 중 쌓인 스냅샷을
 * 폐기해, 폐기한 변경이 이후 Ctrl+Z 로 되살아나는 것을 막는다. 시퀀스 기반이라
 * MAX_HISTORY shift 로 배열 길이가 상쇄되어도 세션 이전 엔트리만 정확히 보존된다.
 */
export function truncateMapEditHistoryFromMarker(marker: number): void {
  undoStack = undoStack.filter((entry) => entry.at < marker);
  redoStack = [];
  topSignature = historyTopSignature();
  lastCoalesceKey = null;
  emitHistoryChange();
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

/**
 * 다음 undo/redo 가 처리할 항목의 라벨. 스택이 비어 있으면 null.
 *
 * 실행 **전에** 읽어야 한다 — undoMapEdit() 이 스택을 pop 한 뒤에는 무엇을 되돌렸는지
 * 알 수 없다. 되돌림 피드백에 "무엇을" 을 담기 위한 조회기다(라벨 없는 "되돌렸습니다" 는
 * 감독이 방금 뭐가 사라졌는지 못 알아본다).
 */
export function pendingHistoryLabels(): { readonly undo: string | null; readonly redo: string | null } {
  return {
    undo: undoStack.length > 0 ? undoStack[undoStack.length - 1]!.label : null,
    redo: redoStack.length > 0 ? redoStack[redoStack.length - 1]!.label : null,
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
