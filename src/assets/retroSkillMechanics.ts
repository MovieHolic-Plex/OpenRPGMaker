// retro2003 직업 스킬의 **기믹 칸** — RetroClassSkill.mechanic 의 어휘와 직업 설계 규칙.
//
// 이 파일만 읽고 묶음(src/assets/retroRosterSkills/<묶음>.ts)의 mechanic 을 채울 수 있게 쓴다.
// mechanic 이 있으면 기본 DB 레코드(src/project/defaults/retroRosterRecords.ts)는 **이 칸이 우선**이고,
// 적지 않은 필드만 설명 낱말 유도(deriveRosterSkillSeed: 위력·MP·속성·대상·연출)로 채운다. mechanic 이 없으면 유도만 쓴다.
// 이펙트 레이어·motion·id·level 은 그림과 맞물려 있으니 기믹 때문에 바꾸지 않는다.
//
// ── 어휘 (전부 선택) ─────────────────────────────────────────────────────────────────────────────
//   kind      damage(기본) · healing · support(피해 없이 상태만) · steal · scan. 유도와 다를 때만 적는다.
//   stat      damage 의 능력치 attack(공격력·물리 방어로 경감) | mind(정신력·마법 방어로 경감). healing 은 언제나 mind.
//   affects   hp(기본) | mp. damage+mp = MP 를 깎는다(drain 이면 MP 흡수), healing+mp = MP 회복.
//   scope     enemy · allEnemies · ally · allAllies · self. 레이어 앵커(allTargets=전체)와 어긋나게 바꾸지 않는다.
//   power     위력 덮어쓰기(생략 = 레벨 곡선). healing 으로 바꾸면 반드시 적는다.
//   mp        MP 소모 덮어쓰기.
//   hits      다단 배율 목록. [0.4, 0.4, 0.4] = 위력 40% 로 세 번. 합이 1.2~1.5 면 단타와 비슷한 총량이다.
//             회마다 명중·치명·상태 판정을 따로 한다 — 첫 타에 건 약점(기름·젖음)이 다음 타에 먹는다.
//   area      circle | line. 단일 대상 기술이 주 대상 둘레(원)나 같은 가로줄(직선)의 적도 맞힌다.
//   formula   피해 수식(방어를 이미 포함한 값으로 본다 — 방어 경감 없음). 변수 power a.atk a.def a.mind a.agi a.hp a.mp a.level
//             b.* (a=시전자, b=대상, hp 는 **현재** HP). 예: 그래비티 "b.hp / 2", 암흑검 "power / 2 + a.hp / 2".
//   hpCost    시전 대가 — 시전자 최대 HP 의 N% 를 잃는다(1 밑으로는 안 깎음). 화면에 대가 숫자가 뜬다.
//   drain     흡수 — 준 피해의 N% 를 시전자가 회복(affects mp 면 MP). 화면에 회복 숫자가 뜬다.
//   states    상태 부여/해제 목록 { id, chance?(기본 100), op?("add" 기본 | "remove") }. 적으면 유도 상태를 **대체**한다([] = 없음).
//   revive    true 면 전투불능 해제(state_death remove)를 붙인다 — 부활.
//   element   속성 id(sword spear hit bow fire ice thunder water earth wind holy dark). null = 무속성으로 강제.
//   crit      치명 확률 %.   hitRate  명중 %.   priority  기술 우선도 -7~7(strict 턴제에서만 순서를 바꾼다).
//   cooldown  사용 뒤 못 쓰는 라운드 수.
//
// 기본 DB 상태(쓸 수 있는 id): state_poison 독 · state_deep_poison 맹독(출혈) ·
//   state_sleep 수면 · state_paralysis 마비 · state_silence 침묵 · state_blind 암흑(통상 공격 명중 ½) ·
//   state_stop 스톱(게이지 정지·행동 불가, 짧다) · state_petrify 석화(전투 불능 취급) · state_berserk 버서크(무작위 통상 공격, 공 1.5배) ·
//   state_attack_up/down · state_defense_up/down · state_agility_up(헤이스트)/down(슬로우) · state_protect 프로텍트(물리 경감) ·
//   state_shell 실드(마법 경감) · state_regen 재생 · state_wet 젖음(번개 약점) · state_oiled 기름(불 약점) · state_death 전투불능.
//   자동 부활은 엔진에 없다. 화상·빙결(state_burn/freeze)은 포켓몬 데모 DB 에만 있다 — 기본 DB 에 없는 id 를 쓰면 프로젝트 검증이
//   「stateId does not exist」로 player 부팅을 막는다.
//
// ── 직업 설계 규칙 ───────────────────────────────────────────────────────────────────────────────
//   1. 직업당 8개 중 **순수 1타 데미지는 최대 2개**. 서로 다른 기믹 최소 4종(다단·범위 모양·비율 수식·대가·흡수·시간·
//      방어막·상태·약점 만들기·해제·부활·훔치기 중).
//   2. 필살기(level 22)는 다단, 또는 대가/특수 효과(정지·약점 연계·비율 피해)를 갖는다.
//   3. **이름이 약속한 효과를 반드시 한다**: 슬로우→state_agility_down, 헤이스트→state_agility_up, 그래비티→비율 수식,
//      스톱→state_stop, 연막→state_blind, 대가/피→hpCost, 흡수/이터→drain, N번 베기→hits N개, 꿰뚫기·직선→area line.
//      효과와 설명이 어긋나면 설명 한 줄을 고친다.
//   4. 직업 정체성: 암흑기사=HP 대가·흡수·현재 HP 비례 · 시공술사=헤이스트·슬로우·스톱·그래비티 · 도적=다단·훔치기·암흑·독 ·
//      성기사=프로텍트·실드·부활·신성 · 적마도사=두 번 치기·해제·MP 전환·약점 만들기 · 발키리=직선·강하·다단 ·
//      야수조련사=소환 다단·출혈(맹독)·위압. 새 직업도 이런 정체성 한 줄을 먼저 정하고 8개를 거기에 맞춘다.

