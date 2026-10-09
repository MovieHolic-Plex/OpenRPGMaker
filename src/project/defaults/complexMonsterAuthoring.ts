/**
 * Complex monster/troop authoring helpers for dungeon bosses and multi-member fights.
 * Pure project mutators — scripts and tools call these then save.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { DEFAULT_SKILL_ID } from "@/project/defaults/constants";
import { buildFieldMonsterFightCommands } from "@/project/fieldMonsterTemplate";
import type {
  BattleEventPageRecord,
  EnemyActionCondition,
  EnemyActionPattern,
  EnemyRecord,
  EnemyStats,
  EventPage,
  GameEvent,
  Project,
  TroopMemberRecord,
  TroopRecord,
} from "@/project/types";

export type ComplexEnemySeed = {
  readonly id: string;
  readonly name: string;
  readonly monsterResourceId: string;
  readonly stats: Partial<EnemyStats> & Pick<EnemyStats, "maxHp" | "attack">;
  readonly rewards?: { exp?: number; gold?: number; dropItemId?: string; dropRatePercent?: number };
  readonly speciesId?: string;
  readonly skillIds?: readonly string[];
  readonly flying?: boolean;
  /** Extra actions beyond basic attack. */
  readonly extraActions?: readonly { skillId: string; priority: number; condition?: EnemyActionCondition }[];
};

export type ComplexTroopSeed = {
  readonly id: string;
  readonly name: string;
  readonly members: readonly { enemyId: string; x?: number; y?: number; hidden?: boolean }[];
  readonly previewBackgroundResourceId?: string;
  readonly uncapturable?: boolean;
  readonly battleEventPages?: readonly Partial<BattleEventPageRecord>[];
  readonly introMessage?: string;
};

export type FieldBattleMonsterSeed = {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly troopId: string;
  readonly intro: string;
  readonly victory: string;
  readonly spriteId: string;
  readonly characterIndex: number;
  readonly clearSwitch: string;
};

export type ComplexMonsterBundle = {
  readonly enemies: EnemyRecord[];
  readonly troop: TroopRecord;
  readonly fieldEvent: GameEvent;
};

const DEFAULT_STATS: EnemyStats = {
  maxHp: 30,
  maxMp: 6,
  attack: 12,
  defense: 10,
  mind: 8,
  agility: 10,
};

function enemyAction(skillId: string, priority: number, condition: EnemyActionCondition): EnemyActionPattern {
  return {
    skillId,
    priority,
    condition,
    switchOnAfterAction: { enabled: false },
    switchOffAfterAction: { enabled: false },
  };
}

/** Evenly space members across a side-view battle field (~320 wide). */
export function layoutTroopMembers(
  members: readonly { enemyId: string; x?: number; y?: number; hidden?: boolean }[],
): TroopMemberRecord[] {
  const n = members.length;
  if (n === 0) return [];
  const minX = 96;
  const maxX = 240;
  return members.map((member, index) => {
    const t = n === 1 ? 0.5 : index / (n - 1);
    const x = member.x ?? Math.round(minX + (maxX - minX) * t);
    const y = member.y ?? (index % 2 === 0 ? 112 : 136);
    return {
      enemyId: member.enemyId,
      x,
      y,
      hidden: member.hidden === true,
    };
  });
}

export function buildComplexEnemy(seed: ComplexEnemySeed): EnemyRecord {
  const stats: EnemyStats = {
    ...DEFAULT_STATS,
    ...seed.stats,
    maxHp: seed.stats.maxHp,
    attack: seed.stats.attack,
  };
  const actions: EnemyActionPattern[] = [
    enemyAction(DEFAULT_SKILL_ID, 5, { kind: "always" }),
    ...(seed.extraActions ?? []).map((action) =>
      enemyAction(action.skillId, action.priority, action.condition ?? { kind: "always" }),
    ),
  ];
  for (const skillId of seed.skillIds ?? []) {
    if (!actions.some((a) => a.skillId === skillId)) {
      actions.push(enemyAction(skillId, 4, { kind: "turn", start: 2, interval: 3 }));
    }
  }
  return normalizeEnemyRecord({
    id: seed.id,
    name: seed.name,
    speciesId: seed.speciesId,
    monsterResourceId: seed.monsterResourceId,
    flying: seed.flying,
    stats,
    rewards: {
      exp: seed.rewards?.exp ?? Math.max(4, Math.floor(stats.maxHp / 3)),
      gold: seed.rewards?.gold ?? Math.max(2, Math.floor(stats.attack)),
      dropItemId: seed.rewards?.dropItemId,
      dropRatePercent: seed.rewards?.dropRatePercent ?? 0,
    },
    actions,
  });
}

