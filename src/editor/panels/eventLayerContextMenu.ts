import { setStartMap, setStartPos } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { deleteEditorEvent } from "@/editor/eventDeletion";
import { openEventAiPromptPopover } from "@/editor/eventAiQueue/eventAiQueueView";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { openEventEditorModal, openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { openTransferPlayerDialog } from "@/editor/panels/eventEditor/transferPlayerDialog";
import { openTestPlayModal } from "@/editor/panels/testPlayModal";
import {
  openMapContextMenu,
  type MapContextMenuItem,
  type MapContextMenuPoint,
} from "@/editor/panels/mapContextMenu";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent, MapId } from "@/project/types";
import { genId } from "@/util/id";
import { eventAtPoint } from "@/project/eventFootprintQuery";

export type EventLayerContextMenuTarget = {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
};

type OpenEventLayerContextMenuRequest = EventLayerContextMenuTarget & {
  readonly point: MapContextMenuPoint;
};

let eventClipboard: GameEvent | null = null;

export function openEventLayerContextMenu(request: OpenEventLayerContextMenuRequest): void {
  const map = store.getCurrent().maps[request.mapId];
  if (!map) return;
  if (request.x < 0 || request.y < 0 || request.x >= map.width || request.y >= map.height) return;
  openMapContextMenu({
    items: eventLayerContextMenuItems(request),
    mapId: request.mapId,
    mapName: `${map.name} (${request.x},${request.y})`,
    point: request.point,
  });
}

export function eventLayerContextMenuItems(target: EventLayerContextMenuTarget): readonly MapContextMenuItem[] {
  const existing = eventAtTarget(target);
  return [
    // 2026-09-28: 빈 칸의 AI 는 편집기를 열지 않는다. 칸 옆 한 줄 입력창 → 작업함에 맡기고 곧바로
    // 다음 칸으로 간다(eventAiQueue). 이벤트가 있는 칸은 기존대로 편집기의 명령 도크로 고친다.
    // 맨 위에 두는 이유: 여러 칸을 연달아 부탁하는 흐름에서 가장 자주 누르는 항목이다(단축키 A).
    ...(existing ? [] : [{
      action: () => openEventAiPromptPopover(target.mapId, target.x, target.y),
      icon: "spark",
      id: "event-ai-queue",
      label: "AI로 여기에 이벤트...",
      shortcut: "A",
      testId: "event-layer-event-ai-queue",
    } satisfies MapContextMenuItem]),
    {
      action: () => openNewEventEditorModal(target.mapId, target.x, target.y),
      icon: "event",
      id: "create-event",
      label: "이벤트 생성...",
      shortcut: "Enter",
      testId: "event-layer-create-event",
    },
    // 이벤트가 있는 칸: 편집기를 AI 명령 도크를 **펼친 채로** 열어 그 페이지를 고친다.
    // 자동 실행은 하지 않는다 — 의도와 다른 초안에 호출을 쓰지 않기 위해서다.
    ...(existing ? [{
      // 라벨은 메뉴를 세울 때의 점유를 따르지만, **실행 시점에 다시 읽는다**. 메뉴가 떠 있는
      // 동안 배경 갱신(다른 세션·자동 배치)이 그 칸에 이벤트를 놓으면, 세울 때의 `existing`
      // 은 낡아서 새 이벤트를 만들어 버린다 — 이벤트가 둘로 늘고 사용자는 고치려던 것을
      // 놓친다. 클릭 시점의 진실로 분기한다.
      action: () => openEventAiAuthoring(target),
      icon: "spark",
      id: "event-ai-author",
      label: "이 이벤트를 AI 로 고치기...",
      testId: "event-layer-event-ai-author",
    } satisfies MapContextMenuItem] : []),
    {
      action: () => cutEventAt(target),
      disabled: existing === undefined,
      icon: "copy",
      id: "cut",
      label: "잘라내기",
      separatorBefore: true,
      shortcut: "Ctrl+X",
      testId: "event-layer-cut",
    },
    {
      action: () => copyEventAt(target),
      disabled: existing === undefined,
      icon: "copy",
      id: "copy",
      label: "복사",
      shortcut: "Ctrl+C",
      testId: "event-layer-copy",
    },
    {
      action: () => pasteEventAt(target),
      disabled: eventClipboard === null,
      icon: "paste",
      id: "paste",
      label: "붙여넣기",
      shortcut: "Ctrl+V",
      testId: "event-layer-paste",
    },
    {
      action: () => deleteEventAt(target),
      disabled: existing === undefined,
      icon: "trash",
      id: "delete",
      label: "삭제",
      shortcut: "Del",
      testId: "event-layer-delete",
    },
    {
      action: () => createTransferEvent(target),
      icon: "event",
      id: "create-transfer-event",
      label: "장소 이동 이벤트 생성...",
      separatorBefore: true,
      testId: "event-layer-create-transfer-event",
    },
    {
      action: () => setPlayerStartingPosition(target),
      icon: "map-start",
      id: "player-start",
      label: "주인공 시작 위치 설정",
      separatorBefore: true,
      testId: "event-layer-set-player-start",
    },
    {
      action: () => createVehicleLocationEvent(target),
      icon: "map-start",
      id: "vehicle-start",
      label: "탈것 시작 위치 설정...",
      testId: "event-layer-set-vehicle-start",
    },
    {
      action: () => void openTestPlayModal({ mapId: target.mapId, x: target.x, y: target.y }),
      icon: "map-start",
      id: "test-here",
      label: "여기서 테스트",
      separatorBefore: true,
      testId: "event-layer-test-here",
    },
    // 2026-09-03 까지 전문가 클래식 툴바의 「이벤트 테스트」 버튼(선택 이벤트를 즉시 실행)이었다.
    // 그 행을 걷으면서 이 동작의 집은 이벤트를 우클릭한 자리가 됐다 — 이벤트 편집기 안의 「테스트」
    // 버튼과 같은 창(kind: selected-event)을 연다.
    {
      action: () => testEventAt(target),
      disabled: existing === undefined,
      icon: "play",
      id: "test-event",
      label: "이 이벤트 테스트",
      testId: "event-layer-test-event",
    },
  ];
}

