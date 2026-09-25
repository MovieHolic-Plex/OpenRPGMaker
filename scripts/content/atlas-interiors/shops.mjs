// 가게 — 무기·방어구·도구·잡화·꽃·빵·정육·양복·보석·서점·골동품·마법 도구·약방·지도.
// 한 틀: 뒷벽 진열(벽면 두 줄 + 첫 바닥 줄), 둘째 줄은 주인이 다니는 카운터 뒤 통로, 셋째 줄에 카운터(끝 한 칸을 비워
// 주인이 드나듦), 앞쪽 손님 자리에 옆벽 진열과 입구 깔개.
import shops2 from "./shops2.mjs";
const T = (s) => `tibo-${s}`;
const shell = (K, id, name, w, wall, door, h = 7) => K.room(id, name, w, h + 8, { wings: [{ x: 2, y: 5, w: w - 4, h }], door: { x: door, y: 4 + h }, wall });

export default function shops(K) {
  // ── 무기점 ──
  {
    const r = shell(K, "atlas-interior-weapon-shop", "가게 · 무기점", 20, "stone-brick", 9);
    r.floor(42);
    r.stamp(T("fantasy-weapon-rack"), 2, 3).stamp(T("fantasy-weapon-rack"), 4, 3).stamp(T("library-221"), 6, 3).stamp(T("library-222"), 7, 3).stamp(T("library-221"), 9, 3);
    r.stamp(T("fantasy-weapon-rack"), 10, 3).block(12, 4, [[263], [293]]).block(13, 4, [[263], [293]]).one(14, 3, 24).stamp(T("grindstone"), 16, 4);
    r.table(4, 7, 12, 7).stamp(T("library-122"), 7, 7).stamp(T("library-238"), 11, 7).stamp(T("library-128"), 5, 7);
    r.stamp(T("fantasy-weapon-rack"), 15, 8).stamp(T("library-229"), 2, 9).stamp(T("library-232"), 3, 10).stamp(T("library-106"), 2, 11);
    r.rug("red", 7, 9, 11, 11).stamp(T("library-215"), 17, 11).stamp(T("anvil"), 13, 9);
    r.object("weapon-shop-wall", "무기점 뒷벽 진열", "furniture", 2, 3, 13, 3, ["무기점", "무기 거치대", "방패", "검 진열대"], "무기점·병영·무기고 뒷벽");
    r.done({
      entry: [9, 12], keeper: [8, 6], targets: [[8, 6], [8, 8], [14, 10], [3, 8]],
      use: "검과 창을 파는 무기점. 손님은 붉은 깔개에서 카운터로 다가가고, 주인은 뒷벽 무기 거치대·검 진열대 앞 통로에서 물건을 꺼내 카운터(동전 쟁반·금고함) 너머로 건넨다. 오른쪽 숫돌로 날을 세워 준다",
      note: "석벽·돌바닥 42, 16×7칸. 뒷벽 무기 거치대 셋·방패 장식 둘·교차 연습검·검 진열대 263/293 둘·횃불·숫돌, 둘째 줄은 주인 통로, 셋째 줄 한 줄 카운터 9칸(다리까지, 양 끝을 비워 드나듦) 위 저울추 상자·동전 쟁반·금고함, 앞쪽 오른쪽 무기 거치대·모루, 왼쪽 통·쌓인 상자·고철 상자, 입구 붉은 깔개·야자",
    });
  }
  // ── 방어구점 ──
  {
    const r = shell(K, "atlas-interior-armor-shop", "가게 · 방어구점", 22, "stone-brick", 10);
    r.floor(42);
    for (const x of [2, 5, 14, 17]) r.stamp(T("medieval-armor-stand"), x, 3);
    r.stamp(T("library-221"), 7, 3).stamp(T("library-221"), 8, 3).stamp(T("library-221"), 11, 3).stamp(T("library-221"), 12, 3).one(10, 3, 290).one(9, 3, 24).one(13, 3, 24);
    r.armour(19, 4);
    r.table(3, 7, 15, 7).stamp(T("library-122"), 9, 7).stamp(T("library-120"), 5, 7).stamp(T("library-107"), 12, 7);
    for (const x of [3, 6]) r.armour(x, 9);
    r.armour(16, 9).armour(17, 9).stamp(T("library-102"), 18, 7);
    r.rug("teal", 7, 9, 13, 11).stamp(T("library-045"), 2, 11).stamp(T("library-215"), 19, 11);
    r.done({
      entry: [10, 12], keeper: [9, 6], targets: [[9, 6], [9, 8], [4, 10], [17, 11]],
      use: "갑옷과 방패를 파는 방어구점. 뒷벽 갑옷 거치대 넷과 벽 방패·걸어 둔 갑옷을 보고, 카운터에서 주인에게 치수를 맞춘다. 손님 자리 양옆 갑옷 전시대에서 입어 본다",
      note: "석벽·돌바닥 42, 18×7칸. 뒷벽 갑옷 거치대 2×3 넷·방패 벽 장식 넷·벽에 건 갑옷 290·횃불 둘, 오른쪽 갑옷 전시대 87/117 둘, 한 줄 카운터 13칸(구두 골·동전 쟁반·리벳 상자, 양 끝 드나듦), 앞쪽 갑옷 전시대 넷·편자 걸이, 청록 깔개, 궤짝·화분",
    });
  }
  // ── 도구점 ──
  {
    const r = shell(K, "atlas-interior-tool-shop", "가게 · 도구점", 20, "cream", 9);
    r.floor(102);
    r.stamp(T("library-088"), 2, 3).stamp(T("library-089"), 3, 3).stamp(T("library-132"), 5, 4).stamp(T("library-124"), 8, 4).stamp(T("library-088"), 11, 3).stamp(T("library-132"), 13, 4).stamp(T("library-240"), 15, 5).stamp(T("library-231"), 16, 5);
    r.table(3, 7, 12, 7).stamp(T("library-090"), 4, 7).stamp(T("library-091"), 6, 7).stamp(T("library-096"), 8, 7).stamp(T("library-122"), 10, 7).stamp(T("library-107"), 12, 7);
    r.table(13, 8, 15, 9).stamp(T("library-087"), 13, 8).stamp(T("library-090"), 15, 8).stamp(T("library-107"), 14, 9);
    r.stamp(T("library-092"), 13, 11).stamp(T("library-094"), 15, 11).stamp(T("library-062"), 17, 8).stamp(T("library-061"), 17, 10);
    r.stamp(T("library-233"), 2, 9).stamp(T("library-105"), 3, 9).stamp(T("library-065"), 2, 10).stamp(T("library-211"), 2, 11);
    r.rug("red", 6, 9, 11, 11);
    r.done({
      entry: [9, 12], keeper: [8, 6], targets: [[8, 6], [8, 8], [16, 9], [3, 10]],
      use: "망치·톱·대패·밧줄·양동이를 파는 도구점. 뒷벽 공구 벽판·잡화 선반에서 고르고 카운터에서 값을 치른다. 앞쪽 각목 더미와 톱질 받침은 목수 손님용",
      note: "크림 벽·널 바닥 102, 16×7칸. 뒷벽 공구 벽판 둘·망치 걸이·잡화 선반 둘·포장지 걸이·긴 공구 상자·접이 사다리, 한 줄 카운터 10칸 위 대패·끌꽂이·직각자·동전 쟁반·리벳 상자, 앞쪽 오른쪽 진열 탁자 3×2(목공 톱·대패·리벳 상자)와 각목 더미·톱질 받침, 오른벽 대걸레·빗자루, 왼벽 뚜껑 바구니·쇠사슬·청소 양동이·물뿌리개 한 덩이, 입구 붉은 깔개",
    });
  }
  // ── 잡화점 ──
  {
    const r = shell(K, "atlas-interior-general-store", "가게 · 잡화점", 22, "cream", 10);
    r.floor(72);
    for (const x of [2, 4, 6]) r.stamp(T("library-132"), x, 4);
    r.stamp(T("v4-1-2"), 8, 4).stamp(T("v4-2-1"), 9, 4).stamp(T("v3-1-1"), 10, 4).stamp(T("library-109"), 11, 4).stamp(T("library-124"), 12, 4).stamp(T("library-123"), 14, 4).stamp(T("library-232"), 16, 4).stamp(T("library-232"), 17, 4).stamp(T("library-229"), 18, 4).stamp(T("library-229"), 19, 4);
    r.table(3, 7, 13, 7).stamp(T("balance-scale"), 4, 7).stamp(T("library-121"), 8, 7).stamp(T("library-122"), 10, 7).stamp(T("library-213"), 12, 7);
    r.stamp(T("library-013"), 15, 8).stamp(T("library-014"), 16, 8).stamp(T("library-018"), 17, 8).stamp(T("library-019"), 18, 8).stamp(T("library-015"), 19, 8).stamp(T("library-130"), 19, 9);
    r.stamp(T("library-126"), 2, 9).stamp(T("library-129"), 3, 9).stamp(T("library-233"), 2, 11).stamp(T("library-142"), 3, 11).stamp(T("library-127"), 5, 11);
    r.rug("teal", 8, 9, 12, 11).stamp(T("library-239"), 19, 10);
    r.object("general-store-shelves", "잡화점 선반 벽", "furniture", 2, 4, 18, 2, ["잡화점", "선반", "상자", "포대"], "잡화점·도구점 뒷벽");
    r.done({
      entry: [10, 12], keeper: [9, 6], targets: [[9, 6], [9, 8], [17, 10], [4, 10]],
      use: "마을 잡화점. 뒷벽 잡화 선반·수납장에 생필품이, 오른쪽에 포대·채소 상자가 쌓여 있다. 손님은 장바구니를 들고 골라 카운터 저울에 달아 값을 치른다",
      note: "크림 벽·나무 바닥 72, 18×7칸. 뒷벽 잡화 선반 셋·바구니 수납장·필기 수납장·서랍장·천 두루마리 선반·포장지 걸이·소포 더미·쌓인 상자 둘·뚜껑 통 둘, 한 줄 카운터 11칸(상인 저울·돈 서랍·동전 쟁반·구근 쟁반), 오른쪽 밀가루·쌀 포대·당근·양배추 상자·감자 바구니와 장바구니·우산꽂이, 왼쪽 상품 진열 받침·가격 표지판·뚜껑 바구니·코르크 바구니·빈 농산물 상자, 청록 깔개",
    });
  }
  // ── 꽃집 ──
  {
    const r = shell(K, "atlas-interior-flower-shop", "가게 · 꽃집", 18, "cream", 8, 6);
    r.floor(102);
    r.stamp(T("library-208"), 2, 3).stamp(T("library-216"), 3, 5).stamp(T("library-205"), 5, 4).stamp(T("library-209"), 7, 4).one(9, 3, 54).stamp(T("library-208"), 10, 3).stamp(T("library-205"), 11, 4).stamp(T("library-209"), 13, 4).stamp(T("library-207"), 15, 5);
    r.table(3, 7, 10, 7).stamp(T("library-210"), 3, 7).stamp(T("library-213"), 5, 7).stamp(T("library-122"), 8, 7).stamp(T("library-213"), 9, 7);
    for (const [x, y, k] of [[2, 9, "v7-1-1"], [3, 9, "v7-2-1"], [4, 9, "v7-3-1"], [12, 8, "v7-1-1"], [13, 8, "v7-3-1"], [14, 8, "v7-2-1"], [15, 8, "library-215"], [12, 9, "library-214"], [14, 10, "library-206"], [15, 10, "v10-1-2"]]) r.stamp(T(k), x, y);
    r.stamp(T("library-211"), 2, 10).stamp(T("library-212"), 4, 10).rug("teal", 6, 9, 10, 10);
    r.done({
      entry: [8, 11], keeper: [7, 6], targets: [[7, 6], [7, 8], [13, 9], [5, 10]],
      use: "꽃과 화분을 파는 꽃집. 뒷벽 창가에 덩굴 걸이 화분·고사리·야자가 늘어서고, 카운터에서 모종 쟁반·구근을 판다. 양옆 바닥에 흰·노랑·푸른 꽃 화분과 선인장·버섯 화분을 줄지어 두었다",
      note: "크림 벽·널 바닥 102, 14×6칸. 뒷벽 덩굴 걸이 화분 둘·창가 약초 화분함·고사리 둘·키 큰 야자 둘·분재·창, 한 줄 카운터 8칸(모종 쟁반·구근 쟁반 둘·동전 쟁반), 왼쪽 꽃 화분 셋과 물뿌리개·원예 도구 바구니, 오른쪽 꽃 화분 넷·말린 꽃병·선인장·푸른 버섯 화분, 청록 깔개",
    });
  }
  // ── 빵집(가게) ──
  {
    const r = shell(K, "atlas-interior-bakery", "가게 · 빵집", 20, "cream", 9);
    r.floor(42, [2, 5, 17, 6]);
    r.stamp(T("medieval-bread-oven"), 2, 3).stamp(T("bread-oven"), 5, 5).stamp(T("fantasy-prep-table"), 10, 4).stamp(T("library-013"), 13, 5).stamp(T("library-013"), 14, 5).stamp(T("library-011"), 15, 3).stamp(T("fantasy-grain-sacks"), 15, 4);
    r.table(3, 8, 13, 8).stamp(T("library-001"), 3, 8).stamp(T("library-001"), 6, 8).stamp(T("library-020"), 8, 8).stamp(T("library-122"), 10, 8).stamp(T("library-001"), 12, 8);
    r.stamp(T("v4-4-0"), 15, 8).table(2, 10, 4, 10).stamp(T("library-001"), 2, 10).stamp(T("library-020"), 4, 10).stamp(T("library-015"), 2, 11).stamp(T("library-023"), 3, 11).stamp(T("library-024"), 16, 10).stamp(T("library-034"), 17, 9);
    r.rug("red", 7, 10, 11, 11).stamp(T("library-130"), 13, 11);
    r.done({
      entry: [9, 12], keeper: [8, 7], targets: [[8, 7], [8, 9], [15, 10], [4, 11]],
      use: "아침마다 빵을 굽는 빵집. 뒷벽 돌바닥 부엌에서 석조 화덕에 빵을 굽고 조리대에서 반죽을 밀며, 앞쪽 카운터와 옆 진열 탁자에 갓 구운 빵·치즈를 늘어놓아 판다",
      note: "크림 벽, 뒷줄 둘은 돌바닥 42 부엌·앞은 나무 바닥. 석조 빵 화덕 3×3·작은 빵 화덕·밀대·조리대·밀가루 포대 둘·향신료 선반·식재료 자루, 카운터 뒤 통로, 한 줄 카운터 11칸(빵 도마 셋·치즈·동전 쟁반), 오른쪽 식사 탁자(빵 진열)·메뉴 칠판·꿀 항아리, 왼쪽 한 줄 진열 탁자(빵 도마·치즈)와 감자·달걀 바구니, 붉은 깔개·장바구니",
    });
  }
  shops2(K, shell);
}
