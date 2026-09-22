import type { Project } from "./types";
import { canonicalJsonString } from "@/project/persistence/core/canonicalJson";

// Same JSON value semantics as proposal bases and remote JSONB: object key order
// is not authored drift. Array order and every authored value remain significant.
export function contentIdentity(value: unknown): string {
  return canonicalJsonString(JSON.parse(JSON.stringify(value)));
}

/** Wiki documents have an independent editor checkpoint owner. World graph
 * registrations and relations do not: concurrent NPC/place edits invalidate a draft.
 * Legacy guidelines are codex documents even without the newer wiki metadata. */
/** Authored candidate without coordinator-owned wiki documents. Approval covers
 * this; wiki-only drift (checkpoint receipts, manual notes) never invalidates it. */
export function authoredIdentity(project: Project): string {
  const { world, ...authored } = project;
  return contentIdentity({ ...authored, world: {
    entities: world?.entities.filter(entity => !entity.wiki && entity.type !== "guideline") ?? [],
    relations: world?.relations ?? [],
  } });
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
    this.authored = identities.authored(project);
    this.complete = identities.complete(project);
    Object.freeze(this);
  }

  matches(project: Project, includeWiki = false, identities: ProjectIdentitySource = direct): boolean {
    return includeWiki ? this.complete === identities.complete(project) : this.authored === identities.authored(project);
  }
}
