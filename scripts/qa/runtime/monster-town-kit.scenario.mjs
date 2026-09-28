// 몬스터 마을 부품 칩셋이 출하 player 에서 그려지는지 본다.
// 픽스처: node_modules/.bin/vite-node --root . scripts/qa/runtime/monster-town-kit-fixture.mts
// 실행:   node scripts/runtime-qa.mjs --scenario monster-town-kit
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const monsterTownKitScenario = {
  id: "monster-town-kit",
  projectFixture: "verify-shots/runtime-qa/monster-town-kit/fixture.json",
  beats: [
    { id: "title", note: "타이틀", expect: { testidPresent: ["title-screen"] } },
    {
      id: "route-kit",
      note: "새 게임 → 초원 1번 길 가운데. 조우 풀숲·턱·동굴 입구(480~ 칸)가 보인다",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, { kind: "seed", seed: 1 }],
      expect: { mapId: "map_pkmn_route", x: 15, y: 10, playerSpriteTextureLoaded: true, testidAbsent: ["title-screen"] },
      shot: true,
    },
  ],
};

