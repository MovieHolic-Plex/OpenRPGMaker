/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seesPlayer } from '@/player/horrorRuntime';
import { runtimeEventViewsForMap } from '@/project/runtimeEventState';
import { createSaveSnapshot, readSaveSlot } from '@/player/saveSlots';
import { encounterHarness, required, saveReload } from './fixtures/npcEncounterPipeline';

vi.mock('@/project/store', () => ({ store: { getCurrent: vi.fn() } }));
let harness: ReturnType<typeof encounterHarness> | undefined;
afterEach(() => { harness?.dispose(); vi.unstubAllGlobals(); });
const setup = () => (harness = encounterHarness());

describe('encounter sensing and completion boundaries', () => {
  it.each(['corner', 'spatial', 'runtimeFacing'] as const)('respects %s instead of the legacy sight approximation', kind => {
    const f = setup(); f.page.movement.sight = { range: 8, lineOfSight: true, facing: 'any' };
    if (f.page.detectionEncounter) delete f.page.detectionEncounter;
    if (kind === 'corner') { f.scene.session.x = 3; f.scene.session.y = 3; f.map.lowerTiles[23] = 1; }
    if (kind === 'runtimeFacing') {
      f.page.movement.sight.facing = 'forward'; f.scene.eventPositions.trainer = { x: 2, y: 2, direction: 'up' };
    }
    if (kind === 'spatial') {
      f.project.database.homeDecorationTypes = [{ id: 'screen', name: 'Screen', placementItemId: '',
        footprint: { width: 1, height: 1 }, blocksMovement: true, allowedOrientations: ['down'], graphicResourceId: '' }];
      f.scene.session.homeDecorationPlacements = { screen: { instanceId: 'screen', typeId: 'screen', mapId: f.map.id, x: 2, y: 3, orientation: 'down' } };
    }
    const view = required(runtimeEventViewsForMap(f.project, f.map, f.scene.session, f.scene.eventPositions)[0]);
    expect(seesPlayer({ project: f.project, map: f.map, session: f.scene.session, positions: f.scene.eventPositions }, view)).toBe(false);
  });
  it('retains per-event/page completion through the actual save-slot boundary', () => {
    const f = setup(); const completions = { trainer: { trainer_page: true } };
    Object.assign(f.scene.session, { detectionEncounterCompletions: completions });
    expect(saveReload(f.project, f.scene.session)).toMatchObject({ detectionEncounterCompletions: completions });
  });

  it.each([false, 1, null])('rejects an invalid completion receipt %s', value => {
    const f = setup(); Object.assign(f.scene.session, { detectionEncounterCompletions: { trainer: { trainer_page: value } } });
    const json = JSON.stringify(createSaveSnapshot(f.project, f.scene.session));
    const storage: Storage = { length: 1, key: () => null, getItem: () => json,
      clear: () => undefined, removeItem: () => undefined, setItem: () => undefined };
    expect(readSaveSlot(storage, 1).kind).toBe('corrupt');
  });
});
