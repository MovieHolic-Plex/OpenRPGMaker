/** 해안 시트 쇼케이스·검사. bash cycle_theme.sh monster-coast <run> */
import { Kit, type Cell } from "./kitlib.mts";
import { kitSheet, roundTall } from "./wild_round.mts";   // 정본 둥근 귀 풀숲 배치(감독 결정 I4 W2)
const k = new Kit(process.argv[2]);
const rs = kitSheet(k);
const grass = (x: number, y: number) => `grass${(x * 7 + y * 13 + ((x * y) % 5)) % 4}`;
const sand = (x: number, y: number) => `sand${(x * 7 + y * 13) % 2}`;
const R = (x0: number, y0: number, x1: number, y1: number) => [...k.rect(x0, y0, x1, y1)];

// 울타리(위층 fence_at<마스크>): 집합 안 이웃 방향으로 이어 그린다
const fence = (f: ReturnType<typeof k.field>, cells: Cell[]) => {
  const has = new Set(cells.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of cells) f.up(x, y, `fence_at${(has.has(`${x},${y - 1}`) ? 1 : 0) | (has.has(`${x + 1},${y}`) ? 2 : 0) | (has.has(`${x},${y + 1}`) ? 4 : 0) | (has.has(`${x - 1},${y}`) ? 8 : 0)}`);
};
const WATER_PROPS = ["searock", "sea_whirl", "buoy", "reef", "searock_big", "searock_big_m", "searock_dome", "rockmass", "sailboat", "rowboat"];
// 둔치 돌계단: 모래 둔치(bsand) 테두리 줄 [x0, x1] 을 끊는다(끝 칸은 갓돌 볼)
const steps = (f: ReturnType<typeof k.field>, y: number, x0: number, x1: number) => {
  for (let x = x0; x <= x1; x++) {
    const part = x === x0 ? "l" : x === x1 ? "r" : "m";
    f.lo(x, y, `seawall_steps_${part}`); f.lo(x, y + 1, `seawall_stepfoot_${part}`);   // 맨 아래 단은 모래 칸 위로 튀어나온다
  }
};

// 견본 지형 구역 예약: 칸을 물체 겹침 장부(occ)에 올려, 뒤에 찍는 물체가 그 지형을 덮으면 kitlib 겹침 관문이 실패시킨다
// (적대 검수 L4 N1 — 건물 줄이 둔치·돌계단 견본을 지웠는데 겹침 관문은 물체끼리만 봤다). 지형을 다 깐 뒤, 물체를 찍기 전에 부른다.
const reserve = (f: ReturnType<typeof k.field>, label: string, cells: Iterable<Cell>) => { for (const [x, y] of cells) f.claim(`견본 지형 ${label}`, x, y); };

