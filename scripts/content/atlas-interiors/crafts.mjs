// 공방 — 대장간, 목공소, 유리 공방, 가죽 공방, 직조 공방, 물방앗간, 풍차 1·2층(계단 짝), 양조장, 빵 공방.
const T = (s) => `tibo-${s}`;

export default function crafts(K) {
  // ── 대장간 ──
  {
    const r = K.room("atlas-interior-blacksmith", "공방 · 대장간", 22, 14, { wings: [{ x: 2, y: 5, w: 18, h: 6 }], door: { x: 10, y: 10 }, wall: "dark-stone" });
    r.floor(192);
    r.stamp(T("library-099"), 8, 3).stamp(T("library-108"), 12, 3).one(6, 3, 24).one(15, 3, 24).stamp(T("library-222"), 17, 3);
    r.stamp(T("library-104"), 2, 5).stamp(T("fantasy-bellows"), 4, 5).stamp(T("library-098"), 7, 5);
    r.stamp(T("medieval-smith-bench"), 9, 6).stamp(T("library-103"), 12, 7);
    r.stamp(T("fantasy-anvil-bench"), 14, 5).stamp(T("grindstone"), 18, 5);
    r.stamp(T("library-101"), 2, 8).stamp(T("anvil"), 5, 8).stamp(T("library-105"), 7, 9);
    r.rug("red", 12, 9, 16, 10).table(13, 9, 15, 9).stamp(T("library-107"), 13, 9).stamp(T("library-128"), 15, 9).stool(14, 10);
    r.stamp(T("fantasy-weapon-rack"), 18, 8).stamp(T("library-100"), 8, 10);
    r.object("smithy-forge-corner", "대장간 화덕·풀무·석탄 통", "furniture", 2, 5, 6, 2, ["대장간", "화덕", "풀무", "쇠"], "대장간·무기점 뒤 작업장 구석");
    r.done({
      entry: [10, 11], keeper: [8, 7], targets: [[8, 7], [14, 8], [3, 7], [17, 10], [12, 6]],
      use: "마을 대장간. 뒷벽 화덕에 풀무로 바람을 넣어 쇠를 달구고, 모루·대장장이 작업대에서 두드려 담금질 물통에 식힌다. 숫돌로 날을 세우고, 오른쪽 붉은 깔개 앞 계산대에서 손님에게 무기를 판다",
      note: "어두운 석벽·흙바닥 192, 18×6칸. 쇠집게 걸이·가죽 앞치마 걸이·횃불 둘·교차 연습검, 작은 대장간 화덕 2×2·풀무 3×2·석탄 통, 대장장이 작업대 3×2·망치 그루터기, 모루 작업대 3×2·숫돌 2×2, 담금질 물통·모루·쇠사슬, 한 줄 계산대(다리 앞면)와 리벳 상자·저울추 상자·걸상, 무기 거치대·금속 주괴 더미",
    });
  }
  // ── 목공소 ──
  {
    const r = K.room("atlas-interior-carpenter", "공방 · 목공소", 20, 13, { wings: [{ x: 2, y: 5, w: 16, h: 5 }], door: { x: 9, y: 9 }, wall: "log" });
    r.floor(102);
    r.stamp(T("library-088"), 2, 3).stamp(T("library-089"), 5, 3).one(9, 3, 54).one(13, 3, 54);
    r.table(3, 6, 6, 7).stamp(T("library-090"), 3, 6).stamp(T("library-091"), 4, 6).stamp(T("library-095"), 6, 6).stamp(T("library-096"), 5, 7).stool(7, 6);
    r.stamp(T("library-086"), 8, 5).stamp(T("library-087"), 10, 5).stamp(T("library-092"), 12, 5).stamp(T("library-092"), 12, 6).stamp(T("library-240"), 14, 5).stamp(T("library-235"), 15, 5).stamp(T("library-061"), 17, 5);
    r.stamp(T("library-094"), 9, 7).stamp(T("library-093"), 8, 8).stamp(T("medieval-handcart"), 13, 7).stamp(T("v3-1-1"), 17, 8);
    r.mat(2, 8, 6, 9);
    r.object("carpenter-bench", "목수 작업대(대패·끌·풀·직각자)와 걸상", "furniture", 3, 6, 5, 2, ["목공", "작업대", "공구", "나무"], "목공소·조선소·수리 공방");
    r.done({
      entry: [9, 10], keeper: [7, 7], targets: [[7, 7], [11, 7], [16, 7], [3, 8]],
      use: "마을 목공소. 서쪽 작업대에서 대패·끌로 나무를 다듬고(걸상에 앉음), 바이스·톱·각목 더미가 뒷벽에 늘어섰다. 톱질 받침에서 판자를 켜고, 다 만든 손수레와 서랍장을 동쪽에 둔다. 짚 깔개에 대팻밥이 쌓인다",
      note: "통나무 벽·널 바닥 102, 16×5칸. 공구 벽판·망치 걸이·창 둘, 작업대 4×2(다리 앞면)와 대패·끌꽂이·풀 단지·직각자, 걸상, 나무 바이스·목공 톱·각목 더미 둘·접이 사다리·장작 받침대·빗자루, 톱질 받침·대팻밥 바구니, 목제 손수레 3×3·세 칸 서랍장, 짚 깔개",
    });
  }
  // ── 유리 공방 ──
  {
    const r = K.room("atlas-interior-glassblower", "공방 · 유리 공방", 20, 13, { wings: [{ x: 2, y: 5, w: 16, h: 5 }], door: { x: 9, y: 9 }, wall: "stone-brick" });
    r.floor(42);
    r.one(6, 3, 54).stamp(T("library-225"), 10, 3).stamp(T("library-225"), 11, 3).one(16, 3, 24);
    r.stamp(T("library-104"), 2, 5).stamp(T("library-098"), 4, 5).stamp(T("brazier"), 4, 6);
    r.table(7, 6, 9, 7).stamp(T("library-148"), 7, 6).stamp(T("library-036"), 9, 6).stamp(T("library-135"), 8, 7).chair("n", 8, 5);
    r.stamp(T("v4-2-0"), 12, 4).shelf(15, 5).shelf(16, 5);
    r.stamp(T("library-141"), 12, 8).stamp(T("library-141"), 13, 8).stamp(T("library-142"), 14, 8).stamp(T("library-147"), 16, 8);
    r.stamp(T("v7-1-0"), 2, 8).stamp(T("v7-2-0"), 3, 9).stamp(T("v7-3-0"), 4, 9);
    r.rug("red", 6, 8, 10, 9);
    r.done({
      entry: [9, 10], keeper: [8, 8], targets: [[8, 8], [3, 7], [14, 7], [11, 6]],
      use: "항구 성읍의 유리 공방. 서쪽 화덕에서 유리를 녹여 탁자 뒤 장인이 병과 잔을 불어 만들고, 완성품은 동쪽 물약 진열장·선반에 세운다. 병 상자·코르크 바구니에 담아 약방과 주점에 보낸다",
      note: "석벽·돌바닥 42, 16×5칸. 창·작은 벽 선반 둘·횃불, 대장간 화덕 2×2(유리 화덕)·석탄 통·화로, 탁자 3×2(다리 앞면)와 약병 세 개·물 피처·빈 잔, 장인 의자(남쪽을 봄), 물약 진열장 3×3·유리 선반 둘, 병 상자 둘·코르크 바구니·증류 유리병 받침, 마개 도자기·푸른 띠 도자기·표찰 도자기, 붉은 깔개",
    });
  }
  // ── 가죽 공방 ──
  {
    const r = K.room("atlas-interior-leatherworks", "공방 · 가죽 공방", 20, 13, { wings: [{ x: 2, y: 5, w: 16, h: 5 }], door: { x: 9, y: 9 }, wall: "log" });
    r.floor(192);
    r.stamp(T("library-108"), 10, 3).one(13, 3, 24).one(6, 3, 24).stamp(T("library-223"), 15, 3);
    r.stamp(T("atlas-hide-frame"), 2, 5).stamp(T("atlas-hide-frame"), 4, 5).stamp(T("fantasy-water-tub"), 6, 5);
    r.table(11, 6, 13, 7).stamp(T("library-113"), 11, 6).stamp(T("library-120"), 13, 6).stamp(T("library-112"), 12, 7).chair("n", 12, 5).stool(10, 7);
    r.stamp(T("library-119"), 15, 5).stamp(T("library-204"), 17, 5).stamp(T("library-203"), 15, 8).stamp(T("library-200"), 2, 9).stamp(T("library-194"), 4, 9);
    r.mat(5, 8, 8, 9).rug("red", 11, 8, 13, 9);
    r.object("tanning-frames", "가죽 건조틀 둘과 무두질 통", "furniture", 2, 5, 7, 2, ["가죽", "무두질", "건조틀", "사냥"], "가죽 공방·사냥꾼 오두막 뒷벽");
    r.done({
      entry: [9, 10], keeper: [12, 8], targets: [[12, 8], [3, 7], [16, 7], [7, 7]],
      use: "성읍 가죽 공방. 서쪽 건조틀 둘에 편 가죽을 말리고 물통에서 무두질한다. 가운데 탁자에서 장인이 가위·구두 골로 장화와 안장을 만들고, 동쪽 가죽 두루마리·마구 걸이·안장 받침대에 완성품을 건다",
      note: "통나무 벽·흙바닥 192, 16×5칸. 가죽 앞치마 걸이·횃불 둘·사슴뿔 벽판, 가죽 건조틀 2×2 둘(새 타일)·물통 3×2, 탁자 3×2(다리 앞면)와 가위 쟁반·구두 골·바늘방석, 장인 의자·걸상, 가죽 두루마리·마구 걸이·안장 받침대·여행 장화·가죽 배낭, 짚 깔개·붉은 깔개",
    });
  }
  // ── 직조 공방 ──
  {
    const r = K.room("atlas-interior-weaver", "공방 · 직조 공방", 22, 14, { wings: [{ x: 2, y: 5, w: 18, h: 6 }], door: { x: 10, y: 10 } });
    r.floor(72);
    r.one(6, 3, 56).one(16, 3, 56).stamp(T("library-217"), 9, 3);
    r.stamp(T("medieval-loom"), 2, 4).stamp(T("loom"), 6, 5).stamp(T("v11-1-2"), 9, 5).stamp(T("thread-rack"), 12, 5).stamp(T("library-109"), 13, 5).stamp(T("library-109"), 14, 5).stamp(T("v4-5-0"), 16, 6);
    r.table(5, 8, 8, 9).stamp(T("library-112"), 5, 8).stamp(T("library-113"), 6, 8).stamp(T("library-114"), 8, 9).chair("n", 7, 7).chair("n", 8, 7).stool(4, 9);
    r.stamp(T("library-117"), 14, 9).stamp(T("library-116"), 11, 9).stamp(T("library-118"), 17, 9).stamp(T("library-111"), 18, 8).stamp(T("sewing-basket"), 13, 8);
    r.rug("teal", 11, 7, 17, 8);
    r.object("weaving-looms", "대형 베틀·작은 베틀·물레", "furniture", 2, 4, 9, 3, ["직조", "베틀", "물레", "천"], "직조 공방·재단사·농가 작업방");
    r.done({
      entry: [10, 11], keeper: [7, 10], targets: [[7, 10], [5, 7], [15, 7], [19, 10], [11, 7]],
      use: "성읍 직조 공방. 뒷벽 대형 베틀·작은 베틀에서 천을 짜고 물레로 실을 잣는다. 가운데 재단 탁자에 둘러앉아 바늘·가위로 천을 자르고, 동쪽 천 두루마리 선반·천 진열대에 완성한 천을 판다",
      note: "크림 벽·나무 바닥 72, 18×6칸. 커튼 창 둘·풍경화, 대형 베틀 3×3·작은 베틀 2×2·물레 2×2·실패 걸이·천 두루마리 선반 둘·천 진열대 3×1, 재단 탁자 4×2(다리 앞면)와 바늘방석·가위 쟁반·단추 상자, 의자 둘·걸상, 실뭉치 더미·뜨개질 바구니·접은 천·재봉 마네킹·반짇고리, 청록 깔개",
    });
  }
  // ── 물방앗간 ──
  {
    const r = K.room("atlas-interior-watermill", "공방 · 물방앗간", 22, 14, { wings: [{ x: 2, y: 5, w: 18, h: 6 }], door: { x: 10, y: 10 }, wall: "log" });
    r.floor(102);
    r.one(6, 3, 54).one(12, 3, 54).stamp(T("v6-2-0"), 8, 3).one(16, 3, 24);
    r.stamp(T("library-232"), 2, 5).stamp(T("medieval-grain-mill"), 4, 6).stamp(T("medieval-grain-mill"), 8, 6);
    r.stamp(T("fantasy-grain-sacks"), 14, 5).stamp(T("library-013"), 17, 5).stamp(T("library-014"), 18, 5).stamp(T("library-013"), 19, 5);
    r.table(11, 8, 12, 8).stamp(T("library-122"), 11, 8).chair("s", 11, 9).stamp(T("medieval-handcart"), 15, 8).stamp(T("library-235"), 2, 9).stamp(T("library-061"), 19, 8);
    r.mat(3, 8, 9, 8).rug("red", 11, 9, 13, 10);
    r.object("mill-sacks", "식재료 자루와 밀가루·쌀 포대", "prop", 14, 5, 6, 2, ["방앗간", "곡식", "포대", "창고"], "방앗간·곡물 창고·빵집 뒷방");
    r.done({
      entry: [10, 11], keeper: [12, 9], targets: [[12, 9], [6, 9], [13, 6], [18, 7]],
      use: "강가 물방앗간. 물레바퀴가 돌리는 손맷돌 둘에서 밀을 빻고, 짚 깔개 위에 가루를 받는다. 방앗간 주인은 작은 탁자에서 삯을 세고, 동쪽에 곡식 자루·밀가루 포대를 쌓아 손수레로 나른다",
      note: "통나무 벽·널 바닥 102, 18×6칸. 창 둘·강 지도 액자·횃불, 쌓인 상자·손맷돌 2×2 둘, 식재료 자루 3×2·밀가루 포대 둘·쌀 포대, 한 줄 탁자와 동전 계산 쟁반·의자, 목제 손수레 3×3·장작 받침대·빗자루, 짚 깔개·붉은 깔개",
    });
  }
  // ── 풍차 1층 ──
  {
    const r = K.room("atlas-interior-windmill-1f", "공방 · 풍차 1층", 18, 14, { wings: [{ x: 2, y: 5, w: 14, h: 6 }], door: { x: 8, y: 10 }, wall: "log" });
    r.floor(102);
    r.one(5, 3, 54).one(9, 3, 54).stairsUp(15, 5);
    r.stamp(T("medieval-grain-mill"), 3, 6).stamp(T("fantasy-grain-sacks"), 7, 5).stamp(T("library-013"), 10, 5).stamp(T("library-014"), 11, 5);
    r.stamp(T("library-232"), 2, 9).stamp(T("library-127"), 3, 10).mat(5, 8, 7, 9).stamp(T("library-130"), 6, 8);
    r.table(11, 8, 12, 8).stamp(T("library-128"), 11, 8).chair("s", 12, 9).stamp(T("library-061"), 15, 8);
    r.done({
      entry: [8, 11], keeper: [11, 9], targets: [[11, 9], [14, 6], [4, 9], [10, 7]],
      use: "언덕 풍차의 1층. 날개가 돌리는 손맷돌에서 가루를 받아 짚 깔개 위 장바구니에 담고, 식재료 자루·포대를 쌓아 둔다. 동벽 계단으로 2층 맷돌방에 오른다",
      note: "통나무 벽·널 바닥 102, 14×6칸. 창 둘, 동벽 3칸 폭 오르막 141|111|171(x=13~15) → 2층, 손맷돌 2×2·식재료 자루 3×2·밀가루·쌀 포대, 쌓인 상자·빈 농산물 상자·짚 깔개·장바구니, 한 줄 탁자와 저울추 상자·의자, 빗자루",
    });
  }
  // ── 풍차 2층 ──
  {
    const r = K.room("atlas-interior-windmill-2f", "공방 · 풍차 2층 맷돌방", 18, 14, { wings: [{ x: 2, y: 5, w: 14, h: 6 }], door: { x: 8, y: 10 }, wall: "log" });
    r.floor(102).closeDoor(8, 11);
    r.one(5, 3, 54).one(10, 3, 54).stairsDown(14, 5);
    r.stamp(T("medieval-grain-mill"), 3, 5).stamp(T("medieval-grain-mill"), 7, 5).stamp(T("library-013"), 11, 5).stamp(T("library-014"), 12, 5).stamp(T("library-013"), 13, 5);
    r.stamp(T("fantasy-grain-sacks"), 2, 9).stamp(T("library-232"), 15, 8).stamp(T("library-240"), 6, 9).mat(8, 8, 12, 10).stamp(T("library-130"), 10, 9);
    r.done({
      entry: [14, 6], targets: [[5, 8], [13, 9], [9, 7]],
      use: "풍차 2층 맷돌방. 날개 축이 돌리는 맷돌 둘이 나란히 돌아가고, 빻은 가루를 포대에 담아 짚 깔개에 모았다가 1층으로 내린다. 1층 계단 가운데(x=14)의 1×1 내리막으로 드나든다",
      note: "통나무 벽·널 바닥 102, 14×6칸. 남쪽 문은 천장으로 닫음, 창 둘, 1×1 내리막 474, 손맷돌 2×2 둘·밀가루 포대 둘, 식재료 자루 3×2·쌓인 상자·접이 사다리, 짚 깔개와 장바구니",
    });
  }
  // ── 양조장 ──
  {
    const r = K.room("atlas-interior-brewery", "공방 · 양조장", 24, 15, { wings: [{ x: 2, y: 5, w: 20, h: 7 }], door: { x: 12, y: 11 }, wall: "stone-brick" });
    r.floor(42);
    r.stamp(T("library-144"), 12, 3).one(10, 3, 24).one(14, 3, 24);
    r.stamp(T("medieval-brew-vat"), 2, 4).stamp(T("medieval-brew-vat"), 6, 4).stamp(T("medieval-wine-press"), 15, 4).stamp(T("fantasy-ale-rack"), 19, 5);
    r.stamp(T("library-133"), 10, 5).stamp(T("library-133"), 11, 5).stamp(T("library-229"), 13, 5).stamp(T("library-229"), 14, 5);
    r.stamp(T("fantasy-grain-sacks"), 2, 9);
    r.table(9, 8, 11, 9).stamp(T("library-136"), 9, 8).stamp(T("library-135"), 11, 8).chair("n", 10, 7).stool(8, 9).stool(12, 9);
    r.stamp(T("library-141"), 15, 9).stamp(T("library-141"), 16, 9).stamp(T("library-142"), 17, 9).stamp(T("library-232"), 20, 9);
    r.rug("red", 14, 7, 19, 8).rug("teal", 5, 10, 8, 11);
    r.object("brew-vats", "대형 양조통 둘", "furniture", 2, 4, 7, 3, ["양조", "양조통", "맥주", "술"], "양조장·수도원 양조실·주점 뒷방");
    r.done({
      entry: [12, 12], keeper: [10, 10], targets: [[10, 10], [5, 7], [18, 7], [21, 10], [12, 7]],
      use: "성읍 양조장. 서쪽 대형 양조통 둘에서 맥주를 발효시키고, 동쪽 포도 압착기로 포도주를 짠다. 받침대 맥주통과 둥근 통에 담아 술통 선반에 눕히고, 가운데 시음 탁자에서 맛을 본다. 병 상자에 담아 주점에 판다",
      note: "석벽·돌바닥 42, 20×7칸. 주점 간판·횃불 둘, 대형 양조통 3×3 둘·포도 압착기 3×3·술통 선반 3×2, 받침대 맥주통 둘·둥근 통 둘, 식재료 자루 3×2, 시음 탁자 3×2(다리 앞면)와 맥주잔 쟁반·빈 잔, 의자·걸상 둘, 병 상자 둘·코르크 바구니·쌓인 상자, 붉은·청록 깔개",
    });
  }
  // ── 빵 공방 ──
  {
    const r = K.room("atlas-interior-bakery-workshop", "공방 · 빵 공방", 20, 13, { wings: [{ x: 2, y: 5, w: 16, h: 5 }], door: { x: 9, y: 9 } });
    r.floor(42);
    r.stamp(T("library-009"), 7, 3).stamp(T("library-012"), 10, 3).stamp(T("library-011"), 14, 3);
    r.stamp(T("medieval-bread-oven"), 2, 4).stamp(T("bread-oven"), 5, 5);
    r.table(7, 6, 10, 7).stamp(T("library-001"), 7, 6).stamp(T("library-002"), 9, 6).stamp(T("library-004"), 8, 7).stamp(T("library-003"), 10, 7);
    r.stamp(T("fantasy-cupboard"), 12, 4).stamp(T("butter-churn"), 14, 5).stamp(T("library-013"), 15, 5).stamp(T("library-013"), 16, 5).stamp(T("library-023"), 17, 5);
    r.stamp(T("fantasy-prep-table"), 13, 8).stamp(T("library-031"), 2, 8).stamp(T("library-065"), 17, 9);
    r.rug("red", 6, 8, 11, 9);
    r.object("bakery-oven-bench", "석조 빵 화덕과 반죽 작업대", "furniture", 2, 4, 9, 4, ["빵", "화덕", "반죽", "부엌"], "빵집·성 부엌·수도원 부엌");
    r.done({
      entry: [9, 10], keeper: [8, 8], targets: [[8, 8], [5, 7], [16, 7], [4, 9], [11, 6]],
      use: "빵집 뒤 빵 공방. 가운데 작업대에서 도마·밀대로 반죽을 밀고, 서쪽 석조 화덕·작은 화덕에 굽는다. 동쪽 찬장·버터 교반통·밀가루 포대·달걀 바구니에서 재료를 꺼내고, 조리대와 음식 운반대로 가게에 나른다",
      note: "크림 벽·돌바닥 42, 16×5칸. 컵 걸이·국자 걸이·향신료 선반, 석조 빵 화덕 3×3·작은 빵 화덕, 작업대 4×2(다리 앞면)와 빵 도마·밀대·반죽 그릇·절구, 찬장 2×3·버터 교반통·밀가루 포대 둘·달걀 바구니, 조리대 3×2·음식 운반대 2×2·청소 양동이, 붉은 깔개",
    });
  }
}
