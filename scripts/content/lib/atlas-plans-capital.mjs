// Atlas towns · the royal capital 「은빛 왕도 아르젠」 (whole city 120×100 and its districts), the castle town below a
// keep, a fortress city and a river border fort. Forest sheet; walls are the castle-town reference ring fitted to size.
const F = "forest_harmony";
// Inside city walls: garden bushes, flower beds and a few trees instead of wild forest clumps and meadow grass.
export const CITY_FILL = { palette: { grass: 0.8, trees: 1.2, bushes: 2.2, flowers: 2.4, rocks: 0 }, trees: ["round-bush", "small-bush", "tree"], groves: 2 };
const NOBLE = [["gable-2f-porch", "slate-brick", "귀족 저택", "garden", "right"], ["gable-2f-long", "charcoal-timber", "귀족 저택", "garden", "right"], ["gable-dormer", "slate-brick", "귀족 저택", "garden", "right"], ["gable-2f", "amber-brick", "귀족 저택", "bees", "right"]];
const CRAFT = [["gable-long-low", "amber-brick", "대장간", "smith", "right"], ["gable-long", "timber-hall", "목공소", "woodwork", "right"], ["gable-long-step", "slate-wood", "무두장이", "storage", "right"], ["gable-hall", "amber-wood", "직조공방", "storage", "right"]];
const COMMON = [["gable-house", "thatch-plaster", "집", "laundry", "right"], ["gable-twin", "bright-plaster", "집", "garden", "right"], ["gable-steep", "moss-plaster", "집", "herbs", "right"], ["gable-cross-r", "amber-wood", "집", "laundry", "left"], ["gable-2f-narrow", "blue-stone", "집", null, null]];
const SHOPS = [["gable-twin-big", "bright-plaster", "잡화점", "shop", "right"], ["gable-2f-lean", "amber-brick", "여관", "tavern", "right"], ["gable-porch-wide", "slate-brick", "무기점", "shop", "right"], ["gable-hall", "amber-wood", "방어구점", "shop", "right"], ["gable-2f-porch", "timber-hall", "주점", "tavern", "right"]];
const SLUM = [["gable-shed", "thatch-log", "판잣집", null, null], ["gable-long-low", "thatch-log", "판잣집", "laundry", "right"], ["gable-shed", "slate-wood", "판잣집", null, null], ["gable-barn", "thatch-log", "허름한 집", "storage", "right"]];

