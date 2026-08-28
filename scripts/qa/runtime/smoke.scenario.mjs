// 런타임 스모크 시나리오.
//
// 기대치는 픽스처(test/fixtures/projects/editor-authored-demo-v3.json)의 실물에서 읽었다:
//   meta.title  = "안개 항구와 등대의 밤"
//   startMapId  = map_lantern_village (30×30), startPos = (14,18)
//   맵          = map_lantern_village / map_moonwell_forest / map_old_copper_mine
//                 / map_sky_lantern_shrine
//   시작 맵 이벤트(전부 trigger=action):
//     ev_lantern_elder(14,15) ev_lantern_guard(14,4) ev_lantern_healer(10,18)
//     ev_lantern_scout(18,18) ev_lantern_training(20,14)
//     ev_to_forest(14,25) ev_to_mine(25,15) ev_to_shrine(14,5)
// 대사창 testid 는 src/player/dialogue.ts:104 의 `dialogue-box`.
//
// `shot` 은 옵트인이다 — 켠 비트만 PNG 를 남긴다(컨텍스트 정책).
// 실패한 비트는 옵트인과 무관하게 샷을 남긴다(shouldCaptureShot).

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const smokeScenario = {
  id: "smoke",
  beats: [
    {
      id: "title",
      note: "타이틀 화면이 뜬다",
      expect: { testidPresent: ["title-screen"] },
      shot: true,
    },
    {
      id: "field-start",
      note: "새 게임 → 등대 마을 시작 지점, 플레이어 스프라이트가 실제로 그려진다",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "wait", ms: 3000 },
        { kind: "seed", seed: 1 },
      ],
      expect: {
        mapId: "map_lantern_village",
        x: 14,
        y: 18,
        playerSpriteResourceNonEmpty: true,
        // resourceId 만 보면 통과하지만 Phaser 가 __MISSING 을 그리는 상태가 있다(실측).
        playerSpriteTextureLoaded: true,
        testidAbsent: ["title-screen", "dialogue-box"],
      },
      shot: true,
    },
    // 대사 상호작용은 여기서 다루지 않는다 — dialogue.scenario.mjs 로 분리했다. 이유(둘 다 실측):
    //  1. 같은 맵 안 __oprnDebug.teleport 는 상태만 바꾸고 플레이어 스프라이트를 옮기지 않는다
    //     (mapId 가 같으면 loadMap 을 부르지 않는다 — playSceneTestHooks.ts). 위치 지정에 못 쓴다.
    //  2. 이 픽스처의 NPC 는 배회한다 — 같은 세션 안에서 elder/healer 픽셀 좌표가 움직였다.
    //     고정 좌표 인접 가정이 성립하지 않는다.
    // 대사는 NPC 가 movement:fixed 이고 스폰 시점에 이미 인접한 픽스처로 검증한다.
    {
      id: "teleport-forest",
      note: "맵 전환 — 달우물 숲",
      ops: [
        { kind: "teleport", mapId: "map_moonwell_forest", x: 14, y: 14 },
        { kind: "wait", ms: 1500 },
      ],
      expect: {
        mapId: "map_moonwell_forest",
        x: 14,
        y: 14,
        playerSpriteTextureLoaded: true,
      },
      shot: true,
    },
    {
      id: "teleport-shrine",
      note: "맵 전환 — 하늘등 신전",
      ops: [
        { kind: "teleport", mapId: "map_sky_lantern_shrine", x: 12, y: 12 },
        { kind: "wait", ms: 1500 },
      ],
      expect: {
        mapId: "map_sky_lantern_shrine",
        x: 12,
        y: 12,
        playerSpriteTextureLoaded: true,
      },
      shot: true,
    },
  ],
};

export default smokeScenario;
