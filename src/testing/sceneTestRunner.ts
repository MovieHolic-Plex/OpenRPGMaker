import { recoverAll } from "@/project/sessionActorCommands";
import { numberInputAnswer } from "@/testing/numberInputAnswer";
import { buildLifeRuntimeSnapshot, type LifeRuntimeSnapshot } from "@/player/runtimeDom";
import { canMove, isPassable, isPassableLanding } from "@/project/collision";
import { headlessBattleSnapshot, createBattleRuntime, type BattleResult } from "@/battle/runtime";
import type { ActorCommand } from "@/battle/types";
import { resolveEventPage } from "@/project/io";
import { checkReachability } from "@/project/lint/reachability";
import {
  clearAudioState,
  erasePictureState,
  getSwitch,
  getVariable,
  getFriendship,
  nextSessionRandom,
  setAudioState,
  showPictureState,
  startSession,
  type PlaySession,
} from "@/project/session";
import { syncActorVitals } from "@/project/sessionVitals";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import type { ChoiceCancelBehavior, Command, Dir, GameMap, Project } from "@/project/types";
import { cancelChoiceIndex } from "@/project/choiceCancellation";
import { characterSpriteX, characterSpriteY, footprintSpriteX } from "@/player/characterDepth";
import { createInterpreter, type Interpreter, type StepResult } from "@/player/interpreter";
import { useItemFromMenu } from "@/player/playerItemUse";
import { restoreSessionCheckpoint } from "@/player/checkpoints";
import { nextChaseDecision, type ChaseRuntimeState } from "@/player/chaseAi";
import { isPlayerHiding, pursuitTarget, toggleHiding } from "@/player/horrorRuntime";
import type { AutonomousMover } from "@/player/playSceneTypes";
import { followerPositions, recordFollowerPlayerStep, removeFollowerFromSession, resetFollowerTrailNearPlayer, resolveCompanionRules, type FollowerWorld } from "@/project/followers";
import { npcMoveDurationMs, npcMoveIntervalMs } from "@/player/playScenePageMoveRoutes";
import type { RuntimeCameraSessionState, RuntimeCameraTarget } from "@/project/sessionRuntimeTypes"
import {
  advanceLightingAmbientTransition,
  applyMapDefaultLighting,
  lightAtTile,
  LIGHTING_FIXED_STEP_MS,
  normalizeLightingState,
  setSessionLighting,
  type LightingAmbientTransition,
  type LightTilePosition,
} from "@/project/lightingRules";
import type { LightSourceAnchor } from "@/project/types";
import { findBlockingRuntimeEventAtInMap,
findRuntimeEventAtInMap,
initialRuntimeEventPositions,
runtimeEventViewsForMap,
type RuntimeEventPositions,
type RuntimeEventView, } from "@/project/runtimeEventState"
import { isCutsceneInputLocked, releaseCutsceneControlForOwner } from "@/player/cutsceneControl";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { battleAnimationDurationMs } from "@/player/battleAnimationPlayback";
import { eligibleEncounterEntries, pickEncounterTroopForMap } from "@/player/encounters";
import { monsterBattlePartyOf } from "@/project/monsterCollection";
import { normalizeWeatherParams, parseWeather, weatherToRuntimeString } from "@/player/weather/weatherModel";
import {
  advanceFieldSpawns,
  createFieldSpawnRuntime,
  fieldSpawnAliveCount,
  fieldSpawnRuntimeNeedsRefresh,
  fieldSpawnTroopId,
  isFieldSpawnEventId,
  resolveFieldSpawnVictory,
  syncFieldSpawnEventsIntoMap,
  type FieldSpawnRuntimeState,
} from "@/player/fieldSpawns";
import { firesOnPlayerCollision, PLAYER_COLLISION_TRIGGER_KINDS } from "@/project/eventTouchRules";
import {
  beginLocationOccupancyOnMap,
  leaveAllLocationsOnMap,
  seedLocationOccupancy,
  triggerMatchesTransition,
  updateLocationOccupancy,
  type LocationTransition,
} from "@/project/locationTransitions";
import { nearestCellInRect, pointRect, rectsOverlap } from "@/project/footprint";
import { enterRoguelikeRunRoom } from "@/project/roguelikeRun";
import { roguelikeRoomId, syncRoguelikeRoomEventGeneration } from "@/project/roguelikeRooms";
import {
  calendarDayKey,
  initialGameTime,
  isSeason,
  isTimePhase,
  minutesUntilDayEnd,
  resolveTimeSystem,
  timePhaseFor,
  type GameTime,
  type TimePhase,
} from "@/project/gameTime";
import { npcScheduleTargetForEvent } from "@/project/npcSchedule";
import { interactWithLifeField } from "@/player/lifeFieldInteraction";
import { findChestAt } from "@/project/placeables";
import { cropStageAt, farmIntentForHand, interactWithFarmPlot } from "@/player/farming";
import { giveGiftToNpc } from "@/project/friendship";
import { accrueShopLoyalty, handleShopTransaction, shopItems, type ShopStep } from "@/player/playSceneShop";
import { beginShopVisit, endShopVisit, shopIsClosed } from "@/player/playSceneShopVisit";
import { resolveShopStock } from "@/project/shopStock";
import { applyMapBgmToSession, resolveMapBgm } from "@/player/mapBgm";
import { advanceTimeAcrossDayBoundaries, setTimeWithMakers, transitionToNextDay } from "@/player/dayTransition";

const TICK_MS = 16;

export interface RewardDelta {
  gold: number;
  inventory: Record<string, number>;
  monsters: Record<string, number>;
}

/** Host-only capability, never part of the scene tool's input schema. */
export interface SceneRewardProof {
  readonly target: { readonly mapId: string; readonly eventId: string };
  readonly protectedFrom: number;
  readonly repeatFrom?: number;
  readonly requested: SceneExpectStep;
  readonly signal?: AbortSignal;
  readonly report: {
    phase: "prelude" | "claim" | "repeat";
    instructions: number;
    movementSteps: number;
    claim?: RewardDelta;
    repeat?: RewardDelta;
  };
}

// Admit only native commands this bounded harness really executes; no UI defaults,
// map-event delegation, M2 fallback or relocation. Ordinary execution is unchanged.
const REWARD_PROOF_COMMANDS: ReadonlySet<Command["kind"]> = new Set([
  "text", "changeFace", "displayTextSettings", "choices", "fork", "setSwitch", "setVariable",
  "setSelfSwitch", "setFlag", "label", "gotoLabel", "loop", "breakLoop", "callCommonEvent",
  "transfer", "wait", "changeGold", "changeItem", "giveMonster", "moveMonster", "changeParty",
  "playAudio", "stopAudio", "showPicture", "erasePicture", "showEmote", "setWeather",
  "cutsceneControl", "setEventGraphicPattern",
]);

function unverified(reason: string): never { throw new Error(`NPC reward unverified: ${reason}`); }

function rewardSnapshot(session: PlaySession): RewardDelta {
  return { gold: session.gold, inventory: { ...session.inventory }, monsters: ownedMonsterCounts(session) };
}

function rewardDelta(session: PlaySession, baseline: RewardDelta): RewardDelta {
  const now = rewardSnapshot(session);
  const difference = (current: Record<string, number>, before: Record<string, number>) => Object.fromEntries(
    [...new Set([...Object.keys(current), ...Object.keys(before)])].map(id => [id, (current[id] ?? 0) - (before[id] ?? 0)]));
  return { gold: now.gold - baseline.gold, inventory: difference(now.inventory, baseline.inventory), monsters: difference(now.monsters, baseline.monsters) };
}

function proofCommand(state: RunnerState, command: Command): void {
  const proof = state.rewardProof;
  if (!proof) return;
  if (proof.signal?.aborted) unverified("Cancelled");
  if (proof.report.instructions >= 100000) unverified("Interpreter instruction budget exhausted");
  proof.report.instructions++;
  if (!REWARD_PROOF_COMMANDS.has(command.kind)) unverified(`Unsupported command: ${command.kind}`);
  if (command.kind === "transfer" && proof.report.phase !== "prelude") unverified("Protected transfer");
  if (command.kind === "changeItem" && !state.project.database.items.some(item => item.id === command.itemId)) unverified(`Missing item: ${command.itemId}`);
  if (command.kind === "giveMonster" && !state.project.database.monsterSpecies?.some(species => species.id === command.speciesId)) unverified(`Missing species: ${command.speciesId}`);
}

function proofPosition(state: RunnerState): string | null {
  const { currentMapId, x, y } = state.session;
  const map = currentMap(state);
  return !map || !Number.isSafeInteger(x) || !Number.isSafeInteger(y)
    || !isPassableLanding(state.project, map, x, y)
    || findBlockingRuntimeEventAtInMap(state.project, map, state.session, state.eventPositions, x, y)
    ? `Invalid start/transfer landing: ${currentMapId} (${x},${y})` : null;
}

function checkEarlyReward(state: RunnerState, baseline = state.earlyRewardBaseline): string | null {
  if (!baseline || state.held) return null;
  const delta = rewardDelta(state.session, baseline);
  if (baseline === state.earlyRewardBaseline) state.earlyRewardBaseline = undefined;
  const requested = state.rewardProof!.requested;
  return (requested.goldDelta !== undefined && delta.gold !== 0)
    || Object.keys(requested.inventoryDelta ?? {}).some(id => (delta.inventory[id] ?? 0) !== 0)
    || Object.keys(requested.ownedMonsterDelta ?? {}).some(id => (delta.monsters[id] ?? 0) !== 0)
    ? "Earlier reward NPC interaction changed requested rewards before the protected claim snapshot" : null;
}

export type SceneStep =
  | { kind: "wait"; ticks: number }
  | { kind: "face"; dir: Dir }
  | { kind: "walk"; to: { x: number; y: number }; adjacent?: boolean }
  | {
      kind: "set";
      mapId?: string;
      x?: number;
      y?: number;
      facing?: Dir;
      switches?: Record<string, boolean> | readonly string[];
      variables?: Record<string, number>;
      inventory?: Record<string, number>;
      gold?: number;
      manualHint?: string;
    }
  | { kind: "move"; dir: Dir; to?: never }
  | { kind: "move"; dir?: never; to: { x: number; y: number } }
  | { kind: "interact"; eventId?: string }
  /** 메뉴에서 아이템을 쓴다. 스위치 아이템이면 직후 자동 공통 이벤트가 돈다. */
  | { kind: "useItem"; itemId: string }
  | { kind: "snapshotRewards" }
  | { kind: "purchase"; eventId: string; itemId: string; count: number; unitPrice: number }
  | { kind: "gift"; eventId?: string; itemId: string }
  | { kind: "choose"; index: number }
  /** 대기 중인 presentItem 에 아이템을 낸다. itemId 를 생략하면 아무것도 내지 않고 닫는다. */
  | { kind: "present"; itemId?: string }
  | { kind: "retryCheckpoint" }
  | { kind: "advanceDays"; days: number }
  | SceneExpectStep;

export type SceneExpectStep = {
  kind: "expect";
  playerAt?: { x: number; y: number; mapId?: string };
  switchOn?: string | readonly string[];
  switchOff?: string | readonly string[];
  variableEquals?: { variableId: string; value: number } | Record<string, number>;
  variableAtLeast?: { variableId: string; value: number } | Record<string, number>;
  eventAt?: { eventId: string; x: number; y: number; mapId?: string };
  eventOnMap?: { eventId: string; mapId: string };
  eventDistanceToPlayerLessThan?: { eventId: string; distance: number; mapId?: string };
  followerCount?: number;
  /** 전투 파티(session.partyActorIds)에 있어야 할 배우. 동료 추종(followers)과는 다르다. */
  partyIncludes?: string | readonly string[];
  partyExcludes?: string | readonly string[];
  followerAt?: { name: string; x: number; y: number };
  cameraAt?: { cx: number; cy: number; tolerance?: number };
  lightingAmbient?: number | { value: number; tolerance?: number };
  lightAt?: { x: number; y: number; expected?: boolean };
  lightCount?: number;
  weatherKind?: "none" | "rain" | "storm" | "snow" | "fog";
  animationPlaying?: boolean;
  fieldSpawnCount?: number;
  spawnedCount?: number;
  pictureVisible?: string | { id: string; resourceId?: string };
  bgmPlaying?: string;
  /** Runner-observable feedback/transcript: at least one message text has been shown. */
  messageShown?: boolean;
  gameOver?: boolean;
  endingReached?: string;
  cutsceneLocked?: boolean;
  mapId?: string;
  gameTimeAt?: Partial<GameTime>;
  timePhase?: TimePhase;
  cropStageAt?: { x: number; y: number; stage: number; mapId?: string };
  inventoryCount?: { itemId: string; count: number } | Record<string, number>;
  /** Deltas from scene start or the latest snapshotRewards step. */
  goldDelta?: number | { atLeast: number };
  inventoryDelta?: Record<string, number | { atLeast: number }>;
  ownedMonsterDelta?: Record<string, number | { atLeast: number }>;
  interactionComplete?: boolean;
  lastTransfer?: { fromMapId: string; eventId: string; toMapId: string };
  friendshipAtLeast?: { npcKey: string; value: number } | Record<string, number>;
  shopStock?: { eventId: string; itemIds: readonly string[]; prices?: Record<string, number>; mapId?: string };
};

export interface SceneTestInput {
  readonly mapId: string;
  readonly start: { readonly x: number; readonly y: number };
  readonly steps: readonly SceneStep[];
}

/** 모델 입력(SceneTestInput)과 따로 두는 러너 설정 — run_scene_test 도구에는 드러나지 않는다. */
export interface SceneRunnerOptions {
  /** Host-only resumed save state; never accepted by the model-facing scene tool. */
  readonly initialSession?: PlaySession;
  /**
   * 무작위 인카운터 직전마다 파티를 전부 회복한다(QA 자동 플레이 전용 — 플레이어가 여관·포션으로 버티는 것을 흉내).
   * 스크립트 전투(보스)는 회복하지 않고 들어간다 — 보스 앞에서 체력을 관리하는 것은 설계의 몫이다.
   * 기본은 꺼짐: 실제 소모를 그대로 본다.
   */
  readonly recoverBeforeRandomEncounters?: boolean;
}

export interface SceneInteractionReceipt {
  readonly stepIndex: number;
  readonly mapId: string;
  readonly eventId: string;
}
export interface SceneSetupFailure {
  readonly kind: "no-interaction-target" | "invalid-input" | "execution-failure";
  readonly stepIndex: number;
  readonly mapId: string;
}

export interface SceneTestResult {
  readonly interactions: readonly SceneInteractionReceipt[];
  readonly setupFailure?: SceneSetupFailure;
  /** Explicit intent that failed selection, never an executed interaction. */
  readonly failedSelection?: SceneInteractionReceipt;
  readonly ok: boolean;
  readonly stepsRun: number;
  readonly totalSteps: number;
  readonly failedStepIndex?: number;
  readonly failedStep?: SceneStep;
  readonly failureReason?: string;
  readonly finalState: LifeRuntimeSnapshot & {
    readonly mapId: string;
    readonly x: number;
    readonly y: number;
    readonly camera: { readonly cx: number; readonly cy: number; readonly session?: RuntimeCameraSessionState };
    readonly lightingAmbient: number;
    readonly lightCount: number;
    readonly weatherKind: "none" | "rain" | "storm" | "snow" | "fog";
    readonly animationPlaying: boolean;
    readonly fieldSpawnCount: number;
    readonly spawnedCount: number;
    readonly followerCount: number;
    /** 전투 파티 편성. addFollower(시각 추종)는 여기 들어가지 않는다 — changeParty action:"add" 만. */
    readonly partyActorIds: readonly string[];
    readonly followers: readonly { readonly name: string; readonly x: number; readonly y: number }[];
    readonly picturesVisible: readonly string[];
    readonly messages: readonly string[];
    readonly bgm?: string;
    readonly gameOver: boolean;
    readonly endingsReached: readonly string[];
    readonly cutsceneLocked: boolean;
    readonly switchesOn: readonly string[];
    readonly variables: Record<string, number>;
    readonly gold: number;
    readonly inventory: Record<string, number>;
    readonly ownedMonsterCounts: Record<string, number>;
    readonly monsterParty: readonly string[];
    readonly monsterBox: readonly string[];
    readonly friendship: Record<string, number>;
    readonly playTimeSeconds: number;
    readonly gameTime?: GameTime;
    readonly timePhase?: TimePhase;
  };
  readonly log: readonly string[];
  readonly session: PlaySession;
}

type PumpStop =
  | { stop: "done" }
  | { stop: "choices"; choiceCount: number; cancelBehavior?: ChoiceCancelBehavior }
  | { stop: "present"; itemIds: readonly string[] }
  | { stop: "animation" }
  | { stop: "shop"; step: ShopStep }
  | { stop: "failed"; reason: string };

type CameraTween = {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly durationMs: number;
  readonly finalState: RuntimeCameraSessionState;
  elapsedMs: number;
};

interface CameraModel {
  cx: number;
  cy: number;
  followTarget: RuntimeCameraTarget | null;
  tween: CameraTween | null;
}

