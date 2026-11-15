// editor/tools/routeThemeBuild.ts
// author_wild_route{theme} 의 시공 — 길목 갈래(routeThemes.ts)의 가짓수 하나를 버들항 재료로 깐다.
//
// 길목은 «지나가는 곳» 이다: 낮은 쪽 가장자리에서 높은 쪽 가장자리까지 두 칸 폭 길이 이어지고, 단(절벽)은 돌계단으로만 오르며(남북 — 버들항에는 동서 계단
// 조각이 없다), 길 곁에 주인공 볼거리 하나와 곁가지(막다른 쉼터·상자 자리)가 있고, 적·사람·사건을 놓을 빈 칸을 결과로 돌려준다.
// 순서: 계획(단·길·물·자리) → 물·길 칠하기 → 다리 → 볼거리·곁가지 찍기 → 숲 → 길섶 → (정령 숲) 바닥·길 갈아 깔기 → 높이(relief)·돌계단 → 닿지 않는 걷는 칸 막기.
// 찍기 도구는 높이를 모르므로 높이는 맨 끝에 싣는다(마을 시공기와 같은 순서).
import skins from "@/assets/beodeulRouteSkins.json";
import { tilesetLookCliff, tilesetLookReliefStyle } from "@/assets/tilesetLooks";
import { canMove, isPassable } from "@/project/collision";
import { activeTilesetLook } from "@/project/kitLook";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { invalidateReliefSlopes, rampCode, RELIEF_BRIDGE } from "@/project/relief/walk";
import type { GameMap, Project, StructureKitDef, TilesetDef } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { beodeulWoodlandGrass, shapeBeodeulCanopyMask } from "./beodeulForest";
import { layBeodeulGroundCover } from "./beodeulGroundCover";
import { relayBeodeulWaterSurface } from "./beodeulWater";
import { hash01, smoothNoise } from "./sceneTerrain";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import type { RouteHero, RouteTheme, RouteVariant } from "./routeThemes";
import { CONSTRUCTION_TOOLS_V3 } from "./v3/constructionTools";
import { BEODEUL_PLAIN_GRASS, BEODEUL_SAND_PATH, dressBeodeulVerge, plantBeodeulForestWall } from "./wildRouteBeodeul";

export type RouteSideName = "north" | "south" | "east" | "west";
type Cell = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };

interface RouteSkins {
  readonly base: number; readonly end: number;
  readonly spirit: { readonly ground: readonly (readonly number[])[]; readonly path: readonly (readonly number[])[]; readonly canopy: readonly (readonly number[])[] };
  readonly bridge: Readonly<Record<string, readonly (readonly number[])[]>>;
}
const SKINS = skins as unknown as RouteSkins;

export interface ThemedRouteInput {
  readonly project: Project; readonly map: GameMap; readonly tileset: TilesetDef;
  readonly theme: RouteTheme; readonly variant: RouteVariant;
  /** [들어오는 변, 나가는 변]. */
  readonly sides: readonly [RouteSideName, RouteSideName];
  readonly seed: number;
}
export interface ThemedRouteResult {
  readonly entry: Cell; readonly exit: Cell;
  readonly roadCells: number; readonly treeCells: number; readonly stairs: number; readonly sealed: number;
  /** 주인공 볼거리가 선 자리(없으면 못 놓았다)와 그 앞 칸(사람·사건 자리). */
  readonly heroAt?: Rect; readonly heroFront?: Cell;
  /** 곁가지 끝(쉼터·상자 자리·전망) — 못 냈으면 없다. */
  readonly sideAt?: Cell; readonly sideKind: string;
  /** 길 위 빈 칸(적 자리) — 계단·다리·문에서 떨어진 곳. */
  readonly enemySpots: Cell[];
  readonly warnings: string[];
}

const tool = (tools: readonly { name: string }[], name: string) => { const t = tools.find((c) => c.name === name); if (!t) throw new Error(`필수 툴 없음: ${name}`); return t as (typeof SHARED_OBJECT_TOOLS)[number]; };
const FLAT = (v: RouteVariant): boolean => v.cover === "spirit";

/** 낮은 쪽·높은 쪽 변 — 땅은 늘 북쪽이 높다(절벽 면이 남쪽을 본다). */
function lowHigh(sides: readonly [RouteSideName, RouteSideName]): { low: RouteSideName; high: RouteSideName; swapped: boolean } {
  const rank = (s: RouteSideName, other: RouteSideName): number => s === "south" ? 0 : s === "north" ? 3 : other === "south" ? 2 : other === "north" ? 1 : 1.5;
  const [a, b] = sides, ra = rank(a, b), rb = rank(b, a);
  return ra <= rb ? { low: a, high: b, swapped: false } : { low: b, high: a, swapped: true };
}

