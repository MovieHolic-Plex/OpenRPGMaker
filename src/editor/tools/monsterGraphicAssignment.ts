// Broad resource search is for browsing. Writers require an exact identity or every
// semantic term; unrelated hash fallbacks must never become persisted monster art.
import { searchResources } from "@/assets/resourceSearch";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import type { Project } from "@/project/types";
import { ToolError } from "./types";

function normalizedIdentity(value: string): string {
  return value.normalize("NFKC").toLowerCase().trim().replace(/[-_\s]+/gu, " ");
}

function matchingMonsterResourceId(project: Project, query: string): string | undefined {
  const normalized = normalizedIdentity(query);
  const terms = normalized.split(" ");
  // Browse commands and catalog/category words carry no monster identity.
  if (!normalized || terms.some((term) => /^(?:\*|all|전체|monster|enemy|generated|easyrpg|scarloxy|몬스터|적|\d+)$/u.test(term))) return undefined;
  const available = collectResourceIds(project);
  const candidates = searchResources("monster", "*").filter((match) => available.has(match.id));
  const exact = candidates.find((match) =>
    normalizedIdentity(match.label) === normalized ||
    normalizedIdentity(match.id.replace(/^(?:generated-enemy-|easyrpg-monster-|scarloxy-monster-)/u, "").replace(/-01$/u, "")) === normalized,
  );
  if (exact) return exact.id;
  return candidates.find((match) => {
    // Whole tags only: "leaf" must not match "leafling", and a prompt substring
    // or one matched adjective must not establish the creature's identity.
    const semanticTerms = new Set([
      ...normalizedIdentity(match.label).split(" "),
      ...match.tags.map(normalizedIdentity),
    ]);
    return terms.every((term) => semanticTerms.has(term));
  })?.id;
}

function missingGraphicError(project: Project, value: string, label: string, code: string): ToolError {
  const available = collectResourceIds(project);
  const examples = searchResources("monster", "*").filter((match) => available.has(match.id)).slice(0, 3).map((match) => match.id).join(", ");
  return new ToolError(
    `${label}: "${value}"에 확실히 맞는 외형이 없습니다. list_resources(kind:"monster", query:"*")로 확인한 리소스 ID를 ${label}에 지정하세요. 사용 가능한 monster 리소스 예시: ${examples}`,
    { code },
  );
}

export type MonsterGraphicAssignment = {
  readonly resourceId: string;
};

export function assignMonsterResourceId(
  project: Project,
  record: { readonly id: string; readonly name: string },
  label = "monsterResourceId",
): MonsterGraphicAssignment {
  const resourceId = matchingMonsterResourceId(project, record.name);
  if (!resourceId) throw missingGraphicError(project, record.name, label, "monster-graphic-required");
  return { resourceId };
}

/** Shared by enemy, species, and action-enemy writers, after merging existing fields. */
export function ensureMonsterGraphic(
  project: Project,
  record: { readonly id: string; readonly name: string },
  graphic: { monsterResourceId?: string; readonly transparent?: boolean },
  label: string,
  warnings: string[],
): void {
  const value = graphic.monsterResourceId;
  if (value !== undefined) {
    // Explicit IDs are author decisions, not names to reinterpret on later edits.
    if (collectResourceIds(project).has(value)) return;
    const resolved = matchingMonsterResourceId(project, value);
    if (!resolved) throw missingGraphicError(project, value, label, "invalid-args");
    graphic.monsterResourceId = resolved;
    warnings.push(`${label} 자동 해석: "${value}" → "${resolved}"`);
    return;
  }
  if (graphic.transparent === true) return;
  const assignment = assignMonsterResourceId(project, record, label);
  graphic.monsterResourceId = assignment.resourceId;
  warnings.push(`${label} 누락 → 이름 "${record.name}" 으로 "${assignment.resourceId}" 를 붙였습니다.`);
}
