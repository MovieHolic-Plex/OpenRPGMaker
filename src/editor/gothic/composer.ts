// 고딕 저택(gothic_manor) 야외 장소 구성기 — 장소 종류와 씨앗만 주면 저택 정원·공동묘지·미술관 앞마당 한 장을 결정론으로 짓는다.
//
// 왜: 조수가 낱칸 칠하기로 흉가 정원을 그리면 철책이 끊기고 문이 길과 안 이어지고 소품이 길을 막는다(jp_city 거리에서 겪은 것과 같다).
//   AI 는 장소 종류·크기·분위기(씨앗·밀도·안개)만 고르고, 배치·조화는 이 함수가 한다(jpCityStreetComposer 와 같은 결론).
//
// 짜임(위→아래): [북쪽 본 건물(저택·예배당·미술관)] [앞마당 포장] [가로 길·곁 건물] [아래 정원·묘역] [남쪽 철책·정문].
//   - 둘레: 무쇠 철책(저택·미술관) 또는 이끼 돌담(묘지) 런, 남쪽 가운데 열린 쌍문(gm-gate-iron-open).
//   - 건물 문은 키트 태그 `출입:x,y`(건물 맨 아래 줄 바로 아래 칸)로 읽고, 길이 그 칸에 꼭 닿게 잇는다(못 이으면 건물을 빼고 경고).
//   - 길·광장은 오토타일(진흙 길·젖은 자갈·판석)이고 서로 다른 길 재료가 만나는 곳은 가장자리 없이 잇는다.
//   - 소품은 놓을 때마다 엔진 통행 규칙(passabilityOf)으로 시작 칸에서 BFS 한다 — 문·정문·잔디 한 칸이라도 끊기면 그 소품을 버린다.
// 층: 1층 = 땅·길·연못, 2층 = 밟는 덧그림(낙엽·이끼·안개·무덤 자리), 3층 = 건물·철책·소품, 4층 = 쓰지 않는다.
// 실내(홀·서재·전시실…)는 이 파일이 아니라 wizarding 조립기(buildWizardingSpace)에 고딕 공간 사양을 넣어 짓는다(tools/gothicPlaceTools.ts).
import { passabilityOf } from "@/project/collision";
import type { AutotileGroup, StructureKitDef, TilesetDef } from "@/project/types";

export type GothicPlaceKind = "manor-grounds" | "graveyard" | "gallery-plaza";
export const GOTHIC_PLACE_KINDS: readonly GothicPlaceKind[] = ["manor-grounds", "graveyard", "gallery-plaza"];
export type GothicDensity = "sparse" | "normal" | "full";

interface Size { readonly min: readonly [number, number]; readonly default: readonly [number, number]; readonly max: readonly [number, number] }
export const GOTHIC_PLACE_INFO: Readonly<Record<GothicPlaceKind, { readonly ko: string; readonly desc: string; readonly size: Size }>> = {
  "manor-grounds": { ko: "흉가 저택과 정원", size: { min: [34, 28], default: [42, 34], max: [64, 48] },
    desc: "북쪽 대저택, 자갈 앞마당, 마차고·온실·우물·분수, 산울타리 진입로, 검은 연못과 마른 버들, 정자, 고사목, 철책과 정문" },
  graveyard: { ko: "공동묘지와 예배당", size: { min: [30, 26], default: [38, 32], max: [60, 48] },
    desc: "북쪽 예배당, 양옆 묘소·지하 납골당 입구, 줄지은 묘비와 무덤 자리, 묘지기 오두막·파헤친 무덤, 까마귀 고사목, 돌담과 정문" },
  "gallery-plaza": { ko: "고딕 미술관 앞마당", size: { min: [28, 24], default: [36, 28], max: [60, 44] },
    desc: "북쪽 미술관, 판석 광장과 마른 분수, 안내판·벤치·등불 기둥, 산울타리, 영구 마차, 무너진 망루, 철책과 정문" },
};

export interface GothicPlaceInput {
  readonly place: GothicPlaceKind; readonly width?: number; readonly height?: number; readonly seed?: number;
  readonly density?: GothicDensity; readonly fog?: boolean;
}
export interface GothicPlaced { readonly kit: string; readonly x: number; readonly y: number; readonly role: "building" | "gate" | "prop" | "decal" }
export interface GothicEntrance { readonly kit: string; readonly name: string; readonly x: number; readonly y: number; readonly access: { x: number; y: number } }
export interface GothicIssue { readonly severity: "error" | "warning"; readonly code: string; readonly message: string }
export interface GothicPlaceResult {
  readonly place: GothicPlaceKind; readonly ko: string; readonly width: number; readonly height: number;
  readonly lowerTiles: number[]; readonly lowerOverlayTiles: number[]; readonly upperTiles: number[]; readonly upperOverlayTiles: number[];
  readonly placed: GothicPlaced[];
  /** 건물 문: (x,y) = 건물 맨 아래 줄의 문 칸(이동 이벤트 자리), access = 그 아래 접근 칸(비워 둔다). */
  readonly entrances: GothicEntrance[];
  /** 맵 밖으로 나가는 정문 칸(남쪽 끝 줄) — 이동 이벤트 자리. */
  readonly exits: { x: number; y: number }[];
  readonly spawn: { x: number; y: number };
  readonly walkableCount: number;
  readonly issues: GothicIssue[];
}

// ───────────────────────────── 결정론 난수
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x: number, y: number, s: number): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + s * 2246822519, 3266489917) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// 칸 쓰임
const FREE = 0, BUILT = 1, PATH = 2, FENCE = 3, PROP = 4, WATER = 5;
type PathKind = "dirt" | "cobble" | "flag";
const PATH_AUTOTILE: Record<PathKind, string> = { dirt: "gm-path-dirt", cobble: "gm-cobble", flag: "gm-flagstone" };

