// scripts/lib/canonical-project-digest.d.mts
// Type declarations for the canonical project content digest helpers.

export declare function stableProjectSerialize(value: unknown, indent?: number): string;
export declare function canonicalProjectDigest(project: unknown): string;
export declare const browserCanonicalDigestSource: string;
export interface BrowserCanonicalDigestInput {
  readonly project: unknown;
  readonly source: string;
}
export declare function evaluateBrowserCanonicalDigest(
  project: unknown,
  evaluate: (
    callback: (input: BrowserCanonicalDigestInput) => Promise<string>,
    input: BrowserCanonicalDigestInput,
  ) => Promise<string>,
): Promise<string>;
