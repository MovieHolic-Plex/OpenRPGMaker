// project/sfStationComposer.ts
// SF 정거장·네온 거리(sf_station) 맵 구성기 — 종류(kind)와 씨앗(seed)만 주면 매번 다른 맵을 규칙으로 짠다. jpCityStreetComposer 와 같은 생각이다:
// AI 는 용도(어떤 장소인지)를 고르고, 배치·조화는 이 함수가 한다. 견본을 붙이지 않는다 — 방 크기·방 수·가구 고르기·건물 줄·탈것 자리가 씨앗마다 바뀐다.
//
// 종류
//   station  정거장 로비 + 복도 + 거주구(선실 여럿·식당·위생실). 벽은 선체 격벽(at-wall-hull) 천장 + 그 밑 앞면 두 줄(wall-face-hull/-viewport).
//   lab      연구 기지 실내: 큰 실험실 + 복도 + 의무실·냉동실·서버실. 벽은 흰 연구실 벽(at-wall-white / wall-face-white).
//   street   사이버 네온 거리: [뒷골목] [북쪽 건물 줄] [보도] [4줄 도로·횡단보도·탈것] [광장(노점·키오스크·광고판·정류장)] [남쪽 건물 줄] [맨 아래 보도].
//   moonbase 달 기지 야외: 레골리스 땅 + 다져진 길(오토타일) 큰길과 문마다 잇는 가지길 + 북쪽 모듈·돔 줄 + 남쪽 착륙장·셔틀·로버·탱크·태양광·접시·바위.
//
// 실내 규칙(3/4 시점): 방 바깥은 모두 벽 천장이다. 방의 맨 위 두 줄은 벽 앞면(막힘)이고 바닥은 그 아래부터다. 방끼리는 남북 문 통로(폭 2)로만 잇는다
// (옆 문은 앞면 그림이 끊겨 쓰지 않는다). 벽 부착물(화면·전망창·소화기)은 앞면 아래 줄에, 키 큰 가구는 바닥 첫 줄에 등을 대고 선다.
// 기물을 놓을 때마다 통행 검사(출발점에서 모든 문 앞·방 가운데 칸이 닿는가)를 하고, 막으면 되돌린다.
// 이 파일은 순수 함수다: GameMap·TilesetDef 를 받아 칸을 쓴다(도구 compose_sf_station_map 이 복제본에서 부른다).

import { setLayerTileAt, layerTileAt } from "@/project/mapLayers";
import { addMapLocation, COMPOSED_LAYOUT_TAG } from "@/project/mapNamedLocations";
import type { GameMap, StructureKitDef, TilesetDef } from "@/project/types";

export type SfMapKind = "station" | "lab" | "street" | "moonbase";
export const SF_MAP_KINDS: readonly SfMapKind[] = ["station", "lab", "street", "moonbase"];
export const SF_MIN_SIZE: Readonly<Record<SfMapKind, { w: number; h: number }>> = {
  station: { w: 34, h: 26 }, lab: { w: 32, h: 24 }, street: { w: 36, h: 26 }, moonbase: { w: 36, h: 26 },
};
export const SF_DEFAULT_SIZE: Readonly<Record<SfMapKind, { w: number; h: number }>> = {
  station: { w: 44, h: 32 }, lab: { w: 40, h: 30 }, street: { w: 48, h: 30 }, moonbase: { w: 48, h: 32 },
};

export interface SfPlaced { readonly id: string; readonly x: number; readonly y: number }
export interface SfArea { readonly name: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly tag: string; readonly door?: { x: number; y: number } }
export interface SfComposeResult {
  readonly kind: SfMapKind;
  readonly seed: number;
  readonly placed: readonly SfPlaced[];
  readonly areas: readonly SfArea[];
  readonly spawn: { x: number; y: number };
  readonly skipped: number;
  readonly summary: string;
}

