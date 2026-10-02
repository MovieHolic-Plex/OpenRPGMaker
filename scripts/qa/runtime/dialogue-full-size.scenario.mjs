// 전신 초상 크기: 프로젝트 기본(system.dialogueFullPortrait) × 장면 배율(changeFace.fullScale).
// 픽스처는 --project 로 준다: system.dialogueFullPortrait {height:100, drop:10},
// town-npc 가 changeFace(full-base) → text → changeFace(full-base, fullScale 70) → text
// → changeFace(full-base, fullScale 150) → text.
/** 한 줄 넘기기: 첫 Enter = 다음 줄, 둘째 Enter = 타이핑 건너뛰기. */
const line = (id, note) => ({
  id,
  note,
  ops: [
    { kind: "key", key: "Enter" },
    { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 },
    { kind: "key", key: "Enter" },
    { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 },
  ],
  expect: { testidPresent: ["dialogue-box", "dialogue-face"] },
  shot: true,
});

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const dialogueFullSizeScenario = {
  id: "dialogue-full-size",
  projectFixture: "test/fixtures/projects/oprn-sample-v3.json",
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 마을 시작, 우측에 town-npc",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, { kind: "seed", seed: 1 }],
      expect: { mapId: "map_town", testidAbsent: ["title-screen", "dialogue-box"] },
    },
    {
      id: "project-default",
      note: "말걸기 → 프로젝트 기본 크기(화면 높이 100%·내림 10%)",
      ops: [
        { kind: "face", dir: "right" },
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present" },
        { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 },
        { kind: "key", key: "Enter" },
        { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 },
      ],
      expect: { testidPresent: ["dialogue-box", "dialogue-face"] },
      shot: true,
    },
    line("scene-70", "장면 배율 70% — 작아진다"),
    line("scene-150", "장면 배율 150% — 커진다"),
  ],
};

export default dialogueFullSizeScenario;
