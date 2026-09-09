import { createBlankProject } from "../../src/project/defaults/defaultProject";
import { checkedDocument, own, spatialId } from "../../src/project/spatial/domain";
import { duplicateSpatialOccurrence } from "../../src/project/spatial/duplicate";
import { appendToTree } from "../../src/project/mapTree";
import { CONCEPT_FLOOR_TILES } from "../../src/editor/conceptBundleResolve";
import { instantiateSpatialDesign } from "../../src/project/spatial/instances";
import { sha256HexTextSync } from "../../src/util/sha256";
import { resolveMaterialSlots } from "../../src/editor/operators/materialSlots";
import type { SpaceDesign, SpatialAuthoringDocument, SpatialOccurrence } from "../../src/project/spatial/types";
import type { Project } from "../../src/project/types";

export const spaceRoot = spatialId("compiler-room");
export const spaceDesign = spatialId("room-design");
export const interiorAtlas = "easyrpg_chipset_interior";

/** Numeric regression fixture only: shipped beds plus an authored asymmetric hearth assembly. */
export function spaceCompilerFixture(seed = 7, shape: SpaceDesign["shape"] = "rect"): Project {
  const project = createBlankProject();
  const tileset = project.tilesets[interiorAtlas];
  if (!tileset) throw new TypeError("Missing shipped interior atlas");
  tileset.structureKits = [...(tileset.structureKits ?? []), {
    id: "fixture-asymmetric", name: "Mixed hearth", kind: "section", width: 3, height: 3, learnedFrom: "db-authored",
    rows: [
      { tiles: [402, 403, 404] },
      { tiles: [432, -1, 434], upperTiles: [-1, 433, -1] },
      { tiles: [-1, -1, -1], upperTiles: [462, 124, 464] },
    ],
  }];
  const base = { revision: 1, tags: [], provenance: { origin: "user" } } as const;
  const object = (id: string, kitId: string) => ({ ...base, id: spatialId(id), name: id,
    graphic: { tilesetId: interiorAtlas, kitId }, anchors: [], chips: ["event"] });
  const room: SpaceDesign = { ...base, id: spaceDesign, name: "Compiler room", environment: "interior", role: "entrance",
    tilesetId: interiorAtlas, shape, width: 16, height: 12, floor: "wood", wall: "cream",
    ports: [{ id: spatialId("entry"), name: "Entry", x: 8, y: 11 }], objectSlots: [
      { id: spatialId("beds"), objectDesignId: spatialId("bed-design"), quantity: 2, required: true, placement: { mode: "auto" } },
      { id: spatialId("hearth"), objectDesignId: spatialId("hearth-design"), quantity: 1, required: true, placement: { mode: "fixed", x: 1, y: 4 } },
      { id: spatialId("stairs"), objectDesignId: spatialId("stair-design"), quantity: 1, required: true, placement: { mode: "fixed", x: 8, y: 11 } },
    ] };
  const digest = sha256HexTextSync("{}");
  const document = checkedDocument({ version: 1, library: { objects: {
    "bed-design": object("bed-design", "bed_v"), "hearth-design": object("hearth-design", "fixture-asymmetric"),
    "stair-design": { ...object("stair-design", "stairs_down"), chips: ["pass"],
      anchors: [{ id: spatialId("landing"), name: "Landing", x: 0, y: 0 }] },
  }, spaces: { [spaceDesign]: room }, places: {}, regions: {}, worlds: {} },
  occurrences: {}, rootOccurrenceIds: [], connections: [],
  legacyImport: { version: 1, sourceHash: digest, mapping: [], backup: { encoding: "raw-json", json: "{}", sha256: digest } },
  }, project);
  project.spatialAuthoring = instantiateSpatialDesign(document, project, {
    source: { kind: "space", id: spaceDesign }, rootId: spaceRoot, x: 0, y: 0, level: 0, seed, generatorVersion: "fixture-v1",
  });
  return project;
}

export function reinstantiateSpace(project: Project, update: (space: SpaceDesign) => SpaceDesign): Project {
  const document = fixtureDocument(project);
  const root = own(document.occurrences, spaceRoot);
  const space = update(own(document.library.spaces, spaceDesign));
  return { ...project, spatialAuthoring: instantiateSpatialDesign({ ...document, occurrences: {}, rootOccurrenceIds: [],
    library: { ...document.library, spaces: { [spaceDesign]: space } } }, project,
  { source: { kind: "space", id: spaceDesign }, rootId: spaceRoot, x: 0, y: 0, level: 0, seed: root.seed, generatorVersion: "fixture-v1" }) };
}

