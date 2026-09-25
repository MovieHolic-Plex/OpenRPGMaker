// 한 칸 통로를 막는 이벤트 — 「그 이벤트를 세웠더니 너머의 방에 영영 못 간다」.
//
// 실측(2026-09-24 갤러리 호러 r5): 출구 회랑 두 방 사이 한 칸 문간에 가면 인형(보통 우선순위 = 막는 이벤트)을
// 세웠다. 대화 뒤 페이지 2 도 그림이 있어 계속 막았고, 출구 그림에 걸어갈 길이 없어 두 엔딩이 모두 닿지 않았다.
// mysteryCaseTool 은 자기 인물만 이 검사를 했다 — 여기서는 모든 이벤트 쓰기가 같은 판정을 쓴다.
// 경고만으로는 모델이 인형을 안 옮겼다. 장소 이동이 없는 영구 차단은 옆 칸으로 옮기고, 문은 칸을 유지한 채 경고만 한다.

import { canMove, isPassable, isPassableLanding } from "./collision";
import type { EventPage, GameEvent, GameMap, Project } from "./types";

function pageBlocks(page: EventPage | undefined): boolean {
  // 런타임(runtimeEventState)과 같다 — 그림이 없어도(transparent) 보통 우선순위면 막는다.
  return !!page && (page.priority ?? "same") === "same" && (page.overlapForbidden ?? true);
}

/** 이벤트가 **어느 상태에서든 끝까지** 막는가 — 모든 페이지가 막는 그림이면 참(대화 뒤 비켜 주는 페이지가 있으면 거짓). */
export function eventAlwaysBlocks(event: GameEvent): boolean {
  const pages = event.pages ?? [];
  return pages.length > 0 && pages.every((page) => pageBlocks(page));
}

function walk(project: Project, map: GameMap, seeds: readonly { x: number; y: number }[], blocked: ReadonlySet<string>): Set<string> {
  const seen = new Set<string>();
  const queue: [number, number][] = [];
  for (const { x, y } of seeds) {
    const key = `${x},${y}`;
    if (!seen.has(key) && !blocked.has(key)) { seen.add(key); queue.push([x, y]); }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const [x, y] = queue[head]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
      if (seen.has(key) || blocked.has(key) || !canMove(project, map, x, y, nx, ny)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

function entryCells(project: Project, map: GameMap): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  if (map.id === project.startMapId) out.push({ ...project.startPos });
  const visit = (commands: readonly unknown[] | undefined): void => {
    for (const raw of commands ?? []) {
      if (!raw || typeof raw !== "object") continue;
      const command = raw as Record<string, unknown>;
      if (command.kind === "transfer" && command.mapId === map.id && typeof command.x === "number" && typeof command.y === "number") out.push({ x: command.x, y: command.y });
      for (const value of Object.values(command)) {
        if (Array.isArray(value)) visit(value);
        else if (value && typeof value === "object") for (const inner of Object.values(value as Record<string, unknown>)) if (Array.isArray(inner)) visit(inner);
      }
    }
  };
  for (const source of Object.values(project.maps)) {
    for (const event of source.events ?? []) {
      visit(event.commands);
      for (const page of event.pages ?? []) visit(page.commands);
    }
  }
  return out;
}

const touches = (cells: ReadonlySet<string>, x: number, y: number): boolean =>
  cells.has(`${x},${y}`) || cells.has(`${x + 1},${y}`) || cells.has(`${x - 1},${y}`) || cells.has(`${x},${y + 1}`) || cells.has(`${x},${y - 1}`);

/** 이 이벤트가 서 있어서 입구에서 닿지 못하게 된 다른 이벤트들. 비어 있으면 통로를 막지 않는다. */
export function eventsCutOffBy(project: Project, map: GameMap, event: GameEvent): GameEvent[] {
  if (!eventAlwaysBlocks(event)) return [];
  const seeds = entryCells(project, map);
  if (seeds.length === 0) return [];
  const others = (map.events ?? []).filter((other) => other.id !== event.id);
  const otherBlocked = new Set(others.filter(eventAlwaysBlocks).map((other) => `${other.x},${other.y}`));
  const without = walk(project, map, seeds, otherBlocked);
  const withIt = walk(project, map, seeds, new Set([...otherBlocked, `${event.x},${event.y}`]));
  return others.filter((other) => touches(without, other.x, other.y) && !touches(withIt, other.x, other.y));
}

const DOOR_COMMANDS = new Set(["transfer", "callMapEvent"]);

function commandsInclude(commands: readonly unknown[] | undefined, kinds: ReadonlySet<string>): boolean {
  for (const raw of commands ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const command = raw as Record<string, unknown>;
    if (typeof command.kind === "string" && kinds.has(command.kind)) return true;
    for (const value of Object.values(command)) {
      if (Array.isArray(value) && commandsInclude(value, kinds)) return true;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const inner of Object.values(value as Record<string, unknown>)) {
          if (Array.isArray(inner) && commandsInclude(inner, kinds)) return true;
        }
      }
    }
  }
  return false;
}

/** 문·발판은 그 칸에 있어야 한다. 인형·NPC 처럼 대화만 하는 이벤트와 구분한다. */
function isDoorEvent(event: GameEvent): boolean {
  if (commandsInclude(event.commands, DOOR_COMMANDS)) return true;
  return (event.pages ?? []).some((page) => commandsInclude(page.commands, DOOR_COMMANDS));
}

