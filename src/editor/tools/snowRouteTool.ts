// editor/tools/snowRouteTool.ts
// 「추락지 공터 북쪽으로 눈보라 치는 고갯길 두 장 이어 줘. 길 중간에 얼음 틈 두 군데.」 — 설원 길 맵을 1~3장 짓고
// 시작 맵의 한쪽 가장자리 ↔ 눈길1 ↔ 눈길2 … 를 왕복 출입구로 잇는다(author_forest_route 와 같은 좌표·연결 규칙).
//
// 그림은 전부 기존 버들항 원본(새 그림 없음):
// - 바닥 = 설원 마을 키트 눈 바닥(bd-pick-snowfield-ground-snow) 칸을 해시로 섞는다(키트 무늬 그대로 깔면 3칸 주기가 격자로 드러난다).
// - 길 = 밟힌 다진 눈(던전 얼음굴 바닥 오토타일 beodeul_dungeon_ice_ground, 테두리가 부드럽다 — 없으면 bd-pick-snowfield-ground-road 키트). Catmull-Rom 곡선, 폭이 굽이마다 2~3.4칸으로 숨 쉰다.
// - 길 양옆 벽 = 눈 덮인 침엽 수관 오토타일(beodeul_nature forestCanopy.snow — 설원 마을 숲과 같은 그림).
// - 빙판 = 던전 얼음 바닥 오토타일(beodeul_dungeon_ice, 둥근 가장자리), 없으면 설원 얼음 키트.
// - 눈더미 = bd-pick-snowfield-mound(1×1 막힘)·rock, 낱 눈 소나무 = bd-pick-snowfield-pine.
// 얼음 틈 자리(gap): 길이 진행 축으로 곧게 지나는 곳을 고르고 길 양옆을 숲으로 좁혀(pinch) 틈 띠가 길 폭 전체를 가로지르게 한다.
// 틈은 칠하지 않는다(길이 막히면 건널 수단이 없다) — data.maps[i].gaps 로 띠 칸·양쪽 착지 칸을 돌려주고, 장대 도약 같은 장애물 도구가 그 자리에 놓는다.
// seals = 띠 칸을 막으면 입구→출구가 실제로 끊기는가(통행 격자 BFS 로 확인).
import { autotileVariantForMask } from "@/project/defaults/autotileEngine";
import { canMove } from "@/project/collision";
import type { AutotileGroup, GameMap, Project, TilesetDef } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { layerTileAt } from "@/project/mapLayers";
import { planBeodeulCanopy, shapeBeodeulCanopyMask, writeBeodeulCanopy } from "./beodeulForest";
import { ACROSS, ALONG, call, centerBlob, dims, exitCell, link, originEdge, toMap, type Side } from "./forestRouteTool";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type Cell = { x: number; y: number };
type Mood = "clear" | "snow" | "blizzard" | "dusk";
const BEODEUL_TILESET_ID = "beodeul_city";
const KIT = (id: string) => `bd-pick-snowfield-${id}`;

export interface SnowGap {
  /** 틈 띠 칸(길 폭 전체를 가로지른다). 장애물 도구가 이 칸을 막고 그림을 얹는다. */
  readonly cells: Cell[];
  /** 띠 바로 앞·뒤 길 칸(입구 쪽 from, 출구 쪽 to) — 도약 시작·착지 자리. */
  readonly from: Cell;
  readonly to: Cell;
  /** 틈 폭(진행 방향 칸 수). */
  readonly width: number;
  readonly axis: "vertical" | "horizontal";
  /** 띠를 막으면 입구→출구(또는 막다른 빈터)가 실제로 끊기는가. */
  readonly seals: boolean;
}

/** Catmull-Rom 표본(끝점 반복). t = 0..1 진행. */
function spline(pts: readonly Cell[], step = 0.2): Array<Cell & { t: number }> {
  const out: Array<Cell & { t: number }> = [];
  const P = [pts[0]!, ...pts, pts[pts.length - 1]!];
  for (let i = 1; i + 2 < P.length; i += 1) {
    const p0 = P[i - 1]!, p1 = P[i]!, p2 = P[i + 1]!, p3 = P[i + 2]!;
    const n = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step));
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

const hash01 = (x: number, y: number, s: number): number => {
  let h = Math.imul(x * 73856093 ^ y * 19349663 ^ s * 83492791, 0x27d4eb2d);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};
const noise2 = (x: number, y: number, seed: number): number => {
  const a = (seed % 61) / 9;
  return Math.sin(x * 0.83 + y * 0.37 + a) * 0.55 + Math.sin(x * 0.29 - y * 0.71 + a * 1.7) * 0.75 + Math.sin((x + y) * 1.63 + a * 0.3) * 0.3;
};
type Blob = { cx: number; cy: number; rx: number; ry: number };
function inBlob(b: Blob, x: number, y: number, seed: number): boolean {
  const ex = (x - b.cx) / b.rx, ey = (y - b.cy) / b.ry;
  const ang = Math.atan2(ey, ex);
  const lim = 1 + 0.16 * Math.sin(ang * 3 + seed) + 0.1 * Math.sin(ang * 5 + seed * 2.3);
  return ex * ex + ey * ey <= lim * lim;
}

