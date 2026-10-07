import { mixLavaEdges } from "./lava_edges.mts";
/**
 * 체육관 지역 시트 쇼케이스 + 퍼즐 증명. bash cycle_theme.sh monster-gyms <run>
 * 방 뼈대는 본 시트 showcase_interior.mts 의 Room2 와 같다(뒷벽 두 줄 · 옆·아래 검은 여백 · 벽 아래 그늘 · 아래 가운데 매트).
 * 퍼즐 검사는 엔진 통행(cellPassability)·엔진 미끄럼(slideAfterStep) 위에 이벤트 장치(문 묶음·밟는 스위치·워프 쌍·떨어지는 칸·밀기·회전문)를
 * 상태로 얹은 너비 우선 탐색이다. 관마다 「장치를 쓰면 관장에게 간다」와 「장치 없이는 못 간다」를 둘 다 증명한다.
 */
import { Kit, Field, type Cell, scatterCrust } from "./kitlib.mts";
import { cellPassability } from "../../../project/collision";
import { slideAfterStep } from "../../../project/slideTiles";
import { shapeAllAutotileGroupsAround } from "../../../project/defaults/autotileEngine";

const k = new Kit(process.argv[2]);
const RAISED = new Set(["gy_pb_fire", "gy_pb_ice", "gy_pb_dojo", "gy_hedge", "pb_teal", "pb_elec"]);

type Legend = Record<string, (g: Gym, x: number, y: number) => void>;
/** 바닥 변형 넷을 칸 위치 해시로 고른다(같은 자리 무늬가 2칸 격자로 서지 않게). 얼음관 마름모·다다미 짜임은 원작처럼 바둑판. */
const CHECKER = new Set(["ist", "tatami"]);
const vh = (x: number, y: number) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) % 4; };
/** 방 끝 벽에 닿는 칸막이: 맵 밖 테두리 칸도 같은 그룹으로 보고 모양을 잡은 뒤 테두리를 되돌린다(칸막이 끝과 벽 사이 바닥 틈 0px, QA-L1 N9). */
const WALL_TOUCH = new Set(["gy_pb_fire", "gy_pb_ice", "gy_pb_dojo", "gy_hedge"]);

/** 체육관 방 하나. plan 은 안쪽(x 1..W-2, y 2..H-2) 글자 지도 — 글자마다 legend 가 칸을 정한다('.' = 주 바닥). */
class Gym {
  f: Field; W: number; H: number; fl: string; groups = new Map<string, Cell[]>(); after: (() => void)[] = [];
  marks = new Map<string, Cell[]>();
  constructor(public name: string, public floorKind: string, public wallStyle: string, public plan: string[], legend: Legend) {
    this.H = plan.length + 3; this.W = plan[0].length + 2;
    for (const row of plan) if (row.length !== this.W - 2) throw new Error(`${name}: 줄 길이 ${row.length} ≠ ${this.W - 2}`);
    const W = this.W, H = this.H;
    this.fl = `gy_fl_${floorKind}`;
    this.f = k.field(name, W, H, () => "i2_edge_v", 3);
    for (let y = 2; y < H - 1; y++) for (let x = 1; x < W - 1; x++) this.floor(x, y);
    for (let x = 1; x < W - 1; x++) for (const [r, part] of [[0, "up"], [1, "dn"]] as const) {
      const side = x === 1 ? "_l" : x === W - 2 ? "_r" : "";
      this.f.lo(x, r, `gy_wall_${wallStyle}_${part}${side}`);
    }
    for (let y = 0; y < H - 1; y++) { this.f.lo(0, y, "i2_edge_r"); this.f.lo(W - 1, y, "i2_edge_l"); }
    for (let x = 1; x < W - 1; x++) this.f.lo(x, H - 1, "i2_edge_t");
    this.f.lo(0, H - 1, "i2_edge_rt"); this.f.lo(W - 1, H - 1, "i2_edge_lt");
    for (let j = 0; j < plan.length; j++) for (let i = 0; i < plan[j].length; i++) {
      const ch = plan[j][i], x = i + 1, y = j + 2;
      (this.marks.get(ch) ?? this.marks.set(ch, []).get(ch)!).push([x, y]);
      if (ch === "." || (ch === "L" && !legend.L)) continue;
      const fn = legend[ch];
      if (!fn) throw new Error(`${name}: 글자 ${ch} 의 뜻이 없다`);
      fn(this, x, y);
    }
    // 오토타일(물·용암·낭떠러지·얼음판·칸막이)을 한 번에 칠하고 모양을 맞춘다
    for (const [grp, cells] of this.groups) {
      const ext = WALL_TOUCH.has(grp) ? cells.flatMap(([x, y]): Cell[] => x === 1 ? [[0, y]] : x === W - 2 ? [[W - 1, y]] : []) : [];
      this.f.paint(grp, [...cells, ...ext]);
    }
    this.f.shape([...this.groups.keys()].filter((id) => (k.g(id).interiorVariants ?? []).some((t: number[]) => t.length)));   // 용암 속 기포 변형(던전과 같은 엔진 규칙)
    for (let y = 0; y < H - 1; y++) { this.f.lo(0, y, "i2_edge_r"); this.f.lo(W - 1, y, "i2_edge_l"); }
    this.shadeRaised();
    const mx = W >> 1;
    // 매트 바탕 = 그 자리에 깔린 바닥 재료(풀관은 잔디가 아니라 길 판석 — 길이 문 앞에서 끊기지 않는다, QA-L4 N1)
    const under = /^gy_fl_([a-z]+)/.exec(k.names[this.f.map.lowerTiles[(H - 2) * W + mx]] ?? "")?.[1];
    this.f.lo(mx, H - 2, `gy_mat_${this.matKind ?? under ?? floorKind}`); this.f.lo(mx, H - 1, "g2_edge_mat");
    for (const a of this.after) a();
  }
  matKind?: string;
  at(ch: string) { return this.marks.get(ch) ?? []; }
  one(ch: string): Cell { const c = this.at(ch); if (c.length !== 1) throw new Error(`${this.name}: ${ch} 가 ${c.length}칸`); return c[0]; }
  floor(x: number, y: number, kind = this.floorKind) { this.f.lo(x, y, `gy_fl_${kind}${CHECKER.has(kind) ? (x + y) % 2 : vh(x, y)}`); }
  group(grp: string, x: number, y: number) { (this.groups.get(grp) ?? this.groups.set(grp, []).get(grp)!).push([x, y]); }
  /** 올린 칸막이 앞·옆 바닥 그늘(본 시트 Room2.blocks 와 같은 규칙): 북쪽 이웃이 칸막이·벽 줄·셔터 앞면(또는 뒷벽 밑)이면 _s,
   *  서쪽이 칸막이·얇은 방 벽이면 _e, 둘 다 _se. 김 구멍은 북쪽이 막혔으면 그늘 변형(gy_vent_s). */
  shadeRaised() {
    const mem = new Set<number>();
    for (const g of k.groups) if (RAISED.has(g.id)) for (const t of g.memberTileIds) mem.add(t);
    const L = this.f.map.lowerTiles, W = this.W;
    const nm = (x: number, y: number) => k.names[L[y * W + x]] ?? "";
    const northWall = (x: number, y: number) => y === 2 || mem.has(L[(y - 1) * W + x]) || /^gy_(wall_|qdoor_f|qdoor_open_f|psyv_dn)/.test(nm(x, y - 1));
    const westWall = (x: number, y: number) => mem.has(L[y * W + x - 1]) || /^gy_psyv/.test(nm(x - 1, y));
    for (let y = 2; y < this.H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const name = nm(x, y);
      if (/^gy_vent(_f0)?$/.test(name)) { if (northWall(x, y)) this.f.lo(x, y, "gy_vent_s"); continue; }
      const m = /^(gy_fl_[a-z]+)(\d|_s)$/.exec(name);
      if (!m) continue;
      const n = northWall(x, y), w = westWall(x, y);
      if (!n && !w) continue;
      this.f.lo(x, y, `${m[1]}${w ? (n ? "_se" : "_e") : "_s"}`);
    }
  }
  stamp(n: string, x: number, y: number) { this.f.stamp(n, x, y); }
  /** 뒷벽 가운데 문장 + 석상(관마다 자리가 다르다 — 칸 목록으로 받는다). */
  common(emblem: string, statues: Cell[]) {
    this.stamp(emblem, (this.W >> 1) - 1, 0);
    for (const [x, y] of statues) this.stamp("g_statue", x, y);
  }
  save() { this.f.save(); }
}

