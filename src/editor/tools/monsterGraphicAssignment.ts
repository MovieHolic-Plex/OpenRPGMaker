// Broad resource search is for browsing. Writers require an exact identity or every
// semantic term; unrelated hash fallbacks must never become persisted monster art.
import { searchResources } from "@/assets/resourceSearch";
import { getMonsterResource, listMonsterResources } from "@/assets/monsterResourceCatalog";
import { charsetBattler } from "@/assets/charsetBattlers";
import { activeGenreLockVisualCatalog } from "@/project/genreLockVisuals";
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
  const candidates = availableCandidates(project);
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

const GENERIC_IDENTITY_TERM = /^(?:\*|all|전체|monster|monsters|enemy|enemies|generated|easyrpg|scarloxy|몬스터|적|괴물|보스|boss|\d+)$/u;

function availableCandidates(project: Project) {
  const available = new Set(listMonsterResources(project).map(resource => resource.resourceId));
  // 장르 잠금(조수 실행 중): 이름으로 그림을 고를 때도 허용 계열 그림만 후보다 — 일반 JRPG 적 그림으로 이름이 풀리지 않는다.
  const allows = activeGenreLockVisualCatalog()?.battler;
  return searchResources("monster", "*").filter((match) => available.has(match.id) && (!allows || allows(match.id)));
}

function semanticTermsOf(match: { label: string; tags: readonly string[] }): Set<string> {
  return new Set([...normalizedIdentity(match.label).split(" "), ...match.tags.map(normalizedIdentity)]);
}

/**
 * 이름만으로 모든 단어가 맞지 않을 때, 모델이 appearanceTags 로 **따로 선언한** 정체성이 이름에도 있으면
 * 그 정체성으로 고른다. r0735: 「서리 슬라임」+ appearanceTags ["슬라임","약함","젤리"] 가 「서리」 때문에
 * 거부됐고, 이어진 upsert_troop 도 없는 적 때문에 실패했다. 이름·선언 태그·소재 태그 세 곳이 같은 구체
 * 정체성 단어를 가리킬 때만 고른다 — 형용사 하나나 이름 조각만으로는 여전히 고르지 않는다.
 */
