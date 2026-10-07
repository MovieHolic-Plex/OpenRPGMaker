/** 야생 시트 쇼케이스·검사 — 숲 미로·산 절벽 도로·늪지·꽃 정원·강과 다리. bash cycle_theme.sh monster-wild <run>
 *  맵마다 「입구 → 목적지」 도달과 「장치(계단·다리·턱) 없이는 안 된다」를 엔진 canMove·턱·미끄럼으로 증명한다. */
import { Kit, Field, type Cell } from "./kitlib.mts";
import { shadeAutotileInterior } from "../../../project/defaults/autotileEngine";
import { canMove } from "../../../project/collision";
import { N, E, S, W, NE, SE, SW, NW, canon, kitSheet, roundFace, roundTall } from "./wild_round.mts";   // 정본 둥근 띠 끝·풀숲 귀 배치(I4 W2·W3)
const k = new Kit(process.argv[2]);
const rs = kitSheet(k);

/** 오토타일 칸 하나를 「그쪽은 이어졌다」로 바꾼다 — 계단·동굴 입구·폭포처럼 그룹 밖 칸으로 드나드는 자리. */
function join(f: Field, grp: string, x: number, y: number, bits: number) {
  const g = k.g(grp); const t = f.map.lowerTiles[y * f.W + x];
  const raw = Object.keys(g.variantMap).find((m) => g.variantMap[m] === t);
  if (raw === undefined) throw new Error(`${f.name} (${x},${y}) 는 ${grp} 칸이 아니다`);
  f.map.lowerTiles[y * f.W + x] = g.variantMap[String(canon(canon(Number(raw)) | bits))];
}
/** 맵 가장자리에 닿은 오토타일 칸은 맵 밖으로 이어진 것으로 본다(가장자리 테두리 선이 생기지 않게). */
function joinBorder(f: Field, grp: string) {
  const own = new Set<number>(k.g(grp).memberTileIds);
  for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
    if (!own.has(f.map.lowerTiles[y * f.W + x])) continue;
    let b = 0;
    if (x === 0) b |= W | NW | SW; if (x === f.W - 1) b |= E | NE | SE;
    if (y === 0) b |= N | NE | NW; if (y === f.H - 1) b |= S | SE | SW;
    if (b) join(f, grp, x, y, b);
  }
}
/** 오토타일 칸 하나의 마스크를 고친다(fn: 원래 마스크 → 새 마스크). */
function remask(f: Field, grp: string, x: number, y: number, fn: (m: number) => number) {
  const g = k.g(grp); const t = f.map.lowerTiles[y * f.W + x];
  const raw = Object.keys(g.variantMap).find((m) => g.variantMap[m] === t);
  if (raw === undefined) throw new Error(`${f.name} (${x},${y}) 는 ${grp} 칸이 아니다`);
  f.map.lowerTiles[y * f.W + x] = g.variantMap[String(canon(canon(fn(canon(Number(raw))))))];
}
/** 앞면 가운데 칸(윗칸 110·아랫칸 155)을 덩이 변형 다섯 벌로 섞는다 — 칸 좌우 끝 덩이는 변형마다 같아 옆으로는 어떻게 섞어도 이어지고,
 *  윗칸·아랫칸은 같은 번호를 써서 칸 경계를 넘는 덩이가 이어진다. 변형 수는 wild_mountain.FACE_VARS(+기본 칸). */
function faceVary(f: Field, grp: string) {
  const g = k.g(grp); const pre = grp === "cface" ? "cface_at" : "gface_at";
  const h = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
  for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
    const t = f.map.lowerTiles[y * f.W + x];
    const raw = Object.keys(g.variantMap).find((m) => g.variantMap[m] === t); if (raw === undefined) continue;
    const m = canon(Number(raw));                      // 옆이 이어진 윗칸·아랫칸이면 대각 비트(구석 2px 점)와 상관없이 섞는다
    const tier = (m & (E | W)) !== (E | W) ? -1 : !(m & N) && m & S ? 0 : m & N && !(m & S) ? 1 : -1; if (tier < 0) continue;
    const v = h(x + 3, y - tier) % 5; if (v) f.lo(x, y, `${pre}in${tier}_${v - 1}`);   // 한 열의 윗칸·아랫칸은 같은 변형(칸 경계를 넘는 덩이가 이어진다, QA-L8 M17)
  }
}
/** 야생 숲(wild_common.woods_pieces): 그루마다 이웃 4비트(위 1·아래 2·왼 4·오 8) 조각을 찍고, 위에 그루가 없으면
 *  위 칸에 수관 머리(위층, 걸을 수 있다)를 얹는다. 맵 밖은 그루가 있는 것으로 본다. */
function woods(f: Field, trees: Set<string>, pre: string) {
  const gw = Math.ceil(f.W / 2), gh = Math.ceil(f.H / 2);
  const has = (i: number, j: number) => (i < 0 || j < 0 || i >= gw || j >= gh ? true : trees.has(`${i},${j}`));
  for (const t of trees) {
    const [i, j] = t.split(",").map(Number);
    const code = (has(i, j - 1) ? 1 : 0) | (has(i, j + 1) ? 2 : 0) | (has(i - 1, j) ? 4 : 0) | (has(i + 1, j) ? 8 : 0);
    f.stamp(`${pre}${code.toString(16)}`, 2 * i, 2 * j);
    if (!has(i, j - 1)) { f.up(2 * i, 2 * j - 1, `${pre}cap0`); f.up(2 * i + 1, 2 * j - 1, `${pre}cap1`); }
  }
}
/** 숲 벽(9조각 + 외줄 조각). kitlib Field.forest 와 같은 규칙인데, 한 그루 폭 세로줄·한 그루 높이 가로줄·외톨이 그루는
 *  외줄 조각(v*·s*·o)으로 찍는다 — 9조각만으로는 외줄의 바깥 수관이 잘려 보인다. */
function forest(f: Field, trees: Set<string>, prefix = "forest_") {
  const gw = Math.ceil(f.W / 2), gh = Math.ceil(f.H / 2);
  const has = (i: number, j: number): boolean => {
    if (i < 0 || i >= gw) return true;
    if (j < 0) return has(i, 0);
    if (j >= gh) return has(i, gh - 1);
    return trees.has(`${i},${j}`);
  };
  const list = [...trees].map((t) => t.split(",").map(Number)).sort((a, b) => a[1] - b[1]);
  for (const [i, j] of list) {
    const up = has(i, j - 1), dn = has(i, j + 1), lf = has(i - 1, j), rt = has(i + 1, j);
    let name: string, y0: number;
    if (!lf && !rt) {
      if (!up && !dn) { name = "o"; y0 = 2 * j - 1; } else if (!up) { name = "vt"; y0 = 2 * j - 1; } else if (!dn) { name = "vb"; y0 = 2 * j; } else { name = "vc"; y0 = 2 * j; }
    } else if (!up && !dn) { name = "s" + (!lf ? "l" : !rt ? "r" : "c"); y0 = 2 * j - 1; }
    else {
      const rk = !up ? "t" : !dn ? "b" : ""; const ck = !lf ? "l" : !rt ? "r" : "";
      name = rk + ck || "c"; y0 = 2 * j - (rk === "t" ? 1 : 0);
    }
    f.stamp(prefix + name, 2 * i, y0);
  }
}
/** 바닥 소품(하층 낱칸: 꽃·버섯·자갈)을 놓는다 — 그 칸이 이미 물체(그루·바위·덤불)가 차지한 칸이면 실패(소품이 수관을 지우지 않게). */
function prop(f: Field, x: number, y: number, n: string) {
  const had = f.occ.get(`${x},${y}`);
  k.check(!had, `${f.name}: 소품 ${n} 이 (${x},${y}) 의 물체 ${had} 를 지운다`);
  f.lo(x, y, n);
}
/** 키 큰 풀 덩이 둘레 잎끝(본 시트 문법, QA-L6 N4): 풀숲 칸(tallRe)의 남·동·서 이웃 바닥 칸(ground) 위층에 잎끝 <pre>tall_fringe_{s,e,w} 를 얹는다.
 *  위층이 이미 찬 칸(수관 머리·울타리·물체)과 물체 칸은 건너뛴다. 남쪽을 먼저 본다(한 칸에 잎끝 하나). 맵을 다 깐 뒤 save 직전에 부른다. */
