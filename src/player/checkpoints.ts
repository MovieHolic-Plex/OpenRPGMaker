import type { Project } from "@/project/types";
import type { PlaySession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot, type SaveSnapshot } from "@/player/saveSlots";
import { recoverAll } from "@/project/sessionActorCommands";
import { isPassableLanding } from "@/project/collision";

const CHECKPOINTS = new WeakMap<PlaySession, SaveSnapshot>();
/** 체크포인트 이름표(checkpointSave.label). 스냅숏 객체에 붙여 두면 setSessionCheckpoint 로 옮겨도 따라간다. */
const LABELS = new WeakMap<SaveSnapshot, string>();
/** 추격·즉사 도구가 맵마다 다는 진입 체크포인트(eventTools ensureMapCheckpointEvent)의 이름표. */
export const MAP_ENTRY_CHECKPOINT_LABEL = "map-entry";

export function saveSessionCheckpoint(project: Project, session: PlaySession, label?: string): SaveSnapshot {
  const snapshot = createSaveSnapshot(project, session);
  if (label) LABELS.set(snapshot, label);
  CHECKPOINTS.set(session, snapshot);
  return snapshot;
}

export function getSessionCheckpoint(session: PlaySession): SaveSnapshot | undefined {
  return CHECKPOINTS.get(session);
}

export function setSessionCheckpoint(session: PlaySession, snapshot: SaveSnapshot): void {
  CHECKPOINTS.set(session, snapshot);
}

export function hasSessionCheckpoint(session: PlaySession): boolean {
  return CHECKPOINTS.has(session);
}

export function restoreSessionCheckpoint(project: Project, session: PlaySession): PlaySession | null {
  const snapshot = getSessionCheckpoint(session);
  if (!snapshot) return null;
  const kept = LABELS.get(snapshot) === MAP_ENTRY_CHECKPOINT_LABEL ? retryKeepingProgress(project, session, snapshot) : null;
  if (kept) return kept;
  const restored = applySaveSnapshot(project, snapshot);
  resetPursuersForRetry(restored);
  setSessionCheckpoint(restored, snapshot);
  return restored;
}

/**
 * 진입 체크포인트에서 다시 할 때는 자리만 되돌리고 진행은 그대로 둔다(J58 horror-mansion2: 시작 맵의 진입 체크포인트가 게임 시작 순간에
 * 찍혀, 붙잡혀 다시 하면 손전등·단서·열린 문이 모두 사라지고 오프닝이 다시 돌았다). 지금 판을 복제해 회복·사망 상태를 풀고, 체크포인트 자리로
 * 옮기고, 추격자를 제자리로 돌린다. 자리가 막혔으면 null — 원래처럼 스냅숏 전체를 되살린다.
 */
function retryKeepingProgress(project: Project, session: PlaySession, snapshot: SaveSnapshot): PlaySession | null {
  const at = snapshot.session;
  const map = project.maps[at.currentMapId];
  if (!map || !Number.isSafeInteger(at.x) || !Number.isSafeInteger(at.y) || !isPassableLanding(project, map, at.x, at.y)) return null;
  const retry = structuredClone(session);
  recoverAll(retry, undefined, project);
  for (const actorId of retry.partyActorIds) if (retry.actorStateIds) retry.actorStateIds[actorId] = [];
  retry.currentMapId = at.currentMapId;
  retry.x = at.x;
  retry.y = at.y;
  retry.audio = {};
  resetPursuersForRetry(retry);
  setSessionCheckpoint(retry, snapshot);
  return retry;
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
