// editor/tools/wildRouteForest.ts
// author_wild_route 의 숲마을(forest_harmony) 시공 — 필드 파이프라인(scripts/content/author-field-routes.mjs)과 같은 부품.
//
// 왜 따로 있나(2026-09-25 조수 시험 S4 「숲길 필드」 4.8/10): 합본 흙길(390~452)을 깔아 대각선이 네모 계단이었고,
// 풀숲은 네모, 가운데 풀밭이 텅 비었으며(5×5 빈칸 109개, 한 화면 79%), 막다른 1칸 풀밭 띠가 남았다.
// - 길: 부드러운 곡선을 4방향 칸으로 옮기고 동·남으로 한 칸 넓힌 뒤 숲마을 흙길 forest_harmony_road_47(8방향 이음)로 칠한다.
// - 풀숲: 타원+잡음 덩이를 키큰 풀 규칙(arrangeTallGrass: 2×2 미만 삭제·모서리 깎기·덩이마다 한 종류)으로 다듬는다.
// - 숲: 길에서 2~5칸 물러난 굽이숲(grove_47). 막힌 작은 풀밭·1칸 띠는 칠하기 전에 숲으로 메운다.
// - 남은 빈 풀밭: 가장 큰 빈 정사각형부터 나무 2~3그루·덤불·바위 덩이로 채운다(빈칸 게이트: 5×5 적게, 한 화면 ≤40%).
// - 막다른 1칸 풀밭 칸은 꽃 관목·바위로 막는다.

import { forestCanopyTiles } from "@/project/defaults/forestGrove";
import { arrangeTallGrass } from "@/project/defaults/tallGrassArrange";
import { TILE } from "@/project/defaults/constants";
import type { AutotileGroup, GameMap, Project, Rect, TilesetDef } from "@/project/types";
import type { Rng } from "@/util/rng";
import { paintContouredForest, shadeForestCanopy } from "./village/forestContour";
import { FOREST_TRUNK_TILES } from "./village/forestTrunkTiles";
import { prepareVillageTreeKit, stampTree, treeStampCells, type TreeStamp } from "./village/treeKit";

type Point = { x: number; y: number };
const NEIGHBORS = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]] as const;
const ROAD_GROUP = "forest_harmony_road_47";
const GROVE_GROUP = "forest_harmony_grove_47";
const GROUND = TILE.GRASS;
/** Single-tile meadow dressing (upper, solid) — the field routes' set: flowering bush, grey boulder, rubble. */
const DRESSING = [768, 537, 29] as const;

export function canPaintForestWildRoute(tileset: TilesetDef): boolean {
  return tileset.image.type === "bundled" && tileset.image.id === "tex_forest_harmony"
    && !!tileset.autotileGroups?.some(group => group.id === ROAD_GROUP);
}

export interface ForestWildRouteInput {
  readonly project: Project;
  readonly map: GameMap;
  readonly tileset: TilesetDef;
  readonly exits: readonly Point[];
  readonly patchCount: number;
  readonly seed: number;
  readonly rng: Rng;
  readonly relayDoors: readonly Point[];
  /** Least-cost 4-way path (the tool's routePath), used to pull the road to existing doors. */
  readonly routeTo: (from: Point, to: Point) => Point[];
  readonly warnings: string[];
}

export interface ForestWildRouteResult {
  readonly path: Point[];
  readonly road: Set<number>;
  readonly grass: Set<number>;
  readonly patches: Rect[];
  readonly roadCells: number;
  readonly treeCells: number;
  readonly fill: { clumps: number; dressing: number };
}

function hashNoise(x: number, y: number, seed: number): number {
  const hash = (a: number, b: number): number => {
    let n = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ seed;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff * 2 - 1;
  };
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
  const ease = (v: number): number => v * v * (3 - 2 * v);
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), ease(tx)), lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), ease(tx)), ease(ty));
}

function inward(map: GameMap, p: Point): Point {
  if (p.x === 0) return { x: 1, y: 0 };
  if (p.x === map.width - 1) return { x: -1, y: 0 };
  if (p.y === 0) return { x: 0, y: 1 };
  return { x: 0, y: -1 };
}

