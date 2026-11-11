// 건물 입구 · 선언된 문·계단 칸 — 칩셋이 선언한 것만 읽는다: 구조 키트(tileset.structureKits)의 entrance 부품 칸. 타일 이름표의 낱말은 읽지 않는다.
// 왜: 이름표가 「…문」으로 끝나는 칸을 문으로 읽으면 구성기 칩셋에서는 걸어서 지나는 성문만 잡히고(집은 키트 한 덩이라 문 이름표가 따로 없다)
// 「신문」 같은 물건도 문이 된다. 키트는 어느 칸이 들어가는 문인지 스스로 적어 둔다 — 문 칸은 막힌 그림이고 바로 아래 칸이 문 앞이다.
import { roomSpecOf } from "@/editor/handInterior/builder";
import { isPassable } from "@/project/collision";
import { tilesetSurface } from "@/project/tilesetSurface";
import type { GameMap, Project, TilesetDef } from "@/project/types";

export interface Entrance {
  /** 문 그림 칸(막힌 칸). */
  readonly x: number;
  readonly y: number;
  /** 문 앞 칸 — 걸어서 서는 칸. */
  readonly front: { readonly x: number; readonly y: number };
  /** 이 문을 적어 둔 키트의 이름. */
  readonly kit: string;
}

type Kit = { name?: string; id?: string; rows?: { tiles?: number[]; upperTiles?: number[] }[]; parts?: { kind?: string; dx?: number; dy?: number; w?: number; h?: number }[] };
type Meta = { role?: string; passage?: string } | undefined;

const LAYERS = ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"] as const;
/** 쓰기 도구가 타일셋을 복제하므로 객체가 아니라 id·크기로 기억한다. */
const cache = new Map<string, Map<number, string>>();

/** 키트의 entrance 부품 칸에 놓이는 그림 타일 → 그 키트 이름. 그 칸 밑에 깔리는 땅 타일(걷는 바닥)은 문 그림이 아니다. */
function entranceTiles(tileset: TilesetDef | undefined): Map<number, string> {
  const kits = ((tileset as { structureKits?: readonly Kit[] } | undefined)?.structureKits ?? []) as readonly Kit[];
  const meta = ((tileset as { tileMeta?: unknown } | undefined)?.tileMeta ?? []) as Meta[];
  const key = `${tileset?.id}|${meta.length}|${kits.length}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out = new Map<number, string>();
  for (const kit of kits) for (const part of kit.parts ?? []) {
    if (part.kind !== "entrance" || typeof part.dx !== "number" || typeof part.dy !== "number") continue;
    for (let y = part.dy; y < part.dy + (part.h ?? 1); y++) for (let x = part.dx; x < part.dx + (part.w ?? 1); x++) {
      const row = kit.rows?.[y];
      for (const t of [row?.tiles?.[x], row?.upperTiles?.[x]]) {
        if (typeof t !== "number" || t < 0 || out.has(t)) continue;
        const m = meta[t];
        if (m && (m.passage === "passable" || m.role === "terrain" || m.role === "empty")) continue;
        out.set(t, String(kit.name ?? kit.id ?? ""));
      }
    }
  }
  if (cache.size > 64) cache.clear();
  cache.set(key, out);
  return out;
}

/** 이 맵에 놓인 건물들의 입구: 키트가 문이라고 적은 그림 칸 가운데 막힌 칸이고 바로 아래가 걸을 수 있는 칸인 것. 위에서 아래, 왼쪽에서 오른쪽 순. */
export function buildingEntrances(project: Project, map: GameMap): Entrance[] {
  const tiles = entranceTiles(project.tilesets[map.tilesetId]);
  if (!tiles.size) return [];
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  const out: Entrance[] = [];
  for (let y = 0; y < map.height - 1; y++) for (let x = 0; x < map.width; x++) {
    const i = y * map.width + x;
    let kit: string | undefined;
    for (const layer of LAYERS) { const t = m[layer]?.[i]; if (typeof t === "number" && t >= 0 && tiles.has(t)) { kit = tiles.get(t); break; } }
    if (kit === undefined || isPassable(project, map, x, y) || !isPassable(project, map, x, y + 1)) continue;
    out.push({ x, y, front: { x, y: y + 1 }, kit });
  }
  return out;
}

// ── 선언된 문·계단 칸 — 이벤트를 «문 그림»「계단 그림」에 앉힐 때 읽는다. 이름표 낱말(「…문」「계단」)이 아니라 칩셋이 적어 둔 것만:
//   문 = 건물 키트의 입구 칸(위) + 방 키트의 문 기물(kind door·sidedoor, 또는 쓰임 travel 인데 계단이 아닌 것 — 둥근 문·승강기·통로)
//   계단 = 방 키트의 계단 기물(stairs up·down) + 칩셋 표면 계약의 계단 칸(역할·꼬리표)
// 이름표로 읽던 때는 「금고문」을 빼는 낱말 목록이 따로 있었고, 「지구라트(계단 신전)」「비상계단 아파트」가 계단이었다.

type RoomTiles = { readonly doors: ReadonlySet<number>; readonly stairs: ReadonlySet<number> };
const roomCache = new Map<string, RoomTiles>();

function roomKitTiles(tileset: TilesetDef | undefined): RoomTiles {
  const S = roomSpecOf(tileset);
  const key = `${tileset?.id}|${S ? Object.keys(S.objects).length : 0}`;
  const hit = roomCache.get(key);
  if (hit) return hit;
  const doors = new Set<number>(), stairs = new Set<number>();
  for (const d of Object.values(S?.objects ?? {})) {
    const into = d.stairs ? stairs : d.kind === "door" || d.kind === "sidedoor" || d.use?.includes("travel") ? doors : undefined;
    if (into) for (const cell of d.cells) { const t = cell[2]; if (typeof t === "number" && t >= 0) into.add(t); }
  }
  const out = { doors, stairs };
  if (roomCache.size > 64) roomCache.clear();
  roomCache.set(key, out);
  return out;
}

/** 이 타일들이 놓인 칸 가운데 맨 아래 칸(사람이 서서 여는·오르는 쪽). 세로로 이어진 그림은 아래 칸 하나만. */
function bottomCells(map: GameMap, tiles: ReadonlySet<number>): { x: number; y: number }[] {
  if (!tiles.size) return [];
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  const on = (x: number, y: number) => y < map.height && LAYERS.some((layer) => { const t = m[layer]?.[y * map.width + x]; return typeof t === "number" && t >= 0 && tiles.has(t); });
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (on(x, y) && !on(x, y + 1)) out.push({ x, y });
  return out;
}

/** 이 맵의 문 칸 — 건물 입구 칸과 방 키트 문 기물의 맨 아래 칸. */
export function declaredDoorCells(project: Project, map: GameMap): { x: number; y: number }[] {
  const seen = new Set<number>();
  const out: { x: number; y: number }[] = [];
  for (const c of [...buildingEntrances(project, map), ...bottomCells(map, roomKitTiles(project.tilesets[map.tilesetId]).doors)]) {
    const i = c.y * map.width + c.x;
    if (!seen.has(i)) { seen.add(i); out.push({ x: c.x, y: c.y }); }
  }
  return out;
}

/** 이 맵의 계단 칸(맨 아래 칸) — 방 키트의 계단 기물과 칩셋 표면 계약의 계단. */
export function declaredStairCells(project: Project, map: GameMap): { x: number; y: number }[] {
  const tileset = project.tilesets[map.tilesetId];
  const tiles = new Set([...roomKitTiles(tileset).stairs, ...tilesetSurface(tileset).stairs]);
  return bottomCells(map, tiles);
}
