// rt-fallen-star-quest-step-labels — 재현 스크립트에서 자동 생성(scripts/qa/play/to-scenario.mjs).
// 버그가 살아 있는 동안 이 시나리오는 실패한다: 고쳐지면 통과한다(회귀 방지).
// 원본 op: /home/main/salad/play/runs/rerun2/tasks/fallen-star__first-run/actions.jsonl 264-279
// 증상: 임무 일지 단계 행이 단계 이름과 상태를 한 번씩만 보여 준다 — findings fallen-star__first-run F2
//
// 실행: npm run qa:runtime -- --scenario rt-fallen-star-quest-step-labels --checkpoint-set rt-fallen-star-quest-step-labels --checkpoint all

const beats =
[
  {
    id: "rt-fallen-star-quest-step-labels-repro",
    note: "임무 일지 단계 행이 단계 이름과 상태를 한 번씩만 보여 준다 — findings fallen-star__first-run F2",
    ops: [
      {"kind":"key","key":"x"},
      {"kind":"key","key":"ArrowDown"},
      {"kind":"key","key":"ArrowDown"},
      {"kind":"key","key":"ArrowDown"},
      {"kind":"key","key":"ArrowDown"},
      {"kind":"key","key":"z"},
      {"kind":"key","key":"ArrowDown"},
      {"kind":"key","key":"z"},
    ],
    expect: {
      "textAbsent": [
        "1. 진행",
        "2. 진행",
        "3. 진행"
      ],
      "pageAssertions": [
        {
          "id": "quest-step-rows-readable",
          "note": "임무 일지의 단계 행은 「N. 단계이름 + 상태」 한 벌로 읽혀야 한다 — 지금은 「N. 진행」 라벨이 단계마다 중복된다",
          "fn": "() => {\n  const menu = document.querySelector('[data-testid=\"main-menu\"]');\n  if (!menu) return '메뉴가 없다';\n  const rows = [...menu.querySelectorAll('[data-quest-row=\"step\"]')];\n  if (rows.length === 0) return '임무 단계 행이 없다';\n  for (const row of rows) {\n    const text = (row.textContent || '').trim();\n    if (text.includes('진행')) return '단계 행에 상태 낱말 「진행」이 남아 있다: ' + text;\n    const label = (row.querySelector('.status-menu-detail-label')?.textContent || '').trim();\n    const number = label.match(/^(\\d+)\\./);\n    if (!number) return '단계 행 라벨에 번호가 없다: ' + label;\n    const repeated = (text.match(new RegExp('(^|\\\\s)' + number[1] + '\\\\.', 'g')) || []).length;\n    if (repeated !== 1) return '단계 번호 ' + number[1] + ' 이(가) ' + repeated + '번 나온다: ' + text;\n    if (!label.includes('.')) return '단계 라벨에 내용이 없다: ' + label;\n  }\n  const stateRow = menu.querySelector('[data-quest-row=\"state\"]');\n  if (!stateRow) return '임무 상태 행이 없다';\n  const stateLabel = (stateRow.querySelector('.status-menu-detail-label')?.textContent || '').trim();\n  if (stateLabel === '진행') return '상태 행 라벨이 「진행」이라 단계 행과 같은 낱말을 쓴다';\n  return true;\n}"
        }
      ],
      "note": "임무 일지 단계 행이 단계 이름과 상태를 한 번씩만 보여 준다 — findings fallen-star__first-run F2"
    },
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "rt-fallen-star-quest-step-labels",
  projectGenerator: {"game":"fallen-star"},
  checkpointSet: "rt-fallen-star-quest-step-labels",
  // 게임: fallen-star (scripts/qa/play/games.json)
  viewport: {"width":1280,"height":720},
  // 오프닝 컷신은 재현 대상이 아니다 — 세션과 같은 조건(끔)으로 맞춘다.
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats,
  checkpointBeats: { anchor: beats },
};
