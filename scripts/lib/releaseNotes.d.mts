// scripts/lib/releaseNotes.d.mts
// scripts/lib/releaseNotes.mjs 의 타입 선언.

export type ReleaseItem = {
  readonly sha: string;
  readonly type: string | null;
  readonly scope: string | null;
  readonly summary: string;
  readonly breaking: boolean;
  readonly section: string;
};

export type ReleaseSection = {
  readonly title: string;
  readonly items: readonly ReleaseItem[];
};

export type ReleaseCommit = {
  readonly sha: string;
  readonly subject: string;
};

export declare const SECTION_TITLES: readonly (readonly [string, string])[];
export declare const RELEASE_KINDS: readonly string[];

export declare function parseCommitSubject(
  subject: string,
): { type: string | null; scope: string | null; summary: string; breaking: boolean } | null;

export declare function collectReleaseItems(commits: readonly ReleaseCommit[]): ReleaseItem[];

export declare function buildReleaseSections(items: readonly ReleaseItem[]): ReleaseSection[];

export declare function renderReleaseNotes(input: {
  version: string;
  date: string;
  summary?: string | null;
  sections: readonly ReleaseSection[];
  omitted?: number;
}): string;

export declare function bumpVersion(version: string, kind: string): string;

export declare function decideReleaseKind(commits: readonly ReleaseCommit[]): "minor" | "patch" | null;
