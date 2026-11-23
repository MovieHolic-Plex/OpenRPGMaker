// 길·필드·던전 맵 생성기(2026-11-23 monster-map-generator).
// 예전에는 world.ts make() 가 참고 견본(mapTemplates.json)을 칸 그대로 복사해 기본 캠페인 필드·던전 17맵 중 16맵이 견본과 93~100% 같았다.
// 이제 견본은 「문법」으로만 쓴다: 견본 칸을 종류(벽 덩이·바닥·길·물·풀숲·절벽·절벽면·무늬 바닥)로 나누고, 종류별로 이웃 모양 → 타일 규칙을 배운다.
// 배치는 요청 요소(길이·분기·물·절벽·명소)와 씨앗으로 새로 짜고, 배운 규칙으로 칠한 뒤 오토타일 엔진이 가장자리를 다듬는다.
// 결과가 어느 견본과든 겹침 관문(FIELD_OVERLAP_GATE)을 넘으면 다른 씨앗으로 다시 짠다.
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { canMove, layeredPassability } from "@/project/collision";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { shapeAllAutotileGroupsAround } from "@/project/defaults/autotileEngine";
import { maxTemplateOverlap, TEMPLATE_COPY_GATE, type OverlapGrid } from "@/project/mapTemplateOverlap";

export interface FieldTemplate { width: number; height: number; lower: number[]; upper: number[]; tilesetId: string; names: Record<string, number> }

export type FieldLength = "short" | "medium" | "long";
/** 조수·기획서가 고를 수 있는 요청 요소. 빠진 값은 맵 종류의 기본값. */
export interface FieldRequest {
  readonly length?: FieldLength;
  readonly branches?: number;
  readonly water?: boolean;
  readonly cliffs?: boolean;
  readonly landmarks?: number;
  /** 한쪽 가장자리를 따라 흐르는 강(물소리 계곡). 큰길은 반대쪽으로 굽는다. */
  readonly stream?: boolean;
}
export interface FieldPlan extends FieldRequest { readonly exits: "through" | "south"; readonly seed: number }
export interface FieldResult { width: number; height: number; lower: number[]; upper: number[]; overlap: number; closest: string; attempts: number }

export const FIELD_OVERLAP_GATE = TEMPLATE_COPY_GATE;
const MAX_ATTEMPTS = 10;

const WATER_GROUPS = ["rwater", "water", "swater", "oasis", "pond", "shore", "se_pool", "lv_lava", "spring", "deep"];
const PATH_GROUPS = ["clearing", "path", "snowpath", "ashpath", "wdirt", "pave"];
const CLIFF_FACES: readonly (readonly [string, string])[] = [["cliff_g", "gface"], ["cliff_a", "cface"], ["cliff_b", "cface"], ["dcliff", "dface"], ["dcliff2", "dface2"], ["icecliff", "iceface"], ["vcliff", "vface"], ["vcliff2", "vface2"], ["plateau", "gface"]];
/** 미끄럼·장치·출입 칸은 배우지 않는다(무작위로 옮기면 퍼즐이 깨지거나 가짜 문이 생긴다). */
const SPECIAL = /spin|stairs|ladder|exit|_mat|hole|sign|item|capsule|door|cuttree|boulder|warp|sandpit|^ice_at|^ic_at|altar|braille|leader|console|gen$|coil|ledge|_end$|buoy|whirl/;
/** 명소로 놓지 않는 킷(건물·덩이 벽·장치·입구). 나머지 킷 중 견본에 실제로 놓인 것만 명소 후보다. */
const NOT_LANDMARK = /forest|wood|swood|cliff|stairs|mouth|cave|house|center|mart|gym|gable|cabin|shop|two_|apart|dept|hall|office|lighthouse|gate|altar|braille|console|gen|coil|vent|stal_|counter|escalator|healer|^h_|^c_|^g_|sign|boat|wall|bed|rug/;

type Cls = string;
const M = "M", F = "F";

interface Learned {
  cls: Cls[];
  candidates: Map<Cls, number[]>;
  blockCandidates: number[];
  blockOffset: [number, number] | undefined;
  walkable: Set<Cls>;
  path?: Cls; water?: Cls; tall?: boolean; cliff?: Cls; face?: Cls; faceRows: number; patches: Cls[];
  mass: Cls; cave: boolean; voidRing: boolean; seaFrame: boolean; hall: boolean; wallTop: number; obstacles: Cls[];
  landmarks: { name: string; w: number; h: number; lower: number[]; upper: number[] }[];
  depth?: Uint8Array;
}
type Stamp = [kit: number, x: number, y: number];

