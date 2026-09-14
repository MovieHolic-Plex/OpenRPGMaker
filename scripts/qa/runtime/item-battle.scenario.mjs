// 출하 기본 아이템을 실제 player.html 전투에서 사용하는 런타임 증거 시나리오.
// 픽스처의 아이템 DB 순서상 전투 서브메뉴는
//   회복약, 마력약, 고급 해독제, 전투의 묘약, 연대의 물약, 서리 유리병, 이중 약갑
// 이며, class_hero의 루트 커맨드는 공격, 기술, 방어, 아이템, 도주 순서다.
// 대상 적은 troop_forest_hornets의 첫 멤버 enemy-1(슬라임, HP 18)로 고정한다.
//
// 증거 축에 관한 실측 메모(중요):
//   * 적 HP 숫자가 화면에 보이는 곳은 **선택 중인 대상**의 인필드 HUD(`battle-enemy-hp-<id>`)
//     하나뿐이다. 커맨드 옆 목록의 `battle-enemy-list-hp-*` 는 클래식 스킨이 부모
//     `.battle-enemy-list-panel` 을 display:none 으로 숨겨서 DOM 에만 있다 — 그래서 이 시나리오는
//     HP 를 `visibleText`(보이는 글자) 로만 단정한다.
//   * 서리 유리병은 이 편성의 슬라임(18)과 박쥐(20)를 모두 한 방에 쓰러뜨린다. 그러니 "HP 가
//     줄어든 숫자" 를 사후 샷으로 남길 수 없다. 사후 증거는 **쓰러진 뒤 대상 목록에서 사라지고**
//     스프라이트가 opacity 0 으로 빠지는 것으로 잡는다(살아남은 적의 HUD 숫자를 대조군으로 둔다).

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
      id: "item-list-before-x5",
      note: "전투 아이템 목록을 열어 쓰기 전 수량을 화면에서 확인한다 — 서리 유리병 x5, 전투의 묘약 x5",
      ops: [
        { kind: "key", key: "ArrowDown", times: 3 },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "actor-item-item_gen2_frost_vial", state: "present" },
        { kind: "key", key: "ArrowDown", times: 5 },
      ],
      expect: {
        testidPresent: ["battle-scene", "actor-item-item_gen2_frost_vial"],
        visibleText: {
          "actor-item-item_gen2_frost_vial": "x5",
          "actor-item-item_gen2_war_draught": "x5",
        },
      },
      shot: true,
    },
    {
      id: "elemental-before",
      note: "서리 유리병 대상 선택 — enemy-1 슬라임의 인필드 HUD 가 화면에 18/18 을 띄운다",
      ops: [
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-target-prompt", state: "present" },
      ],
      expect: {
        testidPresent: ["battle-target-enemy-1"],
        visibleText: { "battle-enemy-hp-enemy-1": "18/18" },
      },
      shot: true,
    },
    {
      id: "elemental-after",
      note: "서리 유리병을 맞은 enemy-1 이 쓰러져 대상 목록에서 빠지고, 살아남은 박쥐만 20/20 으로 남는다",
      ops: [
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-target-prompt", state: "absent" },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 30000 },
        // 대상 목록을 다시 연다. 쓰러진 적이 목록에서 사라졌다는 사실이 화면에 남는 증거다.
        // 아이템 행동이 끝나면 루트 커서는 공격으로 돌아가 있다 — 바로 z 를 누른다
        // (화새상 ArrowUp 으로 감싸면 스킬 서브메뉴로 새다).
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-target-prompt", state: "present" },
      ],
      expect: {
        testidPresent: ["battle-scene", "battle-target-enemy-2"],
        // 쓰러진 슬라임은 고를 수 없다(목록에서 제거). 대조군으로 살아 있는 박쥐의 HUD 숫자를 본다.
        testidAbsent: ["battle-target-enemy-1"],
        visibleText: { "battle-enemy-hp-enemy-2": "20/20" },
      },
      shot: true,
    },
    {
      id: "buff-before",
      note: "전투의 묘약을 고르고 상태가 없는 주인공을 대상으로 선택",
      ops: [
        { kind: "key", key: "x" },
        { kind: "waitFor", testid: "battle-target-prompt", state: "absent" },
        { kind: "key", key: "ArrowDown", times: 3 },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "actor-item-item_gen2_war_draught", state: "present" },
        { kind: "key", key: "ArrowDown", times: 3 },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-target-prompt", state: "present" },
      ],
      expect: {
        // rm2000 은 정면 스킨이라 아군 필드 노드(battle-actor-*)가 없다 — 아군 배지의
        // 살림터는 하단 파티 상태 행의 battle-status-* 아이콘이다.
        testidPresent: ["battle-target-actor_hero"],
        // 아직 공격 상승 배지가 없어야 한다 — 사후 비트의 배지가 이 아이템 때문임을 가른다.
        testidAbsent: ["battle-status-actor_hero-atk-up"],
      },
      shot: true,
    },
    {
      id: "buff-after",
      note: "전투의 묘약 사용 후 주인공에게 ATK↑ 상태 배지가 화면에 뜬다",
      ops: [
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "battle-target-prompt", state: "absent" },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 30000 },
        { kind: "waitFor", testid: "battle-status-actor_hero-atk-up", state: "present", timeoutMs: 30000 },
      ],
      expect: {
        testidPresent: ["battle-scene", "battle-party"],
        // 배지의 글리프는 CSS ::before 라 textContent 로는 못 읽는다 — 빈 문자열은 "보이기만
        // 하면 된다" 는 뜻이고, 어떤 상태인지는 testid 의 토큰(atk-up)이 말한다.
        visibleText: { "battle-status-actor_hero-atk-up": "" },
      },
      shot: true,
    },
    {
      id: "item-list-after-x4",
      note: "아이템 목록을 다시 열어 쓴 두 아이템이 x5 에서 x4 로 줄어든 것을 화면에서 확인한다",
      ops: [
        { kind: "key", key: "ArrowDown", times: 3 },
        { kind: "key", key: "z" },
        { kind: "waitFor", testid: "actor-item-item_gen2_frost_vial", state: "present" },
        // 목록은 커서를 따라 스크롤한다. 커서가 맨 위면 서리 유리병 줄이 화면 밖으로 밀려
        // 샷이 주장을 받쳐주지 못한다 — 사용 전 비트와 같은 위치까지 내려 두 줄을 프레임에 넣는다.
        { kind: "key", key: "ArrowDown", times: 5 },
      ],
      expect: {
        testidPresent: ["battle-scene", "actor-item-item_gen2_frost_vial"],
        // 쓴 두 개만 x4 로 줄었다. 안 쓴 칸은 사용 전 비트의 x5 샷과 대조한다.
        visibleText: {
          "actor-item-item_gen2_frost_vial": "x4",
          "actor-item-item_gen2_war_draught": "x4",
        },
      },
      shot: true,
    },
  ],
};

export default itemBattleScenario;
