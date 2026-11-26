/**
 * 컷신 빨리 감기의 이동 — 인물을 걷게 하지 않고 경로가 끝날 칸에 바로 세운다(오너 결정 2026-11-26 D2).
 * 건너뛰기 전에는 걷기 명령을 통째로 버려 인물이 처음 자리에 남았다(끝까지 보면 다른 자리).
 *
 * 막힌 칸 규칙: 걸음마다 지형(canMove)·다른 고체 인물·주인공(인물을 옮길 때)을 본다. 막힌 걸음은 그 자리에 선 채 방향만 바꾼다 —
 * 실제 걷기에서 막힌 걸음이 버려지는 기본값과 같다. `skippable: false`(막히면 풀릴 때까지 기다림) 경로도 즉시 배치에서는 같은 규칙을 쓴다.
 * 걸음 말고 다른 일을 하는 경로(스위치·그림·투명·통과·문으로 나가기·다른 맵으로)는 칸만 옮기면 그 일이 빠지므로 배치하지 않는다 —
 * 호출부는 그 경로를 기다림 없이 그대로 걸린다(상태는 같아지고 걸음만 늦다).
 */
import { canMove, isPassable } from "@/project/collision";
import { PLAYER_MOVE_TARGET } from "@/project/moveRouteTarget";
import { findBlockingRuntimeEventAtInMap, runtimeEventViewById } from "@/project/runtimeEventState";
import { runtimeMap } from "@/project/runtimeMap";
import { DIR_DELTA, planApproach } from "@/project/staging/approach";
import { store } from "@/project/store";
import type { Dir, MoveCommand } from "@/project/types";
import { applyEventRelocationStep, placePlayerOnCurrentMap } from "@/player/playSceneMapCommands";
import type { PlaySceneContext } from "@/player/playSceneTypes";

type Cell = { x: number; y: number };

/** 칸만 옮겨도 끝까지 걸은 것과 같은 걸음들. 나머지가 하나라도 있으면 배치하지 않는다. */
const POSITION_ONLY_MOVES: ReadonlySet<MoveCommand["kind"]> = new Set([
  "move", "moveDiagonal", "stepForward", "jump", "placeAt", "approach",
  "turn", "turnTowardPlayer", "turnAwayFromPlayer", "turnToward", "turnRelative", "turnRandom",
  "wait", "changeSpeed", "changeFrequency", "setAnimation", "setDirectionFix", "playSe",
]);

const OPPOSITE: Readonly<Record<Dir, Dir>> = { up: "down", down: "up", left: "right", right: "left" };
const RIGHT_OF: Readonly<Record<Dir, Dir>> = { up: "right", right: "down", down: "left", left: "up" };