function fringeTall(f: Field, tallRe: RegExp, ground: (x: number, y: number) => boolean, pre = "") {
  const isTall = (x: number, y: number) => f.in(x, y) && tallRe.test(f.at(x, y));
  const done = new Set<string>();
  for (const [dx, dy, sd] of [[0, 1, "s"], [1, 0, "e"], [-1, 0, "w"]] as [number, number, string][])
    for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
      if (!isTall(x, y)) continue;
      const X = x + dx, Y = y + dy, key = `${X},${Y}`;
      if (!f.in(X, Y) || isTall(X, Y) || done.has(key) || f.map.upperTiles[Y * f.W + X] !== -1 || f.occ.has(key) || !ground(X, Y)) continue;
      done.add(key); f.up(X, Y, `${pre}tall_fringe_${sd}`);
    }
  // 검사(QA-L7 N4b): 풀숲에서 걸어 나갈 수 있는 남·동·서 이웃 칸(엔진 canMove)은 잎끝이 있거나 위층이 이미 찬 칸이어야 한다 —
  // 이웃 바닥 판정(ground)이 그 맵의 걷는 땅을 빠뜨리면(윗단 풀 윗면 등) 여기서 걸린다.
  const project: any = { tilesets: { t: k.ts } }, map = { ...f.map, tilesetId: "t" };
  for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
    if (!isTall(x, y)) continue;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0]]) {
      const X = x + dx, Y = y + dy;
      if (!f.in(X, Y) || isTall(X, Y) || f.map.upperTiles[Y * f.W + X] !== -1 || !canMove(project, map as any, x, y, X, Y)) continue;
      k.check(false, `${f.name}: 풀숲 (${x},${y}) 옆 걷는 칸 (${X},${Y}) ${f.at(X, Y)} 에 잎끝이 없다`);
    }
  }
}
const set = (cells: Iterable<Cell>) => new Set([...cells].map(([x, y]) => `${x},${y}`));
/** 그루 격자 문자열(# = 2×2 그루) → 그루 집합. */
const groves = (rows: string[]) => { const s = new Set<string>(); rows.forEach((r, j) => [...r].forEach((c, i) => { if (c === "#") s.add(`${i},${j}`); })); return s; };
const fenceRect = (f: Field, x0: number, y0: number, x1: number, y1: number, gaps: Cell[] = []) => {
  const gap = set(gaps);
  const on = (x: number, y: number) => (x === x0 || x === x1 || y === y0 || y === y1) && x >= x0 && x <= x1 && y >= y0 && y <= y1 && !gap.has(`${x},${y}`);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (on(x, y))
    f.up(x, y, `fence_at${(on(x, y - 1) ? 1 : 0) | (on(x + 1, y) ? 2 : 0) | (on(x, y + 1) ? 4 : 0) | (on(x - 1, y) ? 8 : 0)}`);
};
const blob = (cx: number, cy: number, rx: number, ry: number, seed: number, amp = 1) => {
  const out: Cell[] = [];
  for (let y = Math.floor(cy - ry * 1.5 - 1); y <= cy + ry * 1.5 + 1; y++) for (let x = Math.floor(cx - rx * 1.5 - 1); x <= cx + rx * 1.5 + 1; x++) {
    const a = Math.atan2(y - cy, x - cx); const q = 1 + amp * (0.16 * Math.sin(a * 3 + seed) + 0.08 * Math.sin(a * 5 + seed * 2) + (amp > 1 ? 0.06 * Math.sin(a * 7 + seed * 3) : 0));
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= q * q) out.push([x, y]);
  }
  return out;
};
const ledgeRow = (f: Field, pre: string, y: number, x0: number, x1: number) => {
  for (let x = x0; x <= x1; x++) f.lo(x, y, x === x0 ? `${pre}_l` : x === x1 ? `${pre}_r` : x % 2 ? `${pre}_mid` : `${pre}_mid1`);
};

