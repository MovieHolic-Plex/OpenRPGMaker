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
// MP 예산: 적 maxMp 는 보스를 뺀 전원이 10 이다(보스 11마리는 40 — Task 5). 4MP 특수기가
// 비보스에서는 2회뿐이므로 모든 아키타입에 MP 0 스킬을 최소 1개 넣어 고갈 시 행동 불능을 막는다.
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
// 알려진 한계: 데미지 효용은 `max(0, power + 스탯/2 − 대상방어/2)` 라 방어가 높은 상대
// 앞에서는 위력이 낮은 쪽이 먼저 0 으로 포화한다. 포화하면 그쪽만 `-1000 + priority`
// 밴드로 강등되므로(runtime.ts:1822) 우선순위 차이로도 못 살린다. 실제로 남은 잔재는
// `blob` 하나다 — 위력 8 짜리 `poison_sting` 은 대상방어가 `공격력/2 + 8`~`+9` 인 딱 두
// 칸에서 자기만 잘려 위력 10 짜리 기본 공격에 진다. 유료기는 MP 부족 시 **점수 계산
// 전에** 필터된다(runtime.ts:1798) — 그래서 보스는 maxMp 40 을 받는다.
//
// ── 공격력 스케일: mind = attack 규칙으로 해소했다 (Task 5) ──────────────────
// 데미지형 정체성 스킬(`skill_poison_sting`·속성기)은 전부 `statistic: "mind"` 인데
// 적 mind 가 **전원 10** 이던 시절에는 마법 위력이 `power + 5` 에 묶였다. 반면 물리
// 무료기의 효용은 적 attack 에 비례해 커진다. 그래서 공격력이 큰 적은 속성기·독침이
// 영구히 사장됐다(실측: 공격력 13 → blob `poison_sting 424`, 공격력 100 → `attack 199`
// 로 poison 0).
//
// 지금은 **생성 로스터 100마리의 `mind` 가 그 적의 `attack` 과 같다.** 그러면 마법
// 정체성기와 물리 무료기가 같은 스탯 항 `floor(스탯/2)` 를 갖게 되어 우열이 공격력에서
// 분리되고, 위력차 + 우선순위차만 남는다(전부 정체성기 쪽이 앞선다). 이 성질은
// `test/enemyActionArchetypes.test.ts` 가 공격력 9~214 전 구간에서 검사한다.
// 규칙을 깨는 적을 새로 넣으면(예: mind 만 낮게) 그 검사가 먼저 빨개진다.
//
// mind 를 올려도 플레이어 쪽 수치는 안 바뀐다 — 적 mind 가 마법 방어력으로 쓰이는 건
// `battleModel === "gen1"` 일 때뿐이고(battleDamage.usesMagicalDefense), 기본 DB 는 rm2k3 다.
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

/**
 * 적이 쓸 수 있는 속성 공격 스킬. **저항 시드 표(`DEFAULT_ELEMENT_RATE_LABELS`)에 있는
 * 속성만** 나열한다 — 시드 표에 없는 속성은 맞는 쪽(액터·직업)의 `elementRates` 에 등급이
 * 없어 `elementMultiplierFor` 가 배율 1.0 으로 조기 반환하므로, 속성을 붙여도 무속성과
 * 수치가 완전히 같아진다. 그래서 `skill_leaf`(elementId `"grass"`)는 여기 없다.
 */
export type ElementAttackSkillId =
  | "skill_fire"
  | "skill_water"
  | "skill_ice"
  | "skill_thunder"
  | "skill_earth"
  | "skill_wind"
  | "skill_holy"
  | "skill_dark";

// ── 개체 속성 매핑 두 표의 오타 안전장치 ────────────────────────────────────
// 이 두 표는 이 파일의 유일한 **무성(無聲) 실패 경로**다: 키를 오타내면 조회가
// `undefined` 를 내고 archetypeActions 의 `?? "skill_arcane_bolt"` 가 그대로 삼켜
// 무속성으로 조용히 떨어진다. 나머지 90마리의 아키타입 배정은 `EnemyArchetype` 유니언이
// 있어 오타가 곧 컴파일 오류인데, 여기만 그 보호가 없었다.
//
// 그래서 `Record<string, string>` 주석을 떼고 `as const` 로 **키를 리터럴 타입으로 고정**
// 한다. 표의 키를 오타내면 그 키를 점 접근하는 generatedEnemyRecords.ts 가 즉시 타입
// 오류가 된다(`속성 'enemy_salamander_flame' 이(가) … 형식에 없습니다`).
// `satisfies` 는 값 쪽 — 실재하지 않는 스킬 id 를 못 쓰게 한다.
// 컴파일이 못 보는 두 가지(표의 키와 레코드 id 가 어긋난 짝짓기, 아무도 안 읽는 죽은
// 항목)는 test/enemyActionArchetypes.test.ts 가 소스 줄을 파싱해 막는다.

/** 정령·원소 계열은 개체마다 속성이 다르다. 저항 프로필에서 추론하지 않는다 —
 *  저항은 "무엇에 강한가" 이지 "무엇을 쓰는가" 가 아니다. 명시적으로 적는다. */
export const SPIRIT_ELEMENT_SKILLS = {
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
} as const satisfies Record<string, ElementAttackSkillId>;

/**
 * 드래곤·보스 10마리의 속성. 정령과 같은 이유로 명시한다 — `boss` 아키타입에 속성을
 * 안 넘기면 전원이 폴백 `skill_arcane_bolt`(무속성)로 떨어져 붉은 용이 불을 안 뿜고
 * 청룡과 본 드래곤이 구분되지 않는다. 스타터 `enemy_dragon` 은 이 표를 쓰지 않고
 * defaultDatabaseBattleRecords.ts 에서 직접 `"skill_fire"` 를 넘긴다.
 *
 * 배정 근거는 이름의 주제성이다. 여덟 속성을 전부 쓴다:
 *   새끼 용·붉은 용 = 불 / 청룡 = 번개(청룡은 뇌룡 계열이고, 정령 10마리가 유일하게
 *   안 쓰는 속성이 thunder 다) / 본 드래곤·마왕 = 어둠 / 히드라 = 물(레르네의 물뱀) /
 *   베히모스 = 대지 / 타락 천사 = 신성(천사의 힘은 남았다 — 어둠은 이미 둘이다) /
 *   부유하는 눈 = 얼음(응시로 얼린다) / 식충 식물 = 바람(포자를 날린다. `skill_leaf`
 *   의 grass 는 저항 시드 표에 없어 무속성과 수치가 같아지므로 쓰지 않는다).
 */
export const BOSS_ELEMENT_SKILLS = {
  enemy_dragon_whelp: "skill_fire",
  enemy_dragon_red: "skill_fire",
  enemy_dragon_blue: "skill_thunder",
  enemy_dragon_bone: "skill_dark",
  enemy_hydra_three: "skill_water",
  enemy_behemoth_horn: "skill_earth",
  enemy_demon_lord: "skill_dark",
  enemy_angel_fallen: "skill_holy",
  enemy_eye_floating: "skill_ice",
  enemy_plant_carnivore: "skill_wind",
} as const satisfies Record<string, ElementAttackSkillId>;

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
