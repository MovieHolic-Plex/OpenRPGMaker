// 현대 연애 칩의 짝 흉상·전신이 연애 장면 대화창에 서는지(출하 플레이어 경로, 2026-10-16).
//   npx vite-node --script scripts/qa/runtime/modern-portraits-2-fixture.mts --out tmp/modern-portraits-2.json
//   node scripts/runtime-qa.mjs --scenario modern-portraits-2 --project tmp/modern-portraits-2.json
// 2차 12종(2026-10-17). 시작 (10,3). 하나(11,3) 흉상: base → 당황 → 슬픔 → 기쁨, 지호(9,3) 외형 레코드 전신: base → 기쁨, 유리(10,4) 흉상: base → 기쁨.

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
export const modernPortraits2Scenario = {
  id: "modern-portraits-2",
  projectFixture: "tmp/modern-portraits-2.json",
  viewport: { width: 768, height: 576 },
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 시작. 현대 칩 NPC 셋",
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
    { id: "hana-bust-base", note: "하나(분홍 후드티)에게 말걸기 → 짝 흉상 base", ops: talk("right"), expect: { testidPresent: ["dialogue-box", "dialogue-face"] }, shot: true },
    line("hana-bust-embarrassed", "emotion embarrassed → 당황 흉상"),
    line("hana-bust-sad", "emotion sad → 슬픔 흉상"),
    line("hana-bust-happy", "emotion happy → 기쁨 흉상"),
    { id: "dialogue-end-1", note: "대화 종료", ops: [{ kind: "key", key: "Enter" }, { kind: "waitFor", testid: "dialogue-box", state: "absent" }], expect: { testidAbsent: ["dialogue-box"] } },
    { id: "jiho-full-base", note: "지호(차콜 정장)에게 말걸기 → 외형 레코드(칩만) 전신 폴백 → 짝 전신 base", ops: talk("left"), expect: { testidPresent: ["dialogue-box", "dialogue-face"] }, shot: true },
    line("jiho-full-happy", "emotion happy → 기쁨 전신"),
    { id: "dialogue-end-2", note: "대화 종료", ops: [{ kind: "key", key: "Enter" }, { kind: "waitFor", testid: "dialogue-box", state: "absent" }], expect: { testidAbsent: ["dialogue-box"] } },
    { id: "yuri-bust-base", note: "유리(남색 앞치마)에게 말걸기 → 짝 흉상 base", ops: talk("down"), expect: { testidPresent: ["dialogue-box", "dialogue-face"] }, shot: true },
    line("yuri-bust-happy", "emotion happy → 기쁨 흉상"),
  ],
};

export default modernPortraits2Scenario;
