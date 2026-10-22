// 마법 학교 계단 다시 그림(2026-10-22) — 출하 플레이어에서 다시 그린 계단을 오르내린다.
// 픽스처: python3 scripts/qa/runtime/wz-stairs-fixture.py /tmp/wz-stairs.json (시작 = 시계탑 기어실 (2,8), 북쪽을 본다)
//   QA_RECORD_VIDEO=<폴더> node scripts/runtime-qa.mjs --scenario wz-stairs --project /tmp/wz-stairs.json --netns
// 기대: 계단 앞 칸에서 북쪽으로 걸어 계단 그림 맨 아래 줄(이동 칸)을 밟으면 층이 바뀌고, 도착은 짝 계단의 앞 칸에 계단을 등지고(남쪽) 선다.
//   시계탑 올라가는 정비 계단(1,2) → 부엉이 탑 계단통 앞 (2,10) → 계단통으로 내려가 시계탑 계단 앞 (2,5)
//   허니듀크 올라가는 계단(13,2) → 대연회장 성채 계단통 앞 (2,6) → 계단통으로 내려가 허니듀크 계단 앞 (14,5)
//   대연회장 올라가는 성채 계단(11,2) → 부엉이 탑 계단통 앞 (2,10)
const CLOCK = "wz-place-space-clocktower", OWL = "wz-place-space-owlery", HD = "wz-place-space-honeydukes", HALL = "wz-fixture-castle-hall";
const walkTo = (mapId, dir, x, y, steps) => [
  { kind: "playerRoute", moves: Array.from({ length: steps }, () => ({ kind: "move", dir })) },
  { kind: "waitForPosition", mapId, x, y, timeoutMs: 15000 },
];
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const wzStairsScenario = {
  id: "wz-stairs",
  viewport: { width: 1024, height: 768 },
  beats: [
    {
      id: "clock-front",
      note: "시계탑 기어실 — 북벽 정비 계단(올라가는 계단) 남쪽 (2,8)에서 시작",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        { kind: "waitForRuntime" },
        { kind: "hold", dir: null, ms: 5000 },
        { kind: "teleport", mapId: CLOCK, x: 2, y: 8 },
        { kind: "face", dir: "up" },
        { kind: "hold", dir: null, ms: 1500 },
      ],
      expect: { mapId: CLOCK, x: 2, y: 8 },
      shot: true,
    },
    {
      id: "clock-up",
      note: "북쪽으로 걸어 정비 계단 맨 아래 줄을 밟으면 위층(부엉이 탑) 계단통 앞 (2,10)에 남쪽을 보고 선다",
      ops: [...walkTo(OWL, "up", 2, 10, 4), { kind: "hold", dir: null, ms: 1800 }],
      expect: { mapId: OWL, x: 2, y: 10 },
      shot: true,
    },
    {
      id: "owl-down",
      note: "부엉이 탑 계단통(내려가는 계단)으로 북쪽으로 들어서면 아래층 시계탑 정비 계단 앞 (2,5)",
      ops: [{ kind: "face", dir: "up" }, { kind: "hold", dir: null, ms: 700 }, ...walkTo(CLOCK, "up", 2, 5, 1), { kind: "hold", dir: null, ms: 1800 }],
      expect: { mapId: CLOCK, x: 2, y: 5 },
      shot: true,
    },
    {
      id: "hd-up",
      note: "허니듀크 지하 — 책장 사이 올라가는 계단 앞 (13,5)에서 북쪽으로 → 대연회장 성채 계단통 앞 (2,6)",
      ops: [
        { kind: "teleport", mapId: HD, x: 13, y: 5 },
        { kind: "face", dir: "up" },
        { kind: "hold", dir: null, ms: 1500 },
        ...walkTo(HALL, "up", 2, 6, 1),
        { kind: "hold", dir: null, ms: 1800 },
      ],
      expect: { mapId: HALL, x: 2, y: 6 },
      shot: true,
    },
    {
      id: "hall-down",
      note: "대연회장 성채 계단통(내려가는 계단)으로 북쪽으로 → 허니듀크 계단 앞 (14,5)",
      ops: [{ kind: "face", dir: "up" }, { kind: "hold", dir: null, ms: 700 }, ...walkTo(HD, "up", 14, 5, 1), { kind: "hold", dir: null, ms: 1800 }],
      expect: { mapId: HD, x: 14, y: 5 },
      shot: true,
    },
    {
      id: "hall-up",
      note: "대연회장 북벽 성채 돌계단(올라가는 계단) 앞에서 북쪽으로 → 부엉이 탑 계단통 앞",
      ops: [
        { kind: "teleport", mapId: HALL, x: 11, y: 7 },
        { kind: "face", dir: "up" },
        { kind: "hold", dir: null, ms: 1500 },
        ...walkTo(OWL, "up", 2, 10, 3),
        { kind: "hold", dir: null, ms: 1800 },
      ],
      expect: { mapId: OWL, x: 2, y: 10 },
      shot: true,
    },
  ],
};
