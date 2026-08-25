import { canMove, isPassable } from "@/project/collision";
import { createBattleRuntime, type BattleResult } from "@/battle/runtime";
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
import type { Command, Dir, GameMap, Project } from "@/project/types";
import { characterSpriteX, characterSpriteY } from "@/player/characterDepth";
import { createInterpreter, type Interpreter, type StepResult } from "@/player/interpreter";
import { restoreSessionCheckpoint } from "@/player/checkpoints";
import { nextChaseDecision, type ChaseRuntimeState } from "@/player/chaseAi";
import { followerPositions, recordFollowerPlayerStep, resetFollowerTrailNearPlayer } from "@/project/followers";
import { npcMoveIntervalMs } from "@/player/playScenePageMoveRoutes";
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
import { enterRoguelikeRunRoom } from "@/project/roguelikeRun";
import { roguelikeRoomId, syncRoguelikeRoomEventGeneration } from "@/project/roguelikeRooms";
import {
  advanceGameTime,
  calendarDayKey,
  initialGameTime,
  minutesUntilDayEnd,
  resolveTimeSystem,
  setGameTimeClock,
  timePhaseFor,
  type GameTime,
  type TimePhase,
} from "@/project/gameTime";
import { npcScheduleTargetForEvent } from "@/project/npcSchedule";
import { cropStageAt, interactWithFarmPlot } from "@/player/farming";
import { giveGiftToNpc } from "@/project/friendship";
import { resolveShopStock } from "@/project/shopStock";
import { applyMapBgmToSession, resolveMapBgm } from "@/player/mapBgm";
import { transitionToNextDay } from "@/player/dayTransition";

const TICK_MS = 16;

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
  | { kind: "interact" }
  | { kind: "gift"; eventId?: string; itemId: string }
  | { kind: "choose"; index: number }
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
  friendshipAtLeast?: { npcKey: string; value: number } | Record<string, number>;
  shopStock?: { eventId: string; itemIds: readonly string[]; prices?: Record<string, number>; mapId?: string };
};

export interface SceneTestInput {
  readonly mapId: string;
  readonly start: { readonly x: number; readonly y: number };
  readonly steps: readonly SceneStep[];
}

export interface SceneTestResult {
  readonly ok: boolean;
  readonly stepsRun: number;
  readonly totalSteps: number;
  readonly failedStepIndex?: number;
  readonly failedStep?: SceneStep;
  readonly failureReason?: string;
  readonly finalState: {
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
    readonly followers: readonly { readonly name: string; readonly x: number; readonly y: number }[];
    readonly picturesVisible: readonly string[];
    readonly messages: readonly string[];
    readonly bgm?: string;
    readonly gameOver: boolean;
    readonly endingsReached: readonly string[];
    readonly cutsceneLocked: boolean;
    readonly switchesOn: readonly string[];
    readonly variables: Record<string, number>;
    readonly inventory: Record<string, number>;
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
  | { stop: "choices" }
  | { stop: "animation" }
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
  readonly chasers: Map<string, ChaseRuntimeState>;
  encounterAccumulator: number;
  facing: Dir;
  /** Runner-observable transcript of message text bodies shown so far. */
  readonly messages: string[];
  gameOver: boolean;
  held: { interp: Interpreter; mode: "choices" | "animation"; currentEventId?: string } | null;
  runtimeFailure: string | null;
}

export function runSceneTest(project: Project, input: SceneTestInput): SceneTestResult {
  const session = startSession(project, 1);
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
    chasers: new Map(),
    encounterAccumulator: 0,
    facing: "down",
    messages: [],
    gameOver: false,
    held: null,
    runtimeFailure: null,
  };
  initializeFieldSpawnsForRunner(state);
  syncFollowCamera(state);
  applyNpcSchedulesForRunner(state);
  refreshChasers(state);
  const autoReason = runAutoTriggers(state);
  if (autoReason !== null) {
    return result(false, project, state.session, state.eventPositions, state.camera, log, state.messages, input.steps, 0, input.steps[0], autoReason, state.fieldSpawnState, state.gameOver, state.activeAnimations.length > 0);
  }

  for (let i = 0; i < input.steps.length; i += 1) {
    const step = input.steps[i];
    let reason: string | null;
    try {
      reason = runStep(state, step);
    } catch (cause) {
      reason = `예외: ${cause instanceof Error ? cause.message : String(cause)}`;
    }
    if (reason !== null) {
      return result(false, project, state.session, state.eventPositions, state.camera, log, state.messages, input.steps, i, step, reason, state.fieldSpawnState, state.gameOver, state.activeAnimations.length > 0);
    }
  }

