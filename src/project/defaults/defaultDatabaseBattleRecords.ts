import type { EnemyActionCondition, EnemyActionPattern, EnemyRecord, MonsterSpeciesRecord, TroopRecord } from "../types";
import { normalizeEnemyRecord, normalizeTroopRecord } from "../databaseRecordModel";
import { normalizeMonsterSpeciesRecord } from "../monsterCollection";
import { DEFAULT_ENEMY_ID, DEFAULT_ITEM_ID, DEFAULT_SKILL_ID, DEFAULT_TROOP_ID } from "./constants";

type BattleRecords = {
  readonly enemies: EnemyRecord[];
  readonly troops: TroopRecord[];
  readonly monsterSpecies: MonsterSpeciesRecord[];
};

export function defaultBattleRecords(): BattleRecords {
  return {
    enemies: defaultEnemyRecords(),
    troops: defaultTroopRecords(),
    monsterSpecies: defaultMonsterSpeciesRecords(),
  };
}

function defaultEnemyRecords(): EnemyRecord[] {
  return [
    normalizeEnemyRecord({
      id: DEFAULT_ENEMY_ID,
      name: "슬라임",
      speciesId: "species_wild_slime",
      monsterResourceId: "generated-enemy-slime-01",
      stats: { maxHp: 18, maxMp: 4, attack: 10, defense: 7, mind: 6, agility: 16 },
      rewards: { exp: 5, gold: 4, dropItemId: DEFAULT_ITEM_ID, dropRatePercent: 12 },
      actions: [
        enemyAction(DEFAULT_SKILL_ID, 5, { kind: "always" }),
        enemyAction("skill_poison_sting", 6, { kind: "turn", start: 2, interval: 3 }),
      ],
    }),
    normalizeEnemyRecord({
      id: "enemy_meadow_slime",
      name: "초원 슬라임",
      speciesId: "species_wild_slime",
      monsterResourceId: "generated-enemy-slime-01",
      stats: { maxHp: 24, maxMp: 3, attack: 8, defense: 11, mind: 5, agility: 6 },
      rewards: { exp: 6, gold: 5, dropItemId: DEFAULT_ITEM_ID, dropRatePercent: 18 },
      actions: [enemyAction(DEFAULT_SKILL_ID, 5, { kind: "always" })],
    }),
    normalizeEnemyRecord({
      id: "enemy_cave_bat",
      name: "동굴 박쥐",
      speciesId: "species_cave_bat",
      monsterResourceId: "generated-enemy-bat-01",
      stats: { maxHp: 20, maxMp: 6, attack: 9, defense: 6, mind: 8, agility: 18 },
      rewards: { exp: 7, gold: 6, dropRatePercent: 0 },
      actions: [
        enemyAction(DEFAULT_SKILL_ID, 5, { kind: "always" }),
        enemyAction("skill_sleep_mist", 4, { kind: "turn", start: 3, interval: 4 }),
      ],
    }),
    normalizeEnemyRecord({
      id: "enemy_stone_golem",
      name: "돌 골렘",
      speciesId: "species_stone_golem",
      monsterResourceId: "generated-enemy-golem-01",
      stats: { maxHp: 64, maxMp: 8, attack: 16, defense: 18, mind: 8, agility: 4 },
      rewards: { exp: 24, gold: 18, dropItemId: DEFAULT_ITEM_ID, dropRatePercent: 8 },
      actions: [
        enemyAction(DEFAULT_SKILL_ID, 5, { kind: "always" }),
        enemyAction("skill_weaken", 3, { kind: "turn", start: 2, interval: 4 }),
      ],
    }),
    normalizeEnemyRecord({
      id: "enemy_dragon",
      name: "붉은 드래곤",
      speciesId: "species_ember_drake",
      monsterResourceId: "generated-enemy-dragon-01",
      stats: { maxHp: 70, maxMp: 10, attack: 22, defense: 20, mind: 12, agility: 14 },
      rewards: { exp: 38, gold: 42, dropItemId: DEFAULT_ITEM_ID, dropRatePercent: 10 },
      actions: [
        enemyAction(DEFAULT_SKILL_ID, 5, { kind: "always" }),
        enemyAction("skill_arcane_bolt", 7, { kind: "turn", start: 2, interval: 3 }),
      ],
    }),
    ...extraEnemyRecords(),
  ];
}

