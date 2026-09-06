import { updateDetectionEncounters } from "./npcDetectionEncounter";
import { advanceFurniturePush, beginFurniturePush, clearFurniturePush, furniturePushFrames } from './furniturePushAnimation';
import { advancePursuitDoors, isPlayerHiding, pushObject, toggleHiding } from "./horrorRuntime";
import { refreshRuntimeEntities } from "./playSceneMapRuntime";
import { conditionWaitScenes } from "@/player/runtimeConditionWait";
import { canMoveFootprint, inBounds } from "@/project/collision";
// 경로 세팅은 잎 모듈에 있다(가벼운 소비자가 이 파일 전체를 끌어오지 않도록) — 기존
// 임포트 경로를 깨지 않기 위해 여기서 다시 내보낸다.
export { startPlayerRoute } from "@/player/playerRouteState";
import { footprintBounds, nearestCellInRect } from "@/project/footprint";
import { playerPassageRect, resolvePlayerBody, type PlayerBody } from "@/project/playerFootprint";
import { isSpatialPlacementBlocking } from "@/project/spatialOccupancy";
import { isActionCombatMap, resolveActionCombatConfig } from "@/project/actionCombat";
import { store } from "@/project/store";
import type { MoveCommand } from "@/project/types";
import { characterSpriteY, footprintSpriteX, updateCharacterDepth } from "@/player/characterDepth";
import { fallHop, jumpHop } from "@/player/characterHop";
import { applyHopFrame, finishHop, PLAYER_SHADOW_KEY } from "@/player/characterHopRuntime";
import { applyFacing } from "@/player/playSceneAutonomousCommands";
import { facingForDelta } from "@/player/playSceneAutonomousRouteDirection";
import { setNpcIdleFrame } from "@/player/playSceneAutonomousSprites";
import type { AutonomousNpcSprite } from "@/player/playSceneAutonomousTypes";
import type { Dir, InputState } from "@/player/input";
import { facingForStep, resolveDiagonalStep } from "@/player/input";
import { assertNever, type PlaySceneContext } from "@/player/playSceneTypes";
import { findBlockingEventOverlappingRect,
findRuntimeEventAtInMap,
setRuntimeEventPositionDirection, } from "@/project/runtimeEventState"
import type { RuntimeEventView } from "@/project/runtimeEventState"
import type { EventAnimationType, Trigger } from "@/project/types";
import { nextSessionRandom } from "@/project/session";
import { isCutsceneInputLocked } from "@/player/cutsceneControl";
import { recordFollowerPlayerStep } from "@/project/followers";
import { applyWalkCareTicks } from "@/project/monsterCare";
import { applyGen1FieldPoisonStep } from "@/project/monsterCollection";
import { syncFollowerSprites } from "@/player/playSceneFollowers";
import { eligibleEncounterEntries, pickEncounterTroopForMap } from "@/player/encounters";
import { terrainRecordAt } from "@/project/terrainAt";
import { applyTerrainWalkDamage, scaledEncounterRate } from "@/project/terrainStep";
import { firesOnPlayerCollision, PLAYER_COLLISION_TRIGGER_KINDS } from "@/project/eventTouchRules";
import type { RuntimeDomOverlay } from "@/player/runtimeDom";
import type { FarmInteractionResult } from "@/player/farming";
import { farmIntentForHand, interactWithFarmPlot, farmIgnoreMessage } from "@/player/farming";
import { showFarmFeedbackMessage } from "@/player/playSceneZoneFeedback";
import { interactWithLifeField } from "@/player/lifeFieldInteraction";
import { tryChestInteraction } from "@/player/playSceneChest";
import { tryActionCombatSwing, tryActionSkillCast } from "@/player/playSceneActionCombat";
import { applyBattleDefeat } from "@/player/playSceneDefeat";

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
  readonly runtimeDom?: RuntimeDomOverlay;
  refreshRuntimeSurfaces?(): void;
  syncRuntimeState?(): void;
};

/**
 * 주인공 이동의 논리 프레임. RPG Maker 는 걸음을 시간이 아니라 프레임으로 가른다(MV: 2^speed/256
 * 타일/프레임, 60fps 고정). Phaser 는 디스플레이 주사율로 update 를 부르므로 deltaMs 를 이 틱으로 바꿔
 * 그 틱마다 RM 의 한 프레임을 돌린다.
 */
export const LOGIC_TICK_MS = 1000 / 60;

/**
 * 이번 update 에서 돌릴 논리 틱 수. 잔여를 이월하고 반올림하므로 60Hz 지터(16.2/17.1ms)에서도 프레임당
 * 정확히 1틱이고, 120Hz 는 0·1 교대, 30fps 는 2틱 — 어느 주사율에서도 1초 = 60틱이다.
 * (반올림 이월의 성질: 누적 틱 수 = round(누적 시간 / 틱) — 프레임 분할과 무관.)
 */
export function takeLogicTicks(scene: Pick<PlaySceneContext, "logicTickAccumulatorMs">, deltaMs: number): number {
  const accumulated = scene.logicTickAccumulatorMs + Math.max(0, deltaMs);
  const ticks = Math.round(accumulated / LOGIC_TICK_MS);
  scene.logicTickAccumulatorMs = accumulated - ticks * LOGIC_TICK_MS;
  return ticks;
}

