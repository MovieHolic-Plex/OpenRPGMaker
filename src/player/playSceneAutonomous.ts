import { mapTileSize } from "@/project/tileGeometry";
import { npcMoveDurationMs } from "@/project/characterMotion";
import { fieldApproachPauseAfter, fieldApproachRecipe } from "@/project/fieldApproachStyle";
import { jumpHop } from "@/player/characterHop";
import type { Dir } from "@/project/types";
import { actionFieldSlow } from "./actionFieldSlow";
import { isDetectionEmoting } from "./npcDetectionEncounter";
import { hearsPlayer, isPlayerHiding, pursuitTarget } from "./horrorRuntime";
import { chaseBrainProfile } from "@/project/chaseBrain";
import { tickChaseNoises, updatePlayerFootsteps } from "./chaseNoise";
import { pursuitPass, pursuitState } from "./pursuitNavigation";
import { canMoveFootprint, isLedgeCell, isPassableLanding } from "@/project/collision";
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
import type { AutonomousMover, PlaySceneContext } from "@/player/playSceneTypes";
import { VACATED_GRACE_MS } from "@/player/playSceneTypes";
import { showSceneEmote } from "@/player/playSceneEmotes";
import {
  applyFacing,
  executeInstantCommand,
  movementDeltaForCommand,
  nextMoveCommandForScene,
} from "@/player/playSceneAutonomousCommands";
import { canNpcMove, isPlayerOccupyingTile } from "@/player/playSceneAutonomousMapActions";
import { detourAroundPlayer, sidestepForPlayer } from "@/player/commandRouteDetour";
import { startPlayerRoute } from "@/player/playerRouteState";
import { animationStepsWhileStopped, applySpriteAlpha, setNpcIdleFrame, setNpcWalkFrame } from "@/player/playSceneAutonomousSprites";
import { isInSafeZone, nextChaseDecision, type ChasePoint } from "@/player/chaseAi";
import { chooseChaseGoal, trackPlayerMotion, type PlayerMotion } from "@/player/chaseTactics";
import { moverVisualShift, playerVisualShift, rectsTouchVisually } from "@/player/chaseContact";
import { CHASE_BREATHER_MS, CHASE_SEARCH_SLOWDOWN, CHASE_STAMINA_STEPS, chaseAlertHoldMs, chaseCellMs, chaseTempoAuthored, chaseTires } from "@/project/chaseTempo";
import { PLAYER_WALK_STEP_MS } from "@/project/characterMotion";
import { tickChaseSpawnGrace } from "@/player/chaseSpawnGrace";
import { strollChainPending, strollPauseScale, wanderCommand } from "@/player/npcStroll";
import { followerOccupiesTile } from "@/player/playSceneFollowers";
import { nextSessionRandom } from "@/project/session";
import type { AutonomousNpcSceneContext } from "@/player/playSceneAutonomousTypes";
import { moveRuntimeEventPosition,
runtimeEventView,
type RuntimeEventView,
runtimeEventViewById,
runtimeEventViewsForMap, } from "@/project/runtimeEventState"

/** 이번 프레임의 주인공 진행(추격 전술용). updateAutonomousNPCsInPass 가 프레임마다 한 번 쓴다. */
const frameMotion = new WeakMap<object, PlayerMotion>();
/** 막힌 걸음 뒤 재탐색까지 남기는 시간: 재탐색 주기 500ms 중 이 값부터 센다(= 약 150ms 뒤). */
const CHASE_BLOCKED_REPATH_AT_MS = 350;
/** 접촉 전투가 끝난 뒤 같은 추격자가 다시 접촉 전투를 열기까지(ms). 도망친 직후 제자리 재전투를 막는다. */
const CHASE_CONTACT_COOLDOWN_MS = 1500;
const FACING_STEP: Readonly<Record<Dir, ChasePoint>> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

/**
 * 이 이벤트(논리 칸 at, 걷는 중이 아님)와 주인공의 **그림**이 닿았는가. 접촉 전투는 이것이 참일 때만 연다.
 * 주인공이 걷는 중이면 진행률만큼 옮긴 자리로 본다 — 막 떠나는 칸은 닿은 것이 아니다.
 */
function playerBodyTouches(scene: AutonomousNpcSceneContext, project: ReturnType<typeof store.getCurrent>, view: RuntimeEventView): boolean {
  const body = resolvePlayerBody(project, scene.session);
  const own = passageBounds(view.x, view.y, view.footprint, view.passRows);
  const player = playerPassageRect(body, scene.tileX, scene.tileY);
  const shift = playerVisualShift(scene as unknown as Parameters<typeof playerVisualShift>[0]);
  return rectsTouchVisually(own, { x: 0, y: 0 }, player, shift);
}

/** 걷는 중인 추격자(그림 = 진행률만큼 옮긴 자리)와 주인공 그림이 닿았는가. */
function chaserBodyTouches(scene: AutonomousNpcSceneContext, project: ReturnType<typeof store.getCurrent>, view: RuntimeEventView, mover: AutonomousMover): boolean {
  const body = resolvePlayerBody(project, scene.session);
  const own = passageBounds(view.x, view.y, view.footprint, view.passRows);
  const player = playerPassageRect(body, scene.tileX, scene.tileY);
  const shift = playerVisualShift(scene as unknown as Parameters<typeof playerVisualShift>[0]);
  return rectsTouchVisually(own, moverVisualShift(mover, view), player, shift);
}

function parseGoalKey(key: string): ChasePoint {
  const [x, y] = key.split(":").map(Number);
  return { x: x ?? 0, y: y ?? 0 };
}

/** 같은 주인공을 지금 쫓고 있는 다른 추격자들의 칸(협공 자리 고르기). */
function engagedAllyCells(scene: AutonomousNpcSceneContext, self: string, motion: PlayerMotion): ChasePoint[] {
  const project = store.getCurrent();
  const cells: ChasePoint[] = [];
  for (const [id, other] of scene.autonomousNPCs) {
    if (id === self || other.strategy !== "chase" || other.chaseActive !== true || other.chaseTarget || other.kite) continue;
    const view = runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, id);
    if (!view) continue;
    // 걸음 중이면 도착 칸이 곧 그 자리다(이미 예약됐다).
    const at = other.activeMove ? { x: other.activeMove.toX, y: other.activeMove.toY } : { x: view.x, y: view.y };
    if (Math.abs(at.x - motion.at.x) + Math.abs(at.y - motion.at.y) > 24) continue;
    cells.push(at);
  }
  return cells;
}

