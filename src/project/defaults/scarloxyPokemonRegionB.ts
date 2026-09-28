// 포켓몬풍 데모 「몬스터 테이머」 B 지역 — 파도 마을(해변·부두) · 파도 회복 센터 · 물 체육관 · 3번 도로.
//
// 계약은 scarloxyPokemonWorld.ts(PKMN_MAPS·PKMN_MAP_SIZES·PKMN_LINKS·PKMN_FLAGS·PKMN_GATES)다.
// 구조와 도우미는 scarloxyPokemonRegionA.ts 를 그대로 따른다. 이 파일의 id 는 전부 pkmn_b 접두어를 쓴다.
//
// 칩셋별 규칙(각 칩셋 참고문서 JSON 과 같다):
//   - 파도 마을  scarloxy_chipset_monster_gym_coast: 참고문서 B 절 — 모서리 재료(sea/wet/dry) 격자로 해안 1층을 고르고,
//                부두·등대·아레나 외관·야자·소품은 3층 블록 통째로. 위 반쪽 wilds 시트에는 집 블록이 없어서
//                회복 센터 = 등대(3×6, 문 dx1·dy5), 체육관 = 물 아레나 외관(7×7, 문 dx3·dy6)이다.
//   - 센터       scarloxy_chipset_monster_interior : 이끼 회복 센터와 같은 배열.
//   - 물 체육관  scarloxy_chipset_monster_gym_coast: 「완성 예제 · 풀 체육관 14×15」 배열의 물 속성 치환 + 차단기 퍼즐.
//   - 3번 도로   scarloxy_chipset_monster_town_kit : 1층 잔디 124, 나무·울타리·풀숲은 3층.
//
// 레벨 곡선: 야생 12~18, 체육관 트레이너 14~15, 관장 16~18, 3번 도로 트레이너 15~17, 라이벌 16~18.

import type { Command, Dir, EventPage, GameEvent, GameMap, Project } from "../types";
import type { EncounterTableEntry, Rect } from "../types/project";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { MONSTER_TOWN_KIT_MANIFEST } from "@/assets/scarloxyPack";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { monsterBattleStatsForSpecies } from "@/project/monsterCollection";
import type { MonsterSpeciesRecord } from "@/project/types";
import { DEFAULT_SKILL_ID, DEFAULT_TILE_SIZE } from "./constants";
import { singleNodeTree } from "./defaultMaps";
import { SCARLOXY_CAST, type ScarloxyCastRole } from "./scarloxyCast";
import { castGraphic, castLines } from "./scarloxyCastEvents";
import { G, NO_GRAPHIC, PASSIVE_MOVEMENT, WANDER_MOVEMENT, demoEnemy, demoTroop, event, page, setUpper, stampLower, stampUpper, transferEvent } from "./scarloxyDemoGame";
import { SCARLOXY_EXTRA_SPECIES_SEEDS } from "./scarloxyExtraSpecies";
import { PKMN_A_SUPER_ORB_ITEM_ID } from "./scarloxyPokemonRegionA";
import { PKMN_FLAGS, PKMN_MAPS, PKMN_MAP_SIZES } from "./scarloxyPokemonWorld";

const EMPTY = -1;
/** scarloxyPokemonDemoGame.ts PKMN_STARTER_VARIABLE 과 같은 값(그 파일이 이 파일을 조립하므로 순환 import 를 피해 값만 적는다). */
const PKMN_STARTER_VARIABLE = "var_pkmn_starter";
const TOWN_TILESET_ID = "scarloxy_chipset_monster_town_kit";
const INTERIOR_TILESET_ID = "scarloxy_chipset_monster_interior";
const GYM_TILESET_ID = "scarloxy_chipset_monster_gym_coast";

// --- 연결 좌표 -------------------------------------------------------------------------
// 계약 밖의 내부 출입구(센터·체육관 문)는 이 파일이 소유한다. 문 칸 자체는 막힌 그림이라 transfer 는 바로 아래 접근칸에 둔다.
const LIGHTHOUSE_ORIGIN = { x: 3, y: 1 } as const; // 등대 3×6 → 문 (4,6)
const ARENA_ORIGIN = { x: 11, y: 1 } as const; // 물 아레나 7×7 → 문 (14,7)
const WAVE_DOORS = {
  center: { x: LIGHTHOUSE_ORIGIN.x + 1, y: LIGHTHOUSE_ORIGIN.y + 6 }, // (4,7)
  gym: { x: ARENA_ORIGIN.x + 3, y: ARENA_ORIGIN.y + 7 }, // (14,8)
} as const;
const CENTER_ARRIVAL = { x: 7, y: 8 } as const; // 센터 문 매트 (7,9) 한 칸 위
const GYM_ARRIVAL = { x: 6, y: 13 } as const; // 체육관 매트 (6..7,14) 한 칸 위

export const PKMN_B_HYPER_ORB_ITEM_ID = "item_pkmn_b_hyper_orb";
const CAPTURE_ORB_ITEM_ID = "item_capture_orb";
// 슈퍼 구슬은 A 지역이 만든다(installScarloxyPokemonRegions 가 A 를 먼저 설치한다).
const WAVE_SHOP_ITEM_IDS = [CAPTURE_ORB_ITEM_ID, PKMN_A_SUPER_ORB_ITEM_ID, PKMN_B_HYPER_ORB_ITEM_ID, "item_potion", "item_hi_potion", "item_antidote", "item_wake_herb"] as const;

// --- 공용 이벤트 헬퍼 (A 지역과 같은 모양) -------------------------------------------

function facingGraphic(role: ScarloxyCastRole, direction: Dir): EventPage["graphic"] {
  const entry = SCARLOXY_CAST[role];
  return {
    sprite: { type: "bundled", id: entry.charsetTextureKey },
    direction,
    pattern: charsetFrameIndex({ characterIndex: entry.index, direction, pattern: 1 }),
  };
}

function castTalker(id: string, x: number, y: number, role: ScarloxyCastRole, lines: readonly string[], options: {
  speaker?: string; extra?: readonly Command[]; wander?: boolean; direction?: Dir;
} = {}): GameEvent {
  const speaker = options.speaker ?? SCARLOXY_CAST[role].label;
  return event(id, x, y, [
    page(id + "_page", speaker, [...castLines(role, lines, speaker), ...(options.extra ?? [])],
      options.direction ? facingGraphic(role, options.direction) : castGraphic(role),
      options.wander ? WANDER_MOVEMENT : PASSIVE_MOVEMENT),
  ]);
}

function signEvent(id: string, x: number, y: number, name: string, lines: readonly string[], extra: readonly Command[] = []): GameEvent {
  return event(id, x, y, [
    page(id + "_page", name, [...lines.map((body) => ({ kind: "text", speaker: name, body }) satisfies Command), ...extra], NO_GRAPHIC, PASSIVE_MOVEMENT),
  ]);
}

/** 한 번만 줍는 조사 칸(조개·밧줄 더미 등). 주운 뒤에는 빈 대사 페이지. */
function pickupEvent(id: string, x: number, y: number, name: string, body: string, itemId: string, amount: number, after: string): GameEvent {
  return event(id, x, y, [
    page(id + "_find", name, [
      { kind: "text", body },
      { kind: "changeItem", itemId, op: "+=", amount },
      { kind: "setSelfSwitch", key: "A", value: true },
    ], NO_GRAPHIC, PASSIVE_MOVEMENT),
    page(id + "_done", name, [{ kind: "text", body: after }], NO_GRAPHIC, PASSIVE_MOVEMENT, [{ kind: "selfSwitch", key: "A", value: true }]),
  ]);
}

