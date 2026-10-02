// retro2003 직업 스킬의 **기믹 칸** — RetroClassSkill.mechanic 의 어휘와 직업 설계 규칙.
// 어휘·설계 규칙의 정본은 아래 RETRO_SKILL_DESIGN_GUIDE 하나다. 묶음(src/assets/retroRosterSkills/<묶음>.ts)을 쓰는 사람도,
// 편집기 조수의 read_retro_skill_guide 도구도 같은 문자열을 읽는다(복사본 없음). 규칙을 고칠 땐 이 문자열만 고친다.

export const RETRO_SKILL_DESIGN_GUIDE = `retro2003 스킬의 기믹 어휘와 설계 규칙. 묶음 파일(src/assets/retroRosterSkills/<묶음>.ts)의 mechanic 칸을 채울 때도,
편집기 조수가 upsert_skill 로 스킬을 만들 때도 같은 어휘를 쓴다.

공용 동작 32종(2026-10-02): list_retro_choreographies에서 chor_builtin_*를 찾는다.
기존 도트 연출을 duplicate_choreography로 복제한 뒤 upsert_choreography의 movement를 고친다.
movement: {pattern, anticipationMs, travelMs, recoveryMs, jumpHeight, apexMs, acceleration}.
직접 경로는 tracks: [{role:user|target|ally|cloneA|cloneB|summon, points:[{at,anchor,x,y,curve,pose,alpha,flip}]}].
at은 ms, x/y는 자리 기준 px. 자리: home/front/target/target2/target3/ally/left/right/top.
곡선: linear/pull/burst/walk/rise/fall/settle/flow. 이동은 미리보기와 실제 전투가 같은 함수로 계산한다.
규칙은 upsert_skill의 battleGimmick: {pattern,durationTurns,markKey,maxStacks,consumeMarks,requiredMark,followOnHit,
allyActorId,elementId,resourceId,radius,triggerChance,powerMultiplier,killRefundPercent}에 따로 기록한다.
안무만 빌리면 효과는 바뀌지 않는다. 기본 예시는 skill_motion_* 32종에 있다.
설치는 대상의 다음 차례, 소환 지원은 시전자의 다음 자기 차례. 지속 시간은 자기 차례 수(1~6).
소환은 시전자가 피해를 받으면 취소한다. 반격은 물리 명중 뒤 한 번, 엄호는 다음 단일 물리 공격 한 번.
흡수는 정신력 계열 피해 중 elementId가 맞는 것만 저장한다(생략하면 모든 마법 속성). 다음 사용에 저장량을 방출.
표식 없는 orbit, 첫 빗나감 뒤 air-chase/throw/relay/sky-crush의 후속 공격은 취소된다.
swap은 실제 예비 배우가 있어야 교대한다. relay는 행동 가능한 준비된 동료의 MP와 차례도 소비한다.
처치 환급은 실제로 쓰러뜨렸을 때만. HP 대가는 기존 hpCostPercent로 먼저 지불하며 빗나가도 돌려주지 않는다.
새 스킬은 효과·타수·비용·기믹과 연출을 함께 저작한다. 지속·연계 피해 총합에 맞춰 MP와 재사용 대기를 조정한다.

묶음에서는 mechanic 이 있으면 기본 DB 레코드(src/project/defaults/retroRosterRecords.ts)가 **이 칸을 우선**하고,
적지 않은 필드만 설명 낱말 유도(deriveRosterSkillSeed: 위력·MP·속성·대상·연출)로 채운다. mechanic 이 없으면 유도만 쓴다.
이펙트 레이어·motion·id·level 은 그림과 맞물려 있으니 기믹 때문에 바꾸지 않는다.

── 어휘 (전부 선택) ─────────────────────────────────────────────────────────────────────────────
  kind      damage(기본) · healing · support(피해 없이 상태만) · steal · scan. 유도와 다를 때만 적는다.
  stat      damage 의 능력치 attack(공격력·물리 방어로 경감) | mind(정신력·마법 방어로 경감). healing 은 언제나 mind.
  affects   hp(기본) | mp. damage+mp = MP 를 깎는다(drain 이면 MP 흡수), healing+mp = MP 회복.
  scope     enemy · allEnemies · ally · allAllies · self. 레이어 앵커(allTargets=전체)와 어긋나게 바꾸지 않는다.
  power     위력 덮어쓰기(생략 = 레벨 곡선). healing 으로 바꾸면 반드시 적는다.
  mp        MP 소모 덮어쓰기.
  hits      다단 배율 목록. [0.4, 0.4, 0.4] = 위력 40% 로 세 번. 합이 1.2~1.5 면 단타와 비슷한 총량이다.
            회마다 명중·치명·상태 판정을 따로 한다 — 첫 타에 건 약점(기름·젖음)이 다음 타에 먹는다.
  area      circle | line. 단일 대상 기술이 주 대상 둘레(원)나 같은 가로줄(직선)의 적도 맞힌다.
  formula   피해 수식(방어를 이미 포함한 값으로 본다 — 방어 경감 없음). 변수 power a.atk a.def a.mind a.agi a.hp a.mp a.level
            b.* (a=시전자, b=대상, hp 는 **현재** HP). 예: 그래비티 "b.hp / 2", 암흑검 "power / 2 + a.hp / 2".
  hpCost    시전 대가 — 시전자 최대 HP 의 N% 를 잃는다(1 밑으로는 안 깎음). 화면에 대가 숫자가 뜬다.
  drain     흡수 — 준 피해의 N% 를 시전자가 회복(affects mp 면 MP). 화면에 회복 숫자가 뜬다.
  states    상태 부여/해제 목록 { id, chance?(기본 100), op?("add" 기본 | "remove") }. 적으면 유도 상태를 **대체**한다([] = 없음).
  revive    true 면 전투불능 해제(state_death remove)를 붙인다 — 부활.
  element   속성 id(sword spear hit bow fire ice thunder water earth wind holy dark). null = 무속성으로 강제.
  crit      치명 확률 %.   hitRate  명중 %.   priority  기술 우선도 -7~7(strict 턴제에서만 순서를 바꾼다).
  cooldown  사용 뒤 못 쓰는 라운드 수.
  gauge     게이지 밀기 -100~100. 맞은 대상의 ATB 게이지를 옮긴다 — 음수 = 늦추기(시간 화살·발 묶기), 양수 = 아군 퀵(재촉·신호).
            타마다 적용하고 대상당 「행동이 늦춰졌다/빨라졌다」 한 줄. ATB(gauge) 흐름 전용, strict 턴제에서는 무시.
  charge    힘 모으기 1~3. 정한 차례엔 「…을 준비한다! (N턴 뒤)」 예고만 하고 자기 차례가 N 번 더 오면 발동한다. 몸이 금빛으로
            떨리고 머리 위에 「기술 · 남은 차례」 띠가 뜬다. 한 차례를 버리므로 위력을 1.6~1.8배로 올려 준다(「모아」「숨을 모아」 기술).
            적이 쓰면 보스 대기술 예고가 된다.
  summon    소환 그림: 파티원 도트 시트 칩(예 "monster2-4" 흙 골렘, "monster3-6" 업화). 시전자 앞에 번쩍 나타나 대상에게 달려가
            첫 타에 맞춰 친다. 그림만이다 — 위력·타수·상태는 이 칸들 그대로. 「불러내」「소환진」 기술에 쓰고 시전자 motion 은 cast.

기본 DB 상태(쓸 수 있는 id): state_poison 독 · state_deep_poison 맹독(출혈) ·
  state_sleep 수면 · state_paralysis 마비 · state_silence 침묵 · state_blind 암흑(통상 공격 명중 ½) ·
  state_stop 스톱(게이지 정지·행동 불가, 짧다) · state_petrify 석화(전투 불능 취급) · state_berserk 버서크(무작위 통상 공격, 공 1.5배) ·
  state_attack_up/down · state_defense_up/down · state_agility_up(헤이스트)/down(슬로우) · state_protect 프로텍트(물리 경감) ·
  state_shell 실드(마법 경감) · state_regen 재생 · state_wet 젖음(번개 약점) · state_oiled 기름(불 약점) · state_death 전투불능(**해제=부활만** — add 로 거는 즉사는 엔진이 무시한다).
  반응·표적(자신·아군에 거는 것): state_counter 반격(물리에 맞으면 60% 통상 반격) · state_taunt 도발(적이 먼저 노린다, 방어 1.2배) ·
  state_cover 감싸기(빈사 아군 대신 물리를 맞는다) · state_evade 회피(물리 명중 -40%, 잔상·분신) ·
  state_reflect 리플렉(단일 마법을 시전자에게 튕긴다) · state_reraise 리레이즈(쓰러지면 HP 25% 로 한 번 부활, 아군만).
  변신: state_form_stone 바위 둔갑(그림이 이끼 골렘으로, 방어 1.8배·민첩 0.7배). 새 변신은 상태의 runtimeEffects.transformResourceId 에
  "party-pixel-<칩>" 을 넣고 배율 칸으로 능력치를 바꾼다(update_state).
  적에게 거는 것: state_doom 선고(자기 차례 3번 뒤 전투 불능 — **즉사는 이것**. 강하므로 chance 낮게, 정화로 풀린다).
  화상·빙결(state_burn/freeze)은 포켓몬 데모 DB 에만 있다 — 기본 DB 에 없는 id 를 쓰면 프로젝트 검증이
  「stateId does not exist」로 player 부팅을 막는다.

── 직업 설계 규칙 ───────────────────────────────────────────────────────────────────────────────
  1. 직업당 8개 중 **순수 1타 데미지는 최대 2개**. 서로 다른 기믹 최소 4종(다단·범위 모양·비율 수식·대가·흡수·시간·
     방어막·상태·약점 만들기·해제·부활·훔치기 중).
  2. 필살기(level 22)는 다단, 또는 대가/특수 효과(정지·약점 연계·비율 피해)를 갖는다.
  3. **이름이 약속한 효과를 반드시 한다**: 슬로우→state_agility_down, 헤이스트→state_agility_up, 그래비티→비율 수식,
     스톱→state_stop, 연막→state_blind, 대가/피→hpCost, 흡수/이터→drain, N번 베기→hits N개, 꿰뚫기·직선→area line,
     반격→state_counter, 도발→state_taunt(자신), 감싸기·수호→state_cover, 잔상·분신·회피→state_evade, 리플렉·반사→state_reflect,
     불사·리레이즈→state_reraise, 선고·사형·즉사→state_doom.
     효과와 설명이 어긋나면 설명 한 줄을 고친다.
  4. 직업 정체성: 암흑기사=HP 대가·흡수·현재 HP 비례 · 시공술사=헤이스트·슬로우·스톱·그래비티·게이지 밀기 · 도적=다단·훔치기·암흑·독 ·
     성기사=프로텍트·실드·부활·신성 · 적마도사=두 번 치기·해제·MP 전환·약점 만들기 · 발키리=직선·강하·다단 ·
     야수조련사=소환 다단·출혈(맹독)·위압. 새 직업도 이런 정체성 한 줄을 먼저 정하고 8개를 거기에 맞춘다.

── 조수(편집기 AI)가 새 스킬을 만들 때 ─────────────────────────────────────────────────────────
  순서: (1) 직업 정체성 한 줄을 정한다. (2) 8개의 기믹 배분표를 먼저 쓴다(위 규칙 1~2). (3) 스킬마다 list_retro_choreographies 로
  어울리는 연출을 찾는다(motion·element·anchor·family·query 로 좁힌다). (4) upsert_skill 로 만든다.
  **새 스킬은 retroChoreographyId 로 연출을 빌린다** — 자기 id 의 연출이 없으면 기본 베기/불꽃으로 보이므로, 빌릴 계약 id 를
  넣는다. 연출의 앵커가 기믹의 대상과 맞아야 한다: allTargets 연출 = scope allEnemies, allAllies 연출 = scope allAllies,
  user 만 있는 연출 = self 계열 buff. 다단 기술은 flurry/finisher 연출을 빌리고 hits 개수를 그림의 타수에 맞춘다.
  upsert_skill 필드 ↔ 어휘: hits=hitSequence(배율 배열, 최대 16) · formula=damageFormula · hpCost=hpCostPercent · drain=drainPercent ·
  states=stateEffects [{stateId, chance, operation:"add"|"remove"}] · area={shape,radius}(circle 120 / line 96 이 묶음 기본) ·
  crit=criticalRate · priority=movePriority · cooldown=cooldownTurns · element=elementId · mp=mpCost{flat,percentMax} ·
  kind/stat/affects=effect{kind,statistic,affects} · scope=scope · power=power · revive=stateEffects 에 state_death remove.
  상태를 새로 만들어야 하면(스톱·버서크·프로텍트·실드·속성 배율은 upsert_state 로 이미 저작 가능) 기본 상태 id 를 먼저 재사용한다.

── 연출 조립(빌릴 연출이 딱 맞지 않을 때) ─────────────────────────────────────────────────────
  기본 연출은 읽기 전용이다. 고르는 순서: (a) list_retro_choreographies 로 그대로 쓸 만한 것이 있으면 retroChoreographyId 로 빌린다.
  (b) 거의 맞으면 duplicate_choreography(sourceId)로 프로젝트 사본 chor_* 을 만들고 upsert_choreography(id, layers)로 층만 고친다.
  (c) 아예 새로 짜려면 list_fx_sheets(query)로 시트를 고르고 upsert_choreography(name, motion, layers)로 조립한다. 그 뒤 upsert_skill 의
  retroChoreographyId 에 chor_ id 를 넣는다.
  층 = {sheet, anchor} + 선택 옵션. startMs=늦게 시작(임팩트를 동작 뒤에) · scale=크게(광역·필살) · repeat=연달아 · onHit:"each"=다단 스킬에서
  타마다 이 층이 터짐(기본은 첫 타에 한 번). 동작(motion) 하나에 층 2~4개가 알맞다: 본 타격 1 + 속성 임팩트 1 + 잔상·화면 1.
  motion 은 직업 동작(dash-strike leap-strike blink-strike flurry spin cast shoot buff finisher)과 몬스터 동작(lunge breath stomp)을 쓴다.
  anchor 는 기믹의 대상과 맞춘다(allTargets 층 = scope allEnemies). 없는 시트 키는 거부되고 비슷한 후보가 나온다. 데미지·타수는 스킬의
  hitSequence 가 정하고 연출은 그림만 정한다 — 3타 스킬은 hits 3개 + 층 onHit:"each".

── 설계 예시(크로노 트리거·FF 풍) ─────────────────────────────────────────────────────────────
  화염 검투사(정체성: 불꽃을 두르고 대가를 치르며 싸운다)
    불꽃 베기      순수 1타(fire)                    연출 dash-strike 계열, fire
    화염 삼연격    hits [0.4,0.4,0.4], 기름 부여      flurry 계열  ── 다단 + state_oiled 로 다음 불 기술의 약점을 만든다
    불사의 서약    scope self, hpCost 20, state_attack_up  buff 계열 ── 대가를 치르고 강화
    피의 잔  drain 40, hpCost 10                      단일 흡수 + 대가
    작열 파도      area line(직선) 또는 scope allEnemies, fire   광역
    도발의 함성    scope self, state_taunt  이름이 약속한 효과(적이 이 검투사를 먼저 노린다)
    분노의 일격    formula "power / 2 + a.hp / 2"     암흑검식 현재 HP 비례
    폭염 낙하(필살, level 22)  hits [0.5,0.5,0.5,0.5] + hpCost 15 + 기름 연계   finisher 연출
  크로노 트리거식 연계: 젖음(state_wet)을 거는 물 기술 뒤에 번개 기술을 이어 약점을 찌른다. FF식: 슬로우/헤이스트/스톱은 시간 계열
  직업의 정체성이고, 스톱은 짧게(강력하므로 낮은 chance), 그래비티는 formula "b.hp / 2" 처럼 비율 피해로 보스에게 통한다.`;

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
  /** 게이지 밀기 -100~100(SkillRecord.gaugeShift). */
  readonly gauge?: number;
  /** 힘 모으기 1~3(SkillRecord.chargeTurns). */
  readonly charge?: number;
  /** 소환 그림 칩(파티원 도트 시트, SkillRecord.summonResourceId = "party-pixel-<칩>"). */
  readonly summon?: string;
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
  if (mechanic.gauge) parts.push(mechanic.gauge < 0 ? `게이지 ${mechanic.gauge}` : `게이지 +${mechanic.gauge}`);
  if (mechanic.charge) parts.push(`모으기 ${mechanic.charge}턴`);
  if (mechanic.summon) parts.push(`소환 ${mechanic.summon}`);
  if (mechanic.element === null) parts.push("무속성");
  else if (mechanic.element) parts.push(`속성 ${mechanic.element}`);
  return parts.length > 0 ? parts.join(" · ") : "순수 데미지";
}
