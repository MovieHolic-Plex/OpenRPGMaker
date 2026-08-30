// ai/preferenceMemory.ts
// 사람의 성향 기억 — 프로젝트가 아니라 **사람**에 붙는 선호를 저장하고, 시스템 프롬프트 블록으로 조립한다.
//
// 왜 필요한가(실측): 이 엔진의 AI 가 아는 것은 프로젝트 스냅샷(contextBuilder)과 이번 세션 대화뿐이었다.
// 대화는 conversationStore 가 남기지만 스코프가 conversationScopeKey() = 프로젝트 단위이고, 그 기록이
// 다음 턴 프롬프트로 들어가는 경로가 아예 없었다 — 그래서 같은 사람이 같은 취향을 매번 다시 말해야 했다.
//
// 2층 스코프:
// - global  : 사람 자체의 습관(규모 취향, 되묻기 선호, 톤). 프로젝트를 바꿔도 유지된다.
// - project : "이 게임은 호러다" 처럼 그 프로젝트에서만 참인 사실. conversationScopeKey() 를 키로 쓴다.
//
// localStorage 가 정본이다(conversationStore 와 같은 관례). 원격 미러는 anon 키로 접근 가능한 테이블이
// 없어서 v1 범위 밖 — supabaseRlsCoverage 계약이 신규 마이그레이션의 anon GRANT 를 막는다.
//
// 구성: 순수 계산(정규화·축출·블록 조립) + localStorage 게이트(load/save). 브라우저 비의존 —
// localStorage 가 없으면 로드는 빈 목록, 저장은 조용히 no-op(Node/테스트에서 동일 동작).

import { genId } from "@/util/id";

export type PreferenceScope = "global" | "project";
export type PreferenceStrength = "strong" | "medium" | "weak";
/** 관측(집계에서 파생) · 선언(사용자가 대화에서 말함) · 수동(설정 화면에서 직접 씀). */
export type PreferenceSource = "observed" | "stated" | "manual";

export interface PreferenceFact {
  readonly id: string;
  /** 한 문장. 프롬프트에 그대로 실린다. */
  readonly text: string;
  readonly scope: PreferenceScope;
  /** scope === "project" 일 때만 의미가 있다(conversationScopeKey 값). */
  readonly projectScopeKey?: string;
  readonly strength: PreferenceStrength;
  /** 이 성향을 뒷받침한 관측 횟수. 축출 순위와 강도 승격에 쓴다. */
  readonly evidence: number;
  readonly source: PreferenceSource;
  readonly updatedAt: number;
  /** 사용자가 고정한 항목 — 축출·증류 drop 대상에서 제외된다. */
  readonly pinned?: boolean;
}

export const PREFERENCE_MEMORY_STORAGE_KEY = "oprn:ai-preference-memory";

/** 스코프별 보관 상한. 초과분은 pinned 를 제외하고 최약체부터 축출된다. */
export const GLOBAL_PREFERENCE_LIMIT = 16;
export const PROJECT_PREFERENCE_LIMIT = 8;

/** 프롬프트 블록 하드캡. 예산 밖 고정 블록이라 여기서 스스로 상한을 지켜야 한다. */
export const PREFERENCE_SECTION_MAX_LINES = 12;
export const PREFERENCE_SECTION_MAX_CHARS = 1200;

/** 한 성향 문장의 길이 상한 — 증류가 장문을 뱉어도 블록을 잡아먹지 못하게 한다. */
export const PREFERENCE_TEXT_MAX_CHARS = 160;

const STRENGTH_RANK: Record<PreferenceStrength, number> = { strong: 3, medium: 2, weak: 1 };
const STRENGTH_LABEL: Record<PreferenceStrength, string> = { strong: "강함", medium: "보통", weak: "약함" };

/**
 * 성향이 명시 지시를 이기지 못하게 하는 우선순위 문장. 이 줄이 없으면 모델이 기억된 취향을
 * 이번 턴 요청보다 위에 두고, "작게 해달라"는 과거 성향 때문에 "크게 만들어줘"를 거스른다.
 * 테스트가 이 상수의 존재를 블록 안에서 검증한다.
 */
export const PREFERENCE_PRECEDENCE_LINE =
  "아래는 이 사람의 선호다. 이번 지시와 충돌하면 **지시가 우선**한다. 성향을 근거로 되묻지 말고 기본값으로만 쓴다.";

