// 조수가 edit_world_terrain 으로 만든 세계 지도를 출하 플레이어로 걷는다.
//
// 픽스처는 scripts/qa-game/worldmap-terrain-offline.mts 가 만든다(커밋하지 않는 수십 MB JSON):
//   bun scripts/qa-game/worldmap-terrain-offline.mts verify-shots/worldmap-terrain/fantasy fantasy
//   npm run qa:runtime -- --scenario worldmap-terrain --project verify-shots/worldmap-terrain/fantasy/project.json
// 시작 = world_map (24,20) — 수도 「대성」(25,21) 왼쪽 위 칸. 왼쪽 (23,20) 은 키트 걷기 표에서 막힌 칸(고원 절벽),
// 오른쪽 (25,20) 은 열린 칸이다. 즉 지도 그림 타일셋의 통행 표가 실제로 플레이어를 막고 통과시키는지 본다.

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "worldmap-terrain",
  beats: [
    {
      id: "title",
      note: "타이틀",
      expect: { testidPresent: ["title-screen"] },
    },
    {
      id: "world-start",
      note: "새 게임 → 조수가 만든 세계 지도, 지도 그림이 타일로 그려진다",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }],
      expect: { mapId: "world_map", x: 24, y: 20, playerSpriteTextureLoaded: true, testidAbsent: ["title-screen", "dialogue-box"] },
      shot: true,
    },
    {
      id: "blocked-left",
      note: "왼쪽은 고원 절벽 — 걷기 표가 막는다",
      ops: [{ kind: "hold", dir: "left", ms: 700 }],
      expect: { mapId: "world_map", x: 24, y: 20 },
    },
    {
      id: "walk-right",
      note: "오른쪽 평지는 걸어간다",
      ops: [{ kind: "key", key: "ArrowRight" }, { kind: "waitForPosition", mapId: "world_map", x: 25, y: 20, timeoutMs: 4000 }],
      expect: { mapId: "world_map", x: 25, y: 20 },
      shot: true,
    },
  ],
};
