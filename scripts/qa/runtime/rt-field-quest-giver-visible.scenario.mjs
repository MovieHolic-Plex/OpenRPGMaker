// rt-field-quest-giver-visible — 재현 스크립트에서 자동 생성(scripts/qa/play/to-scenario.mjs).
// 버그가 살아 있는 동안 이 시나리오는 실패한다: 고쳐지면 통과한다(회귀 방지).
// 원본 op: /home/main/salad/play/runs/main1/tasks/preset-adventure-jrpg__first-run/actions.jsonl 75-77
// 증상: 촌장(ev_segment_starter) 이 화면에 그려진다 — 지금은 graphic:{transparent:true} 라 빈 타일에서 조사해야 대화가 열린다. findings preset-adventure-jrpg__first-run F2 / preset-adventure-jrpg__explore F1
// 페이싱: line 76 간격 버림 — field/map_blank_start → field/map_blank_start — 기다릴 조건을 로그에서 정하지 못했다(간격 600ms)
//
// 실행: npm run qa:runtime -- --scenario rt-field-quest-giver-visible --checkpoint-set rt-field-quest-giver-visible --checkpoint all

const beats =
[
  {
    id: "rt-field-quest-giver-visible-repro",
    note: "촌장(ev_segment_starter) 이 화면에 그려진다 — 지금은 graphic:{transparent:true} 라 빈 타일에서 조사해야 대화가 열린다. findings preset-adventure-jrpg__first-run F2 / preset-adventure-jrpg__explore F1",
    ops: [
      {"kind":"key","key":"z"},
    ],
    expect: {
      "pageAssertions": [
        {
          "id": "elder-sprite-drawn",
          "note": "촌장은 투명 그래픽이 아니라 걷기 칩으로 그려져 있어야 한다 — 화면에서 찾을 수 없는 NPC 는 첫 목표를 줄 수 없다",
          "fn": "() => {\n  const hook = window.__oprnCharacterSprites;\n  if (typeof hook !== 'function') return '캐릭터 스프라이트 훅이 없다 — 필드 화면이 아니다';\n  const debug = hook();\n  if (!debug) return '캐릭터 스프라이트 훅이 null 이다';\n  const sprite = debug.events && debug.events['ev_segment_starter'];\n  if (!sprite) return '촌장(ev_segment_starter) 스프라이트가 그려지지 않았다 — 이벤트는 있는데 화면에 보이지 않는다';\n  if (!(sprite.alpha > 0.05)) return '촌장 스프라이트 알파 ' + sprite.alpha + ' — 화면에 보이지 않는다';\n  if (!sprite.textureKey || /missing/i.test(sprite.textureKey)) return '촌장 텍스처가 없다: ' + sprite.textureKey;\n  return true;\n}"
        }
      ],
      "note": "촌장(ev_segment_starter) 이 화면에 그려진다 — 지금은 graphic:{transparent:true} 라 빈 타일에서 조사해야 대화가 열린다. findings preset-adventure-jrpg__first-run F2 / preset-adventure-jrpg__explore F1"
    },
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "rt-field-quest-giver-visible",
  projectGenerator: {"game":"preset-adventure-jrpg"},
  checkpointSet: "rt-field-quest-giver-visible",
  // 게임: preset-adventure-jrpg (scripts/qa/play/games.json)
  viewport: {"width":1280,"height":720},
  // 오프닝 컷신은 재현 대상이 아니다 — 세션과 같은 조건(끔)으로 맞춘다.
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats,
  checkpointBeats: { anchor: beats },
};
