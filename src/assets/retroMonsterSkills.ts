// 도트 측면 전투(retro2003) 몬스터 스킬 — **계약 파일** (2026-09-28).
//
// 사용자 요구: 「몬스터들도 고위급으로 갈수록 다양한 스킬을 구사하게」. 도트 시트가 있는 40종(pixelEnemySheets.ts)이
// 레벨대가 오를수록 더 많은 전용 스킬을 쓴다: Lv1~9 1개 · Lv10~19 2개 · Lv20~29 2~3개 · Lv30~39 3~4개 · 보스(Lv40+·최종 보스) 4~5개.
// 이펙트 그림(public/assets/generated/pixel-fx/<key>.png), 런타임 재생, 기본 DB(스킬 레코드·적 행동), 편집기 미리보기가 이 목록을 본다.
// 여기 id·레이어 키·프레임 규격을 바꾸면 그림과 어긋난다 — 같이 고친다.
//
// 레이어 규격은 직업 스킬 계약(retroClassSkills.ts 머리 주석)과 같다: 가로 스트립 frame×frames × frame, 알파 0/255, ≤16색, 화면 2배
// (128px target 층은 1배). 단 **적이 왼쪽, 아군이 오른쪽**이므로 방향이 반대다:
//   anchor  user        시전 몬스터 몸 위(충전·오라)          target      아군 하나 위(착탄)
//           allTargets  아군 전원 위에 각각                   allAllies   몬스터 편 전원 위(함성 같은 강화)
//           screen      무대 한가운데 128px 시트를 크게        projectile  몬스터 → 아군으로 **왼쪽→오른쪽** 날아가는 32px 루프(첫 칸이 오른쪽을 본다)
// motion (몬스터 시트 9칸 windup·move·attack·recover 를 쓴다)
//   lunge    대상 아군 앞까지 파고들어 attack 칸으로 친다(통상 공격보다 빠르고 세게)
//   shoot    제자리 windup → attack 칸에서 투사체 발사
//   cast     제자리 windup 을 길게(충전) → attack 칸에서 대상/전체에 이펙트
//   breath   제자리 attack 칸을 길게 유지하며 화면·전체 이펙트(브레스·독구름)
//   stomp    windup → attack 칸 내려찍기, 무대 흔들림 + 전체 착탄
//   buff     windup 칸으로 기합, 자기/아군 몬스터 편 위 이펙트
//   finisher 보스 필살기: 화면 어둡게 → 긴 windup(오라) → attack → 화면 층 + 전체 착탄 + 섬광·흔들림
import type { RetroFxLayer } from "@/assets/retroClassSkills";

export type RetroMonsterSkillMotion = "lunge" | "shoot" | "cast" | "breath" | "stomp" | "buff" | "finisher";

export interface RetroMonsterSkill {
  /** 스킬 레코드 id(skill_mon_<key>). */
  readonly id: string;
  readonly name: string;
  readonly motion: RetroMonsterSkillMotion;
  readonly description: string;
  /** 효과 방향 힌트(규칙 필드는 기본 DB 레코드가 정본). */
  readonly effect: "damage" | "damageAll" | "debuff" | "debuffAll" | "buffSelf" | "buffAllies";
  readonly element?: "fire" | "ice" | "thunder" | "water" | "earth" | "wind" | "holy" | "dark";
  readonly layers: readonly RetroFxLayer[];
}

const L = (key: string, anchor: RetroFxLayer["anchor"], frame: RetroFxLayer["frame"], frames: number): RetroFxLayer => ({ key, anchor, frame, frames });

