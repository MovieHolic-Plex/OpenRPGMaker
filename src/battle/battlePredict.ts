// 전투 화면 표시용 순수 계산 헬퍼.
// runtime.ts 의 데미지 공식/속성 판정과 동일한 규칙을 따르되, 랜덤 요소를 배제한
// "기댓값"을 반환한다. 거짓 데이터(하드코딩)를 대체하기 위한 진짜 계산 소스.
import { normalizeActorRecord, parameterValueAtLevel } from "@/project/actorModel";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import type { ActorId, EnemyId, Project, SkillId } from "@/project/types";
import type { ActorRateGrade, EnemyRecord, SkillRecord } from "@/project/types/database";
import type { BattleBattlerSnapshot, BattleSnapshot } from "@/battle/types";

export interface PredictedDamage {
  /** 분산/크리티컬/빗나감을 배제한 평균 기대 피해(또는 회복). 음수 = 흡수. */
  readonly amount: number;
  /** 힐/서포트(자신에게 적용) 여부. 화면 표시 분기용. */
  readonly healing: boolean;
  /** 대상이 이 속성에 약점(A/B 등급)인지. */
  readonly weak: boolean;
  /** 대상이 이 속성에 내성(D) 혹은 무효(E)인지. */
  readonly resistant: boolean;
  /** 속성 이름(표시용). 무속성이면 undefined. */
  readonly elementName?: string;
}

export interface BattlerStats {
  readonly attack: number;
  readonly defense: number;
  readonly mind: number;
  readonly agility: number;
}

export function lookupSkill(project: Project, skillId: SkillId): SkillRecord | undefined {
  return project.database.skills.find((record) => record.id === skillId);
}

export function lookupEnemy(project: Project, recordId: ActorId | EnemyId): EnemyRecord | undefined {
  return project.database.enemies.find((record) => record.id === recordId);
}

export function primaryAttackSkill(project: Project, actor: BattleBattlerSnapshot): SkillRecord | undefined {
  let fallback: SkillRecord | undefined;
  for (const skillId of actor.skillIds) {
    const skill = lookupSkill(project, skillId);
    if (!skill) continue;
    fallback ??= skill;
    if (skill.effect.kind === "damage") return skill;
  }
  return fallback;
}

// snapshot battler 의 실제 스탯을 원본 레코드에서 복원한다.
// actor 는 파라미터 커브(초기 레벨)에서, enemy 는 stats 에서 가져온다.
// battleBattlers.ts 의 복원 로직과 동일한 출처를 사용한다.
export function battlerStats(project: Project, battler: BattleBattlerSnapshot): BattlerStats {
  const enemy = project.database.enemies.find((entry) => entry.id === battler.recordId);
  if (enemy) {
    const stats = normalizeEnemyRecord(enemy).stats;
    return { attack: stats.attack, defense: stats.defense, mind: stats.mind, agility: stats.agility };
  }
  const actor = project.database.actors.find((entry) => entry.id === battler.recordId);
  if (actor) {
    const normalized = normalizeActorRecord(actor);
    const level = normalized.initialLevel;
    const curves = normalized.parameterCurves;
    return {
      attack: parameterValueAtLevel(curves.attack, level),
      defense: parameterValueAtLevel(curves.defense, level),
      mind: parameterValueAtLevel(curves.mind, level),
      agility: parameterValueAtLevel(curves.agility, level),
    };
  }
  return { attack: 0, defense: 0, mind: 0, agility: 0 };
}

// 데미지 속성 배율(퍼센트 → 100으로 나눈 값). runtime.elementMultiplierFor 와 동일 규칙.
// grade 가 없으면 1(중립). 음수 배율(-100 등)은 흡수로 해석된다.
export function elementMultiplierFor(project: Project, elementId: string | undefined, targetRecordId: ActorId | EnemyId): number {
  if (!elementId) return 1;
  const element = project.database.elements?.find((entry) => entry.id === elementId);
  if (!element?.damageMultipliers) return 1;
  const enemy = project.database.enemies.find((entry) => entry.id === targetRecordId);
  const actor = project.database.actors.find((entry) => entry.id === targetRecordId);
  const rates = enemy?.elementRates ?? actor?.elementRates;
  if (!rates) return 1;
  const grade = rates[elementId];
  if (!grade) return 1;
  const multiplier = element.damageMultipliers[grade];
  if (typeof multiplier !== "number" || !Number.isFinite(multiplier)) return 1;
  return multiplier / 100;
}

export function elementNameFor(project: Project, elementId: string | undefined): string | undefined {
  if (!elementId) return undefined;
  return project.database.elements?.find((entry) => entry.id === elementId)?.name;
}

// 대상의 한 속성 등급을 가져온다(약점/내성 칩 표시용).
export function elementGradeFor(project: Project, elementId: string, targetRecordId: ActorId | EnemyId): ActorRateGrade | undefined {
  const enemy = project.database.enemies.find((entry) => entry.id === targetRecordId);
  const actor = project.database.actors.find((entry) => entry.id === targetRecordId);
  const rates = enemy?.elementRates ?? actor?.elementRates;
  return rates?.[elementId];
}

// 약점 여부: grade A 또는 B (배율 > 1) 를 약점으로 본다.
export function isWeakness(grade: ActorRateGrade | undefined): boolean {
  return grade === "A" || grade === "B";
}

// 내성/무효: grade D(내성) 또는 E(무효).
export function isResistance(grade: ActorRateGrade | undefined): boolean {
  return grade === "D" || grade === "E";
}

