/**
 * 『폴른 스타』 전투 깊이(2026-10-24, fs-battle-2) — 기술마다 「센 한 방」 말고 고유한 쓰임을 준다 + 1막 연계기 셋.
 *
 * 사용자: 「스킬들이 특징이 그냥 강하게 때린다 이게 다 끝인거냐」「연계기 같은 것도 있으면 좋겠음」.
 * battleRoles.ts(앞 단계)가 속성·다단·방어 무시·무기 공명을 줬다. 여기서는 그 위에 **짝을 이루는 역할**을 얹는다:
 *   - 깔기 → 거두기: 엘레나 블리자드(둔화)·이리스 봉 내려치기(기절) → 카엘 십자베기·이리스 광선 조준이 그 상태의 적에게 +50%(exploitStates).
 *   - 지키기: 카엘 도발(적의 공격을 끈다)·반격 자세. 엘레나 기세 꺾기(적 공격 반감)·정화(해로운 상태 씻기).
 *   - 시간: 이리스 광자 연사가 맞힐 때마다 적 행동 게이지를 늦춘다. 화염검은 화상(지속 피해)을 남긴다.
 *   - 연계기: upsert_combo_tech(조수와 같은 도구)로 저작한다 — 듀얼 둘, 트리플 하나(Lv7 기술 셋이 열쇠라 레벨 업 때 「새 연계기!」 카드).
 *
 * 범위: 기술·직업 습득표·새 상태(화상)만 만진다. 발렌·용 적 그룹, 1막 이벤트, 적이 쓰는 공용 기술(skill_weaken·skill_focus)은 건드리지 않는다.
 * chronoBell.ts 가 applyFallenBattleRoles 다음에 `applyFallenBattleDepth(project, execTool)` 한 줄로 부른다.
 */
import { normalizeSkillRecord } from "@/project/databaseRecordModel";
import type { ClassRecord, Project, SkillRecord, StateRecord } from "@/project/types";

const KAEL = "actor_hero";
const ELENA = "actor_fs_elena";
const IRIS = "actor_fs_iris";

export const FS_BURN_STATE = "fs_state_burn";
export const FS_TAUNT_SKILL = "skill_fs_taunt";
export const FS_COUNTER_SKILL = "skill_fs_counter_stance";
export const FS_DAMPEN_SKILL = "skill_fs_dampen";
export const FS_PURIFY_SKILL = "skill_fs_purify";
export const FS_COMBO_FLAME_CROSS = "skill_combo_fs_flame_cross";
export const FS_COMBO_FROST_LANCE = "skill_combo_fs_frost_lance";
export const FS_COMBO_STARFALL = "skill_combo_fs_fallen_star";