interface RunnerState {
  stepIndex: number;
  readonly interactions: SceneInteractionReceipt[];
  setupFailure?: SceneSetupFailure;
  failedSelection?: SceneInteractionReceipt;
  readonly rewardProof?: SceneRewardProof;
  earlyRewardBaseline?: RewardDelta;
  /** Host approach is protected, but cannot pay before its claim snapshot. */
  rewardClaimSnapshotTaken?: boolean;
  proofEventActive?: boolean;
  readonly project: Project;
  readonly runtimeMaps: Record<string, GameMap>;
  session: PlaySession;
  eventPositions: RuntimeEventPositions;
  fieldSpawnState: FieldSpawnRuntimeState | null;
  readonly log: string[];
  camera: CameraModel;
  lightingClockMs: number;
  lightingFixedAccumulatorMs: number;
  lightingTransition: LightingAmbientTransition | null;
  timeFixedAccumulatorMs: number;
  timeMinuteAccumulator: number;
  activeAnimations: Array<{ readonly animationId: string; remainingMs: number }>;
  readonly autoStartedKeys: Set<string>;
  inCommonAuto: boolean;
  readonly chasers: Map<string, ChaseRuntimeState>;
  encounterAccumulator: number;
  readonly recoverBeforeRandomEncounters: boolean;
  facing: Dir;
  /** Runner-observable transcript of message text bodies shown so far. */
  readonly messages: string[];
  gameOver: boolean;
  held: ({ interp: Interpreter; currentEventId?: string } & (
    { mode: "choices"; choiceCount: number; cancelBehavior?: ChoiceCancelBehavior } | { mode: "present"; itemIds: readonly string[] }
    | { mode: "animation" } | { mode: "shop"; step: ShopStep }
  )) | null;
  runtimeFailure: string | null;
  executingEventId?: string;
  lastTransfer?: { fromMapId: string; eventId: string; toMapId: string };
  rewardBaseline: { gold: number; inventory: Record<string, number>; monsters: Record<string, number> };
}

/** Ownership is party + box membership, resolved through instances (not actor party). */
function ownedMonsterCounts(session: PlaySession): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of new Set([...session.monsterParty, ...session.monsterBox])) {
    const instance = session.monsterInstances[id];
    if (instance) counts[instance.speciesId] = (counts[instance.speciesId] ?? 0) + 1;
  }
  return counts;
}

type SceneFieldCheck = (value: unknown) => boolean;
const sceneRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const sceneNumber: SceneFieldCheck = value => typeof value === "number" && Number.isFinite(value);
const sceneInteger: SceneFieldCheck = value => typeof value === "number" && Number.isSafeInteger(value);
const sceneCount: SceneFieldCheck = value => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const sceneText: SceneFieldCheck = value => typeof value === "string" && value.trim().length > 0;
const sceneBoolean: SceneFieldCheck = value => typeof value === "boolean";
const sceneDirection: SceneFieldCheck = value => value === "up" || value === "down" || value === "left" || value === "right";
const sceneStrings: SceneFieldCheck = value => Array.isArray(value) && value.every(sceneText);
const sceneStringOrList: SceneFieldCheck = value => sceneText(value) || sceneStrings(value);
const sceneNumbers: SceneFieldCheck = value => sceneRecord(value) && Object.values(value).every(sceneNumber);

function sceneShape(value: unknown, fields: Readonly<Record<string, SceneFieldCheck>>, required: readonly string[] = []): boolean {
  return sceneRecord(value) && required.every(key => Object.hasOwn(value, key))
    && Object.entries(value).every(([key, entry]) => Object.hasOwn(fields, key) && fields[key](entry));
}
const scenePoint: SceneFieldCheck = value => sceneShape(value, { x: sceneCount, y: sceneCount }, ["x", "y"]);
const sceneVariableValues: SceneFieldCheck = value => sceneNumbers(value)
  || sceneShape(value, { variableId: sceneText, value: sceneNumber }, ["variableId", "value"]);
const sceneRewardDeltas: SceneFieldCheck = value => sceneRecord(value)
  && Object.values(value).every(delta => sceneNumber(delta)
    || sceneShape(delta, { atLeast: sceneNumber }, ["atLeast"]));
const sceneExpectFields: Readonly<Record<keyof Omit<SceneExpectStep, "kind">, SceneFieldCheck>> = {
  playerAt: value => sceneShape(value, { x: sceneCount, y: sceneCount, mapId: sceneText }, ["x", "y"]),
  switchOn: sceneStringOrList, switchOff: sceneStringOrList,
  variableEquals: sceneVariableValues, variableAtLeast: sceneVariableValues,
  eventAt: value => sceneShape(value, { eventId: sceneText, x: sceneCount, y: sceneCount, mapId: sceneText }, ["eventId", "x", "y"]),
  eventOnMap: value => sceneShape(value, { eventId: sceneText, mapId: sceneText }, ["eventId", "mapId"]),
  eventDistanceToPlayerLessThan: value => sceneShape(value, { eventId: sceneText, distance: sceneNumber, mapId: sceneText }, ["eventId", "distance"]),
  followerCount: sceneCount,
  partyIncludes: sceneStringOrList, partyExcludes: sceneStringOrList,
  followerAt: value => sceneShape(value, { name: sceneText, x: sceneCount, y: sceneCount }, ["name", "x", "y"]),
  cameraAt: value => sceneShape(value, { cx: sceneNumber, cy: sceneNumber, tolerance: sceneNumber }, ["cx", "cy"]),
  lightingAmbient: value => sceneNumber(value) || sceneShape(value, { value: sceneNumber, tolerance: sceneNumber }, ["value"]),
  lightAt: value => sceneShape(value, { x: sceneCount, y: sceneCount, expected: sceneBoolean }, ["x", "y"]),
  lightCount: sceneCount,
  weatherKind: value => value === "none" || value === "rain" || value === "storm" || value === "snow" || value === "fog",
  animationPlaying: sceneBoolean, fieldSpawnCount: sceneCount, spawnedCount: sceneCount,
  pictureVisible: value => sceneText(value) || sceneShape(value, { id: sceneText, resourceId: sceneText }, ["id"]),
  bgmPlaying: sceneText, messageShown: sceneBoolean, gameOver: sceneBoolean,
  endingReached: sceneText, cutsceneLocked: sceneBoolean, mapId: sceneText,
  gameTimeAt: value => sceneShape(value, { minute: sceneCount, hour: sceneCount, day: sceneCount, season: isSeason, year: sceneCount }),
  timePhase: isTimePhase,
  cropStageAt: value => sceneShape(value, { x: sceneCount, y: sceneCount, stage: sceneCount, mapId: sceneText }, ["x", "y", "stage"]),
  inventoryCount: value => sceneNumbers(value) || sceneShape(value, { itemId: sceneText, count: sceneCount }, ["itemId", "count"]),
  inventoryDelta: sceneRewardDeltas, ownedMonsterDelta: sceneRewardDeltas,
  goldDelta: value => sceneInteger(value) || sceneShape(value, { atLeast: sceneInteger }, ["atLeast"]),
  interactionComplete: sceneBoolean,
  lastTransfer: value => sceneShape(value, { fromMapId: sceneText, eventId: sceneText, toMapId: sceneText }, ["fromMapId", "eventId", "toMapId"]),
  friendshipAtLeast: value => sceneNumbers(value) || sceneShape(value, { npcKey: sceneText, value: sceneNumber }, ["npcKey", "value"]),
  shopStock: value => sceneShape(value, { eventId: sceneText, itemIds: sceneStrings, prices: sceneNumbers, mapId: sceneText }, ["eventId", "itemIds"]),
};

// 스텝 종류별 허용 필드·필수 필드. 판정(isSceneTestInput)과 거부 문구(sceneTestInputProblem)가 이 표 하나를 쓴다.
interface SceneStepSpec {
  readonly fields: Readonly<Record<string, SceneFieldCheck>>;
  readonly required?: readonly string[];
  /** 필드 단위로 표현할 수 없는 조건. 어기면 고칠 방법을 담은 문구를 돌려준다. */
  readonly extra?: (value: Record<string, unknown>) => string | null;
}
const SCENE_STEP_SPECS: Readonly<Record<string, SceneStepSpec>> = {
  wait: { fields: { ticks: sceneCount }, required: ["ticks"] },
  face: { fields: { dir: sceneDirection }, required: ["dir"] },
  move: {
    fields: { dir: sceneDirection, to: scenePoint },
    extra: value => Object.hasOwn(value, "dir") === Object.hasOwn(value, "to")
      ? `dir 과 to 중 하나만 주세요(${Object.hasOwn(value, "dir") ? "둘 다 있음" : "둘 다 없음"}) — 한 칸 이동은 {kind:'move',dir:'up'}, 좌표까지 걷기는 {kind:'move',to:{x,y}}`
      : null,
  },
  walk: { fields: { to: scenePoint, adjacent: sceneBoolean }, required: ["to"] },
  set: { fields: {
    mapId: sceneText, x: sceneCount, y: sceneCount, facing: sceneDirection,
    switches: entry => sceneStrings(entry) || (sceneRecord(entry) && Object.values(entry).every(sceneBoolean)),
    variables: sceneNumbers, inventory: sceneNumbers, gold: sceneNumber, manualHint: sceneText,
  } },
  interact: { fields: { eventId: sceneText } },
  useItem: { fields: { itemId: sceneText }, required: ["itemId"] },
  snapshotRewards: { fields: {} },
  retryCheckpoint: { fields: {} },
  gift: { fields: { eventId: sceneText, itemId: sceneText }, required: ["itemId"] },
  purchase: {
    fields: { eventId: sceneText, itemId: sceneText,
      count: entry => sceneCount(entry) && Number(entry) > 0 && Number(entry) <= 99,
      unitPrice: sceneCount },
    required: ["eventId", "itemId", "count", "unitPrice"],
  },
  choose: { fields: { index: entry => typeof entry === "number" && Number.isSafeInteger(entry) && entry >= -1 }, required: ["index"] },
  present: { fields: { itemId: sceneText } },
  advanceDays: { fields: { days: sceneCount }, required: ["days"] },
  expect: {
    fields: sceneExpectFields,
    extra: value => Object.keys(value).length > 1
      ? null
      : `검사할 필드가 하나도 없습니다. 허용: ${Object.keys(sceneExpectFields).join(", ")}`,
  },
};

// 값이 틀렸을 때 기대 형식. 없는 필드는 일반 문구로 짚는다.
const SCENE_FIELD_EXPECTATIONS: Readonly<Record<string, string>> = {
  ticks: "0 이상의 정수", days: "0 이상의 정수", x: "0 이상의 정수", y: "0 이상의 정수", unitPrice: "0 이상의 정수",
  count: "1~99 정수", gold: "숫자", index: "-1 이상의 정수(선택지 0부터, -1 은 취소)",
  dir: "up|down|left|right", facing: "up|down|left|right",
  to: "{x,y} 0 이상의 정수 좌표", adjacent: "true/false",
  mapId: "비어 있지 않은 맵 id 문자열", eventId: "비어 있지 않은 이벤트 id 문자열", itemId: "비어 있지 않은 아이템 id 문자열",
  manualHint: "비어 있지 않은 문자열",
  switches: "스위치 id 배열 또는 {스위치id: true/false}", variables: "{변수id: 숫자}", inventory: "{아이템id: 개수}",
  playerAt: "{x,y,mapId?}", switchOn: "스위치 id 또는 id 배열", switchOff: "스위치 id 또는 id 배열",
  variableEquals: "{변수id: 숫자} 또는 {variableId,value}", variableAtLeast: "{변수id: 숫자} 또는 {variableId,value}",
  eventAt: "{eventId,x,y,mapId?}", eventOnMap: "{eventId,mapId}", eventDistanceToPlayerLessThan: "{eventId,distance,mapId?}",
  endingReached: "엔딩 id 문자열(예: ending_escape, 불리언 아님)", inventoryCount: "{아이템id: 개수} 또는 {itemId,count}",
  goldDelta: "정수 또는 {atLeast:정수}", inventoryDelta: "{아이템id: 정수 또는 {atLeast}}", ownedMonsterDelta: "{종id: 정수 또는 {atLeast}}",
  interactionComplete: "true/false", messageShown: "true/false", gameOver: "true/false", cutsceneLocked: "true/false",
  lastTransfer: "{fromMapId,eventId,toMapId}", timePhase: "시간대 이름", weatherKind: "none|rain|storm|snow|fog",
  // 아래는 거부 문구가 「값 형식이 맞지 않습니다」만 말하던 expect 필드 — 모델이 모양을 추측하며 같은 시험을 거듭 다시 불렀다
  // (2026-10-05 스트레스 p-shop: shopStock 에 [{itemId,price}] → [id…] 를 차례로 넣고 둘 다 거부).
  shopStock: "{eventId, itemIds:[아이템id…], prices?:{아이템id: 가격}, mapId?}",
  friendshipAtLeast: "{npcKey: 숫자} 또는 {npcKey,value}",
  followerCount: "0 이상의 정수", lightCount: "0 이상의 정수", fieldSpawnCount: "0 이상의 정수", spawnedCount: "0 이상의 정수",
  partyIncludes: "배우 id 또는 id 배열", partyExcludes: "배우 id 또는 id 배열",
  followerAt: "{name,x,y}", cameraAt: "{cx,cy,tolerance?}", lightingAmbient: "숫자 또는 {value,tolerance?}",
  lightAt: "{x,y,expected?}", animationPlaying: "true/false", bgmPlaying: "BGM 리소스 id 문자열",
  pictureVisible: "그림 id 문자열 또는 {id,resourceId?}", gameTimeAt: "{minute?,hour?,day?,season?,year?}",
  cropStageAt: "{x,y,stage,mapId?}",
};

// 모델이 자주 쓰는 틀린 필드 이름 → 올바른 이름.
const SCENE_FIELD_ALIASES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  set: { switch: "switches", switchIds: "switches", variable: "variables", items: "inventory", item: "inventory", position: "x/y", pos: "x/y", dir: "facing", direction: "facing" },
  present: { item: "itemId", items: "itemId", id: "itemId" },
  interact: {
    id: "eventId", event: "eventId", target: "eventId",
    to: "앞 스텝 {kind:\"walk\",to,adjacent:true}", adjacent: "앞 스텝 walk 의 adjacent", dir: "앞 스텝 {kind:\"face\",dir}(이벤트를 바라봐야 조사된다)",
  },
  choose: { option: "index", choice: "index", value: "index" },
  wait: { ms: "ticks", frames: "ticks", duration: "ticks" },
  move: { direction: "dir", target: "to", position: "to" },
  gift: { item: "itemId" },
  useItem: { item: "itemId", id: "itemId" },
  expect: { ending: "endingReached", ended: "endingReached", inventory: "inventoryCount", position: "playerAt", switch: "switchOn" },
};

