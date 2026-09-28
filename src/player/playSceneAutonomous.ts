import { mapTileSize } from "@/project/tileGeometry";
import { actionFieldSlow } from "./actionFieldSlow";
import { isDetectionEmoting } from "./npcDetectionEncounter";
import { pursuitTarget } from "./horrorRuntime";
import { pursuitPass } from "./pursuitNavigation";
import { canMoveFootprint } from "@/project/collision";
import { isSpatialPlacementBlocking } from "@/project/spatialOccupancy";
import { yieldingLivingMovers, routeForLivingMovement } from "@/player/npcLivingTravel";
import { passageBounds, rectsOverlap } from "@/project/footprint";
import { playerPassageRect, resolvePlayerBody } from "@/project/playerFootprint";
import { findBlockingEventOverlappingRect, createBlockingEventQuery, invalidateEventIdIndexPass, withEventIdIndexPass } from "@/project/runtimeEventState";
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

export function updateAutonomousNPCs(scene: AutonomousNpcSceneContext, frameDeltaMs: number): void {
  // NPC 마다 자기 뷰를 id 로 1~3번 찾는다. 이 동기 루프 동안만 id 색인을 쓴다(runtimeEventState §withEventIdIndexPass).
  withChaseRepathBudget(scene, () => withEventIdIndexPass(() => updateAutonomousNPCsInPass(scene, frameDeltaMs)));
}

