// 이벤트 페이지 탭을 끌어 순서를 바꾼다.
//
// 왜 모듈 상태로 소스를 들고 있나: dragover 시점에 dataTransfer.getData 를 읽지 못하는
// 브라우저가 있다(맵 트리와 같은 함정). 드롭 유효성도 이 값을 본다.
//
// text/uri-list 나 URL 모양 text/plain 은 넣지 않는다. 브라우저 크롬(주소창·탭 줄)에
// 떨어뜨리면 탐색이 되어, 페이지 복제/탭 글자를 끌 때 보이던 「브라우즈」와 같은 누수다.
import { moveEventPageTo } from "@/editor/eventPages";
import { toast } from "@/util/toast";
import type { EventPage, MapId } from "@/project/types";

const PAGE_DRAG_MIME = "application/x-oprn-event-page-id";
let draggingPageId: string | null = null;

export type PageTabDragRequest = {
  readonly mapId: MapId;
  readonly eventId: string;
  readonly page: EventPage;
  readonly canDrag: boolean;
};

export type PageTabDropRequest = {
  readonly mapId: MapId;
  readonly eventId: string;
  readonly pageId: string;
  readonly pages: readonly EventPage[];
};

/** 드롭 한 칸의 목적지 인덱스. 소스 제거 뒤 삽입 기준으로 보정한다. */
export function pageTabDropIndex(sourceIndex: number, targetIndex: number, before: boolean): number {
  let destination = before ? targetIndex : targetIndex + 1;
  if (destination > sourceIndex) destination -= 1;
  return destination;
}

export function enablePageTabDrag(tab: HTMLElement, request: PageTabDragRequest): void {
  tab.setAttribute("draggable", request.canDrag ? "true" : "false");
  if (!request.canDrag) {
    tab.addEventListener("dragstart", (event) => event.preventDefault());
    return;
  }
  tab.addEventListener("dragstart", (event) => {
    const drag = event as DragEvent;
    draggingPageId = request.page.id;
    tab.classList.add("is-dragging");
    if (!drag.dataTransfer) return;
    drag.dataTransfer.effectAllowed = "move";
    drag.dataTransfer.setData(PAGE_DRAG_MIME, request.page.id);
    drag.dataTransfer.setData("text/plain", request.page.id);
  });
  tab.addEventListener("dragend", () => {
    draggingPageId = null;
    tab.classList.remove("is-dragging");
    clearPageTabDropMarks();
  });
}

export function enablePageTabDropTarget(tab: HTMLElement, request: PageTabDropRequest): void {
  tab.addEventListener("dragover", (event) => {
    if (!draggingPageId || draggingPageId === request.pageId) return;
    const drag = event as DragEvent;
    drag.preventDefault();
    if (drag.dataTransfer) drag.dataTransfer.dropEffect = "move";
    markDropSide(tab, dropBefore(tab, drag));
  });
  tab.addEventListener("dragleave", (event) => {
    const next = event instanceof DragEvent ? event.relatedTarget : null;
    if (next instanceof Node && tab.contains(next)) return;
    tab.classList.remove("evt-page-drop-before", "evt-page-drop-after");
  });
  tab.addEventListener("drop", (event) => {
    const drag = event as DragEvent;
    drag.preventDefault();
    drag.stopPropagation();
    const sourceId = draggingPageId;
    clearPageTabDropMarks();
    if (!sourceId || sourceId === request.pageId) return;
    const sourceIndex = request.pages.findIndex((page) => page.id === sourceId);
    const targetIndex = request.pages.findIndex((page) => page.id === request.pageId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const destination = pageTabDropIndex(sourceIndex, targetIndex, dropBefore(tab, drag));
    const source = request.pages[sourceIndex];
    if (!source) return;
    if (!moveEventPageTo(request.mapId, request.eventId, sourceId, destination)) return;
    toast(`"${source.name}" 페이지를 ${destination + 1}번째로 옮겼어요.`, "ok");
  });
}

function dropBefore(tab: HTMLElement, drag: DragEvent): boolean {
  const rect = tab.getBoundingClientRect();
  if (rect.width <= 0) return true;
  return drag.clientX < rect.left + rect.width / 2;
}

function markDropSide(tab: HTMLElement, before: boolean): void {
  clearPageTabDropMarks();
  tab.classList.add(before ? "evt-page-drop-before" : "evt-page-drop-after");
}

function clearPageTabDropMarks(): void {
  document.querySelectorAll(".evt-page-segment.evt-page-drop-before, .evt-page-segment.evt-page-drop-after")
    .forEach((node) => node.classList.remove("evt-page-drop-before", "evt-page-drop-after"));
}
