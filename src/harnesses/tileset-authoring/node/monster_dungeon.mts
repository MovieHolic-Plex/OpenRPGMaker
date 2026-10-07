import { mixLavaEdges } from "./lava_edges.mts";
/** 던전 시트 쇼케이스·검사. bash cycle_theme.sh monster-dungeon <run>
 *  맵은 글자 격자로 적는다(한 글자 = 한 칸). 동굴 계열은 '#' 가 벽(맵 테두리 줄은 어둠), 방 계열은 뒷벽 두 줄 + 검은 여백 테.
 *  맵마다 k.describe 로 장소 문법 한 줄, 정상/오류 쌍(k.negative)은 「이 칸 하나가 길을 만든다」를 도달 검사로 보인다. */
import { Kit, Field, Cell } from "./kitlib.mts";
const k = new Kit(process.argv[2]);
const hash = (x: number, y: number) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 997;

type Put = { lo?: string; up?: string; stamp?: string; at?: [number, number]; grp?: string; wall?: boolean };
type Legend = Record<string, Put | Put[]>;
const list = (p: Put | Put[]) => (Array.isArray(p) ? p : [p]);

/** 동굴 계열 맵: '#' 와 wall:true 글자는 벽(테두리 한 줄은 어둠), legend 의 grp 칸은 그 오토타일, 나머지는 바닥.
 *  벽 붙박이(사다리·굴 입구)는 wall:true + up 으로 — 벽을 칠한 뒤 그 칸 위층에 얹는다(위층 통행 O 가 벽을 덮는다). */
function caveMap(name: string, pre: string, floor: (x: number, y: number) => string, floorS: string, rows: string[], legend: Legend, scale = 3) {
  const W = rows[0].length, H = rows.length;
  for (const r of rows) if (r.length !== W) throw new Error(`${name}: 줄 길이가 다르다 ${r}`);
  const f = k.field(name, W, H, floor, scale);
  const wallGrp = `${pre}_wall`;
  const isWallCh = (c: string | undefined) => c === "#" || (c !== undefined && list(legend[c] ?? {}).some((p) => p.wall));
  const walls: Cell[] = [], byGrp: Record<string, Cell[]> = {};
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = rows[y][x];
    if (isWallCh(c)) { if (x === 0 || y === 0 || x === W - 1 || y === H - 1) f.lo(x, y, `${pre}_void`); else walls.push([x, y]); continue; }
    for (const p of list(legend[c] ?? {})) if (p.grp) (byGrp[p.grp] ??= []).push([x, y]);
  }
  f.paint(wallGrp, walls);
  for (const [g, cells] of Object.entries(byGrp)) f.paint(g, cells);
  f.shape([wallGrp, ...Object.keys(byGrp)]);
  const isWall = (x: number, y: number) => isWallCh(rows[y]?.[x]);
  for (const [x, y, m] of [[1, 1, 38], [W - 2, 1, 76], [1, H - 2, 19], [W - 2, H - 2, 137]] as const) if (isWall(x, y)) f.lo(x, y, `${pre}_wall_oc${m}`);
  const mem = new Set(k.g(wallGrp).memberTileIds);
  const plain = new RegExp(`^${floor(0, 0).replace(/\d+$/, "")}\\d+$`);
  for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) {
    if (isWall(x, y)) continue;
    if (mem.has(f.map.lowerTiles[(y - 1) * W + x]) && plain.test(f.at(x, y))) f.lo(x, y, floorS);
  }
  // 곧은 변(북 110 · 서 55 · 동 205)과 벽 속(mid·deep)은 본 시트 쇼케이스(showcase.mts 동굴)와 같은 묶음·같은 해시로 섞는다 —
  // 칸 해시로 고르되 앞 이웃(가로 줄은 왼쪽, 세로 줄은 위)과 같은 배치는 피한다. 긴 아래 띠·옆 테에 한 높이 잔돌의 점선이 남지 않게(통합 I4 W5, 본 I3 Z2).
  {
    const hh = (x: number, y: number) => { let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 0x5bd1e9; n = Math.imul(n ^ (n >>> 13), 1274126177); return (n ^ (n >>> 16)) >>> 0; };
    const fams: string[][] = [
      [`${pre}_wall_at110`, `${pre}_wall_top110_1`, `${pre}_wall_top110_2`],
      [`${pre}_wall_at55`, `${pre}_wall_side55_1`, `${pre}_wall_side55_2`],
      [`${pre}_wall_at205`, `${pre}_wall_side205_1`, `${pre}_wall_side205_2`],
      [0, 1, 2].map((v) => `${pre}_wall_mid${v}`),
      [0, 1, 2].map((v) => `${pre}_wall_deep${v}`),
    ];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const fam = fams.find((q) => q.includes(f.at(x, y)));
      if (!fam) continue;
      const near = new Set([f.at(x - 1, y), f.at(x, y - 1)]);
      let c = hh(x, y) % 3;
      for (let t = 0; t < 3 && near.has(fam[c]); t++) c = (c + 1) % 3;
      f.lo(x, y, fam[c]);
    }
  }
  // 곧은 남쪽 앞면(at155)은 본 시트처럼 바위 덩이 변형 셋을 섞는다(cave_wall_at155·face1·face2 — 같은 덩이가 16px 마다 서지 않게)
  const face: Cell[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (f.at(x, y) === `${pre}_wall_at155`) face.push([x, y]);
  mix(f, face, [`${pre}_wall_at155`, `${pre}_wall_face1`, `${pre}_wall_face2`], 9);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const p of list(legend[rows[y][x]] ?? {})) {
    if (p.lo) f.lo(x, y, p.lo);
    if (p.up) f.up(x, y, p.up);
    if (p.stamp) f.stamp(p.stamp, x + (p.at?.[0] ?? 0), y + (p.at?.[1] ?? 0));
  }
  return f;
}
/** 같은 자리 칸 섞기: cells 를 2축 해시로 pool 에서 고르되, 바로 위·왼쪽 칸과 같은 그림이면 다음 것으로 넘긴다(세로·가로 이웃 반복 금지). */
function mix(f: Field, cells: Cell[], pool: string[], salt = 0) {
  for (const [x, y] of [...cells].sort((a, b) => a[1] - b[1] || a[0] - b[0])) {
    const near = new Set([f.at(x, y - 1), f.at(x - 1, y)]);
    let i = (hash(x * 3 + salt, y * 7 + salt) + hash(y, x)) % pool.length;
    for (let t = 0; t < pool.length && near.has(pool[i]); t++) i = (i + 1) % pool.length;
    f.lo(x, y, pool[i]);
  }
}
/** 결정적 난수(mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/**
 * 굳은 껍질 판 흩뿌리기(맵 전체 좌표 포아송 디스크 — dart throwing). 용암 속 칸(ok) 안의 픽셀 점을 던져, 이미 놓은 점과
 * 크기별 반지름(소 24 · 중 32 · 대 44px, 둘 중 큰 것) 안이면 버린다. 한 칸에 하나. 큰 것부터 상한까지 놓고 소로 남은 자리를 채운다.
 * 판 번호 j: 소 4~9 · 중 0~3 · 대 10~11 (dungeon_cavern CRUST_SMALL/MID/LARGE). 같은 번호가 가까이(64px) 겹치지 않게 다음 번호로 넘긴다.
 * 체육관 용암도 같은 방법으로 놓는다(lava_cell(P, 255, f, ("k", j)) 칸).
 */
