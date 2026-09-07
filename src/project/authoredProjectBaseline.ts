import type { Project } from "./types";

/** Wiki documents have an independent editor checkpoint owner. World graph
 * registrations and relations do not: concurrent NPC/place edits invalidate a draft.
 * Legacy guidelines are codex documents even without the newer wiki metadata. */
/** Authored candidate without coordinator-owned wiki documents. Approval covers
 * this; wiki-only drift (checkpoint receipts, manual notes) never invalidates it. */
export function authoredIdentity(project: Project): string {
  const { world, ...authored } = project;
  return JSON.stringify({ ...authored, world: {
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
    this.complete = JSON.stringify(project);
    Object.freeze(this);
  }

  matches(project: Project, includeWiki = false): boolean {
    return includeWiki ? this.complete === JSON.stringify(project) : this.authored === authoredIdentity(project);
  }
}