export function updatePlayScene(scene: PlaySceneContext, deltaMs: number): void {
  if (isRuntimeMenuOpen(scene)) {
    scene.input_.resetEdges();
    // 메뉴가 열린 동안 누른 방향키가 닫히는 순간 유령 걸음이 되지 않게 탭 래치를 비운다.
    scene.input_.clearDirectionTaps();
    scene.syncRuntimeState();
    return;
  }
  updateDetectionEncounters(scene, deltaMs);
  const world = { project: store.getCurrent(), map: scene.map, session: scene.session, positions: scene.eventPositions };
  if (!scene.running && advancePursuitDoors(world, deltaMs)) refreshRuntimeEntities(scene);
  scene.player.setVisible?.(!isPlayerHiding(world));
  scene.session.playTimeSeconds += deltaMs / 1000;
  const ticks = takeLogicTicks(scene, deltaMs);
  // 틱이 없는 프레임(고주사율)에서는 입력을 읽지 않는다 — 엣지와 탭이 다음 틱 프레임으로 살아서 간다.
  if (ticks > 0) {
    const pushingAtFrameStart = furniturePushFrames(scene) !== undefined;
    const input = scene.input_.update();
    const cutsceneInputLocked = isCutsceneInputLocked(scene.session);
    for (let tick = 0; tick < ticks; tick += 1) tickPlayerMovement(scene, input, cutsceneInputLocked);
    // 액션 전투 맵에서는 확인 키 하나가 조사와 공격을 겸한다 — 정면에 조사 대상이
    // 있으면 대화가 우선하고, 없을 때만 스윙한다(적대 리뷰 10: Space 만 공격이고
    // Z 는 조사로 남아 결정 키가 둘로 쪼개져 있었다).
    let interacted = false;
    const airborne = scene.playerHop !== null;
    if (!pushingAtFrameStart && !cutsceneInputLocked && input.actionPressed && !scene.moving && !airborne) interacted = handleAction(scene, event => tryStartFurniturePush(scene, event));
    if (!cutsceneInputLocked && input.attackPressed && !interacted && !airborne) tryActionCombatSwing(scene);
    if (!cutsceneInputLocked && input.skillPressed && !airborne) tryActionSkillCast(scene);
    scene.input_.resetEdges();
  }
  // Forced event routes must progress while the interpreter awaits completion.
  // The NPC updater keeps unrelated autonomous routes paused during dialogue.
  scene.updateAutonomousNPCs(deltaMs);
  if (canUpdateWaitingEvents(scene) || conditionWaitScenes.has(scene)) {
    scene.updateParallelEvents(deltaMs);
  }
  scene.updateTimers(deltaMs);
  scene.updateFieldSpawns(deltaMs);
  scene.updateActionCombat?.(deltaMs);
  scene.syncRuntimeState();
}

export function isRuntimeMenuOpen(scene: Pick<PlaySceneContext, "game">): boolean {
  const canvas = scene.game.canvas;
  const playStage = canvas.parentElement?.closest(".play-stage");
  // 메뉴뿐 아니라 엔딩/게임 오버 패널이 떠 있는 동안에도 맵 입력을 차단한다
  // (엔딩 화면 뒤에서 이동/조사로 이벤트가 재실행되는 것을 막는다).
  const root = playStage ?? canvas.ownerDocument;
  return root.querySelector("[data-testid='main-menu'], [data-testid='ending-screen'], [data-testid='game-over-screen']") !== null;
}

function canUpdateWaitingEvents(scene: PlaySceneContext): boolean {
  return !scene.running || scene.session.messageWindowSettings?.allowEventMovementDuringWait === true;
}

// 대시 배속(RM2K3 관례: 걷기 대비 약 1.8배). 160ms 걸음(10프레임)은 대시에서 5프레임이 된다 —
// RM 의 「대시 = 속도 한 단계 위 = 2배」와 같다. 걷기 프레임 주기도 같은 비율로 짧아진다.
const DASH_SPEED_FACTOR = 1.8;
const WALK_FRAME_MS = 90;
/** dx/dy 를 안 준 점프의 거리. NPC 의 DEFAULT_JUMP_DISTANCE 와 같은 2 칸이다. */
const PLAYER_JUMP_DISTANCE = 2;

/** 지속 시간(ms)을 논리 프레임 수로. 걸음·점프·낙하 전부 이 한 곳으로 양자화한다. */
function framesForDuration(durationMs: number): number {
  return Math.max(1, Math.round(durationMs / LOGIC_TICK_MS));
}

function stepFrames(scene: Pick<PlaySceneContext, "dashing" | "moveDurationMs" | "playerRoute">): number {
  return framesForDuration((scene.playerRoute?.moveDurationMs ?? scene.moveDurationMs) / (scene.dashing ? DASH_SPEED_FACTOR : 1));
}

/**
 * RPG Maker 의 Game_Player.update 한 프레임: 안 걷고 있으면 입력(또는 강제 루트)으로 걸음을 시작하고,
 * 그 다음 이번 프레임의 이동을 진행한다. 걸음이 끝나는 프레임에서는 칸 경계에 서고, 다음 걸음은
 * 다음 프레임에 그 프레임의 입력으로 시작한다 — 이어 붙이기도, 잔여 시간도 없다.
 */