// ---- 퍼즐 탐색 ---------------------------------------------------------------------------------
type St = { x: number; y: number; f: number; e: string };
const key = (s: St) => `${s.x},${s.y},${s.f},${s.e}`;
const ck = (x: number, y: number) => `${x},${y}`;
type Rules = {
  /** 문 묶음: 칸들이 open(flags) 일 때만 걸을 수 있다(맵에서는 막힌 칸이 깔려 있다). */
  gates?: { cells: Cell[]; open: (f: number) => boolean }[];
  /** 밟으면 깃발이 바뀌는 칸(스위치·밸브·문양·퀴즈 자리). */
  triggers?: { cell: Cell; set: (f: number) => number }[];
  /** 워프 쌍(밟으면 짝 칸으로 — 양방향). */
  warps?: [Cell, Cell][];
  /** 들어서면 떨어지는 칸(구멍·금 간 얼음) — 그 수는 버린다. */
  falls?: Cell[];
  /** 엔진 미끄럼을 따른다(회전·얼음). */
  slide?: boolean;
  /** 「장치 없음」에서 위층을 지울 칸(얼음 바위를 뺀 얼음판 등). */
  stripUpper?: Cell[];
  /** 회전문 가운데 기둥(처음 팔은 가로). 팔 칸으로 직각 방향에서 걸어 들어가면 90도 돈다(원작 검방울 문법). */
  turnstiles?: Cell[];
  /** 괴력 바위(처음 자리). 밀면 한 칸 간다 — 용암 칸으로 밀면 빠져 그 칸이 걸을 수 있게 된다. */
  boulders?: Cell[];
  sinks?: (x: number, y: number) => boolean;
};
/** 상태 e = "회전문 방향 비트|바위 자리들|메운 칸들". */
function solver(g: Gym, rules: Rules, devices: boolean) {
  const map: any = { ...g.f.map };
  if (!devices && rules.stripUpper) {
    map.upperTiles = [...map.upperTiles];
    for (const [x, y] of rules.stripUpper) map.upperTiles[y * g.W + x] = -1;
  }
  const W = g.W, H = g.H;
  const gateOf = new Map<string, number>();
  (rules.gates ?? []).forEach((gt, i) => gt.cells.forEach(([x, y]) => gateOf.set(ck(x, y), i)));
  const trig = new Map<string, (f: number) => number>();
  for (const t of rules.triggers ?? []) trig.set(ck(...t.cell), t.set);
  const warp = new Map<string, Cell>();
  for (const [a, b] of rules.warps ?? []) { warp.set(ck(...a), b); warp.set(ck(...b), a); }
  const falls = new Set((rules.falls ?? []).map(([x, y]) => ck(x, y)));
  const turns = rules.turnstiles ?? [];
  // 움직이는 물체가 있는 칸은 맵 위층(지금 상태 그림)을 보지 않고 아래층 통행으로 판정한다
  const dyn = new Set<string>();
  for (const [px_, py] of turns) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) dyn.add(ck(px_ + dx, py + dy));
  for (const [x, y] of rules.boulders ?? []) dyn.add(ck(x, y));
  const lowerOpen = (x: number, y: number) => { const p = cellPassability(k.ts, { ...map, upperTiles: map.upperTiles.map(() => -1) } as any, y * W + x); return p.up || p.down || p.left || p.right; };
  const lowerCache = new Map<string, boolean>();
  const lowOpen = (x: number, y: number) => { const kk = ck(x, y); if (!lowerCache.has(kk)) lowerCache.set(kk, lowerOpen(x, y)); return lowerCache.get(kk)!; };
  const parse = (e: string) => { const [t, b, fl] = e.split("|"); return { t: Number(t || 0), b: b ? b.split(";") : [], fl: new Set(fl ? fl.split(";") : []) }; };
  const pack = (t: number, b: string[], fl: Set<string>) => `${t}|${[...b].sort().join(";")}|${[...fl].sort().join(";")}`;
  const armCells = (i: number, t: number): Cell[] => { const [x, y] = turns[i]; return (t >> i) & 1 ? [[x, y - 1], [x, y + 1]] : [[x - 1, y], [x + 1, y]]; };
  const occupied = (x: number, y: number, st: ReturnType<typeof parse>) => {
    for (let i = 0; i < turns.length; i++) {
      if (turns[i][0] === x && turns[i][1] === y) return true;
      if (armCells(i, st.t).some(([a, b]) => a === x && b === y)) return true;
    }
    return st.b.includes(ck(x, y));
  };
  const free = (x: number, y: number, f: number, st: ReturnType<typeof parse>) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const gi = gateOf.get(ck(x, y));
    if (gi !== undefined) return devices && rules.gates![gi].open(f);
    if (occupied(x, y, st)) return false;
    if (st.fl.has(ck(x, y))) return true;
    if (dyn.has(ck(x, y))) return lowOpen(x, y);
    const p = cellPassability(k.ts, map, y * W + x);
    return p.up || p.down || p.left || p.right;
  };
  const next = (s: St): St[] => {
    const out: St[] = [];
    const st = parse(s.e);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let nx = s.x + dx, ny = s.y + dy;
      let t = st.t, bl = st.b, fl = st.fl;
      if (devices) {
        // 회전문: 팔 칸으로 직각 방향에서 들어서면 돈다(돌아갈 자리가 비어 있어야 한다)
        const ti = turns.findIndex((_, i) => armCells(i, st.t).some(([a, b]) => a === nx && b === ny));
        if (ti >= 0) {
          const [px_, py] = turns[ti];
          const vertical = (st.t >> ti) & 1;
          const perpendicular = vertical ? dy === 0 : dx === 0;
          const nt = st.t ^ (1 << ti);
          const after = { ...st, t: nt };
          const others = { ...st, t: nt };
          const ok = perpendicular && armCells(ti, nt).every(([a, b]) => !(a === s.x && b === s.y) && lowOpen(a, b) && !gateOf.has(ck(a, b))
            && !st.b.includes(ck(a, b)) && !turns.some((q, j) => j !== ti && (occupied(a, b, { ...others, t: others.t }) && (q[0] === a && q[1] === b || armCells(j, nt).some(([c, d]) => c === a && d === b)))));
          if (!ok) continue;
          if (!free(nx, ny, s.f, after)) continue;
          t = nt;
          void px_; void py;
        }
        // 괴력 바위: 민다
        const bi = st.b.indexOf(ck(nx, ny));
        if (bi >= 0) {
          const tx = nx + dx, ty = ny + dy;
          const rest = st.b.filter((_, i) => i !== bi);
          const into = { ...st, b: rest };
          if (rules.sinks?.(tx, ty) && !st.fl.has(ck(tx, ty)) && !occupied(tx, ty, into)) { bl = rest; fl = new Set([...st.fl, ck(tx, ty)]); }
          else if (free(tx, ty, s.f, into) && !gateOf.has(ck(tx, ty))) bl = [...rest, ck(tx, ty)];
          else continue;
        }
      }
      const cur = { t, b: bl, fl };
      if (!free(nx, ny, s.f, cur)) continue;
      let dead = falls.has(ck(nx, ny));
      if (rules.slide) {
        let sdx = dx, sdy = dy, kind: "arrow" | "ice" | null = null, guard = 0;
        for (;;) {
          const sl = slideAfterStep(k.ts, map, nx, ny, sdx, sdy, kind);
          if (!sl || ++guard > 300) break;
          if (!free(nx + sl.dx, ny + sl.dy, s.f, cur)) break;
          nx += sl.dx; ny += sl.dy; sdx = sl.dx; sdy = sl.dy; kind = sl.kind;
          if (falls.has(ck(nx, ny))) dead = true;
        }
      }
      if (dead) continue;
      let f = s.f;
      if (devices && trig.has(ck(nx, ny))) f = trig.get(ck(nx, ny))!(f);
      if (devices && warp.has(ck(nx, ny))) { const [wx, wy] = warp.get(ck(nx, ny))!; nx = wx; ny = wy; }
      out.push({ x: nx, y: ny, f, e: pack(t, bl, fl) });
    }
    return out;
  };
  return next;
}
function search(start: St, next: (s: St) => St[], goal: (s: St) => boolean) {
  const seen = new Map<string, string | null>([[key(start), null]]); const q: St[] = [start];
  const byKey = new Map<string, St>([[key(start), start]]);
  while (q.length) {
    const s = q.shift()!;
    if (goal(s)) {
      const path: St[] = []; let c: string | null = key(s);
      while (c) { path.unshift(byKey.get(c)!); c = seen.get(c)!; }
      return { found: true, path, seen };
    }
    for (const n of next(s)) { const kk = key(n); if (seen.has(kk)) continue; seen.set(kk, key(s)); byKey.set(kk, n); q.push(n); }
  }
  return { found: false, path: [] as St[], seen };
}
const isGoal = (cells: Cell[]) => { const s = new Set(cells.map(([x, y]) => ck(x, y))); return (st: St) => s.has(ck(st.x, st.y)); };
/** 증명: 장치로는 간다 + 장치 없이는 못 간다. withoutNext 를 주면 「장치 없음」을 그 규칙으로 돈다(얼음 바위를 뺀 맵 등). */
function prove(g: Gym, what: string, start: Cell, goal: Cell[], withNext: (s: St) => St[], withoutNext: (s: St) => St[], e = "0||") {
  const a = search({ x: start[0], y: start[1], f: 0, e }, withNext, isGoal(goal));
  const b = search({ x: start[0], y: start[1], f: 0, e }, withoutNext, isGoal(goal));
  if (!a.found) k.fails.push(`${g.name}: 장치를 써도 관장에게 못 간다 (${what})`);
  if (b.found) k.fails.push(`${g.name}: 장치 없이 관장에게 간다 — 퍼즐이 길을 못 막는다 (${what})`);
  const moves = a.path.length - 1;
  if (process.env.GDBG) { const cells = new Set([...a.seen.keys()].map((s) => s.split(",").slice(0, 2).join(","))); console.log(g.name, "seen", a.seen.size, [...cells].sort().join(" ")); }
  k.notes.push(`${g.name}: ${what} — 장치로 도달 ${a.found}(${moves}수) · 장치 없이 도달 ${b.found}`);
  return a;
}
const solve = (g: Gym, r: Rules) => [solver(g, r, true), solver(g, r, false)] as const;

