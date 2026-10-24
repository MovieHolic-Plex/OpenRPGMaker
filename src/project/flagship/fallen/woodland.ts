/**
 * 폴른 스타 숲 — 굽은 숲길 한 장 칠하기 (2026-10-24 사용자 「미로 같다 · 숲은 탐험이어야 한다」, 나무는 B1 활엽 composer).
 *
 * 길은 꺾은선이 아니라 Catmull-Rom 곡선이고 폭이 굽이마다 2~4칸으로 숨 쉰다. 숲 덩이는 길에서 잡음만큼 들쭉날쭉 물러나고,
 * 빈터(잡음 섞인 타원)·숲 속 나무 섬·굽은 개울(자연 풀 둑)·나무 사이 틈(숨은 물건 자리)을 같은 마스크에 그린다.
 * 나무는 버들항 woodland 나무 composer 활엽(#3122 composeBeodeulForest broadleaf) — 숲 칸 안에만 서고 밑동·수관이 막는다.
 * 길 = 버들항 모랫길 오토타일(fill_region), 물 = 운하 물 칸 + beodeul_nature 풀 둑(던전 숲 #3285 과 같은 둑 표).
 */
import { runTool } from "@/editor/tools/toolRunner";
import { CONSTRUCTION_TOOLS_V3 } from "@/editor/tools/v3/constructionTools";
import { BEODEUL_PLAIN_GRASS } from "@/editor/tools/wildRouteBeodeul";
import { beodeulNatureTileset, beodeulWoodlandGrass, composeBeodeulForest, type BeodeulForestLook, type BeodeulForestPlan } from "@/editor/tools/beodeulForest";
import { composeTreesPlaced, type TreePlacement } from "@/project/defaults/treeComposer";
import { BEODEUL_NATURE } from "@/project/defaults/beodeulNature";
import { translateTiles } from "@/project/objectStamp";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { mulberry32 } from "@/util/rng";

export type Cell = { x: number; y: number };
export type Blob = { cx: number; cy: number; rx: number; ry: number };

export interface WoodPath {
  /** 곡선이 지나는 점(칸 좌표, 소수 허용). 첫·끝 점이 맵 가장자리면 그 출구까지 닿는다. */
  readonly pts: readonly Cell[];
  /** 폭 범위(칸) — 굽이마다 그 사이를 오간다. 기본 [2, 3.2]. */
  readonly w?: readonly [number, number];
}

export interface WoodSpec {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly paths: readonly WoodPath[];
  /** 가장자리 출구(두 칸 폭 문의 왼쪽/위쪽 칸). 가장자리 줄에서는 길이 이 두 칸으로 좁혀진다. */
  readonly exits: readonly Cell[];
  readonly clearings?: readonly Blob[];
  /** 빈터 안에 남기는 나무 섬. */
  readonly groves?: readonly Blob[];
  /** 굽은 개울. straight 는 다리 자리처럼 정확한 물 사각형(곡선 위에 덮는다). */
  readonly stream?: { readonly pts: readonly Cell[]; readonly w: readonly [number, number]; readonly straight?: { x: number; y: number; w: number; h: number } };
  /** 다리(돌다리 5×4 키트 원점) — 바닥 두 줄(y+1·y+2)이 길로 이어진다. */
  readonly bridge?: Cell;
  /** 길섶·빈터 덤불 밀도 배수(기본 1) — 가시덤불 샛길은 덤불이 빽빽하다. */
  readonly undergrowth?: number;
  /** 나무 사이 틈 — 길 칸 from 에서 to 까지 한 칸 폭 샛길, to 에 2×2 주머니. */
  readonly nooks?: readonly { from: Cell; to: Cell }[];
  /** 숲 모양 시안(forest-trunks-1, 2026-10-24). 실제 숲 맵 정의에는 없다 — 비교 그림 전용. */
  readonly look?: WoodLook;
}

