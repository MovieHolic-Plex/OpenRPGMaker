import { describe, expect, it, vi } from "vitest";
import {
  AUTHOR_VILLAGE_TOOL,
  createAuthorVillageTool,
  runAuthorVillage,
} from "@/editor/tools/authorVillageTool";
import { runTool, runToolDefinition } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolExecResult } from "@/editor/tools/types";
import type { VillageBuildInspection } from "@/editor/tools/villageBuilder";
import { TILE } from "@/project/defaults/constants";
import { serialize } from "@/project/io";
import type { Project } from "@/project/types";
import {
  construction,
  createExistingProject,
  EXISTING_TARGET,
  inspection,
  stubTool,
} from "./authorVillageFacadeFixtures";

const EXACT_REQUEST = {
  target: EXISTING_TARGET,
  houseCount: 4,
  countPolicy: "exact",
} as const;

function projectWithOtherMap(): Project {
  const context: ToolContext = { project: createExistingProject() };
  const created = runTool(context, "create_map", {
    id: "map_other",
    name: "Other map",
    width: 50,
    height: 50,
  });
  expect(created.ok, created.summary).toBe(true);
  return context.project;
}

function mutationTool(mutate: (project: Project) => void) {
  return createAuthorVillageTool({
    build(project): ToolExecResult {
      project.maps.map_existing.lowerTiles[20 * 50 + 20] = TILE.PATH;
      mutate(project);
      return { summary: "malicious stub", data: { ok: true } };
    },
    inspect(): VillageBuildInspection {
      return inspection(4);
    },
  });
}

describe("author_village adversarial boundary", () => {
  it("runs the product facade through exactly one ToolDefinition execution", () => {
    const context: ToolContext = { project: createExistingProject() };
    const original = AUTHOR_VILLAGE_TOOL.run;
    let calls = 0;
    const runSpy = vi.spyOn(AUTHOR_VILLAGE_TOOL, "run").mockImplementation((project, args) => {
      calls += 1;
      return original(project, args);
    });

    const result = runAuthorVillage(context, { ...EXACT_REQUEST, seed: 7, interior: false });
    runSpy.mockRestore();

    expect(result.ok, result.summary).toBe(true);
    expect(calls).toBe(1);
    expect(construction(result).selectedImplementation).toBe("buildVillageDomain");
  });

  it("returns a structured blocked ConstructionOutcome from the product facade", () => {
    const context: ToolContext = { project: createExistingProject() };

    const result = runAuthorVillage(context, { ...EXACT_REQUEST, houseCount: 2 });

    expect(result.ok).toBe(false);
    expect(construction(result)).toMatchObject({
      executionOk: false,
      applied: false,
      outcome: "blocked",
      requestedEntrypoint: "author_village",
      canonicalRoute: "author_village",
      selectedImplementation: "buildVillageDomain",
      routeChanges: [],
      counts: { requested: 2, actual: 0 },
    });
  });

  it("returns a structured failed outcome when the inner builder reports data.ok false", () => {
    const context: ToolContext = { project: createExistingProject() };
    const innerFailure = stubTool(4, { innerOk: false });
    const runSpy = vi.spyOn(AUTHOR_VILLAGE_TOOL, "run").mockImplementation(innerFailure.run);
    const before = serialize(context.project);

    const result = runAuthorVillage(context, EXACT_REQUEST);
    runSpy.mockRestore();

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("village-inner-failed");
    expect(construction(result)).toMatchObject({
      executionOk: false,
      applied: false,
      outcome: "failed",
      selectedImplementation: "buildVillageDomain",
      routeChanges: [],
    });
    expect(serialize(context.project)).toBe(before);
  });

  it.each(["add", "remove", "mutate"] as const)("rolls back an unauthorized other-map %s", (mode) => {
    const project = projectWithOtherMap();
    const before = serialize(project);
    const tool = mutationTool((draft) => {
      switch (mode) {
        case "add": {
          const other = draft.maps.map_other;
          if (!other) throw new Error("map_other fixture is missing");
          draft.maps.map_rogue = { ...structuredClone(other), id: "map_rogue", name: "Rogue map" };
          draft.mapTree.children.push({ mapId: "map_rogue", children: [] });
          break;
        }
        case "remove":
          delete draft.maps.map_other;
          draft.mapTree.children = draft.mapTree.children.filter((node) => node.mapId !== "map_other");
          break;
        case "mutate":
          draft.maps.map_other.name = "Hijacked map";
          break;
      }
    });
    const context: ToolContext = { project };

    const result = runToolDefinition(context, tool, EXACT_REQUEST);

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("village-scope-violation");
    expect(serialize(context.project)).toBe(before);
  });

  it("rolls back an event created outside requested bounds", () => {
    const context: ToolContext = { project: createExistingProject() };
    const placed = runTool(context, "place_npc", {
      mapId: "map_existing",
      id: "npc_outside",
      x: 2,
      y: 2,
      name: "Outside",
      pages: [{ lines: ["Outside"] }],
    });
    expect(placed.ok, placed.summary).toBe(true);
    const before = serialize(context.project);
    const tool = mutationTool((draft) => {
      const source = draft.maps.map_existing.events[0];
      if (source) draft.maps.map_existing.events.push({ ...structuredClone(source), id: "npc_rogue" });
    });

    const result = runToolDefinition(context, tool, {
      target: { kind: "existing", mapId: "map_existing", bounds: { x: 10, y: 10, w: 36, h: 36 } },
      houseCount: 4,
      countPolicy: "exact",
    });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("village-scope-violation");
    expect(serialize(context.project)).toBe(before);
  });

  it("rolls back an undeclared non-map project mutation", () => {
    const project = createExistingProject();
    const before = serialize(project);
    const tool = mutationTool((draft) => {
      draft.meta.title = "Hijacked project";
    });
    const context: ToolContext = { project };

    const result = runToolDefinition(context, tool, EXACT_REQUEST);

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("village-scope-violation");
    expect(serialize(context.project)).toBe(before);
  });
});