function tickPlayerMovement(scene: PlaySceneContext, input: InputState, cutsceneInputLocked: boolean): void {
  if (scene.session.horror?.hiding) return;
  // 체공 중에는 새 이동을 시작하지 않는다 — 공중에서 입력을 받으면 낙하가 취소된다.
  if (!scene.moving && !scene.playerHop) {
    // 주인공 강제 이동 루트가 있으면 입력보다 우선해 자동으로 걷는다.
    if (scene.playerRoute) advancePlayerRoute(scene);
    else if (!cutsceneInputLocked && (input.x !== 0 || input.y !== 0)) tryStartMove(scene, input);
  }
  if (scene.moving) {
    advancePlayerStepFrame(scene);
  } else if (scene.playerHop) {
    advancePlayerStationaryHopFrame(scene);
  } else {
    scene.player.setFrame(scene.playerSprite.idleFrameFor(scene.facing));
    // 걷기 주기는 **멈출 때** 처음으로 돌아간다. 걸음마다 되돌리면 160ms 걸음에서 패턴 0·1 만 반복돼
    // 세 번째 패턴(다른 발)이 한 번도 나오지 않는다 — RM2K3 은 걷는 동안 주기를 이어 간다.
    scene.walkFrame = 0;
    scene.walkTimer = 0;
  }
}

function advancePlayerStepFrame(scene: PlaySceneContext): void {
  const hopState = scene.playerHop;
  // 점프는 자기 지속 시간으로 난다 — 대시 배속이나 이동 속도에 끌려가지 않는다.
  const pushFrames = furniturePushFrames(scene);
  const totalFrames = pushFrames ?? (hopState ? framesForDuration(hopState.hop.durationMs) : stepFrames(scene));
  // 스프라이트 가로 위치는 «몸 중앙» 이다 — 폭 2 이상이면 타일 중앙과 다르다(#250).
  const footprint = resolvePlayerBody(store.getCurrent(), scene.session).footprint;
  if (hopState) {
    hopState.elapsedFrames = Math.min(totalFrames, hopState.elapsedFrames + 1);
    scene.moveElapsedFrames = hopState.elapsedFrames;
  } else {
    scene.moveElapsedFrames = Math.min(totalFrames, scene.moveElapsedFrames + 1);
  }
  // 종료 판정은 정수 프레임으로 한다 — 0.1 을 열 번 더하면 1 이 아니다.
  scene.moveProgress = advanceFurniturePush(scene) ?? scene.moveElapsedFrames / totalFrames;
  if (scene.moveElapsedFrames >= totalFrames) {
    scene.moveProgress = 1;
    clearFurniturePush(scene);
    scene.tileX = scene.movingTo.x;
    scene.tileY = scene.movingTo.y;
    scene.session.x = scene.tileX;
    scene.session.y = scene.tileY;
    recordFollowerPlayerStep(scene.session, { x: scene.movingFrom.x, y: scene.movingFrom.y, direction: scene.facing });
    const project = store.getCurrent();
    applyWalkCareTicks(project, scene.session, 1);
    applyGen1FieldPoisonStep(project, scene.session);
    applyTerrainStepDamage(scene);
    scene.moving = false;
    scene.player.x = footprintSpriteX(scene.tileX, footprint);
    scene.player.y = characterSpriteY(scene.tileY);
    updateCharacterDepth(scene.player, "same");
    if (hopState) {
      scene.player.setFrame(scene.playerSprite.idleFrameFor(scene.facing));
      finishHop(scene, PLAYER_SHADOW_KEY, scene.player, scene.player.x, scene.player.y, hopState.hop);
      scene.playerHop = null;
    }
    syncFollowerSprites(scene);
    fireTouchTriggers(scene);
    maybeTriggerRandomEncounter(scene);
    return;
  }
  const px = linear(scene.movingFrom.x, scene.movingTo.x, scene.moveProgress);
  const py = linear(scene.movingFrom.y, scene.movingTo.y, scene.moveProgress);
  scene.player.x = footprintSpriteX(px, footprint);
  scene.player.y = characterSpriteY(py);
  updateCharacterDepth(scene.player, "same");
  if (hopState) {
    // 공중에서는 걸음을 젓지 않는다. 리프트는 setFrame 뒤에 얹어야 원점이 살아남는다.
    scene.player.setFrame(scene.playerSprite.idleFrameFor(scene.facing));
    applyHopFrame(
      scene,
      PLAYER_SHADOW_KEY,
      scene.player,
      scene.player.x,
      scene.player.y,
      hopState.hop,
      scene.moveProgress
    );
    return;
  }
  if (pushFrames && scene.moveElapsedFrames <= 2) {
    scene.player.setFrame(scene.playerSprite.idleFrameFor(scene.facing));
    return;
  }
  scene.walkTimer += LOGIC_TICK_MS;
  const walkFrameMs = pushFrames ? 120 : WALK_FRAME_MS / (scene.dashing ? DASH_SPEED_FACTOR : 1);
  while (scene.walkTimer >= walkFrameMs) {
    // 남은 시간을 버리지 않고 이월한다 — 프레임 길이와 무관하게 패턴 주기가 일정하다.
    scene.walkTimer -= walkFrameMs;
    scene.walkFrame = (scene.walkFrame + 1) % scene.playerSprite.walkFrameCount;
  }
  scene.player.setFrame(scene.playerSprite.walkFrameFor(scene.facing, scene.walkFrame));
}