/** Catmull-Rom through the stops, walked cell by cell with 4-way steps (no diagonal jumps, no long L). */
function curvePath(map: GameMap, stops: readonly Point[]): Point[] {
  const out: Point[] = [];
  const lo = 2, hiX = map.width - 3, hiY = map.height - 3;
  const push = (target: Point, clampInner: boolean): void => {
    const t = clampInner ? { x: Math.max(lo, Math.min(hiX, target.x)), y: Math.max(lo, Math.min(hiY, target.y)) } : target;
    let last = out[out.length - 1];
    if (!last) { out.push(t); return; }
    while (last.x !== t.x || last.y !== t.y) {
      const dx = t.x - last.x, dy = t.y - last.y;
      // Step along the axis with more distance left; alternate on a tie so a diagonal reads as a fine stair.
      const horizontal = Math.abs(dx) > Math.abs(dy) || (Math.abs(dx) === Math.abs(dy) && out.length % 2 === 0);
      const next = horizontal ? { x: last.x + Math.sign(dx), y: last.y } : { x: last.x, y: last.y + Math.sign(dy) };
      out.push(next); last = next;
    }
  };
  const p = [stops[0]!, ...stops, stops[stops.length - 1]!];
  push(stops[0]!, false);
  for (let i = 1; i + 2 < p.length; i++) {
    const [p0, p1, p2, p3] = [p[i - 1]!, p[i]!, p[i + 1]!, p[i + 2]!];
    const steps = Math.max(4, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) * 3));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number): number => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const inner = !(i === 1 && s < steps * 0.2) && !(i + 3 === p.length && s > steps * 0.8);
      push({ x: Math.round(f(p0.x, p1.x, p2.x, p3.x)), y: Math.round(f(p0.y, p1.y, p2.y, p3.y)) }, inner && i !== 1 && i + 3 !== p.length);
    }
  }
  return out;
}

function paintBlob(map: GameMap, layer: "lowerTiles" | "upperTiles", group: AutotileGroup, cells: Iterable<number>,
  joined: (x: number, y: number, from: number) => boolean): void {
  const W = map.width;
  for (const i of cells) {
    const x = i % W, y = Math.floor(i / W);
    let mask = 0;
    NEIGHBORS.forEach(([dx, dy], bit) => { if (joined(x + dx, y + dy, i)) mask |= 1 << bit; });
    const tile = group.variantMap[String(mask)];
    if (tile !== undefined) map[layer][i] = tile;
  }
}

