// 포켓몬풍 완결 게임 「몬스터 테이머」 — 지역 맵들이 출하 player 에서 그려지는지 순간이동으로 돌며 본다.
// 픽스처: node_modules/.bin/vite-node --root . scripts/qa/runtime/pkmn-full-game-fixture.mts
// 실행:   npm run qa:runtime -- --scenario pkmn-full-game
// 도착 칸은 scarloxyPokemonWorld.ts PKMN_LINKS 의 도착 좌표(통행 가능 보장)를 쓴다.
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const pkmnFullGameScenario = {
  id: "pkmn-full-game",
  projectFixture: "verify-shots/runtime-qa/pkmn-full-game/fixture.json",
  beats: [
    { id: "title", note: "타이틀", expect: { testidPresent: ["title-screen"] } },
    {
      id: "start-town",
      note: "새 게임 → 새싹 마을",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, { kind: "seed", seed: 1 }],
      expect: { mapId: "map_pkmn_town", testidAbsent: ["title-screen"], playerSpriteTextureLoaded: true },
      shot: true,
    },
    {
      id: "route-1-sand",
      note: "초원 1번 길 남서 모래 패치(0~2/30~32) — 물 쿼터로 합성되지 않고 모래로 보여야 한다",
      ops: [{ kind: "teleport", mapId: "map_pkmn_route", x: 7, y: 19 }, { kind: "waitForPosition", mapId: "map_pkmn_route", x: 7, y: 19 }],
      expect: { mapId: "map_pkmn_route", x: 7, y: 19, playerSpriteTextureLoaded: true },
      shot: true,
    },
    {
      id: "moss-town",
      note: "이끼 마을 북쪽 입구 — 센터·체육관 건물, 경비원",
      ops: [{ kind: "teleport", mapId: "map_pkmn_moss_town", x: 14, y: 1 }, { kind: "waitForPosition", mapId: "map_pkmn_moss_town", x: 14, y: 1 }],
      expect: { mapId: "map_pkmn_moss_town", x: 14, y: 1, playerSpriteTextureLoaded: true },
      shot: true,
    },
    {
      id: "moss-center",
      note: "이끼 회복 센터 — 몬스터 실내 칩셋",
      ops: [{ kind: "teleport", mapId: "map_pkmn_moss_center", x: 7, y: 8 }, { kind: "waitForPosition", mapId: "map_pkmn_moss_center", x: 7, y: 8 }],
      expect: { mapId: "map_pkmn_moss_center", x: 7, y: 8, playerSpriteTextureLoaded: true },
      shot: true,
    },
    {
      id: "grass-gym",
      note: "풀 체육관 — 차단기 퍼즐, 관장 단상",
      ops: [{ kind: "teleport", mapId: "map_pkmn_grass_gym", x: 6, y: 13 }, { kind: "waitForPosition", mapId: "map_pkmn_grass_gym", x: 6, y: 13 }],
      expect: { mapId: "map_pkmn_grass_gym", x: 6, y: 13, playerSpriteTextureLoaded: true },
      shot: true,
    },
    {
      id: "cave-1",
      note: "바위굴 1층 — 47칸 블롭 벽, 자갈 조우 구역",
      ops: [{ kind: "teleport", mapId: "map_pkmn_cave_1", x: 1, y: 12 }, { kind: "waitForPosition", mapId: "map_pkmn_cave_1", x: 1, y: 12 }],
      expect: { mapId: "map_pkmn_cave_1", x: 1, y: 12, playerSpriteTextureLoaded: true },
      shot: true,
    },
    {
      id: "wave-town",
      note: "파도 마을 — 해변·부두",
      ops: [{ kind: "teleport", mapId: "map_pkmn_wave_town", x: 1, y: 10 }, { kind: "waitForPosition", mapId: "map_pkmn_wave_town", x: 1, y: 10 }],
      expect: { mapId: "map_pkmn_wave_town", x: 1, y: 10, playerSpriteTextureLoaded: true },
      shot: true,
    },
    {
      id: "water-gym",
      note: "물 체육관",
      ops: [{ kind: "teleport", mapId: "map_pkmn_water_gym", x: 6, y: 13 }, { kind: "waitForPosition", mapId: "map_pkmn_water_gym", x: 6, y: 13 }],
      expect: { mapId: "map_pkmn_water_gym", x: 6, y: 13, playerSpriteTextureLoaded: true },
      shot: true,
    },
    {
      id: "route-3",
      note: "3번 도로 — 풀숲",
      ops: [{ kind: "teleport", mapId: "map_pkmn_route_3", x: 12, y: 1 }, { kind: "waitForPosition", mapId: "map_pkmn_route_3", x: 12, y: 1 }],
      expect: { mapId: "map_pkmn_route_3", x: 12, y: 1, playerSpriteTextureLoaded: true },
      shot: true,
    },
    {
      id: "ember-town",
      note: "잿불 마을",
      ops: [{ kind: "teleport", mapId: "map_pkmn_ember_town", x: 14, y: 1 }, { kind: "waitForPosition", mapId: "map_pkmn_ember_town", x: 14, y: 1 }],
      expect: { mapId: "map_pkmn_ember_town", x: 14, y: 1, playerSpriteTextureLoaded: true },
      shot: true,
    },
    {
      id: "fire-gym",
      note: "불 체육관",
      ops: [{ kind: "teleport", mapId: "map_pkmn_fire_gym", x: 6, y: 13 }, { kind: "waitForPosition", mapId: "map_pkmn_fire_gym", x: 6, y: 13 }],
      expect: { mapId: "map_pkmn_fire_gym", x: 6, y: 13, playerSpriteTextureLoaded: true },
      shot: true,
    },
    {
      id: "victory-road",
      note: "챔피언 로드 입구",
      ops: [{ kind: "teleport", mapId: "map_pkmn_victory_road", x: 14, y: 24 }, { kind: "waitForPosition", mapId: "map_pkmn_victory_road", x: 14, y: 24 }],
      expect: { mapId: "map_pkmn_victory_road", x: 14, y: 24, playerSpriteTextureLoaded: true },
      shot: true,
    },
    {
      id: "champion-tower",
      note: "챔피언의 탑 — 챔피언 세라",
      ops: [{ kind: "teleport", mapId: "map_pkmn_champion_tower", x: 7, y: 16 }, { kind: "waitForPosition", mapId: "map_pkmn_champion_tower", x: 7, y: 16 }],
      expect: { mapId: "map_pkmn_champion_tower", x: 7, y: 16, playerSpriteTextureLoaded: true },
      shot: true,
    },
  ],
};