const grp = (name: string) => (g: Gym, x: number, y: number) => g.group(name, x, y);
const flo = (kind: string) => (g: Gym, x: number, y: number) => g.floor(x, y, kind);
const over = (base: (g: Gym, x: number, y: number) => void, tile: string) => (g: Gym, x: number, y: number) => { base(g, x, y); g.after.push(() => g.f.up(x, y, tile)); };
const stampAt = (base: (g: Gym, x: number, y: number) => void, obj: string, dy = 0) => (g: Gym, x: number, y: number) => { base(g, x, y); g.after.push(() => g.stamp(obj, x, y + dy)); };
const nop = () => {};
const start = (g: Gym): Cell => [g.W >> 1, g.H - 2];
const s0 = (g: Gym, e = "0||"): St => ({ x: start(g)[0], y: start(g)[1], f: 0, e });
/** 이벤트가 끝난 뒤 상태 맵: 완성 맵을 복사해 장치 칸을 「다음 상태」 칸으로 바꾼다(엔진 도달 검사로 관장까지 열렸는지 본다). */
function after(g: Gym, mutate: (f: Field) => void): Field {
  const f = new Field(k, `${g.name}_after`, g.W, g.H, () => k.names[g.f.map.lowerTiles[0]], g.f.scale);
  f.map.lowerTiles = [...g.f.map.lowerTiles]; f.map.upperTiles = [...g.f.map.upperTiles];
  mutate(f);
  f.save();
  return f;
}

