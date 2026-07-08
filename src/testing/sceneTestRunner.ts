import { canMove } from "@/project/collision";
import { resolveEventPage } from "@/project/io";
import { checkReachability } from "@/project/lint/reachability";
import {
  clearAudioState,
  erasePictureState,
  getSwitch,
  getVariable,
  setAudioState,
  showPictureState,
  startSession,
  type PlaySession,
} from "@/project/session";
import type { Dir, GameMap, Project } from "@/project/types";
import { characterSpriteX, characterSpriteY } from "@/player/characterDepth";
import { createInterpreter, type Interpreter, type StepResult } from "@/player/interpreter";
import type { RuntimeCameraSessionState, RuntimeCameraTarget } from "@/player/types";
import {
  findBlockingRuntimeEventAtInMap,
  findRuntimeEventAtInMap,
  initialRuntimeEventPositions,
  runtimeEventViewsForMap,
  type RuntimeEventPositions,
  type RuntimeEventView,
} from "@/player/runtimeEventState";

const TICK_MS = 16;

export type SceneStep =
  | { kind: "wait"; ticks: number }
  | { kind: "move"; dir: Dir; to?: never }
  | { kind: "move"; dir?: never; to: { x: number; y: number } }
  | { kind: "interact" }
  | { kind: "choose"; index: number }
  | SceneExpectStep;

export type SceneExpectStep = {
  kind: "expect";
  playerAt?: { x: number; y: number; mapId?: string };
  switchOn?: string | readonly string[];
  switchOff?: string | readonly string[];
  variableEquals?: { variableId: string; value: number } | Record<string, number>;
  eventAt?: { eventId: string; x: number; y: number; mapId?: string };
  cameraAt?: { cx: number; cy: number; tolerance?: number };
  spawnedCount?: number;
  pictureVisible?: string | { id: string; resourceId?: string };
  bgmPlaying?: string;
  gameOver?: boolean;
  mapId?: string;
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
    readonly spawnedCount: number;
    readonly picturesVisible: readonly string[];
    readonly bgm?: string;
    readonly gameOver: boolean;
    readonly switchesOn: readonly string[];
    readonly variables: Record<string, number>;
    readonly playTimeSeconds: number;
  };
  readonly log: readonly string[];
  readonly session: PlaySession;
}

type PumpStop =
  | { stop: "done" }
  | { stop: "choices" }
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
  readonly session: PlaySession;
  readonly eventPositions: RuntimeEventPositions;
  readonly log: string[];
  readonly camera: CameraModel;
  facing: Dir;
  gameOver: boolean;
  held: { interp: Interpreter } | null;
}

export function runSceneTest(project: Project, input: SceneTestInput): SceneTestResult {
  const session = startSession(project);
  const map = project.maps[input.mapId];
  const log: string[] = [];
  if (!map) {
    return result(false, project, session, emptyEventPositions(project), emptyCamera(session), log, input.steps, 0, input.steps[0], `맵 없음: ${input.mapId}`, false);
  }
  session.currentMapId = input.mapId;
  session.x = input.start.x;
  session.y = input.start.y;
  const state: RunnerState = {
    project,
    session,
    eventPositions: emptyEventPositions(project),
    log,
    camera: emptyCamera(session),
    facing: "down",
    gameOver: false,
    held: null,
  };
  syncFollowCamera(state);

  for (let i = 0; i < input.steps.length; i += 1) {
    const step = input.steps[i];
    let reason: string | null;
    try {
      reason = runStep(state, step);
    } catch (cause) {
      reason = `예외: ${cause instanceof Error ? cause.message : String(cause)}`;
    }
    if (reason !== null) {
      return result(false, project, session, state.eventPositions, state.camera, log, input.steps, i, step, reason, state.gameOver);
    }
  }

  return result(true, project, session, state.eventPositions, state.camera, log, input.steps, input.steps.length, undefined, undefined, state.gameOver);
}

