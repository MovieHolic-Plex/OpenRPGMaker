// 서 있는 필드 적(place_field_enemy stationary)을 마주 보고 조사(Enter)하면 부딪힌 것과 같이 전투가 열린다.
// 픽스처: scripts/qa/runtime/field-foe-action-fixture.mts (시작 = 적 바로 아래 칸, 위를 본다)
//   node scripts/runtime-qa.mjs --scenario field-foe-action --project /tmp/field-foe.json
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const fieldFoeActionScenario = {
  id: "field-foe-action",
  beats: [
    {
      id: "facing-foe",
      note: "새 게임 → 필드 적 바로 아래 칸, 위(적)를 본다. 아직 전투 없음",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitFor", testid: "title-screen", state: "absent" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 1 },
        { kind: "face", dir: "up" },
      ],
      expect: { testidAbsent: ["battle-scene"] },
      shot: true,
    },
    {
      id: "action-opens-battle",
      note: "조사 단추 한 번 → 전투 화면(판정점). 고치기 전에는 아무 일도 없었다(omo-fr-t terra r3 판정)",
      ops: [
        { kind: "action" },
        { kind: "waitFor", testid: "battle-scene", state: "present", timeoutMs: 15_000 },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 30_000 },
      ],
      expect: { testidPresent: ["battle-scene", "actor-command-attack"] },
      shot: true,
    },
  ],
};
