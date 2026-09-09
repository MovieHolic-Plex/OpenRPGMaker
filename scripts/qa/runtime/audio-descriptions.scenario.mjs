/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const audioDescriptionsScenario = {
  id: "audio-descriptions",
  projectFixture: "test/fixtures/projects/audio-descriptions.generated.json",
  beats: [
    {
      id: "title",
      expect: { testidPresent: ["title-screen"] },
      shot: true,
    },
    {
      id: "starter-bgm-playing",
      ops: [{
        kind: "audioAction",
        action: "start",
        resourceId: "cc0-bgm-rtp-fld-003",
        sourcePath: "/assets/cc0/audio/catalog/rtp-fld-003-amber-meadow-end-final_f5dafd12.mp3",
        loop: true,
        timeoutMs: 30000,
      }],
      expect: {
        mapId: "map_blank_start",
        x: 3,
        y: 3,
        audioObservedIncludes: ["cc0-bgm-rtp-fld-003"],
        testidAbsent: ["title-screen"],
        playerSpriteTextureLoaded: true,
      },
      shot: true,
    },
    {
      id: "local-se-playing",
      ops: [{
        kind: "audioAction",
        action: "interact",
        resourceId: "cc0-sound-ui-confirm",
        sourcePath: "/assets/cc0/audio/ui-confirm.wav",
        loop: false,
        timeoutMs: 15000,
      }],
      expect: { audioObservedIncludes: ["cc0-sound-ui-confirm"], x: 3, y: 3 },
      shot: true,
    },
  ],
};
