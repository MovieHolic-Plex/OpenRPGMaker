// 공공시설 — 병원 병실·진료소, 은행 창구·금고, 극장 객석·분장실, 목욕탕·온천, 카지노, 암시장 경매장.
const T = (s) => `tibo-${s}`;

export default function civic(K) {
  // ── 병원 병실 ──
  {
    const r = K.room("atlas-interior-hospital-ward", "병원 · 병실", 24, 15, { wings: [{ x: 2, y: 5, w: 20, h: 7 }], door: { x: 12, y: 11 } });
    r.floor(163);
    for (const x of [5, 8, 15, 18]) r.one(x, 3, 54);
    r.stamp(T("v9-1-0"), 11, 3).stamp(T("library-163"), 12, 3);
    for (const y of [5, 9]) {
      for (const b of [3, 6, 9]) r.bed(b, y).stamp(T("library-039"), b + 1, y);
      for (const b of [14, 17, 20]) r.bed(b, y).stamp(T("library-039"), b - 1, y);
    }
    r.stamp(T("v9-1-1"), 11, 5).stamp(T("library-149"), 12, 5);
    r.table(11, 7, 12, 7).stamp(T("library-148"), 11, 7).chair("e", 13, 7);
    r.rug("teal", 2, 7, 10, 8).rug("teal", 14, 7, 21, 8);
    r.stamp(T("v8-1-3"), 2, 11).stamp(T("library-048"), 21, 11).stamp(T("library-065"), 20, 11);
    r.object("hospital-bed-row", "병상 셋과 협탁(병실 한 줄)", "furniture", 3, 5, 8, 2, ["병원", "병상", "협탁", "치료"], "병원·수도원 병실 벽을 따라");
    r.done({
      entry: [12, 12], keeper: [12, 8], targets: [[12, 8], [2, 7], [21, 8], [11, 6], [12, 10]],
      use: "마을 병원의 큰 병실. 병상 열두 개가 뒷벽과 가운데 줄에 협탁을 끼고 늘어섰고, 가운데 약품함 앞 간호 탁자에서 간호사가 약병을 나눈다. 두 청록 통로로 병상 사이를 돈다",
      note: "크림 벽·석판 바닥 163, 20×7칸. 창 넷·벽시계·달 위상 벽판, 병상(1×2) 두 줄×여섯과 협탁, 약품함·붕대 바구니, 한 줄 탁자(다리 앞면)와 약병·서쪽을 보는 의자, 청록 통로 둘, 세면대·빨래통·청소 양동이",
    });
  }
  // ── 진료소 ──
  {
    const r = K.room("atlas-interior-clinic", "병원 · 마을 진료소", 18, 13, { wings: [{ x: 2, y: 5, w: 14, h: 5 }], door: { x: 8, y: 9 } });
    r.floor(163);
    r.stamp(T("v6-1-0"), 6, 3).one(12, 3, 54).stamp(T("v9-1-0"), 9, 3).stamp(T("library-218"), 3, 3);
    r.bed(2, 5).stamp(T("library-039"), 3, 5).stamp(T("library-236"), 4, 5);
    r.stamp(T("medieval-scribe-desk"), 10, 5).chair("w", 9, 6).chair("s", 11, 7);
    r.stamp(T("library-145"), 14, 5).stamp(T("v9-1-1"), 15, 5).stamp(T("library-151"), 15, 6).stamp(T("library-154"), 13, 5);
    r.rug("red", 3, 8, 7, 9).stamp(T("warm-bench"), 4, 8).stamp(T("library-149"), 2, 9).stamp(T("v8-1-3"), 13, 9).stamp(T("library-215"), 15, 9);
    r.done({
      entry: [8, 10], keeper: [9, 7], targets: [[9, 7], [3, 7], [13, 8], [8, 6]],
      use: "마을 의사의 진료소. 필경사 책상 서쪽 의자에 의사가 앉고 앞 의자에 환자가 앉는다. 왼쪽 가림막 뒤 침상에서 진찰하고, 붉은 깔개 위 긴 의자에서 순서를 기다린다",
      note: "크림 벽·석판 바닥 163, 14×5칸. 게시판·초상화·벽시계·창, 침상과 협탁·접이식 가림막, 필경사 책상 3×2와 잉크·깃펜, 동쪽을 보는 의사 의자·북쪽을 보는 환자 의자, 약재 서랍장·약품함·뿌리 표본병·환약 단지, 대기 긴 의자·붕대 바구니·세면대·관목 화분",
    });
  }
  // ── 은행 창구 ──
  {
    const r = K.room("atlas-interior-bank-hall", "은행 · 창구 홀", 24, 15, { wings: [{ x: 2, y: 5, w: 20, h: 7 }], door: { x: 12, y: 11 }, wall: "stone-brick" });
    r.floor(163);
    r.stamp(T("library-218"), 3, 3).stamp(T("library-218"), 8, 3).stamp(T("v9-1-0"), 12, 3).stamp(T("library-218"), 16, 3).stamp(T("atlas-vault-door"), 19, 3);
    for (const x of [4, 9, 14]) r.stamp(T("atlas-teller-counter"), x, 6).chair("n", x + 1, 5);
    r.stamp(T("v10-1-0"), 2, 5).stamp(T("library-078"), 8, 5).stamp(T("library-230"), 18, 5).stamp(T("v10-1-0"), 19, 5).stamp(T("library-232"), 20, 5).stamp(T("library-045"), 21, 5);
    r.rugShape([[8, 8, 15, 11], [2, 8, 21, 8]]);
    r.stamp(T("warm-bench"), 3, 9).stamp(T("warm-bench"), 18, 9).stamp(T("library-215"), 2, 11).stamp(T("library-215"), 21, 11).stamp(T("library-239"), 6, 10);
    r.object("bank-teller-row", "창살 창구 카운터 셋과 직원 의자", "furniture", 4, 5, 13, 3, ["은행", "창구", "카운터", "창살"], "은행·환전소·세관 창구 줄");
    r.done({
      entry: [12, 12], keeper: [5, 5], targets: [[5, 8], [10, 8], [15, 8], [17, 5], [7, 5]],
      use: "성읍 은행의 창구 홀. 창살 창구 카운터 셋 뒤에 직원이 앉아(남쪽을 봄) 손님의 돈을 받고, 동쪽 벽 둥근 금고 문 앞 금고함에 넣는다. 손님은 붉은 카펫 위에서 줄을 서고 양옆 긴 의자에서 기다린다",
      note: "석벽·석판 바닥 163, 20×7칸. 초상화 셋·벽시계·둥근 금고 문 2×2(새 타일), 창구 카운터 3×2 셋(새 타일)과 직원 의자 267, 자물쇠 금고함 셋·문서 분류장·보관 상자·궤짝, 붉은 카펫 T자, 대기 쿠션 긴 의자 둘·관목 화분·우산꽂이",
    });
  }
  // ── 은행 금고 ──
  {
    const r = K.room("atlas-interior-bank-vault", "은행 · 지하 금고", 20, 14, { wings: [{ x: 2, y: 5, w: 16, h: 6 }], door: { x: 9, y: 10 }, wall: "dark-stone" });
    r.floor(42);
    r.stamp(T("atlas-vault-door"), 9, 3).one(5, 3, 24).one(14, 3, 24);
    r.stamp(T("library-100"), 3, 5).stamp(T("v10-1-0"), 5, 5).stamp(T("library-045"), 6, 5).stamp(T("library-100"), 13, 5).stamp(T("v10-1-0"), 12, 5).stamp(T("library-045"), 15, 5);
    r.stamp(T("library-230"), 2, 6).stamp(T("library-232"), 17, 5).stamp(T("v10-1-0"), 3, 7).stamp(T("library-106"), 16, 7);
    r.rug("red", 7, 5, 12, 7);
    r.bars(2, 17, 8, 9);
    r.table(2, 9, 3, 9).stamp(T("library-122"), 2, 9).chair("s", 2, 10).stool(4, 9).stamp(T("library-230"), 16, 9).stamp(T("library-061"), 17, 9);
    r.rug("teal", 8, 9, 13, 10);
    r.object("vault-treasure-row", "금괴 더미·금고함·궤짝", "prop", 3, 5, 4, 1, ["금고", "금괴", "보물", "은행"], "금고·보물고 뒷벽 앞");
    r.done({
      entry: [9, 11], keeper: [3, 10], targets: [[3, 10], [10, 10], [15, 10]], sealed: [[2, 5, 17, 7]],
      use: "은행 지하 금고. 남쪽 문으로 들어오면 창살 앞 대기실이고, 경비가 탁자 뒤에서 열쇠를 지킨다. 창살 문(가운데) 안쪽 뒷벽 둥근 금고 문 앞에 금괴 더미·금고함·궤짝이 쌓였다. 창살 안은 잠겨 있어 이벤트로 연다",
      note: "어두운 석벽·돌바닥 42, 16×6칸. 뒷벽 둥근 금고 문 2×2·횃불 둘, 금속 주괴 더미 둘·자물쇠 금고함 둘·궤짝 둘·보관 상자·쌓인 상자·봉인 상자·고철 상자, 붉은 깔개, 창살 한 줄 2084~2087(문 x=9, 막힘 — 잠긴 안쪽은 sealed), 대기실 한 줄 탁자와 동전 쟁반·의자·걸상, 금고함·빗자루·청록 깔개",
    });
  }
  // ── 극장 객석 ──
  {
    const r = K.room("atlas-interior-theater-hall", "극장 · 객석과 무대", 26, 18, { wings: [{ x: 2, y: 5, w: 22, h: 10 }], door: { x: 13, y: 14 }, wall: "purple-brick" });
    r.floor(72);
    r.stage(5, 5, 20, 7, 12).curtain(3, 3).curtain(21, 3).one(9, 3, 24).one(16, 3, 24).stamp(T("library-220"), 12, 3).stamp(T("library-220"), 13, 3);
    r.stamp(T("library-169"), 6, 5).stamp(T("library-179"), 8, 5).stamp(T("library-173"), 10, 5).stamp(T("lute"), 15, 5).stamp(T("v12-1-3"), 17, 5).stamp(T("library-174"), 19, 5);
    for (const x of [3, 7, 15, 19]) r.pews(x, 9, 2, { gap: 1 });
    r.rugShape([[11, 8, 14, 14], [2, 8, 23, 8]]);
    r.stamp(T("library-197"), 2, 13).stamp(T("library-197"), 23, 13);
    r.object("theater-stage", "극장 무대(앞면·계단·악기)와 커튼", "landmark", 3, 3, 20, 5, ["극장", "무대", "커튼", "악기"], "극장·오페라·강당 북쪽 벽 앞");
    r.done({
      entry: [13, 15], keeper: [12, 6], targets: [[12, 6], [13, 10], [2, 11], [23, 11], [5, 6]],
      use: "성읍 극장의 객석. 북쪽 널 무대(가운데 계단으로 오름)에서 악단과 배우가 공연하고, 관객은 뒷모습 긴 의자 여덟에 앉아 무대를 본다(모두 북쪽을 봄). 붉은 가운데 통로와 앞줄 가로 통로로 자리를 찾는다",
      note: "보라 벽돌 벽·나무 바닥 72, 22×10칸. 널 무대 16×2와 앞면·가운데 계단(새 타일), 양옆 붉은 대형 커튼·횃불 둘·직조 벽걸이 둘, 무대 위 업라이트 피아노·첼로·악보 받침대·류트·하프·작은 북, 뒷모습 긴 의자 4×2 두 줄×넷, 붉은 T자 통로, 여행등 받침 둘",
    });
  }
  // ── 극장 분장실 ──
  {
    const r = K.room("atlas-interior-theater-backstage", "극장 · 분장실", 20, 13, { wings: [{ x: 2, y: 5, w: 16, h: 5 }], door: { x: 9, y: 9 }, wall: "purple-brick" });
    r.floor(102);
    r.stamp(T("library-218"), 4, 3).stamp(T("library-218"), 8, 3).stamp(T("library-217"), 11, 3).one(15, 3, 24);
    r.stamp(T("library-040"), 3, 6).chair("s", 3, 7).chair("s", 4, 7).stamp(T("library-041"), 5, 5);
    r.stamp(T("library-040"), 7, 6).chair("s", 7, 7).chair("s", 8, 7).stamp(T("library-041"), 9, 5);
    r.stamp(T("library-111"), 11, 5).stamp(T("library-111"), 12, 5).stamp(T("library-042"), 13, 5).stamp(T("coat-rack"), 15, 5).stamp(T("library-179"), 16, 5).stamp(T("library-178"), 16, 8);
    r.stamp(T("library-236"), 2, 8).rug("red", 5, 8, 8, 9).rug("teal", 11, 7, 15, 9).stamp(T("library-118"), 11, 8).stamp(T("library-045"), 17, 5);
    r.done({
      entry: [9, 10], keeper: [10, 6], targets: [[10, 6], [5, 8], [14, 8], [6, 7]],
      use: "극장 무대 뒤 분장실. 배우는 화장대 앞 의자에 앉아(북쪽을 봄) 전신 거울로 분장을 확인하고, 동쪽 마네킹·옷장·옷걸이에서 의상을 갈아입는다. 가림막 뒤에서 옷을 벗고 악기 케이스를 챙겨 무대로 나간다",
      note: "보라 벽돌 벽·널 바닥 102, 16×5칸. 초상화 둘·풍경화·횃불, 화장대 2×1 둘과 의자 넷(268)·타원 전신 거울 둘, 재봉 마네킹 둘·열린 옷장·옷걸이·첼로·악기 케이스·궤짝, 접이식 가림막, 붉은·청록 깔개, 접은 천 더미",
    });
  }
  // ── 공중 목욕탕 ──
  {
    const r = K.room("atlas-interior-bathhouse", "목욕탕 · 공중 목욕탕", 24, 15, { wings: [{ x: 2, y: 5, w: 20, h: 7 }], door: { x: 11, y: 11 }, wall: "stone-brick" });
    r.floor(163);
    r.stamp(T("atlas-bath"), 3, 5).stamp(T("atlas-bath"), 15, 5).stamp(T("library-236"), 10, 5).stamp(T("library-051"), 8, 5).stamp(T("library-051"), 12, 5).one(9, 3, 54).one(14, 3, 54).one(5, 3, 54).one(18, 3, 54);
    r.stamp(T("library-057"), 4, 8).stamp(T("library-058"), 5, 8).stamp(T("library-055"), 7, 5).stamp(T("library-057"), 17, 8).stamp(T("library-058"), 16, 8).stamp(T("library-055"), 19, 5);
    r.stamp(T("library-049"), 8, 8).stamp(T("library-049"), 13, 8);
    r.mat(2, 10, 7, 11).stamp(T("library-059"), 20, 9).stamp(T("library-054"), 3, 10).stamp(T("library-052"), 21, 11).stamp(T("library-048"), 18, 11);
    r.rug("teal", 9, 6, 14, 7).rug("teal", 14, 10, 18, 11).stamp(T("library-209"), 12, 10);
    r.object("stone-bath-set", "돌 욕조와 목욕 걸상·바가지·물 항아리", "furniture", 3, 5, 5, 4, ["목욕탕", "욕조", "온천", "씻기"], "목욕탕·온천·궁 욕실");
    r.done({
      entry: [11, 12], keeper: [9, 9], targets: [[9, 9], [7, 7], [14, 9], [4, 11], [21, 8]],
      use: "성읍의 공중 목욕탕. 문을 들어서면 왼쪽 짚 깔개에서 옷을 벗고 수건을 받아, 뒷벽 돌 욕조 둘에 몸을 담근다. 욕조 앞 걸상에 앉아 바가지로 물을 끼얹고, 가운데 나무 욕조에서 따로 씻는다",
      note: "석벽·석판 바닥 163, 20×7칸. 돌 욕조 4×3 둘(새 타일)·가운데 접이식 가림막·수건 걸이 둘, 목욕 걸상·바가지·물 항아리 두 벌, 나무 욕조 둘, 짚 깔개 탈의 자리와 접은 수건·린넨 장·비누 받침·빨래통, 청록 깔개 둘·야자",
    });
  }
  // ── 온천 ──
  {
    const r = K.room("atlas-interior-hot-spring", "목욕탕 · 산골 온천", 22, 15, { wings: [{ x: 2, y: 5, w: 18, h: 7 }], door: { x: 10, y: 11 }, wall: "basalt" });
    r.floor(1998);
    r.stamp(T("atlas-bath"), 3, 5).stamp(T("atlas-bath"), 9, 5).stamp(T("atlas-bath"), 15, 5);
    r.stamp(T("library-207"), 2, 5).stamp(T("library-207"), 19, 5).stamp(T("library-208"), 7, 3).stamp(T("library-208"), 14, 3).one(10, 3, 24).one(11, 3, 24);
    r.stamp(T("library-057"), 7, 8).stamp(T("library-058"), 3, 8).stamp(T("library-057"), 14, 8).stamp(T("library-055"), 18, 8);
    r.fur(2, 10, 6, 11).stamp(T("library-054"), 3, 10).stamp(T("library-037"), 5, 10).mat(14, 10, 19, 11).stamp(T("v8-1-3"), 19, 10).stamp(T("library-059"), 16, 10);
    r.rug("red", 9, 8, 12, 9).stamp(T("v7-1-3"), 10, 8).stool(9, 8).stool(11, 8);
    r.done({
      entry: [10, 12], keeper: [12, 10], targets: [[12, 10], [7, 9], [13, 5], [4, 9], [18, 9]],
      use: "화산 기슭 산골 온천. 현무암 바닥에 돌 욕조 셋이 뜨거운 물을 받고, 욕조 사이 걸상에 앉아 물을 끼얹는다. 가운데 붉은 깔개 찻상에서 차를 마시고, 양옆 흰 모피·짚 깔개에서 옷을 갈아입는다",
      note: "현무암 벽·현무암 바닥 1998, 18×7칸. 돌 욕조 4×3 셋(새 타일), 고사리 화분 둘·덩굴 걸이 화분 둘·횃불 둘, 목욕 걸상 둘·바가지·물 항아리, 찻잔 탁자와 걸상 둘(붉은 깔개), 흰 모피 깔개와 접은 수건·이불, 짚 깔개와 세면대·린넨 장",
    });
  }
  // ── 카지노 ──
  {
    const r = K.room("atlas-interior-grand-casino", "카지노 · 대도박장", 26, 16, { wings: [{ x: 2, y: 5, w: 22, h: 8 }], door: { x: 13, y: 12 }, wall: "gold-brick" });
    r.floor(12);
    r.curtain(4, 3).curtain(20, 3).stamp(T("library-217"), 8, 3).stamp(T("library-217"), 16, 3).stamp(T("library-218"), 12, 3).stamp(T("library-218"), 13, 3);
    r.rug("red", 3, 6, 10, 10).rug("red", 15, 6, 22, 10);
    for (const x of [4, 8]) r.stamp(T("atlas-roulette"), x, 7).stool(x - 1, 7, true).stool(x + 2, 8, true).stool(x, 9, true);
    for (const x of [16, 20]) r.stamp(T("library-140"), x, 7).chair("w", x - 1, 7).chair("e", x + 2, 8).chair("s", x + 1, 9);
    r.stamp(T("fantasy-bar-counter"), 11, 6).stool(11, 8, true).stool(14, 8, true).stamp(T("fantasy-ale-rack"), 15, 5);
    r.stamp(T("library-209"), 2, 11).stamp(T("library-209"), 22, 11).stamp(T("library-197"), 7, 11).stamp(T("library-197"), 18, 11);
    r.rug("teal", 11, 9, 14, 12);
    r.object("casino-roulette-table", "룰렛 탁자와 높은 걸상 셋", "furniture", 3, 7, 4, 3, ["카지노", "룰렛", "도박", "걸상"], "카지노·귀족 유희실 붉은 카펫 위");
    r.done({
      entry: [13, 13], keeper: [12, 5], targets: [[12, 5], [6, 10], [18, 6], [21, 10], [12, 8]],
      use: "항구 성읍의 대도박장. 왼쪽 붉은 카펫 위 룰렛 탁자 둘을 높은 걸상의 손님이 둘러싸고, 오른쪽 카드 탁자 둘에선 의자에 앉아 카드를 친다. 뒷벽 가운데 바에서 술을 받는다",
      note: "금박 벽돌 벽·보라 자갈 바닥 12, 22×8칸. 붉은 대형 커튼 둘·풍경화 둘·초상화 둘, 룰렛 탁자 2×2 둘(새 타일)과 높은 걸상 여섯, 카드 탁자 2×2 둘과 탁자를 보는 의자 여섯, 바 카운터와 걸상 둘·술통 선반, 야자 둘·여행등 받침 둘, 청록 입구 깔개",
    });
  }
  // ── 암시장 경매장 ──
  {
    const r = K.room("atlas-interior-black-market-auction", "경매장 · 암시장 경매장", 22, 16, { wings: [{ x: 2, y: 5, w: 18, h: 8 }], door: { x: 11, y: 12 }, wall: "dark-stone" });
    r.floor(43);
    r.stage(5, 5, 16, 7, 11).one(4, 3, 24).one(17, 3, 24).stamp(T("library-221"), 9, 3).stamp(T("library-221"), 12, 3);
    r.stamp(T("lectern"), 11, 4).stamp(T("library-162"), 7, 5).stamp(T("library-167"), 14, 5).stamp(T("v10-1-3"), 16, 4);
    r.stamp(T("library-232"), 2, 5).stamp(T("library-229"), 3, 5).stamp(T("library-045"), 18, 5).stamp(T("v10-1-0"), 19, 5);
    for (const x of [3, 7, 14]) r.pews(x, 9, 2, { width: 3, gap: 0 });
    r.rug("red", 10, 8, 13, 12).stamp(T("library-196"), 2, 12).stamp(T("library-123"), 18, 11).stamp(T("library-197"), 18, 8);
    r.object("auction-stage", "경매 단상(독서대·돌 제단·표본 쟁반)", "landmark", 5, 4, 12, 3, ["경매", "암시장", "단상", "무대"], "경매장·암시장 북쪽");
    r.done({
      entry: [11, 13], keeper: [11, 6], targets: [[11, 6], [6, 8], [16, 8], [2, 10], [19, 10]],
      use: "지하 암시장의 경매장. 경매인은 단상 독서대 뒤에서 작은 돌 제단·수정 표본 쟁반의 물건을 부르고, 입찰자는 뒷모습 긴 의자에 앉아 단상을 본다. 벽가엔 경매품 상자·궤짝이 쌓였다",
      note: "어두운 석벽·짙은 초록 자갈 42→43, 18×8칸. 널 단상 12×1과 앞면·계단(새 타일), 횃불 둘·방패 장식 둘, 독서대·작은 돌 제단·수정 표본 쟁반, 쌓인 상자·둥근 통·궤짝·봉인 상자, 뒷모습 긴 의자 3칸 두 줄×셋, 붉은 통로, 밧줄·소포 더미·여행등",
    });
  }
}
