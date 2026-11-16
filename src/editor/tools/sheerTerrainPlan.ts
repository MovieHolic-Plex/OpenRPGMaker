// 깎아지른 지형의 계획(칸 격자만 — 맵·타일을 모른다). sheerTerrainBuild.ts 가 이 계획을 맵에 싣는다.
//
// 무엇을 정하나(terrain-pilot DESIGN.md §2·§5, 2026-11-16):
//   · 높이: 고원은 「타원 여럿의 합」(엽) — 맵을 가로지르는 곧은 띠는 내지 않는다. 단은 3~5. 갈래마다 짜임이 다르다(layout):
//       islands 빈 곳 위 엽 섬 둘(구름다리로 잇는다) · terraces 땅 위 계단단(북쪽일수록 높다, 물길이 단마다 떨어진다) · stack 한가운데로 쌓아 오른 봉우리.
//   · 빈 곳(islands·stack): 0 단 = 하늘(통행 불가, 렌더러가 투명하게 둔다 — 맵 배경이 비친다).
//   · 장치: 단 덩이(같은 단의 이어진 칸)를 마디로, 닿는 마디 쌍(남쪽 면이 아래 덩이에 서는 곳)을 간선으로 보고 들어오는 덩이에서 뻗은 나무의 간선마다 하나.
//     닫힌 목록(sheerTerrainKinds.json devices)에서 갈래의 표가 고른다. 같은 장치를 잇달아 쓰지 않는다. 빈 곳을 건너는 간선은 구름다리.
//   · 물: 못 갈래는 윗단에 못 하나, 물길 갈래는 가장 높은 단의 못에서 단마다 폭포로 남쪽 못에 떨어진다.
//   · 볼거리 하나(가장 높은 단), 막다른 턱 하나(따로 선 작은 엽 — 그 갈래의 장치 하나로만 닿는다, 상자 자리).
//   · 통행 보증: 들어오는 칸에서 물들이기 — 출구 · 볼거리 앞 · 막다른 턱에 안 닿으면 그 경계에 장치를 하나 더 둔다. 그래도 안 닿는 걷는 칸은 막는다(시공 쪽).
//   · 가려진 땅: 면이 3칸이라 고원 북쪽 3h 칸은 화면에서 가려진다(check.ts) — 볼거리 · 상자 · 장치 발치를 거기 두지 않는다.
// 난수는 씨앗 하나(mulberry32)뿐 — 같은 씨앗 · 같은 크기면 같은 계획이다.
import kindsTable from "@/assets/sheerTerrainKinds.json";
import { mulberry32 } from "@/util/rng";
import { effectiveHeights } from "@/project/relief/render";
import { reliefAllowsStep, invalidateReliefSlopes } from "@/project/relief/walk";
import type { ReliefData } from "@/project/relief/types";

export type SheerDeviceId = "ladder" | "vine" | "stairs" | "cave" | "bridge";
export type SheerSide = "north" | "south" | "east" | "west";
export interface SheerKind {
  readonly id: string; readonly ko: string; readonly en: string; readonly hint: string;
  readonly void: boolean; readonly levels: readonly [number, number];
  readonly size: Readonly<Record<"small" | "medium" | "large", readonly [number, number]>>;
  readonly water: "pond" | "stream" | "none"; readonly layout: "islands" | "terraces" | "stack";
  readonly step1: readonly SheerDeviceId[]; readonly step2: readonly SheerDeviceId[]; readonly gap: readonly SheerDeviceId[];
  readonly landmark: readonly string[]; readonly ledge: SheerDeviceId; readonly chest: string;
  readonly backdrop?: { readonly preset: string; readonly view: "horizon" | "surface"; readonly prompt: string };
  readonly dressing: readonly string[];
  /** 바깥 숲(0 없음 ~ 1 깊음): 맵 가장자리에서 안으로 물결치며 들어오는 숲 덩이 — 걷는 땅의 몫을 30~45% 로 줄인다(목표 화면 b-falls 의 숲 덩어리). */
  readonly forest?: number;
}
export interface SheerDeviceDef { readonly code: number; readonly rise: readonly [number, number]; readonly width: number; readonly en: string; readonly ko: string }
export const SHEER_KINDS: readonly SheerKind[] = kindsTable.kinds as unknown as SheerKind[];
export const SHEER_DEVICES = kindsTable.devices as unknown as Readonly<Record<SheerDeviceId, SheerDeviceDef>>;
export const sheerKindById = (id: string | undefined): SheerKind | undefined => SHEER_KINDS.find((k) => k.id === id);

type Cell = { x: number; y: number };
export interface SheerDevice {
  readonly kind: SheerDeviceId;
  /** 낮은 단 · 높은 단(다리는 두 둑의 단) */
  readonly lo: number; readonly hi: number;
  /** 장치 칸(ramps 코드를 받는 칸 — 사다리·덩굴·계단은 면 앞 낮은 단 칸, 다리는 빈 곳 위 판 칸) */
  readonly cells: readonly number[];
  /** 통행 보증이 더한 장치 */
  readonly extra?: boolean;
}
export interface SheerPlan {
  readonly W: number; readonly H: number; readonly kind: SheerKind; readonly seed: number;
  readonly levels: Uint8Array;
  readonly ramps: Uint8Array;
  readonly water: Uint8Array;
  /** 폭포(물 칸 x0..x1 이 y 줄에서 drop 단 아래로 떨어진다 — beodeulWater.hangBeodeulWaterfalls 가 같은 줄을 찾는다) */
  readonly falls: readonly { x0: number; x1: number; y: number; drop: number }[];
  /** 널다리 칸(물 위를 동서로 건너는 걷는 판 — 물이 단을 둘로 가를 때) */
  readonly fords: readonly number[];
  readonly devices: readonly SheerDevice[];
  readonly entry: Cell & { side: SheerSide };
  readonly exits: readonly (Cell & { side: SheerSide })[];
  /** 볼거리 킷 자리(왼쪽 위)와 앞 칸 */
  readonly landmark?: { readonly kit: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly front: Cell };
  /** 막다른 턱의 상자 칸 */
  readonly deadEnd?: Cell;
  /** 걷지 못하게 막을 칸(통행 보증 뒤에도 닿지 않는 걷는 칸) — 시공 쪽이 막는다 */
  readonly sealed: readonly number[];
  /** 가려진 칸(더 높은 단의 앞면 3h 칸 뒤) — 걷는 것을 두지 않는다 */
  readonly hidden: Uint8Array;
  /** 숲 후보 칸(시공 쪽이 같은 단끼리 수관 오토타일로 덮는다 — 2×2 에 안 드는 칸은 거기서 빠진다). 길 뼈대(들어오는 칸 → 목표마다 최단 길 둘레 두 칸)는 비운다. */
  readonly forest: Uint8Array;
  readonly levelCount: number;
  readonly warnings: readonly string[];
}

