import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { CompanionConfig, Dir, EventPageGraphic, GameMap, MonsterSpeciesGraphic, Project } from "@/project/types";
import type { MonsterInstance, PlaySession, RuntimeFollower, RuntimeFollowerTrailPoint } from "@/project/session";
import { defaultActorCharacterResourceId } from "@/project/actorModel";
import { resolveActorAppearance } from "@/project/characterAppearances";
import { inBounds, isPassable } from "@/project/collision";
import { DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults/constants";
import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";

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

/**
 * 동료 한 명이 궤적에서 차지하는 칸 수(몸 길이) — 스프라이트 계층이 그린 크기로 정한다.
 * 24×32 칩을 16px 칸에 세우면 몸이 위로 한 칸 더 솟아서, 한 칸 간격 일렬은 앞사람 머리와 뒷사람
 * 발이 겹쳐 그려진다. 저작자가 `gap` 을 직접 정하지 않았으면 이 값이 간격이 된다. 세이브에 넣지 않는
 * 그리기 사실이라 세션 밖(WeakMap)에 둔다 — 조명·동료 공격 같은 다른 호출자도 같은 칸을 읽는다.
 */
const followerBodySpan = new WeakMap<object, number>();
/** 몸 길이 상한. 궤적을 이만큼은 늘 깔아 두므로 몸 길이가 나중에 정해져도 뒷사람이 플레이어 칸으로 떨어지지 않는다. */
export const MAX_FOLLOWER_BODY_SPAN = 3;

export function setFollowerBodySpan(session: object, span: number): void {
  followerBodySpan.set(session, Math.min(MAX_FOLLOWER_BODY_SPAN, Math.max(1, Math.trunc(span) || 1)));
}

export function getFollowerBodySpan(session: object): number {
  return followerBodySpan.get(session) ?? 1;
}

/** 실제로 쓰는 간격: 저작한 gap 이 있으면 그것, 없으면 그려진 몸 길이. */
function effectiveGap(session: object, config: CompanionConfig | undefined): number {
  const authored = config?.gap;
  if (typeof authored === "number" && Number.isFinite(authored)) return resolveCompanionRules(config).gap;
  // 고전 빵부스러기: 앞사람 바로 한 걸음 뒤(크로노 트리거·마더·포켓몬). 몸이 큰 칩은 조금 겹쳐 그려진다 — 그 게임들과 같다.
  if (isBreadcrumbFollow(config)) return 1;
  return getFollowerBodySpan(session);
}

/** 고전 빵부스러기 뒤따르기(기본). companions.followMode "spaced" 만 옛 동작. */
export function isBreadcrumbFollow(config: CompanionConfig | undefined): boolean {
  return config?.followMode !== "spaced";
}

/** 몸끼리 띄울 최소 거리(체비쇼프, 칸). 1 = 같은 칸만 피한다(몸 길이 1·옛 동작). */
export function followerMinDistance(session: object, config: CompanionConfig | undefined): number {
  return Math.max(1, Math.min(effectiveGap(session, config), getFollowerBodySpan(session)));
}

/** index 번째 동료가 읽는 궤적 지점. gap=1 이면 기존과 같은 trail[index]. */
function trailIndexFor(index: number, gap: number): number {
  return (index + 1) * gap - 1;
}

/** 동료 `count` 명이 각자 읽을 칸을 가지려면 궤적이 얼마나 길어야 하는가(resetFollowerTrailNearPlayer 가 깔아 두는 길이와 같다). */
function requiredTrailLength(session: object, config: CompanionConfig | undefined, count: number): number {
  const lay = Math.max(effectiveGap(session, config), typeof config?.gap === "number" ? 1 : MAX_FOLLOWER_BODY_SPAN);
  return Math.min(trailIndexFor(count - 1, lay) + 1, MAX_TRAIL_POINTS);
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
  if (!follower) {
    console.warn(`[addFollower] 동료를 붙이지 못했습니다: ${followerFailureReason(project, input)}`);
    return null;
  }
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
    if (rules.overflow === "reject") {
      console.warn(`[addFollower] 동료 상한 ${rules.maxCompanions}명에 닿아 '${follower.name}' 을(를) 붙이지 않았습니다(overflow:"reject").`);
      return null;
    }
    keptActors = actorFollowers.slice(actorFollowers.length + 1 - rules.maxCompanions);
  }
  session.followers = [...keptActors, follower, ...monsterFollowers];
  // 궤적이 비었거나, 새 동료가 읽을 칸까지 모자라면 다시 깐다 — 이미 동료가 있는 채로 한 명이 더 합류하면
  // 궤적이 비어 있지 않아 예전엔 그대로 두었고, 새 동료는 읽을 칸이 없어 숨거나 플레이어 칸에 겹쳤다(3인 파티가 2명으로 보임).
  const companions = project.system.companions;
  const needed = requiredTrailLength(session, companions, session.followers.length);
  if (!session.followerTrail || session.followerTrail.length < needed) {
    resetFollowerTrailNearPlayer(session, project.maps[session.currentMapId], companions, { project });
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
  // 게임 설정으로 몬스터 동행을 껐으면 액터 동료만 남긴다.
  const walkWithMonsters = project.system.companions?.monsterFollowers !== false;
  for (const instanceId of walkWithMonsters ? session.monsterParty ?? [] : []) {
    const instance = session.monsterInstances?.[instanceId];
    if (!instance) continue;
    const species = (project.database.monsterSpecies ?? []).find((record) => record.id === instance.speciesId);
    // 에메랄드 문법에는 걷는 동료 몬스터가 없다. 종에 필드 그림이 없으면 기본값(EasyRPG 초록 슬라임)이 모든 몬스터를 대신해
    // 사막 마을·연구소·체육관마다 같은 초록 덩이 둘이 주인공을 따라다녔다(2026-10-07 사막 기획서 플레이 영상, 사용자 지적).
    if (isEmeraldMonsterStyle(project) && !species?.graphic?.fieldGraphic?.sprite?.id && !species?.graphic?.fieldCharsetId?.trim()) continue;
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
    resetFollowerTrailNearPlayer(session, project.maps[session.currentMapId], project.system.companions, { project });
  }
}

/** 파티 동료로 걷는 활성 멤버 수 상한(선두 포함). system.activeSlots 가 없으면 4명. */
const DEFAULT_ACTIVE_PARTY_SLOTS = 4;

function isPartyFollower(entry: RuntimeFollower): boolean {
  return entry.source === "party";
}

/**
 * system.companions.fromParty 가 켜져 있으면 파티 선두 뒤 활성 멤버를 동료로 맞춘다(크로노 트리거식).
 * 저작 addFollower 로 이미 붙은 배우는 다시 붙이지 않는다. 꺼져 있으면 파티 파생 동료만 걷어낸다 —
 * 옛 프로젝트는 파티 파생 동료가 없으므로 아무것도 바뀌지 않는다. 멱등이라 매 새로고침마다 불러도 된다.
 */
export function syncPartyFollowers(project: Project, session: PlaySession): void {
  const current = session.followers ?? [];
  const enabled = project.system.companions?.fromParty === true;
  if (!enabled && !current.some(isPartyFollower)) return;
  const others = current.filter((entry) => !isPartyFollower(entry));
  const manualActorIds = new Set(others.flatMap((entry) => entry.kind !== "monster" && entry.eventId ? [entry.eventId] : []));
  const partyFollowers: RuntimeFollower[] = [];
  if (enabled) {
    const slots = project.system.activeSlots ?? DEFAULT_ACTIVE_PARTY_SLOTS;
    for (const actorId of session.partyActorIds.slice(1, Math.max(1, slots))) {
      if (manualActorIds.has(actorId)) continue;
      const follower = followerFromInput(project, { actorId });
      if (!follower) {
        console.warn(`[fromParty] 파티 동료를 붙이지 못했습니다: ${followerFailureReason(project, { actorId })}`);
        continue;
      }
      partyFollowers.push({ ...follower, source: "party" });
    }
  }
  const before = current.filter(isPartyFollower).map((entry) => `${entry.id}|${spriteKeyOf(entry.graphic)}`).join(",");
  const after = partyFollowers.map((entry) => `${entry.id}|${spriteKeyOf(entry.graphic)}`).join(",");
  if (before === after) return;
  const actorOthers = others.filter((entry) => entry.kind !== "monster" && !entry.monsterInstanceId);
  const monsterOthers = others.filter((entry) => entry.kind === "monster" || Boolean(entry.monsterInstanceId));
  session.followers = [...partyFollowers, ...actorOthers, ...monsterOthers];
  const needed = requiredTrailLength(session, project.system.companions, session.followers.length);
  if (session.followers.length === 0) session.followerTrail = [];
  else if ((session.followerTrail?.length ?? 0) < needed) {
    resetFollowerTrailNearPlayer(session, project.maps[session.currentMapId], project.system.companions, { project });
  }
}

function spriteKeyOf(graphic: EventPageGraphic): string {
  return `${graphic.sprite?.id ?? ""}:${String(graphic.pattern ?? "")}`;
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

/**
 * 맵 진입·순간이동 직후 궤적을 새로 깐다. 동료는 플레이어 **뒤**(바라보는 방향의 반대)로 한 칸씩
 * 일렬로 선다 — HGSS 식. 예전에는 사방 인접 칸(좌·우·아래·위)을 차례로 나눠 줘서 동료 둘이 주인공
 * 좌우에 붙어 섰고, 24×32 칩은 한 칸 옆이어도 몸이 주인공 위에 겹쳐 그려졌다(아스트라 호라이즌 실측).
 *
 * 뒤가 막혔으면(벽·물·맵 밖) 직전 칸에 붙은 다른 빈 칸으로 꺾고, 그것도 없으면 플레이어에게서 가장
 * 가까운 빈 칸을 쓴다. 플레이어 칸과 이미 쓴 칸은 절대 다시 주지 않는다 — 같은 칸 두 명은 겹친다.
 * `project` 가 없으면 통행은 따지지 않고 맵 범위만 본다(옛 호출자·순수 세션 테스트).
 */
export function resetFollowerTrailNearPlayer(
  session: PlaySession,
  map: GameMap | undefined,
  config?: CompanionConfig,
  options?: {
    readonly project?: Project;
    readonly facing?: Dir;
    /** 칸을 막는 런타임 이벤트(NPC·간판 등) — 동료를 그 위에 세우지 않는다. */
    readonly blocked?: (x: number, y: number) => boolean;
  }
): void {
  if ((session.followers?.length ?? 0) === 0) {
    session.followerTrail = [];
    return;
  }
  // 간격이 있으면 동료 한 명당 gap 칸을 소비하므로 그만큼 길게 깔아다 —
  // 짧게 남기면 뒷사람들이 전부 플레이어 칸으로 겹친다. 몸 길이는 스프라이트가 생긴 뒤에야 정해지므로
  // 자동 간격일 때는 상한 몸 길이만큼 깔아 둔다(궤적은 지나온 칸 기록이라 길어도 해가 없다).
  const gap = Math.max(effectiveGap(session, config), typeof config?.gap === "number" ? 1 : MAX_FOLLOWER_BODY_SPAN);
  const slots = Math.min(trailIndexFor(session.followers.length - 1, gap) + 1, MAX_TRAIL_POINTS);
  const facing = options?.facing ?? session.playerFacing ?? "down";
  // 출입구(장소 이동 이벤트) 칸은 비워 둔다 — 전멸 뒤 회복 센터에 위를 보고 서면 「뒤」가 아래 벽의 출구 매트라
  // 동료가 방 밖 검은 곳에 서 있었다(2026-10-21 적대 검수 M11).
  const exits = new Set((map?.events ?? []).filter((event) => JSON.stringify(event.pages ?? []).includes('"kind":"transfer"')).map((event) => `${event.x},${event.y}`));
  const open = (x: number, y: number): boolean => {
    if (options?.blocked?.(x, y)) return false;
    if (exits.has(`${x},${y}`)) return false;
    if (!map) return true;
    if (!inBounds(map, x, y)) return false;
    return options?.project ? isPassable(options.project, map, x, y) : true;
  };
  // 바로 뒤 칸이 문·계단·벽이면(문으로 막 들어왔다) 옆·앞 칸에 세우지 않고 잠깐 숨긴다 — 주인공이 첫 걸음을 떼면
  // 주인공이 떠난 칸(문 앞·계단 앞)에서 나타나 뒤를 따른다. 옆·앞 칸에 세우면 주인공이 그쪽으로 걸을 때 둘이 서로를
  // 뚫고 자리를 바꿨다 — 몬스터 열차(2026-10-23 회복 센터 문·2층 계단)와 파티 동료(J9: 동굴 계단으로 내려오면 동료가
  // 주인공 앞에 섰다가 첫 걸음에 뒤로 튀었다) 모두. 저작자가 spreadWhenBlocked 를 켰으면 followerPositions 가 빈 궤적일 때
  // 옆 빈 칸에 세운다(그 선택은 그대로 존중한다).
  const back = DIR_STEP[OPPOSITE[facing]];
  if (!open(session.x + back.dx, session.y + back.dy)) {
    session.followerTrail = [];
    return;
  }
  // 고전 빵부스러기: 맵에 들어서면 동료가 주인공 칸에 겹쳐 같은 쪽을 보고 선다 — 주인공이 걸으면 밟은 칸을 따라 한 명씩 풀려 나온다
  // (마더·크로노 트리거). 문 밖·벽 너머 칸에 미리 세우지 않는다.
  const monsterOnly = session.followers.every((entry) => entry.kind === "monster" || Boolean(entry.monsterInstanceId));
  if (isBreadcrumbFollow(config) && !monsterOnly) {
    session.followerTrail = Array.from({ length: slots }, () => ({ x: session.x, y: session.y, direction: facing }));
    return;
  }
  session.followerTrail = trailBehind({ x: session.x, y: session.y }, facing, slots, open);
}

const DIR_STEP: Readonly<Record<Dir, { readonly dx: number; readonly dy: number }>> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};
const OPPOSITE: Readonly<Record<Dir, Dir>> = { up: "down", down: "up", left: "right", right: "left" };

/** 한 칸에서 다음 칸으로 갈 때 동료가 바라볼 방향(앞사람 쪽). */
function dirToward(from: { readonly x: number; readonly y: number }, to: { readonly x: number; readonly y: number }): Dir {
  if (to.x < from.x) return "left";
  if (to.x > from.x) return "right";
  return to.y < from.y ? "up" : "down";
}

/**
 * 플레이어 칸에서 시작해 「뒤로」 뻗는 서로 다른 칸 `count` 개. 각 칸은 앞사람 칸에 붙어 있으려 하고
 * (곧장 뒤 → 옆 → 앞 순), 막다른 곳이면 플레이어에게서 가까운 빈 칸으로 넘어간다. 빈 칸이 아예 모자라면
 * 남은 동료는 가장 가까운 칸을 다시 쓰지 않고 플레이어 바로 뒤 칸(맵 밖이라도)으로 둔다 — 플레이어 칸은 주지 않는다.
 */
function trailBehind(
  hero: { readonly x: number; readonly y: number },
  facing: Dir,
  count: number,
  open: (x: number, y: number) => boolean
): RuntimeFollowerTrailPoint[] {
  const behind = OPPOSITE[facing];
  const sidesOf = (dir: Dir): readonly Dir[] => (dir === "up" || dir === "down" ? ["left", "right"] : ["up", "down"]);
  // 첫 칸은 주인공 바로 뒤 → 옆 → 앞. 둘째 칸부터는 앞 걸음의 방향을 이어 간다(곧장 → 옆 → 되돌아감) —
  // 뒤가 막혀 첫 칸이 옆으로 빠져도 줄이 지그재그·대각선으로 꺾이지 않고 칸마다 사방 인접으로 이어진다.
  const firstOrder: readonly Dir[] = [behind, ...sidesOf(facing), facing];
  const used = new Set<string>([`${hero.x},${hero.y}`]);
  const key = (x: number, y: number): string => `${x},${y}`;
  const trail: RuntimeFollowerTrailPoint[] = [];
  let prev = hero;
  let stepDir: Dir | null = null;
  for (let i = 0; i < count; i += 1) {
    let next: { x: number; y: number } | null = null;
    const order: readonly Dir[] = stepDir ? [stepDir, ...sidesOf(stepDir), OPPOSITE[stepDir]] : firstOrder;
    for (const dir of order) {
      const x = prev.x + DIR_STEP[dir].dx, y = prev.y + DIR_STEP[dir].dy;
      if (!used.has(key(x, y)) && open(x, y)) { next = { x, y }; break; }
    }
    next ??= nearestOpenTile(hero, used, open);
    if (!next) {
      // 쓸 수 있는 칸이 하나도 없다(1칸짜리 방 등) — 플레이어 칸만은 피한다.
      const back = DIR_STEP[behind];
      next = { x: hero.x + back.dx * (i + 1), y: hero.y + back.dy * (i + 1) };
    }
    used.add(key(next.x, next.y));
    trail.push({ x: next.x, y: next.y, direction: dirToward(next, prev) });
    if (Math.abs(next.x - prev.x) + Math.abs(next.y - prev.y) === 1) stepDir = dirToward(prev, next);
    prev = next;
  }
  return trail;
}

/**
 * 플레이어에게서 걸어서 가장 가까운 빈 칸(통행 칸만 따라 넓히는 BFS, 8걸음 안). 카운터 너머처럼
 * 막혀서 못 가는 칸은 거리가 가까워도 주지 않는다.
 */
function nearestOpenTile(
  hero: { readonly x: number; readonly y: number },
  used: ReadonlySet<string>,
  open: (x: number, y: number) => boolean
): { x: number; y: number } | null {
  const seen = new Set<string>([`${hero.x},${hero.y}`]);
  let frontier: { x: number; y: number }[] = [{ x: hero.x, y: hero.y }];
  for (let depth = 0; depth < 8 && frontier.length > 0; depth += 1) {
    const next: { x: number; y: number }[] = [];
    for (const cell of frontier) {
      for (const dir of ["up", "left", "right", "down"] as const) {
        const x = cell.x + DIR_STEP[dir].dx, y = cell.y + DIR_STEP[dir].dy;
        const key = `${x},${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!open(x, y)) continue;
        if (!used.has(key)) return { x, y };
        next.push({ x, y });
      }
    }
    frontier = next;
  }
  return null;
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

export type FollowerWorld = {
  readonly project: Project;
  readonly map: GameMap;
  /** 칸을 막는 런타임 이벤트(NPC·간판 등). 걷는 NPC 가 궤적 칸에 들어서도 동료를 그 위에 세우지 않는다. */
  readonly blocked?: (x: number, y: number) => boolean;
  /** 이벤트(대화·장면)가 도는 중 — companions.fanOutInScenes 가 켜져 있으면 둘째 동료부터 옆 줄에 선다. */
  readonly inScene?: boolean;
  /**
   * 이야기 장면 중 — 컷신 제어가 켜졌거나, 도는 이벤트에서 선두가 아닌 파티원이 대사를 했다.
   * companions.display "scenesOnly"(FF6 식)는 이때만 액터 동료를 주인공 옆에 세우고, 그 밖에는 숨긴다.
   */
  readonly storyScene?: boolean;
  /** 주인공이 보는 방향. 궤적 없이 옆으로 비켜 선 동료(spreadWhenBlocked — 문으로 막 들어온 직후)는 주인공과 같은 쪽을 본다. */
  readonly playerFacing?: Dir;
  /**
   * 주인공이 서 있는(또는 지금 걸어 들어가는) 칸. 걸음을 **시작하는** 순간 동료도 함께 한 칸 내딛게 하려고(HGSS 식 동시 걸음)
   * 세션 좌표(걸음이 끝나야 바뀐다) 대신 목적지 칸을 준다. 없으면 세션 좌표.
   */
  readonly heroAt?: { readonly x: number; readonly y: number };
};

export function followerPositions(
  session: Pick<PlaySession, "followers" | "followerTrail" | "x" | "y">,
  config?: CompanionConfig,
  world?: FollowerWorld
): readonly {
  readonly follower: RuntimeFollower;
  readonly x: number;
  readonly y: number;
  readonly direction?: Dir;
  /**
   * 설 칸이 없다 — 궤적이 아직 짧거나(문으로 막 들어와 뒤가 막힘) 남은 칸이 모두 주인공·앞 동료와 붙어 있다.
   * x/y 는 주인공 칸이고, 그리는 쪽은 숨긴다. 주인공이 걸어 궤적이 생기면 그 자리에 나타난다.
   */
  readonly hidden?: boolean;
}[] {
  const { formation } = resolveCompanionRules(config);
  const breadcrumb = isBreadcrumbFollow(config) && formation === "line";
  // 걸음을 막 시작한 주인공은 목적지 칸에 선 것으로 본다 — 동료가 비워지는 칸(주인공이 떠나는 칸)으로 같이 걷는다.
  const hero = world?.heroAt ?? { x: session.x, y: session.y };
  const gap = effectiveGap(session, config);
  const slots = formation === "beside" ? besideSlots(hero, world) : [];
  // 몸끼리 띄울 최소 거리(체비쇼프, 칸). 1 이면 「같은 칸만 피한다」 — 몸 길이 1 인 옛 동작 그대로다.
  // 24×32 칩(몸 길이 2)은 대각선·옆 이웃도 겹쳐 그려지므로 모퉁이·되돌아오기에서 그 칸을 쓰지 않는다.
  const minDistance = followerMinDistance(session, config);
  // 옆자리(beside) 동료는 저작자가 고른 붙어 서기라 거리 판정에 넣지 않는다 — 그 대형의 기존 계약 그대로다.
  const taken: { x: number; y: number }[] = [{ x: hero.x, y: hero.y }];
  const blocked = world?.blocked;
  const clear = (point: { readonly x: number; readonly y: number }): boolean =>
    !blocked?.(point.x, point.y)
    && taken.every((other) => Math.max(Math.abs(other.x - point.x), Math.abs(other.y - point.y)) >= minDistance);
  const trail = session.followerTrail ?? [];
  const followers = session.followers ?? [];
  // 같은 궤적·같은 주인공 칸이면 같은 답 — 조명·동료 공격이 한 프레임에 여러 번 물어도 「기다리기」가 흔들리지 않는다.
  const memo = followerPlacementMemo.get(session);
  if (memo && memo.trail === trail && memo.x === hero.x && memo.y === hero.y && memo.followers === followers
    && memo.gap === gap && memo.minDistance === minDistance && slots.length === 0 && formation === "line" && !blocked
    && config?.display !== "scenesOnly" && config?.sceneFormation !== "abreast") {
    return memo.result;
  }
  const previous = memo?.result;
  let cursor = -1;
  const placed: { readonly x: number; readonly y: number; readonly direction?: Dir; readonly hidden?: boolean }[] = [];
  const result = followers.map((follower, index) => {
    const entry = sceneFacing(placeOne(follower, index));
    placed.push(entry);
    return entry;
  });
  // 장면 중에는 동료가 주인공과 같은 쪽(말하는 이)을 본다 — 주인공이 동료 쪽으로 돌아서면(동료가 말할 때) 동료는 주인공을 본다.
  // 궤적 방향 그대로 두면 포고 중 동료가 화면만 보고, 주인공이 돌아서도 동료는 등을 보였다(폴른 스타 VQA r6).
  function sceneFacing<T extends { readonly x: number; readonly y: number; readonly direction?: Dir; readonly hidden?: boolean }>(entry: T): T {
    const facing = world?.inScene ? world.playerFacing : undefined;
    if (!facing || entry.hidden) return entry;
    const dx = entry.x - hero.x, dy = entry.y - hero.y;
    const along = facing === "up" ? -dy : facing === "down" ? dy : facing === "left" ? -dx : dx;
    const across = facing === "up" || facing === "down" ? Math.abs(dx) : Math.abs(dy);
    const opposite: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };
    return { ...entry, direction: along > 0 && along <= 4 && across <= along ? opposite[facing] : facing };
  }
  function placeOne(follower: RuntimeFollower, index: number) {
    // FF6 식(companions.display "scenesOnly"): 액터 동료는 필드에서 숨고, 이야기 장면에서만 주인공 바로 옆 빈 칸에 선다.
    // 몬스터 동행은 monsterFollowers 가 따로 정하므로 여기서 건드리지 않는다.
    if (config?.display === "scenesOnly" && follower.kind !== "monster" && !follower.monsterInstanceId) {
      const spot = world?.storyScene
        ? (config.sceneFormation === "abreast" ? abreastCell(hero, index, world, clear, minDistance) : null) ?? nearestSpreadCell(hero, world, clear)
        : null;
      if (!spot) return { follower, x: hero.x, y: hero.y, direction: follower.graphic.direction, hidden: true };
      taken.push(spot);
      return { follower, x: spot.x, y: spot.y, direction: world?.playerFacing ?? follower.graphic.direction };
    }
    // 뒤따르기(follow)여도 sceneFormation "abreast" 면 이야기 장면(컷신 잠금) 동안은 횡대로 선다 — 장면이 끝나 걸으면 궤적으로 돌아온다.
    if (config?.sceneFormation === "abreast" && world?.storyScene && follower.kind !== "monster" && !follower.monsterInstanceId) {
      const spot = abreastCell(hero, index, world, clear, minDistance);
      if (spot) {
        taken.push(spot);
        return { follower, x: spot.x, y: spot.y, direction: world.playerFacing ?? follower.graphic.direction };
      }
    }
    // 옆자리가 모자라면(인접 4칸 초과 인원, 또는 물·벽으로 막힌 칸) 그 동료는 일렬로 떨어진다.
    const slot = slots[index];
    if (slot && !blocked?.(slot.x, slot.y)) return { follower, x: slot.x, y: slot.y, direction: slot.direction };
    // 고전 빵부스러기(기본): 앞사람이 gap 걸음 전에 밟은 칸 — 건너뛰기·기다리기·비켜 서기 없이 그 칸 그대로.
    // 궤적이 짧으면(막 맵에 들어옴) 가장 오래된 칸(= 들어선 칸)에 겹쳐 선다. 장면 대형(위 분기)은 그대로 쓴다.
    if (breadcrumb && !(config?.fanOutInScenes === true && world?.inScene && index > 0)) {
      if (trail.length === 0) return { follower, x: hero.x, y: hero.y, direction: follower.graphic.direction, hidden: true };
      const crumb = Math.min(trailIndexFor(index, gap), trail.length - 1);
      const point = trail[crumb]!;
      cursor = crumb;
      taken.push({ x: point.x, y: point.y });
      return { follower, x: point.x, y: point.y, direction: point.direction ?? follower.graphic.direction };
    }
    // 1) 앞사람에게서 gap 칸 뒤 궤적 점.
    // 2) 그 점이 주인공·앞 동료와 붙어 있으면(모퉁이·되돌아오기) 지금 선 칸에서 **기다린다** — 그 칸이
    //    여전히 궤적 위·앞사람 뒤이고 붙어 있지 않을 때. 더 뒤 점으로 뛰었다 돌아오면 두 칸씩 미끄러진다.
    // 3) 그것도 안 되면 더 뒤의 궤적 점. 같은 칸·붙은 칸에 세우면 그림이 겹친다.
    let at = cursor + gap;
    if (at >= trail.length || !clear(trail[at]!)) {
      const before = previous?.find((entry) => entry.follower.id === follower.id && entry.follower.name === follower.name);
      const waitAt = before && !before.hidden
        ? trail.findIndex((point, k) => k > cursor && point.x === before.x && point.y === before.y)
        : -1;
      if (waitAt >= 0 && clear(trail[waitAt]!)) at = waitAt;
      else {
        at = cursor + gap;
        while (at < trail.length && !clear(trail[at]!)) at += 1;
      }
    }
    // 장면 중 ㄴ자 대형(companions.fanOutInScenes): 둘째 동료부터 앞 동료 옆 칸(몸 길이만큼)에 선다.
    const front = index > 0 ? placed[index - 1] : undefined;
    if (front && !front.hidden && config?.fanOutInScenes === true && world?.inScene) {
      const side = besideOf(hero, front, minDistance, world, clear);
      if (side) {
        taken.push(side);
        return { follower, x: side.x, y: side.y, direction: front.direction ?? follower.graphic.direction };
      }
    }
    const point = trail[at];
    if (!point) {
      // 문으로 막 들어와 궤적이 비었다. 걸을 때는 숨겼다가 주인공이 떠난 칸에서 나타나게 두고(J9: 앞에 세우면 첫 걸음에
      // 뒤로 튄다), 도착하자마자 이야기 장면(컷신 잠금·동료 대사)이 돌면 액터 동료는 옆 빈 칸에 세운다 — 문 이벤트 자체도
      // 이벤트라 inScene 으로는 가르지 않는다(그러면 문을 지날 때마다 앞에 섰다).
      const actor = follower.kind !== "monster" && !follower.monsterInstanceId;
      const spread = (config?.spreadWhenBlocked === true || (actor && world?.storyScene === true)) && world ? nearestSpreadCell(hero, world, clear) : null;
      if (spread) {
        taken.push(spread);
        return { follower, x: spread.x, y: spread.y, direction: world?.playerFacing ?? follower.graphic.direction };
      }
      return { follower, x: hero.x, y: hero.y, direction: follower.graphic.direction, hidden: true };
    }
    cursor = at;
    taken.push({ x: point.x, y: point.y });
    return { follower, x: point.x, y: point.y, direction: point.direction ?? follower.graphic.direction };
  }
  followerPlacementMemo.set(session, { trail, x: hero.x, y: hero.y, followers, gap, minDistance, result });
  return result;
}

/**
 * companions.fanOutInScenes: 앞 동료 옆(주인공→앞 동료 축에 수직으로 몸 길이만큼) 칸. 사이 칸까지 통행 가능해야 한다 —
 * 벽 너머·기둥 위에 세우지 않는다. 왼쪽을 먼저 보고, 안 되면 오른쪽. 둘 다 안 되면 null(궤적 자리로 돌아간다).
 */
function besideOf(
  hero: { readonly x: number; readonly y: number },
  front: { readonly x: number; readonly y: number },
  distance: number,
  world: FollowerWorld,
  clear: (point: { readonly x: number; readonly y: number }) => boolean,
): { x: number; y: number } | null {
  const vertical = front.x === hero.x;
  for (const sign of [-1, 1]) {
    const cells = Array.from({ length: distance }, (_, k) => vertical
      ? { x: front.x + sign * (k + 1), y: front.y }
      : { x: front.x, y: front.y + sign * (k + 1) });
    const ok = cells.every((cell) => inBounds(world.map, cell.x, cell.y) && isPassable(world.project, world.map, cell.x, cell.y) && !world.blocked?.(cell.x, cell.y));
    const target = cells[cells.length - 1]!;
    if (ok && clear(target)) return target;
  }
  return null;
}

/**
 * companions.spreadWhenBlocked: 궤적에 설 칸이 없을 때 쓰는 자리. 주인공 칸에서 통행 가능한 칸만 밟아 넓혀 가며
 * (벽 너머로 건너뛰지 않는다) 처음 만나는 「떨어진」 칸(clear — 주인공·앞 동료·막는 이벤트와 몸 길이만큼)을 고른다.
 * 6칸 안에 없으면 null(숨김으로 돌아간다).
 */
/**
 * 고정 횡대(companions.sceneFormation "abreast"): index 번째 동료의 자리 — 주인공이 보는 방향에 수직으로 좌·우·바깥 좌·바깥 우.
 * 간격은 몸 길이(followerMinDistance 와 같은 체비쇼프 거리)라 큰 칩도 겹치지 않는다. 그 칸이 막혔으면 null(호출자가 가까운 빈 칸으로).
 */
function abreastCell(
  hero: { readonly x: number; readonly y: number },
  index: number,
  world: FollowerWorld,
  clear: (point: { readonly x: number; readonly y: number }) => boolean,
  bodySpan: number,
): { x: number; y: number } | null {
  const facing = world.playerFacing ?? "down";
  const across = facing === "up" || facing === "down" ? { dx: 1, dy: 0 } : { dx: 0, dy: 1 };
  // 첫째는 화면 왼쪽(옆을 보면 위), 둘째는 오른쪽(아래), 셋째·넷째는 그 바깥.
  const side = index % 2 === 0 ? -1 : 1;
  const ring = Math.floor(index / 2) + 1;
  const span = Math.max(1, bodySpan);
  const cell = { x: hero.x + across.dx * side * ring * span, y: hero.y + across.dy * side * ring * span };
  if (!inBounds(world.map, cell.x, cell.y) || !isPassable(world.project, world.map, cell.x, cell.y)) return null;
  return clear(cell) ? cell : null;
}

function nearestSpreadCell(
  hero: { readonly x: number; readonly y: number },
  world: FollowerWorld,
  clear: (point: { readonly x: number; readonly y: number }) => boolean,
): { x: number; y: number } | null {
  const seen = new Set<string>([`${hero.x},${hero.y}`]);
  let frontier: { x: number; y: number }[] = [{ x: hero.x, y: hero.y }];
  for (let depth = 0; depth < 6 && frontier.length; depth += 1) {
    const next: { x: number; y: number }[] = [];
    for (const cell of frontier) {
      for (const dir of ["down", "left", "right", "up"] as const) {
        const x = cell.x + DIR_STEP[dir].dx, y = cell.y + DIR_STEP[dir].dy;
        const key = `${x},${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!inBounds(world.map, x, y) || !isPassable(world.project, world.map, x, y)) continue;
        if (clear({ x, y })) return { x, y };
        next.push({ x, y });
      }
    }
    frontier = next;
  }
  return null;
}

type FollowerPlacement = ReturnType<typeof followerPositions>;
/** 직전 배치(세션별). 「기다리기」 판단의 기준이고, 같은 입력의 반복 질의를 그대로 돌려준다. 세이브에 넣지 않는다. */
const followerPlacementMemo = new WeakMap<object, {
  readonly trail: readonly unknown[];
  readonly x: number;
  readonly y: number;
  readonly followers: readonly RuntimeFollower[];
  readonly gap: number;
  readonly minDistance: number;
  readonly result: FollowerPlacement;
}>();

function followerFromInput(
  project: Project,
  input: { readonly actorId?: string; readonly graphic?: EventPageGraphic; readonly name?: string }
): RuntimeFollower | null {
  if (input.actorId) {
    const record = project.database.actors.find((entry) => entry.id === input.actorId);
    if (!record && !input.graphic && !defaultActorCharacterResourceId({ id: input.actorId })) return null;
    // 주인공 스프라이트(playerSpriteResources)와 같은 규칙: 외형 세트 → 배우 걷기 그림(+칸) → 기본 배우 그림.
    const actor = record ? resolveActorAppearance(project, record) : undefined;
    const ownResourceId = actor?.characterResourceId?.trim();
    const defaultResourceId = defaultActorCharacterResourceId({ id: input.actorId });
    const graphic = ownResourceId
      ? charsetFollowerGraphic(ownResourceId, actor?.characterIndex ?? 0)
      : defaultResourceId
        ? charsetFollowerGraphic(defaultResourceId, 0)
        // 걷기 그림이 없는 배우도 사라지지 않게 한다 — 저작 그래픽, 없으면 기본 주민 그림.
        : input.graphic ?? charsetFollowerGraphic(DEFAULT_EASYRPG_CHARSET_ID, 0);
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

function followerFailureReason(
  project: Project,
  input: { readonly actorId?: string; readonly graphic?: EventPageGraphic }
): string {
  if (input.actorId && !project.database.actors.some((entry) => entry.id === input.actorId) && !input.graphic) {
    return `배우 '${input.actorId}' 가 데이터베이스에 없습니다`;
  }
  if (!input.actorId && !input.graphic) return "actorId 도 graphic 도 없습니다";
  return "그래픽을 정할 수 없습니다";
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
    sprite: { type: resolved.startsWith('shared_charset_actor_') ? "uploaded" : "bundled", id: resolved },
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
  /** 앞사람 몸에 들어가지 않으려고 이번 걸음에서 멈춰 선 누적 시간(ms). 한 걸음 길이를 넘기면 더 멈추지 않는다. */
  readonly pausedMs?: number;
  /**
   * 주인공 걸음과 함께 시작한 걸음(beginFollowerStep). 진행도는 시계가 아니라 주인공 걸음 진행도를 그대로 쓴다 —
   * 대시·탈것 배속·프레임 분할이 달라도 동료가 한 프레임도 뒤처지거나 앞서지 않는다.
   */
  readonly lockToHero?: boolean;
  /**
   * 대각선 이동(두 축이 다 바뀜)을 한 칸씩 꺾어 가는 경유 지점. 슬롯이 사방 인접이 아닐 때 직선으로 미끄러지면
   * 비스듬히 가로지르고 바라보는 쪽도 틀린다 — 클래식 JRPG 처럼 한 축을 먼저 걷고 꺾는다.
   */
  readonly via?: FollowerSlot;
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
