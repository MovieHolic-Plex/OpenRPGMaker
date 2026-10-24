// 아스트라 연구소: 천문박사에게 말을 걸어 대사 상자(흉상 칸)를 출하 플레이어에서 찍는다.
// 실행: npm run qa:runtime -- --scenario astra-professor --checkpoint starter-pick
// 체크포인트 starter-pick = mx_map_lab (7,6), 박사는 (7,5).
const lines = Array.from({ length: 5 }, (_, i) => ({
  id: `line-${i + 1}`,
  ops: [{ kind: "key", key: "Enter", times: 2 }, { kind: "waitForVisible", testid: "dialogue-box", timeoutMs: 4000 }],
  shot: true,
}));

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "astra-professor",
  checkpointSet: "astra-horizon",
  viewport: process.env.ASTRA_VP ? { width: Number(process.env.ASTRA_VP.split("x")[0]), height: Number(process.env.ASTRA_VP.split("x")[1]) } : { width: 480, height: 320 },
  beats: [],
  checkpointBeats: {
    "starter-pick": [
      { id: "arrive", ops: [{ kind: "waitForRuntime" }], shot: true },
      { id: "talk", ops: [{ kind: "face", dir: "up" }, { kind: "action" }, { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "present", maxPresses: 3, timeoutMs: 1500 }, { kind: "waitForVisible", testid: "dialogue-box" }], shot: true },
      ...lines,
    ],
  },
};