// =================================================================================================
// 1) 물 체육관(블루시티 수영장 관) 19×19 — 크림 둘레 판이 수영장을 두르고, 물 위 길이 섬으로 간다. 관장은 단 없이 섬 위, 석상 둘이 섬에서 관장을 낀다.
//    섬 앞 물 위 길 두 칸은 징검돌이 가라앉아 막혀 있다. 왼쪽 바닥의 밸브 판을 밟으면(이벤트) 징검돌이 떠오른다.
{
  const P = [
    ".................",
    ".---------------.",
    ".-~h~~~~~~~~~D~-.",
    ".-~~~~-----~~~~-.",
    ".-~~~~--L--~~~~-.",
    ".-~~~~-----~~~~-.",
    ".-~~~~~~o~~~~~~-.",
    ".-RRRRRRoRRRRRR-.",
    "V-~~~~~~-~~~~~~-.",
    ".-~~---------~~-.",
    ".-h~-~~~~~~~-~h-.",
    ".-~~---------~~-.",
    ".-~~~~~~-~~~~~~-.",
    ".---------------.",
    ".................",
    ".................",
  ];
  const pool = (g: Gym, x: number, y: number) => g.group("gy_pool", x, y);
  const side = (i: number, j: number) => P[j - 1]?.[i] === "-" ? "n" : P[j][i - 1] === "-" ? "w" : "e";
  const g = new Gym("gym_water", "deck", "pool", P, {
    "-": flo("rim"), L: flo("rim"), "~": pool,
    o: (g, x, y) => over(pool, P[y - 2][x - 2] === "R" ? "gy_stone_sunk_lane" : "gy_stone_sunk")(g, x, y),   // 레인 줄이 지나는 칸은 줄이 돌 위로 이어진다
    R: over(pool, "gy_lane"),
    h: (g, x, y) => { pool(g, x, y); g.after.push(() => g.f.up(x, y, `gy_ladder_${side(x - 1, y - 2)}`)); },
    D: (g, x, y) => { pool(g, x, y); g.after.push(() => g.stamp("gyp_dive", x, y - 1)); },
    V: (g, x, y) => g.after.push(() => g.f.lo(x, y, "gy_valve")),
  });
  const L = g.one("L");
  g.common("gyp_emb_pool", [[L[0] - 2, L[1] - 1], [L[0] + 2, L[1] - 1]]);
  for (const x of [3, 6, 12, 15]) g.stamp("gyp_port", x, 0);
  const [a, b] = solve(g, { gates: [{ cells: g.at("o"), open: (f) => (f & 1) === 1 }], triggers: [{ cell: g.one("V"), set: (f) => f | 1 }] });
  prove(g, "밸브 판 → 징검돌", start(g), [L], a, b);
  k.describe(g.f, "물관(블루시티): 수영장 둘레 크림 판과 물 위 길, 섬 위 관장(단 없음)·석상. 가라앉은 징검돌 두 칸이 길을 끊고, 왼쪽 바닥 밸브 판이 띄운다. 사다리는 둘레 가장자리에 걸친다.");
  g.save();
  // 레인 줄 위의 돌이 떠오르면 줄은 돌 양옆에서 끝 부표에 매여 끝난다(끝 처리 없이 끊겨 「돌이 줄을 지웠다」로 읽혔다, I3 Z4)
  const fa = after(g, (f) => { for (const [x, y] of g.at("o")) { f.up(x, y, "gy_stone_up"); if (P[y - 2][x - 2] === "R") { f.up(x - 1, y, "gy_lane_end_e"); f.up(x + 1, y, "gy_lane_end_w"); } } f.lo(...g.one("V"), "gy_valve_on"); });
  k.describe(fa, "물관 — 밸브를 밟은 뒤: 징검돌이 떠올라(gy_stone_up) 섬까지 걸어간다. 밸브 판은 눌린 상태(gy_valve_on).");
  k.expectReach(fa, start(g), [L], "gym_water_after: 떠오른 징검돌로 섬의 관장까지");
  k.negative(fa, "stone-left-sunk", "징검돌 하나를 떠오른 칸으로 안 바꿨다(이벤트가 칸 하나를 빠뜨림)", (f) => f.up(...g.at("o")[0], "gy_stone_sunk"), start(g), [L]);
}

// 2) 불 체육관(홍련섬 퀴즈관 + 용암마을) 19×19 — 벽돌 칸막이 두 줄이 방을 셋으로 나누고, 칸막이마다 셔터 퀴즈 문 하나.
//    퀴즈 기계 앞(q)에 서서 답하면(이벤트) 그 칸막이의 문이 열린다. 가운데 방은 김 구멍 밭 — 밟으면 떨어진다. 관장은 왼쪽 위 구석(홍련섬).
{
  const P = [
    ".....B.....B.....",
    ".L...............",
    ".................",
    ".................",
    "############T####",
    "########M###F####",
    ".v.v.......v.....",
    "...v.v..q..v.v...",
    ".v...v.....v.....",
    "..v....v.v....v..",
    "####T############",
    "####F#M##########",
    ".................",
    "......q..........",
    "..B...........B..",
    ".................",
  ];
  const wall = grp("gy_pb_fire");
  const g = new Gym("gym_fire", "hot", "fire", P, {
    "#": wall, M: stampAt(wall, "gyp_quiz"), B: stampAt(nop, "gyp_brazier"), q: nop,
    // v = 김 구멍. 김이 위 칸(위층 gy_vent_up)으로 이어진다(칸막이·벽·셔터 칸과 위가 다른 김 구멍인 칸은 빼고 — 김이 위 구멍 테를 덮었다, I3 Z8/wild Z1)
    v: (g, x, y) => { g.f.lo(x, y, "gy_vent"); g.after.push(() => { const i = (y - 1) * g.W + x; if (y > 2 && g.f.map.upperTiles[i] < 0 && !/^gy_(pb_|wall_|qdoor|vent)/.test(g.f.at(x, y - 1))) g.f.up(x, y - 1, "gy_vent_up"); }); }, T: (g, x, y) => { wall(g, x, y); g.after.push(() => g.f.lo(x, y, "gy_qdoor_t")); }, F: (g, x, y) => { wall(g, x, y); g.after.push(() => g.f.lo(x, y, "gy_qdoor_f")); },
  });
  const L = g.one("L");
  g.stamp("gyd_dais_fire", L[0] - 1, L[1]);
  g.common("gyp_emb_fire", [[7, g.H - 3], [11, g.H - 3]]);
  const [T2, T1] = g.at("T"), [F2, F1] = g.at("F"), [q2, q1] = g.at("q");
  const gates = [{ cells: [T1, F1], open: (f: number) => (f & 1) > 0 }, { cells: [T2, F2], open: (f: number) => (f & 2) > 0 }];
  const [a, b] = solve(g, { gates, triggers: [{ cell: q1, set: (f) => f | 1 }, { cell: q2, set: (f) => f | 2 }], falls: g.at("v") });
  prove(g, "퀴즈 기계 둘 → 셔터 문 둘(김 구멍은 밟으면 떨어짐)", start(g), [L], a, b);
  const [a1] = solve(g, { gates, triggers: [{ cell: q1, set: (f) => f | 1 }], falls: g.at("v") });
  if (search(s0(g), a1, isGoal([L])).found) k.fails.push("gym_fire: 둘째 퀴즈 없이 관장에게 간다");
  k.describe(g.f, "불관(홍련섬 퀴즈 + 용암마을): 벽돌 포장 바닥, 크림 기둥에 붉은 띠 칸막이 두 줄. 칸막이마다 셔터 문(gy_qdoor_t/f)이 옆 퀴즈 기계로 열린다. 가운데 방은 바닥과 같은 높이의 김 구멍 밭(밟으면 떨어짐), 관장은 왼쪽 위 벽돌 단.");
  g.save();
  const fa = after(g, (f) => { for (const [x, y] of g.at("T")) f.lo(x, y, "gy_qdoor_open_t"); for (const [x, y] of g.at("F")) f.lo(x, y, "gy_qdoor_open_f"); });
  k.describe(fa, "불관 — 퀴즈 둘을 푼 뒤: 셔터가 열려 문틀만 남는다(gy_qdoor_open_t/f, 걷는다).");
  k.expectReach(fa, start(g), [L], "gym_fire_after: 열린 문 둘로 관장까지(김 구멍 회피는 이벤트 몫)");
  k.negative(fa, "door-left-shut", "윗 칸막이 셔터를 열린 칸으로 안 바꿨다", (f) => { f.lo(...T2, "gy_qdoor_t"); f.lo(...F2, "gy_qdoor_f"); }, start(g), [L]);
}

