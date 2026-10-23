// rt-scarloxy-double-target-cursor — 재현 스크립트에서 자동 생성(scripts/qa/play/to-scenario.mjs).
// 버그가 살아 있는 동안 이 시나리오는 실패한다: 고쳐지면 통과한다(회귀 방지).
// 원본 op: /home/main/salad/play/runs/main1/tasks/scarloxy-demo__battle/actions.jsonl 345-355
// 증상: 전투 대상 선택 창에서 손 커서가 두 개(선택 적 + 뒤로) 동시에 그려진다 — findings scarloxy-demo__battle F1
// 페이싱: --until @4 → pressUntil z → battle-target-prompt present
//
// 실행: npm run qa:runtime -- --scenario rt-scarloxy-double-target-cursor --checkpoint-set rt-scarloxy-double-target-cursor --checkpoint all

const beats =
[
  {
    id: "rt-scarloxy-double-target-cursor-repro",
    note: "전투 대상 선택 창에서 손 커서가 두 개(선택 적 + 뒤로) 동시에 그려진다 — findings scarloxy-demo__battle F1",
    ops: [
      {"kind":"key","key":"z"},
      {"kind":"key","key":"z"},
      {"kind":"key","key":"z"},
      {"kind":"pressUntil","key":"z","testid":"battle-target-prompt","state":"present","maxPresses":12},
      {"kind":"key","key":"ArrowDown"},
      {"kind":"key","key":"ArrowRight"},
    ],
    expect: {
      "pageAssertions": [
        {
          "id": "target-cursor-single",
          "note": "대상 목록의 손 커서 글리프는 선택된 항목 한 곳에만 그려져야 한다 — 지금은 선택 적 행과 「뒤로」 행에 동시에 그려진다",
          "fn": "() => { const menu = document.querySelector('.battle-target-menu'); if (!menu) return '대상 선택 창(.battle-target-menu)이 없다 — 커서를 셀 수 없다'; const painted = []; for (const row of menu.querySelectorAll('button.battle-command')) { const rect = row.getBoundingClientRect(); if (!(rect.width > 0 && rect.height > 0)) continue; const before = getComputedStyle(row, '::before'); if (before.content === 'none' || before.content === 'normal' || before.content === '') continue; if (Number(before.opacity) <= 0.05) continue; if (before.width === '0px' || before.height === '0px') continue; if (before.backgroundImage === 'none') continue; painted.push(row.dataset.testid || '(testid 없음)'); } return painted.length === 1 ? true : '대상 목록에 커서 글리프가 ' + painted.length + '개 그려졌다: ' + painted.join(', '); }"
        }
      ],
      "note": "전투 대상 선택 창에서 손 커서가 두 개(선택 적 + 뒤로) 동시에 그려진다 — findings scarloxy-demo__battle F1"
    },
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "rt-scarloxy-double-target-cursor",
  projectGenerator: {"game":"scarloxy-demo"},
  checkpointSet: "rt-scarloxy-double-target-cursor",
  // 게임: scarloxy-demo (scripts/qa/play/games.json)
  viewport: {"width":1280,"height":720},
  // 오프닝 컷신은 재현 대상이 아니다 — 세션과 같은 조건(끔)으로 맞춘다.
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats,
  checkpointBeats: { anchor: beats },
};
