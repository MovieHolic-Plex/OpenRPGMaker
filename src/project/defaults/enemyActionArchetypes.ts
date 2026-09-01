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
//
// ── 우선순위 규칙 (R14) ─────────────────────────────────────────────────────
// Task 4 가 이 헬퍼로 적 100마리를 덮으므로 규칙을 여기 못박는다.
//
//   규칙 1. 정체성 스킬(상태 부여·속성)은 같은 아키타입의 평범한 데미지 스킬보다
//           우선순위를 **낮게 두지 않는다.**
//   규칙 2. 우선순위는 **MP 소비 순서**를 표현한다(유료 > 무료).
//
//     5 = 평범한 무료 데미지 (attack / sword_slash / throwing_knife)
//     6 = 무료 정체성        (poison_sting)
//     7 = 유료 정체성        (weaken·focus·sleep_mist·heal·속성기·arcane_bolt)
//     9 = 보스의 turn 조건 버스트
//
// 왜 정체성 스킬을 올리는가 — 선택 점수식이 그 가치를 못 보기 때문이다.
// chooseEnemyAction 은 `score = max(1,priority)*10 + utility` 로 고르는데
// (runtime.ts:1820), utility 를 내는 enemySkillUtility 는 `effect.kind === "damage"` 면
// **stateEffects 를 보지 않고 즉시 데미지 효용으로 반환한다**(runtime.ts:1896-1898).
// 그래서 skill_poison_sting 의 독 85% 는 점수에 0 으로 기여하고, 위력 8 짜리 마법
// 공격으로만 평가돼 기본 공격에 영구히 진다. 우선순위가 그 맹점을 보정한다.
//
// 왜 같은 값(동점)을 일부러 쓰는가 — 동점이 유일한 교대 메커니즘이다.
// chooseEnemyAction 은 최고점이 동점이면 그 중 하나를 **무작위로** 고른다
// (runtime.ts:1865-1867). 점수가 다르면 `Δscore = 10·Δpriority + Δ데미지효용` 이
// 전투 내내 상수라 낮은 쪽은 **한 번도** 안 나온다. brute/tactician/boss 에서
// attack 과 sword_slash 를 같은 5 로 둔 게 그 이유다. 둘 다 MP 0 무기 공격이라
// 어느 쪽이 이겨도 정체성 손실이 없고 고갈 방어도 유지된다.
//
// 알려진 한계: 데미지 효용은 `max(0, power + 스탯/2 − 대상방어/2)` 라, 적 mind 가
// 전원 10 인 지금은 방어가 높은 상대 앞에서 마법 계열이 0 으로 포화한다. 포화하면
// 우선순위만 남고, 유료기는 MP 부족 시 **점수 계산 전에** 필터된다(runtime.ts:1798).
// 그래서 싼 보조기와 비싼 속성기를 같이 든 계열(bulwark·curse)은 우선순위만으로는
// 완전히 못 고친다 — MP 예산·mind 스탯(Task 5)과 묶여야 한다.
//
// ── 배정 주의: 이 헬퍼는 공격력 스케일에 중립이 아니다 ───────────────────────
// 데미지형 정체성 스킬(`skill_poison_sting`·속성기)은 **적 공격력이 크면 죽는다.**
// 물리 스킬의 효용은 공격력에 비례해 커지는데 적 mind 가 전원 10 으로 고정이라
// 마법 위력은 `30 + 5` 에 묶이기 때문이다. 우선순위로는 못 메운다 — 100점대 효용
// 차이를 한 단계(10점)로 넘을 수 없다.
//
// 실측(임시 트룹 40판, 주인공 Lv1):
//   공격력 13 → blob `poison_sting 424` / caster `attack 215, fire 208`
//   공격력 100 → blob `attack 199`(poison 0) / caster `attack 199`(fire 0)
//
// 그래서 **`blob`·`caster` 는 저공격력 적에 배정한다.** 고공격력 적(생성 로스터의
// attack 은 9~214 로 퍼져 있다)에 붙이면 행동이 여러 개여도 사실상 단일 행동이 된다.
// 고공격력 적에는 상태 기반 계열(`venom`·`brute`·`flyer`·`tactician`)이 안전하다 —
// 그쪽 효용은 상태 부여 확률이라 공격력에 안 밀린다. 속성 계열을 꼭 붙여야 하면
// Task 5 의 mind 상향 이후 재측정할 것.
import type { EnemyActionPattern } from "../types/database";

/** 평범한 무료 데미지. */
const PLAIN = 5;
/** 무료 정체성 — 점수식이 상태 부여 가치를 못 보므로 평범한 무료기보다 한 칸 위. */
const IDENTITY_FREE = 6;
/** 유료 정체성 — MP 가 있는 동안 먼저 쓰고, 고갈되면 자동으로 무료기로 내려온다. */
const IDENTITY_PAID = 7;
/** 보스 전용 turn 조건 버스트. */
const BURST = 9;

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
      return [always("skill_attack", PLAIN), always("skill_poison_sting", IDENTITY_FREE)];
    case "venom":
      return [
        always("skill_attack", PLAIN),
        always("skill_poison_sting", IDENTITY_FREE),
        always("skill_weaken", IDENTITY_PAID),
      ];
    case "brute":
      return [
        always("skill_attack", PLAIN),
        always("skill_sword_slash", PLAIN),
        always("skill_focus", IDENTITY_PAID),
      ];
    case "curse":
      return [
        always("skill_attack", PLAIN),
        always("skill_dark", IDENTITY_PAID),
        always("skill_weaken", IDENTITY_PAID),
      ];
    case "caster":
      return [always("skill_attack", PLAIN), always(elemental, IDENTITY_PAID)];
    case "bulwark":
      return [
        always("skill_attack", PLAIN),
        always("skill_earth", IDENTITY_PAID),
        always("skill_focus", IDENTITY_PAID),
      ];
    case "tactician":
      return [
        always("skill_attack", PLAIN),
        always("skill_sword_slash", PLAIN),
        always("skill_weaken", IDENTITY_PAID),
        always("skill_heal", IDENTITY_PAID),
      ];
    case "flyer":
      return [
        always("skill_attack", PLAIN),
        always("skill_throwing_knife", PLAIN),
        always("skill_sleep_mist", IDENTITY_PAID),
      ];
    case "boss":
      // turn 조건은 보스 전용이다. 같은 속성기를 always(7)/turn(9) 두 벌로 두는 건
      // 낭비가 아니다 — 공격력이 크면 sword_slash(5)의 데미지 효용이 always(7)를
      // 이기지만 turn(9)는 못 이긴다. 즉 버스트는 always 가 죽는 구간에서 속성기를
      // 살려두는 안전망이다(실측: 공격력 100 보스 `sword_slash 317, fire 107`).
      // 단 "확정 발화"는 아니다 — turn 항목도 다른 행동과 똑같이 MP 검사를 통과해야
      // 한다(runtime.ts:1798 → battleSkillUse.ts:40). MP 가 비용 미만이면 버스트도
      // 후보에서 빠진다.
      return [
        always("skill_attack", PLAIN),
        always("skill_sword_slash", PLAIN),
        always(elemental, IDENTITY_PAID),
        everyNthTurn(elemental, BURST, 3),
      ];
  }
}
