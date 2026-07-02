import { canMove } from "@/project/collision";
import { store } from "@/project/store";
import { characterSpriteX, characterSpriteY, updateCharacterDepth } from "@/player/characterDepth";
import { applyFacing } from "@/player/playSceneAutonomousCommands";
import { setNpcIdleFrame } from "@/player/playSceneAutonomousSprites";
import type { AutonomousNpcSprite } from "@/player/playSceneAutonomousTypes";
import type { Dir } from "@/player/input";
import { assertNever, type PlaySceneContext } from "@/player/playSceneTypes";
import { findBlockingRuntimeEventAtInMap, findRuntimeEventAtInMap } from "@/player/runtimeEventState";
import type { RuntimeEventView } from "@/player/runtimeEventState";
import type { EventAnimationType } from "@/project/types";

type ActionEventSceneContext = Pick<
  PlaySceneContext,
  | "autonomousNPCs"
  | "eventPositions"
  | "facing"
  | "lastActionTargetKey"
  | "map"
  | "runEvent"
  | "session"
  | "tileX"
  | "tileY"
> & {
  readonly eventSprites: { get(eventId: string): AutonomousNpcSprite | undefined };
};

export function updatePlayScene(scene: PlaySceneContext, deltaMs: number): void {
  if (isRuntimeMenuOpen(scene)) {
    scene.input_.resetEdges();
    scene.syncRuntimeState();
    return;
  }
  scene.session.playTimeSeconds += deltaMs / 1000;
  const input = scene.input_.update();
  if (!scene.moving && input.dir) tryStartMove(scene, input.dir);
  if (scene.moving) {
    updatePlayerMovement(scene, deltaMs);
  } else {
    scene.player.setFrame(scene.playerSprite.idleFrameFor(scene.facing));
  }
  if (input.actionPressed && !scene.moving) handleAction(scene);
  scene.input_.resetEdges();
  if (canUpdateWaitingEvents(scene)) {
    scene.updateAutonomousNPCs(deltaMs);
    scene.updateParallelEvents(deltaMs);
  }
  scene.updateTimers(deltaMs);
  scene.syncRuntimeState();
}

export function isRuntimeMenuOpen(scene: Pick<PlaySceneContext, "game">): boolean {
  const canvas = scene.game.canvas;
  const playStage = canvas.parentElement?.closest(".play-stage");
  return (playStage ?? canvas.ownerDocument).querySelector("[data-testid='main-menu']") !== null;
}

function canUpdateWaitingEvents(scene: PlaySceneContext): boolean {
  return !scene.running || scene.session.messageWindowSettings?.allowEventMovementDuringWait === true;
}

function updatePlayerMovement(scene: PlaySceneContext, deltaMs: number): void {
  scene.moveProgress += deltaMs / scene.moveDurationMs;
  if (scene.moveProgress >= 1) {
    scene.moveProgress = 1;
    scene.tileX = scene.movingTo.x;
    scene.tileY = scene.movingTo.y;
    scene.session.x = scene.tileX;
    scene.session.y = scene.tileY;
    scene.moving = false;
    scene.player.x = characterSpriteX(scene.tileX);
    scene.player.y = characterSpriteY(scene.tileY);
    updateCharacterDepth(scene.player, "same");
    fireTouchTriggers(scene);
    maybeTriggerRandomEncounter(scene);
    return;
  }
  const px = linear(scene.movingFrom.x, scene.movingTo.x, scene.moveProgress);
  const py = linear(scene.movingFrom.y, scene.movingTo.y, scene.moveProgress);
  scene.player.x = characterSpriteX(px);
  scene.player.y = characterSpriteY(py);
  updateCharacterDepth(scene.player, "same");
  scene.walkTimer += deltaMs;
  if (scene.walkTimer > 90) {
    scene.walkTimer = 0;
    scene.walkFrame = (scene.walkFrame + 1) % scene.playerSprite.walkFrameCount;
  }
  scene.player.setFrame(scene.playerSprite.walkFrameFor(scene.facing, scene.walkFrame));
}

function tryStartMove(scene: PlaySceneContext, dir: Dir): void {
  scene.facing = dir;
  const delta = directionDelta(dir);
  const nx = scene.tileX + delta.x;
  const ny = scene.tileY + delta.y;
  const project = store.getCurrent();
  if (!canMove(project, scene.map, scene.tileX, scene.tileY, nx, ny)) return;
  const blockingEvent = findBlockingRuntimeEventInScene(scene, nx, ny);
  if (blockingEvent) {
    firePlayerTouchEvent(scene, blockingEvent.event.id, blockingEvent.trigger.kind);
    return;
  }
  scene.movingFrom = { x: scene.tileX, y: scene.tileY };
  scene.movingTo = { x: nx, y: ny };
  scene.moving = true;
  scene.moveProgress = 0;
  scene.walkFrame = 0;
  scene.walkTimer = 0;
  scene.lastActionTargetKey = "";
}

