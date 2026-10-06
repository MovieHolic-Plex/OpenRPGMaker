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

import type { RetroSkillMechanic } from "./retroSkillMechanics";

export type RetroFxAnchor = "user" | "target" | "allTargets" | "allAllies" | "screen" | "projectile";
export type RetroSkillMotion = "dash-strike" | "leap-strike" | "blink-strike" | "flurry" | "spin" | "cast" | "shoot" | "buff" | "finisher";

export interface RetroFxLayer {
  readonly key: string;
  readonly anchor: RetroFxAnchor;
  readonly frame: 32 | 64 | 128;
  readonly frames: number;
  // 아래는 프로젝트 연출 레코드(SkillChoreographyRecord)에서만 온다. 기본 계약 데이터에는 없다(없음 = 기존 타임라인 그대로).
  /** 층 시작 시각(ms). 없으면 타임라인이 정하는 시각. */
  readonly startMs?: number;
  /** 그림 배율(기본 1). */
  readonly scale?: number;
  /** 같은 층을 이어서 재생하는 횟수(기본 1). */
  readonly repeat?: number;
  /** each: 다단 스킬이면 타수마다 이 착탄 층을 다시 깐다. */
  readonly onHit?: "first" | "each";
  readonly tint?: string;
  /** 층이 시작될 때 울리는 효과음 id. */
  readonly se?: string;
  /** Authored exposure per cel; omitted layers keep the original fixed interval. */
  readonly frameDurationsMs?: readonly number[];
  /** Background and orbiting rear cels use the same battle clock as the front cels. */
  readonly plane?: "backdrop" | "behind";
  readonly opacity?: number;
  /** Ambient layers do not cause a hit or contribute a damage contact time. */
  readonly ambient?: boolean;
  readonly contactFrame?: number;
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
  /** 기믹 칸(다단·범위·수식·대가·흡수·상태…). 있으면 기본 DB 레코드가 설명 낱말 유도보다 이 칸을 우선한다. 어휘·규칙은 retroSkillMechanics.ts. */
  readonly mechanic?: RetroSkillMechanic;
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
  { id: "skill_mage_fireball", classId: "class_mage", actorId: "actor_mage", name: "파이어볼", level: 1, motion: "cast", description: "불덩이가 닿은 자리에서 긴 불기둥이 솟고 갈라져 떨어진다", layers: [{ key: "mage_fireball_orb", anchor: "projectile", frame: 32, frames: 4 }, { key: "mage_fire_burst", anchor: "target", frame: 64, frames: 8, frameDurationsMs: [40,60,100,70,60,60,100,50], contactFrame: 2 }] },
  { id: "skill_mage_magic_missile", classId: "class_mage", actorId: "actor_mage", name: "매직 미사일", level: 3, motion: "cast", description: "빛의 탄 세 발이 곡선을 그리며 날아간다", layers: [{ key: "mage_missile_orb", anchor: "projectile", frame: 32, frames: 4 }, { key: "mage_missile_hit", anchor: "target", frame: 64, frames: 8 }] },
  { id: "skill_mage_blizzard", classId: "class_mage", actorId: "actor_mage", name: "블리자드", level: 5, motion: "cast", description: "서리에서 솟은 결정 조각들이 적을 감싸고 파편으로 흩어진다", layers: [{ key: "mage_blizzard", anchor: "allTargets", frame: 64, frames: 8, frameDurationsMs: [80,80,100,60,60,80,80,60], contactFrame: 3 }] },
  { id: "skill_mage_chain_lightning", classId: "class_mage", actorId: "actor_mage", name: "연쇄 번개", level: 7, motion: "cast", description: "굵은 낙뢰가 두 번 꺾여 내려오고 잔전류가 끊어진다", layers: [{ key: "mage_chain_bolt", anchor: "allTargets", frame: 64, frames: 7, frameDurationsMs: [40,60,40,60,60,80,60], contactFrame: 1 }] },
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
  { id: "skill_cleric_holy_smite", classId: "class_cleric", actorId: "actor_cleric", name: "심판의 빛", level: 3, motion: "cast", description: "푸른 물결 속 세 구슬이 나선으로 내려와 큰 빛으로 터진다", layers: [
    { key: "cleric_holy_field", anchor: "screen", frame: 128, frames: 2, startMs: 480, repeat: 5, frameDurationsMs: [160,160], plane: "backdrop", opacity: 0.82, ambient: true },
    { key: "cleric_holy_orbs_back", anchor: "target", frame: 64, frames: 12, startMs: 600, frameDurationsMs: [90,90,90,90,90,90,90,90,90,90,90,90], plane: "behind", ambient: true },
    { key: "cleric_holy_orbs_front", anchor: "target", frame: 64, frames: 12, startMs: 600, frameDurationsMs: [90,90,90,90,90,90,90,90,90,90,90,90], ambient: true },
    { key: "cleric_holy_hit", anchor: "target", frame: 64, frames: 6, startMs: 1640, frameDurationsMs: [60,80,80,60,80,60], contactFrame: 1 },
  ] },
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
  // ── 2026-09-28 확장: 새 주인공 6명(사무라이·닌자·무도가·음유시인·드루이드·마녀) ──
  { id: "skill_samurai_iai", classId: "class_samurai", actorId: "actor_samurai", name: "발도술", level: 1, motion: "blink-strike", description: "칼집에서 뽑는 순간 적을 벤다", layers: [{ key: "samurai_iai_flash", anchor: "target", frame: 64, frames: 8 }, { key: "samurai_sheath", anchor: "user", frame: 64, frames: 6 }] },
  { id: "skill_samurai_twin_moon", classId: "class_samurai", actorId: "actor_samurai", name: "쌍월참", level: 3, motion: "flurry", description: "초승달 두 개를 그리며 벤다", layers: [{ key: "samurai_moon", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_samurai_wind_cut", classId: "class_samurai", actorId: "actor_samurai", name: "풍절", level: 5, motion: "cast", description: "검풍을 날려 모든 적을 가른다", layers: [{ key: "samurai_wind_wave", anchor: "projectile", frame: 32, frames: 4 }, { key: "samurai_wind_hit", anchor: "allTargets", frame: 64, frames: 8 }] },
  { id: "skill_samurai_mind_eye", classId: "class_samurai", actorId: "actor_samurai", name: "심안", level: 7, motion: "buff", description: "눈을 감고 기를 모아 회피와 급소율을 높인다", layers: [{ key: "samurai_mind_eye", anchor: "user", frame: 64, frames: 10 }] },
  { id: "skill_samurai_cherry", classId: "class_samurai", actorId: "actor_samurai", name: "벚꽃 난무", level: 10, motion: "flurry", description: "꽃잎이 흩날리는 연속 베기", layers: [{ key: "samurai_cherry", anchor: "target", frame: 64, frames: 10 }, { key: "samurai_petals", anchor: "screen", frame: 128, frames: 8 }] },
  { id: "skill_samurai_thunder_draw", classId: "class_samurai", actorId: "actor_samurai", name: "뇌광 일섬", level: 12, motion: "blink-strike", description: "번개를 두른 발도로 적진을 가로지른다", layers: [{ key: "samurai_thunder_line", anchor: "screen", frame: 128, frames: 10 }, { key: "samurai_thunder_hit", anchor: "allTargets", frame: 64, frames: 8 }] },
  { id: "skill_samurai_blood_moon", classId: "class_samurai", actorId: "actor_samurai", name: "혈월", level: 16, motion: "cast", description: "붉은 달을 띄워 적의 힘을 빼앗는다", layers: [{ key: "samurai_blood_moon", anchor: "screen", frame: 128, frames: 10 }, { key: "samurai_blood_hit", anchor: "allTargets", frame: 64, frames: 8 }] },
  { id: "skill_samurai_final_cut", classId: "class_samurai", actorId: "actor_samurai", name: "무명 일도", level: 22, motion: "finisher", description: "세상이 멈춘 순간 단 한 번 베는 필살기", layers: [{ key: "samurai_final_sky", anchor: "screen", frame: 128, frames: 12 }, { key: "samurai_final_slash", anchor: "allTargets", frame: 64, frames: 10 }] },
  { id: "skill_ninja_shuriken", classId: "class_ninja", actorId: "actor_ninja", name: "수리검", level: 1, motion: "shoot", description: "수리검 세 장을 연달아 던진다", layers: [{ key: "ninja_shuriken", anchor: "projectile", frame: 32, frames: 4 }, { key: "ninja_shuriken_hit", anchor: "target", frame: 64, frames: 6 }] },
  { id: "skill_ninja_kunai_rain", classId: "class_ninja", actorId: "actor_ninja", name: "쿠나이 비", level: 3, motion: "cast", description: "공중으로 뛰어 쿠나이를 쏟아붓는다", layers: [{ key: "ninja_kunai", anchor: "projectile", frame: 32, frames: 4 }, { key: "ninja_kunai_hit", anchor: "allTargets", frame: 64, frames: 8 }] },
  { id: "skill_ninja_fire_style", classId: "class_ninja", actorId: "actor_ninja", name: "화둔", level: 5, motion: "cast", description: "입에서 불꽃을 뿜어 적을 태운다", layers: [{ key: "ninja_fire_breath", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_ninja_substitute", classId: "class_ninja", actorId: "actor_ninja", name: "변신술", level: 7, motion: "buff", description: "통나무와 바꿔치기해 공격을 피한다", layers: [{ key: "ninja_log_puff", anchor: "user", frame: 64, frames: 8 }] },
  { id: "skill_ninja_shadow_clone", classId: "class_ninja", actorId: "actor_ninja", name: "분신술", level: 10, motion: "flurry", description: "분신 셋이 동시에 벤다", layers: [{ key: "ninja_clone_smoke", anchor: "user", frame: 64, frames: 6 }, { key: "ninja_clone_hit", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_ninja_water_dragon", classId: "class_ninja", actorId: "actor_ninja", name: "수룡탄", level: 12, motion: "cast", description: "물로 된 용을 불러 적을 삼킨다", layers: [{ key: "ninja_water_dragon", anchor: "screen", frame: 128, frames: 10 }, { key: "ninja_splash", anchor: "allTargets", frame: 64, frames: 8 }] },
  { id: "skill_ninja_paralyze", classId: "class_ninja", actorId: "actor_ninja", name: "마비침", level: 16, motion: "shoot", description: "독침으로 적을 마비시킨다", layers: [{ key: "ninja_needle", anchor: "projectile", frame: 32, frames: 4 }, { key: "ninja_paralyze", anchor: "target", frame: 64, frames: 8 }] },
  { id: "skill_ninja_thousand_blades", classId: "class_ninja", actorId: "actor_ninja", name: "천본 벚꽃", level: 22, motion: "finisher", description: "천 개의 칼날이 춤추는 비전 필살기", layers: [{ key: "ninja_thousand_sky", anchor: "screen", frame: 128, frames: 12 }, { key: "ninja_thousand_hit", anchor: "allTargets", frame: 64, frames: 10 }] },
  { id: "skill_monk_hundred_fist", classId: "class_monk", actorId: "actor_monk", name: "백열권", level: 1, motion: "flurry", description: "보이지 않는 속도로 주먹을 퍼붓는다", layers: [{ key: "monk_fist_flurry", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_monk_rising_kick", classId: "class_monk", actorId: "actor_monk", name: "승룡각", level: 3, motion: "leap-strike", description: "솟구치는 발차기로 적을 띄운다", layers: [{ key: "monk_rising_kick", anchor: "target", frame: 64, frames: 9 }] },
  { id: "skill_monk_chi_wave", classId: "class_monk", actorId: "actor_monk", name: "기공파", level: 5, motion: "cast", description: "양손에서 푸른 기공파를 쏜다", layers: [{ key: "monk_chi_orb", anchor: "projectile", frame: 32, frames: 4 }, { key: "monk_chi_burst", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_monk_iron_body", classId: "class_monk", actorId: "actor_monk", name: "금강불괴", level: 7, motion: "buff", description: "몸을 금빛으로 단단하게 만든다", layers: [{ key: "monk_iron_body", anchor: "user", frame: 64, frames: 10 }] },
  { id: "skill_monk_whirl_kick", classId: "class_monk", actorId: "actor_monk", name: "선풍각", level: 10, motion: "spin", description: "회전 발차기로 모든 적을 걷어찬다", layers: [{ key: "monk_whirl_kick", anchor: "allTargets", frame: 64, frames: 10 }] },
  { id: "skill_monk_meditate", classId: "class_monk", actorId: "actor_monk", name: "명상", level: 12, motion: "buff", description: "호흡을 가다듬어 HP를 회복한다", layers: [{ key: "monk_meditate", anchor: "user", frame: 64, frames: 10 }] },
  { id: "skill_monk_earth_palm", classId: "class_monk", actorId: "actor_monk", name: "파산장", level: 16, motion: "dash-strike", description: "땅을 울리는 장타로 적을 날려 버린다", layers: [{ key: "monk_earth_palm", anchor: "target", frame: 128, frames: 10 }] },
  { id: "skill_monk_dragon_fist", classId: "class_monk", actorId: "actor_monk", name: "용권 멸살", level: 22, motion: "finisher", description: "머리 셋의 히드라 원화가 나타나 파동과 연속 착탄을 일으킨다", layers: [
    { key: "monk_dragon_aura", anchor: "screen", frame: 128, frames: 1, startMs: 1060, frameDurationsMs: [1400], ambient: true },
    { key: "monk_dragon_wave", anchor: "screen", frame: 128, frames: 2, startMs: 1600, repeat: 3, frameDurationsMs: [160,160], plane: "backdrop", opacity: 0.85, ambient: true },
    { key: "monk_dragon_hit", anchor: "target", frame: 64, frames: 6, startMs: 1820, frameDurationsMs: [60,80,60,80,80,60], contactFrame: 1 },
  ] },
  { id: "skill_bard_battle_song", classId: "class_bard", actorId: "actor_bard", name: "전투의 노래", level: 1, motion: "buff", description: "힘찬 선율로 아군 공격력을 올린다", layers: [{ key: "bard_notes_red", anchor: "allAllies", frame: 64, frames: 10 }] },
  { id: "skill_bard_lullaby", classId: "class_bard", actorId: "actor_bard", name: "자장가", level: 3, motion: "cast", description: "잔잔한 선율로 모든 적을 재운다", layers: [{ key: "bard_notes_blue", anchor: "allTargets", frame: 64, frames: 10 }] },
  { id: "skill_bard_sonic", classId: "class_bard", actorId: "actor_bard", name: "소닉 붐", level: 5, motion: "cast", description: "음파를 증폭시켜 적을 친다", layers: [{ key: "bard_sonic_wave", anchor: "projectile", frame: 32, frames: 4 }, { key: "bard_sonic_hit", anchor: "target", frame: 64, frames: 8 }] },
  { id: "skill_bard_healing_hymn", classId: "class_bard", actorId: "actor_bard", name: "치유의 찬가", level: 7, motion: "cast", description: "찬가로 아군 전체를 회복시킨다", layers: [{ key: "bard_hymn", anchor: "allAllies", frame: 64, frames: 10 }] },
  { id: "skill_bard_discord", classId: "class_bard", actorId: "actor_bard", name: "불협화음", level: 10, motion: "cast", description: "귀를 찢는 불협화음으로 적을 혼란시킨다", layers: [{ key: "bard_discord", anchor: "allTargets", frame: 64, frames: 10 }] },
  { id: "skill_bard_haste", classId: "class_bard", actorId: "actor_bard", name: "질주곡", level: 12, motion: "buff", description: "빠른 템포로 아군의 속도를 올린다", layers: [{ key: "bard_tempo", anchor: "allAllies", frame: 64, frames: 8 }] },
  { id: "skill_bard_requiem", classId: "class_bard", actorId: "actor_bard", name: "레퀴엠", level: 16, motion: "cast", description: "진혼곡이 적의 영혼을 흔든다", layers: [{ key: "bard_requiem_sky", anchor: "screen", frame: 128, frames: 10 }, { key: "bard_requiem_hit", anchor: "allTargets", frame: 64, frames: 8 }] },
  { id: "skill_bard_grand_finale", classId: "class_bard", actorId: "actor_bard", name: "그랜드 피날레", level: 22, motion: "finisher", description: "무대 전체가 빛나는 대합주 필살기", layers: [{ key: "bard_finale_stage", anchor: "screen", frame: 128, frames: 12 }, { key: "bard_finale_hit", anchor: "allTargets", frame: 64, frames: 10 }] },
  { id: "skill_druid_thorn", classId: "class_druid", actorId: "actor_druid", name: "가시 덩굴", level: 1, motion: "cast", description: "땅에서 가시 덩굴이 솟아 적을 옭아맨다", layers: [{ key: "druid_thorn", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_druid_regrowth", classId: "class_druid", actorId: "actor_druid", name: "재생", level: 3, motion: "cast", description: "새싹이 돋아 아군 하나를 치유한다", layers: [{ key: "druid_regrowth", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_druid_swarm", classId: "class_druid", actorId: "actor_druid", name: "벌레 떼", level: 5, motion: "cast", description: "독벌레 떼를 부른다", layers: [{ key: "druid_swarm", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_druid_bark_skin", classId: "class_druid", actorId: "actor_druid", name: "수피", level: 7, motion: "buff", description: "나무껍질로 아군 전체의 방어를 높인다", layers: [{ key: "druid_bark", anchor: "allAllies", frame: 64, frames: 8 }] },
  { id: "skill_druid_entangle", classId: "class_druid", actorId: "actor_druid", name: "대지의 속박", level: 10, motion: "cast", description: "모든 적을 뿌리로 묶는다", layers: [{ key: "druid_roots", anchor: "allTargets", frame: 64, frames: 10 }] },
  { id: "skill_druid_moonbeam", classId: "class_druid", actorId: "actor_druid", name: "달빛", level: 12, motion: "cast", description: "은빛 달빛 기둥을 내린다", layers: [{ key: "druid_moonbeam", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_druid_bear_form", classId: "class_druid", actorId: "actor_druid", name: "곰 변신", level: 16, motion: "dash-strike", description: "거대한 곰의 영혼을 입고 할퀸다", layers: [{ key: "druid_bear_spirit", anchor: "user", frame: 64, frames: 8 }, { key: "druid_claw", anchor: "target", frame: 64, frames: 8 }] },
  { id: "skill_druid_world_tree", classId: "class_druid", actorId: "actor_druid", name: "세계수의 분노", level: 22, motion: "finisher", description: "세계수를 불러 적을 짓누르고 아군을 치유하는 필살기", layers: [{ key: "druid_world_tree", anchor: "screen", frame: 128, frames: 12 }, { key: "druid_tree_hit", anchor: "allTargets", frame: 64, frames: 10 }] },
  { id: "skill_witch_hex", classId: "class_witch", actorId: "actor_witch", name: "저주", level: 1, motion: "cast", description: "보라빛 저주로 적의 방어를 깎는다", layers: [{ key: "witch_hex", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_witch_frog", classId: "class_witch", actorId: "actor_witch", name: "개구리 변신", level: 3, motion: "cast", description: "적을 잠시 개구리로 만든다", layers: [{ key: "witch_frog_puff", anchor: "target", frame: 64, frames: 10 }] },
  { id: "skill_witch_cauldron", classId: "class_witch", actorId: "actor_witch", name: "독 가마솥", level: 5, motion: "cast", description: "가마솥에서 독 거품이 모든 적에게 튄다", layers: [{ key: "witch_cauldron", anchor: "screen", frame: 128, frames: 8 }, { key: "witch_poison_hit", anchor: "allTargets", frame: 64, frames: 8 }] },
  { id: "skill_witch_drain", classId: "class_witch", actorId: "actor_witch", name: "생명 흡수", level: 7, motion: "cast", description: "적의 생명을 빨아 자신을 회복한다", layers: [{ key: "witch_drain_beam", anchor: "target", frame: 64, frames: 10 }, { key: "witch_drain_orb", anchor: "projectile", frame: 32, frames: 4 }] },
  { id: "skill_witch_bats", classId: "class_witch", actorId: "actor_witch", name: "박쥐 떼", level: 10, motion: "cast", description: "박쥐 떼를 불러 모든 적을 물게 한다", layers: [{ key: "witch_bat_swarm", anchor: "allTargets", frame: 64, frames: 10 }] },
  { id: "skill_witch_mirror", classId: "class_witch", actorId: "actor_witch", name: "거울 장막", level: 12, motion: "buff", description: "거울 장막으로 마법을 튕겨낸다", layers: [{ key: "witch_mirror", anchor: "user", frame: 64, frames: 10 }] },
  { id: "skill_witch_nightmare", classId: "class_witch", actorId: "actor_witch", name: "악몽", level: 16, motion: "cast", description: "적 모두에게 악몽을 꾸게 한다", layers: [{ key: "witch_nightmare_sky", anchor: "screen", frame: 128, frames: 10 }, { key: "witch_nightmare_hit", anchor: "allTargets", frame: 64, frames: 8 }] },
  { id: "skill_witch_moon_sabbath", classId: "class_witch", actorId: "actor_witch", name: "월식의 연회", level: 22, motion: "finisher", description: "검은 달 아래 마녀의 연회가 열리는 필살기", layers: [{ key: "witch_sabbath_sky", anchor: "screen", frame: 128, frames: 12 }, { key: "witch_sabbath_hit", anchor: "allTargets", frame: 64, frames: 10 }] },
];

/** 모든 레이어 시트(키 중복 제거). 생성기·프리로드·검증이 쓴다. */
export const RETRO_FX_SHEETS: readonly RetroFxLayer[] = [...new Map(RETRO_CLASS_SKILLS.flatMap((skill) => skill.layers).map((layer) => [layer.key, layer])).values()];

export function retroClassSkill(id: string | undefined): RetroClassSkill | undefined {
  return id ? RETRO_CLASS_SKILLS.find((skill) => skill.id === id) : undefined;
}
