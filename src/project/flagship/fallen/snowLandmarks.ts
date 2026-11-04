/**
 * B7 서리 가도·눈보라 고개 — 두 설원 맵에 서로 다른 랜드마크·윤곽·길 목적을 얹는다(2026-11-03, B7 7→8).
 *
 * 문제(감독 검수): 두 장 모두 author_snow_route 가 같은 눈 바닥·같은 침엽 수관 벽·같은 눈더미 흩뿌림으로 지어
 * 「같은 화면을 두 번 걷는다」. 랜드마크가 없고, 길에 들를 까닭이 없었다.
 *
 * 무엇을 바꾸나 — 그림은 버들항 칩셋에 이미 있는 키트·오토타일만 쓴다(새 도트 없음):
 *  - 서리 가도(map_snow_north_1) = 「심문회가 지나간 길」. 길 서쪽에 반쯤 눈에 묻힌 짐수레(덮개 마차 4×3)와 흩어진 짐,
 *    부러진 바퀴 자국 대신 쓰러진 짐 상자. 첫 굽이 위로 이정표와 돌탑. 심문회 깃발이 꽂힌 채 얼어 있다.
 *    길 목적: 짐수레를 살피면 쇠 마차가 이 길로 올라갔다는 흔적(바퀴 홈·떨어진 공책 한 장) — 쫓는 이야기의 단서.
 *    수레 곁에 상급 회복약 하나(한 번).
 *  - 눈보라 고개(map_snow_north_2) = 「버려진 고개 초소」. 서쪽 빈 눈밭에 무너진 옛 초소 터(회색 돌담·돌기둥·쓰러진 기둥·
 *    부서진 울타리·눈 더미)와 얼음에 갇힌 파수꾼. 숲 벽은 손대지 않는다(바위 능선 시안은 벽돌 상자로 읽혀 뺐다).
 *    길 목적: 고갯마루에서 북쪽을 보면 하늘탑 쪽 하늘이 짧게 열린다(지도 끌어올리기).
 *    폐허의 얼음 기둥 곁에 마력약 하나(한 번).
 *
 * 지키는 것: 입구·출구 이동, 얼음 틈 둘(새라 도약)·얼음 덩이(엘레나 불씨), 모닥불·유대, 필드 적과 우두머리.
 * 걷는 칸은 줄이기만 하고(빈 눈밭 → 소품, 서리 가도 수레 빈터만 숲을 걷는다), 마지막에 입구에서 출구·이벤트 칸이 모두 닿는지 다시 잰다.
 */
import { canMove } from "@/project/collision";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { BEODEUL_NATURE } from "@/project/defaults/beodeulNature";
import { planBeodeulCanopy, shapeBeodeulCanopyMask, writeBeodeulCanopy } from "@/editor/tools/beodeulForest";
import type { Command, Condition, EventPage, GameEvent, GameMap, Project, StructureKitDef, TilesetDef } from "@/project/types";

type Exec = (project: Project, name: string, args: Record<string, unknown>) => unknown;
type Cell = { x: number; y: number };
type Rec = Record<string, unknown>;

export interface SnowLandmarkInput {
  /** [서리 가도, 눈보라 고개] 맵 id. */
  readonly mapIds: readonly string[];
  /** 각 맵의 입구 칸(맵 안쪽으로 한 칸 들어선 칸). */
  readonly starts: readonly Cell[];
  /** 각 맵의 얼음 틈 칸(도약으로 건넌다고 친다). */
  readonly gaps: readonly (readonly Cell[])[];
  readonly speakers: { readonly kael: string; readonly elena: string; readonly sarah: string };
}

const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body } as unknown as Command);
const narrate = (body: string): Command => ({ kind: "text", body } as unknown as Command);
const item = (itemId: string, amount = 1): Command => ({ kind: "changeItem", itemId, op: "+=", amount } as unknown as Command);
const se = (resourceId: string): Command => ({ kind: "playAudio", resourceId, loop: false, channel: "se" } as unknown as Command);
const wait = (ms: number): Command => ({ kind: "wait", ms } as Command);
const setSelf = (key: string): Command => ({ kind: "setSelfSwitch", key, value: true } as unknown as Command);
const selfOn = (key: string): Condition => ({ kind: "selfSwitch", key, value: true } as unknown as Condition);
const m2 = (commandId: string, fields: Rec): Command => ({ kind: "m2Command", commandId, fields } as unknown as Command);
const scroll = (direction: "up" | "down" | "left" | "right", distance: number, durationMs = 900): Command =>
  m2("m2-049-scroll-map", { direction, distance: String(distance), durationMs: String(durationMs), wait: "true" });
const scrollBack = (): Command => m2("m2-049-scroll-map", { mode: "return", durationMs: "700", wait: "true" });
const cutBegin = (): Command => ({ kind: "cutsceneControl", mode: "begin", skippable: true } as unknown as Command);
const cutEnd = (): Command => ({ kind: "cutsceneControl", mode: "end" } as unknown as Command);

