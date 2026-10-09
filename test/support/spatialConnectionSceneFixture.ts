import { checkedDocument, findOccurrenceChildId, own, resolveOccurrencePortId, spatialId } from "../../src/project/spatial/domain";
import { instantiateSpatialDesign } from "../../src/project/spatial/instances";
import type { PlaceDesign, SpatialConnection, SpatialId } from "../../src/project/spatial/types";
import type { Project } from "../../src/project/types";
import { fixtureDocument, outdoorCompilerFixture, spaceCompilerFixture, spaceDesign } from "./spatialSpaceCompilerFixture";

export const placeRoot = spatialId("nested-village");
const innDesignId = spatialId("nested-inn-design");
const villageDesignId = spatialId("nested-village-design");
const squareDesignId = spatialId("nested-square-design");

/** Actual stored nested children; no labels or opaque-ID parsing resolve an occurrence. */
export function placeCompilerFixture(seed = 7): Project {
  const project = outdoorCompilerFixture(seed);
  const outdoor = fixtureDocument(project);
  const interiorProject = spaceCompilerFixture(seed);
  const interior = fixtureDocument(interiorProject);
  const base = { revision: 1, tags: [], provenance: { origin: "user" } } as const;
  const inn: PlaceDesign = { ...base, id: innDesignId, name: "Inn", kind: "facility", layout: "manual", ports: [], connections: [],
    children: [1, 2, 3].map(level => ({ id: spatialId(`floor-${level}`), source: { kind: "space", id: spaceDesign },
      x: 3, y: 5, level })) };
  const village: PlaceDesign = { ...base, id: villageDesignId, name: "Village", kind: "settlement", layout: "manual", ports: [], connections: [],
    children: [
      { id: spatialId("square"), source: { kind: "space", id: squareDesignId }, x: 2, y: 3, level: 0 },
      { id: spatialId("inn"), source: { kind: "place", id: innDesignId }, x: 24, y: 8, level: 0 },
    ] };
  // Copy only fixture assets required by the frozen interior raster, not live composition at compile time.
  project.tilesets["easyrpg_chipset_interior"] = own(interiorProject.tilesets, "easyrpg_chipset_interior");
  const room = own(interior.library.spaces, spaceDesign);
  const upstairsSlot = { id: spatialId("stairs-up"), objectDesignId: spatialId("stair-up-design"), quantity: 1,
    required: true, placement: { mode: "fixed", x: 12, y: 11 } } as const;
  const upstairs = { ...own(interior.library.objects, "stair-design"), id: spatialId("stair-up-design"),
    graphic: { tilesetId: "easyrpg_chipset_interior", kitId: "stairs_small" } };
  const document = checkedDocument({ ...outdoor, occurrences: {}, rootOccurrenceIds: [], connections: [], library: {
    objects: { ...outdoor.library.objects, ...interior.library.objects, [upstairs.id]: upstairs },
    spaces: { [spaceDesign]: { ...room, objectSlots: [...room.objectSlots, upstairsSlot] },
      [squareDesignId]: { ...own(outdoor.library.spaces, spaceDesign), id: squareDesignId } },
    places: { [innDesignId]: inn, [villageDesignId]: village }, regions: {}, worlds: {},
  } }, project);
  project.spatialAuthoring = instantiateSpatialDesign(document, project, { source: { kind: "place", id: villageDesignId },
    rootId: placeRoot, x: 0, y: 0, level: 0, seed, generatorVersion: "task9-contract-v1" });
  return project;
}

export function placeChild(project: Project, parentId: SpatialId, slotId: string): SpatialId {
  const id = findOccurrenceChildId(fixtureDocument(project), parentId, { slotId: spatialId(slotId), index: 0 });
  if (!id) throw new TypeError(`Missing fixture child ${slotId}`);
  return id;
}

export function stairFloors(project: Project) {
  const innId = placeChild(project, placeRoot, "inn");
  return [1, 2, 3].map(level => {
    const roomId = placeChild(project, innId, `floor-${level}`);
    const stairId = placeChild(project, roomId, "stairs");
    const stair = own(fixtureDocument(project).occurrences, stairId);
    const upId = placeChild(project, roomId, "stairs-up");
    const up = own(fixtureDocument(project).occurrences, upId);
    return { level, roomId, stairId, portId: resolveOccurrencePortId(stair, spatialId("landing")),
      upId, upPortId: resolveOccurrencePortId(up, spatialId("landing")) };
  });
}

export function withStairConnections(project: Project): Project {
  const floors = stairFloors(project);
  const connections: SpatialConnection[] = floors.slice(1).map((upper, index) => {
    const lower = floors[index];
    if (!lower) throw new TypeError("Missing lower fixture floor");
    return { id: spatialId(`declared-stairs-${lower.level}-${upper.level}`), bidirectional: true,
      from: { occurrenceId: lower.upId, portId: lower.upPortId }, to: { occurrenceId: upper.stairId, portId: upper.portId } };
  });
  return { ...project, spatialAuthoring: checkedDocument({ ...fixtureDocument(project), connections }, project) };
}
