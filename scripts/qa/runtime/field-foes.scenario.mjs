// 보이는 필드 적 — 전투 도트에서 뽑은 필드 칩(src/player/fieldFoeSprite.ts)을 숲 맵마다 한 장씩 본다.
//   QA_RECORD_VIDEO=/tmp/ff/video npm run qa:runtime -- --scenario field-foes --checkpoint-set fallen-star \
//     --checkpoint forest-chase --project dist/demos/chrono-bell.play.json --netns
// 추격 1배 영상은 fallen-forest 시나리오의 forest-chase 체크포인트.
const H = (dir, ms) => ({ kind: "hold", dir, ms });
const look = (id, mapId, x, y, note) => ({
  id, note,
  ops: [{ kind: "teleport", mapId, x, y }, { kind: "waitForMap", mapId, timeoutMs: 6000 }, H(null, 350)],
  shot: true,
});

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const fieldFoesScenario = {
  id: "field-foes",
  checkpointSet: "fallen-star",
  viewport: { width: 480, height: 270 },
  beats: [{ id: "none", note: "--checkpoint-set fallen-star --checkpoint forest-chase", ops: [], shot: false }],
  checkpointBeats: {
    "forest-chase": [
      { id: "edge-wolf", note: "숲 어귀 — 늑대(전투 도트에서 뽑은 필드 칩)", ops: [H(null, 300)], shot: true },
      look("glade-wolf-wisp", "fs_forest_glade", 20, 19, "사냥꾼 쉼터 — 늑대·도깨비불"),
      look("thicket-spider", "fs_forest_thicket", 14, 26, "가시덤불 — 거미"),
      look("deep-wisp", "fs_forest", 11, 24, "깊은 숲 — 도깨비불"),
    ],
  },
};

export default fieldFoesScenario;
