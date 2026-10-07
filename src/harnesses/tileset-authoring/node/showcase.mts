/** 구운 타일셋으로 보여 주기 맵(마을·도로·동굴)을 엔진 오토타일로 칠해 verify-*.json 에 쓴다(렌더는 lib/render_map.py). */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { shapeAllAutotileGroupsAround, shadeAutotileInterior } from "../../../project/defaults/autotileEngine";
import { canMove, ledgeDirectionAt } from "../../../project/collision";
import { roundFace, roundTall, type RoundSheet } from "./wild_round.mts";   // 정본 둥근 띠 끝·풀숲 귀 배치(감독 결정 I4 W2·W3 — 야생과 같은 규칙)
const dir = resolve(process.argv[2] ?? "");
const ts = JSON.parse(readFileSync(`${dir}/tileset.json`, "utf8"));
const objects = JSON.parse(readFileSync(`${dir}/objects.json`, "utf8")) as any[];
const tiles = JSON.parse(readFileSync(`${dir}/../tiles.json`, "utf8"));
const id = (n: string) => tiles.ids[n] as number;
const groups = ts.autotileGroups as any[];
const g = (n: string) => groups.find((q) => q.id === n);
const obj = (n: string) => objects.find((o) => o.name === n);
const nameOf = new Map<number, string>(Object.entries(tiles.ids as Record<string, number>).map(([n, i]) => [i, n]));
const rs: RoundSheet = { id, name: (i) => nameOf.get(i), group: (n) => g(n) };

/** 야외 맵 한 장: 바탕 풀 + 오토타일 칠 + 물체 찍기(맵 밖은 자른다) + 숲(나무 격자). */
class Field {
  map: any; pts: { x: number; y: number }[] = []; wood = new Set<string>();
  constructor(public W: number, public H: number) {
    this.map = { width: W, height: H, lowerTiles: new Array(W * H), upperTiles: new Array(W * H).fill(-1) };
    for (let i = 0; i < W * H; i++) { const x = i % W, y = (i / W) | 0; this.map.lowerTiles[i] = id(`grass${(x * 7 + y * 13 + ((x * y) % 5)) % 4}`); }
  }
  in(x: number, y: number) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  paint(grp: string, cells: Iterable<[number, number]>) {
    const full = g(grp).variantMap["255"];
    for (const [x, y] of cells) if (this.in(x, y)) { this.map.lowerTiles[y * this.W + x] = full; this.pts.push({ x, y }); }
  }
  shape() { shapeAllAutotileGroupsAround(this.map, groups, this.pts); }
  stamp(n: string, x: number, y: number) {
    const o = obj(n);
    if (!o) throw new Error(`물체 ${n} 없음`);
    for (let r = 0; r < o.height; r++) for (let c = 0; c < o.width; c++) {
      if (!this.in(x + c, y + r)) continue;
      const i = (y + r) * this.W + x + c;
      if (o.rowsLower[r][c] >= 0) this.map.lowerTiles[i] = o.rowsLower[r][c];
      if (o.rowsUpper[r][c] >= 0) this.map.upperTiles[i] = o.rowsUpper[r][c];
    }
  }
  lo(x: number, y: number, n: string) { if (this.in(x, y)) this.map.lowerTiles[y * this.W + x] = id(n); }
  up(x: number, y: number, n: string) { if (this.in(x, y)) this.map.upperTiles[y * this.W + x] = id(n); }
  /** 숲: 나무 격자(그루 = 2×2 칸, 그루 (i,j) 의 왼쪽 위 칸 = (2i, 2j)). 맵 밖은 가로로는 나무, 세로로는 같은 열의 끝 그루를 잇는다.
   *  그루마다 위·아래·좌·우 이웃으로 9조각을 고른다 — 위가 비면 솟은 수관 줄을 한 칸 위에, 아래가 비면 줄기 줄을 한 칸 아래에 찍는다. */
  forest(trees: Set<string>) {
    const gw = Math.ceil(this.W / 2), gh = Math.ceil(this.H / 2);
    const has = (i: number, j: number): boolean => {
      if (i < 0 || i >= gw) return true;
      if (j < 0) return has(i, 0);
      if (j >= gh) return has(i, gh - 1);
      return trees.has(`${i},${j}`);
    };
    const list = [...trees].map((k) => k.split(",").map(Number)).sort((a, b) => a[1] - b[1]);
    for (const [i, j] of list) {
      const rk = !has(i, j - 1) ? "t" : !has(i, j + 1) ? "b" : "";
      const ck = !has(i - 1, j) ? "l" : !has(i + 1, j) ? "r" : "";
      const name = `forest_${rk}${ck}` === "forest_" ? "forest_c" : `forest_${rk}${ck}`;
      const y0 = 2 * j - (rk === "t" ? 1 : 0);
      this.stamp(name, 2 * i, y0);
      const h = rk === "" ? 2 : 3;
      for (let r = 0; r < h; r++) for (let c = 0; c < 2; c++) this.wood.add(`${2 * i + c},${y0 + r}`);
    }
  }
  save(file: string) { writeFileSync(`${dir}/${file}`, JSON.stringify({ width: this.W, height: this.H, lower: this.map.lowerTiles, upper: this.map.upperTiles })); }
}
const N = 1, E = 2, S = 4, W = 8, NE = 16, SE = 32, SW = 64, NW = 128;
const canon = (m8: number) => { let m = m8 & 15; for (const [sd, dg] of [[N | E, NE], [S | E, SE], [S | W, SW], [N | W, NW]]) if ((m & sd) === sd && m8 & dg) m |= dg; return m; };
/** 오토타일 칸 하나를 「그쪽은 이어졌다」로 — 계단처럼 그룹 밖 칸으로 드나드는 자리(야생 monster_wild.mts join 과 같은 규칙). */
function join(f: Field, grp: string, x: number, y: number, bits: number) {
  const gg = g(grp); const t = f.map.lowerTiles[y * f.W + x];
  const raw = Object.keys(gg.variantMap).find((m) => gg.variantMap[m] === t);
  if (raw === undefined) throw new Error(`(${x},${y}) 는 ${grp} 칸이 아니다`);
  f.map.lowerTiles[y * f.W + x] = gg.variantMap[String(canon(canon(Number(raw)) | bits))];
}
/** 앞면 가운데 칸(윗칸 ROW_T·아랫칸 ROW_B, 옆이 이어진 칸)을 덩이 변형으로 섞는다 — 야생 faceVary 와 같은 해시(L9 N81 16px 주기). */
function faceVary(f: Field, grp: string, pre: string) {
  const gg = g(grp); const h = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
  for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
    const raw = Object.keys(gg.variantMap).find((m) => gg.variantMap[m] === f.map.lowerTiles[y * f.W + x]); if (raw === undefined) continue;
    const m = canon(Number(raw));
    const tier = (m & (E | W)) !== (E | W) ? -1 : !(m & N) && m & S ? 0 : m & N && !(m & S) ? 1 : -1; if (tier < 0) continue;
    const v = h(x + 3, y + tier) % 3; if (v) f.lo(x, y, `${pre}in${tier}_${v - 1}`);
  }
}
const rect = function* (x0: number, y0: number, x1: number, y1: number): Generator<[number, number]> { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) yield [x, y]; };
const fenceRow = (f: Field, x0: number, x1: number, y: number) => {
  for (let x = x0; x <= x1; x++) f.up(x, y, `fence_at${(x > x0 ? 8 : 0) | (x < x1 ? 2 : 0)}`);
};