/** 키트 칸 무늬(바닥 키트 rows[].tiles) — 해시로 섞어 고른다. */
function kitCells(tileset: TilesetDef, id: string): number[] {
  const kit = (tileset.structureKits ?? []).find((k) => k.id === id);
  return (kit?.rows ?? []).flatMap((r) => r.tiles ?? []).filter((t) => t >= 0);
}

/** 던전 얼음 바닥 오토타일 칸(compose.ts autoCell 과 같은 비트: N1 E2 S4 W8 NE16 SE32 SW64 NW128). */
function iceCell(g: AutotileGroup, m: number, x: number, y: number): number {
  if (g.phaseVariants) { const v = autotileVariantForMask(g, m, x, y); if (v !== undefined) return v; }
  const iv = g.interiorVariants?.[0];
  if (m === 255 && iv?.length) return iv[Math.floor(hash01(x, y, 5) * iv.length)]!;
  return g.variantMap[String(m)] ?? g.variantMap["255"]!;
}

interface SnowPlan {
  id: string; name: string; width: number; height: number; seed: number;
  pts: Cell[]; exits: Cell[]; clearings: Blob[]; groves: Blob[];
  entry: Cell; exit: Cell | null; endClearing: Cell; gapAt: number[];
}

function planSnow(id: string, name: string, side: Side, seed: number, last: boolean, openEnd: boolean, entryU: number, gapCount: number): SnowPlan {
  const rnd = mulberry32(seed);
  const across = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  const exitU = Math.round(across(7, 24)) + 0.5;
  const deadEnd = last && !openEnd;
  const endV = deadEnd ? across(6, 9) : 0;
  const n = 4;
  const raw: Cell[] = [{ x: entryU, y: ALONG - 1 }];
  for (let i = 1; i <= n; i += 1) {
    const v = ALONG - 1 - ((ALONG - 1 - endV) * i) / (n + 1);
    // 고갯길: 굽이를 숲길보다 조금 크게(4~9칸) — 지그재그로 오르는 길.
    const swing = (i % 2 === 0 ? 1 : -1) * across(4, 9);
    raw.push({ x: Math.max(5, Math.min(ACROSS - 6, (entryU + exitU) / 2 + swing)), y: v });
  }
  raw.push({ x: deadEnd ? across(10, 22) : exitU, y: endV });
  const pts = raw.map((p) => toMap(side, p.x, p.y));
  const mid = raw[2]!;
  const clearings: Blob[] = [
    centerBlob(side, mid.x, mid.y, across(3.4, 4.8), across(2.6, 3.4)),
    centerBlob(side, entryU, ALONG - 4, across(3.5, 5), 2.8),
    ...(deadEnd ? [centerBlob(side, raw[raw.length - 1]!.x, endV + 1, 5.5, 4)] : []),
  ];
  // 빈터 안 낱 눈 소나무 섬(작은 덩이).
  const groves: Blob[] = [centerBlob(side, Math.max(6, Math.min(ACROSS - 7, mid.x + (rnd() < 0.5 ? -3 : 3))), mid.y, 1.4, 1.2)];
  const entry = exitCell(side, entryU, ALONG - 1);
  const exit = deadEnd ? null : exitCell(side, exitU, 0);
  // 틈 자리: 진행의 30~75% 사이에 고르게(빈터 한가운데·출구 둘레는 피한다 — 빈터 v 는 raw[2]).
  const gapAt = Array.from({ length: gapCount }, (_, k) => 0.3 + (0.45 * (k + 0.5)) / Math.max(1, gapCount));
  const { width, height } = dims(side);
  return { id, name, width, height, seed, pts, exits: exit ? [entry, exit] : [entry], clearings, groves, entry, exit,
    endClearing: deadEnd ? toMap(side, Math.round(raw[raw.length - 1]!.x), Math.round(endV + 1)) : toMap(side, Math.round(mid.x), Math.round(mid.y)), gapAt };
}

interface GapDraft { cells: number[]; from: number; to: number; width: number; axis: "vertical" | "horizontal"; zone: number[] }