/**
 * 「나무 줄기가 안 보여 풀 덩이 같다」(2026-10-24) 시안 손잡이. 모두 원본 버들항 그림(나무 키트·beodeul_nature 그림자·이끼 치마·고사리 소품)만 쓴다.
 *  forest: 밑동 고르기 규칙(앞줄 모양·속 바둑판·간격) · castShadows: 나무마다 원본 낙하 그림자(2층) · plainGround: 트인 땅을 밝은 잔디로
 *  loose: 숲 가장자리 밖 풀밭에 낱 나무(밑동+그림자) · skirt: 숲 남쪽 끝 아래 이끼 치마 + 줄기 선 고사리.
 */
export interface WoodLook {
  readonly forest?: BeodeulForestLook;
  readonly castShadows?: "all" | "outside";
  readonly plainGround?: boolean;
  readonly loose?: { readonly every: number; readonly reach: number };
  readonly skirt?: boolean;
}

export interface WoodResult {
  readonly map: GameMap;
  readonly path: Set<number>;
  readonly open: Set<number>;
  readonly forest: Set<number>;
  readonly water: Set<number>;
  readonly pockets: Cell[];
}

function tool(project: Project, name: string, args: Record<string, unknown>): void {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`[fallen-woodland] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? []).slice(0, 400)}`);
  Object.assign(project, ctx.project);
}

/** Catmull-Rom 표본(끝점 반복). */
function spline(pts: readonly Cell[], step = 0.2): Array<Cell & { t: number }> {
  const out: Array<Cell & { t: number }> = [];
  const P = [pts[0]!, ...pts, pts[pts.length - 1]!];
  for (let i = 1; i + 2 < P.length; i += 1) {
    const p0 = P[i - 1]!, p1 = P[i]!, p2 = P[i + 1]!, p3 = P[i + 2]!;
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const n = Math.max(2, Math.ceil(len / step));
    for (let k = 0; k < n; k += 1) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), t: (i - 1 + t) / (pts.length - 1) });
    }
  }
  const last = pts[pts.length - 1]!;
  out.push({ x: last.x, y: last.y, t: 1 });
  return out;
}

/** 칸 중심이 곡선에서 반폭 안이면 칸에 든다. 반폭은 진행에 따라 [lo,hi] 사이를 물결친다. */
function carveCurve(W: number, H: number, pts: readonly Cell[], w: readonly [number, number], seed: number, out: Set<number>): void {
  const [lo, hi] = w;
  const ph = (seed % 97) / 15;
  for (const s of spline(pts)) {
    const wave = 0.5 + 0.5 * Math.sin(s.t * 9.1 + ph) * Math.cos(s.t * 3.7 + ph * 0.5);
    const r = (lo + (hi - lo) * wave) / 2;
    for (let y = Math.floor(s.y - r - 1); y <= Math.ceil(s.y + r + 1); y += 1) for (let x = Math.floor(s.x - r - 1); x <= Math.ceil(s.x + r + 1); x += 1) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      // 칸 (x,y) 중심 = (x+0.5, y+0.5). 곡선 점은 「칸 왼쪽 위 + 0.5」 기준이 되게 점 좌표에 0.5 를 더해 비교한다.
      if (Math.hypot(x + 0.5 - (s.x + 0.5), y + 0.5 - (s.y + 0.5)) <= r + 0.05) out.add(y * W + x);
    }
  }
}

const noise2 = (x: number, y: number, seed: number): number => {
  const a = (seed % 61) / 9;
  return Math.sin(x * 0.83 + y * 0.37 + a) * 0.55 + Math.sin(x * 0.29 - y * 0.71 + a * 1.7) * 0.75 + Math.sin((x + y) * 1.63 + a * 0.3) * 0.3;
};

function inBlob(b: Blob, x: number, y: number, seed: number): boolean {
  const ex = (x - b.cx) / b.rx, ey = (y - b.cy) / b.ry;
  const ang = Math.atan2(ey, ex);
  const lim = 1 + 0.16 * Math.sin(ang * 3 + seed) + 0.1 * Math.sin(ang * 5 + seed * 2.3);
  return ex * ex + ey * ey <= lim * lim;
}