// 3) 얼음 체육관(루네시티 얼음 바닥) 17×21 — 고드름 칸막이로 두른 얼음판. 들어선 방향으로 막힐 때까지 미끄러진다(엔진 slideTiles ice).
//    얼음 바위(R)가 미끄럼을 세우는 유일한 장치 — 바위를 다 치우면 위 출구 칸(2열)에 설 수 없다. 금 간 얼음(x)을 지나면 떨어진다. 석상은 위 출구 틈 양옆.
{
  const P = [
    "...............",
    ".......L.....C.",
    "...............",
    "##.############",
    "##.############",
    "#iiRiiiiiiiiii#",
    "#iiiiiiiiiixii#",
    "#iiiiiiRiiiiii#",
    "#iiiiiiiiixiii#",
    "#iiiiiRiiiiiii#",
    "#iiiiiiiiiiiii#",
    "#iiiixiiiiiRii#",
    "#iiiiiiiiiiiii#",
    "#iiiiiiiiiiiii#",
    "#######.#######",
    "#######.#######",
    ".C...........C.",
    "...............",
  ];
  const ice = grp("gy_ice");
  const g = new Gym("gym_ice", "ist", "ice", P, {
    "#": grp("gy_pb_ice"), i: ice, R: (g, x, y) => { ice(g, x, y); g.after.push(() => g.f.up(x, y, `gy_icerock${(x + y) % 2}`)); },
    x: over(ice, "gy_crack"), C: stampAt(nop, "gyp_crystal"),
  });
  const L = g.one("L");
  g.stamp("gyd_dais_ice", L[0] - 1, L[1]);
  g.common("gyp_emb_ice", [[2, 3], [4, 3]]);
  const [a, b] = solve(g, { slide: true, falls: g.at("x"), stripUpper: g.at("R") });
  const r = prove(g, "얼음 바위로 미끄럼을 세워 위 출구로(바위를 치우면 출구 열에 못 선다)", start(g), [L], a, b);
  k.notes.push(`gym_ice: 풀이 ${r.path.map((s) => `${s.x},${s.y}`).join(" → ")}`);
  k.describe(g.f, "얼음관(루네시티): 고드름 칸막이로 두른 얼음판(던전 얼음 동굴과 같은 사선 결 얼음 판). 얼음 바위만 미끄럼을 세운다. 금 간 얼음은 지나면 깨져 떨어진다(gy_crack → gy_ice_hole). 석상은 위 출구 틈 양옆, 관장은 결정 원판 단.");
  g.save();
  k.expectReach(g.f, start(g), [L], "gym_ice: 엔진 미끄럼만으로 관장까지(바위가 있을 때)");
  k.negative(g.f, "rocks-removed", "얼음 바위를 모두 지웠다 — 미끄럼이 멈출 자리가 없다", (f) => { for (const [x, y] of g.at("R")) f.map.upperTiles[y * g.W + x] = -1; }, start(g), [L]);
}

// 4) 유령 체육관 17×19 — 어둠 낭떠러지 위 판석 길. 관장 제단은 두 칸 낭떠러지 건너. 왼쪽 위 구석 혼불 문양(s)을 밟으면(이벤트) 숨은 다리(b)가 나타난다.
//    석상은 다리 앞 판석 마당, 세 갈래 촛대는 제단 양옆.
{
  const P = [
    "s..aa.....aaG.G",
    "...aac...caa...",
    "a.aaa.....aa..a",
    "a.aaaaabaaaaa.a",
    "a.aaaaabaaaaa.a",
    "a.aaa.....aaa.a",
    "a.aaa.....aaa.a",
    "a.aaaaa.aaaaa.a",
    "a.aaaaa.aaaaa.a",
    "a.aaaaa.aaaaa.a",
    "a.............a",
    "aaaaaaa.aaaaaaa",
    "aaaaaaa.aaaaaaa",
    "l.............l",
    "...............",
    "...............",
  ];
  const ab = grp("gy_abyss");
  const g = new Gym("gym_ghost", "gst", "ghost", P, {
    a: ab, b: over(ab, "gy_ibridge_hid"), s: over(nop, "gy_sigil"), c: over(nop, "gy_candle"),
    // 묘비 = 정본 유령 탑 묘비(1칸) — 예전 1×2 비석의 밑칸에 놓아 받침 줄을 맞춘다(I1 X8)
    G: (g, x, y) => stampAt(nop, x < 14 ? "gyp_grave_a" : "gyp_grave_d", 1)(g, x, y), l: stampAt(nop, "gyp_lamp"),
  });
  const L: Cell = [8, 3];
  g.stamp("gyd_dais_ghost", L[0] - 1, L[1]);
  g.common("gyp_emb_ghost", [[6, 7], [10, 7]]);
  const [a, b] = solve(g, { gates: [{ cells: g.at("b"), open: (f) => (f & 1) > 0 }], triggers: [{ cell: g.one("s"), set: (f) => f | 1 }] });
  prove(g, "혼불 문양 → 숨은 다리", start(g), [L], a, b);
  k.describe(g.f, "유령관: 판석 길 사이 어둠 낭떠러지(북쪽에 판석 단면 — 아래로 꺼진다). 제단은 낭떠러지 건너, 왼쪽 위 구석 혼불 문양을 밟아야 숨은 다리가 나타난다. 석상은 다리 앞 마당, 세 갈래 촛대는 제단 양옆.");
  g.save();
  const fa = after(g, (f) => { for (const [x, y] of g.at("b")) f.up(x, y, "gy_ibridge_v"); f.up(...g.one("s"), "gy_sigil_on"); });
  k.describe(fa, "유령관 — 혼불 문양을 밟은 뒤: 문양이 타오르고(gy_sigil_on) 빛나는 다리(gy_ibridge_v)가 낭떠러지를 잇는다.");
  k.expectReach(fa, start(g), [L], "gym_ghost_after: 나타난 다리로 제단까지");
  k.negative(fa, "bridge-hidden", "다리 한 칸을 숨은 칸 그대로 뒀다", (f) => f.up(...g.at("b")[0], "gy_ibridge_hid"), start(g), [L]);
}

