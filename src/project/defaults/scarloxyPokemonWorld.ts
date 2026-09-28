// 포켓몬풍 완결 게임 「몬스터 테이머」의 뼈대 계약 — 맵 id·연결 좌표·스토리 스위치·파일 소유.
//
// 여러 작업이 맵을 나눠 만든다. 서로의 파일을 고치지 않고 이 계약만 본다:
//   - 맵 id 와 연결(문·출구) 좌표는 여기 상수만 쓴다. 한쪽 맵이 출구를 옮기면 여기부터 고친다.
//   - 진행 스위치·변수 id 는 여기 PKMN_FLAGS 만 쓴다.
//   - 각 파일은 GameMap[] 과 필요한 DB 레코드(적·무리·기술)를 돌려주는 함수를 낸다.
//     조립은 scarloxyPokemonDemoGame.ts 의 createScarloxyPokemonDemoMaps / configure 가 한다.
//
// 진행(한 판 2~4시간 목표):
//   새싹 마을(집·연구소·센터) → 1번 도로 → 이끼 마을 + 풀 체육관(배지 1)
//   → 바위굴(동굴 2층) → 파도 마을 + 해변 + 물 체육관(배지 2)
//   → 3번 도로 → 잿불 마을 + 불 체육관(배지 3) → 챔피언 로드(동굴) → 챔피언의 탑 → 엔딩
//
// 관문: 1번 도로 끝 이끼 마을 → 바위굴 입구는 배지 1 이 없으면 경비원이 막는다.
//       파도 마을 → 3번 도로 는 배지 2, 챔피언 로드 입구는 배지 3.

export const PKMN_MAPS = {
  // 기존(ids 고정 — 테스트가 참조한다)
  town: "map_pkmn_town", // 새싹 마을 26×18, scarloxy_chipset_monster_town_kit
  route1: "map_pkmn_route", // 1번 도로 30×24
  lab: "map_pkmn_lab",
  home: "map_pkmn_home",
  center: "map_pkmn_center",
  // 새 맵
  mossTown: "map_pkmn_moss_town", // 이끼 마을 (town_kit)
  mossCenter: "map_pkmn_moss_center", // 회복 센터+상점 (monster_interior)
  grassGym: "map_pkmn_grass_gym", // 풀 체육관 (gym_coast)
  cave1: "map_pkmn_cave_1", // 바위굴 1층 (monster_cave)
  cave2: "map_pkmn_cave_2", // 바위굴 2층 (monster_cave)
  waveTown: "map_pkmn_wave_town", // 파도 마을 + 해변·부두 (gym_coast)
  waveCenter: "map_pkmn_wave_center",
  waterGym: "map_pkmn_water_gym",
  route3: "map_pkmn_route_3", // 3번 도로 (town_kit)
  emberTown: "map_pkmn_ember_town", // 잿불 마을 (town_kit)
  emberCenter: "map_pkmn_ember_center",
  fireGym: "map_pkmn_fire_gym",
  victoryRoad: "map_pkmn_victory_road", // 챔피언 로드 (monster_cave)
  championTower: "map_pkmn_champion_tower", // 챔피언의 탑 (monster_interior 또는 gym_coast 중립 바닥)
} as const;

/** 진행 스위치·변수. 한 번 켜지면 되돌리지 않는다. */
export const PKMN_FLAGS = {
  gotStarter: "sw_pkmn_got_starter",
  badge1: "sw_pkmn_badge_grass",
  badge2: "sw_pkmn_badge_water",
  badge3: "sw_pkmn_badge_fire",
  rival1: "sw_pkmn_rival_1", // 1번 도로 라이벌전 (기존 이벤트는 셀프 스위치 — 새 라이벌전만 이 스위치 사용)
  rival2: "sw_pkmn_rival_2", // 파도 마을 부두
  rival3: "sw_pkmn_rival_3", // 챔피언 로드 끝
  champion: "sw_pkmn_champion_beaten",
  badgeCount: "var_pkmn_badges",
} as const;

/**
 * 맵 사이 출입구. from 맵의 (x,y) 칸에 transfer 이벤트, to 맵의 (toX,toY) 로 도착한다.
 * 양쪽 맵을 만드는 작업이 같은 좌표를 쓴다 — 도착 칸은 통행 가능해야 하고 출입구 칸과 겹치지 않는다.
 * width/height 는 각 맵 크기 약속이다(출구 좌표가 맵 안에 있어야 하므로).
 */
