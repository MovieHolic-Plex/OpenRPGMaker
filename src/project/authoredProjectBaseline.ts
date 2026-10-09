import type { Project } from "./types";
import { canonicalJsonOf } from "@/project/persistence/core/canonicalJson";
import { jsonContentDigest, trustSharedProjectEntries, withTrustedSharedEntries } from "@/project/persistence/core/contentDigest";

// Same JSON value semantics as proposal bases and remote JSONB: object key order
// is not authored drift. Array order and every authored value remain significant.
export function contentIdentity(value: unknown): string {
  const out = canonicalJsonOf(value);
  // 예전 구현(JSON.parse(JSON.stringify(undefined)))과 같이 JSON 값이 없으면 던진다.
  if (out === undefined) throw new SyntaxError("contentIdentity: value has no JSON representation");
  return out;
}

/** Wiki documents have an independent editor checkpoint owner. World graph
 * registrations and relations do not: concurrent NPC/place edits invalidate a draft.
 * Legacy guidelines are codex documents even without the newer wiki metadata. */
function authoredWorld(world: Project["world"]) {
  return {
    entities: world?.entities.filter(entity => !entity.wiki && entity.type !== "guideline") ?? [],
    relations: world?.relations ?? [],
  };
}

/** Authored candidate without coordinator-owned wiki documents. Approval covers
 * this; wiki-only drift (checkpoint receipts, manual notes) never invalidates it. */
export function authoredIdentity(project: Project): string {
  return composeProjectIdentity(projectIdentityParts(project), "authored");
}

/**
 * 프로젝트 최상위 키(world 제외)별 정렬 직렬화 조각. 제안 기준·저작 정체성·전체 정체성은
 * world 만 다르고 나머지(타일셋·DB·맵 = 수 MB)는 같다 — 조각을 한 번 만들어 셋이 나눠 쓴다.
 * 조각은 만든 그 순간의 값이다. 객체를 제자리에서 고칠 수 있으니 호출자가 한 동기 구간 안에서만 재사용한다.
 */
export interface ProjectIdentityParts {
  readonly project: Project;
  /** [키, `"키":값`] — JSON 값이 없는 키(undefined·함수)는 빠져 있다. */
  readonly entries: readonly (readonly [string, string])[];
}

export function projectIdentityParts(project: Project): ProjectIdentityParts {
  const record = project as unknown as Record<string, unknown>;
  const entries: [string, string][] = [];
  for (const key of Object.keys(record)) {
    if (key === "world") continue;
    const piece = canonicalJsonOf(record[key], key);
    if (piece !== undefined) entries.push([key, `${JSON.stringify(key)}:${piece}`]);
  }
  return { project, entries };
}

/**
 * - `proposal`: world 를 뺀 프로젝트(= `{ ...project, world: undefined }`).
 * - `authored`: wiki 문서를 걸러 낸 world 를 붙인 프로젝트(authoredIdentity).
 * - `complete`: 프로젝트 전체(contentIdentity(project)).
 */
export function composeProjectIdentity(parts: ProjectIdentityParts, kind: "proposal" | "authored" | "complete"): string {
  const project = parts.project;
  // 최상위에 toJSON 이 있으면 조각 분해가 JSON 의미와 달라진다 — 통째로 계산한다.
  if (typeof (project as { toJSON?: unknown }).toJSON === "function") {
    if (kind === "complete") return contentIdentity(project);
    const { world, ...rest } = project;
    return contentIdentity(kind === "proposal" ? rest : { ...rest, world: authoredWorld(world) });
  }
  const world = kind === "proposal" ? undefined
    : canonicalJsonOf(kind === "authored" ? authoredWorld(project.world) : project.world, "world");
  const entries = world === undefined ? [...parts.entries] : [...parts.entries, ["world", `"world":${world}`] as const];
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return `{${entries.map(entry => entry[1]).join(",")}}`;
}

function digestOf(value: unknown): string {
  const digest = jsonContentDigest(value);
  if (digest === undefined) throw new SyntaxError("projectDigest: value has no JSON representation");
  return digest;
}

/**
 * 정체성의 SHA-256 요약. 요약이 같다 ⇔ 같은 종류의 정체성 문자열(composeProjectIdentity)이 같다.
 * 적용 권위는 이것만 비교한다 — 정체성 문자열을 통째로 만들고 해시하면 큰 프로젝트에서 체크포인트마다
 * 메인 스레드가 초 단위로 멈춘다(contentDigest 주석).
 */
export function projectIdentityDigest(project: Project, kind: "proposal" | "authored" | "complete"): string {
  // 타일셋·업로드 자산 항목은 제자리에서 고치지 않는다(projectClone 계약) — 한 번 요약한 항목은 다음 권위 요약부터 대조하지 않는다.
  // 사람 편집의 제자리 수정(stale-base 가 잡아야 하는 것)은 데이터베이스·맵·시스템 쪽이고 그 가지는 계속 대조한다.
  return withTrustedSharedEntries(() => {
    let digest: string;
    if (kind === "complete") digest = digestOf(project);
    else {
      const { world, ...rest } = project;
      digest = digestOf(kind === "proposal" ? rest : { ...rest, world: authoredWorld(world) });
    }
    trustSharedProjectEntries(project);
    return digest;
  });
}

/** 같은 프로젝트 객체의 정체성 요약을 다시 계산하지 않게 해 주는 공급자(한 동기 구간 안에서만 기억한다). */
export interface ProjectIdentitySource {
  authored(project: Project): string;
  complete(project: Project): string;
}

const direct: ProjectIdentitySource = {
  authored: project => projectIdentityDigest(project, "authored"),
  complete: project => projectIdentityDigest(project, "complete"),
};

/** Capture at draft creation, not at acceptance. No mutable Project reference is
 * authority; context refreshes and callers cannot rewrite these captured values. */
export class AuthoredProjectBaseline {
  private readonly authored: string;
  private readonly complete: string;

  constructor(project: Project, identities: ProjectIdentitySource = direct) {
    // Keep immutable authority, not two full project JSON strings, for the
    // lifetime of a detached draft. Every check re-verifies current values.
    this.authored = identities.authored(project);
    this.complete = identities.complete(project);
    Object.freeze(this);
  }

  matches(project: Project, includeWiki = false, identities: ProjectIdentitySource = direct): boolean {
    return includeWiki ? this.complete === identities.complete(project)
      : this.authored === identities.authored(project);
  }
}
