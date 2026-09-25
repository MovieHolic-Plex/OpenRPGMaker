// Harbors of tiledata/atlas-scenes on forest_harmony / climate sheets: big ships moored at a cobbled quay (sea to the
// north, the quay along the ships' south rail so the gangways land on it), warehouses and harbour houses behind it.
// Ships come from the vehicle sheet (docked = sails furled + a gangway to the quay, furled = anchored off the quay,
// sailing = under way further out). Quay cargo uses the grafted ship props so it matches the deck cargo.
import assert from "node:assert/strict";
import { V, mooredShip, F, SNOW, SAND, AUTUMN } from "./atlas-scenes-outdoor.mjs";

/** Sea above row `shore` (the quay row), wobbling only west/east of [x0, x1]; a cobbled quay rows shore..shore+depth-1. */
export function seaAndQuay(b, shore, x0, x1, depth = 3, { wobble = 1.5, sea } = {}) {
  b.waterWhere(sea ?? ((x, y) => y < shore - (x < x0 || x > x1 ? Math.round(wobble + wobble * Math.sin(x / 3.1)) : 0)));
  b.smoothWater(); b.paintWater();
  const cells = b.rectCells(x0, shore, x1 - x0 + 1, depth).filter((i) => !b.water.has(i));
  return b.pave(cells, "cobble", { name: "돌 부두" });
}

// Cargo piles of grafted ship props (rows of shipprop names, null = gap). Each pile is one owner's goods.
export const PILES = {
  cargo: [["crate", "crate"], ["barrel", null]],
  crates: [["crate", "crate", "barrel"]],
  barrels: [["barrel", "barrel"], ["barrel", null]],
  rope: [["rope", "anchor"]],
  fish: [["bucket", "barrel"]],
  water: [["tall-barrel", "jar"], [null, null]],
  jars: [["jar", "jar", "crate"]],
  guns: [["cannon-down", "barrel"]],
  arms: [["swords", "chest"]],
  loot: [["chest", "barrel", "jar"]],
  luggage: [["chest", "crate"], ["crate", null]],
  lamp: [["lantern"]],
};
/** A pile of ship props at (x, y) (the first spot within 3 cells where every piece fits); logs a skip when none does. */
export function pile(b, kind, x, y, purpose) {
  const rows = PILES[kind];
  const spots = [];
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) spots.push([x + dx, y + dy, Math.abs(dx) + Math.abs(dy) * 1.2]);
  spots.sort((a, c) => a[2] - c[2]);
  for (const [X, Y] of spots) {
    const cells = [];
    let ok = true;
    rows.forEach((row, dy) => row.forEach((n, dx) => {
      if (!n || !ok) return;
      const tall = n === "tall-barrel" || n === "cannon-down";
      for (let k = 0; k < (tall ? 2 : 1); k++) {
        const cx = X + dx, cy = Y + dy + k, i = b.at(cx, cy);
        if (!b.inside(cx, cy) || b.water.has(i) || b.solid.has(i) || b.occupied.has(i) || b.upper[i] !== -1 || b.roads.has(i) || b.cliffCells.has(i) || b.bridgeCells.has(i)) ok = false;
        if (b.access.some((a) => Math.abs(a.x - cx) + Math.abs(a.y - cy) <= 1)) ok = false;
      }
      cells.push([n, X + dx, Y + dy]);
    }));
    if (!ok) continue;
    for (const [n, cx, cy] of cells) V(b, "shipprop:" + n, cx, cy, { on: "any", purpose });
    return [X, Y];
  }
  b.log.skipped.push(`pile ${kind} ${x},${y}`);
  return null;
}
export const piles = (b, list) => { for (const [kind, x, y, purpose] of list) pile(b, kind, x, y, purpose); };

