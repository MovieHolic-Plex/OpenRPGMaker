import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Dir, EventPageGraphic, GameMap, MonsterSpeciesGraphic, Project } from "@/project/types";
import type { MonsterInstance, PlaySession, RuntimeFollower } from "@/project/session";
import { defaultActorCharacterResourceId } from "@/project/actorModel";
import { inBounds } from "@/project/collision";

const MAX_TRAIL_POINTS = 64;
const DEFAULT_MONSTER_FIELD_CHARSET = "tex_easyrpg_charset_monster1";

function uniqueFollowerName(session: PlaySession, desired: string): string {
  const taken = new Set(session.followers.map((f) => f.name));
  if (!taken.has(desired)) return desired;
  for (let i = 2; i < 100; i += 1) {
    const cand = `${desired} (${i})`;
    if (!taken.has(cand)) return cand;
  }
  return `${desired} (${Date.now() % 1000})`;
}

/** Stable id derivation — must not use display name so renames don't steal a sprite. */
function followerIdFor(input: { readonly actorId?: string; readonly monsterInstanceId?: string; name: string }, session: PlaySession): string {
  if (input.monsterInstanceId) return `monster:${input.monsterInstanceId}`;
  if (input.actorId) return `actor:${input.actorId}`;
  // mascot / custom graphic: name-derived with collision suffix, then made globally unique
  let base = `mascot:${input.name}`;
  // de-dup against existing ids (not names)
  if (!session.followers.some((f) => (f as { id?: string }).id === base)) return base;
  for (let i = 2; i < 100; i += 1) {
    const cand = `${base} (${i})`;
    if (!session.followers.some((f) => (f as { id?: string }).id === cand)) return cand;
  }
  return `${base}:${Date.now() % 1000}`;
}

export function addFollowerToSession(
  project: Project,
  session: PlaySession,
  input: { readonly actorId?: string; readonly graphic?: EventPageGraphic; readonly name?: string }
): RuntimeFollower | null {
  let follower = followerFromInput(project, input);
  if (!follower) return null;
  // Stabilize id before de-duplicating display name — id is what the sprite map keys on.
  const desiredId = followerIdFor({ actorId: follower.eventId, name: follower.name }, session);
  if ((follower as { id?: string }).id !== desiredId) follower = { ...follower, id: desiredId } as typeof follower;
  const safeName = uniqueFollowerName(session, follower.name);
  if (safeName !== follower.name) follower = { ...follower, name: safeName } as typeof follower;
  const actorFollowers = (session.followers ?? []).filter(
    (entry) => entry.kind !== "monster" && !entry.monsterInstanceId && (entry as { id?: string }).id !== follower.id
  );
  const monsterFollowers = (session.followers ?? []).filter(
    (entry) => entry.kind === "monster" || Boolean(entry.monsterInstanceId)
  );
  session.followers = [...actorFollowers, follower, ...monsterFollowers];
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
  const isMonsterFollower = (entry: RuntimeFollower): boolean =>
    entry.kind === "monster" || Boolean(entry.monsterInstanceId);

  if (input.all === true || !input.name) {
    const actorEntries = current.filter((entry) => !isMonsterFollower(entry));
    const monsterEntries = current.filter(isMonsterFollower);
    session.followers = monsterEntries;
    if (monsterEntries.length === 0) session.followerTrail = [];
    return actorEntries.length;
  }

  // Name-based removal targets actor followers only; monster train is SSOT from monsterParty.
  const next = current.filter((entry) => isMonsterFollower(entry) || entry.name !== input.name);
  const removed = current.length - next.length;
  session.followers = next;
  if (next.length === 0) session.followerTrail = [];
  return removed;
}

/**
 * Rebuild monster train followers from session.monsterParty order.
 * Actor followers (kind !== "monster" and no monsterInstanceId) are preserved first.
 */
export function syncMonsterPartyFollowers(project: Project, session: PlaySession): void {
  const current = session.followers ?? [];
  const actorFollowers = current.filter(
    (entry) => entry.kind !== "monster" && !entry.monsterInstanceId
  );
  const monsterFollowers: RuntimeFollower[] = [];
  for (const instanceId of session.monsterParty ?? []) {
    const instance = session.monsterInstances?.[instanceId];
    if (!instance) continue;
    const species = (project.database.monsterSpecies ?? []).find((record) => record.id === instance.speciesId);
    monsterFollowers.push({
      id: `monster:${instance.instanceId}`,
      name: monsterFollowerName(instance, species?.name),
      graphic: monsterFieldGraphic(species?.graphic),
      kind: "monster",
      monsterInstanceId: instance.instanceId,
    });
  }
  const hadFollowers = current.length > 0;
  session.followers = [...actorFollowers, ...monsterFollowers];
  if (session.followers.length === 0) {
    session.followerTrail = [];
    return;
  }
  if (!hadFollowers || !session.followerTrail || session.followerTrail.length === 0) {
    resetFollowerTrailNearPlayer(session, project.maps[session.currentMapId]);
  }
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
      id: `actor:${input.actorId}`,
      eventId: input.actorId,
      graphic,
      name: input.name?.trim() || actor?.name || input.actorId,
      kind: "actor",
    };
  }
  if (!input.graphic) return null;
  return {
    id: `mascot:${input.name?.trim() || input.graphic.sprite?.id || "동행자"}`,
    graphic: input.graphic,
    name: input.name?.trim() || input.graphic.sprite?.id || "동행자",
    kind: "actor",
  };
}

function actorFollowerGraphic(resourceId: string): EventPageGraphic | undefined {
  const asset = CHARSET_ASSETS.find((entry) => entry.id === resourceId || entry.textureKey === resourceId);
  const textureKey = asset?.textureKey ?? resourceId;
  return charsetFollowerGraphic(textureKey, 0);
}

function monsterFollowerName(instance: MonsterInstance, speciesName: string | undefined): string {
  return instance.nickname?.trim() || speciesName?.trim() || instance.instanceId;
}

function monsterFieldGraphic(graphic: MonsterSpeciesGraphic | undefined): EventPageGraphic {
  if (graphic?.fieldGraphic?.sprite?.id) return graphic.fieldGraphic;
  const fieldCharsetId = graphic?.fieldCharsetId?.trim();
  if (fieldCharsetId) return charsetFollowerGraphic(fieldCharsetId, 0);
  return charsetFollowerGraphic(DEFAULT_MONSTER_FIELD_CHARSET, 0);
}

function charsetFollowerGraphic(textureKey: string, characterIndex: number): EventPageGraphic {
  const asset = CHARSET_ASSETS.find((entry) => entry.id === textureKey || entry.textureKey === textureKey);
  const resolved = asset?.textureKey ?? textureKey;
  return {
    sprite: { type: "bundled", id: resolved },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
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
