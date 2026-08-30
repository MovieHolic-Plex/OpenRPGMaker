// 같은 시드와 같은 입력을 두 장비 픽스처에 반복해 normal attack의 장비 축을 실전에서 비교한다.
// 생성기(scripts/build-item-equipment-qa-fixtures.mjs)는 두 JSON이 hero weapon 외에는 같음을 검사한다.
// seed 101 실측(현재 main): 레이피어는 195(급소)/162, 채찍은 34/49. 급소는 치명타율 9인 레이피어에서만 뜬다.
// 같은 픽스처를 반복 실행하면 같은 값이 나온다(레이피어 3회, 채찍 2회 관측 — 전부 동일).
// PR #268 보고서의 레이피어 1턴 스크린샷은 218 인데, 그 시점 트리의 값이라 현재와 다르다.
// 채찍의 명중 판정(92)은 턴에 따라 빗나갈 수 있어 둘째 공격 비트는 명중·빗나감 메시지를 모두 허용한다.
// 그래서 두 공격 비트의 visibleText 축은 픽스처와 무관하게 성립하는 "주인공의 공격!" 만 단정한다 —
// 피해 수치는 픽스처마다 다르므로 축으로 박으면 A/B 한쪽이 반드시 깨진다.

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const itemEquipmentScenario = {
  id: "item-equipment",
  seed: 101,
  projectFixture: "test/fixtures/projects/item-equipment-rapier-qa-v3.json",
  beats: [
    {
      id: "title",
      note: "출하 플레이어 타이틀 화면",
      expect: { testidPresent: ["title-screen"] },
    },
    {
      id: "field-start",
      note: "새 게임을 시작하고 장비 비교 공통 시드 101을 주입한다",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 101 },
      ],
      expect: {
        mapId: "map_lantern_village",
        x: 14,
        y: 18,
        testidAbsent: ["title-screen", "battle-scene"],
      },
    },
    {
      id: "face-battle-event",
      note: "달빛우물 숲의 고정 전투 이벤트 앞에서 위를 본다",
      ops: [
        { kind: "teleport", mapId: "map_moonwell_forest", x: 14, y: 3 },
        { kind: "waitForPosition", mapId: "map_moonwell_forest", x: 14, y: 3 },
        { kind: "face", dir: "up" },
      ],
      expect: { mapId: "map_moonwell_forest", x: 14, y: 3 },
    },
    {
      id: "battle-ready",
      note: "고정 이벤트 대사를 조건부로 넘겨 실제 전투의 공격 커맨드까지 진입한다",
      ops: [
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present" },
        { kind: "pressUntil", key: "z", testid: "battle-scene", state: "present", maxPresses: 24 },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 20000 },
      ],
      expect: {
        testidPresent: ["battle-scene", "actor-command-attack", "battle-enemy-list-hp-enemy-1"],
      },
    },
    {
      id: "first-attack",
      note: "첫 공격의 피해 팝업과 전투 메시지(급소 여부·피해량)를 함께 포착한다",
      ops: [
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-target-prompt", state: "present" },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-damage-popup", state: "present", timeoutMs: 20000 },
      ],
      expect: {
        testidPresent: ["battle-scene", "battle-message-window", "battle-damage-popup", "battle-enemy-list-hp-enemy-1"],
        visibleText: { "battle-message-window": "주인공의 공격!" },
      },
      shot: true,
    },
    {
      id: "second-attack",
      note: "다음 턴 같은 입력으로 둘째 공격의 명중 또는 빗나감 메시지를 포착한다",
      ops: [
        { kind: "waitFor", testid: "battle-damage-popup", state: "absent", timeoutMs: 20000 },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 20000 },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-target-prompt", state: "present" },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-damage-popup", state: "present", timeoutMs: 20000 },
      ],
      expect: {
        testidPresent: ["battle-scene", "battle-message-window", "battle-damage-popup", "battle-enemy-list-hp-enemy-1"],
        visibleText: { "battle-message-window": "주인공의 공격!" },
      },
      shot: true,
    },
  ],
};

export default itemEquipmentScenario;
