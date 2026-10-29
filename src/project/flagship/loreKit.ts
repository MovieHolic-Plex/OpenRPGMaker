/**
 * 데모 「이야기」 탭(세계 개요·설정집·인물) 저작 도우미.
 *
 * 왜: 데모 빌더는 맵·이벤트·DB 만 짓고 자료집 「이야기」 칸을 하나도 채우지 않았다(2026-10-29 실측 — 구운
 * chrono-bell.project.json 에 worldCanon 없음 · world.entities 0 · characters 0). 판매용 데모를 열면 이 게임이
 * 어떤 세계·인물·이야기인지 읽혀야 한다. 데모마다 `*Lore.ts` 하나가 조수 도구(set_world_canon ·
 * upsert_world_codex · upsert_character_profile)로 그 칸을 채우고, 빌더 끝에서 한 줄로 부른다.
 *
 * 이 파일은 빌더·굽기 어느 쪽 모듈에도 기대지 않는다 — 다른 브랜치의 데모(마왕 편의점)도 그대로 가져다 쓴다.
 */
import { runTool } from "@/editor/tools/toolRunner";
import type { Project } from "@/project/types";
import { worldCanonHasContent } from "@/project/world/canon";

export type LoreExec = (project: Project, name: string, args: Record<string, unknown>) => unknown;

/** 조수와 같은 도구 경로로 쓴다. 도구는 초안 사본에 쓰고, 결과를 project 에 덮는다. */
export const loreExec: LoreExec = (project, name, args) => {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) throw new Error(`[demo-lore] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  Object.assign(project, ctx.project);
  return (res as { data?: unknown }).data;
};

export interface DemoLoreCounts {
  readonly worldCanon: boolean;
  readonly premise: boolean;
  readonly bodyChars: number;
  readonly entities: number;
  readonly hiddenEntities: number;
  readonly relations: number;
  readonly characters: number;
}

export function demoLoreCounts(project: Project): DemoLoreCounts {
  const entities = project.world?.entities ?? [];
  return {
    worldCanon: worldCanonHasContent(project.worldCanon),
    premise: Boolean(project.worldCanon?.premise?.trim()),
    bodyChars: project.worldCanon?.body?.length ?? 0,
    entities: entities.length,
    hiddenEntities: entities.filter((entity) => entity.visibility === "ai-hidden").length,
    relations: project.world?.relations.length ?? 0,
    characters: Object.keys(project.characters ?? {}).length,
  };
}

/** 데모 하한 — 이보다 비면 「이야기」 탭을 연 사람이 이 게임을 읽을 수 없다. */
export const DEMO_LORE_MINIMUM = { entities: 12, characters: 3, bodyChars: 400 } as const;

/** 비어 있는 칸을 사람이 읽는 문장으로. 빈 배열이면 통과. 굽기(bake-flagship-demos)가 경고로 찍는다. */
export function demoLoreProblems(project: Project): string[] {
  const counts = demoLoreCounts(project);
  const problems: string[] = [];
  if (!counts.worldCanon) problems.push("세계 개요(worldCanon)가 비어 있다");
  else {
    if (!counts.premise) problems.push("세계 개요의 전제(premise)가 비어 있다");
    if (counts.bodyChars < DEMO_LORE_MINIMUM.bodyChars) problems.push(`세계 개요 본문이 ${counts.bodyChars}자뿐이다(하한 ${DEMO_LORE_MINIMUM.bodyChars})`);
  }
  if (counts.entities < DEMO_LORE_MINIMUM.entities) problems.push(`설정집 문서가 ${counts.entities}개뿐이다(하한 ${DEMO_LORE_MINIMUM.entities})`);
  if (counts.characters < DEMO_LORE_MINIMUM.characters) problems.push(`인물 프로필이 ${counts.characters}개뿐이다(하한 ${DEMO_LORE_MINIMUM.characters})`);
  return problems;
}

/** 설정집 문서 한 장 — upsert_world_codex entries 의 한 칸. */
export interface CodexEntry {
  readonly id: string;
  readonly type: "character" | "place" | "faction" | "event" | "item" | "concept" | "guideline";
  readonly name: string;
  readonly summary: string;
  readonly body?: string;
  readonly tags?: readonly string[];
  readonly refs?: readonly { readonly kind: "map" | "event" | "item" | "skill" | "actor"; readonly id: string }[];
  readonly visibility?: "public" | "ai-hidden";
  readonly source?: string;
}

export interface CodexRelation {
  readonly a: string;
  readonly b: string;
  readonly kind: "memberOf" | "locatedIn" | "knows" | "enemyOf" | "allyOf" | "causedBy" | "owns" | "custom";
  readonly note?: string;
}

/**
 * 문서·관계를 도구 한도(한 번에 32장·64줄)에 맞춰 나눠 쓴다. 관계는 문서가 다 들어간 뒤 마지막에 쓴다.
 * refs 가 가리키는 맵·이벤트가 프로젝트에 없으면(다른 판본에서 지운 경우) 그 ref 만 빼고 쓴다 — 설정 글은 남아야 한다.
 */
export function writeCodex(project: Project, exec: LoreExec, entries: readonly CodexEntry[], relations: readonly CodexRelation[] = []): void {
  const exists = (kind: string, id: string): boolean => {
    if (kind === "map") return Boolean(project.maps[id]);
    if (kind === "event") return Object.values(project.maps).some((map) => map.events.some((event) => event.id === id));
    if (kind === "item") return project.database.items.some((item) => item.id === id);
    if (kind === "skill") return project.database.skills.some((skill) => skill.id === id);
    if (kind === "actor") return project.database.actors.some((actor) => actor.id === id);
    return false;
  };
  const cleaned = entries.map((entry) => {
    const refs = entry.refs?.filter((ref) => exists(ref.kind, ref.id));
    return { ...entry, ...(entry.refs ? { refs: refs && refs.length > 0 ? refs : undefined } : {}) };
  });
  for (let index = 0; index < cleaned.length; index += 32) {
    exec(project, "upsert_world_codex", { entries: JSON.parse(JSON.stringify(cleaned.slice(index, index + 32))) });
  }
  for (let index = 0; index < relations.length; index += 64) {
    exec(project, "upsert_world_codex", { relations: relations.slice(index, index + 64).map((relation) => ({ ...relation })) });
  }
}