// ---- 항구 도시(무역항 문법) 34×28: 북쪽 숲 입구 → 포장길 → 분수 광장·울타리 시장·동상 정원 → 동쪽 산책로·부두 항구(잔교 둘·정박한 배) →
//      산책로에 붙은 등대 부두 + 4칸 항구 입구 → 높은 마을 둘레의 갓돌 테두리, 돌계단 아래 해변 ----
{
  const f = k.field("port", 34, 28, grass, 3);
  const trees = new Set<string>();
  for (let i = 0; i <= 10; i++) if (i !== 5) trees.add(`${i},0`);   // 숲은 2×2 덩이 좌표(i,j) — 칸 (2i,2j)
  for (let j = 0; j <= 8; j++) trees.add(`0,${j}`);
  // 낮은 땅(모래 둔치): 19행이 높은 마을 바로 밑(테두리 줄), 등대 부두 서쪽 (25,19–20)은 세로 테두리
  const sandCells: Cell[] = [...R(0, 19, 24, 22), [25, 19], [25, 20], [25, 21], ...R(9, 23, 12, 23), ...R(3, 23, 4, 23)];   // (25,21) = 등대 부두 남서 바깥 모서리(갓돌 기둥, L3 N4)
  const sand = new Set(sandCells.map(([x, y]) => `${x},${y}`));
  f.paint("bsand", sandCells);
  const pier = new Set(R(26, 13, 29, 20).map(([x, y]) => `${x},${y}`));
  const seaCells: Cell[] = [];
  for (let y = 19; y < 28; y++) for (let x = 0; x < 34; x++) if (!sand.has(`${x},${y}`) && (x < 26 || y >= 22)) seaCells.push([x, y]);
  f.paint("shore", seaCells);
  f.paint("quay", R(26, 0, 33, 21).filter(([x, y]) => !pier.has(`${x},${y}`)));
  f.paint("pave", [...R(10, 0, 11, 10), ...R(2, 9, 25, 10), ...R(3, 8, 4, 8), ...R(14, 8, 15, 8), ...R(19, 8, 20, 8), ...R(16, 11, 21, 13), ...R(22, 0, 25, 18),
    ...R(26, 13, 29, 20), ...R(2, 11, 11, 17), ...R(16, 14, 18, 18), ...R(11, 17, 18, 18)]);   // 시장 마당 포장을 x=11 까지 — 울타리(x=10)와 집 터 풀 사이 1칸(L6 N3)
  // 건물은 원작 비례 4×4·문 1칸(통합 I4 W1). 문 줄(7행)을 옛 6×6 과 같게 두려고 4행에 앉히고, 위 두 줄은 숲 벽 밑 풀 띠로 둔다.
  // 옛 센터가 덮던 동쪽 자리(17..21)엔 민가 하나를 더 세워 문 셋이 한 줄로 길을 보는 원작 마을 줄(Oldale·Slateport 북쪽 줄)을 만든다.
  f.stamp("mart", 2, 4); f.stamp("center", 13, 4); f.stamp("house_a", 18, 4); f.stamp("house_g", 12, 13);
  f.paint("pave", [[3, 7], [14, 7], [19, 7], [13, 16]]);           // 문 칸 밑에만 포장(문 칸 아래층은 비어 있다 — 옆 벽 칸 아래층은 건물 조각)          // 문 줄 밑에도 포장 — 문턱 아래 투명 2px 에 풀이 비치고 길 윗변 연석이 생기던 것(L6 N2)   // 집 터를 시장 울타리에서 한 칸 띄움(L5 N5)   // 마트는 본 시트 Mart(이름 mart)를 물려받는다(적대 검수 L2 N9)
  f.shape(["shore", "quay", "pave", "bsand"]);                     // 건물을 먼저 찍어 포장이 건물 밑동에 풀 테를 안 그리게(connectTiles, L2 N6)
  steps(f, 19, 15, 18);                                             // 광장 남쪽 테두리를 끊은 돌계단
  reserve(f, "돌계단", R(15, 19, 18, 20)); reserve(f, "등대 부두 남서 모서리", [[25, 19], [25, 20], [25, 21]]);
  const piers: [number, number, number][] = [[4, 26, 30], [9, 26, 30]];
  for (const [y, x0, x1] of piers) {
    for (let x = x0; x <= x1; x++) { f.lo(x, y, "dock_h"); f.lo(x, y + 1, "dock_h"); if (x > x0) f.up(x, y + 2, "dock_post"); }
  }
  f.stamp("tree_b", 8, 3);                                          // 2×4 숲 수관 나무: 윗줄이 숲 벽(0~1행 덩이의 아래 조각)에 지워지지 않게 한 칸 내림(통합 I2 Y1)
  for (const [x, y, n] of [[8, 7, "flowerbed_red"], [9, 7, "flowerbed_yellow"]] as [number, number, string][]) f.lo(x, y, n);
  f.stamp("fountain", 17, 10);
  const yard: Cell[] = [];
  for (let x = 2; x <= 10; x++) { if (x !== 5 && x !== 6) yard.push([x, 11]); yard.push([x, 17]); }
  for (let y = 12; y <= 16; y++) { yard.push([2, y]); yard.push([10, y]); }
  fence(f, yard);
  f.stamp("tent_blue", 3, 13); f.stamp("tent_orange", 7, 13);
  f.up(3, 12, "barrel.0.0"); f.up(4, 12, "jar_b.0.0"); f.up(5, 12, "jar_c.0.0"); f.up(8, 12, "jar_a.0.0"); f.up(9, 12, "crate.0.0");
  f.up(3, 15, "basket_fish.0.0"); f.up(4, 15, "jar_a.0.0"); f.up(9, 15, "basket_fruit.0.0"); f.up(8, 15, "basket_fish.0.0");
  f.up(3, 16, "crate.0.0"); f.up(4, 16, "barrel.0.0"); f.up(8, 16, "jar_c.0.0"); f.up(9, 16, "crate.0.0");
  for (const [x, y, n] of [[3, 18, "flowerbed_red"], [4, 18, "flowerbed_yellow"], [8, 18, "flowerbed_yellow"], [9, 18, "flowerbed_red"]] as [number, number, string][]) f.lo(x, y, n);
  // 동상 정원(연석 두른 잔디): 동상 + 네 귀 꽃밭
  f.stamp("statue", 20, 15);
  for (const [x, y] of [[19, 14], [21, 14], [19, 18], [21, 18], [21, 17]] as Cell[]) f.lo(x, y, (x + y) % 2 ? "flowerbed_red" : "flowerbed_yellow");
  f.stamp("bench", 16, 13); f.stamp("bench", 20, 13);
  for (const [x, y] of [[12, 7], [17, 6]] as Cell[]) f.stamp("lamp", x, y);   // 센터와 민가 사이 1칸 틈에 가로등
  // 지붕 위 풀 띠(2..3행)와 마트 동쪽 틈: 숲 벽 밑 꽃 몇 송이(원작 마을 건물 뒤 풀 띠)
  for (const [x, y, n] of [[3, 2, "flower_white"], [5, 3, "flower_white"], [14, 3, "flower_white"], [20, 2, "flower_white"], [6, 7, "flowerbed_yellow"], [7, 7, "flowerbed_red"]] as [number, number, string][]) f.lo(x, y, n);
  for (const [x, y, n] of [[12, 11, "flowerbed_red"], [13, 11, "flowerbed_yellow"], [14, 11, "flowerbed_red"], [15, 11, "flowerbed_yellow"]] as [number, number, string][]) f.lo(x, y, n);   // 집 터 뒤 꽃밭 줄(옛 5×5 집이 덮던 자리)
  for (const y of [3, 7, 12, 16]) f.up(25, y, "bollard.0.0");
  f.up(23, 5, "crate.0.0"); f.up(23, 6, "crate.0.0"); f.up(22, 6, "barrel.0.0"); f.stamp("net_rack", 22, 13); f.up(23, 12, "basket_fish.0.0");
  f.stamp("sailboat", 31, 3); f.stamp("sailboat", 31, 8); f.stamp("rowboat", 31, 12);
  f.stamp("lighthouse", 27, 14);
  f.up(29, 20, "bollard.0.0"); f.up(26, 20, "bollard.0.0");
  f.stamp("palm", 2, 20); f.stamp("palm", 19, 20);
  f.stamp("parasol_red", 6, 20); f.stamp("deckchair", 8, 20); f.stamp("airmat_teal", 10, 20);
  f.stamp("parasol_blue", 21, 21); f.stamp("towel_red", 11, 21); f.up(13, 21, "beachball.0.0"); f.up(14, 22, "bucket.0.0"); f.up(24, 22, "swimring.0.0");
  f.up(8, 8, "sign");
  // 앞바다 바위는 R109 처럼 2×2 가 기본(I4 W3 — 1×1 은 옆 2×2 dome 의 반도 안 돼 조약돌로 읽혔다). 1칸 곁돌은 큰 바위 바로 곁에만.
  f.stamp("searock_big_m", 5, 25); f.stamp("searock_dome", 26, 24);
  f.stamp("searock_dome", 13, 26); f.up(15, 27, "searock.0.0");
  f.up(9, 26, "sea_whirl.0.0"); f.stamp("reef", 17, 24); f.stamp("searock_big", 21, 25);
  f.up(29, 24, "buoy.0.0"); f.up(32, 23, "buoy.0.0");
  f.forest(trees);
  f.save();
  k.onWater(f, WATER_PROPS, ["shore", "quay"]);
  k.noSpecks(f, "shore", ["quay"]); k.noSpecks(f, "quay", ["shore"]);
  const start: Cell = [10, 0];
  k.expectReach(f, start, [[14, 7], [3, 7], [19, 7], [13, 16]], "북쪽 입구 → 센터·마트·민가 둘 문");
  k.expectReach(f, start, [[5, 15], [6, 12]], "시장 문 → 천막 앞");
  k.expectReach(f, start, [[30, 4], [30, 9]], "산책로 → 잔교 두 끝(배가 대어 있다)");
  k.expectReach(f, start, [[28, 18], [16, 21], [12, 20], [5, 22]], "산책로 → 등대 문 · 돌계단 → 해변");
  k.expectNoReach(f, start, [[28, 7], [31, 18], [20, 26], [33, 16]], "항구 물·항구 입구·바다는 걸어 들어갈 수 없다");
  k.expectNoReach(f, [5, 21], [[5, 18], [23, 18], [26, 20]], "둔치 테두리는 모래에서 기어오를 수 없다(계단으로만)", { blocked: R(15, 19, 18, 19) });
  k.describe(f, "항구 도시(무역항 문법): 북쪽 숲 입구 → 포장 동서 길 → 분수 광장·울타리 시장 마당(천막 둘 사이 통로, 항아리·바구니·상자)·동상 정원·센터·마트·민가(센터·마트·민가는 원작 비례 4×4·문 1칸, 문 칸 밑과 문 앞에 포장 꼬리). 동쪽 산책로의 갓돌 곁에 계선주, 잔교 둘 끝에 돛배. 등대 부두는 산책로에 붙어 남쪽으로 나오고, 그 동쪽 4칸이 항구 입구다(quay ↔ shore 는 connectGroups 로 이어진다). 마을(풀·포장)은 모래·물보다 한 단 높다 — 물 쪽은 부두 물(quay), 모래 쪽은 모래 둔치(bsand)로 칠하면 두 그룹이 같은 테두리(흰 갓돌 블록 8px + 갈색 밑돌 4px)를 낮은 칸 쪽에 그린다. 둔치는 테두리 쪽으로 막히고, 테두리를 끊은 돌계단(seawall_steps_*)으로만 오르내린다. 잔교 칸은 물로 칠해 모양을 잡은 뒤 널빤지로 덮고, 잔교 남쪽 물 칸 위층에 기둥(dock_post, 첫 칸 제외).");
  k.negative(f, "door-blocked", "센터 문 앞 칸에 물체를 놓아 입구가 막힘", (g) => g.up(14, 8, "barrel.0.0"), start, [[14, 7]]);
  k.negative(f, "pier-cut", "산책로와 잔교 사이를 물로 끊음(잔교 첫 칸을 널빤지 없이 둠)", (g) => { g.lo(26, 4, "quay_at255_f0"); g.lo(26, 5, "quay_at255_f0"); }, start, [[30, 4]]);
  k.negative(f, "breakwater-cut", "등대 부두와 산책로 사이를 물로 끊어 등대에 못 감", (g) => { for (const [x, y] of R(26, 13, 26, 20)) g.lo(x, y, "quay_at255_f0"); }, start, [[28, 18]]);
}

