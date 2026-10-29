// project/kitDoors.ts
// 타일셋 구조 키트의 「닫힘 ↔ 열림」 짝으로 그린 문(예: 버들항 던전 `bd-dg-door-closed` ↔ `bd-dg-door-open`, 1×2).
//
// 짝은 키트 id 로만 정한다(타일 번호를 박지 않는다): `X-open` 의 짝은 `X-closed`, 없으면 `X`. 크기가 같고 그림이 한 칸이라도 달라야 한다.
// 런타임(문 여는 연출)과 저작 도구(문 이벤트에 「문 열기」 명령 넣기)가 같이 쓴다 — 둘이 같은 칸·같은 그림을 보게 하려고 여기 한 곳에 둔다.
import { DOOR_OPEN_FX_ID } from "@/project/containerFx";
import type { Command, GameMap, Project, TilesetDef } from "@/project/types";

type Cell = { readonly x: number; readonly y: number };
type KitRows = readonly { readonly tiles?: readonly number[]; readonly upperTiles?: readonly number[] }[];
type KitLike = { readonly id: string; readonly width: number; readonly height: number; readonly rows?: KitRows };

/** 키트 칸 하나의 두 층(아래 = lowerTiles, 위 = upperTiles). -1 = 그 층은 비교·변경하지 않는다. */
type KitCell = { readonly dx: number; readonly dy: number; readonly lower: number; readonly upper: number };

export interface KitDoorPair {
  readonly closedId: string;
  readonly openId: string;
  readonly width: number;
  readonly height: number;
  readonly closed: readonly KitCell[];
  readonly open: readonly KitCell[];
}

export type KitDoorLayer = "lower" | "upper";

export interface KitDoorMatch {
  readonly pair: KitDoorPair;
  /** 키트 왼쪽 위 칸(맵 좌표). */
  readonly origin: Cell;
  readonly state: "closed" | "open";
  /** 닫힘 → 열림에서 바뀌는 칸·층(맵 좌표). */
  readonly changes: readonly { readonly layer: KitDoorLayer; readonly x: number; readonly y: number; readonly closed: number; readonly open: number }[];
}

/** 칸 읽기 — 런타임은 세션의 changeTile 덮어쓰기까지 본다. 맵 밖이면 호출되지 않는다. */
export type KitDoorTileReader = (layer: KitDoorLayer, index: number) => number;

function kitCells(kit: KitLike): KitCell[] | null {
  const rows = kit.rows;
  if (!Array.isArray(rows) || rows.length !== kit.height) return null;
  const cells: KitCell[] = [];
  for (let dy = 0; dy < kit.height; dy++) {
    for (let dx = 0; dx < kit.width; dx++) {
      const lower = rows[dy]?.tiles?.[dx] ?? -1;
      const upper = rows[dy]?.upperTiles?.[dx] ?? -1;
      cells.push({ dx, dy, lower: Number.isInteger(lower) ? lower : -1, upper: Number.isInteger(upper) ? upper : -1 });
    }
  }
  return cells;
}

const pairCache = new WeakMap<object, readonly KitDoorPair[]>();

/** 타일셋의 닫힘/열림 키트 짝(그림이 한 칸이라도 다른 것만). */
export function kitDoorPairs(tileset: TilesetDef | undefined): readonly KitDoorPair[] {
  const kits = (tileset as { structureKits?: readonly unknown[] } | undefined)?.structureKits;
  if (!tileset || !Array.isArray(kits) || kits.length === 0) return [];
  const cached = pairCache.get(kits);
  if (cached) return cached;
  const byId = new Map<string, KitLike>();
  for (const raw of kits) {
    const kit = raw as KitLike;
    if (kit && typeof kit.id === "string" && Number.isInteger(kit.width) && Number.isInteger(kit.height)) byId.set(kit.id, kit);
  }
  const pairs: KitDoorPair[] = [];
  for (const [id, open] of byId) {
    if (!id.endsWith("-open")) continue;
    const base = id.slice(0, -"-open".length);
    const closed = byId.get(`${base}-closed`) ?? byId.get(base);
    if (!closed || closed.width !== open.width || closed.height !== open.height) continue;
    const closedCells = kitCells(closed);
    const openCells = kitCells(open);
    if (!closedCells || !openCells) continue;
    const differs = closedCells.some((c, i) => c.lower !== openCells[i]!.lower || c.upper !== openCells[i]!.upper);
    const drawn = closedCells.some((c) => c.lower >= 0 || c.upper >= 0);
    if (!differs || !drawn) continue;
    pairs.push({ closedId: closed.id, openId: open.id, width: open.width, height: open.height, closed: closedCells, open: openCells });
  }
  pairCache.set(kits, pairs);
  return pairs;
}