// ---- 1. 숲 미로(상록숲·등화숲) 30×32 — 그루 격자 15×16(그루 = 2×2 칸, 막는 칸은 모두 잎·줄기). 세로 통로 2칸, 가로 통로 2~4칸.
//      큰길: 남쪽 입구 → 오른쪽으로 올라가 → 위 띠를 서쪽으로 → 북쪽 출구. 왼쪽 갈래(막다른 곳·가운데 빛 공터)는
//      위 띠에서 흙 턱으로 뛰어내려 들어가고, 오른쪽 문으로 다시 나온다. 흙길은 큰길을 따라, 흰 꽃·버섯은 막다른 곳에.
{
  const f = k.field("forest_maze", 30, 32, (x, y) => `wfl${(x * 7 + y * 13 + ((x * y) % 5)) % 4}`);
  const G = [
    "#######.#######",
    "#.....#.......#",
    "#.....#.......#",
    "#.###.##.######",
    "#.#...........#",
    "#.#...........#",
    "#.#.#########.#",
    "#...#.....#...#",
    "#...#.....#...#",
    "#.###.....#.###",
    "#.....####....#",
    "#.....####....#",
    "#####.#####.###",
    "#.....#.......#",
    "#.....#.......#",
    "#######.#######",
  ];
  const trees = groves(G);
  const open = (x: number, y: number) => !trees.has(`${x >> 1},${y >> 1}`);
  // 흙길: 입구에서 큰길을 따라(입구 띠 → 오른쪽 세로 통로 아래), 위 띠의 출구 앞
  const dirt = [...k.rect(14, 28, 15, 31), ...k.rect(14, 0, 15, 2), [13, 1], [13, 2]].filter(([x, y]) => open(x, y)) as Cell[];
  f.paint("wdirt", dirt);
  f.paint("wsun", blob(14.5, 16.6, 3.8, 1.7, 1).filter(([x, y]) => open(x, y)));
  f.shape();
  joinBorder(f, "wdirt");   // 출입구 흙길은 맵 밖으로 이어진다 — 맵 끝에 마감 테를 긋지 않는다(QA-L5 F8)
  {                         // 맵 안쪽 길 끝 칸(바깥 귀가 둘 다 열린 칸)은 둥근 끝 — 네모로 뚝 끊기지 않게(I3 Z4)
    const g = k.g("wdirt"), ends = [S | E | SE, S | W | SW, N | E | NE, N | W | NW, S, N];
    for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
      const raw = Object.keys(g.variantMap).find((m) => g.variantMap[m] === f.map.lowerTiles[y * f.W + x]); if (raw === undefined) continue;
      const m = canon(Number(raw)); if (ends.includes(m)) f.lo(x, y, `wdirt_end${m}`);
    }
  }
  // 키 큰 풀 덩이: 모서리를 깎은 덩이(통로를 끝까지 막는다)
  const tall = (x0: number, y0: number, x1: number, y1: number, cut: Cell[] = [], corners = true) => {   // corners=false: 네 귀를 다 깎지 않고 cut 만(덩이마다 윤곽이 다르게)
    const skip = set([[x0, y0], [x1, y0], [x0, y1], [x1, y1]].filter(() => corners && x1 - x0 >= 3).concat(cut) as Cell[]);
    for (const [x, y] of k.rect(x0, y0, x1, y1)) if (open(x, y) && !skip.has(`${x},${y}`)) f.lo(x, y, `wtall${(x + y) % 2}`);
  };
  // 풀 덩이는 수관 머리 줄(다음 그루 바로 위 줄) 앞에서 끝난다 — 수관 뒤로 숨지 않게
  tall(18, 27, 21, 28);           // 입구 띠: 동쪽으로 가려면 지나야 한다
  tall(20, 20, 25, 22, [[20, 20], [21, 20], [25, 22]], false);   // 비스듬한 띠
  tall(24, 14, 27, 16, [[27, 14]]);
  tall(9, 8, 15, 10, [[9, 8], [10, 8], [15, 8], [15, 9], [9, 10]], false);   // 혹 덩이 tall(20, 8, 23, 10);
  tall(17, 2, 24, 4, [[17, 2], [18, 2], [24, 4], [23, 4]], false);   // 기운 띠
  tall(3, 14, 8, 16, [[3, 14], [8, 16], [7, 16], [3, 16]], false);   // 혹 덩이
  tall(2, 20, 7, 22, [[2, 20], [7, 20], [7, 21]], false);   // 아래로 처진 덩이
  tall(3, 2, 9, 4, [[3, 2], [3, 3], [9, 4], [8, 4]], false);   // 반대로 기운 띠 tall(5, 26, 10, 28, [[5, 26], [10, 26], [10, 27], [5, 28]], false);   // ㄱ 자
  woods(f, trees, "wood_");
  // 소품: 통로 가장자리·막다른 곳(풀 덩이 밖)
  f.up(13, 17, "stump"); f.up(17, 17, "stump"); f.stamp("flog", 11, 18);
  for (const [x, y, v] of [[19, 15, 2], [10, 14, 0], [2, 26, 1], [11, 28, 4], [23, 19, 5], [2, 4, 3], [11, 5, 4], [27, 10, 2], [6, 12, 5]] as [number, number, number][]) prop(f, x, y, `mush${v}`);
  for (const [x, y, v] of [[3, 28, 2], [4, 27, 0], [2, 21, 1], [27, 2, 2], [27, 3, 0], [10, 19, 1], [12, 14, 0]] as [number, number, number][]) prop(f, x, y, `wflower${v}`);
  f.up(16, 27, "sign");
  f.up(3, 29, "cuttree");          // 막다른 곳의 작은 나무(자르기 자리)
  for (let x = 2; x <= 3; x++) f.lo(x, 9, x === 2 ? "wledge_s_mid1" : "wledge_s_mid");   // 벽에서 벽까지 닿는 턱 — 끝이 깎이면 두 나무 사이 떠 있는 가지로 읽혔다(QA-L6 F9)
  fringeTall(f, /^wtall\d$/, (x, y) => /^(wfl\d|wsun_at|wdirt_at|mush\d|wflower\d)/.test(f.at(x, y)), "w");   // 풀숲 둘레 잎끝(숲 풀 램프)
  roundTall(rs, f, /^wtall\d$/, "wtall", () => "w");
  f.save();
  k.describe(f, "숲 미로: 2×2 그루가 빈틈없이 맞물린 숲벽 사이로 2~4칸 통로가 꺾인다. 통로의 넓은 구간은 키 큰 풀 덩이가 끝까지 막고(조우를 피할 수 없다), 왼쪽 갈래는 흙 턱으로 뛰어내려 들어가 오른쪽 문으로 나온다. 흙길은 큰길, 흰 꽃·버섯·작은 나무는 막다른 곳.");
  k.expectReach(f, [14, 31], [[14, 0]], "입구(남) → 출구(북), 오른쪽으로 돌아 올라가 위 띠를 서쪽으로");
  k.expectReach(f, [14, 31], [[14, 16]], "입구 → 가운데 빛 공터");
  k.expectReach(f, [2, 6], [[2, 12], [2, 27]], "위 띠 → 턱을 뛰어내려 왼쪽 갈래(막다른 곳까지)");
  k.expectNoReach(f, [2, 12], [[2, 6]], "턱 아래에서 위로는 못 오른다(다른 문을 막으면)", { blocked: [[6, 12], [7, 12], [6, 13], [7, 13], [10, 6], [11, 6], [10, 7], [11, 7]] });
  k.expectNoReach(f, [14, 31], [[14, 0]], "위 띠로 오르는 문 하나를 막으면 출구에 못 간다 — 미로의 큰길은 하나", { blocked: [[16, 6], [17, 6], [16, 7], [17, 7]] });
  k.negative(f, "grove-plug", "위 띠로 오르는 2칸 문에 그루 하나를 더 심으면 큰길이 끊겨 출구에 못 간다", (g) => g.stamp("wood_f", 16, 6), [14, 31], [[14, 0]]);
}