// ---- 해변 바닷길(109번 도로 문법) 26×34: 위쪽 모래 반도(바닷가 집·파라솔 묶음)가 들쭉날쭉 좁아진다 → 바위·잠긴 바위 줄이 양옆 벽 → 모래 섬 ----
{
  const f = k.field("beach", 26, 34, sand, 3);
  const spans: Record<number, [number, number]> = {
    0: [4, 20], 1: [3, 21], 2: [4, 22], 3: [4, 21], 4: [3, 21], 5: [5, 22], 6: [5, 21], 7: [6, 20], 8: [6, 19], 9: [7, 19], 10: [7, 18], 11: [8, 17], 12: [9, 16], 13: [10, 14],
    17: [16, 18], 18: [15, 19], 19: [15, 20], 20: [15, 19], 21: [16, 19], 22: [16, 18],
    25: [4, 6], 26: [3, 6], 27: [4, 5],
    29: [9, 15], 30: [8, 15], 31: [8, 16], 32: [7, 17], 33: [8, 16],
  };
  const land = (x: number, y: number) => !!spans[y] && x >= spans[y][0] && x <= spans[y][1];
  const sea: Cell[] = [];
  for (let y = 0; y < 34; y++) for (let x = 0; x < 26; x++) if (!land(x, y)) sea.push([x, y]);
  f.paint("shore", sea); f.shape(["shore"]);
  // 가운데 물길의 잠수 자리: 깊은 바다 그룹(deep)을 행마다 폭이 다른 덩이로 칠한다 — 귀 반지름 3·5 + 중간 톤 2px 테(L5 N2·L6 N1)
  const dive: Cell[] = [...R(10, 15, 11, 15), ...R(9, 16, 12, 16), ...R(9, 17, 13, 17), ...R(10, 18, 13, 18), ...R(10, 19, 12, 19)];   // 땅에서 1칸 이상 띄운다
  f.paint("deep", dive); f.shape(["shore"]);
  f.stamp("house_b", 6, 1); f.up(5, 3, "sign");
  for (const [n, x, y] of [["parasol_red", 12, 0], ["parasol_blue", 16, 0], ["parasol_green", 19, 2], ["parasol_red", 11, 5], ["parasol_blue", 15, 4],
    ["parasol_green", 8, 7], ["parasol_blue", 13, 8], ["parasol_red", 17, 7], ["parasol_green", 10, 10], ["parasol_red", 14, 11],
    ["parasol_blue", 15, 19], ["parasol_green", 11, 30]] as [string, number, number][]) f.stamp(n, x, y);
  for (const [x, y] of [[14, 0], [15, 0], [13, 4], [14, 4], [10, 7], [11, 7], [19, 5], [20, 5], [15, 8], [16, 8], [19, 19], [13, 31]] as Cell[]) f.stamp("deckchair", x, y);
  f.stamp("towel_red", 18, 0); f.stamp("towel_blue", 6, 7); f.stamp("towel_red", 12, 9);
  f.stamp("airmat_teal", 21, 1); f.stamp("airmat_pink", 11, 1);
  f.up(17, 3, "beachball.0.0"); f.up(16, 3, "bucket.0.0"); f.up(12, 12, "swimring.0.0");
  f.stamp("palm", 17, 16); f.stamp("palm", 4, 25); f.up(3, 26, "sandrock.0.0");   // 남서 작은 섬 = 야자 한 그루 바위섬(L3 N11)
  f.stamp("palm", 9, 29); f.up(15, 31, "beachball.0.0"); f.stamp("towel_blue", 8, 31);
  f.stamp("rowboat", 12, 20); f.stamp("sailboat", 19, 27);
  f.up(8, 16, "buoy.0.0"); f.up(13, 24, "buoy.0.0");
  // 양옆 바위 벽(109번 도로 문법): 2×2 원뿔 바위·잠긴 바위·1칸 바위가 사선으로 들락날락하는 줄(맵 끝에서 0~3칸), 한쪽에 3×3 바위산 둘.
  // 양쪽은 다른 난수 씨앗과 다른 바위산 자리로 — 좌우 대칭 복사본이 되지 않게(적대 검수 L1 N5). 땅에서 1칸은 띄운다(물가 거품 위에 안 걸리게).
  const free = (x: number, y: number, w: number, h: number) => {
    for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
      const inner = xx >= x && xx < x + w && yy >= y && yy < y + h;
      if (inner && (!f.in(xx, yy) || f.occ.has(`${xx},${yy}`))) return false;
      if (f.in(xx, yy) && land(xx, yy)) return false;
    }
    return true;
  };
  const big = new Set<string>();                                    // 2×2 이상 바위(잠긴 바위 reef 제외)가 차지한 칸
  // 곁돌 자리: 큰 바위 바로 옆(같은 행 좌우, 밑동이 같은 물선) — 발치(바로 밑)에 둔 1칸은 다음 바위와 세로 기둥으로 쌓여 읽혔다(c102 시험).
  const nearBig = (x: number, y: number) => big.has(`${x - 1},${y}`) || big.has(`${x + 1},${y}`);
  const rng = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (const [side, seed, masses] of [["w", 7, [8, 27]], ["e", 31, [13, 20]]] as [string, number, number[]][]) {
    const r = rng(seed); let y = side === "w" ? 1 : 0, off = side === "w" ? 1 : 0, last = "", prev = ""; const todo = [...masses];
    while (y < 33) {
      const pick = r(); let n = pick < 0.36 ? "searock_big" : pick < 0.7 ? "searock_big_m" : "searock_dome", w = 2, h = 2;   // 큰 바위 하나(dome)도 섞는다(I3 Z5)
      if (todo.length && y >= todo[0]) { n = "rockmass"; w = 3; h = 3; }
      else { const p = r(); if (p < 0.22) { n = "reef"; } else if (p < 0.34) { n = "searock"; w = 1; h = 1; } else if (p < 0.45) { n = "searock_dome"; } else if (p < 0.55) { n = "sea_whirl"; w = 1; h = 1; } }
      if (/^searock_(big|dome)/.test(n) && /^searock_(big|dome)/.test(last)) { n = r() < 0.5 ? "searock" : "reef"; if (n === "searock") { w = 1; h = 1; } }   // 쌍 바위를 세로로 잇대지 않는다(L3 N3)
      if (n === "reef" && last === "reef") n = r() < 0.5 ? "searock_dome" : "searock_big";   // 잠긴 바위도 세로로 둘 붙이지 않는다(같은 고리가 기둥처럼 쌓였다)
      if (n === "searock_dome" && prev === "searock_dome") n = last === "rockmass" ? "reef" : "searock_big_m";   // 큰 바위 하나는 한 칸 걸러서도 되풀지 않는다
      if (w === 1 && (last === "searock" || last === "sea_whirl")) { n = r() < 0.5 ? "reef" : "searock_big_m"; w = 2; h = 2; }   // 홑 바위도 세로로 둘 붙이지 않는다(L4 N5)
      const want = Math.round(1.5 + 1.5 * Math.sin((2 * Math.PI * (y + (side === "w" ? 0 : 5))) / 15));   // 사선 물결: 15행 주기로 0~3칸 안팎을 오간다
      off = Math.min(off + 1, want);
      while (off > 0 && !free(side === "w" ? off : 26 - w - off, y, w, h)) off--;
      let x = side === "w" ? off : 26 - w - off;
      // 1칸 바위는 큰 바위 바로 옆에서만 곁돌로 읽힌다 — 홀로 뜬 1칸은 2×2 dome 의 반도 안 돼 조약돌이었다(I4 W3, R109 는 2×2 리듬).
      // 곁에 2×2 이상 바위가 없으면 2×2 로 키우고(같은 자리·같은 바깥 붙음), 2×2 가 안 들어가면 놓지 않는다.
      if (n === "searock" && !nearBig(x, y)) {
        const nx = side === "w" ? off : 26 - 2 - off;
        if (free(nx, y, 2, 2) && y + 2 <= 34) { n = /^searock_dome/.test(last) || prev === "searock_dome" ? "searock_big_m" : "searock_dome"; w = 2; h = 2; x = nx; }
        else n = "";
      }
      if (n && y + h <= 34 && free(x, y, w, h)) {
        if (w === 1) f.up(x, y, `${n}.0.0`); else f.stamp(n, x, y);
        if (w >= 2 && n !== "reef") for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) big.add(`${xx},${yy}`);
        prev = last; last = n;
        if (n === "rockmass") todo.shift();
        y += h - (h > 1 && r() < 0.35 ? 1 : 0);                     // 다음 바위가 반 칸 겹쳐 올라오면 줄이 끊김 없이 이어진다
        if (r() < 0.12) y += 1;                                     // 가끔 한 칸 틈(물길)
      } else y++;
    }
  }
  f.save();
  k.onWater(f, WATER_PROPS, ["shore", "deep"]);
  k.noSpecks(f, "shore", ["deep"]); k.noSpecks(f, "deep", ["shore"]);
  k.expectReach(f, [12, 2], [[12, 13], [20, 4], [7, 5]], "반도 위 → 반도 끝 · 바닷가 집 문 앞");
  k.expectNoReach(f, [12, 2], [[17, 20], [12, 31], [5, 26]], "섬은 파도타기 없이 못 간다");
  k.describe(f, "해변 바닷길(109번 도로 문법): 위 모래 반도(바닷가 집·파라솔과 의자 짝 묶음·수건·에어매트)가 2~4칸마다 들쭉날쭉하며 좁아지고, 양옆 바다 가장자리에 깎인 면 바위(원뿔 쌍 searock_big·searock_big_m, 큰 바위 하나 searock_dome, 3×3 바위산 rockmass — 바위 크기 리듬은 2×2 가 기본, 1칸 searock 은 큰 바위 바로 옆 곁돌로만)와 2×2 잠긴 바위(reef)가 거의 끊김 없는 벽을 이룬다. 모래 섬은 파도타기로만 간다. 바다는 shore 그룹 하나로 칠하고 모래는 바탕. 바다 바위는 물 칸 위에만, 땅 위 바위는 sandrock.");
  k.negative(f, "peninsula-cut", "반도 가운데를 바다로 끊어 끝에 못 감", (g) => { for (let x = 3; x <= 22; x++) { g.lo(x, 6, "shore_at255_f0"); g.map.upperTiles[6 * g.W + x] = -1; } }, [12, 2], [[12, 13]]);
}