export function buildThemedRoute(input: ThemedRouteInput): ThemedRouteResult {
  const { project, map, tileset, variant, seed } = input;
  const W = map.width, H = map.height, N = W * H;
  const rnd = mulberry32((seed ^ 0x51ed27) >>> 0);
  const ri = (lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));
  const idx = (x: number, y: number): number => y * W + x;
  const inMap = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  const warnings: string[] = [];
  const stamp = tool(SHARED_OBJECT_TOOLS, "stamp_object"), fill = tool(CONSTRUCTION_TOOLS_V3, "fill_region");
  const kits = new Map((tileset.structureKits ?? []).map((k) => [k.id, k] as const));
  const flat = FLAT(variant);
  const look = activeTilesetLook(tileset);
  const { low, high, swapped } = lowHigh(input.sides);

  // ---------- 1. 가로 띠(단·골짜기·내) ----------
  // 남쪽에서 북쪽으로 자름(cut)들: 절벽(rise) 또는 틈(gap — 골짜기·내). 그 사이가 띠(band)이고 띠마다 가로 길(run)이 하나 있다.
  const step = Math.max(1, Math.min(2, tilesetLookCliff(tileset.id, look)?.step ?? 1));
  type Cut = { kind: "cliff" | "gap"; rise: number; rows: number; at: number; col: number };
  const cuts: Cut[] = [];
  const cliff = (rise: number): Cut => ({ kind: "cliff", rise, rows: 0, at: 0, col: 0 });
  const gapRows = variant.layout === "gorge" ? 6 : variant.hero.h;
  if (variant.layout === "gorge") { cuts.push(cliff(2)); cuts.push({ kind: "gap", rise: 0, rows: gapRows, at: 0, col: 0 }); }
  else if (variant.layout === "brook") { cuts.push({ kind: "gap", rise: 0, rows: gapRows, at: 0, col: 0 }); for (let k = 0; k < variant.tiers; k += 1) cuts.push(cliff(flat ? 0 : step)); }
  else if (variant.layout === "ledge") { cuts.push(cliff(Math.min(3, step + 1))); for (let k = 1; k < variant.tiers; k += 1) cuts.push(cliff(1)); }
  else for (let k = 0; k < variant.tiers; k += 1) cuts.push(cliff(flat ? 0 : variant.tiers >= 4 ? 1 : step));
  const nb = cuts.length + 1;
  const hero = variant.hero;
  const needsSite = hero.site === "beside" || hero.site === "knoll" || hero.site === "center";
  // 주인공 볼거리가 서는 띠: 가운데쯤(맨 아래·맨 위는 들어오고 나가는 다리 때문에 좁다). 골짜기·내 짜임은 틈 다음 띠.
  let heroBand = Math.min(nb - 1, Math.max(0, Math.round((nb - 1) / 2 + (rnd() - 0.5))));
  if (variant.layout === "gorge") heroBand = 1;
  const need = (i: number): number => (i === heroBand && needsSite ? hero.h + (hero.site === "knoll" ? 9 : hero.site === "center" ? 7 : 7) : 7);
  const gapTotal = cuts.reduce((s, c) => s + c.rows, 0);
  const free = H - gapTotal;
  const wants = Array.from({ length: nb }, (_, i) => need(i));
  const wantSum = wants.reduce((s, v) => s + v, 0);
  if (wantSum > free) warnings.push(`맵 높이 ${H} 가 이 짜임(띠 ${nb}개)에 빠듯하다 — 볼거리 자리가 좁아질 수 있다.`);
  const spare = Math.max(0, free - wantSum);
  const heights = wants.map((v, i) => Math.max(5, Math.round(v * Math.min(1, free / wantSum)) + Math.floor(spare / nb) + (i === heroBand ? spare % nb : 0)));
  // 띠 i 의 줄 범위(top..bot) — 남쪽(아래)부터 쌓는다.
  const bands: { top: number; bot: number; run: number; level: number }[] = [];
  { let y = H - 1, level = 0;
    for (let i = 0; i < nb; i += 1) {
      const h = i === nb - 1 ? y + 1 : heights[i]!;
      bands.push({ top: Math.max(0, y - h + 1), bot: y, run: 0, level });
      y -= h;
      const c = cuts[i];
      if (c) { if (c.kind === "gap") { c.at = y - c.rows + 1; y -= c.rows; } else { c.at = y + 1; level += c.rise; } }
    } }
  if (bands.some((b) => b.bot - b.top < 4)) warnings.push("띠가 네 줄보다 좁다 — 맵을 키우거나 단 수를 줄인다.");

  // ---------- 2. 건너는 열과 가로 길 줄 ----------
  const straight = variant.layout === "avenue" || variant.layout === "glade";
  const colLo = 4, colHi = W - 6;
  const mainCol = ri(Math.floor(W * 0.35), Math.floor(W * 0.6));
  let last = variant.layout === "switchback" ? (rnd() < 0.5 ? colLo : colHi) : mainCol;
  cuts.forEach((c, k) => {
    if (straight) c.col = mainCol;
    else if (variant.layout === "switchback") { last = last <= W / 2 ? colHi - ri(0, 2) : colLo + ri(0, 2); c.col = last; }
    else { let col = last; for (let t = 0; t < 12 && Math.abs(col - last) < 6; t += 1) col = ri(colLo, colHi); c.col = k === 0 && variant.layout !== "winding" && variant.layout !== "forks" && rnd() < 0.3 ? last : col; last = c.col; }
  });
  // 곁가지를 낼 띠(주인공 띠가 아닌 가장 높은 띠)는 가로 길을 띠 위쪽에 둔다 — 길 남쪽에 막다른 빈터 자리가 남는다
  const sideBand = variant.side === "none" ? -1 : bands.map((b, i) => ({ i, h: b.bot - b.top })).filter((v) => v.i !== heroBand || nb === 1).sort((p, q) => q.h - p.h)[0]?.i ?? -1;
  bands.forEach((b, i) => {
    if (i === sideBand && i !== heroBand && b.bot - b.top >= 9) { b.run = b.top + 2 + ri(0, Math.max(0, Math.min(1, b.bot - b.top - 9))); return; }
    const north = i === heroBand && needsSite ? hero.h + (hero.site === "knoll" ? 6 : 3) : 2;
    const lo = b.top + north, hi = b.bot - 2;
    b.run = hi < lo ? Math.max(b.top + 1, Math.min(b.bot - 1, hi)) : i === heroBand && needsSite ? Math.min(hi, lo + ri(0, 1)) : ri(Math.max(lo, hi - 3), hi);
  });
  const edgeCol = (side: RouteSideName, band: { run: number }, near: number): Cell => side === "south" ? { x: near, y: H - 1 } : side === "north" ? { x: near, y: 0 } : side === "west" ? { x: 0, y: band.run } : { x: W - 1, y: band.run };
  const lowBand = bands[0]!, highBand = bands[nb - 1]!;
  const lowCol = straight ? mainCol : ri(colLo, colHi), highCol = straight ? mainCol : ri(colLo, colHi);
  const lowEnd = edgeCol(low, lowBand, lowCol), highEnd = edgeCol(high, highBand, highCol);

  // ---------- 3. 길 칸 ----------
  const road = new Set<number>();
  const order: number[] = []; // 낮은 끝 → 높은 끝 차례(가운데 줄) — 빈 자리·줄 세우기용
  const put = (x: number, y: number) => { if (inMap(x, y)) { const c = idx(x, y); if (!road.has(c)) { road.add(c); } } };
  const hline = (y: number, xa: number, xb: number) => { const [x0, x1] = xa <= xb ? [xa, xb] : [xb, xa]; for (let x = x0; x <= Math.min(W - 1, x1 + 1); x += 1) { put(x, y); put(x, y + 1); } const dir = xa <= xb ? 1 : -1; for (let x = xa; x !== xb + dir; x += dir) order.push(idx(Math.max(0, Math.min(W - 1, x)), y)); };
  const vline = (x: number, ya: number, yb: number) => { const [y0, y1] = ya <= yb ? [ya, yb] : [yb, ya]; for (let y = y0; y <= Math.min(H - 1, y1 + 1); y += 1) { put(x, y); put(x + 1, y); } const dir = ya <= yb ? 1 : -1; for (let y = ya; y !== yb + dir; y += dir) order.push(idx(x, Math.max(0, Math.min(H - 1, y)))); };
  // 낮은 끝에서 첫 띠의 가로 길까지
  let cx = lowEnd.x, cy = lowEnd.y;
  if (low === "south") { vline(cx, cy, lowBand.run); cy = lowBand.run; } else if (low === "north") { vline(cx, 0, lowBand.run); cy = lowBand.run; } else cy = lowBand.run;
  cuts.forEach((c, k) => {
    const next = bands[k + 1]!;
    hline(cy, cx, c.col); cx = c.col;
    vline(cx, cy, next.run); cy = next.run;
  });
  if (high === "north") { hline(cy, cx, highEnd.x); vline(highEnd.x, cy, 0); }
  else if (high === "south") { hline(cy, cx, highEnd.x); vline(highEnd.x, cy, H - 1); }
  else hline(cy, cx, highEnd.x === 0 ? 0 : W - 2);
  if (high === "east" || low === "east") for (const y of [high === "east" ? highBand.run : lowBand.run]) { put(W - 1, y); put(W - 1, y + 1); }

  // ---------- 4. 높이(단) ----------
  const lv = new Uint8Array(N), ramps = new Array<number>(N).fill(0);
  const water = new Uint8Array(N), bridge = new Uint8Array(N);
  // 절벽 줄 굽이: 열마다 −1·0·+1, 세~여섯 칸씩. 돌계단 둘레(±3)와 틈 건너는 자리는 곧게.
  const wobble = (lock: readonly number[]): Int8Array => {
    const off = new Int8Array(W); let x = 0, cur = 0;
    while (x < W) { const len = ri(3, 6); cur = cur === 0 ? (rnd() < 0.5 ? -1 : 1) * (rnd() < 0.75 ? 1 : 0) : 0; for (let i = 0; i < len && x < W; i += 1, x += 1) off[x] = cur; }
    for (const c of lock) for (let d = -3; d <= 4; d += 1) if (c + d >= 0 && c + d < W) off[c + d] = 0;
    return off;
  };
  const stairsAt: { x: number; y: number; rise: number }[] = [];
  const gaps: { top: number; rows: number; col: number; gorge: boolean; offN: Int8Array; offS: Int8Array }[] = [];
  { let level = 0;
    cuts.forEach((c) => {
      if (c.kind === "cliff") {
        if (!c.rise) return;
        const off = wobble([c.col]);
        for (let x = 0; x < W; x += 1) for (let y = 0; y < c.at + off[x]!; y += 1) lv[idx(x, y)] = lv[idx(x, y)]! + c.rise;
        level += c.rise;
        stairsAt.push({ x: c.col, y: c.at, rise: c.rise });
      } else {
        const gorge = variant.layout === "gorge";
        gaps.push({ top: c.at, rows: c.rows, col: c.col, gorge, offN: wobble([c.col]), offS: wobble([c.col]) });
      }
    }); }
  for (const g of gaps) for (let x = 0; x < W; x += 1) {
    const y0 = g.top + (g.gorge ? 0 : g.offN[x]!), y1 = g.top + g.rows - 1 + (g.gorge ? 0 : Math.max(0, g.offS[x]!));
    for (let y = y0; y <= y1; y += 1) {
      if (!inMap(x, y)) continue;
      const c = idx(x, y), onDeck = x === g.col || x === g.col + 1;
      if (onDeck) { bridge[c] = 1; continue; }
      if (g.gorge) lv[c] = Math.max(0, lv[c]! - 2);
      water[c] = 1;
    }
  }
  // 골짜기 바닥: 남쪽 둑에 가리는 두 줄은 물로 두고, 북쪽 절벽 발치 한 줄은 자갈 없는 맨 바닥(물가) — 물 오토타일이 둑을 그린다.
  for (let c = 0; c < N; c += 1) if (water[c] || bridge[c]) road.delete(c);

  // ---------- 5. 주인공 볼거리 자리 ----------
  const hb = bands[heroBand]!;
  const leaving = cuts[heroBand]?.col ?? (high === "north" || high === "south" ? highEnd.x : high === "west" ? 0 : W - 2);   // 이 띠에서 위로 떠나는 열
  const arriving = heroBand === 0 ? (low === "south" || low === "north" ? lowEnd.x : low === "west" ? 0 : W - 2) : cuts[heroBand - 1]!.col;
  const runLo = Math.min(arriving, leaving), runHi = Math.max(arriving, leaving) + 1;
  let site: Rect | undefined, heroFront: Cell | undefined, knoll: Rect | undefined, knollStairs: Cell | undefined;
  const clearings: Rect[] = [];
  const blob: { cx: number; cy: number; rx: number; ry: number }[] = [];
  const placements: { kit: string; x: number; y: number }[] = [];
  const kitOf = (id: string): StructureKitDef | undefined => kits.get(id);
  const missing = new Set<string>();
  const want = (id: string, x: number, y: number) => { if (kitOf(id)) placements.push({ kit: id, x, y }); else missing.add(id); };
  if (hero.site === "beside" || hero.site === "knoll") {
    const up = hero.site === "knoll" ? 3 : 1;   // 길과 자리 사이 줄 수(둔덕은 층계참·계단·둔덕 앞마당)
    const y1 = hb.run - 1 - up, y0 = y1 - hero.h + 1;
    const fits = (x0: number): boolean => x0 >= 2 && x0 + hero.w <= W - 2 && (x0 + hero.w + 1 < leaving - 1 || x0 - 1 > leaving + 2 || leaving === arriving && false);
    const fx = (x0: number): number => x0 + Math.floor(hero.w / 2);
    const cands: number[] = [];
    for (let x0 = 2; x0 + hero.w <= W - 2; x0 += 1) if (fits(x0)) cands.push(x0);
    const mid = (runLo + runHi) / 2;
    cands.sort((a, b) => (fx(a) >= runLo && fx(a) <= runHi ? 0 : 100) + Math.abs(fx(a) - mid) - ((fx(b) >= runLo && fx(b) <= runHi ? 0 : 100) + Math.abs(fx(b) - mid)));
    const x0 = cands[0];
    if (x0 !== undefined && y0 >= hb.top + 1) {
      site = { x: x0, y: y0, w: hero.w, h: hero.h };
      heroFront = { x: Math.max(runLo, Math.min(runHi, fx(x0))), y: hb.run - 1 };
      // 길이 자리 앞까지 오지 않으면(곧은 길) 길에서 자리 앞까지 가로 길을 낸다
      if (fx(x0) < runLo || fx(x0) > runHi) { hline(hb.run, fx(x0), fx(x0) < runLo ? runLo : runHi); heroFront = { x: fx(x0), y: hb.run - 1 }; }
      if (hero.site === "knoll") {
        knoll = { x: x0 - 1, y: y0 - 1, w: hero.w + 2, h: hero.h + 2 };
        const sx = Math.max(knoll.x + 1, Math.min(knoll.x + knoll.w - 3, fx(x0) - 1));
        knollStairs = { x: sx, y: hb.run - 2 };
        for (let y = knoll.y; y < knoll.y + knoll.h; y += 1) for (let x = knoll.x; x < knoll.x + knoll.w; x += 1) if (inMap(x, y)) lv[idx(x, y)] = hb.level + 1;
        for (const y of [hb.run - 1, hb.run - 2, hb.run - 3]) { put(sx, y); put(sx + 1, y); }
        heroFront = { x: sx, y: hb.run - 3 };
        clearings.push({ x: knoll.x, y: knoll.y, w: knoll.w, h: knoll.h + 3 });
      } else clearings.push({ x: x0 - 1, y: y0 - 1, w: hero.w + 2, h: hero.h + 2 });
      for (const it of hero.items) want(it.kit, x0 + it.dx, y0 + it.dy);
    } else warnings.push(`주인공 볼거리 «${hero.ko}» 자리를 내지 못했다(띠가 좁다).`);
  } else if (hero.site === "center") {
    // 띠를 지나는 세로 길 한가운데의 둥근 빈터 — 밟는 그림이면 길이 그 위로, 막힌 것이면 빈터가 둘레로 돌아간다
    const col = heroBand === 0 ? cuts[0]?.col ?? mainCol : cuts[heroBand - 1]!.col;
    const cyc = Math.round((hb.top + hb.run) / 2) + 1;
    const x0 = col + 1 - Math.floor(hero.w / 2), y0 = cyc - Math.floor(hero.h / 2);
    site = { x: x0, y: y0, w: hero.w, h: hero.h };
    blob.push({ cx: col + 1, cy: cyc + 0.5, rx: hero.w / 2 + 3, ry: hero.h / 2 + 2.6 });
    heroFront = { x: col, y: y0 + hero.h };
    for (const it of hero.items) want(it.kit, x0 + it.dx, y0 + it.dy);
    if (!hero.walkOver) {
      for (let y = y0 - 1; y <= y0 + hero.h; y += 1) for (let x = x0 - 1; x <= x0 + hero.w; x += 1) road.delete(idx(x, y));
      // 빈터 둘레를 도는 길(왼쪽)
      for (let y = y0 - 2; y <= y0 + hero.h + 1; y += 1) { put(x0 - 2, y); put(x0 - 3, y); }
      for (let x = x0 - 3; x <= col + 1; x += 1) { put(x, y0 - 2); put(x, y0 - 3); put(x, y0 + hero.h + 1); put(x, y0 + hero.h + 2); }
    }
  }
  // 세로 길 토막(문·양옆 석상·줄 세우기가 쓰는 곧은 구간): 계단·다리 줄에서 두 칸 떨어진 곳만
  const legs: { x: number; y0: number; y1: number }[] = [];
  { const busy = new Set<number>(); for (const s of stairsAt) for (let d = -2; d <= 2; d += 1) busy.add(s.y + d);
    for (const g of gaps) for (let y = g.top - 3; y <= g.top + g.rows + 2; y += 1) busy.add(y);
    const add = (x: number, ya: number, yb: number) => { let s = -1; const [a, b] = ya <= yb ? [ya, yb] : [yb, ya];
      for (let y = a; y <= b + 1; y += 1) { const ok = y <= b && !busy.has(y) && road.has(idx(x, y)) && road.has(idx(x + 1, y)) && !road.has(idx(x - 1, y)) && !road.has(idx(x + 2, y));
        if (ok && s < 0) s = y; if (!ok && s >= 0) { if (y - s >= 3) legs.push({ x, y0: s, y1: y - 1 }); s = -1; } } };
    if (low === "south" || low === "north") add(lowEnd.x, low === "south" ? H - 2 : 1, lowBand.run + (low === "south" ? 2 : -1));
    cuts.forEach((c, k) => add(c.col, bands[k]!.run - 1, bands[k + 1]!.run + 2));
    if (high === "north" || high === "south") add(highEnd.x, high === "north" ? 1 : H - 2, highBand.run + (high === "north" ? -1 : 2));
    legs.sort((p, q) => (q.y1 - q.y0) - (p.y1 - p.y0)); }
  let gate: { x: number; y: number; w: number; h: number; gap: readonly number[] } | undefined;
  if (hero.site === "gate" || hero.site === "flank") {
    const leg = legs.find((l) => l.y1 - l.y0 + 1 >= Math.min(hero.h, 3) + 1) ?? legs[0];
    if (!leg) warnings.push(`«${hero.ko}» 를 세울 곧은 세로 길이 없다.`);
    else {
      const yb = Math.min(leg.y1, Math.max(leg.y0 + Math.min(hero.h, 3) - 1, Math.round((leg.y0 + leg.y1) / 2) + 1));
      if (hero.site === "gate") {
        const x0 = leg.x - hero.gap![0]!;
        gate = { x: x0, y: yb - hero.h + 1, w: hero.w, h: hero.h, gap: hero.gap! };
        site = { x: gate.x, y: gate.y, w: gate.w, h: gate.h };
        want(hero.items[0]!.kit, gate.x, gate.y);
        heroFront = { x: leg.x, y: yb + 1 };
      } else {
        const id = hero.items[0]!.kit;
        want(id, leg.x - 1 - hero.w, yb - hero.h + 1); want(id, leg.x + 3, yb - hero.h + 1);
        site = { x: leg.x - 1 - hero.w, y: yb - hero.h + 1, w: hero.w * 2 + 4, h: hero.h };
        clearings.push({ x: site.x - 1, y: site.y, w: site.w + 2, h: site.h + 1 });
        heroFront = { x: leg.x, y: yb + 1 };
      }
    }
  }

  // ---------- 6. 곁가지(막다른 쉼터·상자 자리·전망) ----------
  let sideAt: Cell | undefined, sideKind = "none";
  if (variant.side !== "none") {
    const tries = bands.map((b, i) => ({ b, i })).filter(({ i }) => i !== heroBand || nb === 1).sort((p, q) => (q.b.bot - q.b.run) - (p.b.bot - p.b.run));
    for (const { b, i } of [...tries, { b: hb, i: heroBand }]) {
      const room = b.bot - (b.run + 1);   // 길 남쪽 줄 수
      if (room < 5) continue;
      const a = i === 0 ? (low === "south" || low === "north" ? lowEnd.x : low === "west" ? 0 : W - 2) : cuts[i - 1]!.col;
      const d = cuts[i]?.col ?? (high === "north" || high === "south" ? highEnd.x : high === "west" ? 0 : W - 2);
      const lo = Math.min(a, d), hi = Math.max(a, d);
      // 길에서 남쪽으로 두 칸 내려간 4×3 빈터 — 아래 띠에서 올라오는 계단 열과 겹치지 않게
      const below = i > 0 ? cuts[i - 1]!.col : low === "south" ? lowEnd.x : -99;
      const xs: number[] = []; for (let x = Math.max(3, lo - 5); x <= Math.min(W - 7, hi + 3); x += 1) if (x + 5 < below - 1 || x - 1 > below + 2) xs.push(x);
      if (!xs.length) continue;
      const x0 = xs[ri(0, xs.length - 1)]!, y0 = b.run + 3;
      if (x0 + 1 < lo) hline(b.run, x0 + 1, lo); else if (x0 + 1 > hi) hline(b.run, hi, x0 + 1);
      for (const y of [b.run + 2]) { put(x0 + 1, y); put(x0 + 2, y); }
      clearings.push({ x: x0, y: y0, w: 4, h: 3 });
      sideAt = { x: x0 + 1, y: y0 + 1 }; sideKind = variant.side;
      if (variant.side === "rest") { want(flat ? "bd-rt-sp-lantern" : "bd-prop-bench_wood", flat ? x0 : x0 + 1, flat ? y0 + 1 : y0 + 2); want(flat ? "bd-rt-sp-shroom-m" : "bd-pick-deep-forest-path-campfire", x0 + 3, flat ? y0 + 1 : y0 + 1); }
      else if (variant.side === "lookout") { want("bd-rt-mt-rail", x0, y0 + 2); want("bd-pick-mountain-pass-trail-post", x0 + 3, y0 + 1); }
      break;
    }
    if (!sideAt) warnings.push("곁가지(막다른 자리)를 낼 띠가 없다 — 길 남쪽으로 다섯 줄이 남는 띠가 없다.");
  }

  // ---------- 7. 물·길 칠하기 ----------
  const size = N;
  const canal = tileset.autotileGroups?.find((g) => g.id === "beodeul_canal_lake_47");
  const fullWater = canal?.variantMap?.["255"] ?? -1;
  for (let c = 0; c < size; c += 1) if (water[c] && fullWater >= 0) map.lowerTiles[c] = fullWater;
  // 못(늪 짜임): 길에서 두 칸 떨어진 둥근 물 서너 곳
  if (variant.layout === "bog" && fullWater >= 0) {
    for (let k = 0; k < 5; k += 1) {
      const at = order[Math.floor(((k + 0.7) / 5.4) * (order.length - 1))]!; const ax = at % W, ay = (at - ax) / W;
      const dir = k % 2 === 0 ? -1 : 1, pcx = ax + dir * ri(5, 6) + (dir > 0 ? 1 : 0), pcy = ay + ri(-1, 1), rx = 2 + rnd() * 1.4, ry = 1.5 + rnd();
      for (let y = Math.floor(pcy - ry); y <= Math.ceil(pcy + ry); y += 1) for (let x = Math.floor(pcx - rx); x <= Math.ceil(pcx + rx); x += 1) {
        if (!inMap(x, y) || x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
        if (((x - pcx) / rx) ** 2 + ((y - pcy) / ry) ** 2 > 1) continue;
        let near = false; for (let dy = -2; dy <= 2 && !near; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (road.has(idx(x + dx, y + dy))) { near = true; break; }
        if (!near) { water[idx(x, y)] = 1; map.lowerTiles[idx(x, y)] = fullWater; }
      }
      blob.push({ cx: pcx, cy: pcy, rx: rx + 2, ry: ry + 2 });
    }
  }
  if (!flat) {
    const cells = [...road].filter((c) => !bridge[c]).sort((a, b) => a - b);
    for (let i = 0; i < cells.length;) {
      const start = cells[i]!, y = Math.floor(start / W); let end = start;
      while (i + 1 < cells.length && cells[i + 1] === end + 1 && Math.floor(cells[i + 1]! / W) === y) { i += 1; end = cells[i]!; }
      i += 1;
      fill.run(project, { mapId: map.id, rect: { x: start % W, y, w: end - start + 1, h: 1 }, material: BEODEUL_SAND_PATH });
    }
  }
  // 다리: 틈 위는 가운데 조각, 두 둑 끝 칸은 끝 조각
  const deck = SKINS.bridge[flat ? "vine" : "rope"];
  for (const g of gaps) {
    for (let y = g.top - 1; y <= g.top + g.rows; y += 1) for (const dx of [0, 1]) {
      const c = idx(g.col + dx, y); if (!inMap(g.col + dx, y)) continue;
      const part = y === g.top - 1 ? 0 : y === g.top + g.rows ? 2 : 1;
      const t = deck?.[part]?.[dx] ?? -1;
      if (t >= 0) { map.lowerTiles[c] = t; road.add(c); water[c] = 0; }
      if (part === 1) { bridge[c] = 1; } else bridge[c] = 0;
    }
    if (!deck) warnings.push("다리 조각이 칩셋에 없다 — 틈 위에 길이 놓이지 않았다.");
    else site ??= { x: g.col, y: g.top - 1, w: 2, h: g.rows + 2 };
    heroFront ??= { x: g.col, y: g.top + g.rows + 1 };
  }

  // ---------- 8. 찍기(볼거리·곁가지·줄 세우기) ----------
  const stampAt = (kit: string, x: number, y: number): boolean => {
    try { stamp.run(project, { objectId: `kit:${tileset.id}/${kit}`, mapId: map.id, x, y }); return true; } catch { return false; }
  };
  let heroPlaced = 0;
  for (const p of placements) if (stampAt(p.kit, p.x, p.y)) heroPlaced += 1; else warnings.push(`${p.kit} 를 (${p.x},${p.y}) 에 놓지 못했다.`);
  if (missing.size) warnings.push(`칩셋에 없는 킷: ${[...missing].join(", ")}`);
  const blockedByStamp = (c: number): boolean => !isPassable(project, map, c % W, Math.floor(c / W));
  // 길 따라 줄 세우기: 길 가운데 줄을 따라 네 칸마다, 길 바깥 한 칸 떨어진 자리에 번갈아
  const lineSpots: Cell[] = [];
  if (hero.site === "line") {
    let n = 0;
    for (let k = 3; k < order.length - 3; k += 4) {
      const c = order[k]!, x = c % W, y = (c - x) / W;
      const vertical = road.has(idx(x, y - 1)) && road.has(idx(x, y + 1)) && !road.has(idx(x - 1, y));
      const sideSign = n % 2 === 0 ? -1 : 1;
      const it = hero.items[n % hero.items.length]!, kd = kitOf(it.kit); if (!kd) { missing.add(it.kit); continue; }
      const px = vertical ? (sideSign < 0 ? x - 1 - kd.width : x + 3) : x, py = vertical ? y - kd.height + 1 : (sideSign < 0 ? y - 1 - kd.height : y + 3);
      let ok = px >= 1 && py >= 1 && px + kd.width <= W - 1 && py + kd.height <= H - 1;
      const L = ok ? lv[idx(px, py + kd.height - 1)]! : 0;
      for (let j = 0; ok && j < kd.height; j += 1) for (let i = 0; i < kd.width; i += 1) { const q = idx(px + i, py + j); if (road.has(q) || water[q] || bridge[q] || lv[q] !== L || lv[c] !== L) { ok = false; break; } }
      if (ok && stampAt(it.kit, px, py)) { lineSpots.push({ x: px, y: py + kd.height - 1 }); clearings.push({ x: px, y: py, w: kd.width, h: kd.height }); n += 1; heroPlaced += 1; }
    }
    if (lineSpots.length) { const m = lineSpots[Math.floor(lineSpots.length / 2)]!; site = { x: m.x, y: m.y, w: 1, h: 1 }; heroFront ??= (() => { const c = order[Math.floor(order.length / 2)]!; return { x: c % W, y: Math.floor(c / W) }; })(); }
    else warnings.push(`«${hero.ko}» 를 길 따라 세울 자리가 없다.`);
  }

  // ---------- 9. 숲 ----------
  const reserved = new Set<number>();
  const reserve = (x: number, y: number, r: number) => { for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) if (inMap(x + dx, y + dy)) reserved.add(idx(x + dx, y + dy)); };
  const verge = variant.cover === "open" ? 4 : variant.cover === "canopy" ? 1 : flat ? 4 : 2;
  for (const c of road) reserve(c % W, Math.floor(c / W), verge);
  for (const e of [lowEnd, highEnd]) reserve(e.x, e.y, 2);
  for (const r of clearings) for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) if (inMap(x, y)) reserved.add(idx(x, y));
  for (const b of blob) for (let y = Math.floor(b.cy - b.ry); y <= Math.ceil(b.cy + b.ry); y += 1) for (let x = Math.floor(b.cx - b.rx); x <= Math.ceil(b.cx + b.rx); x += 1) if (inMap(x, y) && ((x - b.cx) / b.rx) ** 2 + ((y - b.cy) / b.ry) ** 2 <= 1) reserved.add(idx(x, y));
  // 단이 바뀌는 칸 둘레(절벽 면·끝)와 물가에는 숲을 심지 않는다 — 수관이 절벽 줄에 썰린다
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const c = idx(x, y);
    if (water[c] || bridge[c]) { reserve(x, y, 1); continue; }
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]] as const) if (inMap(x + dx, y + dy) && lv[idx(x + dx, y + dy)] !== lv[c]) { reserve(x, y, 1); reserve(x + dx, y + dy, 1); }
  }
  // 문 양옆은 숲이 바짝 붙는다(돌아가지 못하게)
  if (gate) for (let y = gate.y; y < gate.y + gate.h; y += 1) for (let x = gate.x - 4; x < gate.x + gate.w + 4; x += 1) {
    if (!inMap(x, y) || (x >= gate.x && x < gate.x + gate.w)) continue;
    const c = idx(x, y); if (!road.has(c)) reserved.delete(c);
  }
  let treeCells = 0;
  if (flat) treeCells = plantSpiritCanopy(map, tileset, reserved, seed);
  else treeCells = plantBeodeulForestWall(project, map, tileset, reserved, rnd, stamp, "broadleaf", "woodland");

  // 트인 띠의 나무: 전나무·소나무(산) 또는 정령 나무(정령 숲)를 길에서 두 칸 넘게 떨어진 빈 풀밭에
  const standing = flat ? ["bd-rt-sp-tree-a", "bd-rt-sp-tree-c", "bd-rt-sp-tree-b", "bd-rt-sp-tree-c"]
    : variant.cover === "canopy" ? [] : ["bd-pick-coast-cliff-road-fir-l", "bd-pick-coast-cliff-road-fir-m", "bd-pick-coast-cliff-road-fir-m2", "bd-pick-mining-valley-fir", "bd-pick-coast-cliff-road-fir-s"];
  const openCell = (c: number): boolean => reserved.has(c) && !road.has(c) && !water[c] && !bridge[c] && map.lowerTiles[c] === BEODEUL_PLAIN_GRASS && ([2, 3, 4] as const).every((L) => layerTileAt(map, L, c) < 0);
  const inClearing = (x: number, y: number): boolean => clearings.some((r) => x >= r.x - 1 && x < r.x + r.w + 1 && y >= r.y - 1 && y < r.y + r.h + 1) || blob.some((b) => ((x - b.cx) / b.rx) ** 2 + ((y - b.cy) / b.ry) ** 2 <= 1);
  const nearRoad = (x: number, y: number, r: number): boolean => { for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) if (road.has(idx(x + dx, y + dy)) && inMap(x + dx, y + dy)) return true; return false; };
  if (standing.length) {
    const every = flat ? 1.6 : variant.cover === "open" ? 5 : 3;
    for (let y = 2; y < H - 2; y += 1) for (let x = 1; x < W - 3; x += 1) {
      if (hash01(x, y, seed + 31) > 1 / (every * 2.2)) continue;
      const id = standing[Math.floor(hash01(x, y, seed + 5) * standing.length)]!, kd = kitOf(id); if (!kd) continue;
      const top = y - kd.height + 1; if (top < 0 || x + kd.width > W) continue;
      const L = lv[idx(x, y)]!; let ok = true;
      for (let i = 0; ok && i < kd.width; i += 1) { const c = idx(x + i, y); if (!openCell(c) || lv[c] !== L || nearRoad(x + i, y, 1) || inClearing(x + i, y) || (y + 1 < H && lv[idx(x + i, y + 1)] !== L)) ok = false; }
      for (let j = 0; ok && j < kd.height - 1; j += 1) for (let i = 0; i < kd.width; i += 1) { const c = idx(x + i, top + j); if (road.has(c) || water[c] || bridge[c] || lv[c] !== L || inClearing(x + i, top + j)) { ok = false; break; } }
      if (ok && stampAt(id, x, top)) x += kd.width;
    }
  }

  // ---------- 10. 길섶·빈터 꾸밈 ----------
  if (!flat) dressBeodeulVerge(project, map, tileset, road, reserved, rnd, stamp);
  { const decal = /leaves|petals|snow-patch|fairy-ring/u;
    const pool = variant.dress.filter((id) => kitOf(id));
    if (pool.length) for (let y = 2; y < H - 3; y += 1) for (let x = 2; x < W - 3; x += 1) {
      const c = idx(x, y);
      if (hash01(x, y, seed + 77) > (variant.cover === "open" ? 0.045 : 0.07)) continue;
      const id = pool[Math.floor(hash01(x, y, seed + 9) * pool.length)]!, kd = kitOf(id)!;
      const flatKit = decal.test(id);
      const L = lv[c]!; let ok = !inClearing(x, y) || flatKit;
      for (let j = 0; ok && j < kd.height; j += 1) for (let i = 0; i < kd.width; i += 1) {
        const q = idx(x + i, y + j);
        if (!inMap(x + i, y + j) || lv[q] !== L || water[q] || bridge[q] || ramps[q] || (!flatKit && (road.has(q) || !openCell(q))) || (flatKit && !(road.has(q) || openCell(q))) || map.events.some((e) => e.x === x + i && e.y === y + j)) { ok = false; break; }
      }
      // 서 있는 것은 길 바로 옆 칸을 막지 않는다(두 칸 폭 길은 그대로) — 발치 줄이 길에서 한 칸 넘게 떨어진 곳만
      if (ok && !flatKit && kd.height === 1 && kd.width === 1 && nearRoad(x, y, 0)) ok = false;
      if (ok && stairsAt.some((s) => Math.abs(s.x - x) <= 3 && Math.abs(s.y - y) <= 2)) ok = false;
      if (ok) stampAt(id, x, y);
    } }

  // ---------- 11. 바닥 ----------
  if (flat) laySpiritFloor(map, road, water, bridge, seed);
  else {
    const woodland = beodeulWoodlandGrass(project, tileset);
    if (woodland >= 0) for (let i = 0; i < size; i += 1) if (map.lowerTiles[i] === BEODEUL_PLAIN_GRASS) map.lowerTiles[i] = woodland;
    layBeodeulGroundCover(project, map, look, { seed: (W * 31 + H * 17 + road.size * 7) | 0, road: (c) => road.has(c) });
  }
  if (water.some((v) => v)) relayBeodeulWaterSurface(map, tileset, seed);

  // ---------- 12. 높이·돌계단 ----------
  let stairs = 0;
  if (!flat) {
    const steps: { x: number; y: number }[] = stairsAt.map((s) => ({ x: s.x, y: s.y }));
    if (knollStairs) steps.push(knollStairs);
    for (const s of steps) for (const dx of [0, 1]) { const c = idx(s.x + dx, s.y); ramps[c] = rampCode("n", true); }
    for (let c = 0; c < N; c += 1) if (bridge[c]) ramps[c] = RELIEF_BRIDGE;
    if (lv.some((v) => v > 0)) {
      map.relief = { width: W, height: H, levels: Array.from(lv), ramps: ramps.slice(), style: tilesetLookReliefStyle(tileset.id, look, "grass-steps") };
      invalidateReliefSlopes(map.relief);
      const mp = kitOf("bd-mpart-stairs");
      for (const s of steps) for (const dx of [0, 1]) {
        const c = idx(s.x + dx, s.y), t = mp?.rows[1]?.tiles?.[dx === 0 ? 1 : 3] ?? -1;
        if (t >= 0) { map.lowerTiles[c] = t; for (const L of [2, 3, 4] as const) setLayerTileAt(map, L, c, -1); }
        stairs += 1;
      }
    }
  }

  // ---------- 13. 닿는 길: 문을 돌아가는 틈과 닿지 않는 걷는 칸을 막는다 ----------
  const entry = swapped ? highEnd : lowEnd, exit = swapped ? lowEnd : highEnd;
  const blockers = (flat ? ["bd-rt-sp-shroom-s", "bd-rt-sp-stone-b"] : ["bd-pick-mountain-pass-boulder-m", "bd-pick-deep-forest-path-stump"]).filter((id) => kitOf(id));
  const flood = (from: Cell, wall?: ReadonlySet<number>): Set<number> => {
    const seen = new Set<number>([idx(from.x, from.y)]), q = [idx(from.x, from.y)];
    for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy, n = idx(nx, ny);
        if (!inMap(nx, ny) || seen.has(n) || wall?.has(n) || !canMove(project, map, x, y, nx, ny)) continue; seen.add(n); q.push(n); } }
    return seen;
  };
  const plug = (x: number, y: number): boolean => {
    if (!inMap(x, y) || !isPassable(project, map, x, y)) return false;
    for (const id of blockers) { const kd = kitOf(id)!; if (kd.width === 1 && kd.height === 1 && stampAt(id, x, y) && !isPassable(project, map, x, y)) return true; }
    // 놓기 규칙에 걸려 못 찍은 자리는 그 킷의 칸을 3층에 바로 둔다(막힌 칸 하나)
    for (const id of blockers) { const kd = kitOf(id)!; const t = kd.rows[kd.height - 1]?.upperTiles?.[0] ?? -1; if (kd.width === 1 && t >= 0 && tileset.passability[t] && !tileset.passability[t]!.up) { setLayerTileAt(map, 3, idx(x, y), t); return !isPassable(project, map, x, y); } }
    return false;
  };
  let sealed = 0;
  if (gate) {
    const yb = gate.y + gate.h - 1, wall = new Set(gate.gap.map((g) => idx(gate!.x + g, yb)));
    for (let guard = 0; guard < 40 && flood(entry, wall).has(idx(exit.x, exit.y)); guard += 1) {
      // 문 아랫줄을 따라 바깥으로 걸을 수 있는 칸을 한 칸씩 막는다
      let did = false;
      for (const dir of [-1, 1]) for (let x = dir < 0 ? gate.x - 1 : gate.x + gate.w; x >= 0 && x < W; x += dir) { if (isPassable(project, map, x, yb)) { if (!road.has(idx(x, yb)) && plug(x, yb)) { did = true; sealed += 1; } break; } }
      if (!did) { warnings.push(`«${hero.ko}» 를 돌아가는 틈을 다 막지 못했다.`); break; }
    }
  }
  { const seen = flood(entry);
    if (!seen.has(idx(exit.x, exit.y))) warnings.push(`가장자리 (${entry.x},${entry.y}) → (${exit.x},${exit.y}) 가 걸어서 이어지지 않는다.`);
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const c = idx(x, y);
      if (seen.has(c) || !isPassable(project, map, x, y)) continue;
      if (plug(x, y)) sealed += 1;
    } }

  // ---------- 14. 빈 자리(적·사람·사건) ----------
  const reach = flood(entry);
  const busy: Cell[] = [entry, exit, ...(heroFront ? [heroFront] : []), ...(sideAt ? [sideAt] : []), ...stairsAt.map((s) => ({ x: s.x, y: s.y }))];
  for (const g of gaps) busy.push({ x: g.col, y: g.top + Math.floor(g.rows / 2) });
  if (gate) busy.push({ x: gate.x + gate.gap[0]!, y: gate.y + gate.h - 1 });
  const enemySpots: Cell[] = [];
  for (const f of [0.22, 0.42, 0.62, 0.82]) {
    let best: { c: Cell; d: number } | undefined;
    for (let k = 0; k < order.length; k += 1) {
      const c = order[k]!; if (!road.has(c) || !reach.has(c) || ramps[c]) continue;
      const cell = { x: c % W, y: Math.floor(c / W) };
      if (busy.some((b) => Math.abs(b.x - cell.x) + Math.abs(b.y - cell.y) <= 3) || enemySpots.some((o) => Math.abs(o.x - cell.x) + Math.abs(o.y - cell.y) <= 5)) continue;
      const d = Math.abs(k - f * (order.length - 1));
      if (!best || d < best.d) best = { c: cell, d };
    }
    if (best) enemySpots.push(best.c);
  }
  if (heroFront && !reach.has(idx(heroFront.x, heroFront.y))) heroFront = undefined;
  if (sideAt && !reach.has(idx(sideAt.x, sideAt.y))) { sideAt = undefined; sideKind = "none"; }
  void blockedByStamp;
  return { entry, exit, roadCells: road.size, treeCells, stairs, sealed, ...(site && (heroPlaced > 0 || hero.site === "bridge") ? { heroAt: site } : {}), ...(heroFront ? { heroFront } : {}), ...(sideAt ? { sideAt } : {}), sideKind, enemySpots, warnings };
}

