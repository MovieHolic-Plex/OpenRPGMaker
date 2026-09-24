import type { Project } from "./types";
import { canonicalJsonOf } from "@/project/persistence/core/canonicalJson";
import { sha256HexTextSync } from "@/util/sha256";

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

/**
 * 같은 프로젝트 객체의 정체성 문자열을 다시 계산하지 않게 해 주는 공급자. 호출자가 «이 객체는 그 뒤로
 * 바뀌지 않았다»를 보증할 수 있을 때만 준다(스토어의 현재 프로젝트 + 같은 편집 세대).
 */
export interface ProjectIdentitySource {
  authored(project: Project): string;
  complete(project: Project): string;
}

const direct: ProjectIdentitySource = { authored: authoredIdentity, complete: contentIdentity };

/** Capture at draft creation, not at acceptance. No mutable Project reference is
 * authority; context refreshes and callers cannot rewrite these captured values. */
export class AuthoredProjectBaseline {
  private readonly authored: string;
  private readonly complete: string;

  constructor(project: Project, identities: ProjectIdentitySource = direct) {
    // Keep immutable authority, not two full project JSON strings, for the
    // lifetime of a detached draft. Canonicalization still runs on every check.
    this.authored = sha256HexTextSync(identities.authored(project));
    this.complete = sha256HexTextSync(identities.complete(project));
    Object.freeze(this);
  }

  matches(project: Project, includeWiki = false, identities: ProjectIdentitySource = direct): boolean {
    return includeWiki ? this.complete === sha256HexTextSync(identities.complete(project))
      : this.authored === sha256HexTextSync(identities.authored(project));
  }
}
