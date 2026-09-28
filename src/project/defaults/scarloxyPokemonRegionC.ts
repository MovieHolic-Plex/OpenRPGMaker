// 포켓몬풍 데모 「몬스터 테이머」 C 지역 — 잿불 마을 · 잿불 회복 센터 · 불 체육관 · 챔피언 로드 · 챔피언의 탑.
//
// 계약은 scarloxyPokemonWorld.ts(PKMN_MAPS·PKMN_MAP_SIZES·PKMN_LINKS·PKMN_FLAGS·PKMN_GATES)다.
// 칩셋 규칙·헬퍼는 A 지역(scarloxyPokemonRegionA.ts)과 같다 — 여기 id 는 전부 pkmn_c 접두어.
//
//   - 잿불 마을  town_kit 28×20 : 1층 잔디 124, 건물·소품 3층 블록 통째로. 남쪽 울타리 한 칸 틈에 배지 3 관문 경비원.
//   - 센터       monster_interior 15×11 : 참고문서 센터 예제 배열(라벤더 벽) + 계산대.
//   - 불 체육관  gym_coast 14×15 : 참고문서 풀 체육관 예제의 fire 변형(바닥 484/485, 벽 513/543, 단상·조각상·화로) + 차단기 퍼즐.
//   - 챔피언 로드 monster_cave 28×26 : 흙 → 블롭 → 절벽 앞면 → 계단 → 장식 → 소품. 북쪽 외길 끝에 라이벌 3.
//   - 챔피언의 탑 gym_coast 15×18 : 중립 바닥 480/481, 세 속성 벽·조각상. 챔피언전 → 엔딩.
//
// 레벨 곡선: 불 체육관 트레이너 19~20, 관장 20~22, 챔피언 로드 야생 20~26 · 트레이너 23~25,
// 라이벌 3 26~28(최종 진화), 챔피언 28~32.

import type { Command, EventPage, GameEvent, GameMap, Project } from "../types";
import type { EndingDef, Rect } from "../types/project";
import { DEFAULT_SKILL_ID } from "./constants";
import { singleNodeTree } from "./defaultMaps";
import { SCARLOXY_CAST } from "./scarloxyCast";
import { castLines } from "./scarloxyCastEvents";
import { G, NO_GRAPHIC, PASSIVE_MOVEMENT, demoEnemy, demoTroop, event, page, setUpper, stampLower, stampUpper, transferEvent } from "./scarloxyDemoGame";
import { SCARLOXY_EXTRA_SPECIES_SEEDS } from "./scarloxyExtraSpecies";
import {
  K,
  LEADER_HP_MULTIPLIER,
  PKMN_A_SUPER_ORB_ITEM_ID,
  TEAL_TREE_SMALL,
  TRAINER_HP_MULTIPLIER,
  WILD_HP_MULTIPLIER,
  blankMap,
  castTalker,
  caveMap,
  encounterTable,
  facingGraphic,
  fenceRow,
  scaledStats,
  signEvent,
  sparkleItem,
  trainerEvent,
  whiteoutCommands,
  type BaseStats,
  type CaveSpec,
} from "./scarloxyPokemonRegionA";
import { PKMN_FLAGS, PKMN_MAPS } from "./scarloxyPokemonWorld";

const TOWN_TILESET_ID = "scarloxy_chipset_monster_town_kit";
const INTERIOR_TILESET_ID = "scarloxy_chipset_monster_interior";
const GYM_TILESET_ID = "scarloxy_chipset_monster_gym_coast";

/** 코어가 스타터를 고를 때 적는 변수(scarloxyPokemonDemoGame.ts PKMN_STARTER_VARIABLE). 순환 import 를 피해 값만 쓴다. 1 불 · 2 물 · 3 풀. */
const STARTER_VARIABLE_ID = "var_pkmn_starter";
const CAPTURE_ORB_ITEM_ID = "item_capture_orb";

// --- 내부 출입구(계약 밖, 이 파일이 소유) --------------------------------------------
const EMBER_DOORS = {
  center: { x: 5, y: 8 }, // hospital 6×6 @ (3,2) — 문 (5..6,7), 접근칸 (5,8)
  gym: { x: 20, y: 7 }, // research-lab 8×6 @ (17,1) — 문 (20..21,6), 접근칸 (20,7)
} as const;
const CENTER_ARRIVAL = { x: 7, y: 8 } as const;
const GYM_ARRIVAL = { x: 6, y: 13 } as const;
const EMBER_WHITEOUT = { mapId: PKMN_MAPS.emberCenter, ...CENTER_ARRIVAL } as const;
const EMBER_SHOP_ITEM_IDS = [CAPTURE_ORB_ITEM_ID, PKMN_A_SUPER_ORB_ITEM_ID, "item_potion", "item_hi_potion", "item_gen_potion_large", "item_antidote", "item_wake_herb", "item_ether"] as const;

// --- 몬스터 레코드 -------------------------------------------------------------------

