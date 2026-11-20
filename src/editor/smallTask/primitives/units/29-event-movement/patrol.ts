import { resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { resolveEventAppearanceGraphic } from "@/project/characterAppearances";
import { canMove, isLedgeCell } from "@/project/collision";
import { eventsCutOffBy } from "@/project/eventPassageBlock";
import { eventDisplayName } from "@/project/eventDisplayName";
import { normalizeCharacterFootprint, normalizePassRows, passageBounds } from "@/project/footprint";
import { defaultChasePursuit } from "@/project/npcBehavior";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import type { Command, Dir, EventPage, EventPageMovement, GameEvent, GameMap, MoveCommand, MoveRoute, Project } from "@/project/types";
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

function protectedCells(project: Project, map: GameMap): { x: number; y: number }[] {
  const cells = map.id === project.startMapId ? [project.startPos] : [];
  for (const { from, to, playerEnabled } of project.mapConnections ?? []) {
    if (!playerEnabled) continue;
    if (from.mapId === map.id) cells.push(from);
    if (to.mapId === map.id) cells.push(to);
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
  return cells;
}

function routeVisits(event: GameEvent, route: MoveRoute | undefined, covers: (x: number, y: number) => boolean): boolean {
  if (!route) return false;
  let at = { x: event.x, y: event.y };
  for (const move of route.moves) {
    if (covers(at.x, at.y)) return true;
    switch (move.kind) {
      case "move": {
        const [dx, dy] = STEPS[move.dir];
        at = { x: at.x + dx, y: at.y + dy };
        break;
      }
      case "moveDiagonal":
        at = { x: at.x + STEPS[move.horizontal][0], y: at.y + STEPS[move.vertical][1] };
        break;
      case "jump":
        if (!move.dx && !move.dy) return false;
        at = { x: at.x + move.dx, y: at.y + move.dy };
        break;
      case "placeAt":
        at = { x: move.x, y: move.y };
        break;
      case "moveRandom": case "moveTowardPlayer": case "moveAwayFromPlayer": case "stepForward":
      case "approach": case "exitVia": case "enterVia": case "npcTransfer":
        return false; // 현재 플레이 상태에 따라 이후 위치가 달라진다.
    }
  }
  return covers(at.x, at.y);
}

function usesPatrolCell(event: GameEvent, x: number, y: number): boolean {
  const sameCell = (atX: number, atY: number) => atX === x && atY === y;
  if (!event.pages?.length) return sameCell(event.x, event.y) || routeVisits(event, event.moveRoute, sameCell);
  return event.pages.some(page => {
    const blocks = (page.priority ?? "same") === "same" && (page.overlapForbidden ?? true);
    const footprint = normalizeCharacterFootprint(page.footprint);
    const passRows = normalizePassRows(page.passRows, footprint.height);
    const covers = (atX: number, atY: number) => {
      if (!blocks) return sameCell(atX, atY);
      const rect = passageBounds(atX, atY, footprint, passRows);
      return rect.left <= x && x <= rect.right && rect.top <= y && y <= rect.bottom;
    };
    if (blocks && covers(event.x, event.y)) return true;
    const { route, type } = page.movement;
    return (type === "custom" || type === "chase") && routeVisits(event, route, covers);
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
  return chase ? {
    ...movement, route, pursuit: { ...defaultChasePursuit(), ...movement.pursuit, onLost: "return" },
    ...(intervalMs === undefined ? {} : { moveIntervalMs: intervalMs }),
  } : {
    ...movement, type: "custom", speed: custom ? movement.speed : 2, frequency: custom ? movement.frequency : 2,
    moveIntervalMs: intervalMs ?? (custom ? movement.moveIntervalMs : undefined) ?? 1600, route,
  };
}
