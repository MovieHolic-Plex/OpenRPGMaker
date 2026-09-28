// 포켓몬풍 데모 「몬스터 테이머」 A 지역 — 이끼 마을 · 이끼 회복 센터 · 풀 체육관 · 바위굴 1층/2층.
//
// 계약은 scarloxyPokemonWorld.ts(PKMN_MAPS·PKMN_MAP_SIZES·PKMN_LINKS·PKMN_FLAGS·PKMN_GATES)다.
// 이 파일은 맵과 DB 레코드만 만든다. 조립(createScarloxyPokemonDemoProject 편입·mapTree)은
// installPkmnRegionA 를 부르는 쪽이 한다. 이 파일의 id 는 전부 pkmn_a 접두어를 쓴다.
//
// 칩셋별 규칙(각 칩셋 참고문서 JSON 과 같다):
//   - 이끼 마을  scarloxy_chipset_monster_town_kit : 1층 잔디 124 전체, 건물·소품·나무는 3층 블록 통째로.
//   - 센터       scarloxy_chipset_monster_interior : 틀·벽·바닥·매트 1층, 가구·벽 장식 3층.
//   - 풀 체육관  scarloxy_chipset_monster_gym_coast: 참고문서 「완성 예제 · 풀 체육관 14×15」 배열 + 차단기 퍼즐.
//   - 바위굴     scarloxy_chipset_monster_cave     : 흙 바탕 → 47칸 블롭 → 절벽 앞면 → 앞면 칸(출구·사다리·계단) → 바닥 장식 → 3층 소품.
//
// 레벨 곡선: 야생 5~10, 체육관 트레이너 8~9, 관장 10~12, 바위굴 트레이너 7~10.

import type { Command, Dir, EventPage, GameEvent, GameMap, Project } from "../types";
import type { EncounterTableEntry, Rect } from "../types/project";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { MONSTER_CAVE_MANIFEST, MONSTER_TOWN_KIT_MANIFEST } from "@/assets/scarloxyPack";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { monsterBattleStatsForSpecies } from "@/project/monsterCollection";
import type { MonsterSpeciesRecord } from "@/project/types";
import { DEFAULT_SKILL_ID, DEFAULT_TILE_SIZE } from "./constants";
import { singleNodeTree } from "./defaultMaps";
import { SCARLOXY_CAST, type ScarloxyCastRole } from "./scarloxyCast";
import { castGraphic, castLines } from "./scarloxyCastEvents";
import { G, NO_GRAPHIC, PASSIVE_MOVEMENT, WANDER_MOVEMENT, demoEnemy, demoTroop, event, page, setUpper, stampLower, stampUpper, transferEvent } from "./scarloxyDemoGame";
import { SCARLOXY_EXTRA_SPECIES_SEEDS } from "./scarloxyExtraSpecies";
import { PKMN_FLAGS, PKMN_MAPS, PKMN_MAP_SIZES } from "./scarloxyPokemonWorld";

const EMPTY = -1;
const TOWN_TILESET_ID = "scarloxy_chipset_monster_town_kit";
const INTERIOR_TILESET_ID = "scarloxy_chipset_monster_interior";
const GYM_TILESET_ID = "scarloxy_chipset_monster_gym_coast";
const CAVE_TILESET_ID = "scarloxy_chipset_monster_cave";

// --- 연결 좌표 (PKMN_LINKS 와 같은 값) ---------------------------------------------
// 계약 밖의 내부 출입구(센터·체육관 문)는 이 파일이 소유한다.
const MOSS_DOORS = {
  center: { x: 5, y: 8 }, // hospital 6×6 @ (3,2) — 문 (5..6, 7), 접근칸 (5,8)
  gym: { x: 20, y: 7 }, // research-lab 8×6 @ (17,1) — 문 (20..21, 6), 접근칸 (20,7)
} as const;
const CENTER_ARRIVAL = { x: 7, y: 8 } as const; // 센터 문 매트 (7,9) 한 칸 위
const GYM_ARRIVAL = { x: 6, y: 13 } as const; // 체육관 매트 (6..7,14) 한 칸 위
const CAVE1_LADDER = { x: 18, y: 4 } as const; // 1층 사다리(올라가기) 아랫칸
const CAVE1_LADDER_ARRIVAL = { x: 18, y: 5 } as const;
const CAVE2_HOLE = { x: 4, y: 15 } as const; // 2층 사다리 구멍(내려가기)
const CAVE2_HOLE_ARRIVAL = { x: 5, y: 15 } as const;

export const PKMN_A_SUPER_ORB_ITEM_ID = "item_pkmn_a_super_orb";
const CAPTURE_ORB_ITEM_ID = "item_capture_orb";
const MOSS_SHOP_ITEM_IDS = [CAPTURE_ORB_ITEM_ID, PKMN_A_SUPER_ORB_ITEM_ID, "item_potion", "item_hi_potion", "item_antidote", "item_wake_herb"] as const;

// --- 공용 이벤트 헬퍼 ---------------------------------------------------------------

/** 배역 그림을 원하는 방향으로 세운다(castGraphic 은 아래 방향 고정). */
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
    page(`${id}_page`, speaker, [...castLines(role, lines, speaker), ...(options.extra ?? [])],
      options.direction ? facingGraphic(role, options.direction) : castGraphic(role),
      options.wander ? WANDER_MOVEMENT : PASSIVE_MOVEMENT),
  ]);
}

/** 표지판·조사 칸 — 그림 없는 조사 이벤트. */
function signEvent(id: string, x: number, y: number, name: string, lines: readonly string[], extra: readonly Command[] = []): GameEvent {
  return event(id, x, y, [
    page(`${id}_page`, name, [...lines.map((body) => ({ kind: "text", speaker: name, body }) satisfies Command), ...extra], NO_GRAPHIC, PASSIVE_MOVEMENT),
  ]);
}

/** 트레이너에게 지면 이끼 센터로 돌아가 회복한다(포켓몬식 '눈앞이 캄캄해졌다'). */
function whiteoutCommands(): Command[] {
  return [
    { kind: "text", body: "눈앞이 캄캄해졌다…" },
    { kind: "transfer", mapId: PKMN_MAPS.mossCenter, x: CENTER_ARRIVAL.x, y: CENTER_ARRIVAL.y, fade: "black" },
    { kind: "recoverAll" },
    { kind: "text", speaker: SCARLOXY_CAST.nurse.label, body: "정신이 드셨나요? 몬스터들은 모두 회복해 두었어요. 무리하지 마세요." },
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

/**
 * 시선 트레이너 — 첫 페이지는 detectionEncounter(정면 3~4칸)로 먼저 다가와 싸움을 건다.
 * 이기면 셀프 스위치 A 가 켜져 둘째 페이지(다시 싸우지 않는 대사)로 바뀐다.
 * 지면 센터로 돌아가고, A 는 켜지지 않으므로 말을 걸면 다시 싸울 수 있다.
 */
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
    ...page(`${spec.id}_battle`, spec.speaker, [...castLines(spec.role, spec.intro, spec.speaker), battle], graphic, PASSIVE_MOVEMENT),
    detectionEncounter: {
      sight: { range: spec.range ?? 4, lineOfSight: true, facing: "forward" },
      emote: "exclamation",
      emoteMs: 600,
      approachSpeed: 4,
    },
  };
  const after = page(`${spec.id}_after`, spec.speaker, castLines(spec.role, spec.after, spec.speaker), graphic, PASSIVE_MOVEMENT, [
    { kind: "selfSwitch", key: "A", value: true },
  ]);
  return event(spec.id, spec.x, spec.y, [challenge, after]);
}

// --- DB 레코드: 야생·트레이너 몬스터 ------------------------------------------------

type BaseStats = { maxHp: number; maxMp: number; attack: number; defense: number; mind: number; agility: number };

