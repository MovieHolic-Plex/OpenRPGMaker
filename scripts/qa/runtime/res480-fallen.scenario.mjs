// 『폴른 스타』 기본 해상도 캡처(타이틀 → 시작 맵). 픽스처: res480-fixture.mts RES_WHICH=fallen. 창 크기 RES_VP.
const [vw, vh] = (process.env.RES_VP ?? "1920x1080").split("x").map(Number);
export default {
  id: "res480-fallen",
  projectFixture: process.env.RES_FIXTURE ?? ".omo/runtime-qa/res/fallen.json",
  viewport: { width: vw, height: vh },
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
