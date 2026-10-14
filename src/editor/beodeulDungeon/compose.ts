// 버들항 던전 시공기(author_beodeul_dungeon) 순수 계산 — 방 목록 → 타일 배열 + 앵커. 프로젝트를 건드리지 않는다.
//
// 왜(2026-10-14, 사용자 스크린샷 · field-enemy fe1): 던전 층을 시킨 Argon 조수가 참고문서의 「키트를 stamp_object 로 한 개씩 찍는다」를 따라
// 112번 stamp_object + 67번 paint_tiles(호출당 평균 4초·3초)를 절대 좌표로 불렀고, 25분 시간 초과 시점의 맵은 횃불·화로·통·상자·기둥이
// 허공에 뜨고 벽 조각이 바닥 한가운데 서고 상자 이벤트가 천장 칸에 놓인 상태였다. 좌표를 모델이 계산하는 한 이 결함은 줄이는 것이지 없어지지 않는다.
// 이 시공기는 「방 목록(종류·크기·어느 방에서 어느 쪽으로)」만 받고 바닥 마스크 → 천장·벽 앞면 → 장식을 마스크에서 **유도**한다:
//   · 벽 앞면은 바닥의 북쪽 변 위 세 줄에만 선다(바닥을 마주 본다) · 횃불·깃발·벽감·쇠사슬은 그 벽 칸에만 걸린다
//   · 기둥·화로·상자·통·관·제단은 방 안 바닥 칸에만 서고, 방 사이를 잇는 통로 줄(lane)은 비운다
//   · 끝나면 project/groundSupport.ts 의 같은 규칙으로 자기 결과를 검사하고, 입구에서 모든 방·통로가 걸어서 닿는지 본다
import { checkGroundSupportForStamp, groundSupportIssues } from "@/project/groundSupport";
import type { GameMap, StructureKitDef, TilesetDef } from "@/project/types";

export const DUNGEON_ROOM_KINDS = ["entrance", "hall", "crypt", "cell", "shrine", "boss", "storage", "vault"] as const;
export type DungeonRoomKind = (typeof DUNGEON_ROOM_KINDS)[number];
export type DungeonDir = "N" | "W" | "E";
export const DUNGEON_STYLES = ["catacomb", "castle"] as const;
export type DungeonStyle = (typeof DUNGEON_STYLES)[number];

export interface DungeonRoomInput {
  readonly id?: string;
  readonly kind?: DungeonRoomKind;
  /** 바닥 가로·세로(벽 앞면 3줄은 따로 위에 붙는다). 생략하면 종류별 기본. */
  readonly w?: number;
  readonly h?: number;
  /** 이 방이 이어지는 앞 방 id(기본: 바로 앞 방). */
  readonly from?: string;
  /** 앞 방의 어느 쪽 문에서 뻗나. 기본: 첫 갈래는 N(북), 다음은 W·E 번갈아. 자리가 막히면 다른 쪽으로 옮긴다. */
  readonly dir?: DungeonDir;
}

export interface DungeonSpec {
  readonly rooms: readonly DungeonRoomInput[];
  readonly style?: DungeonStyle;
  readonly seed?: number;
}

interface Rect { x: number; y: number; w: number; h: number }
export interface PlacedRoom extends Rect { id: string; kind: DungeonRoomKind; from: string | null; dir: DungeonDir | null }
export interface PlacedCorridor { a: string; b: string; dir: DungeonDir; rect: Rect }

const DEFAULT_SIZE: Record<DungeonRoomKind, [number, number]> = {
  entrance: [11, 7], hall: [14, 8], crypt: [12, 7], cell: [9, 6], shrine: [11, 7], boss: [14, 9], storage: [8, 6], vault: [9, 6],
};
const WALL_ROWS = 3;
const GAP = 4;
const MARGIN = 2;

