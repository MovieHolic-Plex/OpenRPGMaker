// Atlas towns · special villages: elf grove and elf lake, hot-spring town (forest and snow), pilgrims' shrine town,
// walled monastery, nomad camps (steppe and desert), goblin camp, orc war camp, abandoned villages (forest and snow),
// a festival day / night pair of the same town, witch hamlet in the marsh, knights' camp, academy town.
const F = "forest_harmony", SNOW = "forest_harmony_snow", SAND = "forest_harmony_desert", ASH = "forest_harmony_volcano", AUT = "forest_harmony_autumn";

// 풍등 축제 마을 — one layout for the festival day and the festival night (lanterns lit, darkness, same stalls).
function festivalTown(b, night) {
  b.exits([{ side: "south", at: 28, meets: "축제 들길(필드) 북쪽 출구" }, { side: "west", at: 18, meets: "서쪽 숲길(필드) 동쪽 출구" }]);
  b.pave(b.ellipseCells(28, 20, 10, 5.4, 0.04), "cobble", { name: "축제 광장" });
  b.stage(25, 13, 7, 3, "축제 무대");
  b.put("광장 분수", 27, 20, { purpose: "광장 분수" });
  b.spine([["exit:0", [28, 26]], ["exit:1", [18, 18]]]);
  b.homes([["gable-cross", "amber-wood", 5, 3, "여관", "tavern", "right"], ["gable-2f-porch", "slate-brick", 42, 2, "촌장 집", "garden", "left"], ["gable-twin", "bright-plaster", 43, 20, "잡화점", "shop", "left"],
    ["gable-long-low", "amber-brick", 6, 26, "대장간", "smith", "right"], ["gable-house", "thatch-plaster", 40, 31, "주인공 집", "laundry", "left"]], 5);
  b.connect(); b.paintRoads(); b.plazaUnroad();
  b.props([["줄무늬 노점 빨강", 19, 17, "축제 노점", "축제 광장"], ["줄무늬 노점 파랑", 19, 22, "축제 노점", "축제 광장"], ["줄무늬 노점 초록", 35, 17, "축제 노점", "축제 광장"], ["장터 노점", 35, 22, "축제 노점", "축제 광장"],
    ["붉은 축제 천막", 23, 22, "축제 먹거리 천막", "축제 광장"], ["술통", 31, 23, "축제 술통", "축제 광장"], ["벤치", 26, 24, "광장 벤치", "축제 광장"]]);
  b.streamer(18, 38, 15, { owner: "축제 광장", string: night ? "등롱 줄" : "축제 깃발 줄" });
  b.streamer(18, 38, 25, { owner: "축제 광장", string: night ? "등롱 줄" : "축제 깃발 줄" });
  b.props([["등롱 기둥", 21, 11, "무대 곁 등롱", "축제 무대"], ["등롱 기둥", 34, 11, "무대 곁 등롱", "축제 무대"], ["돌등", 16, 20, "광장 등불", "축제 광장"], ["돌등", 40, 18, "광장 등불", "축제 광장"]]);
  if (night) { b.props([["모닥불", 29, 27, "축제 모닥불", "축제 광장"]]); b.night(0.55, "#1c2448"); }
  b.yards();
  b.forest({ bands: { north: [2, 1.5], east: [2, 1], south: [2, 1] }, blobs: [[2, 36, 5, 3, 10], [54, 36, 4, 3, 8]], clear: [[28, 19, 16, 11, 14]] });
  b.edgeClumps(4);
  b.threes(348, 5);
}

// A camp of tents round a fire: tents (3×3) at the given spots, the fire and its logs in the middle (owner = camp name).
function camp(b, name, fire, tents, tent = "가죽 천막") {
  b.put("모닥불", fire[0], fire[1], { purpose: name + " 모닥불", owner: name });
  b.props([["통나무 더미", fire[0] - 1, fire[1], "모닥불 둘레 통나무", name], ["통나무 더미", fire[0] + 1, fire[1], "모닥불 둘레 통나무", name]]);
  for (const [x, y] of tents) b.props([[tent, x, y, name + " 천막", name]]);
}

