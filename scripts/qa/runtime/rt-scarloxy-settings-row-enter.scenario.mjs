// rt-scarloxy-settings-row-enter — 재현 스크립트에서 자동 생성(scripts/qa/play/to-scenario.mjs).
// 버그가 살아 있는 동안 이 시나리오는 실패한다: 고쳐지면 통과한다(회귀 방지).
// 원본 op: /home/main/salad/play/runs/main1/tasks/scarloxy-demo__menus/actions.jsonl 176-183
// 증상: 시스템 ▸ 대기 화면에서 Enter로 전투 대기 값을 바꿀 수 있다(열 때 토글되지 않는다) — findings scarloxy-demo__menus F2
//
// 실행: npm run qa:runtime -- --scenario rt-scarloxy-settings-row-enter --checkpoint-set rt-scarloxy-settings-row-enter --checkpoint all

const beats =
[
  {
    id: "rt-scarloxy-settings-row-enter-repro",
    note: "시스템 ▸ 대기 화면에서 Enter로 전투 대기 값을 바꿀 수 있다(열 때 토글되지 않는다) — findings scarloxy-demo__menus F2",
    ops: [
      // 앵커는 필드 세이브(메뉴 닫힘)다. 기록된 176~178 은 이미 열린 시스템 목록을 전제하므로,
      // 같은 화면(시스템 ▸ 대기)에 도달하는 필드 경로로 바꾸고 기록된 마지막 입력(181)은 그대로 쓴다.
      {"kind":"key","key":"x"},
      {"kind":"key","key":"ArrowDown"},
      {"kind":"key","key":"ArrowDown"},
      {"kind":"key","key":"ArrowDown"},
      {"kind":"key","key":"ArrowDown"},
      {"kind":"key","key":"ArrowDown"},
      {"kind":"key","key":"z"},
      {"kind":"key","key":"ArrowDown"},
      {"kind":"key","key":"ArrowDown"},
      {"kind":"key","key":"z"},
      {"kind":"key","key":"z"},
    ],
    expect: {
      "textAbsent": "선택할 수 없습니다",
      "pageAssertions": [
        {
          "id": "wait-row-activatable",
          "note": "설정(전투 대기) 화면의 행은 Enter로 조작할 수 있는 행이어야 한다 — 지금은 정보 행뿐이라 「선택할 수 없습니다」만 뜬다",
          "fn": "() => {\n  const menu = document.querySelector('[data-testid=\"main-menu\"]');\n  if (!menu) return '메뉴가 없다';\n  const detail = menu.querySelector('.status-menu-detail');\n  if (!detail) return '상세 패널이 없다';\n  const actions = [...detail.querySelectorAll('.status-menu-detail-list .status-menu-detail-action')];\n  if (actions.length === 0) return '조작 가능한 행이 하나도 없다 — 정보 행뿐이라 Enter가 거부된다';\n  const row = detail.querySelector('[data-testid=\"status-menu-wait-toggle\"]');\n  if (!row) return '전투 대기 행이 조작 행이 아니다: ' + actions.map((n) => (n.textContent || '').trim()).join(' | ');\n  const value = (row.querySelector('.status-menu-detail-value')?.textContent || '').trim();\n  if (value !== 'ON' && value !== 'OFF') return '전투 대기 값이 ON/OFF가 아니다: ' + value;\n  return true;\n}"
        },
        {
          "id": "wait-value-flips-by-enter",
          "note": "화면을 여는 것만으로는 값이 바뀌지 않고, 화면 안에서 Enter를 누르면 ON→OFF로 바뀌어야 한다",
          "fn": "() => {\n  const menu = document.querySelector('[data-testid=\"main-menu\"]');\n  if (!menu) return '메뉴가 없다';\n  const row = menu.querySelector('[data-testid=\"status-menu-wait-toggle\"]');\n  if (!row) return '전투 대기 행이 조작 행이 아니다 — Enter로 값을 바꿀 수 없다';\n  const value = (row.querySelector('.status-menu-detail-value')?.textContent || '').trim();\n  if (value !== 'OFF') return 'Enter 뒤에도 값이 ' + value + ' 다 — 화면 안에서 값을 바꿀 수 없다';\n  const status = (menu.querySelector('.status-menu-message')?.textContent || '').trim();\n  if (status.includes('선택할 수 없습니다')) return 'Enter 가 여전히 거부된다: ' + status;\n  return true;\n}"
        }
      ],
      "note": "시스템 ▸ 대기 화면에서 Enter로 전투 대기 값을 바꿀 수 있다(열 때 토글되지 않는다) — findings scarloxy-demo__menus F2"
    },
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "rt-scarloxy-settings-row-enter",
  projectGenerator: {"game":"scarloxy-demo"},
  checkpointSet: "rt-scarloxy-settings-row-enter",
  // 게임: scarloxy-demo (scripts/qa/play/games.json)
  viewport: {"width":1280,"height":720},
  // 오프닝 컷신은 재현 대상이 아니다 — 세션과 같은 조건(끔)으로 맞춘다.
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats,
  checkpointBeats: { anchor: beats },
};
