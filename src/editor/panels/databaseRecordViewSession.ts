import type { DatabaseCollection } from "@/editor/databaseActions";
import type { DatabaseRecords } from "@/project/types";

type RecordViewSessionState = {
  selectedIds: Partial<Record<DatabaseCollection, string>>;
  searchQueries: Partial<Record<DatabaseCollection, string>>;
  scrollTops: Partial<Record<DatabaseCollection, number>>;
};

export type RecordViewMode = "gallery" | "list";

// 갤러리 기본값 컬렉션 — 아이콘 보유 컬렉션 9종으로 DatabaseCollection 키 전체와 일치한다.
// monsterSpecies는 DatabaseCollection이 아니며 별도 렌더 경로(renderMonsterSpeciesTab)를
// 쓰므로 여기 포함되지 않는다(후속 갤러리 확장 후보로만 기록).
const GALLERY_DEFAULT_COLLECTIONS: readonly DatabaseCollection[] = [
  "actors",
  "classes",
  "skills",
  "items",
  "equipment",
  "enemies",
  "troops",
  "states",
  "battleAnimations",
];

const VIEW_MODE_STORAGE_KEY = "rpg-zzu.database.viewMode";

let state = createRecordViewSessionState();

// 컬렉션별 뷰 모드(갤러리/리스트)는 세션 리셋을 가로질러 생존한다 — localStorage
// (rpg-zzu.database.viewMode)에 JSON 맵으로 지속되며 resetRecordViewSessionState는 이
// 상태를 건드리지 않는다(플랜: 세션 리셋 계약 불변, 뷰 모드는 사용자 선택이라 리셋 후 유지).
let viewModes: Partial<Record<DatabaseCollection, RecordViewMode>> = readStoredViewModes();

export function resetRecordViewSessionState(): void {
  state = createRecordViewSessionState();
}

export function selectedRecordForSession(
  collection: DatabaseCollection,
  records: DatabaseRecords[DatabaseCollection]
): DatabaseRecords[DatabaseCollection][number] | undefined {
  const selected = state.selectedIds[collection];
  const record = records.find((entry) => entry.id === selected) ?? records[0];
  setSelectedRecordId(collection, record?.id);
  return record;
}

export function selectedRecordIdForSession(collection: DatabaseCollection): string | undefined {
  return state.selectedIds[collection];
}

export function setSelectedRecordId(collection: DatabaseCollection, id: string | undefined): void {
  if (id) {
    state.selectedIds[collection] = id;
    return;
  }
  delete state.selectedIds[collection];
}

export function searchQueryForCollection(collection: DatabaseCollection): string {
  return state.searchQueries[collection] ?? "";
}

export function setSearchQueryForCollection(collection: DatabaseCollection, query: string): void {
  if (query) {
    state.searchQueries[collection] = query;
    return;
  }
  delete state.searchQueries[collection];
}

export function listScrollTopForCollection(collection: DatabaseCollection): number {
  return state.scrollTops[collection] ?? 0;
}

export function setListScrollTopForCollection(collection: DatabaseCollection, scrollTop: number): void {
  if (scrollTop > 0) {
    state.scrollTops[collection] = scrollTop;
    return;
  }
  delete state.scrollTops[collection];
}

function createRecordViewSessionState(): RecordViewSessionState {
  return { searchQueries: {}, selectedIds: {}, scrollTops: {} };
}

export function viewModeForCollection(collection: DatabaseCollection): RecordViewMode {
  const mode = viewModes[collection];
  if (mode === "gallery" || mode === "list") return mode;
  // 갤러리 기본 컬렉션이 아닌 탭은 뷰 모드 상태를 갖지 않는다 — 항상 리스트.
  return GALLERY_DEFAULT_COLLECTIONS.includes(collection) ? "gallery" : "list";
}

export function setViewModeForCollection(collection: DatabaseCollection, mode: RecordViewMode): void {
  // 비레코드 탭(스위치/변수/용어 등)은 뷰 모드 상태를 저장하지 않는다.
  if (!GALLERY_DEFAULT_COLLECTIONS.includes(collection)) return;
  viewModes[collection] = mode;
  persistViewModes();
}

function createDefaultViewModes(): Partial<Record<DatabaseCollection, RecordViewMode>> {
  const modes: Partial<Record<DatabaseCollection, RecordViewMode>> = {};
  for (const collection of GALLERY_DEFAULT_COLLECTIONS) modes[collection] = "gallery";
  return modes;
}

function readStoredViewModes(): Partial<Record<DatabaseCollection, RecordViewMode>> {
  const defaults = createDefaultViewModes();
  if (typeof window === "undefined") return defaults;
  const raw = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  if (!raw) return defaults;
  try {
    const parsed: unknown = JSON.parse(raw);
    // 손상/형식 오류 값은 기본값으로 폴백한다. 유효한 JSON이어도 객체가 아니거나
    // 컬렉션 키가 아니면 무시하고 기본값을 유지한다.
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return defaults;
    const merged = { ...defaults };
    for (const collection of GALLERY_DEFAULT_COLLECTIONS) {
      const mode = (parsed as Record<string, unknown>)[collection];
      if (mode === "gallery" || mode === "list") merged[collection] = mode;
    }
    return merged;
  } catch {
    return defaults;
  }
}

function persistViewModes(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, JSON.stringify(viewModes));
}
