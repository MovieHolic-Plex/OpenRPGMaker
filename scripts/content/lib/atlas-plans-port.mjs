// Atlas towns · ports: a small harbour village, the harbour metropolis 「청파항」 (whole city and its districts, the
// harbour district also as a lantern-festival night), a fishing cove and a palm-beach fishing village (desert sheet).
// Boats are real boat art only: the rowboat of the harbour kit and the docked sailing ship 「푸른물결호」 (atlas parts).
import { CITY_FILL } from "./atlas-plans-capital.mjs";
const F = "forest_harmony", SAND = "forest_harmony_desert";
const WARE = [["gable-long", "slate-brick", "창고", "storage", "right"], ["gable-2f-long", "amber-brick", "상관", "storage", "right"], ["gable-long-step", "slate-wood", "창고", "storage", "right"], ["gable-hall", "timber-hall", "선구점", "shop", "right"]];
const PORTFOLK = [["gable-house", "slate-wood", "뱃사람 집", "fishing", "right"], ["gable-twin", "bright-plaster", "집", "laundry", "right"], ["gable-2f-narrow", "blue-stone", "집", null, null], ["gable-cross-r", "slate-brick", "집", "laundry", "left"], ["gable-steep", "thatch-plaster", "어부 집", "fishing", "right"]];
const TAVERN = [["gable-2f-lean", "amber-brick", "뱃사람 주점", "tavern", "right"], ["gable-2f-porch", "charcoal-timber", "여관", "tavern", "right"], ["gable-twin-big", "bright-plaster", "잡화점", "shop", "right"]];

// The harbour district of 청파항 (day, or the lantern-festival night): a stone quay along the sea, the sailing ship at
// the long pier, rowboats at the short ones, warehouses and taverns on the quay street.
function harbourDistrict(b, state = "day") {
  const night = state === "festival";
  b.waterWhere((x, y) => y > 30 + 1.2 * Math.sin(x / 9));
  b.smoothWater(); b.paintWater();
  b.exits([{ side: "north", at: 20, meets: "청파항 어시장 거리(city-port-market) 남쪽" }, { side: "west", at: 24, meets: "해안길(필드) 동쪽 출구" }, { side: "east", at: 24, meets: "청파항 조선소 쪽 해안" }]);
  const quay = b.pave(b.rectCells(0, 25, b.W, 4).filter((i) => !b.water.has(i)), "cobble");
  b.spine([["exit:1", [4, 26], [b.W - 5, 26], "exit:2"], ["exit:0", [20, 14], [20, 26]], [[4, 14], [b.W - 5, 14]], [[4, 14], [4, 26]], [[b.W - 5, 14], [b.W - 5, 26]], [[40, 14], [40, 26]]]);
  b.rowAbove(14, 6, b.W - 6, [...TAVERN, PORTFOLK[1]], { gap: 1 });
  b.rowAbove(26, 6, 19, WARE.slice(0, 2), { gap: 1 }); b.rowAbove(26, 22, 39, WARE.slice(1), { gap: 1 }); b.rowAbove(26, 42, b.W - 6, WARE, { gap: 1 });
  b.connect(); b.paintRoads("cobble"); b.plazaUnroad();
  // Long pier with the sailing ship alongside; two short piers with rowboats.
  const long = b.pier(12, 29, "south", 12, 2);
  b.moorNear("범선 푸른물결호", 15, 32, { purpose: "먼 바다를 오가는 범선" }, 4);
  b.pier(50, 29, "south", 6); b.pier(58, 29, "south", 6);
  b.moorNear("나룻배", 51, 36, { purpose: "짐 나르는 나룻배" }); b.moorNear("나룻배", 58, 40, { purpose: "고깃배" });
  b.posts([[11, 33], [11, 37], [49, 32], [57, 33]]);
  b.props([["부두 상자", 8, 27, "부두 짐", "부두"], ["부두 상자", 9, 27, "부두 짐", "부두"], ["부두 술통", 15, 27, "부두 짐", "부두"], ["밧줄 뭉치", 16, 27, "부두 짐", "부두"], ["닻", 47, 27, "부두 짐", "부두"],
    ["열린 물통", 53, 27, "부두 짐", "부두"], ["부두 상자", 61, 27, "부두 짐", "부두"], ["나무 이정표", 23, 16, "부두 가는 길 표지"]]);
  if (night) {
    b.night(0.5, "#141c3c");
    // Lantern strings over the quay street and the tavern street, festival tents on the quay.
    for (const [x0, x1, y] of [[5, 18, 24], [22, 38, 24], [42, 58, 24], [5, 18, 12], [22, 38, 12], [42, 58, 12]]) b.streamer(x0, x1, y, { string: y === 24 ? "등롱 줄" : "축제 깃발 줄" });
    b.props([["붉은 축제 천막", 28, 29, "축제 먹거리 천막", "부두 축제"], ["줄무늬 노점 빨강", 33, 29, "축제 노점", "부두 축제"], ["모닥불", 26, 30, "축제 모닥불", "부두 축제"]]);
  }
  b.yards();
  b.threes(348, 4, [0, 0, b.W, 12]);
}

