// 남쪽 벽에 붙어 있던 공용 장소 계단 5곳을 한 줄 위로 옮긴 뒤(2026-10-22) — 출하 플레이어에서 하나씩 걸어 들어가 본다.
// 픽스처: 공용 장소 5곳(일본 단독주택·맨션·학교 본관 + 마법 학교 시계탑·부엉이 탑)의 맵을 한 프로젝트에 모은 것.
//   python3 (scripts/content/stairs/move-shipped-stairs.mts 머리말 참고) → /tmp/…/stairs.json, 시작 = 단독주택 2층 (16,10)
//   QA_RECORD_VIDEO=<폴더> node scripts/runtime-qa.mjs --scenario stair-moved --project <stairs.json> --netns
// 기대: 각 계단 앞 칸에 서서 위로 걸으면 계단 그림 칸에서 층이 바뀌고, 돌아오면 그 계단 앞 칸에 계단을 등지고 선다.
//       학교 2층 오르는 계단 → 3층 「내려가는」 계단통 앞(23,13)(예전엔 3층 오르는 계단 앞). 마법 학교 두 곳은 층 이동이 없어 계단 위로 올라서기만.
// 걸음은 플레이어 이동 경로로 한 칸씩(키를 누르고 떼는 방식은 마지막 칸을 넘어가기도 했다). 층 이동 이벤트는 걸어서 밟을 때처럼 탄다.
const walkTo = (mapId, dir, x, y, steps) => [
  { kind: "playerRoute", moves: Array.from({ length: steps }, () => ({ kind: "move", dir })) },
  { kind: "waitForPosition", mapId, x, y, timeoutMs: 15000 },
];
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const stairMovedScenario = {
  id: "stair-moved",
  beats: [
    {
      id: "house-2f-front",
      note: "단독주택 2층 — 복도 동쪽 끝 내려가는 계단통 앞 칸(19,10)으로 걸어간다(예전엔 앞 칸이 남쪽 벽)",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        { kind: "waitForRuntime" },
        { kind: "hold", dir: null, ms: 1200 },
        // 첫 화면의 장 제목 카드가 입력을 잡고 있어 처음 걸음이 먹지 않았다 — 같은 칸으로 옮겨 놓고 시작한다.
        { kind: "hold", dir: null, ms: 4500 },
        { kind: "teleport", mapId: "jp-city-house-2f", x: 16, y: 10 },
        { kind: "hold", dir: null, ms: 1500 },
        ...walkTo("jp-city-house-2f", "right", 19, 10, 3),
        { kind: "face", dir: "up" },
        { kind: "hold", dir: null, ms: 600 },
      ],
      expect: { mapId: "jp-city-house-2f", x: 19, y: 10 },
      shot: true,
    },
    {
      id: "house-down-and-back",
      note: "위로 걸어 계단통 칸에서 1층으로 → 1층 오르는 계단으로 다시 2층, 계단통 앞에 아래를 보고 선다",
      ops: [
        ...walkTo("jp-city-house-1f", "up", 11, 10, 1),
        { kind: "hold", dir: null, ms: 900 },
        ...walkTo("jp-city-house-2f", "up", 19, 10, 1),
        { kind: "hold", dir: null, ms: 1200 },
      ],
      expect: { mapId: "jp-city-house-2f", x: 19, y: 10 },
      shot: true,
    },
    {
      id: "mansion-corridor",
      note: "맨션 외복도 — 동쪽 끝 계단통 앞(19,4)에서 위로 → 로비 → 로비 계단으로 다시 외복도 계단통 앞",
      ops: [
        { kind: "teleport", mapId: "jp-city-mansion-corridor", x: 15, y: 4 },
        { kind: "hold", dir: null, ms: 900 },
        ...walkTo("jp-city-mansion-corridor", "right", 19, 4, 4),
        { kind: "face", dir: "up" },
        { kind: "hold", dir: null, ms: 500 },
        ...walkTo("jp-city-mansion-lobby", "up", 5, 4, 1),
        { kind: "hold", dir: null, ms: 900 },
        ...walkTo("jp-city-mansion-corridor", "up", 19, 4, 1),
        { kind: "hold", dir: null, ms: 1200 },
      ],
      expect: { mapId: "jp-city-mansion-corridor", x: 19, y: 4 },
      shot: true,
    },
    {
      id: "school-2f-to-3f",
      note: "학교 2층 오르는 계단 → 3층 내려가는 계단통 앞(23,13)에 아래를 보고 → 그 계단통으로 다시 2층",
      ops: [
        { kind: "teleport", mapId: "jp-city-school-2f", x: 18, y: 16 },
        { kind: "hold", dir: null, ms: 900 },
        ...walkTo("jp-city-school-2f", "right", 21, 16, 3),
        { kind: "face", dir: "up" },
        { kind: "hold", dir: null, ms: 500 },
        ...walkTo("jp-city-school-3f", "up", 23, 13, 1),
        { kind: "hold", dir: null, ms: 1400 },
        ...walkTo("jp-city-school-2f", "up", 21, 16, 1),
        { kind: "hold", dir: null, ms: 1200 },
      ],
      expect: { mapId: "jp-city-school-2f", x: 21, y: 16 },
      shot: true,
    },
    {
      id: "clocktower-stair",
      note: "시계탑 기어실 — 서벽 정비 계단 앞(2,13)에서 위로 계단을 올라선다(예전엔 앞 칸이 남벽)",
      ops: [
        { kind: "teleport", mapId: "wz-place-space-clocktower", x: 5, y: 13 },
        { kind: "hold", dir: null, ms: 900 },
        ...walkTo("wz-place-space-clocktower", "left", 2, 13, 3),
        ...walkTo("wz-place-space-clocktower", "up", 2, 11, 2),
        { kind: "hold", dir: null, ms: 1000 },
      ],
      expect: { mapId: "wz-place-space-clocktower", x: 2, y: 11 },
      shot: true,
    },
    {
      id: "owlery-stair",
      note: "부엉이 탑 — 서벽 탑 계단 앞(2,10)에서 위로 계단을 올라선다",
      ops: [
        { kind: "teleport", mapId: "wz-place-space-owlery", x: 5, y: 10 },
        { kind: "hold", dir: null, ms: 900 },
        ...walkTo("wz-place-space-owlery", "left", 2, 10, 3),
        ...walkTo("wz-place-space-owlery", "up", 2, 8, 2),
        { kind: "hold", dir: null, ms: 1000 },
      ],
      expect: { mapId: "wz-place-space-owlery", x: 2, y: 8 },
      shot: true,
    },
  ],
};