/** 정지 애니메이션 시계. 씬이 사라지면 함께 버린다. */
const stoppedStepElapsedMs = new WeakMap<object, Map<string, number>>();

export function updateAutonomousNPCs(scene: AutonomousNpcSceneContext, frameDeltaMs: number): void {
  // NPC 마다 자기 뷰를 id 로 1~3번 찾는다. 이 동기 루프 동안만 id 색인을 쓴다(runtimeEventState §withEventIdIndexPass).
  withChaseRepathBudget(scene, () => withEventIdIndexPass(() => {
    updateAutonomousNPCsInPass(scene, frameDeltaMs);
    updateStoppedStepAnimations(scene, frameDeltaMs);
  }));
}

/**
 * 「정지 시 애니메이션」·「방향 고정 + 정지 애니메이션」·「4프레임 애니메이션」.
 *
 * 걷지 않는 이벤트(횃불·깃발·물)에는 무버가 없다. 무버 루프만 보면 가운데 프레임에 얼어 있다.
 * 걷는 중에는 걸음 프레임이 우선하고, 명령으로 바꾼 프레임과 애니메이션 OFF 는 덮지 않는다.
 * 주기는 그 페이지 이동 속도의 한 칸 시간 절반 — 속도를 올리면 제자리 애니메이션도 빨라진다.
 */
function updateStoppedStepAnimations(scene: AutonomousNpcSceneContext, frameDeltaMs: number): void {
  const project = store.getCurrent();
  const dt = Math.max(0, frameDeltaMs);
  let clocks = stoppedStepElapsedMs.get(scene);
  if (!clocks) {
    clocks = new Map();
    stoppedStepElapsedMs.set(scene, clocks);
  }
  const seen = new Set<string>();
  const overrides = scene.eventGraphicPatternOverrides;
  for (const view of stoppedStepViews(scene, project)) {
    const eventId = view.event.id;
    seen.add(eventId);
    if (overrides?.has(eventId)) continue;
    const mover = scene.autonomousNPCs.get(eventId);
    if (mover?.animationEnabled === false) continue;
    const elapsed = (clocks.get(eventId) ?? 0) + dt;
    clocks.set(eventId, elapsed);
    // 걷는 중에는 updateActiveNpcMove 가 발 그림을 이미 맞춘다. 여기서 다시 그리면 위상이 싸운다.
    if (mover?.activeMove && !mover.activeMove.hop) continue;
    const sprite = scene.eventSprites.get(eventId);
    if (!sprite) continue;
    setNpcWalkFrame(
      sprite,
      view.page?.graphic.pattern ?? 0,
      mover?.facing ?? view.direction ?? "down",
      elapsed,
      view.animationType,
      true,
      npcMoveDurationMs(mover?.speedRank ?? view.movement.speed),
      1,
    );
  }
  for (const id of [...clocks.keys()]) if (!seen.has(id)) clocks.delete(id);
}

function stoppedStepViews(scene: AutonomousNpcSceneContext, project: ReturnType<typeof store.getCurrent>): RuntimeEventView[] {
  const spriteIds = scene.eventSprites.keys?.();
  if (spriteIds) {
    const views: RuntimeEventView[] = [];
    for (const eventId of spriteIds) {
      const view = runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, eventId);
      if (view && animationStepsWhileStopped(view.animationType)) views.push(view);
    }
    return views;
  }
  return runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions)
    .filter((view) => animationStepsWhileStopped(view.animationType));
}