/** 지면 파도 회복 센터로 돌아가 회복한다. */
function whiteoutCommands(): Command[] {
  return [
    { kind: "text", body: "눈앞이 캄캄해졌다…" },
    { kind: "transfer", mapId: PKMN_MAPS.waveCenter, x: CENTER_ARRIVAL.x, y: CENTER_ARRIVAL.y, fade: "black" },
    { kind: "recoverAll" },
    { kind: "text", speaker: SCARLOXY_CAST.nurse.label, body: "정신이 드셨나요? 몬스터들은 모두 회복해 두었어요. 바닷바람 맞으며 조금 쉬었다 가세요." },
  ];
}

type TrainerSpec = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly role: ScarloxyCastRole;
  readonly speaker: string;
  readonly facing: Dir;
  readonly troopId: string;
  readonly intro: readonly string[];
  readonly lose: string;
  readonly after: readonly string[];
  readonly range?: number;
};

/** 시선 트레이너 — A 지역 trainerEvent 와 같다(이기면 셀프 스위치 A → 둘째 페이지). */
function trainerEvent(spec: TrainerSpec): GameEvent {
  const graphic = facingGraphic(spec.role, spec.facing);
  const battle: Command = {
    kind: "battleProcessing",
    troopId: spec.troopId,
    canEscape: false,
    canLose: true,
    branchOnResult: true,
    victoryBranch: [
      { kind: "text", speaker: spec.speaker, body: spec.lose },
      { kind: "setSelfSwitch", key: "A", value: true },
    ],
    defeatBranch: whiteoutCommands(),
    escapeBranch: [],
  };
  const challenge: EventPage = {
    ...page(spec.id + "_battle", spec.speaker, [...castLines(spec.role, spec.intro, spec.speaker), battle], graphic, PASSIVE_MOVEMENT),
    detectionEncounter: {
      sight: { range: spec.range ?? 4, lineOfSight: true, facing: "forward" },
      emote: "exclamation",
      emoteMs: 600,
      approachSpeed: 4,
    },
  };
  const after = page(spec.id + "_after", spec.speaker, castLines(spec.role, spec.after, spec.speaker), graphic, PASSIVE_MOVEMENT, [
    { kind: "selfSwitch", key: "A", value: true },
  ]);
  return event(spec.id, spec.x, spec.y, [challenge, after]);
}

// --- DB 레코드: 야생·트레이너 몬스터 ------------------------------------------------

type BaseStats = { maxHp: number; maxMp: number; attack: number; defense: number; mind: number; agility: number };

