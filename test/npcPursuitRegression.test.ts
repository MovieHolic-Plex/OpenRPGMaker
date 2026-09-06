import { describe, expect, it, vi } from 'vitest';
import { advancePursuitDoors, pursuitTarget, seesPlayer, toggleHiding } from '@/player/horrorRuntime';
import { updateAutonomousNPCs } from '@/player/playSceneAutonomous';
import { findChasePath } from '@/player/chaseAi';
import { canMoveFootprint } from '@/project/collision';
import { runtimeEventViewsForMap } from '@/project/runtimeEventState';
import { setMapTileOverride } from '@/project/session';
import { hidingPlace, placeSpatialBlocker, pursuitFixture, reloadPursuit, required, solidEvent } from './fixtures/npcPursuit';

// Only the persistence-owning singleton is replaced; movement, collision, page resolution,
// runtime locations, pursuit and the complete save-slot JSON/validation path remain real.
vi.mock('@/project/store', () => ({ store: { getCurrent: vi.fn() } }));

describe('connected pursuit continuity', () => {
  it.each([undefined, 'lastSeen'] as const)('follows through a door during nonexpired %s search grace', tracking => {
    const f = pursuitFixture(tracking);
    f.acquire();
    f.playerAt(4, 3);
    f.scene.map.lowerTiles[23] = 1; // Occluded, but a route around the corner is open.
    expect(pursuitTarget(f.world(), f.view(), f.mover(), 250)).toMatchObject({ x: 4, y: 2, searching: true });
    f.queue();
    expect(f.state().doors).toHaveLength(1);
    expect(f.state().doors[0]).toMatchObject({ mapId: f.b.id, x: 2, y: 2 });
  });

  it('does not admit an expired lastSeen search', () => {
    const f = pursuitFixture(); f.acquire(); f.playerAt(9, 9);
    expect(pursuitTarget(f.world(), f.view(), f.mover(), 4001)).toBeNull();
    f.queue();
    expect(f.state().doors).toEqual([]);
  });

  it('persistent tracking follows the current player after losing sight', () => {
    const f = pursuitFixture('persistent'); f.acquire();
    f.playerAt(4, 3); f.scene.map.lowerTiles[23] = 1;
    expect(seesPlayer(f.world(), f.view())).toBe(false);
    expect(pursuitTarget(f.world(), f.view(), f.mover(), 5000)).toMatchObject({ x: 4, y: 3, searching: false });
  });

  it('chooses a reachable search target beyond an unseen arrival tile', () => {
    const f = pursuitFixture(); f.arriveUnseen();
    expect(seesPlayer(f.world(), f.view())).toBe(false);
    const target = pursuitTarget(f.world(), f.view(), f.mover(), 16);
    expect(target).toMatchObject({ searching: true });
    expect(target).not.toMatchObject({ x: 2, y: 2 });
    if (!target) throw new Error('Missing arrival search target');
    expect(Math.abs(target.x - 2) + Math.abs(target.y - 2)).toBeLessThanOrEqual(2);
    expect(findChasePath(f.project, f.scene.map, f.view(), target, {
      footprint: f.view().footprint, passRows: f.view().passRows,
    }).length).toBeGreaterThan(0);
  });

  it('actually walks beyond the unseen door through the autonomous updater', () => {
    const f = pursuitFixture(); f.arriveUnseen();
    updateAutonomousNPCs(f.scene, f.mover().moveIntervalMs);
    const move = f.mover().activeMove;
    expect(move).not.toBeNull();
    if (!move) throw new Error('Search did not start a walk');
    expect(Math.abs(move.toX - 2) + Math.abs(move.toY - 2)).toBe(1);
    expect(canMoveFootprint(f.project, f.scene.map, 2, 2, f.view().footprint, move.toX, move.toY, f.view().passRows)).toBe(true);
    expect(f.scene.runEvent).not.toHaveBeenCalled();
  });

  it('counts unseen search time during activeMove ticks, not only idle decisions', () => {
    const f = pursuitFixture(); f.playerAt(5, 2);
    updateAutonomousNPCs(f.scene, 800); // Real movement reserves (3,2) and starts its 320ms tween.
    expect(f.mover().activeMove).toMatchObject({ toX: 3, toY: 2, elapsedMs: 0 });
    f.scene.map.lowerTiles[24] = 1;
    expect(seesPlayer(f.world(), f.view())).toBe(false);
    updateAutonomousNPCs(f.scene, 100);
    expect(f.mover().activeMove?.elapsedMs).toBe(100);
    expect(f.state().searchMs).toBe(100);
  });
});

