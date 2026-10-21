// 엔딩 카드 언어 — 게임 언어(ko·en …)로 배지·마지막 장 글자가 나오는지 출하 플레이어로 찍는다.
// 픽스처: DFRAME_WHICH=fallen DFRAME_ENDING=end_fs_act1 DFRAME_LANG=en dialogue-frame-fixture.mts → .omo/runtime-qa/dframe/ending-<lang>.json
// 실행: DFRAME_LANG=en npm run qa:runtime -- --scenario dialogue-ending --out verify-shots/runtime-qa/dialogue-ending-en
const lang = process.env.DFRAME_LANG ?? "ko";
export default {
  id: `dialogue-ending-${lang}`,
  projectFixture: `.omo/runtime-qa/dframe/ending-${lang}.json`,
  viewport: { width: 960, height: 540 },
  beats: [
    { id: "boot", note: "새 게임 → 엔딩 바로 호출", ops: [
      { kind: "pressUntil", key: "Enter", testid: "title-screen", state: "absent", maxPresses: 4, timeoutMs: 60000 },
      { kind: "waitFor", testid: "ending-badge", state: "present", timeoutMs: 180000 },
      { kind: "hold", dir: null, ms: 2600 },
    ], shot: true, expect: { testidPresent: ["ending-badge"] } },
    { id: "final", note: "Enter → 마지막 장", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitFor", testid: "ending-final-title", state: "present", timeoutMs: 60000 },
      { kind: "hold", dir: null, ms: 1500 },
      { kind: "evalToFile", fn: "() => ({ badge: null, final: document.querySelector('[data-testid=ending-final-title]')?.textContent, button: document.querySelector('[data-testid=return-title], .game-over-actions button')?.textContent })", out: `verify-shots/runtime-qa/dialogue-ending-${lang}-text.json` },
    ], shot: true },
  ],
};
