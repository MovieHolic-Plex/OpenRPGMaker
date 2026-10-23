// rt-fallen-star-status-clock-after-load — 재현 스크립트에서 자동 생성(scripts/qa/play/to-scenario.mjs).
// 버그가 살아 있는 동안 이 시나리오는 실패한다: 고쳐지면 통과한다(회귀 방지).
// 원본 op: /home/main/salad/play/runs/main1/tasks/fallen-star__save-load/actions.jsonl 348-352
// 증상: 불러온 세이브(6:31) 뒤 상태 메뉴 시계가 0:00 부근에 머문다 — findings fallen-star__save-load F1
// 페이싱: --wait-visible → waitForVisible status-menu-time
//
// 실행: npm run qa:runtime -- --scenario rt-fallen-star-status-clock-after-load --checkpoint-set rt-fallen-star-status-clock-after-load --checkpoint all

const beats =
[
  {
    id: "rt-fallen-star-status-clock-after-load-repro",
    note: "불러온 세이브(6:31) 뒤 상태 메뉴 시계가 0:00 부근에 머문다 — findings fallen-star__save-load F1",
    ops: [
      {"kind":"key","key":"x"},
      {"kind":"key","key":"Escape"},
      {"kind":"key","key":"x"},
      {"kind":"waitForVisible","testid":"status-menu-time"},
    ],
    expect: {
      "pageAssertions": [
        {
          "id": "status-clock-continues-save",
          "note": "세이브의 playTimeSeconds(391초 = 6:31)가 상태 메뉴 시계(h:mm)에 이어져야 한다 — 불러온 판이 0:0x 로 되돌아가면 실패",
          "fn": "() => { const node = document.querySelector(\"[data-testid='status-menu-time']\"); if (!node) return '상태 메뉴 시계 노드가 없다 — 메뉴가 열려 있지 않다'; const text = (node.textContent || '').trim(); const m = text.match(/^(?:(\\d+):)?(\\d{1,2}):(\\d{2})$/); if (!m) return '시계 글자를 시:분(:초) 로 읽지 못했다: ' + JSON.stringify(text); const total = m[1] !== undefined ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number(m[2]) * 60 + Number(m[3]); return total >= 360 ? true : '상태 메뉴 시계가 세이브 시간을 잇지 못했다: ' + JSON.stringify(text) + ' (' + total + '초, 세이브 391초)'; }"
        }
      ],
      "note": "불러온 세이브(6:31) 뒤 상태 메뉴 시계가 0:00 부근에 머문다 — findings fallen-star__save-load F1"
    },
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "rt-fallen-star-status-clock-after-load",
  projectGenerator: {"game":"fallen-star"},
  checkpointSet: "rt-fallen-star-status-clock-after-load",
  // 게임: fallen-star (scripts/qa/play/games.json)
  viewport: {"width":1280,"height":720},
  // 오프닝 컷신은 재현 대상이 아니다 — 세션과 같은 조건(끔)으로 맞춘다.
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats,
  checkpointBeats: { anchor: beats },
};