export const PREFERENCE_SECTION_HEADING = "## 사용자 성향(과거 작업에서 기억됨)";
export const PREFERENCE_PROJECT_SUBHEADING = "### 이 프로젝트 한정";

// ── 순수 계산 ─────────────────────────────────────────────────────

/** 중복 판정용 정규화 — 공백 접기 + 소문자 + 문장부호 제거. */
export function normalizePreferenceText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?·—–\-"'`()[\]{}]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function isPreferenceFact(value: unknown): value is PreferenceFact {
  if (typeof value !== "object" || value === null) return false;
  const rec = value as Record<string, unknown>;
  if (typeof rec.id !== "string" || rec.id.length === 0) return false;
  if (typeof rec.text !== "string" || rec.text.trim().length === 0) return false;
  if (rec.scope !== "global" && rec.scope !== "project") return false;
  if (rec.scope === "project" && (typeof rec.projectScopeKey !== "string" || rec.projectScopeKey.length === 0)) return false;
  if (rec.strength !== "strong" && rec.strength !== "medium" && rec.strength !== "weak") return false;
  if (typeof rec.evidence !== "number" || !Number.isFinite(rec.evidence) || rec.evidence < 0) return false;
  if (rec.source !== "observed" && rec.source !== "stated" && rec.source !== "manual") return false;
  if (typeof rec.updatedAt !== "number" || !Number.isFinite(rec.updatedAt)) return false;
  if (rec.pinned !== undefined && typeof rec.pinned !== "boolean") return false;
  return true;
}

/** 강한 것 → 근거 많은 것 → 최신 순. 블록 정렬과 축출 순위가 같은 기준을 쓴다. */
export function comparePreferenceRank(a: PreferenceFact, b: PreferenceFact): number {
  const strength = STRENGTH_RANK[b.strength] - STRENGTH_RANK[a.strength];
  if (strength !== 0) return strength;
  if (b.evidence !== a.evidence) return b.evidence - a.evidence;
  return b.updatedAt - a.updatedAt;
}

/**
 * 스코프별 상한을 적용한다. pinned 는 상한 계산에서 면제되므로, 사용자가 16건을 모두 고정하면
 * 관측 성향이 들어갈 자리가 없어진다 — 의도된 동작이다(사용자 결정이 관측을 이긴다).
 */
