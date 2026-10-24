// 속삭이는 숲 여섯 맵 — 맵마다 도착 칸에서 한 장, 그리고 그 맵의 출구를 모두 실제로 밟아 건너간 쪽 도착을 한 장씩.
// 출구 칸 바로 안쪽에 서서 출구 쪽으로 걷는다(transfer 는 발을 디딘 다음 틱에 발동 → waitForMap).
// 체크포인트에서 바로 시작한다(타이틀을 거치지 않는다). 구운 데모를 픽스처로 쓴다:
//   npm run bake:demos -- --only chrono-bell
//   npm run qa:runtime -- --scenario fallen-forest --checkpoint-set fallen-star --checkpoint 'forest-*' \
//     --project dist/demos/chrono-bell.play.json --parallel 2
// 추격(보이면 「!」 → 달려듦 → 닿으면 전투) 1배 영상: QA_RECORD_VIDEO=tmp/fs-chase … --checkpoint forest-chase
const H = (dir, ms) => ({ kind: "hold", dir, ms });
/** 출구 칸 한 칸 안쪽(x,y)에 서서 dir 쪽으로 걸어 to 맵에 닿는다. */
const cross = (id, from, x, y, dir, to) => ({
  id,
  note: `${from} (${x},${y}) ${dir} → ${to}`,
  ops: [
    { kind: "teleport", mapId: from, x, y },
    H(null, 500),
    H(dir, 600),
    { kind: "waitForMap", mapId: to, timeoutMs: 6000 },
    H(null, 1200),
  ],
  shot: true,
});
const arrive = { id: "arrive", note: "도착 칸", ops: [H(null, 1500)], shot: true };

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const fallenForestScenario = {
  id: "fallen-forest",
  checkpointSet: "fallen-star",
  projectFixture: process.env.RES_FIXTURE,
  viewport: { width: 480, height: 270 },
  beats: [{ id: "none", note: "--checkpoint-set fallen-star --checkpoint 'forest-*'", ops: [], shot: false }],
  checkpointBeats: {
    "forest-edge-entry": [
      arrive,
      cross("to-thicket", "fs_forest_edge", 7, 1, "up", "fs_forest_thicket"),
      cross("to-stream", "fs_forest_edge", 24, 1, "up", "fs_forest_stream"),
      cross("to-hub", "fs_forest_edge", 15, 38, "down", "fs_hub"),
    ],
    "forest-stream-entry": [
      arrive,
      cross("to-shrine", "fs_forest_stream", 28, 1, "up", "fs_forest_shrine"),
      cross("to-glade", "fs_forest_stream", 38, 18, "right", "fs_forest_glade"),
      cross("to-edge", "fs_forest_stream", 7, 30, "down", "fs_forest_edge"),
    ],
    "forest-thicket-entry": [
      arrive,
      cross("to-shrine", "fs_forest_thicket", 12, 1, "up", "fs_forest_shrine"),
      cross("to-edge", "fs_forest_thicket", 17, 38, "down", "fs_forest_edge"),
    ],
    "forest-shrine-entry": [
      arrive,
      cross("to-deep", "fs_forest_shrine", 20, 1, "up", "fs_forest"),
      cross("to-thicket", "fs_forest_shrine", 7, 28, "down", "fs_forest_thicket"),
      cross("to-stream", "fs_forest_shrine", 30, 28, "down", "fs_forest_stream"),
    ],
    "forest-glade-entry": [
      arrive,
      cross("to-stream", "fs_forest_glade", 1, 13, "left", "fs_forest_stream"),
    ],
    "forest-entry": [
      arrive,
      cross("to-shrine", "fs_forest", 14, 34, "down", "fs_forest_shrine"),
    ],
    // 추격 — 순찰하는 거미 앞쪽 시야에 서서 기다린다: 「!」 → 순찰보다 빠르게 다가와 닿으면 전투 화면.
    "forest-chase": [
      { id: "wait-seen", note: "제자리에서 기다린다 — 순찰이 이쪽을 보면 「!」", ops: [H(null, 3200)], shot: true },
      { id: "rush", note: "달려든다", ops: [H(null, 1600)], shot: true },
      { id: "battle", note: "닿으면 전투", ops: [{ kind: "waitFor", testid: "battle-scene", state: "present", timeoutMs: 14000 }, H(null, 1500)], shot: true },
    ],
  },
};

export default fallenForestScenario;
