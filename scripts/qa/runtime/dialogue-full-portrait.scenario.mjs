// 전신 초상(full) 대사창 — 화면 높이 125% 입상 + 글 여백. 픽스처는 --project 로 준다
// (전신 그림 업로드가 들어 있는 town-npc 가 changeFace(-full) → text).
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const dialogueFullPortraitScenario = {
  id: "dialogue-full-portrait",
  projectFixture: "test/fixtures/projects/oprn-sample-v3.json",
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 마을 시작, 우측에 town-npc",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, { kind: "seed", seed: 1 }],
      expect: { mapId: "map_town", testidAbsent: ["title-screen", "dialogue-box"] },
    },
    {
      id: "full-portrait",
      note: "말걸기 → 전신 초상이 화면 높이 기준으로 서 있어야 한다",
      ops: [
        { kind: "face", dir: "right" },
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present" },
        // 등장 연출이 끝나고 글이 다 찍힌 상태에서 본다(첫 결정 키 = 타이핑 건너뛰기).
        { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 },
        { kind: "key", key: "Enter" },
        { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 },
      ],
      expect: { testidPresent: ["dialogue-box", "dialogue-face"] },
      shot: true,
    },
    {
      id: "last-page",
      note: "다음 장 → 마지막 장(끝 표시)",
      ops: [
        // 1장을 넘기고(첫 Enter = 타이핑 건너뛰기가 끝난 상태에서의 두 번째 Enter) 2장의 타이핑을 건너뛴다.
        { kind: "key", key: "Enter" },
        { kind: "waitForVisible", testid: "dialogue-box", minAlpha: 0.95 },
        { kind: "key", key: "Enter" },
      ],
      expect: { testidPresent: ["dialogue-box"] },
      shot: true,
    },
  ],
};

export default dialogueFullPortraitScenario;
