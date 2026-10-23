// 명작 공백 G1(2026-09-27) — 이벤트가 액터·파티·시점·회차·요일·문자열을 읽는 조건과 조회.
//
// 한 곳에서만 해석한다: 페이지 조건(evalCondition)·조건 분기·Data Query 가 같은 함수를 쓴다.
// 해석할 수 없는 대상(파티에 없는 배우, 빈 파티, 시계 없음)은 조건이면 거짓, 조회면 0 이다 —
// 없는 대상을 참으로 통과시키면 삭제·편집 사고가 이벤트 폭주로 번진다(insideLocation 과 같은 원칙).
import { earnedBadgeCount } from "@/project/badgeProgress";
import { compareVariableValue } from "@/project/conditionEvaluation";
import type { ActorQueryCondition, ConditionCompareOp, Dir } from "@/project/types";
import type { GameTime } from "@/project/gameTime";
import { SEASONS } from "@/project/gameTime";
import { eventSeesPlayer, type SightLocation, type SightPoint } from "@/project/conditionEventSight";

/** 조건 평가에 필요한 세션 조각. PlaySession 이 구조적으로 만족한다. */
export interface ActorQuerySession {
  readonly partyActorIds: readonly string[];
  /** 몬스터 수집 파티(있으면 「파티 인원」은 이 몬스터 수다 — 센터 회복 연출이 파티 수만큼 볼을 놓는다). */
  readonly monsterParty?: readonly string[];
  readonly actorLevels?: Readonly<Record<string, number>>;
  readonly actorVitals: Readonly<Record<string, { readonly hp: number; readonly mp: number; readonly maxHp: number; readonly maxMp: number }>>;
  readonly actorStateIds?: Readonly<Record<string, readonly string[]>>;
  readonly x: number;
  readonly y: number;
  readonly playerFacing?: Dir;
  readonly eventLocations?: Readonly<Record<string, { readonly x: number; readonly y: number; readonly direction?: Dir; readonly mapId: string }>>;
  readonly horror?: { readonly hiding?: unknown; readonly pursuits: Readonly<Record<string, { readonly active: boolean }>> };
  readonly flags: Readonly<Record<string, boolean>>;
  /** 게임 스위치(badgeCount 가 배지 스위치를 센다). PlaySession·페이지 세션이 구조적으로 가진다. */
  readonly switches?: Readonly<Record<string, boolean>>;
  readonly gameTime?: GameTime;
  readonly stringVariables?: Readonly<Record<string, string>>;
  readonly clearHistory?: { readonly count: number; readonly endingIds: readonly string[] };
  readonly currentMapId: string;
}

/** 이벤트 쪽 정보(현재 위치·방향). 호출측이 아는 만큼만 넘긴다. */
export interface ActorQueryHost {
  readonly eventId?: string;
  /** 런타임 위치(맵 위 실제 좌표). 생략하면 eventLocations 에서 찾는다. */
  readonly x?: number;
  readonly y?: number;
  readonly direction?: Dir;
}

export const NEW_GAME_PLUS_SESSION_FLAG = "ngplus";
export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function resolveQueryActorId(session: ActorQuerySession, actorId: string): string | undefined {
  if (actorId === "leader") return session.partyActorIds[0];
  return session.partyActorIds.includes(actorId) ? actorId : undefined;
}

export type ActorStatKey = "level" | "hp" | "mp" | "maxHp" | "maxMp" | "hpPercent" | "mpPercent";

/** 액터 수치. 파티에 없는 배우는 undefined. */
export function actorStatValue(session: ActorQuerySession, actorId: string, stat: ActorStatKey): number | undefined {
  const id = resolveQueryActorId(session, actorId);
  if (!id) return undefined;
  const vitals = session.actorVitals[id];
  switch (stat) {
    case "level":
      return session.actorLevels?.[id] ?? 1;
    case "hp":
      return vitals?.hp;
    case "mp":
      return vitals?.mp;
    case "maxHp":
      return vitals?.maxHp;
    case "maxMp":
      return vitals?.maxMp;
    case "hpPercent":
      return vitals && vitals.maxHp > 0 ? Math.floor((vitals.hp * 100) / vitals.maxHp) : undefined;
    case "mpPercent":
      return vitals && vitals.maxMp > 0 ? Math.floor((vitals.mp * 100) / vitals.maxMp) : undefined;
  }
}

