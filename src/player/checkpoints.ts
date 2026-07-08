import type { Project } from "@/project/types";
import type { PlaySession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot, type SaveSnapshot } from "@/player/saveSlots";

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
  CHECKPOINTS.set(session, snapshot);
}

export function hasSessionCheckpoint(session: PlaySession): boolean {
  return CHECKPOINTS.has(session);
}

export function restoreSessionCheckpoint(project: Project, session: PlaySession): PlaySession | null {
  const snapshot = getSessionCheckpoint(session);
  if (!snapshot) return null;
  const restored = applySaveSnapshot(project, snapshot);
  setSessionCheckpoint(restored, snapshot);
  return restored;
}