interface Kit { readonly id: string; readonly name: string; readonly w: number; readonly h: number; readonly cells: { dx: number; dy: number; lower: number; upper: number }[]; readonly access: { dx: number; dy: number }[] }

function readKit(k: StructureKitDef): Kit {
  const cells: Kit["cells"] = [];
  k.rows.forEach((row, dy) => {
    for (let dx = 0; dx < k.width; dx++) {
      const lower = row.tiles[dx] ?? -1, upper = row.upperTiles?.[dx] ?? -1;
      if (lower >= 0 || upper >= 0) cells.push({ dx, dy, lower, upper });
    }
  });
  const access: Kit["access"] = [];
  for (const tag of k.ai?.tags ?? []) {
    const m = /^출입:(.+)$/u.exec(tag);
    if (!m) continue;
    for (const pair of m[1]!.trim().split(/\s+/)) { const [ax, ay] = pair.split(",").map(Number); if (Number.isInteger(ax) && Number.isInteger(ay)) access.push({ dx: ax!, dy: ay! }); }
  }
  return { id: k.id, name: k.name ?? k.id, w: k.width, h: k.height, cells, access };
}

class Board {
  readonly n: number;
  L: [Int32Array, Int32Array, Int32Array, Int32Array];
  use: Uint8Array;
  path: Uint8Array;      // PathKind 번호(1 dirt · 2 cobble · 3 flag), 0 = 길 아님
  keep: Uint8Array;      // 비워 둘 칸(문 접근칸·정문 안쪽)
  constructor(readonly W: number, readonly H: number) {
    this.n = W * H;
    this.L = [new Int32Array(this.n).fill(-1), new Int32Array(this.n).fill(-1), new Int32Array(this.n).fill(-1), new Int32Array(this.n).fill(-1)];
    this.use = new Uint8Array(this.n); this.path = new Uint8Array(this.n); this.keep = new Uint8Array(this.n);
  }
  inb(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  snapshot() { return { L: this.L.map((a) => a.slice()) as Board["L"], use: this.use.slice(), path: this.path.slice(), keep: this.keep.slice() }; }
  restore(s: ReturnType<Board["snapshot"]>) { this.L = s.L; this.use = s.use; this.path = s.path; this.keep = s.keep; }
}

const PATH_CODE: Record<PathKind, number> = { dirt: 1, cobble: 2, flag: 3 };

export function composeGothicPlace(input: GothicPlaceInput, tileset: TilesetDef): GothicPlaceResult {
  const info = GOTHIC_PLACE_INFO[input.place];
  const issues: GothicIssue[] = [];
  const err = (code: string, message: string) => issues.push({ severity: "error", code, message });
  const warn = (code: string, message: string) => issues.push({ severity: "warning", code, message });
  const W = input.width ?? info?.size.default[0] ?? 0, H = input.height ?? info?.size.default[1] ?? 0;
  const empty = (): GothicPlaceResult => ({ place: input.place, ko: info?.ko ?? "", width: W, height: H, lowerTiles: [], lowerOverlayTiles: [], upperTiles: [], upperOverlayTiles: [],
    placed: [], entrances: [], exits: [], spawn: { x: 0, y: 0 }, walkableCount: 0, issues });
  if (!info) { err("UNKNOWN_PLACE", `장소 "${String(input.place)}" 가 없다 — ${GOTHIC_PLACE_KINDS.join(", ")}`); return empty(); }
  if (!Number.isInteger(W) || !Number.isInteger(H) || W < info.size.min[0] || H < info.size.min[1] || W > info.size.max[0] || H > info.size.max[1]) {
    err("SIZE_OUT_OF_RANGE", `${info.ko} 크기 ${W}×${H} 는 범위 밖 — 최소 ${info.size.min.join("×")} · 기본 ${info.size.default.join("×")} · 최대 ${info.size.max.join("×")}`);
    return empty();
  }
  const kits = new Map((tileset.structureKits ?? []).map((k) => [k.id, readKit(k)] as const));
  const autos = new Map((tileset.autotileGroups ?? []).map((a) => [a.id, a] as const));
  const floors = new Map<string, number>();
  for (const g of tileset.tileGroups ?? []) { const m = /^gm:floor:(.+)$/.exec(g.id); if (m && g.tileIds.length) floors.set(m[1]!, g.tileIds[0]!); }
  const need = ["gm-gate-iron-open", "gm-bld-manor3", "gm-bld-chapel", "gm-bld-gallery"];
  for (const id of need) if (!kits.has(id)) { err("TILESET_OUTDATED", `조각 ${id} 이 타일셋에 없다 — 프로젝트를 다시 열어 번들 gothic_manor 를 갱신한다`); return empty(); }
  for (const id of ["gm-path-dirt", "gm-cobble", "gm-flagstone", "gm-fence-iron", "gm-wall-stone"]) if (!autos.has(id)) { err("TILESET_OUTDATED", `오토타일 ${id} 이 타일셋에 없다`); return empty(); }

  const seed = Number.isInteger(input.seed) ? (input.seed as number) : 1;
  const rnd = mulberry32(seed * 2654435761 ^ (W * 73856093) ^ (H * 19349663) ^ input.place.length * 83492791);
  const dens = input.density ?? "normal";
  const densF = dens === "sparse" ? 0.55 : dens === "full" ? 1.45 : 1;
  const fog = input.fog !== false;
  const b = new Board(W, H);
  const placed: GothicPlaced[] = [];
  const entrances: GothicEntrance[] = [];
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const ri = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));

  const pass = (t: number) => t >= 0 && t < tileset.passability.length && !!(tileset.passability[t]?.up || tileset.passability[t]?.down || tileset.passability[t]?.left || tileset.passability[t]?.right);
  const isFlat = (t: number) => pass(t) && tileset.priority[t] !== "upper";
  const cellPass = (i: number) => { const p = passabilityOf(tileset, b.L[0][i]!, b.L[1][i]!, b.L[2][i]!, b.L[3][i]!); return p.up || p.down || p.left || p.right; };

  // ── 땅
  const groundMix: Record<GothicPlaceKind, [string, number][]> = {
    // 비슷한 명도의 땅만 섞는다 — 낙엽·진흙 땅을 섞으면 4칸 덩이가 붉은·갈색 네모로 떠서 바닥이 조각보처럼 보였다(QA D2·D3).
    // 낙엽·이끼는 덧그림(gm-ov-leaves·gm-ov-moss)으로 흩는다.
    "manor-grounds": [["gm-ground-grass-a", 0.62], ["gm-ground-grass-b", 0.26], ["gm-ground-grass-c", 0.12]],
    graveyard: [["gm-ground-moss-a", 0.64], ["gm-ground-moss-b", 0.36]],
    "gallery-plaza": [["gm-ground-grass-a", 0.66], ["gm-ground-grass-b", 0.34]],
  };
  const mix = groundMix[input.place].map(([id, w]) => [floors.get(id) ?? floors.get("gm-ground-grass-a") ?? 1, w] as const);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // 덩이진 섞기: 4칸 거친 격자 값 + 칸 값 — 한 칸씩 흩뿌린 소금 무늬를 피한다.
    const v = (hash2(x >> 1, y >> 1, seed) * 0.5 + hash2(x, y, seed + 7) * 0.5);
    let acc = 0, t = mix[0]![0];
    for (const [tile, w] of mix) { acc += w; if (v <= acc) { t = tile; break; } }
    b.L[0][y * W + x] = t;
  }

  // ── 그리기 도우미
  const stamp = (k: Kit, x: number, y: number, role: GothicPlaced["role"], use = BUILT) => {
    for (const c of k.cells) {
      const X = x + c.dx, Y = y + c.dy;
      if (!b.inb(X, Y)) continue;
      const i = Y * W + X;
      if (c.lower >= 0) b.L[0][i] = c.lower;
      if (c.upper >= 0) {
        if (role === "decal" || isFlat(c.upper)) b.L[1][i] = c.upper;
        else { b.L[2][i] = c.upper; b.use[i] = use; }
      }
    }
    placed.push({ kit: k.id, x, y, role });
  };
  const fits = (k: Kit, x: number, y: number, opts: { onPath?: boolean; margin?: number } = {}) => {
    if (x < 1 || y < 1 || x + k.w > W - 1 || y + k.h > H - 1) return false;
    for (const c of k.cells) {
      const i = (y + c.dy) * W + x + c.dx;
      if (b.keep[i]) return false;
      const u = b.use[i]!;
      if (u === PATH ? !opts.onPath : u !== FREE) return false;
    }
    const m = opts.margin ?? 0;
    if (m > 0) for (let yy = y - m; yy < y + k.h + m; yy++) for (let xx = x - m; xx < x + k.w + m; xx++) {
      if (!b.inb(xx, yy) || (xx >= x && xx < x + k.w && yy >= y && yy < y + k.h)) continue;
      const u = b.use[yy * W + xx]!;
      if (u === BUILT || u === PROP) return false;
    }
    return true;
  };
  const setPath = (x: number, y: number, kind: PathKind) => {
    if (!b.inb(x, y)) return;
    const i = y * W + x;
    if (b.use[i] !== FREE && b.use[i] !== PATH) return;
    b.use[i] = PATH;
    if (!b.path[i]) b.path[i] = PATH_CODE[kind];
  };
  const rectPath = (x0: number, y0: number, w: number, h: number, kind: PathKind) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPath(x, y, kind); };
  const keepCell = (x: number, y: number) => { if (b.inb(x, y)) b.keep[y * W + x] = 1; };

  /** 건물 하나 — 자리가 맞으면 찍고 문 접근칸을 길로 남긴다. */
  const building = (id: string, x: number, y: number, required: boolean, spur: PathKind): Kit | null => {
    const k = kits.get(id);
    if (!k) { (required ? err : warn)("MISSING_PIECE", `건물 ${id} 이 타일셋에 없다`); return null; }
    if (!fits(k, x, y)) { (required ? err : warn)("NO_ROOM", `${k.name}(${id}) 이 (${x},${y}) 에 들어가지 않아 뺐다 — 맵을 넓힌다`); return null; }
    stamp(k, x, y, "building");
    for (const a of k.access) {
      const ax = x + a.dx, ay = y + a.dy;
      setPath(ax, ay, spur); keepCell(ax, ay);
      entrances.push({ kit: id, name: k.name, x: ax, y: ay - 1, access: { x: ax, y: ay } });
    }
    return k;
  };
  /** 접근칸에서 가장 가까운 기존 길(접근칸이 아닌 길)까지 빈 칸으로 BFS 해 길을 잇는다. */
  const connect = (from: { x: number; y: number }[], kind: PathKind, avoidRows?: (y: number) => boolean): boolean => {
    const start = new Set(from.map((c) => c.y * W + c.x));
    const prev = new Int32Array(W * H).fill(-2);
    const q: number[] = [];
    for (const s of start) { prev[s] = -1; q.push(s); }
    let hit = -1;
    for (let qi = 0; qi < q.length && hit < 0; qi++) {
      const i = q[qi]!, x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
        const X = x + dx, Y = y + dy;
        if (X < 1 || Y < 1 || X >= W - 1 || Y >= H - 1) continue;
        const j = Y * W + X;
        if (prev[j] !== -2) continue;
        if (b.use[j] === PATH && !start.has(j)) { prev[j] = i; hit = j; break; }
        if (b.use[j] !== FREE || (avoidRows && avoidRows(Y))) continue;
        prev[j] = i; q.push(j);
      }
    }
    if (hit < 0) return false;
    for (let i = prev[hit]!; i >= 0; i = prev[i]!) setPath(i % W, (i / W) | 0, kind);
    return true;
  };
  const blob = (cx: number, cy: number, rx: number, ry: number, s: number, jitter = 0.32): Set<number> => {
    const out = new Set<number>();
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d < 1 - jitter / 2 + jitter * hash2(x, y, s)) out.add(y * W + x);
    }
    return out;
  };
  const paintAuto = (cells: (i: number) => boolean, g: AutotileGroup, layer: 0 | 2, same: (x: number, y: number) => boolean) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!cells(i)) continue;
      let m = 0;
      if (same(x, y - 1)) m |= 1; if (same(x + 1, y)) m |= 2; if (same(x, y + 1)) m |= 4; if (same(x - 1, y)) m |= 8;
      if ((g.neighborhood ?? 4) === 8) { if (same(x + 1, y - 1)) m |= 16; if (same(x + 1, y + 1)) m |= 32; if (same(x - 1, y + 1)) m |= 64; if (same(x - 1, y - 1)) m |= 128; }
      const t = g.variantMap[String(m)] ?? g.memberTileIds[0];
      if (t !== undefined && t >= 0) b.L[layer][i] = t;
    }
  };

  // ── 둘레(철책·돌담)와 정문
  const cx = Math.floor(W / 2);
  const gate = kits.get("gm-gate-iron-open")!;
  const gx = cx - 1, gy = H - 2;
  const runId = input.place === "graveyard" ? "gm-wall-stone" : "gm-fence-iron";
  const run = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) { run[x] = 1; run[(H - 1) * W + x] = 1; }
  for (let y = 0; y < H; y++) { run[y * W] = 1; run[y * W + W - 1] = 1; }
  for (let x = gx; x < gx + gate.w; x++) run[(H - 1) * W + x] = 0;
  for (let i = 0; i < W * H; i++) if (run[i]) b.use[i] = FENCE;
  stamp(gate, gx, gy, "gate", FENCE);
  const gateMid = gx + 1;
  for (let y = gy; y < H; y++) { const i = y * W + gateMid; b.use[i] = PATH; b.path[i] = PATH_CODE.dirt; b.keep[i] = 1; }
  const spawn = { x: gateMid, y: gy - 1 };
  const exits = [{ x: gateMid, y: H - 1 }];

  // ════════════════ 장소별 짜임
  const lawnBand = (x: number, y: number) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1;
  let mainAccessY = 0;
  let graveRows: { top: number; bottom: number } | null = null;
  if (input.place === "manor-grounds") {
    const main = building("gm-bld-manor3", cx - 5, 1, true, "cobble");
    if (!main) return empty();
    mainAccessY = 1 + main.h;
    rectPath(cx - 6, mainAccessY, 12, 3, "cobble");                          // 앞마당
    rectPath(cx - 1, mainAccessY, 2, gy - mainAccessY, "cobble");             // 진입로(정문까지)
    const yc = Math.min(H - 10, mainAccessY + 8);
    rectPath(3, yc, W - 6, 2, "dirt");                                         // 가로 길
    // 곁 건물: 가로 길 위 두 칸 띠에 왼쪽 마차고·오른쪽 온실, 길과 이어 준다.
    const left = pick(["gm-bld-carriage", "gm-bld-manor2"] as const);
    const lk = kits.get(left);
    if (lk) { const k = building(left, 2, yc - lk.h - 1, false, "dirt"); if (k) connect(k.access.map((a) => ({ x: 2 + a.dx, y: yc - lk.h - 1 + a.dy })), "dirt"); }
    const right = pick(["gm-bld-greenhouse", "gm-bld-shed", "gm-bld-greenhouse"] as const);
    const rk = kits.get(right);
    if (rk) { const x = W - 3 - rk.w, y = yc - rk.h - 1; const k = building(right, x, y, false, "dirt"); if (k) connect(k.access.map((a) => ({ x: x + a.dx, y: y + a.dy })), "dirt"); }
    // 앞마당 곁 분수(오른쪽)·우물(왼쪽)
    const fk = kits.get("gm-bld-fountain");
    if (fk) { const x = cx + 3, y = mainAccessY + 3; const k = building("gm-bld-fountain", x, y, false, "cobble"); if (k) connect(k.access.map((a) => ({ x: x + a.dx, y: y + a.dy })), "cobble"); }
    const wk = kits.get("gm-bld-well");
    if (wk) { const x = cx - 7, y = mainAccessY + 4; const k = building("gm-bld-well", x, y, false, "dirt"); if (k) connect(k.access.map((a) => ({ x: x + a.dx, y: y + a.dy })), "dirt"); }
    // 아래 정원: 왼쪽 검은 연못, 오른쪽 정자(길로 진입로와 잇는다), 진입로 양옆 산울타리
    const pondCx = Math.max(6, Math.round(W * 0.2)), pondCy = Math.round((yc + 2 + gy) / 2);
    const pond = blob(pondCx, pondCy, Math.max(3.5, W * 0.09), 3.1, seed + 11, 0.12);
    for (const i of pond) if (b.use[i] === FREE) b.use[i] = WATER;
    const gz = kits.get("gm-bld-gazebo");
    if (gz) {
      const x = W - 4 - gz.w - Math.floor(rnd() * 3), y = yc + 3;
      const k = building("gm-bld-gazebo", x, y, false, "dirt");
      if (k) connect(k.access.map((a) => ({ x: x + a.dx, y: y + a.dy })), "dirt");
    }
    const hedge = autos.get("gm-hedge");
    if (hedge) {
      const hm = new Uint8Array(W * H);
      // 남북으로 긴 산울타리는 위에서 본 윗면 띠만 보여 납작한 초록 막대로 읽혔다(QA D4) — 동서로 짧게 두 줄, 진입로 양옆에 앞면이 보이게 둔다.
      const hl = Math.min(6, cx - 6);
      for (const y of [yc + 3, Math.min(gy - 3, yc + 7)]) for (let x = cx - 2 - hl; x < cx + 2 + hl; x++) if ((x < cx - 2 || x > cx + 1) && b.use[y * W + x] === FREE) hm[y * W + x] = 1;
      for (let i = 0; i < W * H; i++) if (hm[i]) b.use[i] = FENCE;
      paintAuto((i) => !!hm[i], hedge, 2, (x, y) => b.inb(x, y) && !!hm[y * W + x]);
    }
  } else if (input.place === "graveyard") {
    const main = building("gm-bld-chapel", cx - 3, 1, true, "flag");
    if (!main) return empty();
    mainAccessY = 1 + main.h;
    rectPath(cx - 4, mainAccessY, 8, 2, "flag");                                 // 예배당 앞 판석
    rectPath(cx - 1, mainAccessY, 2, gy - mainAccessY, "dirt");                  // 가운데 길
    const yc = mainAccessY + 2;
    rectPath(3, yc, W - 6, 1, "dirt");                                           // 가로 길
    const mk = kits.get("gm-bld-mausoleum");
    if (mk) { const x = 3, y = Math.max(1, yc - mk.h - 2); const k = building("gm-bld-mausoleum", x, y, false, "dirt"); if (k) connect(k.access.map((a) => ({ x: x + a.dx, y: y + a.dy })), "dirt"); }
    const ck = kits.get("gm-bld-crypt");
    if (ck) { const x = W - 3 - ck.w, y = Math.max(1, yc - ck.h - 2); const k = building("gm-bld-crypt", x, y, false, "dirt"); if (k) connect(k.access.map((a) => ({ x: x + a.dx, y: y + a.dy })), "dirt"); }
    const bt = kits.get("gm-bld-belltower");
    if (bt && W >= 36) { const x = cx + 5, y = 1; const k = building("gm-bld-belltower", x, y, false, "dirt"); if (k) connect(k.access.map((a) => ({ x: x + a.dx, y: y + a.dy })), "dirt"); }
    // 묘지기 오두막(정문 왼쪽 안) — 정문 안쪽 줄로 잇는다.
    const cot = kits.get("gm-bld-cottage");
    if (cot) {
      const x = 2, y = gy - 1 - cot.h;
      const k = building("gm-bld-cottage", x, y, false, "dirt");
      if (k) { rectPath(x + 1, gy - 1, gateMid - x - 1, 1, "dirt"); }
    }
    graveRows = { top: yc + 2, bottom: gy - 3 };
  } else {
    const main = building("gm-bld-gallery", cx - 5, 1, true, "flag");
    if (!main) return empty();
    mainAccessY = 1 + main.h;
    const ph = Math.min(6, Math.max(4, gy - mainAccessY - 6));
    const pw = Math.min(W - 6, 18);
    rectPath(cx - Math.floor(pw / 2), mainAccessY, pw, ph, "flag");             // 판석 광장
    rectPath(cx - 1, mainAccessY + ph, 2, gy - mainAccessY - ph, "cobble");     // 정문 길
    const fk = kits.get("gm-bld-fountain");
    if (fk) { const x = cx - 2, y = mainAccessY + 1; if (fits(fk, x, y, { onPath: true })) { stamp(fk, x, y, "building"); } }
    const hedge = autos.get("gm-hedge");
    if (hedge) {
      const hm = new Uint8Array(W * H);
      // 광장 아래 가장자리를 따라 동서로(정문 길 자리는 비운다) — 남북 막대로 두면 납작한 띠로 읽혔다(QA D4).
      const y = mainAccessY + ph, px0 = cx - Math.floor(pw / 2);
      for (let x = px0; x < px0 + pw; x++) if ((x < cx - 2 || x > cx + 1) && b.use[y * W + x] === FREE) hm[y * W + x] = 1;
      for (let i = 0; i < W * H; i++) if (hm[i]) b.use[i] = FENCE;
      paintAuto((i) => !!hm[i], hedge, 2, (x, y) => b.inb(x, y) && !!hm[y * W + x]);
    }
    const folly = kits.get("gm-bld-folly");
    if (folly) { const x = 3, y = gy - 2 - folly.h; const k = building("gm-bld-folly", x, y, false, "dirt"); if (k) connect(k.access.map((a) => ({ x: x + a.dx, y: y + a.dy })), "dirt"); }
  }

  // 정문 칸 길 재료는 그 위 진입로와 같게 — 자갈 진입로 끝에 흙 한 칸이 붙으면 문 사이에 갈색 판자처럼 떠 보였다(gemini-4-argon 검수, 2026-10-14).
  const aboveGate = b.path[(gy - 1) * W + gateMid]!;
  if (aboveGate > 0) for (let y = gy; y < H; y++) b.path[y * W + gateMid] = aboveGate;

  // ── 시작 칸에서 닿는가(골조)
  const reach = (): { seen: Uint8Array; count: number } => {
    const seen = new Uint8Array(W * H);
    const s = spawn.y * W + spawn.x;
    if (!cellPass(s)) return { seen, count: 0 };
    const q = [s]; seen[s] = 1; let count = 0;
    while (q.length) {
      const i = q.pop()!; count++;
      const x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j >= 0 && !seen[j] && cellPass(j)) { seen[j] = 1; q.push(j); }
      }
    }
    return { seen, count };
  };
  /** 문제(없으면 null): 문 접근칸·정문·걸을 수 있는 모든 빈 땅이 한 덩이. */
  const problem = (): string | null => {
    const { seen } = reach();
    if (!seen[spawn.y * W + spawn.x]) return "시작 칸이 막혔다";
    for (const e of entrances) if (!seen[e.access.y * W + e.access.x]) return `${e.name} 문 앞 (${e.access.x},${e.access.y}) 에 닿지 못한다`;
    for (const c of exits) if (!seen[c.y * W + c.x]) return "정문에 닿지 못한다";
    for (let i = 0; i < W * H; i++) if (!seen[i] && (b.use[i] === FREE || b.use[i] === PATH) && cellPass(i)) return `빈 땅 (${i % W},${(i / W) | 0}) 이 갇혔다`;
    return null;
  };
  /** 소품 하나를 놓아 보고, 길·문이 끊기면 되돌린다. */
  function tryProp(k: Kit, x: number, y: number, opts: { onPath?: boolean; margin?: number } = {}): boolean {
    if (!fits(k, x, y, opts)) return false;
    const snap = b.snapshot(); const n = placed.length;
    stamp(k, x, y, "prop", PROP);
    if (problem()) { b.restore(snap); placed.length = n; return false; }
    return true;
  }

  // ── 길·연못·안개 이끼 칠하기(소품 전에 — 통행 검사가 실제 칸을 본다)
  const isPath = (x: number, y: number) => !b.inb(x, y) ? false : b.path[y * W + x]! > 0;
  for (const kind of ["dirt", "cobble", "flag"] as PathKind[]) {
    const g = autos.get(PATH_AUTOTILE[kind])!;
    const code = PATH_CODE[kind];
    // 다른 길 재료와 만나는 곳은 같은 것으로 본다(가장자리 없이 이어진다). 맵 끝 정문 아래는 길이 이어진다.
    paintAuto((i) => b.path[i] === code, g, 0, (x, y) => (b.inb(x, y) ? isPath(x, y) : y >= H && Math.abs(x - gateMid) <= 0));
  }
  const pondG = autos.get("gm-pond");
  if (pondG) paintAuto((i) => b.use[i] === WATER, pondG, 0, (x, y) => b.inb(x, y) && b.use[y * W + x] === WATER);
  // 안개 이끼 오토타일(gm-fogmoss)은 잔디 위에서 밝은 초록 깔개처럼, 이끼 땅 위에서는 테두리만 흰 점선으로 떠서(QA D1·D7) 구성기에서 쓰지 않는다.
  // 안개는 흐르는 덧그림(gm-ov-fog)으로만 깐다. 조각은 칩셋에 남아 있다(저작자가 직접 칠할 수 있다).
  // 둘레 런
  const runG = autos.get(runId)!;
  paintAuto((i) => !!run[i], runG, 2, (x, y) => b.inb(x, y) && !!run[y * W + x]);

  const base0 = problem();
  if (base0) { err("LAYOUT_SPLIT", `장소 골조부터 통행이 끊긴다 — ${base0}. 크기를 바꾼다`); return empty(); }

  // ════════════════ 소품
  const near = (x: number, y: number, pred: (u: number, i: number) => boolean, r = 1) => {
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (b.inb(xx, yy) && pred(b.use[yy * W + xx]!, yy * W + xx)) return true;
    return false;
  };
  /** zone 안에서 무작위 자리를 tries 번 찾아 count 개를 놓는다. */
  const scatter = (ids: readonly string[], count: number, zone: (x: number, y: number, k: Kit) => boolean, opts: { onPath?: boolean; margin?: number; tries?: number } = {}) => {
    let done = 0;
    const want = Math.round(count * densF);
    for (let t = 0; t < (opts.tries ?? 60) * Math.max(1, want) && done < want; t++) {
      const k = kits.get(pick(ids));
      if (!k) continue;
      const x = ri(1, W - 1 - k.w), y = ri(1, H - 1 - k.h);
      if (!zone(x, y, k)) continue;
      if (tryProp(k, x, y, opts)) done++;
    }
    return done;
  };
  const byFence = (x: number, y: number, k: Kit) => x <= 3 || y <= 3 || x + k.w >= W - 4 || y + k.h >= H - 4;
  const offPath = (x: number, y: number, k: Kit) => {
    for (let yy = y - 1; yy <= y + k.h; yy++) for (let xx = x - 1; xx <= x + k.w; xx++) if (b.inb(xx, yy) && b.use[yy * W + xx] === PATH) return false;
    return true;
  };
  const besidePath = (x: number, y: number, k: Kit) => !offPath(x, y, k);
  const nextToWater = (x: number, y: number) => near(x, y, (u) => u === WATER);
  const below = (y0: number) => (_x: number, y: number) => y >= y0;

  // 문 앞 등불 기둥·석상(앞마당 양쪽)
  const flank = (id: string, gap: number) => {
    const k = kits.get(id); if (!k) return;
    const ys = mainAccessY;
    for (const x of [cx - 1 - gap - k.w + 1, cx + gap]) if (b.inb(x, ys)) tryProp(k, x, ys, { onPath: true });
  };
  const trees = ["gm-dead-tree", "gm-dead-tree-s", "gm-dead-tree-crows", "gm-willow-dead"];
  const brush = ["gm-bush-dead", "gm-bramble", "gm-thornbush", "gm-rocks-small", "gm-rock-moss", "gm-stump", "gm-mushrooms"];
  if (input.place === "manor-grounds") {
    flank("gm-statue-gargoyle", 3);
    flank("gm-lantern-pillar", 6);
    scatter(["gm-willow-dead"], 1, (x, y, k) => nextToWater(x + 1, y + k.h) && offPath(x, y, k), { margin: 0 });
    scatter(["gm-reeds-dead"], 6, (x, y) => nextToWater(x, y));
    scatter(["gm-lantern-pillar"], 4, (x, y, k) => besidePath(x, y, k) && y > mainAccessY + 2, { margin: 2 });
    scatter(["gm-roses-dead", "gm-bramble"], 4, (x, y, k) => near(x, y, (u) => u === FENCE, 1) && offPath(x, y, k));
    scatter(trees, 7, (x, y, k) => byFence(x, y, k) && offPath(x, y, k), { margin: 1 });
    scatter(["gm-dead-tree-swing"], 1, (x, y, k) => y > H / 2 && offPath(x, y, k), { margin: 1 });
    scatter(["gm-bench"], 2, (x, y, k) => besidePath(x, y, k) && y > mainAccessY + 3, { margin: 1 });
    scatter(["gm-sundial", "gm-planter", "gm-urn"], 3, (x, y, k) => besidePath(x, y, k), { margin: 1 });
    // 일하는 소품은 곁 건물(마차고·작은 저택) 바로 옆에 모은다 — 철책 구석에 흩으면 쓰레기처럼 읽혔다(QA D5).
    const side = placed.find((p) => p.role === "building" && (p.kit === "gm-bld-carriage" || p.kit === "gm-bld-manor2"));
    const sk = side ? kits.get(side.kit) : undefined;
    if (side && sk) scatter(["gm-woodpile", "gm-crates", "gm-cart", "gm-wheelbarrow"], 2, (x, y, k) => x + k.w >= side.x - 2 && x <= side.x + sk.w + 2 && y + k.h >= side.y && y <= side.y + sk.h + 1 && offPath(x, y, k), { margin: 0 });
    scatter(["gm-fallen-log", "gm-pumpkin-lantern", "gm-pumpkin-lantern"], 3, (x, y, k) => offPath(x, y, k) && y > mainAccessY);
    scatter(brush, 12, (x, y, k) => offPath(x, y, k));
  } else if (input.place === "graveyard") {
    flank("gm-statue-gargoyle", 4);
    // 묘역: 가로 길 아래 양쪽에 묘비 줄(4줄 주기 = 묘비·무덤 자리·통로 둘).
    const rowTop = graveRows!.top, rowBottom = graveRows!.bottom;
    const tombs1 = ["gm-tomb-round", "gm-tomb-round", "gm-tomb-broken", "gm-tomb-round"];
    const tombs2 = ["gm-tomb-cross", "gm-tomb-angel", "gm-grave-mound", "gm-tomb-cross", "gm-urn"];
    const big = ["gm-tomb-chest", "gm-sarcophagus"];
    const plot = kits.get("gm-ov-grave-plot");
    const sides: [number, number][] = [[3, cx - 3], [cx + 2, W - 4]];
    for (const [x0, x1] of sides) {
      for (let y = rowTop; y + 1 <= rowBottom; y += 4) {
        for (let x = x0; x <= x1; x += 2) {
          if (rnd() > 0.78 * Math.min(1.15, densF)) continue;
          const r = rnd();
          const id = r < 0.12 ? pick(big) : r < 0.55 ? pick(tombs1) : pick(tombs2);
          const k = kits.get(id);
          if (!k || !fits(k, x, y) || near(x, y, (u) => u === BUILT, 1) || near(x + k.w - 1, y + k.h - 1, (u) => u === BUILT, 1)) continue;
          if (!tryProp(k, x, y)) continue;
          // 무덤 자리 흙은 둘에 하나 정도만 — 모든 둥근 묘비 아래 깔면 갈색 말뚝 줄처럼 읽혔다(QA D6).
          if (k.h === 1 && plot && rnd() < 0.45 && fits(plot, x, y + 1, {})) stamp(plot, x, y + 1, "decal");
          if (k.w === 2) x += 1;
        }
      }
    }
    flank("gm-lantern-pillar", 2);
    scatter(["gm-dead-tree-crows", "gm-dead-tree", "gm-dead-tree-s", "gm-willow-dead"], 6, (x, y, k) => byFence(x, y, k) && offPath(x, y, k), { margin: 1 });
    scatter(["gm-lantern-pillar"], 3, (x, y, k) => besidePath(x, y, k) && y > mainAccessY + 2, { margin: 2 });
    scatter(["gm-grave-open"], 1, (x, y, k) => y > H * 0.55 && offPath(x, y, k), { margin: 1 });
    scatter(["gm-shovel-mound", "gm-wheelbarrow", "gm-coffin"], 2, (x, y, k) => y > H * 0.6 && x < cx && offPath(x, y, k));
    scatter(["gm-bench"], 1, (x, y, k) => besidePath(x, y, k), { margin: 1 });
    scatter(["gm-bones", "gm-bramble", "gm-thornbush", "gm-mushrooms", "gm-stump", "gm-rocks-small"], 10, (x, y, k) => offPath(x, y, k));
    scatter(["gm-pumpkin-lantern"], 2, (x, y, k) => besidePath(x, y, k));
  } else {
    flank("gm-statue-gargoyle", 2);
    flank("gm-planter", 4);
    const top = mainAccessY;
    scatter(["gm-lantern-pillar"], 4, (x, y, k) => besidePath(x, y, k) && y >= top, { margin: 2 });
    scatter(["gm-sign-gallery"], 1, (x, y, k) => besidePath(x, y, k) && y > H * 0.6, { margin: 1 });
    scatter(["gm-bench"], 3, (x, y, k) => besidePath(x, y, k) && y >= top, { margin: 1 });
    scatter(["gm-hearse"], 1, (x, y, k) => y > H * 0.55 && x > cx + 2 && besidePath(x, y, k), { margin: 1 });
    scatter(["gm-urn", "gm-sundial"], 2, (x, y, k) => besidePath(x, y, k), { margin: 1 });
    // 본관 양옆 윗마당은 넓은 빈 잔디로 남았다(gemini-4-argon 검수) — 고사목 숲 덩이를 먼저 둔다.
    scatter(trees, 4, (x, y, k) => y + k.h <= mainAccessY + 1 && (x + k.w < cx - 6 || x > cx + 5) && offPath(x, y, k), { margin: 1 });
    scatter(trees, 6, (x, y, k) => byFence(x, y, k) && offPath(x, y, k), { margin: 1 });
    scatter(["gm-roses-dead", "gm-bramble"], 3, (x, y, k) => near(x, y, (u) => u === FENCE, 1) && offPath(x, y, k));
    scatter(brush, 8, (x, y, k) => offPath(x, y, k) && below(top)(x, y));
  }
  // ── 덧그림(밟는 것) — 통행에 영향 없음
  const decal = (id: string, count: number, zone: (x: number, y: number, i: number) => boolean) => {
    const k = kits.get(id); if (!k) return;
    let done = 0;
    for (let t = 0; t < count * 40 && done < Math.round(count * densF); t++) {
      const x = ri(1, W - 1 - k.w), y = ri(1, H - 1 - k.h);
      let ok = true;
      for (const c of k.cells) { const i = (y + c.dy) * W + x + c.dx; if (!zone(x + c.dx, y + c.dy, i) || b.L[1][i]! >= 0 || b.L[2][i]! >= 0) { ok = false; break; } }
      if (!ok) continue;
      stamp(k, x, y, "decal"); done++;
    }
  };
  const lawn = (_x: number, _y: number, i: number) => b.use[i] === FREE;
  const onPath = (_x: number, _y: number, i: number) => b.use[i] === PATH && !b.keep[i];
  decal("gm-ov-leaves", input.place === "graveyard" ? 8 : 16, lawn);
  decal("gm-ov-moss", 6, lawn);
  decal("gm-ov-puddle", 3, onPath);
  decal("gm-ov-cracks", input.place === "manor-grounds" ? 2 : 3, onPath);
  if (input.place === "graveyard") decal("gm-ov-blood", 1, onPath);
  if (fog) decal("gm-ov-fog", input.place === "graveyard" ? 7 : 4, (x, y, i) => lawnBand(x, y) && (b.use[i] === FREE || b.use[i] === PATH) && !b.keep[i]);

  // ── 빈터 메우기: 소품·덧그림 없는 바닥 정사각형이 5칸을 넘으면 그 한가운데에 덩이 하나(고사목+덤불, 길이면 바닥 덧그림)를 둔다.
  //   조수 실행기의 배치 품질 권고(src/ai/piAgent/layoutQuality.ts, 빈 정사각형 ≤5)와 같은 잣대 — 도구 결과가 이미 기준 안이어야
  //   조수가 「채우기 수리」로 맵을 다시 짓다 들어오는 문을 어긋내지 않는다(2026-10-14 실제 입력창 r1·r2).
  const emptySquare = () => {
    const dp = new Uint16Array((W + 1) * (H + 1)); let best = 0, bx = 0, by = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const p0 = tileset.passability[b.L[0][i]!];
      if (!p0 || !(p0.up || p0.down || p0.left || p0.right) || b.L[1][i]! >= 0 || b.L[2][i]! >= 0 || b.L[3][i]! >= 0) continue;
      const k = (y + 1) * (W + 1) + x + 1;
      dp[k] = Math.min(dp[k - (W + 1)]!, dp[k - 1]!, dp[k - (W + 1) - 1]!) + 1;
      if (dp[k]! > best) { best = dp[k]!; bx = x - best + 1; by = y - best + 1; }
    }
    return { s: best, x: bx, y: by };
  };
  const clump = ["gm-dead-tree-s", "gm-bush-dead", "gm-bramble", "gm-thornbush", "gm-stump", "gm-rock-moss", "gm-mushrooms"];
  const groundMarks = ["gm-ov-leaves", "gm-ov-moss", "gm-ov-cracks", "gm-ov-puddle"];
  for (let round = 0; round < 24; round++) {
    const sq = emptySquare();
    if (sq.s <= 4) break;
    const cells: [number, number][] = [];
    for (let y = sq.y; y < sq.y + sq.s; y++) for (let x = sq.x; x < sq.x + sq.s; x++) cells.push([x, y]);
    const mx = sq.x + (sq.s - 1) / 2, my = sq.y + (sq.s - 1) / 2;
    cells.sort((a, c) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(c[0] - mx, c[1] - my));
    let done = false;
    for (const [x, y] of cells) {
      const i = y * W + x;
      if (b.use[i] === FREE && !b.keep[i]) {
        for (const id of [pick(clump), pick(clump), "gm-rocks-small"]) { const k = kits.get(id); if (k && offPath(x, y, k) && tryProp(k, x, y, { margin: 0 })) { done = true; break; } }
      }
      if (!done) {
        const k = kits.get(b.use[i] === PATH ? pick(groundMarks.slice(2)) : pick(groundMarks.slice(0, 2)));
        if (k && k.cells.every((c) => { const j = (y + c.dy) * W + x + c.dx; return b.inb(x + c.dx, y + c.dy) && (b.use[j] === FREE || (b.use[j] === PATH && !b.keep[j])) && b.L[1][j]! < 0 && b.L[2][j]! < 0; })) { stamp(k, x, y, "decal"); done = true; }
      }
      if (done) break;
    }
    if (!done) break;
  }

  const final = problem();
  if (final) err("LAYOUT_SPLIT", `소품을 놓은 뒤 통행이 끊겼다 — ${final}`);
  return {
    place: input.place, ko: info.ko, width: W, height: H,
    lowerTiles: Array.from(b.L[0]), lowerOverlayTiles: Array.from(b.L[1]), upperTiles: Array.from(b.L[2]), upperOverlayTiles: Array.from(b.L[3]),
    placed, entrances, exits, spawn, walkableCount: reach().count, issues,
  };
}
