import { deserialize, serialize } from "@/project/io";
import { compileSpatialOccurrence } from "@/editor/spatial/compileSpatialOccurrence";
import { mixedFixture } from "./support/spatialMixedFixture";
import { getCanonicalConcept } from "@/editor/tools/spatialConceptTools";
import { expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { spaceCompilerFixture, spaceDesign } from "./support/spatialSpaceCompilerFixture";
import { SPATIAL_KIND_SCHEMA, SPATIAL_UPSERT_SCHEMA } from "@/editor/tools/spatialToolSchemas";
import { publicSpatialValue, storageSpatialDesign } from "@/editor/tools/spatialPlaceContract";
it("advertises a single place kind and body", () => {
  expect(SPATIAL_KIND_SCHEMA.enum).toEqual(["object", "place", "region", "world"]);
  expect(SPATIAL_UPSERT_SCHEMA.properties).not.toHaveProperty("space");
});
it("lists and reads historical rooms as places, including resolved references", () => {
  const ctx = { project: spaceCompilerFixture() };
  const list = runTool(ctx, "list_spatial_designs", { kind: "place" });
  expect(list.ok).toBe(true);
  expect((list.data as any).designs.some((d: any) => d.id === spaceDesign && d.kind === "place")).toBe(true);
  const get = runTool(ctx, "get_spatial_design", { kind: "place", id: spaceDesign });
  expect(get.ok, get.summary).toBe(true);
  expect(get.data).toMatchObject({ kind: "place", design: { environment: "interior" } });
  expect(JSON.stringify(get.data)).not.toContain('"kind":"space"');
  expect((get.data as any).resolved.snapshot.library).not.toHaveProperty("spaces");
});
it("round trips a room update and accepts the historical tool input", () => {
  const ctx = { project: spaceCompilerFixture() };
  const current = ctx.project.spatialAuthoring!.library.spaces[spaceDesign];
  const updated = { ...current, name: "새 방 이름", revision: current.revision + 1 };
  const upsert = runTool(ctx, "upsert_spatial_design", { kind: "place", expectedRevision: current.revision, place: updated });
  expect(upsert.ok, upsert.summary).toBe(true);
  expect(upsert.data).toMatchObject({ kind: "place", design: { name: "새 방 이름" } });
  const legacy = runTool(ctx, "get_spatial_design", { kind: "space", id: spaceDesign, resolved: false });
  expect(legacy.ok, legacy.summary).toBe(true);
  expect(legacy.data).toMatchObject({ kind: "place" });
  const preview = runTool(ctx, "preview_spatial_build", { kind: "place", id: spaceDesign, occurrenceId: "single-place-preview", seed: 7 });
  expect(preview.ok, preview.summary).toBe(true);
});
it("maps child place references by exact global identity rather than names", () => {
  const project = spaceCompilerFixture();
  const body = { id: "inn", children: [{ id: "room-slot", source: { kind: "place", id: spaceDesign }, x: 0, y: 0, level: 1 }] };
  expect(storageSpatialDesign(project, "place", body).design).toMatchObject({ children: [{ source: { kind: "space", id: spaceDesign } }] });
  expect(publicSpatialValue(body)).toEqual(body);
});

it("round trips painted place bodies and member references through the public tool schema", () => {
  const ctx = { project: mixedFixture() };
  const read = runTool(ctx, "get_spatial_design", { kind: "place", id: "inn", resolved: false });
  expect(read.ok, read.summary).toBe(true);
  const body = (read.data as any).design;
  expect(body.composition.members[0].source.kind).toBe("place");
  const save = runTool(ctx, "upsert_spatial_design", { kind: "place", expectedRevision: body.revision,
    place: { ...body, revision: body.revision + 1, name: "수정한 여관" } });
  expect(save.ok, save.summary).toBe(true);
  expect(ctx.project.spatialAuthoring!.library.places.inn.composition!.members[0].source.kind).toBe("space");
  expect(JSON.stringify(save.data)).not.toContain('"kind":"space"');
});
it("uses the same public place vocabulary in legacy concept discovery", () => {
  const result = getCanonicalConcept(spaceCompilerFixture(), {});
  expect(JSON.stringify(result.data)).not.toContain('"kind":"space"');
  expect((result.data as any).sources.some((source: any) => source.kind === "place")).toBe(true);
});
it("accepts a directly editable place as a region child through the unified contract", () => {
  const ctx = { project: structuredClone(spaceCompilerFixture()) };
  const room = ctx.project.spatialAuthoring!.library.spaces[spaceDesign];
  ctx.project.spatialAuthoring!.library.spaces[spaceDesign] = { ...room, composition: { tilesetId: room.tilesetId,
    width: room.width + 4, height: room.height + 6, tiles: [{ x: 3, y: 5, layer: "lower", tile: 240 }], members: [] } };
  const result = runTool(ctx, "upsert_spatial_design", { kind: "region", expectedRevision: 0, region: {
    id: "room-region", name: "방을 포함한 지역", revision: 1, tags: [], provenance: { origin: "user" },
    terrain: { tilesetId: "easyrpg_chipset_world", width: 20, height: 20, floor: "ground", areas: [] },
    places: [{ id: "region-room", source: { kind: "place", id: spaceDesign }, x: 4, y: 4, level: 0 }],
    ports: [{ id: "region-entry", name: "입구", x: 1, y: 1 }], routes: [{ id: "room-path", from: { childId: null, portId: "region-entry" }, to: { childId: "region-room", portId: ctx.project.spatialAuthoring!.library.spaces[spaceDesign].ports[0].id }, bidirectional: true, points: [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 4 }] }],
  } });
  expect(result.ok, result.summary).toBe(true);
  const build = runTool(ctx, "preview_spatial_build", { kind: "region", id: "room-region", occurrenceId: "region-with-room", seed: 7 });
  expect(build.ok, build.summary).toBe(true);
  const apply = runTool(ctx, "apply_spatial_build", { previewId: (build.data as any).previewId });
  expect(apply.ok, apply.summary).toBe(true);
  const read = deserialize(serialize(ctx.project));
  expect(read.mapConnections!.length).toBeGreaterThanOrEqual(2);
  expect(compileSpatialOccurrence(read, { occurrenceId: "region-with-room" }).maps).toEqual(read.maps);
});
