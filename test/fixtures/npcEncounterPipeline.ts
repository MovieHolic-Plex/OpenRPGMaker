import { EventEmitter } from 'node:events';
import { vi } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { startSession } from '@/project/session';
import { store } from '@/project/store';
import { initialRuntimeEventPositions, runtimeEventViewsForMap } from '@/project/runtimeEventState';
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from '@/player/saveSlots';
import { registerAutonomousMover, updateParallelEvents } from '@/player/playSceneSchedulers';
import { registerPageMoveRoutes } from '@/player/playScenePageMoveRoutes';
import { updateAutonomousNPCs } from '@/player/playSceneAutonomous';
import { updatePlayScene } from '@/player/playSceneMovement';
import { runEvent } from '@/player/playSceneInterpreter';
import { PlayScene } from '@/player/PlayScene';
import { resolvePlayerSpriteResource } from '@/player/playerSpriteResources';

// Phaser's browser renderer is the adapter boundary; PlayScene's domain implementation stays real.
vi.mock('@/app/phaserRuntime', () => ({ getLoadedPhaser: () => ({ Scene: class {} }) }));
import type { PlaySceneContext } from '@/player/playSceneTypes';
import type { EventPage, GameEvent } from '@/project/types';
import type { EmoteKind } from '@/project/emotes';
import type { ForegroundLease } from '@/player/foregroundControl';

export function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing encounter fixture value');
  return value;
}

export function deferred<T>() {
  let resolve: (value: T) => void = () => { throw new Error('Deferred not initialized'); };
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}

export async function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Expected encounter state change did not occur')), 2000);
    })]);
  } finally { clearTimeout(timer); }
}

export type SightPolicy = { range: number; lineOfSight: boolean; facing: 'any' | 'forward' };
export type DetectionPolicy = { sight: SightPolicy; emote: EmoteKind | null; emoteMs: number; approachSpeed: number };
export type AuthoredNpcPage = EventPage & { detectionEncounter?: DetectionPolicy;
  movement: EventPage['movement'] & { sight?: SightPolicy } };

export function npcPage(id = 'trainer_page'): AuthoredNpcPage {
  return { id, name: id, conditions: [], graphic: { direction: 'down' }, priority: 'same',
    overlapForbidden: true, trigger: { kind: 'action' }, movement: { type: 'fixed', speed: 4, frequency: 4 }, commands: [] };
}

export function encounterProject() {
  const project = createBlankProject();
  const map = required(project.maps[project.startMapId]);
  map.width = 10; map.height = 10; map.lowerTiles = Array<number>(100).fill(0);
  map.upperTiles = Array<number>(100).fill(-1); map.events = []; map.safeZones = [];
  required(project.tilesets[map.tilesetId]).passability[0] = { up: true, down: true, left: true, right: true };
  required(project.tilesets[map.tilesetId]).passability[1] = { up: false, down: false, left: false, right: false };
  const troopId = required(project.database.troops[0]).id;
  const page = npcPage();
  page.commands = [{ kind: 'battleProcessing', troopId, canEscape: false, canLose: false, branchOnResult: true,
    victoryBranch: [{ kind: 'setSelfSwitch', key: 'A', value: true }] },
    { kind: 'setFlag', flag: 'encounterComplete', value: true }];
  const event: GameEvent = { id: 'trainer', x: 2, y: 2, trigger: { kind: 'action' }, commands: [], pages: [page] };
  map.events = [event];
  return { project, map, page, event, troopId };
}

function sprite(x = 0, y = 0) {
  return { x, y, active: true, alpha: 1, depth: 0, displayHeight: 16, originY: 1,
    texture: { key: 'test_sprite' }, frame: { name: '0' },
    setFrame(value: string | number) { this.frame.name = String(value); return this; },
    setPosition(nx: number, ny: number) { this.x = nx; this.y = ny; return this; },
    setDepth(value: number) { this.depth = value; return this; },
    setAlpha(value: number) { this.alpha = value; return this; },
    setScale: () => undefined, setScrollFactor: () => undefined, setOrigin: () => undefined,
    setVisible: () => undefined, destroy() { this.active = false; },
  };
}

