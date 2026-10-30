// project/doorEntries.ts
// 「문으로 들어간다」 — 이동 문은 문 앞에 서는 것만으로는 발동하지 않고, 문 앞 칸에서 문 쪽으로 걸어 들어갈 때 발동한다.
//
// 문 앞 칸(발판)을 밟는 순간 다른 맵으로 옮기면 「문 앞에 서자마자 이동」이 된다(2026-10-30 사용자 「판정으로서 별로」).
// 그래서 다른 맵으로 가는 접촉 이벤트(playerTouch·touch)가 문(map.doors, 또는 그림에서 추론한 문 — mapDoorKinds.inferMapDoor)에
// 묶여 있으면 그 이벤트의 입구를 하나로 정한다:
//   step = 문 앞 칸(문 그림 맨 아래 줄 바로 아래, 걸을 수 있는 칸) · door = 들어가는 문 칸 · dir = 문 쪽(위).
// 두 저작 형태를 같이 읽는다 —
//   - 문 칸 이벤트(새 형태, create_transfer_pair·link_maps·link_jp_city_interior 기본): 이벤트가 문 그림 칸에 있다(막힌 칸이면 부딪힘).
//   - 문 앞 칸 이벤트(옛 형태, onStep): 이벤트가 문 바로 아래 걸음 칸에 있다. 런타임은 이 칸을 밟아도 발동하지 않고(playSceneDoorEntry),
//     그 칸에서 문 쪽으로 밀 때 발동한다 — 옛 맵을 다시 굽지 않아도 같은 판정이 된다.
// 넓은 문(2×1·2×2)은 문 폭의 모든 문 앞 칸이 입구다 — 자기 이벤트가 없는 칸은 같은 문의 이벤트로 들어간다.
// 문짝 없는 출구(통로·아치·성문 통로·계단·동굴 — kind none)는 대상이 아니다: 그런 칸은 밟아서 지나가는 출구다.
import { isPassable } from "@/project/collision";
import { inferMapDoor, mapDoorAt } from "@/project/mapDoorKinds";
import type { GameEvent, GameMap, Project } from "@/project/types";

type Cell = { readonly x: number; readonly y: number };
export type DoorEntryDir = "up";

export interface DoorEntry {
  readonly eventId: string;
  /** 문 앞 칸 — 여기 서서 dir 쪽으로 밀면 들어간다. */
  readonly step: Cell;
  /** 들어가는 문 칸(문 그림 맨 아래 줄). */
  readonly door: Cell;
  readonly dir: DoorEntryDir;
  /** 이벤트가 문 앞 칸 자체에 있다(옛 저작) — 밟아도 발동하지 않는다. */
  readonly onStep: boolean;
  /** 문 그림 사각형(칸). */
  readonly rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  /** 이 이벤트가 옮겨 가는 맵들. */
  readonly targetMapIds: readonly string[];
}

const TOUCH_KINDS = new Set(["touch", "playerTouch"]);

/** 명령 속 다른 맵 이동의 목적지들. callMapEvent 는 같은 맵의 그 이벤트(문 본체) 명령까지 한 단계 따라간다 — 집 문 발판이 문 본체를 부른다. */
function walkTransfers(commands: readonly unknown[] | undefined, map: GameMap, out: Set<string>, called: Set<string>): void {
  for (const raw of commands ?? []) {
    const c = raw as { kind?: string; mapId?: string; door?: boolean; eventId?: string; [key: string]: unknown };
    if (c.kind === "transfer" && typeof c.mapId === "string" && c.mapId !== map.id && c.door !== false) out.add(c.mapId);
    if (c.kind === "callMapEvent" && typeof c.eventId === "string" && !called.has(c.eventId) && called.size < 2) {
      called.add(c.eventId);
      const target = (map.events ?? []).find((e) => e.id === c.eventId);
      for (const page of target?.pages ?? []) walkTransfers(page.commands as unknown[], map, out, called);
    }
    for (const key of ["then", "else", "commands", "body"]) if (Array.isArray(c[key])) walkTransfers(c[key] as unknown[], map, out, called);
  }
}

/** 다른 맵으로 옮기는 접촉(밟기·부딪힘) 이벤트면 그 목적지 맵들과 부른 문 본체 이벤트. 아니면 목적지 빈 배열. */
function touchTransferTargets(event: GameEvent, map: GameMap): { targets: string[]; called: Set<string> } {
  const out = new Set<string>();
  const called = new Set<string>();
  const pages = event.pages ?? [];
  if (pages.length) {
    for (const page of pages) if (TOUCH_KINDS.has(page.trigger?.kind ?? event.trigger?.kind ?? "")) walkTransfers(page.commands as unknown[], map, out, called);
  } else if (TOUCH_KINDS.has(event.trigger?.kind ?? "")) walkTransfers(event.commands as unknown[], map, out, called);
  return { targets: [...out], called };
}

const cache = new WeakMap<GameMap, { readonly key: string; readonly project: Project; readonly entries: readonly DoorEntry[] }>();

/** 맵의 문 입구 전부. 맵·이벤트·문 정의 수가 같으면 다시 계산하지 않는다. */
export function doorEntriesForMap(project: Project, map: GameMap): readonly DoorEntry[] {
  const key = `${map.events?.length ?? 0}|${map.doors?.length ?? 0}|${map.tilesetId}|${map.width}x${map.height}`;
  const hit = cache.get(map);
  if (hit && hit.key === key && hit.project === project) return hit.entries;
  const entries = computeDoorEntries(project, map);
  cache.set(map, { key, project, entries });
  return entries;
}

