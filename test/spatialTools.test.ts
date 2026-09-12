import { describe, expect, it } from "vitest";
import { runTool, runToolDefinition } from "@/editor/tools/toolRunner";
import { allTools } from "@/editor/tools/toolRegistry";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { own, spatialId } from "@/project/spatial/domain";
// 정주지 스탬프는 등록 훅 경유 — builder 모듈 로드가 bindSettlementVillageBuild를 실행한다.
import "@/editor/tools/village/builder";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { fixtureDocument, spaceCompilerFixture, spaceDesign } from "./support/spatialSpaceCompilerFixture";
import { geographyRoot } from "./support/spatialGeographyFixture";
import { geographyRecipeFixture } from "./support/spatialGeographyRecipes";
import { placeCompilerFixture } from "./support/spatialPlaceCompilerFixture";

function previewId(data: unknown): string {
  if (typeof data !== "object" || data === null || !("previewId" in data) || typeof data.previewId !== "string") throw new TypeError("Missing issued preview ID");
  return data.previewId;
}
const build = { kind: "space", id: spaceDesign, occurrenceId: "ai-room", seed: 17 };

describe("registered canonical spatial tools", () => {
  it("exposes the seven native tools when the registry is queried", () => {
    // Given / When
    const names = allTools().filter(tool => !tool.deprecated).map(tool => tool.name);
    // Then
    expect(names).toEqual(expect.arrayContaining(["list_spatial_designs", "get_geography_vocabulary", "get_spatial_design", "upsert_spatial_design", "preview_spatial_build", "apply_spatial_build", "edit_spatial_occurrence"]));
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
  it("returns a narrow design body without the resolved closure when asked", () => {
    // Given
    const project = spaceCompilerFixture();
    // When
    const result = runTool({ project }, "get_spatial_design", { kind: "space", id: spaceDesign, resolved: false });
    // Then — the body alone is the upsert revision round-trip payload.
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ kind: "space", design: { id: spaceDesign, revision: 1 } });
    expect(result.data).not.toHaveProperty("resolved");
  });
  it("discovers tagged exterior objects beyond prompt samples and preserves complete place bodies", () => {
    const project = placeCompilerFixture();
    const document = fixtureDocument(project);
    const exterior = own(document.library.objects, "hearth-design");
    const facility = own(document.library.places, "nested-inn-design");
    const objects = Object.fromEntries(Array.from({ length: 40 }, (_, index) => {
      const id = spatialId(`unrelated-prop-${index}`);
      return [id, { ...exterior, id, name: `Unrelated prop ${index}` }];
    }));
    const savedExterior = { ...exterior, name: "붉은 지붕", tags: ["건물 외형", "주택", "HOUSE"] };
    const savedFacility = { ...facility, name: "작은 주택", tags: ["주택"], exterior: savedExterior.graphic };
    project.spatialAuthoring = { ...document, library: { ...document.library,
      objects: { ...objects, ...document.library.objects, [savedExterior.id]: savedExterior },
      places: { ...document.library.places, [savedFacility.id]: savedFacility },
    } };
    const before = JSON.stringify(project);
    for (const query of ["건물 외형", "붉은 지붕", "house", savedExterior.id]) {
      const result = runTool({ project }, "list_spatial_designs", { kind: "object", query });
      expect(result.ok, result.summary).toBe(true);
      expect(result.data).toMatchObject({ active: true, designs: [expect.objectContaining({
        ...savedExterior, kind: "object", children: [],
      })] });
    }
    const list = runTool({ project }, "list_spatial_designs", { kind: "place", query: "주택" });
    expect(list.ok, list.summary).toBe(true);
    expect(list.data).toMatchObject({ active: true, designs: [expect.objectContaining({
      id: savedFacility.id, kind: "place", placeKind: "facility", exterior: savedExterior.graphic,
    })] });
    const read = runTool({ project }, "get_spatial_design", { kind: "place", id: savedFacility.id, resolved: false });
    expect(read.ok, read.summary).toBe(true);
    expect(read.data).toEqual({ kind: "place", design: savedFacility });
    expect(JSON.stringify(project)).toBe(before);
    // A get body remains directly usable for a source revision update, including facility kind and child geometry.
    const ctx = { project };
    const updated = runTool(ctx, "upsert_spatial_design", { kind: "place", expectedRevision: 1,
      place: { ...savedFacility, revision: 2 } });
    expect(updated.ok, updated.summary).toBe(true);
    expect(ctx.project.spatialAuthoring?.library.places[savedFacility.id]).toEqual({ ...savedFacility, revision: 2 });
    expect(ctx.project.spatialAuthoring?.library.objects[savedExterior.id]).toEqual(savedExterior);
    expect(ctx.project.spatialAuthoring?.occurrences).toEqual(document.occurrences);
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

describe("edit_spatial_occurrence lifecycle", () => {
  function fixture() {
    const project = geographyRecipeFixture("lake-country");
    const document = fixtureDocument(project);
    const root = own(document.occurrences, geographyRoot);
    const child = Object.values(document.occurrences).find(entry => entry.parentId === root.id);
    if (!child) throw new TypeError("Missing region child occurrence");
    return { project, document, root, child };
  }
  it("rejects every lifecycle operation on a legacy project", () => {
    // Given / When
    const result = runTool({ project: createBlankProject() }, "edit_spatial_occurrence", { operation: "refresh", occurrenceId: "x" });
    // Then
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("spatial-inactive");
  });
  it("moves a region child inside its world parent and recompiles the containing map", () => {
    // Given — a world occurrence: region children have no authored polyline endpoints to break.
    const project = geographyRecipeFixture("lake-kingdom");
    const document = fixtureDocument(project);
    const root = own(document.occurrences, geographyRoot);
    const child = Object.values(document.occurrences).find(entry => entry.parentId === root.id);
    if (!child) throw new TypeError("Missing world child occurrence");
    const ctx = { project };
    const before = JSON.stringify(project);
    // When
    const result = runTool(ctx, "edit_spatial_occurrence", { operation: "move", occurrenceId: child.id, x: child.x + 4, y: child.y });
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(own(fixtureDocument(ctx.project).occurrences, child.id).x).toBe(child.x + 4);
    expect(JSON.stringify(project)).toBe(before);
  });
  it("rejects a move that strands an authored route endpoint", () => {
    // Given — lake-country's places anchor the authored-road polyline endpoints.
    const { project, child } = fixture();
    const ctx = { project };
    const before = JSON.stringify(project);
    // When
    const result = runTool(ctx, "edit_spatial_occurrence", { operation: "move", occurrenceId: child.id, x: child.x + 4, y: child.y });
    // Then
    expect(result.ok).toBe(false);
    expect(JSON.stringify(project)).toBe(before);
  });
  it("rejects moving a root occurrence or a non-geography child", () => {
    // Given
    const { project, document, root } = fixture();
    const ctx = { project };
    const spaceChild = Object.values(document.occurrences).find(entry => entry.kind === "space" && entry.parentId !== null);
    if (!spaceChild) throw new TypeError("Missing nested space occurrence");
    const before = JSON.stringify(ctx.project);
    // When
    const rootMove = runTool(ctx, "edit_spatial_occurrence", { operation: "move", occurrenceId: root.id, x: 0, y: 0 });
    const nestedMove = runTool(ctx, "edit_spatial_occurrence", { operation: "move", occurrenceId: spaceChild.id, x: 0, y: 0 });
    // Then
    for (const result of [rootMove, nestedMove]) {
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("invalid-args");
    }
    expect(JSON.stringify(ctx.project)).toBe(before);
  });
  it("rejects delete while incoming links exist, then removes them explicitly", () => {
    // Given
    const { project, child } = fixture();
    const ctx = { project };
    const before = JSON.stringify(ctx.project);
    // When
    const rejected = runTool(ctx, "edit_spatial_occurrence", { operation: "delete", occurrenceId: child.id });
    // Then
    expect(rejected.ok).toBe(false);
    expect(JSON.stringify(ctx.project)).toBe(before);
    // When — the model reads the failure and passes the explicit policy.
    const removed = runTool(ctx, "edit_spatial_occurrence", { operation: "delete", occurrenceId: child.id, externalConnections: "remove" });
    // Then
    expect(removed.ok, removed.summary).toBe(true);
    expect(fixtureDocument(ctx.project).occurrences[child.id]).toBeUndefined();
  });
  it("refreshes a region root from its source revision", () => {
    // Given
    const { project, root } = fixture();
    const ctx = { project };
    // When
    const result = runTool(ctx, "edit_spatial_occurrence", { operation: "refresh", occurrenceId: root.id });
    // Then
    expect(result.ok, result.summary).toBe(true);
    const after = fixtureDocument(ctx.project);
    const refreshed = own(after.occurrences, root.id);
    expect(refreshed.source).toEqual(root.source);
    const binding = refreshed.bindings.find(entry => "mapId" in entry);
    if (!binding || !("mapId" in binding)) throw new TypeError("Missing refreshed map binding");
    expect(ctx.project.maps[binding.mapId]).toBeDefined();
  });
  it("rejects refreshing an object occurrence with the stamp guidance", () => {
    // Given
    const { project, document } = fixture();
    const objectOccurrence = Object.values(document.occurrences).find(entry => entry.kind === "object");
    if (!objectOccurrence) throw new TypeError("Missing object occurrence");
    // When
    const result = runTool({ project }, "edit_spatial_occurrence", { operation: "refresh", occurrenceId: objectOccurrence.id });
    // Then
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("unsupported");
  });
  it("clones a region occurrence into a standalone compiled copy", () => {
    // Given
    const { project, root } = fixture();
    const ctx = { project };
    // When
    const result = runTool(ctx, "edit_spatial_occurrence", { operation: "clone", occurrenceId: root.id, newOccurrenceId: "lake-country-copy" });
    // Then
    expect(result.ok, result.summary).toBe(true);
    const after = fixtureDocument(ctx.project);
    expect(after.rootOccurrenceIds).toContain("lake-country-copy");
    expect(own(after.occurrences, "lake-country-copy").source).toEqual(root.source);
  });
  it("unlinks and relinks a document connection through the shared ancestor compile", () => {
    // Given
    const { project, document } = fixture();
    const ctx = { project };
    const link = document.connections.find(entry => entry.overviewRoute === undefined);
    if (!link) throw new TypeError("Missing document connection");
    // When
    const unlinked = runTool(ctx, "edit_spatial_occurrence", { operation: "unlink", connectionId: link.id });
    // Then
    expect(unlinked.ok, unlinked.summary).toBe(true);
    expect(fixtureDocument(ctx.project).connections.some(entry => entry.id === link.id)).toBe(false);
    // When
    const relinked = runTool(ctx, "edit_spatial_occurrence", { operation: "link",
      connection: { id: link.id, from: link.from, to: link.to, bidirectional: link.bidirectional } });
    // Then
    expect(relinked.ok, relinked.summary).toBe(true);
    expect(fixtureDocument(ctx.project).connections.some(entry => entry.id === link.id)).toBe(true);
  });
  it("rejects unlinking a compiled geography route connection", () => {
    // Given
    const { project, document } = fixture();
    const route = document.connections.find(entry => entry.overviewRoute !== undefined);
    if (!route) throw new TypeError("Missing overview route connection");
    const before = JSON.stringify(project);
    // When
    const result = runTool({ project }, "edit_spatial_occurrence", { operation: "unlink", connectionId: route.id });
    // Then
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("unsupported");
    expect(JSON.stringify(project)).toBe(before);
  });
  it("rejects a missing required field with a typed error before any mutation", () => {
    // Given
    const { project } = fixture();
    const before = JSON.stringify(project);
    // When — delete without occurrenceId, clone without newOccurrenceId.
    const missing = runTool({ project }, "edit_spatial_occurrence", { operation: "delete" });
    const clone = runTool({ project }, "edit_spatial_occurrence", { operation: "clone", occurrenceId: "lake-country-copy" });
    // Then
    for (const result of [missing, clone]) {
      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("invalid-args");
    }
    expect(JSON.stringify(project)).toBe(before);
  });
});
