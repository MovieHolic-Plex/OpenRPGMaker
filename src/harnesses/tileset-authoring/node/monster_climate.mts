/** 기후 시트 쇼케이스·검사 — 눈 마을 · 얼음 퍼즐 눈길 · 사막(111번 도로) · 화산재 마을(꽃잎마을+용암마을 온천).
 *  bash cycle_theme.sh monster-climate <run>
 *  도달 검사는 엔진 canMove·턱·slideAfterStep 그대로(kitlib). 얼음 퍼즐은 「얼음 없이는 못 간다」까지 증명한다. */
import { Kit, Field, type Cell } from "./kitlib.mts";
import { canMove } from "../../../project/collision";
import { slideAfterStep } from "../../../project/slideTiles";
import { kitSheet, roundFace, roundTall } from "./wild_round.mts";   // 정본 둥근 띠 끝·둥근 귀 풀숲 배치(감독 결정 I4 W2·W3)
const k = new Kit(process.argv[2]);
const rs = kitSheet(k);
const R = (x0: number, y0: number, x1: number, y1: number) => [...k.rect(x0, y0, x1, y1)];
const key = ([x, y]: Cell) => `${x},${y}`;

/** 턱 한 줄(prefix_s_l/mid/mid1/r): 끝은 가늘어지는 끝 조각. skip 칸(숲·길)은 건너뛴다. */
function ledgeRow(f: Field, prefix: string, y: number, x0: number, x1: number, gaps: [number, number][] = []) {
  const on = (x: number) => x >= x0 && x <= x1 && !f.wood.has(`${x},${y}`) && !gaps.some(([a, b]) => x >= a && x <= b);
  for (let x = x0; x <= x1; x++) {
    if (!on(x)) continue;
    const l = !on(x - 1) && !f.wood.has(`${x - 1},${y}`), r = !on(x + 1) && !f.wood.has(`${x + 1},${y}`);
    f.lo(x, y, l ? `${prefix}_s_l` : r ? `${prefix}_s_r` : x % 2 ? `${prefix}_s_mid` : `${prefix}_s_mid1`);
  }
}
/** 풀밭 가장자리 잎끝(본 시트 route 와 같은 규칙, L7 K4): 풀밭 남·동·서 이웃이 맨 바닥(위층 비었음)이면 정본 tall_fringe 그림을 위층에 얹는다
 *  — 풀숲이 칸 변에서 칼로 자른 카펫처럼 끝나지 않게. */
function tallFringe(f: Field, tall: string, bare: RegExp) {
  const tallAt = (x: number, y: number) => f.in(x, y) && new RegExp(`^${tall}\\d$`).test(f.at(x, y));
  const ok = (x: number, y: number) => f.map.upperTiles[y * f.W + x] < 0 && bare.test(f.at(x, y));
  for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
    if (!ok(x, y)) continue;
    if (tallAt(x, y - 1)) f.up(x, y, `${tall}_fringe_s`);
    else if (tallAt(x - 1, y)) f.up(x, y, `${tall}_fringe_e`);
    else if (tallAt(x + 1, y)) f.up(x, y, `${tall}_fringe_w`);
  }
}
/** 흔들린 타원 덩이 칸(원작 얼룩처럼 둥글게). */
function blob(cx: number, cy: number, rx: number, ry: number, seed: number): Cell[] {
  const cells = new Set<string>();
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
    const a = Math.atan2(y - cy, x - cx); const kk = 1 + 0.15 * Math.sin(a * 3 + seed) + 0.08 * Math.sin(a * 5 + seed * 2);
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= kk * kk) cells.add(`${x},${y}`);
  }
  const n4 = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => cells.has(`${x + dx},${y + dy}`)).length;
  for (let p = 0; p < 2; p++) for (const c of [...cells]) { const [x, y] = c.split(",").map(Number); if (n4(x, y) < 2) cells.delete(c); }
  return [...cells].map((c) => c.split(",").map(Number) as Cell);
}

/** 눈 바닥: 흰 반짝임이 있는 snow3 은 드물게(약 1/11) — 선형 식은 행·열 전체를 고르므로(x*(5+y)≡0 mod 11, L4 N1) 비트 섞기 해시로 고르고,
 *  먼저 고른 이웃(8칸)이 있으면 건너뛴다. 나머지 세 변형도 해시로 고른다(줄 서지 않게). */
const cellHash = (x: number, y: number) => { let n = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ 0x5bd1e995) >>> 0; n = Math.imul(n ^ (n >>> 15), 2246822519) >>> 0; return (n ^ (n >>> 13)) >>> 0; };
const isSparkle = (x: number, y: number): boolean => {
  if (cellHash(x, y) % 11 !== 0) return false;
  for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (dy === 0 && dx >= 0) continue;
    if (cellHash(x + dx, y + dy) % 11 === 0) return false;
  }
  return true;
};
const snowPick = (x: number, y: number) => (isSparkle(x, y) ? "snow3" : `snow${(cellHash(x, y) >>> 4) % 3}`);

/** 정본 바위 고원 두 그룹(야생 cliffg·gface·gstairs 문법, 통합 검수 I1 X1·X9): 벼랑 칸 L 의 남쪽 끝 칸(아래가 L 밖)과 그 바로 밑 칸이 앞면 두 줄,
 *  나머지가 윗면. 앞면 줄을 끊는 2×2 돌계단만 윗면으로 오르는 길이다. */
