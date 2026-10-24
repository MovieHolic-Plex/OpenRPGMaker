// 필드 적 모습 비교(프로토타입) — 숲 어귀 추격 체크포인트에 거미·도깨비불·멧돼지를 곁에 세워 찍는다.
// 개발 서버의 ?demo=fallen-star 는 데모를 브라우저에서 새로 짓는다(--project 무시) → 변형은 ?fieldFoeLook= 로 고른다(fieldFoeLookProto.ts).
//   FIELD_FOE_LOOK=a QA_RECORD_VIDEO=/tmp/ff/video/a npm run qa:runtime -- --scenario field-foes --checkpoint-set fallen-star \
//     --checkpoint forest-chase --project dist/demos/chrono-bell.play.json --netns
//   전부: bash scripts/content/field-foes/run_compare.sh /tmp/ff base a b c d
const H = (dir, ms) => ({ kind: "hold", dir, ms });

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const fieldFoesScenario = {
  id: "field-foes",
  checkpointSet: "fallen-star",
  projectFixture: process.env.RES_FIXTURE,
  viewport: { width: 480, height: 270 },
  query: { demo: "fallen-star", e2eVitals: "1", fieldFoeLook: process.env.FIELD_FOE_LOOK ?? "base" },
  beats: [{ id: "none", note: "--checkpoint-set fallen-star --checkpoint forest-chase", ops: [], shot: false }],
  checkpointBeats: {
    "forest-chase": [
      { id: "stage", note: "도착 직후 — 늑대는 순찰 중, 거미·도깨비불·멧돼지는 제자리", ops: [H(null, 250)], shot: true },
      { id: "stage-b", note: "제자리 걸음 다른 칸", ops: [H(null, 180)], shot: true },
      { id: "seen", note: "「!」", ops: [H(null, 2600)], shot: true },
      { id: "rush", note: "달려든다", ops: [H(null, 1400)], shot: true },
      { id: "battle", note: "닿으면 전투", ops: [{ kind: "waitFor", testid: "battle-scene", state: "present", timeoutMs: 14000 }, H(null, 1800)], shot: true },
    ],
  },
};

export default fieldFoesScenario;