// 5) 에스퍼 체육관(노랑시티 워프 판 방들) 19×19 — 방 아홉이 각자 뒷벽 두 줄(u/n)을 갖고, 방 사이는 얇은 남색 벽(|). 문은 없다 — 같은 숫자 판끼리 워프 쌍.
//    입구 방(아래 가운데) → 왼쪽 아래 → 왼쪽 위 → 오른쪽 아래 → 오른쪽 가운데 → 가운데 위 → 관장 방(가운데). 7·8 은 막다른 쌍. 석상은 입구 방.
{
  const P = [
    "....3|.....|7...8",
    "..o..|.....|.....",
    ".....|.....|..o..",
    "2....|5...6|.....",
    "uuuuu+uuuuu+uuuuu",
    "nnnnn*nnnnn*nnnnn",
    "8....|6....|5....",
    "..o..|..L..|.....",
    ".....|.....|.....",
    ".....|.....|....4",
    "uuuuu+uuuuu+uuuuu",
    "nnnnn*nnnnn*nnnnn",
    "....1|1...7|....4",
    ".....|.....|.....",
    ".....|.....|.....",
    "2....|.....|3....",
  ];
  const side = (i: number, j: number) => P[j][i - 1] === "+" || P[j][i - 1] === "*" ? "_l" : P[j][i + 1] === "+" || P[j][i + 1] === "*" ? "_r" : "";
  const g = new Gym("gym_psychic", "psy", "psy", P, {
    u: (g, x, y) => g.f.lo(x, y, `gy_wall_psy_up${x === 1 ? "_l" : x === g.W - 2 ? "_r" : side(x - 1, y - 2)}`),
    n: (g, x, y) => g.f.lo(x, y, `gy_wall_psy_dn${x === 1 ? "_l" : x === g.W - 2 ? "_r" : side(x - 1, y - 2)}`),
    "|": (g, x, y) => g.f.lo(x, y, "gy_psyv"), "+": (g, x, y) => g.f.lo(x, y, "gy_psyv_up"), "*": (g, x, y) => g.f.lo(x, y, "gy_psyv_dn"),
    o: stampAt(nop, "gyp_orb"),
    ...Object.fromEntries("12345678".split("").map((c) => [c, (g: Gym, x: number, y: number) => g.after.push(() => g.f.lo(x, y, "gy_warp"))])),
  });
  // 맨 위 뒷벽도 방 벽 기둥이 지나간다
  for (const x of [6, 12]) { g.f.lo(x, 0, "gy_psyv_up"); g.f.lo(x, 1, "gy_psyv_dn"); g.f.lo(x - 1, 0, "gy_wall_psy_up_r"); g.f.lo(x - 1, 1, "gy_wall_psy_dn_r"); g.f.lo(x + 1, 0, "gy_wall_psy_up_l"); g.f.lo(x + 1, 1, "gy_wall_psy_dn_l"); }
  g.shadeRaised();
  const L = g.one("L");
  g.stamp("gyd_dais_psy", L[0] - 1, L[1] - 1);
  g.common("gyp_emb_psy", [[8, 15], [10, 15]]);
  const warps: [Cell, Cell][] = [];
  for (const c of "12345678") { const cs = g.at(c); if (cs.length !== 2) k.fails.push(`gym_psychic: 워프 ${c} 가 ${cs.length}칸`); else warps.push([cs[0], cs[1]]); }
  const [a, b] = solve(g, { warps });
  const r = prove(g, "워프 쌍을 타야만 관장 방", start(g), [L], a, b);
  let hops = 0; for (let i = 1; i < r.path.length; i++) if (Math.abs(r.path[i].x - r.path[i - 1].x) + Math.abs(r.path[i].y - r.path[i - 1].y) > 1) hops++;
  k.notes.push(`gym_psychic: 풀이에 워프 ${hops}번`);
  if (hops < 5) k.fails.push(`gym_psychic: 워프 ${hops}번이면 관장 — 퍼즐이 너무 짧다`);
  k.describe(g.f, "에스퍼관(노랑시티): 방 아홉마다 자기 뒷벽 두 줄(gy_wall_psy_up/dn), 방 사이는 흰 윗면·연보라 옆면의 솟은 얇은 벽(gy_psyv, 방 벽 줄 위로 이어지는 자리 gy_psyv_up/dn). 문은 없고 같은 짝 워프 판으로만 옮긴다. 관장은 한가운데 방 원판, 석상은 입구 방.");
  g.save();
}

// 6) 풀·벌레 체육관(무지개시티 꽃 정원 · 검방울 회전문) 17×21 — 나무 줄 울타리 두 줄. 아래 줄 틈은 회전문(밀면 90도 돈다), 위 줄 틈은 자르기 나무.
//    관장은 오른쪽 위 꽃 무대(검방울처럼 구석), 석상은 입구 길 양옆.
{
  const P = [
    "ff.p.....p.....",
    "f..............",
    "...............",
    ".-------------.",
    "###########X###",
    "###########-###",
    ".f.......#.-..f",
    "ff##.ff..#.-..f",
    "..##.ff..#.---.",
    ".-------------.",
    "....#....#....f",
    "######---######",
    "######jPh######",
    "......---......",
    "f.....---......",
    "f.....---....f.",
    "......---......",
    "......---......",
  ];
  const g = new Gym("gym_grass", "turf", "grass", P, {
    "#": grp("gy_hedge"), "-": flo("rim"), f: (g, x, y) => g.f.lo(x, y, `gy_flowers${vh(x, y) % 3}`),
    p: over(nop, "gy_pot"), X: over(nop, "gy_cuttree"), P: over(flo("rim"), "gy_turn_pivot"), h: over(flo("rim"), "gy_turn_h"), j: over(flo("rim"), "gy_turn_h_w"),
  });
  const L: Cell = [14, 3];
  g.stamp("gyd_dais_grass", L[0] - 1, L[1]);
  g.common("gyp_emb_grass", [[6, g.H - 3], [10, g.H - 3]]);   // 다른 관처럼 입구 길(x=7..9) 양옆에 마주 선다(QA-L3 P1)
  const rules: Rules = { gates: [{ cells: g.at("X"), open: () => true }], turnstiles: [g.one("P")] };
  const [a, b] = solve(g, rules);
  prove(g, "회전문 밀기 + 자르기 나무", start(g), [L], a, b);
  const [onlyTurn] = solve(g, { turnstiles: [g.one("P")] });
  const [onlyCut] = solve(g, { gates: rules.gates });
  if (search(s0(g), onlyTurn, isGoal([L])).found) k.fails.push("gym_grass: 자르기 없이 관장에게 간다");
  if (search(s0(g), onlyCut, isGoal([L])).found) k.fails.push("gym_grass: 회전문 없이 관장에게 간다");
  k.describe(g.f, "풀관(무지개시티 정원 + 검방울): 잔디 위 둥근 나무 줄 울타리 두 줄(칸마다 한 그루). 아래 틈은 회전문(팔에 직각으로 걸어 들면 90도), 위 틈은 자르기 나무. 관장은 오른쪽 위 꽃 무대, 석상은 입구 길 양옆.");
  g.save();
  const [px_, py] = g.one("P");
  const fa = after(g, (f) => {
    for (const [x, y] of g.at("X")) f.map.upperTiles[y * g.W + x] = -1;
    f.map.upperTiles[py * g.W + px_ - 1] = -1; f.map.upperTiles[py * g.W + px_ + 1] = -1;
    f.up(px_, py - 1, "gy_turn_v_n"); f.up(px_, py + 1, "gy_turn_v"); f.up(px_, py, "gy_turn_pivot_v");   // 축의 팔 토막도 세로로(팔이 축에 닿는다, I3 Z5)
  });
  k.describe(fa, "풀관 — 회전문을 돌리고 나무를 벤 뒤: 팔이 세로(위 gy_turn_v_n · 아래 gy_turn_v — 바깥 끝마다 기둥, 축 gy_turn_pivot_v)로 서고 자르기 나무 칸이 비었다.");
  k.expectReach(fa, start(g), [L], "gym_grass_after: 돈 회전문 옆과 벤 나무 자리로 관장까지");
  k.negative(fa, "tree-not-cut", "자르기 나무를 지우지 않았다", (f) => { for (const [x, y] of g.at("X")) f.up(x, y, "gy_cuttree"); }, start(g), [L]);
}

