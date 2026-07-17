import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import {
  buildVillageDomain,
  inspectVillageBuild,
} from "@/editor/tools/villageBuilder";
import { deserialize, serialize } from "@/project/io";
import type { Project } from "@/project/types";
import type { ToolContext, ToolExecResult } from "@/editor/tools/types";

type VillageResultData = {
  readonly mapId: string;
  readonly housesBuilt: number;
  readonly warnings?: readonly string[];
};

function cloneProject(project: Project): Project {
  return deserialize(serialize(project));
}

function createExistingMapProject(size = 50): Project {
  const context: ToolContext = { project: createEmptyToolProject("마을 seam") };
  const created = runTool(context, "create_map", {
    id: "map_existing",
    name: "기존 마을 터",
    width: size,
    height: size,
  });
  expect(created.ok, created.summary).toBe(true);
  return context.project;
}

function resultData(result: ToolExecResult): VillageResultData {
  const data = result.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("build_village result data must be an object");
  }
  const mapId = Reflect.get(data, "mapId");
  const housesBuilt = Reflect.get(data, "housesBuilt");
  const warnings = Reflect.get(data, "warnings");
  if (typeof mapId !== "string" || typeof housesBuilt !== "number") {
    throw new Error("build_village result is missing mapId/housesBuilt");
  }
  if (warnings !== undefined && (!Array.isArray(warnings) || !warnings.every((warning) => typeof warning === "string"))) {
    throw new Error("build_village result warnings must be strings");
  }
  return {
    mapId,
    housesBuilt,
    ...(warnings === undefined ? {} : { warnings }),
  };
}

function semanticValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => typeof entry !== "string" || !entry.startsWith("[vperf]"))
      .map(semanticValue);
  }
  if (typeof value !== "object" || value === null) return value;
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(value)) normalized[key] = semanticValue(Reflect.get(value, key));
  return normalized;
}

describe("buildVillageDomain", () => {
  it("preserves seeded existing-map output when called through the compatibility adapter", () => {
    // Given
    const baseline = createExistingMapProject();
    const compatibilityContext: ToolContext = { project: cloneProject(baseline) };
    const domainProject = cloneProject(baseline);
    const args = {
      mapId: "map_existing",
      houses: 8,
      seed: 7,
      interior: false,
      doorEvent: false,
      fences: false,
      decor: false,
    };

    // When
    const compatibility = runTool(compatibilityContext, "build_village", args);
    const domain = buildVillageDomain(domainProject, args);

    // Then
    expect(compatibility.ok, compatibility.summary).toBe(true);
    expect(domain.summary).toBe(compatibility.summary);
    expect(semanticValue(domain.data)).toEqual(semanticValue(compatibility.data));
    expect(serialize(domainProject)).toBe(serialize(compatibilityContext.project));
  });

  it.each([
    { requested: 2, clamped: 4 },
    { requested: 33, clamped: 32 },
  ])("keeps the legacy $requested-to-$clamped house clamp", ({ requested, clamped }) => {
    // Given
    const project = createExistingMapProject(100);

    // When
    const result = buildVillageDomain(project, {
      mapId: "map_existing",
      houses: requested,
      seed: 7,
      interior: false,
      doorEvent: false,
      fences: false,
      decor: false,
    });
    const data = resultData(result);

    // Then
    expect(result.summary).toContain(`/${clamped}`);
    expect(data.housesBuilt).toBeLessThanOrEqual(clamped);
  });

  it("keeps a constrained house shortfall as a compatibility warning", () => {
    // Given
    const project = createExistingMapProject(36);

    // When
    const result = buildVillageDomain(project, {
      mapId: "map_existing",
      houses: 32,
      seed: 7,
      interior: false,
      doorEvent: false,
      fences: false,
      decor: false,
    });
    const data = resultData(result);

    // Then
    expect(data.housesBuilt).toBeLessThan(32);
    expect(data.warnings).toContain(`집 수 미달: ${data.housesBuilt}/32`);
  });

  it("keeps a zero-house constrained build as an atomic compatibility failure", () => {
    // Given
    const context: ToolContext = { project: createExistingMapProject(36) };
    const before = serialize(context.project);
    const impossiblePlan = Array.from({ length: 4 }, () => ({
      kitId: "blue-stone",
      templateId: "no-such-template",
    }));

    // When
    const result = runTool(context, "build_village", {
      mapId: "map_existing",
      housePlans: impossiblePlan,
      seed: 7,
      interior: false,
      doorEvent: false,
      fences: false,
      decor: false,
    });

    // Then
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("house-template-unplaced");
    expect(serialize(context.project)).toBe(before);
  });

  it("rejects malformed legacy house input before mutating the ToolRunner project", () => {
    // Given
    const context: ToolContext = { project: createExistingMapProject() };
    const before = serialize(context.project);

    // When
    const result = runTool(context, "build_village", {
      mapId: "map_existing",
      houses: "four",
      seed: 7,
    });

    // Then
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("invalid-args");
    expect(serialize(context.project)).toBe(before);
  });
});

describe("inspectVillageBuild", () => {
  it("classifies the requested exterior, created interiors, actual houses, and structural QA", () => {
    // Given
    const project = createExistingMapProject();
    const result = buildVillageDomain(project, {
      mapId: "map_existing",
      houses: 4,
      seed: 7,
      interior: true,
      doorEvent: true,
      fences: false,
      decor: false,
    });

    // When
    const inspection = inspectVillageBuild(project, result);

    // Then
    expect(inspection.exteriorMapId).toBe("map_existing");
    expect(inspection.interiorMapIds.length).toBeGreaterThanOrEqual(inspection.actualHouseCount);
    expect(inspection.interiorMapIds).not.toContain(inspection.exteriorMapId);
    expect(inspection.interiorMapIds.every((mapId) => project.maps[mapId] !== undefined)).toBe(true);
    expect(inspection.actualHouseCount).toBe(4);
    expect(inspection.structuralQa).toEqual({
      ok: true,
      doorsConnected: 4,
      doorsIntact: 4,
      roadComponents: 1,
      ridgeInvaded: 0,
      critiqueOk: true,
    });
  });

  it("rejects a stale result whose exterior map is absent from authoritative project state", () => {
    // Given
    const project = createExistingMapProject();
    const result = buildVillageDomain(project, {
      mapId: "map_existing",
      houses: 4,
      seed: 7,
      interior: false,
      doorEvent: false,
      fences: false,
      decor: false,
    });
    delete project.maps.map_existing;

    // When
    const inspect = (): void => {
      inspectVillageBuild(project, result);
    };

    // Then
    expect(inspect).toThrow(/actual exterior map|실제 외부 맵/);
  });
});
