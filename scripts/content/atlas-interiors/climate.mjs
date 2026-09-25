// 기후 변형 — 사막(사암 벽·사암 바닥), 설원(통나무 벽·모피), 화산(현무암 벽·현무암 바닥), 가을(추수) 실내 각 셋.
const T = (s) => `tibo-${s}`;

export default function climate(K) {
  // ── 사막 흙벽 집 ──
  {
    const r = K.room("atlas-interior-desert-house", "사막 · 사암 집", 20, 13, { wings: [{ x: 2, y: 5, w: 16, h: 5 }], door: { x: 9, y: 9 }, wall: "sandstone" });
    r.floor(1999);
    r.one(5, 3, 56).one(13, 3, 56).stamp(T("hanging-herbs"), 8, 3);
    r.bed(2, 5, "red").stamp(T("library-037"), 4, 5).stamp(T("bread-oven"), 6, 5);
    r.stamp(T("v7-1-0"), 14, 5).stamp(T("library-234"), 15, 5).stamp(T("library-234"), 16, 5).stamp(T("library-055"), 17, 5);
    r.rug("red", 7, 6, 11, 8).stamp(T("v7-1-3"), 9, 7).chair("w", 8, 7, "red").chair("e", 10, 7);
    r.mat(3, 8, 5, 9).stamp(T("library-233"), 4, 8).stamp(T("library-206"), 2, 9).stamp(T("library-206"), 17, 9).stamp(T("v7-2-0"), 13, 9);
    r.done({
      entry: [9, 10], keeper: [9, 6], targets: [[9, 6], [3, 7], [15, 8], [12, 7]],
      use: "사막 마을의 사암 집. 붉은 이불 침대에서 자고, 붉은 깔개 위 찻상에 방석 의자를 놓고 박하차를 마신다. 동쪽 저장 옹기·물 항아리에 물을 모으고, 작은 화덕에 납작빵을 굽는다",
      note: "사암 벽·사암 바닥 1999, 16×5칸. 커튼 창 둘·말린 약초 걸이, 붉은 이불 침대·접은 이불·작은 빵 화덕, 마개 도자기·저장 옹기 둘·목욕 물 항아리, 붉은 깔개 위 찻잔 탁자와 붉은 방석 의자·맞은편 의자, 짚 깔개와 뚜껑 등바구니, 선인장 화분 둘·푸른 띠 도자기",
    });
  }
  // ── 사막 향신료 시장 ──
  {
    const r = K.room("atlas-interior-desert-bazaar", "사막 · 향신료 시장 회랑", 22, 14, { wings: [{ x: 2, y: 5, w: 18, h: 6 }], door: { x: 10, y: 10 }, wall: "sandstone" });
    r.floor(1999);
    r.one(9, 3, 24).one(12, 3, 24).stamp(T("library-144"), 10, 3);
    r.stamp(T("medieval-market-stall"), 2, 4).stamp(T("medieval-market-stall"), 14, 4);
    r.table(3, 8, 5, 8).stamp(T("library-150"), 3, 8).stamp(T("v4-4-1"), 5, 8);
    r.table(14, 8, 16, 8).stamp(T("v4-5-1"), 14, 8).stamp(T("library-148"), 15, 8);
    r.stamp(T("fantasy-grain-sacks"), 7, 5).stamp(T("library-013"), 11, 5).stamp(T("library-014"), 12, 5).stamp(T("library-126"), 18, 5).stamp(T("library-129"), 19, 5);
    r.rug("red", 8, 8, 12, 10).rug("teal", 2, 10, 6, 10).rug("teal", 14, 10, 18, 10);
    r.object("bazaar-stall-counter", "천막 시장 좌판과 향신료 계산대", "furniture", 2, 4, 4, 5, ["시장", "좌판", "향신료", "사막"], "사막 시장·항구 장터 실내 회랑");
    r.done({
      entry: [10, 11], keeper: [4, 7], targets: [[4, 7], [15, 7], [4, 9], [15, 9], [10, 7]],
      use: "사막 성읍의 지붕 덮인 향신료 시장. 천막 좌판 둘 앞 계산대에서 상인이 말린 버섯·약초 단지·약병을 팔고, 손님은 계산대 앞에서 흥정한다. 가운데 곡식 자루와 밀가루·쌀 포대, 동쪽 진열 받침·가격 표지판",
      note: "사암 벽·사암 바닥 1999, 18×6칸. 횃불 둘·주점 간판, 천막 시장 좌판 4×3 둘, 한 줄 계산대(다리 앞면) 둘과 말린 버섯 쟁반·약초 단지·뚜껑 단지 한 쌍·약병 세 개, 식재료 자루 3×2·밀가루·쌀 포대, 상품 진열 받침·가격 표지판, 붉은 깔개·청록 깔개 둘",
    });
  }
  // ── 오아시스 여관 ──
  {
    const r = K.room("atlas-interior-desert-oasis-inn", "사막 · 오아시스 여관", 24, 15, { wings: [{ x: 2, y: 5, w: 20, h: 7 }], door: { x: 12, y: 11 }, wall: "sandstone" });
    r.floor(1999);
    r.one(6, 3, 56).one(18, 3, 56).stamp(T("library-144"), 12, 3);
    r.stamp(T("atlas-bath"), 10, 5).stamp(T("library-209"), 8, 5).stamp(T("library-209"), 14, 5);
    r.stamp(T("fantasy-ale-rack"), 2, 4).stamp(T("fantasy-bar-counter"), 2, 6).stool(3, 8, true).stool(5, 8, true);
    r.rug("red", 15, 6, 19, 11).stamp(T("v7-1-3"), 17, 7).chair("w", 16, 7, "red").chair("e", 18, 7).stamp(T("v7-3-3"), 17, 10).chair("w", 16, 10, "blue").chair("e", 18, 10);
    r.rug("teal", 7, 8, 11, 10).stamp(T("v7-2-3"), 9, 9).chair("w", 8, 9, "blue").chair("e", 10, 9);
    r.stamp(T("library-055"), 20, 5).stamp(T("library-055"), 21, 5).stamp(T("library-206"), 2, 11).stamp(T("library-206"), 21, 11);
    r.done({
      entry: [12, 12], keeper: [6, 6], targets: [[6, 6], [12, 8], [20, 8], [6, 10], [15, 5]],
      use: "사막 대상로 오아시스의 여관. 가운데 돌 욕조에 샘물을 받아 두 야자가 그늘을 드리우고, 서쪽 바에서 대추야자 술을 판다. 붉은·청록 깔개 위 낮은 찻상에 방석 의자를 놓고 대상들이 쉰다",
      note: "사암 벽·사암 바닥 1999, 20×7칸. 커튼 창 둘·주점 간판, 돌 욕조 4×3(샘물)·키 큰 야자 둘, 술통 선반·바 카운터 4×2·높은 걸상 둘, 붉은 깔개 위 찻잔 탁자·사과 접시 탁자와 방석 의자·맞은편 의자, 청록 깔개 위 두루마리 탁자와 의자 둘, 물 항아리 둘·선인장 화분 둘",
    });
  }
  // ── 설원 통나무 오두막 ──
  {
    const r = K.room("atlas-interior-snow-cabin", "설원 · 통나무 오두막", 18, 13, { wings: [{ x: 2, y: 5, w: 14, h: 5 }], door: { x: 8, y: 9 }, wall: "log" });
    r.floor(102);
    r.one(5, 3, 54).stamp(T("library-223"), 12, 3);
    r.stamp(T("fantasy-bed"), 2, 4).stamp(T("medieval-stone-fireplace"), 6, 4).stamp(T("library-235"), 9, 5).stamp(T("v8-1-2"), 11, 5);
    r.fur(5, 7, 9, 8).stamp(T("v7-1-3"), 7, 7).chair("w", 6, 7, "red").chair("e", 8, 7);
    r.table(12, 6, 13, 7).stamp(T("library-006"), 12, 6).stamp(T("library-036"), 13, 6).chair("n", 12, 5).chair("n", 13, 5).chair("s", 13, 8);
    r.stamp(T("coat-rack"), 15, 5).stamp(T("boot-rack"), 10, 9).stamp(T("library-194"), 2, 9).stamp(T("library-193"), 3, 9);
    r.object("fireside-fur-corner", "장작 벽난로·장작 받침대·흰 모피 찻자리", "furniture", 5, 4, 6, 5, ["설원", "벽난로", "모피", "오두막"], "설원 오두막·산장·사냥꾼 집 거실");
    r.done({
      entry: [8, 10], keeper: [10, 7], targets: [[10, 7], [5, 6], [15, 8], [4, 8]],
      use: "눈 덮인 산의 통나무 오두막. 벽난로 앞 흰 모피 위 찻상에서 몸을 녹이고, 목제 침대에 두꺼운 이불을 덮고 잔다. 동쪽 작은 탁자에서 무쇠 냄비 스튜를 먹고, 문가 옷걸이·신발 받침대에 털옷과 장화를 건다",
      note: "통나무 벽·널 바닥 102, 14×5칸. 창·사슴뿔 벽판, 목제 침대 3×3·장작 벽난로 3×3·장작 받침대·장작 바구니, 흰 모피 깔개 위 찻잔 탁자와 붉은 방석 의자·맞은편 의자, 탁자 2×2(다리 앞면)와 무쇠 냄비·물 피처·의자 셋, 옷걸이·신발 받침대·가죽 배낭·말린 침낭",
    });
  }
  // ── 설원 산장 여관 ──
  {
    const r = K.room("atlas-interior-snow-lodge-inn", "설원 · 산장 여관", 24, 15, { wings: [{ x: 2, y: 5, w: 20, h: 7 }], door: { x: 12, y: 11 }, wall: "log" });
    r.floor(102);
    r.stamp(T("library-223"), 6, 3).stamp(T("library-220"), 15, 3).one(8, 3, 24).one(14, 3, 24);
    r.stamp(T("medieval-stone-fireplace"), 10, 4).fur(9, 7, 13, 8).stamp(T("v7-1-3"), 11, 7).chair("w", 10, 7, "red").chair("e", 12, 7).stamp(T("library-235"), 13, 5);
    r.stamp(T("fantasy-ale-rack"), 18, 4).stamp(T("fantasy-bar-counter"), 17, 6).stool(17, 8, true).stool(19, 8, true);
    r.stamp(T("fantasy-dining-set"), 3, 6).stamp(T("library-025"), 14, 9).stool(13, 10).stool(15, 10);
    r.rug("teal", 6, 9, 10, 11).stamp(T("library-026"), 8, 9).stool(7, 10).stool(9, 10);
    r.stamp(T("boot-rack"), 4, 11).stamp(T("library-194"), 21, 11).stamp(T("coat-rack"), 2, 9).stamp(T("library-215"), 20, 11);
    r.done({
      entry: [12, 12], keeper: [21, 6], targets: [[21, 6], [11, 9], [6, 8], [16, 11], [21, 8]],
      use: "눈 덮인 고갯길의 산장 여관. 뒷벽 큰 벽난로 앞 흰 모피 찻자리에서 언 몸을 녹이고, 서쪽 긴 식탁·가운데 정사각 식탁·원형 식탁에서 스튜를 먹는다. 동쪽 바에서 데운 술을 받고, 문가에 장화와 털옷을 벗어 둔다",
      note: "통나무 벽·널 바닥 102, 20×7칸. 사슴뿔 벽판·직조 벽걸이·횃불 둘, 장작 벽난로 3×3·장작 받침대, 흰 모피 깔개 위 찻잔 탁자와 의자 둘, 술통 선반·바 카운터 4×2·높은 걸상 둘, 긴 식탁과 벤치 3×3, 원형 식탁과 걸상 둘, 청록 깔개 위 정사각 식탁과 걸상 둘, 신발 받침대·가죽 배낭·옷걸이·관목 화분",
    });
  }
  // ── 설원 교역소 ──
  {
    const r = K.room("atlas-interior-snow-trading-post", "설원 · 모피 교역소", 20, 13, { wings: [{ x: 2, y: 5, w: 16, h: 5 }], door: { x: 9, y: 9 }, wall: "log" });
    r.floor(102);
    r.one(6, 3, 54).stamp(T("library-223"), 10, 3).stamp(T("v6-1-0"), 14, 3);
    r.stamp(T("atlas-hide-frame"), 2, 5).stamp(T("library-119"), 4, 5).stamp(T("library-119"), 4, 6).stamp(T("library-200"), 6, 5).stamp(T("library-204"), 8, 5);
    r.table(10, 6, 13, 6).stamp(T("library-122"), 10, 6).stamp(T("balance-scale"), 12, 6).chair("n", 11, 5);
    r.stamp(T("fantasy-grain-sacks"), 15, 5).stamp(T("library-232"), 17, 8).stamp(T("library-196"), 16, 9);
    r.fur(3, 8, 7, 9).stamp(T("library-194"), 4, 8).stamp(T("library-193"), 6, 9).rug("red", 9, 7, 14, 9);
    r.object("fur-trade-wall", "가죽 건조틀·가죽 두루마리·장화·마구 걸이", "prop", 2, 5, 7, 2, ["교역소", "가죽", "모피", "설원"], "설원 교역소·가죽 공방·사냥꾼 집");
    r.done({
      entry: [9, 10], keeper: [12, 5], targets: [[12, 5], [11, 7], [4, 7], [15, 8]],
      use: "얼어붙은 강가의 모피 교역소. 사냥꾼이 가져온 가죽을 건조틀에 펴고, 한 줄 계산대 뒤 상인이 저울로 달아 동전을 셈해 준다. 흰 모피 더미 위에 배낭·침낭을 팔고, 동쪽엔 곡식 자루·상자·밧줄을 쌓았다",
      note: "통나무 벽·널 바닥 102, 16×5칸. 창·사슴뿔 벽판·메모 게시판, 가죽 건조틀 2×2(새 타일)·가죽 두루마리 둘·여행 장화·마구 걸이, 한 줄 계산대 4×1(다리 앞면)과 동전 계산 쟁반·상인 저울·상인 의자, 식재료 자루·쌓인 상자·밧줄, 흰 모피 깔개와 가죽 배낭·말린 침낭, 붉은 깔개",
    });
  }
  // ── 화산 드워프 대장간 ──
  {
    const r = K.room("atlas-interior-volcano-forge", "화산 · 드워프 대장간", 24, 15, { wings: [{ x: 2, y: 5, w: 20, h: 7 }], door: { x: 12, y: 11 }, wall: "basalt" });
    r.floor(1998);
    r.stamp(T("library-099"), 11, 3).stamp(T("library-108"), 12, 3).one(8, 3, 24).one(15, 3, 24);
    r.stamp(T("library-104"), 2, 5).stamp(T("fantasy-bellows"), 4, 5).stamp(T("library-098"), 7, 5).stamp(T("library-104"), 17, 5).stamp(T("fantasy-bellows"), 19, 5).stamp(T("library-098"), 16, 5);
    r.stamp(T("fantasy-anvil-bench"), 8, 6).stamp(T("medieval-smith-bench"), 13, 6).stamp(T("anvil"), 6, 8).stamp(T("anvil"), 17, 8);
    r.stamp(T("library-101"), 2, 8).stamp(T("fantasy-weapon-rack"), 2, 9).stamp(T("fantasy-weapon-rack"), 20, 9).stamp(T("library-100"), 4, 11).stamp(T("library-100"), 17, 11);
    r.rug("red", 9, 9, 15, 11).stamp(T("brazier"), 12, 9).stamp(T("library-105"), 10, 10);
    r.done({
      entry: [12, 12], keeper: [9, 8], targets: [[9, 8], [14, 8], [5, 7], [19, 8], [16, 10]],
      use: "화산 속 드워프 대장간. 용암 열로 달군 화덕 둘에 풀무를 밟고, 모루 작업대·대장장이 작업대에서 도끼와 투구를 두드린다. 담금질 물통에 식혀 양쪽 무기 거치대에 걸고, 금속 주괴를 쌓아 둔다",
      note: "현무암 벽·현무암 바닥 1998, 20×7칸. 쇠집게 걸이·가죽 앞치마 걸이·횃불 둘, 대장간 화덕 2×2 둘·풀무 3×2 둘·석탄 통 둘, 모루 작업대 3×2·대장장이 작업대 3×2·모루 둘, 담금질 물통·무기 거치대 2×3 둘·금속 주괴 더미 둘, 붉은 깔개 위 화로·쇠사슬",
    });
  }
  // ── 화산 불의 사당 ──
  {
    const r = K.room("atlas-interior-volcano-fire-shrine", "화산 · 불의 사당", 20, 14, { wings: [{ x: 2, y: 5, w: 16, h: 6 }], door: { x: 9, y: 10 }, wall: "basalt" });
    r.floor(1998);
    r.stamp(T("library-220"), 9, 3).one(5, 3, 24).one(13, 3, 24);
    r.stamp(T("fantasy-altar"), 8, 5).stamp(T("brazier"), 6, 5).stamp(T("brazier"), 12, 5).statue(4, 5).statue(14, 5);
    r.block(8, 7, [[381, 382, 383], [411, 412, 413], [441, 442, 443]], "upperTiles", "floor");
    r.stamp(T("brazier"), 6, 8).stamp(T("brazier"), 12, 8);
    r.mat(2, 8, 4, 10).mat(14, 8, 16, 10).stamp(T("v9-1-3"), 2, 5).stamp(T("v9-1-3"), 17, 5);
    r.rug("red", 9, 10, 9, 10);
    r.object("fire-circle-braziers", "제단·화로 넷과 불의 마법진", "landmark", 6, 5, 7, 5, ["사당", "화로", "마법진", "화산"], "화산 사당·마법사 탑·이교도 제단");
    r.done({
      entry: [9, 11], keeper: [9, 7], targets: [[9, 7], [3, 7], [16, 7], [7, 9], [11, 9]],
      use: "화산 기슭 불의 신 사당. 석상 둘이 지키는 제단 앞 붉은 마법진을 화로 넷이 두르고, 불의 사제가 마법진 위에서 의식을 치른다. 순례자는 양쪽 짚 깔개에 무릎 꿇고, 향로가 네 귀퉁이에 연기를 올린다",
      note: "현무암 벽·현무암 바닥 1998, 16×6칸. 직조 벽걸이·횃불 둘, 제단 3×2·석상 둘, 화로 넷, 마법진 381~443(위층, 통행), 짚 깔개 둘·향로 둘, 붉은 입구 깔개",
    });
  }
  // ── 화산 광부 집 ──
  {
    const r = K.room("atlas-interior-volcano-miner-house", "화산 · 광부의 집", 18, 13, { wings: [{ x: 2, y: 5, w: 14, h: 5 }], door: { x: 8, y: 9 }, wall: "basalt" });
    r.floor(1998);
    r.stamp(T("library-099"), 6, 3).one(10, 3, 54).one(3, 3, 24);
    r.bed(2, 5).stamp(T("library-039"), 3, 5).stamp(T("brazier"), 5, 6);
    r.table(7, 6, 8, 7).stamp(T("library-006"), 7, 6).stamp(T("library-135"), 8, 7).stool(6, 7).stool(9, 7);
    r.stamp(T("library-240"), 11, 5).stamp(T("library-105"), 12, 5).stamp(T("library-106"), 13, 5).stamp(T("library-100"), 14, 5);
    r.stamp(T("library-232"), 15, 8).stamp(T("library-061"), 14, 8).fur(2, 8, 5, 9).rug("red", 10, 7, 13, 9);
    r.done({
      entry: [8, 10], keeper: [8, 8], targets: [[8, 8], [4, 7], [12, 7], [3, 9]],
      use: "화산 광산촌의 광부 집. 침상 곁 화로로 몸을 데우고, 작은 탁자에서 무쇠 냄비 죽을 먹는다. 동쪽 벽에 사다리·쇠사슬·고철 상자·금속 주괴를 두고, 모피 깔개 위에서 광석 먼지를 턴다",
      note: "현무암 벽·현무암 바닥 1998, 14×5칸. 쇠집게 걸이·창·횃불, 침상·협탁·화로, 탁자 2×2(다리 앞면)와 무쇠 냄비·빈 잔·걸상 둘, 접이 사다리·쇠사슬 뭉치·고철 상자·금속 주괴 더미, 쌓인 상자·빗자루, 모피 깔개·붉은 깔개",
    });
  }
  // ── 가을 추수 곳간 ──
  {
    const r = K.room("atlas-interior-autumn-harvest-barn", "가을 · 추수 곳간", 24, 15, { wings: [{ x: 2, y: 5, w: 20, h: 7 }], door: { x: 12, y: 11 }, wall: "log" });
    r.floor(192);
    r.stamp(T("hanging-herbs"), 8, 3).stamp(T("library-228"), 12, 3).stamp(T("hanging-herbs"), 15, 3).one(5, 3, 54);
    r.stamp(T("medieval-hay-trough"), 2, 5).stamp(T("fantasy-grain-sacks"), 6, 5).stamp(T("library-013"), 9, 5).stamp(T("library-013"), 10, 5);
    r.stamp(T("library-015"), 11, 5).stamp(T("library-018"), 12, 5).stamp(T("library-019"), 13, 5).stamp(T("butter-churn"), 15, 5).stamp(T("library-127"), 16, 5).stamp(T("library-127"), 17, 5).stamp(T("medieval-handcart"), 18, 4);
    r.mat(3, 8, 9, 10).mat(14, 8, 18, 10).stamp(T("library-015"), 4, 9).stamp(T("library-015"), 5, 9).stamp(T("library-019"), 6, 9).stamp(T("library-018"), 15, 9).stamp(T("library-018"), 16, 9).stamp(T("library-130"), 17, 9);
    r.stamp(T("fantasy-grain-sacks"), 10, 8).stamp(T("library-240"), 2, 9).stamp(T("library-235"), 20, 9).stamp(T("library-061"), 21, 7);
    r.object("harvest-produce-row", "감자·당근·양배추 상자와 곡식 자루", "prop", 6, 5, 8, 2, ["추수", "곡식", "채소", "곳간"], "곳간·농가·시장 창고 뒷벽");
    r.done({
      entry: [12, 12], keeper: [12, 7], targets: [[12, 7], [2, 7], [20, 7], [6, 11], [17, 11]],
      use: "가을 추수 뒤의 곳간. 뒷벽에 여물통·곡식 자루·밀가루 포대·감자·당근·양배추 상자를 가득 쌓고, 짚 깔개 두 자리에 널어 말린다. 손수레로 밭에서 실어 오고, 짚 화환과 말린 약초를 걸어 풍년을 빈다",
      note: "통나무 벽·흙바닥 192, 20×7칸. 말린 약초 걸이 둘·짚 화환·창, 마구간 먹이통 3×2·식재료 자루 3×2·밀가루 포대 둘, 감자 바구니·당근 상자·양배추 상자·버터 교반통·빈 농산물 상자 둘·목제 손수레 3×3, 짚 깔개 둘 위 감자 둘·양배추, 당근 둘·장바구니(한 줄씩 널어 말림), 접이 사다리·장작 받침대·빗자루",
    });
  }
  // ── 가을 사과주 집 ──
  {
    const r = K.room("atlas-interior-autumn-cider-house", "가을 · 사과주 집", 20, 13, { wings: [{ x: 2, y: 5, w: 16, h: 5 }], door: { x: 9, y: 9 }, wall: "log" });
    r.floor(102);
    r.stamp(T("library-228"), 9, 3).stamp(T("library-144"), 11, 3).one(6, 3, 54).one(14, 3, 54);
    r.stamp(T("medieval-wine-press"), 2, 4).stamp(T("library-229"), 5, 5).stamp(T("library-229"), 6, 5).stamp(T("library-133"), 7, 5).stamp(T("fantasy-ale-rack"), 14, 5);
    r.rug("red", 8, 6, 12, 8).stamp(T("v7-3-3"), 10, 7).stool(9, 7).stool(11, 7);
    r.stamp(T("library-025"), 14, 8).stool(13, 9).stool(15, 9).stamp(T("library-127"), 17, 8).stamp(T("library-018"), 17, 9);
    r.mat(2, 8, 5, 9).stamp(T("library-015"), 3, 8).stamp(T("library-130"), 4, 9);
    r.done({
      entry: [9, 10], keeper: [7, 7], targets: [[7, 7], [12, 6], [16, 7], [6, 9]],
      use: "사과 과수원 곁 사과주 집. 서쪽 압착기로 사과를 짜 둥근 통·맥주통에 담그고, 술통 선반에 눕혀 익힌다. 붉은 깔개 위 사과 접시 탁자와 원형 식탁에 걸상을 놓고 햇사과주를 판다",
      note: "통나무 벽·널 바닥 102, 16×5칸. 짚 화환·주점 간판·창 둘, 포도 압착기 3×3(사과 압착)·둥근 통 둘·받침대 맥주통·술통 선반 3×2, 붉은 깔개 위 사과 접시 탁자와 걸상 둘, 원형 식탁과 걸상 둘, 빈 농산물 상자·당근 상자, 짚 깔개와 감자 바구니·장바구니",
    });
  }
  // ── 가을 추수 잔치 ──
  {
    const r = K.room("atlas-interior-autumn-harvest-feast", "가을 · 추수 잔치 마을회관", 24, 15, { wings: [{ x: 2, y: 5, w: 20, h: 7 }], door: { x: 12, y: 11 } });
    r.floor(72);
    r.stamp(T("library-228"), 4, 3).stamp(T("hanging-herbs"), 7, 3).stamp(T("hanging-herbs"), 15, 3).stamp(T("library-228"), 19, 3);
    r.stamp(T("medieval-stone-fireplace"), 10, 4).stamp(T("fantasy-grain-sacks"), 2, 5).stamp(T("library-015"), 5, 5).stamp(T("library-019"), 18, 5).stamp(T("library-018"), 19, 5).stamp(T("library-127"), 20, 5);
    r.rug("red", 5, 6, 18, 9);
    for (const x0 of [6, 14]) {
      r.stamp(T("medieval-banquet-table"), x0, 7);
      for (let x = x0; x < x0 + 4; x++) r.chair("n", x, 6).chair("s", x, 9);
    }
    r.mat(2, 10, 8, 11).stamp(T("lute"), 3, 10).stamp(T("library-180"), 5, 10).stamp(T("library-174"), 7, 10);
    r.stamp(T("medieval-handcart"), 19, 9).stamp(T("library-209"), 16, 10);
    r.done({
      entry: [12, 12], keeper: [12, 10], targets: [[12, 10], [2, 8], [21, 8], [9, 11], [15, 11]],
      use: "가을 추수 잔치가 열린 마을회관. 벽난로 앞 붉은 깔개 위 연회 식탁 둘에 마을 사람 열여섯이 둘러앉아 햇곡식으로 잔치를 벌이고, 서쪽 짚 깔개에서 악사가 류트·실로폰·호른을 연주한다. 벽엔 짚 화환과 말린 약초, 구석엔 채소 상자와 손수레",
      note: "크림 벽·나무 바닥 72, 20×7칸. 짚 화환 둘·말린 약초 걸이 둘, 장작 벽난로 3×3·식재료 자루 3×2·감자·양배추·당근·빈 농산물 상자, 붉은 깔개 위 연회 식탁 4×2 둘과 탁자를 보는 의자 열여섯, 짚 깔개 악사 자리(류트·나무 실로폰·걸상 위 호른), 목제 손수레 3×3·야자",
    });
  }
}
