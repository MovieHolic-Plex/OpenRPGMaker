// 마석(FF6 에스퍼) 성장: AP 영구 습득 + 레벨업 보너스. 순수 함수 — 세션을 모르고 입력만 받는다.
// 전투 결과 미리보기(runtime.ts)와 세션 적립(player/battleRewardsToSession.ts)이 같은 함수를 쓴다.
import { logicalEquipmentIds } from "@/project/equipmentRules";
import type { ActorInitialEquipment, EquipmentLevelUpBonus, EquipmentRecord, Project, SkillId } from "@/project/types";

export const DEFAULT_AP_RATE = 100;

/** 이 배우가 지금 낀 장비 레코드(논리 장비: 양손 무기의 방패 거울 제외). */
export function equippedRecords(project: Project, equipment: ActorInitialEquipment | undefined): EquipmentRecord[] {
  if (!equipment) return [];
  const seen = new Set<string>();
  const out: EquipmentRecord[] = [];
  for (const id of logicalEquipmentIds(project, equipment)) {
    if (seen.has(id)) continue;
    seen.add(id);
    const record = project.database.equipment.find((entry) => entry.id === id);
    if (record) out.push(record);
  }
  return out;
}

/** 프로젝트에 AP·레벨업 보너스를 쓰는 장비가 하나라도 있는가. 없으면 모든 계산을 건너뛴다(기존 프로젝트 불변). */
export function projectUsesEsperGrowth(project: Project): boolean {
  return project.database.equipment.some((record) => (record.apGrants?.length ?? 0) > 0 || record.levelUpBonus !== undefined);
}

export interface ApLearning {
  /** 승리 뒤 배우의 스킬별 누적 AP(이전 진행 + 이번 몫). 새로 배운 스킬의 진행치도 남긴다. */
  readonly progress: Record<SkillId, number>;
  /** 이번에 새로 영구 습득한 스킬(어느 마석에서 배웠는지 포함). */
  readonly learned: readonly { readonly skillId: SkillId; readonly equipmentId: string }[];
  /** 이번 전투에서 장착 마석이 실제로 받은 AP(습률 반영, 마석 하나 기준 최대). 결과 화면용. */
  readonly earned: number;
}

/**
 * 장착한 마석의 apGrants 에 earnedAp 를 쌓고 필요 AP 를 채운 스킬을 영구 습득으로 돌려준다.
 * - 한 마석의 몫 = max(1, round(earnedAp × apRate / 100)). earnedAp 가 0 이면 아무것도 쌓지 않는다.
 * - 이미 아는 스킬(known)에는 쌓지 않는다 — 영구 습득은 한 번이다. 장착 부여(grantsSkillIds)로 쓰는 중인 스킬은 아는 것이 아니다.
 * - 같은 스킬을 여러 장착 마석이 가르치면 몫을 합하고, 필요 AP 는 그 중 가장 낮은 값이다.
 */
export function computeApLearning(
  project: Project,
  equipment: ActorInitialEquipment | undefined,
  earnedAp: number,
  previousProgress: Readonly<Record<SkillId, number>> | undefined,
  knownSkillIds: readonly SkillId[],
): ApLearning {
  const progress: Record<SkillId, number> = { ...(previousProgress ?? {}) };
  const learned: { skillId: SkillId; equipmentId: string }[] = [];
  if (earnedAp <= 0) return { progress, learned, earned: 0 };
  const share = new Map<SkillId, { gain: number; need: number; equipmentId: string }>();
  let earned = 0;
  for (const record of equippedRecords(project, equipment)) {
    if (!record.apGrants?.length) continue;
    const gain = Math.max(1, Math.round((earnedAp * (record.apRate ?? DEFAULT_AP_RATE)) / 100));
    earned = Math.max(earned, gain);
    for (const grant of record.apGrants) {
      if (knownSkillIds.includes(grant.skillId)) continue;
      const entry = share.get(grant.skillId);
      if (entry) {
        entry.gain += gain;
        if (grant.ap < entry.need) { entry.need = grant.ap; entry.equipmentId = record.id; }
      } else {
        share.set(grant.skillId, { gain, need: grant.ap, equipmentId: record.id });
      }
    }
  }
  for (const [skillId, entry] of share) {
    const total = (progress[skillId] ?? 0) + entry.gain;
    progress[skillId] = total;
    if (total >= entry.need) learned.push({ skillId, equipmentId: entry.equipmentId });
  }
  return { progress, learned, earned };
}

/** 레벨업 한 번에 더해지는 보너스 합(장착 마석 전부). 퍼센트는 그 레벨의 곡선 최대치를 기준으로 호출 쪽이 환산한다. */
export function combinedLevelUpBonus(project: Project, equipment: ActorInitialEquipment | undefined): EquipmentLevelUpBonus | undefined {
  const total: EquipmentLevelUpBonus = {};
  let any = false;
  for (const record of equippedRecords(project, equipment)) {
    const bonus = record.levelUpBonus;
    if (!bonus) continue;
    for (const key of Object.keys(bonus) as (keyof EquipmentLevelUpBonus)[]) {
      const value = bonus[key];
      if (typeof value !== "number" || value === 0) continue;
      total[key] = (total[key] ?? 0) + value;
      any = true;
    }
  }
  return any ? total : undefined;
}

export interface LevelUpEquipmentGain {
  readonly maxHp: number;
  readonly maxMp: number;
  readonly attack: number;
  readonly defense: number;
  readonly mind: number;
  readonly agility: number;
}

/**
 * fromLevel 보다 위, toLevel 이하의 각 레벨마다 보너스를 한 번씩 받는다.
 * maxHpPercent·maxMpPercent 는 그 레벨 곡선 최대치(curveMaxHp(level))의 %를 반올림해 더한다(최소 1).
 */
export function levelUpEquipmentGain(
  bonus: EquipmentLevelUpBonus | undefined,
  fromLevel: number,
  toLevel: number,
  curveAt: (stat: "maxHp" | "maxMp", level: number) => number,
): LevelUpEquipmentGain | undefined {
  if (!bonus || toLevel <= fromLevel) return undefined;
  const gain = { maxHp: 0, maxMp: 0, attack: 0, defense: 0, mind: 0, agility: 0 };
  for (let level = fromLevel + 1; level <= toLevel; level += 1) {
    if (bonus.maxHpPercent) gain.maxHp += Math.max(1, Math.round((curveAt("maxHp", level) * bonus.maxHpPercent) / 100));
    if (bonus.maxMpPercent) gain.maxMp += Math.max(1, Math.round((curveAt("maxMp", level) * bonus.maxMpPercent) / 100));
    gain.attack += bonus.attack ?? 0;
    gain.defense += bonus.defense ?? 0;
    gain.mind += bonus.mind ?? 0;
    gain.agility += bonus.agility ?? 0;
  }
  const nonZero = Object.values(gain).some((value) => value !== 0);
  return nonZero ? gain : undefined;
}
