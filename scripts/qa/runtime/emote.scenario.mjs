// 정수리 이모트 시나리오.
//
// 픽스처(test/fixtures/projects/oprn-emote-qa.json)는 dialogue 픽스처를 이모트용으로 고친 것이다:
//   - 12종 전시용 auto 이벤트가 맵 위·아래 줄에 서서 각자 자기 이모트를 한 번 띄운다
//     (auto + setSelfSwitch A 로 일회성 — 반복 실행이면 팝 애니메이션이 매 프레임 다시 시작한다).
//   - town-npc(1,1) 는 말을 걸면 하트를 띄우고 곧바로 대사를 낸다(대기 없는 명령임을 증명).
//   - switch-puzzle(2,1) 은 플레이어 정수리에 물음표를 띄운다(target: "player").
//
// 이모트는 Phaser 스프라이트라 DOM testid 로 볼 수 없다 — emoteCountAtLeast / emoteFrames / emoteTargets 는
// __oprnEmotes 훅 관측치로 판정한다(프레임 인덱스 = EMOTE_KINDS 순서).

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const emoteScenario = {
  id: "emote",
  projectFixture: "test/fixtures/projects/oprn-emote-qa.json",
  beats: [
    {
      id: "gallery",
      note: "새 게임 → auto 이벤트 12개가 각자 다른 이모트를 정수리에 띄운다",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "wait", ms: 3000 },
        { kind: "seed", seed: 1 },
      ],
      expect: {
        mapId: "map_town",
        emoteCountAtLeast: 12,
        emoteFrames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        testidAbsent: ["title-screen", "dialogue-box"],
      },
      shot: true,
    },
    {
      id: "npc-heart-with-dialogue",
      note: "town-npc 에게 말걸기 → 하트가 뜨고 대사창도 함께 열린다(이모트가 진행을 막지 않는다)",
      ops: [
        { kind: "wait", ms: 4000 },
        { kind: "face", dir: "right" },
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present" },
      ],
      expect: {
        testidPresent: ["dialogue-box"],
        emoteTargets: [{ target: "town-npc", frame: 0 }],
      },
      shot: true,
    },
    {
      id: "player-question",
      note: "대사 닫고 switch-puzzle 로 이동 → 플레이어 정수리에 물음표",
      ops: [
        { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent" },
        { kind: "teleport", mapId: "map_town", x: 1, y: 1 },
        { kind: "face", dir: "right" },
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present" },
      ],
      expect: {
        testidPresent: ["dialogue-box"],
        emoteTargets: [{ target: "player", frame: 4 }],
      },
      shot: true,
    },
  ],
};

export default emoteScenario;