function corroboratedMonsterResource(
  project: Project,
  query: string,
  appearanceTags: readonly unknown[] | undefined,
): { id: string; label: string; identity: string[]; unmatched: string[]; alternatives: string[] } | undefined {
  if (!Array.isArray(appearanceTags) || appearanceTags.length === 0) return undefined;
  const nameTerms = normalizedIdentity(query).split(" ").filter(Boolean);
  const declared = new Set(appearanceTags.filter((tag): tag is string => typeof tag === "string").map(normalizedIdentity).filter(Boolean));
  const identity = nameTerms.filter((term) => declared.has(term) && !GENERIC_IDENTITY_TERM.test(term));
  if (identity.length === 0) return undefined;
  const wanted = new Set([...nameTerms, ...declared]);
  const ranked = availableCandidates(project)
    .map((match) => ({ match, terms: semanticTermsOf(match) }))
    .filter(({ terms }) => identity.every((term) => terms.has(term)))
    .map(({ match, terms }) => ({ match, score: [...wanted].filter((term) => terms.has(term)).length }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best) return undefined;
  const bestTerms = semanticTermsOf(best.match);
  return {
    id: best.match.id,
    label: best.match.label,
    identity,
    unmatched: nameTerms.filter((term) => !bestTerms.has(term)),
    alternatives: ranked.slice(1, 4).map(({ match }) => match.id),
  };
}

function resolveMonsterResource(
  project: Project,
  query: string,
  label: string,
  appearanceTags: readonly unknown[] | undefined,
  warnings: string[],
): string | undefined {
  const exact = matchingMonsterResourceId(project, query);
  if (exact) return exact;
  const corroborated = corroboratedMonsterResource(project, query, appearanceTags);
  if (!corroborated) return undefined;
  warnings.push(
    `${label}: "${query}"에 모든 단어가 맞는 외형이 없어 이름과 appearanceTags 가 함께 가리키는 정체성 `
    + `'${corroborated.identity.join(" ")}' 으로 "${corroborated.id}"(${corroborated.label})를 붙였습니다`
    + (corroborated.unmatched.length ? ` — '${corroborated.unmatched.join(" ")}' 는 외형에 반영되지 않았습니다` : "")
    + (corroborated.alternatives.length ? `. 다른 후보: ${corroborated.alternatives.join(", ")}` : "")
    + `. 다르면 ${label} 에 리소스 ID 를 지정하세요.`,
  );
  return corroborated.id;
}

function missingGraphicError(project: Project, value: string, label: string, code: string): ToolError {
  // 이름 단어가 태그에 걸리는 소재를 먼저 보여 준다(「서리 슬라임」→ 슬라임들). 없으면 목록 앞부분.
  const terms = normalizedIdentity(value).split(" ").filter((term) => term && !GENERIC_IDENTITY_TERM.test(term));
  const related = availableCandidates(project).filter((match) => {
    const semantic = semanticTermsOf(match);
    return terms.some((term) => semantic.has(term));
  }).map((match) => match.id);
  const examples = (related.length ? related.slice(0, 6) : listMonsterResources(project).slice(0, 3).map(resource => resource.resourceId)).join(", ");
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
  appearanceTags?: readonly unknown[],
  warnings: string[] = [],
): MonsterGraphicAssignment {
  const resourceId = resolveMonsterResource(project, record.name, label, appearanceTags, warnings);
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
  appearanceTags?: readonly unknown[],
  options: { readonly pendingWhenLocked?: boolean } = {},
): void {
  const value = graphic.monsterResourceId;
  if (value !== undefined) {
    // Explicit IDs are author decisions, not names to reinterpret on later edits.
    // (장르 잠금 중 허용 밖 id 는 실행기 판정 enforceGenreLockVisuals 가 대안과 함께 거부하거나 「생성 대기」로 비운다 — 여기서는 존재만 본다.)
    if (getMonsterResource(project, value)) return;
    // 사람 적(기사·동료의 적 판): 아군과 같은 걷기 칩 전투 시트(charset-battler-*)는 전투가 적으로 그린다(battleFieldDom charsetEnemy).
    // 몬스터 목록에는 없으니 정확한 id 일 때만 그대로 받는다 — 이름 해석으로 사람 시트를 고르지는 않는다.
    if (!Object.hasOwn(project.assets.uploaded, value) && charsetBattler(value)) return;
    if (Object.hasOwn(project.assets.uploaded, value)) {
      throw missingGraphicError(project, value, label, "invalid-args");
    }
    const notes: string[] = [];
    const resolved = resolveMonsterResource(project, value, label, appearanceTags, notes);
    if (!resolved) throw missingGraphicError(project, value, label, "invalid-args");
    graphic.monsterResourceId = resolved;
    warnings.push(...(notes.length ? notes : [`${label} 자동 해석: "${value}" → "${resolved}"`]));
    return;
  }
  if (graphic.transparent === true) return;
  const notes: string[] = [];
  // 장르 잠금(조수 실행 중): 허용 그림에 맞는 것이 없으면 거부하지 않고 그림 없이 저장한다 — 「생성 대기」. 지어낸 그림·일반 적 그림으로 때우지 않는다.
  if (options.pendingWhenLocked && activeGenreLockVisualCatalog()) {
    try {
      graphic.monsterResourceId = assignMonsterResourceId(project, record, label, appearanceTags, notes).resourceId;
      warnings.push(...(notes.length ? notes : [`${label} 누락 → 이름 "${record.name}" 으로 "${graphic.monsterResourceId}" 를 붙였습니다.`]));
    } catch (error) {
      if (!(error instanceof ToolError)) throw error;
      warnings.push(`장르 잠금 — 생성 대기: ${record.name}(${record.id}) 의 ${label} 에 맞는 허용 몬스터 그림(Scarloxy·하네스 몬스터)이 없어 그림 없이 저장했다. `
        + `일반 적 그림으로 때우지 않는다 — 이미 있는 허용 그림 id 를 list_resources(kind:monster)에서 골라 지정하거나, 새 그림(앞·뒷모습)은 사람이 고르는 하네스(npm run harness -- monster-collect-species)에서 만든다. check_genre_lock 이 이 칸을 「생성 대기」로 보고한다.`);
    }
    return;
  }
  const assignment = assignMonsterResourceId(project, record, label, appearanceTags, notes);
  graphic.monsterResourceId = assignment.resourceId;
  warnings.push(...(notes.length ? notes : [`${label} 누락 → 이름 "${record.name}" 으로 "${assignment.resourceId}" 를 붙였습니다.`]));
}

/**
 * 계통 배치 정의(define_monster_families autoGraphics:true)용 — 이름에 맞는 외형이 없을 때 **저작자가 명시적으로 허용한** 자동 배정.
 * 아직 어느 종·적도 안 쓰는 카탈로그 외형을 태그가 겹치는 순으로 고르고, 모자라면 undefined(호출자가 그 계통만 실패로 보고한다).
 * 이름과 어울리는지는 보장하지 않는다 — 호출자가 어떤 외형을 붙였는지 경고로 돌려줘야 한다.
 */
export function pickUnusedMonsterResource(project: Project, used: ReadonlySet<string>, tags: readonly unknown[] | undefined): { id: string; label: string } | undefined {
  const wanted = new Set((tags ?? []).filter((tag): tag is string => typeof tag === "string").map(normalizedIdentity));
  const free = availableCandidates(project).filter((match) => !used.has(match.id));
  if (!free.length) return undefined;
  const scored = free.map((match) => ({ match, score: [...semanticTermsOf(match)].filter((term) => wanted.has(term)).length }));
  scored.sort((a, b) => b.score - a.score);
  return { id: scored[0]!.match.id, label: scored[0]!.match.label };
}
