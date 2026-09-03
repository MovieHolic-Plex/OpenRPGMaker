import { setStartMap, setStartPos } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { deleteEditorEvent } from "@/editor/eventDeletion";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { openNewEventEditorModal } from "@/editor/panels/eventEditor/modal";
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
    {
      action: () => openNewEventEditorModal(target.mapId, target.x, target.y),
      icon: "event",
      id: "create-event",
      label: "이벤트 생성...",
      shortcut: "Enter",
      testId: "event-layer-create-event",
    },
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
  const eventId = openNewEventEditorModal(target.mapId, target.x, target.y);
  if (!eventId) return;
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
}

function createVehicleLocationEvent(target: EventLayerContextMenuTarget): void {
  const eventId = openNewEventEditorModal(target.mapId, target.x, target.y);
  if (!eventId) return;
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
