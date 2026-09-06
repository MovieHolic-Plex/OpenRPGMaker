import { contractFailure } from "@/project/playerDeploymentErrors";
import { pathCollisionKey } from "@/project/playerDeploymentManifest";
import type { FetchBytes, VerifiedPlayerDeployment } from "@/project/playerDeploymentManifest";
import type { ZipEntry } from "@/project/packageZip";
import { dataUrlBytes, exportAssetSourceUrl, invalidExportDependencyBytes } from "@/project/webExportAssets";
import { prunedRuntimeAssetPaths } from "@/project/webExportRuntimeAssets";
import type { PreparedWebExport, WebExportAsset } from "@/project/webExportTypes";

const encoder = new TextEncoder();

export async function exactWebExportEntries(
  prepared: PreparedWebExport,
  deployment: VerifiedPlayerDeployment,
  fetchBytes: FetchBytes,
): Promise<readonly ZipEntry[]> {
  const entries = new Map<string, ZipEntry>();
  const collisionIndex = new Map<string, string>();
  addExactEntry({ entries, collisionIndex, entry: textEntry("project.json", prepared.projectJson) });
  for (const file of deployment.bundleFiles) {
    addExactEntry({ entries, collisionIndex, entry: { name: file.zipPath, bytes: file.bytes } });
  }
  // SDK 매니페스트는 전량 검증하되(위조 탐지 유지), 이 프로젝트가 안 쓰는 기능의 아트는 싣지
  // 않는다. 빼는 판단은 webExportRuntimeAssets 의 조건부 그룹 **한 곳** 에만 있고, 여기서는
  // 그 목록만 따른다 — 매니페스트에 있는데 그 목록에 없는 것은 무조건 싣는다(안전한 쪽 기본값).
  const prunedPaths = prunedRuntimeAssetPaths(prepared.project);
  for (const asset of deployment.runtimeAssets) {
    if (prunedPaths.has(asset.zipPath)) continue;
    addExactEntry({ entries, collisionIndex, entry: { name: asset.zipPath, bytes: asset.bytes } });
  }
  const missingAssets = prepared.assets.filter((asset) => (
    reserveMissingAssetPath(asset.zipPath, entries, collisionIndex)
  ));
  for (const entry of await assetEntries(missingAssets, fetchBytes)) {
    addExactEntry({ entries, collisionIndex, entry });
  }
  return Object.freeze([...entries.values()].sort((left, right) => left.name.localeCompare(right.name)));
}

export async function defaultFetchBytes(path: string): Promise<Uint8Array> {
  const response = await fetch(path);
  if (!response.ok) throw new Error("Web export dependency request failed");
  return new Uint8Array(await response.arrayBuffer());
}

function reserveMissingAssetPath(
  filePath: string,
  entries: ReadonlyMap<string, ZipEntry>,
  collisionIndex: Map<string, string>,
): boolean {
  const key = pathCollisionKey(filePath);
  const previous = collisionIndex.get(key);
  if (previous === filePath && entries.has(filePath)) return false;
  if (previous !== undefined) contractFailure("zip-path-collision");
  collisionIndex.set(key, filePath);
  return true;
}

function addExactEntry(options: {
  readonly entries: Map<string, ZipEntry>;
  readonly collisionIndex: Map<string, string>;
  readonly entry: ZipEntry;
}): void {
  const key = pathCollisionKey(options.entry.name);
  const previous = options.collisionIndex.get(key);
  if (previous !== undefined && previous !== options.entry.name) contractFailure("zip-path-collision");
  if (options.entries.has(options.entry.name)) contractFailure("manifest-incomplete");
  options.collisionIndex.set(key, options.entry.name);
  options.entries.set(options.entry.name, options.entry);
}

async function assetEntries(assets: readonly WebExportAsset[], fetchBytes: FetchBytes): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];
  for (const asset of assets) {
    if (asset.kind === "uploaded") {
      entries.push({ name: asset.zipPath, bytes: dataUrlBytes(asset.asset.dataUrl) });
      continue;
    }
    try {
      const bytes = await fetchBytes(exportAssetSourceUrl(asset.sourcePath));
      if (invalidExportDependencyBytes(bytes)) contractFailure("runtime-asset-unavailable");
      entries.push({ name: asset.zipPath, bytes });
    } catch {
      contractFailure("runtime-asset-unavailable");
    }
  }
  return entries;
}

function textEntry(name: string, text: string): ZipEntry {
  return { name, bytes: encoder.encode(text) };
}