function page(id: string, name: string, conditions: Condition[], commands: Command[], extra: Rec = {}): EventPage {
  return { id, name, conditions, graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: false,
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands, ...extra } as unknown as EventPage;
}
function addEvent(map: GameMap, id: string, name: string, at: Cell, pages: EventPage[]): void {
  map.events = map.events.filter((e) => e.id !== id);
  map.events.push({ id, name, x: at.x, y: at.y, trigger: { kind: "action" }, commands: [], pages } as unknown as GameEvent);
}

const hash01 = (x: number, y: number, s: number): number => {
  let h = Math.imul(x * 73856093 ^ y * 19349663 ^ s * 83492791, 0x27d4eb2d);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

function kitOf(tileset: TilesetDef, id: string): StructureKitDef {
  const kit = (tileset.structureKits ?? []).find((k) => k.id === id);
  if (!kit) throw new Error(`[fallen-star snow] 버들항 칩셋에 키트 ${id} 가 없다`);
  return kit;
}

/** 한 맵을 칠하는 도구 묶음 — 칸 판정·키트 찍기·통행 재기. 맵 객체는 도구 호출 뒤 바뀔 수 있어 늘 project.maps 에서 다시 꺼낸다. */
class Painter {
  readonly W: number;
  readonly H: number;
  /** 키트·절벽이 앉은 칸(겹쳐 찍지 않는다). */
  readonly taken = new Set<number>();
  /** 비워 둘 칸(길·이벤트 둘레·출입구). */
  readonly keep = new Set<number>();
  constructor(readonly project: Project, readonly mapId: string) {
    const map = this.map;
    this.W = map.width; this.H = map.height;
  }
  get map(): GameMap { return this.project.maps[this.mapId]!; }
  get tileset(): TilesetDef { return this.project.tilesets[this.map.tilesetId]!; }
  idx(x: number, y: number): number { return y * this.W + x; }
  inMap(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  /** 수관(숲 벽) 칸 — 2·3층에 무언가 있고 막힌 칸. */
  isForest(x: number, y: number): boolean {
    const c = this.idx(x, y), map = this.map;
    return (layerTileAt(map, 3, c) >= 0 || layerTileAt(map, 2, c) >= 0) && !this.walkable(x, y);
  }
  walkable(x: number, y: number): boolean {
    if (!this.inMap(x, y)) return false;
    const map = this.map;
    return canMove(this.project, map, x, y, x, y - 1) || canMove(this.project, map, x, y, x, y + 1)
      || canMove(this.project, map, x, y, x - 1, y) || canMove(this.project, map, x, y, x + 1, y)
      || [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => this.inMap(x + dx!, y + dy!) && canMove(this.project, map, x + dx!, y + dy!, x, y));
  }
  /** 빈 눈밭 칸 — 걷는 칸이고 위층이 비었다. */
  isOpenSnow(x: number, y: number): boolean {
    if (!this.inMap(x, y) || !this.walkable(x, y)) return false;
    const c = this.idx(x, y), map = this.map;
    return layerTileAt(map, 3, c) < 0 && layerTileAt(map, 4, c) < 0 && layerTileAt(map, 2, c) < 0;
  }
  /** 키트 하나를 (x0,y0) 왼쪽 위로 찍는다. 그림 칸이 맵 밖·taken·keep·이벤트 칸이면 찍지 않는다. ground=true 면 막힌 숲 칸에도(지형 키트). */
  stamp(kitId: string, x0: number, y0: number, opt: { overForest?: boolean; footOnSnow?: boolean } = {}): boolean {
    const kit = kitOf(this.tileset, kitId);
    const map = this.map;
    const ev = new Set(map.events.map((e) => this.idx(e.x, e.y)));
    const cells: { c: number; lower: number; upper: number }[] = [];
    for (let j = 0; j < kit.rows.length; j += 1) for (let i = 0; i < kit.width; i += 1) {
      const lower = kit.rows[j]!.tiles?.[i] ?? -1, upper = kit.rows[j]!.upperTiles?.[i] ?? -1;
      if (lower < 0 && upper < 0) continue;
      const x = x0 + i, y = y0 + j;
      if (!this.inMap(x, y)) return false;
      const c = this.idx(x, y);
      if (this.taken.has(c) || this.keep.has(c) || ev.has(c)) return false;
      // 위층 그림이 다른 그림(수관·소품)과 겹치면 안 된다 — 수관 위에 덮으면 칸이 찢어져 보인다.
      if (!opt.overForest && (layerTileAt(map, 2, c) >= 0 || layerTileAt(map, 3, c) >= 0 || layerTileAt(map, 4, c) >= 0)) return false;
      cells.push({ c, lower, upper });
    }
    // 막는 밑줄(발)은 눈밭 위에 서야 한다.
    if (opt.footOnSnow !== false) {
      const ts = this.tileset;
      for (const { c, upper } of cells) {
        if (upper < 0) continue;
        const p = ts.passability[upper];
        if (p && !p.up && !p.down && !p.left && !p.right && !this.walkable(c % this.W, Math.floor(c / this.W))) return false;
      }
    }
    for (const { c, lower, upper } of cells) {
      if (lower >= 0) map.lowerTiles[c] = lower;
      if (upper >= 0) setLayerTileAt(map, 3, c, upper);
      this.taken.add(c);
    }
    return true;
  }
  /** 걸음 수(입구에서) — 틈 칸은 건넌다고 친다. */
  reach(from: Cell, through: ReadonlySet<number> = new Set()): Map<number, number> {
    const map = this.map;
    const dist = new Map<number, number>([[this.idx(from.x, from.y), 0]]);
    const q: number[] = [this.idx(from.x, from.y)];
    for (let h = 0; h < q.length; h += 1) {
      const c = q[h]!, x = c % this.W, y = (c - x) / this.W;
      for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]] as const) {
        const nx = x + dx, ny = y + dy, n = this.idx(nx, ny);
        if (!this.inMap(nx, ny) || dist.has(n)) continue;
        if (!through.has(n) && !through.has(c) && !canMove(this.project, map, x, y, nx, ny)) continue;
        dist.set(n, dist.get(c)! + 1); q.push(n);
      }
    }
    return dist;
  }
}


