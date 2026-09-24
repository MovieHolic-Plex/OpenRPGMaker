// 한 칸 통로를 막는 이벤트 — 「그 이벤트를 세웠더니 너머의 방에 영영 못 간다」.
//
// 실측(2026-09-24 갤러리 호러 r5): 출구 회랑 두 방 사이 한 칸 문간에 가면 인형(보통 우선순위 = 막는 이벤트)을
// 세웠다. 대화 뒤 페이지 2 도 그림이 있어 계속 막았고, 출구 그림에 걸어갈 길이 없어 두 엔딩이 모두 닿지 않았다.
// mysteryCaseTool 은 자기 인물만 이 검사를 했다 — 여기서는 모든 이벤트 쓰기가 같은 판정을 쓴다(경고일 뿐, 거부 아님).

import { canMove } from "./collision";
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

export function passageBlockWarning(project: Project, map: GameMap, event: GameEvent): string | undefined {
  const cut = eventsCutOffBy(project, map, event);
  if (cut.length === 0) return undefined;
  const names = cut.slice(0, 4).map((other) => `'${other.name ?? other.id}'(${other.x},${other.y})`).join(", ");
  return `이벤트 '${event.name ?? event.id}'(${event.x},${event.y})가 통로를 막아 ${names}${cut.length > 4 ? ` 외 ${cut.length - 4}개` : ""}에 걸어서 닿을 수 없습니다 — `
    + "모든 페이지가 보통 우선순위(막음)입니다. 옆 칸으로 옮기거나, 일을 마친 뒤 페이지를 priority \"below\"(밑으로 지나감)로 두세요.";
}
