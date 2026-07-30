import {
  furnishInteriorSpace,
  type InteriorRoomPlan,
  type InteriorRoomTheme,
  type InteriorThemeModifier,
} from "@/editor/interiorRoomPipeline";
import type { GameMap, Project } from "@/project/types";
import {
  advanceRoomBuild,
  evaluateRoom,
  listRoomSessions,
  loadRoomSession,
  saveRoomSession,
  startRoomSession,
} from "./engine";
import { INTERIOR_ROOM_KIT } from "./interiorKit";
import type { RoomHarnessIssue, RoomLayerCheckpoint, RoomSession } from "./types";

export interface RoomDraftSummary {
  readonly sessionId: string;
  readonly mapId: string;
  readonly kitId: string;
  readonly rooms: readonly {
    readonly id: string;
    readonly theme: string;
    readonly modifiers: readonly InteriorThemeModifier[];
    readonly locked: boolean;
  }[];
  readonly checkpoints: readonly RoomLayerCheckpoint[];
  readonly issues: readonly RoomHarnessIssue[];
}

export interface RoomRerollResult {
  readonly ok: boolean;
  readonly sessionId: string;
  readonly roomId: string;
  readonly seed: number;
  readonly issues: readonly RoomHarnessIssue[];
  readonly checkpoint: RoomLayerCheckpoint;
}

/** Direct typed entry point. It is intentionally unrelated to LLM tool exposure quotas. */
export function startInteriorRoomDraft(project: Project, args: Record<string, unknown>): RoomSession {
  const result = startRoomSession(project, INTERIOR_ROOM_KIT.kitId, args);
  return loadRequired(project, String((result.data as { sessionId: string }).sessionId));
}

export function advanceRoomDraft(project: Project, sessionId: string, layer?: string): RoomSession {
  advanceRoomBuild(project, sessionId, layer);
  return loadRequired(project, sessionId);
}

export function evaluateRoomDraft(project: Project, sessionId: string): ReturnType<typeof evaluateRoom> {
  return evaluateRoom(project, sessionId);
}

export function listRoomDrafts(project: Project): readonly RoomDraftSummary[] {
  return listRoomSessions(project).map((session) => {
    const plan = session.plan as Partial<InteriorRoomPlan>;
    const rooms = (plan.rooms ?? []).map((room) => ({
      id: room.id,
      theme: room.theme ?? plan.theme ?? "room",
      modifiers: room.modifiers ?? plan.themeModifiers ?? [],
      locked: session.lockedRoomIds.includes(room.id),
    }));
    return {
      sessionId: session.id,
      mapId: session.mapId,
      kitId: session.kitId,
      rooms,
      checkpoints: session.checkpoints,
      issues: session.checkpoints.flatMap((checkpoint) => checkpoint.issues),
    };
  });
}

export function setRoomDraftLock(project: Project, sessionId: string, roomId: string, locked: boolean): RoomDraftSummary {
  const session = loadRequired(project, sessionId);
  const plan = session.plan as Partial<InteriorRoomPlan>;
  if (!(plan.rooms ?? []).some((room) => room.id === roomId)) throw new Error(`room 없음: ${roomId}`);
  const ids = new Set(session.lockedRoomIds);
  if (locked) ids.add(roomId);
  else ids.delete(roomId);
  saveRoomSession(project, { ...session, lockedRoomIds: [...ids].sort() });
  return listRoomDrafts(project).find((draft) => draft.sessionId === sessionId)!;
}

/**
 * Seeded room-only reroll. Every tile/stack outside the selected room is restored byte-for-byte,
 * then the whole-room evaluator runs. Locked rooms reject before mutation.
 */
