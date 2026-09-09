import { checkedDocument, own, spatialId } from "../../src/project/spatial/domain";
import { instantiateSpatialDesign } from "../../src/project/spatial/instances";
import type { RegionDesign, WorldDesign } from "../../src/project/spatial/types";
import { placeCompilerFixture, placeRoot } from "./spatialPlaceCompilerFixture";
import { fixtureDocument } from "./spatialSpaceCompilerFixture";

export const geographyRoot = spatialId("geography-contract-root");
export const geographyRegion = spatialId("geography-contract-region");
export const geographyWorld = spatialId("geography-contract-world");

/** Minimal contract input, not a shipped region recipe or a sample-world substitute. */
export function geographyFixture(kind: "region" | "world", seed = 7) {
  const project = placeCompilerFixture(seed);
  const source = fixtureDocument(project);
  const villageId = own(source.occurrences, placeRoot).source.id;
  const village = own(source.library.places, villageId);
  const base = { revision: 1, tags: [], provenance: { origin: "user" } } as const;
  const region: RegionDesign = { ...base, id: geographyRegion, name: "Contract region",
    terrain: { tilesetId: "easyrpg_chipset_world", width: 32, height: 24, floor: "ground", areas: [] },
    places: [
      { id: spatialId("west"), source: { kind: "place", id: villageId }, x: 5, y: 8, level: 0 },
      { id: spatialId("east"), source: { kind: "place", id: villageId }, x: 25, y: 8, level: 0 },
    ],
    ports: [{ id: spatialId("entry"), name: "Entry", x: 2, y: 8 }],
    routes: [{ id: spatialId("road"), from: { childId: spatialId("west"), portId: spatialId("entry") },
      to: { childId: spatialId("east"), portId: spatialId("entry") }, bidirectional: true,
      points: [{ x: 5, y: 8 }, { x: 25, y: 8 }] }],
  };
  const world: WorldDesign = { ...base, id: geographyWorld, name: "Contract world", terrain: region.terrain,
    regions: [
      { id: spatialId("first"), source: { kind: "region", id: geographyRegion }, x: 6, y: 10, level: 0 },
      { id: spatialId("second"), source: { kind: "region", id: geographyRegion }, x: 26, y: 10, level: 0 },
    ], ports: [{ id: spatialId("entry"), name: "Entry", x: 2, y: 10 }],
    connections: [{ id: spatialId("crossing"), from: { childId: spatialId("first"), portId: spatialId("entry") },
      to: { childId: spatialId("second"), portId: spatialId("entry") }, bidirectional: true }],
    entryPort: { childId: spatialId("first"), portId: spatialId("entry") },
  };
  const document = checkedDocument({ ...source, occurrences: {}, rootOccurrenceIds: [], connections: [], library: {
    ...source.library,
    places: { ...source.library.places, [villageId]: { ...village,
      ports: [{ id: spatialId("entry"), name: "Entry", x: 12, y: 17 }] } },
    regions: { [region.id]: region }, worlds: { [world.id]: world },
  } }, project);
  project.spatialAuthoring = instantiateSpatialDesign(document, project, {
    source: { kind, id: kind === "region" ? region.id : world.id }, rootId: geographyRoot,
    x: 0, y: 0, level: 0, seed, generatorVersion: "task10-contract-v1",
  });
  return project;
}
