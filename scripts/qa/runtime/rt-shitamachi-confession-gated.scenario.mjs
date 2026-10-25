// rt-shitamachi-confession-gated — 등롱 셋이 모이기 전에는 점등식·고백(엔딩)으로 갈 수 없다.
// 2026-10-23 필드 QA F2: 예전 판은 새 게임 첫 프레임부터 스폰 옆 고백 무대에서 엔딩 넷을 고를 수 있었다.
// 2026-10-25 데모 재구성: 고백은 등롱지기에게 소원 등롱 셋을 건넨 뒤의 점등식 → 옥상에서만 열린다.
// 앵커: 서연의 부탁 직후(진행 단계 2, 등롱 0개) 상점가 (16,13). 등롱지기 (12,12) 에게 말을 걸면 «0개 모였네»만 듣는다.
//
// 실행: npm run qa:runtime -- --scenario rt-shitamachi-confession-gated --checkpoint-set rt-shitamachi-confession-gated --checkpoint all

const beats =
[
  {
    id: "rt-shitamachi-confession-gated-keeper",
    note: "등롱 0개로 등롱지기에게 말을 걸면 남은 등롱 수만 듣고, 누구와 걸을지(엔딩 분기) 선택지는 열리지 않는다",
    ops: [
      {"kind":"move","dir":"left","steps":4},
      {"kind":"face","dir":"up"},
      {"kind":"pressUntilText","key":"z","testid":"dialogue-box","text":"0개 모였네","settleMs":400,"maxPresses":10},
    ],
    expect: {
      "textPresent": "0개 모였네",
      "textAbsent": ["누구랑 걸을 거야", "서연과 걷는다"],
      "note": "등롱이 모이기 전에는 점등식·엔딩 선택지로 가지 않는다",
    },
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "rt-shitamachi-confession-gated",
  projectGenerator: {"game":"shitamachi-fourth-season"},
  checkpointSet: "rt-shitamachi-confession-gated",
  viewport: {"width":960,"height":540},
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats,
  checkpointBeats: { anchor: beats },
};
