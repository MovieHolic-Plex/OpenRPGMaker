// 버들항 물을 출하 플레이어에서 본다 — 물빛(겹쳐 그린 물 칸)·깊이 띠(2층 반투명 덧그림)·폭포(절벽면 그림)가 플레이어에서도 그려지고, 물결이 계속 움직이는지.
//
// 왜(2026-11-14): 물은 8프레임 물결 띠다. 그 위에 반투명 덧그림을 얹고 물 칸 그림을 물빛으로 바꿔 그리므로, 플레이어가 물 그림판(tex_beodeul_water)을 싣고
// 프레임마다 바뀐 그림을 그리는지는 플레이어에서만 알 수 있다. 같은 자리를 프레임을 멈춘 채 두 번 찍는다(…-a · …-b, 30프레임 사이) — 두 그림이 달라야 물결이 산 것이다.
//
// 픽스처는 저장소에 두지 않는다(게임 열쇠마다 다르다). 먼저 짓는다:
//   bun scripts/content/beodeul-water/waterVillages.mts <폴더> --play --only hill
//     → <폴더>/after-hill.play.json(그 마을이 시작 맵, 시작 자리 = 폭포 곁 걷는 칸) · after-hill.spots.json
//   npm run qa:runtime -- --scenario beodeul-water --project <폴더>/after-hill.play.json --out <그림 폴더>
import fs from "node:fs";

const flag = process.argv.indexOf("--project");
const projectFixture = flag >= 0 ? process.argv[flag + 1] : "output/beodeul-water/after-hill.play.json";
const facts = (() => { try { return JSON.parse(fs.readFileSync(projectFixture.replace(/\.play\.json$/u, ".spots.json"), "utf8")); } catch { return { spots: [] }; } })();
const project = (() => { try { return JSON.parse(fs.readFileSync(projectFixture, "utf8")); } catch { return {}; } })();
const hold = (frames) => [{ kind: "pauseFrames" }, { kind: "stepFrames", frames, deltaMs: 16 }];
const spot = (n, at) => [
  { id: `0${n}-water-a`, note: "물가에 서서 — 물빛·둑·깊이 띠", shot: true,
    ops: n === 1 ? [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, ...hold(30)] : [{ kind: "resumeFrames" }, { kind: "teleport", mapId: facts.mapId, x: at.x, y: at.y }, ...hold(30)],
    expect: { mapId: facts.mapId ?? project.startMapId, x: at.x, y: at.y, noMissingTextures: true, ...(n === 1 ? { playerSpriteTextureLoaded: true, testidAbsent: ["title-screen"] } : {}) } },
  { id: `0${n}-water-b`, note: "같은 자리 30프레임 뒤 — 물결이 달라져 있어야 한다", shot: true,
    ops: [{ kind: "stepFrames", frames: 30, deltaMs: 16 }], expect: { mapId: facts.mapId ?? project.startMapId, x: at.x, y: at.y, noMissingTextures: true } },
];

export default {
  id: "beodeul-water",
  projectFixture,
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats: [
    { id: "title", expect: { testidPresent: ["title-screen"] } },
    ...(facts.spots.length ? facts.spots : [project.startPos ?? { x: 1, y: 1 }]).slice(0, 2).flatMap((at, i) => spot(i + 1, at)),
    { id: "end", ops: [{ kind: "resumeFrames" }] },
  ],
};