const FLOOR_BY_KIND: Record<DungeonRoomKind, string> = {
  entrance: "bd-pick-aqueduct-sewer-floor-cata", hall: "bd-pick-aqueduct-sewer-floor-cata", crypt: "bd-pick-aqueduct-sewer-floor-darkcata",
  cell: "bd-pick-castle-catacombs-floor-cell", shrine: "bd-pick-castle-catacombs-floor-castle", boss: "bd-pick-castle-catacombs-floor-castle",
  storage: "bd-pick-aqueduct-sewer-floor-cata", vault: "bd-pick-aqueduct-sewer-floor-bone",
};
const CORRIDOR_FLOOR = "bd-pick-aqueduct-sewer-floor-cata";
const K = {
  ceiling: "bd-pick-aqueduct-sewer-ceiling",
  stairsUp: "bd-pick-aqueduct-sewer-stairs-up-face", stairsDown: "bd-pick-temple-ruins-stairs-down",
  torch: "bd-pick-aqueduct-sewer-torch-wall", banner: "bd-pick-aqueduct-sewer-banner-cult", chains: "bd-pick-aqueduct-sewer-chains",
  nicheSkull: "bd-pick-castle-catacombs-niche-skull", nicheUrn: "bd-pick-castle-catacombs-niche-urn", nicheShroud: "bd-pick-castle-catacombs-niche-shroud",
  archBars: "bd-pick-aqueduct-sewer-arch-bars",
  column: "bd-pick-castle-catacombs-column-cata", brazier: "bd-pick-aqueduct-sewer-brazier", crate: "bd-pick-aqueduct-sewer-crate",
  crateStack: "bd-pick-aqueduct-sewer-crate-stack", barrel: "bd-pick-aqueduct-sewer-barrel", bucket: "bd-pick-aqueduct-sewer-bucket",
  coffin: "bd-pick-aqueduct-sewer-coffin", candles: "bd-pick-aqueduct-sewer-candles", altar: "bd-pick-castle-catacombs-altar-stone",
  strawBed: "bd-pick-castle-catacombs-straw-bed", skulls: "bd-pick-aqueduct-sewer-skulls", boneHeap: "bd-pick-aqueduct-sewer-bone-heap",
  bones: "bd-pick-aqueduct-sewer-bones", rubble: "bd-pick-aqueduct-sewer-rubble",
} as const;
const FACE_KITS: Record<DungeonStyle, { h3: string; h2: string }> = {
  catacomb: { h3: "bd-pick-aqueduct-sewer-face-cata-3h", h2: "bd-pick-aqueduct-sewer-face-cata-2h" },
  castle: { h3: "bd-pick-castle-catacombs-face-castle-3h", h2: "bd-pick-castle-catacombs-face-castle-2h" },
};

export class DungeonComposeError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    s ^= s >>> 13;
    return (s >>> 0) / 4294967296;
  };
}

const inter = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const roomFootprint = (r: Rect): Rect => ({ x: r.x - 2, y: r.y - WALL_ROWS - 1, w: r.w + 4, h: r.h + WALL_ROWS + 2 });
const corridorFootprint = (r: Rect): Rect => ({ x: r.x - 1, y: r.y - WALL_ROWS - 1, w: r.w + 2, h: r.h + WALL_ROWS + 1 });

// ---------- 1. 방 배치 ----------

export interface DungeonLayout { rooms: PlacedRoom[]; corridors: PlacedCorridor[]; width: number; height: number }

