// Atlas towns · home villages (고향 마을) and the state pair of the first one: burning (습격당한 밤) and rebuilt (재건).
// One layout function drives all three states so the burnt and rebuilt maps are the same village, not a lookalike.
const F = "forest_harmony";

// 들꽃 언덕 고향 마을 — the first village: a lane from the south meets a small fountain green, the chief's two-storey house
// north of it, the inn and smithy on the lane, farmhouses round the edge, a mill pond in the north-west.
function meadowHome(b, state = "peace") {
  b.pond(9, 8, 6, 3.6, 0.1); b.smoothWater(); b.paintWater();
  b.exits([{ side: "south", at: 25, meets: "마을 앞 들판(필드) 북쪽 출구" }, { side: "east", at: 20, meets: "동쪽 숲길(필드) 서쪽 출구" }]);
  const green = b.pave(b.ellipseCells(25, 20, 6.5, 3.6, 0.08), "cobble", { name: "분수 마당" });
  b.put("광장 분수", 24, 19, { purpose: "마을 한가운데 분수" });
  b.spine([["exit:0", [25, 30], [25, 24]], [[31, 20], [40, 20], "exit:1"]]);
  const rebuilt = state === "rebuilt", burnt = state === "burning";
  const H = b.homes([
    ["gable-2f-porch", rebuilt ? "charcoal-timber" : "slate-brick", 21, 5, "촌장 집", "garden", "right"],
    ["gable-house", "thatch-plaster", 12, 13, "주인공 집", "laundry", "left"],
    ["gable-cross-r", "amber-wood", 33, 8, "여관", "tavern", "left"],
    ["gable-long-low", rebuilt ? "timber-hall" : "amber-brick", 35, 25, "대장간", "smith", "right"],
    ["gable-steep", "moss-plaster", 5, 25, "약초 할멈 집", "herbs", "right"],
    ["gable-twin", rebuilt ? "thatch-log" : "bright-plaster", 15, 31, "잡화점", "shop", "right"],
    ["gable-barn", "thatch-log", 42, 11, "헛간", "storage", "front"],
  ]);
  b.connect();
  b.paintRoads();
  b.plazaUnroad();
  b.props([["벤치", 20, 23, "분수 곁 벤치", "분수 마당"], ["돌등", 30, 18, "분수 마당 등불", "분수 마당"], ["게시판", 28, 24, "마을 게시판", "분수 마당"], ["꽃 화단", 20, 17, "분수 화단", "분수 마당"]]);
  b.pier(9, 13, "north", 2);
  b.props([["낚시 바구니", 11, 12, "못가 낚시 자리", "못"]]);
  b.yards();
  if (burnt) {
    // The raid night: roofs on fire, two houses already fallen in, ash and charred beams round them, smoke.
    const fallen = [H[3], H[5]];
    for (const h of fallen) { b.burnDown(h); b.ashOver(h.x - 1, h.y + h.h - 2, h.w + 2, 3, 0.5); }
    for (const h of H) if (!fallen.includes(h) && h !== H[1]) b.burn(h, { blazes: h.w > 6 ? 2 : 1, size: 6 });
    b.night(0.5, "#3a1c1c");
  }
  if (rebuilt) {
    // A year later: the fallen houses stand again under scaffolding, lumber stacked by them, a work tent on the green.
    for (const h of [H[3], H[5]]) b.scaffold(h, h.door.x - h.x > 2 ? 0 : h.w - 3);
    b.props([["통나무 더미", H[3].x - 2, H[3].y + H[3].h - 2, "재건용 목재", H[3].id], ["장작 더미", H[3].x - 2, H[3].y + H[3].h - 3, "재건용 목재", H[3].id],
      ["통나무 더미", H[5].x + H[5].w + 1, H[5].y + H[5].h - 2, "재건용 목재", H[5].id], ["나무 상자", H[5].x + H[5].w + 1, H[5].y + H[5].h - 3, "연장 상자", H[5].id],
      ["가죽 천막", 40, 31, "일꾼 천막"], ["모닥불", 44, 33, "일꾼 모닥불"]]);
  }
  b.forest({ bands: { north: [2, 1.5], west: [3, 1.5], east: [2, 1] }, blobs: [[2, 37, 6, 4, 12], [48, 37, 5, 4, 10]], clear: [[25, 19, 16, 11, 14]] });
  b.edgeClumps(4);
  b.tallGrass(burnt ? 2 : 5, [5, 9]);
  b.threes(348, burnt ? 2 : 6);
}

