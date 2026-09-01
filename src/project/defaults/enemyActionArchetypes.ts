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
// ── 우선순위 규칙 (R14 → B1 개정) ───────────────────────────────────────────
// Task 4 가 이 헬퍼로 적 100마리를 덮으므로 규칙을 여기 못박는다.
//
//     5 = 고정 위력 무료 데미지 (sword_slash 22 / throwing_knife 18)
//     7 = **앵커** `skill_attack`  ← 회당 피해의 축
//     7 = 보스의 속성기(always)    ← 보스만 예외. 아래 boss 케이스 주석 참조
//     8 = 정체성기 (weaken·focus·sleep_mist·heal·속성기·arcane_bolt·poison_sting)
//     9 = 보스의 turn 조건 버스트
//
// ── 가장 중요한 사실: `skill_attack` 만 스탯에 비례한다 ─────────────────────
// 런타임의 두 경로가 서로 다른 위력을 쓴다.
//   실제 피해 해결: `power = skillId === DEFAULT_SKILL_ID ? user.attackPower : skill.power`
//                  (runtime.ts:1953) → skill_attack 의 실위력은 DB 의 10 이 **아니라**
//                  시전자 attackPower(로스터 9~214) 다.
//   AI 효용 계산:   `enemyDamageUtility(user, target, skill.power, ...)`(runtime.ts:1897)
//                  → 여기엔 **10** 이 들어간다. 바로 위 1877 행의 기본값
//                  `power = user.attackPower` 가 정답인데 이 호출이 덮어쓴다.
// 즉 AI 는 자기 최강수를 최대 20배 과소평가한다. 저작 스킬(위력 8~30)을 무조건 위에
// 두면 적이 통상공격을 영구히 버리고 회당 피해가 1/4 로 준다(실측: 출하 트룹 4개
// 합계 피해 806 → 180, −78%).
//
// 그래서 규칙은 "정체성 우선" 이 아니라 **"앵커를 밀어낼 수 있는가"** 로 나뉜다:
//   · 고정 위력 무료기(slash/knife)는 MP 가 없어 자기제한이 안 된다 → **앵커 아래(5)**.
//     한번 이기면 전투 내내 이겨서 앵커를 통째로 대체한다.
//   · 유료 정체성기는 MP 가 사용 횟수를 묶는다(4MP·maxMp 10 → 2회) → **앵커 위(8)**
//     가 안전하다. 몇 번 쓰고 MP 가 마르면 앵커가 자연히 이어받는다. 상태기는 상태가
//     이미 걸려 있으면 효용 0 으로 강등돼(runtime.ts:1822) 이중으로 자기제한된다.
//   · `poison_sting` 만 예외다. 무료라 자기제한이 없는데도 8 에 둔다 — blob 의 유일한
//     정체성이라 내리면 그 계열이 통상공격만 하는 원래 문제로 돌아간다. 대가는
//     실측으로 안다(출하 troop_forest_hornets 93.4 → 82.4, −12%). blob/venom 은
//     로스터에서 가장 약한 계열이라 절대 손실이 작다.
//
// 왜 낮은 쪽은 아예 안 나오는가 — 점수는 `max(1,priority)*10 + utility`(runtime.ts:1820)
// 인데 두 데미지 스킬의 `Δscore` 는 전투 내내 상수다. 그래서 우선순위 배치는 "몇 번
// 쓰이나" 가 아니라 **"영구히 쓰이나 / 영구히 죽나"** 를 정한다. 동점일 때만
// 무작위로 갈린다(runtime.ts:1865-1867).
//
// 알려진 한계: 데미지 효용은 `max(0, power + 스탯/2 − 대상방어/2)` 라 방어가 높은 상대
// 앞에서는 위력이 낮은 쪽이 먼저 0 으로 포화하고, 포화한 쪽만 `-1000 + priority` 밴드로
// 강등된다(runtime.ts:1822). 유료기는 MP 부족 시 **점수 계산 전에** 필터된다
// (runtime.ts:1798) — 그래서 보스는 maxMp 40 을 받는다.
//
// ── `mind = attack` 규칙이 고치는 것과 못 고치는 것 (R16 정정) ───────────────
// 생성 로스터 100마리는 `mind` 가 그 적의 `attack` 과 같다(Task 5). 이 규칙이 고치는
// 것은 **AI 의 선택**이다: 마법 정체성기와 물리 스킬이 같은 스탯 항 `floor(스탯/2)` 를
// 갖게 돼 우열이 위력차 + 우선순위차만 남고, 공격력이 커져도 정체성기가 안 죽는다.
// `test/enemyActionArchetypes.test.ts` 가 공격력 9~214 전 구간에서 이걸 검사한다.
//
// **못 고치는 것: 실제 피해 격차.** `skill_attack` 의 위력 항은 공유되는
// `floor(스탯/2)` 가 아니라 `attackPower` **그 자체**다(runtime.ts:1953). 그래서 실피해
// 격차는 `attackPower − power` 이고 공격력이 클수록 벌어진다. mind 를 올려도 이 격차는
// 한 칸도 안 줄고, AI 의 잘못된 평가만 이긴다. 회당 피해를 지키는 건 오직 우선순위
// 배치(앵커 7 > 고정 무료기 5)뿐이다.
//
// mind 를 올려도 플레이어 쪽 수치는 안 바뀐다 — 적 mind 가 마법 방어력으로 쓰이는 건
// `battleModel === "gen1"` 일 때뿐이고(battleDamage.usesMagicalDefense), 기본 DB 는 rm2k3 다.
import type { EnemyActionPattern } from "../types/database";

