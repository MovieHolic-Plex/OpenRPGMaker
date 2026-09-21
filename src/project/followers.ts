import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { CompanionConfig, Dir, EventPageGraphic, GameMap, MonsterSpeciesGraphic, Project } from "@/project/types";
import type { MonsterInstance, PlaySession, RuntimeFollower } from "@/project/session";
import { defaultActorCharacterResourceId } from "@/project/actorModel";
import { inBounds, isPassable } from "@/project/collision";

const MAX_TRAIL_POINTS = 64;
/** 궤적 버툴 길이. `gap * maxCompanions` 상한의 근거다. */
export const MAX_FOLLOWER_TRAIL_POINTS = MAX_TRAIL_POINTS;
const DEFAULT_MONSTER_FIELD_CHARSET = "tex_easyrpg_charset_monster1";

export type ResolvedCompanionRules = {
  /** 동료 사이 간격(칸). 기본 1. */
  readonly gap: number;
  /** 액터 동료 수 상한. undefined = 무제한. */
  readonly maxCompanions: number | undefined;
  readonly overflow: "reject" | "replaceOldest";
  readonly formation: "line" | "beside";
  readonly clearOnTransfer: boolean;
};

/** system.companions 원시 값 → 런타임이 쓰는 정규화 규칙. 생략하면 기존 동작(간격 1·무제한). */
export function resolveCompanionRules(config: CompanionConfig | undefined): ResolvedCompanionRules {
  const rawGap = config?.gap;
  const gap = typeof rawGap === "number" && Number.isFinite(rawGap)
    ? Math.min(MAX_TRAIL_POINTS, Math.max(1, Math.trunc(rawGap)))
    : 1;
  const rawMax = config?.maxCompanions;
  const maxCompanions = typeof rawMax === "number" && Number.isFinite(rawMax) && rawMax > 0
    ? Math.trunc(rawMax)
    : undefined;
  return {
    gap,
    maxCompanions,
    overflow: config?.overflow === "replaceOldest" ? "replaceOldest" : "reject",
    formation: config?.formation === "beside" ? "beside" : "line",
    clearOnTransfer: config?.clearOnTransfer === true,
  };
}

