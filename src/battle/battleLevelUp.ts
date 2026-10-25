// 자동 레벨업 순수 로직. 누적 경험치를 expCurve 와 대조해 레벨을 올리고,
// 파라미터 곡선으로 능력치 성장분을 산출하며, 새로 습득하는 스킬을 모은다.
import { ACTOR_LEVEL_MAX, normalizeActorRecord, parameterValueAtLevel, totalExpForLevel } from "@/project/actorModel";
import { classLearnedSkillIdsUpToLevel, hasActorClassOverride } from "@/project/sessionClass";
import { combinedLevelUpBonus, levelUpEquipmentGain, type LevelUpEquipmentGain } from "@/battle/battleEsperAp";
import type { ActorInitialEquipment, Project, SkillId } from "@/project/types";

export interface BattleLevelUpResult {
  readonly actorId: string;
  readonly actorName: string;
  readonly fromLevel: number;
  readonly toLevel: number;
  // maxHp/maxMp 증가분(현재치 보전에 가산). RM2K3 방식: 증가분만큼 현재 HP/MP 를 올린다.
  readonly maxHpGain: number;
  readonly maxMpGain: number;
  readonly attackGain: number;
  readonly defenseGain: number;
  readonly mindGain: number;
  readonly agilityGain: number;
  // 새 레벨 구간(fromLevel < level <= toLevel)에서 습득하는 스킬.
  readonly learnedSkillIds: readonly SkillId[];
  // 장착 마석의 레벨업 보너스(EquipmentRecord.levelUpBonus). 위 *Gain 에 이미 합산돼 있다 — 세션은 이 몫을 영구 보너스로 적립한다.
  readonly equipmentBonus?: LevelUpEquipmentGain;
}

// 액터 한 명의 레벨업을 판정. 변화가 없으면 null.
// currentLevel: 판정 전 레벨, totalExp: 판정 후의 누적 경험치.
export function computeActorLevelUp(
  project: Project,
  actorId: string,
  currentLevel: number,
  totalExp: number,
  options: { readonly classOverrides?: Readonly<Record<string, string>>; readonly equipment?: ActorInitialEquipment } = {}
): BattleLevelUpResult | null {
  const record = project.database.actors.find((entry) => entry.id === actorId);
  if (!record) return null;
  const actor = normalizeActorRecord(record);
  const classId = options.classOverrides?.[actorId];
  const klass = classId ? project.database.classes.find((entry) => entry.id === classId) : undefined;
  const useClassGrowth = hasActorClassOverride({ classOverrides: options.classOverrides ? { ...options.classOverrides } : undefined }, actorId) && klass !== undefined;
  const maxLevel = actor.maxLevel;
  let level = Math.max(1, Math.min(currentLevel, maxLevel));
  const fromLevel = level;
  // 다중 레벨업 지원: 다음 레벨 누적 필요 경험치를 넘는 동안 계속 올린다.
  while (level < maxLevel && level < ACTOR_LEVEL_MAX && totalExp >= totalExpForLevel(actor.expCurve, level + 1)) {
    level += 1;
  }
  if (level === fromLevel) return null;

  const curves = useClassGrowth && klass ? klass.parameterCurves : actor.parameterCurves;
  const gainOf = (curve: readonly number[]) => parameterValueAtLevel(curve, level) - parameterValueAtLevel(curve, fromLevel);
  const learnedSkillIds = new Set<SkillId>(
    actor.learnedSkills
      // TP 문턱이 있는 항목은 레벨만으로 배우지 않는다(computeTechPointLearning 이 맡는다).
      .filter((entry) => entry.tp === undefined && entry.level > fromLevel && entry.level <= level)
      .map((entry) => entry.skillId)
  );
  // 직업 습득표 — 전투 배틀러(battleBattlers.learnedSkillIds)와 같게, 전직이 없으면 배우 본래 직업의 표를 본다.
  // 예전에는 전직했을 때만 봐서 직업이 가르치는 기술(폴른 스타의 화염검·연쇄 번개 등)이 레벨 업 결과에 한 번도 안 떴다(fs-battle-2 녹화).
  const skillClassId = useClassGrowth && klass ? klass.id : actor.classId;
  if (skillClassId) {
    const before = new Set(classLearnedSkillIdsUpToLevel(project, skillClassId, fromLevel));
    const known = new Set(actor.learnedSkills.filter((entry) => entry.tp === undefined && entry.level <= fromLevel).map((entry) => entry.skillId));
    for (const skillId of classLearnedSkillIdsUpToLevel(project, skillClassId, level)) {
      if (!before.has(skillId) && !known.has(skillId)) learnedSkillIds.add(skillId);
    }
  }

  const equipmentBonus = levelUpEquipmentGain(
    combinedLevelUpBonus(project, options.equipment), fromLevel, level,
    (stat, at) => parameterValueAtLevel(curves[stat], at),
  );
  return {
    actorId,
    actorName: actor.name,
    fromLevel,
    toLevel: level,
    maxHpGain: gainOf(curves.maxHp) + (equipmentBonus?.maxHp ?? 0),
    maxMpGain: gainOf(curves.maxMp) + (equipmentBonus?.maxMp ?? 0),
    attackGain: gainOf(curves.attack) + (equipmentBonus?.attack ?? 0),
    defenseGain: gainOf(curves.defense) + (equipmentBonus?.defense ?? 0),
    mindGain: gainOf(curves.mind) + (equipmentBonus?.mind ?? 0),
    agilityGain: gainOf(curves.agility) + (equipmentBonus?.agility ?? 0),
    learnedSkillIds: [...learnedSkillIds],
    ...(equipmentBonus ? { equipmentBonus } : {}),
  };
}

/**
 * 기술 포인트(TP) 습득. 누적 TP 가 문턱 이상이고 레벨도 채운, 아직 모르는 기술을 돌려준다.
 * 전투 결과 미리보기(runtime)와 세션 적립(battleRewardsToSession)이 같은 함수를 쓴다.
 */
export function computeTechPointLearning(
  project: Project,
  actorId: string,
  level: number,
  totalTp: number,
  knownSkillIds: readonly SkillId[],
): SkillId[] {
  const record = project.database.actors.find((entry) => entry.id === actorId);
  if (!record) return [];
  const learned: SkillId[] = [];
  for (const entry of normalizeActorRecord(record).learnedSkills) {
    if (entry.tp === undefined || entry.tp > totalTp || entry.level > level) continue;
    if (knownSkillIds.includes(entry.skillId) || learned.includes(entry.skillId)) continue;
    learned.push(entry.skillId);
  }
  return learned;
}