export function buildComplexTroop(seed: ComplexTroopSeed): TroopRecord {
  const members = layoutTroopMembers(seed.members);
  if (members.length === 0) {
    throw new Error(`complex troop ${seed.id} needs at least one member`);
  }
  const battleEventPages: BattleEventPageRecord[] = (seed.battleEventPages ?? []).map((page, index) => ({
    id: page.id ?? `${seed.id}_page_${index + 1}`,
    name: page.name ?? `전투 이벤트 ${index + 1}`,
    conditions: page.conditions ?? [{ kind: "turn", start: 0, interval: 0 }],
    span: page.span ?? "battle",
    runOnce: page.runOnce ?? true,
    commands: page.commands ?? [],
  }));
  if (seed.introMessage && battleEventPages.length === 0) {
    battleEventPages.push({
      id: `${seed.id}_intro`,
      name: "전투 시작",
      conditions: [{ kind: "turn", start: 0, interval: 0 }],
      span: "battle",
      runOnce: true,
      commands: [{ kind: "text", body: seed.introMessage }],
    });
  }
  return normalizeTroopRecord({
    id: seed.id,
    name: seed.name,
    members,
    enemyIds: members.map((m) => m.enemyId),
    autoAlign: false,
    uncapturable: seed.uncapturable,
    previewBackgroundResourceId: seed.previewBackgroundResourceId ?? "battle-scenery-forest",
    battleEventPages,
  });
}

function fieldGraphic(spriteId: string, characterIndex: number): EventPage["graphic"] {
  return {
    sprite: { type: "bundled", id: spriteId },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
  };
}

/** Field encounter: live page (switch false) + cleared page (switch true). */
export function buildFieldBattleMonsterEvent(seed: FieldBattleMonsterSeed): GameEvent {
  return {
    id: seed.id,
    x: seed.x,
    y: seed.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `${seed.id}_live`,
        name: seed.name,
        conditions: [{ kind: "switch", switchId: seed.clearSwitch, value: false }],
        graphic: fieldGraphic(seed.spriteId, seed.characterIndex),
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: { type: "random", speed: 2, frequency: 3 },
        commands: buildFieldMonsterFightCommands({
          troopId: seed.troopId,
          clearSwitchId: seed.clearSwitch,
          intro: [seed.intro],
          victory: [seed.victory],
        }),
      },
      {
        id: `${seed.id}_gone`,
        name: "빈 자리",
        conditions: [{ kind: "switch", switchId: seed.clearSwitch, value: true }],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "below",
        overlapForbidden: false,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", body: "이미 쓰러뜨린 자리이다." }],
      },
    ],
  };
}

export function upsertEnemyIntoProject(project: Project, enemy: EnemyRecord): "added" | "updated" {
  const index = project.database.enemies.findIndex((entry) => entry.id === enemy.id);
  if (index < 0) {
    project.database.enemies.push(enemy);
    return "added";
  }
  project.database.enemies[index] = enemy;
  return "updated";
}

export function upsertTroopIntoProject(project: Project, troop: TroopRecord): "added" | "updated" {
  const index = project.database.troops.findIndex((entry) => entry.id === troop.id);
  if (index < 0) {
    project.database.troops.push(troop);
    return "added";
  }
  project.database.troops[index] = troop;
  return "updated";
}

/**
 * Build themed multi-member boss troops for lava/stone/ice home dungeons.
 * Uses existing generated/scarloxy/easyrpg monster resources.
 */
