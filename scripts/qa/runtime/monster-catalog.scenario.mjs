/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id: "monster-catalog",
  projectFixture: "output/evidence/monster-catalog/runtime-project.json",
  beats: [
    {
      id: "title",
      note: "Load the exported, remotely saved monster QA project.",
      expect: { testidPresent: ["title-screen"] },
    },
    {
      id: "goblin-battle",
      note: "The real saved goblin enemy appears through player.html, without editor metadata or shell.",
      ops: [
        { kind: "key", key: "Enter" },
        { kind: "waitForRuntime" },
        { kind: "waitFor", testid: "battle-scene", state: "present" },
        { kind: "waitFor", testid: "actor-command-attack", state: "present", timeoutMs: 30000 },
      ],
      expect: {
        testidPresent: ["battle-scene", "battle-party", "actor-command-attack"],
        battlerGeometry: { minEnemies: 1 },
      },
      shot: true,
    },
  ],
};