function rng(seed: number): () => number {
  let a = (Math.imul(seed | 0, 0x9e3779b1) + 0x6d2b79f5) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function fieldSeed(base: number, key: string): number {
  let h = Math.imul(base | 0, 2654435761) ^ 0x51ed27;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

const cache = new WeakMap<FieldTemplate, Learned>();

function learn(tileset: TilesetDef, t: FieldTemplate): Learned {
  const hit = cache.get(t);
  if (hit) return hit;
  const W = t.width, H = t.height, N = W * H;
  const inv = new Map<number, string>();
  for (const [n, v] of Object.entries(t.names)) if (!inv.has(v)) inv.set(v, n);
  const groups = autotileGroupsForTileset(tileset);
  const groupOf = new Map<number, string>();
  for (const g of groups) for (const m of g.memberTileIds) if (!groupOf.has(m)) groupOf.set(m, g.id);
  const count = new Map<string, number>();
  for (const v of t.lower) { const g = groupOf.get(v); if (g) count.set(g, (count.get(g) ?? 0) + 1); }
  const present = (ids: readonly string[]) => ids.filter(id => (count.get(id) ?? 0) >= 6).sort((a, b) => count.get(b)! - count.get(a)!)[0];
  const water = present(WATER_GROUPS), path = present(PATH_GROUPS);
  const pair = CLIFF_FACES.filter(([c, f]) => (count.get(c) ?? 0) >= 6 && (count.get(f) ?? 0) >= 4).sort((a, b) => count.get(b[0])! - count.get(a[0])!)[0];
  const passable = (i: number) => { const p = layeredPassability(tileset, [t.lower[i]!, -1, t.upper[i] ?? -1, -1]); return p.up || p.down || p.left || p.right; };
  const cls: Cls[] = new Array(N);
  const known = new Set<string>([water, path, pair?.[0], pair?.[1]].filter((x): x is string => !!x));
  for (let i = 0; i < N; i++) {
    const g = groupOf.get(t.lower[i]!);
    const name = inv.get(t.lower[i]!) ?? "";
    if (/_void$/.test(name)) cls[i] = "V";
    else if (g && known.has(g)) cls[i] = g;
    else if (/^[wsd]?tall\d/.test(name)) cls[i] = "G";
    else if (g && passable(i) && (count.get(g) ?? 0) >= 8) cls[i] = `p:${g}`;
    else if (g && !/wall|cliff|face/.test(g) && !passable(i) && (count.get(g) ?? 0) >= 8) cls[i] = `o:${g}`;
    else cls[i] = passable(i) ? F : M;
  }
  // 작은 막힘 덩이(나무·바위·표지판 같은 소품)는 바닥으로 본다 — 벽 덩이 규칙에 소품 조각이 섞이지 않게.
  const prop = new Uint8Array(N);
  const seen = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (seen[i] || cls[i] !== M) continue;
    const comp = [i]; seen[i] = 1;
    let edge = false;
    for (let k = 0; k < comp.length; k++) {
      const c = comp[k]!, x = c % W, y = (c / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (!seen[n] && cls[n] === M) { seen[n] = 1; comp.push(n); }
      }
    }
    if (!edge && comp.length < 10) for (const c of comp) { prop[c] = 1; cls[c] = F; }
  }
  const upperOk = (i: number) => { const u = t.upper[i] ?? -1; return u < 0 || /fringe|cap|shade|top/.test(inv.get(u) ?? ""); };
  const candidates = new Map<Cls, number[]>();
  const tileCount = new Map<number, number>();
  for (const v of t.lower) tileCount.set(v, (tileCount.get(v) ?? 0) + 1);
  for (let i = 0; i < N; i++) {
    if (prop[i] || SPECIAL.test(inv.get(t.lower[i]!) ?? "") || SPECIAL.test(inv.get(t.upper[i] ?? -1) ?? "")) continue;
    if (cls[i] !== M && !upperOk(i)) continue;
    // 바닥 후보에서 드문 타일과 오토타일 조각(다른 무늬의 가장자리)은 뺀다 — 빈 땅에 세모 조각이 흩어졌다.
    if (cls[i] === F && ((tileCount.get(t.lower[i]!) ?? 0) < 3 || groupOf.has(t.lower[i]!))) continue;
    let list = candidates.get(cls[i]!);
    if (!list) candidates.set(cls[i]!, (list = []));
    list.push(i);
  }
  // 2×2 덩이 그림(숲·나무 벽): 같은 짝 칸끼리 붙여 옮긴다. 덩이 위상은 견본의 「.0.0」 칸 위치에서 잰다.
  const parity = new Map<string, number>();
  for (let i = 0; i < N; i++) if (cls[i] === M && /\.0\.0$/.test(inv.get(t.lower[i]!) ?? "")) { const k = `${(i % W) & 1},${((i / W) | 0) & 1}`; parity.set(k, (parity.get(k) ?? 0) + 1); }
  const best = [...parity.entries()].sort((a, b) => b[1] - a[1])[0];
  const blockOffset = best && best[1] >= 4 ? best[0].split(",").map(Number) as [number, number] : undefined;
  const blockCandidates: number[] = [];
  if (blockOffset) for (let y = blockOffset[1]; y + 1 < H; y += 2) for (let x = blockOffset[0]; x + 1 < W; x += 2) {
    const cells = [y * W + x, y * W + x + 1, (y + 1) * W + x, (y + 1) * W + x + 1];
    if (cells.every(c => cls[c] === M && !prop[c] && !SPECIAL.test(inv.get(t.lower[c]!) ?? ""))) blockCandidates.push(y * W + x);
  }
  let faceRows = 2;
  if (pair) {
    const runs: number[] = [];
    for (let x = 0; x < W; x++) for (let y = 0, run = 0; y <= H; y++) {
      if (y < H && cls[y * W + x] === pair[1]) run++; else { if (run) runs.push(run); run = 0; }
    }
    runs.sort((a, b) => a - b);
    if (runs.length) faceRows = Math.max(1, Math.min(3, runs[runs.length >> 1]!));
  }
  const counts = new Map<Cls, number>();
  for (const c of cls) counts.set(c, (counts.get(c) ?? 0) + 1);
  const walkable = new Set<Cls>([F, "G", ...(path ? [path] : []), ...[...counts.keys()].filter(c => c.startsWith("p:"))]);
  // 테두리 덩이는 견본 테두리(두 칸 띠)에서 가장 많은 막힘 종류다 — 사막은 절벽, 1번길은 숲.
  const ring = new Map<Cls, number>();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = cls[y * W + x]!;
    if ((x < 2 || y < 2 || x >= W - 2 || y >= H - 2) && !walkable.has(c) && c !== "V" && c !== water && c !== pair?.[1]) ring.set(c, (ring.get(c) ?? 0) + 1);
  }
  // 막힘 칸 대부분이 위층 소품(산 소나무 2×3)이면 칸마다 옮기면 나무가 조각난다 — 그런 판은 절벽을 테두리 덩이로 쓴다.
  const massCells = cls.map((c, i) => (c === M ? i : -1)).filter(i => i >= 0);
  const kitMass = massCells.length > 0 && massCells.filter(i => (t.upper[i] ?? -1) >= 0).length > massCells.length * 0.5;
  if (kitMass && pair) ring.delete(M);
  const mass = [...ring.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? M;
  const voidCount = counts.get("V") ?? 0;
  // 명소 후보: 견본에 킷 하나가 통째로 놓인 자리가 있는 킷.
  const landmarks: Learned["landmarks"] = [];
  for (const kit of tileset.structureKits ?? []) {
    const kitName = kit.name ?? "";
    if (!kitName || NOT_LANDMARK.test(kitName) || kit.rows.length > 4 || (kit.rows[0]?.tiles.length ?? 0) > 3) continue;
    const kw = kit.rows[0]!.tiles.length, kh = kit.rows.length;
    const lower = kit.rows.flatMap(r => r.tiles), upper = kit.rows.flatMap(r => Array.from({ length: kw }, (_, dx) => r.upperTiles?.[dx] ?? -1));
    let found = false;
    for (let y = 0; y + kh <= H && !found; y++) for (let x = 0; x + kw <= W && !found; x++) {
      found = lower.every((v, k) => v < 0 || t.lower[(y + ((k / kw) | 0)) * W + x + (k % kw)] === v)
        && upper.every((v, k) => v < 0 || t.upper[(y + ((k / kw) | 0)) * W + x + (k % kw)] === v)
        && [...lower, ...upper].some(v => v >= 0);
    }
    if (found) landmarks.push({ name: kitName, w: kw, h: kh, lower, upper });
  }
  // 큰 방 하나(유적·밤막회사·탑): 걷는 칸이 대부분이고 숲 덩이·어둠 테두리가 없다. 위쪽 벽 줄 수는 견본 가운데 열에서 잰다.
  const walkShare = cls.filter(c => walkable.has(c)).length / N;
  let wallTop = 0;
  while (wallTop < H && !walkable.has(cls[wallTop * W + (W >> 1)]!)) wallTop++;
  // 실내(숲·어둠·물·절벽·풀숲이 없는 판)이거나 걷는 칸이 대부분인 판.
  const hall = voidCount < 10 && !blockOffset && (walkShare > 0.55 || (!water && !pair && (counts.get("G") ?? 0) < 15));
  const learned: Learned = {
    cls, candidates, blockCandidates, blockOffset, walkable, path, water, tall: (counts.get("G") ?? 0) >= 15,
    cliff: pair?.[0], face: pair?.[1], faceRows, patches: [...counts.keys()].filter(c => c.startsWith("p:") && !PATH_GROUPS.includes(c.slice(2)) && counts.get(c)! >= 8),
    mass, cave: voidCount >= 10, voidRing: voidCount >= 10, seaFrame: !!water && (counts.get(M) ?? 0) < N * 0.12 && (counts.get(water) ?? 0) > N * 0.2,
    landmarks, hall, wallTop: Math.max(2, Math.min(4, wallTop)), obstacles: [...counts.keys()].filter(c => c.startsWith("o:")),
  };
  cache.set(t, learned);
  return learned;
}

/** 배치 격자(칸 종류)를 새로 짠다. 출구: through = 북·남 가운데 두 칸, south = 남쪽 가운데만. */
function layout(L: Learned, W: number, H: number, plan: FieldPlan, r: () => number): { g: Cls[]; stamps: Stamp[] } {
  const g: Cls[] = new Array(W * H).fill(L.seaFrame ? L.water! : L.mass);
  const stamps: Stamp[] = [];
  const routeMask = new Uint8Array(W * H);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? L.mass : g[y * W + x]!);
  const set = (x: number, y: number, c: Cls) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = c; };
  const rect = (x0: number, y0: number, w: number, h: number, c: Cls) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, c); };
  const ri = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const top = 3, bottom = H - 3, left = 2, right = W - 2;
  const pathCls = L.path ?? F;
  const cx = W >> 1;
  const carve = (x0: number, y0: number, x1: number, y1: number, c: Cls) => {
    rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0) + 2, Math.abs(y1 - y0) + 2, c);
    for (let y = Math.min(y0, y1); y < Math.max(y0, y1) + 2; y++) for (let x = Math.min(x0, x1); x < Math.max(x0, x1) + 2; x++) if (x >= 0 && y >= 0 && x < W && y < H) routeMask[y * W + x] = 1;
  };
  const route: [number, number][] = [];
  const free = (x0: number, y0: number, w: number, h: number, pad: number) => {
    if (x0 < left || y0 < top || x0 + w > right || y0 + h > bottom) return false;
    // 발자리는 빈 땅, 둘레 pad 칸은 걸을 수 있는 칸(풀숲·무늬 바닥 포함)이면 된다 — 막힘끼리 두 칸 미만으로 붙지 않게.
    for (let yy = y0 - pad; yy < y0 + h + pad; yy++) for (let xx = x0 - pad; xx < x0 + w + pad; xx++) {
      const inside = yy >= y0 && yy < y0 + h && xx >= x0 && xx < x0 + w;
      if (inside ? at(xx, yy) !== F : !L.walkable.has(at(xx, yy))) return false;
    }
    return true;
  };
  const onPath = (x0: number, y0: number, w: number, h: number, pad: number) => {
    for (let yy = y0 - pad; yy < y0 + h + pad; yy++) for (let xx = x0 - pad; xx < x0 + w + pad; xx++) {
      if (xx >= 0 && yy >= 0 && xx < W && yy < H && routeMask[yy * W + xx]) return true;
      if ((yy >= bottom - 1 || yy <= top + 1) && Math.abs(xx - cx) <= 2) return true;
    }
    return false;
  };
  const place = (w: number, h: number, pad: number, keepOffPath: boolean, c: (x0: number, y0: number) => void): boolean => {
    for (let k = 0; k < 80; k++) {
      const x0 = ri(left, right - w), y0 = ri(top, bottom - h);
      if (!free(x0, y0, w, h, pad) || (keepOffPath && onPath(x0, y0, w, h, 1))) continue;
      c(x0, y0); return true;
    }
    return false;
  };
  const blob = (x0: number, y0: number, w: number, h: number, c: Cls, only?: Cls) => {
    const rx = w / 2, ry = h / 2;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const nx = (x + 0.5 - x0 - rx) / rx, ny = (y + 0.5 - y0 - ry) / ry;
      if (nx * nx + ny * ny <= 1.05 + (r() - 0.5) * 0.3 && (!only || at(x, y) === only)) set(x, y, c);
    }
  };
  const landmarks = (n: number) => {
    for (let k = 0; k < n && L.landmarks.length; k++) {
      const kit = Math.floor(r() * L.landmarks.length), { w, h } = L.landmarks[kit]!;
      place(w, h, 2, true, (x0, y0) => { stamps.push([kit, x0, y0]); for (let yy = y0; yy < y0 + h; yy++) for (let xx = x0; xx < x0 + w; xx++) routeMask[yy * W + xx] = 1; });
    }
  };
  if (L.hall) {
    // 큰 방: 위 벽 줄·얇은 테두리, 안쪽은 가로 칸막이 줄(틈 1~2곳)을 3~4줄 간격으로 다르게 놓는다.
    rect(1, L.wallTop, W - 2, H - L.wallTop - 1, F);
    rect(cx - 1, H - 1, 2, 1, F);
    // 네 귀퉁이 중 몇 곳을 벽으로 깎아 방 모양을 판마다 다르게 한다.
    for (const [ex, ey] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      if (r() < 0.45) continue;
      const w = ri(3, Math.max(3, (W >> 2))), h = ri(2, Math.max(2, (H >> 2)));
      rect(ex ? W - 1 - w : 1, ey ? H - 1 - h : L.wallTop, w, h, L.mass);
    }
    rect(cx - 1, H - 4, 2, 4, F);
    if (plan.exits === "through") rect(cx - 1, 0, 2, L.wallTop + 2, F);
    const bar = L.obstacles[0] ?? L.patches[0] ?? L.mass;
    // 칸막이: 가로 줄 또는 세로 줄(씨앗이 고른다), 줄마다 틈 1~2곳.
    const vertical = r() < 0.4;
    if (!vertical) for (let y = L.wallTop + 2 + ri(0, 1); y < H - 4; y += ri(3, 5)) {
      const holes: number[] = Array.from({ length: ri(1, 2) }, () => ri(2, W - 5));
      for (let x = 2; x < W - 2; x++) {
        if (holes.some(hx => x >= hx && x < hx + 2) || (r() < 0.12)) continue;
        if (Math.abs(x - cx) <= 1 && y >= H - 6) continue;
        if (at(x, y) === F && at(x, y + 1) === F) { set(x, y, bar); set(x, y + 1, bar); }
      }
    } else for (let x = 2 + ri(0, 2); x < W - 3; x += ri(4, 6)) {
      if (Math.abs(x - cx) <= 2) continue;
      const holes: number[] = Array.from({ length: ri(1, 2) }, () => ri(L.wallTop + 1, H - 6));
      for (let y = L.wallTop + 1; y < H - 3; y++) {
        if (holes.some(hy => y >= hy && y < hy + 2)) continue;
        if (at(x, y) === F && at(x + 1, y) === F) { set(x, y, bar); set(x + 1, y, bar); }
      }
    }
    landmarks((plan.landmarks ?? 2) + 3);
    return { g, stamps };
  }
  if (L.cave) {
    // 동굴·실내 던전: 방 여럿을 굽은 통로로 잇는다. 입구 통로는 남쪽 가운데.
    const rooms: [number, number, number, number][] = [];
    const want = 3 + Math.min(4, (plan.branches ?? 1) + (plan.length === "long" ? 2 : plan.length === "short" ? 0 : 1));
    for (let k = 0; k < 60 && rooms.length < want; k++) {
      const w = ri(4, Math.max(5, Math.min(9, (W >> 1) - 2))), h = ri(3, Math.max(4, Math.min(7, (H >> 1) - 2)));
      const x = ri(left + 1, right - w - 1), y = ri(top + 1, bottom - h - 1);
      if (rooms.some(([a, b, c, d]) => x < a + c + 2 && x + w + 2 > a && y < b + d + 2 && y + h + 2 > b)) continue;
      rooms.push([x, y, w, h]);
    }
    rooms.sort((a, b) => (b[1] + b[3]) - (a[1] + a[3]));
    for (const [x, y, w, h] of rooms) rect(x, y, w, h, F);
    const centre = ([x, y, w, h]: [number, number, number, number]): [number, number] => [x + (w >> 1), y + (h >> 1)];
    rect(cx - 1, H - 5, 2, 5, F);
    let [px, py] = [cx - 1, H - 5];
    for (const room of rooms) {
      const [qx, qy] = centre(room);
      if (r() < 0.5) { carve(px, py, px, qy, F); carve(px, qy, qx, qy, F); } else { carve(px, py, qx, py, F); carve(qx, py, qx, qy, F); }
      route.push([qx, qy]);
      [px, py] = [qx, qy];
    }
    if (L.water && plan.water !== false) {
      const big = [...rooms].sort((a, b) => b[2] * b[3] - a[2] * a[3])[0];
      if (big && big[2] >= 6 && big[3] >= 5) blob(big[0] + 1 + (big[2] > 7 ? ri(0, 1) : 0), big[1] + 1, Math.max(3, big[2] - 3), Math.max(2, big[3] - 2), L.water, F);
    }
    landmarks((plan.landmarks ?? 2) + rooms.length);
    // 동굴 테두리는 견본처럼 한 칸 깊은 어둠(void)이다 — 벽 덩이 안에 어둠 구멍이 뜨지 않게 테두리 한 줄에만 둔다.
    if (L.voidRing) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && at(x, y) === L.mass) set(x, y, "V");
    }
    return { g, stamps };
  }
  // 들판: 테두리 안쪽을 비우고 테두리를 군데군데 안으로 내민다(자로 그은 띠가 아니게).
  // 바다가 테두리인 판(해변)은 물 위에 모래톱을 둔그렇게 낸다.
  if (L.seaFrame) { blob(left, top - 1, right - left, bottom - top + 3, F); rect(cx - 1, bottom - 1, 2, 4, F); }
  else rect(left, top, right - left, bottom - top, F);
  for (let k = 0; k < (L.seaFrame ? 0 : Math.round((W + H) / 4)); k++) {
    const side = ri(0, 3), w = ri(2, 4), h = ri(2, 3);
    const x = side === 0 ? left : side === 1 ? right - w : ri(left, right - w);
    const y = side === 2 ? top : side === 3 ? bottom - h : ri(top, bottom - h);
    if (Math.abs(x + (w >> 1) - cx) <= 3 && (y <= top + 2 || y + h >= bottom - 2)) continue;
    rect(x, y, w, h, L.mass);
  }
  // 물소리 계곡: 한쪽 가장자리를 따라 굽이치는 강. 큰길은 반대쪽 절반 안에서만 굽는다.
  const streamEast = r() < 0.5;
  const stream = !!(plan.stream && L.water && plan.water !== false && W >= 20);
  if (stream) {
    let sx = streamEast ? right - 6 : left + 1;
    for (let y = 0; y < H; y++) {
      if (y % 4 === 0) sx = Math.max(streamEast ? cx + 3 : left, Math.min(streamEast ? right - 4 : cx - 7, sx + ri(-1, 1)));
      rect(sx, y, 4, 1, L.water!);
    }
  }
  // 큰길: 북 출구에서 남 출구까지 굽이 몇 번.
  const span: [number, number] = stream ? (streamEast ? [left + 2, cx] : [cx - 2, right - 4]) : [left + 2, right - 4];
  const bends = plan.exits === "through" ? ri(2, 3) + (plan.length === "long" ? 1 : 0) : ri(1, 2);
  const ys = Array.from({ length: bends }, (_, k) => Math.round(top + 2 + ((bottom - top - 5) * (k + 1)) / (bends + 1)) + ri(-1, 1));
  let [x, y] = [cx - 1, plan.exits === "through" ? 0 : top + ri(2, 4)];
  for (const yy of ys) {
    const nx = Math.max(span[0], Math.min(span[1], ri(span[0], span[1])));
    carve(x, y, x, yy, pathCls); carve(x, yy, nx, yy, pathCls);
    route.push([x, yy]);
    [x, y] = [nx, yy];
  }
  carve(x, y, x, bottom, pathCls); carve(x, bottom, cx - 1, bottom, pathCls); rect(cx - 1, bottom, 2, 3, pathCls);
  if (plan.exits === "through") rect(cx - 1, 0, 2, top + 1, pathCls);
  // 갈림길: 큰길에서 옆으로 빠져 막다른 빈터(명소 자리)로.
  for (let b = 0; b < (plan.branches ?? 1); b++) {
    const [bx, by] = route[ri(0, Math.max(0, route.length - 1))] ?? [cx, H >> 1];
    const dir = bx < cx ? 1 : -1, len = ri(4, 8);
    const ex = Math.max(left + 1, Math.min(right - 3, bx + dir * len));
    carve(bx, by + 1 < bottom - 2 ? by + 2 : by, ex, by + 2, pathCls);
    rect(Math.max(left, ex - 1), Math.max(top, by), 4, 4, F);
  }
  if (L.water && plan.water !== false && !L.seaFrame && !stream) {
    const n = ri(1, 2);
    for (let k = 0; k < n; k++) { const w = ri(4, 7), h = ri(3, 5); place(w, h, 2, true, (x0, y0) => blob(x0, y0, w, h, L.water!)); }
  }
  if (L.cliff && plan.cliffs !== false) {
    const n = ri(1, 3);
    for (let k = 0; k < n; k++) { const w = ri(4, 7), h = ri(L.faceRows + 2, L.faceRows + 4); place(w, h, 2, true, (x0, y0) => rect(x0, y0, w, h, L.cliff!)); }
  }
  if (L.tall) {
    const n = ri(3, 6) + (plan.length === "long" ? 2 : 0);
    for (let k = 0; k < n; k++) { const w = ri(3, 6), h = ri(2, 4); place(w, h, 0, false, (x0, y0) => { for (let yy = y0; yy < y0 + h; yy++) for (let xx = x0; xx < x0 + w; xx++) if (at(xx, yy) === F) set(xx, yy, "G"); }); }
  }
  for (const p of L.patches) { const n = ri(1, 3); for (let k = 0; k < n; k++) { const w = ri(3, 6), h = ri(2, 4); place(w, h, 0, true, (x0, y0) => blob(x0, y0, w, h, p)); } }
  // 덩이(숲·바위 무더기) 몇 개 — 길에서 한 칸 떨어진 빈 땅에. 바다 테두리 판은 벽 덩이가 소품 줄이라 놓지 않는다.
  const clumps = L.seaFrame ? 0 : ri(2, 4);
  for (let k = 0; k < clumps; k++) { const w = 2 * ri(1, 2), h = 2 * ri(1, 2); place(w, h, 2, true, (x0, y0) => rect(x0, y0, w, h, L.mass)); }
  landmarks((plan.landmarks ?? 2) + Math.round(W * H / 160) + (L.seaFrame ? 6 : 0));
  // 절벽 덩이의 남쪽 가장자리는 절벽면(앞면) 줄이다 — 바닥과 닿는 아래 faceRows 줄을 면으로 바꾼다.
  const faceOf = (c: Cls) => c === L.cliff || (L.mass === L.cliff && c === L.mass);
  if (L.face) for (let xx = 0; xx < W; xx++) for (let yy = H - 1; yy > 0; yy--) {
    if (!L.walkable.has(at(xx, yy)) || !faceOf(at(xx, yy - 1))) continue;
    for (let d = 1; d <= L.faceRows; d++) if (faceOf(at(xx, yy - d)) && faceOf(at(xx, yy - d - 1))) set(xx, yy - d, L.face);
  }
  return { g, stamps };
}