describe('door travel uses authored cadence and current phase', () => {
  it.each([0, 200])('includes the remaining interval when the idle timer is %i ms', timer => {
    const f = pursuitFixture(); f.acquire(); f.mover().timer = timer;
    expect(f.mover()).toMatchObject({ moveDurationMs: 320, moveIntervalMs: 800 });
    f.queue(); f.enter(f.b);
    const expectedMs = 500 + 2 * (320 + 800) - timer;
    advancePursuitDoors(f.world(), expectedMs - 1);
    expect(f.scene.session.eventLocations.pursuer?.mapId).toBe(f.a.id);
    advancePursuitDoors(f.world(), 1);
    expect(f.view()).toMatchObject({ x: 2, y: 2 });
  });

  it('includes the unfinished tween before walking the remaining door path', () => {
    const f = pursuitFixture(); f.playerAt(5, 2);
    updateAutonomousNPCs(f.scene, 800); updateAutonomousNPCs(f.scene, 160);
    expect(f.mover().activeMove).toMatchObject({ toX: 3, elapsedMs: 160 });
    f.queue(); f.enter(f.b);
    const expectedMs = 160 + 2 * (800 + 320) + 500;
    advancePursuitDoors(f.world(), expectedMs - 1);
    expect(f.scene.session.eventLocations.pursuer?.mapId).toBe(f.a.id);
    advancePursuitDoors(f.world(), 1);
    expect(f.view()).toMatchObject({ x: 2, y: 2 });
  });

  it('includes the authored interval on rapid B-to-C travel too', () => {
    const f = pursuitFixture(); f.acquire(); f.queue(); f.enter(f.b, 4, 2); f.queue(f.c);
    expect(f.state().doors).toHaveLength(2);
    expect(f.state().doors[1]?.remainingMs).toBe(500 + 2 * (800 + 320));
  });

  it('consumes game-time remainder across already admitted rapid legs', () => {
    const f = pursuitFixture(); f.acquire(); f.queue(); f.enter(f.b, 4, 2); f.queue(f.c);
    const total = f.state().doors.reduce((sum, door) => sum + door.remainingMs, 0);
    f.enter(f.c); advancePursuitDoors(f.world(), total);
    expect(f.scene.session.eventLocations.pursuer?.mapId).toBe(f.c.id);
    expect(f.state().doors).toEqual([]);
  });
});

