/**
 * 『여덟째 자리』 결투 — 렌의 주문 아홉, 상대 다섯, 트룹 다섯.
 *
 * 결투는 퍼즐이다: 상대마다 「이것을 읽어야 이긴다」 하나가 있다(설계서 3.5).
 *  1 연습 갑옷   — 두 라운드마다 「내려치기」를 모은다(예고 띠). 방벽으로 받거나, 모으는 동안 피해 18 이상을 넣어 끊는다.
 *  2 세라        — 첫 라운드 「반사막」(단일 마법을 튕긴다). 찌르기는 통과하지만 받아치기 태세에 걸린다. 갈래 번개(범위)·걷어내기로 푼다.
 *  3 도윈        — 「연쇄 화염」을 두 라운드 모은다. 얼음에 끊긴다. 자주 방벽을 친다 → 걷어내기.
 *  4 파수 기계   — 「종 울림」 한 라운드 모아 전체 피해. 번개에 끊기고 번개에 약하다(맞혀 보면 안다). 손님 동료가 돕는다.
 *  5 세라 결정전 — 2의 도구 전부 + 「봉인 주문」. 체력이 반 아래로 내려가면 손이 떨린다(명중 하락).
 *
 * 결투는 보상(경험치·돈)이 없다. 항복은 상대 체력 25% 아래에서 전투 이벤트가 「전투 중단」으로 처리한다 —
 * G2(TroopRecord.duel) 가 main 에 들어오면 그 규칙으로 바꾼다(ES_DUEL_SEAM).
 */
import type { ActorRateGrade, ActorRecord, EnemyActionPattern, EnemyRecord, Project, SkillRecord, StateRecord, TroopRecord } from "@/project/types";

export const ES_HERO = "actor_hero";
export const ES_GUEST_SERA = "actor_es_sera";
export const ES_GUEST_TEO = "actor_es_teo";

export const SK = {
  ember: "skill_es_ember", ward: "skill_es_ward", riposte: "skill_es_riposte", frost: "skill_es_frost_chain", read: "skill_es_read",
  fork: "skill_es_fork_lightning", strip: "skill_es_strip", still: "skill_es_stillness", wrist: "skill_es_wrist",
  // 상대 기술
  armorSlam: "skill_es_armor_slam", armorSwing: "skill_es_armor_swing",
  seraMirror: "skill_es_sera_mirror", seraStance: "skill_es_sera_stance", seraBolt: "skill_es_sera_bolt", seraSeal: "skill_es_sera_seal",
  dowinFire: "skill_es_dowin_chainfire", dowinWard: "skill_es_dowin_ward", dowinBolt: "skill_es_dowin_bolt",
  bell: "skill_es_bell_toll", gearArm: "skill_es_gear_arm",
} as const;

export const ST = {
  ward: "state_es_ward", stance: "state_es_stance", mirror: "state_es_mirror", slow: "state_es_slow", open: "state_es_open",
  tremor: "state_es_tremor", seal: "state_es_seal", focus: "state_es_focus",
} as const;

export const EN = {
  armor: "enemy_es_practice_armor", sera: "enemy_es_sera", dowin: "enemy_es_dowin", warden: "enemy_es_warden", seraFinal: "enemy_es_sera_final",
} as const;

export const TR = {
  armor: "troop_es_duel1_armor", sera: "troop_es_duel2_sera", dowin: "troop_es_duel3_dowin", warden: "troop_es_duel4_warden", final: "troop_es_duel5_final",
} as const;

/** 렌이 수업에서 배우는 주문 — 결투 전 장착 화면에서 넷을 고른다. */
export const ES_LEARNABLE = [SK.ember, SK.ward, SK.riposte, SK.frost, SK.read, SK.fork, SK.strip, SK.still] as const;

/** 결투 보상 없음 — 지거나 이겨도 반복할 이유가 없다. */
const NO_REWARD = { exp: 0, gold: 0, dropRatePercent: 0 };