export function paintForestWildRoute(input: ForestWildRouteInput): ForestWildRouteResult {
  const { map, tileset, exits, rng, seed, warnings } = input;
  const W = map.width, H = map.height, N = W * H;
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  const at = (x: number, y: number): number => y * W + x;
  const roadGroup = tileset.autotileGroups!.find(group => group.id === ROAD_GROUP)!;

  // 1. Road centre line: straight 3-cell stubs out of each exit, a smooth S between them (two side stops).
  const path: Point[] = [];
  for (let i = 0; i + 1 < exits.length; i++) {
    const a = exits[i]!, b = exits[i + 1]!, ia = inward(map, a), ib = inward(map, b);
    const a3 = { x: a.x + ia.x * 3, y: a.y + ia.y * 3 }, b3 = { x: b.x + ib.x * 3, y: b.y + ib.y * 3 };
    const dx = b3.x - a3.x, dy = b3.y - a3.y, length = Math.max(1, Math.hypot(dx, dy));
    const px = -dy / length, py = dx / length, swing = Math.max(2, Math.min(W, H) / 5), side = rng() < 0.5 ? -1 : 1;
    const clampStop = (p: Point): Point => ({ x: Math.max(3, Math.min(W - 4, Math.round(p.x))), y: Math.max(3, Math.min(H - 4, Math.round(p.y))) });
    const s1 = clampStop({ x: a3.x + dx / 3 + px * swing * side, y: a3.y + dy / 3 + py * swing * side });
    const s2 = clampStop({ x: a3.x + (dx * 2) / 3 - px * swing * side, y: a3.y + (dy * 2) / 3 - py * swing * side });
    const segment = curvePath(map, [a, a3, s1, s2, b3, b]);
    // Rounding the curve can step back onto a cell (a one-cell spur once widened): cut every loop of the segment
    // (only within it — the next segment starts back out of the same exit).
    for (let k = 0, seenAt = new Map<number, number>(); k < segment.length; k++) {
      const key = at(segment[k]!.x, segment[k]!.y), before = seenAt.get(key);
      if (before !== undefined && before < k) {
        for (let j = before + 1; j < k; j++) seenAt.delete(at(segment[j]!.x, segment[j]!.y));
        segment.splice(before + 1, k - before);
        k = before;
        continue;
      }
      seenAt.set(key, k);
    }
    path.push(...(i === 0 ? segment : segment.slice(1)));
  }
  // Two cells wide like the villages and field routes: widen every centre cell east and south.
  const road = new Set<number>();
  for (const p of path) {
    road.add(at(p.x, p.y));
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) if (inside(p.x + dx, p.y + dy)) road.add(at(p.x + dx, p.y + dy));
  }
  for (const door of input.relayDoors) {
    let nearest = path[0]!, best = Infinity;
    for (const p of path) { const d = Math.abs(p.x - door.x) + Math.abs(p.y - door.y); if (d < best) { best = d; nearest = p; } }
    if (best === 0) continue;
    try {
      for (const p of input.routeTo({ x: door.x, y: door.y }, nearest)) road.add(at(p.x, p.y));
    } catch {
      warnings.push(`기존 문 (${door.x},${door.y}) 까지 길을 끌 수 없습니다 — 출구와 문이 이어지도록 지형을 확인하세요.`);
    }
  }

  // 2. Tall grass blobs across the road (encounter patches), kept apart so each stays its own patch.
  const exitNear = (x: number, y: number, r: number): boolean => exits.some(e => Math.abs(e.x - x) <= r && Math.abs(e.y - y) <= r);
  const eventAt = new Set(map.events.map(event => at(event.x, event.y)));
  const blobs: Set<number>[] = [];
  const blobOf = new Int32Array(N).fill(-1);
  for (let k = 0; k < input.patchCount; k++) {
    const anchor = path[Math.floor(((k + 1) / (input.patchCount + 1)) * (path.length - 1))]!;
    for (let attempt = 0; attempt < 8; attempt++) {
      const cx = anchor.x + 0.5 + (rng() - 0.5) * 2, cy = anchor.y + 0.5 + (rng() - 0.5) * 2;
      const rx = 2.8 + rng() * 1.8, ry = 2.4 + rng() * 1.3, nseed = (seed * 131 + k * 17 + attempt) | 0;
      const cells = new Set<number>();
      let ok = true;
      for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2) && ok; y++) for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
        const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + 0.45 * hashNoise(x / 2.2, y / 2.2, nseed);
        if (d >= 1) continue;
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || exitNear(x, y, 3)) { ok = false; break; }
        // Two clear cells from any other blob (8-way), so arranging never merges two locations.
        for (let yy = y - 2; yy <= y + 2 && ok; yy++) for (let xx = x - 2; xx <= x + 2; xx++) if (inside(xx, yy) && blobOf[at(xx, yy)]! >= 0) { ok = false; break; }
        if (eventAt.has(at(x, y))) ok = false;
        cells.add(at(x, y));
      }
      if (!ok || cells.size < 8) continue;
      for (const i of cells) blobOf[i] = blobs.length;
      blobs.push(cells);
      break;
    }
  }
  if (blobs.length < input.patchCount) warnings.push(`풀숲 ${input.patchCount}개 중 ${blobs.length}개만 자리를 찾았습니다(맵이 좁거나 출구가 가깝습니다).`);

  // Road first (grass cells stay out of it), then the grass arranged against that road.
  for (const i of road) map.lowerTiles[i] = GROUND;
  const wantedGrass = blobs.flatMap(cells => [...cells]);
  const roadPaint = new Set([...road].filter(i => blobOf[i]! < 0));
  const roadJoined = (x: number, y: number, from: number): boolean => inside(x, y) ? roadPaint.has(at(x, y))
    : exitNear(from % W, Math.floor(from / W), 1);
  for (const i of roadPaint) map.lowerTiles[i] = roadGroup.variantMap["255"] ?? map.lowerTiles[i]!;
  paintBlob(map, "lowerTiles", roadGroup, roadPaint, roadJoined);
  const arranged = arrangeTallGrass(map, { cells: wantedGrass, tileset, seed, lawn: GROUND });
  map.lowerTiles = arranged.lowerTiles;
  const grass = new Set(arranged.patches.flatMap(p => p.cells));
  // A road cell the arranging returned to lawn (a trimmed corner) is road again, so the road never breaks.
  const reroad = [...road].filter(i => blobOf[i]! >= 0 && !grass.has(i));
  if (reroad.length) {
    for (const i of reroad) roadPaint.add(i);
    const touched = new Set<number>();
    for (const i of reroad) for (const [dx, dy] of [[0, 0], ...NEIGHBORS]) {
      const x = i % W + dx, y = Math.floor(i / W) + dy;
      if (inside(x, y) && roadPaint.has(at(x, y))) touched.add(at(x, y));
    }
    paintBlob(map, "lowerTiles", roadGroup, touched, roadJoined);
  }
  // A one-cell road spur poking into the grass (the widened road met the blob edge) goes back to lawn when the
  // exits and doors stay joined through road and grass without it.
  const targets = [...exits, ...input.relayDoors].map(p => at(p.x, p.y));
  const joinedWithout = (skip: number): boolean => {
    const seen = new Uint8Array(N), queue = [targets[0]!];
    seen[targets[0]!] = 1;
    for (let k = 0; k < queue.length; k++) {
      const c = queue[k]!;
      for (const [dx, dy] of NEIGHBORS.slice(0, 4)) {
        const x = c % W + dx, y = Math.floor(c / W) + dy, j = at(x, y);
        if (!inside(x, y) || seen[j] || j === skip || !(roadPaint.has(j) || grass.has(j) || targets.includes(j))) continue;
        seen[j] = 1; queue.push(j);
      }
    }
    return targets.every(t => seen[t]);
  };
  const spurs: number[] = [], intoGrass = new Set<number>();
  for (const i of [...roadPaint]) {
    const x = i % W, y = Math.floor(i / W);
    if (exitNear(x, y, 1) || targets.includes(i)) continue;
    const sides = NEIGHBORS.slice(0, 4).map(([dx, dy]) => at(x + dx, y + dy));
    const roadSides = NEIGHBORS.slice(0, 4).filter(([dx, dy]) => inside(x + dx, y + dy) && roadPaint.has(at(x + dx, y + dy))).length;
    if (roadSides > 1 || !sides.some(j => grass.has(j)) || !joinedWithout(i)) continue;
    // Into the grass when it closes a 2×2 grass block there, else lawn — unless lawn would only leave a notch.
    const g = (dx: number, dy: number): boolean => inside(x + dx, y + dy) && grass.has(at(x + dx, y + dy));
    const block = ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).some(([dx, dy]) => g(dx, 0) && g(0, dy) && g(dx, dy));
    const lawnSides = sides.filter((j, k) => inside(x + NEIGHBORS[k]![0], y + NEIGHBORS[k]![1]) && !roadPaint.has(j) && !grass.has(j)).length;
    if (!block && lawnSides < 2) continue;
    roadPaint.delete(i); map.lowerTiles[i] = GROUND; spurs.push(i);
    if (block) { grass.add(i); intoGrass.add(i); }
  }
  if (spurs.some(i => grass.has(i))) {
    const again = arrangeTallGrass(map, { cells: grass, tileset, seed, lawn: GROUND });
    map.lowerTiles = again.lowerTiles;
    grass.clear();
    for (const p of again.patches) for (const c of p.cells) grass.add(c);
    // The re-arranging may trim the new corner again: then the spur stays road.
    for (const i of intoGrass) if (!grass.has(i)) roadPaint.add(i);
  }
  // A lone road cell left between two grass patches (no road beside it, even diagonally) goes back to lawn too.
  for (const i of [...roadPaint]) {
    const x = i % W, y = Math.floor(i / W);
    if (exitNear(x, y, 1) || targets.includes(i)) continue;
    if (NEIGHBORS.some(([dx, dy]) => inside(x + dx, y + dy) && roadPaint.has(at(x + dx, y + dy))) || !joinedWithout(i)) continue;
    roadPaint.delete(i); map.lowerTiles[i] = GROUND; spurs.push(i);
  }
  if (spurs.length) {
    const touched = new Set<number>();
    for (const i of spurs) for (const [dx, dy] of [[0, 0], ...NEIGHBORS]) {
      const x = i % W + dx, y = Math.floor(i / W) + dy;
      if (inside(x, y) && roadPaint.has(at(x, y))) touched.add(at(x, y));
    }
    paintBlob(map, "lowerTiles", roadGroup, touched, roadJoined);
  }
  const patches: Rect[] = [];
  blobs.forEach(cells => {
    const kept = [...cells].filter(i => grass.has(i));
    if (!kept.length) return;
    const xs = kept.map(i => i % W), ys = kept.map(i => Math.floor(i / W));
    const x = Math.min(...xs), y = Math.min(...ys);
    patches.push({ x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 });
  });

  // 3. Forest set back 2..5 cells from the road and grass, pockets and 1-wide strips filled before painting.
  const dist = new Int32Array(N).fill(1 << 20);
  const queue: number[] = [];
  const source = (i: number): void => { if (dist[i] !== 0) { dist[i] = 0; queue.push(i); } };
  for (const i of road) source(i);
  for (const i of grass) source(i);
  for (const e of exits) source(at(e.x, e.y));
  for (const event of map.events) if (inside(event.x, event.y)) source(at(event.x, event.y));
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k]!, x = i % W, y = Math.floor(i / W);
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx, ny = y + dy;
      if (!inside(nx, ny) || dist[at(nx, ny)]! <= dist[i]! + 1) continue;
      dist[at(nx, ny)] = dist[i]! + 1; queue.push(at(nx, ny));
    }
  }
  const reserved = (i: number): boolean => {
    const x = i % W, y = Math.floor(i / W);
    return dist[i]! <= 1 || exitNear(x, y, 2);
  };
  const setback = (x: number, y: number): number => 2.2 + 1.3 * hashNoise(x / 6, y / 6, seed ^ 0x3c6ef) + 0.9 * hashNoise(x / 2.5, y / 2.5, seed ^ 0x51ed2);
  const want = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (!reserved(i) && dist[i]! >= setback(i % W, Math.floor(i / W))) want[i] = 1;
  const openCell = (x: number, y: number): boolean => inside(x, y) && want[at(x, y)] === 0;
  for (let round = 0; round < 8; round++) {
    let changed = false;
    // Thin strips and dead ends of the meadow-to-be become forest.
    for (let i = 0; i < N; i++) {
      if (want[i] || reserved(i)) continue;
      const x = i % W, y = Math.floor(i / W);
      const n = openCell(x, y - 1), s = openCell(x, y + 1), e = openCell(x + 1, y), w = openCell(x - 1, y);
      if ((n ? 1 : 0) + (s ? 1 : 0) + (e ? 1 : 0) + (w ? 1 : 0) <= 1 || (!n && !s) || (!e && !w)) { want[i] = 1; changed = true; }
    }
    // Small meadow pockets not touching the road or the grass read as holes.
    const seen = new Uint8Array(N);
    for (let start = 0; start < N; start++) {
      if (seen[start] || want[start]) continue;
      const comp = [start]; seen[start] = 1;
      let touches = false;
      for (let k = 0; k < comp.length; k++) {
        const c = comp[k]!; if (reserved(c)) touches = true;
        for (const [dx, dy] of NEIGHBORS.slice(0, 4)) {
          const x = c % W + dx, y = Math.floor(c / W) + dy;
          if (openCell(x, y) && !seen[at(x, y)]) { seen[at(x, y)] = 1; comp.push(at(x, y)); }
        }
      }
      if (!touches && comp.length < 60) { for (const c of comp) want[c] = 1; changed = true; }
    }
    if (!changed) break;
  }
  const kit = prepareVillageTreeKit(tileset);
  const grove = kit.grove ?? tileset.autotileGroups?.find(group => group.id === GROVE_GROUP);
  let treeCells = 0;
  const bare = (i: number): boolean => map.upperTiles[i] === TILE.EMPTY && map.lowerTiles[i] === GROUND;
  if (grove) {
    const report = paintContouredForest(map, { x: 0, y: 0, w: W, h: H }, grove,
      (x, y) => !reserved(at(x, y)) && bare(at(x, y)), seed, 1, undefined,
      (x, y) => (want[at(Math.floor(x), Math.floor(y))] ? 1 : -1));
    treeCells = report.cells.size;
    // Trunk repair can leave bare cells sealed inside the canopy: close them into the canopy (field routes).
    const canopy = forestCanopyTiles(grove);
    const isCanopy = (x: number, y: number): boolean => inside(x, y) && canopy.has(map.upperTiles[at(x, y)]!);
    const trunk = (t: number): boolean => FOREST_TRUNK_TILES.has(t);
    const loose = (i: number): boolean => map.upperTiles[i] === TILE.EMPTY && (map.lowerTiles[i] === GROUND || trunk(map.lowerTiles[i]!)) && !reserved(i);
    const sealed = new Set<number>(), seen = new Uint8Array(N);
    for (let start = 0; start < N; start++) {
      if (seen[start] || !loose(start)) continue;
      const comp = [start]; seen[start] = 1;
      let open = false;
      for (let k = 0; k < comp.length; k++) for (const [dx, dy] of NEIGHBORS.slice(0, 4)) {
        const x = comp[k]! % W + dx, y = Math.floor(comp[k]! / W) + dy;
        if (!inside(x, y)) continue;
        const j = at(x, y);
        if (loose(j)) { if (!seen[j]) { seen[j] = 1; comp.push(j); } } else if (!isCanopy(x, y)) open = true;
      }
      if (!open && comp.length < 40) for (const c of comp) sealed.add(c);
    }
    for (const i of sealed) {
      map.upperTiles[i] = grove.variantMap["255"]!; map.lowerTiles[i] = GROUND;
      for (let j = i - W; j >= 0 && trunk(map.lowerTiles[j]!) && canopy.has(map.upperTiles[j]!); j -= W) map.lowerTiles[j] = GROUND;
    }
    if (sealed.size) {
      const touched = new Set<number>();
      for (const i of sealed) for (const [dx, dy] of [[0, 0], ...NEIGHBORS]) {
        const x = i % W + dx, y = Math.floor(i / W) + dy;
        if (isCanopy(x, y)) touched.add(at(x, y));
      }
      paintBlob(map, "upperTiles", grove, touched, (x, y) => isCanopy(x, y));
      shadeForestCanopy(map, grove);
      treeCells += sealed.size;
    }
  }

  // 4. Clumps in the biggest empty meadow squares: 2-3 trees, a bush pair, or a boulder + flowering bush trio.
  // Clumps may stand on the verge next to the road, never on the road, the grass or an exit mouth.
  const plain = (i: number): boolean => bare(i) && !grass.has(i) && !road.has(i) && dist[i]! >= 1
    && !exitNear(i % W, Math.floor(i / W), 2) && !eventAt.has(i);
  const walkable = (x: number, y: number): boolean => {
    if (!inside(x, y)) return false;
    const i = at(x, y);
    return map.upperTiles[i] === TILE.EMPTY && (map.lowerTiles[i] === GROUND || grass.has(i) || roadPaint.has(i));
  };
  const fits = (stamp: TreeStamp, x: number, y: number): boolean => x >= 0 && y >= 0 && x + stamp.w <= W && y + stamp.h <= H
    && treeStampCells(stamp, x, y, W).every(plain);
  const trees = [kit.big, kit.medium].filter((stamp): stamp is TreeStamp => !!stamp);
  const bushes = kit.shrubs;
  let clumps = 0, dressing = 0;
  const openSquare = (): { x: number; y: number; size: number } => {
    const dp = new Int32Array((W + 1) * (H + 1));
    let best = { x: 0, y: 0, size: 0 };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!bare(at(x, y)) || grass.has(at(x, y)) || road.has(at(x, y)) || skip.has(at(x, y))) continue;
      const v = 1 + Math.min(dp[y * (W + 1) + x + 1]!, dp[(y + 1) * (W + 1) + x]!, dp[y * (W + 1) + x]!);
      dp[(y + 1) * (W + 1) + x + 1] = v;
      if (v > best.size) best = { x: x - v + 1, y: y - v + 1, size: v };
    }
    return best;
  };
  const skip = new Set<number>();
  const meadow = (i: number): boolean => bare(i) && !grass.has(i) && !road.has(i);
  const narrow = (i: number): boolean => {
    if (!meadow(i)) return false;
    const x = i % W, y = Math.floor(i / W);
    const n = walkable(x, y - 1), s = walkable(x, y + 1), e = walkable(x + 1, y), w = walkable(x - 1, y);
    return (n ? 1 : 0) + (s ? 1 : 0) + (e ? 1 : 0) + (w ? 1 : 0) <= 1 || (!n && !s) || (!e && !w);
  };
  for (let tries = 0; tries < 60; tries++) {
    const square = openSquare();
    if (square.size < 3) break;
    const cx = square.x + Math.floor(square.size / 2), cy = square.y + Math.floor(square.size / 2);
    const choice = rng();
    const placed: number[] = [];
    const tryStamp = (stamp: TreeStamp, x: number, y: number): boolean => {
      if (!fits(stamp, x, y)) return false;
      // A clump must not squeeze the meadow beside it into a 1-cell strip or a dead end: undo it if it does.
      const region: number[] = [];
      for (let yy = y - 2; yy < y + stamp.h + 2; yy++) for (let xx = x - 2; xx < x + stamp.w + 2; xx++) if (inside(xx, yy)) region.push(at(xx, yy));
      const before = new Set(region.filter(narrow));
      const cells = treeStampCells(stamp, x, y, W), saved = cells.map(i => [map.lowerTiles[i]!, map.upperTiles[i]!] as const);
      stampTree(map, stamp, x, y);
      if (region.some(i => narrow(i) && !before.has(i))) {
        cells.forEach((i, k) => { map.lowerTiles[i] = saved[k]![0]; map.upperTiles[i] = saved[k]![1]; });
        return false;
      }
      placed.push(...cells);
      return true;
    };
    const near = (stamp: TreeStamp, x: number, y: number): boolean => {
      for (let r = 0; r <= 2; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && tryStamp(stamp, x + dx, y + dy)) return true;
      }
      return false;
    };
    if (choice < 0.6 && trees.length && square.size >= 4) {
      // Two or three trees side by side, offset so the group reads as a clump, not a row.
      const count = square.size >= 6 ? 3 : 2;
      const first = trees[Math.floor(rng() * trees.length)]!;
      near(first, cx - Math.floor(first.w / 2), cy - Math.floor(first.h / 2));
      for (let n = 1; n < count; n++) {
        const next = trees[Math.floor(rng() * trees.length)]!;
        const ox = (n % 2 ? 1 : -1) * (first.w - 1), oy = n === 2 ? -2 : 1;
        near(next, cx - Math.floor(next.w / 2) + ox, cy - Math.floor(next.h / 2) + oy);
      }
    }
    if (!placed.length && bushes.length) {
      // A round bush with a small one tucked beside it (never a confetti of single props).
      const big = bushes[0]!, small = bushes[bushes.length - 1]!;
      if (!near(big, cx - 1, cy - 1)) near(small, cx - 1, cy - 1);
      else if (rng() < 0.6) near(small, cx + 2, cy + 1);
    }
    if (placed.length) clumps++;
    else for (let yy = square.y; yy < square.y + square.size; yy++) for (let xx = square.x; xx < square.x + square.size; xx++) skip.add(at(xx, yy));
  }

  // 5. A meadow cell that leads nowhere (one walkable side at most) takes a flowering bush — one pass, so a
  // bush closes the tip of a 1-cell strip without eroding the meadow behind it.
  const tips: number[] = [];
  for (let i = 0; i < N; i++) {
    if (!plain(i)) continue;
    const x = i % W, y = Math.floor(i / W);
    if (NEIGHBORS.slice(0, 4).filter(([dx, dy]) => walkable(x + dx, y + dy)).length <= 1) tips.push(i);
  }
  for (const i of tips) { map.upperTiles[i] = DRESSING[0]; dressing++; }

  return { path, road, grass, patches, roadCells: roadPaint.size, treeCells, fill: { clumps, dressing } };
}
