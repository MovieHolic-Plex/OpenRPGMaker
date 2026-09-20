// 팔로워(몬스터 뒤따르기) 시각 QA — 포켓몬 데모 맵에서 스타터를 지급받고 걷는다.
//
// 픽스처(test/fixtures/projects/follower-qa-pokemon.json)는 8MB 라 커밋하지 않는다 —
// 먼저 생성: npx vite-node --script scripts/qa/runtime/build-follower-qa-fixture.mts
//   createScarloxyPokemonDemoProject 기준, 시작 map_pkmn_town (13,12).
//   autorun ev_follower_qa_give 가 giveMonster 1회 후 셀프스위치 A 로 닫힌다
//   → 세션 monsterParty 1, 필드 팔로워 열차 1.
//
// 증명 전략: hold(right) 로 같은 열을 가로질러 걷는다. 팔로워는 궤적 승계로
// 플레이어 직전 칸을 따라온다. 걸음 중 샷을 연속 캡처해 GIF 로 엮는다.
/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export const followerChaseScenario = {
  id: "follower-chase",
  projectFixture: "test/fixtures/projects/follower-qa-pokemon.json",
  viewport: { width: 640, height: 480 },
  beats: [
    {
      id: "boot",
      note: "새 게임 → 스타터 지급 autorun → 팔로워 1(ownedMonsterCounts 축으로 단정)",
      ops: [{ kind: "key", key: "Enter" }, { kind: "waitForRuntime" }, { kind: "seed", seed: 11 }],
      expect: { mapId: "map_pkmn_town", x: 13, y: 12, ownedMonsterCounts: { species_scarloxy_sparchu: 1 } },
      shot: true,
    },
    {
      id: "walk-right",
      note: "오른쪽으로 6칸 걷기(팔로워 궤적 승계)",
      ops: [{ kind: "hold", dir: "right", ms: 1600 }],
      expect: { xNot: 13 },
      shot: true,
    },
    {
      id: "walk-down",
      note: "아래로 4칸 걷기(방향 전환 후에도 궤적 유지)",
      ops: [{ kind: "hold", dir: "down", ms: 1100 }],
      expect: { yNot: 12 },
      shot: true,
    },
  ],
};

export default followerChaseScenario;