function scatterCrust(f: Field, ok: (x: number, y: number) => boolean, seed: number): [number, number, number][] {
  const r = rng(seed), out: { px: number; py: number; rad: number; j: number; x: number; y: number }[] = [];
  // 큰 것부터 놓는다(작은 것이 먼저 자리를 다 먹으면 큰 판이 하나도 못 들어간다). 개수 상한: 대 1/40칸 · 중 1/14칸 · 소는 남는 자리 모두.
  const cells = (() => { let n = 0; for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) if (ok(x, y)) n++; return n; })();
  const cls = [{ rad: 44, js: [10, 11], max: Math.max(1, Math.round(cells / 40)) }, { rad: 32, js: [0, 1, 2, 3], max: Math.round(cells / 14) }, { rad: 24, js: [4, 5, 6, 7, 8, 9], max: 999 }];
  for (const c of cls) {
    let n = 0;
    for (let t = 0; t < 3000 && n < c.max; t++) {
      const px_ = r() * f.W * 16, py_ = r() * f.H * 16, x = Math.floor(px_ / 16), y = Math.floor(py_ / 16);
      if (!ok(x, y) || out.some((o) => o.x === x && o.y === y)) continue;
      if (out.some((o) => Math.hypot(o.px - px_, o.py - py_) < Math.max(o.rad, c.rad))) continue;
      let j = c.js[Math.floor(r() * c.js.length)];
      for (let i = 0; i < c.js.length && out.some((o) => o.j === j && Math.hypot(o.px - px_, o.py - py_) < 64); i++) j = c.js[(c.js.indexOf(j) + 1) % c.js.length];
      out.push({ px: px_, py: py_, rad: c.rad, j, x, y }); n++;
    }
  }
  return out.map((o) => [o.x, o.y, o.j]);
}
const find = (rows: string[], ch: string): Cell[] => { const o: Cell[] = []; rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === ch) o.push([x, y]); })); return o; };
const findAll = (rows: string[], chars: string): Cell[] => [...chars].flatMap((c) => find(rows, c));
/** 후보 칸 중 하나만 바꿔도 목표가 끊기는 첫 칸(그 칸이 길을 만든다) — 오류 쌍의 결함 자리. */
function breaker(f: Field, cells: Cell[], change: (g: Field, c: Cell) => void, start: Cell, targets: Cell[]): Cell | null {
  for (const c of cells) {
    const g = new Field(k, `${f.name}-probe`, f.W, f.H, () => k.names[f.map.lowerTiles[0]], f.scale);
    g.map.lowerTiles = [...f.map.lowerTiles]; g.map.upperTiles = [...f.map.upperTiles];
    change(g, c);
    const s = k.reach(g, start);
    if (targets.some(([x, y]) => !s.has(`${x},${y}`))) return c;
  }
  return null;
}