function extraEnemyRecords(): EnemyRecord[] {
  const extras: readonly { readonly name: string; readonly monsterResourceId: string }[] = [
    { name: "좀비", monsterResourceId: "generated-enemy-zombie-01" },
    { name: "사마귀", monsterResourceId: "generated-enemy-mantis-01" },
    { name: "오크", monsterResourceId: "generated-enemy-orc-01" },
    { name: "실프", monsterResourceId: "generated-enemy-sylph-01" },
    { name: "레모라", monsterResourceId: "generated-enemy-lemora-01" },
    { name: "스피릿", monsterResourceId: "generated-enemy-spirit-01" },
    { name: "게", monsterResourceId: "generated-enemy-crab-01" },
    { name: "잭 오 랜턴", monsterResourceId: "generated-enemy-jackolantern-01" },
    { name: "타란툴라", monsterResourceId: "generated-enemy-spider-01" },
    { name: "카벙클", monsterResourceId: "generated-enemy-carbuncle-01" },
    { name: "구울", monsterResourceId: "generated-enemy-ghoul-01" },
    { name: "스펙터", monsterResourceId: "generated-enemy-specter-01" },
    { name: "말", monsterResourceId: "generated-enemy-horse-01" },
    { name: "케트 시", monsterResourceId: "generated-enemy-cat-01" },
    { name: "캇파", monsterResourceId: "generated-enemy-kappa-01" },
    { name: "코카트리스", monsterResourceId: "generated-enemy-cockatrice-01" },
    { name: "지네", monsterResourceId: "generated-enemy-centipede-01" },
    { name: "기생체", monsterResourceId: "generated-enemy-parasite-01" },
    { name: "하피", monsterResourceId: "generated-enemy-harpy-01" },
    { name: "뱀", monsterResourceId: "generated-enemy-snake-01" },
    { name: "샐러맨더", monsterResourceId: "generated-enemy-salamander-01" },
    { name: "네펜데스", monsterResourceId: "generated-enemy-plant-01" },
    { name: "전갈", monsterResourceId: "generated-enemy-scorpion-01" },
    { name: "유니콘", monsterResourceId: "generated-enemy-unicorn-01" },
  ];
  return extras.map((entry, index) => {
    const rank = index + 6;
    return normalizeEnemyRecord({
      id: `enemy_extra_${String(rank).padStart(2, "0")}`,
      name: entry.name,
      monsterResourceId: entry.monsterResourceId,
      stats: {
        maxHp: 18 + rank * 3,
        maxMp: index % 4 === 0 ? 0 : 2 + index,
        attack: 8 + rank,
        defense: 6 + Math.floor(rank / 2),
        mind: 5 + (index % 8),
        agility: 6 + ((index * 3) % 18),
      },
      rewards: {
        exp: 4 + rank * 2,
        gold: 2 + rank,
        dropItemId: index % 5 === 0 ? DEFAULT_ITEM_ID : undefined,
        dropRatePercent: index % 5 === 0 ? 10 : 0,
      },
      actions: [enemyAction(index % 3 === 0 ? "skill_fire" : DEFAULT_SKILL_ID, 50, { kind: "always" })],
    });
  });
}

function enemyAction(skillId: string, priority: number, condition: EnemyActionCondition): EnemyActionPattern {
  return {
    skillId,
    priority,
    condition,
    switchOnAfterAction: { enabled: false },
    switchOffAfterAction: { enabled: false },
  };
}

