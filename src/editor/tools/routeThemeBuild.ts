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
import { beodeulWoodlandGrass } from "./beodeulForest";
import { layBeodeulGroundCover } from "./beodeulGroundCover";
import { relayBeodeulWaterSurface } from "./beodeulWater";
import { hash01 } from "./sceneTerrain";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import type { RouteHero, RouteShape, RouteTheme, RouteVariant } from "./routeThemes";
import { CONSTRUCTION_TOOLS_V3 } from "./v3/constructionTools";
import { BEODEUL_PLAIN_GRASS, BEODEUL_SAND_PATH, dressBeodeulVerge, plantBeodeulForestWall } from "./wildRouteBeodeul";

/** 읍의 길 포석(beodeulVillage 의 PAVING 과 같은 재료) — 마을 어귀의 길 끝이 그 마을 길의 급을 따를 때. */
const BEODEUL_PAVED_ROAD = "버들항 길 포석";

export type RouteSideName = "north" | "south" | "east" | "west";
type Cell = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };

interface RouteSkins {
  readonly base: number; readonly end: number;
  readonly spirit: {
    /** 폭포 킷(7×7): lower = 바위턱 바닥(걷는 길 칸), solid = 막힌 그림 칸, veil = 걷는 이 앞에 그리는 물 장막. 없는 칸은 -1. */
    readonly falls?: { readonly lower: readonly (readonly number[])[]; readonly solid: readonly (readonly number[])[]; readonly veil: readonly (readonly number[])[] };
  };
  readonly bridge: Readonly<Record<string, readonly (readonly number[])[]>>;
}
const SKINS = skins as unknown as RouteSkins;

