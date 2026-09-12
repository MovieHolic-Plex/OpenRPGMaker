import { spaceCompilerFixture, interiorAtlas, spaceDesign } from "./spatialSpaceCompilerFixture";
import { spatialId } from "../../src/project/spatial/domain";
import type { SpatialChildSlot, SpatialComposition, SpatialKind } from "../../src/project/spatial/types";
export function mixedFixture() {
  const project = structuredClone(spaceCompilerFixture());
  const doc = project.spatialAuthoring!;
  const base = { revision: 1, tags: [], provenance: { origin: "user" as const } };
  const member = (id: string, kind: SpatialKind, source: string, x: number, y: number): SpatialChildSlot<SpatialKind> => ({ id: spatialId(id), source: { kind, id: spatialId(source) }, x, y, level: 0 });
  const canvas = (width: number, height: number, members: readonly SpatialChildSlot<SpatialKind>[]): SpatialComposition => ({ tilesetId: interiorAtlas, width, height, members,
    tiles: Array.from({ length: width * height }, (_, i) => ({ x: i % width, y: Math.floor(i / width), layer: "lower" as const, tile: 240 })) });
  doc.library.objects['bed-design'] = { ...doc.library.objects['bed-design'], chips: [] };
  doc.library.spaces[spaceDesign] = { ...doc.library.spaces[spaceDesign], objectSlots: [], ports: [],
    composition: { tilesetId: interiorAtlas, width: 20, height: 18, tiles: [{ x: 3, y: 5, layer: "lower", tile: 240 }], members: [member('loose-bed', 'object', 'bed-design', 4, 6)] } };
  doc.library.places['inn'] = { ...base, id: spatialId('inn'), name: '여관', kind: 'natural', children: [], layout: 'manual', ports: [], connections: [],
    composition: canvas(40, 30, [member('room', 'space', spaceDesign, 2, 2), member('sign', 'object', 'bed-design', 25, 8)]) };
  doc.library.regions['town'] = { ...base, id: spatialId('town'), name: '마을', terrain: { tilesetId: 'easyrpg_chipset_world', width: 80, height: 60, floor: 'ground', areas: [] }, places: [], ports: [], routes: [],
    composition: canvas(80, 60, [member('inn', 'place', 'inn', 2, 2), member('square', 'space', spaceDesign, 45, 5), member('bench', 'object', 'bed-design', 55, 40)]) };
  doc.library.worlds['world'] = { ...base, id: spatialId('world'), name: '세계', terrain: { tilesetId: 'easyrpg_chipset_world', width: 128, height: 100, floor: 'ground', areas: [] }, regions: [],
    ports: [{ id: spatialId('entry'), name: '입구', x: 0, y: 0 }], connections: [], entryPort: { childId: null, portId: spatialId('entry') },
    composition: canvas(128, 100, [member('town', 'region', 'town', 2, 2), member('inn', 'place', 'inn', 82, 2), member('room', 'space', spaceDesign, 82, 40), member('bed', 'object', 'bed-design', 95, 80)]) };
  project.spatialAuthoring = { ...doc, occurrences: {}, rootOccurrenceIds: [], connections: [] };
  return project;
}