export function encounterHarness(mode: 'trainer' | 'parallel' = 'trainer') {
  const f = encounterProject();
  if (mode === 'trainer') f.page.detectionEncounter = {
    sight: { range: 6, lineOfSight: true, facing: 'forward' }, emote: null, emoteMs: 0, approachSpeed: 4,
  };
  else { f.page.trigger = { kind: 'parallel' }; f.page.conditions = [{ kind: 'selfSwitch', key: 'A', value: false }]; }
  vi.mocked(store.getCurrent).mockReturnValue(f.project);
  const session = startSession(f.project); session.x = 2; session.y = 5;
  const signals = new EventEmitter(); const events = new EventEmitter();
  const battleResult = deferred<'victory' | 'defeat' | 'escape'>();
  const battle = vi.fn((_step: Parameters<PlaySceneContext['playBattle']>[0]) => {
    signals.emit('state'); return battleResult.promise;
  });
  const overlay = vi.fn();
  const dialogue = { showText: async () => undefined, showChoices: async () => 0,
    showNumberInput: async () => 0, hide: () => undefined, close: () => signals.emit('state') };
  const raf = new Map<number, FrameRequestCallback>(); let nextFrame = 0; let clock = 0;
  const timers = new Map<number, { at: number; callback: () => void }>(); let nextTimer = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { const id = ++nextFrame; raf.set(id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { raf.delete(id); });
  const canvas = document.createElement('canvas');
  // A real, typed PlayScene owns domain state and methods. This proxy adapts only
  // Phaser I/O surfaces; no partial object is asserted to be a complete scene.
  const surfaces = {
    game: { canvas, registry: { get: (key: string) => key === 'dialogue' ? dialogue : undefined } },
    events, player: sprite(),
    input_: { update: () => ({ dir: null, x: 0, y: 0, dash: false, actionPressed: false, confirmPressed: false, attackPressed: false, skillPressed: false }),
      resetEdges: () => undefined, clearDirectionTaps: () => undefined, setEnabled: () => undefined },
    eventSprites: new Map([[f.event.id, sprite(40, 48)]]),
    runtimeDom: { upsertEventMarker: () => undefined, clearEventMarkers: () => undefined },
    textures: { exists: () => true }, add: { sprite: (x: number, y: number, _texture?: string, frame?: string | number) => {
      const value = sprite(x, y); if (frame !== undefined) value.setFrame(frame); return value;
    } },
    tweens: { add: () => undefined, killTweensOf: () => undefined },
    time: { delayedCall: (ms: number, callback: () => void) => {
      const id = ++nextTimer; timers.set(id, { at: clock + ms, callback });
      return { remove: () => { timers.delete(id); } };
    } },
  };
  const scene = new Proxy(new PlayScene(), {
    get: (target, key, receiver) => Reflect.has(surfaces, key)
      ? Reflect.get(surfaces, key) : Reflect.get(target, key, receiver),
  });
  const state: Partial<PlaySceneContext> = {
    map: f.map, session, playerSprite: resolvePlayerSpriteResource(f.project, session),
    tileX: 2, tileY: 5, movingFrom: { x: 2, y: 5 }, movingTo: { x: 2, y: 5 },
    eventPositions: initialRuntimeEventPositions(f.map.events),
    getMapId: () => scene.map.id,
    setInputEnabled: enabled => { scene.inputEnabled = enabled; signals.emit('state'); },
    syncRuntimeState: () => { signals.emit('state'); }, refreshRuntimeSurfaces: () => { signals.emit('state'); },
    refreshRuntimeEntities: () => registerPageMoveRoutes(scene),
    registerPageMoveRoutes: () => registerPageMoveRoutes(scene),
    registerAutonomousMover: (id, moves, repeat) => registerAutonomousMover(scene, id, moves, repeat),
    updateAutonomousNPCs: delta => updateAutonomousNPCs(scene, delta),
    updateParallelEvents: delta => updateParallelEvents(scene, delta),
    updateTimers: () => undefined, updateFieldSpawns: () => undefined,
    runEvent: id => runEvent(scene, id), playBattle: battle, showBattleScene: overlay,
    showRuntimeOverlay: () => undefined, clearRuntimeOverlay: () => undefined,
    showGameOverScreen: () => { signals.emit('gameOver'); },
  };
  Object.assign(scene, state);
  registerPageMoveRoutes(scene);
  const positions: Array<{ x: number; y: number }> = [];
  const frame = async (delta = 1000 / 60) => {
    clock += delta; updatePlayScene(scene, delta);
    for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.callback(); }
    for (const [id, callback] of [...raf]) { raf.delete(id); callback(clock); }
    const view = runtimeEventViewsForMap(f.project, scene.map, scene.session, scene.eventPositions).find(v => v.event.id === f.event.id);
    if (view) positions.push({ x: view.x, y: view.y });
    await Promise.resolve();
  };
  const frames = async (count: number) => { for (let index = 0; index < count; index++) await frame(); };
  const when = (predicate: () => boolean) => {
    const signal = deferred<void>();
    const observe = () => { if (predicate()) { signals.off('state', observe); signal.resolve(); } };
    signals.on('state', observe); // Subscribe before the triggering frame/result resolution.
    return signal.promise;
  };
  return { ...f, scene, battle, battleResult, overlay, positions, frame, frames, when,
    dispose: () => { events.emit('shutdown'); events.removeAllListeners(); signals.removeAllListeners(); raf.clear(); timers.clear(); } };
}

export function saveReload(project: ReturnType<typeof createBlankProject>, session: ReturnType<typeof startSession>) {
  const values = new Map<string, string>();
  const storage: Storage = { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null,
    getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); }, clear: () => values.clear() };
  if (!saveToSlot(storage, 1, createSaveSnapshot(project, session)).ok) throw new Error('Save failed');
  const loaded = readSaveSlot(storage, 1);
  if (loaded.kind !== 'present') throw new Error('Save did not parse');
  return applySaveSnapshot(project, loaded.snapshot);
}

/** Observe the scheduler finally's last side effect, after any replacement claim has occurred. */
export function nextLeaseRelease(lease: ForegroundLease): Promise<void> {
  const released = deferred<void>();
  const release = lease.release;
  vi.spyOn(lease, 'release').mockImplementation(restore => { release(restore); released.resolve(); });
  return released.promise;
}
