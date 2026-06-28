import type { EventPage, MapId } from "@/project/types";
import { renderNpcGraphicPicker } from "./npcGraphicPicker";
import { openEventSubdialog } from "./subdialog";

export function openNpcGraphicDialog(mapId: MapId, eventId: string, page: EventPage): void {
  openEventSubdialog({
    title: "Graphic",
    testId: "event-graphic-dialog",
    width: "narrow",
    render: (body, close) => {
      body.append(renderNpcGraphicPicker(mapId, eventId, page, close));
    },
  });
}
