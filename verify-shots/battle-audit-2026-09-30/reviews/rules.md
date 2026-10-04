# 전투 규칙 적대 리뷰 — v0.41.0

- 고정 HEAD: `0e0db9b5818814e9f27400c8fb2b54b619d59e8d`.
- 조사자 범위: `src/battle/runtime.ts`, 상태/피해/기술 적법성, 대상 해결, 예측/자동 전투, 승패/보상.
- 이 보고서는 읽기 전용 소스 추적 결과다. Node·브라우저·테스트·게이트는 실행하지 않았다. 저장소/프로젝트 DB는 수정하지 않았다.
- 아래 5건은 모두 **confirmed-by-source**다. 실제 런타임 숫자는 감독자 프로브로 확인해야 한다. 사양이 모호한 과잉 피해 흡수량 등은 확정 항목에서 제외했다.

## R1 — [P1] strict 라운드 도중 받은 행동불가가 예약 행동을 막지 못함

**위치:** `/home/main/.codex/worktrees/3852/rpg-zzu/src/battle/runtime.ts:1631-1644` (핵심은 1632-1635).

**조건/입력:** RM2k3, strict, 배우보다 빠른 적이 배우에게 `runtimeEffects.restrictsAction:true` 또는 `freezesGauge:true`인 상태를 부여한다. 배우는 그 라운드에 공격 또는 기술을 예약한다. 상태는 자연회복하지 않고, 배우 HP는 양수다. 반대 방향(빠른 배우가 늦은 적을 멈춤)도 같은 문제가 있다.

**기대:** 상태 부여 뒤 늦은 배틀러의 차례에서 행동불가를 다시 판정하고 예약 행동을 건너뛴다. 기술 자원/아이템도 소비하지 않는다.

**실제:** actor 실행 가드는 HP만 확인한다. 기술 분기의 `battleActorSkillFailure`는 침묵·자원·쿨다운만 검사하며 일반 시전자의 행동불가는 검사하지 않는다. `prepareGen1CombatAction`도 701행 `if (!gen1) return true`로 RM 상태를 통과시킨다. enemy 가드 역시 HP/가시성만 검사하고 `executeEnemyAction`을 실행한다. 따라서 적의 `stateAdded` 뒤에 멈춘 배우의 공격/기술 피해가 발생한다. `incapacitates`도 다른 배우가 살아 있어 패배가 즉시 결정되지 않으면 동일하다.

**최소 재현:** `createBlankProject()`에서 배우1/적1/트룹1만 사용, 트룹 이벤트 제거, 배우 장비 제거, 배우 민첩10/적 민첩999, 적 HP9999. 새 상태 `state_audit_stop`을 추가하고 회복확률0. 새 스킬은 `scope:enemy`, `effect:{kind:support}`, 상태100% add, MP0, 성공/명중100. 적 행동은 이 스킬 하나. `createBattleRuntime({battleFlow:strict, party:{partyActorIds:[actor.id]},rng:()=>0.5,...})`, `performActorCommand({kind:attack,targetEnemyId:enemy-1})`; timeline의 상태부여 뒤 actor damage를 확인한다. 스킬 예약도 대조한다.

**커버 누락:** `test/battleStrictRuntime.test.ts`, `test/battleStrictRecursionSafety.test.ts`는 시작부터 상태인 경우를 검사한다. `feature16CombatHardening`은 실행 직전 쿨다운/자원 재확인만 검사한다. 중간 상태부여로 큐가 무효화되는 테스트가 없다.

**수정 제안:** strict 양쪽 실행 직전에 RM 전용 `canBattlerAct`를 재확인하고 `incapacitated`를 기록하며 skip. Gen1은 기존 pre-action major-status 경로를 유지해야 한다. forcedAction 변경 시점은 별도로 정의한다.

## R2 — [P1] gauge에서 생존자 전원이 스톱이면 자연회복하지 못하고 영구 정지

**위치:** `/home/main/.codex/worktrees/3852/rpg-zzu/src/battle/runtime.ts:943-949`; 자연회복의 유일한 경로 840-854. 보조 `/home/main/.codex/worktrees/3852/rpg-zzu/src/battle/battleTurnGauge.ts:16-19`.

**조건/입력:** gauge(wait/active 모두), 생존 배틀러 전원이 `freezesGauge` 상태. 상태는 2턴부터100% 자연 회복처럼 유한하게 끝나도록 저작되었고, 모든 `stateTurns`가 그 미만이다.

**기대:** 유한 스톱의 회복 시계가 진행되어 전투가 재개된다. 최소한 종료/탈출 가능한 경로가 있어야 한다.

**실제:** `nextReadyBattler`가 충전배율0인 전원을 제외하여 항상 undefined. `tick`은 충전배율0으로 charge하고 return한다. 스톱 상태의 upkeep는 `markGaugeActionCycle`에서만 돌지만 이 함수는 행동 슬롯을 소비한 뒤에만 호출된다. 아무도 행동할 수 없으므로 turn/stateTurns 모두 영구 고정. strictCap도 turn 기반이라 도달하지 않는다.