export const HOME_PLANS = [
  {
    id: "town-home-brook", name: "개울가 버들 마을", category: "home", tilesetId: F, width: 52, height: 40, seed: 11101, plaza: [["cobble", ["벤치", "화분", "돌등"]]],
    purpose: "개울이 마을을 가르는 시작 마을. 나무다리 둘로 두 기슭을 잇고, 동쪽 기슭 우물 마당에 가게가 모인다",
    note: "북쪽 숲에서 내려온 개울이 마을 서쪽을 남북으로 흐르고 나무다리 둘이 기슭을 잇는다. 서쪽 기슭엔 물레방앗간 집과 어부 집, 동쪽 기슭 우물 마당 둘레에 잡화점·여관·대장간·주인공 집이 선다. 서쪽 들길과 동쪽 숲길로 나간다",
    build(b) {
      b.river({ width: 3, points: [[17, 0], [17, 10], [15, 18], [16, 28], [18, 39]], pools: [[13.5, 25, 3.2, 2.4]] });
      b.smoothWater(); b.paintWater();
      b.bridges([[16, 12], [17, 31]]);
      b.exits([{ side: "west", at: 13, meets: "서쪽 들길(필드) 동쪽 출구" }, { side: "east", at: 22, meets: "동쪽 숲길(필드) 서쪽 출구" }]);
      b.pave(b.ellipseCells(32, 21, 5.5, 3.2, 0.08), "cobble", { name: "우물 마당" });
      b.put("낮은 돌 우물", 31, 20, { purpose: "마당 우물" });
      b.spine([["exit:0", "bridge-west:0"], ["bridge-east:0", [26, 13], [32, 17]], [[37, 21], "exit:1"], [[32, 25], [30, 32], "bridge-east:1"], ["bridge-west:1", [8, 32]]]);
      b.homes([
        ["gable-2f-lean", "timber-hall", 3, 3, "물레방앗간 집", "storage", "right"],
        ["gable-long", "thatch-log", 4, 22, "어부 집", "fishing", "right"],
        ["gable-cross-l", "amber-wood", 24, 3, "여관", "tavern", "right"],
        ["gable-twin-step", "bright-plaster", 38, 5, "잡화점", "shop", "left"],
        ["gable-house", "moss-plaster", 40, 26, "주인공 집", "garden", "left"],
        ["gable-long-low", "slate-brick", 22, 26, "대장간", "smith", "left"],
      ]);
      b.connect(); b.paintRoads(); b.plazaUnroad();
      b.props([["게시판", 36, 17, "마을 게시판", "우물 마당"], ["벤치", 27, 23, "우물가 벤치", "우물 마당"]]);
      b.pier(12, 22, "east", 2);
      b.yards();
      b.forest({ bands: { north: [3, 1.5], south: [2, 1.5], east: [2, 1] }, blobs: [[48, 36, 5, 4, 10], [2, 37, 5, 4, 10]], clear: [[32, 20, 14, 10, 14]] });
      b.edgeClumps(4);
      b.tallGrass(5, [5, 9]);
      b.threes(348, 6);
    },
  },
  {
    id: "town-home-hilltop", name: "바람 언덕 계단 마을", category: "home", tilesetId: F, width: 46, height: 48, seed: 11201, plaza: [["cobble", ["벤치", "돌등", "화분"]]],
    purpose: "언덕 비탈에 두 단으로 앉은 시작 마을. 아랫단 장터에서 돌계단으로 윗단 예배당과 촌장 집에 오른다",
    note: "남쪽 들판 길로 들어오면 아랫단 우물 장터와 집 셋, 돌계단으로 가운데 단에 오르면 여관과 주인공 집, 다시 계단으로 맨 윗단에 오르면 돌벽 예배당과 촌장 집이 마을을 내려다본다. 절벽 발치마다 덤불과 바위가 붙는다",
    build(b) {
      b.cliffs([{ points: [[0, 30], [14, 30], [16, 31], [30, 31], [32, 30], [45, 30]], height: 4, left: "open", right: "open" },
        { points: [[0, 15], [10, 15], [12, 14], [28, 14], [30, 15], [45, 15]], height: 4, left: "open", right: "open" }]);
      b.stairs([[22, 31, 4], [33, 15, 4]]);
      b.exits([{ side: "south", at: 22, meets: "언덕 아래 들판(필드) 북쪽 출구" }]);
      b.landmark("church", 7, 3);
      b.pave(b.ellipseCells(22, 40.5, 5, 2.5, 0.06), "cobble", { name: "아랫단 장터" });
      b.put("낮은 돌 우물", 21, 40, { purpose: "장터 우물" });
      b.spine([["exit:0", [22, 43]], [[22, 38], "stairs-bottom:0"], ["stairs-top:0", [28, 25], "stairs-bottom:1"], ["stairs-top:1", [30, 11], [15, 12]]]);
      b.homes([
        ["gable-2f-porch", "slate-brick", 30, 2, "촌장 집", "garden", "left"],
        ["gable-long", "thatch-plaster", 5, 21, "주인공 집", "laundry", "right"],
        ["gable-long-step", "amber-wood", 35, 21, "여관", "tavern", "left"],
        ["gable-twin", "bright-plaster", 5, 36, "잡화점", "shop", "right"],
        ["gable-long-low", "amber-brick", 34, 37, "대장간", "smith", "left"],
      ], 6);
      b.connect(); b.paintRoads(); b.plazaUnroad();
      b.props([["장터 노점", 15, 38, "장터 노점", "아랫단 장터"], ["과일 좌판", 26, 42, "장터 좌판", "아랫단 장터"], ["나무 이정표", 24, 45, "마을 입구 표지"]]);
      b.yards();
      b.forest({ bands: { west: [2, 1], east: [2, 1], north: [1, 1] }, blobs: [[43, 45, 5, 4, 10], [2, 46, 5, 3, 10]], noise: 0.6 });
      b.edgeClumps(4);
      b.tallGrass(4, [5, 8]);
      b.threes(348, 6);
    },
  },
  {
    id: "town-home-clearing", name: "숲속 둥근 빈터 마을", category: "home", tilesetId: F, width: 46, height: 42, seed: 11301,
    purpose: "깊은 숲 한가운데 둥근 빈터에 집들이 둘러앉은 시작 마을. 가운데 큰 참나무와 우물, 남쪽 오솔길 하나로만 들어온다",
    note: "사방이 짙은 숲인 둥근 빈터에 집 여섯 채가 가운데 풀밭을 보고 둥글게 선다. 풀밭 한가운데 오래된 큰 참나무와 우물, 모닥불 자리가 있고, 남쪽 오솔길 하나로만 바깥 숲길에 닿는다",
    build(b) {
      b.exits([{ side: "south", at: 23, meets: "숲길(필드) 북쪽 출구" }]);
      b.trees([["big-oak", 21, 16]]);
      b.put("낮은 돌 우물", 17, 22, { purpose: "빈터 우물" });
      b.put("모닥불", 27, 22, { purpose: "빈터 모닥불", owner: "빈터" });
      b.spine([["exit:0", [23, 33], [23, 26]], [[14, 26], [32, 26]], [[14, 26], [12, 18], [16, 11], [23, 9], [30, 11], [34, 18], [32, 26]]]);
      b.homes([
        ["gable-steep", "thatch-log", 7, 18, "나무꾼 집", "woodwork", "left"],
        ["gable-house", "moss-plaster", 11, 3, "주인공 집", "herbs", "left"],
        ["gable-2f-narrow", "timber-hall", 21, 0, "촌장 집", "garden", "right"],
        ["gable-house", "thatch-plaster", 29, 3, "사냥꾼 집", "storage", "right"],
        ["gable-barn", "amber-wood", 34, 18, "여관", "tavern", "right"],
        ["gable-shed", "thatch-log", 8, 29, "장작 헛간", null, null],
      ], 5);
      b.connect(); b.paintRoads();
      b.props([["통나무 더미", 26, 21, "모닥불 둘레 통나무", "빈터"], ["통나무 더미", 28, 21, "모닥불 둘레 통나무", "빈터"], ["벤치", 17, 25, "우물가 벤치", "빈터"], ["장작 더미", 13, 33, "장작 헛간 장작", "장작 헛간"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], south: [7, 2], west: [5, 2], east: [5, 2] }, blobs: [[2, 2, 7, 6, 14], [44, 2, 7, 6, 14], [2, 40, 8, 6, 14], [44, 40, 8, 6, 14]], clear: [[23, 17, 16, 14, 18]] });
      b.edgeClumps(5, ["tree", "round-bush", "small-bush"]);
      b.tallGrass(4, [5, 8]);
      b.threes(348, 5);
    },
  },
  {
    id: "town-home-lakeside", name: "물안개 호반 마을", category: "home", tilesetId: F, width: 54, height: 40, seed: 11401, plaza: [["cobble", ["벤치", "화분", "돌등"]]],
    purpose: "큰 호수 북쪽 기슭에 늘어선 시작 마을. 선착장 셋에 나룻배가 매였고 호숫가 산책길 따라 집이 선다",
    note: "맵 남쪽 절반이 잔잔한 호수. 북쪽 기슭을 따라 동서로 호숫가 길이 나고 그 위로 집 여섯 채가 호수를 본다. 가운데 선착장 마당에 분수와 벤치, 선착장 셋에 나룻배. 서쪽과 동쪽 길로 나간다",
    build(b) {
      b.waterWhere((x, y) => y > 25 + 2.5 * Math.sin(x / 6.5) + 1.2 * Math.sin(x / 2.7 + 1));
      b.smoothWater(); b.paintWater();
      b.exits([{ side: "west", at: 17, meets: "서쪽 들판(필드) 동쪽 출구" }, { side: "east", at: 15, meets: "호숫가 숲길(필드) 서쪽 출구" }]);
      b.pave(b.ellipseCells(27, 19.5, 5.5, 2.6, 0.06), "cobble", { name: "선착장 마당" });
      b.put("광장 분수", 26, 18, { purpose: "마당 분수" });
      b.spine([["exit:0", [10, 18], [21, 19]], [[33, 19], [44, 17], "exit:1"]]);
      b.homes([
        ["gable-cross", "bright-plaster", 3, 4, "촌장 집", "garden", "right"],
        ["gable-house", "thatch-plaster", 16, 5, "주인공 집", "laundry", "right"],
        ["gable-2f", "slate-brick", 25, 3, "여관", "tavern", "left"],
        ["gable-twin", "amber-brick", 33, 5, "잡화점", "shop", "right"],
        ["gable-long", "slate-wood", 45, 5, "어부 집", "fishing", "left"],
      ], 5);
      b.connect(); b.paintRoads(); b.plazaUnroad();
      const piers = [b.pier(14, 21, "south", 4), b.pier(27, 22, "south", 5), b.pier(40, 21, "south", 4)];
      b.moorNear("나룻배", 16, 26, { purpose: "호수 나룻배" });
      b.moorNear("나룻배", 29, 28, { purpose: "호수 나룻배" });
      b.posts([[26, 25], [28, 26], [39, 25]]);
      b.props([["부두 상자", 12, 21, "부두 짐", "부두"], ["밧줄 뭉치", 38, 21, "부두 짐", "부두"], ["부두 술통", 42, 21, "부두 짐", "부두"], ["낚시 바구니", 31, 22, "낚시 자리", "부두"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1.5], west: [2, 1], east: [2, 1] }, blobs: [[2, 22, 4, 4, 8], [52, 22, 4, 4, 8]] });
      b.edgeClumps(4);
      b.tallGrass(4, [5, 8]);
      b.threes(348, 5);
    },
  },
  {
    id: "town-home-coast", name: "소금바람 곶 마을", category: "home", tilesetId: F, width: 50, height: 42, seed: 11501, leak: false,
    purpose: "바다로 튀어나온 곶 끝의 시작 마을. 해안 절벽 위 등대 쉼터에서 계단으로 내려가면 모래톱 선착장",
    note: "동쪽과 남쪽이 바다인 곶. 절벽 윗단에 집 다섯 채와 우물·게시판이 있고, 돌계단으로 내려가면 아랫단 물가에 그물 손질 오두막과 선착장, 나룻배가 있다. 북서쪽 숲길로 들어온다",
    build(b) {
      b.cliffs([{ points: [[0, 23], [12, 23], [14, 22], [30, 22], [32, 23], [38, 23]], height: 4, left: "open", right: "open" }]);
      b.waterWhere((x, y) => x > 41 + 2 * Math.sin(y / 4) || y > 36 + 1.5 * Math.sin(x / 5));
      b.smoothWater(); b.paintWater();
      b.stairs([[20, 22, 4]]);
      b.exits([{ side: "west", at: 12, meets: "해안 숲길(필드) 동쪽 출구" }]);
      b.put("낮은 돌 우물", 22, 14, { purpose: "마을 우물" });
      b.spine([["exit:0", [12, 12], [20, 17], [26, 17]], [[21, 18], "stairs-top:0"], ["stairs-bottom:0", [22, 31], [32, 32]]]);
      b.homes([
        ["gable-house", "slate-wood", 4, 12, "주인공 집", "laundry", "right"],
        ["gable-2f-long", "blue-stone", 13, 2, "촌장 집", "garden", "right"],
        ["gable-cross-l", "slate-brick", 27, 5, "여관", "tavern", "right"],
        ["gable-long-low", "bright-plaster", 31, 15, "잡화점", "shop", "right"],
        ["gable-long-low", "thatch-log", 6, 28, "그물 손질 오두막", "fishing", "right"],
      ], 5);
      b.connect(); b.paintRoads();
      b.pier(34, 32, "east", 5);
      b.moorNear("나룻배", 37, 36, { purpose: "선착장 나룻배" });
      b.props([["게시판", 17, 17, "마을 게시판"], ["벤치", 25, 16, "우물가 벤치", "마을 우물"], ["부두 술통", 33, 31, "부두 짐", "부두"], ["닻", 31, 34, "부두 짐", "부두"], ["밧줄 뭉치", 33, 35, "부두 짐", "부두"]]);
      b.yards();
      b.forest({ bands: { north: [3, 1.5], west: [2, 1] }, blobs: [[2, 2, 6, 5, 12], [38, 2, 6, 4, 10]] });
      b.edgeClumps(4);
      b.tallGrass(5, [5, 9]);
      b.threes(348, 5);
    },
  },
  {
    id: "town-home-meadow", name: "들꽃 언덕 고향 마을", category: "home", tilesetId: F, width: 50, height: 40, seed: 11001, state: "평화", plaza: [["cobble", ["벤치", "돌등", "화분", "꽃 화단"]]],
    purpose: "주인공이 태어난 첫 마을. 분수 마당을 가운데 두고 촌장 집·여관·대장간·잡화점·약초 할멈 집이 모인다",
    note: "남쪽 들판 길로 들어오면 작은 분수 마당이 나오고, 그 북쪽에 촌장의 2층 집, 서쪽에 주인공 집, 동쪽에 여관과 헛간, 남동쪽에 대장간, 남서쪽에 잡화점과 약초 할멈 집이 선다. 북서쪽 물레방아 못에 낚시 판자가 나 있고 동쪽 숲길로 다음 필드가 이어진다",
    pair: "town-home-meadow", build: (b) => meadowHome(b, "peace"),
  },
  {
    id: "town-home-meadow-burning", name: "불타는 들꽃 언덕 마을", category: "home", tilesetId: F, width: 50, height: 40, seed: 11001, state: "불탐", plaza: [["cobble", ["그을린 들보 1", "그을린 들보 2", "잿자리 1", "잿자리 2", "돌 무더기", "부서진 울타리"]]],
    purpose: "고향이 습격당한 밤. 지붕마다 불길이 오르고 대장간과 잡화점은 이미 무너졌다. 주인공 집만 불이 붙지 않았다",
    note: "「들꽃 언덕 고향 마을」과 같은 배치. 밤(붉은 어둠 조명). 촌장 집·여관·헛간·약초 할멈 집 지붕에 불길, 대장간·잡화점은 무너져 잔해 위로 큰 불길과 그을린 들보, 집 둘레마다 잿자리. 분수 마당에서 남쪽 길로 달아난다",
    pair: "town-home-meadow", build: (b) => meadowHome(b, "burning"),
  },
  {
    id: "town-home-meadow-rebuilt", name: "다시 세운 들꽃 언덕 마을", category: "home", tilesetId: F, width: 50, height: 40, seed: 11001, state: "재건", plaza: [["cobble", ["통나무 더미", "나무 상자", "돌등", "꽃 화단"]]],
    purpose: "습격 뒤 다시 세우는 고향. 무너졌던 대장간과 잡화점이 비계를 두른 채 새로 서고, 목재 더미와 일꾼 천막이 곁에 있다",
    note: "「들꽃 언덕 고향 마을」과 같은 배치. 촌장 집은 검은 목조로 새로 지었고, 대장간·잡화점 벽에 비계가 서 있으며 곁에 통나무·장작·연장 상자가 쌓였다. 남동쪽 공터에 일꾼 천막과 모닥불",
    pair: "town-home-meadow", build: (b) => meadowHome(b, "rebuilt"),
  },
];
