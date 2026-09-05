import type { DatabaseCollection } from "@/editor/databaseActions";
import type { DatabaseRecords } from "@/project/types";

type RecordViewSessionState = {
  selectedIds: Partial<Record<DatabaseCollection, string>>;
  searchQueries: Partial<Record<DatabaseCollection, string>>;
  scrollTops: Partial<Record<DatabaseCollection, number>>;
};

export type RecordViewMode = "gallery" | "list";

// 갤러리/목록 토글 지원 컬렉션 — 아이콘 보유 컬렉션 9종으로 DatabaseCollection 키 전체와
// 일치한다. 기본 뷰는 목록(이름이 잘리지 않는 마스터-디테일 행)이고 갤러리는 옵트인.
// monsterSpecies는 DatabaseCollection이 아니며 별도 렌더 경로(renderMonsterSpeciesTab)를
// 쓰므로 여기 포함되지 않는다(후속 갤러리 확장 후보로만 기록).
const VIEW_TOGGLE_COLLECTIONS: readonly DatabaseCollection[] = [
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

const VIEW_MODE_STORAGE_KEY = "oprn:database.viewMode";
const CATEGORY_FILTER_STORAGE_KEY = "oprn:database.categoryFilter";

// 카테고리 필터 칩이 적용되는 컬렉션 — 아이템/장비만. 배우/스킬/스위치 등 나머지
// 컬렉션은 칩이 없으므로 필터 상태를 갖지 않는다.
const FILTERABLE_COLLECTIONS: readonly DatabaseCollection[] = ["items", "equipment"];

let state = createRecordViewSessionState();
const detailSections = new Map<string, string>();
const previewPauseStates = new Map<string, boolean>();

export function recordPreviewPaused(recordId: string): boolean | undefined {
  return previewPauseStates.get(recordId);
}

export function setRecordPreviewPaused(recordId: string, paused: boolean): void {
  previewPauseStates.set(recordId, paused);
}

export function recordDetailSection(recordId: string): string {
  return detailSections.get(recordId) ?? "basic";
}

export function setRecordDetailSection(recordId: string, section: string): void {
  detailSections.set(recordId, section);
}

// 컬렉션별 뷰 모드(갤러리/리스트)는 세션 리셋을 가로질러 생존한다 — localStorage
// (oprn:database.viewMode)에 JSON 맵으로 지속되며 resetRecordViewSessionState는 이
// 상태를 건드리지 않는다(플랜: 세션 리셋 계약 불변, 뷰 모드는 사용자 선택이라 리셋 후 유지).
let viewModes: Partial<Record<DatabaseCollection, RecordViewMode>> = readStoredViewModes();

// 카테고리 필터 칩(아이템 종류/장비 부위) — 뷰 모드와 같은 규칙으로 localStorage
// (oprn:database.categoryFilter)에 JSON 맵으로 지속되며, resetRecordViewSessionState는
// 이 상태를 건드리지 않는다(사용자 선택이라 세션 리셋 후에도 유지).
// 'all'이 기본값이며 항목이 없으면 'all'로 읽힌다. 아이템/장비 외 컬렉션은 저장하지 않는다.
let categoryFilters: Partial<Record<DatabaseCollection, string>> = readStoredCategoryFilters();

export function resetRecordViewSessionState(): void {
  state = createRecordViewSessionState();
  detailSections.clear();
  previewPauseStates.clear();
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
  // 기본 뷰는 목록 — 갤러리는 사용자가 토글로 옵트인한다(선택은 localStorage 지속).
  return "list";
}

export function setViewModeForCollection(collection: DatabaseCollection, mode: RecordViewMode): void {
  // 비레코드 탭(스위치/변수/용어 등)은 뷰 모드 상태를 저장하지 않는다.
  if (!VIEW_TOGGLE_COLLECTIONS.includes(collection)) return;
  viewModes[collection] = mode;
  persistViewModes();
}

export function categoryFilterForCollection(collection: DatabaseCollection): string {
  return categoryFilters[collection] ?? "all";
}

export function setCategoryFilterForCollection(collection: DatabaseCollection, filter: string): void {
  if (!FILTERABLE_COLLECTIONS.includes(collection)) return;
  if (filter === "all") {
    delete categoryFilters[collection];
  } else {
    categoryFilters[collection] = filter;
  }
  persistCategoryFilters();
}

function createDefaultViewModes(): Partial<Record<DatabaseCollection, RecordViewMode>> {
  const modes: Partial<Record<DatabaseCollection, RecordViewMode>> = {};
  for (const collection of VIEW_TOGGLE_COLLECTIONS) modes[collection] = "list";
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
    for (const collection of VIEW_TOGGLE_COLLECTIONS) {
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

function readStoredCategoryFilters(): Partial<Record<DatabaseCollection, string>> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(CATEGORY_FILTER_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    // 손상/형식 오류 값은 기본값(빈 맵 = 전부 'all')으로 폴백한다. 유효한 JSON이어도
    // 객체가 아니거나 아이템/장비 키가 아니면 무시한다.
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const merged: Partial<Record<DatabaseCollection, string>> = {};
    for (const collection of FILTERABLE_COLLECTIONS) {
      const value = (parsed as Record<string, unknown>)[collection];
      if (typeof value === "string" && value) merged[collection] = value;
    }
    return merged;
  } catch {
    return {};
  }
}

function persistCategoryFilters(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CATEGORY_FILTER_STORAGE_KEY, JSON.stringify(categoryFilters));
}
