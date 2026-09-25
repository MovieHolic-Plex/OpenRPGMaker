// 가게 둘째 묶음 — 정육·양복·보석·서점·골동품·마법 도구·약방·지도. 같은 틀(뒷벽 진열·주인 통로·카운터·손님 자리).
const T = (s) => `tibo-${s}`;

export default function shops2(K, shell) {
  // ── 정육점 ──
  {
    const r = shell(K, "atlas-interior-butcher", "가게 · 정육점", 18, "stone-brick", 8, 6);
    r.floor(42);
    r.stamp(T("atlas-meat-rack"), 2, 4).stamp(T("atlas-meat-rack"), 4, 4).stamp(T("library-021"), 6, 3).stamp(T("fantasy-prep-table"), 9, 4);
    r.one(12, 3, 24).stamp(T("library-229"), 12, 4).stamp(T("library-013"), 13, 5).stamp(T("atlas-meat-rack"), 14, 4);
    r.table(3, 7, 11, 7).stamp(T("library-010"), 4, 7).one(6, 7, 207).stamp(T("balance-scale"), 8, 7).stamp(T("library-122"), 10, 7);
    r.stamp(T("library-232"), 2, 8).stamp(T("library-230"), 3, 9).stamp(T("library-065"), 2, 10).stamp(T("fantasy-water-tub"), 13, 9).stamp(T("library-229"), 15, 7);
    r.rug("red", 6, 9, 10, 10);
    r.object("butcher-counter", "정육점 고기 걸이와 카운터", "furniture", 2, 4, 10, 4, ["정육점", "고기 걸이", "카운터", "저울"], "정육점·시장 푸줏간 뒷벽과 카운터");
    r.done({
      entry: [8, 11], keeper: [7, 6], targets: [[7, 6], [7, 8], [12, 10], [3, 8]],
      use: "고기를 파는 정육점. 뒷벽 고기 걸이에 햄과 고깃덩이, 소시지 걸이가 매달려 있고, 주인은 조리대에서 고기를 발라 카운터 저울에 달아 판다. 앞쪽 물통에서 칼과 도마를 씻는다",
      note: "석벽·돌바닥 42, 14×6칸. 뒷벽 고기 걸이 2×2 셋(새 타일)·소시지 걸이·조리대·횃불·통·소금 포대, 한 줄 카운터 9칸(칼꽂이·구운 고기·상인 저울·동전 쟁반, 양 끝 드나듦), 앞쪽 쌓인 상자·정사각 상자·청소 양동이·물통 3×2·통, 붉은 깔개",
    });
  }
  // ── 양복점 ──
  {
    const r = shell(K, "atlas-interior-tailor", "가게 · 양복점", 20, "cream", 9);
    r.floor(102);
    r.stamp(T("library-109"), 2, 4).stamp(T("library-109"), 3, 4).stamp(T("library-109"), 4, 4).stamp(T("library-111"), 6, 4).stamp(T("library-111"), 7, 4).stamp(T("v4-5-0"), 9, 5);
    r.stamp(T("thread-rack"), 13, 4).stamp(T("library-115"), 14, 4).stamp(T("library-236"), 15, 4).stamp(T("library-041"), 17, 4).stamp(T("library-217"), 9, 3);
    r.table(3, 7, 12, 7).stamp(T("v12-1-1"), 4, 7).stamp(T("library-113"), 6, 7).stamp(T("library-112"), 8, 7).stamp(T("library-114"), 9, 7).stamp(T("library-122"), 11, 7);
    r.stamp(T("library-110"), 14, 8).stool(14, 9).stamp(T("v11-1-2"), 16, 9);
    r.stamp(T("library-117"), 2, 9).stamp(T("library-118"), 2, 10).stamp(T("sewing-basket"), 3, 10).stamp(T("library-116"), 2, 11);
    r.rug("red", 7, 9, 11, 11);
    r.object("tailor-counter", "양복점 재봉 카운터", "furniture", 3, 7, 10, 1, ["양복점", "재봉틀", "카운터"], "양복점·옷감 가게 카운터 자리");
    r.done({
      entry: [9, 12], keeper: [8, 6], targets: [[8, 6], [8, 8], [15, 11], [4, 10]],
      use: "옷을 짓는 양복점. 뒷벽 옷감 두루마리 선반과 재봉 마네킹에 새 옷을 걸어 두고, 카운터의 재봉틀·가위·바늘방석으로 치수를 재 바느질한다. 오른쪽 재단 탁자에서 옷감을 자르고, 가림막 뒤 전신 거울 앞에서 입어 본다",
      note: "크림 벽·널 바닥 102, 16×7칸. 뒷벽 천 두루마리 선반 셋·재봉 마네킹 둘·천 진열대 3×1·풍경화·실패 걸이·자수틀 받침·접이식 가림막·전신 거울, 한 줄 카운터 10칸(재봉틀·가위 쟁반·바늘방석·단추 상자·동전 쟁반), 재단 탁자와 걸상·물레, 실뭉치·뜨개질 바구니·반짇고리·접은 천, 붉은 깔개",
    });
  }
  // ── 보석상 ──
  {
    const r = shell(K, "atlas-interior-jeweler", "가게 · 보석상", 18, "gold-brick", 8, 6);
    r.floor(42);
    r.stamp(T("fantasy-crystal-stand"), 2, 4).stamp(T("library-167"), 4, 5).curtain(6, 3).stamp(T("library-041"), 9, 4).curtain(10, 3).stamp(T("atlas-vault-door"), 13, 3).stamp(T("library-219"), 3, 3);
    r.stamp(T("atlas-jewel-counter"), 3, 7).stamp(T("atlas-jewel-counter"), 7, 7).stamp(T("atlas-jewel-counter"), 11, 7);
    r.chair("s", 4, 9).chair("s", 12, 9);
    r.rug("teal", 6, 9, 10, 10).stamp(T("library-209"), 2, 9).stamp(T("library-214"), 15, 9).stamp(T("library-215"), 15, 5);
    r.object("jeweler-counters", "보석 진열 카운터 줄", "furniture", 3, 7, 11, 2, ["보석상", "진열장", "카운터"], "보석상·귀족 상점 앞 칸");
    r.done({
      entry: [8, 11], keeper: [8, 6], targets: [[8, 6], [5, 10], [14, 10], [2, 8]],
      use: "반지와 보석을 파는 보석상. 유리 진열 카운터 셋에 붉은 벨벳을 깔고 보석을 늘어놓았다. 손님은 카운터 앞 의자에 앉아 고르고, 주인은 커튼·거울 앞 통로에서 꺼내 보이며, 뒷벽 둥근 금고 문 안에 값진 것을 넣어 둔다",
      note: "금벽돌 벽·돌바닥 42, 14×6칸. 뒷벽 수정구 받침·부적 진열대·타원 초상화·붉은 대형 커튼 둘·전신 거울·둥근 금고 문 2×2(새 타일), 보석 진열 카운터 3×2 셋(새 타일, 사이마다 한 칸), 카운터를 보는 의자 둘, 청록 깔개·야자·말린 꽃병·화분",
    });
  }
  // ── 서점 ──
  {
    const r = shell(K, "atlas-interior-bookstore", "가게 · 서점", 20, "cream", 9);
    r.floor(102);
    for (const x of [2, 4, 6, 8, 10, 12]) r.stamp(T("fantasy-bookcase"), x, 4);
    r.stamp(T("library-075"), 14, 3).stamp(T("library-078"), 15, 4).stamp(T("library-081"), 16, 4).stamp(T("library-083"), 17, 4);
    r.table(4, 7, 11, 7).stamp(T("library-073"), 4, 7).stamp(T("library-073"), 5, 7).stamp(T("library-076"), 7, 7).stamp(T("library-122"), 9, 7).stamp(T("library-073"), 11, 7);
    for (const x of [2, 3, 16, 17]) r.shelf(x, 9);
    r.stamp(T("v4-4-2"), 13, 10).chair("w", 12, 10).stamp(T("library-084"), 4, 10).stamp(T("library-083"), 14, 9);
    r.rug("teal", 7, 9, 11, 11);
    r.done({
      entry: [9, 12], keeper: [8, 6], targets: [[8, 6], [8, 8], [15, 11], [4, 11]],
      use: "책을 파는 서점. 뒷벽 책장 여섯에 새 책이 꽂혀 있고 주인은 카운터 뒤에서 책을 꺼내 준다. 양옆 서가 사이를 둘러보고, 오른쪽 독서 탁자에 앉아 미리 읽어 본다",
      note: "크림 벽·널 바닥 102, 16×7칸. 뒷벽 두꺼운 책장 2×2 여섯·두루마리 걸이·문서 분류장·책 압착기·독서등, 한 줄 카운터 8칸(책 더미 셋·잉크와 깃펜·동전 쟁반), 양옆 1×2 서가 둘씩, 독서 탁자와 탁자를 보는 의자·독서등·도서관 발판, 청록 깔개",
    });
  }
  // ── 골동품점 ──
  {
    const r = shell(K, "atlas-interior-antique-shop", "가게 · 골동품점", 20, "purple-brick", 9);
    r.stamp(T("v3-1-0"), 2, 3).block(5, 4, [[389], [419]]).stamp(T("easel"), 6, 4).one(7, 3, 84).one(8, 3, 85).armour(9, 4).stamp(T("library-226"), 10, 3);
    r.stamp(T("v12-1-2"), 11, 4).stamp(T("v10-1-3"), 12, 4).stamp(T("library-192"), 14, 4).stamp(T("library-176"), 16, 4);
    r.table(3, 7, 12, 7).stamp(T("v12-1-0"), 4, 7).stamp(T("v11-1-0"), 6, 7).stamp(T("library-189"), 8, 7).stamp(T("library-122"), 10, 7).stamp(T("library-201"), 12, 7);
    r.stamp(T("v11-1-1"), 14, 8).stamp(T("v12-1-3"), 16, 8).stamp(T("library-181"), 15, 10).stamp(T("library-190"), 2, 9).stamp(T("library-045"), 3, 10).stamp(T("library-178"), 2, 11).stamp(T("library-174"), 17, 10);
    r.rug("red", 7, 9, 11, 11);
    r.done({
      entry: [9, 12], keeper: [8, 6], targets: [[8, 6], [8, 8], [15, 9], [4, 9]],
      use: "먼지 쌓인 옛 물건을 파는 골동품점. 뒷벽에 책장 수납장·괘종시계·그림·갑옷·점술 거울·인형극 무대·손풍금이 뒤섞여 있고, 카운터엔 축음기·모래시계·나침반 상자가 놓였다. 새장·하프·목마·인형의 집 사이를 둘러본다",
      note: "보랏빛 벽돌 벽·나무 바닥 72, 16×7칸. 뒷벽 책장 수납장 3×3·괘종시계·그림 이젤·그림 둘·갑옷 전시대·커튼 창틀·지구본·점술 거울·작은 인형극 무대·손풍금, 한 줄 카운터 10칸(축음기·모래시계·구슬 그릇·동전 쟁반·나침반 상자), 새장·작은 하프·목마·걸상 위 호른·인형의 집·궤짝·악기 케이스, 붉은 깔개",
    });
  }
  // ── 마법 도구점 ──
  {
    const r = shell(K, "atlas-interior-magic-tools", "가게 · 마법 도구점", 20, "purple-brick", 9);
    r.floor(12);
    r.stamp(T("v4-2-0"), 2, 3).stamp(T("library-159"), 5, 3).stamp(T("library-163"), 6, 3).stamp(T("library-164"), 7, 3).stamp(T("fantasy-crystal-stand"), 9, 4).stamp(T("v4-2-2"), 10, 4);
    r.stamp(T("library-195"), 11, 4).stamp(T("v10-1-3"), 12, 4).stamp(T("library-166"), 14, 5).stamp(T("library-162"), 15, 5);
    r.table(3, 7, 12, 7).stamp(T("library-157"), 4, 7).stamp(T("library-165"), 6, 7).stamp(T("library-160"), 9, 7).stamp(T("library-122"), 11, 7);
    r.block(13, 8, [[381, 382, 383], [411, 412, 413], [441, 442, 443]], "upperTiles", "floor");
    r.stamp(T("library-167"), 2, 9).stamp(T("v10-1-0"), 4, 9).stamp(T("v10-1-2"), 2, 11).stamp(T("library-208"), 17, 3).stamp(T("brazier"), 17, 10);
    r.rug("teal", 6, 9, 10, 11);
    r.done({
      entry: [9, 12], keeper: [8, 6], targets: [[8, 6], [8, 8], [14, 9], [5, 10]],
      use: "마법사를 위한 도구점. 뒷벽 물약 진열장·마법봉 걸이·달 위상·별자리 판·두루마리 수납장·지팡이 걸이에서 고르고, 카운터의 수정구로 감정한다. 오른쪽 바닥 마법진에서 산 물건을 시험해 본다",
      note: "보랏빛 벽돌 벽·보랏빛 돌바닥 12, 16×7칸. 뒷벽 물약 진열장 3×3·마법봉 걸이·달 위상 벽판·별자리 판 2×2·수정구 받침·두루마리 수납장·지팡이 걸이·점술 거울·물약 가마솥·작은 돌 제단, 한 줄 카운터 10칸(수정구·수정 표본 쟁반·봉인 주문 두루마리·동전 쟁반), 마법진 381~443 3×3(아래층), 부적 진열대·봉인 상자·푸른 버섯 화분·덩굴 화분·화로, 청록 깔개",
    });
  }
  // ── 약방 ──
  {
    const r = shell(K, "atlas-interior-apothecary", "가게 · 약방", 20, "cream", 9);
    r.floor(102);
    r.stamp(T("medieval-herbal-cabinet"), 2, 3).stamp(T("library-145"), 5, 4).stamp(T("library-156"), 6, 4).stamp(T("library-154"), 7, 4).stamp(T("library-151"), 8, 4).stamp(T("library-147"), 9, 4).stamp(T("hanging-herbs"), 10, 3).stamp(T("v4-2-0"), 12, 3);
    r.table(3, 7, 12, 7).stamp(T("library-003"), 3, 7).stamp(T("library-148"), 5, 7).stamp(T("library-152"), 8, 7).stamp(T("library-155"), 10, 7).stamp(T("library-122"), 11, 7);
    r.stamp(T("fantasy-herb-rack"), 14, 8).stamp(T("library-166"), 17, 11).stamp(T("library-234"), 2, 9).stamp(T("library-149"), 3, 10).stamp(T("v9-1-1"), 2, 11);
    r.rug("teal", 7, 9, 11, 11).stamp(T("library-215"), 15, 5).stamp(T("library-214"), 16, 4);
    r.object("apothecary-wall", "약방 약재장 벽", "furniture", 2, 3, 13, 3, ["약방", "약초 건조장", "물약 진열장", "약재 서랍장"], "약방·치료소 진료실 뒷벽");
    r.done({
      entry: [9, 12], keeper: [8, 6], targets: [[8, 6], [8, 8], [15, 11], [4, 9]],
      use: "약을 지어 파는 약방. 뒷벽 약초 건조장·약재 서랍장·분동함·뿌리 표본병·증류 받침·물약 진열장에서 재료를 꺼내 카운터 절구로 빻고 달아 약병·연고·환약으로 판다. 앞쪽 약초 건조대와 가마솥, 붕대 바구니·약품함",
      note: "크림 벽·널 바닥 102, 16×7칸. 뒷벽 약초 건조장 3×3·약재 서랍장·약방 분동함·약초 건조장·뿌리 표본병·증류 유리병 받침·말린 약초 걸이·물약 진열장 3×3, 한 줄 카운터 10칸(절구·약병 세 개·연고 통·환약 단지·동전 쟁반), 약초 건조대 3×2·물약 가마솥·저장 옹기·붕대 바구니·약품함·화분·말린 꽃병, 청록 깔개",
    });
  }
  // ── 지도 가게 ──
  {
    const r = shell(K, "atlas-interior-map-shop", "가게 · 지도 가게", 18, "cream", 8, 6);
    r.stamp(T("v6-2-0"), 2, 3).stamp(T("v6-2-0"), 4, 3).stamp(T("library-164"), 6, 3).stamp(T("library-074"), 8, 4).stamp(T("v12-1-2"), 10, 4).stamp(T("library-198"), 11, 4).stamp(T("library-198"), 12, 4);
    r.stamp(T("library-082"), 13, 5).stamp(T("v11-1-3"), 15, 4).stamp(T("library-224"), 13, 3);
    r.table(3, 7, 11, 7).stamp(T("library-160"), 3, 7).stamp(T("library-076"), 6, 7).stamp(T("library-201"), 8, 7).stamp(T("library-122"), 10, 7);
    r.stamp(T("v4-2-2"), 15, 8).stamp(T("library-232"), 2, 9).stamp(T("library-198"), 3, 9).stamp(T("library-077"), 13, 9).stamp(T("library-215"), 15, 10);
    r.rug("red", 6, 9, 10, 10);
    r.done({
      entry: [8, 11], keeper: [7, 6], targets: [[7, 6], [7, 8], [13, 10], [4, 10]],
      use: "모험가에게 지도와 해도를 파는 가게. 뒷벽에 강 지도 액자·별자리 판·지도책 받침·지구본·지도통이 걸려 있고, 카운터에서 봉인 두루마리 지도와 나침반을 판다. 앞쪽 경사 필기대에서 지도를 베껴 그린다",
      note: "크림 벽·나무 바닥 72, 14×6칸. 뒷벽 강 지도 액자 둘·별자리 판·펼친 지도책 받침 2×2·지구본·지도통 둘·종이 두루마리 받침·천체망원경·조타륜 장식, 한 줄 카운터 9칸(봉인 두루마리·잉크와 깃펜·나침반 상자·동전 쟁반), 두루마리 수납장·쌓인 상자·지도통·경사진 필기대·화분, 붉은 깔개",
    });
  }
}