const FACE = 3;   // 단 하나 = 면 3칸(styles.ts sheer.faceRows)
type Lobe = { cx: number; cy: number; rx: number; ry: number };

/**
 * 계획을 세운다. W·H 는 맵 크기(칸), seed 는 게임 열쇠·요청에서 온 씨앗. exitSides 는 길이 닿을 변(첫째가 들어오는 변).
 */
export function planSheerTerrain(kind: SheerKind, W: number, H: number, seed: number, exitSides: readonly SheerSide[] = ["south", "north"]): SheerPlan {
  // 같은 씨앗에서 이어지는 씨앗 몇 번(결정적): 단 수가 갈래의 범위(3~5 안)에 들고 목표(출구 · 볼거리 · 막다른 턱)가 모두 닿는 첫 계획.
  // 작은 맵에서 엽 덩이가 단을 다 못 쌓거나, 장치 자리가 없는 경우가 있다 — 그때 다음 배치를 본다. 끝까지 없으면 문제가 가장 적은 계획.
  const lo = Math.max(3, kind.levels[0]), hi = Math.min(5, kind.levels[1] + 1);
  let best: { plan: SheerPlan; bad: number } | undefined;
  for (let attempt = 0; attempt < 8; attempt++) {
    const plan = planOnce(kind, W, H, attempt ? (seed + attempt * 7919) >>> 0 : seed, seed, exitSides);
    const goalMiss = plan.warnings.filter((w) => /not reachable|cut off|no device spot|no room for the landmark/u.test(w)).length;
    const bad = (plan.levelCount < lo || plan.levelCount > hi ? 10 : 0) + goalMiss;
    if (!bad) return attempt ? { ...plan, warnings: [...plan.warnings, `layout ${attempt + 1} of the seed (earlier layouts missed a level or a goal)`] } : plan;
    if (!best || bad < best.bad) best = { plan, bad };
  }
  return best!.plan;
}

