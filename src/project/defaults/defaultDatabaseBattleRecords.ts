import type { EnemyActionCondition, EnemyActionPattern, EnemyRecord, TroopRecord } from "../types";
import { normalizeEnemyRecord, normalizeTroopRecord } from "../databaseRecordModel";
import { DEFAULT_ENEMY_ID, DEFAULT_ITEM_ID, DEFAULT_SKILL_ID, DEFAULT_TROOP_ID } from "./constants";

type BattleRecords = {
  readonly enemies: EnemyRecord[];
  readonly troops: TroopRecord[];
};

export function defaultBattleRecords(): BattleRecords {
  return {
    enemies: defaultEnemyRecords(),
    troops: defaultTroopRecords(),
  };
}

function defaultEnemyRecords(): EnemyRecord[] {
  return [
    normalizeEnemyRecord({
      id: DEFAULT_ENEMY_ID,
      name: "말벌",
      monsterResourceId: "generated-enemy-sylph-hornet",
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
      monsterResourceId: "generated-enemy-slime-01",
      stats: { maxHp: 24, maxMp: 3, attack: 8, defense: 11, mind: 5, agility: 6 },
      rewards: { exp: 6, gold: 5, dropItemId: DEFAULT_ITEM_ID, dropRatePercent: 18 },
      actions: [enemyAction(DEFAULT_SKILL_ID, 5, { kind: "always" })],
    }),
    normalizeEnemyRecord({
      id: "enemy_cave_bat",
      name: "동굴 박쥐",
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
  const resourceCycle = [
    "generated-enemy-slime-01",
    "generated-enemy-bat-01",
    "generated-enemy-golem-01",
    "generated-enemy-dragon-01",
    "easyrpg-monster-hornet",
  ];
  const names = [
    "좀비",
    "사마귀",
    "오크",
    "실프",
    "레모라",
    "스피릿",
    "게",
    "잭 오 랜턴",
    "타란툴라",
    "카벙클",
    "구울",
    "스펙터",
    "말",
    "케트 시",
    "캇파",
    "코카트리스",
    "지네",
    "기생체",
    "하피",
    "뱀",
    "샐러맨더",
    "네펜데스",
    "전갈",
    "유니콘",
  ];
  return names.map((name, index) => {
    const rank = index + 6;
    return normalizeEnemyRecord({
      id: `enemy_extra_${String(rank).padStart(2, "0")}`,
      name,
      monsterResourceId: resourceCycle[index % resourceCycle.length],
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
      name: "말벌 정찰대",
      enemyIds: [DEFAULT_ENEMY_ID],
      members: [{ enemyId: DEFAULT_ENEMY_ID, x: 168, y: 112 }],
      autoAlign: false,
      previewBackgroundResourceId: "easyrpg-backdrop-sky1",
      battleEventPages: [],
    }),
    normalizeTroopRecord({
      id: "troop_slime_pair",
      name: "초원 슬라임 둘",
      enemyIds: ["enemy_meadow_slime", "enemy_meadow_slime"],
      members: [
        { enemyId: "enemy_meadow_slime", x: 128, y: 136 },
        { enemyId: "enemy_meadow_slime", x: 192, y: 136 },
      ],
      autoAlign: false,
      previewBackgroundResourceId: "easyrpg-backdrop-dawn1",
      battleEventPages: [],
    }),
    normalizeTroopRecord({
      id: "troop_bat_swarm",
      name: "동굴 박쥐 떼",
      enemyIds: ["enemy_cave_bat", "enemy_cave_bat", "enemy_cave_bat"],
      members: [
        { enemyId: "enemy_cave_bat", x: 112, y: 88 },
        { enemyId: "enemy_cave_bat", x: 168, y: 112 },
        { enemyId: "enemy_cave_bat", x: 224, y: 88 },
      ],
      autoAlign: false,
      previewBackgroundResourceId: "easyrpg-backdrop-night-sky1",
      battleEventPages: [],
    }),
    normalizeTroopRecord({
      id: "troop_forest_hornets",
      name: "숲의 말벌과 박쥐",
      enemyIds: [DEFAULT_ENEMY_ID, "enemy_cave_bat", DEFAULT_ENEMY_ID],
      members: [
        { enemyId: DEFAULT_ENEMY_ID, x: 116, y: 128 },
        { enemyId: "enemy_cave_bat", x: 168, y: 84 },
        { enemyId: DEFAULT_ENEMY_ID, x: 220, y: 128 },
      ],
      autoAlign: false,
      previewBackgroundResourceId: "easyrpg-backdrop-sunset1",
      battleEventPages: [],
    }),
    normalizeTroopRecord({
      id: "troop_golem_guard",
      name: "버려진 골렘 경비",
      enemyIds: ["enemy_meadow_slime", "enemy_stone_golem", "enemy_cave_bat"],
      members: [
        { enemyId: "enemy_meadow_slime", x: 112, y: 152 },
        { enemyId: "enemy_stone_golem", x: 168, y: 112 },
        { enemyId: "enemy_cave_bat", x: 224, y: 88 },
      ],
      autoAlign: false,
      previewBackgroundResourceId: "easyrpg-backdrop-dimension-rift",
      battleEventPages: [],
    }),
    normalizeTroopRecord({
      id: "troop_dragon",
      name: "붉은 드래곤",
      enemyIds: ["enemy_dragon"],
      members: [{ enemyId: "enemy_dragon", x: 168, y: 104, hidden: false }],
      autoAlign: false,
      previewBackgroundResourceId: "easyrpg-backdrop-dimension-rift",
      battleEventPages: [],
    }),
  ];
}
