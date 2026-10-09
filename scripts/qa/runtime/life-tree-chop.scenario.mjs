// 농장 스타터 나무 벌목 시나리오 (출하 플레이어 경로).
//
// 왜 필요한가: 모듈 테스트는 interactWithFarmPlot 을 직접 부른다. 실제 플레이어가 걸어가서
// 도끼를 들고 조사했을 때 나무가 사라지고 나무(item_wood)가 손에 들어오는지는 브라우저에서만
// 증명된다. 픽스처 JSON 을 굽던 생성기(농장 데모)는 2026-10-07 저작권 정리로 지웠다 — 지금 픽스처는 고정본이다.
//
// 경로는 test/farmingStarterTree.test.ts 가 통행/작물/이벤트/건물을 전부 검사한 저작 경로와
// 같다: (4,4) → 우로 (10,4) → 아래로 (10,11) → 좌로 (7,11), 그리고 좌향 조사.

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const lifeTreeChopScenario = {
  id: "life-tree-chop",
  projectFixture: "test/fixtures/life-tree-chop.project.json",
  seed: 81,
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 농장 시작 지점. 아직 나무도 기력 소모도 없다",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 81 },
      ],
      expect: {
        mapId: "map_farming_demo",
        x: 4,
        y: 4,
        inventory: { item_axe: 1, item_wood: 0 },
        energy: 100,
        lifeSkillXp: { life_foraging: 0 },
      },
      shot: true,
    },
    {
      id: "equip-axe",
      note: "도끼는 손 슬롯 4번이고 기본 장착은 없다 — 실제 숫자키로 든다(실측: 안 들면 괭이가 밭을 간다)",
      ops: [
        { kind: "key", key: "4" },
      ],
      expect: { mapId: "map_farming_demo", x: 4, y: 4, energy: 100 },
      shot: true,
    },
    {
      id: "walk-to-tree",
      note: "서쪽 우회로 (5,11)까지 이동 후 우향. 동쪽 x=10 열은 못 쓴다 — 닭 이벤트"
        + "(ev_farm_chicken, 저작 위치 11,6)가 돌아다니며 (10,6)을 막는다(실측: 매 실행 (10,5)에서 정지). "
        + "서쪽 x=3 열은 밭(4,5 6x4)과 겹치지 않고 배회 동물도 없다",
      ops: [
        {
          kind: "playerRoute",
          moves: [
            { kind: "move", dir: "left" },
            ...Array.from({ length: 7 }, () => ({ kind: "move", dir: "down" })),
            ...Array.from({ length: 2 }, () => ({ kind: "move", dir: "right" })),
          ],
        },
        { kind: "waitForPosition", mapId: "map_farming_demo", x: 5, y: 11, timeoutMs: 120_000 },
        { kind: "face", dir: "right" },
      ],
      expect: {
        mapId: "map_farming_demo",
        x: 5,
        y: 11,
        inventory: { item_wood: 0 },
        energy: 100,
      },
      shot: true,
    },
    {
      id: "chop-tree",
      note: "도끼를 든 채 조사 → 나무 1개, 기력 1 소모, 채집 XP 10. 영수증이 남을 때까지 "
        + "승인된 프레임 전송으로 정확히 진행한다(고정 sleep 금지). XP 는 세션 lifeSkills 가 "
        + "readState() 에 없어서(실측) 런타임이 스스로 적은 영수증의 xpAwarded 로 단정한다",
      ops: [
        { kind: "pauseFrames" },
        { kind: "action" },
        { kind: "stepFrames", frames: 12, deltaMs: 16 },
        { kind: "resumeFrames" },
      ],
      expect: {
        inventory: { item_wood: 1, item_axe: 1 },
        energy: 99,
        farmAttempt: {
          kind: "harvested",
          source: "tree",
          itemId: "item_wood",
          count: 1,
          x: 6,
          y: 11,
          energySpent: 1,
          xpAwarded: { foraging: 10 },
        },
      },
      shot: true,
    },
    {
      id: "repeat-conserves",
      note: "같은 칸을 다시 조사 → 더 얻지 않고 기력도 줄지 않는다(빈 칸 거절)",
      ops: [
        { kind: "pauseFrames" },
        { kind: "action" },
        { kind: "stepFrames", frames: 12, deltaMs: 16 },
        { kind: "resumeFrames" },
      ],
      expect: {
        inventory: { item_wood: 1, item_axe: 1 },
        energy: 99,
      },
      shot: true,
    },
  ],
};

export default lifeTreeChopScenario;
