import { store } from "@/project/store";
// 스프라이트 가로 좌표는 발자국 중앙(footprintSpriteX)이다 — 타일 중앙(characterSpriteX)을
// 쓰면 폭 2 이상인 몸이 반 칸 왼쪽으로 붙는다. 걸음 보간·착지·첫 프레임 모두 같은 규칙이다.
import { characterSpriteY, footprintSpriteX, updateCharacterDepth } from "@/player/characterDepth";
import { UNIT_FOOTPRINT } from "@/project/footprint";
import { abortHop, applyHopFrame, finishHop } from "@/player/characterHopRuntime";
import type { AutonomousMover } from "@/player/playSceneTypes";
import {
  applyFacing,
  executeInstantCommand,
  movementDeltaForCommand,
  nextMoveCommandForScene,
} from "@/player/playSceneAutonomousCommands";
import { canNpcMove, isPlayerOccupyingTile } from "@/player/playSceneAutonomousMapActions";
import { applySpriteAlpha, setNpcIdleFrame, setNpcWalkFrame } from "@/player/playSceneAutonomousSprites";
import { nextChaseDecision } from "@/player/chaseAi";
import type { AutonomousNpcSceneContext } from "@/player/playSceneAutonomousTypes";
import { moveRuntimeEventPosition,
runtimeEventView,
runtimeEventViewById, } from "@/project/runtimeEventState"

export function updateAutonomousNPCs(scene: AutonomousNpcSceneContext, deltaMs: number): void {
  const project = store.getCurrent();
  for (const [eventId, mover] of scene.autonomousNPCs) {
    if (mover.activeMove) {
      updateActiveNpcMove({ scene, eventId, mover }, deltaMs);
      continue;
    }
    if (mover.strategy === "chase") {
      updateChaseNpc(scene, eventId, mover, deltaMs);
      continue;
    }
    if (mover.moves.length === 0) {
      if (scene.commandMoveRouteEventIds?.delete(eventId)) scene.autonomousNPCs.delete(eventId);
      continue;
    }
    mover.timer += Math.max(0, deltaMs);
    if (mover.timer < mover.moveIntervalMs) continue;
    mover.timer = 0;
    const view = runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, eventId);
    if (!view) {
      completeRouteCommand(mover);
      continue;
    }
    const command = nextMoveCommandForScene(scene, mover);
    mover.step += 1;
    const baseFrame = view.page?.graphic.pattern ?? 0;
    const sprite = scene.eventSprites.get(eventId);
    const routeContext = { scene, eventId, mover };
    const commandTarget = { mover, view, baseFrame, sprite };
    if (executeInstantCommand(routeContext, commandTarget, command)) {
      completeRouteCommand(mover);
      continue;
    }

    const movement = movementDeltaForCommand(routeContext, command);
    if (!movement) {
      completeRouteCommand(mover);
      continue;
    }
    const position = { x: view.x, y: view.y };
    const nx = position.x + movement.x;
    const ny = position.y + movement.y;
    const frameDir = applyFacing(mover, movement.face);
    // eventTouch fires when the event tries to step onto the player (including mid-move destination).
    if (!movement.jump && !mover.through && isPlayerOccupyingTile(scene, nx, ny)) {
      fireEventTouch(scene, eventId, view.trigger.kind);
      setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
      retryBlockedStep(mover);
      completeRouteCommand(mover);
      continue;
    }
    if (canNpcMove({ project, scene, mover, eventId, from: position, to: { x: nx, y: ny } }, movement)) {
      mover.blockedSteps = 0;
      moveAutonomousRuntimePosition(scene, eventId, nx, ny, frameDir);
      mover.activeMove = {
        fromX: position.x,
        fromY: position.y,
        toX: nx,
        toY: ny,
        dir: frameDir,
        baseFrame,
        elapsedMs: 0,
        hop: movement.hop,
        durationMs: movement.hop?.durationMs,
      };
      if (sprite) {
        const startX = footprintSpriteX(position.x, view.footprint);
        const startY = characterSpriteY(position.y);
        sprite.setPosition(startX, startY);
        updateCharacterDepth(sprite, view.priority);
        applySpriteAlpha(sprite, mover.opacity);
        // 체공은 첫 프레임부터 정지 프레임으로 간다 — 이륙 프레임만 걸음이면 한 칸 깜빡인다.
        if (movement.hop) {
          setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
          applyHopFrame(scene, eventId, sprite, startX, startY, movement.hop, 0);
        } else {
          setNpcWalkFrame(sprite, baseFrame, frameDir, 0, view.animationType, mover.animationEnabled);
        }
      }
      scene.runtimeDom.upsertEventMarker(runtimeEventView(view.event, scene.session, scene.eventPositions));
    } else {
      setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
      retryBlockedStep(mover);
    }
    completeRouteCommand(mover);
  }
}

