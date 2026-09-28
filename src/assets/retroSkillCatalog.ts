// retro2003 직업 스킬 **공용 조회 한 곳** — 기존 12직업 계약(retroClassSkills.ts)과 2차 로스터 묶음(retroRosterSkills/*)을 합친다.
// 런타임 재생기·편집기 스킬 탭·기본 DB 생성기가 모두 여기서 읽는다. 계약 파일은 읽기 전용이라 합치는 자리를 따로 둔다.
import { RETRO_CLASS_SKILLS, retroClassSkill as baseClassSkill, type RetroClassSkill, type RetroFxLayer } from "@/assets/retroClassSkills";
import { RETRO_ROSTER_SKILLS } from "@/assets/retroRosterSkills";

/** 기존 96개 + 로스터 묶음 스킬 전부. */
export const RETRO_ALL_CLASS_SKILLS: readonly RetroClassSkill[] = [...RETRO_CLASS_SKILLS, ...RETRO_ROSTER_SKILLS];

/** 이펙트 시트(키 하나 = 시트 한 장) 목록. 같은 키는 첫 정의를 쓴다. */
export const RETRO_ALL_FX_SHEETS: readonly RetroFxLayer[] = [...new Map(RETRO_ALL_CLASS_SKILLS.flatMap((skill) => skill.layers).map((layer) => [layer.key, layer])).values()];

const rosterById = new Map(RETRO_ROSTER_SKILLS.map((skill) => [skill.id, skill]));

/** 기존 계약 → 로스터 묶음 순으로 찾는다. */
export function retroClassSkill(id: string | undefined): RetroClassSkill | undefined {
  return baseClassSkill(id) ?? (id ? rosterById.get(id) : undefined);
}
