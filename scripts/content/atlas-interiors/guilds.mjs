// 길드 — 모험가(큰 홀)·상인·도둑·마법사·기사단·길드장 집무실. 학교 — 교실(칠판)·강당·큰 도서관·지하 문서고.
const T = (s) => `tibo-${s}`;

export function guilds(K) {
  // ── 모험가 길드 큰 홀 ──
  {
    const r = K.room("atlas-interior-adventurer-hall", "길드 · 모험가 길드 큰 홀", 28, 17, { wings: [{ x: 2, y: 5, w: 24, h: 9 }], door: { x: 13, y: 13 } });
    r.floor(102);
    for (const x of [2, 5, 8]) r.stamp(T("v6-1-0"), x, 3);
    r.stamp(T("lectern"), 6, 4).stamp(T("library-223"), 11, 3).stamp(T("v6-2-0"), 14, 3).stamp(T("library-221"), 17, 3).stamp(T("library-221"), 18, 3).one(10, 3, 24).one(20, 3, 24);
    r.stamp(T("library-078"), 21, 4).stamp(T("v8-1-0"), 22, 3).stamp(T("fantasy-bookcase"), 24, 4);
    r.table(17, 7, 23, 7).stamp(T("library-079"), 17, 7).stamp(T("library-122"), 19, 7).stamp(T("library-238"), 21, 7).stamp(T("library-121"), 22, 7);
    r.rug("red", 2, 7, 10, 10).stamp(T("fantasy-dining-set"), 3, 7).stamp(T("fantasy-dining-set"), 7, 7);
    r.rug("teal", 11, 7, 15, 10).stamp(T("library-025"), 13, 8).stool(12, 9).stool(14, 9);
    r.stamp(T("fantasy-weapon-rack"), 2, 11).stamp(T("library-194"), 4, 13).stamp(T("library-196"), 5, 13);
    r.stamp(T("library-026"), 19, 11).chair("w", 18, 12).chair("e", 20, 12).stamp(T("library-026"), 23, 11).stool(22, 12).stool(24, 12);
    r.stamp(T("library-209"), 9, 12).stamp(T("library-215"), 16, 13).rug("teal", 16, 8, 25, 10).rug("red", 11, 11, 15, 13);
    r.object("quest-board-wall", "의뢰 게시판 벽과 장부 독서대", "furniture", 2, 3, 9, 3, ["길드", "의뢰", "게시판", "독서대"], "모험가 길드·경비대 초소 뒷벽");
    r.done({
      entry: [13, 14], keeper: [20, 6], targets: [[20, 6], [6, 6], [13, 10], [21, 13], [4, 12]],
      use: "큰 도시의 모험가 길드 홀. 뒷벽 의뢰 게시판 셋과 장부 독서대에서 의뢰를 고르고, 오른쪽 긴 접수대에서 접수원에게 등록·보상 수령을 한다. 왼쪽 붉은 러그의 긴 식탁 둘과 가운데 둥근 탁자에서 파티를 짜고, 앞쪽 탁자에서 기다린다",
      note: "크림 벽·널 바닥 102, 24×9칸. 뒷벽 메모 게시판 셋·장부 독서대·사슴뿔 벽판·강 지도 액자·방패 장식 둘·횃불 둘·문서 분류장·열쇠판·두꺼운 책장, 한 줄 접수대 7칸(편지 쟁반·동전 쟁반·금고함·돈 서랍, 접수원 자리 (20,6)), 붉은 러그 위 긴 식탁과 벤치 둘, 청록 러그 위 원형 식탁과 걸상 둘, 앞쪽 무기 거치대·가죽 배낭·밧줄, 정사각 식탁 둘과 의자·걸상, 야자·화분",
    });
  }
  // ── 상인 길드 ──
  {
    const r = K.room("atlas-interior-merchant-guild", "길드 · 상인 길드 회의실", 24, 15, { wings: [{ x: 2, y: 5, w: 20, h: 7 }], door: { x: 11, y: 11 }, wall: "stone-brick" });
    r.stamp(T("v3-1-0"), 2, 3).stamp(T("library-078"), 5, 4).stamp(T("library-078"), 6, 4).stamp(T("v6-2-0"), 8, 3).stamp(T("library-217"), 11, 3).stamp(T("atlas-vault-door"), 14, 3);
    r.stamp(T("library-045"), 16, 5).stamp(T("v6-2-2"), 17, 5).stamp(T("library-100"), 18, 5).stamp(T("library-232"), 20, 4).stamp(T("library-232"), 21, 4);
    r.rug("red", 5, 6, 16, 9).table(6, 7, 15, 8);
    for (const x of [7, 9, 11, 13]) r.chair("n", x, 6);
    for (const x of [7, 9, 13, 15]) r.chair("s", x, 9);
    r.chair("w", 5, 8).chair("e", 16, 8);
    r.stamp(T("balance-scale"), 7, 7).stamp(T("library-128"), 9, 7).stamp(T("library-076"), 11, 7).stamp(T("library-160"), 12, 8).stamp(T("library-122"), 14, 7).stamp(T("library-073"), 15, 8).stamp(T("library-079"), 6, 8);
    r.stamp(T("warm-scribe-desk"), 2, 9).chair("s", 2, 11).stamp(T("library-123"), 19, 9).stamp(T("library-230"), 21, 11);
    r.stamp(T("library-215"), 8, 11).stamp(T("library-215"), 14, 11);
    r.object("guild-meeting-table", "열두 자리 회의 탁자", "furniture", 5, 6, 12, 4, ["회의", "탁자", "의자", "길드"], "길드 회의실·성 회의실·시청 한가운데");
    r.done({
      entry: [11, 12], targets: [[10, 10], [4, 10], [18, 11], [17, 6]],
      use: "도시 상인들이 모이는 상인 길드. 붉은 러그 위 긴 회의 탁자에 둘러앉아 저울과 장부를 놓고 시세를 정하고, 봉인 두루마리로 계약을 맺는다. 뒷벽 금고 문 안과 궤짝·주괴 더미에 길드 자금을 두고, 서기는 왼쪽 책상에서 적는다",
      note: "석벽·나무 바닥 72, 20×7칸. 뒷벽 책장 수납장 3×3·문서 분류장 둘·강 지도 액자·풍경화·둥근 금고 문 2×2(새 타일)·궤짝·걸쇠 상자·금속 주괴·쌓인 상자 둘, 붉은 러그 위 10×2 회의 탁자(다리까지, 저울·저울추·잉크·봉인 두루마리·동전·책·편지)와 탁자를 보는 의자 열(북 넷·남 넷·양 끝), 서기 책상과 의자, 소포 더미·정사각 상자·지구본·화분 둘",
    });
  }
  // ── 도둑 길드 은신처 ──
  {
    const r = K.room("atlas-interior-thieves-den", "길드 · 도둑 길드 은신처", 22, 15, { wings: [{ x: 2, y: 5, w: 18, h: 7 }], door: { x: 10, y: 11 }, wall: "moss-stone" });
    r.floor(43);
    r.stamp(T("library-138"), 3, 3).stamp(T("v6-1-0"), 6, 3).one(9, 3, 24).stamp(T("v8-1-0"), 11, 3).stamp(T("library-222"), 13, 3).one(15, 3, 24);
    r.stamp(T("library-045"), 16, 5).stamp(T("v6-2-2"), 17, 5).stamp(T("v10-1-0"), 18, 5).stamp(T("v6-1-2"), 19, 5).stamp(T("library-100"), 16, 6);
    r.stamp(T("library-140"), 5, 7).chair("w", 4, 8).chair("e", 7, 8).chair("n", 6, 6);
    r.stamp(T("library-025"), 10, 7).stool(9, 8).stool(11, 8);
    r.mat(13, 8, 16, 10).stamp(T("library-193"), 13, 8).stamp(T("library-193"), 15, 8).stamp(T("library-038"), 13, 10);
    r.stamp(T("fantasy-weapon-rack"), 18, 8);
    r.stamp(T("library-232"), 2, 9).stamp(T("library-229"), 3, 9).stamp(T("library-196"), 2, 11).stamp(T("library-197"), 12, 10).rug("red", 4, 6, 12, 9);
    r.done({
      entry: [10, 12], targets: [[18, 7], [5, 10], [14, 9], [8, 6]],
      use: "하수도 곁 지하의 도둑 길드 은신처. 다트판과 현상금 게시판 아래 카드 탁자에서 판을 벌이고, 오른쪽 뒷벽에 훔친 궤짝·봉인 상자·주괴를 쌓아 둔다. 짚 돗자리 침낭에서 쪽잠을 자고, 무기 거치대에서 단검을 챙긴다",
      note: "이끼 낀 석벽·암녹색 돌바닥 43, 18×7칸. 뒷벽 다트판 2×2·메모 게시판·열쇠판·교차 연습검·횃불 둘, 장물 더미(궤짝·걸쇠 상자·봉인 상자·천 덮은 상자·금속 주괴), 카드 탁자 2×2와 탁자를 보는 의자 셋, 원형 식탁과 걸상 둘, 짚 돗자리 위 침낭 둘·베개, 무기 거치대, 쌓인 상자·통·밧줄·여행등 받침",
    });
  }
  // ── 마법사 길드 ──
  {
    const r = K.room("atlas-interior-mage-guild", "길드 · 마법사 길드 의식실", 24, 16, { wings: [{ x: 2, y: 5, w: 20, h: 8 }], door: { x: 11, y: 12 }, wall: "purple-brick" });
    r.floor(12);
    r.bookcase(2, 4).bookcase(5, 4).stamp(T("library-164"), 8, 3).stamp(T("library-163"), 10, 3).stamp(T("fantasy-crystal-stand"), 11, 4).stamp(T("library-163"), 12, 3);
    r.stamp(T("v4-2-0"), 15, 3).stamp(T("library-159"), 18, 3).stamp(T("library-195"), 19, 4).stamp(T("v10-1-3"), 20, 4);
    r.stamp(T("lectern"), 9, 5).stamp(T("lectern"), 13, 5);
    r.block(10, 8, [[381, 382, 383], [411, 412, 413], [441, 442, 443]], "upperTiles", "floor");
    r.stamp(T("brazier"), 9, 9).stamp(T("brazier"), 13, 9).rug("red", 8, 7, 14, 11);
    r.table(3, 9, 5, 10).stamp(T("library-158"), 3, 9).stamp(T("library-157"), 5, 9).stamp(T("v11-1-0"), 4, 10).chair("w", 2, 10).chair("n", 4, 8);
    r.stamp(T("fantasy-alchemy-desk"), 16, 8).stool(17, 10).stamp(T("library-166"), 19, 9).rug("teal", 15, 10, 20, 12);
    r.stamp(T("v10-1-2"), 2, 12).stamp(T("v10-1-2"), 21, 12).stamp(T("library-167"), 7, 12);
    r.object("magic-circle-braziers", "마법진과 화로 한 쌍", "landmark", 9, 8, 5, 3, ["마법진", "화로", "마법사", "의식"], "마법사 길드·탑 꼭대기 방 한가운데");
    r.done({
      entry: [11, 12], targets: [[11, 7], [4, 11], [18, 11], [8, 7]],
      use: "마법사 길드의 의식실. 한가운데 마법진 양옆 화로에 불을 지피고 독서대의 주문서를 읽어 의식을 올린다. 왼쪽 탁자에서 룬 서적과 수정구로 공부하고, 오른쪽 연금술 작업대와 가마솥에서 물약을 달인다",
      note: "보랏빛 벽돌 벽·보랏빛 돌바닥 12, 20×8칸. 뒷벽 큰 책장 3×3 둘·별자리 판·달 위상 벽판 둘·수정구 받침·물약 진열장 3×3·마법봉 걸이·지팡이 걸이·점술 거울, 독서대 둘, 마법진 381~443(위층)과 화로 둘, 3×2 탁자(펼친 룬 서적·수정구·모래시계)와 의자 둘, 연금술 작업대와 걸상·물약 가마솥·청록 깔개, 푸른 버섯 화분 둘·부적 진열대",
    });
  }
  // ── 기사단 회관 ──
  {
    const r = K.room("atlas-interior-knight-hall", "길드 · 기사단 회관", 26, 16, { wings: [{ x: 2, y: 5, w: 22, h: 8 }], door: { x: 12, y: 12 }, wall: "stone-brick" });
    r.floor(42);
    r.stamp(T("library-220"), 4, 3).stamp(T("library-220"), 19, 3).stamp(T("library-221"), 6, 3).stamp(T("library-221"), 17, 3).one(8, 3, 24).one(15, 3, 24);
    r.curtain(10, 3).curtain(13, 3).redChair(12, 4).stamp(T("medieval-armor-stand"), 2, 4).stamp(T("medieval-armor-stand"), 22, 4);
    r.rug("red", 6, 7, 17, 10).stamp(T("medieval-banquet-table"), 7, 8).stamp(T("medieval-banquet-table"), 13, 8);
    for (const x of [7, 8, 9, 10, 13, 14, 15, 16]) r.chair("n", x, 7).chair("s", x, 10);
    r.stamp(T("fantasy-weapon-rack"), 2, 9).stamp(T("fantasy-weapon-rack"), 22, 9).armour(5, 11).armour(19, 11).stamp(T("library-045"), 2, 12).stamp(T("library-045"), 20, 12);
    r.rug("teal", 4, 5, 8, 6).rug("teal", 15, 5, 21, 6).rug("red", 7, 11, 17, 12);
    r.done({
      entry: [12, 13], keeper: [12, 6], targets: [[12, 6], [11, 9], [4, 8], [21, 12]],
      use: "왕국 기사단의 회관. 뒷벽 커튼 사이 붉은 의자가 단장의 자리이고, 붉은 카펫 위 연회 식탁 둘에 기사들이 둘러앉아 원정을 의논한다. 양쪽 벽의 깃발·방패·무기 거치대·갑옷 거치대에서 무장한다",
      note: "석벽·돌바닥 42, 22×8칸. 뒷벽 직조 벽걸이(깃발) 둘·방패 장식 둘·횃불 둘·붉은 대형 커튼 둘 사이 붉은 의자(단장 자리)·갑옷 거치대 2×3 둘, 붉은 카펫 위 연회 식탁 4×2 둘과 식탁을 보는 의자 열여섯, 양옆 무기 거치대 2×3·갑옷 전시대·궤짝",
    });
  }
  // ── 길드장 집무실 ──
  {
    const r = K.room("atlas-interior-guildmaster-office", "길드 · 길드장 집무실", 18, 13, { wings: [{ x: 2, y: 5, w: 14, h: 5 }], door: { x: 8, y: 9 } });
    r.stamp(T("fantasy-bookcase"), 2, 4).stamp(T("library-078"), 4, 4).stamp(T("library-218"), 6, 3).stamp(T("v6-2-0"), 9, 3).stamp(T("library-221"), 12, 3).stamp(T("v3-1-0"), 13, 3);
    r.rug("red", 6, 5, 10, 8).stamp(T("medieval-scribe-desk"), 7, 6).chair("n", 8, 5).chair("s", 7, 8).chair("s", 9, 8);
    r.rug("teal", 2, 7, 4, 9).stamp(T("v7-1-3"), 3, 8).chair("w", 2, 8, "red").chair("e", 4, 8);
    r.stamp(T("v12-1-2"), 12, 6).stamp(T("library-045"), 15, 7).stamp(T("library-209"), 13, 8).stamp(T("library-215"), 11, 9);
    r.done({
      entry: [8, 10], keeper: [8, 5], targets: [[9, 5], [8, 9], [3, 6], [14, 6]],
      use: "길드장이 일하는 집무실. 책상 뒤 의자에 앉은 길드장 앞에 의뢰인이 두 의자에 마주 앉고, 왼쪽 찻상에서 손님을 기다리게 한다",
      note: "크림 벽·나무 바닥 72, 14×5칸. 뒷벽 두꺼운 책장·문서 분류장·초상화·강 지도 액자·방패 장식·책장 수납장 3×3, 붉은 러그 위 필경사 책상 3×2와 뒤 의자(남쪽을 봄)·앞 의자 둘(북쪽을 봄), 청록 러그 위 찻상과 의자 둘, 지구본·궤짝·야자·화분",
    });
  }
}

