// Run with --project pointing to the real saved/reloaded QA world.
// This checks shipped-player boot; full walking evidence is recorded separately.
export default {
  id: "live-world-start",
  beats: [
    {
      id: "title",
      note: "The actual authored project reaches the shipped player title.",
      expect: { testidPresent: ["title-screen"] },
      shot: true,
    },
    {
      id: "authored-start",
      note: "Start at the authored harbor position without teleporting.",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }],
      expect: {
        mapId: "map_blank_start",
        x: 24,
        y: 118,
        playerSpriteResourceNonEmpty: true,
        playerSpriteTextureLoaded: true,
        testidAbsent: ["title-screen", "dialogue-box"],
      },
      shot: true,
    },
  ],
};