export function layoutDungeon(spec: DungeonSpec): DungeonLayout {
  const inputs = spec.rooms;
  if (inputs.length < 1) throw new DungeonComposeError("rooms 에 방이 하나 이상 있어야 한다.", "invalid-args");
  if (inputs.length > 12) throw new DungeonComposeError("방은 12개까지다 — 한 층을 둘로 나눠라.", "invalid-args");
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));
  const placed: PlacedRoom[] = [];
  const corridors: PlacedCorridor[] = [];
  const used = new Map<string, Set<DungeonDir>>();
  const ids = new Set<string>();
  inputs.forEach((input, index) => {
    const kind: DungeonRoomKind = input.kind ?? (index === 0 ? "entrance" : "hall");
    const [dw, dh] = DEFAULT_SIZE[kind];
    const w = clamp(input.w ?? dw, 6, 24), h = clamp(input.h ?? dh, 5, 14);
    let id = (input.id ?? `${kind}${index + 1}`).trim() || `${kind}${index + 1}`;
    while (ids.has(id)) id = `${id}_${index + 1}`;
    ids.add(id);
    if (index === 0) {
      placed.push({ id, kind, x: 0, y: 0, w, h, from: null, dir: null });
      used.set(id, new Set());
      return;
    }
    const fromId = input.from ?? placed[index - 1]!.id;
    const parent = placed.find((room) => room.id === fromId) ?? [...placed].reverse().find((room) => room.kind === fromId);
    if (!parent) throw new DungeonComposeError(`방 ${id} 의 from '${fromId}' 가 앞에 나온 방 id 가 아니다(앞 방: ${placed.map((r) => r.id).join(", ")}).`, "invalid-args");
    const taken = used.get(parent.id)!;
    const preferred: DungeonDir[] = input.dir ? [input.dir] : taken.size === 0 ? ["N"] : taken.has("W") ? ["E", "N"] : ["W", "E", "N"];
    const order: DungeonDir[] = [...new Set<DungeonDir>([...preferred, "N", "W", "E"])].filter((d) => !taken.has(d));
    let done: { room: PlacedRoom; corridor: PlacedCorridor } | null = null;
    outer: for (const dir of order) {
      for (const shift of [0, 3, -3, 6, -6, 9, -9, 12, -12]) {
        const attempt = attemptPlace(parent, { id, kind, w, h }, dir, shift);
        if (!attempt) continue;
        const roomFp = roomFootprint(attempt.room), corFp = corridorFootprint(attempt.corridor.rect);
        const clash = placed.some((other) => other.id !== parent.id && inter(roomFp, roomFootprint(other)))
          || placed.some((other) => other.id !== parent.id && inter(corFp, roomFootprint(other)))
          || corridors.some((c) => inter(roomFp, corridorFootprint(c.rect)) || inter(corFp, corridorFootprint(c.rect)))
          || inter(roomFp, roomFootprint(parent)) && false;
        if (clash) continue;
        done = attempt;
        taken.add(dir);
        break outer;
      }
    }
    if (!done) throw new DungeonComposeError(`방 ${id} 를 ${parent.id} 에 이을 자리가 없다(세 쪽 문이 다 쓰였거나 다른 방과 겹친다). from 을 다른 방으로 바꾸거나 방 수·크기를 줄여라.`, "layout-failed");
    placed.push({ ...done.room, from: parent.id, dir: done.corridor.dir });
    used.set(id, new Set<DungeonDir>([opposite(done.corridor.dir)]));
    corridors.push(done.corridor);
  });
  // 좌표를 0 기준 바깥 여백 MARGIN 으로 옮기고 맵 크기를 정한다(맨 위는 벽 앞면 3줄까지).
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const take = (r: Rect, north: number) => { minX = Math.min(minX, r.x); minY = Math.min(minY, r.y - north); maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h); };
  for (const r of placed) take(r, WALL_ROWS);
  for (const c of corridors) take(c.rect, WALL_ROWS);
  const dx = MARGIN - minX, dy = MARGIN - minY;
  const move = <T extends Rect>(r: T): T => ({ ...r, x: r.x + dx, y: r.y + dy });
  return {
    rooms: placed.map(move),
    corridors: corridors.map((c) => ({ ...c, rect: move(c.rect) })),
    width: maxX - minX + MARGIN * 2,
    height: maxY - minY + MARGIN * 2,
  };
}

const opposite = (d: DungeonDir): DungeonDir => (d === "N" ? "N" : d === "W" ? "E" : "W");

function attemptPlace(parent: Rect, child: { id: string; kind: DungeonRoomKind; w: number; h: number }, dir: DungeonDir, shift: number):
  { room: PlacedRoom; corridor: PlacedCorridor } | null {
  const { w, h } = child;
  if (dir === "N") {
    const x = parent.x + Math.floor(parent.w / 2) - Math.floor(w / 2) + shift, y = parent.y - GAP - h;
    const lo = Math.max(parent.x, x), hi = Math.min(parent.x + parent.w, x + w);
    const span = hi - lo, cw = Math.min(3, span);
    if (cw < 2) return null;
    const cx = lo + Math.floor((span - cw) / 2);
    return { room: { ...child, x, y, from: null, dir: null }, corridor: { a: "", b: child.id, dir, rect: { x: cx, y: y + h, w: cw, h: GAP } } };
  }
  const y = parent.y + Math.floor(parent.h / 2) - Math.floor(h / 2) + shift;
  const lo = Math.max(parent.y, y), hi = Math.min(parent.y + parent.h, y + h);
  const span = hi - lo, ch = Math.min(3, span);
  if (ch < 2) return null;
  const cy = lo + Math.floor((span - ch) / 2);
  if (dir === "W") {
    const x = parent.x - GAP - w;
    return { room: { ...child, x, y, from: null, dir: null }, corridor: { a: "", b: child.id, dir, rect: { x: x + w, y: cy, w: GAP, h: ch } } };
  }
  const x = parent.x + parent.w + GAP;
  return { room: { ...child, x, y, from: null, dir: null }, corridor: { a: "", b: child.id, dir, rect: { x: parent.x + parent.w, y: cy, w: GAP, h: ch } } };
}