export function handleAction(scene: ActionEventSceneContext): void {
  const delta = directionDelta(scene.facing);
  const tx = scene.tileX + delta.x;
  const ty = scene.tileY + delta.y;
  const key = `${tx},${ty}`;
  if (key === scene.lastActionTargetKey) return;
  scene.lastActionTargetKey = key;
  const event = findRuntimeEventInScene(scene, tx, ty, "action");
  if (event) {
    turnActionEventTowardPlayer(scene, event);
    void scene.runEvent(event.event.id);
  }
}

function turnActionEventTowardPlayer(scene: ActionEventSceneContext, event: RuntimeEventView): void {
  if (!canActionTurn(event.animationType)) return;
  const direction = directionTowardPlayer(scene, event);
  if (!direction) return;
  const mover = scene.autonomousNPCs.get(event.event.id);
  const frameDirection = mover ? applyFacing(mover, direction) : direction;
  setNpcIdleFrame(
    scene.eventSprites.get(event.event.id),
    event.page?.graphic.pattern ?? 0,
    frameDirection,
    event.animationType,
    mover?.animationEnabled ?? true
  );
}

function canActionTurn(animationType: EventAnimationType): boolean {
  switch (animationType) {
    case "normal":
    case "step":
    case "fourFrame":
      return true;
    case "fixedDirection":
    case "fixedDirectionStep":
    case "fixedGraphic":
      return false;
    default:
      return assertNever(animationType);
  }
}

function directionTowardPlayer(scene: ActionEventSceneContext, event: RuntimeEventView): Dir | null {
  const dx = scene.tileX - event.x;
  const dy = scene.tileY - event.y;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return dx > 0 ? "right" : "left";
  if (dy !== 0) return dy > 0 ? "down" : "up";
  return null;
}

function fireTouchTriggers(scene: PlaySceneContext): void {
  const event = findRuntimeEventInScene(scene, scene.tileX, scene.tileY, ["touch", "playerTouch"]);
  if (event) void scene.runEvent(event.event.id);
}

function findRuntimeEventInScene(
  scene: Pick<PlaySceneContext, "map" | "session" | "eventPositions">,
  x: number,
  y: number,
  triggerKind: Parameters<typeof findRuntimeEventAtInMap>[6]
): RuntimeEventView | undefined {
  return findRuntimeEventAtInMap(store.getCurrent(), scene.map, scene.session, scene.eventPositions, x, y, triggerKind);
}

function findBlockingRuntimeEventInScene(
  scene: Pick<PlaySceneContext, "map" | "session" | "eventPositions">,
  x: number,
  y: number
): RuntimeEventView | undefined {
  return findBlockingRuntimeEventAtInMap(store.getCurrent(), scene.map, scene.session, scene.eventPositions, x, y);
}

function firePlayerTouchEvent(scene: PlaySceneContext, eventId: string, triggerKind: string): void {
  if (triggerKind === "touch" || triggerKind === "playerTouch") void scene.runEvent(eventId);
}

function directionDelta(dir: Dir): { x: number; y: number } {
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

function linear(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

// ── 랜덤 인카운트 ──
// 맵 이동 완료 시마다 스텝 카운터를 증가시키고 encounterRate 가중치로 확률 롤.
// RM2K3의 "스텝이 쌓일수록 인카운트 확률 상승"을 단순화: 매 스텝마다
// encounterRate/1000 의 누적 확률(최소 보장값 적용)로 발생.
let encounterStepCounter = 0;
let encounterAccumulator = 0;

function maybeTriggerRandomEncounter(scene: PlaySceneContext): void {
  if (scene.running) return; // 이미 전투/이벤트 진행 중이면 무시
  const map = scene.map;
  const rate = map.encounterRate ?? 0;
  const troops = map.troopIds;
  if (rate <= 0 || !troops || troops.length === 0) return;
  encounterStepCounter += 1;
  encounterAccumulator += rate;
  // 누적 가중치가 임계(1000)를 넘으면 인카운트 발생. 매 스텝마다 rate가 쌓여
  // 결국 발생하도록 보장(rate 클수록 빠름). 발생 시 카운터/누적값 리셋.
  if (encounterAccumulator < 1000 && Math.random() * 1000 >= encounterAccumulator) return;
  encounterStepCounter = 0;
  encounterAccumulator = 0;
  const troopId = troops[Math.floor(Math.random() * troops.length)] ?? troops[0];
  if (!troopId) return;
  // 전투 시작(비동기). scene.running 가드로 재진입 방지.
  void scene.playBattle({ kind: "battleProcessing", troopId, canEscape: true, canLose: false });
}

// 전투 후/맵 진입 시 스텝 카운터 리셋(외부에서 호출 가능).
export function resetEncounterCounter(): void {
  encounterStepCounter = 0;
  encounterAccumulator = 0;
}
