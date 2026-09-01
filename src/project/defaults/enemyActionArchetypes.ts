// 계열별 적 행동 레퍼토리.
//
// 왜 필요한가: 기본 DB 의 적 106마리가 전부 동일한 단 하나의 패턴
// (skill_attack / always)만 가져서, 이미 작동하는 세 시스템이 발화하지 못했다 —
// 효용도 AI(선택지 1개), 상태이상 12종(적이 걸 수단 없음), 속성 저항(적 공격이 무속성).
// 속성 저항은 방향에 주의한다: 적이 속성 공격을 하면 켜지는 건 맞는 쪽, 즉
// **액터·직업의** elementRates 다(적의 elementRates 는 플레이어가 적을 때릴 때 쓰인다).
//
// 왜 조건이 아니라 효용도에 맡기는가: EnemyActionCondition 은 `always` 와 `turn` 뿐이라
// "HP 50% 아래면 강타" 를 저작할 수 없다. 대신 `always` 패턴을 여러 개 주면, 이미
// 대상 HP 비율·킬샷 가능 여부·회복 필요를 실시간으로 읽는 효용도 AI
// (runtime.ts chooseEnemyAction)가 상황에 맞게 고른다.
//
// MP 예산: 적 maxMp 는 보스를 뺀 전원이 10 이다. 4MP 특수기는 2회뿐이므로 모든
// 아키타입에 MP 0 스킬을 최소 1개 넣어 고갈 시 행동 불능을 막는다.
import type { EnemyActionPattern } from "../types/database";

export type EnemyArchetype =
  | "blob"
  | "venom"
  | "brute"
  | "curse"
  | "caster"
  | "bulwark"
  | "tactician"
  | "flyer"
  | "boss";

function always(skillId: string, priority: number): EnemyActionPattern {
  return {
    skillId: skillId as EnemyActionPattern["skillId"],
    priority,
    condition: { kind: "always" },
    switchOnAfterAction: { enabled: false },
    switchOffAfterAction: { enabled: false },
  };
}

function everyNthTurn(skillId: string, priority: number, interval: number): EnemyActionPattern {
  return {
    skillId: skillId as EnemyActionPattern["skillId"],
    priority,
    condition: { kind: "turn", start: interval, interval },
    switchOnAfterAction: { enabled: false },
    switchOffAfterAction: { enabled: false },
  };
}

/** 정령·원소 계열은 개체마다 속성이 다르다. 저항 프로필에서 추론하지 않는다 —
 *  저항은 "무엇에 강한가" 이지 "무엇을 쓰는가" 가 아니다. 명시적으로 적는다. */
export const SPIRIT_ELEMENT_SKILLS: Record<string, string> = {
  enemy_spirit_fire: "skill_fire",
  enemy_spirit_water: "skill_water",
  enemy_spirit_earth: "skill_earth",
  enemy_spirit_wind: "skill_wind",
  enemy_spirit_light: "skill_holy",
  enemy_spirit_dark: "skill_dark",
  enemy_wisp_blue: "skill_ice",
  enemy_sylph_air: "skill_wind",
  enemy_undine_sea: "skill_water",
  enemy_salamander_flame: "skill_fire",
};

/**
 * @param elementSkillId `caster`/`boss` 가 쓸 속성 공격 스킬.
 *   생략하면 무속성 `skill_arcane_bolt` 로 폴백한다.
 *   (`curse` 는 skill_dark, `bulwark` 는 skill_earth 로 계열이 고정이다.)
 */
export function archetypeActions(archetype: EnemyArchetype, elementSkillId?: string): EnemyActionPattern[] {
  const elemental = elementSkillId ?? "skill_arcane_bolt";
  switch (archetype) {
    case "blob":
      return [always("skill_attack", 5), always("skill_poison_sting", 4)];
    case "venom":
      return [always("skill_attack", 5), always("skill_poison_sting", 5), always("skill_weaken", 3)];
    case "brute":
      return [always("skill_attack", 5), always("skill_sword_slash", 5), always("skill_focus", 3)];
    case "curse":
      return [always("skill_attack", 5), always("skill_dark", 4), always("skill_weaken", 3)];
    case "caster":
      return [always("skill_attack", 4), always(elemental, 6)];
    case "bulwark":
      return [always("skill_attack", 5), always("skill_earth", 4), always("skill_focus", 3)];
    case "tactician":
      return [
        always("skill_attack", 5),
        always("skill_sword_slash", 4),
        always("skill_weaken", 3),
        always("skill_heal", 4),
      ];
    case "flyer":
      return [always("skill_attack", 5), always("skill_throwing_knife", 4), always("skill_sleep_mist", 3)];
    case "boss":
      // 보스는 특수기를 전투 내내 유지할 MP 예산을 받는다. turn 조건은 보스 전용이다.
      return [
        always("skill_attack", 4),
        always("skill_sword_slash", 5),
        always(elemental, 5),
        everyNthTurn(elemental, 9, 3),
      ];
  }
}