/** 턱 한 줄: 숲에 닿는 끝은 가운데 조각, 틈(길) 쪽 끝은 가늘어지는 끝 조각. 숲 칸은 건너뛴다. */
const ledgeRow = (f: Field, y: number, gaps: [number, number][], x0 = 0, x1 = f.W - 1) => {
  const on = (x: number) => x >= x0 && x <= x1 && !f.wood.has(`${x},${y}`) && !gaps.some(([a, b]) => x >= a && x <= b);
  for (let x = x0; x <= x1; x++) {
    if (!on(x)) continue;
    const l = !on(x - 1) && !f.wood.has(`${x - 1},${y}`), r = !on(x + 1) && !f.wood.has(`${x + 1},${y}`);
    f.lo(x, y, l ? "ledge_s_l" : r ? "ledge_s_r" : x % 2 ? "ledge_s_mid" : "ledge_s_mid1");
  }
};

// ---- 마을 22×20: 네 채 비례에 맞춘 숲 마을. 두 칸 길이 문을 잇고 남은 땅은 나무·연못·화단 ----
{
  const f = new Field(22, 20);
  const trees = new Set<string>();
  for (let i = 0; i < 11; i++) if (i !== 5) { trees.add(`${i},0`); trees.add(`${i},9`); }
  for (let j = 0; j < 10; j++) { trees.add(`0,${j}`); trees.add(`10,${j}`); }
  const paths = [...rect(10, 0, 11, 19), ...rect(4, 7, 17, 8), ...rect(4, 16, 17, 16)];
  f.paint("clearing", paths);
  f.paint("water", rect(6, 10, 8, 11));
  f.shape();
  f.stamp("house_a", 4, 3); f.up(3, 6, "mailbox");
  f.stamp("house_c", 14, 3); f.up(18, 6, "mailbox");
  f.stamp("mart", 4, 12); f.stamp("center", 14, 12);
  f.stamp("tree_a", 2, 8);
  f.up(12, 4, "sign"); f.up(12, 16, "sign_metal");
  // 길은 두 칸 폭, 문 앞 한 칸은 항상 비운다. 화단은 위 한 칸만 열린 작은 울타리 마당.
  for (let x = 14; x <= 18; x++) if (x !== 16) f.up(x, 9,
    `fence_at${(x > 14 && x !== 17 ? W : 0) | (x < 18 && x !== 15 ? E : 0) | (x === 14 || x === 18 ? S : 0)}`);
  for (const x of [14, 18]) f.up(x, 10, "fence_at5");
  for (let x = 14; x <= 18; x++) f.up(x, 11, `fence_at${(x > 14 ? W : 0) | (x < 18 ? E : 0) | (x === 14 || x === 18 ? N : 0)}`);
  for (const [x, y] of rect(15, 10, 17, 10)) f.lo(x, y, `flowerbed_${x % 2 ? "red" : "pink"}${x % 3 || ""}`);
  for (const [x, y, c] of [[8, 4, "red"], [8, 5, "pink"], [13, 4, "white"], [13, 5, "white"],
    [8, 14, "yellow"], [8, 15, "red"], [18, 13, "pink"], [18, 14, "white"], [4, 10, "pink"], [5, 11, "yellow"]] as [number, number, string][]) f.lo(x, y, `flower_${c}`);
  f.forest(trees);
  // 작성된 견본 자체의 도달 검사: 네 문·남북 출구·화단 입구가 같은 길망에 있다.
  const m: any = { id: "town", name: "town", width: f.W, height: f.H, tilesetId: ts.id, tileSize: 16, lowerTiles: f.map.lowerTiles, upperTiles: f.map.upperTiles, events: [] };
  const pj: any = { tilesets: { [ts.id]: ts }, maps: { town: m }, database: { terrains: [] } };
  const seen = new Set(["10,19"]), q: [number, number][] = [[10, 19]];
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
      if (!f.in(nx, ny) || seen.has(key) || !canMove(pj, m, x, y, nx, ny)) continue;
      seen.add(key); q.push([nx, ny]);
    }
  }
  const doors = ([["house_a", 4, 3], ["house_c", 14, 3], ["mart", 4, 12], ["center", 14, 12]] as [string, number, number][])
    .map(([name, x, y]) => { const e = obj(name).entrance; return [x + e.dx, y + e.dy]; });
  for (const [x, y] of [[10, 0], ...doors, [16, 10]])
    if (!seen.has(`${x},${y}`)) throw new Error(`마을 문·출구·화단 (${x},${y}) 에 못 간다`);
  console.log("마을 22×20: 네 문·남북 출구·화단 도달 ok");
  f.save("verify-map.json");
}