function sceneValuePreview(value: unknown): string {
  const text = JSON.stringify(value);
  return text === undefined ? String(value) : text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

/** 좌표 필드({x,y}) 안쪽까지 짚는다. */
function sceneFieldProblem(key: string, value: unknown, check: SceneFieldCheck): string | null {
  if (check(value)) return null;
  if ((key === "to" || key === "playerAt") && sceneRecord(value)) {
    for (const axis of ["x", "y"] as const) {
      if (!sceneCount(value[axis])) return `${key}.${axis}: 0 이상의 정수여야 합니다(받은 값 ${sceneValuePreview(value[axis])})`;
    }
  }
  const expected = SCENE_FIELD_EXPECTATIONS[key];
  return `${key}: ${expected ? `${expected} 여야 합니다` : "값 형식이 맞지 않습니다"}(받은 값 ${sceneValuePreview(value)})`;
}

function sceneShapeProblem(
  value: Record<string, unknown>,
  fields: Readonly<Record<string, SceneFieldCheck>>,
  required: readonly string[],
  aliases: Readonly<Record<string, string>> = {},
): string | null {
  const missing = required.filter(key => !Object.hasOwn(value, key));
  if (missing.length > 0) return `필수 필드 누락: ${missing.join(", ")}`;
  const extras = Object.keys(value).filter(key => !Object.hasOwn(fields, key));
  if (extras.length > 0) {
    const renames = extras.flatMap(key => aliases[key] ? [`${key} → ${aliases[key]}`] : []);
    const allowed = Object.keys(fields).filter(key => key !== "kind");
    return `unexpected field(s): ${extras.join(", ")}${renames.length > 0 ? ` (${renames.join(", ")} 로 쓰세요)` : ""} — 허용 필드: ${allowed.length > 0 ? allowed.join(", ") : "(없음)"}`;
  }
  for (const [key, entry] of Object.entries(value)) {
    const problem = sceneFieldProblem(key, entry, fields[key]);
    if (problem) return problem;
  }
  return null;
}

function sceneStepProblem(value: unknown): string | null {
  if (!sceneRecord(value)) return `스텝은 객체여야 합니다(받은 값 ${sceneValuePreview(value)})`;
  const kinds = Object.keys(SCENE_STEP_SPECS).join(", ");
  if (!Object.hasOwn(value, "kind")) return `kind 가 없습니다. 허용 kind: ${kinds}`;
  const spec = typeof value.kind === "string" && Object.hasOwn(SCENE_STEP_SPECS, value.kind) ? SCENE_STEP_SPECS[value.kind] : undefined;
  if (!spec) return `kind ${typeof value.kind === "string" ? `'${value.kind}'` : sceneValuePreview(value.kind)} 는 지원하지 않습니다. 허용 kind: ${kinds}`;
  return sceneShapeProblem(value, { kind: sceneText, ...spec.fields }, ["kind", ...(spec.required ?? [])], SCENE_FIELD_ALIASES[value.kind as string])
    ?? spec.extra?.(value) ?? null;
}

/**
 * run_scene_test 입력의 첫 결함을 「steps[3] (move): …」 처럼 위치·필드·허용값과 함께 돌려준다. 문제 없으면 null.
 * 뭉뚱그린 거부 문구로는 모델이 같은 실수를 반복한다(run5 에서 4연속 거부).
 */
export function sceneTestInputProblem(value: unknown): string | null {
  if (!sceneRecord(value)) return "입력은 {mapId,start:{x,y},steps:[...]} 객체여야 합니다";
  const top = sceneShapeProblem(value, {
    mapId: sceneText,
    start: entry => sceneRecord(entry) && sceneCount(entry.x) && sceneCount(entry.y),
    steps: Array.isArray,
  }, ["mapId", "start", "steps"], { startPos: "start", map: "mapId", scenario: "steps" });
  if (top) {
    if (top.startsWith("start:") && sceneRecord(value.start)) {
      for (const axis of ["x", "y"] as const) {
        if (!sceneCount(value.start[axis])) return `start.${axis}: 0 이상의 정수여야 합니다(받은 값 ${sceneValuePreview(value.start[axis])})`;
      }
    }
    if (top.startsWith("steps:")) return `steps: 스텝 배열이어야 합니다(받은 값 ${sceneValuePreview(value.steps)})`;
    return top;
  }
  const steps = value.steps as readonly unknown[];
  for (let index = 0; index < steps.length; index += 1) {
    const problem = sceneStepProblem(steps[index]);
    if (!problem) continue;
    const step = steps[index];
    const kind = sceneRecord(step) && typeof step.kind === "string" && Object.hasOwn(SCENE_STEP_SPECS, step.kind) ? ` (${step.kind})` : "";
    return `steps[${index}]${kind}: ${problem}`;
  }
  return null;
}

/** Validate the complete script before autoruns, movement, or any debug-set step. */
export function isSceneTestInput(value: unknown): value is SceneTestInput {
  return sceneTestInputProblem(value) === null;
}

export function runSceneTest(project: Project, input: SceneTestInput, rewardProof?: SceneRewardProof, runnerOptions: SceneRunnerOptions = {}): SceneTestResult {
  const session = runnerOptions.initialSession ? structuredClone(runnerOptions.initialSession) : startSession(project, 1);
  const inputProblem = sceneTestInputProblem(input);
  if (inputProblem) {
    return result(false, project, session, emptyEventPositions(project), emptyCamera(session), [], [],
      [], 0, undefined, `Malformed scene test input: ${inputProblem}`, null, false, false, [],
      { kind: "invalid-input", stepIndex: 0, mapId: session.currentMapId });
  }
  const runtimeMaps = structuredClone(project.maps);
  const map = runtimeMaps[input.mapId];
  const log: string[] = [];
  if (!map) {
    return result(false, project, session, emptyEventPositions(project), emptyCamera(session), log, [], input.steps, 0, input.steps[0], `맵 없음: ${input.mapId}`, null, false, false);
  }
  session.currentMapId = input.mapId;
  session.x = input.start.x;
  session.y = input.start.y;
  applyMapDefaultLighting(session, map);
  applyMapBgmToSession(session.audio, resolveMapBgm(project, input.mapId));
  const state: RunnerState = {
    stepIndex: -1,
    interactions: [],
    rewardProof,
    project,
    runtimeMaps,
    session,
    eventPositions: emptyEventPositionsFromMaps(runtimeMaps),
    fieldSpawnState: null,
    log,
    camera: emptyCamera(session),
    lightingClockMs: 0,
    lightingFixedAccumulatorMs: 0,
    lightingTransition: null,
    timeFixedAccumulatorMs: 0,
    timeMinuteAccumulator: 0,
    activeAnimations: [],
    autoStartedKeys: new Set(),
    inCommonAuto: false,
    chasers: new Map(),
    encounterAccumulator: 0,
    recoverBeforeRandomEncounters: runnerOptions.recoverBeforeRandomEncounters === true,
    facing: "down",
    messages: [],
    gameOver: false,
    held: null,
    runtimeFailure: null,
    rewardBaseline: { gold: session.gold, inventory: { ...session.inventory }, monsters: ownedMonsterCounts(session) },
  };
  initializeFieldSpawnsForRunner(state);
  // 시작 지점의 구역 점유는 기준선만 심는다 — 장면 테스트가 시작하는 순간을
  // «구역 진입» 으로 치면 start 좌표를 구역 알에 놓는 모든 테스트가 예상 밖의 이벤트를 맞는다.
  {
    const startMap = currentMap(state);
    if (startMap) seedLocationOccupancy(state.session, startMap, { x: state.session.x, y: state.session.y });
  }
  syncFollowCamera(state);
  applyNpcSchedulesForRunner(state);
  refreshChasers(state);
  let autoReason: string | null;
  try {
    autoReason = rewardProof ? proofPosition(state) : null;
    if (rewardProof?.signal?.aborted) unverified("Cancelled");
    autoReason ??= runAutoTriggers(state);
    autoReason ??= state.runtimeFailure;
    autoReason ??= checkEarlyReward(state);
  } catch (cause) {
    state.setupFailure = { kind: "execution-failure", stepIndex: -1, mapId: state.session.currentMapId };
    autoReason = cause instanceof Error ? cause.message : String(cause);
  }
  if (autoReason !== null) {
    return result(false, project, state.session, state.eventPositions, state.camera, log, state.messages, input.steps, 0, input.steps[0], autoReason, state.fieldSpawnState, state.gameOver, state.activeAnimations.length > 0, state.interactions, state.setupFailure);
  }

  for (let i = 0; i < input.steps.length; i += 1) {
    const step = input.steps[i];
    state.stepIndex = i;
    let reason: string | null;
    try {
      if (rewardProof) {
        if (rewardProof.signal?.aborted) unverified("Cancelled");
        rewardProof.report.phase = i < rewardProof.protectedFrom ? "prelude"
          : rewardProof.repeatFrom !== undefined && i >= rewardProof.repeatFrom ? "repeat" : "claim";
        if (rewardProof.report.phase !== "prelude" && state.session.currentMapId !== rewardProof.target.mapId) unverified("Protected target map changed");
      }
      reason = runStep(state, step) ?? state.runtimeFailure;
      // 런타임은 매 프레임 자동 실행 페이지를 다시 본다 — 조사로 켠 스위치가 같은 맵의 자동 컷신(메멘토를 다 모으면
      // 열리는 문 등)을 세우면 바로 돈다. 러너는 맵 진입 때만 돌려서 그 컷신이 영영 안 돌았다(2026-09-24 회상 스토리).
      // 이미 돈 페이지는 autoStartedKeys 가 걸러 한 번만 돈다. 선택을 기다리는 중에는 건드리지 않는다.
      if (reason === null && !state.held && step.kind !== "expect") reason = runAutoTriggers(state) ?? state.runtimeFailure;
      reason ??= checkEarlyReward(state);
    } catch (cause) {
      state.setupFailure = { kind: "execution-failure", stepIndex: i, mapId: state.session.currentMapId };
      reason = `예외: ${cause instanceof Error ? cause.message : String(cause)}`;
    }
    if (reason !== null) {
      return result(false, project, state.session, state.eventPositions, state.camera, log, state.messages, input.steps, i, step, reason, state.fieldSpawnState, state.gameOver, state.activeAnimations.length > 0, state.interactions, state.setupFailure, state.failedSelection);
    }
  }

  return result(true, project, state.session, state.eventPositions, state.camera, log, state.messages, input.steps, input.steps.length, undefined, undefined, state.fieldSpawnState, state.gameOver, state.activeAnimations.length > 0, state.interactions);
}

function runStep(state: RunnerState, step: SceneStep): string | null {
  if (state.rewardProof && state.held && step.kind !== "choose"
    && !(step.kind === "expect" && step.mapId !== undefined && Object.keys(step).length === 2)) return "Unfinished interaction: only its pending choice may proceed";
  if (state.held && ["walk", "move", "interact", "gift", "useItem"].includes(step.kind)) return `Interaction still waiting for ${state.held.mode}`;
  switch (step.kind) {
    case "wait":
      return advanceTime(state, Math.max(0, Math.trunc(step.ticks)) * TICK_MS);
    case "face":
      state.facing = step.dir;
      return null;
    case "set":
      return runSetStep(state, step);
    case "move":
      if (state.session.horror?.hiding) return "숨어 있는 동안에는 움직일 수 없습니다 — interact 로 은신처에서 나오세요.";
      return runMoveStep(state, step);
    case "walk":
      if (state.session.horror?.hiding) return "숨어 있는 동안에는 움직일 수 없습니다 — interact 로 은신처에서 나오세요.";
      return runWalkStep(state, step);
    case "interact":
      return runInteractStep(state, step.eventId);
    case "useItem":
      return runUseItemStep(state, step.itemId);
    case "snapshotRewards":
      state.rewardBaseline = { gold: state.session.gold, inventory: { ...state.session.inventory }, monsters: ownedMonsterCounts(state.session) };
      if (state.rewardProof?.report.phase === "claim") state.rewardClaimSnapshotTaken = true;
      state.log.push(`reward baseline ${JSON.stringify(state.rewardBaseline)}`);
      return null;
    case "purchase":
      return runPurchaseStep(state, step);
    case "gift":
      return runGiftStep(state, step);
    case "choose":
      return runChooseStep(state, step.index);
    case "present":
      return runPresentStep(state, step.itemId);
    case "retryCheckpoint":
      return runRetryCheckpointStep(state);
    case "advanceDays":
      return advanceDaysForRunner(state, step.days);
    case "expect":
      if (state.rewardProof && step.interactionComplete && (step.goldDelta !== undefined || step.inventoryDelta || step.ownedMonsterDelta) && state.rewardProof.report.phase !== "prelude") {
        const phase = state.rewardProof.report.phase;
        const delta = rewardDelta(state.session, state.rewardBaseline);
        state.rewardProof.report[phase] = delta;
        if (phase === "repeat" && (delta.gold !== 0 || Object.values(delta.inventory).some(n => n !== 0) || Object.values(delta.monsters).some(n => n !== 0))) return "Protected repeat paid additional rewards";
      }
      return runExpectStep(state, step);
  }
}

function runSetStep(state: RunnerState, step: Extract<SceneStep, { kind: "set" }>): string | null {
  if (step.mapId !== undefined) {
    if (!state.project.maps[step.mapId]) return `set 대상 맵 없음: ${step.mapId}`;
    state.session.currentMapId = step.mapId;
    resetRuntimeMapForRunner(state, step.mapId);
    applyMapDefaultLighting(state.session, state.project.maps[step.mapId]);
    applyNpcSchedulesForRunner(state);
    refreshChasers(state);
  }
  if (step.x !== undefined) state.session.x = Math.trunc(step.x);
  if (step.y !== undefined) state.session.y = Math.trunc(step.y);
  if (step.facing !== undefined) state.facing = step.facing;
  if (Array.isArray(step.switches)) {
    for (const switchId of step.switches) state.session.switches[switchId] = true;
  } else if (step.switches) {
    for (const [switchId, value] of Object.entries(step.switches)) state.session.switches[switchId] = value;
  }
  for (const [variableId, value] of Object.entries(step.variables ?? {})) state.session.variables[variableId] = value;
  for (const [itemId, count] of Object.entries(step.inventory ?? {})) state.session.inventory[itemId] = count;
  if (step.gold !== undefined) state.session.gold = step.gold;
  syncFollowCamera(state);
  state.log.push(`set${step.manualHint ? `: ${step.manualHint}` : ""}`);
  return null;
}

function runMoveStep(state: RunnerState, step: Extract<SceneStep, { kind: "move" }>): string | null {
  if (state.gameOver) return "게임 오버 중에는 retryCheckpoint 또는 타이틀 복귀만 가능합니다.";
  if (isCutsceneInputLocked(state.session)) return "컷신 입력 잠금 중에는 플레이어 이동을 할 수 없습니다.";
  if (step.dir) {
    state.facing = step.dir;
    const delta = directionDelta(step.dir);
    return movePlayerOneStep(state, state.session.x + delta.x, state.session.y + delta.y);
  }
  return movePlayerToReachableTarget(state, step.to.x, step.to.y);
}

function movePlayerOneStep(state: RunnerState, x: number, y: number): string | null {
  if (state.rewardProof) {
    if (state.held) return "Unfinished interaction during walking";
    if (state.rewardProof.report.movementSteps >= 4096) return "NPC reward movement budget exhausted";
    state.rewardProof.report.movementSteps++;
  }
  if (state.held) return `Interaction still waiting for ${state.held.mode}`;
  const map = currentMap(state);
  if (!map) return `현재 맵 없음: ${state.session.currentMapId}`;
  if (!canMove(state.project, map, state.session.x, state.session.y, x, y)) {
    return `이동 불가: ${map.id} (${state.session.x},${state.session.y}) -> (${x},${y})`;
  }
  const blocking = findBlockingRuntimeEventAtInMap(state.project, map, state.session, state.eventPositions, x, y);
  if (blocking) {
    if (isFieldSpawnEventId(blocking.event.id) && blocking.trigger.kind === "eventTouch") {
      return runEventView(state, blocking);
    }
    if (firesOnPlayerCollision(blocking.trigger.kind)) {
      return runEventView(state, blocking);
    }
    return `이동 대상에 막는 이벤트가 있습니다: ${blocking.event.id} (${x},${y})`;
  }
  const previous = { x: state.session.x, y: state.session.y };
  state.session.x = x;
  state.session.y = y;
  recordFollowerPlayerStep(state.session, { ...previous, direction: state.facing });
  syncFollowCamera(state);
  // 섬하는 경로와 같은 순서: 드나듦 → 접촉 → 인카운터.
  const transition = fireLocationTransitionsForRunner(state);
  if (transition) return transition;
  const touch = findRuntimeEventAtInMap(state.project, map, state.session, state.eventPositions, x, y, PLAYER_COLLISION_TRIGGER_KINDS);
  if (touch) return runEventView(state, touch);
  return maybeTriggerRandomEncounterForRunner(state);
}

function movePlayerToReachableTarget(state: RunnerState, x: number, y: number): string | null {
  const map = currentMap(state);
  if (!map) return `현재 맵 없음: ${state.session.currentMapId}`;
  const reach = checkReachability(state.project, map.id, { x: state.session.x, y: state.session.y }, [{ x, y }]);
  if (!reach.reachable) return `이동 대상 도달 불가: ${map.id} (${state.session.x},${state.session.y}) -> (${x},${y})`;
  const previous = { x: state.session.x, y: state.session.y };
  state.session.x = x;
  state.session.y = y;
  recordFollowerPlayerStep(state.session, { ...previous, direction: state.facing });
  syncFollowCamera(state);
  const transition = fireLocationTransitionsForRunner(state);
  if (transition) return transition;
  const touch = findRuntimeEventAtInMap(state.project, map, state.session, state.eventPositions, x, y, PLAYER_COLLISION_TRIGGER_KINDS);
  if (touch) return runEventView(state, touch);
  return maybeTriggerRandomEncounterForRunner(state);
}

function runWalkStep(state: RunnerState, step: Extract<SceneStep, { kind: "walk" }>): string | null {
  if (state.gameOver) return "게임 오버 중에는 retryCheckpoint 또는 타이틀 복귀만 가능합니다.";
  if (isCutsceneInputLocked(state.session)) return "컷신 입력 잠금 중에는 플레이어 이동을 할 수 없습니다.";
  const map = currentMap(state);
  if (!map) return `현재 맵 없음: ${state.session.currentMapId}`;

  const start = { x: state.session.x, y: state.session.y };
  const target = step.to;
  const isGoal = (x: number, y: number): boolean => step.adjacent
    ? Math.abs(x - target.x) + Math.abs(y - target.y) === 1
    : x === target.x && y === target.y;
  const keyOf = (x: number, y: number): string => `${x},${y}`;
  const directions: readonly { readonly dir: Dir; readonly dx: number; readonly dy: number }[] = [
    { dir: "right", dx: 1, dy: 0 },
    { dir: "left", dx: -1, dy: 0 },
    { dir: "down", dx: 0, dy: 1 },
    { dir: "up", dx: 0, dy: -1 },
  ];
  const queue: Array<{ x: number; y: number }> = [start];
  const previous = new Map<string, { readonly from: string; readonly dir: Dir }>();
  const seen = new Set<string>([keyOf(start.x, start.y)]);
  let goal: { x: number; y: number } | null = isGoal(start.x, start.y) ? start : null;

  while (!goal && queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    for (const direction of directions) {
      const next = { x: current.x + direction.dx, y: current.y + direction.dy };
      const nextKey = keyOf(next.x, next.y);
      if (seen.has(nextKey) || !canMove(state.project, map, current.x, current.y, next.x, next.y)) continue;
      const blocking = findBlockingRuntimeEventAtInMap(
        state.project,
        map,
        state.session,
        state.eventPositions,
        next.x,
        next.y,
      );
      const exactTouchTarget = !step.adjacent
        && next.x === target.x
        && next.y === target.y
        && blocking !== undefined
        && firesOnPlayerCollision(blocking.trigger.kind);
      if (blocking && !exactTouchTarget) continue;
      seen.add(nextKey);
      previous.set(nextKey, { from: keyOf(current.x, current.y), dir: direction.dir });
      queue.push(next);
      if (isGoal(next.x, next.y)) {
        goal = next;
        break;
      }
    }
  }

  if (!goal) {
    const qualifier = step.adjacent ? "인접" : "도착";
    return `연속 보행 ${qualifier} 불가: ${map.id} (${start.x},${start.y}) -> (${target.x},${target.y})`;
  }

  const route: Dir[] = [];
  let cursor = keyOf(goal.x, goal.y);
  const startKey = keyOf(start.x, start.y);
  while (cursor !== startKey) {
    const entry = previous.get(cursor);
    if (!entry) return `연속 보행 경로 복원 실패: ${cursor}`;
    route.push(entry.dir);
    cursor = entry.from;
  }
  route.reverse();

  const originMapId = state.session.currentMapId;
  for (let index = 0; index < route.length; index += 1) {
    const dir = route[index];
    if (!dir) continue;
    state.facing = dir;
    const delta = directionDelta(dir);
    const reason = movePlayerOneStep(state, state.session.x + delta.x, state.session.y + delta.y);
    if (reason !== null) return reason;
    if (state.session.currentMapId !== originMapId) {
      if (index !== route.length - 1) return "연속 보행 도중 예상하지 않은 맵 전이가 발생했습니다.";
      state.log.push(`walk ${map.id} -> ${state.session.currentMapId} (${route.length} steps)`);
      return null;
    }
    if (state.gameOver) return "연속 보행 도중 게임 오버가 발생했습니다.";
  }

  if (step.adjacent) {
    const dx = target.x - state.session.x;
    const dy = target.y - state.session.y;
    state.facing = dx === 1 ? "right" : dx === -1 ? "left" : dy === 1 ? "down" : "up";
  }
  state.log.push(`walk ${map.id} (${start.x},${start.y}) -> (${state.session.x},${state.session.y}) (${route.length} steps)`);
  return null;
}

function runGiftStep(state: RunnerState, step: Extract<SceneStep, { kind: "gift" }>): string | null {
  if (state.gameOver) return "게임 오버 중에는 선물을 줄 수 없습니다.";
  const view = findGiftTargetEvent(state, step.eventId);
  if (!view) return step.eventId ? `선물 대상 이벤트 없음: ${step.eventId}` : "선물 대상 action 이벤트 없음";
  const result = giveGiftToNpc(state.project, state.session, view.event, step.itemId);
  state.log.push(
    result.ok
      ? `gift ${view.event.id} ${step.itemId}: ${result.rank} ${result.delta} => ${result.friendship}`
      : `gift ${view.event.id} ${step.itemId}: ${result.reason}`
  );
  if (!result.ok && result.reason !== "already-gifted") return result.message;
  return null;
}

function findGiftTargetEvent(state: RunnerState, eventId: string | undefined): RuntimeEventView | undefined {
  const map = currentMap(state);
  if (!map) return undefined;
  const events = runtimeEventViewsForMap(state.project, map, state.session, state.eventPositions);
  if (eventId) return events.find((view) => view.event.id === eventId);
  const delta = directionDelta(state.facing);
  // 조사와 같은 판정으로 찾는다 — **몸 사각** 겹침. 앵커 점 비교로는 3x3 NPC 의 가슴을 보고
  // 선물을 주려 할 때 "대상 없음" 이 되어, 게임에서는 되는 조작이 시나리오에서만 실패했다.
  const front = findGiftEventOverlapping(events, state.session.x + delta.x, state.session.y + delta.y);
  if (front) return front;
  return findGiftEventOverlapping(events, state.session.x, state.session.y);
}

/**
 * 이 칸을 몸 사각으로 덮는 action 이벤트. 배열 순서가 우선순위다(설계 결정 D5).
 * 프로브가 사각이 아니라 **점**인 이유: 런타임 조사(handleAction)도 앵커 정면 한 칸을 묻는다.
 * 여기서 사각으로 넓히면 시나리오가 게임보다 관대해져 통과가 증거가 되지 않는다.
 */
function findGiftEventOverlapping(
  events: readonly RuntimeEventView[],
  x: number,
  y: number
): RuntimeEventView | undefined {
  return events.find((view) => view.trigger.kind === "action" && rectsOverlap(view.bodyRect, pointRect(x, y)));
}

function runUseItemStep(state: RunnerState, itemId: string): string | null {
  const actorId = state.session.partyActorIds.find((id): id is string => typeof id === "string");
  const result = useItemFromMenu(state.project, state.session, itemId, actorId);
  state.log.push(`useItem ${itemId}: ${result.kind} ${result.message}`);
  return result.kind === "used" ? null : result.message;
}

function runInteractStep(state: RunnerState, expectedEventId?: string): string | null {
  // Capture before every selection exit; clear only when the intended event is selected.
  if (expectedEventId !== undefined) state.failedSelection = {
    stepIndex: state.stepIndex, mapId: state.session.currentMapId, eventId: expectedEventId,
  };
  if (state.gameOver) return "게임 오버 중에는 이벤트를 조사할 수 없습니다.";
  const map = currentMap(state);
  if (!map) return `현재 맵 없음: ${state.session.currentMapId}`;
  // 런타임(playSceneMovement handleAction)과 같다: 숨어 있으면 조사 키는 나오기, 은신처 조사는 숨기.
  const world = { project: state.project, map, session: state.session, positions: state.eventPositions };
  if (state.session.horror?.hiding) {
    const from = state.session.horror.hiding.eventId;
    toggleHiding(world);
    delete state.failedSelection;
    state.log.push(`hide exit ${from}`);
    return null;
  }
  const delta = directionDelta(state.facing);
  for (const target of [
    { mapId: map.id, x: state.session.x + delta.x, y: state.session.y + delta.y },
    { mapId: map.id, x: state.session.x, y: state.session.y },
  ]) {
    const event = findRuntimeEventAtInMap(state.project, map, state.session, state.eventPositions, target.x, target.y, "action");
    if (event) {
      if (expectedEventId !== undefined && event.event.id !== expectedEventId) return `Interaction target: expected ${expectedEventId}, actual ${event.event.id}`;
      delete state.failedSelection;
      if (event.page?.interaction?.kind === "hiding") {
        toggleHiding(world, event);
        const witnessed = state.session.horror?.hiding?.witnessedBy ?? [];
        state.log.push(`hide in ${event.event.id}${witnessed.length ? ` (seen by ${witnessed.join(",")})` : ""}`);
        return null;
      }
      return runEventView(state, event);
    }
    const chest = findChestAt(state.session, map.id, target.x, target.y);
    if (chest) {
      if (expectedEventId !== undefined) return `Interaction target: expected ${expectedEventId}, actual chest ${chest.id}`;
      state.log.push(`chest ${chest.id}: open`);
      return null;
    }
    const life = interactWithLifeField(state.project, state.session, target);
    if (life.kind !== "unhandled") {
      if (expectedEventId !== undefined) return `Interaction target: expected ${expectedEventId}, actual ${life.source}`;
      state.log.push(`${life.source} ${life.kind}: ${life.kind === "success" ? life.itemId : life.reason}`);
      return null;
    }
    const farm = interactWithFarmPlot(state.project, state.session, map, target.x, target.y, farmIntentForHand(state.project, state.session));
    if (farm.kind !== "ignored") {
      if (expectedEventId !== undefined) return `Interaction target: expected ${expectedEventId}, actual farm plot`;
      state.log.push(`farm ${farm.kind}: ${map.id} (${farm.x},${farm.y})${farm.cropId ? ` ${farm.cropId}` : ""}`);
      return null;
    }
  }
  state.setupFailure = { kind: "no-interaction-target", stepIndex: state.stepIndex, mapId: map.id };
  return `조사할 action 이벤트 없음: ${map.id} (${state.session.x},${state.session.y}) facing=${state.facing}`;
}

function runRetryCheckpointStep(state: RunnerState): string | null {
  if (!state.gameOver) return "게임 오버 상태가 아니어서 체크포인트 리트라이를 실행할 수 없습니다.";
  const restored = restoreSessionCheckpoint(state.project, state.session);
  if (!restored) return "복원할 체크포인트가 없습니다.";
  state.session = restored;
  state.gameOver = false;
  state.held = null;
  resetRuntimeMapForRunner(state, state.session.currentMapId);
  state.eventPositions = emptyEventPositionsFromMaps(state.runtimeMaps);
  initializeFieldSpawnsForRunner(state);
  state.camera = emptyCamera(state.session);
  state.encounterAccumulator = 0;
  applyNpcSchedulesForRunner(state);
  refreshChasers(state);
  syncFollowCamera(state);
  state.log.push("checkpoint retry");
  return null;
}

function runPurchaseStep(state: RunnerState, purchase: Extract<SceneStep, { kind: "purchase" }>): string | null {
  const held = state.held;
  if (held?.mode !== "shop") return "Purchase requires a shop opened by real interaction";
  if (held.currentEventId !== purchase.eventId) return `Shop seller: expected ${purchase.eventId}, actual ${held.currentEventId}`;
  const step = held.step;
  if (step.shopType === "sellOnly" || step.economy?.shopkeeperEnabled || step.shopServiceKind || step.economy?.haggleEnabled) {
    return "Purchase requires ordinary player-buy stock; shopkeeper, service and haggle modes are unsupported";
  }
  const closed = shopIsClosed(state.session, step);
  if (closed) return closed;
  const goods = shopItems(step, state.project).find(item => item.id === purchase.itemId);
  if (!goods) return `Shop stock: expected ${purchase.itemId}, actual ${JSON.stringify(step.itemIds)}`;
  if (goods.price !== purchase.unitPrice) return `Shop price: expected ${purchase.unitPrice}, actual ${goods.price}`;
  const scene = { session: state.session, syncRuntimeState: () => {} };
  const identity = { mapId: state.session.currentMapId, eventId: held.currentEventId };
  let merchantGold = beginShopVisit(scene, step, identity);
  const quantity = step.quantityMode === "select" ? purchase.count : 1;
  for (let bought = 0; bought < purchase.count; bought += quantity) {
    const transaction = handleShopTransaction(scene, goods, "buy", quantity, merchantGold);
    if (!transaction.ok) return `Purchase failed after ${bought} items: ${transaction.status}`;
    merchantGold = transaction.merchantGold;
    accrueShopLoyalty(scene, step, goods.price * quantity);
  }
  endShopVisit(scene, step, merchantGold, identity);
  state.log.push(`purchase ${purchase.eventId} ${purchase.itemId} count=${purchase.count} unitPrice=${goods.price}`);
  state.held = null;
  state.executingEventId = held.currentEventId;
  const stop = pump(state, held.interp, held.interp.resume(true));
  updateHeldInterpreter(state, held.interp, stop, held.currentEventId);
  return stop.stop === "failed" ? stop.reason : null;
}

function runChooseStep(state: RunnerState, index: number): string | null {
  if (state.rewardProof && index === -1) return "NPC reward unverified: choice cancellation";
  const held = state.held;
  if (!held || held.mode !== "choices") return "choose를 처리할 대기 중 선택지가 없습니다.";
  if (!Number.isInteger(index) || index < -1 || index >= held.choiceCount) return `Choice index ${index} is out of range (${held.choiceCount} options).`;
  const resolvedIndex = index === -1 ? cancelChoiceIndex(held.cancelBehavior, held.choiceCount) : index;
  if (resolvedIndex === null) return "선택지 취소가 허용되지 않습니다. 선택지는 열린 상태입니다.";
  state.held = null;
  state.executingEventId = held.currentEventId;
  const stop = pump(state, held.interp, held.interp.resume(resolvedIndex));
  refreshRoguelikeRoomForRunner(state);
  updateHeldInterpreter(state, held.interp, stop, held.currentEventId);
  return stop.stop === "failed" ? stop.reason : null;
}

function runPresentStep(state: RunnerState, itemId: string | undefined): string | null {
  const held = state.held;
  if (!held || held.mode !== "present") return "present를 처리할 대기 중 아이템 제시가 없습니다.";
  if (itemId !== undefined && !held.itemIds.includes(itemId)) {
    return `Item ${itemId} is not presentable (offered: ${held.itemIds.join(", ") || "none"}).`;
  }
  state.held = null;
  state.executingEventId = held.currentEventId;
  state.log.push(itemId === undefined ? "present: cancel" : `present: ${itemId}`);
  const stop = pump(state, held.interp, held.interp.resume(itemId));
  refreshRoguelikeRoomForRunner(state);
  updateHeldInterpreter(state, held.interp, stop, held.currentEventId);
  return stop.stop === "failed" ? stop.reason : null;
}

function runEventView(state: RunnerState, view: RuntimeEventView): string | null {
  state.interactions.push({ stepIndex: state.stepIndex, mapId: state.session.currentMapId, eventId: view.event.id });
  const proof = state.rewardProof;
  let earlyRewardBaseline: RewardDelta | undefined;
  if (proof) {
    if (state.held) return "Cannot abandon a held interaction for another event";
    if (proof.report.phase !== "prelude" && (state.proofEventActive || state.session.currentMapId !== proof.target.mapId || view.event.id !== proof.target.eventId)) return "Protected foreign map-event entry";
    if (isFieldSpawnEventId(view.event.id)) return "NPC reward unverified: field battle";
    if (!state.rewardClaimSnapshotTaken && state.session.currentMapId === proof.target.mapId && view.event.id === proof.target.eventId) earlyRewardBaseline = rewardSnapshot(state.session);
  }
  if (state.held) return `Interaction still waiting for ${state.held.mode}`;
  if (isFieldSpawnEventId(view.event.id)) return runFieldSpawnBattleForRunner(state, view.event.id);
  const commands = view.page?.commands ?? resolveEventPage(view.event, state.session)?.commands ?? view.event.commands;
  if (commands.length === 0) {
    state.held = null;
    state.log.push(`event ${view.event.id}: no commands`);
    return checkEarlyReward(state, earlyRewardBaseline);
  }
  const interp = createInterpreter([...commands], state.session, state.project, {
    currentEventId: view.event.id, eventPositions: state.eventPositions,
    ...(proof ? { beforeCommand: (command: Command) => proofCommand(state, command), onUnverified: unverified } : {}),
  });
  state.log.push(`event ${view.event.id} start`);
  const wasActive = state.proofEventActive;
  state.proofEventActive = true;
  state.executingEventId = view.event.id;
  const stop = pump(state, interp, interp.start());
  state.proofEventActive = wasActive;
  refreshRoguelikeRoomForRunner(state);
  updateHeldInterpreter(state, interp, stop, view.event.id);
  // Keep synchronous baselines local across nested events; only held choices outlive this call.
  if (earlyRewardBaseline && state.held) state.earlyRewardBaseline = earlyRewardBaseline;
  // A walk may dispatch several touch interactions; do not net their deltas together.
  return stop.stop === "failed" ? stop.reason : checkEarlyReward(state, earlyRewardBaseline);
}

function updateHeldInterpreter(
  state: RunnerState,
  interp: Interpreter,
  stop: PumpStop,
  currentEventId: string | undefined
): void {
  if (state.held && state.held.interp !== interp) {
    state.runtimeFailure = `Nested interaction still waiting for ${state.held.mode}; cannot replace its interpreter`;
    return;
  }
  if (stop.stop === "choices" || stop.stop === "present" || stop.stop === "animation" || stop.stop === "shop") {
    state.held = stop.stop === "choices"
      ? { interp, mode: "choices", currentEventId, choiceCount: stop.choiceCount, cancelBehavior: stop.cancelBehavior }
      : stop.stop === "present" ? { interp, mode: "present", currentEventId, itemIds: stop.itemIds }
      : stop.stop === "shop" ? { interp, mode: "shop", currentEventId, step: stop.step }
      : { interp, mode: "animation", currentEventId };
    return;
  }
  if (currentEventId) releaseCutsceneControlForOwner(state.session, currentEventId);
  state.held = null;
}

function pump(state: RunnerState, interp: Interpreter, first: StepResult): PumpStop {
  let step = first;
  for (let guard = 0; guard < 100000; guard += 1) {
    switch (step.kind) {
      case "done":
        refreshRoguelikeRoomForRunner(state);
        return { stop: "done" };
      case "pathfindMove":
      case "openMenuScreen":
      case "openLoadMenu":
        return { stop: "failed", reason: `${step.kind}: 출하 플레이어 하네스로 검증해야 하는 명령` };
      case "choices":
        return { stop: "choices", choiceCount: step.options.length, cancelBehavior: step.cancelBehavior };
      case "presentItem":
        if (step.prompt) state.messages.push(step.prompt);
        // 보여줄 것이 없으면 실플레이어처럼 prompt 만 띄우고 닫힘(취소)으로 이어 간다.
        if (step.items.length === 0) {
          step = interp.resume(undefined);
          break;
        }
        return { stop: "present", itemIds: step.items.map((item) => item.itemId) };
      case "text":
        state.messages.push(step.body);
        step = interp.resume(undefined);
        break;
      case "wait":
        {
          if (state.rewardProof && (!Number.isFinite(step.ms) || step.ms < 0 || step.ms > 60000)) return { stop: "failed", reason: "Unsupported reward-proof wait duration" };
          const failure = advanceTime(state, step.ms);
          if (failure) return { stop: "failed", reason: failure };
        }
        step = interp.resume(undefined);
        break;
      case "advanceTime":
        {
          const failure = advanceCommandTimeForRunner(state, step);
          if (failure) return { stop: "failed", reason: failure };
        }
        step = interp.resume(undefined);
        break;
      case "setTime":
        {
          const failure = setClockForRunner(state, step.hour, step.minute);
          if (failure) return { stop: "failed", reason: failure };
        }
        step = interp.resume(undefined);
        break;
      case "sleepUntilMorning":
        {
          const failure = sleepUntilMorningForRunner(state);
          if (failure) return { stop: "failed", reason: failure };
        }
        step = interp.resume(undefined);
        break;
      case "transfer":
        if (state.rewardProof && state.rewardProof.report.phase !== "prelude") return { stop: "failed", reason: "Protected transfer" };
        if (state.rewardProof && step.direction && step.direction !== "retain") state.facing = step.direction;
        state.lastTransfer = state.executingEventId ? { fromMapId: state.session.currentMapId, eventId: state.executingEventId, toMapId: step.mapId } : undefined;
        {
          // 순간이동은 산법 맵의 점유를 통째로 leave 로 낸다(실하 경로와 같은 산법).
          // 이 leave 는 산법 맵 이벤트가 받아야 하므로 맵을 바꾸기 전에 돌린다.
          const left = leaveAllLocationsOnMap(state.session, state.session.currentMapId);
          const failure = runLocationTransitionTriggersForRunner(state, left);
          if (failure) return { stop: "failed", reason: failure };
        }
        state.session.currentMapId = step.mapId;
        state.session.x = step.x;
        state.session.y = step.y;
        {
          resetRuntimeMapForRunner(state, step.mapId);
          const targetMap = currentMap(state);
          if (targetMap) applyMapDefaultLighting(state.session, targetMap);
          if (targetMap) applyMapBgmToSession(state.session.audio, resolveMapBgm(state.project, step.mapId));
        }
        if (resolveCompanionRules(state.project.system.companions).clearOnTransfer) {
          removeFollowerFromSession(state.session, { all: true });
        }
        resetFollowerTrailNearPlayer(state.session, state.project.maps[step.mapId], state.project.system.companions);
        applyNpcSchedulesForRunner(state);
        refreshChasers(state);
        syncFollowCamera(state);
        if (state.rewardProof) {
          const landingFailure = proofPosition(state);
          if (landingFailure) return { stop: "failed", reason: landingFailure };
        }
        clearMapAutoKeys(state);
        {
          // 도착 지점의 구역 진입은 자동 트리거보다 먼지 돌린다(실하 경로와 같은 우선순위).
          // 기록이 없는 맵은 첫 판정이 seed 로 떨어지므로 도착 기준선을 먼지 열어 둔다.
          beginLocationOccupancyOnMap(state.session, state.session.currentMapId);
          const failure = fireLocationTransitionsForRunner(state);
          if (failure) return { stop: "failed", reason: failure };
        }
        {
          const autoReason = runAutoTriggers(state);
          if (autoReason) return { stop: "failed", reason: autoReason };
        }
        step = interp.resume(undefined);
        break;
      case "showPicture":
        showPictureState(state.session, step);
        if (step.waitForPicture === true) {
          const failure = advanceTime(state, step.durationMs ?? 0);
          if (failure) return { stop: "failed", reason: failure };
        }
        step = interp.resume(undefined);
        break;
      case "erasePicture":
        erasePictureState(state.session, step.pictureId);
        step = interp.resume(undefined);
        break;
      case "playAudio":
        setAudioState(state.session, step);
        step = interp.resume(undefined);
        break;
      case "stopAudio":
        clearAudioState(state.session);
        step = interp.resume(undefined);
        break;
      case "cameraControl":
        startCameraControl(state, step);
        if (step.wait) {
          const failure = advanceUntilCameraSettled(state);
          if (failure) return { stop: "failed", reason: failure };
        }
        step = interp.resume(undefined);
        break;
      case "scrollMap":
        startScrollMap(state, step);
        if (step.wait) {
          const failure = advanceUntilCameraSettled(state);
          if (failure) return { stop: "failed", reason: failure };
        }
        step = interp.resume(undefined);
        break;
      case "setLighting":
        startLightingTransition(state, step);
        {
          const failure = advanceUntilLightingSettled(state);
          if (failure) return { stop: "failed", reason: failure };
        }
        step = interp.resume(undefined);
        break;
      case "setWeather":
        applyWeatherStepToRunner(state, step);
        step = interp.resume(undefined);
        break;
      case "showEmote":
        step = interp.resume(undefined);
        break;
      case "showAnimation":
        startSceneAnimation(state, step.animationId);
        if (step.wait) {
          return { stop: "animation" };
        }
        step = interp.resume(undefined);
        break;
      case "relocateEvents":
        for (const eventId of step.eventIds) state.chasers.delete(eventId);
        refreshChasers(state);
        syncFollowCamera(state);
        step = interp.resume(undefined);
        break;
      case "spawnEvent":
      case "removeEvent":
      case "vehicle":
      case "setEventGraphicPattern":
      case "changeTile":
      case "timer":
      case "moveEvent":
      case "waitForAllMovement":
      case "stopAllMovement":
      case "inn":
      case "flashScreen":
      case "shakeScreen":
      case "particleEffect":
      case "spriteLook":
        step = interp.resume(undefined);
        break;
      case "shop":
        state.log.push(`shop: ${formatShopItems(step.items ?? step.itemIds.map((itemId) => ({ itemId })))}`);
        return { stop: "shop", step };
      case "inputWait":
        step = interp.resume(0);
        break;
      case "inputNumber":
        step = interp.resume(numberInputAnswer(state.project, step.variableId));
        break;
      case "enterHeroName":
        step = interp.resume("");
        break;
      case "battleProcessing":
        {
          const outcome = runHeadlessBattle(state, step);
          state.session.battleResult = outcome;
          state.log.push(`battle ${step.troopId}: ${outcome}`);
          if (outcome === "defeat" && !step.canLose) {
            killPartyForRunner(state);
            state.gameOver = true;
            // 실제 플레이어(playSceneInterpreter consumeBlockingStep)는 패배 불허 전투에 지면 이벤트를 거기서 끝낸다.
            // 예전 러너는 이어서 뒤 명령(엔딩 포함)을 돌려, 못 이기는 문지기 뒤의 triggerEnding 도 도달로 셌다(2026-09-28 실측).
            refreshRoguelikeRoomForRunner(state);
            return { stop: "done" };
          }
        }
        step = interp.resume(undefined);
        break;
      case "eraseEvent":
        if (step.eventId) state.session.erasedEventIds = [...new Set([...(state.session.erasedEventIds ?? []), step.eventId])];
        step = interp.resume(undefined);
        break;
      case "gameOver":
        state.gameOver = true;
        step = interp.resume(undefined);
        break;
      case "returnToTitle":
        step = interp.resume(undefined);
        break;
    }
  }
  return { stop: "failed", reason: "인터프리터 무한루프 가드 도달" };
}

/**
 * 구역 드나듦 트리거 — 실하 재버이 무직하지 안는 유일한 이유는 이 하네스가 그 경로를
 * **거지지 않으니** 다. 그러니 판정은 산법(`project/locationTransitions.ts`)을 그대로 쓰고
 * 실행만 이 하네스의 `runEventView` 로 한다 — 엔진이 티 곳이 되지 않도록 극복한다.
 */
function runLocationTransitionTriggersForRunner(
  state: RunnerState,
  transitions: readonly LocationTransition[],
): string | null {
  if (transitions.length === 0) return null;
  const map = currentMap(state);
  if (!map) return `현재 맵 없음: ${state.session.currentMapId}`;
  const pending: RuntimeEventView[] = [];
  for (const transition of transitions) {
    for (const view of runtimeEventViewsForMap(state.project, map, state.session, state.eventPositions)) {
      if (!triggerMatchesTransition(view.trigger, transition)) continue;
      pending.push(view);
    }
  }
  for (const view of pending) {
    const failure = runEventView(state, view);
    if (failure) return failure;
  }
  return null;
}

/** 한 걸음(또는 한 번의 이동) 이 끝난 뒤 점유를 갱신하고 트리거를 돌린다. */
function fireLocationTransitionsForRunner(state: RunnerState): string | null {
  const map = currentMap(state);
  if (!map) return `현재 맵 없음: ${state.session.currentMapId}`;
  const update = updateLocationOccupancy(state.session, map, { x: state.session.x, y: state.session.y });
  return runLocationTransitionTriggersForRunner(state, update.transitions);
}

/** 맵 자동 이벤트 키만 지운다. 공통 이벤트 키까지 지우면, 스위치를 끄기 전에 이동하는 깨기 이벤트가 도착 맵에서 다시 자신을 부른다. */
function clearMapAutoKeys(state: RunnerState): void {
  for (const key of [...state.autoStartedKeys]) {
    if (!key.startsWith("common:")) state.autoStartedKeys.delete(key);
  }
}

function runAutoTriggers(state: RunnerState): string | null {
  const map = currentMap(state);
  if (!map) return `현재 맵 없음: ${state.session.currentMapId}`;
  const autos = runtimeEventViewsForMap(state.project, map, state.session, state.eventPositions)
    .filter((event) => event.trigger.kind === "auto");
  for (const event of autos) {
    const key = `${state.session.currentMapId}:${event.event.id}:${event.pageId ?? "legacy"}`;
    if (state.autoStartedKeys.has(key)) continue;
    state.autoStartedKeys.add(key);
    const failure = runEventView(state, event);
    if (failure) return failure;
  }
  // 실플레이어 fireAutoTriggers 와 같이, 조건 스위치가 켜진 자동 공통 이벤트도 돈다.
  // 꿈에서 깨는 스위치 아이템은 맵을 바꾸기 전에 이 이벤트로 방으로 돌아간다(2026-09-24).
  for (const commonEvent of state.project.commonEvents) {
    if (commonEvent.trigger !== "auto") continue;
    const key = `common:${commonEvent.id}`;
    if (commonEvent.conditionSwitchId && state.session.switches[commonEvent.conditionSwitchId] !== true) {
      state.autoStartedKeys.delete(key);
      continue;
    }
    if (state.autoStartedKeys.has(key) || state.held || state.inCommonAuto) continue;
    state.autoStartedKeys.add(key);
    state.inCommonAuto = true;
    let failure: string | null;
    try {
      failure = runCommonEventForRunner(state, commonEvent);
    } finally {
      state.inCommonAuto = false;
    }
    if (failure) return failure;
  }
  return null;
}

function runCommonEventForRunner(state: RunnerState, commonEvent: { id: string; commands: readonly Command[] }): string | null {
  if (commonEvent.commands.length === 0) return null;
  state.log.push(`common ${commonEvent.id} start`);
  const interp = createInterpreter([...commonEvent.commands], state.session, state.project);
  const stop = pump(state, interp, interp.start());
  if (stop.stop === "failed") return stop.reason;
  if (stop.stop !== "done") return `common ${commonEvent.id}: 블로킹 단계 ${stop.stop}는 headless에서 처리할 수 없습니다.`;
  state.log.push(`common ${commonEvent.id} done`);
  return null;
}

function startCameraControl(
  state: RunnerState,
  step: Extract<StepResult, { kind: "cameraControl" }>
): void {
  if (step.mode === "follow") {
    const finalState = cameraSessionState("follow", step.target, step.offsetX, step.offsetY, step.zoom);
    state.session.camera = finalState;
    state.camera.followTarget = step.target;
    state.camera.tween = null;
    syncFollowCamera(state);
    return;
  }
  const target = step.mode === "return" || step.returnToPlayer ? { kind: "player" as const } : step.target;
  const finalMode = step.mode === "return" || step.returnToPlayer ? "follow" : "fixed";
  const finalState = cameraSessionState(finalMode, target, step.offsetX, step.offsetY, step.zoom);
  startCameraTween(state, resolveCameraTarget(state, target, step.offsetX, step.offsetY), step.durationMs, finalState);
}

function startScrollMap(
  state: RunnerState,
  step: Extract<StepResult, { kind: "scrollMap" }>
): void {
  const distance = Math.max(0, step.distanceTiles) * 16;
  const target = { x: state.camera.cx, y: state.camera.cy };
  if (step.direction === "left") target.x -= distance;
  if (step.direction === "right") target.x += distance;
  if (step.direction === "up") target.y -= distance;
  if (step.direction === "down") target.y += distance;
  const finalState: RuntimeCameraSessionState = step.lock && !step.returnToPlayer
    ? { mode: "fixed", target: { kind: "position", x: Math.floor(target.x / 16), y: Math.floor(target.y / 16) } }
    : { mode: "follow", target: { kind: "player" } };
  const finalTarget = step.returnToPlayer ? resolveCameraTarget(state, { kind: "player" }) : target;
  startCameraTween(state, finalTarget, step.durationMs, finalState);
}

function startCameraTween(
  state: RunnerState,
  target: { readonly x: number; readonly y: number },
  durationMs: number,
  finalState: RuntimeCameraSessionState
): void {
  const duration = Math.max(0, Math.round(durationMs));
  state.camera.followTarget = null;
  if (duration === 0) {
    state.camera.cx = target.x;
    state.camera.cy = target.y;
    state.session.camera = finalState;
    if (finalState.mode === "follow") state.camera.followTarget = finalState.target;
    syncFollowCamera(state);
    return;
  }
  state.camera.tween = {
    fromX: state.camera.cx,
    fromY: state.camera.cy,
    toX: target.x,
    toY: target.y,
    durationMs: duration,
    elapsedMs: 0,
    finalState,
  };
}

function advanceUntilCameraSettled(state: RunnerState): string | null {
  let guard = 0;
  while (state.camera.tween && guard < 10000) {
    guard += 1;
    const failure = advanceTime(state, TICK_MS);
    if (failure) return failure;
  }
  return null;
}

function startLightingTransition(
  state: RunnerState,
  step: Extract<StepResult, { kind: "setLighting" }>
): void {
  const current = normalizeLightingState(state.session.lighting);
  const durationMs = Math.max(0, Math.round(step.transitionMs));
  if (durationMs <= 0) {
    setSessionLighting(state.session, { ambient: step.ambient, color: step.color });
    state.lightingTransition = null;
    return;
  }
  state.lightingTransition = {
    fromAmbient: current.ambient,
    toAmbient: normalizeLightingState({ ambient: step.ambient, color: step.color, sources: current.sources }).ambient,
    fromColor: current.color,
    toColor: step.color,
    durationMs,
    elapsedMs: 0,
  };
}

function advanceUntilLightingSettled(state: RunnerState): string | null {
  let guard = 0;
  while (state.lightingTransition && guard < 10000) {
    guard += 1;
    const failure = advanceTime(state, TICK_MS);
    if (failure) return failure;
  }
  return state.lightingTransition ? "조명 전환 가드 도달" : null;
}

function applyWeatherStepToRunner(
  state: RunnerState,
  step: Extract<StepResult, { kind: "setWeather" }>
): void {
  const weather = normalizeWeatherParams({ kind: step.weather, intensity: step.intensity });
  ensureM2Runtime(state.session).screen.weather = weatherToRuntimeString(weather);
}

function startSceneAnimation(state: RunnerState, animationId: string): void {
  const record = state.project.database.battleAnimations.find((entry) => entry.id === animationId);
  state.activeAnimations.push({ animationId, remainingMs: battleAnimationDurationMs(record) });
}

function advanceTime(state: RunnerState, ms: number): string | null {
  let remaining = Math.max(0, Math.round(ms));
  if (remaining === 0) {
    syncFollowCamera(state);
    return state.runtimeFailure;
  }
  while (remaining > 0) {
    const delta = Math.min(TICK_MS, remaining);
    remaining -= delta;
    state.session.playTimeSeconds += delta / 1000;
    const timeFailure = advanceGameTimeByRealDelta(state, delta);
    if (timeFailure) return timeFailure;
    advanceCamera(state, delta);
    advanceLighting(state, delta);
    advanceAnimations(state, delta);
    resumeHeldAnimationIfReady(state);
    advanceFieldSpawnsForRunner(state, delta);
    advanceChasers(state, delta);
    if (state.runtimeFailure) return state.runtimeFailure;
  }
  return null;
}

function advanceGameTimeByRealDelta(state: RunnerState, deltaMs: number): string | null {
  const system = resolveTimeSystem(state.project);
  if (!system) return null;
  state.session.gameTime ??= initialGameTime(system);
  if (!state.session.gameTime || isCutsceneInputLocked(state.session)) return null;
  state.timeFixedAccumulatorMs += Math.max(0, deltaMs);
  while (state.timeFixedAccumulatorMs >= 1000) {
    state.timeFixedAccumulatorMs -= 1000;
    state.timeMinuteAccumulator += system.minutesPerRealSecond;
    const wholeMinutes = Math.floor(state.timeMinuteAccumulator);
    if (wholeMinutes <= 0) continue;
    state.timeMinuteAccumulator -= wholeMinutes;
    const failure = advanceGameMinutesForRunner(state, wholeMinutes);
    if (failure) return failure;
  }
  return null;
}

function advanceCommandTimeForRunner(
  state: RunnerState,
  step: Extract<StepResult, { kind: "advanceTime" }>
): string | null {
  const before = structuredClone(state.session);
  const daysFailure = advanceDaysForRunner(state, step.days ?? 0);
  const minutes = Math.max(0, Math.trunc(step.minutes ?? 0));
  const failure = daysFailure ?? (minutes > 0 ? advanceGameMinutesForRunner(state, minutes) : null);
  if (failure) state.session = before;
  return failure;
}

function advanceDaysForRunner(state: RunnerState, days: number): string | null {
  const before = structuredClone(state.session);
  const count = Math.max(0, Math.trunc(days));
  for (let index = 0; index < count; index += 1) {
    const failure = sleepUntilMorningForRunner(state);
    if (failure) { state.session = before; return failure; }
  }
  return null;
}

function advanceGameMinutesForRunner(state: RunnerState, minutes: number): string | null {
  const before = structuredClone(state.session);
  const failure = advanceGameMinutesDraftForRunner(state, minutes);
  if (failure) state.session = before;
  return failure;
}

function advanceGameMinutesDraftForRunner(state: RunnerState, minutes: number): string | null {
  const system = resolveTimeSystem(state.project);
  if (!system) return null;
  state.session.gameTime ??= initialGameTime(system);
  if (!state.session.gameTime) return null;
  let remaining = Math.max(0, Math.trunc(minutes));
  while (remaining > 0) {
    const currentTime: GameTime | undefined = state.session.gameTime;
    if (!currentTime) return null;
    const untilEnd = minutesUntilDayEnd(currentTime, system);
    if (untilEnd > remaining) {
      const advanced = advanceTimeAcrossDayBoundaries(state.project, state.session, remaining);
      if (!advanced.ok) return `day transition: ${advanced.reason}`;
      applyNpcSchedulesForRunner(state);
      return null;
    }
    if (system.forceSleep) return sleepUntilMorningForRunner(state);
    remaining -= untilEnd;
    const transitionFailure = transitionToNextDayForRunner(state);
    if (transitionFailure) return transitionFailure;
    applyNpcSchedulesForRunner(state);
  }
  return null;
}

function setClockForRunner(state: RunnerState, hour: number, minute: number | undefined): string | null {
  const system = resolveTimeSystem(state.project);
  if (!system) return null;
  state.session.gameTime ??= initialGameTime(system);
  const changed = setTimeWithMakers(state.project, state.session, { hour, minute });
  if (!changed.ok) return `clock change: ${changed.reason}`;
  applyNpcSchedulesForRunner(state);
  return null;
}

function sleepUntilMorningForRunner(state: RunnerState): string | null {
  const system = resolveTimeSystem(state.project);
  if (!system) return null;
  state.session.gameTime ??= initialGameTime(system);
  if (!state.session.gameTime) return null;
  const transitionFailure = transitionToNextDayForRunner(state);
  if (transitionFailure) return transitionFailure;
  applyNpcSchedulesForRunner(state);
  state.timeFixedAccumulatorMs = 0;
  state.timeMinuteAccumulator = 0;
  state.log.push(`sleep until morning: ${state.session.gameTime.season} ${state.session.gameTime.day} ${state.session.gameTime.hour}:00`);
  return null;
}

function transitionToNextDayForRunner(state: RunnerState): string | null {
  const currentTime = state.session.gameTime;
  if (!currentTime) return "day transition: missing-time";
  const sourceDayKey = calendarDayKey(currentTime);
  const beforeHook = structuredClone(state.session);
  const hookFailure = runDayEndHookForRunner(state);
  if (hookFailure) {
    state.session = beforeHook;
    return hookFailure;
  }
  const transition = transitionToNextDay(state.project, state.session, sourceDayKey);
  if (transition.ok) return null;
  state.session = beforeHook;
  return `day transition: ${transition.reason}`;
}

function applyNpcSchedulesForRunner(state: RunnerState): void {
  const system = resolveTimeSystem(state.project);
  if (!system || isCutsceneInputLocked(state.session)) return;
  state.session.gameTime ??= initialGameTime(system);
  if (!state.session.gameTime) return;
  state.session.npcActivities ??= {};
  state.session.npcScheduleStates ??= {};
  const activeIds = new Set<string>();
  for (const map of Object.values(state.runtimeMaps)) {
    for (const event of map.events) {
      if (!event.schedule?.length) continue;
      activeIds.add(event.id);
      const target = npcScheduleTargetForEvent(map.id, event, state.session.gameTime);
      if (!target) continue;
      const targetMap = state.runtimeMaps[target.mapId];
      if (!targetMap) continue;
      if (target.activity) state.session.npcActivities[event.id] = target.activity;
      else delete state.session.npcActivities[event.id];
      const destination = passableScheduleDestination(state.project, targetMap, target.x, target.y);
      state.session.eventLocations[event.id] = {
        mapId: targetMap.id,
        x: destination.x,
        y: destination.y,
        direction: target.facing,
      };
      if (targetMap.id === state.session.currentMapId) {
        state.eventPositions[event.id] = { x: destination.x, y: destination.y, direction: target.facing };
      } else {
        delete state.eventPositions[event.id];
      }
      state.session.npcScheduleStates[event.id] = { routeKey: target.key };
    }
  }
  for (const eventId of Object.keys(state.session.npcActivities)) {
    if (!activeIds.has(eventId)) delete state.session.npcActivities[eventId];
  }
}

function passableScheduleDestination(
  project: Project,
  map: GameMap,
  x: number,
  y: number
): { readonly x: number; readonly y: number } {
  const cx = Math.max(0, Math.min(map.width - 1, Math.trunc(x)));
  const cy = Math.max(0, Math.min(map.height - 1, Math.trunc(y)));
  if (isPassable(project, map, cx, cy)) return { x: cx, y: cy };
  for (let radius = 1; radius < Math.max(map.width, map.height); radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const tx = cx + dx;
        const ty = cy + dy;
        if (isPassable(project, map, tx, ty)) return { x: tx, y: ty };
      }
    }
  }
  return { x: cx, y: cy };
}

