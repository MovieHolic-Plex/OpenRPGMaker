import { describe, expect, it, vi } from 'vitest';
import { deserialize, serialize } from '@/project/io';
import { isHorrorState } from '@/project/horrorState';
import { runtimeEventViewsForMap } from '@/project/runtimeEventState';
import { advancePursuitDoors, pursuitTarget, toggleHiding } from '@/player/horrorRuntime';
import { createSaveSnapshot, readSaveSlot } from '@/player/saveSlots';
import { hidingPlace, pursuitFixture, required, solidEvent } from './fixtures/npcPursuit';

vi.mock('@/project/store', () => ({ store: { getCurrent: vi.fn() } }));

describe('pursuit policy and save boundaries', () => {
  it.each([undefined, 'lastSeen', 'persistent'] as const)('roundtrips tracking %s without inventing a legacy policy', tracking => {
    const f = pursuitFixture(tracking);
    const loaded = deserialize(serialize(f.project));
    expect(loaded.maps[f.a.id]?.events[0]?.pages?.[0]?.movement.pursuit).toEqual(f.page.movement.pursuit);
  });

  it('rejects an unsupported authored tracking policy', () => {
    const f = pursuitFixture();
    Object.assign(required(f.page.movement.pursuit), { tracking: 'omniscient' });
    expect(() => deserialize(serialize(f.project))).toThrow();
  });

  it.each([
    { searchTarget: { x: -1, y: 2 } },
    { searchTarget: { x: 2.5, y: 2 } },
    { searchCursor: -1 }, { searchCursor: 1.5 }, { searchCursor: 12 },
  ])('rejects malformed optional search state %j instead of discarding pursuit', extra => {
    const f = pursuitFixture(); f.acquire();
    Object.assign(f.state(), extra);
    expect(isHorrorState(f.scene.session.horror)).toBe(false);
    const text = JSON.stringify(createSaveSnapshot(f.project, f.scene.session));
    const storage: Storage = { length: 1, key: () => null, getItem: () => text,
      setItem: () => undefined, removeItem: () => undefined, clear: () => undefined };
    expect(readSaveSlot(storage, 1).kind).toBe('corrupt');
  });
});

describe('persistent interruption and unloaded isolation', () => {
  it.each(['hiding', 'safeZone'] as const)('does not track the live player through %s after prior acquisition', interruption => {
    const f = pursuitFixture('persistent'); f.acquire(); f.playerAt(4, 3);
    if (interruption === 'hiding') {
      hidingPlace(f); f.scene.map.lowerTiles[23] = 1;
      const closet = required(runtimeEventViewsForMap(f.project, f.scene.map, f.scene.session, f.scene.eventPositions).find(v => v.event.id === 'closet'));
      toggleHiding(f.world(), closet); f.scene.map.lowerTiles[23] = 0;
    } else f.scene.map.safeZones = [{ x: 4, y: 3, w: 1, h: 1 }];
    const target = pursuitTarget(f.world(), f.view(), f.mover(), 16);
    expect(target).not.toMatchObject({ x: 4, y: 3, searching: false });
    expect(pursuitTarget(f.world(), f.view(), f.mover(), 4001)).toBeNull();
    f.queue(); expect(f.state().doors).toEqual([]);
  });

  it('does not leak current-map positions into an unloaded landing collision check', () => {
    const f = pursuitFixture(); f.acquire(); f.queue();
    f.b.events.push(solidEvent('barrier', 2, 2)); f.enter(f.c);
    f.scene.eventPositions.barrier = { x: 8, y: 8 };
    advancePursuitDoors(f.world(), 10000);
    expect(f.scene.session.eventLocations.pursuer?.mapId).toBe(f.a.id);
    expect(f.state().doors).toHaveLength(1);
  });

  it('does not publish an unloaded landing into current-map event positions', () => {
    const f = pursuitFixture(); f.acquire(); f.queue(); f.enter(f.c);
    advancePursuitDoors(f.world(), 10000);
    expect(f.scene.session.eventLocations.pursuer?.mapId).toBe(f.b.id);
    expect(f.scene.eventPositions.pursuer).toBeUndefined();
  });
});
