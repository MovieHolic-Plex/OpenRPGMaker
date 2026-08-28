// 전투 글자 가시성 시나리오 — 출하 경로(player.html)로 전투에 들어가 국면마다 계측한다.
//
// 기대치는 픽스처(test/fixtures/projects/editor-authored-demo-v3.json)의 실물에서 읽었다:
//   startMapId = map_lantern_village, startPos = (14,18)
//   ev_lantern_training(20,14) trigger=action → commands[1] battleProcessing troop_slime_pair
//   troop_slime_pair = 초원 슬라임 ×2 → 이름이 같아 런타임이 "초원 슬라임 1/2" 로 구분한다.
//     이 접미 숫자가 잘리면 두 대상이 화면에서 구별 불가능해진다 — 가시성이 곧 기능이다.
//   저작 라벨 최장: 아이템 "가죽 수선 도구"(8자) > 스킬 "회복약 효과"(6자) = 적 "초원 슬라임"(6자)
//
// 플레이어는 (14,18) 에서 시작하고 이벤트는 (20,14) 다. 같은 맵 안에서는 teleport 훅이
// 스프라이트를 옮기지 않으므로(smoke.scenario.mjs 의 실측 주석) 방향키로 걸어서 접근한다.
// 걸음 수는 dx=+6 / dy=-4 이고, 이벤트 앞칸 (20,15) 에서 위를 보고 action 을 넣는다.

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const battleTextScenario = {
  id: "battle-text",
  beats: [
    {
      id: "title",
      note: "타이틀 화면",
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
      expect: { mapId: "map_lantern_village", x: 14, y: 18, testidAbsent: ["title-screen"] },
    },
    {
      id: "walk-to-training",
      note: "훈련 이벤트 앞칸(20,15)까지 걸어간다",
      ops: [
        { kind: "dir", dir: "right" },
        { kind: "wait", ms: 1400 },
        { kind: "dir", dir: null },
        { kind: "dir", dir: "up" },
        { kind: "wait", ms: 1000 },
        { kind: "dir", dir: null },
        { kind: "wait", ms: 400 },
      ],
      expect: { mapId: "map_lantern_village" },
      shot: true,
    },
    {
      id: "battle-intro",
      note: "action → 선행 대사를 넘기고 전투 진입. 도입 국면 글자 계측",
      ops: [
        { kind: "face", dir: "up" },
        { kind: "action" },
        { kind: "wait", ms: 600 },
        { kind: "pressUntil", key: "Enter", testid: "battle-scene", state: "present", maxPresses: 12 },
        { kind: "wait", ms: 1200 },
      ],
      expect: { testidPresent: ["battle-scene"], battleTextClean: true },
      shot: true,
    },
    {
      id: "actor-command",
      note: "루트 커맨드 메뉴 — 공격/스킬/방어/아이템/도주",
      ops: [
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 20000 },
        { kind: "wait", ms: 400 },
      ],
      expect: { testidPresent: ["actor-command-attack"], battleTextClean: true },
      shot: true,
    },
    {
      id: "skill-submenu",
      note: "스킬 서브메뉴 — 이름 + MP 상세가 한 행에 들어가야 한다",
      ops: [
        { kind: "key", key: "ArrowDown" },
        { kind: "key", key: "Enter" },
        { kind: "wait", ms: 600 },
      ],
      expect: { battleTextClean: true },
      shot: true,
    },
    {
      id: "target-select",
      note: "대상 선택 — 동명 슬라임 2마리의 구분 숫자가 살아 있어야 한다",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "wait", ms: 800 },
      ],
      expect: { battleTextClean: true },
      shot: true,
    },
    {
      id: "result",
      note: "승리 결과 패널. resolved 국면이 되면 입력을 멈추고 패널을 기다린다",
      ops: [
        { kind: "pressUntil", key: "Enter", testid: "battle-result-panel", state: "present", maxPresses: 80, delayMs: 200 },
        { kind: "wait", ms: 600 },
      ],
      expect: { testidPresent: ["battle-result-panel"], battleTextClean: true },
      shot: true,
    },
  ],
};

export default battleTextScenario;