const N = 1, E = 2, S = 4, Wb = 8, NE = 16, SE = 32, SW = 64, NW = 128;
const canon = (m8: number) => {
  let m = m8 & 15;
  for (const [sides, diag] of [[N | E, NE], [S | E, SE], [S | Wb, SW], [N | Wb, NW]]) if ((m & sides) === sides && m8 & diag) m |= diag;
  return m;
};
function plateauSplit(f: Field, L: Set<string>): { top: Cell[]; face: Cell[] } {
  const top: Cell[] = [], face: Cell[] = [];
  for (const c of L) {
    const [x, y] = c.split(",").map(Number);
    if (y + 1 < f.H && !L.has(`${x},${y + 1}`)) { face.push([x, y]); face.push([x, y + 1]); } else top.push([x, y]);
  }
  return { top, face };
}
/** 오토타일 칸 하나를 「그쪽은 이어졌다」로 바꾼다(돌계단 위 윗면·계단 옆 앞면). 속 변형으로 바뀐 칸은 그대로 둔다. */
function join(f: Field, grp: string, x: number, y: number, bits: number) {
  const g = k.g(grp); const t = f.map.lowerTiles[y * f.W + x];
  const raw = Object.keys(g.variantMap).find((m) => g.variantMap[m] === t);
  if (raw === undefined) return;
  f.map.lowerTiles[y * f.W + x] = g.variantMap[String(canon(canon(Number(raw)) | bits))];
}
/** 앞면 두 줄 가운데 칸을 덩이 변형으로 섞는다 — 야생 faceVary 와 같은 해시(한 열의 윗칸·아랫칸은 같은 변형). */
function faceVary(f: Field, grp: string) {
  const g = k.g(grp); const pre = `${grp}_at`;
  const h = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
  for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
    const raw = Object.keys(g.variantMap).find((m) => g.variantMap[m] === f.map.lowerTiles[y * f.W + x]); if (raw === undefined) continue;
    const m = canon(Number(raw));
    const tier = (m & (E | Wb)) !== (E | Wb) ? -1 : !(m & N) && m & S ? 0 : m & N && !(m & S) ? 1 : -1; if (tier < 0) continue;
    const v = h(x + 3, y - tier) % 5; if (v) f.lo(x, y, `${pre}in${tier}_${v - 1}`);
  }
}
/** 2×2 돌계단을 앞면 두 줄 (x..x+1, y..y+1) 에 찍는다: 계단 위 윗면 칸은 남쪽이, 계단 양옆 앞면 칸은 계단 쪽이 이어진 변형으로. */
function stairs(f: Field, top: string, face: string, st: string, x: number, y: number) {
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) f.lo(x + dx, y + dy, `${st}_${dx}_${dy}`);
  for (const dx of [0, 1]) join(f, top, x + dx, y - 1, S | SE | SW);
  for (const dy of [0, 1]) { if (x - 1 >= 0) join(f, face, x - 1, y + dy, E | NE | SE); if (x + 2 < f.W) join(f, face, x + 2, y + dy, Wb | NW | SW); }
}

/** 둥근 띠 끝 마감 뒤(정본 roundFace 다음에 부른다): 발끝(앞면 아랫칸, 마스크에 N)의 열린 옆이 같은 고원의 윗면 칸이면(층이 4줄 이상 물러나는 안쪽 모서리 —
 *  좁아진 고원이 남쪽으로 이어진다) 그 옆은 땅이 아니라 고원이라, 정본 발끝 곡선이 깎아 낸 자리에 아랫바닥(모래·재)이 쐐기로 박힌다.
 *  그 옆만 「이어짐」으로 돌려 앞면이 고원 칸에 맞붙게 한다(다른 옆이 아직 열려 있으면 그 옆 곡선은 정본 _rnd 그대로).
 *  야생 산은 사선 계단이 한 줄씩 물러나 아랫칸 옆이 늘 다음 열 앞면이라 이 자리가 생기지 않는다. 어깨(윗칸)는 곡선 밖이 윗면이라 그대로 둔다. */
function innerFeet(f: Field, grp: string, pre: string, top: RegExp): number {
  const g = k.g(grp); let n = 0;
  const rnd = new RegExp(`^${pre}_rnd(\\d+)$`);
  for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
    const m = rnd.exec(k.names[f.map.lowerTiles[y * f.W + x]] ?? ""); if (!m) continue;
    const mk = Number(m[1]); if (!(mk & N)) continue;
    const isTop = (xx: number) => xx >= 0 && xx < f.W && top.test(k.names[f.map.lowerTiles[y * f.W + xx]] ?? "");
    let add = 0;
    if (!(mk & E) && isTop(x + 1)) add |= E | NE;
    if (!(mk & Wb) && isTop(x - 1)) add |= Wb | NW;
    if (!add) continue;
    const nm = canon(mk | add);
    f.map.lowerTiles[y * f.W + x] = [Wb | N, Wb | N | NW, E | N, E | N | NE, N].includes(nm) ? k.id(`${pre}_rnd${nm}`) : g.variantMap[String(nm)];
    n++;
  }
  return n;
}

/** 엔진 canMove·미끄럼으로 start 에서 targets 중 하나까지 최소 몇 수(한 번 밀면 벽·바위까지 미끄러지는 것을 한 수로 센다). 못 가면 999. */
function movesTo(f: Field, start: Cell, targets: Cell[]): number {
  const project: any = { tilesets: { t: k.ts } };
  const map = { ...f.map, tilesetId: "t" };
  const want = new Set(targets.map(key));
  const dist = new Map<string, number>([[key(start), 0]]); const q: Cell[] = [start];
  while (q.length) {
    const [x, y] = q.shift()!; const d0 = dist.get(`${x},${y}`)!;
    if (want.has(`${x},${y}`)) return d0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as Cell[]) {
      let nx = x + dx, ny = y + dy;
      if (!canMove(project, map as any, x, y, nx, ny)) continue;
      let sdx = dx, sdy = dy, kind: any = null, guard = 0;
      for (;;) {
        const s = slideAfterStep(k.ts, map as any, nx, ny, sdx, sdy, kind);
        if (!s || ++guard > 300 || !canMove(project, map as any, nx, ny, nx + s.dx, ny + s.dy)) break;
        nx += s.dx; ny += s.dy; sdx = s.dx; sdy = s.dy; kind = s.kind;
      }
      if (!dist.has(`${nx},${ny}`)) { dist.set(`${nx},${ny}`, d0 + 1); q.push([nx, ny]); }
    }
  }
  return 999;
}

