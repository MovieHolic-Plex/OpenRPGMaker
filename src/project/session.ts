// project/session.ts
// PlaySession: 플레이 중 런타임 상태. Project는 읽기 전용, 가변 상태는 여기에.
// v2: switches/variables/timers/mapOverrides 포함.
// 스펙 docs/specs/2026-06-18-oprn-overhaul-design.md §8.2.

import type { ActorId, ActorInitialEquipment, ActorParameterKey, Command, CropId, EventPageGraphic, LightingState, MapId, MonsterInstanceId, MonsterSpeciesId, Project, ProjectStartState, SkillId, Condition, MessageWindowSettings } from "./types";
import type { M2RuntimeState,
PlaySessionLike,
RuntimeCameraSessionState,
RuntimeEventLocation,
RuntimeNpcScheduleState,
RuntimeNpcTravelState,
RuntimeRemovedEventIds,
RuntimeSpawnedEventState, } from "@/project/sessionRuntimeTypes"
import { compareVariableValue } from "@/project/conditionEvaluation";
import { conditionMatchesSeason, conditionMatchesTimePhase, initialGameTime, type BattleResult, type GameTime, type Season } from "@/project/gameTime";
import { resolveSocialKey, type SocialHost } from "@/project/socialKey";
import { initialActorVitals, syncActorVitals } from "@/project/sessionVitals";
import type { ActorVitals } from "@/project/sessionVitals";
import { createRngState, nextRngFloat, type RngState, type RngStreamName } from "@/util/rng";
import { normalizeLightingState } from "@/project/lightingRules";
import { transitionItemStates, type ItemTransitionAction } from "@/project/itemTransitions";
import { resolveItemQuantity, type ItemQuantityOperation } from "@/project/itemQuantities";

export type AudioChannel = "bgm" | "bgs" | "me" | "se";

export type AudioTrackState = {
  readonly resourceId: string;
  readonly loop: boolean;
};

export type AudioCommandState = {
  bgm?: AudioTrackState;
  bgs?: AudioTrackState;
  me?: AudioTrackState;
  se?: AudioTrackState;
};

export type PictureState = {
  readonly pictureId: string;
  readonly resourceId: string;
  readonly x: number;
  readonly y: number;
  // Move Picture 트윈용 선택 필드(RM2K3 호환). 미지정 시 기본값으로 렌더.
  // scale: %(기본 100), opacity: 0~255(기본 255), rotation: 도(기본 0),
  // durationMs: 이 상태로의 전환에 걸릴 시간(0=즉시).
  readonly scale?: number;
  readonly opacity?: number;
  readonly rotation?: number;
  readonly durationMs?: number;
};

export type ActorRowPosition = "front" | "back";

export type RuntimeFollower = {
  /** Stable key for sprite map — survives renames. Missing on old saves (fallback to name). */
  readonly id?: string;
  readonly eventId?: string;
  readonly graphic: EventPageGraphic;
  readonly name: string;
  /** Omitted or "actor" = legacy actor/script follower. "monster" = overworld train from monsterParty. */
  readonly kind?: "actor" | "monster";
  readonly monsterInstanceId?: string;
};

export type RuntimeFollowerTrailPoint = {
  readonly x: number;
  readonly y: number;
  readonly direction?: "down" | "left" | "right" | "up";
};

export type MonsterInstanceIvs = {
  readonly hp: number;
  readonly atk: number;
  readonly def: number;
  readonly spd: number;
};

export type MonsterCaughtAt = {
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
};

export type MonsterInstance = {
  readonly instanceId: MonsterInstanceId;
  readonly speciesId: MonsterSpeciesId;
  readonly nickname?: string;
  readonly level: number;
  readonly exp: number;
  readonly currentHp?: number;
  readonly skillIds?: readonly SkillId[];
  readonly ivs?: MonsterInstanceIvs;
  readonly friendship: number;
  readonly caughtAt: MonsterCaughtAt;
};