export const PKMN_MAP_SIZES: Readonly<Record<keyof typeof PKMN_MAPS, readonly [number, number]>> = {
  town: [26, 18], route1: [30, 24], lab: [15, 12], home: [11, 9], center: [13, 10],
  mossTown: [28, 20], mossCenter: [15, 11], grassGym: [14, 15],
  cave1: [30, 24], cave2: [26, 20],
  waveTown: [32, 22], waveCenter: [15, 11], waterGym: [14, 15],
  route3: [24, 34], emberTown: [28, 20], emberCenter: [15, 11], fireGym: [14, 15],
  victoryRoad: [28, 26], championTower: [15, 18],
};

export type PkmnLink = {
  readonly from: keyof typeof PKMN_MAPS; readonly x: number; readonly y: number;
  readonly to: keyof typeof PKMN_MAPS; readonly toX: number; readonly toY: number;
  readonly name: string;
};

/**
 * 맵 사이 길(양방향은 두 줄). 1번 도로 남쪽 끝 (15,23) → 이끼 마을 북쪽 입구.
 * 기존 새싹 마을 ↔ 1번 도로 연결(13,17 ↔ 15,1)은 scarloxyPokemonDemoGame.ts 가 이미 갖고 있다.
 */
export const PKMN_LINKS: readonly PkmnLink[] = [
  { from: "route1", x: 15, y: 23, to: "mossTown", toX: 14, toY: 1, name: "이끼 마을로" },
  { from: "mossTown", x: 14, y: 0, to: "route1", toX: 15, toY: 22, name: "1번 도로로" },
  { from: "mossTown", x: 27, y: 10, to: "cave1", toX: 1, toY: 12, name: "바위굴로" },
  { from: "cave1", x: 0, y: 12, to: "mossTown", toX: 26, toY: 10, name: "이끼 마을로" },
  { from: "cave1", x: 29, y: 12, to: "waveTown", toX: 1, toY: 10, name: "파도 마을로" },
  { from: "waveTown", x: 0, y: 10, to: "cave1", toX: 28, toY: 12, name: "바위굴로" },
  { from: "waveTown", x: 16, y: 21, to: "route3", toX: 12, toY: 1, name: "3번 도로로" },
  { from: "route3", x: 12, y: 0, to: "waveTown", toX: 16, toY: 20, name: "파도 마을로" },
  { from: "route3", x: 12, y: 33, to: "emberTown", toX: 14, toY: 1, name: "잿불 마을로" },
  { from: "emberTown", x: 14, y: 0, to: "route3", toX: 12, toY: 32, name: "3번 도로로" },
  { from: "emberTown", x: 14, y: 19, to: "victoryRoad", toX: 14, toY: 24, name: "챔피언 로드로" },
  { from: "victoryRoad", x: 14, y: 25, to: "emberTown", toX: 14, toY: 18, name: "잿불 마을로" },
  { from: "victoryRoad", x: 14, y: 0, to: "championTower", toX: 7, toY: 16, name: "챔피언의 탑으로" },
  { from: "championTower", x: 7, y: 17, to: "victoryRoad", toX: 14, toY: 1, name: "챔피언 로드로" },
];

/** 관문: 이 스위치가 없으면 from 칸 앞을 막는 경비/나무 이벤트를 둔다. */
export const PKMN_GATES = [
  { link: "mossTown->cave1", requires: PKMN_FLAGS.badge1, blocker: "경비원" },
  { link: "waveTown->route3", requires: PKMN_FLAGS.badge2, blocker: "경비원" },
  { link: "emberTown->victoryRoad", requires: PKMN_FLAGS.badge3, blocker: "경비원" },
] as const;

/** 파일 소유 — 한 작업이 한 파일 묶음만 고친다. */
export const PKMN_FILE_OWNERS = {
  "scarloxyPokemonRegionA.ts": ["mossTown", "mossCenter", "grassGym", "cave1", "cave2"],
  "scarloxyPokemonRegionB.ts": ["waveTown", "waveCenter", "waterGym", "route3", "emberTown", "emberCenter", "fireGym", "victoryRoad", "championTower"],
} as const;

