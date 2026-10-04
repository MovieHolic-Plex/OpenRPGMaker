// 조수가 edit_world_terrain(base generate)로 만든 「새 대륙 구조」 세계를 출하 플레이어로 걷는다.
//
// 픽스처는 scripts/qa-game/worldmap-generate-offline.mts 가 만든다(커밋하지 않는 수십 MB JSON):
//   bun scripts/qa-game/worldmap-generate-offline.mts verify-shots/worldmap-generate/shards20 fantasy shards 20
//   WMG_START=verify-shots/worldmap-generate/shards20/start.json \
//     npm run qa:runtime -- --scenario worldmap-generate --project verify-shots/worldmap-generate/shards20/project.json
// 시작 칸·맵 id 는 생성 결과마다 다르므로 같은 폴더의 start.json 에서 읽는다(수도 곁, 오른쪽 두 칸이 키트 걷기 표에서 열린 칸).
import { readFileSync } from "node:fs";

const startFile = process.env.WMG_START ?? "verify-shots/worldmap-generate/shards20/start.json";
const start = JSON.parse(readFileSync(startFile, "utf8"));

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "worldmap-generate",
  beats: [
    {
      id: "title",
      note: "타이틀",
      expect: { testidPresent: ["title-screen"] },
    },
    {
      id: "world-start",
      note: "새 게임 → 생성 구조 세계 지도, 지도 그림이 타일로 그려진다",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }],
      expect: { mapId: start.mapId, x: start.x, y: start.y, playerSpriteTextureLoaded: true, testidAbsent: ["title-screen", "dialogue-box"] },
      shot: true,
    },
    {
      id: "walk-right",
      note: "열린 칸으로 두 걸음",
      ops: [
        { kind: "key", key: "ArrowRight" }, { kind: "waitForPosition", mapId: start.mapId, x: start.x + 1, y: start.y, timeoutMs: 4000 },
        { kind: "key", key: "ArrowRight" }, { kind: "waitForPosition", mapId: start.mapId, x: start.x + 2, y: start.y, timeoutMs: 4000 },
      ],
      expect: { mapId: start.mapId, x: start.x + 2, y: start.y },
      shot: true,
    },
  ],
};