function reliefCells(x: number, y: number): { x: number; y: number }[] {
  const cells: { x: number; y: number; radius: number; ortho: number }[] = [];
  for (let radius = 1; radius <= 3; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        cells.push({ x: x + dx, y: y + dy, radius, ortho: dx === 0 || dy === 0 ? 0 : 1 });
      }
    }
  }
  cells.sort((a, b) => a.radius - b.radius || a.ortho - b.ortho || a.y - b.y || a.x - b.x);
  return cells;
}

/**
 * 모든 페이지가 막는 비문 이벤트가 통로를 끊으면 반경 3칸 안에서 끊지 않는 통행 칸으로 옮긴다.
 * 모델은 경고를 무시하고 문간에 인형을 둔 채 엔딩을 막았다(갤러리 r5). 거부하지 않는다.
 *
 * 후보 수락에 「문(transfer) 앞칸이 가장 큰 통행 컴포넌트에 남는다」를 함께 본다.
 * cut 판정은 transfer 랜딩을 씨앗으로 우주 전체를 보므로, 랜딩 셀이 문과 바로 인접할 때
 * 복도 한 칸(랜딩 너머)을 막는 이동을 놓치고 마을에서 문으로 못 걸어가는 상태를 만들 수 있다
 * (2026-09-24 몬스터 수집 r2: 루트1 랜딩 (32,1) 씨앗 때문에 안내판을 (32,2) 복도 안에 받아
 * 북쪽 게이트가 마을 쪽에서 도달 불가였다).
 */
function relievePermanentChoke(project: Project, map: GameMap, event: GameEvent): string | undefined {
  if (!eventAlwaysBlocks(event) || isDoorEvent(event)) return undefined;
  const cut = eventsCutOffBy(project, map, event);
  if (cut.length === 0) return undefined;
  const from = { x: event.x, y: event.y };
  const doors = (map.events ?? []).filter((other) => other.id !== event.id && isDoorEvent(other));
  for (const cell of reliefCells(from.x, from.y)) {
    if (!isPassableLanding(project, map, cell.x, cell.y)) continue;
    if ((map.events ?? []).some((other) => other.id !== event.id && other.x === cell.x && other.y === cell.y)) continue;
    event.x = cell.x;
    event.y = cell.y;
    if (eventsCutOffBy(project, map, event).length > 0) continue;
    if (!doorApproachesIntact(project, map, doors)) continue;
    const names = cut.slice(0, 4).map((other) => `'${other.name ?? other.id}'`).join(", ");
    return `이벤트 '${event.name ?? event.id}'(${from.x},${from.y})가 통로를 막아 ${names}에 닿을 수 없어 (${cell.x},${cell.y})으로 옮겼습니다. `
      + "길을 막는 인물은 문간이 아니라 옆 칸에 두세요.";
  }
  event.x = from.x;
  event.y = from.y;
  return undefined;
}

/**
 * (호출 시점 이벤트 위치 = 이동 후보)에서 각 문의 접근 가능한 인접 칸 중 최소 하나가
 * 가장 큰 통행 컴포넌트(타일 + 막는 이벤트)에 붙어 있는가.
 * 애초에 통행 가능한 인접 칸이 없는 문은 후보 탓이 아니므로 건너뛴다.
 */
function doorApproachesIntact(project: Project, map: GameMap, doors: readonly GameEvent[]): boolean {
  if (doors.length === 0) return true;
  const blocked = new Set(
    (map.events ?? []).filter((other) => eventAlwaysBlocks(other)).map((other) => `${other.x},${other.y}`),
  );
  const sizes = new Map<string, number>();
  let largest = 0;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const key = `${x},${y}`;
      if (sizes.has(key) || blocked.has(key) || !isPassable(project, map, x, y)) continue;
      const component = walk(project, map, [{ x, y }], blocked);
      for (const memberKey of component) {
        if (!sizes.has(memberKey)) sizes.set(memberKey, component.size);
      }
      largest = Math.max(largest, component.size);
    }
  }
  for (const door of doors) {
    const approaches: string[] = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = door.x + dx;
      const ny = door.y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      if (!isPassable(project, map, nx, ny) || blocked.has(`${nx},${ny}`)) continue;
      approaches.push(`${nx},${ny}`);
    }
    if (approaches.length === 0) continue;
    if (!approaches.some((key) => sizes.get(key) === largest)) return false;
  }
  return true;
}

export function passageBlockWarning(project: Project, map: GameMap, event: GameEvent): string | undefined {
  // 호출 시점에 이벤트를 옮긴다. upsert_event·place_npc 가 저장 직후 이 함수만 부른다.
  const relieved = relievePermanentChoke(project, map, event);
  if (relieved) return relieved;
  const cut = eventsCutOffBy(project, map, event);
  if (cut.length === 0) return undefined;
  const names = cut.slice(0, 4).map((other) => `'${other.name ?? other.id}'(${other.x},${other.y})`).join(", ");
  return `이벤트 '${event.name ?? event.id}'(${event.x},${event.y})가 통로를 막아 ${names}${cut.length > 4 ? ` 외 ${cut.length - 4}개` : ""}에 걸어서 닿을 수 없습니다 — `
    + "모든 페이지가 보통 우선순위(막음)입니다. 옆 칸으로 옮기거나, 일을 마친 뒤 페이지를 priority \"below\"(밑으로 지나감)로 두세요.";
}