/** 씨앗 고정 난수(mulberry32). */
function rngOf(seed: number): () => number {
  let a = (seed * 2654435761 + 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N = 1, E = 2, S = 4, W = 8;

/** 칸 쓰기·키트 찍기·통행 검사를 묶은 작업판. 쓰기는 기록해 두었다가 되돌릴 수 있다. */
class Board {
  readonly w: number;
  readonly h: number;
  private readonly kits = new Map<string, StructureKitDef>();
  /** 위층(3층) 기물이 차지한 칸 — 키트끼리 겹치지 않게. */
  readonly taken: boolean[];
  private journal: { layer: 1 | 2 | 3; i: number; prev: number }[] | null = null;
  readonly placed: SfPlaced[] = [];
  skipped = 0;
  readonly rng: () => number;

  constructor(readonly map: GameMap, readonly ts: TilesetDef, seed: number) {
    this.w = map.width; this.h = map.height;
    for (const k of ts.structureKits ?? []) this.kits.set(k.id, k);
    this.taken = new Array<boolean>(this.w * this.h).fill(false);
    this.rng = rngOf(seed);
  }

  kit(id: string): StructureKitDef | undefined { return this.kits.get(`sf-${id}`); }
  has(id: string): boolean { return this.kits.has(`sf-${id}`); }
  idx(x: number, y: number): number { return y * this.w + x; }
  inb(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  pick<T>(xs: readonly T[]): T { return xs[Math.floor(this.rng() * xs.length)]!; }
  chance(p: number): boolean { return this.rng() < p; }
  int(lo: number, hi: number): number { return lo + Math.floor(this.rng() * (hi - lo + 1)); }

  private put(layer: 1 | 2 | 3, i: number, t: number): void {
    if (this.journal) this.journal.push({ layer, i, prev: layerTileAt(this.map, layer, i) });
    setLayerTileAt(this.map, layer, i, t);
  }
  setLower(x: number, y: number, t: number): void { if (this.inb(x, y) && t >= 0) this.put(1, this.idx(x, y), t); }

  /** 투명 덧그림 칸인가(굽기 pc flat: 아래 priority·잠긴 위 홈) — 2층에 둔다. */
  private isFlat(t: number): boolean {
    const m = this.ts.tileMeta?.[t];
    return this.ts.priority[t] === "lower" && !!m?.locked && m.defaultLayer === "upper";
  }
  passableTile(t: number): boolean { return t < 0 || this.ts.passability[t]?.up !== false; }
  walkable(x: number, y: number): boolean {
    if (!this.inb(x, y)) return false;
    const i = this.idx(x, y);
    const lo = this.map.lowerTiles[i] ?? -1;
    if (lo < 0 || !this.passableTile(lo)) return false;
    return this.passableTile(layerTileAt(this.map, 2, i)) && this.passableTile(layerTileAt(this.map, 3, i));
  }

  /** 낱칸 바닥 그룹(`sf:floor:<id>`)의 변형 칸 — col 이 없으면 0번을 주로, 가끔 다른 변형. */
  floor(id: string, col?: number): number {
    const k = this.kit(id);
    if (k) {
      const row = k.rows[0]!;
      const cells = row.tiles.map((t, c) => (t >= 0 ? t : row.upperTiles?.[c] ?? -1));
      if (col !== undefined) return cells[Math.min(col, cells.length - 1)] ?? -1;
      return this.chance(0.78) ? cells[0]! : this.pick(cells);
    }
    const g = (this.ts.tileGroups ?? []).find((group) => group.id === `sf:floor:${id}`);
    return g?.tileIds[0] ?? -1;
  }

  fillFloor(id: string, x0: number, y0: number, w: number, h: number): void {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.setLower(x, y, this.floor(id));
  }

  /** 4방향 오토타일: mask 칸에 그룹 변형을 깐다. 이웃 판정은 same(x,y) — 맵 밖은 이어진 것으로 본다(edgeConnects). */
  autotile(groupId: string, cells: readonly boolean[], same: (x: number, y: number) => boolean = (x, y) => cells[this.idx(x, y)]!): void {
    const g = (this.ts.autotileGroups ?? []).find((group) => group.id === `sf-${groupId}`);
    if (!g) return;
    const conn = (x: number, y: number) => !this.inb(x, y) || same(x, y);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (!cells[this.idx(x, y)]) continue;
      const m = (conn(x, y - 1) ? N : 0) | (conn(x + 1, y) ? E : 0) | (conn(x, y + 1) ? S : 0) | (conn(x - 1, y) ? W : 0);
      const t = g.variantMap[String(m)];
      if (t !== undefined) {
        if (g.layer === "upper") this.put(2, this.idx(x, y), t); else this.setLower(x, y, t);
      }
    }
  }

  /** 키트를 (x,y) 왼쪽 위에 찍는다. 맵 밖·위층 겹침·막힌 땅 위 막힌 칸이면 찍지 않고 false. */
  stamp(id: string, x: number, y: number, opts: { onWall?: boolean } = {}): boolean {
    const k = this.kit(id);
    if (!k) { this.skipped++; return false; }
    for (let r = 0; r < k.height; r++) for (let c = 0; c < k.width; c++) {
      const lo = k.rows[r]!.tiles[c] ?? -1, up = k.rows[r]!.upperTiles?.[c] ?? -1;
      if (lo < 0 && up < 0) continue;
      const X = x + c, Y = y + r;
      if (!this.inb(X, Y)) return false;
      const i = this.idx(X, Y);
      if (up >= 0 && !this.isFlat(up) && this.taken[i]) return false;
      if (up >= 0 && !this.isFlat(up) && !this.passableTile(up) && !opts.onWall) {
        const ground = this.map.lowerTiles[i] ?? -1;
        if (ground < 0 || !this.passableTile(ground)) return false;
      }
    }
    for (let r = 0; r < k.height; r++) for (let c = 0; c < k.width; c++) {
      const lo = k.rows[r]!.tiles[c] ?? -1, up = k.rows[r]!.upperTiles?.[c] ?? -1;
      const i = this.idx(x + c, y + r);
      if (lo >= 0) this.put(1, i, lo);
      if (up >= 0) {
        if (this.isFlat(up)) this.put(2, i, up);
        else { this.put(3, i, up); this.taken[i] = true; }
      }
    }
    this.placed.push({ id, x, y });
    return true;
  }

  /** 키트를 찍되, 찍은 뒤 must 칸들이 출발점에서 걸어 닿지 않으면 되돌린다. */
  stampSafe(id: string, x: number, y: number, start: { x: number; y: number }, must: readonly { x: number; y: number }[], opts: { onWall?: boolean } = {}): boolean {
    this.journal = [];
    const takenBefore = this.taken.slice();
    const ok = this.stamp(id, x, y, opts);
    const journal = this.journal;
    this.journal = null;
    if (!ok) return false;
    if (this.reachesAll(start, must)) return true;
    for (let j = journal.length - 1; j >= 0; j--) setLayerTileAt(this.map, journal[j]!.layer, journal[j]!.i, journal[j]!.prev);
    for (let i = 0; i < this.taken.length; i++) this.taken[i] = takenBefore[i]!;
    this.placed.pop();
    return false;
  }

  reach(start: { x: number; y: number }): Uint8Array {
    const seen = new Uint8Array(this.w * this.h);
    if (!this.walkable(start.x, start.y)) return seen;
    const stack = [this.idx(start.x, start.y)];
    seen[stack[0]!] = 1;
    while (stack.length) {
      const i = stack.pop()!; const x = i % this.w, y = (i - x) / this.w;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (!this.inb(nx, ny)) continue;
        const j = this.idx(nx, ny);
        if (!seen[j] && this.walkable(nx, ny)) { seen[j] = 1; stack.push(j); }
      }
    }
    return seen;
  }
  reachesAll(start: { x: number; y: number }, must: readonly { x: number; y: number }[]): boolean {
    const seen = this.reach(start);
    return must.every((p) => this.inb(p.x, p.y) && seen[this.idx(p.x, p.y)] === 1);
  }
  kitSize(id: string): { w: number; h: number } | undefined { const k = this.kit(id); return k ? { w: k.width, h: k.height } : undefined; }
}

// ─────────────────────────────── 실내(정거장·연구 기지)
interface Room { name: string; tag: string; x: number; y: number; w: number; h: number; floor: string; /** 바닥 변형 고정(줄무늬 같은 강한 변형을 흩뿌리지 않게) */ floorCol?: number }

const CELL_WALL = 0, CELL_FLOOR = 1;

function composeInterior(b: Board, kind: "station" | "lab"): { areas: SfArea[]; spawn: { x: number; y: number } } {
  const { w: Wd, h: Hd } = b;
  const hull = kind === "station" ? "hull" : "white";
  const grid = new Array<number>(Wd * Hd).fill(CELL_WALL);
  const roomOf = new Array<number>(Wd * Hd).fill(-1);
  const rooms: Room[] = [];
  const carve = (r: Room) => {
    rooms.push(r);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { grid[b.idx(x, y)] = CELL_FLOOR; roomOf[b.idx(x, y)] = rooms.length - 1; }
  };
  const doorCells: { x: number; y: number }[] = [];
  /** 가로 벽 한 줄(y)을 x..x+1 에서 뚫어 위·아래 방을 잇는다. */
  const doorN = (x: number, y: number) => { for (const dx of [0, 1]) grid[b.idx(x + dx, y)] = CELL_FLOOR; doorCells.push({ x, y }); };

  // 띠: 위 큰 방(로비·실험실) / 복도 / 아래 방 줄. 벽 두께 1, 방 맨 위 두 줄은 앞면.
  const topH = Math.max(9, Math.min(13, Math.floor(Hd * 0.36) + b.int(-1, 1)));
  const corrH = 5;                                                     // 앞면 2 + 바닥 3
  const top: Room = { name: kind === "station" ? "로비" : "실험실", tag: kind === "station" ? "lobby" : "lab", x: 1, y: 1, w: Wd - 2, h: topH, floor: kind === "station" ? "deck-plate" : "lab-floor" };
  const corrY = top.y + top.h + 1;
  const corr: Room = { name: "복도", tag: "corridor", x: 1, y: corrY, w: Wd - 2, h: corrH, floor: "deck-plate" };
  const lowY = corrY + corrH + 1;
  const lowH = Math.min(10, Hd - 1 - lowY);
  carve(top); carve(corr);
  // 아래 방 줄: 왼쪽부터 폭을 나눈다. 방 사이 벽 1칸.
  const lowRooms: Room[] = [];
  const specs = kind === "station"
    ? (() => {
      // 식당·위생실은 늘 넣고, 남는 폭을 선실로 채운다(선실 폭 6~8 + 벽 1).
      const shared = [{ name: "식당", tag: "mess", w: [10, 12], floor: "lab-floor" }, { name: "위생실", tag: "hygiene", w: [6, 6], floor: "lab-floor" }];
      const cabins = Math.max(2, Math.floor((Wd - 2 - 13 - 7) / 7));
      const list = Array.from({ length: cabins }, (_, i) => ({ name: `선실 ${i + 1}`, tag: "cabin", w: [6, 6], floor: "crew-floor" }));
      return b.chance(0.5) ? [...shared, ...list] : [...list, ...shared.reverse()];
    })()
    : [{ name: "의무실", tag: "medbay", w: [9, 11], floor: "lab-floor" }, { name: "냉동 수면실", tag: "cryo", w: [9, 12], floor: "deck-plate" }, { name: "서버실", tag: "server", w: [7, 9], floor: "deck-grate", floorCol: 0 }, { name: "수경 재배실", tag: "hydro", w: [8, 10], floor: "lab-floor" }, { name: "창고", tag: "storage", w: [7, 9], floor: "cargo-floor", floorCol: 0 }];
  let x = 1;
  for (const spec of specs) {
    let rw = b.int(spec.w[0]!, spec.w[1]!);
    if (x + rw > Wd - 1) rw = Wd - 1 - x;
    if (rw < 5 || lowH < 5) break;
    const r: Room = { name: spec.name, tag: spec.tag, x, y: lowY, w: rw, h: lowH, floor: spec.floor, ...("floorCol" in spec ? { floorCol: spec.floorCol as number } : {}) };
    carve(r); lowRooms.push(r);
    x += rw + 1;
  }
  // 남은 폭이 넓으면 마지막 방을 늘린다(벽 덩어리 대신)
  if (lowRooms.length && x < Wd - 1) {
    const last = lowRooms[lowRooms.length - 1]!;
    for (let y = last.y; y < last.y + last.h; y++) for (let xx = last.x + last.w; xx < Wd - 1; xx++) { grid[b.idx(xx, y)] = CELL_FLOOR; roomOf[b.idx(xx, y)] = rooms.indexOf(last); }
    last.w = Wd - 1 - last.x;
  }
  // 문: 위 방 ↔ 복도 2~3곳, 복도 ↔ 아래 방마다 1곳
  const topDoors = Wd >= 40 ? 3 : 2;
  for (let k = 0; k < topDoors; k++) doorN(Math.max(3, Math.min(Wd - 5, Math.round(((k + 1) * Wd) / (topDoors + 1)) - 1 + b.int(-2, 2))), top.y + top.h);
  // 아래 방 문: 작은 방(선실·위생실)은 한쪽 끝(가구가 반대쪽 벽에 붙는다), 큰 방은 가운데 근처
  for (const r of lowRooms) {
    const small = r.w <= 8;
    const dx = small ? (b.chance(0.5) ? r.w - 3 : 1) : Math.max(1, Math.min(r.w - 3, Math.floor(r.w / 2) - 1 + b.int(-1, 1)));
    doorN(r.x + dx, lowY - 1);
  }

  // 앞면 칸: 위가 벽인 바닥 칸(문 통로 아래는 아니다) → 앞면 0줄, 그 아래 → 앞면 1줄
  const face = new Array<number>(Wd * Hd).fill(-1);
  for (let y = 1; y < Hd; y++) for (let xx = 0; xx < Wd; xx++) {
    const i = b.idx(xx, y);
    if (grid[i] !== CELL_FLOOR || grid[b.idx(xx, y - 1)] !== CELL_WALL) continue;
    face[i] = 0;
    if (y + 1 < Hd && grid[b.idx(xx, y + 1)] === CELL_FLOOR) face[b.idx(xx, y + 1)] = 1;
  }
  // 천장 오토타일 + 앞면 + 바닥
  const wallMask = grid.map((c) => c === CELL_WALL);
  b.autotile(`at-wall-${hull}`, wallMask);
  const faceKit = b.kit(`wall-face-${hull}`), viewKit = b.kit("wall-face-viewport");
  const viewportFrom = kind === "station" ? top.x + Math.floor(top.w * 0.3) : -1, viewportTo = kind === "station" ? top.x + Math.floor(top.w * 0.7) : -1;
  for (let y = 0; y < Hd; y++) for (let xx = 0; xx < Wd; xx++) {
    const i = b.idx(xx, y);
    if (grid[i] !== CELL_FLOOR) continue;
    const f = face[i]!;
    if (f >= 0) {
      const inView = roomOf[i] === 0 && xx >= viewportFrom && xx < viewportTo && viewKit;
      const kit = inView ? viewKit! : faceKit;
      const col = inView ? (xx % 2 === 0 ? 0 : 3) : (b.chance(0.12) ? b.int(1, 3) : 0);
      const t = kit?.rows[f]?.tiles[col] ?? -1;
      if (t >= 0) b.setLower(xx, y, t);
      continue;
    }
    const r = roomOf[i]! >= 0 ? rooms[roomOf[i]!]! : corr;
    b.setLower(xx, y, b.floor(r.floor, r.floorCol));
  }
  // 복도 가운데 안내등 줄
  const laneY = corr.y + 3;
  for (let xx = corr.x; xx < corr.x + corr.w; xx++) if (face[b.idx(xx, laneY)]! < 0) b.setLower(xx, laneY, b.floor("deck-lane-h", 0));
  // 문 통로 바닥(벽 줄을 뚫은 칸)
  for (const d of doorCells) for (const dx of [0, 1]) b.setLower(d.x + dx, d.y, b.floor("deck-hazard", 0));

  const floorTop = (r: Room) => r.y + 2;                          // 앞면 두 줄 아래 첫 바닥 줄
  const spawn = { x: Math.floor(Wd / 2), y: corr.y + 3 };
  const must: { x: number; y: number }[] = [];
  for (const d of doorCells) must.push({ x: d.x, y: d.y }, { x: d.x, y: d.y + 1 }, { x: d.x, y: d.y - 1 });
  for (const r of rooms) must.push({ x: r.x + Math.floor(r.w / 2), y: floorTop(r) + Math.floor((r.h - 2) / 2) });
  /** 이 방 위·아래 가장자리에 붙은 문 통로의 열. 가구는 그 열을 피한다(통로가 방 안으로 이어지게). */
  const doorCols = (r: Room) => doorCells.filter((d) => (d.y === r.y - 1 || d.y === r.y + r.h) && d.x + 1 >= r.x && d.x < r.x + r.w).flatMap((d) => [d.x, d.x + 1]);
  const free = (r: Room, x0: number, w: number) => !doorCols(r).some((c) => c >= x0 && c < x0 + w);
  const tryAt = (id: string, xx: number, yy: number, onWall = false) => b.stampSafe(id, xx, yy, spawn, must, { onWall });
  /** 방 뒷벽(바닥 첫 줄)을 따라 키 큰 가구를 왼쪽부터 늘어놓는다. */
  const alongBack = (r: Room, ids: readonly string[], gap = 1) => {
    let cx = r.x + 1;
    for (const id of ids) {
      const s = b.kitSize(id); if (!s) continue;
      while (cx + s.w <= r.x + r.w - 1 && !free(r, cx, s.w)) cx++;
      if (cx + s.w > r.x + r.w - 1) break;
      if (tryAt(id, cx, floorTop(r))) cx += s.w + gap; else cx++;
    }
  };
  /** 앞면 아래 줄(벽 부착물). 문 통로 위는 비운다. */
  const onFace = (r: Room, ids: readonly string[], step: number) => {
    for (let cx = r.x + 1 + b.int(0, 2), k = 0; cx < r.x + r.w - 1; cx += step, k++) {
      const id = ids[k % ids.length]!; const s = b.kitSize(id); if (!s) continue;
      if (cx + s.w > r.x + r.w - 1 || !free(r, cx, s.w)) continue;
      if (face[b.idx(cx, r.y + 1)] !== 1) continue;
      tryAt(id, cx, r.y + 1, true);
    }
  };
  /** 방 안 빈 곳에 흩어 놓기(가장자리 1칸·문 앞 2줄 비움). */
  const scatter = (r: Room, ids: readonly string[], n: number, rowFrom = 1) => {
    let placed = 0;
    for (let tries = 0; tries < n * 14 && placed < n; tries++) {
      const id = ids[(placed + tries) % ids.length]!; const s = b.kitSize(id); if (!s) continue;
      const xx = b.int(r.x + 1, r.x + r.w - 1 - s.w), yy = b.int(floorTop(r) + rowFrom, r.y + r.h - 1 - s.h);
      if (xx < r.x || yy < floorTop(r)) continue;
      if (!free(r, xx, s.w) && yy + s.h >= r.y + r.h - 1) continue;
      if (tryAt(id, xx, yy)) placed++;
    }
  };

  // ── 위 큰 방
  if (kind === "station") {
    const cx = top.x + Math.floor(top.w / 2) - 1;
    // 승강기·에어록 문(벽 앞면 두 줄 위) — 문 앞 바닥 칸은 늘 비운다
    for (const [id, dx] of [[b.pick(["elevator-door", "airlock-inner"]), 2 + b.int(0, 2)], ["elevator-door", top.w - 4 - b.int(0, 2)]] as const) {
      if (free(top, top.x + dx, 2) && tryAt(id, top.x + dx, top.y, true)) must.push({ x: top.x + dx, y: floorTop(top) }, { x: top.x + dx + 1, y: floorTop(top) });
    }
    onFace(top, ["wall-screen-a", "porthole-planet", "wall-lamp", "wall-map-display", "porthole-star", "wall-screen-b"], b.int(4, 6));
    const midY = floorTop(top) + Math.floor((top.h - 2) / 2) - 1;
    // 가운데 홀로 테이블 + 깔개, 그 앞 안내 콘솔
    tryAt("rug-hex", cx, midY); tryAt("holo-table", cx, midY);
    tryAt("console-big", cx - 1 + b.int(-3, 3), floorTop(top) + 1);
    alongBack(top, b.chance(0.5) ? ["vending-int", "vending-int", "planter-box", "locker-row"] : ["planter-box", "vending-int", "galley-fridge", "vending-int"], b.int(2, 3));
    // 좌우 대기석 묶음: 벤치 두 줄 + 화분 끝막이
    const seatW = Math.min(9, Math.floor((top.w - 10) / 2) - 2);
    for (const sx of [top.x + 2, top.x + top.w - 2 - seatW]) {
      for (let row = 0; row < 2; row++) {
        const yy = midY - 1 + row * 3;
        tryAt("planter-box", sx, yy);
        for (let bx = sx + 2; bx + 2 <= sx + seatW; bx += 3) tryAt("bench", bx, yy);
      }
    }
    for (let k = 0; k < 4; k++) tryAt(b.pick(["planter-box", "cargo-crate"]), top.x + 2 + k * Math.floor((top.w - 6) / 3), top.y + top.h - 1);
  } else {
    tryAt("airlock-inner", top.x + 2 + b.int(0, 2), top.y);
    onFace(top, ["wall-screen-c", "wall-screen-a", "fire-extinguisher", "wall-screen-b", "vent-grill"], b.int(4, 6));
    alongBack(top, b.chance(0.5) ? ["fume-hood", "specimen-tank", "specimen-tank", "server-rack", "fume-hood", "3d-printer"] : ["3d-printer", "fume-hood", "specimen-tank", "hydroponic-rack", "server-rack"], 1);
    const midY = floorTop(top) + 3;
    for (let k = 0, cx = top.x + 3; k < 4 && cx < top.x + top.w - 6; k++) {
      tryAt(b.pick(["lab-bench", "lab-sink-bench", "analysis-console"]), cx, midY);
      cx += b.int(5, 8);
    }
    tryAt("holo-table", top.x + Math.floor(top.w / 2) - 1, top.y + top.h - 3);
    scatter(top, ["microscope-station", "centrifuge", "stool", "crew-chair", "cargo-crate"], b.int(4, 6), 4);
  }
  // ── 복도
  onFace(corr, ["wall-screen-b", "fire-extinguisher", "wall-lamp", "vent-grill", "wall-pipes"], b.int(5, 8));
  tryAt("pipe-cluster", corr.x + 1, corr.y + 1, true);
  tryAt("pipe-cluster", corr.x + corr.w - 2, corr.y + 1, true);
  for (let k = 0; k < 2; k++) { const xx = b.int(corr.x + 3, corr.x + corr.w - 4); if (face[b.idx(xx, corr.y + 4)]! < 0) tryAt("hatch-floor", xx, corr.y + 4); }
  // ── 아래 방
  for (const r of lowRooms) {
    switch (r.tag) {
      case "cabin": {
        alongBack(r, [b.pick(["bunk", "bunk", "bed-single"]), "locker", "locker"], 0);
        onFace(r, [b.pick(["porthole-star", "porthole-planet"]), "wall-lamp"], 3);
        const deskY = floorTop(r) + 3;
        if (tryAt("console-desk", r.x + 1, deskY)) tryAt("crew-chair", r.x + 1, deskY + 1);
        tryAt("rug-hex", r.x + Math.max(1, r.w - 3), deskY + 1);
        scatter(r, ["planter-box", "cargo-crate", "stool"], 2, 5);
        break;
      }
      case "mess":
        alongBack(r, ["galley-counter", "galley-fridge", "vending-int"], 1);
        onFace(r, ["wall-screen-b", "wall-lamp"], 5);
        for (let k = 0; k < 3; k++) {
          const xx = r.x + 2 + k * 4, yy = floorTop(r) + 3;
          if (tryAt("mess-table", xx, yy)) { tryAt("stool", xx, yy + 1); tryAt("stool", xx + 1, yy + 1); }
        }
        break;
      case "hygiene":
        alongBack(r, ["shower-pod", "shower-pod", "shower-pod"], 0);
        for (let k = 0; k < 3; k++) tryAt("sink-unit", r.x + 1 + k, r.y + r.h - 2);
        tryAt("locker-row", r.x + r.w - 3, floorTop(r) + 3);
        onFace(r, ["vent-grill"], 4);
        break;
      case "medbay":
        alongBack(r, ["med-cabinet", "med-scanner"], 1);
        scatter(r, ["med-bed", "med-bed", "crew-chair"], 3, 2);
        onFace(r, ["wall-screen-c"], 5);
        break;
      case "cryo":
        alongBack(r, ["cryo-bank", "cryo-pod", "cryo-pod"], 0);
        scatter(r, ["power-conduit", "analysis-console"], 2, 3);
        break;
      case "server":
        alongBack(r, ["server-rack", "server-rack", "server-rack", "server-rack", "server-rack"], 0);
        scatter(r, ["power-conduit", "console-desk", "pipe-cluster"], 2, 2);
        break;
      case "hydro":
        alongBack(r, ["hydroponic-rack", "hydroponic-rack", "hydroponic-rack"], 1);
        scatter(r, ["planter-box", "planter-box"], 2, 2);
        break;
      case "storage":
        alongBack(r, ["cargo-container-int", "locker-row"], 1);
        scatter(r, ["cargo-crate", "cargo-pallet", "cargo-crate"], 3, 2);
        break;
    }
  }
  const areas: SfArea[] = rooms.map((r) => ({ name: r.name, x: r.x, y: r.y, w: r.w, h: r.h, tag: r.tag,
    ...(doorCells.find((d) => d.x >= r.x && d.x < r.x + r.w && (d.y === r.y - 1 || d.y === r.y + r.h)) ? { door: doorCells.find((d) => d.x >= r.x && d.x < r.x + r.w && (d.y === r.y - 1 || d.y === r.y + r.h))! } : {}) }));
  return { areas, spawn };
}

// ─────────────────────────────── 네온 거리
const STREET_BUILDINGS_TALL = ["street-tower-l", "street-tower-m", "street-tower-s", "street-apartment", "street-capsule-hotel", "street-data-center"];
const STREET_BUILDINGS_LOW = ["street-noodle-shop", "street-arcade", "street-club", "street-clinic", "street-drone-garage", "street-transit-station", "street-capsule-hotel"];
const STREET_ROLE_KO: Readonly<Record<string, string>> = {
  "street-tower-l": "대형 네온 타워", "street-tower-m": "중형 네온 타워", "street-tower-s": "소형 네온 타워", "street-apartment": "네온 아파트", "street-capsule-hotel": "캡슐 호텔",
  "street-data-center": "데이터 센터", "street-noodle-shop": "국수 가게", "street-arcade": "게임 아케이드", "street-club": "나이트클럽", "street-clinic": "네온 진료소",
  "street-drone-garage": "드론 차고", "street-transit-station": "환승 정거장",
};

function buildingRow(b: Board, ids: readonly string[], foot: number, topLimit: number, groundFill: (x: number, y: number) => void, areas: SfArea[], doorFronts: { x: number; y: number }[]): void {
  let x = b.int(0, 1);
  const used = new Map<string, number>();
  while (x < b.w - 3) {
    const fits = ids.filter((id) => { const s = b.kitSize(id); return s && x + s.w <= b.w && foot - s.h + 1 >= topLimit; });
    if (!fits.length) break;
    fits.sort((a, c) => (used.get(a) ?? 0) - (used.get(c) ?? 0));
    const id = b.chance(0.7) ? fits[0]! : b.pick(fits);
    const s = b.kitSize(id)!;
    if (b.stamp(id, x, foot - s.h + 1)) {
      used.set(id, (used.get(id) ?? 0) + 1);
      const door = { x: x + Math.floor(s.w / 2), y: foot };
      doorFronts.push({ x: door.x, y: foot + 1 });
      areas.push({ name: STREET_ROLE_KO[id] ?? id, x, y: foot - s.h + 1, w: s.w, h: s.h, tag: id.replace("street-", ""), door });
      // 건물 사이 골목 1~2칸: 실외기·상자·쓰레기통
      const gap = b.int(1, 2);
      for (let g = 0; g < gap; g++) for (let y = topLimit; y <= foot; y++) groundFill(x + s.w + g, y);
      if (gap >= 1 && b.chance(0.6)) b.stamp(b.pick(["street-ac-cluster", "street-crate-pile", "street-trash-bin"]), x + s.w, foot) || undefined;
      x += s.w + gap;
    } else x++;
  }
}

function composeStreet(b: Board): { areas: SfArea[]; spawn: { x: number; y: number } } {
  const { w: Wd, h: Hd } = b;
  const areas: SfArea[] = [];
  const doorFronts: { x: number; y: number }[] = [];
  const foot1 = Math.min(10, Math.max(7, Hd - 20));              // 북쪽 건물 발 줄
  const walk1 = foot1 + 1;                                         // 북쪽 보도 2줄
  const road = walk1 + 2;                                          // 도로 4줄
  const plaza = road + 4;                                          // 광장 줄
  const foot2 = Hd - 3;                                            // 남쪽 건물 발 줄
  const plazaH = Math.max(3, foot2 - 5 - plaza);                   // 남쪽 건물이 5줄 이상 서도록
  // 땅
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) b.setLower(x, y, b.floor(y <= foot1 ? "asphalt" : "sidewalk"));
  const roadMask = new Array<boolean>(Wd * Hd).fill(false);
  for (let y = road; y < road + 4; y++) for (let x = 0; x < Wd; x++) roadMask[b.idx(x, y)] = true;
  b.autotile("at-road", roadMask, (x, y) => roadMask[b.idx(x, y)]!);
  // 횡단보도 1~2곳 + 중앙 점선
  const crossings: number[] = [];
  const nCross = Wd >= 44 ? 2 : 1;
  for (let k = 0; k < nCross; k++) crossings.push(Math.round(((k + 1) * Wd) / (nCross + 1)) - 1 + b.int(-3, 3));
  const crossCol = (x: number) => crossings.some((c) => x >= c && x < c + 3);
  for (const c of crossings) for (let y = road; y < road + 4; y++) for (let x = c; x < c + 3; x++) b.setLower(x, y, b.floor("crosswalk", 1));
  for (let x = 0; x < Wd; x++) if (!crossCol(x) && x % 3 !== 2) b.setLower(x, road + 2, b.floor("lane-dash", 0));
  // 건물 줄
  buildingRow(b, STREET_BUILDINGS_TALL.concat(STREET_BUILDINGS_LOW), foot1, 0, (x, y) => b.setLower(x, y, b.floor("asphalt")), areas, doorFronts);
  const top2 = plaza + plazaH;
  buildingRow(b, STREET_BUILDINGS_LOW.concat(["street-tower-s", "street-apartment"]), foot2, top2, () => undefined, areas, doorFronts);
  const spawn = { x: crossings[0]! + 1, y: walk1 + 1 };
  const must = [...doorFronts, { x: 1, y: walk1 + 1 }, { x: Wd - 2, y: walk1 + 1 }, { x: crossings[0]! + 1, y: plaza + 1 }, { x: 1, y: Hd - 1 }];
  const keepClear = new Set(doorFronts.map((d) => b.idx(d.x, d.y)));
  const clearAround = (x: number, y: number, w: number, h: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) if (keepClear.has(b.idx(xx, yy)) || keepClear.has(b.idx(xx, yy + 1))) return false;
    return true;
  };
  // 북쪽 보도 소품(가로등은 일정 간격, 사이사이 자판기·벤치·쓰레기통·화분)
  for (let x = b.int(1, 3); x < Wd - 1; x += b.int(6, 8)) if (clearAround(x, walk1, 1, 2) && !crossCol(x)) b.stampSafe("street-lamp-post", x, walk1, spawn, must);
  const sideProps = ["vending", "street-vending-cyan", "street-trash-bin", "street-bench-neon", "street-planter-neon", "street-atm-kiosk", "street-bollard"];
  for (let k = 0, tries = 0; k < Math.floor(Wd / 6) && tries < 80; tries++) {
    const id = b.pick(sideProps); const s = b.kitSize(id); if (!s) continue;
    const x = b.int(0, Wd - s.w), y = walk1 + 1 - (s.h - 1);
    if (crossCol(x) || crossCol(x + s.w - 1) || !clearAround(x, y, s.w, s.h)) continue;
    if (b.stampSafe(id, x, y, spawn, must)) k++;
  }
  for (let k = 0; k < 3; k++) b.stamp(b.pick(["street-puddle-neon", "street-manhole"]), b.int(0, Wd - 1), walk1 + b.int(0, 1));
  // 도로 위 탈것(횡단보도 피해서)
  const vehicles = ["pod-car", "street-pod-car-cyan", "street-pod-taxi", "street-pod-truck", "street-hover-bike"];
  for (let k = 0, tries = 0; k < Math.max(2, Math.floor(Wd / 14)) && tries < 60; tries++) {
    const id = b.pick(vehicles); const s = b.kitSize(id); if (!s) continue;
    const x = b.int(0, Wd - s.w), y = b.chance(0.5) ? road : road + 4 - s.h;
    let bad = false; for (let xx = x - 1; xx <= x + s.w; xx++) if (crossCol(xx)) bad = true;
    if (bad) continue;
    if (b.stampSafe(id, x, y, spawn, must)) k++;
  }
  // 광장: 노점·키오스크·광고판·정류장·홀로 광고·드론 패드
  const plazaProps = ["street-market-stall-a", "street-market-stall-b", "street-kiosk", "street-neon-billboard", "street-transit-stop", "street-holo-ad", "neon-sign-tower", "street-drone-pad", "street-sign-vertical", "street-cargo-drone"];
  const usedProp = new Map<string, number>();
  for (let k = 0, tries = 0; k < Math.floor(Wd / 4) && tries < 200; tries++) {
    const order = [...plazaProps].sort((a, c) => (usedProp.get(a) ?? 0) - (usedProp.get(c) ?? 0));
    const id = b.chance(0.75) ? order[0]! : b.pick(plazaProps); const s = b.kitSize(id); if (!s) continue;
    const x = b.int(0, Wd - s.w), y = b.int(plaza, Math.max(plaza, foot2 - 4 - s.h));
    if (crossCol(x) || crossCol(x + s.w - 1)) continue;
    if (!clearAround(x, y, s.w, s.h)) continue;
    if (b.stampSafe(id, x, y, spawn, must)) { k++; usedProp.set(id, (usedProp.get(id) ?? 0) + 1); }
  }
  for (let x = b.int(2, 4); x < Wd - 1; x += b.int(7, 10)) if (!crossCol(x)) b.stampSafe("street-bollard", x, plaza, spawn, must);
  // 광장 아래 줄: 가로등·화분·벤치(남쪽 건물 앞 보도 위)
  for (let x = b.int(1, 4); x < Wd - 1; x += b.int(5, 8)) b.stampSafe(b.pick(["street-planter-neon", "street-bench-neon", "street-lamp-post", "street-trash-bin"]), x, foot2 - 3, spawn, must);
  return { areas, spawn };
}

