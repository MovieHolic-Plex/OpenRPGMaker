import { expect, it } from 'vitest';
import { mixedFixture } from './support/spatialMixedFixture';
import { checkedDocument, spatialId } from '@/project/spatial/domain';
import { instantiateSpatialDesign } from '@/project/spatial/instances';
import { compileSpatialOccurrence } from '@/editor/spatial/compileSpatialOccurrence';
import { deserialize, serialize } from '@/project/io';
import { inspectSpatialDesignReferences } from '@/project/spatial/ownership';
import { paintComposition } from '@/project/spatial/composition';
import { previewPlaceMaps } from '@/editor/panels/spatialPlacePreview';

it('roundtrips direct tiles and all lower kinds without rewriting legacy records', () => {
  const project = mixedFixture();
  checkedDocument(project.spatialAuthoring, project);
  const read = deserialize(serialize(project));
  expect(read.spatialAuthoring!.library).toEqual(project.spatialAuthoring!.library);
  expect(inspectSpatialDesignReferences(read.spatialAuthoring, read, { kind: 'object', id: spatialId('bed-design') }).strong).toHaveLength(4);
});
it('rejects geography inside a place', () => {
  const project = mixedFixture();
  const paint = project.spatialAuthoring!.library.places.inn.composition!;
  project.spatialAuthoring!.library.places.inn = { ...project.spatialAuthoring!.library.places.inn, composition: { ...paint, members: [{ ...paint.members[0], source: { kind: 'world', id: spatialId('world') } }] } };
  expect(() => checkedDocument(project.spatialAuthoring, project)).toThrow('incompatible member kind');
});
it('paints one layer, restores a base cell, and ignores outside strokes', () => {
  const paint = mixedFixture().spatialAuthoring!.library.places.inn.composition!;
  const next = paintComposition(paint, { x: 2, y: 2 }, 'upper', 54);
  expect(next.tiles.some(cell => cell.layer === 'upper' && cell.tile === 54)).toBe(true);
  expect(paintComposition(next, { x: 2, y: 2 }, 'upper', null)).toEqual(paint);
  expect(paintComposition(paint, { x: -1, y: 2 }, 'lower', 4)).toBe(paint);
});
it('compiles the frozen mixed tree, reloads and protects manual map edits', () => {
  const project = mixedFixture();
  project.spatialAuthoring = instantiateSpatialDesign(project.spatialAuthoring, project, { source: { kind: 'world', id: spatialId('world') }, rootId: 'mixed-world', x: 0, y: 0, level: 0, seed: 7, generatorVersion: 'mixed-v1' });
  const compiled = compileSpatialOccurrence(project, { occurrenceId: 'mixed-world' });
  const map = compiled.maps['spatial:mixed-world'];
  expect(map.width).toBe(128);
  const rootBed = Object.values(compiled.spatialAuthoring!.occurrences).find(o => o.parentId === 'mixed-world' && o.kind === 'object')!;
  const cells = rootBed.snapshot.kitCells['bed-design'].cells;
  for (const cell of cells) expect((cell.layer === 'lower' ? map.lowerTiles : map.upperTiles)[(80 + cell.y) * map.width + 95 + cell.x]).toBe(cell.tile);
  const changedSource = structuredClone(project);
  changedSource.spatialAuthoring!.library.worlds.world = { ...changedSource.spatialAuthoring!.library.worlds.world, composition: { ...changedSource.spatialAuthoring!.library.worlds.world.composition!, tiles: [] } };
  expect(compileSpatialOccurrence(changedSource, { occurrenceId: 'mixed-world' }).maps[map.id]).toEqual(map);
  expect(Object.values(compiled.spatialAuthoring!.occurrences).filter(o => o.bindings.length)).toHaveLength(Object.keys(compiled.spatialAuthoring!.occurrences).length);
  const read = deserialize(serialize(compiled));
  expect(compileSpatialOccurrence(read, { occurrenceId: 'mixed-world' }).maps[map.id]).toEqual(read.maps[map.id]);
  read.maps[map.id].lowerTiles[0] = 10;
  expect(() => compileSpatialOccurrence(read, { occurrenceId: 'mixed-world' })).toThrow('ownership');
}, 60_000);