function defaultTroopRecords(): TroopRecord[] {
  return [
    normalizeTroopRecord({
      id: DEFAULT_TROOP_ID,
      name: "슬라임 정찰대",
      enemyIds: [DEFAULT_ENEMY_ID],
      members: [{ enemyId: DEFAULT_ENEMY_ID, x: 88, y: 96 }],
      autoAlign: false,
      previewBackgroundResourceId: "generated-battle-reference-forest",
      battleEventPages: [],
    }),
    normalizeTroopRecord({
      id: "troop_slime_pair",
      name: "초원 슬라임 둘",
      enemyIds: ["enemy_meadow_slime", "enemy_meadow_slime"],
      members: [
        { enemyId: "enemy_meadow_slime", x: 72, y: 88 },
        { enemyId: "enemy_meadow_slime", x: 116, y: 120 },
      ],
      autoAlign: false,
      previewBackgroundResourceId: "generated-battle-reference-forest",
      battleEventPages: [],
    }),
    normalizeTroopRecord({
      id: "troop_bat_swarm",
      name: "동굴 박쥐 떼",
      enemyIds: ["enemy_cave_bat", "enemy_cave_bat", "enemy_cave_bat"],
      members: [
        { enemyId: "enemy_cave_bat", x: 68, y: 64 },
        { enemyId: "enemy_cave_bat", x: 104, y: 100 },
        { enemyId: "enemy_cave_bat", x: 72, y: 132 },
      ],
      autoAlign: false,
      previewBackgroundResourceId: "generated-battle-reference-forest",
      battleEventPages: [],
    }),
    normalizeTroopRecord({
      id: "troop_forest_hornets",
      name: "숲의 슬라임과 박쥐",
      enemyIds: [DEFAULT_ENEMY_ID, "enemy_cave_bat", DEFAULT_ENEMY_ID],
      members: [
        { enemyId: DEFAULT_ENEMY_ID, x: 72, y: 120 },
        { enemyId: "enemy_cave_bat", x: 108, y: 72 },
        { enemyId: DEFAULT_ENEMY_ID, x: 96, y: 148 },
      ],
      autoAlign: false,
      previewBackgroundResourceId: "generated-battle-reference-forest",
      battleEventPages: [],
    }),
    normalizeTroopRecord({
      id: "troop_golem_guard",
      name: "버려진 골렘 경비",
      enemyIds: ["enemy_meadow_slime", "enemy_stone_golem", "enemy_cave_bat"],
      members: [
        { enemyId: "enemy_meadow_slime", x: 68, y: 140 },
        { enemyId: "enemy_stone_golem", x: 100, y: 96 },
        { enemyId: "enemy_cave_bat", x: 72, y: 60 },
      ],
      autoAlign: false,
      // Real side-view battle field art — not EasyRPG Night Sky / Dimension Rift panoramas.
      previewBackgroundResourceId: "generated-battle-reference-forest",
      battleEventPages: [],
    }),
    normalizeTroopRecord({
      id: "troop_dragon",
      name: "붉은 드래곤",
      enemyIds: ["enemy_dragon"],
      members: [{ enemyId: "enemy_dragon", x: 96, y: 92, hidden: false }],
      autoAlign: false,
      uncapturable: true,
      previewBackgroundResourceId: "generated-battle-reference-forest",
      battleEventPages: [],
    }),
  ];
}

