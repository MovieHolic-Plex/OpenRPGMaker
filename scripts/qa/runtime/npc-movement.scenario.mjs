// NPC 자율 이동 시나리오 — place_npc 아키타입 추론의 런타임 증거.
//
// 픽스처(test/fixtures/projects/npc-movement-qa.json)는 smoke 베이스(editor-authored-demo-v3):
//   시작 map_lantern_village (14,18). 기존 NPC 5명 전부 random + roam-kid(12,17)/roam-dog(16,19) 추가.
//
// 증명 전략:
//   1. 고정 시드(seed 7)로 부팅 → 플레이어가 시작점(14,18)에 서 있음을 단정한다.
//   2. stepFrames로 240프레임 진행 → 플레이어는 그대로인데 NPC만 움직인다.
//      하네스 expect에 NPC 좌표 축이 없으므로, 두 샷의 NPC 배치 차이 + probe의
//      __oprnCharacterSprites 직접 판정(results.json)이 증거다.
//      probe: scripts/qa/runtime/npc-movement.probe.mjs (QA_OUT_DIR 분리 실행).
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const npcMovementScenario = {
  id: "npc-movement",
  projectFixture: "test/fixtures/projects/npc-movement-qa.json",
  beats: [
    {
      id: "field-start",
      note: "새 게임 → 등대 마을 시작 지점(14,18)",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitForRuntime" },
        { kind: "seed", seed: 7 },
      ],
      expect: {
        mapId: "map_lantern_village",
        x: 14,
        y: 18,
        testidAbsent: ["title-screen", "dialogue-box"],
      },
      shot: true,
    },
    {
      id: "roam-frames",
      note: "240프레임 진행 → 플레이어 고정, 배회 NPC만 이동(두 샷 비교)",
      ops: [
        { kind: "pauseFrames" },
        { kind: "stepFrames", frames: 240, deltaMs: 50 },
        { kind: "resumeFrames" },
      ],
      expect: {
        mapId: "map_lantern_village",
        x: 14,
        y: 18,
      },
      shot: true,
    },
  ],
};

export default npcMovementScenario;