/** 데모 기존 종(scarloxyPokemonDemoGame.ts SPECIES_SEEDS) 중 이 지역이 쓰는 종의 기본 능력치. */
const BASE_SPECIES: Readonly<Record<string, { name: string; stats: BaseStats; skills: readonly string[] }>> = {
  cindrill: { name: "신드릴", stats: { maxHp: 30, maxMp: 10, attack: 15, defense: 11, mind: 12, agility: 14 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_ember", "skill_scarloxy_scratch"] },
  gulfin: { name: "걸핀", stats: { maxHp: 32, maxMp: 10, attack: 14, defense: 12, mind: 13, agility: 13 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_splash", "skill_scarloxy_ice"] },
  cleaf: { name: "클리프", stats: { maxHp: 30, maxMp: 9, attack: 13, defense: 14, mind: 11, agility: 10 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_leaf", "skill_scarloxy_venom"] },
  plumette: { name: "플루메트", stats: { maxHp: 16, maxMp: 5, attack: 8, defense: 6, mind: 7, agility: 16 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_wing", "skill_scarloxy_leaf"] },
  pluma: { name: "플루마", stats: { maxHp: 34, maxMp: 9, attack: 14, defense: 10, mind: 11, agility: 20 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_wing", "skill_scarloxy_leaf"] },
  puddlup: { name: "퍼들업", stats: { maxHp: 20, maxMp: 8, attack: 9, defense: 10, mind: 12, agility: 10 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_splash", "skill_scarloxy_mud"] },
  jacana: { name: "자카나", stats: { maxHp: 21, maxMp: 6, attack: 9, defense: 8, mind: 9, agility: 15 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_splash", "skill_scarloxy_wing"] },
  pouch: { name: "파우치", stats: { maxHp: 26, maxMp: 6, attack: 10, defense: 11, mind: 8, agility: 8 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_splash", "skill_scarloxy_mud"] },
  friolera: { name: "프리올레라", stats: { maxHp: 34, maxMp: 12, attack: 12, defense: 11, mind: 15, agility: 11 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_ice", "skill_scarloxy_splash"] },
  emberkit: { name: "엠버킷", stats: { maxHp: 18, maxMp: 8, attack: 12, defense: 8, mind: 10, agility: 14 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_ember", "skill_scarloxy_quick"] },
  draem: { name: "드림", stats: { maxHp: 24, maxMp: 10, attack: 10, defense: 9, mind: 14, agility: 10 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_shadow", "skill_scarloxy_mind"] },
};

function extraSpecies(key: string) {
  const seed = SCARLOXY_EXTRA_SPECIES_SEEDS.find((entry) => entry.key === key);
  if (!seed) throw new Error("새 종 목록에 " + key + " 가 없습니다.");
  return seed;
}

function speciesInfo(key: string, level: number): { name: string; stats: BaseStats; skills: string[] } {
  const base = BASE_SPECIES[key];
  if (base) return { name: base.name, stats: base.stats, skills: [...base.skills] };
  const seed = extraSpecies(key);
  const learned = seed.moves.filter((move) => move.level <= level).map((move) => move.skillId);
  return { name: seed.name, stats: seed.stats, skills: [DEFAULT_SKILL_ID, ...learned.slice(-2)] };
}

/** A 지역과 같은 배수(Gen1 공식 + HP 배수). */
const WILD_HP_MULTIPLIER = 1.5;
const TRAINER_HP_MULTIPLIER = 1.7;
const LEADER_HP_MULTIPLIER = 2.0;
function scaledStats(base: BaseStats, level: number, multiplier: number): BaseStats {
  const stats = monsterBattleStatsForSpecies({ id: "pkmn_b_scale", name: "", baseStats: base } as MonsterSpeciesRecord, level, undefined);
  return { ...stats, maxHp: Math.round(stats.maxHp * multiplier) };
}

type EnemySpec = { readonly key: string; readonly level: number; readonly trainer?: boolean; readonly leader?: boolean; readonly label?: string };

function enemyId(spec: EnemySpec): string {
  return "enemy_pkmn_b_" + (spec.leader ? "leader_" : spec.trainer ? "t_" : "") + spec.key + "_" + spec.level;
}

function enemyRecord(spec: EnemySpec) {
  const info = speciesInfo(spec.key, spec.level);
  const exp = Math.round((2 + spec.level * 1.4) * (spec.trainer ? 1.5 : 1));
  return demoEnemy(enemyId(spec), spec.label ?? info.name, "scarloxy-monster-" + spec.key, scaledStats(info.stats, spec.level, spec.leader ? LEADER_HP_MULTIPLIER : spec.trainer ? TRAINER_HP_MULTIPLIER : WILD_HP_MULTIPLIER), {
    exp,
    gold: spec.level * (spec.trainer ? 4 : 1),
  }, info.skills, { level: spec.level, speciesId: "species_scarloxy_" + spec.key });
}

const FOREST_BACKDROP = "scarloxy-backdrop-forest";
const GYM_BACKDROP = "scarloxy-backdrop-gym";
const SAND_BACKDROP = "scarloxy-backdrop-sand";

type TroopSpec = { readonly id: string; readonly name: string; readonly backdrop: string; readonly members: readonly EnemySpec[]; readonly trainer?: boolean };

const WILD_ROUTE3: readonly TroopSpec[] = [
  { id: "troop_pkmn_b_route3_zaplet", name: "3번 도로의 찌릿냥", backdrop: FOREST_BACKDROP, members: [{ key: "zaplet", level: 12 }] },
  { id: "troop_pkmn_b_route3_voltail", name: "3번 도로의 번개꼬리", backdrop: FOREST_BACKDROP, members: [{ key: "voltail", level: 15 }] },
  { id: "troop_pkmn_b_route3_plumette", name: "3번 도로의 플루메트", backdrop: FOREST_BACKDROP, members: [{ key: "plumette", level: 13 }] },
  { id: "troop_pkmn_b_route3_pluma", name: "3번 도로의 플루마", backdrop: FOREST_BACKDROP, members: [{ key: "pluma", level: 16 }] },
  { id: "troop_pkmn_b_route3_hornbeet", name: "3번 도로의 뿔장수", backdrop: FOREST_BACKDROP, members: [{ key: "hornbeet", level: 14 }] },
  { id: "troop_pkmn_b_route3_toxtoad", name: "3번 도로의 독두꺼", backdrop: FOREST_BACKDROP, members: [{ key: "toxtoad", level: 13 }] },
  { id: "troop_pkmn_b_route3_emberkit", name: "3번 도로의 엠버킷", backdrop: FOREST_BACKDROP, members: [{ key: "emberkit", level: 14 }] },
  { id: "troop_pkmn_b_route3_draem", name: "떠도는 드림", backdrop: FOREST_BACKDROP, members: [{ key: "draem", level: 18 }] },
];
const ROUTE3_WEIGHTS: Readonly<Record<string, number>> = {
  troop_pkmn_b_route3_zaplet: 3, troop_pkmn_b_route3_voltail: 2, troop_pkmn_b_route3_plumette: 3, troop_pkmn_b_route3_pluma: 1,
  troop_pkmn_b_route3_hornbeet: 2, troop_pkmn_b_route3_toxtoad: 3, troop_pkmn_b_route3_emberkit: 2, troop_pkmn_b_route3_draem: 1,
};

export const PKMN_B_TROOPS = {
  gymA: "troop_pkmn_b_gym_trainer_a",
  gymB: "troop_pkmn_b_gym_trainer_b",
  leader: "troop_pkmn_b_water_leader",
  rivalWater: "troop_pkmn_b_rival_water",
  rivalGrass: "troop_pkmn_b_rival_grass",
  rivalFire: "troop_pkmn_b_rival_fire",
  route3Camper: "troop_pkmn_b_route3_camper",
  route3Hiker: "troop_pkmn_b_route3_hiker",
  route3Fisher: "troop_pkmn_b_route3_fisher",
} as const;

/** 라이벌 2차전 — 공통 두 마리 + 주인공 스타터에 상성이 좋은 중간 진화형(Lv18). */
function rivalTroop(id: string, starterKey: string, starterName: string): TroopSpec {
  return {
    id, name: "라이벌", backdrop: SAND_BACKDROP, trainer: true, members: [
      { key: "pluma", level: 16, trainer: true, label: "라이벌의 플루마" },
      { key: "voltail", level: 17, trainer: true, label: "라이벌의 번개꼬리" },
      { key: starterKey, level: 18, trainer: true, leader: true, label: "라이벌의 " + starterName },
    ],
  };
}

const TRAINER_TROOPS: readonly TroopSpec[] = [
  { id: PKMN_B_TROOPS.gymA, name: "체육관 트레이너 바다", backdrop: GYM_BACKDROP, trainer: true, members: [{ key: "puddlup", level: 14, trainer: true }, { key: "jacana", level: 15, trainer: true }] },
  { id: PKMN_B_TROOPS.gymB, name: "체육관 트레이너 조약돌", backdrop: GYM_BACKDROP, trainer: true, members: [{ key: "pouch", level: 15, trainer: true }, { key: "toxtoad", level: 15, trainer: true }] },
  { id: PKMN_B_TROOPS.leader, name: "파도 체육관 관장 미르", backdrop: GYM_BACKDROP, trainer: true, members: [
    { key: "jacana", level: 16, trainer: true, leader: true, label: "관장의 자카나" },
    { key: "pouch", level: 17, trainer: true, leader: true, label: "관장의 파우치" },
    { key: "friolera", level: 18, trainer: true, leader: true, label: "관장의 프리올레라" },
  ] },
  rivalTroop(PKMN_B_TROOPS.rivalWater, "gulfin", "걸핀"),
  rivalTroop(PKMN_B_TROOPS.rivalGrass, "cleaf", "클리프"),
  rivalTroop(PKMN_B_TROOPS.rivalFire, "cindrill", "신드릴"),
  { id: PKMN_B_TROOPS.route3Camper, name: "캠프걸 하늘", backdrop: FOREST_BACKDROP, trainer: true, members: [{ key: "voltail", level: 15, trainer: true }, { key: "pluma", level: 16, trainer: true }] },
  { id: PKMN_B_TROOPS.route3Hiker, name: "등산가 우직", backdrop: FOREST_BACKDROP, trainer: true, members: [{ key: "bouldurr", level: 16, trainer: true }, { key: "brawlape", level: 16, trainer: true }] },
  { id: PKMN_B_TROOPS.route3Fisher, name: "낚시꾼 너울", backdrop: FOREST_BACKDROP, trainer: true, members: [{ key: "puddlup", level: 15, trainer: true }, { key: "toxtoad", level: 16, trainer: true }, { key: "pouch", level: 17, trainer: true }] },
];

function troopRecord(spec: TroopSpec) {
  return demoTroop(spec.id, spec.name, spec.backdrop, spec.members.map((member, index) => ({
    enemyId: enemyId(member), x: 160 - index * 8, y: 132,
  })), spec.trainer ? { uncapturable: true, trainerBattle: true } : {});
}

export type PkmnRegionBRecords = {
  readonly enemies: ReturnType<typeof enemyRecord>[];
  readonly troops: ReturnType<typeof troopRecord>[];
  readonly items: ReturnType<typeof normalizeItemRecord>[];
};

/** B 지역이 새로 쓰는 적·무리·아이템(하이퍼 구슬). 기존 DB 레코드는 다시 만들지 않는다. */
export function createPkmnRegionBRecords(): PkmnRegionBRecords {
  const troops = [...WILD_ROUTE3, ...TRAINER_TROOPS];
  const enemySpecs = new Map<string, EnemySpec>();
  for (const troop of troops) for (const member of troop.members) {
    const id = enemyId(member);
    if (!enemySpecs.has(id)) enemySpecs.set(id, member);
  }
  return {
    enemies: [...enemySpecs.values()].map(enemyRecord),
    troops: troops.map(troopRecord),
    items: [
      normalizeItemRecord({
        id: PKMN_B_HYPER_ORB_ITEM_ID,
        name: "하이퍼 구슬",
        type: "special",
        scope: "enemy",
        price: 600,
        description: "슈퍼 구슬보다 더 잘 잡히는 구슬입니다. 파도 마을 센터에서 팝니다.",
        imageResourceId: "cc0-jetrel-capture-orb",
        iconResourceId: "cc0-jetrel-capture-orb",
        occasion: "battle",
        occasionField: false,
        occasionBattle: true,
        consumable: true,
        captureProfile: { multiplier: 2, ballClass: "ultra" },
      }),
    ],
  };
}

function encounterTable(regions: readonly Rect[], weights: Readonly<Record<string, number>>): EncounterTableEntry[] {
  return regions.flatMap((region) => Object.entries(weights).map(([troopId, weight]) => ({
    troopId, weight, conditions: { region: { ...region } },
  })));
}

function blankMap(key: keyof typeof PKMN_MAPS, name: string, tilesetId: string, lower: number): GameMap {
  const [width, height] = PKMN_MAP_SIZES[key];
  return {
    id: PKMN_MAPS[key],
    name,
    width,
    height,
    tilesetId,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles: new Array<number>(width * height).fill(lower),
    upperTiles: new Array<number>(width * height).fill(EMPTY),
    events: [],
  };
}

function rectIndices(topLeft: number, width: number, height: number): number[][] {
  return Array.from({ length: height }, (_, row) => Array.from({ length: width }, (_, col) => topLeft + row * 30 + col));
}

// --- 파도 마을 (gym_coast 32×22) ------------------------------------------------------
// 참고문서 B 절: 모서리 점마다 재료를 정하고(cx ≥ s → sea, s−3 ≤ cx < s → wet, 그 밖 dry), 네 모서리 조합으로 1층 칸을 고른다.

type Material = "sea" | "wet" | "dry";
/** 「칸 사전 · 모서리 재료」 표 — [왼위 · 오른위 · 왼아래 · 오른아래] → 칸 번호. */
const CORNER_TILES: Readonly<Record<string, number>> = {
  "sea,sea,sea,sea": 204, "dry,dry,dry,dry": 34, "wet,wet,wet,wet": 491,
  "sea,sea,sea,wet": 660, "sea,sea,wet,wet": 661, "sea,sea,wet,sea": 662,
  "sea,wet,sea,wet": 690, "wet,sea,wet,sea": 692,
  "sea,wet,sea,sea": 720, "wet,wet,sea,sea": 721, "wet,sea,sea,sea": 722,
  "wet,wet,wet,sea": 663, "wet,wet,sea,wet": 664, "wet,sea,wet,wet": 693, "sea,wet,wet,wet": 694,
  "wet,wet,wet,dry": 665, "wet,wet,dry,dry": 666, "wet,wet,dry,wet": 667,
  "wet,dry,wet,dry": 695, "dry,wet,dry,wet": 697,
  "wet,dry,wet,wet": 725, "dry,dry,wet,wet": 726, "dry,wet,wet,wet": 727,
  "dry,dry,dry,wet": 668, "dry,dry,wet,dry": 669, "dry,wet,dry,dry": 698, "wet,dry,dry,dry": 699,
};
/** 해안선 s(모서리 줄 0..22). 줄마다 ±1 까지만 바꾼다. */
const WAVE_SHORE: readonly number[] = [27, 27, 27, 26, 26, 26, 25, 25, 25, 25, 25, 25, 25, 26, 26, 27, 27, 27, 28, 28, 28, 28, 28];
const WET_BAND = 3;
const PIER = { x0: 21, x1: 30, y0: 9, y1: 10 } as const;

const C = {
  PIER_DECK: 488,
  PIER_FRONT: 490,
  SEA: 204,
  LIGHTHOUSE: rectIndices(750, 3, 6),
  ARENA_WATER: rectIndices(290, 7, 7),
  PALM: rectIndices(110, 2, 3),
  PALM_ALT: rectIndices(112, 2, 3),
  PALM_SMALL: [[114], [144]] as number[][],
  ROWBOAT: rectIndices(873, 3, 2),
  UMBRELLA: rectIndices(881, 2, 2),
  DRIFTWOOD: [[917, 918]] as number[][],
  BOLLARD: 906,
  BUOY: 907,
  ROPE: 908,
  PALM_SHRUB: 909,
  COCONUT: 910,
  SPIRAL: 913,
  SCALLOP: 914,
  STARFISH: 915,
  SEA_ROCK: 916,
  SAND_ROCK_1: 117,
  SAND_ROCK_2: 118,
} as const;

function coastLower(width: number, height: number, shore: readonly number[]): number[] {
  const material = (cx: number, cy: number): Material => {
    const s = shore[cy]!;
    return cx >= s ? "sea" : cx >= s - WET_BAND ? "wet" : "dry";
  };
  const tiles: number[] = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const key = [material(x, y), material(x + 1, y), material(x, y + 1), material(x + 1, y + 1)].join(",");
    const tile = CORNER_TILES[key];
    if (tile === undefined) throw new Error("해안 모서리 조합 " + key + " 에 맞는 칸이 없습니다 (" + x + "," + y + ").");
    tiles.push(tile);
  }
  return tiles;
}

/** 관문 경비원 칸 — 남쪽 출구 (16,21) 로 가는 한 칸 골목(16,20) 바로 위. */
const WAVE_GATE_GUARD = { x: 16, y: 19 } as const;
const WAVE_RIVAL = { x: 30, y: 10 } as const;

export function createWaveTownMap(): GameMap {
  const map = blankMap("waveTown", "파도 마을", GYM_TILESET_ID, 34);
  map.lowerTiles = coastLower(map.width, map.height, WAVE_SHORE);
  const at = (x: number, y: number) => y * map.width + x;

  // 부두: 모래에서 바다로 뻗는 가로 판자, 바로 아래 줄의 바다 칸만 말뚝 앞면.
  for (let y = PIER.y0; y <= PIER.y1; y += 1) for (let x = PIER.x0; x <= PIER.x1; x += 1) map.lowerTiles[at(x, y)] = C.PIER_DECK;
  for (let x = PIER.x0; x <= PIER.x1; x += 1) if (map.lowerTiles[at(x, PIER.y1 + 1)] === C.SEA) map.lowerTiles[at(x, PIER.y1 + 1)] = C.PIER_FRONT;

  // 건물: 등대 = 파도 회복 센터, 물 아레나 외관 = 체육관.
  stampUpper(map, LIGHTHOUSE_ORIGIN.x, LIGHTHOUSE_ORIGIN.y, C.LIGHTHOUSE);
  stampUpper(map, ARENA_ORIGIN.x, ARENA_ORIGIN.y, C.ARENA_WATER);

  // 야자(밑동만 막힌다). 서쪽 가장자리는 바위굴 출구 (0,10) 줄만 비운다.
  for (const [x, y] of [[0, 0], [0, 4], [0, 13], [0, 17], [8, 1], [20, 1], [7, 12], [21, 15]] as const) stampUpper(map, x, y, C.PALM);
  for (const [x, y] of [[19, 4], [2, 9], [10, 16]] as const) stampUpper(map, x, y, C.PALM_ALT);
  for (const [x, y] of [[9, 9], [18, 11]] as const) stampUpper(map, x, y, C.PALM_SMALL);

  // 해변 소품: 파라솔·유목·야자열매는 마른 모래, 조개·불가사리는 젖은 모래, 배·부표·바다 바위는 바다.
  stampUpper(map, 16, 13, C.UMBRELLA);
  stampUpper(map, 12, 13, C.DRIFTWOOD);
  setUpper(map, 6, 8, C.COCONUT);
  stampUpper(map, 27, 13, C.ROWBOAT);
  setUpper(map, 30, 4, C.BUOY);
  setUpper(map, 29, 17, C.SEA_ROCK);
  setUpper(map, 30, 1, C.SEA_ROCK);
  setUpper(map, 24, 3, C.SPIRAL);
  setUpper(map, 25, 17, C.STARFISH);
  setUpper(map, 24, 14, C.SCALLOP);
  // 부두: 위 줄 가장자리에 계류 기둥, 아래 줄은 걸어갈 길로 비운다. 끝에 밧줄 더미(통행 가능).
  setUpper(map, 24, PIER.y0, C.BOLLARD);
  setUpper(map, 28, PIER.y0, C.BOLLARD);
  setUpper(map, 26, PIER.y1, C.ROPE);

  // 남쪽 경계: 야자 덤불·열매 두 줄, 3번 도로 골목(16열)만 비운다.
  for (let x = 4; x <= 24; x += 1) {
    if (x === WAVE_GATE_GUARD.x) continue;
    setUpper(map, x, 20, (x % 3 === 0) ? C.COCONUT : C.PALM_SHRUB);
    setUpper(map, x, 21, C.PALM_SHRUB);
  }

  // 표지석(사막 바위 + 같은 칸 조사 이벤트).
  const signs = {
    town: { x: 3, y: 8 },
    gym: { x: 16, y: 8 },
    south: { x: 18, y: 18 },
  } as const;
  setUpper(map, signs.town.x, signs.town.y, C.SAND_ROCK_1);
  setUpper(map, signs.gym.x, signs.gym.y, C.SAND_ROCK_2);
  setUpper(map, signs.south.x, signs.south.y, C.SAND_ROCK_1);

  map.events.push(
    transferEvent("ev_pkmn_b_wave_to_cave1", 0, 10, PKMN_MAPS.cave1, 28, 12, "바위굴로"),
    transferEvent("ev_pkmn_b_wave_to_route3", 16, 21, PKMN_MAPS.route3, 12, 1, "3번 도로로"),
    transferEvent("ev_pkmn_b_wave_door_center", WAVE_DOORS.center.x, WAVE_DOORS.center.y, PKMN_MAPS.waveCenter, CENTER_ARRIVAL.x, CENTER_ARRIVAL.y, "파도 회복 센터로"),
    transferEvent("ev_pkmn_b_wave_door_gym", WAVE_DOORS.gym.x, WAVE_DOORS.gym.y, PKMN_MAPS.waterGym, GYM_ARRIVAL.x, GYM_ARRIVAL.y, "물 체육관으로"),
    signEvent("ev_pkmn_b_wave_sign_town", signs.town.x, signs.town.y, "표지석", [
      "파도 마을 — 등대 불빛이 뱃길을 지키는 바닷가 마을.",
      "서쪽: 바위굴 · 남쪽: 3번 도로 → 잿불 마을",
    ]),
    signEvent("ev_pkmn_b_wave_sign_gym", signs.gym.x, signs.gym.y, "표지석", [
      "파도 마을 몬스터 체육관 — 관장 미르. 「밀물은 반드시 돌아온다」",
      "물 타입에는 풀·전기 기술이 잘 통한다.",
    ]),
    signEvent("ev_pkmn_b_wave_sign_south", signs.south.x, signs.south.y, "표지석", [
      "남쪽: 3번 도로 → 잿불 마을",
      "3번 도로는 물 배지를 가진 트레이너만 지날 수 있습니다. — 파도 마을 경비대",
    ]),
    castTalker("ev_pkmn_b_wave_lighthouse_keeper", 6, 7, "gentleman", [
      "이 등대 1층이 회복 센터라네. 불빛은 뱃사람을, 센터는 트레이너를 지키지.",
      "간호사 말로는 하이퍼 구슬이 새로 들어왔다더군. 3번 도로의 날쌘 몬스터에게 써 보게.",
    ], { speaker: "등대지기" }),
    castTalker("ev_pkmn_b_wave_swimmer", 22, 6, "swimmer", [
      "파도타기는 아직 못 하지만, 물가를 걷는 것만으로도 기분이 좋아!",
      "관장 미르의 프리올레라는 얼음 기술도 써. 풀 몬스터는 조심해.",
    ], { speaker: "수영선수", wander: true }),
    castTalker("ev_pkmn_b_wave_fisher", 22, 8, "fisherman", [
      "부두 끝에 네 또래 트레이너가 한참 서 있더라. 누굴 기다리는 눈치던데?",
    ], { speaker: "낚시꾼", direction: "down" }),
    castTalker("ev_pkmn_b_wave_girl", 12, 11, "camperGirl", [
      "체육관 안에도 차단기가 있대. 바닥 스위치를 찾아봐!",
      "모래사장에 떨어진 조개껍데기, 가끔 쓸 만한 게 섞여 있어.",
    ], { speaker: "캠프걸", wander: true }),
    castTalker("ev_pkmn_b_wave_boy", 9, 15, "villagerA", [
      "남쪽 3번 도로 풀숲엔 찌릿냥이 많아. 물 몬스터로 상대하면 고생할걸.",
    ], { speaker: "금발 소년" }),
    pickupEvent("ev_pkmn_b_wave_shell", 24, 3, "소라껍데기", "소라껍데기 안에 무언가 들어 있다… 상처약을 손에 넣었다!", "item_potion", 1, "텅 빈 소라껍데기다. 귀에 대면 파도 소리가 난다."),
    pickupEvent("ev_pkmn_b_wave_star", 25, 17, "불가사리", "불가사리 밑에 구슬이 묻혀 있었다! 슈퍼 구슬을 손에 넣었다!", PKMN_A_SUPER_ORB_ITEM_ID, 1, "불가사리가 햇볕을 쬐고 있다."),
    rivalEvent(),
    ...waveGateGuardEvents(),
  );
  return map;
}

/** 관문 경비원 — 배지 없음: 골목 (16,19) 을 막는다. 배지 있음: 빈 아래층 페이지로 비키고 (17,19) 에 서서 인사한다. */
function waveGateGuardEvents(): GameEvent[] {
  const speaker = "경비원";
  const blocking = page("ev_pkmn_b_wave_gate_guard_block", speaker, castLines("hiker", [
    "여기서부터 3번 도로다. 풀숲 몬스터가 거칠어서 물 배지가 없는 트레이너는 보낼 수 없네.",
    "마을 북쪽 물 체육관에서 관장 미르에게 이기고 오게.",
  ], speaker), facingGraphic("hiker", "up"), PASSIVE_MOVEMENT);
  const cleared: EventPage = {
    ...page("ev_pkmn_b_wave_gate_guard_clear", "비켜 선 자리", [], NO_GRAPHIC, PASSIVE_MOVEMENT, [
      { kind: "switch", switchId: PKMN_FLAGS.badge2, value: true },
    ]),
    priority: "below",
  };
  const guard = event("ev_pkmn_b_wave_gate_guard", WAVE_GATE_GUARD.x, WAVE_GATE_GUARD.y, [blocking]);
  guard.pages?.push(cleared);
  const aside = event("ev_pkmn_b_wave_gate_guard_aside", WAVE_GATE_GUARD.x + 1, WAVE_GATE_GUARD.y, [
    page("ev_pkmn_b_wave_gate_guard_aside_page", speaker, castLines("hiker", [
      "물 배지로군! 지나가게. 3번 도로 남쪽 끝이 잿불 마을이야.",
    ], speaker), facingGraphic("hiker", "left"), PASSIVE_MOVEMENT, [
      { kind: "switch", switchId: PKMN_FLAGS.badge2, value: true },
    ]),
  ]);
  return [guard, aside];
}

/** 라이벌 2차전 배틀 — 이기면 sw_pkmn_rival_2, 지면 센터. */
function rivalBattle(troopId: string): Command {
  return {
    kind: "battleProcessing",
    troopId,
    canEscape: false,
    canLose: true,
    branchOnResult: true,
    victoryBranch: [
      ...castLines("rival", [
        "…또 졌어. 바다 앞에서 폼 좀 잡으려 했는데.",
        "좋아, 인정할게. 하지만 잿불 마을 체육관은 내가 먼저 깬다!",
      ]),
      { kind: "setSwitch", switchId: PKMN_FLAGS.rival2, value: true },
      { kind: "changeGold", op: "+=", amount: 800 },
      { kind: "text", body: "라이벌에게서 800골드를 받았다!" },
    ],
    defeatBranch: whiteoutCommands(),
    escapeBranch: [],
  };
}

/**
 * 부두 끝 라이벌 — var_pkmn_starter 로 무리를 고른다(1 불 → 물 걸핀, 2 물 → 풀 클리프, 3 풀 → 불 신드릴).
 * 스타터 변수가 없으면(0) 불 신드릴 무리.
 */
function rivalEvent(): GameEvent {
  const byStarter: Command = {
    kind: "fork",
    condition: { kind: "variable", variableId: PKMN_STARTER_VARIABLE, op: "==", value: 1 },
    then: [rivalBattle(PKMN_B_TROOPS.rivalWater)],
    else: [{
      kind: "fork",
      condition: { kind: "variable", variableId: PKMN_STARTER_VARIABLE, op: "==", value: 2 },
      then: [rivalBattle(PKMN_B_TROOPS.rivalGrass)],
      else: [rivalBattle(PKMN_B_TROOPS.rivalFire)],
    }],
  };
  const graphic = facingGraphic("rival", "left");
  return event("ev_pkmn_b_wave_rival", WAVE_RIVAL.x, WAVE_RIVAL.y, [
    page("ev_pkmn_b_wave_rival_battle", SCARLOXY_CAST.rival.label, [
      ...castLines("rival", [
        "왔구나! 바위굴에서 헤매는 줄 알았지.",
        "네가 오는 동안 내 파트너도 진화했어. 상성까지 딱 맞춰서 말이야.",
        "바다를 배경으로 한판 붙자!",
      ]),
      byStarter,
    ], graphic, PASSIVE_MOVEMENT),
    page("ev_pkmn_b_wave_rival_after", SCARLOXY_CAST.rival.label, castLines("rival", [
      "다음엔 안 져. 잿불 마을에서 기다릴 테니까 천천히 와도 돼.",
      "…물 배지는 받았어? 경비원이 남쪽 길을 막고 있더라.",
    ]), graphic, PASSIVE_MOVEMENT, [
      { kind: "switch", switchId: PKMN_FLAGS.rival2, value: true },
    ]),
  ]);
}


// --- 파도 회복 센터 (monster_interior 15×11) ----------------------------------------
// 이끼 회복 센터와 같은 배열(참고문서 「완성 예제 · 몬스터 회복 센터 15×11」 + 왼쪽 계산대).

export function createWaveCenterMap(): GameMap {
  const map = blankMap("waveCenter", "파도 회복 센터", INTERIOR_TILESET_ID, 1);
  const lower = [
    [10, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 12],
    [40, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 42],
    [40, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 45, 42],
    [40, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 42],
    [40, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 42],
    [40, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 42],
    [40, 1, 1, 1, 1, 1, 7, 8, 9, 1, 1, 1, 1, 1, 42],
    [40, 1, 1, 1, 1, 1, 37, 38, 39, 1, 1, 1, 1, 1, 42],
    [40, 1, 1, 1, 1, 1, 67, 68, 69, 1, 1, 1, 1, 1, 42],
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

  const nurse = "nurse" as const;
  map.events.push(
    transferEvent("ev_pkmn_b_center_exit", 7, 9, PKMN_MAPS.waveTown, WAVE_DOORS.center.x, WAVE_DOORS.center.y + 1, "밖으로"),
    castTalker("ev_pkmn_b_center_nurse", 7, 3, nurse, ["어서 오세요. 카운터 앞에서 말씀해 주세요."]),
    event("ev_pkmn_b_center_heal", 7, 5, [
      page("ev_pkmn_b_center_heal_page", SCARLOXY_CAST.nurse.label, [
        ...castLines(nurse, ["등대 아래 파도 회복 센터에 오신 걸 환영합니다.", "몬스터들을 맡아 회복시켜 드릴게요. 잠시만요…"]),
        { kind: "recoverAll" },
        { kind: "text", speaker: SCARLOXY_CAST.nurse.label, body: "모두 건강해졌어요! 좋은 항해 되세요." },
      ], NO_GRAPHIC, PASSIVE_MOVEMENT),
    ]),
    castTalker("ev_pkmn_b_center_clerk", 2, 3, "clerk", ["계산대 앞에서 말씀해 주세요!"]),
    event("ev_pkmn_b_center_shop", 2, 5, [
      page("ev_pkmn_b_center_shop_page", SCARLOXY_CAST.clerk.label, [
        ...castLines("clerk", ["어서 오세요! 배로 막 들어온 하이퍼 구슬이 있어요."]),
        {
          kind: "shop",
          itemIds: [...WAVE_SHOP_ITEM_IDS],
          allowSell: true,
          quantityMode: "select",
          shopType: "normal",
          messageType: "welcome",
        },
      ], NO_GRAPHIC, PASSIVE_MOVEMENT),
    ]),
    signEvent("ev_pkmn_b_center_pc", 13, 4, "PC", [
      "몬스터 보관 PC다. 파티와 보관함은 메뉴의 「몬스터」에서 바꿀 수 있다.",
    ]),
    castTalker("ev_pkmn_b_center_sailor", 11, 6, "fisherman", [
      "관장 미르는 원래 뱃사람이었어. 폭풍 속에서도 키를 놓지 않았다지.",
      "물 몬스터에는 풀이나 전기 기술을 준비해 가.",
    ], { speaker: "뱃사람" }),
    castTalker("ev_pkmn_b_center_visitor", 3, 9, "swimmer", [
      "3번 도로 풀숲엔 번개꼬리가 나온대. 물 몬스터만 데려가면 큰일 나!",
    ], { speaker: "수영선수" }),
  );
  return map;
}

// --- 물 체육관 (gym_coast 14×15) -----------------------------------------------------
// 「완성 예제 · 풀 체육관 14×15」의 물 속성 치환: 바닥 486/487, 벽 516/546, 문장 517/518·547/548,
// 단상 leader-podium-water, 조각상 badge-statue-water, 장식은 분수대 2×2(화분 자리 두 칸 폭).

const GYM_BARRIER_OPEN = 634;
const GYM_SWITCH_ON = 632;
const GYM_SWITCH = { x: 11, y: 10 } as const;
const GYM_GATE_CELLS = [{ x: 6, y: 8 }, { x: 7, y: 8 }] as const;

export function createWaterGymMap(): GameMap {
  const map = blankMap("waterGym", "파도 마을 물 체육관", GYM_TILESET_ID, 486);
  const F = 486; // 물 바닥 A
  const D = 487; // 물방울 문양 B
  const floorRow = (y: number): number[] => [520, ...Array.from({ length: 12 }, (_, i) => ((i + 1) % 4 === 2 && y % 4 === 0 ? D : F)), 521];
  const lower = [
    [519, 519, 519, 519, 519, 519, 519, 519, 519, 519, 519, 519, 519, 519],
    [520, 516, 516, 516, 516, 516, 517, 518, 516, 516, 516, 516, 516, 521],
    [520, 546, 546, 546, 546, 546, 547, 548, 546, 546, 546, 546, 546, 521],
    ...Array.from({ length: 11 }, (_, i) => floorRow(i + 3)),
    [523, 522, 522, 522, 522, 525, F, F, 526, 522, 522, 522, 522, 524],
  ];
  const upper = [
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, 584, 585, -1, -1, 576, 577, 578, -1, -1, -1, 584, 585, -1],
    [-1, 614, 615, -1, -1, 606, 607, 608, -1, -1, -1, 614, 615, -1],
    [-1, -1, -1, -1, 630, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, 633, 633, 633, 633, 633, 633, 633, 633, 633, 633, 633, 633, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 631, -1, -1],
    [-1, -1, -1, 630, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, 581, -1, -1, -1, -1, 581, -1, -1, -1, -1],
    [-1, -1, -1, -1, 611, -1, -1, -1, -1, 611, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, 635, 636, -1, -1, -1, -1, -1, -1],
  ];
  map.lowerTiles = lower.flat();
  map.upperTiles = upper.flat();
  const mapId = map.id;

  const switchEvent = event("ev_pkmn_b_gym_switch", GYM_SWITCH.x, GYM_SWITCH.y, [
    page("ev_pkmn_b_gym_switch_off", "바닥 스위치", [
      { kind: "changeTile", mapId, layer: "upper", x: GYM_SWITCH.x, y: GYM_SWITCH.y, tile: GYM_SWITCH_ON },
      ...GYM_GATE_CELLS.map((cell) => ({ kind: "changeTile", mapId, layer: "upper", x: cell.x, y: cell.y, tile: GYM_BARRIER_OPEN }) satisfies Command),
      { kind: "text", body: "딸깍! 물 흐르는 소리와 함께 차단기가 내려갔다." },
      { kind: "setSelfSwitch", key: "A", value: true },
    ], NO_GRAPHIC, PASSIVE_MOVEMENT),
    page("ev_pkmn_b_gym_switch_on", "눌린 스위치", [], NO_GRAPHIC, PASSIVE_MOVEMENT, [{ kind: "selfSwitch", key: "A", value: true }]),
  ], "playerTouch", "below");

  const leader = "waterLeader" as const;
  const leaderName = "관장 미르";
  const leaderBattle: Command = {
    kind: "battleProcessing",
    troopId: PKMN_B_TROOPS.leader,
    canEscape: false,
    canLose: true,
    branchOnResult: true,
    victoryBranch: [
      ...castLines(leader, [
        "…밀물을 거슬러 올라오다니. 대단한 배짱이야.",
        "파도 마을 체육관을 이긴 증표, 물 배지를 받아 줘. 이제 남쪽 3번 도로 경비원도 길을 열어 줄 거야.",
      ], leaderName),
      { kind: "setSwitch", switchId: PKMN_FLAGS.badge2, value: true },
      { kind: "setVariable", variableId: PKMN_FLAGS.badgeCount, op: "+=", value: 1 },
      { kind: "text", body: "물 배지를 받았다!" },
      { kind: "changeItem", itemId: PKMN_B_HYPER_ORB_ITEM_ID, op: "+=", amount: 3 },
      { kind: "changeItem", itemId: "item_hi_potion", op: "+=", amount: 3 },
      { kind: "changeGold", op: "+=", amount: 1200 },
      { kind: "text", body: "하이퍼 구슬 3개와 상급 회복약 3개, 1200골드를 받았다!" },
      { kind: "text", speaker: leaderName, body: "하이퍼 구슬은 슈퍼 구슬보다도 잘 잡혀. 잿불 마을로 가는 길에 강한 몬스터를 만나면 써 봐." },
    ],
    defeatBranch: whiteoutCommands(),
    escapeBranch: [],
  };
  const leaderEvent = event("ev_pkmn_b_gym_leader", 6, 3, [
    page("ev_pkmn_b_gym_leader_battle", leaderName, [
      ...castLines(leader, [
        "어서 와, 도전자. 나는 파도 마을 체육관 관장 미르.",
        "바다는 부드럽지만 멈추지 않아. 내 파도를 견뎌 낼 수 있을까?",
      ], leaderName),
      leaderBattle,
    ], facingGraphic(leader, "down"), PASSIVE_MOVEMENT),
    page("ev_pkmn_b_gym_leader_after", leaderName, castLines(leader, [
      "물 배지, 잘 어울리네. 다음 체육관은 3번 도로 끝 잿불 마을이야.",
      "불 타입은 물 기술에 약해. 오늘 맞은 파도를 이번엔 네가 일으켜 봐!",
    ], leaderName), facingGraphic(leader, "down"), PASSIVE_MOVEMENT, [
      { kind: "switch", switchId: PKMN_FLAGS.badge2, value: true },
    ]),
  ]);

  map.events.push(
    transferEvent("ev_pkmn_b_gym_exit_l", 6, 14, PKMN_MAPS.waveTown, WAVE_DOORS.gym.x, WAVE_DOORS.gym.y + 1, "밖으로"),
    transferEvent("ev_pkmn_b_gym_exit_r", 7, 14, PKMN_MAPS.waveTown, WAVE_DOORS.gym.x, WAVE_DOORS.gym.y + 1, "밖으로"),
    switchEvent,
    leaderEvent,
    trainerEvent({
      id: "ev_pkmn_b_gym_trainer_a", x: 4, y: 5, role: "swimmer", speaker: "체육관 트레이너 바다", facing: "right",
      troopId: PKMN_B_TROOPS.gymA, range: 4,
      intro: ["관장님 앞까지 헤엄쳐 오다니! 여기서 가라앉혀 주지!"],
      lose: "물살에 휩쓸렸어…",
      after: ["관장님의 프리올레라는 얼음 기술도 써. 풀 몬스터는 조심해."],
    }),
    trainerEvent({
      id: "ev_pkmn_b_gym_trainer_b", x: 3, y: 11, role: "fisherman", speaker: "체육관 트레이너 조약돌", facing: "right",
      troopId: PKMN_B_TROOPS.gymB, range: 4,
      intro: ["스위치를 찾나? 낚아 올리기 전에 승부부터 하자!"],
      lose: "놓친 물고기가 크구먼…",
      after: ["스위치는 오른쪽 벽 가까이에 있다네. 밟으면 차단기가 내려가지."],
    }),
    castTalker("ev_pkmn_b_gym_guide", 11, 13, "gentleman", [
      "도전자여, 어서 오게! 관장 미르는 물 타입 전문이라네.",
      "차단기가 길을 막고 있지? 이 방 어딘가의 바닥 스위치를 밟아 보게.",
      "풀·전기 기술이 잘 통한다네. 얼음 기술에는 조심하고!",
    ], { speaker: "체육관 안내원", direction: "left" }),
    signEvent("ev_pkmn_b_gym_statue_l", 4, 13, "배지 조각상", ["파도 마을 체육관 — 관장 미르에게 이긴 트레이너의 이름이 새겨져 있다."]),
    signEvent("ev_pkmn_b_gym_statue_r", 9, 13, "배지 조각상", ["「밀물은 반드시 돌아온다」"]),
  );
  return map;
}


// --- 3번 도로 (town_kit 24×34) -------------------------------------------------------
// 북쪽 (12,0) ↔ 파도 마을, 남쪽 (12,33) → 잿불 마을. 양옆은 나무 벽, 가운데 길을 따라 풀숲 네 덩이와 트레이너 셋.

function kitBlock(name: string): number[][] {
  const block = MONSTER_TOWN_KIT_MANIFEST.blocks.find((entry) => entry.name === name);
  if (!block) throw new Error("몬스터 마을 부품 매니페스트에 " + name + " 블록이 없습니다.");
  return Array.from({ length: block.h }, (_, dy) =>
    Array.from({ length: block.w }, (_, dx) => (block.row + dy) * 30 + block.col + dx));
}
const K = {
  SIGNPOST: kitBlock("signpost")[0]![0]!,
  SHRUB: kitBlock("cuttable-shrub")[0]![0]!,
  CRATE: kitBlock("crate")[0]![0]!,
  BENCH: kitBlock("bench"),
  TALL_GRASS: [kitBlock("tall-grass-a")[0]![0]!, kitBlock("tall-grass-b")[0]![0]!] as const,
  FENCE: kitBlock("picket-fence")[0]!,
  FENCE_POST: kitBlock("fence-post")[0]![0]!,
} as const;

function fenceRow(map: GameMap, x0: number, x1: number, y: number): void {
  for (let x = x0; x <= x1; x += 1) setUpper(map, x, y, K.FENCE[(x - x0) % 2]!);
  setUpper(map, x1, y, K.FENCE_POST);
}

/** 조우 풀숲(두 변형 체크무늬). 이미 뭔가 있는 칸은 건너뛴다. */
function tallGrass(map: GameMap, region: Rect): void {
  for (let y = region.y; y < region.y + region.h; y += 1) for (let x = region.x; x < region.x + region.w; x += 1) {
    if (map.upperTiles[y * map.width + x] !== EMPTY) continue;
    setUpper(map, x, y, K.TALL_GRASS[(x + y) % 2]!);
  }
}

const ROUTE3_GRASS: readonly Rect[] = [
  { x: 3, y: 5, w: 7, h: 5 },
  { x: 14, y: 10, w: 7, h: 6 },
  { x: 3, y: 17, w: 8, h: 5 },
  { x: 13, y: 24, w: 7, h: 5 },
];

export function createRoute3Map(): GameMap {
  const map = blankMap("route3", "3번 도로", TOWN_TILESET_ID, G.GRASS);
  map.encounterRate = 5;
  map.troopIds = WILD_ROUTE3.map((troop) => troop.id);
  // 야생은 풀숲 안에서만 나온다(맨 잔디·길은 안전).
  map.encounterTable = encounterTable(ROUTE3_GRASS, ROUTE3_WEIGHTS);

  // 양옆 나무 벽(윗줄 두 칸은 ★, 밑동만 막힌다). 맨 아래 줄은 덤불로 마감한다.
  for (let y = 0; y <= 30; y += 3) {
    stampUpper(map, 0, y, G.GREEN_TREE);
    stampUpper(map, 22, y, G.GREEN_TREE);
  }
  for (const x of [0, 1, 22, 23]) setUpper(map, x, 33, K.SHRUB);
  // 길 안쪽 나무·연못·바위.
  for (const [x, y] of [[9, 11], [4, 26], [17, 29]] as const) stampUpper(map, x, y, G.TEAL_TREE);
  stampUpper(map, 6, 1, G.GREEN_TREE_SMALL);
  stampLower(map, 18, 19, G.POND);
  setUpper(map, 2, 14, G.ROCK_1);
  setUpper(map, 20, 7, G.ROCK_2);
  for (const [x, y] of [[12, 4], [5, 12], [19, 17], [9, 23], [15, 31]] as const) setUpper(map, x, y, G.GRASS_TUFT);

  // 북쪽 입구 양옆 울타리(10..14열은 비운다).
  fenceRow(map, 2, 9, 2);
  fenceRow(map, 15, 21, 2);
  for (const region of ROUTE3_GRASS) tallGrass(map, region);

  // 쉼터: 남쪽 벤치, 상자(숨은 도구).
  stampUpper(map, 7, 30, K.BENCH);
  setUpper(map, 20, 26, K.CRATE);
  const sign = { x: 14, y: 3 } as const;
  setUpper(map, sign.x, sign.y, K.SIGNPOST);

  map.events.push(
    transferEvent("ev_pkmn_b_route3_to_wave", 12, 0, PKMN_MAPS.waveTown, 16, 20, "파도 마을로"),
    transferEvent("ev_pkmn_b_route3_to_ember", 12, 33, PKMN_MAPS.emberTown, 14, 1, "잿불 마을로"),
    signEvent("ev_pkmn_b_route3_sign", sign.x, sign.y, "표지판", [
      "3번 도로 — 북쪽: 파도 마을 · 남쪽: 잿불 마을",
      "풀숲에서는 전기·비행 몬스터가 자주 나옵니다.",
    ]),
    trainerEvent({
      id: "ev_pkmn_b_route3_camper", x: 16, y: 6, role: "camperGirl", speaker: "캠프걸 하늘", facing: "left",
      troopId: PKMN_B_TROOPS.route3Camper, range: 4,
      intro: ["물 배지를 땄구나? 그럼 번개 한 번 맞아 볼래?"],
      lose: "찌릿하게 졌네…",
      after: ["번개꼬리는 물 몬스터를 노려. 땅 기술이 있으면 든든할 거야."],
    }),
    trainerEvent({
      id: "ev_pkmn_b_route3_hiker", x: 6, y: 14, role: "hiker", speaker: "등산가 우직", facing: "right",
      troopId: PKMN_B_TROOPS.route3Hiker, range: 4,
      intro: ["잿불 마을 화산까지 걸어가는 중이다! 몸 좀 풀어 볼까!"],
      lose: "바위곰이 쓰러지다니!",
      after: ["잿불 마을 관장은 불 타입이야. 바위·물 몬스터를 데려가게."],
    }),
    trainerEvent({
      id: "ev_pkmn_b_route3_fisher", x: 17, y: 21, role: "fisherman", speaker: "낚시꾼 너울", facing: "left",
      troopId: PKMN_B_TROOPS.route3Fisher, range: 4,
      intro: ["연못에서 건진 몬스터들이야. 상대해 주게!"],
      lose: "오늘은 입질이 영 아니군.",
      after: ["이 연못엔 파우치가 산다네. 가끔 물 위로 입을 뻐끔거리지."],
    }),
    pickupEvent("ev_pkmn_b_route3_crate", 20, 26, "나무 상자", "상자 안에 상급 회복약 2개가 들어 있었다!", "item_hi_potion", 2, "빈 나무 상자다."),
    castTalker("ev_pkmn_b_route3_traveler", 14, 31, "villagerB", [
      "조금만 더 가면 잿불 마을이야. 공기가 따뜻해지는 게 느껴지지?",
      "잿불 마을에도 회복 센터가 있으니 걱정 말고 가.",
    ], { speaker: "여행자", wander: true }),
  );
  return map;
}

// --- 조립 도우미 ---------------------------------------------------------------------

/** B 지역 맵 — 파도 마을 · 파도 회복 센터 · 물 체육관 · 3번 도로. */
export function createPkmnRegionBMaps(): GameMap[] {
  return [createWaveTownMap(), createWaveCenterMap(), createWaterGymMap(), createRoute3Map()];
}

/**
 * B 지역을 프로젝트에 넣는다(맵·적·무리·아이템·맵 트리). 이미 같은 id 가 있으면 건너뛴다.
 * 스위치·변수(PKMN_FLAGS)와 추가 종·기술은 코어(configureScarloxyPokemonDemoProject)가 만든다.
 */
export function installPkmnRegionB(project: Project): void {
  for (const map of createPkmnRegionBMaps()) if (!project.maps[map.id]) project.maps[map.id] = map;
  const records = createPkmnRegionBRecords();
  const pushNew = <T extends { id: string }>(target: T[], additions: readonly T[]): void => {
    for (const record of additions) if (!target.some((existing) => existing.id === record.id)) target.push(record);
  };
  pushNew(project.database.enemies, records.enemies);
  pushNew(project.database.troops, records.troops);
  pushNew(project.database.items, records.items);
  const tree = project.mapTree;
  const hasNode = (node: typeof tree, id: string): boolean => node.mapId === id || node.children.some((child) => hasNode(child, id));
  const wave = singleNodeTree(PKMN_MAPS.waveTown);
  wave.children = [PKMN_MAPS.waveCenter, PKMN_MAPS.waterGym].filter((id) => project.maps[id]).map((id) => singleNodeTree(id));
  if (!hasNode(tree, PKMN_MAPS.waveTown)) tree.children = [...tree.children, wave];
  if (project.maps[PKMN_MAPS.route3] && !hasNode(tree, PKMN_MAPS.route3)) tree.children = [...tree.children, singleNodeTree(PKMN_MAPS.route3)];
}

