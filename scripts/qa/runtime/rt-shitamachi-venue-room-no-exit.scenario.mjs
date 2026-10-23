// rt-shitamachi-venue-room-no-exit — 재현 스크립트에서 자동 생성(scripts/qa/play/to-scenario.mjs).
// 버그가 살아 있는 동안 이 시나리오는 실패한다: 고쳐지면 통과한다(회귀 방지).
// 원본 op: /home/main/salad/play/runs/main1/tasks/shitamachi-fourth-season__first-run-small/actions.jsonl 587-594
// 증상: 실내 명소(학생회실)에서 상하좌우로 걸어 나가면 아케이드로 돌아갈 출구가 있어야 한다. 지금은 문이 없어 맵 경계에서 막힌다. findings shitamachi-fourth-season__first-run-small F1
//
// 실행: npm run qa:runtime -- --scenario rt-shitamachi-venue-room-no-exit --checkpoint-set rt-shitamachi-venue-room-no-exit --checkpoint all

const beats =
[
  {
    id: "rt-shitamachi-venue-room-no-exit-repro",
    note: "실내 명소(학생회실)에서 상하좌우로 걸어 나가면 아케이드로 돌아갈 출구가 있어야 한다. 지금은 문이 없어 맵 경계에서 막힌다. findings shitamachi-fourth-season__first-run-small F1",
    ops: [
      {"kind":"move","dir":"up","steps":12},
      {"kind":"move","dir":"down","steps":12},
      {"kind":"move","dir":"left","steps":12},
      {"kind":"move","dir":"right","steps":12},
    ],
    expect: {
      "pageAssertions": [
        {
          "id": "left-venue-room",
          "note": "학생회실에서 상하좌우 12칸씩 걸어 나가면 그 방을 벗어나야 한다 — 지금은 나가는 문이 없어 map_venue_council 에 갇힌다",
          "fn": "() => { const debug = window.__oprnDebug; if (!debug || typeof debug.readState !== 'function') return '런타임 훅이 없다 — 현재 맵을 읽을 수 없다'; const map = debug.readState().currentMapId; return map !== 'map_venue_council' ? true : '상하좌우로 걸어도 학생회실을 벗어나지 못했다 (map_venue_council) — 나가는 문이 없다'; }"
        }
      ],
      "note": "실내 명소(학생회실)에서 상하좌우로 걸어 나가면 아케이드로 돌아갈 출구가 있어야 한다. 지금은 문이 없어 맵 경계에서 막힌다. findings shitamachi-fourth-season__first-run-small F1"
    },
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "rt-shitamachi-venue-room-no-exit",
  projectGenerator: {"game":"shitamachi-fourth-season"},
  checkpointSet: "rt-shitamachi-venue-room-no-exit",
  // 게임: shitamachi-fourth-season (scripts/qa/play/games.json)
  viewport: {"width":960,"height":540},
  // 오프닝 컷신은 재현 대상이 아니다 — 세션과 같은 조건(끔)으로 맞춘다.
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats,
  checkpointBeats: { anchor: beats },
};