function defaultMonsterSpeciesRecords(): MonsterSpeciesRecord[] {
  return [
    normalizeMonsterSpeciesRecord({
      id: "species_leafling",
      name: "리프링",
      types: ["grass"],
      graphic: { monsterResourceId: "generated-enemy-leafling-01", graphicHue: 0, transparent: false, flying: false },
      baseStats: { maxHp: 36, maxMp: 6, attack: 7, defense: 13, mind: 9, agility: 12 },
      captureRate: 0.45,
      skillsByLevel: [{ level: 1, skillId: DEFAULT_SKILL_ID }, { level: 3, skillId: "skill_leaf" }],
    }),
    normalizeMonsterSpeciesRecord({
      id: "species_sparkit",
      name: "스파킷",
      types: ["fire"],
      graphic: { monsterResourceId: "generated-enemy-sparkit-01", graphicHue: 0, transparent: false, flying: false },
      baseStats: { maxHp: 25, maxMp: 8, attack: 7, defense: 8, mind: 11, agility: 16 },
      captureRate: 0.45,
      skillsByLevel: [{ level: 1, skillId: DEFAULT_SKILL_ID }, { level: 3, skillId: "skill_fire" }],
    }),
    normalizeMonsterSpeciesRecord({
      id: "species_aqualing",
      name: "아쿠아링",
      types: ["water"],
      graphic: { monsterResourceId: "generated-enemy-aqualing-01", graphicHue: 0, transparent: false, flying: false },
      baseStats: { maxHp: 30, maxMp: 8, attack: 7, defense: 11, mind: 12, agility: 13 },
      captureRate: 0.45,
      skillsByLevel: [{ level: 1, skillId: DEFAULT_SKILL_ID }, { level: 3, skillId: "skill_water" }],
    }),
    normalizeMonsterSpeciesRecord({
      id: "species_wild_slime",
      name: "야생 슬라임",
      types: ["grass"],
      graphic: { monsterResourceId: "generated-enemy-slime-01", graphicHue: 0, transparent: false, flying: false },
      baseStats: { maxHp: 18, maxMp: 4, attack: 10, defense: 7, mind: 6, agility: 16 },
      expCurve: { base: 2, extra: 1, acceleration: 1 },
      captureRate: 0.7,
      skillsByLevel: [{ level: 1, skillId: DEFAULT_SKILL_ID }, { level: 7, skillId: "skill_leaf" }],
      evolutions: [{ toSpeciesId: "species_king_slime", requires: { level: 7 } }],
    }),
    normalizeMonsterSpeciesRecord({
      id: "species_king_slime",
      name: "킹슬라임",
      types: ["water", "grass"],
      graphic: { monsterResourceId: "generated-enemy-king-slime-01", graphicHue: 0, transparent: false, flying: false },
      baseStats: { maxHp: 42, maxMp: 10, attack: 18, defense: 14, mind: 10, agility: 12 },
      expCurve: { base: 3, extra: 2, acceleration: 1 },
      captureRate: 0.2,
      skillsByLevel: [{ level: 1, skillId: DEFAULT_SKILL_ID }, { level: 7, skillId: "skill_water" }],
    }),
    normalizeMonsterSpeciesRecord({
      id: "species_cave_bat",
      name: "동굴 박쥐",
      types: ["fire"],
      graphic: { monsterResourceId: "generated-enemy-bat-01", graphicHue: 0, transparent: false, flying: true },
      baseStats: { maxHp: 20, maxMp: 6, attack: 9, defense: 6, mind: 8, agility: 18 },
      captureRate: 0.55,
      skillsByLevel: [{ level: 1, skillId: DEFAULT_SKILL_ID }, { level: 4, skillId: "skill_fire" }],
    }),
    normalizeMonsterSpeciesRecord({
      id: "species_stone_golem",
      name: "돌 골렘",
      types: ["grass"],
      graphic: { monsterResourceId: "generated-enemy-golem-01", graphicHue: 0, transparent: false, flying: false },
      baseStats: { maxHp: 64, maxMp: 8, attack: 16, defense: 18, mind: 8, agility: 4 },
      captureRate: 0.35,
      skillsByLevel: [{ level: 1, skillId: DEFAULT_SKILL_ID }, { level: 5, skillId: "skill_leaf" }],
    }),
    normalizeMonsterSpeciesRecord({
      id: "species_ember_drake",
      name: "엠버 드레이크",
      types: ["fire"],
      graphic: { monsterResourceId: "generated-enemy-dragon-01", graphicHue: 0, transparent: false, flying: false },
      baseStats: { maxHp: 70, maxMp: 10, attack: 22, defense: 20, mind: 12, agility: 14 },
      captureRate: 0.15,
      skillsByLevel: [{ level: 1, skillId: DEFAULT_SKILL_ID }, { level: 6, skillId: "skill_fire" }],
    }),
    normalizeMonsterSpeciesRecord({
      id: "species_forest_hornet",
      name: "숲 말벌",
      types: ["grass"],
      graphic: { monsterResourceId: "easyrpg-monster-hornet", graphicHue: 0, transparent: false, flying: true },
      baseStats: { maxHp: 26, maxMp: 4, attack: 13, defense: 8, mind: 7, agility: 20 },
      captureRate: 0.5,
      skillsByLevel: [{ level: 1, skillId: DEFAULT_SKILL_ID }, { level: 4, skillId: "skill_leaf" }],
    }),
  ];
}
