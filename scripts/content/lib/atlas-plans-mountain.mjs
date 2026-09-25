// Atlas towns · mountain towns: mining, quarry, terraced mountain village, dwarf holds (forest and snow), cliffside
// ledge village and a highland pasture village. Cliff tiers with stone stairs, cliff dwellings, mine shafts.
const F = "forest_harmony", SNOW = "forest_harmony_snow";

export const MOUNTAIN_PLANS = [
  {
    id: "town-mining", name: "붉은바위 광산 마을", category: "mountain", tilesetId: F, width: 52, height: 48, seed: 15101,
    purpose: "두 단 절벽을 파고든 갱도 셋의 광산 마을. 갱도 앞 광석 더미와 상자, 아랫단 광부 숙소와 대장간, 윗단 감독관 집",
    note: "북쪽과 가운데 두 단 절벽 얼굴에 갱도 입구가 셋 뚫려 있고, 갱도 발치마다 캐낸 광석 더미·상자·장작이 쌓였다. 아랫단엔 광부 숙소·대장간·주점이 모닥불 마당을 둘러싸고, 돌계단으로 가운데 단 갱도와 절벽 집, 다시 윗단 감독관 집에 오른다. 남쪽 산길로 들어온다",
    build(b) {
      b.cliffs([{ points: [[0, 9], [16, 9], [18, 10], [34, 10], [36, 9], [51, 9]], height: 5, left: "open", right: "open" },
        { points: [[0, 24], [12, 24], [14, 25], [38, 25], [40, 24], [51, 24]], height: 5, left: "open", right: "open" }]);
      b.stairs([[44, 24, 5], [8, 9, 5]]);
      const s1 = b.shaft(22, 27, 2, 2), s2 = b.shaft(30, 27, 2, 2), s3 = b.shaft(24, 12, 2, 2);
      b.cliffHouse(7, 15, { role: "광부 절벽 집", wide: true, cliffY: 27 });
      b.exits([{ side: "south", at: 26, meets: "광산 산길(필드) 북쪽 출구" }]);
      b.put("모닥불", 19, 44, { purpose: "마당 모닥불", owner: "광부 마당" });
      b.spine([["exit:0", [26, 40]], [[4, 40], [48, 40]], [[44, 40], "stairs-bottom:0"], ["stairs-top:0", [44, 22], [4, 22]], [[8, 22], "stairs-bottom:1"], ["stairs-top:1", [8, 5], [30, 5]],
        [[s1.x, s1.y], [s1.x, 40]], [[s2.x, s2.y], [s2.x, 40]], [[s3.x, s3.y], [s3.x, 22]], [[17, 31], [17, 40]]]);
      b.rowAbove(40, 3, 47, [["gable-long", "slate-wood", "광부 숙소", "mine", "right"], ["gable-long-low", "amber-brick", "대장간", "smith", "right"], ["gable-twin-step", "timber-hall", "주점", "tavern", "right"], ["gable-long-low", "thatch-log", "광석 창고", "mine", "right"]], { gap: 2 });
      b.rowAbove(22, 12, 42, [["gable-long-low", "slate-brick", "광부 집", "laundry", "right"], ["gable-long-low", "thatch-log", "갱목 창고", "woodwork", "right"]], { gap: 3 });
      b.homes([["gable-house", "slate-brick", 33, 0, "감독관 집", "storage", "left"]], 4);
      b.connect(); b.paintRoads();
      b.props([["돌 무더기", 20, 32, "캐낸 광석", "갱도"], ["나무 상자", 25, 32, "광석 상자", "갱도"], ["장작 더미", 28, 32, "갱목", "갱도"],
        ["돌 무더기", 33, 32, "캐낸 광석", "갱도"], ["나무 상자", 27, 16, "광석 상자", "갱도"], ["회백색 바위 더미", 21, 16, "캐낸 광석", "갱도"],
        ["통나무 더미", 18, 44, "모닥불 둘레 통나무", "광부 마당"], ["통나무 더미", 20, 44, "모닥불 둘레 통나무", "광부 마당"], ["나무 이정표", 28, 45, "광산 입구 표지"]]);
      b.yards();
      b.forest({ bands: { west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[2, 46, 5, 3, 10], [50, 46, 5, 3, 10], [48, 3, 4, 3, 8]], noise: 0.6 });
      b.edgeClumps(3, ["tree", "small-bush"]);
      b.threes(537, 5);
    },
  },
  {
    id: "town-quarry", name: "흰돌 채석장 마을", category: "mountain", tilesetId: F, width: 50, height: 44, seed: 15201,
    purpose: "높은 흰 절벽을 깎아 돌을 떠내는 채석장 마을. 절벽 발치 채석장 마당에 깎은 돌기둥과 돌무더기, 남쪽에 석공들의 집",
    note: "북쪽 높은 절벽 발치가 채석장이다. 떠낸 흰 돌기둥과 오벨리스크 초벌, 돌무더기와 연장 상자가 마당에 늘어서고 절벽 얼굴엔 굴 하나. 남쪽 길가엔 석공 집·석공 조합·여관·가게. 서쪽 길로 들어와 동쪽 산길로 나간다",
    build(b) {
      b.cliffs([{ points: [[0, 11], [14, 11], [16, 12], [30, 12], [32, 11], [49, 11]], height: 7, left: "open", right: "open" }]);
      const cave = b.cave(40, 16);
      b.exits([{ side: "west", at: 32, meets: "채석장 길(필드) 동쪽 출구" }, { side: "east", at: 32, meets: "동쪽 산길(필드) 서쪽 출구" }]);
      b.pave(b.rectCells(8, 20, 26, 6), "dirt", { name: "채석장 마당" });
      b.spine([["exit:0", [8, 32], [42, 32], "exit:1"], [[20, 32], [20, 26]], [[cave.x, cave.y], [40, 32]]]);
      b.rowAbove(32, 3, 18, [["gable-long", "slate-brick", "석공 집", "mine", "right"], ["gable-house", "blue-stone", "석공 집", "laundry", "right"]], { gap: 2 });
      b.rowAbove(32, 23, 47, [["gable-hall", "slate-brick", "석공 조합", "storage", "right"], ["gable-2f-lean", "amber-brick", "여관", "tavern", "right"]], { gap: 2 });
      b.homes([["gable-long-low", "amber-wood", 30, 35, "잡화점", "shop", "right"], ["gable-house", "thatch-plaster", 8, 35, "집", "garden", "right"]], 4);
      b.connect(); b.paintRoads();
      for (const [n, x, y] of [["흰 돌기둥", 10, 21], ["흰 돌기둥", 12, 21], ["돌 오벨리스크", 15, 21], ["흰 돌기둥", 27, 21], ["돌 오벨리스크", 30, 21], ["돌 무더기", 18, 21], ["회백색 바위 더미", 19, 21], ["나무 상자", 23, 21],
        ["돌 무더기", 11, 24], ["회백색 바위 더미", 26, 24], ["돌 석상", 31, 24], ["장작 더미", 16, 24]]) b.props([[n, x, y, "채석장 돌감", "채석장 마당"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], south: [2, 1.5] }, blobs: [[2, 42, 5, 3, 10], [48, 42, 5, 3, 10]], noise: 0.6 });
      b.edgeClumps(3);
      b.threes(537, 5);
    },
  },
  {
    id: "town-mountain-terrace", name: "구름 비탈 계단 산촌", category: "mountain", tilesetId: F, width: 44, height: 58, seed: 15301,
    purpose: "가파른 산비탈에 세 단 계단식으로 앉은 산촌. 단마다 집 두어 채와 텃밭, 갈지자 돌계단, 맨 위 산신 제단",
    note: "남쪽 골짜기 길에서 시작해 절벽 세 단을 돌계단으로 갈지자로 오른다. 단마다 집 두어 채와 텃밭, 나무꾼 장작더미가 있고, 맨 윗단엔 돌 석상과 마법진의 산신 제단이 구름 낀 봉우리를 본다",
    build(b) {
      b.cliffs([{ points: [[0, 44], [43, 44]], height: 4, left: "open", right: "open" },
        { points: [[0, 30], [20, 30], [22, 29], [43, 29]], height: 4, left: "open", right: "open" },
        { points: [[0, 15], [43, 15]], height: 4, left: "open", right: "open" }]);
      b.stairs([[34, 44, 4], [8, 30, 4], [30, 15, 4]]);
      b.exits([{ side: "south", at: 20, meets: "골짜기 길(필드) 북쪽 출구" }]);
      b.spine([["exit:0", [20, 56]], [[3, 56], [40, 56]], [[34, 56], "stairs-bottom:0"], ["stairs-top:0", [34, 42]], [[3, 42], [40, 42]], [[9, 42], "stairs-bottom:1"], ["stairs-top:1", [9, 27]], [[3, 27], [40, 27]], [[30, 27], "stairs-bottom:2"], ["stairs-top:2", [30, 11], [20, 8]]]);
      b.rowAbove(56, 3, 40, [["gable-long-low", "thatch-log", "나무꾼 집", "woodwork", "right"], ["gable-shed", "thatch-log", "장작 헛간", null, null], ["gable-long-low", "amber-wood", "집", "laundry", "right"]], { gap: 2 });
      b.rowAbove(42, 3, 40, [["gable-long-low", "thatch-plaster", "약초꾼 집", "herbs", "right"], ["gable-long-low", "amber-wood", "촌장 집", "garden", "right"]], { gap: 3 });
      b.rowAbove(27, 3, 40, [["gable-long-low", "moss-plaster", "여관", "tavern", "right"], ["gable-shed", "thatch-log", "곳간", null, null]], { gap: 3 });
      b.connect(); b.paintRoads();
      b.put("돌 석상", 20, 3, { purpose: "산신 석상" }); b.put("마법진", 20, 6, { purpose: "산신 제단" });
      b.props([["돌등", 17, 5, "제단 등불", "산신 제단"], ["돌등", 23, 5, "제단 등불", "산신 제단"]]);
      b.gardenPlots(0);
      b.yards();
      b.forest({ bands: { west: [2, 1], east: [2, 1], north: [2, 1] }, blobs: [[40, 54, 5, 4, 10], [3, 3, 4, 4, 8], [40, 3, 4, 4, 8]], noise: 0.6 });
      b.edgeClumps(4, ["tree", "small-bush"]);
      b.tallGrass(4, [4, 8]);
      b.threes(537, 4);
    },
  },
  {
    id: "town-dwarf-hold", name: "쇠모루 드워프 산채", category: "mountain", tilesetId: F, width: 56, height: 48, seed: 15401,
    purpose: "거대한 절벽 벽에 문을 낸 드워프 산채. 절벽 집 다섯과 갱도, 발치 대장간 광장의 모닥불과 무기 거치대, 돌계단 윗단 망루",
    note: "북쪽을 높은 두 단 절벽이 막고, 아랫단 절벽 발치를 파고든 드워프 절벽 집 다섯이 문을 낸다. 가운데 갱도 입구 앞이 대장간 광장(모닥불 둘·무기 거치대·광석 상자). 돌계단으로 윗단에 오르면 원탑 망루와 창고. 남쪽 산길로 들어온다",
    build(b) {
      b.cliffs([{ points: [[0, 8], [55, 8]], height: 4, left: "open", right: "open" }, { points: [[0, 17], [55, 17]], height: 8, left: "open", right: "open" }]);
      b.stairs([[48, 17, 8], [6, 8, 4]]);
      for (const [x, role] of [[3, "드워프 절벽 집"], [11, "대장장이 절벽 집"], [35, "드워프 절벽 집"], [41, "양조장 절벽 집"]]) b.cliffHouse(7, x, { role, wide: true, cliffY: 22 });
      const mine = b.shaft(26, 20, 3, 3);
      b.exits([{ side: "south", at: 28, meets: "드워프 산길(필드) 북쪽 출구" }]);
      b.pave(b.ellipseCells(27.5, 32, 8, 3.4, 0.05), "dirt", { name: "대장간 광장" });
      b.spine([["exit:0", [28, 40], [28, 36]], [[3, 28], [52, 28]], [[mine.x, mine.y], [27, 28]], [[48, 28], "stairs-bottom:0"], ["stairs-top:0", [30, 14], [7, 14], "stairs-bottom:1"], ["stairs-top:1", [7, 6], [44, 6]]]);
      b.homes([["gable-long-low", "slate-brick", 4, 36, "드워프 여관", "tavern", "right"], ["gable-long", "amber-brick", 42, 35, "무기 공방", "smith", "left"], ["gable-long-low", "slate-wood", 30, 0, "윗단 창고", "storage", "left"]], 4);
      b.connect(); b.paintRoads();
      b.tower(47, 0, "산채 망루");
      b.props([["모닥불", 22, 32, "대장간 불", "대장간 광장"], ["모닥불", 33, 32, "대장간 불", "대장간 광장"], ["무기 거치대", 24, 30, "무기 거치대", "대장간 광장"], ["무기 거치대", 31, 30, "무기 거치대", "대장간 광장"],
        ["나무 상자", 25, 33, "광석 상자", "대장간 광장"], ["술통", 30, 33, "맥주 통", "대장간 광장"], ["돌 무더기", 20, 31, "캐낸 광석", "대장간 광장"], ["장작 더미", 35, 31, "대장간 장작", "대장간 광장"]]);
      b.yards();
      b.forest({ bands: { south: [2, 1], west: [1, 1], east: [1, 1] }, blobs: [[2, 46, 5, 3, 10], [54, 46, 5, 3, 10]], noise: 0.5 });
      b.edgeClumps(3, ["small-bush", "tree"]);
      b.threes(537, 6);
    },
  },
  {
    id: "town-dwarf-snow", name: "서리모루 설산 드워프 마을", category: "mountain", tilesetId: SNOW, width: 54, height: 46, seed: 15501,
    purpose: "눈 덮인 설산 절벽의 드워프 마을. 절벽 집과 얼어붙은 연못, 눈 쌓인 대장간 광장, 갱도",
    note: "눈 덮인 두 단 절벽 발치에 드워프 절벽 집 셋과 갱도 입구가 있다. 아랫단엔 얼어붙은 연못(걸어서 건넌다)과 대장간·여관, 눈 쌓인 광장의 모닥불. 돌계단으로 윗단 망루 집에 오른다. 남쪽 눈길로 들어온다",
    build(b) {
      b.cliffs([{ points: [[0, 15], [53, 15]], height: 7, left: "open", right: "open" }]);
      b.stairs([[44, 15, 7]]);
      for (const [x, role] of [[4, "드워프 절벽 집"], [16, "드워프 절벽 집"], [30, "대장장이 절벽 집"]]) b.cliffHouse(7, x, { role, wide: true, cliffY: 19 });
      const mine = b.shaft(24, 18, 2, 3);
      b.pond(12, 34, 6, 3, 0.14); b.smoothWater(); b.paintWater(); b.freeze();
      b.exits([{ side: "south", at: 30, meets: "설산 눈길(필드) 북쪽 출구" }]);
      b.spine([["exit:0", [30, 40], [30, 26]], [[4, 25], [50, 25]], [[mine.x, mine.y], [24, 25]], [[44, 25], "stairs-bottom:0"], ["stairs-top:0", [40, 8], [20, 8]]]);
      b.homes([["gable-long", "slate-wood", 34, 30, "대장간", "smith", "right"], ["gable-house", "blue-stone", 40, 36, "여관", "tavern", "left"], ["gable-long-low", "slate-wood", 12, 4, "망루 집", "guard", "right"], ["gable-house", "slate-wood", 20, 30, "드워프 집", "mine", "right"], ["gable-long-low", "blue-stone", 44, 28, "광석 창고", "storage", "left"]], 4);
      b.connect(); b.paintRoads();
      b.props([["모닥불", 26, 29, "광장 모닥불", "광장"], ["통나무 더미", 25, 29, "모닥불 통나무", "광장"], ["통나무 더미", 27, 29, "모닥불 통나무", "광장"], ["나무 상자", 22, 22, "광석 상자", "갱도"], ["돌 무더기", 27, 22, "캐낸 광석", "갱도"], ["돌등", 19, 27, "광장 등불", "광장"], ["돌등", 33, 27, "광장 등불", "광장"], ["나무 상자", 17, 29, "짐 상자", "광장"], ["술통", 18, 29, "맥주 통", "광장"], ["장작 더미", 28, 34, "대장간 장작", "대장간"], ["무기 거치대", 31, 33, "무기 거치대", "대장간"], ["돌 무더기", 22, 39, "치운 눈 밑 돌", "광장"], ["줄무늬 노점 빨강", 13, 27, "드워프 장터 노점", "광장"], ["줄무늬 노점 파랑", 17, 27, "드워프 장터 노점", "광장"], ["장터 노점", 23, 29, "드워프 장터 노점", "광장"], ["돌등", 27, 36, "광장 등불", "광장"], ["통나무 더미", 21, 33, "땔감", "광장"], ["돌 무더기", 8, 29, "캐낸 광석", "갱도"], ["돌등", 12, 27, "연못 등불", "광장"], ["장작 더미", 27, 29, "대장간 땔감", "대장간"], ["통나무 더미", 27, 31, "대장간 땔감", "대장간"], ["술통", 28, 33, "물통", "대장간"], ["나무 상자", 27, 35, "쇠 상자", "대장간"], ["돌 무더기", 18, 36, "캐낸 광석", "광장"]]);
      b.yards();
      b.forest({ bands: { south: [2, 1], west: [2, 1], east: [2, 1] }, blobs: [[2, 44, 5, 3, 10], [52, 44, 4, 3, 8], [3, 3, 4, 4, 8]], noise: 0.5 });
      b.edgeClumps(3, ["tree", "small-bush"]);
    },
  },
  {
    id: "town-cliffside", name: "매 둥지 벼랑 마을", category: "mountain", tilesetId: F, width: 46, height: 48, seed: 15601,
    purpose: "깎아지른 벼랑의 좁은 턱마다 집이 붙은 마을. 세 턱을 잇는 돌계단, 턱 끝 전망대, 벼랑 밑을 흐르는 개울",
    note: "동쪽으로 흐르는 개울 위로 벼랑이 세 턱으로 솟는다. 턱마다 좁은 길을 따라 집 두 채씩이 벼랑에 등을 대고, 돌계단이 턱과 턱을 잇는다. 맨 위 턱 끝엔 매 사육장과 전망 벤치. 개울가 아랫길로 들어와 나무다리로 건넌다",
    build(b) {
      b.cliffs([{ points: [[0, 10], [45, 10]], height: 4, left: "open", right: "open" }, { points: [[0, 23], [45, 23]], height: 4, left: "open", right: "open" }, { points: [[0, 35], [45, 35]], height: 3, left: "open", right: "open" }]);
      b.stairs([[38, 35, 3], [6, 23, 4], [38, 10, 4]]);
      for (const [x, cy, role] of [[12, 26, "벼랑 굴집"], [24, 26, "벼랑 굴집"], [20, 13, "매 둥지 굴집"]]) b.cliffHouse(7, x, { role, wide: true, cliffY: cy });
      b.waterWhere((x, y) => y > 42 + Math.sin(x / 4));
      b.smoothWater(); b.paintWater();
      b.exits([{ side: "west", at: 40, meets: "개울가 길(필드) 동쪽 출구" }, { side: "east", at: 40, meets: "골짜기 필드 서쪽 출구" }]);
      b.spine([["exit:0", [38, 40], "exit:1"], [[38, 40], "stairs-bottom:0"], ["stairs-top:0", [38, 33], [7, 33], "stairs-bottom:1"], ["stairs-top:1", [7, 21], [38, 21], "stairs-bottom:2"], ["stairs-top:2", [38, 8], [10, 8]]]);
      b.homes([["gable-long-low", "amber-brick", 13, 15, "잡화점", "shop", "right"], ["gable-long-low", "thatch-plaster", 29, 15, "여관", "tavern", "right"]], 3);
      b.rowAbove(8, 14, 36, [["gable-long-low", "timber-hall", "매 사육사 집", "storage", "right"]], { gap: 3 });
      b.connect(); b.paintRoads();
      b.props([["벤치", 5, 7, "전망 벤치", "전망대"], ["새집", 8, 4, "매 둥지 상자", "매 사육사 집"], ["새집", 11, 4, "매 둥지 상자", "매 사육사 집"], ["나무 이정표", 2, 38, "벼랑 마을 표지"], ["빨랫줄", 31, 29, "굴집 빨래", "벼랑 굴집"], ["나무 상자", 35, 31, "굴집 짐", "벼랑 굴집"], ["술통", 36, 31, "굴집 물통", "벼랑 굴집"], ["장작 더미", 18, 30, "굴집 땔감", "벼랑 굴집"], ["화분", 11, 30, "굴집 화분", "벼랑 굴집"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1] }, blobs: [[44, 3, 3, 3, 8]], noise: 0.4 });
      b.threes(537, 4);
      b.threes(348, 4);
    },
  },
  {
    id: "town-highland-pasture", name: "바람고원 양치기 마을", category: "mountain", tilesetId: F, width: 56, height: 46, seed: 15701,
    purpose: "높은 고원의 양치기 마을. 울타리 친 목초지 셋과 양치기 집, 고원으로 오르는 돌계단, 바람 부는 초원",
    note: "절벽 한 단 위 넓은 고원에 울타리 친 목초지 셋이 펼쳐지고 양치기 집·털 깎는 헛간·치즈 창고가 흩어진다. 아랫단엔 여관과 마구간, 우물. 돌계단 둘로 고원에 오르고 남쪽 길로 들어온다",
    build(b) {
      b.cliffs([{ points: [[0, 26], [18, 26], [20, 27], [36, 27], [38, 26], [55, 26]], height: 4, left: "open", right: "open" }]);
      b.stairs([[10, 26, 4], [45, 26, 4]]);
      b.fenceRing(4, 3, 14, 9, 6, 2, "양 목초지"); b.fenceRing(22, 4, 12, 8, 5, 2, "양 목초지"); b.fenceRing(40, 12, 12, 8, 5, 2, "염소 목초지");
      b.exits([{ side: "south", at: 28, meets: "고원 아래 길(필드) 북쪽 출구" }]);
      b.put("낮은 돌 우물", 27, 36, { purpose: "마을 우물" });
      b.spine([["exit:0", [28, 40]], [[4, 35], [52, 35]], [[10, 35], "stairs-bottom:0"], [[45, 35], "stairs-bottom:1"], ["stairs-top:0", [10, 21], [45, 21], "stairs-top:1"], [[11, 21], "yard-gate:0"], [[27, 21], "yard-gate:1"], [[45, 21], "yard-gate:2"]]);
      b.homes([["gable-house", "thatch-log", 3, 14, "양치기 집", "farm", "right"], ["gable-long-low", "thatch-plaster", 23, 14, "털 깎는 헛간", "storage", "right"], ["gable-shed", "amber-wood", 38, 2, "치즈 창고", null, null],
        ["gable-2f-lean", "amber-wood", 4, 37, "여관", "tavern", "right"], ["gable-barn", "thatch-log", 40, 37, "마구간", "storage", "left"]], 4);
      b.connect(); b.paintRoads();
      b.props([["씨앗 자루", 6, 5, "여물 자루", "양 목초지"], ["나무통", 14, 9, "구유", "양 목초지"], ["나무통", 30, 9, "구유", "양 목초지"], ["통나무 더미", 43, 14, "여물 통나무", "염소 목초지"], ["허수아비", 25, 6, "까마귀 쫓는 허수아비", "양 목초지"]]);
      b.yards();
      b.forest({ bands: { south: [2, 1], west: [1, 1] }, blobs: [[54, 44, 4, 3, 8], [2, 44, 4, 3, 8], [54, 2, 3, 4, 8]], noise: 0.5 });
      b.edgeClumps(3, ["small-bush", "round-bush"]);
      b.tallGrass(6, [5, 10]);
      b.threes(348, 6);
    },
  },
];
