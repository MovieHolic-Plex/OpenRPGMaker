// 카운터 너머 말 걸기 · NPC 걸음 — 체크포인트(counter-walk)에서 바로 시작하는 출하 플레이어 QA.
//
// 픽스처: python3 scripts/qa/runtime/counter-walk-fixture.py <여관 project.sqlite> tmp/cw-fix/inn-counter-walk.json
//   (대조군: … tmp/cw-fix/inn-counter-walk-off.json --counter-off — 카운터 속성을 끈 고치기 전 동작)
// 실행(영상·걸음 표본):
//   QA_RECORD_VIDEO=tmp/cw-video NPC_WALK_OUT=tmp/cw-porter.json \
//     npm run qa:runtime -- --scenario counter-walk --checkpoint-set counter-walk --checkpoint all --parallel 1 --netns
// 판정점: counter-shop 의 talk-across(대사창이 뜬다) · porter-walk 영상(걸음 사이 멈춤 없음, 발이 칸마다 번갈아).

import { START_SAMPLER, DUMP_SAMPLES } from "./npc-walk-measure.scenario.mjs";

const OUT = process.env.NPC_WALK_OUT ?? "tmp/npc-walk-samples.json";

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const counterWalkScenario = {
  id: "counter-walk",
  checkpointSet: "counter-walk",
  beats: [{ id: "none", note: "체크포인트 없이 실행됨 — --checkpoint-set counter-walk 를 줘라", ops: [], shot: false }],
  checkpointBeats: {
    "counter-shop": [
      { id: "start", note: "카운터 앞 두 칸 아래. 주인은 카운터 뒤", ops: [{ kind: "hold", dir: null, ms: 900 }], expect: { x: 2, y: 6 }, shot: true },
      {
        id: "step-to-counter",
        note: "위로 걸어 카운터 앞에 선다(정면은 카운터 발밑, 더는 못 간다)",
        ops: [{ kind: "hold", dir: "up", ms: 700 }, { kind: "hold", dir: null, ms: 600 }],
        expect: { x: 2, y: 5 },
        shot: true,
      },
      {
        id: "talk-across",
        note: "조사 → 카운터 너머 주인의 대사창(판정점)",
        ops: [
          { kind: "action" },
          { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 4_000 },
          { kind: "hold", dir: null, ms: 2200 },
        ],
        expect: { testidPresent: ["dialogue-box"] },
        shot: true,
      },
      {
        id: "close",
        note: "대사를 닫는다",
        ops: [{ kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 6 }, { kind: "hold", dir: null, ms: 900 }],
        shot: true,
      },
    ],
    "porter-walk": [
      {
        id: "line",
        note: "짐꾼 자동 실행 대사",
        ops: [
          { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 20_000 },
          { kind: "hold", dir: null, ms: 1200 },
          { kind: "evalToFile", fn: START_SAMPLER, out: "/tmp/cw-sampler-started.json" },
        ],
        shot: true,
      },
      {
        id: "walk-out",
        note: "대사를 넘기면 짐꾼이 7칸 걸어 문 앞으로(영상 판정점)",
        ops: [{ kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", maxPresses: 6 }, { kind: "hold", dir: null, ms: 5200 }],
        shot: true,
      },
      {
        id: "player-walk",
        note: "비교용: 주인공이 위로 2칸",
        ops: [{ kind: "hold", dir: "up", ms: 300 }, { kind: "hold", dir: null, ms: 900 }, { kind: "evalToFile", fn: DUMP_SAMPLES, out: OUT }],
        shot: true,
      },
    ],
  },
};

export default counterWalkScenario;
