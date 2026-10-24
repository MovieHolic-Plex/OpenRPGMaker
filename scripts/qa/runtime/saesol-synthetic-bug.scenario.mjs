// saesol-synthetic-bug — 재현 스크립트에서 자동 생성(scripts/qa/play/to-scenario.mjs).
// 버그가 살아 있는 동안 이 시나리오는 실패한다: node scripts/qa/runtime/saesol-synthetic-bug.scenario.mjs
// 원본 op: scripts/qa/play/examples/saesol-enter-field.ops.json
// 증상: 일부러 성립하지 않는 기대 — NOT_REPRODUCED 가 나와야 한다
//
// 실행: npm run qa:runtime -- --scenario saesol-synthetic-bug

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "saesol-synthetic-bug",
  projectFixture: "examples/saesol-red/project.json.gz",
  // 게임: saesol-red (scripts/qa/play/games.json)
  // 오프닝 컷신은 재현 대상이 아니다 — 세션과 같은 조건(끔)으로 맞춘다.
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats: [
    {
      id: "saesol-synthetic-bug-repro",
      note: "일부러 성립하지 않는 기대 — NOT_REPRODUCED 가 나와야 한다",
      ops: [
        {"kind":"key","key":"Enter"},
        {"kind":"waitFor","testid":"runtime-state-json","state":"present","timeoutMs":60000},
        {"kind":"move","dir":"up","steps":2},
        {"kind":"move","dir":"left","steps":1},
      ],
      expect: {
              "textPresent": "이 대사는 새솔 마을에 없다",
              "x": 99,
              "y": 99,
              "note": "일부러 성립하지 않는 기대 — NOT_REPRODUCED 가 나와야 한다"
      },
      shot: true,
    },
  ],
};