// ---- 큰 도시(무지개시티·해변시티 문법) 35×24: 위 줄 여러 층 건물(동마다 다른 지붕·정면) → 포장 광장(잔디 섬·분수·화분·가로등·벤치) →
//      아래 줄 센터·상점·마트 → 남쪽 길, 가운데 남쪽 출구 ----
{
  const f = k.field("city", 35, 24, grass, 3);                      // 35칸: 회관·나무와 둔치 갓돌 사이 풀 1열(x=29, L6 N4)
  const trees = new Set<string>();
  for (let i = 0; i <= 14; i++) trees.add(`${i},0`);
  for (let j = 0; j <= 11; j++) trees.add(`0,${j}`);              // 동쪽 세 줄은 숲 대신 맵 위아래로 열린 항구 물(해안 도시 단서, L3 N9·L4 N7)
  const lawn = new Set(R(5, 11, 10, 14).map(([x, y]) => `${x},${y}`));
  f.paint("pave", [...R(2, 10, 29, 15).filter(([x, y]) => !lawn.has(`${x},${y}`)), ...R(15, 16, 16, 23), ...R(3, 22, 29, 22)]);
  f.paint("quay", R(30, 0, 34, 23));                               // 동쪽 항구 물 다섯 줄(L5 N6)
  f.shape(["pave", "quay"]);
  f.stamp("office", 2, 3); f.stamp("apart", 8, 3); f.stamp("tree_a", 13, 5); f.stamp("dept", 15, 3); f.stamp("hall", 24, 4);   // 건물 사이 틈엔 숲 수관 나무(2×4) 한 그루 — 위아래로 붙여 쌓지 않는다(통합 2회차)
  f.stamp("center", 2, 17); f.stamp("shop_b", 9, 17); f.stamp("shop_s", 22, 19);   // 센터 4×4·상점 6×4(통합 I4 W1) — 문 줄을 20행으로 맞춘다
  f.paint("pave", [[3, 20], [10, 20], ...R(3, 21, 4, 21), ...R(10, 21, 11, 21)]);   // 문 칸 밑·문 앞 포장 → 남쪽 길(L6 N2)
  f.paint("quay", R(30, 0, 34, 23));                               // 동쪽 항구 물 다섯 줄(L5 N6)
  f.shape(["pave", "quay"]);                                               // 건물을 찍은 뒤 다시 모양을 잡아 건물 밑동 앞 풀 테를 없앤다(L2 N6)
  f.stamp("tree_a", 7, 11);
  for (const [x, y, n] of [[6, 19, "flowerbed_red"], [7, 19, "flowerbed_yellow"], [6, 20, "flowerbed_yellow"], [7, 20, "flowerbed_red"], [7, 17, "flower_white"], [3, 16, "flower_white"]] as [number, number, string][]) f.lo(x, y, n);   // 센터·상점 사이 틈(옛 6×6 센터 자리) = 꽃밭
  for (const [x, y, n] of [[5, 11, "flowerbed_red"], [6, 11, "flowerbed_yellow"], [5, 12, "flowerbed_red"], [10, 11, "flowerbed_yellow"], [10, 12, "flowerbed_red"], [10, 13, "flowerbed_yellow"]] as [number, number, string][]) f.lo(x, y, n);
  for (const [x, y] of [[5, 14], [9, 14], [6, 13]] as Cell[]) f.lo(x, y, "flower_white");
  f.stamp("fountain", 19, 11);
  for (const [x, y] of [[13, 11], [13, 14], [24, 11], [26, 14]] as Cell[]) f.up(x, y, "planter.0.0");   // 분수 기준 거울 대칭을 깬다(적대 검수 L1 N16)
  for (const [x, y] of [[14, 13], [28, 10], [2, 14]] as Cell[]) f.stamp("lamp", x, y);
  f.stamp("bench", 17, 14); f.stamp("bench", 21, 14);
  f.stamp("tree_b", 18, 17); f.lo(17, 20, "flower_pink"); f.lo(20, 20, "flower_pink"); f.lo(17, 19, "flower_white"); f.stamp("tree_a", 27, 18);
  f.up(17, 21, "sign_metal");
  for (const y of [13, 15]) f.up(29, y, "bollard.0.0");          // 광장 동쪽 안벽의 계선주
  f.stamp("rowboat", 31, 12); f.stamp("sailboat", 31, 3); f.up(33, 9, "buoy.0.0"); f.up(32, 18, "buoy.0.0");
  // 남동 잔디 = 작은 공원(적대 검수 L2 N8): 벤치 둘·마트 뒤 꽃밭 줄·흰 꽃
  f.stamp("bench", 21, 17); f.stamp("bench", 20, 21);
  for (const [x, n] of [[23, "flowerbed_red"], [24, "flowerbed_yellow"], [25, "flowerbed_red"], [26, "flowerbed_yellow"]] as [number, string][]) f.lo(x, 17, n);
  k.onWater(f, ["rowboat", "buoy", "sailboat"], ["quay"]);
  for (const [x, y] of [[21, 19], [19, 16], [29, 21]] as Cell[]) f.lo(x, y, "flower_white");   // (28,21) 은 나무 아래 조각(I2 Y2)
  f.forest(trees);
  f.save();
  const start: Cell = [15, 23];
  k.expectReach(f, start, [[5, 9], [10, 9], [19, 9], [26, 9]], "남쪽 출구 → 위 줄 사무실·아파트·백화점·회관 문");
  k.expectReach(f, start, [[3, 20], [10, 20], [24, 21]], "남쪽 길 → 센터·상점·소매점 문");
  k.describe(f, "큰 도시(무지개시티 문법): 위 줄에 평지붕 여러 층 건물 — 동마다 지붕 막 색·계단실 자리·옥상 간판·정면(가운데 유리 탑·세로 간판·기둥·현관 차양)이 다르다. 건물 사이 틈은 나무로 막는다. 그 앞 포장 광장 가운데에 연석 두른 잔디 섬(나무·꽃밭)과 분수·화분·가로등·벤치, 아래 줄 센터·상점·작은 마트는 남쪽 길을 바라본다. 출구는 남쪽 가운데. 건물 문은 맨 아래 줄, 문 앞 칸은 비운다.");
  k.negative(f, "door-blocked", "백화점 문 앞에 화분을 놓음", (g) => g.up(19, 10, "planter.0.0"), start, [[19, 9]]);
}