// ---- 도로(1번·101번 도로 문법) 24×32: 숲 벽 사이로 길이 가로 구간을 끼고 지그재그, 숲에서 숲까지 걸친 턱 줄, 길에 맞닿아 피할 수 없는 풀숲 ----
{
  const f = new Field(24, 32);
  const trees = new Set<string>();
  for (let j = 0; j < 16; j++) { for (const i of [0, 1, 10, 11]) trees.add(`${i},${j}`); }
  for (let j = 2; j <= 4; j++) trees.add(`9,${j}`);
  for (let j = 10; j <= 11; j++) trees.add(`2,${j}`);
  trees.add("2,0");                                            // 북서 숲 돌출: 줄기 줄(2)과 턱(4) 사이 한 줄(3)이 밀 바위 주머니(통합 I4 W3)
  const path: [number, number][] = [
    ...rect(11, 0, 12, 6), ...rect(6, 5, 12, 6), ...rect(6, 5, 7, 14), ...rect(6, 13, 15, 14),
    ...rect(14, 13, 15, 21), ...rect(9, 20, 15, 21), ...rect(9, 20, 10, 26),
  ];
  // 남쪽 끝 구간(턱 아래)은 모래길 — 공터 길이 모래길로 바뀌는 이음매 한 곳을 견본으로 보인다(적대 검수 L2 N32).
  // 두 그룹은 서로를 이웃으로 보므로(connectGroups) 이음매에 풀 테두리가 끼지 않는다.
  const sandPath: [number, number][] = [...rect(9, 27, 10, 31)];
  f.paint("clearing", path);
  f.paint("path", sandPath);
  // 바위 고원 하나(L9 N80 — 야생 정본과 같은 두 그룹): 윗면 rock_at 두 줄(14..19,22..23) + 앞면 gface 두 줄(24..25, 전부 막힘).
  // 앞면을 끊은 2×2 돌계단(야생 gstairs, 16..17)만 통로 — 계단 위 윗면 칸은 남쪽이, 계단 양옆 앞면 칸은 계단 쪽이 이어진 것으로 바꾼다.
  // 계단 양옆 앞면은 두 열씩(야생 river 고원과 같은 비례): 한 열이면 둥근 띠 끝(roundFace)이 위아래로 다 깎여 알약 바위로 따로 선다(w195 시험).
  f.paint("plateau", rect(14, 22, 19, 23));
  f.paint("gface", rect(14, 24, 19, 25));
  f.shape();
  for (const [x, y] of [[16, 24], [17, 24], [16, 25], [17, 25]] as [number, number][]) f.lo(x, y, `rock_stairs2.${x - 16}.${y - 24}`);
  for (const x of [16, 17]) join(f, "plateau", x, 23, S | SE | SW);
  for (const y of [24, 25]) { join(f, "gface", 15, y, E | NE | SE); join(f, "gface", 18, y, W | NW | SW); }
  faceVary(f, "gface", "gface_at");
  roundFace(rs, f, "gface", "gface", ["plateau"]);                            // 띠 끝 = 둥근 발끝 gface_rnd<마스크>(I4 W3 — 야생 산·강과 같은 문법)
  shadeAutotileInterior(f.map, g("plateau"));
  f.up(18, 23, "sign");                                          // 고원 위 목적지(L4 N53 — 올라가도 빈 단이었다)
  for (const [x, y] of sandPath) path.push([x, y]);
  const pathSet = new Set(path.map(([x, y]) => `${x},${y}`));
  const grass = (x0: number, y0: number, x1: number, y1: number) => { for (const [x, y] of rect(x0, y0, x1, y1)) if (!pathSet.has(`${x},${y}`)) f.lo(x, y, `tall${(x + y) % 2}`); };
  grass(13, 1, 17, 3); grass(8, 7, 13, 8); grass(8, 10, 13, 12); grass(4, 15, 12, 16); grass(16, 18, 19, 21); grass(11, 27, 16, 30);
  f.up(10, 1, "sign_metal");
  for (const [x, y] of [[4, 24], [5, 24], [4, 25], [5, 25]]) { const v = (x * 5 + y * 3) % 3; f.lo(x, y, `flowerbed_yellow${v ? v : ""}`); }
  // 길가 소품: 밀 바위(괴력)·자를 덤불 — 풀밭 위층에 얹는다(길·풀숲·턱 칸은 비운다)
  // 원작 도로엔 길가 1칸 장식 덤불이 없다 — 1칸 작은 나무는 곧 자르기 나무(L7 N69). 장식은 꽃·바위가 맡는다
  // 밀 바위(통합 I4 W3 — 원작 괴력 바위는 늘 1칸 통로를 막는다): 숲 줄기 줄과 턱 사이 1칸 줄로만 드는 주머니 둘의 입구에 앉힌다.
  // 북서 (6,3): 위는 돌출 그루 (4..5,0..2) 줄기, 아래는 턱 4 줄 → 주머니 (4..5,3). 북동 (17,11): 위는 그루 (18..19,3..10) 줄기, 아래는 턱 12 줄 → 주머니 (18..19,11).
  // 주머니에서 나올 때는 턱을 뛰어내린다(한쪽 길). 들어가는 길은 바위 칸뿐이다 — 아래 시험이 증명한다.
  f.up(6, 3, "boulder0"); f.up(17, 11, "boulder1");
  for (const [x, y, k] of [[4, 3, "red"], [5, 3, "yellow"], [18, 11, "white"], [19, 11, "pink"]] as [number, number, string][]) f.lo(x, y, `flower_${k}`);
  for (const [x, y, k] of [[8, 3, "white"], [5, 7, "pink"], [17, 15, "yellow"]] as [number, number, string][]) f.lo(x, y, `flower_${k}`);
  // 자르기 나무(정본 wild_forest.cut_tree, L6 N64): 서쪽 꽃밭 주머니(4..5,25)로 드는 유일한 1칸 틈을 막는다 — 위는 나무 줄기, 아래는 턱, 서쪽은 숲
  f.up(6, 25, "cuttree");
  f.forest(trees);
  // I5 V2: 주머니의 위 벽은 풀로 보이는 줄기 줄 대신 칸을 채운 수관으로 잇는다.
  for (const [x, y] of [[4, 2], [5, 2], [18, 10], [19, 10], [4, 24], [5, 24]])
    f.up(x, y, `forest_c.${x % 2}.1`);
  // 원작 도로 문법: 장치 뒤에 도달 목적이 보인다(아이템 획득 이벤트를 올릴 보상 자리).
  for (const [x, y] of [[4, 3], [19, 11], [4, 25]]) f.up(x, y, "item_capsule");
  ledgeRow(f, 9, [[6, 7]]); ledgeRow(f, 17, [[14, 15]]); ledgeRow(f, 26, [[9, 10]], 0, 13); ledgeRow(f, 4, [[11, 12]], 0, 10); ledgeRow(f, 12, [], 14, 19);
  // 풀밭 가장자리 잎끝(위층): 풀밭 남·동·서 이웃이 맨 풀 칸이면 얹는다 — 칸 변에서 칼로 자른 듯 끝나지 않게(L2 N35)
  {
    const tallAt = (x: number, y: number) => f.in(x, y) && [id("tall0"), id("tall1")].includes(f.map.lowerTiles[y * f.W + x]);
    const pathTiles = new Set([...g("clearing").memberTileIds, ...g("path").memberTileIds]);
    const bare = (x: number, y: number) => f.in(x, y) && f.map.upperTiles[y * f.W + x] < 0 &&
      ([0, 1, 2, 3].some((v) => f.map.lowerTiles[y * f.W + x] === id(`grass${v}`)) || pathTiles.has(f.map.lowerTiles[y * f.W + x]));   // 길 가장자리 위에도 잎끝(L3 N48 — 서쪽 끝이 늘 길에 닿아 안 깔렸다)
    for (let y = 0; y < f.H; y++) for (let x = 0; x < f.W; x++) {
      if (!bare(x, y)) continue;
      if (tallAt(x, y - 1)) f.up(x, y, "tall_fringe_s");
      else if (tallAt(x - 1, y)) f.up(x, y, "tall_fringe_e");
      else if (tallAt(x + 1, y)) f.up(x, y, "tall_fringe_w");
    }
  }
  roundTall(rs, f, /^tall\d$/, "tall", () => "g");               // 풀숲 바깥 귀·잎끝 = 둥근 귀(I4 W2 — 야생과 같은 문법). 잎끝을 다 깐 뒤 save 직전
  f.save("verify-route.json");
  // 자르기 나무 시험(L6 N64): 북쪽 입구에서 꽃밭 주머니(4,25)에 — 나무가 있으면 못 가고, 지우면 간다
  {
    const m: any = { id: "r", name: "r", width: f.W, height: f.H, tilesetId: ts.id, tileSize: 16, lowerTiles: f.map.lowerTiles, upperTiles: f.map.upperTiles, events: [] };
    const pj: any = { tilesets: { [ts.id]: ts }, maps: { r: m }, database: { terrains: [] } };
    const reach = (tx: number, ty: number) => {
      const seen = new Set(["11,0"]), q: [number, number][] = [[11, 0]];
      while (q.length) {
        const [x, y] = q.shift()!;
        if (x === tx && y === ty) return true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let nx = x + dx, ny = y + dy;
          const want = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up";
          if (ledgeDirectionAt(ts, m, nx, ny) === want) { nx += dx; ny += dy; if (!canMove(pj, m, nx - dx, ny - dy, nx, ny)) continue; }   // 턱은 그 방향으로 뛰어내린다(내릴 칸이 막혔으면 못 뛴다)
          else if (!canMove(pj, m, x, y, nx, ny)) continue;
          const k = `${nx},${ny}`;
          if (nx < 0 || ny < 0 || nx >= f.W || ny >= f.H || seen.has(k)) continue;
          seen.add(k); q.push([nx, ny]);
        }
      }
      return false;
    };
    const withTree = reach(4, 25);
    const i = 25 * f.W + 6, keep = m.upperTiles[i];
    m.upperTiles[i] = -1; const cut = reach(4, 25); m.upperTiles[i] = keep;
    console.log(`도로 자르기 나무: 자르기 전 꽃밭 도달 ${withTree} · 자른 뒤 ${cut}`);
    if (withTree || !cut) process.exit(1);
    // 고원(L9 N80): 계단으로 윗면에 오르고, 계단 옆 앞면 칸에는 어디서도 못 선다
    const upTop = reach(16, 23), face = [[14, 25], [15, 25], [18, 25], [19, 25], [14, 24], [15, 24], [18, 24], [19, 24]].filter(([x, y]) => reach(x, y));
    const sideStep = canMove(pj, m, 16, 25, 15, 25) || canMove(pj, m, 17, 25, 18, 25) || canMove(pj, m, 15, 23, 15, 24) || canMove(pj, m, 14, 21, 14, 22);
    console.log(`도로 고원: 계단으로 윗면 도달 ${upTop} · 앞면 칸 도달 ${face.length ? face.join(" ") : "없음"} · 계단 옆 앞면 진입 ${sideStep}`);
    if (!upTop || face.length || sideStep) process.exit(1);
    // 밀 바위(통합 I4 W3): 바위가 있으면 주머니에 못 가고(턱을 뛰어 들어오는 길도 없다), 밀어 치우면 간다
    for (const [bx, by, tx, ty] of [[6, 3, 4, 3], [17, 11, 19, 11]]) {
      const bi = by * f.W + bx, kb = m.upperTiles[bi];
      const shut = reach(tx, ty);
      m.upperTiles[bi] = -1; const moved = reach(tx, ty); m.upperTiles[bi] = kb;
      console.log(`도로 밀 바위 (${bx},${by}): 밀기 전 주머니 (${tx},${ty}) 도달 ${shut} · 민 뒤 ${moved}`);
      if (shut || !moved) process.exit(1);
    }
  }
}

