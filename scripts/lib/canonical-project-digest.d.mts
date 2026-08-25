// scripts/lib/canonical-project-digest.d.mts
// Type declarations for the canonical project content digest helpers.

export declare function stableProjectSerialize(value: unknown, indent?: number): string;
export declare function canonicalProjectDigest(project: unknown): string;
export declare const browserCanonicalDigestSource: string;