export function actorHasState(session: ActorQuerySession, actorId: string, stateId: string): boolean {
  const ids = actorId === "anyone" ? session.partyActorIds : [resolveQueryActorId(session, actorId)].filter((id): id is string => !!id);
  return ids.some((id) => (session.actorStateIds?.[id] ?? []).includes(stateId));
}

const DIR_DELTA: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export function dirIndex(dir: Dir): number {
  return ({ down: 2, left: 4, right: 6, up: 8 } as const)[dir];
}

/** from 이 dir 을 볼 때 to 가 그 반평면(정면 쪽)에 있는가. 같은 칸은 거짓. */
function isInFront(from: { x: number; y: number }, dir: Dir, to: { x: number; y: number }): boolean {
  const d = DIR_DELTA[dir];
  const dot = (to.x - from.x) * d.dx + (to.y - from.y) * d.dy;
  return dot > 0;
}

function hostPosition(session: ActorQuerySession, host: ActorQueryHost | undefined): { x: number; y: number; direction?: Dir } | undefined {
  if (!host) return undefined;
  if (host.x !== undefined && host.y !== undefined) return { x: host.x, y: host.y, direction: host.direction };
  const loc = host.eventId ? session.eventLocations?.[host.eventId] : undefined;
  if (!loc || loc.mapId !== session.currentMapId) return undefined;
  return { x: loc.x, y: loc.y, direction: host.direction ?? loc.direction };
}

/** 게임 달력의 절대 일수(1년 = 4계절). 시계가 없으면 undefined. */
export function absoluteGameDay(time: GameTime | undefined, daysPerSeason: number): number | undefined {
  if (!time) return undefined;
  const seasonIndex = Math.max(0, SEASONS.indexOf(time.season));
  return ((Math.max(1, time.year) - 1) * SEASONS.length + seasonIndex) * daysPerSeason + (Math.max(1, time.day) - 1);
}

/** 0=일 … 6=토. startWeekday 는 1년 1일의 요일(기본 1=월). */
export function gameWeekday(time: GameTime | undefined, daysPerSeason: number, startWeekday = 1): number | undefined {
  const day = absoluteGameDay(time, daysPerSeason);
  if (day === undefined) return undefined;
  return (((day + startWeekday) % 7) + 7) % 7;
}

export interface ActorQueryOptions {
  readonly daysPerSeason?: number;
  readonly startWeekday?: number;
  /**
   * 파티가 아는 스킬 id 집합(필드 스킬 게이트). 호출측이 프로젝트로 계산해 넘긴다(partySkills.partyKnownSkillIds) —
   * 직업·레벨·성장·몬스터 학습표는 프로젝트가 있어야 풀린다. 생략하면 세션에 이미 적힌 스킬(actorSkillIds·몬스터 skillIds)만 본다.
   */
  readonly partySkillIds?: () => ReadonlySet<string>;
  /**
   * 캠페인 배지 스위치 id 목록(badgeCount 조건). 호출측이 프로젝트로 넘긴다(badgeProgress.badgeContext).
   * 생략하면 세션 스위치 중 `mx_badge_N` 규약 스위치를 센다.
   */
  readonly badgeSwitchIds?: () => readonly string[];
  /** eventSeesPlayer: 현재 맵의 명명 로케이션(방 사각형). 호출측이 맵으로 넘긴다. 생략하면 같은 방 판정은 거짓. */
  readonly locations?: () => readonly SightLocation[] | undefined;
  /**
   * eventSeesPlayer: 이벤트의 런타임 위치. 걷는 NPC 의 실시간 칸은 장면의 eventPositions 에 있어
   * 세션 eventLocations 만으로는 모른다 — 호출측이 장면 위치를 넘긴다. 생략하면 eventLocations 를 본다.
   */
  readonly eventPosition?: (eventId: string) => SightPoint | undefined;
}

