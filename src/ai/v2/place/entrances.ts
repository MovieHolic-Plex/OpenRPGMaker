// 건물 입구 · 선언된 문·계단 칸 — 칩셋이 선언한 것만 읽는다: 구조 키트(tileset.structureKits)의 entrance 부품 칸. 타일 이름표의 낱말은 읽지 않는다.
// 왜: 이름표가 「…문」으로 끝나는 칸을 문으로 읽으면 구성기 칩셋에서는 걸어서 지나는 성문만 잡히고(집은 키트 한 덩이라 문 이름표가 따로 없다)
// 「신문」 같은 물건도 문이 된다. 키트는 어느 칸이 들어가는 문인지 스스로 적어 둔다 — 문 칸은 막힌 그림이고 바로 아래 칸이 문 앞이다.
import { roomSpecOf } from "@/editor/handInterior/builder";
import { isPassable } from "@/project/collision";
import { labelHasWord, labelNames } from "@/project/labelWords";
import { isDoorArtCell } from "@/project/staging/doorCells";
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

type RoomTiles = { readonly doors: ReadonlySet<number>; readonly stairs: ReadonlySet<number>; readonly seats: ReadonlySet<number>; readonly windows: ReadonlySet<number> };
const roomCache = new Map<string, RoomTiles>();

