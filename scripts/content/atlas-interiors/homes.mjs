// 민가 — 가난한 오두막부터 부잣집·귀족 저택까지. 층이 있는 집은 위아래 층을 짝으로(같은 벽·같은 자리 계단).
const T = (s) => `tibo-${s}`;

export default function homes(K) {
  // ── 가난한 오두막: 흙바닥 한 칸, 짚 잠자리, 작은 화덕 ──
  {
    const r = K.room("atlas-interior-poor-hovel", "민가 · 가난한 오두막", 13, 11, { wings: [{ x: 2, y: 5, w: 9, h: 3 }], door: { x: 6, y: 7 }, wall: "moss-stone" });
    r.floor(192);
    r.mat(2, 5, 3, 7).stamp(T("library-193"), 2, 5).stamp(T("library-038"), 3, 5);
    r.one(4, 3, 54).stamp(T("hanging-herbs"), 7, 3);
    r.stamp(T("library-026"), 5, 5).stool(4, 6).stool(6, 6);
    r.stamp(T("bread-oven"), 9, 5).stamp(T("library-071"), 8, 5).stamp(T("library-061"), 10, 6);
    r.stamp(T("v6-2-1"), 8, 7).stamp(T("library-233"), 9, 7);
    r.done({
      entry: [6, 8], targets: [[3, 6], [9, 6]],
      use: "가난한 날품팔이 가족이 사는 흙바닥 한 칸. 왼쪽 짚 잠자리에서 자고, 가운데 작은 탁자에서 먹고, 오른쪽 작은 화덕에 불을 지핀다",
      note: "이끼 낀 석벽·흙바닥 192, 9×3칸. 짚 돗자리 잠자리와 침낭·베개, 창 하나·말린 약초, 정사각 식탁과 걸상 둘, 작은 빵 화덕과 재 양동이·기댄 빗자루, 물 양동이·뚜껑 바구니",
    });
  }

  // ── 농가: 돌바닥 부엌과 나무 바닥 거실 ──
  {
    const r = K.room("atlas-interior-farmhouse", "민가 · 농가 부엌과 거실", 22, 15, {
      rooms: [{ id: "kitchen", x: 2, y: 5, w: 6, h: 7 }, { id: "living", x: 9, y: 5, w: 11, h: 7 }], innerDoors: [{ x: 8, y: 9 }], door: { x: 13, y: 11 },
    });
    r.floor(42, [2, 5, 7, 11]);
    r.stamp(T("medieval-bread-oven"), 2, 3).stamp(T("fantasy-hanging-pot"), 6, 4).stamp(T("hanging-herbs"), 5, 3);
    r.stamp(T("fantasy-prep-table"), 2, 7).stamp(T("butter-churn"), 7, 7).stamp(T("fantasy-water-tub"), 5, 10);
    r.stamp(T("library-018"), 2, 10).stamp(T("library-019"), 3, 10).stamp(T("library-013"), 2, 11).stamp(T("library-014"), 3, 11);
    r.stamp(T("v4-1-0"), 9, 3).stamp(T("medieval-stone-fireplace"), 14, 3).one(12, 3, 54).one(18, 3, 54);
    r.stamp(T("library-235"), 17, 5);
    r.rug("teal", 13, 6, 17, 7).stamp(T("v7-1-3"), 15, 7).chair("w", 14, 7).chair("e", 16, 7);
    r.rug("red", 9, 7, 12, 10).table(10, 8, 11, 9).chair("n", 10, 7).chair("n", 11, 7).chair("s", 10, 10).chair("s", 11, 10).chair("e", 12, 8);
    r.stamp(T("library-001"), 10, 8).stamp(T("library-036"), 10, 9).stamp(T("library-008"), 11, 9);
    r.stamp(T("v11-1-2"), 18, 9).stamp(T("coat-rack"), 19, 6).stamp(T("boot-rack"), 15, 11).stamp(T("library-215"), 9, 11);
    r.object("farm-kitchen-hearth", "농가 부엌 화덕 한 벌", "furniture", 2, 3, 6, 3, ["부엌", "화덕", "솥", "농가"], "농가·여관 돌바닥 부엌 뒷벽에 붙인다");
    r.object("family-dining-set", "네 식구 식탁 세트", "furniture", 9, 7, 4, 4, ["식탁", "의자", "러그", "민가"], "민가 거실·부엌 곁 바닥 가운데");
    r.done({
      entry: [13, 12], keeper: [4, 9], targets: [[4, 9], [16, 9], [12, 11], [18, 7]],
      use: "밭을 부치는 농부 가족의 집. 왼쪽 돌바닥 부엌에서 큰 화덕에 빵을 굽고 솥에 국을 끓이며 버터를 젓는다. 칸막이 문 너머 거실에서 네 식구가 식탁에 둘러앉고, 벽난로 앞 찻상에서 쉬며, 창가 물레로 실을 잣는다",
      note: "크림 벽, 부엌 6×7(돌바닥 42)과 거실 11×7을 칸막이로 나눴다(문 (8,9)). 부엌: 석조 빵 화덕 3×3·불 피운 솥 걸이·말린 약초·조리대·버터 교반통·물통·채소 상자와 포대 한 덩이. 거실: 식기장 3×3, 장작 벽난로와 장작 받침대, 벽난로 앞 청록 러그 위 찻상과 마주 보는 의자 둘, 붉은 러그 위 2×2 식탁(다리까지)과 의자 다섯(모두 식탁을 봄), 물레·옷걸이·신발 받침대·화분",
    });
  }

  // ── 어부의 집 ──
  {
    const r = K.room("atlas-interior-fisher-house", "민가 · 어부의 집", 17, 13, { wings: [{ x: 2, y: 5, w: 13, h: 5 }], door: { x: 8, y: 9 } });
    r.floor(102);
    r.bed(2, 5).stamp(T("library-039"), 3, 5).one(3, 3, 54).stamp(T("library-045"), 2, 7);
    r.stamp(T("bread-oven"), 5, 5).stamp(T("library-012"), 5, 3).stamp(T("v6-2-0"), 7, 3);
    r.mat(5, 7, 7, 9).table(6, 7, 7, 8).stool(5, 8).stool(6, 9);
    r.stamp(T("library-007"), 6, 7).stamp(T("library-008"), 7, 8);
    r.stamp(T("library-224"), 10, 3).stamp(T("library-022"), 12, 5).stamp(T("library-229"), 14, 5);
    r.stamp(T("library-196"), 11, 8).stamp(T("library-199"), 12, 8).stamp(T("library-197"), 14, 8).stamp(T("library-232"), 13, 8);
    r.stamp(T("v6-1-1"), 10, 5).stamp(T("library-061"), 2, 8);
    r.object("fisher-drying-corner", "어부의 생선 건조대 구석", "prop", 11, 5, 4, 5, ["어부", "생선", "밧줄", "통"], "어부의 집·부두 창고 안 벽 곁");
    r.done({
      entry: [8, 10], targets: [[3, 7], [9, 7], [11, 7]],
      use: "바닷가 어부의 집. 왼쪽 침대에서 자고, 작은 화덕에서 잡은 생선을 굽고, 돗자리 위 탁자에서 먹는다. 오른쪽 벽의 조타륜 장식 아래 생선 건조대에 그물 대신 생선을 말리고, 밧줄·물주머니·등불을 챙겨 새벽에 배를 띄운다",
      note: "크림 벽·널 바닥 102, 13×5칸. 침대·협탁·창·궤짝, 작은 빵 화덕과 국자 걸이·강 지도 액자, 짚 돗자리 위 2×2 탁자(프라이팬·접시)와 걸상 둘, 배 조타륜 장식·생선 건조대 2×2·통, 밧줄·물주머니·쌓인 상자·여행등 받침, 물 양동이·빗자루",
    });
  }

  // ── 사냥꾼 오두막(숲) ──
  {
    const r = K.room("atlas-interior-hunter-lodge", "민가 · 숲 사냥꾼 오두막", 17, 13, { wings: [{ x: 2, y: 5, w: 13, h: 5 }], door: { x: 8, y: 9 }, wall: "log" });
    r.bed(2, 5).stamp(T("library-039"), 3, 5).stamp(T("library-223"), 3, 3).stamp(T("library-045"), 2, 7);
    r.stamp(T("medieval-stone-fireplace"), 7, 3).stamp(T("library-235"), 5, 5).stamp(T("v8-1-2"), 10, 5);
    r.mat(6, 6, 10, 7);
    r.stamp(T("fantasy-weapon-rack"), 11, 4).stamp(T("atlas-hide-frame"), 13, 5);
    r.stamp(T("library-026"), 5, 8).stool(4, 9).stool(6, 9);
    r.stamp(T("library-194"), 12, 8).stamp(T("library-196"), 13, 8).stamp(T("library-200"), 13, 9).stamp(T("library-195"), 14, 7);
    r.stamp(T("v6-1-1"), 10, 9).stamp(T("library-022"), 2, 8);
    r.object("hunter-trophy-wall", "사냥꾼 무기·가죽 벽", "prop", 11, 4, 4, 3, ["사냥꾼", "무기 거치대", "가죽", "오두막"], "사냥꾼 오두막·가죽 공방 옆벽");
    r.done({
      entry: [8, 10], targets: [[8, 8], [3, 8], [12, 7]],
      use: "숲 가장자리 사냥꾼의 통나무 오두막. 벽난로 앞 짚 돗자리에서 몸을 녹이고, 오른쪽 거치대의 활·창을 챙겨 나가며, 잡은 짐승 가죽은 나무 틀에 당겨 말린다. 고기는 문 옆 건조대에서 말린다",
      note: "통나무 벽·나무 바닥 72, 13×5칸. 침대·협탁·사슴뿔 벽판·궤짝, 장작 벽난로 3×3·장작 받침대·장작 바구니와 앞 짚 돗자리 5×2, 무기 거치대 2×3·가죽 건조틀 2×2(새 타일), 정사각 식탁(절구)과 걸상 둘, 가죽 배낭·밧줄·여행 장화·지팡이 걸이, 물 양동이·생선 건조대",
    });
  }

  // ── 부잣집 1층 · 2층 (동쪽 계단 짝) ──
  {
    const r = K.room("atlas-interior-merchant-house-1f", "민가 · 부잣집 1층 현관과 식당", 26, 16, {
      rooms: [{ id: "hall", x: 2, y: 5, w: 13, h: 8 }, { id: "dining", x: 16, y: 5, w: 8, h: 8 }], innerDoors: [{ x: 15, y: 9 }], door: { x: 8, y: 12 },
    });
    r.stairsUp(13, 5);
    r.rug("red", 7, 7, 9, 12);
    r.stamp(T("fantasy-bookcase"), 2, 4).block(4, 4, [[389], [419]]).stamp(T("library-218"), 6, 3).stamp(T("library-217"), 8, 3);
    r.stamp(T("v4-5-2"), 10, 4).stamp(T("library-214"), 5, 4);
    r.rug("teal", 2, 8, 5, 10).stamp(T("v7-1-3"), 3, 9).chair("w", 2, 9, "red").chair("e", 4, 9);
    r.stamp(T("library-209"), 2, 11).stamp(T("library-239"), 11, 11).stamp(T("coat-rack"), 14, 11).stamp(T("library-215"), 10, 12).stamp(T("library-215"), 6, 12);
    r.rug("teal", 11, 7, 13, 8);
    r.rug("red", 17, 7, 22, 11).stamp(T("medieval-banquet-table"), 18, 8).redChair(17, 8).redChair(22, 8);
    for (const x of [18, 19, 20, 21]) r.chair("n", x, 7).chair("s", x, 10);
    r.stamp(T("warm-crockery"), 16, 4).stamp(T("library-134"), 22, 4).one(19, 3, 56).one(20, 3, 56);
    r.stamp(T("library-031"), 22, 11 + 0).stamp(T("library-209"), 16, 11);
    r.object("banquet-set-eight", "여덟 자리 연회 식탁 세트", "furniture", 17, 7, 6, 4, ["식탁", "연회", "의자", "부잣집"], "부잣집·귀족 저택 식당 한가운데");
    r.done({
      entry: [8, 13], keeper: [20, 11], targets: [[12, 6], [3, 8], [19, 11], [16, 9]],
      use: "상인 가문의 부잣집 1층. 붉은 러너를 따라 현관 홀에 들어서면 벽시계·초상화·책장이 손님을 맞고, 청록 러그의 찻상에서 기다린다. 동쪽 칸막이 문 너머 식당에서 여덟 자리 연회 식탁에 둘러앉고, 홀 동벽 계단으로 2층 침실에 오른다",
      note: "크림 벽, 현관 홀 13×8과 식당 8×8을 칸막이로 나눴다(문 (15,9)). 홀: 동벽 3칸 폭 오르막 계단 141|111|171(x=11~13) → 2층, 붉은 러너, 두꺼운 책장·괘종시계·초상화·풍경화·촛대 탁자·말린 꽃병, 청록 러그 위 찻상과 의자 둘, 야자·우산꽂이·옷걸이·화분. 식당: 붉은 러그 위 연회 식탁 4×2와 양 끝 붉은 의자, 식탁을 보는 의자 넷씩, 식기장·포도주 선반·커튼 창·음식 운반대·야자",
    });
  }
  {
    const r = K.room("atlas-interior-merchant-house-2f", "민가 · 부잣집 2층 서재와 침실", 26, 16, {
      rooms: [{ id: "study", x: 2, y: 5, w: 8, h: 8 }, { id: "landing", x: 11, y: 5, w: 4, h: 8 }, { id: "bed", x: 16, y: 5, w: 8, h: 8 }],
      innerDoors: [{ x: 10, y: 9 }, { x: 15, y: 9 }], door: { x: 12, y: 12 },
    });
    r.closeDoor(12, 13);
    r.stairsDown(12, 5).stamp(T("library-059"), 14, 4).one(13, 3, 84).rug("red", 11, 7, 14, 11).stamp(T("library-215"), 11, 12).stamp(T("library-215"), 14, 12);
    r.bookcase(7, 4).stamp(T("v12-1-2"), 2, 4).stamp(T("library-078"), 3, 4).one(5, 3, 54);
    r.stamp(T("warm-scribe-desk"), 4, 6).chair("s", 4, 8).stamp(T("library-083"), 6, 6);
    r.rug("teal", 2, 9, 6, 11).stamp(T("v4-4-2"), 3, 10).chair("w", 2, 10).stamp(T("v11-1-3"), 9, 11);
    r.stamp(T("medieval-canopy-bed"), 18, 4).stamp(T("library-039"), 17, 5).stamp(T("library-039"), 21, 5).stamp(T("fantasy-wardrobe"), 22, 4);
    r.one(17, 3, 56).one(21, 3, 56).rug("red", 17, 8, 21, 10).stamp(T("library-045"), 19, 7);
    r.stamp(T("library-041"), 16, 9).stamp(T("library-040"), 22, 9).chair("s", 22, 10).stamp(T("library-215"), 23, 12).stamp(T("library-236"), 16, 11);
    r.object("canopy-bedroom-set", "천개 침대 침실 세트", "furniture", 17, 4, 7, 4, ["침실", "천개 침대", "협탁", "옷장"], "부잣집·성 침실 뒷벽");
    r.done({
      entry: [12, 6], targets: [[5, 9], [19, 11], [23, 8]],
      use: "부잣집 2층. 1층 동벽 계단을 오르면 계단참(내려가는 계단 앞). 서쪽 칸막이 문 너머 서재에서 주인이 장부와 편지를 쓰고 망원경으로 별을 보며, 동쪽 침실에 천개 침대·옷장·화장대가 있다",
      note: "크림 벽, 서재 8×8·계단참 4×8·침실 8×8을 세로 칸막이로 나눴다(문 (10,9)·(15,9)). 남쪽 문은 천장으로 닫고 1층 계단 가운데(x=12)에 1×1 내리막 474 하나. 계단참: 린넨 장·그림·붉은 러너·화분 둘. 서재: 책장 3×3·지구본·문서 분류장·창, 필경사 책상과 책상을 보는 의자, 독서등, 청록 러그 위 독서 탁자와 의자·책 더미, 천체망원경. 침실: 천개 침대 3×3·협탁 둘·옷장·커튼 창 둘, 붉은 러그와 침대 발치 궤짝, 전신 거울·화장대와 의자·세면대·접이식 가림막",
    });
  }

  // ── 귀족 저택: 현관 홀(가운데 큰 계단) ↔ 2층 침실 층, 연회실, 서재, 응접실 ──
  {
    const r = K.room("atlas-interior-manor-hall", "귀족 저택 · 현관 홀", 30, 20, { wings: [{ x: 2, y: 5, w: 26, h: 12 }], door: { x: 15, y: 16 }, wall: "gold-brick", northDoors: [5, 24] });
    r.floor(42);
    r.stairsUp(16, 5);
    r.rugShape([[11, 6, 19, 8], [14, 9, 16, 16], [7, 11, 23, 12], [6, 16, 24, 16]]);
    r.rug("teal", 8, 5, 10, 8).rug("teal", 20, 5, 22, 8);
    r.curtain(11, 3).curtain(18, 3).block(13, 4, [[389], [419]]).block(17, 4, [[389], [419]]);
    for (const x of [3, 7, 23, 26]) r.stamp(T("library-218"), x, 3);
    r.stamp(T("medieval-armor-stand"), 9, 4).stamp(T("medieval-armor-stand"), 20, 4);
    for (const [x, y] of [[7, 7], [22, 7], [7, 13], [22, 13]]) r.pillar(x, y);
    r.statue(12, 9).statue(18, 9);
    for (const [x, y] of [[11, 8], [19, 8], [13, 15], [17, 15]]) r.one(x, y, 204);
    r.rug("teal", 2, 8, 5, 10).stamp(T("v7-2-3"), 3, 9).chair("w", 2, 9, "blue").chair("e", 4, 9);
    r.rug("teal", 24, 8, 27, 10).stamp(T("v7-1-3"), 25, 9).chair("w", 24, 9, "red").chair("e", 26, 9);
    r.stamp(T("library-209"), 2, 15).stamp(T("library-209"), 26, 15).stamp(T("library-214"), 5, 14).stamp(T("library-214"), 24, 14);
    r.stamp(T("library-239"), 11, 15).stamp(T("coat-rack"), 12, 15);
    r.stamp(T("library-205"), 2, 12).stamp(T("library-205"), 26, 12);
    r.block(8, 14, [[2044, 2045, 2046], [2047, 2048, 2049]]).block(19, 14, [[2044, 2045, 2046], [2047, 2048, 2049]]);
    r.rug("teal", 2, 5, 5, 6).rug("teal", 24, 5, 27, 6).stamp(T("library-215"), 2, 5).stamp(T("library-215"), 27, 5);
    for (const [x, y] of [[11, 13], [18, 13]]) r.one(x, y, 204);
    r.object("grand-stair-landing", "귀족 저택 큰 계단과 커튼", "landmark", 11, 3, 9, 6, ["계단", "커튼", "괘종시계", "저택"], "귀족 저택·성 현관 홀 뒷벽 가운데");
    r.done({
      entry: [15, 17], keeper: [15, 9], targets: [[15, 6], [5, 5], [24, 5], [3, 12], [26, 11]],
      use: "귀족 가문의 저택 현관 홀. 정문으로 들어서면 붉은 카펫이 가운데 큰 계단(2층 침실 층)까지 이어지고, 좌우 가로 띠가 기둥 사이로 벌어진다. 뒷벽 서쪽 문 틈은 연회실, 동쪽 문 틈은 서재로 이어지고, 손님은 양쪽 청록 러그 찻상에서 기다린다",
      note: "금벽돌 벽·돌바닥 42, 26×12칸. 뒷벽 가운데 3칸 폭 오르막 계단 141|111|171(x=14~16) → 2층, 양옆 붉은 대형 커튼과 괘종시계 둘, 초상화 넷, 갑옷 거치대 둘, 계단 앞 성인상 한 쌍·촛대. 붉은 카펫은 계단 앞 단·문에서 계단까지·가로 띠를 한 섬으로 성형, 가로 띠 아래 돌 분수 한 쌍. 기둥 넷, 양쪽 청록 러그 위 찻상과 의자, 뒷벽 서·동 문 틈(x=5·24), 모서리 야자·고사리 화분·말린 꽃병·촛대 탁자·우산꽂이·옷걸이",
    });
  }
  {
    const r = K.room("atlas-interior-manor-bedrooms", "귀족 저택 · 2층 침실 층", 30, 20, {
      rooms: [{ id: "master", x: 2, y: 5, w: 11, h: 12 }, { id: "landing", x: 14, y: 5, w: 3, h: 12 }, { id: "guest", x: 18, y: 5, w: 10, h: 5 }, { id: "nursery", x: 18, y: 13, w: 10, h: 4 }],
      innerDoors: [{ x: 13, y: 11 }, { x: 17, y: 7 }, { x: 17, y: 15 }], door: { x: 15, y: 16 }, wall: "gold-brick",
    });
    r.closeDoor(15, 17);
    r.stairsDown(15, 5).rug("red", 14, 7, 16, 16).one(14, 3, 56).one(16, 3, 56).stamp(T("library-214"), 14, 5);
    // master bedroom
    r.stamp(T("medieval-canopy-bed"), 5, 4).stamp(T("library-039"), 4, 5).stamp(T("library-039"), 8, 5);
    r.stamp(T("fantasy-wardrobe"), 2, 4).stamp(T("medieval-stone-fireplace"), 9, 3).one(3, 3, 56);
    r.rug("red", 4, 8, 9, 11).stamp(T("library-045"), 6, 7);
    r.stamp(T("library-041"), 2, 8).stamp(T("library-040"), 2, 11).chair("s", 2, 12).stamp(T("fantasy-washstand"), 9, 7);
    r.rug("teal", 5, 12, 9, 14).stamp(T("v7-1-3"), 7, 13).chair("w", 6, 13, "red").chair("e", 8, 13);
    r.stamp(T("fantasy-bookcase"), 3, 13).stamp(T("v4-5-2"), 4, 11).stamp(T("warm-dresser"), 11, 12).stamp(T("library-214"), 12, 8).stamp(T("library-236"), 11, 15).stamp(T("library-209"), 2, 15).stamp(T("library-219"), 7, 3).stamp(T("library-215"), 12, 5);
    // guest room
    r.stamp(T("fantasy-bed"), 19, 4).stamp(T("library-039"), 18, 5).stamp(T("library-043"), 25, 4).one(22, 3, 56).stamp(T("warm-dresser"), 22, 4).stamp(T("library-215"), 24, 5);
    r.rug("red", 22, 7, 24, 9).stamp(T("library-040"), 26, 8).chair("s", 27, 9).stamp(T("library-045"), 18, 8);
    // nursery
    r.bed(19, 13).bed(21, 13).stamp(T("library-039"), 20, 13).stamp(T("library-044"), 26, 13);
    r.rug("teal", 22, 15, 25, 16).stamp(T("library-181"), 23, 15).stamp(T("library-184"), 25, 15).stamp(T("library-186"), 27, 16).stamp(T("library-190"), 18, 15).stamp(T("library-183"), 26, 15);
    r.done({
      entry: [15, 6], targets: [[7, 11], [22, 6], [23, 14], [10, 13]],
      use: "귀족 저택 2층. 현관 홀 큰 계단을 오르면 가운데 복도(내려가는 계단 앞). 서쪽 문은 주인 부부 침실(천개 침대·벽난로·화장대·찻상), 동쪽 위 문은 손님방, 아래 문은 아이 방(침대 둘·요람·장난감)",
      note: "금벽돌 벽, 주인 침실 11×12·복도 3×12·손님방 10×5·아이 방 10×4를 칸막이로 나눴다(문 (13,11)·(17,7)·(17,15)). 남쪽 문은 천장으로 닫고 1층 큰 계단 가운데(x=15)에 1×1 내리막 474 하나, 붉은 러너·커튼 창·말린 꽃병. 주인 침실: 천개 침대 3×3·협탁 둘·옷장·장작 벽난로·커튼 창·가족 초상화, 붉은 러그와 발치 궤짝, 전신 거울·화장대와 의자·세면대 3×2, 청록 러그 위 찻상과 의자 둘, 가림막·야자·화분. 손님방: 목제 침대·협탁·닫힌 옷장·커튼 창, 붉은 깔개, 화장대와 의자, 궤짝. 아이 방: 침대 둘과 협탁·나무 요람, 청록 러그 위 목마·곰 인형·열린 장난감 상자·인형의 집·헝겊 인형",
    });
  }
  {
    const r = K.room("atlas-interior-manor-banquet", "귀족 저택 · 연회실", 28, 16, { wings: [{ x: 2, y: 5, w: 24, h: 8 }], door: { x: 14, y: 12 }, wall: "gold-brick" });
    r.floor(42);
    r.rug("red", 6, 7, 21, 11);
    for (const x of [7, 11, 15]) r.stamp(T("medieval-banquet-table"), x, 8);
    for (const x of [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]) r.chair("n", x, 7).chair("s", x, 10);
    r.redChair(6, 8).redChair(19, 8);
    r.stamp(T("medieval-stone-fireplace"), 12, 3).curtain(9, 3).curtain(16, 3).stamp(T("library-217"), 7, 3).stamp(T("library-217"), 18, 3);
    r.stamp(T("warm-crockery"), 2, 4).stamp(T("v4-1-0"), 4, 3).stamp(T("library-134"), 20, 4).stamp(T("fantasy-ale-rack"), 23, 4).one(11, 5, 204).one(15, 5, 204);
    r.stamp(T("library-031"), 2, 8).stamp(T("library-031"), 24, 8);
    // musicians' corner by the door: harp, cello, violin on music stands
    r.stamp(T("v12-1-3"), 22, 10).stamp(T("library-179"), 23, 10).stamp(T("library-173"), 24, 10).stamp(T("library-169"), 25, 10);
    r.stamp(T("library-209"), 2, 11).stamp(T("library-215"), 12, 12).stamp(T("library-215"), 16, 12).one(5, 11, 204).one(20, 11, 204);
    r.done({
      entry: [14, 13], targets: [[4, 7], [22, 7], [8, 11], [23, 9]],
      use: "귀족 저택의 연회실. 붉은 카펫 위 연회 식탁 셋을 이어 스물네 자리, 양 끝 붉은 의자에 주인 부부가 앉는다. 뒷벽 벽난로와 커튼 창, 양쪽 벽에 식기장·술 선반과 음식 운반대, 문 곁 구석에서 악사가 하프·첼로·바이올린을 연주한다",
      note: "금벽돌 벽·돌바닥 42, 24×8칸. 붉은 카펫 16×5 위 연회 식탁 4×2 셋(12칸 식탁), 위쪽은 식탁을 보는 의자 267, 아래쪽 등을 보인 의자 268 열두 개씩, 양 끝 붉은 의자. 뒷벽 장작 벽난로·붉은 대형 커튼 둘·풍경화 둘, 서벽 식기장 3×3·따뜻한 식기장, 동벽 포도주 선반·술통 선반, 음식 운반대 둘. 악사 구석: 작은 하프·첼로·악보 받침대 둘·업라이트 피아노, 촛대·야자·화분",
    });
  }
  {
    const r = K.room("atlas-interior-manor-library", "귀족 저택 · 서재", 24, 16, { wings: [{ x: 2, y: 5, w: 20, h: 8 }], door: { x: 12, y: 12 }, wall: "gold-brick" });
    r.floor(102);
    for (const x of [2, 5, 15, 18]) r.bookcase(x, 4);
    r.stamp(T("medieval-stone-fireplace"), 10, 3).stamp(T("library-218"), 8, 3).stamp(T("library-218"), 14, 3);
    r.rug("red", 9, 6, 13, 8).stamp(T("v7-1-3"), 11, 7).chair("w", 10, 7, "red").chair("e", 12, 7);
    for (const x of [3, 4, 5, 6, 17, 18, 19, 20]) r.shelf(x, 8);
    r.rug("teal", 8, 9, 14, 11).table(9, 10, 13, 10).chair("s", 9, 11).chair("s", 11, 11).chair("s", 13, 11).chair("n", 10, 9).chair("n", 12, 9);
    r.stamp(T("library-158"), 9, 10).stamp(T("library-076"), 11, 10).stamp(T("library-073"), 12, 10);
    r.stamp(T("v12-1-2"), 21, 4).stamp(T("v11-1-3"), 21, 11).stamp(T("library-074"), 2, 11).stamp(T("library-083"), 8, 5);
    r.stamp(T("medieval-scribe-desk"), 16, 10).chair("s", 17, 12).stamp(T("library-084"), 7, 11);
    r.object("reading-table-set", "긴 열람 탁자와 의자", "furniture", 8, 9, 7, 3, ["서재", "도서관", "열람 탁자", "의자"], "서재·도서관 바닥 가운데 러그 위");
    r.done({
      entry: [12, 13], targets: [[11, 6], [7, 10], [4, 10], [19, 10]],
      use: "귀족 가문의 서재. 네 벽을 책장이 두르고, 뒷벽 벽난로 앞 찻상에서 주인이 손님과 이야기한다. 가운데 청록 러그의 긴 열람 탁자에서 가문의 기록을 읽고, 오른쪽 필경사 책상에서 편지를 쓴다",
      note: "금벽돌 벽·널 바닥 102, 20×8칸. 뒷벽 큰 책장 3×3 넷·장작 벽난로·초상화 둘·독서등·지구본, 벽난로 앞 붉은 러그 위 찻상과 의자 둘, 양쪽 1×2 서가 네 개씩(y=8), 청록 러그 위 5칸 긴 열람 탁자(펼친 룬 서적·잉크와 깃펜·책 더미)와 탁자를 보는 의자 다섯, 펼친 지도책 받침·천체망원경·필경사 책상과 의자·도서관 발판",
    });
  }
  {
    const r = K.room("atlas-interior-manor-salon", "귀족 저택 · 응접실", 22, 14, { wings: [{ x: 2, y: 5, w: 18, h: 6 }], door: { x: 11, y: 10 }, wall: "gold-brick" });
    r.stamp(T("library-169"), 2, 4).stamp(T("v12-1-3"), 4, 4).stamp(T("library-173"), 3, 6).curtain(6, 3).curtain(14, 3);
    r.stamp(T("library-217"), 9, 3).stamp(T("library-219"), 12, 3).block(19, 4, [[389], [419]]);
    r.rug("red", 8, 5, 13, 7).stamp(T("warm-bench"), 9, 5).stamp(T("warm-bench"), 11, 5).stamp(T("v7-1-3"), 10, 7).stamp(T("v7-3-3"), 11, 7).chair("w", 9, 7, "red").chair("e", 12, 7);
    r.rug("teal", 15, 6, 18, 8).stamp(T("chessboard"), 16, 7).chair("w", 15, 7, "blue").chair("e", 17, 7);
    r.rug("teal", 3, 8, 6, 9).stamp(T("v7-2-3"), 4, 8).chair("w", 3, 8).chair("e", 5, 8);
    r.stamp(T("library-209"), 2, 9).stamp(T("library-209"), 18, 9).stamp(T("library-214"), 8, 9).stamp(T("library-214"), 14, 9).stamp(T("library-205"), 16, 4);
    r.done({
      entry: [11, 11], targets: [[10, 8], [16, 9], [4, 6]],
      use: "귀족 부인이 손님을 맞는 응접실. 가운데 붉은 러그의 쿠션 긴 의자 앞 찻상에서 차를 마시고, 오른쪽 체스판에서 한 판 두며, 왼쪽 구석 피아노·하프로 음악회를 연다",
      note: "금벽돌 벽·나무 바닥 72, 18×6칸. 뒷벽 업라이트 피아노·작은 하프·악보 받침대, 붉은 대형 커튼 둘·풍경화·타원 초상화·괘종시계, 붉은 러그 위 쿠션 긴 의자 둘과 찻상 둘·의자 둘, 청록 러그 위 체스판과 마주 앉는 의자, 왼쪽 청록 러그 위 두루마리 탁자와 의자, 야자 둘·말린 꽃병·고사리 화분",
    });
  }

  // ── 지하 창고가 있는 집: 1층 ↔ 지하 ──
  {
    const r = K.room("atlas-interior-cellar-house-1f", "민가 · 지하 창고가 있는 집 1층", 19, 13, {
      rooms: [{ id: "living", x: 2, y: 5, w: 10, h: 5 }, { id: "pantry", x: 13, y: 5, w: 4, h: 5 }], innerDoors: [{ x: 12, y: 8 }], door: { x: 7, y: 9 },
    });
    r.floor(42, [13, 5, 16, 9]);
    r.bed(2, 5).stamp(T("library-039"), 3, 5).one(3, 3, 54).stamp(T("medieval-stone-fireplace"), 6, 3).stamp(T("library-235"), 4, 5);
    r.rug("red", 5, 6, 9, 8).table(6, 7, 8, 8).chair("n", 7, 6).chair("w", 5, 8).chair("e", 9, 8);
    r.stamp(T("library-004"), 6, 7).stamp(T("library-020"), 8, 8).stamp(T("library-036"), 7, 7);
    r.stamp(T("fantasy-cupboard"), 10, 4).stamp(T("library-045"), 2, 7).stamp(T("library-215"), 11, 9);
    r.stairsDown(16, 8).stamp(T("library-011"), 13, 3).stamp(T("library-016"), 14, 4).stamp(T("library-017"), 15, 4);
    r.stamp(T("library-229"), 13, 5).stamp(T("library-234"), 16, 5).stamp(T("library-018"), 14, 9).stamp(T("library-013"), 13, 9);
    r.done({
      entry: [7, 10], targets: [[3, 8], [14, 7], [7, 9]],
      use: "지하 창고가 딸린 민가. 한 방에서 자고 벽난로 앞 식탁에서 먹으며, 칸막이 문 너머 돌바닥 찬방의 계단으로 지하 창고에 내려가 겨울 식량을 꺼낸다",
      note: "크림 벽, 방 10×5(나무 바닥)와 찬방 4×5(돌바닥 42)를 칸막이로 나눴다(문 (12,8)). 방: 침대·협탁·창, 장작 벽난로·장작 받침대, 붉은 러그 위 3×2 식탁(반죽 그릇·치즈·피처)과 의자 넷(모두 식탁을 봄), 찬장 2×3·궤짝·화분. 찬방: 향신료 선반·양파·마늘 꾸러미(벽), 뚜껑 둥근 통·저장 옹기·당근 상자·밀가루 포대, 동쪽 구석에 1×1 내리막 474 → 지하 창고",
    });
  }
  {
    const r = K.room("atlas-interior-cellar-house-b1", "민가 · 지하 창고", 19, 13, { wings: [{ x: 2, y: 5, w: 15, h: 5 }], door: { x: 7, y: 9 }, wall: "stone-brick" });
    r.floor(42).closeDoor(7, 10);
    r.stairsUp(16, 8 - 3);
    r.stamp(T("fantasy-ale-rack"), 2, 4).stamp(T("library-134"), 5, 4).stamp(T("library-133"), 7, 4).one(9, 3, 24).one(13, 4, 2050);
    r.stamp(T("fantasy-grain-sacks"), 9, 7).stamp(T("library-232"), 2, 8).stamp(T("library-230"), 3, 9).stamp(T("library-229"), 4, 8);
    r.stamp(T("library-022"), 12, 8).stamp(T("library-016"), 10, 4).stamp(T("library-017"), 11, 4).stamp(T("library-234"), 9, 5);
    r.stamp(T("library-127"), 6, 9).stamp(T("library-015"), 7, 7).one(13, 5, 471).stamp(T("library-141"), 5, 7);
    r.done({
      entry: [15, 6], targets: [[4, 6], [10, 9], [14, 9]],
      use: "민가 아래 지하 창고. 동벽 계단으로 내려오면 술통 선반·포도주 선반, 곡식 자루와 쌓인 상자, 고기 건조대에 겨울 양식이 쌓여 있다. 벽의 쥐구멍 앞 자루가 찢겼다",
      note: "석벽·돌바닥 42, 15×5칸. 남쪽 문을 천장으로 닫고 동벽 3칸 폭 오르막 141|111|171(x=14~16) → 1층 찬방(1층 내리막 x=16과 같은 벽). 술통 선반·포도주 선반·받침대 맥주통·횃불, 쥐구멍 2050과 찢긴 곡물 자루 471, 식재료 자루 3×2·쌓인 상자·정사각 상자·뚜껑 통·생선 건조대·양파·마늘 꾸러미·저장 옹기·빈 농산물 상자·감자 바구니·병 상자",
    });
  }

  // ── 약초꾼 오두막 ──
  {
    const r = K.room("atlas-interior-herbalist-cottage", "민가 · 약초꾼 오두막", 17, 13, { wings: [{ x: 2, y: 5, w: 13, h: 5 }], door: { x: 8, y: 9 } });
    r.floor(102);
    r.stamp(T("medieval-herbal-cabinet"), 2, 3).stamp(T("hanging-herbs"), 6, 3).stamp(T("library-154"), 5, 4).one(9, 3, 54);
    r.stamp(T("fantasy-herb-rack"), 11, 4).one(14, 3, 54).stamp(T("library-166"), 14, 5);
    r.mat(5, 6, 9, 8).table(6, 6, 8, 7).stool(5, 7).stool(9, 7).stamp(T("library-003"), 6, 6).stamp(T("library-146"), 7, 7).stamp(T("library-153"), 8, 6);
    r.bed(13, 7).stamp(T("library-039"), 14, 7).stamp(T("library-210"), 2, 7).stamp(T("library-211"), 2, 9).stamp(T("library-212"), 4, 9);
    r.stamp(T("library-234"), 11, 8).stamp(T("v7-3-1"), 10, 9);
    r.object("herb-worktable", "약초 손질 탁자", "furniture", 5, 6, 5, 3, ["약초", "절구", "탁자", "약초꾼"], "약초꾼 오두막·약방 작업실 바닥 가운데");
    r.done({
      entry: [8, 10], targets: [[8, 9], [12, 7], [3, 8]],
      use: "숲에서 약초를 캐는 약초꾼의 오두막. 뒷벽 건조장과 걸이에 약초를 말리고, 가운데 탁자에서 절구로 빻아 약초차를 달이며, 창가 가마솥에 연고를 끓인다. 모종 쟁반과 물뿌리개로 약초 모를 기른다",
      note: "크림 벽·널 바닥 102, 13×5칸. 약초 건조장 3×3·약초 건조장 1×2·말린 약초 걸이·창가 약초 화분함, 약초 건조대 3×2·창·물약 가마솥, 짚 돗자리 위 3×2 탁자(절구·약초 도마·약초차 통)와 걸상 둘, 침대·협탁, 모종 쟁반·물뿌리개·원예 도구 바구니, 저장 옹기·꽃 화분 둘",
    });
  }

  // ── 학자의 집 ──
  {
    const r = K.room("atlas-interior-scholar-house", "민가 · 학자의 집", 19, 13, { wings: [{ x: 2, y: 5, w: 15, h: 5 }], door: { x: 9, y: 9 }, wall: "purple-brick" });
    r.floor(102);
    r.bookcase(2, 4).bookcase(5, 4).stamp(T("library-164"), 8, 3).stamp(T("v9-1-0"), 11, 3).one(12, 3, 54);
    r.stamp(T("medieval-scribe-desk"), 9, 5).chair("s", 10, 7).stamp(T("library-083"), 12, 5).stamp(T("v12-1-2"), 8, 5);
    r.rug("teal", 4, 7, 8, 9).table(5, 8, 7, 8).chair("s", 6, 9).chair("w", 4, 8);
    r.stamp(T("library-073"), 5, 8).stamp(T("v11-1-0"), 6, 8).stamp(T("library-076"), 7, 8);
    r.stamp(T("v11-1-3"), 13, 5).bed(16, 5).stamp(T("library-039"), 15, 5).stamp(T("library-045"), 16, 7);
    r.stamp(T("library-078"), 13, 8).stamp(T("library-081"), 14, 8).stamp(T("library-084"), 2, 9).stamp(T("library-215"), 16, 9);
    r.object("scholar-desk-wall", "학자의 책상과 별자리 벽", "furniture", 8, 3, 5, 5, ["학자", "책상", "별자리", "지구본"], "학자의 집·마법 학원 연구실 뒷벽");
    r.done({
      entry: [9, 10], targets: [[10, 8], [5, 7], [14, 6], [11, 9], [2, 7]],
      use: "책에 파묻혀 사는 학자의 집. 뒷벽 책장 앞 필경사 책상에서 별자리 판을 보며 논문을 쓰고, 청록 러그의 탁자에 책을 펼쳐 모래시계로 시간을 잰다. 오른쪽 구석 천체망원경 곁 침대에서 쪽잠을 잔다",
      note: "보랏빛 벽돌 벽·널 바닥 102, 15×5칸. 큰 책장 3×3 둘, 별자리 판 2×2·벽시계·창, 필경사 책상 3×2와 책상을 보는 의자·독서등·지구본, 청록 러그 위 한 줄 탁자(책 더미·모래시계·잉크와 깃펜, 다리까지)와 의자 셋, 천체망원경·침대·협탁·궤짝, 문서 분류장·책 압착기·도서관 발판·화분",
    });
  }
}