export function paintWoodland(project: Project, spec: WoodSpec): WoodResult {
  const { width: W, height: H, seed } = spec;
  tool(project, "create_map", { id: spec.id, name: spec.name, width: W, height: H, themeScene: "beodeul_field", seed });
  const base = project.maps[spec.id]!;
  base.lowerTiles = Array.from({ length: W * H }, () => BEODEUL_PLAIN_GRASS);
  base.upperTiles = Array.from({ length: W * H }, () => -1);
  delete base.lowerTileStacks;
  delete base.upperTileStacks;
  if (base.lowerOverlayTiles) base.lowerOverlayTiles = Array.from({ length: W * H }, () => -1);
  if (base.upperOverlayTiles) base.upperOverlayTiles = Array.from({ length: W * H }, () => -1);
  if (base.shadowBits) base.shadowBits = Array.from({ length: W * H }, () => 0);
  base.mapRole ??= "field";
  base.events = base.events.filter((e) => !/^ev_gate|transfer/i.test(e.id));
  return paintWoodlandOnto(project, base, spec, () => true);
}

/** 이미 있는 맵(깊은 숲)에도 쓴다 — editable(x,y) 가 거짓인 칸은 바닥·나무를 건드리지 않는다(추락지처럼 지킬 곳). */
export function paintWoodlandOnto(project: Project, map0: GameMap, spec: WoodSpec, editable: (x: number, y: number) => boolean,
  keepForest: ReadonlySet<number> = new Set()): WoodResult {
  const { width: W, height: H, seed } = spec;
  const idx = (x: number, y: number) => y * W + x;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const rng = mulberry32(seed ^ 0x77a1);

  // ── 마스크 ────────────────────────────────────────────────────────────
  const path = new Set<number>();
  spec.paths.forEach((p, k) => carveCurve(W, H, p.pts, p.w ?? [2, 3.2], seed + k * 13, path));
  // 출구: 가장자리 줄은 문 두 칸만, 그 안쪽 두 줄은 문 둘레 네 칸 안으로 좁힌다(문 옆이 길처럼 열려 막다른 칸이 생기지 않게).
  for (const e of spec.exits) {
    const horizontal = e.y === 0 || e.y === H - 1;
    for (let d = 0; d < 3; d += 1) {
      for (let k = -6; k <= 7; k += 1) {
        const x = horizontal ? e.x + k : e.x === 0 ? d : W - 1 - d;
        const y = horizontal ? (e.y === 0 ? d : H - 1 - d) : e.y + k;
        if (!inMap(x, y)) continue;
        const keep = d === 0 ? k === 0 || k === 1 : k >= -1 && k <= 2;
        if (keep) path.add(idx(x, y));
        else if (d === 0) path.delete(idx(x, y));
      }
    }
  }
  const water = new Set<number>();
  if (spec.stream) {
    carveCurve(W, H, spec.stream.pts, spec.stream.w, seed + 101, water);
    const s = spec.stream.straight;
    if (s) {
      for (let y = s.y; y < s.y + s.h; y += 1) {
        for (let x = s.x - 3; x < s.x + s.w + 3; x += 1) if (inMap(x, y)) water.delete(idx(x, y));
        for (let x = s.x; x < s.x + s.w; x += 1) if (inMap(x, y)) water.add(idx(x, y));
      }
    }
  }
  const deck = new Set<number>();
  if (spec.bridge) for (let dy = 1; dy <= 2; dy += 1) for (let dx = 0; dx < 5; dx += 1) deck.add(idx(spec.bridge.x + dx, spec.bridge.y + dy));
  for (const c of water) path.delete(c);
  for (const c of deck) path.add(c);

  const nookCells = new Set<number>();
  const pockets: Cell[] = [];
  for (const n of spec.nooks ?? []) {
    const steps = Math.max(Math.abs(n.to.x - n.from.x), Math.abs(n.to.y - n.from.y));
    for (let k = 0; k <= steps; k += 1) {
      const x = Math.round(n.from.x + ((n.to.x - n.from.x) * k) / Math.max(1, steps)), y = Math.round(n.from.y + ((n.to.y - n.from.y) * k) / Math.max(1, steps));
      if (inMap(x, y)) nookCells.add(idx(x, y));
    }
    for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) if (inMap(n.to.x + dx, n.to.y + dy)) nookCells.add(idx(n.to.x + dx, n.to.y + dy));
    pockets.push(n.to);
  }

  const open = new Set<number>([...path, ...water, ...nookCells]);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const c = idx(x, y);
    if (open.has(c)) continue;
    // 길섶: 길에서 1~2.6칸(잡음) — 숲 덩이 가장자리가 곧은 벽이 아니라 들쭉날쭉 물러난다.
    const reach = 0.8 + Math.max(0, 0.3 + 0.85 * noise2(x, y, seed));
    let near = false;
    for (let dy = -3; dy <= 3 && !near; dy += 1) for (let dx = -3; dx <= 3; dx += 1) {
      if (!inMap(x + dx, y + dy) || Math.hypot(dx, dy) > reach) continue;
      const n = idx(x + dx, y + dy);
      if (path.has(n) && !nookCells.has(n)) { near = true; break; }
      if (water.has(n) && Math.hypot(dx, dy) <= 1.5) { near = true; break; }
    }
    if (near) open.add(c);
    else if ((spec.clearings ?? []).some((b) => inBlob(b, x, y, seed))) open.add(c);
  }
  for (const b of spec.groves ?? []) for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const c = idx(x, y);
    if (inBlob(b, x, y, seed + 7) && !path.has(c) && !water.has(c) && !nookCells.has(c)) open.delete(c);
  }
  // 출구 둘레 두 칸은 늘 트여 있다.
  for (const e of spec.exits) for (let dy = -2; dy <= 3; dy += 1) for (let dx = -2; dx <= 3; dx += 1) if (inMap(e.x + dx, e.y + dy) && path.has(idx(e.x + dx, e.y + dy))) open.add(idx(e.x + dx, e.y + dy));
  // 맵 가장자리 줄은 문 두 칸(과 물)만 트인다 — 문 옆 길섶이 열려 있으면 걸어 나가지도 못하는 가장자리 칸이 생긴다.
  const doorCells = new Set<number>();
  for (const e of spec.exits) { doorCells.add(idx(e.x, e.y)); doorCells.add(e.y === 0 || e.y === H - 1 ? idx(e.x + 1, e.y) : idx(e.x, e.y + 1)); }
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (x !== 0 && y !== 0 && x !== W - 1 && y !== H - 1) continue;
    const c = idx(x, y);
    if (!doorCells.has(c) && !water.has(c)) { open.delete(c); path.delete(c); }
  }
  const forest = new Set<number>(keepForest);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (editable(x, y) && !open.has(idx(x, y))) forest.add(idx(x, y));

  // ── 칠하기 ────────────────────────────────────────────────────────────
  let map = project.maps[map0.id]!;
  const tileset = project.tilesets[map.tilesetId]!;
  const canal = (tileset.autotileGroups ?? []).find((a) => a.id === "beodeul_canal_lake_47");
  const full = canal?.variantMap?.["255"];
  for (const c of water) if (editable(c % W, Math.floor(c / W)) && full !== undefined) map.lowerTiles[c] = full;
  // 모랫길 — 줄마다 이어진 칸을 사각형 하나로.
  const fillRegion = CONSTRUCTION_TOOLS_V3.find((t) => t.name === "fill_region")!;
  const sand = [...path].filter((c) => !deck.has(c) && editable(c % W, Math.floor(c / W))).sort((a, b) => a - b);
  for (let i = 0; i < sand.length;) {
    const start = sand[i]!, y = Math.floor(start / W);
    let end = start;
    while (i + 1 < sand.length && sand[i + 1] === end + 1 && Math.floor(sand[i + 1]! / W) === y) { i += 1; end = sand[i]!; }
    i += 1;
    // 도구 실행기(초안·검사)를 거치지 않고 정의를 바로 부른다 — 줄마다 실행기를 돌면 맵 한 장에 40초가 걸렸다(wildRouteBeodeul 과 같은 방식).
    fillRegion.run(project, { mapId: map.id, rect: { x: start % W, y, w: end - start + 1, h: 1 }, material: "버들항 모랫길", _exactCells: true });
  }
  if (spec.bridge) tool(project, "stamp_object", { objectId: "kit:beodeul_city/bd-pick-mountain-pass-stone-bridge", mapId: map.id, x: spec.bridge.x, y: spec.bridge.y });
  map = project.maps[map0.id]!;
  // 자연 풀 둑(2층) — 이웃 8칸이 물·다리면 비트.
  if (water.size) {
    const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
    const wetLike = (x: number, y: number) => !inMap(x, y) || water.has(idx(x, y)) || deck.has(idx(x, y));
    const want = new Map<number, number>();
    for (const c of water) {
      if (deck.has(c)) continue;
      const x = c % W, y = (c - x) / W;
      let m = 0;
      N8.forEach(([dx, dy], b) => { if (wetLike(x + dx, y + dy)) m |= 1 << b; });
      const t = BEODEUL_NATURE.bankGrass[m];
      if (t !== undefined && t >= 0) want.set(c, t);
    }
    if (want.size) {
      const tr = translateTiles(beodeulNatureTileset(project), tileset, new Set(want.values()));
      for (const to of tr.map.values()) { tileset.priority[to] = "upper"; tileset.passability[to] = { up: true, down: true, left: true, right: true }; }
      for (const [c, t] of want) setLayerTileAt(map, 2, c, tr.map.get(t)!);
    }
  }
  // 나무 — B1 활엽 composer. 숲 칸 안에만 서고 쓴다(길·빈터·물에 수관이 넘치지 않는다).
  const isF = (x: number, y: number) => inMap(x, y) && forest.has(idx(x, y));
  const look = spec.look ?? {};
  let plan: BeodeulForestPlan | null = null;
  const def = composeBeodeulForest(project, map, tileset, "broadleaf", isF, isF, seed, isF, "woodland", look.forest ?? {}, (p) => { plan = p; });
  map = project.maps[map0.id]!;
  const placements: TreePlacement[] = [...((plan as BeodeulForestPlan | null)?.placements ?? [])];
  if (look.loose) placements.push(...plantLooseTrees(map, def.sprites, spec, { path, water, nookCells, forest, open }, look.loose, editable));
  const woodland = beodeulWoodlandGrass(project, tileset);
  if (woodland >= 0 && !look.plainGround) for (let i = 0; i < map.lowerTiles.length; i += 1) if (map.lowerTiles[i] === BEODEUL_PLAIN_GRASS && editable(i % W, Math.floor(i / W))) map.lowerTiles[i] = woodland;

  if (look.castShadows) castTreeShadows(project, map, tileset, placements, look.castShadows === "outside" ? (c) => !forest.has(c) : () => true, water);
  if (look.skirt) mossSkirt(project, map, tileset, forest, (c) => !path.has(c) && !water.has(c) && editable(c % W, Math.floor(c / W)));
  // 길섶·빈터 덤불 — 길 곁 풀밭에 드문드문, 빈터엔 덩이로. 걷는 칸을 막지 않는 1×1 깊은 숲길 소품만.
  // 1×1 키트라 키트 칸 번호를 3층에 바로 쓴다(같은 칩셋 — 도장 도구를 칸마다 부르면 맵 한 장에 수십 초가 걸렸다). 걸을 수 있는 그림만.
  const decor = (tileset.structureKits ?? [])
    .filter((k) => k.width === 1 && k.height === 1 && /^bd-pick-deep-forest-path-(fern|heath|wild|stones|toadstools)-/.test(k.id))
    .map((k) => k.rows[0]?.upperTiles?.[0] ?? -1)
    .filter((t) => t >= 0 && (() => { const ps = tileset.passability[t]; return !ps || ps.up || ps.down || ps.left || ps.right; })());
  const grass = (c: number) => !path.has(c) && !water.has(c) && !forest.has(c) && !nookCells.has(c) && editable(c % W, Math.floor(c / W));
  const eventNear = new Set<number>();
  for (const e of map.events) for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (Math.abs(dx) + Math.abs(dy) <= 1 && inMap(e.x + dx, e.y + dy)) eventNear.add(idx(e.x + dx, e.y + dy));
  if (decor.length) for (const c of [...open].sort((a, b) => a - b)) {
    if (!grass(c) || eventNear.has(c)) continue;
    const x = c % W, y = (c - x) / W;
    if (layerTileAt(map, 3, c) >= 0 || layerTileAt(map, 2, c) >= 0 || layerTileAt(map, 4, c) >= 0) continue;
    const nextToPath = [c - 1, c + 1, c - W, c + W].some((n) => path.has(n));
    const trunkLine = look.skirt && forest.has(c - W) && !nextToPath;
    const p = trunkLine ? 0.45 : (nextToPath ? 0.05 : 0.09 + 0.06 * noise2(x * 1.7, y * 1.3, seed + 3)) * (spec.undergrowth ?? 1);
    if (rng() > p) continue;
    setLayerTileAt(map, 3, c, decor[Math.floor(rng() * decor.length)]!);
  }
  map = project.maps[map0.id]!;
  void isPassable;
  return { map, path, open, forest, water, pockets };
}