/** 세션만으로 아는 스킬(프로젝트 없이): 배우가 배운 actorSkillIds 와 몬스터 파티 인스턴스의 명시 skillIds. */
export function sessionKnownSkillIds(session: ActorQuerySession & { readonly actorSkillIds?: Readonly<Record<string, readonly string[]>>; readonly monsterParty?: readonly string[]; readonly monsterInstances?: Readonly<Record<string, { readonly skillIds?: readonly string[] }>> }): Set<string> {
  const ids = new Set<string>();
  for (const actorId of session.partyActorIds) for (const skillId of session.actorSkillIds?.[actorId] ?? []) ids.add(skillId);
  for (const instanceId of session.monsterParty ?? []) for (const skillId of session.monsterInstances?.[instanceId]?.skillIds ?? []) ids.add(skillId);
  return ids;
}

/** 파티 인원: 몬스터 수집 파티가 있으면 그 마리 수, 없으면 파티 배우 수(기존 동작). */
function partySizeOf(session: ActorQuerySession): number {
  const monsters = session.monsterParty?.length ?? 0;
  return monsters > 0 ? monsters : session.partyActorIds.length;
}

export function evalActorQueryCondition(
  session: ActorQuerySession,
  condition: ActorQueryCondition,
  host?: ActorQueryHost,
  options: ActorQueryOptions = {}
): boolean {
  switch (condition.kind) {
    case "actorStat": {
      const value = actorStatValue(session, condition.actorId, condition.stat);
      return value !== undefined && compareVariableValue(value, condition.op, condition.value);
    }
    case "actorState":
      return actorHasState(session, condition.actorId, condition.stateId) === condition.present;
    case "partyLeader":
      return session.partyActorIds[0] === condition.actorId;
    case "partyKnowsSkill": {
      if (!condition.skillId.trim()) return false;
      const known = (options.partySkillIds?.() ?? sessionKnownSkillIds(session)).has(condition.skillId);
      return known === (condition.present !== false);
    }
    case "badgeCount":
      return compareVariableValue(earnedBadgeCount(session.switches, options.badgeSwitchIds?.()), condition.op, condition.value);
    case "partySize":
      return compareVariableValue(partySizeOf(session), condition.op, condition.value);
    case "facing": {
      if (condition.subject === "player") return (session.playerFacing ?? "down") === condition.dir;
      const pos = hostPosition(session, host);
      return pos?.direction === condition.dir;
    }
    case "relativeFacing": {
      const pos = hostPosition(session, host);
      if (!pos) return false;
      const player = { x: session.x, y: session.y };
      const playerDir = session.playerFacing ?? "down";
      switch (condition.relation) {
        case "playerFacingEvent":
          return isInFront(player, playerDir, pos);
        case "playerBehindEvent":
          return pos.direction !== undefined && !isInFront(pos, pos.direction, player) && !(pos.x === player.x && pos.y === player.y);
        case "eventBehindPlayer":
          return !isInFront(player, playerDir, pos) && !(pos.x === player.x && pos.y === player.y);
      }
      return false;
    }
    case "eventSeesPlayer": {
      const live = options.eventPosition?.(condition.eventId);
      const loc = session.eventLocations?.[condition.eventId];
      const point: SightPoint | undefined = live ?? (loc && loc.mapId === session.currentMapId ? { x: loc.x, y: loc.y, direction: loc.direction } : undefined);
      return eventSeesPlayer(point, { x: session.x, y: session.y }, condition, options.locations?.()) === (condition.value !== false);
    }
    case "hiding":
      return Boolean(session.horror?.hiding) === condition.value;
    case "pursuitActive": {
      const pursuits = session.horror?.pursuits ?? {};
      const active = condition.eventId ? pursuits[condition.eventId]?.active === true : Object.values(pursuits).some((p) => p.active);
      return active === condition.value;
    }
    case "clearCount":
      return compareVariableValue(session.clearHistory?.count ?? 0, condition.op, condition.value);
    case "endingSeen":
      return (session.clearHistory?.endingIds ?? []).includes(condition.endingId) === condition.value;
    case "newGamePlus":
      return (session.flags[NEW_GAME_PLUS_SESSION_FLAG] === true) === condition.value;
    case "weekday": {
      const weekday = gameWeekday(session.gameTime, options.daysPerSeason ?? 28, options.startWeekday ?? 1);
      return weekday !== undefined && condition.weekdays.includes(weekday);
    }
    case "stringVariable": {
      const text = session.stringVariables?.[condition.stringVariableId] ?? "";
      switch (condition.op) {
        case "==":
          return text === condition.value;
        case "!=":
          return text !== condition.value;
        case "contains":
          return condition.value.length > 0 && text.includes(condition.value);
        case "empty":
          return text.length === 0;
      }
      return false;
    }
  }
}

