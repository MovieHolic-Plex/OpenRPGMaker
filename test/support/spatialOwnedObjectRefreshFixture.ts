import { compileSpatialOccurrence } from "../../src/editor/spatial/compileSpatialOccurrence";
import { own, requireOccurrenceAssociations, spatialId } from "../../src/project/spatial/domain";
import { instantiateSpatialDesign } from "../../src/project/spatial/instances";
import type { Project, SectionStructureKitDef } from "../../src/project/types";
import { fixtureDocument, interiorAtlas, objectStampFixture } from "./spatialSpaceCompilerFixture";

export const selectedObject = spatialId("opaque-selected-object");
export const siblingObject = spatialId("opaque-sibling-object");
export const refreshTarget = { mapId: "stamp-target", rect: { x: 3, y: 3, width: 4, height: 4 }, entry: { x: 1, y: 1 } };
export const refreshCompile = { occurrenceId: selectedObject, target: refreshTarget };
export const replacementKit: SectionStructureKitDef = {
  id: "fixture-asymmetric", name: "Changed mixed hearth", kind: "section", width: 3, height: 3, learnedFrom: "db-authored",
  rows: [
    { tiles: [403, 402, -1], upperTiles: [-1, -1, 404] },
    { tiles: [434, -1, 432], upperTiles: [-1, 433, -1] },
    { tiles: [-1, -1, -1], upperTiles: [464, 124, 462] },
  ],
};

/** Two real compiled instances, plus unmanaged content inside and outside the selected rectangle. */
export function ownedObjectRefreshFixture(): Project {
  const input = objectStampFixture().project;
  const document = fixtureDocument(input);
  const source = own(document.library.objects, "hearth-design");
  input.spatialAuthoring = { ...document, occurrences: {}, rootOccurrenceIds: [], library: { ...document.library,
    objects: { ...document.library.objects, [source.id]: { ...source,
      anchors: [{ id: spatialId("approach"), name: "Approach", x: 0, y: 3 }] } } } };
  for (const rootId of [selectedObject, siblingObject]) {
    input.spatialAuthoring = instantiateSpatialDesign(fixtureDocument(input), input, {
      source: { kind: "object", id: source.id }, rootId, x: 0, y: 0, level: 0, seed: 19, generatorVersion: "refresh-fixture-v1",
    });
  }
  const associated = fixtureDocument(input);
  const selected = requireOccurrenceAssociations(own(associated.occurrences, selectedObject));
  input.spatialAuthoring = { ...associated, occurrences: { ...associated.occurrences, [selected.id]: {
    ...selected, snapshot: { ...selected.snapshot, ports: selected.snapshot.ports.map(port => ({ ...port, id: spatialId("opaque-retained-port") })) },
  } } };
  // These cells are in the reserved rectangle but never part of the graphic footprint.
  const map = own(input.maps, refreshTarget.mapId);
  map.upperTiles[4 * map.width + 6] = 124;
  map.lowerTileStacks = { [5 * map.width + 6]: [124], 0: [124] };
  map.upperTileStacks = { [5 * map.width + 6]: [124], 0: [124] };
  const first = compileSpatialOccurrence(input, refreshCompile);
  const compiled = compileSpatialOccurrence(first, { occurrenceId: siblingObject,
    target: { ...refreshTarget, rect: { ...refreshTarget.rect, x: 9 } } });
  const compiledMap = own(compiled.maps, refreshTarget.mapId);
  const event = compiledMap.events[0];
  if (!event) throw new TypeError("Expected actual compiled event");
  compiledMap.events.push({ ...structuredClone(event), id: "unmanaged-inside", x: 6, y: 6 },
    { ...structuredClone(event), id: "unmanaged-outside", x: 0, y: 0 });
  return compiled;
}

/** Explicit source edit after both instances have been frozen and compiled. */
export function changeOwnedObjectSource(project: Project, kit: SectionStructureKitDef = replacementKit): void {
  const atlas = own(project.tilesets, interiorAtlas);
  atlas.structureKits = (atlas.structureKits ?? []).map(value => value.id === kit.id ? structuredClone(kit) : value);
  const document = fixtureDocument(project);
  const source = own(document.library.objects, "hearth-design");
  project.spatialAuthoring = { ...document, library: { ...document.library, objects: { ...document.library.objects,
    [source.id]: { ...source, revision: 2 } } } };
}
