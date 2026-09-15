import { describe, expect, it } from 'vitest';
import { linkedRegionMapId } from '@/project/spatial/regionMapLinks';
import { validateSpatialAuthoring } from '@/project/spatial/guards';
import { instantiateSpatialDesign } from '@/project/spatial/instances';
import { spatialId } from '@/project/spatial/domain';
import { deserialize, serialize } from '@/project/io';
import { spatialProject, emptySpatialDocument, designBase } from './support/spatialSchemaFixture';

function fixture() {
  const { project } = spatialProject();
  const map = project.maps[project.startMapId];
  const doc = emptySpatialDocument();
  project.spatialAuthoring = validateSpatialAuthoring({ ...doc, library: { ...doc.library, regions: {
    region: { ...designBase('region'), terrain: { tilesetId: map.tilesetId, width: map.width, height: map.height, floor: 'grass', areas: [] }, places: [], routes: [], ports: [] },
  } } });
  project.spatialAuthoring = structuredClone(instantiateSpatialDesign(project.spatialAuthoring, project, {
    source: { kind: 'region', id: spatialId('region') }, rootId: 'occurrence', x: 0, y: 0, level: 0, seed: 1, generatorVersion: 'test',
  }));
  const occurrence = project.spatialAuthoring.occurrences.occurrence;
  project.spatialAuthoring = { ...project.spatialAuthoring, occurrences: { occurrence: { ...occurrence,
    bindings: [{ kind: 'projection', mapId: map.id, rect: { x: 0, y: 0, width: map.width, height: map.height }, ports: [] }],
  } } };
  return { project, map };
}

describe('whole-map region associations', () => {
  it('survives full project IO without rewriting the map', () => {
    const { project, map } = fixture();
    const loaded = deserialize(serialize(project));
    expect(linkedRegionMapId(loaded, 'region')).toBe(map.id);
    expect(linkedRegionMapId(loaded, 'region', 'occurrence')).toBe(map.id);
    expect(loaded.maps).toEqual(project.maps);
  });
  it('does not guess a library destination when there are two occurrences', () => {
    const { project } = fixture();
    const doc = project.spatialAuthoring!;
    project.spatialAuthoring = { ...doc, occurrences: { ...doc.occurrences, second: { ...doc.occurrences.occurrence, id: spatialId('second') } } };
    expect(linkedRegionMapId(project, 'region')).toBeUndefined();
    expect(linkedRegionMapId(project, 'region', 'occurrence')).toBeDefined();
  });
  it('leaves stale library revisions on the design editor', () => {
    const { project } = fixture();
    const doc = project.spatialAuthoring!;
    project.spatialAuthoring = { ...doc, library: { ...doc.library, regions: { region: { ...doc.library.regions.region, revision: 2 } } } };
    expect(linkedRegionMapId(project, 'region')).toBeUndefined();
    expect(linkedRegionMapId(project, 'region', 'occurrence')).toBeDefined();
  });
  it('rejects missing maps and partial-map projections', () => {
    const { project, map } = fixture();
    map.width += 1;
    expect(linkedRegionMapId(project, 'region')).toBeUndefined();
    delete project.maps[map.id];
    expect(linkedRegionMapId(project, 'region')).toBeUndefined();
  });
});