function updateAutonomousNPCsInPass(scene: AutonomousNpcSceneContext, frameDeltaMs: number): void {
  const project = store.getCurrent();
  const repathCandidates: LivingRepathCandidate[] = [];
  for (const [eventId, mover] of scene.autonomousNPCs) {
    const deltaMs = frameDeltaMs * (actionFieldSlow.get(mover) ?? 1);
    if (mover.livingRepathCooldownMs) mover.livingRepathCooldownMs = Math.max(0, mover.livingRepathCooldownMs - Math.max(0, deltaMs));
    if (isDetectionEmoting(scene, eventId)) continue;
    if (scene.running && scene.session.messageWindowSettings?.allowEventMovementDuringWait !== true
      && !scene.commandMoveRouteEventIds?.has(eventId)) continue;
    if (mover.activeMove) {
      if (mover.strategy === "chase" && !mover.chaseTarget && !mover.actionFrozen) {
        const view = runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, eventId);
        if (view) pursuitTarget({ project, map: scene.map, session: scene.session, positions: scene.eventPositions }, view, mover, deltaMs);
      }
      updateActiveNpcMove({ scene, eventId, mover }, deltaMs);
      continue;
    }
    if (mover.strategy === "chase") {
      updateChaseNpc(scene, eventId, mover, deltaMs);
      continue;
    }
    if (yieldingLivingMovers.has(mover) && mover.step >= mover.moves.length) {
      if ((mover.livingRepathCooldownMs ?? 0) <= 0) {
        const view = runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, eventId);
        if (view) repathCandidates.push({ mover, view, nx: view.x, ny: view.y });
      }
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
      livingBlockers.delete(mover);
      fireEventTouch(scene, eventId, view.trigger.kind);
      setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
      if (mover.stopOnBlocked) {
        scene.autonomousNPCs.delete(eventId);
        scene.commandMoveRouteEventIds?.delete(eventId);
        continue;
      }
      retryBlockedStep(mover);
      // 대피 걸음을 플레이어가 막았다. 생활 막힘 경로(아래 else)로 가지 않으므로 여기서 재선택 줄에 세운다 —
      // 안 그러면 대피 칸만 영원히 다시 시도했다(리뷰 반례). 쿨다운·프레임 예산은 그대로 따른다.
      if (yieldingLivingMovers.has(mover) && (mover.livingRepathCooldownMs ?? 0) <= 0) {
        repathCandidates.push({ mover, view, nx, ny });
      }
      completeRouteCommand(mover);
      continue;
    }
    if (canNpcMove({ project, scene, mover, eventId, from: position, to: { x: nx, y: ny } }, movement)) {
      mover.blockedSteps = 0;
      livingBlockers.delete(mover);
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
        const startX = footprintSpriteX(position.x, view.footprint, mapTileSize(scene.map));
        const startY = characterSpriteY(position.y, mapTileSize(scene.map));
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
      scene.runtimeDom.upsertEventMarker(runtimeEventView(view.event, scene.session, scene.eventPositions), undefined, mapTileSize(scene.map));
    } else {
      setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
      if (mover.stopOnBlocked) {
        scene.autonomousNPCs.delete(eventId);
        scene.commandMoveRouteEventIds?.delete(eventId);
        continue;
      }
      retryBlockedStep(mover);
      if (mover.livingRoute) {
        const blocker = findBlockingEventOverlappingRect(project, scene.map, scene.session, scene.eventPositions,
          passageBounds(nx, ny, view.footprint, view.passRows), eventId);
        const old = livingBlockers.get(mover);
        if (blocker) livingBlockers.set(mover, { id: blocker.event.id, count: old?.id === blocker.event.id ? old.count + 1 : 1 });
        else livingBlockers.delete(mover);
      }
      if (mover.livingRoute && !scene.commandMoveRouteEventIds?.has(eventId)
        && (mover.blockedSteps ?? 0) >= MAX_BLOCKED_STEP_RETRIES && (mover.livingRepathCooldownMs ?? 0) <= 0) {
        repathCandidates.push({ mover, view, nx, ny });
      }
    }
    completeRouteCommand(mover);
  }
  runLivingRepaths(scene, repathCandidates);
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
  const tracked = mover.chaseTarget ? undefined : pursuitTarget({ project, map: scene.map, session: scene.session, positions: scene.eventPositions }, view, mover, deltaMs);
  if (tracked === null) {
    setNpcIdleFrame(sprite, baseFrame, mover.facing, view.animationType, mover.animationEnabled);
    return;
  }
  const pursuit = mover.chaseTarget ?? tracked ?? { x: scene.tileX, y: scene.tileY };
  const targetEvent = mover.chaseTarget
    ? findBlockingEventOverlappingRect(project, scene.map, scene.session, scene.eventPositions,
      { left: pursuit.x, right: pursuit.x, top: pursuit.y, bottom: pursuit.y }, eventId)
    : undefined;
  let decision = nextChaseDecision({
    project,
    map: scene.map,
    from: { x: view.x, y: view.y },
    player: pursuit,
    deltaMs,
    mover,
    sightRange: tracked ? undefined : mover.sightRange,
    giveUpRange: tracked ? undefined : mover.giveUpRange,
    pathfind: mover.pathfind,
    kite: mover.kite,
    requestRepath: () => requestChaseRepath(scene, mover),
    pass: pursuitPass({ project, map: scene.map, session: scene.session, positions: scene.eventPositions }, view, targetEvent?.event.id),
  });
  if (tracked?.searching && decision.kind === "touch" && (pursuit.x !== scene.tileX || pursuit.y !== scene.tileY)) {
    decision = { kind: "move", x: pursuit.x, y: pursuit.y, dir: decision.dir };
  }
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
    if (!tracked?.searching) fireEventTouch(scene, eventId, view.trigger.kind);
    setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
    return;
  }
  // Touch uses the same passage rectangles as feet collision, including the player's reserved destination.
  const nextRect = passageBounds(decision.x, decision.y, view.footprint, view.passRows);
  const playerBody = resolvePlayerBody(project, scene.session);
  const touchesPlayer = rectsOverlap(nextRect, playerPassageRect(playerBody, scene.tileX, scene.tileY))
    || (scene.moving === true && scene.movingTo !== undefined
      && rectsOverlap(nextRect, playerPassageRect(playerBody, scene.movingTo.x, scene.movingTo.y)));
  if (!mover.through && touchesPlayer) {
    if (!mover.chaseTarget && !mover.kite && !tracked?.searching) fireEventTouch(scene, eventId, view.trigger.kind);
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
    sprite.setPosition(footprintSpriteX(view.x, view.footprint, mapTileSize(scene.map)), characterSpriteY(view.y, mapTileSize(scene.map)));
    updateCharacterDepth(sprite, view.priority);
    applySpriteAlpha(sprite, mover.opacity);
    setNpcWalkFrame(sprite, baseFrame, frameDir, 0, view.animationType, mover.animationEnabled);
  }
  scene.runtimeDom.upsertEventMarker(runtimeEventView(view.event, scene.session, scene.eventPositions), undefined, mapTileSize(scene.map));
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
  if (triggerKind !== "eventTouch") return;
  // 이벤트 실행은 첫 대기까지 동기로 돌아 맵 이벤트 배열을 바꿀 수 있다(소환·제거) — 조회 색인을 버린다.
  invalidateEventIdIndexPass();
  void scene.runEvent(eventId);
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
    const groundX = footprintSpriteX(lerp(move.fromX, move.toX, progress), footprint, mapTileSize(scene.map));
    const groundY = characterSpriteY(lerp(move.fromY, move.toY, progress), mapTileSize(scene.map));
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
    const landX = footprintSpriteX(move.toX, footprint, mapTileSize(scene.map));
    const landY = characterSpriteY(move.toY, mapTileSize(scene.map));
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
 * 생활 페이지는 걸음을 보존하고 이벤트 막힘에만 쿨다운 재탐색한다. 시간표는
 * 한계를 넘으면 예전처럼 소비해 계획이 소진되고 시간표가 다시 계획한다. 반복(repeat)
 * 경로는 moves 를 비울 수 없으므로 포기 대신 소비로 푼다.
 */
