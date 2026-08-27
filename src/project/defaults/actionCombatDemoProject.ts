// project/defaults/actionCombatDemoProject.ts
// 실시간 액션 전투 데모 프로젝트. 농장 데모의 폐광 1층(map_mine_1f)을 액션 무대로 승격시켜
// 이번 런에 들어간 규칙들을 한 프로젝트에서 모두 만질 수 있게 저작한다:
//   - 시스템 노브: 회피 스태미나 비용 / 회피 무적창 / 홀드 가드 감소율·소모 / HUD(하트·스태미나·적 HP 바)
//   - 적 저작: melee(박쥐) / projectile(해골 궁수) / dash(갱도 사냥개) 3종 공격
//   - 액션 스킬 2개(슬롯 순환이 실제로 닿는다) + 탄약 소모 스킬 + 액션 무기 스윙 프로필
// scripts/save-action-demo.mts 가 이 팩토리를 그대로 Supabase 에 저장/재로드한다.

import { charsetFrameIndex } from "@/assets/easyrpgRtp";

import { normalizeEnemyRecord, normalizeTroopRecord } from "../databaseEnemyTroopRecordModel";
import { normalizeEquipmentRecord, normalizeItemRecord, normalizeSkillRecord } from "../databaseRecordModel";
import { normalizeActionCombatConfig } from "../actionCombat";
import { DEFAULT_ACTOR_ID } from "./constants";
import { createFarmingDemoProject } from "./defaultProject";

import type { Project, SystemActionCombat } from "../types";

/** 액션 전투 데모가 저장되는 Supabase 프로젝트 id. */
export const ACTION_DEMO_PROJECT_ID = "rpg-zzu-action-demo";
/** 액션 옵트인 맵 — 농장 데모의 폐광 1층. */
export const ACTION_DEMO_MAP_ID = "map_mine_1f";
export const ACTION_DEMO_WEAPON_ID = "equip_action_mine_blade";
export const ACTION_DEMO_AMMO_ITEM_ID = "item_action_flame_shard";
/**
 * 슬롯 순환 순서(첫 슬롯 → 두 번째 슬롯).
 * 재로드 시 `normalizeActorRecord` 가 learnedSkills 를 (level, skillId) 로 정렬하므로
 * 슬롯 순서는 저작 순서가 아니라 **id 정렬**이 정한다. 그래서 소모 없는 돌을
 * 슬롯 1 로 둔다는 의도를 id 정렬에 맞춰 적는다(cast < flame).
 */
export const ACTION_DEMO_SKILL_IDS = ["skill_action_cast_stone", "skill_action_flame_bolt"] as const;
/** dash 공격을 들고 있는 저작 적 + 그 troop. */
export const ACTION_DEMO_DASH_ENEMY_ID = "enemy_mine_dash_hound";
export const ACTION_DEMO_DASH_TROOP_ID = "troop_mine_hounds";
export const ACTION_DEMO_START_POS = { x: 9, y: 13 } as const;

/**
 * 이번 런이 추가한 노브를 명시적으로 저작한다. 기본값에 의존하면 "저작된 값이 원격 왕복을
 * 견디는가" 를 증명할 수 없으므로 전부 기본값과 다른 수치를 쓴다.
 */
const AUTHORED_ACTION_COMBAT: SystemActionCombat = {
  enabled: true,
  playerIframesMs: 700,
  swingCooldownMs: 300,
  swingDamageBonus: 2,
  dodgeStaminaCost: 20,
  dodgeIframesMs: 320,
  guardDamageReductionPercent: 60,
  guardStaminaDrainPerSec: 18,
  hud: { hearts: true, stamina: true, enemyHpBars: "damaged" },
};

/** 갱도 사냥개 — 돌진(dash) 공격. 넉백에 약하고 체력이 낮아 회피 타이밍 연습대가 된다. */
function createDashHoundEnemy() {
  return normalizeEnemyRecord({
    id: ACTION_DEMO_DASH_ENEMY_ID,
    name: "갱도 사냥개",
    monsterResourceId: "generated-enemy-wolf-grey",
    stats: { maxHp: 140, maxMp: 10, attack: 14, defense: 16, mind: 10, agility: 14 },
    rewards: { exp: 10, gold: 9, dropRatePercent: 15 },
    actions: [{ skillId: "skill_attack", priority: 5, condition: { kind: "always" } }],
    actionProfile: {
      contactDamage: 6,
      aggroRange: 8,
      moveIntervalMs: 260,
      knockbackResist: 0.2,
      // 돌진: 먼 거리에서 선딜을 크게 열고 한 번에 파고든다 — 가드/회피 둘 다 답이 된다.
      attack: { kind: "dash", windupMs: 600, recoverMs: 700, damage: 22, range: 5, cooldownMs: 1700 },
    },
  });
}

function upsertById<T extends { id: string }>(list: T[], record: T): void {
  const index = list.findIndex((entry) => entry.id === record.id);
  if (index >= 0) list[index] = record;
  else list.push(record);
}

/**
 * 액션 전투 데모 프로젝트.
 * 농장 데모를 토대로 쓰는 이유: 폐광 1층이 이미 액션 옵트인 맵이고 melee/projectile 적 스폰이
 * 저작돼 있다. 여기서는 그 무대에 dash 적, 액션 스킬 슬롯, 무기 프로필, 시스템 노브를 얹는다.
 */
