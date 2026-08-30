import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { getTool } from "@/editor/tools/toolRegistry";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";

export function applyMemoryOpeningTemplate(mapId: MapId, eventId: string, pageId: string): void {
  const tool = getTool("script_cutscene_preset");
  if (!tool) return;
  recordProjectSnapshot("회상 오프닝 템플릿", mapId, { kind: "map" });
  store.update((draft) => {
    tool.run(draft, { mapId, preset: "memory_opening", eventId });
    const event = draft.maps[mapId]?.events.find((entry) => entry.id === eventId);
    const pages = event?.pages;
    if (!event || !pages) return;
    const compiled = pages.find((page) => page.name === "컷신") ?? pages.at(-1);
    const target = pages.find((page) => page.id === pageId) ?? pages[0];
    if (!compiled || !target) return;
    target.commands = [...compiled.commands];
    event.pages = pages.filter((page) => page.id === target.id);
  });
}
