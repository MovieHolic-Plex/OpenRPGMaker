import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types";
import { runToolDefinition } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";

export const HOUSE_RECT = { x: 3, y: 3, w: 4, h: 4 };

export function houseMap(project: Project): GameMap {
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("Missing fixture map");
  return map;
}

export function completedHouseProject(): Project {
  const project = createBlankProject();
  project.startPos = { x: 0, y: 0 };
  const map = houseMap(project);
  map.lowerTiles.fill(TILE.GRASS);
  map.upperTiles.fill(TILE.EMPTY);
  map.layoutPlan = {
    version: 1, kind: "fixture", regions: [
      { id: "house_1", role: "house", label: "House", ...HOUSE_RECT, doorAt: { x: 4, y: 6 } },
    ],
  };
  map.lowerTiles[3 * map.width + 3] = 96;
  map.upperTiles[3 * map.width + 3] = 199;
  map.lowerTiles[4 * map.width + 4] = TILE.EMPTY;
  return project;
}

/** A real arbitrary write definition: proves protection is independent of tool names/args. */
export function mutateProject(ctx: ToolContext, mutate: (draft: Project) => void, dryRun = false): ToolResult {
  return runToolDefinition(ctx, {
    name: "unrelated_database_operation", mode: "write", description: "fixture mutation",
    parameters: { type: "object", properties: {} },
    run(draft) { mutate(draft); return { summary: "fixture mutation" }; },
  }, {}, { dryRun });
}
