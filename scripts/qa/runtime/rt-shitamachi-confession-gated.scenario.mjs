// rt-shitamachi-confession-gated — 재현 스크립트에서 자동 생성(scripts/qa/play/to-scenario.mjs).
// 버그가 살아 있는 동안 이 시나리오는 실패한다: 고쳐지면 통과한다(회귀 방지).
// 원본 op: /home/main/salad/play/runs/rerun2/tasks/shitamachi-fourth-season__first-run/actions.jsonl 491-494
// 증상: 새 게임 첫 프레임에서 스폰 오른쪽을 조사해도 고백 무대(엔딩 선택지)가 열리지 않는다. findings shitamachi-fourth-season__first-run F2 (rerun2)
//
// 실행: npm run qa:runtime -- --scenario rt-shitamachi-confession-gated --checkpoint-set rt-shitamachi-confession-gated --checkpoint all

const beats =
[
  {
    id: "rt-shitamachi-confession-gated-repro",
    note: "새 게임 첫 프레임에서 스폰 오른쪽을 조사해도 고백 무대(엔딩 선택지)가 열리지 않는다. findings shitamachi-fourth-season__first-run F2 (rerun2)",
    ops: [
      {"kind":"face","dir":"right"},
      {"kind":"key","key":"z"},
      {"kind":"key","key":"z"},
    ],
    expect: {
      "textAbsent": "문화제 전야제",
      "pageAssertions": [
        {
          "id": "confession-stage-dormant",
          "note": "고백 무대는 서연의 등롱 점등(sw_shitamachi_lantern_lit) 전에는 열리지 않는다 — 새 게임 첫 프레임에 엔딩 선택지가 열리면 안 된다",
          "fn": "() => {\n  const hook = window.__oprnCharacterSprites;\n  if (typeof hook !== 'function') return '캐릭터 스프라이트 훅이 없다 — 필드 화면이 아니다';\n  const debug = hook();\n  if (!debug) return '캐릭터 스프라이트 훅이 null 이다';\n  const events = debug.events || {};\n  if (!events['ev_shitamachi_seoyeon']) return '서연 이벤트가 그려지지 않았다 — 필드 스프라이트를 못 읽어 판정할 수 없다';\n  const stage = events['ev_shitamachi_confession'];\n  if (stage) return '문화제 고백 무대가 등롱 점등 전에 필드에 서 있다 — 새 게임 첫 프레임부터 엔딩으로 갈 수 있다';\n  return true;\n}"
        }
      ],
      "note": "새 게임 첫 프레임에서 스폰 오른쪽을 조사해도 고백 무대(엔딩 선택지)가 열리지 않는다. findings shitamachi-fourth-season__first-run F2 (rerun2)"
    },
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "rt-shitamachi-confession-gated",
  projectGenerator: {"game":"shitamachi-fourth-season"},
  checkpointSet: "rt-shitamachi-confession-gated",
  // 게임: shitamachi-fourth-season (scripts/qa/play/games.json)
  viewport: {"width":960,"height":540},
  // 오프닝 컷신은 재현 대상이 아니다 — 세션과 같은 조건(끔)으로 맞춘다.
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats,
  checkpointBeats: { anchor: beats },
};