function roomKitTiles(tileset: TilesetDef | undefined): RoomTiles {
  const S = roomSpecOf(tileset);
  const key = `${tileset?.id}|${S ? Object.keys(S.objects).length : 0}`;
  const hit = roomCache.get(key);
  if (hit) return hit;
  const doors = new Set<number>(), stairs = new Set<number>(), seats = new Set<number>(), windows = new Set<number>();
  for (const [id, d] of Object.entries(S?.objects ?? {})) {
    // 창 = 갈래가 window 이거나, 벽에 거는 기물인데 키트가 붙인 이름(id)이 window 인 것(「tall stained window」 — 이름표는 「큰 색유리창」 한 낱말이다).
    const into = d.stairs ? stairs : d.kind === "door" || d.kind === "sidedoor" || d.use?.includes("travel") ? doors
      : d.use?.includes("sit") ? seats : d.category === "window" || (d.kind === "hang" && /(^|[^a-z])window($|[^a-z])/u.test(id)) ? windows : undefined;
    if (into) for (const cell of d.cells) { const t = cell[2]; if (typeof t === "number" && t >= 0) into.add(t); }
  }
  const out = { doors, stairs, seats, windows };
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

// ── 자리 고르기(place/where.ts)가 읽는 칸 — 건물 · 계단 · 앉는 가구 · 창. 이름표에 그 글자가 들었는지로 읽지 않는다:
//   건물 = 굽기가 건물·벽·지붕이라 적은 타일(역할) + 입구를 적어 둔 구조 키트의 그림 타일 — 바깥에서 「한쪽」「벽 쪽」은 건물 벽 앞이다
//   계단 = 위와 같다(방 키트 계단 기물 + 표면 계약의 계단 칸)
//   앉는 가구 = 방 키트가 앉는 것이라 적은 기물(쓰임 sit) + 이름이 의자·탁자인 것(온전한 낱말 — project/labelWords.ts)
//   창 = 방 키트의 창 기물(갈래 window · 벽걸이인데 id 가 window) + 이름이 「…창」으로 끝나는 것 + 굽기가 창이라 적은 벽 타일(꼬리표)
// 글자로 읽던 때는 「사다리꼴 지붕」이 계단, 「정류장 지붕(기둥 + 벤치)」이 의자, 문에 난 「작은 유리창」이 창이었고 정작 「커튼 창」은 창이 아니었다.
const SEAT_WORDS = ["의자", "걸상", "벤치", "스툴", "탁자", "식탁", "테이블", "chair", "stool", "bench", "table"] as const;
const WINDOW_WORDS = ["창", "창문", "window"] as const;
/** 벽 타일(역할 wall·terrain)에 굽기가 붙인 창 꼬리표 — 소품의 「창」 꼬리표는 무기 창일 수 있어 읽지 않는다(도장 「목검·창 걸이」). */
const WINDOW_TAGS = new Set(["창", "창문", "전망창", "window", "窓"]);

type NamedTiles = { readonly seats: ReadonlySet<number>; readonly windows: ReadonlySet<number>; readonly buildings: ReadonlySet<number> };
const BUILDING_ROLES = new Set(["building", "wall", "roof"]);
const namedCache = new Map<string, NamedTiles>();

function namedTiles(tileset: TilesetDef | undefined): NamedTiles {
  const meta = ((tileset as { tileMeta?: unknown } | undefined)?.tileMeta ?? []) as ({ label?: string; role?: string; tags?: readonly string[] } | null | undefined)[];
  const key = `${tileset?.id}|${meta.length}|${((tileset as { structureKits?: readonly Kit[] } | undefined)?.structureKits ?? []).length}`;
  const hit = namedCache.get(key);
  if (hit) return hit;
  const seats = new Set<number>(), windows = new Set<number>(), buildings = new Set<number>();
  const ground = (tile: number): boolean => { const m = meta[tile] as { role?: string; passage?: string } | null | undefined; return !!m && (m.passage === "passable" || m.role === "terrain" || m.role === "empty"); };
  // 구조 키트에는 가구·소품 묶음도 있다 — 들어가는 문을 적어 둔 키트가 건물이다.
  for (const kit of ((tileset as { structureKits?: readonly Kit[] } | undefined)?.structureKits ?? []) as readonly Kit[]) {
    if (!kit.parts?.some((part) => part.kind === "entrance")) continue;
    for (const row of kit.rows ?? []) for (const t of [...(row.tiles ?? []), ...(row.upperTiles ?? [])]) if (typeof t === "number" && t >= 0 && !ground(t)) buildings.add(t);
  }
  meta.forEach((m, tile) => {
    if (m?.role && BUILDING_ROLES.has(m.role)) buildings.add(tile);
    if (!m?.label) return;
    if (SEAT_WORDS.some((word) => labelHasWord(m.label!, word))) seats.add(tile);
    if (WINDOW_WORDS.some((word) => labelNames(m.label!, word)) || ((m.role === "wall" || m.role === "terrain") && m.tags?.some((tag) => WINDOW_TAGS.has(tag)))) windows.add(tile);
  });
  const out = { seats, windows, buildings };
  if (namedCache.size > 64) namedCache.clear();
  namedCache.set(key, out);
  return out;
}

/** 칸마다 1 — 그 칸(어느 층이든)에 건물·계단·앉는 가구·창이 놓였다. */
export interface PlaceMarks { readonly buildings: Uint8Array; readonly stairs: Uint8Array; readonly seats: Uint8Array; readonly windows: Uint8Array }

export function placeMarks(project: Project, map: GameMap): PlaceMarks {
  const tileset = project.tilesets[map.tilesetId];
  const kit = roomKitTiles(tileset), named = namedTiles(tileset), surfaceStairs = tilesetSurface(tileset).stairs;
  const n = map.width * map.height;
  const buildings = new Uint8Array(n), stairs = new Uint8Array(n), seats = new Uint8Array(n), windows = new Uint8Array(n);
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  for (const layer of LAYERS) {
    const tiles = m[layer];
    if (!tiles) continue;
    for (let i = 0; i < n; i++) {
      const t = tiles[i];
      if (typeof t !== "number" || t < 0) continue;
      if (named.buildings.has(t)) buildings[i] = 1;
      if (kit.stairs.has(t) || surfaceStairs.has(t)) stairs[i] = 1;
      if (kit.seats.has(t) || named.seats.has(t)) seats[i] = 1;
      if (kit.windows.has(t) || named.windows.has(t)) windows[i] = 1;
    }
  }
  return { buildings, stairs, seats, windows };
}

// ── 드나드는 그림 — 「이 칸이 문·계단 그림인가」. 출하 검사(입구 그림 옆 맨바닥)와 맵 잇기·층 이동 도구가 같이 읽는다:
//   건물 키트의 입구 그림 · 방 키트의 문·계단 기물 · 표면 계약의 계단 · 표면 계약의 낱장 문(굽기가 문이라 적은 꼬리표 — 버들항 「집 문」, 성채 「오크 문」)
// 입구를 적어 둔 키트의 나머지 그림은 꼬리표가 문이어도 문이 아니다(그 키트가 어느 칸이 문인지 이미 적었다).
// 이름표 낱말로 읽던 때는 「가문비」「얼음 구멍」「무너진 아치 문」「성벽(활 구멍)」과 설명에 「양개문」이 든 건물의 모든 칸이 문 그림이라,
// 나무 밑 칸에 이은 출입구의 트리거가 나무 위로 올라갔다. 아무것도 적지 않은 칩셋(올린 것 — 표면 선언·입구 키트·방 키트가 없다)만 이름표로 읽는다.
const artCache = new Map<string, ReadonlySet<number> | null>();

/** 이 칩셋의 드나드는 그림 타일. null = 아무것도 적지 않은 칩셋(이름표로 읽는다). */
function entranceArtTiles(tileset: TilesetDef | undefined): ReadonlySet<number> | null {
  const kits = ((tileset as { structureKits?: readonly Kit[] } | undefined)?.structureKits ?? []) as readonly Kit[];
  const meta = ((tileset as { tileMeta?: unknown } | undefined)?.tileMeta ?? []) as Meta[];
  const spec = roomSpecOf(tileset);
  const key = `${tileset?.id}|${meta.length}|${kits.length}|${spec ? Object.keys(spec.objects).length : 0}`;
  const hit = artCache.get(key);
  if (hit !== undefined) return hit;
  const kit = entranceTiles(tileset), room = roomKitTiles(tileset), surface = tilesetSurface(tileset);
  let out: Set<number> | null = null;
  if (surface.declared || kit.size || spec) {
    out = new Set([...kit.keys(), ...room.doors, ...room.stairs, ...surface.stairs]);
    const kitBody = new Set<number>();
    for (const k of kits) {
      if (!k.parts?.some((part) => part.kind === "entrance")) continue;
      for (const row of k.rows ?? []) for (const t of [...(row.tiles ?? []), ...(row.upperTiles ?? [])]) if (typeof t === "number" && t >= 0) kitBody.add(t);
    }
    for (const t of surface.doors) if (!kitBody.has(t)) out.add(t);
  }
  if (artCache.size > 64) artCache.clear();
  artCache.set(key, out);
  return out;
}

/** 이 칸(어느 층이든)에 드나드는 그림이 놓였는가. */
export function isEntranceArt(project: Project, map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const tiles = entranceArtTiles(project.tilesets[map.tilesetId]);
  if (!tiles) return isDoorArtCell(project, map, x, y);
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  return LAYERS.some((layer) => { const t = m[layer]?.[y * map.width + x]; return typeof t === "number" && t >= 0 && tiles.has(t); });
}

/** 드나드는 그림이 놓인 칸(칸 번호 y*w+x) — 「입구 그림 옆 맨바닥에 선 이벤트」 출하 검사(judge/discoverability.ts offArtEntrances)가 맵을 한 번 훑어 읽는다. */
export function entranceArtCells(project: Project, map: GameMap): Set<number> {
  const out = new Set<number>();
  const tiles = entranceArtTiles(project.tilesets[map.tilesetId]);
  if (tiles && !tiles.size) return out;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (isEntranceArt(project, map, x, y)) out.add(y * map.width + x);
  return out;
}