/** 정령 숲의 숲 벽: 버들항 수관 오토타일과 같은 모양 규칙으로 칸을 고르고, 그 칸을 정령 숲 빛깔의 수관 칸(구운 표)으로 쓴다. 수관 막힘·그늘 통행은 구운 칸이 가진다. */
function plantSpiritCanopy(map: GameMap, tileset: TilesetDef, reserved: ReadonlySet<number>, seed: number): number {
  const W = map.width, H = map.height;
  const empty = (c: number): boolean => ([2, 3, 4] as const).every((L) => layerTileAt(map, L, c) < 0);
  const plantable = (c: number): boolean => !reserved.has(c) && map.lowerTiles[c] === BEODEUL_PLAIN_GRASS && empty(c);
  const forest = new Set<number>();
  for (let c = 0; c < W * H; c += 1) if (plantable(c)) forest.add(c);
  shapeBeodeulCanopyMask(W, H, forest, { canFill: plantable, minComponent: 16, minExtent: 4, minInterior: 0.15, block: 2 });
  const table = SKINS.spirit.canopy;
  if (!table.length) return 0;
  const isF = (x: number, y: number): boolean => x < 0 || y < 0 || x >= W || y >= H || forest.has(y * W + x);
  const plan = { canopy: forest };
  let n = 0;
  for (const c of forest) {
    const x = c % W, y = (c - x) / W;
    const mask = (isF(x, y - 1) ? 1 : 0) | (isF(x + 1, y) ? 2 : 0) | (isF(x, y + 1) ? 4 : 0) | (isF(x - 1, y) ? 8 : 0);
    const to = table[mask]?.[(y % 4) * 4 + (x % 4)];
    if (to === undefined || to < 0) continue;
    // 남쪽도 숲인 칸은 3층(위층 묶음), 숲 남쪽 끝 줄은 2층 — 그 앞에 선 인물이 수관 위로 그려진다(버들항 수관과 같은 규칙)
    setLayerTileAt(map, y + 1 < H && forest.has(c + W) ? 3 : 2, c, to); n += 1;
  }
  // 수관 위로 솟은 정령 나무 머리(4층 ★): 나무의 모든 칸과 그 남쪽 두 줄이 숲일 때만 — 걷는 칸을 덮지 않는다
  const kits = new Map((tileset.structureKits ?? []).map((k) => [k.id, k] as const));
  const heads = ["bd-rt-sp-tree-a", "bd-rt-sp-tree-b", "bd-rt-sp-tree-c"].map((id) => kits.get(id)).filter((k): k is StructureKitDef => !!k);
  const taken = new Set<number>();
  if (heads.length) for (let by = 0; by * 3 < H; by += 1) for (let bx = 0; bx * 4 < W; bx += 1) {
    const h = hash01(bx, by, seed + 211);
    if (h < 0.3) continue;
    const kit = heads[Math.floor(hash01(bx, by, seed + 5) * heads.length)]!;
    const x = bx * 4 + Math.floor(hash01(bx, by, seed + 1) * 3), y = by * 3 + Math.floor(hash01(bx, by, seed + 2) * 2);
    let ok = x + kit.width <= W && y + kit.height + 2 <= H;
    for (let j = 0; ok && j < kit.height + 2; j += 1) for (let i = 0; i < kit.width; i += 1) { const c = (y + j) * W + x + i; if (!plan.canopy.has(c) || (j < kit.height && taken.has(c))) { ok = false; break; } }
    if (!ok) continue;
    // 머리(수관)만 얹는다 — 아래 두 줄(줄기·밑동)은 수관 속에 묻힌 것으로 본다
    for (let j = 0; j < kit.height - 2; j += 1) for (let i = 0; i < kit.width; i += 1) {
      const row = kit.rows[j]; const t = (row?.upperTiles?.[i] ?? -1) >= 0 ? row!.upperTiles![i]! : row?.tiles?.[i] ?? -1;
      if (t < 0) continue;
      const c = (y + j) * W + x + i; setLayerTileAt(map, 4, c, t); taken.add(c);
    }
  }
  return n;
}

