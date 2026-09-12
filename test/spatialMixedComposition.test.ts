import { expect, it } from 'vitest';
import { mixedFixture } from './support/spatialMixedFixture';
import { checkedDocument, spatialId } from '@/project/spatial/domain';
import { instantiateSpatialDesign } from '@/project/spatial/instances';
import { compileSpatialOccurrence } from '@/editor/spatial/compileSpatialOccurrence';
import { deserialize, serialize } from '@/project/io';
import { inspectSpatialDesignReferences } from '@/project/spatial/ownership';
import { paintComposition } from '@/project/spatial/composition';

it('roundtrips direct tiles and all lower kinds without rewriting legacy records', () => {
  const project = mixedFixture();
  checkedDocument(project.spatialAuthoring, project);
  const read = deserialize(serialize(project));
  expect(read.spatialAuthoring!.library).toEqual(project.spatialAuthoring!.library);
  expect(inspectSpatialDesignReferences(read.spatialAuthoring, read, { kind: 'object', id: spatialId('bed-design') }).strong).toHaveLength(4);
});
it('rejects same/higher-kind members and invalid painted cells', () => {
  const project = mixedFixture();
  const paint = project.spatialAuthoring!.library.places.inn.composition!;
  project.spatialAuthoring!.library.places.inn = { ...project.spatialAuthoring!.library.places.inn, composition: { ...paint, members: [{ ...paint.members[0], source: { kind: 'world', id: spatialId('world') } }] } };
  expect(() => checkedDocument(project.spatialAuthoring, project)).toThrow('lower kinds');
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
