// 출하 기본 아이템을 실제 player.html 전투에서 사용하는 런타임 증거 시나리오.
// 픽스처의 아이템 DB 순서상 전투 서브메뉴는
//   회복약, 마력약, 고급 해독제, 전투의 묘약, 연대의 물약, 서리 유리병, 이중 약갑
// 이며, class_hero의 루트 커맨드는 공격, 기술, 방어, 아이템, 도주 순서다.
// 대상 적은 troop_forest_hornets의 첫 멤버 enemy-1(슬라임, HP 18)로 고정한다.

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const itemBattleScenario = {
  id: "item-battle",
  projectFixture: "test/fixtures/projects/item-runtime-qa-v3.json",
  beats: [
    {
      id: "title",
      note: "출하 플레이어 타이틀 화면",
      expect: { testidPresent: ["title-screen"] },
    },
    {
      id: "field-start",
      note: "새 게임으로 등대 마을 시작 지점에 진입",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
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
      note: "달빛우물 숲 봉인 남쪽 칸에서 이벤트를 바라봄",
      ops: [
        { kind: "teleport", mapId: "map_moonwell_forest", x: 14, y: 3 },
        { kind: "waitForPosition", mapId: "map_moonwell_forest", x: 14, y: 3 },
        { kind: "face", dir: "up" },
      ],
      expect: { mapId: "map_moonwell_forest", x: 14, y: 3 },
    },
    {
      id: "battle-intro",
      note: "고정 봉인 이벤트를 열고 실전 전투 커맨드까지 진입",
      ops: [
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present" },
        { kind: "pressUntil", key: "z", testid: "battle-scene", state: "present", maxPresses: 24 },
        { kind: "waitFor", testid: "battle-actor-sprites", state: "present" },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 20000 },
      ],
      expect: {
        testidPresent: ["battle-scene", "battle-actor-sprites", "actor-command-item"],
        battlerGeometry: { minEnemies: 3 },
      },
    },
    {
      id: "elemental-before",
      note: "서리 유리병 대상 선택 전 enemy-1 슬라임 HP 18/18",
      ops: [
        { kind: "key", key: "ArrowDown", times: 3 },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "actor-item-item_gen2_frost_vial", state: "present" },
        { kind: "key", key: "ArrowDown", times: 5 },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-target-prompt", state: "present" },
      ],
      expect: {
        testidPresent: ["battle-target-enemy-1", "battle-enemy-list-hp-enemy-1"],
      },
      shot: true,
    },
    {
      id: "elemental-after",
      note: "서리 유리병을 enemy-1에 사용한 뒤 같은 HP 표시가 0/18로 감소",
      ops: [
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-target-prompt", state: "absent" },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 30000 },
      ],
      expect: {
        testidPresent: ["battle-scene", "battle-enemy-list-hp-enemy-1"],
      },
      shot: true,
    },
    {
      id: "buff-before",
      note: "전투의 묘약을 고르고 상태가 없는 주인공을 대상으로 선택",
      ops: [
        { kind: "key", key: "ArrowDown", times: 3 },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "actor-item-item_gen2_war_draught", state: "present" },
        { kind: "key", key: "ArrowDown", times: 3 },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-target-prompt", state: "present" },
      ],
      expect: {
        testidPresent: ["battle-target-actor_hero", "battle-actor-actor_hero"],
      },
      shot: true,
    },
    {
      id: "buff-after",
      note: "전투의 묘약 사용 후 주인공에게 공격 상승 상태 아이콘이 표시됨",
      ops: [
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-target-prompt", state: "absent" },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 30000 },
      ],
      expect: {
        testidPresent: ["battle-scene", "battle-party", "battle-actor-actor_hero"],
      },
      shot: true,
    },
  ],
};

export default itemBattleScenario;
