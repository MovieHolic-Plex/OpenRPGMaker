// 현행 그림(5×4 20칸 세트, src/assets/currentMonsterArt.ts)이 없는 기본 적 → 이름·역할이 가장 가까운 현행 종(대역).
//
// 새 프로젝트(createBlankProject)는 옛 3×3 그림을 쓰던 기본 적 74종의 그림을 대역 종의 그림으로 바꿔 싣는다 — 오너 2026-11-24
// «'전투 몬스터' 가 예전 버전으로 남아 있다 · 최신 몬스터들 반영», 리드 «배지로 남기지 말고 가까운 현행 종으로 바꿔라(새 프로젝트만)».
// 이미 저장된 프로젝트의 적 그림은 바꾸지 않는다. 대역 표는 조수 v2(story/currentFoes)가 «없는 그림» 줄을 쓸 때도 그대로 읽는다:
// 그림이 대역으로 바뀐 기본 적은 «바란 그림»(원래 그림 id 꼬리)이 여전히 그 적의 옛 그림이다.
import { isCurrentMonsterArt } from "@/assets/currentMonsterArt";
import type { EnemyRecord } from "../types";
import { defaultBattleRecords } from "./defaultDatabaseBattleRecords";

/** 기본 적 id 꼬리(enemy_ 뺀 것) → 대역 적 id 꼬리. 대역은 모두 현행 그림을 가진 기본 적이다. */
export const CURRENT_MONSTER_STAND_IN: Readonly<Record<string, string>> = (() => {
  const groups: Record<string, readonly string[]> = {
    slime_green: ["slime", "meadow_slime", "slime_blue", "slime_red", "slime_metal", "slime_king", "slime_cube", "ooze_black", "ooze_acid"],
    bat_cave: ["cave_bat", "bat_vampire", "rat_giant"],
    spider_cave: ["spider_widow"],
    golem_stone: ["stone_golem", "totem_cursed", "gargoyle_stone", "ape_stone", "spirit_earth", "troll_cave", "ogre_club", "minotaur_maze", "behemoth_horn"],
    golem_iron: ["armor_living", "knight_fallen", "skeleton_knight", "sword_flying", "puppet_string", "mimic_chest"],
    dragon_blue: ["dragon", "dragon_whelp", "dragon_red", "dragon_bone", "hydra_three", "wyvern_cliff"],
    ghost_pale: ["skeleton_bone", "skeleton_archer", "mine_skel_archer", "zombie_rot", "ghoul_grave", "mummy_bandage", "banshee_wail", "bonepile_crawler"],
    wraith_dark: ["lich_frost", "revenant_vengeful", "spirit_dark", "demon_lord", "angel_fallen", "mage_rogue"],
    beetle_horn: ["scorpion_sand", "ant_soldier"],
    snake_viper: ["worm_sand", "lizardman_spear"],
    spirit_fire: ["salamander_flame", "centipede_fire"],
    wolf_dire: ["bear_brown", "tiger_saber"],
    hound_hell: ["cat_shadow"],
    boar_tusk: ["goat_mountain", "deer_forest", "centaur_plains"],
    goblin_scout: ["goblin_brute", "orc_warrior", "orc_shaman", "kobold_digger", "imp_mischief"],
    wisp_blue: ["spirit_wind", "spirit_light", "sylph_air"],
    spirit_water: ["undine_sea"],
    bird_hawk: ["harpy_cliff", "griffin_sky", "roc_giant", "phoenix_rebirth"],
    eel_electric: ["fish_piranha", "squid_deep", "shark_land"],
    plant_carnivore: ["scarecrow_field"],
  };
  const out: Record<string, string> = {};
  for (const [to, from] of Object.entries(groups)) for (const tail of from) out[tail] = to;
  return out;
})();

type StandIn = { readonly original: string; readonly standIn: string; readonly standInEnemyId: string };
let table: ReadonlyMap<string, StandIn> | undefined;

/** 기본 적 id → (원래 그림, 대역 그림). 원래 그림이 이미 현행이거나 대역이 현행 그림이 아니면 싣지 않는다. */
function standInTable(): ReadonlyMap<string, StandIn> {
  if (table) return table;
  const enemies = defaultBattleRecords().enemies;
  const artOf = new Map(enemies.map((enemy) => [enemy.id, enemy.monsterResourceId]));
  const map = new Map<string, StandIn>();
  for (const enemy of enemies) {
    const to = CURRENT_MONSTER_STAND_IN[enemy.id.replace(/^enemy_/u, "")];
    const original = enemy.monsterResourceId;
    const standInEnemyId = to ? `enemy_${to}` : undefined;
    const standIn = standInEnemyId ? artOf.get(standInEnemyId) : undefined;
    if (!original || !standIn || !standInEnemyId || isCurrentMonsterArt(original) || !isCurrentMonsterArt(standIn)) continue;
    map.set(enemy.id, { original, standIn, standInEnemyId });
  }
  table = map;
  return map;
}

/** 새 프로젝트 기본 적: 옛 그림을 그대로 쓰는 적의 그림을 대역 종의 현행 그림으로 바꾼다. 바꾼 수. */
export function applyCurrentMonsterStandIns(enemies: EnemyRecord[]): number {
  let changed = 0;
  for (const enemy of enemies) {
    const entry = standInTable().get(enemy.id);
    if (!entry || enemy.monsterResourceId !== entry.original) continue;
    enemy.monsterResourceId = entry.standIn;
    changed++;
  }
  return changed;
}

/** 대역 그림으로 서 있는 기본 적이면 그 적의 원래(옛) 그림 id, 아니면 undefined. */
export function standInOriginalArt(enemy: { readonly id: string; readonly monsterResourceId?: string } | undefined): string | undefined {
  const entry = enemy ? standInTable().get(enemy.id) : undefined;
  return entry && enemy?.monsterResourceId === entry.standIn ? entry.original : undefined;
}
