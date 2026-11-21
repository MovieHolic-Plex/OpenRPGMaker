// 페이지 삭제는 명령 툴바 히스토리에 안 남는다. 그 히스토리는 페이지 안의 명령만 기억해서,
// 페이지를 지우면 되돌리기 버튼이 꺼지고, 적용 뒤 맵 Ctrl+Z 는 열 때의 draft.original
// (트리거 auto · 명령 0개짜리 껍데기)만 되살렸다.
// 여기서는 지운 페이지 전체(트리거·조건·명령)를 편집기 되돌리기에 넣고,
// 적용 직전 그 사본을 draft.original 에 봉해서 맵 되돌리기도 같은 본문을 복원하게 한다.

import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import type { EventPage, MapId } from "@/project/types";

type DeletedPage = {
  readonly seq: number;
  readonly page: EventPage;
  readonly index: number;
  readonly selectedPageId: string | null;
};

type PageDeletionHistory = {
  past: DeletedPage[];
  future: DeletedPage[];
};

const HISTORY_LIMIT = 50;
const histories = new Map<string, PageDeletionHistory>();
let editSeq = 0;
let lastCommandSeq = 0;

function key(mapId: MapId, eventId: string): string {
  return `${mapId}:${eventId}`;
}

function historyFor(id: string): PageDeletionHistory {
  const existing = histories.get(id);
  if (existing) return existing;
  const created: PageDeletionHistory = { past: [], future: [] };
  histories.set(id, created);
  return created;
}

/** 명령 툴바 편집이 실제로 남았을 때. 그 뒤에 한 페이지 삭제가 더 최근이면 페이지를 먼저 되돌린다. */
export function noteCommandToolbarEdit(): void {
  lastCommandSeq = ++editSeq;
}

export function recordEventPageDeletion(
  mapId: MapId,
  eventId: string,
  snapshot: { readonly page: EventPage; readonly index: number; readonly selectedPageId: string | null },
): void {
  const history = historyFor(key(mapId, eventId));
  history.past.push({
    seq: ++editSeq,
    page: structuredClone(snapshot.page),
    index: snapshot.index,
    selectedPageId: snapshot.selectedPageId,
  });
  if (history.past.length > HISTORY_LIMIT) history.past.shift();
  history.future.length = 0;
}

export function canUndoEventPageDeletion(mapId: MapId, eventId: string): boolean {
  return (histories.get(key(mapId, eventId))?.past.length ?? 0) > 0;
}

export function canRedoEventPageDeletion(mapId: MapId, eventId: string): boolean {
  return (histories.get(key(mapId, eventId))?.future.length ?? 0) > 0;
}

/** 가장 최근 편집이 페이지 삭제이면 명령 되돌리기보다 앞선다. */
export function pageDeletionIsNewerThanCommands(mapId: MapId, eventId: string): boolean {
  const latest = histories.get(key(mapId, eventId))?.past.at(-1)?.seq ?? 0;
  return latest > lastCommandSeq;
}

export function undoEventPageDeletion(mapId: MapId, eventId: string): boolean {
  const history = histories.get(key(mapId, eventId));
  const entry = history?.past.at(-1);
  if (!history || !entry) return false;
  const current = store.getCurrent().maps[mapId]?.events.find((event) => event.id === eventId);
  if (!current?.pages || current.pages.some((page) => page.id === entry.page.id)) return false;
  let restored = false;
  store.updateEvent(mapId, eventId, (event) => {
    const pages = [...(event.pages ?? [])];
    if (pages.some((page) => page.id === entry.page.id)) return;
    const index = Math.max(0, Math.min(entry.index, pages.length));
    pages.splice(index, 0, structuredClone(entry.page));
    event.pages = pages;
    restored = true;
  }, { scope: "map", mapId, eventId, label: `페이지 복원: ${entry.page.name}` });
  if (!restored) return false;
  history.past.pop();
  history.future.push(entry);
  editorState.set({ selectedEventPageId: entry.page.id });
  return true;
}

export function redoEventPageDeletion(mapId: MapId, eventId: string): boolean {
  const history = histories.get(key(mapId, eventId));
  const entry = history?.future.at(-1);
  if (!history || !entry) return false;
  let removed = false;
  store.updateEvent(mapId, eventId, (event) => {
    if (!event.pages || event.pages.length <= 1) return;
    if (!event.pages.some((page) => page.id === entry.page.id)) return;
    event.pages = event.pages.filter((page) => page.id !== entry.page.id);
    removed = true;
  }, { scope: "map", mapId, eventId, label: `페이지 삭제: ${entry.page.name}` });
  if (!removed) return false;
  history.future.pop();
  history.past.push(entry);
  const pages = store.getCurrent().maps[mapId]?.events.find((event) => event.id === eventId)?.pages ?? [];
  const nextIndex = Math.min(entry.index, Math.max(0, pages.length - 1));
  editorState.set({ selectedEventPageId: pages[nextIndex]?.id ?? entry.selectedPageId });
  return true;
}

/**
 * 적용 스냅샷은 draft.original 이다. 이 세션에서 고친 뒤 지운 페이지를 그 원본에 넣어 두지 않으면
 * 맵 Ctrl+Z 가 열 때의 빈 페이지(트리거 auto, 명령 없음)를 되살린다.
 */
export function sealDeletedPagesIntoDraft(mapId: MapId, eventId: string): void {
  const entries = histories.get(key(mapId, eventId))?.past ?? [];
  if (entries.length === 0) return;
  store.updateEvent(mapId, eventId, (event) => {
    if (event.draft?.kind !== "edit" || !event.draft.original) return;
    const pages = [...(event.draft.original.pages ?? [])];
    const present = entries.filter((entry) => pages.some((page) => page.id === entry.page.id));
    const missing = entries
      .filter((entry) => !pages.some((page) => page.id === entry.page.id))
      .slice()
      .sort((a, b) => a.index - b.index);
    for (const entry of present) {
      const index = pages.findIndex((page) => page.id === entry.page.id);
      if (index >= 0) pages[index] = structuredClone(entry.page);
    }
    for (const entry of missing) {
      const index = Math.max(0, Math.min(entry.index, pages.length));
      pages.splice(index, 0, structuredClone(entry.page));
    }
    event.draft.original.pages = pages;
  }, {
    scope: "map",
    mapId,
    eventId,
    origin: "system",
    label: "페이지 삭제 기준 보관",
  });
}

export function clearEventPageDeletionHistory(mapId: MapId, eventId: string): void {
  histories.delete(key(mapId, eventId));
}

/** @internal */
export function _resetEventPageDeletionHistoryForTest(): void {
  histories.clear();
  editSeq = 0;
  lastCommandSeq = 0;
}
