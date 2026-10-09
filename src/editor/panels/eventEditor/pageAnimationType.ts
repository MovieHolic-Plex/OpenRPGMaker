import { updateEventPage } from "@/editor/eventPages";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { EVENT_ANIMATION_TYPE_OPTIONS } from "./options";
import type { EventAnimationType, EventPage, MapId } from "@/project/types";

export function renderPageAnimationType(mapId: MapId, eventId: string, page: EventPage): HTMLSelectElement {
  const value: EventAnimationType = page.animationType ?? "normal";
  const select = selectWithOptions(EVENT_ANIMATION_TYPE_OPTIONS, value, "event-page-animation-type");
  select.setAttribute("aria-label", "애니메이션 유형");
  select.addEventListener("change", () => {
    updateEventPage(mapId, eventId, page.id, {
      animationType: selectedOptionValue(select, EVENT_ANIMATION_TYPE_OPTIONS, value),
    });
  });
  return select;
}