describe('rapid door legs retain collision rules', () => {
  it.each([
    { name: 'wide body', width: 2, height: 1, passRows: 1, vertical: true, admitted: false },
    { name: 'full-height passage', width: 1, height: 2, passRows: 2, vertical: false, admitted: false },
    { name: 'feet-only passage', width: 1, height: 2, passRows: 1, vertical: false, admitted: true },
  ])('respects $name instead of silently using a unit body', spec => {
    const f = pursuitFixture();
    f.page.footprint = { width: spec.width, height: spec.height }; f.page.passRows = spec.passRows;
    f.acquire(); f.queue(); f.b.lowerTiles.fill(1);
    // Both endpoints fit; a one-tile neck separates the two rooms.
    for (let y = 1; y <= 7; y++) for (let x = 1; x <= 7; x++) {
      if (spec.vertical ? y !== 4 || x === 2 : x !== 4 || y === 2) f.b.lowerTiles[y * 10 + x] = 0;
    }
    f.enter(f.b, spec.vertical ? 2 : 6, spec.vertical ? 6 : 2);
    const from = { x: 2, y: 2 };
    expect(findChasePath(f.project, f.scene.map, from, f.scene.session).length).toBeGreaterThan(0);
    expect(findChasePath(f.project, f.scene.map, from, f.scene.session, {
      footprint: required(f.page.footprint), passRows: spec.passRows,
    }).length > 0).toBe(spec.admitted);
    f.queue(f.c);
    expect(f.state().doors.map(d => d.mapId)).toEqual(spec.admitted ? [f.b.id, f.c.id] : [f.b.id]);
  });

  it.each(['event', 'spatial'] as const)('does not queue through a runtime %s blocker', kind => {
    const f = pursuitFixture(); f.acquire(); f.queue(); f.b.lowerTiles.fill(1);
    for (let x = 1; x < 9; x++) f.b.lowerTiles[20 + x] = 0;
    f.b.events.push(solidEvent('barrier', 8, 8)); f.enter(f.b, 6, 2);
    if (kind === 'event') f.scene.session.eventLocations.barrier = { mapId: f.b.id, x: 4, y: 2 };
    else placeSpatialBlocker(f, f.b, 4, 2);
    f.queue(f.c);
    expect(f.state().doors.map(d => d.mapId)).toEqual([f.b.id]);
  });

  it('does not queue the initial leg through a spatial blocker either', () => {
    const f = pursuitFixture(); f.acquire(); f.scene.map.lowerTiles.fill(1);
    for (let x = 1; x < 9; x++) f.scene.map.lowerTiles[20 + x] = 0;
    placeSpatialBlocker(f, f.a, 3, 2); f.queue();
    expect(f.state().doors).toEqual([]);
  });
});

describe('arrival projection, waiting and save continuation', () => {
  it.each([
    { authored: 0, runtime: 1, lands: false },
    { authored: 1, runtime: 0, lands: true },
  ])('uses runtime tile $runtime rather than authored tile $authored in an unloaded destination', spec => {
    const f = pursuitFixture(); f.acquire(); f.queue(); f.b.lowerTiles[22] = spec.authored;
    setMapTileOverride(f.scene.session, f.b.id, 'lower', 22, spec.runtime); f.enter(f.c);
    advancePursuitDoors(f.world(), required(f.state().doors[0]).remainingMs);
    expect(f.scene.session.eventLocations.pursuer?.mapId).toBe(spec.lands ? f.b.id : f.a.id);
    expect(f.b.lowerTiles[22]).toBe(spec.authored);
    expect(f.state().doors).toHaveLength(spec.lands ? 0 : 1);
  });

  it.each(['player', 'event'] as const)('waits at a blocked %s landing, then arrives once after it clears', blocker => {
    const f = pursuitFixture(); f.acquire(); f.queue();
    if (blocker === 'event') f.b.events.push(solidEvent('barrier', 2, 2));
    f.enter(f.b, blocker === 'player' ? 2 : 7, blocker === 'player' ? 2 : 7);
    advancePursuitDoors(f.world(), 10000);
    expect(f.state().doors).toHaveLength(1);
    expect(f.scene.session.eventLocations.pursuer?.mapId).toBe(f.a.id);
    expect(runtimeEventViewsForMap(f.project, f.scene.map, f.scene.session, f.scene.eventPositions).filter(v => v.event.id === 'pursuer')).toHaveLength(0);
    f.playerAt(7, 7); f.scene.session.eventLocations.barrier = { mapId: f.b.id, x: 8, y: 8 };
    expect(advancePursuitDoors(f.world(), 0)).toBe(true); advancePursuitDoors(f.world(), 10000);
    expect(runtimeEventViewsForMap(f.project, f.scene.map, f.scene.session, f.scene.eventPositions).filter(v => v.event.id === 'pursuer')).toHaveLength(1);
    expect(f.state().doors).toEqual([]);
    expect(f.a.events.filter(e => e.id === 'pursuer')).toHaveLength(1);
  });

  it('does not bank blocked-arrival time into a burst through the following leg', () => {
    const f = pursuitFixture(); f.acquire(); f.queue(); f.enter(f.b, 4, 2); f.queue(f.c);
    f.scene.session.eventLocations.barrier = { mapId: f.b.id, x: 2, y: 2 };
    f.b.events.push(solidEvent('barrier', 2, 2));
    const secondMs = required(f.state().doors[1]).remainingMs;
    f.enter(f.c); advancePursuitDoors(f.world(), 100000);
    expect(f.state().doors).toHaveLength(2);
    f.scene.session.eventLocations.barrier = { mapId: f.b.id, x: 8, y: 8 };
    advancePursuitDoors(f.world(), 0);
    expect(f.scene.session.eventLocations.pursuer?.mapId).toBe(f.b.id);
    expect(f.state().doors[0]?.remainingMs).toBe(secondMs);
    advancePursuitDoors(f.world(), secondMs);
    expect(f.view()).toMatchObject({ x: 2, y: 2 });
  });

  it('reloads a partially elapsed rapid trail and continues both queued legs', () => {
    const f = pursuitFixture(); f.acquire(); f.queue(); f.enter(f.b, 4, 2); f.queue(f.c); f.enter(f.c);
    advancePursuitDoors(f.world(), 100);
    const before = structuredClone(f.state()); reloadPursuit(f);
    expect(f.state()).toEqual(before);
    advancePursuitDoors(f.world(), before.doors.reduce((sum, d) => sum + d.remainingMs, 0));
    expect(f.scene.session.eventLocations.pursuer?.mapId).toBe(f.c.id);
    expect(f.state().doors).toEqual([]);
  });

  it('retains an in-progress unseen search and its next movement after save-slot reload', () => {
    const f = pursuitFixture(); f.arriveUnseen();
    const target = pursuitTarget(f.world(), f.view(), f.mover(), 250);
    const before = structuredClone(f.state()); reloadPursuit(f);
    expect(f.state()).toEqual(before);
    expect(pursuitTarget(f.world(), f.view(), f.mover(), 0)).toEqual(target);
    updateAutonomousNPCs(f.scene, f.mover().moveIntervalMs);
    expect(f.mover().activeMove).not.toBeNull();
    expect(f.state().searchMs).toBe(1050);
  });
});

