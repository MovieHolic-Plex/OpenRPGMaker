import { describe, expect, it } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { startSession, setMapTileOverride } from '@/project/session';
import { recoverPlayerFromTerrain } from '@/project/terrainLandingRecovery';
import { setLayerTileAt } from '@/project/mapLayers';

describe('runtime terrain landing recovery', () => {
  const fixture = () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const tileset = project.tilesets[map.tilesetId]!;
    const floor = Object.entries(tileset.passability).find(([, p]) => p.up && p.down && p.left && p.right)?.[0];
    const wall = Object.entries(tileset.passability).find(([, p]) => !p.up && !p.down && !p.left && !p.right)?.[0];
    if (floor === undefined || wall === undefined) throw Error('Fixture needs floor and wall tiles');
    for (let i = 0; i < map.width * map.height; i++) {
      setLayerTileAt(map, 1, i, Number(floor));
      setLayerTileAt(map, 3, i, -1);
    }
    const session = startSession(project);
    session.x = 5; session.y = 5;
    return { project, map, session, wall: Number(wall) };
  };
  it('moves off a saved runtime wall without undoing the device tile', () => {
    const { project, map, session, wall } = fixture();
    setMapTileOverride(session, map.id, 'upper', 5 * map.width + 5, wall);
    expect(recoverPlayerFromTerrain(project, session)).toEqual({ x: 5, y: 6 });
    expect(session.mapOverrides[map.id]!.upper[5 * map.width + 5]).toBe(wall);
  });
  it('preserves valid floors and authored impassable placement', () => {
    const { project, map, session, wall } = fixture();
    setMapTileOverride(session, map.id, 'upper', 0, wall);
    expect(recoverPlayerFromTerrain(project, session)).toBeUndefined();
    setLayerTileAt(map, 3, 5 * map.width + 5, wall);
    expect(recoverPlayerFromTerrain(project, session)).toBeUndefined();
    expect([session.x, session.y]).toEqual([5, 5]);
  });
});