// ---- 2. 산·절벽 도로(111·113·114번 도로 산길) 22×17 — 남쪽 아랫길(단 0)에서 겹겹이 쌓인 고원 띠를 계단으로 올라 북쪽으로 나간다.
//      단 1·단 2·단 3 은 모두 맵을 가로지르는 띠: 남쪽 앞면 두 줄이 네 겹으로 쌓이고 양 끝은 사선 등고선으로 맵 끝까지 물러난다.
//      꼭대기(단 3)는 맵 위 끝까지 — 뒤 경계는 맵 밖이라 세로 옆테·선 상자가 없다. 꼭대기 윗면은 한 단 밝은 돌흙(아랫단과 다른 칸).
//      띠 깊이: 꼭대기 3줄(출구로 가는 길 폭 — 빈 광장이 남지 않게 맵을 줄였다, QA-L5 M11) · 단 2 네 줄(풀숲 조우) · 단 1 두 줄 · 아랫길 두 줄.
//      길: 남쪽 입구 → 단 1(가운데 계단) → 동쪽 계단 → 단 2 풀숲 → 꼭대기 계단 → 북쪽 출구. 꼭대기 앞면에 동굴(단 2 에서 든다).
{
  const W_ = 22, H_ = 17;
  const f = k.field("mountain", W_, H_, (x, y) => `mfl${(x * 7 + y * 13 + ((x * y) % 5)) % 4}`);
  // 꼭대기(단 3)도 맵을 가로지르는 띠 — 뒤 경계는 맵 밖, 양 끝은 사선 앞면이 맵 끝까지 내려가 세로 옆테가 없다(QA-L4 M9)
  const T3 = 0, B3: Record<number, number> = {}; for (let x = 0; x < 22; x++) B3[x] = Math.min(2, x, 21 - x);   // 꼭대기 마지막 줄(양 끝 사선)
  const B2 = [5, 6, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 7, 6, 5];   // 단 2 마지막 줄(양 끝 사선)
  const B1 = [9, 10, 11, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 11, 10, 9];   // 단 1 마지막 줄
  /** 칸의 높이: 3·2·1·0 단, -1 = 앞면(위 단의 남쪽 끝 바로 아래 두 줄). */
  const lv = (x: number, y: number) => {
    const b3 = B3[x];
    if (b3 !== undefined && y >= T3) { if (y <= b3) return 3; if (y <= b3 + 2) return -1; }
    if (y <= B2[x]) return 2; if (y <= B2[x] + 2) return -1;
    if (y <= B1[x]) return 1; if (y <= B1[x] + 2) return -1;
    return 0;
  };
  for (let x = 0; x < W_; x++) k.check(B1[x] >= B2[x] + 3 && (B3[x] === undefined || B2[x] >= B3[x] + 3), `mountain: 열 ${x} 의 단이 앞면 두 줄을 품을 만큼 떨어져 있지 않다`);
  const at = (h: number) => { const out: Cell[] = []; for (let y = 0; y < H_; y++) for (let x = 0; x < W_; x++) if (lv(x, y) === h) out.push([x, y]); return out; };
  // 꼭대기 둔덕(단 3)만 cliff_a — 윗면이 한 단 밝은 돌흙이라 아랫단과 다른 칸이다. 단 1·단 2 는 cliff_b(서로 닿지 않는다).
  f.paint("cliff_a", at(3)); f.paint("cliff_b", [...at(2), ...at(1)]); f.paint("cface", at(-1));
  const rows = (spec: [number, number, number][]) => spec.flatMap(([y, x0, x1]) => [...k.rect(x0, y, x1, y)]);
  // 풀숲: 단 2 띠의 길목을 덮는 키 큰 풀 덩이(줄마다 폭·시작이 다르다). 연두 풀 깔개(mgrass 판)는 쓰지 않는다 — 깔개 테두리가
  // 맨땅 위 매트로 읽혔다(QA-L4·L5 M10). 본 시트 문법대로 키 큰 풀 + 이웃 칸 잎끝(tall_fringe)만. 계단 착지·동굴 앞은 비운다.
  const tallCells = rows([[5, 15, 17], [6, 14, 18], [7, 15, 19]]);
  f.shape();
  for (const g of ["cliff_a", "cliff_b", "cface"]) joinBorder(f, g);
  const grp = (x: number, y: number) => { const h = lv(x, y); return h === 2 || h === 1 ? "cliff_b" : h === 3 ? "cliff_a" : ""; };
  const isGrp = (g: string, x: number, y: number) => k.g(g).memberTileIds.includes(f.map.lowerTiles[y * W_ + x]);
  // 낮은 단 칸은 더 높은 단 쪽으로 이어 붙인다 — 테두리(옆테·윗테·낮은 앞면)는 높은 단의 가장자리에만 선다.
  // 대각도 같다 — 대각이 높은 단이면 그 구석은 낮은 땅이 아니다(안쪽 구석 밝은 점이 생기지 않게).
  for (let y = 0; y < H_; y++) for (let x = 0; x < W_; x++) {
    const h = lv(x, y), g = grp(x, y);
    if (!g || !isGrp(g, x, y)) continue;
    for (const [dx, dy, D] of [[0, -1, N], [1, 0, E], [0, 1, S], [-1, 0, W]] as [number, number, number][]) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < W_ && Y < H_ && (lv(X, Y) >= h || lv(X, Y) === -1)) join(f, g, x, y, D);   // 같은 단 대각도(곁을 이어 붙여 잃은 대각 비트를 되살린다)
    }
    for (const [dx, dy, D] of [[1, -1, NE], [-1, -1, NW], [1, 1, SE], [-1, 1, SW]] as [number, number, number][]) {
      const X = x + dx, Y = y + dy;
      if (X >= 0 && Y >= 0 && X < W_ && Y < H_ && (lv(X, Y) >= h || lv(X, Y) === -1)) join(f, g, x, y, D);   // 같은 단 대각도(곁을 이어 붙여 잃은 대각 비트를 되살린다)
    }
  }
  /** 앞면을 끊는 물체(계단·동굴): 양옆 앞면은 물체 쪽으로 이어지게, 물체 위 윗단은 남쪽으로, 아래 단은 북쪽으로 이어지게. */
  const cut = (x0: number, w: number, yTop: number, rows_: number, open: boolean) => {
    for (let r = 0; r < rows_; r++) { join(f, "cface", x0 - 1, yTop + r, E | NE | SE); join(f, "cface", x0 + w, yTop + r, W | NW | SW); }
    for (let x = x0; x < x0 + w; x++) join(f, grp(x, yTop - 1), x, yTop - 1, S | SE | SW);
    if (open) for (let x = x0; x < x0 + w; x++) { const g = grp(x, yTop + rows_); if (g && isGrp(g, x, yTop + rows_)) join(f, g, x, yTop + rows_, N | NE | NW); }
  };
  const ST = [[10, B1[10] + 1], [16, B2[16] + 1], [12, B3[12] + 1]] as Cell[];   // 단 0→1, 단 1→2, 단 2→3
  for (const [sx, sy] of ST) { f.stamp("cstairs", sx, sy); cut(sx, 2, sy, 2, true); }
  const CV: Cell = [8, B3[8] + 1];
  f.stamp("ccave", CV[0], CV[1]); cut(CV[0], 1, CV[1], 2, false); join(f, "cliff_b", CV[0], CV[1] + 2, N | NE | NW);
  faceVary(f, "cface");
  for (const g of ["cliff_a", "cliff_b"]) shadeAutotileInterior(f.map, k.g(g));
  roundFace(rs, f, "cface", "cface", ["cliff_a", "cliff_b"]);
  for (const [x, y] of tallCells) f.lo(x, y, `tall${(x + y) % 2}`);
  // 맵 둘레는 침엽수 줄로 막는다(원작 111·112 산길: 맵 끝은 나무·벼랑 벽, 출구만 길 폭 틈, QA-L6 M12). 침엽수 = 본 시트 pine_a 그림(pine_m).
  //   위 끝: 꼭대기 뒷줄(줄기가 y1) — 꼭대기 계단 위 (12..13,0) 만 연다(북쪽 출구). 아래 끝: 맨 아래 단 앞줄(수관이 y15·16) — 첫 계단 앞 (10..11,16) 만 연다.
  //   왼·오른 끝: 단마다 맵 끝 두 열에 한 그루씩(앞면 끝은 이미 막혀 있다).
  const EXIT_N = 12, EXIT_S = 10;
  const pines: Cell[] = [];
  for (let x = 0; x < W_; x += 2) if (x !== EXIT_N) pines.push([x, -1]);
  for (let x = 0; x < W_; x += 2) if (x !== EXIT_S) pines.push([x, 15]);
  for (const y of [3, 7, 12]) pines.push([0, y], [W_ - 2, y]);
  for (const [x, y] of pines) f.stamp("pine_m", x, y);
  for (let y = 0; y < H_; y++) for (const x of [0, W_ - 1]) {          // 둘레 검사: 맵 끝 칸은 막혔거나(나무·앞면) 출구 칸이어야 한다
    const exit = (y === 0 && (x === EXIT_N || x === EXIT_N + 1)) || (y === H_ - 1 && (x === EXIT_S || x === EXIT_S + 1));
    k.check(exit || f.occ.has(`${x},${y}`) || lv(x, y) === -1, `mountain: 맵 끝 (${x},${y}) 가 열려 있다 — 둘레는 나무·벼랑으로 막는다`);
  }
  for (let x = 0; x < W_; x++) for (const y of [0, H_ - 1]) {
    const exit = (y === 0 && (x === EXIT_N || x === EXIT_N + 1)) || (y === H_ - 1 && (x === EXIT_S || x === EXIT_S + 1));
    k.check(exit || f.occ.has(`${x},${y}`) || lv(x, y) === -1, `mountain: 맵 끝 (${x},${y}) 가 열려 있다 — 출구는 길 폭 틈 둘뿐`);
  }
  f.up(11, 2, "sign_metal");                            // 꼭대기: 북쪽 출구 길 안내(출구 왼쪽)
  f.stamp("bigrock", 4, 6); f.up(9, 6, "boulder1");      // 단 2 서쪽: 큰 바위, 밀 바위는 3칸 떼어(장치가 장식 무더기로 안 보이게, QA-L8 N8)
  f.stamp("bigrock", 4, 11);                             // 단 1 띠 서쪽 끝 바위 무더기
  for (const [x, y, v] of [[3, 6, 1], [7, 11, 0], [18, 11, 1], [11, 7, 1]] as [number, number, number][]) prop(f, x, y, `mpeb${v}`);
  f.up(12, 12, "sign_metal");                            // 단 1: 첫 계단 위 안내
  // 키 큰 풀 가장자리 이웃 칸(남·동·서, 단 2 바닥)에는 본 시트 잎끝(tall_fringe)을 위층에 얹는다 — 칼로 자른 카펫 끝이 아니게.
  fringeTall(f, /^tall\d$/, (x, y) => lv(x, y) === 2 && /^cliffb_at/.test(f.at(x, y)));
  roundTall(rs, f, /^tall\d$/, "tall", () => "m");
  f.save();
  k.describe(f, "겹 고원 산(4단): 단 1·단 2 는 맵을 가로지르는 띠라 남쪽 앞면(두 줄 바위 벽)이 세 겹으로 쌓이고 양 끝은 사선 등고선으로 물러난다. 꼭대기(단 3)도 맵을 가로지르는 띠이고 윗면은 한 단 밝은 돌흙이다. 맵 둘레는 침엽수 줄(본 시트 침엽수)과 벼랑 앞면이 막고, 출구는 북쪽 꼭대기 계단 위 2칸·남쪽 첫 계단 앞 2칸뿐이다. 단을 오르는 길은 앞면을 끊은 돌계단뿐. 길: 남쪽 입구 → 단 1 → 동쪽 계단 → 단 2 띠 → 꼭대기 계단 → 북쪽 출구. 꼭대기 앞면에 동굴, 단 2 띠의 길목은 풀숲(조우).");
  const S0: Cell = [EXIT_S, 16], N0: Cell = [EXIT_N, 0];
  k.expectReach(f, S0, [N0], "남쪽 입구 → 계단 셋 → 꼭대기 → 북쪽 출구");
  k.expectReach(f, S0, [[CV[0], CV[1] + 2], [16, 6]], "남쪽 입구 → 꼭대기 앞면 동굴 입구(단 2) · 동쪽 풀숲");
  k.expectNoReach(f, S0, [[7, 12], N0], "첫 계단을 막으면 단 1 에 못 오른다 — 앞면은 넘을 수 없다", { blocked: [[10, B1[10] + 1], [11, B1[11] + 1]] });
  k.expectNoReach(f, [8, 11], [N0, [10, 7]], "단 1 → 단 2 계단을 막으면 위로 못 간다", { blocked: [[16, B2[16] + 1], [17, B2[17] + 1]] });
  k.expectNoReach(f, [10, 7], [N0], "꼭대기 계단을 막으면 꼭대기에 못 오른다 — 옆테로도 못 오른다", { blocked: [[12, B3[12] + 1], [13, B3[13] + 1]] });
  k.negative(f, "stairs-walled", "첫 돌계단 윗칸을 앞면 바위로 바꾸면 단 1 에 못 오른다", (g) => { for (const x of [10, 11]) g.lo(x, B1[10] + 1, "cface_at255"); }, S0, [[7, 12], N0]);
  k.negative(f, "summit-walled", "꼭대기 돌계단 윗칸을 앞면 바위로 바꾸면 북쪽 출구에 못 간다", (g) => { for (const x of [12, 13]) g.lo(x, B3[12] + 1, "cface_at255"); }, S0, [N0]);
  k.negative(f, "exit-planted", "북쪽 출구 틈에 침엽수를 한 그루 더 심으면 북쪽으로 못 나간다", (g) => g.stamp("pine_m", EXIT_N, -1), S0, [N0]);
}