function testEventAt(target: EventLayerContextMenuTarget): void {
  const event = eventAtTarget(target);
  if (!event || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("oprn:test-play-window", {
    detail: { kind: "selected-event", mapId: target.mapId, eventId: event.id },
  }));
}

/**
 * 우클릭 자리에 이벤트가 있으면 그 이벤트를 AI 로 고치고, 없으면 새로 만든다.
 * 둘 다 편집기의 AI 명령 도크를 펼친 채로 연다 — 사용자가 문장을 적는 것으로 시작한다.
 *
 * 점유는 **호출 시점에** 다시 읽는다(메뉴를 세운 시점이 아니라). 그 사이 배경 갱신이 그 칸을
 * 채웠다면, 낡은 판정은 이벤트를 하나 더 만들고 사용자가 고치려던 이벤트를 놓치게 한다.
 */
function openEventAiAuthoring(target: EventLayerContextMenuTarget): void {
  const current = eventAtTarget(target);
  if (current) {
    openEventEditorModal(target.mapId, current.id, { aiDock: true });
    return;
  }
  openNewEventEditorModal(target.mapId, target.x, target.y, undefined, { aiDock: true });
}

export function clearEventLayerClipboard(): void {
  eventClipboard = null;
}

function cutEventAt(target: EventLayerContextMenuTarget): void {
  if (!copyEventAt(target)) return;
  deleteEventAt(target);
}

export function copyEventAt(target: EventLayerContextMenuTarget): boolean {
  const event = eventAtTarget(target);
  if (!event) return false;
  eventClipboard = structuredClone(event);
  return true;
}

export function pasteEventAt(target: EventLayerContextMenuTarget): void {
  if (!eventClipboard) return;
  const map = store.getCurrent().maps[target.mapId];
  if (!map || !inBounds(target, map)) return;
  const event = cloneEventForPaste(eventClipboard, target);
  recordProjectSnapshot();
  store.update((project) => {
    project.maps[target.mapId]?.events.push(event);
  });
  editorState.set({ selectedEventId: event.id, selectedEventPageId: latestPageId(event) });
}

function deleteEventAt(target: EventLayerContextMenuTarget): void {
  const event = eventAtTarget(target);
  if (!event) return;
  recordProjectSnapshot();
  deleteEditorEvent(target.mapId, event.id);
}

function createTransferEvent(target: EventLayerContextMenuTarget): void {
  openNewEventEditorModal(target.mapId, target.x, target.y, (eventId) => {
    const command: Command = {
      kind: "transfer",
      mapId: target.mapId,
      x: target.x,
      y: target.y,
      direction: "retain",
      fade: "black",
    };
    store.update((project) => {
      const event = project.maps[target.mapId]?.events.find((item) => item.id === eventId);
      const page = event?.pages?.[event.pages.length - 1];
      if (!event || !page) return;
      event.trigger = { kind: "playerTouch" };
      page.name = "장소 이동";
      page.trigger = { kind: "playerTouch" };
      page.commands = [command];
    });
    // Open the transfer player picker dialog immediately so the user can choose
    // the destination map/position right away.
    openTransferPlayerDialog({
      command,
      onApply: (updated) => {
        store.update((project) => {
          const event = project.maps[target.mapId]?.events.find((item) => item.id === eventId);
          const page = event?.pages?.[event.pages.length - 1];
          if (!event || !page) return;
          page.commands = [updated];
        });
      },
    });
  });
}

function createVehicleLocationEvent(target: EventLayerContextMenuTarget): void {
  openNewEventEditorModal(target.mapId, target.x, target.y, (eventId) => {
    store.update((project) => {
      const event = project.maps[target.mapId]?.events.find((item) => item.id === eventId);
      const page = event?.pages?.[event.pages.length - 1];
      if (!event || !page) return;
      page.name = "탈것 시작 위치";
      page.commands = [{
        kind: "m2Command",
        commandId: "m2-039-set-vehicle-location",
        fields: {
          target: "boat",
          mapId: target.mapId,
          x: target.x,
          y: target.y,
        },
      }];
    });
  });
}

function setPlayerStartingPosition(target: EventLayerContextMenuTarget): void {
  recordProjectSnapshot();
  setStartMap(target.mapId);
  setStartPos(target.x, target.y);
}

function eventAtTarget(target: EventLayerContextMenuTarget): GameEvent | undefined {
  const map = store.getCurrent().maps[target.mapId];
  return map ? eventAtPoint(map, target.x, target.y) : undefined;
}

function cloneEventForPaste(source: GameEvent, target: EventLayerContextMenuTarget): GameEvent {
  const event = structuredClone(source);
  event.id = genId("ev");
  event.x = target.x;
  event.y = target.y;
  event.pages = event.pages?.map(clonePageForPaste);
  delete event.draft;
  return event;
}

function clonePageForPaste(page: EventPage): EventPage {
  return { ...page, id: genId("page") };
}

function latestPageId(event: GameEvent): string | null {
  const pages = event.pages ?? [];
  return pages[pages.length - 1]?.id ?? null;
}

function inBounds(target: EventLayerContextMenuTarget, map: { readonly width: number; readonly height: number }): boolean {
  return target.x >= 0 && target.y >= 0 && target.x < map.width && target.y < map.height;
}