function upsert<T extends { id: string }>(list: T[], record: T): void {
  const at = list.findIndex((r) => r.id === record.id);
  if (at >= 0) list[at] = record; else list.push(record);
}

const act = (skillId: string, priority: number, condition: Record<string, unknown> = { kind: "always" }): EnemyActionPattern =>
  ({ skillId, priority, condition, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }) as unknown as EnemyActionPattern;

function skill(id: string, f: Partial<SkillRecord> & Pick<SkillRecord, "name" | "scope" | "description" | "effect">): SkillRecord {
  return {
    id, power: 0, type: "normal", mpCost: { flat: 0, percentMax: 0 }, successRate: 100, variance: 8, hitRate: 100, criticalRate: 0, stateEffects: [],
    ...f,
  } as SkillRecord;
}

function state(id: string, name: string, turns: number, effects: Record<string, unknown>, extra: Partial<StateRecord> = {}): StateRecord {
  return {
    id, name, restriction: "없음", removalCondition: "전투 종료", recoverNaturallyFromTurn: turns, recoverNaturallyChance: 100,
    runtimeEffects: { removeOnBattleEnd: true, maxTurns: turns, ...effects }, ...extra,
  } as unknown as StateRecord;
}

const NEUTRAL_RATES: Record<string, ActorRateGrade> = { sword: "C", spear: "C", hit: "C", bow: "C", fire: "C", ice: "C", thunder: "C", water: "C", earth: "C", wind: "C", holy: "C", dark: "C" };

function enemy(id: string, f: Partial<EnemyRecord> & Pick<EnemyRecord, "name" | "stats" | "actions" | "skillIds">): EnemyRecord {
  return {
    id, graphicHue: 0, transparent: false, flying: false, criticalHit: { enabled: false, oneIn: 30 }, attackOptions: { normalAttacksMiss: false },
    rewards: NO_REWARD, stateRates: {}, elementRates: { ...NEUTRAL_RATES }, collapseEffect: "flash",
    ...f,
  } as unknown as EnemyRecord;
}

const say = (body: string, speaker?: string) => ({ kind: "text", body, ...(speaker ? { speaker } : {}), position: "bottom" });

/**
 * 항복 — 상대 체력이 문턱 아래로 떨어지면 무릎을 꿇고 결투가 끝난다(승리로 센다).
 * ES_DUEL_SEAM: 지금은 전투 이벤트(enemyHpBelow → 대사 → 스위치 → 「전투 중단」)로 하고, 결과는 escape 로 돌아온다.
 * 그래서 이 데모의 결투 분기는 escape 를 「상대 항복」으로, victory 를 「상대가 쓰러짐」으로 같이 받는다(둘 다 승리).
 */
function yieldPage(enemyId: string, percent: number, line: string, speaker: string, winSwitch: string) {
  return {
    id: `${enemyId}_yield`, name: "항복", span: "battle", runOnce: true,
    conditions: [{ kind: "enemyHpBelow", enemyId, percent }],
    commands: [say(line, speaker), { kind: "setSwitch", switchId: winSwitch, value: true }, { kind: "m2Command", commandId: "m2-105-abort-battle", fields: {} }],
  };
}

export const SW_DUEL_WON = "sw_es_duel_won";