/** 풀숲 덩이: 직사각형에서 모서리 칸을 1~2개씩 빼 들쭉날쭉하게(원작 풀숲은 칼같이 자른 네모가 아니다). */
function lump(x0: number, y0: number, x1: number, y1: number, seed: number): Cell[] {
  const drop = new Set<string>();
  const corners: Cell[] = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
  corners.forEach(([x, y], i) => { if ((seed + i) % 4 !== 0) drop.add(`${x},${y}`); });
  const extra: Cell[] = [[x0 + 1, y0], [x1, y0 + 1], [x0, y1 - 1], [x1 - 1, y1]];
  extra.forEach(([x, y], i) => { if ((seed * 3 + i) % 3 === 0) drop.add(`${x},${y}`); });
  return R(x0, y0, x1, y1).filter((c) => !drop.has(key(c)));
}

/** 위층 물체가 벼랑 칸(또는 그 앞면 아랫단) 위에 얹히지 않았는지 — allowed 는 일부러 얹은 칸(벼랑 위 봉우리). */
function overlapCheck(f: Field, groups: string[], allowed: Set<string>) {
  const own = new Set<number>(groups.flatMap((g) => k.g(g).memberTileIds));
  const bad: string[] = [];
  for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
    const i = y * f.W + x, lo = f.map.lowerTiles[i];
    const isCliff = own.has(lo) || /_face_[mlrs]$|face2?_rnd\d+$/.test(k.names[lo] ?? "");
    if (isCliff && f.map.upperTiles[i] >= 0 && !allowed.has(`${x},${y}`)) bad.push(`(${x},${y}) ${k.names[f.map.upperTiles[i]]}`);
  }
  k.check(!bad.length, `${f.name}: 벼랑 칸 위에 얹힌 물체 — ${bad.join(" ")}`);
}

// ---- 1. 눈 마을 22×19: 눈 숲 벽이 감싸고, 둘레 고리 눈길(행 3·16, 열 2·19) + 가운데 큰길(10~11) + 가로길(9~10), 센터·집·얼어붙은 연못은 새 눈 섬 위에(본 시트 마을 문법).
//      건물이 원작 비례 4×4(센터 문 1칸, 통합 I4 W1)로 줄어 섬을 7×5 로 줄이고 맵도 26×21 → 22×19 로 줄였다(빈 눈밭이 남지 않게) ----
{
  const W = 22, H = 19;
  const f = k.field("snow_town", W, H, snowPick);
  const trees = new Set<string>();
  for (let i = 0; i < 11; i++) { if (i !== 5) { trees.add(`${i},0`); trees.add(`${i},9`); } }
  for (let j = 0; j <= 9; j++) { trees.add(`0,${j}`); trees.add(`10,${j}`); }
  const islands = [[3, 4, 9, 8], [12, 4, 18, 8], [3, 11, 9, 15], [12, 11, 18, 15]];
  const inIsland = (x: number, y: number) => islands.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
  const ground: Cell[] = [];
  for (const [x, y] of k.rect(2, 3, 19, 16)) if (!inIsland(x, y)) ground.push([x, y]);
  ground.push(...R(10, 0, 11, 2), ...R(10, 17, 11, 18));
  f.paint("snowpath", ground);
  f.paint("pond", R(4, 5, 7, 7));
  f.shape(["snowpath"]);
  f.stamp("center_snow", 14, 4); f.up(18, 7, "frost_bush"); f.up(12, 5, "sign_snow");
  f.stamp("house_snow_a", 4, 11); f.up(3, 14, "mailbox"); f.up(9, 12, "frost_bush"); f.up(8, 15, "snow_pile0");
  f.stamp("cabin_snow", 14, 11); f.stamp("snowman", 18, 12); f.up(12, 15, "sign_snow");
  f.stamp("spine_a", 8, 4); f.stamp("spine_a", 12, 11);
  f.up(3, 8, "snow_pile1"); f.up(18, 15, "snow_pile0");
  f.forest(trees, "sforest_");
  f.save();
  const door = (n: string, x: number, y: number): Cell => { const e = k.obj(n).entrance; return [x + e.dx, y + e.dy]; };
  const dC = door("center_snow", 14, 4), dH = door("house_snow_a", 4, 11), dK = door("cabin_snow", 14, 11);
  k.describe(f, "눈 마을(본 시트 마을 문법을 눈 재료로): 눈 숲 벽(sforest_)이 감싸고, 걷는 땅은 다져진 눈길(snowpath) — 둘레 고리 + 가운데 큰길 + 가로길. 센터·집·얼어붙은 연못(pond, 돌 고리)은 새 눈(snow) 섬 위에 선다. 건물은 원작 비례 4×4(센터 문 1칸). 지붕은 눈이 지붕 모양을 따라 덮고 처마에 눈 턱·고드름. 문 앞 칸은 비운다. 출구는 북·남 가운데.");
  k.expectReach(f, [10, 18], [[10, 0], dC, dH, dK], "남쪽 입구 → 북쪽 출구·센터·집 두 채 문");
  k.expectNoReach(f, [10, 18], [[5, 6]], "얼어붙은 연못 안으로는 못 들어간다");
  k.negative(f, "door-blocked", "센터 문 앞 칸에 눈더미를 놓아 입구가 막힘", (g) => g.up(dC[0], dC[1] + 1, "snow_pile0"), [10, 18], [dC]);
}

