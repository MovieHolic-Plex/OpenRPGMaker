// 『첫사랑』 거리 행인·차·옥상 배경 1배 영상 — 체크포인트 d1-street(아침 거리)에서 시작해 대사를 넘기고 한참 서서 본다.
// 실행: QA_RECORD_VIDEO=<dir> FL_VP=480x270 node scripts/qa/runtime/fl-play.mjs --scenario first-love-street --checkpoint d1-street --parallel 1 --netns --out <dir>
// FL_STREET_HOLD(ms, 기본 22000) 동안 행인이 출구로 드나들고 정류장에서 기다리고 차가 횡단보도 앞에서 서는지 본다.
// --checkpoint d1-roof-choice 면 옥상 장면 첫 화면에서 FL_ROOF_HOLD(기본 9000) 동안 내려다본 거리 배경을 찍는다. d1-street-pm(밤)도 같다.
import base from "./first-love.scenario.mjs";

const hold = Number(process.env.FL_STREET_HOLD ?? 22000);
const roofHold = Number(process.env.FL_ROOF_HOLD ?? 9000);
const noBox = "() => !document.querySelector(\"[data-testid='dialogue-box']\")";
const beats = [
  { id: "boot", note: "체크포인트 부팅", ops: [{ kind: "waitForRuntime", timeoutMs: 120000 }, { kind: "evalToFile", out: `${process.env.QA_RECORD_VIDEO ?? "/tmp/fl"}/street-start.json`, fn: "() => ({ startedAt: Date.now() })" }], shot: false },
  { id: "lines", note: "도착 독백 넘기기", ops: [{ kind: "hold", dir: null, ms: 1500 }, { kind: "pressUntilJs", key: "Enter", fn: noBox, maxPresses: 8 }], shot: true },
  { id: "watch", note: "거리 — 행인·차", ops: [{ kind: "hold", dir: null, ms: hold }], shot: true },
  { id: "walk", note: "서하가 큰길 쪽으로 몇 걸음", ops: [{ kind: "hold", dir: "right", ms: 2600 }, { kind: "hold", dir: null, ms: 4000 }], shot: true },
];
// 옥상(d1-roof-choice): 장면 시작 화면을 그대로 두고 본다 — 난간 너머 줄여 그린 거리 띠(배경 fromMap).
const roofBeats = [beats[0], { id: "roof", note: "옥상 — 내려다본 거리", ops: [{ kind: "hold", dir: null, ms: roofHold }], shot: true }];

export default {
  ...base,
  id: `${base.id}-street`,
  checkpointSet: "first-love",
  checkpointBeats: (checkpoint) => (checkpoint.id === "d1-roof-choice" ? roofBeats : ["d1-street", "d1-street-pm"].includes(checkpoint.id) ? beats : undefined),
  beats,
};
