export interface DeploymentFileRecord {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface ParsedPlayerDeploymentManifest {
  readonly artifactDigest: string;
  readonly files: readonly DeploymentFileRecord[];
  readonly deployment: {
    readonly entryHtml: string;
    readonly entryScript: string;
    readonly viteManifest: string;
    readonly runtimeAssets: readonly DeploymentFileRecord[];
  };
}

export interface WebPlayerBundleFile {
  readonly sourcePath: string;
  readonly zipPath: string;
  readonly bytes: Uint8Array;
}

export interface VerifiedPlayerDeployment {
  readonly bundleFiles: readonly WebPlayerBundleFile[];
  readonly runtimeAssets: readonly WebPlayerBundleFile[];
}

export type FetchBytes = (path: string) => Promise<Uint8Array>;

export interface PlayerDeploymentAdapters {
  readonly fetchBytes: FetchBytes;
  readonly hashBytes?: (bytes: Uint8Array) => Promise<string>;
  readonly hashText?: (text: string) => Promise<string>;
  readonly parseJson?: (text: string) => unknown;
}

export interface LoadVerifiedPlayerDeploymentOptions {
  readonly bundleBase: string;
  readonly adapters: PlayerDeploymentAdapters;
}
