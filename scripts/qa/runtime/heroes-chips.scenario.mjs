// Heroes1 걷기 칩 8종 설치 확인 시나리오 (출하 플레이어 경로, 2026-10-16).
//
// 픽스처는 실물 AI 도구(place_npc)로 굽는다(heroes-chips-fixture.mts):
//   npx vite-node --script scripts/qa/runtime/heroes-chips-fixture.mts --out tmp/heroes-chips.json
//   node scripts/runtime-qa.mjs --scenario heroes-chips --project tmp/heroes-chips.json
// 시작 (14,18), 아래 (10..17,21) 에 칸 0~7 을 정면으로 세우고, (12,18)·(16,18) 의 로봇·정찰병은 배회한다.
// 게임 시간을 직접 밀어(stepFrames) 배회 NPC 의 걷기 프레임이 돌아가는 장면을 시간 순으로 찍는다 — 기대 좌표 게이트 없이 눈으로 본다.

const advance = (frames) => [
  { kind: "pauseFrames" },
  { kind: "stepFrames", frames, deltaMs: 16 },
  { kind: "resumeFrames" },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const heroesChipsScenario = {
  id: "heroes-chips",
  projectFixture: "tmp/heroes-chips.json",
  viewport: { width: 768, height: 576 },
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 시작 (14,18). 아래 줄에 Heroes1 칸 0~7 이 정면으로 서 있고 로봇·정찰병이 둘레에서 배회한다",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
        { kind: "hold", dir: "down", ms: 420 },
      ],
      expect: { testidAbsent: ["dialogue-box"] },
      shot: true,
    },
    ...[1, 2, 3, 4].map((n) => ({
      id: `walkers-t${n}`,
      note: `게임 시간 ${n * 45} 프레임 뒤 — 배회 NPC 의 이동·걷기 프레임`,
      ops: advance(45),
      expect: { testidAbsent: ["dialogue-box"] },
      shot: true,
    })),
  ],
};

export default heroesChipsScenario;