function computeDoorEntries(project: Project, map: GameMap): DoorEntry[] {
  const inside = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height;
  type Bound = { event: GameEvent; rect: DoorEntry["rect"]; onStep: boolean; targets: string[] };
  const bound: Bound[] = [];
  for (const event of map.events ?? []) {
    const { targets, called } = touchTransferTargets(event, map);
    if (!targets.length) continue;
    const cell = { x: event.x, y: event.y };
    let rect: DoorEntry["rect"] | undefined = mapDoorAt(map.doors, cell);
    // 집 문 발판: 바로 윗칸(벽)에 선 문 본체 이벤트(문 그림 캐릭터)를 부르면 그 칸이 문이다.
    const body = !rect ? (map.events ?? []).find((e) => called.has(e.id) && e.x === event.x && e.y === event.y - 1) : undefined;
    if (body) rect = { x: body.x, y: body.y, w: 1, h: 1 };
    if (!rect) {
      const inferred = inferMapDoor(project, map, cell);
      if (!inferred || inferred.kind === "none") continue;
      rect = inferred.rect;
    }
    if (event.x < rect.x || event.x >= rect.x + rect.w) continue;
    const bottom = rect.y + rect.h - 1;
    if (event.y === bottom + 1) {
      // 옛 형태: 문 앞 칸 이벤트. 그 칸이 걸을 수 있어야 문 앞이다.
      if (!isPassable(project, map, event.x, event.y)) continue;
      bound.push({ event, rect, onStep: true, targets });
    } else if (event.y >= rect.y && event.y <= bottom) {
      bound.push({ event, rect, onStep: false, targets });
    }
  }
  const entries: DoorEntry[] = [];
  const claimed = new Set<string>();
  const add = (b: Bound, x: number) => {
    const bottom = b.rect.y + b.rect.h - 1;
    const step = { x, y: bottom + 1 };
    const k = `${step.x},${step.y}`;
    if (claimed.has(k) || !inside(step) || !isPassable(project, map, step.x, step.y)) return;
    claimed.add(k);
    entries.push({ eventId: b.event.id, step, door: { x, y: bottom }, dir: "up", onStep: b.onStep && b.event.x === x, rect: b.rect, targetMapIds: b.targets });
  };
  // 자기 칸 먼저(이벤트마다 그 열), 그다음 넓은 문의 나머지 열(그 열에 자기 이벤트가 없을 때).
  for (const b of bound) add(b, b.event.x);
  for (const b of bound) for (let x = b.rect.x; x < b.rect.x + b.rect.w; x++) add(b, x);
  return entries;
}

/** 이벤트가 그 칸에 있는 옛 문 앞 발판인가(밟아도 발동하지 않는다). */
export function isDoorstepPad(project: Project, map: GameMap, eventId: string, x: number, y: number): boolean {
  return doorEntriesForMap(project, map).some((e) => e.onStep && e.eventId === eventId && e.step.x === x && e.step.y === y);
}

/** (x,y) 문 앞 칸에서 dir 쪽으로 들어가는 입구. */
export function doorEntryAt(project: Project, map: GameMap, x: number, y: number, dir?: string): DoorEntry | undefined {
  return doorEntriesForMap(project, map).find((e) => e.step.x === x && e.step.y === y && (!dir || e.dir === dir));
}

/** 문 그림 칸(사각형 아무 칸)이나 옛 문 앞 발판 칸을 누른 입구 — 맵 탭 걷기가 그 문 앞까지 걸어가 들어간다. */
export function doorEntryForTappedCell(project: Project, map: GameMap, x: number, y: number): DoorEntry | undefined {
  const entries = doorEntriesForMap(project, map);
  return entries.find((e) => e.door.x === x && y >= e.rect.y && y <= e.door.y)
    ?? entries.find((e) => e.onStep && e.step.x === x && e.step.y === y);
}

const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" } as const;

/**
 * 다른 맵에서 이 맵으로 옮겨 올 때의 도착 칸 보정.
 *  - 도착 칸이 문 앞 칸이면 그대로, 문을 등지는 쪽을 본다.
 *  - 옛 도구가 문 앞 발판을 다시 밟지 않게 한 칸 더 아래(바깥)에 내리던 도착이면, 그 문이 방금 떠난 맵으로 가는 문일 때
 *    문 앞 칸으로 올린다 — 이제 문 앞 칸은 밟아도 발동하지 않으니 문 바로 앞에 나와 선다.
 * 문과 무관한 도착이면 null.
 */
export function doorstepArrival(project: Project, map: GameMap, x: number, y: number, fromMapId?: string): { x: number; y: number; facing: "up" | "down" | "left" | "right"; moved: boolean } | null {
  const entries = doorEntriesForMap(project, map);
  const here = entries.find((e) => e.step.x === x && e.step.y === y);
  if (here) return { x, y, facing: OPPOSITE[here.dir], moved: false };
  if (!fromMapId) return null;
  const above = entries.find((e) => e.onStep && e.step.x === x && e.step.y === y - 1 && e.targetMapIds.includes(fromMapId));
  if (!above) return null;
  // 문 앞 칸에 그 문 발판 말고 다른 이벤트(사람·물건)가 서 있으면 올리지 않는다.
  if ((map.events ?? []).some((ev) => ev.x === above.step.x && ev.y === above.step.y && ev.id !== above.eventId)) return null;
  return { x: above.step.x, y: above.step.y, facing: OPPOSITE[above.dir], moved: true };
}