/** 낙하(dropIn) 는 타일 이동이 없다 — `moving` 을 쓰지 않고 리프트만 내려온다. */
function advancePlayerStationaryHopFrame(scene: PlaySceneContext): void {
  const hopState = scene.playerHop;
  if (!hopState) return;
  const totalFrames = framesForDuration(hopState.hop.durationMs);
  hopState.elapsedFrames = Math.min(totalFrames, hopState.elapsedFrames + 1);
  // 점프 중에도 가로 위치는 몸 중앙이다 — 폭 2 이상인 주인공이 착지에서 반 칸 튀지 않게 한다.
  const groundX = footprintSpriteX(scene.tileX, resolvePlayerBody(store.getCurrent(), scene.session).footprint);
  const groundY = characterSpriteY(scene.tileY);
  scene.player.x = groundX;
  scene.player.y = groundY;
  updateCharacterDepth(scene.player, "same");
  scene.player.setFrame(scene.playerSprite.idleFrameFor(scene.facing));
  if (hopState.elapsedFrames < totalFrames) {
    applyHopFrame(scene, PLAYER_SHADOW_KEY, scene.player, groundX, groundY, hopState.hop, hopState.elapsedFrames / totalFrames);
    return;
  }
  finishHop(scene, PLAYER_SHADOW_KEY, scene.player, groundX, groundY, hopState.hop);
  scene.playerHop = null;
}

function beginPlayerStep(scene: PlaySceneContext, toX: number, toY: number): void {
  scene.movingFrom = { x: scene.tileX, y: scene.tileY };
  scene.movingTo = { x: toX, y: toY };
  scene.moving = true;
  scene.moveProgress = 0;
  scene.moveElapsedFrames = 0;
}

function tryStartMove(scene: PlaySceneContext, input: InputState): void {
  const project = store.getCurrent();
  const body = resolvePlayerBody(project, scene.session);
  const canStep = (dx: number, dy: number): boolean => playerCanStep(scene, body, dx, dy);
  // 4방향 모드(서바이벌 호러 감각): 대각 입력을 한 축으로 직교화한다.
  let moveX = input.x;
  let moveY = input.y;
  if (moveX !== 0 && moveY !== 0 && isActionCombatMap(project, scene.map) && resolveActionCombatConfig(project).fourWayMovement) {
    if (input.dir === "up" || input.dir === "down") moveX = 0;
    else moveY = 0;
  }
  const step = resolveDiagonalStep(moveX, moveY, canStep);
  if (!step) {
    // 벽을 향해도 그 방향으로 몸은 돌린다(제자리 방향 전환).
    if (input.dir) scene.facing = input.dir;
    return;
  }
  scene.facing = facingForStep(step.dx, step.dy);
  const nx = scene.tileX + step.dx;
  const ny = scene.tileY + step.dy;
  const blockingEvent = findBlockingEventForPlayerBody(scene, body, nx, ny);
  if (blockingEvent) {
    scene.facing = facingForStep(step.dx, step.dy);
    // Pushing is cardinal. A diagonal collision must never move the body
    // diagonally while the object slides along only one axis.
    if (step.dx !== 0 && step.dy !== 0 || !tryStartFurniturePush(scene, blockingEvent)) {
      firePlayerTouchEvent(scene, blockingEvent.event.id, blockingEvent.trigger.kind);
    }
    return;
  }
  scene.dashing = input.dash;
  beginPlayerStep(scene, nx, ny);
  scene.lastActionTargetKey = "";
}

/** Both movement and action input use this single collision + animation transaction. */
export function tryStartFurniturePush(scene: PlaySceneContext, event: RuntimeEventView): boolean {
  if (scene.moving || scene.playerHop || furniturePushFrames(scene) || scene.autonomousNPCs.get(event.event.id)?.activeMove) return false;
  const project = store.getCurrent();
  const body = resolvePlayerBody(project, scene.session);
  const delta = directionDelta(scene.facing);
  const nx = scene.tileX + delta.x, ny = scene.tileY + delta.y;
  if (!playerCanStep(scene, body, delta.x, delta.y)) return false;
  if (findBlockingEventForPlayerBody(scene, body, nx, ny)?.event.id !== event.event.id) return false;
  if (findBlockingEventOverlappingRect(project, scene.map, scene.session, scene.eventPositions,
    playerPassageRect(body, nx, ny), event.event.id)) return false;
  if (!pushObject({ project, map: scene.map, session: scene.session, positions: scene.eventPositions }, event, scene.facing)) return false;
  scene.dashing = false;
  scene.lastActionTargetKey = '';
  beginPlayerStep(scene, nx, ny);
  beginFurniturePush(scene, event, delta.x, delta.y);
  return true;
}

// ── 주인공 강제 이동 루트(이동 루트 설정 → 주인공) ──
// moveEvent 명령이 주인공을 대상으로 하면 이동 단계를 큐에 넣고, 주인공이 정지할 때마다
// 다음 단계를 자연스러운 걷기로 실행한다. 장소 이동(transfer)과 달리 한 칸씩 이동한다.