export interface ThemedRouteInput {
  readonly project: Project; readonly map: GameMap; readonly tileset: TilesetDef;
  readonly theme: RouteTheme; readonly variant: RouteVariant;
  /** 길이 닿는 변 1~4개 — 첫째가 들어오는 변. 하나뿐이면 길이 맵 안(볼거리·던전 어귀)에서 끝난다. */
  readonly sides: readonly RouteSideName[];
  readonly seed: number;
  /** 꼴(routeThemes.ROUTE_SHAPES) — 없으면 지나가는 길. */
  readonly shape?: RouteShape;
  /** 던전이 달린 길목: 입구 구조물 킷(없으면 자리만 비워 두고 던전 잇기가 갱구를 찍는다). */
  readonly dungeon?: { readonly kit?: string };
  /** 마을로 이어지는 변과 그 마을 길이 돌 포장인가(정착지의 급). */
  readonly village?: { readonly side: RouteSideName; readonly paved: boolean };
}
export interface ThemedRouteResult {
  readonly entry: Cell; readonly exit: Cell;
  /** 길이 닿은 가장자리 칸(변마다 하나) — 첫째가 들어오는 변. */
  readonly exits: { side: RouteSideName; x: number; y: number }[];
  /** 던전 입구가 설 칸(그 칸 남쪽이 길 끝) — 던전이 달린 길목만. */
  readonly dungeonGate?: Cell;
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

/** 줄기(낮은 끝 → 높은 끝)와 곁길 변 — 땅은 늘 북쪽이 높다(절벽 면이 남쪽을 본다). 변이 하나뿐이면 다른 끝은 맵 안이다(북쪽 변 하나면 낮은 끝이 맵 안). */
function trunkOf(sides: readonly RouteSideName[]): { low?: RouteSideName; high?: RouteSideName; extra: RouteSideName[] } {
  const rank = { south: 0, west: 1, east: 2, north: 3 } as const;
  const uniq = [...new Set(sides)].sort((a, b) => rank[a] - rank[b]);
  if (uniq.length <= 1) return uniq[0] === "north" ? { high: "north", extra: [] } : { low: uniq[0] ?? "south", extra: [] };
  return { low: uniq[0]!, high: uniq[uniq.length - 1]!, extra: uniq.slice(1, -1) };
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
  const { low, high, extra } = trunkOf(input.sides);
  const shape: RouteShape = input.shape ?? "pass";
  const terminal = !low || !high;   // 길이 맵 안에서 끝난다(막다른 길·던전 어귀)

  // ---------- 1. 가로 띠(단·골짜기·내) ----------
  // 남쪽에서 북쪽으로 자름(cut)들: 절벽(rise) 또는 틈(gap — 골짜기·내). 그 사이가 띠(band)이고 띠마다 가로 길(run)이 하나 있다.
  const step = Math.max(1, Math.min(2, tilesetLookCliff(tileset.id, look)?.step ?? 1));
  type Cut = { kind: "cliff" | "gap"; rise: number; rows: number; at: number; col: number };
  const cuts: Cut[] = [];
  const cliff = (rise: number): Cut => ({ kind: "cliff", rise, rows: 0, at: 0, col: 0 });
  // 단 수는 맵 높이가 받는 만큼만. 던전 곁길을 내는 지나가는 길은 띠가 넓어야 한다(입구 자리 열한 줄).
  const tiers = Math.max(1, Math.min(variant.tiers, Math.floor((H - 12) / (input.dungeon && low && high ? 14 : 8))));
  const gapRows = variant.layout === "gorge" ? 6 : variant.hero.site === "bridge" ? variant.hero.h : 4;
  if (variant.layout === "gorge") { cuts.push(cliff(2)); cuts.push({ kind: "gap", rise: 0, rows: gapRows, at: 0, col: 0 }); }
  else if (variant.layout === "brook") { cuts.push({ kind: "gap", rise: 0, rows: gapRows, at: 0, col: 0 }); for (let k = 0; k < tiers; k += 1) cuts.push(cliff(flat ? 0 : step)); }
  else if (variant.layout === "ledge") { cuts.push(cliff(Math.min(3, step + 1))); for (let k = 1; k < tiers; k += 1) cuts.push(cliff(1)); }
  else for (let k = 0; k < tiers; k += 1) cuts.push(cliff(flat ? 0 : tiers >= 4 ? 1 : step));
  const nb = cuts.length + 1;
  const hero = variant.hero;
  const needsSite = hero.site === "beside" || hero.site === "knoll" || hero.site === "center" || hero.site === "behind";
  // 주인공 볼거리가 서는 띠: 가운데쯤(맨 아래·맨 위는 들어오고 나가는 다리 때문에 좁다). 골짜기·내 짜임은 틈 다음 띠.
  let heroBand = Math.min(nb - 1, Math.max(0, Math.round((nb - 1) / 2 + (rnd() - 0.5))));
  if (variant.layout === "gorge" || hero.site === "behind") heroBand = Math.min(nb - 1, 1);
  // 맵 안에서 끝나는 길: 볼거리는 그 끝 띠에. 남·북 곁길이 나가는 끝 띠는 볼거리 띠로 쓰지 않는다.
  if (terminal) heroBand = high ? 0 : nb - 1;
  else if (nb >= 3 && ((extra.includes("north") && heroBand === nb - 1) || (extra.includes("south") && heroBand === 0))) heroBand = 1;
  const ring = hero.site === "center" && !!hero.ring, wide = shape === "wide";
  const need = (i: number): number => (i !== heroBand ? 7 : ring ? hero.h + 11 : wide ? Math.max(14, hero.h + 9) : needsSite ? hero.h + (hero.site === "knoll" ? 9 : 7) : 7);
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
  const straight = (variant.layout === "avenue" || variant.layout === "glade") && !terminal;
  const colLo = 4, colHi = W - 6;
  const mainCol = ri(Math.floor(W * 0.35), Math.floor(W * 0.6));
  let last = variant.layout === "switchback" ? (rnd() < 0.5 ? colLo : colHi) : mainCol;
  cuts.forEach((c, k) => {
    if (straight) c.col = mainCol;
    else if (variant.layout === "switchback") { last = last <= W / 2 ? colHi - ri(0, 2) : colLo + ri(0, 2); c.col = last; }
    else { let col = last; for (let t = 0; t < 12 && Math.abs(col - last) < 6; t += 1) col = ri(colLo, colHi); c.col = k === 0 && variant.layout !== "winding" && variant.layout !== "forks" && rnd() < 0.3 ? last : col; last = c.col; }
  });
  // 폭포 뒤 길: 가로 길이 볼거리(맵 가운데)를 왼쪽에서 오른쪽으로(또는 거꾸로) 꿰뚫는다 — 올라오는 열과 떠나는 열을 볼거리 양옆에 둔다
  const behindX = Math.floor((W - hero.w) / 2);
  if (hero.site === "behind" && cuts.length >= 2) {
    const a = ri(colLo, Math.max(colLo, behindX - 5)), d = ri(Math.min(colHi, behindX + hero.w + 3), colHi), flip = rnd() < 0.5;
    cuts[heroBand - 1]!.col = flip ? d : a; cuts[heroBand]!.col = flip ? a : d;
  }
  // 굽이: 직각으로 꺾이지 않고 길이 좌우·위아래로 흔들린다(돌계단·다리 둘레와 볼거리 띠의 가로 길은 곧게)
  const curvy = (variant.layout === "meander" || variant.layout === "switchback" || variant.layout === "winding") && (hero.site === "beside" || hero.site === "line");
  const amp = curvy ? (flat ? 2 : 1) : 0;
  const lockRow = new Uint8Array(H);
  for (const c of cuts) { const [a, b] = c.kind === "gap" ? [c.at - 3, c.at + c.rows + 2] : c.rise ? [c.at - 3, c.at + 3] : [1, 0]; for (let y = Math.max(0, a); y <= Math.min(H - 1, b); y += 1) lockRow[y] = 1; }
  // 곁가지를 낼 띠(주인공 띠가 아닌 가장 높은 띠)는 가로 길을 띠 위쪽에 둔다 — 길 남쪽에 막다른 빈터 자리가 남는다
  const sideBand = variant.side === "none" ? -1 : bands.map((b, i) => ({ i, h: b.bot - b.top })).filter((v) => v.i !== heroBand || nb === 1).sort((p, q) => q.h - p.h)[0]?.i ?? -1;
  bands.forEach((b, i) => {
    if (i === heroBand && hero.site === "behind") { b.run = Math.max(b.top + 1, Math.min(b.bot - 4, b.top + 4)); return; }
    if (i === sideBand && i !== heroBand && b.bot - b.top >= 9) { b.run = b.top + 2 + ri(0, Math.max(0, Math.min(1, b.bot - b.top - 9))); return; }
    const north = i === heroBand && needsSite ? hero.h + (hero.site === "knoll" ? 6 : 3) : 2;
    const lo = b.top + north, hi = b.bot - 2;
    b.run = hi < lo ? Math.max(b.top + 1, Math.min(b.bot - 1, hi)) : i === heroBand && needsSite ? Math.min(hi, lo + ri(0, 1)) : ri(Math.max(lo, hi - 3), hi);
  });
  const edgeCol = (side: RouteSideName, band: { run: number }, near: number): Cell => side === "south" ? { x: near, y: H - 1 } : side === "north" ? { x: near, y: 0 } : side === "west" ? { x: 0, y: band.run } : { x: W - 1, y: band.run };
  const lowBand = bands[0]!, highBand = bands[nb - 1]!;
  const lowCol = straight ? mainCol : hero.site === "behind" && cuts.length >= 2 ? cuts[0]!.col : ri(colLo, colHi), highCol = straight ? mainCol : hero.site === "behind" && cuts.length >= 2 ? cuts[cuts.length - 1]!.col : ri(colLo, colHi);
  // 맵 안 끝: 높은 끝이면 마지막 계단 열 그대로(볼거리가 길 정면에 선다), 낮은 끝이면 내려온 열에서 옆으로 비켜난 자리(볼거리가 그 북쪽에 선다)
  const inX = (x: number): number => Math.max(colLo + 2, Math.min(colHi - 2, x));
  const off = Math.ceil(hero.w / 2) + 5;
  const highIn = cuts.length ? cuts[cuts.length - 1]!.col : low === "south" ? lowCol : inX(Math.floor(W / 2));
  const lowFrom = cuts.length ? cuts[0]!.col : highCol;
  const lowIn = inX(lowFrom + (lowFrom > W / 2 ? -off : off));
  const lowEnd = low ? edgeCol(low, lowBand, lowCol) : { x: lowIn, y: lowBand.run }, highEnd = high ? edgeCol(high, highBand, highCol) : { x: highIn, y: highBand.run };
  const lowX = low === "west" ? 0 : low === "east" ? W - 2 : lowEnd.x, highX = high === "west" ? 0 : high === "east" ? W - 2 : highEnd.x;

  // ---------- 3. 길 칸 ----------
  const road = new Set<number>();
  const order: number[] = []; // 낮은 끝 → 높은 끝 차례(가운데 줄) — 빈 자리·줄 세우기용
  const put = (x: number, y: number) => { if (inMap(x, y)) { const c = idx(x, y); if (!road.has(c)) { road.add(c); } } };
  // 흔들림 한 줄: 끝 두 칸과 잠긴 칸은 0, 이웃 칸과는 한 칸 넘게 벌어지지 않는다(두 칸 폭 길이 끊기지 않게)
  const swayLine = (n: number, range: readonly [number, number] | undefined, locked: (i: number) => boolean): Int8Array => {
    const o = new Int8Array(n);
    if (!range || !amp || n < 7) return o;
    const phase = rnd() * Math.PI * 2, period = 8 + rnd() * 5;
    for (let i = 0; i < n; i += 1) { const edge = Math.min(i, n - 1 - i); o[i] = edge < 2 || locked(i) ? 0 : Math.max(range[0], Math.min(range[1], Math.round(Math.min(amp, edge - 1) * Math.sin((i / period) * Math.PI * 2 + phase)))); }
    for (let i = 1; i < n; i += 1) o[i] = Math.max(o[i - 1]! - 1, Math.min(o[i - 1]! + 1, o[i]!));
    for (let i = n - 2; i >= 0; i -= 1) o[i] = Math.max(o[i + 1]! - 1, Math.min(o[i + 1]! + 1, o[i]!));
    return o;
  };
  const hline = (y: number, xa: number, xb: number, sway?: readonly [number, number]) => {
    const [x0, x1] = xa <= xb ? [xa, xb] : [xb, xa], n = x1 - x0 + 1, o = swayLine(n, sway, () => false);
    for (let x = x0; x <= Math.min(W - 1, x1 + 1); x += 1) { const d = o[Math.min(n - 1, x - x0)]!; put(x, y + d); put(x, y + d + 1); }
    const dir = xa <= xb ? 1 : -1; for (let x = xa; x !== xb + dir; x += dir) order.push(idx(Math.max(0, Math.min(W - 1, x)), y + o[Math.max(0, Math.min(n - 1, x - x0))]!));
  };
  const vline = (x: number, ya: number, yb: number, sway = false) => {
    const [y0, y1] = ya <= yb ? [ya, yb] : [yb, ya], n = y1 - y0 + 1, o = swayLine(n, sway ? [-amp, amp] : undefined, (i) => lockRow[y0 + i] === 1);
    for (let y = y0; y <= Math.min(H - 1, y1 + 1); y += 1) { const d = o[Math.min(n - 1, y - y0)]!; put(x + d, y); put(x + d + 1, y); }
    const dir = ya <= yb ? 1 : -1; for (let y = ya; y !== yb + dir; y += dir) { const yy = Math.max(0, Math.min(H - 1, y)); order.push(idx(x + o[Math.max(0, Math.min(n - 1, yy - y0))]!, yy)); }
  };
  // 띠 k 의 가로 길이 위아래로 흔들릴 수 있는 폭 — 볼거리 띠는 곧게(자리·앞 칸이 그 줄에 맞춰 있다), 산길은 띠의 단 안에서만
  const swayOf = (k: number): readonly [number, number] | undefined => {
    if (!amp || k === heroBand) return undefined;
    const b = bands[k]!;
    return flat ? [-amp, amp] : [-Math.max(0, Math.min(1, b.run - (b.top + 1))), Math.max(0, Math.min(1, b.bot - 1 - (b.run + 1)))];
  };
  // 낮은 끝에서 첫 띠의 가로 길까지
  let cx = lowEnd.x, cy = lowEnd.y;
  if (low === "south") { vline(cx, cy, lowBand.run, curvy); cy = lowBand.run; } else if (low === "north") { vline(cx, 0, lowBand.run, curvy); cy = lowBand.run; } else cy = lowBand.run;
  cuts.forEach((c, k) => {
    const next = bands[k + 1]!;
    hline(cy, cx, c.col, swayOf(k)); cx = c.col;
    vline(cx, cy, next.run, curvy); cy = next.run;
  });
  if (high === "north") { hline(cy, cx, highEnd.x, swayOf(nb - 1)); vline(highEnd.x, cy, 0, curvy); }
  else if (high === "south") { hline(cy, cx, highEnd.x, swayOf(nb - 1)); vline(highEnd.x, cy, H - 1, curvy); }
  else if (high) hline(cy, cx, highEnd.x === 0 ? 0 : W - 2, swayOf(nb - 1));
  else hline(cy, cx, highEnd.x);
  if (high === "east" || low === "east") for (const y of [high === "east" ? highBand.run : lowBand.run]) { put(W - 1, y); put(W - 1, y + 1); }
  // 곁길(세 갈래·네거리): 동·서 변은 볼거리 띠가 아닌 띠의 가로 길을 맵 끝까지 늘이고, 남·북 변은 맨 아래·맨 위 띠의 가로 길에서 곧게 낸다(절벽을 넘지 않는다)
  const ends: { side?: RouteSideName; cell: Cell }[] = [{ ...(low ? { side: low } : {}), cell: lowEnd }, { ...(high ? { side: high } : {}), cell: highEnd }];
  const spanOf = (k: number): [number, number] => { const a = k === 0 ? lowX : cuts[k - 1]!.col, d = cuts[k]?.col ?? highX; return [Math.min(a, d), Math.max(a, d)]; };
  const branchBands = new Set<number>();
  for (const sd of extra) {
    if (sd === "west" || sd === "east") {
      const free = bands.map((_, i) => i).filter((i) => i !== heroBand && !branchBands.has(i));
      const k = free.length ? free[ri(0, free.length - 1)]! : bands.findIndex((_, i) => !branchBands.has(i));
      const b = bands[Math.max(0, k)]!, [a, d] = spanOf(Math.max(0, k)); branchBands.add(k);
      if (sd === "west") hline(b.run, a, 0); else { hline(b.run, d, W - 2); put(W - 1, b.run); put(W - 1, b.run + 1); }
      ends.push({ side: sd, cell: { x: sd === "west" ? 0 : W - 1, y: b.run } });
    } else {
      const k = sd === "north" ? nb - 1 : 0, b = bands[k]!, [a, d] = spanOf(k);
      const opts = [d - a >= 12 ? Math.round((a + d) / 2) : -1, d + 7, a - 7].filter((x) => x >= colLo && x <= colHi);
      const col = opts[0] ?? inX(Math.round(W / 2));
      if (col < a) hline(b.run, col, a); else if (col > d) hline(b.run, d, col);
      vline(col, b.run, sd === "north" ? 0 : H - 1);
      ends.push({ side: sd, cell: { x: col, y: sd === "north" ? 0 : H - 1 } });
    }
  }

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
  const leaving = cuts[heroBand]?.col ?? highX;   // 이 띠에서 위로 떠나는 열
  const arriving = heroBand === 0 ? lowX : cuts[heroBand - 1]!.col;
  const runLo = Math.min(arriving, leaving), runHi = Math.max(arriving, leaving) + 1;
  let site: Rect | undefined, heroFront: Cell | undefined, knoll: Rect | undefined, knollStairs: Cell | undefined, dungeonGate: Cell | undefined;
  const clearings: Rect[] = [];
  const blob: { cx: number; cy: number; rx: number; ry: number }[] = [];
  const placements: { kit: string; x: number; y: number }[] = [];
  const kitOf = (id: string): StructureKitDef | undefined => kits.get(id);
  const missing = new Set<string>();
  const want = (id: string, x: number, y: number) => { if (kitOf(id)) placements.push({ kit: id, x, y }); else missing.add(id); };
  // 던전 어귀: 입구 칸(gate) 북쪽에 입구 구조물(주어졌을 때 — 발치 줄이 gate 바로 위), 양옆에 화로·표지·수레·상자. 구조물이 없으면 자리만 비워 둔다(던전 잇기가 갱구를 찍는다).
  const mouthAt = (gx: number, gy: number): Cell => {
    const kd = input.dungeon?.kit ? kitOf(input.dungeon.kit) : undefined;
    if (kd) want(kd.id, gx + 1 - Math.ceil(kd.width / 2), gy - kd.height);
    const dress: [string, number, number][] = [["bd-pick-mountain-pass-brazier", gx - 4, gy - 1], ["bd-pick-mountain-pass-brazier", gx + 5, gy - 1], ["bd-out-signpost", gx + 4, gy], ["bd-obj-broken-cart", gx - 6, gy], ["bd-pick-mining-valley-crates", gx + 6, gy - 2]];
    for (const [id, x, y] of dress) { const k = kitOf(id); if (k && x >= 2 && y >= 2 && x + k.width <= W - 2 && y + k.height <= H - 2) placements.push({ kit: id, x, y }); }
    clearings.push({ x: gx - 7, y: gy - 6, w: 15, h: 9 });
    return { x: gx, y: gy };
  };
  if (hero.site === "beside" || hero.site === "knoll") {
    const up = hero.site === "knoll" ? 3 : 1;   // 길과 자리 사이 줄 수(둔덕은 층계참·계단·둔덕 앞마당)
    const y1 = hb.run - 1 - up, y0 = y1 - hero.h + 1;
    const termX = !high ? highEnd.x : !low ? lowEnd.x : undefined;   // 맵 안에서 끝나는 길의 끝 열 — 볼거리가 그 정면에 선다
    const fits = (x0: number): boolean => x0 >= 2 && x0 + hero.w <= W - 2 && (!high || x0 + hero.w + 1 < leaving - 1 - amp || x0 - 1 > leaving + 2 + amp);
    const fx = (x0: number): number => x0 + Math.floor(hero.w / 2);
    const cands: number[] = [];
    for (let x0 = 2; x0 + hero.w <= W - 2; x0 += 1) if (fits(x0)) cands.push(x0);
    const mid = (runLo + runHi) / 2;
    if (termX !== undefined) cands.sort((a, b) => Math.abs(fx(a) - termX - 0.5) - Math.abs(fx(b) - termX - 0.5));
    else cands.sort((a, b) => (fx(a) >= runLo && fx(a) <= runHi ? 0 : 100) + Math.abs(fx(a) - mid) - ((fx(b) >= runLo && fx(b) <= runHi ? 0 : 100) + Math.abs(fx(b) - mid)));
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
      // 길 끝 마당: 볼거리 앞에 둥근 빈터
      if (termX !== undefined) blob.push({ cx: termX + 1, cy: hb.run + 0.5, rx: Math.max(4.5, hero.w / 2 + 1.5), ry: 3 });
      if (hero.id === "dungeon-mouth" && termX !== undefined) dungeonGate = mouthAt(termX, hb.run - 1);
    } else warnings.push(`주인공 볼거리 «${hero.ko}» 자리를 내지 못했다(띠가 좁다).`);
  } else if (hero.site === "center") {
    // 띠를 지나는 세로 길 한가운데의 둥근 빈터 — 밟는 그림이면 길이 그 위로, 막힌 것이면 빈터가 둘레로 돌아간다
    const col = heroBand === 0 ? cuts[0]?.col ?? mainCol : cuts[heroBand - 1]!.col;
    const cyc = hero.ring ? Math.round((hb.top + hb.bot) / 2) : Math.round((hb.top + hb.run) / 2) + 1;
    const x0 = col + 1 - Math.floor(hero.w / 2), y0 = cyc - Math.floor(hero.h / 2);
    site = { x: x0, y: y0, w: hero.w, h: hero.h };
    blob.push({ cx: col + 1, cy: cyc + 0.5, rx: hero.w / 2 + 3, ry: hero.h / 2 + 2.6 });
    heroFront = { x: col, y: y0 + hero.h };
    for (const it of hero.items) want(it.kit, x0 + it.dx, y0 + it.dy);
    if (hero.water) {
      // 둥근 못(버들항 물) — 자리 안의 타원
      const rx = hero.w / 2, ry = hero.h / 2, mx = x0 + rx, my = y0 + ry;
      for (let y = y0; y < y0 + hero.h; y += 1) for (let x = x0; x < x0 + hero.w; x += 1) if (((x + 0.5 - mx) / rx) ** 2 + ((y + 0.5 - my) / ry) ** 2 <= 1) water[idx(x, y)] = 1;
    }
    if (hero.ring) {
      // 고리 길: 볼거리를 한 바퀴 돈다(두 칸 폭 네모 고리) — 줄기는 고리 위·아래 변에서 이어진다
      blob[blob.length - 1] = { cx: col + 1, cy: cyc + 0.5, rx: hero.w / 2 + 5.5, ry: hero.h / 2 + 5 };
      for (let y = y0 - 1; y <= y0 + hero.h; y += 1) for (let x = x0 - 1; x <= x0 + hero.w; x += 1) road.delete(idx(x, y));
      for (let y = y0 - 3; y <= y0 + hero.h + 2; y += 1) for (const x of [x0 - 3, x0 - 2, x0 + hero.w + 1, x0 + hero.w + 2]) put(x, y);
      for (let x = x0 - 3; x <= x0 + hero.w + 2; x += 1) for (const y of [y0 - 3, y0 - 2, y0 + hero.h + 1, y0 + hero.h + 2]) put(x, y);
      heroFront = { x: col, y: y0 + hero.h + 1 };
    } else if (!hero.walkOver) {
      for (let y = y0 - 1; y <= y0 + hero.h; y += 1) for (let x = x0 - 1; x <= x0 + hero.w; x += 1) road.delete(idx(x, y));
      // 빈터 둘레를 도는 길(왼쪽)
      for (let y = y0 - 2; y <= y0 + hero.h + 1; y += 1) { put(x0 - 2, y); put(x0 - 3, y); }
      for (let x = x0 - 3; x <= col + 1; x += 1) { put(x, y0 - 2); put(x, y0 - 3); put(x, y0 + hero.h + 1); put(x, y0 + hero.h + 2); }
    }
  }
  // 폭포 뒤 길: 킷의 바위턱 두 줄이 볼거리 띠의 가로 길 줄에 놓인다. 킷 위·옆·못 아래는 숲이 바짝 붙는다(못을 돌아가는 길이 없다).
  let falls: Rect | undefined;
  const forcedForest: number[] = [];
  if (hero.site === "behind") {
    const x0 = behindX, y0 = hb.run - 3;
    if (SKINS.spirit.falls && y0 >= 1 && y0 + hero.h <= H - 2 && Math.min(arriving, leaving) < x0 - 1 && Math.max(arriving, leaving) > x0 + hero.w) {
      falls = site = { x: x0, y: y0, w: hero.w, h: hero.h };
      heroFront = { x: arriving < x0 ? x0 - 1 : x0 + hero.w, y: hb.run };
      clearings.push({ x: x0, y: y0, w: hero.w, h: hero.h });
      for (let y = y0 - 2; y < y0 + hero.h + 2; y += 1) for (let x = x0 - 2; x < x0 + hero.w + 2; x += 1) {
        const inside = x >= x0 && x < x0 + hero.w && y >= y0 && y < y0 + hero.h, ledge = y === y0 + 3 || y === y0 + 4;
        if (inMap(x, y) && !inside && !ledge) forcedForest.push(idx(x, y));
      }
    } else warnings.push(`«${hero.ko}» 자리를 내지 못했다(맵이 좁거나 폭포 그림이 칩셋에 없다).`);
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
  const hitsRect = (x: number, y: number, w: number, h: number, pad: number): boolean =>
    clearings.some((r) => x < r.x + r.w + pad && x + w + pad > r.x && y < r.y + r.h + pad && y + h + pad > r.y)
    || (!!site && x < site.x + site.w + pad + 1 && x + w + pad + 1 > site.x && y < site.y + site.h + pad + 1 && y + h + pad + 1 > site.y)
    || blob.some((b) => x - pad <= b.cx + b.rx && x + w + pad >= b.cx - b.rx && y - pad <= b.cy + b.ry && y + h + pad >= b.cy - b.ry);
  // 세로 길에서 옆으로 세 칸 나간 4×3 빈터 — 가로 길 남쪽에 자리가 없는 짜임(곧은 길·빈터 길)과 갈림길이 쓴다
  const lateral = (): Cell | undefined => {
    const first = rnd() < 0.5 ? -1 : 1;
    for (const f of [0.3, 0.7, 0.5, 0.2, 0.8, 0.4, 0.6, 0.12, 0.88, 0.25, 0.75, 0.35, 0.65]) for (const dir of [first, -first]) {
      const c = order[Math.floor(f * (order.length - 1))]; if (c === undefined) continue;
      const x = c % W, y = (c - x) / W, L = lv[c]!;
      if (y < 4 || y > H - 6 || lockRow[y - 1] || lockRow[y] || lockRow[y + 1]) continue;
      if (!(road.has(idx(x, y - 1)) && road.has(idx(x, y + 1)) && road.has(idx(x + 1, y)) && !road.has(idx(x - 1, y)) && !road.has(idx(x + 2, y)))) continue;
      const rx = dir < 0 ? x - 7 : x + 5, ry = y - 1;
      const fx0 = dir < 0 ? rx - 1 : x + 2, fx1 = dir < 0 ? x - 1 : rx + 4;
      let ok = fx0 >= 2 && fx1 <= W - 3 && !hitsRect(fx0, ry - 1, fx1 - fx0 + 1, 5, 0);
      for (let yy = ry - 1; ok && yy <= ry + 3; yy += 1) for (let xx = fx0; xx <= fx1; xx += 1) { const q = idx(xx, yy); if (lv[q] !== L || road.has(q) || water[q] || bridge[q]) { ok = false; break; } }
      if (!ok) continue;
      for (let xx = dir < 0 ? rx + 3 : x + 2; xx <= (dir < 0 ? x - 1 : rx); xx += 1) { put(xx, y); put(xx, y + 1); }
      return { x: rx, y: ry };
    }
    return undefined;
  };
  let sideAt: Cell | undefined, sideKind = "none", hiddenAt: Cell | undefined;
  const furnish = (x0: number, y0: number) => {
    clearings.push({ x: x0, y: y0, w: 4, h: 3 });
    sideAt = { x: x0 + 1, y: y0 + 1 }; sideKind = variant.side;
    if (variant.side === "rest") { want(flat ? "bd-rt-sp-lantern" : "bd-prop-bench_wood", flat ? x0 : x0 + 1, flat ? y0 + 1 : y0 + 2); want(flat ? "bd-rt-sp-shroom-m" : "bd-pick-deep-forest-path-campfire", x0 + 3, y0 + 1); }
    else if (variant.side === "lookout") { want("bd-rt-mt-rail", x0, y0 + 2); want("bd-pick-mountain-pass-trail-post", x0 + 3, y0 + 1); }
  };
  if (variant.side !== "none") {
    const tries = bands.map((b, i) => ({ b, i })).filter(({ i }) => i !== heroBand || nb === 1).sort((p, q) => (q.b.bot - q.b.run) - (p.b.bot - p.b.run));
    for (const { b, i } of [...tries, ...(hero.site === "behind" ? [] : [{ b: hb, i: heroBand }])]) {
      const room = b.bot - (b.run + 1);   // 길 남쪽 줄 수
      if (room < 5 + (swayOf(i) ? 1 : 0)) continue;
      const a = i === 0 ? lowX : cuts[i - 1]!.col;
      const d = cuts[i]?.col ?? highX;
      const lo = Math.min(a, d), hi = Math.max(a, d);
      // 길에서 남쪽으로 두 칸 내려간 4×3 빈터 — 아래 띠에서 올라오는 계단 열과 겹치지 않게
      const below = i > 0 ? cuts[i - 1]!.col : low === "south" ? lowEnd.x : -99;
      const xs: number[] = []; for (let x = Math.max(3, lo - 5); x <= Math.min(W - 7, hi + 3); x += 1) if ((x + 5 < below - 1 - amp || x - 1 > below + 2 + amp) && !hitsRect(x, b.run + 2, 4, 4, 1)) xs.push(x);
      if (!xs.length) continue;
      const x0 = xs[ri(0, xs.length - 1)]!, y0 = b.run + 3 + (swayOf(i) ? 1 : 0);
      if (x0 + 1 < lo) hline(b.run, x0 + 1, lo); else if (x0 + 1 > hi) hline(b.run, hi, x0 + 1);
      for (let y = b.run; y < y0; y += 1) { put(x0 + 1, y); put(x0 + 2, y); }
      furnish(x0, y0);
      break;
    }
    if (!sideAt) { const n = lateral(); if (n) furnish(n.x, n.y); }
    if (!sideAt) warnings.push("곁가지(막다른 자리)를 낼 곳이 없다 — 맵을 키운다.");
  }
  // 넓은 곳: 볼거리 띠에서 길이 넓은 풀밭으로 풀린다 — 풀밭 안의 길 칸은 칠하지 않는다(걷는 칸은 그대로)
  const fade = new Set<number>();
  let meadow: { cx: number; cy: number; rx: number; ry: number } | undefined;
  if (wide) {
    meadow = { cx: W / 2, cy: (hb.top + hb.bot) / 2 + 0.5, rx: W * 0.36, ry: Math.max(4, (hb.bot - hb.top) / 2 - 0.5) };
    blob.push(meadow);
    for (const c of road) { const x = c % W, y = (c - x) / W; if (lv[c] === hb.level && ((x - meadow.cx) / (meadow.rx - 2)) ** 2 + ((y - meadow.cy) / (meadow.ry - 1)) ** 2 <= 1) fade.add(c); }
  }
  // 숨은 샛길: 길 칸으로 칠하지 않고 숲이 바짝 붙는 두 칸 폭 틈 — 끝의 빈터가 상자 자리
  const lane = new Set<number>();
  if (shape === "hidden-fork") {
    const before = new Set(road), n = lateral();
    if (n) { for (const c of road) if (!before.has(c)) { lane.add(c); } for (const c of lane) road.delete(c); clearings.push({ x: n.x, y: n.y, w: 4, h: 3 }); hiddenAt = { x: n.x + 1, y: n.y + 1 }; want(flat ? "bd-rt-sp-crystal" : "bd-pick-deep-forest-path-cairn-s", n.x + 3, n.y); }
  }
  // 헤매는 곳: 비슷한 막다른 갈래 넷 — 참 길 쪽 갈림마다 표지(빛 버섯·정령석)가 선다
  if (shape === "maze") for (let k = 0; k < 4; k += 1) {
    const before = new Set(road), n = lateral(); if (!n) break;
    clearings.push({ x: n.x, y: n.y, w: 4, h: 3 });
    const spur = [...road].filter((c) => !before.has(c)), sx = Math.min(...spur.map((c) => c % W)), ex = Math.max(...spur.map((c) => c % W)), jy = Math.floor(spur[0]! / W);
    const west = n.x < sx, mx = west ? ex + 3 : sx - 2;   // 갈래 맞은편 길섶
    if (inMap(mx, jy - 1) && !road.has(idx(mx, jy)) && !road.has(idx(mx, jy - 1)) && !hitsRect(mx, jy - 1, 1, 2, 0)) { want(k % 2 ? "bd-rt-sp-stone-a" : "bd-rt-sp-shroom-m", mx, jy - 1); clearings.push({ x: mx, y: jy - 1, w: 1, h: 2 }); }
  }
  // 던전이 달린 지나가는 길: 줄기 옆으로 낸 곁길 끝에 입구 자리
  if (input.dungeon && !dungeonGate) {
    const first = rnd() < 0.5 ? -1 : 1;
    search: for (const f of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.45, 0.55, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85, 0.1, 0.9]) for (const dir of [first, -first]) {
      const c = order[Math.floor(f * (order.length - 1))]; if (c === undefined) continue;
      const x = c % W, y = (c - x) / W, L = lv[c]!;
      if (y < 8 || y > H - 6 || lockRow[y - 1] || lockRow[y] || lockRow[y + 1] || lockRow[y + 2]) continue;
      if (!(road.has(idx(x, y - 1)) && road.has(idx(x, y + 1)) && road.has(idx(x + 1, y)) && !road.has(idx(x - 1, y)) && !road.has(idx(x + 2, y)))) continue;
      const fx0 = dir < 0 ? x - 13 : x + 2, fx1 = dir < 0 ? x - 1 : x + 14, gx = dir < 0 ? x - 8 : x + 9;
      let ok = fx0 >= 1 && fx1 <= W - 2 && !hitsRect(fx0, y - 6, fx1 - fx0 + 1, 10, 0);
      for (let yy = y - 6; ok && yy <= y + 3; yy += 1) for (let xx = fx0; xx <= fx1; xx += 1) { const q = idx(xx, yy); if (lv[q] !== L || road.has(q) || water[q] || bridge[q]) { ok = false; break; } }
      if (!ok) continue;
      for (let xx = Math.min(gx - 1, x + 2); xx <= Math.max(gx + 2, x - 1); xx += 1) { if (xx === x || xx === x + 1) continue; put(xx, y + 1); put(xx, y + 2); }
      dungeonGate = mouthAt(gx, y);
      break search;
    }
    if (!dungeonGate) warnings.push("던전 어귀를 낼 자리가 없다 — 맵을 키운다.");
  }
  // 마을 어귀: 마을로 가는 변 바로 안쪽에 울타리와 이정표, 밭 — 그 끝 여섯 칸의 길은 마을 길의 급(흙·돌)을 따른다
  const paved = new Set<number>();
  if (input.village) {
    const e = ends.find((q) => q.side === input.village!.side);
    if (e) {
      const sd = input.village.side, vert = sd === "north" || sd === "south", inY = sd === "north" ? 1 : -1, inXd = sd === "west" ? 1 : -1;
      for (const c of road) { const x = c % W, y = (c - x) / W; if (Math.abs(x - e.cell.x) + Math.abs(y - e.cell.y) <= 8) paved.add(c); }
      const put2 = (id: string, x: number, y: number) => { const k = kitOf(id); if (!k || x < 0 || y < 0 || x + k.width > W || y + k.height > H) return; for (let j = 0; j < k.height; j += 1) for (let i = 0; i < k.width; i += 1) if (road.has(idx(x + i, y + j))) return; if (hitsRect(x, y, k.width, k.height, 0)) return; placements.push({ kit: id, x, y }); clearings.push({ x, y, w: k.width, h: k.height }); };
      if (vert) {
        const y = e.cell.y + inY * 2, x = e.cell.x;
        put2("bd-farm-fence-run-4", x - 5, y); put2("bd-farm-fence-run-4", x + 3, y); put2("bd-farm-fence-run-4", x - 9, y); put2("bd-farm-fence-run-4", x + 7, y);
        put2("bd-out-signpost", x + 2, y + (inY > 0 ? 1 : -3)); put2("bd-obj-hay-bale", x - 2, y + inY * 2);
        if (shape === "village-gate") { put2("bd-farm-fenced-plot", x + 4, inY > 0 ? y + 2 : y - 7); put2("bd-pick-wheat-roman-road-scarecrow", x - 5, inY > 0 ? y + 3 : y - 5); put2("bd-obj-cart-hay", x - 5, inY > 0 ? y + 6 : y - 8); }
      } else {
        const x = e.cell.x + inXd * 2, y = e.cell.y;
        put2("bd-farm-fence-v-3", x, y - 4); put2("bd-farm-fence-v-3", x, y + 3); put2("bd-farm-fence-v-3", x, y - 7); put2("bd-farm-fence-v-3", x, y + 6);
        put2("bd-out-signpost", x + inXd, y - 3); put2("bd-obj-hay-bale", x + inXd * 2, y + 3);
        if (shape === "village-gate") { put2("bd-farm-fenced-plot", inXd > 0 ? x + 3 : x - 9, y + 4); put2("bd-pick-wheat-roman-road-scarecrow", inXd > 0 ? x + 4 : x - 5, y - 5); put2("bd-obj-cart-hay", inXd > 0 ? x + 7 : x - 8, y - 4); }
      }
    }
  }
  // 갈림길 짜임: 막다른 갈래 둘을 더 낸다(끝에 돌 하나)
  if (variant.layout === "forks") for (let k = 0; k < 2; k += 1) {
    const n = lateral(); if (!n) break;
    clearings.push({ x: n.x, y: n.y, w: 4, h: 3 });
    want(flat ? "bd-rt-sp-stone-b" : "bd-pick-deep-forest-path-cairn", n.x + 1 + k, n.y);
  }

