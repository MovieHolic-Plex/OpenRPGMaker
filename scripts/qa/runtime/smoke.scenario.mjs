// 런타임 스모크 시나리오.
//
// 프로젝트는 저장소에 커밋된 예제 게임 examples/saesol-red/project.json.gz 다(#2586).
// 예전 기본 픽스처(test/fixtures/projects/editor-authored-demo-v3.json)는 2026-10-07 에 지운 EasyRPG ChipSet 을
// 가리켜, 필드가 통째로 __MISSING(초록 와이어프레임)인데도 스모크가 통과했다. 그래서 이제 모든 필드 비트에
// noMissingTextures 를 건다 — 타일·이벤트 그림 하나라도 빠지면 실패한다.
//
// 기대치는 예제의 실물에서 읽었다:
//   meta.title  = "새솔 RED · 첫 번째 배지"
//   startMapId  = map_variety_ridge (28×30), startPos = (13,26)
//   다른 맵      = map_variety_cavern(28×24) · map_saesol_route(28×38), 같은 타일셋 shared_isaiah658_saesol
// 오프닝(system.opening, 15초 분량)은 이 시나리오의 대상이 아니라 systemPatch 로 끈다.
//
// `shot` 은 옵트인이다 — 켠 비트만 PNG 를 남긴다(컨텍스트 정책).
// 실패한 비트는 옵트인과 무관하게 샷을 남긴다(shouldCaptureShot).

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const smokeScenario = {
  id: "smoke",
  projectFixture: "examples/saesol-red/project.json.gz",
  systemPatch: { opening: { enabled: false, skippable: true, scenes: [] } },
  beats: [
    {
      id: "title",
      note: "타이틀 화면이 뜬다",
      expect: { testidPresent: ["title-screen"] },
      shot: true,
    },
    {
      id: "field-start",
      note: "새 게임 → 새솔마을 시작 지점, 플레이어와 타일이 실제 텍스처로 그려진다",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
      ],
      expect: {
        mapId: "map_variety_ridge",
        x: 13,
        y: 26,
        playerSpriteResourceNonEmpty: true,
        // resourceId 만 보면 통과하지만 Phaser 가 __MISSING 을 그리는 상태가 있다(실측).
        playerSpriteTextureLoaded: true,
        noMissingTextures: true,
        testidAbsent: ["title-screen", "dialogue-box"],
      },
      shot: true,
    },
    // 대사 상호작용은 여기서 다루지 않는다 — dialogue.scenario.mjs 로 분리했다. 이유(둘 다 실측):
    //  1. 같은 맵 안 __oprnDebug.teleport 는 상태만 바꾸고 플레이어 스프라이트를 옮기지 않는다
    //     (mapId 가 같으면 loadMap 을 부르지 않는다 — playSceneTestHooks.ts). 위치 지정에 못 쓴다.
    //  2. 배회하는 NPC 는 같은 세션 안에서도 픽셀 좌표가 움직인다 — 고정 좌표 인접 가정이 성립하지 않는다.
    {
      id: "teleport-cavern",
      note: "맵 전환 — 푸른울림 동굴",
      ops: [
        { kind: "teleport", mapId: "map_variety_cavern", x: 13, y: 21 },
        { kind: "waitForPosition", mapId: "map_variety_cavern", x: 13, y: 21 },
      ],
      expect: {
        mapId: "map_variety_cavern",
        x: 13,
        y: 21,
        playerSpriteTextureLoaded: true,
        noMissingTextures: true,
      },
      shot: true,
    },
    {
      id: "teleport-route",
      note: "맵 전환 — 1번 길",
      ops: [
        { kind: "teleport", mapId: "map_saesol_route", x: 13, y: 34 },
        { kind: "waitForPosition", mapId: "map_saesol_route", x: 13, y: 34 },
      ],
      expect: {
        mapId: "map_saesol_route",
        x: 13,
        y: 34,
        playerSpriteTextureLoaded: true,
        noMissingTextures: true,
      },
      shot: true,
    },
  ],
};

export default smokeScenario;