function retryBlockedStep(mover: AutonomousMover): void {
  if (mover.retryBlockedSteps !== true) return;
  const attempts = (mover.blockedSteps ?? 0) + 1;
  if (!mover.livingRoute && attempts > MAX_BLOCKED_STEP_RETRIES) {
    mover.blockedSteps = 0;
    return;
  }
  mover.blockedSteps = Math.min(attempts, MAX_BLOCKED_STEP_RETRIES);
  mover.step -= 1;
}

/**
 * 한 프레임에 재탐색할 수 있는 NPC 수. 여러 주민이 같은 순간 막히면(행렬·좁은 문) 쿨다운만으로는 전원이
 * 같은 프레임에 BFS 를 돌려 프레임이 주기적으로 멈췄다(리뷰 반례: 100×100, 20명 108ms · 50명 220ms).
 * 예산을 못 받은 NPC 는 쿨다운을 쓰지 않고 다음 프레임에 다시 줄을 선다.
 */
const LIVING_REPATH_BUDGET_PER_FRAME = 2;

type LivingRepathCandidate = {
  readonly mover: AutonomousMover;
  readonly view: Parameters<typeof routeForLivingMovement>[0]["view"];
  readonly nx: number;
  readonly ny: number;
};

/** 재탐색 차례. 가장 오래 기다린(마지막 재탐색이 가장 오래된) NPC 부터 — 맵 순회 순서에 묶이면 우회 불가로 계속 실패하는
 * 앞쪽 NPC 가 쿨다운이 풀릴 때마다 예산을 먹어 뒤쪽은 영영 차례가 오지 않았다(리뷰 반례: 20명·간격 1초). */
let livingRepathTurn = 0;

function runLivingRepaths(scene: AutonomousNpcSceneContext, candidates: LivingRepathCandidate[]): void {
  if (candidates.length === 0) return;
  candidates.sort((a, b) => (a.mover.livingRepathTurn ?? -1) - (b.mover.livingRepathTurn ?? -1));
  for (let index = 0; index < candidates.length && index < LIVING_REPATH_BUDGET_PER_FRAME; index += 1) {
    const { mover, view, nx, ny } = candidates[index]!;
    livingRepathTurn += 1;
    mover.livingRepathTurn = livingRepathTurn;
    repathBlockedLivingNpc(scene, mover, view, nx, ny);
  }
}