export function createActionCombatDemoProject(): Project {
  const project = createFarmingDemoProject();
  project.meta = { ...project.meta, title: "액션 전투 데모 — 폐광 1층" };
  project.system = {
    ...project.system,
    actionCombat: normalizeActionCombatConfig(AUTHORED_ACTION_COMBAT) ?? AUTHORED_ACTION_COMBAT,
  };

  // 데모는 액션 맵에서 바로 시작한다(농장에서 광산까지 걸어갈 필요 없음).
  project.startMapId = ACTION_DEMO_MAP_ID;
  project.startPos = { ...ACTION_DEMO_START_POS };

  // dash 적 + troop + 스폰.
  upsertById(project.database.enemies, createDashHoundEnemy());
  upsertById(project.database.troops, normalizeTroopRecord({
    id: ACTION_DEMO_DASH_TROOP_ID,
    name: "갱도 사냥개 한 쌍",
    enemyIds: [ACTION_DEMO_DASH_ENEMY_ID, ACTION_DEMO_DASH_ENEMY_ID],
    autoAlign: true,
    battleEventPages: [],
  }));
  const mine = project.maps[ACTION_DEMO_MAP_ID];
  if (mine) {
    const spawns = [...(mine.fieldSpawns ?? [])].filter((spawn) => spawn.id !== "spawn_mine_hounds");
    spawns.push({
      id: "spawn_mine_hounds",
      troopId: ACTION_DEMO_DASH_TROOP_ID,
      area: { x: 7, y: 11, w: 6, h: 4 },
      maxAlive: 2,
      respawnSec: 35,
      chase: true,
      graphic: {
        sprite: { type: "bundled", id: "tex_easyrpg_charset_monster2" },
        direction: "down",
        pattern: charsetFrameIndex({ characterIndex: 2, direction: "down", pattern: 1 }),
      },
    });
    mine.fieldSpawns = spawns;
  }

  // 액션 무기 — 스윙 사거리/쿨다운/데미지 가산.
  upsertById(project.database.equipment, normalizeEquipmentRecord({
    id: ACTION_DEMO_WEAPON_ID,
    name: "폐광 검",
    slot: "weapon",
    description: "액션 전투용 검. 스윙이 두 칸까지 닿고 조금 더 빠르다.",
    price: 480,
    statBonuses: { attack: 4, defense: 0, mind: 0, agility: 1 },
    actionWeapon: { swingRange: 2, swingCooldownMs: 280, swingDamageBonus: 5 },
  }));

  // 탄약 아이템 — 두 번째 액션 스킬이 발당 1개를 먹는다.
  upsertById(project.database.items, normalizeItemRecord({
    id: ACTION_DEMO_AMMO_ITEM_ID,
    name: "불꽃 파편",
    description: "화염탄 1발의 재료. 액션 스킬 캐스트마다 1개 소모.",
    scope: "none",
    price: 6,
    type: "normal",
    occasion: "never",
    consumable: false,
  }));

  // 액션 스킬 두 개 — 슬롯 순환(R)이 실제로 닿아야 한다.
  upsertById(project.database.skills, normalizeSkillRecord({
    id: ACTION_DEMO_SKILL_IDS[0],
    name: "돌 던지기",
    description: "전방으로 돌을 던진다. 소모 없음. (액션 스킬 — 슬롯 1)",
    mpCost: { flat: 0, percentMax: 0 },
    actionSkill: { kind: "projectile", damage: 10, range: 7, speedTilesPerSec: 7 },
  }));
  upsertById(project.database.skills, normalizeSkillRecord({
    id: ACTION_DEMO_SKILL_IDS[1],
    name: "화염탄",
    description: "불꽃 파편 1개를 태워 강한 탄환을 쏜다. (액션 스킬 — 슬롯 2)",
    mpCost: { flat: 2, percentMax: 0 },
    actionSkill: {
      kind: "projectile",
      damage: 24,
      range: 9,
      speedTilesPerSec: 9,
      itemCost: { itemId: ACTION_DEMO_AMMO_ITEM_ID, amount: 1 },
    },
  }));

  const hero = project.database.actors.find((actor) => actor.id === DEFAULT_ACTOR_ID);
  if (hero) {
    hero.initialEquipment = { ...hero.initialEquipment, weapon: ACTION_DEMO_WEAPON_ID };
    // 슬롯 순서 = 배운 순서다. 액션 스킬을 맨 앞에 두어 슬롯 1/2 를 못 박는다.
    const rest = hero.learnedSkills.filter((entry) => !ACTION_DEMO_SKILL_IDS.includes(entry.skillId as typeof ACTION_DEMO_SKILL_IDS[number]));
    hero.learnedSkills = [
      ...ACTION_DEMO_SKILL_IDS.map((skillId) => ({ level: 1, skillId })),
      ...rest,
    ];
  }

  project.session = {
    ...project.session,
    inventory: { ...(project.session.inventory ?? {}), [ACTION_DEMO_AMMO_ITEM_ID]: 16 },
  };
  return project;
}
