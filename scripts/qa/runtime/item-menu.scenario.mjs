/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const itemMenuScenario = {
  id: "item-menu",
  projectFixture: "test/fixtures/projects/item-runtime-qa-v3.json",
  query: { e2eVitals: "1" },
  beats: [
    {
      id: "title",
      expect: { testidPresent: ["title-screen"] },
    },
    {
      id: "field-start",
      note: "새 게임을 시작하고 실제 아이템 효과가 보이도록 파티 전원의 HP와 MP를 낮춘다",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
        {
          kind: "setVitals",
          hp: 100,
          mp: 5,
          actorIds: ["actor_hero", "actor_guardian", "actor_mage", "actor_scout"],
        },
      ],
      expect: { mapId: "map_lantern_village", x: 14, y: 18, testidAbsent: ["title-screen", "main-menu"] },
    },
    {
      id: "status-menu-open",
      note: "필드에서 취소 키로 상태 메뉴를 연다",
      ops: [
        { kind: "key", key: "x" },
        { kind: "waitFor", testid: "main-menu", state: "present" },
      ],
      expect: { testidPresent: ["main-menu", "status-menu-command-items"] },
    },
    {
      id: "hp-before-100-item-list",
      note: "아이템 기능에 들어가 회복약 사용 전 주인공 HP 100/514를 확인한다",
      ops: [
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "status-menu-item-item_potion", state: "present" },
      ],
      expect: { testidPresent: ["main-menu", "status-menu-item-item_potion"] },
      shot: true,
    },
    {
      id: "hp-after-150-item-list",
      note: "회복약을 주인공에게 사용해 HP가 100에서 150으로 오른 결과를 확인한다",
      ops: [
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "status-menu-item-target-actor_hero", state: "present" },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "status-menu-item-item_potion", state: "present" },
      ],
      expect: {
        testidPresent: ["main-menu", "status-menu-item-item_potion"],
        testidAbsent: ["status-menu-item-target-actor_hero"],
      },
      shot: true,
    },
    {
      id: "mp-before-5-item-list",
      note: "마력약 사용 전 주인공 MP 5/43을 확인한다",
      ops: [{ kind: "key", key: "ArrowDown" }],
      expect: { testidPresent: ["main-menu", "status-menu-item-item_ether"] },
      shot: true,
    },
    {
      id: "mp-after-35-item-list",
      note: "마력약을 주인공에게 사용해 MP가 5에서 35로 오른 결과를 확인한다",
      ops: [
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "status-menu-item-target-actor_hero", state: "present" },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "status-menu-item-item_ether", state: "present" },
      ],
      expect: {
        testidPresent: ["main-menu", "status-menu-item-item_ether"],
        testidAbsent: ["status-menu-item-target-actor_hero"],
      },
      shot: true,
    },
    {
      id: "party-hp-before-100-item-list",
      note: "연대의 물약 사용 전 나머지 세 파티원의 HP 100/514를 확인한다",
      ops: [{ kind: "key", key: "ArrowDown", times: 3 }],
      expect: { testidPresent: ["main-menu", "status-menu-item-item_gen2_party_potion"] },
      shot: true,
    },
    {
      id: "party-hp-after-160-item-list",
      note: "연대의 물약을 사용해 주인공 HP가 150에서 210, 나머지는 100에서 160으로 함께 오른 결과를 확인한다",
      ops: [
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "status-menu-item-target-actor_hero", state: "present" },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "status-menu-item-item_gen2_party_potion", state: "present" },
      ],
      expect: {
        testidPresent: ["main-menu", "status-menu-item-item_gen2_party_potion"],
        testidAbsent: ["status-menu-item-target-actor_hero"],
      },
      shot: true,
    },
  ],
};

export default itemMenuScenario;