function runDayEndHookForRunner(state: RunnerState): string | null {
  const system = resolveTimeSystem(state.project);
  const hook = system?.onDayEnd ? state.project.commonEvents.find((event) => event.id === system.onDayEnd) : undefined;
  if (!hook?.commands.length) return null;
  if (state.rewardProof) return "NPC reward unverified: calendar common-event hook";
  state.log.push(`onDayEnd ${hook.id} start`);
  const interp = createInterpreter([...hook.commands], state.session, state.project);
  const stop = pump(state, interp, interp.start());
  if (stop.stop === "failed") return stop.reason;
  if (stop.stop === "choices" || stop.stop === "present" || stop.stop === "animation") return `onDayEnd ${hook.id}: 블로킹 단계 ${stop.stop}는 headless에서 처리할 수 없습니다.`;
  state.log.push(`onDayEnd ${hook.id} done`);
  return null;
}

function advanceAnimations(state: RunnerState, deltaMs: number): void {
  for (const animation of state.activeAnimations) {
    animation.remainingMs -= deltaMs;
  }
  state.activeAnimations = state.activeAnimations.filter((animation) => animation.remainingMs > 0);
}

function resumeHeldAnimationIfReady(state: RunnerState): void {
  if (!state.held || state.held.mode !== "animation" || state.activeAnimations.length > 0) return;
  const held = state.held;
  state.held = null;
  state.executingEventId = held.currentEventId;
  const stop = pump(state, held.interp, held.interp.resume(undefined));
  updateHeldInterpreter(state, held.interp, stop, held.currentEventId);
  if (stop.stop === "failed") state.runtimeFailure = stop.reason;
}

