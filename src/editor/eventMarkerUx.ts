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

export function eventLayerSwitchPrompt(event: Pick<GameEvent, "id" | "pages">): string {
  return `이벤트 레이어로 전환하고 '${eventDisplayName(event)}' 이벤트를 편집할까요?`;
}