function runStep(state: RunnerState, step: SceneStep): string | null {
  switch (step.kind) {
    case "wait":
      advanceTime(state, Math.max(0, Math.trunc(step.ticks)) * TICK_MS);
      return null;
    case "move":
      return runMoveStep(state, step);
    case "interact":
      return runInteractStep(state);
    case "choose":
      return runChooseStep(state, step.index);
    case "expect":
      return runExpectStep(state, step);
  }
}

function runMoveStep(state: RunnerState, step: Extract<SceneStep, { kind: "move" }>): string | null {
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
    if (blocking.trigger.kind === "touch" || blocking.trigger.kind === "playerTouch") {
      return runEventView(state, blocking);
    }
    return `이동 대상에 막는 이벤트가 있습니다: ${blocking.event.id} (${x},${y})`;
  }
  state.session.x = x;
  state.session.y = y;
  syncFollowCamera(state);
  const touch = findRuntimeEventAtInMap(state.project, map, state.session, state.eventPositions, x, y, ["touch", "playerTouch"]);
  if (touch) return runEventView(state, touch);
  return null;
}

function movePlayerToReachableTarget(state: RunnerState, x: number, y: number): string | null {
  const map = currentMap(state);
  if (!map) return `현재 맵 없음: ${state.session.currentMapId}`;
  const reach = checkReachability(state.project, map.id, { x: state.session.x, y: state.session.y }, [{ x, y }]);
  if (!reach.reachable) return `이동 대상 도달 불가: ${map.id} (${state.session.x},${state.session.y}) -> (${x},${y})`;
  state.session.x = x;
  state.session.y = y;
  syncFollowCamera(state);
  const touch = findRuntimeEventAtInMap(state.project, map, state.session, state.eventPositions, x, y, ["touch", "playerTouch"]);
  if (touch) return runEventView(state, touch);
  return null;
}

function runInteractStep(state: RunnerState): string | null {
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
  const target = front ?? findRuntimeEventAtInMap(state.project, map, state.session, state.eventPositions, state.session.x, state.session.y, "action");
  if (!target) return `조사할 action 이벤트 없음: ${map.id} (${state.session.x},${state.session.y}) facing=${state.facing}`;
  return runEventView(state, target);
}

function runChooseStep(state: RunnerState, index: number): string | null {
  if (!state.held) return "choose를 처리할 대기 중 선택지가 없습니다.";
  const interp = state.held.interp;
  const stop = pump(state, interp, interp.resume(index));
  state.held = stop.stop === "choices" ? { interp } : null;
  return stop.stop === "failed" ? stop.reason : null;
}

function runEventView(state: RunnerState, view: RuntimeEventView): string | null {
  const commands = view.page?.commands ?? resolveEventPage(view.event, state.session)?.commands ?? view.event.commands;
  if (commands.length === 0) {
    state.held = null;
    state.log.push(`event ${view.event.id}: no commands`);
    return null;
  }
  const interp = createInterpreter([...commands], state.session, state.project, { currentEventId: view.event.id });
  state.log.push(`event ${view.event.id} start`);
  const stop = pump(state, interp, interp.start());
  state.held = stop.stop === "choices" ? { interp } : null;
  return stop.stop === "failed" ? stop.reason : null;
}

