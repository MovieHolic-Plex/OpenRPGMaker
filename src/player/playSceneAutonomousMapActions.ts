import { furniturePushBlocks } from './furniturePushAnimation';
import { canMoveFootprint, inBounds } from "@/project/collision";
import { UNIT_FOOTPRINT, passageBounds, rectsOverlap } from "@/project/footprint";
import { isSpatialPlacementBlocking } from "@/project/spatialOccupancy";
import { resolvePlayerBody, playerPassageRect } from "@/project/playerFootprint";
import type { CharacterFootprint, FootprintRect } from "@/project/types";
import { store } from "@/project/store";
import { nearestPassableTile } from "@/player/playSceneMapCommands";
import type { MoveCommand } from "@/project/types";
import type { AutonomousMover } from "@/player/playSceneTypes";
import type { AutonomousNpcSceneContext, MovementDelta } from "@/player/playSceneAutonomousTypes";
import { applySpriteAlpha } from "@/player/playSceneAutonomousSprites";
import type { NpcCommandTarget, NpcRouteCommandContext } from "@/player/playSceneAutonomousCommands";
import { findBlockingEventOverlappingRect, invalidateEventIdIndexPass, runtimeEventViewById } from "@/project/runtimeEventState"
import type { Project } from "@/project/types/project";

export type NpcMoveCollision = {
  readonly project: Project;
  readonly scene: AutonomousNpcSceneContext;
  readonly mover: AutonomousMover;
  /** Excluded from solid-event occupancy (the mover itself). */
  readonly eventId?: string;
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
};

/** Player occupancy for character collision: current tile, plus mid-move destination. */
export function isPlayerOccupyingTile(
  scene: Pick<AutonomousNpcSceneContext, "tileX" | "tileY"> &
    Partial<Pick<AutonomousNpcSceneContext, "moving" | "movingTo" | "session">>,
  x: number,
  y: number
): boolean {
  return playerOverlapsRect(scene, { left: x, right: x, top: y, bottom: y }, store.getCurrent());
}

function playerOverlapsRect(
  scene: Pick<AutonomousNpcSceneContext, "tileX" | "tileY"> &
    Partial<Pick<AutonomousNpcSceneContext, "moving" | "movingTo" | "session">>,
  rect: FootprintRect,
  project: Project
): boolean {
  const body = resolvePlayerBody(project, scene.session);
  return rectsOverlap(rect, playerPassageRect(body, scene.tileX, scene.tileY))
    || (scene.moving === true && !!scene.movingTo
      && rectsOverlap(rect, playerPassageRect(body, scene.movingTo.x, scene.movingTo.y)));
}

/**
 * 이 무버 자신의 통행 사각 크기. `AutonomousMover` 에 싣지 않고 페이지에서 매번 읽는다 —
 * 무버 생성 지점이 여러 곳이라 필드를 두면 동기화 대상이 늘고, `isCharacterBlockedRect`
 * 가 이미 같은 조회를 하므로 새로운 비용 종류가 아니다. 진실은 페이지 하나다.
 */
function moverPassSize(request: NpcMoveCollision): { fp: CharacterFootprint; passRows: number } {
  const self = request.eventId === undefined
    ? undefined
    : runtimeEventViewById(
        request.project,
        request.scene.map,
        request.scene.session,
        request.scene.eventPositions,
        request.eventId
      );
  return { fp: self?.footprint ?? UNIT_FOOTPRINT, passRows: self?.passRows ?? 1 };
}

export function canNpcMove(
  request: NpcMoveCollision,
  movement: MovementDelta
): boolean {
  if (movement.jump || request.mover.through) return inBounds(request.scene.map, request.to.x, request.to.y);
  const self = moverPassSize(request);
  // RM2K3 same-as-characters: player and solid events occupy tiles and block non-through movers.
  if (isCharacterBlockedRect(request, self, request.to.x, request.to.y)) return false;
  if (movement.x !== 0 && movement.y !== 0) {
    // 대각은 여기서 L자로 분해한다 — canMoveFootprint 도 분해하지만 그쪽은 중간 칸의
    // **캐릭터** 점유를 모른다. 두 검사를 한 구간씩 교차해야 하므로 분해를 여기 남긴다.
    const hx = request.from.x + movement.x;
    const vy = request.from.y + movement.y;
    const horizontalOpen =
      leg(request, self, request.from.x, request.from.y, hx, request.from.y) &&
      leg(request, self, hx, request.from.y, request.to.x, request.to.y) &&
      !isCharacterBlockedRect(request, self, hx, request.from.y);
    const verticalOpen =
      leg(request, self, request.from.x, request.from.y, request.from.x, vy) &&
      leg(request, self, request.from.x, vy, request.to.x, request.to.y) &&
      !isCharacterBlockedRect(request, self, request.from.x, vy);
    return horizontalOpen || verticalOpen;
  }
  return leg(request, self, request.from.x, request.from.y, request.to.x, request.to.y);
}