// 7) 격투 도장(노랑시티 도장 · 무로 체육관) 17×19 — 위는 다다미 수련장, 아래는 가로 마루 앞마당. 그 사이 어둠 미로(무로)를 지나야 한다.
//    미로 입구 틈은 격파 판(X). 미로 오른쪽 칸막이 열(x=12)은 아래 벽까지 내려와 입구 마당과 오른쪽 샌드백 복도를 가른다 — 마당에서 위로 가는 길은 격파 판뿐이다(QA-L2 M1).
//    석상은 매트 양옆(통로를 막지 않는 장식). 미로는 어둠이 덮고 밝은 칸에 닿은 둘레만 빛이 번진다.
{
  const P = [
    "...............",
    "...ttttttttt...",
    "...ttttLtttt...",
    "...ttttttttt...",
    "...ttttttttt...",
    "...............",
    "DdDDDDDDDDDD...",
    "DdDDDDDDDDDD...",
    "dddddddDdddD.S.",
    "dDDDdDdDdDdD...",
    "dDddddDddDdD.S.",
    "dddDDdDddddD...",
    "DDDDDdDDDDDD...",
    "DDDDDXDDDDDD...",
    "...........#...",
    "...........#...",
    ".S.........#.S.",
  ];
  const wall = grp("gy_pb_dojo");
  const g = new Gym("gym_dojo", "wood", "dojo", P, {
    t: flo("tatami"), L: flo("tatami"), D: wall, "#": wall, d: nop, X: over(nop, "gy_boards"), S: stampAt(nop, "gyp_sandbag", -1),
  });
  // 어둠: 미로 칸마다 「밝은 이웃 칸」 마스크(N1 E2 S4 W8 NE16 SE32 SW64 NW128 — 대각은 옆 두 변이 어두울 때만)로 덮개를 고른다.
  // 밝은 쪽에서 칸 안으로 빛이 디더로 번지고, 미로 깊은 곳은 온 어둠. 격파 판 칸은 어둠 밖(빛 안)이다. 칸막이 위는 _w(막힘).
  const maze = new Set([...g.at("D"), ...g.at("d")].map(([x, y]) => ck(x, y)));
  const lit = (x: number, y: number) => x >= 1 && x <= g.W - 2 && y >= 2 && y <= g.H - 2 && !maze.has(ck(x, y));
  const lightMask = (x: number, y: number) => {
    const N = lit(x, y - 1), E = lit(x + 1, y), S = lit(x, y + 1), W = lit(x - 1, y);
    let m = (N ? 1 : 0) | (E ? 2 : 0) | (S ? 4 : 0) | (W ? 8 : 0);
    if (lit(x + 1, y - 1) && !N && !E) m |= 16;
    if (lit(x + 1, y + 1) && !S && !E) m |= 32;
    if (lit(x - 1, y + 1) && !S && !W) m |= 64;
    if (lit(x - 1, y - 1) && !N && !W) m |= 128;
    return m;
  };
  // 번짐 깊이: 격파 판·출구 둘레(체비쇼프 1칸)만 깊게(칸 전체), 나머지 둘레는 칸 해시로 3px/5px — 곧은 사각 띠를 깬다(QA-L3 P2)
  const deepAt: Cell[] = [g.one("X"), [2, 8]];
  const deep = (x: number, y: number) => deepAt.some(([a, b]) => Math.max(Math.abs(a - x), Math.abs(b - y)) <= 1);
  for (const ch of ["D", "d"]) for (const [x, y] of g.at(ch)) {
    const m = lightMask(x, y);
    // 깊은 칸 바로 옆은 5px(s1) 로 계단 폭을 줄이고, 나머지는 두 칸씩 같은 깊이로 묶어 칸마다 꺾이지 않게 한다(QA-L4 N4)
    const nearDeep = deepAt.some(([a, b]) => Math.max(Math.abs(a - x), Math.abs(b - y)) === 2);
    // 출구(2,8) 둘레의 칸막이(D) 윗면은 깊게 번지지 않는다 — 출구 칸만 깊고 옆 칸막이는 5px(s1). 칸막이 윗면 세 칸이 통째로 밝았다(I4 W7).
    const exitWall = ch === "D" && Math.max(Math.abs(deepAt[1][0] - x), Math.abs(deepAt[1][1] - y)) <= 1;
    const v = m === 0 ? "" : exitWall ? "s1" : deep(x, y) ? "" : nearDeep ? "s1" : `s${Math.floor((x + y) / 2) % 2}`;
    g.f.up(x, y, `gy_dark_l${m}${v}${ch === "D" ? "_w" : ""}`);
  }
  const L = g.one("L");
  g.stamp("gyd_dais_dojo", L[0], L[1]);
  for (const x of [3, 13]) g.stamp("gyp_scroll", x, 0);
  const statues: Cell[] = [[7, g.H - 3], [9, g.H - 3]];
  g.common("gyp_emb_dojo", statues);
  const [a, b] = solve(g, { gates: [{ cells: g.at("X"), open: () => true }] });
  prove(g, "격파 판 → 어둠 미로 → 다다미", start(g), [L], a, b);
  // 석상은 길을 막는 데 쓰이지 않는다: 석상 칸을 바닥으로 바꿔도 장치(격파) 없이는 못 간다
  {
    const nf = new Field(k, "gym_dojo_nostatue", g.W, g.H, () => k.names[g.f.map.lowerTiles[0]], g.f.scale);
    nf.map.lowerTiles = [...g.f.map.lowerTiles]; nf.map.upperTiles = [...g.f.map.upperTiles];
    for (const [x, y] of statues) for (const yy of [y, y + 1]) { nf.map.upperTiles[yy * g.W + x] = -1; nf.lo(x, yy, "gy_fl_wood0"); }
    k.expectNoReach(nf, start(g), [L], "gym_dojo: 석상을 지워도 격파 판 없이는 다다미에 못 간다");
    k.expectReach(nf, start(g), [[6, 16]], "gym_dojo: 입구 마당에서 격파 판 앞까지는 간다");
  }
  k.describe(g.f, "도장(노랑시티 + 무로): 위 다다미 수련장, 아래 가로 마루 앞마당, 사이 진갈색 나무 칸막이 미로. 칸막이 오른쪽 열이 아래 벽까지 내려와 마당을 가두고, 마당에서 위로는 격파 판뿐이다. 미로는 어둠이 덮고(벽 위 _w) 밝은 칸 둘레만 빛이 번진다. 관장은 다다미 위 방석, 석상은 매트 양옆.");
  g.save();
  const fa = after(g, (f) => f.up(...g.one("X"), "gy_boards_broken"));
  k.describe(fa, "도장 — 격파한 뒤: 판이 두 동강 나 받침돌 사이에 떨어진 칸(gy_boards_broken, 걷는다).");
  k.expectReach(fa, start(g), [L], "gym_dojo_after: 부서진 판을 지나 어둠 미로로 관장까지");
  k.negative(fa, "boards-intact", "격파 판을 부서진 칸으로 안 바꿨다", (f) => f.up(...g.one("X"), "gy_boards"), start(g), [L]);
}