function advancePlayerRoute(scene: PlaySceneContext): void {
  // 이동을 시작하지 않는 명령(회전/스위치 등)은 같은 프레임에 연속 소비한다.
  // repeat + 이동 없는 루트의 프레임당 무한 루프를 막기 위해 상한을 둔다.
  let guard = 0;
  while (scene.playerRoute && !scene.moving && !scene.playerHop && guard < 64) {
    guard += 1;
    const route = scene.playerRoute;
    if (route.nextMoveDurationMs !== undefined) {
      route.moveDurationMs = route.nextMoveDurationMs;
      delete route.nextMoveDurationMs;
    }
    if (route.index >= route.moves.length) {
      if (route.repeat && route.moves.length > 0) {
        route.index = 0;
      } else {
        scene.playerRoute = null;
        return;
      }
    }
    const command = route.moves[route.index];
    route.index += 1;
    if (command && applyPlayerRouteCommand(scene, command)) return; // 이동 시작 → 이번 프레임 종료
    if (command?.kind === "move" && route.stopOnBlocked) {
      scene.playerRoute = null;
      return;
    }
  }
}

// 이동을 시작하면 true(이번 프레임 종료), 아니면 false(다음 명령 계속).
function applyPlayerRouteCommand(scene: PlaySceneContext, command: MoveCommand): boolean {
  switch (command.kind) {
    case "move":
      return startPlayerRouteStep(scene, command.dir);
    case "stepForward":
      return startPlayerRouteStep(scene, scene.facing);
    case "jump":
      return startPlayerJump(scene, command);
    case "dropIn":
      return startPlayerDropIn(scene, command);
    case "turn":
      scene.facing = command.dir;
      return false;
    case "turnRelative":
      scene.facing = rotatedFacing(scene.facing, command.turn);
      return false;
    case "turnRandom":
      scene.facing = rotatedFacing(scene.facing, "right90");
      return false;
    case "setSwitch":
      scene.session.switches[command.switchId] = command.value;
      return false;
    case "changeSpeed":
      scene.moveDurationMs = clampPlayerMoveDuration(scene.moveDurationMs, command.delta);
      return false;
    // 주인공에게 의미 없거나 MVP 범위 밖(그래픽/투명도/NPC상대 이동 등) → 조용히 건너뛴다.
    default:
      return false;
  }
}

/**
 * 주인공 점프. NPC 와 같은 규칙이다 — dx/dy 가 0 이면 바라보는 방향 2 칸이고,
 * 통행 판정은 건너뛰고 맵 경계만 본다(RM2K3 의 점프도 지형을 무시한다).
 */
function startPlayerJump(scene: PlaySceneContext, command: Extract<MoveCommand, { kind: "jump" }>): boolean {
  const delta =
    command.dx !== 0 || command.dy !== 0
      ? { x: command.dx, y: command.dy }
      : scaleDelta(directionDelta(scene.facing), PLAYER_JUMP_DISTANCE);
  const nx = scene.tileX + delta.x;
  const ny = scene.tileY + delta.y;
  if (!inBounds(scene.map, nx, ny)) return false; // 맵 밖으로는 뛰지 않는다(건너뛴다)
  scene.facing = facingForDelta(delta.x, delta.y, scene.facing);
  scene.dashing = false;
  beginPlayerStep(scene, nx, ny);
  scene.playerHop = { hop: jumpHop(command), elapsedFrames: 0, countsAsStep: true };
  return true;
}

/** 낙하 등장. 제자리에서 떨어지므로 걸음 부수효과(발소리·인카운터)를 만들지 않는다. */
function startPlayerDropIn(scene: PlaySceneContext, command: Extract<MoveCommand, { kind: "dropIn" }>): boolean {
  scene.playerHop = { hop: fallHop(command), elapsedFrames: 0, countsAsStep: false };
  return true;
}

function scaleDelta(delta: { x: number; y: number }, factor: number): { x: number; y: number } {
  return { x: delta.x * factor, y: delta.y * factor };
}

function startPlayerRouteStep(scene: PlaySceneContext, dir: Dir): boolean {
  scene.facing = dir;
  const delta = directionDelta(dir);
  const nx = scene.tileX + delta.x;
  const ny = scene.tileY + delta.y;
  const body = resolvePlayerBody(store.getCurrent(), scene.session);
  // 강제 이동 루트도 몸 크기를 존중한다 — 3x3 주인공이 커맨드로는 벽을 뚫으면 안 된다.
  if (!playerCanStep(scene, body, delta.x, delta.y)) return false; // 막히면 건너뜀
  // Force-move routes still respect same-as-characters solid events (RM2K3 character collision).
  const blockingEvent = findBlockingEventForPlayerBody(scene, body, nx, ny);
  if (blockingEvent) {
    firePlayerTouchEvent(scene, blockingEvent.event.id, blockingEvent.trigger.kind);
    return false;
  }
  scene.dashing = false;
  beginPlayerStep(scene, nx, ny);
  return true;
}

function rotatedFacing(dir: Dir, turn: "right90" | "left90" | "turn180" | "leftOrRight90"): Dir {
  const order: Dir[] = ["up", "right", "down", "left"];
  const index = order.indexOf(dir);
  if (index < 0) return dir;
  const step = turn === "left90" ? 3 : turn === "turn180" ? 2 : 1; // right90/leftOrRight90 → 우회전(결정적)
  return order[(index + step) % 4] ?? dir;
}

