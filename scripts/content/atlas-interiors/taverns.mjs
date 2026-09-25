// 여관·주점 — 길가 여관 1·2층(동쪽 계단 짝), 항구 선술집, 음유시인 무대 주점, 광부 주점.
const T = (s) => `tibo-${s}`;

export default function taverns(K) {
  // ── 길가 여관 1층 ──
  {
    const r = K.room("atlas-interior-roadside-inn-1f", "여관 · 길가 여관 1층", 24, 16, {
      rooms: [{ id: "hall", x: 2, y: 5, w: 14, h: 8 }, { id: "kitchen", x: 17, y: 5, w: 5, h: 8 }], innerDoors: [{ x: 16, y: 9 }], door: { x: 8, y: 12 },
    });
    r.floor(42, [17, 5, 21, 12]);
    r.stamp(T("fantasy-ale-rack"), 2, 4).stamp(T("library-134"), 5, 4).stamp(T("library-133"), 7, 4).stamp(T("library-144"), 8, 3).one(12, 3, 24);
    r.stamp(T("medieval-stone-fireplace"), 9, 3).stairsUp(15, 5);
    r.stamp(T("fantasy-bar-counter"), 2, 7).stool(2, 9, true).stool(4, 9, true);
    r.rug("red", 8, 6, 12, 6);
    r.stamp(T("fantasy-dining-set"), 8, 8).stamp(T("library-025"), 13, 8).stool(12, 9).stool(14, 9);
    r.stamp(T("library-026"), 4, 11).stool(3, 12).stool(5, 12).stamp(T("fantasy-dining-set"), 11, 10).stamp(T("library-209"), 14, 11 - 0);
    r.stamp(T("medieval-bread-oven"), 17, 3).stamp(T("fantasy-hanging-pot"), 20, 4).stamp(T("fantasy-prep-table"), 17, 7).stamp(T("fantasy-water-tub"), 19, 11);
    r.stamp(T("library-013"), 17, 11).stamp(T("library-014"), 18, 11).stamp(T("library-018"), 17, 12).stamp(T("library-019"), 18, 12).stamp(T("library-012"), 20, 3 - 0);
    r.object("tavern-bar-corner", "주점 술통 선반과 바", "furniture", 2, 4, 6, 6, ["주점", "바", "술통", "여관"], "여관·주점 1층 뒷벽 한쪽 구석");
    r.done({
      entry: [8, 13], keeper: [3, 6], targets: [[3, 6], [6, 9], [13, 6], [20, 8], [10, 11], [20, 10]],
      use: "큰길가 여관의 1층. 여행자가 문으로 들어와 왼쪽 바에서 맥주를 받고, 벽난로 앞 긴 식탁·둥근 탁자에 앉아 먹는다. 동벽 계단으로 2층 객실에 오르고, 칸막이 너머 돌바닥 부엌에서 요리가 나온다",
      note: "크림 벽, 홀 14×8(나무 바닥)과 부엌 5×8(돌바닥 42)을 칸막이로 나눴다(문 (16,9)). 홀: 술통 선반·포도주 선반·받침대 맥주통·주점 간판·횃불, 장작 벽난로와 붉은 깔개, 동벽 3칸 폭 오르막 141|111|171(x=13~15) → 2층, 바 카운터 4×2와 높은 걸상 둘, 긴 식탁과 벤치 둘·원형 식탁과 걸상 둘·정사각 식탁과 걸상 둘·야자. 부엌: 석조 빵 화덕·솥 걸이·국자 걸이·조리대·물통·포대와 채소 상자",
    });
  }
  // ── 길가 여관 2층 ──
  {
    const r = K.room("atlas-interior-roadside-inn-2f", "여관 · 길가 여관 2층 객실", 20, 17, {
      rooms: [{ id: "hall", x: 2, y: 5, w: 16, h: 3 }, { id: "a", x: 2, y: 11, w: 4, h: 3 }, { id: "b", x: 7, y: 11, w: 5, h: 3 }, { id: "c", x: 13, y: 11, w: 5, h: 3 }],
      innerDoors: [{ x: 4, y: 8 }, { x: 9, y: 8 }, { x: 13, y: 8 }], door: { x: 9, y: 13 },
    });
    r.closeDoor(9, 14);
    r.stairsDown(14, 5).rug("red", 3, 6, 12, 6).stamp(T("library-215"), 2, 5).stamp(T("library-059"), 17, 4).one(6, 3, 84).one(11, 3, 54).stamp(T("library-037"), 16, 5);
    r.bed(2, 11).stamp(T("library-039"), 3, 11).stamp(T("library-045"), 5, 13).one(3, 9, 54);
    r.bed(7, 11).bed(11, 11).stamp(T("library-039"), 8, 11).stamp(T("library-045"), 9, 13).stamp(T("v8-1-3"), 7, 13).one(11, 9, 54);
    r.stamp(T("fantasy-bed"), 15, 10).stamp(T("library-039"), 14, 11).stamp(T("library-045"), 17, 13).rug("red", 13, 13, 15, 13).one(15, 9, 56);
    r.done({
      entry: [14, 6], targets: [[3, 13], [9, 12], [14, 13], [4, 6]],
      use: "길가 여관 2층 객실. 1층 동벽 계단을 오르면 복도 동쪽(내려가는 계단 앞), 복도 뒷벽 문 틈으로 1인실·2인실·큰 방에 든다",
      note: "크림 벽, 복도 16×3과 아래 객실 셋(4×3·5×3·5×3)을 파이프라인 칸막이로 나눴다. 남쪽 문은 천장으로 닫고 1층 계단 가운데(x=14)에 1×1 내리막 474, 붉은 러너·화분·린넨 장·그림·창·접은 이불. 1인실 침대·협탁·궤짝·창, 2인실 침대 둘·협탁·세면대·궤짝·창, 큰 방 목제 침대 3×3·협탁·닫힌 옷장·붉은 깔개·커튼 창",
    });
  }
  // ── 항구 선술집 ──
  {
    const r = K.room("atlas-interior-harbor-tavern", "주점 · 항구 선술집", 22, 15, { wings: [{ x: 2, y: 5, w: 18, h: 7 }], door: { x: 11, y: 11 } });
    r.floor(102);
    r.stamp(T("library-224"), 2, 3).stamp(T("fantasy-ale-rack"), 4, 4).stamp(T("library-133"), 7, 4).one(8, 3, 24).stamp(T("v6-2-0"), 10, 3).one(13, 3, 24).stamp(T("library-138"), 14, 3).stamp(T("library-022"), 17, 4);
    r.stamp(T("fantasy-bar-counter"), 4, 7).stool(4, 9, true).stool(6, 9, true).stool(8, 8, true);
    r.stamp(T("library-025"), 11, 6).stool(10, 7).stool(12, 7).stamp(T("library-025"), 15, 7).stool(14, 8).stool(16, 8);
    r.stamp(T("fantasy-dining-set"), 12, 9).stamp(T("library-026"), 17, 9 + 0).stool(18, 10).stool(16, 10);
    r.stamp(T("library-229"), 2, 6).stamp(T("library-229"), 2, 8).one(3, 10, 385).stamp(T("library-196"), 2, 10).stamp(T("library-230"), 2, 11);
    r.stamp(T("library-137"), 9, 11).stamp(T("library-197"), 19, 7).rug("red", 9, 5, 13, 8).rug("teal", 14, 7, 17, 9);
    r.done({
      entry: [11, 12], keeper: [5, 6], targets: [[5, 6], [9, 9], [15, 11], [18, 6]],
      use: "부두 곁 뱃사람들의 선술집. 조타륜 장식과 해도 액자 아래 바에서 럼을 받고, 둥근 탁자·긴 식탁에 둘러앉아 다트를 던진다. 왼쪽 벽엔 술통과 밧줄이 쌓였고 흰 고양이가 쥐를 노린다",
      note: "크림 벽·널 바닥 102, 18×7칸. 뒷벽 조타륜 장식·술통 선반·받침대 맥주통·강 지도 액자·횃불 둘·다트판·생선 건조대, 바 카운터 4×2와 높은 걸상 셋, 원형 식탁 둘·긴 식탁과 벤치·정사각 식탁과 걸상들, 왼쪽 통 둘·밧줄·쌓인 상자·흰 고양이, 술 항아리·여행등 받침",
    });
  }
  // ── 음유시인 무대 주점 ──
  {
    const r = K.room("atlas-interior-bard-tavern", "주점 · 음유시인 무대 주점", 24, 17, { wings: [{ x: 2, y: 5, w: 20, h: 9 }], door: { x: 12, y: 13 } });
    r.stage(7, 5, 16, 7, 12);
    r.curtain(5, 3).curtain(17, 3).one(10, 3, 24).one(13, 3, 24).stamp(T("library-144"), 3, 3);
    r.stamp(T("lute"), 9, 5).stamp(T("library-173"), 11, 5).stamp(T("library-178"), 13, 6).stamp(T("v12-1-3"), 15, 5).stamp(T("library-174"), 8, 5);
    r.stamp(T("library-133"), 2, 4).stamp(T("library-134"), 3, 4);
    r.stamp(T("fantasy-ale-rack"), 19, 4).stamp(T("fantasy-bar-counter"), 18, 7).stool(18, 9, true).stool(20, 9, true);
    for (const x of [4, 8, 15]) r.stamp(T("library-025"), x, 9).stool(x - 1, 10).stool(x + 1, 10);
    r.stamp(T("fantasy-dining-set"), 10, 10).rug("red", 3, 12, 8, 13).stamp(T("library-026"), 5, 12).stool(4, 13).stool(6, 13);
    r.rug("teal", 14, 12, 19, 13).stamp(T("library-209"), 20, 12).rug("teal", 2, 8, 9, 10).rug("red", 13, 8, 17, 10);
    r.object("bard-stage", "음유시인 무대(앞면·계단·악기)", "landmark", 5, 3, 14, 5, ["무대", "주점", "악기", "커튼"], "주점·극장 북쪽 벽 앞");
    r.done({
      entry: [12, 14], keeper: [19, 6], targets: [[12, 6], [19, 6], [6, 11], [17, 11], [2, 12]],
      use: "음유시인이 노래하는 주점. 북쪽 벽 앞 널 무대(가운데 계단으로 오름)에서 류트·하프·북을 연주하고, 손님은 둥근 탁자·긴 식탁에 앉아 무대를 본다. 동쪽 바에서 술을 받는다",
      note: "크림 벽·나무 바닥 72, 20×9칸. 북쪽 널 무대 10×2(102)와 무대 앞면 2130~2132·가운데 계단 2133(새 타일), 양옆 붉은 대형 커튼·횃불 둘·주점 간판, 무대 위 류트·악보 받침대·작은 북·작은 하프·탬버린, 서벽 받침대 맥주통·포도주 선반, 동쪽 술통 선반과 바 카운터 4×2·높은 걸상 둘(주인 자리 (19,6)), 원형 식탁 셋과 걸상 여섯, 긴 식탁과 벤치, 붉은 깔개 위 정사각 식탁과 걸상, 청록 깔개·야자",
    });
  }
  // ── 광부 주점 ──
  {
    const r = K.room("atlas-interior-miner-tavern", "주점 · 광부 주점", 20, 14, { wings: [{ x: 2, y: 5, w: 16, h: 6 }], door: { x: 9, y: 10 }, wall: "dark-stone" });
    r.floor(42);
    r.stamp(T("fantasy-ale-rack"), 2, 4).stamp(T("library-133"), 5, 4).stamp(T("library-088"), 6, 3).one(8, 3, 24).stamp(T("library-100"), 7, 5).stamp(T("library-098"), 9, 5).stamp(T("library-106"), 10, 5).stamp(T("library-197"), 11, 4);
    r.stamp(T("library-134"), 13, 4).stamp(T("library-133"), 15, 4).stamp(T("library-133"), 16, 4).one(12, 3, 24);
    r.stamp(T("fantasy-bar-counter"), 13, 7).stool(13, 9, true).stool(15, 9, true);
    r.stamp(T("library-026"), 3, 8).stool(2, 9).stool(4, 9).stamp(T("library-025"), 7, 8).stool(6, 9).stool(8, 9).stamp(T("brazier"), 11, 9);
    r.stamp(T("library-105"), 17, 9).stamp(T("library-232"), 17, 7 + 0);
    r.done({
      entry: [9, 11], keeper: [14, 6], targets: [[14, 6], [5, 7], [10, 7], [16, 10]],
      use: "광산 마을 광부들의 주점. 검은 돌벽에 공구 벽판·횃불이 걸리고, 일 끝난 광부가 곡괭이 대신 맥주잔을 들고 화로 곁 탁자에 앉는다. 동쪽 바에서 주인이 술통 꼭지로 맥주를 따른다. 주괴·석탄 통은 뒷벽에 쌓아 둔다",
      note: "어두운 돌벽·돌바닥 42, 16×6칸. 뒷벽 술통 선반·받침대 맥주통 셋·포도주 선반·공구 벽판·횃불 둘·금속 주괴 더미·석탄 통·고철 상자·여행등 받침, 바 카운터 4×2와 높은 걸상 둘(주인 자리 (14,6)), 정사각 식탁·원형 식탁과 걸상 넷, 화로, 쇠사슬 뭉치·쌓인 상자",
    });
  }
}