// ==== 1. 얼음 동굴 + 미끄럼 퍼즐 (갯바위 얼음방·얼음폭포 동굴 문법) 22×23 ====
// 아래 출구 빛(도착) → 아래 방 → 왼쪽 두 칸 통로 → 얼음 판 서쪽 입구 (7,11) 하나 → 바위 앞에서만 멈추며 미끄러져 → 북쪽 틈 (15,7) → 위 방 → 벽에 기댄 사다리.
// 안쪽 벽은 모두 두 칸 이상 두께(윗면 + 앞면), 판 안에서 멈출 수 있는 곳은 바위 앞뿐이다.
{
  const rows = [
    "######################",
    "######################",
    "######################",
    "############L#########",
    "#######c........######",
    "#######.d.......######",
    "###############.######",
    "###############.######",
    "#######iiiiiiiiioii###",
    "#######iiiiioiiiiii###",
    "###..##iiiiiiiiiiio###",
    "###....iiiiiiiiiiii###",
    "###..##iiiioiiiioii###",
    "###.c##iiiiiiiiiiio###",
    "###..##iiiiiiiiiiii###",
    "###..##iixiiiiiiiii###",
    "###..#################",
    "###..#################",
    "###d..............####",
    "###...........t.c.####",
    "##########.###########",
    "##########E###########",
    "######################",
  ];
  const legend: Legend = {
    i: { grp: "ic_ice" }, o: [{ grp: "ic_ice" }, { up: "ic_rock0" }], x: [{ grp: "ic_ice" }, { up: "ic_crack" }],
    c: { up: "ic_crystal" }, d: { up: "ic_drift" }, t: { stamp: "ic_stal", at: [0, -1] },
    L: { wall: true, up: "ic_ladder" }, E: { lo: "ic_exit" },
  };
  const f = caveMap("ice_cave", "ic", (x, y) => `ic_snow${hash(x, y) % 4}`, "ic_snow_s", rows, legend);
  f.up(6, 18, "ic_rock1");
  f.save();
  k.describe(f, "얼음 동굴: 두 칸 두께 얼음 벽으로 둘러싼 얼음 판에 입구·출구가 한 칸씩, 판 안에서는 바위 앞에서만 멈춘다 — 바위 배치가 곧 퍼즐이다. 올라가는 사다리는 벽 앞면에 기대고(벽 칸 위층), 아래 변 가운데의 빛이 들어온 곳.");
  const S = find(rows, "E")[0], L = find(rows, "L")[0];
  const ice = findAll(rows, "iox");
  k.expectReach(f, S, [L], "출구 빛(아래) → 얼음 판 미끄럼 → 벽에 기댄 사다리(위층)");
  k.expectNoReach(f, S, [L], "얼음을 밟지 않으면 출구에 못 간다(눈 길 지름길 없음)", { blocked: ice });
  k.expectNoReach(f, S, [[12, 11], [10, 13]], "얼음 한가운데는 멈출 수 없다");
  const walk = caveMap("ice_cave_walk", "ic", (x, y) => `ic_snow${hash(x, y) % 4}`, "ic_snow_s", rows.map((r) => r.replace(/[ix]/g, ".")), { ...legend, o: { up: "ic_rock0" } });
  k.expectReach(walk, S, [[12, 11], [10, 13]], "대조: 얼음이 눈이었다면 걸어서 닿는다");
  const rock = breaker(f, find(rows, "o"), (g, [x, y]) => g.up(x, y, "ic_at255"), S, [L]);
  if (!rock) k.check(false, "ice_cave: 빼면 길이 끊기는 바위가 없다 — 퍼즐이 바위에 기대지 않는다");
  else k.negative(f, "rock-missing", `멈춤 바위 (${rock.join(",")}) 를 빼면 북쪽 틈 앞에 설 수 없어 사다리에 못 간다`, (g) => { g.map.upperTiles[rock[1] * g.W + rock[0]] = -1; }, S, [L]);
}

// ==== 방 계열 공통: 뒷벽 두 줄(양 끝 _l/_r) · 옆·아래 여백 테 · 벽 아래 바닥 한 톤 그늘 · 올린 칸막이 오른쪽·아래 그늘 ====
type RoomOpt = { wallRow?: string; wallKey?: Record<string, string>; sideEdge?: [string, string]; bottomEdge?: string; corners?: [string, string]; exitX?: number; exitTile?: string; exitEdge?: string;
  blockGrp?: string; shade?: { s: string; e?: string; se?: string; c?: string; plain: RegExp }; scale?: number };
