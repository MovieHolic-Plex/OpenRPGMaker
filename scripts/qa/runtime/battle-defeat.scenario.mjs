// 전투 패배 → 게임 오버 시나리오 (출하 플레이어 경로).
//
// 왜 필요한가 (실측 2026-08-28): canLose=false 전투에서 패배해도 아무 일도 일어나지 않았다.
// 이벤트 전투는 결과를 session.battleResult 에만 적고 이벤트를 계속 실행했고, 랜덤 인카운터는
// 결과를 그대로 버렸다. 게임 오버 화면도, 파티 사망도 없이 필드로 되돌아왔다.
//
// 기대치는 픽스처(test/fixtures/projects/editor-authored-demo-v3.json)의 실물에서 읽었다:
//   ev_map_old_copper_mine_seal(27,14) = battleProcessing troop_golem_guard, canLose=false
//   첫 페이지 conditions=[] 라 새 세션에서 전투 페이지가 열린다(`done` 페이지는 스위치 필요).
// 게임 오버 testid 는 src/player/playSceneOverlays.ts 의 `game-over-screen`.
//
// 왜 파티를 HP 0 으로 만드는가: 검증 대상은 **호스트의 패배 처리 경로**이지 전투 산식이 아니다.
// HP 1 로는 패배가 재현되지 않았다 — battleDamage.ts:175 는 `power + floor(atk/2) - floor(def/2)
// <= 0` 이면 데미지 0 을 돌려주어 약한 적 앞에서 1 HP 파티가 무적이 된다(실측: 레벨 1 파티가
// 108HP 트룹을 이기고 battleResult=victory 가 찍혔다). HP 0 이면 전투 개시 시점에 진짜 defeat 이
// 확정되어 산식과 무관하게 패배 결말만 검사한다.

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const battleDefeatScenario = {
  id: "battle-defeat",
  query: { e2eVitals: "1" },
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 등대 마을 시작 지점",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        { kind: "seed", seed: 1 },
      ],
      expect: {
        mapId: "map_lantern_village",
        x: 14,
        y: 18,
        battleResult: null,
        testidAbsent: ["game-over-screen"],
      },
    },
    {
      id: "doomed-party",
      note: "폐광 봉인 앞으로 이동 + 파티 전원 HP 0 — 다음 전투는 개시 시점에 패배가 확정된다",
      ops: [
        { kind: "teleport", mapId: "map_old_copper_mine", x: 27, y: 15 },
        { kind: "waitForPosition", mapId: "map_old_copper_mine", x: 27, y: 15 },
        { kind: "setVitals", hp: 0, mp: 0 },
        { kind: "face", dir: "up" },
      ],
      expect: { mapId: "map_old_copper_mine", x: 27, y: 15, testidAbsent: ["game-over-screen"] },
      shot: true,
    },
    {
      id: "defeat-game-over",
      note: "봉인 이벤트(canLose=false) 전투 → 패배 → 게임 오버 화면(판정점)",
      ops: [
        { kind: "action" },
        { kind: "pressUntil", key: "z", testid: "game-over-screen", state: "present", maxPresses: 40 },
      ],
      expect: {
        battleResult: "defeat",
        testidPresent: ["game-over-screen"],
        testidAbsent: ["battle-scene"],
      },
      shot: true,
    },
  ],
};

export default battleDefeatScenario;
