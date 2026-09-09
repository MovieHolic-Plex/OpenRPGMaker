import { checkedDocument, own, spatialId } from "../../src/project/spatial/domain";
import { instantiateSpatialDesign } from "../../src/project/spatial/instances";
import type { RegionDesign, SpatialFloorArea, SpatialLibrary, SpatialPoint, WorldDesign } from "../../src/project/spatial/types";
import { geographyFixture, geographyRoot } from "./spatialGeographyFixture";
import { fixtureDocument } from "./spatialSpaceCompilerFixture";
import { exteriorPlaceFixture } from "./spatialPlaceGeometryFixture";

// Contract terrain/topologies, not the task18 catalog or task19 published place content.
export const regionRecipes = [
  { id: "lake-country", places: ["lake-village", "working-mine"], floor: "ground",
    areas: [{ kind: "rect", x: 55, y: 0, width: 10, height: 96, material: "water" }],
    markers: [{ x: 20, y: 40 }, { x: 100, y: 40 }], points: [{ x: 20, y: 40 }, { x: 100, y: 40 }] },
  { id: "deep-forest", places: ["forest-hamlet", "forest-sanctuary"], floor: "ground",
    areas: [{ kind: "rect", x: 40, y: 24, width: 40, height: 40, material: "forest" }],
    markers: [{ x: 20, y: 40 }, { x: 100, y: 40 }], points: [{ x: 20, y: 40 }, { x: 20, y: 16 }, { x: 100, y: 16 }, { x: 100, y: 40 }] },
  { id: "harbor-coast", places: ["harbor-town", "warehouse"], floor: "sand",
    areas: [{ kind: "polygon", points: [{ x: 0, y: 60 }, { x: 60, y: 70 }, { x: 127, y: 60 }, { x: 127, y: 95 }, { x: 0, y: 95 }], material: "water" }],
    markers: [{ x: 20, y: 40 }, { x: 100, y: 40 }], points: [{ x: 20, y: 40 }, { x: 100, y: 40 }] },
  { id: "snow-frontier", places: ["snow-outpost", "hunter-cabin"], floor: "snow",
    areas: [{ kind: "rect", x: 30, y: 55, width: 70, height: 25, material: "snow-forest" }],
    markers: [{ x: 20, y: 40 }, { x: 100, y: 40 }], points: [{ x: 20, y: 40 }, { x: 100, y: 40 }] },
  { id: "high-pass", places: ["mountain-pass", "working-mine"], floor: "ground",
    areas: [{ kind: "rect", x: 40, y: 15, width: 31, height: 20, material: "mountain:grass" }],
    markers: [{ x: 55, y: 45 }, { x: 55, y: 25 }], points: [{ x: 55, y: 45 }, { x: 55, y: 25 }] },
  { id: "ancient-ruins", places: ["old-ruins", "forest-sanctuary"], floor: "dirt",
    areas: [{ kind: "rect", x: 40, y: 24, width: 40, height: 40, material: "rock-pit" }],
    markers: [{ x: 20, y: 40 }, { x: 100, y: 40 }], points: [{ x: 20, y: 40 }, { x: 20, y: 75 }, { x: 100, y: 75 }, { x: 100, y: 40 }] },
] as const satisfies readonly { readonly id: string; readonly places: readonly string[]; readonly floor: string;
  readonly areas: readonly SpatialFloorArea[]; readonly markers: readonly SpatialPoint[]; readonly points: readonly SpatialPoint[] }[];
export const worldRecipes = ["lake-kingdom", "northern-frontier"] as const;
export type GeographyRecipe = typeof regionRecipes[number]["id"] | typeof worldRecipes[number];