export const RETRO_MONSTER_SKILLS: readonly RetroMonsterSkill[] = [
  // ── 짐승·곤충 ──
  { id: "skill_mon_acid_spit", name: "산성 침", motion: "shoot", effect: "debuff", description: "끈적한 산성 덩어리를 뱉어 독을 옮긴다", layers: [L("mon_acid_blob", "projectile", 32, 4), L("mon_acid_splash", "target", 64, 8)] },
  { id: "skill_mon_body_slam", name: "몸통 박치기", motion: "lunge", effect: "damage", description: "온몸을 던져 들이받는다", layers: [L("mon_slam_hit", "target", 64, 8)] },
  { id: "skill_mon_blood_suck", name: "흡혈", motion: "lunge", effect: "damage", element: "dark", description: "송곳니를 박아 피를 빨아들인다", layers: [L("mon_drain", "target", 64, 10)] },
  { id: "skill_mon_sonic_screech", name: "초음파", motion: "cast", effect: "debuffAll", description: "귀를 찢는 초음파로 아군 전체를 재운다", layers: [L("mon_screech_ring", "allTargets", 64, 8)] },
  { id: "skill_mon_poison_sting", name: "독침", motion: "lunge", effect: "debuff", description: "독침을 깊숙이 찔러 넣는다", layers: [L("mon_sting", "target", 64, 8)] },
  { id: "skill_mon_web_shot", name: "거미줄", motion: "shoot", effect: "debuff", description: "끈끈한 거미줄을 쏘아 발을 묶는다", layers: [L("mon_web_ball", "projectile", 32, 4), L("mon_web_net", "target", 64, 8)] },
  { id: "skill_mon_cross_scythe", name: "교차 낫베기", motion: "lunge", effect: "damage", description: "낫 같은 앞다리로 X자로 벤다", layers: [L("mon_scythe_x", "target", 64, 10)] },
  { id: "skill_mon_howl", name: "포효", motion: "buff", effect: "buffAllies", description: "울부짖어 무리의 공격력을 올린다", layers: [L("mon_howl_ring", "allAllies", 64, 8)] },
  { id: "skill_mon_tusk_charge", name: "돌진", motion: "lunge", effect: "damage", description: "흙먼지를 일으키며 엄니·뿔로 들이받는다", layers: [L("mon_charge_dust", "user", 64, 6), L("mon_tusk_hit", "target", 64, 8)] },
  { id: "skill_mon_savage_maul", name: "할퀴기", motion: "lunge", effect: "damage", description: "발톱으로 세 줄을 긁어 찢는다", layers: [L("mon_claw_rake", "target", 64, 8)] },
  { id: "skill_mon_venom_fang", name: "맹독 이빨", motion: "lunge", effect: "debuff", description: "튀어올라 물어 맹독을 흘려 넣는다", layers: [L("mon_fang_bite", "target", 64, 8)] },
  { id: "skill_mon_shell_guard", name: "단단해지기", motion: "buff", effect: "buffSelf", description: "껍질·갑옷을 굳혀 방어를 올린다", layers: [L("mon_shell_barrier", "user", 64, 8)] },
  { id: "skill_mon_hellfire_fang", name: "지옥불 이빨", motion: "lunge", effect: "damage", element: "fire", description: "불타는 이빨로 물어뜯는다", layers: [L("mon_hellfire_bite", "target", 64, 10)] },
  // ── 언데드·마법 ──
  { id: "skill_mon_bone_curse", name: "해골의 저주", motion: "cast", effect: "debuff", element: "dark", description: "해골 문양을 새겨 힘을 빼앗는다", layers: [L("mon_curse_skull", "target", 64, 10)] },
  { id: "skill_mon_arrow_volley", name: "뼈화살 난사", motion: "shoot", effect: "damageAll", description: "뼈화살을 연달아 쏘아 아군 전체를 꿰뚫는다", layers: [L("mon_bone_arrow", "projectile", 32, 4), L("mon_arrow_hit", "allTargets", 64, 8)] },
  { id: "skill_mon_rot_breath", name: "썩은 숨결", motion: "breath", effect: "debuffAll", element: "dark", description: "썩은 독구름을 내뿜는다", layers: [L("mon_rot_cloud", "allTargets", 64, 10)] },
  { id: "skill_mon_banshee_wail", name: "통곡", motion: "cast", effect: "debuffAll", description: "소름 끼치는 울음으로 아군 전체의 입을 막는다", layers: [L("mon_wail_sky", "screen", 128, 8)] },
  { id: "skill_mon_frost_orb", name: "얼음 구체", motion: "shoot", effect: "damage", element: "ice", description: "냉기 구체를 쏘아 얼린다", layers: [L("mon_frost_orb", "projectile", 32, 4), L("mon_frost_burst", "target", 64, 8)] },
  { id: "skill_mon_frost_nova", name: "서리 폭풍", motion: "cast", effect: "damageAll", element: "ice", description: "눈보라를 불러 아군 전체를 얼린다", layers: [L("mon_blizzard_sky", "screen", 128, 10), L("mon_frost_burst", "allTargets", 64, 8)] },
  { id: "skill_mon_bandage_bind", name: "붕대 속박", motion: "cast", effect: "debuff", description: "붕대를 뻗어 칭칭 감아 묶는다", layers: [L("mon_bandage_wrap", "target", 64, 10)] },
  { id: "skill_mon_flame_burst", name: "화염 폭발", motion: "cast", effect: "damageAll", element: "fire", description: "발밑에서 불기둥을 솟구치게 한다", layers: [L("mon_flame_pillar", "allTargets", 64, 10)] },
  { id: "skill_mon_tidal_wave", name: "해일", motion: "cast", effect: "damageAll", element: "water", description: "거대한 파도로 쓸어버린다", layers: [L("mon_wave_screen", "screen", 128, 10)] },
  { id: "skill_mon_vine_whip", name: "덩굴 채찍", motion: "cast", effect: "damage", description: "가시 덩굴을 뻗어 후려친다", layers: [L("mon_vine_lash", "target", 64, 10)] },
  { id: "skill_mon_spore_cloud", name: "수면 포자", motion: "breath", effect: "debuffAll", description: "달콤한 포자를 뿌려 잠재운다", layers: [L("mon_spore_cloud", "allTargets", 64, 10)] },
  // ── 인간형·거구·보스 ──
  { id: "skill_mon_quake_stomp", name: "대지 강타", motion: "stomp", effect: "damageAll", element: "earth", description: "땅을 내려찍어 균열을 일으킨다", layers: [L("mon_quake_crack", "allTargets", 64, 10)] },
  { id: "skill_mon_axe_cleave", name: "쪼개기", motion: "lunge", effect: "damage", description: "무기를 크게 휘둘러 내려 쪼갠다", layers: [L("mon_cleave_arc", "target", 64, 10)] },
  { id: "skill_mon_mimic_devour", name: "통째로 삼키기", motion: "lunge", effect: "damage", description: "거대한 입을 벌려 통째로 문다", layers: [L("mon_devour_jaws", "target", 64, 10)] },
  { id: "skill_mon_eye_beam", name: "마안 광선", motion: "shoot", effect: "debuff", description: "눈에서 광선을 쏘아 몸을 굳힌다", layers: [L("mon_eye_ray", "projectile", 32, 4), L("mon_ray_hit", "target", 64, 8)] },
  { id: "skill_mon_evil_eye", name: "사안", motion: "cast", effect: "debuffAll", element: "dark", description: "무대를 뒤덮는 눈동자로 모두의 힘을 빼앗는다", layers: [L("mon_gaze_screen", "screen", 128, 8)] },
  { id: "skill_mon_hex_fire", name: "저주의 불꽃", motion: "cast", effect: "damageAll", element: "dark", description: "녹색 저주 불꽃을 아군 전체에 지핀다", layers: [L("mon_hex_flame", "allTargets", 64, 10)] },
  { id: "skill_mon_smoke_bomb", name: "연막탄", motion: "shoot", effect: "debuffAll", description: "연막탄을 던져 시야를 가린다", layers: [L("mon_smoke_bomb", "projectile", 32, 4), L("mon_smoke_cloud", "allTargets", 64, 8)] },
  { id: "skill_mon_backstab", name: "기습", motion: "lunge", effect: "damage", description: "순식간에 파고들어 급소를 찌른다", layers: [L("mon_backstab_slash", "target", 64, 8)] },
  { id: "skill_mon_spear_thrust", name: "관통 찌르기", motion: "lunge", effect: "damage", description: "창을 일직선으로 꿰찌른다", layers: [L("mon_spear_pierce", "target", 64, 8)] },
  { id: "skill_mon_gale_wing", name: "날개 돌풍", motion: "cast", effect: "damageAll", element: "wind", description: "날개를 쳐 칼바람을 일으킨다", layers: [L("mon_gale_screen", "screen", 128, 8)] },
  { id: "skill_mon_boulder_throw", name: "바위 던지기", motion: "shoot", effect: "damage", element: "earth", description: "커다란 바위를 집어 던진다", layers: [L("mon_boulder", "projectile", 32, 4), L("mon_rock_burst", "target", 64, 8)] },
  { id: "skill_mon_maze_rampage", name: "미궁의 광란", motion: "finisher", effect: "damageAll", description: "미궁의 주인이 광분해 모두를 짓밟는다", layers: [L("mon_rampage_screen", "screen", 128, 10), L("mon_cleave_arc", "allTargets", 64, 10)] },
  { id: "skill_mon_fire_breath", name: "화염 브레스", motion: "breath", effect: "damageAll", element: "fire", description: "무대를 불바다로 만드는 불길을 뿜는다", layers: [L("mon_fire_breath", "screen", 128, 10), L("mon_burn", "allTargets", 64, 8)] },
  { id: "skill_mon_dragon_roar", name: "용의 포효", motion: "buff", effect: "buffSelf", description: "대기를 뒤흔드는 포효로 힘을 끌어올린다", layers: [L("mon_roar_ring", "user", 64, 8)] },
  { id: "skill_mon_dark_flame", name: "암흑 화염", motion: "breath", effect: "damageAll", element: "dark", description: "보라 암흑 불꽃을 뿜어 모두를 태운다", layers: [L("mon_dark_flame", "screen", 128, 10), L("mon_dark_burn", "allTargets", 64, 8)] },
  { id: "skill_mon_dark_meteor", name: "암흑 운석", motion: "cast", effect: "damageAll", element: "dark", description: "하늘에서 검은 운석을 떨어뜨린다", layers: [L("mon_dark_meteor", "projectile", 32, 4), L("mon_dark_crater", "allTargets", 64, 10)] },
  { id: "skill_mon_demon_aura", name: "마왕의 기운", motion: "buff", effect: "buffSelf", description: "몸에서 암흑 기운을 뿜어 힘을 올린다", layers: [L("mon_demon_aura", "user", 64, 8)] },
  { id: "skill_mon_dark_judgment", name: "암흑의 심판", motion: "finisher", effect: "damageAll", element: "dark", description: "세계를 어둠으로 덮고 심판을 내리는 마왕의 필살기", layers: [L("mon_judgment_sky", "screen", 128, 12), L("mon_dark_burn", "allTargets", 64, 8)] },
];