function clampPlayerMoveDuration(current: number, delta: number): number {
  // delta 양수 = 빠르게(이동 시간 단축). 대략 40ms 단위.
  return Math.min(400, Math.max(60, current - delta * 40));
}

// 반환값: 조사 대상과 상호작용했는지. 액션 전투에서 "조사 없으면 스윙" 판정에 쓴다.
export function handleAction(scene: ActionEventSceneContext, pushFurniture?: (event: RuntimeEventView) => boolean): boolean {
  // No allocation, counter or receipt on the normal shipped-player path.
  if (!scene.runtimeDom?.instrumented) return performAction(scene, pushFurniture);
  const farmAttempts: FarmInteractionResult[] = [];
  const mapId = scene.map.id;
  const handled = performAction(scene, pushFurniture, farmAttempts);
  scene.runtimeDom.recordAction({ kind: "action", mapId, handled, farmAttempts }, () => scene.syncRuntimeState?.());
  return handled;
}

function performAction(
  scene: ActionEventSceneContext,
  pushFurniture?: (event: RuntimeEventView) => boolean,
  farmAttempts?: FarmInteractionResult[],
): boolean {
  const world = { project: store.getCurrent(), map: scene.map, session: scene.session, positions: scene.eventPositions };
  if (world.session.horror?.hiding) { toggleHiding(world); scene.lastActionTargetKey = ""; return true; }
  const delta = directionDelta(scene.facing);
  const tx = scene.tileX + delta.x;
  const ty = scene.tileY + delta.y;
  const event = findRuntimeEventInScene(scene, tx, ty, "action");
  if (event) {
    if (event.page?.interaction?.kind === 'hiding') return toggleHiding(world, event);
    if (event.page?.interaction?.kind === 'pushable') {
      pushFurniture?.(event);
      return true;
    }
    // 같은 대상 연타 디바운스. 실행은 안 하지만 정면에 대상이 있는 건 맞으므로
    // 상호작용으로 보고한다(여기서 false 를 주면 대화 중에 칼을 휘두른다).
    //
    // 키는 **이벤트 단위**다. 타일 단위였을 때는 다중 타일 이벤트가 제자리 회전만으로
    // 재발동했다 — 3x3 NPC 앞에서 방향만 바꾸면 정면 칸(tx,ty)이 달라지지만 여전히 같은 몸을
    // 가리키므로, 타일 키로는 매번 새 대상으로 보였다. 1x1 에서는 대상 이벤트와 정면 칸이
    // 1:1 이라 동작이 같다(이동을 시작하면 어느 쪽이든 키가 비워진다).
    if (event.event.id === scene.lastActionTargetKey) return true;
    scene.lastActionTargetKey = event.event.id;
    turnActionEventTowardPlayer(scene, event);
    void scene.runEvent(event.event.id);
    return true;
  }
  if (tryChestInteraction(scene as any, tx, ty)) return true;
  if (attemptLifeInteraction(scene, tx, ty)) return true;
  const facingFarm = attemptFarmInteraction(scene, tx, ty, farmAttempts);
  if (facingFarm.handled) return true;
  // RM2K3 관례: 정면에 없으면 발밑(하위 우선순위) 액션 이벤트를 조사한다.
  // 바닥의 반짝임/문서처럼 플레이어가 올라선 채 조사하는 오브젝트가 여기 해당한다.
  const underfoot = findRuntimeEventInScene(scene, scene.tileX, scene.tileY, "action");
  if (underfoot) {
    if (underfoot.event.id === scene.lastActionTargetKey) return true;
    scene.lastActionTargetKey = underfoot.event.id;
    void scene.runEvent(underfoot.event.id);
    return true;
  }
  if (tryChestInteraction(scene as any, scene.tileX, scene.tileY)) return true;
  if (attemptLifeInteraction(scene, scene.tileX, scene.tileY)) return true;
  const underfootFarm = attemptFarmInteraction(scene, scene.tileX, scene.tileY, farmAttempts);
  if (underfootFarm.handled) return true;
  // 한 번의 A 입력에 안내 문구는 최대 하나. 정면과 발밑 두 번 시도하므로 여기서 한 번만 띄운다.
  // 발밑 사유를 우선하고(플레이어가 서 있는 밭이 더 구체적인 대상), 없으면 정면 사유로 대체한다.
  const message = underfootFarm.message ?? facingFarm.message;
  if (message) showFarmFeedbackMessage(scene, message);
  return false;
}

function attemptLifeInteraction(scene: ActionEventSceneContext, x: number, y: number): boolean {
  const result = interactWithLifeField(store.getCurrent(), scene.session, { mapId: scene.map.id, x, y });
  if (result.kind === "unhandled") return false;
  if (result.kind === "refused") showFarmFeedbackMessage(scene, result.message);
  else {
    scene.lastActionTargetKey = "";
    scene.refreshRuntimeSurfaces?.();
    scene.syncRuntimeState?.();
  }
  return true;
}

type FarmAttempt = { readonly handled: boolean; readonly message: string | null };

function attemptFarmInteraction(scene: ActionEventSceneContext, x: number, y: number, farmAttempts?: FarmInteractionResult[]): FarmAttempt {
  const project = store.getCurrent();
  const result = interactWithFarmPlot(
    project,
    scene.session,
    scene.map,
    x,
    y,
    farmIntentForHand(project, scene.session),
  );
  farmAttempts?.push(result);
  if (result.kind === "ignored") return { handled: false, message: farmIgnoreMessage(result.reason) };
  scene.lastActionTargetKey = "";
  scene.refreshRuntimeSurfaces?.();
  scene.syncRuntimeState?.();
  return { handled: true, message: null };
}

