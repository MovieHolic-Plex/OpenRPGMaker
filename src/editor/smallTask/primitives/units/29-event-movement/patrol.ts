import { resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { commandDelta, facingForDelta, jumpDelta, relativeTurn } from "@/player/playSceneAutonomousRouteDirection";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { resolveEventAppearanceGraphic } from "@/project/characterAppearances";
import { canMove, canMoveFootprint, inBounds, isLedgeCell, isPassableLanding } from "@/project/collision";
import { eventsCutOffBy } from "@/project/eventPassageBlock";
import { eventDisplayName } from "@/project/eventDisplayName";
import { normalizeCharacterFootprint, normalizePassRows, passageBounds, pointRect } from "@/project/footprint";
import { defaultChasePursuit } from "@/project/npcBehavior";
import { startSession, startStateOf } from "@/project/session";
import { isSpatialPlacementBlocking } from "@/project/spatialOccupancy";
import { dirToward } from "@/project/staging/approach";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import type { Command, Dir, EventPage, EventPageMovement, GameEvent, GameMap, MoveCommand, MoveRoute, Project } from "@/project/types";
import { PrimitiveError } from "../../errors";

const STEPS: Record<Dir, readonly [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
type Cell = { x: number; y: number };

function patrolCells(event: GameEvent, directions: Dir[]) {
  let at = { x: event.x, y: event.y };
  return [at, ...directions.map(dir => {
    const [dx, dy] = STEPS[dir];
    at = { x: at.x + dx, y: at.y + dy };
    return at;
  })];
}

function protectedCells(project: Project, map: GameMap) {
  const cells = map.id === project.startMapId ? [project.startPos] : [];
  const connectionArrivals: Cell[] = [];
  for (const { from, to, playerEnabled } of project.mapConnections ?? []) {
    if (!playerEnabled) continue;
    if (from.mapId === map.id) cells.push(from);
    if (to.mapId === map.id) {
      cells.push(to);
      connectionArrivals.push(to);
    }
  }
  const commonEvents = new Map(project.commonEvents.map(event => [event.id, event]));

  function scanTransfers(commands: readonly Command[], seen: Set<readonly Command[]>, source?: GameMap): boolean {
    if (seen.has(commands)) return false;
    seen.add(commands);
    let transfers = false;
    for (const command of commands) {
      if (command.kind === "transfer") {
        if (command.mapId === map.id) cells.push({ x: command.x, y: command.y });
        transfers = true;
      }
      if (command.kind === "callCommonEvent") {
        const common = commonEvents.get(command.commonEventId);
        if (common && scanTransfers(common.commands, seen, source)) transfers = true;
      }
      if (command.kind === "callMapEvent") {
        const called = source?.events.find(event => event.id === command.eventId);
        for (const list of called ? [called.commands, ...(called.pages ?? []).map(page => page.commands)] : []) {
          if (scanTransfers(list, seen, source)) transfers = true;
        }
      }
      for (const branch of nestedCommandLists(command)) {
        if (scanTransfers(branch, seen, source)) transfers = true;
      }
    }
    return transfers;
  }

  for (const source of Object.values(project.maps)) {
    for (const event of source.events) {
      const seen = new Set<readonly Command[]>();
      const lists = event.pages?.length ? event.pages.map(page => page.commands) : [event.commands];
      let transfers = false;
      for (const commands of lists) {
        if (scanTransfers(commands, seen, source)) transfers = true;
      }
      if (source.id === map.id && (transfers || /표지|안내/u.test(eventDisplayName(event)))) {
        cells.push({ x: event.x, y: event.y });
      }
    }
  }
  for (const common of commonEvents.values()) {
    if (common.trigger !== "none") scanTransfers(common.commands, new Set());
  }
  for (const troop of project.database.troops) {
    for (const { commands } of troopAfterBattleLists(troop)) scanTransfers(commands, new Set());
  }
  return { cells, connectionArrivals };
}

function routeVisits(
  project: Project, map: GameMap, event: GameEvent, route: MoveRoute | undefined,
  covers: (x: number, y: number) => boolean, page?: EventPage,
): boolean {
  if (!route) return false;
  const chase = page?.movement.type === "chase";
  const repeat = chase || route.repeat;
  const skipsBlocked = chase || route.skippable !== false;
  const footprint = normalizeCharacterFootprint(page?.footprint);
  const passRows = normalizePassRows(page?.passRows, footprint.height);
  const seen = new Set<string>();
  let at: Cell | undefined = { x: event.x, y: event.y };
  if (covers(at.x, at.y)) return true;
  let facing: Dir | undefined = page?.graphic.direction ?? "down";
  let directionFixed = page?.animationType === "fixedDirection" || page?.animationType === "fixedDirectionStep";
  let through = false;

  function face(direction: Dir | undefined) {
    if (!directionFixed) facing = direction;
  }

  function canWalkLeg(from: Cell, to: Cell): boolean {
    const leavingWall = footprint.width === 1 && footprint.height === 1 &&
      !isPassableLanding(project, map, from.x, from.y);
    return !isLedgeCell(project, map, to.x, to.y) && (leavingWall
      ? isPassableLanding(project, map, to.x, to.y)
      : canMoveFootprint(project, map, from.x, from.y, footprint, to.x, to.y, passRows));
  }

  function step(delta: Cell, direction: Dir, jump = false): boolean {
    face(direction); // Runtime updates facing even when the step is blocked.
    if (!at) return true;
    const to = { x: at.x + delta.x, y: at.y + delta.y };
    let allowed: boolean;
    if (through || jump) {
      allowed = inBounds(map, to.x, to.y);
    } else if (delta.x && delta.y) {
      const horizontal = { x: to.x, y: at.y };
      const vertical = { x: at.x, y: to.y };
      allowed = (canWalkLeg(at, horizontal) && canWalkLeg(horizontal, to)) ||
        (canWalkLeg(at, vertical) && canWalkLeg(vertical, to));
    } else {
      allowed = canWalkLeg(at, to);
    }
    if (allowed) at = to;
    return allowed || skipsBlocked;
  }

  do {
    // The authored terrain is static. A repeated cycle-start state cannot reach a new cell.
    const state = `${at?.x},${at?.y},${facing},${directionFixed},${through}`;
    if (seen.has(state)) return false;
    seen.add(state);
    for (const move of route.moves) {
      switch (move.kind) {
        case "move": case "stepForward": {
          const direction: Dir | undefined = move.kind === "move" ? move.dir : facing;
          if (direction) {
            if (!step(commandDelta(direction), direction)) return false;
          } else {
            at = undefined;
          }
          break;
        }
        case "moveDiagonal":
          if (!step({ x: STEPS[move.horizontal][0], y: STEPS[move.vertical][1] }, move.horizontal)) return false;
          break;
        case "jump": {
          if (!move.dx && !move.dy && !facing) {
            at = undefined;
            break;
          }
          const delta = jumpDelta(move, facing ?? "down");
          if (!step(delta, facingForDelta(delta.x, delta.y, "down"), true)) return false;
          break;
        }
        case "placeAt": {
          const x = Math.round(move.x), y = Math.round(move.y);
          if (inBounds(map, x, y)) at = { x, y };
          break;
        }
        case "setDirectionFix":
          directionFixed = move.enabled;
          break;
        case "setThrough":
          through = move.enabled;
          break;
        case "turn":
          face(move.dir);
          break;
        case "turnRelative":
          face(facing && move.turn !== "leftOrRight90" ? relativeTurn(facing, move.turn, () => 0) : undefined);
          break;
        case "turnToward":
          face(at && !move.target && move.x !== undefined && move.y !== undefined
            ? dirToward(at, { x: move.x, y: move.y }) ?? facing : undefined);
          break;
        case "turnRandom": case "turnTowardPlayer": case "turnAwayFromPlayer":
          face(undefined);
          break;
        case "moveRandom": case "moveTowardPlayer": case "moveAwayFromPlayer":
        case "approach": case "exitVia": case "enterVia": case "npcTransfer":
          at = undefined;
          face(undefined);
          break;
      }
      if (at && covers(at.x, at.y)) return true;
    }
  } while (repeat);
  return false;
}

function usesPatrolCell(project: Project, map: GameMap, event: GameEvent, cells: readonly Cell[]): boolean {
  const sameCell = (atX: number, atY: number) => cells.some(({ x, y }) => atX === x && atY === y);
  if (!event.pages?.length) return sameCell(event.x, event.y) || routeVisits(project, map, event, event.moveRoute, sameCell);
  return event.pages.some(page => {
    const blocks = (page.priority ?? "same") === "same" && (page.overlapForbidden ?? true);
    const footprint = normalizeCharacterFootprint(page.footprint);
    const passRows = normalizePassRows(page.passRows, footprint.height);
    const covers = (atX: number, atY: number) => {
      if (!blocks) return sameCell(atX, atY);
      const rect = passageBounds(atX, atY, footprint, passRows);
      return cells.some(({ x, y }) => rect.left <= x && x <= rect.right && rect.top <= y && y <= rect.bottom);
    };
    if (blocks && covers(event.x, event.y)) return true;
    const { route, type } = page.movement;
    return (type === "custom" || type === "chase") && routeVisits(project, map, event, route, covers, page);
  });
}

export function editPatrol(
  project: Project, map: GameMap, event: GameEvent, page: EventPage, directions: Dir[], intervalMs?: number,
): EventPageMovement {
  const { graphic, footprint, movement } = page;
  const resolved = resolveEventAppearanceGraphic(project, graphic);
  const sprite = resolved.sprite ?? event.sprite;
  if (!sprite?.id || !resolveEventSpriteTexture(project, sprite.id, resolved.pattern) || graphic.transparent ||
    (footprint?.width ?? 1) !== 1 || (footprint?.height ?? 1) !== 1) {
    throw new PrimitiveError("순찰은 선택한 페이지에 보이는 한 칸 크기 캐릭터에 설정할 수 있어요.");
  }
  const cells = patrolCells(event, directions);
  const end = cells.at(-1)!;
  if (end.x !== event.x || end.y !== event.y) throw new PrimitiveError("순찰은 출발점으로 돌아와야 해요.");
  for (let index = 1; index < cells.length; index += 1) {
    const from = cells[index - 1]!, to = cells[index]!;
    if (isLedgeCell(project, map, to.x, to.y) || !canMove(project, map, from.x, from.y, to.x, to.y) ||
      !canMove(project, map, to.x, to.y, from.x, from.y)) {
      throw new PrimitiveError("순찰 경로에 지날 수 없는 칸이 있어요.");
    }
  }

  const start = startStateOf(project);
  if (start.farmBuildingPlacements?.length || start.homeDecorationPlacements?.length) {
    const session = startSession(project, 0);
    if (cells.some(({ x, y }) => isSpatialPlacementBlocking(project, session, map.id, pointRect(x, y)))) {
      throw new PrimitiveError("순찰 경로에 지날 수 없는 칸이 있어요.");
    }
  }
  const { cells: protectedAt, connectionArrivals } = protectedCells(project, map);
  if (cells.some(({ x, y }) => protectedAt.some(entry => Math.abs(entry.x - x) + Math.abs(entry.y - y) <= 2))) {
    throw new PrimitiveError("출입구, 시작점, 안내판 근처를 피해서 순찰 경로를 정해 주세요.");
  }
  if (map.events.some(other => other.id !== event.id && usesPatrolCell(project, map, other, cells))) {
    throw new PrimitiveError("다른 이벤트나 순찰 경로가 사용하는 칸을 피해 주세요.");
  }
  for (const { x, y } of cells) {
    const exits = Object.values(STEPS).filter(([dx, dy]) => canMove(project, map, x, y, x + dx, y + dy));
    if (exits.length < 3 || eventsCutOffBy(project, map, { ...event, x, y, pages: [page] }, connectionArrivals).length) {
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
  return chase ? {
    ...movement, route, pursuit: { ...defaultChasePursuit(), ...movement.pursuit, onLost: "return" },
    ...(intervalMs === undefined ? {} : { moveIntervalMs: intervalMs }),
  } : {
    ...movement, type: "custom", speed: custom ? movement.speed : 2, frequency: custom ? movement.frequency : 2,
    moveIntervalMs: intervalMs ?? (custom ? movement.moveIntervalMs : undefined) ?? 1600, route,
  };
}