// ---- 3. 늪지(120번 도로 늪·사파리 늪) 26×20 — 서쪽 입구 → 진흙 들판(웅덩이 사이 길) → 동쪽 출구.
//      웅덩이는 크기가 다른 둥근 사각 한 덩이씩(오목 모서리 없이), 진흙은 한 칸 폭 목이 없는 들판, 연잎은 웅덩이 속, 부들은 웅덩이 가장자리 물 칸(나무 곁 제외),
//      마른 나무는 나무와 떨어진 바닥 칸에 혼자. 갈대 덤불(조우)은 덩이로 길목을 막는다.
{
  const f = k.field("swamp", 26, 20, (x, y) => `swg${(x * 7 + y * 13 + ((x * y) % 5)) % 4}`);
  const G = ["#############", "#....##.....#", "#...........#", "#...#.......#", "............#", ".........#...", "#.....#......", "#.........###", "#.##........#", "#############"];
  const trees = groves(G);
  const open = (x: number, y: number) => !trees.has(`${x >> 1},${y >> 1}`);
  // 웅덩이는 혹이 붙은 덩이(L 자·어긋난 두 줄 — 47 변형의 안쪽 모서리를 쓴다)와 작은 둥근 덩이를 섞는다
  const pondsL = [[...k.rect(6, 8, 8, 10)].filter(([x, y]) => !(x === 6 && y === 10)).concat([[9, 9], [9, 10]]), [...k.rect(16, 5, 19, 6), [17, 7], [18, 7]],
    [...k.rect(15, 12, 18, 13), [16, 14], [17, 14]], [...k.rect(9, 14, 11, 15), [9, 16], [10, 16]], [...k.rect(21, 7, 23, 8), [22, 6], [23, 6]]] as Cell[][];   // 작은 셋은 2줄 덩이에 2칸 폭 혹(1칸 높이 팔은 수도관으로 읽혔다, QA-L6 S9)
  const ponds = pondsL.flat().filter(([x, y]) => open(x, y));
  const pond = set(ponds);
  // 진흙 들판: 큰 덩이 셋을 크게 흔든 윤곽(곧은 변이 4칸을 넘지 않게)
  const mud = [...set([...blob(8.5, 9.5, 6.0, 4.2, 2, 1.7), ...blob(17.5, 8.5, 5.2, 4.4, 5, 1.7), ...blob(13, 13.5, 2.8, 2.0, 3, 1.4)])].map((c) => c.split(",").map(Number) as Cell)
    .filter(([x, y]) => open(x, y) && x > 1 && x < 24 && y > 2 && y < 17 && !pond.has(`${x},${y}`));
  // 진흙 윤곽 다듬기: (1) 한 칸 폭 목·기둥(가로나 세로로 양옆이 빈 칸)은 지우고, (2) 곧은 변이 4칸 이상 이어지면 가운데에
  //   혹(바깥 칸 하나를 더함) 또는 홈(안 칸 하나를 뺌)을 번갈아 낸다 — 칸 오토타일의 진흙이 격자 계단으로 읽히지 않게. 웅덩이는 진흙으로 친다.
  const ms = set(mud);
  const isM = (x: number, y: number) => ms.has(`${x},${y}`) || pond.has(`${x},${y}`);
  const canAdd = (x: number, y: number) => open(x, y) && x > 1 && x < 24 && y > 2 && y < 17 && !pond.has(`${x},${y}`);
  let flip = 0;
  for (let pass = 0; pass < 40; pass++) {
    let changed = false;
    for (const c of [...ms]) {
      const [x, y] = c.split(",").map(Number);
      const own = (a: number, b: number) => ms.has(`${a},${b}`);
      if ((!own(x - 1, y) && !own(x + 1, y)) || (!own(x, y - 1) && !own(x, y + 1))) { ms.delete(c); changed = true; }
    }
    const runs: [number, number, number, number][] = [];   // 곧은 변: (가운데 x, y, 바깥 dx, dy)
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as Cell[]) {
      const H_ = dy !== 0;
      for (let line = 0; line < (H_ ? 20 : 26); line++) {
        let run: Cell[] = [];
        const flush = () => { if (run.length >= 4) { const [mx, my] = run[Math.floor(run.length / 2)]; runs.push([mx, my, dx, dy]); } run = []; };
        for (let t = 0; t < (H_ ? 26 : 20); t++) {
          const x = H_ ? t : line, y = H_ ? line : t;
          if (isM(x, y) && !pond.has(`${x},${y}`) && !isM(x + dx, y + dy)) run.push([x, y]); else flush();
        }
        flush();
      }
    }
    for (const [x, y, dx, dy] of runs) {
      flip++;
      if (flip % 2 && canAdd(x + dx, y + dy)) ms.add(`${x + dx},${y + dy}`); else ms.delete(`${x},${y}`);
      changed = true;
    }
    if (!changed) break;
  }
  // 작은 섬(8칸 미만 덩이)은 지운다 — 2×2 진흙 섬은 네모 깔개로 읽힌다
  const seen = new Set<string>();
  for (const c of [...ms]) {
    if (seen.has(c)) continue;
    const comp: string[] = []; const q = [c]; seen.add(c);
    while (q.length) { const cur = q.pop()!; comp.push(cur); const [x, y] = cur.split(",").map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = `${x + dx},${y + dy}`; if (ms.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } } }
    if (comp.length < 8) for (const x of comp) ms.delete(x);
  }
  // 수관 밑에서 끝나는 진흙 끝(그루 바로 위 줄 = 수관 머리 밑 칸인데 위 칸도 진흙 — 아래로 뻗다 수관에 막힌 끝)은 지운다:
  // 길이 수관 한 칸 앞에서 둥글게 닫힌다(I4 W7 — 끝이 나무 밑으로 들어가 사라졌다). 지운 뒤 생긴 한 칸 폭 목도 지운다.
  for (const c of [...ms]) { const [x, y] = c.split(",").map(Number); if (!open(x, y + 1) && ms.has(`${x},${y - 1}`) && !ms.has(`${x - 1},${y + 1}`) && !ms.has(`${x + 1},${y + 1}`)) ms.delete(c); }
  for (let pass = 0; pass < 4; pass++) for (const c of [...ms]) {
    const [x, y] = c.split(",").map(Number), own = (a: number, b: number) => ms.has(`${a},${b}`) || pond.has(`${a},${b}`);
    if ((!own(x - 1, y) && !own(x + 1, y)) || (!own(x, y - 1) && !own(x, y + 1))) ms.delete(c);
  }
  if (!pond.has("21,9")) ms.add("21,9");   // 동쪽 진흙 목을 두 칸으로(나무 곁 1칸 오솔길이 직각 계단이 되지 않게)
  mud.length = 0; for (const c of ms) mud.push(c.split(",").map(Number) as Cell);
  f.paint("mud", mud);
  f.paint("swater", ponds);
  f.shape(["mud", "swater"]);
  woods(f, trees, "swood_");
  const nearTree = (x: number, y: number, r = 1) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!open(x + dx, y + dy)) return true; return false; };
  // 갈대 덤불(조우): 풀땅에 덩이로 — 덩이 맨 윗줄만 이삭, 속 칸은 이삭 없는 변형
  const reedCells = [...blob(13, 4.5, 2.4, 1.4, 7), ...blob(21.5, 15, 1.8, 1.4, 8), ...blob(22, 5.5, 1.6, 1.6, 9), ...blob(3, 4.5, 1.6, 1.2, 4)]
    .filter(([x, y]) => open(x, y) && f.at(x, y).startsWith("swg") && !(y === 9 && x < 3));
  const rs = set(reedCells);
  for (const [x, y] of reedCells) {
    const sd = !rs.has(`${x - 1},${y}`) && x > 0 ? "_l" : !rs.has(`${x + 1},${y}`) && x < f.W - 1 ? "_r" : "";
    const ab = rs.has(`${x},${y - 1}`), be = rs.has(`${x},${y + 1}`);   // 위·아래도 갈대인가 → 윗끝·속·아랫끝·한 줄 조각
    f.lo(x, y, `${ab ? (be ? "reedin" : "reedbt") : (be ? "reed" : "reedone")}${(x + y) % 2}${sd}`);
  }
  // 연잎(웅덩이 속), 부들(가장자리 물 칸, 나무 곁 제외)
  const inner = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => pond.has(`${x + dx},${y + dy}`));
  ponds.filter(([x, y]) => inner(x, y)).forEach(([x, y], i) => { if (i % 2 === 0) f.up(x, y, `lily${(x * 3 + y) % 2}`); });
  const rim = ponds.filter(([x, y]) => !inner(x, y) && !nearTree(x, y));
  rim.forEach(([x, y], i) => { if (i % 3 === 1) f.up(x, y, `cattail${i % 2}`); });
  // 마른 나무: 바닥 칸(진흙·풀), 나무·웅덩이와 한 칸 이상 떨어져
  for (const [x, y] of [[11, 3], [3, 11], [14, 9], [23, 9]] as Cell[]) {
    const ok = !nearTree(x, y) && !nearTree(x, y + 1) && !pond.has(`${x},${y}`) && !pond.has(`${x},${y + 1}`);
    if (ok) f.stamp("snag", x, y);
  }
  f.up(2, 7, "sign");
  f.save();
  k.describe(f, "늪지: 올리브 젖은 풀땅에 진흙 들판이 넓게 퍼지고, 그 속에 크기가 다른 둥근 웅덩이가 띄엄띄엄 있다(한 칸 폭 진흙 목·오목한 웅덩이 없음). 길은 웅덩이 사이 진흙으로 서→동, 갈대 덤불이 길목을 막는다. 연잎은 웅덩이 속, 부들은 가장자리 물 칸, 마른 나무는 바닥 칸에 혼자 선다.");
  k.expectReach(f, [0, 9], [[25, 11]], "서쪽 입구 → 동쪽 출구(진흙 들판을 지나)");
  k.expectReach(f, [0, 9], [[13, 9]], "웅덩이 사이 진흙 길");
  const p0 = ponds.find(([x, y]) => inner(x, y))!;
  k.expectNoReach(f, [0, 9], [p0], "웅덩이 물에는 들어갈 수 없다");
  k.check(k.ts.terrain[k.id("reed0")] === 5 && k.ts.terrain[k.id("reedin0")] === 5, "갈대는 조우 지형(5)이어야 한다");
  k.negative(f, "mud-flooded", "웅덩이 사이 진흙 목(가운데 세로 줄)을 물로 채우면 동쪽 출구에 못 간다", (g) => {
    for (let y = 2; y <= 17; y++) if (open(12, y)) g.lo(12, y, "swater_at255_f0");
  }, [0, 9], [[25, 11]]);
}