function sameWalk(L: Learned, a: Cls, b: Cls): boolean { return a === b || (L.walkable.has(a) && L.walkable.has(b) && (a === F || b === F) && a !== "G" && b !== "G"); }

/** 칸 종류 격자를 견본에서 배운 규칙으로 칠한다. */
function paint(L: Learned, t: FieldTemplate, g: Cls[], W: number, H: number, seed: number, stamps: readonly Stamp[] = []): { lower: number[]; upper: number[] } {
  const lower = new Array<number>(W * H).fill(-1), upper = new Array<number>(W * H).fill(-1);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? L.mass : g[y * W + x]!);
  const sat = (x: number, y: number) => (x < 0 || y < 0 || x >= t.width || y >= t.height ? L.mass : L.cls[y * t.width + x]!);
  const WINDOW: readonly (readonly [number, number, number])[] = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) (WINDOW as [number, number, number][]).push([dx, dy, Math.abs(dy) <= 1 ? 4 : 2]);
  // 막힘 칸은 「걷는 칸까지 거리」(0~3)도 맞춘다 — 벽 덩이 깊은 곳은 견본의 깊은 칸(어둠·벽 속), 바닥 곁은 벽 면이 오게.
  const distTo = (Wd: number, Hd: number, walk: (x: number, y: number) => boolean) => {
    const d = new Uint8Array(Wd * Hd).fill(3);
    for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
      if (walk(x, y)) { d[y * Wd + x] = 0; continue; }
      for (let r = 1; r <= 2; r++) {
        let near = false;
        for (let dy = -r; dy <= r && !near; dy++) for (let dx = -r; dx <= r && !near; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < Wd && ny < Hd && walk(nx, ny)) near = true;
        }
        if (near) { d[y * Wd + x] = r; break; }
      }
    }
    return d;
  };
  const dT = distTo(W, H, (x, y) => L.walkable.has(g[y * W + x]!));
  const dS = L.depth ??= distTo(t.width, t.height, (x, y) => L.walkable.has(L.cls[y * t.width + x]!));
  const score = (x: number, y: number, s: number) => {
    const sx = s % t.width, sy = (s / t.width) | 0;
    let v = dT[y * W + x] === dS[s] ? 12 : 0;
    for (const [dx, dy, w] of WINDOW) if (sameWalk(L, at(x + dx, y + dy), sat(sx + dx, sy + dy))) v += w;
    return v;
  };
  const hash = (x: number, y: number, k: number) => { let n = Math.imul(x + 11, 374761393) ^ Math.imul(y + 7, 668265263) ^ Math.imul(seed + k, 2246822519); n = Math.imul(n ^ (n >>> 13), 1274126177); return (n ^ (n >>> 16)) >>> 0; };
  const pick = (x: number, y: number, list: readonly number[], scorer: (s: number) => number): number => {
    let best = -1, top: number[] = [];
    for (const s of list) { const v = scorer(s); if (v > best) { best = v; top = [s]; } else if (v === best) top.push(s); }
    // 같은 점수면 칸이 아니라 타일 종류를 고르게 한다 — 견본에 많이 깔린 한 바닥 타일만 나오면 바닥이 단조롭고 견본과도 우연히 겹친다.
    const kinds = new Map<string, number>();
    for (const s of top) { const k = `${t.lower[s]},${t.upper[s] ?? -1}`; if (!kinds.has(k)) kinds.set(k, s); }
    const unique = [...kinds.values()];
    return unique[hash(x, y, 1) % unique.length]!;
  };
  const done = new Uint8Array(W * H);
  if (L.blockOffset && L.blockCandidates.length) {
    const [ox, oy] = L.blockOffset;
    for (let y = ((oy % 2) + 2) % 2; y + 1 < H; y += 2) for (let x = ((ox % 2) + 2) % 2; x + 1 < W; x += 2) {
      const cells = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]] as const;
      if (!cells.every(([cx, cy]) => at(cx, cy) === M)) continue;
      const s = pick(x, y, L.blockCandidates, s0 => cells.reduce((v, [cx, cy], k) => v + score(cx, cy, s0 + (k & 1) + (k >> 1) * t.width), 0));
      cells.forEach(([cx, cy], k) => { const src = s + (k & 1) + (k >> 1) * t.width; lower[cy * W + cx] = t.lower[src]!; upper[cy * W + cx] = t.upper[src] ?? -1; done[cy * W + cx] = 1; });
    }
  }
  const fallback = L.candidates.get(F) ?? [...L.candidates.values()][0]!;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (done[i]) continue;
    const list = L.candidates.get(g[i]!) ?? (L.walkable.has(g[i]!) ? fallback : L.candidates.get(M) ?? fallback);
    const s = pick(x, y, list, s0 => score(x, y, s0) * 8 + (hash(x, y, s0) & 7));
    lower[i] = t.lower[s]!; upper[i] = t.upper[s] ?? -1;
  }
  for (const [k, x0, y0] of stamps) {
    const kit = L.landmarks[k]!;
    kit.lower.forEach((v, j) => { const i = (y0 + ((j / kit.w) | 0)) * W + x0 + (j % kit.w); if (v >= 0) lower[i] = v; if (kit.upper[j]! >= 0) upper[i] = kit.upper[j]!; });
  }
  return { lower, upper };
}