export const SPECIAL_PLANS = [
  {
    id: "town-elf-grove", name: "은빛잎 엘프 숲마을", category: "special", tilesetId: F, width: 54, height: 46, seed: 19201,
    purpose: "거대한 참나무 숲 속 엘프 마을. 큰 참나무 사이 이끼 지붕 집, 울타리 친 석상 못의 성소, 덩굴 아치 오솔길",
    note: "하늘을 가리는 큰 참나무들 사이로 이끼 지붕의 엘프 집 여섯이 흩어져 있다. 가운데 울타리 친 석상 못이 엘프의 성소이고, 오솔길마다 덩굴 아치와 꽃 화단. 남쪽 숲길 하나로 드나든다",
    build(b) {
      b.landmark("shrine-pond", 20, 15);
      b.exits([{ side: "south", at: 27, meets: "엘프 숲길(필드) 북쪽 출구" }]);
      b.spine([["exit:0", [27, 34]], [[8, 32], [46, 32]], [[27, 32], [27, 28]]]);
      b.homes([["gable-steep", "moss-plaster", 5, 5, "엘프 장로 집", "garden", "right"], ["gable-house", "moss-plaster", 41, 5, "엘프 궁수 집", "guard", "left"], ["gable-porch", "thatch-plaster", 5, 20, "약초사 집", "herbs", "right"],
        ["gable-house", "moss-plaster", 41, 20, "엘프 집", "bees", "left"], ["gable-long-low", "moss-plaster", 10, 35, "엘프 공방", "woodwork", "right"], ["gable-2f-narrow", "moss-plaster", 38, 35, "엘프 집", "garden", "left"]], 5);
      b.connect(); b.paintRoads();
      b.trees([["big-oak", 14, 8], ["big-oak", 34, 7], ["big-oak", 15, 24], ["big-oak", 36, 23], ["big-oak", 24, 3]]);
      b.props([["덩굴 아치", 26, 30, "성소 가는 아치", "성소"], ["꽃 화단", 23, 29, "성소 화단", "성소"], ["꽃 화단", 30, 29, "성소 화단", "성소"], ["돌등", 19, 28, "성소 등불", "성소"], ["돌등", 35, 28, "성소 등불", "성소"]]);
      b.yards();
      b.forest({ bands: { north: [3, 1.5], west: [3, 1.5], east: [3, 1.5], south: [3, 1.5] }, blobs: [[2, 44, 7, 5, 14], [52, 44, 7, 5, 14]], clear: [[27, 22, 22, 16, 22]], noise: 0.6 });
      b.edgeClumps(6, ["big-oak", "tree", "round-bush"]);
      b.tallGrass(3, [4, 7]);
      b.threes(348, 6);
    },
  },
  {
    id: "town-elf-lake", name: "달빛호수 엘프 마을", category: "special", tilesetId: F, width: 56, height: 44, seed: 19301,
    purpose: "숲속 호수 기슭의 엘프 마을. 호수 섬의 석상 성소와 널빤지 다리, 물가 엘프 집과 선착장",
    note: "숲에 둘러싸인 맑은 호수 한가운데 작은 섬에 돌 석상과 마법진의 성소가 있고, 널빤지 다리가 북쪽 기슭에서 섬으로 건너간다. 기슭을 따라 이끼 지붕 엘프 집과 선착장. 서쪽 숲길로 들어온다",
    build(b) {
      b.pond(30, 28, 13, 7, 0.12);
      for (const i of b.ellipseCells(30, 29, 3.2, 2.2, 0.1)) b.water.delete(i);
      b.smoothWater(); b.paintWater();
      b.exits([{ side: "west", at: 17, meets: "엘프 숲길(필드) 동쪽 출구" }]);
      const pl = b.planks(30, 18, "south");
      b.spine([["exit:0", [8, 17], [50, 17]], [[30, 17], pl.from]]);
      b.rowAbove(17, 4, 52, [["gable-steep", "moss-plaster", "엘프 장로 집", "garden", "right"], ["gable-house", "moss-plaster", "엘프 집", "herbs", "right"], ["gable-porch", "thatch-plaster", "엘프 여관", "tavern", "right"], ["gable-house", "moss-plaster", "엘프 집", "bees", "right"], ["gable-long-low", "moss-plaster", "뱃사공 집", "fishing", "right"]], { gap: 3 });
      b.connect(); b.paintRoads();
      b.put("돌 석상", 30, 28, { purpose: "호수 성소 석상", owner: "섬 성소", check: false });
      b.props([["마법진", 29, 30, "섬 성소 마법진", "섬 성소"], ["돌등", 28, 29, "섬 성소 등불", "섬 성소"], ["돌등", 32, 29, "섬 성소 등불", "섬 성소"]]);
      b.pier(21, 20, "south", 6);
      b.props([["낚시 바구니", 20, 20, "낚시 자리", "선착장"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1.5], west: [2, 1], east: [3, 1.5], south: [3, 1.5] }, blobs: [[2, 42, 6, 4, 12], [54, 42, 6, 4, 12]], noise: 0.6 });
      b.edgeClumps(5, ["big-oak", "tree", "round-bush"]);
      b.threes(348, 5);
    },
    extraTargets: [[30, 30]],
  },
  {
    id: "town-hot-spring", name: "김서림 온천 마을", category: "special", tilesetId: F, width: 52, height: 42, seed: 19401,
    purpose: "바위틈 온천 둘에 김이 피어오르는 온천 마을. 온천 여관 둘, 발 담그는 돌 마당, 목욕 용품 가게",
    note: "마을 북쪽 바위 절벽 발치에 뜨거운 온천 못 둘이 김을 뿜는다. 못가엔 돌 마당과 벤치, 큰 온천 여관 둘과 목욕 용품 가게가 서고 여관 앞엔 수건 말리는 빨랫줄. 남쪽 길로 들어와 동쪽 산길로 나간다",
    build(b) {
      b.cliffs([{ points: [[0, 8], [51, 8]], height: 4, left: "open", right: "open" }]);
      b.pond(15, 17, 6, 3, 0.15); b.pond(36, 17, 5, 2.8, 0.15); b.smoothWater(); b.paintWater();
      b.exits([{ side: "south", at: 26, meets: "온천 길(필드) 북쪽 출구" }, { side: "east", at: 26, meets: "동쪽 산길(필드) 서쪽 출구" }]);
      b.pave(b.rectCells(22, 20, 9, 4), "cobble", { name: "발 담그는 돌 마당" });
      b.spine([["exit:0", [26, 28]], [[4, 26], "exit:1"], [[26, 26], [26, 23]]]);
      b.rowAbove(38, 3, 48, [["gable-hall", "timber-hall", "온천 여관", "tavern", "right"], ["gable-twin-step", "bright-plaster", "목욕 용품 가게", "shop", "right"], ["gable-cross", "amber-wood", "온천 여관", "laundry", "right"]], { gap: 3 });
      b.spine([[[3, 38], [48, 38]], [[26, 28], [26, 38]]]);
      b.connect(); b.paintRoads(); b.plazaUnroad();
      // steam over the hot pools: a wisp on every other cell of a loose lattice, so the whole surface smokes
      for (const i of b.water) { const [x, y] = b.xy(i); if ((x + 2 * y) % 3 === 0) b.overlay(["온천 김 1", "온천 김 2"][(x + y) % 2], x, y, { owner: "온천 못" }); }
      b.props([["빨랫줄", 12, 27, "수건 말리기", "온천 여관"], ["나무통", 21, 19, "물 뜨는 통", "발 담그는 돌 마당"], ["항아리", 31, 19, "온천 소금 항아리", "발 담그는 돌 마당"], ["돌등", 9, 21, "못가 등불", "온천 못"], ["돌등", 42, 21, "못가 등불", "온천 못"], ["벤치", 23, 20, "발 담그는 자리", "발 담그는 돌 마당"], ["벤치", 28, 20, "발 담그는 자리", "발 담그는 돌 마당"], ["화분", 22, 22, "돌 마당 화분", "발 담그는 돌 마당"]]);
      b.yards();
      b.forest({ bands: { south: [1, 1], west: [2, 1], east: [1, 1] }, blobs: [[48, 3, 4, 3, 8]], noise: 0.6 });
      b.edgeClumps(4);
      b.threes(537, 5);
    },
  },
  {
    id: "town-snow-hotspring", name: "눈꽃 온천 산골", category: "special", tilesetId: SNOW, width: 50, height: 42, seed: 19501,
    purpose: "눈 덮인 산골의 얼지 않는 온천 마을. 눈 속에 얼지 않은 노천탕, 설원 여관, 장작 쌓인 오두막",
    note: "눈 덮인 침엽수림 속, 얼지 않는 노천 온천 못을 설원 여관과 오두막들이 둘러싼다. 못가엔 돌등과 벤치, 여관 앞엔 겨울 장작이 쌓였다. 남쪽 눈길로 들어온다",
    build(b) {
      b.pond(24, 15, 7, 3.6, 0.15); b.smoothWater(); b.paintWater();
      b.exits([{ side: "south", at: 25, meets: "눈길(필드) 북쪽 출구" }]);
      b.spine([["exit:0", [25, 30]], [[4, 26], [46, 26]], [[25, 26], [25, 20]]]);
      b.rowAbove(26, 3, 47, [["gable-long", "slate-wood", "설원 여관", "tavern", "right"], ["gable-house", "amber-wood", "오두막", "woodwork", "right"], ["gable-house", "slate-wood", "오두막", "laundry", "right"], ["gable-long-low", "blue-stone", "목욕 용품 가게", "shop", "right"]], { gap: 3 });
      b.homes([["gable-steep", "slate-wood", 5, 31, "온천지기 집", "storage", "right"], ["gable-house", "timber-hall", 38, 31, "오두막", "woodwork", "left"]], 4);
      b.connect(); b.paintRoads();
      b.props([["돌등", 16, 13, "못가 등불", "노천탕"], ["돌등", 33, 13, "못가 등불", "노천탕"], ["벤치", 22, 19, "못가 벤치", "노천탕"], ["장작 더미", 14, 18, "탕 데우는 장작", "노천탕"]]);
      b.yards();
      b.forest({ bands: { north: [3, 1.5], west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[2, 40, 5, 3, 10], [48, 40, 5, 3, 10]], noise: 0.6 });
      b.edgeClumps(4, ["tree", "small-bush"]);
    },
  },
  {
    id: "town-pilgrim", name: "순례자 언덕 성지 마을", category: "special", tilesetId: F, width: 50, height: 48, seed: 19601, plaza: [["cobble", ["돌등", "벤치", "화분"]]],
    purpose: "언덕 위 교회를 찾는 순례자의 성지 마을. 참배길 돌등 줄, 순례자 숙소 둘, 묘지, 기념품 가게",
    note: "남쪽 순례길이 돌등 줄을 따라 언덕 윗단 돌벽 교회까지 곧게 오른다. 아랫단엔 순례자 숙소 둘과 기념품 가게·빵집이 광장을 두르고, 윗단 교회 옆엔 순례자 묘지. 남쪽 길로 들어온다",
    build(b) {
      b.cliffs([{ points: [[0, 22], [49, 22]], height: 5, left: "open", right: "open" }]);
      b.stairs([[24, 22, 5]]);
      b.landmark("church", 21, 5); b.landmark("graveyard", 34, 8);
      b.exits([{ side: "south", at: 25, meets: "순례길(필드) 북쪽 출구" }]);
      b.pave(b.ellipseCells(25, 36, 6, 3, 0.05), "cobble", { name: "순례자 광장" });
      b.spine([["exit:0", [25, 40]], [[25, 33], "stairs-bottom:0"], ["stairs-top:0", [25, 18]], [[10, 18], [40, 18]]]);
      b.homes([["gable-hall", "slate-brick", 5, 28, "순례자 숙소", "tavern", "right"], ["gable-long", "amber-wood", 37, 28, "순례자 숙소", "laundry", "left"], ["gable-twin", "bright-plaster", 5, 39, "기념품 가게", "shop", "right"], ["gable-long-low", "amber-brick", 37, 39, "빵집", "shop", "left"], ["gable-house", "slate-brick", 6, 9, "사제관", "garden", "right"]], 4);
      b.connect(); b.paintRoads(); b.plazaUnroad();
      for (const y of [29, 31]) b.props([["돌등", 22, y, "참배길 등불", "참배길"], ["돌등", 28, y, "참배길 등불", "참배길"]]);
      b.props([["돌 석상", 18, 18, "순례자 석상", "참배길"], ["돌 석상", 31, 18, "순례자 석상", "참배길"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[2, 46, 5, 3, 10], [48, 46, 5, 3, 10]], noise: 0.6 });
      b.edgeClumps(3);
      b.tallGrass(3, [4, 7]);
      b.threes(348, 5);
    },
  },
  {
    id: "town-monastery", name: "고요한 종 수도원 마을", category: "special", tilesetId: F, width: 56, height: 52, seed: 19701,
    purpose: "돌 성벽으로 두른 수도원과 그 밖의 작은 마을. 성벽 안 교회·수도사 숙소·약초밭, 성문 밖 순례자 여관",
    note: "돌 성벽이 두른 수도원 안뜰에 돌벽 교회와 수도사 숙소·도서관이 있고 약초밭과 우물이 가꿔져 있다. 남쪽 성문 밖엔 순례자 여관과 대장간, 농가가 작은 마을을 이룬다. 남쪽 길로 들어온다",
    build(b) {
      const ring = b.wallRing(8, 2, 40, 34, { name: "수도원 성벽" });
      b.exits([{ side: "south", at: ring.gx, meets: "수도원 길(필드) 북쪽 출구" }]);
      b.landmark("church", ring.gx - 3, 9);
      b.put("낮은 돌 우물", ring.gx + 6, 22, { purpose: "안뜰 우물" });
      b.spine([["exit:0", [ring.gx, 42], [ring.gx, 26]], [[16, 25], [40, 25]], [[4, 42], [52, 42]]]);
      b.homes([["gable-long", "slate-brick", 15, 10, "수도사 숙소", "herbs", "right"], ["gable-2f-narrow", "blue-stone", 36, 10, "도서관", "garden", "left"]], 3);
      b.rowAbove(42, 3, 53, [["gable-cross-l", "amber-wood", "순례자 여관", "tavern", "right"], ["gable-long-low", "amber-brick", "대장간", "smith", "right"], ["gable-house", "thatch-plaster", "농가", "farm", "right"]], { gap: 3 });
      b.connect(); b.paintRoads();
      b.crops(16, 19, 7, 4, { owner: "수도원 약초밭", scarecrow: false }); b.crops(34, 19, 6, 4, { owner: "수도원 채소밭", scarecrow: false });
      b.props([["벤치", ring.gx + 3, 23, "안뜰 벤치", "안뜰"]]);
      b.yards();
      b.forest({ bands: { south: [2, 1], west: [2, 1], east: [2, 1] }, blobs: [[2, 50, 5, 3, 10], [54, 50, 5, 3, 10]], noise: 0.6 });
      b.edgeClumps(4);
      b.threes(348, 5);
    },
  },
  {
    id: "town-nomad-steppe", name: "바람갈기 초원 유목 부락", category: "special", tilesetId: AUT, width: 50, height: 40, seed: 19801,
    purpose: "금빛 초원의 유목 부락. 천막 여덟이 두 모닥불을 두르고, 말 우리와 가죽 말리는 줄, 깃발 꽂힌 족장 천막",
    note: "끝없는 금빛 초원 위에 천막 여덟이 두 모닥불을 둥글게 두른다. 가운데 깃발 꽂힌 족장 천막, 서쪽엔 울타리 친 말 우리, 천막 사이 가죽 말리는 빨랫줄과 젖 항아리. 서쪽과 동쪽 초원 길로 나간다",
    fill: { flowerCap: 20 },
    build(b) {
      b.exits([{ side: "west", at: 20, meets: "초원 필드 동쪽 출구" }, { side: "east", at: 20, meets: "초원 필드 서쪽 출구" }]);
      b.fenceRing(3, 5, 10, 8, 4, 2, "말 우리");
      b.spine([["exit:0", [16, 20], [34, 20], "exit:1"], [[5, 20], [5, 13], "yard-gate:0"]]);
      b.paintRoads();
      camp(b, "동쪽 천막 둘레", [36, 14], [[32, 8], [38, 8], [42, 13]], "천막");
      camp(b, "서쪽 천막 둘레", [22, 27], [[16, 24], [26, 24], [18, 30], [26, 31]], "천막");
      b.props([["천막", 22, 10, "족장 천막", "족장 터"], ["성 깃발", 26, 10, "족장 깃발", "족장 터"], ["빨랫줄", 30, 24, "가죽 말리기", "서쪽 천막 둘레"], ["항아리", 20, 16, "젖 항아리", "족장 터"], ["나무통", 7, 10, "말 구유", "말 우리"], ["씨앗 자루", 10, 7, "여물 자루", "말 우리"], ["장작 더미", 40, 17, "천막 장작", "동쪽 천막 둘레"]]);
      b.forest({ bands: { north: [1, 1], south: [1, 1] }, blobs: [[48, 38, 4, 3, 8], [2, 38, 4, 3, 8]], noise: 0.6 });
      b.edgeClumps(2, ["small-bush", "round-bush"]);
      b.threes(348, 6);
    },
  },
  {
    id: "town-nomad-desert", name: "모래바람 사막 유목 천막촌", category: "special", tilesetId: SAND, width: 50, height: 40, seed: 19901,
    fill: { flowerCap: 0, spotCap: 4, palette: { stands: 2.6 } },
    purpose: "작은 샘가에 친 사막 유목민의 천막촌. 흰 천막 일곱, 낙타 우리, 모닥불, 물 항아리",
    note: "사구 사이 작은 샘가에 흰 천막 일곱이 모여 있다. 샘가엔 물 항아리, 가운데 모닥불과 짐 상자, 동쪽엔 울타리 친 낙타 우리. 서쪽 모래길로 들어와 동쪽 대상로로 나간다",
    build(b) {
      b.pond(14, 12, 4, 2.4, 0.15); b.smoothWater(); b.paintWater();
      b.exits([{ side: "west", at: 24, meets: "모래길(필드) 동쪽 출구" }, { side: "east", at: 24, meets: "대상로(필드) 서쪽 출구" }]);
      b.fenceRing(36, 6, 10, 8, 4, 2, "낙타 우리");
      b.spine([["exit:0", [20, 24], [30, 24], "exit:1"], [[38, 24], [38, 14], "yard-gate:0"], [[14, 24], [14, 16]]]);
      b.paintRoads();
      camp(b, "천막촌", [24, 18], [[18, 14], [26, 12], [30, 17], [18, 27], [27, 28]], "천막");
      b.props([["천막", 8, 27, "나그네 천막", "천막촌"], ["천막", 34, 28, "나그네 천막", "천막촌"], ["항아리", 10, 15, "샘물 항아리", "샘"], ["항아리", 18, 11, "샘물 항아리", "샘"], ["나무 상자", 22, 21, "짐 상자", "천막촌"], ["나무통", 40, 9, "낙타 물통", "낙타 우리"]]);
      b.singlesWhere(770, 6, (x, y) => b.nearWater(x, y, 2) && !b.water.has(b.at(x, y)), 2, { shore: true });
    },
  },
  {
    id: "town-goblin-camp", name: "썩은이빨 고블린 소굴 마을", category: "special", tilesetId: F, theme: "swamp", width: 50, height: 42, seed: 20001,
    purpose: "숲 늪가에 친 고블린 부락. 검은 가죽 천막, 토템 기둥과 해골 창, 부서진 울타리, 빼앗은 짐 더미",
    note: "짙은 숲 늪가에 고블린의 검은 가죽 천막이 어지럽게 모여 있다. 토템 기둥과 해골 창이 부락 입구를 지키고, 부서진 울타리 안에 빼앗은 짐 상자와 술통이 쌓였다. 가운데 큰 모닥불. 서쪽 숲길로 들어온다",
    build(b) {
      b.pond(38, 30, 7, 4, 0.2); b.smoothWater(); b.paintWater();
      b.exits([{ side: "west", at: 21, meets: "짙은 숲길(필드) 동쪽 출구" }]);
      b.spine([["exit:0", [12, 21], [30, 21]]]);
      b.paintRoads();
      camp(b, "고블린 부락", [22, 18], [[14, 12], [22, 10], [30, 13], [15, 24], [26, 24]], "검은 가죽 천막");
      b.props([["토템 기둥", 9, 18, "부락 입구 토템", "부락 입구"], ["토템 기둥", 9, 23, "부락 입구 토템", "부락 입구"], ["해골 창", 11, 18, "부락 입구 해골 창", "부락 입구"], ["해골 창", 11, 23, "부락 입구 해골 창", "부락 입구"],
        ["나무 상자", 33, 19, "빼앗은 짐", "약탈품 더미"], ["술통", 34, 19, "빼앗은 술통", "약탈품 더미"], ["부두 상자", 35, 20, "빼앗은 짐", "약탈품 더미"], ["해골", 36, 18, "먹고 버린 뼈", "약탈품 더미"],
        ["부서진 울타리", 32, 17, "부서진 울타리", "약탈품 더미"], ["부서진 울타리", 33, 17, "부서진 울타리", "약탈품 더미"], ["부서진 울타리", 37, 17, "부서진 울타리", "약탈품 더미"], ["전투 깃발", 19, 8, "고블린 깃발", "고블린 부락"], ["해골", 20, 21, "모닥불 곁 뼈", "고블린 부락"]]);
      b.forest({ bands: { north: [3, 1.5], south: [3, 1.5], east: [3, 1.5], west: [2, 1] }, blobs: [[2, 2, 6, 5, 12], [2, 40, 6, 5, 12], [48, 2, 6, 5, 12]], clear: [[22, 18, 16, 12, 16]], noise: 0.7 });
      b.edgeClumps(5, ["dark-tree", "dark-bush", "tree"]);
      b.threes(348, 4);
    },
  },
  {
    id: "town-orc-warcamp", fill: { palette: { trees: 1.5, stands: 2, bushes: 3, flowers: 1.5, rocks: 1.2 }, flowerCap: 60 }, name: "잿빛송곳니 오크 전쟁 부락", category: "special", tilesetId: F, theme: "battlefield", width: 44, height: 34, seed: 20101,
    purpose: "마른 숲 속 오크 전쟁 부락. 검은 가죽 천막 열, 통나무 방책과 해골 창, 무기 거치대 연병장, 족장 천막",
    note: "말라 죽은 숲을 베어 낸 빈터에 오크의 검은 가죽 천막 열이 모닥불 넷을 두르고, 가운데 연병장엔 무기 거치대와 베기 과녁. 북쪽엔 족장의 붉은 천막과 토템·전투 깃발, 남쪽은 통나무 방책과 해골 창이 막고 가운데 문으로만 드나든다",
    build(b) {
      b.exits([{ side: "south", at: 22, meets: "메마른 들길(필드) 북쪽 출구" }]);
      b.spine([["exit:0", [22, 22], [22, 10]], [[8, 18], [36, 18]]]);
      b.paintRoads();
      camp(b, "서쪽 천막 둘레", [11, 13], [[5, 8], [12, 7], [5, 14]], "검은 가죽 천막");
      camp(b, "동쪽 천막 둘레", [33, 13], [[29, 7], [36, 8], [37, 14]], "검은 가죽 천막");
      camp(b, "남서쪽 천막 둘레", [14, 25], [[8, 22], [17, 22]], "검은 가죽 천막");
      camp(b, "남동쪽 천막 둘레", [30, 25], [[25, 22], [33, 22]], "검은 가죽 천막");
      b.props([["붉은 축제 천막", 20, 4, "족장 천막", "족장 터"], ["토템 기둥", 18, 5, "족장 토템", "족장 터"], ["토템 기둥", 24, 5, "족장 토템", "족장 터"], ["전투 깃발", 18, 8, "족장 깃발", "족장 터"], ["전투 깃발", 25, 8, "족장 깃발", "족장 터"],
        ["무기 거치대", 15, 16, "연병장 무기", "연병장"], ["무기 거치대", 17, 16, "연병장 무기", "연병장"], ["허수아비", 26, 15, "베기 과녁", "연병장"], ["허수아비", 28, 16, "베기 과녁", "연병장"], ["무기 거치대", 30, 16, "연병장 무기", "연병장"],
        ["나무 상자", 8, 20, "약탈품", "서쪽 천막 둘레"], ["술통", 9, 20, "약탈품", "서쪽 천막 둘레"], ["해골", 35, 20, "먹고 버린 뼈", "동쪽 천막 둘레"], ["장작 더미", 34, 20, "모닥불 장작", "동쪽 천막 둘레"]]);
      // the log palisade across the south with the gate on the road, skull pikes before it
      for (let x = 3; x < 41; x += 2) if (x < 20 || x > 24) b.props([["나무 울타리", x, 28, "통나무 방책", "부락 방책"]]);
      for (const x of [5, 10, 15, 28, 33, 38]) b.props([["해골 창", x, 29, "방책 앞 해골 창", "부락 방책"]]);
      // stumps and dead trees the orcs left standing between the tents, bones and dug-up stones
      for (const [x, y] of [[5, 6], [7, 11], [12, 11], [19, 11], [27, 10], [36, 11], [10, 20], [18, 20], [30, 20], [12, 26], [32, 26], [4, 26], [38, 26], [26, 12]]) b.props([[(x + y) % 3 ? "마른나무" : "마른 묘목", x, y, "베다 남긴 마른 나무", "마른 숲"]]);
      for (const [x, y] of [[20, 13], [9, 17], [34, 17], [16, 27], [28, 27], [6, 27]]) b.props([[(x + y) % 2 ? "해골" : "돌 무더기", x, y, "부락 잡동사니", "부락 방책"]]);
      b.forest({ bands: { north: [2, 1.5], west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[2, 2, 4, 3, 8], [42, 2, 4, 3, 8]], noise: 0.7 });
      b.edgeClumps(3, ["small-bush", "round-bush"]);
      b.threes(537, 8);
      b.tallGrass(10, [5, 10]);
      b.threes(348, 6);
    },
  },
  {
    id: "town-abandoned", name: "잊힌 들 버려진 마을", category: "special", tilesetId: F, theme: "ruins", width: 52, height: 42, seed: 20201,
    purpose: "사람이 떠난 지 오래된 폐촌. 지붕 무너진 집들, 잡초 덮인 길, 마른 우물, 쓰러진 울타리와 잊힌 묘지",
    note: "오래전 사람이 떠난 마을. 집 여섯 가운데 넷은 지붕이 무너져 돌무더기와 들보만 남았고, 길은 잡초에 덮였다. 가운데 마른 우물 둘레엔 부서진 울타리, 북쪽 언덕 밑엔 잊힌 묘지. 서쪽 길로 들어와 동쪽 숲으로 나간다",
    build(b) {
      b.landmark("graveyard-small", 40, 3);
      b.exits([{ side: "west", at: 22, meets: "잡초 길(필드) 동쪽 출구" }, { side: "east", at: 22, meets: "동쪽 숲(필드) 서쪽 출구" }]);
      b.put("낮은 돌 우물", 25, 24, { purpose: "마른 우물" });
      b.spine([["exit:0", [20, 22]], [[31, 22], "exit:1"]]);
      const H = b.homes([["gable-house", "thatch-plaster", 6, 5, "버려진 촌장 집", null, null], ["gable-long", "thatch-log", 18, 5, "무너진 여관", null, null], ["gable-steep", "moss-plaster", 30, 12, "버려진 집", null, null],
        ["gable-long-low", "charcoal-timber", 6, 27, "무너진 대장간", null, null], ["gable-house", "thatch-log", 22, 30, "무너진 집", null, null], ["gable-twin", "bright-plaster", 38, 28, "버려진 가게", null, null]], 4);
      b.connect(); b.paintRoads();
      for (const h of [H[1], H[3], H[4], H[5]]) b.ruin(h);
      b.props([["부서진 울타리", 22, 23, "우물 둘레 울타리", "마른 우물"], ["부서진 울타리", 28, 23, "우물 둘레 울타리", "마른 우물"], ["부서진 울타리", 23, 26, "우물 둘레 울타리", "마른 우물"], ["마른 묘목", 15, 18, "말라 죽은 나무", "마을 길"], ["마른 묘목", 34, 20, "말라 죽은 나무", "마을 길"], ["해골", 16, 25, "짐승 뼈", "마을 길"]]);
      b.forest({ bands: { north: [2, 1.5], south: [2, 1.5], east: [2, 1] }, blobs: [[2, 40, 5, 3, 10], [50, 40, 5, 3, 10]], noise: 0.7 });
      b.edgeClumps(5, ["tree", "round-bush", "small-bush"]);
      b.tallGrass(8, [6, 12]);
      b.threes(537, 6);
    },
  },
  {
    id: "town-abandoned-snow", name: "눈에 묻힌 버려진 산골", category: "special", tilesetId: SNOW, width: 48, height: 40, seed: 20301,
    purpose: "눈보라에 버려진 산골 마을. 지붕 무너진 오두막과 눈에 묻힌 길, 얼어붙은 연못, 무너진 망루",
    note: "혹독한 겨울에 버려진 산골. 오두막과 헛간 다섯 가운데 둘은 지붕이 무너져 눈과 들보가 쌓였고, 얼어붙은 연못 둘과 쓰러진 울타리, 해골과 마른 묘목이 남았다. 남쪽 눈길로 들어온다",
    build(b) {
      b.pond(34, 26, 6, 3, 0.15); b.pond(14, 27, 5, 2.6, 0.15); b.smoothWater(); b.paintWater(); b.freeze();
      b.exits([{ side: "south", at: 20, meets: "눈길(필드) 북쪽 출구" }]);
      b.spine([["exit:0", [20, 30], [20, 20]], [[6, 20], [40, 20]]]);
      const H = b.homes([["gable-house", "slate-wood", 5, 8, "버려진 오두막", null, null], ["gable-long", "amber-wood", 17, 7, "무너진 여관", null, null], ["gable-steep", "slate-wood", 31, 7, "버려진 오두막", null, null],
        ["gable-long-low", "timber-hall", 5, 25, "무너진 헛간", null, null], ["gable-house", "blue-stone", 40, 11, "버려진 오두막", null, null], ["gable-long-low", "slate-wood", 22, 24, "버려진 창고", null, null]], 4);
      b.connect(); b.paintRoads();
      for (const h of [H[1], H[3]]) b.ruin(h, { share: 0.85 });
      b.props([["부서진 울타리", 26, 23, "쓰러진 울타리", "마을 길"], ["부서진 울타리", 27, 24, "쓰러진 울타리", "마을 길"], ["해골", 24, 29, "얼어 죽은 짐승 뼈", "마을 길"], ["마른 묘목", 14, 29, "얼어 죽은 나무", "마을 길"], ["부서진 울타리", 7, 18, "쓰러진 울타리", "마을 길"], ["부서진 울타리", 9, 18, "쓰러진 울타리", "마을 길"], ["부서진 울타리", 12, 17, "쓰러진 울타리", "마을 길"], ["돌 무더기", 15, 18, "무너진 굴뚝 돌", "마을 길"], ["장작 더미", 10, 23, "눈 덮인 장작", "무너진 헛간"], ["나무 상자", 16, 23, "버려진 상자", "무너진 헛간"], ["해골", 13, 24, "얼어 죽은 짐승 뼈", "마을 길"], ["마른 묘목", 18, 26, "얼어 죽은 나무", "마을 길"]]);
      b.forest({ bands: { north: [2, 1.5], west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[2, 38, 5, 3, 10], [46, 38, 5, 3, 10]], noise: 0.7 });
      b.edgeClumps(4, ["tree", "small-bush"]);
      // young pines and brush already taking the empty yards back
      b.scatterTrees(6, ["tree", "small-bush"], [3, 14, 20, 16]); b.scatterTrees(5, ["small-bush", "tree"], [28, 2, 18, 16]);
      b.props([["부서진 울타리", 30, 16, "쓰러진 울타리", "마을 길"], ["부서진 울타리", 32, 16, "쓰러진 울타리", "마을 길"], ["돌 무더기", 34, 14, "무너진 굴뚝 돌", "무너진 오두막"], ["장작 더미", 38, 16, "눈 덮인 장작", "무너진 오두막"], ["해골", 36, 18, "얼어 죽은 짐승 뼈", "마을 길"], ["부서진 울타리", 10, 17, "쓰러진 울타리", "마을 길"], ["부서진 울타리", 11, 18, "쓰러진 울타리", "마을 길"], ["돌 무더기", 14, 17, "무너진 담 돌", "마을 길"], ["마른 묘목", 17, 18, "얼어 죽은 나무", "마을 길"], ["해골", 9, 23, "얼어 죽은 짐승 뼈", "마을 길"], ["돌 무더기", 17, 23, "무너진 담 돌", "마을 길"], ["나무 상자", 6, 17, "버려진 상자", "버려진 오두막"]]);
      // the old fence along the village road, fallen in stretches
      for (const x of [7, 8, 10, 13, 14, 16, 24, 25, 28, 30, 31, 34, 37, 38]) b.props([["부서진 울타리", x, 22, "길가 옛 울타리", "마을 길"]]);
      for (const x of [10, 11, 14, 17, 23, 26, 27, 30, 36, 39]) b.props([["부서진 울타리", x, 19, "길가 옛 울타리", "마을 길"]]);
    },
  },
  {
    id: "town-festival-day", name: "풍등골 축제 마을 (낮)", category: "special", tilesetId: F, width: 56, height: 40, seed: 20401, plaza: [["cobble", ["벤치", "화분", "과일 좌판"]]], plazaSq: 3,
    purpose: "마을 축제가 열린 날의 광장. 무대와 분수, 줄무늬 노점과 먹거리 천막, 광장을 가로지르는 깃발 줄",
    note: "마을 한가운데 큰 돌 광장에 축제 무대가 서고 분수 둘레로 줄무늬 노점과 붉은 먹거리 천막이 늘어선다. 광장 위로 축제 깃발 줄 두 가닥이 걸리고 무대 곁엔 등롱 기둥. 같은 마을의 밤 축제 맵(town-festival-night)이 짝이다. 남쪽과 서쪽 길로 나간다",
    build(b) { festivalTown(b, false); },
  },
  {
    id: "town-festival-night", name: "풍등골 축제 마을 (밤)", category: "special", tilesetId: F, width: 56, height: 40, seed: 20401, plaza: [["cobble", ["벤치", "화분", "과일 좌판"]]], plazaSq: 3,
    purpose: "같은 축제 마을의 밤. 깃발 줄 대신 등롱 줄이 불을 밝히고 광장 모닥불과 등롱 기둥이 어둠을 비춘다",
    note: "낮 축제(town-festival-day)와 같은 광장. 밤이 되자 깃발 줄이 등롱 줄로 바뀌어 불을 밝히고, 무대 곁 등롱 기둥과 광장 돌등, 새로 피운 모닥불이 어두운 마을을 비춘다(맵 조명 포함)",
    build(b) { festivalTown(b, true); },
  },
  {
    id: "town-witch-hamlet", name: "안개늪 마녀 부락", category: "special", tilesetId: F, theme: "swamp", width: 48, height: 40, seed: 20601,
    purpose: "안개 낀 늪 한가운데 마녀와 약초꾼의 부락. 늪 위 널빤지 길, 약초 말리는 집, 마법진과 해골 장식",
    note: "검푸른 늪 웅덩이 사이로 널빤지 길이 이어지고 그 끝 섬 같은 땅에 마녀의 뾰족 지붕 집과 약초꾼 오두막이 모여 있다. 집마다 약초 화분과 항아리, 마당엔 마법진과 해골. 서쪽 늪길로 들어온다",
    build(b) {
      b.pond(14, 12, 6, 3.5, 0.25); b.pond(34, 28, 7, 4, 0.25); b.pond(13, 31, 5, 3, 0.25); b.smoothWater(); b.paintWater();
      b.exits([{ side: "west", at: 21, meets: "늪길(필드) 동쪽 출구" }]);
      b.spine([["exit:0", [36, 21], [36, 12]]]);
      b.homes([["gable-steep", "charcoal-timber", 28, 3, "마녀의 집", "herbs", "right"], ["gable-house", "moss-plaster", 38, 5, "약초꾼 오두막", "herbs", "left"], ["gable-long-low", "thatch-log", 22, 24, "약초 말리는 집", "herbs", "right"]], 4);
      b.connect(); b.paintRoads();
      b.props([["마법진", 33, 14, "마녀 마당 마법진", "마녀의 집"], ["해골", 31, 14, "마녀 마당 해골", "마녀의 집"], ["항아리", 35, 15, "약초 항아리", "마녀의 집"], ["토템 기둥", 30, 16, "뼈 장식 기둥", "마녀의 집"], ["약초 화분", 26, 17, "약초 화분", "약초꾼 오두막"]]);
      b.forest({ bands: { north: [2, 1.5], south: [2, 1.5], east: [2, 1] }, blobs: [[2, 2, 4, 3, 8], [46, 38, 5, 3, 10]], noise: 0.7 });
      b.edgeClumps(5, ["dark-tree", "dark-bush", "round-bush"]);
      b.tallGrass(5, [5, 9]);
    },
  },
  {
    id: "town-knight-camp", name: "은방패 기사단 주둔 마을", category: "special", tilesetId: F, width: 54, height: 44, seed: 20701,
    purpose: "변경을 지키는 기사단 주둔지와 마을. 줄지은 천막, 연병장의 과녁과 무기 거치대, 기사단 회관과 마구간",
    note: "마을 북쪽에 기사단 회관과 마구간이 서고, 가운데 흙 연병장엔 허수아비 과녁과 무기 거치대가 줄지었다. 동쪽엔 병사 천막 여섯이 두 줄로 서고 전투 깃발이 나부낀다. 남쪽엔 병사들을 상대하는 주점과 대장간. 서쪽 길로 들어와 동쪽 변경길로 나간다",
    build(b) {
      b.exits([{ side: "west", at: 24, meets: "서쪽 가도(필드) 동쪽 출구" }, { side: "east", at: 24, meets: "변경길(필드) 서쪽 출구" }]);
      b.pave(b.rectCells(12, 12, 16, 8), "dirt", { name: "연병장" });
      b.spine([["exit:0", [51, 24], "exit:1"], [[20, 24], [20, 20]]]);
      b.rowAbove(12, 30, 52, [["gable-hall", "slate-brick", "기사단 회관", "guard", "right"], ["gable-barn", "timber-hall", "마구간", "storage", "left"]], { gap: 2 });
      b.spine([[[30, 12], [52, 12]], [[40, 12], [40, 24]]]);
      b.rowAbove(36, 3, 52, [["gable-cross", "amber-wood", "병사 주점", "tavern", "right"], ["gable-long-low", "amber-brick", "대장간", "smith", "right"], ["gable-house", "thatch-plaster", "마을 집", "laundry", "right"], ["gable-2f-narrow", "slate-brick", "병참 창고", "storage", "right"]], { gap: 3 });
      b.spine([[[3, 36], [52, 36]], [[26, 24], [26, 36]]]);
      b.connect(); b.paintRoads();
      for (const [x, y] of [[31, 15], [36, 15], [41, 15]]) b.props([["천막", x, y + 1, "병사 천막", "병사 천막 줄"]]);
      b.props([["허수아비", 14, 13, "베기 과녁", "연병장"], ["허수아비", 17, 13, "베기 과녁", "연병장"], ["허수아비", 20, 13, "베기 과녁", "연병장"], ["무기 거치대", 23, 13, "연병장 무기", "연병장"], ["무기 거치대", 25, 13, "연병장 무기", "연병장"],
        ["전투 깃발", 13, 17, "기사단 깃발", "연병장"], ["전투 깃발", 26, 17, "기사단 깃발", "연병장"], ["성 깃발", 46, 15, "기사단 깃발", "병사 천막 줄"], ["나무 상자", 47, 20, "병참 상자", "병사 천막 줄"], ["술통", 48, 20, "병참 술통", "병사 천막 줄"]]);
      b.yards();
      b.forest({ bands: { north: [1, 1], south: [2, 1] }, blobs: [[2, 2, 5, 4, 10], [2, 42, 5, 3, 10], [52, 42, 4, 3, 8]], noise: 0.5 });
      b.edgeClumps(3);
      b.tallGrass(3, [4, 8]);
      b.threes(348, 4);
    },
  },
  {
    id: "town-academy", name: "별빛탑 마법 학원 마을", category: "special", tilesetId: F, width: 56, height: 48, seed: 20801,
    purpose: "마법 학원 원탑을 중심으로 한 학원 마을. 원탑과 학원 강당, 마법진 광장, 기숙사와 책방·약초 가게",
    note: "마을 북쪽에 학원의 원탑 둘과 큰 강당이 서고, 그 앞 돌 광장 한가운데 커다란 마법진이 새겨져 있다. 광장 둘레엔 학생 기숙사 둘과 책방·약초 가게·마법 도구점, 남쪽엔 학생들이 드나드는 주점. 남쪽 길로 들어온다",
    build(b) {
      b.exits([{ side: "south", at: 28, meets: "학원 가도(필드) 북쪽 출구" }]);
      b.tower(14, 2, "학원 서쪽 원탑"); b.tower(40, 2, "학원 동쪽 원탑");
      b.pave(b.rectCells(20, 16, 16, 8), "cobble", { name: "마법진 광장" });
      b.put("마법진", 27, 19, { purpose: "광장 큰 마법진" }); b.put("마법진", 28, 19, { purpose: "광장 큰 마법진" }); b.put("마법진", 27, 20, { purpose: "광장 큰 마법진" }); b.put("마법진", 28, 20, { purpose: "광장 큰 마법진" });
      b.spine([["exit:0", [28, 24]], [[4, 28], [52, 28]], [[28, 24], [28, 28]]]);
      b.homes([["gable-hall", "slate-brick", 24, 5, "학원 강당", "garden", "right"]], 3);
      b.rowAbove(28, 3, 20, [["gable-2f-long", "blue-stone", "학생 기숙사", "laundry", "right"], ["gable-twin-step", "bright-plaster", "책방", "shop", "right"]], { gap: 2 });
      b.rowAbove(28, 37, 53, [["gable-2f-long", "slate-brick", "학생 기숙사", "laundry", "right"], ["gable-long-low", "moss-plaster", "약초 가게", "herbs", "right"]], { gap: 2 });
      b.rowAbove(40, 3, 53, [["gable-cross-r", "amber-wood", "학생 주점", "tavern", "right"], ["gable-twin", "bright-plaster", "마법 도구점", "shop", "right"], ["gable-house", "thatch-plaster", "교수 집", "garden", "right"], ["gable-steep", "slate-brick", "교수 집", "bees", "right"]], { gap: 3 });
      b.spine([[[3, 40], [53, 40]], [[28, 28], [28, 40]], [[15, 10], [15, 16], [20, 16]], [[41, 10], [41, 16], [35, 16]]]);
      b.connect(); b.paintRoads(); b.plazaUnroad();
      b.props([["돌 석상", 21, 17, "대마법사 석상", "마법진 광장"], ["돌 석상", 34, 17, "대마법사 석상", "마법진 광장"], ["돌등", 23, 22, "광장 등불", "마법진 광장"], ["돌등", 32, 22, "광장 등불", "마법진 광장"], ["벤치", 22, 20, "광장 벤치", "마법진 광장"], ["벤치", 32, 20, "광장 벤치", "마법진 광장"], ["꽃 화단", 24, 17, "광장 화단", "마법진 광장"], ["꽃 화단", 30, 17, "광장 화단", "마법진 광장"]]);
      b.yards();
      b.forest({ bands: { north: [1, 1], west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[2, 46, 5, 3, 10], [54, 46, 5, 3, 10]], noise: 0.5 });
      b.edgeClumps(3, ["round-bush", "tree"]);
      b.threes(348, 4);
    },
  },
];
