// 도트 측면 전투(retro2003) 직업별 스킬 카탈로그 — **계약 파일**.
//
// 런타임(battleRetroMotion·retroSkillChoreography), 편집기 스킬 탭 미리보기, 도트 이펙트 생성기, 기본 DB 가 같은 목록을 본다.
// 여기 id·레이어 키·프레임 규격을 바꾸면 그림(public/assets/generated/pixel-fx/<key>.png)과 어긋난다 — 셋을 같이 고친다.
//
// 이펙트 시트 규격: 가로 스트립 frame×frames px × frame px, 알파 0/255, 시트당 ≤16색, 화면에는 2배.
//   anchor  user        시전자 몸 위(오라·충전·잔상)
//           target      대상 하나 위(착탄)
//           allTargets  대상 편 전원 위에 같은 시트를 각각(전체기)
//           allAllies   아군 전원 위(전체 회복·버프)
//           screen      무대 한가운데 128px 시트를 크게(필살기·광역 배경)
//           projectile  시전자 손 → 대상으로 날아가는 32px 루프 시트(첫 칸이 오른쪽→왼쪽 진행 방향을 본다)
// motion  dash-strike 대상 앞까지 파고들어 친다 · leap-strike 뛰어올라 내려찍는다 · blink-strike 사라졌다 나타나 친다
//         flurry 파고들어 연속 베기 · spin 적진 한가운데서 회전 · cast 제자리 시전 · shoot 제자리 활 · buff 제자리 강화
//         finisher 필살기(화면 어둡게 → 컷인 → 대형 연출)

export type RetroFxAnchor = "user" | "target" | "allTargets" | "allAllies" | "screen" | "projectile";
export type RetroSkillMotion = "dash-strike" | "leap-strike" | "blink-strike" | "flurry" | "spin" | "cast" | "shoot" | "buff" | "finisher";

export interface RetroFxLayer {
  readonly key: string;
  readonly anchor: RetroFxAnchor;
  readonly frame: 32 | 64 | 128;
  readonly frames: number;
}

export interface RetroClassSkill {
  readonly id: string;
  readonly classId: string;
  readonly actorId: string;
  readonly name: string;
  /** 배우는 레벨(직업 learnedSkills). */
  readonly level: number;
  readonly motion: RetroSkillMotion;
  readonly description: string;
  /** 재생 순서대로. 같은 key 는 한 장의 시트다. */
  readonly layers: readonly RetroFxLayer[];
}

