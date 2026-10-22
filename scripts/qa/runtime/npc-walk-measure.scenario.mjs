// NPC 걸음 실측 — 출하 플레이어에서 NPC·주인공 스프라이트를 매 rAF 마다 적어 칸당 시간·걸음 사이 멈춤·발 프레임 주기를 잰다.
//
// 왜(2026-10-22 사용자 「NPC 걷는 속도가 이상함」, 첫사랑 팀장 「너무 느림」): 속도 표·빈도 간격·발 프레임 주기를
// 숫자로 보지 않으면 영상만으로는 무엇이 이상한지 가를 수 없다.
//
// 첫사랑 체크포인트 d1-meet-choice: 캡션을 넘기면 팀장이 엘리베이터 앞으로 두 칸 걸어와 인사한다.
//   QA_RECORD_VIDEO=tmp/cw-video NPC_WALK_OUT=tmp/cw-lead.json \
//     npm run qa:runtime -- --scenario npc-walk-measure --checkpoint-set first-love --checkpoint d1-meet-choice --netns --parallel 1
// 여관 짐꾼(7칸)은 counter-walk.scenario.mjs 의 porter-walk 체크포인트가 같은 표본기를 쓴다.
//
// 표본: { t, player:{x,y,frame}, events:{id:{x,y,frame}} } — 화면 px(카메라 좌표 아님, 스프라이트 월드 좌표).

const OUT = process.env.NPC_WALK_OUT ?? "tmp/npc-walk-samples.json";

export const START_SAMPLER = `() => {
  const samples = [];
  window.__cwSamples = samples;
  const t0 = performance.now();
  const tick = () => {
    const s = window.__oprnCharacterSprites?.();
    if (s) {
      const events = {};
      for (const [id, e] of Object.entries(s.events ?? {})) events[id] = { x: e.x, y: e.y, frame: e.frame };
      samples.push({ t: Math.round(performance.now() - t0), player: { x: s.player?.x, y: s.player?.y }, events });
    }
    if (samples.length < 4000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return { started: true };
}`;

export const DUMP_SAMPLES = `() => window.__cwSamples ?? []`;

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const npcWalkMeasureScenario = {
  id: "npc-walk-measure",
  viewport: { width: 960, height: 640 },
  checkpointSet: "first-love",
  beats: [{ id: "none", note: "체크포인트 없이 실행됨 — --checkpoint-set first-love --checkpoint d1-meet-choice", ops: [], shot: false }],
  checkpointBeats: {
    "d1-meet-choice": [
      {
        id: "meet",
        note: "팀장이 엘리베이터 앞으로 걸어와 인사(대사를 넘기며 걸음을 본다)",
        ops: [
          { kind: "waitFor", testid: "dialogue-box", state: "present", timeoutMs: 60_000 },
          { kind: "hold", dir: null, ms: 900 },
          { kind: "evalToFile", fn: START_SAMPLER, out: "/tmp/cw-sampler-started.json" },
          // 「스튜디오 늘봄, 7층.」 캡션을 넘기면 팀장이 두 칸 걸어온다.
          { kind: "key", key: "Enter" },
          { kind: "hold", dir: null, ms: 4500 },
          { kind: "evalToFile", fn: DUMP_SAMPLES, out: OUT },
        ],
        shot: true,
      },
    ],
  },
};

export default npcWalkMeasureScenario;