/** 길 마스크를 깎고 틈 자리마다 길 양옆을 좁힌다. open = 걷는 칸(길·길섶·빈터), path = 눈길 칸. */
function carve(plan: SnowPlan, gapWidth: number, warnings: string[]): { path: Set<number>; open: Set<number>; gaps: GapDraft[] } {
  const { width: W, height: H, seed } = plan;
  const idx = (x: number, y: number) => y * W + x;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const samples = spline(plan.pts);
  const path = new Set<number>();
  const ph = (seed % 97) / 15;
  for (const s of samples) {
    const wave = 0.5 + 0.5 * Math.sin(s.t * 9.1 + ph) * Math.cos(s.t * 3.7 + ph * 0.5);
    const r = (2 + 1.4 * wave) / 2;
    for (let y = Math.floor(s.y - r - 1); y <= Math.ceil(s.y + r + 1); y += 1) for (let x = Math.floor(s.x - r - 1); x <= Math.ceil(s.x + r + 1); x += 1) {
      if (inMap(x, y) && Math.hypot(x - s.x, y - s.y) <= r + 0.05) path.add(idx(x, y));
    }
  }
  // 출구: 가장자리 줄은 문 두 칸만, 안쪽 두 줄은 문 둘레 네 칸.
  for (const e of plan.exits) {
    const horizontal = e.y === 0 || e.y === H - 1;
    for (let d = 0; d < 3; d += 1) for (let k = -6; k <= 7; k += 1) {
      const x = horizontal ? e.x + k : e.x === 0 ? d : W - 1 - d;
      const y = horizontal ? (e.y === 0 ? d : H - 1 - d) : e.y + k;
      if (!inMap(x, y)) continue;
      const keep = d === 0 ? k === 0 || k === 1 : k >= -1 && k <= 2;
      if (keep) path.add(idx(x, y)); else if (d === 0) path.delete(idx(x, y));
    }
  }
  const open = new Set<number>(path);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const c = idx(x, y);
    if (open.has(c)) continue;
    const reach = 0.8 + Math.max(0, 0.3 + 0.85 * noise2(x, y, seed));
    let near = false;
    for (let dy = -3; dy <= 3 && !near; dy += 1) for (let dx = -3; dx <= 3; dx += 1) {
      if (inMap(x + dx, y + dy) && Math.hypot(dx, dy) <= reach && path.has(idx(x + dx, y + dy))) { near = true; break; }
    }
    if (near || plan.clearings.some((b) => inBlob(b, x, y, seed))) open.add(c);
  }
  for (const b of plan.groves) for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (inBlob(b, x, y, seed + 7) && !path.has(idx(x, y))) open.delete(idx(x, y));
  }

  // 틈 자리: 진행 축으로 가장 곧은 표본 → 띠(길 폭 전체) + 앞뒤 길 칸. 띠 둘레 진행 ±3줄은 길 칸만 남기고 숲으로 좁힌다.
  const gaps: GapDraft[] = [];
  const taken: number[] = [];
  for (const f of plan.gapAt) {
    let best = -1, bestScore = -Infinity;
    for (let i = 3; i < samples.length - 3; i += 1) {
      const s = samples[i]!;
      if (Math.abs(s.t - f) > 0.08) continue;
      const a = samples[i - 3]!, b = samples[i + 3]!;
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const straight = Math.max(Math.abs(dx), Math.abs(dy)) / len;
      if (taken.some((t) => Math.abs(t - s.t) < 0.12)) continue;
      const score = straight - Math.abs(s.t - f);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best < 0) { warnings.push(`${plan.name}: 얼음 틈 자리를 찾지 못했다(진행 ${Math.round(f * 100)}%).`); continue; }
    const s = samples[best]!, a = samples[best - 3]!, b = samples[best + 3]!;
    const vertical = Math.abs(b.y - a.y) >= Math.abs(b.x - a.x);
    const forward = vertical ? Math.sign(b.y - a.y) || 1 : Math.sign(b.x - a.x) || 1;
    const cx = Math.round(s.x), cy = Math.round(s.y);
    // 진행 좌표 p, 가로 좌표 q.
    const at = (p: number, q: number): Cell => vertical ? { x: q, y: p } : { x: p, y: q };
    const p0 = vertical ? cy : cx, q0 = vertical ? cx : cy;
    const pathRun = (p: number): number[] => {
      // 그 줄에서 q0 둘레로 이어진 길 칸.
      const out: number[] = [];
      let start = q0;
      const isPath = (q: number) => { const c = at(p, q); return inMap(c.x, c.y) && path.has(idx(c.x, c.y)); };
      if (!isPath(start)) { for (let d = 1; d <= 3; d += 1) { if (isPath(q0 - d)) { start = q0 - d; break; } if (isPath(q0 + d)) { start = q0 + d; break; } } }
      if (!isPath(start)) return out;
      let lo = start, hi = start;
      while (isPath(lo - 1)) lo -= 1;
      while (isPath(hi + 1)) hi += 1;
      for (let q = lo; q <= hi; q += 1) { const c = at(p, q); out.push(idx(c.x, c.y)); }
      return out;
    };
    const bandRows = Array.from({ length: gapWidth }, (_, k) => p0 + k * forward);
    const band = bandRows.flatMap(pathRun);
    const before = pathRun(p0 - forward), after = pathRun(p0 + gapWidth * forward);
    if (!band.length || !before.length || !after.length) { warnings.push(`${plan.name}: 얼음 틈 자리 길이 끊겨 건너뛰었다.`); continue; }
    // 착지 칸 = 앞뒤 줄에서 띠 가운데와 같은 가로 줄에 가장 가까운 길 칸 — 도약이 곧게(대각선 없이) 떨어지게.
    const qOf = (c: number) => (vertical ? c % W : Math.floor(c / W));
    const bandMid = band.reduce((n, c) => n + qOf(c), 0) / band.length;
    const mid = (run: number[]) => [...run].sort((x, y) => Math.abs(qOf(x) - bandMid) - Math.abs(qOf(y) - bandMid))[0]!;
    // 좁히기: 진행 -3..gapWidth+2 줄의 길 아닌 칸(가로 ±9)을 숲으로.
    const zone: number[] = [];
    for (let p = p0 - 3 * forward, k = 0; k < gapWidth + 6; k += 1, p += forward) {
      for (let q = q0 - 9; q <= q0 + 9; q += 1) {
        const c = at(p, q);
        if (!inMap(c.x, c.y)) continue;
        const i = idx(c.x, c.y);
        zone.push(i);
        if (!path.has(i)) open.delete(i);
      }
    }
    taken.push(s.t);
    gaps.push({ cells: band, from: mid(before), to: mid(after), width: gapWidth, axis: vertical ? "vertical" : "horizontal", zone });
  }
  // 맵 가장자리 줄은 문 두 칸만 트인다.
  const doorCells = new Set<number>();
  for (const e of plan.exits) { doorCells.add(idx(e.x, e.y)); doorCells.add(e.y === 0 || e.y === H - 1 ? idx(e.x + 1, e.y) : idx(e.x, e.y + 1)); }
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (x !== 0 && y !== 0 && x !== W - 1 && y !== H - 1) continue;
    const c = idx(x, y);
    if (!doorCells.has(c)) { open.delete(c); path.delete(c); }
  }
  return { path, open, gaps };
}

