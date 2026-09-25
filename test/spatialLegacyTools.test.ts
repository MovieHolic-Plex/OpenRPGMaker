import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import { resolveHouseConcept, bindInteriorConceptPlan } from "@/editor/interiorConceptPlan";
import { convertLegacySpatialSnapshot } from "@/project/spatial/legacyImport";
import { own, spatialId } from "@/project/spatial/domain";
import { preparedProject, exteriorSingle } from "./support/authorHouseFacadeFixture";
import { runAuthorHouse } from "@/editor/tools/authorHouseFacade";
import { createVillageHouseInteriors } from "@/editor/tools/village/interiors";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";

function canonicalHouse() {
  const source = preparedProject();
  const converted = convertLegacySpatialSnapshot(JSON.stringify(source));
  const project = { ...source, spatialAuthoring: converted.raw.spatialAuthoring };
  const document = project.spatialAuthoring;
  const house = Object.values(document.library.places).find(design => design.name === "민가");
  if (!house) throw new TypeError("Missing migrated house");
  const spaces = Object.fromEntries(Object.entries(document.library.spaces).map(([id, space]) => [id, { ...space,
    objectSlots: space.objectSlots.filter(slot => own(document.library.objects, slot.objectDesignId).graphic.kitId !== "bed_v"),
  }]));
  // Canonical navigation is authored, not inferred from legacy floor labels. Give the fixture an explicit room chain.
  for (const child of house.children) {
    if (child.source.kind !== "space") throw new TypeError("Expected room fixture");
    const room = own(spaces, child.source.id);
    spaces[room.id] = { ...room, ports: [
      { id: spatialId("entry"), name: "Entry", x: Math.floor(room.width / 2), y: room.height - 1 },
      { id: spatialId("exit"), name: "Exit", x: Math.floor(room.width / 2) - 1, y: room.height - 1 },
    ] };
  }
  const connections = house.children.flatMap((child, index) => {
    const next = house.children[index + 1];
    return next ? [{ id: spatialId(`room-link-${index}`), from: { childId: child.id, portId: spatialId("exit") },
      to: { childId: next.id, portId: spatialId("entry") }, bidirectional: true }] : [];
  });
  project.spatialAuthoring = { ...document, library: { ...document.library, spaces, places: { ...document.library.places,
    [house.id]: { ...house, name: "Canonical dwelling", revision: 2, connections },
  } } };
  own(project.tilesets, INTERIOR_ROOM_TILESET_ID).scratchConceptBundles = [];
  return { project, house };
}

