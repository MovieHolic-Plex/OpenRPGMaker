import { expect, vi } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { startSession } from '@/project/session';
import { store } from '@/project/store';
import { initialRuntimeEventPositions, runtimeEventViewsForMap } from '@/project/runtimeEventState';
import { registerPageMoveRoutes } from '@/player/playScenePageMoveRoutes';
import { registerAutonomousMover } from '@/player/playSceneSchedulers';
import { advancePursuitDoors, carryPursuitThroughDoor, pursuitTarget } from '@/player/horrorRuntime';
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from '@/player/saveSlots';
import type { AutonomousNpcSceneContext } from '@/player/playSceneAutonomousTypes';
import type { AutonomousMover } from '@/player/playSceneTypes';
import type { GameEvent, GameMap } from '@/project/types';

export function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Required pursuit fixture state is missing');
  return value;
}

export function solidEvent(id: string, x: number, y: number): GameEvent {
  return { id, x, y, trigger: { kind: 'action' }, commands: [], pages: [{
    id: `${id}_page`, name: id, conditions: [], graphic: {},
    trigger: { kind: 'action' }, priority: 'same', overlapForbidden: true,
    movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [],
  }] };
}

export function pursuitFixture(tracking?: 'lastSeen' | 'persistent') {
  const project = createBlankProject();
  const a = required(project.maps[project.startMapId]);
  a.width = 10; a.height = 10;
  a.lowerTiles = Array<number>(100).fill(0); a.upperTiles = Array<number>(100).fill(-1);
  a.events = []; a.safeZones = [];
  const tileset = required(project.tilesets[a.tilesetId]);
  tileset.passability[0] = { up: true, down: true, left: true, right: true };
  tileset.passability[1] = { up: false, down: false, left: false, right: false };
  const b: GameMap = { ...structuredClone(a), id: 'room_b' };
  const c: GameMap = { ...structuredClone(a), id: 'room_c' };
  project.maps[b.id] = b; project.maps[c.id] = c;
  const npc = solidEvent('pursuer', 2, 2);
  const page = required(npc.pages?.[0]);
  // Structurally richer input exercises the agreed policy before production types add it.
  const policy = { scope: 'connected', doorDelayMs: 500, searchMs: 4000, onLost: 'wait',
    ...(tracking === undefined ? {} : { tracking }) } as const;
  page.movement = { type: 'chase', speed: 4, frequency: 4, moveIntervalMs: 800,
    sightRange: 8, pathfind: true, pursuit: policy };
  a.events = [npc];
  const session = startSession(project);
  session.currentMapId = a.id; session.x = 4; session.y = 2;
  vi.mocked(store.getCurrent).mockReturnValue(project);
  const scene: AutonomousNpcSceneContext & Parameters<typeof registerPageMoveRoutes>[0] = {
    map: a, session, eventPositions: initialRuntimeEventPositions(a.events),
    tileX: 4, tileY: 2, running: false, moving: false,
    autonomousNPCs: new Map<string, AutonomousMover>(), eventSprites: new Map(),
    runtimeDom: { upsertEventMarker: vi.fn() }, runEvent: vi.fn(async () => undefined),
    pageMoveRouteKeys: new Set(), pageMoveRouteEventIds: new Set(),
    registerAutonomousMover: (id, moves, repeat) => registerAutonomousMover(scene, id, moves, repeat),
  };
  registerPageMoveRoutes(scene);
  const world = () => ({ project, map: scene.map, session: scene.session, positions: scene.eventPositions });
  const view = () => required(runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions)
    .find(v => v.event.id === npc.id));
  const mover = () => required(scene.autonomousNPCs.get(npc.id));
  const state = () => required(scene.session.horror?.pursuits[npc.id]);
  const playerAt = (x: number, y: number) => {
    scene.session.x = x; scene.session.y = y; scene.tileX = x; scene.tileY = y;
  };
  const enter = (map: GameMap, x = 7, y = 7) => {
    scene.map = structuredClone(map); scene.session.currentMapId = map.id;
    scene.eventPositions = initialRuntimeEventPositions(map.events);
    scene.autonomousNPCs.clear(); scene.pageMoveRouteKeys.clear(); scene.pageMoveRouteEventIds.clear();
    playerAt(x, y);
  };
  const acquire = () => {
    expect(pursuitTarget(world(), view(), mover(), 0)).toMatchObject({ x: scene.tileX, y: scene.tileY, searching: false });
  };
  const queue = (map = b, x = 2, y = 2) => carryPursuitThroughDoor(world(), scene.autonomousNPCs, { mapId: map.id, x, y });
  const arriveUnseen = () => {
    acquire(); queue();
    for (let y = 0; y < b.height; y++) b.lowerTiles[y * b.width + 4] = 1;
    enter(b, 7, 2);
    expect(advancePursuitDoors(world(), required(state().doors[0]).remainingMs)).toBe(true);
    registerPageMoveRoutes(scene);
  };
  return { project, a, b, c, npc, page, scene, world, view, mover, state, playerAt, enter, acquire, queue, arriveUnseen };
}

export type PursuitFixture = ReturnType<typeof pursuitFixture>;

export function placeSpatialBlocker(f: PursuitFixture, map: GameMap, x: number, y: number): void {
  f.project.database.homeDecorationTypes = [{ id: 'barrier', name: 'Barrier', placementItemId: '',
    footprint: { width: 1, height: 1 }, blocksMovement: true, allowedOrientations: ['down'], graphicResourceId: '' }];
  f.scene.session.homeDecorationPlacements = { barrier: {
    instanceId: 'barrier', typeId: 'barrier', mapId: map.id, x, y, orientation: 'down',
  } };
}

export function reloadPursuit(f: PursuitFixture): void {
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() { return data.size; },
    clear: () => data.clear(), key: index => [...data.keys()][index] ?? null,
    getItem: key => data.get(key) ?? null, removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
  expect(saveToSlot(storage, 1, createSaveSnapshot(f.project, f.scene.session))).toEqual({ ok: true });
  const saved = readSaveSlot(storage, 1);
  expect(saved.kind).toBe('present');
  if (saved.kind !== 'present') throw new Error('Pursuit save slot did not parse');
  f.scene.session = applySaveSnapshot(f.project, saved.snapshot);
  const map = required(f.project.maps[f.scene.session.currentMapId]);
  f.enter(map, f.scene.session.x, f.scene.session.y);
  registerPageMoveRoutes(f.scene);
}

export function hidingPlace(f: PursuitFixture): void {
  const closet = solidEvent('closet', 8, 8);
  required(closet.pages?.[0]).interaction = { kind: 'hiding' };
  f.scene.map.events.push(closet);
}