function advanceLighting(state: RunnerState, deltaMs: number): void {
  state.lightingFixedAccumulatorMs += Math.max(0, deltaMs);
  while (state.lightingFixedAccumulatorMs >= LIGHTING_FIXED_STEP_MS) {
    state.lightingFixedAccumulatorMs -= LIGHTING_FIXED_STEP_MS;
    state.lightingClockMs += LIGHTING_FIXED_STEP_MS;
    const transition = state.lightingTransition;
    if (!transition) continue;
    const next = advanceLightingAmbientTransition(transition, LIGHTING_FIXED_STEP_MS);
    setSessionLighting(state.session, { ambient: next.ambient, color: next.color });
    if (next.done) {
      setSessionLighting(state.session, { ambient: transition.toAmbient, color: transition.toColor });
      state.lightingTransition = null;
    }
  }
}

function advanceCamera(state: RunnerState, deltaMs: number): void {
  const tween = state.camera.tween;
  if (!tween) {
    syncFollowCamera(state);
    return;
  }
  tween.elapsedMs = Math.min(tween.durationMs, tween.elapsedMs + deltaMs);
  const progress = tween.durationMs === 0 ? 1 : tween.elapsedMs / tween.durationMs;
  state.camera.cx = tween.fromX + (tween.toX - tween.fromX) * progress;
  state.camera.cy = tween.fromY + (tween.toY - tween.fromY) * progress;
  if (tween.elapsedMs >= tween.durationMs) {
    state.camera.cx = tween.toX;
    state.camera.cy = tween.toY;
    state.session.camera = tween.finalState;
    state.camera.followTarget = tween.finalState.mode === "follow" ? tween.finalState.target : null;
    state.camera.tween = null;
    syncFollowCamera(state);
  }
}