function paintSnowMap(project: Project, plan: SnowPlan, gapWidth: number, iceAmount: number, driftAmount: number, warnings: string[], paintGaps = false):
  { paintGapArt: () => void; map: GameMap; gaps: SnowGap[]; ice: Cell[]; drifts: Cell[] } {
  const { width: W, height: H, seed } = plan;
  call(project, "create_map", { id: plan.id, name: plan.name, width: W, height: H, tilesetId: BEODEUL_TILESET_ID });
  const map = project.maps[plan.id]!;
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) throw new ToolError(`칩셋 ${map.tilesetId} 이 없다.`);
  const snow = kitCells(tileset, KIT("ground-snow")), road = kitCells(tileset, KIT("ground-road")), iceKit = kitCells(tileset, KIT("ground-ice"));
  if (!snow.length || !road.length) throw new ToolError("버들항 설원 바닥 키트(bd-pick-snowfield-ground-snow·road)가 칩셋에 없다 — 버들항 칩셋을 최신으로 다시 불러와야 한다.", { code: "snow-route-kit-missing" });
  const idx = (x: number, y: number) => y * W + x;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const { path, open, gaps } = carve(plan, gapWidth, warnings);

  map.mapRole ??= "field";
  map.lowerTiles = Array.from({ length: W * H }, (_, c) => snow[Math.floor(hash01(c % W, Math.floor(c / W), seed + 1) * snow.length)]!);
  map.upperTiles = Array.from({ length: W * H }, () => -1);
  delete map.lowerTileStacks;
  delete map.upperTileStacks;
  if (map.lowerOverlayTiles) map.lowerOverlayTiles = Array.from({ length: W * H }, () => -1);
  if (map.upperOverlayTiles) map.upperOverlayTiles = Array.from({ length: W * H }, () => -1);
  // 다져진 눈길: 걷는 길 폭(2~3.4) 안의 가운데 줄(곡선에서 1칸 안)만 흙빛 눈길로 — 폭 전체를 칠하면 굽이마다 네모 계단이 굵게 드러났다.
  // 키트 윗줄·아랫줄은 눈이 덮인 가장자리 그림이라 북쪽·남쪽 이웃이 눈길이 아닌 칸에만 쓴다(가운데 줄은 속 칸).
  // 밟힌 눈길은 테두리가 부드러운 다진 눈 오토타일(던전 얼음굴 바닥)로 — 길 키트는 줄 단위 그림이라 옆 테두리가 없어
  // 굽이마다 베이지 계단 띠로 끊겼다(2026-10-29 폴른 스타 B7 감독 검수, 서리나루 마을 길과 같은 처리). 오토타일이 없는 칩셋은 키트로.
  const packedGroup = (tileset.autotileGroups ?? []).find((g) => g.id === "beodeul_dungeon_ice_ground");
  const roadKit = (tileset.structureKits ?? []).find((k) => k.id === KIT("ground-road"));
  const rows = (roadKit?.rows ?? []).map((r) => (r.tiles ?? []).filter((t) => t >= 0));
  const trail = new Set<number>();
  const trailRadius = packedGroup ? 1.3 : 0.95;
  for (const s of spline(plan.pts)) for (let y = Math.floor(s.y) - 2; y <= Math.ceil(s.y) + 2; y += 1) for (let x = Math.floor(s.x) - 2; x <= Math.ceil(s.x) + 2; x += 1) {
    if (inMap(x, y) && path.has(idx(x, y)) && Math.hypot(x - s.x, y - s.y) <= trailRadius) trail.add(idx(x, y));
  }
  if (packedGroup) {
    // 2×2 덩이에 들지 못한 외톨이 칸은 뺀다(테두리 그림이 칸마다 끊긴다).
    for (const c of [...trail]) {
      const x = c % W, y = (c - x) / W;
      const ok = ([[0, 0], [-1, 0], [0, -1], [-1, -1]] as const).some(([ox, oy]) =>
        ([[0, 0], [1, 0], [0, 1], [1, 1]] as const).every(([i, j]) => trail.has(idx(x + ox + i, y + oy + j))));
      if (!ok) trail.delete(c);
    }
    const tb: [number, number, number][] = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];
    for (const c of trail) {
      const x = c % W, y = (c - x) / W;
      let m = 0;
      for (const [dx, dy, bit] of tb) if (!inMap(x + dx, y + dy) || trail.has(idx(x + dx, y + dy))) m |= bit;
      map.lowerTiles[c] = iceCell(packedGroup, m, x, y);
    }
  } else for (const c of trail) {
    const x = c % W, y = (c - x) / W;
    const n = trail.has(c - W) || y === 0, so = trail.has(c + W) || y === H - 1;
    const row = rows.length === 3 ? (!n ? rows[0]! : !so ? rows[2]! : rows[1]!) : road;
    map.lowerTiles[c] = row[x % row.length] ?? road[0]!;
  }

  // 빙판: 빈터·길섶의 잡음 덩이 + 틈 자리 둘레(얼어붙은 개울을 건너는 자리로 읽히게). 걷는 칸만.
  const iceSet = new Set<number>();
  if (iceAmount > 0) for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
    const c = idx(x, y);
    if (!open.has(c)) continue;
    const v = noise2(x * 0.7, y * 0.7, seed + 19);
    if (v > 1.25 - 0.35 * iceAmount && !plan.exits.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 4)) iceSet.add(c);
  }
  for (const g of gaps) for (const c of g.cells) {
    const x = c % W, y = (c - x) / W;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (inMap(x + dx, y + dy) && open.has(idx(x + dx, y + dy))) iceSet.add(idx(x + dx, y + dy));
  }
  // 외톨이·한 줄 빙판은 뺀다(가장자리 그림이 칸마다 끊긴다).
  for (const c of [...iceSet]) {
    const x = c % W, y = (c - x) / W;
    let blockOk = false;
    for (const [ox, oy] of [[0, 0], [-1, 0], [0, -1], [-1, -1]] as const) {
      if ([[0, 0], [1, 0], [0, 1], [1, 1]].every(([i, j]) => iceSet.has(idx(x + ox + i!, y + oy + j!)))) { blockOk = true; break; }
    }
    if (!blockOk) iceSet.delete(c);
  }
  const iceGroup = (tileset.autotileGroups ?? []).find((g) => g.id === "beodeul_dungeon_ice");
  const bits: [number, number, number][] = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];
  for (const c of iceSet) {
    const x = c % W, y = (c - x) / W;
    if (iceGroup) {
      let m = 0;
      for (const [dx, dy, bit] of bits) if (!inMap(x + dx, y + dy) || iceSet.has(idx(x + dx, y + dy))) m |= bit;
      map.lowerTiles[c] = iceCell(iceGroup, m, x, y);
    } else if (iceKit.length) map.lowerTiles[c] = iceKit[Math.floor(hash01(x, y, seed + 3) * iceKit.length)]!;
  }

  // 눈 덮인 침엽 수관 벽 — 걷는 칸이 아닌 곳 전부. 수관 오토타일이 받는 모양으로 다듬는다(외톨이·한 줄 띠 제거).
  const forest = new Set<number>();
  for (let c = 0; c < W * H; c += 1) if (!open.has(c)) forest.add(c);
  const zone = new Set(gaps.flatMap((g) => g.zone));
  shapeBeodeulCanopyMask(W, H, forest, { minComponent: 12, minExtent: 3, minInterior: 0.15, block: 2 });
  const canopyPlan = planBeodeulCanopy(W, H, "snow", forest, (s) => !forest.has(s) && !iceSet.has(s));
  writeBeodeulCanopy(project, map, tileset, canopyPlan);
  // 다듬기로 숲이 걷힌 칸은 걷는 칸이 된다.
  for (let c = 0; c < W * H; c += 1) if (!forest.has(c)) open.add(c); else open.delete(c);

  // 눈더미·바위·낱 소나무 — 길과 그 옆 칸·출구 둘레·틈 좁힌 구역은 비운다(통행 보존).
  const stamp = SHARED_OBJECT_TOOLS.find((t) => t.name === "stamp_object")!;
  const busy = new Set<number>();
  const guard = (c: number) => {
    const x = c % W, y = (c - x) / W;
    if (!open.has(c) || path.has(c) || iceSet.has(c) || zone.has(c) || busy.has(c)) return false;
    if ([c - 1, c + 1, c - W, c + W].some((n) => path.has(n))) return false;
    if (plan.exits.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 4)) return false;
    if (layerTileAt(map, 2, c) >= 0 || layerTileAt(map, 3, c) >= 0 || layerTileAt(map, 4, c) >= 0) return false;
    return x > 0 && y > 0 && x < W - 1 && y < H - 1;
  };
  const drifts: Cell[] = [];
  const kits = new Map((tileset.structureKits ?? []).map((k) => [k.id, k] as const));
  const place = (kitId: string, x0: number, y0: number, w: number, h: number): boolean => {
    if (!kits.has(kitId)) return false;
    for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) { if (!inMap(x0 + i, y0 + j) || !guard(idx(x0 + i, y0 + j))) return false; }
    try { stamp.run(project, { objectId: `kit:${BEODEUL_TILESET_ID}/${kitId}`, mapId: map.id, x: x0, y: y0 }); }
    catch { return false; }
    for (let j = -1; j <= h; j += 1) for (let i = -1; i <= w; i += 1) if (inMap(x0 + i, y0 + j)) busy.add(idx(x0 + i, y0 + j));
    return true;
  };
  const rng = mulberry32(seed ^ 0x5a0f);
  const cand = [...open].filter((c) => !path.has(c)).sort((a, b) => hash01(a, 7, seed) - hash01(b, 7, seed));
  const want = Math.round(driftAmount * (6 + cand.length / 40));
  for (const c of cand) {
    if (drifts.length >= want) break;
    const x = c % W, y = (c - x) / W, r = rng();
    const ok = r < 0.55 ? place(KIT("mound"), x, y, 1, 1) : r < 0.8 ? place(KIT("rock"), x, y - 1, 2, 2) : place(KIT("pine"), x, y - 3, 2, 4);
    if (ok) drifts.push({ x, y });
  }

  // 틈 판정: 띠를 막으면 입구에서 출구(없으면 막다른 빈터)까지 끊기는가.
  const target = plan.exit ?? plan.endClearing;
  const reach = (blocked: ReadonlySet<number>): boolean => {
    const s = idx(plan.entry.x, plan.entry.y), goal = idx(target.x, target.y);
    const seen = new Set<number>([s]); const q = [s];
    while (q.length) {
      const c = q.pop()!;
      if (c === goal) return true;
      const x = c % W, y = (c - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy, n = idx(nx, ny);
        if (!inMap(nx, ny) || seen.has(n) || blocked.has(n) || !canMove(project, map, x, y, nx, ny)) continue;
        seen.add(n); q.push(n);
      }
    }
    return false;
  };
  if (!reach(new Set())) warnings.push(`${plan.name}: 입구 (${plan.entry.x},${plan.entry.y}) 에서 ${plan.exit ? "출구" : "막다른 빈터"} (${target.x},${target.y}) 까지 걸어서 닿지 않는다 — show_map_region 으로 확인.`);
  const out: SnowGap[] = gaps.map((g) => {
    const cell = (c: number): Cell => ({ x: c % W, y: Math.floor(c / W) });
    return { cells: g.cells.map(cell), from: cell(g.from), to: cell(g.to), width: g.width, axis: g.axis, seals: !reach(new Set(g.cells)) };
  });
  // 틈 칠하기(paintGaps): 띠 칸에 얼음 구멍(설원 키트 2×1 「얼음 구멍」, 못 걷는 윗층)을 가로로 잇대 찍는다 — 갈라진 얼음 틈.
  // 길이 실제로 막히므로 건널 수단(place_field_obstacle kind:"gap" 를 from 칸에)을 같이 놓아야 한다.
  // 막는 그림은 맵 사이 잇기가 끝난 뒤에 찍는다 — 먼저 막으면 연결 도구가 출구를 「닿지 않는 칸」으로 보고 거절한다.
  const paintGapArt = (): void => {
    if (!paintGaps) return;
    // 갈라진 얼음 틈 — 띠 칸은 검은 물(던전 물 오토타일, 얼음 쪽으로 꽉 찬다), 곁 빙판은 틈 쪽으로 깨진 가장자리를 그린다
    // (서리나루 호수 균열과 같은 처리). 얼음 구멍 키트(둥근 구멍 둘)는 「물웅덩이」로 읽혔다(2026-10-29 폴른 스타 B7 감독 검수).
    const crackWater = (tileset.autotileGroups ?? []).find((g) => g.id === "beodeul_dungeon_water_C");
    if (crackWater && iceGroup) {
      const live = project.maps[plan.id] ?? map;
      const crack = new Set(gaps.flatMap((g) => g.cells));
      const iceLike = (c: number) => iceSet.has(c) && !crack.has(c);
      for (const c of crack) {
        const x = c % W, y = (c - x) / W;
        let m = 0;
        for (const [dx, dy, bit] of bits) { const n = idx(x + dx, y + dy); if (!inMap(x + dx, y + dy) || crack.has(n) || iceLike(n) || open.has(n)) m |= bit; }
        live.lowerTiles[c] = iceCell(crackWater, m, x, y);
        live.upperTiles[c] = -1;
      }
      for (const c of crack) {
        const x0 = c % W, y0 = (c - x0) / W;
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
          const x = x0 + dx, y = y0 + dy, n = idx(x, y);
          if (!inMap(x, y) || !iceLike(n)) continue;
          let m = 0;
          for (const [ex, ey, bit] of bits) if (!inMap(x + ex, y + ey) || iceLike(idx(x + ex, y + ey))) m |= bit;
          live.lowerTiles[n] = iceCell(iceGroup, m, x, y);
        }
      }
      return;
    }
    const hole = (kits.get(KIT("ice-hole"))?.rows?.[0]?.upperTiles ?? []).filter((t) => t >= 0);
    if (hole.length < 2) warnings.push(`${plan.name}: 얼음 구멍 키트(${KIT("ice-hole")})가 없어 틈을 칠하지 못했다.`);
    else for (const g of gaps) {
      const rowsOf = new Map<number, number[]>();
      for (const c of g.cells) { const x = c % W, y = (c - x) / W; const key = g.axis === "vertical" ? y : x; rowsOf.set(key, [...(rowsOf.get(key) ?? []), g.axis === "vertical" ? x : y]); }
      for (const [line, qs] of rowsOf) {
        qs.sort((a, b) => a - b);
        const lo = qs[0]!, hi = qs[qs.length - 1]!;
        // 잇기 도구가 맵 객체를 새로 바꾼다 — 지금 맵을 다시 찾아 칠한다.
        const live = project.maps[plan.id] ?? map;
        const put = (q: number, tile: number) => { const c = g.axis === "vertical" ? idx(q, line) : idx(line, q); live.upperTiles[c] = tile; };
        if (g.axis === "vertical") {
          // 가로 띠: 2칸 구멍을 잇대고, 홀수 폭이면 마지막 구멍을 한 칸 겹쳐 끝에 붙인다.
          for (let q = lo; q <= hi; q += 2) { const s0 = Math.min(q, hi - 1); if (s0 < lo) { put(lo, hole[0]!); continue; } put(s0, hole[0]!); put(s0 + 1, hole[1]!); }
        } else for (let q = lo; q <= hi; q += 1) put(q, hole[0]!);
      }
    }
  };
  for (const [k, g] of out.entries()) if (!g.seals) warnings.push(`${plan.name}: 얼음 틈 ${k + 1} (${g.from.x},${g.from.y})→(${g.to.x},${g.to.y}) 는 띠를 막아도 옆으로 돌아갈 수 있다(seals:false).`);
  return { paintGapArt, map: project.maps[plan.id]!, gaps: out, ice: [...iceSet].map((c) => ({ x: c % W, y: Math.floor(c / W) })), drifts };
}

