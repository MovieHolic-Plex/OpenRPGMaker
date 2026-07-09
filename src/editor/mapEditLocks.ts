import { editorState } from "@/editor/editorState";
import { randomUuid } from "@/util/id";
import { supabaseProjectConfig, type SupabaseProjectConfig } from "@/project/supabaseProjectConfig";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import { toast } from "@/util/toast";

type MapEditLockRow = {
  readonly owner_label: string | null;
  readonly owner_session_id: string;
  readonly expires_at: string;
  readonly updated_at: string | null;
};

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

const SUPABASE_SCHEMA = "rpg_zzu";
const LOCK_TABLE = "map_edit_locks";
const SESSION_KEY = "rpg-zzu-editor-session-id";
const OWNER_LABEL_KEY = "rpg-zzu-editor-owner-label";
const LOCK_TTL_MS = 2 * 60 * 1000;
const HEARTBEAT_MS = 45 * 1000;
export const MAP_EDIT_LOCK_IMMEDIATE_TAKEOVER_AFTER_MS = 90 * 1000;

let status: MapEditLockStatus = { kind: "idle" };
let requestVersion = 0;
let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
let checkedMapId: MapId | null = null;
const listeners = new Set<Listener>();

export function subscribeMapEditLocks(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMapEditLockStatus(): MapEditLockStatus {
  return status;
}

export function statusForMap(mapId: MapId): MapEditLockStatus | null {
  return status.kind !== "idle" && status.mapId === mapId ? status : null;
}

export function canEditMap(mapId: MapId): boolean {
  if (status.kind === "locked" && status.mapId === mapId) return false;
  // checking(부팅/맵 전환 직후 비동기 확인 중)은 낙관적으로 편집 허용 — 확인 중 몇 초간
  // 페인트가 조용히 막혀 "수동으로 못 깐다"로 느껴지던 데드존 제거. 진짜 잠금이면 곧 locked로 바뀐다.
  return true;
}

export function mapEditLockNotice(mapId: MapId): string {
  if (status.kind === "checking" && status.mapId === mapId) return "맵 편집 권한 확인 중입니다.";
  if (status.kind === "locked" && status.mapId === mapId) {
    return `${status.mapName} 맵은 ${status.ownerLabel} 세션이 편집 중입니다.`;
  }
  return "이 맵은 지금 읽기 전용입니다.";
}

export function mapEditLockLastActivityAt(status: MapEditLockStatus): number | null {
  if (status.kind !== "locked") return null;
  const explicit = status.updatedAt ? Date.parse(status.updatedAt) : Number.NaN;
  if (Number.isFinite(explicit)) return explicit;
  const expiresAt = Date.parse(status.expiresAt);
  if (!Number.isFinite(expiresAt)) return null;
  return expiresAt - LOCK_TTL_MS;
}

export function mapEditLockLastActivityText(status: MapEditLockStatus, now = Date.now()): string {
  const lastActivityAt = mapEditLockLastActivityAt(status);
  if (lastActivityAt === null) return "활동 시각 알 수 없음";
  const elapsedMs = Math.max(0, now - lastActivityAt);
  if (elapsedMs < 60_000) return "방금 활동";
  const minutes = Math.max(1, Math.floor(elapsedMs / 60_000));
  return `${minutes}분 전 활동`;
}

export function isMapEditLockTakeoverImmediate(status: MapEditLockStatus, now = Date.now()): boolean {
  const lastActivityAt = mapEditLockLastActivityAt(status);
  return lastActivityAt !== null && now - lastActivityAt >= MAP_EDIT_LOCK_IMMEDIATE_TAKEOVER_AFTER_MS;
}

export function ensureCurrentMapLock(): void {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  const mapName = project.maps[mapId]?.name ?? mapId;
  void checkoutMapForEditing(mapId, mapName);
}

// 탭 닫기/새로고침 시 보유 락을 즉시 반납 — 새로고침한 자기 자신이 이전 세션 락에 걸려
// "읽기 전용"으로 시작하던 자기잠금 문제 완화(TTL은 백스톱으로 유지).
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("beforeunload", () => {
    if (status.kind === "held") void releaseMapLock(status.mapId);
  });
}

