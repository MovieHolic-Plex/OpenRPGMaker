// 던전 주제에 맞는 적 그룹(2026-10-23 assistant-dungeons-2): 채우기(populate)가 troops 없이 불리면 데이터베이스에서 가장 센 그룹을 보스로 썼다 —
// 지하 묘지·잠긴 신전·고블린 굴·탑 보스가 모두 「붉은 드래곤」이었고(VQA major), 화산 동굴 잡몹은 슬라임이었다.
// 이제 종류(type)·소굴(lair)·잠김(flooded)·탑(direction up)·이름 낱말로 주제를 정하고, 기본 데이터베이스에 이미 있는 적의 그림을 빌려
// 이 던전 전용 적 그룹을 만든다. 세기는 원래 고르던 그룹(조율된 잡몹·가장 센 보스)에 맞춰 능력치를 비례로 옮긴다 — 균형은 그대로, 그림·이름만 주제.
import type { Project } from "@/project/types";

type Role = "field" | "midBoss" | "boss";
interface Theme { readonly id: string; readonly label: string; readonly field: readonly string[]; readonly midBoss: string; readonly boss: string; readonly bossName?: string }

const THEMES: Record<string, Theme> = {
  goblin: { id: "goblin", label: "고블린", field: ["enemy_goblin_scout"], midBoss: "enemy_orc_warrior", boss: "enemy_goblin_brute", bossName: "고블린 대장" },
  orc: { id: "orc", label: "오크", field: ["enemy_orc_warrior"], midBoss: "enemy_orc_shaman", boss: "enemy_orc_shaman", bossName: "오크 족장" },
  bandit: { id: "bandit", label: "산적", field: ["enemy_bandit_mask"], midBoss: "enemy_bandit_mask", boss: "enemy_knight_fallen", bossName: "산적 두목" },
  undead: { id: "undead", label: "언데드", field: ["enemy_skeleton_bone", "enemy_zombie_rot"], midBoss: "enemy_ghoul_grave", boss: "enemy_lich_frost", bossName: "묘지의 리치" },
  tower: { id: "tower", label: "탑", field: ["enemy_armor_living", "enemy_golem_iron"], midBoss: "enemy_armor_living", boss: "enemy_knight_fallen", bossName: "탑의 흑기사" },
  volcano: { id: "volcano", label: "화산", field: ["enemy_centipede_fire", "enemy_hound_hell"], midBoss: "enemy_salamander_flame", boss: "enemy_dragon_red", bossName: "화산의 붉은 용" },
  water: { id: "water", label: "물", field: ["enemy_crab_rock", "enemy_spirit_water"], midBoss: "enemy_spirit_water", boss: "enemy_undine_sea", bossName: "잠긴 신전의 운디네" },
  temple: { id: "temple", label: "신전", field: ["enemy_mummy_bandage", "enemy_totem_cursed"], midBoss: "enemy_golem_stone", boss: "enemy_golem_crystal", bossName: "신전의 수정 골렘" },
  cave: { id: "cave", label: "동굴", field: ["enemy_bat_cave", "enemy_spider_cave"], midBoss: "enemy_bear_brown", boss: "enemy_spider_widow", bossName: "동굴의 과부 거미" },
  sewer: { id: "sewer", label: "하수도", field: ["enemy_rat_giant", "enemy_ooze_black"], midBoss: "enemy_ooze_acid", boss: "enemy_slime_king" },
  mine: { id: "mine", label: "광산", field: ["enemy_kobold_digger", "enemy_skeleton_archer"], midBoss: "enemy_golem_clay", boss: "enemy_golem_stone", bossName: "광산의 돌 골렘" },
  maze: { id: "maze", label: "미궁", field: ["enemy_skeleton_bone", "enemy_armor_living"], midBoss: "enemy_armor_living", boss: "enemy_minotaur_maze" },
  dragon: { id: "dragon", label: "용", field: ["enemy_dragon_whelp"], midBoss: "enemy_wyvern_cliff", boss: "enemy_dragon_red" },
  demon: { id: "demon", label: "마왕", field: ["enemy_imp_mischief", "enemy_knight_fallen"], midBoss: "enemy_knight_fallen", boss: "enemy_demon_lord" },
  // 2026-10-23 dungeon-themes: 새 주제
  forest: { id: "forest", label: "숲", field: ["enemy_wolf_grey", "enemy_plant_carnivore", "enemy_bee_giant"], midBoss: "enemy_wolf_dire", boss: "enemy_troll_cave", bossName: "숲의 늙은 트롤" },
  swamp: { id: "swamp", label: "늪", field: ["enemy_lizardman_spear", "enemy_snake_viper", "enemy_wisp_blue"], midBoss: "enemy_ooze_acid", boss: "enemy_hydra_three", bossName: "늪의 히드라" },
  pyramid: { id: "pyramid", label: "피라미드", field: ["enemy_mummy_bandage", "enemy_scorpion_sand"], midBoss: "enemy_worm_sand", boss: "enemy_golem_crystal", bossName: "왕묘의 수호 거상" },
  ice: { id: "ice", label: "얼음", field: ["enemy_wolf_grey", "enemy_spirit_wind", "enemy_ghost_pale"], midBoss: "enemy_golem_crystal", boss: "enemy_dragon_blue", bossName: "빙굴의 푸른 용" },
  magic: { id: "magic", label: "마법탑", field: ["enemy_eye_floating", "enemy_sword_flying", "enemy_mage_rogue"], midBoss: "enemy_gargoyle_stone", boss: "enemy_lich_frost", bossName: "탑의 대마법사" },
  abyss: { id: "abyss", label: "마계", field: ["enemy_imp_mischief", "enemy_spirit_dark", "enemy_wraith_dark"], midBoss: "enemy_behemoth_horn", boss: "enemy_demon_lord", bossName: "마계의 군주" },
  castle: { id: "castle", label: "성", field: ["enemy_skeleton_knight", "enemy_armor_living", "enemy_gargoyle_stone"], midBoss: "enemy_knight_fallen", boss: "enemy_knight_fallen", bossName: "타락한 성주" },
  magitek: { id: "magitek", label: "마도 광산", field: ["enemy_golem_iron", "enemy_kobold_digger"], midBoss: "enemy_golem_iron", boss: "enemy_behemoth_horn", bossName: "광산 깊은 곳의 괴수" },
};