export type FarmPlotState = {
  readonly tilled: boolean;
  readonly watered: boolean;
  readonly cropId?: CropId;
  readonly plantedDay?: { readonly day: number; readonly season: Season; readonly year: number };
  readonly stage?: number;
  readonly dead?: boolean;
  // 단계별 소요일을 결정적으로 누적하기 위한 런타임 진행도. 저장/로드 대상이다.
  readonly growthDays?: number;
};

export type FarmPlots = Record<MapId, Record<string, FarmPlotState>>;
export type DailyGiftLog = Record<string, string>;
export type DailyTalkLog = Record<string, string>;

export type ShippingSettlementEntry = {
  readonly itemId: string;
  readonly count: number;
  readonly unitPrice: number;
  readonly subtotal: number;
};

export type ShippingSettlement = {
  readonly dayKey: string;
  readonly entries: readonly ShippingSettlementEntry[];
  readonly total: number;
  readonly credited: number;
};

export type MakerInstanceState = {
  readonly instanceId: string;
  readonly makerId: string;
  readonly status: "idle" | "processing" | "ready";
  readonly startedAtMinute?: number;
  readonly readyAtMinute?: number;
};

export const FRIENDSHIP_MIN = 0;
export const FRIENDSHIP_MAX = 1000;

export const DEFAULT_MESSAGE_WINDOW_SETTINGS: MessageWindowSettings = {
  format: "normal",
  position: "bottom",
  preventObscuringPlayer: true,
  allowEventMovementDuringWait: false,
};