export function rerollRoomDraft(
  project: Project,
  sessionId: string,
  roomId: string,
  seed: number,
  theme?: InteriorRoomTheme,
): RoomRerollResult {
  const session = loadRequired(project, sessionId);
  if (session.kitId !== INTERIOR_ROOM_KIT.kitId) throw new Error("room-only reroll은 villager-room-v1만 지원합니다.");
  if (session.lockedRoomIds.includes(roomId)) throw new Error(`잠긴 방은 재생성할 수 없습니다: ${roomId}`);
  if (!Number.isFinite(seed)) throw new Error("seed는 유한한 정수여야 합니다.");
  const plan = session.plan as InteriorRoomPlan;
  const room = plan.rooms?.find((candidate) => candidate.id === roomId);
  if (!room) throw new Error(`room 없음: ${roomId}`);
  const map = project.maps[session.mapId];
  if (!map) throw new Error(`map 없음: ${session.mapId}`);

  const before = structuredClone(map);
  const normalizedSeed = Math.trunc(seed);
  const outcome = furnishInteriorSpace(map, plan, roomId, theme, normalizedSeed);
  restoreOutsideRoom(map, before, room);
  const report = INTERIOR_ROOM_KIT.evaluate!(map, outcome.plan, 1);
  const issues: RoomHarnessIssue[] = [
    ...outcome.warnings.map((message) => issueFromText(session.mapId, roomId, message)),
    ...report.issues.map((message) => issueFromText(session.mapId, roomId, message)),
  ];
  const checkpoint: RoomLayerCheckpoint = {
    index: session.checkpoints.length,
    layer: `room:${roomId}`,
    state: report.ok ? "done" : "failed",
    summary: `방 재생성 seed=${normalizedSeed} · score ${report.score}`,
    issues,
    mapSnapshot: structuredClone(map),
  };
  saveRoomSession(project, {
    ...session,
    plan: outcome.plan,
    checkpoints: [...session.checkpoints, checkpoint],
    log: [...session.log, `[room:${roomId}] seed=${normalizedSeed} score=${report.score}`],
  });
  return { ok: report.ok, sessionId, roomId, seed: normalizedSeed, issues, checkpoint };
}

function loadRequired(project: Project, sessionId: string): RoomSession {
  const session = loadRoomSession(project, sessionId);
  if (!session) throw new Error(`session 없음: ${sessionId}`);
  return session;
}

function restoreOutsideRoom(
  target: GameMap,
  before: GameMap,
  room: { x: number; y: number; w: number; h: number },
): void {
  const inside = (x: number, y: number): boolean =>
    x >= room.x && y >= room.y && x < room.x + room.w && y < room.y + room.h;
  const lowerStacks = cloneStacks(target.lowerTileStacks);
  const upperStacks = cloneStacks(target.upperTileStacks);
  for (let y = 0; y < target.height; y += 1) {
    for (let x = 0; x < target.width; x += 1) {
      if (inside(x, y)) continue;
      const index = y * target.width + x;
      target.lowerTiles[index] = before.lowerTiles[index]!;
      target.upperTiles[index] = before.upperTiles[index]!;
      restoreStack(lowerStacks, before.lowerTileStacks, index);
      restoreStack(upperStacks, before.upperTileStacks, index);
    }
  }
  if (Object.keys(lowerStacks).length > 0) target.lowerTileStacks = lowerStacks;
  else delete target.lowerTileStacks;
  if (Object.keys(upperStacks).length > 0) target.upperTileStacks = upperStacks;
  else delete target.upperTileStacks;
  target.events = structuredClone(before.events);
}

function cloneStacks(stacks: Record<number, number[]> | undefined): Record<number, number[]> {
  return Object.fromEntries(Object.entries(stacks ?? {}).map(([index, stack]) => [index, [...stack]]));
}

function restoreStack(
  target: Record<number, number[]>,
  before: Record<number, number[]> | undefined,
  index: number,
): void {
  const value = before?.[index];
  if (value) target[index] = [...value];
  else delete target[index];
}

function issueFromText(mapId: string, roomId: string, message: string): RoomHarnessIssue {
  const coordinate = message.match(/\((-?\d+),\s*(-?\d+)\)/);
  const hard = /walkability|도달 불가|필수/.test(message);
  return {
    code: /walkability|도달 불가/.test(message) ? "walkability" : "room-quality",
    severity: hard ? "error" : "warning",
    message,
    mapId,
    roomId,
    ...(coordinate ? { x: Number(coordinate[1]), y: Number(coordinate[2]) } : {}),
  };
}
