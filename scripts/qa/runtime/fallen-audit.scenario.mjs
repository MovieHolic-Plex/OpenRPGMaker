// 『폴른 스타』 통짜 플레이 감사: 타이틀 → 오프닝 6컷 → 광장 → 이리스(퍼즐) → 관문(보스) → 전투 → 엔딩.
// 픽스처: RES_WHICH=fallen res480-fixture.mts. 창 크기 RES_VP(기본 480x270).
const [vw, vh] = (process.env.RES_VP ?? "480x270").split("x").map(Number);
const SHOT_MS = Number(process.env.SHOT_MS ?? 8500);
const opening = [];
for (let i = 1; i <= 6; i += 1) {
  opening.push({ id: `op${i}`, note: `오프닝 ${i}컷`, ops: [{ kind: "hold", dir: null, ms: i === 1 ? 2600 : SHOT_MS }], shot: true });
}
export default {
  id: "fallen-audit",
  projectFixture: process.env.RES_FIXTURE ?? ".omo/runtime-qa/res/fallen.json",
  viewport: { width: vw, height: vh },
  beats: [
    { id: "title", note: "타이틀", expect: { testidPresent: ["title-screen"] }, shot: true },
    { id: "start", note: "새 게임", ops: [{ kind: "key", key: "Enter" }], shot: false },
    ...opening,
    { id: "field", note: "오프닝 끝 → 시작 맵", ops: [
      { kind: "pressUntil", key: "z", testid: "cinematic-sequence", state: "absent", maxPresses: 10 },
      { kind: "waitForRuntime", timeoutMs: 120000 },
      { kind: "hold", dir: null, ms: 2500 },
    ], shot: true },
    { id: "intro-dlg", note: "시작 대사가 있으면 넘긴다", ops: [
      { kind: "pressUntil", key: "z", testid: "dialogue-box", state: "absent", maxPresses: 20 },
      { kind: "hold", dir: null, ms: 800 },
    ], shot: true },
    { id: "iris", note: "북쪽 이리스와 대화", ops: [
      { kind: "face", dir: "up" }, { kind: "action" },
      { kind: "waitFor", testid: "dialogue-box", state: "present" },
      { kind: "key", key: "Enter" },
    ], shot: true },
    { id: "iris-choices", note: "퍼즐 선택지까지", ops: [
      { kind: "pressUntil", key: "Enter", testid: "runtime-choices", state: "present", maxPresses: 10 },
    ], shot: true },
    { id: "iris-solved", note: "정답 두 번", ops: [
      { kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 600 },
      { kind: "pressUntil", key: "Enter", testid: "runtime-choices", state: "present", maxPresses: 10 },
      { kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 600 },
      { kind: "key", key: "Enter" },
    ], shot: true },
    { id: "iris-done", note: "대사 닫기", ops: [
      { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 20 },
      { kind: "hold", dir: null, ms: 600 },
    ], shot: true },
    { id: "gate", note: "오른쪽 관문(엘레나)", ops: [
      { kind: "face", dir: "right" }, { kind: "action" },
      { kind: "waitFor", testid: "dialogue-box", state: "present" },
      { kind: "pressUntil", key: "Enter", testid: "runtime-choices", state: "present", maxPresses: 10 },
    ], shot: true },
    { id: "boss-line", note: "보스 선택", ops: [
      { kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 600 }, { kind: "key", key: "Enter" },
    ], shot: true },
    { id: "battle", note: "전투 진입", ops: [
      { kind: "pressUntil", key: "Enter", testid: "battle-scene", state: "present", maxPresses: 10 },
      { kind: "hold", dir: null, ms: 2500 },
    ], shot: true },
    { id: "battle-mid", note: "전투 진행", ops: [
      { kind: "key", key: "Enter", times: 8, holdMs: 60 }, { kind: "hold", dir: null, ms: 1500 },
    ], shot: true },
    { id: "battle-end", note: "전투 끝까지", ops: [
      { kind: "repeatUntil", testid: "battle-scene", state: "absent", maxRounds: 80, ops: [
        { kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 350 },
      ] },
      { kind: "hold", dir: null, ms: 800 },
    ], shot: true },
    { id: "ending", note: "엔딩까지", ops: [
      { kind: "repeatUntil", testid: "ending-screen", state: "present", maxRounds: 40, ops: [
        { kind: "key", key: "Enter" }, { kind: "hold", dir: null, ms: 400 },
      ] },
      { kind: "hold", dir: null, ms: 1500 },
    ], shot: true },
    { id: "ending-2", note: "엔딩 진행", ops: [
      { kind: "key", key: "Enter", times: 3, holdMs: 60 }, { kind: "hold", dir: null, ms: 1500 },
    ], shot: true },
  ],
};
