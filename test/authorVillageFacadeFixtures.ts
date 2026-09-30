import { expect } from "vitest";
import { parseConstructionOutcome } from "@/editor/construction/parseConstructionOutcome";
import { createAuthorVillageTool, AUTHOR_VILLAGE_TOOL } from "@/editor/tools/authorVillageTool";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool, runToolDefinition } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolExecResult, ToolResult } from "@/editor/tools/types";
import type { VillageBuildInspection } from "@/editor/tools/villageBuilder";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import type { Project } from "@/project/types";

export const EXISTING_TARGET = { kind: "existing", mapId: "map_existing" } as const;

export function createExistingProject(size = 50): Project {
  const context: ToolContext = { project: createEmptyToolProject("author village") };
  const created = runTool(context, "create_map", {
    id: "map_existing",
    tilesetId: COMBINED_TOWN_TILESET_ID,
    name: "Existing village",
    width: size,
    height: size,
  });
  expect(created.ok, created.summary).toBe(true);
  return context.project;
}

export function runFacade(
  project: Project,
  args: Record<string, unknown>,
  tool = AUTHOR_VILLAGE_TOOL,
): ToolResult {
  const context: ToolContext = { project };
  const result = runToolDefinition(context, tool, args);
  if (result.ok && context.project !== project) Object.assign(project, context.project);
  return result;
}

export function construction(result: ToolResult) {
  const data = result.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("author_village data must be an object");
  }
  return parseConstructionOutcome(Reflect.get(data, "construction"));
}

export function inspection(
  actualHouseCount: number,
  options: { readonly mapId?: string; readonly qaOk?: boolean } = {},
): VillageBuildInspection {
  const exteriorMapId = options.mapId ?? "map_existing";
  const qaOk = options.qaOk ?? true;
  return {
    exteriorMapId,
    interiorMapIds: [],
    actualHouseCount,
    npcCount: 0,
    structuralQa: {
      ok: qaOk,
      doorsConnected: actualHouseCount,
      doorsIntact: actualHouseCount,
      roadComponents: qaOk ? 1 : 2,
      ridgeInvaded: 0,
      critiqueOk: qaOk,
    },
  };
}

export function stubTool(actualHouseCount: number, options: {
  readonly qaOk?: boolean;
  readonly mapId?: string;
  readonly innerOk?: boolean;
  readonly mutate?: boolean;
} = {}) {
  return createAuthorVillageTool({
    build(project): ToolExecResult {
      if (options.mutate !== false) project.maps.map_existing.lowerTiles[0] = TILE.PATH;
      return { summary: "stub village", data: { ok: options.innerOk ?? true } };
    },
    inspect(): VillageBuildInspection {
      return inspection(actualHouseCount, options);
    },
  });
}
