// 성소 — 마을 예배당, 여신 신전, 산속 사당, 수도원 공동 침실, 수도원 필사실, 지하 납골당(계단으로만 드나듦).
const T = (s) => `tibo-${s}`;

export default function sacred(K) {
  // ── 마을 예배당 ──
  {
    const r = K.room("atlas-interior-village-chapel", "성소 · 마을 예배당", 20, 15, { wings: [{ x: 2, y: 5, w: 16, h: 7 }], door: { x: 9, y: 11 } });
    r.floor(102);
    r.one(4, 3, 56).one(14, 3, 56).stamp(T("library-220"), 9, 3).one(6, 3, 24).one(12, 3, 24);
    r.stamp(T("fantasy-altar"), 8, 5).one(7, 5, 204).one(11, 5, 204).stamp(T("library-214"), 2, 5).stamp(T("v9-1-3"), 17, 5).stamp(T("library-215"), 3, 5);
    r.rugShape([[8, 7, 10, 11], [3, 6, 15, 6]]);
    for (const x of [3, 12]) r.pews(x, 7, 2, { gap: 1 });
    r.stamp(T("library-215"), 2, 11).stamp(T("library-215"), 17, 11);
    r.object("chapel-altar-candles", "제단과 양옆 촛대", "landmark", 7, 5, 5, 2, ["예배당", "제단", "촛대", "성소"], "예배당·성당·성 예배당 북쪽 가운데");
    r.done({
      entry: [9, 12], keeper: [9, 7], targets: [[9, 7], [2, 8], [17, 8], [7, 10]],
      use: "시골 마을의 작은 예배당. 북쪽 제단 앞에서 신부가 설교하고, 마을 사람은 뒷모습 긴 의자 넷에 앉아 제단을 본다(모두 북쪽을 봄). 가운데 붉은 통로로 들어와 제단 앞 가로 통로에서 무릎 꿇는다",
      note: "크림 벽·널 바닥 102, 16×7칸. 커튼 창 둘·직조 벽걸이·횃불 둘, 제단 3×2·촛대 둘(위층 통행), 말린 꽃병·향로·관목 화분 셋, 붉은 T자 통로, 뒷모습 긴 의자 4×2 두 줄×둘",
    });
  }
  // ── 여신 신전 ──
  {
    const r = K.room("atlas-interior-goddess-temple", "성소 · 여신 신전", 24, 17, { wings: [{ x: 2, y: 5, w: 20, h: 9 }], door: { x: 12, y: 13 }, wall: "gold-brick" });
    r.floor(1999);
    r.curtain(9, 3).curtain(14, 3).statue(12, 5).one(11, 5, 204).one(13, 5, 204).one(5, 3, 24).one(18, 3, 24);
    r.stamp(T("fantasy-altar"), 11, 7).stamp(T("brazier"), 9, 8).stamp(T("brazier"), 15, 8);
    for (const y of [6, 10]) r.pillar(3, y).pillar(20, y);
    r.rugShape([[11, 9, 13, 13], [5, 9, 18, 9]]);
    for (const x of [5, 14]) r.pews(x, 10, 2, { gap: 0 });
    r.rug("teal", 4, 6, 8, 7).rug("teal", 15, 6, 19, 7);
    r.stamp(T("v9-1-3"), 6, 5).stamp(T("v9-1-3"), 17, 5).stamp(T("library-214"), 7, 5).stamp(T("library-214"), 16, 5);
    r.done({
      entry: [12, 14], keeper: [12, 9], targets: [[12, 9], [2, 12], [21, 12], [8, 6], [10, 7]],
      use: "성읍의 여신 신전. 붉은 커튼 사이 여신상 앞 제단에서 무녀가 기도하고, 화로 둘이 불을 지킨다. 참배객은 뒷모습 긴 의자에 앉아 여신상을 본다(모두 북쪽을 봄). 양쪽 기둥 사이로 향로·말린 꽃을 올린다",
      note: "금박 벽돌 벽·사암 바닥 1999, 20×9칸. 붉은 대형 커튼 둘·여신 석상·촛대 둘·횃불 둘, 제단 3×2·화로 둘, 기둥 넷, 붉은 T자 통로·청록 깔개 둘, 뒷모습 긴 의자 4×2 두 줄×둘(붙여 놓음), 향로 둘·말린 꽃병 둘",
    });
  }
  // ── 산속 사당 ──
  {
    const r = K.room("atlas-interior-mountain-shrine", "성소 · 산속 사당", 16, 12, { wings: [{ x: 2, y: 5, w: 12, h: 4 }], door: { x: 7, y: 8 }, wall: "moss-stone" });
    r.floor(43);
    r.stamp(T("medieval-reliquary"), 6, 5).statue(4, 5).statue(10, 5).one(5, 5, 204).one(9, 5, 204).stamp(T("library-228"), 7, 3).stamp(T("library-208"), 3, 3).stamp(T("library-208"), 12, 3);
    r.mat(5, 7, 9, 8).stamp(T("library-024"), 2, 7).stamp(T("library-137"), 12, 7).stamp(T("v9-1-3"), 13, 5).stamp(T("library-207"), 2, 5);
    r.done({
      entry: [7, 9], keeper: [7, 7], targets: [[7, 7], [3, 8], [11, 8]],
      use: "산길 고개의 작은 사당. 목조 제단을 석상 둘이 지키고, 순례자는 짚 깔개에 무릎 꿇고 꿀 항아리·술 항아리를 바친다. 짚 화환과 덩굴 화분이 벽에 걸렸다",
      note: "이끼 석벽·짙은 초록 자갈 43, 12×4칸. 목조 제단 3×2·석상 둘·촛대 둘, 짚 화환·덩굴 걸이 화분 둘, 짚 깔개 기도 자리, 꿀 항아리·술 항아리·향로·분재 화분",
    });
  }
  // ── 수도원 공동 침실 ──
  {
    const r = K.room("atlas-interior-monastery-dorm", "성소 · 수도원 공동 침실", 22, 15, { wings: [{ x: 2, y: 5, w: 18, h: 7 }], door: { x: 10, y: 11 }, wall: "stone-brick" });
    r.floor(102);
    for (const x of [4, 8, 13, 17]) r.one(x, 3, 54);
    r.stamp(T("library-220"), 10, 3);
    for (const x of [2, 4, 6, 14, 16, 18]) r.bed(x, 5).stamp(T("library-045"), x, 7).bed(x, 10).stamp(T("v8-1-3"), x, 9);
    r.stamp(T("lectern"), 10, 5).one(9, 5, 204).one(11, 5, 204).stamp(T("v9-1-3"), 12, 5);
    r.rug("red", 8, 7, 12, 11);
    r.object("monk-bed-row", "수도사 침상 셋과 궤짝", "furniture", 2, 5, 5, 3, ["수도원", "침상", "궤짝", "공동 침실"], "수도원·병영·고아원 공동 침실");
    r.done({
      entry: [10, 12], keeper: [10, 7], targets: [[10, 7], [3, 8], [19, 8], [8, 6]],
      use: "산속 수도원의 공동 침실. 수도사 열두 명이 좌우 침상에서 자고, 발치 궤짝에 옷을 넣고 세면대에서 씻는다. 가운데 독서대에서 새벽 기도문을 읽고, 촛대와 향로가 곁에 선다",
      note: "석벽·널 바닥 102, 18×7칸. 창 넷·직조 벽걸이, 침상 열둘(좌우 세 개×두 줄), 궤짝 여섯·세면대 여섯, 독서대·촛대 둘·향로, 붉은 가운데 깔개",
    });
  }
  // ── 수도원 필사실 ──
  {
    const r = K.room("atlas-interior-monastery-scriptorium", "성소 · 수도원 필사실", 22, 15, { wings: [{ x: 2, y: 5, w: 18, h: 7 }], door: { x: 10, y: 11 }, wall: "stone-brick" });
    r.floor(163);
    r.bookcase(2, 4).bookcase(17, 4).one(7, 3, 54).one(13, 3, 54).stamp(T("library-075"), 10, 3).stamp(T("library-075"), 11, 3);
    r.stamp(T("lectern"), 10, 5).stamp(T("library-081"), 8, 5).stamp(T("library-082"), 12, 5).stamp(T("v4-5-2"), 15, 5);
    for (const y of [6, 9]) for (const x of [3, 6, 13, 16]) r.stamp(T("warm-scribe-desk"), x, y).chair("s", x, y + 2);
    r.rug("red", 9, 7, 11, 11);
    r.object("scribe-desk-pair", "필경사 책상 둘과 뒷모습 의자", "furniture", 3, 6, 5, 3, ["필사실", "책상", "수도원", "서고"], "수도원 필사실·학원·관청 서기실");
    r.done({
      entry: [10, 12], keeper: [10, 7], targets: [[10, 7], [5, 8], [15, 8], [8, 11], [2, 7]],
      use: "수도원 필사실. 수도사 여덟이 필경사 책상에 앉아(모두 북쪽을 봄) 책을 베끼고, 뒷벽 독서대에서 원장이 원본을 읽는다. 책 압착기로 제본하고 종이 두루마리를 받침에서 꺼낸다",
      note: "석벽·석판 바닥 163, 18×7칸. 3×3 책장 둘·창 둘·두루마리 걸이 둘, 독서대·책 압착기·종이 두루마리 받침·촛대 탁자, 필경사 책상 2×2 여덟과 뒷모습 의자 268 여덟(책상 남쪽), 붉은 가운데 깔개",
    });
  }
  // ── 지하 납골당 ──
  {
    const r = K.room("atlas-interior-crypt", "성소 · 지하 납골당", 22, 15, { wings: [{ x: 2, y: 5, w: 18, h: 7 }], door: { x: 10, y: 11 }, wall: "dark-stone" });
    r.floor(42).closeDoor(10, 12);
    r.stairsUp(11, 5).one(4, 3, 24).one(16, 3, 24);
    r.stamp(T("medieval-reliquary"), 15, 5).statue(14, 5).statue(18, 5).one(19, 5, 204).one(13, 5, 204);
    for (const y of [8, 10]) r.statue(6, y).statue(13, y);
    for (const [x, y] of [[2, 7], [3, 7], [2, 8], [18, 7], [18, 8], [16, 10], [17, 10], [17, 11]]) r.stamp(T("v10-1-0"), x, y);
    r.statue(2, 5).statue(6, 5).stamp(T("v10-1-0"), 4, 5).stamp(T("v10-1-0"), 5, 5).one(7, 8, 204).one(12, 8, 204).one(15, 8, 204);
    r.rug("red", 9, 7, 11, 11).stamp(T("library-105"), 19, 11).stamp(T("v9-1-3"), 2, 9);
    r.done({
      entry: [10, 6], targets: [[10, 6], [16, 7], [4, 9], [18, 11], [14, 11]],
      use: "성당 지하 납골당. 성당의 1×1 계단으로 내려오면 뒷벽 돌계단 발치에 선다. 붉은 통로 양옆에 옛 수도원장들의 석상 넷이 줄지어 서고, 동쪽 목조 제단을 석상 둘이 지킨다. 벽가 봉인 상자에 유골을 모셨다",
      note: "어두운 석벽·돌바닥 42, 18×7칸. 남쪽 문은 천장으로 닫음, 뒷벽 3칸 폭 오르막 141|111|171(x=9~11) → 성당, 횃불 둘, 목조 제단 3×2·뒷벽 석상 넷·통로 석상 넷·촛대 다섯(위층 통행), 봉인 상자(유골함) 열, 붉은 깔개·쇠사슬·향로",
    });
  }
}
