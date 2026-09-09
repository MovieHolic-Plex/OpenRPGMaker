import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import type { Project } from "@/project/types";

export const MUSIC_ID = "qa-description-music";
export const SOUND_ID = "qa-description-sound";

export function audioDescriptionToolProject(): Project {
  const project = createEmptyToolProject();
  project.assets.uploaded[MUSIC_ID] = {
    id: MUSIC_ID,
    kind: "music",
    name: "Shared display name",
    dataUrl: "data:audio/ogg;base64,T2dnUw==",
    meta: {},
  };
  project.assets.uploaded[SOUND_ID] = {
    id: SOUND_ID,
    kind: "sound",
    name: "Shared display name",
    dataUrl: "data:audio/ogg;base64,T2dnUw==",
    meta: {},
  };
  return project;
}
