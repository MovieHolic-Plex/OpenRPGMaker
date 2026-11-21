// 페이지 삭제는 명령 툴바 히스토리에 안 남는다. 그 히스토리는 페이지 안의 명령만 기억해서,
// 페이지를 지우면 편집기 되돌리기 버튼이 꺼진다.
// 여기서는 지운 순간의 페이지(세션 안에서 고친 트리거·조건·명령)를 편집기 되돌리기에만 넣는다.
// draft.original 은 열 때의 사건 그대로 둔다. 적용 뒤 맵 Ctrl+Z 는 그 세션 전 이벤트로 돌아간다.

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

/** 명령 편집과 페이지 삭제가 같은 순서를 쓴다. 되돌리기는 지금 후보의 순서를 비교한다. */
export function allocateEditorEditSeq(): number {
  return ++editSeq;
}

/** 명령 편집이 실제로 남으면, 그 사이에 있던 페이지 삭제 다시 실행은 더 이상 유효하지 않다. */
export function invalidatePageDeletionRedo(mapId: MapId, eventId: string): void {
  const history = histories.get(key(mapId, eventId));
  if (history) history.future.length = 0;
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

/** 페이지 삭제 후보가 지금 되돌릴 명령 편집보다 나중이면 페이지를 먼저 되돌린다. */
export function pageDeletionIsNewerThanCommands(mapId: MapId, eventId: string, commandUndoSeq = 0): boolean {
  const latest = histories.get(key(mapId, eventId))?.past.at(-1)?.seq ?? 0;
  return latest > commandUndoSeq;
}

export function pageDeletionRedoSeq(mapId: MapId, eventId: string): number {
  return histories.get(key(mapId, eventId))?.future.at(-1)?.seq ?? 0;
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

export function clearEventPageDeletionHistory(mapId: MapId, eventId: string): void {
  histories.delete(key(mapId, eventId));
}

/** @internal */
export function _resetEventPageDeletionHistoryForTest(): void {
  histories.clear();
  editSeq = 0;
}
