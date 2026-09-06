import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";

/** Minimal local contract fixture, not an authored game or demo. */
export function lifeQaProject() {
  const project = createBlankProject();
  project.meta.title = "Life QA observability fixture";
  project.system.energy = { max: 1, initial: 1, restorePerDay: 0 };
  project.database.items.push(normalizeItemRecord({ id: "qa-hoe", name: "QA hoe", farmTool: "hoe" }));
  project.session.inventory = { "qa-hoe": 1 };
  project.startPos = { x: 2, y: 2 };
  const map = project.maps[project.startMapId]!;
  map.events = [];
  map.farmableArea = [{ x: 1, y: 1, w: 4, h: 4 }];
  return project;
}
