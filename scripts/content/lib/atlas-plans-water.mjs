// Atlas towns · river, lake, waterfall, canal, marsh, river-port and delta towns (물가 마을). Forest sheet.
const F = "forest_harmony";

export const WATER_PLANS = [
  {
    id: "town-river-twinbridge", name: "두 다리 강마을", category: "water", tilesetId: F, width: 58, height: 42, seed: 12101, plaza: [["cobble", ["벤치", "돌등", "화분", "꽃 화단"]]],
    purpose: "넓은 강을 사이에 둔 강마을. 위아래 나무다리 둘, 서쪽 기슭 물레방앗간과 어부 집, 동쪽 기슭 분수 장터",
    note: "마을 가운데를 폭 넓은 강이 북에서 남으로 흐르고 나무다리 둘이 두 기슭을 잇는다. 서쪽 기슭엔 물레방앗간·어부 집·빨래터 선착장, 동쪽 기슭엔 분수 장터를 둘러싼 여관·잡화점·대장간·집들이 모인다. 서쪽과 동쪽 길로 나간다",
    build(b) {
      b.river({ width: 5, points: [[22, 0], [22, 9], [20, 17], [21, 27], [24, 34], [24, 41]], pools: [[18, 21, 3.5, 3]] });
      b.smoothWater(); b.paintWater();
      b.bridgeNear(22, 7); b.bridgeNear(22, 31);
      b.exits([{ side: "west", at: 8, meets: "서쪽 들판(필드) 동쪽 출구" }, { side: "east", at: 20, meets: "동쪽 큰길(필드) 서쪽 출구" }]);
      b.pave(b.ellipseCells(38, 20, 6.5, 3.8, 0.07), "cobble", { name: "분수 장터" });
      b.put("광장 분수", 37, 19, { purpose: "장터 분수" });
      b.spine([["exit:0", "bridge-west:0"], ["bridge-east:0", [30, 9], [37, 15]], [[44, 20], "exit:1"], [[37, 25], [32, 32], "bridge-east:1"], ["bridge-west:1", [12, 32], [8, 24]]]);
      b.homes([
        ["gable-2f-lean", "timber-hall", 5, 12, "물레방앗간 집", "storage", "right"],
        ["gable-long", "slate-wood", 3, 32, "어부 집", "fishing", "right"],
        ["gable-cross-r", "amber-brick", 29, 1, "여관", "tavern", "left"],
        ["gable-twin-big", "bright-plaster", 43, 3, "잡화점", "shop", "left"],
        ["gable-long-low", "slate-brick", 47, 25, "대장간", "smith", "left"],
        ["gable-house", "thatch-plaster", 36, 29, "집", "laundry", "right"],
        ["gable-steep", "moss-plaster", 11, 1, "사공 집", "fishing", "right"],
      ], 5);
      b.connect(); b.paintRoads(); b.plazaUnroad();
      b.props([["장터 노점", 31, 17, "장터 노점", "분수 장터"], ["줄무늬 노점 빨강", 42, 22, "장터 노점", "분수 장터"], ["게시판", 45, 17, "마을 게시판", "분수 장터"]]);
      b.pier(17, 26, "east", 2);
      b.props([["빨랫줄", 13, 25, "빨래터", "선착장"], ["나무통", 15, 25, "빨래통", "선착장"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], south: [2, 1.5], east: [2, 1] }, blobs: [[56, 40, 5, 4, 10], [2, 40, 4, 3, 8]] });
      b.edgeClumps(4);
      b.tallGrass(5, [5, 9]);
      b.threes(348, 6);
    },
  },
  {
    id: "town-river-fork", name: "세 갈래 물목 마을", category: "water", tilesetId: F, width: 56, height: 46, seed: 12201, plaza: [["cobble", ["벤치", "돌등", "화분"]]],
    purpose: "두 개울이 만나 강이 되는 물목의 마을. 세 기슭을 나무다리 셋이 잇고 합수머리 광장에 장이 선다",
    note: "북서쪽과 북동쪽에서 내려온 두 개울이 마을 가운데서 만나 남쪽으로 흐른다. 물줄기가 마을을 세 쪽으로 나누고 나무다리 셋이 잇는다. 북쪽 쪽엔 촌장 집과 예배당, 서쪽엔 농가와 헛간, 동쪽엔 여관과 가게가 있고 합수머리 남동쪽 광장에 장이 선다",
    build(b) {
      b.river({ width: 3, points: [[10, 0], [13, 8], [20, 16], [26, 22]] });
      b.river({ width: 3, points: [[44, 0], [41, 8], [33, 16], [27, 22]] });
      b.river({ width: 4, points: [[27, 22], [27, 32], [25, 45]], pools: [[28, 23, 3, 2.2]] });
      b.smoothWater(); b.paintWater();
      b.bridges([[27, 33]]);
      b.exits([{ side: "south", at: 38, meets: "남쪽 들판(필드) 북쪽 출구" }, { side: "west", at: 30, meets: "서쪽 들길(필드) 동쪽 출구" }, { side: "north", at: 27, meets: "북쪽 산길(필드) 남쪽 출구" }]);
      b.pave(b.ellipseCells(38, 30, 5.5, 3.2, 0.07), "cobble", { name: "합수머리 광장" });
      b.put("낮은 돌 우물", 37, 29, { purpose: "광장 우물" });
      const w = b.planks(16, 16, "east"), e = b.planks(29, 13, "east");
      b.spine([["exit:0", [38, 38], [38, 34]], [[33, 30], "bridge-east:0"], ["bridge-west:0", [14, 34], "exit:1"], ["exit:2", [27, 12]], [w.from, [14, 22], [14, 30]], [w.to, [27, 12]], [e.from, [27, 12]], [e.to, [40, 22], [36, 28]]]);
      b.landmark("church", 17, 1);
      b.homes([
        ["gable-2f-narrow", "slate-brick", 31, 1, "촌장 집", "garden", "right"],
        ["gable-cross-l", "thatch-plaster", 3, 12, "농가", "farm", "right"],
        ["gable-barn", "thatch-log", 6, 36, "헛간", "storage", "right"],
        ["gable-cross-r", "amber-wood", 45, 13, "여관", "tavern", "left"],
        ["gable-hall", "bright-plaster", 45, 32, "잡화점", "shop", "left"],
        ["gable-house", "blue-stone", 14, 22, "집", "laundry", "right"],
      ], 5);
      b.connect(); b.paintRoads(); b.plazaUnroad();
      // Joining the three banks: plank crossings where the path meets each stream (docks laid across the water).
      b.props([["줄무늬 노점 초록", 41, 26, "장터 노점", "합수머리 광장"], ["과일 좌판", 34, 33, "장터 좌판", "합수머리 광장"], ["게시판", 43, 29, "마을 게시판", "합수머리 광장"]]);
      b.yards();
      b.forest({ bands: { north: [1, 1], south: [2, 1.5], west: [2, 1], east: [2, 1] }, blobs: [[54, 44, 5, 4, 10], [2, 2, 4, 4, 8], [54, 2, 4, 4, 8]] });
      b.edgeClumps(4);
      b.tallGrass(5, [5, 9]);
      b.threes(348, 6);
    },
  },
  {
    id: "town-lake-island", name: "호수 섬 성당 마을", category: "water", tilesetId: F, width: 56, height: 48, seed: 12301,
    purpose: "호수 한가운데 섬에 성당과 집들이 앉고, 남쪽 기슭에서 긴 판자 둑길로 건너는 섬 마을",
    note: "넓은 호수 가운데 둥근 섬에 돌벽 성당과 집 셋, 섬 가운데 우물이 있다. 남쪽 기슭 나루 마을(집 둘·선착장·나룻배)에서 긴 판자 둑길이 섬까지 이어진다. 북쪽 기슭은 숲",
    build(b) {
      b.pond(28, 20, 24, 15, 0.08);
      for (const i of b.ellipseCells(28, 17.5, 12, 9, 0.08)) b.water.delete(i);
      b.smoothWater(); b.paintWater();
      b.exits([{ side: "south", at: 28, meets: "호숫가 들판(필드) 북쪽 출구" }]);
      // The causeway: plank deck across the lake from the south shore to the island.
      let y0 = 25; while (!b.water.has(b.at(28, y0))) y0++;
      let y1 = y0; while (b.water.has(b.at(28, y1 + 1))) y1++;
      b.dock(28, y0, 2, y1 - y0 + 1, "causeway-south");
      b.access.push({ role: "causeway-north", x: 28, y: y0 - 1 });
      b.landmark("church", 25, 10);
      b.put("낮은 돌 우물", 27, 20, { purpose: "섬 우물" });
      b.spine([["exit:0", [28, y1 + 1]], [[28, y0 - 1], [28, 22], [26, 18]]]);
      b.homes([
        ["gable-house", "slate-brick", 18, 13, "수도사 숙소", "herbs", "left"],
        ["gable-long-low", "bright-plaster", 33, 17, "순례자 숙소", "laundry", "right"],
        ["gable-long", "amber-wood", 12, 38, "나루지기 집", "fishing", "left"],
        ["gable-twin", "thatch-plaster", 38, 38, "여관", "tavern", "right"],
      ], 4);
      b.connect([...["door-front", "landmark-door"]]); b.paintRoads();
      b.pier(22, 37, "north", 3);
      b.moorNear("나룻배", 20, 31, { purpose: "나루 나룻배" });
      b.props([["돌등", 26, 24, "둑길 등불", "둑길"], ["돌등", 31, 24, "둑길 등불", "둑길"], ["부두 상자", 24, 38, "나루 짐", "나루"], ["밧줄 뭉치", 20, 38, "나루 짐", "나루"], ["돌 석상", 22, 20, "섬 수호상"]]);
      b.yards();
      b.forest({ bands: { north: [3, 1.5], west: [2, 1], east: [2, 1] }, blobs: [[2, 46, 5, 4, 10], [54, 46, 5, 4, 10]] });
      b.edgeClumps(4);
      b.tallGrass(4, [5, 8]);
      b.threes(348, 6);
    },
  },
  {
    id: "town-waterfall", name: "폭포 아래 물레 마을", category: "water", tilesetId: F, width: 50, height: 50, seed: 12401, plaza: [["cobble", ["벤치", "화분", "돌등"]]],
    purpose: "높은 절벽에서 떨어지는 폭포 아래 못가에 물레방아와 집이 모인 마을. 돌계단으로 윗단 전망대에 오른다",
    note: "북쪽 절벽 위에서 개울이 두 단 폭포로 떨어져 아랫단 둥근 못에 고인다. 못에서 흘러나간 물은 남쪽으로 흐르고 나무다리 하나로 건넌다. 못가에 물레방앗간·여관·가게, 윗단에 전망 쉼터와 약초꾼 집. 남쪽 길로 들어온다",
    build(b) {
      b.cliffs([{ points: [[0, 14], [16, 14], [18, 13], [34, 13], [36, 14], [49, 14]], height: 6, left: "open", right: "open" }]);
      b.stairs([[9, 14, 6]]);
      b.river({ width: 3, points: [[26, 0], [26, 8], [25, 13], [25, 22], [27, 30], [27, 40], [29, 49]], pools: [[25, 24, 6, 3.6]] });
      b.smoothWater(); b.paintWater();
      b.bridgeNear(27, 38); b.bridgeNear(26, 4);
      b.exits([{ side: "south", at: 20, meets: "남쪽 들판(필드) 북쪽 출구" }]);
      b.pave(b.ellipseCells(16, 30, 4.5, 2.6, 0.07), "cobble", { name: "못가 마당" });
      b.put("낮은 돌 우물", 15, 29, { purpose: "마당 우물" });
      b.spine([["exit:0", [20, 44], [18, 34]], [[20, 39], "bridge-west:0"], ["bridge-east:0", [40, 37]], [[13, 30], [10, 24], "stairs-bottom:0"], ["stairs-top:0", [10, 8], [18, 6]], [[18, 6], "bridge-west:1"]]);
      b.homes([
        ["gable-2f-lean", "timber-hall", 32, 21, "물레방앗간", "storage", "right"],
        ["gable-cross-l", "amber-wood", 3, 34, "여관", "tavern", "right"],
        ["gable-porch", "bright-plaster", 36, 40, "잡화점", "shop", "left"],
        ["gable-house", "moss-plaster", 36, 2, "약초꾼 집", "herbs", "left"],
        ["gable-long", "thatch-log", 4, 22, "나무꾼 집", "woodwork", "right"],
      ], 5);
      b.connect(); b.paintRoads(); b.plazaUnroad();
      b.props([["벤치", 18, 5, "폭포 전망 벤치", "전망 쉼터"], ["돌등", 21, 6, "전망 쉼터 등불", "전망 쉼터"], ["나무 이정표", 22, 44, "마을 입구 표지"]]);
      b.pier(20, 25, "east", 2);
      b.yards();
      b.forest({ bands: { north: [2, 1], west: [2, 1], east: [2, 1] }, blobs: [[2, 47, 5, 4, 10], [47, 47, 5, 4, 10], [45, 30, 4, 5, 10]] });
      b.edgeClumps(4);
      b.tallGrass(4, [5, 8]);
      b.threes(348, 6);
    },
  },
  {
    id: "town-canal", name: "물길 운하 마을", category: "water", tilesetId: F, width: 60, height: 48, seed: 12501, plaza: [["cobble", ["벤치", "돌등", "화분", "꽃 화단"]]],
    purpose: "마을을 물길 두 줄이 가로지르는 운하 마을. 판자 다리로 구획을 건너고 물가마다 선착장과 창고",
    note: "동서로 곧게 판 운하 두 줄이 마을을 세 구획으로 나눈다. 판자 다리 넷이 구획을 잇고, 가운데 구획 광장에 분수와 가게가 모인다. 북쪽 구획은 창고와 상인 집, 남쪽 구획은 집과 여관. 운하 선착장에 나룻배가 매였다. 서쪽과 동쪽 둑길로 나간다",
    build(b) {
      b.waterWhere((x, y) => (y >= 12 && y <= 16) || (y >= 29 && y <= 33));
      b.smoothWater(); b.paintWater();
      for (const x of [14, 40]) b.dock(x, 12, 2, 5, "canal-bridge");
      for (const x of [22, 46]) b.dock(x, 29, 2, 5, "canal-bridge");
      for (const [x, y] of [[14, 11], [14, 17], [40, 11], [40, 17], [22, 28], [22, 34], [46, 28], [46, 34]]) b.access.push({ role: "plank-end", x, y });
      b.exits([{ side: "west", at: 22, meets: "서쪽 둑길(필드) 동쪽 출구" }, { side: "east", at: 22, meets: "동쪽 둑길(필드) 서쪽 출구" }]);
      b.pave(b.ellipseCells(30, 22, 6, 3.4, 0.05), "cobble", { name: "운하 광장" });
      b.put("광장 분수", 29, 21, { purpose: "광장 분수" });
      b.spine([["exit:0", [24, 22]], [[36, 22], "exit:1"], [[14, 17], [14, 22]], [[40, 17], [40, 22]], [[22, 28], [22, 22]], [[46, 28], [46, 22]], [[14, 11], [14, 9], [40, 9], [40, 11]], [[22, 34], [22, 45], [46, 45], [46, 34]]]);
      b.homes([
        ["gable-long", "slate-brick", 4, 2, "창고", "storage", "right"],
        ["gable-2f-long", "amber-brick", 20, 1, "상인 집", "shop", "right"],
        ["gable-long-step", "bright-plaster", 47, 2, "상인 집", "storage", "left"],
        ["gable-twin", "blue-stone", 7, 37, "집", "laundry", "right"],
        ["gable-cross-r", "amber-wood", 30, 36, "여관", "tavern", "left"],
        ["gable-house", "slate-wood", 51, 36, "사공 집", "fishing", "left"],
      ], 5);
      b.connect(["door-front", "plank-end"]); b.paintRoads("cobble"); b.plazaUnroad();
      b.moorNear("나룻배", 28, 12, { purpose: "운하 나룻배" });
      b.moorNear("나룻배", 4, 29, { purpose: "운하 나룻배" });
      b.props([["줄무늬 노점 파랑", 21, 19, "광장 노점", "운하 광장"], ["줄무늬 노점 빨강", 36, 25, "광장 노점", "운하 광장"], ["부두 상자", 26, 18, "운하 짐", "운하"], ["부두 술통", 27, 18, "운하 짐", "운하"], ["밧줄 뭉치", 34, 27, "운하 짐", "운하"]]);
      b.yards();
      b.forest({ bands: { north: [1, 0.5], south: [1, 0.5] }, blobs: [[58, 23, 3, 4, 8], [1, 16, 3, 3, 6]] , noise: 0.4 });
      b.scatterTrees(6, ["small-bush", "round-bush", "tree"]);
      b.threes(348, 6);
    },
  },
  {
    id: "town-marsh-stilts", theme: "swamp", name: "갈대 늪 판자길 마을", category: "water", tilesetId: F, width: 54, height: 42, seed: 12601,
    purpose: "넓은 늪 호수 안 작은 섬들을 판자길로 이은 늪 마을. 섬마다 오두막 하나, 갈대숲이 물가를 두른다",
    note: "맵 가운데 넓은 늪 호수에 작은 섬 셋이 떠 있고, 섬마다 오두막과 살림이 있다. 서쪽 기슭에서 판자길이 섬에서 섬으로 이어진다. 기슭엔 갈대숲(키 큰 풀)과 마른나무, 서쪽과 남쪽에서 들어온다",
    build(b) {
      b.pond(30, 20, 20, 15, 0.12);
      const islands = [[22, 13, 7, 5.2], [39, 12, 6.5, 5.2], [32, 28, 7.5, 5]];
      for (const [x, y, rx, ry] of islands) for (const i of b.ellipseCells(x, y, rx, ry, 0.12)) b.water.delete(i);
      b.smoothWater(); b.paintWater();
      b.exits([{ side: "west", at: 20, meets: "늪지 필드 동쪽 출구" }, { side: "south", at: 12, meets: "남쪽 둑길(필드) 북쪽 출구" }]);
      // Plank walks between the shore and the islands (runs over water only).
      const plank = (x, y, w, h) => { const cells = []; for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (b.water.has(b.at(x + dx, y + dy))) cells.push([x + dx, y + dy]); for (const [X, Y] of cells) { b.upper[b.at(X, Y)] = 199; b.bridgeCells.add(b.at(X, Y)); } };
      plank(9, 16, 12, 1); plank(26, 13, 8, 1); plank(33, 15, 1, 11);
      b.homes([
        ["gable-shed", "thatch-log", 20, 9, "늪지기 오두막", "fishing", "right"],
        ["gable-shed", "thatch-log", 37, 9, "약초 헛간", null, null],
        ["gable-shed", "moss-plaster", 30, 24, "마녀 오두막", "herbs", "left"],
        ["gable-steep", "thatch-log", 3, 25, "나룻꾼 집", "fishing", "right"],
      ], 3);
      b.spine([["exit:0", [8, 20], [8, 16]], ["exit:1", [10, 30], [8, 22]]]);
      b.connect(); b.paintRoads();
      b.props([["마른나무", 44, 30], ["마른나무", 4, 6], ["마른 묘목", 48, 8], ["낚시 바구니", 24, 16, "섬 낚시 자리", "늪"], ["항아리", 34, 30, "약초 항아리", "마녀 오두막"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1.5], east: [2, 1.5], south: [1, 1] }, blobs: [[52, 40, 5, 4, 10], [2, 2, 4, 4, 8]] });
      b.mudPools(5);
      b.tallGrass(14, [6, 12]);
      b.threes(740, 3, null, 2);
    },
  },
  {
    id: "town-river-port", name: "버들강 나루터 마을", category: "water", tilesetId: F, width: 58, height: 42, seed: 12701,
    purpose: "큰 강 북쪽 기슭의 나루터 마을. 강가 선착장 셋에 나룻배, 짐 창고와 사공 집, 강 건너 남쪽 기슭엔 판자 선착장 하나",
    note: "맵 남쪽을 동서로 넓은 강이 흐른다. 북쪽 기슭을 따라 강변길이 나고 짐 창고·사공 집·여관·세관 초소가 선다. 선착장 셋에 나룻배가 매였고 부두 뿌리에 상자·술통·밧줄이 쌓였다. 서쪽과 동쪽 길, 그리고 북쪽 들길로 나간다",
    build(b) {
      b.waterWhere((x, y) => y > 27 + 2 * Math.sin(x / 7) && y < 38 + 1.5 * Math.sin(x / 5 + 1));
      b.smoothWater(); b.paintWater();
      b.exits([{ side: "west", at: 22, meets: "서쪽 강변길(필드) 동쪽 출구" }, { side: "east", at: 20, meets: "동쪽 강변길(필드) 서쪽 출구" }, { side: "north", at: 30, meets: "북쪽 들길(필드) 남쪽 출구" }]);
      b.spine([["exit:0", [15, 22], [30, 22], [45, 21], "exit:1"], ["exit:2", [30, 12], [30, 22]]]);
      b.homes([
        ["gable-long", "slate-brick", 3, 11, "짐 창고", "storage", "right"],
        ["gable-2f-long", "amber-brick", 14, 9, "여관", "tavern", "right"],
        ["gable-porch-wide", "slate-wood", 34, 9, "세관 초소", "guard", "right"],
        ["gable-house", "thatch-log", 46, 8, "사공 집", "fishing", "left"],
        ["gable-long-low", "bright-plaster", 22, 1, "잡화점", "shop", "right"],
      ], 5);
      b.connect(); b.paintRoads();
      const ps = [b.pier(12, 24, "south", 4), b.pier(28, 25, "south", 4), b.pier(44, 24, "south", 4)];
      b.moorNear("나룻배", 14, 29, { purpose: "나룻배" }); b.moorNear("나룻배", 30, 30, { purpose: "짐배" }); b.moorNear("나룻배", 46, 29, { purpose: "나룻배" });
      b.posts([[11, 27], [27, 28], [43, 27]]);
      b.props([["부두 상자", 10, 24, "부두 짐", "부두"], ["부두 상자", 11, 23, "부두 짐", "부두"], ["부두 술통", 26, 24, "부두 짐", "부두"], ["밧줄 뭉치", 31, 24, "부두 짐", "부두"], ["닻", 42, 24, "부두 짐", "부두"], ["열린 물통", 46, 24, "부두 짐", "부두"],
        ["나무 이정표", 32, 17, "나루 갈림길 표지"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1.5], south: [2, 1] }, blobs: [[2, 2, 4, 4, 8], [56, 2, 4, 4, 8]] });
      b.edgeClumps(4);
      b.tallGrass(5, [5, 9]);
      b.threes(348, 5);
    },
  },
  {
    id: "town-river-delta", name: "모래톱 하구 마을", category: "water", tilesetId: F, width: 56, height: 44, seed: 12801,
    purpose: "강이 바다로 나가는 하구의 모래톱 마을. 두 갈래 물길 사이 모래톱에 어부 집이 모이고, 다리 둘로 양 기슭과 잇는다",
    note: "북쪽에서 내려온 강이 하구에서 두 갈래로 갈라져 남쪽 바다로 나간다. 두 물길 사이 모래톱에 어부 집과 그물 손질 마당, 서쪽 기슭엔 여관과 가게, 동쪽 기슭엔 소금 창고. 나무다리 둘로 건너고 바다 쪽 선착장에 나룻배가 매였다",
    build(b) {
      b.river({ width: 4, points: [[27, 0], [27, 10], [26, 16]] });
      b.river({ width: 3, points: [[26, 16], [19, 24], [16, 34], [15, 43]] });
      b.river({ width: 3, points: [[27, 16], [35, 24], [38, 34], [40, 43]] });
      b.waterWhere((x, y) => y > 37 + 1.5 * Math.sin(x / 4));
      b.smoothWater(); b.paintWater();
      b.bridgeNear(18, 26); b.bridgeNear(36, 26);
      b.exits([{ side: "west", at: 20, meets: "서쪽 해안길(필드) 동쪽 출구" }, { side: "east", at: 18, meets: "동쪽 소금밭 길(필드) 서쪽 출구" }]);
      b.spine([["exit:0", [8, 26], "bridge-west:0"], ["bridge-east:0", [27, 27], "bridge-west:1"], ["bridge-east:1", [47, 22], "exit:1"]]);
      b.homes([
        ["gable-long-low", "thatch-log", 22, 30, "어부 집", "fishing", "right"],
        ["gable-cross-l", "amber-wood", 4, 12, "여관", "tavern", "right"],
        ["gable-twin", "bright-plaster", 3, 28, "잡화점", "shop", "right"],
        ["gable-long", "slate-brick", 44, 8, "소금 창고", "storage", "left"],
        ["gable-house", "thatch-plaster", 45, 26, "염부 집", "laundry", "left"],
      ], 4);
      b.connect(); b.paintRoads();
      b.pier(27, 34, "south", 3);
      b.moorNear("나룻배", 29, 39, { purpose: "하구 나룻배" });
      b.props([["빨랫줄", 25, 25, "그물 말리기", "모래톱"], ["부두 상자", 25, 34, "부두 짐", "부두"], ["밧줄 뭉치", 29, 34, "부두 짐", "부두"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1.5] }, blobs: [[2, 2, 5, 5, 10], [54, 2, 5, 5, 10], [10, 4, 4, 3, 8]] });
      b.edgeClumps(4);
      b.tallGrass(6, [5, 10]);
      b.threes(348, 5);
    },
  },
];