type ToolExec = (project: Project, name: string, args: Record<string, unknown>) => void;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function applyFallenBattleDepth(project: Project, exec: ToolExec): void {
  const db = project.database;
  const find = <T extends { id: string }>(list: T[], id: string): T => {
    const found = list.find((r) => r.id === id);
    if (!found) throw new Error(`[fallen-star] 전투 깊이: ${id} 이 없다`);
    return found;
  };
  const upsertSkill = (record: SkillRecord): void => {
    const at = db.skills.findIndex((r) => r.id === record.id);
    if (at >= 0) db.skills[at] = record; else db.skills.push(record);
  };
  const tune = (id: string, patch: Partial<SkillRecord> & { readonly description: string }): void => {
    upsertSkill(normalizeSkillRecord({ ...clone(find<SkillRecord>(db.skills, id)), ...patch, id }));
  };
  const make = (fromId: string, id: string, patch: Partial<SkillRecord> & { readonly name: string; readonly description: string }): void => {
    upsertSkill(normalizeSkillRecord({ ...clone(find<SkillRecord>(db.skills, fromId)), ...patch, id }));
  };
  const learn = (classId: string, level: number, skillId: string, replaces?: string): void => {
    const record = find<ClassRecord>(db.classes, classId);
    const rows = record.learnedSkills.filter((row) => row.skillId !== skillId && row.skillId !== replaces);
    record.learnedSkills = [...rows, { level, skillId }].sort((a, b) => a.level - b.level);
  };

  // ── 새 상태: 화상(화염검·불꽃 십자참) — 매 차례 최대 HP 3%, 최대 3차례(보스 HP 비율이라 낮게). ─────────────────────
  if (!db.states.some((s) => s.id === FS_BURN_STATE)) {
    db.states.push({
      ...clone(find<StateRecord>(db.states, "state_poison")),
      id: FS_BURN_STATE,
      name: "화상",
      battleAura: "burn-ember",
      removalCondition: "전투 종료",
      recoverNaturallyFromTurn: 3,
      recoverNaturallyChance: 50,
      runtimeEffects: { hpDamagePercentPerTurn: 3, maxTurns: 3, removeOnBattleEnd: true },
    } as StateRecord);
  }

  // ── 카엘: 앞에서 버티는 검사 — 도발·반격 + 둔화된 적을 노리는 십자베기 ─────────────────────
  tune("skill_hero_cross_slash", {
    exploitStates: { stateIds: ["state_agility_down"], bonusPercent: 50 },
    description: "두 번 벤다(급소 30%, 검을 들면 +40%). 둔해진 적은 +50% — 엘레나의 블리자드 다음에.",
  });
  tune("skill_hero_flame_sword", {
    stateEffects: [{ stateId: FS_BURN_STATE, chance: 60, operation: "add" }],
    description: "불 속성 베기 + 60% 화상(매 차례 HP 3%). 늑대 약점. 도깨비불엔 무효.",
  });
  make("skill_focus", FS_TAUNT_SKILL, {
    name: "도발", scope: "self", power: 0, mpCost: { flat: 3, percentMax: 0 },
    effect: { kind: "support" },
    stateEffects: [{ stateId: "state_taunt", chance: 100, operation: "add" }],
    retroChoreographyId: "skill_guard_taunt",
    description: "적의 공격을 자신에게 끈다(방어 +20%). 엘레나가 큰 마법을 모을 때.",
  });
  make("skill_focus", FS_COUNTER_SKILL, {
    name: "반격 자세", scope: "self", power: 0, mpCost: { flat: 5, percentMax: 0 },
    effect: { kind: "support" },
    stateEffects: [{ stateId: "state_counter", chance: 100, operation: "add" }],
    retroChoreographyId: "skill_guard_counter",
    description: "물리 공격을 맞으면 60% 로 되받아 벤다. 도발과 함께 쓰면 적이 스스로 칼을 맞는다.",
  });
  learn("class_hero", 4, FS_TAUNT_SKILL);
  learn("class_hero", 8, FS_COUNTER_SKILL);

  // ── 엘레나: 깔고 지키는 마도사 — 기세 꺾기(약화 대신)·정화·마법탄 흡수 ─────────────────────
  tune("skill_arcane_bolt", {
    drainPercent: 30,
    description: "MP 2. 가장 싼 공격 마법 — 준 피해의 30% 만큼 HP 를 되찾는다.",
  });
  make("skill_weaken", FS_DAMPEN_SKILL, {
    name: "기세 꺾기", mpCost: { flat: 3, percentMax: 0 },
    stateEffects: [{ stateId: "state_attack_down", chance: 100, operation: "add" }],
    description: "한 대상의 공격을 반으로(확정). 센 한 방을 준비하는 적에게 먼저. (방어 깎기는 카엘의 올려베기)",
  });
  make("skill_heal", FS_PURIFY_SKILL, {
    // 회복량 없는 support — 회복 기술이면 자동 전투 AI 가 치유 대신 고른다(모의전 실측: 용전 치유 절반이 정화로 샜다).
    name: "정화", scope: "ally", power: 0, mpCost: { flat: 3, percentMax: 0 }, effect: { kind: "support" },
    stateEffects: ["state_poison", "state_deep_poison", "state_paralysis", "state_sleep", "state_blind", "state_silence", "state_attack_down", "state_defense_down", "state_agility_down", "state_stop", FS_BURN_STATE]
      .filter((id) => db.states.some((s) => s.id === id))
      .map((stateId) => ({ stateId, chance: 100, operation: "remove" as const })),
    retroChoreographyId: "skill_cleric_purify",
    description: "아군 하나의 독·마비·잠·침묵·화상·능력 하락을 한 번에 씻는다.",
  });
  learn("class_mage", 1, FS_DAMPEN_SKILL, "skill_weaken");
  learn("class_mage", 4, FS_PURIFY_SKILL);

  // ── 이리스: 멈춘 적을 노리는 저격수 + 게이지 늦추기 ────────────────────────────────────
  tune("skill_gunner_shot", {
    exploitStates: { stateIds: ["state_stop", "state_sleep", "state_paralysis"], bonusPercent: 50 },
    description: "급소 50%(두 배), 사출봉 +40%. 기절·잠·마비로 멈춘 적은 +50%.",
  });
  tune("skill_gunner_rapid_fire", {
    gaugeShift: -10,
    description: "약한 빛 네 발(사출봉 +40%). 맞힐 때마다 적의 다음 행동을 늦춘다. 잠든 적은 깬다.",
  });

  // ── 달려드는 속도(2026-10-25 「늑대가 고블린보다 느리네」) — 전역 기본(fast)에서 짐승은 이미 사람 적보다 빠르다.
  // 숲늑대는 한 번 더 날래게. 조수와 같은 칸(upsert_enemy lungeSpeedPercent).
  for (const enemy of db.enemies) if (enemy.id === "enemy_fs_wolf" || enemy.id === "enemy_wolf_grey") enemy.lungeSpeedPercent = 130;

  // ── 연계기(크로노 트리거식) — 조수와 같은 도구로 저작한다 ─────────────────────────────
  exec(project, "upsert_combo_tech", {
    id: FS_COMBO_FLAME_CROSS,
    name: "불꽃 십자참",
    description: "엘레나가 검에 불을 붙이고 카엘이 십자로 벤다. 두 번 불 속성 + 화상 60%.",
    actorIds: [KAEL, ELENA],
    requires: [{ actorId: KAEL, skillId: "skill_hero_cross_slash" }, { actorId: ELENA, skillId: "skill_mage_fireball" }],
    mpCosts: [{ actorId: KAEL, mp: 3 }, { actorId: ELENA, mp: 5 }],
    scope: "enemy", kind: "damage", statistic: "attack", power: 62, elementId: "fire", hits: 2,
    stateEffects: [{ stateId: FS_BURN_STATE, chance: 60, operation: "add" }],
    choreographyId: "skill_ninja_fire_style",
  });
  exec(project, "upsert_combo_tech", {
    id: FS_COMBO_FROST_LANCE,
    name: "성광 빙폭",
    description: "엘레나의 얼음 안개를 이리스의 빛이 꿰뚫어 터뜨린다. 적 전체 얼음 + 확정 둔화 — 카엘의 십자베기가 이어 받는다.",
    actorIds: [ELENA, IRIS],
    requires: [{ actorId: ELENA, skillId: "skill_mage_blizzard" }, { actorId: IRIS, skillId: "skill_gunner_snipe" }],
    mpCosts: [{ actorId: ELENA, mp: 8 }, { actorId: IRIS, mp: 5 }],
    scope: "allEnemies", kind: "damage", statistic: "mind", power: 70, elementId: "ice",
    stateEffects: [{ stateId: "state_agility_down", chance: 100, operation: "add" }],
    choreographyId: "skill_ranger_storm_arrow",
  });
  exec(project, "upsert_combo_tech", {
    id: FS_COMBO_STARFALL,
    name: "폴른 스타",
    description: "셋이 힘을 모아 별 하나를 떨어뜨린다. 적 전체 빛 — 세 사람의 공격력·마력 합으로 친다.",
    actorIds: [KAEL, ELENA, IRIS],
    requires: [
      { actorId: KAEL, skillId: "skill_hero_flame_sword" },
      { actorId: ELENA, skillId: "skill_mage_chain_lightning" },
      { actorId: IRIS, skillId: "skill_gunner_butt_strike" },
    ],
    mpCosts: [{ actorId: KAEL, mp: 8 }, { actorId: ELENA, mp: 10 }, { actorId: IRIS, mp: 8 }],
    scope: "allEnemies", kind: "damage", statistic: "attack", power: 40, elementId: "holy", combinedStats: true,
    choreographyId: "skill_mage_starfall",
  });
}