function pump(state: RunnerState, interp: Interpreter, first: StepResult): PumpStop {
  let step = first;
  for (let guard = 0; guard < 100000; guard += 1) {
    switch (step.kind) {
      case "done":
        return { stop: "done" };
      case "choices":
        return { stop: "choices" };
      case "text":
        step = interp.resume(undefined);
        break;
      case "wait":
        advanceTime(state, step.ms);
        step = interp.resume(undefined);
        break;
      case "transfer":
        state.session.currentMapId = step.mapId;
        state.session.x = step.x;
        state.session.y = step.y;
        syncFollowCamera(state);
        step = interp.resume(undefined);
        break;
      case "showPicture":
        showPictureState(state.session, step);
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
        if (step.wait) advanceUntilCameraSettled(state);
        step = interp.resume(undefined);
        break;
      case "scrollMap":
        startScrollMap(state, step);
        if (step.wait) advanceUntilCameraSettled(state);
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
      case "shop":
      case "inn":
      case "flashScreen":
      case "shakeScreen":
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
        return { stop: "failed", reason: `run_scene_test는 battleProcessing을 지원하지 않습니다: ${step.troopId}` };
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

function advanceUntilCameraSettled(state: RunnerState): void {
  let guard = 0;
  while (state.camera.tween && guard < 10000) {
    guard += 1;
    advanceTime(state, TICK_MS);
  }
}

function advanceTime(state: RunnerState, ms: number): void {
  let remaining = Math.max(0, Math.round(ms));
  if (remaining === 0) {
    syncFollowCamera(state);
    return;
  }
  while (remaining > 0) {
    const delta = Math.min(TICK_MS, remaining);
    remaining -= delta;
    state.session.playTimeSeconds += delta / 1000;
    advanceCamera(state, delta);
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
  if (step.eventAt) {
    const eventFailure = expectEventAt(state, step.eventAt);
    if (eventFailure) return eventFailure;
  }
  if (step.cameraAt) {
    const tolerance = step.cameraAt.tolerance ?? 0;
    if (Math.abs(state.camera.cx - step.cameraAt.cx) > tolerance || Math.abs(state.camera.cy - step.cameraAt.cy) > tolerance) {
      return `카메라 위치: 기대 (${step.cameraAt.cx},${step.cameraAt.cy})±${tolerance}, 실제 (${state.camera.cx},${state.camera.cy})`;
    }
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
  if (step.gameOver !== undefined && state.gameOver !== step.gameOver) {
    return `게임 오버: 기대 ${step.gameOver}, 실제 ${state.gameOver}`;
  }
  return null;
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
  for (const [variableId, value] of Object.entries(expected)) {
    const got = getVariable(state.session, variableId);
    if (got !== value) return `변수 ${variableId}: 기대 ${value}, 실제 ${got}`;
  }
  return null;
}

function expectEventAt(
  state: RunnerState,
  expected: { readonly eventId: string; readonly x: number; readonly y: number; readonly mapId?: string }
): string | null {
  const mapId = expected.mapId ?? state.session.currentMapId;
  const map = state.project.maps[mapId];
  if (!map) return `이벤트 위치 확인 맵 없음: ${mapId}`;
  const event = runtimeEventViewsForMap(state.project, map, state.session, state.eventPositions).find((view) => view.event.id === expected.eventId);
  if (!event) return `이벤트 없음: ${expected.eventId} (맵 ${mapId})`;
  if (event.x !== expected.x || event.y !== expected.y) {
    return `이벤트 ${expected.eventId}: 기대 (${expected.x},${expected.y}), 실제 (${event.x},${event.y})`;
  }
  return null;
}

function toStringList(value: string | readonly string[] | undefined): readonly string[] {
  if (value === undefined) return [];
  return typeof value === "string" ? [value] : value;
}

function currentMap(state: RunnerState): GameMap | undefined {
  return state.project.maps[state.session.currentMapId];
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

function result(
  ok: boolean,
  project: Project,
  session: PlaySession,
  eventPositions: RuntimeEventPositions,
  camera: CameraModel,
  log: readonly string[],
  steps: readonly SceneStep[],
  stepsRun: number,
  failedStep: SceneStep | undefined,
  failureReason: string | undefined,
  gameOver: boolean
): SceneTestResult {
  void project;
  void eventPositions;
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
      spawnedCount: spawnedCount(session),
      picturesVisible: Object.keys(session.pictures),
      bgm: session.audio.bgm?.resourceId,
      gameOver,
      switchesOn: Object.entries(session.switches).filter(([, value]) => value).map(([key]) => key),
      variables: { ...session.variables },
      playTimeSeconds: session.playTimeSeconds,
    },
    log,
    session,
  };
}
