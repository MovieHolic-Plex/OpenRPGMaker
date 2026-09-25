// 공공시설 2 — 경비 초소, 마을 감옥, 병영 숙소, 시청 회의실, 우체국, 고아원.
const T = (s) => `tibo-${s}`;

export default function civic2(K) {
  // ── 경비 초소 ──
  {
    const r = K.room("atlas-interior-guard-post", "치안 · 성문 경비 초소", 18, 13, { wings: [{ x: 2, y: 5, w: 14, h: 5 }], door: { x: 8, y: 9 }, wall: "stone-brick" });
    r.floor(42);
    r.stamp(T("fantasy-weapon-rack"), 2, 4).stamp(T("medieval-armor-stand"), 4, 4).stamp(T("v6-1-0"), 7, 3).stamp(T("v8-1-0"), 11, 3).one(10, 3, 24).one(14, 3, 54);
    r.table(9, 6, 11, 7).stamp(T("library-139"), 9, 6).stamp(T("library-135"), 11, 6).chair("n", 10, 5).chair("s", 9, 8).chair("s", 11, 8).chair("w", 8, 7);
    r.bed(14, 5).bed(15, 5).stamp(T("library-045"), 15, 7).stamp(T("library-194"), 13, 9);
    r.rug("red", 3, 7, 7, 9).stamp(T("brazier"), 5, 8).stamp(T("library-105"), 2, 9).stamp(T("library-229"), 12, 5);
    r.done({
      entry: [8, 10], keeper: [10, 8], targets: [[10, 8], [3, 7], [13, 7], [7, 6]],
      use: "성문 곁 경비 초소. 교대 경비병이 가운데 탁자에 둘러앉아 주사위를 굴리고, 뒷벽 무기 거치대·갑옷 거치대에서 무장한다. 동쪽 침상에서 번갈아 자고, 붉은 깔개 위 화로에 손을 녹인다. 수배 게시판과 열쇠판이 벽에 걸렸다",
      note: "석벽·돌바닥 42, 14×5칸. 무기 거치대 2×3·갑옷 거치대 2×3, 메모 게시판·열쇠판·횃불·창, 탁자 3×2(다리 앞면)와 주사위 쟁반·맥주잔, 탁자를 보는 의자 넷, 침상 둘·궤짝·가죽 배낭, 붉은 깔개와 화로·쇠사슬 뭉치·둥근 통",
    });
  }
  // ── 마을 감옥 ──
  {
    const r = K.room("atlas-interior-town-jail", "치안 · 마을 감옥", 22, 15, { wings: [{ x: 2, y: 5, w: 18, h: 7 }], door: { x: 10, y: 11 }, wall: "dark-stone" });
    r.floor(42);
    r.one(4, 3, 24).one(10, 3, 24).one(16, 3, 24);
    r.pillar(7, 5).pillar(13, 5);
    r.bed(2, 5).mat(3, 5, 6, 6).stamp(T("library-056"), 6, 5);
    r.bed(8, 5).mat(9, 5, 12, 6).stamp(T("library-065"), 12, 5);
    r.bed(14, 5).bed(19, 5).mat(15, 5, 18, 6).stamp(T("library-056"), 16, 5);
    r.bars(2, 7, 7, 4).bars(8, 13, 7, 10).bars(14, 19, 7, 16);
    r.table(3, 9, 5, 9).stamp(T("library-073"), 3, 9).stamp(T("library-076"), 4, 9).chair("n", 4, 8).chair("s", 5, 10);
    r.stamp(T("v8-1-0"), 2, 3).stamp(T("fantasy-weapon-rack"), 18, 9).stamp(T("brazier"), 15, 9).stamp(T("library-105"), 8, 11).stamp(T("library-061"), 2, 10);
    r.rug("red", 9, 9, 14, 10);
    r.object("jail-cell-row", "창살 감방 셋(침상·짚 깔개·요강)", "landmark", 2, 5, 18, 3, ["감옥", "감방", "창살", "지하"], "감옥·성 지하 감옥 뒷벽");
    r.done({
      entry: [10, 12], keeper: [4, 10], targets: [[4, 10], [10, 8], [16, 8], [17, 11]], sealed: [[2, 5, 19, 6]],
      use: "마을 감옥. 뒷벽 감방 셋이 창살 한 줄로 막혔고(문은 잠겨 이벤트로 연다), 죄수는 짚 깔개 위 침상에서 잔다. 간수는 앞쪽 탁자에서 장부를 적고, 무기 거치대와 화로가 남쪽에 있다",
      note: "어두운 석벽·돌바닥 42, 18×7칸. 횃불 셋·열쇠판, 감방 셋(기둥 둘로 나눔)마다 침상·짚 깔개·요강/양동이, 창살 한 줄 2084~2086과 감방 문 2087 셋(막힘, 안쪽 sealed), 한 줄 탁자와 장부·잉크·간수 의자 둘, 무기 거치대·화로·쇠사슬·빗자루·붉은 깔개",
    });
  }
  // ── 병영 숙소 ──
  {
    const r = K.room("atlas-interior-barracks", "치안 · 병영 숙소", 24, 15, { wings: [{ x: 2, y: 5, w: 20, h: 7 }], door: { x: 12, y: 11 }, wall: "stone-brick" });
    r.floor(102);
    for (const x of [4, 8, 16, 20]) r.one(x, 3, 54);
    r.stamp(T("library-221"), 11, 3).stamp(T("library-220"), 12, 3).stamp(T("library-221"), 13, 3);
    for (const x of [3, 5, 7, 16, 18, 20]) r.bed(x, 5).stamp(T("library-045"), x, 7).bed(x, 10).stamp(T("library-045"), x, 9);
    r.table(11, 6, 12, 8).stamp(T("library-136"), 11, 6).stamp(T("library-008"), 12, 7).chair("n", 11, 5).chair("n", 12, 5).chair("w", 10, 8).chair("e", 13, 8);
    r.stamp(T("fantasy-weapon-rack"), 8, 4).stamp(T("fantasy-weapon-rack"), 14, 4);
    r.rug("red", 10, 9, 14, 11);
    r.object("barracks-bunks", "병사 침상과 발치 궤짝", "furniture", 3, 5, 5, 3, ["병영", "침상", "궤짝", "군대"], "병영·선원 숙소·수도원 공동 침실");
    r.done({
      entry: [12, 12], keeper: [12, 9], targets: [[12, 9], [4, 8], [19, 8], [2, 11], [21, 11]],
      use: "성의 병영 숙소. 좌우로 병사 열두 명의 침상이 발치 궤짝을 끼고 두 줄로 섰고, 가운데 탁자에서 식사하고 뒷벽 깃발 아래 무기 거치대에서 창을 든다",
      note: "석벽·널 바닥 102, 20×7칸. 창 넷·방패 장식 둘·직조 벽걸이, 침상 열둘(좌우 세 개×두 줄)과 궤짝 열둘, 가운데 탁자 2×3(다리 앞면)과 맥주잔 쟁반·접시 더미, 탁자를 보는 의자 넷, 무기 거치대 둘, 붉은 입구 깔개",
    });
  }
  // ── 시청 회의실 ──
  {
    const r = K.room("atlas-interior-town-hall", "관청 · 시청 회의실", 26, 16, { wings: [{ x: 2, y: 5, w: 22, h: 8 }], door: { x: 13, y: 12 }, wall: "stone-brick" });
    r.floor(163);
    r.stamp(T("fantasy-bookcase"), 2, 4).stamp(T("fantasy-bookcase"), 22, 4).stamp(T("library-220"), 9, 3).stamp(T("library-220"), 16, 3).stamp(T("v6-2-0"), 5, 3).stamp(T("v9-1-0"), 19, 3);
    r.redChair(13, 4).cloth(11, 6, 15, 7).stamp(T("library-158"), 12, 6).stamp(T("bell"), 14, 6).chair("w", 10, 6).chair("w", 10, 7).chair("e", 16, 6).chair("e", 16, 7);
    r.stamp(T("warm-scribe-desk"), 4, 6).chair("n", 5, 5).stamp(T("warm-scribe-desk"), 20, 6).chair("n", 20, 5);
    for (const x of [3, 7, 16, 20]) r.pews(x, 10, 1);
    r.rug("teal", 6, 6, 9, 8).rug("teal", 17, 6, 19, 8);
    r.rugShape([[11, 9, 15, 12], [2, 9, 23, 9]]);
    r.stamp(T("library-215"), 2, 12).stamp(T("library-215"), 23, 12);
    r.object("council-table", "회의 탁자(흰 천)와 시장 붉은 의자", "furniture", 10, 4, 7, 4, ["시청", "회의", "탁자", "붉은 의자"], "시청·성 회의실 북쪽");
    r.done({
      entry: [13, 13], keeper: [13, 8], targets: [[13, 8], [5, 8], [20, 8], [2, 11], [23, 9]],
      use: "성읍 시청의 회의실. 시장은 뒷벽 붉은 의자에 앉아 흰 천 탁자 너머로 의원 넷과 회의하고, 양옆 필경사가 책상에서 회의록을 적는다. 시민은 뒷모습 긴 의자에 앉아 방청한다",
      note: "석벽·석판 바닥 163, 22×8칸. 두꺼운 책장 둘·직조 벽걸이 둘·강 지도 액자·벽시계, 붉은 의자(시장)와 흰 천 탁자 5×2(다리 앞면)·펼친 룬 서적·탁상 종, 탁자를 보는 의자 넷, 필경사 책상 2×2 둘과 의자, 뒷모습 긴 의자 4×2 넷, 붉은 T자 카펫, 관목 화분 둘",
    });
  }
  // ── 우체국 ──
  {
    const r = K.room("atlas-interior-post-office", "관청 · 우체국", 20, 13, { wings: [{ x: 2, y: 5, w: 16, h: 5 }], door: { x: 9, y: 9 } });
    r.floor(72);
    r.stamp(T("v6-1-0"), 3, 3).stamp(T("v6-2-0"), 8, 3).stamp(T("v9-1-0"), 11, 3).one(14, 3, 54);
    r.stamp(T("library-078"), 2, 5).stamp(T("library-078"), 3, 5).stamp(T("library-123"), 12, 5).stamp(T("library-124"), 14, 5).stamp(T("library-082"), 16, 5);
    r.table(5, 7, 8, 7).stamp(T("library-079"), 5, 7).stamp(T("library-080"), 8, 7).chair("n", 6, 6).chair("n", 8, 6);
    r.stamp(T("v8-1-1"), 11, 8).stamp(T("library-123"), 16, 8).stamp(T("warm-bench"), 12, 8);
    r.rug("red", 5, 8, 10, 9).stamp(T("library-215"), 2, 9);
    r.done({
      entry: [9, 10], keeper: [7, 6], targets: [[7, 6], [4, 8], [15, 7], [10, 8]],
      use: "성읍 우체국. 계산대 둘 뒤에 직원이 앉아(남쪽을 봄) 편지를 받아 봉랍을 찍고, 뒷벽 문서 분류장에 나눠 꽂는다. 동쪽엔 소포 더미·포장지 걸이가 있고, 손님은 우편함에 편지를 넣거나 긴 의자에서 기다린다",
      note: "크림 벽·나무 바닥 72, 16×5칸. 메모 게시판·강 지도 액자·벽시계·창, 문서 분류장 둘·소포 더미 둘·포장지 걸이·종이 두루마리 받침, 한 줄 계산대 4×1(다리 앞면)과 편지 쟁반·봉랍 도구, 직원 의자 둘(267), 우편함·쿠션 긴 의자·붉은 깔개·관목 화분",
    });
  }
  // ── 고아원 ──
  {
    const r = K.room("atlas-interior-orphanage", "관청 · 고아원", 22, 15, { wings: [{ x: 2, y: 5, w: 18, h: 7 }], door: { x: 10, y: 11 } });
    r.floor(72);
    for (const x of [4, 8, 14, 18]) r.one(x, 3, 56);
    r.stamp(T("library-219"), 11, 3).stamp(T("v9-1-0"), 12, 4);
    for (const x of [2, 4, 6, 8]) r.bed(x, 5).stamp(T("library-038"), x + 1, 5);
    r.stamp(T("library-059"), 11, 5).stamp(T("library-043"), 12, 5);
    r.stamp(T("fantasy-dining-set"), 15, 5).stamp(T("library-215"), 18, 5);
    r.mat(3, 8, 9, 10).stamp(T("library-181"), 3, 8).stamp(T("library-185"), 5, 9).stamp(T("library-184"), 7, 8).stamp(T("library-186"), 9, 10).stamp(T("library-182"), 5, 10);
    r.stamp(T("library-192"), 13, 9).stamp(T("library-190"), 16, 9).stamp(T("library-183"), 17, 9).stamp(T("library-188"), 19, 9);
    r.rug("teal", 12, 8, 18, 8).stamp(T("library-044"), 2, 11).stamp(T("library-065"), 19, 11);
    r.object("toy-corner", "짚 깔개 놀이 자리(목마·블록·곰 인형·장난감 상자)", "prop", 3, 8, 7, 3, ["고아원", "장난감", "아이 방", "놀이"], "고아원·아이 방·유치원 바닥");
    r.done({
      entry: [10, 12], keeper: [10, 8], targets: [[10, 8], [2, 8], [14, 8], [19, 7], [8, 9]],
      use: "성당이 운영하는 고아원. 뒷벽 작은 침상 넷에서 아이들이 자고, 동쪽 긴 식탁과 벤치에서 함께 먹는다. 짚 깔개 위에서 목마·블록·곰 인형을 갖고 놀고, 인형극 무대·인형의 집 앞에 모인다",
      note: "크림 벽·나무 바닥 72, 18×7칸. 커튼 창 넷·가족 초상화·벽시계, 침상 넷과 베개 더미, 린넨 장·닫힌 옷장, 긴 식탁과 벤치 3×3·관목 화분, 짚 깔개 위 목마·나무 블록·곰 인형·장난감 상자·장난감 수레, 인형극 무대 2×2·인형의 집·헝겊 인형·굴렁쇠, 청록 깔개, 요람·청소 양동이",
    });
  }
}