function syncFollowCamera(state: RunnerState): void {
  if (!state.camera.followTarget || state.camera.tween) return;
  const target = resolveCameraTarget(state, state.camera.followTarget, state.session.camera?.offsetX, state.session.camera?.offsetY);
  state.camera.cx = target.x;
  state.camera.cy = target.y;
}

function resolveCameraTarget(
  state: RunnerState,
  target: RuntimeCameraTarget,
  offsetX = 0,
  offsetY = 0
): { readonly x: number; readonly y: number } {
  if (target.kind === "player") return { x: characterSpriteX(state.session.x) + offsetX, y: characterSpriteY(state.session.y) + offsetY };
  if (target.kind === "position") return { x: characterSpriteX(target.x) + offsetX, y: characterSpriteY(target.y) + offsetY };
  const map = currentMap(state);
  if (map) {
    const event = runtimeEventViewsForMap(state.project, map, state.session, state.eventPositions).find((view) => view.event.id === target.eventId);
    // 프로덕션 카메라(playSceneCamera)와 같은 식이어야 한다 — 이벤트는 **몸 중앙**을 본다.
    if (event) return { x: footprintSpriteX(event.x, event.footprint) + offsetX, y: characterSpriteY(event.y) + offsetY };
  }
  return { x: characterSpriteX(state.session.x) + offsetX, y: characterSpriteY(state.session.y) + offsetY };
}

function cameraSessionState(
  mode: RuntimeCameraSessionState["mode"],
  target: RuntimeCameraTarget,
  offsetX: number | undefined,
  offsetY: number | undefined,
  zoom: number | undefined
): RuntimeCameraSessionState {
  return { mode, target, offsetX, offsetY, zoom };
}

function runExpectStep(state: RunnerState, step: SceneExpectStep): string | null {
  if (step.lastTransfer && (!state.lastTransfer || step.lastTransfer.fromMapId !== state.lastTransfer.fromMapId
    || step.lastTransfer.eventId !== state.lastTransfer.eventId || step.lastTransfer.toMapId !== state.lastTransfer.toMapId)) {
    return `Transfer: expected ${JSON.stringify(step.lastTransfer)}, actual ${JSON.stringify(state.lastTransfer ?? null)}`;
  }
  if (step.interactionComplete !== undefined && (state.held === null) !== step.interactionComplete) {
    return "Interaction completion does not match expectation.";
  }
  if (step.goldDelta !== undefined) {
    const delta = state.session.gold - state.rewardBaseline.gold;
    const matches = typeof step.goldDelta === "number" ? delta === step.goldDelta : delta >= step.goldDelta.atLeast;
    state.log.push(`reward delta gold: baseline=${state.rewardBaseline.gold}, current=${state.session.gold}, delta=${delta}`);
    if (!matches) return `gold: expected delta ${JSON.stringify(step.goldDelta)}, actual ${delta}`;
  }
  for (const [kind, expected, current, baseline] of [
    ["inventory", step.inventoryDelta, state.session.inventory, state.rewardBaseline.inventory],
    ["ownedMonsters", step.ownedMonsterDelta, ownedMonsterCounts(state.session), state.rewardBaseline.monsters],
  ] as const) {
    for (const [id, count] of Object.entries(expected ?? {})) {
      const delta = (current[id] ?? 0) - (baseline[id] ?? 0);
      const matches = typeof count === "number" ? delta === count : delta >= count.atLeast;
      state.log.push(`reward delta ${kind} ${id}: baseline=${baseline[id] ?? 0}, current=${current[id] ?? 0}, delta=${delta}`);
      if (!matches) return `${kind} ${id}: expected delta ${JSON.stringify(count)}, actual ${delta}`;
    }
  }
  if (step.mapId !== undefined && state.session.currentMapId !== step.mapId) {
    return `현재 맵: 기대 ${step.mapId}, 실제 ${state.session.currentMapId}`;
  }
  if (step.playerAt && (state.session.x !== step.playerAt.x || state.session.y !== step.playerAt.y || (step.playerAt.mapId && state.session.currentMapId !== step.playerAt.mapId))) {
    return `플레이어 위치: 기대 ${step.playerAt.mapId ?? state.session.currentMapId} (${step.playerAt.x},${step.playerAt.y}), 실제 ${state.session.currentMapId} (${state.session.x},${state.session.y})`;
  }
  for (const switchId of toStringList(step.switchOn)) {
    if (!getSwitch(state.session, switchId)) return `스위치 ${switchId}: 기대 ON, 실제 OFF`;
  }
  for (const switchId of toStringList(step.switchOff)) {
    if (getSwitch(state.session, switchId)) return `스위치 ${switchId}: 기대 OFF, 실제 ON`;
  }
  const variableFailure = expectVariables(state, step.variableEquals);
  if (variableFailure) return variableFailure;
  const variableAtLeastFailure = expectVariablesAtLeast(state, step.variableAtLeast);
  if (variableAtLeastFailure) return variableAtLeastFailure;
  if (step.eventAt) {
    const eventFailure = expectEventAt(state, step.eventAt);
    if (eventFailure) return eventFailure;
  }
  if (step.eventOnMap) {
    const eventMapFailure = expectEventOnMap(state, step.eventOnMap);
    if (eventMapFailure) return eventMapFailure;
  }
  if (step.eventDistanceToPlayerLessThan) {
    const distanceFailure = expectEventDistance(state, step.eventDistanceToPlayerLessThan);
    if (distanceFailure) return distanceFailure;
  }
  if (step.followerCount !== undefined && (state.session.followers?.length ?? 0) !== step.followerCount) {
    return `동료 수: 기대 ${step.followerCount}, 실제 ${state.session.followers?.length ?? 0}`;
  }
  for (const actorId of typeof step.partyIncludes === "string" ? [step.partyIncludes] : step.partyIncludes ?? []) {
    if (!state.session.partyActorIds.includes(actorId)) {
      return `전투 파티에 ${actorId} 없음: 실제 파티 [${state.session.partyActorIds.join(", ")}] — 동료 추종(addFollower)은 파티 합류가 아니다. changeParty {actorId,action:"add"} 가 실행돼야 한다`;
    }
  }
  for (const actorId of typeof step.partyExcludes === "string" ? [step.partyExcludes] : step.partyExcludes ?? []) {
    if (state.session.partyActorIds.includes(actorId)) return `전투 파티에 ${actorId} 가 남아 있음: 실제 파티 [${state.session.partyActorIds.join(", ")}]`;
  }
  if (step.followerAt) {
    const actual = followerPositions(state.session, state.project.system.companions, followerWorld(state)).find((entry) => entry.follower.name === step.followerAt?.name);
    if (!actual) return `동료 없음: ${step.followerAt.name}`;
    if (actual.x !== step.followerAt.x || actual.y !== step.followerAt.y) {
      return `동료 ${step.followerAt.name}: 기대 (${step.followerAt.x},${step.followerAt.y}), 실제 (${actual.x},${actual.y})`;
    }
  }
  if (step.cameraAt) {
    const tolerance = step.cameraAt.tolerance ?? 0;
    if (Math.abs(state.camera.cx - step.cameraAt.cx) > tolerance || Math.abs(state.camera.cy - step.cameraAt.cy) > tolerance) {
      return `카메라 위치: 기대 (${step.cameraAt.cx},${step.cameraAt.cy})±${tolerance}, 실제 (${state.camera.cx},${state.camera.cy})`;
    }
  }
  if (step.lightingAmbient !== undefined) {
    const ambientFailure = expectLightingAmbient(state, step.lightingAmbient);
    if (ambientFailure) return ambientFailure;
  }
  if (step.lightAt) {
    const lightFailure = expectLightAt(state, step.lightAt);
    if (lightFailure) return lightFailure;
  }
  if (step.lightCount !== undefined) {
    const count = normalizeLightingState(state.session.lighting).sources.length;
    if (count !== step.lightCount) return `광원 수: 기대 ${step.lightCount}, 실제 ${count}`;
  }
  if (step.weatherKind !== undefined) {
    const actual = parseWeather(state.session.m2Runtime?.screen.weather).kind;
    if (actual !== step.weatherKind) return `날씨: 기대 ${step.weatherKind}, 실제 ${actual}`;
  }
  if (step.animationPlaying !== undefined) {
    const actual = state.activeAnimations.length > 0;
    if (actual !== step.animationPlaying) return `애니메이션 재생: 기대 ${step.animationPlaying}, 실제 ${actual}`;
  }
  if (step.fieldSpawnCount !== undefined && fieldSpawnAliveCount(state.fieldSpawnState) !== step.fieldSpawnCount) {
    return `필드 스폰 수: 기대 ${step.fieldSpawnCount}, 실제 ${fieldSpawnAliveCount(state.fieldSpawnState)}`;
  }
  if (step.spawnedCount !== undefined && spawnedCount(state.session) !== step.spawnedCount) {
    return `스폰 이벤트 수: 기대 ${step.spawnedCount}, 실제 ${spawnedCount(state.session)}`;
  }
  if (step.pictureVisible !== undefined) {
    const picture = typeof step.pictureVisible === "string" ? { id: step.pictureVisible } : step.pictureVisible;
    const actual = state.session.pictures[picture.id];
    if (!actual) return `픽처 ${picture.id}: 기대 visible, 실제 hidden`;
    if (picture.resourceId && actual.resourceId !== picture.resourceId) return `픽처 ${picture.id} 리소스: 기대 ${picture.resourceId}, 실제 ${actual.resourceId}`;
  }
  if (step.bgmPlaying !== undefined && state.session.audio.bgm?.resourceId !== step.bgmPlaying) {
    return `BGM: 기대 ${step.bgmPlaying}, 실제 ${state.session.audio.bgm?.resourceId ?? "(none)"}`;
  }
  if (step.messageShown !== undefined && (state.messages.length > 0) !== step.messageShown) {
    return `메시지 피드백: 기대 ${step.messageShown ? "출력" : "미출력"}, 실제 ${state.messages.length > 0 ? "출력" : "미출력"}`;
  }
  if (step.gameOver !== undefined && state.gameOver !== step.gameOver) {
    return `게임 오버: 기대 ${step.gameOver}, 실제 ${state.gameOver}`;
  }
  if (step.endingReached !== undefined && state.session.flags[`ending:${step.endingReached}`] !== true) {
    return `엔딩 도달: 기대 ${step.endingReached}, 실제 ${endingFlags(state.session).join(", ") || "(none)"}`;
  }
  if (step.cutsceneLocked !== undefined && isCutsceneInputLocked(state.session) !== step.cutsceneLocked) {
    return `컷신 잠금: 기대 ${step.cutsceneLocked}, 실제 ${isCutsceneInputLocked(state.session)}`;
  }
  if (step.gameTimeAt) {
    const timeFailure = expectGameTimeAt(state, step.gameTimeAt);
    if (timeFailure) return timeFailure;
  }
  if (step.timePhase !== undefined) {
    const actual = timePhaseFor(state.session.gameTime);
    if (actual !== step.timePhase) return `시간대: 기대 ${step.timePhase}, 실제 ${actual ?? "(none)"}`;
  }
  if (step.cropStageAt) {
    const cropFailure = expectCropStageAt(state, step.cropStageAt);
    if (cropFailure) return cropFailure;
  }
  if (step.inventoryCount) {
    const inventoryFailure = expectInventoryCount(state, step.inventoryCount);
    if (inventoryFailure) return inventoryFailure;
  }
  if (step.friendshipAtLeast) {
    const friendshipFailure = expectFriendshipAtLeast(state, step.friendshipAtLeast);
    if (friendshipFailure) return friendshipFailure;
  }
  if (step.shopStock) {
    const shopFailure = expectShopStock(state, step.shopStock);
    if (shopFailure) return shopFailure;
  }
  return null;
}