const MOODS: Record<Mood, { weather?: { kind: "snow"; intensity: number }; ambient?: number; color?: string }> = {
  clear: {},
  snow: { weather: { kind: "snow", intensity: 0.45 } },
  blizzard: { weather: { kind: "snow", intensity: 0.95 }, ambient: 0.72, color: "#9fb2c8" },
  dusk: { weather: { kind: "snow", intensity: 0.35 }, ambient: 0.5, color: "#3a4a6a" },
};

const authorSnowRoute: ToolDefinition = {
  name: "author_snow_route",
  description:
    "설원 길(눈 덮인 고갯길·서리 가도·얼음 들판) 맵을 1~3장 짓고 시작 맵의 한쪽 가장자리(north·south·east·west)와 줄줄이 잇는다. "
    + "버들항 설원 그림만 쓴다: 눈 바닥·다져진 눈길(구불구불한 곡선)·길 양옆 눈 덮인 침엽 수관 벽·빙판 덩이·눈더미/바위/낱 눈 소나무. "
    + "「마을 북쪽으로 눈보라 치는 고갯길 두 장」「얼음 틈 두 군데」의 정본 — 초록 숲(author_forest_route)·풀밭 가도(author_wild_route)로 북방을 짓지 않는다. "
    + "moods[i] = clear·snow(눈 내림)·blizzard(눈보라+어둑)·dusk(저녁 눈). gapCount 개수만큼 얼음 틈 자리(장대 도약 등 건너뛰기 장애물 자리)를 길이 곧게 지나는 곳에 고르고 길 양옆을 숲으로 좁혀 둔다 — "
    + "틈 칸 자체는 칠하지 않는다(건널 수단이 없으면 길이 막힌다). 결과 data.maps[i] = {mapId, entry, exit, clearing, gaps:[{cells, from, to, width, axis, seals}], ice, drifts}. "
    + "gaps[k].from/to 는 틈 앞뒤 길 칸(도약 시작·착지), seals:true 면 그 띠를 막을 때 길이 실제로 끊긴다. openEnd:true 면 마지막 맵도 반대쪽 가장자리 출구(data.maps[-1].exit)를 남긴다(다음 맵에 이을 자리).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      fromMapId: { type: "string", description: "설원 길과 이을 맵(마을·공터)" },
      side: { type: "string", enum: ["north", "south", "east", "west"] },
      count: { type: "integer", description: "설원 길 맵 수 1~3(기본 1)" },
      names: { type: "array", items: { type: "string" }, description: "맵 이름(생략 = '설원 길 1'…)" },
      moods: { type: "array", items: { type: "string", enum: ["clear", "snow", "blizzard", "dusk"] }, description: "맵마다 날씨(기본 snow)" },
      gapCount: { type: "integer", description: "얼음 틈 자리 수(전체 맵 합, 0~6, 기본 0) — 맵마다 고르게 나눈다" },
      gapWidth: { type: "integer", description: "틈 폭(진행 방향 칸 수) 1~2, 기본 1" },
      ice: { type: "number", description: "빙판 덩이 양 0~1(기본 0.5)" },
      drifts: { type: "number", description: "눈더미·바위·낱 소나무 양 0~1(기본 0.5)" },
      openEnd: { type: "boolean", description: "마지막 맵도 반대쪽 가장자리 출구를 남긴다(기본 false = 막다른 빈터)" },
      paintGaps: { type: "boolean", description: "true 면 얼음 틈 띠에 얼음 구멍 그림을 찍어 실제로 막는다(기본 false = 칠하지 않음). 켜면 틈마다 place_field_obstacle kind:\"gap\"(x,y = gaps[k].from) 로 건널 수단을 꼭 놓는다" },
      linkFrom: { type: "boolean", description: "false 면 시작 맵 가장자리에 길·이동 이벤트를 두지 않는다 — 요새 뒷문·동굴 출구·성벽 계단처럼 시작 맵(실내·던전)의 정한 칸에서 이벤트로 들여보낼 때. 첫 맵 입구는 data.maps[0].entry(그 칸에 돌아가는 이벤트를 직접 둔다). 기본 true" },
      seed: { type: "integer" },
    },
    required: ["fromMapId", "side"],
  },
  invalidArgsExample: { fromMapId: "map_1", side: "north", count: 2, moods: ["snow", "blizzard"], gapCount: 2 },
  run(draft, args): ToolExecResult {
    const from = requireMap(draft, String(args.fromMapId));
    const side = (["north", "south", "east", "west"] as const).find((s) => s === args.side);
    if (!side) throw new ToolError("side 는 north·south·east·west 중 하나.", { code: "invalid-args" });
    const count = Math.max(1, Math.min(3, Math.floor(Number(args.count ?? 1)) || 1));
    const seed0 = Number.isFinite(Number(args.seed)) ? Number(args.seed) : 11 + Object.keys(draft.maps).length * 17;
    const names = Array.isArray(args.names) ? args.names.map(String) : [];
    const moods = Array.isArray(args.moods) ? args.moods.map(String) : [];
    const gapTotal = Math.max(0, Math.min(6, Math.floor(Number(args.gapCount ?? 0)) || 0));
    const gapWidth = Math.max(1, Math.min(2, Math.floor(Number(args.gapWidth ?? 1)) || 1));
    const clamp01 = (v: unknown, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : d; };
    const iceAmount = clamp01(args.ice, 0.5), driftAmount = clamp01(args.drifts, 0.5);
    const openEnd = args.openEnd === true;
    const warnings: string[] = [];
    const gapArt: (() => void)[] = [];
    const out: Array<{ mapId: string; name: string; entry: Cell; exit: Cell | null; clearing: Cell; gaps: SnowGap[]; ice: Cell[]; drifts: Cell[] }> = [];
    const linkFrom = args.linkFrom !== false;
    let prev: ({ mapId: string } & Cell) | null = linkFrom ? { mapId: from.id, ...originEdge(draft, from, side) } : null;
    for (let i = 0; i < count; i += 1) {
      let id = `map_snow_${side}_${i + 1}`;
      for (let n = 2; draft.maps[id]; n += 1) id = `map_snow_${side}_${i + 1}_${n}`;
      const name = names[i] ?? (count > 1 ? `설원 길 ${i + 1}` : "설원 길");
      const gapsHere = Math.floor(gapTotal / count) + (i < gapTotal % count ? 1 : 0);
      const entryU = 10 + mulberry32(seed0 + i * 31)() * 12;
      const plan = planSnow(id, name, side, seed0 + i * 97, i === count - 1, openEnd, entryU, gapsHere);
      const painted = paintSnowMap(draft, plan, gapWidth, iceAmount, driftAmount, warnings, args.paintGaps === true);
      try { call(draft, "manage_map_tree", { operation: "move", mapId: id, parentId: from.id }); } catch { /* 트리 이동 실패는 무시 */ }
      if (prev) link(draft, prev, { mapId: id, ...plan.entry });
      const moodName = (["clear", "snow", "blizzard", "dusk"] as const).find((m) => m === moods[i]) ?? "snow";
      const mood = MOODS[moodName];
      if (mood.weather || mood.ambient !== undefined) {
        try {
          call(draft, "set_scene_mood", {
            mapId: id, applyMode: "map",
            ...(mood.weather ? { weather: mood.weather } : {}),
            ...(mood.ambient !== undefined ? { lighting: { ambient: mood.ambient, color: mood.color } } : {}),
          });
        } catch (e) { warnings.push(`${name} 날씨 실패: ${String(e).slice(0, 120)}`); }
      }
      if (painted.gaps.length < gapsHere) warnings.push(`${name}: 얼음 틈 ${gapsHere}곳 중 ${painted.gaps.length}곳만 자리를 찾았다.`);
      gapArt.push(painted.paintGapArt);
      out.push({ mapId: id, name, entry: plan.entry, exit: plan.exit, clearing: plan.endClearing, gaps: painted.gaps, ice: painted.ice, drifts: painted.drifts });
      if (plan.exit) prev = { mapId: id, ...plan.exit };
    }
    for (const paint of gapArt) paint();
    const gapNote = out.reduce((n, m) => n + m.gaps.length, 0);
    return {
      summary: `설원 길 ${count}장(${side}): ${out.map((m) => `${m.name}=${m.mapId}${m.gaps.length ? ` 얼음 틈 ${m.gaps.length}` : ""}`).join(" → ")} · ${linkFrom ? `${from.id} ${side} 가장자리와 연결` : `${from.id} 와는 잇지 않음(첫 맵 입구 data.maps[0].entry 에 이벤트로 잇는다)`}${gapNote ? ` · 틈 자리는 data.maps[i].gaps(from→to)` : ""}`,
      data: { maps: out },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const SNOW_ROUTE_TOOLS: readonly ToolDefinition[] = [authorSnowRoute];