function sizeFor(t: FieldTemplate, plan: FieldPlan, r: () => number): [number, number] {
  const scale = plan.length === "short" ? 0.8 : plan.length === "long" ? 1.25 : 1;
  const w = Math.max(18, Math.min(40, t.width + 2 * Math.floor(r() * 3) - 2));
  const h = Math.max(14, Math.min(48, Math.round(t.height * scale) + 2 * Math.floor(r() * 3) - 1));
  return [w & ~1, h];
}

/**
 * 견본 t 의 문법으로 새 필드 맵을 짓는다. 걷기 검사(출구끼리 이어짐)와 겹침 관문을 통과한 판을 돌려준다.
 * 관문을 넘는 판만 나오면 가장 덜 겹친 판을 돌려준다(겹침은 결과에 남는다).
 */
export function generateFieldMap(project: Project, key: string, t: FieldTemplate, plan: FieldPlan, templates: Readonly<Record<string, OverlapGrid>>): FieldResult {
  const tileset = project.tilesets[t.tilesetId];
  if (!tileset) throw Error(`generateFieldMap: no tileset ${t.tilesetId}`);
  const L = learn(tileset, t);
  const groups = autotileGroupsForTileset(tileset);
  let best: FieldResult | undefined;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const seed = fieldSeed(plan.seed + attempt * 7919, key);
    const r = rng(seed);
    const [W, H] = sizeFor(t, plan, r);
    const { g, stamps } = layout(L, W, H, plan, r);
    const { lower, upper } = paint(L, t, g, W, H, seed, stamps);
    const map = { id: `gen_${key}`, name: key, width: W, height: H, tilesetId: t.tilesetId, tileSize: 16, lowerTiles: lower, upperTiles: upper, events: [] } as unknown as GameMap;
    shapeAllAutotileGroupsAround(map, groups, Array.from({ length: W * H }, (_, i) => ({ x: i % W, y: (i / W) | 0 })));
    if (!connected(project, map, plan)) continue;
    const hit = maxTemplateOverlap({ width: W, height: H, lower: map.lowerTiles, tilesetId: t.tilesetId }, templates, { floor: FIELD_OVERLAP_GATE });
    const result: FieldResult = { width: W, height: H, lower: map.lowerTiles, upper: map.upperTiles, overlap: hit?.overlap ?? 0, closest: hit?.key ?? "", attempts: attempt + 1 };
    if (!best || result.overlap < best.overlap) best = result;
    if (result.overlap < FIELD_OVERLAP_GATE) return result;
  }
  if (!best) throw Error(`generateFieldMap: no walkable layout for ${key}`);
  return best;
}

/** QA 스크립트가 배치 격자·배운 규칙을 들여다보는 입구. */
export const fieldGeneratorInternals = { learn, layout, paint, connected, rng, sizeFor };

/** 남쪽 출구에서 걸어 북쪽 출구(through)에 닿고, 걸을 수 있는 칸의 대부분에 닿는가. */
function connected(project: Project, map: GameMap, plan: FieldPlan): boolean {
  const W = map.width, H = map.height, cx = W >> 1;
  const start = { x: cx - 1, y: H - 2 };
  const seen = new Set([start.y * W + start.x]);
  const queue = [start];
  for (let n = 0; n < queue.length; n++) {
    const p = queue[n]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (q.x < 0 || q.y < 0 || q.x >= W || q.y >= H || seen.has(q.y * W + q.x)) continue;
      if (canMove(project, map, p.x, p.y, q.x, q.y)) { seen.add(q.y * W + q.x); queue.push(q); }
    }
  }
  if (plan.exits === "through" && !seen.has(1 * W + cx - 1) && !seen.has(1 * W + cx)) return false;
  return seen.size >= 40;
}
