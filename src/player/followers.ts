import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Dir, EventPageGraphic, GameMap, Project } from "@/project/types";
import type { PlaySession, RuntimeFollower } from "@/project/session";
import { defaultActorCharacterResourceId } from "@/project/actorModel";
import { inBounds } from "@/project/collision";

const MAX_TRAIL_POINTS = 64;

export function addFollowerToSession(
  project: Project,
  session: PlaySession,
  input: { readonly actorId?: string; readonly graphic?: EventPageGraphic; readonly name?: string }
): RuntimeFollower | null {
  const follower = followerFromInput(project, input);
  if (!follower) return null;
  session.followers = [
    ...(session.followers ?? []).filter((entry) => entry.name !== follower.name),
    follower,
  ];
  if (!session.followerTrail || session.followerTrail.length === 0) {
    resetFollowerTrailNearPlayer(session, project.maps[session.currentMapId]);
  }
  return follower;
}

export function removeFollowerFromSession(
  session: PlaySession,
  input: { readonly name?: string; readonly all?: boolean }
): number {
  const current = session.followers ?? [];
  if (input.all === true || !input.name) {
    const removed = current.length;
    session.followers = [];
    session.followerTrail = [];
    return removed;
  }
  const next = current.filter((entry) => entry.name !== input.name);
  session.followers = next;
  if (next.length === 0) session.followerTrail = [];
  return current.length - next.length;
}

export function recordFollowerPlayerStep(
  session: PlaySession,
  point: { readonly x: number; readonly y: number; readonly direction?: Dir }
): void {
  if ((session.followers?.length ?? 0) === 0) return;
  const head = session.followerTrail?.[0];
  if (head && head.x === point.x && head.y === point.y) return;
  session.followerTrail = [
    { x: point.x, y: point.y, direction: point.direction },
    ...(session.followerTrail ?? []),
  ].slice(0, MAX_TRAIL_POINTS);
}

export function resetFollowerTrailNearPlayer(session: PlaySession, map: GameMap | undefined): void {
  if ((session.followers?.length ?? 0) === 0) {
    session.followerTrail = [];
    return;
  }
  const candidates = adjacentFollowerCandidates(session.x, session.y);
  const trail = session.followers.map((_, index) => {
    const candidate = candidates[index % candidates.length] ?? { x: session.x, y: session.y, direction: "down" as const };
    if (!map || inBounds(map, candidate.x, candidate.y)) return candidate;
    return { x: session.x, y: session.y, direction: candidate.direction };
  });
  session.followerTrail = trail;
}

export function followerPositions(session: Pick<PlaySession, "followers" | "followerTrail" | "x" | "y">): readonly {
  readonly follower: RuntimeFollower;
  readonly x: number;
  readonly y: number;
  readonly direction?: Dir;
}[] {
  return (session.followers ?? []).map((follower, index) => {
    const trail = session.followerTrail?.[index];
    return {
      follower,
      x: trail?.x ?? session.x,
      y: trail?.y ?? session.y,
      direction: trail?.direction ?? follower.graphic.direction,
    };
  });
}

function followerFromInput(
  project: Project,
  input: { readonly actorId?: string; readonly graphic?: EventPageGraphic; readonly name?: string }
): RuntimeFollower | null {
  if (input.actorId) {
    const actor = project.database.actors.find((entry) => entry.id === input.actorId);
    const resourceId = actor?.characterResourceId ?? defaultActorCharacterResourceId({ id: input.actorId });
    const graphic = resourceId ? actorFollowerGraphic(resourceId) : input.graphic;
    if (!graphic) return null;
    return {
      eventId: input.actorId,
      graphic,
      name: input.name?.trim() || actor?.name || input.actorId,
    };
  }
  if (!input.graphic) return null;
  return {
    graphic: input.graphic,
    name: input.name?.trim() || input.graphic.sprite?.id || "동행자",
  };
}

function actorFollowerGraphic(resourceId: string): EventPageGraphic | undefined {
  const asset = CHARSET_ASSETS.find((entry) => entry.id === resourceId || entry.textureKey === resourceId);
  const textureKey = asset?.textureKey ?? resourceId;
  return {
    sprite: { type: "bundled", id: textureKey },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 }),
  };
}

function adjacentFollowerCandidates(x: number, y: number): readonly { readonly x: number; readonly y: number; readonly direction: Dir }[] {
  return [
    { x: x - 1, y, direction: "right" },
    { x: x + 1, y, direction: "left" },
    { x, y: y + 1, direction: "up" },
    { x, y: y - 1, direction: "down" },
    { x, y, direction: "down" },
  ];
}
