// 런타임 전투 시나리오 — 출하 플레이어(player.html) 경로에서 턴제 전투가 실제로 뜨는지 본다.
//
// 왜 별도 시나리오인가: smoke/dialogue 픽스처에는 접촉만으로 전투가 열리는 이벤트가 없다.
// 여기서는 전투 전용 픽스처를 쓴다(test/fixtures/projects/battle-v3.json, 실물에서 읽음):
//   startMapId = map_battle (2×1), startPos = (0,0)
//   이벤트 battle-start@(1,0), trigger=action, commands=[battleProcessing troop_slime]
//   system.battleUiStyle 미설정 → resolveSkinId 가 기본 스킨 rm2003 으로 떨어진다.
//     즉 이 시나리오는 **지원 유지되는 RM식 전투 화면**을 그대로 통과한다.
//
// 편집기 셸을 태우는 test/e2e/oprn-battle-layout-ux.spec.ts 계열은 test-play-window 가
// 열리지 않아 main 에서도 실패한다(실측 2026-08-28: main 7fbc7fc8 에서 3/3 실패).
// 게임 화면 증거는 이 하네스로 잡는다 — AGENTS.md 의 편집기/런타임 QA 분리 규칙.

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const battleRm2003Scenario = {
  id: "battle-rm2003",
  projectFixture: "test/fixtures/projects/battle-v3.json",
  beats: [
    {
      id: "title",
      note: "타이틀 화면이 뜬다",
      expect: { testidPresent: ["title-screen"] },
    },
    {
      id: "field-start",
      note: "새 게임 → map_battle (0,0), 오른쪽 (1,0) 에 전투 이벤트",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
      ],
      expect: {
        mapId: "map_battle",
        x: 0,
        y: 0,
        testidAbsent: ["title-screen", "battle-scene"],
      },
    },
    {
      id: "battle-open",
      note: "전투 이벤트 말걸기 → 전투 화면(기본 스킨 rm2003)이 실제로 마운트된다",
      ops: [
        { kind: "face", dir: "right" },
        { kind: "action" },
        { kind: "waitFor", testid: "battle-scene", state: "present", timeoutMs: 20000 },
      ],
      expect: { testidPresent: ["battle-scene"] },
      shot: true,
    },
    {
      id: "battle-command",
      note: "인트로가 끝나면 액터 커맨드(공격)까지 도달한다",
      ops: [
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 20000 },
      ],
      expect: { testidPresent: ["battle-scene", "actor-command-attack"] },
      shot: true,
    },
  ],
};

export default battleRm2003Scenario;
