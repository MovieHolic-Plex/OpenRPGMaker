// 데이터베이스 '개요' 밸런스 대시보드(W5 렌더는 todo 15)용 순수 계산 모듈.
// project 하나만 받아 (1) 파티 전투력 곡선 (2) 몬스터 HP/DPS 산점도 (3) 밸런스 문제 후보를
// 계산한다. store/DOM/렌더/파일 입출력/난수/시간 의존이 전혀 없다 — 같은 project 를 넣으면
// 항상 같은 결과가 나온다. 스키마 변경도 없다(읽기 전용).
import { ACTOR_LEVEL_MAX, parameterValueAtLevel } from "@/project/actorModel";
import { battlerSnapshot, enemyBattlers } from "@/battle/battleBattlers";
import { lookupSkill, predictAttackDamage, predictSkillDamageFor } from "@/battle/battlePredict";
import { logicalEquipmentIds } from "@/project/equipmentRules";
import type { BattleBattlerSnapshot } from "@/battle/types";
import type { Project, SkillId, TroopId } from "@/project/types";
import type { EnemyRecord, SkillRecord, TroopRecord } from "@/project/types/database";

// 대시보드 곡선 창. RM2k3 표준 성장 밴드(1..50)를 고정한다.
export const PARTY_CURVE_LEVELS = 50;
// RM2k3 기본 편성 상한(전투 4인). 곡선도 첫 4배우만 반영한다.
const PARTY_CURVE_ACTORS = 4;
// 산점도 DPS 추정에 쓰는 대표 레벨. 파티 초기 레벨(보통 1)로 잡으면 모든 적이 과잉 위협으로
// 보이고, 99 캡 기준으로 잡으면 모든 적이 무해해 보인다. 1..50 창의 중간인 Lv20 을 고정한다
// — 대시보드는 '평균적인 성장 시점'의 스냅샷이 목적이고 레벨별 분석은 곡선 차트가 담당한다.
const REPRESENTATIVE_LEVEL = 20;
// 과잉 회복 휴리스틱 기준 HP. 가격 등급별 파티 maxHp 를 곡선에서 역산하는 대신
// RM2k3 초반 기준치 200HP 를 참조 HP 로 고정하고, "회복량 > 2×200 = 400" 을 임계로 단순화했다.
const OVERHEAL_REFERENCE_HP = 200;
const OVERHEAL_THRESHOLD = 2 * OVERHEAL_REFERENCE_HP;
// 보스 HP 급증: 같은 exp 대역(±30%) 일반 적 HP 중앙값의 3배 이상.
const BOSS_HP_SPIKE_RATIO = 3;
const BOSS_EXP_NEIGHBOR_BAND = 0.3;
// 스킬 정체: 파티가 쓰는 클래스 공격력 곡선에서 5레벨 연속 미증가.
const STAGNATION_WINDOW = 5;

export interface PartyPowerCurvePoint {
  readonly level: number;
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly mind: number;
  readonly agility: number;
}

export interface EnemyScatterPoint {
  readonly id: string;
  readonly name: string;
  readonly hp: number;
  readonly dps: number;
  readonly exp: number;
  readonly gold: number;
  readonly isBoss: boolean;
}

export type BalanceIssueKind = "overheal" | "boss-hp-spike" | "skill-stagnation";

export interface BalanceIssue {
  readonly kind: BalanceIssueKind;
  readonly title: string;
  readonly detail: string;
}

// 클래스를 찾을 수 없는 배우는 0 곡선으로 취급(예외 없음). parameterValueAtLevel 은
// 인덱스가 비면 1을 돌려주므로 "전 구간 0"을 표현하려면 0으로 채운 배열을 넘겨야 한다.
const ZERO_CURVE: readonly number[] = Array.from({ length: ACTOR_LEVEL_MAX }, () => 0);