export function replaceOccurrence(project: Project, occurrence: SpatialOccurrence): Project {
  const document = fixtureDocument(project);
  return { ...project, spatialAuthoring: { ...document, occurrences: { ...document.occurrences, [occurrence.id]: occurrence } } };
}

export function outdoorCompilerFixture(seed = 7): Project {
  const project = spaceCompilerFixture(seed);
  const tilesetId = "easyrpg_chipset_combined_town";
  const tileset = own(project.tilesets, tilesetId);
  const slots = resolveMaterialSlots(tileset);
  const pair = slots.tree?.pair;
  const flower = slots.flower?.body ?? slots.flower?.tiles[0];
  if (!pair || flower === undefined) throw new TypeError("Shipped outdoor materials unavailable");
  tileset.structureKits = [...(tileset.structureKits ?? []),
    { id: "fixture-tree", kind: "section", width: 1, height: 2, learnedFrom: "db-authored", rows: [
      { tiles: [-1], upperTiles: [pair.top] }, { tiles: [-1], upperTiles: [pair.bottom] },
    ] },
    { id: "fixture-flower", kind: "section", width: 1, height: 1, learnedFrom: "db-authored", rows: [{ tiles: [-1], upperTiles: [flower] }] },
  ];
  const document = fixtureDocument(project);
  const base = { revision: 1, tags: [], provenance: { origin: "user" } } as const;
  const objects = Object.fromEntries(["tree", "flower"].map(name => [name, { ...base, id: spatialId(name), name,
    graphic: { tilesetId, kitId: `fixture-${name}` }, anchors: [], chips: [] }]));
  const space: SpaceDesign = { ...base, id: spaceDesign, name: "Outdoor fixture", tilesetId, environment: "outdoor",
    width: 20, height: 16, shape: "rect", floor: "ground", wall: "none",
    floorAreas: [
      { kind: "rect", material: "path", x: 0, y: 12, width: 20, height: 3 },
      { kind: "polygon", material: "shore", points: [{ x: 12, y: 1 }, { x: 18, y: 1 }, { x: 18, y: 7 }, { x: 15, y: 9 }, { x: 12, y: 7 }] },
    ], ports: [{ id: spatialId("entry"), name: "South", x: 10, y: 14 }, { id: spatialId("exit"), name: "East", x: 19, y: 13 }],
    objectSlots: [
      { id: spatialId("tree-slot"), objectDesignId: spatialId("tree"), quantity: 1, required: true, placement: { mode: "fixed", x: 2, y: 2 } },
      { id: spatialId("flower-slot"), objectDesignId: spatialId("flower"), quantity: 2, required: true, placement: { mode: "auto" } },
    ] };
  project.spatialAuthoring = instantiateSpatialDesign({ ...document, occurrences: {}, rootOccurrenceIds: [],
    library: { objects, spaces: { [spaceDesign]: space }, places: {}, regions: {}, worlds: {} } }, project,
  { source: { kind: "space", id: spaceDesign }, rootId: spaceRoot, x: 0, y: 0, level: 0, seed, generatorVersion: "fixture-v1" });
  return project;
}

export function objectStampFixture() {
  const project = spaceCompilerFixture();
  const document = fixtureDocument(project);
  const source = Object.values(document.occurrences).find(child => child.source.id === "hearth-design");
  if (!source) throw new TypeError("Missing hearth fixture");
  const rootId = spatialId("standalone-hearth");
  project.spatialAuthoring = duplicateSpatialOccurrence(document, project, { occurrenceId: source.id, rootId, externalConnections: "omit" });
  const map = { id: "stamp-target", name: "Stamp target", tilesetId: interiorAtlas, tileSize: 16, width: 16, height: 12,
    lowerTiles: new Array<number>(16 * 12).fill(CONCEPT_FLOOR_TILES.wood), upperTiles: new Array<number>(16 * 12).fill(-1), events: [] };
  project.maps[map.id] = map;
  appendToTree(project.mapTree, map.id);
  return { project, occurrenceId: rootId, target: { mapId: map.id, rect: { x: 3, y: 3, width: 3, height: 3 }, entry: { x: 1, y: 1 } } };
}

export function fixtureDocument(project: Project): SpatialAuthoringDocument {
  if (!project.spatialAuthoring) throw new TypeError("Missing fixture document");
  return project.spatialAuthoring;
}