/**
 * 『폴른 스타』 성장 곡선(2026-10-25, 사용자 「레벨 오르면 왜 체력밖에 안 오름..?」).
 *
 * 세 동료는 기본 곡선(Lv1 HP 514·공 45)을 그대로 쓰고 있어 1막 레벨대(6~9)에서 공격·방어·마력·민첩이 몇 레벨에 1 오를까 말까였다 —
 * 레벨 업 창에 HP 줄만 떴다. 전투 능력치의 정본은 배우 parameterCurves 다(battleBattlers.actorDerivedStats, 직업 곡선은 직업 변경 뒤에만).
 * 역할별로 **매 레벨 모든 능력치가 오르게** 다시 짠다. 1막 시작(Lv6) 값은 예전과 같게 묶어(보스 균형 유지)
 * 그 앞뒤로 역할별 증가폭을 준다: 카엘 = 체력·공격·방어, 엘레나 = MP·마력, 이리스 = 공격·민첩.
 * 운(LUK)·마법 방어(MDF)는 엔진에 따로 없다 — 마력(mind)이 마법 공격과 마법 피해 경감을 함께 맡는다.
 */
const GROWTH_ANCHOR_LEVEL = 6;
/** [기준 레벨 값, 1막 레벨당 증가, 2막 이후 레벨당 증가] — 1막(Lv6~9)은 모든 능력치 +1·HP +7 정도(예전 곡선의 보스 균형에 가깝게), Lv17 까지 역할 폭으로 벌어진다. */
type GrowthRow = readonly [anchor: number, early: number, late: number];
// 기준값 = 예전(기본 곡선) Lv6 값(1막 시작 레벨). 역할 차이는 레벨이 오를수록 증가폭에서 난다.
const FS_GROWTH: Readonly<Record<string, Readonly<Record<"maxHp" | "maxMp" | "attack" | "defense" | "mind" | "agility", GrowthRow>>>> = {
  [KAEL]: { maxHp: [526, 5, 26], maxMp: [43, 1, 2], attack: [45, 1, 3.2], defense: [57, 1, 2.6], mind: [45, 1, 1.2], agility: [43, 1, 1.6] },
  [ELENA]: { maxHp: [526, 5, 17], maxMp: [43, 1, 4.4], attack: [45, 1, 1.2], defense: [57, 1, 1.5], mind: [45, 1, 3.4], agility: [43, 1, 1.6] },
  [IRIS]: { maxHp: [447, 5, 20], maxMp: [39, 1, 2.2], attack: [54, 1, 3.2], defense: [39, 1, 1.5], mind: [38, 1, 1.2], agility: [47, 1, 2.8] },
};

