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

/**
 * 공유 원격 편집 잠금은 원격 행을 향하는 세션에만 성립했다. 정본이 로컬 폴더가 되면서
 * 잠글 원격 행이 사라졌다 — 자기 폴더는 한 세션만 열 수 있으므로 잠금 상태는 항상 idle 이다.
 * 이 모듈은 소비자(28곳의 canEditMap · 24곳의 mapEditLockNotice)가 잠금 UI 계약에 묶여 있어
 * 그 계약을 유지한 채 전송만 퇴역시킨다.
 */
export function subscribeMapEditLocks(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMapEditLockStatus(): MapEditLockStatus {
  return status;
}

export function statusForMap(_mapId: MapId): MapEditLockStatus | null {
  return status.kind === "idle" ? null : status;
}

export function canEditMap(_mapId: MapId): boolean {
  return true;
}

export function lockOwnerPhrase(ownerLabel: string): string {
  return ownerLabel.trim() || "다른 사용자";
}

export function mapEditLockNotice(_mapId: MapId): string {
  return "";
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
}

export async function checkoutMapForEditing(_mapId: MapId, _mapName: string): Promise<void> {
  if (status.kind !== "idle") {
    status = { kind: "idle" };
    for (const listener of listeners) listener(status);
  }
}

export async function takeoverMapLock(_mapId: MapId, _mapName: string): Promise<void> {
}