/** 데모 기존 종(scarloxyPokemonDemoGame.ts SPECIES_SEEDS) 중 이 지역이 쓰는 종의 기본 능력치. */
const BASE_SPECIES: Readonly<Record<string, { name: string; stats: BaseStats; skills: readonly string[] }>> = {
  mossling: { name: "모슬링", stats: { maxHp: 19, maxMp: 7, attack: 9, defense: 12, mind: 9, agility: 8 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_leaf", "skill_scarloxy_bug"] },
  cleaf: { name: "클리프", stats: { maxHp: 30, maxMp: 9, attack: 13, defense: 14, mind: 11, agility: 10 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_bug", "skill_scarloxy_venom"] },
  ivieron: { name: "아이비론", stats: { maxHp: 46, maxMp: 12, attack: 17, defense: 18, mind: 14, agility: 12 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_leaf", "skill_scarloxy_venom"] },
  plumette: { name: "플루메트", stats: { maxHp: 16, maxMp: 5, attack: 8, defense: 6, mind: 7, agility: 16 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_wing"] },
  puddlup: { name: "퍼들업", stats: { maxHp: 20, maxMp: 8, attack: 9, defense: 10, mind: 12, agility: 10 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_splash", "skill_scarloxy_mud"] },
  draem: { name: "드림", stats: { maxHp: 24, maxMp: 10, attack: 10, defense: 9, mind: 14, agility: 10 }, skills: [DEFAULT_SKILL_ID, "skill_scarloxy_shadow", "skill_scarloxy_mind"] },
};

/** 새 11종의 야생 기술(레벨에 맞는 것만). */
function extraSpecies(key: string) {
  const seed = SCARLOXY_EXTRA_SPECIES_SEEDS.find((entry) => entry.key === key);
  if (!seed) throw new Error(`새 종 목록에 ${key} 가 없습니다.`);
  return seed;
}

function speciesInfo(key: string, level: number): { name: string; stats: BaseStats; skills: string[] } {
  const base = BASE_SPECIES[key];
  if (base) return { name: base.name, stats: base.stats, skills: [...base.skills] };
  const seed = extraSpecies(key);
  const learned = seed.moves.filter((move) => move.level <= level).map((move) => move.skillId);
  return { name: seed.name, stats: seed.stats, skills: [DEFAULT_SKILL_ID, ...learned.slice(-2)] };
}

/**
 * 레벨 L 적 능력치 — 플레이어 몬스터와 같은 Gen1 공식(monsterBattleStatsForSpecies, IV 0)에
 * HP 만 배수를 곱한다. 적은 교대·아이템이 없으니 HP 로 버티게 한다. 배수는 simulateBattle 로 맞췄다
 * (스타터 진화형 + 포획 2마리, 기대 레벨에서 야생 90%+, 체육관 트레이너 70~90%, 관장 50~70%).
 */
const WILD_HP_MULTIPLIER = 1.5;
const TRAINER_HP_MULTIPLIER = 1.7;
const LEADER_HP_MULTIPLIER = 2.0;
function scaledStats(base: BaseStats, level: number, multiplier: number): BaseStats {
  const stats = monsterBattleStatsForSpecies({ id: "pkmn_a_scale", name: "", baseStats: base } as MonsterSpeciesRecord, level, undefined);
  return { ...stats, maxHp: Math.round(stats.maxHp * multiplier) };
}

type EnemySpec = { readonly key: string; readonly level: number; readonly trainer?: boolean; readonly leader?: boolean; readonly label?: string };

function enemyId(spec: EnemySpec): string {
  return `enemy_pkmn_a_${spec.leader ? "leader_" : spec.trainer ? "t_" : ""}${spec.key}_${spec.level}`;
}

function enemyRecord(spec: EnemySpec) {
  const info = speciesInfo(spec.key, spec.level);
  const exp = Math.round((2 + spec.level * 1.4) * (spec.trainer ? 1.5 : 1));
  return demoEnemy(enemyId(spec), spec.label ?? info.name, `scarloxy-monster-${spec.key}`, scaledStats(info.stats, spec.level, spec.leader ? LEADER_HP_MULTIPLIER : spec.trainer ? TRAINER_HP_MULTIPLIER : WILD_HP_MULTIPLIER), {
    exp,
    gold: spec.level * (spec.trainer ? 4 : 1),
  }, info.skills, { level: spec.level, speciesId: `species_scarloxy_${spec.key}` });
}

const CAVE_BACKDROP = "scarloxy-backdrop-cave";
const GYM_BACKDROP = "scarloxy-backdrop-gym";

type TroopSpec = { readonly id: string; readonly name: string; readonly backdrop: string; readonly members: readonly EnemySpec[]; readonly trainer?: boolean };

const WILD_CAVE1: readonly TroopSpec[] = [
  { id: "troop_pkmn_a_cave1_pebblit", name: "바위굴의 자갈콩", backdrop: CAVE_BACKDROP, members: [{ key: "pebblit", level: 6 }] },
  { id: "troop_pkmn_a_cave1_pebblit_b", name: "바위굴의 자갈콩", backdrop: CAVE_BACKDROP, members: [{ key: "pebblit", level: 8 }] },
  { id: "troop_pkmn_a_cave1_wispin", name: "바위굴의 안개령", backdrop: CAVE_BACKDROP, members: [{ key: "wispin", level: 7 }] },
  { id: "troop_pkmn_a_cave1_frostpip", name: "바위굴의 서리펭", backdrop: CAVE_BACKDROP, members: [{ key: "frostpip", level: 6 }] },
  { id: "troop_pkmn_a_cave1_brawlape", name: "바위굴의 주먹숭이", backdrop: CAVE_BACKDROP, members: [{ key: "brawlape", level: 7 }] },
];
const WILD_CAVE2: readonly TroopSpec[] = [
  { id: "troop_pkmn_a_cave2_pebblit", name: "위층의 자갈콩", backdrop: CAVE_BACKDROP, members: [{ key: "pebblit", level: 9 }] },
  { id: "troop_pkmn_a_cave2_wispin", name: "위층의 안개령", backdrop: CAVE_BACKDROP, members: [{ key: "wispin", level: 9 }] },
  { id: "troop_pkmn_a_cave2_sandscorp", name: "위층의 모래전갈", backdrop: CAVE_BACKDROP, members: [{ key: "sandscorp", level: 9 }] },
  { id: "troop_pkmn_a_cave2_frostpip", name: "위층의 서리펭", backdrop: CAVE_BACKDROP, members: [{ key: "frostpip", level: 8 }] },
  { id: "troop_pkmn_a_cave2_draem", name: "떠도는 드림", backdrop: CAVE_BACKDROP, members: [{ key: "draem", level: 10 }] },
];
/** [troopId, 가중치] — 희귀종은 가중치를 낮춘다. */
const CAVE1_WEIGHTS: Readonly<Record<string, number>> = {
  troop_pkmn_a_cave1_pebblit: 4, troop_pkmn_a_cave1_pebblit_b: 2, troop_pkmn_a_cave1_wispin: 3, troop_pkmn_a_cave1_frostpip: 2, troop_pkmn_a_cave1_brawlape: 2,
};
const CAVE2_WEIGHTS: Readonly<Record<string, number>> = {
  troop_pkmn_a_cave2_pebblit: 3, troop_pkmn_a_cave2_wispin: 3, troop_pkmn_a_cave2_sandscorp: 2, troop_pkmn_a_cave2_frostpip: 2, troop_pkmn_a_cave2_draem: 1,
};

export const PKMN_A_TROOPS = {
  gymA: "troop_pkmn_a_gym_trainer_a",
  gymB: "troop_pkmn_a_gym_trainer_b",
  leader: "troop_pkmn_a_grass_leader",
  caveHiker: "troop_pkmn_a_cave1_hiker",
  caveFisher: "troop_pkmn_a_cave1_fisher",
  caveCamper: "troop_pkmn_a_cave1_camper",
  cave2Hiker: "troop_pkmn_a_cave2_hiker",
  cave2BugCatcher: "troop_pkmn_a_cave2_bug_catcher",
} as const;

const TRAINER_TROOPS: readonly TroopSpec[] = [
  { id: PKMN_A_TROOPS.gymA, name: "체육관 트레이너 새봄", backdrop: GYM_BACKDROP, trainer: true, members: [{ key: "plumette", level: 8, trainer: true }, { key: "mossling", level: 9, trainer: true }] },
  { id: PKMN_A_TROOPS.gymB, name: "체육관 트레이너 도토리", backdrop: GYM_BACKDROP, trainer: true, members: [{ key: "hornbeet", level: 9, trainer: true }] },
  { id: PKMN_A_TROOPS.leader, name: "이끼 체육관 관장 모라", backdrop: GYM_BACKDROP, trainer: true, members: [
    { key: "mossling", level: 10, trainer: true, leader: true, label: "관장의 모슬링" },
    { key: "cleaf", level: 11, trainer: true, leader: true, label: "관장의 클리프" },
    { key: "ivieron", level: 12, trainer: true, leader: true, label: "관장의 아이비론" },
  ] },
  { id: PKMN_A_TROOPS.caveHiker, name: "등산가 바우", backdrop: CAVE_BACKDROP, trainer: true, members: [{ key: "pebblit", level: 7, trainer: true }, { key: "pebblit", level: 8, trainer: true }] },
  { id: PKMN_A_TROOPS.caveFisher, name: "낚시꾼 물결", backdrop: CAVE_BACKDROP, trainer: true, members: [{ key: "puddlup", level: 7, trainer: true }, { key: "toxtoad", level: 8, trainer: true }] },
  { id: PKMN_A_TROOPS.caveCamper, name: "캠프걸 다솜", backdrop: CAVE_BACKDROP, trainer: true, members: [{ key: "zaplet", level: 7, trainer: true }, { key: "brawlape", level: 8, trainer: true }] },
  { id: PKMN_A_TROOPS.cave2Hiker, name: "등산가 단단", backdrop: CAVE_BACKDROP, trainer: true, members: [{ key: "pebblit", level: 9, trainer: true }, { key: "sandscorp", level: 9, trainer: true }] },
  { id: PKMN_A_TROOPS.cave2BugCatcher, name: "벌레잡이 소년 한결", backdrop: CAVE_BACKDROP, trainer: true, members: [{ key: "hornbeet", level: 9, trainer: true }, { key: "toxtoad", level: 10, trainer: true }] },
];

function troopRecord(spec: TroopSpec) {
  return demoTroop(spec.id, spec.name, spec.backdrop, spec.members.map((member, index) => ({
    enemyId: enemyId(member), x: 160 - index * 8, y: 132,
  })), spec.trainer ? { uncapturable: true, trainerBattle: true } : {});
}

export type PkmnRegionARecords = {
  readonly enemies: ReturnType<typeof enemyRecord>[];
  readonly troops: ReturnType<typeof troopRecord>[];
  readonly items: ReturnType<typeof normalizeItemRecord>[];
};

/** A 지역이 새로 쓰는 적·무리·아이템(상점 슈퍼 구슬). 기존 DB 레코드는 다시 만들지 않는다. */
export function createPkmnRegionARecords(): PkmnRegionARecords {
  const troops = [...WILD_CAVE1, ...WILD_CAVE2, ...TRAINER_TROOPS];
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
        id: PKMN_A_SUPER_ORB_ITEM_ID,
        name: "슈퍼 구슬",
        type: "special",
        scope: "enemy",
        price: 200,
        description: "포획 구슬보다 잘 잡히는 구슬입니다. 이끼 마을 센터에서 팝니다.",
        imageResourceId: "cc0-jetrel-capture-orb",
        iconResourceId: "cc0-jetrel-capture-orb",
        occasion: "battle",
        occasionField: false,
        occasionBattle: true,
        consumable: true,
        captureProfile: { multiplier: 1.5, ballClass: "great" },
      }),
    ],
  };
}

function encounterTable(regions: readonly Rect[], weights: Readonly<Record<string, number>>): EncounterTableEntry[] {
  return regions.flatMap((region) => Object.entries(weights).map(([troopId, weight]) => ({
    troopId, weight, conditions: { region: { ...region } },
  })));
}

// --- 이끼 마을 (town_kit 28×20) -----------------------------------------------------

function kitBlock(name: string): number[][] {
  const block = MONSTER_TOWN_KIT_MANIFEST.blocks.find((entry) => entry.name === name);
  if (!block) throw new Error(`몬스터 마을 부품 매니페스트에 ${name} 블록이 없습니다.`);
  return Array.from({ length: block.h }, (_, dy) =>
    Array.from({ length: block.w }, (_, dx) => (block.row + dy) * 30 + block.col + dx));
}
const K = {
  LAB: kitBlock("research-lab"),
  SIGNPOST: kitBlock("signpost")[0]![0]!,
  MAILBOX: kitBlock("mailbox")[0]![0]!,
  SHRUB: kitBlock("cuttable-shrub")[0]![0]!,
  CRATE: kitBlock("crate")[0]![0]!,
  PLANTER: kitBlock("flower-planter"),
  BENCH: kitBlock("bench"),
  LAMP: kitBlock("street-lamp"),
  FENCE: kitBlock("picket-fence")[0]!,
  FENCE_POST: kitBlock("fence-post")[0]![0]!,
} as const;
const TEAL_TREE_SMALL: readonly (readonly number[])[] = [[19], [49]];

function fenceRow(map: GameMap, x0: number, x1: number, y: number): void {
  for (let x = x0; x <= x1; x += 1) setUpper(map, x, y, K.FENCE[(x - x0) % 2]!);
  setUpper(map, x1, y, K.FENCE_POST);
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

/** 이끼 마을 동쪽 관문 — 배지 1 이 없으면 (23,10) 경비원이 울타리 골목을 막는다. */
const GATE_GUARD = { x: 23, y: 10 } as const;

export function createMossTownMap(): GameMap {
  const map = blankMap("mossTown", "이끼 마을", TOWN_TILESET_ID, G.GRASS);

  // 건물(3층 블록 통째로).
  stampUpper(map, 3, 2, G.HOSPITAL); // 이끼 회복 센터 — 문 (5..6,7)
  stampUpper(map, 17, 1, K.LAB); // 풀 체육관(연구소 외관) — 문 (20..21,6)
  stampUpper(map, 2, 12, G.HOUSE_SMALL); // 문 (3,16)
  stampUpper(map, 9, 12, G.HOUSE_SMALL_ALT); // 문 (10,16)
  stampLower(map, 18, 14, G.POND);

  // 가장자리 숲(윗줄 두 칸은 캐릭터 뒤로 지나가는 ★, 밑동만 막힌다). 북쪽 입구(12..16열)는 비운다.
  for (const [x, y] of [[0, 0], [9, 0], [25, 0], [0, 5], [0, 9], [25, 13], [22, 17], [15, 17], [6, 17]] as const) {
    stampUpper(map, x, y, G.GREEN_TREE);
  }
  for (const [x, y] of [[26, 16], [10, 9]] as const) stampUpper(map, x, y, G.TEAL_TREE);
  stampUpper(map, 26, 4, TEAL_TREE_SMALL);
  stampUpper(map, 11, 2, G.GREEN_TREE_SMALL);
  for (const [x, y] of [[7, 10], [16, 12], [21, 16], [4, 18], [13, 18], [24, 5]] as const) setUpper(map, x, y, G.GRASS_TUFT);

  // 동쪽 관문 골목: 울타리 두 줄(9행·11행) 사이 10행만 지나간다.
  fenceRow(map, 22, 27, 9);
  fenceRow(map, 22, 27, 11);

  // 길가 소품.
  stampUpper(map, 12, 5, K.LAMP);
  stampUpper(map, 16, 5, K.LAMP);
  stampUpper(map, 13, 11, K.BENCH);
  stampUpper(map, 7, 9, K.PLANTER);
  stampUpper(map, 18, 8, K.PLANTER);
  setUpper(map, 4, 17, K.MAILBOX);
  setUpper(map, 11, 17, K.MAILBOX);
  setUpper(map, 27, 8, K.CRATE);
  setUpper(map, 17, 12, K.SHRUB);

  // 표지판 칸(3층 표지판 + 같은 칸 조사 이벤트).
  const signs = {
    town: { x: 12, y: 1 },
    center: { x: 7, y: 8 },
    gym: { x: 22, y: 7 },
    east: { x: 21, y: 12 },
  } as const;
  for (const cell of Object.values(signs)) setUpper(map, cell.x, cell.y, K.SIGNPOST);

  map.events.push(
    transferEvent("ev_pkmn_a_moss_to_route1", 14, 0, PKMN_MAPS.route1, 15, 22, "1번 도로로"),
    transferEvent("ev_pkmn_a_moss_to_cave1", 27, 10, PKMN_MAPS.cave1, 1, 12, "바위굴로"),
    transferEvent("ev_pkmn_a_moss_door_center", MOSS_DOORS.center.x, MOSS_DOORS.center.y, PKMN_MAPS.mossCenter, CENTER_ARRIVAL.x, CENTER_ARRIVAL.y, "이끼 회복 센터로"),
    transferEvent("ev_pkmn_a_moss_door_gym", MOSS_DOORS.gym.x, MOSS_DOORS.gym.y, PKMN_MAPS.grassGym, GYM_ARRIVAL.x, GYM_ARRIVAL.y, "풀 체육관으로"),
    signEvent("ev_pkmn_a_moss_sign_town", signs.town.x, signs.town.y, "표지판", [
      "이끼 마을 — 초록 이끼가 돌담을 덮는 조용한 마을.",
      "북쪽: 1번 도로 · 동쪽: 바위굴",
    ]),
    signEvent("ev_pkmn_a_moss_sign_center", signs.center.x, signs.center.y, "안내판", [
      "이끼 회복 센터 — 몬스터 회복은 무료. 안쪽 계산대에서 구슬과 약도 팝니다.",
    ]),
    signEvent("ev_pkmn_a_moss_sign_gym", signs.gym.x, signs.gym.y, "안내판", [
      "이끼 마을 몬스터 체육관 — 관장 모라. 「뿌리 깊은 풀은 바람에 흔들리지 않는다」",
      "풀 타입에는 불꽃·비행·벌레·독 기술이 잘 통한다.",
    ]),
    signEvent("ev_pkmn_a_moss_sign_east", signs.east.x, signs.east.y, "표지판", [
      "동쪽: 바위굴 → 파도 마을",
      "바위굴은 위험하므로 풀 배지를 가진 트레이너만 들어갈 수 있습니다. — 이끼 마을 경비대",
    ]),
    signEvent("ev_pkmn_a_moss_house_a_door", 3, 16, "문", ["문이 잠겨 있다. 안에서 코 고는 소리가 들린다."]),
    signEvent("ev_pkmn_a_moss_house_b_door", 10, 16, "문", ["문이 잠겨 있다. 문패에 「이끼 연구가의 집」이라고 적혀 있다."]),
    castTalker("ev_pkmn_a_moss_farmer", 8, 11, "villagerB", [
      "이 마을 이끼는 몬스터 먹이로 최고지. 모슬링들이 밤마다 몰래 뜯어 먹는다니까.",
      "관장 모라는 우리 마을 자랑이야. 풀 몬스터를 불꽃이나 비행 기술로 공략해 보게.",
    ], { speaker: "밀짚모자 농부", wander: true }),
    castTalker("ev_pkmn_a_moss_camper", 15, 15, "camperGirl", [
      "센터 계산대에서 파는 슈퍼 구슬, 써 봤어? 보통 구슬보다 훨씬 잘 잡혀!",
      "바위굴 안은 어두워서 자갈밭을 걸을 때마다 야생 몬스터가 튀어나와. 구슬을 넉넉히 챙겨.",
    ], { speaker: "캠프걸" }),
    castTalker("ev_pkmn_a_moss_gentleman", 23, 14, "gentleman", [
      "허허, 체육관 안에는 차단기가 있지. 바닥의 스위치를 밟으면 길이 열린다네.",
      "관장에게 이기면 풀 배지를 준다네. 배지가 있어야 동쪽 바위굴을 지날 수 있어.",
    ], { speaker: "신사" }),
    castTalker("ev_pkmn_a_moss_boy", 15, 7, "villagerA", [
      "바위굴 2층에는 벽화가 있대. 옛날 사람들이 전설의 몬스터를 그려 놨다던데.",
      "굴 안 반짝이는 바닥을 조사하면 도구가 떨어져 있기도 해!",
    ], { speaker: "금발 소년", wander: true }),
    ...gateGuardEvents(),
  );
  return map;
}

/** 관문 경비원 — 배지 없음: 골목을 막고 설명. 배지 있음: 골목 밖 (24,12) 로 비켜 서서 인사한다. */
function gateGuardEvents(): GameEvent[] {
  const speaker = "경비원";
  const guardCommands = castLines("hiker", [
    "여기서부터는 바위굴이다. 야생 몬스터가 사나워서 풀 배지가 없는 트레이너는 들여보낼 수 없어.",
    "마을 북쪽의 풀 체육관에서 관장 모라에게 이기고 오게.",
  ], speaker);
  const blocking = page("ev_pkmn_a_moss_gate_guard_block", speaker, guardCommands, facingGraphic("hiker", "left"), PASSIVE_MOVEMENT);
  // 배지를 받은 뒤: 그림 없는 빈 페이지(아래 층) — 칸을 비워 통행시키고, 경비원은 (24,12) 로 옮겨 선다.
  const cleared: EventPage = {
    ...page("ev_pkmn_a_moss_gate_guard_clear", "비켜 선 자리", [], NO_GRAPHIC, PASSIVE_MOVEMENT, [
      { kind: "switch", switchId: PKMN_FLAGS.badge1, value: true },
    ]),
    priority: "below",
  };
  const guard = event("ev_pkmn_a_moss_gate_guard", GATE_GUARD.x, GATE_GUARD.y, [blocking]);
  guard.pages?.push(cleared);
  const aside = event("ev_pkmn_a_moss_gate_guard_aside", 24, 12, [
    page("ev_pkmn_a_moss_gate_guard_aside_page", speaker, castLines("hiker", [
      "오, 풀 배지로군! 지나가도 좋네. 바위굴 안에서는 자갈밭을 조심하게.",
    ], speaker), facingGraphic("hiker", "up"), PASSIVE_MOVEMENT, [
      { kind: "switch", switchId: PKMN_FLAGS.badge1, value: true },
    ]),
  ]);
  return [guard, aside];
}

// --- 이끼 회복 센터 (monster_interior 15×11) ----------------------------------------

export function createMossCenterMap(): GameMap {
  const map = blankMap("mossCenter", "이끼 회복 센터", INTERIOR_TILESET_ID, 1);
  // 참고문서 「완성 예제 · 몬스터 회복 센터 15×11」 1층 그대로 + 왼쪽 화분 자리에 계산대.
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
    transferEvent("ev_pkmn_a_center_exit", 7, 9, PKMN_MAPS.mossTown, MOSS_DOORS.center.x, MOSS_DOORS.center.y + 1, "밖으로"),
    // 접수원 그림(카운터 뒤). 말은 카운터 칸 이벤트가 받는다.
    castTalker("ev_pkmn_a_center_nurse", 7, 3, nurse, ["어서 오세요. 카운터 앞에서 말씀해 주세요."]),
    event("ev_pkmn_a_center_heal", 7, 5, [
      page("ev_pkmn_a_center_heal_page", SCARLOXY_CAST.nurse.label, [
        ...castLines(nurse, ["이끼 회복 센터에 오신 걸 환영합니다.", "몬스터들을 맡아 회복시켜 드릴게요. 잠시만요…"]),
        { kind: "recoverAll" },
        { kind: "text", speaker: SCARLOXY_CAST.nurse.label, body: "모두 건강해졌어요! 또 오세요." },
      ], NO_GRAPHIC, PASSIVE_MOVEMENT),
    ]),
    castTalker("ev_pkmn_a_center_clerk", 2, 3, "clerk", ["계산대 앞에서 말씀해 주세요!"]),
    event("ev_pkmn_a_center_shop", 2, 5, [
      page("ev_pkmn_a_center_shop_page", SCARLOXY_CAST.clerk.label, [
        ...castLines("clerk", ["어서 오세요! 이끼 마을 명물 슈퍼 구슬도 들어왔어요."]),
        {
          kind: "shop",
          itemIds: [...MOSS_SHOP_ITEM_IDS],
          allowSell: true,
          quantityMode: "select",
          shopType: "normal",
          messageType: "welcome",
        },
      ], NO_GRAPHIC, PASSIVE_MOVEMENT),
    ]),
    signEvent("ev_pkmn_a_center_pc", 13, 4, "PC", [
      "몬스터 보관 PC다. 파티와 보관함은 메뉴의 「몬스터」에서 바꿀 수 있다.",
    ]),
    castTalker("ev_pkmn_a_center_trainer", 11, 6, "bugCatcher", [
      "관장님의 아이비론은 독 기술도 써. 해독초를 몇 개 챙겨 두는 게 좋아.",
    ], { speaker: "벌레잡이 소년" }),
    castTalker("ev_pkmn_a_center_visitor", 3, 9, "villagerA", [
      "여기서 쉬었다 가. 바위굴 트레이너들은 눈이 마주치면 바로 달려오거든.",
    ], { speaker: "대기 중인 트레이너" }),
  );
  return map;
}


// --- 풀 체육관 (gym_coast 14×15) -----------------------------------------------------
// 참고문서 「완성 예제 · 풀 체육관 14×15」 배열 그대로: 방 안쪽 x1..12 y3..13, 입구 (6..7,14), 차단기 줄 y8.

const GYM_BARRIER_OPEN = 634;
const GYM_SWITCH_ON = 632;
const GYM_SWITCH = { x: 2, y: 11 } as const;
const GYM_GATE_CELLS = [{ x: 6, y: 8 }, { x: 7, y: 8 }] as const;

export function createGrassGymMap(): GameMap {
  const map = blankMap("grassGym", "이끼 마을 풀 체육관", GYM_TILESET_ID, 482);
  const lower = [
    [519, 519, 519, 519, 519, 519, 519, 519, 519, 519, 519, 519, 519, 519],
    [520, 510, 510, 510, 510, 510, 511, 512, 510, 510, 510, 510, 510, 521],
    [520, 540, 540, 540, 540, 540, 541, 542, 540, 540, 540, 540, 540, 521],
    [520, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 521],
    [520, 482, 483, 482, 482, 482, 483, 482, 482, 482, 483, 482, 482, 521],
    [520, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 521],
    [520, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 521],
    [520, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 521],
    [520, 482, 483, 482, 482, 482, 483, 482, 482, 482, 483, 482, 482, 521],
    [520, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 521],
    [520, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 521],
    [520, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 521],
    [520, 482, 483, 482, 482, 482, 483, 482, 482, 482, 483, 482, 482, 521],
    [520, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 482, 521],
    [523, 522, 522, 522, 522, 525, 482, 482, 526, 522, 522, 522, 522, 524],
  ];
  const upper = [
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, 582, -1, -1, -1, 570, 571, 572, -1, -1, -1, -1, 582, -1],
    [-1, 612, -1, -1, -1, 600, 601, 602, -1, -1, -1, -1, 612, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, 630, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, 633, 633, 633, 633, 633, 633, 633, 633, 633, 633, 633, 633, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
    [-1, -1, 631, -1, -1, -1, -1, -1, -1, -1, 630, -1, -1, -1],
    [-1, -1, -1, -1, 579, -1, -1, -1, -1, 579, -1, -1, -1, -1],
    [-1, -1, -1, -1, 609, -1, -1, -1, -1, 609, -1, -1, -1, -1],
    [-1, -1, -1, -1, -1, -1, 635, 636, -1, -1, -1, -1, -1, -1],
  ];
  map.lowerTiles = lower.flat();
  map.upperTiles = upper.flat();
  const mapId = map.id;

  const switchEvent = event("ev_pkmn_a_gym_switch", GYM_SWITCH.x, GYM_SWITCH.y, [
    page("ev_pkmn_a_gym_switch_off", "바닥 스위치", [
      { kind: "changeTile", mapId, layer: "upper", x: GYM_SWITCH.x, y: GYM_SWITCH.y, tile: GYM_SWITCH_ON },
      ...GYM_GATE_CELLS.map((cell) => ({ kind: "changeTile", mapId, layer: "upper", x: cell.x, y: cell.y, tile: GYM_BARRIER_OPEN }) satisfies Command),
      { kind: "text", body: "딸깍! 어딘가에서 차단기가 내려가는 소리가 났다." },
      { kind: "setSelfSwitch", key: "A", value: true },
    ], NO_GRAPHIC, PASSIVE_MOVEMENT),
    page("ev_pkmn_a_gym_switch_on", "눌린 스위치", [], NO_GRAPHIC, PASSIVE_MOVEMENT, [{ kind: "selfSwitch", key: "A", value: true }]),
  ], "playerTouch", "below");

  const leader = "grassLeader" as const;
  const leaderName = "관장 모라";
  const leaderBattle: Command = {
    kind: "battleProcessing",
    troopId: PKMN_A_TROOPS.leader,
    canEscape: false,
    canLose: true,
    branchOnResult: true,
    victoryBranch: [
      ...castLines(leader, [
        "…훌륭해. 뿌리째 흔들린 건 오랜만이야.",
        "이끼 마을 체육관을 이긴 증표, 풀 배지를 받아 줘. 이제 동쪽 바위굴의 경비원도 길을 비켜 줄 거야.",
      ], leaderName),
      { kind: "setSwitch", switchId: PKMN_FLAGS.badge1, value: true },
      { kind: "setVariable", variableId: PKMN_FLAGS.badgeCount, op: "+=", value: 1 },
      { kind: "text", body: "풀 배지를 받았다!" },
      { kind: "changeItem", itemId: PKMN_A_SUPER_ORB_ITEM_ID, op: "+=", amount: 5 },
      { kind: "changeItem", itemId: "item_hi_potion", op: "+=", amount: 2 },
      { kind: "changeGold", op: "+=", amount: 600 },
      { kind: "text", body: "슈퍼 구슬 5개와 상급 회복약 2개, 600골드를 받았다!" },
      { kind: "text", speaker: leaderName, body: "슈퍼 구슬은 보통 구슬보다 잘 잡혀. 바위굴의 몬스터들로 파티를 넓혀 봐." },
    ],
    defeatBranch: whiteoutCommands(),
    escapeBranch: [],
  };
  const leaderEvent = event("ev_pkmn_a_gym_leader", 6, 3, [
    page("ev_pkmn_a_gym_leader_battle", leaderName, [
      ...castLines(leader, [
        "어서 와, 도전자. 나는 이끼 마을 체육관 관장 모라.",
        "풀은 밟혀도 다시 일어서지. 내 몬스터들의 끈기를 이겨 낼 수 있을까?",
      ], leaderName),
      leaderBattle,
    ], facingGraphic(leader, "down"), PASSIVE_MOVEMENT),
    page("ev_pkmn_a_gym_leader_after", leaderName, castLines(leader, [
      "풀 배지는 잘 간직하고 있지? 다음 체육관은 바위굴 너머 파도 마을에 있어.",
      "물 타입은 풀 기술에 약해. 내 가르침을 잊지 말고!",
    ], leaderName), facingGraphic(leader, "down"), PASSIVE_MOVEMENT, [
      { kind: "switch", switchId: PKMN_FLAGS.badge1, value: true },
    ]),
  ]);

  map.events.push(
    transferEvent("ev_pkmn_a_gym_exit_l", 6, 14, PKMN_MAPS.mossTown, MOSS_DOORS.gym.x, MOSS_DOORS.gym.y + 1, "밖으로"),
    transferEvent("ev_pkmn_a_gym_exit_r", 7, 14, PKMN_MAPS.mossTown, MOSS_DOORS.gym.x, MOSS_DOORS.gym.y + 1, "밖으로"),
    switchEvent,
    leaderEvent,
    trainerEvent({
      id: "ev_pkmn_a_gym_trainer_a", x: 9, y: 5, role: "camperGirl", speaker: "체육관 트레이너 새봄", facing: "left",
      troopId: PKMN_A_TROOPS.gymA, range: 4,
      intro: ["관장님께 가려면 나부터 넘어가야 해!"],
      lose: "바람에 꺾이고 말았네…",
      after: ["관장님의 아이비론은 독 기술도 써. 해독초는 챙겼어?"],
    }),
    trainerEvent({
      id: "ev_pkmn_a_gym_trainer_b", x: 10, y: 11, role: "bugCatcher", speaker: "체육관 트레이너 도토리", facing: "left",
      troopId: PKMN_A_TROOPS.gymB, range: 4,
      intro: ["스위치를 찾고 있지? 알려 줄 수 없어! 대신 승부다!"],
      lose: "뿔장수가 졌다니…",
      after: ["스위치는 왼쪽 아래 구석에 있어. 밟으면 차단기가 열려."],
    }),
    castTalker("ev_pkmn_a_gym_guide", 11, 13, "gentleman", [
      "도전자여, 어서 오게! 관장 모라는 풀 타입 전문이라네.",
      "차단기가 길을 막고 있지? 이 방 어딘가의 바닥 스위치를 밟아 보게.",
      "불꽃·비행·벌레·독 기술이 잘 통한다네. 행운을 비네!",
    ], { speaker: "체육관 안내원", direction: "left" }),
    signEvent("ev_pkmn_a_gym_statue_l", 4, 13, "배지 조각상", ["이끼 마을 체육관 — 관장 모라에게 이긴 트레이너의 이름이 새겨져 있다."]),
    signEvent("ev_pkmn_a_gym_statue_r", 9, 13, "배지 조각상", ["「뿌리 깊은 풀은 바람에 흔들리지 않는다」"]),
  );
  return map;
}

// --- 바위굴 (monster_cave) -----------------------------------------------------------
// 참고문서 「조립 순서」 그대로: 흙 바탕 → 47칸 블롭(벽·고지대·물·자갈) → 높이가 떨어지는 칸 아래 두 줄 절벽 앞면
// → 앞면 자리에 출구·사다리·계단 → 흙 칸 바닥 장식 → 3층 소품.

const CAVE_BLOCKS = new Map(MONSTER_CAVE_MANIFEST.blocks.map((block) => [block.name, block]));
function caveTile(name: string, dx = 0, dy = 0): number {
  const block = CAVE_BLOCKS.get(name);
  if (!block) throw new Error(`몬스터 동굴 매니페스트에 ${name} 블록이 없습니다.`);
  return (block.row + dy) * 30 + block.col + dx;
}
function caveBlockSize(name: string): { w: number; h: number } {
  const block = CAVE_BLOCKS.get(name)!;
  return { w: block.w, h: block.h };
}
const CAVE_DIRT = 24;
const CAVE_PEBBLES = 25;
const MASK = MONSTER_CAVE_MANIFEST.blobMaskBits;
const MASK_DIRS: readonly (readonly [number, number, number])[] = [
  [MASK.N, 0, -1], [MASK.E, 1, 0], [MASK.S, 0, 1], [MASK.W, -1, 0],
  [MASK.NE, 1, -1], [MASK.SE, 1, 1], [MASK.SW, -1, 1], [MASK.NW, -1, -1],
];
function reduceMask(mask: number): number {
  let reduced = mask & (MASK.N | MASK.E | MASK.S | MASK.W);
  if (mask & MASK.NE && mask & MASK.N && mask & MASK.E) reduced |= MASK.NE;
  if (mask & MASK.SE && mask & MASK.S && mask & MASK.E) reduced |= MASK.SE;
  if (mask & MASK.SW && mask & MASK.S && mask & MASK.W) reduced |= MASK.SW;
  if (mask & MASK.NW && mask & MASK.N && mask & MASK.W) reduced |= MASK.NW;
  return reduced;
}

/** 글자 배치: W 바위 벽 · h 고지대 · ~ 물 · g 자갈 · . 흙. */
type CaveChar = "W" | "h" | "~" | "g" | ".";
type CaveRect = readonly [CaveChar, number, number, number, number]; // 글자, x0, y0, x1, y1 (끝 포함)
type CavePlacement = readonly [string, number, number];

type CaveSpec = {
  readonly width: number;
  readonly height: number;
  readonly rects: readonly CaveRect[];
  /** 앞면 줄에 끼우는 칸(윗줄 좌표). */
  readonly fixtures: readonly CavePlacement[];
  /** 흙 칸 바닥 장식(1층). */
  readonly decals: readonly CavePlacement[];
  /** 3층 소품(여러 칸이면 왼쪽 위 좌표). */
  readonly props: readonly CavePlacement[];
};

function caveLayout(spec: CaveSpec): CaveChar[][] {
  const grid: CaveChar[][] = Array.from({ length: spec.height }, () => Array<CaveChar>(spec.width).fill("W"));
  for (const [char, x0, y0, x1, y1] of spec.rects) {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) grid[y]![x] = char;
  }
  return grid;
}

export function buildCaveTiles(spec: CaveSpec): { lower: number[]; upper: number[] } {
  const layout = caveLayout(spec);
  const { width, height } = spec;
  const level = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= width || y >= height ? 2 : layout[y]![x] === "W" ? 2 : layout[y]![x] === "h" ? 1 : 0;
  const face: number[][] = Array.from({ length: height }, () => Array<number>(width).fill(-1));
  for (let y = 0; y < height - 1; y += 1) for (let x = 0; x < width; x += 1) {
    if (level(x, y) > level(x, y + 1) && face[y]![x]! < 0) {
      face[y + 1]![x] = 0;
      if (y + 2 < height) face[y + 2]![x] = 1;
    }
  }
  const kind = (x: number, y: number): string =>
    x < 0 || y < 0 || x >= width || y >= height ? "W" : face[y]![x]! >= 0 ? "F" : layout[y]![x]!;
  const connects: Readonly<Record<string, (k: string) => boolean>> = {
    wall: (k) => k === "W" || k === "F",
    high: (k) => k === "h" || k === "W" || k === "F",
    water: (k) => k === "~",
    gravel: (k) => k === "g",
  };
  const setOf: Readonly<Record<string, "wall" | "high" | "water" | "gravel">> = { W: "wall", h: "high", "~": "water", g: "gravel" };
  const lower: number[] = new Array<number>(width * height).fill(CAVE_DIRT);
  const upper: number[] = new Array<number>(width * height).fill(EMPTY);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const k = kind(x, y);
    const index = y * width + x;
    if (k === "F") {
      const cont = (xx: number): boolean => "FWh".includes(kind(xx, y));
      const dx = !cont(x - 1) ? 0 : !cont(x + 1) ? 3 : 1 + (x % 2);
      lower[index] = caveTile("cliff-face", dx, face[y]![x]!);
    } else if (setOf[k]) {
      const set = setOf[k]!;
      let mask = 0;
      for (const [bit, dx, dy] of MASK_DIRS) if (connects[set]!(kind(x + dx, y + dy))) mask |= bit;
      const tile = MONSTER_CAVE_MANIFEST.blobs[set].masks[String(reduceMask(mask))];
      if (tile === undefined) throw new Error(`${set} 마스크 ${mask} 칸이 없습니다.`);
      lower[index] = tile;
    } else {
      lower[index] = (x * 7 + y * 3) % 11 === 0 ? CAVE_PEBBLES : CAVE_DIRT;
    }
  }
  const stamp = (target: number[], [name, x, y]: CavePlacement): void => {
    const { w, h } = caveBlockSize(name);
    for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) target[(y + dy) * width + x + dx] = caveTile(name, dx, dy);
  };
  for (const fixture of spec.fixtures) stamp(lower, fixture);
  for (const decal of spec.decals) stamp(lower, decal);
  for (const prop of spec.props) stamp(upper, prop);
  return { lower, upper };
}

function caveMap(key: "cave1" | "cave2", name: string, spec: CaveSpec): GameMap {
  const map = blankMap(key, name, CAVE_TILESET_ID, CAVE_DIRT);
  const tiles = buildCaveTiles(spec);
  map.lowerTiles = tiles.lower;
  map.upperTiles = tiles.upper;
  return map;
}

/** 반짝이 바닥 = 숨은 도구. 조사하면 줍고 바닥을 흙으로 되돌린다. */
function sparkleItem(id: string, mapId: string, x: number, y: number, itemId: string, amount: number, label: string): GameEvent {
  return event(id, x, y, [
    page(`${id}_find`, "반짝이는 바닥", [
      { kind: "text", body: `바닥에서 무언가 반짝인다… ${label}을(를) 주웠다!` },
      { kind: "changeItem", itemId, op: "+=", amount },
      { kind: "changeTile", mapId, layer: "lower", x, y, tile: CAVE_DIRT },
      { kind: "setSelfSwitch", key: "A", value: true },
    ], NO_GRAPHIC, PASSIVE_MOVEMENT),
    { ...page(`${id}_empty`, "빈 바닥", [], NO_GRAPHIC, PASSIVE_MOVEMENT, [{ kind: "selfSwitch", key: "A", value: true }]), priority: "below" },
  ]);
}

// 바위굴 1층 30×24. 서쪽 (0,12) ↔ 이끼 마을, 동쪽 (29,12) ↔ 파도 마을, 북쪽 방 사다리 (18,4) ↔ 2층.
const CAVE1_GRAVEL: readonly Rect[] = [
  { x: 14, y: 18, w: 6, h: 3 },
  { x: 21, y: 11, w: 4, h: 3 },
  { x: 14, y: 6, w: 4, h: 3 },
];
const CAVE1_SPEC: CaveSpec = {
  width: 30,
  height: 24,
  rects: [
    [".", 0, 10, 7, 13], // 서쪽 입구 통로
    [".", 6, 10, 26, 20], // 큰 동굴
    [".", 22, 10, 29, 13], // 동쪽 출구 통로
    [".", 13, 3, 23, 9], // 북쪽 방(사다리)
    ["h", 8, 13, 13, 16], // 서쪽 고지대 — 앞면 (8..13, 17..18), 계단 (10,17)
    ["~", 19, 15, 23, 17], // 지하 연못
    ...CAVE1_GRAVEL.map((r) => ["g", r.x, r.y, r.x + r.w - 1, r.y + r.h - 1] as const),
  ],
  fixtures: [
    ["exit-bright", 0, 10],
    ["exit-bright", 28, 10],
    ["ladder-up", 18, 3],
    ["stairs-up", 10, 17],
  ],
  decals: [
    ["sparkle-a", 21, 7],
    ["sparkle-b", 25, 19],
    ["puddle", 18, 14],
    ["puddle", 24, 16],
    ["floor-crack", 8, 20],
    ["glow-moss", 22, 5],
    ["glow-moss", 7, 19],
    ["floor-scatter", 16, 15],
  ],
  props: [
    ["stalagmite-tall", 13, 5],
    ["crystal", 23, 5],
    ["ore-rock", 13, 8],
    ["stalagmite-small", 6, 14],
    ["rubble", 20, 20],
    ["crystal", 12, 14],
    ["stalagmite-tall", 26, 17],
    ["cracked-rock", 12, 19],
    ["stalagmite-small", 24, 20],
  ],
};

export function createCave1Map(): GameMap {
  const map = caveMap("cave1", "바위굴 1층", CAVE1_SPEC);
  map.encounterRate = 6;
  map.troopIds = WILD_CAVE1.map((troop) => troop.id);
  map.encounterTable = encounterTable(CAVE1_GRAVEL, CAVE1_WEIGHTS);
  map.events.push(
    transferEvent("ev_pkmn_a_cave1_to_moss", 0, 12, PKMN_MAPS.mossTown, 26, 10, "이끼 마을로"),
    transferEvent("ev_pkmn_a_cave1_to_moss_light_l", 0, 11, PKMN_MAPS.mossTown, 26, 10, "이끼 마을로"),
    transferEvent("ev_pkmn_a_cave1_to_moss_light_r", 1, 11, PKMN_MAPS.mossTown, 26, 10, "이끼 마을로"),
    transferEvent("ev_pkmn_a_cave1_to_wave", 29, 12, PKMN_MAPS.waveTown, 1, 10, "파도 마을로"),
    transferEvent("ev_pkmn_a_cave1_to_wave_light_l", 28, 11, PKMN_MAPS.waveTown, 1, 10, "파도 마을로"),
    transferEvent("ev_pkmn_a_cave1_to_wave_light_r", 29, 11, PKMN_MAPS.waveTown, 1, 10, "파도 마을로"),
    transferEvent("ev_pkmn_a_cave1_ladder", CAVE1_LADDER.x, CAVE1_LADDER.y, PKMN_MAPS.cave2, CAVE2_HOLE_ARRIVAL.x, CAVE2_HOLE_ARRIVAL.y, "바위굴 2층으로"),
    sparkleItem("ev_pkmn_a_cave1_item_a", map.id, 21, 7, "item_potion", 2, "회복약 2개"),
    sparkleItem("ev_pkmn_a_cave1_item_b", map.id, 25, 19, CAPTURE_ORB_ITEM_ID, 3, "포획 구슬 3개"),
    trainerEvent({
      id: "ev_pkmn_a_cave1_camper", x: 14, y: 12, role: "camperGirl", speaker: "캠프걸 다솜", facing: "left",
      troopId: PKMN_A_TROOPS.caveCamper, range: 4,
      intro: ["배지 가진 트레이너다! 동굴 캠프의 첫 손님이네, 승부하자!"],
      lose: "찌릿냥이 지쳐 버렸어…",
      after: ["자갈밭을 걸으면 야생 몬스터가 나와. 흙바닥은 안전하고."],
    }),
    trainerEvent({
      id: "ev_pkmn_a_cave1_hiker", x: 15, y: 16, role: "hiker", speaker: "등산가 바우", facing: "right",
      troopId: PKMN_A_TROOPS.caveHiker, range: 3,
      intro: ["우오오! 산사나이의 자갈콩은 단단하다고!"],
      lose: "허허, 바위도 깨지는 날이 있군.",
      after: ["북쪽 방 사다리로 올라가면 2층이야. 옛날 벽화가 있다던데."],
    }),
    trainerEvent({
      id: "ev_pkmn_a_cave1_fisher", x: 25, y: 14, role: "fisherman", speaker: "낚시꾼 물결", facing: "left",
      troopId: PKMN_A_TROOPS.caveFisher, range: 4,
      intro: ["쉿, 물고기가 도망가잖아! …이렇게 된 거, 승부다!"],
      lose: "오늘은 입질이 없네.",
      after: ["동쪽 빛이 새는 곳이 출구야. 나가면 바로 파도 마을이지."],
    }),
    signEvent("ev_pkmn_a_cave1_sign", 6, 14, "바위에 새긴 글씨", [
      "바위굴 — 동쪽 출구: 파도 마을 · 북쪽 사다리: 2층",
      "자갈밭에는 야생 몬스터가 삽니다.",
    ]),
  );
  return map;
}

// 바위굴 2층 26×20. 사다리 구멍 (4,15) ↔ 1층. 고지대 벽화 방(전설 암시) + 숨은 도구.
const CAVE2_GRAVEL: readonly Rect[] = [
  { x: 5, y: 9, w: 7, h: 4 },
  { x: 17, y: 14, w: 5, h: 3 },
];
const CAVE2_MURAL = { x: 18, y: 4 } as const;
const CAVE2_SPEC: CaveSpec = {
  width: 26,
  height: 20,
  rects: [
    [".", 2, 3, 23, 17],
    ["h", 14, 3, 21, 10], // 벽화 고지대 — 앞면 (14..21, 11..12), 계단 (17,11)
    ["~", 3, 5, 7, 7],
    ...CAVE2_GRAVEL.map((r) => ["g", r.x, r.y, r.x + r.w - 1, r.y + r.h - 1] as const),
  ],
  fixtures: [["stairs-up", 17, 11]],
  decals: [
    ["ladder-hole", CAVE2_HOLE.x, CAVE2_HOLE.y],
    ["sparkle-a", 22, 16],
    ["glow-moss", 12, 5],
    ["glow-moss", 3, 12],
    ["puddle", 9, 15],
    ["floor-crack", 13, 13],
  ],
  props: [
    ["crystal", 20, 6],
    ["crystal", 15, 9],
    ["stalagmite-tall", 11, 5],
    ["ore-rock", 2, 9],
    ["rubble", 2, 17],
    ["stalagmite-small", 23, 11],
    ["stalagmite-small", 12, 16],
  ],
};

export function createCave2Map(): GameMap {
  const map = caveMap("cave2", "바위굴 2층", CAVE2_SPEC);
  map.encounterRate = 7;
  map.troopIds = WILD_CAVE2.map((troop) => troop.id);
  map.encounterTable = encounterTable(CAVE2_GRAVEL, CAVE2_WEIGHTS);
  map.events.push(
    transferEvent("ev_pkmn_a_cave2_hole", CAVE2_HOLE.x, CAVE2_HOLE.y, PKMN_MAPS.cave1, CAVE1_LADDER_ARRIVAL.x, CAVE1_LADDER_ARRIVAL.y, "바위굴 1층으로"),
    sparkleItem("ev_pkmn_a_cave2_item", map.id, 22, 16, PKMN_A_SUPER_ORB_ITEM_ID, 3, "슈퍼 구슬 3개"),
    event("ev_pkmn_a_cave2_crystal", 20, 6, [
      page("ev_pkmn_a_cave2_crystal_find", "수정 무더기", [
        { kind: "text", body: "수정 조각 틈에 무언가 끼어 있다… 상급 회복약 2개를 손에 넣었다!" },
        { kind: "changeItem", itemId: "item_hi_potion", op: "+=", amount: 2 },
        { kind: "setSelfSwitch", key: "A", value: true },
      ], NO_GRAPHIC, PASSIVE_MOVEMENT),
      page("ev_pkmn_a_cave2_crystal_done", "수정 무더기", [
        { kind: "text", body: "푸르스름한 수정이 희미하게 빛난다." },
      ], NO_GRAPHIC, PASSIVE_MOVEMENT, [{ kind: "selfSwitch", key: "A", value: true }]),
    ]),
    signEvent("ev_pkmn_a_cave2_mural", CAVE2_MURAL.x, CAVE2_MURAL.y, "옛 벽화", [
      "바위벽에 오래된 그림이 새겨져 있다. 불꽃을 두른 커다란 용이 초원 길 끝에서 잠들어 있다.",
      "그 아래 글씨: 「불꽃의 용 아트록스, 풀의 길 남쪽 끝에 깃들다. 약한 구슬로는 붙잡을 수 없으리라.」",
      "(1번 도로 남쪽 끝… 슈퍼 구슬을 넉넉히 준비해 가 보자.)",
    ]),
    trainerEvent({
      id: "ev_pkmn_a_cave2_hiker", x: 13, y: 15, role: "hiker", speaker: "등산가 단단", facing: "left",
      troopId: PKMN_A_TROOPS.cave2Hiker, range: 4,
      intro: ["2층까지 올라오다니 제법인걸! 한판 붙자!"],
      lose: "모래전갈까지 당하다니!",
      after: ["고지대 위 벽화 봤어? 전설의 용 이야기래."],
    }),
    trainerEvent({
      id: "ev_pkmn_a_cave2_bug_catcher", x: 9, y: 8, role: "bugCatcher", speaker: "벌레잡이 소년 한결", facing: "down",
      troopId: PKMN_A_TROOPS.cave2BugCatcher, range: 4,
      intro: ["동굴에도 벌레 몬스터가 있다고! 보여 줄게!"],
      lose: "으앙, 뿔장수!",
      after: ["자갈밭엔 안개령이 자주 나와. 고스트 타입이라 노말 기술이 안 통해."],
    }),
  );
  return map;
}

// --- 조립 도우미 ---------------------------------------------------------------------

/** A 지역 맵 5장 — 이끼 마을 · 이끼 회복 센터 · 풀 체육관 · 바위굴 1층 · 2층. */
export function createPkmnRegionAMaps(): GameMap[] {
  return [createMossTownMap(), createMossCenterMap(), createGrassGymMap(), createCave1Map(), createCave2Map()];
}

/**
 * A 지역을 프로젝트에 넣는다(맵·적·무리·아이템·맵 트리). 이미 같은 id 가 있으면 건너뛴다.
 * 스위치·변수(PKMN_FLAGS)와 추가 종·기술은 코어(configureScarloxyPokemonDemoProject)가 만든다.
 */
export function installPkmnRegionA(project: Project): void {
  for (const map of createPkmnRegionAMaps()) if (!project.maps[map.id]) project.maps[map.id] = map;
  const records = createPkmnRegionARecords();
  const pushNew = <T extends { id: string }>(target: T[], additions: readonly T[]): void => {
    for (const record of additions) if (!target.some((existing) => existing.id === record.id)) target.push(record);
  };
  pushNew(project.database.enemies, records.enemies);
  pushNew(project.database.troops, records.troops);
  pushNew(project.database.items, records.items);
  const tree = project.mapTree;
  const hasNode = (node: typeof tree, id: string): boolean => node.mapId === id || node.children.some((child) => hasNode(child, id));
  const moss = singleNodeTree(PKMN_MAPS.mossTown);
  moss.children = [PKMN_MAPS.mossCenter, PKMN_MAPS.grassGym].map((id) => singleNodeTree(id));
  const cave = singleNodeTree(PKMN_MAPS.cave1);
  cave.children = [singleNodeTree(PKMN_MAPS.cave2)];
  if (!hasNode(tree, PKMN_MAPS.mossTown)) tree.children = [...tree.children, moss];
  if (!hasNode(tree, PKMN_MAPS.cave1)) tree.children = [...tree.children, cave];
}

