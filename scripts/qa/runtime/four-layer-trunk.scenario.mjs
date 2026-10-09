// 나무 밑동 통행 회귀 (2026-09-28) — AI 조수가 만든 숲마을에서 주인공이 밑동 칸을 걸어 지나가는지 본다.
// 원인: 2층 나무 그림자가 ○ 라서 1층 밑동의 × 를 덮었다(forestHarmonyTreeShadows.repairForestTreeShadowPassage).
// 정상이면 conifer-up 은 (21,10), edge-up 은 (10,6) 에서 멈춘다. 버그면 (21,7)·(10,4) 까지 들어간다.
//
// 픽스처는 29MB 라 커밋하지 않는다. 같은 조수 요청으로 다시 만든다(맵 map_forest 40×28, 시작 맵과 다르므로 teleport):
//   bun scripts/pi-agent.mts --blank map_forest:40x28 --maps map_forest --current map_forest \
//     --task "이 맵에 작은 숲속 마을을 만들어줘. 가운데에 오두막 두 채와 흙길을 두고, 둘레는 울창한 숲으로 감싸줘. 숲 속에는 걸어 들어갈 수 있는 작은 오솔길도 하나 있으면 좋겠어." \
//     --out /tmp/four-layer-ai.json
//   node scripts/runtime-qa.mjs --scenario four-layer-trunk --project /tmp/four-layer-ai.json
// 모델 결과는 매번 달라 좌표가 어긋날 수 있다 — 먼저 맵 그림에서 밑동 줄 위치를 확인하고 좌표를 맞춘다.
// 기록된 실행의 샷: verify-shots/four-layer-ai/runtime(고치기 전)·runtime-after(고친 뒤).
const at = (x, y) => [{ kind: "teleport", mapId: "map_forest", x, y }, { kind: "waitForPosition", mapId: "map_forest", x, y }];
export default {
  id: "four-layer-trunk",
  beats: [
    { id: "title", expect: { testidPresent: ["title-screen"] }, shot: false },
    { id: "boot", ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, ...at(21, 12)], expect: { mapId: "map_forest", x: 21, y: 12 }, shot: false },
    { id: "control-grass", note: "대조: 열린 잔디 (21,12)→위로 한 칸", ops: [{ kind: "hold", dir: "up", ms: 400 }], expect: { mapId: "map_forest" }, shot: true },
    { id: "conifer-before", note: "침엽수 밑동(21,9) 아래 (21,10)", ops: [...at(21, 10), { kind: "face", dir: "up" }], expect: { mapId: "map_forest", x: 21, y: 10 }, shot: true },
    { id: "conifer-up", note: "위로 — 밑동 칸에 들어가면 버그", ops: [{ kind: "hold", dir: "up", ms: 400 }], expect: { mapId: "map_forest" }, shot: true },
    { id: "edge-before", note: "숲 가장자리 밑동 줄 아래 (10,7)", ops: [...at(10, 7), { kind: "face", dir: "up" }], expect: { mapId: "map_forest", x: 10, y: 7 }, shot: true },
    { id: "edge-up", note: "위로 길게 — (10,5)(10,4) 밑동 줄에 들어가면 버그", ops: [{ kind: "hold", dir: "up", ms: 1600 }], expect: { mapId: "map_forest" }, shot: true },
  ],
};