function updateChaseNpc(
  scene: AutonomousNpcSceneContext,
  eventId: string,
  mover: AutonomousMover,
  deltaMs: number
): void {
  const project = store.getCurrent();
  const view = runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, eventId);
  if (!view) return;
  const baseFrame = view.page?.graphic.pattern ?? 0;
  const sprite = scene.eventSprites.get(eventId);
  if (mover.actionFrozen) {
    setNpcIdleFrame(sprite, baseFrame, mover.facing, view.animationType, mover.animationEnabled);
    return;
  }
  const pursuit = mover.chaseTarget ?? { x: scene.tileX, y: scene.tileY };
  const decision = nextChaseDecision({
    project,
    map: scene.map,
    from: { x: view.x, y: view.y },
    player: pursuit,
    deltaMs,
    mover,
    sightRange: mover.sightRange,
    giveUpRange: mover.giveUpRange,
    pathfind: mover.pathfind,
    kite: mover.kite,
    // 추격자 자신의 통행 사각. 1x1 이면 canMove 1회로 환원돼 기존 경로와 같다.
    pass: { footprint: view.footprint, passRows: view.passRows },
  });
  if (decision.kind === "wait") {
    setNpcIdleFrame(sprite, baseFrame, mover.facing, view.animationType, mover.animationEnabled);
    return;
  }
  const frameDir = applyFacing(mover, decision.dir);
  if (decision.kind === "touch") {
    // NPC 를 추겁하는 중이면 접촉은 이벤트 트리거가 아니다 —
    // 진영 전투의 피해는 액션 전투 상태기가 예고된 공격으로만 주므로 그자리에 선다.
    if (mover.chaseTarget) {
      setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
      return;
    }
    fireEventTouch(scene, eventId, view.trigger.kind);
    setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
    return;
  }
  // Chase pathfinding only sees the player's committed tile. Mid-move destination still blocks.
  if (!mover.through && isPlayerOccupyingTile(scene, decision.x, decision.y)) {
    fireEventTouch(scene, eventId, view.trigger.kind);
    setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
    return;
  }
  // 좀비 군집: 일반 자율 이동과 동일한 점유 규칙을 적용한다. 목적지가 다른 이벤트에
  // 점유되어 있으면 이번 틱은 대기 — 추적 결정은 순차 처리되고 목적지는 즉시 커밋되므로
  // 같은 칸으로 몰려 겹치는(stacking) 현상이 방지된다.
  if (
    !canNpcMove(
      { project, scene, mover, eventId, from: { x: view.x, y: view.y }, to: { x: decision.x, y: decision.y } },
      { x: decision.x - view.x, y: decision.y - view.y, face: frameDir }
    )
  ) {
    setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
    return;
  }
  moveAutonomousRuntimePosition(scene, eventId, decision.x, decision.y, frameDir);
  mover.activeMove = { fromX: view.x, fromY: view.y, toX: decision.x, toY: decision.y, dir: frameDir, baseFrame, elapsedMs: 0 };
  if (sprite) {
    sprite.setPosition(footprintSpriteX(view.x, view.footprint), characterSpriteY(view.y));
    updateCharacterDepth(sprite, view.priority);
    applySpriteAlpha(sprite, mover.opacity);
    setNpcWalkFrame(sprite, baseFrame, frameDir, 0, view.animationType, mover.animationEnabled);
  }
  scene.runtimeDom.upsertEventMarker(runtimeEventView(view.event, scene.session, scene.eventPositions));
}

function moveAutonomousRuntimePosition(
  scene: AutonomousNpcSceneContext,
  eventId: string,
  x: number,
  y: number,
  direction: AutonomousMover["facing"]
): void {
  const location = scene.session.eventLocations?.[eventId];
  if (location?.mapId === scene.map.id) {
    scene.session.eventLocations[eventId] = { ...location, x, y, direction };
    return;
  }
  moveRuntimeEventPosition(scene.eventPositions, eventId, x, y, direction);
}

function fireEventTouch(scene: AutonomousNpcSceneContext, eventId: string, triggerKind: string): void {
  if (triggerKind === "eventTouch") void scene.runEvent(eventId);
}

type ActiveNpcMoveTarget = {
  readonly scene: AutonomousNpcSceneContext;
  readonly eventId: string;
  readonly mover: AutonomousMover;
};

