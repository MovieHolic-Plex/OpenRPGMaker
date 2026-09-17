import { editorState } from "./editorState";
import { store } from "@/project/store";
import { teamSessionStatus } from "./teamSession";
import type { MapId } from "@/project/types";

export type MapEditLockStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "checking"; readonly mapId: MapId; readonly mapName: string }
  | { readonly kind: "held"; readonly mapId: MapId; readonly mapName: string; readonly expiresAt: string }
  | {
      readonly kind: "locked";
      readonly mapId: MapId;
      readonly mapName: string;
      readonly ownerLabel: string;
      readonly expiresAt: string;
      readonly updatedAt?: string;
      readonly canTakeover?: boolean;
    }
  | {
      readonly kind: "unavailable";
      readonly mapId: MapId;
      readonly mapName: string;
      readonly reason: "not-configured" | "table-missing" | "network-error";
      readonly message: string;
    };

type Listener = (status: MapEditLockStatus) => void;

export const MAP_EDIT_LOCK_IMMEDIATE_TAKEOVER_AFTER_MS = 90 * 1000;

let status: MapEditLockStatus = { kind: "idle" };
const listeners = new Set<Listener>();

let requestId = 0;
let renewTimer: ReturnType<typeof setInterval> | undefined;
function publish(next: MapEditLockStatus): void {
  status = next;
  for (const listener of listeners) listener(status);
}

export function subscribeMapEditLocks(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMapEditLockStatus(): MapEditLockStatus {
  return status;
}

export function statusForMap(mapId: MapId): MapEditLockStatus | null {
  return status.kind === "idle" || status.mapId !== mapId ? null : status;
}

export function canEditMap(mapId: MapId): boolean {
  if (typeof window === 'undefined' || !window.oprn?.team) return true;
  if (teamSessionStatus()?.member.role === 'viewer') return false;
  return status.kind === 'held' && status.mapId === mapId && Date.parse(status.expiresAt) > Date.now();
}

export function lockOwnerPhrase(ownerLabel: string): string {
  return ownerLabel.trim() || "다른 사용자";
}

export function mapEditLockNotice(mapId: MapId): string {
  if (teamSessionStatus()?.member.role === 'viewer') return '읽기 전용 팀원입니다.';
  const current = statusForMap(mapId);
  if (current?.kind === 'locked') return `${lockOwnerPhrase(current.ownerLabel)}님이 편집 중입니다.`;
  if (current?.kind === 'unavailable') return current.message;
  return canEditMap(mapId) ? '' : '편집 권한을 확인하고 있습니다.';
}

export function mapEditLockLastActivityAt(_status: MapEditLockStatus): number | null {
  return null;
}

export function mapEditLockLastActivityText(_status: MapEditLockStatus, _now = Date.now()): string {
  return "";
}

export function isMapEditLockTakeoverImmediate(_status: MapEditLockStatus, _now = Date.now()): boolean {
  return false;
}

export function ensureCurrentMapLock(): void {
  const mapId = editorState.get().currentMapId ?? store.getCurrent().startMapId;
  const map = store.getCurrent().maps[mapId];
  if (map && (status.kind === 'idle' || status.mapId !== mapId)) void checkoutMapForEditing(mapId, map.name);
}

let heldMap: { mapId: MapId; mapName: string } | null = null;
let transition: Promise<void> = Promise.resolve();

export async function checkoutMapForEditing(mapId: MapId, mapName: string, options: { takeover?: boolean } = {}): Promise<void> {
  let requestTakeover = options.takeover === true;
  const bridge = typeof window === 'undefined' ? undefined : window.oprn?.team;
  if (!bridge) { publish({ kind: 'idle' }); return; }
  const id = ++requestId;
  if (renewTimer) clearInterval(renewTimer);
  publish({ kind: 'checking', mapId, mapName });
  let queued = false;
  const attempt = (): Promise<void> => {
    if (queued) return transition;
    queued = true;
    const run = async () => {
      if (id !== requestId) return;
      try {
        // Keep the old lease alive until its changes are safely saved. Selection
        // status is separate from ownership, including after failures/retries.
        if (heldMap && heldMap.mapId !== mapId) {
          await bridge.lock({ resource: `map:${heldMap.mapId}` });
          const saved = await store.flush();
          if (id !== requestId) return;
          if (saved.kind !== 'saved') throw new Error(saved.kind === 'conflict'
            ? '이전 맵의 저장 충돌을 먼저 해결하세요.' : '이전 맵을 저장하지 못했습니다. 연결과 편집 권한을 확인하세요.');
          await bridge.lock({ resource: `map:${heldMap.mapId}`, release: true });
          heldMap = null;
        }
        if (id !== requestId) return;
        const takeover = requestTakeover;
        requestTakeover = false; // Only the explicit click may reclaim a lease; renewals never do.
        const result = await bridge.lock({ resource: `map:${mapId}`, ...(takeover ? { takeover: true } : {}) });
        if (result.kind === 'held') heldMap = { mapId, mapName };
        else if (heldMap?.mapId === mapId) heldMap = null;
        if (id !== requestId) return;
        if (result.kind === 'held') publish({ kind: 'held', mapId, mapName, expiresAt: new Date(result.expiresAt!).toISOString() });
        else publish({ kind: 'locked', mapId, mapName, ownerLabel: result.ownerLabel ?? '다른 사용자', canTakeover: result.canTakeover, expiresAt: new Date(result.expiresAt ?? 0).toISOString() });
      } catch (error) {
        if (id === requestId) publish({ kind: 'unavailable', mapId, mapName, reason: 'network-error', message: error instanceof Error ? error.message : '팀 연결을 확인하세요.' });
      }
    };
    transition = transition.then(run).finally(() => { queued = false; });
    return transition;
  };
  // Retry the entire transition, including save/release, after transient failures.
  renewTimer = setInterval(() => { void attempt(); }, 20_000);
  await attempt();
}

export async function takeoverMapLock(mapId: MapId, mapName: string): Promise<void> {
  // The host permits explicit takeover by the owner or the same member in another tab.
  await checkoutMapForEditing(mapId, mapName, { takeover: true });
}
