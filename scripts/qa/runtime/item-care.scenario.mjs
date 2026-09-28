/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const itemCareScenario = {
  id: "item-care",
  projectFixture: "test/fixtures/projects/item-care-qa-v3.json",
  // 이 시나리오는 workbench 스킨(ESC 직후 아이템 작업 패널)의 계약이다 — 기본 스킨이 pixel 로 바뀐 뒤에도 같은 화면을 본다.
  systemPatch: { menuUiStyle: "workbench" },
  beats: [
    {
      id: "title",
      expect: { testidPresent: ["title-screen"] },
    },
    {
      id: "field-start",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
      ],
      expect: { mapId: "map_lantern_village", x: 14, y: 18 },
    },
    {
      id: "open-items",
      note: "상태 메뉴의 첫 기능인 아이템 목록을 연다",
      ops: [
        { kind: "key", key: "x" },
        { kind: "waitFor", testid: "main-menu", state: "present" },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "status-menu-item-item_gen2_monster_kibble", state: "present" },
      ],
      expect: { testidPresent: ["main-menu", "status-menu-item-item_gen2_monster_kibble"] },
    },
    {
      id: "before",
      note: "순한 사료를 고른 대상 화면에서 돌봄 슬라임 친밀도 70을 확인한다",
      ops: [
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "status-menu-monster-monster_care_qa", state: "present" },
      ],
      expect: {
        testidPresent: ["status-menu-monster-monster_care_qa"],
        visibleText: { "status-menu-monster-monster_care_qa": "친밀도 70" },
      },
      shot: true,
    },
    {
      id: "after",
      note: "돌봄 슬라임에게 순한 사료를 사용해 친밀도가 78로 오른다 — 대상 선택은 닫히지 않고 수치가 그 자리에서 갱신된다",
      ops: [{ kind: "key", key: "z" }],
      expect: {
        testidPresent: ["status-menu-monster-monster_care_qa"],
        visibleText: { "status-menu-monster-monster_care_qa": "친밀도 78" },
      },
      shot: true,
    },
  ],
};

export default itemCareScenario;
