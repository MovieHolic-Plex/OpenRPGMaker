import type { EventPage, MapId } from "@/project/types";
import { el } from "@/util/dom";
import { renderNpcGraphicPicker } from "./npcGraphicPicker";
import { openEventSubdialog } from "./subdialog";

export function openNpcGraphicDialog(mapId: MapId, eventId: string, page: EventPage): void {
  openEventSubdialog({
    title: "Event Graphic",
    subtitle: `${page.name} / CharSet selection`,
    testId: "event-graphic-dialog",
    width: "narrow",
    render: (body) => {
      body.append(
        el("div", {
          class: "event-subdialog-note",
          text: "Pick an RTP CharSet, character slot, direction, and walking pattern.",
        }),
        renderNpcGraphicPicker(mapId, eventId, page)
      );
    },
  });
}