/** 고정 위력 무료 데미지(sword_slash 22 / throwing_knife 18). 앵커 아래에 둔다. */
const FIXED_FREE = 5;
/** 앵커 = `skill_attack`. 실위력이 시전자 attackPower 인 유일한 스킬이라 회당 피해의 축이다. */
const ANCHOR = 7;
/**
 * 보스의 속성기(always). 앵커(7)보다 **두 칸 아래**인데 `mind = attack` 로스터에서는
 * 이게 정확히 **점수 동률**이 된다: 속성기 `5*10 + 위력 30 + 스탯/2` = 앵커
 * `7*10 + 위력 10 + 스탯/2` = `80 + 스탯/2`. 우선순위 2칸(20)이 위력차(30−10)를 정확히
 * 상쇄하고, 동률이면 runtime.ts:1865-1867 이 무작위로 갈라 둘이 섞인다.
 *
 * 왜 보스만 이런가 — 다른 계열은 유료기를 앵커 위(8)에 둬도 maxMp 10 이 2회로 묶어
 * 주는데, 보스는 maxMp 40 이라 4MP 속성기를 10회 쓴다. 전투가 그보다 짧으면 사실상
 * 무제한이라 앵커를 통째로 밀어낸다(실측 공격력 100 보스: 8 → `fire 418 / attack 0`,
 * 5 → `fire 194 / attack 120`).
 */
const BOSS_ELEMENT = 5;
/** 정체성기. MP(또는 상태 중복)로 자기제한되므로 앵커 위가 안전하다. */
const IDENTITY = 8;
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
      return [always("skill_attack", ANCHOR), always("skill_poison_sting", IDENTITY)];
    case "venom":
      return [
        always("skill_attack", ANCHOR),
        always("skill_poison_sting", IDENTITY),
        always("skill_weaken", IDENTITY),
      ];
    case "brute":
      return [
        always("skill_attack", ANCHOR),
        always("skill_sword_slash", FIXED_FREE),
        always("skill_focus", IDENTITY),
      ];
    case "curse":
      return [
        always("skill_attack", ANCHOR),
        always("skill_dark", IDENTITY),
        always("skill_weaken", IDENTITY),
      ];
    case "caster":
      return [always("skill_attack", ANCHOR), always(elemental, IDENTITY)];
    case "bulwark":
      return [
        always("skill_attack", ANCHOR),
        always("skill_earth", IDENTITY),
        always("skill_focus", IDENTITY),
      ];
    case "tactician":
      return [
        always("skill_attack", ANCHOR),
        always("skill_sword_slash", FIXED_FREE),
        always("skill_weaken", IDENTITY),
        always("skill_heal", IDENTITY),
      ];
    case "flyer":
      return [
        always("skill_attack", ANCHOR),
        always("skill_throwing_knife", FIXED_FREE),
        always("skill_sleep_mist", IDENTITY),
      ];
    case "boss":
      // 보스만 속성기를 IDENTITY(8) 가 아니라 **앵커와 동률(7)** 로 둔다.
      // "유료기는 MP 가 자기제한하니 앵커 위가 안전하다" 는 전제가 보스에서만 깨지기
      // 때문이다 — 보스 maxMp 는 40(emberQuest 드래곤은 60)이라 4MP 속성기를 10~15 회
      // 쓴다. 전투가 그보다 짧으면 사실상 무제한이라 앵커를 통째로 밀어낸다.
      // 실측(출하 troop_dragon, 피해량): 속성기 8 → 68.9 / 동률 7 → 298.3.
      //
      // 그래서 주기 발화는 turn 버스트(9)가 맡는다. 버스트는 3턴에 한 번만 후보가 되므로
      // 앵커를 밀어내지 않으면서 속성을 보여준다. 단 "확정 발화" 는 아니다 — turn 항목도
      // 다른 행동과 똑같이 MP 검사를 통과해야 한다(runtime.ts:1798 → battleSkillUse.ts:40).
      return [
        always("skill_attack", ANCHOR),
        always("skill_sword_slash", FIXED_FREE),
        always(elemental, BOSS_ELEMENT),
        everyNthTurn(elemental, BURST, 3),
      ];
  }
}