export interface PlaySession {
  // 스위치 런타임 값(switchId → bool).
  switches: Record<string, boolean>;
  // 셀프 스위치 런타임 값(eventId → (A/B/C/D → bool)).
  selfSwitches: Record<string, Partial<Record<string, boolean>>>;
  // 변수 런타임 값(variableId → number).
  variables: Record<string, number>;
  // 타이머(id → 남은 초).
  timers: Record<string, number>;
  gold: number;
  inventory: Record<string, number>;
  /** Successful-use cursor for the current FIFO copy of each finite-use item. */
  itemUseCharges?: Record<string, number>;
  /** persistKill 필드 스폰의 영구 처치 수(mapId → spawnId → 처치 수). 세이브에 포함된다. */
  killedFieldSpawns?: Record<string, Record<string, number>>;
  partyActorIds: string[];
  shopLoyaltySpend?: Record<string, number>;
  shopTradeCounts?: Record<string, { sold: number; bought: number }>;
  shopMileagePoints?: number;
  shopPawnTickets?: Record<string, { itemId: string; pawnPrice: number; dueDayKey: string }>;
  shopLastRestockDayKey?: Record<string, string>;
  energy?: number;
  shippingQueue?: Record<string, number>;
  shippingLastSettledDayKey?: string;
  /** Source calendar day consumed by the most recent atomic day transition. */
  dayTransitionLastDayKey?: string;
  shippingHistory?: ShippingSettlement[];
  bundleContributions?: Record<string, Record<string, number>>;
  completedBundleIds?: string[];
  bundleRewardAppliedIds?: string[];
  unlockedRegionIds?: string[];
  unlockedRecipeIds?: string[];
  makerInstances?: Record<string, MakerInstanceState>;
  monsterInstances: Record<MonsterInstanceId, MonsterInstance>;
  monsterParty: MonsterInstanceId[];
  monsterBox: MonsterInstanceId[];
  actorSkillIds: Record<ActorId, SkillId[]>;
  // 런타임 전투 메뉴 오버라이드(Change Battle Commands). actorId → battleCommand ids.
  actorBattleCommands?: Record<ActorId, string[]>;
  actorExperience: Record<string, number>;
  actorLevels: Record<string, number>;
  actorVitals: Record<string, ActorVitals>;
  eventLocations: Record<string, RuntimeEventLocation>;
  // Erase Event 런타임 소거 목록. 맵을 다시 로드/진입하면 RM2003 관례대로 초기화된다.
  erasedEventIds: string[];
  // Persistent Modern Remove Event state. Erase Event remains map-entry scoped.
  removedEventIds?: RuntimeRemovedEventIds;
  spawnedEvents?: Record<string, RuntimeSpawnedEventState>;
  camera?: RuntimeCameraSessionState;
  lighting: LightingState;
  npcTravelStates: Record<string, RuntimeNpcTravelState>;
  npcActivities?: Record<string, string>;
  npcScheduleStates?: Record<string, RuntimeNpcScheduleState>;
  // 라이프스킬 XP/레벨 (skillId → { xp, level }).
  lifeSkills?: Record<string, { xp: number; level: number }>;
  followers: RuntimeFollower[];
  followerTrail: RuntimeFollowerTrailPoint[];
  actorEquipment: Record<string, ActorInitialEquipment>;
  actorRows: Record<string, ActorRowPosition>;
  // 런타임 액터 이름 오버라이드(enterHeroName 등). actorId → 이름. 미설정 시 DB 이름 사용.
  actorNames?: Record<string, string>;
  // 런타임 액터 별명 오버라이드(Change Actor Nickname). actorId → 별명.
  actorNicknames?: Record<string, string>;
  // 런타임 액터 얼굴 오버라이드(Change Actor Faceset). actorId → faceResourceId.
  actorFaceResourceIds?: Record<string, string>;
  // 런타임 액터 얼굴 인덱스 오버라이드(Change Actor Faceset). actorId → faceIndex.
  actorFaceIndices?: Record<string, number>;
  // 런타임 주인공 그래픽 오버라이드(Change Actor Graphic). actorId → charset resourceId.
  actorCharacterResourceIds?: Record<string, string>;
  // 런타임 직업 오버라이드(Change Actor Class/승급). actorId → classId.
  classOverrides: Record<string, string>;
  // 런타임 능력치 영구 보정(Change Parameters). actorId → parameterKey → delta.
  actorParamBonuses?: Record<string, Partial<Record<ActorParameterKey, number>>>;
  // 필드/전투로 이어지는 런타임 상태 이상(Change State).
  actorStateIds?: Record<string, string[]>;
  // 현재 위치(맵 진입/transfer 시 갱신).
  currentMapId: MapId;
  x: number;
  y: number;
  // 런타임 맵 상태(changeTile 반영). mapId → { lower, upper } 오버라이드.
  mapOverrides: Record<MapId, { lower: Record<number, number>; upper: Record<number, number> }>;
  farmPlots?: FarmPlots;
  // farmPlots 성장 틱이 적용된 마지막 달력 날짜. 시계가 날짜를 넘길 때마다 여기까지의 차이만큼만 성장시킨다.
  farmPlotsAdvancedThrough?: { readonly day: number; readonly season: Season; readonly year: number };
  friendship?: Record<string, number>;
  dailyGifts?: DailyGiftLog;
  dailyTalks?: DailyTalkLog;
  /** Accumulated player steps toward the next monster walk-care tick. */
  monsterCareSteps?: number;
  /** Friendship points granted by walk care ticks, keyed by giftDayKey. */
  monsterCareDaily?: Record<string, number>;
  /** Opt-in: currently equipped tool item id (hand). */
  equippedToolItemId?: string;
  /** Opt-in: chest storage by chest id. */
  chests?: Record<string, import("@/project/placeables").ChestState>;
  /** Opt-in: placed furniture/objects by map:x,y key. */
  placeables?: Record<string, import("@/project/placeables").PlaceableObjectState>;
  // 레거시 호환(flags → switches로 마이그레이션됐지만 보존).
  flags: Record<string, boolean>;
  battleResult?: BattleResult;
  commonEvents?: { id: string; commands: Command[] }[];
  audio: AudioCommandState;
  pictures: Record<string, PictureState>;
  messageWindowSettings?: MessageWindowSettings;
  m2Runtime?: M2RuntimeState;
  // 누적 플레이 타임(초). 매 프레임 update 에서 증가.
  playTimeSeconds: number;
  rng?: RngState;
  gameTime?: GameTime;
}

