import { createBlankProject } from "@/project/defaults";
import type { EventPage, Project } from "@/project/types";

/** Minimal engine test fixture, never seeded into authored projects. */
export function characterAppearanceProject(): Project {
  const project = createBlankProject();
  project.assets.uploaded["uploaded-walk"] = {
    id: "uploaded-walk", name: "Manual walking sheet", kind: "charset",
    dataUrl: "data:image/png;base64,AA==",
    meta: { width: 288, height: 256, frameWidth: 24, frameHeight: 32 },
  };
  project.database.characterAppearances = [
    { id: "look", name: "Guide", description: "A guide", charset: { resourceId: "uploaded-walk", characterIndex: 5 }, face: { resourceId: "easyrpg-faceset-actor1-03" } },
    { id: "empty", name: "Empty", description: "" },
  ];
  project.database.actors[0].appearanceId = "look";
  const page: EventPage = {
    id: "page-guide", name: "Guide", conditions: [],
    graphic: { appearanceId: "look", direction: "left" },
    trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body: "A guide speaks." }],
  };
  project.maps[project.startMapId].events = [
    { id: "guide", x: 3, y: 3, trigger: { kind: "action" }, commands: [], pages: [page] },
  ];
  return project;
}
