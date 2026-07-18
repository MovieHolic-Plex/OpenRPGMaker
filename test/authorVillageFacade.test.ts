import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { serialize } from "@/project/io";
import {
  construction,
  createExistingProject,
  EXISTING_TARGET,
  runFacade,
  stubTool,
} from "./authorVillageFacadeFixtures";
import "./authorVillageFacadeAdversarial";

describe("author_village facade", () => {
  it("applies an exact seeded village to only the requested existing exterior", () => {
    const project = createExistingProject();
    const startBefore = { mapId: project.startMapId, pos: { ...project.startPos } };

    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 4,
      countPolicy: "exact",
      seed: 7,
      interior: false,
    });

    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
    expect(construction(result)).toMatchObject({
      executionOk: true,
      applied: true,
      outcome: "applied",
      requestedEntrypoint: "author_village",
      canonicalRoute: "author_village",
      routeChanges: [],
      target: EXISTING_TARGET,
      counts: { requested: 4, actual: 4 },
    });
    expect({ mapId: project.startMapId, pos: project.startPos }).toEqual(startBefore);
    expect(Object.keys(project.maps)).toEqual(["map_existing"]);
  });

  it("creates the exact requested new map identity without suffix or reuse", () => {
    const project = createEmptyToolProject("new village");
    const result = runFacade(project, {
      target: {
        kind: "new",
        mapId: "map_named_village",
        name: "Named Village",
        width: 50,
        height: 50,
        plannedMap: { mapId: "map_named_village", width: 50, height: 50 },
      },
      houseCount: 4,
      countPolicy: "exact",
      seed: 7,
      interior: false,
    });

    expect(result.ok, result.summary).toBe(true);
    expect(project.maps.map_named_village).toMatchObject({
      id: "map_named_village",
      name: "Named Village",
      width: 50,
      height: 50,
    });
    expect(Object.keys(project.maps)).toEqual(["map_named_village"]);
    expect(construction(result).counts).toEqual({ requested: 4, actual: 4 });
  });

  it.each([2, 33])("rejects houseCount %s without clamping or writing", (houseCount) => {
    const project = createExistingProject(100);
    const before = serialize(project);

    const result = runFacade(project, { target: EXISTING_TARGET, houseCount, countPolicy: "exact" });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("invalid-args");
    expect(serialize(project)).toBe(before);
  });

  it("rejects a house-plan count mismatch before writing", () => {
    const project = createExistingProject();
    const before = serialize(project);

    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 4,
      housePlans: [{ yard: [] }, { yard: [] }, { yard: [] }],
      countPolicy: "exact",
    });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("invalid-args");
    expect(serialize(project)).toBe(before);
  });

  it("rolls back maps, interiors, events, tree, and start when exact count is short", () => {
    const project = createExistingProject(36);
    const before = serialize(project);

    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 32,
      countPolicy: "exact",
      seed: 7,
      interior: true,
    });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("village-count-shortfall");
    expect(serialize(project)).toBe(before);
  });

  it("fails a colliding new map without suffixing or reusing it", () => {
    const project = createExistingProject();
    const before = serialize(project);

    const result = runFacade(project, {
      target: { kind: "new", mapId: "map_existing", name: "Collision", width: 50, height: 50, plannedMap: { mapId: "map_existing", width: 50, height: 50 } },
      houseCount: 4,
      countPolicy: "exact",
    });

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("map-exists");
    expect(Object.keys(project.maps)).toEqual(["map_existing"]);
    expect(serialize(project)).toBe(before);
  });

  it("reports an explicit best-effort result at the 85 percent threshold", () => {
    const project = createExistingProject();

    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 20,
      countPolicy: "best-effort",
    }, stubTool(17));

    expect(result.ok, result.summary).toBe(true);
    expect(construction(result)).toMatchObject({
      executionOk: true,
      applied: true,
      outcome: "partial",
      counts: { requested: 20, actual: 17 },
    });
  });

  it("rolls back best-effort below the 85 percent threshold", () => {
    const project = createExistingProject();
    const before = serialize(project);

    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 20,
      countPolicy: "best-effort",
    }, stubTool(16));

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("village-count-shortfall");
    expect(serialize(project)).toBe(before);
  });

  it.each([
    { label: "structural QA", tool: stubTool(4, { qaOk: false }), code: "village-qa-failed" },
    { label: "target change", tool: stubTool(4, { mapId: "map_other" }), code: "village-target-changed" },
    { label: "inner failure", tool: stubTool(4, { innerOk: false }), code: "village-inner-failed" },
    { label: "no write", tool: stubTool(4, { mutate: false }), code: "village-no-change" },
  ])("converts $label into an atomic outer failure", ({ tool, code }) => {
    const project = createExistingProject();
    const before = serialize(project);

    const result = runFacade(project, {
      target: EXISTING_TARGET,
      houseCount: 4,
      countPolicy: "exact",
    }, tool);

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe(code);
    expect(serialize(project)).toBe(before);
  });

  it("rejects an existing-target write outside requested bounds", () => {
    const project = createExistingProject();
    const before = serialize(project);

    const result = runFacade(project, {
      target: { kind: "existing", mapId: "map_existing", bounds: { x: 10, y: 10, w: 36, h: 36 } },
      houseCount: 4,
      countPolicy: "exact",
    }, stubTool(4));

    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("village-outside-bounds");
    expect(serialize(project)).toBe(before);
  });
});
