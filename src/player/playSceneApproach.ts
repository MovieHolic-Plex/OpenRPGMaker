// player/playSceneApproach.ts
// 이동 경로의 «다가가기(approach)»·«쪽으로 돌기(turnToward)» 실행 — 계획은 project/staging/approach.ts 의 순수 함수.
//
// 다가가기는 경로가 그 단계에 닿은 «그 순간»의 실제 위치로 목적 칸을 고른 뒤, 그 자리에 보통 걸음(move)들과
// 마지막 turnToward 를 끼워 넣는다. 그래서 걸음은 기존 걸음과 같은 속도·애니메이션·막힘 처리(주인공 비켜 가기 포함)를 탄다.
// 걷는 속도는 바꾸지 않는다 — 인물의 보통 속도다(속도 표는 다른 작업이 소유한다).
import { canMove, inBounds } from "@/project/collision";
import { passageBounds, UNIT_FOOTPRINT } from "@/project/footprint";
import { isSpatialPlacementBlocking } from "@/project/spatialOccupancy";
import { findBlockingEventOverlappingRect, runtimeEventViewById } from "@/project/runtimeEventState";
import { store } from "@/project/store";
import { isAlwaysAboveCharacterUpperTile } from "@/player/characterDepth";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { dirToward, planApproach, type StageCell } from "@/project/staging/approach";
import type { Dir, MoveCommand } from "@/project/types";
import type { AutonomousNpcSceneContext } from "@/player/playSceneAutonomousTypes";

type StageScene = Pick<AutonomousNpcSceneContext, "map" | "session" | "eventPositions" | "tileX" | "tileY"> &
  Partial<Pick<AutonomousNpcSceneContext, "moving" | "movingTo">>;

type TargetRef = { readonly target?: string; readonly x?: number; readonly y?: number };

function isPlayerRef(target: string): boolean {
  return target === PLAYER_MOVE_TARGET || target === "player";
}

/** 주인공의 칸(걷는 중이면 도착 칸). */
function playerCell(scene: StageScene): StageCell {
  return scene.moving && scene.movingTo ? { x: scene.movingTo.x, y: scene.movingTo.y } : { x: scene.tileX, y: scene.tileY };
}

/** 대상의 지금 칸. 없는 이벤트·빈 대상은 null. */
export function stageTargetCell(scene: StageScene, ref: TargetRef): StageCell | null {
  const target = ref.target?.trim() ?? "";
  if (target) {
    if (isPlayerRef(target)) return playerCell(scene);
    const view = runtimeEventViewById(store.getCurrent(), scene.map, scene.session, scene.eventPositions, target);
    return view ? { x: view.x, y: view.y } : null;
  }
  if (Number.isFinite(ref.x) && Number.isFinite(ref.y)) return { x: Math.round(ref.x!), y: Math.round(ref.y!) };
  return null;
}

/**
 * actor(주인공이면 PLAYER_MOVE_TARGET) 가 from 에서 대상 곁으로 가는 경로 단계들. 마지막은 대상 쪽 turnToward.
 * 길이 없거나 대상이 없으면 제자리에서 대상 쪽으로 돌기만 한다(대상이 없으면 아무것도 안 한다) — 경로가 멈추지 않는다.
 */
export function expandApproach(scene: StageScene, actor: string, from: StageCell, command: Extract<MoveCommand, { kind: "approach" }>): MoveCommand[] {
  const target = stageTargetCell(scene, command);
  if (!target) {
    console.warn(`[player] approach — 대상 «${command.target ?? `${command.x},${command.y}`}» 을 이 맵에서 못 찾았다`);
    return [];
  }
  const project = store.getCurrent();
  const map = scene.map;
  const actorIsPlayer = actor === PLAYER_MOVE_TARGET;
  const targetId = command.target?.trim() ?? "";
  const player = playerCell(scene);
  const tileset = project.tilesets[map.tilesetId];
  const upperLayers = [map.upperTiles, map.upperOverlayTiles].filter((l): l is number[] => Array.isArray(l));
  // 인물 그림은 발 칸과 머리 칸(한 줄 위)을 덮는다 — 둘 중 하나에 늘 위에 그려지는 ★ 타일(기둥·수관)이 있으면 가려진다.
  const coveredRow = (x: number, y: number): boolean => {
    if (!tileset || y < 0 || !inBounds(map, x, y)) return false;
    const i = y * map.width + x;
    return upperLayers.some((layer) => {
      const t = layer[i];
      return typeof t === "number" && t >= 0 && isAlwaysAboveCharacterUpperTile(tileset, t);
    });
  };
  const plan = planApproach({
    width: map.width,
    height: map.height,
    canStep: (a, b) => canMove(project, map, a.x, a.y, b.x, b.y),
    canStand: (c) => {
      if (!inBounds(map, c.x, c.y)) return false;
      const rect = passageBounds(c.x, c.y, UNIT_FOOTPRINT, 1);
      if (isSpatialPlacementBlocking(project, scene.session, map.id, rect)) return false;
      if (findBlockingEventOverlappingRect(project, map, scene.session, scene.eventPositions, rect, actorIsPlayer ? undefined : actor)) return false;
      if (!actorIsPlayer && c.x === player.x && c.y === player.y) return false;
      return true;
    },
    hidden: (c) => coveredRow(c.x, c.y) || coveredRow(c.x, c.y - 1),
  }, from, target, command.distance);
  const turn: MoveCommand = { kind: "turnToward", ...(targetId ? { target: targetId } : { x: target.x, y: target.y }) };
  if (!plan) {
    console.warn(`[player] approach — ${actor} 에서 (${target.x},${target.y}) 곁으로 가는 길이 없다. 제자리에서 돈다`);
    return [turn];
  }
  return [...plan.steps.map((dir): MoveCommand => ({ kind: "move", dir })), turn];
}

/** turnToward 의 방향(같은 칸·대상 없음이면 null). */
export function turnTowardDir(scene: StageScene, from: StageCell, command: Extract<MoveCommand, { kind: "turnToward" }>): Dir | null {
  const target = stageTargetCell(scene, command);
  return target ? dirToward(from, target) : null;
}
