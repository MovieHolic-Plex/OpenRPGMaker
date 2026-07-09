import { runTool } from "@/editor/tools";
import { createBlankProject, DEFAULT_TILESET_TEXTURE_KEY } from "@/project/defaults";
import type { Project } from "@/project/types";

export const MEMORY_CUTSCENE_MAP_ID = "map_blank_start";
export const MEMORY_CUTSCENE_EVENT_ID = "ev_memory_cutscene";
export const MEMORY_CUTSCENE_PICTURE_ID = "memory_fade";
export const MEMORY_CUTSCENE_PICTURE_RESOURCE_ID = DEFAULT_TILESET_TEXTURE_KEY;

export function createMemoryCutsceneProject(): Project {
  const project = createBlankProject();
  const ctx = { project };
  const result = runTool(ctx, "script_cutscene", {
    mapId: MEMORY_CUTSCENE_MAP_ID,
    eventId: MEMORY_CUTSCENE_EVENT_ID,
    x: 2,
    y: 3,
    trigger: "action",
    skippable: true,
    beats: [
      { kind: "camera", mode: "pan", x: 4, y: 5, durationMs: 32, wait: true },
      { kind: "picture", action: "show", pictureId: MEMORY_CUTSCENE_PICTURE_ID, resourceId: MEMORY_CUTSCENE_PICTURE_RESOURCE_ID, x: 32, y: 24 },
      { kind: "say", speaker: "나", text: "그날의 빛이 아직 남아 있다." },
    ],
  });
  if (!result.ok) throw new Error(result.summary);
  return ctx.project;
}