function roomMap(name: string, pre: string, floor: (x: number, y: number) => string, rows: string[], legend: Legend, o: RoomOpt = {}) {
  const W = rows[0].length + 2, H = rows.length + 3;
  for (const r of rows) if (r.length !== W - 2) throw new Error(`${name}: 줄 길이가 다르다 ${r}`);
  const side = o.sideEdge ?? [`${pre}_edge_r`, `${pre}_edge_l`];
  const ground = (x: number, y: number): string => {
    if (y === H - 1) return x === 0 ? (o.corners?.[0] ?? `${pre}_edge_rt`) : x === W - 1 ? (o.corners?.[1] ?? `${pre}_edge_lt`) : (o.bottomEdge ?? `${pre}_edge_t`);
    if (x === 0) return side[0];
    if (x === W - 1) return side[1];
    if (y <= 1) {
      const part = y === 0 ? "up" : "dn";
      const key = o.wallRow?.[x - 1] ?? ".";
      if (key !== "." && o.wallKey?.[key]) return `${pre}_wall_${part}_${o.wallKey[key]}`;
      return `${pre}_wall_${part}${x === 1 ? "_l" : x === W - 2 ? "_r" : ""}`;
    }
    return floor(x, y);
  };
  const f = k.field(name, W, H, ground, o.scale ?? 3);
  const at = (x: number, y: number) => rows[y - 2]?.[x - 1];
  const blocks: Cell[] = [];
  for (let y = 2; y < H - 1; y++) for (let x = 1; x < W - 1; x++) for (const p of list(legend[at(x, y)] ?? {})) if (p.grp) blocks.push([x, y]);
  if (blocks.length && o.blockGrp) { f.paint(o.blockGrp, blocks); f.shape(); }
  const bset = new Set(blocks.map(([x, y]) => `${x},${y}`));
  if (o.shade) for (let y = 2; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (bset.has(`${x},${y}`) || !o.shade.plain.test(f.at(x, y))) continue;
    const n = y === 2 || bset.has(`${x},${y - 1}`), w = bset.has(`${x - 1},${y}`);
    if (n && w && o.shade.se) f.lo(x, y, o.shade.se); else if (w && o.shade.e) f.lo(x, y, o.shade.e); else if (n) f.lo(x, y, o.shade.s);
    else if (o.shade.c && bset.has(`${x - 1},${y - 1}`)) f.lo(x, y, o.shade.c);   // 칸막이 끝 오른쪽 아래 대각 칸: 오른쪽 띠와 아래 띠를 「ㄱ」으로 잇는다(통합 I4 W6)
  }
  for (let y = 2; y < H - 1; y++) for (let x = 1; x < W - 1; x++) for (const p of list(legend[at(x, y)] ?? {})) {
    if (p.lo) f.lo(x, y, p.lo);
    if (p.up) f.up(x, y, p.up);
    if (p.stamp) f.stamp(p.stamp, x + (p.at?.[0] ?? 0), y + (p.at?.[1] ?? 0));
  }
  if (o.exitX !== undefined) { if (o.exitTile) f.lo(o.exitX, H - 2, o.exitTile); f.lo(o.exitX, H - 1, o.exitEdge ?? `${pre}_edge_mat`); }
  return f;
}
/** 방 글자 격자 안 좌표(rows 의 x, y) → 맵 좌표 */
const rfind = (rows: string[], ch: string): Cell[] => find(rows, ch).map(([x, y]) => [x + 1, y + 2] as Cell);

/** 용암 동굴 바닥: 흰 재 점 칸(4·5)은 9~11칸에 하나꼴, 나머지는 민 바닥 넷. */
const lavaFloor = (x: number, y: number) => { const h = hash(x, y) % 11; return h === 0 ? "lv_fl4" : h === 6 ? "lv_fl5" : `lv_fl${hash(y, x) % 4}`; };

