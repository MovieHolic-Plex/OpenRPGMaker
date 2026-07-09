import type { DatabaseCollection } from "@/editor/databaseActions";
import type { DatabaseRecords } from "@/project/types";

type RecordViewSessionState = {
  selectedIds: Partial<Record<DatabaseCollection, string>>;
  searchQueries: Partial<Record<DatabaseCollection, string>>;
  scrollTops: Partial<Record<DatabaseCollection, number>>;
};

let state = createRecordViewSessionState();

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