function expectCropStageAt(
  state: RunnerState,
  expected: { readonly x: number; readonly y: number; readonly stage: number; readonly mapId?: string }
): string | null {
  const mapId = expected.mapId ?? state.session.currentMapId;
  const actual = cropStageAt(state.session, mapId, expected.x, expected.y);
  return actual === expected.stage ? null : `작물 단계 ${mapId} (${expected.x},${expected.y}): 기대 ${expected.stage}, 실제 ${actual ?? "(none)"}`;
}

function expectInventoryCount(
  state: RunnerState,
  expected: NonNullable<SceneExpectStep["inventoryCount"]>
): string | null {
  if ("itemId" in expected && typeof expected.itemId === "string") {
    const actual = state.session.inventory[expected.itemId] ?? 0;
    return actual === expected.count ? null : `인벤토리 ${expected.itemId}: 기대 ${expected.count}, 실제 ${actual}`;
  }
  for (const [itemId, count] of Object.entries(expected)) {
    const actual = state.session.inventory[itemId] ?? 0;
    if (actual !== count) return `인벤토리 ${itemId}: 기대 ${count}, 실제 ${actual}`;
  }
  return null;
}

function expectFriendshipAtLeast(
  state: RunnerState,
  expected: NonNullable<SceneExpectStep["friendshipAtLeast"]>
): string | null {
  const single = expected as { readonly npcKey?: unknown; readonly value?: unknown };
  if (typeof single.npcKey === "string" && typeof single.value === "number") {
    const actual = getFriendship(state.session, single.npcKey);
    return actual >= single.value ? null : `호감도 ${single.npcKey}: 기대 >= ${single.value}, 실제 ${actual}`;
  }
  for (const [npcKey, value] of Object.entries(expected)) {
    if (typeof value !== "number") continue;
    const actual = getFriendship(state.session, npcKey);
    if (actual < value) return `호감도 ${npcKey}: 기대 >= ${value}, 실제 ${actual}`;
  }
  return null;
}

function expectShopStock(
  state: RunnerState,
  expected: NonNullable<SceneExpectStep["shopStock"]>
): string | null {
  const mapId = expected.mapId ?? state.session.currentMapId;
  const map = state.runtimeMaps[mapId];
  if (!map) return `상점 재고 확인 맵 없음: ${mapId}`;
  const view = runtimeEventViewsForMap(state.project, map, state.session, state.eventPositions).find((entry) => entry.event.id === expected.eventId);
  if (!view) return `상점 이벤트 없음: ${expected.eventId} (맵 ${mapId})`;
  const commands = view.page?.commands ?? resolveEventPage(view.event, state.session)?.commands ?? view.event.commands;
  const shop = findShopCommand(commands);
  if (!shop) return `상점 커맨드 없음: ${expected.eventId}`;
  const stock = resolveShopStock(state.project, state.session, shop);
  const actualIds = stock.map((entry) => entry.itemId);
  if (actualIds.join(",") !== expected.itemIds.join(",")) {
    return `상점 재고 ${expected.eventId}: 기대 ${expected.itemIds.join(",")}, 실제 ${actualIds.join(",")}`;
  }
  for (const [itemId, price] of Object.entries(expected.prices ?? {})) {
    const actual = stock.find((entry) => entry.itemId === itemId)?.price;
    if (actual !== price) return `상점 가격 ${itemId}: 기대 ${price}, 실제 ${actual ?? "(기본)"}`;
  }
  return null;
}

function findShopCommand(commands: readonly Command[]): Extract<Command, { kind: "shop" }> | undefined {
  for (const command of commands) {
    if (command.kind === "shop") return command;
    if (command.kind === "choices") {
      for (const option of command.options) {
        const found = findShopCommand(option.branch);
        if (found) return found;
      }
      const cancelFound = findShopCommand(command.cancelBranch ?? []);
      if (cancelFound) return cancelFound;
    } else if (command.kind === "fork") {
      const found = findShopCommand(command.then) ?? findShopCommand(command.else ?? []);
      if (found) return found;
    } else if (command.kind === "loop") {
      const found = findShopCommand(command.body);
      if (found) return found;
    } else if (command.kind === "promoteActor") {
      const found = findShopCommand(command.successBranch ?? []) ?? findShopCommand(command.failureBranch ?? []);
      if (found) return found;
    } else if (command.kind === "evolveMonster") {
      const found = findShopCommand(command.successBranch ?? []) ?? findShopCommand(command.failureBranch ?? []);
      if (found) return found;
    }
  }
  return undefined;
}

function formatShopItems(items: readonly { readonly itemId: string; readonly price?: number }[]): string {
  return items.map((entry) => entry.price === undefined ? entry.itemId : `${entry.itemId}=${entry.price}`).join(",");
}

function expectGameTimeAt(state: RunnerState, expected: Partial<GameTime>): string | null {
  const actual = state.session.gameTime;
  if (!actual) return "게임 시간이 없습니다.";
  for (const key of ["hour", "minute", "day", "season", "year"] as const) {
    const target = expected[key];
    if (target === undefined) continue;
    if (actual[key] !== target) return `게임 시간 ${key}: 기대 ${target}, 실제 ${actual[key]}`;
  }
  return null;
}

function expectLightingAmbient(
  state: RunnerState,
  expected: NonNullable<SceneExpectStep["lightingAmbient"]>
): string | null {
  const target = typeof expected === "number" ? expected : expected.value;
  const tolerance = typeof expected === "number" ? 0.001 : expected.tolerance ?? 0.001;
  const actual = normalizeLightingState(state.session.lighting).ambient;
  if (Math.abs(actual - target) > tolerance) {
    return `조명 ambient: 기대 ${target}±${tolerance}, 실제 ${actual}`;
  }
  return null;
}

function expectLightAt(
  state: RunnerState,
  expected: NonNullable<SceneExpectStep["lightAt"]>
): string | null {
  const lit = lightAtTile(
    state.session.lighting,
    expected.x,
    expected.y,
    (anchor, _source) => resolveLightAnchorForRunner(state, anchor),
    state.lightingClockMs
  );
  const target = expected.expected ?? true;
  if (lit !== target) {
    return `조명 좌표 (${expected.x},${expected.y}): 기대 ${target ? "lit" : "dark"}, 실제 ${lit ? "lit" : "dark"}`;
  }
  return null;
}

function resolveLightAnchorForRunner(
  state: RunnerState,
  anchor: LightSourceAnchor
): LightTilePosition | undefined {
  if (anchor === "player") return { x: state.session.x, y: state.session.y };
  if ("eventId" in anchor) {
    const follower = followerPositions(state.session, state.project.system.companions, followerWorld(state)).find((entry) =>
      entry.follower.eventId === anchor.eventId || entry.follower.name === anchor.eventId
    );
    if (follower) return { x: follower.x, y: follower.y };
    const map = currentMap(state);
    const view = map
      ? runtimeEventViewsForMap(state.project, map, state.session, state.eventPositions)
          .find((entry) => entry.event.id === anchor.eventId)
      : undefined;
    return view ? { x: view.x, y: view.y } : undefined;
  }
  return { x: anchor.x, y: anchor.y };
}

function expectVariables(
  state: RunnerState,
  expected: SceneExpectStep["variableEquals"]
): string | null {
  if (!expected) return null;
  if ("variableId" in expected && typeof expected.variableId === "string") {
    const got = getVariable(state.session, expected.variableId);
    return got === expected.value ? null : `변수 ${expected.variableId}: 기대 ${expected.value}, 실제 ${got}`;
  }
  for (const [variableId, value] of Object.entries(expected as Record<string, number>)) {
    const got = getVariable(state.session, variableId);
    if (got !== value) return `변수 ${variableId}: 기대 ${value}, 실제 ${got}`;
  }
  return null;
}

function expectVariablesAtLeast(
  state: RunnerState,
  expected: SceneExpectStep["variableAtLeast"]
): string | null {
  if (!expected) return null;
  if ("variableId" in expected && typeof expected.variableId === "string") {
    const got = getVariable(state.session, expected.variableId);
    return got >= expected.value ? null : `변수 ${expected.variableId}: 기대 >= ${expected.value}, 실제 ${got}`;
  }
  for (const [variableId, value] of Object.entries(expected as Record<string, number>)) {
    const got = getVariable(state.session, variableId);
    if (got < value) return `변수 ${variableId}: 기대 >= ${value}, 실제 ${got}`;
  }
  return null;
}

function expectEventAt(
  state: RunnerState,
  expected: { readonly eventId: string; readonly x: number; readonly y: number; readonly mapId?: string }
): string | null {
  const mapId = expected.mapId ?? state.session.currentMapId;
  const map = state.runtimeMaps[mapId];
  if (!map) return `이벤트 위치 확인 맵 없음: ${mapId}`;
  const event = runtimeEventViewsForMap(state.project, map, state.session, state.eventPositions).find((view) => view.event.id === expected.eventId);
  if (!event) return `이벤트 없음: ${expected.eventId} (맵 ${mapId})`;
  if (event.x !== expected.x || event.y !== expected.y) {
    return `이벤트 ${expected.eventId}: 기대 (${expected.x},${expected.y}), 실제 (${event.x},${event.y})`;
  }
  return null;
}

function expectEventOnMap(
  state: RunnerState,
  expected: { readonly eventId: string; readonly mapId: string }
): string | null {
  const map = state.runtimeMaps[expected.mapId];
  if (!map) return `이벤트 맵 확인 맵 없음: ${expected.mapId}`;
  const event = runtimeEventViewsForMap(state.project, map, state.session, state.eventPositions).find((view) => view.event.id === expected.eventId);
  return event ? null : `이벤트 ${expected.eventId}: 기대 맵 ${expected.mapId}에 있음`;
}

function expectEventDistance(
  state: RunnerState,
  expected: { readonly eventId: string; readonly distance: number; readonly mapId?: string }
): string | null {
  const mapId = expected.mapId ?? state.session.currentMapId;
  const map = state.runtimeMaps[mapId];
  if (!map) return `이벤트 거리 확인 맵 없음: ${mapId}`;
  const event = runtimeEventViewsForMap(state.project, map, state.session, state.eventPositions).find((view) => view.event.id === expected.eventId);
  if (!event) return `이벤트 없음: ${expected.eventId} (맵 ${mapId})`;
  // 거리는 앵커끼리가 아니라 **몸 사각까지**로 잰다. 3x3 NPC 의 앵커는 발밑 가운데라, 몸이
  // 플레이어에 닿아 있어도 앵커 맨해튼 거리는 2 로 나온다 — "가까이 왔다" 를 검증하는 시나리오가
  // 실제로 붙어 있는데도 실패한다. 1x1 이면 최근접 칸이 앵커 자신이라 값이 같다.
  const near = nearestCellInRect(event.bodyRect, state.session.x, state.session.y);
  const distance = Math.abs(near.x - state.session.x) + Math.abs(near.y - state.session.y);
  if (distance >= expected.distance) {
    return `이벤트 ${expected.eventId} 거리: 기대 < ${expected.distance}, 실제 ${distance}`;
  }
  return null;
}

function toStringList(value: string | readonly string[] | undefined): readonly string[] {
  if (value === undefined) return [];
  return typeof value === "string" ? [value] : value;
}

function currentMap(state: RunnerState): GameMap | undefined {
  return state.runtimeMaps[state.session.currentMapId];
}

function followerWorld(state: RunnerState): FollowerWorld | undefined {
  const map = currentMap(state);
  return map ? { project: state.project, map } : undefined;
}

function directionDelta(dir: Dir): { readonly x: number; readonly y: number } {
  switch (dir) {
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
  }
}

function emptyEventPositions(project: Project): RuntimeEventPositions {
  return Object.assign({}, ...Object.values(project.maps).map((map) => initialRuntimeEventPositions(map.events))) as RuntimeEventPositions;
}

function emptyEventPositionsFromMaps(maps: Record<string, GameMap>): RuntimeEventPositions {
  return Object.assign({}, ...Object.values(maps).map((map) => initialRuntimeEventPositions(map.events))) as RuntimeEventPositions;
}