// 8) 드래곤 체육관(원작 근거 없이 지은 관) 19×19 — 용암 바다 위 판석 길. 위 마당과 가운데 단 사이, 가운데 단과 오른쪽 다리목 사이는 용암 한 칸이 끊는다.
//    괴력 바위(B)를 그 칸에 밀어 넣어 메운다(밀기 이벤트). 다른 차단선은 모두 두 칸 이상 두께. 관장은 돌계단 단 위, 용 석상 둘이 단을 낀다.
{
  const P = [
    "~~.............~~",
    "~~.............~~",
    "~~.............~~",
    "~~.............~~",
    "~~~~~~~~.~~~~~~~~",
    "~~~~~~~~~~~~~~~~~",
    "~~~~~~~~B~~~~~~~~",
    "~~~~.......~B.~~~",
    "~~~~~~~~~~~~~|~~~",
    "~~~~~~~~~~~~~|~~~",
    "~~~~~~~~~~~~~|~~~",
    "~~~~~~~~~~~~~|~~~",
    ".F.............F.",
    ".................",
    ".................",
    ".................",
  ];
  const lava = grp("gy_lava");
  const g = new Gym("gym_dragon", "bas", "dragon", P, {
    "~": lava, "|": over(lava, "gy_lbridge_v"), "=": over(lava, "gy_lbridge_h"), B: (g, x, y) => g.after.push(() => g.f.up(x, y, `g2_boulder${(x + y) % 2}`)),
    F: stampAt(nop, "gyp_brazier"),
  });
  const L: Cell = [9, 3];
  g.stamp("gyd_dais_dragon", L[0] - 1, L[1] - 1);
  for (const x of [5, 12]) g.stamp("gyp_dragon", x, 2);
  g.common("gyp_emb_dragon", [[7, g.H - 3], [11, g.H - 3]]);
  const lavaSet = new Set(g.at("~").map(([x, y]) => ck(x, y)));
  const rules: Rules = { boulders: g.at("B"), sinks: (x, y) => lavaSet.has(ck(x, y)) };
  const [a, b] = solve(g, rules);
  const e0 = `0|${g.at("B").map(([x, y]) => ck(x, y)).sort().join(";")}|`;
  const r = prove(g, "괴력 바위 둘을 용암 틈에 밀어 넣기", start(g), [L], a, b, e0);
  // 굳은 껍질 판: 던전 lava_cave 와 같은 공용 흩뿌리기(맵 픽셀 좌표 포아송) — 칸 해시 속 변형에 넣으면 줄지어 섰다(QA-L6 N14).
  // 다리 밑(위층이 있는 칸)은 뺀다. 메울 틈은 한 칸 용암(가장자리 변형)이라 at255/atin 이 아니어서 저절로 빠진다.
  mixLavaEdges(g.f, "gy_lava", 0x9d7a);
  const crust = scatterCrust(g.f, (x, y) => /^gy_lava_(at255|atin\d_\d)(_f0)?$/.test(g.f.at(x, y)) && g.f.map.upperTiles[y * g.W + x] < 0, 0x9d7a);
  if (crust.length < 6) k.fails.push(`gym_dragon: 껍질 판이 ${crust.length} 개뿐이다`);
  for (const [x, y, j] of crust) g.f.lo(x, y, `gy_lava_crust${j}_f0`);
  console.log(`· gym_dragon: 껍질 판 ${crust.length}개 (소 ${crust.filter((c) => c[2] >= 4 && c[2] <= 9).length} · 중 ${crust.filter((c) => c[2] <= 3).length} · 대 ${crust.filter((c) => c[2] >= 10).length})`);
  k.describe(g.f, "드래곤관(원작 근거 없이 지은 관): 용암 바다(현무암 단면 둑) 위 판석 길, 현무암 벽돌 뒷벽. 길을 끊는 용암 한 칸 둘은 괴력 바위를 밀어 넣어 메운다. 오른쪽은 난간 돌다리, 관장은 돌계단 단, 용 석상 둘이 단을 낀다.");
  g.save();
  const filled = (r.path.at(-1)?.e.split("|")[2] ?? "").split(";").filter(Boolean).map((s) => s.split(",").map(Number) as Cell);
  if (filled.length !== 2) k.fails.push(`gym_dragon: 풀이가 메운 칸이 ${filled.length}개`);
  const fa = after(g, (f) => { for (const [x, y] of g.at("B")) f.map.upperTiles[y * g.W + x] = -1; for (const [x, y] of filled) f.up(x, y, "gy_lava_fill"); });
  k.describe(fa, "드래곤관 — 바위를 밀어 넣은 뒤: 용암 틈 두 칸에 윗면만 드러난 바위(gy_lava_fill, 걷는다).");
  k.expectReach(fa, start(g), [L], "gym_dragon_after: 메운 바위로 관장까지");
  k.negative(fa, "hole-unfilled", "용암 틈 하나를 메운 칸으로 안 바꿨다", (f) => { const [x, y] = filled[0]; f.map.upperTiles[y * g.W + x] = -1; }, start(g), [L]);
}

k.done();
