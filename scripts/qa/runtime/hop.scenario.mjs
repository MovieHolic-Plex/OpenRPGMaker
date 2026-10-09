// 체공(점프·위에서 낙하) 런타임 시나리오.
//
// 이 시나리오만이 증명할 수 있는 것: **실제 Phaser 의 displayOrigin 계약**.
// 리프트는 `sprite.y` 가 아니라 원점 채널에 실린다(`src/player/characterHop.ts`) — jsdom
// 단위 테스트는 `setFrame` 이 원점을 되돌리는 동작을 목으로 흉내낼 수밖에 없다. 여기서는
// 진짜 Phaser 가 그린 뒤의 원점을 되읽어 두 가지를 본다.
//   1. 체공 중 liftPx > 0 (스프라이트가 실제로 떠 있다)
//   2. 체공 중 접지선(playerSpriteY)이 타일 경계에 그대로 남는다 — 깊이 y-소트·카메라
//      추적·조명 타일이 전부 이 값을 읽으므로, 여기가 흔들리면 화면이 조용히 깨진다.
//
// 픽스처는 스모크와 같다(test/fixtures/projects/editor-authored-demo-v3.json):
//   startMapId = map_lantern_village (30×30), startPos = (14,18)
//   접지선 = characterSpriteY(tileY) = tileY*16 + 16  → (14,18) 은 304, (14,20) 은 336
// 시작 맵 이벤트는 (14,20) 에 없으므로 점프 착지가 대사를 열지 않는다.
//
// 저작값(heightPx/durationMs)을 크게 잡은 이유: 기본 점프는 12px·300ms 라 최고점을
// 브라우저에서 잡기 어렵고 스크린샷으로도 안 보인다. 저작 경로를 그대로 쓰면서 관측
// 가능한 값으로 키운다 — 저작 파라미터가 런타임까지 전달되는지도 같이 증명된다.

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const hopScenario = {
  id: "hop",
  beats: [
    {
      id: "title",
      note: "타이틀 화면이 뜬다",
      expect: { testidPresent: ["title-screen"] },
    },
    {
      id: "field-start",
      note: "새 게임 → 등대 마을 (14,18), 접지선 304px",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
      ],
      expect: {
        mapId: "map_lantern_village",
        x: 14,
        y: 18,
        playerSpriteTextureLoaded: true,
        playerLiftPx: 0,
        playerSpriteY: 304,
        testidAbsent: ["title-screen"],
      },
      shot: true,
    },
    {
      id: "drop-in-airborne",
      note: "위에서 낙하(보스 강림) — 8칸 위에서 떨어지는 중이고 타일은 그대로다",
      ops: [
        { kind: "playerRoute", moves: [{ kind: "dropIn", heightPx: 128, durationMs: 1500 }] },
        // 80px 이상에서 잡는다 — 이 시작 지점 위 (14,15) 에 마을 장로가 서 있어서 40px
        // 대에서는 주인공이 그 스프라이트와 겹쳐 샷으로는 구분이 안 됐다(실측).
        { kind: "waitForLift", minPx: 80 },
      ],
      expect: {
        x: 14,
        y: 18,
        playerLiftPxAtLeast: 80,
        // 낙하는 타일을 옮기지 않는다 — 접지선도 그대로여야 한다.
        playerSpriteY: 304,
        // 그림자는 접지선에 붙어 하부 타일 위·캐릭터 아래 띠에 그려진다.
        playerShadowVisible: true,
        playerShadowGroundY: 304,
        playerAirborne: true,
      },
      shot: true,
    },
    {
      id: "drop-in-landed",
      note: "낙하 착지 — 리프트가 정확히 0 으로 회수된다",
      ops: [{ kind: "waitForGrounded" }],
      expect: {
        x: 14,
        y: 18,
        playerLiftPx: 0,
        playerSpriteY: 304,
        playerAirborne: false,
        // 접지하면 그림자는 숨는다(오브젝트는 풀에 남는다).
        playerShadowVisible: false,
      },
      shot: true,
    },
    {
      id: "jump-liftoff",
      note: "이륙 직후 낮은 고도 — 그림자가 가장 진하게 발밑에 붙는다",
      ops: [
        { kind: "face", dir: "down" },
        {
          // 4000ms 다(실측): 이 시나리오는 1200ms 동안 순간 상태를 "기다린 뒤 읽는" 방식으로
          // 주장하는데 읽기 지연(스크린샷 150~300ms)이 비행의 25% 나 된다. 길게 뛰면 같은
          // 지연이 7% 로 줄어 다음 비트의 최고점 주장이 흔들리지 않는다.
          kind: "playerRoute",
          moves: [{ kind: "jump", dx: 0, dy: 2, heightPx: 48, durationMs: 4000 }],
        },
        // ⚠️ 상한(maxPx) 을 두면 안 된다: 포물선은 저고도 띠를 오르며·내리며 두 번 지나므로
        // **내려오는 쪽**을 잡을 수 있고, 그러면 다음 비트의 최고점은 이미 지나가 30 초
        // 타임아웃까지 간다(실측: 5 회 중 1 회). 하한만 두면 첫 만족 표본이 항상 상승 구간이다.
        { kind: "waitForLift", minPx: 4 },
      ],
      expect: { playerLiftPxAtLeast: 4, playerShadowVisible: true, playerAirborne: true },
      shot: true,
    },
    {
      id: "jump-apex",
      note: "최고점 — 저작 heightPx 48 이 런타임까지 전달된다",
      // 기다림은 40px 로 좁게 걸고(저작 48px 이 실제로 실렸다는 증거), 기다림이 성공한 뒤
      // 읽는 기대값은 한 단 낮춘다 — 그 사이 스크린샷 지연만큼 포물선이 이미 내려오기 때문이다.
      ops: [{ kind: "waitForLift", minPx: 40 }],
      expect: { playerLiftPxAtLeast: 30, playerShadowVisible: true, playerAirborne: true },
      shot: true,
    },
    {
      id: "jump-landed",
      note: "점프 착지 — (14,20) 커밋, 접지선 336px",
      ops: [
        { kind: "waitForGrounded" },
        { kind: "waitForPosition", mapId: "map_lantern_village", x: 14, y: 20 },
      ],
      expect: {
        mapId: "map_lantern_village",
        x: 14,
        y: 20,
        playerLiftPx: 0,
        playerSpriteY: 336,
        playerAirborne: false,
        playerShadowVisible: false,
        // 착지 지점으로 그림자가 따라왔다는 증거(숨기 전 마지막 위치).
        playerShadowGroundY: 336,
      },
      shot: true,
    },
    {
      id: "shadow-sample",
      note: "고고도 체공 프레임을 표본으로 기록한다 — 다음 비트가 같은 자리를 픽셀로 대조한다",
      ops: [
        // 느린 낙하: 제자리라 접지선이 고정되고 고도 변화도 느려서 표본과 기하가 어긋나지 않는다.
        { kind: "playerRoute", moves: [{ kind: "dropIn", heightPx: 96, durationMs: 6000 }] },
        // **높은** 고도에서 잡는다. 낮은 고도에서는 캐릭터의 발이 그림자 상자를 덮어
        // 스프라이트의 검은 픽셀을 재게 된다(실측: 완전 투명한 그림자도 통과했다).
        { kind: "waitForLift", minPx: 60 },
        { kind: "captureShadowSample" },
      ],
      expect: { x: 14, y: 20, playerLiftPxAtLeast: 60, playerShadowVisible: true },
      shot: true,
    },
    {
      id: "shadow-ink",
      note: "같은 월드 사각형을 캐릭터가 떠난 뒤와 비교 — 그림자가 픽셀로 존재했다",
      ops: [
        { kind: "waitForGrounded" },
        // 표본 자리를 비운다. 그림자를 지우는 게 아니라 **캐릭터를 치우는** 것이 요점이다:
        // 지형이 그대로라 두 프레임의 차이는 그림자뿐이다.
        { kind: "playerRoute", moves: [{ kind: "move", dir: "up" }, { kind: "move", dir: "up" }] },
        { kind: "waitForPosition", mapId: "map_lantern_village", x: 14, y: 18 },
      ],
      expect: {
        x: 14,
        y: 18,
        playerShadowVisible: false,
        // 실측 눈금(2026-08-29): 정상 그림자 0.102, **완전 투명** 그림자 0.026(두 프레임의
        // 카메라 스크롤이 달라 생기는 서브픽셀 잡음 바닥). 하한은 그 사이 0.06 으로 둔다.
        playerShadowInkAtLeast: 0.06,
      },
      shot: true,
    },
  ],
};

export default hopScenario;