/** 직교 한 구간의 지형 통행. 1x1 이면 canMove 1회와 같다. */
function leg(
  request: NpcMoveCollision,
  self: { fp: CharacterFootprint; passRows: number },
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): boolean {
  return canMoveFootprint(
    request.project,
    request.scene.map,
    fromX,
    fromY,
    self.fp,
    toX,
    toY,
    self.passRows
  ) && !isSpatialPlacementBlocking(
    request.project,
    request.scene.session,
    request.scene.map.id,
    passageBounds(toX, toY, self.fp, self.passRows),
  );
}

/**
 * (x,y) 를 발밑으로 삼은 이 무버의 통행 사각이 플레이어나 다른 솔리드 이벤트와 겹치는가.
 *
 * 양쪽 다 **통행 사각**이다 — 상체만 겹치는 것은 서로 지나갈 수 있어야 한다.
 * 플레이어는 현재 위치와 진행 중인 걸음의 목적지 모두를 예약한다.
 */
function isCharacterBlockedRect(
  request: NpcMoveCollision,
  self: { fp: CharacterFootprint; passRows: number },
  x: number,
  y: number
): boolean {
  const rect = passageBounds(x, y, self.fp, self.passRows);
  if (furniturePushBlocks(request.scene, rect, request.eventId)) return true;
  if (playerOverlapsRect(request.scene, rect, request.project)) return true;
  // 예전에는 맵 전체 뷰 배열을 만든 뒤 some() 했다. 대각 이동 판정은 이 함수를 최대 3번
  // 부르므로 NPC 한 명이 한 걸음 옮길 때마다 배열이 3개 생겼다. 이제는 첫 차단에서 멈춘다.
  return findBlockingEventOverlappingRect(
    request.project,
    request.scene.map,
    request.scene.session,
    request.scene.eventPositions,
    rect,
    request.eventId
  ) !== undefined;
}

export function applyNpcTransfer(
  routeContext: NpcRouteCommandContext,
  target: NpcCommandTarget,
  command: Extract<MoveCommand, { kind: "npcTransfer" }>
): void {
  const project = store.getCurrent();
  const targetMap = project.maps[command.mapId];
  if (!targetMap) {
    console.warn(`[player] npcTransfer target map missing: ${command.mapId}`);
    return;
  }
  const destination = nearestPassableTile(project, targetMap, command.x, command.y);
  const rect = passageBounds(destination.x, destination.y, target.view.footprint, target.view.passRows);
  if (findBlockingEventOverlappingRect(project, targetMap, routeContext.scene.session,
    targetMap.id === routeContext.scene.map.id ? routeContext.scene.eventPositions : {}, rect, routeContext.eventId)
    || isSpatialPlacementBlocking(project, routeContext.scene.session, targetMap.id, rect)) {
    // 호출부는 명령을 먼저 소비한다. 점유가 풀릴 때까지 같은 transfer를 보존한다.
    target.mover.step = Math.max(0, target.mover.step - 1);
    return;
  }
  routeContext.scene.session.eventLocations ??= {};
  routeContext.scene.session.eventLocations[routeContext.eventId] = {
    mapId: command.mapId,
    x: destination.x,
    y: destination.y,
    direction: command.direction ?? target.mover.facing,
  };
  delete routeContext.scene.eventPositions[routeContext.eventId];
  routeContext.scene.autonomousNPCs.delete(routeContext.eventId);
  routeContext.scene.commandMoveRouteEventIds?.delete(routeContext.eventId);
  applySpriteAlpha(target.sprite, 0);
  // 표면 갱신은 이벤트 배열을 바꿀 수 있다(소환·스폰) — 이 NPC 패스의 id 색인을 버린다.
  invalidateEventIdIndexPass();
  routeContext.scene.refreshRuntimeSurfaces?.();
  routeContext.scene.syncRuntimeState?.();
}
