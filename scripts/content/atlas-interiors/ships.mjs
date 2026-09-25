// 배 — 선장실, 선창(갑판 아래 선원 숙소·짐칸, 사다리 계단으로만 드나듦). Tibo 시트 한 장: 통나무 벽·널 바닥.
const T = (s) => `tibo-${s}`;

export default function ships(K) {
  // ── 선장실 ──
  {
    const r = K.room("atlas-interior-ship-captain-cabin", "배 · 선장실", 20, 13, { wings: [{ x: 2, y: 5, w: 16, h: 5 }], door: { x: 9, y: 9 }, wall: "log" });
    r.floor(102);
    r.stamp(T("v6-2-0"), 5, 3).stamp(T("library-224"), 9, 3).one(13, 3, 54).one(16, 3, 54).one(7, 3, 24);
    r.stamp(T("fantasy-bed"), 2, 4).stamp(T("library-039"), 5, 5);
    r.table(9, 6, 11, 7).stamp(T("library-201"), 9, 6).stamp(T("library-076"), 11, 6).stamp(T("library-160"), 9, 7).chair("n", 10, 5).chair("w", 8, 7);
    r.stamp(T("v11-1-3"), 13, 5).stamp(T("library-198"), 14, 5).stamp(T("library-045"), 15, 5).stamp(T("v12-1-2"), 17, 5);
    r.stamp(T("library-229"), 17, 8).stamp(T("library-196"), 15, 9).stamp(T("library-232"), 2, 8).stamp(T("library-197"), 3, 8);
    r.rug("red", 7, 8, 12, 9).rug("teal", 12, 6, 16, 7);
    r.object("captain-chart-table", "선장 해도 탁자(나침반 상자·잉크·두루마리)와 의자", "furniture", 8, 5, 4, 3, ["배", "선장", "해도", "탁자"], "배 선장실·항구 관청·지도 가게");
    r.done({
      entry: [9, 10], keeper: [10, 8], targets: [[10, 8], [6, 7], [16, 7], [4, 9]],
      use: "범선 고물의 선장실. 조타륜 장식과 해도 액자 아래 탁자에서 선장이 나침반 상자와 두루마리로 항로를 잡고, 천체망원경·지도통·지구본으로 별과 바다를 잰다. 서쪽 목제 침대에서 자고 궤짝에 금화를 둔다",
      note: "통나무 벽·널 바닥 102, 16×5칸. 강 지도 액자·배 조타륜 장식 2×2·창 둘·횃불, 목제 침대 3×3·협탁, 해도 탁자 3×2(다리 앞면)와 나침반 상자·잉크·봉인 두루마리, 선장 의자·옆 의자, 천체망원경·지도통·궤짝·지구본, 둥근 통·밧줄·쌓인 상자·여행등, 붉은·청록 깔개",
    });
  }
  // ── 선창 ──
  {
    const r = K.room("atlas-interior-ship-below-deck", "배 · 갑판 아래 선창", 24, 14, { wings: [{ x: 2, y: 5, w: 20, h: 6 }], door: { x: 12, y: 10 }, wall: "log" });
    r.floor(102).closeDoor(12, 11);
    r.stairsUp(12, 5).one(5, 3, 24).one(17, 3, 24);
    for (const x of [2, 4, 6]) r.bed(x, 5).stamp(T("library-045"), x + 1, 5);
    r.stamp(T("library-229"), 14, 5).stamp(T("library-229"), 15, 5).stamp(T("library-133"), 16, 5);
    for (const x of [18, 19, 20, 21]) r.stamp(T("library-232"), x, 5);
    r.table(6, 8, 9, 9).stamp(T("library-008"), 6, 8).stamp(T("library-136"), 8, 8).chair("n", 8, 7).chair("n", 9, 7).chair("s", 8, 10).chair("s", 9, 10).stool(5, 9).stool(10, 9);
    r.stamp(T("library-193"), 2, 9).stamp(T("library-193"), 2, 10).stamp(T("library-193"), 3, 10);
    r.stamp(T("fantasy-grain-sacks"), 15, 8).stamp(T("library-196"), 19, 8).stamp(T("library-022"), 20, 9).stamp(T("library-197"), 13, 8);
    r.rug("teal", 11, 7, 13, 10).mat(14, 7, 21, 10);
    r.object("ship-cargo-row", "둥근 통·맥주통·쌓인 상자 넷(짐칸 한 줄)", "prop", 14, 5, 8, 2, ["배", "짐칸", "술통", "상자"], "배 선창·항구 창고·부두 창고");
    r.done({
      entry: [11, 6], targets: [[11, 6], [4, 8], [18, 7], [12, 10], [3, 9]],
      use: "범선 갑판 아래 선창. 갑판에서 뒷벽 사다리 계단으로 내려온다. 서쪽엔 선원 침상 셋과 궤짝·말린 침낭, 가운데 식탁에서 선원들이 먹고, 동쪽엔 술통·쌓인 상자·곡식 자루·밧줄·말린 생선이 실렸다",
      note: "통나무 벽·널 바닥 102, 20×6칸. 남쪽 문은 천장으로 닫음, 뒷벽 3칸 폭 오르막 141|111|171(x=10~12) → 갑판, 횃불 둘, 침상 셋과 궤짝 셋, 둥근 통 둘·받침대 맥주통·쌓인 상자 넷, 식탁 4×2(다리 앞면)와 접시 더미·맥주잔 쟁반·의자 넷·걸상 둘, 말린 침낭 셋, 식재료 자루·밧줄·생선 건조대·여행등, 계단 앞 청록 깔개·짐칸 짚 깔개",
    });
  }
}