/** 이 맵 칩셋에서 버들항 자연 수관·숲 그늘(눈) 그림인 칸 번호들. */
function canopyTiles(ts: TilesetDef): Set<number> {
  const src = new Set<number>([...BEODEUL_NATURE.forestCanopy.snow.flat(), ...BEODEUL_NATURE.forestShade.snow].filter((t) => t >= 0));
  return new Set((ts.tileGrafts ?? []).filter((g) => g.sourceChipset === "tex_beodeul_nature" && src.has(g.sourceTile)).map((g) => g.targetTile));
}
/** 지금 수관(숲 벽)인 칸 집합. */
function forestCells(p: Painter): Set<number> {
  const can = canopyTiles(p.tileset), map = p.map, out = new Set<number>();
  for (let c = 0; c < p.W * p.H; c += 1) {
    const t2 = layerTileAt(map, 2, c), t3 = layerTileAt(map, 3, c);
    const pass = p.tileset.passability[t3 >= 0 ? t3 : t2];
    if ((can.has(t2) || can.has(t3)) && pass && !pass.up && !pass.down && !pass.left && !pass.right) out.add(c);
  }
  return out;
}
/** 숲 칸 집합으로 수관·그늘을 다시 깐다(옛 수관·그늘 그림은 지운다, 다른 소품은 그대로). 다듬기로 지워진 칸 수를 돌려준다. */
function reforest(p: Painter, forest: Set<number>, keepForest: ReadonlySet<number> = new Set()): Set<number> {
  const before = new Set(forest);
  // 손댄 칸(원래 숲과 달라진 칸) 둘레 4칸 안에서만 다듬는다 — 지도 전체를 다시 다듬으면 서쪽 가장자리 가는 숲 띠처럼
  // 원래 작가가 둔 숲까지 지워졌다(2차 시안).
  const orig = forestCells(p), near = new Set<number>();
  for (let c = 0; c < p.W * p.H; c += 1) if (orig.has(c) !== forest.has(c)) {
    const x = c % p.W, y = (c - x) / p.W;
    for (let dy = -4; dy <= 4; dy += 1) for (let dx = -4; dx <= 4; dx += 1) if (p.inMap(x + dx, y + dy)) near.add(p.idx(x + dx, y + dy));
  }
  shapeBeodeulCanopyMask(p.W, p.H, forest, { minComponent: 12, minExtent: 3, minInterior: 0.15, block: 2, canFill: (c) => keepForest.has(c) });
  for (const c of before) if (!forest.has(c) && !near.has(c)) forest.add(c);
  for (const c of [...forest]) if (!before.has(c) && !near.has(c)) forest.delete(c);
  const can = canopyTiles(p.tileset), map = p.map;
  for (let c = 0; c < p.W * p.H; c += 1) for (const L of [2, 3] as const) if (can.has(layerTileAt(map, L, c))) setLayerTileAt(map, L, c, -1);
  const plan = planBeodeulCanopy(p.W, p.H, "snow", forest, (s) => !forest.has(s) && layerTileAt(map, 3, s) < 0 && layerTileAt(map, 2, s) < 0);
  writeBeodeulCanopy(p.project, map, p.tileset, plan);
  return new Set([...before].filter((c) => !forest.has(c)));
}
/** 틈을 막으면(건너지 않으면) 입구에서 출구가 끊기는가 — 새로 연 칸이 틈을 돌아가는 옆길을 만들면 안 된다. */
function assertGapsSeal(p: Painter, start: Cell, gaps: readonly Cell[], label: string): void {
  if (!gaps.length) return;
  const exits = p.map.events.filter((e) => e.y === 0 && JSON.stringify(e.pages ?? []).includes("\"transfer\"")).map((e) => p.idx(e.x, e.y));
  const map = p.map, wall = new Set(gaps.map((c) => p.idx(c.x, c.y)));
  const seen = new Set<number>([p.idx(start.x, start.y)]); const q = [p.idx(start.x, start.y)];
  for (let h = 0; h < q.length; h += 1) {
    const c = q[h]!, x = c % p.W, y = (c - x) / p.W;
    for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]] as const) {
      const nx = x + dx, ny = y + dy, n = p.idx(nx, ny);
      if (!p.inMap(nx, ny) || seen.has(n) || wall.has(n) || !canMove(p.project, map, x, y, nx, ny)) continue;
      seen.add(n); q.push(n);
    }
  }
  if (exits.some((e) => seen.has(e))) throw new Error(`[fallen-star snow] ${label}: 얼음 틈을 건너지 않고 출구에 닿는다 — 새로 연 칸이 옆길을 냈다`);
}