// ---- 4. 꽃 정원(117번 도로·123번 열매밭) 28×20 — 서쪽 → 마을 길(밝은 풀 길) → 동쪽. 길 북쪽 울타리 꽃밭 둘(흙 테두리),
//      남쪽 서편 열매밭(부드러운 흙 한 칸씩 띄어 덤불 성장 단계), 남쪽 동편 생울타리 정원(디딤돌 입구), 바깥 둘레에 풀 덩이.
{
  const f = k.field("garden", 28, 20, (x, y) => `grass${(x * 7 + y * 13 + ((x * y) % 5)) % 4}`);
  const G = ["##############", "#............#", "#............#", "#............#", "..............", "..............", "#............#", "#............#", "#............#", "##############"];
  const trees = groves(G);
  f.paint("clearing", [...k.rect(0, 9, 27, 10)]);
  f.paint("fbeda", [...k.rect(3, 4, 9, 7)]);
  f.paint("fbedb", [...k.rect(16, 4, 23, 7), ...k.rect(17, 13, 23, 15).filter(([x, y]) => x !== 20 && y !== 14)]);
  f.shape(["fbeda", "fbedb"]); joinBorder(f, "clearing");
  fenceRect(f, 2, 3, 10, 8, [[5, 8], [6, 8]]);
  fenceRect(f, 15, 3, 24, 8, [[19, 8], [20, 8]]);
  f.up(12, 8, "sign");
  // 열매밭: 부드러운 흙 한 칸씩 띄어 두 줄, 덤불은 성장 단계가 섞인다(빈 흙 하나는 심을 자리)
  fenceRect(f, 2, 11, 11, 16, [[6, 11], [7, 11]]);
  const plots: [number, number, string][] = [[3, 13, "berry_red"], [5, 13, "berry_sprout"], [8, 13, "berry_blue"], [10, 13, "berry_bloom"], [3, 15, "berry_yellow"], [5, 15, ""], [8, 15, "berry_red"], [10, 15, "berry_blue"]];
  for (const [x, y, n] of plots) { f.lo(x, y, "soil_1"); if (n) f.stamp(n, x, y); }
  // 생울타리 정원: 디딤돌 십자 길, 네 귀퉁이 꽃밭
  const hedge = new Set<string>();
  for (let x = 15; x <= 25; x++) { hedge.add(`${x},11`); hedge.add(`${x},16`); }
  for (let y = 11; y <= 16; y++) { hedge.add(`15,${y}`); hedge.add(`25,${y}`); }
  hedge.delete("20,11"); hedge.delete("19,11");
  for (const c of hedge) { const [x, y] = c.split(",").map(Number); const h = (a: number, b: number) => hedge.has(`${a},${b}`) ? 1 : 0;
    f.up(x, y, `hedge_at${h(x, y - 1) | (h(x + 1, y) << 1) | (h(x, y + 1) << 2) | (h(x - 1, y) << 3)}`); }
  for (const [x, y] of [...k.rect(16, 12, 24, 15)]) if (x === 20 || y === 14 || (x === 19 && y === 12)) f.lo(x, y, "gstone" + ((x * 7 + y * 3) % 3));
  f.lo(19, 11, "gstone2"); f.lo(20, 11, "gstone1");
  // 바깥 둘레 풀 덩이(야생 조우)
  for (const [x, y] of [...k.rect(12, 2, 13, 6), ...k.rect(25, 2, 25, 6), ...k.rect(12, 12, 13, 16)])
    if (!(x === 12 && y === 2) && !(x === 13 && y === 16)) f.lo(x, y, `tall${(x + y) % 2}`);
  forest(f, trees);
  fringeTall(f, /^tall\d$/, (x, y) => /^(grass\d|flower_|clear_at)/.test(f.at(x, y)));   // 풀숲 둘레 잎끝(본 시트, QA-L6 N4)
  roundTall(rs, f, /^tall\d$/, "tall", () => "g");
  f.save();
  k.describe(f, "꽃 정원: 마을 길(밝은 풀 길)이 서→동으로 지나고, 길 북쪽 울타리 안에 흙 테두리 꽃밭 둘, 남쪽 서편 열매밭은 부드러운 흙 한 칸씩 띄어 덤불이 새싹·꽃·열매 단계로 선다. 남쪽 동편은 생울타리로 두른 정원에 디딤돌 입구 하나. 바깥 둘레엔 풀 덩이(조우).");
  k.expectReach(f, [0, 9], [[27, 10]], "서쪽 → 동쪽(마을 길)");
  k.expectReach(f, [0, 9], [[5, 5], [20, 5]], "길 → 울타리 꽃밭 안(아래 입구로)");
  k.expectReach(f, [0, 9], [[5, 15], [20, 14]], "길 → 열매밭 빈 흙·생울타리 정원 안");
  k.expectNoReach(f, [0, 9], [[3, 13]], "열매 덤불 칸은 막혀 있다(조사 이벤트 자리)");
  k.expectNoReach(f, [0, 9], [[20, 14]], "생울타리는 막힌 벽 — 디딤돌 입구를 막으면 정원에 못 든다", { blocked: [[19, 11], [20, 11]] });
  k.negative(f, "hedge-closed", "생울타리 입구 두 칸에 생울타리를 이어 심으면 정원 안에 못 든다", (g) => { g.up(19, 11, "hedge_at10"); g.up(20, 11, "hedge_at10"); }, [0, 9], [[20, 14]]);
}