/** 이름 낱말이 종류보다 먼저다(「고블린 굴」은 cave 지만 고블린). */
const WORDS: readonly [RegExp, string][] = [
  [/고블린|goblin/i, "goblin"], [/오크|orc/i, "orc"], [/산적|도적|bandit/i, "bandit"], [/마왕|demon/i, "demon"],
  [/드래곤|용의|용 둥지|dragon/i, "dragon"], [/언데드|해골|망령|유령|좀비|묘지|무덤|납골|카타콤|undead|crypt|catacomb/i, "undead"],
  [/거미|spider/i, "cave"], [/미노|minotaur/i, "maze"],
];

export function dungeonTheme(args: Record<string, unknown>): Theme {
  const name = `${typeof args.name === "string" ? args.name : ""} ${typeof args.theme === "string" ? args.theme : ""} ${typeof args.inspiration === "string" ? args.inspiration : ""}`;
  for (const [re, id] of WORDS) if (re.test(name)) return THEMES[id]!;
  if (/ff\s*6|ff\s*vi|파판\s*6|마도|magitek/i.test(name) && args.type === "mine") return THEMES.magitek!;
  const type = typeof args.type === "string" ? args.type : "catacomb";
  if (args.lair === true) return THEMES.goblin!;
  if (args.flooded === true) return THEMES.water!;
  if (type === "tower") return THEMES.magic!;
  if (args.direction === "up" && Number(args.floors) > 1) return THEMES.tower!;
  if (type === "volcano") return THEMES.volcano!;
  if (type === "temple") return THEMES.temple!;
  if (type === "cave") return THEMES.cave!;
  if (type === "sewer") return THEMES.sewer!;
  if (type === "mine") return THEMES.mine!;
  if (type === "labyrinth") return THEMES.maze!;
  if (type === "forest") return THEMES.forest!;
  if (type === "swamp") return THEMES.swamp!;
  if (type === "pyramid") return THEMES.pyramid!;
  if (type === "ice") return THEMES.ice!;
  if (type === "tower") return THEMES.magic!;
  if (type === "otherworld") return THEMES.abyss!;
  if (type === "castle") return THEMES.castle!;
  return THEMES.undead!;
}