export function evictOverLimit(facts: readonly PreferenceFact[]): PreferenceFact[] {
  const kept: PreferenceFact[] = [];
  const groups = new Map<string, PreferenceFact[]>();
  for (const fact of facts) {
    if (fact.pinned) {
      kept.push(fact);
      continue;
    }
    const key = fact.scope === "global" ? "global" : `project:${fact.projectScopeKey ?? ""}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(fact);
    else groups.set(key, [fact]);
  }
  for (const [key, bucket] of groups) {
    const limit = key === "global" ? GLOBAL_PREFERENCE_LIMIT : PROJECT_PREFERENCE_LIMIT;
    kept.push(...[...bucket].sort(comparePreferenceRank).slice(0, limit));
  }
  return kept;
}

export interface PreferenceUpsertInput {
  readonly text: string;
  readonly scope: PreferenceScope;
  readonly projectScopeKey?: string;
  readonly strength?: PreferenceStrength;
  readonly source?: PreferenceSource;
  /** 지정하면 그대로 쓴다(테스트 결정성). 생략하면 Date.now(). */
  readonly at?: number;
  readonly pinned?: boolean;
}

/**
 * 같은 스코프에서 정규화 텍스트가 겹치면 새 행을 만들지 않고 근거를 올린다.
 * 강도는 항상 **강한 쪽**을 취한다 — 되돌리기 3회로 strong 이 된 성향이 이후 약한 관측 한 건으로
 * weak 으로 내려가면 집계의 의미가 사라진다.
 */
export function upsertPreferenceFactIn(
  facts: readonly PreferenceFact[],
  input: PreferenceUpsertInput,
): { readonly facts: PreferenceFact[]; readonly changed: boolean; readonly fact: PreferenceFact | null } {
  const text = input.text.trim().slice(0, PREFERENCE_TEXT_MAX_CHARS);
  if (text.length === 0) return { facts: [...facts], changed: false, fact: null };
  const scope = input.scope;
  const projectScopeKey = scope === "project" ? input.projectScopeKey?.trim() : undefined;
  if (scope === "project" && !projectScopeKey) return { facts: [...facts], changed: false, fact: null };
  const at = input.at ?? Date.now();
  const needle = normalizePreferenceText(text);

  const index = facts.findIndex(
    (fact) =>
      fact.scope === scope
      && (scope === "global" || fact.projectScopeKey === projectScopeKey)
      && normalizePreferenceText(fact.text) === needle,
  );

  if (index >= 0) {
    const existing = facts[index];
    const strength = strongerOf(existing.strength, input.strength ?? existing.strength);
    const merged: PreferenceFact = {
      ...existing,
      text,
      strength,
      evidence: existing.evidence + 1,
      // 사용자가 직접 쓴/고정한 근거는 관측이 덮어쓰지 않는다.
      source: existing.source === "manual" ? "manual" : input.source ?? existing.source,
      updatedAt: at,
      ...(input.pinned === undefined ? {} : { pinned: input.pinned }),
    };
    const next = [...facts];
    next[index] = merged;
    return { facts: evictOverLimit(next), changed: true, fact: merged };
  }

  const created: PreferenceFact = {
    id: genId("pref"),
    text,
    scope,
    ...(projectScopeKey ? { projectScopeKey } : {}),
    strength: input.strength ?? "weak",
    evidence: 1,
    source: input.source ?? "observed",
    updatedAt: at,
    ...(input.pinned ? { pinned: true } : {}),
  };
  const next = evictOverLimit([...facts, created]);
  // 방금 만든 항목이 상한에 밀려 바로 축출되면 "저장했다"고 보고하지 않는다.
  const survived = next.some((fact) => fact.id === created.id);
  return { facts: next, changed: survived, fact: survived ? created : null };
}

/**
 * 프롬프트 블록 조립. 전역 → 프로젝트 순, 각 그룹 안에서 강한 것부터.
 * 줄 수와 문자 수 두 상한을 모두 지킨다(예산 밖 고정 블록이라 스스로 잘라야 한다).
 */
export function buildPreferenceMemorySectionFrom(
  facts: readonly PreferenceFact[],
  projectScopeKey?: string,
): string {
  const scopeKey = projectScopeKey?.trim();
  const global = facts.filter((fact) => fact.scope === "global").sort(comparePreferenceRank);
  const project = scopeKey
    ? facts.filter((fact) => fact.scope === "project" && fact.projectScopeKey === scopeKey).sort(comparePreferenceRank)
    : [];
  if (global.length === 0 && project.length === 0) return "";

  const lines: string[] = [PREFERENCE_SECTION_HEADING, PREFERENCE_PRECEDENCE_LINE];
  let bulletCount = 0;
  let omitted = 0;

  const pushBullets = (group: readonly PreferenceFact[], subheading?: string): void => {
    if (group.length === 0) return;
    const pending: string[] = subheading ? [subheading] : [];
    for (const fact of group) {
      if (bulletCount >= PREFERENCE_SECTION_MAX_LINES) {
        omitted += 1;
        continue;
      }
      const bullet = `- [${STRENGTH_LABEL[fact.strength]}] ${fact.text}`;
      const candidate = [...lines, ...pending, bullet].join("\n");
      if (candidate.length > PREFERENCE_SECTION_MAX_CHARS) {
        omitted += 1;
        continue;
      }
      pending.push(bullet);
      bulletCount += 1;
    }
    // 소제목만 남고 항목이 하나도 안 들어갔으면 소제목도 버린다.
    if (pending.length > (subheading ? 1 : 0)) lines.push(...pending);
  };

  pushBullets(global);
  pushBullets(project, PREFERENCE_PROJECT_SUBHEADING);
  if (bulletCount === 0) return "";
  if (omitted > 0) lines.push(`(그 외 ${omitted}건은 지면상 생략)`);
  return lines.join("\n");
}

function strongerOf(a: PreferenceStrength, b: PreferenceStrength): PreferenceStrength {
  return STRENGTH_RANK[a] >= STRENGTH_RANK[b] ? a : b;
}

// ── localStorage 게이트 ───────────────────────────────────────────

/** 저장된 성향 로드. localStorage 가 없거나 값이 깨졌으면 빈 목록(조용한 폴백). */
export function loadPreferenceFacts(): PreferenceFact[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(PREFERENCE_MEMORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as Record<string, unknown>).facts)
        ? ((parsed as Record<string, unknown>).facts as unknown[])
        : [];
    return evictOverLimit(list.filter(isPreferenceFact));
  } catch {
    return [];
  }
}

/**
 * 실제로 기록됐는지를 돌려준다. 호출부가 "성향을 기억했습니다"를 사람에게 말하는 경로라,
 * localStorage 부재·쿼터 초과로 한 줄도 안 남았을 때 성공으로 보고하면 그 문장이 거짓이 된다.
 */
export function savePreferenceFacts(facts: readonly PreferenceFact[]): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    const kept = evictOverLimit(facts.filter(isPreferenceFact));
    localStorage.setItem(PREFERENCE_MEMORY_STORAGE_KEY, JSON.stringify({ facts: kept }));
    return true;
  } catch {
    /* 쿼터 초과 등 저장 실패는 치명적이지 않다 — 성향 학습만 늦어진다. */
    return false;
  }
}

/** 성향 1건 기록. 새로 저장되거나 근거가 올라갔으면 true. */
export function upsertPreferenceFact(input: PreferenceUpsertInput): boolean {
  const result = upsertPreferenceFactIn(loadPreferenceFacts(), input);
  if (!result.changed) return false;
  return savePreferenceFacts(result.facts);
}

/** 여러 건 기록. 실제로 반영된 건수를 돌려준다(증류 결과 적용용). */
export function upsertPreferenceFacts(inputs: readonly PreferenceUpsertInput[]): number {
  let facts = loadPreferenceFacts();
  let changed = 0;
  for (const input of inputs) {
    const result = upsertPreferenceFactIn(facts, input);
    facts = result.facts;
    if (result.changed) changed += 1;
  }
  if (changed === 0) return 0;
  return savePreferenceFacts(facts) ? changed : 0;
}

/** id 로 삭제. pinned 도 삭제된다 — 사용자가 설정 화면에서 명시적으로 누른 경로다. */
export function deletePreferenceFact(id: string): void {
  const facts = loadPreferenceFacts();
  const next = facts.filter((fact) => fact.id !== id);
  if (next.length !== facts.length) savePreferenceFacts(next);
}

/**
 * 증류가 요청한 삭제. pinned 는 무시한다 — 사용자가 고정한 성향을 모델이 지우면
 * 고정 버튼이 아무 의미가 없다. 실제로 지운 건수를 돌려준다.
 */
export function dropPreferenceFactsUnpinned(ids: readonly string[]): number {
  if (ids.length === 0) return 0;
  const targets = new Set(ids);
  const facts = loadPreferenceFacts();
  const next = facts.filter((fact) => !(targets.has(fact.id) && !fact.pinned));
  const dropped = facts.length - next.length;
  if (dropped > 0) savePreferenceFacts(next);
  return dropped;
}

export function setPreferenceFactPinned(id: string, pinned: boolean): void {
  const facts = loadPreferenceFacts();
  const index = facts.findIndex((fact) => fact.id === id);
  if (index < 0) return;
  const next = [...facts];
  next[index] = { ...facts[index], pinned, updatedAt: Date.now() };
  savePreferenceFacts(next);
}

export function clearPreferenceFacts(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(PREFERENCE_MEMORY_STORAGE_KEY);
  } catch {
    /* 삭제 실패는 무시 — 다음 저장이 덮어쓴다. */
  }
}

/** 설정 화면 목록용 — 전역/프로젝트를 나눠 랭크 순으로 돌려준다. */
export function listPreferenceFacts(projectScopeKey?: string): {
  readonly global: readonly PreferenceFact[];
  readonly project: readonly PreferenceFact[];
} {
  const facts = loadPreferenceFacts();
  const scopeKey = projectScopeKey?.trim();
  return {
    global: facts.filter((fact) => fact.scope === "global").sort(comparePreferenceRank),
    project: scopeKey
      ? facts.filter((fact) => fact.scope === "project" && fact.projectScopeKey === scopeKey).sort(comparePreferenceRank)
      : [],
  };
}

/** 시스템 프롬프트에 붙일 성향 블록. 성향이 없으면 빈 문자열(호출부가 그냥 안 붙인다). */
export function buildPreferenceMemorySection(projectScopeKey?: string): string {
  return buildPreferenceMemorySectionFrom(loadPreferenceFacts(), projectScopeKey);
}
