// 현대 연애 칩의 짝 흉상·전신이 연애 장면 대화창에 서는지(출하 플레이어 경로, 2026-10-16).
//   npx vite-node --script scripts/qa/runtime/modern-portraits-fixture.mts --out tmp/modern-portraits.json
//   node scripts/runtime-qa.mjs --scenario modern-portraits --project tmp/modern-portraits.json
// 시작 (10,3). 오른쪽 (11,3) 서연: 짝 흉상 base → happy → sad → angry(없는 표정 → 기본). 왼쪽 (9,3) 민준: 외형 레코드(칩만) → 짝 전신 → surprised.

/** 한 줄 넘기기: 첫 Enter = 다음 줄, 둘째 Enter = 타이핑 건너뛰기. */
const line = (id, note) => ({
  id, note,
  ops: [
    { kind: "key", key: "Enter" },
    { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 },
    { kind: "key", key: "Enter" },
    { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 },
  ],
  expect: { testidPresent: ["dialogue-box", "dialogue-face"] },
  shot: true,
});
const talk = (dir) => [
  { kind: "face", dir },
  { kind: "action" },
  { kind: "waitFor", testid: "dialogue-box", state: "present" },
  { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 },
  { kind: "key", key: "Enter" },
  { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const modernPortraitsScenario = {
  id: "modern-portraits",
  projectFixture: "tmp/modern-portraits.json",
  viewport: { width: 768, height: 576 },
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 시작. 좌우에 현대 칩 NPC 둘",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        { kind: "waitFor", testid: "cinematic-sequence", state: "present", timeoutMs: 30_000 },
        { kind: "pressUntil", key: "Enter", testid: "cinematic-sequence", state: "absent", maxPresses: 40, timeoutMs: 60_000 },
        { kind: "waitForRuntime", timeoutMs: 120_000 },
        { kind: "waitFor", testid: "cinematic-sequence", state: "absent", timeoutMs: 30_000 },
        { kind: "seed", seed: 1 },
        { kind: "hold", dir: null, ms: 1500 },
      ],
      expect: { testidAbsent: ["dialogue-box"] },
      shot: true,
    },
    { id: "bust-base", note: "서연에게 말걸기 → 짝 흉상 base(칩과 같은 인물)", ops: talk("right"), expect: { testidPresent: ["dialogue-box", "dialogue-face"] }, shot: true },
    line("bust-happy", "emotion happy → 같은 인물의 기쁨 흉상"),
    line("bust-sad", "emotion sad → 슬픔 흉상"),
    line("bust-angry-fallback", "emotion angry → 이 세트에 없는 표정: 깨진 이미지 대신 기본 흉상"),
    { id: "dialogue-end", note: "대화 종료", ops: [{ kind: "key", key: "Enter" }, { kind: "waitFor", testid: "dialogue-box", state: "absent" }], expect: { testidAbsent: ["dialogue-box"] } },
    { id: "full-base", note: "민준에게 말걸기 → 외형 레코드(칩만) 전신 폴백 → 짝 전신 base", ops: talk("left"), expect: { testidPresent: ["dialogue-box", "dialogue-face"] }, shot: true },
    line("full-surprised", "emotion surprised → 놀람 전신(같은 인물)"),
  ],
};

export default modernPortraitsScenario;