// ─────────────────────────────── 달 기지
const MOON_BUILDINGS = ["hab-dome", "hab-dome-l", "hab-dome-s", "greenhouse-dome", "hab-module", "hab-module-3", "lab-module", "hab-block", "control-tower", "reactor-building", "cooling-plant", "cargo-hangar", "airlock-wide"];
const MOON_ROLE_KO: Readonly<Record<string, string>> = {
  "hab-dome": "거주 돔", "hab-dome-l": "큰 거주 돔", "hab-dome-s": "작은 거주 돔", "greenhouse-dome": "온실 돔", "hab-module": "거주 모듈", "hab-module-3": "3칸 거주 모듈",
  "lab-module": "연구 모듈", "hab-block": "거주 블록", "control-tower": "관제탑", "reactor-building": "반응로 건물", "cooling-plant": "냉각 설비", "cargo-hangar": "화물 격납고", "airlock-wide": "넓은 에어록",
};

function composeMoonbase(b: Board): { areas: SfArea[]; spawn: { x: number; y: number } } {
  // 2026-10-22 적대 검수(마을 종류 표 시험): 48×32·38×26 모두 «위 띠가 빈 월면 · 남쪽 설비가 길 없이 흩뿌려짐»(major).
  // → 건물 줄을 위로 붙이고(지붕 위 2줄만 남김), 남쪽 설비는 큰길에서 내려오는 가지길 끝의 «쓰임 마당»(전력·연료·화물·통신)으로 묶는다.
  const { w: Wd, h: Hd } = b;
  const areas: SfArea[] = [];
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) b.setLower(x, y, b.floor("regolith"));
  const path = new Array<boolean>(Wd * Hd).fill(false);
  const tallest = Math.max(1, ...MOON_BUILDINGS.map((id) => b.kitSize(id)?.h ?? 0));
  const foot = Math.min(Math.floor(Hd * 0.55) + b.int(-1, 1) - 3, tallest + 1); // 북쪽 건물 발 줄(문 앞 2칸 가지길)
  const mainY = foot + 3;
  // 북쪽 건물 줄 — 연구 모듈은 꼭 하나
  const doorFronts: { x: number; y: number }[] = [];
  const order = ["lab-module", ...MOON_BUILDINGS.filter((id) => id !== "lab-module").sort(() => b.rng() - 0.5)];
  let x = b.int(1, 3);
  for (const id of order) {
    const s = b.kitSize(id); if (!s) continue;
    if (x + s.w > Wd - 1) continue;
    if (foot - s.h + 1 < 1) continue;
    if (!b.stamp(id, x, foot - s.h + 1)) continue;
    const door = { x: x + Math.floor(s.w / 2), y: foot };
    doorFronts.push({ x: door.x, y: foot + 1 });
    areas.push({ name: MOON_ROLE_KO[id] ?? id, x, y: foot - s.h + 1, w: s.w, h: s.h, tag: id, door });
    for (let y = foot + 1; y <= mainY; y++) for (const dx of [0, 1]) path[b.idx(Math.min(Wd - 1, door.x + dx - (s.w % 2 === 0 ? 1 : 0)), y)] = true;
    x += s.w + b.int(2, 3);
  }
  // 큰길(2줄) + 남쪽 «설비 길»(2줄) — 두 길을 세로 연결로 잇고, 설비 길 위·아래에 쓰임 마당(전력·연료·화물·통신)과 착륙장을 줄지어 놓는다.
  for (let y = mainY; y < mainY + 2; y++) for (let xx = 1; xx < Wd - 1; xx++) path[b.idx(xx, y)] = true;
  const svcY = Math.min(Hd - 7, mainY + Math.max(6, Math.floor((Hd - mainY) / 2) - 1));
  for (let y = svcY; y < svcY + 2; y++) for (let xx = 2; xx < Wd - 2; xx++) path[b.idx(xx, y)] = true;
  const links = [Math.floor(Wd * 0.25), Math.floor(Wd * 0.75)];
  for (const lx of links) for (let y = mainY + 2; y < svcY; y++) for (const dx of [0, 1]) path[b.idx(lx + dx, y)] = true;
  b.autotile("at-regolith-path", path);
  const spawn = { x: 2, y: mainY };
  const must = [...doorFronts, { x: Wd - 3, y: mainY }, { x: 3, y: svcY }, { x: Wd - 4, y: svcY }];
  // 큰길 가 비컨
  for (let xx = 3; xx < Wd - 2; xx += b.int(7, 10)) b.stampSafe("beacon", xx, mainY - 1, spawn, must);
  const YARDS: { name: string; tag: string; up: string[]; down: string[] }[] = [
    { name: "전력 마당", tag: "power-yard", up: ["solar-array", "solar-array", "battery-bank"], down: ["radiator-panel", "solar-array-l"] },
    { name: "연료 마당", tag: "fuel-yard", up: ["fuel-tank", "gas-tank-pair", "fuel-tank"], down: ["oxygen-tank-row", "fuel-tank"] },
    { name: "화물 마당", tag: "cargo-yard", up: ["container", "crate-stack", "container-stack"], down: ["rover", "crate-stack", "container"] },
    { name: "통신 마당", tag: "comms-yard", up: ["dish", "radome-tower", "antenna-mast"], down: ["comms-relay", "dish"] },
  ].sort(() => b.rng() - 0.5);
  const segW = Math.floor((Wd - 4) / 4);
  const padSeg = b.int(1, 2);
  const free = (xx: number, yy: number, w: number, h: number) => {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (!b.inb(xx + dx, yy + dy) || path[b.idx(xx + dx, yy + dy)]) return false;
    return true;
  };
  const row = (ids: readonly string[], x0: number, x1: number, above: boolean): number => {
    let cx = x0, n = 0;
    for (const id of ids) {
      const s = b.kitSize(id); if (!s) continue;
      for (; cx + s.w - 1 <= x1; cx++) {
        const yy = above ? svcY - s.h : svcY + 2;
        if (!free(cx, yy, s.w, s.h)) continue;
        if (b.stampSafe(id, cx, yy, spawn, must)) { n++; cx += s.w + 1; break; }
      }
    }
    return n;
  };
  for (let k = 0; k < 4; k++) {
    const x0 = 2 + k * segW, x1 = x0 + segW - 2, yd = YARDS[k]!;
    let n = row(yd.up, x0, x1, true);
    if (k === padSeg) {
      const px = x0 + Math.max(0, Math.floor((segW - 4) / 2));
      if (b.stamp("landing-pad", px, svcY + 2)) areas.push({ name: "착륙장", x: px, y: svcY + 2, w: 4, h: 3, tag: "landing-pad" });
    } else n += row(yd.down, x0, x1, false);
    if (n) areas.push({ name: yd.name, x: x0, y: svcY - 3, w: x1 - x0 + 1, h: 8, tag: yd.tag });
  }
  if (b.kit("shuttle")) for (let tx = 2; tx < Wd - 7; tx++) if (free(tx, svcY + 2, 5, 4) && b.stampSafe("shuttle", tx, Math.min(Hd - 5, svcY + 3), spawn, must)) break;
  // 바위·크레이터(길에서 떨어진 곳에 몇 개)
  for (let k = 0, tries = 0; k < Math.floor(Wd / 6) && tries < 120; tries++) {
    const id = b.pick(["rock-regolith-s", "rock-regolith-m", "rock-regolith-l", "boulder-cluster", "crater"]); const s = b.kitSize(id); if (!s) continue;
    const xx = b.int(0, Wd - s.w), yy = b.int(0, Hd - s.h);
    let near = false; for (let dy = -1; dy <= s.h; dy++) for (let dx = -1; dx <= s.w; dx++) if (b.inb(xx + dx, yy + dy) && path[b.idx(xx + dx, yy + dy)]) near = true;
    if (near) continue;
    if (b.stampSafe(id, xx, yy, spawn, must)) k++;
  }
  return { areas, spawn };
}