/** 데모 기존 종(scarloxyPokemonDemoGame.ts SPECIES_SEEDS)의 능력치와 이 지역에서 쓰는 기술. */
const BASE_SPECIES: Readonly<Record<string, { name: string; stats: BaseStats; skills: readonly string[] }>> = {
  emberkit: { name: "엠버킷", stats: { maxHp: 18, maxMp: 8, attack: 12, defense: 8, mind: 10, agility: 14 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_ember", "skill_scarloxy_burst"] },
  cindrill: { name: "신드릴", stats: { maxHp: 30, maxMp: 10, attack: 15, defense: 11, mind: 12, agility: 14 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_punch", "skill_scarloxy_ember"] },
  charmadillo: { name: "차마딜로", stats: { maxHp: 46, maxMp: 12, attack: 20, defense: 18, mind: 13, agility: 12 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_ember", "skill_pkmn_rock", "skill_scarloxy_burst"] },
  finiette: { name: "피니에트", stats: { maxHp: 48, maxMp: 14, attack: 18, defense: 15, mind: 19, agility: 16 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_splash", "skill_scarloxy_ice", "skill_scarloxy_blizzard"] },
  ivieron: { name: "아이비론", stats: { maxHp: 46, maxMp: 12, attack: 17, defense: 18, mind: 14, agility: 12 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_leaf", "skill_scarloxy_venom", "skill_scarloxy_sludge"] },
  pluma: { name: "플루마", stats: { maxHp: 34, maxMp: 9, attack: 14, defense: 10, mind: 11, agility: 20 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_wing", "skill_scarloxy_quick"] },
  friolera: { name: "프리올레라", stats: { maxHp: 34, maxMp: 12, attack: 12, defense: 11, mind: 15, agility: 11 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_ice", "skill_scarloxy_blizzard"] },
  draem: { name: "드림", stats: { maxHp: 24, maxMp: 10, attack: 10, defense: 9, mind: 14, agility: 10 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_shadow", "skill_scarloxy_mind"] },
  atrox: { name: "아트록스", stats: { maxHp: 60, maxMp: 16, attack: 19, defense: 14, mind: 15, agility: 14 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_ember", "skill_scarloxy_burst", "skill_scarloxy_dragon"] },
};

function speciesInfo(key: string, level: number): { name: string; stats: BaseStats; skills: string[] } {
  const base = BASE_SPECIES[key];
  if (base) return { name: base.name, stats: base.stats, skills: [...base.skills] };
  const seed = SCARLOXY_EXTRA_SPECIES_SEEDS.find((entry) => entry.key === key);
  if (!seed) throw new Error(`C 지역: 종 ${key} 가 없습니다.`);
  const learned = seed.moves.filter((move) => move.level <= level).map((move) => move.skillId);
  return { name: seed.name, stats: seed.stats, skills: [DEFAULT_SKILL_ID, ...learned.slice(-3)] };
}

type Rank = "wild" | "trainer" | "boss";
type EnemySpec = { readonly key: string; readonly level: number; readonly rank?: Rank; readonly label?: string };

const RANK_HP: Readonly<Record<Rank, number>> = { wild: WILD_HP_MULTIPLIER, trainer: TRAINER_HP_MULTIPLIER, boss: LEADER_HP_MULTIPLIER };

function enemyId(spec: EnemySpec): string {
  const rank = spec.rank ?? "wild";
  return `enemy_pkmn_c_${rank === "wild" ? "" : rank + "_"}${spec.key}_${spec.level}`;
}

function enemyRecord(spec: EnemySpec) {
  const rank = spec.rank ?? "wild";
  const info = speciesInfo(spec.key, spec.level);
  const exp = Math.round((2 + spec.level * 1.4) * (rank === "wild" ? 1 : rank === "trainer" ? 1.5 : 2));
  return demoEnemy(enemyId(spec), spec.label ?? info.name, `scarloxy-monster-${spec.key}`, scaledStats(info.stats, spec.level, RANK_HP[rank]), {
    exp,
    gold: spec.level * (rank === "wild" ? 1 : rank === "trainer" ? 4 : 8),
  }, info.skills, { level: spec.level, speciesId: `species_scarloxy_${spec.key}` });
}

const CAVE_BACKDROP = "scarloxy-backdrop-cave";
const GYM_BACKDROP = "scarloxy-backdrop-gym";

type TroopSpec = { readonly id: string; readonly name: string; readonly backdrop: string; readonly members: readonly EnemySpec[]; readonly trainer?: boolean };

const WILD_VICTORY: readonly TroopSpec[] = [
  { id: "troop_pkmn_c_vr_bouldurr", name: "챔피언 로드의 바위곰", backdrop: CAVE_BACKDROP, members: [{ key: "bouldurr", level: 24 }] },
  { id: "troop_pkmn_c_vr_lanterghast", name: "챔피언 로드의 등롱귀", backdrop: CAVE_BACKDROP, members: [{ key: "lanterghast", level: 23 }] },
  { id: "troop_pkmn_c_vr_voltail", name: "챔피언 로드의 번개꼬리", backdrop: CAVE_BACKDROP, members: [{ key: "voltail", level: 22 }] },
  { id: "troop_pkmn_c_vr_sandscorp", name: "챔피언 로드의 모래전갈", backdrop: CAVE_BACKDROP, members: [{ key: "sandscorp", level: 20 }] },
  { id: "troop_pkmn_c_vr_hornbeet", name: "챔피언 로드의 뿔장수", backdrop: CAVE_BACKDROP, members: [{ key: "hornbeet", level: 21 }] },
  { id: "troop_pkmn_c_vr_draem", name: "떠도는 드림", backdrop: CAVE_BACKDROP, members: [{ key: "draem", level: 26 }] },
];
const VICTORY_WEIGHTS: Readonly<Record<string, number>> = {
  troop_pkmn_c_vr_bouldurr: 3, troop_pkmn_c_vr_lanterghast: 3, troop_pkmn_c_vr_voltail: 2,
  troop_pkmn_c_vr_sandscorp: 3, troop_pkmn_c_vr_hornbeet: 2, troop_pkmn_c_vr_draem: 1,
};

export const PKMN_C_TROOPS = {
  gymA: "troop_pkmn_c_gym_trainer_a",
  gymB: "troop_pkmn_c_gym_trainer_b",
  leader: "troop_pkmn_c_fire_leader",
  vrHiker: "troop_pkmn_c_vr_hiker",
  vrCamper: "troop_pkmn_c_vr_camper",
  vrGentleman: "troop_pkmn_c_vr_gentleman",
  /** 라이벌 3 — 주인공 스타터의 약점 타입 최종 진화를 앞세운다. */
  rivalWater: "troop_pkmn_c_rival3_water",
  rivalGrass: "troop_pkmn_c_rival3_grass",
  rivalFire: "troop_pkmn_c_rival3_fire",
  champion: "troop_pkmn_c_champion",
} as const;

const RIVAL_LABEL = "라이벌의";
const rivalMember = (key: string, level: number): EnemySpec => ({ key, level, rank: "boss", label: `${RIVAL_LABEL} ${speciesInfo(key, level).name}` });
const championMember = (key: string, level: number): EnemySpec => ({ key, level, rank: "boss", label: `챔피언의 ${speciesInfo(key, level).name}` });

const TRAINER_TROOPS: readonly TroopSpec[] = [
  { id: PKMN_C_TROOPS.gymA, name: "체육관 트레이너 불꽃", backdrop: GYM_BACKDROP, trainer: true, members: [{ key: "emberkit", level: 19, rank: "trainer" }, { key: "cindrill", level: 20, rank: "trainer" }] },
  { id: PKMN_C_TROOPS.gymB, name: "체육관 트레이너 숯돌", backdrop: GYM_BACKDROP, trainer: true, members: [{ key: "lanterghast", level: 20, rank: "trainer" }] },
  { id: PKMN_C_TROOPS.leader, name: "잿불 체육관 관장 화린", backdrop: GYM_BACKDROP, trainer: true, members: [
    { key: "emberkit", level: 20, rank: "boss", label: "관장의 엠버킷" },
    { key: "lanterghast", level: 21, rank: "boss", label: "관장의 등롱귀" },
    { key: "charmadillo", level: 22, rank: "boss", label: "관장의 차마딜로" },
  ] },
  { id: PKMN_C_TROOPS.vrHiker, name: "등산가 우람", backdrop: CAVE_BACKDROP, trainer: true, members: [{ key: "bouldurr", level: 24, rank: "trainer" }, { key: "sandscorp", level: 23, rank: "trainer" }] },
  { id: PKMN_C_TROOPS.vrCamper, name: "캠프걸 하늘", backdrop: CAVE_BACKDROP, trainer: true, members: [{ key: "voltail", level: 23, rank: "trainer" }, { key: "brawlape", level: 24, rank: "trainer" }] },
  { id: PKMN_C_TROOPS.vrGentleman, name: "신사 백곰", backdrop: CAVE_BACKDROP, trainer: true, members: [{ key: "pluma", level: 24, rank: "trainer" }, { key: "friolera", level: 25, rank: "trainer" }] },
  { id: PKMN_C_TROOPS.rivalWater, name: "라이벌 — 마지막 승부", backdrop: CAVE_BACKDROP, trainer: true, members: [rivalMember("pluma", 26), rivalMember("lanterghast", 26), rivalMember("finiette", 28)] },
  { id: PKMN_C_TROOPS.rivalGrass, name: "라이벌 — 마지막 승부", backdrop: CAVE_BACKDROP, trainer: true, members: [rivalMember("pluma", 26), rivalMember("bouldurr", 26), rivalMember("ivieron", 28)] },
  { id: PKMN_C_TROOPS.rivalFire, name: "라이벌 — 마지막 승부", backdrop: CAVE_BACKDROP, trainer: true, members: [rivalMember("pluma", 26), rivalMember("voltail", 26), rivalMember("charmadillo", 28)] },
  { id: PKMN_C_TROOPS.champion, name: "챔피언 세라", backdrop: GYM_BACKDROP, trainer: true, members: [
    championMember("pluma", 28), championMember("bouldurr", 29), championMember("lanterghast", 30), championMember("voltail", 30), championMember("atrox", 32),
  ] },
];

function troopRecord(spec: TroopSpec) {
  return demoTroop(spec.id, spec.name, spec.backdrop, spec.members.map((member, index) => ({
    enemyId: enemyId(member), x: 160 - index * 8, y: 132,
  })), spec.trainer ? { uncapturable: true, trainerBattle: true } : {});
}

export type PkmnRegionCRecords = {
  readonly enemies: ReturnType<typeof enemyRecord>[];
  readonly troops: ReturnType<typeof troopRecord>[];
};

export function createPkmnRegionCRecords(): PkmnRegionCRecords {
  const troops = [...WILD_VICTORY, ...TRAINER_TROOPS];
  const specs = new Map<string, EnemySpec>();
  for (const troop of troops) for (const member of troop.members) if (!specs.has(enemyId(member))) specs.set(enemyId(member), member);
  return { enemies: [...specs.values()].map(enemyRecord), troops: troops.map(troopRecord) };
}

// --- 엔딩 ----------------------------------------------------------------------------

export const PKMN_CHAMPION_ENDING_ID = "ending_pkmn_champion";
export const PKMN_CHAMPION_ENDING: EndingDef = {
  id: PKMN_CHAMPION_ENDING_ID,
  name: "새로운 챔피언",
  conditions: [{ kind: "switch", switchId: PKMN_FLAGS.champion, value: true }],
  priority: 10,
  presentation: {
    tone: "warm",
    credits: [
      "몬스터 테이머",
      "",
      "새싹 마을에서 시작된 여행은 챔피언의 탑에서 끝났다.",
      "새로운 챔피언의 이름이 명예의 전당에 새겨졌다.",
      "",
      "— 함께한 몬스터들에게 —",
      "",
      "그래픽: Scarloxy MPWSP01 팩 (CC BY 4.0) · 생성 몬스터·칩셋 자산",
      "제작: OPRN Studio 예시 프로젝트",
      "",
      "플레이해 주셔서 고맙습니다.",
    ].join("\n"),
  },
};

// --- 잿불 마을 (town_kit 28×20) ------------------------------------------------------

/** 남쪽 울타리 틈 — 배지 3 이 없으면 경비원이 이 칸을 막는다. 틈 아래 (14,18) 이 챔피언 로드에서 오는 도착 칸. */
const EMBER_GATE = { x: 14, y: 17 } as const;

export function createEmberTownMap(): GameMap {
  const map = blankMap("emberTown", "잿불 마을", TOWN_TILESET_ID, G.GRASS);

  stampUpper(map, 3, 2, G.HOSPITAL); // 잿불 회복 센터 — 문 (5..6,7)
  stampUpper(map, 17, 1, K.LAB); // 불 체육관 — 문 (20..21,6)
  stampUpper(map, 2, 11, G.HOUSE_SMALL); // 문 (3,15)
  stampUpper(map, 20, 10, G.HOUSE_SMALL_ALT); // 문 (21,14)
  stampLower(map, 10, 11, G.SAND_PATCH); // 광장 모래밭(화산재)

  for (const [x, y] of [[0, 0], [9, 0], [25, 0], [0, 6], [26, 7], [0, 14]] as const) stampUpper(map, x, y, G.GREEN_TREE);
  stampUpper(map, 26, 12, G.TEAL_TREE);
  stampUpper(map, 11, 3, TEAL_TREE_SMALL);
  for (const [x, y] of [[8, 10], [16, 12], [24, 16], [6, 18], [19, 18], [2, 18]] as const) setUpper(map, x, y, G.GRASS_TUFT);
  setUpper(map, 13, 12, G.ROCK_1);
  setUpper(map, 25, 18, G.ROCK_2);

  // 남쪽 울타리 — 가운데 (14,17) 한 칸만 비운다.
  fenceRow(map, 0, 13, EMBER_GATE.y);
  fenceRow(map, 15, 27, EMBER_GATE.y);

  stampUpper(map, 12, 5, K.LAMP);
  stampUpper(map, 16, 5, K.LAMP);
  stampUpper(map, 16, 14, K.BENCH);
  stampUpper(map, 7, 9, K.PLANTER);
  stampUpper(map, 18, 8, K.PLANTER);
  setUpper(map, 7, 15, K.MAILBOX);
  setUpper(map, 22, 15, K.MAILBOX);
  setUpper(map, 9, 16, K.CRATE);

  const signs = { town: { x: 12, y: 1 }, center: { x: 7, y: 8 }, gym: { x: 22, y: 7 }, gate: { x: 12, y: 16 } } as const;
  for (const cell of Object.values(signs)) setUpper(map, cell.x, cell.y, K.SIGNPOST);

  map.events.push(
    transferEvent("ev_pkmn_c_ember_to_route3", 14, 0, PKMN_MAPS.route3, 12, 32, "3번 도로로"),
    transferEvent("ev_pkmn_c_ember_to_victory", 14, 19, PKMN_MAPS.victoryRoad, 14, 24, "챔피언 로드로"),
    transferEvent("ev_pkmn_c_ember_door_center", EMBER_DOORS.center.x, EMBER_DOORS.center.y, PKMN_MAPS.emberCenter, CENTER_ARRIVAL.x, CENTER_ARRIVAL.y, "잿불 회복 센터로"),
    transferEvent("ev_pkmn_c_ember_door_gym", EMBER_DOORS.gym.x, EMBER_DOORS.gym.y, PKMN_MAPS.fireGym, GYM_ARRIVAL.x, GYM_ARRIVAL.y, "불 체육관으로"),
    signEvent("ev_pkmn_c_ember_sign_town", signs.town.x, signs.town.y, "표지판", [
      "잿불 마을 — 화산 기슭, 꺼지지 않는 불씨의 마을.",
      "북쪽: 3번 도로 · 남쪽: 챔피언 로드",
    ]),
    signEvent("ev_pkmn_c_ember_sign_center", signs.center.x, signs.center.y, "안내판", [
      "잿불 회복 센터 — 몬스터 회복은 무료. 계산대에서 구슬과 큰 물약을 팝니다.",
    ]),
    signEvent("ev_pkmn_c_ember_sign_gym", signs.gym.x, signs.gym.y, "안내판", [
      "잿불 마을 몬스터 체육관 — 관장 화린. 「불씨 하나가 들판을 태운다」",
      "불꽃 타입에는 물·땅·바위 기술이 잘 통한다.",
    ]),
    signEvent("ev_pkmn_c_ember_sign_gate", signs.gate.x, signs.gate.y, "표지판", [
      "남쪽: 챔피언 로드 → 챔피언의 탑",
      "배지 세 개를 모은 트레이너만 지날 수 있습니다. — 몬스터 리그",
    ]),
    signEvent("ev_pkmn_c_ember_house_a_door", 3, 15, "문", ["문이 잠겨 있다. 안에서 풀무 소리가 난다."]),
    signEvent("ev_pkmn_c_ember_house_b_door", 21, 14, "문", ["문이 잠겨 있다. 문패에 「불씨 도예 공방」이라고 적혀 있다."]),
    castTalker("ev_pkmn_c_ember_smith", 9, 13, "villagerB", [
      "이 마을 흙은 화산재가 섞여서 그릇이 단단하게 구워지지.",
      "관장 화린의 차마딜로는 등껍질이 바위라서 불꽃 기술이 잘 안 먹혀. 물이나 땅 기술을 써 봐.",
    ], { speaker: "도예가", wander: true }),
    castTalker("ev_pkmn_c_ember_swimmer", 17, 11, "swimmer", [
      "파도 마을에서 3번 도로를 넘어왔어? 대단한데!",
      "챔피언 로드는 긴 동굴이야. 센터에서 큰 물약을 넉넉히 사 가.",
    ], { speaker: "수영선수" }),
    castTalker("ev_pkmn_c_ember_fisher", 6, 10, "fisherman", [
      "챔피언 로드 끝에는 늘 누군가 기다린다던데… 너처럼 배지를 모은 트레이너겠지.",
    ], { speaker: "낚시꾼", wander: true }),
    castTalker("ev_pkmn_c_ember_gentleman", 24, 9, "gentleman", [
      "챔피언의 탑 꼭대기에는 챔피언 세라가 있다네. 다섯 마리 몬스터를 거느리지.",
      "마지막 한 마리는 전설의 용이라는 소문도 있지. 준비를 단단히 하게.",
    ], { speaker: "신사" }),
    ...emberGateGuard(),
  );
  return map;
}

function emberGateGuard(): GameEvent[] {
  const speaker = "경비원";
  const blocking = page("ev_pkmn_c_ember_gate_guard_block", speaker, castLines("hiker", [
    "여기부터는 챔피언 로드다. 배지 세 개를 모은 트레이너만 지나갈 수 있어.",
    "불 배지가 아직 없군. 마을 북동쪽 불 체육관의 관장 화린에게 도전하게.",
  ], speaker), facingGraphic("hiker", "up"), PASSIVE_MOVEMENT);
  const cleared: EventPage = {
    ...page("ev_pkmn_c_ember_gate_guard_clear", "비켜 선 자리", [], NO_GRAPHIC, PASSIVE_MOVEMENT, [
      { kind: "switch", switchId: PKMN_FLAGS.badge3, value: true },
    ]),
    priority: "below",
  };
  const guard = event("ev_pkmn_c_ember_gate_guard", EMBER_GATE.x, EMBER_GATE.y, [blocking]);
  guard.pages?.push(cleared);
  const aside = event("ev_pkmn_c_ember_gate_guard_aside", 16, 16, [
    page("ev_pkmn_c_ember_gate_guard_aside_page", speaker, castLines("hiker", [
      "배지 세 개! 훌륭하군. 챔피언 로드는 길고 험하니 몸조심하게.",
    ], speaker), facingGraphic("hiker", "left"), PASSIVE_MOVEMENT, [
      { kind: "switch", switchId: PKMN_FLAGS.badge3, value: true },
    ]),
  ]);
  return [guard, aside];
}

// --- 잿불 회복 센터 (monster_interior 15×11) -----------------------------------------

export function createEmberCenterMap(): GameMap {
  const map = blankMap("emberCenter", "잿불 회복 센터", INTERIOR_TILESET_ID, 1);
  // 참고문서 센터 예제 배열 — 벽 색만 라벤더(16/46), 왼쪽에 계산대, 깔개는 빨강.
  const lower = [
    [10, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 12],
    [40, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 42],
    [40, 46, 46, 46, 46, 46, 46, 46, 46, 46, 46, 46, 46, 46, 42],
    [40, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 42],
    [40, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 42],
    [40, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 42],
    [40, 1, 1, 1, 1, 1, 4, 5, 6, 1, 1, 1, 1, 1, 42],
    [40, 1, 1, 1, 1, 1, 34, 35, 36, 1, 1, 1, 1, 1, 42],
    [40, 1, 1, 1, 1, 1, 64, 65, 66, 1, 1, 1, 1, 1, 42],
    [40, 1, 1, 1, 1, 1, 1, 19, 1, 1, 1, 1, 1, 1, 42],
    [70, 71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 71, 72],
  ];
  const upper = [
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, 94, 95, -1, -1, 96, -1, -1, 94, 95, -1, 97, -1],
    [-1, -1, -1, 124, 125, -1, -1, -1, -1, -1, 124, 125, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 155, 156, -1, 157, -1],
    [-1, 167, 168, 169, -1, 150, 151, 152, 153, 154, 185, 186, -1, 187, -1],
    [-1, 197, 198, 199, -1, 180, 181, 182, 183, 184, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, 161, 158, 159, 160, -1, -1, -1, -1, -1, 158, 159, 160, 161, -1],
    [-1, 191, 188, 189, 190, -1, -1, -1, -1, -1, 188, 189, 190, 191, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
  ];
  map.lowerTiles = lower.flat();
  map.upperTiles = upper.flat();
  const nurse = SCARLOXY_CAST.nurse.label;
  map.events.push(
    transferEvent("ev_pkmn_c_center_exit", 7, 9, PKMN_MAPS.emberTown, EMBER_DOORS.center.x, EMBER_DOORS.center.y + 1, "밖으로"),
    castTalker("ev_pkmn_c_center_nurse", 7, 3, "nurse", ["어서 오세요. 카운터 앞에서 말씀해 주세요."]),
    event("ev_pkmn_c_center_heal", 7, 5, [
      page("ev_pkmn_c_center_heal_page", nurse, [
        ...castLines("nurse", ["잿불 회복 센터입니다. 몬스터들을 회복시켜 드릴게요…"]),
        { kind: "recoverAll" },
        { kind: "text", speaker: nurse, body: "모두 기운을 되찾았어요! 챔피언 로드에 가신다면 꼭 다시 들러 주세요." },
      ], NO_GRAPHIC, PASSIVE_MOVEMENT),
    ]),
    castTalker("ev_pkmn_c_center_clerk", 2, 3, "clerk", ["계산대 앞에서 말씀해 주세요!"]),
    event("ev_pkmn_c_center_shop", 2, 5, [
      page("ev_pkmn_c_center_shop_page", SCARLOXY_CAST.clerk.label, [
        ...castLines("clerk", ["어서 오세요! 챔피언 로드 가는 분들은 큰 물약을 많이 찾으세요."]),
        { kind: "shop", itemIds: [...EMBER_SHOP_ITEM_IDS], allowSell: true, quantityMode: "select", shopType: "normal", messageType: "welcome" },
      ], NO_GRAPHIC, PASSIVE_MOVEMENT),
    ]),
    signEvent("ev_pkmn_c_center_pc", 13, 4, "PC", ["몬스터 보관 PC다. 파티와 보관함은 메뉴의 「몬스터」에서 바꿀 수 있다."]),
    castTalker("ev_pkmn_c_center_camper", 11, 6, "camperGirl", [
      "챔피언 로드 자갈밭엔 바위곰이 나와. 단단해서 물이나 풀 기술로 상대하는 게 좋아.",
    ], { speaker: "캠프걸" }),
    castTalker("ev_pkmn_c_center_boy", 3, 9, "bugCatcher", [
      "라이벌이 챔피언 로드 끝에서 기다린다고 했어? 우와, 멋있다!",
    ], { speaker: "벌레잡이 소년" }),
  );
  return map;
}


// --- 불 체육관 (gym_coast 14×15, fire) ------------------------------------------------
// 풀 체육관 예제 배열의 fire 변형(참고문서 「속성 바꾸기」). 스위치는 오른쪽 아래, 트레이너 B 는 왼쪽으로 옮겼다.

const FIRE_SWITCH = { x: 11, y: 11 } as const;
const FIRE_GATE_CELLS = [{ x: 6, y: 8 }, { x: 7, y: 8 }] as const;

export function createFireGymMap(): GameMap {
  const map = blankMap("fireGym", "잿불 마을 불 체육관", GYM_TILESET_ID, 484);
  const lower = [
    [519, 519, 519, 519, 519, 519, 519, 519, 519, 519, 519, 519, 519, 519],
    [520, 513, 513, 513, 513, 513, 514, 515, 513, 513, 513, 513, 513, 521],
    [520, 543, 543, 543, 543, 543, 544, 545, 543, 543, 543, 543, 543, 521],
    [520, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 521],
    [520, 484, 485, 484, 484, 484, 485, 484, 484, 484, 485, 484, 484, 521],
    [520, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 521],
    [520, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 521],
    [520, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 521],
    [520, 484, 485, 484, 484, 484, 485, 484, 484, 484, 485, 484, 484, 521],
    [520, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 521],
    [520, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 521],
    [520, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 521],
    [520, 484, 485, 484, 484, 484, 485, 484, 484, 484, 485, 484, 484, 521],
    [520, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 484, 521],
    [523, 522, 522, 522, 522, 525, 484, 484, 526, 522, 522, 522, 522, 524],
  ];
  const upper = [
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, 583, -1, -1, -1, 573, 574, 575, -1, -1, -1, -1, 583, -1],
    [-1, 613, -1, -1, -1, 603, 604, 605, -1, -1, -1, -1, 613, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, 630, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, 633, 633, 633, 633, 633, 633, 633, 633, 633, 633, 633, 633, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, 630, -1, -1, -1, -1, -1, -1, -1, 631, -1, -1],
    [-1, -1, -1, -1, 580, -1, -1, -1, -1, 580, -1, -1, -1, -1],
    [-1, -1, -1, -1, 610, -1, -1, -1, -1, 610, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, 635, 636, -1, -1, -1, -1, -1, -1],
  ];
  map.lowerTiles = lower.flat();
  map.upperTiles = upper.flat();
  const mapId = map.id;

  const switchEvent = event("ev_pkmn_c_gym_switch", FIRE_SWITCH.x, FIRE_SWITCH.y, [
    page("ev_pkmn_c_gym_switch_off", "바닥 스위치", [
      { kind: "changeTile", mapId, layer: "upper", x: FIRE_SWITCH.x, y: FIRE_SWITCH.y, tile: 632 },
      ...FIRE_GATE_CELLS.map((cell) => ({ kind: "changeTile", mapId, layer: "upper", x: cell.x, y: cell.y, tile: 634 }) satisfies Command),
      { kind: "text", body: "딸깍! 열기를 뿜던 차단기가 내려갔다." },
      { kind: "setSelfSwitch", key: "A", value: true },
    ], NO_GRAPHIC, PASSIVE_MOVEMENT),
    page("ev_pkmn_c_gym_switch_on", "눌린 스위치", [], NO_GRAPHIC, PASSIVE_MOVEMENT, [{ kind: "selfSwitch", key: "A", value: true }]),
  ], "playerTouch", "below");

  const leaderName = "관장 화린";
  const leaderBattle: Command = {
    kind: "battleProcessing",
    troopId: PKMN_C_TROOPS.leader,
    canEscape: false,
    canLose: true,
    branchOnResult: true,
    victoryBranch: [
      ...castLines("fireLeader", [
        "하하! 내 불꽃이 꺼지다니, 이렇게 시원한 패배는 처음이야.",
        "잿불 마을 체육관을 이긴 증표, 불 배지다. 이걸로 배지가 세 개 — 챔피언 로드가 너를 기다린다!",
      ], leaderName),
      { kind: "setSwitch", switchId: PKMN_FLAGS.badge3, value: true },
      { kind: "setVariable", variableId: PKMN_FLAGS.badgeCount, op: "+=", value: 1 },
      { kind: "text", body: "불 배지를 받았다!" },
      { kind: "changeItem", itemId: "item_gen_potion_large", op: "+=", amount: 3 },
      { kind: "changeItem", itemId: PKMN_A_SUPER_ORB_ITEM_ID, op: "+=", amount: 5 },
      { kind: "changeGold", op: "+=", amount: 1500 },
      { kind: "text", body: "큰 물약 3개와 슈퍼 구슬 5개, 1500골드를 받았다!" },
    ],
    defeatBranch: whiteoutCommands(EMBER_WHITEOUT),
    escapeBranch: [],
  };
  const leaderEvent = event("ev_pkmn_c_gym_leader", 6, 3, [
    page("ev_pkmn_c_gym_leader_battle", leaderName, [
      ...castLines("fireLeader", [
        "잘 왔다, 도전자! 나는 잿불 마을 체육관 관장 화린.",
        "화산의 열기로 단련한 내 몬스터들이다. 네 투지도 불태워 보자!",
      ], leaderName),
      leaderBattle,
    ], facingGraphic("fireLeader", "down"), PASSIVE_MOVEMENT),
    page("ev_pkmn_c_gym_leader_after", leaderName, castLines("fireLeader", [
      "배지 세 개를 모았으니 남쪽 챔피언 로드로 가 봐. 끝에는 챔피언의 탑이 있지.",
      "챔피언 세라는 강해. 타입 상성을 잘 따져서 파티를 꾸려!",
    ], leaderName), facingGraphic("fireLeader", "down"), PASSIVE_MOVEMENT, [
      { kind: "switch", switchId: PKMN_FLAGS.badge3, value: true },
    ]),
  ]);

  map.events.push(
    transferEvent("ev_pkmn_c_gym_exit_l", 6, 14, PKMN_MAPS.emberTown, EMBER_DOORS.gym.x, EMBER_DOORS.gym.y + 1, "밖으로"),
    transferEvent("ev_pkmn_c_gym_exit_r", 7, 14, PKMN_MAPS.emberTown, EMBER_DOORS.gym.x, EMBER_DOORS.gym.y + 1, "밖으로"),
    switchEvent,
    leaderEvent,
    trainerEvent({
      id: "ev_pkmn_c_gym_trainer_a", x: 9, y: 5, role: "camperGirl", speaker: "체육관 트레이너 불꽃", facing: "left",
      troopId: PKMN_C_TROOPS.gymA, range: 4, whiteout: EMBER_WHITEOUT,
      intro: ["관장님 앞까지 왔다고? 내 불꽃부터 넘어 봐!"],
      lose: "앗 뜨거… 아니, 앗 차가워!",
      after: ["관장님의 차마딜로는 바위 등껍질이야. 물이나 땅 기술이 잘 먹혀."],
    }),
    trainerEvent({
      id: "ev_pkmn_c_gym_trainer_b", x: 3, y: 11, role: "hiker", speaker: "체육관 트레이너 숯돌", facing: "right",
      troopId: PKMN_C_TROOPS.gymB, range: 4, whiteout: EMBER_WHITEOUT,
      intro: ["스위치는 이 방 어딘가에 있지! 나를 이기면 가르쳐 줄 수도?"],
      lose: "등롱귀의 불이 꺼졌어…",
      after: ["스위치는 오른쪽 아래 구석이야. 밟으면 차단기가 내려가."],
    }),
    castTalker("ev_pkmn_c_gym_guide", 2, 13, "gentleman", [
      "도전자여, 어서 오게! 관장 화린은 불꽃 타입 전문이라네.",
      "차단기를 열려면 바닥 스위치를 찾아 밟게. 물·땅·바위 기술이 잘 통한다네!",
    ], { speaker: "체육관 안내원", direction: "right" }),
    signEvent("ev_pkmn_c_gym_statue_l", 4, 13, "배지 조각상", ["잿불 마을 체육관 — 관장 화린에게 이긴 트레이너의 이름이 새겨져 있다."]),
    signEvent("ev_pkmn_c_gym_statue_r", 9, 13, "배지 조각상", ["「불씨 하나가 들판을 태운다」"]),
  );
  return map;
}

// --- 챔피언 로드 (monster_cave 28×26) --------------------------------------------------
// 남쪽 (14,25) ↔ 잿불 마을, 북쪽 외길 (14,0) ↔ 챔피언의 탑. 북쪽 방 입구 칸 (14,4) 에 라이벌 3.

/** 글자 배치(W 벽 · h 고지대 · ~ 물 · g 자갈 · . 흙). 가로 줄마다 같은 글자 구간을 사각형으로 바꾼다. */
function rowsToRects(rows: readonly string[]): CaveSpec["rects"] {
  const rects: CaveSpec["rects"][number][] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const char = row[x]!;
      let end = x;
      while (end + 1 < row.length && row[end + 1] === char) end += 1;
      if (char !== "W") rects.push([char as "h" | "~" | "g" | ".", x, y, end, y]);
      x = end + 1;
    }
  });
  return rects;
}

//                        0123456789012345678901234567
const VICTORY_LAYOUT = [
  /*  0 */ "WWWWWWWWWWWWWW.WWWWWWWWWWWWW",
  /*  1 */ "WWWWWWWWWWWWWW.WWWWWWWWWWWWW",
  /*  2 */ "WWWWWWWWWWWWWW.WWWWWWWWWWWWW",
  /*  3 */ "WWWWWWWWWWWWWW.WWWWWWWWWWWWW",
  /*  4 */ "WWWWWWWWW............WWWWWWW",
  /*  5 */ "WWWWWWWWW............WWWWWWW",
  /*  6 */ "WWWWWWWWW.......gggg.WWWWWWW",
  /*  7 */ "WWWWWWWWW.......gggg.WWWWWWW",
  /*  8 */ "WWWWWWWWW............WWWWWWW",
  /*  9 */ "WWWWWWWWW..WWWWWWWWWWWWWWWWW",
  /* 10 */ "WWWWWWWWW..WWWWhhhhhhhhhWWWW",
  /* 11 */ "WWWWWWWWW..WWWWhhhhhhhhhWWWW",
  /* 12 */ "WWWWWWWWW..WWWWhhhhhhhhhWWWW",
  /* 13 */ "WWWWWWWWW..WWWWhhhhhhhhhWWWW",
  /* 14 */ "WWWWWWWWW..WWWWhhhhhhhhhWWWW",
  /* 15 */ "WWW.......................WW",
  /* 16 */ "WWW.......................WW",
  /* 17 */ "WWW.......................WW",
  /* 18 */ "WWW.ggggg.....~~~~~.......WW",
  /* 19 */ "WWW.ggggg.....~~~~~..gggg.WW",
  /* 20 */ "WWW.ggggg............gggg.WW",
  /* 21 */ "WWW.......................WW",
  /* 22 */ "WWWWWWWWWWWWW..WWWWWWWWWWWWW",
  /* 23 */ "WWWWWWWWWWWWW..WWWWWWWWWWWWW",
  /* 24 */ "WWWWWWWWWWWWW..WWWWWWWWWWWWW",
  /* 25 */ "WWWWWWWWWWWWW..WWWWWWWWWWWWW",
];
const VICTORY_GRAVEL: readonly Rect[] = [
  { x: 4, y: 18, w: 5, h: 3 },
  { x: 21, y: 19, w: 4, h: 2 },
  { x: 16, y: 6, w: 4, h: 2 },
];
const VICTORY_SPEC: CaveSpec = {
  width: 28,
  height: 26,
  rects: rowsToRects(VICTORY_LAYOUT),
  fixtures: [["stairs-up", 19, 15]],
  decals: [
    ["sparkle-a", 4, 21],
    ["sparkle-b", 18, 8],
    ["glow-moss", 11, 17],
    ["glow-moss", 25, 17],
    ["puddle", 12, 20],
    ["floor-crack", 9, 11],
    ["floor-scatter", 20, 21],
  ],
  props: [
    ["crystal", 22, 12],
    ["ore-rock", 16, 12],
    ["stalagmite-tall", 10, 6],
    ["stalagmite-small", 20, 8],
    ["rubble", 4, 17],
    ["stalagmite-tall", 3, 20],
    ["cracked-rock", 6, 17],
    ["crystal", 12, 7],
  ],
};

const RIVAL_CELL = { x: 14, y: 4 } as const;

function rivalBattlePage(pageId: string, troopId: string, conditions: EventPage["conditions"]): EventPage {
  const rival = "rival" as const;
  const battle: Command = {
    kind: "battleProcessing",
    troopId,
    canEscape: false,
    canLose: true,
    branchOnResult: true,
    victoryBranch: [
      ...castLines(rival, [
        "…졌다. 완전히 졌어. 처음 박사님 연구소에서 만났을 때부터 넌 늘 한 발 앞이었지.",
        "가라. 챔피언의 탑은 이 위야. 챔피언 세라한테 지면 내가 용서 안 한다!",
      ]),
      { kind: "setSwitch", switchId: PKMN_FLAGS.rival3, value: true },
    ],
    defeatBranch: whiteoutCommands(EMBER_WHITEOUT),
    escapeBranch: [],
  };
  return {
    ...page(pageId, SCARLOXY_CAST.rival.label, [
      ...castLines(rival, [
        "왔구나. 여기가 챔피언 로드의 끝이야. 이 위가 바로 챔피언의 탑이지.",
        "탑에 오르기 전에 마지막으로 확인해야겠어. 누가 진짜 최강의 트레이너인지!",
        "네 첫 몬스터를 생각해서 파티를 짰어. 이번엔 안 봐준다!",
      ]),
      battle,
    ], facingGraphic(rival, "down"), PASSIVE_MOVEMENT, conditions),
    detectionEncounter: { sight: { range: 3, lineOfSight: true, facing: "forward" }, emote: "exclamation", emoteMs: 600, approachSpeed: 4 },
  };
}

/**
 * 라이벌 3 — 스타터 변수(1 불 · 2 물 · 3 풀)마다 페이지가 하나씩이고 뒤 페이지가 이긴다.
 * 첫 페이지(조건 없음)가 불 스타터용(물 라인)이자 변수가 비었을 때의 기본값이다.
 * 이기면 sw_pkmn_rival_3 이 켜져 마지막 빈 페이지(통행)로 바뀌고, 옆의 라이벌이 나타난다.
 */
function rivalEvents(): GameEvent[] {
  const pages: EventPage[] = [
    rivalBattlePage("ev_pkmn_c_rival3_vs_fire", PKMN_C_TROOPS.rivalWater, []),
    rivalBattlePage("ev_pkmn_c_rival3_vs_water", PKMN_C_TROOPS.rivalGrass, [{ kind: "variable", variableId: STARTER_VARIABLE_ID, op: "==", value: 2 }]),
    rivalBattlePage("ev_pkmn_c_rival3_vs_grass", PKMN_C_TROOPS.rivalFire, [{ kind: "variable", variableId: STARTER_VARIABLE_ID, op: "==", value: 3 }]),
    { ...page("ev_pkmn_c_rival3_cleared", "비켜 선 자리", [], NO_GRAPHIC, PASSIVE_MOVEMENT, [
      { kind: "switch", switchId: PKMN_FLAGS.rival3, value: true },
    ]), priority: "below" },
  ];
  const blocker = event("ev_pkmn_c_rival3", RIVAL_CELL.x, RIVAL_CELL.y, pages);
  blocker.pages?.forEach((entry) => { if (entry.id === "ev_pkmn_c_rival3_cleared") entry.priority = "below"; });
  const aside = event("ev_pkmn_c_rival3_aside", 13, 6, [
    page("ev_pkmn_c_rival3_aside_page", SCARLOXY_CAST.rival.label, castLines("rival", [
      "뭘 꾸물대? 챔피언의 탑은 저 위야. 네가 챔피언이 되는 걸 보고 싶다고.",
    ]), facingGraphic("rival", "right"), PASSIVE_MOVEMENT, [
      { kind: "switch", switchId: PKMN_FLAGS.rival3, value: true },
    ]),
  ]);
  return [blocker, aside];
}

export function createVictoryRoadMap(): GameMap {
  const map = caveMap("victoryRoad", "챔피언 로드", VICTORY_SPEC);
  map.encounterRate = 7;
  map.troopIds = WILD_VICTORY.map((troop) => troop.id);
  map.encounterTable = encounterTable(VICTORY_GRAVEL, VICTORY_WEIGHTS);
  map.events.push(
    transferEvent("ev_pkmn_c_vr_to_ember", 14, 25, PKMN_MAPS.emberTown, 14, 18, "잿불 마을로"),
    transferEvent("ev_pkmn_c_vr_to_ember_w", 13, 25, PKMN_MAPS.emberTown, 14, 18, "잿불 마을로"),
    transferEvent("ev_pkmn_c_vr_to_tower", 14, 0, PKMN_MAPS.championTower, 7, 16, "챔피언의 탑으로"),
    sparkleItem("ev_pkmn_c_vr_item_a", map.id, 4, 21, "item_gen_potion_large", 2, "큰 물약 2개"),
    sparkleItem("ev_pkmn_c_vr_item_b", map.id, 18, 8, PKMN_A_SUPER_ORB_ITEM_ID, 5, "슈퍼 구슬 5개"),
    event("ev_pkmn_c_vr_crystal", 22, 12, [
      page("ev_pkmn_c_vr_crystal_find", "수정 무더기", [
        { kind: "text", body: "붉게 빛나는 수정 틈에서 상급 회복약 3개를 찾았다!" },
        { kind: "changeItem", itemId: "item_hi_potion", op: "+=", amount: 3 },
        { kind: "setSelfSwitch", key: "A", value: true },
      ], NO_GRAPHIC, PASSIVE_MOVEMENT),
      page("ev_pkmn_c_vr_crystal_done", "수정 무더기", [{ kind: "text", body: "수정이 화산의 열기를 머금고 따뜻하다." }], NO_GRAPHIC, PASSIVE_MOVEMENT, [
        { kind: "selfSwitch", key: "A", value: true },
      ]),
    ]),
    trainerEvent({
      id: "ev_pkmn_c_vr_hiker", x: 20, y: 17, role: "hiker", speaker: "등산가 우람", facing: "down",
      troopId: PKMN_C_TROOPS.vrHiker, range: 4, whiteout: EMBER_WHITEOUT,
      intro: ["챔피언 로드는 산사나이의 앞마당이지! 덤벼라!"],
      lose: "허허, 이 산보다 네가 더 높구먼.",
      after: ["북쪽으로 올라가는 외길 끝이 챔피언의 탑이야."],
    }),
    trainerEvent({
      id: "ev_pkmn_c_vr_camper", x: 10, y: 10, role: "camperGirl", speaker: "캠프걸 하늘", facing: "down",
      troopId: PKMN_C_TROOPS.vrCamper, range: 4, whiteout: EMBER_WHITEOUT,
      intro: ["여기까지 온 트레이너는 오랜만이야! 실력 좀 보자!"],
      lose: "번개꼬리까지 졌어…",
      after: ["위쪽 방 자갈밭에도 야생 몬스터가 나와. 조심해!"],
    }),
    trainerEvent({
      id: "ev_pkmn_c_vr_gentleman", x: 19, y: 12, role: "gentleman", speaker: "신사 백곰", facing: "down",
      troopId: PKMN_C_TROOPS.vrGentleman, range: 4, whiteout: EMBER_WHITEOUT,
      intro: ["이 높은 곳까지 올라오다니. 신사답게 한 판 겨루어 보세나."],
      lose: "훌륭하군. 챔피언의 자격이 보이네.",
      after: ["저쪽 수정 무더기를 조사해 보게. 좋은 것이 있을지도."],
    }),
    signEvent("ev_pkmn_c_vr_sign", 15, 21, "리그 팻말", [
      "챔피언 로드 — 몬스터 리그 공인 시험 동굴.",
      "북쪽 끝 외길을 오르면 챔피언의 탑입니다.",
    ]),
    ...rivalEvents(),
  );
  return map;
}

// --- 챔피언의 탑 (gym_coast 15×18, 중립 바닥) -----------------------------------------
// 방 안쪽 x1..13 y3..16, 입구 틈 (7..8,17). 벽은 풀·불·물 세 속성 기둥과 문장을 나란히 건다.

export function createChampionTowerMap(): GameMap {
  const map = blankMap("championTower", "챔피언의 탑", GYM_TILESET_ID, 480);
  const width = map.width;
  const lower = new Array<number>(width * map.height).fill(480);
  const set = (x: number, y: number, tile: number) => { lower[y * width + x] = tile; };
  for (let x = 0; x < width; x += 1) set(x, 0, 519);
  for (let y = 1; y <= 16; y += 1) { set(0, y, 520); set(width - 1, y, 521); }
  const wallColumn = (x: number): readonly [number, number] => (x <= 4 ? [510, 540] : x <= 9 ? [513, 543] : [516, 546]);
  for (let x = 1; x <= 13; x += 1) { const [top, bottom] = wallColumn(x); set(x, 1, top); set(x, 2, bottom); }
  for (const [x, emblem] of [[2, 511], [7, 514], [11, 517]] as const) {
    set(x, 1, emblem); set(x + 1, 1, emblem + 1); set(x, 2, emblem + 30); set(x + 1, 2, emblem + 31);
  }
  for (let y = 3; y <= 16; y += 1) for (let x = 1; x <= 13; x += 1) if (x % 4 === 2 && y % 4 === 0) set(x, y, 481);
  for (let x = 1; x <= 13; x += 1) set(x, 17, 522);
  set(0, 17, 523); set(width - 1, 17, 524); set(6, 17, 525); set(7, 17, 480); set(8, 17, 480); set(9, 17, 526);
  map.lowerTiles = lower;
  const up = (x: number, y: number, tiles: readonly (readonly number[])[]) => stampUpper(map, x, y, tiles);
  up(6, 3, [[573, 574, 575], [603, 604, 605]]); // 챔피언 단상(불) — 챔피언 (7,3), 계단 (7,4)
  up(5, 3, [[583], [613]]);
  up(9, 3, [[583], [613]]);
  up(1, 3, [[582], [612]]);
  up(13, 3, [[582], [612]]);
  up(1, 7, [[584, 585], [614, 615]]);
  up(12, 7, [[584, 585], [614, 615]]);
  up(4, 9, [[579], [609]]);
  up(10, 9, [[581], [611]]);
  up(4, 13, [[580], [610]]);
  up(10, 13, [[579], [609]]);
  up(7, 17, [[635, 636]]);

  const champion = "champion" as const;
  const championName = SCARLOXY_CAST.champion.label;
  const epilogue: Command[] = [
    ...castLines(champion, [
      "…대단해. 정말 대단한 승부였어.",
      "오늘부터 네가 이 지방의 새로운 챔피언이야. 네 이름을 명예의 전당에 새기자.",
    ]),
    { kind: "setSwitch", switchId: PKMN_FLAGS.champion, value: true },
    { kind: "text", body: "명예의 전당에 트레이너와 몬스터들의 이름이 새겨졌다." },
    ...castLines("professor", [
      "소식 들었다! 새싹 마을 연구소에서 몬스터 한 마리를 받아 간 아이가 챔피언이 되다니.",
      "몬스터들과 함께 걸어온 길이 네 힘이었단다. 정말 자랑스럽구나.",
    ]),
    ...castLines("rival", [
      "쳇, 결국 먼저 챔피언이 됐네. …축하한다. 진심으로.",
      "하지만 기다려. 다음엔 내가 그 자리에서 너를 끌어내릴 테니까!",
    ]),
    { kind: "triggerEnding", endingId: PKMN_CHAMPION_ENDING_ID },
  ];
  const battle: Command = {
    kind: "battleProcessing",
    troopId: PKMN_C_TROOPS.champion,
    canEscape: false,
    canLose: false,
    branchOnResult: true,
    victoryBranch: epilogue,
    defeatBranch: [],
    escapeBranch: [],
  };
  const championEvent = event("ev_pkmn_c_champion", 7, 3, [
    page("ev_pkmn_c_champion_battle", championName, [
      ...castLines(champion, [
        "어서 와. 챔피언의 탑 꼭대기까지 올라온 트레이너는 몇 년 만이야.",
        "나는 이 지방의 챔피언 세라. 배지 세 개와 라이벌과의 승부, 그 모든 길을 걸어온 네 몬스터들을 보여 줘.",
        "여기서는 도망칠 수 없어. 자, 마지막 승부다!",
      ]),
      // 마지막 승부 직전 전회복 — 원작 리그처럼 챔피언 앞에서는 지친 파티로 싸우지 않는다.
      { kind: "recoverAll" },
      { kind: "text", body: "탑의 성화가 파티를 감쌌다. 몬스터들이 모두 기운을 되찾았다!" },
      battle,
    ], facingGraphic(champion, "down"), PASSIVE_MOVEMENT),
    page("ev_pkmn_c_champion_after", championName, [
      ...castLines(champion, ["새 챔피언님, 명예의 전당에서 네 이름이 빛나고 있어. 언제든 다시 도전하러 와."]),
      { kind: "triggerEnding", endingId: PKMN_CHAMPION_ENDING_ID },
    ], facingGraphic(champion, "down"), PASSIVE_MOVEMENT, [
      { kind: "switch", switchId: PKMN_FLAGS.champion, value: true },
    ]),
  ]);

  map.events.push(
    transferEvent("ev_pkmn_c_tower_exit_l", 7, 17, PKMN_MAPS.victoryRoad, 14, 1, "챔피언 로드로"),
    transferEvent("ev_pkmn_c_tower_exit_r", 8, 17, PKMN_MAPS.victoryRoad, 14, 1, "챔피언 로드로"),
    championEvent,
    castTalker("ev_pkmn_c_tower_nurse", 2, 15, "nurse", ["챔피언의 탑 전속 간호사예요. 마지막 승부 전에 몬스터들을 회복시켜 드릴게요."], {
      speaker: "탑의 간호사", direction: "right",
      extra: [{ kind: "recoverAll" }, { kind: "text", speaker: "탑의 간호사", body: "모두 건강해졌어요. 챔피언 세라는 위 단상에 계세요. 힘내세요!" }],
    }),
    castTalker("ev_pkmn_c_tower_clerk", 12, 15, "clerk", ["마지막 준비는 여기서! 챔피언전 전에 약을 챙기세요."], {
      speaker: "탑의 상인", direction: "left",
      extra: [{ kind: "shop", itemIds: [...EMBER_SHOP_ITEM_IDS], allowSell: true, quantityMode: "select", shopType: "normal", messageType: "welcome" }],
    }),
    signEvent("ev_pkmn_c_tower_statue", 4, 14, "리그 조각상", [
      "몬스터 리그 챔피언의 탑 — 챔피언을 이긴 트레이너는 명예의 전당에 이름을 남긴다.",
      "챔피언 세라는 비행·바위·고스트·전기, 그리고 드래곤 몬스터를 거느린다고 한다.",
    ]),
  );
  return map;
}

// --- 조립 도우미 ---------------------------------------------------------------------

export function createPkmnRegionCMaps(): GameMap[] {
  return [createEmberTownMap(), createEmberCenterMap(), createFireGymMap(), createVictoryRoadMap(), createChampionTowerMap()];
}

/** C 지역을 프로젝트에 넣는다(맵·적·무리·엔딩·맵 트리). 같은 id 가 있으면 건너뛴다. */
export function installPkmnRegionC(project: Project): void {
  for (const map of createPkmnRegionCMaps()) if (!project.maps[map.id]) project.maps[map.id] = map;
  const records = createPkmnRegionCRecords();
  const pushNew = <T extends { id: string }>(target: T[], additions: readonly T[]): void => {
    for (const record of additions) if (!target.some((existing) => existing.id === record.id)) target.push(record);
  };
  pushNew(project.database.enemies, records.enemies);
  pushNew(project.database.troops, records.troops);
  project.endings = project.endings ?? [];
  pushNew(project.endings, [PKMN_CHAMPION_ENDING]);
  const tree = project.mapTree;
  const hasNode = (node: typeof tree, id: string): boolean => node.mapId === id || node.children.some((child) => hasNode(child, id));
  const ember = singleNodeTree(PKMN_MAPS.emberTown);
  ember.children = [PKMN_MAPS.emberCenter, PKMN_MAPS.fireGym].map((id) => singleNodeTree(id));
  const victory = singleNodeTree(PKMN_MAPS.victoryRoad);
  victory.children = [singleNodeTree(PKMN_MAPS.championTower)];
  if (!hasNode(tree, PKMN_MAPS.emberTown)) tree.children = [...tree.children, ember];
  if (!hasNode(tree, PKMN_MAPS.victoryRoad)) tree.children = [...tree.children, victory];
}