export function buildEighthSeatBattle(project: Project): void {
  const db = project.database;
  project.system.battleFlow = "strict";
  (project.system as { battleBackdrop?: "field" }).battleBackdrop = "field";
  (project.system as { allowAutoBattle?: boolean }).allowAutoBattle = false;

  // ── 상태 ──
  for (const s of [
    state(ST.ward, "방벽", 2, { physicalDefenseMultiplier: 2, magicDefenseMultiplier: 2 }, { battleAura: "shield-shimmer" } as Partial<StateRecord>),
    state(ST.stance, "받아치기 태세", 1, { counterChance: 100 }),
    state(ST.mirror, "반사막", 3, { reflect: true }, { battleAura: "shield-shimmer" } as Partial<StateRecord>),
    state(ST.slow, "둔화", 2, { agilityMultiplier: 0.4 }),
    state(ST.open, "빈틈", 1, { physicalDefenseMultiplier: 0.6, magicDefenseMultiplier: 0.6 }),
    state(ST.tremor, "손떨림", 9, {}, { accuracyModifier: 60 } as Partial<StateRecord>),
    state(ST.seal, "봉인", 1, { blocksSkillUse: true }),
    state(ST.focus, "집중", 9, { hpHealPercentPerTurn: 0, attackMultiplier: 1.15 }),
  ]) upsert(db.states as StateRecord[], s);

  const strip = [ST.ward, ST.mirror, ST.stance].map((stateId) => ({ stateId, chance: 100, operation: "remove" as const }));

  // ── 렌의 주문 ──
  for (const s of [
    skill(SK.ember, { name: "불씨 화살", scope: "enemy", power: 22, elementId: "fire", animationId: "anim_gen_fire_burst", mpCost: { flat: 4, percentMax: 0 },
      description: "불, 한 명. 단일 마법이라 반사막에 튕긴다.", effect: { kind: "damage", statistic: "mind", affects: "hp" } }),
    skill(SK.ward, { name: "방벽", scope: "self", animationId: "anim_gen_guard_barrier", mpCost: { flat: 3, percentMax: 0 },
      description: "두 라운드 동안 받는 피해를 절반으로.", effect: { kind: "support" }, stateEffects: [{ stateId: ST.ward, chance: 100, operation: "add" }], movePriority: 1 } as Partial<SkillRecord> as SkillRecord),
    skill(SK.riposte, { name: "받아치기", scope: "self", animationId: "anim_gen_power_aura", mpCost: { flat: 3, percentMax: 0 },
      description: "한 라운드 태세. 그동안 날아온 물리 공격을 되받는다.", effect: { kind: "support" }, stateEffects: [{ stateId: ST.stance, chance: 100, operation: "add" }], movePriority: 1 } as Partial<SkillRecord> as SkillRecord),
    skill(SK.frost, { name: "서리 사슬", scope: "enemy", power: 14, elementId: "ice", animationId: "anim_gen_ice_shatter", mpCost: { flat: 5, percentMax: 0 },
      description: "얼음, 한 명. 약하지만 발을 묶어 다음 라운드 순서를 늦춘다.", effect: { kind: "damage", statistic: "mind", affects: "hp" },
      stateEffects: [{ stateId: ST.slow, chance: 100, operation: "add" }] }),
    skill(SK.read, { name: "읽기", scope: "enemy", animationId: "anim_gen_power_aura", mpCost: { flat: 2, percentMax: 0 },
      description: "상대의 체력과 약한 곳을 읽는다.", effect: { kind: "scan" }, movePriority: 1 } as Partial<SkillRecord> as SkillRecord),
    skill(SK.fork, { name: "갈래 번개", scope: "allEnemies", power: 18, elementId: "thunder", animationId: "anim_gen_thunder_strike", mpCost: { flat: 6, percentMax: 0 },
      description: "번개, 범위. 범위 주문은 반사막에 튕기지 않는다.", effect: { kind: "damage", statistic: "mind", affects: "hp" } }),
    skill(SK.strip, { name: "걷어내기", scope: "enemy", animationId: "anim_gen_cleanse_sparkle", mpCost: { flat: 4, percentMax: 0 },
      description: "상대의 방벽·반사막·태세를 걷어 내고 빈틈을 만든다.", effect: { kind: "support" },
      stateEffects: [...strip, { stateId: ST.open, chance: 100, operation: "add" }] }),
    skill(SK.still, { name: "고요", scope: "self", animationId: "anim_gen_cleanse_sparkle", mpCost: { flat: 0, percentMax: 0 },
      description: "숨을 고른다. 마력 8을 되찾는다. 다음 라운드엔 빈틈이 생긴다.", effect: { kind: "healing", statistic: "mind", affects: "mp" }, power: 8,
      damageFormula: "8", stateEffects: [{ stateId: ST.open, chance: 100, operation: "add" }] } as Partial<SkillRecord> as SkillRecord),
    skill(SK.wrist, { name: "손목 겨누기", scope: "enemy", power: 40, animationId: "anim_gen_tackle_impact",
      description: "떨리는 손목을 노린다. 확실히 끝난다.", effect: { kind: "damage", statistic: "attack", affects: "hp" } }),
  ]) upsert(db.skills, s);

  // ── 상대 기술 ──
  for (const s of [
    skill(SK.armorSwing, { name: "휘두르기", scope: "enemy", power: 8, animationId: "anim_gen_tackle_impact", description: "연습 갑옷이 목검을 휘두른다.",
      effect: { kind: "damage", statistic: "attack", affects: "hp" } }),
    skill(SK.armorSlam, { name: "내려치기", scope: "enemy", power: 30, chargeTurns: 1, animationId: "anim_gen_tackle_impact",
      chargeBreak: { damage: 18, message: "갑옷이 비틀거린다. 내려치기가 흩어졌다." },
      description: "한 라운드 모았다가 내려친다.", effect: { kind: "damage", statistic: "attack", affects: "hp" } } as Partial<SkillRecord> as SkillRecord),
    skill(SK.seraMirror, { name: "반사막", scope: "self", animationId: "anim_gen_guard_barrier", movePriority: 2, description: "세라가 손바닥만 한 막을 세운다.",
      effect: { kind: "support" }, stateEffects: [{ stateId: ST.mirror, chance: 100, operation: "add" }] } as Partial<SkillRecord> as SkillRecord),
    skill(SK.seraStance, { name: "받아치기 태세", scope: "self", animationId: "anim_gen_power_aura", movePriority: 2, description: "세라가 지팡이를 비스듬히 든다.",
      effect: { kind: "support" }, stateEffects: [{ stateId: ST.stance, chance: 100, operation: "add" }] } as Partial<SkillRecord> as SkillRecord),
    skill(SK.seraBolt, { name: "가는 빛", scope: "enemy", power: 14, elementId: "holy", animationId: "anim_gen_holy_beam", description: "곧게 뻗는 빛 한 줄기.",
      effect: { kind: "damage", statistic: "mind", affects: "hp" } }),
    skill(SK.seraSeal, { name: "봉인 주문", scope: "enemy", animationId: "anim_gen_silence_lock", chargeTurns: 1, description: "한 라운드 외운 뒤 상대의 주문을 묶는다.",
      chargeBreak: { damage: 14, message: "세라의 입술이 멈춘다. 봉인이 풀렸다." },
      effect: { kind: "support" }, stateEffects: [{ stateId: ST.seal, chance: 100, operation: "add" }] } as Partial<SkillRecord> as SkillRecord),
    skill(SK.dowinFire, { name: "연쇄 화염", scope: "enemy", power: 46, chargeTurns: 2, elementId: "fire", animationId: "anim_gen_fire_burst",
      chargeBreak: { elementIds: ["ice"], damage: 30, message: "불길이 얼어붙어 꺼진다." },
      description: "두 라운드 모아 터뜨린다. 차가운 것에 약하다.", effect: { kind: "damage", statistic: "mind", affects: "hp" } } as Partial<SkillRecord> as SkillRecord),
    skill(SK.dowinWard, { name: "방벽", scope: "self", animationId: "anim_gen_guard_barrier", movePriority: 1, description: "도윈이 단정하게 방벽을 친다.",
      effect: { kind: "support" }, stateEffects: [{ stateId: ST.ward, chance: 100, operation: "add" }] } as Partial<SkillRecord> as SkillRecord),
    skill(SK.dowinBolt, { name: "불씨 화살", scope: "enemy", power: 16, elementId: "fire", animationId: "anim_gen_fire_burst", description: "정확한 불씨 하나.",
      effect: { kind: "damage", statistic: "mind", affects: "hp" } }),
    skill(SK.gearArm, { name: "톱니 팔", scope: "enemy", power: 18, animationId: "anim_gen_tackle_impact", description: "굵은 톱니가 박힌 팔이 내려온다.",
      effect: { kind: "damage", statistic: "attack", affects: "hp" } }),
    skill(SK.bell, { name: "종 울림", scope: "allEnemies", power: 26, chargeTurns: 1, animationId: "anim_gen_thunder_strike",
      chargeBreak: { elementIds: ["thunder"], message: "종 안에서 불꽃이 튀고 소리가 끊긴다." },
      description: "한 라운드 감았다가 종을 친다. 모두가 맞는다.", effect: { kind: "damage", statistic: "attack", affects: "hp" } } as Partial<SkillRecord> as SkillRecord),
  ]) upsert(db.skills, s);

  // ── 렌 ── 시작 주문 셋(불씨·방벽·받아치기), 장착 칸 넷(G5 가 들어오면 결투 전 장착 화면을 연다).
  const hero = db.actors.find((a) => a.id === ES_HERO) as ActorRecord & { learnedSkills?: { level: number; skillId: string }[]; loadoutSlots?: number };
  hero.learnedSkills = [{ level: 1, skillId: SK.ember }, { level: 1, skillId: SK.ward }];
  hero.loadoutSlots = 4;
  // 직업이 주는 기본 기술(베기 등)은 지운다 — 렌은 수업에서 배운 주문만 안다. 직업은 이 데모 전용으로 복제해 손님 동료와 나누지 않는다.
  const heroClass = db.classes.find((c) => c.id === hero.classId);
  if (heroClass) {
    const own = { ...JSON.parse(JSON.stringify(heroClass)), id: "class_es_scholar", name: "장학생", learnedSkills: [] };
    upsert(db.classes, own);
    hero.classId = own.id;
  }
  hero.parameterCurves = flatCurves(hero.parameterCurves, { maxHp: [60, 4], maxMp: [24, 2], attack: [14, 2], defense: [10, 1], mind: [20, 3], agility: [12, 1] });

  // ── 상대 ──
  // 학생 상대는 자기 걷기 칩으로 결투장에 선다(EnemyRecord.walkChip, #4000).
  const chip = (sheet: number, index: number) => ({ walkChip: { characterResourceId: `oprn-charset-wizarding${sheet}`, characterIndex: index } });
  upsert(db.enemies, enemy(EN.armor, {
    name: "연습 갑옷", monsterResourceId: "generated-enemy-armor-living", battleScalePercent: 80,
    stats: { maxHp: 70, maxMp: 0, attack: 26, defense: 12, mind: 4, agility: 6 }, skillIds: [SK.armorSwing, SK.armorSlam],
    actions: [act(SK.armorSlam, 9, { kind: "turn", start: 2, interval: 3 }), act(SK.armorSwing, 5)],
  }));
  upsert(db.enemies, enemy(EN.sera, {
    name: "세라", ...chip(1, 7),
    stats: { maxHp: 55, maxMp: 40, attack: 18, defense: 10, mind: 20, agility: 16 }, skillIds: [SK.seraMirror, SK.seraStance, SK.seraBolt],
    actions: [
      act(SK.seraMirror, 10, { kind: "status", stateId: ST.mirror, present: false }),
      act(SK.seraStance, 8, { kind: "turn", start: 2, interval: 2 }),
      act(SK.seraBolt, 6),
    ],
    stateRates: { [ST.slow]: "C" },
  }));
  upsert(db.enemies, enemy(EN.dowin, {
    name: "도윈", ...chip(1, 5),
    stats: { maxHp: 90, maxMp: 60, attack: 20, defense: 14, mind: 26, agility: 14 }, skillIds: [SK.dowinFire, SK.dowinWard, SK.dowinBolt],
    actions: [
      act(SK.dowinWard, 9, { kind: "status", stateId: ST.ward, present: false }),
      act(SK.dowinFire, 10, { kind: "turn", start: 2, interval: 4 }),
      act(SK.dowinBolt, 5),
    ],
    elementRates: { ...NEUTRAL_RATES, ice: "B" },
  }));
  upsert(db.enemies, enemy(EN.warden, {
    name: "파수 기계", monsterResourceId: "generated-enemy-golem-iron", battleScalePercent: 110,
    stats: { maxHp: 120, maxMp: 0, attack: 24, defense: 16, mind: 8, agility: 8 }, skillIds: [SK.gearArm, SK.bell],
    actions: [act(SK.bell, 10, { kind: "turn", start: 2, interval: 3 }), act(SK.gearArm, 5)],
    elementRates: { ...NEUTRAL_RATES, thunder: "A", fire: "D" },
  }));
  upsert(db.enemies, enemy(EN.seraFinal, {
    name: "세라", ...chip(1, 7),
    stats: { maxHp: 70, maxMp: 60, attack: 20, defense: 12, mind: 24, agility: 18 }, skillIds: [SK.seraMirror, SK.seraStance, SK.seraBolt, SK.seraSeal],
    actions: [
      act(SK.seraMirror, 10, { kind: "status", stateId: ST.mirror, present: false }),
      act(SK.seraSeal, 9, { kind: "turn", start: 3, interval: 4 }),
      act(SK.seraStance, 7, { kind: "turn", start: 2, interval: 2 }),
      act(SK.seraBolt, 6),
    ],
  }));

  // ── 손님 동료(4 결투): 세라 또는 테오 ──
  const template = db.actors.find((a) => a.id === "actor_mage") ?? hero;
  for (const [id, name, res, idx, skills] of [
    [ES_GUEST_SERA, "세라", "oprn-charset-wizarding1", 7, [SK.fork, SK.ward]],
    [ES_GUEST_TEO, "테오", "oprn-charset-wizarding2", 0, [SK.frost, SK.still]],
  ] as const) {
    const a = JSON.parse(JSON.stringify(template)) as ActorRecord & { learnedSkills?: { level: number; skillId: string }[] };
    Object.assign(a, { id, name, nickname: "", characterResourceId: res, characterIndex: idx, ...(hero.classId === "class_es_scholar" ? { classId: "class_es_scholar" } : {}) });
    delete (a as { battleCharacterResourceId?: string }).battleCharacterResourceId;
    delete (a as { faceResourceId?: string }).faceResourceId;
    a.learnedSkills = skills.map((skillId) => ({ level: 1, skillId }));
    a.parameterCurves = flatCurves(a.parameterCurves, { maxHp: [55, 0], maxMp: [30, 0], attack: [12, 0], defense: [10, 0], mind: [20, 0], agility: [12, 0] });
    upsert(db.actors, a);
  }

  // ── 트룹 ──
  const troop = (id: string, name: string, enemyId: string, pages: unknown[], extra: Partial<TroopRecord> = {}): TroopRecord => ({
    id, name, enemyIds: [enemyId], members: [{ enemyId, x: 70, y: 110, hidden: false }], autoAlign: true, uncapturable: true,
    battleFlow: "strict", battleEventPages: pages, ...extra,
  } as unknown as TroopRecord);

  upsert(db.troops, troop(TR.armor, "결투 1 · 연습 갑옷", EN.armor, [
    { id: "es_d1_open", name: "시작", span: "battle", runOnce: true, conditions: [{ kind: "onRound", round: 1 }],
      commands: [say("갑옷은 두 번째 라운드에 크게 들어 올립니다. 머리 위 표시를 보세요.", "브란트"), say("모으는 동안 세게 맞히면 흩어집니다. 아니면 방벽으로 받으세요.", "브란트")] },
    yieldPage(EN.armor, 25, "그만. 갑옷이 무릎을 꿇었습니다.", "브란트", SW_DUEL_WON),
  ]));
  upsert(db.troops, troop(TR.sera, "결투 2 · 세라", EN.sera, [
    { id: "es_d2_open", name: "시작", span: "battle", runOnce: true, conditions: [{ kind: "onRound", round: 1 }],
      commands: [say("단일 주문은 내 막에 그대로 돌아가. 알고 쏘는 게 좋을 거야.", "세라")] },
    { id: "es_d2_hint", name: "막 설명", span: "battle", runOnce: true, conditions: [{ kind: "onRound", round: 3 }, { kind: "enemyState", enemyId: EN.sera, stateId: ST.mirror }],
      commands: [say("막은 한 사람만 겨눈 주문을 튕깁니다. 넓게 치거나, 막부터 걷어 내십시오.", "브란트")] },
    yieldPage(EN.sera, 25, "……됐어. 내려놓을게.", "세라", SW_DUEL_WON),
  ]));
  upsert(db.troops, troop(TR.dowin, "결투 3 · 도윈", EN.dowin, [
    { id: "es_d3_open", name: "시작", span: "battle", runOnce: true, conditions: [{ kind: "onRound", round: 1 }],
      commands: [say("공개 결투니까 끝까지 하자. 지는 쪽도 배운다.", "도윈")] },
    yieldPage(EN.dowin, 25, "여기까지. 네 얼음이 내 불을 읽었어.", "도윈", SW_DUEL_WON),
  ]));
  upsert(db.troops, troop(TR.warden, "결투 4 · 파수 기계", EN.warden, [
    { id: "es_d4_open", name: "시작", span: "battle", runOnce: true, conditions: [{ kind: "onRound", round: 1 }],
      commands: [say("태엽이 감기는 소리가 들린다. 종을 치기 전에 멈춰야 한다.")] },
    { id: "es_d4_low", name: "멈춤", span: "battle", runOnce: true, conditions: [{ kind: "enemyHpBelow", enemyId: EN.warden, percent: 20 }],
      commands: [say("톱니가 헛돌다 멈춘다. 가슴판이 열리고 접힌 종이 한 장이 떨어진다."),
        { kind: "setSwitch", switchId: SW_DUEL_WON, value: true }, { kind: "m2Command", commandId: "m2-105-abort-battle", fields: {} }] },
  ], { battleGuests: [] }));
  upsert(db.troops, troop(TR.final, "결투 5 · 결정전", EN.seraFinal, [
    { id: "es_d5_open", name: "시작", span: "battle", runOnce: true, conditions: [{ kind: "onRound", round: 1 }],
      commands: [say("결정전. 상대 체력 사분의 일, 또는 지팡이를 내려놓으면 끝납니다.", "브란트")] },
    { id: "es_d5_r3", name: "세라의 말", span: "battle", runOnce: true, conditions: [{ kind: "onRound", round: 3 }],
      commands: [say("나 돌아가면 아무것도 기억 못 해. 너도 알지.", "세라")] },
    { id: "es_d5_tremor", name: "손떨림", span: "battle", runOnce: true, conditions: [{ kind: "enemyHpBelow", enemyId: EN.seraFinal, percent: 50 }],
      commands: [say("세라의 지팡이 끝이 흔들린다. 손목이 떨리고 있다."),
        { kind: "m2Command", commandId: "m2-100-change-enemy-state", fields: { target: EN.seraFinal, operation: "add", value: ST.tremor } }] },
  ]));
}

/** 레벨 1~99 곡선을 [시작값, 레벨당 증가] 로 다시 쓴다(결투는 작은 숫자로 읽혀야 한다). */
function flatCurves(curves: ActorRecord["parameterCurves"], spec: Record<string, [number, number]>): ActorRecord["parameterCurves"] {
  const out = { ...(curves as unknown as Record<string, number[]>) };
  for (const [k, [base, step]] of Object.entries(spec)) out[k] = Array.from({ length: 99 }, (_, i) => base + step * i);
  return out as unknown as ActorRecord["parameterCurves"];
}