// ---- 2. 눈길 + 얼음 퍼즐 24×32(바다 동굴 얼음방 문법): 눈 벼랑(icecliff 윗면 + iceface 앞면)이 얼음 판을 바로 감싸고, 드나드는 곳은 남쪽 틈(14~15)과
//      북쪽 틈(10~11) 두 칸 폭씩뿐. 얼음 위 바위 8개가 멈춤 칸 — 남쪽에서 들어와 11수 만에 북쪽 틈에 닿는다 ----
{
  const W = 24, H = 32;
  const f = k.field("ice_route", W, H, snowPick);
  const trees = new Set<string>();
  for (let j = 0; j < 16; j++) for (const i of [0, 1, 10, 11]) trees.add(`${i},${j}`);
  const ICE = R(5, 11, 18, 18);
  // 눈 벼랑 고원(I2 Y8 — 야생 정본 두 그룹을 눈 색으로): 북 고원은 윗면 7~8 + 앞면 두 줄 9~10, 남 고원은 윗면 19~20 + 앞면 21~22,
  // 양옆 한 칸 기둥(4·19열)은 윗면 테가 얼음 판을 바로 막는다. 오르는 길(돌계단)은 없다 — 넘을 수 없는 둔덕.
  const L = new Set([...R(4, 7, 19, 9), ...R(4, 19, 19, 21), ...R(4, 10, 4, 18), ...R(19, 10, 19, 18)]
    .filter(([x, y]) => !((x === 10 || x === 11) && y <= 10) && !((x === 14 || x === 15) && y >= 19)).map(key));
  const iceSplit = plateauSplit(f, L);
  // (10,16) 은 북→남 길을 여는 바위(L4 N3 — 없으면 북에서 온 사람은 남쪽 틈 열에 닿지 못한다)
  const rocks: Cell[] = [[12, 18], [13, 15], [14, 11], [14, 14], [16, 11], [16, 13], [16, 18], [18, 16], [10, 16]];
  const path: Cell[] = [...R(10, 0, 11, 10), ...R(14, 19, 15, 24), ...R(8, 25, 15, 26), ...R(8, 25, 9, 31)];
  f.paint("icecliff", iceSplit.top);
  f.paint("iceface", iceSplit.face);
  f.paint("snowpath", path);
  f.paint("ice", ICE);
  f.shape(["icecliff"]);
  faceVary(f, "iceface");
  // 한 칸 둔덕(4·19열)의 앞면 옆 두 칸(9~10행): 엔진은 이웃 앞면을 「이어짐」으로 봐 안쪽 테를 지우고 흰 윗면을 그린다 → 앞면 둥근 끝과 둔덕 사이에
  // 흰 세로 틈(I3 Z4). 11행 아래와 같은 양옆 테 변형(N|S)으로 바꿔 둔덕 테가 앞면 끝까지 이어지게 한다.
  for (const [x, y] of [[4, 9], [4, 10], [19, 9], [19, 10]] as Cell[]) f.lo(x, y, "icecliff_at5");
  for (const y of [9, 10]) { join(f, "iceface", 5, y, Wb | NW | SW); join(f, "iceface", 18, y, E | NE | SE); }   // 앞면 끝 칸도 둔덕 쪽을 이어 둥근 끝의 흰 모서리를 없앤다
  roundFace(rs, f, "iceface", "iceface", ["icecliff"]);                              // 띠 끝 둥근 어깨·발끝(정본, I4 W3)
  rocks.forEach(([x, y], i) => f.up(x, y, `ice_rock${i % 2}`));
  for (const [x, y] of [...lump(4, 1, 8, 3, 1), ...lump(13, 1, 17, 3, 2), ...lump(16, 28, 19, 30, 3), ...lump(4, 28, 6, 30, 4)]) f.lo(x, y, `stall${(x + y) % 2}`);
  f.up(12, 1, "sign_snow"); f.up(10, 29, "sign_snow");
  f.up(19, 25, "snow_pile0"); f.up(5, 25, "frost_bush"); f.up(18, 4, "snow_pile1");
  f.stamp("spine_a", 16, 23); f.stamp("spine_a", 5, 23);
  // 고원 윗면 위 물체(위층): 눈더미·눈 덮인 바위 — 앞면 칸에는 걸치지 않는다(윗면 칸만)
  f.up(6, 8, "snow_pile0"); f.up(16, 8, "snow_pile1"); f.up(8, 20, "snow_pile1"); f.up(17, 20, "snow_pile0");   // 북쪽 테(7·19행)가 아닌 앞면 바로 위 줄(kitlib checkRim)
  f.forest(trees, "sforest_");
  ledgeRow(f, "sledge", 27, 4, 19, [[8, 9]]);
  tallFringe(f, "stall", /^(snow\d|snowpath_)/);
  roundTall(rs, f, /^stall\d$/, "stall", () => "s");                  // 풀숲 바깥 귀를 둥글게(정본, I4 W2) — 덩이는 모두 눈밭 위
  f.save();
  const ice = new Set(ICE.map(key));
  k.describe(f, "얼음 퍼즐 눈길(바다 동굴 얼음방 문법): 얼음 판(ice)을 눈 벼랑(정본 두 그룹을 눈 색으로 — 윗면 icecliff + 남쪽 끝 두 줄 앞면 iceface, 고드름은 앞면 윗입술 덧칠, 돌계단 없음)이 바로 감싸고 드나드는 곳은 남·북 두 칸 폭 틈뿐이다. 얼음 위에서는 벽·바위까지 미끄러지고, 얼음 바위(ice_rock, 위층)가 멈춤 칸이다. 남쪽 틈 → 북쪽 틈·북쪽 틈 → 남쪽 틈 모두 풀린다(바위 9개). 바깥은 눈 숲 벽(sforest_)·눈길·눈 덮인 풀숲·남쪽 눈 턱.");
  k.expectReach(f, [8, 31], [[10, 0]], "남쪽 입구 → 얼음 방 → 북쪽 출구");
  k.expectNoReach(f, [8, 31], [[10, 0], [11, 0]], "얼음 칸을 모두 막으면 북쪽 출구에 못 간다(얼음 말고 길이 없다)", { blocked: ICE });
  k.expectNoReach(f, [8, 31], [[10, 14], [7, 16], [9, 13]], "얼음 한가운데에는 멈출 수 없다(미끄러져 지나간다)");
  k.expectNoReach(f, [8, 31], [[4, 14], [19, 14], [7, 10], [7, 19], [5, 9], [12, 21]], "얼음방 벽·틈 아닌 가장자리는 밟을 수 없다");
  const stops = [...k.reach(f, [8, 31])].filter((s) => ice.has(s)).length;
  k.check(stops >= 6 && stops <= 24, `ice_route: 얼음 위 멈춤 칸 ${stops}개 — 6~24 이어야 퍼즐(너무 적으면 한 번에 건넌다, 양방향 퍼즐은 멈춤이 늘어난다)`);
  const mv = movesTo(f, [14, 19], [[10, 10], [11, 10]]);
  const mvS = movesTo(f, [10, 10], [[14, 19], [15, 19]]);
  k.check(mvS >= 8 && mvS < 999, `ice_route: 북쪽 틈 → 남쪽 틈 최소 ${mvS}수 — 양방향 모두 풀려야 한다(8수 이상)`);
  k.expectReach(f, [10, 0], [[8, 31]], "북쪽 입구 → 얼음 방 → 남쪽 출구(거꾸로도 지나간다)");
  k.check(mv >= 8, `ice_route: 남쪽 틈 → 북쪽 틈 최소 ${mv}수 — 8수 이상이어야 퍼즐`);
  k.notes.push(`ice_route: 얼음 위 멈춤 칸 ${stops}개 / 얼음 ${ICE.length}칸 · 남쪽 틈 → 북쪽 틈 최소 ${mv}수 · 북 → 남 ${mvS}수`);
  k.expectNoReach(f, [10, 2], [[14, 20]], "북쪽에서 내려와도 얼음 방을 거꾸로 지나 남쪽 틈으로 바로 못 나간다", { blocked: [[10, 10], [11, 10]] });
  k.expectReach(f, [12, 26], [[12, 29]], "눈 턱은 남쪽으로 뛰어내린다");
  k.expectNoReach(f, [12, 29], [[12, 26]], "눈 턱은 거꾸로 못 오른다(틈으로 돌아간다)", { blocked: R(8, 25, 9, 31) });
  k.negative(f, "stop-rock-missing", "멈춤 바위 하나(18,16)를 빼면 북쪽 틈 열로 가는 멈춤 자리가 사라져 출구에 못 간다", (g) => { g.map.upperTiles[16 * g.W + 18] = -1; }, [8, 31], [[10, 0]]);
  k.negative(f, "gap-sealed", "북쪽 틈을 눈더미로 막음(얼음방에서 나갈 곳이 없다)", (g) => { g.up(10, 10, "snow_pile0"); g.up(11, 10, "snow_pile1"); }, [8, 31], [[10, 0]]);
}