// 시작 파티(system.startActorIds) 첫 4배우의 클래스 parameterCurves 합 + 초기 장비
// statBonuses 합을 레벨별로 반환. 세션 파티가 아니라 저작된 시작 편성을 본다.
export function partyPowerCurve(project: Project): PartyPowerCurvePoint[] {
  const actors = partyActorRecords(project);
  const points: PartyPowerCurvePoint[] = [];
  for (let level = 1; level <= PARTY_CURVE_LEVELS; level += 1) {
    const totals = { hp: 0, attack: 0, defense: 0, mind: 0, agility: 0 };
    for (const actor of actors) {
      const curves = curvesForActor(project, actor);
      const equipment = equipmentBonusesForActor(project, actor);
      totals.hp += parameterValueAtLevel(curves.maxHp, level);
      totals.attack += parameterValueAtLevel(curves.attack, level) + equipment.attack;
      totals.defense += parameterValueAtLevel(curves.defense, level) + equipment.defense;
      totals.mind += parameterValueAtLevel(curves.mind, level) + equipment.mind;
      totals.agility += parameterValueAtLevel(curves.agility, level) + equipment.agility;
    }
    points.push({ level, ...totals });
  }
  return points;
}

// 모든 몬스터 DB 레코드에 대해 단일 배틀러 스냅샷을 만들고, 파티 평균 방어자를 상대로 한
// 행동당 기대 피해(DPS)를 추정한다. 시간 정규화(민첩 게이지)는 하지 않는다 — 대시보드는
// '한 번 때릴 때 아픈 정도'의 상대 비교가 목적이고, 행동 속도는 민첩 스탯으로 별도 표시된다.
export function enemyScatter(project: Project): EnemyScatterPoint[] {
  const enemies = project.database.enemies;
  if (enemies.length === 0) return [];
  const defender = partyAverageDefender(project);
  const bossExp = bossExpThreshold(enemies);
  return enemies.map((enemy) => {
    const snapshot = singleEnemySnapshot(project, enemy);
    return {
      id: enemy.id,
      name: snapshot.name,
      hp: snapshot.maxHp,
      dps: enemyDpsPerAction(project, snapshot, defender),
      exp: enemy.rewards.exp,
      gold: enemy.rewards.gold,
      isBoss: isUncapturableEnemy(project, enemy) || enemy.rewards.exp >= bossExp,
    };
  });
}

// 플랜 W5 휴리스틱 3종. 모두 "의심 후보" 제시용 — 자동 수정이 아니다.
// (a) 과잉 회복 (b) 보스 HP 급증 (c) 공격력 정체 구간. 순서는 항상 a→b→c, 컬렉션 순서 내 정렬.
export function detectBalanceIssues(project: Project): BalanceIssue[] {
  return [
    ...overhealIssues(project),
    ...bossHpSpikeIssues(project),
    ...skillStagnationIssues(project),
  ];
}

// --- 파티 곡선 헬퍼 ---

function partyActorRecords(project: Project) {
  const partyIds = project.system.startActorIds.slice(0, PARTY_CURVE_ACTORS);
  const records = [];
  for (const actorId of partyIds) {
    const actor = project.database.actors.find((record) => record.id === actorId);
    if (actor) records.push(actor);
  }
  return records;
}

// 배우 스탯은 클래스 곡선에서 읽는다(actorBattlers 와 동일한 '클래스 기반 스탯' 모델).
// 클래스가 없으면 0 곡선 — 장비 보너스만 반영된다.
function curvesForActor(project: Project, actor: { readonly classId: string }) {
  const klass = project.database.classes.find((record) => record.id === actor.classId);
  return klass ? klass.parameterCurves : { maxHp: ZERO_CURVE, maxMp: ZERO_CURVE, attack: ZERO_CURVE, defense: ZERO_CURVE, mind: ZERO_CURVE, agility: ZERO_CURVE };
}

// 초기 장비 statBonuses 합. logicalEquipmentIds 를 써서 양손 무기/방패 규칙까지
// actorBattlers 와 동일하게 반영한다(레벨과 무관한 고정 보너스).
function equipmentBonusesForActor(project: Project, actor: { readonly initialEquipment: Project["database"]["actors"][number]["initialEquipment"] }) {
  const total = { attack: 0, defense: 0, mind: 0, agility: 0 };
  for (const equipmentId of logicalEquipmentIds(project, actor.initialEquipment)) {
    const record = project.database.equipment.find((entry) => entry.id === equipmentId);
    if (!record) continue;
    total.attack += record.statBonuses.attack;
    total.defense += record.statBonuses.defense;
    total.mind += record.statBonuses.mind;
    total.agility += record.statBonuses.agility;
  }
  return total;
}