export type RetroSkillMechanicKind = "damage" | "healing" | "support" | "steal" | "scan";
export type RetroSkillMechanicScope = "self" | "ally" | "allAllies" | "enemy" | "allEnemies";

export interface RetroSkillMechanicState {
  readonly id: string;
  readonly chance?: number;
  readonly op?: "add" | "remove";
}

export interface RetroSkillMechanic {
  readonly kind?: RetroSkillMechanicKind;
  readonly stat?: "attack" | "mind";
  readonly affects?: "hp" | "mp";
  readonly scope?: RetroSkillMechanicScope;
  readonly power?: number;
  readonly mp?: number;
  readonly hits?: readonly number[];
  readonly area?: "circle" | "line";
  readonly formula?: string;
  readonly hpCost?: number;
  readonly drain?: number;
  readonly states?: readonly RetroSkillMechanicState[];
  readonly revive?: boolean;
  readonly element?: string | null;
  readonly crit?: number;
  readonly hitRate?: number;
  readonly priority?: number;
  readonly cooldown?: number;
}

/** area 모양별 반지름(전투장 논리 px). circle 은 주 대상 둘레, line 은 |dy| <= radius/2 인 가로 띠. */
export const RETRO_MECHANIC_AREA_RADIUS: Readonly<Record<"circle" | "line", number>> = { circle: 120, line: 96 };

/** 기믹 한 줄 요약(표·편집기 미리보기용). 순수 1타 데미지면 "순수 데미지". */
export function describeRetroSkillMechanic(mechanic: RetroSkillMechanic | undefined): string {
  if (!mechanic) return "유도(기믹 칸 없음)";
  const parts: string[] = [];
  if (mechanic.kind && mechanic.kind !== "damage") parts.push(mechanic.kind);
  if (mechanic.hits && mechanic.hits.length > 1) parts.push(`${mechanic.hits.length}연타`);
  if (mechanic.area) parts.push(mechanic.area === "line" ? "직선" : "원형");
  if (mechanic.formula) parts.push(`수식 ${mechanic.formula}`);
  if (mechanic.hpCost) parts.push(`HP 대가 ${mechanic.hpCost}%`);
  if (mechanic.drain) parts.push(`${mechanic.affects === "mp" ? "MP" : "HP"} 흡수 ${mechanic.drain}%`);
  if (mechanic.revive) parts.push("부활");
  for (const state of mechanic.states ?? []) parts.push(`${state.op === "remove" ? "−" : "+"}${state.id.replace(/^state_/, "")}${state.chance !== undefined && state.chance < 100 ? ` ${state.chance}%` : ""}`);
  if (mechanic.crit) parts.push(`치명 ${mechanic.crit}%`);
  if (mechanic.priority) parts.push(`우선 ${mechanic.priority > 0 ? "+" : ""}${mechanic.priority}`);
  if (mechanic.cooldown) parts.push(`대기 ${mechanic.cooldown}턴`);
  if (mechanic.element === null) parts.push("무속성");
  else if (mechanic.element) parts.push(`속성 ${mechanic.element}`);
  return parts.length > 0 ? parts.join(" · ") : "순수 데미지";
}
