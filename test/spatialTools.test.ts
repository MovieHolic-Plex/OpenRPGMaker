import { describe, expect, it } from "vitest";
import { runTool, runToolDefinition } from "@/editor/tools/toolRunner";
import { allTools } from "@/editor/tools/toolRegistry";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { own } from "@/project/spatial/domain";
import { fixtureDocument, spaceCompilerFixture, spaceDesign } from "./support/spatialSpaceCompilerFixture";

function previewId(data: unknown): string {
  if (typeof data !== "object" || data === null || !("previewId" in data) || typeof data.previewId !== "string") throw new TypeError("Missing issued preview ID");
  return data.previewId;
}
const build = { kind: "space", id: spaceDesign, occurrenceId: "ai-room", seed: 17 };

describe("registered canonical spatial tools", () => {
  it("exposes the five native tools when the registry is queried", () => {
    // Given / When
    const names = allTools().filter(tool => !tool.deprecated).map(tool => tool.name);
    // Then
    expect(names).toEqual(expect.arrayContaining(["list_spatial_designs", "get_spatial_design", "upsert_spatial_design", "preview_spatial_build", "apply_spatial_build"]));
  });
  it("keeps reads pure when a source is discovered and resolved", () => {
    // Given
    const project = spaceCompilerFixture();
    const before = JSON.stringify(project);
    // When
    const result = runTool({ project }, "get_spatial_design", { kind: "space", id: spaceDesign });
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ kind: "space", design: { id: spaceDesign, revision: 1 }, resolved: { snapshot: { root: { id: spaceDesign } } } });
    expect(JSON.stringify(project)).toBe(before);
  });
  it("changes only the source when a revision is explicitly replaced", () => {
    // Given
    const project = spaceCompilerFixture();
    const document = fixtureDocument(project);
    const design = { ...own(document.library.spaces, spaceDesign), revision: 2, name: "AI revision" };
    const ctx = { project };
    // When
    const result = runTool(ctx, "upsert_spatial_design", { kind: "space", space: design, expectedRevision: 1 });
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.spatialAuthoring?.library.spaces[spaceDesign]?.revision).toBe(2);
    expect(ctx.project.spatialAuthoring?.occurrences).toEqual(document.occurrences);
    expect(ctx.project.maps).toEqual(project.maps);
    expect(project.spatialAuthoring).toBe(document);
    expect(result.diff?.dbRecordsChanged).toBe(1);
  });
  it("compiles only on the detached draft when an issued preview is applied", () => {
    // Given
    const project = spaceCompilerFixture();
    const ctx = { project };
    const preview = runTool(ctx, "preview_spatial_build", build);
    expect(preview.ok, preview.summary).toBe(true);
    expect(ctx.project).toBe(project);
    const id = previewId(preview.data);
    // When
    const result = runTool(ctx, "apply_spatial_build", { previewId: id });
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.maps["spatial:ai-room"]).toBeDefined();
    expect(project.maps["spatial:ai-room"]).toBeUndefined();
    expect(ctx.project.spatialAuthoring?.occurrences["ai-room"]?.source).toEqual({ kind: "space", id: spaceDesign, revision: 1 });
  });
  it.each(["forged", "stale", "foreign", "spent"])("rejects %s preview acceptance without mutation", condition => {
    // Given
    const ctx = { project: spaceCompilerFixture() };
    const read = runTool(ctx, "preview_spatial_build", build);
    expect(read.ok, read.summary).toBe(true);
    const id = previewId(read.data);
    if (condition === "stale") ctx.project.meta.title = "edited after preview";
    if (condition === "foreign") ctx.project = spaceCompilerFixture();
    if (condition === "spent") expect(runTool(ctx, "apply_spatial_build", { previewId: id }).ok).toBe(true);
    const before = JSON.stringify(ctx.project);
    // When
    const result = runTool(ctx, "apply_spatial_build", { previewId: condition === "forged" ? "invented" : id });
    // Then
    expect(result.ok).toBe(false);
    expect(JSON.stringify(ctx.project)).toBe(before);
  });
  it.each(["missing", "cycle", "overwrite"])("rejects %s source writes without partial changes", condition => {
    // Given
    const ctx = { project: spaceCompilerFixture() };
    const before = JSON.stringify(ctx.project);
    const args = condition === "overwrite" ? { kind: "space", space: own(fixtureDocument(ctx.project).library.spaces, spaceDesign) }
      : { kind: "place", expectedRevision: 0, place: { id: "broken", name: "Broken", revision: 1, tags: [], provenance: { origin: "ai" }, kind: "facility", layout: "manual", ports: [], connections: [],
        children: [{ id: "child", source: { kind: "place", id: condition === "cycle" ? "broken" : "absent" }, x: 0, y: 0, level: 0 }] } };
    // When
    const result = runTool(ctx, "upsert_spatial_design", args);
    // Then
    expect(result.ok).toBe(false);
    expect(JSON.stringify(ctx.project)).toBe(before);
  });
  it("rejects malformed hierarchy when a generic write bypasses spatial tools", () => {
    // Given
    const ctx = { project: spaceCompilerFixture() };
    const before = JSON.stringify(ctx.project);
    // When
    const result = runToolDefinition(ctx, { name: "generic-test-write", mode: "write", description: "", parameters: { type: "object" }, run(draft) {
      draft.spatialAuthoring = { ...fixtureDocument(draft), rootOccurrenceIds: [] };
      return { summary: "attempt" };
    } }, {});
    // Then
    expect(result.ok).toBe(false);
    expect(JSON.stringify(ctx.project)).toBe(before);
  });
  it("retains preview lineage when the normal assistant draft is cloned", () => {
    // Given
    const ctx = { project: spaceCompilerFixture() };
    const read = runTool(ctx, "preview_spatial_build", build);
    expect(read.ok, read.summary).toBe(true);
    const copy = { project: cloneDetachedDraft(ctx.project) };
    // When
    const applied = runTool(copy, "apply_spatial_build", { previewId: previewId(read.data) });
    // Then
    expect(applied.ok, applied.summary).toBe(true);
    expect(copy.project.maps["spatial:ai-room"]).toBeDefined();
  });
});
