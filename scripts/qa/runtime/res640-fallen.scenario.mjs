// 해상도 기본값(640×360) 플레이어 캡처. 픽스처: .omo/runtime-qa/res/fallen.json (scripts/qa/runtime/res640-fixture.mts 로 생성, RES_WHICH=fallen).
export default {
  id: "res640-fallen",
  projectFixture: ".omo/runtime-qa/res/fallen.json",
  viewport: { width: 1280, height: 720 },
  beats: [
    { id: "title", note: "타이틀", expect: { testidPresent: ["title-screen"] }, shot: true },
    { id: "field", note: "새 게임 → 시작 맵", ops: [
      { kind: "key", key: "Enter" },
      { kind: "pressUntil", key: "z", testid: "cinematic-sequence", state: "absent", maxPresses: 8 },
      { kind: "waitForRuntime", timeoutMs: 120000 },
      { kind: "key", key: "Escape" },
      { kind: "hold", dir: null, ms: 2500 },
      { kind: "key", key: "Escape" },
      { kind: "hold", dir: null, ms: 2500 },
      { kind: "pressUntil", key: "z", testid: "dialogue-box", state: "absent", maxPresses: 12 },
      { kind: "key", key: "Escape" },
      { kind: "hold", dir: null, ms: 2000 },
    ], expect: { testidAbsent: ["title-screen"] }, shot: true },
  ],
};
