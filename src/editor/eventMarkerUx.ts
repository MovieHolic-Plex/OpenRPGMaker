import type { Layer } from "@/editor/editorState";
import type { GameEvent } from "@/project/types";

type EventMarkerLayer = "lower" | "upper" | "event";

export function eventDisplayName(event: Pick<GameEvent, "id" | "pages">): string {
  const pages = event.pages ?? [];
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const name = pages[index]?.name.trim();
    if (name) return name;
  }
  return event.id;
}

export function eventMarkerTooltip(event: Pick<GameEvent, "id" | "pages" | "x" | "y">): string {
  return `이벤트: ${eventDisplayName(event)} (${event.x},${event.y})`;
}

export function shouldOfferEventLayerSwitch(input: {
  readonly activeLayer: EventMarkerLayer | Layer;
  readonly clickCount: number;
  readonly hasEvent: boolean;
}): boolean {
  return input.activeLayer !== "event" && input.clickCount >= 2 && input.hasEvent;
}

/** 더블클릭은 편집 의도가 명확하므로 확인 모달 없이 바로 전환하고, 무슨 일이 있었는지 토스트로 알린다. */
export function eventLayerSwitchNotice(event: Pick<GameEvent, "id" | "pages">): string {
  return `'${eventDisplayName(event)}' 이벤트를 엽니다 — 이벤트 레이어로 전환했습니다.`;
}
