// 전투 화면 시나리오 — 몬스터(적) 배치 검증용.
//
// 픽스처는 smoke 와 같은 editor-authored-demo-v3.json 을 쓴다. 이유(실측):
//   - `map_moonwell_forest` 의 `ev_map_moonwell_forest_seal`(14,2) 은 `movement: fixed` 라
//     배회하지 않는다 → 고정 좌표 인접 가정이 성립한다(배회 NPC 로는 못 한다).
//   - 그 이벤트 1페이지는 `text` → `battleProcessing(troop_forest_hornets)` 이라
//     **3마리 트룹**이 뜬다. 뒷줄까지 있는 배치를 한 번에 본다.
//   - 시작 맵(map_lantern_village)에서 다른 맵으로의 teleport 는 loadMap 을 태우므로
//     스프라이트까지 실제로 옮겨진다(같은 맵 teleport 는 상태만 바꾼다 — smoke 주석 참조).
//
// 배치 판정은 `battlerGeometry` 기대치가 실제 브라우저 rect 로 한다. CSS 레이아웃은
// jsdom 으로 재현되지 않으므로 이 기하는 실브라우저에서만 참이다.

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const battleScenario = {
  id: "battle",
  beats: [
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
        testidAbsent: ["title-screen", "battle-scene"],
      },
    },
    {
      id: "approach-seal",
      note: "달우물 숲 봉인(14,2) 아래 칸으로 이동 → 말 걸면 전투 이벤트",
      ops: [
        { kind: "teleport", mapId: "map_moonwell_forest", x: 14, y: 3 },
        { kind: "wait", ms: 1500 },
        { kind: "face", dir: "up" },
        { kind: "action" },
        { kind: "waitFor", testid: "dialogue-box", state: "present" },
      ],
      expect: { mapId: "map_moonwell_forest", testidPresent: ["dialogue-box"] },
    },
    {
      id: "battle-intro",
      note: "대사 소진 → 전투 진입(3마리 트룹)",
      ops: [
        { kind: "pressUntil", key: "Enter", testid: "battle-scene", state: "present", maxPresses: 20 },
        { kind: "waitFor", testid: "battle-command-grid", state: "present", timeoutMs: 30000 },
        // 인트로 슬라이드-인이 끝난 정지 상태를 찍는다(애니메이션 중간 프레임은 배치 근거가 못 된다).
        { kind: "wait", ms: 1200 },
      ],
      expect: {
        testidPresent: ["battle-scene", "battle-field", "battle-command-grid"],
        battlerGeometry: { minEnemies: 3 },
      },
      shot: true,
    },
  ],
};

export default battleScenario;