/** 원본 나무 키트 낙하 그림자(beodeul_nature shadows, 마을 시공기와 같은 표)를 키트 원점 기준으로 2층 빈 칸에 얹는다. */
function castTreeShadows(project: Project, map: GameMap, tileset: Project["tilesets"][string], placements: readonly TreePlacement[],
  ok: (c: number) => boolean, water: ReadonlySet<number>): void {
  const W = map.width, H = map.height;
  const want = new Map<number, number>();
  for (const p of [...placements].sort((a, b) => a.z - b.z)) {
    const sh = BEODEUL_NATURE.shadows[p.sprite.name];
    if (!sh) continue;
    // 그림자 칸이 반 넘게 숲·물에 막히면 통째로 건너뛴다 — 조각만 남으면 풀밭 위 회색 막대로 읽혔다(시안 r1).
    const cells: [number, number][] = [];
    let total = 0;
    sh.rows.forEach((row, j) => row.forEach((t, i) => {
      if (t < 0) return;
      total++;
      const x = p.x0 + sh.dx + i, y = p.y0 + sh.dy + j;
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const c = y * W + x;
      if (!ok(c) || water.has(c) || want.has(c)) return;
      cells.push([c, t]);
    }));
    if (cells.length * 10 < total * 6) continue;
    for (const [c, t] of cells) want.set(c, t);
  }
  if (!want.size) return;
  const tr = translateTiles(beodeulNatureTileset(project), tileset, new Set(want.values()));
  for (const to of tr.map.values()) { tileset.priority[to] = "lower"; tileset.passability[to] = { up: true, down: true, left: true, right: true }; }
  for (const [c, t] of want) if (layerTileAt(map, 2, c) < 0) setLayerTileAt(map, 2, c, tr.map.get(t)!);
}