function updateAutonomousNPCsInPass(scene: AutonomousNpcSceneContext, frameDeltaMs: number): void {
  const project = store.getCurrent();
  // 시작·복귀 직후 은총 시간에는 추격자가 제자리에서 기다린다(시야 판정·접촉 없음, J61).
  const spawnGrace = tickChaseSpawnGrace(scene, frameDeltaMs);
  // 추격 전술이 쓰는 주인공 진행 방향 — 프레임마다 한 번만 갱신한다(@/player/chaseTactics).
  const movingTo = (scene as { movingTo?: ChasePoint }).movingTo;
  frameMotion.set(scene, trackPlayerMotion(scene, { x: scene.tileX, y: scene.tileY }, scene.moving === true, movingTo));
  // 추격자가 듣는 발소리·소리(@/player/chaseNoise): 서 있기·걷기·달리기.
  const stepping = scene.moving === true && movingTo !== undefined;
  updatePlayerFootsteps(scene.session, { moving: stepping, dashing: (scene as { dashing?: boolean }).dashing === true,
    at: stepping ? movingTo! : { x: scene.tileX, y: scene.tileY }, deltaMs: frameDeltaMs });
  tickChaseNoises(scene.session, frameDeltaMs);
  const repathCandidates: LivingRepathCandidate[] = [];
  for (const [eventId, mover] of scene.autonomousNPCs) {
    const deltaMs = frameDeltaMs * (actionFieldSlow.get(mover) ?? 1);
    let chaseDeltaMs = deltaMs;
    if (mover.livingRepathCooldownMs) mover.livingRepathCooldownMs = Math.max(0, mover.livingRepathCooldownMs - Math.max(0, deltaMs));
    if (isDetectionEmoting(scene, eventId)) continue;
    if (scene.running && scene.session.messageWindowSettings?.allowEventMovementDuringWait !== true
      && !scene.commandMoveRouteEventIds?.has(eventId)) continue;
    // 닿으면 무조건 전투 — 옆·대각·겹침, 주인공이 서 있어도, 추격자가 순찰·수색·걸음 중이어도(2026-10-30).
    if (mover.strategy === "chase" && !spawnGrace && tryChaseContact(scene, project, eventId, mover, deltaMs)) continue;
    // 명령 경로(moveEvent·시간표 이동): 걸음 사이에 빈도 대기를 넣지 않고 이어 걷는다(RPG Maker MV/MZ 「이동 루트 설정」).
    // 예전에는 기본 빈도(3)로 걸음마다 560ms 서 있어 칸당 1초 가까이 걸렸다(2026-10-22 실측, @/project/characterMotion).
    const routeForced = scene.commandMoveRouteEventIds?.has(eventId) === true && mover.strategy === "sequence";
    // 페이지 산책(custom·random): 같은 방향 걸음은 서지 않고 이어 간다(@/player/npcStroll).
    const strolling = !routeForced && mover.naturalStroll === true && (mover.strategy === "sequence" || mover.strategy === "random")
      && !scene.commandMoveRouteEventIds?.has(eventId);
    if (mover.activeMove) {
      if (mover.strategy === "chase" && !mover.chaseTarget && !mover.actionFrozen) {
        const view = runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, eventId);
        const chasing = view ? pursuitTarget({ project, map: scene.map, session: scene.session, positions: scene.eventPositions }, view, mover, deltaMs) : null;
        updateActiveNpcMove({ scene, eventId, mover }, deltaMs);
        // 걸어오는 도중에도 그림이 닿는 그 프레임에 전투를 연다 — 닿기 전에는 열지 않는다(@/player/chaseContact).
        if (view && chasing !== null && !mover.kite && !mover.through && (mover.contactCooldownMs ?? 0) <= 0
          && chaserBodyTouches(scene, project, view, mover)) {
          fireEventTouch(scene, eventId, view.trigger.kind, mover);
          continue;
        }
      } else {
        updateActiveNpcMove({ scene, eventId, mover }, deltaMs);
      }
      // 걸음이 이번 프레임에 끝났으면 같은 프레임에 다음 명령으로 — 칸 경계에서 한 프레임 서지 않는다.
      if (mover.activeMove) continue;
      if (strolling && !strollChainPending(mover)) {
        // 걷기 묶음이 끝났다 — 이번 멈춤 길이를 흔든다(여럿이 같은 박자로 서고 걷지 않게).
        mover.pauseScale = strollPauseScale(() => nextSessionRandom(scene.session, "movement"));
      }
      // 쫓는 추격자는 걸음이 끝난 그 프레임에 다음 칸을 뗀다(남은 시간을 이어받아 칸 경계에서 서지 않는다).
      const chaseGlide = mover.strategy === "chase" && mover.chaseActive === true && !mover.chaseTarget && !mover.kite;
      if (!routeForced && !(strolling && strollChainPending(mover)) && !chaseGlide) continue;
      // 이번 프레임 시간은 걸음과 추격 판정(위)이 이미 썼다 — 이어지는 결정에서 두 번 세지 않는다.
      if (chaseGlide) chaseDeltaMs = 0;
    } else {
      mover.carryMs = 0;
    }
    if (mover.strategy === "chase" && spawnGrace && !mover.chaseTarget) continue;
    if (mover.strategy === "chase") {
      // 순찰+추격: 경로가 있고 추격 중이 아니면 아래 순찰(sequence) 처리로 흘려보낸다.
      const patrol = mover.moves.length > 0 && !mover.chaseTarget && !mover.actionFrozen
        ? patrolChaseState(scene, eventId, mover, chaseDeltaMs) : undefined;
      if (!patrol || patrol.engaged) {
        updateChaseNpc(scene, eventId, mover, chaseDeltaMs, patrol ? { value: patrol.tracked } : undefined);
        continue;
      }
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
    if (routeForced) {
      mover.timer += Math.max(0, deltaMs);
      if (mover.timer < (mover.routeWaitMs ?? 0)) continue;
      mover.routeWaitMs = 0;
    } else if (!(strolling && strollChainPending(mover))) {
      mover.timer += Math.max(0, deltaMs);
      if (mover.timer < mover.moveIntervalMs * (strolling ? mover.pauseScale ?? 1 : 1)) continue;
    }
    mover.timer = 0;
    const view = runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, eventId);
    if (!view) {
      completeRouteCommand(mover);
      continue;
    }
    const command = strolling && mover.strategy === "random"
      ? wanderCommand({
        mover,
        at: { x: view.x, y: view.y },
        home: { x: view.event.x, y: view.event.y },
        canStep: (dir) => {
          const d = dir === "up" ? { x: 0, y: -1 } : dir === "down" ? { x: 0, y: 1 } : dir === "left" ? { x: -1, y: 0 } : { x: 1, y: 0 };
          const to = { x: view.x + d.x, y: view.y + d.y };
          return !isPlayerOccupyingTile(scene, to.x, to.y) && !followerOccupiesTile(followerSpritesOf(scene), to.x, to.y)
            && canNpcMove({ project, scene, mover, eventId, from: { x: view.x, y: view.y }, to }, { ...d, face: dir });
        },
        rng: () => nextSessionRandom(scene.session, "movement"),
      })
      : nextMoveCommandForScene(scene, mover);
    mover.step += 1;
    const baseFrame = view.page?.graphic.pattern ?? 0;
    const sprite = scene.eventSprites.get(eventId);
    const routeContext = { scene, eventId, mover };
    const commandTarget = { mover, view, baseFrame, sprite };
    if (executeInstantCommand(routeContext, commandTarget, command)) {
      // 경로 안 `wait` 는 빈도 간격만큼 쉰다. 방향 바꾸기 같은 즉시 명령은 쉬지 않는다.
      if (routeForced && command.kind === "wait") mover.routeWaitMs = mover.moveIntervalMs;
      // 문 단계(doorCue)는 문 프레임 사이를 잠깐 쉰다 — 소리와 문 그림이 걸음과 겹치지 않게.
      else if (routeForced && command.kind === "doorCue") mover.routeWaitMs = Math.max(0, Math.min(1000, command.ms ?? 0));
      // 산책 중 멈춰 서서 둘러보거나 기다렸다 — 다음 걸음은 이어 걷기가 아니라 새 묶음이다.
      if (strolling) {
        mover.lastStepDir = undefined;
        mover.pauseScale = strollPauseScale(() => nextSessionRandom(scene.session, "movement"));
      }
      mover.carryMs = 0;
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
    // 산책하는 주민은 주인공 뒤 동료의 몸으로 걸어 들어가지 않는다 — 잠깐 서 있다가 같은 걸음을 다시 해 본다.
    if (strolling && !movement.jump && !mover.through && followerOccupiesTile(followerSpritesOf(scene), nx, ny)) {
      setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
      mover.lastStepDir = undefined;
      mover.wanderRun = undefined;
      if (mover.strategy === "sequence") mover.step -= 1;
      mover.pauseScale = 0.5;
      continue;
    }
    // eventTouch fires when the event tries to step onto the player (including mid-move destination).
    if (!movement.jump && !mover.through && isPlayerOccupyingTile(scene, nx, ny)) {
      livingBlockers.delete(mover);
      mover.lastStepDir = undefined;
      mover.wanderRun = undefined;
      // 닿는 판정은 그림 자리로 — 달아나는 주인공이 막 떠난 칸(그림은 아직 반 칸~한 칸 앞)으로는 닿지 않는다(@/player/chaseContact).
      if (playerBodyTouches(scene, project, view)) fireEventTouch(scene, eventId, view.trigger.kind);
      setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
      // 명령 경로(moveEvent)는 주인공을 비켜 같은 끝 칸으로 간다 — 말을 건 주인공이 옆에 서 있어 걸음이 다 버려지고
      // 인물이 제자리에서 사라지던 결함(commandRouteDetour 머리말).
      if (!mover.repeat && !mover.stopOnBlocked && scene.commandMoveRouteEventIds?.has(eventId)) {
        const detour = detourAroundPlayer({
          moves: mover.moves, blockedIndex: mover.step - 1, from: position, width: scene.map.width, height: scene.map.height,
          isPlayerAt: (x, y) => isPlayerOccupyingTile(scene, x, y),
          canStep: (from, to, dir) => canNpcMove({ project, scene, mover, eventId, from, to }, { x: to.x - from.x, y: to.y - from.y, face: dir }),
        });
        if (detour) { mover.moves = detour; mover.step -= 1; mover.blockedSteps = 0; continue; }
        // 주인공이 비켜 서는 중이면 같은 걸음을 다시 시도한다(버리지 않는다).
        if (mover.playerSidestepped && "playerSlide" in scene && (scene.playerRoute || scene.moving)) { mover.step -= 1; continue; }
        // 비켜 갈 길이 없으면(한 칸 틈·한 칸 폭 통로) 주인공이 인물의 남은 경로 밖 가장 가까운 칸으로 비켜 선다 — 한 번만(되풀이하면 둘이 춤춘다).
        if (!mover.playerSidestepped && "playerSlide" in scene && !scene.playerRoute && !scene.moving) {
          const steps = sidestepForPlayer({ moves: mover.moves, blockedIndex: mover.step - 1, from: position, player: { x: scene.tileX, y: scene.tileY },
            canPlayerStand: (x, y) => x >= 0 && y >= 0 && x < scene.map.width && y < scene.map.height && isPassableLanding(project, scene.map, x, y)
              && !findBlockingEventOverlappingRect(project, scene.map, scene.session, scene.eventPositions, passageBounds(x, y, UNIT_FOOTPRINT, 1)) });
          if (steps?.length) {
            mover.playerSidestepped = true;
            startPlayerRoute(scene as Parameters<typeof startPlayerRoute>[0], steps.map(dir => ({ kind: "move" as const, dir })), false);
            mover.step -= 1; mover.blockedSteps = 0; continue;
          }
        }
      }
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
      mover.lastStepDir = command.kind === "move" ? command.dir : undefined;
      livingBlockers.delete(mover);
      moveAutonomousRuntimePosition(scene, eventId, nx, ny, frameDir);
      mover.activeMove = {
        fromX: position.x,
        fromY: position.y,
        toX: nx,
        toY: ny,
        dir: frameDir,
        baseFrame,
        // 명령 경로는 앞 걸음의 남은 시간을 이어받는다(점프는 자기 시간이 있어 이어받지 않는다).
        elapsedMs: movement.hop ? 0 : Math.min(mover.carryMs ?? 0, mover.moveDurationMs),
        hop: movement.hop,
        durationMs: movement.hop?.durationMs,
      };
      mover.carryMs = 0;
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
          setNpcWalkFrame(sprite, baseFrame, frameDir, mover.activeMove.elapsedMs, view.animationType, mover.animationEnabled, mover.moveDurationMs, mover.walkPhase ?? 0);
        }
      }
      // 이어 걷기로 남은 시간을 이어받았으면 이번 프레임에 그만큼 나아간 자리에 그린다. 출발 칸에 그리면 칸 경계마다
      // 한 프레임 덜 가고 다음 프레임에 두 배 가서 칸마다 살짝 끊겨 보였다(2026-10-23 적대 검수, 0.6px → 2.7px).
      if (!movement.hop && (mover.activeMove?.elapsedMs ?? 0) > 0) updateActiveNpcMove({ scene, eventId, mover }, 0);
      scene.runtimeDom.upsertEventMarker(runtimeEventView(view.event, scene.session, scene.eventPositions), undefined, mapTileSize(scene.map));
    } else {
      setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
      mover.lastStepDir = undefined;
      mover.wanderRun = undefined;
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

/**
 * 순찰+추격 한 마리의 이번 프레임 상태. 추격 판정(pursuitTarget)은 프레임당 한 번만 불러야 수색 시간이 두 배로 가지 않으므로
 * 결과를 updateChaseNpc 에 넘긴다. 추격 정책(sight/pursuit)이 없으면 순찰할 시야 기준이 없어 늘 추격 쪽으로 둔다.
 */
function patrolChaseState(
  scene: AutonomousNpcSceneContext,
  eventId: string,
  mover: AutonomousMover,
  deltaMs: number
): { engaged: boolean; tracked: ReturnType<typeof pursuitTarget> } | undefined {
  const project = store.getCurrent();
  const view = runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, eventId);
  if (!view) return undefined;
  const world = { project, map: scene.map, session: scene.session, positions: scene.eventPositions };
  if (mover.patrolChasing === undefined) {
    // 이 장면에서 처음 본 순찰 적. 저장·맵 재진입으로 경로 한가운데에 서 있으면 상대 걸음이 어긋나므로 출발 칸으로 먼저 돌려보낸다.
    mover.patrolChasing = false;
    const state = pursuitState(world, view);
    if (state.home.mapId === scene.map.id && (state.home.x !== view.x || state.home.y !== view.y)) state.active = true;
  }
  const tracked = pursuitTarget(world, view, mover, deltaMs);
  const engaged = tracked !== null;
  if (engaged) {
    // 순찰 도중 끊겼으므로 돌아온 뒤에는 출발 칸(=복귀 칸)에서 경로 처음부터 다시 돈다.
    // 전환 순간에만 되감는다 — 추격 중 매 프레임 timer 를 0 으로 되돌리면 추격 걸음 간격(moveIntervalMs)이 영영 안 찬다.
    if (!mover.patrolChasing) {
      mover.patrolChasing = true;
      mover.step = 0;
      mover.timer = 0;
    }
  } else if (mover.patrolChasing) {
    mover.patrolChasing = false;
    mover.step = 0;
    mover.timer = 0;
  }
  return { engaged, tracked };
}