// ==== 2. 용암 동굴 (불꽃길·마그마 아지트 4층 문법) 28×20 ====
// 아래 출구 빛(도착) ─ 벽에서 벽까지 가로지른 용암 호수(북·남 변은 곧은 둑) ─ 위 벽에 기댄 사다리. 호수를 건너는 길은 식은 껍질 판 다리 하나뿐,
// 다리는 용암 그룹이 이어진 이웃으로 봐서 둑 없이 붙는다. 
{
  const rows = [
    "############################",
    "############################",
    "############################",
    "##########L#################",
    "#####...................####",
    "#####...........v...t...####",
    "###.....e..~~ccc~~~~x....###",
    "###..x~~~~~~~ccc~~~~~~x..###",
    "###..~~~~~~~~ccc~~~~~~~~.###",
    "#####~~~~~~~~ccc~~~~~~~~~###",
    "#####~~~~~~~~ccc~~~~~~~~~###",
    "###.~~~~~~~~~ccc~~~~~~~~.###",
    "###b~~~~~~~~~ccc~~~~~~...###",
    "###...~~~~~~~ccc~~~......###",
    "###....x.........x.......###",
    "###..e..v.o......k..t....###",
    "######................######",
    "#########....###############",
    "###########E################",
    "############################",
  ].map((r) => r.padEnd(28, "#").slice(0, 28));
  const legend: Legend = {
    "~": { grp: "lv_lava" }, c: { grp: "lv_cb" }, x: { lo: "lv_cinder" }, e: { up: "lv_ember0" }, b: { up: "lv_ember1" },
    v: { stamp: "lv_vent", at: [0, -1] }, t: { stamp: "lv_stal", at: [0, -1] }, o: { up: "lv_boulder" }, k: { up: "lv_cracked" },
    L: { wall: true, up: "lv_ladder" }, E: { lo: "lv_exit" },
  };
  const f = caveMap("lava_cave", "lv", lavaFloor, "lv_fl_s", rows, legend);
  k.noSpecks(f, "lv_lava", ["lv_cb"]);   // 배치(모양) 관문은 섞기 전에 — 섞는 가장자리 변형은 그룹 밖 낱칸이라 이 관문이 모른다
  // 다리 칸 섞기(QA-L3 N20): 서쪽 열 at55·동쪽 열 at205 는 용암 쪽 윤곽이 다른 변형 넷에서, 가운데 열은 빛 없는 속 변형 일곱에서 고른다.
  // 위·옆 칸과 같은 그림은 금지. 붉은 틈 빛은 덧그림 넷만, 서로 2칸 이상 떨어뜨린다.
  const bridgeCells = find(rows, "c");
  for (const [k, pool] of [["lv_cb_at55", ["lv_cb_at55", "lv_cb_alt55_0", "lv_cb_alt55_1", "lv_cb_alt55_2"]],
    ["lv_cb_at205", ["lv_cb_at205", "lv_cb_alt205_0", "lv_cb_alt205_1", "lv_cb_alt205_2"]],
    ["lv_cb_at255", ["lv_cb_at255", ...[0, 1, 2, 3, 4, 5].map((v) => `lv_cb_atin0_${v}`)]]] as const) {
    mix(f, bridgeCells.filter(([x, y]) => pool.includes(f.at(x, y))), [...pool], k.length);
  }
  for (const [x, y, v] of [[13, 8, 0], [15, 7, 2], [15, 10, 1], [14, 12, 0]] as const) f.up(x, y, `lv_cb_glow${v}`);
  mixLavaEdges(f, "lv", 0x3e1);
  // 굳은 껍질 판(체육관 QA-L6 N14): 칸 해시가 아니라 맵 전체 픽셀 좌표 포아송 흩뿌리기 — 줄 서지 않게, 소 많이 · 중 가끔 · 대 드물게.
  const crust = scatterCrust(f, (x, y) => /^lv_(at255|atin\d_\d)(_f0)?$/.test(f.at(x, y)), 0x1a7a);
  k.check(crust.length >= 8, `lava_cave: 껍질 판이 ${crust.length} 개뿐이다`);
  for (const [x, y, j] of crust) f.lo(x, y, `lv_crust${j}_f0`);
  console.log(`· lava_cave: 껍질 판 ${crust.length}개 (소 ${crust.filter((c) => c[2] >= 4 && c[2] <= 9).length} · 중 ${crust.filter((c) => c[2] <= 3).length} · 대 ${crust.filter((c) => c[2] >= 10).length})`);
  f.save();
  k.describe(f, "용암 동굴: 적갈 바닥보다 낮은 평평한 용암 호수가 벽에서 벽까지 가로막고(북쪽만 둑 앞면), 건너는 길은 용암에 둑 없이 붙은 식은 껍질 판 다리 한 줄뿐이다. 다리 가장자리 칸에는 붉은 틈 덧그림을 드문드문 얹어 반복을 깬다. 분기공·불씨는 둑 곁, 바위깨기 바위는 한쪽으로 치우친 갈래 금.");
  const S = find(rows, "E")[0], L = find(rows, "L")[0];
  const bridge = find(rows, "c");
  k.expectReach(f, S, [L], "아래 출구 빛 → 껍질 다리로 용암 건너기 → 벽에 기댄 사다리");
  k.expectNoReach(f, S, [L], "껍질 다리가 없으면 용암이 길을 끊는다", { blocked: bridge });
  const mid = bridge.filter(([, y]) => y === 9 || y === 10);  // 다리 가운데 두 줄
  k.negative(f, "bridge-broken", "다리 가운데 두 줄(9·10행)이 용암이면 북쪽으로 못 건넌다", (g) => { g.paint("lv_lava", mid); g.shape(["lv_lava"]); }, S, [L]);
}

