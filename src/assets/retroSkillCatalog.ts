// retro2003 직업 스킬 **공용 조회 한 곳** — 기존 12직업 계약(retroClassSkills.ts)과 2차 로스터 묶음(retroRosterSkills/*)을 합친다.
// 런타임 재생기·편집기 스킬 탭·기본 DB 생성기가 모두 여기서 읽는다. 계약 파일은 읽기 전용이라 합치는 자리를 따로 둔다.
import { RETRO_CLASS_SKILLS, retroClassSkill as baseClassSkill, type RetroClassSkill, type RetroFxLayer } from "@/assets/retroClassSkills";
import { RETRO_ROSTER_SKILLS } from "@/assets/retroRosterSkills";
import { retroMonsterSkill, type RetroMonsterSkill } from "@/assets/retroMonsterSkills";

/** 기존 96개 + 로스터 묶음 스킬 전부. */
export const RETRO_ALL_CLASS_SKILLS: readonly RetroClassSkill[] = [...RETRO_CLASS_SKILLS, ...RETRO_ROSTER_SKILLS];

/** 이펙트 시트(키 하나 = 시트 한 장) 목록. 같은 키는 첫 정의를 쓴다. */
export const RETRO_ALL_FX_SHEETS: readonly RetroFxLayer[] = [...new Map(RETRO_ALL_CLASS_SKILLS.flatMap((skill) => skill.layers).map((layer) => [layer.key, layer])).values()];

const rosterById = new Map(RETRO_ROSTER_SKILLS.map((skill) => [skill.id, skill]));

/** 기존 계약 → 로스터 묶음 순으로 찾는다. */
export function retroClassSkill(id: string | undefined): RetroClassSkill | undefined {
  return baseClassSkill(id) ?? (id ? rosterById.get(id) : undefined);
}

/** 연출을 빌릴 수 있는 레코드 모양(SkillRecord 의 일부). */
export interface RetroChoreographyRef {
  readonly id: string;
  /** 계약에 없는 스킬이 연출만 빌려 올 계약 스킬 id. 자기 id 가 계약이면 무시한다. */
  readonly retroChoreographyId?: string;
}

/**
 * 스킬 레코드의 직업 연출 계약. 조회 순서: ① 레코드 id 가 계약이면 그것 ② 아니면 retroChoreographyId 가 가리키는 직업 계약.
 * 새 스킬·복제 스킬이 계약 약 850개 연출을 그대로 빌려 쓰는 유일한 길이다(런타임 재생기·편집기 무대·조수 도구가 모두 여기서 읽는다).
 */
export function resolveRetroClassChoreography(record: RetroChoreographyRef | undefined): RetroClassSkill | undefined {
  if (!record) return undefined;
  return retroClassSkill(record.id) ?? retroClassSkill(record.retroChoreographyId);
}

/** 위와 같으나 몬스터 계약(skill_mon_*) 쪽. 적 스킬이 다른 몬스터 스킬의 연출을 빌릴 때 쓴다. */
export function resolveRetroMonsterChoreography(record: RetroChoreographyRef | undefined): RetroMonsterSkill | undefined {
  if (!record) return undefined;
  return retroMonsterSkill(record.id) ?? retroMonsterSkill(record.retroChoreographyId);
}

/** 계약 id 하나가 직업 계약인가 몬스터 계약인가(도구 검증용). */
export function retroChoreographyKind(id: string | undefined): "class" | "monster" | undefined {
  if (!id) return undefined;
  return retroClassSkill(id) ? "class" : retroMonsterSkill(id) ? "monster" : undefined;
}

/**
 * 스킬을 복제할 때 사본이 가져갈 연출 계약 id. 원본 id 가 계약이면 그 id, 이미 빌려 쓰고 있으면 그 계약 id, 아니면 undefined.
 * 사본은 새 id 라 계약 조회에서 빠지므로, 이 값을 retroChoreographyId 에 넣어 원본과 같은 도트 연출을 이어받게 한다.
 */
export function retroChoreographyIdForClone(source: RetroChoreographyRef): string | undefined {
  return resolveRetroClassChoreography(source)?.id ?? resolveRetroMonsterChoreography(source)?.id;
}