// --- 산점도 헬퍼 ---

function singleEnemyTroop(enemy: EnemyRecord): TroopRecord {
  return {
    id: `troop_${enemy.id}` as TroopId,
    name: enemy.name,
    enemyIds: [enemy.id],
    members: [{ enemyId: enemy.id, x: 84, y: 52 }],
    autoAlign: true,
    battleEventPages: [],
  };
}

function singleEnemySnapshot(project: Project, enemy: EnemyRecord): BattleBattlerSnapshot {
  const [battler] = enemyBattlers(project, singleEnemyTroop(enemy));
  return battlerSnapshot(battler);
}

// 상위 10% exp 컷: exp 내림차순으로 정렬해 ceil(0.9n)-1 번째 값. 이 값 이상이면 보스 후보.
function bossExpThreshold(enemies: readonly EnemyRecord[]): number {
  const sorted = enemies.map((enemy) => enemy.rewards.exp).sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * 0.9) - 1);
  return sorted[index] ?? 0;
}

// uncapturable 은 적이 아니라 트룹(전투) 단위 플래그다 — runtime.ts 의 포획 차단과 같은 의미.
// 이 적을 포함하는 트룹 중 하나라도 uncapturable 이면 그 적은 포획 불가 → 보스급으로 취급한다.
function isUncapturableEnemy(project: Project, enemy: EnemyRecord): boolean {
  return project.database.troops.some((troop) => {
    if (troop.uncapturable !== true) return false;
    const troopEnemyIds = troop.members?.length ? troop.members.map((member) => member.enemyId) : troop.enemyIds;
    return troopEnemyIds.includes(enemy.id);
  });
}

// 파티 평균 방어자 스냅샷. recordId 는 DB에 존재하지 않는 센티넬 — battlerStats 가
// effectiveStats 를 우선하므로 곡선에서 계산한 평균값이 그대로 쓰인다(속성 약점은 미적용).
function partyAverageDefender(project: Project): BattleBattlerSnapshot {
  const curve = partyPowerCurve(project);
  const point = curve[REPRESENTATIVE_LEVEL - 1] ?? { hp: 0, attack: 0, defense: 0, mind: 0, agility: 0 };
  const actorCount = partyActorRecords(project).length;
  const per = (total: number): number => (actorCount > 0 ? Math.round(total / actorCount) : 0);
  const attack = per(point.attack);
  const defense = per(point.defense);
  const mind = per(point.mind);
  const agility = per(point.agility);
  const hp = per(point.hp);
  return {
    id: "party-average-defender",
    recordId: "party_average_defender",
    name: "파티 평균",
    hp,
    maxHp: hp,
    mp: 0,
    maxMp: 0,
    gauge: 0,
    defeated: false,
    defending: false,
    pose: "idle",
    stateIds: [],
    skillIds: [],
    effectiveStats: { attack, defense, mind, agility },
  };
}

// 행동당 기대 피해 = 기본 공격과 데미지 스킬들 중 최댓값. 적 AI가 매 턴 최선만 고르지는
// 않지만 '이 적이 한 번 때릴 때 얼마나 아픈가'의 상한선이 산점도 비교에 유용하다.
function enemyDpsPerAction(project: Project, enemy: BattleBattlerSnapshot, defender: BattleBattlerSnapshot): number {
  let best = predictAttackDamage(project, enemy, defender);
  for (const skill of damageSkills(project, enemy.skillIds)) {
    best = Math.max(best, predictSkillDamageFor(project, enemy, skill, defender).amount);
  }
  return best;
}

function damageSkills(project: Project, skillIds: readonly SkillId[]): SkillRecord[] {
  const skills: SkillRecord[] = [];
  for (const skillId of skillIds) {
    const skill = lookupSkill(project, skillId);
    if (skill && skill.effect.kind === "damage") skills.push(skill);
  }
  return skills;
}

// --- 문제 감지 헬퍼 ---

