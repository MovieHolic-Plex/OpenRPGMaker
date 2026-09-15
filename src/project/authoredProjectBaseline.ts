import type { Project } from "./types";
import { canonicalJsonString } from "@/project/persistence/core/canonicalJson";

// Same JSON value semantics as proposal bases and remote JSONB: object key order
// is not authored drift. Array order and every authored value remain significant.
function contentIdentity(value: unknown): string {
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

/** Capture at draft creation, not at acceptance. No mutable Project reference is
 * authority; context refreshes and callers cannot rewrite these captured values. */
export class AuthoredProjectBaseline {
  private readonly authored: string;
  private readonly complete: string;

  constructor(project: Project) {
    this.authored = authoredIdentity(project);
    this.complete = contentIdentity(project);
    Object.freeze(this);
  }

  matches(project: Project, includeWiki = false): boolean {
    return includeWiki ? this.complete === contentIdentity(project) : this.authored === authoredIdentity(project);
  }
}