function updateActiveNpcMove(target: ActiveNpcMoveTarget, deltaMs: number): void {
  const { scene, eventId, mover } = target;
  const move = mover.activeMove;
  if (!move) return;
  // 점프·낙하는 이동 속도와 별개의 자기 지속 시간을 갖는다(저작 durationMs).
  const durationMs = Math.max(1, move.durationMs ?? mover.moveDurationMs);
  move.elapsedMs = Math.min(durationMs, move.elapsedMs + Math.max(0, deltaMs));
  const progress = move.elapsedMs / durationMs;
  const sprite = scene.eventSprites.get(eventId);
  const view = runtimeEventViewById(store.getCurrent(), scene.map, scene.session, scene.eventPositions, eventId);
  const animationType = view?.animationType ?? "normal";
  const priority = view?.priority ?? "same";
  const hop = move.hop;
  // 뷰를 못 찾으면 1x1 — footprintSpriteX 는 그때 타일 중앙과 같은 값이 된다.
  // 보간과 착지 두 곳이 같은 값을 써야 하므로 함수 스코프에 둔다.
  const footprint = view?.footprint ?? UNIT_FOOTPRINT;
  if (sprite) {
    const groundX = footprintSpriteX(lerp(move.fromX, move.toX, progress), footprint);
    const groundY = characterSpriteY(lerp(move.fromY, move.toY, progress));
    sprite.setPosition(groundX, groundY);
    updateCharacterDepth(sprite, priority);
    applySpriteAlpha(sprite, mover.opacity);
    // 체공 중에는 걸음을 돌리지 않는다 — 공중에서 발을 젓는 모양이 된다.
    if (hop) setNpcIdleFrame(sprite, move.baseFrame, move.dir, animationType, mover.animationEnabled);
    else setNpcWalkFrame(sprite, move.baseFrame, move.dir, move.elapsedMs, animationType, mover.animationEnabled);
    // 리프트는 프레임 갱신 뒤에 — setFrame 이 원점을 되돌린다(characterHop.ts 계약).
    if (hop) applyHopFrame(scene, eventId, sprite, groundX, groundY, hop, progress);
  }
  if (move.elapsedMs < durationMs) return;
  if (sprite) {
    const landX = footprintSpriteX(move.toX, footprint);
    const landY = characterSpriteY(move.toY);
    sprite.setPosition(landX, landY);
    updateCharacterDepth(sprite, priority);
    applySpriteAlpha(sprite, mover.opacity);
    setNpcIdleFrame(sprite, move.baseFrame, move.dir, animationType, mover.animationEnabled);
    if (hop) finishHop(scene, eventId, sprite, landX, landY, hop);
  } else if (hop) {
    // 체공 중에 스프라이트가 사라졌다(맵 재렌더/이벤트 소거). 그림자만 남기면 고아가 된다.
    abortHop(scene, eventId, undefined);
  }
  mover.activeMove = null;
  mover.timer = 0;
  scene.syncRuntimeState?.();
}

function completeRouteCommand(mover: AutonomousMover): void {
  if (!mover.repeat && mover.step >= mover.moves.length) mover.moves = [];
}

/** 같은 걸음을 다시 시도할 최대 횟수. 시간표 무버의 걸음 간격 80ms 로 약 0.6초다. */
const MAX_BLOCKED_STEP_RETRIES = 8;

/**
 * 이동하지 못한 걸음을 되돌려 다음 간격에 같은 걸음을 다시 시도하게 한다.
 *
 * 왜: **계산된** 순서 경로는 절대 방향 배열이다(npcSchedules §configureScheduleMover,
 * npcLivingTravel §livingRoute). 막힌 걸음을 그대로 소비하면 남은 계획 전부가 실제 위치와
 * 한 칸 어긋난 계획이 되고, 시간표 재계획은 무버가 살아 있는 동안 막혀 있어(npcSchedules 의
 * routeKey 조기 반환) 배열이 소진될 때까지 — 걸음당 400ms — 주민이 경로를 벗어나 걷는다.
 *
 * 작가가 쓴 경로는 대상이 아니다 — playSceneTypes §retryBlockedSteps.
 *
 * 한계를 두는 이유: 영구히 막힌 자리에서 무버가 멈춘 채 남으면 재계획 자체가 안 일어난다.
 * 한계를 넘으면 예전처럼 소비해 계획이 소진되고 시간표가 다시 계획한다. 반복(repeat)
 * 경로는 moves 를 비울 수 없으므로 포기 대신 소비로 푼다.
 */
function retryBlockedStep(mover: AutonomousMover): void {
  if (mover.retryBlockedSteps !== true) return;
  const attempts = (mover.blockedSteps ?? 0) + 1;
  if (attempts > MAX_BLOCKED_STEP_RETRIES) {
    mover.blockedSteps = 0;
    return;
  }
  mover.blockedSteps = attempts;
  mover.step -= 1;
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}
