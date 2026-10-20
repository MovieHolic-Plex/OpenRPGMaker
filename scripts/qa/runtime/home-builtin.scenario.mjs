// 첫 화면 「기본 게임」 카드 그림 — 출하 플레이어로 타이틀 · 오프닝 두 장 · 첫 필드를 찍는다.
// 픽스처: home-builtin-fixture.mts (HOME_WHICH=fallen|astra) → .omo/runtime-qa/home/<which>.json
// 실행: HOME_WHICH=fallen npm run qa:runtime -- --scenario home-builtin --out verify-shots/runtime-qa/home-builtin-fallen
// 창 1920×1080 = 480×270 의 정수 4배(폴른 스타는 480×270 배율 1 로 출하). 굽기: scripts/content/bake-home-builtin-art.py
const which = process.env.HOME_WHICH ?? "fallen";
const skipOpening = { kind: "pressUntil", key: "z", testid: "cinematic-sequence", state: "absent", maxPresses: 14 };
export default {
  id: `home-builtin-${which}`,
  projectFixture: `.omo/runtime-qa/home/${which}.json`,
  viewport: { width: 1920, height: 1080 },
  beats: [
    { id: "title", note: "타이틀", ops: [{ kind: "hold", dir: null, ms: 3500 }], expect: { testidPresent: ["title-screen"] }, shot: true },
    { id: "op1", note: "오프닝 첫 장면", ops: [
      { kind: "key", key: "Enter" },
      { kind: "waitFor", testid: "cinematic-sequence", timeoutMs: 60000 },
      { kind: "hold", dir: null, ms: 3500 },
    ], shot: true },
    { id: "op2", note: "오프닝 둘째 장면", ops: [{ kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 3500 }], shot: true },
    { id: "op3", note: "오프닝 셋째 장면", ops: [{ kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 3500 }], shot: true },
    { id: "field", note: "첫 필드", ops: [
      skipOpening,
      { kind: "waitForRuntime", timeoutMs: 120000 },
      { kind: "hold", dir: null, ms: 2500 },
      { kind: "pressUntil", key: "z", testid: "dialogue-box", state: "absent", maxPresses: 20 },
      { kind: "hold", dir: null, ms: 2500 },
    ], shot: true },
  ],
};
