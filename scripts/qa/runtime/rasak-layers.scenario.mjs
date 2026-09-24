// Rasak Fantasy(MZ 48px) 학습 프로젝트의 게임 화면 — 합성(fold) 판과 4층(layers) 판을 같은 좌표에서 찍어 비교한다.
//
// 라이선스: Rasak 그림은 재배포 금지다. 이 파일에는 맵 id 와 좌표만 있다. 프로젝트 JSON 과 결과 PNG 는
// 반드시 저장소 밖에 둔다 — 실행할 때 --project /tmp/... 와 --out /tmp/... 를 함께 준다.
//   node scripts/runtime-qa.mjs --scenario rasak-layers --project /tmp/rasak/runtime/layers.inline.json --out /tmp/rasak/runtime/shots-layers
//   node scripts/runtime-qa.mjs --scenario rasak-layers --project /tmp/rasak/runtime/fold.inline.json --out /tmp/rasak/runtime/shots-fold
// 프로젝트 JSON 은 로컬 SQLite 학습 프로젝트(~/third-party-assets/rasak/study-project{,-layers})를
// 읽어 업로드 자산을 dataUrl 로 넣은 것이다. 두 판의 맵 크기·시작 좌표는 같다.
//
// 프레임은 QA 프레임 제어로 멈춘 채 같은 수만큼만 민다 — 물·용암 애니메이션 위상이 두 판에서 같아야
// 픽셀 비교가 층 차이만 보여 준다(실시간으로 찍으면 p27b 용암만으로 7만 픽셀이 달랐다).

const maps = [
  { id: "rasak_preview_p28", x: 17, y: 9 },
  { id: "rasak_preview_p02", x: 8, y: 6 },
  { id: "rasak_preview_p27a", x: 8, y: 9 },
  // p27b 는 (8,9) 로 보내면 런타임이 (5,6) 에 내려놓는다(두 판 같음) — 도착 칸을 그대로 쓴다.
  { id: "rasak_preview_p27b", x: 5, y: 6 },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const rasakLayersScenario = {
  id: "rasak-layers",
  projectFixture: "/tmp/rasak/runtime/layers.inline.json",
  beats: [
    {
      id: "p01",
      note: "새 게임 → 시작 맵 p01 가운데",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
        { kind: "waitForPosition", mapId: "rasak_preview_p01", x: 9, y: 10 },
        { kind: "pauseFrames" },
        { kind: "stepFrames", frames: 60, deltaMs: 16 },
      ],
      expect: { mapId: "rasak_preview_p01", x: 9, y: 10, testidAbsent: ["title-screen", "dialogue-box"] },
      shot: true,
    },
    ...maps.map((map) => ({
      id: map.id.replace("rasak_preview_", ""),
      note: `맵 전환 — ${map.id}`,
      ops: [
        { kind: "teleport", mapId: map.id, x: map.x, y: map.y },
        { kind: "stepFrames", frames: 30, deltaMs: 16 },
        { kind: "waitForPosition", mapId: map.id, x: map.x, y: map.y },
        { kind: "stepFrames", frames: 90, deltaMs: 16 },
      ],
      expect: { mapId: map.id, x: map.x, y: map.y },
      shot: true,
    })),
  ],
};

export default rasakLayersScenario;