export function schools(K) {
  // ── 학교 교실 ──
  {
    const r = K.room("atlas-interior-school-classroom", "학교 · 칠판 교실", 20, 15, { wings: [{ x: 2, y: 5, w: 16, h: 7 }], door: { x: 9, y: 11 } });
    r.floor(102);
    r.stamp(T("atlas-blackboard"), 8, 3).stamp(T("fantasy-bookcase"), 2, 4).stamp(T("v12-1-2"), 4, 4).stamp(T("v6-2-0"), 5, 3).stamp(T("v9-1-0"), 14, 3).one(16, 3, 54).one(12, 3, 54);
    r.stamp(T("warm-scribe-desk"), 12, 5).chair("e", 14, 6).stamp(T("library-215"), 17, 5);
    r.rugShape([[8, 5, 10, 11], [2, 9, 17, 9]]);
    for (const y of [7, 10]) for (const x of [3, 5, 7, 11, 13, 15]) r.stamp(T("v4-4-2"), x, y).chair("s", x, y + 1);
    r.done({
      entry: [9, 12], keeper: [14, 5], targets: [[14, 5], [4, 9], [16, 11], [9, 6]],
      use: "마을 학교의 교실. 선생은 칠판 곁 책상 뒤에 앉아 학생을 보고, 학생 열두 명은 독서 탁자 앞 의자에 앉아 칠판을 본다(모두 북쪽을 봄). 가운데 통로가 문에서 칠판까지 이어진다",
      note: "크림 벽·널 바닥 102, 16×7칸. 앞벽 칠판 3×2(새 타일)·강 지도 액자·벽시계·창 둘, 두꺼운 책장·지구본, 교사 책상 2×2와 뒤 의자(남쪽을 봄)·화분, 학생 독서 탁자 1×1과 뒷모습 의자 268 여섯 쌍×두 줄(가운데 통로 x=8~10)",
    });
  }
  // ── 학원 강당 ──
  {
    const r = K.room("atlas-interior-academy-hall", "학원 · 강당", 24, 17, { wings: [{ x: 2, y: 5, w: 20, h: 9 }], door: { x: 11, y: 13 }, wall: "stone-brick" });
    r.floor(102);
    r.stage(8, 5, 15, 7, 11).stamp(T("lectern"), 12, 5).stamp(T("atlas-blackboard"), 8, 3).stamp(T("atlas-blackboard"), 13, 3);
    r.stamp(T("fantasy-bookcase"), 2, 4).stamp(T("v12-1-2"), 4, 4).stamp(T("library-164"), 5, 3).stamp(T("v11-1-3"), 18, 4).stamp(T("fantasy-crystal-stand"), 20, 4).stamp(T("library-163"), 17, 3);
    r.rug("red", 11, 8, 12, 13);
    for (const x of [3, 7, 13, 17]) r.pews(x, 8, 2, { gap: 1 });
    r.rug("teal", 2, 6, 7, 7).rug("teal", 16, 6, 21, 7);
    r.done({
      entry: [11, 14], keeper: [11, 6], targets: [[11, 6], [2, 10], [21, 12], [11, 10]],
      use: "마법 학원의 큰 강당. 교수는 널 단상(가운데 계단으로 오름)의 독서대에서 칠판 둘을 가리키며 강의하고, 학생은 뒷모습 긴 의자 여덟에 앉아 단상을 본다. 가운데 붉은 통로와 양옆 벽 통로로 드나든다",
      note: "석벽·널 바닥 102, 20×9칸. 북쪽 널 단상 8×2와 앞면·가운데 계단(새 타일), 단상 위 독서대, 칠판 3×2 둘(새 타일), 두꺼운 책장·지구본·별자리 판·천체망원경·수정구 받침·달 위상 벽판, 뒷모습 긴 의자 4×2(2070~2077) 두 줄×넷(한 줄 띄움), 가운데 붉은 러너",
    });
  }
  // ── 큰 도서관 ──
  {
    const r = K.room("atlas-interior-grand-library", "도서관 · 큰 도서관", 30, 20, { wings: [{ x: 2, y: 5, w: 26, h: 12 }], door: { x: 14, y: 16 } });
    r.floor(102);
    for (const x of [2, 5, 8, 19, 22, 25]) r.bookcase(x, 4);
    r.stamp(T("library-074"), 11, 5).stamp(T("lectern"), 14, 5).stamp(T("v12-1-2"), 16, 5).stamp(T("library-164"), 14, 3).block(13, 4, [[389], [419]]).one(17, 3, 54);
    for (const y of [8, 12]) for (const x of [3, 4, 5, 6, 7, 8, 21, 22, 23, 24, 25, 26]) r.shelf(x, y);
    r.rug("teal", 10, 8, 19, 15).rug("red", 2, 10, 9, 11).rug("red", 20, 10, 27, 11);
    for (const [x0, y0] of [[11, 9], [16, 9], [11, 13], [16, 13]]) r.table(x0, y0, x0 + 2, y0 + 1);
    for (const x of [11, 13, 16, 18]) r.chair("n", x, 8).chair("s", x, 11).chair("s", x, 15);
    r.stamp(T("library-158"), 11, 9).stamp(T("library-073"), 13, 10).stamp(T("library-076"), 16, 9).stamp(T("library-073"), 18, 10).stamp(T("library-158"), 16, 13).stamp(T("library-073"), 11, 14).stamp(T("v11-1-0"), 13, 13);
    r.stamp(T("medieval-scribe-desk"), 22, 15).chair("n", 23, 14).stamp(T("library-084"), 2, 10).stamp(T("library-084"), 27, 10);
    r.stamp(T("library-209"), 2, 15).stamp(T("library-083"), 20, 15).stamp(T("library-083"), 9, 15).stamp(T("library-215"), 6, 16);
    r.done({
      entry: [14, 17], keeper: [23, 13], targets: [[20, 14], [2, 11], [27, 11], [14, 7], [15, 12]],
      use: "도시의 큰 도서관. 뒷벽 큰 책장 여섯과 양옆 서가 네 줄 사이에서 책을 찾고, 가운데 청록 러그의 열람 탁자 넷에 앉아 읽는다. 사서는 오른쪽 앞 책상에서 대출을 받는다",
      note: "크림 벽·널 바닥 102, 26×12칸. 뒷벽 큰 책장 3×3 여섯·펼친 지도책 받침·독서대·지구본·별자리 판·괘종시계·창, 양옆 1×2 서가 여섯씩 두 줄(y=8·12), 청록 러그 위 3×2 열람 탁자 넷(책·잉크·모래시계)과 탁자를 보는 의자 열넷, 사서 책상과 뒤 의자, 도서관 발판 둘·독서등 둘·야자·화분",
    });
  }
  // ── 지하 문서고 ──
  {
    const r = K.room("atlas-interior-archive-vault", "도서관 · 지하 문서고", 20, 14, { wings: [{ x: 2, y: 5, w: 16, h: 6 }], door: { x: 9, y: 10 }, wall: "dark-stone" });
    r.floor(42).closeDoor(9, 11).stairsUp(17, 5);
    r.bookcase(2, 4).bookcase(5, 4).bookcase(8, 4).stamp(T("library-078"), 11, 4).stamp(T("library-078"), 12, 4).stamp(T("library-078"), 13, 4).one(14, 3, 24);
    for (const x of [3, 4, 5, 6, 7, 8]) r.shelf(x, 8);
    r.table(12, 8, 14, 9).stamp(T("library-160"), 12, 8).stamp(T("library-076"), 14, 8).stamp(T("library-073"), 13, 9).chair("w", 11, 9);
    r.stamp(T("library-197"), 16, 8).stamp(T("library-232"), 17, 9).stamp(T("library-230"), 16, 10).stamp(T("library-081"), 2, 9);
    r.done({
      entry: [16, 6], targets: [[10, 9], [2, 7], [15, 10]],
      use: "도서관 아래 지하 문서고. 동벽 계단으로 내려오면 오래된 두루마리와 기록이 책장·서가·문서 분류장에 빼곡하고, 사서가 탁자에서 봉인 두루마리를 풀어 옮겨 적는다",
      note: "어두운 돌벽·돌바닥 42, 16×6칸. 남쪽 문을 천장으로 닫고 동벽 3칸 폭 오르막 141|111|171(x=15~17) → 위층. 큰 책장 3×3 셋·문서 분류장 셋·횃불, 1×2 서가 여섯(y=8), 3×2 탁자(봉인 두루마리·잉크·책)와 의자, 여행등 받침·쌓인 상자·정사각 상자·책 압착기",
    });
  }
}
