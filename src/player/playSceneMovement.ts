import { canMove } from "@/project/collision";
import { store } from "@/project/store";
import type { MoveCommand } from "@/project/types";
import { characterSpriteX, characterSpriteY, updateCharacterDepth } from "@/player/characterDepth";
import { applyFacing } from "@/player/playSceneAutonomousCommands";
import { facingForDelta } from "@/player/playSceneAutonomousRouteDirection";
import { setNpcIdleFrame } from "@/player/playSceneAutonomousSprites";
import type { AutonomousNpcSprite } from "@/player/playSceneAutonomousTypes";
import type { Dir, InputState } from "@/player/input";
import { facingForStep, resolveDiagonalStep } from "@/player/input";
import { assertNever, type PlaySceneContext } from "@/player/playSceneTypes";
import {
  findBlockingRuntimeEventAtInMap,
  findRuntimeEventAtInMap,
  setRuntimeEventPositionDirection,
} from "@/player/runtimeEventState";
import type { RuntimeEventView } from "@/player/runtimeEventState";
import type { EventAnimationType } from "@/project/types";
import { nextSessionRandom } from "@/project/session";

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
  if (!scene.moving) {
    // 주인공 강제 이동 루트가 있으면 입력보다 우선해 자동으로 걷는다.
    if (scene.playerRoute) advancePlayerRoute(scene);
    else if (input.x !== 0 || input.y !== 0) tryStartMove(scene, input);
  }
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
  // 메뉴뿐 아니라 엔딩/게임 오버 패널이 떠 있는 동안에도 맵 입력을 차단한다
  // (엔딩 화면 뒤에서 이동/조사로 이벤트가 재실행되는 것을 막는다).
  const root = playStage ?? canvas.ownerDocument;
  return root.querySelector("[data-testid='main-menu'], [data-testid='ending-screen'], [data-testid='game-over-screen']") !== null;
}

function canUpdateWaitingEvents(scene: PlaySceneContext): boolean {
  return !scene.running || scene.session.messageWindowSettings?.allowEventMovementDuringWait === true;
}

// 대시 배속(RM2K3 관례: 걷기 대비 약 1.8배). 이동 소요시간과 걷기 프레임
// 주기를 같은 비율로 단축해 애니메이션이 자연스럽게 빨라진다.
const DASH_SPEED_FACTOR = 1.8;
const WALK_FRAME_MS = 90;

function updatePlayerMovement(scene: PlaySceneContext, deltaMs: number): void {
  const dashFactor = scene.dashing ? DASH_SPEED_FACTOR : 1;
  const moveDurationMs = scene.moveDurationMs / dashFactor;
  scene.moveProgress += deltaMs / moveDurationMs;
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
  if (scene.walkTimer > WALK_FRAME_MS / dashFactor) {
    scene.walkTimer = 0;
    scene.walkFrame = (scene.walkFrame + 1) % scene.playerSprite.walkFrameCount;
  }
  scene.player.setFrame(scene.playerSprite.walkFrameFor(scene.facing, scene.walkFrame));
}

function tryStartMove(scene: PlaySceneContext, input: InputState): void {
  const project = store.getCurrent();
  // 현재 칸에서 직교 한 칸 통행 가능 여부(대각선은 두 직교로 분해해 판정).
  const canStep = (dx: number, dy: number): boolean =>
    canMove(project, scene.map, scene.tileX, scene.tileY, scene.tileX + dx, scene.tileY + dy);
  const step = resolveDiagonalStep(input.x, input.y, canStep);
  if (!step) {
    // 벽을 향해도 그 방향으로 몸은 돌린다(제자리 방향 전환).
    if (input.dir) scene.facing = input.dir;
    return;
  }
  scene.facing = facingForStep(step.dx, step.dy);
  const nx = scene.tileX + step.dx;
  const ny = scene.tileY + step.dy;
  const blockingEvent = findBlockingRuntimeEventInScene(scene, nx, ny);
  if (blockingEvent) {
    firePlayerTouchEvent(scene, blockingEvent.event.id, blockingEvent.trigger.kind);
    return;
  }
  scene.dashing = input.dash;
  scene.movingFrom = { x: scene.tileX, y: scene.tileY };
  scene.movingTo = { x: nx, y: ny };
  scene.moving = true;
  scene.moveProgress = 0;
  scene.walkFrame = 0;
  scene.walkTimer = 0;
  scene.lastActionTargetKey = "";
}

