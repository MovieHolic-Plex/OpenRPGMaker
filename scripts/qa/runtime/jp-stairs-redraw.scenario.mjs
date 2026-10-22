// jp_city 실내 계단 다시 그리기(2026-10-22) — 출하 플레이어에서 오르고 내려 본다(1배 영상용).
// 픽스처: 공용 장소 일본 단독주택·맨션·학교 본관·사무실 맵을 한 프로젝트에 모은 것(시작 = 단독주택 2층).
//   python3 make_fixture.py <out.json>   (house 장소 파일에 나머지 장소의 maps 를 합치고 startMapId 만 바꾼다)
//   QA_RECORD_VIDEO=<폴더> flock /tmp/oprn-stairs-browser.lock node scripts/runtime-qa.mjs --scenario jp-stairs-redraw --project <out.json> --netns
// 기대: 계단 앞 칸에서 북쪽(위)으로 걸어 들어가면 층이 바뀌고, 다른 층의 짝 계단 앞 칸에 계단을 등지고(남쪽을 보고) 선다.
//   단독주택 2층 계단통 앞 (19,11) ↔ 1층 오르는 계단 앞 (11,10) · 맨션 외복도 계단통 앞 (19,5) ↔ 로비 계단 앞 (5,4)
//   학교 2층 오르는 계단 앞 (21,16) ↔ 3층 계단통 앞 (23,14) · 사무실 1층 비상계단 앞 (14,4) ↔ 위층 비상계단통 앞 (14,16)
const walk = (mapId, dir, x, y, steps) => [
  { kind: "playerRoute", moves: Array.from({ length: steps }, () => ({ kind: "move", dir })) },
  { kind: "waitForPosition", mapId, x, y, timeoutMs: 15000 },
];
const look = (ms = 900) => ({ kind: "hold", dir: null, ms });
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const jpStairsRedrawScenario = {
  id: "jp-stairs-redraw",
  beats: [
    {
      id: "house-2f-to-1f-and-back",
      note: "단독주택 2층 — 계단통 앞 (19,11) 에서 위로 → 1층 오르는 계단 앞 (11,10) 아래를 보고 → 위로 올라 2층 계단통 앞",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        { kind: "waitForRuntime" },
        { kind: "hold", dir: null, ms: 5000 },
        { kind: "teleport", mapId: "jp-city-house-2f", x: 16, y: 11 },
        look(1200),
        ...walk("jp-city-house-2f", "right", 19, 11, 3),
        { kind: "face", dir: "up" },
        look(700),
        ...walk("jp-city-house-1f", "up", 11, 10, 1),
        look(1500),
        ...walk("jp-city-house-2f", "up", 19, 11, 1),
        look(1500),
      ],
      expect: { mapId: "jp-city-house-2f", x: 19, y: 11 },
      shot: true,
    },
    {
      id: "mansion-corridor-lobby",
      note: "맨션 외복도 계단통 앞 (19,5) → 로비 계단 앞 (5,4) → 로비 계단으로 다시 외복도 계단통 앞",
      ops: [
        { kind: "teleport", mapId: "jp-city-mansion-corridor", x: 16, y: 5 },
        look(1000),
        ...walk("jp-city-mansion-corridor", "right", 19, 5, 3),
        { kind: "face", dir: "up" },
        look(700),
        ...walk("jp-city-mansion-lobby", "up", 5, 4, 1),
        look(1500),
        ...walk("jp-city-mansion-corridor", "up", 19, 5, 1),
        look(1500),
      ],
      expect: { mapId: "jp-city-mansion-corridor", x: 19, y: 5 },
      shot: true,
    },
    {
      id: "school-2f-3f",
      note: "학교 2층 오르는 계단 앞 (21,16) → 3층 계단통 앞 (23,14) → 계단통으로 다시 2층",
      ops: [
        { kind: "teleport", mapId: "jp-city-school-2f", x: 18, y: 16 },
        look(1000),
        ...walk("jp-city-school-2f", "right", 21, 16, 3),
        { kind: "face", dir: "up" },
        look(700),
        ...walk("jp-city-school-3f", "up", 23, 14, 1),
        look(1500),
        ...walk("jp-city-school-2f", "up", 21, 16, 1),
        look(1500),
      ],
      expect: { mapId: "jp-city-school-2f", x: 21, y: 16 },
      shot: true,
    },
    {
      id: "office-1f-floor",
      note: "사무실 1층 비상계단 앞 (14,4) → 위층 비상계단통 앞 (14,16) → 다시 1층",
      ops: [
        { kind: "teleport", mapId: "jp-city-office-1f", x: 14, y: 6 },
        look(1000),
        ...walk("jp-city-office-1f", "up", 14, 4, 2),
        look(500),
        ...walk("jp-city-office-floor", "up", 14, 16, 1),
        look(1500),
        ...walk("jp-city-office-1f", "up", 14, 4, 1),
        look(1500),
      ],
      expect: { mapId: "jp-city-office-1f", x: 14, y: 4 },
      shot: true,
    },
  ],
};
