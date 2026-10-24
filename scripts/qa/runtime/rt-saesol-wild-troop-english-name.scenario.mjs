// rt-saesol-wild-troop-english-name — 재현 스크립트에서 자동 생성(scripts/qa/play/to-scenario.mjs).
// 버그가 살아 있는 동안 이 시나리오는 실패한다: 고쳐지면 통과한다(회귀 방지).
// 원본 op: /home/main/salad/play/runs/main1/tasks/saesol-red__battle/actions.jsonl 488-494
// 증상: 야생 조우 전투 상단은 한글 종족명(야생 치카디)이어야 한다 — 지금은 '야생 chickadee 레벨3'. findings saesol-red__battle F1
// 페이싱: line 492 field/map_saesol_route → battle/map_saesol_route → pressUntil z → battle-scene present
// 페이싱: line 490 간격 버림 — field/map_saesol_route → field/map_saesol_route — 기다릴 조건을 로그에서 정하지 못했다(간격 1200ms)
//
// 실행: npm run qa:runtime -- --scenario rt-saesol-wild-troop-english-name --checkpoint-set rt-saesol-wild-troop-english-name --checkpoint all

const beats =
[
  {
    id: "rt-saesol-wild-troop-english-name-repro",
    note: "야생 조우 전투 상단은 한글 종족명(야생 치카디)이어야 한다 — 지금은 '야생 chickadee 레벨3'. findings saesol-red__battle F1",
    ops: [
      {"kind":"key","key":"z"},
      {"kind":"pressUntil","testid":"battle-scene","state":"present","key":"z","maxPresses":8},
    ],
    expect: {
      "textPresent": "치카디",
      "textAbsent": "야생 chickadee",
      "note": "야생 조우 전투 상단은 한글 종족명(야생 치카디)이어야 한다 — 지금은 '야생 chickadee 레벨3'. findings saesol-red__battle F1"
    },
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "rt-saesol-wild-troop-english-name",
  projectFixture: "examples/saesol-red/project.json.gz",
  checkpointSet: "rt-saesol-wild-troop-english-name",
  // 게임: saesol-red (scripts/qa/play/games.json)
  viewport: {"width":1280,"height":720},
  // 오프닝 컷신은 재현 대상이 아니다 — 세션과 같은 조건(끔)으로 맞춘다.
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats,
  checkpointBeats: { anchor: beats },
};