/** 남은 걸음을 따라간 끝 칸(이 맵 안). 맵 이동 걸음은 좌표를 바꾸지 않는다. */
function plannedEndPoint(mover: AutonomousMover, x: number, y: number): { x: number; y: number } {
  let endX = x;
  let endY = y;
  for (let index = Math.max(0, mover.step); index < mover.moves.length; index += 1) {
    const move = mover.moves[index]!;
    if (move.kind !== "move") continue;
    if (move.dir === "left") endX -= 1;
    else if (move.dir === "right") endX += 1;
    else if (move.dir === "up") endY -= 1;
    else if (move.dir === "down") endY += 1;
  }
  return { x: endX, y: endY };
}

/** 8회 연속 막힘 이후에만, NPC당 최대 1초에 한 번, 프레임당 최대 2명(runLivingRepaths). 일반 이동/표면 갱신에는 BFS가 없다. */
const livingBlockers = new WeakMap<AutonomousMover, { id: string; count: number }>();
type LivingView = LivingRepathCandidate["view"];
const livingYields = new WeakMap<AutonomousMover, { ids: string[]; x: number; y: number }>();
const yieldDirections = [
  { dir: "up" as const, x: 0, y: -1 }, { dir: "down" as const, x: 0, y: 1 },
  { dir: "left" as const, x: -1, y: 0 }, { dir: "right" as const, x: 1, y: 0 },
];

/** Only called inside the blocked-event cooldown/budget. Edges are observed failures. */
function blockedLivingGroup(scene: AutonomousNpcSceneContext, id: string): string[] {
  const edges = new Map<string, string>();
  for (const [key, mover] of scene.autonomousNPCs) {
    const edge = livingBlockers.get(mover);
    if (mover.livingRoute && !mover.activeMove && !scene.commandMoveRouteEventIds?.has(key)
      && edge && edge.count >= MAX_BLOCKED_STEP_RETRIES) edges.set(key, edge.id);
  }
  const group = new Set([id]);
  let overflow = false;
  for (let changed = true; changed && !overflow;) {
    changed = false;
    for (const [from, to] of edges) if (edges.has(to) && (group.has(from) || group.has(to))) {
      if (!group.has(from) || !group.has(to)) changed = true;
      group.add(from); group.add(to);
      if (group.size > 32) { overflow = true; break; }
    }
  }
  // 33명 이상이 엮이면 전체 그룹을 보지 않고 서로 막은 두 명만 푼다(예전 쌍 양보와 같은 범위).
  // 비용 상한이 양보 자체를 끄면 예전에 풀리던 긴 줄이 영원히 선다(적대 리뷰 반례: 33명 0/33 도착).
  if (overflow) {
    const peer = edges.get(id);
    group.clear();
    if (peer !== undefined && edges.get(peer) === id) { group.add(id); group.add(peer); }
  }
  if (group.size < 2) return [];
  // A fixed event is a terminal, not a deadlock cycle.
  const seen = new Set<string>();
  let cursor: string | undefined = id;
  while (cursor && !seen.has(cursor)) { seen.add(cursor); cursor = edges.get(cursor); }
  if (!cursor) return [];
  if ([...group].some(key => yieldingLivingMovers.has(scene.autonomousNPCs.get(key)!))) return [];
  return [...group];
}