/**
 * 맵 한 장을 짠다. map 의 땅·2층·3층을 덮어쓴다(이벤트·이름표는 건드리지 않는다 — 이름표는 labelSfAreas).
 * tileset 은 번들 sf_station 사본이어야 한다(키트 `sf-…`·오토타일 `sf-at-…`·바닥 그룹 `sf:floor:…`).
 */
export function composeSfStationMap(map: GameMap, tileset: TilesetDef, kind: SfMapKind, seed: number): SfComposeResult {
  const b = new Board(map, tileset, seed + (kind === "station" ? 0 : kind === "lab" ? 7919 : kind === "street" ? 15887 : 23861));
  for (let i = 0; i < map.width * map.height; i++) { setLayerTileAt(map, 2, i, -1); setLayerTileAt(map, 3, i, -1); setLayerTileAt(map, 4, i, -1); }
  const out = kind === "street" ? composeStreet(b) : kind === "moonbase" ? composeMoonbase(b) : composeInterior(b, kind);
  const counts = new Map<string, number>();
  for (const p of b.placed) counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, c) => c[1] - a[1]).slice(0, 8).map(([id, n]) => `${id}×${n}`).join(", ");
  const kindKo = { station: "정거장 로비·거주구", lab: "연구 기지 실내", street: "사이버 네온 거리", moonbase: "달 기지 야외" }[kind];
  return {
    kind, seed, placed: b.placed, areas: out.areas, spawn: out.spawn, skipped: b.skipped,
    summary: `${kindKo} ${map.width}×${map.height} (seed ${seed}) — 구역 ${out.areas.length}곳 · 기물 ${b.placed.length}개(${top})`,
  };
}

