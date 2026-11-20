import { protectedCells } from "@/editor/tools/npcPatrolTools";
import { canMove } from "@/project/collision";
import { eventAlwaysBlocks, eventsCutOffBy } from "@/project/eventPassageBlock";
import { defaultChasePursuit } from "@/project/npcBehavior";
import type { Dir, EventPage, GameEvent, GameMap, MoveCommand, Project } from "@/project/types";
import { PrimitiveError } from "../../errors";

const STEPS: Record<Dir, readonly [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

function patrolCells(event: GameEvent, directions: Dir[]) {
  let at = { x: event.x, y: event.y };
  return [at, ...directions.map(dir => {
    const [dx, dy] = STEPS[dir];
    at = { x: at.x + dx, y: at.y + dy };
    return at;
  })];
}

function usesPatrolCell(event: GameEvent, x: number, y: number): boolean {
  if (eventAlwaysBlocks(event) && event.x === x && event.y === y) return true;
  return (event.pages ?? []).some(page => {
    const { route, type } = page.movement;
    if (!route?.repeat || (type !== "custom" && type !== "chase")) return false;
    let at = { x: event.x, y: event.y };
    for (const move of route.moves) {
      if (at.x === x && at.y === y) return true;
      if (move.kind === "wait") continue;
      if (move.kind !== "move") return false;
      const [dx, dy] = STEPS[move.dir];
      at = { x: at.x + dx, y: at.y + dy };
    }
    return at.x === x && at.y === y;
  });
}

export function editPatrol(
  project: Project, map: GameMap, event: GameEvent, page: EventPage, directions: Dir[], intervalMs?: number,
): EventPage {
  const { graphic, footprint, movement } = page;
  if ((!graphic.sprite?.id && !graphic.appearanceId) || graphic.transparent ||
    (footprint?.width ?? 1) !== 1 || (footprint?.height ?? 1) !== 1) {
    throw new PrimitiveError("순찰은 선택한 페이지에 보이는 한 칸 크기 캐릭터에 설정할 수 있어요.");
  }
  const cells = patrolCells(event, directions);
  const end = cells.at(-1)!;
  if (end.x !== event.x || end.y !== event.y) throw new PrimitiveError("순찰은 출발점으로 돌아와야 해요.");
  for (let index = 1; index < cells.length; index += 1) {
    const from = cells[index - 1]!, to = cells[index]!;
    if (!canMove(project, map, from.x, from.y, to.x, to.y) || !canMove(project, map, to.x, to.y, from.x, from.y)) {
      throw new PrimitiveError("순찰 경로에 지날 수 없는 칸이 있어요.");
    }
  }

  const protectedAt = protectedCells(project, map);
  for (const { x, y } of cells) {
    if (protectedAt.some(entry => Math.abs(entry.x - x) + Math.abs(entry.y - y) <= 2)) {
      throw new PrimitiveError("출입구, 시작점, 안내판 근처를 피해서 순찰 경로를 정해 주세요.");
    }
    if (map.events.some(other => other.id !== event.id && usesPatrolCell(other, x, y))) {
      throw new PrimitiveError("다른 이벤트나 순찰 경로가 사용하는 칸을 피해 주세요.");
    }
    const exits = Object.values(STEPS).filter(([dx, dy]) => canMove(project, map, x, y, x + dx, y + dy));
    if (exits.length < 3 || eventsCutOffBy(project, map, { ...event, x, y, pages: [page] }).length) {
      throw new PrimitiveError("다른 이벤트로 가는 길을 막지 않는 넓은 곳에서 순찰해 주세요.");
    }
  }

  const chase = movement.type === "chase";
  const moves: MoveCommand[] = directions.map(dir => ({ kind: "move", dir }));
  const route = {
    repeat: true, skippable: false,
    moves: chase ? moves.flatMap(move => [move, { kind: "wait" } as const]) : [...moves, { kind: "wait" } as const],
  };
  const custom = movement.type === "custom";
  return {
    ...page,
    movement: chase ? {
      ...movement, route, pursuit: { ...defaultChasePursuit(), ...movement.pursuit, onLost: "return" },
      ...(intervalMs === undefined ? {} : { moveIntervalMs: intervalMs }),
    } : {
      ...movement, type: "custom", speed: custom ? movement.speed : 2, frequency: custom ? movement.frequency : 2,
      moveIntervalMs: intervalMs ?? (custom ? movement.moveIntervalMs : undefined) ?? 1600, route,
    },
  };
}