// ==== 3. 유령 탑 (포켓몬 타워 3층·送り火山 1층 문법) 22×18 ====
// 아래 가운데 주황 매트(아래층에서 올라옴) → 가로 줄 맞춘 묘비 사이 통로 → 오른쪽 뒷벽 계단. 가운데 큰 비석 앞에 향로·공양, 줄 끝에 촛대, 가장자리는 어둠 띠.
{
  const rows = [
    "....................",
    "..k......O......k...",
    "....................",
    ".aaaaaaa.e.f.aaaaaa.",
    ".a..................",
    ".a.dabda....adcaba..",
    ".a..................",
    ".a.aaaaa....aaaaaa..",
    "....................",
    ".aaa..aaaa..aaaa..b.",
    ".a.a................",
    ".aaa.aaaaa..aaaa.aa.",
    "....................",
    "..k..............k..",
    "....................",
  ];
  const legend: Legend = {
    a: { up: "gh_grave_a" }, b: { up: "gh_grave_b" }, c: { up: "gh_grave_c" }, d: { up: "gh_grave_d" },
    e: { stamp: "gh_censer", at: [0, -1] }, f: { up: "gh_offer" }, k: { up: "gh_candle" }, O: { stamp: "gh_obelisk", at: [0, -1] },
  };
  const W = 22, H = 18;
  const fl = (x: number, y: number) => {
    const dim = x === 1 ? "w" : x === W - 2 ? "e" : "";
    if (y === H - 2) return `gh_dim_s${dim}`;
    if (dim && y === 2) return `gh_dim_${dim}_s`;
    if (dim) return `gh_dim_${dim}`;
    return `gh_fl${hash(x, y) % 9 === 0 ? 1 : 0}`;
  };
  const f = roomMap("ghost_tower", "gh", fl, rows, legend, {
    sideEdge: ["gh_edge_v", "gh_edge_v"], bottomEdge: "gh_edge_v", corners: ["gh_edge_v", "gh_edge_v"],
    exitX: 10, exitTile: "gh_mat", exitEdge: "gh_edge_v", shade: { s: "gh_fl_s", plain: /^gh_fl\d$/ },
  });
  f.stamp("gh_stairs", 17, 0);
  f.save();
  k.describe(f, "유령 탑: 보라 판벽 아래 지그재그 바닥에 보라회색 비석이 가로 줄을 맞춰 늘어서고 줄 사이가 통로다. 계단은 뒷벽 두 줄에 박힌 돌 문틀, 들어온 곳은 아래 가운데 주황 매트, 가장자리는 어둠 띠.");
  const start: Cell = [10, H - 2];
  k.expectReach(f, start, [[17, 1], [18, 1]], "아래 매트 → 묘비 줄 사이 → 뒷벽 계단");
  k.expectNoReach(f, start, rfind(rows, "a").slice(0, 1), "묘비 칸은 막힌다");
  k.expectNoReach(f, start, [[3, 12]], "묘비로 둘러싼 묘역 안은 못 들어간다");
  k.expectReach(f, start, [[11, 6], [10, 6]], "비석 앞 향로·공양 자리까지 걸어간다");
}

