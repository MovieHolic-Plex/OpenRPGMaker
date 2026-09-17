// 가로 3칸 계단 전이 + 1칸 계단 칩 depth 증거 시나리오 (출하 플레이어 경로).
//
// 픽스처는 scripts/qa/runtime/stair-qa-fixture.mts 가 실물 buildConceptEvents 로 굽는다:
//   npx vite-node --script scripts/qa/runtime/stair-qa-fixture.mts --out /tmp/stair-qa.json
//   node scripts/runtime-qa.mjs --scenario stair-qa --project /tmp/stair-qa.json
//
// beat 1: 3칸 계단 앞. 세 칸 전부 이동 이벤트(밟으면 map_stair1_qa 로 전이).
// beat 2: 가운데 칸에서 위로 올라가 전이 발동 → 1칸 계단 맵 도착(칩이 캐릭터 아래).

const key = (key, times = 1) => ({ kind: "key", key, times });

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const stairQaScenario = {
  id: "stair-qa",
  beats: [
    {
      id: "stair3-front",
      note: "3칸 계단 앞. 세 칸 전부 이동 이벤트가 달려 있다",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
      ],
      expect: { mapId: "map_stair3_qa", x: 5, y: 7 },
      shot: true,
    },
    {
      id: "climb-middle",
      note: "가운데 칸 앞에서 조사 → 대사 → 전이 → 1칸 계단 맵",
      ops: [
        { kind: "teleport", mapId: "map_stair3_qa", x: 5, y: 6 },
        { kind: "waitForPosition", mapId: "map_stair3_qa", x: 5, y: 6, timeoutMs: 15000 },
        { kind: "face", dir: "up" },
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 15000 },
        { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 6 },
        { kind: "waitForPosition", mapId: "map_stair1_qa", x: 6, y: 6, timeoutMs: 15000 },
        // 전이 페이드인(500ms)이 끝난 뒤 찍어야 도착 샷이 어둡지 않다 — 좌표는 페이드 전에 커밋된다.
        { kind: "hold", dir: null, ms: 900 },
      ],
      expect: { mapId: "map_stair1_qa" },
      shot: true,
    },
    {
      id: "stair1-closeup",
      note: "1칸 계단 남쪽에 서서 촬영 — 칩이 캐릭터 아래에 그려지는지",
      ops: [
        { kind: "teleport", mapId: "map_stair1_qa", x: 5, y: 6 },
        { kind: "waitForPosition", mapId: "map_stair1_qa", x: 5, y: 6, timeoutMs: 15000 },
        { kind: "face", dir: "up" },
      ],
      expect: { mapId: "map_stair1_qa", x: 5, y: 6 },
      shot: true,
    },
    {
      id: "stair1-stand",
      note: "1칸 계단 칸 위에 직접 서서 촬영 — 칩이 캐릭터 위로 뜨는지",
      ops: [
        { kind: "teleport", mapId: "map_stair1_qa", x: 5, y: 5 },
        { kind: "waitForPosition", mapId: "map_stair1_qa", x: 5, y: 5, timeoutMs: 15000 },
        { kind: "face", dir: "down" },
      ],
      expect: { mapId: "map_stair1_qa", x: 5, y: 5 },
      shot: true,
    },
  ],
};