  return result(true, project, state.session, state.eventPositions, state.camera, log, state.messages, input.steps, input.steps.length, undefined, undefined, state.fieldSpawnState, state.gameOver, state.activeAnimations.length > 0);
}

function runStep(state: RunnerState, step: SceneStep): string | null {
  switch (step.kind) {
    case "wait":
      return advanceTime(state, Math.max(0, Math.trunc(step.ticks)) * TICK_MS);
    case "face":
      state.facing = step.dir;
      return null;
    case "set":
      return runSetStep(state, step);
    case "move":
      return runMoveStep(state, step);
    case "walk":
      return runWalkStep(state, step);
    case "interact":
      return runInteractStep(state);
    case "gift":
      return runGiftStep(state, step);
    case "choose":
      return runChooseStep(state, step.index);
    case "retryCheckpoint":
      return runRetryCheckpointStep(state);
    case "advanceDays":
      return advanceDaysForRunner(state, step.days);
    case "expect":
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
    if (blocking.trigger.kind === "touch" || blocking.trigger.kind === "playerTouch") {
      return runEventView(state, blocking);
    }
    return `이동 대상에 막는 이벤트가 있습니다: ${blocking.event.id} (${x},${y})`;
  }
  const previous = { x: state.session.x, y: state.session.y };
  state.session.x = x;
  state.session.y = y;
  recordFollowerPlayerStep(state.session, { ...previous, direction: state.facing });
  syncFollowCamera(state);
  const touch = findRuntimeEventAtInMap(state.project, map, state.session, state.eventPositions, x, y, ["touch", "playerTouch"]);
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
  const touch = findRuntimeEventAtInMap(state.project, map, state.session, state.eventPositions, x, y, ["touch", "playerTouch"]);
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
        && (blocking.trigger.kind === "touch" || blocking.trigger.kind === "playerTouch");
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
  const front = events.find(
    (view) => view.trigger.kind === "action" && view.x === state.session.x + delta.x && view.y === state.session.y + delta.y
  );
  if (front) return front;
  return events.find((view) => view.trigger.kind === "action" && view.x === state.session.x && view.y === state.session.y);
}

