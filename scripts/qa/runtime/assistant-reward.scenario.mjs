// Requires --project pointing to the actual remote-reloaded AI-authored project.
// Fixed ev_reward_researcher at (10,7), player spawn (10,8); no teleport or reward injection.
const position = { mapId: "map_blank_start", x: 10, y: 8 };
const rewards = {
  inventoryCounts: { item_capture_orb: 5 },
  ownedMonsterCounts: { species_leafling: 1 },
};
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaOp[]} */
const dialogue = [
  { kind: "face", dir: "up" },
  { kind: "action" },
  { kind: "waitFor", testid: "dialogue-box", state: "present" },
  { kind: "pressUntil", key: "Enter", testid: "dialogue-box", state: "absent", timeoutMs: 15000 },
];

/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "assistant-reward",
  beats: [
    {
      id: "title",
      expect: { testidPresent: ["title-screen"] },
      shot: true,
    },
    {
      id: "start",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }],
      expect: {
        ...position,
        inventoryCounts: { item_capture_orb: 0 },
        ownedMonsterCounts: { species_leafling: 0 },
        testidAbsent: ["title-screen", "dialogue-box"],
      },
      shot: true,
    },
    {
      id: "first",
      note: "Direct dialogue grants five capture orbs and one leafling.",
      ops: dialogue,
      expect: { ...position, ...rewards, testidAbsent: ["dialogue-box"] },
      shot: true,
    },
    {
      id: "repeat",
      note: "Repeated dialogue must not grant either reward again.",
      ops: dialogue,
      expect: { ...position, ...rewards, testidAbsent: ["dialogue-box"] },
      shot: true,
    },
  ],
};