function planOnce(kind: SheerKind, W: number, H: number, layoutSeed: number, seed: number, exitSides: readonly SheerSide[]): SheerPlan {
  const rnd = mulberry32((layoutSeed ^ 0x5eed7e) >>> 0);
  const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const N = W * H, idx = (x: number, y: number) => y * W + x, inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const warnings: string[] = [];
  const lv = new Uint8Array(N);
  const blob = (ls: readonly Lobe[], x: number, y: number, grow = 0) => ls.some((l) => ((x + 0.5 - l.cx) / (l.rx + grow)) ** 2 + ((y + 0.5 - l.cy) / (l.ry + grow)) ** 2 <= 1);
  /** 엽 묶음 — 중심 (cx,cy) 둘레에 n 개, 전체 폭 w · 높이 h 안. */
  const lobeSet = (cx: number, cy: number, w: number, h: number, n: number): Lobe[] => {
    const out: Lobe[] = [];
    for (let i = 0; i < n; i++) {
      const rx = Math.max(2.6, (w / 2) / (1 + (n - 1) * 0.45) * (0.88 + rnd() * 0.24)), ry = Math.max(2.2, (h / 2) * (0.78 + rnd() * 0.22));
      const off = n === 1 ? 0 : (i / (n - 1) - 0.5) * (w - 2 * rx);
      out.push({ cx: cx + off + (rnd() - 0.5) * 1.2, cy: cy + (rnd() - 0.5) * (h * 0.25), rx, ry });
    }
    return out;
  };
  const fill = (ls: readonly Lobe[], L: number, onlyOn?: number) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (blob(ls, x, y) && (onlyOn === undefined || lv[idx(x, y)] === onlyOn)) lv[idx(x, y)] = L;
  };
  /** 칸 (x,y) 가 남쪽의 더 높은 단 앞면(단 차 × 3칸) 뒤에 가려지는가. */
  const hiddenAt = (x: number, y: number) => { const L = lv[idx(x, y)]!; for (let k = 1; k <= FACE * 5 && y + k < H; k++) { const M = lv[idx(x, y + k)]!; if (M > L && k <= FACE * (M - L)) return true; } return false; };
  // ---------- 1. 높이(짜임마다) ----------
  const levels = ri(kind.levels[0], kind.levels[1]);
  let deadEnd: Cell | undefined;
  const ledge = new Set<number>();
  const ledgeSide = rnd() < 0.5 ? -1 : 1;
  /** 단 k 를 단 k-1 위에만 세운다 — 그 칸의 옆 · 북쪽 한 칸과 남쪽 FACE+2 칸이 모두 k-1 이상이어야(면이 아래 단 땅에 서고 그 앞에 걷는 줄이 남는다). */
  const raise = (ls: readonly Lobe[], k: number) => {
    const ok = (x: number, y: number) => inMap(x, y) ? lv[idx(x, y)]! >= k - 1 : kind.layout === "terraces" && y < H;
    const add: number[] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (lv[idx(x, y)] !== k - 1 || !blob(ls, x, y)) continue;
      let good = ok(x - 1, y) && ok(x + 1, y) && (y === 0 || ok(x, y - 1));
      for (let d = 1; d <= FACE + 2 && good; d++) if (!ok(x, y + d)) good = false;
      if (good) add.push(idx(x, y));
    }
    for (const c of add) lv[c] = k;
  };
  /** 땅덩이 하나: 상자 [x0,x1]×[yTop,yBot] 안에 단 1..n 을 쌓는다. 단마다 남쪽 가장자리가 FACE+2 칸 이상 물러나고 폭이 좁아진다(엽 둘~셋의 합). */
  const mass = (x0: number, x1: number, yTop: number, yBot: number, n: number, base = 1) => {
    const cx = (x0 + x1) / 2, hw = (x1 - x0) / 2;
    const step = Math.max(FACE + 2, Math.floor((yBot - yTop - 4) / Math.max(1, n - 1 + 0.7)));
    for (let k = base; k < base + n; k++) {
      const i = k - base, t = n > 1 ? i / (n - 1) : 0;
      const south = yBot - i * step, north = yTop + Math.round(i * 0.7);
      if (south - north < 3) break;
      // 엽이 상자 안에 들도록 폭을 조금 줄인다 — 상자에 잘린 엽은 곧은 세로 옆면(네모 기둥)으로 읽혔다
      const w = 2 * hw * (1 - 0.6 * t) * 0.86, lobesN = i === n - 1 ? 1 + ri(0, 1) : 2 + ri(0, 1);
      const ls = lobeSet(cx + (rnd() - 0.5) * hw * 0.3 * t, (north + south) / 2 + 0.5, w, south - north + 1, lobesN);
      if (k === 1) { for (let y = Math.max(0, north - 2); y <= Math.min(H - 1, south); y++) for (let x = Math.max(0, x0 - 1); x <= Math.min(W - 1, x1 + 1); x++) if (blob(ls, x, y)) lv[idx(x, y)] = Math.max(lv[idx(x, y)]!, 1); }
      else raise(ls, k);
    }
  };
  /** 막다른 턱(빈 곳 갈래): 땅덩이의 ledgeSide 쪽 끝에서 하늘 gap 칸 건너 작은 엽. 다리 줄의 둑 칸(그 위 칸도 같은 덩이)을 찾아 그 줄에 맞춘다. */
  const voidLedge = (lw: number, gap: number) => {
    const rows: { y: number; x: number; L: number }[] = [];
    for (let y = 3; y < H - FACE - 4; y++) {
      let x = -1;
      if (ledgeSide > 0) { for (let q = W - 1; q >= 0; q--) if (lv[idx(q, y)]) { x = q; break; } }
      else { for (let q = 0; q < W; q++) if (lv[idx(q, y)]) { x = q; break; } }
      if (x < 0 || !lv[idx(x, y)] || lv[idx(x, y - 1)] !== lv[idx(x, y)] || hiddenAt(x, y)) continue;
      const far = x + ledgeSide * (gap + lw);
      if (far < 1 || far > W - 2) continue;
      rows.push({ y, x, L: lv[idx(x, y)]! });
    }
    if (!rows.length) return;
    const r = rows[Math.floor(rows.length / 2)]!;
    const lx0 = ledgeSide > 0 ? r.x + gap + 1 : r.x - gap - lw, y0 = r.y - 2;
    const ls = lobeSet(lx0 + lw / 2, y0 + 2, lw, 4.6, 1);
    for (let y = y0; y < y0 + 4; y++) for (let x = lx0; x < lx0 + lw; x++) if (inMap(x, y) && (blob(ls, x, y, 0.5) || y === r.y || y === r.y - 1)) { lv[idx(x, y)] = r.L; ledge.add(idx(x, y)); }
  };
  if (kind.layout === "terraces") {
    // 땅 위 계단단: 1 단이 맵 전체, 단 k 는 북쪽으로 물러난 엽 띠(타원 셋~넷의 합 — 남쪽 가장자리가 물결친다). 북쪽 맵 끝까지 이어진다(뒤 절벽).
    lv.fill(1);
    // 막다른 턱 자리(남서 · 남동 귀퉁이)는 먼저 비켜 둔다
    const lw = 5 + ri(0, 1), lh = 4, lx0 = ledgeSide < 0 ? 2 : W - 2 - lw, ly0 = H - 5 - lh;
    const band = Math.max(FACE + 3, Math.floor((H - 6) / levels));
    for (let k = 2; k <= levels; k++) {
      const south = H - 2 - band * (k - 1) - (k === 2 ? 2 : 0) + ri(-1, 1);
      const n = 3 + ri(0, 1), ls: Lobe[] = [];
      for (let i = 0; i < n; i++) {
        const rx = W / (n - 0.6) * (0.55 + rnd() * 0.2), ry = band * (0.9 + rnd() * 0.5);
        ls.push({ cx: (i + 0.3 + rnd() * 0.4) * (W / n), cy: south - ry + 0.5 + ri(-1, 1), rx, ry });
      }
      const north: Lobe[] = [{ cx: W / 2, cy: -H, rx: W * 4, ry: H + south - band + 1 }];
      raise([...ls, ...north], k);
    }
    for (let y = ly0 - FACE - 2; y < H; y++) for (let x = lx0 - 2; x <= lx0 + lw + 1; x++) if (inMap(x, y)) lv[idx(x, y)] = 1;
    const ls = lobeSet(lx0 + lw / 2, ly0 + lh / 2, lw, lh, 1);
    for (let y = ly0; y < ly0 + lh; y++) for (let x = lx0; x < lx0 + lw; x++) if (blob(ls, x, y, 0.4)) { lv[idx(x, y)] = 2; ledge.add(idx(x, y)); }
  } else if (kind.layout === "islands") {
    // 빈 곳 위 엽 섬 둘: 턱 쪽 섬은 두 단, 반대쪽 섬은 levels 단. 사이와 둘레는 하늘. 턱 자리(lw+gap+1 칸)는 비워 둔다.
    const lw = 4 + ri(0, 1), gap = 3 + ri(0, 1), strip = lw + gap + 1, mid = Math.max(4, Math.round(W * 0.1));
    const lo = ledgeSide < 0 ? 1 + strip : 1, hi = ledgeSide > 0 ? W - 2 - strip : W - 2, span = hi - lo + 1 - mid;
    const wA = Math.round(span * (0.48 + (rnd() - 0.5) * 0.08));
    const [nA, nB] = ledgeSide < 0 ? [2, levels] : [levels, 2];
    mass(lo, lo + wA - 1, 2 + ri(0, 2), H - 3, nA);
    mass(lo + wA + mid, hi, 1 + ri(0, 1), H - 3 - ri(0, 2), nB);
    tidy(lv, W, H);
    voidLedge(lw, gap);
  } else {
    // 봉우리: 한가운데로 쌓아 오른다(단마다 좁아지고 남쪽 가장자리가 물러난다). 바깥은 하늘. 턱은 동·서 바깥 하늘 위 외딴 턱(다리).
    const lw = 4 + ri(0, 1), gap = 3, strip = lw + gap + 1;
    const lo = ledgeSide < 0 ? 1 + strip : 2, hi = ledgeSide > 0 ? W - 2 - strip : W - 3;
    mass(lo, hi, 2, H - 3, levels);
    tidy(lv, W, H);
    voidLedge(lw, gap);
  }
  tidy(lv, W, H);
  mergeSlivers(lv, W, H, ledge);
  for (const c of [...ledge]) if (lv[c] === 0) ledge.delete(c);
  if (ledge.size) {
    const cs = [...ledge].map((c) => ({ x: c % W, y: Math.floor(c / W) })), mx = cs.reduce((s, c) => s + c.x, 0) / cs.length;
    const top = Math.min(...cs.map((c) => c.y));
    deadEnd = cs.filter((c) => c.y === top + 1).sort((a, b) => Math.abs(a.x - mx) - Math.abs(b.x - mx))[0] ?? cs[0]!;
  }
  // ---------- 2. 단 덩이(마디) ----------
  const comp = new Int32Array(N).fill(-1), compLv: number[] = [], compCells: number[][] = [];
  for (let s = 0; s < N; s++) {
    if (!lv[s] || comp[s] >= 0) continue;
    const id = compLv.length, q = [s]; comp[s] = id;
    for (let h = 0; h < q.length; h++) { const c = q[h]!, x = c % W; for (const m of [c - W, c + W, x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1]) if (m >= 0 && m < N && lv[m] === lv[s] && comp[m] < 0) { comp[m] = id; q.push(m); } }
    compLv.push(lv[s]!); compCells.push(q);
  }
  // ---------- 3. 들어오는 칸 · 나가는 칸 ----------
  const edgeCell = (side: SheerSide, want: (c: number) => boolean): (Cell & { side: SheerSide }) | undefined => {
    const cand: Cell[] = [];
    const along = side === "south" || side === "north" ? W : H;
    for (let a = 2; a < along - 2; a++) {
      const n = side === "south" || side === "north" ? H : W;
      for (let b = 0; b < n; b++) {
        const x = side === "south" || side === "north" ? a : side === "east" ? W - 1 - b : b, y = side === "south" ? H - 1 - b : side === "north" ? b : a;
        if (want(idx(x, y))) { cand.push({ x, y }); break; }
      }
    }
    if (!cand.length) return undefined;
    const d = (c: Cell) => side === "south" ? H - 1 - c.y : side === "north" ? c.y : side === "east" ? W - 1 - c.x : c.x;
    const best = Math.min(...cand.map(d)), near = cand.filter((c) => d(c) <= best + 1);
    return { ...near[Math.floor(near.length / 2)]!, side };
  };
  const walkable = (c: number) => lv[c]! > 0 && !ledge.has(c) && !hiddenAt(c % W, Math.floor(c / W));
  const sides = exitSides.length ? exitSides : (["south", "north"] as SheerSide[]);
  const ends = sides.map((s) => edgeCell(s, walkable)).filter((e): e is Cell & { side: SheerSide } => !!e);
  const entry = ends[0] ?? { x: Math.floor(W / 2), y: H - 2, side: "south" as SheerSide };
  const exits = ends.slice(1) as (Cell & { side: SheerSide })[];
  // ---------- 4. 물 ----------
  const water = new Uint8Array(N);
  const falls: { x0: number; x1: number; y: number; drop: number }[] = [];
  const topLv = maxIn(lv);
  const wavy = (cx: number, cy: number, rx: number, ry: number, s: number) => (x: number, y: number) => {
    const th = Math.atan2((y + 0.5 - cy) / ry, (x + 0.5 - cx) / rx), k = 1 + 0.12 * Math.sin(3 * th + s) + 0.07 * Math.sin(5 * th + 2.3 * s);
    return ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= k * k;
  };
  /** 칸 c 둘레 m 칸(남쪽은 면까지 FACE 칸 더)이 모두 단 L 인가 — 못이 가장자리·면에 붙지 않게. */
  const interior = (c: number, L: number, m: number) => { const x = c % W, y = (c - x) / W; for (let dy = -m; dy <= m + FACE; dy++) for (let dx = -m; dx <= m; dx++) { if (!inMap(x + dx, y + dy) || lv[idx(x + dx, y + dy)] !== L) return false; } return true; };
  if (kind.water === "pond") {
    const L = Math.max(1, topLv - 1), cells = [...Array(N).keys()].filter((c) => lv[c] === L && !ledge.has(c) && interior(c, L, 2));
    if (cells.length) {
      const c = cells[Math.floor(rnd() * cells.length)]!, f = wavy(c % W + 0.5, Math.floor(c / W) + 0.5, 2.3 + rnd() * 0.8, 1.5 + rnd() * 0.5, seed);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (f(x, y) && lv[idx(x, y)] === L && interior(idx(x, y), L, 1)) water[idx(x, y)] = 1;
    }
  } else if (kind.water === "stream") {
    // 물길(목표 화면 b-falls): 가장 높은 단의 못 → 남쪽 가장자리에서 폭포(면 한 띠, 3칸 폭) → 아래 단의 못(폭포 밑에서 받아 다음 폭포 자리까지 흐른다) → … → 1 단의 못.
    // 못은 타원 여럿의 합에 물가를 물결지게(wavy). 못이 단을 동서로 가르면 통행 보증이 널다리를 놓는다.
    let col = Math.floor(W * (0.42 + rnd() * 0.2)), from: Cell | undefined;
    const dig = (L: number, f: (x: number, y: number) => boolean, y0: number, y1: number) => {
      for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = 1; x < W - 1; x++) if (lv[idx(x, y)] === L && !ledge.has(idx(x, y)) && f(x, y)) water[idx(x, y)] = 1;
    };
    for (let L = topLv; L >= 1; L--) {
      const edgeY = (x: number) => { for (let y = H - 1; y >= 0; y--) if (lv[idx(x, y)] === L) return y; return -1; };
      let best = -1;
      if (L > 1) for (let d = 0; d < W && best < 0; d++) for (const x of [col - d, col + d]) {
        if (x < 3 || x > W - 4) continue;
        const y = edgeY(x); if (y < 3) continue;
        if (edgeY(x - 1) !== y || edgeY(x + 1) !== y || edgeY(x - 2) !== y || edgeY(x + 2) !== y) continue;
        if (!(inMap(x, y + 1) && lv[idx(x, y + 1)]! < L && lv[idx(x, y + 1)]! >= 1)) continue;
        if ([-1, 0, 1].some((k) => lv[idx(x + k, y + 1)] !== lv[idx(x, y + 1)])) continue;
        if (ledge.has(idx(x, y))) continue;
        best = x; break;
      }
      if (L === 1 || best < 0) {
        // 마지막 못: 위 폭포 밑에서 넓게 받는다
        if (from) { const f = wavy(from.x + 0.5 + (rnd() - 0.5) * 2, from.y + 2.2, 3.4 + rnd() * 1.2, 1.9 + rnd() * 0.5, seed + 7); dig(L, f, from.y, from.y + 5); }
        break;
      }
      col = best;
      const y = edgeY(col);
      // 이 단의 못: 위에서 떨어진 물(from)을 받아 폭포 턱(col, y)까지 — 두 점 사이에 엽 셋
      const blobs: ((x: number, yy: number) => boolean)[] = [];
      const head = from ?? { x: col + ri(-2, 2), y: Math.max(1, y - 3) };
      for (let k = 0; k <= 2; k++) {
        const t = k / 2, cx = head.x + (col - head.x) * t + 0.5, cy = (from ? head.y + 1.6 : head.y) + (y - 0.6 - (from ? head.y + 1.6 : head.y)) * t;
        blobs.push(wavy(cx, cy, 2.2 + rnd() * 1.0, 1.4 + rnd() * 0.5, seed + L * 3 + k));
      }
      dig(L, (x, yy) => blobs.some((f) => f(x, yy)) || (yy === y && Math.abs(x - col) <= 1), (from ? from.y : y - 5), y);
      const below = lv[idx(col, y + 1)]!;
      falls.push({ x0: col - 1, x1: col + 1, y, drop: L - below });
      from = { x: col, y: y + 1 };
      col = Math.max(4, Math.min(W - 5, col + ri(-5, 5)));
    }
  }
  // ---------- 5. 장치: 덩이 나무의 간선마다 하나 ----------
  const ramps = new Uint8Array(N), taken = new Uint8Array(N), devices: SheerDevice[] = [];
  const used: SheerDeviceId[] = [];
  const pick = (list: readonly SheerDeviceId[], skip: readonly SheerDeviceId[] = []): SheerDeviceId | undefined => {
    const ok = list.filter((d) => !skip.includes(d)); if (!ok.length) return undefined;
    const fresh = ok.filter((d) => d !== used[used.length - 1]);
    return (fresh.length ? fresh : ok)[Math.floor(rnd() * (fresh.length ? fresh : ok).length)]!;
  };
  const busy = (c: number) => !!(water[c] || taken[c] || ramps[c]);
  /** 높은 덩이 hiC 의 남쪽 가장자리 칸 가운데 그 아래(장치 칸 두 줄 + 발치 한 줄)가 낮은 덩이 loC 인 자리, 폭 w. */
  const faceSpots = (hiC: number, loC: number, w: number, rise: number, want?: (hi: number, lo: number) => boolean) => {
    const out: { x: number; y: number; flat: number }[] = [];
    for (const c0 of compCells[hiC]!) {
      const x = c0 % W, y = (c0 - x) / W;
      if (x < 1 || x + w > W - 1 || y < 2 || y + 3 >= H) continue;
      let ok = true;
      for (let i = 0; i < w && ok; i++) {
        const c = idx(x + i, y);
        if (comp[c] !== hiC || busy(c) || comp[idx(x + i, y - 1)] !== hiC || busy(idx(x + i, y - 1))) ok = false;
        for (let k = 1; k <= 3 && ok; k++) { const q = idx(x + i, y + k); if (comp[q] !== loC || busy(q)) ok = false; }
      }
      // 장치 양옆도 같은 단의 곧은 가장자리 — 엽 끝 비탈에 걸치지 않게
      // 장치 칸 양옆(낮은 단 첫 줄)은 높은 단이 아니어야 — 홈 안에 걸리지 않게. 양옆 윗줄이 같은 단이면 면 한가운데(더 좋다)
      if (ok && ((comp[idx(x - 1, y + 1)] ?? -1) === hiC || (comp[idx(x + w, y + 1)] ?? -1) === hiC)) ok = false;
      if (ok && rise !== compLv[hiC]! - compLv[loC]!) ok = false;
      if (ok && want && !want(c0, idx(x, y + 3))) ok = false;
      // 막다른 턱 곁(발치 둘레 두 칸)에는 다른 장치를 두지 않는다 — 턱은 제 장치 하나로만 닿는다
      if (ok && ledge.size && !ledge.has(c0)) for (let k = 1; k <= 5 && ok; k++) for (let i = -2; i < w + 2; i++) if (ledge.has(idx(Math.max(0, Math.min(W - 1, x + i)), Math.min(H - 1, y + k)))) { ok = false; break; }
      if (ok) out.push({ x, y, flat: (comp[idx(x - 1, y)] === hiC ? 1 : 0) + (comp[idx(x + w, y)] === hiC ? 1 : 0) });
    }
    const best = Math.max(-1, ...out.map((o) => o.flat));
    return out.filter((o) => o.flat === best);
  };
  const placeStep = (hiC: number, loC: number, extra = false, want?: (hi: number, lo: number) => boolean): SheerDevice | undefined => {
    const rise = compLv[hiC]! - compLv[loC]!;
    const list = rise >= 2 ? kind.step2 : kind.step1, tried: SheerDeviceId[] = [];
    for (;;) {
      const d = pick(list, tried); if (!d) return undefined;
      tried.push(d);
      const def = SHEER_DEVICES[d];
      if (d === "cave" || rise < def.rise[0] || rise > def.rise[1]) continue;
      const spots = faceSpots(hiC, loC, def.width, rise, want);
      if (!spots.length) continue;
      // 가운데 쪽 자리 · 들어오는 칸에서 먼 쪽을 고르지 않는다 — 자리 해시로
      const s = spots[Math.floor(rnd() * spots.length)]!;
      const cells: number[] = [];
      for (let i = 0; i < def.width; i++) for (let k = 1; k <= 2; k++) { const c = idx(s.x + i, s.y + k); ramps[c] = def.code; cells.push(c); }
      for (let i = -1; i <= def.width; i++) for (let k = -1; k <= 3; k++) if (inMap(s.x + i, s.y + k)) taken[idx(s.x + i, s.y + k)] = 1;
      used.push(d);
      const dev: SheerDevice = { kind: d, lo: compLv[loC]!, hi: compLv[hiC]!, cells, ...(extra ? { extra } : {}) };
      devices.push(dev); return dev;
    }
  };
  /** 같은 단의 두 덩이를 빈 곳 위 동서 다리(판 칸 = 코드 9, 단은 둑과 같다)로 잇는다 — 판 2~11칸. */
  const placeBridge = (a: number, b: number, extra = false): SheerDevice | undefined => {
    let best: { y: number; x0: number; x1: number } | undefined;
    for (let y = 2; y < H - 2; y++) for (let x = 1; x < W - 1; x++) {
      if (comp[idx(x, y)] !== a) continue;
      for (const dir of [1, -1]) {
        let k = x + dir; while (k > 0 && k < W - 1 && lv[idx(k, y)] === 0) k += dir;
        if (comp[idx(k, y)] !== b) continue;
        const x0 = Math.min(x, k) + 1, x1 = Math.max(x, k) - 1, len = x1 - x0 + 1;
        if (len < 2 || len > 11) continue;
        // 둑 끝이 북쪽 가장자리(위 칸이 같은 덩이)여야 다리가 면 위가 아니라 윗면에 닿는다. 다리 위아래 줄은 하늘.
        if (comp[idx(x, y - 1)] !== a || comp[idx(k, y - 1)] !== b || busy(idx(x, y)) || busy(idx(k, y))) continue;
        let clear = true; for (let q = x0; q <= x1 && clear; q++) if (lv[idx(q, y - 1)] || lv[idx(q, y + 1)]) clear = false;
        if (!clear) continue;
        if (!best || len < best.x1 - best.x0 + 1 || (len === best.x1 - best.x0 + 1 && Math.abs(y - H / 2) < Math.abs(best.y - H / 2))) best = { y, x0, x1 };
      }
    }
    if (!best) return undefined;
    const L = compLv[a]!, cells: number[] = [];
    for (let x = best.x0; x <= best.x1; x++) { const c = idx(x, best.y); ramps[c] = 9; lv[c] = L; cells.push(c); taken[c] = 1; }
    for (const x of [best.x0 - 1, best.x1 + 1]) taken[idx(x, best.y)] = 1;
    used.push("bridge");
    const dev: SheerDevice = { kind: "bridge", lo: L, hi: L, cells, ...(extra ? { extra } : {}) };
    devices.push(dev); return dev;
  };
  // 간선: 남쪽 면으로 닿는 쌍(높은 덩이 → 바로 아래 낮은 덩이), 같은 단 덩이 쌍(빈 곳 건넘)
  const steps = new Map<string, { hi: number; lo: number; n: number }>();
  for (let c = 0; c < N - W; c++) {
    const a = comp[c]!, b = comp[c + W]!;
    if (a < 0 || b < 0 || a === b || compLv[a]! <= compLv[b]!) continue;
    const key = `${a}>${b}`, e = steps.get(key); if (e) e.n++; else steps.set(key, { hi: a, lo: b, n: 1 });
  }
  const ledgeComp = deadEnd ? comp[idx(deadEnd.x, deadEnd.y)]! : -1;
  const start = comp[idx(entry.x, entry.y)]!;
  const joined = new Set<number>([start]);
  const sameLevelPairs: [number, number][] = [];
  for (let a = 0; a < compLv.length; a++) for (let b = a + 1; b < compLv.length; b++) if (compLv[a] === compLv[b]) sameLevelPairs.push([a, b]);
  // 나무: 들어오는 덩이에서 넓혀 가며, 이웃 덩이마다 장치 하나(면 간선을 먼저, 없으면 다리). 막다른 턱은 맨 끝에 그 갈래의 ledge 장치로.
  for (let guard = 0; guard < compLv.length * 3; guard++) {
    let did = false;
    const order = [...steps.values()].filter((e) => e.n >= 2).sort((p, q) => q.n - p.n);
    for (const e of order) {
      const [inside, outside] = joined.has(e.hi) && !joined.has(e.lo) ? [e.hi, e.lo] : joined.has(e.lo) && !joined.has(e.hi) ? [e.lo, e.hi] : [-1, -1];
      if (inside < 0 || outside === ledgeComp || compCells[outside]!.length < 4) continue;
      if (placeStep(e.hi, e.lo)) { joined.add(outside); did = true; break; }
    }
    if (did) continue;
    for (const [a, b] of sameLevelPairs) {
      const [inside, outside] = joined.has(a) && !joined.has(b) ? [a, b] : joined.has(b) && !joined.has(a) ? [b, a] : [-1, -1];
      if (inside < 0 || outside === ledgeComp || compCells[outside]!.length < 4) continue;
      if (placeBridge(inside, outside)) { joined.add(outside); did = true; break; }
    }
    if (!did) break;
  }
  // 막다른 턱: 그 갈래의 장치 하나
  if (ledgeComp >= 0) {
    let dev: SheerDevice | undefined;
    if (kind.ledge === "bridge") {
      for (const c of [...joined]) if (compLv[c] === compLv[ledgeComp] && (dev = placeBridge(c, ledgeComp))) break;
      if (!dev) for (const e of steps.values()) if (e.hi === ledgeComp && joined.has(e.lo) && (dev = placeStep(e.hi, e.lo))) break;
    } else {
      for (const e of steps.values()) if (e.hi === ledgeComp && joined.has(e.lo) && (dev = placeStep(e.hi, e.lo))) break;
    }
    if (dev) joined.add(ledgeComp); else warnings.push("the dead-end ledge has no device spot");
  }
  for (let c = 0; c < compLv.length; c++) if (!joined.has(c) && compCells[c]!.length >= 4) warnings.push(`level ${compLv[c]} area at (${compCells[c]![0]! % W},${Math.floor(compCells[c]![0]! / W)}) (${compCells[c]!.length} cells) has no device`);
  // ---------- 6. 가려진 칸 ----------
  const hidden = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const L = lv[idx(x, y)]!;
    for (let k = 1; k <= FACE * 5 && y + k < H; k++) { const M = lv[idx(x, y + k)]!; if (M > L && k <= FACE * (M - L)) { hidden[idx(x, y)] = 1; break; } }
  }
  // ---------- 7. 볼거리: 가장 높은 단의 가려지지 않은 자리 ----------
  let landmark: SheerPlan["landmark"];
  {
    const tops = [...new Set([...lv].filter((v) => v > 0))].sort((a, b) => b - a);
    for (const T of tops) for (const kit of kind.landmark) {
      if (landmark) break;
      const [kw, kh] = KIT_SIZE[kit] ?? [2, 2];
      const spots: { x: number; y: number; d: number }[] = [];
      for (let y = 1; y + kh + 1 < H; y++) for (let x = 1; x + kw < W - 1; x++) {
        let ok = true;
        for (let j = -1; j <= kh && ok; j++) for (let i = -1; i <= kw; i++) { const c = idx(x + i, y + j); if (!inMap(x + i, y + j) || lv[c] !== T || water[c] || ramps[c] || taken[c] || ledge.has(c) || (j >= 0 && hidden[c])) { ok = false; break; } }
        if (ok) spots.push({ x, y, d: Math.abs(x + kw / 2 - W / 2) * 0.3 + y });
      }
      if (!spots.length) continue;
      spots.sort((a, b) => a.d - b.d);
      const s = spots[Math.min(spots.length - 1, Math.floor(rnd() * Math.min(3, spots.length)))]!;
      landmark = { kit, x: s.x, y: s.y, w: kw, h: kh, front: { x: s.x + Math.floor(kw / 2), y: s.y + kh } };
      for (let j = -1; j <= kh; j++) for (let i = -1; i <= kw; i++) if (inMap(s.x + i, s.y + j)) taken[idx(s.x + i, s.y + j)] = 1;
      break;
    }
    if (!landmark) warnings.push("no room for the landmark on the top level");
  }
  // ---------- 8. 통행 보증(높이 규칙만 — 그림 칸은 시공 쪽이 한 번 더 본다) ----------
  const fords: number[] = [];
  const relief: ReliefData = { width: W, height: H, levels: Array.from(lv), ramps: Array.from(ramps), style: "sheer" };
  const sealed: number[] = [], forest = new Uint8Array(N);
  {
    const goals = [...exits, ...(landmark ? [landmark.front] : []), ...(deadEnd ? [deadEnd] : [])];
    const dry = () => { const w = new Uint8Array(N); for (let c = 0; c < N; c++) w[c] = water[c] && !fords.includes(c) ? 1 : 0; return w; };
    /** 닿은 칸과 닿지 않은 칸을 가르는 물 줄(동서 2~6칸, 양 둑이 같은 단 뭍) 가운데 가장 짧은 것에 널다리를 놓는다. */
    const placeFord = (seen: ReadonlySet<number>, target: ReadonlySet<number>): boolean => {
      let best: number[] | undefined;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const a = idx(x, y); if (!water[a] || water[a - 1] || fords.includes(a)) continue;
        let e = x; while (e + 1 < W && water[idx(e + 1, y)]) e++;
        const l = idx(x - 1, y), r = idx(e + 1, y), run = e - x + 1;
        if (run < 1 || run > 8 || e + 1 >= W || lv[l] !== lv[r] || lv[l] !== lv[a] || ramps[l] || ramps[r]) continue;
        if (!((seen.has(l) && target.has(r)) || (seen.has(r) && target.has(l)))) continue;
        // 폭포 물보라 바로 밑 두 줄에는 널다리를 걸지 않는다(물보라 위에 판이 얹혀 보인다)
        if (falls.some((f) => y > f.y && y <= f.y + 2 && e >= f.x0 - 1 && x <= f.x1 + 1)) continue;
        const cells = []; for (let q = x; q <= e; q++) cells.push(idx(q, y));
        if (!best || cells.length < best.length) best = cells;
      }
      if (!best) return false;
      fords.push(...best); return true;
    };
    const given = new Set<number>();
    for (let round = 0; round < 12; round++) {
      relief.levels = Array.from(lv); relief.ramps = Array.from(ramps);
      const seen = floodRelief(relief, entry, dry());
      // 목표 + 닿지 않은 큰 뭍(12칸 이상 — 물이나 단이 갈라 놓은 땅)
      const islands: Cell[] = [];
      { const mark = new Uint8Array(N); const w = dry();
        for (let s0 = 0; s0 < N; s0++) {
          if (mark[s0] || seen.has(s0) || !lv[s0] || w[s0] || ledge.has(s0)) continue;
          const q = [s0]; mark[s0] = 1;
          for (let h = 0; h < q.length; h++) { const c = q[h]!, x = c % W; for (const m of [c - W, c + W, x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1]) if (m >= 0 && m < N && !mark[m] && !seen.has(m) && lv[m] === lv[s0] && !w[m]) { mark[m] = 1; q.push(m); } }
          if (q.length >= 12) islands.push({ x: q[0]! % W, y: Math.floor(q[0]! / W) });
        } }
      const missing = [...goals.filter((g) => !seen.has(idx(g.x, g.y)) && !given.has(idx(g.x, g.y))), ...islands.filter((i) => !given.has(idx(i.x, i.y)))];
      if (!missing.length) break;
      const g = missing[0]!, isGoal = goals.includes(g), giveUp = (why: string) => {
        given.add(idx(g.x, g.y));
        // 닿지 않는 출구는 같은 변의 닿는 칸으로 옮긴다(엽 귀퉁이에 끊긴 띠에 선 출구)
        const ei = exits.findIndex((e) => e.x === g.x && e.y === g.y);
        const moved = ei >= 0 ? edgeCell(exits[ei]!.side, (c) => seen.has(c) && walkable(c)) : undefined;
        if (moved) { exits[ei] = moved; goals[goals.indexOf(g)] = moved; return; }
        if (isGoal) warnings.push(why);
      };
      const target = comp[idx(g.x, g.y)]!;
      const reached = new Set([...seen].map((c) => comp[c]!).filter((c) => c >= 0));
      let dev: SheerDevice | undefined;
      if (reached.has(target)) {
        // 같은 덩이인데 물이 갈랐다 — 널다리, 안 되면 갈린 쪽(there)과 닿은 쪽을 잇는 면 장치
        const there = floodRelief(relief, g, dry());
        if (placeFord(seen, there)) continue;
        const join = (a: number, b: number) => (there.has(a) && seen.has(b)) || (seen.has(a) && there.has(b));
        for (const e of steps.values()) if ((there.has(compCells[e.hi]![0]!) || reached.has(e.hi)) && (dev = placeStep(e.hi, e.lo, true, join))) break;
        if (!dev) giveUp(`(${g.x},${g.y}) is cut off by water and no ford or device fits`);
        continue;
      }
      for (const e of steps.values()) {
        if ((e.hi === target && reached.has(e.lo)) || (e.lo === target && reached.has(e.hi))) { dev = placeStep(e.hi, e.lo, true); if (dev) break; }
      }
      if (!dev) for (const r of reached) if (compLv[r] === compLv[target] && (dev = placeBridge(r, target, true))) break;
      // 목표가 아닌 외딴 뭍은 장치가 안 맞으면 버린다(아래에서 막는다)
      if (!dev) giveUp(`(${g.x},${g.y}) on level ${lv[idx(g.x, g.y)]} is not reachable and no device fits`);
    }
    relief.levels = Array.from(lv); relief.ramps = Array.from(ramps);
    // ---------- 9. 바깥 숲: 길 뼈대(들어오는 칸에서 목표마다 최단 길, 둘레 두 칸)를 비우고 맵 가장자리에서 물결치는 깊이만큼 ----------
    if (kind.forest) {
      const w = dry(), prev = new Int32Array(N).fill(-1), s0 = idx(entry.x, entry.y), q = [s0]; prev[s0] = s0;
      for (let h = 0; h < q.length; h++) { const c = q[h]!, x = c % W, y = (c - x) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy, n = ny * W + nx; if (!inMap(nx, ny) || prev[n] >= 0 || w[n] || !reliefAllowsStep(relief, x, y, nx, ny)) continue; prev[n] = c; q.push(n); } }
      const keep = new Uint8Array(N), mark = (c: number, r: number) => { const x = c % W, y = (c - x) / W; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inMap(x + dx, y + dy)) keep[idx(x + dx, y + dy)] = 1; };
      // 목표마다 · 장치마다(위 끝 · 아래 끝) 길을 남긴다 — 장치가 숲 속으로 오르면 그 너머가 갇힌다
      const ends = devices.flatMap((d) => { const xs = d.cells.map((c) => c % W), ys = d.cells.map((c) => Math.floor(c / W)); const x = xs[0]!;
        return d.kind === "bridge" ? [{ x: Math.min(...xs) - 1, y: ys[0]! }, { x: Math.max(...xs) + 1, y: ys[0]! }] : [{ x, y: Math.min(...ys) - 1 }, { x, y: Math.max(...ys) + 1 }]; });
      for (const g of [...exits, ...(landmark ? [landmark.front] : []), ...(deadEnd ? [deadEnd] : []), ...ends.filter((e) => inMap(e.x, e.y))]) { let c = idx(g.x, g.y); if (prev[c] < 0) continue; for (let k = 0; k < N && c !== s0; k++) { mark(c, 2); c = prev[c]!; } }
      mark(s0, 2);
      for (let c = 0; c < N; c++) if (taken[c] || ramps[c] || ledge.has(c) || water[c]) mark(c, 1);
      for (const f of falls) for (let x = f.x0 - 1; x <= f.x1 + 1; x++) for (let k = -1; k <= 3; k++) if (inMap(x, f.y + k)) keep[idx(x, f.y + k)] = 1;
      const noise = (x: number, y: number, g: number, sd: number) => { const fx = x / g, fy = y / g, x0 = Math.floor(fx), y0 = Math.floor(fy); let tx = fx - x0, ty = fy - y0; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        const hv = (a: number, b: number) => { let v = Math.imul(a * 73856093 ^ b * 19349663 ^ sd * 83492791, 0x27d4eb2d); v ^= v >>> 15; v = Math.imul(v, 0x85ebca6b); v ^= v >>> 13; return (v >>> 0) / 4294967296; };
        return hv(x0, y0) * (1 - tx) * (1 - ty) + hv(x0 + 1, y0) * tx * (1 - ty) + hv(x0, y0 + 1) * (1 - tx) * ty + hv(x0 + 1, y0 + 1) * tx * ty; };
      const deep = kind.forest * Math.min(W, H) * 0.42;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const c = idx(x, y); if (!lv[c] || keep[c]) continue;
        const d = Math.min(x, W - 1 - x, H - 1 - y, y + 2);
        if (d < deep * (0.35 + 0.9 * noise(x, y, 5, seed + 17)) + 1.5 * (noise(x, y, 2, seed + 19) - 0.5)) forest[c] = 1;
      }
      // 숲이 가둔 풀밭(뼈대에서 닿지 않는 걷는 칸)도 숲으로
      const open = floodRelief(relief, entry, new Uint8Array(N).map((_, c) => (w[c] || forest[c] ? 1 : 0)));
      for (let c = 0; c < N; c++) if (lv[c] && !w[c] && !open.has(c) && !ramps[c] && !ledge.has(c) && !keep[c]) forest[c] = 1;
    }
    const seen = floodRelief(relief, entry, dry());
    for (let c = 0; c < N; c++) if (lv[c]! >= 1 && !water[c] && !seen.has(c) && !ramps[c]) sealed.push(c);
  }
  return { W, H, kind, seed, levels: lv, ramps, water, falls, fords, devices, entry, exits, ...(landmark ? { landmark } : {}), ...(deadEnd ? { deadEnd } : {}), sealed, hidden, forest, levelCount: new Set([...lv].filter((v) => v > 0)).size, warnings };
}