function dirToward(from: Cell, to: Cell): Dir | undefined {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (dx === 0 && dy === 0) return undefined;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

export type RouteEnd = { readonly x: number; readonly y: number; readonly facing?: Dir };

/**
 * `target`(이벤트 id 또는 주인공)이 `moves` 를 끝까지 걸었을 때 설 칸. 걸음 말고 다른 일이 섞인 경로면 null.
 * 대상이 이 맵에 없어도 null.
 */
export function cutsceneRouteEnd(scene: PlaySceneContext, target: string, moves: readonly MoveCommand[]): RouteEnd | null {
  if (!moves.every((move) => move && POSITION_ONLY_MOVES.has(move.kind))) return null;
  const project = store.getCurrent();
  const map = runtimeMap(scene.map, scene.session);
  const isPlayer = target === PLAYER_MOVE_TARGET;
  const view = isPlayer ? undefined : runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, target);
  if (!isPlayer && !view) return null;
  const player: Cell = { x: scene.tileX, y: scene.tileY };
  const me: Cell = isPlayer ? { ...player } : { x: view!.x, y: view!.y };
  let facing: Dir | undefined = isPlayer ? scene.facing : view!.direction;
  const cellOf = (ref: string | undefined): Cell | null => {
    const r = (ref ?? "").trim();
    if (r === PLAYER_MOVE_TARGET || r === "player") return isPlayer ? { ...me } : player;
    if (!r) return null;
    const other = runtimeEventViewById(project, scene.map, scene.session, scene.eventPositions, r);
    return other ? { x: other.x, y: other.y } : null;
  };
  const occupied = (c: Cell): boolean => {
    if (!isPlayer && c.x === player.x && c.y === player.y) return true;
    const blocker = findBlockingRuntimeEventAtInMap(project, map, scene.session, scene.eventPositions, c.x, c.y);
    return blocker !== undefined && blocker.event.id !== target;
  };
  const step = (to: Cell, diagonal: boolean): void => {
    const terrain = diagonal ? isPassable(project, map, to.x, to.y) : canMove(project, map, me.x, me.y, to.x, to.y);
    if (terrain && !occupied(to)) { me.x = to.x; me.y = to.y; }
  };
  for (const move of moves) {
    switch (move.kind) {
      case "move": {
        const d = DIR_DELTA[move.dir];
        facing = move.dir;
        step({ x: me.x + d.x, y: me.y + d.y }, false);
        break;
      }
      case "stepForward": {
        const dir = facing ?? "down";
        const d = DIR_DELTA[dir];
        step({ x: me.x + d.x, y: me.y + d.y }, false);
        break;
      }
      case "moveDiagonal":
        facing = move.horizontal;
        step({ x: me.x + (move.horizontal === "left" ? -1 : 1), y: me.y + (move.vertical === "up" ? -1 : 1) }, true);
        break;
      case "jump": {
        const dir = facing ?? "down";
        const d = DIR_DELTA[dir];
        const to = move.dx || move.dy ? { x: me.x + (move.dx || 0), y: me.y + (move.dy || 0) } : { x: me.x + d.x * 2, y: me.y + d.y * 2 };
        if (isPassable(project, map, to.x, to.y) && !occupied(to)) { me.x = to.x; me.y = to.y; }
        break;
      }
      case "placeAt":
        me.x = move.x; me.y = move.y;
        break;
      case "approach": {
        const goal = move.target ? cellOf(move.target) : Number.isFinite(move.x) && Number.isFinite(move.y) ? { x: move.x!, y: move.y! } : null;
        if (!goal) break;
        const plan = planApproach({
          width: map.width, height: map.height,
          canStep: (a, b) => canMove(project, map, a.x, a.y, b.x, b.y),
          canStand: (c) => isPassable(project, map, c.x, c.y) && !occupied(c),
        }, me, goal, move.distance);
        if (plan) { me.x = plan.goal.x; me.y = plan.goal.y; if (plan.face) facing = plan.face; }
        break;
      }
      case "turn": facing = move.dir; break;
      case "turnTowardPlayer": facing = dirToward(me, player) ?? facing; break;
      case "turnAwayFromPlayer": { const d = dirToward(me, player); if (d) facing = OPPOSITE[d]; break; }
      case "turnToward": {
        const goal = move.target ? cellOf(move.target) : Number.isFinite(move.x) && Number.isFinite(move.y) ? { x: move.x!, y: move.y! } : null;
        if (goal) facing = dirToward(me, goal) ?? facing;
        break;
      }
      case "turnRelative":
        if (facing) facing = move.turn === "turn180" ? OPPOSITE[facing] : move.turn === "left90" ? OPPOSITE[RIGHT_OF[facing]] : RIGHT_OF[facing];
        break;
      default:
        break;
    }
  }
  return { x: me.x, y: me.y, ...(facing ? { facing } : {}) };
}

export function placeAtRouteEnd(scene: PlaySceneContext, target: string, end: RouteEnd): void {
  if (target === PLAYER_MOVE_TARGET) {
    scene.playerRoute = null;
    if (end.facing) scene.facing = end.facing;
    placePlayerOnCurrentMap(scene, end.x, end.y);
    if (end.facing) scene.player.setFrame(scene.playerSprite.idleFrameFor(end.facing));
    return;
  }
  applyEventRelocationStep(scene, { kind: "relocateEvents", eventIds: [target] });
  const before = scene.eventPositions[target];
  const direction = end.facing ?? before?.direction;
  scene.eventPositions[target] = { x: end.x, y: end.y, ...(direction ? { direction } : {}) };
}
