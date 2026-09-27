// 명작 공백 #24(2026-09-27) — 방문한 마을로 순간이동(드퀘 루라·포켓몬 공중날기).
//
// Set Teleportation Point(m2-072)는 한 칸만 기록하고 아무도 읽지 않았다. 이제 **목록**에 쌓고,
// Teleport Menu(m2-219)가 방문한 지점을 선택지로 띄워 고른 곳으로 옮긴다. 같은 맵은 한 줄(마지막 좌표가 이긴다).
// Teleportation On/Off(m2-073)가 꺼져 있으면 메뉴는 열리지 않고 결과 변수에 -1 을 쓴다.
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

export interface TeleportPoint {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  /** 메뉴에 보일 이름. 생략 = 맵 이름. */
  readonly label?: string;
}

type TeleportSession = PlaySessionLike & { teleportPoints?: TeleportPoint[] };

export const TELEPORT_POINTS_MAX = 48;

export function recordTeleportPoint(session: TeleportSession, point: TeleportPoint): void {
  if (!point.mapId) return;
  const next = (session.teleportPoints ?? []).filter((entry) => entry.mapId !== point.mapId);
  next.push({ mapId: point.mapId, x: Math.trunc(point.x), y: Math.trunc(point.y), ...(point.label ? { label: point.label } : {}) });
  session.teleportPoints = next.slice(-TELEPORT_POINTS_MAX);
}

export function removeTeleportPoint(session: TeleportSession, mapId: string): void {
  if (!session.teleportPoints) return;
  session.teleportPoints = session.teleportPoints.filter((entry) => entry.mapId !== mapId);
}

/** 순간이동 허가(m2-073). 한 번도 끈 적 없으면 허가. */
export function teleportationAllowed(session: PlaySessionLike): boolean {
  return session.m2Runtime?.access?.teleportation !== false;
}

/** 메뉴 후보: 지금 있는 맵은 뺀다. 프로젝트에서 사라진 맵도 뺀다. */
export function teleportMenuEntries(
  session: TeleportSession,
  maps: Readonly<Record<string, { readonly name?: string }>>,
): { readonly point: TeleportPoint; readonly label: string }[] {
  return (session.teleportPoints ?? [])
    .filter((point) => point.mapId !== session.currentMapId && maps[point.mapId])
    .map((point) => ({ point, label: point.label || maps[point.mapId]?.name || point.mapId }));
}