/** movement.sightAlert — 시야에 처음 든 순간 말풍선을 띄우고 holdMs 동안 멈춘다. 멈춰야 하면 true. */
function holdForSightAlert(
  scene: AutonomousNpcSceneContext,
  eventId: string,
  mover: AutonomousMover,
  alert: NonNullable<RuntimeEventView["movement"]["sightAlert"]>,
  tracked: ReturnType<typeof pursuitTarget>,
  deltaMs: number
): boolean {
  if (tracked === null || tracked?.searching) mover.alertSeen = false;
  else if (tracked && !tracked.searching && !mover.alertSeen) {
    mover.alertSeen = true;
    mover.alertHoldMs = Math.max(0, alert.holdMs);
    // 헤드리스 장면(테스트 러너)에는 Phaser 가 없다 — 말풍선은 실제 장면에서만 띄운다.
    if ((scene as { textures?: unknown }).textures) showSceneEmote(scene as unknown as PlaySceneContext, eventId, alert.emote, Math.max(600, alert.holdMs));
  }
  if ((mover.alertHoldMs ?? 0) <= 0) return false;
  mover.alertHoldMs = Math.max(0, (mover.alertHoldMs ?? 0) - Math.max(0, deltaMs));
  return true;
}

function updateChaseNpc(
  scene: AutonomousNpcSceneContext,
  eventId: string,
  mover: AutonomousMover,
  deltaMs: number,
  precomputed?: { value: ReturnType<typeof pursuitTarget> }
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
  const tracked = mover.chaseTarget ? undefined
    : precomputed ? precomputed.value
    : pursuitTarget({ project, map: scene.map, session: scene.session, positions: scene.eventPositions }, view, mover, deltaMs);
  const sightAlert = view.movement.sightAlert;
  const lunge = view.movement.chaseLunge;
  const approach = fieldApproachRecipe(view.movement.approachStyle);
  const seenBefore = mover.alertSeen === true;
  const brain = chaseBrainProfile(view.movement);
  mover.phaseWalls = brain.phase || undefined;
  // 성격이 영리하면 느낌표는 달리면서 띄운다 — 멈추지 않는다(alertHoldCapMs 0). 옛 방식(classic)만 저작한 만큼 선다.
  const holding = sightAlert !== undefined && !mover.chaseTarget
    && holdForSightAlert(scene, eventId, mover, { ...sightAlert, holdMs: Math.min(chaseAlertHoldMs(view.movement), brain.alertHoldCapMs) }, tracked, deltaMs);
  // 덮치기(movement.chaseLunge)는 알아챈 그 순간(멈춤이 있으면 그 멈춤부터) 센다.
  if (sightAlert && lunge && !seenBefore && mover.alertSeen && !mover.chaseTarget) mover.lungeLeft = Math.max(0, Math.round(lunge.steps));
  if (holding) {
    setNpcIdleFrame(sprite, baseFrame, mover.facing, view.animationType, mover.animationEnabled);
    return;
  }
  if (lunge && !sightAlert && !seenBefore && tracked && !tracked.searching && !mover.chaseTarget) {
    mover.alertSeen = true;
    mover.lungeLeft = Math.max(0, Math.round(lunge.steps));
  }
  if (tracked === null || tracked?.searching) mover.lungeLeft = 0;
  if (tracked === null) {
    setNpcIdleFrame(sprite, baseFrame, mover.facing, view.animationType, mover.animationEnabled);
    return;
  }
  // 추격 박자(@/project/chaseTempo): 쫓는 동안(engaged)·뒤지는 동안(searching)은 칸 사이에 서지 않고 한 칸을
  // 박자 시간 동안 미끄러진다. 예전에는 걸음 트윈 + 결정 대기로 칸마다 섰다 걸었다(보통 480ms/칸).
  const engaged = !mover.chaseTarget && !mover.kite && (tracked ? !tracked.searching : mover.chaseActive === true);
  const searching = !mover.chaseTarget && !mover.kite && tracked?.searching === true;
  const authoredTempo = chaseTempoAuthored(view.movement);
  const tempoMs = chaseCellMs(view.movement);
  if (!engaged) mover.chaseFastSteps = 0;
  if (!engaged) mover.chaseBreathMs = 0;
  // 지치기: 주인공보다 빠른 추격자는 CHASE_STAMINA_STEPS 칸마다 숨을 고른다 — 빠른 추격자를 따돌릴 틈.
  if (engaged && (mover.chaseBreathMs ?? 0) > 0) {
    mover.chaseBreathMs = Math.max(0, (mover.chaseBreathMs ?? 0) - Math.max(0, deltaMs));
    setNpcIdleFrame(sprite, baseFrame, mover.facing, view.animationType, mover.animationEnabled);
    return;
  }
  // 덮치는 동안은 걸음 사이 쉼 없이 바로 다음 칸으로.
  const lunging = (mover.lungeLeft ?? 0) > 0 && lunge !== undefined;
  if (lunging) mover.timer = Math.max(mover.timer, mover.moveIntervalMs);
  // 다가오는 방식: 추격 중 칸 사이 쉼은 방식이 정한다(질주·육중은 쉬지 않음, 도약은 두 칸 뒤 웅크림, 통통은 매 칸 짧게).
  const styled = approach !== undefined && !mover.chaseTarget && tracked !== undefined && tracked !== null && !tracked.searching;
  // 저작한 추격 박자(chaseStepMs)가 있으면 방식이 쉼을 지우지 않는다 — 몸짓은 남고 빠르기는 그 값이 정한다.
  const styledPace = styled && !authoredTempo;
  if (styledPace && !lunging) mover.timer = Math.max(mover.timer, mover.moveIntervalMs - (mover.approachPauseMs ?? 0));
  const glideMs = (engaged || searching) && !styledPace ? Math.round(engaged ? tempoMs : tempoMs * CHASE_SEARCH_SLOWDOWN) : undefined;
  if (glideMs !== undefined && !lunging) mover.timer = Math.max(mover.timer, mover.moveIntervalMs);
  if (!styled) { mover.approachStep = 0; mover.approachPauseMs = 0; }
  const world = { project, map: scene.map, session: scene.session, positions: scene.eventPositions };
  let pursuit: ChasePoint = mover.chaseTarget ?? tracked ?? { x: scene.tileX, y: scene.tileY };
  const targetEvent = mover.chaseTarget
    ? findBlockingEventOverlappingRect(project, scene.map, scene.session, scene.eventPositions,
      { left: pursuit.x, right: pursuit.x, top: pursuit.y, bottom: pursuit.y }, eventId)
    : undefined;
  const pass = brain.phase ? { ...pursuitPass(world, view, targetEvent?.event.id), phase: true } : pursuitPass(world, view, targetEvent?.event.id);
  // 추격 전술(@/player/chaseTactics): 진행 방향 앞질러 막기·여럿이면 갈라져 감싸기. 안전지대 안의 주인공은 건드리지 않는다.
  const motion = frameMotion.get(scene);
  if (engaged && motion && mover.pathfind !== false && !isInSafeZone(scene.map.safeZones, { x: scene.tileX, y: scene.tileY })
    && mover.timer >= mover.moveIntervalMs) {
    const goal = chooseChaseGoal({
      project, map: scene.map, from: { x: view.x, y: view.y }, pass,
      cellMs: styledPace ? approach!.stepMs + approach!.pauseMs / Math.max(1, approach!.burst) : tempoMs,
      playerStepMs: (scene as { moveDurationMs?: number }).moveDurationMs ?? PLAYER_WALK_STEP_MS,
      player: motion, allies: engagedAllyCells(scene, eventId, motion),
      tactics: { intercept: brain.intercept, interceptMinRun: brain.interceptMinRun, flank: brain.flank, flankOffset: brain.flankOffset },
      ...(mover.chaseGoalKey ? { previous: parseGoalKey(mover.chaseGoalKey) } : {}),
    });
    const key = `${goal.x}:${goal.y}`;
    if (mover.chaseGoalKey !== key) {
      mover.chaseGoalKey = key;
      mover.chasePath = [];
      mover.chasePathBlocked = false;
    }
    pursuit = goal;
  } else if (!engaged) {
    mover.chaseGoalKey = undefined;
  }
  // 시야·추격 정책이 없는 옛 추격자(sightRange 만)도 발소리를 들으면 깨어난다.
  if (tracked === undefined && !mover.chaseTarget && mover.chaseActive !== true && hearsPlayer(world, view)) mover.chaseActive = true;
  let decision = nextChaseDecision({
    project,
    map: scene.map,
    from: { x: view.x, y: view.y },
    player: pursuit,
    deltaMs,
    mover,
    sightRange: tracked ? undefined : mover.sightRange !== undefined ? mover.sightRange + brain.sightBonusCells : undefined,
    giveUpRange: tracked ? undefined : mover.giveUpRange !== undefined ? mover.giveUpRange + (approach?.giveUpBonus ?? 0) + brain.giveUpBonus : undefined,
    pathfind: mover.pathfind,
    kite: mover.kite,
    requestRepath: () => requestChaseRepath(scene, mover),
    pass,
    ...(engaged || searching ? { straight: { heading: FACING_STEP[mover.facing] }, approachWhenBlocked: true } : {}),
  });
  if (tracked?.searching && decision.kind === "touch" && (pursuit.x !== scene.tileX || pursuit.y !== scene.tileY)) {
    decision = { kind: "move", x: pursuit.x, y: pursuit.y, dir: decision.dir };
  }
  if (decision.kind === "wait") {
    setNpcIdleFrame(sprite, baseFrame, mover.facing, view.animationType, mover.animationEnabled);
    return;
  }
  // 들쭉날쭉(박쥐): 가끔 옆 칸으로 샌다 — 막혔으면 그대로 다가온다.
  if (styled && approach?.erratic && decision.kind === "move" && nextSessionRandom(scene.session, "movement") < approach.erratic) {
    const horizontal = decision.dir === "left" || decision.dir === "right";
    const side: Dir = horizontal ? (nextSessionRandom(scene.session, "movement") < 0.5 ? "up" : "down") : (nextSessionRandom(scene.session, "movement") < 0.5 ? "left" : "right");
    const d = side === "up" ? { x: 0, y: -1 } : side === "down" ? { x: 0, y: 1 } : side === "left" ? { x: -1, y: 0 } : { x: 1, y: 0 };
    const to = { x: view.x + d.x, y: view.y + d.y };
    if (!isPlayerOccupyingTile(scene, to.x, to.y) && canNpcMove({ project, scene, mover, eventId, from: { x: view.x, y: view.y }, to }, { ...d, face: side })) {
      decision = { kind: "move", x: to.x, y: to.y, dir: side };
    }
  }
  const frameDir = applyFacing(mover, decision.dir);
  if (decision.kind === "touch") {
    // NPC 를 추겁하는 중이면 접촉은 이벤트 트리거가 아니다 —
    // 진영 전투의 피해는 액션 전투 상태기가 예고된 공격으로만 주므로 그자리에 선다.
    if (mover.chaseTarget) {
      setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
      return;
    }
    // 「닿기」 결정은 목표 칸이 곧 주인공일 때 나온다 — 그 칸으로 한 걸음 딛는 것으로 바꿔 아래 몸 접촉 판정에 맡긴다.
    // 앞질러 막기 목표(빈 칸)에서 나온 「닿기」는 주인공이 거기 없으니 그냥 걸어 들어간다(예전에는 여기서 바로 전투가 열렸다).
    const d = decision.dir === "up" ? { x: 0, y: -1 } : decision.dir === "down" ? { x: 0, y: 1 } : decision.dir === "left" ? { x: -1, y: 0 } : { x: 1, y: 0 };
    const to = { x: view.x + d.x, y: view.y + d.y };
    const path = mover.chasePath ?? [];
    if (path[0] && path[0].x === to.x && path[0].y === to.y) mover.chasePath = path.slice(1);
    decision = { kind: "move", x: to.x, y: to.y, dir: decision.dir };
  }
  // Touch uses the same passage rectangles as feet collision, including the player's reserved destination.
  const nextRect = passageBounds(decision.x, decision.y, view.footprint, view.passRows);
  const playerBody = resolvePlayerBody(project, scene.session);
  const touchesPlayer = rectsOverlap(nextRect, playerPassageRect(playerBody, scene.tileX, scene.tileY))
    || (scene.moving === true && scene.movingTo !== undefined
      && rectsOverlap(nextRect, playerPassageRect(playerBody, scene.movingTo.x, scene.movingTo.y)));
  // 주인공이 막 떠나는 칸(예약 칸이 아닌 지금 칸)이면 뒤따라 들어선다 — 그 칸은 곧 빈다.
  // 그림이 아직 떨어져 있는데 논리 칸만 겹쳤다고 전투를 열던 것이 「부딪히지도 않았는데 전투」였다(@/player/chaseContact).
  const followVacated = !mover.through && touchesPlayer && scene.moving === true && scene.movingTo !== undefined
    && !rectsOverlap(nextRect, playerPassageRect(playerBody, scene.movingTo.x, scene.movingTo.y))
    && !playerBodyTouches(scene, project, view);
  if (!mover.through && touchesPlayer && !followVacated) {
    if (!mover.chaseTarget && !mover.kite && (mover.contactCooldownMs ?? 0) <= 0 && playerBodyTouches(scene, project, view)) fireEventTouch(scene, eventId, view.trigger.kind, mover);
    setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
    return;
  }
  // 좀비 군집: 일반 자율 이동과 동일한 점유 규칙을 적용한다. 목적지가 다른 이벤트에
  // 점유되어 있으면 이번 틱은 대기 — 추적 결정은 순차 처리되고 목적지는 즉시 커밋되므로
  // 같은 칸으로 몰려 겹치는(stacking) 현상이 방지된다.
  if (
    !followVacated && !canNpcMove(
      { project, scene, mover, eventId, from: { x: view.x, y: view.y }, to: { x: decision.x, y: decision.y } },
      { x: decision.x - view.x, y: decision.y - view.y, face: frameDir }
    )
  ) {
    // 막힌 걸음(다른 추격자·동료가 막 들어선 칸)은 경로에서 이미 빠졌다 — 남은 경로는 어긋나므로 버리고 곧 다시 찾는다.
    // 예전에는 어긋난 경로를 한 칸씩 버리며 제자리에서 버벅였다.
    if (engaged || searching) {
      mover.chasePath = [];
      mover.chasePathBlocked = true;
      mover.chaseRepathTimerMs = Math.max(mover.chaseRepathTimerMs ?? 0, CHASE_BLOCKED_REPATH_AT_MS);
    }
    setNpcIdleFrame(sprite, baseFrame, frameDir, view.animationType, mover.animationEnabled);
    return;
  }
  moveAutonomousRuntimePosition(scene, eventId, decision.x, decision.y, frameDir);
  const lungeMs = lunging ? Math.min(lunge!.stepMs ?? npcMoveDurationMs(lunge!.speed), styled && approach?.lungeStepMs ? approach.lungeStepMs : Infinity) : undefined;
  const stepMs = lungeMs ?? (styledPace ? approach!.stepMs : glideMs ?? (styled ? approach!.stepMs : undefined));
  const tile = mapTileSize(scene.map);
  const stepIndex = mover.approachStep ?? 0;
  // 이어 걷기: 앞 칸에서 남은 시간을 이어받는다(뛰어오르는 몸짓은 자기 시간이 있어 이어받지 않는다).
  const carried = glideMs !== undefined && !(styled && approach?.hop) ? Math.min(mover.carryMs ?? 0, (stepMs ?? glideMs) - 1) : 0;
  mover.carryMs = 0;
  if (engaged && !lunging) {
    const cell = stepMs ?? tempoMs;
    if (chaseTires(styledPace ? cell + (approach!.pauseMs / Math.max(1, approach!.burst)) : cell)) {
      mover.chaseFastSteps = (mover.chaseFastSteps ?? 0) + 1;
      if (mover.chaseFastSteps >= CHASE_STAMINA_STEPS) {
        mover.chaseFastSteps = 0;
        mover.chaseBreathMs = CHASE_BREATHER_MS;
        if ((scene as { textures?: unknown }).textures) showSceneEmote(scene as unknown as PlaySceneContext, eventId, "sweat", CHASE_BREATHER_MS);
      }
    }
  }
  mover.activeMove = { fromX: view.x, fromY: view.y, toX: decision.x, toY: decision.y, dir: frameDir, baseFrame, elapsedMs: carried,
    ...(stepMs !== undefined ? { durationMs: stepMs } : {}),
    ...(styled && approach?.hop ? { hop: jumpHop({ heightPx: approach.hop * tile, durationMs: stepMs ?? approach.stepMs, impact: false }) } : {}),
    ...(styled && (approach?.sway || approach?.bob) ? { approach: {
      sway: approach.sway ?? 0, bob: approach.bob ?? 0,
      sign: approach.erratic ? (nextSessionRandom(scene.session, "movement") < 0.5 ? -1 : 1) : stepIndex % 2 === 0 ? 1 : -1,
    } } : {}) };
  if (lunging) mover.lungeLeft = (mover.lungeLeft ?? 1) - 1;
  if (styled) {
    mover.approachStep = stepIndex + 1;
    mover.approachPauseMs = lunging ? 0 : fieldApproachPauseAfter(approach!, stepIndex);
  }
  if (sprite) {
    sprite.setPosition(footprintSpriteX(view.x, view.footprint, mapTileSize(scene.map)), characterSpriteY(view.y, mapTileSize(scene.map)));
    updateCharacterDepth(sprite, view.priority);
    applySpriteAlpha(sprite, mover.opacity);
    setNpcWalkFrame(sprite, baseFrame, frameDir, 0, view.animationType, mover.animationEnabled, mover.moveDurationMs, mover.walkPhase ?? 0);
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

/**
 * 추격자 몸이 주인공 몸에 닿았으면 접촉 전투를 연다(옆·대각·겹침 모두, @/player/chaseContact TOUCH_REACH).
 * 예전에는 추격자가 주인공 칸으로 «걸어 들어가려는» 순간에만 열려, 대각 옆에 선 추격자·순찰하다 스친 추격자·
 * 서 있는 주인공 곁에 멈춘 추격자는 영영 전투를 안 걸었다(2026-10-30 폴른 스타 B5 들개).
 * 숨은 주인공(목격되지 않은 숨기)·안전지대·NPC 를 쫓는 진영 추격·거리 유지 적·통과(through) 페이지는 열지 않는다.
 */
function tryChaseContact(
  scene: AutonomousNpcSceneContext,
  project: ReturnType<typeof store.getCurrent>,
  eventId: string,
  mover: AutonomousMover,
  deltaMs: number
): boolean {
  if (mover.chaseTarget || mover.kite || mover.through || mover.actionFrozen) return false;
  if ((mover.contactCooldownMs ?? 0) > 0) {
    mover.contactCooldownMs = Math.max(0, (mover.contactCooldownMs ?? 0) - Math.max(0, deltaMs));
    return false;
  }
  if (isInSafeZone(scene.map.safeZones, { x: scene.tileX, y: scene.tileY })) return false;
  const view = runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, eventId);
  if (!view || view.trigger.kind !== "eventTouch" || view.movement.type !== "chase") return false;
  const world = { project, map: scene.map, session: scene.session, positions: scene.eventPositions };
  if (isPlayerHiding(world) && !scene.session.horror?.hiding?.witnessedBy.includes(eventId)) return false;
  if (!chaserBodyTouches(scene, project, view, mover)) return false;
  fireEventTouch(scene, eventId, view.trigger.kind, mover);
  return true;
}

function fireEventTouch(scene: AutonomousNpcSceneContext, eventId: string, triggerKind: string, mover?: AutonomousMover): void {
  if (triggerKind !== "eventTouch") return;
  if (mover && !scene.running) mover.contactCooldownMs = CHASE_CONTACT_COOLDOWN_MS;
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
  const reached = move.elapsedMs + Math.max(0, deltaMs);
  move.elapsedMs = Math.min(durationMs, reached);
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
    if (move.approach && !hop) {
      // 다가오는 몸짓: 진행 방향과 수직으로 흔들리고(S자·급강하), 칸마다 둥실/쿵 하고 오르내린다.
      const tile = mapTileSize(scene.map);
      const arc = Math.sin(progress * Math.PI);
      const sway = move.approach.sway * tile * arc * move.approach.sign;
      const horizontal = move.dir === "left" || move.dir === "right";
      sprite.setPosition(groundX + (horizontal ? 0 : sway), groundY + (horizontal ? sway : 0) - move.approach.bob * tile * arc);
    }
    updateCharacterDepth(sprite, priority);
    applySpriteAlpha(sprite, mover.opacity);
    // 체공 중에는 걸음을 돌리지 않는다 — 공중에서 발을 젓는 모양이 된다.
    if (hop) setNpcIdleFrame(sprite, move.baseFrame, move.dir, animationType, mover.animationEnabled);
    else setNpcWalkFrame(sprite, move.baseFrame, move.dir, move.elapsedMs, animationType, mover.animationEnabled, durationMs, mover.walkPhase ?? 0);
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
  if (move.fromX !== move.toX || move.fromY !== move.toY) mover.vacated = { x: move.fromX, y: move.fromY, until: (typeof performance !== "undefined" ? performance.now() : Date.now()) + VACATED_GRACE_MS };
  mover.activeMove = null;
  mover.timer = 0;
  // 다음 칸은 다른 발로(한 칸에 패턴 두 장). 점프는 걸음 패턴을 돌리지 않았으므로 위상을 그대로 둔다.
  if (!hop) mover.walkPhase = ((mover.walkPhase ?? 0) + 2) % 4;
  mover.carryMs = hop ? 0 : Math.max(0, reached - durationMs);
  scene.syncRuntimeState?.();
}

function followerSpritesOf(scene: AutonomousNpcSceneContext): ReadonlyMap<string, { readonly visible: boolean }> | undefined {
  return (scene as { readonly followerSprites?: ReadonlyMap<string, { readonly visible: boolean }> }).followerSprites;
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
  if (!mover.livingRoute && !mover.preserveBlockedSteps && attempts > MAX_BLOCKED_STEP_RETRIES) {
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
    && !isLedgeCell(project, scene.map, nx, ny)
    && !isSpatialPlacementBlocking(project, scene.session, scene.map.id, nextRect)) return;
  const canStep = (fx: number, fy: number, tx: number, ty: number) => {
    const rect = passageBounds(tx, ty, view.footprint, view.passRows);
    for (let y = rect.top; y <= rect.bottom; y++) for (let x = rect.left; x <= rect.right; x++) {
      if (isPlayerOccupyingTile(scene, x, y)) return false;
    }
    return !blocked(rect)
      && canMoveFootprint(project, scene.map, fx, fy, view.footprint, tx, ty, view.passRows)
      && !isLedgeCell(project, scene.map, tx, ty)
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
