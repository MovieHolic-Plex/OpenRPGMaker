// 런타임 전투 시나리오 — 출하 플레이어(player.html) 경로로 실제 전투 화면을 띄운다.
//
// 왜 이 시나리오가 필요한가: 전투 캐릭터셋(리소스 kind "n")은 `battle-actor-sprite` 의
// background-image 로만 화면에 나타난다. 시트 파일을 단위 테스트로 재는 것만으로는
// "필드에서 적 배틀러와 나란히 놓였을 때 어떻게 보이는가" 를 증명할 수 없다.
//
// 기대치는 픽스처(test/fixtures/projects/editor-authored-demo-v3.json)의 실물에서 읽었다:
//   startMapId = map_lantern_village, startPos = (14,18)
//   ev_lantern_training(20,14) trigger=action → 대사 뒤 battleProcessing troop_slime_pair
//                                              (enemy_meadow_slime × 2)
//   파티 = actor_hero / actor_guardian / actor_mage / actor_scout
//        → generated-actor-hero-01..04-battle 네 시트를 한 화면에서 전부 태운다.
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
        { kind: "wait", ms: 3000 },
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
      id: "face-training-event",
      note: "훈련 이벤트(20,14) 남쪽 칸으로 이동해 위를 본다",
      ops: [
        { kind: "teleport", mapId: "map_lantern_village", x: 20, y: 15 },
        { kind: "wait", ms: 800 },
        { kind: "face", dir: "up" },
        { kind: "wait", ms: 300 },
      ],
      expect: { mapId: "map_lantern_village", x: 20, y: 15 },
    },
    {
      id: "battle-intro",
      note: "대사를 넘겨 전투 진입 — 아군 4명 시트 + 슬라임 2마리가 한 화면에 선다",
      ops: [
        { kind: "action" },
        { kind: "wait", ms: 600 },
        { kind: "pressUntil", key: "z", testid: "battle-scene", state: "present", maxPresses: 16, delayMs: 400 },
        { kind: "waitFor", testid: "battle-actor-sprites", state: "present" },
        // 인카운터 전환(흰 플래시 → 블라인드 → 인트로 슬라이드)이 끝나야 스프라이트가 제자리에 선다.
        { kind: "wait", ms: 2600 },
      ],
      expect: { testidPresent: ["battle-scene", "battle-actor-sprites"] },
      shot: true,
    },
    {
      id: "battle-attack",
      note: "공격 커맨드를 확정해 attack/hit 프레임이 실제로 교체되는지 본다",
      ops: [
        { kind: "key", key: "z", delayMs: 500 },
        { kind: "key", key: "z", delayMs: 500 },
        { kind: "wait", ms: 700 },
      ],
      expect: { testidPresent: ["battle-scene"] },
      shot: true,
    },
  ],
};

export default battleScenario;