/**
 * 본길 곁 숲 벽을 둥글게 걷어 빈터를 낸다. 걸음 수 want 근처 본길 칸에서 동·서로 off 칸 떨어진 곳을 가운데로,
 * 숲이 가장 많이 든(= 새 공간이 생기는) 자리를 고른다. 틈·출입구 둘레는 피한다. 걷어 낸 칸 집합을 돌려준다.
 */
function carveClearing(p: Painter, route: ReadonlySet<number>, dist: ReadonlyMap<number, number>, want: number, rx: number, ry: number,
  avoid: readonly Cell[], seed: number): { center: Cell; cells: Set<number> } {
  const forest = forestCells(p);
  const blob = (cx: number, cy: number): number[] => {
    const out: number[] = [];
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y += 1) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x += 1) {
      if (x < 1 || y < 1 || x >= p.W - 1 || y >= p.H - 1) continue;
      const ex = (x - cx) / rx, ey = (y - cy) / ry, a = Math.atan2(ey, ex);
      const lim = 1 + 0.14 * Math.sin(a * 3 + seed) + 0.08 * Math.sin(a * 5 + seed * 1.7);
      if (ex * ex + ey * ey <= lim * lim) out.push(p.idx(x, y));
    }
    return out;
  };
  let best: { center: Cell; cells: number[]; score: number } | null = null;
  for (const c of route) {
    const d = dist.get(c) ?? 0;
    if (Math.abs(d - want) > 10) continue;
    const x = c % p.W, y = (c - x) / p.W;
    for (const off of [-(rx + 1), rx + 1, -(rx + 2), rx + 2]) {
      const cx = x + off, cy = y;
      if (avoid.some((a) => Math.abs(a.x - cx) + Math.abs(a.y - cy) < rx + ry + 2)) continue;
      const cells = blob(cx, cy);
      const f = cells.filter((k) => forest.has(k)).length;
      if (f < cells.length * 0.6) continue;
      const score = f - Math.abs(d - want) * 2;
      if (!best || score > best.score) best = { center: { x: cx, y: cy }, cells, score };
    }
  }
  if (!best) throw new Error("[fallen-star snow] 빈터를 낼 숲 자리가 없다");
  const cut = new Set(best.cells);
  for (const k of cut) forest.delete(k);
  // 다듬기가 숲 칸을 더 지운 만큼(가는 띠·외톨이)도 빈터에 든다.
  for (const k of reforest(p, forest)) cut.add(k);
  return { center: best.center, cells: cut };
}

/** 이벤트 칸·그 둘레(옆 한 칸)·출입구 둘레를 비운다. */
function guardEvents(p: Painter): void {
  for (const e of p.map.events) {
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (p.inMap(e.x + dx, e.y + dy)) p.keep.add(p.idx(e.x + dx, e.y + dy));
    // 맵 가장자리 출입구는 앞 세 줄을 비운다.
    if (e.y === 0 || e.y === p.H - 1) for (let d = 0; d < 4; d += 1) for (let dx = -2; dx <= 2; dx += 1) {
      const y = e.y === 0 ? d : p.H - 1 - d;
      if (p.inMap(e.x + dx, y)) p.keep.add(p.idx(e.x + dx, y));
    }
  }
}

