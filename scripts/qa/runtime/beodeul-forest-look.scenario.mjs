// 버들항 «숲 겉모습» 을 출하 플레이어에서 본다 — 숲 구성을 고른 게임의 숲 도로를 걸어, 2층 덧그림(숲 바닥)과 4층 나무 머리가 플레이어에서도 그려지는지.
//
// 왜(2026-11-13): 숲 구성 그림은 편집기 그리기(scripts/qa-game/render.mts)로만 봤다. 숲 바닥은 2층 ★ 덧그림, 나무 머리는 4층 ★ 이고
// 그림은 둘째 그림판(tex_beodeul_stands)의 이식 칸이다 — 플레이어가 그 그림판을 싣고 그 층을 그리는지는 플레이어에서만 알 수 있다.
//
// 픽스처는 저장소에 두지 않는다(게임 열쇠마다 다르다). 먼저 짓는다:
//   bun scripts/content/beodeul-variety/forestMaps.mts <폴더> --tag play --games 3 --project
//     → <폴더>/play-route-3.project.json (숲 도로가 시작 맵, 시작 자리 = 나무에 둘러싸인 걷는 칸) · <폴더>/play-forest.json(자리 셋)
//   npm run qa:runtime -- --scenario beodeul-forest-look --project <폴더>/play-route-3.project.json
// 그림은 verify-shots/runtime-qa/beodeul-forest-look/ 에 남는다. noMissingTextures 가 그림판이 빠지면 실패시킨다.
import fs from "node:fs";
import path from "node:path";

const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "output/beodeul-forest-look/play-route-3.project.json";
const facts = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(path.dirname(projectFixture), "play-forest.json"), "utf8")); } catch { return { rows: [] }; }
})();
const row = facts.rows.find((r) => `${r.id}.project.json` === path.basename(projectFixture)) ?? { spots: [] };
const project = (() => { try { return JSON.parse(fs.readFileSync(projectFixture, "utf8")); } catch { return {}; } })();
const still = [{ kind: "pauseFrames" }, { kind: "stepFrames", frames: 30, deltaMs: 16 }, { kind: "resumeFrames" }];

export default {
  id: "beodeul-forest-look",
  projectFixture,
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats: [
    { id: "title", expect: { testidPresent: ["title-screen"] } },
    {
      id: "01-forest-start", note: "숲 도로의 시작 자리 — 숲 바닥(2층)과 나무 머리(4층)가 그려진다", shot: true,
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, ...still],
      expect: { mapId: project.startMapId, ...(project.startPos ?? {}), playerSpriteTextureLoaded: true, noMissingTextures: true, testidAbsent: ["title-screen"] },
    },
    ...row.spots.slice(1).map((spot, n) => ({
      id: `0${n + 2}-forest-spot`, note: "같은 맵의 다른 자리(나무에 둘러싸인 걷는 칸)", shot: true,
      ops: [{ kind: "teleport", mapId: project.startMapId, x: spot.x, y: spot.y }, ...still],
      expect: { mapId: project.startMapId, x: spot.x, y: spot.y, noMissingTextures: true },
    })),
  ],
};
