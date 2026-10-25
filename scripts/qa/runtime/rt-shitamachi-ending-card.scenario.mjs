// rt-shitamachi-ending-card — 옥상 고백에서 진심 결말을 고르면 에필로그 → 크레딧 → 마지막 카드가 읽히게 나온다.
// 2026-10-25 VQA: before 판은 마지막 카드의 두 줄 엔딩 이름이 「플레이 시간」 줄과 겹쳤다(.ending-final-meta 로 수정).
// 앵커: 유나와 걷기를 고른 뒤 옥상 입구(마음 점수 5) — 자동 고백 장면이 시작된다.
//
// 실행: npm run qa:runtime -- --scenario rt-shitamachi-ending-card --checkpoint-set rt-shitamachi-ending-card --checkpoint all

const beats =
[
  {
    id: "rt-shitamachi-ending-card-confess",
    note: "고백 선택지가 맵 위 두 사람을 가리지 않고 뜬다(대화 중 인물 보이기)",
    ops: [
      {"kind":"pressUntilText","key":"Enter","testid":"runtime-choices","text":"다음 계절도","settleMs":600,"maxPresses":40},
    ],
    expect: { "textPresent": "다음 계절도", "note": "고백 선택지" },
    shot: true,
  },
  {
    id: "rt-shitamachi-ending-card-epilogue",
    note: "진심 고백 → 유나 결말 에필로그",
    ops: [
      {"kind":"key","key":"Enter"},
      {"kind":"pressUntilText","key":"Enter","testid":"ending-screen","text":"현상한 사진","settleMs":600,"maxPresses":40},
    ],
    expect: { "textPresent": "마지막 한 장", "note": "유나 진심 결말" },
    shot: true,
  },
  {
    id: "rt-shitamachi-ending-card-final",
    note: "크레딧을 건너뛰면 마지막 카드 — 엔딩 이름과 플레이 시간이 겹치지 않고 읽힌다",
    ops: [
      {"kind":"pressUntilText","key":"Enter","testid":"ending-screen","text":"건너뛰기","settleMs":700,"maxPresses":20},
      {"kind":"pressUntilText","key":"Escape","testid":"ending-screen","text":"플레이 시간","settleMs":700,"maxPresses":20},
    ],
    expect: { "textPresent": "플레이 시간", "note": "마지막 카드" },
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "rt-shitamachi-ending-card",
  projectGenerator: {"game":"shitamachi-fourth-season"},
  checkpointSet: "rt-shitamachi-ending-card",
  viewport: {"width":960,"height":540},
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats,
  checkpointBeats: { anchor: beats },
};
