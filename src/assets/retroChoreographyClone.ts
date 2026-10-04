import { BUNDLED_BATTLE_MOTIONS } from "@/assets/battleMotionCatalog";
// 연출 레코드 복제·새 id 의 유일한 구현. 조수 도구(duplicate_choreography)와 자료집 「도트 연출」 탭이 같이 쓴다.
// 기본 연출(번들 계약)은 읽기 전용이라, 고치려면 이 모듈로 프로젝트 레코드(chor_*)를 만든다.
import { retroChoreographyEntries, retroClassSkill } from "@/assets/retroSkillCatalog";
import { retroMonsterSkill } from "@/assets/retroMonsterSkills";
import { SKILL_CHOREOGRAPHY_ID_PREFIX, normalizeSkillChoreographyRecord } from "@/project/skillChoreographyRecords";
import type { SkillChoreographyLayer, SkillChoreographyRecord } from "@/project/types/database";

function slugify(value: string): string {
  return value.toLowerCase().replace(/^skill_/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

/** 이름·원본에서 chor_<slug> 를 만들고 겹치면 _2, _3… 을 붙인다. 한글 이름처럼 slug 가 비면 chor_custom. */
export function freshChoreographyId(records: readonly SkillChoreographyRecord[], hint: string): string {
  const base = `${SKILL_CHOREOGRAPHY_ID_PREFIX}${slugify(hint) || "custom"}`;
  let id = base;
  for (let n = 2; records.some((record) => record.id === id); n += 1) id = `${base}_${n}`;
  return id;
}

export type ChoreographyCloneBase = { readonly base: Omit<SkillChoreographyRecord, "id" | "name">; readonly sourceName: string; readonly fromProject: boolean };

/** 원본(프로젝트 chor_* 또는 기본 skill_*)에서 복제 바탕을 만든다. 원본이 없으면 undefined. */
export function choreographyCloneBase(records: readonly SkillChoreographyRecord[], sourceId: string): ChoreographyCloneBase | undefined {
  const project = records.find((record) => record.id === sourceId);
  if (project) {
    const { id: _id, name: _name, ...rest } = structuredClone(project);
    // 원본이 이미 기본 연출을 복제한 것이면 그 계보(직업/몬스터 편)를 지키고, 아니면 이 프로젝트 원본을 가리킨다.
    return { base: { ...rest, sourceId: project.sourceId ?? project.id }, sourceName: project.name, fromProject: true };
  }
  const bundled=BUNDLED_BATTLE_MOTIONS.find(r=>r.id===sourceId);
  if(bundled){const {id:_id,name,...base}=structuredClone(bundled);return {base:{...base,sourceId},sourceName:name,fromProject:false};}
  const skill = retroClassSkill(sourceId) ?? retroMonsterSkill(sourceId);
  if (!skill) return undefined;
  const entry = retroChoreographyEntries().find((row) => row.id === sourceId);
  return {
    base: {
      motion: skill.motion,
      ...(skill.description ? { description: skill.description } : {}),
      layers: skill.layers.map((layer): SkillChoreographyLayer => ({
        sheet: layer.key, anchor: layer.anchor,
        ...(layer.startMs !== undefined ? { startMs: layer.startMs } : {}),
        ...(layer.scale !== undefined ? { scale: layer.scale } : {}),
        ...(layer.repeat !== undefined ? { repeat: layer.repeat } : {}),
        ...(layer.onHit !== undefined ? { onHit: layer.onHit } : {}),
        ...(layer.tint !== undefined ? { tint: layer.tint } : {}),
        ...(layer.se !== undefined ? { se: layer.se } : {}),
      })),
      ...(entry?.element ? { tags: { family: entry.family, element: entry.element } } : entry ? { tags: { family: entry.family } } : {}),
      sourceId,
    },
    sourceName: skill.name,
    fromProject: false,
  };
}

/** 복제 레코드 한 건. 편집기 탭이 쓴다(도구는 오류 문구가 달라 choreographyCloneBase 를 직접 쓴다). */
export function cloneChoreographyRecord(records: readonly SkillChoreographyRecord[], sourceId: string, name?: string): SkillChoreographyRecord | undefined {
  const source = choreographyCloneBase(records, sourceId);
  if (!source) return undefined;
  const finalName = name ?? `${source.sourceName} 사본`;
  return normalizeSkillChoreographyRecord({ ...source.base, id: freshChoreographyId(records, source.fromProject ? finalName : sourceId), name: finalName }) ?? undefined;
}
