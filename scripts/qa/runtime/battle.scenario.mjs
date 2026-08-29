// 런타임 전투 시나리오 — 출하 플레이어(player.html) 경로로 실제 전투 화면을 띄운다.
//
// 왜 이 시나리오가 필요한가: 전투 캐릭터셋(리소스 kind "n")은 `battle-actor-sprite` 의
// background-image 로만 화면에 나타난다. 시트 파일을 단위 테스트로 재는 것만으로는
// "필드에서 적 배틀러와 나란히 놓였을 때 어떻게 보이는가" 를 증명할 수 없다.
//
// 기대치는 픽스처(test/fixtures/projects/editor-authored-demo-v3.json)의 실물에서 읽었다:
//   startMapId = map_lantern_village, startPos = (14,18)
//   ev_map_moonwell_forest_seal(14,2) trigger=action, movement=fixed → 대사 뒤
//                                     battleProcessing troop_forest_hornets
//   파티 = actor_hero / actor_guardian / actor_mage / actor_scout
//        → generated-actor-hero-01..04-battle 네 시트를 한 화면에서 전부 태운다.
//
// 왜 마을의 ev_lantern_training(20,14) 을 안 쓰는가: 그 페이지는 movement={type:"random"}
// 이다. 옆으로 텔레포트해 이벤트가 거기 서 있다고 가정하면 NPC 가 돌아다니다 벗어나는
// 레이스가 된다 — 실측: 한가한 호스트에서는 3회 연속 통과했지만 load 44~82 에서는 3회
// 연속 실패하고, 실패 샷에는 대사창이 아예 없었다. 전투 화면을 재는 시나리오를 이동하는
// NPC 에 기대면 안 된다.
// 전투 씬 testid 는 src/player/battleDom.ts:84 의 `battle-scene`,
// 아군 스프라이트 그룹은 src/player/battleFieldDom.ts:504 의 `battle-actor-sprites`.

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const battleScenario = {
  id: "battle",
  beats: [
    {
      id: "title",
      note: "타이틀 화면이 뜬다",
      expect: { testidPresent: ["title-screen"] },
    },
    {
      id: "field-start",
      note: "새 게임 → 등대 마을 시작 지점",
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
      note: "달빛우물 숲 봉인(14,2) 남쪽 칸으로 이동해 위를 본다",
      ops: [
        { kind: "teleport", mapId: "map_moonwell_forest", x: 14, y: 3 },
        { kind: "waitForPosition", mapId: "map_moonwell_forest", x: 14, y: 3 },
        { kind: "face", dir: "up" },
      ],
      expect: { mapId: "map_moonwell_forest", x: 14, y: 3 },
    },
    {
      id: "battle-intro",
      note: "대사를 넘겨 전투 진입 — 아군 4명 시트와 적 배틀러가 한 화면에 선다",
      ops: [
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present" },
        { kind: "pressUntil", key: "z", testid: "battle-scene", state: "present", maxPresses: 24 },
        { kind: "waitFor", testid: "battle-actor-sprites", state: "present" },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 20000 },
      ],
      expect: {
        testidPresent: ["battle-scene", "battle-actor-sprites"],
        // 적 배치는 실브라우저 rect 로만 참이다 — 상단 클리핑·접지 띠·겹침을 여기서 본다.
        battlerGeometry: { minEnemies: 3 },
      },
      shot: true,
    },
    {
      id: "battle-attack",
      note: "공격 커맨드를 확정해 attack/hit 프레임이 실제로 교체되는지 본다",
      ops: [
        { kind: "key", key: "z" },
        { kind: "key", key: "z" },
      ],
      expect: { testidPresent: ["battle-scene"] },
      shot: true,
    },
  ],
};

export default battleScenario;
