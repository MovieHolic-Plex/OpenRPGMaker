// Plans of tiledata/rpg-outdoors. Each build(b) paints one map with the OutdoorMap builder and returns the check entry
// (defaults to the first exit). Coordinates are 0-based cells. Terrain and placement only; exits only say what they meet.
import { carveReference } from "./outdoor-kit.mjs";
import { CLIMATE_FIELD_PLANS } from "./rpg-outdoor-climate-fields.mjs";
import { ARCHIPELAGO_WORLD, ROUND2_PLANS } from "./rpg-outdoor-round2.mjs";
const F = "forest_harmony";
const CASTLE_TOWN = "src/project/regionReferences/castle-town.json";
// Column of the carved piece whose bottom row is the middle of the cobble gate.
const gateColumn = (piece) => { const row = piece.lower.slice((piece.h - 1) * piece.w); const xs = row.map((t, x) => [t, x]).filter(([t]) => t === 190).map(([, x]) => x); return xs[xs.length >> 1]; };

export const PLANS = [
  {
    id: "outdoor-border-fortress", name: "잿빛 고개 국경 관문", category: "towns", tilesetId: F, width: 50, height: 40, seed: 3401,
    purpose: "두 나라를 가르는 고갯길의 관문 요새. 성벽 문 하나로만 넘어가고, 남쪽에 수비대 막사와 천막 야영지",
    note: "양쪽 절벽 사이 고갯길을 성벽이 가로막고 가운데 두 원탑이 지키는 문루 하나로만 넘어간다. 남쪽(우리 땅)에 수비대 막사·천막·모닥불·무기 거치대, 북쪽(국경 너머)으로 길이 이어진다",
    leak: false,
    build(b) {
      const wall = carveReference(CASTLE_TOWN, [3, 89, 96, 96], 30, 8, { blank: [[7, 89, 92, 89]] });
      const wx = 10, wy = 13, gx = wx + gateColumn(wall);
      b.cliffs([{ points: [[0, 15], [4, 15], [6, 16], [9, 16]], height: 4, left: "open", right: "open" }, { points: [[40, 16], [44, 16], [46, 15], [49, 15]], height: 4, left: "open", right: "open" }]);
      b.stampPiece("국경 성벽 · 왕궁이 있는 이중 성벽 도시의 남벽", wx, wy, wall.w, wall.h, wall.lower, wall.upper);
      // The gate is a gatehouse (문루), not a bare gap: a round tower raised on each side of the gate.
      { const row = wall.lower.slice((wall.h - 1) * wall.w), xs = row.map((t, x) => [t, x]).filter(([t]) => t === 190).map(([, x]) => x);
        b.gateTowers(wx, wy, wx + xs[0], xs[xs.length - 1] - xs[0] + 1); }
      b.peek("wall");
      b.exits([{ side: "south", at: gx, meets: "왕도로 가는 필드 북쪽 출구" }, { side: "north", at: gx, meets: "국경 너머 산길(필드) 남쪽 출구" }]);
      b.house(7, 30, 25, { role: "수비대 막사", yard: "guard", side: "right", window: 87 });
      b.house(3, 8, 26, { role: "관문지기 집", yard: "storage", side: "right", window: 86 });
      b.spine([["exit:0", [gx, 30], [gx, wy + 8]], [[gx, wy - 1], [gx, 6], "exit:1"]]);
      b.connect();
      b.paintRoads();
      b.props([["천막", 15, 30, "수비병 천막"], ["천막", 19, 33, "수비병 천막"], ["모닥불", 19, 29, "야영 모닥불"], ["통나무 더미", 17, 28], ["통나무 더미", 21, 28],
        ["무기 거치대", gx - 3, 23, "성문 앞 창걸이", "문루"], ["무기 거치대", gx + 3, 23, "성문 앞 창걸이", "문루"], ["나무 이정표", gx + 2, 8, "국경 표지"], ["나무 상자", 38, 32], ["술통", 39, 32]]);
      b.yards();
      b.forest({ bands: { west: [6, 2], east: [6, 2], north: [2, 1.5] }, blobs: [[4, 9, 7, 8, 14], [46, 9, 7, 8, 14], [3, 36, 6, 5, 10], [47, 36, 6, 5, 10]], clear: [[gx, 6, 7, 5, 10]] });
      b.edgeClumps(3);
      b.tallGrass(3, [5, 9], [2, 2, 46, 10]);
      b.threes(348, 3);
      b.seals = [{ name: "성문 닫힘", close: [[gx - 1, wy + 4], [gx, wy + 4], [gx + 1, wy + 4], [gx - 2, wy + 4], [gx + 2, wy + 4]], target: b.exitList[1].inner }];
    },
  },
  {
    id: "outdoor-royal-capital", plaza: [["cobble", ["꽃 화단", "벤치", "돌등", "화분", "과일 좌판"]]], name: "왕도 은빛 성곽", category: "towns", tilesetId: F, width: 74, height: 78, seed: 3301,
    purpose: "왕이 사는 성과 그 아래 성곽 도시. 남문 → 광장 → 궁 정문으로 이어지는 큰길, 광장 둘레 가게와 집 열 채",
    note: "사방을 두른 두 겹 성벽 안 맨 윗단에 층층 궁이 서고, 남문에서 올라온 돌길 큰길이 분수 우물 광장을 지나 궁 정문 계단에 닿는다. 광장 둘레에 가게·대장간·주막, 궁 양옆과 아랫마을에 집들이 붙어 있다. 궁 안뜰은 화단·화분·등불·분수를 들인 정원이다",
    build(b) {
      const ring = carveReference(CASTLE_TOWN, [3, 8, 96, 96], 72, 74, { blank: [[7, 15, 92, 89]] });
      b.stampPiece("성곽 · 왕궁이 있는 이중 성벽 도시에서 자른 성벽 고리와 남문", 1, 1, ring.w, ring.h, ring.lower, ring.upper);
      const gx = 1 + gateColumn(ring);
      // The castle's stone courts become gardens: flower beds, planters, lamps and fountains (no bare grey court).
      b.roofGardens(b.landmark("castle", gx - 20, 9));
      b.peek("ring");
      b.exits([{ side: "south", at: gx, meets: "왕도 앞 들판(필드) 북쪽 출구" }]);
      const plaza = b.pave(b.ellipseCells(gx + 0.5, 55, 8.5, 4, 0.08), "cobble", { name: "분수 광장" });
      b.put("낮은 돌 우물", gx, 54, { purpose: "광장 한가운데 분수 우물" });
      for (const [x, y] of [[gx - 3, 53], [gx + 4, 53], [gx - 3, 57], [gx + 4, 57]]) b.put("돌등", x, y, { purpose: "광장 가로등" });
      b.house(4, 6, 44, { role: "대장간", yard: "smith", side: "right", window: 87 });
      b.house(2, 17, 44, { role: "잡화점", yard: "shop", side: "right", window: 85 });
      b.house(0, 47, 44, { role: "주막", yard: "tavern", side: "right", window: 86 });
      b.house(7, 58, 45, { role: "창고", yard: "storage", side: "front", window: 87 });
      b.house(1, 6, 57, { role: "집", yard: "laundry", side: "right", window: 85 });
      b.house(3, 19, 58, { role: "약초집", yard: "herbs", side: "right", window: 86 });
      b.house(5, 50, 58, { role: "집", yard: "garden", side: "right", window: 85 });
      b.house(6, 60, 58, { role: "집", yard: "laundry", side: "left", window: 86 });
      b.house(0, 6, 12, { role: "근위대 막사", yard: "guard", side: "front", window: 87 });
      b.house(3, 8, 27, { role: "집", yard: "garden", side: "front", window: 85 });
      b.house(2, 60, 12, { role: "궁정 마구간지기 집", yard: "storage", side: "front", window: 86 });
      b.house(5, 61, 27, { role: "집", yard: "bees", side: "front", window: 85 });
      b.spine([["exit:0", [gx, 58], [gx, 50], [gx, 43]], [[gx - 8, 55], [gx - 20, 55], [12, 55]], [[gx + 9, 55], [gx + 20, 55], [62, 55]], [[gx, 43], [12, 43], [12, 38], [12, 22]], [[gx, 43], [63, 43], [63, 38], [63, 22]]]);
      b.connect();
      b.paintRoads("cobble");
      b.props([["장터 노점", gx - 8, 51, "광장 노점"], ["장터 노점", gx + 7, 51, "광장 노점"], ["과일 좌판", gx - 7, 59, "광장 좌판"], ["벤치", gx + 7, 59, "광장 쉼터"],
        ["꽃 화단", gx - 3, 47], ["꽃 화단", gx + 3, 47], ["게시판", gx + 3, 61, "왕실 포고문"]]);
      b.yards();
      b.threes(348, 6, [5, 8, 64, 58]);
      b.scatterTrees(4, ["small-bush", "round-bush"], [5, 44, 64, 22]);
      b.forest({ bands: { south: [2, 1], west: [1, 0.5], east: [1, 0.5], north: [1, 0.5] }, noise: 0.5 });
    },
  },
  {
    id: "outdoor-fairy-spring", name: "요정 샘 신성한 숲", category: "sacred", tilesetId: F, width: 36, height: 30, seed: 3102,
    purpose: "요정·정령을 만나는 숲속 성소. 샘 둘레 꽃 고리와 석상, 돌등 두 쌍",
    note: "짙은 숲 한가운데 둥근 빈터에 맑은 샘이 있고, 북쪽 물가에 석상과 마법진, 둘레에 들꽃 고리와 돌등이 선다. 남쪽 숲길 하나로만 들어온다",
    build(b) {
      b.pond(18, 12, 5.6, 3.4, 0.12); b.smoothWater(); b.paintWater();
      b.exits([{ side: "south", at: 18, meets: "숲길(필드)" }]);
      b.spine([["exit:0", [18, 22], [17, 18]]]);
      b.paintRoads();
      b.props([["돌 석상", 17, 5, "샘을 지키는 요정상"], ["마법진", 17, 7, "소원을 비는 자리"], ["흰 돌기둥", 11, 7], ["흰 돌기둥", 24, 7],
        ["돌등", 15, 19], ["돌등", 20, 19], ["돌등", 10, 13, "샘가 등불", "요정 샘"], ["돌등", 26, 13, "샘가 등불", "요정 샘"], ["징검돌", 12, 17]]);
      b.threes(348, 8, [6, 4, 24, 18]);
      b.threes(768, 3, [5, 4, 26, 18], 2);
      b.forest({ bands: { north: [4, 1.5], south: [5, 2], west: [6, 2], east: [6, 2] }, blobs: [[3, 26, 8, 6, 14], [33, 26, 7, 6, 14], [3, 3, 6, 5, 12], [33, 3, 6, 5, 12]], clear: [[18, 12, 13, 9, 20]] });
      b.edgeClumps(4, ["tree", "round-bush", "small-bush"]);
      b.tallGrass(3, [4, 8]);
    },
  },
  {
    id: "outdoor-fishing-village", name: "갈매기 어촌", category: "towns", tilesetId: F, width: 46, height: 38, seed: 3201,
    purpose: "바닷가 어촌. 집 다섯이 선착장 쪽으로 모이고 집마다 고기잡이·빨래·목공 마당",
    note: "남·동쪽이 바다인 작은 어촌. 집 다섯 채가 물가 쪽으로 모여 있고 긴 선착장 둘이 바다로 나간다. 마을 가운데 우물터, 서쪽 숲길로 들어온다",
    build(b) {
      b.waterWhere((x, y) => y > 28 + 2.2 * Math.sin(x / 5) + (x > 30 ? -(x - 30) * 0.5 : 0) || x > 39 + 2 * Math.sin(y / 4));
      b.smoothWater(); b.paintWater();
      b.house(3, 9, 6, { role: "어부 집", yard: "fishing", side: "right", window: 85 });
      b.house(0, 18, 4, { role: "그물 손질집", yard: "laundry", side: "right", window: 86 });
      b.house(5, 30, 7, { role: "어부 오두막", yard: "fishing", side: "right", window: 85 });
      b.house(6, 7, 16, { role: "어부 집", yard: "fishing", side: "left", window: 86 });
      b.house(1, 26, 15, { role: "생선 가게", yard: "shop", side: "right", window: 87 });
      b.peek("water");
      b.pier(24, 25, "south", 6, 2); b.pier(34, 20, "east", 6);
      // The harbour's ends: a rowboat moored beside each pier, mooring poles at the pier heads.
      b.moor("나룻배", 26, 29, { purpose: "남쪽 부두에 댄 고깃배" });
      b.moor("나룻배", 38, 16, { purpose: "동쪽 부두에 댄 나룻배" });
      b.posts([[23, 32], [26, 33], [23, 29], [44, 21], [44, 19]]);
      b.exits([{ side: "west", at: 20, meets: "해안 필드 동쪽 출구" }]);
      b.put("낮은 돌 우물", 21, 19, { purpose: "마을 우물터" });
      b.spine([["exit:0", [12, 21], [20, 22], [28, 22], [34, 20]], [[20, 22], [24, 25]], [[34, 20], [35, 20]]]);
      b.connect();
      b.paintRoads();
      b.props([["벤치", 18, 17], ["돌등", 24, 18], ["게시판", 13, 13]]);
      // Cargo gathered at the pier roots: sacks, firewood, barrels, rope and an anchor waiting on the quay.
      b.props([["부두 상자", 19, 24, "부두 짐", "부두"], ["부두 상자", 20, 24, "부두 짐", "부두"], ["부두 술통", 19, 25, "부두 짐", "부두"], ["장작", 28, 25, "부두 짐", "부두"], ["부두 술통", 22, 26, "부두 짐", "부두"],
        ["밧줄 뭉치", 23, 27, "부두 짐", "부두"], ["닻", 27, 27, "부두 짐", "부두"], ["열린 물통", 36, 19, "부두 짐", "부두"], ["부두 상자", 36, 21, "부두 짐", "부두"]]);
      b.yards();
      b.forest({ bands: { north: [4, 2], west: [4, 2] }, blobs: [[40, 3, 7, 5, 14], [2, 30, 5, 5, 10]], clear: [[22, 18, 12, 8, 14]] });
      b.edgeClumps(4);
      b.tallGrass(4, [5, 9]);
      b.threes(348, 5);
      b.threes(289, 2, null, 1);
    },
  },
  {
    id: "outdoor-swamp-village", theme: "swamp", name: "안개늪 마을", category: "towns", tilesetId: F, width: 44, height: 36, seed: 3501,
    purpose: "늪 사이 마른 둔덕에 붙어 사는 마을. 물웅덩이 사이 좁은 길, 갈대숲(키 큰 풀)과 마른나무, 약초·고기잡이 마당",
    note: "크고 작은 늪 웅덩이 여섯 사이 마른 둔덕에 집 네 채가 흩어져 있고, 좁은 흙길이 웅덩이 사이를 굽이친다. 물가마다 갈대숲이 우거지고 마른나무가 선다. 남쪽 둑길로 들어오고 동쪽으로 늪지 필드가 이어진다",
    build(b) {
      for (const [x, y, rx, ry] of [[8, 7, 6, 3.2], [30, 5, 7, 3], [19, 19, 4.5, 3], [38, 20, 3.5, 4], [5, 27, 4, 3.5], [27, 30, 6, 2.6]]) b.pond(x, y, rx, ry, 0.24);
      b.smoothWater(); b.paintWater();
      b.houseNear(3, 16, 7, { role: "약초꾼 집", yard: "herbs", side: "right", window: 86 });
      b.houseNear(6, 34, 10, { role: "어부 집", yard: "fishing", side: "left", window: 86 });
      b.houseNear(5, 26, 16, { role: "집", yard: "laundry", side: "right", window: 85 });
      b.houseNear(0, 9, 13, { role: "늪지기 집", yard: "storage", side: "right", window: 86 });
      b.exits([{ side: "south", at: 16, meets: "늪지 필드 북쪽 출구" }, { side: "east", at: 29, meets: "늪지 필드 서쪽 출구" }]);
      b.spine([["exit:0", [16, 27], [22, 25], [31, 25], "exit:1"], [[22, 25], [23, 16], [22, 12]]]);
      b.connect();
      b.paintRoads();
      b.pier(20, 25, "north", 2);
      b.pier(30, 25, "south", 3);
      b.props([["마른나무", 12, 22], ["마른나무", 34, 29], ["마른 묘목", 3, 20], ["마른 묘목", 40, 15], ["낚시 바구니", 25, 23, "낚시꾼 자리", "부두"], ["돌등", 17, 24]]);
      b.yards();
      b.forest({ bands: { north: [2, 1.5], west: [2, 1.5], east: [2, 1.5] }, blobs: [[42, 2, 5, 5, 12], [1, 34, 5, 4, 10], [42, 34, 5, 4, 10]], clear: [[22, 18, 16, 12, 16]] });
      b.mudPools(7);
      b.tallGrass(14, [6, 12]);
      b.threes(740, 3, null, 2);
      b.threes(348, 3);
    },
  },
  {
    id: "outdoor-ruined-city", theme: "ruins", name: "무너진 옛 도읍", category: "towns", tilesetId: F, width: 48, height: 40, seed: 3601,
    purpose: "버려진 옛 도시의 폐허. 금 간 돌 광장과 쓰러진 기둥, 폐가 다섯, 무너진 울타리와 우거진 풀",
    note: "사람이 떠난 옛 도읍. 한가운데 돌 광장에 석상과 기둥이 남았고 둘레에 덩굴 덮인 폐가 다섯 채가 선다. 무너진 울타리·돌무더기 사이로 풀과 마른나무가 자랐다. 남쪽과 서쪽에서 옛길이 들어온다",
    build(b) {
      const plaza = b.pave(b.ellipseCells(24, 21, 7.5, 4.5, 0.18), "cobble", { name: "금 간 돌 광장" });
      b.put("돌 석상", 24, 19, { purpose: "옛 왕의 석상" });
      // A colonnade round the statue: two rows of pillars, gaps where pillars fell, their rubble heaped beside the gaps.
      for (const [x, y] of [[18, 18], [21, 18], [27, 18], [30, 18], [18, 23], [24, 23], [30, 23]]) b.put("흰 돌기둥", x, y, { purpose: "무너진 회랑 기둥" });
      for (const [n, x, y] of [["돌 무더기", 24, 18], ["회백색 바위 더미", 25, 18], ["돌 무더기", 24, 17], ["부서진 울타리", 21, 24], ["돌 무더기", 20, 23], ["회백색 바위 더미", 27, 24], ["돌 무더기", 28, 24]])
        b.put(n, x, y, { purpose: "쓰러진 기둥 잔해", owner: "회랑" });
      // Collapsed houses: roofs fallen in (rubble heaps), wall ends broken; only the old office keeps its roof.
      for (const [t, x, y, role] of [[0, 6, 5, "무너진 집"], [2, 36, 6, "무너진 집"], [1, 6, 26, "무너진 집"], [4, 36, 27, "무너진 집"]]) b.ruin(b.houseNear(t, x, y, { role, window: 88 }));
      b.houseNear(7, 20, 4, { role: "반쯤 무너진 관청", window: 88 });
      b.exits([{ side: "south", at: 24, meets: "폐허로 가는 필드 북쪽 출구" }, { side: "west", at: 20, meets: "옛 전쟁터 동쪽 출구" }]);
      b.spine([["exit:0", [24, 30], [24, 26]], ["exit:1", [10, 21], [16, 21]]]);
      b.connect();
      b.paintRoads();
      b.props([["부서진 울타리", 13, 14], ["부서진 울타리", 14, 14], ["부서진 울타리", 33, 16], ["돌 무더기", 16, 27], ["돌 무더기", 31, 27], ["해골", 11, 33],
        ["돌 무더기", 28, 13], ["회백색 바위 더미", 42, 20], ["묘비", 4, 16], ["돌 십자가", 3, 17], ["마른나무", 44, 13], ["마른나무", 15, 34], ["흰 돌기둥", 13, 20]]);
      b.forest({ bands: { north: [2, 1.5], east: [2, 1], south: [2, 1] }, blobs: [[46, 38, 6, 5, 12], [2, 38, 5, 4, 10], [46, 3, 5, 4, 12]], clear: [[24, 20, 18, 14, 16]] });
      b.edgeClumps(4, ["small-bush", "round-bush"]);
      b.tallGrass(12, [5, 12]);
      b.threes(740, 4, null, 2);
    },
  },
  {
    id: "outdoor-dwarf-mine", name: "쇠망치 광산 마을", category: "towns", tilesetId: F, width: 44, height: 44, seed: 3701,
    purpose: "절벽 밑에 붙여 지은 돌집과 절벽을 파고든 문 달린 절벽 집의 광산 마을. 두 층 절벽을 돌계단으로 오르내리고 집마다 광석·대장일·창고 마당",
    note: "두 층 절벽 밑동에 돌집들이 절벽에 등을 붙이고 서 있고, 절벽 밑동을 파고든 절벽 집 넷이 문을 절벽 발치로 내고 있다. 돌계단 둘로 오르내리며 집 앞 마당마다 광석 더미·무기 거치대·장작·상자가 있다. 아랫단 모닥불 광장, 남쪽으로 들어온다",
    build(b) {
      b.cliffs([{ points: [[0, 8], [14, 8], [16, 9], [28, 9], [30, 8], [43, 8]], height: 5, left: "open", right: "open" },
        { points: [[0, 28], [10, 28], [12, 29], [30, 29], [32, 28], [43, 28]], height: 5, left: "open", right: "open" }]);
      b.stairs([[22, 9, 5], [34, 28, 5]]);
      // Houses dug into the cliff feet, each with its front wall and door at the toe (no floating dark holes).
      for (const [t, x, y, role] of [[7, 16, 12, "절벽 광부 집"], [7, 25, 12, "갱도 관리소"], [7, 14, 32, "절벽 광석 창고"], [7, 21, 32, "절벽 광부 집"]]) b.cliffHouse(t, x, { role, wide: t === 7, cliffY: y });
      b.house(7, 2, 14, { role: "대장장이 돌집", yard: "smith", side: "front", window: 87 });
      b.house(6, 11, 15, { role: "광부 돌집", yard: "mine", side: "right", window: 87 });
      b.house(4, 35, 14, { role: "광석 창고", yard: "storage", side: "left", window: 87 });
      b.house(7, 1, 34, { role: "갱목 손질집", yard: "woodwork", side: "front", window: 87 });
      b.house(3, 26, 35, { role: "광부 돌집", yard: "mine", side: "right", window: 87 });
      b.exits([{ side: "south", at: 20, meets: "산길·협곡 필드 북쪽 출구" }]);
      b.spine([["exit:0", [20, 38], [30, 38], "stairs-bottom:1"], ["stairs-top:1", [30, 24], [23, 20], "stairs-bottom:0"], ["stairs-top:0", [22, 4], [30, 4]]]);
      b.connect(["door-front", "stairs-top", "stairs-bottom"]);
      b.paintRoads();
      b.props([["모닥불", 14, 40, "광장 모닥불", "광장"], ["통나무 더미", 12, 40, "모닥불 둘레 통나무", "광장"], ["통나무 더미", 16, 40, "모닥불 둘레 통나무", "광장"], ["나무 이정표", 23, 41], ["나무 상자", 19, 15, "갱도에서 나온 광석 상자", "절벽 광부 집"], ["돌 무더기", 27, 15, "캐낸 광석"],
        ["돌 무더기", 17, 35, "캐낸 광석"], ["나무 상자", 23, 35], ["회백색 바위 더미", 8, 3], ["회백색 바위 더미", 36, 3],
        ["회백색 바위 더미", 10, 36, "갱도에서 나온 돌", "절벽 광석 창고"], ["나무 상자", 12, 36, "광석 상자", "절벽 광석 창고"], ["장작 더미", 11, 38, "갱목 장작", "갱목 손질집"]]);
      b.yards();
      b.forest({ bands: { west: [2, 1.5], east: [2, 1.5], south: [2, 1], north: [1, 1] }, blobs: [[2, 42, 6, 4, 12], [42, 42, 6, 4, 12], [42, 3, 4, 4, 10], [2, 3, 4, 4, 10]], noise: 0.6 });
    },
  },
  {
    id: "outdoor-graveyard-hill", theme: "graves", name: "까마귀 묘지 언덕", category: "sacred", tilesetId: F, width: 40, height: 34, seed: 3801,
    purpose: "언덕 위 교회와 울타리 친 묘지. 아랫길에서 돌계단으로 올라가고 마른나무와 무덤이 흩어진다",
    note: "절벽 윗단 언덕에 돌벽 교회와 울타리 친 묘지 둘이 있고, 아랫길에서 돌계단 하나로 오른다. 아랫단에는 이름 없는 무덤과 십자가·마른나무가 흩어져 있다",
    build(b) {
      b.cliffs([{ points: [[0, 16], [12, 16], [14, 15], [26, 15], [28, 16], [39, 16]], height: 5, left: "open", right: "open" }]);
      b.stairs([[18, 15, 5]]);
      b.landmark("church", 16, 3);
      b.landmark("graveyard", 4, 5);
      b.landmark("graveyard-small", 28, 6);
      b.exits([{ side: "south", at: 19, meets: "마을 북쪽 길" }, { side: "west", at: 27, meets: "필드 동쪽 출구" }]);
      b.spine([["exit:0", [19, 26], "stairs-bottom:0"], ["exit:1", [10, 27], [19, 26]], ["stairs-top:0", [19, 13]]]);
      b.connect();
      b.paintRoads();
      b.props([["묘비", 8, 23], ["묘비", 10, 24], ["돌 십자가", 30, 24], ["묘비", 32, 25], ["흙 무덤", 28, 27], ["마른나무", 5, 29], ["마른나무", 35, 22], ["돌등", 16, 13], ["돌등", 21, 13], ["마른 묘목", 26, 30]]);
      b.forest({ bands: { north: [2, 1.5], east: [3, 1.5], west: [2, 1], south: [2, 1] }, blobs: [[38, 32, 6, 5, 12], [1, 33, 5, 4, 10]], clear: [[19, 22, 14, 8, 14]] });
      b.edgeClumps(3, ["round-bush", "small-bush"]);
      b.tallGrass(5, [4, 9]);
      b.threes(740, 3, null, 2);
    },
  },
  {
    id: "outdoor-sealed-altar", plaza: [["cobble", ["돌등", "돌 무더기", "흰 돌기둥"]]], name: "봉인된 옛 제단", category: "sacred", tilesetId: F, width: 34, height: 30, seed: 3901,
    purpose: "숲 깊은 곳 돌 제단. 글자가 새겨진 큰 비석 앞 마법진, 네 모퉁이 오벨리스크와 돌등",
    note: "짙은 숲 속 둥근 돌바닥 제단. 북쪽에 글자가 새겨진 큰 비석이 서고 그 앞 마법진이 봉인을 지킨다. 네 모퉁이에 오벨리스크, 둘레에 돌등과 석상이 있고 남쪽 오솔길로만 들어온다",
    build(b) {
      b.pave(b.ellipseCells(17, 13, 7.5, 6, 0.06), "cobble", { name: "제단 돌바닥" });
      b.put("큰 비석", 16, 7, { purpose: "봉인 비문" });
      b.put("마법진", 17, 13, { purpose: "봉인 마법진" });
      for (const [x, y] of [[11, 9], [23, 9], [11, 16], [23, 16]]) b.put("돌 오벨리스크", x, y, { purpose: "봉인 기둥" });
      b.props([["돌등", 14, 18], ["돌등", 20, 18], ["돌 석상", 13, 10], ["돌 석상", 21, 10]]);
      b.exits([{ side: "south", at: 17, meets: "숲 필드" }]);
      b.spine([["exit:0", [17, 22], [17, 19]]]);
      b.paintRoads();
      b.forest({ bands: { north: [3, 1.5], south: [5, 2], west: [5, 2], east: [5, 2] }, blobs: [[2, 28, 8, 6, 14], [32, 28, 8, 6, 14], [2, 2, 6, 5, 12], [32, 2, 6, 5, 12]], clear: [[17, 13, 12, 10, 22]] });
      b.edgeClumps(3, ["round-bush", "small-bush"]);
      b.tallGrass(3, [4, 7]);
    },
  },
  {
    id: "outdoor-opening-overlook", name: "첫걸음 벼랑 전망대", category: "scenes", tilesetId: F, width: 40, height: 30, seed: 4001,
    purpose: "게임 첫 장면. 높은 벼랑 끝 전망대에서 아래 강과 바다, 멀리 마을 쪽을 내려다본다",
    note: "북쪽 숲길로 나오면 높은 벼랑 끝 전망대가 나온다. 벤치와 이정표, 외딴 큰 나무가 있고, 벼랑 아래로 강이 폭포로 떨어져 남쪽 바다로 흘러간다. 아랫단은 풍경이라 내려갈 길이 없다",
    leak: false,
    build(b) {
      b.cliffs([{ points: [[0, 14], [8, 14], [10, 15], [22, 15], [24, 14], [39, 14]], height: 7, left: "open", right: "open" }]);
      b.river({ width: 3, points: [[31, 0], [31, 6], [30, 10], [30, 14], [30, 24], [28, 29]], pools: [[30, 24, 4, 2.2]] });
      b.waterWhere((x, y) => y > 25 + 1.5 * Math.sin(x / 4));
      b.smoothWater(); b.paintWater();
      b.exits([{ side: "north", at: 14, meets: "숲길(필드) 남쪽 출구" }]);
      b.spine([["exit:0", [14, 8], [18, 12]]]);
      b.paintRoads();
      b.props([["벤치", 16, 13, "전망 벤치"], ["나무 이정표", 21, 12, "아래 마을 방향 표지"], ["돌등", 12, 12]]);
      b.trees([["big-oak", 5, 6]]);
      b.threes(348, 5, [2, 2, 26, 11]);
      b.forest({ bands: { north: [3, 1.5], west: [2, 1], east: [3, 1] }, blobs: [[38, 3, 6, 5, 12], [1, 2, 4, 4, 8]], clear: [[16, 10, 10, 5, 16]] });
      b.scatterTrees(3, ["tree", "round-bush", "small-bush"], [0, 22, 26, 5]);
      b.tallGrass(3, [4, 8], [0, 21, 28, 5]);
      b.threes(348, 3, [0, 21, 28, 5]);
    },
  },
  {
    id: "outdoor-festival-plaza", name: "별빛 축제 광장", category: "scenes", tilesetId: F, width: 40, height: 32, seed: 4101,
    purpose: "마을 축제 장면. 광장 북쪽 나무 무대와 관람 벤치, 우물 분수, 양옆 노점 줄 사이 산책길, 잔칫상과 모닥불",
    note: "집 네 채가 둘러싼 돌 광장에 축제가 열렸다. 북쪽에 등불 둘을 세운 나무 무대가 있고 그 앞에 관람 벤치 두 줄, 가운데 우물 분수가 있다. 광장 서쪽과 동쪽 가장자리를 따라 노점이 줄지어 서고 그 사이가 산책길이다. 남쪽 입구 양옆에 꽃 화단, 주막 앞에 잔칫상과 술통, 서쪽 잔디에 큰 모닥불이 있다. 남쪽과 동쪽 길로 들어온다",
    build(b) {
      b.pave(b.ellipseCells(20, 17, 11, 6.5, 0.07), "cobble", { name: "축제 광장" });
      // Stage on the north side, lamps at its wings; the well is the centrepiece of the promenade.
      b.stage(15, 12, 10, 3);
      b.put("돌등", 13, 12, { purpose: "무대 등불" }); b.put("돌등", 26, 12, { purpose: "무대 등불" });
      b.put("낮은 돌 우물", 19, 19, { purpose: "광장 분수 우물" });
      b.houseNear(2, 4, 3, { role: "주막", yard: "tavern", side: "right", window: 85 });
      b.houseNear(0, 16, 2, { role: "잡화점", yard: "shop", side: "right", window: 86 });
      b.houseNear(1, 30, 3, { role: "집", yard: "garden", side: "left", window: 85 });
      b.houseNear(3, 33, 21, { role: "빵집", yard: "storage", side: "left", window: 86 });
      b.exits([{ side: "south", at: 20, meets: "마을 남쪽 길" }, { side: "east", at: 17, meets: "필드 서쪽 출구" }]);
      b.spine([["exit:0", [20, 24]], ["exit:1", [31, 17]]]);
      b.connect();
      b.paintRoads("cobble");
      b.plazaUnroad();
      // Audience: two rows of benches facing the stage, an aisle down the middle.
      for (const [x, y] of [[15, 16], [17, 16], [21, 16], [23, 16], [15, 17], [17, 17], [21, 17], [23, 17]]) b.put("벤치", x, y, { purpose: "무대 관람석" });
      // Stalls line the west and east edges; the promenade runs between them and the seats.
      b.props([["장터 노점", 10, 15, "축제 노점"], ["장터 노점", 10, 19, "축제 노점"], ["장터 노점", 27, 15, "축제 노점"], ["과일 좌판", 28, 19, "과일 노점"],
        ["과일 좌판", 28, 21, "과일 노점"], ["술통", 13, 19, "노점 술통"], ["작은 오크통", 13, 20, "노점 술통"],
        ["꽃 화단", 17, 21, "입구 화단"], ["꽃 화단", 22, 21, "입구 화단"], ["화분", 18, 19, "우물가 화분", "축제"], ["화분", 21, 19, "우물가 화분", "축제"],
        ["돌등", 15, 20, "산책길 등불", "축제"], ["돌등", 24, 20, "산책길 등불", "축제"], ["과일 상자", 26, 17, "노점 짐", "축제"], ["나무 상자", 12, 17, "노점 짐", "축제"],
        ["가로 탁자", 11, 22, "잔칫상"], ["술통", 10, 22], ["술통", 14, 22],
        ["모닥불", 6, 17, "축제 모닥불", "축제"], ["통나무 더미", 5, 17, "모닥불 장작", "축제"], ["통나무 더미", 7, 17, "모닥불 장작", "축제"]]);
      b.yards();
      b.forest({ bands: { south: [2, 1], west: [2, 1], north: [1, 0.5] }, blobs: [[1, 30, 5, 4, 10], [39, 30, 5, 4, 10]], clear: [[20, 16, 16, 11, 14]] });
      b.edgeClumps(3);
      b.threes(348, 6);
      b.scatterTrees(2, ["small-bush", "round-bush"]);
    },
  },
  {
    id: "outdoor-ending-meadow", theme: "meadow", name: "노을빛 엔딩 들판", category: "scenes", tilesetId: F, width: 40, height: 30, seed: 4201,
    purpose: "엔딩 장면. 꽃이 가득한 들판 언덕의 외딴 큰 나무와 벤치, 들판을 가로질러 멀리 떠나는 길",
    note: "탁 트인 꽃 들판. 가운데 낮은 언덕 위에 외딴 큰 참나무와 벤치가 있고, 남쪽에서 온 흙길이 나무 곁을 지나 동쪽 멀리로 이어진다. 들꽃과 덤불이 셋씩 무리 지어 피고 가장자리에 숲이 둘러선다",
    build(b) {
      b.exits([{ side: "south", at: 12, meets: "마을 북쪽 길" }, { side: "east", at: 10, meets: "먼 길(끝)" }]);
      b.trees([["big-oak", 19, 7]]);
      b.put("벤치", 20, 13, { purpose: "나무 아래 벤치" });
      b.spine([["exit:0", [12, 22], [17, 15], [24, 13], [31, 11], "exit:1"]]);
      b.paintRoads();
      b.put("돌 석상", 26, 15, { purpose: "추모비" });
      b.threes(348, 8, [2, 2, 36, 26]);
      b.threes(768, 4, [2, 2, 36, 26], 2);
      b.forest({ bands: { north: [2, 2], west: [3, 2] }, blobs: [[38, 29, 7, 5, 12], [1, 29, 5, 5, 10], [38, 1, 5, 3, 8]], clear: [[20, 13, 16, 11, 16]] });
      b.edgeClumps(4, ["tree", "round-bush", "small-bush"]);
      b.tallGrass(5, [4, 8]);
    },
  },
  {
    id: "outdoor-mountain-pass", gate: "field", name: "구름재 산길 협곡", category: "fields", tilesetId: F, width: 44, height: 56, seed: 4301,
    purpose: "절벽 세 단을 계단으로 갈지자로 오르는 산길. 협곡 사이 여울이 폭포 셋으로 떨어진다",
    note: "남쪽 기슭에서 북쪽 고개까지 절벽 세 단을 돌계단 셋으로 갈지자로 오른다. 동쪽 협곡 여울이 단마다 폭포로 떨어지고 아랫단에서 나무다리로 건넌다. 양쪽은 짙은 숲",
    build(b) {
      b.cliffs([{ points: [[0, 40], [10, 40], [12, 41], [30, 41], [32, 40], [43, 40]], height: 5, left: "open", right: "open" },
        { points: [[0, 26], [14, 26], [16, 25], [30, 25], [32, 26], [43, 26]], height: 5, left: "open", right: "open" },
        { points: [[0, 12], [8, 12], [10, 11], [26, 11], [28, 12], [43, 12]], height: 5, left: "open", right: "open" }]);
      b.stairs([[8, 40, 5], [26, 25, 5], [12, 11, 5]]);
      b.river({ width: 3, points: [[35, 0], [35, 8], [36, 12], [36, 24], [35, 30], [35, 38], [36, 46], [37, 55]], pools: [[38.2, 19.5, 3.4, 2.6], [33.2, 34.5, 3.2, 2.4], [38.5, 47.5, 3, 2.8]] });
      b.smoothWater(); b.paintWater();
      b.bridges([[36, 51]]);
      b.exits([{ side: "south", at: 18, meets: "광산 마을·국경 쪽 필드 북쪽 출구" }, { side: "north", at: 20, meets: "국경 관문 남쪽 출구" }, { side: "east", at: 52, meets: "필드 서쪽 출구" }]);
      b.spine([["exit:0", [18, 50], "stairs-bottom:0"], [[18, 50], [30, 52], "bridge-west:0"], ["bridge-east:0", "exit:2"], ["stairs-top:0", [18, 36], "stairs-bottom:1"], ["stairs-top:1", [20, 20], "stairs-bottom:2"], ["stairs-top:2", [18, 6], "exit:1"]]);
      b.connect();
      b.paintRoads();
      b.props([["나무 이정표", 20, 48, "갈림길 표지"], ["돌 석상", 24, 22, "고개 수호석"], ["통나무 더미", 8, 34, "고갯길 쉼터 통나무", "갈림길"]]);
      b.forest({ bands: { west: [5, 2], east: [3, 1.5] }, blobs: [[4, 5, 6, 5, 12], [40, 44, 5, 5, 10], [3, 33, 6, 4, 12], [42, 18, 4, 5, 10]], noise: 0.8 });
      b.edgeClumps(4);
      b.threes(537, 3, null, 1);
      b.tallGrass(4, [4, 9]);
    },
  },
  {
    id: "outdoor-swamp-field", theme: "swamp", gate: "field", name: "검은물 늪지 필드", category: "fields", tilesetId: F, width: 56, height: 40, seed: 4401,
    purpose: "늪 웅덩이와 갈대숲 사이를 굽이치는 둑길 필드. 마른나무와 선착장, 조우용 키 큰 풀밭",
    note: "크고 작은 늪 웅덩이 사이로 둑길이 서쪽에서 동쪽으로 굽이친다. 물가에 갈대숲(키 큰 풀)이 넓게 우거지고 마른나무·마른 묘목이 서며, 큰 웅덩이에 낚시용 선착장 하나가 나 있다",
    build(b) {
      for (const [x, y, rx, ry] of [[12, 8, 7, 3.5], [30, 12, 6, 4], [46, 8, 6, 3], [8, 28, 5, 4], [24, 30, 8, 3.2], [44, 28, 6, 4.5]]) b.pond(x, y, rx, ry, 0.25);
      b.smoothWater(); b.paintWater();
      b.exits([{ side: "west", at: 19, meets: "안개늪 마을 동쪽 출구" }, { side: "east", at: 19, meets: "다음 필드" }, { side: "north", at: 38, meets: "필드 남쪽 출구" }]);
      b.spine([["exit:0", [14, 19], [22, 21], [34, 19], [44, 19], "exit:1"], [[34, 19], [38, 8], "exit:2"]]);
      b.paintRoads();
      b.pier(24, 23, "south", 3);
      b.props([["마른나무", 18, 15], ["마른나무", 40, 23], ["마른나무", 6, 14], ["낚시 바구니", 26, 24], ["나무 이정표", 36, 21]]);
      b.forest({ bands: { north: [2, 1.5], south: [2, 1.5] }, blobs: [[54, 38, 5, 5, 10], [2, 38, 5, 4, 10], [54, 2, 4, 4, 8]], noise: 0.7 });
      b.mudPools(7);
      b.tallGrass(18, [6, 14]);
      b.threes(740, 5, null, 2);
      b.threes(348, 2);
    },
  },
  // ── climate sheets (same numbers as the forest sheet) ──
  {
    id: "outdoor-desert-oasis-city", fill: { flowerCap: 20 }, name: "모래바람 오아시스 도시", category: "desert", tilesetId: "forest_harmony_desert", width: 48, height: 40, seed: 5101,
    purpose: "사막 한가운데 오아시스를 둘러싼 도시. 물가 야자수 고리, 집 여섯과 천막 장터, 대상(隊商) 쉼터",
    note: "가운데 큰 오아시스 못을 야자수가 두르고, 그 둘레에 흙빛 지붕 집 여섯 채가 모여 있다. 남쪽 물가 장터에 노점·천막·과일 좌판, 동쪽에 대상 천막 쉼터. 남쪽과 동쪽 모랫길로 들어온다",
    build(b) {
      b.pond(23, 17.5, 9.5, 6, 0.2); b.smoothWater(); b.paintWater();
      b.houseNear(2, 4, 3, { role: "물지기 집", yard: "desert", side: "right", window: 86 });
      b.houseNear(0, 15, 2, { role: "상인 집", yard: "storage", side: "right", window: 85 });
      b.houseNear(7, 30, 3, { role: "대상 숙소", yard: "tavern", side: "front", window: 87 });
      b.houseNear(3, 42, 5, { role: "집", yard: "laundry", side: "left", window: 86 });
      b.houseNear(1, 4, 20, { role: "대장간", yard: "smith", side: "right", window: 85 });
      b.houseNear(5, 38, 22, { role: "약초집", yard: "herbs", side: "left", window: 86 });
      b.houseNear(6, 23, 2, { role: "물 상인 집", yard: "storage", side: "left", window: 85 }, 3);
      b.houseNear(3, 5, 31, { role: "대추야자 농가", yard: "desert", side: "right", window: 86 }, 3);
      b.exits([{ side: "south", at: 23, meets: "사막 모래언덕 필드 북쪽 출구" }, { side: "east", at: 31, meets: "대상 길(필드)" }]);
      b.spine([["exit:0", [23, 30], [23, 26]], [[23, 27], [36, 29], "exit:1"], [[36, 28], [40, 20], [36, 11]], [[12, 11], [23, 10], [36, 11]]]);
      b.connect();
      b.paintRoads();
      b.props([["장터 노점", 15, 30, "오아시스 장터"], ["과일 좌판", 19, 32, "대추야자 좌판"], ["천막", 28, 31, "장사꾼 천막"], ["천막", 42, 33, "대상 천막"], ["모닥불", 40, 36, "대상 모닥불"],
        ["나무통", 26, 25, "물 긷는 통", "오아시스 물가"], ["항아리", 20, 25, "물항아리", "오아시스 물가"], ["벤치", 30, 24, "물가 쉼터", "오아시스 물가"],
        ["장터 노점", 22, 33, "오아시스 장터", "장터"], ["항아리", 25, 30, "장터 물항아리", "장터"], ["나무 상자", 13, 30, "장터 짐", "장터"]]);
      b.yards();
      b.singlesWhere(770, 12, (x, y) => b.nearWater(x, y, 1) && !b.water.has(b.at(x, y)), 3, { shore: true });
      b.gardenPlots(3, { owner: "오아시스 물가 밭" });
      // Desert (user 2026-09-25): hardly any trees, few rocks and cacti — the open sand is dunes, ripples and cracked earth
      // with a few cactus clumps (theme ground, OutdoorMap.climateGround); bare-tree spots from the fill.
    },
  },
  {
    id: "outdoor-snow-fortress", name: "서리성 설원 요새", category: "snow", tilesetId: "forest_harmony_snow", width: 60, height: 50, seed: 5201,
    purpose: "눈 덮인 북방 요새. 두 원탑 문루를 둔 네모 성채 안에 병영과 지휘관 관사, 성 밖 얼어붙은 연못과 대장간·파수꾼 집",
    note: "눈밭 윗단에 네모난 성벽 성채가 서고 남쪽 성문 양옆을 원탑 둘이 지킨다. 성 안 마당에는 병영과 지휘관 관사가 마주 보고, 마당 한가운데 모닥불과 창걸이 훈련장이 있다. 성문에서 눈길이 남쪽으로 뻗고, 성 아래 얼어붙은 연못(걸어서 건넘) 곁에 대장간·파수꾼 집 둘, 바깥은 눈 덮인 숲이다",
    build(b) {
      // Not the forest-village castle: a square curtain wall carved small from the walled city, gate towers at its gate.
      const ring = carveReference(CASTLE_TOWN, [3, 8, 96, 96], 38, 29, { blank: [[7, 15, 92, 89]] });
      const rx = 11, ry = 1, gx = rx + gateColumn(ring);
      b.stampPiece("서리성 성벽 · 이중 성벽 도시의 성벽 고리를 줄여 자름", rx, ry, ring.w, ring.h, ring.lower, ring.upper);
      { const row = ring.lower.slice((ring.h - 1) * ring.w), xs = row.map((t, x) => [t, x]).filter(([t]) => t === 190).map(([, x]) => x);
        b.gateTowers(rx, ry + ring.h - 8, rx + xs[0], xs[xs.length - 1] - xs[0] + 1, "서리성 문루"); }
      b.houseNear(7, 17, 8, { role: "병영", yard: "guard", side: "right", window: 87 }, 3);
      b.houseNear(4, 36, 7, { role: "지휘관 관사", yard: "storage", side: "left", window: 87 }, 3);
      b.pond(15, 42, 6, 3.2, 0.14); b.smoothWater(); b.paintWater(); b.freeze();
      b.houseNear(4, 40, 38, { role: "대장간", yard: "smith", side: "right", window: 87 });
      b.houseNear(3, 3, 33, { role: "파수꾼 집", yard: "storage", side: "front", window: 86 });
      b.houseNear(3, 53, 33, { role: "마구간지기 집", yard: "woodwork", side: "front", window: 86 });
      b.exits([{ side: "south", at: gx, meets: "설원 빙하 필드 북쪽 출구" }]);
      b.spine([["exit:0", [gx, 44], [gx, ry + ring.h]], [[gx, ry + ring.h + 1], [5, ry + ring.h + 2], [5, 41]], [[gx, ry + ring.h + 1], [54, ry + ring.h + 2], [54, 41]], [[gx, ry + ring.h - 2], [gx, 21]]]);
      b.connect();
      b.paintRoads();
      b.props([["모닥불", gx, 18, "성 마당 모닥불", "성 마당"], ["무기 거치대", gx - 3, 17, "훈련장 창걸이", "성 마당"], ["무기 거치대", gx + 3, 17, "훈련장 창걸이", "성 마당"],
        ["허수아비", gx - 5, 19, "훈련용 허수아비", "성 마당"], ["허수아비", gx + 5, 19, "훈련용 허수아비", "성 마당"],
        ["모닥불", 36, 45, "보초 모닥불", "파수꾼 집"], ["통나무 더미", 34, 45, "모닥불 통나무", "파수꾼 집"], ["장작 더미", 38, 45, "모닥불 장작", "파수꾼 집"]]);
      b.yards();
      b.forest({ bands: { west: [2, 1.5], east: [2, 1.5], south: [2, 1] }, blobs: [[2, 48, 5, 4, 10], [58, 48, 5, 4, 10], [3, 6, 5, 6, 12], [57, 6, 5, 6, 12]], noise: 0.6 });
      b.edgeClumps(3, ["tree", "small-bush", "round-bush"]);
    },
    extraTargets: [[15, 42]],
  },
  {
    id: "outdoor-snow-glacier", gate: "field", name: "푸른 빙하 설원", category: "snow", tilesetId: "forest_harmony_snow", width: 56, height: 40, seed: 5301,
    purpose: "얼어붙은 큰 호수와 눈 절벽의 설원 필드. 얼음판을 가로질러 건너고 절벽 계단으로 윗단 설원에 오른다",
    note: "한가운데 얼어붙은 큰 호수(얼음판은 걸어서 건넌다)를 두고 서쪽 눈길이 동쪽으로 이어진다. 북쪽은 눈 절벽 윗단으로 돌계단 하나로 오르고, 호숫가에 바위와 눈 덮인 침엽 숲이 둘러선다",
    build(b) {
      b.cliffs([{ points: [[0, 9], [12, 9], [14, 10], [30, 10], [32, 9], [55, 9]], height: 5, left: "open", right: "open" }]);
      b.stairs([[40, 9, 5]]);
      b.pond(26, 25, 13, 6.5, 0.16); b.pond(12, 23, 5, 3.5, 0.2); b.smoothWater(); b.paintWater(); b.freeze();
      b.exits([{ side: "west", at: 33, meets: "설원 요새 쪽 눈길" }, { side: "east", at: 30, meets: "다음 필드" }, { side: "north", at: 20, meets: "북쪽 설산(필드)" }]);
      b.spine([["exit:0", [8, 34], [26, 35], [44, 33], "exit:1"], [[44, 33], [45, 20], "stairs-bottom:0"], ["stairs-top:0", [30, 5], [20, 4], "exit:2"]]);
      b.connect();
      b.paintRoads();
      b.props([["나무 이정표", 46, 31, "갈림길 표지"], ["돌 석상", 48, 17, "얼음 수호상"]]);
      b.forest({ bands: { north: [2, 1.5], south: [2, 1.5], east: [2, 1] }, blobs: [[54, 38, 5, 4, 10], [2, 38, 5, 4, 10], [2, 2, 5, 4, 10], [54, 2, 4, 4, 10]], noise: 0.7 });
      b.edgeClumps(3, ["round-bush", "tree"]);
      b.threes(537, 4, null, 1);
    },
    extraTargets: [[26, 25], [14, 23]],
  },
  {
    id: "outdoor-volcano-zone", gate: "field", name: "불꽃산 화산 지대", category: "volcano", tilesetId: "forest_harmony_volcano", width: 56, height: 40, seed: 5401,
    purpose: "용암 강과 화산 봉우리의 화산 필드. 용암이 절벽을 폭포로 넘고 현무암 다리로 건넌다",
    note: "재 덮인 절벽 위 화산 봉우리들 사이에서 용암 강이 흘러나와 절벽을 용암 폭포로 넘는다. 아랫단 길은 현무암 다리로 용암 강을 건너고 돌계단으로 윗단에 오른다. 재 들판은 식은 용암 판과 가지 친 용암 균열로 덮이고, 분기공이 김을 뿜는 작은 용암 웅덩이와 현무암 기둥 한 무리가 있다. 화산 봉우리는 넷, 그을린 잎 없는 나무가 몇 덩이 서 있다",
    build(b) {
      b.cliffs([{ points: [[0, 15], [16, 15], [18, 16], [34, 16], [36, 15], [55, 15]], height: 6, left: "open", right: "open" }]);
      b.stairs([[12, 15, 6]]);
      b.river({ width: 4, points: [[38, 0], [38, 8], [36, 12], [36, 24], [34, 28], [34, 39]], pools: [[38.6, 23.5, 4.2, 3]] });
      b.pond(46, 29.5, 4.8, 3.4, 0.28);
      b.smoothWater(); b.paintWater();
      b.bridges([[34, 32]]);
      b.exits([{ side: "south", at: 20, meets: "화산 마을(잿빛 여울성) 쪽 필드" }, { side: "north", at: 16, meets: "화산 정상(던전 입구)" }, { side: "east", at: 33, meets: "다음 필드" }]);
      b.spine([["exit:0", [20, 33], [28, 32], "bridge-west:0"], ["bridge-east:0", [44, 33], "exit:2"], [[20, 33], [13, 26], "stairs-bottom:0"], ["stairs-top:0", [16, 8], "exit:1"]]);
      b.connect();
      b.paintRoads();
      // Ash cones break the open ash (terrain before props); the bare-tree copses are capped (few trees on ash).
      // Three cones only (user 2026-09-25: 「돌이 너무 많다」); the open ash is lava plates, crack networks and a lava pool
      // with its fumarole (theme ground, OutdoorMap.climateGround).
      b.peaks([[24, 5], [44, 4], [4, 24], [50, 36, true]]);
      b.props([["마른나무", 8, 31], ["마른나무", 46, 22], ["해골", 30, 36], ["나무 이정표", 22, 30, "화산 경고 표지"]]);
      // No canopy on the ash (user 2026-09-25); bare-tree spots come from the fill.
    },
  },
  {
    id: "outdoor-desert-dunes", gate: "field", groundOpts: { duneSeas: 2, duneShare: 0.5 }, name: "금빛 모래언덕", category: "desert", tilesetId: "forest_harmony_desert", width: 56, height: 40, seed: 5501,
    purpose: "모래언덕 둔덕 두 줄과 작은 샘의 사막 필드. 사구와 모래 물결 사이로 대상 길이 이어진다",
    note: "사암 둔덕 두 줄이 층을 이루고 돌계단으로 오르내린다. 아랫단에 야자수 둘러선 작은 샘, 모래밭은 크고 작은 사구와 모래 물결이 덮고 사암 메사·선인장 무리·짐승 해골이 드문드문 있다. 서쪽에서 동쪽으로 대상 길이 난다",
    build(b) {
      b.cliffs([{ points: [[0, 12], [10, 12], [12, 11], [24, 11], [26, 12], [55, 12]], height: 4, left: "open", right: "open" },
        { points: [[0, 26], [18, 26], [20, 25], [30, 25], [32, 26], [46, 26], [48, 25], [55, 25]], height: 4, left: "open", right: "open" }]);
      b.stairs([[16, 11, 4], [38, 26, 4]]);
      b.pond(9, 19.5, 5.5, 2.6, 0.24); b.smoothWater(); b.paintWater();
      b.exits([{ side: "west", at: 34, meets: "사막 오아시스 도시 쪽 길" }, { side: "east", at: 20, meets: "다음 필드" }, { side: "north", at: 30, meets: "오아시스 도시 남쪽 출구" }]);
      b.spine([["exit:0", [16, 36], [30, 36], [38, 34], "stairs-bottom:1"], ["stairs-top:1", [44, 20], "exit:1"], [[44, 20], [26, 19], [17, 18], "stairs-bottom:0"], ["stairs-top:0", [24, 6], [30, 4], "exit:2"]]);
      b.connect();
      b.paintRoads();
      b.props([["해골", 30, 31], ["해골", 50, 16], ["돌 오벨리스크", 5, 33, "모래에 묻힌 옛 표석"], ["천막", 6, 24, "나그네 천막"], ["모닥불", 9, 27]]);
      b.singlesWhere(770, 5, (x, y) => b.nearWater(x, y, 1) && !b.water.has(b.at(x, y)), 2, { shore: true });
      // No forest band on the dunes (user 2026-09-25) and few rocks or cacti: the sand itself is dunes and ripples, with
      // a mesa, cracked earth and a few cactus clumps (theme ground); bare-tree spots from the fill.
    },
  },
  {
    id: "outdoor-beach-cliffs", gate: "field", name: "야자 해변 해안 절벽", category: "desert", tilesetId: "forest_harmony_desert", width: 56, height: 36, seed: 5601,
    purpose: "모래 해변과 바다로 떨어지는 해안 절벽 필드. 야자수·바위·선착장, 절벽 윗단 해안길",
    note: "서쪽 모래 해변이 남쪽 바다로 완만히 내려가고 동쪽은 사암 해안 절벽이 바다로 곧장 떨어진다. 절벽 윗단으로 돌계단 하나, 해변엔 야자수와 사구·모래 물결, 낚시용 선착장이 있다",
    build(b) {
      b.cliffs([{ points: [[0, 8], [18, 8], [20, 9], [34, 9], [36, 10], [55, 10]], height: 5, left: "open", right: "open" }]);
      b.stairs([[24, 9, 5]]);
      b.waterWhere((x, y) => y > 25 + 1.8 * Math.sin(x / 4.5) - (x > 38 ? (x - 38) * 0.6 : 0) + (x < 8 ? 1 : 0));
      b.smoothWater(); b.paintWater();
      b.exits([{ side: "west", at: 20, meets: "어촌 쪽 해안길" }, { side: "north", at: 30, meets: "해안 절벽 위 길(필드)" }]);
      b.spine([["exit:0", [12, 19], [24, 18], "stairs-bottom:0"], ["stairs-top:0", [28, 5], "exit:1"], [[18, 19], [16, 23]]]);
      b.connect();
      b.paintRoads();
      b.pier(16, 23, "south", 5);
      b.props([["낚시 바구니", 18, 22, "낚시꾼 자리", "선착장"], ["나무통", 13, 22, "미끼 통", "선착장"], ["통나무 더미", 30, 20, "해안길 쉼터 통나무", "해안길"], ["돌 석상", 44, 6, "바다를 보는 등대 석상"]]);
      b.singlesWhere(770, 10, (x, y) => y > 14 && y < 26 && !b.water.has(b.at(x, y)), 4);
      b.singlesWhere(770, 4, (x, y) => y < 8, 5);
      // No forest band over the beach (user 2026-09-25): palms by the water; the open sand is ripples and dunes (theme ground).
    },
  },
  {
    id: "outdoor-nomad-camp", fill: { flowerCap: 30 }, name: "바람초원 유목민 천막촌", category: "autumn", tilesetId: "forest_harmony_autumn", width: 40, height: 32, seed: 5701,
    purpose: "금빛 초원의 유목민 천막 야영지. 큰 모닥불 둘레 천막 여섯, 울타리 친 가축 우리와 빨래·장작 살림",
    note: "금빛 풀 초원 한가운데 큰 모닥불을 천막 여섯이 둥글게 둘러싼다. 동쪽에 울타리 친 가축 우리, 천막 사이에 빨랫줄·장작·물통, 초원엔 키 큰 풀과 덤불이 흩어져 있다. 서쪽과 동쪽으로 초원 길이 난다",
    build(b) {
      b.exits([{ side: "west", at: 17, meets: "초원 필드 동쪽 출구" }, { side: "east", at: 22, meets: "초원 필드 서쪽 출구" }]);
      b.fenceRing(27, 6, 9, 7, 3, 2, "가축 우리");
      b.put("모닥불", 18, 15, { purpose: "야영지 큰 모닥불", owner: "야영지" });
      for (const [x, y] of [[13, 9], [19, 7], [24, 13], [12, 17], [17, 21], [24, 20]]) b.props([["천막", x, y, "유목민 천막", "야영지"]]);
      b.spine([["exit:0", [10, 16], [16, 17]], [[16, 17], [22, 18], [30, 21], "exit:1"], [[22, 18], [30, 15], "yard-gate:0"]]);
      b.paintRoads();
      b.props([["빨랫줄", 9, 12, "가죽 말리기", "천막"], ["장작 더미", 21, 12, "모닥불 장작", "야영지"], ["통나무 더미", 16, 15, "모닥불 둘레 앉을 통나무", "야영지"], ["통나무 더미", 20, 15, "모닥불 둘레 앉을 통나무", "야영지"], ["나무통", 16, 12, "물통", "천막"], ["항아리", 11, 21, "젖 항아리", "천막"], ["나무 상자", 28, 17, "짐 상자", "가축 우리"],
        ["씨앗 자루", 29, 8, "여물 자루", "가축 우리"], ["나무통", 33, 9, "구유", "가축 우리"], ["장작 더미", 14, 20, "천막 장작", "천막"], ["항아리", 26, 11, "물항아리", "천막"],
        ["항아리", 17, 17, "모닥불 곁 물항아리", "야영지"], ["나무통", 20, 17, "모닥불 곁 물통", "야영지"], ["장작", 18, 13, "모닥불 장작", "야영지"],
        ["통나무 더미", 30, 10, "여물 통나무", "가축 우리"], ["나무 상자", 32, 8, "여물 상자", "가축 우리"]]);
      b.forest({ bands: { north: [2, 1.5], south: [2, 1.5] }, blobs: [[2, 2, 5, 4, 10], [38, 30, 5, 4, 10], [38, 2, 4, 3, 8]], noise: 0.6 });
      b.edgeClumps(2, ["tree", "round-bush", "small-bush"]);
      b.threes(768, 3, null, 2);
      b.threes(348, 4);
    },
  },
  {
    id: "outdoor-old-battlefield", gate: "field", theme: "battlefield", name: "잿빛 들 옛 전쟁터", category: "autumn", tilesetId: "forest_harmony_autumn", width: 48, height: 36, seed: 5801,
    purpose: "옛 전쟁이 끝난 들판. 부서진 방책·버려진 천막·꽂힌 무기와 해골, 전사자 묘와 추모비",
    note: "시든 금빛 들판에 옛 전쟁의 흔적이 남았다. 무너진 나무 방책 줄, 버려진 천막과 무기 거치대, 해골과 돌무더기가 흩어지고, 북쪽 언덕 발치에 전사자 묘와 추모 석상이 있다. 서쪽에서 동쪽으로 옛 행군로가 지난다",
    build(b) {
      b.exits([{ side: "west", at: 22, meets: "필드 동쪽 출구" }, { side: "east", at: 18, meets: "무너진 옛 도읍 서쪽 출구" }]);
      b.spine([["exit:0", [14, 22], [26, 19], [36, 18], "exit:1"], [[26, 19], [24, 10]]]);
      b.paintRoads();
      b.props([["돌 석상", 23, 5, "전사자 추모상"], ["돌 십자가", 18, 7], ["돌 십자가", 20, 8], ["묘비", 27, 7], ["묘비", 29, 8], ["돌 십자가", 31, 6], ["묘비", 16, 9],
        ["천막", 8, 12, "버려진 천막"], ["천막", 38, 26, "버려진 천막"], ["무기 거치대", 12, 14, "버려진 무기", "서쪽 진지"], ["무기 거치대", 34, 13, "버려진 무기", "북쪽 진지"], ["무기 거치대", 20, 28, "버려진 무기", "남쪽 진지"],
        ["해골", 12, 20, "무너진 방책 앞 해골", "서쪽 방책"], ["해골", 30, 24, "무너진 방책 앞 해골", "동쪽 방책"], ["해골", 38, 13, "무너진 방책 앞 해골", "북쪽 방책"],
        ["돌 무더기", 21, 29, "무기 거치대 곁 돌무더기", "남쪽 진지"], ["돌 무더기", 33, 30, "무너진 참호", "동쪽 방책"], ["통나무 더미", 6, 27, "방책 통나무", "서쪽 진지"]]);
      for (const [x0, y0, n] of [[9, 18, 5], [30, 22, 6], [36, 11, 4]]) for (let k = 0; k < n; k++) if (k !== 2) b.props([["부서진 울타리", x0 + k, y0 + (k % 3 === 0 ? 1 : 0), "무너진 나무 방책", "옛 방책"]]);
      b.forest({ bands: { north: [2, 1.5], south: [2, 1.5] }, blobs: [[2, 2, 5, 4, 10], [46, 34, 5, 4, 10], [46, 2, 4, 4, 10]], noise: 0.6 });
      b.edgeClumps(2, ["small-bush"]);
    },
  },
  {
    // The big field, on the scale of 비취 대계곡 (openwiki/emerald-fields.md, 80×64): a long north cliff with three
    // falls, a highland reached by stairs, a lake with an island, a bending outflow, a loop road with four bridges.
    id: "outdoor-great-valley", gate: "field", name: "세폭포 대계곡", category: "fields", tilesetId: F, width: 80, height: 64, seed: 6101,
    purpose: "넓은 탐험 필드. 북쪽 긴 절벽을 세 줄기 폭포가 넘어 가운데 섬 호수로 모이고, 호수 둘레를 나무다리 넷의 순환로가 돈다. 절벽 위 고지대 입석 쉼터와 굽이치는 하류",
    note: "북쪽 고지대 끝을 긴 절벽이 가로지르고 세 줄기 개울이 폭포로 떨어져 가운데 섬 호수에 모인다. 호수 물은 남동쪽으로 굽이쳐 흘러 나간다. 남쪽 숲길로 들어오면 호수 서쪽을 따라 올라가 절벽 발치에서 나무다리 셋으로 개울을 건너고, 동쪽 기슭을 내려와 하류 나무다리를 건너 제자리로 돌아오는 순환로가 난다. 서쪽 돌계단으로 고지대에 오르면 입석이 둘러선 쉼터와 북쪽 고갯길이 있다. 호수 남쪽 물가에 낚시 선착장, 섬에는 외딴 나무",
    build(b) {
      b.cliffs([{ points: [[0, 14], [18, 14], [20, 15], [44, 15], [46, 14], [79, 14]], height: 5, left: "open", right: "open" }]);
      b.stairs([[11, 14, 5]]);
      b.river({ width: 2, points: [[25, 0], [25, 9], [26, 14], [27, 23], [30, 27]] });
      b.river({ width: 2, points: [[39, 0], [39, 10], [38, 20], [38, 26]] });
      b.river({ width: 2, points: [[54, 0], [54, 10], [52, 14], [51, 23], [47, 27]] });
      b.pond(39, 33, 13, 6.2, 0.16);
      for (const i of b.ellipseCells(40.5, 33, 4, 2.6, 0.22)) b.water.delete(i);
      b.river({ width: 3, points: [[49, 37], [53, 41], [56, 45], [57, 50], [55, 55], [57, 63]] });
      b.smoothWater(); b.paintWater();
      b.bridges([[27, 21], [38, 21], [51, 21], [57, 48]]);
      b.exits([{ side: "south", at: 22, meets: "남쪽 숲길(필드) 북쪽 출구" }, { side: "north", at: 8, meets: "고갯길 필드 남쪽 출구" }, { side: "east", at: 32, meets: "동쪽 들판 서쪽 출구" }]);
      b.spine([["exit:0", [22, 52], [18, 40], [18, 28], [22, 22], "bridge-west:0"], ["bridge-east:0", "bridge-west:1"], ["bridge-east:1", "bridge-west:2"],
        ["bridge-east:2", [62, 24], [64, 32], [63, 44], "bridge-east:3"], ["bridge-west:3", [44, 52], [26, 54], [22, 52]], [[64, 32], "exit:2"],
        [[18, 28], [12, 24], "stairs-bottom:0"], ["stairs-top:0", [9, 7], "exit:1"]]);
      b.connect();
      b.paintRoads();
      { const t = b.kit.trees.tree; b.stampPiece("호수 섬의 외딴 나무", 39, 31, t.w, t.h, t.lower, t.upper); }
      b.pier(34, 40, "north", 3);
      b.props([["흰 돌기둥", 14, 4, "쉼터 입석", "입석 쉼터"], ["흰 돌기둥", 19, 5, "쉼터 입석", "입석 쉼터"], ["돌 오벨리스크", 16, 9, "쉼터 입석", "입석 쉼터"], ["흰 돌기둥", 20, 9, "쉼터 입석", "입석 쉼터"],
        ["벤치", 16, 6, "입석 쉼터 벤치", "입석 쉼터"], ["돌 석상", 60, 18, "폭포를 보는 석상"], ["나무 이정표", 20, 50, "순환로 갈림길 표지"], ["나무 이정표", 66, 31, "동쪽 갈림길 표지"],
        ["낚시 바구니", 33, 42, "선착장 낚시꾼 자리", "선착장"], ["나무통", 36, 42, "미끼 통", "선착장"]]);
      b.forest({ bands: { west: [3, 1.5], east: [3, 1.5], south: [3, 1.5], north: [2, 1] },
        blobs: [[4, 60, 8, 5, 14], [76, 60, 8, 5, 14], [76, 4, 6, 5, 12], [70, 50, 5, 4, 12], [8, 46, 5, 4, 12], [44, 58, 6, 3, 10], [66, 8, 6, 4, 12]], noise: 0.7,
        clear: [[16, 6, 7, 4, 8]] });
      b.edgeClumps(6);
      b.tallGrass(10, [6, 12]);
    },
  },
  // Two more fields per climate sheet (lib/rpg-outdoor-climate-fields.mjs, 2026-09-25).
  ...CLIMATE_FIELD_PLANS,
  // Round 2 (lib/rpg-outdoor-round2.mjs, 2026-09-25): demon castle, forest maze, dragon peak, forest camp, farm, lighthouse cape.
  ...ROUND2_PLANS,
  {
    // The world map (lib/rpg-outdoor-world.mjs): every place above as an icon or a named field region on one continent.
    id: "outdoor-world-map", world: true, name: "은빛 왕국 대륙 전도", category: "world", tilesetId: "oprn_world_keyed", width: 72, height: 56, seed: 7101,
    purpose: "대륙 전체 월드맵. 눈 덮인 북쪽, 왕도가 선 초록 가운데, 서쪽 늪과 남서 화산, 남동 사막과 바다 해안까지 모든 장소를 흙길로 잇는다",
    note: "바다에 둘러싸인 대륙 하나. 북쪽은 설원·눈 숲·설산에 서리성이 서고, 설원 경계의 두 산맥 사이 틈을 국경 관문이 지킨다. 가운데 초록 들판에 왕도 성과 축제 마을, 서쪽 늪지에 안개늪 마을, 남서 산맥 끝에 화산, 남동 사막에 오아시스 도시와 모래언덕, 남쪽 바닷가에 어촌과 해변 절벽이 있다. 장소마다 흙길이 이어진다",
    gate: { maxSq: 7, screen: 0.62 }, snowLine: 0.25, landAt: 0.56,
    patches: [[0.16, 0.5, 4.5, 3.2, "marsh"], [0.8, 0.72, 10, 6.5, "sand"], [0.42, 0.67, 3.2, 2, "lake"], [0.86, 0.62, 4, 3, "sand"]],
    ranges: [{ points: [[0.1, 0.3], [0.24, 0.27], [0.43, 0.29]], width: 1.8 }, { points: [[0.57, 0.28], [0.72, 0.27], [0.88, 0.22]], width: 1.7 },
      { points: [[0.12, 0.7], [0.2, 0.74], [0.27, 0.81]], width: 1.6 }, { points: [[0.87, 0.44], [0.91, 0.55]], width: 1.3 }, { points: [[0.3, 0.07], [0.46, 0.1]], width: 1.4 }],
    places: [
      { id: "royal-capital", placeId: "outdoor-royal-capital", name: "왕도 은빛 성곽", icon: "castle", kind: "town", at: [0.5, 0.46] },
      { id: "festival-plaza", placeId: "outdoor-festival-plaza", name: "별빛 축제 광장", icon: "house", kind: "scene", at: [0.43, 0.55] },
      { id: "ending-meadow", placeId: "outdoor-ending-meadow", name: "노을빛 엔딩 들판", icon: "bigtree", kind: "scene", at: [0.58, 0.58] },
      { id: "fairy-spring", placeId: "outdoor-fairy-spring", name: "요정 샘 신성한 숲", icon: "spring", kind: "sacred", at: [0.36, 0.42], lowerIcon: true },
      { id: "great-valley", placeId: "outdoor-great-valley", name: "세폭포 대계곡", kind: "field", at: [0.28, 0.46] },
      { id: "swamp-village", placeId: "outdoor-swamp-village", name: "안개늪 마을", icon: "hut", kind: "town", at: [0.22, 0.56] },
      { id: "swamp-field", placeId: "outdoor-swamp-field", name: "검은물 늪지 필드", kind: "field", at: [0.12, 0.44] },
      { id: "dwarf-mine", placeId: "outdoor-dwarf-mine", name: "쇠망치 광산 마을", icon: "cave", kind: "town", at: [0.33, 0.33] },
      { id: "mountain-pass", placeId: "outdoor-mountain-pass", name: "구름재 산길 협곡", kind: "field", at: [0.46, 0.33] },
      { id: "border-fortress", placeId: "outdoor-border-fortress", name: "국경 관문", icon: "fortress", kind: "town", at: [0.49, 0.24] },
      { id: "snow-fortress", placeId: "outdoor-snow-fortress", name: "서리성 설원 요새", icon: "citadel", kind: "town", at: [0.64, 0.12] },
      { id: "snow-glacier", placeId: "outdoor-snow-glacier", name: "푸른 빙하 설원", kind: "field", at: [0.38, 0.16] },
      { id: "ruined-city", placeId: "outdoor-ruined-city", name: "무너진 옛 도읍", icon: "ruins", kind: "town", at: [0.7, 0.38] },
      { id: "old-battlefield", placeId: "outdoor-old-battlefield", name: "잿빛 들 옛 전쟁터", icon: "bones", kind: "field", at: [0.6, 0.34] },
      { id: "graveyard-hill", placeId: "outdoor-graveyard-hill", name: "까마귀 묘지 언덕", icon: "grave", kind: "sacred", at: [0.74, 0.5] },
      { id: "sealed-altar", placeId: "outdoor-sealed-altar", name: "봉인된 옛 제단", icon: "temple", kind: "sacred", at: [0.82, 0.38] },
      { id: "opening-overlook", placeId: "outdoor-opening-overlook", name: "첫걸음 벼랑 전망대", icon: "tower", kind: "scene", at: [0.12, 0.62], coast: true },
      { id: "fishing-village", placeId: "outdoor-fishing-village", name: "갈매기 어촌", icon: "house", kind: "town", at: [0.34, 0.84], coast: true },
      { id: "beach-cliffs", placeId: "outdoor-beach-cliffs", name: "야자 해변 해안 절벽", kind: "field", at: [0.52, 0.84], coast: true },
      { id: "volcano-zone", placeId: "outdoor-volcano-zone", name: "불꽃산 화산 지대", icon: "volcano", kind: "field", at: [0.2, 0.8] },
      { id: "nomad-camp", placeId: "outdoor-nomad-camp", name: "바람초원 유목민 천막촌", icon: "hut", kind: "town", at: [0.64, 0.68] },
      { id: "desert-oasis-city", placeId: "outdoor-desert-oasis-city", name: "모래바람 오아시스 도시", icon: "house", kind: "town", at: [0.78, 0.74] },
      { id: "desert-dunes", placeId: "outdoor-desert-dunes", name: "금빛 모래언덕", kind: "field", at: [0.88, 0.68] },
    ],
    links: [["fishing-village", "beach-cliffs"], ["ending-meadow", "nomad-camp"], ["graveyard-hill", "ruined-city"]],
  },
  ARCHIPELAGO_WORLD,
];