function turnActionEventTowardPlayer(scene: ActionEventSceneContext, event: RuntimeEventView): void {
  if (!canActionTurn(event.animationType)) return;
  const direction = directionTowardPlayer(scene, event);
  const mover = scene.autonomousNPCs.get(event.event.id);
  const frameDirection = mover ? applyFacing(mover, direction) : direction;
  setActionEventRuntimeDirection(scene, event, frameDirection);
  setNpcIdleFrame(
    scene.eventSprites.get(event.event.id),
    event.page?.graphic.pattern ?? 0,
    frameDirection,
    event.animationType,
    mover?.animationEnabled ?? true
  );
}

function canActionTurn(animationType: EventAnimationType): boolean {
  // 스펙 확인: 페이지 graphic에는 별도 directionFix 필드가 없고, 고정 방향은
  // fixedDirection 계열 animationType 및 Move Route의 setDirectionFix(mover.directionFix)로 표현된다.
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

/**
 * 조사당한 이벤트가 플레이어를 향해 돌 방향.
 *
 * 델타를 앵커에서 뽑으면 안 된다 — 발자국이 여러 칸이면 앵커는 최근접 칸이 아니다.
 * 2x2 앵커 (15,18) 의 발자국은 (15,17)(16,17)(15,18)(16,18) 이고, 플레이어가 (16,19)
 * 에서 (16,18) 을 조사하면 앵커 델타는 (1,1) 이 된다. facingForDelta 는 |dx| >= |dy|
 * 에서 가로를 우선하므로 "right" 가 나온다 — 플레이어가 정남향에 있는데 옆을 본다.
 * 히트테스트는 발자국 사각으로 올라갔으니 그 결과를 쓰는 이 계산도 사각을 봐야 한다.
 *
 * 1x1 에서는 사각이 그 칸 자신이라 클램프가 항등이고 기존 동작과 같다.
 */
function directionTowardPlayer(scene: ActionEventSceneContext, event: RuntimeEventView): Dir {
  const near = nearestCellInRect(
    footprintBounds(event.x, event.y, event.footprint),
    scene.tileX,
    scene.tileY
  );
  return facingForDelta(scene.tileX - near.x, scene.tileY - near.y, event.direction ?? "down");
}

function setActionEventRuntimeDirection(
  scene: ActionEventSceneContext,
  event: RuntimeEventView,
  direction: Dir
): void {
  const location = scene.session.eventLocations?.[event.event.id];
  if (location?.mapId === scene.session.currentMapId) {
    scene.session.eventLocations[event.event.id] = { ...location, direction };
    return;
  }
  setRuntimeEventPositionDirection(scene.eventPositions, event.event.id, direction);
}

function fireTouchTriggers(scene: PlaySceneContext): void {
  const event = findRuntimeEventInScene(scene, scene.tileX, scene.tileY, PLAYER_COLLISION_TRIGGER_KINDS);
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

/**
 * 주인공이 (dx,dy) 로 한 걸음 갈 수 있나 — **통행 사각**의 선행 모서리로 지형을 본다.
 * 자유 이동과 강제 이동 루트가 **같은 판정식**을 쓰도록 여기 한 곳에 둔다.
 *
 * 1x1 직교는 canMove 1회로 환원되고, 대각도 예전 식과 **같은 값**이 나온다(항등).
 * 예전 코드는 호출부에서 대각을 L자 2구간으로 손수 분해했는데, `resolveDiagonalStep` 이
 * 이미 첫 구간 두 개(H1·V1)를 따로 물어보므로 전체 조건은 `H1 && V1 && (H2 || V2)` 였다.
 * canMoveFootprint 의 대각은 `(H1 && H2) || (V1 && V2)` 이고 바깥 게이트가 `H1 && V1`
 * 이라, 합치면 `H1 && V1 && (H2 || V2)` — 같은 식이다. 분해가 두 곳에 있을 이유가 없다.
 */
export function playerCanStep(
  scene: Pick<PlaySceneContext, "map" | "tileX" | "tileY"> & Partial<Pick<PlaySceneContext, "session">>,
  body: PlayerBody,
  dx: number,
  dy: number
): boolean {
  const project = store.getCurrent();
  const toX = scene.tileX + dx;
  const toY = scene.tileY + dy;
  return canMoveFootprint(
    project,
    scene.map,
    scene.tileX,
    scene.tileY,
    body.footprint,
    toX,
    toY,
    body.passRows
  ) && (!scene.session || !isSpatialPlacementBlocking(
    project,
    scene.session,
    scene.map.id,
    playerPassageRect(body, toX, toY),
  ));
}

/**
 * 목적지에서 주인공의 **통행 사각**을 막는 이벤트. 1x1 이면 목적지 한 칸 질의와 같다(항등).
 *
 * 몸 사각이 아니라 통행 사각인 이유: passRows 로 열어 둔 상체 칸에는 NPC 가 실제로 들어와
 * 서 있을 수 있고(그게 사각을 둘로 쪼갠 목적이다), 그걸 막힘으로 세면 주인공이 자기 상체에
 * 갇힌다. 선행 모서리만 보지 않고 목적지 사각 전체를 보는 것은 워프 착지 검사
 * (resolveFootprintLanding)와 같은 판정을 쓰기 위한 것이고, 더 막는 쪽이 fail-closed 다.
 */
export function findBlockingEventForPlayerBody(
  scene: Pick<PlaySceneContext, "map" | "session" | "eventPositions">,
  body: PlayerBody,
  x: number,
  y: number
): RuntimeEventView | undefined {
  return findBlockingEventOverlappingRect(
    store.getCurrent(),
    scene.map,
    scene.session,
    scene.eventPositions,
    playerPassageRect(body, x, y)
  );
}

function firePlayerTouchEvent(scene: PlaySceneContext, eventId: string, triggerKind: Trigger["kind"]): void {
  if (firesOnPlayerCollision(triggerKind)) void scene.runEvent(eventId);
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

export function applyTerrainStepDamage(scene: PlaySceneContext): boolean {
  const terrain = terrainRecordAt(store.getCurrent(), { mapId: scene.map.id, x: scene.tileX, y: scene.tileY });
  const damage = terrain?.record.damage ?? 0;
  if (damage <= 0) return false;
  const result = applyTerrainWalkDamage(store.getCurrent(), scene.session, damage);
  if (result.applied <= 0) return false;
  if (result.defeated) applyBattleDefeat(scene, "지형 피해로 쓰러졌습니다.");
  return result.defeated;
}

export function maybeTriggerRandomEncounter(scene: PlaySceneContext): void {
  if (scene.running) return; // 이미 전투/이벤트 진행 중이면 무시
  const map = scene.map;
  const terrain = terrainRecordAt(store.getCurrent(), { mapId: map.id, x: scene.tileX, y: scene.tileY });
  const rate = scaledEncounterRate(map.encounterRate ?? 0, terrain?.record.encounterRatePercent);
  if (rate <= 0) return;
  // 액션 전투 맵에서는 랜덤 인카운트가 턴제 전투를 시작하지 않는다.
  // 누적값을 리셋해 맵을 나간 직후 남은 누적으로 즉시 전투가 터지지 않게 한다.
  if (isActionCombatMap(store.getCurrent(), map)) {
    encounterStepCounter = 0;
    encounterAccumulator = 0;
    return;
  }
  const position = { x: scene.tileX, y: scene.tileY };
  const hasCandidates = map.encounterTable && map.encounterTable.length > 0
    ? eligibleEncounterEntries(map, scene.session, position).length > 0
    : (map.troopIds?.length ?? 0) > 0;
  if (!hasCandidates) return;
  encounterStepCounter += 1;
  encounterAccumulator += rate;
  // 누적 가중치가 임계(1000)를 넘으면 인카운트 발생. 매 스텝마다 rate가 쌓여
  // 결국 발생하도록 보장(rate 클수록 빠름). 발생 시 카운터/누적값 리셋.
  if (!rollRandomEncounter(scene.session, encounterAccumulator)) return;
  encounterStepCounter = 0;
  encounterAccumulator = 0;
  const troopId = pickEncounterTroopForMap(map, scene.session, position);
  if (!troopId) return;
  // 전투 시작(비동기). 전투가 끝날 때까지 맵 로직·입력을 잠근다 — 잠그지 않으면 전투
  // 오버레이 뒤에서 걸음이 계속 완료되어 게이지가 쌓이고 전투가 겹쳐 시작된다.
  void runRandomEncounterBattle(scene, troopId);
}

// runFieldSpawnEventBattle(playSceneFieldSpawns.ts) 과 같은 재진입 가드 계약이다.
async function runRandomEncounterBattle(scene: PlaySceneContext, troopId: string): Promise<void> {
  const session = scene.session;
  const previousInputEnabled = scene.inputEnabled;
  scene.running = true;
  scene.setInputEnabled(false);
  try {
    // 결과를 버리면 안 된다: battleResult 는 페이지 조건·분기의 SSOT 이고, 랜덤 인카운터는
    // canLose=false 라 패배가 곧 게임 오버다(sceneTestRunner 의 인카운터 경로와 같은 계약).
    const result = await scene.playBattle({ kind: "battleProcessing", troopId, canEscape: true, canLose: false });
    if (result === null || scene.session !== session || scene.sys?.isActive() === false) return;
    session.battleResult = result;
    if (result === "defeat") applyBattleDefeat(scene);
  } finally {
    if (scene.session === session && !scene.battleAbortController && scene.sys?.isActive() !== false) {
      scene.running = false;
      scene.setInputEnabled(previousInputEnabled);
    }
  }
}

// 전투 후/맵 진입 시 스텝 카운터 리셋(외부에서 호출 가능).
export function resetEncounterCounter(): void {
  encounterStepCounter = 0;
  encounterAccumulator = 0;
}

export function rollRandomEncounter(
  session: PlaySceneContext["session"],
  accumulator: number
): boolean {
  return accumulator >= 1000 || nextSessionRandom(session, "encounter") * 1000 < accumulator;
}

export function pickRandomEncounterTroop(
  session: PlaySceneContext["session"],
  troops: readonly string[]
): string | undefined {
  return troops[Math.floor(nextSessionRandom(session, "encounter") * troops.length)] ?? troops[0];
}