/** 숲 남쪽 끝 바로 아래 칸에 원본 숲 그늘(이끼 치마) — planBeodeulCanopy 와 같은 칸 고르기. */
function mossSkirt(project: Project, map: GameMap, tileset: Project["tilesets"][string], forest: ReadonlySet<number>, ok: (c: number) => boolean): void {
  const W = map.width, H = map.height, P = BEODEUL_NATURE.forestPeriod.leaf, shades = BEODEUL_NATURE.forestShade.leaf;
  const want = new Map<number, number>();
  for (const c of forest) {
    const x = c % W, y = (c - x) / W, s = c + W;
    if (y + 1 >= H || forest.has(s) || !ok(s)) continue;
    const nw = x > 0 && forest.has(c - 1), ne = x + 1 < W && forest.has(c + 1);
    const t = shades[(x % P) * 4 + (nw ? 2 : 0) + (ne ? 1 : 0)];
    if (t !== undefined && t >= 0) want.set(s, t);
  }
  if (!want.size) return;
  const tr = translateTiles(beodeulNatureTileset(project), tileset, new Set(want.values()));
  for (const to of tr.map.values()) { tileset.priority[to] = "lower"; tileset.passability[to] = { up: true, down: true, left: true, right: true }; }
  for (const [c, t] of want) if (layerTileAt(map, 2, c) < 0) setLayerTileAt(map, 2, c, tr.map.get(t)!);
}

