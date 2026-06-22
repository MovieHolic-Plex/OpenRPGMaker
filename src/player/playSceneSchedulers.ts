import type Phaser from "phaser";
import { TILE_SIZE } from "@/assets/bundled";
import { canMove } from "@/project/collision";
import {
  clearAudioState,
  erasePictureState,
  setAudioState,
  showPictureState,
} from "@/project/session";
import { store } from "@/project/store";
import type { Command, MoveCommand } from "@/project/types";
import {
  NPC_MOVE_DURATION_MS,
  charsetIdleFrameIndex,
  charsetWalkFrameIndex,
  charsetWalkStepFromElapsedMs,
  isEasyRpgCharsetTextureKey,
} from "@/player/charsetMotion";
import type { Dir } from "@/player/input";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import type { AutonomousMover, PlaySceneContext, ParallelProcess } from "@/player/playSceneTypes";
import { assertNever } from "@/player/playSceneTypes";
import {
  moveRuntimeEventPosition,
  runtimeEventView,
} from "@/player/runtimeEventState";

export function registerAutonomousMover(
  scene: PlaySceneContext,
  eventId: string,
  moves: MoveCommand[],
  repeat: boolean
): void {
  if (!scene.map.events.some((event) => event.id === eventId)) {
    console.warn(`[player] moveEvent target event missing: ${eventId}`);
    return;
  }
  scene.autonomousNPCs.set(eventId, { moves, step: 0, timer: 0, repeat, activeMove: null });
}

export function registerPageMoveRoutes(scene: PlaySceneContext): void {
  for (const event of scene.map.events) {
    const view = runtimeEventView(event, scene.session, scene.eventPositions);
    const route = view.page?.movement.route;
    if (!route || view.page.movement.type !== "custom") continue;
    const key = `${view.event.id}:${view.page.id}`;
    if (scene.pageMoveRouteKeys.has(key)) continue;
    scene.pageMoveRouteKeys.add(key);
    scene.registerAutonomousMover(view.event.id, route.moves, route.repeat);
  }
}

export function updateParallelEvents(scene: PlaySceneContext, deltaMs: number): void {
  const activeEvents = scene.activeRuntimeEvents("parallel");
  const activeKeys = new Set(activeEvents.map((event) => `${event.event.id}:${event.pageId ?? "legacy"}`));
  for (const key of scene.parallelProcesses.keys()) {
    if (!activeKeys.has(key)) scene.parallelProcesses.delete(key);
  }
  for (const event of activeEvents) {
    const pageId = event.pageId ?? "legacy";
    const key = `${event.event.id}:${pageId}`;
    const process = scene.parallelProcesses.get(key) ?? createParallelProcess(scene, event, pageId);
    if (process.waitMs > 0) {
      process.waitMs = Math.max(0, process.waitMs - deltaMs);
      if (process.waitMs > 0) continue;
    }
    const result = process.started ? process.interpreter.resume(undefined) : process.interpreter.start();
    process.started = true;
    consumeParallelSteps(scene, key, process, result);
  }
}

function createParallelProcess(
  scene: PlaySceneContext,
  event: { event: { id: string; commands: Command[] }; page?: { commands: Command[] } },
  pageId: string
): ParallelProcess {
  const process = {
    pageId,
    interpreter: createInterpreter(event.page?.commands ?? event.event.commands, scene.session),
    waitMs: 0,
    started: false,
  };
  scene.parallelProcesses.set(`${event.event.id}:${pageId}`, process);
  return process;
}

function consumeParallelSteps(
  scene: PlaySceneContext,
  key: string,
  process: ParallelProcess,
  firstResult: StepResult
): void {
  let result = firstResult;
  let guard = 0;
  while (result.kind !== "done" && guard < 16) {
    guard += 1;
    if (result.kind === "wait") {
      process.waitMs = result.ms;
      return;
    }
    if (applyNonBlockingStep(scene, result)) {
      result = process.interpreter.resume(undefined);
      scene.refreshRuntimeSurfaces();
      continue;
    }
    process.waitMs = 100;
    return;
  }
  if (result.kind === "done") scene.parallelProcesses.delete(key);
}

export function applyNonBlockingStep(scene: PlaySceneContext, step: StepResult): boolean {
  switch (step.kind) {
    case "changeTile":
      scene.applyChangeTileStep(step);
      return true;
    case "moveEvent":
      scene.registerAutonomousMover(step.eventId, step.moves, step.repeat);
      return true;
    case "transfer":
      scene.transferTo(step.mapId, step.x, step.y);
      return true;
    case "battleProcessing":
      scene.showBattleScene(step.troopId);
      return true;
    case "showPicture":
      showPictureState(scene.session, step);
      scene.showRuntimeOverlay("picture-overlay", step.pictureId || step.resourceId);
      return true;
    case "erasePicture":
      erasePictureState(scene.session, step.pictureId);
      scene.clearRuntimeOverlay("picture-overlay");
      return true;
    case "playAudio":
      setAudioState(scene.session, step);
      scene.showRuntimeOverlay("audio-indicator", step.resourceId || "audio");
      return true;
    case "stopAudio":
      clearAudioState(scene.session);
      scene.clearRuntimeOverlay("audio-indicator");
      return true;
    case "shop":
      scene.showRuntimeOverlay("shop-scene", step.itemIds.join(",") || "shop");
      return true;
    case "inn":
      scene.showRuntimeOverlay("inn-scene", String(step.price));
      return true;
    case "gameOver":
      scene.showGameOverScreen();
      return true;
    case "returnToTitle":
      scene.returnToTitle();
      return true;
    case "done":
    case "text":
    case "choices":
    case "wait":
    case "inputWait":
      return false;
    default:
      return assertNever(step);
  }
}