// 프로젝트 "시작 상태"(에디터가 정의하는 초기 스위치/변수/골드/인벤토리/파티)를
// 명시적으로 읽는 헬퍼. 런타임 상태(PlaySession = scene.session)와 혼동하지 않도록,
// "이 값은 플레이 중 상태가 아니라 시작 상태다"라는 의도를 코드로 표시한다.
// 직렬화 키는 마이그레이션 없이 `session` 그대로 유지한다.
export const GOLD_MAX = 9_999_999;

export function startStateOf(project: Project): ProjectStartState {
  return project.session;
}

// Project로부터 새 세션 시작.
// 스위치/변수는 Database 정의에서 0/false 로 초기화(Project.flags는 레거시).
export function startSession(project: Project, seed?: number): PlaySession {
  const start = startStateOf(project);
  /**
   * 저작된 시작 상태를 **존중한다**. `ProjectStartState` 는 그 타입 주석부터
   * "에디터가 정의하는 초기 스위치/변수 … 새 세션의 시드로만 쓰인다" 라고 선언하는데,
   * 예전에는 여기서 전부 false/0 으로 덮어써 저작값이 조용히 버려졌다 — 농사 데모가
   * `var_stamina: 100` 을 저작했는데 런타임에서 0 으로 시작하는 것을 브라우저에서 실측했다.
   * 선언된 id 만 시드한다(시작 상태에만 있는 미선언 id 는 무시 — 옛 세이브 잔재를 되살리지 않는다).
   */
  const switches: Record<string, boolean> = {};
  for (const sw of project.switches) {
    switches[sw.id] = start.switches?.[sw.id] ?? false;
  }
  // 레거시 flags도 스위치로 보정(마이그레이션 잔여 대비).
  for (const [k, v] of Object.entries(project.flags)) {
    if (!(k in switches)) switches[k] = v;
  }
  const variables: Record<string, number> = {};
  for (const v of project.variables) {
    variables[v.id] = start.variables?.[v.id] ?? 0;
  }
  const gameTime = initialGameTime(project.system.timeSystem);
  return {
    switches,
    selfSwitches: {},
    variables,
    timers: { ...(start.timers ?? {}) },
    // 시작 소지금은 인벤토리/파티와 마찬가지로 프로젝트 시작 상태 설정을 따른다.
    gold: Math.min(GOLD_MAX, Math.max(0, start.gold ?? 0)),
    inventory: { ...start.inventory },
    itemUseCharges: {},
    partyActorIds: [...start.partyActorIds],
    energy: project.system.energy
      ? Math.min(project.system.energy.max, Math.max(0, project.system.energy.initial ?? project.system.energy.max))
      : undefined,
    shippingQueue: {},
    shippingHistory: [],
    bundleContributions: {},
    completedBundleIds: [],
    bundleRewardAppliedIds: [],
    unlockedRegionIds: [],
    unlockedRecipeIds: [],
    makerInstances: {},
    monsterInstances: {},
    monsterParty: [],
    monsterBox: [],
    actorSkillIds: {},
    actorExperience: initialActorExperience(project),
    actorLevels: initialActorLevels(project),
    actorVitals: initialActorVitals(project),
    eventLocations: {},
    erasedEventIds: [],
    removedEventIds: {},
    spawnedEvents: {},
    camera: { mode: "follow", target: { kind: "player" } },
    lighting: normalizeLightingState(project.maps[project.startMapId]?.defaultLighting),
    npcTravelStates: {},
    npcActivities: {},
    npcScheduleStates: {},
    lifeSkills: {},
    followers: [],
    followerTrail: [],
    actorEquipment: initialActorEquipment(project),
    actorRows: initialActorRows(project),
    actorNames: {},
    actorCharacterResourceIds: {},
    classOverrides: {},
    actorParamBonuses: {},
    actorStateIds: {},
    currentMapId: project.startMapId,
    x: project.startPos.x,
    y: project.startPos.y,
    mapOverrides: {},
    farmPlots: {},
    // 저작된 설치물(광산의 돌 등)을 새 세션에 놓는다. 캐면 세션에서 사라지므로
    // 프로젝트 쪽 원본을 공유하면 두 번째 세션에서 이미 캐진 상태로 시작한다 — 반드시 복제한다.
    placeables: structuredClone(start.placeables ?? {}),
    farmPlotsAdvancedThrough: gameTime && { day: gameTime.day, season: gameTime.season, year: gameTime.year },
    friendship: {},
    dailyGifts: {},
    dailyTalks: {},
    flags: { ...project.flags },
    audio: {},
    pictures: {},
    messageWindowSettings: { ...DEFAULT_MESSAGE_WINDOW_SETTINGS },
    playTimeSeconds: 0,
    rng: createRngState(seed),
    gameTime,
  };
}

