// scripts/lib/releaseNotes.d.mts
// scripts/lib/releaseNotes.mjs 의 타입 선언.

export type ReleaseItem = {
  readonly sha: string;
  readonly type: string | null;
  readonly scope: string | null;
  readonly summary: string;
  readonly breaking: boolean;
  readonly section: string;
  readonly prNumber?: number | null;
  readonly note?: string;
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
export declare const USER_SECTION_TITLES: readonly string[];
export declare const DEV_SECTION_TITLES: readonly string[];
export declare const HIGHLIGHTS_TITLE: string;
export declare const DEV_GROUP_TITLE: string;
export declare const HIGHLIGHT_LIMIT: number;
export declare const RELEASE_KINDS: readonly string[];

export declare function parseCommitSubject(
  subject: string,
): { type: string | null; scope: string | null; summary: string; breaking: boolean } | null;

export declare function extractPrNumber(text: string | null | undefined): number | null;

export declare function extractReleaseNotesFromPrBody(body: string | null | undefined): string | null;

export declare function collectReleaseItems(commits: readonly ReleaseCommit[]): ReleaseItem[];

export declare function enrichReleaseItems(
  items: readonly ReleaseItem[],
  fetchPrBody?: ((prNumber: number) => string | null) | null,
): ReleaseItem[];

export declare function buildReleaseSections(items: readonly ReleaseItem[]): ReleaseSection[];

export declare function pickHighlights(
  items: readonly ReleaseItem[],
  options?: { limit?: number },
): ReleaseItem[];

export declare function renderReleaseNotes(input: {
  version: string;
  date: string;
  summary?: string | null;
  sections: readonly ReleaseSection[];
  omitted?: number;
  highlights?: readonly ReleaseItem[] | null;
}): string;

export declare function bumpVersion(version: string, kind: string): string;

export declare function decideReleaseKind(commits: readonly ReleaseCommit[]): "minor" | "patch" | null;