/**
 * 숲 가장자리 밖 풀밭에 낱 나무(T3·T4 원본 키트, 밑동이 보이는 온 나무). 그림 칸 전부가 트인 풀밭이고 길·물·틈·출구에서 한 칸 이상 떨어진 자리만,
 * 숲에서 reach 칸 안. every = 후보 칸 중 몇 칸에 하나 꼴. 막는 칸은 나무 그림 칸(원본 키트 통행표 그대로).
 */
function plantLooseTrees(map: GameMap, sprites: readonly import("@/project/types").TreeComposerSprite[], spec: WoodSpec,
  m: { path: Set<number>; water: Set<number>; nookCells: Set<number>; forest: Set<number>; open: Set<number> },
  opt: { every: number; reach: number }, editable: (x: number, y: number) => boolean): TreePlacement[] {
  const W = map.width, H = map.height;
  const pool = sprites.filter((sp) => !sp.dark && (sp.shape === "T3" || sp.shape === "T4"));
  const busy = new Set<number>();
  const near = (x: number, y: number, set: ReadonlySet<number>, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && set.has(ny * W + nx)) return true; }
    return false;
  };
  const guard = new Set<number>([...m.path, ...m.water, ...m.nookCells]);
  for (const e of spec.exits) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 4; dx++) { const x = e.x + dx, y = e.y + dy; if (x >= 0 && y >= 0 && x < W && y < H) guard.add(y * W + x); }
  for (const e of map.events) guard.add(e.y * W + e.x);
  const out: TreePlacement[] = [];
  const cand: number[] = [];
  for (let c = 0; c < W * H; c++) if (m.open.has(c) && !guard.has(c)) cand.push(c);
  cand.sort((a, b) => ((a * 2654435761) >>> 0) % 1009 - ((b * 2654435761) >>> 0) % 1009);
  let k = 0;
  for (const c of cand) {
    const ax = c % W, ay = (c - ax) / W;
    if (!near(ax, ay, m.forest, opt.reach)) continue;
    if ((k++ % opt.every) !== 0) continue;
    const sp = pool[(ax * 7 + ay * 13) % pool.length]!;
    const tc = sp.shape === "T4" ? 1 : 1;
    const x0 = ax - tc, y0 = ay - sp.h + 1;
    let ok = x0 >= 1 && y0 >= 0 && x0 + sp.w < W && ay + 1 < H;
    for (let j = -1; ok && j <= sp.h; j++) for (let i = -1; i <= sp.w; i++) {
      const x = x0 + i, y = y0 + j;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const cc = y * W + x;
      const inside = i >= 0 && j >= 0 && i < sp.w && j < sp.h;
      if (inside && (!m.open.has(cc) || guard.has(cc) || busy.has(cc) || !editable(x, y))) { ok = false; break; }
      if (!inside && (m.path.has(cc) || busy.has(cc))) { ok = false; break; }
    }
    if (!ok) continue;
    for (let j = 0; j < sp.h; j++) for (let i = 0; i < sp.w; i++) busy.add((y0 + j) * W + x0 + i);
    out.push({ sprite: sp, x0, y0, z: ay * 4096 + 2048 });
  }
  if (!out.length) return out;
  const cells = new Set<number>(busy);
  const isL = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && cells.has(y * W + x);
  composeTreesPlaced(map, { kind: "trees", layers: [4, 3, 2], sprites: pool, trunkCols: {} } as never, out, new Uint8Array(W * H), isL, isL, isL);
  return out;
}