/** 볼거리 킷 크기(칸) — 표에 오른 것만. 시공 쪽이 칩셋에서 실제 크기를 다시 본다. */
const KIT_SIZE: Readonly<Record<string, readonly [number, number]>> = {
  "bd-obj-seal-altar": [2, 2], "bd-pick-mountain-pass-shrine": [2, 3], "bd-obj-rock-outcrop": [3, 3], "bd-org-shrine-stone": [2, 3], "bd-pick-coast-cliff-road-shrine": [2, 3],
};

function maxIn(a: Uint8Array): number { let m = 0; for (const v of a) if (v > m) m = v; return m; }

/** 렌더러가 깎을 칸(한 칸짜리 돌기·띠 — render.ts effectiveHeights)을 미리 깎아 계획과 그림이 같게 한다. */
function tidy(lv: Uint8Array, W: number, H: number): void {
  const g = effectiveHeights(Array.from({ length: H }, (_, y) => Array.from(lv.subarray(y * W, (y + 1) * W))));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) lv[y * W + x] = g[y]![x]!;
}

/** 작은 단 조각(8칸 미만 — 엽 끝에 남은 부스러기)은 둘레의 낮은 단으로 내린다. 막다른 턱은 그대로. */
function mergeSlivers(lv: Uint8Array, W: number, H: number, keep: ReadonlySet<number>): void {
  const N = W * H;
  for (let round = 0; round < 4; round++) {
    const seen = new Uint8Array(N); let changed = false;
    for (let s = 0; s < N; s++) {
      if (!lv[s] || seen[s] || keep.has(s)) continue;
      const q = [s]; seen[s] = 1; let lower = 0;
      for (let h = 0; h < q.length; h++) { const c = q[h]!, x = c % W; for (const m of [c - W, c + W, x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1]) { if (m < 0 || m >= N) continue; if (lv[m] === lv[s] && !seen[m] && !keep.has(m)) { seen[m] = 1; q.push(m); } else if (lv[m]! < lv[s]!) lower = Math.max(lower, lv[m]!); } }
      if (q.length < 8) { for (const c of q) lv[c] = lower; changed = true; }
    }
    if (!changed) break;
  }
}

/** 높이 규칙만으로 물들이기(walk.ts reliefAllowsStep) — 물 칸은 건너지 않는다. */
export function floodRelief(r: ReliefData, from: Cell, water?: Uint8Array): Set<number> {
  invalidateReliefSlopes(r);
  const W = r.width, H = r.height, start = from.y * W + from.x, seen = new Set<number>([start]), q = [start];
  for (let h = 0; h < q.length; h++) {
    const c = q[h]!, x = c % W, y = (c - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy, n = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(n) || water?.[n] || !reliefAllowsStep(r, x, y, nx, ny)) continue;
      seen.add(n); q.push(n);
    }
  }
  return seen;
}