// ---- 동굴 ----
{
  const CW = 34, CH = 22;
  const cm: any = { width: CW, height: CH, lowerTiles: new Array(CW * CH).fill(-1), upperTiles: new Array(CW * CH).fill(-1) };
  const wallFull = g("cave_wall").variantMap["255"];
  // 포켓몬 동굴 문법: 걸을 수 있는 바닥이 대부분이고, 암반은 알약형 고원(섬) + 가장자리 두 칸 띠
  const floor = new Set<string>();
  // 통합 I4 W3: 깨기 바위·밀 바위는 원작(돌 터널·석영 동굴)처럼 1칸 통로를 막는다.
  //  · 깨기 바위 (19,9): 가운데 기둥 (14..18,3..9) 과 동쪽 벽 덩이 (20..30,9..12) 사이 1칸 틈 — 북동 모래 방(19..30,3..8)으로 드는 유일한 길.
  //  · 깨기 바위 (19,18) + 밀 바위 (22,18): 남쪽 벽 덩이 (18..24,16..17) 밑 1칸 높이 통로(18..24,18) — 남동 모래 방(25..30,16..18)으로 드는 유일한 길.
  const islands: number[][] = [
    [3, 3, 5, 5], [14, 3, 18, 9], [25, 3, 30, 4], [3, 9, 8, 11],
    [11, 13, 14, 18], [20, 9, 30, 12], [25, 13, 30, 15], [18, 16, 24, 17],
  ];
  const isIsland = (x: number, y: number) => islands.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  for (let y = 3; y < CH - 3; y++) for (let x = 3; x < CW - 3; x++) if (!isIsland(x, y)) floor.add(`${x},${y}`);
  // 맵 바깥 어둠(void)도 모양 맞출 때는 벽으로 본다 — 바깥 테 벽이 허공을 향해 앞면·옆면을 그리지 않고 윗면으로 끝난다(적대 검수 L1 N21)
  const isVoid = (x: number, y: number) => x === 0 || y === 0 || x === CW - 1 || y === CH - 1;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) cm.lowerTiles[y * CW + x] = floor.has(`${x},${y}`) ? id(`cave_floor${(x * 3 + y * 5) % 4}`) : wallFull;
  const cpts: { x: number; y: number }[] = [];
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) cpts.push({ x, y });
  shapeAllAutotileGroupsAround({ width: CW, height: CH, lowerTiles: cm.lowerTiles, upperTiles: cm.upperTiles }, groups, cpts);
  shadeAutotileInterior({ width: CW, height: CH, lowerTiles: cm.lowerTiles }, g("cave_wall"));
  // 곧은 남쪽 앞면(마스크 155)은 주름 변형 셋을 칸 위치 해시로 섞는다 — 한 칸 주기가 맵 너비에 이어지지 않게(적대 검수 L2 N28)
  const face155 = g("cave_wall").variantMap["155"];
  const faces = [face155, id("cave_wall_face1"), id("cave_wall_face2")];
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (cm.lowerTiles[y * CW + x] === face155) cm.lowerTiles[y * CW + x] = faces[(x * 7 + y * 3 + ((x * y) >> 1)) % 3];
  // 곧은 변(북 110 · 동서 55/205)과 벽 속(mid·deep)도 윗면 잔돌 배치 셋을 섞는다 — 칸 해시로 고르되 앞 이웃(가로 줄은 왼쪽, 세로 줄은 위)과
  // 같은 배치는 피한다(통합 I3 Z2: 곧은 변 17칸이 한 높이 잔돌의 리벳 점선, 섬 속이 mid0 만 이어져 격자로 보였다 — 엔진 해시가 mid0 을 몰아 줄 때가 있다).
  {
    const hh = (x: number, y: number) => { let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 0x5bd1e9; n = Math.imul(n ^ (n >>> 13), 1274126177); return (n ^ (n >>> 16)) >>> 0; };
    const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < CW && y < CH ? cm.lowerTiles[y * CW + x] : -1);
    const vm = g("cave_wall").variantMap;
    const fams: number[][] = [
      [vm["110"], id("cave_wall_top110_1"), id("cave_wall_top110_2")],
      [vm["55"], id("cave_wall_side55_1"), id("cave_wall_side55_2")],
      [vm["205"], id("cave_wall_side205_1"), id("cave_wall_side205_2")],
      [0, 1, 2].map((v) => id(`cave_wall_mid${v}`)),
      [0, 1, 2].map((v) => id(`cave_wall_deep${v}`)),
    ];
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const i = y * CW + x, fam = fams.find((q) => q.includes(cm.lowerTiles[i]));
      if (!fam) continue;
      const near = new Set([at(x - 1, y), at(x, y - 1)]);
      let c = hh(x, y) % 3;
      for (let k = 0; k < 3 && near.has(fam[c]); k++) c = (c + 1) % 3;
      cm.lowerTiles[i] = fam[c];
    }
  }
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (isVoid(x, y)) cm.lowerTiles[y * CW + x] = id("cave_void");
  const wallSet = new Set(g("cave_wall").memberTileIds);
  for (let y = 1; y < CH; y++) for (let x = 0; x < CW; x++) {
    if (!floor.has(`${x},${y}`)) continue;
    if (wallSet.has(cm.lowerTiles[(y - 1) * CW + x])) cm.lowerTiles[y * CW + x] = id("cave_floor_s");
  }
  const set = (x: number, y: number, n: string) => { cm.lowerTiles[y * CW + x] = id(n); };
  const up = (x: number, y: number, n: string) => { cm.upperTiles[y * CW + x] = id(n); };
  const sandCells: { x: number; y: number }[] = [];
  const sandFull = g("cave_sand").variantMap["255"];
  const sand = (x0: number, y0: number, x1: number, y1: number) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (floor.has(`${x},${y}`) && cm.lowerTiles[y * CW + x] !== id("cave_floor_s")) { cm.lowerTiles[y * CW + x] = sandFull; sandCells.push({ x, y }); } };
  // 모래는 사각 합이 아니라 흔들린 타원 덩이로 깐다 — 원작 동굴 모래도 둥근 얼룩이다
  const blob = (cx: number, cy: number, rx: number, ry: number, seed: number) => {
    const cells = new Set<string>();
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const a = Math.atan2(y - cy, x - cx); const k = 1 + 0.18 * Math.sin(a * 3 + seed) + 0.1 * Math.sin(a * 5 + seed * 2);
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= k * k) cells.add(`${x},${y}`);
    }
    // 한 칸짜리 돌기는 뺀다: 이웃 둘 미만이거나, 한 축으로 1칸 폭(좌우가 다 비었거나 위아래가 다 빈 칸) — 덩이 끝에 가시가 돋지 않게(L1 N20)
    const has = (x: number, y: number) => cells.has(`${x},${y}`);
    const thin = (x: number, y: number) => (!has(x - 1, y) && !has(x + 1, y)) || (!has(x, y - 1) && !has(x, y + 1));
    const n4 = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => has(x + dx, y + dy)).length;
    for (let pass = 0; pass < 3; pass++) for (const c of [...cells]) { const [x, y] = c.split(",").map(Number); if (n4(x, y) < 2 || thin(x, y)) cells.delete(c); }
    for (const c of cells) { const [x, y] = c.split(",").map(Number); sand(x, y, x, y); }
  };
  blob(4.2, 7, 1.8, 1.6, 1); blob(24.5, 6.2, 3.6, 1.6, 2); blob(27.5, 17.2, 3.2, 1.5, 3); blob(9.5, 15, 1.2, 1.9, 4);
  // 돌기 정리를 실제로 칠한 칸에 한 번 더 — sand() 가 벽 밑 그늘 줄을 건너뛰어 옆 칸이 비면 1칸 기둥이 남는다(L2 N33)
  {
    const on = new Set(sandCells.map((c) => `${c.x},${c.y}`));
    const has = (x: number, y: number) => on.has(`${x},${y}`);
    for (let pass = 0; pass < 3; pass++) for (const c of [...on]) {
      const [x, y] = c.split(",").map(Number);
      const thin = (!has(x - 1, y) && !has(x + 1, y)) || (!has(x, y - 1) && !has(x, y + 1));
      if (thin) { on.delete(c); cm.lowerTiles[y * CW + x] = id(`cave_floor${(x * 3 + y * 5) % 4}`); }
    }
    sandCells.splice(0, sandCells.length, ...[...on].map((c) => { const [x, y] = c.split(",").map(Number); return { x, y }; }));
  }
  shapeAllAutotileGroupsAround({ width: CW, height: CH, lowerTiles: cm.lowerTiles, upperTiles: cm.upperTiles }, [g("cave_sand")], sandCells);
  set(9, 5, "hole_down"); set(12, 3, "ladder_up"); set(15, 11, "cave_pebbles0"); set(16, 11, "cave_pebbles1"); set(15, 10, "cave_pebbles0");   // 사다리는 벽 바로 아래 바닥 칸에 기댄다(L1 N4) · 잔돌 셋(L2 N40 — 주석에 먹혀 있었다)
  const devices: [number, number, string][] = [[19, 9, "cracked_rock"], [19, 18, "cracked_rock"], [22, 18, "cave_boulder"]];
  const under = new Map(devices.map(([x, y]) => [`${x},${y}`, cm.lowerTiles[y * CW + x]]));
  for (const [x, y, n] of devices) set(x, y, n);
  set(10, 12, "cave_pebbles1"); set(18, 14, "cave_pebbles0");
  set(8, 15, "cave_pebbles1"); set(19, 15, "cave_pebbles0"); set(12, 12, "cave_pebbles1");
  writeFileSync(`${dir}/verify-cave.json`, JSON.stringify({ width: CW, height: CH, lower: cm.lowerTiles, upper: cm.upperTiles }));
  // 장치 시험(통합 I4 W3): 사다리 밑 (12,4) 에서 — 장치가 있으면 그 방에 못 가고, 장치를 치우면(깨기·밀기) 간다
  {
    const m: any = { id: "c", name: "c", width: CW, height: CH, tilesetId: ts.id, tileSize: 16, lowerTiles: cm.lowerTiles, upperTiles: cm.upperTiles, events: [] };
    const pj: any = { tilesets: { [ts.id]: ts }, maps: { c: m }, database: { terrains: [] } };
    const reach = (tx: number, ty: number) => {
      const seen = new Set(["12,4"]), q: [number, number][] = [[12, 4]];
      while (q.length) {
        const [x, y] = q.shift()!;
        if (x === tx && y === ty) return true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
          if (seen.has(k) || !canMove(pj, m, x, y, nx, ny)) continue;
          seen.add(k); q.push([nx, ny]);
        }
      }
      return false;
    };
    const clear = (cells: [number, number][]) => { const keep = cells.map(([x, y]) => cm.lowerTiles[y * CW + x]); for (const [x, y] of cells) cm.lowerTiles[y * CW + x] = under.get(`${x},${y}`); return () => cells.forEach(([x, y], i) => { cm.lowerTiles[y * CW + x] = keep[i]; }); };
    const tests: [string, [number, number][], [number, number]][] = [
      ["깨기 바위 (19,9) → 북동 방", [[19, 9]], [28, 6]],
      ["깨기 바위 (19,18) + 밀 바위 (22,18) → 남동 방", [[19, 18], [22, 18]], [29, 17]],
    ];
    for (const [what, cells, [tx, ty]] of tests) {
      const before = reach(tx, ty);
      const partial = cells.map((c) => { const undo = clear([c]); const r = reach(tx, ty); undo(); return r; });
      const undo = clear(cells); const after = reach(tx, ty); undo();
      console.log(`동굴 ${what}: 장치 없이(그대로) 도달 ${before} · 하나씩만 치움 ${partial.join("/")} · 다 치움 ${after}`);
      if (before || partial.some((r) => r && cells.length > 1) || !after) process.exit(1);
    }
  }
}
console.log("ok");