export const CAPITAL_PLANS = [
  {
    id: "city-capital-overview", name: "은빛 왕도 아르젠 · 전경", category: "capital", tilesetId: F, fill: CITY_FILL, width: 120, height: 100, seed: 13001, tries: 4,
    plaza: [["cobble", ["벤치", "돌등", "화분", "꽃 화단", "줄무늬 노점 빨강", "줄무늬 노점 파랑"]]],
    purpose: "왕국의 수도 전경. 성벽 한 겹이 도시를 두르고 북쪽 가운데 왕성, 남문 큰길과 동서 큰길이 십자로 만나며 시장·귀족·신전·장인·빈민가 구역이 나뉜다",
    note: "120×100 대도시. 남쪽 성문에서 돌길 큰길이 북쪽 왕성 정문 계단까지 곧게 오르고, 가운데에서 동서 큰길과 십자로 만난다. 십자로 남서쪽은 분수와 노점이 선 시장 광장, 북서쪽은 정원 딸린 2층 귀족 저택가, 북동쪽은 성당과 묘지의 신전 구역, 남동쪽은 대장간·목공소가 늘어선 장인 거리, 남서쪽 성벽 밑은 판잣집 빈민가다. 구역마다 따로 된 확대 맵(city-capital-*)이 있다",
    build(b) {
      const ring = b.wallRing(0, 0, 120, 100, { name: "왕도 성벽" }), gx = ring.gx;
      b.exits([{ side: "south", at: gx, meets: "왕도 앞 들판(필드) 북쪽 출구" }]);
      const castle = b.landmark("castle", gx - 20, 9);
      b.roofGardens(castle);
      const gate = castle.doors[castle.doors.length >> 1];
      // Street grid: the gate avenue (x=gx), cross streets every 12 rows, side streets; a house row stands north of each.
      b.pave(b.ellipseCells(gx + 0.5, 68, 6.5, 3.2, 0.02), "cobble", { name: "십자로 광장" });
      b.put("광장 분수", gx - 1, 67, { purpose: "십자로 분수" });
      b.pave(b.rectCells(12, 58, 22, 9), "cobble", { name: "시장 광장" });
      b.put("광장 분수", 22, 61, { purpose: "시장 분수" });
      const W0 = 8, W1 = 111;
      b.spine([["exit:0", [gx, 92], [gx, 72]], [[gx, 64], [gx, gate.y + 1]],
        [[W0, 44], [W1, 44]], [[W0, 56], [W1, 56]], [[W0, 68], [gx - 7, 68]], [[gx + 7, 68], [W1, 68]], [[W0, 80], [W1, 80]], [[W0, 91], [W1, 91]],
        [[W0, 19], [37, 19]], [[W0, 31], [37, 31]], [[84, 19], [W1, 19]], [[84, 31], [W1, 31]],
        [[W0, 19], [W0, 91]], [[37, 19], [37, 44]], [[84, 19], [84, 44]], [[W1, 19], [W1, 91]],
        [[36, 44], [36, 91]], [[85, 44], [85, 91]], [[98, 56], [98, 91]], [[22, 67], [22, 91]]]);
      // North-west noble quarter, north-east cathedral quarter, the market square south-west, crafts south-east, slum by the south-west wall.
      b.rowAbove(19, 10, 36, NOBLE, { gap: 2 }); b.rowAbove(31, 10, 36, NOBLE.slice(1), { gap: 2 }); b.rowAbove(44, 10, 36, NOBLE.slice(2), { gap: 2 });
      b.landmark("church", 88, 21);
      b.landmark("graveyard", 99, 23);
      b.rowAbove(19, 86, 110, [COMMON[4], COMMON[0], COMMON[1]], { gap: 2 }); b.rowAbove(44, 86, 110, [COMMON[2], SHOPS[1]], { gap: 2 });
      b.rowAbove(56, 38, gx - 1, SHOPS, { gap: 1 }); b.rowAbove(56, gx + 1, 84, SHOPS.slice(1), { gap: 1 }); b.rowAbove(56, 86, 110, COMMON, { gap: 1 });
      b.rowAbove(56, 10, 35, [SHOPS[0], COMMON[1], SHOPS[4]], { gap: 1 });
      b.rowAbove(68, 38, gx - 7, COMMON, { gap: 1 }); b.rowAbove(68, gx + 7, 84, COMMON.slice(1), { gap: 1 }); b.rowAbove(68, 86, 110, CRAFT, { gap: 1 });
      b.rowAbove(80, 10, 21, COMMON.slice(3), { gap: 1 }); b.rowAbove(80, 23, 35, COMMON, { gap: 1 }); b.rowAbove(80, 38, gx - 1, COMMON.slice(2), { gap: 1 }); b.rowAbove(80, gx + 1, 84, CRAFT, { gap: 1 }); b.rowAbove(80, 86, 97, CRAFT.slice(2), { gap: 1 }); b.rowAbove(80, 99, 110, CRAFT, { gap: 1 });
      b.rowAbove(91, 10, 21, SLUM, { gap: 1 }); b.rowAbove(91, 23, 35, SLUM.slice(1), { gap: 1 }); b.rowAbove(91, 38, gx - 1, COMMON, { gap: 1 }); b.rowAbove(91, gx + 1, 84, COMMON.slice(2), { gap: 1 }); b.rowAbove(91, 86, 110, CRAFT, { gap: 1 });
      b.connect(); b.paintRoads("cobble"); b.plazaUnroad();
      b.props([["게시판", gx + 4, 64, "왕실 포고문", "십자로 광장"], ["줄무늬 노점 초록", 13, 59, "시장 노점", "시장 광장"], ["줄무늬 노점 빨강", 28, 59, "시장 노점", "시장 광장"], ["장터 노점", 13, 63, "시장 노점", "시장 광장"],
        ["줄무늬 노점 파랑", 28, 63, "시장 노점", "시장 광장"], ["과일 좌판", 17, 65, "시장 좌판", "시장 광장"], ["모닥불", 16, 88, "빈민가 모닥불", "빈민가"]]);
      b.yards();
      b.threes(348, 12, [8, 12, 104, 80]);
    },
  },
  {
    id: "city-capital-market", name: "은빛 왕도 · 시장 구역", category: "capital", tilesetId: F, fill: CITY_FILL, width: 64, height: 48, seed: 13101, plazaSq: 2,
    plaza: [["cobble", ["줄무늬 노점 빨강", "줄무늬 노점 파랑", "줄무늬 노점 초록", "과일 좌판", "돌등", "벤치"]]],
    purpose: "왕도 남서쪽 큰 장터. 네모난 돌 광장에 분수와 노점 줄, 둘레에 잡화점·여관·주점·무기점과 방어구점",
    note: "왕도 전경의 남서쪽을 확대한 구역. 가운데 네모난 장터 광장에 분수가 있고 차양 노점이 세 줄로 서며, 광장 둘레 길가에 잡화점·여관·주점·무기점·방어구점·집이 늘어선다. 북쪽 길은 동서 큰길로, 동쪽 길은 십자로 광장으로, 남쪽 길은 빈민가로 이어진다",
    build(b) {
      b.exits([{ side: "north", at: 32, meets: "왕도 동서 큰길(city-capital-overview)" }, { side: "east", at: 23, meets: "십자로 광장(city-capital-gate) 서쪽" }, { side: "south", at: 20, meets: "빈민가(city-capital-slums) 북쪽 출구" }]);
      b.pave(b.rectCells(15, 16, 34, 13), "cobble", { name: "장터 광장" });
      b.put("광장 분수", 30, 22, { purpose: "장터 분수" });
      b.spine([["exit:0", [32, 12]], [[5, 12], [58, 12]], [[5, 12], [5, 43]], [[58, 12], [58, 43]], [[5, 43], [58, 43]], [[50, 23], "exit:1"], ["exit:2", [20, 43]], [[32, 12], [32, 16]], [[20, 31], [20, 43]], [[44, 31], [44, 43]]]);
      b.rowAbove(12, 7, 30, SHOPS, { gap: 1 }); b.rowAbove(12, 34, 57, [SHOPS[3], SHOPS[1], COMMON[1]], { gap: 1 });
      b.rowAbove(43, 7, 19, COMMON.slice(2), { gap: 1 }); b.rowAbove(43, 22, 43, [SHOPS[4], COMMON[0], SHOPS[2]], { gap: 1 }); b.rowAbove(43, 46, 57, COMMON, { gap: 1 });
      b.connect(); b.paintRoads("cobble"); b.plazaUnroad();
      for (const [x, y, n] of [[16, 17, "줄무늬 노점 빨강"], [19, 17, "줄무늬 노점 파랑"], [22, 17, "줄무늬 노점 초록"], [37, 17, "줄무늬 노점 초록"], [40, 17, "줄무늬 노점 빨강"], [43, 17, "줄무늬 노점 파랑"],
        [16, 21, "장터 노점"], [19, 21, "줄무늬 노점 빨강"], [40, 21, "줄무늬 노점 초록"], [43, 21, "장터 노점"],
        [16, 25, "줄무늬 노점 초록"], [19, 25, "줄무늬 노점 파랑"], [22, 25, "장터 노점"], [37, 25, "줄무늬 노점 파랑"], [40, 25, "줄무늬 노점 빨강"], [43, 25, "줄무늬 노점 초록"]])
        b.props([[n, x, y, "장터 노점", "장터 광장"]]);
      b.props([["게시판", 34, 14, "장터 게시판", "장터 광장"], ["과일 상자", 25, 20, "노점 짐", "장터 광장"], ["술통", 46, 21, "노점 짐", "장터 광장"], ["항아리", 26, 28, "노점 짐", "장터 광장"]]);
      b.yards();
      b.scatterTrees(3, ["small-bush", "round-bush"]);
      b.threes(348, 4);
    },
  },
  {
    id: "city-capital-noble", name: "은빛 왕도 · 귀족 구역", category: "capital", tilesetId: F, fill: CITY_FILL, width: 60, height: 48, seed: 13201, plaza: [["cobble", ["꽃 화단", "화분", "돌등", "벤치"]]],
    purpose: "왕성 서쪽 귀족 저택가. 정원 딸린 2층 저택이 넓게 떨어져 서고, 가로수 길과 분수 정원, 북쪽은 왕성 안 성벽",
    note: "왕도 북서쪽을 확대한 구역. 북쪽을 왕성 안쪽 성벽이 가로막고(문루 하나로 성 안뜰에 닿는다), 그 아래 넓은 가로수 길 양쪽에 정원을 두른 2층 귀족 저택 여섯 채가 선다. 가운데 분수 정원에 화단과 벤치, 동쪽 길은 왕성 정문 앞, 남쪽 길은 동서 큰길로 이어진다",
    build(b) {
      const wall = b.wallLine(0, 0, 60, { name: "왕성 안 성벽" });
      b.exits([{ side: "east", at: 30, meets: "왕성 정문 앞(city-capital-overview)" }, { side: "south", at: 30, meets: "왕도 동서 큰길(city-capital-market) 북쪽" }]);
      b.pave(b.ellipseCells(30, 30, 7, 3.6, 0.03), "cobble", { name: "분수 정원" });
      b.put("광장 분수", 29, 29, { purpose: "정원 분수" });
      b.spine([["exit:0", [37, 30]], [[23, 30], [4, 30]], ["exit:1", [30, 34]], [[wall.gx, 8], [wall.gx, 26]], [[4, 20], [55, 20]], [[4, 20], [4, 43]], [[55, 20], [55, 43]], [[4, 43], [55, 43]]]);
      b.rowAbove(20, 6, 54, NOBLE, { gap: 4 });
      b.rowAbove(43, 6, 54, NOBLE.slice(1), { gap: 4 });
      b.connect(); b.paintRoads("cobble"); b.plazaUnroad();
      for (const x of [8, 14, 44, 50]) b.trees([["tree", x, 25]]);
      b.props([["꽃 화단", 24, 27, "정원 화단", "분수 정원"], ["꽃 화단", 35, 27, "정원 화단", "분수 정원"], ["벤치", 25, 33, "정원 벤치", "분수 정원"], ["벤치", 34, 33, "정원 벤치", "분수 정원"], ["돌 석상", 30, 25, "왕가 선조 석상", "분수 정원"]]);
      b.yards();
      b.threes(348, 8);
      b.threes(768, 4, null, 2);
    },
  },
  {
    id: "city-capital-slums", name: "은빛 왕도 · 성벽 밑 빈민가", category: "capital", tilesetId: F, fill: CITY_FILL, width: 56, height: 44, seed: 13301, theme: "ruins",
    purpose: "왕도 남서쪽 성벽 밑 빈민가. 판잣집이 다닥다닥 붙고 좁은 골목이 굽으며 빨랫줄·모닥불·부서진 울타리가 흩어진다",
    note: "남쪽을 바깥 성벽이 막고 선 빈민가. 판잣집과 허름한 헛간 열 채 남짓이 좁은 골목을 따라 다닥다닥 붙어 있다. 골목 가운데 공동 우물과 모닥불, 집마다 빨랫줄과 장작, 무너진 울타리. 북쪽 길은 시장 구역으로 이어진다",
    build(b) {
      b.wallLine(0, 36, 56, { name: "바깥 성벽", gate: false });
      b.exits([{ side: "north", at: 20, meets: "시장 구역(city-capital-market) 남쪽 출구" }]);
      b.put("낮은 돌 우물", 24, 21, { purpose: "공동 우물" });
      b.put("모닥불", 31, 22, { purpose: "골목 모닥불", owner: "골목" });
      b.spine([["exit:0", [20, 9]], [[3, 9], [52, 9]], [[3, 9], [3, 34]], [[52, 9], [52, 34]], [[3, 20], [52, 20]], [[3, 33], [52, 33]], [[14, 9], [14, 33]], [[40, 9], [40, 33]]]);
      b.rowAbove(9, 5, 51, SLUM, { gap: 1 });
      b.rowAbove(20, 5, 13, SLUM.slice(1), { gap: 1 }); b.rowAbove(20, 16, 39, SLUM, { gap: 1 }); b.rowAbove(20, 42, 51, SLUM.slice(2), { gap: 1 });
      b.rowAbove(33, 5, 13, SLUM, { gap: 1 }); b.rowAbove(33, 16, 39, SLUM.slice(1), { gap: 1 }); b.rowAbove(33, 42, 51, SLUM, { gap: 1 });
      b.connect(); b.paintRoads("road");
      b.props([["통나무 더미", 30, 23, "모닥불 둘레 통나무", "골목"], ["통나무 더미", 32, 23, "모닥불 둘레 통나무", "골목"], ["부서진 울타리", 16, 23, "무너진 울타리", "골목"], ["부서진 울타리", 17, 23, "무너진 울타리", "골목"], ["빨랫줄", 44, 22, "공동 빨래", "골목"], ["나무통", 27, 21, "우물 물통", "골목"]]);
      b.yards();
      b.threes(29, 4, null, 1);
    },
  },
  {
    id: "city-capital-temple", name: "은빛 왕도 · 신전 구역", category: "capital", tilesetId: F, fill: CITY_FILL, width: 60, height: 48, seed: 13401, plaza: [["cobble", ["돌등", "화분", "벤치", "흰 돌기둥"]]],
    purpose: "왕도 북동쪽 성당과 묘지, 성스러운 못의 신전 구역. 순례자 숙소와 수도원, 성당 앞 기둥 광장",
    note: "왕도 북동쪽을 확대한 구역. 북쪽 가운데 돌벽 대성당 앞에 흰 돌기둥이 둘러선 광장이 있고, 동쪽에 울타리 친 묘지 둘, 서쪽에 울타리 친 성스러운 못과 석상. 남쪽 길가엔 순례자 숙소·수도원·양초 가게. 서쪽 길은 왕성 앞, 남쪽 길은 동서 큰길로",
    build(b) {
      b.exits([{ side: "west", at: 22, meets: "왕성 정문 앞(city-capital-overview)" }, { side: "south", at: 30, meets: "왕도 동서 큰길" }]);
      const church = b.landmark("church", 26, 2);
      b.pave(b.ellipseCells(29.5, 16, 7, 3, 0.02), "cobble", { name: "성당 앞 광장" });
      b.landmark("graveyard", 42, 4); b.landmark("graveyard-small", 46, 14);
      b.landmark("shrine-pond", 3, 2);
      b.spine([["exit:0", [22, 22]], [[4, 22], [55, 22]], ["exit:1", [30, 22]], [[30, 12], [30, 22]], [[4, 22], [4, 43]], [[55, 22], [55, 43]], [[4, 43], [55, 43]], [[30, 22], [30, 43]]]);
      b.rowAbove(43, 6, 29, [["gable-2f-long", "slate-brick", "순례자 숙소", "laundry", "right"], ["gable-hall", "blue-stone", "수도원", "herbs", "right"], ["gable-house", "bright-plaster", "양초 가게", "shop", "right"]], { gap: 2 });
      b.rowAbove(43, 32, 54, [["gable-dormer", "slate-brick", "사제관", "garden", "right"], ["gable-cross-l", "moss-plaster", "약초 치료소", "herbs", "right"]], { gap: 2 });
      b.connect(); b.paintRoads("cobble"); b.plazaUnroad();
      for (const [x, y] of [[23, 14], [36, 14], [23, 17], [36, 17]]) b.props([["흰 돌기둥", x, y, "광장 기둥", "성당 앞 광장"]]);
      b.props([["돌 석상", 29, 18, "성인 석상", "성당 앞 광장"], ["벤치", 18, 19, "순례자 쉼터", "성당 앞 광장"]]);
      b.yards();
      b.forest({ bands: { east: [2, 1] }, blobs: [[58, 30, 4, 5, 10]], noise: 0.5 });
      b.threes(348, 8);
    },
  },
  {
    id: "city-capital-crafts", name: "은빛 왕도 · 장인 거리", category: "capital", tilesetId: F, fill: CITY_FILL, width: 60, height: 44, seed: 13501,
    purpose: "왕도 남동쪽 장인 거리. 대장간·목공소·무두장이·직조공방이 두 줄로 늘어서고 마당마다 작업 도구와 재료",
    note: "왕도 남동쪽을 확대한 구역. 동서로 두 줄 거리에 대장간·목공소·무두장이·직조공방이 늘어서고 마당마다 무기 거치대·장작·통나무·상자가 쌓였다. 거리 가운데 짐마차 쉼터(통나무·술통)와 우물, 동쪽 성벽 밑 창고. 서쪽 길은 십자로 광장, 북쪽 길은 동서 큰길로",
    build(b) {
      b.exits([{ side: "west", at: 21, meets: "십자로 광장(city-capital-gate)" }, { side: "north", at: 30, meets: "왕도 동서 큰길" }]);
      b.put("낮은 돌 우물", 29, 23, { purpose: "장인 거리 우물" });
      b.spine([["exit:0", [4, 21]], ["exit:1", [30, 9]], [[4, 9], [55, 9]], [[4, 21], [55, 21]], [[4, 34], [55, 34]], [[4, 9], [4, 34]], [[55, 9], [55, 34]], [[20, 21], [20, 34]], [[40, 21], [40, 34]]]);
      b.rowAbove(9, 6, 54, CRAFT, { gap: 1 });
      b.rowAbove(21, 6, 54, [...CRAFT.slice(1), CRAFT[0]], { gap: 1 });
      b.rowAbove(34, 6, 19, CRAFT, { gap: 1 }); b.rowAbove(34, 22, 39, [["gable-long", "slate-brick", "창고", "storage", "right"], CRAFT[2]], { gap: 1 }); b.rowAbove(34, 42, 54, CRAFT.slice(2), { gap: 1 });
      b.connect(); b.paintRoads("cobble");
      b.props([["통나무 더미", 26, 25, "짐마차 쉼터", "장인 거리"], ["술통", 33, 25, "짐마차 쉼터", "장인 거리"], ["나무 상자", 34, 25, "짐마차 쉼터", "장인 거리"]]);
      b.yards();
      b.threes(348, 5);
      b.scatterTrees(3, ["small-bush", "round-bush"]);
    },
  },
  {
    id: "city-capital-gate", name: "은빛 왕도 · 남문 광장", category: "capital", tilesetId: F, fill: CITY_FILL, width: 58, height: 46, seed: 13601, plaza: [["cobble", ["돌등", "벤치", "화분", "꽃 화단"]]],
    purpose: "왕도 남문 안쪽 광장. 두 원탑 문루가 지키는 성문, 경비 초소와 여관·마구간, 십자로 분수 광장까지 곧은 큰길",
    note: "남쪽 바깥 성벽 한가운데 두 원탑 문루가 선 성문으로 들어오면 넓은 문 안 광장. 동쪽에 경비 초소와 무기 거치대, 서쪽에 여관과 마구간, 큰길을 따라 북쪽으로 오르면 십자로 분수 광장이 나온다. 서쪽 길은 시장 구역, 동쪽 길은 장인 거리로",
    build(b) {
      const w = b.wallLine(0, 38, 58, { name: "왕도 남쪽 성벽" }), gx = w.gx;
      b.exits([{ side: "south", at: gx, meets: "왕도 앞 들판(필드) 북쪽 출구" }, { side: "north", at: gx, meets: "왕성 정문 앞(city-capital-overview)" }, { side: "west", at: 14, meets: "시장 구역(city-capital-market) 동쪽 출구" }, { side: "east", at: 14, meets: "장인 거리(city-capital-crafts) 서쪽 출구" }]);
      b.pave(b.ellipseCells(gx + 0.5, 30, 8, 3.4, 0.02), "cobble", { name: "문 안 광장" });
      b.pave(b.ellipseCells(gx + 0.5, 14, 6, 3, 0.02), "cobble", { name: "십자로 광장" });
      b.put("광장 분수", gx - 1, 13, { purpose: "십자로 분수" });
      b.spine([["exit:0", [gx, 36], [gx, 18]], [[gx, 10], "exit:1"], ["exit:2", [gx - 7, 14]], [[gx + 7, 14], "exit:3"], [[4, 25], [53, 25]], [[4, 14], [4, 25]], [[53, 14], [53, 25]]]);
      b.rowAbove(14, 6, gx - 7, SHOPS.slice(1), { gap: 1 }); b.rowAbove(14, gx + 7, 52, COMMON, { gap: 1 });
      b.rowAbove(25, 6, gx - 2, [["gable-2f-lean", "amber-brick", "여관", "tavern", "right"], ["gable-barn", "thatch-log", "마구간", "storage", "right"]], { gap: 2 });
      b.rowAbove(25, gx + 2, 52, [["gable-porch-wide", "slate-brick", "경비 초소", "guard", "right"], ["gable-long", "blue-stone", "세금 관청", "storage", "right"]], { gap: 2 });
      b.connect(); b.paintRoads("cobble"); b.plazaUnroad();
      b.props([["무기 거치대", gx + 4, 33, "문 안 창걸이", "문 안 광장"], ["무기 거치대", gx - 4, 33, "문 안 창걸이", "문 안 광장"], ["게시판", gx + 5, 28, "성문 포고문", "문 안 광장"], ["통나무 더미", 10, 31, "마구간 여물", "마구간"]]);
      b.yards();
      b.threes(348, 5);
      b.scatterTrees(3, ["small-bush", "round-bush"]);
    },
  },
];