export async function checkoutMapForEditing(mapId: MapId, mapName: string): Promise<void> {
  if (checkedMapId === mapId && (status.kind === "held" || status.kind === "locked" || status.kind === "unavailable")) {
    return;
  }
  const version = ++requestVersion;
  const previousHeldMapId = status.kind === "held" ? status.mapId : null;
  checkedMapId = mapId;
  setStatus({ kind: "checking", mapId, mapName });

  if (previousHeldMapId && previousHeldMapId !== mapId) void releaseMapLock(previousHeldMapId);

  const config = supabaseProjectConfig();
  if (!config) {
    if (version === requestVersion) {
      stopHeartbeat();
      setStatus({ kind: "unavailable", mapId, mapName, reason: "not-configured", message: "Supabase 설정 없음" });
    }
    return;
  }

  try {
    const result = await acquireMapLock(config, mapId, mapName);
    if (version !== requestVersion) return;
    if (result.kind === "locked") {
      stopHeartbeat();
      setStatus({ kind: "locked", mapId, mapName, ownerLabel: result.ownerLabel, expiresAt: result.expiresAt, updatedAt: result.updatedAt });
      return;
    }
    setStatus({ kind: "held", mapId, mapName, expiresAt: result.expiresAt });
    scheduleHeartbeat(mapId, mapName);
  } catch (error) {
    if (version !== requestVersion) return;
    stopHeartbeat();
    setStatus(unavailableStatusFromError(error, mapId, mapName));
  }
}

export async function takeoverMapLock(mapId: MapId, mapName: string): Promise<void> {
  const config = supabaseProjectConfig();
  checkedMapId = mapId;
  requestVersion += 1;
  if (!config) {
    stopHeartbeat();
    setStatus({ kind: "unavailable", mapId, mapName, reason: "not-configured", message: "Supabase 설정 없음" });
    toast("편집 권한을 가져올 수 없습니다: Supabase 설정 없음", "error");
    return;
  }
  try {
    const result = await upsertOwnMapLock(config, mapId, mapName);
    setStatus({ kind: "held", mapId, mapName, expiresAt: result.expiresAt });
    scheduleHeartbeat(mapId, mapName);
    toast("편집 권한을 가져왔습니다", "ok");
  } catch (error) {
    stopHeartbeat();
    const nextStatus = unavailableStatusFromError(error, mapId, mapName);
    setStatus(nextStatus);
    toast(`편집 권한 가져오기 실패: ${nextStatus.kind === "unavailable" ? nextStatus.message : "잠금 확인 실패"}`, "error");
  }
}

async function acquireMapLock(
  config: SupabaseProjectConfig,
  mapId: MapId,
  mapName: string,
): Promise<
  | { readonly kind: "held"; readonly expiresAt: string }
  | { readonly kind: "locked"; readonly ownerLabel: string; readonly expiresAt: string; readonly updatedAt?: string }
> {
  const sessionId = editorSessionId();
  const existing = await loadMapLock(config, mapId);
  const now = Date.now();
  if (existing && existing.owner_session_id !== sessionId && Date.parse(existing.expires_at) > now) {
    return {
      kind: "locked",
      ownerLabel: existing.owner_label?.trim() || "다른 브라우저",
      expiresAt: existing.expires_at,
      updatedAt: existing.updated_at ?? undefined,
    };
  }
  return upsertOwnMapLock(config, mapId, mapName);
}

async function upsertOwnMapLock(
  config: SupabaseProjectConfig,
  mapId: MapId,
  mapName: string,
): Promise<{ readonly kind: "held"; readonly expiresAt: string }> {
  const expiresAt = new Date(Date.now() + LOCK_TTL_MS).toISOString();
  await upsertMapLock(config, mapId, mapName, editorSessionId(), expiresAt);
  return { kind: "held", expiresAt };
}