// ==== 4. 발전소·악당 아지트 (로켓단 아지트 지하 3층 회전 바닥·무인발전소 문법) 22×17 ====
// 아래 입구 구역 → 칸막이 틈의 위 화살표에 실려 판으로 → 화살표가 미는 대로 정지 칸을 거쳐 → 북쪽 틈 → 발전기 방.
// 판 오른쪽 위 차단기(닫힘)는 발전기 방에서 레버를 당긴 뒤 열리는 지름길 자리. 전선은 발전기에서 나와 칸막이로 들어간다.
{
  const rows = [
    "w...G.....g...CC.Q..",
    "....=.........CC.q.l",
    "....=...V...........",
    "BBBBBBBBBBBBBB.BBBXB",
    "v<v<....BB.^>.sBB..v",
    "...BB...BB.^..BB^.^<",
    ">.>....s...^v..^^.B.",
    "BB.BB....BB...^...^.",
    "...^...BBB..<...BB..",
    "<.......v....^BB..s.",
    "..BB.^.^..>.........",
    "BBBB^BBBBBBBBBBBBBBB",
    "......r.............",
    ".W...........d..r...",
  ];
  const legend: Legend = {
    B: { grp: "pw_pb" }, "^": { lo: "pw_spin_u" }, v: { lo: "pw_spin_d" }, "<": { lo: "pw_spin_l" }, ">": { lo: "pw_spin_r" }, s: { lo: "pw_spin_stop" },
    w: { lo: "pw_warp" }, W: { lo: "pw_warp" }, G: { stamp: "pw_gen", at: [0, -1] }, g: { stamp: "pw_gen", at: [0, -1] }, C: {}, Q: { stamp: "pw_coil", at: [0, -1] }, q: {},
    V: { lo: "pw_fl1" }, X: { up: "pw_gate" }, l: { lo: "pw_switch" }, r: { up: "pw_crate" }, d: { up: "pw_drum" },
    "=": { up: "pw_cable_v" },
  };
  const f = roomMap("hideout", "pw", (x, y) => `pw_fl${hash(x, y) % 11 === 0 ? 2 : 0}`, rows, legend, {
    wallRow: "......v......v......", wallKey: { v: "v" },
    blockGrp: "pw_pb", shade: { s: "pw_fl_s", e: "pw_fl_e", se: "pw_fl_se", plain: /^pw_fl\d$/ }, exitX: 11, exitTile: undefined,
  });
  f.stamp("pw_console", 15, 1);
  f.lo(11, 15, "pw_stairs_dn");
  f.save();
  k.describe(f, "악당 아지트: 청록 윗면 칸막이(아래 4px 앞면)가 금속 판 바닥을 칸칸이 나누고, 회전 화살표가 그 사이를 민다 — 화살표를 타야만 판을 건너며 정지 칸·칸막이 앞에서 멈춘다. 뒷벽은 바닥과 다른 밝은 판 + 배관 + 경고 띠.");
  const S: Cell = [11, 15], T: Cell = [15, 3];
  const arrows = findAll(rows, "^v<>").map(([x, y]) => [x + 1, y + 2] as Cell);
  k.expectReach(f, S, [T, [2, 2]], "입구 → 화살표 판 → 북쪽 틈 → 발전기 방(워프 판까지)");
  k.expectNoReach(f, S, [T], "화살표를 타지 않으면 판을 못 건넌다", { blocked: arrows });
  const pocket: Cell[] = [[1, 7], [2, 7], [3, 7], [2, 8]];
  k.expectNoReach(f, S, pocket, "왼쪽 위 구석은 화살표가 밀어내 멈출 수 없다");
  const flat = roomMap("hideout_flat", "pw", () => "pw_fl0", rows.map((r) => r.replace(/[\^v<>]/g, ".")), legend, { blockGrp: "pw_pb" });
  k.expectReach(flat, S, pocket, "대조: 화살표가 없다면 걸어서 닿는다");
  k.expectNoReach(f, S, [[2, 2], [19, 4]], "북쪽 틈(15,5)을 막으면 닫힌 차단기(19,5)로는 못 지나간다", { blocked: [[15, 5]] });
  k.negative(f, "gap-closed", "칸막이 줄의 북쪽 틈(15,5)이 막히면 발전기 방에 못 간다 — 차단기(19,5)는 닫혀 있다", (g) => { g.paint("pw_pb", [[15, 5]]); g.shape(); }, S, [T]);
}

// ==== 5. 고대 유적 (봉인의 방·석실 문법) 22×16 ====
// 아래 출구 빛 → 모래 바닥 → 두 줄 두께 돌담 세 겹(틈이 왼쪽 → 오른쪽 → 가운데로 번갈아) → 뒷벽 앞 제단. 뒷벽은 새긴 돌 블록에 벽기둥·점자 판.
{
  const rows = [
    "..P..u...AA.....P...",
    ".........AA.........",
    "BBBBBBBBB,,BBBBBBBBB",
    "BBBBBBBBB,,BBBBBBBBB",
    "....................",
    "BBBBBBBBBBBBBBBBBB..",
    "BBBBBBBBBBBBBBBBBB..",
    "....................",
    "BBBBB.BBBBBBBBBBBBBB",
    "BBBBB.BBBBBBBBBBBBBB",
    "....................",
    "....z....,,....R....",
    ".P....x.......u..P..",
  ];
  const legend: Legend = {
    B: { grp: "ru_pb" }, P: { stamp: "ru_pillar", at: [0, -1] }, A: {}, R: { stamp: "ru_braille", at: [0, -1] },
    u: { up: "ru_urn" }, z: { up: "ru_rubble0" }, x: { up: "ru_rubble1" },
  };
  const f = roomMap("ruins", "ru", (x, y) => `ru_sand${hash(x, y) % 4}`, rows, legend, {
    wallRow: ".....p.g....h..p....", wallKey: { p: "p", g: "g0", h: "g1" },
    blockGrp: "ru_pb", shade: { s: "ru_sand_s", e: "ru_sand_e", se: "ru_sand_se", c: "ru_sand_c", plain: /^ru_sand\d$/ }, exitX: 10, exitTile: "ru_exit",
  });
  for (const [x, y] of rfind(rows, ",")) if (!(x === 10 && y === 14)) {
    const v = ((x - 10) & 1) + 2 * (y & 1 ? 1 : 0);
    // 바로 왼쪽이 돌담이면 담 끝 그늘을 받는 판석(왼쪽 6px 그늘 — 모래 ru_sand_e 와 같은 띠, QA-I5 V4)
    f.lo(x, y, rows[y - 2]?.[x - 2] === "B" && (v === 0 || v === 2) ? `ru_fl${v}_e` : `ru_fl${v}`);
  }
  f.stamp("ru_altar", 10, 2);
  // 담 윗줄 깨진 홈: 3~4칸에 하나, 바로 왼쪽 칸에 홈이 있으면 건너뛰고, 한 줄 안에서는 넷을 다 쓰기 전에 같은 모양을 다시 쓰지 않는다(QA-L4 N34)
  const cracks = ["ru_pb_crack", "ru_pb_crack1", "ru_pb_crack2", "ru_pb_crack3"];
  const usedInRow: Record<number, Set<number>> = {};
  for (const [x, y] of rfind(rows, "B").sort((a, b) => a[1] - b[1] || a[0] - b[0])) {
    if (!(rows[y - 2 + 1]?.[x - 1] === "B" && rows[y - 2 - 1]?.[x - 1] !== "B" && hash(x, y) % 4 === 0)) continue;
    if (f.map.upperTiles[y * f.W + x - 1] >= 0 && cracks.includes(k.names[f.map.upperTiles[y * f.W + x - 1]] ?? "")) continue;
    const used = (usedInRow[y] ??= new Set<number>());
    if (used.size === cracks.length) used.clear();
    let i = hash(y, x) % cracks.length;
    while (used.has(i)) i = (i + 1) % cracks.length;
    used.add(i);
    f.up(x, y, cracks[i]);
  }
  f.save();
  k.describe(f, "고대 유적: 모래 바닥을 두 줄 두께 돌담(청록 윗면 + 점 두 줄 앞면)이 겹겹이 막고 틈이 번갈아 나서 길이 하나로 꺾인다. 뒷벽은 새긴 돌 블록에 벽기둥·점자 판, 제단 앞 한 장만 무늬 판석, 아래 가운데가 출구 빛(그 앞 판석 한 줄 — 담 앞까지 이어 막힌 길로 보이지 않게, 담 밑 모래에는 그늘).");
  const S: Cell = [10, 14];
  k.expectReach(f, S, [[10, 4], [11, 4]], "출구 빛 → 돌담 세 겹 → 제단 앞");
  k.expectNoReach(f, S, [[11, 2]], "제단은 막힌다(조사 이벤트 자리)");
  const gap: Cell[] = [[6, 10], [6, 11]];
  k.negative(f, "wall-gap-closed", "아래 돌담의 틈(6,10~11)이 막히면 제단에 못 간다 — 미로는 한 길", (g) => { g.paint("ru_pb", gap); g.shape(); }, S, [[10, 4]]);
}