const strength = (project: Project, troopId: string | undefined): number => {
  const troop = project.database.troops.find((t) => t.id === troopId);
  return (troop?.members ?? []).reduce((sum, m) => {
    const e = project.database.enemies.find((x) => x.id === m.enemyId);
    return sum + (e?.stats?.maxHp ?? 0) + 4 * (e?.stats?.attack ?? 0);
  }, 0);
};

/**
 * 주제 적 그룹을 데이터베이스에 만들고 id 를 돌려준다. like = 같은 역할로 원래 고르던 그룹(세기 기준). 그림 원본 적이 없으면 undefined(원래 그룹을 쓴다).
 * 적 레코드는 원본을 복제해 능력치만 비례로 옮긴다(그림 monsterResourceId 는 그대로 — 필드 그림 = 전투 그림).
 */
export function ensureThemeTroop(project: Project, theme: Theme, role: Role, like: string | undefined, index = 0): string | undefined {
  const sourceId = role === "field" ? theme.field[index % theme.field.length]! : role === "midBoss" ? theme.midBoss : theme.boss;
  const source = project.database.enemies.find((e) => e.id === sourceId);
  if (!source) return undefined;
  const troopId = `troop_dg_${theme.id}_${role}${role === "field" ? index + 1 : ""}`;
  if (project.database.troops.some((t) => t.id === troopId)) return troopId;
  const target = strength(project, like);
  const own = (source.stats?.maxHp ?? 0) + 4 * (source.stats?.attack ?? 0);
  const k = target > 0 && own > 0 ? target / own : 1;
  const enemyId = `enemy_dg_${theme.id}_${role}${role === "field" ? index + 1 : ""}`;
  const name = role === "boss" ? theme.bossName ?? source.name : source.name;
  if (!project.database.enemies.some((e) => e.id === enemyId)) {
    const copy = structuredClone(source) as typeof source;
    (copy as { id: string }).id = enemyId;
    (copy as { name: string }).name = name;
    if (copy.stats) {
      const st = copy.stats as unknown as Record<string, number>;
      for (const key of ["maxHp", "attack", "defense", "mind", "agility", "luck"]) if (typeof st[key] === "number") st[key] = Math.max(1, Math.round(st[key]! * (key === "maxHp" ? k : Math.sqrt(k))));
    }
    project.database.enemies.push(copy);
  }
  const count = role === "field" ? Math.max(1, Math.min(3, project.database.troops.find((t) => t.id === like)?.members?.length ?? 1)) : 1;
  const members = Array.from({ length: count }, (_, i) => ({ enemyId, x: 72 + i * 36, y: 72 + (i % 2) * 36, hidden: false }));
  project.database.troops.push({
    id: troopId, name: role === "field" ? `${source.name} 무리` : name, enemyIds: members.map((m) => m.enemyId), members,
    autoAlign: true, uncapturable: false, previewBackgroundResourceId: "battle-scenery-forest", battleEventPages: [],
  } as unknown as Project["database"]["troops"][number]);
  // 같은 무리의 세기를 원래 그룹 합과 맞춘다(마리 수만큼 나눈다)
  if (count > 1) {
    const e = project.database.enemies.find((x) => x.id === enemyId)!;
    const st = e.stats as unknown as Record<string, number>;
    if (st && typeof st.maxHp === "number") st.maxHp = Math.max(1, Math.round(st.maxHp / count));
  }
  return troopId;
}
