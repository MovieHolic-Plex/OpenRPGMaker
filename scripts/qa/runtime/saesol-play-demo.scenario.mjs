// saesol-play-demo — 재현 스크립트에서 자동 생성(scripts/qa/play/to-scenario.mjs).
// 버그가 살아 있는 동안 이 시나리오는 실패한다: node scripts/qa/runtime/saesol-play-demo.scenario.mjs
// 원본 op: scripts/qa/play/examples/saesol-enter-field.ops.json
// 증상: 타이틀에서 Enter → 위로 2칸, 왼쪽 1칸이면 마을 (12,24). 타이틀 메뉴 글자는 사라져 있어야 한다
//
// 실행: npm run qa:runtime -- --scenario saesol-play-demo

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "saesol-play-demo",
  projectFixture: "examples/saesol-red/project.json.gz",
  // 게임: saesol-red (scripts/qa/play/games.json)
  // 오프닝 컷신은 재현 대상이 아니다 — 세션과 같은 조건(끔)으로 맞춘다.
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats: [
    {
      id: "saesol-play-demo-repro",
      note: "타이틀에서 Enter → 위로 2칸, 왼쪽 1칸이면 마을 (12,24). 타이틀 메뉴 글자는 사라져 있어야 한다",
      ops: [
        {"kind":"key","key":"Enter"},
        {"kind":"waitFor","testid":"runtime-state-json","state":"present","timeoutMs":60000},
        {"kind":"move","dir":"up","steps":2},
        {"kind":"move","dir":"left","steps":1},
      ],
      expect: {
              "textAbsent": "모험 시작",
              "testidPresent": [
                      "runtime-state-json"
              ],
              "mapId": "map_variety_ridge",
              "x": 12,
              "y": 24,
              "note": "타이틀에서 Enter → 위로 2칸, 왼쪽 1칸이면 마을 (12,24). 타이틀 메뉴 글자는 사라져 있어야 한다"
      },
      shot: true,
    },
  ],
};
