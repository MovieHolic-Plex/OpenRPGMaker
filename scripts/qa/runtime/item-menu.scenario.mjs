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
      id: "item-list-open",
      note: "아이템 탭에서 확인을 눌러 디테일 목록으로 포커스를 옮긴다 — 커서는 첫 실행 가능 항목 회복약에 선다",
      ops: [
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "status-menu-item-item_potion", state: "present" },
      ],
      expect: {
        testidPresent: ["main-menu", "status-menu-item-item_potion"],
        visibleText: { "status-menu-item-item_potion": "5개" },
      },
      shot: true,
    },
    {
      id: "hp-before-100-target",
      note: "회복약을 열면 대상 선택이 뜬다 — 파티 개요는 파티 페이지 전용이므로 HP는 대상 행 프리뷰로 본다",
      ops: [
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "status-menu-item-target-actor_hero", state: "present" },
      ],
      expect: {
        testidPresent: [
          "main-menu",
          "status-menu-item-target-actor_hero",
          "status-menu-item-target-actor_guardian",
          "status-menu-item-target-actor_mage",
          "status-menu-item-target-actor_scout",
        ],
        visibleText: { "status-menu-item-target-actor_hero": "100/514" },
      },
      shot: true,
    },
    {
      id: "hp-after-150-target",
      note: "주인공에게 사용하면 대상 선택이 닫히지 않고 HP 프리뷰가 150으로 갱신된다",
      ops: [{ kind: "key", key: "z" }],
      expect: {
        testidPresent: ["status-menu-item-target-actor_hero"],
        visibleText: { "status-menu-item-target-actor_hero": "150/514" },
      },
      shot: true,
    },
    {
      id: "potion-count-4-item-list",
      note: "취소로 목록으로 돌아오면 수량이 5개에서 4개로 줄어 있어야 한다",
      ops: [
        { kind: "key", key: "x" },
        { kind: "waitFor", testid: "status-menu-item-item_potion", state: "present" },
      ],
      expect: {
        testidPresent: ["main-menu", "status-menu-item-item_potion"],
        testidAbsent: ["status-menu-item-target-actor_hero"],
        visibleText: { "status-menu-item-item_potion": "4개" },
        inventoryCounts: { item_potion: 4 },
      },
      shot: true,
    },
    {
      id: "mp-before-5-target",
      note: "마력약을 열어 주인공 MP 5/43을 확인한다",
      ops: [
        { kind: "key", key: "ArrowDown" },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "status-menu-item-target-actor_hero", state: "present" },
      ],
      expect: {
        testidPresent: ["status-menu-item-target-actor_hero"],
        visibleText: { "status-menu-item-target-actor_hero": "5/43" },
      },
      shot: true,
    },
    {
      id: "mp-after-35-target",
      note: "주인공에게 사용하면 MP가 5에서 35로 오른다 — HP 150은 그대로여야 한다(엉뚱한 축으로 새지 않는다)",
      ops: [{ kind: "key", key: "z" }],
      expect: {
        testidPresent: ["status-menu-item-target-actor_hero"],
        visibleText: { "status-menu-item-target-actor_hero": "35/43" },
      },
      shot: true,
    },
    {
      id: "ether-count-4-item-list",
      note: "취소로 목록으로 돌아와 수량 4개를 확인한다",
      ops: [
        { kind: "key", key: "x" },
        { kind: "waitFor", testid: "status-menu-item-item_ether", state: "present" },
      ],
      expect: {
        testidPresent: ["main-menu", "status-menu-item-item_ether"],
        testidAbsent: ["status-menu-item-target-actor_hero"],
        visibleText: { "status-menu-item-item_ether": "4개" },
        inventoryCounts: { item_ether: 4 },
      },
      shot: true,
    },
    {
      id: "party-hp-before-100-target",
      note: "연대의 물약(아군 전체)을 열어 나머지 세 파티원의 HP 100/514를 확인한다 — 목록 순서는 회복약·마력약·고급 해독제·전투의 묘약·연대의 물약이므로 마력약에서 세 칸 내린다",
      ops: [
        { kind: "key", key: "ArrowDown", times: 3 },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "status-menu-item-target-actor_hero", state: "present" },
      ],
      expect: {
        testidPresent: ["status-menu-item-target-actor_guardian"],
        visibleText: {
          "status-menu-item-target-actor_guardian": "100/514",
          "status-menu-item-target-actor_mage": "100/514",
          "status-menu-item-target-actor_scout": "100/514",
        },
      },
      shot: true,
    },
    {
      id: "party-hp-after-160-target",
      note: "한 번 쓰면 네 명이 모두 오른다 — 주인공 150→210, 나머지 100→160",
      ops: [{ kind: "key", key: "z" }],
      expect: {
        testidPresent: ["status-menu-item-target-actor_hero"],
        visibleText: {
          "status-menu-item-target-actor_hero": "210/514",
          "status-menu-item-target-actor_guardian": "160/514",
          "status-menu-item-target-actor_mage": "160/514",
          "status-menu-item-target-actor_scout": "160/514",
        },
      },
      shot: true,
    },
    {
      id: "party-potion-count-4-item-list",
      note: "목록으로 돌아오면 수량은 1개만 줄어 4개다",
      ops: [
        { kind: "key", key: "x" },
        { kind: "waitFor", testid: "status-menu-item-item_gen2_party_potion", state: "present" },
      ],
      expect: {
        testidPresent: ["main-menu", "status-menu-item-item_gen2_party_potion"],
        testidAbsent: ["status-menu-item-target-actor_hero"],
        visibleText: { "status-menu-item-item_gen2_party_potion": "4개" },
        inventoryCounts: { item_gen2_party_potion: 4 },
      },
      shot: true,
    },
  ],
};

export default itemMenuScenario;