export function reseedSessionRng(session: PlaySessionLike, seed?: number): void {
  session.rng = createRngState(seed);
}

export function nextSessionRandom(session: PlaySessionLike, stream: RngStreamName): number {
  session.rng ??= createRngState();
  return nextRngFloat(session.rng, stream);
}

function initialActorExperience(project: Project): Record<string, number> {
  const experience: Record<string, number> = {};
  for (const actorId of startStateOf(project).partyActorIds) {
    experience[actorId] = 0;
  }
  return experience;
}

function initialActorLevels(project: Project): Record<string, number> {
  const levels: Record<string, number> = {};
  for (const actor of project.database.actors) {
    levels[actor.id] = actor.initialLevel;
  }
  return levels;
}

function initialActorEquipment(project: Project): Record<string, ActorInitialEquipment> {
  const equipment: Record<string, ActorInitialEquipment> = {};
  for (const actor of project.database.actors) {
    equipment[actor.id] = { ...actor.initialEquipment };
  }
  return equipment;
}

function initialActorRows(project: Project): Record<string, ActorRowPosition> {
  const rows: Record<string, ActorRowPosition> = {};
  for (const actorId of startStateOf(project).partyActorIds) {
    rows[actorId] = "front";
  }
  return rows;
}

// 스위치 조회(없으면 false).
export function getSwitch(session: PlaySessionLike, switchId: string): boolean {
  return session.switches[switchId] ?? false;
}
export function setSwitch(session: PlaySessionLike, switchId: string, value: boolean): void {
  session.switches[switchId] = value;
}

// 변수 조회(없으면 0).
export function getVariable(session: PlaySessionLike, variableId: string): number {
  return session.variables[variableId] ?? 0;
}
export const VARIABLE_MIN = -9_999_999;
export const VARIABLE_MAX = 9_999_999;

export function clampVariableValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const truncated = Math.trunc(value);
  return Math.max(VARIABLE_MIN, Math.min(VARIABLE_MAX, truncated));
}

export function setVariable(
  session: PlaySessionLike,
  variableId: string,
  op: "=" | "+=" | "-=" | "*=" | "/=",
  value: number
): void {
  const cur = session.variables[variableId] ?? 0;
  switch (op) {
    case "=": session.variables[variableId] = clampVariableValue(value); break;
    case "+=": session.variables[variableId] = clampVariableValue(cur + value); break;
    case "-=": session.variables[variableId] = clampVariableValue(cur - value); break;
    case "*=": session.variables[variableId] = clampVariableValue(cur * value); break;
    case "/=": {
      if (value === 0) {
        console.warn(`[session] 변수 '${variableId}' 0으로 나누기 무시됨`);
        break;
      }
      session.variables[variableId] = clampVariableValue(Math.trunc(cur / value));
      break;
    }
  }
}

// 타이머.
export function setTimer(session: PlaySessionLike, id: string, seconds: number): void {
  session.timers[id] = seconds;
}
export function getTimer(session: PlaySessionLike, id: string): number {
  return session.timers[id] ?? 0;
}

export function changeGold(session: PlaySessionLike, op: "=" | "+=" | "-=", amount: number): void {
  const next = applyAmount(session.gold, op, amount);
  session.gold = Math.min(GOLD_MAX, Math.max(0, next));
}

export function changeItem(
  session: PlaySessionLike,
  itemId: string,
  op: "=" | "+=" | "-=",
  amount: number
): boolean {
  return changeItemsAtomically(session, [{ itemId, op, amount }]);
}