export const PORT_PLANS = [
  {
    id: "town-port-small", name: "갈매기 모래톱 항구 마을", category: "port", tilesetId: F, width: 50, height: 40, seed: 14101, plaza: [["cobble", ["벤치", "돌등", "화분"]]],
    purpose: "해안 작은 항구 마을. 반달 모양 만에 선착장 셋, 물가 생선 좌판과 그물 손질터, 언덕 쪽 집과 여관",
    note: "남쪽이 반달 모양 만인 항구 마을. 물가 돌길에 생선 좌판과 그물 말리는 빨랫줄, 선착장 셋에 나룻배가 매였다. 북쪽 비탈에 여관·잡화점·어부 집이 모이고, 가운데 우물 마당. 북서쪽 숲길로 들어온다",
    build(b) {
      b.waterWhere((x, y) => ((x - 25) / 23) ** 2 + ((y - 44) / 16) ** 2 < 1);
      b.smoothWater(); b.paintWater();
      b.exits([{ side: "west", at: 14, meets: "해안 숲길(필드) 동쪽 출구" }, { side: "north", at: 30, meets: "언덕길(필드) 남쪽 출구" }]);
      b.pave(b.ellipseCells(25, 18, 4.5, 2.4, 0.05), "cobble", { name: "우물 마당" });
      b.put("낮은 돌 우물", 24, 17, { purpose: "마당 우물" });
      b.spine([["exit:0", [8, 14], [20, 18]], [[30, 18], "exit:1"], [[25, 21], [25, 26]], [[6, 26], [44, 26]]]);
      b.homes([
        ["gable-2f-lean", "amber-brick", 3, 2, "여관", "tavern", "right"],
        ["gable-twin", "bright-plaster", 14, 3, "잡화점", "shop", "right"],
        ["gable-house", "slate-wood", 35, 3, "어부 집", "fishing", "left"],
        ["gable-long", "slate-brick", 36, 16, "생선 창고", "storage", "right"],
        ["gable-steep", "thatch-plaster", 4, 16, "어부 집", "fishing", "right"],
      ], 5);
      b.connect(); b.paintRoads(); b.plazaUnroad();
      b.pier(14, 28, "south", 4); b.pier(25, 28, "south", 5); b.pier(36, 28, "south", 4);
      b.moorNear("나룻배", 16, 33, { purpose: "고깃배" }); b.moorNear("나룻배", 29, 34, { purpose: "고깃배" });
      b.posts([[13, 31], [24, 32], [35, 31]]);
      b.props([["과일 좌판", 19, 27, "생선 좌판", "부두"], ["과일 좌판", 31, 27, "생선 좌판", "부두"], ["빨랫줄", 8, 27, "그물 말리기", "부두"], ["부두 술통", 22, 27, "부두 짐", "부두"], ["밧줄 뭉치", 40, 27, "부두 짐", "부두"], ["닻", 11, 28, "부두 짐", "부두"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], west: [2, 1], east: [2, 1] }, blobs: [[48, 22, 3, 4, 8], [1, 23, 3, 3, 6]] });
      b.edgeClumps(3);
      b.tallGrass(4, [5, 8]);
      b.threes(348, 5);
    },
  },
  {
    id: "city-port-overview", name: "항구 대도시 청파항 · 전경", category: "port", tilesetId: F, fill: CITY_FILL, width: 110, height: 96, seed: 14201, tries: 4,
    plaza: [["cobble", ["벤치", "돌등", "화분", "꽃 화단", "줄무늬 노점 파랑", "줄무늬 노점 초록"]]],
    purpose: "바다 무역으로 사는 항구 대도시 전경. 북쪽 성벽과 성문, 성당 광장과 시장, 부두 거리의 창고와 주점, 남쪽 바다에 범선과 나룻배, 돌 방파제 끝 등대",
    note: "110×96 대도시. 북쪽 성벽 한가운데 문루로 들어와 큰길을 따라 내려가면 성당 광장, 분수 시장 광장을 지나 동서로 긴 돌 부두에 닿는다. 부두 거리엔 창고·상관·선구점·주점이 늘어서고, 긴 잔교에 범선 「푸른물결호」가, 짧은 잔교들에 나룻배가 매였다. 동쪽 방파제 끝에 원탑 등대. 확대 맵: 항만 구역(city-port-harbor)·어시장 거리(city-port-market)",
    build(b) {
      const wall = b.wallLine(0, 0, 110, { name: "청파항 성벽" }), gx = wall.gx;
      b.waterWhere((x, y) => y > 70 + 1.5 * Math.sin(x / 8) || (x > 92 && y > 64 + (x - 92) * 0.2));
      b.unwater((x, y) => x >= 96 && x <= 99 && y >= 60 && y <= 90); // the breakwater
      b.smoothWater(); b.paintWater();
      b.exits([{ side: "north", at: gx, meets: "내륙 큰길(필드) 남쪽 출구" }, { side: "west", at: 64, meets: "서쪽 해안길(필드) 동쪽 출구" }]);
      b.landmark("church", 20, 12);
      b.pave(b.ellipseCells(gx + 0.5, 22, 7, 3.2, 0.02), "cobble", { name: "성당 광장" });
      b.pave(b.rectCells(64, 36, 18, 9), "cobble", { name: "분수 시장" });
      b.put("광장 분수", 72, 39, { purpose: "시장 분수" });
      b.put("광장 분수", gx - 1, 21, { purpose: "광장 분수" });
      const qy = 66;
      b.pave(b.rectCells(0, qy - 1, 96, 4).filter((i) => !b.water.has(i)), "cobble");
      b.spine([["exit:0", [gx, 10], [gx, 18]], [[gx, 26], [gx, qy]], [[4, 14], [104, 14]], [[4, 30], [104, 30]], [[4, 46], [104, 46]], [[4, 56], [104, 56]], ["exit:1", [4, qy], [95, qy], [97, qy], [97, 79]],
        [[4, 14], [4, qy]], [[104, 14], [104, 56]], [[30, 30], [30, qy]], [[82, 30], [82, qy]]]);
      b.rowAbove(30, 30, gx - 8, TAVERN, { gap: 1 }); b.rowAbove(30, gx + 8, 103, PORTFOLK, { gap: 1 }); b.rowAbove(30, 6, 28, PORTFOLK.slice(2), { gap: 1 });
      b.rowAbove(46, 6, 29, PORTFOLK, { gap: 1 }); b.rowAbove(46, 32, gx - 1, TAVERN.slice(1), { gap: 1 }); b.rowAbove(46, gx + 1, 62, PORTFOLK.slice(1), { gap: 1 }); b.rowAbove(46, 84, 103, PORTFOLK, { gap: 1 });
      b.rowAbove(56, 6, 29, WARE, { gap: 1 }); b.rowAbove(56, 32, 81, [...WARE, TAVERN[0]], { gap: 1 }); b.rowAbove(56, 84, 103, WARE.slice(1), { gap: 1 });
      b.rowAbove(qy, 6, 29, WARE.slice(2), { gap: 1 }); b.rowAbove(qy, 32, gx - 1, WARE, { gap: 1 }); b.rowAbove(qy, gx + 1, 94, [TAVERN[0], ...WARE], { gap: 1 });
      b.rowAbove(14, gx + 8, 103, PORTFOLK.slice(1), { gap: 1 });
      b.connect(); b.paintRoads("cobble"); b.plazaUnroad();
      b.pier(20, qy + 2, "south", 14, 2);
      b.moorNear("범선 푸른물결호", 23, 74, { purpose: "먼 바다를 오가는 범선" }, 5);
      b.pier(60, qy + 2, "south", 8); b.pier(76, qy + 2, "south", 8);
      b.moorNear("나룻배", 62, 76, { purpose: "짐배" }); b.moorNear("나룻배", 78, 80, { purpose: "고깃배" }); b.moorNear("나룻배", 66, 86, { purpose: "고깃배" });
      // Lighthouse: a round wall tower at the end of the breakwater.
      b.tower(97, 81, "방파제 등대");
      b.props([["줄무늬 노점 빨강", 65, 37, "시장 노점", "분수 시장"], ["줄무늬 노점 초록", 77, 37, "시장 노점", "분수 시장"], ["장터 노점", 65, 42, "시장 노점", "분수 시장"], ["줄무늬 노점 파랑", 77, 42, "시장 노점", "분수 시장"],
        ["부두 상자", 12, qy + 1, "부두 짐", "부두"], ["부두 술통", 24, qy + 1, "부두 짐", "부두"], ["밧줄 뭉치", 57, qy + 1, "부두 짐", "부두"], ["닻", 72, qy + 1, "부두 짐", "부두"]]);
      b.yards();
      b.threes(348, 10, [4, 10, 100, 50]);
    },
  },
  {
    id: "city-port-harbor", name: "청파항 · 항만 구역", category: "port", tilesetId: F, fill: CITY_FILL, width: 66, height: 46, seed: 14301, pair: "city-port-harbor", state: "낮",
    purpose: "항구 대도시 청파항의 부두. 돌 부두 거리에 창고·상관·선구점, 윗길에 주점과 여관, 긴 잔교의 범선과 짧은 잔교의 나룻배",
    note: "남쪽 절반이 바다. 동서로 긴 돌 부두를 따라 창고·상관·선구점이 서고, 한 줄 위 길에 뱃사람 주점·여관·잡화점. 서쪽 긴 잔교에 범선 「푸른물결호」가 대어 있고, 동쪽 짧은 잔교 둘에 나룻배. 부두 뿌리마다 상자·술통·밧줄·닻이 쌓였다. 북쪽 길은 어시장 거리로, 동서 길은 해안으로",
    build: (b) => harbourDistrict(b, "day"),
  },
  {
    id: "city-port-harbor-festival", name: "청파항 · 등불 축제의 밤", category: "port", tilesetId: F, fill: CITY_FILL, width: 66, height: 46, seed: 14301, pair: "city-port-harbor", state: "밤 축제",
    purpose: "청파항 항만 구역의 등불 축제 밤. 부두 거리와 주점 거리 위로 등롱 줄과 깃발 줄이 걸리고, 부두에 붉은 축제 천막과 모닥불",
    note: "「청파항 · 항만 구역」과 같은 배치의 밤(푸른 어둠 조명, 등롱·모닥불 불빛). 두 길 위를 등롱 기둥 사이 등롱 줄(부두)과 삼색 깃발 줄(주점 거리)이 가로지르고, 부두 한가운데 붉은 축제 천막·노점·모닥불이 섰다",
    build: (b) => harbourDistrict(b, "festival"),
  },
  {
    id: "city-port-market", name: "청파항 · 어시장 거리", category: "port", tilesetId: F, fill: CITY_FILL, width: 60, height: 44, seed: 14401,
    plaza: [["cobble", ["줄무늬 노점 파랑", "과일 좌판", "돌등", "벤치", "나무통"]]], plazaSq: 2,
    purpose: "청파항 부두 위 어시장 거리. 두 줄 노점 사이 좁은 길, 생선 좌판과 얼음 통, 둘레에 주점·생선 가게·소금 창고",
    note: "항만 구역 바로 윗 거리. 가운데 긴 돌 장터에 파랑·초록 차양 노점이 두 줄로 서서 생선과 조개를 팔고, 노점 사이마다 통과 상자가 놓였다. 둘레 길가에 주점·생선 가게·소금 창고·집. 남쪽 길은 항만 구역, 북쪽 길은 성당 광장으로",
    build(b) {
      b.exits([{ side: "south", at: 20, meets: "청파항 · 항만 구역 북쪽 출구" }, { side: "north", at: 30, meets: "청파항 성당 광장" }]);
      b.pave(b.rectCells(10, 16, 40, 10), "cobble", { name: "어시장" });
      b.spine([["exit:0", [20, 38]], ["exit:1", [30, 12]], [[4, 12], [55, 12]], [[4, 38], [55, 38]], [[4, 12], [4, 38]], [[55, 12], [55, 38]], [[20, 26], [20, 38]], [[40, 26], [40, 38]]]);
      b.rowAbove(12, 6, 54, [...TAVERN, ...PORTFOLK.slice(0, 2)], { gap: 1 });
      b.rowAbove(38, 6, 19, WARE.slice(0, 2), { gap: 1 }); b.rowAbove(38, 22, 39, [PORTFOLK[3], WARE[3]], { gap: 1 }); b.rowAbove(38, 42, 54, PORTFOLK, { gap: 1 });
      b.connect(); b.paintRoads("cobble"); b.plazaUnroad();
      for (let x = 11; x <= 44; x += 4) b.props([[x % 8 === 3 ? "줄무늬 노점 파랑" : "줄무늬 노점 초록", x, 17, "생선 노점", "어시장"]]);
      for (let x = 11; x <= 44; x += 4) b.props([[x % 8 === 3 ? "줄무늬 노점 초록" : "줄무늬 노점 파랑", x, 22, "생선 노점", "어시장"]]);
      b.props([["나무통", 14, 20, "얼음 통", "어시장"], ["부두 상자", 26, 20, "생선 상자", "어시장"], ["나무통", 38, 20, "얼음 통", "어시장"], ["부두 술통", 46, 20, "소금 통", "어시장"]]);
      b.yards();
      b.threes(348, 4);
    },
  },
  {
    id: "town-fishing-cove", name: "조개껍데기 만 어촌", category: "port", tilesetId: F, width: 48, height: 40, seed: 14501,
    purpose: "절벽에 둘러싸인 좁은 만 안쪽의 작은 어촌. 만 안 선착장 둘, 절벽 위 망루 집, 돌계단으로 오르내린다",
    note: "남쪽 바다에서 좁은 만이 북쪽으로 파고들고 양쪽은 절벽이다. 만 안쪽 모래밭에 어부 집 넷과 그물 헛간, 선착장 둘에 나룻배. 서쪽 절벽 윗단엔 바다를 살피는 망루 집이 있고 돌계단으로 오른다. 북쪽 숲길로 들어온다",
    leak: false,
    build(b) {
      b.cliffs([{ points: [[0, 18], [8, 18], [10, 19], [14, 19]], height: 4, left: "open", right: "open" }]);
      b.waterWhere((x, y) => (y > 24 && Math.abs(x - 24) < 7 + (y - 24) * 0.6) || y > 35);
      b.smoothWater(); b.paintWater();
      b.stairs([[10, 19, 4]]);
      b.exits([{ side: "north", at: 26, meets: "해안 숲길(필드) 남쪽 출구" }]);
      b.spine([["exit:0", [26, 14], [26, 22]], [[12, 22], [38, 22]], ["stairs-bottom:0", [12, 22]], ["stairs-top:0", [8, 12]]]);
      b.homes([
        ["gable-long-low", "slate-wood", 2, 8, "망루 집", "guard", "right"],
        ["gable-house", "thatch-log", 15, 11, "어부 집", "fishing", "right"],
        ["gable-steep", "slate-wood", 31, 10, "어부 집", "fishing", "right"],
        ["gable-long-low", "thatch-plaster", 38, 14, "그물 헛간", "storage", "left"],
        ["gable-house", "blue-stone", 18, 1, "촌장 집", "laundry", "right"],
      ], 4);
      b.connect(); b.paintRoads();
      b.pier(20, 24, "south", 4); b.pier(28, 24, "south", 4);
      b.moorNear("나룻배", 22, 30, { purpose: "고깃배" });
      b.props([["부두 상자", 18, 24, "부두 짐", "부두"], ["밧줄 뭉치", 30, 24, "부두 짐", "부두"], ["빨랫줄", 34, 21, "그물 말리기", "그물 헛간"], ["모닥불", 24, 20, "어부들 모닥불", "부두"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1.5], east: [3, 1.5] }, blobs: [[46, 30, 4, 6, 10], [2, 32, 4, 4, 8]] });
      b.edgeClumps(3);
      b.tallGrass(4, [5, 8]);
      b.threes(537, 3);
    },
  },
  {
    id: "town-palm-beach", name: "야자 모래톱 어촌", category: "port", tilesetId: SAND, width: 52, height: 40, seed: 14601,
    purpose: "남쪽 바다 모래 해변의 어촌. 야자수가 물가를 두르고 흙벽 집 다섯, 선착장 둘과 나룻배, 그물 말리는 빨랫줄",
    note: "남쪽 바다에 닿은 모래 해변 어촌. 물가를 야자수가 두르고 흙빛 집 다섯이 모래길을 따라 선다. 선착장 둘에 나룻배가 매였고 모래밭엔 사구와 모래 물결. 서쪽과 동쪽 해안길로 나간다",
    fill: { flowerCap: 0, spotCap: 4, palette: { stands: 2.6 } },
    build(b) {
      b.waterWhere((x, y) => y > 30 + 1.8 * Math.sin(x / 5.5));
      b.smoothWater(); b.paintWater();
      b.exits([{ side: "west", at: 20, meets: "서쪽 해안길(필드) 동쪽 출구" }, { side: "east", at: 20, meets: "동쪽 해안길(필드) 서쪽 출구" }]);
      b.spine([["exit:0", [10, 20], [42, 20], "exit:1"]]);
      b.homes([
        ["gable-house", "amber-wood", 4, 10, "어부 집", "fishing", "right"],
        ["gable-long", "bright-plaster", 14, 11, "그물 창고", "storage", "right"],
        ["gable-twin", "amber-wood", 26, 10, "여관", "tavern", "right"],
        ["gable-steep", "bright-plaster", 40, 9, "어부 집", "fishing", "left"],
        ["gable-long-low", "amber-wood", 20, 24, "생선 가게", "desert", "right"],
      ], 5);
      b.connect(); b.paintRoads();
      b.pier(12, 26, "south", 4); b.pier(38, 26, "south", 4);
      b.moorNear("나룻배", 14, 32, { purpose: "고깃배" }); b.moorNear("나룻배", 40, 33, { purpose: "고깃배" });
      b.props([["빨랫줄", 30, 24, "그물 말리기", "부두"], ["부두 술통", 36, 26, "부두 짐", "부두"], ["밧줄 뭉치", 10, 26, "부두 짐", "부두"]]);
      b.singlesWhere(770, 10, (x, y) => b.nearWater(x, y, 2) && !b.water.has(b.at(x, y)), 3, { shore: true });
      b.yards();
    },
  },
];
