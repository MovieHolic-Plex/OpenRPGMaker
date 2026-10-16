// ScarloxyPeople1~3 걷기 칩 21종 설치 확인 시나리오 (출하 플레이어 경로, 2026-10-16).
//
// 픽스처는 실물 AI 도구(place_npc)로 굽는다(scarloxy-people-chips-fixture.mts):
//   npx vite-node --script scripts/qa/runtime/scarloxy-people-chips-fixture.mts --out tmp/scarloxy-people-chips.json
//   node scripts/runtime-qa.mjs --scenario scarloxy-people-chips --project tmp/scarloxy-people-chips.json
// 새 프로젝트(20×15, 시작 10,8): 아래 (6..13, 9..11) 에 21칸을 정면으로 세우고, (7,6)·(13,6) 의 두 명은 배회한다.
// 게임 시간을 직접 밀어(stepFrames) 배회 NPC 의 걷기 프레임이 돌아가는 장면을 시간 순으로 찍는다 — 기대 좌표 게이트 없이 눈으로 본다.

const advance = (frames) => [
  { kind: "pauseFrames" },
  { kind: "stepFrames", frames, deltaMs: 16 },
  { kind: "resumeFrames" },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const scarloxyPeopleChipsScenario = {
  id: "scarloxy-people-chips",
  projectFixture: "tmp/scarloxy-people-chips.json",
  viewport: { width: 768, height: 576 },
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 시작 (10,8). 아래 줄에 ScarloxyPeople1~3 21칸이 3줄로 정면으로 서 있고 두 명이 둘레에서 배회한다",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        // 기본 오프닝 컷신이 끝나야 입력이 열린다(ct-field 시나리오와 같은 절차).
        { kind: "waitFor", testid: "cinematic-sequence", state: "present", timeoutMs: 30_000 },
        { kind: "pressUntil", key: "Enter", testid: "cinematic-sequence", state: "absent", maxPresses: 40, timeoutMs: 60_000 },
        { kind: "waitForRuntime", timeoutMs: 120_000 },
        { kind: "waitFor", testid: "cinematic-sequence", state: "absent", timeoutMs: 30_000 },
        { kind: "seed", seed: 1 },
        { kind: "hold", dir: null, ms: 3500 },
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

export default scarloxyPeopleChipsScenario;