function resetRuntimeMapForRunner(state: RunnerState, mapId: string): void {
  const source = state.project.maps[mapId];
  if (!source) return;
  state.runtimeMaps[mapId] = structuredClone(source);
  state.encounterAccumulator = 0;
  for (const key of Object.keys(state.eventPositions)) {
    if (key.startsWith("__field_spawn__")) delete state.eventPositions[key];
  }
  Object.assign(state.eventPositions, initialRuntimeEventPositions(state.runtimeMaps[mapId].events));
  initializeFieldSpawnsForRunner(state);
}

function initializeFieldSpawnsForRunner(state: RunnerState): void {
  const map = currentMap(state);
  if (!map) {
    state.fieldSpawnState = null;
    return;
  }
  enterRoguelikeRunRoom(state.session, roguelikeRoomId(map));
  if (syncRoguelikeRoomEventGeneration(map, state.session)) {
    syncFieldSpawnEventsIntoMap(map, null, state.eventPositions);
    Object.assign(state.eventPositions, initialRuntimeEventPositions(map.events));
    state.autoStartedKeys.clear();
  }
  state.fieldSpawnState = createFieldSpawnRuntime(
    state.project,
    map,
    { x: state.session.x, y: state.session.y },
    state.session.killedFieldSpawns?.[map.id],
    state.session.roguelikeRun
  );
  syncFieldSpawnEventsIntoMap(map, state.fieldSpawnState, state.eventPositions);
}

function refreshRoguelikeRoomForRunner(state: RunnerState): boolean {
  const map = currentMap(state);
  if (!map || !fieldSpawnRuntimeNeedsRefresh(state.fieldSpawnState, map, state.session.roguelikeRun)) return false;
  initializeFieldSpawnsForRunner(state);
  refreshChasers(state);
  return true;
}

function advanceFieldSpawnsForRunner(state: RunnerState, deltaMs: number): void {
  if (state.gameOver || state.runtimeFailure) return;
  const map = currentMap(state);
  if (!map) return;
  if (refreshRoguelikeRoomForRunner(state)) return;
  const changed = advanceFieldSpawns(state.fieldSpawnState, state.project, map, { x: state.session.x, y: state.session.y }, deltaMs);
  if (!changed) return;
  syncFieldSpawnEventsIntoMap(map, state.fieldSpawnState, state.eventPositions);
  refreshChasers(state);
}

function runFieldSpawnBattleForRunner(state: RunnerState, eventId: string): string | null {
  const troopId = fieldSpawnTroopId(state.fieldSpawnState, eventId);
  if (!troopId) return `필드 스폰 전투 대상 없음: ${eventId}`;
  const result = runHeadlessBattle(state, { kind: "battleProcessing", troopId, canEscape: true, canLose: true });
  state.session.battleResult = result;
  state.log.push(`field spawn ${eventId}: ${result}`);
  if (result === "victory") {
    const spawn = resolveFieldSpawnVictory(state.fieldSpawnState, eventId);
    if (spawn?.persistKill && state.session.roguelikeRun?.status !== "active") {
      state.session.killedFieldSpawns ??= {};
      const mapKills = (state.session.killedFieldSpawns[state.session.currentMapId] ??= {});
      mapKills[spawn.id] = (mapKills[spawn.id] ?? 0) + 1;
    }
    if (spawn?.onKillSwitchId) state.session.switches[spawn.onKillSwitchId] = true;
    const map = currentMap(state);
    if (map) syncFieldSpawnEventsIntoMap(map, state.fieldSpawnState, state.eventPositions);
    refreshChasers(state);
  } else if (result === "defeat") {
    killPartyForRunner(state);
    state.gameOver = true;
  }
  return null;
}

function maybeTriggerRandomEncounterForRunner(state: RunnerState): string | null {
  const map = currentMap(state);
  if (!map || state.gameOver || state.runtimeFailure) return null;
  const rate = map.encounterRate ?? 0;
  if (rate <= 0) return null;
  const position = { x: state.session.x, y: state.session.y };
  const hasCandidates = map.encounterTable && map.encounterTable.length > 0
    ? eligibleEncounterEntries(map, state.session, position).length > 0
    : (map.troopIds?.length ?? 0) > 0;
  if (!hasCandidates) return null;
  // 실제 플레이(playSceneMovement)와 같이: 몬스터 파티 전투인데 파트너가 없으면 야생이 나오지 않는다.
  const monsterBattle = monsterBattlePartyOf(state.project, state.session);
  if (monsterBattle.requested && monsterBattle.party.length === 0) return null;
  state.encounterAccumulator += rate;
  if (state.encounterAccumulator < 1000 && nextSessionRandom(state.session, "encounter") * 1000 >= state.encounterAccumulator) return null;
  state.encounterAccumulator = 0;
  const troopId = pickEncounterTroopForMap(map, state.session, position);
  if (!troopId) return null;
  if (state.recoverBeforeRandomEncounters) recoverAll(state.session, undefined, state.project);
  const outcome = runHeadlessBattle(state, { kind: "battleProcessing", troopId, canEscape: true, canLose: false });
  state.session.battleResult = outcome;
  state.log.push(`random encounter ${troopId}: ${outcome}`);
  if (outcome === "defeat") {
    killPartyForRunner(state);
    state.gameOver = true;
  }
  return null;
}

function runHeadlessBattle(
  state: RunnerState,
  step: Extract<StepResult, { kind: "battleProcessing" }>
): BattleResult {
  if (state.rewardProof) unverified("Unsupported battle");
  // 몬스터 수집 게임은 파티 몬스터가 싸운다(playSceneBattle 과 같은 입력). 빠뜨리면 헤드리스 전투가 Lv1 영웅으로
  // 치러져 거짓 게임 오버가 나고, run_scene_test 로 관장전을 검증할 수 없었다.
  const monsterBattle = monsterBattlePartyOf(state.project, state.session);
  const partyMonsters = monsterBattle.party.length > 0 ? monsterBattle.party : undefined;
  const runtime = createBattleRuntime({
    project: state.project,
    troopId: step.troopId,
    canEscape: step.canEscape,
    canLose: step.canLose,
    battleFlow: step.battleFlow,
    // 프로덕션(playSceneBattle)과 동일 계약: battleProcessing 스텝의 소유 이벤트를 그대로 전달.
    // 인카운터/필드 스폰 경로가 만드는 스텝에는 없으므로 자연히 undefined.
    ownerEventId: step.ownerEventId,
    party: {
      levels: state.session.actorLevels,
      experience: state.session.actorExperience,
      names: state.session.actorNames,
      vitals: state.session.actorVitals,
      paramBonuses: state.session.actorParamBonuses,
      equipment: state.session.actorEquipment,
      skillIds: state.session.actorSkillIds,
      classOverrides: state.session.classOverrides,
      stateIds: state.session.actorStateIds,
      partyActorIds: state.session.partyActorIds,
      ...(partyMonsters ? { monsterParty: partyMonsters } : {}),
    },
    ...(partyMonsters ? { partyMonsters } : {}),
    sessionState: {
      switches: state.session.switches,
      variables: state.session.variables,
      inventory: state.session.inventory,
      selfSwitches: state.session.selfSwitches,
      battleResult: state.session.battleResult,
      gameTime: state.session.gameTime,
      friendship: state.session.friendship,
    },
    rng: () => nextSessionRandom(state.session, "battle"),
  });
  for (let guard = 0; guard < 8000; guard += 1) {
    const snapshot = headlessBattleSnapshot(runtime);
    if (snapshot.result) break;
    if (snapshot.phase === "actorCommand") {
      const enemy = snapshot.enemies.find((entry) => !entry.defeated && entry.hp > 0);
      if (enemy) actHeadless(state.project, runtime, snapshot, enemy.id);
      else runtime.tick(1000);
    } else {
      runtime.tick(1000);
    }
  }
  const final = headlessBattleSnapshot(runtime);
  const result = final.result ?? "defeat";
  applyBattleRewardsToSession(state.session, {
    result,
    canLose: step.canLose,
    rewards: final.rewards,
    actors: [...final.actors, ...final.reserveActors],
    eventState: final.eventState,
    participatingActorIds: final.participatingActorIds,
    ...(partyMonsters ? { monsterPartyMode: true } : {}),
  }, state.project);
  return result;
}

/**
 * 헤드리스 전투의 한 수. 기본은 「공격」이지만 gen1(포켓몬식)은 기술이 남은 몬스터의 공격을 받지 않는다 —
 * 그러면 아무 수도 두지 못해 매 전투를 졌다(2026-09-24 몬스터 수집 도그푸딩: 스타터가 Lv3 야생에 패배).
 * 적을 때리는 기술을 위력 순으로 시도하고, 받아들여지지 않으면 다음 수로 간다.
 */
function actHeadless(project: Project, runtime: ReturnType<typeof createBattleRuntime>, snapshot: ReturnType<typeof headlessBattleSnapshot>, targetEnemyId: string): void {
  // activeActorId 는 기록 id 다(몬스터 배틀러는 id 가 "mon:<개체>" 라 recordId·monsterInstanceId 로 찾는다).
  const active = snapshot.actors.find((actor) => actor.id === snapshot.activeActorId || actor.recordId === snapshot.activeActorId
    || actor.monsterInstanceId === snapshot.activeActorId);
  const skills = new Map(project.database.skills.map((skill) => [skill.id, skill]));
  const damaging = (active?.skillIds ?? [])
    .map((skillId) => skills.get(skillId))
    .filter((skill): skill is NonNullable<typeof skill> => !!skill && (skill.scope === "enemy" || skill.scope === "allEnemies") && (skill.power ?? 0) > 0)
    .sort((a, b) => (b.power ?? 0) - (a.power ?? 0));
  const attempts: ActorCommand[] = project.system.battleModel === "gen1"
    ? [...damaging.map((skill) => ({ kind: "skill" as const, skillId: skill.id, targetEnemyId })), { kind: "attack", targetEnemyId }]
    : [{ kind: "attack", targetEnemyId }];
  for (const command of attempts) {
    runtime.performActorCommand(command);
    const after = headlessBattleSnapshot(runtime);
    if (after.phase !== "actorCommand" || after.activeActorId !== snapshot.activeActorId || after.result) return;
  }
  // 어떤 수도 안 받아 주면 방어로 턴을 넘긴다(무한 대기 방지).
  runtime.performActorCommand({ kind: "defend" });
}

function killPartyForRunner(state: RunnerState): void {
  for (const actorId of state.session.partyActorIds) {
    syncActorVitals(state.project, state.session.actorVitals, actorId);
    const vitals = state.session.actorVitals[actorId];
    if (vitals) vitals.hp = 0;
    state.session.actorStateIds ??= {};
    const states = new Set(state.session.actorStateIds[actorId] ?? []);
    states.add("state_death");
    state.session.actorStateIds[actorId] = [...states];
  }
}

function emptyCamera(session: PlaySession): CameraModel {
  return {
    cx: characterSpriteX(session.x),
    cy: characterSpriteY(session.y),
    followTarget: { kind: "player" },
    tween: null,
  };
}

function spawnedCount(session: PlaySession): number {
  return Object.keys(session.spawnedEvents ?? {}).length;
}

function endingFlags(session: PlaySession): string[] {
  return Object.keys(session.flags)
    .filter((key) => key.startsWith("ending:") && session.flags[key])
    .map((key) => key.slice("ending:".length));
}

function refreshChasers(state: RunnerState): void {
  const map = currentMap(state);
  if (!map) {
    state.chasers.clear();
    return;
  }
  const active = runtimeEventViewsForMap(state.project, map, state.session, state.eventPositions)
    .filter((view) => view.movement.type === "chase");
  const activeIds = new Set(active.map((view) => view.event.id));
  for (const key of [...state.chasers.keys()]) {
    if (!activeIds.has(key)) state.chasers.delete(key);
  }
  for (const view of active) {
    const existing = state.chasers.get(view.event.id);
    // 런타임은 한 칸 걸음(트윈, speed)이 끝난 뒤 간격(frequency)을 기다린다 — 러너가 간격만 쓰면
    // 추격자가 실제보다 3배 빨라 「헤드리스로는 잡히는데 플레이로는 도망친다」 가 됐다(2026-09-24).
    const stepMs = npcMoveDurationMs(view.movement.speed) + npcMoveIntervalMs(view.movement.frequency);
    if (existing) {
      existing.moveIntervalMs = stepMs;
      continue;
    }
    state.chasers.set(view.event.id, {
      timer: 0,
      moveIntervalMs: stepMs,
    });
  }
}

function advanceChasers(state: RunnerState, deltaMs: number): void {
  if (state.gameOver || state.runtimeFailure) return;
  refreshChasers(state);
  const map = currentMap(state);
  if (!map) return;
  for (const [eventId, mover] of state.chasers) {
    const view = runtimeEventViewsForMap(state.project, map, state.session, state.eventPositions)
      .find((entry) => entry.event.id === eventId);
    if (!view) continue;
    // 런타임(playSceneAutonomous updateChaseNpc)과 같은 추적 정책: 시야·수색·복귀, 숨은 주인공은 표적이 아니다.
    const world = { project: state.project, map, session: state.session, positions: state.eventPositions };
    isPlayerHiding(world);
    const tracked = pursuitTarget(world, view, mover as unknown as AutonomousMover, deltaMs);
    if (tracked === null) continue;
    const player = { x: state.session.x, y: state.session.y };
    const target = tracked ?? player;
    let decision = nextChaseDecision({
      project: state.project,
      map,
      from: { x: view.x, y: view.y },
      player: target,
      deltaMs,
      mover,
      sightRange: tracked ? undefined : view.movement.sightRange,
      giveUpRange: tracked ? undefined : view.movement.giveUpRange,
      pathfind: view.movement.pathfind,
    });
    if (tracked?.searching && decision.kind === "touch" && (target.x !== player.x || target.y !== player.y)) {
      decision = { kind: "move", x: target.x, y: target.y, dir: decision.dir };
    }
    if (decision.kind === "touch" && tracked?.searching) continue;
    // 수색 중 목적지가 주인공 칸이면(숨은 옷장 앞) 밟지 않고 선다 — 런타임 isPlayerOccupyingTile 과 같다.
    if (decision.kind === "move" && decision.x === player.x && decision.y === player.y) continue;
    if (decision.kind === "move") {
      const position = { x: decision.x, y: decision.y, direction: decision.dir };
      const location = state.session.eventLocations[eventId];
      if (location?.mapId === map.id) state.session.eventLocations[eventId] = { ...location, ...position };
      state.eventPositions[eventId] = position;
    } else if (decision.kind === "touch" && view.trigger.kind === "eventTouch") {
      state.runtimeFailure = runEventView(state, view);
      if (state.runtimeFailure) return;
    }
  }
}

function result(
  ok: boolean,
  project: Project,
  session: PlaySession,
  eventPositions: RuntimeEventPositions,
  camera: CameraModel,
  log: readonly string[],
  messages: readonly string[],
  steps: readonly SceneStep[],
  stepsRun: number,
  failedStep: SceneStep | undefined,
  failureReason: string | undefined,
  fieldSpawnState: FieldSpawnRuntimeState | null,
  gameOver: boolean,
  animationPlaying: boolean,
  interactions: readonly SceneInteractionReceipt[] = [],
  setupFailure?: SceneSetupFailure,
  failedSelection?: SceneInteractionReceipt,
): SceneTestResult {
  void eventPositions;
  const lighting = normalizeLightingState(session.lighting);
  return {
    ok,
    stepsRun,
    totalSteps: steps.length,
    interactions,
    ...(setupFailure ? { setupFailure } : {}),
    ...(failedSelection ? { failedSelection } : {}),
    failedStepIndex: ok ? undefined : stepsRun,
    failedStep,
    failureReason,
    finalState: {
      ...buildLifeRuntimeSnapshot(session),
      mapId: session.currentMapId,
      x: session.x,
      y: session.y,
      camera: { cx: camera.cx, cy: camera.cy, session: session.camera },
      lightingAmbient: lighting.ambient,
      lightCount: lighting.sources.length,
      weatherKind: parseWeather(session.m2Runtime?.screen.weather).kind,
      animationPlaying,
      fieldSpawnCount: fieldSpawnAliveCount(fieldSpawnState),
      spawnedCount: spawnedCount(session),
      followerCount: session.followers?.length ?? 0,
      partyActorIds: [...session.partyActorIds],
      followers: followerPositions(session, project.system.companions).map((entry) => ({ name: entry.follower.name, x: entry.x, y: entry.y })),
      picturesVisible: Object.keys(session.pictures),
      messages,
      bgm: session.audio.bgm?.resourceId,
      gameOver,
      endingsReached: endingFlags(session),
      cutsceneLocked: isCutsceneInputLocked(session),
      switchesOn: Object.entries(session.switches).filter(([, value]) => value).map(([key]) => key),
      variables: { ...session.variables },
      gold: session.gold,
      inventory: { ...session.inventory },
      ownedMonsterCounts: ownedMonsterCounts(session),
      monsterParty: [...session.monsterParty],
      monsterBox: [...session.monsterBox],
      friendship: { ...(session.friendship ?? {}) },
      playTimeSeconds: session.playTimeSeconds,
      gameTime: session.gameTime,
      timePhase: timePhaseFor(session.gameTime),
    },
    log,
    session,
  };
}
