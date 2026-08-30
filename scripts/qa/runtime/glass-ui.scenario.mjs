/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const glassUiScenario = {
  id: "glass-ui",
  projectFixture: "test/fixtures/projects/glass-ui-qa-v3.json",
  beats: [
    {
      id: "field-start",
      note: "Start a new game beside town-npc at (1,1)",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
      ],
      expect: {
        mapId: "map_town",
        x: 0,
        y: 1,
        testidAbsent: ["title-screen", "shop-scene", "runtime-name-entry"],
      },
    },
    {
      id: "shop-open",
      note: "Talk to town-npc, open the goods list, and photograph the shop window",
      ops: [
        { kind: "face", dir: "right" },
        { kind: "action" },
        { kind: "waitFor", testid: "shop-scene", state: "present" },
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "shop-buy-item_potion", state: "present" },
        // 상점 오버레이는 runtime-shop-in(180ms) 페이드로 들어온다. present 직후에는 조상
        // opacity 가 0 이라 visibleText 축이 alpha 0 으로 실패한다 — 시간이 아니라 상태를 기다린다.
        { kind: "waitForVisible", testid: "shop-buy-item_potion" },
      ],
      expect: {
        testidPresent: ["shop-scene", "shop-buy-item_potion"],
        visibleText: { "shop-buy-item_potion": "물약" },
      },
      shot: true,
    },
    {
      id: "shop-close",
      note: "Cancel out of the shop so the next event command can run",
      ops: [
        { kind: "key", key: "x", times: 2 },
        { kind: "waitFor", testid: "shop-scene", state: "absent" },
      ],
      expect: { testidAbsent: ["shop-scene"] },
    },
    {
      id: "name-entry-open",
      note: "Wait for and photograph the hero name-entry window",
      ops: [
        { kind: "waitFor", testid: "runtime-name-entry", state: "present" },
        { kind: "waitForVisible", testid: "runtime-name-entry" },
      ],
      expect: {
        testidPresent: ["runtime-name-entry"],
        visibleText: { "runtime-name-entry": "이름 입력" },
      },
      shot: true,
    },
  ],
};

export default glassUiScenario;
