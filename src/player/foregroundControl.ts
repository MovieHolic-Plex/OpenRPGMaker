import type { PlaySceneContext } from './playSceneTypes';
import type { MapId } from '@/project/types';

type ForegroundScene = Pick<PlaySceneContext, 'session' | 'map' | 'running' | 'inputEnabled' | 'setInputEnabled' | 'events'>;
export interface ForegroundLease {
  readonly signal: AbortSignal;
  current(): boolean;
  beginAuthoredTransfer(mapId: MapId): (() => void) | undefined;
  release(restore?: boolean): void;
}
const owners = new WeakMap<object, ForegroundLease>();
export function foregroundOwner(scene: object): ForegroundLease | undefined { return owners.get(scene); }

/** Only an available foreground may be claimed. The token prevents an old finally from unlocking a new owner. */
export function claimForeground(scene: ForegroundScene): ForegroundLease | undefined {
  if (scene.running || !scene.inputEnabled) return undefined;
  owners.get(scene)?.release(false); // A lifecycle reset explicitly made the scene available again.
  const session = scene.session;
  let map = scene.map;
  let transferMapId: MapId | undefined;
  const abort = new AbortController();
  const shutdown = () => lease.release(false);
  const lease: ForegroundLease = {
    signal: abort.signal,
    current: () => owners.get(scene) === lease && !abort.signal.aborted && scene.session === session
      && (scene.map === map || (transferMapId !== undefined && scene.map.id === transferMapId)),
    beginAuthoredTransfer: targetMapId => {
      if (!lease.current()) return undefined;
      transferMapId = targetMapId;
      return () => {
        if (owners.get(scene) === lease && !abort.signal.aborted && scene.session === session
          && scene.map.id === targetMapId) map = scene.map;
        transferMapId = undefined;
      };
    },
    release: (restore = true) => {
      if (owners.get(scene) !== lease) return;
      const mayRestore = restore && lease.current();
      owners.delete(scene);
      scene.events?.off('shutdown', shutdown); scene.events?.off('destroy', shutdown);
      abort.abort();
      if (mayRestore) { scene.running = false; scene.setInputEnabled(true); }
    },
  };
  owners.set(scene, lease);
  scene.events?.once('shutdown', shutdown); scene.events?.once('destroy', shutdown);
  scene.running = true; scene.setInputEnabled(false);
  return lease;
}