/** 본길(입구 → 출구 최단 걸음) 칸과 그 옆 칸 — 소품으로 막지 않는다. */
function guardRoute(p: Painter, start: Cell, through: ReadonlySet<number>): { route: Set<number>; dist: Map<number, number> } {
  const dist = p.reach(start, through);
  const exits = p.map.events.filter((e) => (e.y === 0 || e.y === p.H - 1) && JSON.stringify(e.pages ?? []).includes("\"transfer\"")).map((e) => p.idx(e.x, e.y));
  const route = new Set<number>();
  for (const goal of exits) {
    if (!dist.has(goal)) continue;
    let cur = goal;
    while (true) {
      route.add(cur);
      const d = dist.get(cur)!;
      if (d === 0) break;
      const x = cur % p.W, y = (cur - x) / p.W;
      const next = [[0, -1], [1, 0], [-1, 0], [0, 1]].map(([dx, dy]) => p.idx(x + dx!, y + dy!)).find((n) => dist.get(n) === d - 1);
      if (next === undefined) break;
      cur = next;
    }
  }
  for (const c of route) {
    const x = c % p.W, y = (c - x) / p.W;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (p.inMap(x + dx, y + dy)) p.keep.add(p.idx(x + dx, y + dy));
  }
  return { route, dist };
}

/** 지킬 칸 목록(입구·출구·모든 이벤트 칸)이 바꾼 뒤에도 입구에서 닿는지 — 아니면 굽기를 멈춘다. */
function assertReach(p: Painter, start: Cell, through: ReadonlySet<number>, label: string): void {
  const dist = p.reach(start, through);
  const miss = p.map.events.filter((e) => e.x !== 0 || e.y !== 0)
    .filter((e) => !/^ev_scene_mood|_checkpoint_auto$|^ev_fs2_snow_arrive$/.test(e.id))
    .filter((e) => {
      const c = p.idx(e.x, e.y);
      if (dist.has(c)) return false;
      // 막힌 칸에 선 조사 이벤트(수레·기둥·상자·불)는 옆 칸에서 닿으면 된다.
      return ![[0, -1], [1, 0], [-1, 0], [0, 1]].some(([dx, dy]) => dist.has(p.idx(e.x + dx!, e.y + dy!)));
    });
  if (miss.length) throw new Error(`[fallen-star snow] ${label}: 입구에서 닿지 않는 이벤트 — ${miss.map((e) => `${e.id}(${e.x},${e.y})`).join(", ")}`);
}

