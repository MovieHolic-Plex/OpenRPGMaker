// 성 — 알현실, 회의실, 왕의 침실, 왕실 서고, 왕실 예배당, 성 부엌 ↔ 지하 저장고(계단 짝), 탑 꼭대기 방, 왕자의 방, 근위대 대기실.
const T = (s) => `tibo-${s}`;

export default function castle(K) {
  // ── 알현실 ──
  {
    const r = K.room("atlas-interior-castle-throne", "성 · 알현실", 26, 18, { wings: [{ x: 2, y: 5, w: 22, h: 10 }], door: { x: 13, y: 14 }, wall: "gold-brick" });
    r.floor(163);
    r.curtain(9, 3).curtain(15, 3).throne(12, 5).stamp(T("library-220"), 6, 3).stamp(T("library-220"), 19, 3).one(4, 3, 24).one(21, 3, 24).stamp(T("library-221"), 11, 3).stamp(T("library-221"), 14, 3);
    r.rugShape([[11, 5, 15, 6], [12, 7, 14, 14]]);
    for (const y of [7, 11]) r.pillar(4, y).pillar(21, y);
    r.armour(8, 6).armour(17, 6).stamp(T("brazier"), 10, 8).stamp(T("brazier"), 16, 8);
    r.rug("teal", 5, 8, 10, 13).rug("teal", 16, 8, 20, 13).statue(2, 5).statue(23, 5);
    for (const y of [9, 12]) r.pillar(10, y).pillar(16, y);
    r.stamp(T("medieval-armor-stand"), 6, 5).stamp(T("medieval-armor-stand"), 18, 5);
    r.object("royal-throne-dais", "왕좌와 붉은 커튼·방패 장식·붉은 카펫", "landmark", 9, 3, 8, 5, ["성", "왕좌", "알현실", "커튼"], "성 알현실 북쪽 가운데");
    r.done({
      entry: [13, 15], keeper: [13, 7], targets: [[13, 7], [5, 9], [20, 9], [2, 13], [23, 13]],
      use: "왕성의 알현실. 북쪽 가운데 왕좌에 왕이 앉고, 붉은 커튼과 방패 장식이 뒤를 두른다. 문에서 왕좌까지 붉은 카펫이 곧게 이어지고, 양옆 기둥·갑옷·화로 사이에 신하들이 선다",
      note: "금박 벽돌 벽·석판 바닥 163, 22×10칸. 왕좌 3×2와 붉은 대형 커튼 둘·방패 장식 둘·직조 벽걸이 둘·횃불 둘, 붉은 카펫(왕좌 단 5×2 + 통로 3칸 폭), 벽가 기둥 넷·카펫을 따라 늘어선 기둥 넷·갑옷 둘·갑옷 거치대 2×3 둘·석상 둘, 화로 둘, 청록 깔개 둘",
    });
  }
  // ── 회의실 ──
  {
    const r = K.room("atlas-interior-castle-council", "성 · 어전 회의실", 22, 15, { wings: [{ x: 2, y: 5, w: 18, h: 7 }], door: { x: 10, y: 11 }, wall: "stone-brick" });
    r.floor(72);
    r.stamp(T("fantasy-bookcase"), 2, 4).stamp(T("medieval-stone-fireplace"), 14, 4).stamp(T("fantasy-bookcase"), 18, 4).stamp(T("library-221"), 7, 3).stamp(T("library-220"), 10, 3).stamp(T("library-221"), 12, 3);
    r.rug("red", 5, 6, 14, 9).cloth(6, 7, 13, 8);
    r.stamp(T("library-160"), 8, 7).stamp(T("library-076"), 11, 8).stamp(T("bell"), 10, 7);
    for (let x = 6; x <= 13; x++) r.chair("n", x, 6).chair("s", x, 9);
    r.chair("w", 5, 7, "red").chair("e", 14, 8);
    r.stamp(T("library-074"), 17, 8).stamp(T("v12-1-2"), 2, 8).stamp(T("library-215"), 2, 11).stamp(T("library-215"), 19, 11);
    r.done({
      entry: [10, 12], keeper: [4, 7], targets: [[4, 7], [15, 7], [10, 10], [18, 11]],
      use: "성의 어전 회의실. 흰 천 긴 탁자 서쪽 끝 붉은 방석 의자에 왕이 앉고, 대신 열여섯이 양쪽에 앉아 전쟁과 세금을 논한다. 동벽 벽난로 곁 지도책 받침에 왕국 지도를 펼친다",
      note: "석벽·나무 바닥 72, 18×7칸. 두꺼운 책장 둘·장작 벽난로 3×3·방패 장식 둘·직조 벽걸이, 붉은 깔개 위 흰 천 탁자 8×2(다리 앞면)와 봉인 주문 두루마리·잉크·탁상 종, 탁자를 보는 의자 열여섯·붉은 방석 의자(상석)·맞은편 의자, 펼친 지도책 받침·지구본·관목 화분 둘",
    });
  }
  // ── 왕의 침실 ──
  {
    const r = K.room("atlas-interior-castle-royal-bedroom", "성 · 왕의 침실", 22, 15, { wings: [{ x: 2, y: 5, w: 18, h: 7 }], door: { x: 10, y: 11 }, wall: "purple-brick" });
    r.floor(72);
    r.one(6, 3, 56).one(13, 3, 56).stamp(T("library-218"), 8, 3).stamp(T("library-218"), 12, 3);
    r.stamp(T("fantasy-wardrobe"), 2, 4).stamp(T("warm-dresser"), 4, 5).stamp(T("medieval-canopy-bed"), 9, 4).stamp(T("library-039"), 8, 5).stamp(T("library-039"), 12, 5);
    r.stamp(T("medieval-stone-fireplace"), 15, 4).stamp(T("library-059"), 18, 5).stamp(T("library-235"), 18, 7);
    r.rug("red", 7, 7, 13, 10).fur(3, 8, 5, 10).stamp(T("v7-1-3"), 4, 9).chair("w", 3, 9, "red").chair("e", 5, 9);
    r.stamp(T("library-040"), 15, 9).chair("s", 15, 10).stamp(T("library-041"), 17, 9).stamp(T("v8-1-3"), 19, 10);
    r.object("royal-canopy-bed", "천개 침대와 협탁 둘·초상화", "furniture", 8, 3, 5, 4, ["성", "침실", "천개 침대", "왕실"], "성·저택 침실 북쪽 가운데");
    r.done({
      entry: [10, 12], keeper: [10, 8], targets: [[10, 8], [6, 9], [16, 8], [2, 11], [18, 11]],
      use: "왕의 침실. 북쪽 가운데 천개 침대에 협탁 둘과 부모 초상화, 동벽 벽난로 곁에 장작과 린넨 장, 서쪽 옷장·서랍장. 흰 모피 위 찻상에서 왕비와 차를 마시고, 화장대에서 몸단장한다",
      note: "보라 벽돌 벽·나무 바닥 72, 18×7칸. 커튼 창 둘·초상화 둘, 옷장 2×3·서랍장 2×2·천개 침대 3×3·협탁 둘, 장작 벽난로 3×3·린넨 장·장작 받침대, 붉은 깔개, 흰 모피 깔개와 찻잔 탁자·붉은 방석 의자·맞은편 의자, 화장대와 의자·타원 전신 거울·세면대",
    });
  }
  // ── 왕실 서고 ──
  {
    const r = K.room("atlas-interior-castle-library", "성 · 왕실 서고", 26, 16, { wings: [{ x: 2, y: 5, w: 22, h: 8 }], door: { x: 13, y: 12 }, wall: "stone-brick" });
    r.floor(102);
    for (const x of [2, 5, 8, 15, 18, 21]) r.bookcase(x, 4);
    r.stamp(T("library-164"), 12, 3).stamp(T("lectern"), 12, 5).stamp(T("v12-1-2"), 11, 5).stamp(T("library-083"), 14, 5);
    r.rugShape([[12, 7, 13, 12], [2, 7, 23, 7]]);
    for (const x0 of [5, 16]) {
      r.table(x0, 8, x0 + 3, 9).chair("n", x0 + 1, 7).chair("n", x0 + 2, 7).chair("s", x0 + 1, 10).chair("s", x0 + 2, 10);
      r.stamp(T("library-073"), x0, 8).stamp(T("library-076"), x0 + 3, 9).stamp(T("library-158"), x0 + 1, 8);
    }
    r.stamp(T("library-074"), 2, 10).stamp(T("v11-1-3"), 22, 10).stamp(T("library-084"), 10, 11).stamp(T("library-077"), 21, 11).stamp(T("library-215"), 2, 12);
    r.object("reading-table-four", "독서 탁자 4×2와 의자 넷·책·잉크", "furniture", 5, 7, 4, 4, ["서고", "독서", "탁자", "학원"], "서고·도서관·학원 열람실 가운데");
    r.done({
      entry: [13, 13], keeper: [12, 7], targets: [[12, 7], [4, 9], [21, 9], [14, 10], [11, 12]],
      use: "왕성의 서고. 뒷벽을 3×3 책장 여섯이 채우고, 가운데 별자리 판 아래 독서대에서 사서가 책을 읽어 준다. 양쪽 독서 탁자에 넷씩 앉아 책을 펴고, 구석 지도책 받침·천체망원경으로 왕국 지도와 별을 본다",
      note: "석벽·널 바닥 102, 22×8칸. 3×3 책장 여섯(18~80), 별자리 판 2×2·독서대·지구본·독서등, 붉은 T자 통로, 독서 탁자 4×2(다리 앞면) 둘과 탁자를 보는 의자 여덟·덮은 책 더미·잉크와 깃펜·펼친 룬 서적, 펼친 지도책 받침·천체망원경·도서관 발판·경사진 필기대·관목 화분",
    });
  }
  // ── 왕실 예배당 ──
  {
    const r = K.room("atlas-interior-castle-chapel", "성 · 왕실 예배당", 22, 16, { wings: [{ x: 2, y: 5, w: 18, h: 8 }], door: { x: 10, y: 12 }, wall: "stone-brick" });
    r.floor(163);
    r.one(4, 3, 56).one(16, 3, 56).stamp(T("library-220"), 10, 3).one(7, 3, 24).one(13, 3, 24);
    r.stamp(T("fantasy-altar"), 9, 5).one(8, 5, 204).one(12, 5, 204).statue(6, 5).statue(14, 5).one(2, 5, 204).one(19, 5, 204);
    r.rugShape([[9, 7, 11, 12], [4, 7, 16, 7]]);
    for (const x of [4, 13]) r.pews(x, 8, 2, { gap: 1 });
    r.one(17, 6, 204).stamp(T("v9-1-3"), 3, 6).stamp(T("library-215"), 2, 12).stamp(T("library-215"), 19, 12);
    r.done({
      entry: [10, 13], keeper: [10, 7], targets: [[10, 7], [3, 9], [18, 9], [12, 10]],
      use: "왕성 안 작은 예배당. 북쪽 제단 앞에서 사제가 기도를 이끌고, 왕실 사람들은 뒷모습 긴 의자 넷에 앉아 제단을 본다(모두 북쪽을 봄). 석상 둘과 촛대가 제단을 지키고, 가운데 붉은 통로로 걸어 들어간다",
      note: "석벽·석판 바닥 163, 18×8칸. 커튼 창 둘·직조 벽걸이·횃불 둘, 제단 3×2·촛대 넷(위층 통행)·석상 둘, 붉은 T자 통로, 뒷모습 긴 의자 4×2 두 줄×둘, 촛대·향로·관목 화분 둘",
    });
  }
  // ── 성 부엌 ──
  {
    const r = K.room("atlas-interior-castle-kitchen", "성 · 성 부엌", 24, 15, { wings: [{ x: 2, y: 5, w: 20, h: 7 }], door: { x: 12, y: 11 }, wall: "stone-brick" });
    r.floor(42);
    r.stamp(T("library-009"), 7, 3).stamp(T("library-012"), 10, 3).stamp(T("library-011"), 12, 3).stamp(T("hanging-herbs"), 14, 3).stamp(T("library-021"), 20, 3);
    r.stamp(T("medieval-bread-oven"), 2, 4).stamp(T("fantasy-hanging-pot"), 5, 5).stamp(T("warm-crockery"), 16, 5).stamp(T("fantasy-cupboard"), 18, 4).stamp(T("atlas-meat-rack"), 20, 5);
    r.stairsDown(14, 5);
    r.table(8, 7, 13, 8).stamp(T("library-006"), 8, 7).stamp(T("library-007"), 9, 7).stamp(T("library-020"), 12, 7).stamp(T("library-004"), 11, 8).stamp(T("library-010"), 13, 8).stool(7, 8).stool(14, 8);
    r.stamp(T("fantasy-prep-table"), 2, 9).stamp(T("fantasy-water-tub"), 5, 9);
    r.stamp(T("library-013"), 17, 9).stamp(T("library-015"), 18, 9).stamp(T("library-018"), 19, 9).stamp(T("library-019"), 20, 9).stamp(T("library-024"), 21, 9);
    r.rug("teal", 9, 9, 14, 10);
    r.object("castle-kitchen-table", "큰 조리 탁자(냄비·프라이팬·치즈·칼꽂이)와 걸상", "furniture", 7, 7, 8, 2, ["부엌", "성", "조리", "탁자"], "성·여관·수도원 부엌 가운데");
    r.done({
      entry: [12, 12], keeper: [10, 9], targets: [[10, 9], [7, 6], [15, 7], [21, 11], [4, 8]],
      use: "왕성의 큰 부엌. 서쪽 석조 화덕과 솥 걸이에서 요리하고, 가운데 긴 조리 탁자에서 요리사들이 재료를 다듬는다. 동쪽 식기장·찬장·고기 걸이, 남쪽 채소 상자·꿀 항아리. 뒷벽 가운데 1×1 내리막으로 지하 저장고에 내려간다",
      note: "석벽·돌바닥 42, 20×7칸. 컵 걸이·국자 걸이·향신료 선반·말린 약초 걸이·소시지 걸이, 석조 빵 화덕 3×3·솥 걸이 2×2·식기장·찬장·고기 걸이 2×2(새 타일), 1×1 내리막 474 → 지하 저장고, 조리 탁자 6×2(다리 앞면)와 무쇠 냄비·프라이팬·치즈·반죽 그릇·칼꽂이·걸상 둘, 조리대·물통, 밀가루·감자·당근·양배추·꿀, 청록 깔개",
    });
  }
  // ── 성 지하 저장고 ──
  {
    const r = K.room("atlas-interior-castle-cellar", "성 · 지하 저장고", 22, 14, { wings: [{ x: 2, y: 5, w: 18, h: 6 }], door: { x: 10, y: 10 }, wall: "dark-stone" });
    r.floor(42).closeDoor(10, 11);
    r.stairsUp(15, 5).one(6, 3, 24).one(18, 3, 24);
    r.stamp(T("library-229"), 2, 5).stamp(T("library-229"), 3, 5).stamp(T("library-133"), 4, 5).stamp(T("library-133"), 5, 5).stamp(T("fantasy-ale-rack"), 6, 5).stamp(T("library-134"), 9, 5).stamp(T("library-234"), 11, 5).stamp(T("library-234"), 12, 5);
    r.stamp(T("library-230"), 16, 5).stamp(T("library-232"), 17, 5).stamp(T("library-232"), 18, 5).stamp(T("library-232"), 19, 5);
    r.stamp(T("fantasy-grain-sacks"), 2, 9).stamp(T("library-013"), 6, 9).stamp(T("library-014"), 7, 9).stamp(T("library-013"), 8, 10);
    r.stamp(T("library-018"), 15, 9).stamp(T("library-019"), 16, 9).stamp(T("library-127"), 17, 9).stamp(T("library-123"), 18, 9);
    r.rug("red", 10, 8, 13, 10);
    r.object("wine-cellar-row", "술통·맥주통·포도주 선반·저장 옹기 한 줄", "prop", 2, 5, 11, 2, ["지하", "저장고", "술통", "포도주"], "성·저택·주점 지하 저장고 뒷벽");
    r.done({
      entry: [14, 6], targets: [[14, 6], [5, 8], [17, 10], [11, 10]],
      use: "성 부엌 아래 지하 저장고. 부엌의 1×1 계단으로 내려오면 동벽 돌계단 발치에 선다. 뒷벽에 둥근 통·맥주통·술통 선반·포도주 선반·저장 옹기가 늘어섰고, 앞쪽엔 곡식 자루·포대·채소 상자·소포가 쌓였다",
      note: "어두운 석벽·돌바닥 42, 18×6칸. 남쪽 문은 천장으로 닫음, 동벽 3칸 폭 오르막 141|111|171(x=13~15) → 성 부엌, 횃불 둘, 둥근 통 둘·받침대 맥주통 둘·술통 선반 3×2·포도주 선반 2×2·저장 옹기 둘, 보관 상자·쌓인 상자 셋, 식재료 자루·밀가루·쌀 포대, 당근·양배추·빈 농산물 상자·소포 더미, 붉은 깔개",
    });
  }
  // ── 탑 꼭대기 방 ──
  {
    const r = K.room("atlas-interior-castle-tower-room", "성 · 탑 꼭대기 방", 18, 13, { wings: [{ x: 2, y: 5, w: 14, h: 5 }], door: { x: 8, y: 9 }, wall: "stone-brick" });
    r.floor(12);
    r.stamp(T("library-163"), 4, 3).one(7, 3, 54).stamp(T("library-164"), 10, 3).one(14, 3, 54);
    r.bed(2, 5).stamp(T("library-039"), 3, 5).stamp(T("warm-scribe-desk"), 6, 6).chair("n", 7, 5).stamp(T("fantasy-bookcase"), 11, 5).stamp(T("v11-1-3"), 13, 5).stamp(T("fantasy-crystal-stand"), 15, 5);
    r.stamp(T("library-162"), 11, 8).stamp(T("brazier"), 13, 8).rug("red", 10, 7, 14, 9).stamp(T("library-045"), 2, 8).stamp(T("library-240"), 15, 8);
    r.done({
      entry: [8, 10], keeper: [9, 7], targets: [[9, 7], [3, 7], [14, 7], [5, 9]],
      use: "성 동탑 꼭대기 방. 왕실 점성술사가 창가 천체망원경으로 별을 보고, 필경사 책상에서 별자리를 옮겨 적는다. 붉은 깔개 위 작은 돌 제단에 의식 초를 켜고, 수정구 받침에서 앞날을 점친다",
      note: "석벽·보라 자갈 바닥 12, 14×5칸. 달 위상 벽판·창 둘·별자리 판 2×2, 침상·협탁·궤짝, 필경사 책상 2×2와 의자, 두꺼운 책장·천체망원경·수정구 받침, 붉은 깔개 위 작은 돌 제단·화로, 접이 사다리",
    });
  }
  // ── 왕자의 방 ──
  {
    const r = K.room("atlas-interior-castle-prince-room", "성 · 왕자의 방", 20, 13, { wings: [{ x: 2, y: 5, w: 16, h: 5 }], door: { x: 9, y: 9 } });
    r.floor(72);
    r.stamp(T("library-222"), 6, 3).stamp(T("library-221"), 9, 3).one(13, 3, 56).stamp(T("library-219"), 16, 3);
    r.stamp(T("fantasy-bed"), 2, 4).stamp(T("library-039"), 5, 5).stamp(T("library-042"), 6, 5).stamp(T("warm-scribe-desk"), 11, 5).chair("s", 11, 7);
    r.stamp(T("library-181"), 14, 5).stamp(T("library-191"), 15, 5).stamp(T("library-186"), 16, 5).stamp(T("library-190"), 17, 5);
    r.rug("teal", 3, 8, 8, 9).stamp(T("library-184"), 4, 8).stamp(T("library-185"), 7, 9).stamp(T("library-188"), 13, 8).stamp(T("medieval-armor-stand"), 15, 7);
    r.done({
      entry: [9, 10], keeper: [10, 7], targets: [[10, 7], [5, 7], [14, 7], [2, 9]],
      use: "어린 왕자의 방. 목제 침대와 협탁·열린 옷장이 서쪽에, 필경사 책상에서 가정교사에게 글을 배운다. 교차 연습검·방패 장식 아래 작은 갑옷 거치대가 서 있고, 동쪽엔 목마·장난감 배·장난감 상자·인형의 집",
      note: "크림 벽·나무 바닥 72, 16×5칸. 교차 나무 연습검·방패 장식·커튼 창·가족 초상화, 목제 침대 3×3·협탁·열린 옷장, 필경사 책상 2×2와 의자(268), 목마·장난감 배·장난감 상자·인형의 집, 청록 깔개 위 곰 인형·블록, 굴렁쇠·갑옷 거치대 2×3",
    });
  }
  // ── 근위대 대기실 ──
  {
    const r = K.room("atlas-interior-castle-guard-hall", "성 · 근위대 대기실", 24, 15, { wings: [{ x: 2, y: 5, w: 20, h: 7 }], door: { x: 12, y: 11 }, wall: "stone-brick" });
    r.floor(42);
    r.stamp(T("fantasy-weapon-rack"), 2, 4).stamp(T("medieval-armor-stand"), 4, 4).stamp(T("medieval-armor-stand"), 18, 4).stamp(T("fantasy-weapon-rack"), 20, 4);
    r.stamp(T("library-220"), 11, 3).stamp(T("library-220"), 12, 3).one(8, 3, 24).one(15, 3, 24).stamp(T("library-221"), 7, 3).stamp(T("library-221"), 16, 3);
    r.rug("red", 7, 6, 17, 9);
    for (const x0 of [7, 13]) {
      r.stamp(T("medieval-banquet-table"), x0, 7);
      for (let x = x0; x < x0 + 4; x++) r.chair("n", x, 6).chair("s", x, 9);
    }
    r.stamp(T("brazier"), 3, 9).stamp(T("brazier"), 20, 9).stamp(T("library-045"), 2, 11).stamp(T("library-045"), 21, 11).stamp(T("library-105"), 5, 11);
    r.done({
      entry: [12, 12], keeper: [12, 10], targets: [[12, 10], [6, 8], [18, 8], [3, 7], [20, 7]],
      use: "왕성의 근위대 대기실. 양 구석에 무기 거치대·갑옷 거치대가 서고, 가운데 붉은 깔개 위 연회 식탁 둘에 근위병 열여섯이 둘러앉아 교대를 기다린다. 화로 곁 궤짝에 장비를 넣는다",
      note: "석벽·돌바닥 42, 20×7칸. 무기 거치대 2×3 둘·갑옷 거치대 2×3 둘, 직조 벽걸이 둘·방패 장식 둘·횃불 둘, 붉은 깔개 위 연회 식탁 4×2 둘과 탁자를 보는 의자 열여섯, 화로 둘·궤짝 둘·쇠사슬 뭉치",
    });
  }
}