  // ---------- 7. 물·길 칠하기 ----------
  const size = N;
  const canal = tileset.autotileGroups?.find((g) => g.id === "beodeul_canal_lake_47");
  const fullWater = canal?.variantMap?.["255"] ?? -1;
  let beodeulWater = false;
  for (let c = 0; c < size; c += 1) if (water[c] && fullWater >= 0) { map.lowerTiles[c] = fullWater; beodeulWater = true; }
  // 못(늪 짜임): 길에서 두 칸 떨어진 둥근 물 서너 곳
  if (variant.layout === "bog" && fullWater >= 0) {
    beodeulWater = true;
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
  // 길: 버들항 모랫길(산길·정령 숲 모두 — 게임 겉모습의 길 그림을 따른다). 마을 어귀 끝은 그 마을 길이 돌이면 포석. 넓은 풀밭 속은 칠하지 않는다.
  for (const [cellsOf, material] of [[[...road].filter((c) => !bridge[c] && !fade.has(c) && !(input.village?.paved && paved.has(c))), BEODEUL_SAND_PATH], [input.village?.paved ? [...paved].filter((c) => !bridge[c] && !fade.has(c)) : [], BEODEUL_PAVED_ROAD]] as const) {
    const cells = [...cellsOf].sort((a, b) => a - b);
    for (let i = 0; i < cells.length;) {
      const start = cells[i]!, y = Math.floor(start / W); let end = start;
      while (i + 1 < cells.length && cells[i + 1] === end + 1 && Math.floor(cells[i + 1]! / W) === y) { i += 1; end = cells[i]!; }
      i += 1;
      fill.run(project, { mapId: map.id, rect: { x: start % W, y, w: end - start + 1, h: 1 }, material });
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
  if (falls && SKINS.spirit.falls) {
    // 폭포: 바위턱은 걷는 바닥(아래층), 바위벽·못은 막힌 그림 칸(2층), 물 장막은 걷는 이 앞(4층)
    const f = SKINS.spirit.falls;
    for (let j = 0; j < falls.h; j += 1) for (let i = 0; i < falls.w; i += 1) {
      const c = idx(falls.x + i, falls.y + j), lo = f.lower[j]?.[i] ?? -1, so = f.solid[j]?.[i] ?? -1, ve = f.veil[j]?.[i] ?? -1;
      if (lo >= 0) map.lowerTiles[c] = lo;
      if (so >= 0) setLayerTileAt(map, 2, c, so);
      if (ve >= 0) setLayerTileAt(map, 4, c, ve);
    }
    heroPlaced += 1;
  }
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
      if (ok && hitsRect(px, py, kd.width, kd.height, 0)) ok = false;
      for (let j = 0; ok && j < kd.height; j += 1) for (let i = 0; i < kd.width; i += 1) { const q = idx(px + i, py + j); if (road.has(q) || water[q] || bridge[q] || lv[q] !== L || lv[c] !== L) { ok = false; break; } }
      if (ok && stampAt(it.kit, px, py)) { lineSpots.push({ x: px, y: py + kd.height - 1 }); clearings.push({ x: px, y: py, w: kd.width, h: kd.height }); n += 1; heroPlaced += 1; }
    }
    if (lineSpots.length) { const m = lineSpots[Math.floor(lineSpots.length / 2)]!; site = { x: m.x, y: m.y, w: 1, h: 1 }; heroFront ??= (() => { const c = order[Math.floor(order.length / 2)]!; return { x: c % W, y: Math.floor(c / W) }; })(); }
    else warnings.push(`«${hero.ko}» 를 길 따라 세울 자리가 없다.`);
  }

  // ---------- 9. 숲 ----------
  const reserved = new Set<number>();
  const reserve = (x: number, y: number, r: number) => { for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) if (inMap(x + dx, y + dy)) reserved.add(idx(x + dx, y + dy)); };
  const verge = variant.cover === "open" ? 4 : variant.cover === "canopy" ? 1 : flat ? 3 : 2;
  for (const c of road) reserve(c % W, Math.floor(c / W), verge);
  for (const c of lane) { reserved.add(c); road.add(c); }   // 숨은 샛길: 두 칸 폭만 비우고, 뒤 단계(꾸밈·빈 자리)는 길 칸으로 본다
  for (const e of ends) reserve(e.cell.x, e.cell.y, 2);
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
  // 숲 벽은 버들항 숲 그대로(정령 숲은 혼효림) — 정령 숲다운 것은 그 위에 얹는다(은빛 고목 머리 · 빛 버섯 · 정령석 · 빛 자리)
  for (const c of forcedForest) if (!road.has(c)) reserved.delete(c);
  treeCells = plantBeodeulForestWall(project, map, tileset, reserved, rnd, stamp, flat ? "mixed" : "broadleaf", "woodland");
  if (flat) raiseSpiritCrowns(map, tileset, reserved, seed);