export function seedHomeDungeonComplexTroops(project: Project): {
  troops: TroopRecord[];
  enemies: EnemyRecord[];
} {
  const enemySeeds: ComplexEnemySeed[] = [
    {
      id: "enemy_lava_ember_slime",
      name: "불꽃 슬라임",
      monsterResourceId: "generated-enemy-slime-01",
      stats: { maxHp: 36, maxMp: 8, attack: 14, defense: 9, mind: 8, agility: 12 },
      rewards: { exp: 12, gold: 10, dropRatePercent: 15 },
      skillIds: ["skill_fire"],
      extraActions: [{ skillId: "skill_fire", priority: 6, condition: { kind: "turn", start: 2, interval: 2 } }],
    },
    {
      id: "enemy_lava_ash_bat",
      name: "재 박쥐",
      monsterResourceId: "generated-enemy-bat-01",
      stats: { maxHp: 28, maxMp: 10, attack: 12, defense: 7, mind: 10, agility: 20 },
      flying: true,
      rewards: { exp: 10, gold: 8 },
      skillIds: ["skill_sleep_mist"],
    },
    {
      id: "enemy_stone_ruin_golem",
      name: "유적 골렘",
      monsterResourceId: "generated-enemy-golem-01",
      stats: { maxHp: 90, maxMp: 12, attack: 20, defense: 24, mind: 8, agility: 4 },
      rewards: { exp: 40, gold: 28, dropRatePercent: 12 },
      skillIds: ["skill_weaken"],
    },
    {
      id: "enemy_stone_bone_guard",
      name: "해골 병사",
      monsterResourceId: "generated-enemy-skeleton-01",
      stats: { maxHp: 42, maxMp: 6, attack: 16, defense: 12, mind: 6, agility: 11 },
      rewards: { exp: 16, gold: 12 },
      skillIds: [DEFAULT_SKILL_ID],
      extraActions: [{ skillId: "skill_poison_sting", priority: 5, condition: { kind: "turn", start: 1, interval: 3 } }],
    },
    {
      id: "enemy_ice_frost_wraith",
      name: "서리 유령",
      monsterResourceId: "scarloxy-monster-draem",
      stats: { maxHp: 48, maxMp: 16, attack: 15, defense: 10, mind: 18, agility: 14 },
      flying: true,
      rewards: { exp: 22, gold: 16 },
      skillIds: ["skill_sleep_mist", "skill_arcane_bolt"],
    },
    {
      id: "enemy_ice_azure_drake",
      name: "얼음 비룡",
      monsterResourceId: "generated-enemy-dragon-01",
      stats: { maxHp: 110, maxMp: 20, attack: 26, defense: 22, mind: 16, agility: 12 },
      rewards: { exp: 60, gold: 50, dropRatePercent: 20 },
      skillIds: ["skill_arcane_bolt", "skill_fire"],
      extraActions: [{ skillId: "skill_arcane_bolt", priority: 8, condition: { kind: "turn", start: 1, interval: 2 } }],
    },
  ];

  const enemies = enemySeeds.map(buildComplexEnemy);
  for (const enemy of enemies) upsertEnemyIntoProject(project, enemy);

  const troopSeeds: ComplexTroopSeed[] = [
    {
      id: "troop_lava_ember_pack",
      name: "용암 불꽃 무리",
      members: [
        { enemyId: "enemy_lava_ember_slime" },
        { enemyId: "enemy_lava_ash_bat" },
        { enemyId: "enemy_lava_ember_slime" },
      ],
      previewBackgroundResourceId: "battle-scenery-desert",
      introMessage: "용암이 끓으며 불꽃 슬라임과 재 박쥐가 덤벼든다!",
    },
    {
      id: "troop_lava_ash_bats",
      name: "재 박쥐 떼",
      members: [
        { enemyId: "enemy_lava_ash_bat" },
        { enemyId: "enemy_lava_ash_bat" },
        { enemyId: "enemy_lava_ash_bat" },
      ],
      previewBackgroundResourceId: "battle-scenery-cave",
    },
    {
      id: "troop_stone_ruin_guard",
      name: "유적 수호 골렘",
      members: [
        { enemyId: "enemy_stone_bone_guard" },
        { enemyId: "enemy_stone_ruin_golem" },
        { enemyId: "enemy_stone_bone_guard" },
      ],
      previewBackgroundResourceId: "battle-scenery-forest",
      uncapturable: true,
      introMessage: "석상이 깨어나고 해골 병사들이 창을 든다!",
    },
    {
      id: "troop_stone_bone_pair",
      name: "해골 순찰대",
      members: [
        { enemyId: "enemy_stone_bone_guard" },
        { enemyId: "enemy_stone_bone_guard" },
      ],
      previewBackgroundResourceId: "battle-scenery-cave",
    },
    {
      id: "troop_ice_wraith_pack",
      name: "서리 유령 무리",
      members: [
        { enemyId: "enemy_ice_frost_wraith" },
        { enemyId: "enemy_lava_ash_bat", hidden: false },
        { enemyId: "enemy_ice_frost_wraith" },
      ],
      previewBackgroundResourceId: "battle-scenery-snow",
      introMessage: "차가운 안개 속에서 유령들이 나타난다…",
    },
    {
      id: "troop_ice_azure_drake",
      name: "얼음 비룡",
      members: [{ enemyId: "enemy_ice_azure_drake" }],
      previewBackgroundResourceId: "battle-scenery-snow",
      uncapturable: true,
      introMessage: "동굴 깊숙이 푸른 비룡이 낮게 으르렁거린다!",
    },
  ];

  const troops = troopSeeds.map(buildComplexTroop);
  for (const troop of troops) upsertTroopIntoProject(project, troop);

  return { troops, enemies };
}

export function buildComplexMonsterBundle(input: {
  enemySeeds: readonly ComplexEnemySeed[];
  troop: ComplexTroopSeed;
  field: FieldBattleMonsterSeed;
}): ComplexMonsterBundle {
  const enemies = input.enemySeeds.map(buildComplexEnemy);
  const troop = buildComplexTroop(input.troop);
  const fieldEvent = buildFieldBattleMonsterEvent(input.field);
  return { enemies, troop, fieldEvent };
}
