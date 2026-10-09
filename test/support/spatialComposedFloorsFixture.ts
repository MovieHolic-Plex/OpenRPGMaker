import { createNewPlace } from "../../src/editor/panels/spatialNewPlace";
import { preparePlaceRoom } from "../../src/editor/panels/spatialPlaceRooms";
import { instantiateSpatialDesign } from "../../src/project/spatial/instances";
import { compileSpatialOccurrence } from "../../src/editor/spatial/compileSpatialOccurrence";
import { spatialId } from "../../src/project/spatial/domain";
import { spaceCompilerFixture, interiorAtlas } from "./spatialSpaceCompilerFixture";

/** Minimal contract fixture only; never installed as authored example content. */
export function composedPlaceFloorsFixture() {
  const created = createNewPlace(spaceCompilerFixture(), { name: "층별 그림 보존", kind: "building", width: 12, height: 8, tilesetId: interiorAtlas });
  const target = { cardId: created.source.id, localId: created.source.id, name: "층별 그림 보존", source: "own" as const, libraryId: created.source.id };
  const prepared = preparePlaceRoom(created.project, target, { name: "2층", kind: "interior", width: 10, height: 8, tilesetId: interiorAtlas }, 2);
  const project = prepared.project;
  const library = project.spatialAuthoring!.library;
  const building = library.places[created.source.id];
  const first = library.spaces[building.children[0].source.id];
  const second = library.spaces[building.children[1].source.id];
  library.spaces[first.id] = { ...first, composition: { tilesetId: interiorAtlas, width: 16, height: 14,
    tiles: [{ x: 3, y: 5, layer: "lower", tile: 240 }], members: [{ id: spatialId("painted-bed"), source: { kind: "object", id: spatialId("bed-design") }, x: 5, y: 6, level: 0 }] } };
  library.places[building.id] = { ...building, connections: [{ id: spatialId("floor-stairs"),
    from: { childId: building.children[0].id, portId: first.ports[0].id },
    to: { childId: building.children[1].id, portId: second.ports[0].id }, bidirectional: true }] };
  project.spatialAuthoring = instantiateSpatialDesign(project.spatialAuthoring, project, { source: created.source, rootId: "painted-floors", x: 0, y: 0, level: 0, seed: 7, generatorVersion: "painted-floors-v1" });
  const compiled = compileSpatialOccurrence(project, { occurrenceId: "painted-floors" });
  return { compiled, first, second };
}
