import { resolveMaterialSlots } from "../../src/editor/operators/materialSlots";
import { own, spatialId } from "../../src/project/spatial/domain";
import { instantiateSpatialDesign } from "../../src/project/spatial/instances";
import { fixtureDocument } from "./spatialSpaceCompilerFixture";
import { placeCompilerFixture, placeRoot } from "./spatialConnectionSceneFixture";

/** Extends task33's single nested-scene authority with a frozen numeric exterior. */
export function exteriorPlaceFixture(connected = false) {
  const project = placeCompilerFixture();
  const document = fixtureDocument(project);
  const atlas = own(project.tilesets, "easyrpg_chipset_combined_town");
  const materials = resolveMaterialSlots(atlas);
  const ground = materials.ground?.body ?? materials.ground?.tiles[0];
  const upper = materials.tree?.pair?.top;
  if (ground === undefined || upper === undefined) throw new TypeError("Missing shipped outdoor materials");
  atlas.structureKits = [...atlas.structureKits ?? [], { id: "nested-exterior", kind: "section", width: 3, height: 3,
    learnedFrom: "db-authored", rows: [
      { tiles: [ground, ground, ground], upperTiles: [upper, -1, -1] },
      { tiles: [ground, ground, ground] }, { tiles: [ground, ground, ground] },
    ] }];
  const inn = own(document.library.places, "nested-inn-design");
  const village = own(document.library.places, "nested-village-design");
  project.spatialAuthoring = instantiateSpatialDesign({ ...document, occurrences: {}, connections: [], rootOccurrenceIds: [], library: {
    ...document.library, places: { ...document.library.places,
      [inn.id]: { ...inn, exterior: { tilesetId: atlas.id, kitId: "nested-exterior" },
        ports: [{ id: spatialId("door"), name: "Door", x: 2, y: 2 }],
        connections: connected ? [{ id: spatialId("door-to-room"), from: { childId: null, portId: spatialId("door") },
          to: { childId: spatialId("floor-1"), portId: spatialId("entry") }, bidirectional: true }] : [] },
      [village.id]: { ...village, kind: "natural" },
    },
  } }, project, { source: { kind: "place", id: village.id }, rootId: placeRoot,
    x: 0, y: 0, level: 0, seed: 7, generatorVersion: "task9-exterior-v1" });
  return project;
}