  // 트인 띠의 나무: 전나무·소나무(산) 또는 정령 나무(정령 숲)를 길에서 두 칸 넘게 떨어진 빈 풀밭에
  const standing = flat ? ["bd-rt-sp-tree-a", "bd-rt-sp-tree-c", "bd-rt-sp-tree-b", "bd-rt-sp-tree-c"]
    : variant.cover === "canopy" ? [] : ["bd-pick-coast-cliff-road-fir-l", "bd-pick-coast-cliff-road-fir-m", "bd-pick-coast-cliff-road-fir-m2", "bd-pick-mining-valley-fir", "bd-pick-coast-cliff-road-fir-s"];
  const openCell = (c: number): boolean => reserved.has(c) && !road.has(c) && !water[c] && !bridge[c] && map.lowerTiles[c] === BEODEUL_PLAIN_GRASS && ([2, 3, 4] as const).every((L) => layerTileAt(map, L, c) < 0);
  const inClearing = (x: number, y: number): boolean => clearings.some((r) => x >= r.x - 1 && x < r.x + r.w + 1 && y >= r.y - 1 && y < r.y + r.h + 1) || blob.some((b) => ((x - b.cx) / b.rx) ** 2 + ((y - b.cy) / b.ry) ** 2 <= 1);
  const nearRoad = (x: number, y: number, r: number): boolean => { for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) if (road.has(idx(x + dx, y + dy)) && inMap(x + dx, y + dy)) return true; return false; };
  if (standing.length) {
    const every = flat ? 2.4 : variant.cover === "open" ? 5 : 3;
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
  dressBeodeulVerge(project, map, tileset, road, reserved, rnd, stamp);
  { const decal = /leaves|petals|snow-patch|fairy-ring|light|glow-moss/u;
    const pool = [...variant.dress, ...(flat ? ["bd-rt-sp-light", "bd-rt-sp-glow-moss", "bd-rt-sp-light"] : [])].filter((id) => kitOf(id));
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
  {
    const woodland = beodeulWoodlandGrass(project, tileset);
    if (woodland >= 0) for (let i = 0; i < size; i += 1) if (map.lowerTiles[i] === BEODEUL_PLAIN_GRASS) map.lowerTiles[i] = woodland;
    layBeodeulGroundCover(project, map, look, { seed: (W * 31 + H * 17 + road.size * 7) | 0, road: (c) => road.has(c) });
  }
  if (beodeulWater) relayBeodeulWaterSurface(map, tileset, seed);

  // ---------- 12. 높이·돌계단 ----------
  let stairs = 0;
  {
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
  // 들어오는 칸 = 첫째 변의 끝. 나가는 칸 = 다른 가장자리 끝(없으면 맵 안 끝).
  const entry = (ends.find((e) => e.side === input.sides[0]) ?? ends.find((e) => e.side) ?? ends[0]!).cell;
  const exit = (ends.find((e) => e.side && e.cell !== entry) ?? ends.find((e) => e.cell !== entry) ?? ends[0]!).cell;
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
  if (falls) {
    // 물 장막 뒤 바위턱을 거치지 않고 건너가는 길이 남았으면 그 길의 첫 길 아닌 칸을 막는다
    const wall = new Set<number>(); for (const y of [falls.y + 3, falls.y + 4]) for (let i = 2; i <= 4; i += 1) wall.add(idx(falls.x + i, y));
    for (let guard = 0; guard < 40; guard += 1) {
      const from = idx(entry.x, entry.y), goal = idx(exit.x, exit.y), prev = new Map<number, number>([[from, -1]]), q = [from];
      for (let h = 0; h < q.length && !prev.has(goal); h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy, n = idx(nx, ny);
          if (!inMap(nx, ny) || prev.has(n) || wall.has(n) || !canMove(project, map, x, y, nx, ny)) continue; prev.set(n, c); q.push(n); } }
      if (!prev.has(goal)) break;
      let did = false;
      for (let c = goal; c >= 0 && !did; c = prev.get(c) ?? -1) if (!road.has(c) && plug(c % W, Math.floor(c / W))) { did = true; sealed += 1; }
      if (!did) { warnings.push(`«${hero.ko}» 를 돌아가는 길을 다 막지 못했다.`); break; }
    }
  }
  { const seen = flood(entry);
    for (const e of ends) if (!seen.has(idx(e.cell.x, e.cell.y))) warnings.push(`(${entry.x},${entry.y}) → ${e.side ?? "길 끝"} (${e.cell.x},${e.cell.y}) 가 걸어서 이어지지 않는다.`);
    if (dungeonGate && !seen.has(idx(dungeonGate.x, dungeonGate.y))) warnings.push(`던전 입구 칸 (${dungeonGate.x},${dungeonGate.y}) 에 걸어서 닿지 않는다.`);
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
  if (meadow) for (const [fx, fy] of [[-0.5, -0.3], [0.5, 0.3], [-0.45, 0.4], [0.45, -0.4]] as const) {
    const cell = { x: Math.round(meadow.cx + fx * meadow.rx), y: Math.round(meadow.cy + fy * meadow.ry) };
    if (inMap(cell.x, cell.y) && reach.has(idx(cell.x, cell.y)) && !busy.some((b) => Math.abs(b.x - cell.x) + Math.abs(b.y - cell.y) <= 2)) enemySpots.push(cell);
  }
  if (hiddenAt && reach.has(idx(hiddenAt.x, hiddenAt.y)) && !sideAt) { sideAt = hiddenAt; sideKind = "hidden"; }
  if (heroFront && !reach.has(idx(heroFront.x, heroFront.y))) heroFront = undefined;
  if (sideAt && !reach.has(idx(sideAt.x, sideAt.y))) { sideAt = undefined; sideKind = "none"; }
  void blockedByStamp;
  const exits = ends.filter((e): e is { side: RouteSideName; cell: Cell } => !!e.side).sort((a, b) => Number(b.cell === entry) - Number(a.cell === entry)).map((e) => ({ side: e.side, x: e.cell.x, y: e.cell.y }));
  return { entry, exit, exits, ...(dungeonGate ? { dungeonGate } : {}), roadCells: road.size, treeCells, stairs, sealed, ...(site && (heroPlaced > 0 || hero.site === "bridge" || hero.water || dungeonGate) ? { heroAt: site } : {}), ...(heroFront ? { heroFront } : {}), ...(sideAt ? { sideAt } : {}), sideKind, enemySpots, warnings };
}

/**
 * 정령 숲다운 수관: 버들항 숲 벽(수관 오토타일 + 나무) 위에 은빛 고목·꽃 핀 나무의 머리를 드문드문 얹는다(4층 ★ — 막힌 숲 칸 위에만, 걷는 칸은 바꾸지 않는다).
 * 숲의 바탕은 버들항 그대로이고 이것은 그 위의 강조다 — 넓은 숲 면이 한 무늬로 차지 않는다.
 */
function raiseSpiritCrowns(map: GameMap, tileset: TilesetDef, reserved: ReadonlySet<number>, seed: number): number {
  const W = map.width, H = map.height;
  const kits = new Map((tileset.structureKits ?? []).map((k) => [k.id, k] as const));
  const heads = ["bd-rt-sp-crown-e", "bd-rt-sp-crown-a", "bd-rt-sp-crown-f", "bd-rt-sp-crown-b", "bd-rt-sp-crown-f"].map((id) => kits.get(id)).filter((k): k is StructureKitDef => !!k);
  if (!heads.length) return 0;
  const forest = (c: number): boolean => !reserved.has(c) && (layerTileAt(map, 3, c) >= 0 || layerTileAt(map, 2, c) >= 0) && layerTileAt(map, 4, c) < 0;
  let n = 0;
  for (let by = 0; by * 5 < H; by += 1) for (let bx = 0; bx * 6 < W; bx += 1) {
    if (hash01(bx, by, seed + 211) < 0.5) continue;
    const kit = heads[Math.floor(hash01(bx, by, seed + 5) * heads.length)]!;
    const x = bx * 6 + Math.floor(hash01(bx, by, seed + 1) * 3), y = by * 5 + Math.floor(hash01(bx, by, seed + 2) * 2);
    let ok = x >= 0 && y >= 0 && x + kit.width <= W && y + kit.height + 1 <= H;
    for (let j = 0; ok && j < kit.height + 1; j += 1) for (let i = 0; i < kit.width; i += 1) if (!forest((y + j) * W + x + i)) { ok = false; break; }
    if (!ok) continue;
    for (let j = 0; j < kit.height; j += 1) for (let i = 0; i < kit.width; i += 1) {
      const row = kit.rows[j]; const t = (row?.upperTiles?.[i] ?? -1) >= 0 ? row!.upperTiles![i]! : row?.tiles?.[i] ?? -1;
      if (t >= 0) setLayerTileAt(map, 4, (y + j) * W + x + i, t);
    }
    n += 1;
  }
  return n;
}

export type { RouteHero };
