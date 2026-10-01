// 공용 표정 세트 흉상·전신 + 대사 표정 전환. 픽스처는 --project 로 준다:
// town-npc 가 changeFace(shared-…-bust-base) → text(표정 없음·happy·sad) → changeFace(…-full-base) → text(angry·surprised).
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
export const dialogueSharedPortraitsScenario = {
  id: "dialogue-shared-portraits",
  projectFixture: "test/fixtures/projects/oprn-sample-v3.json",
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 마을 시작, 우측에 town-npc",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, { kind: "seed", seed: 1 }],
      expect: { mapId: "map_town", testidAbsent: ["title-screen", "dialogue-box"] },
    },
    {
      id: "bust-base",
      note: "말걸기 → 기본 흉상(표정 없는 줄)",
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
    line("bust-happy", "emotion happy → 같은 인물의 기쁨 흉상"),
    line("bust-sad", "emotion sad → 슬픔 흉상"),
    line("full-angry", "changeFace 전신 → emotion angry 전신(대사창 뒤 입상)"),
    line("full-surprised", "emotion surprised → 놀람 전신"),
  ],
};

export default dialogueSharedPortraitsScenario;