export function harborPlans() {
  const plans = [];
  const add = (p) => plans.push({ category: "harbors", gate: "town", ...p });

  add({
    id: "harbor-forest-trade-port", name: "갈매기 무역항 · 상선 정박", tilesetId: F, width: 58, height: 44, seed: 7101, as: "region", regionKind: "settlement",
    purpose: "큰 상선과 고깃배가 돌부두에 대 있는 무역항. 승선 판자로 배에 오르고, 부두 뒤 창고·선원 여관·어시장",
    note: "북쪽 바다에 세 돛대 상선과 외돛 고깃배가 나란히 돌부두에 붙어 있다. 두 배 모두 남쪽 뱃전 승선 판자가 부두에 닿고 갑판엔 짐이 실려 있다. 부두 위 짐 더미·밧줄·닻, 부두 뒤로 창고·선원 여관·생선 가게, 남쪽 길로 들어온다",
    plaza: [["cobble", ["부두 상자", "부두 술통", "밧줄 뭉치"]]],
    build(b) {
      seaAndQuay(b, 18, 1, 56, 3);
      mooredShip(b, "ship:galleon:merchant:docked:left", 3, 1, { purpose: "짐을 부리는 세 돛대 상선", kind: "merchant", seed: 3 });
      mooredShip(b, "ship:sloop:fishing:docked:right", 40, 7, { purpose: "부두에 댄 고깃배", kind: "fishing", seed: 4 });
      b.posts([[1, 16], [38, 16], [56, 16]]);
      b.house(7, 4, 24, { role: "부두 창고", yard: "storage", side: "right", window: 87 });
      b.house(4, 15, 23, { role: "선원 여관", yard: "tavern", side: "right", window: 86 });
      b.house(1, 36, 23, { role: "생선 가게", yard: "fishing", side: "left", window: 85 });
      b.house(6, 47, 24, { role: "항만 관리소", yard: "guard", side: "left", window: 87 });
      b.exits([{ side: "south", at: 29, meets: "해안 필드 북쪽 출구" }]);
      b.spine([["exit:0", [29, 30], [29, 22], [22, 20]], [[29, 22], [44, 20]]]);
      b.connect(); b.paintRoads();
      piles(b, [["cargo", 7, 18, "상선에서 부린 짐"], ["crates", 13, 19, "상선에 실을 짐"], ["rope", 31, 18, "상선 계류 밧줄"], ["barrels", 35, 19, "물통 더미"],
        ["fish", 48, 18, "고깃배 생선 통"], ["jars", 51, 19, "소금 절임 항아리"], ["rope", 2, 19, "계류 밧줄"]]);
      b.yards();
      b.forest({ bands: { south: [3, 1.5], west: [2, 1], east: [2, 1] }, blobs: [[2, 42, 6, 4, 12], [56, 42, 6, 4, 12]], clear: [[29, 30, 12, 6, 12]] });
      b.edgeClumps(3);
      b.tallGrass(3, [4, 8]);
    },
  });

  add({
    id: "harbor-forest-naval-base", name: "푸른닻 해군 군항", tilesetId: F, width: 60, height: 46, seed: 7111,
    purpose: "군함 한 척이 부두에 대고 한 척은 닻을 내린 군항. 부두의 포대·화약통, 병영과 무기고, 훈련장",
    note: "부두 동쪽에 세 돛대 군함이 승선 판자를 내리고 서쪽 앞바다엔 두 돛대 배가 돛을 접고 닻을 내렸다. 부두에는 대포와 화약통·포탄 궤가 줄지어 있고, 뒤로 병영·무기고·지휘관 관사, 천막 두 동과 창걸이 훈련장이 있다",
    plaza: [["cobble", ["부두 상자", "부두 술통", "밧줄 뭉치"]]],
    build(b) {
      seaAndQuay(b, 18, 1, 58, 3);
      V(b, "ship:brig:merchant:furled:left", 1, 0, { on: "water", purpose: "앞바다에 닻을 내린 보급선" });
      mooredShip(b, "ship:galleon:warship:docked:right", 26, 1, { purpose: "부두에 댄 군함", kind: "warship", cannons: 4, seed: 5 });
      b.posts([[24, 16], [58, 16]]);
      b.house(7, 3, 24, { role: "해군 병영", yard: "guard", side: "right", window: 87 });
      b.house(6, 15, 24, { role: "무기고", yard: "smith", side: "right", window: 87 });
      b.house(4, 46, 23, { role: "지휘관 관사", yard: "garden", side: "left", window: 86 });
      b.exits([{ side: "south", at: 32, meets: "군항 앞 해안길(필드)" }]);
      b.spine([["exit:0", [32, 32], [32, 22], [39, 20]], [[32, 22], [12, 21]]]);
      b.connect(); b.paintRoads();
      piles(b, [["guns", 4, 18, "부두 포대"], ["guns", 9, 18, "부두 포대"], ["guns", 15, 18, "부두 포대"], ["barrels", 20, 19, "화약통"], ["arms", 27, 19, "포탄 궤"],
        ["crates", 45, 19, "군함 보급품"], ["rope", 54, 18, "군함 계류 밧줄"]]);
      b.props([["천막", 25, 33, "수병 천막"], ["천막", 38, 33, "수병 천막"], ["무기 거치대", 29, 36, "훈련장 창걸이", "수병 천막"], ["무기 거치대", 35, 36, "훈련장 창걸이", "수병 천막"], ["모닥불", 31, 38, "야영 모닥불"]]);
      b.yards();
      b.forest({ bands: { south: [3, 1.5], west: [2, 1], east: [2, 1] }, blobs: [[3, 44, 6, 4, 12], [57, 44, 6, 4, 12]], clear: [[32, 34, 14, 8, 14]] });
      b.edgeClumps(3);
      b.tallGrass(3, [4, 8]);
    },
  });

  add({
    id: "harbor-forest-pirate-den", name: "해골만 해적 소굴", tilesetId: F, width: 56, height: 42, seed: 7121,
    purpose: "해적선이 숨어 드는 숲속 작은 만. 널빤지 부두에 해적 갤리언이 대 있고, 모래톱에 천막·약탈품·모닥불",
    note: "숲이 두른 좁은 만 서쪽 부두에 검은 돛 해적 갤리언이 승선 판자를 내리고 있다. 동쪽은 모래톱이라 천막 둘과 보라 천막, 약탈품 궤와 럼통 더미가 널려 있고 큰 모닥불이 가운데 탄다. 반쯤 무너진 오두막 두 채, 숲 오솔길 하나로만 드나든다",
    theme: "ruins",
    build(b) {
      seaAndQuay(b, 18, 1, 36, 2, { sea: (x, y) => y < 18 - (x > 36 ? Math.round(2 + 3 * (x - 36) / 18 + Math.sin(x / 2.3)) : 0) });
      mooredShip(b, "ship:galleon:pirate:docked:right", 2, 1, { purpose: "만에 숨은 해적 갤리언", kind: "pirate", cannons: 6, seed: 6 });
      const beach = [];
      for (let y = 12; y < 24; y++) for (let x = 37; x < 56; x++) if (!b.water.has(b.at(x, y)) && y < 20 + Math.round(2 * Math.sin(x / 3))) beach.push(b.at(x, y));
      b.pave(beach, "sand", { name: "해적 모래톱" });
      b.ruin(b.house(3, 8, 25, { role: "해적 망보기 오두막", window: 88 }));
      b.ruin(b.house(5, 22, 26, { role: "해적 창고 오두막", window: 88 }));
      b.exits([{ side: "south", at: 38, meets: "숲 오솔길(필드)" }]);
      b.spine([["exit:0", [38, 30], [38, 21], [21, 20]], [[38, 21], [46, 17]]]);
      b.connect(); b.paintRoads();
      V(b, "pavilion:보라", 49, 14, { purpose: "해적 두목 천막" });
      b.props([["천막", 41, 13, "해적 천막"], ["모닥불", 45, 19, "모래톱 모닥불"], ["통나무 더미", 44, 20, "모닥불 둘레 통나무", "모래톱 모닥불"], ["통나무 더미", 47, 20, "모닥불 둘레 통나무", "모래톱 모닥불"]]);
      piles(b, [["loot", 51, 18, "약탈품 더미"], ["barrels", 40, 17, "럼통 더미"], ["arms", 30, 19, "해적 칼 궤"], ["cargo", 6, 19, "해적선 짐"], ["rope", 16, 19, "계류 밧줄"]]);
      b.yards();
      b.forest({ bands: { south: [4, 2], west: [3, 1.5], east: [3, 1.5] }, blobs: [[3, 40, 6, 4, 12], [53, 40, 6, 4, 12], [53, 26, 4, 3, 8]], clear: [[38, 28, 10, 6, 10]] });
      b.edgeClumps(4, ["tree", "round-bush", "small-bush"]);
      b.tallGrass(5, [5, 10]);
    },
  });

  add({
    id: "harbor-forest-fishing-cove", name: "은비늘 어항", tilesetId: F, width: 52, height: 40, seed: 7131,
    purpose: "고깃배 셋이 드나드는 작은 어항. 두 척은 부두에, 한 척은 앞바다에 닻을 내렸고 부두엔 생선 통·그물 밧줄",
    note: "작은 돌부두에 외돛 고깃배 두 척이 승선 판자를 내렸고, 동쪽 앞바다에 한 척이 돛을 접고 떠 있다. 부두엔 생선 통과 물통, 그물 밧줄이 배마다 모여 있고, 물가 오두막 셋과 생선 말리는 집, 나룻배 둘이 동쪽 선착장에 매여 있다",
    plaza: [["cobble", ["부두 술통", "열린 물통", "밧줄 뭉치"]]],
    build(b) {
      seaAndQuay(b, 15, 1, 34, 2, { sea: (x, y) => y < 15 + (x > 35 ? Math.round(3 + 1.5 * Math.sin(x / 2.7)) : 0) });
      mooredShip(b, "ship:sloop:fishing:docked:left", 2, 4, { purpose: "새벽에 돌아온 고깃배", kind: "fishing", seed: 7 });
      mooredShip(b, "ship:sloop:fishing:docked:right", 18, 4, { purpose: "그물 싣는 고깃배", kind: "fishing", seed: 8 });
      V(b, "ship:sloop:fishing:furled:left", 35, 0, { on: "water", purpose: "앞바다에 닻 내린 고깃배" });
      b.pier(42, 24, "north", 5);
      b.moor("나룻배", 44, 13, { purpose: "선착장에 맨 나룻배" });
      b.house(3, 4, 21, { role: "어부 오두막", yard: "fishing", side: "right", window: 85 });
      b.house(5, 16, 21, { role: "생선 말리는 집", yard: "laundry", side: "right", window: 86 });
      b.house(6, 30, 24, { role: "어부 집", yard: "fishing", side: "left", window: 85 });
      b.exits([{ side: "south", at: 24, meets: "해안 필드 북쪽 출구" }]);
      b.spine([["exit:0", [24, 32], [24, 18], [14, 16]], [[24, 18], "pier-foot:0"]]);
      b.connect(); b.paintRoads();
      piles(b, [["fish", 4, 15, "고깃배 생선 통"], ["rope", 11, 16, "그물 밧줄"], ["fish", 20, 15, "고깃배 생선 통"], ["water", 28, 15, "물통"], ["barrels", 32, 15, "절임 통"]]);
      b.yards();
      b.forest({ bands: { south: [3, 1.5], west: [2, 1], east: [2, 1] }, blobs: [[3, 38, 6, 4, 12], [49, 38, 6, 4, 12]], clear: [[24, 30, 10, 6, 10]] });
      b.edgeClumps(3);
      b.tallGrass(3, [4, 8]);
    },
  });

  add({
    id: "harbor-forest-royal-welcome", name: "왕실 부두 · 귀환 환영식", tilesetId: F, width: 58, height: 48, seed: 7141,
    purpose: "원정에서 돌아온 군함을 맞는 왕실 부두. 승선 판자 아래로 붉은 융단이 광장까지 깔리고 양옆 관람석·깃발",
    note: "세 돛대 군함이 부두에 닿아 승선 판자를 내렸고, 그 발치부터 붉은 융단이 남쪽 환영 광장까지 곧게 깔렸다. 융단 양옆에 푸른·붉은 관람석이 마주 보고 등불 줄이 걸렸으며, 광장 끝엔 왕실 천막 둘과 근위대 창걸이. 부두 서쪽엔 보급품과 대포가 쌓여 있다",
    plaza: [["cobble", ["부두 상자", "부두 술통"]]],
    build(b) {
      seaAndQuay(b, 18, 1, 56, 3);
      const v = mooredShip(b, "ship:galleon:warship:docked:left", 6, 1, { purpose: "원정에서 돌아온 군함", kind: "warship", cannons: 4, seed: 9 });
      const cx = v.gangway.x;
      for (let y = 18; y <= 34; y++) V(b, y === 34 ? "carpet:end_s" : "carpet:v", cx, y, { on: "any", purpose: "환영 융단" });
      V(b, "stand:blue", cx - 8, 23, { purpose: "귀족 관람석" });
      V(b, "stand:red", cx + 3, 23, { purpose: "시민 관람석" });
      for (const y of [21, 29, 33]) { V(b, "garland:lantern", cx - 1, y, { on: "land", purpose: "융단 옆 등불 줄" }); V(b, "garland:lantern", cx + 1, y, { on: "land", purpose: "융단 옆 등불 줄" }); }
      V(b, "pavilion:붉은", cx - 5, 32, { purpose: "왕실 천막" });
      V(b, "pavilion:푸른", cx + 3, 32, { purpose: "왕실 천막" });
      b.house(7, 42, 25, { role: "항만 관청", yard: "guard", side: "left", window: 87 });
      b.house(6, 3, 26, { role: "해군 막사", yard: "guard", side: "right", window: 87 });
      b.exits([{ side: "south", at: cx, meets: "왕도로 가는 큰길(필드)" }]);
      b.access.push({ role: "carpet", x: cx, y: 34 });
      b.spine([["exit:0", [cx, 38], [cx + 6, 38], [cx + 6, 21]], [[cx, 38], [cx - 7, 38], [cx - 7, 21]]]);
      b.connect(); b.paintRoads("cobble");
      piles(b, [["guns", 4, 18, "부두 예포"], ["crates", 40, 19, "원정 보급품"], ["barrels", 46, 19, "물통 더미"], ["rope", 53, 18, "계류 밧줄"]]);
      b.props([["무기 거치대", cx - 2, 36, "근위대 창걸이", "왕실 천막"], ["무기 거치대", cx + 2, 36, "근위대 창걸이", "왕실 천막"]]);
      b.yards();
      b.forest({ bands: { south: [2, 1], west: [2, 1], east: [2, 1] }, blobs: [[3, 46, 6, 4, 12], [55, 46, 6, 4, 12]], clear: [[cx, 36, 16, 8, 14]] });
      b.edgeClumps(3);
      b.tallGrass(2, [4, 7]);
    },
  });

  add({
    id: "harbor-forest-emigrant-dock", name: "먼바다 여객 부두 · 마차 정류장", tilesetId: F, width: 58, height: 46, seed: 7151,
    purpose: "여객선이 떠나는 부두와 그 뒤 마차 정류장. 승객 짐 더미, 기다리는 마차와 말, 매표소·여관",
    note: "두 돛대 여객선이 부두에 대 승선 판자를 내렸고, 부두엔 승객 궤짝과 짐이 줄지어 있다. 부두 뒤 돌길 광장이 마차 정류장이라 붉은 사두마차와 짐마차가 말을 매고 서 있다. 광장 서쪽 매표소(항만 관청)와 동쪽 여관, 남쪽 큰길로 들어온다",
    plaza: [["cobble", ["부두 상자", "부두 술통"]]],
    build(b) {
      seaAndQuay(b, 18, 1, 56, 3);
      mooredShip(b, "ship:brig:merchant:docked:right", 18, 3, { purpose: "먼바다로 떠나는 여객선", kind: "liner", seed: 10, clutter: undefined });
      // The coach stand: a gravel yard just deep enough for the coaches, wagons and their horses (no open square left).
      b.pave(b.rectCells(15, 24, 28, 4), "dirt", { name: "마차 정류장" });
      V(b, "coach:red", 16, 25, { on: "any", purpose: "손님을 기다리는 사두마차(말 매어 둠)" });
      V(b, "cart:crates", 24, 26, { on: "any", purpose: "승객 짐 손수레" });
      V(b, "wagon:canvas", 28, 25, { on: "any", purpose: "짐 싣는 포장마차(말 매어 둠)" });
      V(b, "coach:red:parked", 35, 25, { on: "any", purpose: "말을 푼 채 쉬는 마차" });
      V(b, "horse:left", 40, 25, { on: "any", purpose: "마차에서 푼 말" });
      b.house(7, 3, 25, { role: "매표소(항만 관청)", yard: "storage", side: "right", window: 87 });
      b.house(4, 47, 24, { role: "부두 여관", yard: "tavern", side: "left", window: 86 });
      b.exits([{ side: "south", at: 29, meets: "해안 큰길(필드)" }]);
      b.spine([["exit:0", [29, 36], [29, 30], [12, 30], [12, 22], [22, 21]], [[29, 30], [44, 30], [44, 22], [36, 21]]]);
      b.connect(); b.paintRoads("cobble");
      piles(b, [["luggage", 6, 18, "승객 짐"], ["luggage", 11, 19, "승객 짐"], ["luggage", 45, 18, "승객 짐"], ["crates", 50, 19, "화물"], ["rope", 16, 18, "계류 밧줄"]]);
      b.yards();
      b.forest({ bands: { south: [3, 1.5], west: [2, 1], east: [2, 1] }, blobs: [[3, 44, 6, 4, 12], [55, 44, 6, 4, 12]], clear: [[29, 36, 12, 6, 12]] });
      b.edgeClumps(3);
      b.tallGrass(3, [4, 8]);
    },
  });

  add({
    id: "harbor-snow-whaler-port", name: "서릿바다 포경항", tilesetId: SNOW, width: 56, height: 42, seed: 7161,
    purpose: "북쪽 얼음바다의 포경항. 두 돛대 배와 고깃배가 눈 덮인 부두에 대 있고, 기름통·밧줄 더미와 눈 덮인 창고",
    note: "눈 덮인 돌부두에 두 돛대 포경선과 외돛 고깃배가 나란히 승선 판자를 내렸다. 부두엔 고래기름 통과 작살 밧줄 더미가 배마다 쌓여 있고, 뒤로 눈 지붕 창고·선원 숙소·작살 대장간, 눈 덮인 침엽 숲이 둘러싼다",
    plaza: [["cobble", ["나무 상자", "술통"]]],
    build(b) {
      seaAndQuay(b, 17, 1, 54, 3);
      mooredShip(b, "ship:brig:merchant:docked:left", 3, 2, { purpose: "포경선", kind: "fishing", seed: 11 });
      mooredShip(b, "ship:sloop:fishing:docked:right", 34, 6, { purpose: "부두에 댄 고깃배", kind: "fishing", seed: 12 });
      b.house(7, 4, 23, { role: "고래기름 창고", yard: "storage", side: "right", window: 87 });
      b.house(1, 16, 22, { role: "선원 숙소", yard: "laundry", side: "right", window: 85 });
      b.house(6, 44, 23, { role: "작살 대장간", yard: "smith", side: "left", window: 87 });
      b.exits([{ side: "south", at: 30, meets: "설원 해안길(필드)" }]);
      b.spine([["exit:0", [30, 30], [30, 21], [17, 19]], [[30, 21], [39, 19]]]);
      b.connect(); b.paintRoads();
      piles(b, [["barrels", 6, 17, "고래기름 통"], ["barrels", 11, 18, "고래기름 통"], ["rope", 22, 17, "작살 밧줄"], ["fish", 44, 17, "생선 통"], ["crates", 50, 18, "소금 궤"]]);
      b.yards();
      b.forest({ bands: { south: [3, 1.5], west: [2, 1], east: [2, 1] }, blobs: [[3, 40, 6, 4, 12], [53, 40, 6, 4, 12]], clear: [[30, 30, 12, 6, 12]], noise: 0.7 });
      b.edgeClumps(3, ["tree", "round-bush", "small-bush"]);
    },
  });

  add({
    id: "harbor-autumn-cider-port", name: "단풍강 사과주 나루항", tilesetId: AUTUMN, width: 54, height: 42, seed: 7171,
    purpose: "가을 추수를 싣는 강어귀 항구. 두 돛대 상선에 호박·사과 짐이 실리고, 부두엔 짐수레와 건초 더미",
    note: "단풍 숲 사이 강어귀 부두에 두 돛대 상선이 승선 판자를 내렸다. 부두엔 호박 수레·건초 수레·사과주 통이 줄지어 실릴 차례를 기다리고, 뒤로 사과주 양조장·곡식 창고·농가, 남쪽 들길로 수레가 들어온다",
    plaza: [["cobble", ["나무 상자", "술통"]]],
    build(b) {
      seaAndQuay(b, 17, 1, 52, 4);
      mooredShip(b, "ship:brig:merchant:docked:left", 4, 2, { purpose: "추수 짐을 싣는 상선", kind: "merchant", seed: 13 });
      V(b, "cart:pumpkins", 30, 17, { purpose: "실을 호박 수레" });
      V(b, "cart:hay", 35, 18, { purpose: "건초 수레" });
      V(b, "haybale", 39, 17, { purpose: "건초 더미" }); V(b, "haybale", 40, 17, { purpose: "건초 더미" });
      V(b, "pumpkins", 33, 19, { purpose: "호박 더미" });
      b.house(7, 4, 24, { role: "사과주 양조장", yard: "storage", side: "right", window: 87 });
      b.house(2, 15, 24, { role: "곡식 창고", yard: "farm", side: "right", window: 86 });
      b.house(5, 42, 24, { role: "농가", yard: "farm", side: "left", window: 85 });
      b.exits([{ side: "south", at: 28, meets: "추수 들판(필드)" }]);
      b.spine([["exit:0", [28, 30], [28, 22], [18, 20]]]);
      b.connect(); b.paintRoads();
      piles(b, [["barrels", 6, 17, "사과주 통"], ["crates", 11, 18, "사과 궤"], ["rope", 24, 17, "계류 밧줄"], ["barrels", 45, 18, "사과주 통"]]);
      b.yards();
      b.forest({ bands: { south: [3, 1.5], west: [2, 1], east: [2, 1] }, blobs: [[3, 40, 6, 4, 12], [51, 40, 6, 4, 12]], clear: [[28, 30, 12, 6, 12]], noise: 0.7 });
      b.edgeClumps(3, ["tree", "round-bush", "small-bush"]);
    },
  });

  add({
    id: "harbor-desert-spice-port", name: "금모래 향신료 항구", tilesetId: SAND, width: 56, height: 42, seed: 7181, fill: { flowerCap: 16 },
    purpose: "사막 해안의 향신료 무역항. 세 돛대 상선이 부두에 대고, 부두 뒤 천막 장터와 대상 마차",
    note: "사막 해안 돌부두에 세 돛대 상선이 승선 판자를 내렸다. 부두엔 향신료 항아리와 궤짝이 쌓이고, 뒤 모래 광장엔 줄무늬 천막 장터와 포장마차 둘, 흙빛 집 셋. 물가엔 야자수, 모랫길로 대상이 들어온다",
    plaza: [["cobble", ["항아리", "나무 상자"]]],
    build(b) {
      seaAndQuay(b, 18, 1, 54, 3);
      mooredShip(b, "ship:galleon:merchant:docked:right", 20, 1, { purpose: "향신료 상선", kind: "merchant", seed: 14 });
      V(b, "pavilion:붉은", 14, 25, { purpose: "향신료 천막 가게" });
      V(b, "pavilion:초록", 19, 25, { purpose: "비단 천막 가게" });
      V(b, "wagon:red", 34, 25, { purpose: "대상 포장마차" });
      V(b, "horse:right", 39, 25, { purpose: "대상 마차 말" });
      b.house(7, 3, 24, { role: "향신료 창고", yard: "storage", side: "right", window: 87 });
      b.house(3, 44, 23, { role: "상인 집", yard: "desert", side: "left", window: 86 });
      b.house(5, 49, 30, { role: "세관", yard: "guard", side: "left", window: 86 });
      b.exits([{ side: "south", at: 28, meets: "사막 대상 길(필드)" }]);
      b.spine([["exit:0", [28, 34], [28, 22], [33, 20]]]);
      b.connect(); b.paintRoads();
      piles(b, [["jars", 4, 18, "향신료 항아리"], ["jars", 10, 19, "향신료 항아리"], ["crates", 42, 18, "비단 궤"], ["rope", 18, 18, "계류 밧줄"], ["luggage", 48, 19, "상인 짐"]]);
      b.yards();
      b.singlesWhere(770, 6, (x, y) => b.nearWater(x, y, 1) && !b.water.has(b.at(x, y)) && y > 20, 3, { shore: true });
    },
  });

  add({
    id: "harbor-forest-river-barges", name: "버들강 거룻배 나루", tilesetId: F, width: 56, height: 44, seed: 7191,
    purpose: "큰 강을 오가는 거룻배(나룻배) 둘이 나루 부두에 대 있는 강 항구. 나무다리 너머 창고·주막",
    note: "마을을 남북으로 가르는 넓은 강의 서쪽 돌부두에 짐 거룻배 둘이 붙어 있고, 부두엔 짐 궤짝과 통이 배마다 쌓였다. 하류엔 나무다리가 동서를 잇고, 서쪽 기슭엔 창고·뱃사람 주막, 동쪽 기슭엔 뱃사공 집과 방앗간. 서쪽 길과 남쪽 길로 들어온다",
    build(b) {
      b.waterWhere((x, y) => { const w = y < 5 || y > 38 ? Math.round(Math.sin(y / 2.5)) : 0; return x >= 26 + w && x <= 34 + w; });
      b.smoothWater(); b.paintWater();
      b.bridges([[30, 32]]);
      b.pave(b.rectCells(22, 5, 4, 20), "cobble", { name: "강 부두" });
      const f1 = V(b, "ferry", 26, 8, { on: "water", purpose: "짐 거룻배" });
      const f2 = V(b, "ferry", 26, 17, { on: "water", purpose: "짐 거룻배" });
      b.access.push({ role: "ferry", x: 27, y: 9 }, { role: "ferry", x: 27, y: 18 });
      b.house(7, 4, 4, { role: "강 창고", yard: "storage", side: "right", window: 87 });
      b.house(4, 6, 16, { role: "뱃사람 주막", yard: "tavern", side: "right", window: 86 });
      b.house(3, 40, 8, { role: "뱃사공 집", yard: "fishing", side: "right", window: 85 });
      b.house(6, 44, 22, { role: "방앗간", yard: "storage", side: "left", window: 86 });
      b.exits([{ side: "west", at: 28, meets: "강 상류 필드" }, { side: "south", at: 44, meets: "들판(필드)" }]);
      b.spine([["exit:0", [16, 28], [21, 26], [21, 12]], [[21, 26], [24, 32], "bridge-west:0"], ["bridge-east:0", [44, 33], "exit:1"], [[44, 33], [44, 18], [41, 16]]]);
      b.connect(); b.paintRoads();
      piles(b, [["crates", 23, 7, "거룻배 짐"], ["barrels", 23, 12, "거룻배 짐"], ["cargo", 23, 15, "거룻배 짐"], ["rope", 24, 21, "계류 밧줄"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], south: [3, 1.5], east: [2, 1], west: [2, 1] }, blobs: [[3, 40, 6, 4, 12], [53, 40, 6, 4, 12], [53, 3, 5, 3, 10]], noise: 0.8 });
      b.edgeClumps(3);
      b.tallGrass(4, [4, 8]);
      b.threes(348, 3);
    },
  });

  add({
    id: "harbor-forest-lighthouse-cape", name: "흰등대 곶", tilesetId: F, width: 50, height: 44, seed: 7201, gate: "field",
    purpose: "바다로 튀어나온 곶 끝의 등대. 등대지기 집과 선착장, 앞바다를 지나는 범선",
    note: "서쪽과 북쪽이 바다인 곶 끝에 흰 등대가 서고, 등대 문 앞마당에 등대지기 집과 장작·기름통이 있다. 곶 북쪽 작은 선착장엔 나룻배가 매여 있고, 앞바다엔 두 돛대 배가 돛을 펴고 지나간다. 남동쪽 해안길로 들어온다",
    build(b) {
      b.waterWhere((x, y) => y < 16 + 2 * Math.sin(x / 4) || x < 8 + 2 * Math.sin(y / 3.5) + Math.max(0, y - 30) * 0.3);
      b.smoothWater(); b.paintWater();
      V(b, "ship:brig:merchant:sailing:left", 17, 0, { on: "water", purpose: "앞바다를 지나는 범선" });
      const lh = V(b, "lighthouse", 18, 15, { purpose: "곶 끝 등대" });
      b.access.push({ role: "lighthouse-door", x: lh.doors[0].x, y: lh.doors[0].y + 1 });
      b.houseNear(3, 26, 18, { role: "등대지기 집", yard: "woodwork", side: "right", window: 85 });
      b.pier(13, 20, "west", 3);
      b.exits([{ side: "south", at: 38, meets: "해안길(필드)" }, { side: "east", at: 30, meets: "해안 절벽길" }]);
      b.spine([["exit:0", [36, 32], [26, 26], [19, 23]], [[26, 26], "exit:1"], [[19, 23], "pier-foot:0"]]);
      b.connect(); b.paintRoads();
      piles(b, [["barrels", 22, 20, "등대 기름통"], ["lamp", 17, 22, "등불 예비"]]);
      b.props([["돌등", 16, 24, "등대 길 등불"], ["벤치", 22, 24, "바다를 보는 쉼터"]]);
      b.yards();
      b.forest({ bands: { south: [4, 2], east: [4, 2] }, blobs: [[46, 40, 7, 5, 12], [14, 42, 6, 4, 10]], clear: [[26, 26, 10, 6, 10]] });
      b.edgeClumps(4);
      b.tallGrass(5, [5, 10]);
      b.threes(348, 4);
    },
  });

  return plans;
}
