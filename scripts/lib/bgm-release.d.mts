// scripts/lib/bgm-release.d.mts
// Type declarations for the BGM release install helpers used from TypeScript callers.

export type BgmTrack = {
  readonly id: string;
  readonly fileName: string;
  readonly bytes: number;
  readonly sha256: string;
};

export type BgmManifest = {
  readonly schemaVersion: number;
  readonly version: number;
  readonly repo: string;
  readonly tag: string;
  readonly count: number;
  readonly totalBytes: number;
  readonly archive: { readonly fileName: string; readonly bytes: number; readonly sha256: string };
  readonly tracks: readonly BgmTrack[];
};

export type BgmInstallResult = {
  readonly installed: number;
  readonly verified: number;
  readonly complete: boolean;
};

export declare function readTrustedManifest(path: string): Promise<BgmManifest>;

export declare function installRelease(input: {
  readonly root: string;
  readonly manifest: BgmManifest;
  readonly archive?: string;
  readonly signal?: AbortSignal;
}): Promise<BgmInstallResult>;

export declare function verifyInstalled(input: {
  readonly root: string;
  readonly manifest: BgmManifest;
  readonly signal?: AbortSignal;
}): Promise<{ readonly verified: number; readonly missing: readonly string[]; readonly complete: boolean }>;