// ---- 도감 ----
{
  const f = k.field("catalog", 30, 38, sand, 3);                    // 38줄: 깊은 물 견본 밑에 바다 2줄(경계 칸이 다 보여야 견본, L6 N5)
  // 높은 단 견본: 포장·풀 단을 모래 둔치(bsand)가 둘러 사방 갓돌 테두리(안·바깥 모서리 포함), 아래 돌계단
  const land = new Set([...R(2, 13, 11, 15)].map(([x, y]) => `${x},${y}`));
  f.paint("bsand", R(0, 0, 29, 29).filter(([x, y]) => !land.has(`${x},${y}`)));
  f.paint("pave", R(2, 13, 7, 15));
  for (const [x, y] of R(8, 13, 11, 15)) f.lo(x, y, grass(x, y));
  // 풀 단 위 키 큰 풀 덩이 견본(2×2): 둘레 잎끝(남 s·동 e·서 w)을 얹고 save 직전 정본 roundTall 이 바깥 귀를 둥글게 깎는다(I4 W2)
  for (const [x, y] of R(9, 13, 10, 14)) f.lo(x, y, `tall${(x + y) % 2}`);
  for (const x of [9, 10]) f.up(x, 15, "tall_fringe_s");
  for (const y of [13, 14]) { f.up(11, y, "tall_fringe_e"); f.up(8, y, "tall_fringe_w"); }
  f.paint("shore", k.rect(0, 30, 29, 37));
  f.paint("deep", [...R(25, 32, 27, 32), ...R(24, 33, 28, 34), ...R(25, 35, 27, 35)]);   // 깊은 바다 견본(곧은 변 + 귀 반지름 3·5 + 중간 톤 2px 테)
  f.shape(["shore", "bsand"]);
  steps(f, 16, 4, 6);
  reserve(f, "둔치·돌계단 견본", R(0, 12, 12, 17));               // 아래 물체 줄이 견본을 덮으면 겹침 관문이 실패한다(L4 N1)
  let x = 1, y = 1, rowH = 0;
  const put = (n: string) => { const o = k.obj(n); if (x + o.width > 29) { x = 1; y += rowH + 1; rowH = 0; } f.stamp(n, x, y); x += o.width + 1; rowH = Math.max(rowH, o.height); };
  for (const n of ["parasol_red", "parasol_blue", "parasol_green", "deckchair", "towel_red", "towel_blue", "airmat_teal", "airmat_pink", "palm", "tent_blue", "tent_orange", "lighthouse", "statue", "lamp", "bench", "fountain", "net_rack",
    "swimring", "beachball", "bucket", "basket_fish", "basket_fruit", "jar_a", "jar_b", "jar_c", "sandrock", "bollard", "crate", "barrel", "planter"]) put(n);
  // 건물: 둔치 견본 오른쪽(14~)과 그 아래 줄(19~) — 자리를 손으로 정한다(자동 줄바꿈이 견본 위로 내려앉았다)
  for (const [n, bx, by] of [["dept", 14, 13], ["apart", 24, 13], ["office", 1, 21], ["hall", 8, 21], ["shop_s", 14, 21]] as [string, number, number][]) {
    f.stamp(n, bx, by); y = Math.max(y, by); rowH = Math.max(rowH, k.obj(n).height);
  }
  k.check(y + rowH <= 30, `catalog: 물체가 바다(30행)까지 내려온다 — 맨 아래 ${y + rowH}`);
  x = 1;
  for (const n of ["sailboat", "rowboat", "rockmass", "searock_big", "searock_big_m", "searock_dome", "reef", "searock", "sea_whirl", "buoy"]) { const o = k.obj(n); f.stamp(n, x, 31); x += o.width + 1; }
  roundTall(rs, f, /^tall\d$/, "tall", () => "g");
  f.save();
}
k.done();