// ==== 6. 해저 동굴 (해저동굴 방 문법) 22×18 ====
// 아래 출구 빛(도착) → 왼쪽 웅덩이 곁 젖은 바닥 → 오른쪽 기슭 길 → 위 벽에 기댄 사다리. 큰 웅덩이 속 바위섬(구멍 사다리)은 파도타기 자리 — 걸어서는 못 간다.
{
  const rows = [
    "######################",
    "######################",
    "##########L###########",
    "####.........h....####",
    "####..............####",
    "##......~~~~~.......##",
    "##....~~~~II~~~.....##",
    "##...~~~~~IDI~~~~...##",
    "##..~~~~~~III~~~~...##",
    "##..~~~~~~~~~~~~~q..##",
    "##...~~~~~~~~~~~....##",
    "##e....~~~~~~~...r..##",
    "##~~..........p.....##",
    "##~~~c.m........t...##",
    "##~~~...............##",
    "#######.........######",
    "###########.##########",
    "###########E##########",
    "######################",
  ];
  const legend: Legend = {
    "~": { grp: "se_pool" }, e: { up: "se_weed0" }, q: { up: "se_weed1" }, h: { up: "se_shell0" }, m: { up: "se_shell1" }, p: { lo: "se_puddle" },
    c: { up: "se_coral" }, t: { stamp: "se_stal", at: [0, -1] }, r: { up: "se_rock" }, I: { grp: "se_isle" }, D: [{ grp: "se_isle" }, { up: "se_hole_o" }],
    L: { wall: true, up: "se_ladder" }, E: { lo: "se_exit" },
  };
  const f = caveMap("sea_cave", "se", (x, y) => `se_fl${hash(x, y) % 4}`, "se_fl_s", rows, legend);
  f.save();
  k.noSpecks(f, "se_pool", ["se_isle"]);
  k.describe(f, "해저 동굴: 벽·바닥이 같은 회갈 계열이고 물은 바닥보다 낮은 물결 웅덩이(북쪽만 둑 앞면)다. 웅덩이가 방 가운데를 막아 길은 기슭을 돌아가고, 웅덩이 속 바위섬(둥근 귀·남쪽 앞면, 웅덩이가 이어진 이웃으로 본다)의 구멍 사다리는 파도타기로만 간다. 해초·산호는 물가에만.");
  const S = find(rows, "E")[0], L = find(rows, "L")[0], D = find(rows, "D")[0];
  k.expectReach(f, S, [L], "아래 출구 빛 → 웅덩이 기슭 길 → 벽에 기댄 사다리");
  k.expectNoReach(f, S, [D], "웅덩이 속 바위섬 구멍은 파도타기 없이 못 간다");
}

k.done();