async function loadMapLock(config: SupabaseProjectConfig, mapId: MapId): Promise<MapEditLockRow | null> {
  const query = new URLSearchParams({
    select: "owner_session_id,owner_label,expires_at,updated_at",
    project_id: `eq.${config.projectId}`,
    map_id: `eq.${mapId}`,
    limit: "1",
  });
  const response = await fetch(`${config.url}/rest/v1/${LOCK_TABLE}?${query.toString()}`, {
    headers: supabaseLockHeaders(config, "read"),
  });
  if (!response.ok) throw await supabaseLockError(response);
  const rows: unknown = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0];
  if (!isRecord(row) || typeof row.owner_session_id !== "string" || typeof row.expires_at !== "string") return null;
  return {
    owner_session_id: row.owner_session_id,
    owner_label: typeof row.owner_label === "string" ? row.owner_label : null,
    expires_at: row.expires_at,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

async function upsertMapLock(
  config: SupabaseProjectConfig,
  mapId: MapId,
  mapName: string,
  sessionId: string,
  expiresAt: string,
): Promise<void> {
  const query = new URLSearchParams({ on_conflict: "project_id,map_id" });
  const response = await fetch(`${config.url}/rest/v1/${LOCK_TABLE}?${query.toString()}`, {
    method: "POST",
    headers: supabaseLockHeaders(config, "write"),
    body: JSON.stringify({
      project_id: config.projectId,
      map_id: mapId,
      map_name: mapName,
      owner_session_id: sessionId,
      owner_label: ownerLabel(),
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw await supabaseLockError(response);
}

async function releaseMapLock(mapId: MapId): Promise<void> {
  const config = supabaseProjectConfig();
  if (!config) return;
  const query = new URLSearchParams({
    project_id: `eq.${config.projectId}`,
    map_id: `eq.${mapId}`,
    owner_session_id: `eq.${editorSessionId()}`,
  });
  const response = await fetch(`${config.url}/rest/v1/${LOCK_TABLE}?${query.toString()}`, {
    method: "DELETE",
    headers: supabaseLockHeaders(config, "write"),
  });
  if (!response.ok && response.status !== 404) console.warn("[mapEditLocks] release failed:", await response.text());
}

function scheduleHeartbeat(mapId: MapId, mapName: string): void {
  stopHeartbeat();
  heartbeatTimer = setTimeout(() => {
    const config = supabaseProjectConfig();
    if (!config || status.kind !== "held" || status.mapId !== mapId) return;
    void acquireMapLock(config, mapId, mapName)
      .then((result) => {
        if (result.kind === "held" && status.kind === "held" && status.mapId === mapId) {
          setStatus({ kind: "held", mapId, mapName, expiresAt: result.expiresAt });
          scheduleHeartbeat(mapId, mapName);
        }
      })
      .catch((error) => {
        if (status.kind === "held" && status.mapId === mapId) setStatus(unavailableStatusFromError(error, mapId, mapName));
      });
  }, HEARTBEAT_MS);
}

function stopHeartbeat(): void {
  if (!heartbeatTimer) return;
  clearTimeout(heartbeatTimer);
  heartbeatTimer = null;
}

function setStatus(next: MapEditLockStatus): void {
  // 내용이 같은 상태(예: 45초 하트비트로 자기 락 expiresAt만 갱신)는 통지하지 않는다 —
  // 통지가 좌측 팔레트/맵트리 전체 재구축으로 이어져 진행 중인 클릭을 증발시킨다.
  // 타인 락(locked)은 expiresAt/updatedAt이 인수(takeover) UI에 쓰이므로 그대로 통지한다.
  const sameIgnoringExpiry =
    status.kind === next.kind &&
    (status.kind === "idle" ||
      (status.kind !== "locked" && "mapId" in status && "mapId" in next && status.mapId === next.mapId &&
        (status.kind !== "unavailable" || (next.kind === "unavailable" && status.reason === next.reason))));
  status = next;
  if (sameIgnoringExpiry) return;
  for (const listener of listeners) listener(status);
}

function supabaseLockHeaders(config: SupabaseProjectConfig, mode: "read" | "write"): HeadersInit {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    Accept: "application/json",
    ...(mode === "write" ? { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" } : {}),
    ...(mode === "read" ? { "Accept-Profile": SUPABASE_SCHEMA } : { "Content-Profile": SUPABASE_SCHEMA }),
  };
}

async function supabaseLockError(response: Response): Promise<Error> {
  const message = await response.text();
  const error = new Error(message || `Supabase lock request failed: ${response.status}`);
  error.name = response.status === 404 && message.includes("PGRST205") ? "MapEditLockTableMissing" : "MapEditLockError";
  return error;
}

function unavailableStatusFromError(error: unknown, mapId: MapId, mapName: string): MapEditLockStatus {
  const tableMissing = error instanceof Error && error.name === "MapEditLockTableMissing";
  return {
    kind: "unavailable",
    mapId,
    mapName,
    reason: tableMissing ? "table-missing" : "network-error",
    message: tableMissing ? "잠금 테이블 없음" : error instanceof Error ? error.message : "잠금 확인 실패",
  };
}

function editorSessionId(): string {
  const storage = browserStorage();
  const existing = storage?.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = randomUuid();
  storage?.setItem(SESSION_KEY, next);
  return next;
}

function ownerLabel(): string {
  const customLabel = browserStorage()?.getItem(OWNER_LABEL_KEY)?.trim();
  return customLabel || `브라우저 ${editorSessionId().slice(0, 4)}`;
}

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
