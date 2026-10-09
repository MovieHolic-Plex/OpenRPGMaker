/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seesPlayer } from '@/player/horrorRuntime';
import { describeSceneEmotes } from '@/player/playSceneEmotes';
import { registerPageMoveRoutes } from '@/player/playScenePageMoveRoutes';
import { runtimeEventViewsForMap } from '@/project/runtimeEventState';
import { startSession } from '@/project/session';
import { bounded, encounterHarness, required, saveReload } from './fixtures/npcEncounterPipeline';

vi.mock('@/project/store', () => ({ store: { getCurrent: vi.fn() } }));
let harness: ReturnType<typeof encounterHarness> | undefined;
const setup = () => (harness = encounterHarness());
afterEach(() => { harness?.dispose(); harness = undefined; vi.unstubAllGlobals(); });

describe('explicit NPC sensing and detection encounters', () => {
  it('remembers a manually completed trainer page before automatic detection can repeat it', async () => {
    const f = setup();
    f.scene.tileY = 3; f.scene.session.y = 3;
    const manual = f.scene.runEvent('trainer');
    expect(f.battle).toHaveBeenCalledTimes(1);
    f.battleResult.resolve('victory');
    await bounded(manual);
    expect(f.scene.session.detectionEncounterCompletions?.trainer?.[f.page.id]).toBe(true);
    f.scene.session = saveReload(f.project, f.scene.session);
    await f.frames(120);
    expect(f.battle).toHaveBeenCalledTimes(1);
  });

  it.each(['behind', 'wall'] as const)('does not claim foreground for a player obscured by %s in real updates', async obstacle => {
    const f = setup();
    if (obstacle === 'behind') { f.scene.session.y = 1; f.scene.tileY = 1; }
    else f.map.lowerTiles[32] = 1;
    await f.frames(2);
    expect(f.scene.running).toBe(false); expect(f.scene.inputEnabled).toBe(true);
    expect(f.battle).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'front inclusive range', x: 2, y: 8, wall: false, visible: true },
    { name: 'behind', x: 2, y: 1, wall: false, visible: false },
    { name: 'off-axis', x: 3, y: 5, wall: false, visible: false },
    { name: 'outside authored range', x: 2, y: 9, wall: false, visible: false },
    { name: 'wall', x: 2, y: 5, wall: true, visible: false },
  ])('uses the authored forward ray: $name', spec => {
    const f = setup();
    f.page.movement.sight = { range: 6, lineOfSight: true, facing: 'forward' };
    f.scene.session.x = spec.x; f.scene.session.y = spec.y;
    if (spec.wall) f.map.lowerTiles[32] = 1;
    const view = required(runtimeEventViewsForMap(f.project, f.map, f.scene.session, f.scene.eventPositions)[0]);
    expect(seesPlayer({ project: f.project, map: f.map, session: f.scene.session, positions: f.scene.eventPositions }, view)).toBe(spec.visible);
  });

  it.each(['fixed', 'random'] as const)('synchronously claims input and foreground before a %s trainer emote', async movement => {
    const f = setup(); f.page.movement.type = movement; registerPageMoveRoutes(f.scene);
    Object.assign(required(f.page.detectionEncounter), { emote: 'exclamation', emoteMs: 600 });
    const frame = f.frame();
    expect(f.scene.running).toBe(true);
    expect(f.scene.inputEnabled).toBe(false);
    expect(describeSceneEmotes(f.scene).map(e => e.target)).toEqual(['trainer']);
    expect(f.battle).not.toHaveBeenCalled();
    expect(f.scene.session.flags.encounterComplete).not.toBe(true);
    await frame;
  });

  it('walks a real route to adjacency, awaits foreground battle, and saves page completion without repeating', async () => {
    const f = setup();
    const entered = f.when(() => f.battle.mock.calls.length === 1);
    await f.frame();
    expect(f.scene.running).toBe(true);
    expect(f.scene.inputEnabled).toBe(false);
    // Explicit game frames drive the real route/tweens; no wall-clock sleep or success polling.
    await f.frames(120); await bounded(entered);
    expect(f.overlay).not.toHaveBeenCalled();
    expect(f.battle.mock.calls[0]?.[0]).toMatchObject({ troopId: f.troopId, ownerEventId: 'trainer' });
    const last = required(f.positions.at(-1));
    expect(Math.abs(last.x - 2) + Math.abs(last.y - 5)).toBe(1);
    let previous = { x: 2, y: 2 };
    for (const position of f.positions) {
      expect(Math.abs(position.x - previous.x) + Math.abs(position.y - previous.y)).toBeLessThanOrEqual(1);
      previous = position;
    }
    expect(f.scene.session.flags.encounterComplete).not.toBe(true);
    const released = f.when(() => !f.scene.running && f.scene.inputEnabled);
    f.battleResult.resolve('victory'); await bounded(released);
    expect(f.scene.session.selfSwitches?.trainer?.A).toBe(true);
    expect(f.scene.session.flags.encounterComplete).toBe(true);
    f.scene.session = saveReload(f.project, f.scene.session);
    await f.frames(120);
    expect(f.battle).toHaveBeenCalledTimes(1);
    f.page.id = 'trainer_second_page';
    const newPage = f.when(() => f.battle.mock.calls.length === 2);
    await f.frames(120); await bounded(newPage);
    expect(f.battle).toHaveBeenCalledTimes(2);
  });

  it('gives two simultaneous detectors one stable foreground owner', async () => {
    const f = setup();
    const second = structuredClone(f.event); second.id = 'second'; second.x = 3; second.y = 5;
    required(second.pages?.[0]).graphic.direction = 'left'; f.map.events.push(second);
    const entered = f.when(() => f.battle.mock.calls.length === 1);
    await f.frame(); expect(f.scene.running).toBe(true);
    await f.frames(120); await bounded(entered);
    expect(f.battle).toHaveBeenCalledTimes(1);
    expect(f.battle.mock.calls[0]?.[0].ownerEventId).toBe('trainer');
    expect(f.scene.inputEnabled).toBe(false);
  });

  it('releases an unreachable approach without executing commands or marking completion', async () => {
    const f = setup(); required(f.page.detectionEncounter).sight.lineOfSight = false;
    for (let x = 0; x < 10; x++) f.map.lowerTiles[40 + x] = 1;
    const lock = vi.spyOn(f.scene, 'setInputEnabled');
    await f.frames(4);
    expect(lock).toHaveBeenCalledWith(false);
    expect(f.scene.running).toBe(false); expect(f.scene.inputEnabled).toBe(true);
    expect(f.battle).not.toHaveBeenCalled(); expect(f.scene.session.flags.encounterComplete).not.toBe(true);
    f.scene.tileY = 9; f.scene.session.y = 9; await f.frame(); // Leave sensing range before retry.
    f.map.lowerTiles.fill(0); f.scene.tileY = 5; f.scene.session.y = 5;
    const entered = f.when(() => f.battle.mock.calls.length === 1);
    await f.frames(120); await bounded(entered);
  });

  it.each(['page', 'session', 'map'] as const)('cancels approach safely when the %s changes', async kind => {
    const f = setup(); await f.frame(); expect(f.scene.running).toBe(true);
    if (kind === 'page') { f.page.conditions = [{ kind: 'switch', switchId: 'unavailable', value: true }]; }
    if (kind === 'session') f.scene.session = startSession(f.project);
    if (kind === 'map') {
      const map = { ...structuredClone(f.map), id: 'elsewhere', events: [] };
      f.project.maps[map.id] = map; f.scene.map = map; f.scene.session.currentMapId = map.id;
    }
    await f.frames(4);
    expect(f.scene.running).toBe(false); expect(f.scene.inputEnabled).toBe(true);
    expect(f.battle).not.toHaveBeenCalled();
    expect(f.scene.session.flags.encounterComplete).not.toBe(true);
  });
});