/** 정령 숲의 바닥: 풀 칸을 이끼 바닥 판 둘(덩이 잡음으로 섞음)로, 길 칸을 «이웃 길» 비트에 맞는 길 칸으로 갈아 깐다. */
function laySpiritFloor(map: GameMap, road: ReadonlySet<number>, water: Uint8Array, bridge: Uint8Array, seed: number): void {
  const W = map.width, H = map.height;
  const ground = SKINS.spirit.ground, path = SKINS.spirit.path;
  if (!ground.length) return;
  const isRoad = (x: number, y: number): boolean => x < 0 || y < 0 || x >= W || y >= H || road.has(y * W + x);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const c = y * W + x, phase = (y % 4) * 4 + (x % 4);
    if (water[c]) continue;
    if (road.has(c)) {
      if (bridge[c] || SKINS.bridge.vine?.some((row) => row.includes(map.lowerTiles[c]!))) continue;
      const mask = (isRoad(x, y - 1) ? 1 : 0) | (isRoad(x + 1, y) ? 2 : 0) | (isRoad(x, y + 1) ? 4 : 0) | (isRoad(x - 1, y) ? 8 : 0);
      const t = path[mask]?.[phase];
      if (t !== undefined && t >= 0) map.lowerTiles[c] = t;
      continue;
    }
    if (map.lowerTiles[c] !== BEODEUL_PLAIN_GRASS) continue;
    // 둘째 판(고사리·토끼풀)은 길에서 한 칸 넘게 떨어진 덩이에만
    const far = ![[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]].some(([dx, dy]) => road.has((y + dy!) * W + x + dx!));
    const tex = far && ground.length > 1 && smoothNoise(x, y, seed + 17, 5) > 0.56 ? 1 : 0;
    map.lowerTiles[c] = ground[tex]![phase]!;
  }
}

export type { RouteHero };