function baseReader(map: GameMap): KitDoorTileReader {
  return (layer, index) => (layer === "lower" ? map.lowerTiles[index] : map.upperTiles[index]) ?? -1;
}

function fits(map: GameMap, cells: readonly KitCell[], origin: Cell, read: KitDoorTileReader): boolean {
  for (const cell of cells) {
    const x = origin.x + cell.dx, y = origin.y + cell.dy;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const index = y * map.width + x;
    if (cell.lower >= 0 && read("lower", index) !== cell.lower) return false;
    if (cell.upper >= 0 && read("upper", index) !== cell.upper) return false;
  }
  return true;
}

/**
 * 칸(이벤트 칸 등)이나 그 바로 윗칸을 덮는 닫힘/열림 키트 문. 문 이벤트는 대개 문 그림 맨 아래 칸이나 그 앞(남쪽) 칸에 선다.
 * 못 찾으면 null.
 */
export function findKitDoor(project: Project, map: GameMap, at: Cell, read: KitDoorTileReader = baseReader(map)): KitDoorMatch | null {
  const pairs = kitDoorPairs(project.tilesets[map.tilesetId]);
  if (!pairs.length) return null;
  for (const cell of [at, { x: at.x, y: at.y - 1 }]) {
    for (const pair of pairs) {
      for (const state of ["closed", "open"] as const) {
        const cells = pair[state];
        for (let dy = 0; dy < pair.height; dy++) {
          for (let dx = 0; dx < pair.width; dx++) {
            const origin = { x: cell.x - dx, y: cell.y - dy };
            if (!fits(map, cells, origin, read)) continue;
            const changes: { layer: KitDoorLayer; x: number; y: number; closed: number; open: number }[] = [];
            pair.closed.forEach((c, i) => {
              const o = pair.open[i]!;
              const x = origin.x + c.dx, y = origin.y + c.dy;
              if (c.lower !== o.lower) changes.push({ layer: "lower", x, y, closed: c.lower, open: o.lower });
              if (c.upper !== o.upper) changes.push({ layer: "upper", x, y, closed: c.upper, open: o.upper });
            });
            return { pair, origin, state, changes };
          }
        }
      }
    }
  }
  return null;
}

/**
 * 키트 문을 지나는 이동 이벤트에 넣는 「문 열기」 명령 — 문 그림 그대로 여는 연출(fx:door-open, 소리 포함) 뒤
 * 열림 그림을 changeTile 로 남긴다(세션에 남아 다시 와도 열려 있다). 닫힌 키트 문이 없으면 빈 목록.
 * 런타임 transfer 는 이미 열린 키트 문에서는 연출을 다시 하지 않는다(playSceneFieldFx).
 */
export function kitDoorOpenCommands(project: Project, map: GameMap, at: Cell): Command[] {
  const door = findKitDoor(project, map, at);
  if (!door || door.state !== "closed") return [];
  return [
    { kind: "showAnimation", target: { x: at.x, y: at.y }, animationId: DOOR_OPEN_FX_ID, wait: true } as Command,
    ...door.changes.map((c) => ({ kind: "changeTile", mapId: map.id, layer: c.layer, x: c.x, y: c.y, tile: c.open }) as Command),
  ];
}

/** 명령 목록이 이미 문 열기 연출을 품었는가(같은 도구를 다시 불러도 겹치지 않게). */
export function hasDoorOpenFx(commands: readonly Command[]): boolean {
  return commands.some((c) => c.kind === "showAnimation" && (c as { animationId?: string }).animationId === DOOR_OPEN_FX_ID);
}
