import { getTool } from "@/editor/tools/toolRegistry";
import { store } from "@/project/store";
import type { Command, MapId } from "@/project/types";

export function applyMemoryOpeningTemplate(
  mapId: MapId, eventId: string, replaceCommands: (commands: Command[]) => void,
): void {
  const tool = getTool("script_cutscene_preset");
  if (!tool) return;
  // Compile on a scratch project: this command preset must not delete sibling
  // pages or write a global snapshot underneath the live event draft.
  const draft = structuredClone(store.getCurrent());
  tool.run(draft, { mapId, preset: "memory_opening", eventId });
  const pages = draft.maps[mapId]?.events.find(entry => entry.id === eventId)?.pages;
  const compiled = pages?.find(page => page.name === "컷신");
  if (compiled) replaceCommands(compiled.commands);
}