/** Validates a batch against one evolving inventory and commits it once. */
export function changeItemsAtomically(
  session: PlaySessionLike,
  operations: readonly ItemQuantityOperation[],
): boolean {
  if (operations.length === 0) return true;
  const nextCounts = new Map<string, number>();
  const actions: ItemTransitionAction[] = [];
  for (const operation of operations) {
    const current = nextCounts.get(operation.itemId) ?? session.inventory[operation.itemId] ?? 0;
    const next = resolveItemQuantity(current, operation.op, operation.amount);
    if (next === undefined) return false;
    nextCounts.set(operation.itemId, next);
    actions.push(operation.op === "+="
      ? { kind: "grant", itemId: operation.itemId, amount: operation.amount }
      : operation.op === "-="
        ? { kind: "remove", itemId: operation.itemId, amount: current - next }
        : { kind: "assign", itemId: operation.itemId, count: next });
  }
  const transitioned = transitionItemStates(session, [], actions);
  session.inventory = transitioned.inventory;
  session.itemUseCharges = transitioned.itemUseCharges;
  return true;
}

export function changeParty(
  session: PlaySessionLike,
  actorId: string,
  action: "add" | "remove",
  project?: Project
): void {
  if (action === "add") {
    if (!session.partyActorIds.includes(actorId)) session.partyActorIds.push(actorId);
    if (project) syncActorVitals(project, session.actorVitals, actorId);
    return;
  }
  session.partyActorIds = session.partyActorIds.filter((id) => id !== actorId);
}

export function learnSkill(session: PlaySessionLike, actorId: ActorId, skillId: SkillId): void {
  changeActorSkill(session, actorId, skillId, "learn");
}

export function changeActorSkill(
  session: PlaySessionLike,
  actorId: ActorId | undefined,
  skillId: SkillId,
  action: "learn" | "forget" = "learn",
): void {
  session.actorSkillIds ??= {};
  const targets = !actorId || actorId === "party" || actorId === "all"
    ? (session.partyActorIds ?? [])
    : [actorId];
  for (const id of targets) {
    const learned = session.actorSkillIds[id] ?? [];
    if (action === "forget") {
      session.actorSkillIds[id] = learned.filter((entry) => entry !== skillId);
      continue;
    }
    if (!learned.includes(skillId)) session.actorSkillIds[id] = [...learned, skillId];
  }
}

/**
 * Resolve friendship map key.
 * Prefer {@link resolveSocialKey} with a host event for self (empty npcKey) paths.
 * Bare `eventId` is no longer a social fallback.
 */
export function friendshipKey(
  npcKey: string | undefined,
  host?: SocialHost | string | null
): string | undefined {
  const explicit = npcKey?.trim();
  if (explicit) return explicit;
  if (!host) return undefined;
  if (typeof host === "string") {
    // String-only call sites cannot invent characterId — fail closed for self.
    return undefined;
  }
  return resolveSocialKey(host) ?? undefined;
}

export function getFriendship(
  session: PlaySessionLike,
  npcKey: string | undefined,
  host?: SocialHost | string | null
): number {
  const key = friendshipKey(npcKey, host);
  if (!key) return 0;
  return clampFriendship(session.friendship?.[key] ?? 0);
}

export function changeFriendship(
  session: PlaySessionLike,
  npcKey: string | undefined,
  delta: number,
  host?: SocialHost | string | null
): number {
  const key = friendshipKey(npcKey, host);
  if (!key) return 0;
  session.friendship ??= {};
  const next = clampFriendship((session.friendship[key] ?? 0) + Math.trunc(Number.isFinite(delta) ? delta : 0));
  session.friendship[key] = next;
  return next;
}

export function clampFriendship(value: number): number {
  if (!Number.isFinite(value)) return FRIENDSHIP_MIN;
  return Math.max(FRIENDSHIP_MIN, Math.min(FRIENDSHIP_MAX, Math.trunc(value)));
}

export function giftDayKey(time: GameTime | undefined): string {
  if (!time) return "no-time";
  return `${time.year}:${time.season}:${time.day}`;
}