**최소 재현:** R1 fixture를 재사용하되 상태 회복시작2/확률100. 배우는 `party.stateIds[actor.id]=[state_audit_stop]`로 시작. 적의 스톱 기술은 `scope:self`; 적만 처음 자유롭게 행동한다. gauge runtime에서 `tick(100000)` 1회: 적이 자기 스톱을 걸고 사이클1 닫힘/양쪽 upkeep1. 다음 10회 `tick(100000)`에도 `phase:charging,turn:1,stateTurns:1`, 양쪽 스톱 유지. 실제 기본 `state_stop`(2턴부터50%) 역시 마지막 자유 배틀러까지 멈추는 조건에서 발생 가능하다.

**커버 누락:** `scripts/qa/runtime/ct-engine-numbers.mts`는 배우만 스톱이고 적이 계속 행동하는 경계만 검사한다. 전원 스톱 테스트는 없다.

**수정 제안:** 행동 가능한 생존자가0인 gauge 시간을 따로 진행시켜 상태 회복을 돌리는 제한된 upkeep cycle을 설계한다. 모든 정지 tick마다 임의로 턴을 올리면 게임속도에 따라 회복이 바뀌므로 기준 시간/사이클 계약이 필요하다.

## R3 — [P2] 광역 무작위 기술이 원래 대상 수만큼 다시 뽑히고 전원을 반복 타격

**위치:** `/home/main/.codex/worktrees/3852/rpg-zzu/src/battle/runtime.ts:2639-2647`; 호출자 1172-1180, enemy 호출자1954-1955.

**조건/입력:** wrapper `effect:{kind:randomSkillFrom,skillIds:[picked]}`, wrapper `scope:allEnemies`; picked도 `scope:allEnemies`. 살아 있는 적 N명.

**기대:** 시전당 후보 하나를 뽑고 선택한 기술의 대상 범위를 한 번 해결한다. N명을 각1회 타격한다.

**실제:** 원래 명령이 N개 대상마다 `applySkill`을 호출한다. 그 내부가 다시 무작위 선택하고 picked의 전체 대상 N개에 재귀 apply를 한다. N² 타격 및 N개의 special 기록, 자원비용은1회. 후보가 여러 개면 같은 시전 중 서로 다른 기술을 뽑기까지 한다. wrapper 범위를 좁혀도 위치 area로 대상이 여러 개가 되면 같은 문제다.

**최소 재현:** 배우 빠름/적2명 HP9999. picked는 formula `10`, 명중100/분산0/크리0/MP0/전적. wrapper 후보는 picked만/전적. strict cast wrapper 후 각 적 HP20 감소·damage4개·special2개를 확인한다(기대 각10/2개/1개). 적의 피해로 배우가 죽지 않게 한다.

**커버 누락:** `test/mgL4SpecialCommands.test.ts:126`은 적1명, 단일 enemy wrapper만 검사한다.

**수정 제안:** 무작위 기술 선택/스코프 재해결을 cast 단계로 올리고 원래 target loop 이전에 한 번만 수행한다. picked의 area, 부활 대상, 입력 배율도 같은 cast 경로에 전달한다.

## R4 — [P2] HP 비용·흡수로 변하는 시전자 수치를 예측이 반영하지 않음

**위치:** `/home/main/.codex/worktrees/3852/rpg-zzu/src/battle/battlePredict.ts:296-303`, 328-339. 실제 소비 `/home/main/.codex/worktrees/3852/rpg-zzu/src/battle/runtime.ts:1179-1180`, 2432-2437.

**조건/입력:** 신규 `hpCostPercent`, `drainPercent`와 시전자 HP/MP를 읽는 authored formula 또는 self 다단 기술의 조합.

**기대:** `predictSkillDamageFor`가 원본을 바꾸지 않는 clone에 시전 HP 비용을1회 적용하고 각 피해 hit 직후 흡수를 반영하여 다음 공식의 source 수치를 업데이트한다.

**실제:** 예측은 MP/PP/게이지 자원만 소비한다. HP비용·흡수 함수/필드는 전혀 없고 매 hit 뒤 destination 수치만 갱신한다. 실제 runtime은 HP비용 먼저, 각 hit의 피해 후 source 흡수다.

**최소 수치 재현:** (a) caster 현재/최대HP500, formula `a.hp`, hpCostPercent50, target HP9999, 1hit, 분산0/크리0: 예측500, 실제 비용250 후 피해250. (b) caster HP100/Max500, formula `a.hp`, hitSequence[1,1], drainPercent50: 예측100+100=200, 실제100 피해→50흡수→150피해로250. 배우 빠르게/적이 약하게 구성하고 timeline에서 적 대상 actor damage만 합산한다.