export function updateAutonomousNPCs(scene: PlaySceneContext, deltaMs: number): void {
  const project = store.getCurrent();
  for (const [eventId, mover] of scene.autonomousNPCs) {
    if (mover.activeMove) {
      updateActiveNpcMove(scene, eventId, mover, deltaMs);
      continue;
    }
    if (mover.moves.length === 0) continue;
    mover.timer += Math.max(0, deltaMs);
    if (mover.timer < NPC_MOVE_DURATION_MS) continue;
    mover.timer = 0;
    const command = mover.moves[mover.step % mover.moves.length];
    mover.step += 1;
    if (command.kind === "wait") {
      completeRouteCommand(mover);
      continue;
    }
    const event = scene.map.events.find((entry) => entry.id === eventId);
    if (!event) {
      completeRouteCommand(mover);
      continue;
    }
    const view = runtimeEventView(event, scene.session, scene.eventPositions);
    const baseFrame = view.page?.graphic.pattern ?? 0;
    if (command.kind === "turn") {
      setNpcIdleFrame(scene.eventSprites.get(eventId), baseFrame, command.dir);
      completeRouteCommand(mover);
      continue;
    }
    const position = scene.eventPositions[eventId] ?? { x: event.x, y: event.y };
    const delta = commandDelta(command.dir);
    const nx = position.x + delta.x;
    const ny = position.y + delta.y;
    if (nx === scene.tileX && ny === scene.tileY) {
      fireEventTouch(scene, eventId, view.trigger.kind);
      setNpcIdleFrame(scene.eventSprites.get(eventId), baseFrame, command.dir);
      completeRouteCommand(mover);
      continue;
    }
    if (canMove(project, scene.map, position.x, position.y, nx, ny)) {
      moveRuntimeEventPosition(scene.eventPositions, eventId, nx, ny);
      mover.activeMove = {
        fromX: position.x,
        fromY: position.y,
        toX: nx,
        toY: ny,
        dir: command.dir,
        baseFrame,
        elapsedMs: 0,
      };
      const sprite = scene.eventSprites.get(eventId);
      if (sprite) {
        sprite.setPosition(tileCenter(position.x), tileCenter(position.y));
        setNpcWalkFrame(sprite, baseFrame, command.dir, 0);
      }
      scene.runtimeDom.upsertEventMarker(runtimeEventView(event, scene.session, scene.eventPositions));
    } else {
      setNpcIdleFrame(scene.eventSprites.get(eventId), baseFrame, command.dir);
    }
    completeRouteCommand(mover);
  }
}

function fireEventTouch(scene: PlaySceneContext, eventId: string, triggerKind: string): void {
  if (triggerKind === "eventTouch") void scene.runEvent(eventId);
}

function updateActiveNpcMove(
  scene: PlaySceneContext,
  eventId: string,
  mover: AutonomousMover,
  deltaMs: number
): void {
  const move = mover.activeMove;
  if (!move) return;
  move.elapsedMs = Math.min(NPC_MOVE_DURATION_MS, move.elapsedMs + Math.max(0, deltaMs));
  const progress = move.elapsedMs / NPC_MOVE_DURATION_MS;
  const sprite = scene.eventSprites.get(eventId);
  if (sprite) {
    sprite.setPosition(
      tileCenter(lerp(move.fromX, move.toX, progress)),
      tileCenter(lerp(move.fromY, move.toY, progress))
    );
    setNpcWalkFrame(sprite, move.baseFrame, move.dir, move.elapsedMs);
  }
  if (move.elapsedMs < NPC_MOVE_DURATION_MS) return;
  if (sprite) {
    sprite.setPosition(tileCenter(move.toX), tileCenter(move.toY));
    setNpcIdleFrame(sprite, move.baseFrame, move.dir);
  }
  mover.activeMove = null;
  mover.timer = NPC_MOVE_DURATION_MS;
}

function completeRouteCommand(mover: AutonomousMover): void {
  if (!mover.repeat && mover.step >= mover.moves.length) mover.moves = [];
}

function setNpcWalkFrame(
  sprite: Phaser.GameObjects.Sprite | undefined,
  baseFrame: number,
  dir: Dir,
  elapsedMs: number
): void {
  if (!sprite || !isEasyRpgCharsetTextureKey(sprite.texture.key)) return;
  sprite.setFrame(charsetWalkFrameIndex(baseFrame, dir, charsetWalkStepFromElapsedMs(elapsedMs)));
}

function setNpcIdleFrame(
  sprite: Phaser.GameObjects.Sprite | undefined,
  baseFrame: number,
  dir: Dir
): void {
  if (!sprite || !isEasyRpgCharsetTextureKey(sprite.texture.key)) return;
  sprite.setFrame(charsetIdleFrameIndex(baseFrame, dir));
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function tileCenter(tile: number): number {
  return tile * TILE_SIZE + TILE_SIZE / 2;
}

function commandDelta(dir: "left" | "right" | "up" | "down"): { x: number; y: number } {
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

export function updateTimers(scene: PlaySceneContext, deltaMs: number): void {
  for (const timer of scene.runtimeTimers.values()) {
    if (!timer.active) continue;
    timer.remaining = Math.max(0, timer.remaining - deltaMs / 1000);
    if (timer.remaining === 0) timer.active = false;
  }
  for (const [id, seconds] of Object.entries(scene.session.timers)) {
    if (!scene.runtimeTimers.has(id)) {
      scene.runtimeTimers.set(id, { remaining: seconds, active: true });
    }
  }
}