// ---- 3. 사막(111번 도로) 22×26: 사암 벼랑이 두 층(아래층 앞면 두 칸 + 한 칸 안쪽 둘째 층)으로 양옆을 막고, 모래 골짜기에 2×2 종 모양 바위 무리·
//      선인장, 깊은 모래 얼룩, 개미지옥, 사암 유적 입구(목적지), 풀 띠 두른 오아시스 ----
{
  const W = 22, H = 26;
  const f = k.field("desert", W, H, (x, y) => `dsand${(x * 7 + y * 13 + ((x * y) % 5)) % 4}`);
  const run = (spec: [number, number][]) => { const o: number[] = []; for (const [n, w] of spec) for (let i = 0; i < n; i++) o.push(w); return o; };
  //            행 수, 폭 — 폭이 줄어드는 곳마다 남쪽 앞면(두 칸)이 드러난다. 줄어든 폭은 2행 이상 유지(앞면 아랫단 자리).
  const left = run([[5, 5], [4, 7], [4, 4], [5, 6], [4, 3], [4, 5]]);
  // NE 맨 위 세 줄은 폭 5(서쪽 테 17열): 둘째 층(19~21) 서쪽 테와 아래층 서쪽 테 사이에 걷는 윗면 18열이 한 칸 통째로 남는다 —
  // 폭 4 면 테 두 줄이 붙어 「두 벼랑 사이 갈라진 틈」으로 읽혔다(I4 W2). NW 의 테 4열 | 윗면 3열 | 둘째 층 테 2열과 좌우 대칭.
  const right = run([[3, 5], [5, 6], [4, 4], [5, 7], [4, 4], [5, 5]]);
  // 둘째 층(아래층 윗면 안쪽): 서·북 1칸, 동·남 2칸 여유를 두어 아래층 윗면 띠가 보이고 둘째 층 앞면이 아래층 앞면에 붙지 않게 손으로 정했다
  const lower = new Set<string>(), hi = new Set<string>();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < left[y]; x++) lower.add(`${x},${y}`);
    for (let x = W - right[y]; x < W; x++) lower.add(`${x},${y}`);
  }
  for (const [x0, y0, x1, y1] of [[0, 0, 2, 6], [0, 12, 2, 15], [19, 0, 21, 5], [19, 12, 21, 15]])   // 봉우리 바위가 테에서 한 칸 안쪽에 서도록 윗면을 세 줄 이상(I3 Z3)   // 남쪽 끝 둘째 층은 뺐다 — 앞면 없이 테두리 선으로만 맞닿아 높이 순서가 모호했다(L5 K5)
    for (const [x, y] of R(x0, y0, x1, y1)) hi.add(`${x},${y}`);
  const inLow = (x: number, y: number) => x < 0 || x >= W || y < 0 || y >= H || lower.has(`${x},${y}`);
  for (const c of hi) {                                               // 둘째 층 규칙 검사: 이웃(서·북 1칸, 동 1칸, 남 2칸)이 모두 아래층
    const [x, y] = c.split(",").map(Number);
    for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++)
      if (!inLow(x + dx, y + dy) && !hi.has(`${x + dx},${y + dy}`)) k.check(false, `desert: 둘째 층 칸 (${x},${y}) 이 아래층 가장자리에 너무 붙었다`);
  }
  const hiSet = new Set(hi);
  const lowSplit = plateauSplit(f, new Set([...lower].filter((c) => !hiSet.has(c)).concat([...hi])));
  const hiSplit = plateauSplit(f, hi);
  const hiFace = new Set(hiSplit.face.map(key));
  const faceCells = new Set([...lowSplit.face.map(key), ...hiFace]);
  f.paint("dcliff", lowSplit.top.filter((c) => !hiSet.has(key(c)) && !hiFace.has(key(c))));
  f.paint("dface", lowSplit.face.filter((c) => !hiSet.has(key(c))));
  f.paint("dcliff2", hiSplit.top);
  f.paint("dface2", hiSplit.face);
  // 깊은 모래: 여러 칸 한 장 얼룩 둘(dspatch_a 7×4 · dspatch_b 4×3) — 경계가 칸 격자가 아니라 칸 안 곡선(기울어진 흔들린 타원)
  const patch = (nm: string, x0: number, y0: number, cw: number, ch: number) => { for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) f.lo(x0 + i, y0 + j, `dspatch_${nm}_${i}_${j}`); };
  const pond: Cell[] = R(6, 20, 9, 22);
  const pondSet = new Set(pond.map(key));
  // 풀 띠: 물을 감싼 한 장(dgpatch 8×7, 칸 (4,18) 부터) — 경계가 칸 안 곡선. 물 칸은 oasis 오토타일(바깥 바닥이 같은 풀 그림)
  f.paint("oasis", pond);
  f.shape(["dcliff", "dcliff2"]);
  stairs(f, "dcliff", "dface", "dstairs", 4, 8);                     // 단마다 돌계단 하나(I1 X9): 아래층은 서쪽 앞면(4..5,8..9), 둘째 층은 서북 날개(1..2,6..7)
  stairs(f, "dcliff2", "dface2", "dstairs2", 1, 6);
  faceVary(f, "dface"); faceVary(f, "dface2");
  roundFace(rs, f, "dface", "dface", ["dcliff"]); roundFace(rs, f, "dface2", "dface2", ["dcliff2"]);   // 띠 끝 둥근 어깨·발끝(정본, I4 W3)
  innerFeet(f, "dface", "dface", /^dcliff_at/); innerFeet(f, "dface2", "dface2", /^dcliff2_at/);
  patch("a", 9, 3, 7, 4); patch("b", 6, 15, 4, 3);
  for (let j = 0; j < 7; j++) for (let i = 0; i < 8; i++) {
    const c = `${4 + i},${18 + j}`;
    if (!pondSet.has(c) && !lower.has(c) && !faceCells.has(c)) f.lo(4 + i, 18 + j, `dgpatch_${i}_${j}`);
  }
  // 사암 유적(목적지): 입구 문 하나를 기둥 둘이 지키고 모래 둔덕이 반쯤 묻었다
  f.stamp("ruin_gate", 11, 13); f.stamp("ruin_pillar", 10, 14); f.stamp("ruin_pillar", 14, 14); f.up(9, 16, "ruin_stub");
  // 종 모양 바위는 2~3개씩 무리(모래 위) + 둘째 층 위 봉우리
  for (const [x, y, n] of [[7, 1, "dcone_c"], [9, 2, "dcone_b"], [13, 8, "dcone_b"], [15, 9, "dcone"], [13, 19, "dcone_c"], [15, 20, "dcone_b"]] as [number, number, string][]) f.stamp(n, x, y);
  // 벼랑 위 봉우리: 둘째 층 윗면 칸(2×2 가 모두 둘째 층이고 앞면 칸이 아닌 곳)에만
  const hiTop = (x: number, y: number) => hi.has(`${x},${y}`) && hi.has(`${x},${y + 1}`) && hi.has(`${x},${y + 2}`);
  const peaks: Cell[] = [];
  for (const [x, y, n] of [[0, 0, "dcone"], [0, 3, "dcone_c"], [20, 3, "dcone_b"], [0, 13, "dcone_c"], [20, 13, "dcone"]] as [number, number, string][])   // 테 칸(서·동·북 가장자리)에 걸치지 않는 자리 — kitlib checkRim
    if (hiTop(x, y) && hiTop(x + 1, y)) { f.stamp(n, x, y); peaks.push([x, y]); }
  k.check(peaks.length >= 3, `desert: 벼랑 위 봉우리 ${peaks.length}개 — 둘째 층 윗면에 3개 이상`);
  f.stamp("sandpit", 14, 1);
  f.up(6, 12, "cactus"); f.up(13, 21, "cactus"); f.stamp("cactus_tall", 10, 7); f.stamp("cactus_tall", 15, 22);
  f.up(16, 18, "dbush"); f.up(6, 24, "dbush"); f.up(12, 19, "dbones");
  f.stamp("palm_a", 6, 17); f.stamp("palm_a", 10, 18); f.stamp("palm_a", 4, 19);
  ledgeRow(f, "dledge", 11, left[11], W - right[11] - 1, [[10, 11]]);
  overlapCheck(f, ["dcliff", "dcliff2", "dface", "dface2"], new Set(peaks.flatMap(([x, y]) => [key([x, y]), key([x + 1, y]), key([x, y + 1]), key([x + 1, y + 1])])));
  f.save();
  k.describe(f, "사막 골짜기(111번 도로 문법): 걷는 땅은 모래(dsand 바탕). 양옆 사암 벼랑은 정본 두 그룹(야생 cliffg·gface 와 같은 함수, 색만 사암) — 윗면 dcliff(걷는 단, 북·동·서 테로는 못 나간다) + 남쪽 끝 두 줄 앞면 dface(막힘, 가운데 칸은 덩이 변형을 열 해시로 섞는다). 앞면을 끊은 2×2 돌계단 dstairs 만 오르는 길. 아래층 윗면 한 칸 안쪽에 둘째 층 dcliff2·dface2·dstairs2. 막는 소품은 2×2 바위 무더기 dcone·dcone_c 와 낮은 둥근 바위 dcone_b 를 섞어 2~3개씩 무리 짓고(같은 그림 줄짓기 금지), 벼랑 위 봉우리도 같은 바위. 목적지는 사암 유적 입구 ruin_gate(입구 칸에 이동 이벤트). 오아시스는 풀 띠 한 장(dgpatch)을 두른 물(oasis), 깊은 모래(여러 칸 얼룩 dspatch_a·dspatch_b, 또는 오토타일 deepsand)·개미지옥(sandpit)은 걸을 수 있는 이벤트 자리.");
  k.expectReach(f, [10, 25], [[10, 0], [12, 15], [10, 22]], "남쪽 입구 → 북쪽 출구·유적 입구·오아시스 물가");
  k.expectNoReach(f, [10, 25], [[8, 21]], "오아시스 물에는 들어갈 수 없다");
  k.expectReach(f, [10, 25], [[4, 6], [2, 10], [0, 2]], "돌계단으로 벼랑 윗면·둘째 층 윗면에 오른다");
  k.expectNoReach(f, [10, 25], [[4, 6], [0, 2], [20, 10]], "돌계단이 아니면 벼랑 위로 못 오른다(앞면·테는 막힘)", { blocked: [...R(4, 8, 5, 9), ...R(1, 6, 2, 7)] });
  k.expectNoReach(f, [10, 25], [[20, 10]], "동쪽 벼랑은 계단이 없어 오를 수 없다");
  k.expectNoReach(f, [10, 13], [[13, 10]], "모래 언덕 턱은 거꾸로 못 오른다(틈으로 돌아간다)", { blocked: R(10, 11, 11, 11) });
  k.negative(f, "ruin-buried", "유적 입구 앞 칸을 바위로 막음(목적지에 못 감)", (g) => g.stamp("dcone", 12, 16), [10, 25], [[12, 15]]);
  k.negative(f, "ledge-no-gap", "모래 언덕 턱에 틈을 두지 않음(남쪽에서 북쪽 출구로 못 돌아간다)", (g) => { g.lo(10, 11, "dledge_s_mid"); g.lo(11, 11, "dledge_s_mid1"); }, [10, 25], [[10, 0]]);
}