// ---- 5. 강과 다리(119·120번 도로) 26×34 — 윗단(풀 절벽) 위를 굽어 흐르는 강(바위 둑, 4~6칸 — 3~4줄 곧게 흐르다 한 번에 한쪽 물가만 꺾인다) → 폭포(앞면 두 줄 자리) → 아랫강이
//      굽이쳐 남쪽으로, 동쪽 맵 끝에서 들어온 샛강이 둥근 웅덩이를 지나 굽어 합류. 건너는 길은 가로 통나무 다리 하나(아랫강)와 세로 다리 하나(샛강).
//      절벽 앞면의 등고선은 열마다 정해 사선 계단으로 물러난다(직선 띠가 아니게).
{
  const f = k.field("river", 26, 34, (x, y) => `grass${(x * 7 + y * 13 + ((x * y) % 5)) % 4}`);
  const G = ["##.#.......##", "#...........#", "#...........#", "#...........#", "#...........#", "#...........#", "#...........#", "#...........#", "#...........#", "#...........#", "#...........#", "#...........#", "#............", "#............", "#............", "#...........#", "#...........#"];   // 샛강이 동쪽 맵 끝으로 나가는 자리(줄 13~14)는 숲을 비운다
  const trees = groves(G);
  const SF = [9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 9, 8, 8, 8, 8];   // 앞면 첫 줄(열마다)
  // 윗강 폭(줄마다): 3·4·3 줄을 곧게 흐르다 한 번에 한쪽 물가만 꺾인다(서쪽 2칸 → 동쪽 1칸). 폭포 바로 위 세 줄은 둑이 폭포 바깥에 온다.
  const UP: [number, number][] = [[13, 16], [13, 16], [13, 16], [11, 16], [11, 16], [11, 16], [11, 16], [11, 15], [11, 15], [11, 15]];
  // 아랫강: 서쪽 물가는 폭포 발치부터 27 줄까지 곧다. 꺾임은 한쪽씩 — 18 줄 동쪽 안으로, 23 줄 동쪽 밖으로(샛강이 드는 곳), 28 줄 서쪽 안으로.
  const span = (y: number): [number, number] => y <= 17 ? [11, 15] : y <= 22 ? [11, 14] : y <= 27 ? [11, 16] : [13, 16];
  const upper: Cell[] = UP.flatMap(([a0, a1], y) => [...k.rect(a0, y, a1, y)] as Cell[]);
  const upSet = set(upper);
  const lower: Cell[] = [];
  for (let y = 12; y < 34; y++) { const [a0, a1] = span(y); for (let x = a0; x <= a1; x++) lower.push([x, y]); }
  const side: Cell[] = [...k.rect(17, 26, 25, 27)] as Cell[];   // 샛강은 26~27 두 줄로 맵 동쪽 끝까지 곧게 — 세로 다리 양쪽 물길 줄이 맞고, 돌기·1칸 물길이 없다(QA-L5 R6)
  const isFall = (x: number) => x >= 12 && x <= 14;
  const plateau: Cell[] = [], face: Cell[] = [];
  for (let x = 0; x < 26; x++) for (let y = 0; y < SF[x] + 2; y++) {
    if (y < SF[x]) { if (!upSet.has(`${x},${y}`)) plateau.push([x, y]); }
    else if (!isFall(x)) face.push([x, y]);
  }
  // 동쪽 둑 풀밭의 작은 풀 고원(단 하나 — 북·동·서 바위 테가 드러난다. 원작 120번 둑의 솟은 바위 단). 앞면을 끊은 돌계단으로 오른다(QA-L7 R8 — 계단 없이 꽃만 있으면 화단으로 읽혔다).
  // 윗면 6×3 이 동쪽 숲벽 밑까지 들어간다(숲에서 나온 단 — 원작 101·110 문법. 섬처럼 네 변에 테를 두르면 화단·우리로 읽혔다, QA-L8 R8b)
  const knollTop = [...k.rect(18, 19, 25, 21)] as Cell[], knollFace = [...k.rect(18, 22, 25, 23)] as Cell[];
  f.paint("cliff_g", [...plateau, ...knollTop]);
  f.paint("gface", [...face, ...knollFace]);
  f.paint("rwater", [...upper, ...lower, ...side]);
  f.shape();
  for (const g of ["rwater", "cliff_g", "gface"]) joinBorder(f, g);
  for (let x = 12; x <= 14; x++) { f.lo(x, 10, "wfall_t"); f.lo(x, 11, "wfall_b"); join(f, "rwater", x, 9, S | SE | SW); join(f, "rwater", x, 12, N | NE | NW); }
  for (const y of [10, 11]) { join(f, "gface", 11, y, E | NE | SE); join(f, "gface", 15, y, W | NW | SW); }
  join(f, "rwater", 11, 12, NE); join(f, "rwater", 15, 12, NW);                  // 폭포 밑 구석: 둑 조각이 떠 보이지 않게
  // 폭포 위 양옆(11,9)·(15,9): 강물은 벼랑 윗테 앞에서 물가로 닫히고(남쪽 둑), 그 밑 앞면 칸은 윗테를 단다 — 물이 벼랑 꼭대기에서 잘려 보이지 않게
  for (const x of [11, 15]) { remask(f, "rwater", x, 9, (m) => m & ~(S | SE | SW)); remask(f, "gface", x, 10, (m) => m & ~(N | NE | NW)); }
  // 물살(아래로): 폭포 밑 좁은 줄 — 두 줄이 엇갈려 흐르고, 물결선 자리 변형 셋을 돌려 쓴다
  for (let x = 12; x <= 14; x++) f.lo(x, 12, `wfoot${x - 12}`);                 // 폭포 발치: 떨어진 물이 끓다 퍼지는 물보라 줄
  for (let y = 13; y <= 17; y++) { f.lo(13, y, ["cur_d", "cur_d1", "cur_d2"][y % 3]); if (y >= 14) f.lo(12 + (y % 2) * 2, y, ["cur_d2", "cur_d", "cur_d1"][y % 3]); }
  f.up(13, 23, "rrock0"); f.up(14, 29, "rrock1"); f.up(15, 32, "rrock0");            // 물바위는 물 속 칸에만
  // 계단: 윗단 → 아랫땅(앞면 두 줄을 끊는다)
  for (const sx of [5, 18]) {
    f.stamp("gstairs", sx, SF[sx]);
    for (const x of [sx, sx + 1]) join(f, "cliff_g", x, SF[sx] - 1, S | SE | SW);
    for (const y of [SF[sx], SF[sx] + 1]) { join(f, "gface", sx - 1, y, E | NE | SE); join(f, "gface", sx + 2, y, W | NW | SW); }
  }
  f.stamp("gstairs", 20, 22);                                            // 풀 고원 계단
  for (const x of [20, 21]) join(f, "cliff_g", x, 21, S | SE | SW);
  for (const y of [22, 23]) { join(f, "gface", 19, y, E | NE | SE); join(f, "gface", 22, y, W | NW | SW); }
  faceVary(f, "gface");
  for (const g of ["cliff_g"]) shadeAutotileInterior(f.map, k.g(g));
  roundFace(rs, f, "gface", "gface", ["cliff_g"]);                                     // 띠 끝·사선 계단 = 둥근 어깨·발끝(정본, I4 W3 — 산과 같은 문법)
  // 가로 통나무 다리(y 20~21): 서쪽 둑(x 10) 끝 말뚝 → 강(11~14) → 동쪽 둑(x 15) 끝 말뚝, 난간 기둥은 두 칸마다
  for (let x = 10; x <= 15; x++) {
    const sd = x === 10 ? "_w" : x === 15 ? "_e" : x % 2 === 0 ? "p" : "";
    f.lo(x, 20, `logbr_h_n${sd}`); f.lo(x, 21, `logbr_h_s${sd}`);
  }
  // 세로 통나무 다리(x 19~20): 샛강 북쪽 둑(y 25) → 남쪽 둑(y 28)
  for (let y = 25; y <= 28; y++) {
    const sd = y === 25 ? "_n" : y === 28 ? "_s" : y === 27 ? "p" : "";
    f.lo(19, y, `logbr_v_w${sd}`); f.lo(20, y, `logbr_v_e${sd}`);
  }
  // 풀숲·나무·바위·꽃
  for (const [x, y] of [...k.rect(3, 14, 8, 17), ...k.rect(18, 14, 22, 17), ...k.rect(3, 27, 8, 31), ...k.rect(21, 29, 23, 32), ...k.rect(6, 2, 9, 4), ...k.rect(17, 2, 20, 3)])
    if (!(x === 3 && y === 14) && !(x === 8 && y === 17) && !(x === 22 && y === 18)) f.lo(x, y, `tall${(x + y) % 2}`);
  forest(f, trees);
  for (const [x, y] of [[2, 22], [8, 23], [2, 6], [5, 24]] as Cell[]) f.stamp("forest_o", x, y - 1);   // 외톨이 그루(풀 덩이 밖, 서로 떨어져 — 빈 풀밭을 나눈다, QA-L6 R7)
  prop(f, 9, 13, "gpeb0"); prop(f, 18, 31, "gpeb1");
  f.up(24, 24, "bush0");                                                   // 고원 앞면 동쪽 끝·숲벽 밑동 사이를 덤불로 덮는다(나무가 단 위아래를 단차 없이 걸쳐 보였다, QA-L9 R10)     // 땅 바위 = 적갈 잔돌(밀 바위 장치가 아닌 장식 — 바위 램프 하나, QA-L8 N9) f.up(9, 19, "sign_metal"); f.up(17, 5, "sign");
  for (const [x, y, n] of [[5, 7, "pink"], [9, 7, "red"], [19, 6, "white"], [22, 6, "yellow"], [3, 20, "yellow"], [9, 26, "pink"], [16, 19, "white"], [4, 25, "red"]] as [number, number, string][]) prop(f, x, y, `flower_${n}`);   // 들꽃 = 본 시트 flower_*(QA-L6 N3)
  fringeTall(f, /^tall\d$/, (x, y) => /^(grass\d|flower_|cliffg_at255|cliffg_atin)/.test(f.at(x, y)));   // 풀숲 둘레 잎끝(본 시트, QA-L6 N4) — 윗단 풀 윗면 속 칸도 걷는 풀(QA-L7 N4b)
  roundTall(rs, f, /^tall\d$/, "tall", () => "g");
  f.save();
  k.describe(f, "강: 윗단 풀 절벽 위를 바위 둑을 두르고 3~4칸 폭으로 굽어 흐른 물이 앞면 두 줄 자리에서 폭포로 떨어져, 발치 물보라 웅덩이(양쪽 물가가 벼랑 발치에 닿는다)와 폭포 밑 물살(서핑 중 떠밀림)을 지나 넓은 강으로 굽이친다. 둑은 마을 연못과 같은 칸(주황 바위 혹, 같은 물결). 동서를 잇는 길은 끝 말뚝·나무 난간이 있는 가로 통나무 다리 하나, 동쪽 맵 끝에서 둥근 웅덩이를 지나 굽어 드는 샛강은 세로 다리로만 건넌다.");
  k.expectReach(f, [8, 3], [[18, 32]], "윗단 서쪽 → 계단 → 다리 → 동쪽 둑 → 세로 다리 건너 남동쪽");
  k.expectReach(f, [8, 3], [[20, 3]], "윗단 동쪽은 내려가서 다리를 건너 동쪽 계단으로 다시 오른다");
  k.expectNoReach(f, [8, 3], [[20, 3], [20, 15]], "협곡·강이 동서를 가른다 — 다리를 막으면 못 건넌다", { blocked: [[12, 20], [12, 21]] });
  k.expectNoReach(f, [8, 3], [[6, 14]], "계단을 막으면 절벽 앞면을 못 내려간다", { blocked: [[5, 10], [6, 10]] });
  k.expectNoReach(f, [22, 30], [[22, 22]], "샛강은 세로 다리로만 건넌다", { blocked: [[19, 26], [20, 26]] });
  k.check(k.ts.slideTiles?.[String(k.id("cur_d_f0"))] === "down" && k.ts.slideTiles?.[String(k.id("cur_d2_f0"))] === "down", "물살 칸(변형 포함)은 slideTiles 에 down 으로 기록돼야 한다");
  k.expectReach(f, [8, 3], [[19, 20]], "동쪽 둑 → 풀 고원 계단 → 고원 위");
  k.negative(f, "bridge-gap", "가로 다리 한 줄(x 13)을 물로 바꾸면 동쪽 둑에 못 간다", (g) => { g.lo(13, 20, "rwater_at255_f0"); g.lo(13, 21, "rwater_at255_f0"); }, [8, 3], [[20, 15], [18, 32]]);
  k.negative(f, "stairs-face", "서쪽 계단 윗칸을 앞면 바위로 바꾸면 윗단에서 내려갈 수 없다", (g) => { g.lo(5, 10, "gface_at255"); g.lo(6, 10, "gface_at255"); }, [8, 3], [[6, 14]]);
}
k.done();