describe("legacy tools with active canonical designs", () => {
  it("looks up the canonical source rather than retired empty catalogs", () => {
    // Given
    const { project, house } = canonicalHouse();
    const before = JSON.stringify(project);
    // When
    const result = runTool({ project }, "get_concept_facility", { query: "house" });
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ canonical: { kind: "place", design: { id: house.id, revision: 2 } } });
    expect(JSON.stringify(project)).toBe(before);
  });
  it("places canonical sources without reviving retired furniture", () => {
    // Given
    const { project, house } = canonicalHouse();
    const ctx = { project };
    // When
    const result = runTool(ctx, "place_concept", { query: "house", mapId: "canonical-house", seed: 7 });
    // Then
    expect(result.ok, result.summary).toBe(true);
    const occurrence = ctx.project.spatialAuthoring?.occurrences["canonical-house"];
    expect(occurrence?.source).toEqual({ kind: "place", id: house.id, revision: 2 });
    expect(Object.values(ctx.project.spatialAuthoring?.occurrences ?? {}).filter(value => value.kind === "object")
      .some(value => value.snapshot.library.objects[value.source.id]?.graphic.kitId === "bed_v")).toBe(false);
  });
  it("resolves linked house and village program content from canonical definitions", () => {
    // Given
    const { project } = canonicalHouse();
    // When
    const result = resolveHouseConcept(project, "dwelling");
    // Then
    expect(result.facility.label).toBe("Canonical dwelling");
    expect(result.bundle.things.some(thing => thing.objectId === "bed_v")).toBe(false);
  });
  it("builds linked houses with frozen canonical occurrences through the actual facade", () => {
    // Given
    const { project } = canonicalHouse();
    const ctx = { project };
    // When
    const result = runAuthorHouse(ctx, { ...exteriorSingle, interior: "linked-interior", ownerName: "주민" });
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(Object.values(ctx.project.spatialAuthoring.occurrences).some(occurrence => occurrence.kind === "place")).toBe(true);
    const transfers = Object.values(ctx.project.maps).flatMap(map => map.events.flatMap(event => event.pages?.flatMap(page => page.commands) ?? []))
      .filter(command => command.kind === "transfer");
    expect(transfers.some(command => command.mapId === "m1")).toBe(true);
    expect(transfers.every(command => Object.hasOwn(ctx.project.maps, command.mapId))).toBe(true);
  });
  it("builds village-linked interiors from the same canonical frozen source", () => {
    // Given
    const { project } = canonicalHouse();
    // When
    const refs = createVillageHouseInteriors(project, own(project.maps, "m1"), [{
      kitId: "blue-stone", templateId: "rect", bbox: { x: 3, y: 3, w: 8, h: 6 },
      doorAt: { x: 6, y: 8 }, front: { x: 6, y: 9 }, stories: 1, ownerName: "주민",
    }], [], 7);
    // Then
    expect(refs).toHaveLength(1);
    expect(Object.values(project.spatialAuthoring.occurrences).some(occurrence => occurrence.kind === "place")).toBe(true);
    expect(refs.every(ref => Object.hasOwn(project.maps, ref.interiorMapId))).toBe(true);
  });
  it("authors a village through the registered facade with canonical interiors", () => {
    // Given
    const { project } = canonicalHouse();
    const ctx = { project };
    // When
    const result = runTool(ctx, "author_village", { target: { kind: "existing", mapId: "m1", fullMap: true },
      houseCount: 2, countPolicy: "exact", npcCount: 0, seed: 7, interior: true,
      housePlans: [{ kitId: "blue-stone", ownerName: "하린", program: "dwelling" }, { kitId: "bright-plaster", ownerName: "도윤", program: "dwelling" }],
    });
    // Then
    expect(result.ok, `${result.summary} ${JSON.stringify(result.issues)}`).toBe(true);
    expect(Object.values(ctx.project.spatialAuthoring.occurrences).filter(occurrence => occurrence.parentId === null)).toHaveLength(2);
    expect(ctx.project.spatialAuthoring.library).toEqual(project.spatialAuthoring.library);
  });
  it("rejects disconnected canonical house interiors without publishing partial maps", () => {
    // Given
    const { project, house } = canonicalHouse();
    const current = own(project.spatialAuthoring.library.places, house.id);
    project.spatialAuthoring = { ...project.spatialAuthoring, library: { ...project.spatialAuthoring.library,
      places: { ...project.spatialAuthoring.library.places, [house.id]: { ...current, connections: [] } },
    } };
    const ctx = { project };
    const before = JSON.stringify(project);
    // When
    const result = runAuthorHouse(ctx, { ...exteriorSingle, interior: "linked-interior", ownerName: "주민" });
    // Then
    expect(result.ok).toBe(false);
    expect(JSON.stringify(ctx.project)).toBe(before);
  });
  it("binds ordinary interior rooms to canonical selections", () => {
    // Given
    const { project } = canonicalHouse();
    // When
    const plan = bindInteriorConceptPlan({ mapId: "room", name: "Room", seed: 7, width: 16, height: 14, theme: "bedroom", wings: [],
      rooms: [{ id: "room", theme: "bedroom", x: 3, y: 4, w: 9, h: 6 }], door: { x: 7, y: 9 } }, project);
    // Then
    expect(plan.concept?.rooms.room?.things.some(thing => thing.objectId === "bed_v")).toBe(false);
  });
  it("an empty legacy bundle falls back to the bundled house but still demands a plan without writing", () => {
    // Given
    const project = preparedProject();
    own(project.tilesets, INTERIOR_ROOM_TILESET_ID).scratchConceptBundles = [];
    const before = JSON.stringify(project);
    // When
    const result = runTool({ project }, "place_concept", { query: "house", mapId: "empty-house" });
    // Then
    expect(result.ok).toBe(false);
    expect(result.issues?.some(issue => issue.code === "concept-plan-required")).toBe(true);
    expect(JSON.stringify(project)).toBe(before);
  });
});
