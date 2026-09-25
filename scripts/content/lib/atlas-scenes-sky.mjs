// Ship-sheet harbors (stone quays with big ships docked) and sky scenes (airship deck, sky dock, isle shrine) for
// tiledata/atlas-scenes. GridMap plans on the pipeline copy of easyrpg_chipset_ship (vehicle pieces from 480).
import { GridMap, piece, SHIP_BASE } from "./atlas-scenes-kit.mjs";
import { SEA, SAND, STONE, P, deckOf, dressShip, tryProp, clutterDeck } from "./atlas-scenes-ships.mjs";

const V = (name, k = 0) => SHIP_BASE + (piece(name).lower[k] >= 0 ? piece(name).lower[k] : piece(name).upper[k]);

/** Main quay column block x0..x1 (west edge on sand) running y0..y1. */
function mainQuay(g, x0, x1, y0, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g.set(x, y, x === x0 ? 426 : x === x1 ? 428 : STONE, "lower");
}

/** Pier from the main quay's east edge (xq) out to x1, rows y0..y1, with its stone face on the water row below. */
function pier(g, xq, x1, y0, y1) {
  for (let y = y0; y <= y1; y++) for (let x = xq; x <= x1; x++) {
    let t = STONE;
    if (y === y0) t = x === xq ? 396 : x === x1 ? 398 : 397;
    else if (y === y1) t = x === xq ? 456 : x === x1 ? 458 : 457;
    else if (x === x1) t = 428;
    g.set(x, y, t, "lower");
  }
  for (let x = xq + 1; x <= x1; x++) g.set(x, y1 + 1, x === x1 ? 170 : x === xq + 1 ? 168 : 169);
}

function piles(g, list) {
  for (const [x, y, rows, n] of list) g.prop(rows, x, y, rows[0].length, n);
}

function skyFill(g) {
  const s = [V("sky:0"), V("sky:1"), V("sky:2")];
  for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) g.set(x, y, s[(x * 7 + y * 13) % 11 === 0 ? 1 : (x * 5 + y * 3) % 17 === 0 ? 2 : 0], "lower");
}

function cloud(g, name, x, y) {
  const p = piece(name);
  for (let k = 0; k < p.w * p.h; k++) {
    const t = p.upper[k];
    if (t < 0) continue;
    const X = x + (k % p.w), Y = y + Math.floor(k / p.w);
    if (g.inside(X, Y) && g.upper[g.at(X, Y)] === -1) g.set(X, Y, SHIP_BASE + t);
  }
}