/** index 번째 동료가 읽는 궤적 지점. gap=1 이면 기존과 같은 trail[index]. */
function trailIndexFor(index: number, gap: number): number {
  return (index + 1) * gap - 1;
}

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
  // 인원 상한은 액터 동료에만 적용한다 — 몬스터 열차는 monsterParty 가 SSOT 라
  // 여기서 쟘라내리면 syncMonsterPartyFollowers 와 서로 다리를 잡는다.
  const rules = resolveCompanionRules(project.system.companions);
  let keptActors = actorFollowers;
  if (rules.maxCompanions !== undefined && actorFollowers.length + 1 > rules.maxCompanions) {
    if (rules.overflow === "reject") return null;
    keptActors = actorFollowers.slice(actorFollowers.length + 1 - rules.maxCompanions);
  }
  session.followers = [...keptActors, follower, ...monsterFollowers];
  if (!session.followerTrail || session.followerTrail.length === 0) {
    resetFollowerTrailNearPlayer(session, project.maps[session.currentMapId], project.system.companions);
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
    resetFollowerTrailNearPlayer(session, project.maps[session.currentMapId], project.system.companions);
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

export function resetFollowerTrailNearPlayer(
  session: PlaySession,
  map: GameMap | undefined,
  config?: CompanionConfig
): void {
  if ((session.followers?.length ?? 0) === 0) {
    session.followerTrail = [];
    return;
  }
  const { gap } = resolveCompanionRules(config);
  const candidates = adjacentFollowerCandidates(session.x, session.y);
  // 간격이 있으면 동료 한 명당 gap 칸을 소비하므로 그만큼 길게 깔아다 —
  // 짧게 남기면 뒷사람들이 전부 플레이어 칸으로 겹친다.
  const slots = trailIndexFor(session.followers.length - 1, gap) + 1;
  const trail = Array.from({ length: Math.min(slots, MAX_TRAIL_POINTS) }, (_, index) => {
    const candidate = candidates[index % candidates.length] ?? { x: session.x, y: session.y, direction: "down" as const };
    if (!map || inBounds(map, candidate.x, candidate.y)) return candidate;
    return { x: session.x, y: session.y, direction: candidate.direction };
  });
  session.followerTrail = trail;
}

/**
 * "beside" 대형이 쓸 수 있는 플레이어 인접 칸. world 를 주면 맵 밖·통행 불가 칸을 뺀다 —
 * 일렬 대형은 플레이어가 지나간 칸만 밟으므로 이 검사가 필요 없지만, 옆에 세우는 순간
 * 강·벽 위에 동료가 서는 게 가능해진다.
 */
function besideSlots(
  session: Pick<PlaySession, "x" | "y">,
  world: FollowerWorld | undefined
): readonly { readonly x: number; readonly y: number; readonly direction: Dir }[] {
  const candidates = adjacentFollowerCandidates(session.x, session.y);
  if (!world) return candidates;
  return candidates.filter(
    (candidate) => inBounds(world.map, candidate.x, candidate.y) && isPassable(world.project, world.map, candidate.x, candidate.y)
  );
}

export type FollowerWorld = { readonly project: Project; readonly map: GameMap };

export function followerPositions(
  session: Pick<PlaySession, "followers" | "followerTrail" | "x" | "y">,
  config?: CompanionConfig,
  world?: FollowerWorld
): readonly {
  readonly follower: RuntimeFollower;
  readonly x: number;
  readonly y: number;
  readonly direction?: Dir;
}[] {
  const { gap, formation } = resolveCompanionRules(config);
  const slots = formation === "beside" ? besideSlots(session, world) : [];
  return (session.followers ?? []).map((follower, index) => {
    // 옆자리가 모자라면(인접 4칸 초과 인원, 또는 물·벽으로 막힌 칸) 그 동료는 일렬로 떨어진다.
    const slot = slots[index];
    if (slot) return { follower, x: slot.x, y: slot.y, direction: slot.direction };
    const lineIndex = formation === "beside" ? index - slots.length : index;
    const trail = session.followerTrail?.[trailIndexFor(lineIndex, gap)];
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

/**
 * 동료 그래픽의 단일 생성 경로. `pattern` 은 "0~3 패턴"이 아니라 **시트 프레임 인덱스**이며,
 * 런타임(resolveEventSpriteTexture → charsetIdleFrameIndex → decodeCharsetFrameIndex)이 여기서
 * characterIndex 를 역산한다. 원시 숫자를 손으로 넣으면 캐릭터가 0번으로 고정되므로
 * 어떤 저작 경로도 charsetFrameIndex 를 우회하지 말고 이 함수를 쓴다.
 */
export function charsetFollowerGraphic(textureKey: string, characterIndex: number): EventPageGraphic {
  const asset = CHARSET_ASSETS.find((entry) => entry.id === textureKey || entry.textureKey === textureKey);
  const resolved = asset?.textureKey ?? textureKey;
  return {
    sprite: { type: "bundled", id: resolved },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
  };
}

/**
 * 팔로워 슬롯의 논리 좌표(보간 없음). 슬롯이 바뀐 프레임엔 직전 슬롯에서 이번 슬롯으로
 * 걸음 주기 동안 보간하는 것은 스프라이트 계층(src/player/playSceneFollowers.ts)의
 * 몫이다 — 슬롯 자체는 궤적 재생이라 결정적이어야 한다(세이브·테스트 계약).
 */
export type FollowerSlot = { readonly x: number; readonly y: number; readonly direction?: Dir };

/**
 * 슬롯별 보간 정보. 슬롯(목적지 칸)이 바뀐 프레임에 {from: 직전 슬롯, to: 이번 슬롯}으로
 * 걸음 주기(NPC_MOVE_DURATION_MS) 동안 화면 좌표를 이어 간다. 스프라이트의 현재 좌표를
 * 기준으로 쓰면 프레임마다 목적지가 자기 뒤로 밀리는 점근 추격이 되므로 반드시 슬롯이
 * 기준이다. 600ms(슬롯 주기 320ms + 여유) 동안 갱신이 없으면 만료시켜 첫 등장/부활이
 * 스폰 스냅으로 돌아가게 한다.
 */
export type FollowerSlotMotion = {
  readonly from: FollowerSlot;
  readonly to: FollowerSlot;
  readonly startedAt: number;
  /** 이번 걸음의 지속 시간(ms). 플레이어 걸음 주기와 맞춘다. */
  readonly durationMs: number;
};

/** 플레이어 사방 인접 4칸. 플레이어 칸 자체는 넣지 않는다 — 겹쳐 서면 동료가 안 보인다. */
function adjacentFollowerCandidates(x: number, y: number): readonly { readonly x: number; readonly y: number; readonly direction: Dir }[] {
  return [
    { x: x - 1, y, direction: "right" },
    { x: x + 1, y, direction: "left" },
    { x, y: y + 1, direction: "up" },
    { x, y: y - 1, direction: "down" },
  ];
}