function remainingPassage(scene: AutonomousNpcSceneContext, ids: string[]) {
  const rects: ReturnType<typeof passageBounds>[] = [];
  for (const id of ids) {
    const peer = runtimeEventViewById(store.getCurrent(), scene.map, scene.session, scene.eventPositions, id);
    if (!peer || peer.priority !== "same" || !peer.overlapForbidden) continue;
    let x = peer.x, y = peer.y;
    rects.push(passageBounds(x, y, peer.footprint, peer.passRows));
    const mover = scene.autonomousNPCs.get(id);
    if (!mover) continue;
    for (const move of mover.moves.slice(mover.step)) {
      if (move.kind === "npcTransfer") break;
      if (move.kind !== "move") continue;
      const d = yieldDirections.find(d => d.dir === move.dir);
      if (!d) continue;
      x += d.x; y += d.y;
      rects.push(passageBounds(x, y, peer.footprint, peer.passRows));
    }
  }
  return rects;
}

/** 경로의 걸음마다 통행 사각이 상대의 남은 통로와 겹치는가. 대피 해제 판정에만 쓴다. */
function routeCrosses(view: LivingView, moves: AutonomousMover["moves"], reserved: ReturnType<typeof passageBounds>[]): boolean {
  let x = view.x, y = view.y;
  for (const move of moves) {
    if (move.kind === "npcTransfer") break;
    if (move.kind !== "move") continue;
    const d = yieldDirections.find(d => d.dir === move.dir);
    if (!d) continue;
    x += d.x; y += d.y;
    const rect = passageBounds(x, y, view.footprint, view.passRows);
    if (reserved.some(other => rectsOverlap(other, rect))) return true;
  }
  return false;
}

/** At most 85 anchors (Manhattan radius 6); the whole passage must leave peers' routes. */
function yieldPath(view: LivingView, reserved: ReturnType<typeof passageBounds>[],
  canStep: (fx: number, fy: number, tx: number, ty: number) => boolean) {
  const queue = [{ x: view.x, y: view.y, moves: [] as AutonomousMover["moves"] }];
  const seen = new Set([`${view.x},${view.y}`]);
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]!;
    if (at.moves.length > 0 && !reserved.some(rect => rectsOverlap(rect, passageBounds(at.x, at.y, view.footprint, view.passRows)))) return at.moves;
    if (at.moves.length >= 6) continue;
    for (const d of yieldDirections) {
      const x = at.x + d.x, y = at.y + d.y, key = `${x},${y}`;
      if (seen.has(key) || !canStep(at.x, at.y, x, y)) continue;
      seen.add(key);
      queue.push({ x, y, moves: [...at.moves, { kind: "move", dir: d.dir }] });
    }
  }
  return null;
}

