// Atlas towns · rural villages: wheat farm, orchard, horse ranch, vineyard and harvest fair (autumn sheet), woodcutters'
// camp, hunters' hamlet, crossroads inn, market town, beekeepers' meadow, mill village. Tilled fields with vegetable
// rows (TownMap.crops), fenced paddocks, farmyards; the houses face a lane or a street (rowAbove) so every door is reached.
const F = "forest_harmony", AUT = "forest_harmony_autumn";

export const RURAL_PLANS = [
  {
    id: "town-farm-wheat", name: "황금들 농촌 마을", category: "rural", tilesetId: F, width: 56, height: 44, seed: 16101,
    purpose: "넓은 밭이 마을을 둘러싼 농촌. 밭 넷과 허수아비, 농가 넷과 큰 헛간, 곡물 창고, 우물 마당",
    note: "동서로 난 마을길 북쪽에 농가와 큰 헛간이 줄지어 서고, 길 남쪽과 마을 북쪽에 채소 이랑이 줄지은 밭이 넷 펼쳐진다. 밭마다 허수아비가 서고, 가운데 우물 마당엔 씨앗 자루와 과일 상자가 쌓였다. 서쪽 들길로 들어와 동쪽 들길로 나간다",
    build(b) {
      b.exits([{ side: "west", at: 24, meets: "서쪽 들길(필드) 동쪽 출구" }, { side: "east", at: 24, meets: "동쪽 들길(필드) 서쪽 출구" }]);
      b.pave(b.ellipseCells(28, 25, 4, 2, 0.05), "dirt", { name: "우물 마당" });
      b.put("낮은 돌 우물", 27, 24, { purpose: "마당 우물" });
      b.spine([["exit:0", [22, 24]], [[34, 24], "exit:1"], [[28, 27], [28, 33]]]);
      b.rowAbove(24, 3, 52, [["gable-porch", "thatch-plaster", "농가", "farm", "right"], ["gable-barn", "thatch-log", "큰 헛간", "storage", "left"], ["gable-house", "amber-wood", "농가", "laundry", "right"], ["gable-long-low", "thatch-log", "곡물 창고", "storage", "right"], ["gable-steep", "moss-plaster", "농가", "farm", "left"]], { gap: 3 });
      b.connect(); b.paintRoads();
      b.crops(4, 29, 20, 10, { owner: "남서쪽 밀밭" }); b.crops(33, 29, 19, 10, { owner: "남동쪽 채소밭" });
      b.props([["씨앗 자루", 25, 26, "씨앗 자루", "우물 마당"], ["과일 상자", 30, 26, "수확 상자", "우물 마당"], ["나무통", 31, 24, "우물 물통", "우물 마당"], ["나무 이정표", 3, 22, "마을 표지"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1.5], south: [2, 1] }, blobs: [[2, 2, 4, 4, 8], [54, 42, 4, 3, 8]], noise: 0.5 });
      b.edgeClumps(3, ["tree", "round-bush"]);
      b.tallGrass(4, [4, 8]);
      b.threes(348, 5);
    },
  },
  {
    id: "town-orchard", name: "사과꽃 과수원 마을", category: "rural", tilesetId: F, width: 50, height: 42, seed: 16201,
    purpose: "울타리 친 과수원 둘과 사과 가공 집들의 마을. 줄지어 심은 과일나무, 수확 상자와 술통, 사과술 양조장",
    note: "마을 북쪽과 동쪽에 울타리 친 과수원이 있고 과일나무가 줄 맞춰 섰다. 가운데 길가에 과수원 주인 집·사과술 양조장·수확 창고가 서고 과일 좌판과 수확 상자가 쌓였다. 남쪽 길로 들어온다",
    build(b) {
      b.exits([{ side: "south", at: 24, meets: "과수원 길(필드) 북쪽 출구" }]);
      const o1 = b.fenceRing(3, 2, 22, 13, 10, 2, "북쪽 과수원"), o2 = b.fenceRing(30, 2, 17, 13, 7, 2, "동쪽 과수원");
      b.spine([["exit:0", [24, 30]], [[3, 30], [47, 30]], [[13, 30], "yard-gate:0"], [[37, 30], "yard-gate:1"]]);
      b.rowAbove(30, 3, 47, [["gable-cross-l", "amber-wood", "과수원 주인 집", "garden", "right"], ["gable-long-low", "timber-hall", "사과술 양조장", "tavern", "right"], ["gable-house", "thatch-plaster", "과수꾼 집", "laundry", "right"], ["gable-barn", "thatch-log", "수확 창고", "storage", "left"]], { gap: 2 });
      b.connect(); b.paintRoads();
      for (const [ix, iy, iw, ih] of [o1.inside, o2.inside]) {
        // the fence keeps its inside free of fill; open it for the rows of fruit trees, then close it again
        const inside = b.rectCells(ix, iy, iw, ih); for (const i of inside) b.keep.delete(i);
        for (const y of [iy + 1, iy + ih - 5]) for (let x = ix + 1 + (y > iy + 1 ? 2 : 0); x + 3 <= ix + iw; x += 4) b.trees([["tree", x, y]]);
        for (const i of inside) b.keep.add(i);
      }
      b.homes([["gable-long-low", "thatch-log", 6, 33, "과수꾼 집", "farm", "right"]], 4);
      b.connect(); b.paintRoads();
      b.props([["과일 상자", 22, 32, "수확 상자", "과수원"], ["과일 상자", 27, 32, "수확 상자", "과수원"], ["과일 좌판", 30, 33, "사과 좌판", "사과술 양조장"], ["술통", 20, 16, "사과술 통", "사과술 양조장"], ["항아리", 28, 16, "사과 식초 항아리", "사과술 양조장"]]);
      b.yards();
      b.forest({ bands: { south: [2, 1.5], west: [1, 1], east: [1, 1] }, blobs: [[2, 40, 5, 3, 10], [48, 40, 4, 3, 8]], noise: 0.5 });
      b.edgeClumps(3, ["round-bush", "small-bush"]);
      b.tallGrass(3, [4, 7]);
      b.threes(348, 6);
    },
  },
  {
    id: "town-horse-ranch", name: "갈기바람 말 목장 마을", category: "rural", tilesetId: F, width: 58, height: 44, seed: 16301,
    purpose: "넓은 방목장 셋과 마구간의 말 목장 마을. 조련장, 여물 창고, 목장주 저택",
    note: "마을 길 양옆으로 나무 울타리를 친 넓은 방목장 셋이 있다. 북쪽엔 목장주 2층 저택과 마구간 둘, 여물 창고가 선다. 방목장마다 구유와 여물 통나무, 조련장엔 허수아비 과녁. 서쪽 길로 들어와 남쪽 들길로 나간다",
    build(b) {
      b.exits([{ side: "west", at: 20, meets: "목장 길(필드) 동쪽 출구" }, { side: "south", at: 30, meets: "남쪽 들길(필드) 북쪽 출구" }]);
      b.fenceRing(4, 25, 20, 13, 9, 2, "서쪽 방목장"); b.fenceRing(34, 25, 20, 13, 9, 2, "동쪽 방목장"); b.fenceRing(40, 3, 14, 10, 6, 2, "조련장");
      b.spine([["exit:0", [30, 20]], [[30, 20], [30, 43]], [[4, 20], [54, 20]], [[13, 20], "yard-gate:0"], [[43, 20], "yard-gate:1"], [[46, 20], [46, 14], "yard-gate:2"]]);
      b.rowAbove(20, 3, 38, [["gable-2f-porch", "slate-brick", "목장주 저택", "garden", "right"], ["gable-barn", "thatch-log", "마구간", "storage", "left"], ["gable-barn", "amber-wood", "마구간", "storage", "left"]], { gap: 2 });
      b.connect(); b.paintRoads();
      b.props([["나무통", 7, 28, "구유", "서쪽 방목장"], ["씨앗 자루", 18, 28, "여물 자루", "서쪽 방목장"], ["통나무 더미", 12, 33, "여물 통나무", "서쪽 방목장"], ["나무통", 37, 28, "구유", "동쪽 방목장"], ["통나무 더미", 48, 33, "여물 통나무", "동쪽 방목장"],
        ["허수아비", 44, 6, "조련 과녁", "조련장"], ["허수아비", 49, 6, "조련 과녁", "조련장"], ["나무 상자", 42, 9, "마구 상자", "조련장"], ["나무 이정표", 26, 22, "목장 표지"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1.5], east: [1, 1] }, blobs: [[2, 42, 5, 3, 10], [56, 42, 5, 3, 10]], noise: 0.5 });
      b.edgeClumps(3, ["tree", "round-bush"]);
      b.tallGrass(6, [5, 10]);
      b.threes(348, 6);
    },
  },
  {
    id: "town-vineyard", name: "붉은잎 포도원 마을", category: "rural", tilesetId: AUT, width: 54, height: 42, seed: 16401,
    purpose: "가을 언덕의 포도원 마을. 이랑 진 포도밭 셋, 포도주 양조장과 술통 마당, 포도 따는 일꾼 집",
    note: "단풍 든 언덕 발치 길가에 포도주 양조장과 포도원 주인 집, 일꾼 집이 서고 양조장 마당엔 술통이 줄지어 쌓였다. 길 북쪽 언덕과 남쪽에 이랑 진 포도밭 셋. 서쪽 길로 들어와 동쪽 길로 나간다",
    build(b) {
      b.cliffs([{ points: [[0, 12], [20, 12], [22, 13], [53, 13]], height: 4, left: "open", right: "open" }]);
      b.stairs([[40, 13, 4]]);
      b.exits([{ side: "west", at: 29, meets: "포도원 길(필드) 동쪽 출구" }, { side: "east", at: 29, meets: "동쪽 단풍 길(필드) 서쪽 출구" }]);
      b.spine([["exit:0", "exit:1"], [[40, 29], "stairs-bottom:0"], ["stairs-top:0", [40, 8], [20, 8]]]);
      b.rowAbove(29, 3, 50, [["gable-hall", "timber-hall", "포도주 양조장", "tavern", "right"], ["gable-2f-lean", "amber-wood", "포도원 주인 집", "garden", "right"], ["gable-long-low", "slate-wood", "일꾼 집", "laundry", "right"], ["gable-house", "amber-wood", "일꾼 집", "storage", "right"]], { gap: 3 });
      b.connect(); b.paintRoads();
      b.crops(3, 2, 16, 9, { owner: "언덕 포도밭" }); b.crops(24, 2, 12, 5, { owner: "언덕 포도밭", scarecrow: false });
      b.crops(4, 33, 22, 7, { owner: "남쪽 포도밭" }); b.crops(31, 33, 19, 7, { owner: "남쪽 포도밭" });
      b.props([["술통", 7, 31, "포도주 통", "포도주 양조장"], ["술통", 8, 31, "포도주 통", "포도주 양조장"], ["작은 오크통", 9, 31, "포도주 통", "포도주 양조장"], ["과일 상자", 44, 7, "포도 수확 상자", "언덕 포도밭"], ["과일 상자", 46, 7, "포도 수확 상자", "언덕 포도밭"]]);
      b.yards();
      b.forest({ bands: { north: [1, 1] }, blobs: [[52, 2, 4, 3, 8], [52, 40, 4, 3, 8], [2, 40, 3, 3, 6]], noise: 0.5 });
      b.edgeClumps(3, ["tree", "round-bush"]);
      b.threes(348, 4);
    },
  },
  {
    id: "town-harvest-fair", name: "단풍골 추수 장터", category: "rural", tilesetId: AUT, width: 52, height: 42, seed: 16501, plaza: [["dirt", ["과일 좌판", "나무통", "과일 상자", "씨앗 자루", "벤치"]]], plazaSq: 3,
    purpose: "추수 끝난 가을 마을의 장터 날. 광장 무대와 노점, 수확물 더미, 둘레의 거둔 밭",
    note: "가을 마을 한가운데 흙 광장에 추수 잔치 무대가 서고 노점과 과일 좌판이 둘러선다. 수확한 과일 상자와 씨앗 자루가 쌓였다. 광장 둘레엔 농가와 여관, 마을 밖은 거둔 밭. 남쪽 길로 들어와 서쪽 길로 나간다",
    build(b) {
      b.exits([{ side: "south", at: 26, meets: "추수 들길(필드) 북쪽 출구" }, { side: "west", at: 20, meets: "서쪽 단풍길(필드) 동쪽 출구" }]);
      b.pave(b.ellipseCells(26, 20, 9, 5, 0.05), "dirt", { name: "장터 광장" });
      b.stage(23, 15, 6, 3, "추수 잔치 무대");
      b.spine([["exit:0", [26, 26]], ["exit:1", [17, 20]]]);
      b.homes([["gable-cross", "amber-wood", 5, 4, "여관", "tavern", "right"], ["gable-house", "slate-wood", 38, 4, "농가", "farm", "left"], ["gable-long-low", "timber-hall", 38, 26, "곡물 창고", "storage", "left"], ["gable-house", "amber-wood", 6, 26, "농가", "laundry", "right"]], 5);
      b.connect(); b.paintRoads(); b.plazaUnroad();
      b.props([["장터 노점", 18, 22, "추수 장 노점", "장터 광장"], ["장터 노점", 30, 22, "추수 장 노점", "장터 광장"], ["과일 좌판", 32, 18, "추수 장 좌판", "장터 광장"], ["과일 좌판", 18, 18, "추수 장 좌판", "장터 광장"]]);
      b.crops(3, 34, 18, 6, { owner: "거둔 밀밭" }); b.crops(32, 34, 17, 6, { owner: "거둔 채소밭" });
      b.yards();
      b.forest({ bands: { north: [2, 1.5], east: [2, 1] }, blobs: [[2, 2, 3, 3, 6]], noise: 0.5 });
      b.edgeClumps(3, ["tree", "round-bush"]);
      b.threes(348, 4);
    },
  },
  {
    id: "town-woodcutter", name: "도끼소리 나무꾼 마을", category: "rural", tilesetId: F, width: 50, height: 42, seed: 16601,
    purpose: "깊은 숲을 베어 낸 빈터의 나무꾼 마을. 통나무 더미와 장작 마당, 제재소, 나무꾼 오두막",
    note: "사방이 짙은 숲인 빈터 곳곳에 벤 통나무가 쌓이고 장작 마당이 있다. 개울가 제재소와 나무꾼 오두막 넷, 도끼 가는 대장간. 숲 가장자리엔 그루터기 같은 마른 묘목이 남았다. 남쪽 숲길로 들어와 동쪽 벌목길로 나간다",
    build(b) {
      b.river({ width: 2, points: [[8, 0], [8, 14], [10, 24], [9, 41]] });
      b.smoothWater(); b.paintWater();
      b.bridges([[9, 30]]);
      b.exits([{ side: "south", at: 26, meets: "숲길(필드) 북쪽 출구" }, { side: "east", at: 18, meets: "벌목길(필드) 서쪽 출구" }]);
      b.pave(b.ellipseCells(26, 21, 6, 3, 0.1), "dirt", { name: "장작 마당" });
      b.spine([["exit:0", [26, 24]], [[32, 20], "exit:1"], [[20, 22], [14, 30], "bridge-east:0"], ["bridge-west:0", [3, 30]]]);
      b.homes([["gable-long", "thatch-log", 13, 7, "제재소", "woodwork", "right"], ["gable-house", "thatch-log", 25, 8, "나무꾼 오두막", "woodwork", "right"], ["gable-steep", "thatch-log", 34, 8, "나무꾼 오두막", "laundry", "right"],
        ["gable-long-low", "charcoal-timber", 34, 26, "도끼 대장간", "smith", "right"], ["gable-shed", "thatch-log", 17, 30, "장작 헛간", null, null], ["gable-house", "moss-plaster", 1, 22, "나무꾼 오두막", "herbs", "right"]], 4);
      b.connect(); b.paintRoads();
      b.props([["통나무 더미", 21, 20, "벤 통나무", "장작 마당"], ["통나무 더미", 22, 20, "벤 통나무", "장작 마당"], ["통나무 더미", 30, 20, "벤 통나무", "장작 마당"], ["장작 더미", 23, 22, "쪼갠 장작", "장작 마당"], ["장작 더미", 29, 22, "쪼갠 장작", "장작 마당"], ["장작", 26, 23, "장작 패는 자리", "장작 마당"],
        ["마른 묘목", 40, 33, "벤 나무 그루터기", "벌목지"], ["마른 묘목", 43, 30, "벤 나무 그루터기", "벌목지"], ["통나무 더미", 44, 33, "벤 통나무", "벌목지"], ["통나무 더미", 41, 36, "벤 통나무", "벌목지"]]);
      b.yards();
      b.forest({ bands: { north: [3, 1.5], west: [2, 1], east: [3, 1.5], south: [3, 1.5] }, blobs: [[46, 2, 6, 5, 12], [2, 40, 5, 4, 10]], noise: 0.6 });
      b.edgeClumps(5, ["tree", "big-oak", "round-bush"]);
      b.tallGrass(3, [4, 7]);
      b.threes(348, 4);
    },
  },
  {
    id: "town-hunter", name: "늑대울음 사냥꾼 부락", category: "rural", tilesetId: F, width: 46, height: 40, seed: 16701,
    purpose: "짙은 숲속 사냥꾼 부락. 가죽 말리는 천막, 모닥불, 사냥꾼 오두막과 무두질 헛간, 활 과녁",
    note: "짙은 숲 사이 좁은 빈터에 사냥꾼 오두막 셋과 무두질 헛간이 모여 있다. 가운데 모닥불 둘레에 가죽 천막 둘과 가죽 말리는 빨랫줄, 동쪽에 활 연습 허수아비 과녁. 서쪽 숲길로만 드나든다",
    build(b) {
      b.exits([{ side: "west", at: 22, meets: "짙은 숲길(필드) 동쪽 출구" }]);
      b.put("모닥불", 22, 20, { purpose: "부락 모닥불", owner: "부락 마당" });
      b.spine([["exit:0", [16, 22], [28, 22]]]);
      b.homes([["gable-house", "thatch-log", 12, 9, "사냥꾼 오두막", "woodwork", "right"], ["gable-steep", "charcoal-timber", 24, 8, "사냥꾼 우두머리 집", "guard", "right"], ["gable-long-low", "thatch-log", 30, 25, "무두질 헛간", "storage", "right"], ["gable-shed", "thatch-log", 13, 26, "훈제 헛간", null, null]], 4);
      b.connect(); b.paintRoads();
      b.props([["가죽 천막", 17, 16, "사냥꾼 천막", "부락 마당"], ["가죽 천막", 26, 16, "사냥꾼 천막", "부락 마당"], ["통나무 더미", 21, 20, "모닥불 통나무", "부락 마당"], ["통나무 더미", 23, 20, "모닥불 통나무", "부락 마당"], ["빨랫줄", 19, 24, "가죽 말리기", "무두질 헛간"],
        ["허수아비", 35, 18, "활 과녁", "과녁터"], ["허수아비", 37, 20, "활 과녁", "과녁터"], ["무기 거치대", 33, 19, "활 거치대", "과녁터"], ["해골", 29, 18, "사냥 전리품", "사냥꾼 우두머리 집"]]);
      b.yards();
      b.forest({ bands: { north: [4, 1.5], south: [5, 1.5], east: [4, 1.5], west: [2, 1] }, blobs: [[2, 2, 7, 6, 14], [2, 38, 7, 6, 14], [44, 2, 6, 6, 12], [44, 38, 6, 5, 12]], clear: [[22, 20, 14, 10, 14]] });
      b.edgeClumps(5, ["dark-tree", "tree", "round-bush"]);
      b.threes(348, 3);
    },
  },
  {
    id: "town-crossroads-inn", name: "네거리 쉼터 여관 마을", category: "rural", tilesetId: F, width: 52, height: 46, seed: 16801, plaza: [["cobble", ["벤치", "돌등", "화분"]]],
    purpose: "네 방향 길이 만나는 네거리의 여관 마을. 큰 여관과 마구간, 우물, 나그네 게시판, 대장간과 잡화점",
    note: "동서남북 네 길이 만나는 네거리 돌 광장에 우물과 나그네 게시판이 있다. 네 모퉁이에 큰 여관·마구간·대장간·잡화점이 서고, 여관 앞엔 벤치와 술통, 마구간엔 여물. 네 방향 모두 필드로 이어진다",
    build(b) {
      b.exits([{ side: "north", at: 26, meets: "북쪽 가도(필드) 남쪽 출구" }, { side: "south", at: 26, meets: "남쪽 가도(필드) 북쪽 출구" }, { side: "west", at: 24, meets: "서쪽 가도(필드) 동쪽 출구" }, { side: "east", at: 24, meets: "동쪽 가도(필드) 서쪽 출구" }]);
      b.pave(b.ellipseCells(26.5, 24.5, 5, 3.5, 0.04), "cobble", { name: "네거리 광장" });
      b.put("낮은 돌 우물", 26, 24, { purpose: "네거리 우물" });
      b.spine([["exit:0", [26, 21]], [[26, 28], "exit:1"], ["exit:2", [22, 24]], [[31, 24], "exit:3"]]);
      b.rowAbove(24, 3, 22, [["gable-cross-r", "amber-wood", "큰 여관", "tavern", "right"]], { gap: 2 });
      b.rowAbove(24, 31, 50, [["gable-barn", "thatch-log", "마구간", "storage", "left"], ["gable-shed", "thatch-log", "여물 헛간", null, null]], { gap: 2 });
      b.homes([["gable-long-low", "amber-brick", 8, 31, "대장간", "smith", "right"], ["gable-twin", "bright-plaster", 35, 31, "잡화점", "shop", "left"], ["gable-house", "thatch-plaster", 8, 4, "마부 집", "laundry", "right"], ["gable-2f-narrow", "slate-brick", 36, 4, "경비 초소", "guard", "left"]], 5);
      b.connect(); b.paintRoads(); b.plazaUnroad();
      b.props([["게시판", 29, 21, "나그네 게시판", "네거리 광장"], ["나무 이정표", 23, 21, "네 갈래 이정표", "네거리 광장"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], south: [2, 1], west: [2, 1], east: [2, 1] }, blobs: [[2, 2, 5, 4, 10], [50, 2, 5, 4, 10], [2, 44, 5, 4, 10], [50, 44, 5, 4, 10]], noise: 0.5 });
      b.edgeClumps(4);
      b.tallGrass(4, [4, 8]);
      b.threes(348, 5);
    },
  },
  {
    id: "town-market-town", name: "세갈래 장터 읍내", category: "rural", tilesetId: F, width: 60, height: 50, seed: 16901, plaza: [["cobble", ["벤치", "돌등", "화분", "꽃 화단", "과일 좌판"]]], plazaSq: 2,
    purpose: "근방 농촌이 물건을 팔러 오는 장터 읍내. 큰 돌 광장의 분수와 노점 줄, 가게 늘어선 큰길, 여관·길드·대장간",
    note: "세 갈래 길이 모이는 읍내 한가운데 넓은 돌 광장이 있고 분수를 노점 줄이 둘러싼다. 광장 북쪽엔 상인 길드와 여관, 큰길 양옆에 잡화점·빵집·재단사·대장간이 늘어서고 뒤로 민가. 남쪽·서쪽·동쪽 길로 나간다",
    build(b) {
      b.exits([{ side: "south", at: 30, meets: "남쪽 가도(필드) 북쪽 출구" }, { side: "west", at: 26, meets: "서쪽 들길(필드) 동쪽 출구" }, { side: "east", at: 26, meets: "동쪽 들길(필드) 서쪽 출구" }]);
      b.pave(b.rectCells(21, 20, 19, 12), "cobble", { name: "장터 광장" });
      b.put("광장 분수", 29, 24, { purpose: "광장 분수" });
      b.spine([["exit:0", [30, 32]], ["exit:1", [21, 26]], [[40, 26], "exit:2"], [[3, 40], [57, 40]], [[30, 32], [30, 40]], [[3, 13], [57, 13]], [[21, 20], [21, 13]], [[39, 20], [39, 13]]]);
      b.rowAbove(20, 21, 40, [["gable-hall", "slate-brick", "상인 길드", "storage", "right"], ["gable-cross", "amber-wood", "여관", "tavern", "right"]], { gap: 1 });
      b.rowAbove(26, 3, 20, [["gable-twin-step", "bright-plaster", "잡화점", "shop", "right"], ["gable-2f-narrow", "amber-brick", "빵집", "shop", "right"]], { gap: 1 });
      b.rowAbove(26, 41, 58, [["gable-2f-long", "blue-stone", "재단사", "shop", "right"], ["gable-long-low", "amber-brick", "대장간", "smith", "right"]], { gap: 1 });
      b.rowAbove(40, 3, 57, [["gable-house", "thatch-plaster", "민가", "laundry", "right"], ["gable-long", "amber-wood", "민가", "garden", "right"], ["gable-twin", "moss-plaster", "민가", "herbs", "right"], ["gable-steep", "slate-wood", "민가", "laundry", "right"]], { gap: 2 });
      b.rowAbove(13, 3, 57, [["gable-2f-porch", "slate-brick", "읍장 집", "garden", "right"], ["gable-house", "amber-wood", "민가", "laundry", "right"], ["gable-cross-l", "bright-plaster", "민가", "garden", "right"], ["gable-long-low", "thatch-log", "창고", "storage", "right"]], { gap: 2 });
      b.connect(); b.paintRoads(); b.plazaUnroad();
      b.props([["줄무늬 노점 빨강", 23, 22, "장터 노점", "장터 광장"], ["줄무늬 노점 파랑", 23, 28, "장터 노점", "장터 광장"], ["줄무늬 노점 초록", 35, 22, "장터 노점", "장터 광장"], ["장터 노점", 35, 28, "장터 노점", "장터 광장"], ["게시판", 26, 21, "읍내 게시판", "장터 광장"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], south: [2, 1] }, blobs: [[2, 2, 3, 3, 6], [58, 2, 3, 3, 6], [2, 48, 4, 3, 8], [58, 48, 4, 3, 8]], noise: 0.5 });
      b.edgeClumps(3, ["round-bush", "small-bush", "tree"]);
      b.threes(348, 4);
    },
  },
  {
    id: "town-bee-meadow", name: "꿀벌 꽃들 양봉 마을", category: "rural", tilesetId: F, theme: "meadow", width: 48, height: 40, seed: 17001,
    purpose: "꽃이 만발한 들판의 양봉 마을. 벌통 마당, 꿀 창고, 꽃 화단과 덩굴 아치, 밀랍 공방",
    note: "들꽃이 흐드러진 완만한 들판에 양봉가 집과 꿀 창고, 밀랍 공방이 흩어져 있다. 집마다 벌통(새집)과 꽃 화단이 둘러서고, 가운데 덩굴 아치 아래로 꽃길이 난다. 서쪽 길로 들어와 북쪽 들길로 나간다",
    build(b) {
      b.exits([{ side: "west", at: 22, meets: "꽃들길(필드) 동쪽 출구" }, { side: "north", at: 30, meets: "북쪽 들길(필드) 남쪽 출구" }]);
      b.spine([["exit:0", [30, 22], "exit:1"], [[30, 22], [40, 26]]]);
      b.homes([["gable-house", "thatch-plaster", 8, 10, "양봉가 집", "bees", "right"], ["gable-long-low", "amber-wood", 18, 25, "꿀 창고", "storage", "right"], ["gable-porch", "moss-plaster", 34, 11, "밀랍 공방", "bees", "left"], ["gable-steep", "thatch-plaster", 34, 28, "양봉가 집", "bees", "left"], ["gable-shed", "thatch-log", 8, 28, "벌통 헛간", null, null]], 4);
      b.connect(); b.paintRoads();
      b.props([["덩굴 아치", 24, 21, "꽃길 아치", "꽃길"], ["꽃 화단", 20, 19, "꽃길 화단", "꽃길"], ["꽃 화단", 27, 19, "꽃길 화단", "꽃길"], ["새집", 22, 17, "벌통", "양봉가 집"], ["새집", 28, 16, "벌통", "양봉가 집"], ["새집", 14, 18, "벌통", "양봉가 집"], ["항아리", 25, 27, "꿀 항아리", "꿀 창고"]]);
      b.yards();
      b.forest({ bands: { south: [2, 1], east: [2, 1] }, blobs: [[2, 2, 4, 3, 8], [46, 38, 4, 3, 8]], noise: 0.5 });
      b.edgeClumps(3, ["round-bush", "small-bush"]);
      b.threes(348, 6);
    },
  },
  {
    id: "town-mill-river", name: "물레방아 강마을", category: "rural", tilesetId: F, width: 54, height: 42, seed: 17101,
    purpose: "강가 물레방앗간과 밀밭의 농촌. 방앗간 앞 작은 선착장, 곡물 자루 쌓인 마당, 다리 건너 밀밭",
    note: "마을 동쪽을 남북으로 강이 흐르고 강둑에 방앗간 두 채가 물을 본다. 방앗간 마당엔 곡물 자루와 상자가 쌓이고 강으로 작은 선착장이 나 있다. 서쪽엔 농가와 빵집, 다리 건너 동쪽 강변엔 밀밭. 서쪽 길로 들어와 동쪽 밀밭 길로 나간다",
    build(b) {
      b.river({ width: 4, points: [[36, 0], [35, 12], [37, 24], [36, 41]] });
      b.smoothWater(); b.paintWater();
      b.bridgeNear(36, 20);
      b.exits([{ side: "west", at: 20, meets: "서쪽 들길(필드) 동쪽 출구" }, { side: "east", at: 20, meets: "밀밭 길(필드) 서쪽 출구" }]);
      b.pave(b.rectCells(24, 22, 8, 4), "dirt", { name: "방앗간 마당" });
      b.spine([["exit:0", "bridge-west:0"], ["bridge-east:0", "exit:1"]]);
      b.rowAbove(20, 3, 33, [["gable-2f-lean", "timber-hall", "물레방앗간", "storage", "right"], ["gable-house", "thatch-plaster", "농가", "farm", "right"], ["gable-long-low", "amber-brick", "빵집", "shop", "right"]], { gap: 2 });
      b.homes([["gable-long", "timber-hall", 25, 30, "둘째 방앗간", "storage", "right"], ["gable-house", "amber-wood", 6, 28, "농가", "laundry", "right"]], 4);
      b.connect(); b.paintRoads();
      b.crops(41, 4, 11, 12, { owner: "강 건너 밀밭" }); b.crops(41, 25, 11, 12, { owner: "강 건너 밀밭" });
      b.props([["씨앗 자루", 25, 23, "곡물 자루", "방앗간 마당"], ["씨앗 자루", 27, 23, "곡물 자루", "방앗간 마당"], ["나무 상자", 29, 24, "밀가루 상자", "방앗간 마당"], ["과일 상자", 30, 23, "곡물 상자", "방앗간 마당"]]);
      b.pier(33, 30, "east", 2);
      b.yards();
      b.forest({ bands: { north: [2, 1], south: [2, 1], west: [1, 1] }, blobs: [[2, 2, 4, 3, 8], [2, 40, 4, 3, 8]], noise: 0.5 });
      b.edgeClumps(3);
      b.tallGrass(4, [4, 8]);
      b.threes(348, 5);
    },
  },
];
