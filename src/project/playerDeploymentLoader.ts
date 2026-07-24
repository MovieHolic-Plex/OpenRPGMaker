import { parsePlayerDeploymentManifest } from "@/project/playerDeploymentContract";
import { contractFailure } from "@/project/playerDeploymentErrors";
import { parseJsonObject } from "@/project/playerDeploymentPaths";
import type {
  DeploymentFileRecord,
  FetchBytes,
  LoadVerifiedPlayerDeploymentOptions,
  PlayerDeploymentAdapters,
  VerifiedPlayerDeployment,
  WebPlayerBundleFile,
} from "@/project/playerDeploymentTypes";
import { verifyViteDeploymentClosure } from "@/project/playerViteDeployment";
import { sha256HexBytes, sha256HexText } from "@/util/sha256";

export const WEB_PLAYER_MANIFEST = "sdk-manifest.json";

export async function discoverWebPlayerBundleFiles(
  bundleBase: string,
  fetchBytes: FetchBytes,
): Promise<readonly WebPlayerBundleFile[]> {
  return (await loadVerifiedPlayerDeployment({ bundleBase, adapters: { fetchBytes } })).bundleFiles;
}

export async function loadVerifiedPlayerDeployment(
  options: LoadVerifiedPlayerDeploymentOptions,
): Promise<VerifiedPlayerDeployment> {
  const adapters = resolvedAdapters(options.adapters);
  const manifestBytes = await fetchManifestBytes(options.bundleBase, adapters.fetchBytes);
  const manifest = await parsePlayerDeploymentManifest(manifestBytes, adapters);
  const bundleFiles = await Promise.all(manifest.files.map(async (record) => ({
    sourcePath: joinUrlPath(options.bundleBase, record.path),
    zipPath: record.path,
    bytes: await fetchVerifiedRecord({
      sourcePath: joinUrlPath(options.bundleBase, record.path),
      record,
      adapters,
      kind: "bundle",
    }),
  })));
  const viteManifestFile = bundleFiles.find((file) => file.zipPath === manifest.deployment.viteManifest);
  if (!viteManifestFile) contractFailure("manifest-incomplete");
  const viteManifestValue = parseJsonObject(viteManifestFile.bytes, "manifest-incomplete", adapters.parseJson);
  verifyViteDeploymentClosure(manifest, viteManifestValue);
  const runtimeAssets = await Promise.all(manifest.deployment.runtimeAssets.map(async (record) => ({
    sourcePath: `/${record.path}`,
    zipPath: record.path,
    bytes: await fetchVerifiedRecord({
      sourcePath: `/${record.path}`,
      record,
      adapters,
      kind: "runtime-asset",
    }),
  })));
  return { bundleFiles: Object.freeze(bundleFiles), runtimeAssets: Object.freeze(runtimeAssets) };
}

function resolvedAdapters(adapters: PlayerDeploymentAdapters): Required<PlayerDeploymentAdapters> {
  return {
    fetchBytes: adapters.fetchBytes,
    hashBytes: adapters.hashBytes ?? sha256HexBytes,
    hashText: adapters.hashText ?? sha256HexText,
    parseJson: adapters.parseJson ?? JSON.parse,
  };
}

async function fetchManifestBytes(bundleBase: string, fetchBytes: FetchBytes): Promise<Uint8Array> {
  try {
    return await fetchBytes(joinUrlPath(bundleBase, WEB_PLAYER_MANIFEST));
  } catch {
    contractFailure("manifest-unavailable");
  }
}

async function fetchVerifiedRecord(options: {
  readonly sourcePath: string;
  readonly record: DeploymentFileRecord;
  readonly adapters: Required<PlayerDeploymentAdapters>;
  readonly kind: "bundle" | "runtime-asset";
}): Promise<Uint8Array> {
  let bytes: Uint8Array;
  try {
    bytes = await options.adapters.fetchBytes(options.sourcePath);
  } catch {
    contractFailure(options.kind === "bundle" ? "bundle-unavailable" : "runtime-asset-unavailable");
  }
  let digest: string;
  try {
    digest = await options.adapters.hashBytes(bytes);
  } catch {
    contractFailure(options.kind === "bundle" ? "bundle-integrity-mismatch" : "runtime-asset-integrity-mismatch");
  }
  if (bytes.length !== options.record.bytes || digest !== options.record.sha256) {
    contractFailure(options.kind === "bundle" ? "bundle-integrity-mismatch" : "runtime-asset-integrity-mismatch");
  }
  return bytes;
}

function joinUrlPath(base: string, filePath: string): string {
  return `${base.replace(/\/+$/u, "")}/${filePath.replace(/^\/+/u, "")}`;
}
