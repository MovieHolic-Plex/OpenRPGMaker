// 시선 조건 상자 시연 — 경비가 보는 앞·벽 뒤·어둠·사거리 밖에서 상자를 연다.
//   NPC_SIGHT_FIXTURE=/tmp/npc-sight.json NPC_SIGHT_OUT=/tmp/npc-sight \
//   npm run qa:runtime -- --scenario npc-sight --checkpoint-set npc-sight --checkpoint all --netns
// 픽스처: scripts/qa/runtime/npc-sight-fixture.mts. 단계마다 대사·은화·조명을 <OUT>-<체크포인트>.json 으로 떨군다.
const OUT = process.env.NPC_SIGHT_OUT ?? "/tmp/npc-sight";

const beats = (checkpoint) => [
  {
    id: "open-chest",
    note: "바로 아래 상자를 연다",
    ops: [
      { kind: "face", dir: "down" },
      { kind: "action" },
      { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 15_000 },
      { kind: "hold", dir: null, ms: 900 },
      {
        kind: "evalToFile",
        out: `${OUT}-${checkpoint.id}.json`,
        fn: `() => { const s = window.__oprnDebug.readState(); return { text: document.querySelector('[data-testid="dialogue-box"]')?.textContent?.replace(/\\s+/g, " ").trim() ?? null, gold: s.gold, x: s.x, y: s.y, ambient: s.lighting?.ambient ?? null }; }`,
      },
    ],
    shot: true,
  },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "npc-sight",
  projectFixture: process.env.NPC_SIGHT_FIXTURE ?? "/tmp/npc-sight.json",
  checkpointSet: "npc-sight",
  beats: [{ id: "title", ops: [], shot: true }],
  checkpointBeats: beats,
};