/** 구역·건물을 맵 이름표로 남긴다(옛 sf-area 이름표는 지운다). 사람이 읽는 줄 목록을 돌려준다. */
export function labelSfAreas(map: GameMap, areas: readonly SfArea[]): string[] {
  map.locations = (map.locations ?? []).filter((l) => !(l.tags ?? []).includes("sf-area"));
  const lines: string[] = [];
  for (const a of areas) {
    const note = a.door ? `문 (${a.door.x},${a.door.y}) · 문 앞 접근칸 (${a.door.x},${a.door.y + 1})` : "구역";
    const added = addMapLocation(map, { name: a.name, x: a.x, y: a.y, w: a.w, h: a.h, note, tags: ["sf-area", COMPOSED_LAYOUT_TAG, a.tag] });
    if (added.ok) lines.push(a.door ? `${a.name} 문 (${a.door.x},${a.door.y})` : a.name);
  }
  return lines;
}

/** 요청 글 → 맵 종류 추정(도구 기본값·노트). */
export function sfKindFromText(text: string): SfMapKind {
  if (/사이버|네온|cyber|neon|번화가|뒷골목|거리|street/iu.test(text)) return "street";
  if (/달\s*기지|월면|레골리스|moon\s*base|lunar|화성|행성\s*기지|식민지\s*야외|기지\s*야외/iu.test(text) && !/연구소\s*(?:안|내부)|실험실/u.test(text)) return "moonbase";
  if (/연구소|실험실|연구\s*기지|의무실|lab(?:oratory)?/iu.test(text)) return "lab";
  return "station";
}