// (a) 과잉 회복: medicine 아이템의 회복량(flat + 참조 HP 200의 percentMax 몫)이 400 초과.
function overhealIssues(project: Project): BalanceIssue[] {
  const issues: BalanceIssue[] = [];
  for (const item of project.database.items) {
    if (item.type !== "medicine") continue;
    const amount = item.hpRecovery.flat + Math.floor((item.hpRecovery.percentMax * OVERHEAL_REFERENCE_HP) / 100);
    if (amount <= OVERHEAL_THRESHOLD) continue;
    issues.push({
      kind: "overheal",
      title: `과잉 회복 아이템 — ${item.name}`,
      detail: `HP 회복량 ${amount}(고정 ${item.hpRecovery.flat} + ${item.hpRecovery.percentMax}% × 기준 ${OVERHEAL_REFERENCE_HP}HP)이 기준 ${OVERHEAL_THRESHOLD}을 초과합니다.`,
    });
  }
  return issues;
}

// (b) 보스 HP 급증: 같은 exp 대역(보스 exp ±30%) 일반 적 HP 중앙값의 3배 이상 보스 HP.
function bossHpSpikeIssues(project: Project): BalanceIssue[] {
  const enemies = project.database.enemies;
  if (enemies.length === 0) return [];
  const threshold = bossExpThreshold(enemies);
  const isBoss = (enemy: EnemyRecord): boolean => isUncapturableEnemy(project, enemy) || enemy.rewards.exp >= threshold;
  const issues: BalanceIssue[] = [];
  for (const boss of enemies) {
    if (!isBoss(boss)) continue;
    const neighbors = enemies
      .filter((other) => other !== boss && !isBoss(other))
      .filter((other) => Math.abs(other.rewards.exp - boss.rewards.exp) <= BOSS_EXP_NEIGHBOR_BAND * boss.rewards.exp)
      .map((other) => other.stats.maxHp);
    if (neighbors.length === 0) continue;
    const median = medianOf(neighbors);
    if (median <= 0 || boss.stats.maxHp < BOSS_HP_SPIKE_RATIO * median) continue;
    issues.push({
      kind: "boss-hp-spike",
      title: `보스 HP 급증 — ${boss.name}`,
      detail: `HP ${boss.stats.maxHp}이(가) 비슷한 보상(exp ${boss.rewards.exp} ±30%) 일반 적 ${neighbors.length}종 중앙값 ${median}의 ${BOSS_HP_SPIKE_RATIO}배 이상입니다.`,
    });
  }
  return issues;
}

// (c) 공격력 정체: 파티가 쓰는 클래스 공격 곡선에서 5레벨 연속 미증가 구간.
// 파워가 고정된 데미지 스킬은 공격력에 비례해 성장하므로, 공격력이 멈추면 스킬 대미지도
// 함께 정체한다 — 스킬 파워를 개별로 추적하는 대신 클래스 공격 곡선 하나로 단순화했다.
function skillStagnationIssues(project: Project): BalanceIssue[] {
  const issues: BalanceIssue[] = [];
  const seenClassIds = new Set<string>();
  for (const actor of partyActorRecords(project)) {
    if (seenClassIds.has(actor.classId)) continue;
    seenClassIds.add(actor.classId);
    const klass = project.database.classes.find((record) => record.id === actor.classId);
    if (!klass) continue;
    const flat = longestFlatRun(klass.parameterCurves.attack.slice(0, PARTY_CURVE_LEVELS));
    if (flat.length < STAGNATION_WINDOW) continue;
    issues.push({
      kind: "skill-stagnation",
      title: `공격력 정체 — ${klass.name}`,
      detail: `Lv.${flat.start}~${flat.start + flat.length - 1} 공격력이 ${flat.length}레벨 연속 미증가합니다. 데미지 스킬 성장도 함께 멈춥니다.`,
    });
  }
  return issues;
}

// 연속 동일값 구간 중 가장 긴 것. 곡선은 이미 정규화 상태(1..99 값)를 가정한다.
function longestFlatRun(values: readonly number[]): { start: number; length: number } {
  let best = { start: 1, length: 1 };
  let runStart = 0;
  for (let index = 1; index <= values.length; index += 1) {
    if (index < values.length && values[index] === values[runStart]) continue;
    const length = index - runStart;
    if (length > best.length) best = { start: runStart + 1, length };
    runStart = index;
  }
  return best;
}

function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