describe('legacy, hiding and safe-zone characterization', () => {
  it('leaves legacy chase without explicit pursuit on its existing movement path', () => {
    const f = pursuitFixture(); delete f.page.movement.pursuit; f.scene.map.lowerTiles[23] = 1;
    expect(pursuitTarget(f.world(), f.view(), f.mover(), 800)).toBeUndefined();
    updateAutonomousNPCs(f.scene, 800);
    expect(f.mover().activeMove).not.toBeNull();
    expect(f.scene.session.horror).toBeUndefined();
  });

  it.each([false, true])('preserves hiding detection with witnessed entry = %s', witnessed => {
    const f = pursuitFixture(); hidingPlace(f);
    if (!witnessed) f.scene.map.lowerTiles[23] = 1;
    const closet = required(runtimeEventViewsForMap(f.project, f.scene.map, f.scene.session, f.scene.eventPositions).find(v => v.event.id === 'closet'));
    expect(toggleHiding(f.world(), closet)).toBe(true);
    expect(f.scene.session.horror?.hiding?.witnessedBy).toEqual(witnessed ? ['pursuer'] : []);
    f.scene.map.lowerTiles[23] = 0;
    const target = pursuitTarget(f.world(), f.view(), f.mover(), 0);
    if (witnessed) expect(target).toMatchObject({ x: 4, y: 2, searching: false });
    else expect(target).toBeNull();
  });

  it.each(['lastSeen', 'persistent'] as const)('does not freshly acquire a player in a safe zone with %s tracking', tracking => {
    const f = pursuitFixture(tracking);
    f.scene.map.safeZones = [{ x: 4, y: 2, w: 1, h: 1 }];
    expect(pursuitTarget(f.world(), f.view(), f.mover(), 800)).toBeNull();
    updateAutonomousNPCs(f.scene, 800);
    expect(f.mover().activeMove).toBeNull();
    expect(f.scene.runEvent).not.toHaveBeenCalled();
  });
});
