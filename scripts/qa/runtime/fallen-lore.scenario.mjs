// 하넬 자리·대사(상태별)와 읽을거리 — 체크포인트에서 바로 시작.
// 실행: QA_RECORD_VIDEO=tmp/fs-lore RES_FIXTURE=tmp/fs-after2.json \
//   npm run qa:runtime -- --scenario fallen-lore --checkpoint-set fallen-star --checkpoint 'hanel-*,lore-*' --parallel 1
const H = (dir, ms) => ({ kind: "hold", dir, ms });
const talk = (n) => [
  { id: "arrive", note: "도착 — 자리 확인", ops: [H(null, 900)], shot: true },
  { id: "line1", note: "조사 — 첫 칸", ops: [{ kind: "action" }, H(null, 900)], shot: true },
  ...Array.from({ length: n }, (_, i) => ({ id: `line${i + 2}`, note: `${i + 2}번째 칸`, ops: [{ kind: "key", key: "Enter" }, H(null, 900)], shot: true })),
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const fallenLoreScenario = {
  id: "fallen-lore",
  checkpointSet: "fallen-star",
  projectFixture: process.env.RES_FIXTURE,
  viewport: { width: 480, height: 270 },
  beats: [{ id: "none", note: "--checkpoint-set fallen-star --checkpoint hanel-h1", ops: [], shot: false }],
  checkpointBeats: {
    "hanel-h1": talk(3),
    "hanel-h4": talk(1),
    "hanel-h6": talk(2),
    "hanel-h10": talk(2),
    "lore-irene": talk(1),
    "lore-journal": talk(2),
    "lore-form": talk(1),
  },
};

export default fallenLoreScenario;