/** 99칸 곡선 — 기준 레벨 위로는 레벨마다 early → late 로 벌어지는 증가(Lv18 에서 late), 아래로는 early 폭(최소 1)으로 내려가되 기준값의 35% 아래로는 안 내려간다. 매 레벨 반드시 오른다. */
export function fallenGrowthCurve([anchor, early, late]: GrowthRow): number[] {
  const values: number[] = new Array(99);
  values[GROWTH_ANCHOR_LEVEL - 1] = anchor;
  for (let level = GROWTH_ANCHOR_LEVEL + 1; level <= 99; level += 1) {
    const t = Math.max(0, Math.min(1, (level - GROWTH_ANCHOR_LEVEL - 1) / 10));
    values[level - 1] = values[level - 2]! + early + (late - early) * t;
  }
  for (let level = GROWTH_ANCHOR_LEVEL - 1; level >= 1; level -= 1) values[level - 1] = Math.max(anchor * 0.35, values[level]! - Math.max(1, early));
  const out = values.map((value) => Math.max(1, Math.round(value)));
  for (let i = 1; i < out.length; i += 1) if (out[i]! <= out[i - 1]!) out[i] = out[i - 1]! + 1;
  return out;
}

export function applyFallenGrowthCurves(project: Project): void {
  for (const [actorId, rows] of Object.entries(FS_GROWTH)) {
    const actor = project.database.actors.find((record) => record.id === actorId);
    if (!actor) throw new Error(`[fallen-star] 성장 곡선: ${actorId} 이 없다`);
    // 기준 레벨까지는 예전 곡선보다 약해지지 않는다(1막 초반 싸움 균형 — 모의전에서 도깨비불전이 몇 점 차이로 뒤집혔다).
    const keep = (key: keyof typeof rows): number[] => {
      const previous = actor.parameterCurves[key] ?? [];
      const curve = fallenGrowthCurve(rows[key]);
      for (let index = 0; index < GROWTH_ANCHOR_LEVEL - 1; index += 1) curve[index] = Math.max(curve[index]!, previous[index] ?? 0);
      // 기준 레벨 아래는 예전 곡선처럼 제자리여도 된다(밀어 올리면 Lv1 부터 쌓여 1막 값이 부푼다). 그 위로는 매 레벨 오른다.
      for (let index = 1; index < curve.length; index += 1) {
        if (curve[index]! < curve[index - 1]!) curve[index] = curve[index - 1]!;
        if (index >= GROWTH_ANCHOR_LEVEL - 1 && curve[index]! <= curve[index - 1]!) curve[index] = curve[index - 1]! + 1;
      }
      return curve;
    };
    actor.parameterCurves = {
      ...actor.parameterCurves,
      maxHp: keep("maxHp"),
      maxMp: keep("maxMp"),
      attack: keep("attack"),
      defense: keep("defense"),
      mind: keep("mind"),
      agility: keep("agility"),
    };
  }
}