// ---------- 2. 타일 ----------

export interface DungeonCompose {
  readonly width: number;
  readonly height: number;
  readonly lower: number[];
  readonly upper: number[];
  readonly rooms: PlacedRoom[];
  readonly corridors: PlacedCorridor[];
  readonly entrance: { x: number; y: number };
  readonly stairsUp: { x: number; y: number; front: { x: number; y: number } } | null;
  readonly stairsDown: { x: number; y: number } | null;
  readonly spots: Record<string, { x: number; y: number }[]>;
  readonly picture: string[];
  readonly counts: Record<string, number>;
  readonly warnings: string[];
}

export function composeDungeon(ts: TilesetDef, spec: DungeonSpec): DungeonCompose {
  const layout = layoutDungeon(spec);
  const style: DungeonStyle = spec.style ?? "catacomb";
  const random = rng(spec.seed ?? 7);
  const kits = new Map<string, StructureKitDef>((ts.structureKits ?? []).map((kit) => [kit.id, kit]));
  const kit = (id: string): StructureKitDef => {
    const found = kits.get(id);
    if (!found) throw new DungeonComposeError(`이 프로젝트의 버들항 타일셋에 던전 키트 ${id} 가 없다 — 버들항 장소 조각(beodeul-picks-dungeon)이 들어 있는 타일셋이 필요하다.`, "kit-missing");
    return found;
  };
  const { width: W, height: H, rooms, corridors } = layout;
  const idx = (x: number, y: number) => y * W + x;
  const void_ = kit(K.ceiling).rows[1]!.tiles[1]!;
  const lower = new Array<number>(W * H).fill(void_);
  const upper = new Array<number>(W * H).fill(-1);
  const floorMask = new Uint8Array(W * H);
  const roomAt = new Int16Array(W * H).fill(-1);
  const floorKitAt: string[] = new Array(W * H).fill("");
  const markFloor = (r: Rect, floorKit: string, roomIndex: number) => {
    for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
      floorMask[idx(x, y)] = 1; floorKitAt[idx(x, y)] = floorKit; if (roomIndex >= 0) roomAt[idx(x, y)] = roomIndex;
    }
  };
  for (const c of corridors) markFloor(c.rect, CORRIDOR_FLOOR, -1);
  rooms.forEach((room, i) => markFloor(room, FLOOR_BY_KIND[room.kind], i));
  const isFloor = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && floorMask[idx(x, y)] === 1;

  // 바닥 칸 = 바닥 키트(2×2 반복 무늬)
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!isFloor(x, y)) continue;
    const rows = kit(floorKitAt[idx(x, y)]!).rows;
    lower[idx(x, y)] = rows[y % rows.length]!.tiles[x % (rows[0]!.tiles.length)]!;
  }
  // 벽 앞면 = 바닥 북쪽 변 위 세 줄(둘이면 두 줄). 바닥을 마주 보는 자리에만 선다.
  const wallB = new Int8Array(W * H).fill(-1);
  const wallH = new Int8Array(W * H).fill(0);
  const warnings: string[] = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!isFloor(x, y) || isFloor(x, y - 1)) continue;
    let h = 0;
    while (h < WALL_ROWS && y - 1 - h >= 0 && !isFloor(x, y - 1 - h)) h += 1;
    if (h < 2) { warnings.push(`(${x},${y}) 위에 벽 앞면을 세울 줄이 모자란다(${h}줄)`); continue; }
    for (let b = 0; b < h; b += 1) { wallB[idx(x, y - 1 - b)] = b; wallH[idx(x, y - 1 - b)] = h; }
  }
  const face = FACE_KITS[style];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const b = wallB[idx(x, y)]!;
    if (b < 0) continue;
    const h = wallH[idx(x, y)]!;
    const rows = kit(h >= 3 ? face.h3 : face.h2).rows;
    const row = rows[(h >= 3 ? 3 : 2) - 1 - b]!.tiles;
    const left = x > 0 && wallB[idx(x - 1, y)] === b, right = x + 1 < W && wallB[idx(x + 1, y)] === b;
    lower[idx(x, y)] = left && right ? row[1]! : !left && right ? row[0]! : left && !right ? row[2]! : row[1]!;
  }
  const isWall = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && wallB[idx(x, y)]! >= 0;

  // 문 앞 줄(lane): 방과 통로가 맞닿는 줄은 비운다 — 모든 방이 입구에서 걸어 닿게.
  const lane = new Uint8Array(W * H);
  for (const c of corridors) {
    const cells = c.rect;
    for (const r of rooms) {
      const touches = c.dir === "N"
        ? (r.id === c.b || r.id === (rooms.find((q) => q.id === c.b)?.from ?? "")) && cells.x < r.x + r.w && r.x < cells.x + cells.w
        : (r.id === c.b || r.id === (rooms.find((q) => q.id === c.b)?.from ?? "")) && cells.y < r.y + r.h && r.y < cells.y + cells.h;
      if (!touches) continue;
      for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
        const inLane = c.dir === "N" ? x >= cells.x && x < cells.x + cells.w : y >= cells.y && y < cells.y + cells.h;
        if (inLane) lane[idx(x, y)] = 1;
      }
    }
  }

  // ---- 장식 ----
  const pseudo = { id: "compose", name: "compose", width: W, height: H, tilesetId: ts.id, events: [], lowerTiles: lower, upperTiles: upper } as unknown as GameMap;
  const counts: Record<string, number> = {};
  const blocked = new Uint8Array(W * H);
  const put = (kitId: string, x: number, y: number, opts: { lane?: boolean; label?: string } = {}): boolean => {
    const def = kit(kitId);
    if (x < 0 || y < 0 || x + def.width > W || y + def.height > H) return false;
    if (checkGroundSupportForStamp(pseudo, ts, def, x, y)) return false;
    const cells: { x: number; y: number; lo: number; up: number }[] = [];
    for (let dy = 0; dy < def.height; dy += 1) for (let dx = 0; dx < def.width; dx += 1) {
      const row = def.rows[dy]!;
      const lo = row.tiles[dx] ?? -1, up = row.upperTiles?.[dx] ?? -1;
      if (lo < 0 && up < 0) continue;
      const X = x + dx, Y = y + dy;
      if (upper[idx(X, Y)]! >= 0 || blocked[idx(X, Y)]) return false;
      if (opts.lane !== false && lane[idx(X, Y)]) return false;
      cells.push({ x: X, y: Y, lo, up });
    }
    if (!cells.length) return false;
    for (const c of cells) {
      if (c.lo >= 0) lower[idx(c.x, c.y)] = c.lo;
      if (c.up >= 0) { upper[idx(c.x, c.y)] = c.up; blocked[idx(c.x, c.y)] = 1; }
    }
    counts[opts.label ?? kitId.replace(/^bd-pick-/, "")] = (counts[opts.label ?? kitId.replace(/^bd-pick-/, "")] ?? 0) + 1;
    return true;
  };
  /** 키트 하나를 후보 칸들 중 앞에서부터 놓을 수 있는 곳에. */
  const putFirst = (kitId: string, cands: readonly (readonly [number, number])[], opts?: { lane?: boolean; label?: string }): [number, number] | null => {
    for (const [x, y] of cands) if (put(kitId, x, y, opts)) return [x, y];
    return null;
  };
  const shuffled = <T,>(list: readonly T[]): T[] => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j]!, out[i]!]; }
    return out;
  };
  const columnsAround = (n: number) => Array.from({ length: n }, (_, i) => i);

  let stairsUp: DungeonCompose["stairsUp"] = null;
  let stairsDown: DungeonCompose["stairsDown"] = null;

  rooms.forEach((r) => {
    const topWall = r.y - 2;                 // 벽 앞면 가운데 줄(b=1) y
    const wallXs = columnsAround(r.w).map((i) => r.x + i).filter((x) => isWall(x, topWall) && isWall(x, topWall + 1));
    const wallOnly = (list: number[]) => list.filter((x) => isWall(x, topWall));
    // 벽 횃불: 방 윗벽 가운데 줄에 5칸 간격(양쪽 끝 한 칸 안쪽부터)
    const torchXs = wallOnly(wallXs.filter((x) => (x - r.x) % 5 === 1 || (x - r.x) % 5 === 0 && false));
    const wallCenterFirst = [...wallXs].sort((a, b) => Math.abs(a - (r.x + r.w / 2)) - Math.abs(b - (r.x + r.w / 2)));
    const floorCells = (inset: number): [number, number][] => {
      const out: [number, number][] = [];
      for (let y = r.y + inset; y < r.y + r.h - inset; y += 1) for (let x = r.x + inset; x < r.x + r.w - inset; x += 1) out.push([x, y]);
      return out;
    };
    const corners = (inset: number): [number, number][] => [[r.x + inset, r.y + 1], [r.x + r.w - 1 - inset, r.y + 1], [r.x + inset, r.y + r.h - 2], [r.x + r.w - 1 - inset, r.y + r.h - 2]];
    const sideCols = (inset: number, rowsAt: number[]): [number, number][] => rowsAt.flatMap((y) => [[r.x + inset, y], [r.x + r.w - 1 - inset, y]] as [number, number][]);

    switch (r.kind) {
      case "entrance": {
        // 계단: 벽 앞면 중간·아랫줄에 올라가는 계단(문 앞 줄이 아닌 칸), 앞 칸 = 방 맨 윗줄 바닥
        const free = wallXs.filter((x) => !lane[idx(x, r.y)]);
        const sx = [...free].sort((a, b) => Math.abs(a - (r.x + r.w / 2)) - Math.abs(b - (r.x + r.w / 2)))[0];
        if (sx !== undefined) {
          const def = kit(K.stairsUp);
          for (let dy = 0; dy < def.height; dy += 1) lower[idx(sx, topWall + dy)] = def.rows[dy]!.tiles[0]!;
          stairsUp = { x: sx, y: topWall + 1, front: { x: sx, y: r.y } };
          blocked[idx(sx, r.y)] = 1;   // 계단 앞 칸은 비운다(이벤트 자리)
        }
        sideCols(1, [r.y + r.h - 2]).forEach(([x, y]) => put(K.brazier, x, y));
        putFirst(K.crateStack, [[r.x + r.w - 2, r.y + 1], [r.x + 1, r.y + 1]]);
        putFirst(K.barrel, [[r.x + r.w - 3, r.y + 1], [r.x + 2, r.y + 1]]);
        putFirst(K.bones, shuffled(floorCells(1)).slice(0, 6), { lane: false });
        break;
      }
      case "hall": {
        for (const x of wallCenterFirst.filter((x) => (x - r.x) % 4 === 2).slice(0, 2)) put(K.banner, x, topWall);
        corners(2).forEach(([x, y]) => put(K.column, x, y));
        sideCols(1, [r.y + Math.floor(r.h / 2)]).forEach(([x, y]) => put(K.brazier, x, y));
        shuffled(floorCells(1)).slice(0, 3).forEach(([x, y]) => put(K.rubble, x, y, { lane: false }));
        shuffled(floorCells(1)).slice(0, 3).forEach(([x, y]) => put(K.bones, x, y, { lane: false }));
        break;
      }
      case "crypt": {
        const niches = [K.nicheSkull, K.nicheUrn, K.nicheShroud];
        wallXs.filter((x) => (x - r.x) % 3 === 1).forEach((x, i) => put(niches[i % 3]!, x, topWall));
        const rowsAt = [r.y + 1, r.y + 3, r.y + 5].filter((y) => y + 0 < r.y + r.h - 1);
        for (const y of rowsAt) {
          putFirst(K.coffin, [[r.x + 1, y], [r.x + 2, y]]);
          putFirst(K.coffin, [[r.x + r.w - 3, y], [r.x + r.w - 4, y]]);
        }
        corners(0).slice(2).forEach(([x, y]) => put(K.candles, x, y));
        putFirst(K.skulls, shuffled(floorCells(1)).slice(0, 8));
        shuffled(floorCells(1)).slice(0, 3).forEach(([x, y]) => put(K.bones, x, y, { lane: false }));
        break;
      }
      case "cell": {
        wallXs.filter((x) => (x - r.x) % 3 === 1).forEach((x) => put(K.chains, x, topWall));
        corners(0).slice(0, 2).forEach(([x, y]) => put(K.strawBed, x, y + 1));
        putFirst(K.crate, [[r.x + r.w - 1, r.y + r.h - 1], [r.x, r.y + r.h - 1]]);
        putFirst(K.bucket, shuffled(floorCells(1)).slice(0, 8));
        shuffled(floorCells(1)).slice(0, 2).forEach(([x, y]) => put(K.bones, x, y, { lane: false }));
        break;
      }
      case "shrine":
      case "boss": {
        for (const x of wallCenterFirst.filter((x) => (x - r.x) % 3 === 2).slice(0, r.kind === "boss" ? 3 : 2)) put(K.banner, x, topWall);
        const cx = r.x + Math.floor(r.w / 2) - 1;
        const altarTries = [0, 2, -2, 4, -4].map((d) => [cx + d, r.y + 1] as [number, number]);
        const altar = putFirst(K.altar, altarTries);
        if (altar) {
          put(K.candles, altar[0] - 1, altar[1] + 1); put(K.candles, altar[0] + 2, altar[1] + 1);
          put(K.brazier, altar[0] - 2, altar[1] + 2); put(K.brazier, altar[0] + 3, altar[1] + 2);
        }
        if (r.kind === "boss") {
          corners(1).forEach(([x, y]) => put(K.column, x, y + (y === r.y + 1 ? 1 : 0)));
          putFirst(K.archBars, wallXs.filter((x) => isWall(x + 1, topWall) && isWall(x + 1, topWall + 1) && (x - r.x) % 4 === 0).map((x) => [x, topWall] as [number, number]));
        } else corners(2).slice(2).forEach(([x, y]) => put(K.column, x, y));
        putFirst(K.skulls, shuffled(floorCells(1)).slice(0, 8));
        break;
      }
      case "storage": {
        const bx = r.x + r.w - 3;
        putFirst(K.crateStack, [[bx, r.y + 1], [r.x + 1, r.y + 1]]);
        putFirst(K.crate, [[bx + 1, r.y + 1], [r.x + 2, r.y + 1], [bx, r.y + 3]]);
        putFirst(K.crate, [[bx, r.y + 3], [r.x + 1, r.y + 3]]);
        [[r.x + 1, r.y + r.h - 2], [r.x + 2, r.y + r.h - 2], [r.x + r.w - 2, r.y + r.h - 2]].forEach(([x, y]) => put(K.barrel, x!, y!));
        putFirst(K.bucket, shuffled(floorCells(1)).slice(0, 8));
        shuffled(floorCells(1)).slice(0, 2).forEach(([x, y]) => put(K.rubble, x, y, { lane: false }));
        break;
      }
      case "vault": {
        for (const x of wallCenterFirst.filter((x) => (x - r.x) % 3 === 1).slice(0, 2)) put(K.nicheUrn, x, topWall);
        const cx = r.x + Math.floor(r.w / 2) - 1;
        const altar = putFirst(K.altar, [0, 2, -2].map((d) => [cx + d, r.y + 1] as [number, number]));
        if (altar) { put(K.candles, altar[0] - 1, altar[1] + 1); put(K.candles, altar[0] + 2, altar[1] + 1); }
        putFirst(K.crate, [[r.x + 1, r.y + r.h - 2], [r.x + r.w - 2, r.y + r.h - 2]]);
        putFirst(K.crate, [[r.x + r.w - 2, r.y + r.h - 2], [r.x + 1, r.y + r.h - 2]]);
        shuffled(floorCells(1)).slice(0, 3).forEach(([x, y]) => put(K.bones, x, y, { lane: false }));
        break;
      }
    }
    // 벽 횃불은 맨 마지막에 — 계단·깃발·벽감이 먼저 자리를 잡고 남은 벽 칸에만 건다.
    for (const x of torchXs) put(K.torch, x, topWall);
    void sideCols;
  });

  // 가장 깊은(마지막) 방 맨 안쪽에 내려가는 계단 한 칸(바닥 칸 하나의 그림만 바뀐다).
  const deepest = rooms.length > 1 ? rooms[rooms.length - 1]! : null;
  if (deepest) {
    const def = kit(K.stairsDown);
    const spots: [number, number][] = [[deepest.x + deepest.w - 2, deepest.y], [deepest.x + 1, deepest.y], [deepest.x + Math.floor(deepest.w / 2), deepest.y]];
    for (const [x, y] of spots) {
      if (!isFloor(x, y) || upper[idx(x, y)]! >= 0 || lane[idx(x, y)]) continue;
      lower[idx(x, y)] = def.rows[0]!.tiles[0]!;
      stairsDown = { x, y };
      blocked[idx(x, y)] = 1;
      break;
    }
  }

  // ---- 검사 1: 같은 규칙(groundSupport)으로 자기 결과를 본다. 어긋나면 맵을 만들지 않는다.
  const own = groundSupportIssues(pseudo, ts, { events: false }).filter((i) => i.severity === "error");
  if (own.length) throw new DungeonComposeError(`시공기 내부 오류: 받침 없는 물체 ${own.length}건 — ${own[0]!.message}`, "support-violation");

  // ---- 검사 2: 입구에서 모든 방·통로 바닥이 걸어서 닿는지(막힌 칸은 upper 가 있는 칸).
  const entrance = { x: rooms[0]!.x + Math.floor(rooms[0]!.w / 2), y: rooms[0]!.y + rooms[0]!.h - 2 };
  const stand = (x: number, y: number) => isFloor(x, y) && (upper[idx(x, y)]! < 0 || !blockedUpper(upper[idx(x, y)]!)) && !blockedLower(lower[idx(x, y)]!);
  function blockedLower(tile: number): boolean { const pass = ts.passability[tile]; return !pass || !Object.values(pass).some(Boolean); }
  function blockedUpper(tile: number): boolean { const pass = ts.passability[tile]; return !pass || !Object.values(pass).some(Boolean); }
  const seen = new Uint8Array(W * H);
  const queue: [number, number][] = [];
  const startCell = findStand(entrance.x, entrance.y);
  function findStand(x0: number, y0: number): [number, number] {
    for (let r = 0; r < 6; r += 1) for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) if (stand(x0 + dx, y0 + dy)) return [x0 + dx, y0 + dy];
    throw new DungeonComposeError("입구 방에 설 수 있는 바닥이 없다.", "no-entrance");
  }
  queue.push(startCell); seen[idx(startCell[0], startCell[1])] = 1;
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (!stand(nx, ny) || seen[idx(nx, ny)]) continue;
      seen[idx(nx, ny)] = 1; queue.push([nx, ny]);
    }
  }
  function findStandIn(r: PlacedRoom): [number, number] {
    const cx = r.x + Math.floor(r.w / 2), cy = r.y + Math.floor(r.h / 2);
    for (let d = 0; d < 6; d += 1) for (let dy = -d; dy <= d; dy += 1) for (let dx = -d; dx <= d; dx += 1) if (stand(cx + dx, cy + dy)) return [cx + dx, cy + dy];
    return [cx, cy];
  }
  const unreachable = rooms.filter((r) => { const [cx, cy] = findStandIn(r); return !seen[idx(cx, cy)]; });
  if (unreachable.length) throw new DungeonComposeError(`시공기 내부 오류: 입구에서 걸어 닿지 않는 방 ${unreachable.map((r) => r.id).join(", ")}`, "unreachable");

  // 이벤트·적을 둘 만한 빈 바닥 칸(방마다) — 위층 그림이 없고 네 이웃도 걸을 수 있는 칸, 방 가운데에서 가까운 순.
  const spots: Record<string, { x: number; y: number }[]> = {};
  for (const r of rooms) {
    const cx = r.x + (r.w - 1) / 2, cy = r.y + (r.h - 1) / 2;
    const cells: { x: number; y: number; d: number }[] = [];
    for (let y = r.y + 1; y < r.y + r.h - 1; y += 1) for (let x = r.x + 1; x < r.x + r.w - 1; x += 1) {
      if (upper[idx(x, y)]! >= 0 || blocked[idx(x, y)]) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([ox, oy]) => stand(x + ox!, y + oy!))) continue;
      cells.push({ x, y, d: Math.abs(x - cx) + Math.abs(y - cy) });
    }
    cells.sort((a, b) => a.d - b.d);
    const picked: { x: number; y: number }[] = [];
    for (const c of cells) { if (picked.every((p) => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) >= 3)) picked.push({ x: c.x, y: c.y }); if (picked.length >= 6) break; }
    spots[r.id] = picked;
  }

  const picture = drawPicture(W, H, isFloor, isWall, upper, lower, ts);
  return { width: W, height: H, lower, upper, rooms, corridors, entrance: { x: startCell[0], y: startCell[1] }, stairsUp, stairsDown, spots, picture, counts, warnings };
}

function drawPicture(W: number, H: number, isFloor: (x: number, y: number) => boolean, isWall: (x: number, y: number) => boolean,
  upper: readonly number[], lower: readonly number[], ts: TilesetDef): string[] {
  void lower; void ts;
  const rows: string[] = [];
  for (let y = 0; y < H; y += 1) {
    let line = "";
    for (let x = 0; x < W; x += 1) line += upper[y * W + x]! >= 0 ? "o" : isFloor(x, y) ? "." : isWall(x, y) ? "W" : "#";
    rows.push(line);
  }
  return rows;
}
