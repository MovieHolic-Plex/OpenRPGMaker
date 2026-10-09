// 정면 전투(rm2000) 스킨 **화면 투어** — 국면마다 스크린샷을 남긴다.
//
// battle-rm2000.scenario.mjs(게이트, 4비트)와 분리한 이유: 게이트는 "전투가 뜬다"만 빠르게
// 확인해야 하고, 이 투어는 커맨드 → 대상 선택 → 임팩트 → 결과(보상 공개)까지
// 실제 키 입력으로 걸어가며 PR 증거 사진을 찍는다. 픽스처는 게이트와 같은 battle-v3.json
// (1인 파티 · 슬라임 1마리). 이 액터는 배운 스킬·아이템이 없어 서브메뉴가 열리지 않는다 —
// 스킬 서브메뉴와 4인 파티 사진은 scripts/qa/battle-text-audit.mjs(editor-authored-demo-v3) 가 맡는다.
// 아군이 맞는 장면은 battle-rm2000-tour-strict.scenario.mjs 가 맡는다 — ATB(gauge) 에서는 주인공이
// 슬라임보다 빨라 슬라임이 한 번도 행동하기 전에 이긴다(실측: z 60회 → 승리, 아군 피해 팝업 0).
//
//   node scripts/runtime-qa.mjs --scenario battle-rm2000-tour --out verify-shots/rm2000-tour
//
// 결과 비트는 `pressUntil` 로 결정키를 **조건 확인 후에만** 누른다 — 연타로 승리 연출을
// 넘겨 버리면 "보상 행이 없다"는 거짓 결론이 난다(2026-09-01 실측). 보상 행은
// data-revealed 단계로 0.5초 간격 공개되므로 exp 바가 실제로 보일 때까지 기다린 뒤 찍는다.

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const battleRm2000TourScenario = {
  id: "battle-rm2000-tour",
  projectFixture: "test/fixtures/projects/battle-v3.json",
  beats: [
    {
      id: "title",
      note: "타이틀 화면이 뜬다",
      expect: { testidPresent: ["title-screen"] },
    },
    {
      id: "field-start",
      note: "새 게임 → map_battle (0,0)",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
      ],
      expect: { mapId: "map_battle", x: 0, y: 0, testidAbsent: ["title-screen", "battle-scene"] },
    },
    {
      id: "intro",
      note: "전투 이벤트 말걸기 → 인트로(메시지 배너 + 적 등장)",
      ops: [
        { kind: "face", dir: "right" },
        { kind: "action" },
        { kind: "waitFor", testid: "battle-scene", state: "present", timeoutMs: 20000 },
        { kind: "waitForVisible", testid: "battle-message-window", timeoutMs: 20000 },
      ],
      expect: { testidPresent: ["battle-scene", "battle-message-window"] },
      shot: true,
    },
    {
      id: "command",
      note: "액터 커맨드 카드(아이콘 + 알약 커서) · 파티 카드(1인 두 줄 행)",
      ops: [
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 20000 },
        // 버튼은 인트로 배너가 걸려 있는 동안에도 DOM 에 먼저 생긴다(엄격 턴제에서 실측) — 명령 카드가
        // 실제로 보이는 단계까지 기다려야 사진에 카드가 찍힌다.
        { kind: "waitForAttr", testid: "battle-scene", attr: "data-battle-director-step", value: "command", timeoutMs: 20000 },
      ],
      expect: { testidPresent: ["battle-scene", "actor-command-attack", "battle-party"] },
      shot: true,
    },
    {
      id: "target",
      note: "공격 결정 → 대상 선택(리티클 + 적 이름표·HP 카드, 비선택 적 감쇠)",
      ops: [
        { kind: "waitForAttr", testid: "battle-scene", attr: "data-battle-sequence-busy", value: "false", timeoutMs: 20000 },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-target-prompt", state: "present", timeoutMs: 8000 },
      ],
      expect: { testidPresent: ["battle-target-prompt", "battle-target-brackets"] },
      shot: true,
    },
    {
      id: "impact",
      note: "대상 결정 → 피해 팝업이 뜨는 순간",
      ops: [
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-damage-popup", state: "present", timeoutMs: 15000 },
      ],
      expect: { testidPresent: ["battle-damage-popup"] },
      shot: true,
    },
    {
      id: "result",
      note: "결과 카드 — 보상 행이 실제로 공개된 뒤",
      ops: [
        { kind: "pressUntil", key: "z", testid: "battle-result-panel", state: "present", maxPresses: 60, timeoutMs: 2500 },
        // 보상 행은 opacity 페이드로 드러난다 — 기본 alpha 판정선(0.06)에서 찍으면 반투명 행이 남는다.
        // 기본 메뉴 스킨(pixel) 결과는 경험치 행을 파티 창이 대신 말해 숨기므로 전리품 창을 기다린다.
        { kind: "waitForVisible", testid: "battle-result-cards", minAlpha: 0.9, timeoutMs: 15000 },
      ],
      expect: { testidPresent: ["battle-result-panel", "battle-result-confirm"] },
      shot: true,
    },
  ],
};

export default battleRm2000TourScenario;
