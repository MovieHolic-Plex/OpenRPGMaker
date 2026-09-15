import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { occurrenceOrigin } from "@/project/spatial/domain";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { designUsage, matchesUsageFilter, usageSummary } from "@/editor/panels/spatialUsage";
import { instancesFixture } from "./support/spatialInstancesFixture";

describe("occurrence origin stamp", () => {
  it("threads an ai origin from the instantiation request into every created occurrence and survives IO", () => {
    // Given
    const { project, document, request } = instancesFixture();
    // When
    const result = instantiateSpatialDesign(document, project, { ...request, origin: "ai" });
    const reloaded = deserialize(serialize({ ...project, spatialAuthoring: result })).spatialAuthoring;
    // Then
    const occurrences = Object.values(reloaded?.occurrences ?? {});
    expect(occurrences.length).toBeGreaterThan(0);
    expect(occurrences.every((entry) => entry.origin === "ai")).toBe(true);
    expect(occurrences.every((entry) => occurrenceOrigin(entry) === "ai")).toBe(true);
  });

  it("keeps historical occurrences unstamped and classifies them by the generator tag", () => {
    // Given
    const { project, document, request } = instancesFixture();
    // When: no origin in the request, exactly like pre-field data.
    const result = instantiateSpatialDesign(document, project, request);
    const reloaded = deserialize(serialize({ ...project, spatialAuthoring: result })).spatialAuthoring;
    // Then: the field stays absent; classification falls back to the tag.
    expect(Object.values(reloaded?.occurrences ?? {}).every((entry) => entry.origin === undefined)).toBe(true);
    expect(occurrenceOrigin({ generatorVersion: "spatial-ai-v1" })).toBe("ai");
    expect(occurrenceOrigin({ generatorVersion: "spatial-legacy-house-v1" })).toBe("ai");
    expect(occurrenceOrigin({ generatorVersion: "manual-spatial-build-v1" })).toBe("user");
    expect(occurrenceOrigin({ generatorVersion: "place-room-editor-v1" })).toBe("user");
    expect(occurrenceOrigin({ generatorVersion: "manual-spatial-build-v1", origin: "ai" })).toBe("ai");
  });

  it("aggregates per-design usage with ai and direct counts for the gallery", () => {
    // Given: one ai build and the design ids it references.
    const { project, document, request } = instancesFixture();
    const built = instantiateSpatialDesign(document, project, { ...request, origin: "ai" });
    const authored = { ...project, spatialAuthoring: built };
    const anyOccurrence = Object.values(built.occurrences)[0];
    // When
    const usage = designUsage(authored, anyOccurrence.source.id);
    // Then
    expect(usage.rows.length).toBeGreaterThan(0);
    expect(usage.ai).toBe(usage.rows.length);
    expect(usage.direct).toBe(0);
    expect(usageSummary(usage)).toContain("AI");
    expect(matchesUsageFilter(usage, "ai")).toBe(true);
    expect(matchesUsageFilter(usage, "idle")).toBe(false);
    expect(matchesUsageFilter(usage, "placed")).toBe(true);
    // And: an unused design id lands in the idle bucket.
    const idle = designUsage(authored, "design-that-was-never-placed");
    expect(usageSummary(idle)).toBe("아직 안 쓰임");
    expect(matchesUsageFilter(idle, "idle")).toBe(true);
    expect(matchesUsageFilter(idle, "ai")).toBe(false);
  });
});