**영향:** 자동 전투(`battleAuto.ts:135-143`)와 새 formula가 있는 적 AI(`runtime.ts:2600`)가 이 예측을 점수로 사용하므로 실제 성능이 낮은 기술/대상을 선택한다. 표시만의 문제보다 넓다.

**커버 누락:** `test/feature16CombatHardening.test.ts`는 MP 비용, target HP/MP/상태의 hit간 변경을 검사하지만 HP비용·source 흡수는 없다. test의 `.ts` 파일에 두 필드 문자열 자체가 없다.

**수정 제안:** 실제/예측이 공유하는 순수 시전비용 및 hit후 흡수 transition을 만들어 clone 경로에도 적용한다. 표시용 timeline만 runtime에서 기록한다.

## R5 — [P2] 새 상태 방어·속성 덮어쓰기·감정을 예측/자동 전투가 무시

**위치:** `/home/main/.codex/worktrees/3852/rpg-zzu/src/battle/battlePredict.ts:319-322`; 속성 헬퍼 126-145. 실제 `/home/main/.codex/worktrees/3852/rpg-zzu/src/battle/runtime.ts:2775-2778`, 2985-2986.

**조건/입력:** RM2k3에서 protect/shell의 physicalDefenseMultiplier/magicDefenseMultiplier, state_wet/oiled의 runtimeEffects.elementRates, 또는 emotionCycle이 적용된 배틀러에 대한 기술.

**기대:** 예측은 variance/critical/miss만 제외하고 현재 상태를 반영한다. 자동 전투도 현재 약점/내성을 근거로 선택한다.

**실제:** 예측은 공용 `defenseMultiplierForStates`만 곱하고 계열별 방어를 빼먹는다. 속성 계산은 레코드 elementRates만 읽고 target.stateIds의 override를 읽지 않는다. emotionDamageMultiplier도 사용하지 않는다. runtime은 모두 반영한다. guaranteed stateEffects로 다단 첫 타격이 젖음/기름을 걸어도 예측의 다음 hit는 여전히 이전 레코드 등급이다.

**최소 수치 재현:** element damageMultipliers A200/C100, 적 record 등급C. 신규 상태 runtimeEffects.elementRates[el]=A. 아군 skill formula `100`, element el, stateEffects=[해당 상태 add100], hitSequence[1,1], crit0/variance0, 적 HP9999. 시작에 상태가 없으면 실제100+200=300, 예측100+100=200. 처음부터 상태가 있으면 실제400/예측200. 비교를 위한 상태 저항은100으로 지정. 프로텍트는 target defense20·배율2.5, base 위력100/actor stat0에서 예측90/실제75로 독립 대조 가능하다.

**커버 누락:** Chrono 숫자 QA는 실제 피해끼리만 비교한다. `feature16CombatHardening`의 hit간 상태 예측은 공용 defenseMultiplier만 검사한다.

**수정 제안:** 속성/감정/계열별 방어 판정의 순수 헬퍼를 runtime과 predict가 함께 쓰도록 옮긴다. clone에서 변경된 stateIds를 속성 헬퍼에 전달한다. Gen1 exact 경로의 기존 상태 계약은 별도 유지한다.

## 오탐 제거 및 제한

- randomSkillFrom의 무한 재귀는 `pickRandomSkill`이 random 후보를 제외하므로 버그로 보고하지 않음.
- 모든 수면 상태를 전멸 패배로 보는 것은 사양이 아니다. `incapacitates`만 전멸 판정하며 R1/R2는 이 구별을 반영한다.
- HP 비용은1 밑으로 내려가지 않는다고 명시돼 있어 현재HP보다 높은 비용의 기술 사용을 허용하는 자체는 버그로 판단하지 않았다.
- 초과 피해를 drain으로 흡수하는 양은 rolled damage 표기 정책과 연관돼 사양 확인이 필요하여 확정에서 제외했다.
- hidden/captured 적의 보상 제외, strict/gauge rewardTurn, 전투종료 상태정리 이전 reward condition은 소스상 기존 계약을 충족한다.
- enemy revival과 자동 전투 revival은 대상 해결에서 죽은 동료를 빼지만 적/자동 revival 지원범위의 별도 사양이 없어 이번 확정5건 밖에 두었다.


## 감독자 최종 재현 판정

최종 기준은 `docs/2026-09-30-battle-adversarial-review.md`와 `rules-probe.json`, `interactions/interactions.json`이다. 2026-09-30 추가 상호작용 5개 모두 reproduced=true/errors0. combo 재실행도 ATB57→100 비활성 유지, 재개방 활성으로 확인됐다. 리뷰 원문의 source-only/needs-runtime-repro 표현은 해당 검토자가 작성한 시점의 범위이며, 후속 감독자 재현은 종합 보고서에 반영했다.
