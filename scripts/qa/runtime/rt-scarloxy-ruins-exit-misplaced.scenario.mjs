// rt-scarloxy-ruins-exit-misplaced — 재현 스크립트에서 자동 생성(scripts/qa/play/to-scenario.mjs).
// 버그가 살아 있는 동안 이 시나리오는 실패한다: 고쳐지면 통과한다(회귀 방지).
// 원본 op: /home/main/salad/play/runs/main1/tasks/scarloxy-demo__explore/actions.jsonl 417-420
// 증상: 유적 북쪽 출입구를 지나면 초원 마을 (15,20) 에 도착해야 한다(transfer 설정값). 지금은 통행 불가 나무 밑동에 밀려 (14,19). findings scarloxy-demo__explore F1
// 페이싱: line 419 field/map_scarloxy_ruins → field/map_scarloxy_meadow → waitForMap map_scarloxy_meadow
//
// 실행: npm run qa:runtime -- --scenario rt-scarloxy-ruins-exit-misplaced --checkpoint-set rt-scarloxy-ruins-exit-misplaced --checkpoint all

const beats =
[
  {
    id: "rt-scarloxy-ruins-exit-misplaced-repro",
    note: "유적 북쪽 출입구를 지나면 초원 마을 (15,20) 에 도착해야 한다(transfer 설정값). 지금은 통행 불가 나무 밑동에 밀려 (14,19). findings scarloxy-demo__explore F1",
    ops: [
      {"kind":"move","dir":"up","steps":1},
      {"kind":"waitForMap","mapId":"map_scarloxy_meadow"},
    ],
    expect: {
      "mapId": "map_scarloxy_meadow",
      "x": 15,
      "y": 20,
      "note": "유적 북쪽 출입구를 지나면 초원 마을 (15,20) 에 도착해야 한다(transfer 설정값). 지금은 통행 불가 나무 밑동에 밀려 (14,19). findings scarloxy-demo__explore F1"
    },
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "rt-scarloxy-ruins-exit-misplaced",
  projectGenerator: {"game":"scarloxy-demo"},
  checkpointSet: "rt-scarloxy-ruins-exit-misplaced",
  // 게임: scarloxy-demo (scripts/qa/play/games.json)
  viewport: {"width":1280,"height":720},
  // 오프닝 컷신은 재현 대상이 아니다 — 세션과 같은 조건(끔)으로 맞춘다.
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats,
  checkpointBeats: { anchor: beats },
};