/** 맵 칸에서 가장 가까운 「키트를 앉힐 자리」를 찾는다. score 가 작을수록 좋다. */
function findSpot(p: Painter, w: number, h: number, ok: (x: number, y: number) => boolean, score: (x: number, y: number) => number): Cell | null {
  let best: Cell | null = null, bestS = Infinity;
  for (let y = 0; y + h <= p.H; y += 1) for (let x = 0; x + w <= p.W; x += 1) {
    if (!ok(x, y)) continue;
    const s = score(x, y);
    if (s < bestS) { bestS = s; best = { x, y }; }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────────────
// 서리 가도 — 반쯤 묻힌 짐수레(심문회 보급대가 버리고 간 것)·흩어진 짐·얼어붙은 깃발, 이정표와 돌탑
// ─────────────────────────────────────────────────────────────────────
function frostRoad(project: Project, mapId: string, start: Cell, gaps: readonly Cell[], who: SnowLandmarkInput["speakers"]): void {
  const p = new Painter(project, mapId);
  const through = new Set(gaps.map((c) => p.idx(c.x, c.y)));
  for (const e of p.map.events) if (e.id.startsWith("ev_fs2_snow_ice")) through.add(p.idx(e.x, e.y));
  guardEvents(p);
  const { dist, route } = guardRoute(p, start, through);
  // 본길 35% 근처 곁 숲 벽을 걷어 짐수레가 버려진 빈터를 낸다(틈·출입구에서 떨어져서).
  const totalR = Math.max(...[...route].map((c) => dist.get(c) ?? 0));
  const avoidR: Cell[] = [...gaps, start, ...p.map.events.filter((e) => e.y === 0 || e.id.startsWith("ev_fs2_snow_ice")).map((e) => ({ x: e.x, y: e.y }))];
  const clearing = carveClearing(p, route, dist, Math.round(totalR * 0.3), 4.6, 3.2, avoidR, 3);
  const dist2 = p.reach(start, through);
  for (const [k, v] of dist2) if (!dist.has(k)) (dist as Map<number, number>).set(k, v);
  // 수레 자리: 빈 눈밭 4×3 + 앞(남) 한 줄이 걷는 칸 — 입구에서 걸음 8~22, 본길 바로 옆(길에서 보인다).
  const wagonOk = (x: number, y: number) => {
    for (let j = 0; j < 3; j += 1) for (let i = 0; i < 4; i += 1) if (!p.isOpenSnow(x + i, y + j) || p.keep.has(p.idx(x + i, y + j))) return false;
    for (let i = 0; i < 4; i += 1) if (!p.inMap(x + i, y + 3) || !p.walkable(x + i, y + 3)) return false;
    return true;
  };
  const steps = (x: number, y: number) => dist.get(p.idx(x, y)) ?? 999;
  const wagon = findSpot(p, 4, 3, wagonOk, (x, y) => {
    const cx = x + 1.5, cy = y + 1;
    return Math.abs(cx - clearing.center.x) + Math.abs(cy - clearing.center.y) * 1.5;
  });
  if (!wagon || !p.stamp("bd-pick-walled-market-wagon", wagon.x, wagon.y)) throw new Error("[fallen-star snow] 서리 가도 짐수레 자리가 없다");
  // 수레 둘레 — 쓰러진 짐(곡식 자루·상자·장작·눈더미). 덮인 듯 수레 동쪽·서쪽 한 칸에 눈 둔덕.
  const around: [string, number, number][] = [
    ["bd-pick-snowfield-mound", -1, 1], ["bd-pick-snowfield-mound", 4, 2], ["bd-pick-snowfield-mound", 0, -1],
    ["bd-pick-walled-market-sack-pile", -3, 1], ["bd-pick-mining-valley-crates", 5, 0], ["bd-pick-snowfield-firewood", -2, 3],
    ["bd-pick-shipwreck-reef-broken-barrel", 4, 3], ["bd-pick-snowfield-mound", 2, -1],
  ];
  for (const [kit, dx, dy] of around) p.stamp(kit, wagon.x + dx, wagon.y + dy);
  // 얼어붙은 심문회 깃발 — 수레 곁에 꽂힌 채(쇠 마차 호위대 것).
  for (const [dx, dy] of [[-1, -2], [4, -2], [-2, -1], [5, -2]] as const) if (p.stamp("bd-capital-banner-pole", wagon.x + dx, wagon.y + dy)) break;
  // 수레 조사 — 앞 칸(남쪽 가운데)에서.
  const front = { x: wagon.x + 1, y: wagon.y + 2 };
  addEvent(p.map, "ev_fs2_snow_wagon", "버려진 짐수레", front, [
    page("ev_fs2_snow_wagon_p", "살핀다", [], [
      narrate("덮개 마차 하나가 바퀴까지 눈에 묻혀 있다.\n심문회 문장이 찍힌 짐 자루가 흩어졌다."),
      say(who.sarah, "탑 수비대 보급 수레다. 바퀴가 부러지자\n그대로 버리고 갔군."),
      narrate("짐 사이에 상급 회복약이 하나 끼어 있었다."),
      item("item_hi_potion", 1),
      se("cc0-se-orp-inventory-cloth"),
      narrate("「상급 회복약」을 손에 넣었다."),
      say(who.elena, "…카엘, 이거 봐. 바퀴 홈이 하나 더 있어.\n좁고 깊은 쇠바퀴."),
      say(who.kael, "쇠 마차야. 이 길로 올라갔어."),
      setSelf("A"),
    ]),
    page("ev_fs2_snow_wagon_done", "다 살폈다", [selfOn("A")], [
      narrate("눈에 묻힌 짐수레다. 쇠바퀴 홈이 북쪽 고개 쪽으로 나 있다."),
    ]),
  ]);
  // 이정표·돌탑 — 첫 굽이 위, 본길 곁(서리 가도 → 눈보라 고개).
  const signOk = (x: number, y: number) => p.isOpenSnow(x, y) && p.isOpenSnow(x, y + 1) && !p.keep.has(p.idx(x, y + 1)) && !p.keep.has(p.idx(x, y))
    && [[-1, 1], [1, 1], [0, 2]].some(([dx, dy]) => p.walkable(x + dx!, y + dy!) && p.keep.has(p.idx(x + dx!, y + dy!)));
  const sign = findSpot(p, 1, 2, signOk, (x, y) => Math.abs(steps(x, y + 1) - 30) + Math.abs(x - wagon.x) * 0.1);
  if (sign && p.stamp("bd-pick-mountain-pass-trail-post", sign.x, sign.y)) {
    addEvent(p.map, "ev_fs2_snow_sign", "이정표", { x: sign.x, y: sign.y + 1 }, [
      page("ev_fs2_snow_sign_p", "읽는다", [], [narrate("얼어붙은 이정표다.\n「북쪽, 눈보라 고개, 서리나루」\n누가 칼끝으로 「탑」 한 글자를 새겨 넣었다.")]),
    ]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [2, 1], [-2, 1]] as const) if (p.stamp("bd-pick-deep-forest-path-cairn", sign.x + dx, sign.y + dy)) break;
  }
  // 수레에서 북쪽으로 이어지는 쇠바퀴 홈 대신 — 길섶에 떨어진 짐 조각 둘(쓰러진 상자·판자).
  const debris = ["bd-pick-snowfield-sled", "bd-pick-snowfield-pile"];
  let k = 0;
  for (const c of [...dist.keys()].sort((a, b) => hash01(a, 3, 71) - hash01(b, 3, 71))) {
    if (k >= debris.length) break;
    const x = c % p.W, y = (c - x) / p.W;
    const d = dist.get(c)!;
    if (d < 14 || d > 40 || Math.abs(x - wagon.x) + Math.abs(y - wagon.y) < 6) continue;
    if (p.stamp(debris[k]!, x, y - 1)) k += 1;
  }
  assertReach(p, start, through, "서리 가도");
  assertGapsSeal(p, start, gaps, "서리 가도");
}

// ─────────────────────────────────────────────────────────────────────
// 눈보라 고개 — 고갯마루에 무너진 옛 초소(회색 돌)·얼음에 갇힌 파수꾼, 북쪽 탑 하늘 보기
// ─────────────────────────────────────────────────────────────────────
function blizzardPass(project: Project, mapId: string, start: Cell, gaps: readonly Cell[], who: SnowLandmarkInput["speakers"]): void {
  const p = new Painter(project, mapId);
  const through = new Set(gaps.map((c) => p.idx(c.x, c.y)));
  guardEvents(p);
  const { dist, route } = guardRoute(p, start, through);
  const map = p.map;
  // 1) 북동 바위 능선은 뺐다(r2 감독 검수): 설원 절벽 키트에는 모서리·가장자리 조각이 없어 어떻게 깔아도 눈 위에 놓인 벽돌 상자로 읽혔다.
  //    숲 벽을 그대로 둔다 — 가짜 벽보다 깨끗한 숲이 낫다. 이 장의 랜드마크는 옛 초소 폐허와 고갯마루 전망이다.

  // 2) 고갯마루 폐허 — 본길 60~80% 지점 곁 빈 눈밭에 무너진 옛 초소 터.
  const steps = (x: number, y: number) => dist.get(p.idx(x, y)) ?? 999;
  const total = Math.max(...[...route].map((c) => dist.get(c) ?? 0));
  const ruinOk = (x: number, y: number) => {
    for (let j = 0; j < 4; j += 1) for (let i = 0; i < 5; i += 1) if (!p.isOpenSnow(x + i, y + j) || p.keep.has(p.idx(x + i, y + j))) return false;
    // 앞(남) 줄이 걷는 칸이어야 파수꾼 앞에 설 수 있다.
    return [1, 2, 3].every((i) => p.walkable(x + i, y + 4));
  };
  const fireEv = map.events.find((e) => e.id === "ev_fs2_snow_fire");
  // 이미 트인 눈밭에서만 고른다 — 숲을 걷는 예비 경로는 뺐다: 걷은 빈터를 폐허가 안 쓰고 서쪽 숲 띠만 사라졌다(r2 감독 검수).
  // 점수: 본길 60% 지점에 가깝고, 남쪽 앞줄이 본길에서 6걸음 안, 모닥불과 겹치지 않게.
  const ruinScore = (cx: number, cy: number) => (x: number, y: number) => {
    const d = Math.min(...[0, 2, 4].map((i) => steps(x + i, y + 4)));
    const nearFire = fireEv ? Math.max(0, 8 - (Math.abs(fireEv.x - x - 2) + Math.abs(fireEv.y - y - 2))) * 3 : 0;
    return Math.abs(x + 2 - cx) + Math.abs(y + 2 - cy) * 1.5 + nearFire + (d > 6 ? 50 : 0);
  };
  const want = [...route].reduce<Cell>((acc, c) => (Math.abs((dist.get(c) ?? 0) - total * 0.6) < Math.abs((dist.get(p.idx(acc.x, acc.y)) ?? 0) - total * 0.6) ? { x: c % p.W, y: Math.floor(c / p.W) } : acc), start);
  const ruin = findSpot(p, 5, 4, ruinOk, ruinScore(want.x, want.y));
  let pillar: Cell | null = null;
  if (ruin) {
    // 5×4 터 — 회색 돌만(사암 신전 키트 금지, r2 감독 검수): 서쪽 무너진 고개 돌담(2×2)·그 앞 쓰러진 돌기둥(2×1),
    // 가운데 부러진 기둥, 동쪽 선 기둥, 그 사이 얼음에 갇힌 파수꾼(앞 칸은 비운다). 둘레에 눈 더미와 부서진 울타리.
    p.stamp("bd-pick-mountain-pass-wall-seg", ruin.x, ruin.y + 1);
    p.stamp("bd-pick-aqueduct-sewer-fallen-column", ruin.x, ruin.y + 3);
    p.stamp("bd-pick-aqueduct-sewer-column-sewer-broken", ruin.x + 2, ruin.y + 1);
    p.stamp("bd-pick-aqueduct-sewer-column-sewer", ruin.x + 4, ruin.y);
    if (p.stamp("bd-pick-dungeon-theme-frozen-warrior", ruin.x + 3, ruin.y + 1)) pillar = { x: ruin.x + 3, y: ruin.y + 3 };
    p.stamp("bd-pick-dungeon-theme-snow-drift", ruin.x + 2, ruin.y + 3) || p.stamp("bd-pick-dungeon-theme-snow-drift", ruin.x - 1, ruin.y + 3);
    p.stamp("bd-pick-dungeon-theme-snow-drift-2", ruin.x + 4, ruin.y + 2);
    p.stamp("bd-pick-castle-catacombs-rubble", ruin.x - 1, ruin.y + 2);
    for (const [dx, dy] of [[5, 3], [-3, 3], [5, 0], [-3, 0]] as const) if (p.stamp("bd-pick-snowfield-fence", ruin.x + dx, ruin.y + dy)) break;
  }
  if (!ruin) throw new Error("[fallen-star snow] 눈보라 고개 폐허 자리가 없다");
  // 얼음에 갇힌 전사 — 옛 초소 파수꾼. 앞에서 살핀다.
  if (!pillar) throw new Error("[fallen-star snow] 눈보라 고개 얼음 속 파수꾼을 못 세웠다");
  const warriorFront = pillar;
  addEvent(map, "ev_fs2_snow_ruin", "얼음 속 파수꾼", warriorFront, [
    page("ev_fs2_snow_ruin_p", "살핀다", [], [
      narrate("무너진 초소 터에 파수꾼 하나가 얼음에 갇혀 서 있다.\n창을 든 채, 북쪽을 보고 있다."),
      say(who.sarah, "…서른 해 전에 버린 고개 초소다.\n한겨울에 교대가 끊겨 그대로 얼었다지."),
      say(who.kael, "창을 놓지 않았네요."),
      narrate("얼음 발치에 굳은 마력약 병이 하나 박혀 있다.\n엘레나가 손바닥으로 녹여 빼냈다."),
      item("item_ether", 1),
      se("cc0-se-orp-inventory-cloth"),
      narrate("「마력약」을 손에 넣었다."),
      setSelf("A"),
    ]),
    page("ev_fs2_snow_ruin_done", "다 살폈다", [selfOn("A")], [narrate("얼음 속 파수꾼은 아직 북쪽을 보고 있다.")]),
  ]);
  // 3) 고갯마루 전망 — 출구 남쪽 본길 위 칸을 밟으면 한 번, 북쪽 하늘을 끌어올려 보여 준다(하늘탑 쪽).
  const exitEv = map.events.find((e) => e.y === 0 && JSON.stringify(e.pages ?? []).includes("\"transfer\""));
  if (exitEv) {
    const want = Math.round(total * 0.8);
    const view = [...route].map((c) => ({ x: c % p.W, y: Math.floor(c / p.W), d: dist.get(c)! }))
      .filter((c) => !map.events.some((e) => e.x === c.x && e.y === c.y) && c.y >= 6)
      .sort((a, b) => Math.abs(a.d - want) - Math.abs(b.d - want))[0];
    if (view) {
      addEvent(map, "ev_fs2_snow_view", "고갯마루", { x: view.x, y: view.y }, [
        page("ev_fs2_snow_view_p", "고갯마루", [], [
          cutBegin(),
          wait(200),
          say(who.kael, "…잠깐. 바람이 갠다."),
          scroll("up", Math.max(4, view.y - 1), 1400),
          wait(700),
          narrate("눈발이 걷힌 틈으로 먼 북쪽 하늘이 보였다.\n가늘고 하얀 빛줄기 하나가 구름까지 닿아 있다."),
          say(who.elena, "하늘탑이야… 이리스는 저기 있어."),
          say(who.sarah, "이 고개만 내려가면 서리나루다.\n오늘 밤 안에 닿는다."),
          scrollBack(),
          cutEnd(),
          setSelf("A"),
        ], { trigger: { kind: "playerTouch" }, priority: "below" }),
        page("ev_fs2_snow_view_done", "끝", [selfOn("A")], [], { priority: "below" }),
      ]);
    }
  }
  // 4) 남쪽 비탈 — 갈림 고리 빈 눈밭에 바위 덩이를 조금 더. 일렬 금지.
  let rocks = 0;
  for (const c of [...dist.keys()].sort((a, b) => hash01(a, 9, 72) - hash01(b, 9, 72))) {
    if (rocks >= 4) break;
    const x = c % p.W, y = (c - x) / p.W;
    if (y < p.H * 0.55 || route.has(c)) continue;
    if (p.stamp("bd-pick-snowfield-rock", x, y - 1)) rocks += 1;
  }
  assertReach(p, start, through, "눈보라 고개");
  assertGapsSeal(p, start, gaps, "눈보라 고개");
}

export function applySnowLandmarks(project: Project, _exec: Exec, input: SnowLandmarkInput): void {
  const [road, pass] = input.mapIds;
  if (!road || !pass) throw new Error("[fallen-star snow] 설원 맵 두 장이 없다");
  frostRoad(project, road, input.starts[0]!, input.gaps[0] ?? [], input.speakers);
  blizzardPass(project, pass, input.starts[1]!, input.gaps[1] ?? [], input.speakers);
}
