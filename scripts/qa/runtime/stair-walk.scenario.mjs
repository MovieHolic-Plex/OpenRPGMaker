// 계단 입구 계약 — 출하 플레이어에서 계단을 걸어 올라가 본다(2026-10-22).
// 픽스처: 공용 장소 jp-city-school-1f(학교 본관)를 그대로, 시작만 1층 오르는 계단 앞 줄 왼쪽(20,13)으로.
//   python3 - (scripts/qa/staging 의 stair-walk-fixture 참고) → /tmp/stair/stair-walk.json
//   QA_RECORD_VIDEO=/tmp/stair/video node scripts/runtime-qa.mjs --scenario stair-walk --project /tmp/stair/stair-walk.json
// 기대: 1층 (20,13) → 오른쪽으로 계단 앞 칸 (23,13) → 위로 걸어 계단 그림 칸 (23,12) 에서 층 이동 → 2층 내려가는 계단통 앞 (23,17) 에 계단을 등지고(아래) 선다.
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const stairWalkScenario = {
  id: "stair-walk",
  beats: [
    {
      id: "before-stairs",
      note: "1층 — 오르는 계단(학교 콘크리트 계단) 앞 줄로 걸어가 계단 앞 칸에 선다",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        { kind: "waitForRuntime" },
        { kind: "hold", dir: null, ms: 1500 },
        { kind: "dir", dir: "right" },
        { kind: "waitForPosition", mapId: "jp-city-school-1f", x: 23, y: 13, timeoutMs: 10000 },
        { kind: "dir", dir: null },
        { kind: "face", dir: "up" },
      ],
      expect: { mapId: "jp-city-school-1f", x: 23, y: 13 },
      shot: true,
    },
    {
      id: "arrive-2f",
      note: "위로 걸어 계단 그림 칸을 밟으면 2층 — 짝인 내려가는 계단통 앞에 내린다",
      ops: [
        { kind: "dir", dir: "up" },
        { kind: "waitForPosition", mapId: "jp-city-school-2f", x: 23, y: 17, timeoutMs: 15000 },
        { kind: "dir", dir: null },
        { kind: "hold", dir: null, ms: 1200 },
      ],
      expect: { mapId: "jp-city-school-2f", x: 23, y: 17 },
      shot: true,
    },
    {
      id: "walk-away",
      note: "계단을 등지고 내려선 뒤 복도 쪽(왼쪽)으로 걸어 나온다",
      ops: [
        { kind: "dir", dir: "left" },
        { kind: "waitForPosition", mapId: "jp-city-school-2f", x: 20, y: 17, timeoutMs: 8000 },
        { kind: "dir", dir: null },
        { kind: "hold", dir: null, ms: 1500 },
      ],
      expect: { mapId: "jp-city-school-2f", x: 20, y: 17 },
      shot: true,
    },
  ],
};
