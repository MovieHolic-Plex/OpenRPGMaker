// 외형의 전신 칸(changeFace appearanceId + presentation full) + 직접 고른 비대사 표정(윙크 흉상).
// 픽스처는 --project 로 준다: town-npc 가 changeFace(외형 girl, full) → text(표정 없음·sad)
// → changeFace(shared-…-bust-wink) → text(표정 없음·happy).
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
export const dialogueAppearanceFullScenario = {
  id: "dialogue-appearance-full",
  projectFixture: "test/fixtures/projects/oprn-sample-v3.json",
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 마을 시작, 우측에 town-npc",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, { kind: "seed", seed: 1 }],
      expect: { mapId: "map_town", testidAbsent: ["title-screen", "dialogue-box"] },
    },
    {
      id: "appearance-full",
      note: "말걸기 → 외형 전신 칸(대사창 뒤 입상)",
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
    line("appearance-full-sad", "emotion sad → 슬픔 전신"),
    line("bust-wink", "직접 고른 윙크 흉상(대사 표정 아님)"),
    line("bust-happy", "emotion happy → 기쁨 흉상"),
  ],
};

export default dialogueAppearanceFullScenario;