// ---- 4. 화산재 마을 26×23(꽃잎마을 + 용암마을 온천): 북쪽은 화산 바위 벼랑(두 칸 앞면 + 둘째 층)이 마을을 감싸며 양옆으로 내려오고,
//      가운데 틈으로 북쪽 출구. 온천(돌 고리·김)과 모래찜질 터, 재 덮인 지붕의 센터·집 두 채, 동쪽은 113번 도로로 이어지는 재 덮인 풀숲 ----
{
  const W = 26, H = 23;
  const f = k.field("ash_town", W, H, (x, y) => `ash${(x * 7 + y * 13 + ((x * y) % 5)) % 4}`);
  const lower = new Set<string>(), hi = new Set<string>();
  for (const [x, y] of [...R(0, 0, 11, 3), ...R(14, 0, 25, 3), ...R(0, 4, 3, 7), ...R(22, 4, 25, 7)]) lower.add(`${x},${y}`);
  // 둘째 층은 양 날개에만(가운데 북쪽 벼랑은 한 층 — 앞면 띠가 세 겹으로 겹치지 않게)
  for (const [x, y] of [...R(0, 0, 2, 4), ...R(23, 0, 25, 4)]) hi.add(`${x},${y}`);   // 앞면 두 칸(4·5행) 밑에 아래층 윗면 한 줄(6행)이 남게
  const inLowA = (x: number, y: number) => x < 0 || x >= W || y < 0 || lower.has(`${x},${y}`);
  for (const c of hi) {                                               // 둘째 층 규칙 검사(사막과 같다): 서·북·동 1칸, 남 2칸이 아래층
    const [x, y] = c.split(",").map(Number);
    for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++)
      if (!inLowA(x + dx, y + dy) && !hi.has(`${x + dx},${y + dy}`)) k.check(false, `ash_town: 둘째 층 칸 (${x},${y}) 이 아래층 가장자리에 너무 붙었다`);
  }
  const hiSetA = new Set(hi);
  const lowA = plateauSplit(f, lower);
  const hiA = plateauSplit(f, hi);
  const hiFaceA = new Set(hiA.face.map(key));
  f.paint("vcliff", lowA.top.filter((c) => !hiSetA.has(key(c)) && !hiFaceA.has(key(c))));
  f.paint("vface", lowA.face.filter((c) => !hiSetA.has(key(c))));
  f.paint("vcliff2", hiA.top);
  f.paint("vface2", hiA.face);
  const trees = new Set<string>();
  for (let j = 5; j <= 11; j++) { trees.add(`0,${j}`); if (j !== 6 && j !== 7) trees.add(`12,${j}`); }   // 동쪽 숲 틈 행 12~15(수관 넘침이 길 아랫줄을 덮지 않게)
  for (let i = 0; i <= 12; i++) if (i !== 6) trees.add(`${i},11`);
  const road: Cell[] = [...R(12, 0, 13, 22), ...R(5, 12, 25, 13), ...R(2, 20, 11, 20)];   // 가로길 서쪽 끝은 모래찜질 터 앞(5,12)에서 끝난다
  f.paint("ashpath", road);
  f.paint("spring", R(4, 6, 8, 9));
  f.paint("sandbath", R(4, 10, 8, 11));                               // 둥근 5×2 덩이(꼬리 없음)
  f.shape(["vcliff", "vcliff2", "spring"]);
  stairs(f, "vcliff", "vface", "vstairs", 8, 3);                     // 단마다 돌계단 하나(I1 X9): 북쪽 벼랑(8..9,3..4), 서쪽 날개 둘째 층(1..2,4..5)
  stairs(f, "vcliff2", "vface2", "vstairs2", 1, 4);
  faceVary(f, "vface"); faceVary(f, "vface2");
  roundFace(rs, f, "vface", "vface", ["vcliff"]); roundFace(rs, f, "vface2", "vface2", ["vcliff2"]);   // 띠 끝 둥근 어깨·발끝(정본, I4 W3)
  innerFeet(f, "vface", "vface", /^vcliff_at/); innerFeet(f, "vface2", "vface2", /^vcliff2_at/);
  // 봉우리: 2×2 가 윗면이고 그 아래 한 칸도 같은 층 윗면인 곳에만(앞면 칸에 걸치지 않게 — 사막 hiTop 과 같은 검사)
  const topOf = (set: Set<string>, x: number, y: number) => [0, 1].every((dx) => [0, 1, 2].every((dy) => set.has(`${x + dx},${y + dy}`)));
  const vpeaks: Cell[] = [];
  for (const [x, y, layer, nm] of [[0, 0, "hi", "vcone"], [5, 0, "lo", "vcone_c"], [17, 0, "lo", "vcone"], [24, 2, "hi", "vcone_c"]] as [number, number, string, string][]) {
    const ok = layer === "hi" ? topOf(hi, x, y) : topOf(lower, x, y) && ![0, 1].some((dx) => [0, 1, 2].some((dy) => hi.has(`${x + dx},${y + dy}`)));
    k.check(ok, `ash_town: 봉우리 (${x},${y}) 가 앞면 칸에 걸친다`);
    if (ok) { f.stamp(nm, x, y); vpeaks.push([x, y]); }
  }
  for (const [x, y, v] of [[5, 6, 0], [7, 6, 1], [6, 8, 1]]   /* 김 가닥은 물 위쪽 줄(돌 고리 앞)에서 솟는다 */ as [number, number, number][]) f.up(x, y, `steam${v}`);
  f.up(5, 10, "sand_mound"); f.up(7, 10, "sand_mound");
  f.stamp("center_ash", 15, 9);                                       // 센터 4×4 — 문은 12행, 문 바로 아래 13행은 가로길
  f.stamp("house_ash_a", 2, 16); f.stamp("house_ash_b", 8, 16);       // 민가 4×4 — 문 앞 칸이 바로 집 앞 길(20행)
  f.stamp("atree_a", 9, 6);   // 2×4 그루(야생 forest_o 와 같은 키). 센터 동쪽 그루는 2×4 가 되며 벼랑 앞면에 걸쳐 뺐다
  for (const [x, y] of lump(15, 15, 20, 17, 2)) f.lo(x, y, `atall${(x + y) % 2}`);
  f.up(10, 10, "sign"); f.up(14, 14, "sign_metal"); f.up(7, 19, "mailbox");
  f.stamp("steam_vent", 11, 9); f.up(22, 15, "lava_rock0"); f.up(21, 14, "lava_rock1"); f.up(23, 15, "ash_pile0"); f.up(23, 18, "ash_pile1"); f.up(16, 20, "ash_pile0"); f.up(19, 5, "lava_rock1");   // 분기공·재 더미는 숲 수관 앞에 겹치지 않게 순수 재 바닥으로(L6 K4)
  f.up(20, 20, "ash_pile1"); f.stamp("steam_vent", 14, 18); f.stamp("atree_a", 21, 16);
  f.stamp("atree_a", 20, 6); f.stamp("atree_a", 14, 5); f.up(21, 10, "sign");   // 벼랑 아래 나무 무리와 센터 옆 길가 표지판 — 문과 가로길은 비운다
  overlapCheck(f, ["vcliff", "vcliff2", "vface", "vface2"], new Set(vpeaks.flatMap(([x, y]) => [key([x, y]), key([x + 1, y]), key([x, y + 1]), key([x + 1, y + 1])])));
  f.forest(trees, "aforest_");
  tallFringe(f, "atall", /^(ash\d|ashpath_)/);
  roundTall(rs, f, /^atall\d$/, "atall", () => "a");                  // 풀숲 바깥 귀를 둥글게(정본, I4 W2)
  f.save();
  const doorA = k.obj("house_ash_a").entrance, doorB = k.obj("house_ash_b").entrance;
  const dA: Cell = [2 + doorA.dx, 16 + doorA.dy], dB: Cell = [8 + doorB.dx, 16 + doorB.dy];
  const doorC = k.obj("center_ash").entrance, dC: Cell = [15 + doorC.dx, 9 + doorC.dy];
  k.describe(f, "화산재 마을(꽃잎마을·용암마을 문법): 걷는 땅은 재 덮인 풀(ash), 마을 길은 다져진 흙길(ashpath). 북쪽 화산 바위 벼랑은 정본 두 그룹(윗면 vcliff + 앞면 두 줄 vface, 야생 절벽 함수를 화산 색으로)이고 양옆으로 내려와 마을을 감싼다 — 앞면을 끊은 돌계단 vstairs 만 오르는 길, 둘째 층 vcliff2·vface2·vstairs2 는 양 날개에만, 바위 무더기 봉우리 vcone·vcone_c(두 변형 섞기)는 같은 층 윗면 2×3 안에만. 출구는 벼랑 틈(북)·숲 틈(남·동). 온천 spring 은 돌 고리 물, 김은 위층 steam(가는 세로 아지랑이)을 물 위쪽 줄에 띄엄띄엄. 온천 옆 모래찜질 터 sandbath(재 바닥보다 한 단 밝은 따뜻한 모래, 사람 둔덕 sand_mound). 지붕은 탁한 램프 + 재(roof_ash_*).");
  k.expectReach(f, [12, 22], [[12, 0], dC, dA, dB, [25, 12], [6, 11]], "남쪽 입구 → 북쪽 벼랑 틈·센터·집 두 채 문·동쪽 113번 도로·모래찜질 터");
  k.expectNoReach(f, [12, 22], [[6, 7], [5, 10]], "온천 물·모래찜질 하는 사람 칸에는 걸어 들어갈 수 없다");
  k.expectReach(f, [12, 22], [[10, 1], [1, 6], [2, 1]], "돌계단으로 벼랑 윗면·서쪽 날개 둘째 층 윗면에 오른다");
  k.expectNoReach(f, [12, 22], [[10, 1], [1, 6], [2, 1]], "돌계단이 아니면 벼랑 위로 못 오른다", { blocked: [...R(8, 3, 9, 4), ...R(1, 4, 2, 5)] });
  k.check(Math.abs(dA[0] - dB[0]) >= 4, "ash_town: 두 집 사이를 한 칸 이상 띄운다");
  k.negative(f, "gap-blocked", "북쪽 벼랑 틈을 용암석으로 막음(북쪽 출구에 못 감)", (g) => { g.up(12, 2, "lava_rock0"); g.up(13, 2, "lava_rock1"); }, [12, 22], [[12, 0]]);
  k.negative(f, "door-blocked", "집 문 앞 칸에 재 더미를 놓음", (g) => g.up(dA[0], dA[1] + 1, "ash_pile0"), [12, 22], [dA]);
}

k.done();
