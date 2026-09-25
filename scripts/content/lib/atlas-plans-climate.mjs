// Atlas towns · climate towns on the recoloured forest sheets: snow village, snow port, snow lodge, desert oasis, desert
// cliff dwellings, desert river town, walled desert bazaar, volcano forge town, volcano refuge, autumn maple village,
// autumn temple town. Climate sheets take the base house kits only (no forest-only kits, no accents). Desert and
// volcano: no forest bands and no leafy trees (the fill turns spots into bare-tree groves, the ground pass lays dunes /
// lava plates); on the volcano sheet water paints as lava.
const SNOW = "forest_harmony_snow", SAND = "forest_harmony_desert", ASH = "forest_harmony_volcano", AUT = "forest_harmony_autumn";

export const CLIMATE_PLANS = [
  {
    id: "town-snow-village", name: "흰눈썹 설원 마을", category: "climate", tilesetId: SNOW, width: 52, height: 42, seed: 18101, plaza: [["cobble", ["돌등", "벤치", "장작 더미"]]],
    purpose: "눈 덮인 침엽수림 속 설원 마을. 얼어붙은 연못, 돌벽 교회, 모닥불 광장, 장작을 쌓은 통나무 집들",
    note: "눈 덮인 침엽수림에 둘러싸인 마을. 가운데 돌 광장의 모닥불 둘레로 집들이 서고, 북쪽엔 돌벽 교회, 서쪽엔 얼어붙은 연못(걸어서 건넌다)이 있다. 집마다 겨울 장작이 쌓였다. 남쪽 눈길로 들어와 동쪽 눈길로 나간다",
    build(b) {
      b.pond(10, 25, 6, 4, 0.14); b.smoothWater(); b.paintWater(); b.freeze();
      b.exits([{ side: "south", at: 28, meets: "설원 눈길(필드) 북쪽 출구" }, { side: "east", at: 22, meets: "동쪽 눈길(필드) 서쪽 출구" }]);
      b.landmark("church", 24, 3);
      b.pave(b.ellipseCells(27.5, 21, 5, 2.6, 0.05), "cobble", { name: "모닥불 광장" });
      b.put("모닥불", 27, 21, { purpose: "광장 모닥불", owner: "모닥불 광장" });
      b.spine([["exit:0", [28, 24]], [[32, 21], "exit:1"], [[27, 18], [27, 13]]]);
      b.homes([["gable-steep", "slate-wood", 12, 5, "촌장 집", "garden", "right"], ["gable-long", "amber-wood", 37, 5, "여관", "tavern", "left"], ["gable-house", "slate-wood", 36, 27, "사냥꾼 집", "woodwork", "left"],
        ["gable-long-low", "blue-stone", 17, 30, "대장간", "smith", "right"], ["gable-2f-narrow", "timber-hall", 42, 14, "잡화점", "shop", "left"]], 5);
      b.connect(); b.paintRoads(); b.plazaUnroad();
      b.props([["장작 더미", 25, 22, "모닥불 장작", "모닥불 광장"], ["통나무 더미", 30, 22, "모닥불 둘레 통나무", "모닥불 광장"], ["나무 이정표", 30, 38, "마을 표지"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1.5], west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[2, 2, 5, 4, 10], [50, 40, 5, 4, 10], [2, 40, 5, 3, 10]], noise: 0.6 });
      b.edgeClumps(4, ["tree", "small-bush"]);
    },
  },
  {
    id: "town-snow-port", name: "얼음곶 북방 항구", category: "climate", tilesetId: SNOW, width: 56, height: 42, seed: 18201,
    purpose: "얼음이 떠다니는 북쪽 바다의 항구 마을. 긴 부두와 나룻배, 생선 말리는 덕장, 등대 원탑, 창고",
    note: "북쪽 차가운 바다에 긴 나무 부두 둘이 뻗고 나룻배가 매였다. 물가엔 생선 말리는 빨랫줄 덕장과 창고가 줄짓고, 동쪽 곶 끝에 등대 원탑이 선다. 눈길이 남쪽 마을로 이어진다",
    build(b) {
      b.waterWhere((x, y) => y < 8 + 1.2 * Math.sin(x / 5));
      b.smoothWater(); b.paintWater();
      b.exits([{ side: "south", at: 26, meets: "남쪽 눈길(필드) 북쪽 출구" }, { side: "west", at: 22, meets: "서쪽 해안길(필드) 동쪽 출구" }]);
      b.pier(14, 12, "north", 7, 2); b.pier(34, 12, "north", 7, 2);
      b.spine([["exit:0", [26, 22]], ["exit:1", [4, 18], [52, 18]], [[14, 18], [14, 12]], [[34, 18], [34, 12]]]);
      b.rowAbove(18, 3, 46, [["gable-long-low", "slate-wood", "그물 창고", "fishing", "right"], ["gable-long", "blue-stone", "부두 창고", "storage", "right"], ["gable-long-low", "amber-wood", "생선 창고", "storage", "right"]], { gap: 2 });
      b.rowAbove(30, 3, 52, [["gable-long", "slate-wood", "창고", "storage", "right"], ["gable-house", "blue-stone", "어부 집", "fishing", "right"], ["gable-2f-lean", "timber-hall", "여관", "tavern", "right"], ["gable-long-low", "amber-wood", "생선 가게", "shop", "right"], ["gable-house", "slate-wood", "어부 집", "laundry", "right"]], { gap: 2 });
      b.spine([[[3, 30], [52, 30]], [[26, 22], [26, 30]]]);
      b.connect(); b.paintRoads();
      b.moorNear("나룻배", 17, 2, { purpose: "고깃배" }); b.moorNear("나룻배", 37, 2, { purpose: "고깃배" });
      b.tower(49, 9, "곶 등대");
      b.props([["빨랫줄", 8, 21, "생선 덕장", "덕장"], ["빨랫줄", 20, 21, "생선 덕장", "덕장"], ["빨랫줄", 40, 21, "생선 덕장", "덕장"], ["부두 술통", 12, 11, "절인 생선 통", "부두"], ["부두 상자", 16, 11, "부두 짐", "부두"], ["밧줄 뭉치", 32, 11, "부두 짐", "부두"], ["닻", 36, 11, "여벌 닻", "부두"], ["낚시 바구니", 30, 24, "낚시 바구니", "덕장"], ["장터 노점", 27, 23, "생선 좌판", "생선 장터"], ["나무 상자", 22, 24, "생선 상자", "생선 장터"], ["부두 술통", 23, 24, "절인 생선 통", "생선 장터"], ["장작 더미", 33, 24, "훈제 장작", "덕장"], ["돌등", 31, 21, "장터 등불", "생선 장터"], ["나무 상자", 38, 24, "부두 짐", "창고 마당"], ["부두 술통", 39, 24, "부두 짐", "창고 마당"], ["빨랫줄", 43, 22, "그물 말리기", "덕장"], ["장작 더미", 47, 24, "땔감", "창고 마당"], ["통나무 더미", 35, 26, "땔감", "창고 마당"], ["나무통", 33, 20, "물통", "창고 마당"], ["부두 상자", 41, 20, "부두 짐", "창고 마당"], ["부두 술통", 45, 20, "부두 짐", "창고 마당"], ["돌등", 38, 32, "길가 등불", "창고 마당"]]);
      b.yards();
      b.forest({ bands: { south: [2, 1.5], west: [1, 1], east: [2, 1] }, blobs: [[2, 40, 5, 3, 10], [54, 40, 5, 3, 10]], noise: 0.6 });
      b.edgeClumps(3, ["tree", "small-bush"]);
    },
  },
  {
    id: "town-snow-lodge", name: "눈매 산장 마을", category: "climate", tilesetId: SNOW, width: 46, height: 44, seed: 18301,
    purpose: "눈 쌓인 산 절벽 아래 사냥꾼 산장 마을. 큰 산장, 사냥꾼 오두막, 장작 헛간, 절벽 위 망루",
    note: "눈 덮인 절벽 발치에 커다란 사냥 산장과 오두막 셋이 모이고 가운데 모닥불과 장작더미가 있다. 돌계단으로 절벽에 오르면 망루 집이 설원을 내려다본다. 서쪽 눈길로 들어온다",
    build(b) {
      b.cliffs([{ points: [[0, 14], [20, 14], [22, 15], [45, 15]], height: 5, left: "open", right: "open" }]);
      b.stairs([[36, 15, 5]]);
      b.exits([{ side: "west", at: 30, meets: "설산 눈길(필드) 동쪽 출구" }]);
      b.put("모닥불", 22, 27, { purpose: "산장 모닥불", owner: "산장 마당" });
      b.spine([["exit:0", [10, 30], [40, 30]], [[36, 30], "stairs-bottom:0"], ["stairs-top:0", [36, 9], [20, 9]]]);
      b.rowAbove(30, 3, 43, [["gable-hall", "timber-hall", "사냥 산장", "tavern", "right"], ["gable-house", "slate-wood", "사냥꾼 오두막", "woodwork", "right"], ["gable-shed", "slate-wood", "장작 헛간", null, null]], { gap: 3 });
      b.homes([["gable-long-low", "slate-wood", 22, 3, "망루 집", "guard", "right"], ["gable-house", "amber-wood", 10, 34, "사냥꾼 오두막", "storage", "right"], ["gable-long-low", "blue-stone", 30, 35, "가죽 가게", "shop", "right"]], 4);
      b.connect(); b.paintRoads();
      b.props([["통나무 더미", 21, 28, "모닥불 통나무", "산장 마당"], ["통나무 더미", 23, 28, "모닥불 통나무", "산장 마당"], ["장작 더미", 20, 28, "산장 장작", "산장 마당"], ["가죽 천막", 26, 26, "사냥꾼 천막", "산장 마당"], ["무기 거치대", 17, 27, "사냥 창", "산장 마당"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1], south: [2, 1.5], east: [2, 1] }, blobs: [[2, 2, 5, 4, 10], [2, 42, 5, 3, 10]], noise: 0.6 });
      b.edgeClumps(3, ["tree", "small-bush"]);
    },
  },
  {
    id: "town-desert-oasis", name: "푸른샘 오아시스 마을", category: "climate", tilesetId: SAND, width: 54, height: 44, seed: 18401,
    fill: { flowerCap: 0, spotCap: 6, palette: { stands: 2.6 } },
    purpose: "사막 한가운데 샘을 둘러싼 오아시스 마을. 야자수 두른 샘, 물가 밭, 흙벽 집과 대상 천막, 낙타 우리",
    note: "모래 사막 한가운데 둥근 샘을 야자수가 두르고, 샘가에 물 대는 밭이 있다. 흙빛 집들이 샘을 보고 서며 동쪽엔 대상 천막 셋과 짐 상자, 울타리 친 낙타 우리. 서쪽과 동쪽 대상로로 나간다",
    build(b) {
      b.pond(24, 20, 7, 4.2, 0.14); b.smoothWater(); b.paintWater();
      b.exits([{ side: "west", at: 30, meets: "서쪽 대상로(필드) 동쪽 출구" }, { side: "east", at: 30, meets: "동쪽 대상로(필드) 서쪽 출구" }]);
      b.fenceRing(40, 4, 11, 8, 4, 2, "낙타 우리");
      b.spine([["exit:0", [12, 30], [42, 30], "exit:1"], [[44, 30], [44, 12], "yard-gate:0"], [[24, 30], [24, 26]]]);
      b.homes([["gable-house", "bright-plaster", 6, 6, "샘지기 집", "desert", "right"], ["gable-long", "amber-wood", 4, 17, "여관", "tavern", "right"], ["gable-twin", "bright-plaster", 8, 33, "잡화점", "shop", "right"], ["gable-long-low", "amber-wood", 20, 34, "물 긷는 집", "desert", "right"], ["gable-house", "bright-plaster", 32, 34, "대추야자 농가", "desert", "left"]], 5);
      b.connect(); b.paintRoads();
      b.gardenPlots(3, { near: 5, owner: "샘가 밭" });
      b.props([["천막", 38, 21, "대상 천막", "대상 야영지"], ["천막", 44, 17, "대상 천막", "대상 야영지"], ["천막", 47, 22, "대상 천막", "대상 야영지"], ["나무 상자", 42, 24, "대상 짐", "대상 야영지"], ["항아리", 43, 25, "물 항아리", "대상 야영지"], ["모닥불", 45, 26, "대상 모닥불", "대상 야영지"], ["나무통", 46, 8, "낙타 물통", "낙타 우리"], ["씨앗 자루", 42, 6, "여물 자루", "낙타 우리"]]);
      b.singlesWhere(770, 12, (x, y) => b.nearWater(x, y, 2) && !b.water.has(b.at(x, y)), 2, { shore: true });
      b.yards();
    },
  },
  {
    id: "town-desert-cliff", name: "붉은벼랑 굴집 마을", category: "climate", tilesetId: SAND, width: 50, height: 42, seed: 18501,
    fill: { flowerCap: 0, spotCap: 5, palette: { stands: 2.6 } },
    purpose: "사암 벼랑을 파고 들어간 굴집 마을. 두 단 벼랑 얼굴의 굴집, 벼랑 발치 우물 광장과 좌판",
    note: "두 단 사암 벼랑 얼굴을 파고 굴집 다섯이 문을 낸다. 아랫단 발치엔 우물 광장과 과일 좌판, 흙벽 집 둘. 돌계단으로 윗단 굴집과 망루에 오른다. 남쪽 모래길로 들어온다",
    build(b) {
      b.cliffs([{ points: [[0, 8], [49, 8]], height: 5, left: "open", right: "open" }, { points: [[0, 20], [22, 20], [24, 21], [49, 21]], height: 5, left: "open", right: "open" }]);
      b.stairs([[42, 21, 5], [6, 8, 5]]);
      for (const [x, cy, role] of [[8, 23, "벼랑 굴집"], [18, 23, "벼랑 굴집"], [30, 24, "벼랑 굴집"], [16, 11, "윗단 굴집"], [30, 11, "윗단 굴집"]]) b.cliffHouse(7, x, { role, wide: true, cliffY: cy });
      b.exits([{ side: "south", at: 24, meets: "남쪽 모래길(필드) 북쪽 출구" }]);
      b.pave(b.ellipseCells(24, 32, 6, 2.6, 0.06), "sand", { name: "우물 광장" });
      b.put("낮은 돌 우물", 23, 31, { purpose: "광장 우물" });
      b.spine([["exit:0", [24, 35]], [[3, 28], [46, 28]], [[24, 28], [24, 30]], [[42, 28], "stairs-bottom:0"], ["stairs-top:0", [42, 16], [6, 16]], [[6, 16], "stairs-bottom:1"], ["stairs-top:1", [6, 4], [20, 4]]]);
      b.homes([["gable-long-low", "bright-plaster", 5, 33, "흙벽 집", "desert", "right"], ["gable-house", "amber-wood", 36, 32, "향신료 가게", "shop", "left"]], 4);
      b.connect(); b.paintRoads();
      b.props([["과일 좌판", 19, 33, "대추야자 좌판", "우물 광장"], ["항아리", 28, 31, "물 항아리", "우물 광장"], ["항아리", 29, 33, "물 항아리", "우물 광장"], ["돌 석상", 22, 3, "벼랑 수호 석상", "윗단"]]);
      b.singlesWhere(770, 4, (x, y) => y > 30 && y < 40, 4);
      b.yards();
    },
  },
  {
    id: "town-desert-river", name: "갈대강 사막 강마을", category: "climate", tilesetId: SAND, width: 56, height: 42, seed: 18601,
    fill: { flowerCap: 0, spotCap: 5, palette: { stands: 2.6 } },
    purpose: "사막을 가르는 강가의 농촌. 강둑 따라 물 댄 밭과 야자수, 흙벽 집, 나무다리와 선착장",
    note: "사막 한가운데를 강이 동서로 흐르고 강둑을 따라 물 댄 밭과 야자수 줄이 푸르다. 강 북쪽엔 흙벽 집들과 곡물 창고, 남쪽엔 뱃사공 집과 선착장. 널빤지 다리로 건너고 북쪽·남쪽 모래길로 나간다",
    build(b) {
      b.waterWhere((x, y) => Math.abs(y - (22 + 1.4 * Math.sin(x / 7))) < 2.6);
      b.smoothWater(); b.paintWater();
      const pl = b.planks(28, 16, "south");
      b.exits([{ side: "north", at: 28, meets: "북쪽 모래길(필드) 남쪽 출구" }, { side: "south", at: 28, meets: "남쪽 모래길(필드) 북쪽 출구" }]);
      b.spine([["exit:0", [28, 14], pl.from], [pl.to, "exit:1"], [[4, 14], [52, 14]]]);
      b.rowAbove(14, 3, 52, [["gable-long", "bright-plaster", "곡물 창고", "storage", "right"], ["gable-house", "amber-wood", "농가", "desert", "right"], ["gable-twin", "bright-plaster", "여관", "tavern", "right"], ["gable-house", "amber-wood", "농가", "desert", "right"], ["gable-long-low", "bright-plaster", "농가", "laundry", "right"]], { gap: 3 });
      b.homes([["gable-house", "amber-wood", 10, 32, "뱃사공 집", "fishing", "right"], ["gable-long-low", "bright-plaster", 38, 32, "생선 가게", "shop", "left"]], 5);
      b.connect(); b.paintRoads();
      b.gardenPlots(5, { near: 4, owner: "강둑 밭" });
      b.pier(16, 26, "north", 2);
      b.singlesWhere(770, 14, (x, y) => b.nearWater(x, y, 2) && !b.water.has(b.at(x, y)), 2, { shore: true });
      b.props([["낚시 바구니", 18, 27, "낚시 자리", "선착장"], ["나무통", 14, 27, "미끼 통", "선착장"]]);
      b.yards();
    },
  },
  {
    id: "town-desert-bazaar", name: "황금모래 성벽 바자르", category: "climate", tilesetId: SAND, width: 64, height: 50, seed: 18701, plaza: [["sand", ["과일 좌판", "항아리", "나무통"]]], plazaSq: 2,
    fill: { flowerCap: 0, spotCap: 4, palette: { stands: 2.6 } },
    purpose: "돌 성벽으로 두른 사막 교역 도시의 바자르. 성문 안 큰 모래 광장에 노점 줄과 우물, 상인 집과 대상 숙소",
    note: "돌 성벽이 도시를 두르고 남쪽 성문으로 대상이 들어온다. 성문 안 큰 모래 광장엔 줄무늬 노점이 줄지어 서고 가운데 우물. 광장 북쪽 길에 상인 저택·대상 숙소·향신료 가게·환전소가, 광장 양옆에 대장간과 민가가 늘어서고 성벽 밑엔 대상 천막",
    build(b) {
      const ring = b.wallRing(2, 2, 60, 46, { name: "돌 성벽" });
      b.exits([{ side: "south", at: ring.gx, meets: "사막 대상로(필드) 북쪽 출구" }]);
      b.pave(b.rectCells(20, 22, 24, 9), "sand", { name: "바자르 광장" });
      b.put("광장 분수", 30, 25, { purpose: "바자르 분수" });
      b.spine([["exit:0", [ring.gx, 34]], [[10, 19], [54, 19]], [[20, 19], [20, 22]], [[44, 19], [44, 22]], [[10, 19], [10, 38]], [[54, 19], [54, 38]]]);
      b.rowAbove(19, 10, 54, [["gable-2f-long", "bright-plaster", "상인 저택", "garden", "right"], ["gable-long", "amber-wood", "대상 숙소", "tavern", "right"], ["gable-twin-step", "bright-plaster", "향신료 가게", "shop", "right"], ["gable-2f-porch", "amber-wood", "상인 저택", "storage", "right"], ["gable-long-low", "bright-plaster", "환전소", "shop", "right"]], { gap: 2 });
      b.homes([["gable-long-low", "amber-wood", 12, 22, "대장간", "smith", "right"], ["gable-long-low", "bright-plaster", 42, 10, "비단 가게", "shop", "right"], ["gable-house", "amber-wood", 49, 9, "민가", "desert", "left"], ["gable-long-low", "bright-plaster", 21, 34, "찻집", "tavern", "right"], ["gable-long-low", "amber-wood", 36, 34, "양탄자 가게", "shop", "left"], ["gable-house", "bright-plaster", 12, 31, "민가", "desert", "right"], ["gable-twin", "bright-plaster", 45, 22, "민가", "laundry", "left"], ["gable-house", "amber-wood", 46, 31, "민가", "desert", "left"]], 3);
      b.connect(); b.paintRoads(); b.plazaUnroad();
      b.props([["줄무늬 노점 빨강", 21, 23, "바자르 노점", "바자르 광장"], ["줄무늬 노점 파랑", 24, 23, "바자르 노점", "바자르 광장"], ["장터 노점", 27, 23, "바자르 노점", "바자르 광장"], ["줄무늬 노점 초록", 34, 23, "바자르 노점", "바자르 광장"], ["장터 노점", 37, 23, "바자르 노점", "바자르 광장"], ["줄무늬 노점 빨강", 40, 23, "바자르 노점", "바자르 광장"],
        ["줄무늬 노점 파랑", 21, 28, "바자르 노점", "바자르 광장"], ["줄무늬 노점 초록", 24, 28, "바자르 노점", "바자르 광장"], ["장터 노점", 27, 28, "바자르 노점", "바자르 광장"], ["줄무늬 노점 파랑", 34, 28, "바자르 노점", "바자르 광장"], ["장터 노점", 37, 28, "바자르 노점", "바자르 광장"], ["줄무늬 노점 빨강", 40, 28, "바자르 노점", "바자르 광장"],
        ["꽃 화단", 24, 25, "분수 화단", "바자르 광장"], ["꽃 화단", 36, 25, "분수 화단", "바자르 광장"], ["벤치", 27, 26, "분수 벤치", "바자르 광장"], ["벤치", 33, 26, "분수 벤치", "바자르 광장"],
        ["나무 상자", 13, 28, "대장간 쇠 상자", "대장간"], ["나무통", 15, 28, "담금질 물통", "대장간"], ["무기 거치대", 17, 27, "벼린 칼", "대장간"], ["항아리", 47, 28, "물 항아리", "민가"], ["나무 상자", 49, 28, "짐 상자", "민가"],
        ["항아리", 20, 9, "성벽 밑 물 항아리", "성벽 밑"], ["나무 상자", 30, 9, "성벽 밑 짐", "성벽 밑"], ["항아리", 38, 9, "성벽 밑 물 항아리", "성벽 밑"]]);
      b.yards();
    },
  },
  {
    id: "town-volcano-forge", name: "불모루 화산 대장간 마을", category: "climate", tilesetId: ASH, width: 54, height: 44, seed: 18801,
    purpose: "용암 강가의 대장장이 마을. 용암 열로 쇠를 달구는 대장간 셋, 무기 거치대 마당, 현무암 다리",
    note: "재 덮인 땅을 용암 강이 남북으로 가른다. 서쪽 강둑엔 대장간 셋과 무기 공방이 용암 열을 받고, 마당마다 무기 거치대와 광석 더미. 현무암 다리를 건너면 동쪽에 여관과 광부 집, 창고. 서쪽 재 길로 들어와 동쪽 광산 길로 나간다",
    build(b) {
      b.river({ width: 3, points: [[28, 0], [27, 12], [29, 26], [28, 43]] });
      b.smoothWater(); b.paintWater();
      b.bridgeNear(28, 21);
      b.exits([{ side: "west", at: 21, meets: "재 길(필드) 동쪽 출구" }, { side: "east", at: 21, meets: "광산 길(필드) 서쪽 출구" }]);
      b.spine([["exit:0", "bridge-west:0"], ["bridge-east:0", "exit:1"], [[4, 34], [24, 34]], [[14, 21], [14, 34]], [[34, 34], [50, 34]], [[40, 21], [40, 34]]]);
      b.rowAbove(21, 3, 25, [["gable-long-low", "slate-wood", "대장간", "smith", "right"], ["gable-long-low", "blue-stone", "대장간", "smith", "right"]], { gap: 3 });
      b.rowAbove(21, 32, 51, [["gable-long", "timber-hall", "여관", "tavern", "right"], ["gable-house", "slate-wood", "광부 집", "mine", "right"]], { gap: 3 });
      b.rowAbove(34, 3, 25, [["gable-hall", "slate-wood", "무기 공방", "smith", "right"], ["gable-shed", "slate-wood", "숯 창고", null, null]], { gap: 3 });
      b.rowAbove(34, 32, 51, [["gable-long-low", "blue-stone", "창고", "storage", "right"], ["gable-house", "timber-hall", "광부 집", "mine", "right"]], { gap: 3 });
      b.connect(); b.paintRoads();
      b.props([["무기 거치대", 22, 24, "벼린 칼", "대장간"], ["무기 거치대", 23, 24, "벼린 칼", "대장간"], ["돌 무더기", 20, 26, "쇠광석", "대장간"], ["나무통", 22, 27, "담금질 물통", "대장간"], ["벽 횃불", 6, 23, "대장간 불", "대장간"], ["해골", 48, 40, "짐승 뼈"]]);
      b.yards();
    },
  },
  {
    id: "town-volcano-refuge", name: "잿바람 화산 피난 마을", category: "climate", tilesetId: ASH, width: 50, height: 46, seed: 18901,
    purpose: "용암 웅덩이를 피해 벼랑 위에 성벽을 두른 피난 마을. 성벽 안 집들과 망루, 벼랑 아래 용암 들",
    note: "벼랑 아래 재 들엔 용암 웅덩이가 끓는다. 돌계단으로 벼랑에 오르면 돌 성벽을 두른 피난 마을이 있고 성문 안에 집 다섯과 우물, 망루 원탑. 남쪽 재 길로 들어온다",
    build(b) {
      b.cliffs([{ points: [[0, 28], [49, 28]], height: 5, left: "open", right: "open" }]);
      b.stairs([[24, 28, 5]]);
      b.pond(10, 39, 5, 2.8, 0.2); b.pond(40, 39, 5, 3, 0.2); b.smoothWater(); b.paintWater();
      const w = b.wallLine(0, 19, 50, { name: "피난 마을 성벽" });
      b.exits([{ side: "south", at: 24, meets: "재 길(필드) 북쪽 출구" }]);
      b.put("낮은 돌 우물", 24, 10, { purpose: "마을 우물" });
      b.spine([["exit:0", [24, 36], "stairs-bottom:0"], ["stairs-top:0", [w.gx, 27], [w.gx, 16]], [[4, 14], [46, 14]]]);
      b.rowAbove(14, 3, 46, [["gable-long", "slate-wood", "촌장 집", "guard", "right"], ["gable-house", "blue-stone", "피난민 집", "laundry", "right"], ["gable-long-low", "slate-wood", "곡물 창고", "storage", "right"], ["gable-house", "timber-hall", "피난민 집", "woodwork", "right"]], { gap: 3 });
      b.connect(); b.paintRoads();
      b.tower(44, 1, "망루");
      b.props([["돌 무더기", 16, 36, "굳은 용암 덩이"], ["해골", 34, 34, "짐승 뼈"], ["나무 이정표", 26, 42, "피난 마을 표지"], ["돌 석상", 8, 3, "피난 수호 석상", "기도터"], ["마법진", 10, 4, "기도터 마법진", "기도터"], ["돌등", 12, 3, "기도터 등불", "기도터"], ["돌등", 6, 3, "기도터 등불", "기도터"], ["장작 더미", 30, 3, "땔감", "성벽 안"], ["나무 상자", 32, 3, "비상 식량", "성벽 안"], ["술통", 33, 3, "물통", "성벽 안"]]);
      b.yards();
    },
  },
  {
    id: "town-autumn-maple", name: "단풍물 가을 마을", category: "climate", tilesetId: AUT, width: 52, height: 42, seed: 19001, plaza: [["cobble", ["벤치", "화분", "돌등"]]],
    purpose: "단풍 든 숲과 개울의 가을 마을. 개울 두 다리, 낙엽 쌓인 광장의 우물, 곶감 말리는 집들",
    note: "붉고 노란 단풍 숲에 둘러싸인 마을을 개울이 가른다. 나무다리 둘로 건너고 동쪽 광장 우물 둘레에 여관과 가게, 집마다 곶감 말리는 빨랫줄과 장작. 서쪽 단풍 길로 들어와 남쪽 길로 나간다",
    build(b) {
      b.river({ width: 3, points: [[18, 0], [17, 12], [19, 24], [17, 41]] });
      b.smoothWater(); b.paintWater();
      const y1 = b.bridgeNear(18, 10), y2 = b.bridgeNear(18, 30);
      b.exits([{ side: "west", at: y1, meets: "서쪽 단풍 길(필드) 동쪽 출구" }, { side: "south", at: 36, meets: "남쪽 길(필드) 북쪽 출구" }]);
      b.pave(b.ellipseCells(34, 20, 5, 3, 0.06), "cobble", { name: "우물 광장" });
      b.put("낮은 돌 우물", 33, 19, { purpose: "광장 우물" });
      b.spine([["exit:0", "bridge-west:0"], ["bridge-east:0", [30, y1], [33, 17]], [[34, 23], [36, 38], "exit:1"], ["bridge-east:1", [34, y2]], ["bridge-west:1", [4, y2]]]);
      b.homes([["gable-long", "amber-wood", 26, 3, "여관", "tavern", "right"], ["gable-twin", "bright-plaster", 41, 7, "잡화점", "shop", "left"], ["gable-house", "slate-wood", 41, 24, "곶감 집", "laundry", "left"], ["gable-long-low", "amber-wood", 22, 25, "대장간", "smith", "right"],
        ["gable-steep", "timber-hall", 5, 14, "촌장 집", "garden", "right"], ["gable-house", "amber-wood", 4, 32, "농가", "farm", "right"]], 5);
      b.connect(); b.paintRoads(); b.plazaUnroad();
      b.props([["벤치", 30, 22, "우물가 벤치", "우물 광장"], ["게시판", 38, 18, "마을 게시판", "우물 광장"]]);
      b.yards();
      b.forest({ bands: { north: [2, 1.5], east: [2, 1], south: [2, 1] }, blobs: [[2, 2, 5, 4, 10], [2, 40, 4, 3, 8]], noise: 0.6 });
      b.edgeClumps(4, ["tree", "round-bush"]);
      b.threes(348, 4);
    },
  },
  {
    id: "town-autumn-temple", name: "붉은단 가을 신전 마을", category: "climate", tilesetId: AUT, width: 52, height: 46, seed: 19101, plaza: [["cobble", ["돌등", "벤치", "화분"]]],
    purpose: "단풍 언덕 위 돌벽 교회와 석상 못을 모신 순례 마을. 돌계단 참배길, 등불 줄, 순례자 여관",
    note: "단풍 언덕 윗단에 돌벽 교회와 울타리 친 석상 못이 있고, 돌계단 참배길 양옆에 돌등이 줄지어 선다. 아랫단엔 순례자 여관·기념품 가게·약초 가게가 모인 광장. 남쪽 길로 들어온다",
    build(b) {
      b.cliffs([{ points: [[0, 20], [51, 20]], height: 5, left: "open", right: "open" }]);
      b.stairs([[25, 20, 5]]);
      b.landmark("church", 14, 4); b.landmark("shrine-pond", 30, 4);
      b.exits([{ side: "south", at: 26, meets: "남쪽 순례길(필드) 북쪽 출구" }]);
      b.pave(b.ellipseCells(26, 34, 7, 3, 0.05), "cobble", { name: "순례자 광장" });
      b.spine([["exit:0", [26, 38]], [[26, 31], "stairs-bottom:0"], ["stairs-top:0", [26, 16]], [[17, 16], [37, 16]]]);
      b.homes([["gable-long", "amber-wood", 6, 27, "순례자 여관", "tavern", "right"], ["gable-twin", "bright-plaster", 38, 27, "기념품 가게", "shop", "left"], ["gable-long-low", "slate-wood", 5, 38, "약초 가게", "herbs", "right"], ["gable-house", "timber-hall", 40, 38, "사제관", "garden", "left"]], 5);
      b.connect(); b.paintRoads(); b.plazaUnroad();
      for (const y of [27, 29, 31]) b.props([["돌등", 23, y, "참배길 등불", "참배길"], ["돌등", 29, y, "참배길 등불", "참배길"]]);
      b.yards();
      b.forest({ bands: { north: [1, 1], west: [2, 1], east: [2, 1], south: [2, 1] }, blobs: [[2, 44, 5, 3, 10], [50, 44, 5, 3, 10]], noise: 0.6 });
      b.edgeClumps(3, ["tree", "round-bush"]);
      b.threes(348, 4);
    },
  },
];