export const RETRO_CLASS_SKILLS: readonly RetroClassSkill[] = [
  { id: "skill_hero_cross_slash", classId: "class_hero", actorId: "actor_hero", name: "십자베기", level: 1, motion: "dash-strike", description: "적에게 파고들어 X자로 두 번 벤다", layers: [{ key: "hero_cross", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_hero_rush_pierce", classId: "class_hero", actorId: "actor_hero", name: "돌진 찌르기", level: 3, motion: "dash-strike", description: "잔상을 끌며 일직선으로 꿰뚫는다", layers: [{ key: "hero_pierce", anchor: "target", frame: 64, frames: 8 }, { key: "hero_dust", anchor: "user", frame: 64, frames: 6 }] },
  { id: "skill_hero_rising_blade", classId: "class_hero", actorId: "actor_hero", name: "올려베기", level: 5, motion: "dash-strike", description: "아래에서 위로 베어 적을 띄운다", layers: [{ key: "hero_rising", anchor: "target", frame: 64, frames: 9 }] },
  { id: "skill_hero_flame_sword", classId: "class_hero", actorId: "actor_hero", name: "화염검", level: 7, motion: "dash-strike", description: "검에 불을 둘러 불꽃 궤적으로 벤다", layers: [{ key: "hero_flame_aura", anchor: "user", frame: 64, frames: 6 }, { key: "hero_flame_slash", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_hero_whirlwind", classId: "class_hero", actorId: "actor_hero", name: "회전베기", level: 10, motion: "spin", description: "적진 한가운데서 회전하며 모든 적을 벤다", layers: [{ key: "hero_whirl", anchor: "allTargets", frame: 64, frames: 10 }] },
  { id: "skill_hero_war_cry", classId: "class_hero", actorId: "actor_hero", name: "함성", level: 12, motion: "buff", description: "함성의 충격파로 아군 공격력을 올린다", layers: [{ key: "hero_warcry", anchor: "user", frame: 128, frames: 10 }] },
  { id: "skill_hero_meteor_drop", classId: "class_hero", actorId: "actor_hero", name: "낙하참", level: 16, motion: "leap-strike", description: "높이 뛰어올라 떨어지며 내려찍는다", layers: [{ key: "hero_meteor_trail", anchor: "projectile", frame: 32, frames: 4 }, { key: "hero_meteor_impact", anchor: "target", frame: 128, frames: 10 }] },
  { id: "skill_hero_brave_blade", classId: "class_hero", actorId: "actor_hero", name: "브레이브 블레이드", level: 22, motion: "finisher", description: "빛의 거대한 검을 내려꽂는 필살기", layers: [{ key: "hero_brave_sword", anchor: "screen", frame: 128, frames: 12 }, { key: "hero_brave_burst", anchor: "target", frame: 128, frames: 10 }] },
  { id: "skill_guard_shield_bash", classId: "class_guardian", actorId: "actor_guardian", name: "방패 치기", level: 1, motion: "dash-strike", description: "방패로 들이받아 적을 비틀거리게 한다", layers: [{ key: "guard_bash", anchor: "target", frame: 64, frames: 8 }] },
  { id: "skill_guard_taunt", classId: "class_guardian", actorId: "actor_guardian", name: "도발", level: 3, motion: "buff", description: "붉은 기세로 적의 시선을 끈다", layers: [{ key: "guard_taunt", anchor: "user", frame: 64, frames: 8 }] },
  { id: "skill_guard_iron_wall", classId: "class_guardian", actorId: "actor_guardian", name: "철벽", level: 5, motion: "buff", description: "아군 전체를 감싸는 방어막을 친다", layers: [{ key: "guard_barrier", anchor: "allAllies", frame: 64, frames: 10 }] },
  { id: "skill_guard_counter", classId: "class_guardian", actorId: "actor_guardian", name: "반격 태세", level: 7, motion: "buff", description: "검을 세우고 반격 자세를 취한다", layers: [{ key: "guard_counter", anchor: "user", frame: 64, frames: 8 }] },
  { id: "skill_guard_charge", classId: "class_guardian", actorId: "actor_guardian", name: "돌격", level: 10, motion: "dash-strike", description: "방패를 앞세워 돌진해 밀쳐낸다", layers: [{ key: "guard_charge", anchor: "target", frame: 64, frames: 8 }, { key: "hero_dust", anchor: "user", frame: 64, frames: 6 }] },
  { id: "skill_guard_holy_shield", classId: "class_guardian", actorId: "actor_guardian", name: "성스러운 방패", level: 12, motion: "cast", description: "빛의 방패로 아군 하나를 지키고 치유한다", layers: [{ key: "guard_holy_shield", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_guard_quake", classId: "class_guardian", actorId: "actor_guardian", name: "지진 내려찍기", level: 16, motion: "leap-strike", description: "땅을 내려찍어 모든 적에게 충격파를 보낸다", layers: [{ key: "guard_quake", anchor: "allTargets", frame: 64, frames: 10 }, { key: "guard_quake_ring", anchor: "screen", frame: 128, frames: 8 }] },
  { id: "skill_guard_fortress", classId: "class_guardian", actorId: "actor_guardian", name: "요새", level: 22, motion: "finisher", description: "거대한 방패벽을 세워 적을 짓누르는 필살기", layers: [{ key: "guard_fortress_wall", anchor: "screen", frame: 128, frames: 12 }, { key: "guard_fortress_slam", anchor: "allTargets", frame: 64, frames: 8 }] },
  { id: "skill_mage_fireball", classId: "class_mage", actorId: "actor_mage", name: "파이어볼", level: 1, motion: "cast", description: "지팡이 끝에서 불덩이를 쏘아 터뜨린다", layers: [{ key: "mage_fireball_orb", anchor: "projectile", frame: 32, frames: 4 }, { key: "mage_fire_burst", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_mage_magic_missile", classId: "class_mage", actorId: "actor_mage", name: "매직 미사일", level: 3, motion: "cast", description: "빛의 탄 세 발이 곡선을 그리며 날아간다", layers: [{ key: "mage_missile_orb", anchor: "projectile", frame: 32, frames: 4 }, { key: "mage_missile_hit", anchor: "target", frame: 64, frames: 8 }] },
  { id: "skill_mage_blizzard", classId: "class_mage", actorId: "actor_mage", name: "블리자드", level: 5, motion: "cast", description: "모든 적 위에 눈보라와 얼음 기둥을 내린다", layers: [{ key: "mage_blizzard", anchor: "allTargets", frame: 64, frames: 10 }, { key: "mage_snow", anchor: "screen", frame: 128, frames: 8 }] },
  { id: "skill_mage_chain_lightning", classId: "class_mage", actorId: "actor_mage", name: "연쇄 번개", level: 7, motion: "cast", description: "번개가 적에서 적으로 튀어 나간다", layers: [{ key: "mage_chain_bolt", anchor: "allTargets", frame: 64, frames: 8 }] },
  { id: "skill_mage_gravity", classId: "class_mage", actorId: "actor_mage", name: "그라비티", level: 10, motion: "cast", description: "검은 중력구로 적을 짓눌러 오그라뜨린다", layers: [{ key: "mage_gravity", anchor: "target", frame: 64, frames: 12 }] },
  { id: "skill_mage_mana_shield", classId: "class_mage", actorId: "actor_mage", name: "마나 실드", level: 12, motion: "buff", description: "푸른 마법진 방벽을 두른다", layers: [{ key: "mage_mana_shield", anchor: "user", frame: 64, frames: 10 }] },
  { id: "skill_mage_meteor", classId: "class_mage", actorId: "actor_mage", name: "메테오", level: 16, motion: "cast", description: "하늘에서 불타는 운석을 모든 적에게 떨어뜨린다", layers: [{ key: "mage_meteor_rock", anchor: "projectile", frame: 32, frames: 4 }, { key: "mage_meteor_blast", anchor: "allTargets", frame: 64, frames: 10 }] },
  { id: "skill_mage_starfall", classId: "class_mage", actorId: "actor_mage", name: "별빛 폭풍", level: 22, motion: "finisher", description: "밤하늘을 열어 별을 쏟아붓는 필살기", layers: [{ key: "mage_starfall_sky", anchor: "screen", frame: 128, frames: 12 }, { key: "mage_star_hit", anchor: "allTargets", frame: 64, frames: 8 }] },
  { id: "skill_scout_twin_strike", classId: "class_scout", actorId: "actor_scout", name: "쌍검 난무", level: 1, motion: "flurry", description: "눈에 보이지 않는 속도로 네 번 벤다", layers: [{ key: "scout_flurry", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_scout_venom_blade", classId: "class_scout", actorId: "actor_scout", name: "맹독 칼날", level: 3, motion: "dash-strike", description: "독을 바른 칼날로 찔러 중독시킨다", layers: [{ key: "scout_venom", anchor: "target", frame: 64, frames: 8 }] },
  { id: "skill_scout_shadow_step", classId: "class_scout", actorId: "actor_scout", name: "그림자 습격", level: 5, motion: "blink-strike", description: "그림자로 사라졌다가 적의 등 뒤에서 찌른다", layers: [{ key: "scout_shadow_puff", anchor: "user", frame: 64, frames: 6 }, { key: "scout_backstab", anchor: "target", frame: 64, frames: 8 }] },
  { id: "skill_scout_smoke_bomb", classId: "class_scout", actorId: "actor_scout", name: "연막탄", level: 7, motion: "cast", description: "연막탄을 던져 모든 적의 눈을 가린다", layers: [{ key: "scout_bomb", anchor: "projectile", frame: 32, frames: 4 }, { key: "scout_smoke", anchor: "allTargets", frame: 64, frames: 10 }] },
  { id: "skill_scout_steal", classId: "class_scout", actorId: "actor_scout", name: "훔치기", level: 10, motion: "blink-strike", description: "순식간에 파고들어 물건을 낚아챈다", layers: [{ key: "scout_steal", anchor: "target", frame: 64, frames: 8 }] },
  { id: "skill_scout_evasion", classId: "class_scout", actorId: "actor_scout", name: "잔상 회피", level: 12, motion: "buff", description: "잔상을 남기며 회피 태세에 들어간다", layers: [{ key: "scout_afterimage", anchor: "user", frame: 64, frames: 8 }] },
  { id: "skill_scout_knife_storm", classId: "class_scout", actorId: "actor_scout", name: "비수 폭풍", level: 16, motion: "cast", description: "수십 자루의 비수를 모든 적에게 쏟아붓는다", layers: [{ key: "scout_knife", anchor: "projectile", frame: 32, frames: 4 }, { key: "scout_knife_hit", anchor: "allTargets", frame: 64, frames: 8 }] },
  { id: "skill_scout_assassinate", classId: "class_scout", actorId: "actor_scout", name: "암살", level: 22, motion: "finisher", description: "화면을 가르는 일섬으로 적을 베는 필살기", layers: [{ key: "scout_assassin_cut", anchor: "screen", frame: 128, frames: 12 }, { key: "scout_assassin_hit", anchor: "target", frame: 64, frames: 8 }] },
  { id: "skill_cleric_heal_light", classId: "class_cleric", actorId: "actor_cleric", name: "치유의 빛", level: 1, motion: "cast", description: "아군 하나에게 부드러운 빛을 내려 치유한다", layers: [{ key: "cleric_heal", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_cleric_holy_smite", classId: "class_cleric", actorId: "actor_cleric", name: "심판의 빛", level: 3, motion: "cast", description: "적 위에 빛기둥을 내리꽂는다", layers: [{ key: "cleric_smite", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_cleric_purify", classId: "class_cleric", actorId: "actor_cleric", name: "정화", level: 5, motion: "cast", description: "빛의 고리로 아군의 상태이상을 씻어낸다", layers: [{ key: "cleric_purify", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_cleric_blessing", classId: "class_cleric", actorId: "actor_cleric", name: "축복", level: 7, motion: "buff", description: "깃털이 내리며 아군 전체의 힘을 북돋는다", layers: [{ key: "cleric_blessing", anchor: "allAllies", frame: 64, frames: 10 }] },
  { id: "skill_cleric_mass_heal", classId: "class_cleric", actorId: "actor_cleric", name: "대치유", level: 10, motion: "cast", description: "아군 전체에게 치유의 빛을 쏟는다", layers: [{ key: "cleric_mass_heal", anchor: "allAllies", frame: 64, frames: 10 }, { key: "cleric_halo", anchor: "screen", frame: 128, frames: 8 }] },
  { id: "skill_cleric_sanctuary", classId: "class_cleric", actorId: "actor_cleric", name: "성역", level: 12, motion: "cast", description: "발밑에 성역의 문양을 그려 아군을 감싼다", layers: [{ key: "cleric_sanctuary", anchor: "allAllies", frame: 64, frames: 10 }] },
  { id: "skill_cleric_revive", classId: "class_cleric", actorId: "actor_cleric", name: "부활", level: 16, motion: "cast", description: "천사의 날개가 쓰러진 아군을 일으킨다", layers: [{ key: "cleric_revive", anchor: "target", frame: 64, frames: 12 }] },
  { id: "skill_cleric_divine_judgment", classId: "class_cleric", actorId: "actor_cleric", name: "신의 심판", level: 22, motion: "finisher", description: "하늘에서 거대한 성십자를 내리는 필살기", layers: [{ key: "cleric_judgment_cross", anchor: "screen", frame: 128, frames: 12 }, { key: "cleric_judgment_hit", anchor: "allTargets", frame: 64, frames: 8 }] },
  { id: "skill_ranger_power_shot", classId: "class_ranger", actorId: "actor_ranger", name: "강사", level: 1, motion: "shoot", description: "시위를 끝까지 당겨 힘을 모은 화살을 쏜다", layers: [{ key: "ranger_arrow", anchor: "projectile", frame: 32, frames: 4 }, { key: "ranger_power_hit", anchor: "target", frame: 64, frames: 8 }, { key: "ranger_charge", anchor: "user", frame: 64, frames: 6 }] },
  { id: "skill_ranger_multi_shot", classId: "class_ranger", actorId: "actor_ranger", name: "연사", level: 3, motion: "shoot", description: "화살 세 발을 연달아 쏜다", layers: [{ key: "ranger_arrow", anchor: "projectile", frame: 32, frames: 4 }, { key: "ranger_arrow_hit", anchor: "target", frame: 64, frames: 6 }] },
  { id: "skill_ranger_fire_arrow", classId: "class_ranger", actorId: "actor_ranger", name: "화염 화살", level: 5, motion: "shoot", description: "불붙은 화살로 적을 태운다", layers: [{ key: "ranger_fire_arrow", anchor: "projectile", frame: 32, frames: 4 }, { key: "ranger_fire_hit", anchor: "target", frame: 64, frames: 8 }] },
  { id: "skill_ranger_frost_arrow", classId: "class_ranger", actorId: "actor_ranger", name: "빙결 화살", level: 7, motion: "shoot", description: "얼음 화살이 박혀 적을 얼린다", layers: [{ key: "ranger_frost_arrow", anchor: "projectile", frame: 32, frames: 4 }, { key: "ranger_frost_hit", anchor: "target", frame: 64, frames: 8 }] },
  { id: "skill_ranger_arrow_rain", classId: "class_ranger", actorId: "actor_ranger", name: "화살비", level: 10, motion: "shoot", description: "하늘로 쏜 화살이 모든 적 위로 쏟아진다", layers: [{ key: "ranger_arrow_rain", anchor: "allTargets", frame: 64, frames: 10 }] },
  { id: "skill_ranger_snipe", classId: "class_ranger", actorId: "actor_ranger", name: "저격", level: 12, motion: "shoot", description: "조준경을 맞춘 뒤 급소를 꿰뚫는다", layers: [{ key: "ranger_scope", anchor: "target", frame: 64, frames: 8 }, { key: "ranger_arrow", anchor: "projectile", frame: 32, frames: 4 }, { key: "ranger_power_hit", anchor: "target", frame: 64, frames: 8 }] },
  { id: "skill_ranger_nature_call", classId: "class_ranger", actorId: "actor_ranger", name: "자연의 부름", level: 16, motion: "cast", description: "나뭇잎 바람이 아군 전체를 회복시킨다", layers: [{ key: "ranger_leaves", anchor: "allAllies", frame: 64, frames: 10 }] },
  { id: "skill_ranger_storm_arrow", classId: "class_ranger", actorId: "actor_ranger", name: "폭풍의 화살", level: 22, motion: "finisher", description: "번개를 두른 거대한 화살로 적진을 관통하는 필살기", layers: [{ key: "ranger_storm_charge", anchor: "user", frame: 64, frames: 8 }, { key: "ranger_storm_bolt", anchor: "screen", frame: 128, frames: 12 }, { key: "ranger_storm_hit", anchor: "allTargets", frame: 64, frames: 8 }] },
];

/** 모든 레이어 시트(키 중복 제거). 생성기·프리로드·검증이 쓴다. */
export const RETRO_FX_SHEETS: readonly RetroFxLayer[] = [...new Map(RETRO_CLASS_SKILLS.flatMap((skill) => skill.layers).map((layer) => [layer.key, layer])).values()];

export function retroClassSkill(id: string | undefined): RetroClassSkill | undefined {
  return id ? RETRO_CLASS_SKILLS.find((skill) => skill.id === id) : undefined;
}
