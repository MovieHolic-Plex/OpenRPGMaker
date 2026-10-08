import type { Project } from "@/project/types";
import type { PlaySession } from "@/project/session";
import {
  applySaveSnapshot,
  createSaveSnapshot,
  snapshotLoadBlocker,
  withSaveCheckpoint,
  type SaveSnapshot,
  type SaveSnapshotPayload,
} from "@/player/saveSlots";

const CHECKPOINTS = new WeakMap<PlaySession, SaveSnapshot>();

export function saveSessionCheckpoint(project: Project, session: PlaySession): SaveSnapshot {
  const snapshot = createSaveSnapshot(project, session);
  CHECKPOINTS.set(session, snapshot);
  return snapshot;
}

export function getSessionCheckpoint(session: PlaySession): SaveSnapshot | undefined {
  return CHECKPOINTS.get(session);
}

export function setSessionCheckpoint(session: PlaySession, snapshot: SaveSnapshot): void {
  const { checkpoint: _nested, ...payload } = structuredClone(snapshot);
  CHECKPOINTS.set(session, payload);
}

/** Add the in-memory retry checkpoint to a manual or automatic save. */
export function attachSessionCheckpoint(session: PlaySession, snapshot: SaveSnapshot): SaveSnapshot {
  return withSaveCheckpoint(snapshot, getSessionCheckpoint(session));
}

/** Re-key a persisted checkpoint after a real Continue creates a new session object. */
export function restorePersistedSessionCheckpoint(
  project: Project,
  session: PlaySession,
  snapshot: Pick<SaveSnapshot, "checkpoint">,
): void {
  if (snapshot.checkpoint && snapshotLoadBlocker(project, snapshot.checkpoint as SaveSnapshot)) {
    return;
  }
  if (snapshot.checkpoint) setSessionCheckpoint(session, snapshot.checkpoint as SaveSnapshotPayload);
}

export function hasSessionCheckpoint(session: PlaySession): boolean {
  return CHECKPOINTS.has(session);
}

export function restoreSessionCheckpoint(project: Project, session: PlaySession): PlaySession | null {
  const snapshot = getSessionCheckpoint(session);
  if (!snapshot) return null;
  const restored = applySaveSnapshot(project, snapshot);
  resetPursuersForRetry(restored);
  setSessionCheckpoint(restored, snapshot);
  return restored;
}

/**
 * 붙잡혀서 체크포인트로 돌아가면 추격자도 제자리(home)로 돌아가고 추격을 멈춘다.
 * 체크포인트는 추격자까지 그 순간 그대로 되살리므로, 추격자가 가까이 있을 때 찍힌 진입 체크포인트는
 * 재시작 직후 다시 잡히는 무한 게임 오버였다(2026-09-24 추격 호러: 복구 0.5초 만에 재포획).
 * 은신 상태도 푼다 — 숨은 채 되살아나면 움직일 수 없다.
 */
function resetPursuersForRetry(session: PlaySession): void {
  const horror = session.horror;
  if (!horror) return;
  for (const [eventId, state] of Object.entries(horror.pursuits)) {
    const location = session.eventLocations[eventId];
    session.eventLocations[eventId] = { ...(location ?? {}), mapId: state.home.mapId, x: state.home.x, y: state.home.y, direction: location?.direction ?? "down" };
  }
  horror.pursuits = {};
  delete horror.hiding;
}
