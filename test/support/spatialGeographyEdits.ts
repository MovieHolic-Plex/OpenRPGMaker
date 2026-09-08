import { own } from "../../src/project/spatial/domain";
import { instantiateSpatialDesign } from "../../src/project/spatial/instances";
import type { RegionDesign, WorldDesign } from "../../src/project/spatial/types";
import { geographyFixture, geographyRegion, geographyRoot, geographyWorld } from "./spatialGeographyFixture";
import { fixtureDocument } from "./spatialSpaceCompilerFixture";

export function editedRegion(update: (region: RegionDesign) => RegionDesign) {
  const project = geographyFixture("region");
  const document = fixtureDocument(project);
  const region = update(own(document.library.regions, geographyRegion));
  project.spatialAuthoring = instantiateSpatialDesign({ ...document, occurrences: {}, rootOccurrenceIds: [], connections: [],
    library: { ...document.library, regions: { [region.id]: region } } }, project,
  { source: { kind: "region", id: region.id }, rootId: geographyRoot, x: 0, y: 0, level: 0, seed: 7, generatorVersion: "task10-test" });
  return project;
}
export function editedWorld(update: (world: WorldDesign) => WorldDesign) {
  const project = geographyFixture("world");
  const document = fixtureDocument(project);
  const world = update(own(document.library.worlds, geographyWorld));
  project.spatialAuthoring = instantiateSpatialDesign({ ...document, occurrences: {}, rootOccurrenceIds: [], connections: [],
    library: { ...document.library, worlds: { [world.id]: world } } }, project,
  { source: { kind: "world", id: world.id }, rootId: geographyRoot, x: 0, y: 0, level: 0, seed: 7, generatorVersion: "task10-test" });
  return project;
}
