// Run with a temporary U03 fixture, preferably the real editor's restored-A export.
// Every transfer result is observed before the real input; no elapsed-time waits.
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const u03Scenario = {
  id: "event-command-remediation-u03",
  beats: [
    {
      id: "g1-f20-boot",
      note: "G1-F20: Enter starts mapA at (1,2), below the authored host at (1,1).",
      ops: [{
        kind: "eventCommand", trigger: { kind: "key", key: "Enter" }, timeoutMs: 60_000,
        observe: [
          { source: "state", path: ["mapId"], equals: "mapA" },
          { source: "state", path: ["player"], equals: { x: 1, y: 2 } },
          { source: "state", path: ["running"], equals: false },
          { source: "state", path: ["inputEnabled"], equals: true },
        ],
      }],
      expect: { mapId: "mapA", x: 1, y: 2, playerSpriteTextureLoaded: true },
    },
    {
      id: "g1-f20-transfer-a",
      note: "G1-F20: Face host, then real Z must land on A/(2,3), never stale B; interpreter and fade finish.",
      ops: [
        { kind: "face", dir: "up" },
        {
          kind: "eventCommand", trigger: { kind: "key", key: "z" }, timeoutMs: 30_000,
          mutation: '[data-testid="runtime-state-json"]',
          observe: [
            { source: "state", path: ["mapId"], equals: "mapA" },
            { source: "state", path: ["player"], equals: { x: 2, y: 3 } },
            { source: "state", path: ["running"], equals: false },
            { source: "state", path: ["inputEnabled"], equals: true },
          ],
        },
      ],
      expect: { mapId: "mapA", x: 2, y: 3, playerSpriteTextureLoaded: true, testidAbsent: ["title-screen", "dialogue-box"] },
      shot: true,
    },
  ],
};
export default u03Scenario;
