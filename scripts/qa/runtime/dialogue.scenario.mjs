// 대사·선택지 상호작용 시나리오.
//
// 픽스처를 smoke 와 다르게 쓴다(test/fixtures/projects/oprn-sample-v3.json). 이유:
//   - 이 픽스처의 NPC 는 `movement: {type:"fixed"}` 라 배회하지 않는다.
//   - 플레이어 스폰 (0,1) 과 town-npc (1,1) 이 **스폰 시점에 이미 인접**하다 →
//     위치 지정용 텔레포트가 필요 없다. 같은 맵 안 텔레포트는 스프라이트를 옮기지
//     않으므로(실측) 애초에 쓸 수 없다.
//   - town-npc 의 1페이지는 `choices` 커맨드("스위치 퍼즐을 열까요?" 예/아니오)라
//     선택지 창까지 한 번에 검증된다.
//
// 이 픽스처는 플레이어 캐릭셋이 __MISSING 으로 그려진다(실측: 4개 픽스처 중 이것만).
// 그래서 playerSpriteTextureLoaded 를 걸지 않는다 — 스프라이트 렌더는 smoke 가 담당한다.

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const dialogueScenario = {
  id: "dialogue",
  projectFixture: "test/fixtures/projects/oprn-sample-v3.json",
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 마을 시작 지점(0,1), 우측 (1,1) 에 town-npc",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "wait", ms: 2500 },
        { kind: "seed", seed: 1 },
      ],
      expect: {
        mapId: "map_town",
        x: 0,
        y: 1,
        testidAbsent: ["title-screen", "dialogue-box"],
      },
    },
    {
      id: "open-choices",
      note: "town-npc 말걸기 → 선택지 창이 떠야 한다",
      ops: [
        { kind: "face", dir: "right" },
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present" },
      ],
      expect: { testidPresent: ["dialogue-box", "runtime-choices"] },
      shot: true,
    },
    {
      id: "dismiss-dialogue",
      note: "결정 키로 선택지·후속 대사 소진 → 대사창이 닫혀야 한다",
      // 고정 횟수로 누르면 대사가 닫힌 뒤 남은 Enter 가 NPC 를 재발동시켜
      // 선택지가 다시 열린다(실측). pressUntil 은 매 입력 후 조건을 확인한다.
      ops: [{ kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent" }],
      expect: { testidAbsent: ["dialogue-box", "runtime-choices"] },
    },
  ],
};

export default dialogueScenario;