export function geographyRecipeFixture(recipeId: GeographyRecipe, seed = 7) {
  const project = geographyFixture("region", seed);
  const source = fixtureDocument(project);
  const originalRegion = Object.values(source.library.regions)[0];
  if (!originalRegion) throw new TypeError("Missing fixture region");
  const originalSlot = originalRegion.places[0];
  if (!originalSlot) throw new TypeError("Missing fixture place");
  const village = own(source.library.places, originalSlot.source.id);
  const exteriorProject = exteriorPlaceFixture(true);
  const exterior = fixtureDocument(exteriorProject);
  project.tilesets["easyrpg_chipset_combined_town"] = own(exteriorProject.tilesets, "easyrpg_chipset_combined_town");
  const inn = own(exterior.library.places, "nested-inn-design");
  const room = own(source.library.spaces, "room-design");
  const base = { revision: 1, tags: [], provenance: { origin: "user" } } as const;
  const regions: RegionDesign[] = regionRecipes.map(recipe => ({ ...base, id: spatialId(recipe.id), name: recipe.id,
    terrain: { tilesetId: "easyrpg_chipset_world", width: 128, height: 96, floor: recipe.floor, areas: recipe.areas },
    places: recipe.places.map((id, index) => {
      const point = recipe.markers[index];
      if (!point) throw new TypeError("Missing recipe marker");
      return { id: spatialId(id), source: { kind: "place", id: spatialId(`contract-place:${id}`) }, ...point, level: 0 };
    }), ports: [{ id: spatialId("entry"), name: "Entry", x: 10, y: 40 }],
    routes: [{ id: spatialId("authored-road"), from: { childId: spatialId(recipe.places[0]), portId: spatialId("entry") },
      to: { childId: spatialId(recipe.places[1]), portId: spatialId("entry") }, bidirectional: true, points: recipe.points }],
  }));
  const worlds: WorldDesign[] = worldRecipes.map((id, index) => ({ ...base, id: spatialId(id), name: id,
    terrain: { tilesetId: "easyrpg_chipset_world", width: 96, height: 64, floor: index === 0 ? "ground" : "snow", areas: [] },
    regions: regions.slice(index * 3, index * 3 + 3).map((region, i) => ({ id: region.id, source: { kind: "region", id: region.id }, x: 16 + i * 30, y: 24, level: 0 })),
    ports: [{ id: spatialId("entry"), name: "Entry", x: 8, y: 24 }],
    connections: regions.slice(index * 3, index * 3 + 2).map((region, i) => {
      const next = regions[index * 3 + i + 1];
      if (!next) throw new TypeError("Missing next region");
      return { id: spatialId(`crossing:${i}`), from: { childId: region.id, portId: spatialId("entry") },
        to: { childId: next.id, portId: spatialId("entry") }, bidirectional: true };
    }), entryPort: { childId: spatialId(index === 0 ? "lake-country" : "snow-frontier"), portId: spatialId("entry") },
  }));
  const library: SpatialLibrary = { ...source.library,
    spaces: { ...source.library.spaces, [room.id]: { ...room, ports: [...room.ports, { id: spatialId("up"), name: "Up", x: 12, y: 11 }] } },
    places: { ...source.library.places, [inn.id]: { ...inn,
      ports: [...inn.ports, { id: spatialId("approach"), name: "Approach", x: 1, y: 2 }],
      connections: [...inn.connections, ...[1, 2].map(level => ({ id: spatialId(`stairs:${level}`),
        from: { childId: spatialId(`floor-${level}`), portId: spatialId("up") },
        to: { childId: spatialId(`floor-${level + 1}`), portId: spatialId("entry") }, bidirectional: true }))] },
    ...Object.fromEntries(regionRecipes.flatMap(recipe => recipe.places).map(name => {
      const id = spatialId(`contract-place:${name}`);
      return [id, { ...village, id, name: `Contract ${name}`, connections: [{ id: spatialId("square-to-facility"),
        from: { childId: spatialId("square"), portId: spatialId("exit") },
        to: { childId: spatialId("inn"), portId: spatialId("approach") }, bidirectional: true }] }];
    })) }, regions: Object.fromEntries(regions.map(region => [region.id, region])), worlds: Object.fromEntries(worlds.map(world => [world.id, world])) };
  const document = checkedDocument({ ...source, library, occurrences: {}, rootOccurrenceIds: [], connections: [] }, project);
  project.spatialAuthoring = instantiateSpatialDesign(document, project, { source: { kind: worlds.some(world => world.id === recipeId) ? "world" : "region", id: spatialId(recipeId) },
    rootId: geographyRoot, x: 0, y: 0, level: 0, seed, generatorVersion: "task10-geography-v2" });
  return project;
}
