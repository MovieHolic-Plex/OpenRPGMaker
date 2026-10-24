// rt-field-menu-map-badge — 재현 스크립트에서 자동 생성(scripts/qa/play/to-scenario.mjs).
// 버그가 살아 있는 동안 이 시나리오는 실패한다: 고쳐지면 통과한다(회귀 방지).
// 원본 op: /home/main/salad/play/runs/main1/tasks/preset-monster-collect__first-run/actions.jsonl 548-552
// 증상: 필드 메뉴에 저작된 지도·배지 항목이 나온다 — 지금은 캠페인 정의가 없어 런타임이 두 항목을 숨긴다. findings preset-monster-collect__first-run F2
// 페이싱: --wait-visible → waitForVisible status-menu-command-rail
// 페이싱: line 549 간격 버림 — field/map_segment_route → field/map_segment_route — 기다릴 조건을 로그에서 정하지 못했다(간격 500ms)
//
// 실행: npm run qa:runtime -- --scenario rt-field-menu-map-badge --checkpoint-set rt-field-menu-map-badge --checkpoint all

const beats =
[
  {
    id: "rt-field-menu-map-badge-repro",
    note: "필드 메뉴에 저작된 지도·배지 항목이 나온다 — 지금은 캠페인 정의가 없어 런타임이 두 항목을 숨긴다. findings preset-monster-collect__first-run F2",
    ops: [
      {"kind":"key","key":"x"},
      {"kind":"waitForVisible","testid":"status-menu-command-rail"},
    ],
    expect: {
      "textPresent": [
        "지도",
        "배지"
      ],
      "note": "필드 메뉴에 저작된 지도·배지 항목이 나온다 — 지금은 캠페인 정의가 없어 런타임이 두 항목을 숨긴다. findings preset-monster-collect__first-run F2"
    },
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "rt-field-menu-map-badge",
  projectGenerator: {"game":"preset-monster-collect"},
  checkpointSet: "rt-field-menu-map-badge",
  // 게임: preset-monster-collect (scripts/qa/play/games.json)
  viewport: {"width":1280,"height":720},
  // 오프닝 컷신은 재현 대상이 아니다 — 세션과 같은 조건(끔)으로 맞춘다.
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats,
  checkpointBeats: { anchor: beats },
};