function repathBlockedLivingNpc(
  scene: AutonomousNpcSceneContext,
  mover: AutonomousMover,
  view: Parameters<typeof routeForLivingMovement>[0]["view"],
  nx: number,
  ny: number,
): void {
  mover.livingRepathCooldownMs = 1000;
  const project = store.getCurrent();
  // 이벤트들은 탐색당 한 번만 모으고, 다음 NPC/다음 탐색은 새 위치를 본다.
  const blocked = createBlockingEventQuery(project, scene.map, scene.session, scene.eventPositions, view.event.id);

  const nextRect = passageBounds(nx, ny, view.footprint, view.passRows);
  // 플레이어만 막는 경우에는 탐색하지 않는다(넓은 몸의 옆칸도 포함).
  if (!yieldingLivingMovers.has(mover) && !blocked(nextRect)
    && canMoveFootprint(project, scene.map, view.x, view.y, view.footprint, nx, ny, view.passRows)
    && !isSpatialPlacementBlocking(project, scene.session, scene.map.id, nextRect)) return;
  const canStep = (fx: number, fy: number, tx: number, ty: number) => {
    const rect = passageBounds(tx, ty, view.footprint, view.passRows);
    for (let y = rect.top; y <= rect.bottom; y++) for (let x = rect.left; x <= rect.right; x++) {
      if (isPlayerOccupyingTile(scene, x, y)) return false;
    }
    return !blocked(rect)
      && canMoveFootprint(project, scene.map, fx, fy, view.footprint, tx, ty, view.passRows)
      && !isSpatialPlacementBlocking(project, scene.session, scene.map.id, rect);
  };
  const yielding = livingYields.get(mover);
  if (yielding) {
    const reserved = remainingPassage(scene, yielding.ids);
    const origin = passageBounds(yielding.x, yielding.y, view.footprint, view.passRows);
    if (reserved.some(rect => rectsOverlap(rect, origin))) {
      // 상대가 대피자의 원래 자리를 계속 쓰더라도(도착 칸이 그 자리 등) 지금 자리에서 상대의 남은
      // 통로와 겹치지 않는 경로가 열렸으면 대피를 끝내고 그 길로 간다. 1초 쿨다운·프레임 예산 안에서만 돈다.
      const detour = routeForLivingMovement({ project, map: scene.map, session: scene.session, view, canStep });
      if (detour && !routeCrosses(view, detour.moves, reserved)) {
        livingYields.delete(mover);
        yieldingLivingMovers.delete(mover);
        mover.moves = detour.moves;
        mover.step = 0;
        mover.blockedSteps = 0;
        return;
      }
      if (mover.step < mover.moves.length) {
        const moves = yieldPath(view, reserved, canStep);
        if (moves) { mover.moves = moves; mover.step = 0; }
      }
      return;
    }
  }
  const end = plannedEndPoint(mover, view.x, view.y);
  const route = !yielding && blocked(passageBounds(end.x, end.y, view.footprint, view.passRows)) ? null
    : routeForLivingMovement({ project, map: scene.map, session: scene.session, view, canStep });
  if (!route) {
    if (yielding) return;
    const group = blockedLivingGroup(scene, view.event.id);
    if (group.length === 0) return;
    const ids = group.filter(id => id !== view.event.id);
    const moves = yieldPath(view, remainingPassage(scene, ids), canStep);
    if (!moves) return;
    livingYields.set(mover, { ids, x: view.x, y: view.y });
    yieldingLivingMovers.add(mover);
    mover.moves = moves;
    mover.step = 0;
    return;
  }
  livingYields.delete(mover);
  yieldingLivingMovers.delete(mover);
  mover.moves = route.moves;
  mover.step = 0;
  mover.blockedSteps = 0;
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

/** Chase-only queue. It owns no living-route state and adds no path searches. */
type ChaseRepathBudget = {
  frame?: number;
  remaining: number;
  pending: Set<AutonomousMover>;
  requested: Set<AutonomousMover>;
};
const chaseRepathBudgets = new WeakMap<AutonomousNpcSceneContext, ChaseRepathBudget>();

function withChaseRepathBudget(scene: AutonomousNpcSceneContext, run: () => void): void {
  const frame = (scene as AutonomousNpcSceneContext & { game?: { loop?: { frame?: number } } }).game?.loop?.frame;
  let budget = chaseRepathBudgets.get(scene);
  if (!budget) {
    budget = { remaining: 2, pending: new Set(), requested: new Set() };
    chaseRepathBudgets.set(scene, budget);
  }
  if (frame === undefined || frame !== budget.frame) budget.remaining = 2;
  budget.frame = frame;
  budget.requested.clear();
  try { run(); } finally {
    // Frozen, removed, out-of-range or otherwise idle callers cannot retain a queue slot.
    for (const mover of budget.pending) if (!budget.requested.has(mover)) budget.pending.delete(mover);
  }
}

function requestChaseRepath(scene: AutonomousNpcSceneContext, mover: AutonomousMover): boolean {
  const budget = chaseRepathBudgets.get(scene);
  if (!budget) return false;
  budget.requested.add(mover);
  budget.pending.add(mover);
  let older = 0;
  for (const waiting of budget.pending) {
    if (waiting === mover) break;
    older += 1;
    if (older >= budget.remaining) return false;
  }
  if (budget.remaining <= older) return false;
  budget.remaining -= 1;
  budget.pending.delete(mover);
  return true;
}