/**
 * 도트 시트 slug(pixel-enemies/<slug>.png) → 쓰는 스킬(레벨대가 오를수록 많다). 적 레코드는 monsterResourceId 가
 * 이 시트를 가리키면(PIXEL_ENEMY_SHEETS 경로 기준) 이 목록을 행동으로 받는다. 순서는 정체성이 강한 것부터.
 */
export const RETRO_MONSTER_SKILLSETS: Readonly<Record<string, readonly string[]>> = {
  "slime": ["skill_mon_acid_spit"],
  "slime-red": ["skill_mon_acid_spit", "skill_mon_body_slam"],
  "bat": ["skill_mon_blood_suck"],
  "bat-vampire": ["skill_mon_blood_suck", "skill_mon_sonic_screech"],
  "bee-giant": ["skill_mon_poison_sting"],
  "spider-cave": ["skill_mon_web_shot", "skill_mon_poison_sting"],
  "scorpion-sand": ["skill_mon_poison_sting"],
  "mantis-blade": ["skill_mon_cross_scythe"],
  "wolf-grey": ["skill_mon_savage_maul", "skill_mon_howl"],
  "boar-tusk": ["skill_mon_tusk_charge"],
  "bear-brown": ["skill_mon_savage_maul", "skill_mon_quake_stomp"],
  "snake-viper": ["skill_mon_venom_fang"],
  "crab-rock": ["skill_mon_shell_guard", "skill_mon_body_slam"],
  "hound-hell": ["skill_mon_hellfire_fang", "skill_mon_howl"],
  "skeleton-archer": ["skill_mon_arrow_volley", "skill_mon_bone_curse"],
  "skeleton-knight": ["skill_mon_bone_curse", "skill_mon_axe_cleave", "skill_mon_shell_guard"],
  "zombie-rot": ["skill_mon_rot_breath", "skill_mon_body_slam"],
  "ghost-pale": ["skill_mon_banshee_wail", "skill_mon_blood_suck"],
  "lich-frost": ["skill_mon_frost_orb", "skill_mon_frost_nova", "skill_mon_bone_curse"],
  "mummy-bandage": ["skill_mon_bandage_bind", "skill_mon_rot_breath"],
  "spirit-fire": ["skill_mon_flame_burst", "skill_mon_hellfire_fang"],
  "spirit-water": ["skill_mon_tidal_wave", "skill_mon_frost_orb"],
  "wisp-blue": ["skill_mon_frost_orb", "skill_mon_banshee_wail", "skill_mon_frost_nova"],
  "golem": ["skill_mon_quake_stomp", "skill_mon_boulder_throw", "skill_mon_shell_guard"],
  "golem-iron": ["skill_mon_quake_stomp", "skill_mon_shell_guard", "skill_mon_body_slam"],
  "armor-living": ["skill_mon_axe_cleave", "skill_mon_shell_guard", "skill_mon_bone_curse"],
  "mimic-chest": ["skill_mon_mimic_devour", "skill_mon_body_slam", "skill_mon_shell_guard"],
  "goblin-scout": ["skill_mon_backstab", "skill_mon_smoke_bomb", "skill_mon_poison_sting"],
  "orc-warrior": ["skill_mon_axe_cleave", "skill_mon_howl", "skill_mon_quake_stomp"],
  "orc-shaman": ["skill_mon_hex_fire", "skill_mon_bone_curse", "skill_mon_howl"],
  "bandit-mask": ["skill_mon_backstab", "skill_mon_smoke_bomb", "skill_mon_venom_fang"],
  "lizardman-spear": ["skill_mon_spear_thrust", "skill_mon_venom_fang", "skill_mon_shell_guard"],
  "harpy-cliff": ["skill_mon_gale_wing", "skill_mon_sonic_screech", "skill_mon_savage_maul"],
  "minotaur-maze": ["skill_mon_axe_cleave", "skill_mon_tusk_charge", "skill_mon_quake_stomp", "skill_mon_maze_rampage"],
  "troll-cave": ["skill_mon_boulder_throw", "skill_mon_quake_stomp", "skill_mon_howl", "skill_mon_savage_maul"],
  "gargoyle-stone": ["skill_mon_gale_wing", "skill_mon_savage_maul", "skill_mon_shell_guard", "skill_mon_boulder_throw"],
  "dragon": ["skill_mon_fire_breath", "skill_mon_dragon_roar", "skill_mon_savage_maul", "skill_mon_quake_stomp"],
  "eye-floating": ["skill_mon_eye_beam", "skill_mon_evil_eye", "skill_mon_frost_nova", "skill_mon_bone_curse"],
  "plant-carnivore": ["skill_mon_vine_whip", "skill_mon_spore_cloud", "skill_mon_acid_spit", "skill_mon_venom_fang"],
  "demon-lord": ["skill_mon_dark_flame", "skill_mon_dark_meteor", "skill_mon_demon_aura", "skill_mon_bone_curse", "skill_mon_dark_judgment"],
};

/** 모든 몬스터 스킬 레이어 시트(키 중복 제거). */
export const RETRO_MONSTER_FX_SHEETS: readonly RetroFxLayer[] = [...new Map(RETRO_MONSTER_SKILLS.flatMap((skill) => skill.layers).map((layer) => [layer.key, layer])).values()];

export function retroMonsterSkill(id: string | undefined): RetroMonsterSkill | undefined {
  return id ? RETRO_MONSTER_SKILLS.find((skill) => skill.id === id) : undefined;
}