export function skyPlans() {
  const plans = [];

  // ── ship-sheet harbors ──
  plans.push({
    id: "harbor-stone-quay-ships", name: "돌부두 항구 · 큰 상선과 쌍돛선 정박", tileset: "ship", as: "region", regionKind: "settlement", width: 54, height: 46,
    purpose: "모래 해안의 돌부두. 부두 둘에 큰 상선과 쌍돛선이 돛을 접고 승선 판자를 내렸다",
    rules: ["배는 부두 북쪽 물 위에 대고, 승선 판자 끝이 부두 윗줄(397)에 닿게 한다", "돌부두는 몸 367·윗테 397·아랫테 457·동끝 428, 물 쪽 아랫줄에 돌벽 169"],
    limitations: "배 칩셋만 쓴 항구라 건물이 없다. 창고·여관은 옆 마을 맵으로 잇는다.",
    build(ctx) {
      const g = new GridMap({ id: this.id, name: this.name, width: 54, height: 46, tileset: ctx.ship, fill: SEA });
      g.rect(0, 0, 6, 46, SAND);
      mainQuay(g, 6, 11, 0, 45);
      const a = g.vehicle("ship:galleon:merchant:docked:left", 14, 0, { purpose: "짐을 부리는 큰 상선" });
      pier(g, 11, 50, a.y + a.h, a.y + a.h + 3);
      const b = g.vehicle("ship:brig:merchant:docked:left", 16, a.y + a.h + 5, { purpose: "막 들어온 쌍돛선" });
      pier(g, 11, 44, b.y + b.h, b.y + b.h + 3);
      for (const v of [a, b]) dressShip(g, v, { kind: "merchant" });
      const p1 = a.y + a.h, p2 = b.y + b.h;
      piles(g, [[20, p1 + 1, [[385, 385], [379, 379]], "상선 짐 더미"], [30, p1 + 2, [[379, 263, 385]], "궤짝과 밧줄"], [44, p1 + 1, [[386, 415]], "물 항아리"],
        [24, p2 + 1, [[385, 379, 379]], "쌍돛선 짐"], [36, p2 + 2, [[263, 385]], "밧줄과 통"], [7, 4, [[385], [385]], "창고 앞 통"], [8, 14, [[379, 379]], "궤짝"],
        [7, 30, [[385, 386]], "통과 항아리"], [9, 43, [[263]], "밧줄"], [1, 8, [[259]], "모래밭 닻"], [2, 26, [[379]], "떠밀려 온 궤짝"]]);
      g.targets.push([a.gangway.x, p1 + 1], [b.gangway.x, p2 + 1], ...a.doors.map((d) => [d.x, d.y]), ...b.doors.map((d) => [d.x, d.y]), [2, 20]);
      return { g, entry: [8, 20] };
    },
  });
  plans.push({
    id: "harbor-naval-base", name: "왕국 군항 · 군함 두 척", tileset: "ship", as: "region", regionKind: "settlement", width: 50, height: 42,
    purpose: "해군 군항. 긴 돌부두 양쪽에 군함 두 척이 닻을 내리고 부두 끝에 해안 포대가 바다를 겨눈다",
    rules: ["부두 남쪽 배는 승선 판자, 북쪽 배는 닻 내림 조각", "해안 포대는 부두 동끝 두 줄에 포구가 바다(동쪽)를 향한 대포 354|355"],
    limitations: "병영·지휘소 건물은 없다(배 칩셋).",
    build(ctx) {
      const g = new GridMap({ id: this.id, name: this.name, width: 50, height: 42, tileset: ctx.ship, fill: SEA });
      g.rect(0, 0, 5, 42, SAND);
      mainQuay(g, 5, 10, 0, 41);
      const a = g.vehicle("ship:galleon:warship:docked:right", 13, 1, { purpose: "출항 준비 중인 군함" });
      pier(g, 10, 46, a.y + a.h, a.y + a.h + 4);
      const b = g.vehicle("ship:galleon:warship:furled:left", 13, a.y + a.h + 6, { purpose: "정박한 두 번째 군함" });
      for (const v of [a, b]) dressShip(g, v, { kind: "warship", cannons: 3 });
      const py = a.y + a.h;
      piles(g, [[44, py + 1, [[354, 355]], "해안 포대"], [44, py + 3, [[354, 355]], "해안 포대"], [40, py + 2, [[385, 385]], "화약통"], [20, py + 1, [[379, 382]], "포탄 궤"],
        [28, py + 3, [[385, 263]], "통과 밧줄"], [33, py + 1, [[318]], "군항 깃발"], [6, 6, [[385], [379]], "보급 통"], [7, 30, [[382, 382]], "무기 궤"], [1, 14, [[259]], "예비 닻"]]);
      g.targets.push([a.gangway.x, py + 1], ...a.doors.map((d) => [d.x, d.y]), [43, py + 2]);
      return { g, entry: [7, py + 2] };
    },
  });
  plans.push({
    id: "harbor-pirate-cove", name: "해적 정박지 · 모래톱 나무 부두", tileset: "ship", as: "region", regionKind: "settlement", width: 46, height: 36,
    purpose: "외딴 모래톱. 나무 부두에 해적선이 돛을 접고 댔고, 모래밭엔 천막·장물 궤·모닥불 화로",
    rules: ["나무 부두는 갑판 판자 14를 물 위에 깐 것", "천막·화로는 모래밭 한쪽에 몰아서"],
    limitations: "절벽 동굴은 없다 — 동굴 소굴은 던전 맵으로.",
    build(ctx) {
      const g = new GridMap({ id: this.id, name: this.name, width: 46, height: 36, tileset: ctx.ship, fill: SEA });
      g.rect(0, 22, 46, 14, SAND);
      const a = g.vehicle("ship:galleon:pirate:docked:left", 4, 3, { purpose: "해적선" });
      const jy = a.y + a.h;
      g.rect(2, jy, 36, 3, 14); // wooden jetty (deck planks) from the ship down to the sand
      g.rect(18, jy + 3, 3, 22 - jy - 3, 14);
      dressShip(g, a, { kind: "pirate", cannons: 4 });
      const T = (n) => V(n);
      const tent = (name, x, y) => g.vehicle(name, x, y, { purpose: "해적 천막" });
      tent("pavilion:붉은", 4, 25); tent("pavilion:보라", 30, 25);
      piles(g, [[26, 26, [[382, 382], [385, -1]], "장물 궤"], [14, 27, [[T("brazier", 0)], [T("brazier", 1)]], "모닥불 화로"], [11, 29, [[385, 385]], "럼통"],
        [38, 30, [[379, 379, 263]], "약탈 짐"], [8, 32, [[259]], "버린 닻"], [34, jy + 1, [[385, 263]], "부두 통과 밧줄"], [6, jy + 1, [[379]], "부두 궤짝"]]);
      g.targets.push([a.gangway.x, jy], ...a.doors.map((d) => [d.x, d.y]), [40, 33]);
      return { g, entry: [19, 30] };
    },
  });
  plans.push({
    id: "harbor-shipyard", name: "조선소 · 뭍에 올린 배", tileset: "ship", as: "region", regionKind: "settlement", width: 50, height: 32,
    purpose: "모래밭 조선소. 큰 배 하나를 뭍으로 끌어올려 손보고, 옆 물가엔 다 지은 쌍돛선이 뜬다. 목재·밧줄·통이 쌓였다",
    rules: ["뭍에 올린 배는 모래 위에 찍는다(선체 가장자리 -1 칸은 모래)", "사다리 328을 선체 남쪽 뱃전에 기대 세운다"],
    limitations: "건조대 받침은 그리지 않았다.",
    build(ctx) {
      const g = new GridMap({ id: this.id, name: this.name, width: 50, height: 32, tileset: ctx.ship, fill: SAND });
      g.rect(0, 0, 50, 8, SEA);
      const hull = g.vehicle("ship:galleon:warship:furled:left", 3, 6, { purpose: "뭍에 끌어올린 수리 중인 군함" });
      const d = deckOf(g, hull);
      dressShip(g, hull, { kind: "warship" });
      // ladders up the south side, timber and rope stacks around the keel
      piles(g, [[12, hull.y + hull.h, [[328]], "선체에 기댄 사다리"], [26, hull.y + hull.h, [[328]], "선체에 기댄 사다리"],
        [5, hull.y + hull.h + 2, [[379, 379, 379], [379, 379, -1]], "목재 궤짝 더미"], [18, hull.y + hull.h + 3, [[263, 263]], "밧줄 더미"],
        [30, hull.y + hull.h + 2, [[385, 385], [385, -1]], "타르 통"], [40, 26, [[415, 386]], "물통"], [42, 12, [[259]], "새 닻"]]);

      g.targets.push([12, hull.y + hull.h + 1], [40, 28]);
      return { g, entry: [20, 29] };
    },
  });

  // ── sky ──
  plans.push({
    id: "sky-airship-deck", name: "비공정 갑판 · 구름 위", tileset: "ship", as: "place", width: 34, height: 26,
    purpose: "구름 위를 나는 비공정의 갑판. 머리 위에 기구가 떠 있고 고물에 프로펠러, 선실 문 아래로 기관실",
    placeTags: ["비행", "이동수단"],
    build(ctx) {
      const g = new GridMap({ id: this.id, name: this.name, width: 34, height: 26, tileset: ctx.ship });
      skyFill(g);
      for (const [n, x, y] of [["cloud:long", 1, 20], ["cloud:big", 26, 2], ["cloud:small", 2, 3], ["cloud:big", 28, 21], ["cloud:small", 22, 24], ["cloud:long", 0, 11]]) cloud(g, n, x, y);
      const a = g.vehicle("airship:sky", 7, 4, { purpose: "비공정", free: false });
      dressShip(g, a, { kind: "liner", helm: true, clutter: [[["crate", "crate"], "보급 궤"], [["barrel"], "연료 통"], [["rope"], "계류 밧줄"], [["jar", "bucket"], "물 항아리"]] });
      g.targets.push(...a.doors.map((d) => [d.x, d.y]));
      return { g, entry: [a.doors[0].x, a.doors[0].y + 1] };
    },
  });
  plans.push({
    id: "sky-dock-isle", name: "하늘 부두 · 떠 있는 돌섬", tileset: "ship", as: "place", width: 44, height: 28,
    purpose: "구름 사이에 떠 있는 돌섬 부두. 붉은 기구 비공정이 섬 곁에 떠 있고 건너 판자로 오른다",
    placeTags: ["비행", "이동수단", "항구"],
    build(ctx) {
      const g = new GridMap({ id: this.id, name: this.name, width: 44, height: 28, tileset: ctx.ship });
      skyFill(g);
      for (const [n, x, y] of [["cloud:long", 30, 23], ["cloud:big", 2, 22], ["cloud:small", 20, 1], ["cloud:small", 38, 2]]) cloud(g, n, x, y);
      const isle = g.vehicle("isle:dock", 1, 9, { purpose: "떠 있는 돌섬 부두", free: false });
      const small = g.vehicle("isle:small", 4, 1, { purpose: "작은 돌섬", free: false });
      const a = g.vehicle("airship:red:sky", 20, 2, { purpose: "섬에 댄 비공정", free: false });
      const deck = deckOf(g, a);
      // plank bridge from the isle's east edge to the airship's first deck cell on the lane row
      const row = a.doors[0].y + 1;
      const plank = V("plank:h");
      for (let x = isle.x + isle.w - 1; x < deck.right && !deck.has.has(g.at(x, row)); x++) g.set(x, row, plank);
      for (let y = small.y + 2; y < isle.y; y++) g.set(9, y, V("plank:v"));
      dressShip(g, a, { kind: "liner", clutter: [[["crate", "crate"], "보급 궤"], [["barrel"], "연료 통"], [["rope"], "계류 밧줄"]] });
      piles(g, [[3, 10, [[385, 385, 379]], "부두 짐"], [11, 10, [[263]], "계류 밧줄"], [5, 12, [[V("brazier", 0)], [V("brazier", 1)]], "신호 화로"], [7, 2, [[119]], "섬 등불"]]);
      g.targets.push(...a.doors.map((d) => [d.x, d.y]), [8, 2]);
      return { g, entry: [8, 11] };
    },
  });
  plans.push({
    id: "sky-isle-shrine", name: "구름 위 떠 있는 섬들의 성소", tileset: "ship", as: "place", width: 40, height: 30,
    purpose: "구름 바다 위 떠 있는 돌섬 셋을 판자 다리로 이었다. 가운데 큰 섬에 금빛 성역 마법진과 화로 넷",
    placeTags: ["비행", "성소", "이벤트"],
    build(ctx) {
      const g = new GridMap({ id: this.id, name: this.name, width: 40, height: 30, tileset: ctx.ship });
      skyFill(g);
      for (const [n, x, y] of [["cloud:long", 1, 24], ["cloud:big", 33, 25], ["cloud:small", 18, 1], ["cloud:long", 30, 0]]) cloud(g, n, x, y);
      const mid = g.vehicle("isle:dock", 13, 11, { purpose: "가운데 성소 섬", free: false });
      const west = g.vehicle("isle:small", 1, 3, { purpose: "서쪽 섬", free: false });
      const east = g.vehicle("isle:small", 31, 5, { purpose: "동쪽 섬", free: false });
      for (let y = west.y + 2; y <= mid.y + 1; y++) g.set(5, y, V("plank:v"));
      for (let x = 6; x < mid.x + 1; x++) g.set(x, mid.y + 1, V("plank:h"));
      for (let y = east.y + 2; y <= mid.y + 1; y++) g.set(34, y, V("plank:v"));
      for (let x = mid.x + mid.w - 1; x < 34; x++) g.set(x, mid.y + 1, V("plank:h"));
      g.vehicle("rune:gold", 17, 11, { purpose: "금빛 성역 마법진", free: true });
      piles(g, [[15, 11, [[V("brazier", 0)], [V("brazier", 1)]], "성소 화로"], [23, 11, [[V("brazier", 0)], [V("brazier", 1)]], "성소 화로"],
        [3, 4, [[119]], "섬 등불"], [33, 6, [[119]], "섬 등불"], [2, 5, [[382]], "봉헌 궤"], [35, 6, [[386]], "봉헌 항아리"]]);
      g.targets.push([4, 4], [33, 6], [19, 13]);
      return { g, entry: [19, 15] };
    },
  });
  return plans;
}
