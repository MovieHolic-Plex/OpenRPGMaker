// 필드 적 모습 비교(프로토타입) — 숲 어귀 추격 체크포인트에 거미·도깨비불·멧돼지를 곁에 세운 픽스처로 찍는다.
//   python3 scripts/content/field-foes/make_fixtures.py dist/demos/chrono-bell.play.json /tmp/ff/fx
// ?demo=fallen-star 는 --project 를 무시하고 dist/demos/chrono-bell.play.json 을 읽는다 → 변형마다 그 파일을 바꿔 끼우고 차례로 돈다(run_compare.sh).
//   QA_RECORD_VIDEO=tmp/ff-video/a npm run qa:runtime -- --scenario field-foes --checkpoint-set fallen-star \
//     --checkpoint forest-chase --project /tmp/ff/fx/a.play.json --netns
const H = (dir, ms) => ({ kind: "hold", dir, ms });

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const fieldFoesScenario = {
  id: "field-foes",
  checkpointSet: "fallen-star",
  projectFixture: process.env.RES_FIXTURE,
  viewport: { width: 480, height: 270 },
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