// 속성 약점 목록(화면의 약점 칩용). enemy 의 elementRates 중 약점인 것만.
export function enemyWeaknesses(project: Project, enemyRecordId: ActorId | EnemyId): { elementId: string; name: string; grade: ActorRateGrade }[] {
  const enemy = project.database.enemies.find((entry) => entry.id === enemyRecordId);
  const rates = enemy?.elementRates;
  if (!rates) return [];
  const elements = project.database.elements ?? [];
  const result: { elementId: string; name: string; grade: ActorRateGrade }[] = [];
  for (const element of elements) {
    const grade = rates[element.id];
    if (isWeakness(grade)) result.push({ elementId: element.id, name: element.name, grade });
  }
  return result;
}

// 예측 데미지: 분산/크리/빗맞음을 배제하고 기댓값을 계산.
// 공식은 battleDamage.computeMagnitude 를 따르되 평균(분산 중앙값 1.0, 크리 미적용)을 낸다.
export function predictSkillDamage(
  project: Project,
  user: BattleBattlerSnapshot,
  spec: { power: number; statistic: "attack" | "mind"; effect: "damage" | "healing" | "support" | "switch"; elementId?: string },
  target: BattleBattlerSnapshot
): PredictedDamage {
  if (spec.effect === "healing") {
    const userStats = battlerStats(project, user);
    const sourceStat = spec.statistic === "mind" ? userStats.mind : userStats.attack;
    const amount = spec.power + Math.floor(sourceStat / 2);
    return { amount, healing: true, weak: false, resistant: false };
  }
  if (spec.effect === "support" || spec.effect === "switch") {
    return { amount: 0, healing: false, weak: false, resistant: false };
  }
  // damage
  const userStats = battlerStats(project, user);
  const sourceStat = spec.statistic === "mind" ? userStats.mind : userStats.attack;
  let magnitude = spec.power + Math.floor(sourceStat / 2);
  const elementMultiplier = elementMultiplierFor(project, spec.elementId, target.recordId);
  magnitude = Math.round(magnitude * elementMultiplier);
  const targetStats = battlerStats(project, target);
  magnitude -= Math.floor(targetStats.defense / 2);
  if (target.defending) magnitude = Math.floor(magnitude / 2);
  const grade = spec.elementId ? elementGradeFor(project, spec.elementId, target.recordId) : undefined;
  return {
    amount: magnitude,
    healing: false,
    weak: isWeakness(grade),
    resistant: isResistance(grade),
    elementName: spec.elementId ? elementNameFor(project, spec.elementId) : undefined,
  };
}

// 기본 공격의 예측 피해(무속성, power=attackPower). runtime 의 attack 호출과 동일.
export function predictAttackDamage(project: Project, actor: BattleBattlerSnapshot, target: BattleBattlerSnapshot): number {
  const result = predictSkillDamage(
    project,
    actor,
    { power: battlerStats(project, actor).attack, statistic: "attack", effect: "damage" },
    target
  );
  return result.amount;
}

// 스킬 예측 피해(공격 스킬만). healing/support 는 amount 를 그대로 반환.
export function predictSkillDamageFor(project: Project, user: BattleBattlerSnapshot, skill: SkillRecord, target: BattleBattlerSnapshot): PredictedDamage {
  const statistic = skill.effect.kind === "damage" || skill.effect.kind === "healing" ? skill.effect.statistic : "attack";
  return predictSkillDamage(project, user, { power: skill.power, statistic, effect: skill.effect.kind, elementId: skill.elementId }, target);
}

// 도주 성공 확률(0~1). runtime.performActorCommand 의 escape 로직과 동일.
export function escapeSuccessChance(project: Project, snapshot: BattleSnapshot): number {
  if (!snapshot.canEscape) return 0;
  const aliveEnemies = snapshot.enemies.filter((enemy) => !enemy.defeated);
  const enemyAgi = average(aliveEnemies.map((enemy) => battlerStats(project, enemy).agility));
  const actorAgi = average(snapshot.actors.filter((actor) => !actor.defeated).map((actor) => battlerStats(project, actor).agility));
  return Math.min(0.95, 0.5 + (actorAgi - enemyAgi) / Math.max(1, enemyAgi) * 0.25);
}

// 적의 다음 행동 예측: skillIds[0] (현재 런타임 AI 와 동일).
export function predictEnemyIntent(project: Project, enemy: BattleBattlerSnapshot): { skillName: string; skill?: SkillRecord } | undefined {
  const skillId = enemy.skillIds[0];
  if (!skillId) return undefined;
  const skill = lookupSkill(project, skillId);
  return { skillName: skill?.name ?? skillId, skill };
}

// 적의 예측 피해(적이 actor 에게 가할). 화면 "적 의도" 패널용.
export function predictEnemyDamageToParty(project: Project, enemy: BattleBattlerSnapshot, target: BattleBattlerSnapshot): number {
  const intent = predictEnemyIntent(project, enemy);
  if (intent?.skill && intent.skill.effect.kind === "damage") {
    return predictSkillDamageFor(project, enemy, intent.skill, target).amount;
  }
  // 기본 공격
  return predictAttackDamage(project, enemy, target);
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// snapshot 에서 현재 행동 중인 액터를 찾는 공용 헬퍼.
// battleCommandDom / battleDirectorDom 에서 중복 정의되어 있던 것을 통합.
export function activeActor(snapshot: BattleSnapshot): BattleBattlerSnapshot | undefined {
  return snapshot.actors.find((entry) => entry.recordId === snapshot.activeActorId);
}