export function isActorQueryConditionKind(kind: string): kind is ActorQueryCondition["kind"] {
  return ACTOR_QUERY_CONDITION_KINDS.includes(kind as ActorQueryCondition["kind"]);
}

export const ACTOR_QUERY_CONDITION_KINDS = [
  "actorStat",
  "actorState",
  "partyLeader",
  "partyKnowsSkill",
  "badgeCount",
  "partySize",
  "facing",
  "relativeFacing",
  "hiding",
  "pursuitActive",
  "eventSeesPlayer",
  "clearCount",
  "endingSeen",
  "newGamePlus",
  "weekday",
  "stringVariable",
] as const satisfies readonly ActorQueryCondition["kind"][];

export type { ConditionCompareOp };

/** Data Query·식 식별자가 쓰는 확장 조회. 모르는 query 는 0. */
export interface SessionQueryContext {
  readonly actorOrder?: readonly string[];
  readonly calendar?: ActorQueryOptions;
}

export function sessionQueryValue(
  session: ActorQuerySession & { readonly playTimeSeconds?: number; readonly stepCount?: number },
  query: string,
  target: string,
  context: SessionQueryContext = {}
): number {
  const actorTarget = target || "leader";
  switch (query) {
    case "actorLevel":
      return actorStatValue(session, actorTarget, "level") ?? 0;
    case "actorHp":
      return actorStatValue(session, actorTarget, "hp") ?? 0;
    case "actorMp":
      return actorStatValue(session, actorTarget, "mp") ?? 0;
    case "actorMaxHp":
      return actorStatValue(session, actorTarget, "maxHp") ?? 0;
    case "actorHpPercent":
      return actorStatValue(session, actorTarget, "hpPercent") ?? 0;
    case "actorHasState": {
      const [actorId, stateId] = target.includes(":") ? target.split(":", 2) : ["anyone", target];
      return stateId && actorHasState(session, actorId || "anyone", stateId) ? 1 : 0;
    }
    case "partyLeaderIndex": {
      const leader = session.partyActorIds[0];
      if (!leader) return 0;
      const index = (context.actorOrder ?? []).indexOf(leader);
      return index >= 0 ? index + 1 : 0;
    }
    case "partySize":
      return partySizeOf(session);
    case "playerFacing":
      return dirIndex(session.playerFacing ?? "down");
    case "playtimeSeconds":
      return Math.floor(session.playTimeSeconds ?? 0);
    case "steps":
      return Math.floor(session.stepCount ?? 0);
    case "clearCount":
      return session.clearHistory?.count ?? 0;
    case "weekday":
      return gameWeekday(session.gameTime, context.calendar?.daysPerSeason ?? 28, context.calendar?.startWeekday ?? 1) ?? 0;
    case "stringLength":
      return [...(session.stringVariables?.[target] ?? "")].length;
    default:
      return 0;
  }
}

/** 프로젝트에서 요일 달력 옵션을 뽑는다(시스템 timeSystem.daysPerSeason, startWeekday). */
export function calendarOptionsOf(project: { readonly system?: { readonly timeSystem?: { readonly daysPerSeason?: number; readonly startWeekday?: number } } } | undefined): ActorQueryOptions {
  const time = project?.system?.timeSystem;
  return {
    daysPerSeason: time?.daysPerSeason && time.daysPerSeason > 0 ? time.daysPerSeason : 28,
    startWeekday: Number.isInteger(time?.startWeekday) ? (((time!.startWeekday! % 7) + 7) % 7) : 1,
  };
}

