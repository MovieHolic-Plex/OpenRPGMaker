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

export async function checkoutMapForEditing(mapId: MapId, mapName: string): Promise<void> {
  const bridge = typeof window === 'undefined' ? undefined : window.oprn?.team;
  if (!bridge) { publish({ kind: 'idle' }); return; }
  const id = ++requestId;
  const previous = status.kind === 'held' ? status.mapId : null;
  if (renewTimer) clearInterval(renewTimer);
  publish({ kind: 'checking', mapId, mapName });
  const acquire = async () => {
    try {
      const result = await bridge.lock({ resource: `map:${mapId}` });
      if (id !== requestId) {
        if (result.kind === 'held' && (status.kind === 'idle' || status.mapId !== mapId)) void bridge.lock({ resource: `map:${mapId}`, release: true }).catch(() => {});
        return;
      }
      if (result.kind === 'held') publish({ kind: 'held', mapId, mapName, expiresAt: new Date(result.expiresAt!).toISOString() });
      else publish({ kind: 'locked', mapId, mapName, ownerLabel: result.ownerLabel ?? '다른 사용자', expiresAt: new Date(result.expiresAt ?? 0).toISOString() });
    } catch (error) {
      if (id === requestId) publish({ kind: 'unavailable', mapId, mapName, reason: 'network-error', message: error instanceof Error ? error.message : '팀 연결을 확인하세요.' });
    }
  };
  if (previous && previous !== mapId) {
    try {
      const saved = await store.flush();
      if (saved.kind === 'conflict') throw new Error('이전 맵의 저장 충돌을 먼저 해결하세요.');
      await bridge.lock({ resource: `map:${previous}`, release: true });
    } catch (error) {
      if (id === requestId) publish({ kind: 'unavailable', mapId, mapName, reason: 'network-error', message: error instanceof Error ? error.message : '저장 실패' });
      return;
    }
  }
  if (id !== requestId) return;
  await acquire();
  if (id === requestId) renewTimer = setInterval(() => { void acquire(); }, 20_000);
}

export async function takeoverMapLock(mapId: MapId, mapName: string): Promise<void> {
  // No forced takeover: the host grants an expired/released lease only.
  await checkoutMapForEditing(mapId, mapName);
}