// ── 주인공 강제 이동 루트(이동 루트 설정 → 주인공) ──
// moveEvent 명령이 주인공을 대상으로 하면 이동 단계를 큐에 넣고, 주인공이 정지할 때마다
// 다음 단계를 자연스러운 걷기로 실행한다. 장소 이동(transfer)과 달리 한 칸씩 이동한다.
export function startPlayerRoute(scene: PlaySceneContext, moves: readonly MoveCommand[], repeat: boolean): void {
  if (moves.length === 0) {
    scene.playerRoute = null;
    return;
  }
  scene.playerRoute = { moves: [...moves], index: 0, repeat };
}

function advancePlayerRoute(scene: PlaySceneContext): void {
  // 이동을 시작하지 않는 명령(회전/스위치 등)은 같은 프레임에 연속 소비한다.
  // repeat + 이동 없는 루트의 프레임당 무한 루프를 막기 위해 상한을 둔다.
  let guard = 0;
  while (scene.playerRoute && !scene.moving && guard < 64) {
    guard += 1;
    const route = scene.playerRoute;
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
  }
}

// 이동을 시작하면 true(이번 프레임 종료), 아니면 false(다음 명령 계속).
function applyPlayerRouteCommand(scene: PlaySceneContext, command: MoveCommand): boolean {
  switch (command.kind) {
    case "move":
      return startPlayerRouteStep(scene, command.dir);
    case "stepForward":
      return startPlayerRouteStep(scene, scene.facing);
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
    // 주인공에게 의미 없거나 MVP 범위 밖(jump/그래픽/투명도/NPC상대 이동 등) → 조용히 건너뛴다.
    default:
      return false;
  }
}

function startPlayerRouteStep(scene: PlaySceneContext, dir: Dir): boolean {
  scene.facing = dir;
  const delta = directionDelta(dir);
  const nx = scene.tileX + delta.x;
  const ny = scene.tileY + delta.y;
  if (!canMove(store.getCurrent(), scene.map, scene.tileX, scene.tileY, nx, ny)) return false; // 막히면 건너뜀
  scene.dashing = false;
  scene.movingFrom = { x: scene.tileX, y: scene.tileY };
  scene.movingTo = { x: nx, y: ny };
  scene.moving = true;
  scene.moveProgress = 0;
  scene.walkFrame = 0;
  scene.walkTimer = 0;
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
    return;
  }
  // RM2K3 관례: 정면에 없으면 발밑(하위 우선순위) 액션 이벤트를 조사한다.
  // 바닥의 반짝임/문서처럼 플레이어가 올라선 채 조사하는 오브젝트가 여기 해당한다.
  const underfoot = findRuntimeEventInScene(scene, scene.tileX, scene.tileY, "action");
  if (underfoot) void scene.runEvent(underfoot.event.id);
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

function directionTowardPlayer(scene: ActionEventSceneContext, event: RuntimeEventView): Dir {
  return facingForDelta(scene.tileX - event.x, scene.tileY - event.y, event.direction ?? "down");
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
  if (!rollRandomEncounter(scene.session, encounterAccumulator)) return;
  encounterStepCounter = 0;
  encounterAccumulator = 0;
  const troopId = pickRandomEncounterTroop(scene.session, troops);
  if (!troopId) return;
  // 전투 시작(비동기). scene.running 가드로 재진입 방지.
  void scene.playBattle({ kind: "battleProcessing", troopId, canEscape: true, canLose: false });
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