function runInteractStep(state: RunnerState): string | null {
  if (state.gameOver) return "게임 오버 중에는 이벤트를 조사할 수 없습니다.";
  const map = currentMap(state);
  if (!map) return `현재 맵 없음: ${state.session.currentMapId}`;
  const delta = directionDelta(state.facing);
  const front = findRuntimeEventAtInMap(
    state.project,
    map,
    state.session,
    state.eventPositions,
    state.session.x + delta.x,
    state.session.y + delta.y,
    "action"
  );
  if (front) return runEventView(state, front);
  const farmFront = interactWithFarmPlot(state.project, state.session, map, state.session.x + delta.x, state.session.y + delta.y);
  if (farmFront.kind !== "ignored") {
    state.log.push(`farm ${farmFront.kind}: ${map.id} (${farmFront.x},${farmFront.y})${farmFront.cropId ? ` ${farmFront.cropId}` : ""}`);
    return null;
  }
  const underfoot = findRuntimeEventAtInMap(state.project, map, state.session, state.eventPositions, state.session.x, state.session.y, "action");
  if (underfoot) return runEventView(state, underfoot);
  const farmUnderfoot = interactWithFarmPlot(state.project, state.session, map, state.session.x, state.session.y);
  if (farmUnderfoot.kind !== "ignored") {
    state.log.push(`farm ${farmUnderfoot.kind}: ${map.id} (${farmUnderfoot.x},${farmUnderfoot.y})${farmUnderfoot.cropId ? ` ${farmUnderfoot.cropId}` : ""}`);
    return null;
  }
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

function runChooseStep(state: RunnerState, index: number): string | null {
  if (!state.held || state.held.mode !== "choices") return "choose를 처리할 대기 중 선택지가 없습니다.";
  const interp = state.held.interp;
  const stop = pump(state, interp, interp.resume(index));
  refreshRoguelikeRoomForRunner(state);
  updateHeldInterpreter(state, interp, stop, state.held.currentEventId);
  return stop.stop === "failed" ? stop.reason : null;
}

function runEventView(state: RunnerState, view: RuntimeEventView): string | null {
  if (isFieldSpawnEventId(view.event.id)) return runFieldSpawnBattleForRunner(state, view.event.id);
  const commands = view.page?.commands ?? resolveEventPage(view.event, state.session)?.commands ?? view.event.commands;
  if (commands.length === 0) {
    state.held = null;
    state.log.push(`event ${view.event.id}: no commands`);
    return null;
  }
  const interp = createInterpreter([...commands], state.session, state.project, { currentEventId: view.event.id });
  state.log.push(`event ${view.event.id} start`);
  const stop = pump(state, interp, interp.start());
  refreshRoguelikeRoomForRunner(state);
  updateHeldInterpreter(state, interp, stop, view.event.id);
  return stop.stop === "failed" ? stop.reason : null;
}

function updateHeldInterpreter(
  state: RunnerState,
  interp: Interpreter,
  stop: PumpStop,
  currentEventId: string | undefined
): void {
  if (stop.stop === "choices" || stop.stop === "animation") {
    state.held = { interp, mode: stop.stop, currentEventId };
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
      case "choices":
        return { stop: "choices" };
      case "text":
        state.messages.push(step.body);
        step = interp.resume(undefined);
        break;
      case "wait":
        {
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
        setClockForRunner(state, step.hour, step.minute);
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
        state.session.currentMapId = step.mapId;
        state.session.x = step.x;
        state.session.y = step.y;
        {
          resetRuntimeMapForRunner(state, step.mapId);
          const targetMap = currentMap(state);
          if (targetMap) applyMapDefaultLighting(state.session, targetMap);
          if (targetMap) applyMapBgmToSession(state.session.audio, resolveMapBgm(state.project, step.mapId));
        }
        resetFollowerTrailNearPlayer(state.session, state.project.maps[step.mapId]);
        applyNpcSchedulesForRunner(state);
        refreshChasers(state);
        syncFollowCamera(state);
        state.autoStartedKeys.clear();
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
      case "showAnimation":
        startSceneAnimation(state, step.animationId);
        if (step.wait) {
          return { stop: "animation" };
        }
        step = interp.resume(undefined);
        break;
      case "spawnEvent":
      case "removeEvent":
      case "setEventGraphicPattern":
      case "changeTile":
      case "timer":
      case "moveEvent":
      case "waitForAllMovement":
      case "stopAllMovement":
      case "inn":
      case "flashScreen":
      case "shakeScreen":
        step = interp.resume(undefined);
        break;
      case "shop":
        state.log.push(`shop: ${formatShopItems(step.items ?? step.itemIds.map((itemId) => ({ itemId })))}`);
        step = interp.resume(undefined);
        break;
      case "inputWait":
      case "inputNumber":
        step = interp.resume(0);
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
  const days = Math.max(0, Math.trunc(step.days ?? 0));
  for (let index = 0; index < days; index += 1) {
    const failure = sleepUntilMorningForRunner(state);
    if (failure) return failure;
  }
  const minutes = Math.max(0, Math.trunc(step.minutes ?? 0));
  return minutes > 0 ? advanceGameMinutesForRunner(state, minutes) : null;
}

function advanceDaysForRunner(state: RunnerState, days: number): string | null {
  const count = Math.max(0, Math.trunc(days));
  for (let index = 0; index < count; index += 1) {
    const failure = sleepUntilMorningForRunner(state);
    if (failure) return failure;
  }
  return null;
}

function advanceGameMinutesForRunner(state: RunnerState, minutes: number): string | null {
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
      state.session.gameTime = advanceGameTime(currentTime, remaining, system).time;
      applyNpcSchedulesForRunner(state);
      return null;
    }
    if (system.forceSleep) return sleepUntilMorningForRunner(state);
    remaining -= untilEnd;
    const transitionFailure = transitionToNextDayForRunner(state);
    if (transitionFailure) return transitionFailure;
    applyNpcSchedulesForRunner(state);
    if (untilEnd <= 0) remaining = 0;
  }
  return null;
}

function setClockForRunner(state: RunnerState, hour: number, minute: number | undefined): void {
  const system = resolveTimeSystem(state.project);
  if (!system) return;
  state.session.gameTime ??= initialGameTime(system);
  if (!state.session.gameTime) return;
  state.session.gameTime = setGameTimeClock(state.session.gameTime, hour, minute, system);
  applyNpcSchedulesForRunner(state);
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
  state.log.push(`onDayEnd ${hook.id} start`);
  const interp = createInterpreter([...hook.commands], state.session, state.project);
  const stop = pump(state, interp, interp.start());
  if (stop.stop === "failed") return stop.reason;
  if (stop.stop === "choices" || stop.stop === "animation") return `onDayEnd ${hook.id}: 블로킹 단계 ${stop.stop}는 headless에서 처리할 수 없습니다.`;
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
    if (event) return { x: characterSpriteX(event.x) + offsetX, y: characterSpriteY(event.y) + offsetY };
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
    return `동행자 수: 기대 ${step.followerCount}, 실제 ${state.session.followers?.length ?? 0}`;
  }
  if (step.followerAt) {
    const actual = followerPositions(state.session).find((entry) => entry.follower.name === step.followerAt?.name);
    if (!actual) return `동행자 없음: ${step.followerAt.name}`;
    if (actual.x !== step.followerAt.x || actual.y !== step.followerAt.y) {
      return `동행자 ${step.followerAt.name}: 기대 (${step.followerAt.x},${step.followerAt.y}), 실제 (${actual.x},${actual.y})`;
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
    const follower = followerPositions(state.session).find((entry) =>
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
  const distance = Math.abs(event.x - state.session.x) + Math.abs(event.y - state.session.y);
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
  state.encounterAccumulator += rate;
  if (state.encounterAccumulator < 1000 && nextSessionRandom(state.session, "encounter") * 1000 >= state.encounterAccumulator) return null;
  state.encounterAccumulator = 0;
  const troopId = pickEncounterTroopForMap(map, state.session, position);
  if (!troopId) return null;
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
    },
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
    const snapshot = runtime.snapshot();
    if (snapshot.result) break;
    if (snapshot.phase === "actorCommand") {
      const enemy = snapshot.enemies.find((entry) => !entry.defeated && entry.hp > 0);
      if (enemy) runtime.performActorCommand({ kind: "attack", targetEnemyId: enemy.id });
      else runtime.tick(1000);
    } else {
      runtime.tick(1000);
    }
  }
  const final = runtime.snapshot();
  const result = final.result ?? "defeat";
  applyBattleRewardsToSession(state.session, {
    result,
    rewards: final.rewards,
    actors: [...final.actors, ...final.reserveActors],
    eventState: final.eventState,
    participatingActorIds: final.participatingActorIds,
  }, state.project);
  return result;
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
    if (existing) {
      existing.moveIntervalMs = npcMoveIntervalMs(view.movement.frequency);
      continue;
    }
    state.chasers.set(view.event.id, {
      timer: 0,
      moveIntervalMs: npcMoveIntervalMs(view.movement.frequency),
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
    const decision = nextChaseDecision({
      project: state.project,
      map,
      from: { x: view.x, y: view.y },
      player: { x: state.session.x, y: state.session.y },
      deltaMs,
      mover,
      sightRange: view.movement.sightRange,
      giveUpRange: view.movement.giveUpRange,
      pathfind: view.movement.pathfind,
    });
    if (decision.kind === "move") {
      state.eventPositions[eventId] = { x: decision.x, y: decision.y, direction: decision.dir };
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
  animationPlaying: boolean
): SceneTestResult {
  void project;
  void eventPositions;
  const lighting = normalizeLightingState(session.lighting);
  return {
    ok,
    stepsRun,
    totalSteps: steps.length,
    failedStepIndex: ok ? undefined : stepsRun,
    failedStep,
    failureReason,
    finalState: {
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
      followers: followerPositions(session).map((entry) => ({ name: entry.follower.name, x: entry.x, y: entry.y })),
      picturesVisible: Object.keys(session.pictures),
      messages,
      bgm: session.audio.bgm?.resourceId,
      gameOver,
      endingsReached: endingFlags(session),
      cutsceneLocked: isCutsceneInputLocked(session),
      switchesOn: Object.entries(session.switches).filter(([, value]) => value).map(([key]) => key),
      variables: { ...session.variables },
      inventory: { ...session.inventory },
      friendship: { ...(session.friendship ?? {}) },
      playTimeSeconds: session.playTimeSeconds,
      gameTime: session.gameTime,
      timePhase: timePhaseFor(session.gameTime),
    },
    log,
    session,
  };
}