it('allows nested places of either historical storage kind and rejects cycles', () => {
  const project = mixedFixture();
  const doc = project.spatialAuthoring!;
  const room = doc.library.spaces['room-design'];
  doc.library.spaces['small-room'] = { ...room, id: spatialId('small-room'), width: 4, height: 4, objectSlots: [], ports: [], composition: undefined };
  doc.library.places['small-place'] = { ...doc.library.places.inn, id: spatialId('small-place'), composition: {
    tilesetId: room.tilesetId, width: 8, height: 10, tiles: [], members: [{ id: spatialId('inner-room'), source: { kind: 'space', id: spatialId('small-room') }, x: 0, y: 0, level: 0 }],
  } };
  doc.library.spaces[room.id] = { ...room, composition: { ...room.composition!, members: [{ id: spatialId('nested-place'), source: { kind: 'place', id: spatialId('small-place') }, x: 1, y: 1, level: 0 }] } };
  project.spatialAuthoring = instantiateSpatialDesign(doc, project, { source: { kind: 'space', id: room.id }, rootId: 'nested-root', x: 0, y: 0, level: 0, seed: 7, generatorVersion: 'nested-place-v1' });
  const compiled = compileSpatialOccurrence(project, { occurrenceId: 'nested-root' });
  const read = deserialize(serialize(compiled));
  expect(compileSpatialOccurrence(read, { occurrenceId: 'nested-root' }).maps).toEqual(read.maps);
  const live = read.spatialAuthoring!.library;
  live.places['small-place'] = { ...live.places['small-place'], composition: { ...live.places['small-place'].composition!, members: [{ id: spatialId('cycle'), source: { kind: 'space', id: room.id }, x: 0, y: 0, level: 0 }] } };
  expect(() => checkedDocument(read.spatialAuthoring, read)).toThrow('containment cycle');
}, 60_000);
it('keeps a world overview separate from a directly composed child region', () => {
  const project = mixedFixture();
  const world = project.spatialAuthoring!.library.worlds.world;
  const { composition: _canvas, ...overview } = world;
  project.spatialAuthoring!.library.worlds.world = { ...overview, regions: [{ id: spatialId('overview-town'), source: { kind: 'region', id: spatialId('town') }, x: 5, y: 5, level: 0 }] };
  project.spatialAuthoring = instantiateSpatialDesign(project.spatialAuthoring, project, { source: { kind: 'world', id: spatialId('world') }, rootId: 'overview-with-canvas', x: 0, y: 0, level: 0, seed: 7, generatorVersion: 'overview-composition-v1' });
  const compiled = compileSpatialOccurrence(project, { occurrenceId: 'overview-with-canvas' });
  const root = compiled.spatialAuthoring!.occurrences['overview-with-canvas'];
  const child = Object.values(compiled.spatialAuthoring!.occurrences).find(o => o.parentId === root.id)!;
  expect(root.bindings[0].mapId).not.toBe(child.bindings[0].mapId);
  expect(compiled.maps[root.bindings[0].mapId].tilesetId).toBe('easyrpg_chipset_world');
  expect(compiled.maps[child.bindings[0].mapId]).toMatchObject({ width: 80, height: 60 });
  expect(compileSpatialOccurrence(deserialize(serialize(compiled)), { occurrenceId: root.id }).maps).toEqual(compiled.maps);
}, 60_000);
it('previews a room captured from a painted map on a non-shell atlas', () => {
  const project = mixedFixture();
  const doc = project.spatialAuthoring!;
  const room = doc.library.spaces['room-design'];
  project.tilesets['painted_atlas'] = { ...structuredClone(project.tilesets[room.tilesetId]), id: 'painted_atlas' };
  const width = 6, height = 5;
  doc.library.spaces['painted-room'] = { ...room, id: spatialId('painted-room'), tilesetId: 'painted_atlas', environment: 'interior', width, height, objectSlots: [],
    ports: [{ id: spatialId('painted-entry'), name: '입구', x: 2, y: 4 }],
    composition: { tilesetId: 'painted_atlas', width, height, members: [],
      tiles: Array.from({ length: width * height }, (_, i) => ({ x: i % width, y: Math.floor(i / width), layer: 'lower' as const, tile: 240 })) } };
  const place = { ...doc.library.places.inn, id: spatialId('painted-house'), kind: 'facility' as const, composition: undefined,
    children: [{ id: spatialId('painted-floor'), source: { kind: 'space' as const, id: spatialId('painted-room') }, x: 0, y: 0, level: 1 }] };
  doc.library.places['painted-house'] = place;
  const { maps } = previewPlaceMaps({ project, place, floor: null });
  expect(maps).toHaveLength(1);
  expect(maps[0].map).toMatchObject({ tilesetId: 'painted_atlas', width, height });
  expect(maps[0].map.lowerTiles.every(tile => tile === 240)).toBe(true);
}, 60_000);
