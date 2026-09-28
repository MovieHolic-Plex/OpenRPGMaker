// NPC 대화 얼굴 줄세우기 시나리오 (출하 플레이어 경로).
//
// 픽스처는 실물 AI 도구로 굽는다(face-lineup-fixture.mts):
//   npx vite-node --script scripts/qa/runtime/face-lineup-fixture.mts --out tmp/face-lineup.json
//   node scripts/runtime-qa.mjs --scenario face-lineup --project tmp/face-lineup.json
// 시작 (14,18) 의 오른쪽·왼쪽·위·아래 NPC 에게 차례로 말을 걸고, 대화창 얼굴 id 를 dialogue-face 의
// data-resource-id 로 확인한다(대형 초상이 아닌 낱장 얼굴은 style 의 --face-url 로 그린다 — 스크린샷으로 본다).

const talk = (id, dir, note) => [
  {
    id: `talk-${id}`,
    note,
    ops: [
      { kind: "face", dir },
      { kind: "action" },
      { kind: "waitFor", testid: "dialogue-box", state: "present" },
      { kind: "waitFor", testid: "dialogue-face", state: "present" },
    ],
    expect: { testidPresent: ["dialogue-box", "dialogue-face"] },
    shot: true,
  },
  {
    id: `close-${id}`,
    note: "대사를 넘겨 대화창을 닫는다",
    ops: [{ kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent" }],
    expect: { testidAbsent: ["dialogue-box"] },
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const faceLineupScenario = {
  id: "face-lineup",
  projectFixture: "tmp/face-lineup.json",
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 시작 (14,18), 네 방향에 NPC",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
      ],
      expect: { x: 14, y: 18, testidAbsent: ["dialogue-box"] },
      shot: true,
    },
    ...talk("merchant", "right", "상인(People4 #5) — 생성 도트 얼굴 missing-people-05"),
    ...talk("elder", "left", "촌장(People1 #6) — 조수가 슬라임 얼굴을 넘겼지만 짝 people1-06"),
    ...talk("ninja", "up", "닌자 소녀(People2 #4) — 생성 도트 얼굴 missing-people-00"),
    ...talk("trainer", "down", "트레이너(Scarloxy #0) — 생성 도트 얼굴 missing-scarloxy-00"),
  ],
};

export default faceLineupScenario;