function applyAmount(current: number, op: "=" | "+=" | "-=", amount: number): number {
  switch (op) {
    case "=":
      return amount;
    case "+=":
      return current + amount;
    case "-=":
      return current - amount;
  }
}

// 맵 타일 오버라이드(changeTile 런타임 반영).
export function setMapTileOverride(
  session: PlaySession,
  mapId: MapId,
  layer: "lower" | "upper",
  index: number,
  tile: number
): void {
  if (!session.mapOverrides[mapId]) {
    session.mapOverrides[mapId] = { lower: {}, upper: {} };
  }
  session.mapOverrides[mapId][layer][index] = tile;
}
export function getMapTile(
  session: PlaySession,
  mapId: MapId,
  layer: "lower" | "upper",
  map: { lowerTiles: number[]; upperTiles: number[] },
  index: number
): number {
  const ov = session.mapOverrides[mapId];
  if (ov && ov[layer] && index in ov[layer]) {
    return ov[layer][index];
  }
  return layer === "lower" ? map.lowerTiles[index] : map.upperTiles[index];
}

export function setAudioState(
  session: PlaySession,
  state: { readonly channel?: AudioChannel; readonly resourceId: string; readonly loop: boolean }
): void {
  const channel = state.channel ?? (state.loop ? "bgm" : "se");
  session.audio[channel] = {
    resourceId: state.resourceId,
    loop: state.loop,
  };
}

export function clearAudioState(session: PlaySession): void {
  session.audio = {};
}

export function showPictureState(session: PlaySession, picture: PictureState): void {
  session.pictures[picture.pictureId] = picture;
}

export function erasePictureState(session: PlaySession, pictureId: string): void {
  delete session.pictures[pictureId];
}

// 조건(Condition) 평가. condition이 없으면 항상 참.
// host: 셀프 스위치/활동은 event id, 호감도 self 는 characterId 필요 (SocialHost 권장).
export function evalCondition(
  session: PlaySessionLike,
  condition: Condition | undefined,
  host?: SocialHost | string
): boolean {
  if (!condition) return true;
  const eventId = hostEventId(host);
  switch (condition.kind) {
    case "switch":
      return getSwitch(session, condition.switchId) === condition.value;
    case "variable": {
      const v = getVariable(session, condition.variableId);
      return compareVariableValue(v, condition.op, condition.value);
    }
    case "selfSwitch": {
      // 이 이벤트의 셀프 스위치 상태. eventId 미전달 시 항상 false.
      const selfSwitches = session.selfSwitches ?? {};
      const own = eventId ? selfSwitches[eventId] : undefined;
      return (own?.[condition.key] ?? false) === condition.value;
    }
    case "actor":
      return session.partyActorIds.includes(condition.actorId) === condition.present;
    case "item":
      return ((session.inventory[condition.itemId] ?? 0) > 0) === condition.present;
    case "gold":
      return compareVariableValue(session.gold, condition.op, condition.amount);
    case "timer": {
      const remaining = session.timers[condition.timerId] ?? 0;
      return remaining <= condition.seconds;
    }
    case "timePhase":
      return conditionMatchesTimePhase(session.gameTime, condition.phase);
    case "season":
      return conditionMatchesSeason(session.gameTime, condition.season);
    case "npcActivity":
      return eventId ? session.npcActivities?.[eventId] === condition.activity : false;
    case "friendshipAtLeast":
      return getFriendship(session, condition.npcKey, hostSocial(host)) >= clampFriendship(condition.value);
    case "battleResult":
      return session.battleResult === condition.result;
    case "all":
      return condition.conditions.every((child) => evalCondition(session, child, host));
    case "any":
      return condition.conditions.some((child) => evalCondition(session, child, host));
    case "not":
      return !evalCondition(session, condition.condition, host);
  }
}

function hostEventId(host?: SocialHost | string): string | undefined {
  if (!host) return undefined;
  return typeof host === "string" ? host : host.id;
}

function hostSocial(host?: SocialHost | string): SocialHost | undefined {
  if (!host) return undefined;
  if (typeof host === "string") return { id: host };
  return host;
}
