import { describe, expect, it } from "vitest";
import { runTool, runToolDefinition } from "@/editor/tools/toolRunner";
import { allTools } from "@/editor/tools/toolRegistry";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { own, spatialId } from "@/project/spatial/domain";
// 정주지 스탬프는 등록 훅 경유 — builder 모듈 로드가 bindSettlementVillageBuild를 실행한다.
import "@/editor/tools/village/builder";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { fixtureDocument, spaceCompilerFixture, spaceDesign } from "./support/spatialSpaceCompilerFixture";

function previewId(data: unknown): string {
  if (typeof data !== "object" || data === null || !("previewId" in data) || typeof data.previewId !== "string") throw new TypeError("Missing issued preview ID");
  return data.previewId;
}
const build = { kind: "space", id: spaceDesign, occurrenceId: "ai-room", seed: 17 };

describe("registered canonical spatial tools", () => {
  it("exposes the six native tools when the registry is queried", () => {
    // Given / When
    const names = allTools().filter(tool => !tool.deprecated).map(tool => tool.name);
    // Then
    expect(names).toEqual(expect.arrayContaining(["list_spatial_designs", "get_geography_vocabulary", "get_spatial_design", "upsert_spatial_design", "preview_spatial_build", "apply_spatial_build"]));
  });
  it("reports inactive instead of throwing on a legacy project", () => {
    // Given
    const ctx = { project: createBlankProject() };
    // When
    const list = runTool(ctx, "list_spatial_designs", {});
    const get = runTool(ctx, "get_spatial_design", { kind: "space", id: "anything" });
    const upsert = runTool(ctx, "upsert_spatial_design", { kind: "space", expectedRevision: 0,
      space: { id: "x", name: "X", revision: 1, tags: [], provenance: { origin: "ai" }, environment: "interior",
        tilesetId: "easyrpg_chipset_interior", shape: "rect", width: 5, height: 4, floor: "wood", wall: "cream", ports: [], objectSlots: [] } });
    const preview = runTool(ctx, "preview_spatial_build", { kind: "space", id: "x", occurrenceId: "y", seed: 1 });
    // Then
    expect(list.ok, list.summary).toBe(true);
    expect(list.data).toMatchObject({ active: false, designs: [] });
    for (const result of [get, upsert, preview]) {
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("spatial-inactive");
    }
  });
  it("returns the geography vocabulary for region/world authoring", () => {
    // Given / When
    const result = runTool({ project: spaceCompilerFixture() }, "get_geography_vocabulary", {});
    // Then
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { terrain: { worldTilesetIds: string[]; materials: string[]; settlementTilesetId: string } };
    expect(data.terrain.worldTilesetIds).toContain("easyrpg_chipset_world");
    expect(data.terrain.materials).toEqual(expect.arrayContaining(["ground", "water", "dirt", "forest", "mountain"]));
    expect(data.terrain.settlementTilesetId).toBe("easyrpg_chipset_combined_town");
  });
  it("accepts a settlement region design through the schema and domain boundaries", () => {
    // Given
    const project = spaceCompilerFixture();
    project.villagePresets = [{ id: "fixture-preset", name: "시험 마을", houseCount: 1 }];
    const ctx = { project };
    const regionId = spatialId("ai-settlement-region");
    // When
    const result = runTool(ctx, "upsert_spatial_design", { kind: "region", expectedRevision: 0,
      region: { id: regionId, name: "AI 정주지", revision: 1, tags: [], provenance: { origin: "ai" },
        terrain: { tilesetId: "easyrpg_chipset_combined_town", width: 40, height: 32, floor: "ground", areas: [] },
        places: [], ports: [], routes: [], settlement: { presetId: "fixture-preset", seed: 7 } } });
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.spatialAuthoring?.library.regions[regionId]?.settlement).toEqual({ presetId: "fixture-preset", seed: 7 });
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
